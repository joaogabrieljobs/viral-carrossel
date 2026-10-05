import { waitUntil } from '@vercel/functions';
import { applyCors } from '../lib/cors.js';
import { clearAccessCookie } from '../lib/access.js';
import { isValidPassword } from '../lib/password-auth.js';
import { resetPassword, sendPasswordChanged } from '../lib/password-reset.js';
import { consumeRateLimit, rateLimitResponse } from '../lib/rate-limit.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const limited = await consumeRateLimit(req, { limit: 10, windowMs: 15 * 60_000, keyPrefix: 'reset-password' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch { body = null; }
  if (typeof body?.password !== 'string' || !isValidPassword(body.password)) return res.status(400).json({ error: 'A senha deve ter entre 8 e 128 caracteres.' });
  if (body.password !== body.confirmPassword) return res.status(400).json({ error: 'As senhas não coincidem.' });
  try {
    const result = await resetPassword(body.token, body.password);
    clearAccessCookie(res);
    waitUntil(sendPasswordChanged(result).catch(() => console.error('[auth/reset-password] notification_failed')));
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error.code === 'invalid_reset_link') return res.status(400).json({ error: error.message, code: error.code });
    console.error('[auth/reset-password] reset_failed');
    return res.status(503).json({ error: 'Não foi possível alterar a senha agora. Tente novamente.' });
  }
}
