import {
  VISUAL_PRESETS,
  applyVisualPreset,
  getSlideOverridesForPreset,
} from '../styles/visual-presets.jsx';
import {
  DEFAULT_PRESENTATION_VISUAL_PRESET_ID,
  PRESENTATION_VISUAL_PRESETS,
  getPresentationCompositionOverrides,
} from '../styles/presentation-presets.jsx';
import {
  APRESENTACAO_PRESET_ID,
  getPresentationPath,
  normalizePresentationPath,
  presentationDocPatch,
} from './presentation.js';

export const DEFAULT_CAROUSEL_VISUAL_PRESET_ID = 'minimal_clean';

function resolvePresentationPreset(presetId, presets) {
  const catalog = Array.isArray(presets) ? presets : PRESENTATION_VISUAL_PRESETS;
  const requested = catalog.find((preset) => (
    preset?.id === presetId && preset.productKind === 'apresentacao'
  ));
  if (requested) return requested;
  return catalog.find((preset) => preset?.id === DEFAULT_PRESENTATION_VISUAL_PRESET_ID)
    || PRESENTATION_VISUAL_PRESETS.find((preset) => preset.id === DEFAULT_PRESENTATION_VISUAL_PRESET_ID)
    || PRESENTATION_VISUAL_PRESETS[0];
}

export function presentationStageAt(pathId, index, count) {
  const stages = getPresentationPath(pathId).stages || [];
  if (!stages.length) return {};
  if (stages.length === 1 || count <= 1) return stages[0];
  const stageIndex = Math.round((index * (stages.length - 1)) / (count - 1));
  return stages[Math.max(0, Math.min(stages.length - 1, stageIndex))] || stages[0];
}

function applyResolvedPresentationPresetToSlide(slide, preset, normalizedPath, index, count) {
  const resolvedPresetId = preset?.id || DEFAULT_PRESENTATION_VISUAL_PRESET_ID;
  const stage = presentationStageAt(normalizedPath, index, count);
  const stageMeta = {
    presentationStageId: stage.id || null,
    presentationStageLabel: stage.label || '',
    presentationVisualRole: stage.visualRole || slide.presentationVisualRole || 'content',
    presentationPresetId: resolvedPresetId,
    showSwipeCue: false,
  };

  if (preset?.isCustom) {
    const fallbackComposition = slide.canvas?.zones
      ? {}
      : getPresentationCompositionOverrides(DEFAULT_PRESENTATION_VISUAL_PRESET_ID, {
          slide,
          stage,
          index,
          count,
        });
    return {
      ...slide,
      ...fallbackComposition,
      ...(preset.slideDefaults || {}),
      ...stageMeta,
      // Zonas existentes representam escolhas livres do usuário e continuam
      // sendo a fonte de verdade ao trocar somente a identidade visual.
      canvas: slide.canvas || fallbackComposition.canvas,
      composition: slide.composition || fallbackComposition.composition,
      elementOffsets: slide.elementOffsets || fallbackComposition.elementOffsets,
    };
  }

  return {
    ...slide,
    ...getPresentationCompositionOverrides(resolvedPresetId, {
      slide,
      stage,
      index,
      count,
    }),
    ...stageMeta,
    bodyAfterImage: slide.bodyAfterImage || '',
  };
}

/**
 * Compõe um único slide na sua posição narrativa. É usado ao adicionar slides
 * para não recalcular nem apagar ajustes livres dos slides que já existem.
 */
export function applyPresentationVisualPresetToSlide(
  slide,
  presetId = DEFAULT_PRESENTATION_VISUAL_PRESET_ID,
  pathId = 'auto',
  presets = PRESENTATION_VISUAL_PRESETS,
  { index = 0, count = 1 } = {},
) {
  const preset = resolvePresentationPreset(presetId, presets);
  const normalizedPath = normalizePresentationPath(pathId);
  const safeCount = Math.max(1, Number(count) || 1);
  const safeIndex = Math.max(0, Math.min(safeCount - 1, Number(index) || 0));
  return applyResolvedPresentationPresetToSlide(
    slide && typeof slide === 'object' ? slide : {},
    preset,
    normalizedPath,
    safeIndex,
    safeCount,
  );
}

/**
 * Reaplica um padrão de apresentação sem apagar texto, imagens ou fontes.
 * Presets oficiais recebem composições 16:9 por função narrativa; presets
 * personalizados alteram a pele visual e preservam as zonas já editadas.
 */
export function applyPresentationVisualPresetToSlides(
  slides,
  presetId = DEFAULT_PRESENTATION_VISUAL_PRESET_ID,
  pathId = 'auto',
  presets = PRESENTATION_VISUAL_PRESETS,
) {
  const source = Array.isArray(slides) ? slides : [];
  const preset = resolvePresentationPreset(presetId, presets);
  const normalizedPath = normalizePresentationPath(pathId);
  const count = Math.max(1, source.length);

  return source.map((slide, index) => (
    applyResolvedPresentationPresetToSlide(slide, preset, normalizedPath, index, count)
  ));
}

export function applyPresentationVisualPresetToDoc(
  doc,
  presetId = DEFAULT_PRESENTATION_VISUAL_PRESET_ID,
  presets = PRESENTATION_VISUAL_PRESETS,
  { initialize = false } = {},
) {
  const source = doc && typeof doc === 'object' ? doc : {};
  const preset = resolvePresentationPreset(presetId, presets);
  const resolvedPresetId = preset?.id || DEFAULT_PRESENTATION_VISUAL_PRESET_ID;
  const presentationPath = normalizePresentationPath(source.presentationPath);
  const initialPatch = initialize
    ? presentationDocPatch({
        pathId: presentationPath,
        slideCount: source.quickCardCount,
      })
    : {};

  return {
    ...source,
    ...initialPatch,
    productKind: 'apresentacao',
    creativePreset: APRESENTACAO_PRESET_ID,
    fmt: 'apresentacao',
    presentationPath,
    visualPreset: resolvedPresetId,
    brand: applyVisualPreset(source.brand || {}, resolvedPresetId, presets),
    slides: applyPresentationVisualPresetToSlides(
      source.slides,
      resolvedPresetId,
      presentationPath,
      presets,
    ),
  };
}

export function applyCarouselVisualPresetToDoc(
  doc,
  presetId = DEFAULT_CAROUSEL_VISUAL_PRESET_ID,
  presets = VISUAL_PRESETS,
  { fmt } = {},
) {
  const source = doc && typeof doc === 'object' ? doc : {};
  const catalog = Array.isArray(presets) ? presets : VISUAL_PRESETS;
  const preset = catalog.find((item) => (
    item?.id === presetId && item.productKind !== 'apresentacao'
  )) || catalog.find((item) => item?.id === DEFAULT_CAROUSEL_VISUAL_PRESET_ID)
    || VISUAL_PRESETS.find((item) => item.id === DEFAULT_CAROUSEL_VISUAL_PRESET_ID)
    || VISUAL_PRESETS[0];
  const resolvedPresetId = preset?.id || DEFAULT_CAROUSEL_VISUAL_PRESET_ID;
  const slideOverrides = getSlideOverridesForPreset(resolvedPresetId, catalog);
  const targetFmt = fmt && fmt !== 'apresentacao'
    ? fmt
    : (source.fmt && source.fmt !== 'apresentacao' ? source.fmt : 'carrossel');

  return {
    ...source,
    productKind: 'carrossel',
    creativePreset: preset?.creativePreset || 'livre',
    fmt: targetFmt,
    visualPreset: resolvedPresetId,
    brand: applyVisualPreset(source.brand || {}, resolvedPresetId, catalog),
    slides: (Array.isArray(source.slides) ? source.slides : []).map((slide) => ({
      ...slide,
      ...slideOverrides,
      showSwipeCue: true,
      presentationStageId: undefined,
      presentationStageLabel: undefined,
      presentationVisualRole: undefined,
      presentationPresetId: undefined,
      presentationComposition: undefined,
      presentationCompositionId: undefined,
      presentationLayout: undefined,
    })),
  };
}
