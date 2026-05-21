import React from 'react';
import { wcagContrast } from '../utils/wcag.js';

/** Badge visual indicando o nível WCAG do contraste fg × bg.
 *  Níveis:
 *    - AAA (verde escuro): >= 7 (body) ou >= 4.5 (large)
 *    - AA  (verde):        >= 4.5 (body) ou >= 3 (large)
 *    - A   (amarelo):      >= 3 — só legal para texto grande/títulos
 *    - ✗   (vermelho):     < 3 — reprovado, difícil de ler
 *
 *  `kind='body'` (default) pra texto corrido, `kind='large'` pra títulos. */
export default function WcagBadge({ fg, bg, kind = 'body' }) {
  const ratio = wcagContrast(fg, bg);
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  const threshold = kind === 'large' ? 3 : 4.5;
  const aaa = kind === 'large' ? 4.5 : 7;
  let level, bgCol, fgCol, tip;
  if (ratio >= aaa) {
    level = 'AAA';
    bgCol = 'rgba(52, 199, 89, 0.18)';
    fgCol = '#34c759';
    tip = `Contraste ${ratio.toFixed(1)}:1 — excelente (AAA).`;
  } else if (ratio >= threshold) {
    level = 'AA';
    bgCol = 'rgba(52, 199, 89, 0.12)';
    fgCol = '#30b352';
    tip = `Contraste ${ratio.toFixed(1)}:1 — aprovado (AA).`;
  } else if (ratio >= 3) {
    level = 'A';
    bgCol = 'rgba(245, 158, 11, 0.18)';
    fgCol = '#d97706';
    tip = `Contraste ${ratio.toFixed(1)}:1 — fraco. Mínimo legal só para texto grande/títulos.`;
  } else {
    level = '✗';
    bgCol = 'rgba(255, 59, 48, 0.18)';
    fgCol = '#ff3b30';
    tip = `Contraste ${ratio.toFixed(1)}:1 — reprovado. Difícil de ler.`;
  }
  return (
    <span
      title={tip}
      style={{
        fontSize: 9,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 9999,
        background: bgCol,
        color: fgCol,
        letterSpacing: '0.04em',
        flexShrink: 0,
        fontFamily: 'var(--font-mono)',
        cursor: 'help',
      }}
    >
      {level} · {ratio.toFixed(1)}
    </span>
  );
}
