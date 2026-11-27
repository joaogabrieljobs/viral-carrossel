import { consumeTextCredit, textDailyLimit } from '../lib/text-quota.js';
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
import {
  REFERENCE_VISION_PURPOSE, REFERENCE_VISION_MODEL, REFERENCE_VISION_MAX_IMAGES,
  REFERENCE_VISION_MAX_IMAGE_CHARS, REFERENCE_VISION_MAX_TEXT_CHARS, REFERENCE_VISION_MAX_TOKENS,
} from '../../shared/reference-vision.js';
import { parseImageReferences } from '../lib/image-references.js';

/**
 * Tecto da função (plano Pro permite até 300 s). Um carrossel de 8-10 cards com
 * material colado pede ~7k tokens de saída, o que em glm-4.7 passa facilmente de
 * um minuto — com `maxDuration: 60` + abort a 50 s o pedido morria a meio.
 * O orçamento abaixo é partilhado pelas duas tentativas: cada fetch aborta com o
 * tempo que resta, e o retry só corre se ainda houver margem útil.
 */
export const config = { maxDuration: 300 };
const TOTAL_BUDGET_MS = 240_000;
const REFERENCE_VISION_BUDGET_MS = 90_000;
const MIN_RETRY_BUDGET_MS = 30_000;

function messagesChars(payload) {
  const msgs = Array.isArray(payload?.messages) ? payload.messages : [];
  return msgs.reduce((n, m) => n + String(typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '')).length, 0);
}

const REFERENCE_VISION_FIELDS = new Set([
  'model', 'messages', 'max_tokens', 'temperature', 'top_p', 'thinking', 'response_format', 'n', 'stream',
]);
const plainObject = value => value != null && typeof value === 'object' && !Array.isArray(value);
const onlyFields = (value, allowed) => plainObject(value) && Object.keys(value).every(key => allowed.includes(key));

// Exceção estreita para os bytes das referências: nenhum campo arbitrário,
// URL remota, ferramenta ou orçamento alternativo entra por este purpose.
// Toda a validação ocorre antes de reservar crédito, inclusive com BYOK.
function referenceVisionProblem(payload) {
  const invalid = (message) => ({ status: 400, code: 'reference_visual_invalid_request', message });
  const tooLarge = (message) => ({ status: 413, code: 'reference_visual_too_large', message });
  if (!plainObject(payload) || payload.model !== REFERENCE_VISION_MODEL
    || Object.keys(payload).some(key => !REFERENCE_VISION_FIELDS.has(key))
    || (payload.stream != null && payload.stream !== false)
    || (payload.n != null && payload.n !== 1)) {
    return invalid('Pedido de análise visual inválido. Reenvie as referências e tente novamente.');
  }
  if ((payload.thinking != null && (!onlyFields(payload.thinking, ['type']) || payload.thinking.type !== 'disabled'))
    || (payload.response_format != null && (!onlyFields(payload.response_format, ['type']) || payload.response_format.type !== 'json_object'))
    || (payload.temperature != null && (typeof payload.temperature !== 'number' || !Number.isFinite(payload.temperature) || payload.temperature < 0 || payload.temperature > 1))
    || (payload.top_p != null && (typeof payload.top_p !== 'number' || !Number.isFinite(payload.top_p) || payload.top_p <= 0 || payload.top_p > 1))) {
    return invalid('Opção de análise visual inválida. Recarregue a página e tente novamente.');
  }
  const messages = payload.messages;
  if (!Array.isArray(messages) || messages.length !== 2
    || !messages.every(message => onlyFields(message, ['role', 'content']))
    || messages[0].role !== 'system' || typeof messages[0].content !== 'string' || !messages[0].content.trim()
    || messages[1].role !== 'user' || !Array.isArray(messages[1].content)) {
    return invalid('A análise visual exige uma instrução e uma mensagem com texto e imagens.');
  }
  const [text, ...images] = messages[1].content;
  if (!onlyFields(text, ['type', 'text']) || text.type !== 'text' || typeof text.text !== 'string' || !text.text.trim()
    || images.length < 1 || images.length > REFERENCE_VISION_MAX_IMAGES
    || images.some(part => !onlyFields(part, ['type', 'image_url']) || part.type !== 'image_url'
      || !onlyFields(part.image_url, ['url']) || typeof part.image_url.url !== 'string')) {
    return invalid('Envie texto e de uma a quatro imagens PNG ou JPEG para a análise visual.');
  }
  if (messages[0].content.length + text.text.length > REFERENCE_VISION_MAX_TEXT_CHARS) {
    return tooLarge('O texto da análise visual é muito longo. Reduza o briefing e tente novamente.');
  }
  const urls = images.map(part => part.image_url.url);
  if (urls.some(url => url.length > REFERENCE_VISION_MAX_IMAGE_CHARS)) {
    return tooLarge('Uma referência é grande demais para a análise visual. Reenvie uma versão menor.');
  }
  if (urls.some(url => !/^data:image\/(?:png|jpeg);base64,/.test(url))) {
    return invalid('A análise visual aceita apenas arquivos PNG ou JPEG anexados, sem links externos.');
  }
  try { parseImageReferences(urls); }
  catch { return invalid('Uma referência não contém uma imagem válida. Reenvie o arquivo.'); }
  return null;
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

  const limited = await consumeRateLimit(req, { limit: 40, windowMs: 60_000, keyPrefix: 'compatible' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec, true);

  const access = await requireActiveSubscription(req, res, { errorShape: 'nested' });
  if (!access) return;

  const { provider, operation = 'chat', apiKey, payload, purpose } = readBody(req);
  const referenceVision = purpose === REFERENCE_VISION_PURPOSE;
  const target = PROVIDERS[provider]?.[operation];
  if (!target || !['chat', 'images'].includes(operation)
    || (referenceVision && (provider !== 'zai' || operation !== 'chat'))) {
    return res.status(400).json({ error: { message: 'Pedido de IA inválido. Recarregue a página e tente novamente.' } });
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
          ? 'A IA incluída no plano não está configurada neste momento. Tente novamente mais tarde ou use sua própria chave em Configurar IA.'
          : 'Falta a chave deste provedor de imagem. Adicione-a em Configurar IA.',
      },
    });
  }
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: { message: 'Pedido de IA incompleto. Recarregue a página e tente novamente.' } });
  }
  if (referenceVision) {
    const problem = referenceVisionProblem(payload);
    if (problem) return res.status(problem.status).json({ error: { code: problem.code, message: problem.message } });
    const requested = Number(payload.max_tokens);
    payload.max_tokens = Number.isFinite(requested) && requested > 0
      ? Math.max(1, Math.min(Math.floor(requested), REFERENCE_VISION_MAX_TOKENS))
      : REFERENCE_VISION_MAX_TOKENS;
    payload.thinking = { type: 'disabled' };
    payload.n = 1;
  }
  // Chave da plataforma: allowlist de modelo, sem stream/tools, tectos de tokens e prompt (auditoria H4).
  if (!userKey) {
    if (!referenceVision && !isPlatformModelAllowed(provider, payload.model)) {
      return res.status(400).json({ error: { message: `O modelo "${String(payload.model || '')}" não está incluído no plano. Escolha outro, ou use a sua própria chave em Configurar IA.` } });
    }
    if (payload.stream || payload.tools || payload.functions || payload.tool_choice) {
      return res.status(400).json({ error: { message: 'Esta opção avançada não está disponível com a IA incluída no plano. Use a sua própria chave em Configurar IA.' } });
    }
    // Sem fan-out de completions (auditoria BE-PAYLOAD-N): força n=1.
    if (payload.n != null && Number(payload.n) !== 1) {
      return res.status(400).json({ error: { message: 'A IA incluída no plano só permite uma conclusão por pedido.' } });
    }
    payload.n = 1;
    if (!referenceVision && messagesChars(payload) > PLATFORM_MAX_PROMPT_CHARS) {
      return res.status(413).json({ error: { message: 'O material colado em Fontes é muito longo. Reduza o texto e tente novamente.' } });
    }
    const requested = Number(payload.max_tokens);
    payload.max_tokens = Number.isFinite(requested) && requested > 0
      ? Math.min(requested, PLATFORM_MAX_TOKENS)
      : Math.min(4096, PLATFORM_MAX_TOKENS);
    // Cota diária por conta do texto incluso (MOO-11), com teto por plano.
    // Sem contador não há teto: falha do banco recusa antes de chamar o
    // provedor, como na imagem e no OCR (auditoria Ingrid 23/11, D-3).
    if (process.env.LIBRARY_SYNC_BACKEND === 'postgres') {
      let quota;
      try {
        quota = await consumeTextCredit({ customerId: access.customerId, limit: textDailyLimit(access.tier) });
      } catch (error) {
        console.error('[compatible] text_quota_unavailable', error?.message || error);
        return res.status(503).json({ error: { message: 'Não foi possível conferir seu limite diário de texto agora. Tente novamente em instantes, ou use sua própria chave em Configurar IA.' } });
      }
      if (!quota.allowed) {
        // `code` próprio (auditoria 23/11, IA-01): o app não pode confundir a
        // cota do dia com sobrecarga do provedor e repetir o pedido.
        return res.status(429).json({ error: { message: `Você atingiu o limite diário de ${quota.limit} pedidos de texto incluídos no plano. Ele volta à meia-noite, ou use sua própria chave em Configurar IA.`, code: 'text_quota_exhausted' } });
      }
    }
  }

  const deadline = Date.now() + (referenceVision ? REFERENCE_VISION_BUDGET_MS : TOTAL_BUDGET_MS);
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
      && !referenceVision
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
          ? 'A IA demorou muito para responder. Tente novamente com menos cards ou menos material colado em Fontes.'
          : 'Falha ao conectar ao provedor de IA.',
        code: timedOut ? 'upstream_timeout' : 'upstream_error',
      },
    });
  }
}
