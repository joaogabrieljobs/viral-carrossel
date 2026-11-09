import { semImagensDeRuntime } from './image-store.js';

/**
 * Remove estado transitório de hidratação/cache sem apagar escolhas reais do
 * projeto. O mesmo snapshot precisa orientar autosave, troca de projeto e sync;
 * caso contrário apenas abrir ou recuperar uma foto muda `updatedAt`.
 */
export function projectContentSnapshot(library) {
  return semImagensDeRuntime(library).map((entry) => {
    if (!entry?.doc) return entry;
    const doc = entry.doc;
    const slides = (doc.slides || []).map((slide) => {
      if (!slide) return slide;
      const next = { ...slide };
      for (const [assetKey, idKey, imageKey, failedKey, errorKey] of [
        ['bgImageAssetId', 'bgImageId', 'bgImage', 'bgImageFailed', 'bgImageError'],
        ['logoImageAssetId', 'logoImageId', 'logoImage', 'logoImageFailed', 'logoImageError'],
        ['refImageAssetId', 'refImageId', 'refImage', 'refImageFailed', 'refImageError'],
      ]) {
        if (!next[assetKey]) continue;
        delete next[idKey];
        delete next[failedKey];
        delete next[errorKey];
        if (typeof next[imageKey] === 'string' && /^(blob:|data:image\/)/.test(next[imageKey])) {
          delete next[imageKey];
        }
      }
      if (Array.isArray(next.imageReferences)) {
        next.imageReferences = next.imageReferences.map((ref) => {
          if (!ref?.assetId) return ref;
          const clean = { ...ref };
          delete clean.imageId;
          delete clean.dataUrl;
          return clean;
        });
      }
      return next;
    });
    const brand = doc.brand ? { ...doc.brand } : doc.brand;
    if (brand?.logoAssetId) {
      delete brand.logoImageId;
      if (typeof brand.logo === 'string' && /^(blob:|data:image\/)/.test(brand.logo)) delete brand.logo;
    }
    const styleKit = doc.styleKit ? { ...doc.styleKit } : doc.styleKit;
    if (styleKit?.logo?.assetId) {
      styleKit.logo = { ...styleKit.logo };
      delete styleKit.logo.imageId;
      delete styleKit.logo.dataUrl;
    }
    if (Array.isArray(styleKit?.refImages)) {
      styleKit.refImages = styleKit.refImages.map((ref) => {
        if (!ref?.assetId) return ref;
        const clean = { ...ref };
        delete clean.imageId;
        delete clean.dataUrl;
        return clean;
      });
    }
    return { ...entry, doc: { ...doc, slides, brand, styleKit } };
  });
}

export function projectCacheFingerprint(entry) {
  if (!entry) return '';
  const { updatedAt: _updatedAt, ...stable } = projectContentSnapshot([entry])[0] || {};
  return JSON.stringify(stable);
}
