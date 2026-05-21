/** Funções de contraste WCAG 2.x para validar combinações fg × bg. Sem dependências. */

/** Luminância relativa WCAG 2.x. Input: hex (#rgb ou #rrggbb). Output: 0..1. */
export function wcagLuminance(hex) {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(hex || '').trim());
  if (!m) return 0;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const ch = (s) => {
    const v = parseInt(s, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(h.slice(0, 2)) + 0.7152 * ch(h.slice(2, 4)) + 0.0722 * ch(h.slice(4, 6));
}

/** Ratio de contraste (1..21).
 *  - >= 4.5 passa AA body
 *  - >= 3   passa AA large text / AAA-large
 *  - >= 7   passa AAA body. */
export function wcagContrast(fg, bg) {
  const L1 = wcagLuminance(fg);
  const L2 = wcagLuminance(bg);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}
