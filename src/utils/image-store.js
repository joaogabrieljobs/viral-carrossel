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
 *   - Value: { id, blob, mime, size, savedAt, owner }
 */

import { SK, isAccountDataWriteOwnerCurrent } from './storage.js';

const DB_NAME = 'viral-carrossel-img';
const STORE_NAME = 'images';
const DB_VERSION = 1;
/** open/wipe nunca podem pendurar o logout nem o spinner do card. */
const IDB_OPEN_TIMEOUT_MS = 8_000;
const IDB_PUT_TIMEOUT_MS = 8_000;
const IDB_GET_TIMEOUT_MS = 8_000;
// Depois de uma abertura que não respondeu, não fazer todos os cards esperar
// mais 8 s cada um. A próxima tentativa real continua possível em 3 s.
const IDB_TIMEOUT_RETRY_MS = 3_000;
const IDB_WIPE_TIMEOUT_MS = 2_500;

let _dbPromise = null;
let _dbRetryAfter = 0;
let _dbRetryError = null;

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

// Arquivos anteriores à separação por conta não têm owner. Só continuam
// visíveis se a biblioteca ativa desta conta realmente os referencia.
function legacyImageReferenced(id) {
  try {
    const library = JSON.parse(localStorage.getItem('vc_library') || '[]');
    const brands = JSON.parse(localStorage.getItem('vc_brands') || '[]');
    return idsDeImagemEmUso(library, brands).includes(id);
  } catch { return false; }
}

function imageBelongsToActiveAccount(entry) {
  if (!entry || !isAccountDataWriteOwnerCurrent()) return false;
  return entry.owner ? activeMediaOwnerAliases().includes(entry.owner) : legacyImageReferenced(entry.id);
}

function openDB() {
  if (_dbPromise) return _dbPromise;
  if (_dbRetryAfter > Date.now()) return Promise.reject(_dbRetryError);
  let resolveOpen;
  let rejectOpen;
  const pending = new Promise((resolve, reject) => { resolveOpen = resolve; rejectOpen = reject; });
  _dbPromise = pending;
  let settled = false;
  const resetCurrent = () => { if (_dbPromise === pending) _dbPromise = null; };
  const fail = (error, retryAfterMs = 0) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    _dbRetryAfter = retryAfterMs ? Date.now() + retryAfterMs : 0;
    _dbRetryError = retryAfterMs ? error : null;
    resetCurrent();
    rejectOpen(error);
  };
  const timer = setTimeout(() => fail(
    new Error('O armazenamento de imagens não respondeu. Tente novamente.'),
    IDB_TIMEOUT_RETRY_MS,
  ), IDB_OPEN_TIMEOUT_MS);
  try {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB não disponível neste ambiente.');
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => fail(req.error || new Error('Falha ao abrir a base de imagens.'));
    req.onsuccess = () => {
      const db = req.result;
      // Uma abertura não pode ser cancelada pelo browser. Se ela chegou após
      // timeout, bloqueio ou logout, fechar a conexão para não prender a fila.
      if (settled || _dbPromise !== pending) {
        try { db.close(); } catch { /* já fechada */ }
        fail(new Error('A abertura do armazenamento foi interrompida. Tente novamente.'));
        return;
      }
      settled = true;
      clearTimeout(timer);
      _dbRetryAfter = 0;
      _dbRetryError = null;
      db.onversionchange = () => {
        resetCurrent();
        db.close();
      };
      db.onclose = resetCurrent;
      resolveOpen(db);
    };
    req.onupgradeneeded = (e) => {
      if (settled || _dbPromise !== pending) {
        try { e.target.transaction?.abort(); } catch { /* encerrada */ }
        return;
      }
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    // Alguns browsers nunca disparam success/error se a origem está em limbo.
    req.onblocked = () => fail(new Error('O armazenamento está ocupado em outra aba. Tente novamente.'));
  } catch (error) { fail(error); }
  return pending;
}

function tx(db, mode) {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

export function newImageId() {
  return `img_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export async function imagePut(id, blob, meta = {}) {
  if (!id || !blob) throw new Error('imagePut: id e blob obrigatórios.');
  if (!isAccountDataWriteOwnerCurrent()) throw new Error('A conta mudou antes de guardar a imagem.');
  const owner = activeMediaOwner();
  const db = await openDB();
  if (!isAccountDataWriteOwnerCurrent() || activeMediaOwner() !== owner) {
    throw new Error('A conta mudou antes de guardar a imagem.');
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    let settled = false;
    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(id);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      // Um IndexedDB em limbo pode deixar a transação sem complete/abort.
      // Desbloquear a hidratação; o chamador mantém a foto como object URL.
      finish(new Error('O armazenamento não concluiu a gravação da imagem. Tente novamente.'));
      try { transaction.abort(); } catch { /* a transação já pode estar encerrada */ }
    }, IDB_PUT_TIMEOUT_MS);
    let read;
    try { read = store.get(id); }
    catch (error) { finish(error); return; }
    read.onsuccess = () => {
      if (settled) return;
      // IDs antigos e hashes de assets da nuvem podem coincidir entre contas.
      // Nunca tomar posse do blob de outra conta ao importar a mesma chave.
      if (read.result && (!read.result.owner || !imageBelongsToActiveAccount(read.result))) {
        finish(Object.assign(new Error('Este ID de imagem pertence a outra conta.'), { code: 'MEDIA_OWNER_CONFLICT' }));
        return;
      }
      if (!isAccountDataWriteOwnerCurrent() || activeMediaOwner() !== owner) {
        finish(new Error('A conta mudou antes de guardar a imagem.'));
        return;
      }
      try {
        const req = store.put({
          id,
          blob,
          mime: meta.mime || blob.type || 'image/png',
          size: blob.size,
          savedAt: Date.now(),
          owner,
        });
        req.onerror = () => finish(req.error || new Error('Falha ao gravar a imagem.'));
      } catch (error) { finish(error); }
    };
    read.onerror = () => finish(read.error || new Error('Falha ao verificar o ID da imagem.'));
    transaction.oncomplete = () => finish();
    transaction.onabort = () => finish(transaction.error || new Error('Gravação da imagem interrompida.'));
  });
}

export async function imageGet(id) {
  if (!id) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let transaction;
    let req;
    try {
      transaction = db.transaction(STORE_NAME, 'readonly');
      req = transaction.objectStore(STORE_NAME).get(id);
    } catch (error) { reject(error); return; }
    let settled = false;
    const finish = (error = null, entry = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(entry);
    };
    const timer = setTimeout(() => {
      // Há browsers que abrem a base, mas deixam uma transação readonly sem
      // success/error/abort. Não prender o restore inteiro à espera dela.
      finish(new Error('O armazenamento não concluiu a leitura da imagem. Tente novamente.'));
      try { transaction.abort(); } catch { /* a transação já pode estar encerrada */ }
    }, IDB_GET_TIMEOUT_MS);
    req.onsuccess = () => {
      if (settled) return;
      try { finish(null, imageBelongsToActiveAccount(req.result) ? req.result : null); }
      catch (error) { finish(error); }
    };
    req.onerror = () => finish(req.error || new Error('Falha ao ler a imagem.'));
    transaction.onabort = () => finish(transaction.error || new Error('Leitura da imagem interrompida.'));
  });
}

export async function imageDelete(id) {
  if (!id) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite');
    const read = store.get(id);
    read.onsuccess = () => {
      if (!imageBelongsToActiveAccount(read.result)) { resolve(); return; }
      const removed = store.delete(id);
      removed.onsuccess = () => resolve();
      removed.onerror = () => reject(removed.error || new Error('Falha ao apagar a imagem.'));
    };
    read.onerror = () => reject(read.error || new Error('Falha ao ler a imagem antes de apagar.'));
  });
}

/** Apaga a base inteira apenas em limpeza explícita, nunca na troca de conta. */
export async function imageWipeDatabase() {
  try {
    if (_dbPromise) {
      const db = await Promise.race([
        _dbPromise.catch(() => null),
        new Promise((r) => setTimeout(() => r(null), 1_200)),
      ]);
      try { db?.close(); } catch { /* */ }
    }
  } catch { /* */ }
  _dbPromise = null;
  _dbRetryAfter = 0;
  _dbRetryError = null;
  if (typeof indexedDB === 'undefined') return;
  await Promise.race([
    new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      // blocked: outra aba ainda tem a DB — não ficar à espera eternamente
      req.onblocked = () => resolve();
    }),
    new Promise((r) => setTimeout(r, IDB_WIPE_TIMEOUT_MS)),
  ]);
  _dbPromise = null;
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
export async function imageCleanupOrphans(keepIds, { graceMs = 5 * 60_000 } = {}) {
  const keep = new Set((keepIds || []).filter(Boolean));
  const all = await imageListIds();
  // Uploads/imports recentes ainda podem não ter chegado ao autosave (FE-011).
  const grace = Math.max(60_000, Number(graceMs) || 0);
  const candidates = await Promise.all(all.filter(id => !keep.has(id)).map(imageGet));
  const orfas = candidates
    .filter(entry => entry && entry.savedAt < Date.now() - grace)
    .map(entry => entry.id);
  await Promise.all(orfas.map((id) => imageDelete(id)));
  return orfas.length;
}

export async function imageStorageUsage() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      const visible = all.filter(imageBelongsToActiveAccount);
      const totalBytes = visible.reduce((n, e) => n + (e.size || 0), 0);
      resolve({ count: visible.length, totalBytes, totalMB: totalBytes / (1024 * 1024) });
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
    let id = meta.id || newImageId();
    try { await imagePut(id, blob, meta); }
    catch (error) {
      if (error?.code !== 'MEDIA_OWNER_CONFLICT') throw error;
      id = newImageId();
      await imagePut(id, blob, meta);
    }
    return { bgImage: URL.createObjectURL(blob), bgImageId: id };
  } catch (e) {
    console.warn('[image-store] sem IndexedDB, imagem fica só em memória:', e?.message || e);
    return { bgImage: typeof src === 'string' ? src : URL.createObjectURL(blob), bgImageId: null };
  }
}

/**
 * Aplica resultados assíncronos de migração/hidratação sem sobrescrever uma
 * imagem que o utilizador trocou enquanto o IndexedDB respondia.
 *
 * `expectedImageId` string = hidratação/ausência do registro persistido.
 * `expectedImageId: null` + `expectedSource` = migração de data URL legada.
 */
export function applyPersistedImagePatches(slides = [], patches = []) {
  let changed = false;
  const next = (slides || []).map((slide) => {
    const candidate = patches.find((item) => item?.id === slide?.id);
    if (!candidate) return slide;
    if (candidate.expectedImageId) {
      if (slide.bgImage || slide.bgImageId !== candidate.expectedImageId) return slide;
    } else {
      if (slide.bgImageId) return slide;
      if (candidate.expectedSource != null && slide.bgImage !== candidate.expectedSource) return slide;
    }
    const patch = candidate.patch || {};
    // Repetir o mesmo erro do IndexedDB não é uma nova edição. Preservar
    // a identidade impede hidratação → autosave → sync de reiniciar em loop.
    if (Object.entries(patch).every(([key, value]) => Object.is(slide[key], value))) return slide;
    changed = true;
    return { ...slide, ...patch };
  });
  return changed ? next : slides;
}

/** Identidade estável da foto usada para comparar resultados assíncronos. */
export function slideImageIdentity(slide) {
  if (slide?.bgImageId) return `id:${slide.bgImageId}`;
  if (slide?.bgImage) return `src:${slide.bgImage}`;
  return 'none';
}

/**
 * Aplica uma geração/upload apenas se a foto não mudou durante a operação.
 * Evita que uma resposta atrasada reverta uma substituição ou exclusão recente.
 */
export function applySlidePatchIfImageCurrent(slides = [], {
  id,
  expectedImageIdentity,
  patch,
} = {}) {
  let changed = false;
  const next = (slides || []).map((slide) => {
    if (slide?.id !== id || slideImageIdentity(slide) !== expectedImageIdentity) return slide;
    changed = true;
    return { ...slide, ...(patch || {}) };
  });
  return changed ? next : slides;
}

/** Para exportar backup: devolve a imagem embutida em data URL. */
export async function imagemComoDataUrl(id) {
  const entry = await imageGet(id);
  if (!entry?.blob) return null;
  return blobParaDataUrl(entry.blob);
}

/** Ids referenciados por uma biblioteca de projetos. */
export function idsDeImagemEmUso(library, brands = []) {
  const kitIds = (kit) => [
    ...(kit?.refImages || []).map((ref) => ref?.imageId || ref?.assetId),
    kit?.logo?.imageId || kit?.logo?.assetId,
  ];
  const brandIds = (brand) => [brand?.logoImageId, ...kitIds(brand?.styleKit)];
  return [...new Set([
    ...(library || []).flatMap((e) => [
      ...(e?.doc?.slides || []).flatMap(s => [
        s?.bgImageId,
        s?.bgImageAssetId,
        s?.logoImageId,
        s?.refImageId || s?.refImageAssetId,
      ]),
      ...kitIds(e?.doc?.styleKit),
      ...brandIds(e?.doc?.brand),
    ]),
    ...(brands || []).flatMap(brandIds),
  ].filter(Boolean))];
}

function semLogoDeRuntime(brand) {
  if (!brand || typeof brand !== 'object') return brand;
  const logo = typeof brand.logo === 'string' ? brand.logo : '';
  const imageId = brand.logoImageId || null;
  const runtime = logo.startsWith('blob:');
  const duplicated = !!imageId && logo.startsWith('data:image/');
  if (!runtime && !duplicated) return brand;
  const next = { ...brand };
  delete next.logo;
  if (imageId) next.logoImageId = imageId;
  return next;
}

/** Remove object/data URLs de perfis quando os bytes já vivem no IndexedDB. */
export function semLogosDeRuntimeDasMarcas(brands) {
  if (!Array.isArray(brands)) return brands;
  return brands.map((brand) => semLogoDeRuntime(brand));
}

/**
 * Remove do objeto a gravar tudo o que é runtime ou pesado: o `bgImage` sai
 * quando já existe `bgImageId`, e qualquer object URL sai sempre (não sobrevive
 * ao reload). É isto que mantém o localStorage pequeno.
 */
export function semImagensDeRuntime(library) {
  if (!Array.isArray(library)) return library;
  return library.map((entry) => {
    const doc = entry?.doc;
    if (!doc || typeof doc !== 'object') return entry;
    const slides = Array.isArray(doc.slides) ? doc.slides : [];
    let mudou = false;
    const novos = slides.map((s) => {
      if (!s || typeof s !== 'object') return s;
      const bg = typeof s.bgImage === 'string' ? s.bgImage : '';
      const ehRuntime = bg.startsWith('blob:');
      const jaGuardada = !!s.bgImageId && (bg.startsWith('blob:') || bg.startsWith('data:'));
      const logoRuntime = !!s.logoImageId || String(s.logoImage || '').startsWith('blob:');
      const refRuntime = String(s.refImage || '').startsWith('blob:');
      if (!ehRuntime && !jaGuardada && !logoRuntime && !refRuntime) return s;
      mudou = true;
      const next = { ...s };
      if (ehRuntime || jaGuardada) delete next.bgImage;
      if (logoRuntime) delete next.logoImage;
      // A migração só remove base64 depois de confirmar a gravação. Um ID
      // legado pode estar órfão: não apague a cópia inline só porque ele existe.
      if (refRuntime) delete next.refImage;
      return next;
    });
    const brand = semLogoDeRuntime(doc.brand);
    if (brand !== doc.brand) mudou = true;
    if (!mudou) return entry;
    return { ...entry, doc: { ...doc, slides: novos, brand } };
  });
}
