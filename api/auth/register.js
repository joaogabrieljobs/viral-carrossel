import { applyCors } from '../lib/cors.js';
import { setCheckoutIdentityCookie, setLoginHintCookie } from '../lib/access.js';
import {
  normalizeEmail,
  isValidEmail,
  isValidPassword,
  getAuthRecord,
  hashPassword,
  passwordAuthConfigured,
} from '../lib/password-auth.js';
import { getStripe } from '../lib/stripe.js';
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
 * Cliente preexistente só pode ser associado após autenticação; o cadastro
 * público cria sempre uma identidade Stripe nova, sem acesso imediato.
 */
export default async function handler(req, res) {
  applyCors(req, res, { credentials: true });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const limited = await consumeRateLimit(req, { limit: 10, windowMs: 60_000, keyPrefix: 'register' });
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
    if (existing) {
      return res.status(409).json({
        error: 'Este e-mail já tem conta. Entre com Google ou sua senha para continuar.',
        requireLogin: true,
      });
    }

    const { salt, hash } = hashPassword(password);
    const customer = await getStripe().customers.create({
      email: cleanEmail,
      metadata: {
        product: 'viral-carrossel',
        vc_pw_salt: salt,
        vc_pw_hash: hash,
      },
    });
    setCheckoutIdentityCookie(res, {
      email: cleanEmail,
      customerId: customer.id,
      source: 'new_registration',
    });
    setLoginHintCookie(res, cleanEmail);

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
