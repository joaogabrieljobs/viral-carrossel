/**
 * Espaçamento de letras do título conforme o desenho da fonte.
 *
 * Título de display costuma ganhar um aperto leve (−3%): fecha os brancos de
 * uma grotesca larga em corpo grande. Fonte condensada já nasce estreita; com
 * o mesmo aperto as letras se encostam e o título perde leitura. Para essas a
 * base é levemente aberta.
 */
const CONDENSADAS = /(Anton|Bebas Neue|Oswald|Barlow Condensed|League Gothic|Big Shoulders|Fjalla One|Pathway Gothic)/i;

/** Base em centésimos de em, antes do ajuste que a pessoa fizer. */
export function titleTrackingBase(fontFamily) {
  return CONDENSADAS.test(String(fontFamily || '')) ? 1.5 : -3;
}

/** Espaçamento final em em: base da fonte + ajuste do card. */
export function titleLetterSpacingEm(fontFamily, tracking = 0) {
  const ajuste = Number(tracking);
  return (titleTrackingBase(fontFamily) + (Number.isFinite(ajuste) ? ajuste : 0)) / 100;
}
