/**
 * Client helpers — assinatura Stripe / acesso ao studio.
 */
import { trackEvent } from '../utils/telemetry.js';
import { erroDoServidor } from './auth-error-message.js';

const PENDING_CHECKOUT_KEY = 'vc_pending_checkout';
export const ACCESS_SESSION_TIMEOUT_MS = 10_000;

export function isAccessSessionUnavailable(session) {
  return ['offline', 'error', 'timeout'].includes(String(session?.status || ''));
}

export function readPendingCheckoutSessionId() {
  try { return sessionStorage.getItem(PENDING_CHECKOUT_KEY) || ''; }
  catch { return ''; }
}

export function clearPendingCheckoutSessionId() {
  try { sessionStorage.removeItem(PENDING_CHECKOUT_KEY); } catch { /* armazenamento indisponível */ }
}

export async function fetchAccessSession({
  timeoutMs = ACCESS_SESSION_TIMEOUT_MS,
  allowDevFallback = import.meta.env.DEV,
  signal,
} = {}) {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener?.('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort('access_session_timeout'), timeoutMs);
  try {
    const r = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    });
    if (!r.ok) {
      // Uma sessão realmente ausente continua sendo estado inativo. Apenas
      // falhas temporárias preservam a conta local e pedem nova tentativa.
      if (r.status === 401 || r.status === 403) {
        return { active: false, status: 'inactive' };
      }
      if (allowDevFallback) {
        return { active: true, billingDisabled: true, devFallback: true };
      }
      return {
        active: false,
        status: 'error',
        verificationUnavailable: true,
        error: 'Não foi possível verificar sua conta. Tente novamente.',
      };
    }
    const data = await r.json().catch(() => null);
    if (!data || typeof data !== 'object') {
      if (allowDevFallback) return { active: true, billingDisabled: true, devFallback: true };
      return {
        active: false,
        status: 'error',
        verificationUnavailable: true,
        error: 'Não foi possível verificar sua conta. Tente novamente.',
      };
    }
    return data;
  } catch {
    if (allowDevFallback) {
      return { active: true, billingDisabled: true, devFallback: true };
    }
    const timedOut = controller.signal.aborted && !signal?.aborted;
    return {
      active: false,
      status: timedOut ? 'timeout' : 'offline',
      verificationUnavailable: true,
      error: timedOut
        ? 'A verificação da conta demorou mais que o esperado. Tente novamente.'
        : 'Não foi possível verificar sua conta. Confira a conexão e tente novamente.',
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener?.('abort', abortFromCaller);
  }
}

export async function startCheckout(email, { tier = 'creator' } = {}) {
  const r = await fetch('/api/stripe/checkout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, tier }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Não foi possível iniciar o checkout');
  trackEvent('begin_checkout');
  // sessionStorage pertence à aba: o retorno do Stripe não expõe o id na URL
  // e outro checkout aberto ao lado não troca a sessão desta compra.
  if (data.url && data.sessionId) {
    try { sessionStorage.setItem(PENDING_CHECKOUT_KEY, data.sessionId); } catch { /* cookie assinado ainda permite uma aba */ }
  }
  return data;
}

/**
 * UX-03: voltou do pagamento, a confirmação falhou e não há assinatura ativa.
 * É a condição do aviso "Não pague de novo", que precisa aparecer também na
 * tela de planos (quem assinou sem conta não chega ao editor).
 */
export function billingReturnUnconfirmed({ billing, confirmFailed, sessionActive } = {}) {
  return billing === 'success' && confirmFailed === true && sessionActive !== true;
}

export async function confirmCheckoutSession(sessionId) {
  const pendingId = sessionId || readPendingCheckoutSessionId();
  const r = await fetch('/api/stripe/confirm', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pendingId ? { sessionId: pendingId } : {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || 'Não foi possível confirmar a assinatura'), { status: r.status });
  clearPendingCheckoutSessionId();
  return data;
}

/**
 * Confirmação com nova tentativa em falha passageira (rede, 5xx, 429), até 3
 * vezes (MOO-15). Recusa definitiva (402 pendente, 403, 409) não repete.
 */
export async function confirmCheckoutSessionWithRetry(sessionId, {
  attempts = 3, delays = [1500, 3000], sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await confirmCheckoutSession(sessionId);
    } catch (error) {
      const transient = !Number.isInteger(error?.status) || error.status >= 500 || error.status === 429;
      if (!transient || attempt >= attempts) throw error;
      await sleep(delays[attempt - 1] ?? delays.at(-1));
    }
  }
}

export async function openBillingPortal() {
  const r = await fetch('/api/stripe/portal', {
    method: 'POST',
    credentials: 'include',
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Não foi possível abrir o portal');
  return data;
}

export async function logoutAccess({ signal } = {}) {
  const r = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    signal,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok !== true || data.localCookieCleared === false) {
    throw new Error(data.error || 'Não foi possível confirmar a saída da conta. Tente novamente.');
  }
  return data;
}

/**
 * Confere a senha da conta já aberta, antes de uma ação destrutiva.
 * Não troca a sessão. Conta só com Google devolve `{ hasPassword: false }`.
 */
export async function confirmCurrentPassword(password) {
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purpose: 'confirm', password }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && data.hasPassword) return { verified: false, hasPassword: true, error: data.error || 'Senha incorreta.' };
  if (!r.ok) throw new Error(data.error || 'Não foi possível confirmar a senha agora.');
  return { verified: data.verified === true, hasPassword: data.hasPassword !== false };
}

/** GB-13: a conta aberta tem senha? Conta que entra só com Google confirma pelo e-mail. */
export async function accountHasPassword() {
  const result = await confirmCurrentPassword('');
  return result.hasPassword !== false;
}

export async function loginWithPassword(email, password) {
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok && !data.needCheckout) throw erroDoServidor(data.error || 'Não foi possível entrar');
  return data;
}

export async function registerWithPassword(email, password) {
  const r = await fetch('/api/auth/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw erroDoServidor(data.error || 'Não foi possível criar a conta');
  trackEvent('sign_up');
  return data;
}
