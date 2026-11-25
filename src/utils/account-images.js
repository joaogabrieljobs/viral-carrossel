/**
 * Galeria "Imagens" (QA 24/11, editor 4).
 *
 * A galeria listava só imagem de IA cujos bytes estavam neste navegador. Em
 * outro aparelho os projetos chegam da conta com `bgImageAssetId` e sem os
 * bytes, e a galeria ficava vazia. Aqui a lista sai dos cards de todos os
 * projetos da biblioteca e os bytes vêm sob demanda: primeiro deste navegador,
 * depois da conta, pelo mesmo caminho que a abertura do projeto usa.
 */
import { imageGet, origemParaBlob } from './image-store.js';

/** Imagens de IA ligadas aos cards, com ou sem os bytes neste navegador. */
export function accountAiImageRefs(library) {
  const seen = new Set();
  const refs = [];
  for (const entry of (Array.isArray(library) ? library : [])) {
    const slides = Array.isArray(entry?.doc?.slides) ? entry.doc.slides : [];
    slides.forEach((slide, index) => {
      if (slide?.bgImageSource !== 'ai') return;
      const imageId = slide.bgImageId || null;
      const assetId = slide.bgImageAssetId || null;
      if (!imageId && !assetId) return;
      if ((imageId && seen.has(imageId)) || (assetId && seen.has(assetId))) return;
      if (imageId) seen.add(imageId);
      if (assetId) seen.add(assetId);
      refs.push({
        key: assetId || imageId,
        imageId,
        assetId,
        docId: entry.id,
        docName: entry.name || 'Sem título',
        slideId: slide.id,
        cardNum: index + 1,
        atualizado: entry.updatedAt || entry.createdAt || 0,
      });
    });
  }
  return refs.sort((a, b) => b.atualizado - a.atualizado);
}

/** Baixa uma imagem da conta com a hidratação que a abertura do projeto usa. */
export async function fetchImageFromAccount(ref, { signal } = {}) {
  const { hydrateProjectEntryFromCloud } = await import('./library-sync.js');
  const { entry } = await hydrateProjectEntryFromCloud({
    id: ref.docId,
    doc: { slides: [{ id: ref.slideId || ref.key, bgImageAssetId: ref.assetId }] },
  }, { signal });
  const photo = entry?.doc?.slides?.[0]?.bgImage;
  if (!photo) return null;
  try { return await origemParaBlob(photo); }
  finally { if (photo.startsWith('blob:')) URL.revokeObjectURL(photo); }
}

function loadError(code) {
  const error = new Error('Não foi possível carregar esta imagem.');
  error.code = code;
  return error;
}

/** Bytes de uma imagem: os deste navegador primeiro; a conta só quando faltam. */
export async function loadAccountImage(ref, {
  getLocal = imageGet, fetchFromAccount = fetchImageFromAccount, signal,
} = {}) {
  // A hidratação guarda a imagem baixada com o próprio assetId.
  for (const id of [ref?.imageId, ref?.assetId].filter(Boolean)) {
    try {
      const entry = await getLocal(id);
      if (entry?.blob) return { blob: entry.blob, mime: entry.mime || entry.blob.type, source: 'local' };
    } catch { /* armazenamento local indisponível: tenta a conta */ }
  }
  if (!ref?.assetId) throw loadError('image_missing');
  let blob = null;
  try { blob = await fetchFromAccount(ref, { signal }); }
  catch { throw loadError('download_failed'); }
  if (!blob) throw loadError('download_failed');
  return { blob, mime: blob.type, source: 'account' };
}

/** Fila que roda no máximo `limit` tarefas ao mesmo tempo. */
export function createLoadQueue(limit = 2) {
  const waiting = [];
  let running = 0;
  const next = () => {
    if (running >= limit || !waiting.length) return;
    running += 1;
    const { task, resolve, reject } = waiting.shift();
    Promise.resolve().then(task).then(resolve, reject).finally(() => {
      running -= 1;
      next();
    });
  };
  return (task) => new Promise((resolve, reject) => {
    waiting.push({ task, resolve, reject });
    next();
  });
}
