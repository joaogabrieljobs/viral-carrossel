/**
 * IndexedDB store pra vídeos — localStorage não comporta vídeos (limite 5-10 MB
 * vs vídeo de 10s podendo ter 5-50 MB). IndexedDB aceita Blobs nativamente,
 * tem ~50-100 MB+ por origin, e API async não-bloqueante.
 *
 * Schema:
 *   - DB:    viral-carrossel
 *   - Store: videos
 *   - Key:   videoId (string uuid)
 *   - Value: { blob: Blob, mime: string, name: string, size: number, savedAt: number }
 */
import { SK, isAccountDataWriteOwnerCurrent } from './storage.js';

const DB_NAME = 'viral-carrossel';
const STORE_NAME = 'videos';
const DB_VERSION = 1;

let _dbPromise = null;

function activeMediaOwner() {
  try {
    const raw = localStorage.getItem(SK.dataOwner);
    if (!raw) return null;
    try { return JSON.parse(raw) || null; } catch { return raw; }
  } catch { return null; }
}

function activeMediaOwnerAliases() {
  const owner = activeMediaOwner();
  if (!owner) return [];
  try {
    const raw = localStorage.getItem(SK.dataOwnerAliases)
      || sessionStorage.getItem(SK.dataOwnerAliases) || '[]';
    const ids = JSON.parse(raw);
    return [owner, ...(Array.isArray(ids) ? ids : [])];
  } catch { return [owner]; }
}

function legacyVideoReferenced(id) {
  try {
    const library = JSON.parse(localStorage.getItem('vc_library') || '[]');
    return Array.isArray(library) && library.some((entry) =>
      entry?.doc?.slides?.some((slide) => slide?.videoId === id));
  } catch { return false; }
}

function videoBelongsToActiveAccount(entry) {
  if (!entry || !isAccountDataWriteOwnerCurrent()) return false;
  return entry.owner ? activeMediaOwnerAliases().includes(entry.owner) : legacyVideoReferenced(entry.id);
}

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB não disponível neste ambiente.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error('Falha ao abrir IndexedDB.'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
  return _dbPromise;
}

function tx(db, mode) {
  const transaction = db.transaction(STORE_NAME, mode);
  return transaction.objectStore(STORE_NAME);
}

/** Salva um Blob de vídeo com um id único. Substitui se id já existir. */
export async function videoPut(id, blob, meta = {}) {
  if (!id || !blob) throw new Error('videoPut: id e blob obrigatórios.');
  if (!isAccountDataWriteOwnerCurrent()) throw new Error('A conta mudou antes de guardar o vídeo.');
  const owner = activeMediaOwner();
  const db = await openDB();
  if (!isAccountDataWriteOwnerCurrent() || activeMediaOwner() !== owner) {
    throw new Error('A conta mudou antes de guardar o vídeo.');
  }
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite');
    const read = store.get(id);
    read.onsuccess = () => {
      if (read.result && (!read.result.owner || !videoBelongsToActiveAccount(read.result))) {
        reject(new Error('Este ID de vídeo pertence a outra conta.'));
        return;
      }
      if (!isAccountDataWriteOwnerCurrent() || activeMediaOwner() !== owner) {
        reject(new Error('A conta mudou antes de guardar o vídeo.'));
        return;
      }
      const req = store.put({
        id,
        blob,
        mime: meta.mime || blob.type || 'video/mp4',
        name: meta.name || `video-${id}.mp4`,
        size: blob.size,
        savedAt: Date.now(),
        owner,
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Falha ao gravar vídeo.'));
    };
    read.onerror = () => reject(read.error || new Error('Falha ao verificar o ID do vídeo.'));
  });
}

/** Recupera um vídeo por id. Retorna { blob, mime, name, size } ou null. */
export async function videoGet(id) {
  if (!id) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readonly');
    const req = store.get(id);
    req.onsuccess = () => resolve(videoBelongsToActiveAccount(req.result) ? req.result : null);
    req.onerror = () => reject(req.error || new Error('Falha ao ler vídeo.'));
  });
}

/** Remove um vídeo por id. */
export async function videoDelete(id) {
  if (!id) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite');
    const read = store.get(id);
    read.onsuccess = () => {
      if (!videoBelongsToActiveAccount(read.result)) { resolve(); return; }
      const removed = store.delete(id);
      removed.onsuccess = () => resolve();
      removed.onerror = () => reject(removed.error || new Error('Falha ao apagar vídeo.'));
    };
    read.onerror = () => reject(read.error || new Error('Falha ao ler o vídeo antes de apagar.'));
  });
}

/** Apaga a base inteira apenas em limpeza explícita, nunca na troca de conta. */
export async function videoWipeDatabase() {
  try {
    if (_dbPromise) {
      const db = await Promise.race([
        _dbPromise.catch(() => null),
        new Promise((r) => setTimeout(() => r(null), 1_200)),
      ]);
      try { db?.close(); } catch { /* */ }
      _dbPromise = null;
    }
  } catch { /* */ }
  if (typeof indexedDB === 'undefined') return;
  await Promise.race([
    new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    }),
    new Promise((r) => setTimeout(r, 2_500)),
  ]);
}

/** Lista todos os ids guardados — útil pra cleanup de orphans. */
export async function videoListIds() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readonly');
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error('Falha ao listar vídeos.'));
  });
}

/** Apaga vídeos cujos ids não estão na lista de "ainda em uso".
 *  Roda periodicamente pra limpar lixo de slides deletados. */
export async function videoCleanupOrphans(keepIds) {
  const keep = new Set(keepIds);
  const all = await videoListIds();
  const entries = await Promise.all(all.filter((id) => !keep.has(id)).map(videoGet));
  const orphans = entries.filter(Boolean).map((entry) => entry.id);
  await Promise.all(orphans.map((id) => videoDelete(id)));
  return orphans.length;
}

/** Estima uso total em MB — útil pra mostrar pro user "quanto você tá gastando". */
export async function videoStorageUsage() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readonly');
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      const visible = all.filter(videoBelongsToActiveAccount);
      const totalBytes = visible.reduce((sum, e) => sum + (e.size || 0), 0);
      resolve({ count: visible.length, totalBytes, totalMB: totalBytes / (1024 * 1024) });
    };
    req.onerror = () => reject(req.error || new Error('Falha ao calcular uso.'));
  });
}

/** Gera id único pra um vídeo novo. */
export function newVideoId() {
  return 'vid_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// ─── Cache em memória das object URLs (blob:) por videoId ────────────────────
// Estado mutável compartilhado entre o App (que grava) e os componentes de card
// (que leem). Fica atrás de setter/getter porque `import` é read-only: atribuir
// direto ao binding importado é erro de build.
let _videoUrlMap = {};

export function setVideoUrlMap(next) {
  _videoUrlMap = next || {};
}

export function getVideoUrl(videoId) {
  return videoId && isAccountDataWriteOwnerCurrent() ? _videoUrlMap[videoId] || null : null;
}
