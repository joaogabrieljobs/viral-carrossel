import { describe, expect, it } from 'vitest';
import {
  applyCarouselVisualPresetToDoc,
  applyPresentationVisualPresetToDoc,
  applyPresentationVisualPresetToSlide,
  applyPresentationVisualPresetToSlides,
} from '../../src/utils/presentation-state.js';

const baseSlides = [
  { id: 'a', title: 'Capa', subtitle: 'Contexto', bodyAfterImage: '' },
  { id: 'b', title: 'A margem cresceu', subtitle: 'Comparação anual', bodyAfterImage: 'Fonte: relatório 2026' },
  { id: 'c', title: 'Próximo passo', subtitle: 'Decisão', bodyAfterImage: '' },
];

describe('estado visual de apresentações', () => {
  it('troca o padrão oficial e recria composições 16:9 sem perder conteúdo', () => {
    const slides = applyPresentationVisualPresetToSlides(
      baseSlides,
      'presentation_data',
      'relatorio_executivo',
    );

    expect(slides).toHaveLength(3);
    expect(slides.every((slide) => slide.canvas?.applied === true)).toBe(true);
    expect(slides.every((slide) => slide.presentationPresetId === 'presentation_data')).toBe(true);
    expect(slides[1].bodyAfterImage).toBe('Fonte: relatório 2026');
    expect(slides[0].showSwipeCue).toBe(false);
  });

  it('mantém zonas livres ao aplicar um padrão personalizado de apresentação', () => {
    const canvas = {
      applied: true,
      variant: 'classic',
      zones: { title: { x: 8, y: 12, w: 38, h: 20 } },
    };
    const custom = {
      id: 'custom-deck',
      productKind: 'apresentacao',
      isCustom: true,
      brand: { bg: '#101010' },
      slideDefaults: { align: 'right', overlay: 30 },
    };
    const [slide] = applyPresentationVisualPresetToSlides(
      [{ ...baseSlides[0], canvas, composition: 'custom-zone' }],
      custom.id,
      'keynote_manifesto',
      [custom],
    );

    expect(slide.align).toBe('right');
    expect(slide.canvas).toBe(canvas);
    expect(slide.composition).toBe('custom-zone');
    expect(slide.showSwipeCue).toBe(false);
  });

  it('compõe somente o slide novo sem alterar os ajustes dos anteriores', () => {
    const manualCanvas = {
      applied: true,
      variant: 'classic',
      zones: { title: { x: 17, y: 9, w: 31, h: 18 } },
    };
    const existing = { ...baseSlides[0], canvas: manualCanvas, composition: 'manual' };
    const added = applyPresentationVisualPresetToSlide(
      { id: 'd', title: '', subtitle: '', bodyAfterImage: '' },
      'presentation_executive_light',
      'pitch',
      undefined,
      { index: 3, count: 4 },
    );

    expect(existing.canvas).toBe(manualCanvas);
    expect(existing.composition).toBe('manual');
    expect(added.canvas?.applied).toBe(true);
    expect(added.presentationPresetId).toBe('presentation_executive_light');
    expect(added.showSwipeCue).toBe(false);
  });

  it('inicializa produto, marca e slides de forma atômica', () => {
    const result = applyPresentationVisualPresetToDoc({
      productKind: 'carrossel',
      fmt: 'quadrado',
      creativePreset: 'livre',
      presentationPath: 'pitch',
      quickCardCount: '13',
      brand: { handle: '@marca', logo: 'logo.png' },
      slides: baseSlides,
    }, 'presentation_pitch_dark', undefined, { initialize: true });

    expect(result).toMatchObject({
      productKind: 'apresentacao',
      fmt: 'apresentacao',
      creativePreset: 'apresentacao',
      presentationPath: 'pitch',
      visualPreset: 'presentation_pitch_dark',
    });
    expect(result.brand.handle).toBe('@marca');
    expect(result.brand.logo).toBe('logo.png');
    expect(result.slides.every((slide) => slide.canvas?.applied === true)).toBe(true);
  });

  it('remove o estado visual de deck ao voltar para carrossel sem alterar o formato escolhido', () => {
    const result = applyCarouselVisualPresetToDoc({
      productKind: 'apresentacao',
      fmt: 'apresentacao',
      creativePreset: 'apresentacao',
      brand: { handle: '@marca' },
      slides: applyPresentationVisualPresetToSlides(baseSlides, 'presentation_data', 'relatorio_executivo'),
    }, 'minimal_clean', undefined, { fmt: 'stories' });

    expect(result).toMatchObject({
      productKind: 'carrossel',
      fmt: 'stories',
      creativePreset: 'livre',
      visualPreset: 'minimal_clean',
    });
    expect(result.brand.handle).toBe('@marca');
    expect(result.slides.every((slide) => slide.canvas === null)).toBe(true);
    expect(result.slides.every((slide) => slide.presentationPresetId === undefined)).toBe(true);
  });

  it('aplica identidade e layout de um padrão personalizado de carrossel ao seed', () => {
    const custom = {
      id: 'custom-carousel',
      label: 'Minha marca',
      isCustom: true,
      productKind: 'carrossel',
      brand: { bg: '#241122', accent: '#ffcc00' },
      slideDefaults: {
        layout: 'tl',
        align: 'left',
        photoRegion: 'inset',
        textBg: true,
        textBgOpacity: 72,
      },
    };
    const result = applyCarouselVisualPresetToDoc({
      productKind: 'carrossel',
      fmt: 'carrossel',
      brand: { handle: '@marca' },
      slides: [{ id: 'a', title: '', subtitle: '' }],
    }, custom.id, [custom], { fmt: 'carrossel' });

    expect(result.visualPreset).toBe(custom.id);
    expect(result.brand).toMatchObject({ bg: '#241122', accent: '#ffcc00', handle: '@marca' });
    expect(result.slides[0]).toMatchObject({
      layout: 'tl',
      align: 'left',
      photoRegion: 'inset',
      textBg: true,
      textBgOpacity: 72,
    });
  });
});
