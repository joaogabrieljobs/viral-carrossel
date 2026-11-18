import { describe, it, expect } from 'vitest';
import { titleLetterSpacingEm, titleTrackingBase } from '../../src/utils/title-tracking.js';

// Conferência visual de 18/11/2026: o título do Tabloid (Anton) saía com as
// letras coladas. Todo título recebia −3% de espaçamento, bom para grotesca
// larga e ruim para fonte condensada, que já nasce estreita.
describe('espaçamento de letras do título por tipo de fonte', () => {
  it('fonte condensada não recebe o aperto de −3%', () => {
    for (const fonte of ['"Anton", sans-serif', '"Bebas Neue", sans-serif', '"Oswald", sans-serif', '"Barlow Condensed", sans-serif']) {
      expect(titleTrackingBase(fonte), fonte).toBeGreaterThan(0);
      expect(titleLetterSpacingEm(fonte, 0), fonte).toBeGreaterThan(0);
    }
  });

  it('as demais fontes mantêm o aperto de display', () => {
    for (const fonte of ['"Archivo Black", sans-serif', '"Inter Tight", sans-serif', '"Playfair Display", serif', '', undefined]) {
      expect(titleTrackingBase(fonte), String(fonte)).toBe(-3);
    }
    expect(titleLetterSpacingEm('"Inter Tight", sans-serif', 0)).toBeCloseTo(-0.03, 10);
  });

  it('o ajuste da pessoa soma sobre a base da fonte', () => {
    expect(titleLetterSpacingEm('"Anton", sans-serif', 2)).toBeCloseTo(0.035, 10);
    expect(titleLetterSpacingEm('"Inter Tight", sans-serif', 2)).toBeCloseTo(-0.01, 10);
    expect(titleLetterSpacingEm('"Anton", sans-serif', 'x')).toBeCloseTo(0.015, 10);
  });
});
