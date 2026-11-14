// Auditoria 2026-09-15 — C1 (densidade no-op), H2 (faixas contraditórias T/C), H1 (tom no-op T/C).
import { describe, it, expect } from 'vitest';
import {
  TEXT_DENSITY_TARGET_MULT,
  scaledCharBand,
  scaledCeiling,
  tendenciaStyleSandwichCharBands,
  buildSlideTextDensityOverrides,
  buildGenerationSlideLayoutRules,
  buildGenerationLanguageLayer,
  SLIDE_TEXT_DENSITY_OPTIONS,
} from '../../src/utils/generation-prompts.js';

describe('C1 — densidade de texto escala de verdade', () => {
  it('todas as opções de densidade da UI têm multiplicador', () => {
    for (const opt of SLIDE_TEXT_DENSITY_OPTIONS) {
      expect(TEXT_DENSITY_TARGET_MULT[opt.id], `sem multiplicador para ${opt.id}`).toBeTypeOf('number');
    }
  });

  it('scaledCharBand / scaledCeiling reduzem a faixa para densidade < 1/1', () => {
    expect(scaledCharBand(200, 320, '1_1')).toEqual({ lo: 200, hi: 320 });
    const terco = scaledCharBand(200, 320, '1_3');
    expect(terco.hi).toBeLessThan(320);
    expect(terco.lo).toBeLessThan(200);
    expect(scaledCeiling(80, '1_5')).toBeLessThan(80);
  });

  it('override de densidade limita ambos os campos sem exigir um mínimo', () => {
    const txt = buildSlideTextDensityOverrides('1_3', 'viral');
    expect(txt).toContain('subtitle: até 110 caracteres');
    expect(txt).toContain('juntos: até 150 caracteres');
    expect(txt).toContain('São TETOS, nunca metas mínimas');
  });

  it('faixas do sanduíche T/C encolhem monotonicamente com a densidade', () => {
    const b11 = tendenciaStyleSandwichCharBands('1_1');
    const b13 = tendenciaStyleSandwichCharBands('1_3');
    const b15 = tendenciaStyleSandwichCharBands('1_5');
    expect(b13.subHi).toBeLessThan(b11.subHi);
    expect(b15.subHi).toBeLessThan(b13.subHi);
    expect(b15.subLo).toBe(0);
    expect(b13.subLo).toBe(0);
  });
});

describe('H2 — T/C com densidade ≠ 1/1 dá uma única faixa de subtítulo', () => {
  it('não anexa o override genérico "SUBSTITUI" ao bloco sanduíche', () => {
    const rules = buildGenerationSlideLayoutRules('editorial', 'tendencia_cultura', '1_3');
    expect(rules).not.toMatch(/SUBSTITUI proporcionalmente/);
    const faixas = [...rules.matchAll(/Tetos neste projeto: subtitle até (\d+) caracteres/g)];
    expect(faixas.length).toBe(1);
  });
});

describe('H1 — tom entra no pacote Tendência/Cultura', () => {
  it('buildGenerationLanguageLayer T/C contém o tom pedido', () => {
    const tone = 'provocador e leve';
    expect(buildGenerationLanguageLayer('tendencia_cultura', tone, 'editorial')).toContain(tone);
    expect(buildGenerationLanguageLayer('livre', tone, 'editorial')).toContain(tone);
  });
});
