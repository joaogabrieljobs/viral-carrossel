/**
 * Posição livre dos elementos do card.
 *
 * Cada elemento (título, foto, barra editorial, selo, ornamentos…) tem um
 * deslocamento próprio guardado em `slide.elementOffsets[chave] = {x, y}`, em
 * PERCENTAGEM das dimensões do card — não em px. Assim o mesmo carrossel
 * exportado em 1080×1350, 1080×1080 ou 1080×1920 mantém a composição.
 *
 * O deslocamento é aplicado com `transform: translate()`, nunca mexendo em
 * `left/top/margin`: a posição base continua a ser a do layout (flex ou
 * absoluta), e o arrasto só empurra a partir dali. Duas consequências boas —
 * o layout responsivo continua a funcionar por baixo, e zerar o offset devolve
 * o elemento exatamente ao lugar de origem.
 *
 * É por slide, não por marca: quem arrasta o selo no card 3 espera mexer no
 * card 3, não nos sete.
 */

/** Elementos que podem ser arrastados, na ordem em que aparecem no painel. */
export const MOVABLE_ELEMENTS = [
  { key: 'text', label: 'Bloco de texto' },
  { key: 'photo', label: 'Foto' },
  { key: 'headerBar', label: 'Barra editorial' },
  { key: 'pageBadge', label: 'Contador N/M' },
  { key: 'handleBadge', label: 'Badge do @' },
  { key: 'logo', label: 'Logo' },
  { key: 'star', label: 'Estrela' },
  { key: 'pill', label: 'Selo do rodapé' },
  { key: 'footerBar', label: 'Barra do rodapé' },
];

export const MOVABLE_ELEMENT_KEYS = MOVABLE_ELEMENTS.map((e) => e.key);

/** Limite do arrasto, em % do card. Deixa sair da borda mas não sumir. */
const LIMITE_PCT = 60;

export function clampOffsetPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-LIMITE_PCT, Math.min(LIMITE_PCT, n));
}

/** Offset guardado de um elemento, sempre um objeto `{x, y}` válido. */
export function getElementOffset(slide, chave) {
  const raw = slide?.elementOffsets?.[chave];
  if (!raw || typeof raw !== 'object') return { x: 0, y: 0 };
  return { x: clampOffsetPct(raw.x), y: clampOffsetPct(raw.y) };
}

export function hasElementOffset(slide, chave) {
  const { x, y } = getElementOffset(slide, chave);
  return x !== 0 || y !== 0;
}

/**
 * Estilo a fundir no elemento. Devolve `undefined` quando não há deslocamento,
 * para não criar um contexto de empilhamento à toa em card sem edição.
 */
export function elementOffsetStyle(slide, chave, f) {
  const { x, y } = getElementOffset(slide, chave);
  if (x === 0 && y === 0) return undefined;
  return { transform: `translate(${(f.w * x) / 100}px, ${(f.h * y) / 100}px)` };
}

/** Aplica um delta em px do card ao offset atual e devolve o novo, em %. */
export function offsetAfterDrag(slide, chave, dxPx, dyPx, f) {
  const atual = getElementOffset(slide, chave);
  return {
    x: clampOffsetPct(atual.x + (dxPx / f.w) * 100),
    y: clampOffsetPct(atual.y + (dyPx / f.h) * 100),
  };
}

/**
 * Patch que repõe um elemento (ou todos, sem `chave`) no lugar do layout.
 * Devolve o patch para `updateSlide`, não o slide inteiro.
 */
export function resetElementOffsetsPatch(slide, chave = null) {
  if (!chave) return { elementOffsets: {} };
  const next = { ...(slide?.elementOffsets || {}) };
  delete next[chave];
  return { elementOffsets: next };
}
