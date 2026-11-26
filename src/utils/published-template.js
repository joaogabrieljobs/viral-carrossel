/**
 * Modelo publicado (docs/product/publicar-modelo.md).
 *
 * Um modelo é a ESTRUTURA visual de um projeto — diagramação das caixas,
 * tipografia, cores e ornamentos — sem nada do conteúdo nem da identidade do
 * cliente. Este módulo é usado igual no navegador (montar, pré-visualizar e
 * aplicar) e no servidor (que reconstrói o modelo por lista permitida antes de
 * gravar: o que o navegador mandar fora da lista é descartado).
 *
 * Nunca entra: títulos, textos, legenda, fotos, vídeo, logo, @, nome, bio, tom
 * de voz, material, fontes próprias enviadas e qualquer texto livre de rodapé
 * ou cabeçalho. Ornamento de texto só passa se for vazio ou feito só dos
 * marcadores {handle}, {marca} e {ano}, que cada projeto resolve com a própria marca.
 */
import {
  sanitizeCustomVisualPresetBrand,
  sanitizeCustomVisualPresetSlideDefaults,
} from './custom-visual-presets.js';
import { dropKeysFromFormatViews } from './format-view-keys.js';

export const TEMPLATE_VERSION = 1;
export const TEMPLATE_FORMATS = ['carrossel', 'quadrado', 'stories', 'apresentacao'];
export const TEMPLATE_ROLES = ['cover', 'content', 'closing'];
export const TEMPLATE_MAX_SLIDES = 10;
export const TEMPLATE_MAX_BYTES = 48 * 1024;
export const TEMPLATE_NAME_MAX = 60;
export const TEMPLATE_DESCRIPTION_MAX = 160;
export const TEMPLATE_AUTHOR_MAX = 40;

/** Campos de texto livre da marca: só marcadores passam. */
const ORNAMENT_TEXT_FIELDS = [
  'cultureHeaderLeft', 'cultureHeaderCenter', 'cultureHeaderYear',
  'footerPillText', 'footerBarLeft', 'footerBarCenter', 'footerBarRight',
];
/** Campos do card que o padrão salvo leva, mas são conteúdo: nunca entram no modelo. */
const SLIDE_CONTENT_IN_PRESET = ['eyebrowText', 'strikethroughText', 'afterTitleText'];

/** Campos visuais do card que o modelo controla (e que aplicar substitui). */
export const TEMPLATE_SLIDE_FIELDS = [
  'layout', 'align', 'composition', 'canvas', 'elementOffsets', 'elementsUnlocked',
  'photoRegion', 'overlay', 'bgOpacity', 'bgFit',
  'textShadow', 'textBg', 'textBgOpacity', 'textInset',
  'titleSize', 'subSize', 'bodyAfterSize',
  'titleTracking', 'subTracking', 'titleLeading', 'subLeading',
  'bodyTracking', 'bodyLeading', 'bodyWeight',
  'titleCase', 'titleWeight', 'bgPattern', 'cultureTone', 'useCultureLayout',
  'presentationGlass', 'presentationTitleSizeByComposition',
  'presentationTitleLeadingByComposition', 'presentationTypographyByComposition',
];
/** Ajustes por card que vêm de outro estilo e precisam sair para o modelo valer. */
const SLIDE_STYLE_OVERRIDES = [
  'visualBrand', 'visualPresetId', 'visualCreativePreset',
  // Todas as marcas da composição social (a mesma lista de
  // SOCIAL_COMPOSITION_FIELDS). Com só quatro delas, o véu, o selo e os
  // ornamentos do estilo anterior continuavam desenhados sobre o modelo.
  'socialComposition', 'socialCompositionVersion', 'socialVisualPresetId', 'socialZoneAnchors',
  'overlayMode', 'socialScrimTop', 'socialScrimMin', 'socialArt', 'socialFunction', 'socialFamily',
  'socialPhotoTreatment', 'titleItalic', 'subtitleWeight', 'hideFooterPill',
  'subtitleCase', 'subtitleItalic',
];

const TOKEN_ONLY = /^(?:\s|\{handle\}|\{marca\}|\{ano\}|[·•|/–—\-])*$/i;
const UNSAFE_STRING = /[<>\\]|url\s*\(|expression\s*\(|javascript:|@import/i;
const MAX_STRING = 120;

function cleanString(value, field) {
  if (typeof value !== 'string') return value;
  if (ORNAMENT_TEXT_FIELDS.includes(field)) return TOKEN_ONLY.test(value) ? value.trim() : undefined;
  if (value.length > MAX_STRING || UNSAFE_STRING.test(value)) return undefined;
  if (/[{}]/.test(value)) return undefined;
  return value;
}

/** Limpa recursivamente: só tipos simples, sem texto perigoso, sem chaves exóticas. */
function cleanDeep(value, field, depth = 0) {
  if (depth > 6) return undefined;
  if (value == null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') return cleanString(value, field);
  if (Array.isArray(value)) {
    const out = value.slice(0, 24).map((item) => cleanDeep(item, field, depth + 1)).filter((item) => item !== undefined);
    return out;
  }
  if (typeof value !== 'object') return undefined;
  const out = {};
  for (const [key, item] of Object.entries(value).slice(0, 40)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,40}$/.test(key)) continue;
    const cleaned = cleanDeep(item, field, depth + 1);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

function cleanFields(source) {
  const out = {};
  for (const [field, value] of Object.entries(source || {})) {
    const cleaned = cleanDeep(value, field);
    if (cleaned !== undefined) out[field] = cleaned;
  }
  return out;
}

export function sanitizeTemplateBrand(brand) {
  return cleanFields(sanitizeCustomVisualPresetBrand(brand || {}));
}

export function sanitizeTemplateSlide(slide) {
  const picked = sanitizeCustomVisualPresetSlideDefaults(slide || {});
  for (const field of SLIDE_CONTENT_IN_PRESET) delete picked[field];
  const out = {};
  for (const field of TEMPLATE_SLIDE_FIELDS) {
    if (picked[field] !== undefined) out[field] = picked[field];
  }
  return cleanFields(out);
}

function roleFor(index, total) {
  if (index === 0) return 'cover';
  if (index === total - 1 && total > 1) return 'closing';
  return 'content';
}

/** Monta o modelo a partir do projeto aberto. Nada do conteúdo sai daqui. */
export function buildTemplateContent(doc = {}) {
  const format = TEMPLATE_FORMATS.includes(doc.fmt) ? doc.fmt : 'carrossel';
  const source = Array.isArray(doc.slides) ? doc.slides.slice(0, TEMPLATE_MAX_SLIDES) : [];
  const slides = (source.length ? source : [{}]).map((slide, index, all) => ({
    role: roleFor(index, all.length),
    ...sanitizeTemplateSlide(slide),
  }));
  return { v: TEMPLATE_VERSION, format, brand: sanitizeTemplateBrand(doc.brand), slides };
}

const fail = (code, message) => Object.assign(new Error(message), { code, status: 400 });

/**
 * Reconstrói o modelo recebido por lista permitida. É o que o servidor grava:
 * qualquer campo fora da lista some, mesmo que o navegador tenha mandado.
 */
export function sanitizeTemplateContent(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw fail('template_invalid', 'Modelo inválido.');
  if (raw.v !== TEMPLATE_VERSION) throw fail('template_version', 'Versão do modelo não suportada.');
  if (!TEMPLATE_FORMATS.includes(raw.format)) throw fail('template_format', 'Formato do modelo inválido.');
  if (!Array.isArray(raw.slides) || raw.slides.length < 1 || raw.slides.length > TEMPLATE_MAX_SLIDES) {
    throw fail('template_slides', `O modelo precisa ter de 1 a ${TEMPLATE_MAX_SLIDES} cards.`);
  }
  const slides = raw.slides.map((slide, index) => ({
    role: TEMPLATE_ROLES.includes(slide?.role) ? slide.role : roleFor(index, raw.slides.length),
    ...sanitizeTemplateSlide(slide),
  }));
  const content = { v: TEMPLATE_VERSION, format: raw.format, brand: sanitizeTemplateBrand(raw.brand), slides };
  if (templateContentBytes(content) > TEMPLATE_MAX_BYTES) throw fail('template_too_large', 'O modelo ficou grande demais.');
  return content;
}

export function templateContentBytes(content) {
  return new TextEncoder().encode(JSON.stringify(content)).length;
}

const oneLine = (value) => String(value ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();

/** Nome, descrição e autor: texto curto, uma linha, sem marcação. */
export function sanitizeTemplateMeta({ name, description, authorName } = {}) {
  const cleanName = oneLine(name).slice(0, TEMPLATE_NAME_MAX);
  if (!cleanName) throw fail('template_name', 'Dê um nome ao modelo.');
  return {
    name: cleanName,
    description: oneLine(description).slice(0, TEMPLATE_DESCRIPTION_MAX),
    authorName: oneLine(authorName).slice(0, TEMPLATE_AUTHOR_MAX) || null,
  };
}

function pickTemplateSlide(content, index, total) {
  const byRole = (role) => content.slides.filter((slide) => slide.role === role);
  const covers = byRole('cover');
  const contents = byRole('content');
  const closings = byRole('closing');
  if (index === 0 && covers.length) return covers[0];
  if (index === total - 1 && total > 1 && closings.length) return closings[0];
  if (contents.length) return contents[(Math.max(0, index - 1)) % contents.length];
  return covers[0] || closings[0] || content.slides[0];
}

/**
 * Aplica o modelo ao projeto: a capa vai para o primeiro card, o fechamento
 * para o último e os cards de conteúdo se repetem no meio. Textos, fotos, logo
 * e identidade do projeto continuam. O formato do projeto não muda.
 */
export function applyTemplateToDoc(doc = {}, rawContent) {
  const content = sanitizeTemplateContent(rawContent);
  const slides = Array.isArray(doc.slides) ? doc.slides : [];
  const nextSlides = slides.map((slide, index) => {
    const template = pickTemplateSlide(content, index, slides.length);
    const next = { ...slide };
    for (const field of TEMPLATE_SLIDE_FIELDS) delete next[field];
    for (const field of SLIDE_STYLE_OVERRIDES) delete next[field];
    const { role, ...visual } = template;
    return { ...next, ...structuredCloneSafe(visual) };
  });
  // O que a pessoa ajustou numa proporção (em apresentação, tudo) vencia o
  // modelo: o aviso dizia aplicado e a tela ficava igual. Logo e recorte da
  // foto não são do modelo e continuam.
  const formatViews = dropKeysFromFormatViews(doc.formatViews, {
    brandKeys: Object.keys(content.brand || {}),
    slideKeys: [...TEMPLATE_SLIDE_FIELDS, ...SLIDE_STYLE_OVERRIDES],
  });
  return {
    ...doc,
    brand: { ...(doc.brand || {}), ...structuredCloneSafe(content.brand) },
    slides: nextSlides,
    visualPreset: null,
    ...(formatViews !== doc.formatViews ? { formatViews } : {}),
  };
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

const SAMPLE_TEXT = {
  cover: { title: 'Título de exemplo do modelo', subtitle: 'Texto de apoio fictício para mostrar a diagramação.' },
  content: { title: 'Um ponto importante', subtitle: 'Explicação curta de exemplo, sem conteúdo de cliente.' },
  closing: { title: 'Chamada final', subtitle: 'Salve e compartilhe.' },
};

/** Projeto fictício para a prévia: o modelo com texto do Moont, nunca do autor. */
export function templatePreviewDoc(rawContent) {
  const content = sanitizeTemplateContent(rawContent);
  return {
    fmt: content.format,
    brand: { name: '', handle: '', ...content.brand },
    slides: content.slides.map((slide, index) => {
      const { role, ...visual } = slide;
      return { id: `preview-${index}`, num: index + 1, ...(SAMPLE_TEXT[role] || SAMPLE_TEXT.content), ...visual };
    }),
  };
}
