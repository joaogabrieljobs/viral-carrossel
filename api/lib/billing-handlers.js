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

// Allowlist estrita: endpoints de billing carregam cookie de acesso, então
// nunca refletir Origin arbitrário com Allow-Credentials (CSRF/credential leak).
function allowedOrigins() {
  return new Set(
    [
      (process.env.APP_URL || process.env.VITE_APP_URL || '').replace(/\/$/, ''),
      'http://localhost:5173',
      'http://localhost:4173',
    ].filter(Boolean),
  );
}

function cors(req, res) {
  const origin = req.headers?.origin;
  if (origin && allowedOrigins().has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
        customerId: access.customerId,
        status: 'inactive',
      });
    }

    return res.status(200).json({
      active: true,
      email: access.email,
      customerId: access.customerId,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
    });
  } catch (e) {
    console.error('[auth/session]', e);
    return res.status(500).json({ active: false, error: e.message || 'session_error' });
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

  try {
    const { email } = readJson(req);
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Informe um e-mail válido' });
    }

    const stripe = getStripe();
    const priceId = getPriceId();
    const appUrl = getAppUrl(req);

    const existing = await stripe.customers.list({ email: cleanEmail, limit: 1 });
    const customer = existing.data[0]
      || await stripe.customers.create({
        email: cleanEmail,
        metadata: { product: 'viral-carrossel' },
      });

    const active = await findActiveSubscription(customer.id);
    if (active) {
      const token = createAccessToken({ customerId: customer.id, email: cleanEmail });
      setAccessCookie(res, token);
      return res.status(200).json({
        alreadyActive: true,
        url: `${appUrl}/?billing=restored`,
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
        metadata: { product: 'viral-carrossel' },
      },
      metadata: { product: 'viral-carrossel', email: cleanEmail },
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
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
      customerId,
    });
  } catch (e) {
    console.error('[stripe/confirm]', e);
    return res.status(500).json({ error: e.message || 'confirm_error' });
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
