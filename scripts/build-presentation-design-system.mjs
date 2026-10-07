import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');

export const SOURCE_PATH = path.join(
  ROOT_DIR,
  'docs/presentation/presentation-design-system.json',
);
export const OUTPUT_PATH = path.join(
  ROOT_DIR,
  'src/generated/presentation-design-system.generated.js',
);

const CANVAS = Object.freeze({ width: 1920, height: 1080 });
const PROFILE_NAMES = Object.freeze(['cover', 'content', 'divider', 'data', 'demo', 'closing']);

/**
 * Explicit bridge between the richer source catalog and the six presentation
 * roles the current card renderer supports. Do not infer this mapping by role:
 * choosing an archetype is an editorial decision and needs a reviewable diff.
 */
export const PATTERN_CONFIG = Object.freeze({
  'pds.executive-minimal': {
    id: 'presentation_executive_minimal', previewVariant: 'split',
    archetypes: {
      cover: 'cover', content: 'image-split', divider: 'section',
      data: 'chart-takeaway', demo: 'image-split', closing: 'closing',
    },
  },
  'pds.editorial-magazine': {
    id: 'presentation_editorial_magazine', previewVariant: 'editorial',
    archetypes: {
      cover: 'cover-masthead', content: 'feature-opener', divider: 'pull-quote',
      data: 'chart-spread', demo: 'gallery-captions', closing: 'colophon',
    },
  },
  'pds.data-first': {
    id: 'presentation_data_first', previewVariant: 'data',
    archetypes: {
      cover: 'cover-kpi', content: 'insight-cards', divider: 'voice-metric',
      data: 'chart-insight', demo: 'annotated-screenshot', closing: 'decisions',
    },
  },
  'pds.swiss-grid': {
    id: 'presentation_swiss_grid', previewVariant: 'swiss',
    archetypes: {
      cover: 'cover-index', content: 'asymmetric', divider: 'section-index',
      data: 'grid-chart', demo: 'figure-grid', closing: 'contact-block',
    },
  },
  'pds.cinematic': {
    id: 'presentation_cinematic', previewVariant: 'cinematic',
    archetypes: {
      cover: 'title-card', content: 'subtitle-text', divider: 'chapter',
      data: 'big-number', demo: 'scene', closing: 'credits',
    },
  },
  'pds.typographic-bold': {
    id: 'presentation_typographic_bold', previewVariant: 'typographic',
    archetypes: {
      cover: 'cover-mega', content: 'title-and-line', divider: 'statement-mega',
      data: 'stacked-bars-type', demo: 'duotone-block', closing: 'closing-cta',
    },
  },
  'pds.modular-cards': {
    id: 'presentation_modular_cards', previewVariant: 'modular',
    archetypes: {
      cover: 'cover-cards', content: 'hero-card', divider: 'testimonial-card',
      data: 'chart-card', demo: 'screenshot-card', closing: 'next-steps-cards',
    },
  },
  'pds.photo-essay': {
    id: 'presentation_photo_essay', previewVariant: 'photo',
    archetypes: {
      cover: 'cover-full', content: 'image-text', divider: 'text-interlude',
      data: 'number-photo', demo: 'single-mat', closing: 'closing-thanks',
    },
  },
  'pds.technical-blueprint': {
    id: 'presentation_technical_blueprint', previewVariant: 'blueprint',
    archetypes: {
      cover: 'cover-sheet', content: 'spec-sheet', divider: 'annotated-quote',
      data: 'line-chart-tech', demo: 'dimensioned-figure', closing: 'revision-table',
    },
  },
  'pds.premium-dark': {
    id: 'presentation_premium_dark', previewVariant: 'premium',
    archetypes: {
      cover: 'cover-glow', content: 'glass-panels', divider: 'section-glow',
      data: 'chart-glass', demo: 'hero-product', closing: 'closing-cta',
    },
  },
});

/**
 * Only fonts already loaded by the Studio may reach the runtime bundle.
 * Source-only families are mapped to the closest installed family instead of
 * shipping remote font hrefs from an imported document.
 */
export const FONT_ALLOWLIST = Object.freeze({
  'Inter Tight': '"Inter Tight", sans-serif',
  Inter: '"Inter", sans-serif',
  'Playfair Display': '"Playfair Display", serif',
  'Libre Franklin': '"Libre Franklin", sans-serif',
  'Source Serif 4': '"Source Serif 4", serif',
  'IBM Plex Sans': '"IBM Plex Sans", sans-serif',
  'IBM Plex Sans Condensed': '"IBM Plex Sans Condensed", sans-serif',
  'IBM Plex Mono': '"IBM Plex Mono", monospace',
  Archivo: '"Archivo", sans-serif',
  'Bebas Neue': '"Bebas Neue", sans-serif',
  Montserrat: '"Montserrat", sans-serif',
  Anton: '"Anton", sans-serif',
  'Space Grotesk': '"Space Grotesk", sans-serif',
  'Plus Jakarta Sans': '"Plus Jakarta Sans", sans-serif',
  'Cormorant Garamond': '"Cormorant Garamond", serif',
  Jost: '"Jost", sans-serif',
  'JetBrains Mono': '"JetBrains Mono", monospace',
  Cormorant: '"Cormorant", serif',
  Manrope: '"Manrope", sans-serif',
});

// The source has a few archetypes with captions only or container-only text.
// These overrides reserve explicit editable title/subtitle regions rather than
// treating metadata/folios as the user's content.
const SAFE_ZONE_OVERRIDES = Object.freeze({
  'pds.editorial-magazine:demo': {
    title: { x: 5, y: 5, w: 90, h: 14 },
    subtitle: { x: 5, y: 82, w: 90, h: 13 },
  },
  'pds.modular-cards:divider': {
    title: { x: 18, y: 24, w: 64, h: 25 },
    subtitle: { x: 22, y: 54, w: 56, h: 20 },
  },
  'pds.photo-essay:demo': {
    title: { x: 8, y: 5, w: 84, h: 13 },
    subtitle: { x: 20, y: 83, w: 60, h: 12 },
  },
});

function fail(message) {
  throw new Error(`presentation-design-system: ${message}`);
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
}

function assertCanvas(canvas, label) {
  assertObject(canvas, label);
  if (canvas.width !== CANVAS.width || canvas.height !== CANVAS.height) {
    fail(`${label} must be ${CANVAS.width}x${CANVAS.height}`);
  }
  if (canvas.aspectRatio !== '16:9' || canvas.unit !== 'px') {
    fail(`${label} must use 16:9 pixel coordinates`);
  }
}

function assertRect(rect, label) {
  assertObject(rect, label);
  for (const field of ['x', 'y', 'w', 'h']) {
    if (!Number.isFinite(rect[field])) fail(`${label}.${field} must be finite`);
  }
  if (rect.x < 0 || rect.y < 0 || rect.w <= 0 || rect.h <= 0) {
    fail(`${label} must have a positive in-canvas rectangle`);
  }
  if (rect.x + rect.w > CANVAS.width || rect.y + rect.h > CANVAS.height) {
    fail(`${label} exceeds the ${CANVAS.width}x${CANVAS.height} canvas`);
  }
}

export function validateDesignSystem(source) {
  assertObject(source, 'root');
  if (source.productType !== 'presentation') fail('productType must be presentation');
  if (typeof source.version !== 'string' || !source.version.trim()) fail('version is required');
  assertCanvas(source.canvas, 'root.canvas');
  if (!Array.isArray(source.patterns) || source.patterns.length !== 10) {
    fail('exactly 10 patterns are required');
  }

  const expectedIds = Object.keys(PATTERN_CONFIG);
  const sourceIds = source.patterns.map((pattern) => pattern?.id);
  if (new Set(sourceIds).size !== sourceIds.length) fail('pattern ids must be unique');
  if (expectedIds.some((id) => !sourceIds.includes(id))) fail('the source pattern set is incomplete');
  if (sourceIds.some((id) => !expectedIds.includes(id))) fail('the source contains an unsupported pattern id');

  const orderedIds = source.selection?.orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.length !== 10 || new Set(orderedIds).size !== 10) {
    fail('selection.orderedIds must list 10 unique patterns');
  }
  if (orderedIds.some((id, index) => id !== expectedIds[index])) {
    fail('selection.orderedIds must match the reviewed runtime order');
  }

  for (const pattern of source.patterns) {
    assertCanvas(pattern.canvas, `${pattern.id}.canvas`);
    const config = PATTERN_CONFIG[pattern.id];
    if (!Array.isArray(pattern.archetypes)) fail(`${pattern.id}.archetypes must be an array`);
    const archetypeById = new Map(pattern.archetypes.map((item) => [item.id, item]));
    if (archetypeById.size !== pattern.archetypes.length) fail(`${pattern.id} has duplicate archetype ids`);
    if (Object.keys(config.archetypes).join(',') !== PROFILE_NAMES.join(',')) {
      fail(`${pattern.id} must map exactly ${PROFILE_NAMES.join(', ')}`);
    }
    for (const [profile, archetypeId] of Object.entries(config.archetypes)) {
      const archetype = archetypeById.get(archetypeId);
      if (!archetype) fail(`${pattern.id}.${profile} references missing archetype ${archetypeId}`);
      assertObject(archetype.slots, `${pattern.id}.${archetypeId}.slots`);
      for (const [slotId, slot] of Object.entries(archetype.slots)) {
        assertObject(slot, `${pattern.id}.${archetypeId}.${slotId}`);
        assertRect(slot.rect, `${pattern.id}.${archetypeId}.${slotId}.rect`);
      }
    }
    for (const role of ['title', 'subtitle', 'body']) {
      const family = pattern.typography?.[role]?.family;
      if (!FONT_ALLOWLIST[family]) fail(`${pattern.id} uses unsupported ${role} font ${family}`);
    }
  }
  return source;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Number(value.toFixed(2));
}

function pxRectToPercent(rect) {
  const x = clamp(Number(rect?.x) || 0, 0, CANVAS.width - 1);
  const y = clamp(Number(rect?.y) || 0, 0, CANVAS.height - 1);
  const w = clamp(Number(rect?.w) || 1, 1, CANVAS.width - x);
  const h = clamp(Number(rect?.h) || 1, 1, CANVAS.height - y);
  return {
    x: round((x / CANVAS.width) * 100),
    y: round((y / CANVAS.height) * 100),
    w: round((w / CANVAS.width) * 100),
    h: round((h / CANVAS.height) * 100),
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x
    && a.y < b.y + b.h && a.y + a.h > b.y;
}

function expandTextRect(rect, minHeight) {
  const next = { ...rect };
  next.y = round(clamp(next.y, 0, 100 - minHeight));
  next.w = round(clamp(next.w, 20, 100 - next.x));
  next.h = round(clamp(Math.max(next.h, minHeight), minHeight, 100 - next.y));
  return next;
}

const TITLE_TERMS = ['title', 'header', 'statement', 'quote', 'number', 'index', 'metric', 'masthead'];
const SUBTITLE_TERMS = [
  'subtitle', 'body', 'support', 'deck', 'note', 'insight', 'attribution',
  'contact', 'caption', 'label', 'credits', 'signoff', 'meta', 'source',
];

function textSlotScore([name, slot], terms) {
  const normalized = `${name} ${slot.role || ''}`
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  const tokens = new Set(normalized.split(/[^a-z0-9]+/).filter(Boolean));
  const index = terms.findIndex((term) => tokens.has(term));
  return index < 0 ? -1 : terms.length - index;
}

function pickTextSlots(slots) {
  const textSlots = Object.entries(slots).filter(([, slot]) => slot.kind === 'text');
  const rankedTitle = [...textSlots].sort((a, b) => (
    textSlotScore(b, TITLE_TERMS) - textSlotScore(a, TITLE_TERMS)
  ));
  const title = rankedTitle.find((entry) => textSlotScore(entry, TITLE_TERMS) >= 0) || textSlots[0];
  const remaining = textSlots.filter((entry) => entry !== title);
  const rankedSubtitle = [...remaining].sort((a, b) => (
    textSlotScore(b, SUBTITLE_TERMS) - textSlotScore(a, SUBTITLE_TERMS)
  ));
  const subtitle = rankedSubtitle.find((entry) => textSlotScore(entry, SUBTITLE_TERMS) >= 0)
    || remaining[0];
  return { title, subtitle };
}

function pickEvidenceSlot(slots) {
  const entries = Object.entries(slots);
  const native = entries.find(([, slot]) => slot.kind === 'image');
  if (native) return native;
  const advancedKinds = ['chart', 'table', 'svg', 'group'];
  for (const kind of advancedKinds) {
    const found = entries.find(([name, slot]) => (
      slot.kind === kind && !/titleblock|logo|actions|contact/i.test(name)
    ));
    if (found) return found;
  }
  return null;
}

function synthesizedPhoto(profile) {
  if (['cover', 'divider', 'closing'].includes(profile)) return { x: 0, y: 0, w: 100, h: 100 };
  return { x: 54, y: 10, w: 40, h: 80 };
}

function fallbackTextZones(profile, photo, align = 'left') {
  if (['cover', 'divider', 'closing'].includes(profile) || (photo.w >= 90 && photo.h >= 90)) {
    return {
      title: { x: 12, y: 25, w: 76, h: 27 },
      subtitle: { x: 20, y: 57, w: 60, h: 22 },
      align: 'center',
    };
  }
  if (photo.x >= 48) {
    return {
      title: { x: 6, y: 10, w: 42, h: 20 },
      subtitle: { x: 6, y: 34, w: 42, h: 54 },
      align: 'left',
    };
  }
  if (photo.x + photo.w <= 52) {
    return {
      title: { x: 54, y: 10, w: 40, h: 20 },
      subtitle: { x: 54, y: 34, w: 40, h: 54 },
      align: 'left',
    };
  }
  return {
    title: { x: 6, y: 7, w: 88, h: 18 },
    subtitle: { x: 6, y: 73, w: 88, h: 20 },
    align,
  };
}

function resolveTextZones(patternId, profile, slots, photo) {
  const { title: titleSlot, subtitle: subtitleSlot } = pickTextSlots(slots);
  const sourceAlign = titleSlot?.[1]?.align || subtitleSlot?.[1]?.align || 'left';
  const fallback = fallbackTextZones(profile, photo, sourceAlign);
  const override = SAFE_ZONE_OVERRIDES[`${patternId}:${profile}`] || {};
  // Uma caixa de título com apenas 10% da altura ainda corta fontes display
  // altas (Cormorant, Anton e Bebas) depois de padding e overshoot. O mínimo
  // de 16% mantém uma linha grande ou duas linhas curtas legíveis no canvas
  // 16:9; quando colide com o subtítulo, o fallback seguro redistribui ambos.
  let title = expandTextRect(
    override.title || (titleSlot ? pxRectToPercent(titleSlot[1].rect) : fallback.title),
    16,
  );
  let subtitle = expandTextRect(
    override.subtitle || (subtitleSlot ? pxRectToPercent(subtitleSlot[1].rect) : fallback.subtitle),
    14,
  );

  if (rectsOverlap(title, subtitle)) {
    // O fallback lateral separa os blocos, mas não deve achatar uma caixa de
    // título válida da fonte. Preserve sua altura sempre que ela ainda couber
    // antes do subtítulo de fallback (com 1% de respiro); títulos maiores são
    // limitados ao espaço realmente disponível.
    const availableTitleHeight = Math.max(
      fallback.title.h,
      fallback.subtitle.y - fallback.title.y - 1,
    );
    title = {
      ...fallback.title,
      h: round(Math.min(Math.max(fallback.title.h, title.h), availableTitleHeight)),
    };
    subtitle = fallback.subtitle;
  }
  // Rounding can only add hundredths, but clamp once more so generated zones
  // are guaranteed to stay inside the renderer's percentage coordinate space.
  title = pxRectToPercent({
    x: (title.x / 100) * CANVAS.width,
    y: (title.y / 100) * CANVAS.height,
    w: (title.w / 100) * CANVAS.width,
    h: (title.h / 100) * CANVAS.height,
  });
  subtitle = pxRectToPercent({
    x: (subtitle.x / 100) * CANVAS.width,
    y: (subtitle.y / 100) * CANVAS.height,
    w: (subtitle.w / 100) * CANVAS.width,
    h: (subtitle.h / 100) * CANVAS.height,
  });
  if (rectsOverlap(title, subtitle)) fail(`${patternId}.${profile} generated overlapping text zones`);
  return {
    title,
    subtitle,
    align: override.align || sourceAlign || fallback.align,
    titleTypographyRole: titleSlot?.[1]?.role || 'h1',
    subtitleTypographyRole: subtitleSlot?.[1]?.role || 'subtitle',
    titleSlot,
    subtitleSlot,
  };
}

function positiveInteger(value, fallback) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function fallbackLimitForRole(sourceLimits, role, fallbackField) {
  const normalized = String(role || '').trim().toLowerCase();
  const sourceKey = ['body', 'deck', 'subtitlecaption'].includes(normalized)
    ? (normalized === 'body' ? 'body' : 'subtitle')
    : ['caption', 'label', 'folio'].includes(normalized)
      ? 'caption'
      : normalized === 'quote'
        ? 'quote'
        : normalized === 'bullets'
          ? 'body'
          : fallbackField;
  return sourceLimits?.[sourceKey] || sourceLimits?.[fallbackField] || {};
}

function compositionTextLimit(entry, sourceLimits, fallbackField) {
  const slot = entry?.[1] || {};
  const fallback = fallbackLimitForRole(sourceLimits, slot.role, fallbackField);
  return {
    maxChars: positiveInteger(slot.maxChars, positiveInteger(fallback.maxChars, fallbackField === 'title' ? 72 : 140)),
    maxLines: positiveInteger(slot.maxLines, positiveInteger(fallback.maxLines, fallbackField === 'title' ? 2 : 4)),
    role: String(slot.role || fallbackField),
  };
}

function positionFromRect(rect, align) {
  const vertical = rect.y < 25 ? 'top' : rect.y + rect.h > 72 ? 'bottom' : 'center';
  const horizontal = align === 'center' ? 'center' : rect.x > 50 ? 'right' : 'left';
  return vertical === 'center' && horizontal === 'center' ? 'center' : `${vertical}-${horizontal}`;
}

function imagePositionFromRect(rect) {
  if (rect.x <= 1 && rect.y <= 1 && rect.w >= 98 && rect.h >= 98) return 'full-bleed';
  if (rect.x >= 48) return 'right-evidence';
  if (rect.x + rect.w <= 52) return 'left-evidence';
  if (rect.w >= 75 && rect.y >= 20) return 'wide-evidence';
  if (rect.y >= 35) return 'lower-evidence';
  return 'evidence-panel';
}

function layoutFromPosition(titlePosition, align) {
  const vertical = titlePosition.startsWith('top') ? 't'
    : titlePosition.startsWith('bottom') ? 'b' : 'm';
  const horizontal = align === 'center' ? 'c' : align === 'right' ? 'r' : 'l';
  return `${vertical}${horizontal}`;
}

function compositionFor(pattern, config, profile, archetype) {
  const evidenceSlot = pickEvidenceSlot(archetype.slots);
  const photo = evidenceSlot ? pxRectToPercent(evidenceSlot[1].rect) : synthesizedPhoto(profile);
  const evidenceKind = evidenceSlot?.[1]?.kind || 'synthetic';
  const evidenceFallback = evidenceKind !== 'image';
  const text = resolveTextZones(pattern.id, profile, archetype.slots, photo);
  const align = ['left', 'center', 'right'].includes(text.align) ? text.align : 'left';
  const titlePosition = positionFromRect(text.title, align);
  const photoOverlapsText = rectsOverlap(photo, text.title) || rectsOverlap(photo, text.subtitle);
  const fit = evidenceSlot?.[1]?.fit;
  return {
    titlePosition,
    imagePosition: imagePositionFromRect(photo),
    layout: layoutFromPosition(titlePosition, align),
    align,
    // A pessoa pode inserir uma foto manualmente mesmo quando a fonte
    // descreve chart/table/group. O contraste depende da geometria renderizada,
    // portanto precisa acompanhar a sobreposição real, e não o tipo original.
    overlay: photoOverlapsText ? 48 : 0,
    photoRegion: 'full',
    bgFit: String(fit || '').startsWith('contain') ? 'contain' : 'cover',
    zones: { title: text.title, subtitle: text.subtitle, photo },
    archetypeId: archetype.id,
    evidenceFallback,
    evidenceGlass: evidenceSlot?.[1]?.glass === true,
    titleTypographyRole: text.titleTypographyRole,
    subtitleTypographyRole: text.subtitleTypographyRole,
    titleTypographyItalic: text.titleSlot?.[1]?.italic === true,
    subtitleTypographyItalic: text.subtitleSlot?.[1]?.italic === true,
    textLimits: {
      title: compositionTextLimit(text.titleSlot, pattern.textLimits, 'title'),
      subtitle: compositionTextLimit(text.subtitleSlot, pattern.textLimits, 'subtitle'),
      body: compositionTextLimit(null, pattern.textLimits, 'body'),
    },
    // A zona visual pode representar gráfico/tabela/grupo adaptado. Só uma
    // evidência originalmente declarada como `image` deve disparar geração de
    // imagem automática; os outros tipos continuam como superfícies editáveis.
    requiresImage: evidenceKind === 'image',
  };
}

function parseSourceTracking(value) {
  const parsed = Number.parseFloat(String(value || '0'));
  return Number.isFinite(parsed) ? round(clamp(parsed * 100, -40, 40)) : 0;
}

/**
 * O renderer guarda tracking como ajuste relativo: no CSS soma -3 ao título
 * e -1 ao subtítulo. Convertemos o valor absoluto da fonte para o controlo que
 * reproduz exatamente o token de origem (ex.: 0.14em vira 15, pois -1+15=14).
 */
function rendererTrackingControl(value, rendererBase) {
  return round(parseSourceTracking(value) - rendererBase);
}

function typographyCase(value) {
  if (value === 'uppercase') return 'upper';
  if (value === 'lowercase') return 'lower';
  return 'normal';
}

function rendererSizePercent(size, basePx, fallback = 100) {
  const parsed = Number(size);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  // O mesmo campo editável pode representar de `caption` (18–20 px) a
  // `display` (144 px). O intervalo precisa preservar ambos ao converter para
  // as bases distintas do renderer de título e subtítulo.
  return round(clamp((parsed / basePx) * 100, 8, 320));
}

function glassOpacityPercent(glass) {
  if (!glass || typeof glass !== 'object') return 55;
  const match = String(glass.background || '').match(/rgba?\([^)]*[,/]\s*([\d.]+)\s*\)$/i);
  if (!match) return 55;
  const alpha = Number(match[1]);
  if (!Number.isFinite(alpha)) return 55;
  return Math.round(clamp(alpha * 100, 0, 100));
}

function typographyScaleForRole(scale, role, fallbackRole = 'h1') {
  const normalized = String(role || '').trim().toLowerCase();
  // Os papéis do PDS são case-sensitive no JSON (`subtitleCaption`,
  // `dataLabel`, `kpiSmall`), enquanto slots e aliases são normalizados pelo
  // compilador. Resolva a tabela sem distinguir maiúsculas para preservar o
  // token exato em vez de cair silenciosamente no fallback h1/subtitle.
  const normalizedScale = Object.fromEntries(
    Object.entries(scale || {}).map(([key, value]) => [String(key).toLowerCase(), value]),
  );
  const lookup = (key) => scale?.[key]
    || normalizedScale[String(key || '').toLowerCase()]
    || null;
  const alias = {
    number: 'display',
    metric: 'display',
    statement: 'display',
  }[normalized];
  return lookup(role)
    || (alias ? lookup(alias) : null)
    || lookup(fallbackRole)
    || lookup('h1')
    || lookup('display')
    || {};
}

const TITLE_TYPOGRAPHY_ROLES = new Set([
  'display', 'h1', 'h2', 'h3', 'mega', 'index', 'kpi', 'kpismall',
  'number', 'metric', 'statement', 'quote', 'cardtitle',
]);
const SUBTITLE_TYPOGRAPHY_ROLES = new Set([
  'subtitle', 'deck', 'subtitlecaption',
]);
const LABEL_TYPOGRAPHY_ROLES = new Set([
  'label', 'folio', 'chip',
]);
const BODY_AUX_TYPOGRAPHY_ROLES = new Set([
  'caption', 'credits', 'axis', 'datalabel', 'dimension', 'code',
]);

function typographyDefinitionForRole(typography, role, fallbackKind) {
  const normalized = String(role || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const direct = typography?.[role] || typography?.[normalized];
  if (direct?.family) return direct;
  if (['kpi', 'kpismall', 'number', 'metric'].includes(normalized) && typography?.numeric?.family) {
    return typography.numeric;
  }
  if (TITLE_TYPOGRAPHY_ROLES.has(normalized)) return typography?.title;
  if (SUBTITLE_TYPOGRAPHY_ROLES.has(normalized)) return typography?.subtitle;
  if (LABEL_TYPOGRAPHY_ROLES.has(normalized)) {
    return typography?.label || typography?.subtitle || typography?.body;
  }
  if (BODY_AUX_TYPOGRAPHY_ROLES.has(normalized)) return typography?.body;
  if (['body', 'bullets'].includes(normalized)) return typography?.body;
  return typography?.[fallbackKind] || typography?.body || typography?.title;
}

function compositionTypographyToken(pattern, composition, field) {
  const isTitle = field === 'title';
  const role = isTitle
    ? composition?.titleTypographyRole
    : composition?.subtitleTypographyRole;
  const fallbackRole = isTitle ? 'h1' : 'subtitle';
  const definition = typographyDefinitionForRole(
    pattern.typography,
    role,
    isTitle ? 'title' : 'subtitle',
  ) || {};
  const scale = typographyScaleForRole(pattern.typography.scale, role, fallbackRole);
  const fallbackDefinition = pattern.typography?.[isTitle ? 'title' : 'subtitle'] || {};
  const basePx = CANVAS.width * (isTitle ? 0.084 : 0.028);
  const rendererTrackingBase = isTitle ? -3 : -1;
  return {
    role: String(role || fallbackRole),
    fontFamily: FONT_ALLOWLIST[definition.family]
      || FONT_ALLOWLIST[fallbackDefinition.family]
      || (isTitle ? '"Inter Tight", sans-serif' : '"Inter", sans-serif'),
    sizePercent: rendererSizePercent(scale.size, basePx),
    leadingPercent: clamp(
      Math.round((Number(scale.lineHeight) || (isTitle ? 1.08 : 1.4)) * 100),
      85,
      190,
    ),
    weight: clamp(Number(definition.weight) || Number(fallbackDefinition.weight) || 400, 100, 900),
    tracking: rendererTrackingControl(
      definition.letterSpacing ?? fallbackDefinition.letterSpacing,
      rendererTrackingBase,
    ),
    case: typographyCase(definition.case ?? fallbackDefinition.case),
    italic: isTitle
      ? composition?.titleTypographyItalic === true
      : composition?.subtitleTypographyItalic === true,
  };
}

function compileGlassTokens(pattern, compositions, compositionIds) {
  const source = pattern.effects?.glass;
  if (!source || typeof source !== 'object') return null;
  const applyTo = PROFILE_NAMES.filter(
    (profile) => compositions[compositionIds[profile]]?.evidenceGlass === true,
  );
  return {
    enabled: true,
    background: String(source.background || 'rgba(255,255,255,0.05)'),
    backdropBlur: clamp(Number(source.backdropBlur) || 0, 0, 80),
    border: String(source.border || '1px solid rgba(255,255,255,0.12)'),
    radius: clamp(Number(source.radius) || 0, 0, 96),
    innerShadow: String(source.innerShadow || ''),
    boxShadow: String(pattern.effects?.shadows?.panel || ''),
    applyTo,
  };
}

function compactTextLimit(limit, defaults, caps) {
  return {
    maxChars: Math.max(1, Math.min(Number(limit?.maxChars) || defaults.maxChars, caps.maxChars)),
    maxLines: Math.max(1, Math.min(Number(limit?.maxLines) || defaults.maxLines, caps.maxLines)),
  };
}

function compilePattern(pattern, config, compositions) {
  const archetypeById = new Map(pattern.archetypes.map((item) => [item.id, item]));
  const compositionIds = {};
  const fallbackProfiles = [];
  const adaptedKinds = new Set();
  for (const profile of PROFILE_NAMES) {
    const compositionId = `${config.id}:${profile}`;
    const archetype = archetypeById.get(config.archetypes[profile]);
    const composition = compositionFor(pattern, config, profile, archetype);
    compositions[compositionId] = composition;
    compositionIds[profile] = compositionId;
    if (composition.evidenceFallback) {
      fallbackProfiles.push(profile);
      adaptedKinds.add(pickEvidenceSlot(archetype.slots)?.[1]?.kind || 'synthetic');
    }
  }

  const palette = pattern.palette;
  const titleType = pattern.typography.title;
  const subtitleType = pattern.typography.subtitle;
  const bodyType = pattern.typography.body;
  const titleScale = pattern.typography.scale?.h1 || pattern.typography.scale?.display || {};
  const subtitleScale = pattern.typography.scale?.subtitle
    || pattern.typography.scale?.deck
    || pattern.typography.scale?.body
    || {};
  const bodyScale = pattern.typography.scale?.body || {};
  const sourceLimits = pattern.textLimits || {};
  const autoSteps = Array.isArray(pattern.autofit?.steps) ? pattern.autofit.steps : [];
  const roles = new Set(pattern.archetypes.map((item) => item.role));
  const imageComposition = compositions[compositionIds.demo];
  const presentationAutofit = {
    enabled: pattern.autofit?.enabled !== false,
    mode: pattern.autofit?.mode || 'shrink-then-split',
    minScale: clamp(Number(pattern.autofit?.maxShrinkRatio) || 0.82, 0.5, 1),
    preventOrphans: pattern.autofit?.preventOrphans !== false
      && pattern.autofit?.orphanControl !== false,
    splitOnOverflow: autoSteps.some((step) => (
      step?.action === 'split-slide' || step?.action === 'continue-on-next-slide'
    )),
    rewriteTitle: String(pattern.autofit?.titleOverflow || '').includes('rewrite'),
  };
  const titleSize = rendererSizePercent(titleScale.size, CANVAS.width * 0.084);
  const subtitleSize = rendererSizePercent(subtitleScale.size, CANVAS.width * 0.028);
  const bodySize = rendererSizePercent(bodyScale.size, CANVAS.width * 0.018);
  const titleTracking = rendererTrackingControl(titleType.letterSpacing, -3);
  const subtitleTracking = rendererTrackingControl(subtitleType.letterSpacing, -1);
  const bodyTracking = rendererTrackingControl(bodyType.letterSpacing, -0.4);
  const titleLeading = clamp(Math.round((Number(titleScale.lineHeight) || 1.08) * 100), 85, 140);
  const subtitleLeading = clamp(
    Math.round((Number(subtitleScale.lineHeight) || 1.4) * 100),
    100,
    180,
  );
  const bodyLeading = clamp(Math.round((Number(bodyScale.lineHeight) || 1.45) * 100), 100, 190);
  const titleWeight = clamp(Number(titleType.weight) || 700, 100, 900);
  const subtitleWeight = clamp(Number(subtitleType.weight) || 400, 100, 900);
  const bodyWeight = clamp(Number(bodyType.weight) || 400, 100, 900);
  const titleCase = typographyCase(titleType.case);
  const subtitleCase = typographyCase(subtitleType.case);
  const textBgOpacity = glassOpacityPercent(pattern.effects?.glass);
  const presentationGlass = compileGlassTokens(pattern, compositions, compositionIds);
  const presentationTypographyByComposition = Object.fromEntries(PROFILE_NAMES.map((profile) => {
    const composition = compositions[compositionIds[profile]];
    return [profile, {
      title: compositionTypographyToken(pattern, composition, 'title'),
      subtitle: compositionTypographyToken(pattern, composition, 'subtitle'),
    }];
  }));
  // Campos legados mantidos durante a migração de documentos já salvos.
  const presentationTitleSizeByComposition = Object.fromEntries(PROFILE_NAMES.map((profile) => [
    profile,
    presentationTypographyByComposition[profile].title.sizePercent,
  ]));
  const presentationTitleLeadingByComposition = Object.fromEntries(PROFILE_NAMES.map((profile) => [
    profile,
    presentationTypographyByComposition[profile].title.leadingPercent,
  ]));

  return {
    id: config.id,
    sourceId: pattern.id,
    sourceVersion: pattern.version || pattern.canvas?.version || null,
    label: pattern.name,
    desc: pattern.description,
    category: pattern.category,
    useCases: Array.isArray(pattern.useCases) ? pattern.useCases.slice(0, 6) : [],
    previewVariant: config.previewVariant,
    brand: {
      bg: palette.background,
      titleColor: palette.textPrimary,
      subtitleColor: palette.textSecondary,
      textColor: palette.textSecondary,
      accent: palette.accent,
      titleFont: FONT_ALLOWLIST[titleType.family],
      subtitleFont: FONT_ALLOWLIST[subtitleType.family],
      bodyFont: FONT_ALLOWLIST[bodyType.family],
      textTitleWeight: titleWeight,
      textTitleCase: titleCase,
      textTitleTracking: titleTracking,
      textTitleSize: titleSize,
      subtitleWeight,
      subtitleCase,
      textSubTracking: subtitleTracking,
      textSubSize: subtitleSize,
      textBodyAfterSize: bodySize,
      bodyWeight,
      textBodyTracking: bodyTracking,
      textBodyLeading: bodyLeading,
      textTitleLeading: titleLeading,
      textSubLeading: subtitleLeading,
      showPageBadge: true,
    },
    slideDefaults: {
      layout: compositions[compositionIds.content].layout,
      align: compositions[compositionIds.content].align,
      titleSize,
      subSize: subtitleSize,
      titleTracking,
      subTracking: subtitleTracking,
      titleLeading,
      subLeading: subtitleLeading,
      titleWeight,
      titleCase,
      bodyAfterSize: bodySize,
      bodyTracking,
      bodyLeading,
      bodyWeight,
      presentationTypographyByComposition,
      presentationTitleSizeByComposition,
      presentationTitleLeadingByComposition,
      textBg: false,
      textBgOpacity,
      presentationGlass,
      presentationAutofit,
    },
    presentationDefaults: {
      coverComposition: compositionIds.cover,
      contentComposition: compositionIds.content,
      dividerComposition: compositionIds.divider,
      dataComposition: compositionIds.data,
      demoComposition: compositionIds.demo,
      closingComposition: compositionIds.closing,
      imageTreatment: imageComposition.imagePosition,
    },
    textLimits: {
      title: compactTextLimit(sourceLimits.title, { maxChars: 72, maxLines: 2 }, { maxChars: 96, maxLines: 3 }),
      subtitle: compactTextLimit(sourceLimits.subtitle, { maxChars: 120, maxLines: 3 }, { maxChars: 180, maxLines: 4 }),
      body: compactTextLimit(sourceLimits.body, { maxChars: 320, maxLines: 8 }, { maxChars: 420, maxLines: 12 }),
      bullets: {
        maxItems: Math.min(Number(sourceLimits.bullets?.maxItems) || 0, 6),
        maxCharsPerItem: Math.min(Number(sourceLimits.bullets?.maxCharsPerItem) || 80, 90),
      },
      wordsPerSlide: Math.min(Number(sourceLimits.wordsPerSlide) || 80, 110),
    },
    autofit: presentationAutofit,
    capabilities: {
      images: roles.has('image'),
      data: roles.has('data'),
      comparison: roles.has('comparison'),
      process: roles.has('process'),
      glass: Boolean(pattern.effects?.glass),
      evidenceFallbacks: fallbackProfiles,
      adaptedKinds: [...adaptedKinds],
    },
  };
}

export function compileDesignSystem(source) {
  validateDesignSystem(source);
  const sourceById = new Map(source.patterns.map((pattern) => [pattern.id, pattern]));
  const patterns = [];
  const compositions = {};
  for (const sourceId of source.selection.orderedIds) {
    patterns.push(compilePattern(sourceById.get(sourceId), PATTERN_CONFIG[sourceId], compositions));
  }
  return {
    version: source.version,
    patterns,
    compositions,
  };
}

export function renderGeneratedModule(compiled) {
  const serializedPatterns = JSON.stringify(compiled.patterns, null, 2);
  const serializedCompositions = JSON.stringify(compiled.compositions, null, 2);
  return `/* eslint-disable */\n/**\n * AUTO-GENERATED by scripts/build-presentation-design-system.mjs.\n * Source: docs/presentation/presentation-design-system.json\n * Do not edit by hand. SVG, href and example payloads are intentionally omitted.\n */\n\nexport const PRESENTATION_DESIGN_SYSTEM_VERSION = ${JSON.stringify(compiled.version)};\n\nexport const GENERATED_PRESENTATION_PATTERNS = Object.freeze(${serializedPatterns});\n\nexport const GENERATED_PRESENTATION_COMPOSITIONS = Object.freeze(${serializedCompositions});\n`;
}

export function buildPresentationDesignSystem({ sourcePath = SOURCE_PATH, outputPath = OUTPUT_PATH } = {}) {
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const compiled = compileDesignSystem(source);
  const output = renderGeneratedModule(compiled);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output, 'utf8');
  return compiled;
}

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const compiled = buildPresentationDesignSystem();
  process.stdout.write(
    `Generated ${compiled.patterns.length} presentation patterns and ${Object.keys(compiled.compositions).length} compositions.\n`,
  );
}
