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
import { clearAccountLocalData } from '../utils/clear-account-data.js';
import { ensureAccountDataOwner } from '../utils/account-data-owner.js';
import { captureShareInviteFromLocation } from '../utils/project-share.js';

export function useAccess({ setShellView, onLeaveEditor, onBeforeLogout, toast } = {}) {
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
      customerId: session.customerId || null,
      billingDisabled: !!session.billingDisabled,
      currentPeriodEnd: session.currentPeriodEnd || null,
      currentPeriodStart: session.currentPeriodStart || null,
      tier: session.tier || null,
      plan: session.plan || null,
      imageQuota: session.imageQuota || null,
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

      // Convite ?share= → stash (OAuth devolve sem o param) antes de limpar URL.
      const pendingShare = captureShareInviteFromLocation();

      const session = await refreshAccess();
      if (cancelled) return;

      // Isolamento por conta: projetos vivem no localStorage deste browser.
      // Trocar de Google/password sem logout deixava a biblioteca do outro.
      const explicitLogin = loginStatus === 'google'
        || loginStatus === 'password'
        || billing === 'restored'
        || billing === 'success';
      const ownerGate = await ensureAccountDataOwner(session, { explicitLogin });
      if (cancelled || ownerGate === 'reloading') return;

      // Multiutilizador: biblioteca na nuvem por conta (após isolamento local).
      if (session?.active) {
        try {
          const { reconcileLibraryCloud } = await import('../utils/library-sync.js');
          const cloudGate = await reconcileLibraryCloud({
            toast,
            email: session?.email,
            customerId: session?.customerId,
          });
          if (cancelled || cloudGate === 'reloading') return;
        } catch { /* rede / Blob — cofre local continua */ }
      }

      // `?app=1` (usado, entre outros, pelo return_url do portal Stripe) pula a
      // landing. NÃO retorna cedo: antes descartava silenciosamente qualquer
      // `login=*`/`billing=*` que viesse na mesma URL — quem voltasse do portal
      // com um desses params perdia o tratamento correspondente.
      const pulaLanding = q?.get('app') === '1' || q?.get('studio') === '1' || !!pendingShare;
      if (pulaLanding) {
        dismissOnboardingLanding();
        setLandingOpen(false);
        if (!session.active && !loginStatus && !billing && !pendingShare) setPaywallOpen(true);
      }
      // Link de equipa sem sessão: pede login (não paywall genérico).
      if (pendingShare && !session.active) {
        setLoginHint('Entre na sua conta Moont para abrir o projeto da equipa.');
        setLoginOpen(true);
        setPaywallOpen(false);
        setLandingOpen(false);
      }
      if (!pulaLanding && (q?.get('landing') === '1' || q?.get('intro') === '1' || q?.get('welcome') === '1')) {
        setLandingOpen(true);
      }
      if (billing === 'success' && session.active) {
        enterStudio();
      }
      if ((billing === 'restored' || loginStatus === 'google' || loginStatus === 'password') && session.active) {
        trackEvent(loginStatus === 'password' ? 'login_password_ok' : 'login_google_ok');
        enterStudio();
      }
      if (q?.get('account_switch') === '1' && session.active) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('account_switch');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        } catch { /* */ }
        if (typeof toast === 'function') {
          toast('Conta trocada: projetos locais anteriores foram limpos neste browser.', 'info', 6000);
        }
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
      const msg = e?.message || 'Não foi possível abrir o portal de assinatura.';
      if (typeof toast === 'function') toast(msg, 'error', 5000);
      else console.error(msg);
    }
  }, [toast]);
  const handleLogout = useCallback(async () => {
    // Ordem crítica: flush React→LS → cofre (rápido) → nuvem curto → limpar → sair.
    try { onBeforeLogout?.(); } catch { /* */ }
    try {
      const {
        readDataOwner, normalizeDataOwnerId, dataOwnerAliases,
      } = await import('../utils/account-data-owner.js');
      const { snapshotAccountVaultForOwners } = await import('../utils/account-vault.js');
      const { lockAccountDataWrites } = await import('../utils/storage.js');
      const owner = readDataOwner()
        || normalizeDataOwnerId(access.email, access.customerId);
      const aliases = [...dataOwnerAliases(access.email, access.customerId)];
      if (owner && !aliases.includes(owner)) aliases.unshift(owner);
      snapshotAccountVaultForOwners(aliases);
      lockAccountDataWrites();
    } catch { /* */ }
    // Nuvem: até ~5s (merge é rápido; fotos best-effort). Cofre já está gravado.
    try {
      const push = import('../utils/library-sync.js')
        .then(({ pushLibraryToCloudBestEffort }) => pushLibraryToCloudBestEffort(5_000));
      await Promise.race([
        push,
        new Promise((r) => setTimeout(r, 5_000)),
      ]);
    } catch { /* best-effort */ }
    try {
      await clearAccountLocalData({ timeoutMs: 1_200, wipeMedia: false });
    } catch { /* best-effort */ }
    try {
      await Promise.race([
        logoutAccess(),
        new Promise((r) => setTimeout(r, 1_500)),
      ]);
    } catch { /* rede / offline */ }
    try { trackEvent('logout'); } catch { /* */ }
    window.location.assign('/');
  }, [access.email, access.customerId, onBeforeLogout]);

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
