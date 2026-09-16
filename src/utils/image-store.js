/**
 * IndexedDB store para as imagens de fundo dos cards.
 *
 * Porquê: as imagens vinham como data URL dentro do documento, e o documento vive
 * no localStorage (~5 MB por origem). Uma imagem gerada pesa 1–2 MB em base64, logo
 * dois projetos com fotos enchiam a quota — e o caminho de degradação **apagava as
 * imagens** para conseguir gravar o resto ("Imagens de fundo foram omitidas do
 * cache"). Havia perda real de trabalho.
 *
 * Agora o documento guarda só `bgImageId` e os bytes ficam aqui. O campo `bgImage`
 * continua a existir em runtime (object URL), para que todo o código que desenha,
 * exporta ou recorta continue a ler o mesmo sítio.
 *
 * Base separada da dos vídeos de propósito: `video-store.js` abre
 * `viral-carrossel` na versão 1, e subir a versão dessa base para acrescentar um
 * store faria a abertura antiga falhar com VersionError.
 *
 * Schema:
 *   - DB:    viral-carrossel-img
 *   - Store: images
 *   - Key:   imageId (string)
 *   - Value: { id, blob, mime, size, savedAt }
 */

const DB_NAME = 'viral-carrossel-img';
const STORE_NAME = 'images';
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
    req.onerror = () => reject(req.error || new Error('Falha ao abrir a base de imagens.'));
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
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

export function newImageId() {
  return `img_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export async function imagePut(id, blob, meta = {}) {
  if (!id || !blob) throw new Error('imagePut: id e blob obrigatórios.');
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').put({
      id,
      blob,
      mime: meta.mime || blob.type || 'image/png',
      size: blob.size,
      savedAt: Date.now(),
    });
    req.onsuccess = () => resolve(id);
    req.onerror = () => reject(req.error || new Error('Falha ao gravar a imagem.'));
  });
}

export async function imageGet(id) {
  if (!id) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error('Falha ao ler a imagem.'));
  });
}

export async function imageDelete(id) {
  if (!id) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Falha ao apagar a imagem.'));
  });
}

export async function imageListIds() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').getAllKeys();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error('Falha ao listar imagens.'));
  });
}

/** Apaga o que nenhum slide referencia. Corre uma vez por sessão. */
export async function imageCleanupOrphans(keepIds) {
  const keep = new Set((keepIds || []).filter(Boolean));
  const all = await imageListIds();
  const orfas = all.filter((id) => !keep.has(id));
  await Promise.all(orfas.map((id) => imageDelete(id)));
  return orfas.length;
}

export async function imageStorageUsage() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      const totalBytes = all.reduce((n, e) => n + (e.size || 0), 0);
      resolve({ count: all.length, totalBytes, totalMB: totalBytes / (1024 * 1024) });
    };
    req.onerror = () => reject(req.error || new Error('Falha ao calcular o uso.'));
  });
}

/** data URL → Blob (sem rede). */
export function dataUrlParaBlob(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) return null;
  const bin = atob(m[2]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: m[1] || 'image/png' });
}

export function blobParaDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = () => reject(fr.error || new Error('Falha ao ler a imagem.'));
    fr.readAsDataURL(blob);
  });
}

/** Qualquer origem (data URL, blob URL, http, Blob/File) → Blob. */
export async function origemParaBlob(src) {
  if (!src) return null;
  if (typeof src !== 'string') return src instanceof Blob ? src : null;
  if (src.startsWith('data:')) return dataUrlParaBlob(src);
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Falha ao obter a imagem (HTTP ${res.status}).`);
  return res.blob();
}

/**
 * Guarda a imagem e devolve o patch a aplicar no slide.
 * `bgImage` é o object URL (runtime) e `bgImageId` é o que fica no documento.
 * Se o IndexedDB não estiver disponível, devolve a origem como estava — o app
 * continua a funcionar, só sem o benefício de espaço.
 */
export async function guardarImagemDoSlide(src, meta = {}) {
  const blob = await origemParaBlob(src);
  if (!blob) return { bgImage: null, bgImageId: null };
  try {
    const id = meta.id || newImageId();
    await imagePut(id, blob, meta);
    return { bgImage: URL.createObjectURL(blob), bgImageId: id };
  } catch (e) {
    console.warn('[image-store] sem IndexedDB, imagem fica só em memória:', e?.message || e);
    return { bgImage: typeof src === 'string' ? src : URL.createObjectURL(blob), bgImageId: null };
  }
}

/** Para exportar backup: devolve a imagem embutida em data URL. */
export async function imagemComoDataUrl(id) {
  const entry = await imageGet(id);
  if (!entry?.blob) return null;
  return blobParaDataUrl(entry.blob);
}

/** Ids referenciados por uma biblioteca de projetos. */
export function idsDeImagemEmUso(library) {
  return [...new Set((library || []).flatMap((e) => (e?.doc?.slides || []).map((s) => s?.bgImageId).filter(Boolean)))];
}

/**
 * Remove do objeto a gravar tudo o que é runtime ou pesado: o `bgImage` sai
 * quando já existe `bgImageId`, e qualquer object URL sai sempre (não sobrevive
 * ao reload). É isto que mantém o localStorage pequeno.
 */
export function semImagensDeRuntime(library) {
  if (!Array.isArray(library)) return library;
  return library.map((entry) => {
    const slides = entry?.doc?.slides;
    if (!Array.isArray(slides)) return entry;
    let mudou = false;
    const novos = slides.map((s) => {
      if (!s || typeof s !== 'object') return s;
      const bg = typeof s.bgImage === 'string' ? s.bgImage : '';
      const ehRuntime = bg.startsWith('blob:');
      const jaGuardada = !!s.bgImageId && (bg.startsWith('blob:') || bg.startsWith('data:'));
      if (!ehRuntime && !jaGuardada) return s;
      mudou = true;
      const { bgImage, ...resto } = s;
      return resto;
    });
    if (!mudou) return entry;
    return { ...entry, doc: { ...entry.doc, slides: novos } };
  });
}
