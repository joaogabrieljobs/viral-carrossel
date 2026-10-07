import { describe, expect, it } from 'vitest';
import {
  createCustomVisualPreset,
  normalizeCustomVisualPresets,
  readCustomVisualPresets,
  writeCustomVisualPresets,
} from '../../src/utils/custom-visual-presets.js';
import { applyVisualPreset, getSlideOverridesForPreset, VISUAL_PRESETS } from '../../src/styles/visual-presets.jsx';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

describe('padrões visuais personalizados', () => {
  it('salva somente a assinatura visual e reaplica sem ocultar subtítulo', () => {
    const preset = createCustomVisualPreset({
      label: 'MUSA editorial',
      brand: {
        bg: '#101010',
        accent: '#beff22',
        subtitleVisible: false,
        subtitleFont: '"Libre Franklin", sans-serif',
        textSubTracking: 15,
        textSubSize: 72,
        logo: 'blob:nao-copiar',
      },
      slide: { layout: 'bl', align: 'left', textBg: true, textBgOpacity: 69, bgImage: 'blob:nao-copiar' },
      creativePreset: 'livre',
    });
    expect(preset.brand.logo).toBeUndefined();
    expect(preset.slideDefaults.bgImage).toBeUndefined();
    expect(preset.brand.subtitleVisible).toBe(true);
    const catalog = [...VISUAL_PRESETS, preset];
    expect(applyVisualPreset({ titleColor: '#fff' }, preset.id, catalog)).toMatchObject({
      bg: '#101010',
      accent: '#beff22',
      subtitleVisible: true,
      subtitleFont: '"Libre Franklin", sans-serif',
      textSubTracking: 15,
      textSubSize: 72,
    });
    expect(getSlideOverridesForPreset(preset.id, catalog)).toMatchObject({
      layout: 'bl', align: 'left', textBg: true, textBgOpacity: 69,
    });
  });

  it('persiste e filtra entradas inválidas do banco local', () => {
    const storage = memoryStorage();
    const preset = createCustomVisualPreset({ label: 'Meu padrão', brand: { bg: '#000000' }, slide: {} });
    expect(writeCustomVisualPresets([preset, { id: 'ruim' }], storage)).toBe(true);
    expect(readCustomVisualPresets(storage)).toHaveLength(1);
    expect(normalizeCustomVisualPresets([preset, preset])).toHaveLength(1);
  });

  it('salva corpo, glass e mapas tipográficos por perfil com cópia segura', () => {
    const glass = {
      enabled: true,
      background: 'rgba(255,255,255,.08)',
      backdropBlur: 18,
      border: '1px solid rgba(255,255,255,.15)',
      radius: 20,
      applyTo: ['content', 'data', 'perfil-invalido'],
      presentationCompositionId: 'pds.premium:content',
    };
    const typography = {
      cover: {
        title: {
          role: 'display', fontFamily: 'Cormorant Garamond', sizePercent: 82,
          leadingPercent: 94, weight: 500, tracking: -1, case: 'normal', italic: false,
          presentationCompositionId: 'pds.premium:cover',
        },
        subtitle: { role: 'body', sizePercent: 44, leadingPercent: 130 },
        presentationCompositionId: 'pds.premium:cover',
      },
      perfilInvalido: { title: { sizePercent: 999 } },
    };
    const preset = createCustomVisualPreset({
      label: 'Deck personalizado',
      productKind: 'apresentacao',
      brand: {
        bodyWeight: 430,
        textBodyTracking: 0.5,
        textBodyLeading: 146,
      },
      slide: {
        bodyWeight: 450,
        bodyTracking: 0.7,
        bodyLeading: 150,
        presentationGlass: glass,
        presentationTitleSizeByComposition: { cover: 82, content: 54, invalido: 999 },
        presentationTitleLeadingByComposition: { cover: 94, content: 108 },
        presentationTypographyByComposition: typography,
        presentationPatternId: 'pds.premium-dark',
        presentationCompositionId: 'pds.premium-dark:cover',
        presentationLayout: { visualRole: 'cover' },
      },
    });

    expect(preset.brand).toMatchObject({
      bodyWeight: 430,
      textBodyTracking: 0.5,
      textBodyLeading: 146,
    });
    expect(preset.slideDefaults).toMatchObject({
      bodyWeight: 450,
      bodyTracking: 0.7,
      bodyLeading: 150,
      presentationGlass: {
        enabled: true,
        backdropBlur: 18,
        applyTo: ['content', 'data'],
      },
      presentationTitleSizeByComposition: { cover: 82, content: 54 },
      presentationTitleLeadingByComposition: { cover: 94, content: 108 },
      presentationTypographyByComposition: {
        cover: {
          title: {
            role: 'display',
            fontFamily: 'Cormorant Garamond',
            sizePercent: 82,
            leadingPercent: 94,
          },
          subtitle: { role: 'body', sizePercent: 44, leadingPercent: 130 },
        },
      },
    });
    expect(preset.slideDefaults.presentationPatternId).toBeUndefined();
    expect(preset.slideDefaults.presentationCompositionId).toBeUndefined();
    expect(preset.slideDefaults.presentationLayout).toBeUndefined();
    expect(preset.slideDefaults.presentationGlass.presentationCompositionId).toBeUndefined();
    expect(preset.slideDefaults.presentationTypographyByComposition.cover.title.presentationCompositionId)
      .toBeUndefined();
    expect(preset.slideDefaults.presentationTypographyByComposition.perfilInvalido).toBeUndefined();

    glass.applyTo.push('demo');
    typography.cover.title.sizePercent = 12;
    expect(preset.slideDefaults.presentationGlass.applyTo).toEqual(['content', 'data']);
    expect(preset.slideDefaults.presentationTypographyByComposition.cover.title.sizePercent).toBe(82);
  });

  it('salva a geometria, os ajustes livres e o recorte de foto do card escolhido', () => {
    const canvas = {
      enabled: true,
      applied: true,
      variant: 'classic',
      preserveZones: true,
      source: 'presentation-preset',
      zones: {
        photo: { x: 4, y: 8, w: 54, h: 84 },
        title: { x: 62, y: 14, w: 31, h: 25 },
        subtitle: { x: 62, y: 45, w: 31, h: 24 },
      },
      presentationCompositionId: 'nao-copiar',
    };
    const offsets = {
      title: { x: 3, y: -2 },
      photo: { x: -4, y: 5 },
      invalido: { x: 'x', y: 2 },
    };
    const preset = createCustomVisualPreset({
      label: 'Meu enquadramento',
      productKind: 'apresentacao',
      slide: {
        canvas,
        composition: 'minha-composicao',
        elementOffsets: offsets,
        elementsUnlocked: true,
        photoRegion: 'full',
        bgFit: 'cover',
        bgX: 64,
        bgY: 38,
        bgZoom: 132,
        bgMirror: true,
      },
    });

    expect(preset.slideDefaults).toMatchObject({
      composition: 'minha-composicao',
      canvas: {
        enabled: true,
        variant: 'classic',
        preserveZones: true,
        zones: {
          photo: { x: 4, y: 8, w: 54, h: 84 },
          title: { x: 62, y: 14, w: 31, h: 25 },
        },
      },
      elementOffsets: {
        title: { x: 3, y: -2 },
        photo: { x: -4, y: 5 },
      },
      bgX: 64,
      bgY: 38,
      bgZoom: 132,
      bgMirror: true,
    });
    expect(preset.slideDefaults.canvas.presentationCompositionId).toBeUndefined();
    expect(preset.slideDefaults.elementOffsets.invalido).toBeUndefined();

    canvas.zones.title.x = 99;
    offsets.title.x = 99;
    expect(preset.slideDefaults.canvas.zones.title.x).toBe(62);
    expect(preset.slideDefaults.elementOffsets.title.x).toBe(3);
  });
});
