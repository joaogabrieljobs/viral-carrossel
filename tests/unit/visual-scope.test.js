import { describe, it, expect } from 'vitest';
import { applyVisualPresetToCard, editCardVisualBrand } from '../../src/utils/visual-scope.js';
import { VISUAL_PRESETS } from '../../src/styles/visual-presets.jsx';
import { PRESENTATION_VISUAL_PRESETS } from '../../src/styles/presentation-presets.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';

const makeDoc = () => ({
  fmt:'carrossel', creativePreset:'livre',
  brand:{ ...DEFAULT_BRAND, name:'Cliente A', handle:'@cliente-a', logo:'logo-do-cliente' },
  slides:[0, 1].map(i => ({
    ...mkSlide(i + 1, DEFAULT_BRAND), id:`s${i}`, title:`Título ${i}`, subtitle:'Apoio',
    bgImage:'foto-original', caption:'Legenda', overlays:[{ id:'cta', text:'Agende sua avaliação' }],
  })),
});

describe('padrão visual por card', () => {
  it('muda só o alvo, conserva identidade, conteúdo e foto', () => {
    const original = makeDoc();
    const preset = VISUAL_PRESETS.find(p => p.id === 'minimal_clean');
    const result = applyVisualPresetToCard(original, 1, preset, VISUAL_PRESETS);
    expect(result.brand).toEqual(original.brand);
    expect(result.slides[0]).toEqual(original.slides[0]);
    for (const key of ['id', 'title', 'subtitle', 'bgImage', 'caption', 'overlays']) {
      expect(result.slides[1][key]).toEqual(original.slides[1][key]);
    }
    expect(result.slides[1].visualPresetId).toBe(preset.id);
    expect(result.slides[1].visualBrand).not.toHaveProperty('logo');
    expect(result.slides[1].visualBrand).not.toHaveProperty('handle');
    expect(original.slides[1]).not.toHaveProperty('visualBrand');
  });
  it('cores e tipografia continuam editáveis depois do padrão individual', () => {
    const original = makeDoc();
    const styled = applyVisualPresetToCard(original, 0, VISUAL_PRESETS[0], VISUAL_PRESETS);
    const edited = editCardVisualBrand(styled, 0, { titleColor:'#654321', textTitleSize:125, handle:'@atualizado' });
    expect(edited.slides[0].visualBrand.titleColor).toBe('#654321');
    expect(edited.slides[0].visualBrand.textTitleSize).toBe(125);
    expect(edited.slides[1]).toEqual(original.slides[1]);
    expect(edited.brand.titleColor).toBe(original.brand.titleColor);
    expect(edited.brand.handle).toBe('@atualizado');
  });
  it('guarda o visual de stories sem alterar o feed original', () => {
    const original = { ...makeDoc(), fmt:'stories' };
    const preset = VISUAL_PRESETS[0];
    const result = applyVisualPresetToCard(original, 0, preset, VISUAL_PRESETS);
    expect(slideForFormatDisplay(result.slides[0], 'stories', result.formatViews).visualBrand).toBeTruthy();
    expect(slideForFormatDisplay(result.slides[0], 'carrossel', result.formatViews).visualBrand).toBeUndefined();
    expect(result.slides[1]).toEqual(original.slides[1]);
  });
  it('o estilo de apresentação não converte o restante do projeto', () => {
    const original = { ...makeDoc(), fmt:'apresentacao', creativePreset:'apresentacao', productKind:'apresentacao' };
    const result = applyVisualPresetToCard(original, 1, PRESENTATION_VISUAL_PRESETS[0], PRESENTATION_VISUAL_PRESETS);
    expect(result.fmt).toBe('apresentacao');
    expect(result.slides[0]).toEqual(original.slides[0]);
    expect(result.slides[1].title).toBe(original.slides[1].title);
  });
});
