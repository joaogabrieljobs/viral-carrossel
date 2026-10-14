import { SK } from './storage.js';

export const PROJECT_DELETIONS_FALLBACK_KEY = 'vc_project_deletions_fallback';
let memoryStore;
let memoryByOwner = new Map();

export function mergeDeletedProjectIds(...lists) {
  return [...new Set(lists.flatMap((ids) => Array.isArray(ids) ? ids : [])
    .filter((id) => typeof id === 'string').map((id) => id.trim()).filter(Boolean))].sort();
}

function scope() {
  const store = typeof localStorage === 'undefined' ? null : localStorage;
  if (store !== memoryStore) { memoryStore = store; memoryByOwner = new Map(); }
  let owner = null;
  try { owner = store?.getItem(SK.dataOwner) || null; } catch { /* navegador restrito */ }
  return { store, owner };
}

/** Exclusões confirmadas continuam válidas para cópias antigas da mesma conta. */
export function readDeletedProjectIds() {
  const { store, owner } = scope();
  let local = [];
  let fallback = [];
  try { local = JSON.parse(store?.getItem(SK.libraryDeletedIds) || '[]'); } catch { /* */ }
  try {
    const saved = JSON.parse(sessionStorage.getItem(PROJECT_DELETIONS_FALLBACK_KEY) || 'null');
    if (saved?.owner === owner) fallback = saved.ids;
  } catch { /* */ }
  return mergeDeletedProjectIds(local, fallback, memoryByOwner.get(owner));
}

/** Síncrono antes de remover o card da UI, inclusive quando localStorage está cheio. */
export function rememberDeletedProjectIds(ids = []) {
  const { store, owner } = scope();
  const next = mergeDeletedProjectIds(readDeletedProjectIds(), Array.isArray(ids) ? ids : [ids]);
  memoryByOwner.set(owner, next);
  try { store?.setItem(SK.libraryDeletedIds, JSON.stringify(next)); } catch { /* cofre/sync recebem snapshot */ }
  try { sessionStorage.setItem(PROJECT_DELETIONS_FALLBACK_KEY, JSON.stringify({ owner, ids: next })); } catch { /* memória mantém intenção */ }
  return next;
}
