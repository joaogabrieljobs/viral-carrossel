import {
  VISUAL_PRESETS,
  applyVisualPreset,
  getSlideOverridesForPreset,
} from '../styles/visual-presets.jsx';
import {
  DEFAULT_PRESENTATION_VISUAL_PRESET_ID,
  PRESENTATION_VISUAL_PRESETS,
  applyPresentationVisualPreset,
  getPresentationCompositionOverrides,
  getPresentationVisualPreset,
} from '../styles/presentation-presets.jsx';
import {
  APRESENTACAO_PRESET_ID,
  getPresentationPath,
  normalizePresentationPath,
  presentationDocPatch,
} from './presentation.js';
import {
  sanitizeCustomVisualPresetBrand,
  sanitizeCustomVisualPresetSlideDefaults,
  slideDefaultsForAllCards,
} from './custom-visual-presets.js';
import { resolvePresentationVisualRole } from './presentation-composition.js';
import { presentationRoadmap } from './presentation-roadmap.js';

export const DEFAULT_CAROUSEL_VISUAL_PRESET_ID = 'minimal_clean';

function resolvePresentationPreset(presetId, presets) {
  const catalog = Array.isArray(presets) ? presets : PRESENTATION_VISUAL_PRESETS;
  const requested = catalog.find((preset) => (
    preset?.id === presetId && preset.productKind === 'apresentacao'
  ));
  if (requested) return requested;
  return getPresentationVisualPreset(presetId)
    || getPresentationVisualPreset(DEFAULT_PRESENTATION_VISUAL_PRESET_ID)
    || PRESENTATION_VISUAL_PRESETS[0];
}

export function presentationStageAt(pathId, index, count) {
  const stages = getPresentationPath(pathId).stages || [];
  if (!stages.length) return {};
  if (stages.length === 1 || count <= 1) return stages[0];
  // Mesma etapa que o plano recebeu para esta posição (MF-11): texto e
  // composição seguem o mesmo roteiro.
  const roadmap = presentationRoadmap(pathId, count);
  return roadmap[Math.max(0, Math.min(roadmap.length - 1, Math.round(index)))] || stages[0];
}

function applyResolvedPresentationPresetToSlide(slide, preset, normalizedPath, index, count, previous = null, nextSlide = null) {
  const resolvedPresetId = preset?.id || DEFAULT_PRESENTATION_VISUAL_PRESET_ID;
  const stage = {
    ...presentationStageAt(normalizedPath, index, count),
    deliveryMode: getPresentationPath(normalizedPath).deliveryMode,
  };
  const stageMeta = {
    presentationStageId: stage.id || null,
    presentationStageLabel: stage.label || '',
    presentationVisualRole: resolvePresentationVisualRole(slide, stage),
    presentationPresetId: resolvedPresetId,
    showSwipeCue: false,
  };

  if (preset?.isCustom) {
    const referenceComposition = getPresentationCompositionOverrides(
      DEFAULT_PRESENTATION_VISUAL_PRESET_ID,
      { slide, stage, index, count },
    );
    const fallbackComposition = slide.canvas?.zones
      ? {}
      : referenceComposition;
    const savedSlideDefaults = sanitizeCustomVisualPresetSlideDefaults(
      preset.slideDefaults || {},
    );
    // Em vários slides de uma vez, o recorte da foto do slide de origem não
    // vai para os outros; num slide só (alcance "Card") ele acompanha.
    const customSlideDefaults = count > 1
      ? slideDefaultsForAllCards(savedSlideDefaults)
      : savedSlideDefaults;
    const ownPhotoOffset = count > 1 ? slide.elementOffsets?.photo : null;
    const customUsesProfileTokens = !!(
      customSlideDefaults.presentationTypographyByComposition
      || customSlideDefaults.presentationTitleSizeByComposition
      || customSlideDefaults.presentationTitleLeadingByComposition
      || customSlideDefaults.presentationGlass
    );
    const hasSavedCanvas = Object.prototype.hasOwnProperty.call(customSlideDefaults, 'canvas');
    const hasSavedComposition = Object.prototype.hasOwnProperty.call(customSlideDefaults, 'composition');
    const hasSavedOffsets = Object.prototype.hasOwnProperty.call(customSlideDefaults, 'elementOffsets');
    return {
      ...slide,
      ...fallbackComposition,
      // Limpa os metadados/tokens do padrão oficial antes de aplicar a
      // assinatura salva pelo usuário. A geometria livre é restaurada abaixo.
      presentationPatternId: null,
      presentationPatternVersion: null,
      presentationArtDirectionVersion: null,
      presentationDesignFamily: null,
      presentationChrome: null,
      presentationPhotoTreatment: null,
      presentationPhotoRadius: null,
      presentationGround: null,
      presentationArchetypeId: null,
      presentationEvidenceFallback: null,
      presentationRequiresImage: false,
      presentationTextLimits: null,
      presentationAutofit: null,
      presentationComposition: null,
      presentationCompositionId: null,
      presentationLayout: null,
      titlePosition: null,
      imagePosition: null,
      presentationGlass: null,
      presentationTitleSizeByComposition: null,
      presentationTitleLeadingByComposition: null,
      presentationTypographyByComposition: null,
      bodyTracking: undefined,
      bodyLeading: undefined,
      bodyWeight: undefined,
      ...customSlideDefaults,
      ...stageMeta,
      // `presentationCompositionId` continua limpo (era identidade do PDS),
      // mas padrões pessoais com tokens por perfil precisam do papel semântico
      // recém-calculado para selecionar cover/content/data/etc.
      presentationComposition: customUsesProfileTokens
        ? referenceComposition.presentationComposition
        : null,
      // Zonas existentes representam escolhas livres do usuário e continuam
      // sendo a fonte de verdade ao trocar somente a identidade visual.
      canvas: hasSavedCanvas
        ? customSlideDefaults.canvas
        : (slide.canvas || fallbackComposition.canvas),
      composition: hasSavedComposition
        ? customSlideDefaults.composition
        : (slide.composition || fallbackComposition.composition),
      elementOffsets: hasSavedOffsets
        ? { ...customSlideDefaults.elementOffsets, ...(ownPhotoOffset ? { photo: ownPhotoOffset } : {}) }
        : (slide.elementOffsets || fallbackComposition.elementOffsets),
    };
  }

  return {
    ...slide,
    ...getPresentationCompositionOverrides(resolvedPresetId, {
      slide,
      stage,
      index,
      count,
      previous,
      next: nextSlide && index + 1 < count ? {
        slide: nextSlide,
        stage: { ...presentationStageAt(normalizedPath, index + 1, count), deliveryMode: stage.deliveryMode },
      } : null,
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

  // Ritmo de layout (spec 1.1): cada slide é composto conhecendo os
  // anteriores, para a mesma página não sair três vezes seguidas.
  const composed = [];
  for (const [index, slide] of source.entries()) {
    composed.push(applyResolvedPresentationPresetToSlide(slide, preset, normalizedPath, index, count, composed, source[index + 1] || null));
  }
  return composed;
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
    presentationDesignSystemId: preset?.sourceId || null,
    presentationDesignSystemVersion: preset?.sourceVersion || null,
    brand: preset?.isCustom
      ? applyVisualPreset(
          source.brand || {},
          resolvedPresetId,
          [{ ...preset, brand: sanitizeCustomVisualPresetBrand(preset.brand || {}) }],
        )
      : applyPresentationVisualPreset(source.brand || {}, resolvedPresetId),
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
    presentationDesignSystemId: undefined,
    presentationDesignSystemVersion: undefined,
    brand: applyVisualPreset(source.brand || {}, resolvedPresetId, catalog),
    slides: (Array.isArray(source.slides) ? source.slides : []).map((slide) => ({
      ...slide,
      ...slideOverrides,
      showSwipeCue: true,
      presentationStageId: undefined,
      presentationStageLabel: undefined,
      presentationVisualRole: undefined,
      presentationPresetId: undefined,
      presentationPatternId: undefined,
      presentationPatternVersion: undefined,
      presentationArchetypeId: undefined,
      presentationEvidenceFallback: undefined,
      presentationRequiresImage: undefined,
      presentationTextLimits: undefined,
      presentationAutofit: undefined,
      presentationComposition: undefined,
      presentationCompositionId: undefined,
      presentationLayout: undefined,
      presentationGlass: undefined,
      presentationTitleSizeByComposition: undefined,
      presentationTitleLeadingByComposition: undefined,
      presentationTypographyByComposition: undefined,
      titlePosition: undefined,
      imagePosition: undefined,
      bodyTracking: undefined,
      bodyLeading: undefined,
      bodyWeight: undefined,
    })),
  };
}
