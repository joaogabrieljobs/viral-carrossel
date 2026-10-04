import { assertPublicHttpUrl, serverFetchUrlPlainText } from '../urlSourceFetch.js';
import { applyCors } from './lib/cors.js';
import { requireActiveSubscription } from './lib/require-access.js';
import { consumeRateLimit, rateLimitResponse } from './lib/rate-limit.js';

export default async function handler(req, res) {
  applyCors(req, res, { credentials: true });

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Use GET ou POST' });
  }

  const limited = consumeRateLimit(req, { limit: 20, windowMs: 60_000, keyPrefix: 'fetch-source' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  const access = await requireActiveSubscription(req, res, { asJson: true });
  if (!access) return;

  try {
    const body = typeof req.body === 'string' ? (() => {
      try { return JSON.parse(req.body); } catch { return {}; }
    })() : (req.body || {});
    const rawUrl = req.method === 'POST'
      ? body.url || ''
      : req.query?.url || req.query?.u || '';
    assertPublicHttpUrl(rawUrl);
    const text = await serverFetchUrlPlainText(rawUrl);
    return res.status(200).json({ ok: true, text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    let hostname = 'invalid';
    try { hostname = new URL(String(req.body?.url || req.query?.url || '')).hostname; } catch { /* sem URL válida */ }
    console.warn('[fetch-source] leitura bloqueada', hostname, msg.slice(0, 160));
    return res.status(400).json({ ok: false, error: msg });
  }
}
