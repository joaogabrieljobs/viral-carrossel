/** Métricas do quadro de pares, compartilhadas pela composição e pelo desenho. */
export const COMPARISON_PAIRS_TYPE = Object.freeze({
  bodyPx: 28, headerPx: 24, leading: 1.4,
  columnPadding: 18, rowPadding: 12, headerPadding: 14,
});

/** Altura natural; inclui quebras reais e o painel, sem reduzir fonte ou linhas. */
export function comparisonPairsHeight(block, { widthPx, lines, panel = false } = {}) {
  const m = COMPARISON_PAIRS_TYPE;
  const width = Math.max(1, (widthPx - (panel ? 80 : 0)) / 2 - m.columnPadding);
  const header = Math.max(...block.headers.map(value => lines(value.toUpperCase(), width, m.headerPx, true)))
    * m.headerPx * m.leading + m.headerPadding;
  const rows = block.rows.reduce((sum, row) => sum
    + Math.max(...row.map(value => lines(value, width, m.bodyPx, false))) * m.bodyPx * m.leading
    + m.rowPadding * 2, 0);
  return header + rows + (panel ? 72 : 0);
}
