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

export function mergeHydratedProjectMedia(current, hydrated) {
  if (!current || !hydrated || current.id !== hydrated.id) return current;
  const existing = current.doc?.slides;
  const arrivals = hydrated.doc?.slides;
  if (!Array.isArray(existing) || !Array.isArray(arrivals)) return current;
  const mediaBySlide = new Map(arrivals.map((slide) => [slide?.id, slide]));
  const slides = existing.map((slide) => mergeSlideMedia(slide, mediaBySlide.get(slide?.id)));
  const brand = mergeHydratedBrandMedia(current.doc.brand, hydrated.doc?.brand);
  if (slides.every((slide, index) => slide === existing[index]) && brand === current.doc.brand) return current;
  return { ...current, doc: { ...current.doc, slides, brand } };
}
