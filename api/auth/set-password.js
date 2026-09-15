import { applyCors } from '../lib/cors.js';
import {
  normalizeEmail,
  isValidEmail,
  isValidPassword,
  generatePassword,
  upsertPassword,
  passwordAuthConfigured,
} from '../lib/password-auth.js';
import { getStripe, findActiveSubscription } from '../lib/stripe.js';

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

/**
 * POST /api/auth/set-password
 * Bootstrap: header x-bootstrap-secret === BOOTSTRAP_SECRET
 * Define/reset senha para e-mail com assinatura ativa (ou força com force:true).
 * Devolve a senha em plain uma vez (não fica logada).
 */
export default async function handler(req, res) {
  applyCors(req, res, { credentials: true });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = String(process.env.BOOTSTRAP_SECRET || '').trim();
  const given = String(req.headers['x-bootstrap-secret'] || '').trim();
  if (!secret || !given || given !== secret) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  if (!passwordAuthConfigured()) {
    return res.status(503).json({ error: 'Upstash não configurado' });
  }

  const { email, password: givenPassword, force = false } = readBody(req);
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: 'E-mail inválido' });
  }

  try {
    const stripe = getStripe();
    const list = await stripe.customers.list({ email: cleanEmail, limit: 5 });
    const customer = list.data.find((c) => !c.deleted) || list.data[0];
    if (!customer && !force) {
      return res.status(404).json({ error: 'Cliente Stripe não encontrado' });
    }
    if (customer) {
      const sub = await findActiveSubscription(customer.id);
      if (!sub && !force) {
        return res.status(402).json({ error: 'Assinatura inativa' });
      }
    }

    const password = givenPassword && isValidPassword(givenPassword)
      ? String(givenPassword)
      : generatePassword(14);

    await upsertPassword(cleanEmail, password, {
      customerId: customer?.id || null,
      overwrite: true,
    });

    return res.status(200).json({
      ok: true,
      email: cleanEmail,
      customerId: customer?.id || null,
      password,
    });
  } catch (e) {
    console.error('[auth/set-password]', e?.message || e);
    return res.status(500).json({ error: e.message || 'set_password_error' });
  }
}
