import { slideImageIdentity } from './image-store.js';

const PHOTO_STATE_KEYS = [
  'bgImage', 'bgImageId', 'bgImageAssetId', 'bgImageSource',
  'bgImageFailed', 'bgImageError', 'bgFit', 'bgX', 'bgY', 'bgZoom',
  'bgMirror', 'bgOpacity', 'photoFraming', 'presentationImgAdjust',
];
const PHOTO_EDIT_KEYS = [
  'bgImageSource', 'bgFit', 'bgX', 'bgY', 'bgZoom',
  'bgMirror', 'bgOpacity', 'photoFraming', 'presentationImgAdjust',
];

function sameValue(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  try { return JSON.stringify(left) === JSON.stringify(right); }
  catch { return false; }
}

function photoStateChanged(snapshot, current) {
  if (!snapshot || !current || snapshot.id !== current.id) return false;
  // Hidratação pode preencher bytes/ID local enquanto o mesmo asset remoto é
  // baixado. Isso não é edição do usuário e não deve ressuscitar foto antiga.
  const sameRemoteAsset = !!snapshot.bgImageAssetId
    && snapshot.bgImageAssetId === current.bgImageAssetId;
  if (!sameRemoteAsset && slideImageIdentity(snapshot) !== slideImageIdentity(current)) return true;
  if (sameRemoteAsset) {
    if (snapshot.bgImageId && snapshot.bgImageId !== current.bgImageId) return true;
    if (snapshot.bgImage && current.bgImage && snapshot.bgImage !== current.bgImage) return true;
  }
  return PHOTO_EDIT_KEYS.some(key => !sameValue(snapshot[key], current[key]));
}

/** Preserva mídia alterada pelo usuário enquanto o texto era gerado. */
export function mergeGeneratedSlidesWithConcurrentMedia(generatedSlides = [], snapshotSlides = [], currentSlides = []) {
  const currentById = new Map((currentSlides || []).filter(Boolean).map(slide => [slide.id, slide]));
  const protectedSlideIds = new Set();
  const slides = (generatedSlides || []).map((generated, index) => {
    const snapshot = snapshotSlides?.[index];
    const current = snapshot?.id ? currentById.get(snapshot.id) : null;
    if (!generated || !photoStateChanged(snapshot, current)) return generated;
    protectedSlideIds.add(current.id);
    const photo = Object.fromEntries(PHOTO_STATE_KEYS.map(key => [key, current[key]]));
    return { ...generated, id:current.id, ...photo };
  });
  return { slides, protectedSlideIds };
}
