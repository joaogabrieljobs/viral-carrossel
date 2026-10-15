import { applyCors } from '../lib/cors.js';
import { createAccessToken, setAccessCookie, setCheckoutIdentityCookie, setLoginHintCookie } from '../lib/access.js';
import {
  normalizeEmail,
  isValidEmail,
  getAuthRecordsMatchingPassword,
  passwordAuthConfigured,
} from '../lib/password-auth.js';
import { getStripe, findActiveSubscription } from '../lib/stripe.js';
import { consumeRateLimit, rateLimitResponse } from '../lib/rate-limit.js';
import { accountIdentityBackendEnabled, getAccountByStripeCustomerId } from '../lib/account-identity-postgres.js';

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

  const limited = await consumeRateLimit(req, { limit: 20, windowMs: 60_000, keyPrefix: 'login' });
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
    const matches = await getAuthRecordsMatchingPassword(cleanEmail, password);
    if (!matches.length) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }
    if (matches.length > 1) {
      return res.status(409).json({ error: 'Há mais de uma conta com esta senha. Entre em contato com o suporte para identificar a conta certa.' });
    }
    const record = matches[0];

    const dbIdentity = accountIdentityBackendEnabled();
    let customerId = record.customerId;
    if (dbIdentity) {
      const account = await getAccountByStripeCustomerId(customerId);
      if (!account || account.id !== record.accountId || account.email !== cleanEmail
        || account.identityEpoch !== record.identityEpoch) {
        return res.status(401).json({ error: 'A conta mudou. Entre novamente para continuar.' });
      }
    } else {
      const stripe = getStripe();
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer || customer.deleted || normalizeEmail(customer.email) !== cleanEmail) {
        return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      }
      if (record.identityEpoch !== String(customer.metadata?.vc_identity_epoch || '')) {
        return res.status(401).json({ error: 'A conta mudou. Entre novamente para continuar.' });
      }
      customerId = customer.id;
    }

    const sub = await findActiveSubscription(customerId);
    if (!sub) {
      setCheckoutIdentityCookie(res, {
        email: cleanEmail,
        customerId,
        source: 'verified_login',
        identityEpoch: record.identityEpoch,
      });
      setLoginHintCookie(res, cleanEmail);
      return res.status(402).json({
        error: 'Assinatura inativa. Renove o plano para entrar.',
        needCheckout: true,
        email: cleanEmail,
      });
    }

    const token = createAccessToken({
      customerId,
      email: cleanEmail,
      identityEpoch: record.identityEpoch,
      ...(dbIdentity ? { accountId: record.accountId } : {}),
      ...(dbIdentity ? { iatMs: Math.max(Date.now(), Number(record.sessionRevokedBefore || 0) + 1) } : {}),
    });
    setAccessCookie(res, token);
    return res.status(200).json({
      active: true,
      email: cleanEmail,
      customerId,
      login: 'password',
    });
  } catch (e) {
    console.error('[auth/login]', e?.message || e);
    return res.status(500).json({ error: e.message || 'login_error' });
  }
}
