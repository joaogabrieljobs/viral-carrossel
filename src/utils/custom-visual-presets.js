export const CUSTOM_VISUAL_PRESETS_KEY = 'vc_custom_visual_presets_v1';
export const MAX_CUSTOM_VISUAL_PRESETS = 24;

const BRAND_FIELDS = [
  'bg', 'bgAlternate', 'interleaveBg',
  'titleColor', 'subtitleColor', 'textColor', 'accent',
  'titleFont', 'bodyFont',
  'textTitleWeight', 'textTitleCase', 'textTitleTracking',
  'textTitleLeading', 'textSubLeading',
  'cultureHeaderLeft', 'cultureHeaderCenter', 'cultureHeaderYear',
  'footerPillText', 'footerPillBg', 'footerPillFg', 'footerPillArrow',
  'footerBarLeft', 'footerBarCenter', 'footerBarRight',
  'showPageBadge', 'showStarOrnament',
  'subtitleVisible', 'subtitleWeight', 'subtitleCase', 'subtitleItalic',
];

const SLIDE_FIELDS = [
  'layout', 'align', 'photoRegion', 'overlay', 'bgOpacity', 'bgFit',
  'textShadow', 'textBg', 'textBgOpacity', 'textInset',
  'titleSize', 'subSize', 'bodyAfterSize',
  'titleTracking', 'subTracking', 'titleLeading', 'subLeading',
  'titleCase', 'titleWeight', 'bgPattern', 'cultureTone', 'useCultureLayout',
  'eyebrowText', 'strikethroughText', 'afterTitleText',
];

function pick(source, fields) {
  const out = {};
  for (const field of fields) {
    if (source?.[field] !== undefined) out[field] = source[field];
  }
  return out;
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
      brand: pick(item.brand, BRAND_FIELDS),
      slideDefaults: pick(item.slideDefaults, SLIDE_FIELDS),
      creativePreset: typeof item.creativePreset === 'string' ? item.creativePreset : undefined,
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

export function createCustomVisualPreset({ label, brand = {}, slide = {}, creativePreset } = {}) {
  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  return {
    id: `custom_${now.toString(36)}_${rand}`,
    label: String(label || 'Meu padrão').trim().slice(0, 50) || 'Meu padrão',
    desc: 'Paleta, tipografia, layout e glass personalizados.',
    isCustom: true,
    brand: {
      ...pick(brand, BRAND_FIELDS),
      // Trocar de padrão nunca pode apagar texto que já existe no card.
      subtitleVisible: true,
    },
    slideDefaults: pick(slide, SLIDE_FIELDS),
    creativePreset,
    savedAt: now,
  };
}
