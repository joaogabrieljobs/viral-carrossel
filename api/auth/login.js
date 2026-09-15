import { applyCors } from '../lib/cors.js';
import { createAccessToken, setAccessCookie } from '../lib/access.js';
import {
  normalizeEmail,
  isValidEmail,
  getAuthRecord,
  verifyPassword,
  passwordAuthConfigured,
} from '../lib/password-auth.js';
import { getStripe, findActiveSubscription } from '../lib/stripe.js';
import { consumeRateLimit, rateLimitResponse } from '../lib/rate-limit.js';

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

/**
 * POST /api/auth/login — e-mail + senha → cookie se assinatura ativa.
 */
export default async function handler(req, res) {
  applyCors(req, res, { credentials: true });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const limited = consumeRateLimit(req, { limit: 20, windowMs: 60_000, keyPrefix: 'login' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  if (!passwordAuthConfigured()) {
    return res.status(503).json({ error: 'Login por e-mail indisponível.' });
  }

  const { email, password } = readBody(req);
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail) || !String(password || '')) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  try {
    const record = await getAuthRecord(cleanEmail);
    if (!record?.hash || !verifyPassword(password, record)) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(record.customerId);
    if (!customer || customer.deleted) {
      return res.status(402).json({
        error: 'Conta sem assinatura. Assine para entrar no studio.',
        needCheckout: true,
        email: cleanEmail,
      });
    }

    const sub = await findActiveSubscription(customer.id);
    if (!sub) {
      return res.status(402).json({
        error: 'Assinatura inativa. Renove o plano para entrar.',
        needCheckout: true,
        email: cleanEmail,
      });
    }

    const token = createAccessToken({ customerId: customer.id, email: cleanEmail });
    setAccessCookie(res, token);
    return res.status(200).json({
      active: true,
      email: cleanEmail,
      customerId: customer.id,
      login: 'password',
    });
  } catch (e) {
    console.error('[auth/login]', e?.message || e);
    return res.status(500).json({ error: e.message || 'login_error' });
  }
}
