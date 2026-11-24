import { FORMATS } from './formats.js';
import { LOGO_SIZE_MAX, LOGO_SIZE_MIN, applyLogoLayoutToSlides, resolveLogoControls } from './slide-logo.js';
import { clearReplacedSlideAssets } from './cloud-media-merge.js';
import { slideImageIdentity } from './image-store.js';
import { hasPresentationDesign, presentationForSocialFormat } from './presentation-format.js';
import { restorePresentationPhotoComposition } from './presentation-composition.js';
import { socialFormatPatch } from './social-visual-composition.js';

/** Ajustes visuais que podem ser diferentes em cada proporção. Texto e foto continuam no slide. */
const VIEW_KEYS = [
  'visualBrand', 'visualPresetId', 'visualCreativePreset', 'layout', 'align', 'photoRegion', 'bgFit', 'photoFraming',
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

/** Recorte da foto. Vale para uma imagem; a foto nova não o herda. */
const PHOTO_FRAMING_KEYS = ['photoFraming', 'bgFit', 'bgX', 'bgY', 'bgZoom', 'bgMirror'];

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
  if (!fmt || !slideId) return null;
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

/** Marca desenhada nesta proporção; apresentações herdam a identidade do 16:9. */
export function brandForFormatDisplay(brand, fmt, formatViews, creativePreset) {
  if (!brand || !fmt || !FORMATS[fmt]) return brand;
  const source = creativePreset === 'apresentacao' && fmt !== 'apresentacao'
    ? { ...brand, ...formatViews?.apresentacao?.brand }
    : brand;
  const extra = formatViews?.[fmt]?.brand;
  if (!extra || typeof extra !== 'object') return source;
  return { ...source, ...extra };
}

/** Slide só para desenhar. A composição original do documento não muda. */
export function slideForFormatDisplay(slide, fmt, formatViews, creativePreset) {
  if (!slide || !fmt || !FORMATS[fmt]) return slide;
  const source = restorePresentationPhotoComposition(slide);
  const adaptPresentation = fmt !== 'apresentacao' && hasPresentationDesign(slide, creativePreset);
  if (fmt === 'carrossel' && !adaptPresentation) return slide;
  const entry = viewEntry(formatViews, fmt, slide.id) || {};
  // Carrossel da biblioteca v4: Quadrado e Stories são recompostos (zonas,
  // escala e dispositivos do formato), não o Feed reduzido.
  const socialLibrary = !adaptPresentation && fmt !== 'apresentacao' && slide.socialCompositionVersion >= 4 && !!slide.socialArt;
  const base = adaptPresentation
    ? presentationForSocialFormat(slideForFormatDisplay(source, 'apresentacao', formatViews), fmt)
    : socialLibrary ? { ...source, ...socialFormatPatch(source, fmt) } : source;
  const next = { ...base, ...entry };
  // Ajustes já gravados antes da opção automática também são escolhas manuais.
  if (adaptPresentation && !entry.photoFraming
    && (['bgX', 'bgY', 'bgZoom', 'bgFit'].some(key => Object.hasOwn(entry, key)) || entry.elementOffsets?.photo)) {
    next.photoFraming = 'manual';
  }
  if (!adaptPresentation && !socialLibrary) {
    const factor = formatFitFactor(fmt);
    if (entry.titleSize == null) next.titleSize = clampSize((slide.titleSize ?? 100) * factor);
    if (entry.subSize == null) next.subSize = clampSize((slide.subSize ?? 100) * factor);
    if (entry.bodyAfterSize == null && slide.bodyAfterSize != null) {
      next.bodyAfterSize = clampSize(slide.bodyAfterSize * factor);
    }
  }
  if (entry.elementOffsets && typeof entry.elementOffsets === 'object') {
    next.elementOffsets = { ...(base.elementOffsets || {}), ...entry.elementOffsets };
  }
  if (entry.overlays) next.overlays = mergeOverlayContent(slide.overlays, entry.overlays);
  return next;
}

/** Ajuste da marca numa vista derivada fica só nessa proporção. */
export function applyBrandEdit(doc, brandNext) {
  if (!doc || !brandNext) return doc;
  const fmt = FORMATS[doc.fmt] ? doc.fmt : 'carrossel';
  if (fmt === 'carrossel' && !doc.slides?.some(slide => hasPresentationDesign(slide, doc.creativePreset))) {
    return { ...doc, brand: brandNext };
  }
  const base = doc.brand || {};
  const views = { ...(doc.formatViews || {}) };
  const bucket = { ...(views[fmt] || {}) };
  const viewBrand = { ...(bucket.brand || {}) };
  const canonical = { ...brandNext };
  for (const key of BRAND_KEYS) {
    if (Object.hasOwn(viewBrand, key) || brandNext[key] !== base[key]) viewBrand[key] = brandNext[key];
    canonical[key] = base[key];
  }
  bucket.brand = viewBrand;
  views[fmt] = bucket;
  return { ...doc, brand: canonical, formatViews: views };
}

/** Logo do 16:9 segue a altura do slide. O máximo do slider chega a mais da metade da altura. */
export function logoRenderPx(fmt, frameW, logoSize) {
  const chosen = Number(logoSize) || 260;
  const width = frameW || 1080;
  const px = chosen * (width / 1080);
  if (fmt !== 'apresentacao') return px;
  const height = width * (FORMATS.apresentacao.h / FORMATS.apresentacao.w);
  const span = LOGO_SIZE_MAX - LOGO_SIZE_MIN;
  const t = Math.max(0, Math.min(1, (chosen - LOGO_SIZE_MIN) / span));
  return height * (0.12 + t * 0.5);
}

/** Patch de troca de foto: imagem nova com enquadramento automático (`automaticPhotoFramingPatch`). */
function isPhotoSwap(slide, patch) {
  if (patch.photoFraming !== 'auto' || (!patch.bgImageId && !patch.bgImage)) return false;
  return slideImageIdentity({ ...slide, ...patch }) !== slideImageIdentity(slide);
}

/** Tira de todas as proporções o recorte que o card guardava para a foto antiga. */
function dropPhotoFramingFromViews(formatViews, slideId) {
  let views = formatViews;
  for (const [fmt, bucket] of Object.entries(formatViews || {})) {
    const entry = bucket?.slides?.[slideId];
    if (!entry || typeof entry !== 'object') continue;
    const hasOffset = !!entry.elementOffsets && Object.hasOwn(entry.elementOffsets, 'photo');
    if (!hasOffset && !PHOTO_FRAMING_KEYS.some(key => Object.hasOwn(entry, key))) continue;
    const kept = { ...entry };
    for (const key of PHOTO_FRAMING_KEYS) delete kept[key];
    if (hasOffset) {
      kept.elementOffsets = { ...entry.elementOffsets };
      delete kept.elementOffsets.photo;
    }
    views = { ...views, [fmt]: { ...bucket, slides: { ...bucket.slides, [slideId]: kept } } };
  }
  return views;
}

/**
 * Troca de foto por `updateSlide` (importação, recorte). O enquadramento que
 * veio com a foto nova fica no slide e nenhuma proporção guarda o da antiga:
 * antes só o formato aberto era limpo, e os outros mostravam a foto nova com
 * o zoom e a posição da anterior.
 */
function settlePhotoSwap(doc, index, patch) {
  const framing = {};
  for (const key of PHOTO_FRAMING_KEYS) if (patch[key] !== undefined) framing[key] = patch[key];
  const photoOffset = patch.elementOffsets?.photo;
  const slides = doc.slides.map((item, i) => (i !== index ? item : {
    ...item,
    ...framing,
    ...(photoOffset ? { elementOffsets: { ...(item.elementOffsets || {}), photo: photoOffset } } : {}),
  }));
  const formatViews = dropPhotoFramingFromViews(doc.formatViews, doc.slides[index].id);
  return { ...doc, slides, ...(formatViews !== doc.formatViews ? { formatViews } : {}) };
}

/**
 * Troca de foto gravada direto na lista de slides (imagem de IA, importação
 * em lote). Compara a foto de cada card antes e depois e tira das vistas o
 * recorte da foto antiga. Só para gravações que são troca de foto: recarregar
 * ou guardar no aparelho a mesma imagem também muda o endereço dela.
 */
export function applyPhotoSwapSlides(doc, nextSlides) {
  if (!doc || !Array.isArray(nextSlides)) return doc;
  const before = new Map((doc.slides || []).map(slide => [slide?.id, slide]));
  let formatViews = doc.formatViews;
  for (const slide of nextSlides) {
    const old = before.get(slide?.id);
    if (!old || slide.photoFraming !== 'auto') continue;
    const identity = slideImageIdentity(slide);
    if (identity === 'none' || identity === slideImageIdentity(old)) continue;
    formatViews = dropPhotoFramingFromViews(formatViews, slide.id);
  }
  return { ...doc, slides: nextSlides, ...(formatViews !== doc.formatViews ? { formatViews } : {}) };
}

/**
 * Edição visual numa vista derivada vai para o mapa dessa proporção.
 * Em apresentações, o feed também é derivado; o original não muda.
 */
export function applyFormatEdit(doc, index, patch) {
  if (!doc || !patch || typeof patch !== 'object') return doc;
  const slides = Array.isArray(doc.slides) ? doc.slides : [];
  const slide = slides[index];
  if (!slide) return doc;
  const fmt = FORMATS[doc.fmt] ? doc.fmt : 'carrossel';
  const rest = { ...patch };
  if (!rest.photoFraming && (
    ['bgX', 'bgY', 'bgZoom', 'bgFit'].some(key => rest[key] !== undefined) || rest.elementOffsets?.photo
  )) rest.photoFraming = 'manual';
  const view = {};
  if (fmt !== 'carrossel' || hasPresentationDesign(slide, doc.creativePreset)) {
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
      // FE-06: remover ou trocar a foto (ou a logo do card) por aqui também
      // solta o asset da conta; sem isso a mídia antiga voltava ao reabrir.
      slides: clearReplacedSlideAssets(slides, slides.map((item, i) => {
        if (i !== index) return item;
        const merged = { ...item, ...rest };
        if (rest.elementOffsets && typeof rest.elementOffsets === 'object') {
          merged.elementOffsets = { ...(item.elementOffsets || {}), ...rest.elementOffsets };
        }
        return merged;
      })),
    };
  }
  return isPhotoSwap(slide, patch) ? settlePhotoSwap(next, index, patch) : next;
}

function isDerivedView(doc, slide) {
  const fmt = FORMATS[doc.fmt] ? doc.fmt : 'carrossel';
  return fmt !== 'carrossel' || hasPresentationDesign(slide, doc.creativePreset);
}

function withViewEntry(doc, slideId, entry) {
  const fmt = FORMATS[doc.fmt] ? doc.fmt : 'carrossel';
  const views = { ...(doc.formatViews || {}) };
  const bucket = { ...(views[fmt] || {}) };
  bucket.slides = { ...(bucket.slides || {}), [slideId]: entry };
  views[fmt] = bucket;
  return { ...doc, formatViews: views };
}

/**
 * "Usar em todos os cards": o mesmo ajuste em cada card, pelo caminho do
 * ajuste card a card. Fora do Feed e em apresentação ele fica na proporção
 * aberta; gravar só no slide não mudava os cards já ajustados.
 */
export function applyFormatEditToAll(doc, patch, ids = null) {
  if (!doc || !patch || typeof patch !== 'object') return doc;
  const only = Array.isArray(ids) ? new Set(ids) : null;
  return (Array.isArray(doc.slides) ? doc.slides : []).reduce((next, slide, index) => (
    only && !only.has(slide?.id) ? next : applyFormatEdit(next, index, patch)
  ), doc);
}

/** Origem sem arrasto: a vista perde o dela e anula o que herdaria da base. */
function dropLogoOffsetInView(doc, index) {
  const slide = doc.slides[index];
  const entry = viewEntry(doc.formatViews, doc.fmt, slide.id) || {};
  const offsets = { ...(entry.elementOffsets || {}) };
  delete offsets.logo;
  const next = entry.elementOffsets ? withViewEntry(doc, slide.id, { ...entry, elementOffsets: offsets }) : doc;
  const inherited = slideForFormatDisplay(slide, next.fmt, next.formatViews, next.creativePreset)?.elementOffsets?.logo;
  return inherited ? withViewEntry(doc, slide.id, { ...entry, elementOffsets: { ...offsets, logo: null } }) : next;
}

/**
 * "Aplicar em todos" da logo. O arquivo é do card; posição, tamanho, opacidade
 * e arrasto livre do card de origem valem na proporção aberta, como o ajuste
 * feito card a card. `ids` limita aos cards selecionados.
 */
export function applyLogoToCards(doc, {
  ids = null, logoImageId = null, logoImage = null, sourceSlide = {}, brand = {},
} = {}) {
  if (!doc) return doc;
  const before = Array.isArray(doc.slides) ? doc.slides : [];
  const only = Array.isArray(ids) ? new Set(ids) : null;
  const hasAsset = !!(logoImageId || logoImage);
  const sourceOffset = sourceSlide?.elementOffsets?.logo;
  const hasOffset = !!sourceOffset && typeof sourceOffset === 'object';
  let next = doc;
  before.forEach((slide, index) => {
    if (only && !only.has(slide?.id)) return;
    const withAsset = hasAsset ? { ...slide, logoImageId, logoImage } : slide;
    const derived = isDerivedView(doc, slide);
    const card = derived ? withAsset : applyLogoLayoutToSlides([withAsset], { sourceSlide, brand })[0];
    next = { ...next, slides: next.slides.map((item, i) => (i === index ? card : item)) };
    if (!derived) return;
    next = applyFormatEdit(next, index, {
      ...resolveLogoControls(brand, sourceSlide),
      logoSizeChosen: true,
      logoHidden: false,
      ...(hasOffset ? { elementOffsets: { logo: { ...sourceOffset } } } : {}),
    });
    if (!hasOffset) next = dropLogoOffsetInView(next, index);
  });
  if (next === doc) return doc;
  return { ...next, slides: clearReplacedSlideAssets(before, next.slides) };
}

const LOGO_DEFAULT_KEYS = ['logoPosition', 'logoSize', 'logoOpacity'];

/**
 * Controles de "Padrão em todos os cards" da logo. Depois de "Aplicar em
 * todos", cada card guardava o ajuste copiado e só o card aberto seguia o
 * padrão novo. Aqui nenhum card fica preso ao valor antigo da propriedade
 * mexida: no Feed o card volta a herdar a marca; noutra proporção, se a base
 * ainda traz ajuste próprio, a vista repete o padrão novo.
 */
export function followLogoDefaultOnAllCards(doc, partial) {
  if (!doc || !partial || typeof partial !== 'object') return doc;
  const keys = LOGO_DEFAULT_KEYS.filter(key => partial[key] != null);
  if (!keys.length) return doc;
  return (Array.isArray(doc.slides) ? doc.slides : []).reduce((next, slide, index) => {
    if (!isDerivedView(next, slide)) {
      if (!keys.some(key => slide[key] != null)) return next;
      const freed = { ...slide };
      for (const key of keys) delete freed[key];
      return { ...next, slides: next.slides.map((item, i) => (i === index ? freed : item)) };
    }
    const saved = viewEntry(next.formatViews, next.fmt, slide.id);
    const entry = { ...(saved || {}) };
    for (const key of keys) delete entry[key];
    const freed = saved && keys.some(key => saved[key] != null) ? withViewEntry(next, slide.id, entry) : next;
    const shown = slideForFormatDisplay(slide, freed.fmt, freed.formatViews, freed.creativePreset);
    const stuck = keys.filter(key => shown?.[key] != null);
    if (!stuck.length) return freed;
    for (const key of stuck) entry[key] = partial[key];
    return withViewEntry(next, slide.id, entry);
  }, doc);
}

/**
 * Duplicar card: a cópia leva também o que o original tem em cada proporção.
 * A vista é lida pelo id do card; com id novo e sem entrada, a cópia voltava
 * ao valor-base (em apresentação, todos os ajustes visuais).
 */
export function duplicateSlideInDoc(doc, index, newId) {
  const slides = Array.isArray(doc?.slides) ? doc.slides : [];
  const source = slides[index];
  if (!source || !newId) return doc;
  const next = [...slides];
  next.splice(index + 1, 0, { ...source, id: newId });
  let formatViews = doc.formatViews;
  for (const [fmt, bucket] of Object.entries(doc.formatViews || {})) {
    const entry = bucket?.slides?.[source.id];
    if (!entry || typeof entry !== 'object') continue;
    formatViews = { ...formatViews, [fmt]: { ...bucket, slides: { ...bucket.slides, [newId]: { ...entry } } } };
  }
  return {
    ...doc,
    slides: next.map((slide, i) => ({ ...slide, num: i + 1 })),
    ...(formatViews ? { formatViews } : {}),
  };
}

/** Ferramentas de composição operam sobre o que está na tela, inclusive em lote. */
export function transformFormatVisuals(doc, transform) {
  const displayed = (doc.slides || []).map(slide => slideForFormatDisplay(
    slide, doc.fmt, doc.formatViews, doc.creativePreset,
  ));
  const transformed = transform(displayed);
  return displayed.reduce((next, slide, index) => {
    const edited = transformed[index];
    if (!edited) return next;
    const patch = {};
    for (const key of VIEW_KEYS) {
      if (edited[key] !== undefined && edited[key] !== slide[key]) patch[key] = edited[key];
    }
    return Object.keys(patch).length ? applyFormatEdit(next, index, patch) : next;
  }, doc);
}
