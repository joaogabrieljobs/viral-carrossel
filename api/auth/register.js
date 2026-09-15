import { applyCors } from '../lib/cors.js';
import { createAccessToken, setAccessCookie } from '../lib/access.js';
import {
  normalizeEmail,
  isValidEmail,
  isValidPassword,
  getAuthRecord,
  upsertPassword,
  passwordAuthConfigured,
} from '../lib/password-auth.js';
import { findActiveSubscription } from '../lib/stripe.js';
import { consumeRateLimit, rateLimitResponse } from '../lib/rate-limit.js';

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

/**
 * POST /api/auth/register — cria conta e-mail+senha.
 * Se já tiver assinatura Stripe ativa → cookie. Senão → needCheckout.
 */
export default async function handler(req, res) {
  applyCors(req, res, { credentials: true });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const limited = consumeRateLimit(req, { limit: 10, windowMs: 60_000, keyPrefix: 'register' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  if (!passwordAuthConfigured()) {
    return res.status(503).json({ error: 'Criar conta indisponível.' });
  }

  const { email, password } = readBody(req);
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres.' });
  }

  try {
    const existing = await getAuthRecord(cleanEmail);
    if (existing?.hash) {
      return res.status(409).json({ error: 'Já existe conta com este e-mail. Entre com a senha.' });
    }

    const saved = await upsertPassword(cleanEmail, password, {
      customerId: existing?.customerId || null,
      overwrite: false,
    });

    const customerId = saved.customerId;
    let active = false;
    if (customerId) {
      try {
        const sub = await findActiveSubscription(customerId);
        active = !!sub;
      } catch (e) {
        console.warn('[auth/register] sub lookup', e?.message || e);
      }
    }

    if (active && customerId) {
      const token = createAccessToken({ customerId, email: cleanEmail });
      setAccessCookie(res, token);
      return res.status(200).json({
        active: true,
        email: cleanEmail,
        customerId,
        login: 'password',
      });
    }

    return res.status(200).json({
      active: false,
      needCheckout: true,
      email: cleanEmail,
      message: 'Conta criada. Escolha um plano para entrar no studio.',
    });
  } catch (e) {
    console.error('[auth/register]', e?.message || e);
    return res.status(500).json({ error: e.message || 'register_error' });
  }
}
