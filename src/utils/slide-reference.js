import { imageGet, imagePut, newImageId, dataUrlParaBlob, blobParaDataUrl } from './image-store.js';

const referenceUnavailable = () => Object.assign(
  new Error('Reenvie a referência deste card: o arquivo não está disponível neste navegador.'),
  { code: 'slide_reference_unavailable' },
);
const legacyReference = (slide) => typeof slide?.refImage === 'string' ? slide.refImage.trim() : '';

/** Guarda os bytes originais; o documento só recebe o ID após o commit no IndexedDB. */
export async function storeSlideReference(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size || !String(file.type || '').startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem válido para usar como referência.');
  }
  const refImageId = newImageId();
  try {
    await imagePut(refImageId, file);
  } catch {
    throw new Error('Não foi possível guardar a referência neste navegador. Tente novamente; a imagem anterior foi preservada.');
  }
  return { refImageId, refImage: null, refImageAssetId: null };
}

/** Migração do formato antigo/backup, sem apagar a única cópia se o disco falhar. */
export async function importSlideReference(slide) {
  const source = legacyReference(slide);
  if (!source.startsWith('data:image/')) return slide;
  try {
    const blob = dataUrlParaBlob(source);
    if (!blob?.size) return slide;
    const refImageId = slide.refImageId || slide.refImageAssetId || newImageId();
    await imagePut(refImageId, blob);
    return { ...slide, refImageId, refImage: null, refImageFailed: false, refImageError: null };
  } catch {
    return slide;
  }
}

/** Uma referência específica nunca é trocada silenciosamente pelo moodboard. */
export async function resolveSlideReference(slide = {}) {
  const imageId = slide.refImageId || slide.refImageAssetId;
  if (imageId) {
    try {
      const entry = await imageGet(imageId);
      if (entry?.blob) return await blobParaDataUrl(entry.blob);
    } catch { /* A cópia legada abaixo ainda pode estar disponível. */ }
  }
  const source = legacyReference(slide);
  if (source) return source;
  if (imageId || slide.refImageFailed) throw referenceUnavailable();
  return null;
}

/** Backup portátil: embute a referência e não leva IDs específicos deste navegador. */
export async function exportSlideReference(slide) {
  if (!slide || !(slide.refImageId || slide.refImageAssetId || slide.refImage || slide.refImageFailed)) return slide;
  let source = await resolveSlideReference(slide);
  if (source && !source.startsWith('data:image/')) {
    try {
      const response = await fetch(source);
      if (!response.ok) throw referenceUnavailable();
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw referenceUnavailable();
      source = await blobParaDataUrl(blob);
    } catch { throw referenceUnavailable(); }
  }
  if (!source) throw referenceUnavailable();
  const { refImageId, refImageAssetId, refImageFailed, refImageError, ...portable } = slide;
  return { ...portable, refImage: source };
}
