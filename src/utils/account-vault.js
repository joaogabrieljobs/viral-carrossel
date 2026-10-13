/**
 * Cofre local por conta: projetos/marcas sobrevivem a «Sair da conta» no mesmo
 * browser. O isolamento entre contas mantém-se — cada ownerId tem o seu slot.
 *
 * Não é sync em nuvem: outro dispositivo continua a precisar de backup JSON.
 */
import { SK } from './storage.js';
import { USER_PROFILE_KEY } from './user-profile.js';

export const ACCOUNT_VAULT_KEY = 'vc_account_vault';

const SNAPSHOT_KEYS = [
  SK.library,
  SK.libraryFolders,
  SK.activeDocId,
  SK.brands,
  SK.activeBrandId,
  USER_PROFILE_KEY,
  SK.libraryCloudMeta,
  /** Tour / intro — só na 1.ª vez da conta, não a cada geração de cards. */
  SK.onboarding,
  SK.modesIntro,
];

function readVaultMap() {
  try {
    const raw = localStorage.getItem(ACCOUNT_VAULT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeVaultMap(map) {
  try {
    localStorage.setItem(ACCOUNT_VAULT_KEY, JSON.stringify(map));
  } catch { /* quota */ }
}

function libraryCountFromBag(raw) {
  if (typeof raw !== 'string' || !raw) return 0;
  try {
    const lib = JSON.parse(raw);
    return Array.isArray(lib) ? lib.length : 0;
  } catch {
    return 0;
  }
}

function collectBag() {
  const bag = {};
  let useful = false;
  for (const key of SNAPSHOT_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null || raw === '') continue;
      bag[key] = raw;
      if (key === SK.library && libraryCountFromBag(raw) > 0) useful = true;
      if (key === SK.brands) {
        try {
          const brands = JSON.parse(raw);
          if (Array.isArray(brands) && brands.length) useful = true;
        } catch { /* */ }
      }
    } catch { /* */ }
  }
  return { bag, useful, projectCount: libraryCountFromBag(bag[SK.library]) };
}

/**
 * Guarda o estado activo no slot do owner.
 * Nunca sobrescreve um cofre com mais projetos por um snapshot vazio/stale.
 */
export function snapshotAccountVault(ownerId) {
  if (!ownerId || typeof localStorage === 'undefined') return false;
  const { bag, useful, projectCount } = collectBag();
  if (!useful && !Object.keys(bag).length) return false;

  const map = readVaultMap();
  const prevCount = libraryCountFromBag(map[ownerId]?.keys?.[SK.library]);
  if (projectCount < prevCount) {
    // Evita apagar «Clínica Janine» com um snapshot vazio no logout.
    return false;
  }

  map[ownerId] = { savedAt: Date.now(), keys: bag };
  writeVaultMap(map);
  return true;
}

/** Snapshot nos aliases email: e id:cus da mesma conta. */
export function snapshotAccountVaultForOwners(ownerIds = []) {
  const ids = [...new Set((ownerIds || []).filter(Boolean))];
  let any = false;
  for (const id of ids) {
    if (snapshotAccountVault(id)) any = true;
  }
  return any;
}

function applySlot(slot) {
  if (!slot?.keys || typeof slot.keys !== 'object') return false;
  let restored = false;
  for (const key of SNAPSHOT_KEYS) {
    const raw = slot.keys[key];
    if (typeof raw !== 'string' || raw === '') continue;
    try {
      localStorage.setItem(key, raw);
      if (key === SK.library || key === SK.brands) restored = true;
    } catch { /* */ }
  }
  return restored;
}

/**
 * Restaura o melhor slot entre ownerId e aliases (email: ↔ id:cus).
 */
export function restoreAccountVault(ownerId, aliases = []) {
  if (typeof localStorage === 'undefined') return false;
  const map = readVaultMap();
  const candidates = [...new Set([ownerId, ...(aliases || [])].filter(Boolean))];
  let best = null;
  let bestCount = -1;
  for (const id of candidates) {
    const slot = map[id];
    const count = libraryCountFromBag(slot?.keys?.[SK.library]);
    if (count > bestCount) {
      bestCount = count;
      best = slot;
    }
  }
  if (!best && ownerId && map[ownerId]) best = map[ownerId];
  return applySlot(best);
}

export function accountVaultHasProjects(ownerId, aliases = []) {
  if (typeof localStorage === 'undefined') return false;
  const map = readVaultMap();
  const candidates = [...new Set([ownerId, ...(aliases || [])].filter(Boolean))];
  for (const id of candidates) {
    if (libraryCountFromBag(map[id]?.keys?.[SK.library]) > 0) return true;
  }
  return false;
}

export { SNAPSHOT_KEYS };
