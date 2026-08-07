// Task 02 — RF-03: contraste WCAG 2.x.
import { describe, it, expect } from 'vitest';
import { wcagLuminance, wcagContrast } from '../../src/utils/wcag.js';

describe('wcagLuminance', () => {
  it('preto=0, branco=1', () => {
    expect(wcagLuminance('#000000')).toBe(0);
    expect(wcagLuminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('hex curto #rgb expande para #rrggbb', () => {
    expect(wcagLuminance('#fff')).toBeCloseTo(wcagLuminance('#ffffff'), 10);
  });

  it('hex inválido retorna 0 sem lançar', () => {
    expect(wcagLuminance('azul')).toBe(0);
    expect(wcagLuminance('')).toBe(0);
    expect(wcagLuminance(null)).toBe(0);
  });
});

describe('wcagContrast', () => {
  it('preto sobre branco = 21 (máximo)', () => {
    expect(wcagContrast('#000', '#fff')).toBeCloseTo(21, 1);
  });

  it('cor sobre ela mesma = 1 (mínimo)', () => {
    expect(wcagContrast('#ff2d8d', '#ff2d8d')).toBeCloseTo(1, 5);
  });

  it('é simétrico (fg/bg trocados dão o mesmo ratio)', () => {
    expect(wcagContrast('#123456', '#fafafc')).toBeCloseTo(wcagContrast('#fafafc', '#123456'), 10);
  });

  it('limiares AA: #767676 sobre branco passa 4.5, #999 não', () => {
    expect(wcagContrast('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(wcagContrast('#999999', '#ffffff')).toBeLessThan(4.5);
  });
});
