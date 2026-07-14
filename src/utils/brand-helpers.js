/** Normaliza marca: campo legado `subColor` migra para `textColor` e `subtitleColor` quando omitidos; remove `subColor` gravado para evitar duplicidade. */
export function hydrateBrandTextColors(b) {
  if (!b || typeof b !== 'object') return b;
  const legacySub =
    typeof b.subColor === 'string' && b.subColor.trim() ? String(b.subColor).trim() : '';
  const textRaw = typeof b.textColor === 'string' && b.textColor.trim() ? String(b.textColor).trim() : '';
  const subLineRaw =
    typeof b.subtitleColor === 'string' && b.subtitleColor.trim()
      ? String(b.subtitleColor).trim()
      : '';
  const textColor = textRaw || legacySub || '#515154';
  const subtitleColor = subLineRaw || legacySub || textColor;
  const { subColor: _, ...rest } = b;
  return { ...rest, textColor, subtitleColor };
}

/** Face CSS única por perfil de marca pro título (evita colisão entre perfis e Google Fonts). */
export const vcCustomTitleFace = (brandId) => `VCBrandTitle-${brandId || 'default'}`;

/** Fonte carregada primeiro; a lista Google abaixo é reserva (fallback). */
export function effectiveTitleFontFamily(brand) {
  if (!brand) return '"Inter", sans-serif';
  return brand.customTitleFont?.dataUrl
    ? `${vcCustomTitleFace(brand.id)}, ${brand.titleFont}`
    : brand.titleFont;
}

/** Resolve o background de um slide: customBg > bgAlternate intercalado > bg base da marca. */
export function resolveSlideBrandBg(brand, slideIndex0, slide) {
  if (slide?.customBg) return slide.customBg;
  const alt = typeof brand?.bgAlternate === 'string' ? brand.bgAlternate.trim() : '';
  if (brand?.interleaveBg && alt) {
    const primary = brand.bg || '#fafafc';
    return slideIndex0 % 2 === 0 ? primary : alt;
  }
  return brand?.bg || '#fafafc';
}
