/**
 * Gate de assinatura para endpoints caros (proxies IA, fetch-source).
 * Cookie HMAC válido + assinatura Stripe ativa (exceto BILLING_DISABLED em non-prod).
 */
import { readAccessCookie, billingDisabled } from './access.js';
import { findActiveSubscription } from './stripe.js';

/**
 * @returns {Promise<null | { customerId?: string, email?: string, billingDisabled?: boolean }>}
 *   null se já respondeu 401/402.
 */
export async function requireActiveSubscription(req, res, opts = {}) {
  const asJson = opts.asJson !== false;
  const fail = (status, message) => {
    if (asJson) {
      return res.status(status).json(
        opts.errorShape === 'nested'
          ? { error: { message } }
          : { error: message },
      );
    }
    return res.status(status).json({ error: message });
  };

  if (billingDisabled()) {
    return { billingDisabled: true };
  }

  const access = readAccessCookie(req);
  if (!access?.customerId) {
    fail(
      401,
      'Faça login pela assinatura para usar este recurso.',
    );
    return null;
  }

  try {
    const sub = await findActiveSubscription(access.customerId);
    if (!sub) {
      fail(402, 'Assinatura inativa. Renove o plano para continuar.');
      return null;
    }
  } catch (e) {
    console.error('[requireActiveSubscription]', e?.message || e);
    fail(503, 'Não foi possível verificar a assinatura. Tente de novo.');
    return null;
  }

  return access;
}
