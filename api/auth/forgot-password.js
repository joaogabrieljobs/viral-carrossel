import { waitUntil } from '@vercel/functions';
import { applyCors } from '../lib/cors.js';
import { isValidEmail, normalizeEmail } from '../lib/password-auth.js';
import { passwordResetConfigured, sendPasswordReset } from '../lib/password-reset.js';
import { consumeRateLimit, rateLimitResponse } from '../lib/rate-limit.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const limited = await consumeRateLimit(req, { limit: 5, windowMs: 15 * 60_000, keyPrefix: 'forgot-password' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch { body = null; }
  const email = normalizeEmail(body?.email);
  if (email.length > 254 || !isValidEmail(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (!passwordResetConfigured()) return res.status(503).json({ error: 'A recuperação por e-mail está temporariamente indisponível. Tente novamente mais tarde.' });
  // Mesma resposta e mesmo tempo para contas existentes e inexistentes.
  // waitUntil mantém o envio vivo na Vercel depois da resposta HTTP.
  waitUntil(sendPasswordReset(email)
    .then(delivery => console.info('[auth/forgot-password]', { delivery }))
    .catch(error => console.error('[auth/forgot-password] delivery_failed', {
      code: /^email_http_\d{3}$/.test(error?.message) ? error.message : 'service_error',
    })));
  return res.status(200).json({ ok: true, message: 'Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha. Confira também o spam. Para pedir outro link, aguarde 3 minutos.' });
}
