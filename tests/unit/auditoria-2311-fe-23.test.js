import { describe, expect, it } from 'vitest';
import { VISUAL_PRESETS, applyVisualPreset, getSlideOverridesForPreset } from '../../src/styles/visual-presets.jsx';
import { createCustomVisualPreset } from '../../src/utils/custom-visual-presets.js';
import * as customPresets from '../../src/utils/custom-visual-presets.js';
import { restyleSocialSlides } from '../../src/utils/social-visual-composition.js';
import { applyCarouselVisualPresetToDoc, applyPresentationVisualPresetToDoc } from '../../src/utils/presentation-state.js';
import { applyVisualPresetToCard } from '../../src/utils/visual-scope.js';

// FE-23: o padrão personalizado guarda o recorte da foto do card de origem
// (zoom, espelho, posição, arrasto). Aplicado a todos os cards, impunha esse
// recorte às outras fotos. Num card só, o recorte salvo continua valendo.
const FRAMING = { bgX: 64, bgY: 38, bgZoom: 132, bgMirror: true };
const custom = (productKind = 'carrossel') => createCustomVisualPreset({
  label: 'Meu estilo',
  brand: { bg: '#101010', accent: '#ff3366', titleColor: '#ffffff' },
  slide: { ...FRAMING, layout: 'bottom-left', overlay: 35, elementOffsets: { title: { x: 3, y: -2 }, photo: { x: -4, y: 5 } } },
  creativePreset: productKind === 'apresentacao' ? 'apresentacao' : 'livre',
  productKind,
});
const cards = () => [
  { id: 'a', num: 1, title: 'Um', subtitle: 'a', bgImage: 'blob:a', bgX: 20, bgY: 30, bgZoom: 100, bgMirror: false },
  { id: 'b', num: 2, title: 'Dois', subtitle: 'b', bgImage: 'blob:b', bgX: 80, bgY: 10, bgZoom: 150, bgMirror: false },
  { id: 'c', num: 3, title: 'Três', subtitle: 'c', bgImage: 'blob:c' },
];
const framingOf = (slide) => [slide.bgX, slide.bgY, slide.bgZoom, slide.bgMirror];
const OWN = [[20, 30, 100, false], [80, 10, 150, false], [undefined, undefined, undefined, undefined]];

describe('FE-23 — "Todos" com padrão personalizado não replica o recorte de uma foto', () => {
  it('carrossel: cada card mantém zoom, espelho e posição da própria foto', () => {
    const preset = custom();
    const presets = [...VISUAL_PRESETS, preset];
    const brand = applyVisualPreset({}, preset.id, presets);
    const styled = restyleSocialSlides(cards(), {
      preset, brand, formato: 'carrossel', overrides: getSlideOverridesForPreset(preset.id, presets),
    });
    expect(styled.map(framingOf)).toEqual(OWN);
    // O que é do estilo continua chegando a todos.
    expect(styled.every((slide) => slide.layout === 'bottom-left')).toBe(true);
    expect(styled.every((slide) => slide.elementOffsets?.title?.x === 3)).toBe(true);
    expect(styled.some((slide) => slide.elementOffsets?.photo)).toBe(false);
  });

  it('apresentação convertida em carrossel com o padrão: mesma regra', () => {
    const preset = custom();
    const styled = applyCarouselVisualPresetToDoc({ slides: cards(), brand: {} }, preset.id, [...VISUAL_PRESETS, preset]);
    expect(styled.slides.map(framingOf)).toEqual(OWN);
  });

  it('apresentação: o padrão salvo num slide não espelha as fotos dos outros', () => {
    const preset = custom('apresentacao');
    // Slides com composição própria: sem ela, a composição de referência do
    // 16:9 recoloca o zoom em 100, como já fazia com qualquer padrão.
    const canvas = { variant: 'classic', applied: true, zones: { photo: { x: 50, y: 0, w: 50, h: 100 }, title: { x: 6, y: 20, w: 40, h: 30 } } };
    const doc = { productKind: 'apresentacao', creativePreset: 'apresentacao', fmt: 'apresentacao', brand: {},
      slides: cards().map((slide, i) => ({ ...slide, canvas, ...(i === 0 ? { elementOffsets: { photo: { x: 9, y: 9 } } } : {}) })) };
    const styled = applyPresentationVisualPresetToDoc(doc, preset.id, [preset]);
    expect(styled.slides.map(framingOf)).toEqual(OWN);
    expect(styled.slides[0].elementOffsets).toEqual({ title: { x: 3, y: -2 }, photo: { x: 9, y: 9 } });
    expect(styled.slides[1].elementOffsets).toEqual({ title: { x: 3, y: -2 } });
  });

  it('num card só, o recorte salvo no padrão ainda é aplicado', () => {
    const preset = custom();
    const presets = [...VISUAL_PRESETS, preset];
    expect(getSlideOverridesForPreset(preset.id, presets, { scope: 'card' })).toMatchObject({
      ...FRAMING, elementOffsets: { title: { x: 3, y: -2 }, photo: { x: -4, y: 5 } },
    });
    const doc = { fmt: 'carrossel', creativePreset: 'livre', brand: {}, slides: cards() };
    const next = applyVisualPresetToCard(doc, 1, preset, presets);
    expect(framingOf(next.slides[1])).toEqual([64, 38, 132, true]);
    expect(framingOf(next.slides[0])).toEqual(OWN[0]);
  });

  it('a função pura tira só o recorte da foto e não altera o padrão salvo', () => {
    const preset = custom();
    const shared = customPresets.slideDefaultsForAllCards(preset.slideDefaults);
    expect(shared).toEqual({ layout: 'bottom-left', overlay: 35, elementOffsets: { title: { x: 3, y: -2 } } });
    expect(preset.slideDefaults).toMatchObject({ ...FRAMING, elementOffsets: { photo: { x: -4, y: 5 } } });
    expect(customPresets.slideDefaultsForAllCards(null)).toEqual({});
  });

  it('padrão oficial não muda: nenhum define recorte de foto', () => {
    for (const preset of VISUAL_PRESETS) {
      const overrides = getSlideOverridesForPreset(preset.id, VISUAL_PRESETS);
      expect(overrides).toEqual(getSlideOverridesForPreset(preset.id, VISUAL_PRESETS, { scope: 'card' }));
    }
  });
});
