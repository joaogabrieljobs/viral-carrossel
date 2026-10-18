import { FORMATS } from './formats.js';
import { vcHexToRgb, vcNormalizeHex, vcRelLuminance01 } from './brand-visuals.js';
import { fitSlidesToFormat } from './format-reading-fit.js';
import {
  DEFAULT_PRESENTATION_VISUAL_PRESET_ID,
  getPresentationCompositionOverrides,
} from '../styles/presentation-presets.jsx';

/** O que muda com a proporção. O texto, a foto e o botão em si continuam no slide. */
const SLIDE_VISUAL_KEYS = [
  'layout', 'align', 'titleSize', 'subSize', 'bodyAfterSize',
  'titleLeading', 'subLeading', 'titleTracking', 'subTracking',
  'textInset', 'textBlockWidth', 'textShadow', 'textBg', 'textBgOpacity',
  'canvas', 'elementOffsets', 'composition', 'photoRegion', 'overlay',
  'logoSize', 'logoPosition', 'logoOpacity', 'customBg',
  'titleColor', 'subtitleColor', 'textColor',
  'showSwipeCue',
  'presentationStageId', 'presentationStageLabel', 'presentationVisualRole',
  'presentationPresetId', 'presentationComposition', 'presentationCompositionId',
  'presentationLayout', 'titlePosition', 'imagePosition',
];

const BRAND_VISUAL_KEYS = ['bg', 'bgAlternate', 'interleaveBg', 'logoSize'];

function clone(value) {
  if (value == null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

function luminance(color) {
  const rgb = vcHexToRgb(vcNormalizeHex(color) || '');
  return rgb ? vcRelLuminance01(rgb) : null;
}

/** Fundo que segura o texto que já existe. Texto claro ganha superfície escura. */
export function surfaceForReadableText(background, ink) {
  const bgL = luminance(background);
  const inkL = luminance(ink);
  if (bgL == null || inkL == null) return background || '#f7f7f5';
  if (Math.abs(bgL - inkL) >= 0.45) return vcNormalizeHex(background) || background;
  return inkL >= 0.62 ? '#161616' : '#f7f7f5';
}

function pickVisual(slide) {
  const visual = {};
  for (const key of SLIDE_VISUAL_KEYS) {
    if (slide?.[key] !== undefined) visual[key] = clone(slide[key]);
  }
  return visual;
}

export function snapshotFormatView(doc) {
  const brand = {};
  for (const key of BRAND_VISUAL_KEYS) {
    if (doc?.brand?.[key] !== undefined) brand[key] = clone(doc.brand[key]);
  }
  return {
    brand,
    creativePreset: doc?.creativePreset,
    productKind: doc?.productKind,
    visualPreset: doc?.visualPreset,
    slides: (doc?.slides || []).map((slide) => ({
      id: slide?.id,
      visual: pickVisual(slide),
      overlays: (slide?.overlays || []).map((ov) => ({
        id: ov.id, x: ov.x, y: ov.y, w: ov.w,
      })),
    })),
  };
}

function applyFormatView(doc, view) {
  if (!view) return doc;
  const brand = { ...(doc.brand || {}) };
  for (const key of BRAND_VISUAL_KEYS) {
    if (view.brand && view.brand[key] !== undefined) brand[key] = clone(view.brand[key]);
  }
  const byId = new Map((view.slides || []).map((item) => [item.id, item]));
  const slides = (doc.slides || []).map((slide) => {
    const saved = byId.get(slide.id);
    if (!saved) return slide;
    const next = { ...slide };
    for (const key of SLIDE_VISUAL_KEYS) {
      if (saved.visual?.[key] === undefined) delete next[key];
      else next[key] = clone(saved.visual[key]);
    }
    if (Array.isArray(slide.overlays) && Array.isArray(saved.overlays)) {
      const pos = new Map(saved.overlays.map((ov) => [ov.id, ov]));
      next.overlays = slide.overlays.map((ov) => {
        const placed = pos.get(ov.id);
        if (!placed) return ov;
        return {
          ...ov,
          x: placed.x,
          y: placed.y,
          ...(placed.w != null ? { w: placed.w } : {}),
        };
      });
    }
    return next;
  });
  return {
    ...doc,
    brand,
    slides,
    creativePreset: view.creativePreset || doc.creativePreset,
    productKind: view.productKind || (doc.fmt === 'apresentacao' ? 'apresentacao' : 'carrossel'),
    visualPreset: view.visualPreset === undefined ? doc.visualPreset : view.visualPreset,
  };
}

function derivePresentation(doc) {
  const ink = doc.brand?.titleColor || doc.slides?.[0]?.titleColor || '#111111';
  const bg = surfaceForReadableText(doc.brand?.bg, ink);
  const count = Math.max(1, doc.slides?.length || 1);
  const slides = (doc.slides || []).map((slide, index) => {
    const composed = {
      ...slide,
      ...getPresentationCompositionOverrides(DEFAULT_PRESENTATION_VISUAL_PRESET_ID, {
        slide, index, count,
      }),
    };
    const slideInk = slide.titleColor || ink;
    if (slide.customBg) {
      composed.customBg = surfaceForReadableText(slide.customBg, slideInk);
    }
    return composed;
  });
  const fitted = fitSlidesToFormat(slides, doc.fmt || 'carrossel', 'apresentacao', { composed: true });
  return {
    ...doc,
    fmt: 'apresentacao',
    productKind: 'apresentacao',
    brand: { ...(doc.brand || {}), bg },
    slides: fitted,
  };
}

function deriveCarouselFormat(doc, prevFmt, nextFmt) {
  return {
    ...doc,
    fmt: nextFmt,
    productKind: 'carrossel',
    slides: fitSlidesToFormat(doc.slides, prevFmt, nextFmt),
  };
}

/** Troca a proporção e guarda o ajuste de cada uma. O outro formato volta como estava. */
export function switchDocFormat(doc, nextFmt) {
  const source = doc && typeof doc === 'object' ? doc : {};
  const prevFmt = FORMATS[source.fmt] ? source.fmt : 'carrossel';
  const target = FORMATS[nextFmt] ? nextFmt : 'carrossel';
  if (target === prevFmt) return source;
  const views = { ...(source.formatViews || {}) };
  views[prevFmt] = snapshotFormatView(source);

  let next;
  if (views[target]) {
    next = applyFormatView({ ...source, fmt: target, formatViews: views }, views[target]);
  } else if (target === 'apresentacao') {
    next = derivePresentation({ ...source, formatViews: views });
  } else {
    next = deriveCarouselFormat({ ...source, formatViews: views }, prevFmt, target);
  }
  const saved = { ...(next.formatViews || views) };
  saved[target] = snapshotFormatView({ ...next, fmt: target });
  return { ...next, fmt: target, formatViews: saved };
}
