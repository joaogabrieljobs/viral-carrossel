/** Fontes escolhidas para um único texto de um único card. */
export const CARD_TEXT_FONT_KEYS = Object.freeze([
  'title', 'subtitle', 'eyebrow', 'bodyAfterImage', 'offer',
  'headerBar', 'pageBadge', 'handleBadge', 'pill', 'footerBar',
]);

const FONT_KEYS = new Set(CARD_TEXT_FONT_KEYS);

/** Mantém famílias CSS (inclusive fontes da marca) sem aceitar declarações CSS. */
export function normalizeTextFont(value) {
  if (typeof value !== 'string') return '';
  const font = value.trim();
  return font.length <= 300 && !/[;{}<>\u0000-\u001f\u007f]/.test(font) ? font : '';
}

export function getTextFont(slide, key, fallback) {
  return (FONT_KEYS.has(key) && normalizeTextFont(slide?.textFonts?.[key])) || fallback;
}

/** Arquivos removidos usam a reserva CSS, sem apagar a escolha salva. */
export function availableTextFont(fontFamily, brand) {
  const font = normalizeTextFont(fontFamily);
  const families = font.split(',').map(value => value.trim());
  while (/^["']?VCBrand(?:Title|Body)-/.test(families[0] || '')) {
    const first = families[0].replace(/^["']|["']$/g, '');
    const kind = first.startsWith('VCBrandTitle-') ? 'Title' : 'Body';
    const file = brand?.[`custom${kind}Font`];
    if (first === `VCBrand${kind}-${brand?.id || 'default'}` && file?.dataUrl && file?.format) break;
    families.shift();
  }
  return families.join(', ');
}

export function resolveSlideTextFonts(slide, brand) {
  let changed = false;
  const textFonts = { ...slide.textFonts };
  for (const key of CARD_TEXT_FONT_KEYS) {
    if (!textFonts[key]) continue;
    const resolved = availableTextFont(textFonts[key], brand);
    if (resolved !== textFonts[key]) { textFonts[key] = resolved; changed = true; }
  }
  const overlays = slide.overlays?.map(overlay => {
    if (!overlay?.fontFamily) return overlay;
    const resolved = availableTextFont(overlay.fontFamily, brand);
    if (resolved === overlay.fontFamily) return overlay;
    changed = true;
    return { ...overlay, fontFamily: resolved };
  });
  return changed ? { ...slide, textFonts, ...(overlays ? { overlays } : {}) } : slide;
}

/** Valor vazio volta a herdar o estilo; não altera outros textos nem o slide. */
export function textFontPatch(slide, key, fontFamily) {
  const textFonts = {};
  for (const slot of CARD_TEXT_FONT_KEYS) {
    const font = normalizeTextFont(slide?.textFonts?.[slot]);
    if (font) textFonts[slot] = font;
  }
  if (FONT_KEYS.has(key)) {
    const font = normalizeTextFont(fontFamily);
    if (font) textFonts[key] = font;
    else delete textFonts[key];
  }
  return { textFonts };
}
