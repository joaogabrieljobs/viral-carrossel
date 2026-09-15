/**
 * Client helpers — assinatura Stripe / acesso ao studio.
 */

export async function fetchAccessSession() {
  try {
    const r = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
    });
    if (!r.ok) {
      if (import.meta.env.DEV) {
        return { active: true, billingDisabled: true, devFallback: true };
      }
      return { active: false, status: 'error' };
    }
    return await r.json();
  } catch {
    if (import.meta.env.DEV) {
      return { active: true, billingDisabled: true, devFallback: true };
    }
    return { active: false, status: 'offline' };
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
  return data;
}

export async function confirmCheckoutSession(sessionId) {
  const r = await fetch('/api/stripe/confirm', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Não foi possível confirmar a assinatura');
  return data;
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

export async function logoutAccess() {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {});
}

export async function loginWithPassword(email, password) {
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Não foi possível entrar');
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
  if (!r.ok) throw new Error(data.error || 'Não foi possível criar a conta');
  return data;
}
