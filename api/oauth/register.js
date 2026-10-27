import { registerOAuthClient } from '../lib/oauth-store.js';
import { consumeRateLimit, rateLimitResponse } from '../lib/rate-limit.js';

function registrationBody(req) {
  let value = req.body;
  if (Buffer.isBuffer(value)) value = value.toString('utf8');
  if (typeof value !== 'string') return value || {};
  try { return JSON.parse(value); }
  catch {
    const parsed = Object.fromEntries(new URLSearchParams(value));
    if (typeof parsed.redirect_uris === 'string') {
      try { parsed.redirect_uris = JSON.parse(parsed.redirect_uris); }
      catch { parsed.redirect_uris = parsed.redirect_uris.split(/\s+/).filter(Boolean); }
    }
    return parsed;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'invalid_request' });
  const limited = await consumeRateLimit(req, { limit: 15, windowMs: 60_000, keyPrefix: 'oauth-register' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);
  const input = registrationBody(req);
  try { return res.status(201).json(await registerOAuthClient(input)); }
  catch (cause) {
    console.warn('[oauth-register] registro recusado', {
      code: cause.code || 'server_error',
      contentType: req.headers?.['content-type'] || '',
      bodyType: Array.isArray(input) ? 'array' : typeof input,
      fields: input && typeof input === 'object' ? Object.keys(input).slice(0, 20) : [],
      redirectCount: Array.isArray(input?.redirect_uris) ? input.redirect_uris.length : null,
    });
    return res.status(cause.status || 500).json({ error: cause.code || 'server_error', error_description: cause.message });
  }
}
