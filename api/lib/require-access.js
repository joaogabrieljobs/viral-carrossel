/**
 * Gate de assinatura para endpoints caros (proxies IA, fetch-source).
 * Cookie HMAC válido + assinatura Stripe ativa (exceto BILLING_DISABLED em non-prod).
 */
import { readAccessCookie, readCurrentAccessCookie, billingDisabled } from './access.js';
import { findActiveSubscription } from './stripe.js';

// Uploads de carrossel fazem várias chamadas OCR em sequência. Um cache curto
// evita repetir duas consultas Stripe por imagem sem prolongar acesso revogado
// por mais do que alguns segundos.
const activeAccessCache = new Map();
const ACTIVE_ACCESS_CACHE_MS = 15_000;

function cachedAccessKey(req) {
  try {
    const token = readAccessCookie(req);
    return token?.customerId
      ? `${token.customerId}:${token.iatMs || token.iat || 0}`
      : '';
  } catch { return ''; }
}

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

  const cacheKey = cachedAccessKey(req);
  const cached = cacheKey ? activeAccessCache.get(cacheKey) : null;
  if (cached && cached.expiresAt > Date.now()) return cached.access;

  let access;
  try { access = await readCurrentAccessCookie(req); }
  catch {
    fail(503, 'Não foi possível verificar sua sessão. Tente novamente.');
    return null;
  }
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

  if (cacheKey) {
    activeAccessCache.set(cacheKey, { access, expiresAt: Date.now() + ACTIVE_ACCESS_CACHE_MS });
    if (activeAccessCache.size > 1000) {
      const now = Date.now();
      for (const [key, item] of activeAccessCache) {
        if (item.expiresAt <= now) activeAccessCache.delete(key);
      }
    }
  }

  return access;
}

export function resetActiveAccessCacheForTests() {
  activeAccessCache.clear();
}
