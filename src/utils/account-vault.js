/**
 * Cofre local por conta: projetos/marcas sobrevivem a «Sair da conta» no mesmo
 * browser. O isolamento entre contas mantém-se — cada ownerId tem o seu slot.
 *
 * É uma proteção local; o sync da conta restaura projetos em outro dispositivo.
 */
import { SK } from './storage.js';
import { USER_PROFILE_KEY } from './user-profile.js';
import { updateDurableVault } from './account-vault-store.js';
import { imageGet, imagePut, newImageId, origemParaBlob, blobParaDataUrl } from './image-store.js';

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

function readLegacyVaultMap() {
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

/** Exclusões são intenção durável, não uma fila descartável após o push. */
function deletedIdsFromBag(bag) {
  try {
    const parsed = JSON.parse(bag?.[SK.libraryDeletedIds] || '[]');
    return Array.isArray(parsed)
      ? [...new Set(parsed.map((id) => String(id || '').trim()).filter(Boolean))] : [];
  } catch { return []; }
}

function applyDeletedProjects(bag, ...previousBags) {
  const deletedIds = new Set([bag, ...previousBags].flatMap(deletedIdsFromBag));
  if (!deletedIds.size) return bag;
  const next = { ...bag, [SK.libraryDeletedIds]: JSON.stringify([...deletedIds]) };
  try {
    const library = JSON.parse(next[SK.library] || 'null');
    if (Array.isArray(library)) {
      const kept = library.filter((entry) => !deletedIds.has(String(entry?.id)));
      next[SK.library] = JSON.stringify(kept);
      const activeId = JSON.parse(next[SK.activeDocId] || 'null');
      if (deletedIds.has(String(activeId))) next[SK.activeDocId] = JSON.stringify(kept[0]?.id || null);
    }
  } catch { /* conteúdo inválido continua intacto para recuperação */ }
  return next;
}

/** Tombstones activos só pertencem a esta conta se o owner foi confirmado. */
function activeDeletionBagForOwners(ownerIds) {
  try {
    const rawOwner = localStorage.getItem(SK.dataOwner);
    let owner;
    try { owner = JSON.parse(rawOwner); } catch { owner = rawOwner; }
    if (!ownerIds.includes(owner)) return {};
    return { [SK.libraryDeletedIds]: localStorage.getItem(SK.libraryDeletedIds) || '[]' };
  } catch { return {}; }
}

/** Históricos nunca restauram projetos; exclusões antigas continuam valendo. */
function historicalDeletionBags(map, ownerIds) {
  const owners = new Set(ownerIds);
  for (const ownerId of ownerIds) {
    const canonical = resolveSlot(map, ownerId)?.ownerId;
    if (canonical) owners.add(canonical);
  }
  return Object.entries(map).filter(([key]) => [...owners].some((id) => key.startsWith(`${id}#preserved:`)))
    .map(([, slot]) => ({ [SK.libraryDeletedIds]: slot?.keys?.[SK.libraryDeletedIds] || '[]' }));
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

/** Preserva conflitos de migração sem apagar o slot antigo de outra aba. */
function mergeLegacyMap(current, legacy) {
  const map = { ...current };
  for (const [id, slot] of Object.entries(legacy)) {
    if (!Object.prototype.hasOwnProperty.call(map, id)) { map[id] = slot; continue; }
    if (JSON.stringify(map[id]) === JSON.stringify(slot)) continue;
    const keepLegacy = Number(slot?.savedAt || 0) > Number(map[id]?.savedAt || 0);
    const displaced = keepLegacy ? map[id] : slot;
    let suffix = 0;
    let backup = `${id}#preserved:${displaced?.savedAt || 0}`;
    while (map[backup] && JSON.stringify(map[backup]) !== JSON.stringify(displaced)) {
      suffix += 1;
      backup = `${id}#preserved:${displaced?.savedAt || 0}:${suffix}`;
    }
    map[backup] = displaced;
    const preferred = keepLegacy ? slot : map[id];
    const older = keepLegacy ? map[id] : slot;
    map[id] = preferred?.keys && older?.keys
      ? { ...preferred, keys: mergeExplicitLibrary(preferred.keys, older.keys) } : preferred;
  }
  return map;
}

async function accessVault(change = (map) => ({ map, result: map }), { allowFallback = true } = {}) {
  let legacyRaw = null;
  try { legacyRaw = localStorage.getItem(ACCOUNT_VAULT_KEY); } catch { /* */ }
  const legacy = readLegacyVaultMap();
  try {
    const result = await updateDurableVault((current) => change(mergeLegacyMap(current, legacy)));
    // Nunca apagar uma versão que outra aba atualizou durante a transação.
    if (legacyRaw != null) {
      try {
        if (localStorage.getItem(ACCOUNT_VAULT_KEY) === legacyRaw) localStorage.removeItem(ACCOUNT_VAULT_KEY);
      } catch { /* a cópia extra pode permanecer, sem perder dados */ }
    }
    return result;
  } catch (error) {
    // Uma transação abortada não autoriza sucesso pelo cache antigo.
    if (!error?.vaultUnavailable || !allowFallback) throw error;
    const next = change(readLegacyVaultMap());
    if (next.map && !writeVaultMap(next.map)) throw error;
    return next.result;
  }
}

/**
 * Não guardar object URLs: deixam de existir quando a aba fecha. Para campos
 * conhecidos, confirmar os bytes no image-store antes de remover a origem.
 * Se esse store estiver indisponível, os bytes inline ainda cabem no cofre IDB.
 */
async function durableMedia(value, context = { externalize: true, imageStoreUnavailable: false }) {
  const { externalize } = context;
  if (Array.isArray(value)) return Promise.all(value.map((item) => durableMedia(item, context)));
  if (!value || typeof value !== 'object') return value;
  const next = {};
  for (const [key, child] of Object.entries(value)) next[key] = await durableMedia(child, context);
  const pairs = [['bgImage', 'bgImageId'], ['logoImage', 'logoImageId'], ['refImage', 'refImageId'], ['logo', 'logoImageId'], ['dataUrl', 'imageId']];
  for (const [sourceKey, idKey] of pairs) {
    const source = next[sourceKey];
    if (typeof source !== 'string' || (!source.startsWith('blob:') && !source.startsWith('data:image/'))) continue;
    // IDs de imagens em runtime já confirmados evitam duplicar originais grandes.
    if (source.startsWith('blob:') && next[idKey] && !context.imageStoreUnavailable) {
      try {
        if ((await imageGet(next[idKey]))?.blob) { delete next[sourceKey]; continue; }
      } catch { context.imageStoreUnavailable = true; }
    }
    const blob = await origemParaBlob(source);
    if (!blob) throw new Error('Não foi possível preservar uma imagem em edição.');
    if (sourceKey === 'dataUrl' && !String(blob.type).startsWith('image/')) {
      next[sourceKey] = source.startsWith('blob:') ? await blobParaDataUrl(blob) : source;
      continue; // customTitleFont/customBodyFont precisam continuar com dataUrl.
    }
    if (externalize && !context.imageStoreUnavailable) {
      try {
        const id = newImageId();
        await imagePut(id, blob);
        next[idKey] = id;
        delete next[sourceKey];
        continue;
      } catch { context.imageStoreUnavailable = true; }
    }
    next[sourceKey] = source.startsWith('blob:') ? await blobParaDataUrl(blob) : source;
    // Não deixar um ID antigo vencer os bytes mais recentes na hidratação.
    delete next[idKey];
  }
  // Fontes e outros blobs também precisam sobreviver ao encerramento da aba.
  for (const [key, child] of Object.entries(next)) {
    if (typeof child === 'string' && child.startsWith('blob:')) {
      const blob = await origemParaBlob(child);
      if (!blob) throw new Error('Não foi possível preservar um arquivo em edição.');
      next[key] = await blobParaDataUrl(blob);
    }
  }
  return next;
}

async function snapshotBag(snapshot) {
  let { bag } = collectBag();
  if (snapshot !== undefined) {
    if (!snapshot || !Array.isArray(snapshot.library)) throw new Error('Snapshot de edição inválido.');
    const fields = { library: SK.library, brandRoster: SK.brands, libraryFolders: SK.libraryFolders,
      activeDocId: SK.activeDocId, activeBrandId: SK.activeBrandId };
    for (const [field, key] of Object.entries(fields)) {
      if (Object.prototype.hasOwnProperty.call(snapshot, field)) bag[key] = JSON.stringify(snapshot[field]);
    }
    if (Array.isArray(snapshot.deletedIds)) {
      bag = applyDeletedProjects(bag, { [SK.libraryDeletedIds]: JSON.stringify(snapshot.deletedIds) });
    }
  }
  bag = applyDeletedProjects(bag);
  const mediaContext = { externalize: true, imageStoreUnavailable: false };
  for (const key of [SK.library, SK.brands]) {
    if (bag[key]) bag[key] = JSON.stringify(await durableMedia(JSON.parse(bag[key]), mediaContext));
  }
  return { bag, projectCount: libraryCountFromBag(bag[SK.library]) };
}

/** A edição React atual prevalece, mas uma biblioteca parcial não apaga o cofre. */
function mergeExplicitLibrary(bag, previousKeys) {
  const mergedBag = applyDeletedProjects(bag, previousKeys);
  if (!previousKeys?.[SK.library]) return mergedBag;
  let previous;
  let incoming;
  try {
    previous = JSON.parse(previousKeys[SK.library]);
    incoming = JSON.parse(mergedBag[SK.library]);
  } catch { return mergedBag; }
  if (!Array.isArray(previous) || !Array.isArray(incoming)) return mergedBag;
  const ids = new Set(incoming.map((item) => item?.id).filter(Boolean));
  const merged = [...incoming, ...previous.filter((item) => !item?.id || !ids.has(item.id))];
  return applyDeletedProjects({ ...mergedBag, [SK.library]: JSON.stringify(merged) });
}

/** Guarda a edição atual; não confirma uma cópia stale do localStorage. */
export async function snapshotAccountVault(ownerId, options = {}) {
  return snapshotAccountVaultForOwners([ownerId], options);
}

/** Um snapshot por conta; aliases legados divergentes nunca são descartados. */
export async function snapshotAccountVaultForOwners(ownerIds = [], { snapshot } = {}) {
  if (typeof localStorage === 'undefined') return false;
  const ids = [...new Set((ownerIds || []).filter((id) => typeof id === 'string' && id))];
  if (!ids.length) return false;
  try {
    const { bag } = await snapshotBag(snapshot);
    if (!Object.keys(bag).length) return false;
    return await accessVault((map) => {
      const primary = ids.find((id) => id.startsWith('email:')) || ids[0];
      const previous = resolveSlot(map, primary);
      const previousAliases = ids.map((id) => ({ id, resolved: resolveSlot(map, id) }))
        .filter((entry) => entry.resolved);
      let savedBag = applyDeletedProjects(bag, ...previousAliases.map((entry) => entry.resolved.slot.keys),
        ...historicalDeletionBags(map, ids));
      const previousAlive = applyDeletedProjects(previous?.slot.keys || {}, savedBag);
      if (snapshot === undefined && libraryCountFromBag(savedBag[SK.library]) < libraryCountFromBag(previousAlive[SK.library])) {
        // A trava anti-wipe protege projetos ausentes, mas não pode descartar
        // exclusões já confirmadas enquanto recusa um snapshot incompleto.
        for (const entry of previousAliases) {
          const { ownerId, slot } = entry.resolved;
          map[ownerId] = { ...slot, keys: applyDeletedProjects(slot.keys, savedBag) };
        }
        return { map, result: false };
      }
      if (snapshot !== undefined) {
        // Os aliases autenticados são uma só conta. Um slot antigo maior não
        // pode vencer o snapshot recém-salvo apenas por ter mais projetos.
        const ordered = [...previousAliases].sort((a, b) => Number(b.resolved.slot.savedAt || 0) - Number(a.resolved.slot.savedAt || 0));
        for (const entry of ordered) savedBag = mergeExplicitLibrary(savedBag, entry.resolved.slot.keys);
      }
      const canonical = previous?.ownerId || primary;
      map[canonical] = { savedAt: Date.now(), keys: savedBag };
      for (const id of ids) {
        if (id === canonical) continue;
        if (snapshot !== undefined) {
          const old = previousAliases.find((entry) => entry.id === id)?.resolved;
          if (old && old.ownerId !== canonical && !sameBag(old.slot.keys, savedBag)) {
            let backup = `${id}#preserved:${old.slot.savedAt || 0}`;
            let suffix = 0;
            while (map[backup] && JSON.stringify(map[backup]) !== JSON.stringify(old.slot)) {
              suffix += 1; backup = `${id}#preserved:${old.slot.savedAt || 0}:${suffix}`;
            }
            map[backup] = old.slot;
          }
          map[id] = { aliasOf: canonical };
          continue;
        }
        const existing = resolveSlot(map, id);
        if (!existing || sameBag(existing.slot.keys, bag)
          || (previous && sameBag(existing.slot.keys, previous.slot.keys))) map[id] = { aliasOf: canonical };
      }
      return { map, result: true };
    });
  } catch { return false; }
}

function assertRestoreCurrent(isCurrent) {
  if (typeof isCurrent !== 'function' || isCurrent()) return;
  throw Object.assign(new Error('A conta mudou durante a restauração. Entre novamente para continuar.'), {
    code: 'ACCOUNT_VAULT_OWNER_CHANGED',
  });
}

async function applySlot(slot, { onRestored, isCurrent } = {}) {
  assertRestoreCurrent(isCurrent);
  if (!slot?.keys || typeof slot.keys !== 'object') return false;
  // Uma lista esvaziada por exclusões ainda tem intenção a restaurar.
  // Slots apenas de marcas permanecem sem provocar reload.
  const emptyWithDeletes = slot.keys[SK.library] === '[]' && deletedIdsFromBag(slot.keys).length > 0;
  if (!libraryCountFromBag(slot.keys[SK.library]) && !emptyWithDeletes) return false;
  let keys;
  try {
    keys = { ...slot.keys };
    const mediaContext = { externalize: true, imageStoreUnavailable: false };
    for (const key of [SK.library, SK.brands]) {
      if (keys[key]) keys[key] = JSON.stringify(await durableMedia(JSON.parse(keys[key]), mediaContext));
      assertRestoreCurrent(isCurrent);
    }
    if (keys[SK.libraryCloudMeta]) {
      const meta = JSON.parse(keys[SK.libraryCloudMeta]);
      if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
        // Só será confirmado após TODAS as chaves terem sido restauradas.
        // Manter false faria o boot importar a nuvem antiga sobre esta edição.
        keys[SK.libraryCloudMeta] = JSON.stringify({ ...meta, localPersisted: true });
      }
    }
  } catch (error) {
    if (error?.code === 'ACCOUNT_VAULT_OWNER_CHANGED') throw error;
    return false;
  }
  assertRestoreCurrent(isCurrent);
  const writes = SNAPSHOT_KEYS.map((key) => [key, keys[key]])
    .filter(([, raw]) => typeof raw === 'string' && raw !== '');
  const changed = [];
  let localPersisted = false;
  try {
    for (const [key, raw] of writes) {
      assertRestoreCurrent(isCurrent);
      const previous = localStorage.getItem(key);
      if (previous === raw) continue;
      localStorage.setItem(key, raw);
      changed.push([key, previous]);
    }
    assertRestoreCurrent(isCurrent);
    if (!writes.every(([key, raw]) => localStorage.getItem(key) === raw)) {
      throw new Error('Restauração local incompleta.');
    }
    localPersisted = true;
  } catch (error) {
    // Outra aba já pode estar gravando B. Não reverter chaves de B com A.
    if (error?.code === 'ACCOUNT_VAULT_OWNER_CHANGED') throw error;
    assertRestoreCurrent(isCurrent);
    // O slot original fica intacto. Não deixar uma restauração parcial parecer
    // a biblioteca completa; restaurar as chaves anteriores em ordem inversa.
    for (const [key, raw] of changed.reverse()) {
      try {
        if (raw == null) localStorage.removeItem(key);
        else localStorage.setItem(key, raw);
      } catch { /* cofre original preservado para nova tentativa */ }
    }
  }
  assertRestoreCurrent(isCurrent);
  if (typeof onRestored !== 'function') return localPersisted && !emptyWithDeletes;
  try {
    const read = (key, fallback) => keys[key] ? JSON.parse(keys[key]) : fallback;
    const snapshot = { library: read(SK.library, []), brandRoster: read(SK.brands, []),
      libraryFolders: read(SK.libraryFolders, []), activeDocId: read(SK.activeDocId, null),
      activeBrandId: read(SK.activeBrandId, null), deletedIds: deletedIdsFromBag(keys) };
    assertRestoreCurrent(isCurrent);
    await onRestored(snapshot, { projectCount: snapshot.library.length, localPersisted });
    assertRestoreCurrent(isCurrent);
    return true;
  } catch (error) {
    if (error?.code === 'ACCOUNT_VAULT_OWNER_CHANGED') throw error;
    return false;
  }
}

/**
 * Restaura o melhor slot entre ownerId e aliases (email: ↔ id:cus).
 */
export async function restoreAccountVault(ownerId, aliases = [], { onRestored, isCurrent } = {}) {
  assertRestoreCurrent(isCurrent);
  if (typeof localStorage === 'undefined') return false;
  let map;
  try { map = await accessVault(); } catch { map = readLegacyVaultMap(); }
  assertRestoreCurrent(isCurrent);
  const candidates = [...new Set([ownerId, ...(aliases || [])].filter(Boolean))];
  const slots = candidates.map((id) => resolveSlot(map, id)?.slot).filter(Boolean);
  const deletionBags = [...slots.map((slot) => slot.keys), activeDeletionBagForOwners(candidates),
    ...historicalDeletionBags(map, candidates)];
  let best = null;
  let bestCount = -1;
  for (const slot of slots) {
    const keys = applyDeletedProjects(slot.keys, ...deletionBags);
    const count = libraryCountFromBag(keys[SK.library]);
    if (count > bestCount || (count === bestCount && Number(slot.savedAt || 0) > Number(best?.savedAt || 0))) {
      bestCount = count;
      best = { ...slot, keys };
    }
  }
  return applySlot(best, { onRestored, isCurrent });
}

export async function accountVaultHasProjects(ownerId, aliases = []) {
  if (typeof localStorage === 'undefined') return false;
  let map;
  try { map = await accessVault(); } catch { map = readLegacyVaultMap(); }
  const candidates = [...new Set([ownerId, ...(aliases || [])].filter(Boolean))];
  const slots = candidates.map((id) => resolveSlot(map, id)?.slot).filter(Boolean);
  const deletionBags = [...slots.map((slot) => slot.keys), activeDeletionBagForOwners(candidates),
    ...historicalDeletionBags(map, candidates)];
  return slots.some((slot) => libraryCountFromBag(applyDeletedProjects(slot.keys, ...deletionBags)[SK.library]) > 0);
}

/** Imagens do cofre também estão em uso, mesmo com outra conta aberta. */
export async function getAccountVaultImageIds() {
  const ids = new Set();
  if (typeof localStorage === 'undefined') return ids;
  // Se o cofre durável não puder ser lido, abortar o GC é mais seguro do que
  // tratar imagens de outra conta como órfãs. Sem IDB, só existe o legado.
  const map = await accessVault(undefined, { allowFallback: typeof indexedDB === 'undefined' });
  const visited = new Set();
  const imageKeys = new Set(['bgImageId', 'logoImageId', 'refImageId', 'imageId', 'refImageAssetId', 'assetId']);
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
