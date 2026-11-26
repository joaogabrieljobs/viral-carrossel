/** Transições explícitas para fora do modo Livre social, sem editar conteúdo. */
import { normalizePresentationBlocks } from './presentation-quality.js';

export const SOCIAL_FREE_STATE_FIELDS = Object.freeze([
  // O Livre grava estas tintas no card; ao sair, o novo estilo as define.
  'titleColor', 'subtitleColor', 'textColor',
  'socialFreeDesign', 'socialFreeDesignOverride', 'socialFreeTextSurfaces', 'socialFreeChromeGeometry',
  'socialDeckDesign', 'socialPlan', 'socialPresetId', 'socialVisualPresetId', 'socialSuppressPhoto',
  'socialComposition', 'socialCompositionVersion', 'socialArt', 'socialFunction', 'socialFamily', 'socialZoneAnchors',
  'presentationSuppressPhoto', 'presentationArtScrim', 'presentationPaletteOverrides', 'presentationNumericTypography',
  'presentationBlockAnchor', 'presentationArtDirectionVersion', 'presentationDesignFamily',
]);

export function hasSocialFreeState(slide) {
  return !!slide?.socialFreeDesign || slide?.socialPresetId === 'social_free'
    || slide?.socialVisualPresetId === 'social_free' || slide?.socialPlan?.kind === 'social_free'
    || String(slide?.socialComposition || '').startsWith('free:');
}

export function stripSocialFreeSlideFields(slide) {
  if (!hasSocialFreeState(slide)) return slide;
  const next = { ...slide };
  for (const key of SOCIAL_FREE_STATE_FIELDS) delete next[key];
  if (normalizePresentationBlocks(slide.presentationBlocks).length) {
    next.socialNativeBlocksFromFree = true;
    next.presentationArtDirectionVersion = 2;
  }
  return next;
}

/** Valores null também anulam o estado herdado do card canônico numa vista. */
export function socialFreeExitPatch(slide) {
  if (!hasSocialFreeState(slide)) return {};
  return { ...Object.fromEntries(SOCIAL_FREE_STATE_FIELDS.map(key => [key, null])),
    ...(normalizePresentationBlocks(slide.presentationBlocks).length ? { socialNativeBlocksFromFree: true, presentationArtDirectionVersion: 2 } : {}) };
}

export function clearSocialFreeDocumentState(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  let changed = !!(doc.socialPlan || doc.socialDeckDesign || doc.socialQuality);
  const slides = (doc.slides || []).map(slide => {
    const next = stripSocialFreeSlideFields(slide);
    if (next !== slide) changed = true;
    return next;
  });
  let formatViews = doc.formatViews;
  for (const [fmt, bucket] of Object.entries(doc.formatViews || {})) {
    if (!bucket?.slides || typeof bucket.slides !== 'object') continue;
    let entries = bucket.slides;
    for (const [id, entry] of Object.entries(bucket.slides)) {
      const next = stripSocialFreeSlideFields(entry);
      if (next === entry) continue;
      entries = { ...entries, [id]: next };
      changed = true;
    }
    if (entries !== bucket.slides) formatViews = { ...formatViews, [fmt]: { ...bucket, slides: entries } };
  }
  return changed ? { ...doc, slides, ...(formatViews ? { formatViews } : {}), socialPlan: null, socialDeckDesign: null, socialQuality: null } : doc;
}

/** Um bloco existente continua nativo mesmo quando o novo estilo é clássico. */
export function preserveSocialNativeBlockZone(slide, source = slide) {
  if (!(slide?.socialNativeBlocksFromFree || source?.socialNativeBlocksFromFree || hasSocialFreeState(source))
    || !normalizePresentationBlocks(source?.presentationBlocks).length) return slide;
  const next = { ...slide, presentationBlocks: source.presentationBlocks, socialNativeBlocksFromFree: true, presentationArtDirectionVersion: 2 };
  const canvas = next.canvas?.zones ? next.canvas : source.canvas;
  if (!canvas?.zones) return next;
  const zones = canvas.zones;
  if (zones.evidence?.w > 0 && zones.evidence?.h > 0) return { ...next, canvas };
  const area = zones.subtitle;
  if (!area || !(area.w > 0 && area.h > 0)) return next;
  const hasCopy = !!String(next.subtitle || next.bodyAfterImage || '').trim();
  const copyHeight = hasCopy ? Math.min(10, area.h * 0.3) : 0;
  const gap = hasCopy ? 1 : 0;
  return { ...next, canvas: { ...canvas, zones: { ...zones,
    ...(hasCopy ? { subtitle: { ...area, h: copyHeight } } : {}),
    evidence: { ...area, y: area.y + copyHeight + gap, h: Math.max(1, area.h - copyHeight - gap) },
  } } };
}
