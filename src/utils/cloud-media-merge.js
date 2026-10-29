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

const SLIDE_MEDIA_KEYS = [
  ['bgImageAssetId', 'bgImageId', 'bgImage', 'bgImageFailed'],
  ['logoImageAssetId', 'logoImageId', 'logoImage', 'logoImageFailed'],
  ['refImageAssetId', 'refImageId', 'refImage', 'refImageFailed'],
];

/**
 * Uma troca feita pelo editor deixa de apontar para o asset antigo da conta.
 * Um patch de falha (`*Failed: true`, bytes e ID zerados) não é troca: a
 * referência da conta continua válida e permite hidratar de novo da nuvem.
 */
export function clearReplacedSlideAssets(before, after) {
  if (!Array.isArray(after)) return after;
  const previous = new Map((before || []).map((slide) => [slide?.id, slide]));
  return after.map((slide) => {
    const old = previous.get(slide?.id);
    if (!old || !slide) return slide;
    let next = slide;
    for (const [assetKey, idKey, imageKey, failedKey] of SLIDE_MEDIA_KEYS) {
      if (!old[assetKey] || slide[assetKey] !== old[assetKey]
        || (slide[idKey] === old[idKey] && slide[imageKey] === old[imageKey])) continue;
      if (slide[failedKey] === true && !slide[idKey] && !slide[imageKey]) continue;
      next = { ...next, [assetKey]: null };
    }
    return next;
  });
}

/**
 * Depois que a conta confirma um envio, o documento local passa a conhecer o
 * asset de cada foto que subiu. Sem isso, só a nuvem sabia o `assetId`, e um
 * navegador sem os bytes locais salvava o card como foto perdida.
 */
export function mergeConfirmedAssetIds(current, confirmed) {
  if (!current || !confirmed || current.id !== confirmed.id) return current;
  const existing = current.doc?.slides;
  const saved = confirmed.doc?.slides;
  if (!Array.isArray(existing) || !Array.isArray(saved)) return current;
  const byId = new Map(saved.map((slide) => [slide?.id, slide]));
  let changed = false;
  const slides = existing.map((slide) => {
    const remote = byId.get(slide?.id);
    if (!slide || !remote) return slide;
    let next = slide;
    for (const [assetKey, idKey] of SLIDE_MEDIA_KEYS) {
      if (next[assetKey] || typeof remote[assetKey] !== 'string' || !remote[assetKey]) continue;
      // Só adota o asset da mesma imagem; uma foto trocada enquanto o envio
      // corria mantém a identidade nova e será enviada na próxima gravação.
      if (!slide[idKey] || slide[idKey] !== remote[idKey]) continue;
      next = { ...next, [assetKey]: remote[assetKey] };
    }
    if (next !== slide) changed = true;
    return next;
  });
  return changed ? { ...current, doc: { ...current.doc, slides } } : current;
}
