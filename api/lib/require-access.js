/**
 * Gate de acesso para endpoints caros (proxies IA, fetch-source).
 * Cookie HMAC válido + assinatura ativa ou isenção privada da conta.
 */
import { readAccessCookie, readCurrentAccessCookie, billingDisabled } from './access.js';
import { accountEntitlementsEnabled, resolveAccountEntitlement } from './account-entitlements.js';

// Uploads de carrossel fazem várias chamadas OCR em sequência. Um cache curto
// evita repetir duas consultas Stripe por imagem — TTL baixo para não prolongar
// acesso após cancelamento (auditoria BE-003).
const activeAccessCache = new Map();
const ACTIVE_ACCESS_CACHE_MS = 2_000;

function cacheAllowed() {
  // Revogações de identidade precisam valer na próxima requisição em produção.
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV !== 'production';
  return process.env.NODE_ENV !== 'production';
}

function cachedAccessKey(req) {
  try {
    const token = readAccessCookie(req);
    return token?.customerId
      ? `${token.customerId}:${token.iatMs || token.iat || 0}`
      : '';
  } catch { return ''; }
}

/** Remove entradas de um cliente (logout, cancelamento, sessão inactiva). */
export function invalidateActiveAccessForCustomer(customerId) {
  if (!customerId) return;
  const prefix = `${customerId}:`;
  for (const key of activeAccessCache.keys()) {
    if (key.startsWith(prefix)) activeAccessCache.delete(key);
  }
}

/**
 * @returns {Promise<null | { customerId?: string, email?: string, tier?: string, billingDisabled?: boolean }>}
 *   null se já respondeu 401/402.
 */
export async function requireActiveSubscription(req, res, opts = {}) {
  const asJson = opts.asJson !== false;
  const fail = (status, message) => {
    // Marca do portão do Moont (auditoria 23/11, IA-07). Os proxies de IA
    // repassam o status do provedor como veio; sem a marca, o app lia o 401 de
    // uma chave recusada pelo provedor como sessão expirada. O formato simples
    // do corpo não muda (clientes já abertos continuam lendo `error`).
    const code = status === 401 ? 'session_required' : status === 402 ? 'subscription_inactive' : '';
    if (code) res.setHeader?.('X-Moont-Gate', status === 401 ? 'session' : 'subscription');
    if (asJson) {
      return res.status(status).json(
        opts.errorShape === 'nested'
          ? { error: { message, ...(code ? { code } : {}) } }
          : { error: message },
      );
    }
    return res.status(status).json({ error: message });
  };

  if (billingDisabled()) {
    return { billingDisabled: true };
  }

  const cacheKey = !accountEntitlementsEnabled() && cacheAllowed() ? cachedAccessKey(req) : '';
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
    const entitlement = await resolveAccountEntitlement(access.customerId);
    if (!entitlement.active) {
      invalidateActiveAccessForCustomer(access.customerId);
      fail(402, 'Assinatura inativa. Renove o plano para continuar.');
      return null;
    }
    // Plano vigente para tetos por plano (texto incluso). Sem plano, quem usa
    // o valor deve tratar como o menor.
    access = { ...access, tier: entitlement.tier };
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
