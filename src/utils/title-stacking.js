/**
 * Título em várias linhas: a perna de uma linha (ç, Ç, g, j, p, q, y) não pode
 * encostar no acento da linha de baixo, e a perna da última linha não pode ser
 * cortada pela borda da caixa do título.
 *
 * A entrelinha de cada estilo é a do desenho dele e continua valendo. Só o
 * título em que uma perna fica de fato em cima de um acento (mesma faixa
 * horizontal, linhas vizinhas) recebe a entrelinha mínima que separa os dois:
 * perna + acento, medidos na fonte real. Títulos sem esse encontro não mudam.
 *
 * Medidas em `em` (múltiplos do corpo). A parte pura (`titleStackingFromGlyphs`)
 * recebe os glifos já medidos; `measureTitleStacking` lê o DOM do `<h1>`.
 */

/** Reserva sob a última linha quando a perna dela passa da caixa de linha. */
export const TITLE_BOTTOM_RESERVE_EM = 0.15;
/** Respiro entre a perna e o acento, para a tinta não ficar colada. */
const STACK_GAP_EM = 0.02;
/** Folga horizontal para contar perna e acento como vizinhos (em). */
const STACK_REACH_EM = 0.04;
/** Teto de segurança: acima disso é medida errada, não tipografia. */
const MAX_LEADING_EM = 1.6;

const PERNA = /[gjpqyçÇQ]/;
const ACENTO = /[áàâãäéèêëíìîïóòôõöúùûüñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÑ]/;

/**
 * Reserva inferior do título, em px: sempre pelo menos 0,15 em. Sem ela, nas
 * fontes altas (Anton, Oswald) a área da letra passa da caixa de linha, o
 * título ancorado embaixo "transborda" sempre e o ajuste automático o reduz à
 * toa; e a perna da última linha fica rente à borda que recorta.
 */
export function titleBottomReservePx(fontPx, styleReservePx = 0, measuredEm = 0) {
  return Math.max(Number(styleReservePx) || 0, fontPx * Math.max(TITLE_BOTTOM_RESERVE_EM, Number(measuredEm) || 0));
}

/** Sem perna no texto não há o que medir. */
export function titleHasStackingRisk(text) {
  return PERNA.test(String(text || ''));
}

const round3 = (value) => Math.ceil(value * 1000) / 1000;

/**
 * @param {object} input
 * @param {{ ch: string, top: number, x0: number, x1: number, desc?: number, asc?: number }[]} input.glyphs
 *   Glifos com perna ou acento: `top` é o topo da linha (px), `x0`–`x1` a faixa
 *   horizontal (px), `desc`/`asc` a tinta abaixo/acima da linha de base (em).
 * @param {number} input.fontPx corpo do título, na mesma unidade de `top` e `x`
 * @param {number} input.leading entrelinha atual (em)
 * @param {number} [input.fontAscent] ascendente da fonte (em), para a caixa de linha
 * @param {number} [input.fontDescent] descendente da fonte (em)
 * @param {number} [input.paddingBottomEm] reserva inferior que o título já tem
 * @param {number} [input.firstLineTop] topo da primeira linha (px); sem ele, o do primeiro glifo
 * @param {number} [input.lineCount] linhas do título; sem ele, até a última com glifo
 * @returns {{ leading: number, reserve: number }} entrelinha mínima e reserva
 *   inferior a aplicar; 0 quando o título fica como está.
 */
export function titleStackingFromGlyphs({ glyphs = [], fontPx = 0, leading = 0, fontAscent, fontDescent, paddingBottomEm = 0, firstLineTop, lineCount } = {}) {
  if (!(fontPx > 0) || !glyphs.length) return { leading: 0, reserve: 0 };
  // Linha de cada glifo pelo topo: uma entrelinha separa linhas vizinhas. Linha
  // sem perna nem acento não tem glifo aqui, e mesmo assim conta como linha.
  const linePx = fontPx * Math.max(0.4, leading);
  const firstTop = Number.isFinite(firstLineTop) ? firstLineTop : Math.min(...glyphs.map((glyph) => glyph.top));
  const lineOf = (glyph) => Math.max(0, Math.round((glyph.top - firstTop) / linePx));
  const lines = [];
  for (const glyph of glyphs) (lines[lineOf(glyph)] ||= []).push(glyph);
  const total = Math.max(lines.length, Number.isFinite(lineCount) ? Math.round(lineCount) : 0);
  for (let i = 0; i < total; i += 1) lines[i] ||= [];

  // Perna e acento se encontram quando as caixas dos dois glifos dividem a
  // mesma faixa horizontal, ou quase: a cedilha e o til passam um pouco da
  // caixa da letra, e vizinhos na diagonal também se tocam.
  const reach = fontPx * STACK_REACH_EM;
  let needed = 0;
  for (let i = 0; i + 1 < lines.length; i += 1) {
    for (const above of lines[i]) {
      if (!(above.desc > 0.03)) continue;
      for (const below of lines[i + 1]) {
        if (!(below.asc > 0) || !ACENTO.test(below.ch)) continue;
        const overlap = Math.min(above.x1, below.x1) - Math.max(above.x0, below.x0);
        if (overlap > -reach) needed = Math.max(needed, above.desc + below.asc + STACK_GAP_EM);
      }
    }
  }
  const floor = needed > leading + 0.004 ? Math.min(MAX_LEADING_EM, round3(needed)) : 0;

  // Última linha: a caixa de linha termina em descendente − meia sobra da
  // entrelinha. Perna que passa disso (e da reserva atual) seria cortada.
  let reserve = 0;
  const last = lines[lines.length - 1] || [];
  const lastDesc = Math.max(0, ...last.map((glyph) => glyph.desc || 0));
  if (lastDesc > 0.03 && Number.isFinite(fontAscent) && Number.isFinite(fontDescent)) {
    const effective = floor || leading;
    const lineBoxBelowBaseline = fontDescent + (effective - (fontAscent + fontDescent)) / 2;
    const spill = lastDesc - lineBoxBelowBaseline + STACK_GAP_EM;
    if (spill > paddingBottomEm + 0.004) reserve = round3(Math.max(TITLE_BOTTOM_RESERVE_EM, spill));
  }
  return { leading: floor, reserve };
}

let measureCanvas = null;

/**
 * Lê o `<h1>` do título já desenhado e devolve a entrelinha mínima e a reserva
 * inferior de que ele precisa (0 = fica como está). Só no navegador.
 */
export function measureTitleStacking(h1) {
  const none = { leading: 0, reserve: 0 };
  if (!h1 || typeof document === 'undefined' || typeof window === 'undefined') return none;
  const raw = h1.textContent || '';
  if (!titleHasStackingRisk(raw)) return none;
  const cs = window.getComputedStyle(h1);
  const fontPx = parseFloat(cs.fontSize);
  const lineHeightPx = parseFloat(cs.lineHeight);
  if (!(fontPx > 0) || !(lineHeightPx > 0)) return none;
  measureCanvas = measureCanvas || document.createElement('canvas');
  const ctx = measureCanvas.getContext?.('2d');
  if (!ctx) return none;
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${fontPx}px ${cs.fontFamily}`;
  const shown = (ch) => (cs.textTransform === 'uppercase' ? ch.toUpperCase() : cs.textTransform === 'lowercase' ? ch.toLowerCase() : ch);
  const cache = new Map();
  const ink = (ch) => {
    if (!cache.has(ch)) {
      const m = ctx.measureText(ch);
      cache.set(ch, { desc: (m.actualBoundingBoxDescent || 0) / fontPx, asc: (m.actualBoundingBoxAscent || 0) / fontPx });
    }
    return cache.get(ch);
  };
  // Retângulos do DOM vêm em px de tela (a pré-visualização é reduzida por
  // `zoom` ou `scale`); o estilo computado, em px de layout. A razão entre a
  // largura desenhada e a computada põe o corpo na unidade dos retângulos.
  const box = h1.getBoundingClientRect();
  const padTop = parseFloat(cs.paddingTop) || 0;
  const padBottom = parseFloat(cs.paddingBottom) || 0;
  const layoutWidth = (parseFloat(cs.width) || 0)
    + (cs.boxSizing === 'border-box' ? 0 : (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0));
  if (!(layoutWidth > 0) || !(box.width > 0)) return none;
  const k = box.width / layoutWidth;
  const glyphs = [];
  // 4 = NodeFilter.SHOW_TEXT (só nós de texto).
  const walker = document.createTreeWalker(h1, 4);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue || '';
    for (let i = 0; i < value.length; i += 1) {
      const ch = shown(value[i]);
      const perna = PERNA.test(ch);
      const acento = ACENTO.test(ch);
      if (!perna && !acento) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getClientRects()[0];
      if (!rect || rect.width <= 0) continue;
      const m = ink(ch);
      glyphs.push({ ch, top: rect.top, x0: rect.left, x1: rect.right, desc: perna ? m.desc : 0, asc: acento ? m.asc : 0 });
    }
  }
  if (!glyphs.length) return none;
  const face = ctx.measureText('Hg');
  return titleStackingFromGlyphs({
    glyphs,
    fontPx: fontPx * k,
    firstLineTop: box.top + padTop * k,
    lineCount: Math.max(1, Math.round((box.height / k - padTop - padBottom) / lineHeightPx)),
    leading: lineHeightPx / fontPx,
    fontAscent: Number.isFinite(face.fontBoundingBoxAscent) ? face.fontBoundingBoxAscent / fontPx : undefined,
    fontDescent: Number.isFinite(face.fontBoundingBoxDescent) ? face.fontBoundingBoxDescent / fontPx : undefined,
    paddingBottomEm: padBottom / fontPx,
  });
}
