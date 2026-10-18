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

/**
 * URL canónica da app (checkout success/cancel, OAuth redirect, portal).
 * Nunca confiar em Host / X-Forwarded-Host — open redirect (WEB-001/006).
 * Produção: APP_URL obrigatória. Preview Vercel: VERCEL_URL. Dev: localhost.
 */
export function getAppUrl(_req) {
  const fromEnv = cleanEnv(process.env.APP_URL || process.env.VITE_APP_URL || '')
    .replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  const vercelUrl = String(process.env.VERCEL_URL || '').trim().replace(/\/$/, '');
  if (vercelUrl) return `https://${vercelUrl}`;

  const vercelEnv = process.env.VERCEL_ENV || '';
  const isProd = vercelEnv === 'production'
    || (!vercelEnv && process.env.NODE_ENV === 'production');
  if (isProd) {
    throw new Error('APP_URL não configurada em produção');
  }

  return 'http://localhost:5173';
}

/**
 * Durante a migração, o Checkout iniciado no domínio antigo precisa voltar ao
 * mesmo host para que o cookie HttpOnly de confirmação esteja disponível.
 * A escolha é feita somente entre hosts próprios conhecidos, nunca a partir
 * de um Host arbitrário fornecido pelo pedido.
 */
const BILLING_RETURN_HOSTS = new Set([
  'moont.ai',
  'www.moont.ai',
  'moont.com.br',
  'www.moont.com.br',
  'viralcarrossel.com.br',
  'www.viralcarrossel.com.br',
]);

export function getBillingReturnUrl(req) {
  const host = String(req?.headers?.host || '').trim().toLowerCase().replace(/:443$/, '');
  if (BILLING_RETURN_HOSTS.has(host)) return `https://${host}`;
  return getAppUrl();
}

export function getPriceId() {
  const id = cleanEnv(process.env.STRIPE_PRICE_ID)
    || cleanEnv(process.env.STRIPE_PRICE_ID_CREATOR);
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
