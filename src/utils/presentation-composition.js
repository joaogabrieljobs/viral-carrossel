/** Composição determinística: o modelo escolhe a função, nunca CSS ou coordenadas. */
import { FORMATS } from './formats.js';
import { presentationFamily, artDirectedPresentationZones, presentationTypeDirection } from './presentation-art-direction.js';
const DATA_ROLES = new Set(['data', 'metric', 'result', 'matrix', 'comparison', 'priorities']);
const DEMO_ROLES = new Set(['demo', 'example', 'evidence', 'story', 'people', 'application']);
const DIVIDER_ROLES = new Set(['divider', 'agenda', 'question', 'reframe', 'contrast', 'statement', 'vision', 'objectives']);
const DATA_PURPOSES = new Set(['comparison', 'business_model', 'revenue_model', 'metrics', 'market', 'traction']);
const DEMO_PURPOSES = new Set(['journey', 'roadmap', 'workflow', 'product_demo', 'process']);
const text = value => String(value || '').trim().toLowerCase();

/**
 * Tamanho do texto de apoio (`bodyAfterImage`) no deck.
 *
 * O slide guarda tamanhos na escala do Feed; a vista 16:9 multiplica por
 * (1080/1350)×(1080/1920) = 0,45 e limita o resultado a 52–130
 * (`slideForFormatDisplay`). Título e subtítulo escapam disso pelos tokens de
 * composição; o apoio não. O valor fixo 110 que existia aqui chegava à tela
 * como 52% — 18 px num slide de 1920, ilegível em projeção (rodada R2) —
 * enquanto o sistema visual da apresentação define corpo de 24 a 28 px.
 *
 * Gravamos o valor que, depois da conversão, entrega o corpo do preset, nunca
 * abaixo do piso de leitura.
 */
const PRESENTATION_VIEW_FACTOR = (FORMATS.apresentacao.h / FORMATS.carrossel.h) * (FORMATS.carrossel.w / FORMATS.apresentacao.w);
/** Piso de leitura do apoio no deck, na escala da vista: 1920 × 0,018 × 0,70 ≈ 24 px. */
export const PRESENTATION_SUPPORT_MIN_VIEW_SIZE = 70;
const PRESENTATION_SUPPORT_DEFAULT_VIEW_SIZE = 72;

export function presentationSupportTextSize(base = {}) {
  const doPreset = Number(base.bodyAfterSize);
  const naVista = Math.max(
    PRESENTATION_SUPPORT_MIN_VIEW_SIZE,
    Number.isFinite(doPreset) && doPreset > 0 ? doPreset : PRESENTATION_SUPPORT_DEFAULT_VIEW_SIZE,
  );
  return Math.round(naVista / PRESENTATION_VIEW_FACTOR);
}

export function resolvePresentationVisualRole(slide = {}, stage = {}) {
  const plan = slide.presentationPlan;
  const planned = text(plan?.visualRole);
  const purpose = text(plan?.purpose);
  if (planned && planned !== 'content') return planned;
  if (plan && DATA_PURPOSES.has(purpose)) return 'data';
  if (plan && DEMO_PURPOSES.has(purpose)) return 'demo';
  return planned || text(stage.visualRole) || text(slide.presentationVisualRole) || text(slide.visualRole) || 'content';
}

export function resolvePresentationCompositionKind({ slide = {}, stage = {}, index = 0, count = 1 } = {}) {
  if (index === 0) return 'cover';
  if (index >= count - 1) return 'closing';
  const role = resolvePresentationVisualRole(slide, stage);
  if (DATA_ROLES.has(role)) return 'data';
  if (DEMO_ROLES.has(role)) return 'demo';
  if (DIVIDER_ROLES.has(role) || role === 'cover') return 'divider';
  if (role === 'closing' || role === 'close') return 'closing';
  return 'content';
}

const rect = (x, y, w, h) => ({ x, y, w, h });
const inactivePhoto = () => rect(96, 94, 1, 1);
const hasVisual = slide => !!(slide.bgImage || slide.bgImageId || slide.bgImageAssetId || text(slide.imageQuery));
const hasBlocks = slide => Array.isArray(slide.presentationBlocks)
  && slide.presentationBlocks.some(block => ['comparison', 'metrics', 'steps'].includes(block?.type));

/**
 * Perfis fechados com faixa superior reservada à marca. Fotos usam cover e
 * enquadramento automático; não se aplica deformação nem composição livre do LLM.
 * A ausência de foto expande a leitura, em vez de deixar um placeholder vazio.
 */
export function presentationDesignFamily(base = {}) {
  return presentationFamily(base.presentationPresetId || base.presentationPatternId);
}

export function contentAwarePresentationZones(kind, slide = {}, family = 'executive') {
  return artDirectedPresentationZones(kind, slide, family, { visual: hasVisual(slide), structured: hasBlocks(slide) });
}

function titleLinesAt(value, width, size, fontFamily = '') {
  const condensed = /Bebas|Anton|Condensed/i.test(fontFamily);
  const capacity = Math.max(1, width / (size * (condensed ? 0.43 : 0.55)));
  return String(value || '').split('\n').reduce((total, paragraph) => {
    let lines = 1;
    let used = 0;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const chars = [...word].length;
      if (used && used + 1 + chars > capacity) { lines += 1; used = 0; }
      if (chars > capacity) {
        lines += Math.ceil(chars / capacity) - 1;
        used = chars % Math.max(1, Math.floor(capacity));
      } else used += (used ? 1 : 0) + chars;
    }
    return total + lines;
  }, 0);
}

/** Escalas fechadas e piso legível; o texto nunca é cortado para caber. */
function fittedTitleSize(defaultSize, value, zone, fontFamily = '') {
  if (!String(value || '').trim()) return defaultSize;
  const width = 1920 * zone.w / 100 - 24;
  const height = 1080 * zone.h / 100 - 14;
  const steps = Array.from({ length: Math.ceil((defaultSize - 32) / 4) + 1 }, (_, i) => Math.max(32, defaultSize - i * 4));
  const choices = [...new Set([...steps, 32])]
    .filter(size => size <= defaultSize).sort((a, b) => b - a);
  return choices.find(size => titleLinesAt(value, width, 1920 * 0.084 * size / 100, fontFamily)
    * (1920 * 0.084 * size / 100) * 1.1 <= height) || choices.at(-1);
}

export function plannedPresentationTextLimits(kind, slide = {}, deliveryMode = 'hybrid') {
  const live = deliveryMode === 'live';
  const cover = kind === 'cover';
  const closing = kind === 'closing';
  const visual = hasVisual(slide);
  return {
    title: { maxChars: 90, maxLines: cover || closing ? 3 : 2 },
    subtitle: {
      maxChars: cover ? (live ? 140 : 220) : closing ? (live ? 180 : 320) : live ? 180 : visual ? 320 : 360,
      maxLines: live || cover ? 5 : 9,
    },
    body: { maxChars: live ? 90 : cover ? 100 : visual ? 140 : 180, maxLines: live ? 3 : 4 },
    wordsPerSlide: live ? 70 : 110,
  };
}

/** Aplica direção por função sem alterar conteúdo, imagens, cor ou família tipográfica. */
export function contentAwarePresentationOverrides(base, slide = {}, kind = 'content', { pitch = false, deliveryMode = 'hybrid' } = {}) {
  const structured = hasBlocks(slide);
  const visual = hasVisual(slide) && !structured;
  const family = presentationDesignFamily(base);
  const zones = contentAwarePresentationZones(kind, slide, family);
  const previousTypography = base.presentationTypographyByComposition || {};
  const typography = previousTypography[kind] || {};
  const centered = false;
  const direction = presentationTypeDirection(family, kind);
  const displaySize = direction.titleSize;
  const titleSize = fittedTitleSize(structured ? Math.min(46, displaySize) : displaySize, slide.title, zones.title, typography.title?.fontFamily);
  const subSize = structured ? 57 : direction.bodySize;
  const bodyType = base.presentationBodyTypography || {};
  const titleLeading = Math.max(96, Math.min(118, Number(typography.title?.leadingPercent) || 108));
  const bodyLeading = Math.max(132, Math.min(152, Number(bodyType.leadingPercent) || 142));
  const imagePosition = structured || !visual ? 'none' : family === 'editorial' ? 'left-evidence'
    : family === 'cinematic' && kind === 'closing' ? 'left-evidence'
    : kind === 'data' ? 'left-evidence' : 'right-evidence';
  const rawLimits = pitch ? (base.presentationTextLimits || {}) : plannedPresentationTextLimits(kind, slide, deliveryMode);
  const narrow = zones.subtitle.w < 45 && zones.subtitle.h < 50;
  const limits = narrow ? {
    ...rawLimits,
    subtitle: { ...rawLimits.subtitle, maxChars: Math.min(rawLimits.subtitle?.maxChars || 180, 180), maxLines: 6 },
    body: { ...rawLimits.body, maxChars: Math.min(rawLimits.body?.maxChars || 90, 90), maxLines: 3 },
  } : rawLimits;
  return {
    ...base,
    layout: centered ? 'mc' : 'tl',
    align: centered ? 'center' : 'left',
    // Texto e imagem possuem superfícies independentes; a foto mantém seu tom.
    overlay: 0,
    textShadow: false,
    textInset: 0,
    bgFit: 'cover',
    bgZoom: 100,
    photoFraming: 'auto',
    presentationRequiresImage: false,
    presentationSuppressPhoto: !visual,
    presentationCompositionVersion: 2,
    titleSize,
    subSize,
    titleLeading,
    subLeading: bodyLeading,
    subTracking: bodyType.tracking ?? 1,
    presentationDesignFamily: family,
    presentationArtDirectionVersion: 1,
    bodyAfterSize: presentationSupportTextSize(base),
    bodyLeading,
    logoPosition: 'tl',
    logoSize: 80,
    titlePosition: centered ? 'center' : 'top-left',
    imagePosition,
    presentationLayout: {
      ...base.presentationLayout,
      titlePosition: centered ? 'center' : 'top-left',
      imagePosition,
      evidencePosition: structured ? 'wide-lower' : null,
    },
    presentationTextLimits: structured ? {
      ...limits,
      title: { ...limits.title, maxChars: Math.min(limits.title?.maxChars || 90, 90), maxLines: 2 },
      subtitle: { ...limits.subtitle, maxChars: Math.min(limits.subtitle?.maxChars || 180, 180), maxLines: 3 },
      body: { ...limits.body, maxChars: 0, maxLines: 0 },
    } : limits,
    presentationTypographyByComposition: {
      ...previousTypography,
      [kind]: {
        ...typography,
        title: { ...typography.title, sizePercent: titleSize, leadingPercent: titleLeading, ...(pitch ? { case: 'normal' } : {}) },
        // subtitle is an argument here, not the catalog's uppercase eyebrow.
        subtitle: { ...typography.subtitle, ...bodyType, sizePercent: subSize, leadingPercent: bodyLeading, tracking: bodyType.tracking ?? 1, weight: bodyType.weight || 400, case: 'normal' },
      },
    },
    canvas: { ...base.canvas, preserveZones: true, zones },
  };
}

/**
 * Vista derivada após importar a primeira foto num slide planejado sem imagem.
 * O documento não muda; ajustes manuais da vista são mesclados depois deste
 * helper. Geometrias livres ou já reposicionadas continuam sob controle do autor.
 */
export function restorePresentationPhotoComposition(slide) {
  if (!slide || slide.presentationCompositionVersion !== 2 || !slide.presentationSuppressPhoto
    || !(slide.bgImage || slide.bgImageId || slide.bgImageAssetId) || hasBlocks(slide)
    || slide.canvas?.source !== 'presentation-preset'
    || ['title', 'subtitle', 'bodyAfterImage', 'text', 'photo'].some(key => {
      const offset = slide.elementOffsets?.[key];
      return offset && Object.values(offset).some(value => Number(value) !== 0);
    })) return slide;
  const kind = rolesForRestoredPhoto.has(slide.presentationComposition) ? slide.presentationComposition : 'content';
  const zones = contentAwarePresentationZones(kind, slide, presentationDesignFamily(slide));
  const previousTypography = slide.presentationTypographyByComposition || {};
  const typography = previousTypography[kind] || {};
  const titleSize = fittedTitleSize(typography.title?.sizePercent || slide.titleSize || 44, slide.title, zones.title, typography.title?.fontFamily);
  const imagePosition = kind === 'data' ? 'left-evidence' : 'right-evidence';
  return {
    ...slide,
    presentationSuppressPhoto: false,
    align: 'left',
    layout: 'tl',
    titleSize,
    imagePosition,
    presentationLayout: { ...slide.presentationLayout, imagePosition },
    presentationTypographyByComposition: {
      ...previousTypography,
      [kind]: { ...typography, title: { ...typography.title, sizePercent: titleSize } },
    },
    canvas: { ...slide.canvas, zones },
  };
}
const rolesForRestoredPhoto = new Set(['cover', 'content', 'divider', 'data', 'demo', 'closing']);

/** Gera a foto na proporção mais próxima da moldura; cover mantém escala uniforme. */
export function presentationPhotoAspectRatio(slide) {
  const zone = slide?.canvas?.zones?.photo;
  if (!zone || slide?.presentationCompositionVersion !== 2 || slide.presentationSuppressPhoto
    || !['x', 'y', 'w', 'h'].every(key => Number.isFinite(zone[key]))
    || zone.w <= 0 || zone.h <= 0) return '16:9';
  const ratio = (1920 * zone.w) / (1080 * zone.h);
  const choices = ['16:9', '3:2', '1:1', '2:3', '9:16'];
  return choices.reduce((best, candidate) => {
    const value = item => {
      const [w, h] = item.split(':').map(Number);
      return Math.abs(Math.log(ratio / (w / h)));
    };
    return value(candidate) < value(best) ? candidate : best;
  }, choices[0]);
}
