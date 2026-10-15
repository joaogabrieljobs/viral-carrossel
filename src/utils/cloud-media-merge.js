/**
 * Insere apenas mídia que chegou depois do restore dos textos. Edições feitas
 * enquanto o download estava em andamento continuam prevalecendo.
 */
function mergeSlideMedia(current, hydrated) {
  if (!current || !hydrated || current.id !== hydrated.id) return current;
  let next = current;
  const copy = (assetKey, imageKey, idKey, failedKey, errorKey, allowIdOnly = false) => {
    const assetId = current[assetKey];
    if (!assetId || assetId !== hydrated[assetKey] || current[imageKey]
      || (!hydrated[imageKey] && (!allowIdOnly || !hydrated[idKey]))) return;
    next = {
      ...next,
      [imageKey]: hydrated[imageKey],
      // O cache pode estar indisponível; a imagem recebida em memória ainda
      // deve aparecer, sem apagar a referência persistida na nuvem.
      [idKey]: hydrated[idKey] || current[idKey] || null,
      [failedKey]: false,
      [errorKey]: null,
    };
  };
  copy('bgImageAssetId', 'bgImage', 'bgImageId', 'bgImageFailed', 'bgImageError');
  copy('logoImageAssetId', 'logoImage', 'logoImageId', 'logoImageFailed', 'logoImageError');
  copy('refImageAssetId', 'refImage', 'refImageId', 'refImageFailed', 'refImageError', true);
  return next;
}

export function mergeHydratedBrandMedia(current, hydrated) {
  if (!current || !hydrated || current.id !== hydrated.id
    || !current.logoAssetId || current.logoAssetId !== hydrated.logoAssetId
    || current.logo || !hydrated.logo) return current;
  return { ...current, logo: hydrated.logo, logoImageId: hydrated.logoImageId || current.logoImageId || null };
}

function mergeStyleKitMedia(current, hydrated) {
  if (!current || !hydrated) return current;
  let logo = current.logo;
  const incomingLogo = hydrated.logo;
  if (logo?.assetId && logo.assetId === incomingLogo?.assetId
    && !logo.imageId && !logo.dataUrl
    && (incomingLogo.imageId || incomingLogo.dataUrl)) {
    logo = {
      ...logo,
      ...(incomingLogo.imageId ? { imageId: incomingLogo.imageId } : {}),
      ...(incomingLogo.dataUrl ? { dataUrl: incomingLogo.dataUrl } : {}),
    };
  }
  const existingRefs = current.refImages;
  const arrivals = hydrated.refImages;
  let refs = existingRefs;
  if (Array.isArray(existingRefs) && Array.isArray(arrivals)) {
    const byAsset = new Map(arrivals.filter((ref) => ref?.assetId)
      .map((ref) => [ref.assetId, ref]));
    refs = existingRefs.map((ref) => {
      const incoming = ref?.assetId && byAsset.get(ref.assetId);
      if (!incoming || ref.imageId || ref.dataUrl || (!incoming.imageId && !incoming.dataUrl)) return ref;
      return {
        ...ref,
        ...(incoming.imageId ? { imageId: incoming.imageId } : {}),
        ...(incoming.dataUrl ? { dataUrl: incoming.dataUrl } : {}),
      };
    });
  }
  if (logo === current.logo && (!refs || refs.every((ref, index) => ref === existingRefs[index]))) return current;
  return { ...current, ...(logo !== current.logo ? { logo } : {}), refImages: refs };
}

export function mergeHydratedProjectMedia(current, hydrated) {
  if (!current || !hydrated || current.id !== hydrated.id) return current;
  const existing = current.doc?.slides;
  const arrivals = hydrated.doc?.slides;
  if (!Array.isArray(existing) || !Array.isArray(arrivals)) return current;
  const mediaBySlide = new Map(arrivals.map((slide) => [slide?.id, slide]));
  const slides = existing.map((slide) => mergeSlideMedia(slide, mediaBySlide.get(slide?.id)));
  const brand = mergeHydratedBrandMedia(current.doc.brand, hydrated.doc?.brand);
  const styleKit = mergeStyleKitMedia(current.doc.styleKit, hydrated.doc?.styleKit);
  if (slides.every((slide, index) => slide === existing[index])
    && brand === current.doc.brand && styleKit === current.doc.styleKit) return current;
  return { ...current, doc: { ...current.doc, slides, brand, styleKit } };
}
