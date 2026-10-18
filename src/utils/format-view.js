import { FORMATS } from './formats.js';

/** Ajustes visuais que podem ser diferentes em cada proporção. Texto e foto continuam no slide. */
const VIEW_KEYS = [
  'layout', 'align', 'photoRegion', 'bgFit',
  'bgX', 'bgY', 'bgZoom', 'bgMirror', 'bgOpacity', 'overlay',
  'textShadow', 'textBg', 'textBgOpacity', 'textInset', 'textBlockWidth',
  'titleSize', 'subSize', 'bodyAfterSize',
  'titleTracking', 'subTracking', 'bodyTracking',
  'titleLeading', 'subLeading', 'bodyLeading',
  'titleWeight', 'bodyWeight', 'titleCase',
  'titleColor', 'subtitleColor', 'textColor',
  'logoHidden', 'logoPosition', 'logoSize', 'logoOpacity', 'logoTone',
  'elementsUnlocked', 'textFonts', 'elementOffsets', 'canvas',
];

const BRAND_KEYS = [
  'bg', 'bgAlternate', 'titleColor', 'subtitleColor', 'textColor', 'accent',
  'titleFont', 'bodyFont', 'subtitleFont', 'logoPosition', 'logoSize', 'logoOpacity',
];

const OVERLAY_CONTENT_KEYS = ['text', 'label', 'href', 'type'];

function hexToRgb(hex) {
  let s = String(hex || '').replace('#', '').trim();
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (s.length !== 6) return null;
  const n = Number.parseInt(s, 16);
  if (!Number.isFinite(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function normalizeHex(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;
}

function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const chan = (c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
}

/** Fundo que segura o texto já escolhido. Texto claro ganha superfície escura. */
export function surfaceForReadableText(background, ink) {
  const bgL = luminance(background);
  const inkL = luminance(ink);
  if (bgL == null || inkL == null) return normalizeHex(background) || background || '#f7f7f5';
  if (Math.abs(bgL - inkL) >= 0.45) return normalizeHex(background) || background;
  return inkL >= 0.62 ? '#161616' : '#f7f7f5';
}

/**
 * Fundo de leitura só na apresentação e só quando a superfície é sólida.
 * Foto continua sendo o fundo. O resultado não é gravado no slide.
 */
export function presentationReadingSurface(fmt, background, ink, hasPhoto) {
  if (fmt !== 'apresentacao' || hasPhoto) return null;
  const next = surfaceForReadableText(background, ink);
  const current = normalizeHex(background);
  if (!next || (current && next === current)) return null;
  return next;
}

/** Fator para caber o texto do feed na proporção vista, sem gravar o tamanho. */
export function formatFitFactor(fmt) {
  const to = FORMATS[fmt];
  if (!to || fmt === 'carrossel') return 1;
  return (to.h / FORMATS.carrossel.h) * (FORMATS.carrossel.w / to.w);
}

function clampSize(value) {
  return Math.min(130, Math.max(52, Math.round(value)));
}

function viewEntry(formatViews, fmt, slideId) {
  if (!fmt || fmt === 'carrossel' || !slideId) return null;
  const entry = formatViews?.[fmt]?.slides?.[slideId];
  return entry && typeof entry === 'object' ? entry : null;
}

function incomingOverlayContent(previous, incoming) {
  if (!Array.isArray(incoming)) return previous;
  const prevById = new Map((previous || []).map((item) => [item?.id, item]));
  return incoming.map((item) => {
    const base = prevById.get(item?.id);
    if (!base) return item;
    const next = { ...base };
    for (const key of OVERLAY_CONTENT_KEYS) {
      if (item[key] !== undefined) next[key] = item[key];
    }
    return next;
  });
}

function mergeOverlayContent(canonical, saved) {
  if (!Array.isArray(saved)) return canonical;
  const byId = new Map((canonical || []).map((item) => [item?.id, item]));
  const savedIds = new Set(saved.map((item) => item?.id));
  const merged = saved.map((item) => {
    const base = byId.get(item?.id);
    if (!base) return item;
    const next = { ...item };
    for (const key of OVERLAY_CONTENT_KEYS) {
      if (base[key] !== undefined) next[key] = base[key];
    }
    return next;
  });
  for (const item of canonical || []) {
    if (item?.id && !savedIds.has(item.id)) merged.push(item);
  }
  return merged;
}

/** Marca desenhada nesta proporção. No feed é a marca salva. */
export function brandForFormatDisplay(brand, fmt, formatViews) {
  if (!brand || !fmt || fmt === 'carrossel' || !FORMATS[fmt]) return brand;
  const extra = formatViews?.[fmt]?.brand;
  if (!extra || typeof extra !== 'object') return brand;
  return { ...brand, ...extra };
}

/** Slide só para desenhar. O objeto do documento continua o do feed. */
export function slideForFormatDisplay(slide, fmt, formatViews) {
  if (!slide || !fmt || fmt === 'carrossel' || !FORMATS[fmt]) return slide;
  const entry = viewEntry(formatViews, fmt, slide.id) || {};
  const next = { ...slide, ...entry };
  const factor = formatFitFactor(fmt);
  if (entry.titleSize == null) next.titleSize = clampSize((slide.titleSize ?? 100) * factor);
  if (entry.subSize == null) next.subSize = clampSize((slide.subSize ?? 100) * factor);
  if (entry.bodyAfterSize == null && slide.bodyAfterSize != null) {
    next.bodyAfterSize = clampSize(slide.bodyAfterSize * factor);
  }
  if (entry.elementOffsets && typeof entry.elementOffsets === 'object') {
    next.elementOffsets = { ...(slide.elementOffsets || {}), ...entry.elementOffsets };
  }
  if (entry.overlays) next.overlays = mergeOverlayContent(slide.overlays, entry.overlays);
  return next;
}

/** Ajuste de marca fora do feed fica só nessa proporção. */
export function applyBrandEdit(doc, brandNext) {
  if (!doc || !brandNext) return doc;
  const fmt = FORMATS[doc.fmt] ? doc.fmt : 'carrossel';
  if (fmt === 'carrossel') return { ...doc, brand: brandNext };
  const base = doc.brand || {};
  const views = { ...(doc.formatViews || {}) };
  const bucket = { ...(views[fmt] || {}) };
  const viewBrand = { ...(bucket.brand || {}) };
  const canonical = { ...brandNext };
  for (const key of BRAND_KEYS) {
    if (brandNext[key] !== base[key]) viewBrand[key] = brandNext[key];
    canonical[key] = base[key];
  }
  bucket.brand = viewBrand;
  views[fmt] = bucket;
  return { ...doc, brand: canonical, formatViews: views };
}

/** Logo do 16:9 cabe na altura. Nos outros formatos segue o tamanho salvo. */
export function logoRenderPx(fmt, frameW, logoSize) {
  const chosen = Number(logoSize) || 260;
  const px = chosen * ((frameW || 1080) / 1080);
  if (fmt !== 'apresentacao') return px;
  return Math.min(px, FORMATS.apresentacao.h * 0.085 * (chosen / 260));
}

/**
 * Edição de largura ou posição numa proporção que não é o feed
 * vai para o mapa dessa proporção. O slide canônico não muda.
 */
export function applyFormatEdit(doc, index, patch) {
  if (!doc || !patch || typeof patch !== 'object') return doc;
  const slides = Array.isArray(doc.slides) ? doc.slides : [];
  const slide = slides[index];
  if (!slide) return doc;
  const fmt = FORMATS[doc.fmt] ? doc.fmt : 'carrossel';
  const rest = { ...patch };
  const view = {};
  if (fmt !== 'carrossel') {
    for (const key of VIEW_KEYS) {
      if (rest[key] !== undefined) {
        view[key] = rest[key];
        delete rest[key];
      }
    }
    if (Array.isArray(rest.overlays)) {
      view.overlays = rest.overlays;
      rest.overlays = incomingOverlayContent(slide.overlays, rest.overlays);
    }
  }
  let next = doc;
  if (Object.keys(view).length) {
    const views = { ...(doc.formatViews || {}) };
    const bucket = { ...(views[fmt] || {}) };
    const byId = { ...(bucket.slides || {}) };
    const prev = { ...(byId[slide.id] || {}) };
    for (const key of Object.keys(view)) {
      if (key === 'elementOffsets' && view.elementOffsets && typeof view.elementOffsets === 'object') {
        prev.elementOffsets = { ...(prev.elementOffsets || {}), ...view.elementOffsets };
      } else {
        prev[key] = view[key];
      }
    }
    byId[slide.id] = prev;
    views[fmt] = { ...bucket, slides: byId };
    next = { ...next, formatViews: views };
  }
  if (Object.keys(rest).length) {
    next = {
      ...next,
      slides: slides.map((item, i) => {
        if (i !== index) return item;
        const merged = { ...item, ...rest };
        if (rest.elementOffsets && typeof rest.elementOffsets === 'object') {
          merged.elementOffsets = { ...(item.elementOffsets || {}), ...rest.elementOffsets };
        }
        return merged;
      }),
    };
  }
  return next;
}
