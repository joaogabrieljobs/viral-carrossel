import { normalizeStyleKit, MAX_REF_IMAGES } from './style-kit.js';
import { imageGet, imagePut, newImageId, blobParaDataUrl, dataUrlParaBlob, imagemComoDataUrl } from './image-store.js';
import { vcImageFileToStorageDataUrl } from './image-storage.js';

export async function storeProjectReference(file) {
  const dataUrl = await vcImageFileToStorageDataUrl(file);
  const blob = dataUrlParaBlob(dataUrl);
  if (!blob) throw new Error('Não foi possível ler esta imagem.');
  const imageId = newImageId();
  await imagePut(imageId, blob);
  return { id: imageId, imageId, name: file.name || 'Referência' };
}

export async function migrateProjectReferences(kit) {
  const k = normalizeStyleKit(kit);
  const refImages = await Promise.all(k.refImages.map(async r => {
    if (r.imageId || !r.dataUrl) return r;
    const blob = dataUrlParaBlob(r.dataUrl);
    if (!blob) return r;
    const imageId = newImageId();
    await imagePut(imageId, blob);
    const { dataUrl, ...rest } = r;
    return { ...rest, imageId };
  }));
  return { ...k, refImages };
}

export async function exportProjectReferences(kit) {
  const k = normalizeStyleKit(kit);
  return { ...k, refImages: await Promise.all(k.refImages.map(async r => {
    if (!r.imageId) return r;
    const dataUrl = await imagemComoDataUrl(r.imageId);
    if (!dataUrl) throw new Error(`Referência indisponível no backup: ${r.name}`);
    const { imageId, ...rest } = r;
    return { ...rest, dataUrl };
  })) };
}

/** Todas as refs do projeto; uma referência específica do card substitui o moodboard. */
export async function resolveImageReferences(kit, slideRef = null) {
  if (typeof slideRef === 'string' && slideRef.trim()) return [slideRef.trim()];
  return Promise.all(normalizeStyleKit(kit).refImages.slice(0, MAX_REF_IMAGES).map(async r => {
    if (r.dataUrl) return r.dataUrl;
    const entry = await imageGet(r.imageId);
    if (!entry?.blob) throw new Error(`Reenvie a referência “${r.name}”: o arquivo não está neste navegador.`);
    return blobParaDataUrl(entry.blob);
  }));
}
