import { describe, expect, it } from 'vitest';
import {
  applyCarouselVisualPresetToDoc,
  applyPresentationVisualPresetToDoc,
  applyPresentationVisualPresetToSlide,
  applyPresentationVisualPresetToSlides,
} from '../../src/utils/presentation-state.js';
import { ensureDocShape } from '../../src/utils/doc-schema.js';

const baseSlides = [
  { id: 'a', title: 'Capa', subtitle: 'Contexto', bodyAfterImage: '' },
  { id: 'b', title: 'A margem cresceu', subtitle: 'Comparação anual', bodyAfterImage: 'Fonte: relatório 2026' },
  { id: 'c', title: 'Próximo passo', subtitle: 'Decisão', bodyAfterImage: '' },
];

describe('estado visual de apresentações', () => {
  it('canonicaliza IDs externos e aliases sem apagar presets personalizados', () => {
    const base = { fmt: 'apresentacao', creativePreset: 'apresentacao', slides: baseSlides };
    expect(ensureDocShape({ ...base, visualPreset: 'pds.cinematic' }).visualPreset)
      .toBe('presentation_cinematic');
    expect(ensureDocShape({ ...base, visualPreset: 'manifesto' }).visualPreset)
      .toBe('presentation_cinematic');
    expect(ensureDocShape({ ...base, visualPreset: 'custom-deck' }).visualPreset)
      .toBe('custom-deck');
  });
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
    expect(slide.presentationPatternId).toBeNull();
    expect(slide.presentationPatternVersion).toBeNull();
    expect(slide.presentationRequiresImage).toBe(false);
    expect(slide.presentationTextLimits).toBeNull();
    expect(slide.presentationAutofit).toBeNull();
  });

  it('reaplica a geometria e o recorte salvos quando o padrão pessoal os possui', () => {
    const savedCanvas = {
      enabled: true,
      applied: true,
      variant: 'classic',
      zones: { title: { x: 58, y: 12, w: 34, h: 22 } },
    };
    const custom = {
      id: 'custom-layout-deck',
      productKind: 'apresentacao',
      isCustom: true,
      brand: { bg: '#101010' },
      slideDefaults: {
        canvas: savedCanvas,
        composition: 'meu-layout',
        elementOffsets: { title: { x: 4, y: -3 } },
        bgX: 63,
        bgY: 41,
        bgZoom: 128,
      },
    };
    const [slide] = applyPresentationVisualPresetToSlides([{
      ...baseSlides[0],
      canvas: { enabled: true, variant: 'classic', zones: { title: { x: 6, y: 6, w: 40, h: 20 } } },
      composition: 'anterior',
      elementOffsets: { title: { x: -8, y: 7 } },
      bgX: 50,
      bgY: 50,
      bgZoom: 100,
    }], custom.id, 'pitch', [custom]);

    expect(slide.canvas).toEqual(savedCanvas);
    expect(slide.canvas).not.toBe(savedCanvas);
    expect(slide.composition).toBe('meu-layout');
    expect(slide.elementOffsets).toEqual({ title: { x: 4, y: -3 } });
    expect(slide).toMatchObject({ bgX: 63, bgY: 41, bgZoom: 128 });
  });

  it('remove tokens oficiais ao trocar para um padrão pessoal e preserva a geometria livre', () => {
    const canvas = {
      applied: true,
      zones: { title: { x: 12, y: 8, w: 62, h: 18 } },
    };
    const offsets = { title: { x: 4, y: -2 } };
    const custom = {
      id: 'custom-safe-deck',
      productKind: 'apresentacao',
      isCustom: true,
      brand: {
        bg: '#101010', bodyWeight: 450, textBodyTracking: 0.6, textBodyLeading: 148,
      },
      slideDefaults: {
        bodyWeight: 450,
        bodyTracking: 0.6,
        bodyLeading: 148,
        presentationGlass: { enabled: true, applyTo: ['content'], backdropBlur: 16 },
        presentationTitleSizeByComposition: { cover: 80, content: 52 },
        presentationTitleLeadingByComposition: { cover: 96, content: 108 },
        presentationTypographyByComposition: {
          cover: { title: { role: 'display', sizePercent: 80, leadingPercent: 96 } },
        },
      },
    };
    const source = {
      ...baseSlides[0],
      canvas,
      composition: 'minha-geometria',
      elementOffsets: offsets,
      presentationPatternId: 'pds.premium-dark',
      presentationPatternVersion: '1.0.0',
      presentationArchetypeId: 'premium-cover',
      presentationComposition: 'cover',
      presentationCompositionId: 'presentation_premium_dark:cover',
      presentationLayout: { imagePosition: 'full-bleed' },
      presentationTextLimits: { title: { maxChars: 50 } },
      presentationAutofit: { enabled: true, minScale: 0.85 },
      presentationGlass: { enabled: false },
      presentationTitleSizeByComposition: { cover: 99 },
      presentationTitleLeadingByComposition: { cover: 70 },
      presentationTypographyByComposition: {
        cover: { title: { role: 'display', sizePercent: 99 } },
      },
      titlePosition: 'official-position',
      imagePosition: 'official-image',
    };

    const [slide] = applyPresentationVisualPresetToSlides(
      [source],
      custom.id,
      'pitch',
      [custom],
    );

    expect(slide.canvas).toBe(canvas);
    expect(slide.composition).toBe('minha-geometria');
    expect(slide.elementOffsets).toBe(offsets);
    expect(slide.presentationPresetId).toBe(custom.id);
    expect(slide).toMatchObject({
      presentationPatternId: null,
      presentationPatternVersion: null,
      presentationArchetypeId: null,
      presentationComposition: 'cover',
      presentationCompositionId: null,
      presentationLayout: null,
      presentationTextLimits: null,
      presentationAutofit: null,
      titlePosition: null,
      imagePosition: null,
      bodyWeight: 450,
      bodyTracking: 0.6,
      bodyLeading: 148,
      presentationGlass: { enabled: true, applyTo: ['content'], backdropBlur: 16 },
      presentationTitleSizeByComposition: { cover: 80, content: 52 },
      presentationTitleLeadingByComposition: { cover: 96, content: 108 },
    });
    expect(slide.presentationTypographyByComposition.cover.title).toMatchObject({
      role: 'display', sizePercent: 80, leadingPercent: 96,
    });
  });

  it('não carrega corpo, glass ou mapas do PDS se o padrão pessoal não os salvou', () => {
    const custom = {
      id: 'custom-clean-deck',
      productKind: 'apresentacao',
      isCustom: true,
      brand: { bg: '#101010' },
      slideDefaults: { align: 'left' },
    };
    const [slide] = applyPresentationVisualPresetToSlides([{
      ...baseSlides[0],
      canvas: { applied: true, zones: {} },
      bodyWeight: 300,
      bodyTracking: 2,
      bodyLeading: 80,
      presentationGlass: { enabled: true },
      presentationTitleSizeByComposition: { cover: 88 },
      presentationTitleLeadingByComposition: { cover: 92 },
      presentationTypographyByComposition: {
        cover: { title: { role: 'display', sizePercent: 88 } },
      },
    }], custom.id, 'pitch', [custom]);

    expect(slide.bodyWeight).toBeUndefined();
    expect(slide.bodyTracking).toBeUndefined();
    expect(slide.bodyLeading).toBeUndefined();
    expect(slide.presentationGlass).toBeNull();
    expect(slide.presentationTitleSizeByComposition).toBeNull();
    expect(slide.presentationTitleLeadingByComposition).toBeNull();
    expect(slide.presentationTypographyByComposition).toBeNull();
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

  it('grava metadata oficial e limpa a anterior ao trocar para customizado ou legado', () => {
    const source = {
      productKind: 'apresentacao',
      fmt: 'apresentacao',
      presentationPath: 'pitch',
      presentationDesignSystemId: 'pds.anterior',
      presentationDesignSystemVersion: '0.1.0',
      brand: {},
      slides: [{
        ...baseSlides[0],
        presentationPatternId: 'pds.anterior',
        presentationPatternVersion: '0.1.0',
        presentationAutofit: { enabled: true },
      }],
    };
    const official = applyPresentationVisualPresetToDoc(
      source,
      'presentation_executive_minimal',
    );
    expect(official).toMatchObject({
      presentationDesignSystemId: 'pds.executive-minimal',
      presentationDesignSystemVersion: '1.0.0',
    });

    const custom = {
      id: 'custom-deck',
      productKind: 'apresentacao',
      isCustom: true,
      brand: { bg: '#101010' },
      slideDefaults: { align: 'right' },
    };
    const customized = applyPresentationVisualPresetToDoc(source, custom.id, [custom]);
    expect(customized.presentationDesignSystemId).toBeNull();
    expect(customized.presentationDesignSystemVersion).toBeNull();
    expect(customized.slides[0].presentationPatternId).toBeNull();
    expect(customized.slides[0].presentationPatternVersion).toBeNull();
    expect(customized.slides[0].presentationTextLimits).toBeNull();
    expect(customized.slides[0].presentationAutofit).toBeNull();

    const legacy = applyPresentationVisualPresetToDoc(source, 'presentation_pitch_dark');
    expect(legacy.presentationDesignSystemId).toBeNull();
    expect(legacy.presentationDesignSystemVersion).toBeNull();
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
    expect(result.slides.every((slide) => slide.presentationRequiresImage === undefined)).toBe(true);
    expect(result.slides.every((slide) => slide.presentationTextLimits === undefined)).toBe(true);
    expect(result.slides.every((slide) => slide.presentationAutofit === undefined)).toBe(true);
    expect(result.slides.every((slide) => slide.presentationGlass === undefined)).toBe(true);
    expect(result.slides.every((slide) => slide.presentationTitleSizeByComposition === undefined)).toBe(true);
    expect(result.slides.every((slide) => slide.presentationTitleLeadingByComposition === undefined)).toBe(true);
    expect(result.slides.every((slide) => slide.presentationTypographyByComposition === undefined)).toBe(true);
    expect(result.slides.every((slide) => slide.bodyWeight === undefined)).toBe(true);
    expect(result.slides.every((slide) => slide.bodyTracking === undefined)).toBe(true);
    expect(result.slides.every((slide) => slide.bodyLeading === undefined)).toBe(true);
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
