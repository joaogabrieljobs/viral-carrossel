import { describe, expect, it } from 'vitest';
import {
  contentAwarePresentationZones,
  resolvePresentationCompositionKind,
  resolvePresentationVisualRole,
  presentationPhotoAspectRatio,
} from '../../src/utils/presentation-composition.js';
import {
  getPresentationCompositionOverrides,
  buildPresentationDesignSystemPromptBlock,
  PRESENTATION_VISUAL_PRESETS,
} from '../../src/styles/presentation-presets.jsx';
import { applyPresentationVisualPresetToSlides } from '../../src/utils/presentation-state.js';
import { DEFAULT_BRAND, ensureDocShape, mkSlide } from '../../src/utils/doc-schema.js';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';

const roles = ['cover', 'content', 'divider', 'data', 'demo', 'closing'];
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x
  && a.y < b.y + b.h && a.y + a.h > b.y;
const metrics = [{ type: 'metrics', items: [{ label: 'Oferta', value: 'Em estudo', detail: 'Preço ainda em definição.' }] }];
const planned = (role, overrides = {}) => ({
  title: 'Uma conclusão sustentada pelo conteúdo',
  subtitle: 'O funcionamento e as condições relevantes permanecem na leitura do slide.',
  presentationPlan: { visualRole: role, purpose: 'explain', question: 'Como funciona?', keyMessage: 'Uma conclusão.' },
  ...overrides,
});

describe('composição de apresentação orientada pelo plano editorial', () => {
  it('o plano explícito prevalece sobre a posição proporcional e preserva abertura e fecho', () => {
    const slide = planned('demo');
    expect(resolvePresentationVisualRole(slide, { visualRole: 'data' })).toBe('demo');
    expect(resolvePresentationCompositionKind({ slide, stage: { visualRole: 'data' }, index: 3, count: 8 })).toBe('demo');
    expect(resolvePresentationCompositionKind({ slide, index: 0, count: 8 })).toBe('cover');
    expect(resolvePresentationCompositionKind({ slide, index: 7, count: 8 })).toBe('closing');
  });

  it.each([
    ['comparison', 'data'], ['business_model', 'data'], ['journey', 'demo'], ['roadmap', 'demo'],
  ])('a finalidade %s refina conteúdo genérico para %s', (purpose, expected) => {
    const slide = planned('content', { presentationPlan: { visualRole: 'content', purpose } });
    expect(resolvePresentationCompositionKind({ slide, stage: { visualRole: 'question' }, index: 3, count: 8 })).toBe(expected);
  });

  it('as seis funções do pitch possuem geometria própria e fotos separadas da leitura', () => {
    for (const preset of PRESENTATION_VISUAL_PRESETS) {
      const geometries = roles.map((role, index) => {
        const result = getPresentationCompositionOverrides(preset.id, {
          slide: planned(role, { imageQuery: 'editorial photo of the supplied product' }),
          stage: { contentMode: 'pitch', visualRole: 'context' }, index, count: roles.length,
        });
        expect(result.presentationComposition).toBe(role);
        expect(result.presentationVisualRole).toBe(role);
        expect(result.photoFraming).toBe('auto');
        expect(result.bgFit).toBe('cover');
        const { title, subtitle, photo } = result.canvas.zones;
        expect(overlaps(title, subtitle)).toBe(false);
        expect(overlaps(title, photo)).toBe(false);
        expect(overlaps(subtitle, photo)).toBe(false);
        for (const r of Object.values(result.canvas.zones)) {
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.y).toBeGreaterThanOrEqual(0);
          expect(r.w).toBeGreaterThan(0);
          expect(r.h).toBeGreaterThan(0);
          expect(r.x + r.w).toBeLessThanOrEqual(100);
          expect(r.y + r.h).toBeLessThanOrEqual(100);
        }
        return JSON.stringify(result.canvas.zones);
      });
      expect(new Set(geometries).size, preset.id).toBe(6);
    }
  });

  it('o conteúdo sem foto recebe a largura disponível sem convite vazio de imagem', () => {
    const withPhoto = contentAwarePresentationZones('content', planned('content', { bgImageId: 'photo-1' }));
    const without = getPresentationCompositionOverrides('presentation_executive_minimal', {
      slide: planned('content'), index: 2, count: 6,
    });
    expect(without.canvas.zones.subtitle.w).toBeGreaterThan(withPhoto.subtitle.w);
    expect(without.presentationRequiresImage).toBe(false);
    expect(without.presentationSuppressPhoto).toBe(true);
  });

  it('o limite de leitura segue a finalidade sem herdar o subtítulo de 40 caracteres do PDS', () => {
    const make = deliveryMode => getPresentationCompositionOverrides('presentation_premium_dark', {
      slide: planned('content'), stage: { deliveryMode }, index: 2, count: 6,
    });
    expect(make('leave-behind').presentationTextLimits.subtitle.maxChars).toBe(360);
    expect(make('live').presentationTextLimits.subtitle.maxChars).toBe(180);
    expect(make('leave-behind').presentationTextLimits.body.maxChars).toBe(180);
    expect(make('live').presentationTextLimits.body.maxChars).toBe(90);
    expect(make('leave-behind').presentationTypographyByComposition.content.subtitle.case).toBe('normal');
    const live = applyPresentationVisualPresetToSlides([
      planned('cover'), planned('content'), planned('closing'),
    ], 'presentation_premium_dark', 'keynote_manifesto');
    expect(live[1].presentationTextLimits.subtitle.maxChars).toBe(180);
  });

  it('o prompt planejado usa os novos orçamentos sem contradizê-los com limites legados', () => {
    const block = buildPresentationDesignSystemPromptBlock('presentation_premium_dark', 'relatorio_executivo', { planned: true });
    expect(block).toContain('320–360');
    expect(block).toContain('presentationBlocks');
    expect(block).toContain('limites obrigatórios por slide');
    expect(block).not.toMatch(/subtitle ≤40|subtitle: até 40/);
    expect(buildPresentationDesignSystemPromptBlock('presentation_premium_dark', 'relatorio_executivo'))
      .toContain('subtitle ≤40');
  });

  it('uma capa com título longo ajusta a escala sem cortar palavras nem encolher além do piso', () => {
    const title = 'A continuidade transforma registros dispersos em uma trajetória compreensível de saúde';
    const compose = value => getPresentationCompositionOverrides('presentation_executive_minimal', {
      slide: planned('cover', { title: value, bgImageId: 'existing-photo' }), index: 0, count: 6,
    });
    const long = compose(title);
    expect(long.titleSize).toBeLessThan(compose('Uma trajetória contínua').titleSize);
    expect(long.titleSize).toBeGreaterThanOrEqual(32);
    expect(long.presentationTypographyByComposition.cover.title.sizePercent).toBe(long.titleSize);
  });

  it('blocos de evidência reservam área legível sem colidir com contexto, marca ou fotografia', () => {
    const source = planned('data', { presentationBlocks: metrics, bgImageId: 'preserved-photo', bodyAfterImage: 'Uma ressalva.' });
    const result = getPresentationCompositionOverrides('presentation_premium_dark', {
      slide: source, stage: { contentMode: 'pitch' }, index: 2, count: 6,
    });
    const { title, subtitle, evidence } = result.canvas.zones;
    expect(evidence.w).toBeGreaterThanOrEqual(80);
    expect(evidence.h).toBeGreaterThanOrEqual(35);
    expect(overlaps(title, evidence)).toBe(false);
    expect(overlaps(subtitle, evidence)).toBe(false);
    expect(overlaps(title, subtitle)).toBe(false);
    expect(result.presentationSuppressPhoto).toBe(true);
    expect(result.presentationTextLimits.subtitle.maxChars).toBe(180);
    expect(result.presentationTextLimits.body.maxChars).toBe(0);
    expect(source.bgImageId).toBe('preserved-photo');
    expect(source.bodyAfterImage).toBe('Uma ressalva.');
    expect(source.presentationBlocks).toBe(metrics);
  });

  it('a reaplicação e a persistência conservam papéis planejados e ativos de marca sem mutar a origem', () => {
    const source = roles.map((role, index) => ({
      ...mkSlide(index + 1, DEFAULT_BRAND), ...planned(role),
      bgImageId: `asset-${index}`, logoImage: 'data:image/png;base64,brand-logo',
      textFonts: { title: 'Marca Serif', subtitle: 'Marca Sans' },
    }));
    const before = JSON.stringify(source);
    const slides = applyPresentationVisualPresetToSlides(source, 'presentation_premium_dark', 'pitch');
    const persisted = ensureDocShape(JSON.parse(JSON.stringify({
      creativePreset: 'apresentacao', productKind: 'apresentacao', presentationPath: 'pitch', slides,
    })));
    const reapplied = applyPresentationVisualPresetToSlides(persisted.slides, 'presentation_executive_minimal', 'pitch');
    for (const [index, slide] of reapplied.entries()) {
      expect(slide.presentationVisualRole).toBe(roles[index]);
      expect(slide.presentationComposition).toBe(roles[index]);
      expect(slide.logoImage).toBe(source[index].logoImage);
      expect(slide.bgImageId).toBe(source[index].bgImageId);
      expect(slide.textFonts).toEqual(source[index].textFonts);
      expect(slide.title).toBe(source[index].title);
      expect(persisted.slides[index].logoSize).toBe(80);
    }
    expect(JSON.stringify(source)).toBe(before);
  });

  it('a normalização de logo legada continua igual nos carrosséis', () => {
    const doc = ensureDocShape({
      fmt: 'carrossel', creativePreset: 'livre',
      slides: [{ ...mkSlide(1, DEFAULT_BRAND), logoSize: 80 }],
    });
    expect(doc.slides[0].logoSize).toBe(260);
    const malformed = ensureDocShape({
      fmt: 'apresentacao', creativePreset: 'apresentacao',
      slides: [{ ...planned('content'), logoSize: -20 }, { ...planned('content'), logoSize: Infinity }],
    });
    expect(malformed.slides.map(slide => slide.logoSize)).toEqual([260, 260]);
  });

  it('importar a primeira foto reabre a área visual no preview e export sem alterar a origem nem a vista manual', () => {
    const original = {
      ...planned('content'), id: 'later-photo',
      ...getPresentationCompositionOverrides('presentation_executive_minimal', {
        slide: planned('content'), index: 2, count: 6,
      }),
      bgImageId: 'newly-imported-photo',
    };
    const before = JSON.stringify(original);
    const shown = slideForFormatDisplay(original, 'apresentacao', {}, 'apresentacao');
    expect(shown.presentationSuppressPhoto).toBe(false);
    expect(shown.canvas.zones.photo.w).toBeGreaterThan(20);
    expect(overlaps(shown.canvas.zones.subtitle, shown.canvas.zones.photo)).toBe(false);
    expect(JSON.stringify(original)).toBe(before);
    const manual = { x: 12, y: 38, w: 36, h: 44 };
    const shownManual = slideForFormatDisplay(original, 'apresentacao', {
      apresentacao: { slides: { 'later-photo': {
        canvas: { ...shown.canvas, zones: { ...shown.canvas.zones, photo: manual } },
        elementOffsets: { title: { x: 3, y: 2 } },
      } } },
    }, 'apresentacao');
    expect(shownManual.canvas.zones.photo).toEqual(manual);
    expect(shownManual.elementOffsets.title).toEqual({ x: 3, y: 2 });
    expect(slideForFormatDisplay({ ...original, presentationBlocks: metrics }, 'apresentacao', {}, 'apresentacao').presentationSuppressPhoto).toBe(true);
  });

  it.each([
    [100, 100, '16:9'], [84.375, 100, '3:2'], [56.25, 100, '1:1'],
    [37.5, 100, '2:3'], [31.640625, 100, '9:16'],
  ])('a foto %sx%s segue a moldura em %s sem pedir deformação', (w, h, expected) => {
    const slide = {
      presentationCompositionVersion: 2, presentationSuppressPhoto: false,
      canvas: { zones: { photo: { x: 0, y: 0, w, h } } },
    };
    expect(presentationPhotoAspectRatio(slide)).toBe(expected);
  });

  it('a capa dividida pede foto vertical; formatos legados ou inválidos mantêm o fallback', () => {
    const cover = getPresentationCompositionOverrides('presentation_executive_minimal', {
      slide: planned('cover', { imageQuery: 'editorial photo' }), index: 0, count: 6,
    });
    expect(presentationPhotoAspectRatio(cover)).toBe('2:3');
    expect(cover.bgFit).toBe('cover');
    expect(presentationPhotoAspectRatio({})).toBe('16:9');
    expect(presentationPhotoAspectRatio({ ...cover, presentationCompositionVersion: undefined })).toBe('16:9');
    expect(presentationPhotoAspectRatio({ ...cover, canvas: { zones: { photo: { x: 0, y: 0, w: NaN, h: 100 } } } })).toBe('16:9');
    expect(presentationPhotoAspectRatio({ ...cover, presentationSuppressPhoto: true })).toBe('16:9');
  });

  it('preserva o perfil visual legado quando não há plano nem modo pitch', () => {
    const result = getPresentationCompositionOverrides('presentation_pitch_dark', {
      slide: {}, stage: { visualRole: 'demo' }, index: 3, count: 8,
    });
    expect(result.presentationCompositionId).toBe('pitch-demo');
    expect(result.overlay).toBe(48);
    expect(result.canvas.zones.photo).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(result).not.toHaveProperty('presentationCompositionVersion');
  });
});
