import {
  getStripe,
  getAppUrl,
  getPriceId,
  findActiveSubscription,
  isSubscriptionActive,
} from '../lib/stripe.js';
import {
  createAccessToken,
  setAccessCookie,
  readAccessCookie,
  clearAccessCookie,
  billingDisabled,
} from '../lib/access.js';
import {
  PLAN_ORDER,
  getPlan,
  getStripePriceIdForTier,
  resolveTierFromSubscription,
  imageQuotaForTier,
  periodBoundsFromSubscription,
} from './plans.js';
import { getQuotaUsage } from './image-quota.js';

import { applyCors } from './cors.js';

function cors(req, res) {
  applyCors(req, res, { credentials: true });
}

function readJson(req) {
  if (req.body == null) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return req.body;
}

/** GET /api/auth/session — estado da assinatura do cookie atual */
export async function handleSession(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (billingDisabled()) {
    return res.status(200).json({
      active: true,
      billingDisabled: true,
      email: null,
      status: 'disabled',
      tier: 'max',
      plan: getPlan('max'),
      imageQuota: {
        used: 0,
        limit: imageQuotaForTier('max'),
        remaining: imageQuotaForTier('max'),
        tier: 'max',
      },
    });
  }

  try {
    const access = readAccessCookie(req);
    if (!access?.customerId) {
      return res.status(200).json({ active: false, email: null, status: 'anonymous' });
    }

    const sub = await findActiveSubscription(access.customerId);
    if (!sub) {
      return res.status(200).json({
        active: false,
        email: access.email,
        status: 'inactive',
      });
    }

    const tier = resolveTierFromSubscription(sub);
    const bounds = periodBoundsFromSubscription(sub);
    const limit = imageQuotaForTier(tier);
    let imageQuota = {
      used: 0,
      limit,
      remaining: limit,
      tier,
    };
    try {
      imageQuota = {
        ...await getQuotaUsage({
          customerId: access.customerId,
          periodStartSec: bounds.periodStartSec,
          limit,
        }),
        tier,
      };
    } catch (qe) {
      console.warn('[auth/session] quota', qe?.message || qe);
    }

    return res.status(200).json({
      active: true,
      email: access.email,
      status: sub.status,
      currentPeriodEnd: bounds.periodEnd,
      currentPeriodStart: bounds.periodStart,
      tier,
      plan: getPlan(tier),
      imageQuota,
    });
  } catch (e) {
    console.error('[auth/session]', e?.message || e);
    return res.status(500).json({ active: false, error: 'session_error' });
  }
}

/** POST /api/stripe/checkout — cria Checkout Session de assinatura */
export async function handleCheckout(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (billingDisabled()) {
    return res.status(400).json({ error: 'Billing desativado neste ambiente' });
  }

  const { consumeRateLimit, rateLimitResponse } = await import('./rate-limit.js');
  const limited = consumeRateLimit(req, { limit: 8, windowMs: 60_000, keyPrefix: 'checkout' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  try {
    const { email, tier: rawTier } = readJson(req);
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Informe um e-mail válido' });
    }

    const tier = PLAN_ORDER.includes(rawTier) ? rawTier : 'creator';
    const stripe = getStripe();
    const priceId = getStripePriceIdForTier(tier) || getPriceId();
    if (!priceId) {
      return res.status(500).json({ error: `Price Stripe não configurado para o plano ${tier}` });
    }
    const appUrl = getAppUrl(req);

    const existing = await stripe.customers.list({ email: cleanEmail, limit: 1 });
    const customer = existing.data[0]
      || await stripe.customers.create({
        email: cleanEmail,
        metadata: { product: 'viral-carrossel' },
      });

    const active = await findActiveSubscription(customer.id);
    if (active) {
      // NÃO emitir cookie só com e-mail — isso permitia entrar sem prova de identidade.
      // Login de assinante = Google OAuth (ou retorno do Stripe Checkout após pagar).
      return res.status(200).json({
        alreadyActive: true,
        requireLogin: true,
        message: 'Este e-mail já tem assinatura ativa. Entre com Google para aceder ao studio.',
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      client_reference_id: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?billing=cancel`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      subscription_data: {
        metadata: {
          product: 'viral-carrossel',
          tier,
          image_quota: String(imageQuotaForTier(tier)),
        },
      },
      metadata: {
        product: 'viral-carrossel',
        email: cleanEmail,
        tier,
      },
    });

    return res.status(200).json({ url: session.url, sessionId: session.id, tier });
  } catch (e) {
    console.error('[stripe/checkout]', e);
    return res.status(500).json({ error: e.message || 'checkout_error' });
  }
}

/** POST /api/stripe/confirm — troca session_id do Checkout por cookie de acesso */
export async function handleConfirm(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { sessionId } = readJson(req);
    if (!sessionId) return res.status(400).json({ error: 'sessionId obrigatório' });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(String(sessionId), {
      expand: ['subscription', 'customer'],
    });

    if (session.mode !== 'subscription') {
      return res.status(400).json({ error: 'Sessão inválida' });
    }

    const paid = session.payment_status === 'paid'
      || session.status === 'complete';
    if (!paid) {
      return res.status(402).json({ error: 'Pagamento ainda não confirmado' });
    }

    const customerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;
    const email = session.customer_details?.email
      || session.customer_email
      || (typeof session.customer === 'object' ? session.customer?.email : null)
      || session.metadata?.email;

    if (!customerId || !email) {
      return res.status(400).json({ error: 'Cliente Stripe incompleto' });
    }

    const sub = typeof session.subscription === 'object'
      ? session.subscription
      : await findActiveSubscription(customerId);

    if (!isSubscriptionActive(sub) && !(await findActiveSubscription(customerId))) {
      return res.status(402).json({ error: 'Assinatura inativa' });
    }

    const token = createAccessToken({ customerId, email });
    setAccessCookie(res, token);

    return res.status(200).json({
      active: true,
      email,
    });
  } catch (e) {
    console.error('[stripe/confirm]', e?.message || e);
    return res.status(500).json({ error: 'confirm_error' });
  }
}

/** POST /api/stripe/portal — Customer Portal Stripe */
export async function handlePortal(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const access = readAccessCookie(req);
    if (!access?.customerId) {
      return res.status(401).json({ error: 'Faça login pela assinatura primeiro' });
    }

    const stripe = getStripe();
    const appUrl = getAppUrl(req);
    const portal = await stripe.billingPortal.sessions.create({
      customer: access.customerId,
      return_url: `${appUrl}/?app=1`,
    });

    return res.status(200).json({ url: portal.url });
  } catch (e) {
    console.error('[stripe/portal]', e);
    return res.status(500).json({ error: e.message || 'portal_error' });
  }
}

/** POST /api/auth/logout — limpa cookie */
export async function handleLogout(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  clearAccessCookie(res);
  return res.status(200).json({ ok: true });
}
