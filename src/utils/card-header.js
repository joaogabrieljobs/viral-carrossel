/**
 * Textos da barra de cabeçalho do card (esq · centro · dir) sem repetir o @username.
 *
 * Bug (2026-09-15): template com `cultureHeaderLeft:'{handle}'` + fallback do centro
 * para `brand.handle` + chip do @ ligado mostrava o mesmo username três vezes.
 */

/** Normaliza para comparar: minúsculas, sem '@', sem espaços. */
export function normalizeHandleText(txt) {
  return String(txt || '').trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, '');
}

export function textIsHandle(txt, brand) {
  const h = normalizeHandleText(brand?.handle);
  const t = normalizeHandleText(txt);
  return !!h && !!t && h === t;
}

/** O chip "@username" com avatar está visível neste card? */
export function handleChipVisible(brand, slide, hideInstaBadge = false) {
  return !!(brand?.showHandle && slide?.showHandle && !hideInstaBadge && String(brand?.handle || '').trim());
}

/**
 * Centro da barra: preset define explicitamente (mesmo ''), senão cai no handle.
 * Quando o chip já mostra o handle, o centro não o repete.
 */
export function headerCenterText(brand, slide, hideInstaBadge = false) {
  const center = typeof brand?.cultureHeaderCenter === 'string'
    ? brand.cultureHeaderCenter.trim()
    : String(brand?.handle || '').trim();
  if (!center) return '';
  if (handleChipVisible(brand, slide, hideInstaBadge) && textIsHandle(center, brand)) return '';
  return center;
}

/**
 * Três colunas já resolvidas (tokens aplicados) → três colunas sem duplicar o handle:
 * com chip visível, nenhuma coluna repete o @; sem chip, o handle aparece no máximo uma vez.
 */
export function dedupeHeaderColumns({ left = '', center = '', right = '' }, brand, slide, hideInstaBadge = false) {
  const chip = handleChipVisible(brand, slide, hideInstaBadge);
  let seenHandle = chip;
  const out = {};
  for (const [k, v] of [['left', left], ['center', center], ['right', right]]) {
    const t = String(v || '').trim();
    if (t && textIsHandle(t, brand)) {
      out[k] = seenHandle ? '' : t;
      seenHandle = true;
    } else {
      out[k] = t;
    }
  }
  return out;
}
