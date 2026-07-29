import Stripe from 'stripe';

let _stripe;

function cleanEnv(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, '');
}

export function getStripe() {
  const key = cleanEnv(process.env.STRIPE_SECRET_KEY);
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY não configurada');
  }
  if (!_stripe) {
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export function getAppUrl(req) {
  const fromEnv = (process.env.APP_URL || process.env.VITE_APP_URL || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const proto = req?.headers?.['x-forwarded-proto'] || 'https';
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  if (host) return `${proto}://${host}`;
  return 'http://localhost:5173';
}

export function getPriceId() {
  const id = cleanEnv(process.env.STRIPE_PRICE_ID);
  if (!id) throw new Error('STRIPE_PRICE_ID não configurada');
  return id;
}

/** Assinatura considerada válida para acesso ao studio. */
export function isSubscriptionActive(sub) {
  if (!sub) return false;
  return sub.status === 'active' || sub.status === 'trialing';
}

export async function findActiveSubscription(customerId) {
  const stripe = getStripe();
  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  });
  return list.data.find(isSubscriptionActive) || null;
}
