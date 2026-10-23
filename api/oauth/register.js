import { registerOAuthClient } from '../lib/oauth-store.js';
import { consumeRateLimit, rateLimitResponse } from '../lib/rate-limit.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'invalid_request' });
  const limited = await consumeRateLimit(req, { limit: 15, windowMs: 60_000, keyPrefix: 'oauth-register' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);
  try { return res.status(201).json(await registerOAuthClient(req.body)); }
  catch (cause) { return res.status(cause.status || 500).json({ error: cause.code || 'server_error', error_description: cause.message }); }
}
