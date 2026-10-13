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

function readJson(store, key) {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (raw == null || raw === '') return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(store, key, value) {
  if (!store || value === undefined) return;
  try {
    if (value === null) {
      store.removeItem(key);
      return;
    }
    store.setItem(key, JSON.stringify(value));
  } catch { /* quota */ }
}

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
  } catch { /* quota — cofre pode falhar; active keys ainda existem até o clear */ }
}

/**
 * Guarda o estado activo da conta no slot do owner (antes do logout/troca).
 * @param {string} ownerId — ex.: email:a@b.com
 * @returns {boolean} true se gravou algo útil
 */
export function snapshotAccountVault(ownerId) {
  if (!ownerId || typeof localStorage === 'undefined') return false;
  const bag = {};
  let useful = false;
  for (const key of SNAPSHOT_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null || raw === '') continue;
      bag[key] = raw; // string JSON já serializada — evita double-encode
      if (key === SK.library) {
        try {
          const lib = JSON.parse(raw);
          if (Array.isArray(lib) && lib.length) useful = true;
        } catch { /* */ }
      }
      if (key === SK.brands) {
        try {
          const brands = JSON.parse(raw);
          if (Array.isArray(brands) && brands.length) useful = true;
        } catch { /* */ }
      }
    } catch { /* */ }
  }
  if (!useful && !Object.keys(bag).length) return false;
  const map = readVaultMap();
  map[ownerId] = { savedAt: Date.now(), keys: bag };
  writeVaultMap(map);
  return true;
}

/**
 * Restaura o slot do owner para as chaves activas (vc_library, etc.).
 * @returns {boolean} true se restaurou biblioteca ou marcas
 */
export function restoreAccountVault(ownerId) {
  if (!ownerId || typeof localStorage === 'undefined') return false;
  const map = readVaultMap();
  const slot = map[ownerId];
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

/** Há snapshot com projetos para este owner? */
export function accountVaultHasProjects(ownerId) {
  if (!ownerId || typeof localStorage === 'undefined') return false;
  const slot = readVaultMap()[ownerId];
  const raw = slot?.keys?.[SK.library];
  if (typeof raw !== 'string') return false;
  try {
    const lib = JSON.parse(raw);
    return Array.isArray(lib) && lib.length > 0;
  } catch {
    return false;
  }
}

export { SNAPSHOT_KEYS, readJson, writeJson };
