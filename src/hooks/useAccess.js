/**
 * Acesso ao studio: sessão Stripe, paywall, landing e login Google.
 * Extraído do App — era ~155 linhas de estado + o effect de boot que interpreta
 * os query params de retorno do Stripe/Google (?billing=…, ?login=…).
 *
 * Fonte da verdade é o servidor (`/api/auth/session`); este hook só reflete.
 */
import { useState, useCallback, useEffect } from 'react';
import {
  fetchAccessSession,
  confirmCheckoutSession,
  openBillingPortal,
  logoutAccess,
} from '../lib/billing.js';
import { shouldShowOnboardingLanding, dismissOnboardingLanding } from '../utils/landing-gate.js';
import { trackEvent } from '../utils/telemetry.js';
import { SK } from '../utils/storage.js';

export function useAccess({ setShellView, onLeaveEditor }) {
  const [landingOpen, setLandingOpen] = useState(() => shouldShowOnboardingLanding());
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [paywallEmail, setPaywallEmail] = useState('');
  const [loginHint, setLoginHint] = useState('');
  const [accountTab, setAccountTab] = useState('projects'); // projects | profile
  const [access, setAccess] = useState({ status: 'loading', active: false, email: null });
  const accessActive = !!access.active;

  const enterStudio = useCallback(() => {
    dismissOnboardingLanding();
    setLandingOpen(false);
    setPaywallOpen(false);
    setAccountTab('projects');
    setShellView('home');
    trackEvent('landing_complete');
  }, []);

  const goAccount = useCallback((tab = 'projects') => {
    // Assinatura vive dentro do Perfil (legado: 'plan' → profile)
    setAccountTab(tab === 'plan' ? 'profile' : tab);
    setShellView('home');
    // sem isto o drawer do mobile reaparece aberto ao voltar pro editor,
    // com header e strip de thumbs colapsados
    onLeaveEditor?.();
  }, [setShellView, onLeaveEditor]);

  const refreshAccess = useCallback(async () => {
    const session = await fetchAccessSession();
    setAccess({
      status: session.billingDisabled ? 'disabled' : (session.active ? 'active' : 'inactive'),
      active: !!session.active,
      email: session.email || null,
      billingDisabled: !!session.billingDisabled,
      currentPeriodEnd: session.currentPeriodEnd || null,
    });
    return session;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const q = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : null;
      const sessionId = q?.get('session_id');
      const billing = q?.get('billing');

      if (billing === 'success' && sessionId) {
        try {
          await confirmCheckoutSession(sessionId);
          trackEvent('billing_success');
        } catch (e) {
          console.warn('[billing] confirm failed', e);
        }
      }
      // Limpa TODO param de billing da URL (success/restored/cancel) — sem isso,
      // reload em ?billing=cancel reabre o paywall e ?billing=restored re-entra
      // no studio indefinidamente.
      if (billing) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('billing');
          url.searchParams.delete('session_id');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        } catch { /* */ }
      }

      const loginStatus = q?.get('login');
      const loginEmail = q?.get('email') || '';
      if (loginStatus) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('login');
          url.searchParams.delete('email');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        } catch { /* */ }
      }

      const session = await refreshAccess();
      if (cancelled) return;

      // `?app=1` (usado, entre outros, pelo return_url do portal Stripe) pula a
      // landing. NÃO retorna cedo: antes descartava silenciosamente qualquer
      // `login=*`/`billing=*` que viesse na mesma URL — quem voltasse do portal
      // com um desses params perdia o tratamento correspondente.
      const pulaLanding = q?.get('app') === '1' || q?.get('studio') === '1';
      if (pulaLanding) {
        dismissOnboardingLanding();
        setLandingOpen(false);
        if (!session.active && !loginStatus && !billing) setPaywallOpen(true);
      }
      if (!pulaLanding && (q?.get('landing') === '1' || q?.get('intro') === '1' || q?.get('welcome') === '1')) {
        setLandingOpen(true);
      }
      if (billing === 'success' && session.active) {
        enterStudio();
      }
      if ((billing === 'restored' || loginStatus === 'google') && session.active) {
        trackEvent('login_google_ok');
        enterStudio();
      }
      if (billing === 'cancel') {
        setPaywallOpen(true);
        setLandingOpen(false);
      }

      if (loginStatus === 'no_subscription') {
        setPaywallEmail(loginEmail);
        setLoginHint(loginEmail
          ? `Nenhuma assinatura ativa em ${loginEmail}. Assine abaixo para entrar.`
          : 'Nenhuma assinatura ativa nesta conta Google. Assine abaixo para entrar.');
        setLandingOpen(false);
        setPaywallOpen(true);
        setLoginOpen(false);
      } else if (loginStatus === 'denied') {
        setLoginHint('Login Google cancelado. Tente de novo.');
        setLoginOpen(true);
      } else if (loginStatus === 'google_unconfigured') {
        setLoginHint('Login Google ainda não configurado neste ambiente.');
        setLoginOpen(true);
      } else if (loginStatus === 'invalid_state' || loginStatus === 'error') {
        setLoginHint('Não foi possível entrar com Google. Tente de novo.');
        setLoginOpen(true);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshAccess, enterStudio]);

  const completeLanding = useCallback(async () => {
    const session = await refreshAccess();
    if (session.active) {
      enterStudio();
      return;
    }
    setLandingOpen(false);
    setPaywallOpen(true);
    trackEvent('paywall_open');
  }, [refreshAccess, enterStudio]);

  const reopenLanding = useCallback(() => {
    try { sessionStorage.removeItem(SK.landingDismissed); } catch { /* */ }
    setPaywallOpen(false);
    setLandingOpen(true);
  }, []);

  const openPortal = useCallback(async () => {
    try {
      const { url } = await openBillingPortal();
      if (url) window.location.href = url;
    } catch (e) {
      console.warn('[billing] portal', e);
      alert(e?.message || 'Não foi possível abrir o portal de assinatura.');
    }
  }, []);
  const handleLogout = useCallback(async () => {
    await logoutAccess();
    trackEvent('logout');
    // Sessão morta no servidor — recarrega pro shell reavaliar (paywall/landing).
    window.location.assign('/');
  }, []);

  return {
    landingOpen, setLandingOpen,
    paywallOpen, setPaywallOpen,
    loginOpen, setLoginOpen,
    paywallEmail, setPaywallEmail,
    loginHint, setLoginHint,
    access, setAccess,
    accessActive,
    accountTab, setAccountTab,
    enterStudio,
    goAccount,
    refreshAccess,
    completeLanding,
    reopenLanding,
    openPortal,
    handleLogout,
  };
}
