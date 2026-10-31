/** A small, explicit vocabulary for visual-only edits made by the Moont agent. */
import { createHash } from 'node:crypto';
import { MAX_CARD_OVERLAYS, normalizeOverlay } from '../../src/utils/card-overlays.js';
import { LOCAL_BODY_FONTS, LOCAL_TITLE_FONTS } from '../../src/utils/font-library.generated.js';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const dangerous = key => ['__proto__', 'prototype', 'constructor'].includes(key);

const number = (min, max) => ({ type: 'number', min, max });
const choice = values => ({ type: 'enum', values });
const boolean = { type: 'boolean' };
const font = { type: 'font' };
const color = { type: 'color' };
const logoPosition = choice(['tl', 'tr', 'c', 'bl', 'br']);

export const SLIDE_VISUAL_FIELDS = Object.freeze({
  layout: choice(['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br']),
  align: choice(['left', 'center', 'right', 'justify']),
  photoRegion: choice(['full', 'inset_h_top', 'inset_h_middle', 'inset_h_bottom', 'inset_h_narrow_mid']),
  bgFit: choice(['cover', 'contain']),
  bgX: number(0, 100), bgY: number(0, 100), bgZoom: number(50, 300),
  bgMirror: boolean, bgOpacity: number(0, 100), overlay: number(0, 100),
  textShadow: boolean, textBg: boolean, textBgOpacity: number(0, 100), textInset: number(0, 30),
  procedureLabelEmphasis: boolean,
  textBlockWidth: number(20, 90),
  titleSize: number(30, 250), subSize: number(30, 250), bodyAfterSize: number(30, 250),
  titleTracking: number(-20, 60), subTracking: number(-20, 60), bodyTracking: number(-20, 60),
  titleLeading: number(60, 250), subLeading: number(60, 250), bodyLeading: number(60, 250),
  titleWeight: number(100, 900), bodyWeight: number(100, 900),
  titleColor: color, subtitleColor: color,
  logoHidden: boolean, logoPosition,
  logoSize: number(48, 900), logoOpacity: number(0, 100),
  logoTone: choice(['original', 'dark']),
  elementsUnlocked: boolean,
  textFonts: { type: 'textFonts' }, elementOffsets: { type: 'elementOffsets' },
  canvas: { type: 'canvasZones' }, overlayStyles: { type: 'overlayStyles' },
});

export const BRAND_VISUAL_FIELDS = Object.freeze({
  bg: color, bgAlternate: color, titleColor: color, subtitleColor: color,
  textColor: color, accent: color, titleFont: font, bodyFont: font, subtitleFont: font,
  logoPosition,
  logoSize: number(48, 900), logoOpacity: number(0, 100),
});

const TEXT_FONT_KEYS = new Set([
  'title', 'subtitle', 'eyebrow', 'bodyAfterImage', 'offer', 'headerBar',
  'pageBadge', 'handleBadge', 'pill', 'footerBar',
]);
const OFFSET_KEYS = new Set([
  'text', 'title', 'subtitle', 'eyebrow', 'bodyAfterImage', 'offer', 'photo',
  'headerBar', 'pageBadge', 'handleBadge', 'logo', 'star', 'pill', 'footerBar',
]);
const ZONE_KEYS = new Set(['photo', 'title', 'subtitle', 'top', 'bottom']);
const OVERLAY_STYLE_FIELDS = Object.freeze({
  x: number(0, 100), y: number(0, 100), w: number(1, 100),
  color, bg: color, fg: color, border: color, fontFamily: font,
  size: number(1.5, 8), weight: number(100, 900),
  tracking: number(-2, 2), leading: number(0.5, 3),
  thickness: number(0.5, 8),
  align: choice(['left', 'center', 'right']),
  variant: choice(['filled', 'outline', 'glass']),
  uppercase: boolean, blur: boolean, arrow: boolean,
});
const CTA_COPY_STYLE_FIELDS = Object.freeze(Object.fromEntries(
  ['x', 'y', 'bg', 'fg', 'border', 'variant', 'uppercase', 'blur', 'arrow', 'fontFamily']
    .map(key => [key, OVERLAY_STYLE_FIELDS[key]]),
));

export const VISUAL_PATCH_SCHEMA = Object.freeze({
  slide: SLIDE_VISUAL_FIELDS,
  brand: BRAND_VISUAL_FIELDS,
  overlayStyles: OVERLAY_STYLE_FIELDS,
  copyCtaFrom: { slideId: 'ID do card de origem', overlayId: 'ID do botão CTA existente',
    style: CTA_COPY_STYLE_FIELDS },
  fontCatalog: {
    usage: 'Use exatamente o valor de `val` em patch.brand.titleFont, patch.brand.bodyFont, patch.brand.subtitleFont ou em um campo de fonte do card.',
    titleFonts: LOCAL_TITLE_FONTS,
    bodyFonts: LOCAL_BODY_FONTS,
  },
  notes: [
    'A patch is a flat slide style object; patch.brand is an explicit project-wide style object.',
    'patch.brand requires brandScope="project" even when a subset of slideIds is selected.',
    'Text, image, logo asset and reference fields cannot be written by this API. The sole exception is copyCtaFrom, which duplicates an existing CTA without changing other text.',
    'patch.copyCtaFrom copies one existing CTA from another card in this project to the selected cards; optional style sets shared CTA colors and position, and the source card is never changed.',
    'slide.titleColor and slide.subtitleColor override brand ink for selected cards, including photo cards.',
    'slide.textBlockWidth narrows the main full-bleed text group in percent of the available card width.',
    'slide.procedureLabelEmphasis highlights a leading uppercase category in that card subtitle without changing its stored text or other projects.',
    'fontCatalog lists the local Moont font library. Choose by name, but send the exact `val`; titleFonts are display choices and bodyFonts are the readable subset.',
    'A project is applied atomically. Repeat requestId to resume safely after a network failure.',
  ],
});

function bad(path, message) {
  const detail = message || `Campo visual inválido: ${path}.`;
  throw Object.assign(new Error(detail), { code: 'visual_patch_invalid', path, status: 400 });
}

function validatePrimitive(value, spec, path) {
  if (spec.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < spec.min || value > spec.max) bad(path);
  } else if (spec.type === 'boolean') {
    if (typeof value !== 'boolean') bad(path);
  } else if (spec.type === 'enum') {
    if (!spec.values.includes(value)) bad(path);
  } else if (spec.type === 'font') {
    if (typeof value !== 'string' || value.length > 80
      || /[()\\]|url\s*\(|[;{}<>\u0000-\u001f\u007f]/i.test(value)) {
      bad(path, `Fonte inválida em ${path}.`);
    }
  } else if (spec.type === 'color') {
    if (typeof value !== 'string' || value.length > 100 || !/^(?:#[0-9a-fA-F]{3,8}|rgba?\([0-9.,%\s+-]+\)|transparent)$/.test(value)) bad(path);
  }
  return value;
}

function validateTextFonts(value, path) {
  if (!record(value)) bad(path);
  const out = {};
  for (const [key, fontValue] of Object.entries(value)) {
    if (dangerous(key) || !TEXT_FONT_KEYS.has(key)) bad(`${path}.${key}`);
    out[key] = validatePrimitive(fontValue, font, `${path}.${key}`);
  }
  if (!Object.keys(out).length) bad(path);
  return out;
}

function validateOffsets(value, path) {
  if (!record(value)) bad(path);
  const out = {};
  for (const [key, offset] of Object.entries(value)) {
    if (dangerous(key) || !(OFFSET_KEYS.has(key) || /^ov_[A-Za-z0-9_-]{1,40}$/.test(key))) bad(`${path}.${key}`);
    if (offset === null) { out[key] = null; continue; }
    if (!record(offset) || Object.keys(offset).sort().join(',') !== 'x,y') bad(`${path}.${key}`);
    out[key] = {
      x: validatePrimitive(offset.x, number(-60, 60), `${path}.${key}.x`),
      y: validatePrimitive(offset.y, number(-60, 60), `${path}.${key}.y`),
    };
  }
  if (!Object.keys(out).length) bad(path);
  return out;
}

function validateCanvas(value, path) {
  if (!record(value) || Object.keys(value).some(key => key !== 'zones')) bad(path);
  if (!record(value.zones)) bad(`${path}.zones`);
  const zones = {};
  for (const [key, rect] of Object.entries(value.zones)) {
    if (dangerous(key) || !ZONE_KEYS.has(key) || !record(rect)
      || Object.keys(rect).sort().join(',') !== 'h,w,x,y') bad(`${path}.zones.${key}`);
    const clean = {};
    for (const axis of ['x', 'y', 'w', 'h']) clean[axis] = validatePrimitive(rect[axis], number(0, 100), `${path}.zones.${key}.${axis}`);
    if (clean.w <= 0 || clean.h <= 0 || clean.x + clean.w > 100 || clean.y + clean.h > 100) bad(`${path}.zones.${key}`);
    zones[key] = clean;
  }
  if (!Object.keys(zones).length) bad(`${path}.zones`);
  return { zones };
}

function validateOverlayStyles(value, path) {
  if (!record(value)) bad(path);
  const styles = {};
  for (const [overlayId, fields] of Object.entries(value)) {
    if (dangerous(overlayId) || !/^[A-Za-z0-9_-]{1,80}$/.test(overlayId) || !record(fields)) bad(`${path}.${overlayId}`);
    const clean = {};
    for (const [key, item] of Object.entries(fields)) {
      if (dangerous(key) || !own(OVERLAY_STYLE_FIELDS, key)) bad(`${path}.${overlayId}.${key}`);
      clean[key] = validatePrimitive(item, OVERLAY_STYLE_FIELDS[key], `${path}.${overlayId}.${key}`);
    }
    if (!Object.keys(clean).length) bad(`${path}.${overlayId}`);
    styles[overlayId] = clean;
  }
  if (!Object.keys(styles).length) bad(path);
  return styles;
}

function validateCopyCtaFrom(value) {
  const path = 'patch.copyCtaFrom';
  if (!record(value) || Object.keys(value).some(key => dangerous(key)
    || !['slideId', 'overlayId', 'style'].includes(key))) bad(path);
  for (const key of ['slideId', 'overlayId']) {
    if (typeof value[key] !== 'string' || dangerous(value[key])
      || !/^[A-Za-z0-9_-]{1,80}$/.test(value[key])) bad(`${path}.${key}`);
  }
  let style;
  if (own(value, 'style')) {
    if (!record(value.style) || !Object.keys(value.style).length) bad(path + '.style');
    style = {};
    for (const [key, item] of Object.entries(value.style)) {
      if (dangerous(key) || !own(CTA_COPY_STYLE_FIELDS, key)) bad(path + '.style.' + key);
      style[key] = validatePrimitive(item, CTA_COPY_STYLE_FIELDS[key], path + '.style.' + key);
    }
  }
  return { slideId: value.slideId, overlayId: value.overlayId, ...(style ? { style } : {}) };
}

export function validateVisualPatch(value, { brandScope } = {}) {
  if (!record(value)) bad('patch');
  const patch = {};
  for (const [key, item] of Object.entries(value)) {
    if (dangerous(key)) bad(`patch.${key}`);
    if (key === 'copyCtaFrom') {
      patch.copyCtaFrom = validateCopyCtaFrom(item);
      continue;
    }
    if (key === 'brand') {
      if (brandScope !== 'project' || !record(item)) bad('patch.brand', 'A alteração da marca exige brandScope="project".');
      const brand = {};
      for (const [field, fieldValue] of Object.entries(item)) {
        if (dangerous(field) || !own(BRAND_VISUAL_FIELDS, field)) bad(`patch.brand.${field}`);
        brand[field] = validatePrimitive(fieldValue, BRAND_VISUAL_FIELDS[field], `patch.brand.${field}`);
      }
      if (!Object.keys(brand).length) bad('patch.brand');
      patch.brand = brand;
      continue;
    }
    if (!own(SLIDE_VISUAL_FIELDS, key)) bad(`patch.${key}`);
    const type = SLIDE_VISUAL_FIELDS[key].type;
    patch[key] = type === 'textFonts' ? validateTextFonts(item, `patch.${key}`)
      : type === 'elementOffsets' ? validateOffsets(item, `patch.${key}`)
        : type === 'canvasZones' ? validateCanvas(item, `patch.${key}`)
          : type === 'overlayStyles' ? validateOverlayStyles(item, `patch.${key}`)
            : validatePrimitive(item, SLIDE_VISUAL_FIELDS[key], `patch.${key}`);
  }
  if (!Object.keys(patch).length) bad('patch');
  return patch;
}

export function validateSlideIds(value) {
  if (value == null) return null;
  if (!Array.isArray(value)) bad('slideIds');
  const ids = new Set();
  for (const id of value) {
    if (typeof id !== 'string' || !id || id.length > 500 || id.includes('\0') || ids.has(id)) bad('slideIds');
    ids.add(id);
  }
  if (!ids.size) bad('slideIds');
  return ids;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function applySlidePatch(slide, patch, sourceCta) {
  const next = { ...slide };
  const changes = [];
  if (sourceCta) {
    const id = `cta_${createHash('sha256')
      .update(`${patch.copyCtaFrom.slideId}\0${patch.copyCtaFrom.overlayId}\0${slide.id}`)
      .digest('hex').slice(0, 20)}`;
    const overlays = Array.isArray(slide.overlays) ? slide.overlays : [];
    const existing = overlays.find(item => record(item) && item.id === id);
    if (existing && existing.type !== 'cta') {
      bad('patch.copyCtaFrom', 'Este card já contém uma área com o ID reservado para o botão.');
    }
    // Keep an already copied (and possibly subsequently edited) CTA untouched on retries.
    const sameTextCta = overlays.some(item => record(item) && item.type === 'cta' && item.text === sourceCta.text);
    if (!existing && !sameTextCta) {
      if (overlays.length >= MAX_CARD_OVERLAYS) {
        bad('patch.copyCtaFrom', 'Um dos cards selecionados já atingiu o limite de áreas adicionais.');
      }
      next.overlays = [...overlays, normalizeOverlay({ ...sourceCta, ...patch.copyCtaFrom.style, id })];
      next.elementsUnlocked = true;
      const offsetKey = `ov_${id}`;
      if (record(slide.elementOffsets) && own(slide.elementOffsets, offsetKey)) {
        next.elementOffsets = { ...slide.elementOffsets };
        delete next.elementOffsets[offsetKey];
        changes.push('elementOffsets');
      }
      changes.push('copyCtaFrom');
    }
  }
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'brand' || key === 'copyCtaFrom') continue;
    if (key === 'textFonts') {
      const merged = { ...(record(slide.textFonts) ? slide.textFonts : {}) };
      for (const [slot, family] of Object.entries(value)) {
        if (family) merged[slot] = family;
        else delete merged[slot];
      }
      if (!same(merged, slide.textFonts || {})) { next.textFonts = merged; changes.push('textFonts'); }
    } else if (key === 'elementOffsets') {
      const merged = { ...(record(next.elementOffsets) ? next.elementOffsets : {}) };
      for (const [slot, offset] of Object.entries(value)) {
        if (offset) merged[slot] = offset;
        else delete merged[slot];
      }
      if (!same(merged, next.elementOffsets || {})) { next.elementOffsets = merged; changes.push('elementOffsets'); }
    } else if (key === 'canvas') {
      if (!record(slide.canvas) || (slide.canvas.enabled !== true && slide.canvas.applied !== true)
        || !record(slide.canvas.zones)) {
        throw Object.assign(new Error('Este card não usa zonas de canvas editáveis.'), {
          code: 'visual_canvas_unavailable', status: 409,
        });
      }
      const canvas = slide.canvas;
      const zones = { ...(record(canvas.zones) ? canvas.zones : {}), ...value.zones };
      const merged = { ...canvas, zones };
      if (!same(merged, canvas)) { next.canvas = merged; changes.push('canvas.zones'); }
    } else if (key === 'overlayStyles') {
      const seen = new Set();
      const overlays = Array.isArray(next.overlays) ? next.overlays.map(item => {
        if (!record(item) || !own(value, item.id)) return item;
        seen.add(item.id);
        const updated = { ...item, ...value[item.id] };
        return same(updated, item) ? item : updated;
      }) : [];
      if (seen.size !== Object.keys(value).length) bad('patch.overlayStyles', 'Área adicional não encontrada em um dos cards selecionados.');
      if (!same(overlays, next.overlays || [])) { next.overlays = overlays; changes.push('overlayStyles'); }
    } else if (!same(slide[key], value)) {
      next[key] = value;
      changes.push(key);
    }
  }
  return { slide: changes.length ? next : slide, changes };
}

export function applyVisualPatchToEntry(entry, rawPatch, slideIds, { brandScope } = {}) {
  if (!record(entry) || !record(entry.doc) || !Array.isArray(entry.doc.slides)) {
    throw Object.assign(new Error('Documento do projeto inválido.'), { code: 'visual_project_invalid', status: 409 });
  }
  const patch = validateVisualPatch(rawPatch, { brandScope });
  const selected = validateSlideIds(slideIds);
  let sourceCta = null;
  if (patch.copyCtaFrom) {
    const sourceSlide = entry.doc.slides.find(slide => record(slide) && slide.id === patch.copyCtaFrom.slideId);
    const sourceOverlay = Array.isArray(sourceSlide?.overlays)
      ? sourceSlide.overlays.find(item => record(item) && item.id === patch.copyCtaFrom.overlayId) : null;
    if (!sourceOverlay || sourceOverlay.type !== 'cta'
      || typeof sourceOverlay.text !== 'string' || !sourceOverlay.text.trim()) {
      bad('patch.copyCtaFrom', 'O botão CTA de origem não foi encontrado neste projeto.');
    }
    sourceCta = normalizeOverlay({ ...sourceOverlay,
      ...(record(sourceOverlay.visual) ? sourceOverlay.visual : {}),
      type: 'cta', text: sourceOverlay.text });
  }
  const found = new Set();
  const changes = [];
  const slides = entry.doc.slides.map((slide, index) => {
    if (!record(slide) || (selected && !selected.has(slide.id))) return slide;
    if (selected) found.add(slide.id);
    if (sourceCta && slide.id === patch.copyCtaFrom.slideId) return slide;
    const result = applySlidePatch(slide, patch, sourceCta);
    if (result.changes.length) changes.push({ slideId: slide.id, index, fields: result.changes });
    return result.slide;
  });
  if (selected && found.size !== selected.size) {
    throw Object.assign(new Error('Um ou mais cards não existem neste projeto.'), { code: 'visual_slide_missing', status: 404 });
  }
  const brandChanges = [];
  let brand = entry.doc.brand;
  if (patch.brand) {
    if (!record(brand)) {
      throw Object.assign(new Error('Marca do projeto indisponível.'), { code: 'visual_brand_missing', status: 409 });
    }
    brand = { ...brand };
    for (const [key, value] of Object.entries(patch.brand)) {
      if (!same(brand[key], value)) { brand[key] = value; brandChanges.push(key); }
    }
  }
  const changed = changes.length > 0 || brandChanges.length > 0;
  return {
    entry: changed ? { ...entry, doc: { ...entry.doc, slides, ...(brandChanges.length ? { brand } : {}) } } : entry,
    changes, brandChanges, selectedSlideCount: selected?.size ?? entry.doc.slides.length,
  };
}

export function projectDesignView(project, { includeText = false } = {}) {
  const entry = project?.entry || {};
  const doc = entry.doc || {};
  const shareCode = typeof doc.shareCode === 'string'
    && /^[A-Z2-9]{8,12}$/.test(doc.shareCode.trim().toUpperCase())
    ? doc.shareCode.trim().toUpperCase()
    : '';
  const safeText = (value, maxLength = 500) => {
    if (typeof value !== 'string') return '';
    return value.replace(/data:[^\s"']+/gi, '[mídia]').slice(0, maxLength);
  };
  const safeValue = (key, value) => {
    if (key === 'canvas') {
      if (!record(value)) return undefined;
      const canvas = {};
      for (const field of ['enabled', 'applied', 'variant', 'preserveZones']) {
        if ((typeof value[field] === 'boolean' || typeof value[field] === 'string')
          && String(value[field]).length < 100) canvas[field] = value[field];
      }
      if (record(value.zones)) {
        canvas.zones = Object.fromEntries(Object.entries(value.zones)
          .filter(([zone, rect]) => ZONE_KEYS.has(zone) && record(rect))
          .map(([zone, rect]) => [zone, Object.fromEntries(['x', 'y', 'w', 'h']
            .filter(axis => typeof rect[axis] === 'number' && Number.isFinite(rect[axis]))
            .map(axis => [axis, rect[axis]]))]));
      }
      return canvas;
    }
    if (key === 'textFonts') {
      if (!record(value)) return undefined;
      return Object.fromEntries(Object.entries(value).filter(([slot, family]) =>
        TEXT_FONT_KEYS.has(slot) && typeof family === 'string' && family.length <= 300
        && !family.includes('data:')));
    }
    if (key === 'elementOffsets') {
      if (!record(value)) return undefined;
      return Object.fromEntries(Object.entries(value).filter(([slot, offset]) =>
        (OFFSET_KEYS.has(slot) || /^ov_[A-Za-z0-9_-]{1,40}$/.test(slot))
        && record(offset) && Number.isFinite(offset.x) && Number.isFinite(offset.y))
        .map(([slot, offset]) => [slot, { x: offset.x, y: offset.y }]));
    }
    if (typeof value === 'string') return value.length <= 300 && !value.includes('data:') ? value : undefined;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    return typeof value === 'boolean' ? value : undefined;
  };
  const pickVisual = (source, schema) => Object.fromEntries(Object.keys(schema)
    .filter(key => own(source, key)).map(key => [key, safeValue(key, source[key])])
    .filter(([, value]) => value !== undefined));
  const brand = record(doc.brand) ? pickVisual(doc.brand, BRAND_VISUAL_FIELDS) : {};
  return {
    id: project.id, version: project.version, name: safeText(entry.name || entry.title, 160),
    format: safeText(doc.format || doc.formatId, 40),
    ...(shareCode ? {
      shareCode,
      shareUrl: `https://moont.ai/?share=${encodeURIComponent(shareCode)}&app=1`,
    } : {}),
    ...(includeText ? { caption: safeText(doc.caption, 10000) } : {}),
    slideCount: Array.isArray(doc.slides) ? doc.slides.length : 0,
    brand,
    slides: (Array.isArray(doc.slides) ? doc.slides : []).map((slide, index) => ({
      id: safeText(slide.id), index,
      ...(includeText ? {
        title: safeText(slide.title, 500),
        subtitle: safeText(slide.subtitle, 4000),
        bodyAfterImage: safeText(slide.bodyAfterImage, 6000),
        caption: safeText(slide.caption, 8000),
        imageQuery: safeText(slide.imageQuery, 1000),
      } : {}),
      visual: pickVisual(slide, SLIDE_VISUAL_FIELDS),
      overlays: Array.isArray(slide.overlays) ? slide.overlays.map(overlay => ({
        id: safeText(overlay.id), type: safeText(overlay.type),
        ...(includeText ? { text: safeText(overlay.text, 2000) } : {}),
        visual: pickVisual(overlay, OVERLAY_STYLE_FIELDS),
      })) : [],
      hasPhoto: Boolean(slide.bgImageAssetId || slide.bgImageId || slide.bgImage),
      hasLogo: Boolean(slide.logoImageId || slide.logoImage || doc.brand?.logoImageId || doc.brand?.logo),
    })),
  };
}
