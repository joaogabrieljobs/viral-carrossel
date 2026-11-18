import { describe, it, expect } from 'vitest';
import {
  BRAND_TYPOGRAPHY_FIELDS,
  changedTypographyFields,
  propagateBrandTypography,
  slideTypographyPatch,
} from '../../src/utils/brand-typography.js';
import { DEFAULT_BRAND, typographyPatchFromBrand } from '../../src/utils/doc-schema.js';
import { applyVisualPreset } from '../../src/styles/visual-presets.jsx';

const marca = (extra = {}) => ({ ...DEFAULT_BRAND, titleFont: '"Inter Tight", sans-serif', ...extra });
// Capa, miolo em coluna e miolo com foto no topo, como a composição social grava.
const compostos = () => [
  { id: 'capa', titleSize: 88, subSize: 108, bodyAfterSize: 140, titleLeading: 110, subLeading: 138, titleWeight: 700, titleCase: 'normal', titleTracking: 0, subTracking: 0 },
  { id: 'coluna', titleSize: 66, subSize: 100, bodyAfterSize: 140, titleLeading: 110, subLeading: 138, titleWeight: 700, titleCase: 'normal', titleTracking: 0, subTracking: 0 },
  { id: 'topo', titleSize: 76, subSize: 108, bodyAfterSize: 140, titleLeading: 110, subLeading: 138, titleWeight: 700, titleCase: 'normal', titleTracking: 0, subTracking: 0 },
];

describe('tipografia da marca → slides', () => {
  it('o mapa cobre exatamente os campos do patch de tipografia', () => {
    expect(Object.values(BRAND_TYPOGRAPHY_FIELDS).sort()).toEqual(Object.keys(typographyPatchFromBrand({})).sort());
  });

  it('marca igual não altera nada e devolve o mesmo array', () => {
    const slides = compostos();
    expect(propagateBrandTypography(slides, marca(), marca())).toBe(slides);
  });

  it('a transição que achatou a R2 (100 → ausente) não é mudança', () => {
    // A marca do projeto nasce com 100; reaplicar o preset social apaga o campo.
    const antes = marca();
    const depois = applyVisualPreset(antes, 'minimal_clean');
    expect(depois.textTitleSize).toBeUndefined();
    const tamanhos = changedTypographyFields(antes, depois).map((m) => m.campo).filter((c) => /Size$/.test(c));
    expect(tamanhos).toEqual([]);
    const slides = compostos();
    const result = propagateBrandTypography(slides, antes, depois);
    expect(result.map((s) => [s.titleSize, s.subSize, s.bodyAfterSize])).toEqual([[88, 108, 140], [66, 100, 140], [76, 108, 140]]);
  });

  it('mexer em um controle altera só aquele campo', () => {
    const slides = compostos();
    const result = propagateBrandTypography(slides, marca(), marca({ textTitleTracking: 4 }));
    for (const [i, s] of result.entries()) {
      expect(s.titleTracking).toBe(4);
      expect({ ...s, titleTracking: 0 }).toEqual(slides[i]);
    }
  });

  it('tamanho propaga em proporção e conserva a hierarquia entre capa e miolo', () => {
    const result = propagateBrandTypography(compostos(), marca(), marca({ textTitleSize: 110 }));
    expect(result.map((s) => s.titleSize)).toEqual([96.8, 72.6, 83.6]);
    expect(result.map((s) => s.subSize)).toEqual([108, 100, 108]);
  });

  it('proporção parte do valor anterior da marca, não de 100', () => {
    const result = propagateBrandTypography(compostos(), marca({ textSubSize: 120 }), marca({ textSubSize: 90 }));
    expect(result.map((s) => s.subSize)).toEqual([81, 75, 81]);
  });

  it('tamanho respeita a faixa 30–250', () => {
    const slides = [{ id: 'a', titleSize: 200 }, { id: 'b', titleSize: 40 }];
    expect(propagateBrandTypography(slides, marca(), marca({ textTitleSize: 180 })).map((s) => s.titleSize)).toEqual([250, 72]);
    expect(propagateBrandTypography(slides, marca(), marca({ textTitleSize: 50 })).map((s) => s.titleSize)).toEqual([100, 30]);
  });

  it('slide sem valor próprio adota o valor da marca', () => {
    const [s] = propagateBrandTypography([{ id: 'a' }], marca(), marca({ textBodyAfterSize: 130 }));
    expect(s.bodyAfterSize).toBe(130);
  });

  it('entrelinha, entre-letras e caixa substituem o valor do slide', () => {
    const result = propagateBrandTypography(compostos(), marca(), marca({ textTitleLeading: 124, textSubLeading: 160, textTitleCase: 'upper', textSubTracking: 3 }));
    for (const s of result) {
      expect([s.titleLeading, s.subLeading, s.titleCase, s.subTracking]).toEqual([124, 160, 'upper', 3]);
      expect(s.bodyAfterSize).toBe(140);
    }
  });

  it('peso respeita o teto da fonte', () => {
    const antes = marca({ titleFont: '"Playfair Display", serif', textTitleWeight: 700 });
    const depois = marca({ titleFont: '"Playfair Display", serif', textTitleWeight: 400 });
    const [s] = propagateBrandTypography(compostos(), antes, depois);
    expect(s.titleWeight).toBe(typographyPatchFromBrand(depois).titleWeight);
  });

  it('patch de um slide é nulo quando ele já está no valor', () => {
    const mudancas = changedTypographyFields(marca(), marca({ textTitleCase: 'upper' }));
    expect(slideTypographyPatch({ titleCase: 'upper' }, mudancas)).toBeNull();
    expect(slideTypographyPatch({ titleCase: 'normal' }, mudancas)).toEqual({ titleCase: 'upper' });
  });
});
