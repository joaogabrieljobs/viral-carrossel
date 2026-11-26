/**
 * Uma geração de foto que falha não deixa metade do slide livre em branco.
 * A transição é aplicada ao resultado da ação, nunca na leitura de um projeto.
 * Só os campos de composição alterados são guardados para recuperar a foto;
 * texto, mídia existente e edições posteriores continuam pertencendo à pessoa.
 */
import { FREE_ART_MAX_SLIDES, FREE_PRESENTATION_PRESET_ID, freePresentationCompositionOverrides } from './free-design.js';
import { manuallyPositioned } from './presentation-composition.js';
import { isFreeSocialSlide, socialFreePhotoPatch } from './social-free-design.js';

const GENERIC_LAYOUT_FIELDS = new Set([
  'canvas', 'layout', 'align', 'photoRegion', 'overlay', 'overlayMode', 'overlaySide', 'overlayReach', 'overlayColor',
  'titlePosition', 'imagePosition', 'customBg', 'titleColor', 'subtitleColor', 'textColor',
  'titleSize', 'subSize', 'bodyAfterSize', 'titleWeight', 'titleCase', 'titleLeading', 'subLeading', 'subTracking',
]);
const EXCLUDED_PRESENTATION_FIELDS = new Set([
  'presentationPlan', 'presentationBlocks', 'presentationImageFallback',
  'presentationArtImage', 'presentationArtImageId', 'presentationArtImageAssetId',
]);
const layoutField = key => GENERIC_LAYOUT_FIELDS.has(key)
  || (key.startsWith('presentation') && !EXCLUDED_PRESENTATION_FIELDS.has(key));
const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
const hasMedia = slide => !!(slide?.bgImage || slide?.bgImageId || slide?.bgImageAssetId);
// Bytes hidratados da mesma mídia não são um gesto de inserção.
const mediaKey = slide => slide?.bgImageId || slide?.bgImageAssetId || slide?.videoId || slide?.bgImage || null;
const isFree = slide => slide?.presentationPresetId === FREE_PRESENTATION_PRESET_ID && !!slide?.presentationFreeDesign;
const artFields = ['presentationArtImage', 'presentationArtImageId', 'presentationArtImageAssetId'];
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const object = value => value && typeof value === 'object' && !Array.isArray(value);

function restoreUnedited(current, original, fallback) {
  if (same(current, fallback)) return clone(original);
  if (!object(current) || !object(original) || !object(fallback)) return current;
  const next = { ...current };
  for (const key of new Set([...Object.keys(original), ...Object.keys(fallback)])) {
    const value = restoreUnedited(current[key], original[key], fallback[key]);
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next;
}

function restoreLayout(slide) {
  const fallback = slide?.presentationImageFallback;
  if (!fallback) return slide;
  const next = { ...slide };
  for (const change of fallback.changes || []) {
    // Um ajuste feito depois da falha vence a recuperação automática.
    const value = restoreUnedited(next[change.key], change.beforeAbsent ? undefined : change.before, change.afterAbsent ? undefined : change.after);
    if (value === undefined) delete next[change.key];
    else next[change.key] = value;
  }
  delete next.presentationImageFallback;
  return next;
}

/** O pedido de regeneração conhece o tamanho e a composição da foto original. */
export function freeImageGenerationSlide(slide) {
  return isFree(slide) ? restoreLayout(slide) : slide;
}

function withoutPhoto(slide, index, slides, allowArt) {
  const originalDesign = clone(slide.presentationFreeDesign);
  if (manuallyPositioned(slide)) return {
    ...slide,
    presentationImageFallback: { reason: String(slide.bgImageError || 'generation_failed'), originalDesign, changes: [], layoutPreserved: true },
  };
  const art = allowArt && slides.find(item => artFields.some(key => item?.[key]));
  const design = { ...originalDesign, photo: 'none', ground: art ? 'art' : 'bg' };
  const input = {
    ...slide, imageQuery: '', bgImage: null, bgImageId: null, bgImageAssetId: null,
    presentationFreeDesign: design,
    presentationPlan: { ...slide.presentationPlan, design },
    ...(art ? Object.fromEntries(artFields.filter(key => art[key]).map(key => [key, art[key]])) : {}),
  };
  const composed = freePresentationCompositionOverrides(slide, {
    slide: input, stage: { visualRole: slide.presentationPlan?.visualRole, purpose: slide.presentationPlan?.purpose },
    index, count: slides.length, previous: [], deckDesign: slide.presentationDeckDesign,
  });
  const changes = [];
  // A arte continua no fluxo normal de mídia. Bytes/URLs não entram no
  // snapshot, que também é persistido depois de fechar o navegador.
  const next = { ...slide, ...Object.fromEntries(artFields.filter(key => composed[key]).map(key => [key, composed[key]])) };
  for (const key of new Set([...Object.keys(slide), ...Object.keys(composed)])) {
    if (!layoutField(key) || same(slide[key], composed[key])) continue;
    changes.push({ key,
      ...(slide[key] === undefined ? { beforeAbsent: true } : { before: clone(slide[key]) }),
      ...(composed[key] === undefined ? { afterAbsent: true } : { after: clone(composed[key]) }),
    });
    if (composed[key] === undefined) delete next[key];
    else next[key] = composed[key];
  }
  next.presentationImageFallback = {
    reason: String(slide.bgImageError || 'generation_failed'), originalDesign, changes,
  };
  return next;
}

/** Reconcilia somente uma nova falha ou uma foto que acaba de chegar. */
export function reconcileFreeImageFallback(previous = [], slides = [], { failedSlideIds = [] } = {}) {
  if (!Array.isArray(slides)) return slides;
  const explicitFailures = new Set(failedSlideIds);
  const before = new Map((Array.isArray(previous) ? previous : []).map(slide => [slide?.id, slide]));
  let artCount = slides.filter(slide => slide?.presentationFreeDesign?.ground === 'art').length;
  let changed = false;
  const result = slides.map((slide, index) => {
    const old = before.get(slide.id);
    if (isFreeSocialSlide(slide)) {
      if (!old || slide.bgImageFailed || !mediaKey(slide) || mediaKey(old) === mediaKey(slide)) return slide;
      const patch = socialFreePhotoPatch(slide);
      if (!Object.keys(patch).length) return slide;
      changed = true;
      return { ...slide, ...patch };
    }
    if (!isFree(slide)) return slide;
    const fallback = slide.presentationImageFallback;
    if (fallback) {
      if (!slide.bgImageFailed && hasMedia(slide)) {
        changed = true;
        return restoreLayout(slide);
      }
      if (slide.bgImageFailed && slide.bgImageError && fallback.reason !== slide.bgImageError) {
        changed = true;
        return { ...slide, presentationImageFallback: { ...fallback, reason: String(slide.bgImageError) } };
      }
      return slide;
    }
    if (!slide.bgImageFailed || (old?.bgImageFailed && !explicitFailures.has(slide.id)) || hasMedia(slide) || slide.presentationFreeDesign.photo === 'none') return slide;
    changed = true;
    const result = withoutPhoto(slide, index, slides, artCount < FREE_ART_MAX_SLIDES);
    if (result.presentationFreeDesign.ground === 'art' && slide.presentationFreeDesign.ground !== 'art') artCount += 1;
    return result;
  });
  return changed ? result : slides;
}

/** A importação individual passa pela edição por formato e grava a recuperação. */
export function reconcileFreeImageDocument(previous, next) {
  if (!next || !Array.isArray(next.slides)) return next;
  const slides = reconcileFreeImageFallback(previous?.slides, next.slides);
  return slides === next.slides ? next : { ...next, slides };
}
