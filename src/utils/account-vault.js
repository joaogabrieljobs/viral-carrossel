/**
 * Cofre local por conta: projetos/marcas sobrevivem a «Sair da conta» no mesmo
 * browser. O isolamento entre contas mantém-se — cada ownerId tem o seu slot.
 *
 * É uma proteção local; o sync da conta restaura projetos em outro dispositivo.
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
  SK.libraryDeletedIds,
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
    const raw = JSON.stringify(map);
    localStorage.setItem(ACCOUNT_VAULT_KEY, raw);
    return localStorage.getItem(ACCOUNT_VAULT_KEY) === raw;
  } catch { return false; }
}

/** Slots antigos continuam válidos. Pointers só ligam aliases já confirmados. */
function resolveSlot(map, ownerId) {
  const visited = new Set();
  let id = ownerId;
  while (typeof id === 'string' && id && !visited.has(id)) {
    visited.add(id);
    const slot = Object.prototype.hasOwnProperty.call(map, id) ? map[id] : null;
    if (!slot || typeof slot !== 'object') return null;
    if (slot.keys && typeof slot.keys === 'object' && !Array.isArray(slot.keys)) {
      return { ownerId: id, slot };
    }
    id = slot.aliasOf;
  }
  return null;
}

function sameBag(left, right) {
  if (!left || !right) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
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
  const previous = resolveSlot(map, ownerId);
  const prevCount = libraryCountFromBag(previous?.slot.keys[SK.library]);
  if (projectCount < prevCount) {
    // Evita apagar «Clínica Janine» com um snapshot vazio no logout.
    return false;
  }

  // Se este owner já é alias, atualizar o mesmo slot sem duplicar os bytes.
  map[previous?.ownerId || ownerId] = { savedAt: Date.now(), keys: bag };
  return writeVaultMap(map);
}

/** Um snapshot por conta; aliases legados divergentes nunca são descartados. */
export function snapshotAccountVaultForOwners(ownerIds = []) {
  if (typeof localStorage === 'undefined') return false;
  const ids = [...new Set((ownerIds || []).filter((id) => typeof id === 'string' && id))];
  if (!ids.length) return false;
  const { bag, useful, projectCount } = collectBag();
  if (!useful && !Object.keys(bag).length) return false;
  const map = readVaultMap();
  const primary = ids.find((id) => id.startsWith('email:')) || ids[0];
  const previous = resolveSlot(map, primary);
  if (projectCount < libraryCountFromBag(previous?.slot.keys[SK.library])) return false;

  // Manter um slot canônico existente preserva os pointers de aliases que
  // podem não estar presentes nesta sessão (ex.: login sem customerId).
  const canonical = previous?.ownerId || primary;
  map[canonical] = { savedAt: Date.now(), keys: bag };
  for (const id of ids) {
    if (id === canonical) continue;
    const existing = resolveSlot(map, id);
    if (!existing || sameBag(existing.slot.keys, bag)
      || (previous && sameBag(existing.slot.keys, previous.slot.keys))) {
      map[id] = { aliasOf: canonical };
    }
  }
  return writeVaultMap(map);
}

function applySlot(slot) {
  if (!slot?.keys || typeof slot.keys !== 'object') return false;
  // O caller recarrega quando devolvemos true. Marcas sozinhas, ou biblioteca
  // vazia/inválida, fariam o próximo boot restaurar e recarregar sem fim.
  if (!libraryCountFromBag(slot.keys[SK.library])) return false;
  const writes = SNAPSHOT_KEYS.map((key) => [key, slot.keys[key]])
    .filter(([, raw]) => typeof raw === 'string' && raw !== '');
  const changed = [];
  try {
    for (const [key, raw] of writes) {
      const previous = localStorage.getItem(key);
      if (previous === raw) continue;
      localStorage.setItem(key, raw);
      changed.push([key, previous]);
    }
    if (!writes.every(([key, raw]) => localStorage.getItem(key) === raw)) {
      throw new Error('Restauração local incompleta.');
    }
    return true;
  } catch {
    // O slot original fica intacto. Não deixar uma restauração parcial parecer
    // a biblioteca completa; restaurar as chaves anteriores em ordem inversa.
    for (const [key, raw] of changed.reverse()) {
      try {
        if (raw == null) localStorage.removeItem(key);
        else localStorage.setItem(key, raw);
      } catch { /* cofre original preservado para nova tentativa */ }
    }
    return false;
  }
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
    const slot = resolveSlot(map, id)?.slot;
    const count = libraryCountFromBag(slot?.keys?.[SK.library]);
    if (slot && (count > bestCount || (count === bestCount && Number(slot.savedAt || 0) > Number(best?.savedAt || 0)))) {
      bestCount = count;
      best = slot;
    }
  }
  return applySlot(best);
}

export function accountVaultHasProjects(ownerId, aliases = []) {
  if (typeof localStorage === 'undefined') return false;
  const map = readVaultMap();
  const candidates = [...new Set([ownerId, ...(aliases || [])].filter(Boolean))];
  for (const id of candidates) {
    if (libraryCountFromBag(resolveSlot(map, id)?.slot.keys[SK.library]) > 0) return true;
  }
  return false;
}

/** Imagens do cofre também estão em uso, mesmo com outra conta aberta. */
export function getAccountVaultImageIds() {
  const ids = new Set();
  if (typeof localStorage === 'undefined') return ids;
  const map = readVaultMap();
  const visited = new Set();
  const imageKeys = new Set(['bgImageId', 'logoImageId', 'refImageId', 'imageId']);
  for (const ownerId of Object.keys(map)) {
    const resolved = resolveSlot(map, ownerId);
    if (!resolved || visited.has(resolved.ownerId)) continue;
    visited.add(resolved.ownerId);
    for (const key of [SK.library, SK.brands]) {
      let value;
      try { value = JSON.parse(resolved.slot.keys[key] || 'null'); } catch { continue; }
      const pending = [value];
      while (pending.length) {
        const current = pending.pop();
        if (!current || typeof current !== 'object') continue;
        for (const [field, child] of Object.entries(current)) {
          if (imageKeys.has(field) && typeof child === 'string' && child) ids.add(child);
          else if (child && typeof child === 'object') pending.push(child);
        }
      }
    }
  }
  return ids;
}

export { SNAPSHOT_KEYS };
