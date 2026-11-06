import { imageGet, imagePut, newImageId, dataUrlParaBlob, blobParaDataUrl } from './image-store.js';

const referenceUnavailable = () => Object.assign(
  new Error('Reenvie a referência deste card: o arquivo não está disponível neste navegador.'),
  { code: 'slide_reference_unavailable' },
);
const legacyReference = (slide) => typeof slide?.refImage === 'string' ? slide.refImage.trim() : '';
export const MAX_SLIDE_IMAGE_REFERENCES = 4;

function validReferenceFile(file) {
  return file && typeof file.arrayBuffer === 'function' && file.size
    && String(file.type || '').startsWith('image/');
}

export function normalizeSlideImageReferences(value) {
  return (Array.isArray(value) ? value : [])
    .filter((ref) => ref && typeof ref === 'object'
      && (ref.imageId || ref.assetId || (typeof ref.dataUrl === 'string' && ref.dataUrl.startsWith('data:image/'))))
    .slice(0, MAX_SLIDE_IMAGE_REFERENCES)
    .map((ref, index) => ({
      id:String(ref.id || ref.imageId || ref.assetId || `inline-${index + 1}`),
      name:String(ref.name || 'Referência').slice(0, 80),
      ...(ref.imageId ? { imageId:String(ref.imageId) } : {}),
      ...(ref.assetId ? { assetId:String(ref.assetId) } : {}),
      ...(typeof ref.dataUrl === 'string' && ref.dataUrl.startsWith('data:image/') ? { dataUrl:ref.dataUrl } : {}),
    }));
}

/** Nova coleção por card: cada item mantém seu próprio ID e nome. */
export async function storeSlideImageReference(file) {
  if (!validReferenceFile(file)) {
    throw new Error('Escolha um arquivo de imagem válido para usar como referência.');
  }
  const imageId = newImageId();
  try {
    await imagePut(imageId, file);
  } catch {
    throw new Error('Não foi possível guardar a referência neste navegador. Tente novamente; as imagens anteriores foram preservadas.');
  }
  return { id:imageId, imageId, name:String(file.name || 'Referência').slice(0, 80) };
}

/** Guarda os bytes originais; o documento só recebe o ID após o commit no IndexedDB. */
export async function storeSlideReference(file) {
  try {
    const stored = await storeSlideImageReference(file);
    return { refImageId:stored.imageId, refImage:null, refImageAssetId:null };
  } catch (error) {
    if (error?.message?.includes('as imagens anteriores foram preservadas')) {
      throw new Error('Não foi possível guardar a referência neste navegador. Tente novamente; a imagem anterior foi preservada.');
    }
    throw error;
  }
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

/** Referência legada + coleção nova, na ordem visível no editor. */
export async function resolveSlideImageReferences(slide = {}) {
  const resolved = [];
  if (slide.refImageId || slide.refImageAssetId || legacyReference(slide) || slide.refImageFailed) {
    resolved.push(await resolveSlideReference(slide));
  }
  const remaining = Math.max(0, MAX_SLIDE_IMAGE_REFERENCES - resolved.length);
  const extras = normalizeSlideImageReferences(slide.imageReferences).slice(0, remaining);
  for (const ref of extras) {
    resolved.push(await resolveSlideReference({
      refImageId:ref.imageId || ref.assetId,
      refImageAssetId:ref.assetId,
      refImage:ref.dataUrl,
    }));
  }
  return resolved.filter(Boolean);
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
