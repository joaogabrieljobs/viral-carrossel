import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRESENTATION_VISUAL_PRESET_ID,
  PRESENTATION_VISUAL_PRESETS,
  PRESENTATION_VISUAL_PRESET_BY_ID,
  normalizePresentationVisualPreset,
  getPresentationVisualPreset,
  applyPresentationVisualPreset,
  getPresentationSlideOverrides,
  getPresentationCompositionOverrides,
  renderPresentationPresetPreview,
} from '../../src/styles/presentation-presets.jsx';
import { PRESENTATION_PATHS } from '../../src/utils/presentation.js';
import { wcagContrast } from '../../src/utils/wcag.js';

describe('padrões visuais de apresentação', () => {
  it('oferece seis padrões exclusivos e horizontais', () => {
    expect(PRESENTATION_VISUAL_PRESETS).toHaveLength(6);
    expect(new Set(PRESENTATION_VISUAL_PRESETS.map((item) => item.id)).size).toBe(6);
    for (const item of PRESENTATION_VISUAL_PRESETS) {
      expect(item).toMatchObject({
        productKind: 'apresentacao',
        creativePreset: 'apresentacao',
        fmt: 'apresentacao',
        aspectRatio: '16:9',
        width: 1920,
        height: 1080,
      });
      expect(item.label.length).toBeGreaterThan(3);
      expect(item.desc.length).toBeGreaterThan(20);
    }
  });

  it('todo caminho sugere um padrão existente', () => {
    for (const path of PRESENTATION_PATHS) {
      expect(
        PRESENTATION_VISUAL_PRESET_BY_ID[path.suggestedVisualPreset],
        `${path.id} aponta para padrão inexistente`,
      ).toBeTruthy();
    }
  });

  it('normaliza aliases e sempre retorna um padrão válido', () => {
    expect(DEFAULT_PRESENTATION_VISUAL_PRESET_ID).toBe('presentation_executive_light');
    expect(normalizePresentationVisualPreset('Pitch')).toBe('presentation_pitch_dark');
    expect(normalizePresentationVisualPreset('estudo de caso')).toBe('presentation_case_study');
    expect(normalizePresentationVisualPreset({ id: 'manifesto' })).toBe('presentation_keynote');
    expect(normalizePresentationVisualPreset('nao-existe')).toBe(DEFAULT_PRESENTATION_VISUAL_PRESET_ID);
    expect(getPresentationVisualPreset()).toBe(PRESENTATION_VISUAL_PRESET_BY_ID.presentation_executive_light);
  });

  it('cores de texto e destaque mantêm contraste no fundo sólido', () => {
    const failures = [];
    for (const item of PRESENTATION_VISUAL_PRESETS) {
      const { bg, titleColor, subtitleColor, textColor, accent } = item.brand;
      for (const [field, color] of Object.entries({ titleColor, subtitleColor, textColor })) {
        const ratio = wcagContrast(color, bg);
        if (ratio < 4.5) failures.push(`${item.id}.${field} ${ratio.toFixed(2)}:1`);
      }
      const accentRatio = wcagContrast(accent, bg);
      if (accentRatio < 3) failures.push(`${item.id}.accent ${accentRatio.toFixed(2)}:1`);
    }
    expect(failures).toEqual([]);
  });

  it('aplica marca e slide sem apagar identidade ou subtítulo', () => {
    const brand = applyPresentationVisualPreset({
      name: 'Minha marca',
      logo: 'data:image/png;base64,abc',
      subtitleVisible: false,
    }, 'data');
    expect(brand).toMatchObject({
      name: 'Minha marca',
      logo: 'data:image/png;base64,abc',
      bg: '#ecf4ff',
      subtitleVisible: true,
      visualIdentityLocked: true,
    });

    expect(getPresentationSlideOverrides('keynote')).toMatchObject({
      layout: 'mc',
      align: 'center',
      canvas: null,
      elementOffsets: {},
    });
  });

  it('renderiza preview SVG em viewBox 16:9', () => {
    const preview = renderPresentationPresetPreview('pitch');
    expect(preview.type).toBe('svg');
    expect(preview.props.viewBox).toBe('0 0 160 90');
    expect(preview.props['aria-hidden']).toBe('true');
  });

  it('traduz cada padrão em uma composição de capa 16:9 própria e editável', () => {
    const covers = PRESENTATION_VISUAL_PRESETS.map((item) => (
      getPresentationCompositionOverrides(item.id, {
        slide: { title: 'Título', subtitle: 'Apoio' },
        stage: { visualRole: 'context' },
        index: 0,
        count: 8,
      })
    ));

    expect(new Set(covers.map((item) => item.presentationCompositionId)).size).toBe(6);
    for (const item of covers) {
      expect(item).toMatchObject({
        presentationComposition: 'cover',
        photoRegion: 'full',
        bgFit: 'cover',
        showSwipeCue: false,
        canvas: {
          enabled: false,
          applied: true,
          variant: 'classic',
          source: 'presentation-preset',
          preserveZones: true,
        },
      });
      expect(['left', 'center', 'right']).toContain(item.align);
      expect(item.titlePosition).toBeTruthy();
      expect(item.imagePosition).toBeTruthy();
    }
  });

  it('varia conteúdo, divisor, dados, demonstração e fecho pela função narrativa', () => {
    const make = (visualRole, index = 2, count = 8) => (
      getPresentationCompositionOverrides('pitch', {
        stage: { visualRole }, index, count,
      })
    );

    expect(make('diagram').presentationComposition).toBe('content');
    expect(make('question').presentationComposition).toBe('divider');
    expect(make('data').presentationComposition).toBe('data');
    expect(make('demo').presentationComposition).toBe('demo');
    expect(make('decision', 7, 8).presentationComposition).toBe('closing');

    expect(new Set([
      make('diagram').presentationCompositionId,
      make('question').presentationCompositionId,
      make('data').presentationCompositionId,
      make('demo').presentationCompositionId,
      make('decision', 7, 8).presentationCompositionId,
    ]).size).toBe(5);
  });

  it('mantém todas as zonas dentro da tela e devolve cópias independentes', () => {
    for (const preset of PRESENTATION_VISUAL_PRESETS) {
      for (const [visualRole, index] of [
        ['context', 0],
        ['diagram', 2],
        ['question', 3],
        ['data', 4],
        ['demo', 5],
        ['decision', 7],
      ]) {
        const result = getPresentationCompositionOverrides(preset.id, {
          stage: { visualRole }, index, count: 8,
        });
        for (const rect of Object.values(result.canvas.zones)) {
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.w).toBeGreaterThan(0);
          expect(rect.h).toBeGreaterThan(0);
          expect(rect.x + rect.w).toBeLessThanOrEqual(100);
          expect(rect.y + rect.h).toBeLessThanOrEqual(100);
        }
      }
    }

    const first = getPresentationCompositionOverrides('data', {
      stage: { visualRole: 'data' }, index: 3, count: 8,
    });
    first.canvas.zones.title.x = 99;
    const second = getPresentationCompositionOverrides('data', {
      stage: { visualRole: 'data' }, index: 3, count: 8,
    });
    expect(second.canvas.zones.title.x).toBe(6);
  });

  it('reserva evidência sem fabricar imagem, gráfico ou conteúdo', () => {
    const result = getPresentationCompositionOverrides(
      'presentation_data',
      { title: 'Receita cresceu', subtitle: 'Fonte: relatório' },
      { visualRole: 'data' },
      3,
      9,
    );

    expect(result.presentationComposition).toBe('data');
    expect(result.presentationVisualRole).toBe('data');
    expect(result.presentationLayout.imagePosition).toBe('wide-evidence');
    expect(result).not.toHaveProperty('bgImage');
    expect(result).not.toHaveProperty('imageQuery');
    expect(result).not.toHaveProperty('title');
    expect(result).not.toHaveProperty('subtitle');
  });
});
