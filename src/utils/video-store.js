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

const DB_NAME = 'viral-carrossel';
const STORE_NAME = 'videos';
const DB_VERSION = 1;

let _dbPromise = null;

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
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite');
    const req = store.put({
      id,
      blob,
      mime: meta.mime || blob.type || 'video/mp4',
      name: meta.name || `video-${id}.mp4`,
      size: blob.size,
      savedAt: Date.now(),
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Falha ao gravar vídeo.'));
  });
}

/** Recupera um vídeo por id. Retorna { blob, mime, name, size } ou null. */
export async function videoGet(id) {
  if (!id) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readonly');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error('Falha ao ler vídeo.'));
  });
}

/** Remove um vídeo por id. */
export async function videoDelete(id) {
  if (!id) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Falha ao apagar vídeo.'));
  });
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
  const orphans = all.filter((id) => !keep.has(id));
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
      const totalBytes = all.reduce((sum, e) => sum + (e.size || 0), 0);
      resolve({ count: all.length, totalBytes, totalMB: totalBytes / (1024 * 1024) });
    };
    req.onerror = () => reject(req.error || new Error('Falha ao calcular uso.'));
  });
}

/** Gera id único pra um vídeo novo. */
export function newVideoId() {
  return 'vid_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
