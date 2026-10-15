// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import { Home } from 'lucide-react';

// ─── STORAGE KEYS ─────────────────────────────────────────────────────────────
// Chaves centralizadas — nunca use string literal de localStorage diretamente.
const SK = {
  library:       'vc_library',
  libraryFolders:'vc_library_folders',
  legacyDoc:     'vc_doc',
  activeDocId:   'vc_active_doc_id',
  brands:        'vc_brands',
  activeBrandId: 'vc_active_brand_id',
  openaiKey:     'vc_openai_key',
  /** Toggle: usuário escolheu manter chave persistida (true) ou apenas na sessão (false / ausente). */
  openaiKeyPersist: 'vc_openai_key_persist',
  /** Chave Anthropic do navegador (em local dev, vai via proxy). */
  anthropicKey:  'vc_anthropic_key',
  anthropicKeyPersist: 'vc_anthropic_key_persist',
  /** Modelo Claude preferido: 'sonnet' (default, rápido) ou 'opus' (qualidade máxima). */
  claudeModel:   'vc_claude_model',
  aiSettings:    'vc_ai_settings',
  aiKeys:        'vc_ai_keys',
  /** Biblioteca de hooks (capas) que o usuário aprovou — sugerida em novas gerações do mesmo nicho. */
  hookLibrary:   'vc_hook_library',
  onboarding:    'vc_onboarding_done',
  /** Landing cinematográfica — dispensada nesta sessão após "Entrar no studio". */
  landingDismissed: 'vc_landing_dismissed',
  /** Legado (não usar para decidir se abre a landing). */
  landingDone:   'vc_landing_done',
  shellView:     'vc_shell_view',
  /** Lista no editor: grelha de alinhamento sobre o preview (não exportada). */
  previewGrid:   'vc_preview_align_grid',
  /** Sistema de Modos (FASE 2 Narrative OS): criador (default, 90%
      dos users), diretor (intermediate), studio (avançado). Controla
      progressive disclosure global. */
  appMode:       'vc_app_mode',
  /** Onboarding dos 3 modos — primeira visita ou clique no chip "?". */
  modesIntro:    'vc_modes_intro_done',
  /** Fatia 2: utilizador já viu o aviso de backup na 1ª sessão. */
  backupNudgeDone: 'vc_backup_nudge_done',
  /** Conta dona dos dados locais (email/customerId) — isola biblioteca entre logins. */
  dataOwner: 'vc_data_owner',
  /** Aliases confirmados pela sessão para o mesmo owner (email ↔ Stripe id). */
  dataOwnerAliases: 'vc_data_owner_aliases',
  /** Meta do último sync nuvem (revision/updatedAt) — vai no cofre; não sobrevive sola. */
  libraryCloudMeta: 'vc_library_cloud_meta',
  /** IDs apagados localmente — a nuvem remove-os no merge (tombstones). */
  libraryDeletedIds: 'vc_library_deleted_ids',
};

/** Preferência Home vs Editor: persiste como JSON `"home"` | `"project"` */
function readInitialShellView() {
  try {
    const raw = localStorage.getItem(SK.shellView);
    if (raw != null) {
      const val = JSON.parse(raw);
      if (val === 'home' || val === 'project') return val;
    }
  } catch {
    /* ignore */
  }
  try {
    const rawLib = localStorage.getItem(SK.library);
    if (!rawLib) return 'home';
    const lib = JSON.parse(rawLib);
    if (Array.isArray(lib) && lib.length) {
      const hasNonTrivial = lib.some((e) => {
        const sl = e?.doc?.slides;
        if (!Array.isArray(sl) || sl.length !== 1) return true;
        return sl[0]?.title !== 'Seu título aqui';
      });
      if (hasNonTrivial) return 'project';
    }
  } catch {
    /* ignore */
  }
  return 'home';
}

// Evita spam de toast quando cada debounce de gravação volta a bater no limite.
let VC_QUOTA_SLIM_ALREADY_NOTIFIED = false;
let VC_QUOTA_HARD_ALREADY_NOTIFIED = false;
const quotaFailedKeys = new Set();

function confirmQuotaRecovery(key) {
  if (!quotaFailedKeys.delete(key) || quotaFailedKeys.size) return;
  VC_QUOTA_SLIM_ALREADY_NOTIFIED = false;
  VC_QUOTA_HARD_ALREADY_NOTIFIED = false;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vc:quota-recovered'));
  }
}

/**
 * Trava gravações da conta (biblioteca/marcas/dono) durante logout ou troca.
 * Sem isto, `pagehide`/`beforeunload` reescrevem `vc_library` DEPOIS do clear
 * e o próximo login herda os projetos do utilizador anterior.
 */
let accountDataWriteLocked = false;
const WRITE_LOCK_KEY = 'vc_account_write_lock';
const WRITE_LOCK_TOKEN_KEY = 'vc_account_write_lock_token';
const WRITE_LOCK_TTL_MS = 60_000;
const WRITE_LOCK_PROBE_CHANNEL = 'vc_account_write_lock_probe';
const WRITE_LOCK_PROBE_MS = 180;
let memoryWriteLockToken = '';
let writeLockStore = null;
const knownWriteLockTokens = new WeakMap();
let writeLockChannel = null;
let pendingWriteLockProbe = null;
let pendingWriteLockRelease = false;
let writeLockDocumentDeparting = false;
let tabOwnerStore = null;
let tabOwnerBound = false;
let tabOwnerId = null;
let lastForeignWriteNotice = 0;

function currentDataOwner() {
  try {
    const raw = localStorage.getItem(SK.dataOwner);
    if (!raw) return null;
    try { return JSON.parse(raw) || null; } catch { return raw; }
  } catch { return null; }
}

/** Fixa a identidade da aba; só uma troca autenticada nesta própria aba a altera. */
export function bindAccountDataWriteOwner(ownerId, { switchedHere = false } = {}) {
  const store = typeof localStorage === 'undefined' ? null : localStorage;
  if (store !== tabOwnerStore) {
    tabOwnerStore = store;
    tabOwnerBound = false;
    tabOwnerId = null;
  }
  if (!tabOwnerBound || switchedHere) {
    tabOwnerBound = true;
    tabOwnerId = ownerId || null;
  }
}

function foreignAccountOwner() {
  bindAccountDataWriteOwner(currentDataOwner());
  return tabOwnerId !== currentDataOwner();
}

export function isAccountDataWriteOwnerCurrent() {
  return !foreignAccountOwner();
}

function newWriteLockToken() {
  try { return crypto.randomUUID(); }
  catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
}

function rememberWriteLockToken(token) {
  memoryWriteLockToken = token;
  if (writeLockStore) {
    knownWriteLockTokens.set(writeLockStore, token);
    try { writeLockStore.setItem(WRITE_LOCK_TOKEN_KEY, token); } catch { /* */ }
  }
}

function navigationIsReload() {
  try { return performance.getEntriesByType('navigation')?.[0]?.type === 'reload'; }
  catch { return false; }
}

function ensureWriteLockChannel() {
  if (writeLockChannel || typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function') return writeLockChannel;
  try {
    writeLockChannel = new window.BroadcastChannel(WRITE_LOCK_PROBE_CHANNEL);
    window.addEventListener?.('pagehide', () => { writeLockDocumentDeparting = true; });
    window.addEventListener?.('pageshow', () => { writeLockDocumentDeparting = false; });
    writeLockChannel.onmessage = ({ data }) => {
      if (data?.type === 'probe' && data.token === memoryWriteLockToken
        && !pendingWriteLockProbe && !writeLockDocumentDeparting
        && readCrossTabWriteLock()?.token === data.token) {
        writeLockChannel.postMessage({ type: 'held', token: data.token, probeId: data.probeId });
      } else if (data?.type === 'held' && pendingWriteLockProbe?.probeId === data.probeId
        && pendingWriteLockProbe.token === data.token) {
        const pending = pendingWriteLockProbe;
        clearTimeout(pending.timer);
        pendingWriteLockProbe = null;
        // A aba original ainda está viva; esta aba duplicada não herda o lease.
        rememberWriteLockToken(newWriteLockToken());
        pendingWriteLockRelease = false;
        pending.waiters.forEach((resolve) => resolve());
      }
    };
  } catch { writeLockChannel = null; }
  return writeLockChannel;
}

function thisTabWriteLockToken() {
  const store = typeof sessionStorage === 'undefined' ? null : sessionStorage;
  if (store === writeLockStore && memoryWriteLockToken) {
    // A limpeza da conta pode remover a chave de sessão antes do redirect.
    try {
      if (store?.getItem(WRITE_LOCK_TOKEN_KEY) !== memoryWriteLockToken) {
        store?.setItem(WRITE_LOCK_TOKEN_KEY, memoryWriteLockToken);
      }
    } catch { /* */ }
    return memoryWriteLockToken;
  }
  writeLockStore = store;
  if (store && knownWriteLockTokens.has(store)) {
    memoryWriteLockToken = knownWriteLockTokens.get(store);
    return memoryWriteLockToken;
  }
  let previous = '';
  try { previous = store?.getItem(WRITE_LOCK_TOKEN_KEY) || ''; } catch { /* */ }
  const existing = readCrossTabWriteLock();
  // sessionStorage pode ser CLONADO por "Duplicar aba". Só o mesmo documento
  // recarregado pode recuperar o token, depois de perguntar às abas vivas.
  if (previous && existing?.token === previous && (navigationIsReload() || existing.transfer === true)) {
    const channel = ensureWriteLockChannel();
    if (channel) {
      const probeId = newWriteLockToken();
      const pending = { token: previous, probeId, timer: null, waiters: [] };
      pendingWriteLockProbe = pending;
      pending.timer = setTimeout(() => {
        if (pendingWriteLockProbe !== pending) return;
        pendingWriteLockProbe = null;
        if (readCrossTabWriteLock()?.token === previous) {
          rememberWriteLockToken(previous);
          if (pendingWriteLockRelease) {
            try { localStorage.removeItem(WRITE_LOCK_KEY); } catch { /* TTL protege */ }
          }
        }
        pendingWriteLockRelease = false;
        pending.waiters.forEach((resolve) => resolve());
      }, WRITE_LOCK_PROBE_MS);
      try { channel.postMessage({ type: 'probe', token: previous, probeId }); }
      catch {
        clearTimeout(pending.timer);
        pendingWriteLockProbe = null;
        pending.waiters.forEach((resolve) => resolve());
      }
    }
  }
  // Cada novo documento nasce com token próprio, inclusive quando a sessão
  // clonada trouxe um token antigo sem lease ativo.
  rememberWriteLockToken(newWriteLockToken());
  ensureWriteLockChannel();
  return memoryWriteLockToken;
}

/** Boot aguarda o probe antes de decidir se pode restaurar a biblioteca. */
export function isAccountWriteLockProbePending() {
  thisTabWriteLockToken();
  return !!pendingWriteLockProbe;
}

export function waitForAccountWriteLockProbe() {
  thisTabWriteLockToken();
  if (!pendingWriteLockProbe) return Promise.resolve();
  return new Promise((resolve) => pendingWriteLockProbe.waiters.push(resolve));
}

function readCrossTabWriteLock() {
  try {
    const raw = localStorage.getItem(WRITE_LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || Number(parsed.until) < Date.now()) {
      try { localStorage.removeItem(WRITE_LOCK_KEY); } catch { /* */ }
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function claimCrossTabWriteLock({ transfer = false } = {}) {
  if (foreignWriteLock()) return false;
  const token = thisTabWriteLockToken();
  try {
    localStorage.setItem(WRITE_LOCK_KEY, JSON.stringify({
      token,
      until: Date.now() + WRITE_LOCK_TTL_MS,
      transfer,
    }));
  } catch { /* */ }
  return !foreignWriteLock();
}

/** Reserva a janela curta de aplicação do pull sem bloquear as próprias escritas. */
export function lockOtherAccountTabs() {
  if (foreignWriteLock() || foreignAccountOwner()) return false;
  return claimCrossTabWriteLock();
}

export function lockAccountDataWrites() {
  accountDataWriteLocked = true;
  claimCrossTabWriteLock({ transfer: true });
}

export function unlockAccountDataWrites() {
  accountDataWriteLocked = false;
  // A mesma aba também detém o lease compartilhado. Liberá-lo aqui evita
  // que outras abas fiquem até 60 segundos sem autosave após o pull terminar.
  try {
    const cross = readCrossTabWriteLock();
    const mine = thisTabWriteLockToken();
    if (pendingWriteLockProbe) pendingWriteLockRelease = true;
    if (mine && cross?.token === mine) localStorage.removeItem(WRITE_LOCK_KEY);
  } catch { /* o lease expira se o browser impedir a remoção */ }
}

function foreignWriteLock() {
  const cross = readCrossTabWriteLock();
  if (!cross) return false;
  const mine = thisTabWriteLockToken();
  return !(mine && cross.token === mine);
}

export function areAccountDataWritesLocked() {
  return accountDataWriteLocked || foreignWriteLock() || foreignAccountOwner();
}

const ACCOUNT_WRITE_KEYS = new Set([
  SK.library,
  SK.libraryFolders,
  SK.activeDocId,
  SK.brands,
  SK.activeBrandId,
  SK.dataOwner,
  SK.legacyDoc,
  SK.libraryCloudMeta,
  SK.libraryDeletedIds,
]);

// lsSet retorna true em sucesso, false em falha.
// Em caso de QuotaExceededError dispara evento customizado que o App escuta para exibir toast.
const lsSet = (key, value) => {
  if (ACCOUNT_WRITE_KEYS.has(key)) {
    const foreign = foreignWriteLock() || foreignAccountOwner();
    if (accountDataWriteLocked || foreign) {
      if (foreign && Date.now() - lastForeignWriteNotice > 2_000 && typeof window !== 'undefined') {
        lastForeignWriteNotice = Date.now();
        window.dispatchEvent(new CustomEvent('vc:account-write-blocked', { detail: { key } }));
      }
      return false;
    }
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    confirmQuotaRecovery(key);
    return true;
  } catch (err) {
    const isQuota = err instanceof DOMException && (
      err.code === 22 || err.code === 1014 ||
      err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
    if (isQuota) {
      // Compacta apenas imagens que já têm cópia persistida; nunca apaga a única cópia.
      try {
        const slim = JSON.parse(JSON.stringify(value));
        if (key === 'vc_library' && Array.isArray(slim)) {
          slim.forEach(entry => {
            (entry.doc?.slides || []).forEach(s => { if (s.bgImageId) delete s.bgImage; });
          });
          localStorage.setItem(key, JSON.stringify(slim));
          if (!VC_QUOTA_SLIM_ALREADY_NOTIFIED) {
            VC_QUOTA_SLIM_ALREADY_NOTIFIED = true;
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vc:quota-warning', {
              detail: 'O armazenamento deste navegador está quase cheio. A cópia local foi salva sem duplicar imagens já armazenadas. Clique em Salvar para sincronizar com sua conta.',
            }));
          }
          confirmQuotaRecovery(key);
          return true;
        }
      } catch { /* fallback falhou também */ }
      // Só uma falha final deixa a chave pendente. A compactação bem-sucedida
      // acima já persistiu os dados e não constitui uma gravação perdida.
      quotaFailedKeys.add(key);
      if (!VC_QUOTA_HARD_ALREADY_NOTIFIED) {
        VC_QUOTA_HARD_ALREADY_NOTIFIED = true;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vc:quota-exceeded', {
          detail: 'Não foi possível salvar a cópia local porque o armazenamento deste navegador está cheio. Mantenha esta aba aberta e clique em Salvar para tentar guardar as alterações na sua conta.',
        }));
      }
    }
    return false;
  }
};

export {
  SK,
  readInitialShellView,
  VC_QUOTA_SLIM_ALREADY_NOTIFIED,
  VC_QUOTA_HARD_ALREADY_NOTIFIED,
  lsSet,
};
