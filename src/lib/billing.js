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

export async function startCheckout(email) {
  const r = await fetch('/api/stripe/checkout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
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
