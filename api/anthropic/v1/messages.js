/**
 * Proxy Anthropic — exige assinatura ativa (ou BILLING_DISABLED em non-prod).
 * BYOK via x-anthropic-key; sem key própria, usa ANTHROPIC_API_KEY do host.
 */

import { applyCors } from '../../lib/cors.js';
import { requireActiveSubscription } from '../../lib/require-access.js';
import { consumeRateLimit, rateLimitResponse } from '../../lib/rate-limit.js';

const TARGET = 'https://api.anthropic.com/v1/messages';

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

  const userKey = String(
    req.headers['x-anthropic-key'] || req.headers['X-Anthropic-Key'] || '',
  ).trim();
  const envKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  const key = userKey || envKey;

  if (!key) {
    return res.status(503).json({
      error: {
        message:
          'Chave Anthropic não configurada. Adicione sua chave no ícone de chaves (⚙) no header do app, ou defina ANTHROPIC_API_KEY nas Environment Variables da Vercel.',
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
    });

    const text = await upstream.text();
    const ct = upstream.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', ct);
    return res.status(upstream.status).send(text);
  } catch (e) {
    return res.status(502).json({
      error: { message: e?.message || 'Erro no proxy Anthropic' },
    });
  }
}
