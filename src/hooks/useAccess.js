/**
 * Acesso ao studio: sessão Stripe, paywall, landing e login Google.
 * Extraído do App — era ~155 linhas de estado + o effect de boot que interpreta
 * os query params de retorno do Stripe/Google (?billing=…, ?login=…).
 *
 * Fonte da verdade é o servidor (`/api/auth/session`); este hook só reflete.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  fetchAccessSession,
  confirmCheckoutSession,
  clearPendingCheckoutSessionId,
  openBillingPortal,
  logoutAccess,
} from '../lib/billing.js';
import { shouldShowOnboardingLanding, dismissOnboardingLanding } from '../utils/landing-gate.js';
import { trackEvent } from '../utils/telemetry.js';
import { SK, areAccountDataWritesLocked, lockAccountDataWrites, unlockAccountDataWrites } from '../utils/storage.js';
import { clearAccountLocalData } from '../utils/clear-account-data.js';
import {
  ensureAccountDataOwner, readDataOwner, normalizeDataOwnerId, dataOwnerAliases,
} from '../utils/account-data-owner.js';
import { ACCOUNT_VAULT_KEY, snapshotAccountVaultForOwners } from '../utils/account-vault.js';
import { PENDING_SHARE_KEY, captureShareInviteFromLocation } from '../utils/project-share.js';
import { USER_PROFILE_KEY } from '../utils/user-profile.js';
import { CUSTOM_VISUAL_PRESETS_KEY } from '../utils/custom-visual-presets.js';

const LOGOUT_CLEANUP_PENDING_KEY = 'vc_logout_cleanup_pending';
const LOGOUT_CLEANUP_WARNING = 'Você saiu da conta, mas ainda há dados locais neste navegador. Vamos terminar a limpeza antes de abrir outra conta.';
const LOGOUT_PRESERVED_KEYS = new Set([
  ACCOUNT_VAULT_KEY, PENDING_SHARE_KEY,
  'vc_account_write_lock', 'vc_account_write_lock_token',
  'vc_logout_warning', LOGOUT_CLEANUP_PENDING_KEY,
]);

function hasAccountDataResidue() {
  try {
    const stores = [
      typeof localStorage !== 'undefined' ? localStorage : null,
      typeof sessionStorage !== 'undefined' ? sessionStorage : null,
    ];
    const knownKeys = [...Object.values(SK), USER_PROFILE_KEY, CUSTOM_VISUAL_PRESETS_KEY];
    return stores.some((store) => {
      if (!store) return false;
      if (knownKeys.some((key) => key && !LOGOUT_PRESERVED_KEYS.has(key) && store.getItem(key) != null)) return true;
      if (typeof store.length !== 'number' || typeof store.key !== 'function') return false;
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key?.startsWith('vc_') && !LOGOUT_PRESERVED_KEYS.has(key)) return true;
      }
      return false;
    });
  } catch { return true; }
}

function rememberLogoutWarning(message, cleanupPending = false) {
  try {
    sessionStorage.setItem('vc_logout_warning', message);
    if (cleanupPending) sessionStorage.setItem(LOGOUT_CLEANUP_PENDING_KEY, '1');
  } catch { /* isolamento por owner continua no boot */ }
}

function readLoginHintEmail() {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|; )vc_login_hint=([^;]*)/);
  if (!match) return '';
  document.cookie = 'vc_login_hint=; Max-Age=0; Path=/';
  try { return decodeURIComponent(match[1]); }
  catch { return ''; }
}

/** Só descarta a edição ativa depois de uma cópia confirmada desta mesma edição. */
export async function logoutWithProtectedLibrary({
  access = {}, onBeforeLogout, isSameAccount = () => true, inFlightRef, toast,
} = {}) {
  if (!inFlightRef || inFlightRef.current) return false;
  inFlightRef.current = true;
  let lockedHere = false;
  let remoteLogoutConfirmed = false;
  let logoutCompleted = false;
  let revocationWarning = false;
  try {
    if (areAccountDataWritesLocked()) {
      throw new Error('Aguarde a sincronização terminar antes de sair da conta.');
    }
    // Não inferir que o localStorage está atualizado: o flush pode ter falhado
    // por quota. Um callback legado sem recibo não autoriza limpar a edição.
    let prepared;
    try { prepared = await onBeforeLogout?.(); } catch {
      throw new Error('Não foi possível proteger as últimas alterações. Você continua na conta; salve ou sincronize antes de sair.');
    }
    if (!Array.isArray(prepared?.snapshot?.library) || typeof prepared?.isCurrent !== 'function') {
      throw new Error('Não foi possível confirmar as últimas alterações. Você continua na conta; salve ou sincronize antes de sair.');
    }
    const owner = readDataOwner() || normalizeDataOwnerId(access.email, access.customerId);
    const aliases = [...dataOwnerAliases(access.email, access.customerId)];
    if (owner && !aliases.includes(owner)) {
      throw new Error('A conta mudou durante a operação. Suas alterações foram mantidas; tente novamente.');
    }
    const ownerAtStart = readDataOwner();
    const stillCurrent = () => {
      try { return isSameAccount() && readDataOwner() === ownerAtStart && prepared.isCurrent() === true; }
      catch { return false; }
    };
    if (!stillCurrent()) {
      throw new Error('O projeto mudou durante a sincronização. Você continua na conta; salve as novas alterações antes de sair.');
    }
    lockAccountDataWrites();
    lockedHere = true;
    // O cofre recebe a edição em memória, mesmo se o cache pequeno estiver
    // cheio. Só a transação durável concluída autoriza a limpeza da conta.
    let vaultSaved = false;
    try { vaultSaved = await snapshotAccountVaultForOwners(aliases, { snapshot: prepared.snapshot }) === true; }
    catch { /* exige confirmação da nuvem abaixo */ }
    if (!stillCurrent()) {
      throw new Error('O projeto mudou durante a sincronização. Você continua na conta; salve as novas alterações antes de sair.');
    }
    // O timeout cancela pedidos antes da limpeza; o recibo inclui as imagens.
    let cloudResult = null;
    try {
      const { pushLibraryToCloudBestEffort } = await import('../utils/library-sync.js');
      cloudResult = await pushLibraryToCloudBestEffort(vaultSaved ? 5_000 : 30_000, { snapshot: prepared.snapshot });
    } catch { /* o cofre só vale quando contém a edição atual confirmada */ }
    if (!stillCurrent()) {
      throw new Error('O projeto mudou durante a sincronização. Você continua na conta; salve as novas alterações antes de sair.');
    }
    const cloudSaved = cloudResult?.ok === true && cloudResult.cloudSaved === true && cloudResult.assetsFailed === 0;
    if (!vaultSaved && !cloudSaved) {
      throw new Error('As últimas alterações ainda não estão protegidas. Você continua na conta; salve ou sincronize antes de sair.');
    }
    let logoutTimer;
    const logoutController = new AbortController();
    try {
      const result = await Promise.race([
        logoutAccess({ signal: logoutController.signal }),
        new Promise((_, reject) => { logoutTimer = setTimeout(() => {
          logoutController.abort();
          reject(new Error('Não foi possível confirmar a saída da conta. Tente novamente.'));
        }, 10_000); }),
      ]);
      if (result?.ok !== true || result?.localCookieCleared === false) {
        throw new Error('Não foi possível confirmar a saída da conta. Tente novamente.');
      }
      remoteLogoutConfirmed = true;
      revocationWarning = !!result.warning;
    } catch (error) {
      throw new Error(error?.message || 'Não foi possível confirmar a saída da conta. Tente novamente.');
    }
    finally { clearTimeout(logoutTimer); }
    // Só remove o cache ativo depois de o servidor confirmar a saída. Se a
    // limpeza local falhar, mantém o lock e recarrega no gate antes de outra conta.
    let cleanupFailed = false;
    try { await clearAccountLocalData({ timeoutMs: 1_200, wipeMedia: false }); }
    catch (error) {
      console.error('[auth/logout] local cleanup', error);
      cleanupFailed = true;
    }
    if (hasAccountDataResidue()) cleanupFailed = true;
    if (cleanupFailed) rememberLogoutWarning(LOGOUT_CLEANUP_WARNING, true);
    else if (revocationWarning) rememberLogoutWarning('Você saiu deste navegador, mas não foi possível confirmar o encerramento das outras sessões.');
    try { trackEvent('logout'); } catch { /* */ }
    window.location.assign(cleanupFailed ? '/?landing=1' : '/');
    logoutCompleted = true;
    return true;
  } catch (error) {
    toast?.(error?.message || 'As últimas alterações ainda não estão protegidas. Você continua na conta; tente sincronizar novamente.', 'warning', 6500);
    return false;
  } finally {
    if (lockedHere && !remoteLogoutConfirmed && !logoutCompleted) unlockAccountDataWrites();
    inFlightRef.current = false;
  }
}

export function useAccess({ setShellView, onLeaveEditor, onBeforeLogout, onCloudLibraryApplied, onLibraryReady, onLibraryBlocked, toast } = {}) {
  const libraryCallbacksRef = useRef({ onCloudLibraryApplied, onLibraryReady, onLibraryBlocked });
  libraryCallbacksRef.current = { onCloudLibraryApplied, onLibraryReady, onLibraryBlocked };
  const [landingOpen, setLandingOpen] = useState(() => shouldShowOnboardingLanding());
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [paywallEmail, setPaywallEmail] = useState('');
  const [loginHint, setLoginHint] = useState('');
  const [accountTab, setAccountTab] = useState('projects'); // projects | profile
  const [access, setAccess] = useState({ status: 'loading', active: false, email: null });
  const latestAccessRef = useRef(access);
  const logoutInFlightRef = useRef(false);
  latestAccessRef.current = access;
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

  // Atualizar o consumo não reinicia o login nem a restauração de projetos.
  // Respostas atrasadas de outra conta não alteram a sessão atual.
  const refreshImageUsage = useCallback(async () => {
    const owner = latestAccessRef.current.email;
    const session = await fetchAccessSession();
    if (latestAccessRef.current.email !== owner || !latestAccessRef.current.active) return null;
    if (!session.active || session.email !== owner) {
      setAccess((current) => ({
        ...current,
        imageQuota: { ...current.imageQuota, status: 'unavailable', available: false, used: null, remaining: null, allowed: false },
      }));
      throw new Error('Não foi possível consultar o uso da conta.');
    }
    setAccess((current) => ({
      ...current, tier: session.tier, plan: session.plan,
      imageQuota: session.imageQuota || { status: 'unavailable', available: false, used: null, remaining: null, allowed: false },
      currentPeriodStart: session.currentPeriodStart || null,
      currentPeriodEnd: session.currentPeriodEnd || null,
    }));
    return session.imageQuota || null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const warning = sessionStorage.getItem('vc_logout_warning');
        if (warning) {
          sessionStorage.removeItem('vc_logout_warning');
          toast?.(warning, 'warning', 8000);
        }
      } catch { /* */ }
      try {
        if (sessionStorage.getItem(LOGOUT_CLEANUP_PENDING_KEY) === '1') {
          await clearAccountLocalData({ timeoutMs: 1_200, wipeMedia: false });
          if (hasAccountDataResidue()) {
            sessionStorage.setItem(LOGOUT_CLEANUP_PENDING_KEY, '1');
            libraryCallbacksRef.current.onLibraryBlocked?.(LOGOUT_CLEANUP_WARNING);
            return;
          }
          sessionStorage.removeItem(LOGOUT_CLEANUP_PENDING_KEY);
          unlockAccountDataWrites();
        }
      } catch {
        libraryCallbacksRef.current.onLibraryBlocked?.(LOGOUT_CLEANUP_WARNING);
        return;
      }
      const q = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : null;
      const sessionId = q?.get('session_id');
      const billing = q?.get('billing');
      let confirmFailed = false;

      if (billing === 'success') {
        try {
          await confirmCheckoutSession(sessionId || undefined);
          trackEvent('billing_success');
        } catch (e) {
          console.warn('[billing] confirm failed', e);
          confirmFailed = true;
        }
      }

      const loginStatus = q?.get('login');
      const loginEmail = q?.get('email') || readLoginHintEmail();
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
      // Se a resposta de confirm se perdeu mas o Set-Cookie chegou, a sessão
      // já está ativa. Caso contrário, preserve ?billing=success para retry.
      if (billing && (!confirmFailed || session.active || billing !== 'success')) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('billing');
          url.searchParams.delete('session_id');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        } catch { /* */ }
      }
      if (billing === 'success' && session.active) clearPendingCheckoutSessionId();
      if (billing === 'success' && confirmFailed && !session.active) {
        toast?.('Não foi possível confirmar a assinatura agora. Recarregue esta página para tentar novamente.', 'warning', 8000);
      }

      // Isolamento por conta: projetos vivem no localStorage deste browser.
      // Trocar de Google/password sem logout deixava a biblioteca do outro.
      const explicitLogin = loginStatus === 'google'
        || loginStatus === 'password'
        || billing === 'restored'
        || billing === 'success';
      const sessionOwners = dataOwnerAliases(session?.email, session?.customerId);
      const sessionStillOwnsData = () => !cancelled && (!session?.active || !sessionOwners.size || sessionOwners.has(readDataOwner()));
      let restoredSnapshot;
      const ownerGate = await ensureAccountDataOwner(session, {
        explicitLogin,
        isCurrent: () => !cancelled,
        onRestored: typeof libraryCallbacksRef.current.onCloudLibraryApplied === 'function'
          ? async (snapshot, result) => {
            if (!sessionStillOwnsData()) throw new Error('A conta mudou durante a restauração.');
            await libraryCallbacksRef.current.onCloudLibraryApplied(snapshot, result);
            restoredSnapshot = snapshot;
          }
          : undefined,
      });
      if (cancelled || ownerGate === 'reloading') return;
      if (ownerGate === 'blocked') {
        libraryCallbacksRef.current.onLibraryBlocked?.('Não foi possível proteger os projetos da conta anterior neste navegador. Mantenha esta aba aberta e tente novamente.');
        return;
      }
      if (!sessionStillOwnsData()) return;

      // Multiutilizador: biblioteca na nuvem por conta (após isolamento local).
      if (session?.active) {
        try {
          const { reconcileLibraryCloud, CLOUD_LIBRARY_RESTORE_BLOCKED_MESSAGE } = await import('../utils/library-sync.js');
          if (!sessionStillOwnsData()) return;
          const cloudGate = await reconcileLibraryCloud({
            toast,
            email: session?.email,
            customerId: session?.customerId,
            localSnapshot: restoredSnapshot,
            onApplied: libraryCallbacksRef.current.onCloudLibraryApplied,
          });
          if (!sessionStillOwnsData() || cloudGate === 'reloading') return;
          if (cloudGate === 'blocked') {
            libraryCallbacksRef.current.onLibraryBlocked?.(CLOUD_LIBRARY_RESTORE_BLOCKED_MESSAGE);
            return;
          }
        } catch { /* rede / Blob — cofre local continua */ }
        if (sessionStillOwnsData()) libraryCallbacksRef.current.onLibraryReady?.();
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
      } else if (loginStatus === 'account_conflict') {
        setLoginHint('Encontramos mais de uma conta com este e-mail e não foi seguro escolher uma. Entre com sua senha ou procure o suporte para recuperar seus projetos.');
        setLoginOpen(true);
        setPaywallOpen(false);
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
    const owner = latestAccessRef.current;
    return logoutWithProtectedLibrary({
      access: owner, onBeforeLogout, toast, inFlightRef: logoutInFlightRef,
      isSameAccount: () => latestAccessRef.current.email === owner.email
        && latestAccessRef.current.customerId === owner.customerId,
    });
  }, [onBeforeLogout, toast]);

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
    refreshImageUsage,
    completeLanding,
    reopenLanding,
    openPortal,
    handleLogout,
  };
}
