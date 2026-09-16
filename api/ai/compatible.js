const PROVIDERS = {
  zai: {
    chat: 'https://api.z.ai/api/paas/v4/chat/completions',
    images: 'https://api.z.ai/api/paas/v4/images/generations',
  },
  kimi: {
    chat: 'https://api.moonshot.ai/v1/chat/completions',
  },
};

import { applyCors } from '../lib/cors.js';
import { requireActiveSubscription } from '../lib/require-access.js';
import { consumeRateLimit, rateLimitResponse } from '../lib/rate-limit.js';
import { assertPublicHttpUrl } from '../../urlSourceFetch.js';
import {
  isPlatformModelAllowed,
  PLATFORM_MAX_TOKENS,
  PLATFORM_MAX_PROMPT_CHARS,
} from '../../shared/ai-models.js';

/**
 * Tecto da função (plano Pro permite até 300 s). Um carrossel de 8-10 cards com
 * material colado pede ~7k tokens de saída, o que em glm-4.7 passa facilmente de
 * um minuto — com `maxDuration: 60` + abort a 50 s o pedido morria a meio.
 * O orçamento abaixo é partilhado pelas duas tentativas: cada fetch aborta com o
 * tempo que resta, e o retry só corre se ainda houver margem útil.
 */
export const config = { maxDuration: 300 };
const TOTAL_BUDGET_MS = 240_000;
const MIN_RETRY_BUDGET_MS = 30_000;

function messagesChars(payload) {
  const msgs = Array.isArray(payload?.messages) ? payload.messages : [];
  return msgs.reduce((n, m) => n + String(typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '')).length, 0);
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

async function fetchProviderImageAsBase64(imageUrl) {
  // Revalida URL pública — evita SSRF se o upstream devolver URL interna.
  const safe = assertPublicHttpUrl(imageUrl);
  const imageResponse = await fetch(safe, { redirect: 'error' });
  if (!imageResponse.ok) {
    throw new Error('Não foi possível baixar a imagem gerada.');
  }
  const mime = imageResponse.headers.get('content-type') || 'image/png';
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  return { b64_json: bytes.toString('base64'), mime };
}

export default async function handler(req, res) {
  applyCors(req, res, { credentials: true });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const limited = consumeRateLimit(req, { limit: 40, windowMs: 60_000, keyPrefix: 'compatible' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec, true);

  const access = await requireActiveSubscription(req, res, { errorShape: 'nested' });
  if (!access) return;

  const { provider, operation = 'chat', apiKey, payload } = readBody(req);
  const target = PROVIDERS[provider]?.[operation];
  if (!target || !['chat', 'images'].includes(operation)) {
    return res.status(400).json({ error: { message: 'Provedor ou operação inválida.' } });
  }
  const envKey = provider === 'zai'
    ? String(process.env.ZAI_API_KEY || '').trim()
    : provider === 'kimi'
      ? String(process.env.KIMI_API_KEY || '').trim()
      : '';
  const userKey = String(apiKey || '').trim();
  // Imagens só com chave do utilizador: a chave da plataforma não tem quota neste endpoint (auditoria C2).
  if (operation === 'images' && !userKey) {
    return res.status(400).json({
      error: { message: 'Geração de imagem por este provedor exige a sua própria chave (Configurar IA → Avançado).' },
    });
  }
  const resolvedKey = userKey || envKey;
  if (!resolvedKey) {
    return res.status(400).json({
      error: {
        message: operation === 'chat'
          ? `Chave ${provider} ausente. Texto do plano usa Z.ai no servidor — define ZAI_API_KEY, ou adiciona chave em ⚙.`
          : `Chave ${provider} ausente.`,
      },
    });
  }
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: { message: 'Payload ausente.' } });
  }
  // Chave da plataforma: allowlist de modelo, sem stream/tools, tectos de tokens e prompt (auditoria H4).
  if (!userKey) {
    if (!isPlatformModelAllowed(provider, payload.model)) {
      return res.status(400).json({ error: { message: `Modelo "${String(payload.model || '')}" não disponível no plano. Use a sua chave em ⚙ para outros modelos.` } });
    }
    if (payload.stream || payload.tools || payload.functions || payload.tool_choice) {
      return res.status(400).json({ error: { message: 'stream/tools não são suportados com a chave do plano.' } });
    }
    if (messagesChars(payload) > PLATFORM_MAX_PROMPT_CHARS) {
      return res.status(413).json({ error: { message: 'Prompt demasiado longo. Reduza o material/fontes coladas.' } });
    }
    const requested = Number(payload.max_tokens);
    payload.max_tokens = Number.isFinite(requested) && requested > 0
      ? Math.min(requested, PLATFORM_MAX_TOKENS)
      : Math.min(4096, PLATFORM_MAX_TOKENS);
  }

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const budgetLeft = () => deadline - Date.now();

  try {
    const attemptFetch = async () => fetch(target, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resolvedKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(Math.max(5_000, budgetLeft())),
    });

    let upstream = await attemptFetch();
    let raw = await upstream.text();

    // Retry único em overload transitório da Z.ai (1305 / 429) — só em resposta de ERRO;
    // antes o regex corria sobre o conteúdo gerado e repetia chamadas 200 (auditoria H3).
    const upstreamErrorCode = () => {
      try { const j = JSON.parse(raw); return String(j?.error?.code || j?.code || ''); } catch { return ''; }
    };
    if (
      provider === 'zai'
      && operation === 'chat'
      && !upstream.ok
      && (upstream.status === 429 || upstreamErrorCode() === '1305')
      && budgetLeft() > MIN_RETRY_BUDGET_MS
    ) {
      await new Promise((r) => setTimeout(r, 1200));
      upstream = await attemptFetch();
      raw = await upstream.text();
    }

    if (operation === 'images' && upstream.ok) {
      const data = JSON.parse(raw);
      const imageUrl = data?.data?.[0]?.url;
      if (imageUrl) {
        try {
          const { b64_json, mime } = await fetchProviderImageAsBase64(imageUrl);
          return res.status(200).json({
            ...data,
            data: [{ ...data.data[0], url: undefined, b64_json, mime }],
          });
        } catch (e) {
          return res.status(502).json({
            error: { message: e?.message || 'Não foi possível baixar a imagem gerada.' },
          });
        }
      }
    }
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(raw);
  } catch (error) {
    console.error(`[ai/compatible] ${provider}/${operation}`, error?.message || error);
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return res.status(timedOut ? 504 : 502).json({
      error: {
        message: timedOut
          ? 'A IA demorou demasiado a responder. Tente de novo, com menos cards ou menos material colado em Fontes.'
          : 'Falha ao conectar ao provedor de IA.',
        code: timedOut ? 'upstream_timeout' : 'upstream_error',
      },
    });
  }
}
