/**
 * Proxy Anthropic — exige assinatura ativa (ou BILLING_DISABLED em non-prod)
 * E chave do próprio utilizador no header `x-anthropic-key`.
 *
 * NÃO existe fallback para `ANTHROPIC_API_KEY` do host (removido em 2026-09-15):
 * com ele, qualquer assinante — incluindo o Essencial de R$ 19,90 — podia gastar
 * Opus e `web_search` na conta da plataforma, sem quota nem tecto por plano.
 * O único caminho que usa chave de env é o proxy de dev do Vite (`vite.config.js`).
 */

import { applyCors } from '../../lib/cors.js';
import { requireActiveSubscription } from '../../lib/require-access.js';
import { consumeRateLimit, rateLimitResponse } from '../../lib/rate-limit.js';

const TARGET = 'https://api.anthropic.com/v1/messages';

/** Mesmo orçamento do proxy compatible: gerar um carrossel passa do default da
 *  plataforma (segundos), e sem `maxDuration` a função era morta a meio. */
export const config = { maxDuration: 300 };
const UPSTREAM_TIMEOUT_MS = 240_000;

export default async function handler(req, res) {
  applyCors(req, res, {
    credentials: true,
    headers: 'Content-Type, anthropic-version, x-api-key, x-anthropic-key, Anthropic-Version',
  });

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }

  const limited = consumeRateLimit(req, { limit: 40, windowMs: 60_000, keyPrefix: 'anthropic' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec, true);

  const access = await requireActiveSubscription(req, res, { errorShape: 'nested' });
  if (!access) return;

  const key = String(
    req.headers['x-anthropic-key'] || req.headers['X-Anthropic-Key'] || '',
  ).trim();

  if (!key) {
    return res.status(400).json({
      error: {
        message:
          'O Claude precisa da sua própria chave. Adicione-a em Configurar IA — ou use o texto já incluído no seu plano.',
        code: 'anthropic_key_required',
      },
    });
  }

  try {
    const anthropicVersion =
      req.headers['anthropic-version'] ||
      req.headers['Anthropic-Version'] ||
      '2023-06-01';

    const body =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});

    const upstream = await fetch(TARGET, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': anthropicVersion,
      },
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const text = await upstream.text();
    const ct = upstream.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', ct);
    return res.status(upstream.status).send(text);
  } catch (e) {
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return res.status(timedOut ? 504 : 502).json({
      error: {
        message: timedOut
          ? 'A IA demorou demasiado a responder. Tente de novo, com menos cards ou menos material colado em Fontes.'
          : (e?.message || 'Erro no proxy Anthropic'),
        code: timedOut ? 'upstream_timeout' : 'upstream_error',
      },
    });
  }
}
