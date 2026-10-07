export const CUSTOM_VISUAL_PRESETS_KEY = 'vc_custom_visual_presets_v1';
export const MAX_CUSTOM_VISUAL_PRESETS = 24;

const BRAND_FIELDS = [
  'bg', 'bgAlternate', 'interleaveBg',
  'titleColor', 'subtitleColor', 'textColor', 'accent',
  'titleFont', 'bodyFont',
  'textTitleWeight', 'textTitleCase', 'textTitleTracking', 'subtitleFont',
  'textTitleSize', 'textSubSize', 'textBodyAfterSize',
  'textSubTracking', 'textTitleLeading', 'textSubLeading',
  // O corpo da apresentação tem ritmo próprio. Sem estes tokens, salvar
  // um padrão personalizado e reaplicá-lo mudava peso e entrelinha.
  'bodyWeight', 'textBodyTracking', 'textBodyLeading',
  'cultureHeaderLeft', 'cultureHeaderCenter', 'cultureHeaderYear',
  'footerPillText', 'footerPillBg', 'footerPillFg', 'footerPillArrow',
  'footerBarLeft', 'footerBarCenter', 'footerBarRight',
  'showPageBadge', 'showStarOrnament',
  'subtitleVisible', 'subtitleWeight', 'subtitleCase', 'subtitleItalic',
];

const SLIDE_FIELDS = [
  'layout', 'align', 'composition', 'canvas', 'elementOffsets', 'elementsUnlocked',
  'photoRegion', 'overlay', 'bgOpacity', 'bgFit',
  'bgX', 'bgY', 'bgZoom', 'bgMirror',
  'textShadow', 'textBg', 'textBgOpacity', 'textInset',
  'titleSize', 'subSize', 'bodyAfterSize',
  'titleTracking', 'subTracking', 'titleLeading', 'subLeading',
  'bodyTracking', 'bodyLeading', 'bodyWeight',
  'titleCase', 'titleWeight', 'bgPattern', 'cultureTone', 'useCultureLayout',
  'eyebrowText', 'strikethroughText', 'afterTitleText',
  // Tokens visuais editáveis do deck. IDs/composições oficiais não fazem
  // parte desta lista e, portanto, nunca entram no banco de padrões pessoais.
  'presentationGlass',
  'presentationTitleSizeByComposition',
  'presentationTitleLeadingByComposition',
  'presentationTypographyByComposition',
];

const CUSTOM_CANVAS_FIELDS = [
  'enabled', 'applied', 'variant', 'preserveZones', 'source',
];
const CUSTOM_CANVAS_ZONE_KEYS = ['photo', 'title', 'subtitle', 'top', 'bottom'];

const PRESENTATION_TYPOGRAPHY_PROFILES = [
  'cover', 'content', 'divider', 'data', 'demo', 'closing',
];
const PRESENTATION_TYPOGRAPHY_FIELDS = [
  'role', 'fontFamily', 'sizePercent', 'leadingPercent',
  'weight', 'tracking', 'case', 'italic',
];
const PRESENTATION_GLASS_FIELDS = [
  'enabled', 'background', 'backdropBlur', 'border', 'radius',
  'innerShadow', 'boxShadow', 'applyTo',
];

function clonePlainValue(value, depth = 0) {
  if (depth > 8) return undefined;
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => clonePlainValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (typeof value !== 'object') return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
    const cloned = clonePlainValue(item, depth + 1);
    if (cloned !== undefined) out[key] = cloned;
  }
  return out;
}

function sanitizeNumericProfileMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out = {};
  for (const profile of PRESENTATION_TYPOGRAPHY_PROFILES) {
    const token = Number(value[profile]);
    if (Number.isFinite(token)) out[profile] = token;
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizePresentationTypography(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out = {};
  for (const profile of PRESENTATION_TYPOGRAPHY_PROFILES) {
    const sourceProfile = value[profile];
    if (!sourceProfile || typeof sourceProfile !== 'object' || Array.isArray(sourceProfile)) continue;
    const nextProfile = {};
    for (const slot of ['title', 'subtitle']) {
      const sourceSlot = sourceProfile[slot];
      if (!sourceSlot || typeof sourceSlot !== 'object' || Array.isArray(sourceSlot)) continue;
      const nextSlot = {};
      for (const field of PRESENTATION_TYPOGRAPHY_FIELDS) {
        const cloned = clonePlainValue(sourceSlot[field]);
        if (cloned !== undefined && !Array.isArray(cloned) && typeof cloned !== 'object') {
          nextSlot[field] = cloned;
        }
      }
      if (Object.keys(nextSlot).length) nextProfile[slot] = nextSlot;
    }
    if (Object.keys(nextProfile).length) out[profile] = nextProfile;
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizePresentationGlass(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out = {};
  for (const field of PRESENTATION_GLASS_FIELDS) {
    if (field === 'applyTo') {
      if (Array.isArray(value.applyTo)) {
        out.applyTo = value.applyTo
          .filter((item) => PRESENTATION_TYPOGRAPHY_PROFILES.includes(item));
      }
      continue;
    }
    const cloned = clonePlainValue(value[field]);
    if (cloned !== undefined && !Array.isArray(cloned) && typeof cloned !== 'object') {
      out[field] = cloned;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeCanvasRect(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const rect = {};
  for (const field of ['x', 'y', 'w', 'h']) {
    const token = Number(value[field]);
    if (Number.isFinite(token)) rect[field] = token;
  }
  return Object.keys(rect).length === 4 ? rect : undefined;
}

function sanitizeCustomCanvas(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out = {};
  for (const field of CUSTOM_CANVAS_FIELDS) {
    const cloned = clonePlainValue(value[field]);
    if (cloned !== undefined && !Array.isArray(cloned) && typeof cloned !== 'object') out[field] = cloned;
  }
  const zones = {};
  for (const key of CUSTOM_CANVAS_ZONE_KEYS) {
    const rect = sanitizeCanvasRect(value.zones?.[key]);
    if (rect) zones[key] = rect;
  }
  if (Object.keys(zones).length) out.zones = zones;
  return out.variant && out.zones ? out : undefined;
}

function sanitizeElementOffsets(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out = {};
  for (const [key, offset] of Object.entries(value)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,40}$/.test(key)) continue;
    if (!offset || typeof offset !== 'object' || Array.isArray(offset)) continue;
    const x = Number(offset.x);
    const y = Number(offset.y);
    if (Number.isFinite(x) && Number.isFinite(y)) out[key] = { x, y };
  }
  return Object.keys(out).length ? out : undefined;
}

function clonePresetField(field, value) {
  if (field === 'canvas') return sanitizeCustomCanvas(value);
  if (field === 'elementOffsets') return sanitizeElementOffsets(value);
  if (field === 'presentationTitleSizeByComposition'
    || field === 'presentationTitleLeadingByComposition') {
    return sanitizeNumericProfileMap(value);
  }
  if (field === 'presentationTypographyByComposition') {
    return sanitizePresentationTypography(value);
  }
  if (field === 'presentationGlass') return sanitizePresentationGlass(value);
  return clonePlainValue(value);
}

function pick(source, fields) {
  const out = {};
  for (const field of fields) {
    if (source?.[field] === undefined) continue;
    const cloned = clonePresetField(field, source[field]);
    if (cloned !== undefined) out[field] = cloned;
  }
  return out;
}

export function sanitizeCustomVisualPresetBrand(value) {
  return pick(value, BRAND_FIELDS);
}

export function sanitizeCustomVisualPresetSlideDefaults(value) {
  return pick(value, SLIDE_FIELDS);
}

export function normalizeCustomVisualPresets(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value
    .filter((item) => item && typeof item === 'object' && item.isCustom === true)
    .map((item) => ({
      id: String(item.id || '').slice(0, 80),
      label: String(item.label || 'Meu padrão').trim().slice(0, 50) || 'Meu padrão',
      desc: String(item.desc || 'Padrão visual personalizado salvo por você.').slice(0, 140),
      isCustom: true,
      brand: sanitizeCustomVisualPresetBrand(item.brand),
      slideDefaults: sanitizeCustomVisualPresetSlideDefaults(item.slideDefaults),
      creativePreset: typeof item.creativePreset === 'string' ? item.creativePreset : undefined,
      productKind: item.productKind === 'apresentacao' || item.creativePreset === 'apresentacao'
        ? 'apresentacao'
        : 'carrossel',
      aspectRatio: item.productKind === 'apresentacao' || item.creativePreset === 'apresentacao'
        ? '16:9'
        : '4:5',
      savedAt: Number(item.savedAt) || Date.now(),
    }))
    .filter((item) => item.id && !ids.has(item.id) && ids.add(item.id))
    .slice(-MAX_CUSTOM_VISUAL_PRESETS);
}

export function readCustomVisualPresets(storage = globalThis?.localStorage) {
  try {
    return normalizeCustomVisualPresets(JSON.parse(storage?.getItem(CUSTOM_VISUAL_PRESETS_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function writeCustomVisualPresets(presets, storage = globalThis?.localStorage) {
  const normalized = normalizeCustomVisualPresets(presets);
  try {
    storage?.setItem(CUSTOM_VISUAL_PRESETS_KEY, JSON.stringify(normalized));
  } catch {
    return false;
  }
  return true;
}

export function createCustomVisualPreset({ label, brand = {}, slide = {}, creativePreset, productKind } = {}) {
  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  return {
    id: `custom_${now.toString(36)}_${rand}`,
    label: String(label || 'Meu padrão').trim().slice(0, 50) || 'Meu padrão',
    desc: 'Paleta, tipografia, layout e glass personalizados.',
    isCustom: true,
    brand: {
      ...sanitizeCustomVisualPresetBrand(brand),
      // Trocar de padrão nunca pode apagar texto que já existe no card.
      subtitleVisible: true,
    },
    slideDefaults: sanitizeCustomVisualPresetSlideDefaults(slide),
    creativePreset,
    productKind: productKind === 'apresentacao' || creativePreset === 'apresentacao'
      ? 'apresentacao'
      : 'carrossel',
    aspectRatio: productKind === 'apresentacao' || creativePreset === 'apresentacao'
      ? '16:9'
      : '4:5',
    savedAt: now,
  };
}
