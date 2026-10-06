/**
 * Padrões visuais exclusivos de apresentação 16:9.
 *
 * Mantêm o mesmo contrato editável dos padrões de carrossel (`brand` e
 * `slideDefaults`), mas a miniatura, a hierarquia e as composições foram
 * desenhadas para uma tela horizontal.
 */

import React from 'react';
import { applyVisualPreset, getSlideOverridesForPreset } from './visual-presets.jsx';

export const DEFAULT_PRESENTATION_VISUAL_PRESET_ID = 'presentation_executive_light';

const FF = Object.freeze({
  interTight: '"Inter Tight", sans-serif',
  inter: '"Inter", sans-serif',
  spaceGrotesk: '"Space Grotesk", sans-serif',
  dmSans: '"DM Sans", sans-serif',
  archivoBlack: '"Archivo Black", sans-serif',
  playfair: '"Playfair Display", serif',
});

/**
 * A composição usa as mesmas zonas editáveis do motor de cards. Os nomes
 * `titlePosition` e `imagePosition` são metadados semânticos para prompts/UI;
 * `canvas`, `layout`, `align` e `photoRegion` são aplicados diretamente pelo
 * renderer. Nenhum perfil cria gráfico, foto ou dado: ele apenas reserva uma
 * superfície para a evidência que já existe (ou que ainda será inserida).
 */
const composition = ({
  titlePosition,
  imagePosition,
  layout = 'tl',
  align = 'left',
  overlay = 0,
  title,
  subtitle,
  photo,
}) => Object.freeze({
  titlePosition,
  imagePosition,
  layout,
  align,
  overlay,
  photoRegion: 'full',
  bgFit: 'cover',
  zones: Object.freeze({
    photo: Object.freeze(photo),
    title: Object.freeze(title),
    subtitle: Object.freeze(subtitle),
  }),
});

const PRESENTATION_COMPOSITIONS = Object.freeze({
  // Executivo Claro
  'executive-cover': composition({
    titlePosition: 'left-center', imagePosition: 'right-panel', layout: 'ml',
    title: { x: 6, y: 22, w: 47, h: 25 },
    subtitle: { x: 6, y: 50, w: 47, h: 29 },
    photo: { x: 58, y: 0, w: 42, h: 100 },
  }),
  'executive-content': composition({
    titlePosition: 'top-left', imagePosition: 'right-evidence',
    title: { x: 6, y: 9, w: 48, h: 20 },
    subtitle: { x: 6, y: 32, w: 48, h: 51 },
    photo: { x: 59, y: 12, w: 35, h: 74 },
  }),
  'executive-divider': composition({
    titlePosition: 'center', imagePosition: 'background', layout: 'mc', align: 'center', overlay: 46,
    title: { x: 14, y: 30, w: 72, h: 25 },
    subtitle: { x: 22, y: 58, w: 56, h: 18 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),
  'executive-data': composition({
    titlePosition: 'top-left', imagePosition: 'right-evidence',
    title: { x: 6, y: 8, w: 42, h: 20 },
    subtitle: { x: 6, y: 32, w: 42, h: 50 },
    photo: { x: 52, y: 10, w: 42, h: 76 },
  }),
  'executive-demo': composition({
    titlePosition: 'top-left', imagePosition: 'wide-lower',
    title: { x: 6, y: 7, w: 88, h: 16 },
    subtitle: { x: 6, y: 75, w: 88, h: 17 },
    photo: { x: 6, y: 27, w: 88, h: 44 },
  }),
  'executive-close': composition({
    titlePosition: 'center', imagePosition: 'background', layout: 'mc', align: 'center', overlay: 52,
    title: { x: 15, y: 28, w: 70, h: 27 },
    subtitle: { x: 22, y: 58, w: 56, h: 19 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),

  // Pitch Noturno
  'pitch-cover': composition({
    titlePosition: 'bottom-left', imagePosition: 'full-bleed', layout: 'bl', overlay: 56,
    title: { x: 7, y: 52, w: 70, h: 25 },
    subtitle: { x: 7, y: 79, w: 62, h: 13 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),
  'pitch-content': composition({
    titlePosition: 'left-center', imagePosition: 'right-proof', layout: 'ml',
    title: { x: 7, y: 18, w: 42, h: 28 },
    subtitle: { x: 7, y: 50, w: 42, h: 35 },
    photo: { x: 54, y: 8, w: 46, h: 84 },
  }),
  'pitch-divider': composition({
    titlePosition: 'center', imagePosition: 'background', layout: 'mc', align: 'center', overlay: 60,
    title: { x: 12, y: 30, w: 76, h: 28 },
    subtitle: { x: 21, y: 61, w: 58, h: 14 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),
  'pitch-data': composition({
    titlePosition: 'top-left', imagePosition: 'right-evidence',
    title: { x: 7, y: 8, w: 42, h: 19 },
    subtitle: { x: 7, y: 31, w: 42, h: 52 },
    photo: { x: 53, y: 10, w: 40, h: 74 },
  }),
  'pitch-demo': composition({
    titlePosition: 'bottom-left', imagePosition: 'full-bleed', layout: 'bl', overlay: 48,
    title: { x: 7, y: 59, w: 67, h: 20 },
    subtitle: { x: 7, y: 81, w: 67, h: 12 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),
  'pitch-close': composition({
    titlePosition: 'center', imagePosition: 'background', layout: 'mc', align: 'center', overlay: 62,
    title: { x: 13, y: 30, w: 74, h: 30 },
    subtitle: { x: 24, y: 63, w: 52, h: 13 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),

  // Workshop Vivo
  'workshop-cover': composition({
    titlePosition: 'left-center', imagePosition: 'right-panel', layout: 'ml',
    title: { x: 6, y: 19, w: 48, h: 27 },
    subtitle: { x: 6, y: 50, w: 48, h: 30 },
    photo: { x: 59, y: 10, w: 35, h: 78 },
  }),
  'workshop-content': composition({
    titlePosition: 'top-left', imagePosition: 'lower-practice',
    title: { x: 6, y: 7, w: 88, h: 18 },
    subtitle: { x: 6, y: 28, w: 42, h: 60 },
    photo: { x: 53, y: 29, w: 41, h: 58 },
  }),
  'workshop-divider': composition({
    titlePosition: 'center', imagePosition: 'background', layout: 'mc', align: 'center', overlay: 28,
    title: { x: 13, y: 30, w: 74, h: 24 },
    subtitle: { x: 20, y: 57, w: 60, h: 20 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),
  'workshop-data': composition({
    titlePosition: 'top-left', imagePosition: 'right-evidence',
    title: { x: 6, y: 7, w: 88, h: 17 },
    subtitle: { x: 6, y: 29, w: 43, h: 58 },
    photo: { x: 54, y: 29, w: 40, h: 58 },
  }),
  'workshop-demo': composition({
    titlePosition: 'top-left', imagePosition: 'wide-lower',
    title: { x: 6, y: 7, w: 88, h: 17 },
    subtitle: { x: 6, y: 75, w: 88, h: 17 },
    photo: { x: 6, y: 28, w: 88, h: 43 },
  }),
  'workshop-close': composition({
    titlePosition: 'center', imagePosition: 'background', layout: 'mc', align: 'center', overlay: 24,
    title: { x: 13, y: 27, w: 74, h: 27 },
    subtitle: { x: 19, y: 57, w: 62, h: 22 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),

  // Dados & Insights
  'data-cover': composition({
    titlePosition: 'left-center', imagePosition: 'right-evidence', layout: 'ml',
    title: { x: 6, y: 20, w: 43, h: 26 },
    subtitle: { x: 6, y: 49, w: 43, h: 31 },
    photo: { x: 54, y: 12, w: 40, h: 72 },
  }),
  'data-content': composition({
    titlePosition: 'top-left', imagePosition: 'wide-evidence',
    title: { x: 6, y: 6, w: 88, h: 17 },
    subtitle: { x: 6, y: 74, w: 88, h: 18 },
    photo: { x: 6, y: 27, w: 88, h: 43 },
  }),
  'data-divider': composition({
    titlePosition: 'left-center', imagePosition: 'right-accent', layout: 'ml',
    title: { x: 8, y: 28, w: 56, h: 26 },
    subtitle: { x: 8, y: 57, w: 56, h: 18 },
    photo: { x: 70, y: 18, w: 24, h: 64 },
  }),
  'data-evidence': composition({
    titlePosition: 'top-left', imagePosition: 'wide-evidence',
    title: { x: 6, y: 6, w: 88, h: 16 },
    subtitle: { x: 6, y: 76, w: 88, h: 16 },
    photo: { x: 6, y: 26, w: 88, h: 46 },
  }),
  'data-demo': composition({
    titlePosition: 'left-center', imagePosition: 'right-evidence', layout: 'ml',
    title: { x: 6, y: 17, w: 42, h: 25 },
    subtitle: { x: 6, y: 46, w: 42, h: 36 },
    photo: { x: 53, y: 10, w: 41, h: 76 },
  }),
  'data-close': composition({
    titlePosition: 'center', imagePosition: 'background', layout: 'mc', align: 'center', overlay: 34,
    title: { x: 13, y: 29, w: 74, h: 27 },
    subtitle: { x: 20, y: 59, w: 60, h: 18 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),

  // Caso em Evidência
  'case-cover': composition({
    titlePosition: 'bottom-left', imagePosition: 'full-bleed', layout: 'bl', overlay: 50,
    title: { x: 7, y: 54, w: 70, h: 24 },
    subtitle: { x: 7, y: 80, w: 64, h: 12 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),
  'case-content': composition({
    titlePosition: 'top-left', imagePosition: 'wide-upper',
    title: { x: 6, y: 57, w: 88, h: 16 },
    subtitle: { x: 6, y: 75, w: 88, h: 18 },
    photo: { x: 0, y: 0, w: 100, h: 53 },
  }),
  'case-divider': composition({
    titlePosition: 'center', imagePosition: 'background', layout: 'mc', align: 'center', overlay: 56,
    title: { x: 12, y: 30, w: 76, h: 27 },
    subtitle: { x: 21, y: 60, w: 58, h: 16 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),
  'case-data': composition({
    titlePosition: 'top-left', imagePosition: 'left-evidence',
    title: { x: 51, y: 13, w: 43, h: 21 },
    subtitle: { x: 51, y: 38, w: 43, h: 47 },
    photo: { x: 0, y: 0, w: 46, h: 100 },
  }),
  'case-demo': composition({
    titlePosition: 'top-left', imagePosition: 'wide-upper',
    title: { x: 6, y: 58, w: 88, h: 16 },
    subtitle: { x: 6, y: 76, w: 88, h: 17 },
    photo: { x: 0, y: 0, w: 100, h: 54 },
  }),
  'case-close': composition({
    titlePosition: 'center', imagePosition: 'background', layout: 'mc', align: 'center', overlay: 58,
    title: { x: 12, y: 29, w: 76, h: 28 },
    subtitle: { x: 21, y: 60, w: 58, h: 16 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),

  // Keynote Cinemático
  'keynote-cover': composition({
    titlePosition: 'center', imagePosition: 'full-bleed', layout: 'mc', align: 'center', overlay: 60,
    title: { x: 10, y: 28, w: 80, h: 31 },
    subtitle: { x: 24, y: 62, w: 52, h: 14 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),
  'keynote-content': composition({
    titlePosition: 'center', imagePosition: 'full-bleed', layout: 'mc', align: 'center', overlay: 62,
    title: { x: 11, y: 29, w: 78, h: 29 },
    subtitle: { x: 23, y: 61, w: 54, h: 15 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),
  'keynote-divider': composition({
    titlePosition: 'center', imagePosition: 'background', layout: 'mc', align: 'center', overlay: 68,
    title: { x: 9, y: 27, w: 82, h: 33 },
    subtitle: { x: 26, y: 63, w: 48, h: 12 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),
  'keynote-evidence': composition({
    titlePosition: 'bottom-left', imagePosition: 'full-bleed', layout: 'bl', overlay: 54,
    title: { x: 7, y: 56, w: 72, h: 23 },
    subtitle: { x: 7, y: 81, w: 62, h: 12 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),
  'keynote-demo': composition({
    titlePosition: 'bottom-left', imagePosition: 'full-bleed', layout: 'bl', overlay: 46,
    title: { x: 7, y: 58, w: 70, h: 21 },
    subtitle: { x: 7, y: 81, w: 62, h: 12 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),
  'keynote-close': composition({
    titlePosition: 'center', imagePosition: 'background', layout: 'mc', align: 'center', overlay: 70,
    title: { x: 10, y: 28, w: 80, h: 32 },
    subtitle: { x: 26, y: 63, w: 48, h: 12 },
    photo: { x: 0, y: 0, w: 100, h: 100 },
  }),
});

const PRESENTATION_COMPOSITION_ALIASES = Object.freeze({
  split: 'executive-cover',
  'title-body': 'executive-content',
  spotlight: 'pitch-cover',
  'statement-proof': 'pitch-content',
  'friendly-grid': 'workshop-cover',
  'lesson-cards': 'workshop-content',
  'metric-led': 'data-cover',
  'chart-commentary': 'data-content',
  'photo-result': 'case-cover',
  'before-after': 'case-content',
  'cinematic-statement': 'keynote-cover',
  'single-idea': 'keynote-content',
});

const preset = (definition) => Object.freeze({
  productKind: 'apresentacao',
  creativePreset: 'apresentacao',
  fmt: 'apresentacao',
  aspectRatio: '16:9',
  width: 1920,
  height: 1080,
  ...definition,
  brand: Object.freeze({ subtitleVisible: true, ...definition.brand }),
  slideDefaults: Object.freeze({ ...definition.slideDefaults }),
  presentationDefaults: Object.freeze({ ...definition.presentationDefaults }),
});

export const PRESENTATION_VISUAL_PRESETS = Object.freeze([
  preset({
    id: 'presentation_executive_light',
    label: 'Executivo Claro',
    desc: 'Fundo claro, títulos azul-marinho e estrutura sóbria para propostas e decisões.',
    previewVariant: 'split',
    brand: {
      bg: '#f6f7fb',
      titleColor: '#101828',
      subtitleColor: '#344054',
      textColor: '#475467',
      accent: '#175cd3',
      titleFont: FF.spaceGrotesk,
      bodyFont: FF.inter,
      textTitleWeight: 700,
      textTitleCase: 'normal',
      textTitleTracking: 0,
      textTitleLeading: 108,
      textSubLeading: 145,
      showPageBadge: true,
    },
    slideDefaults: { layout: 'tl', align: 'left' },
    presentationDefaults: {
      coverComposition: 'split',
      contentComposition: 'title-body',
      dividerComposition: 'executive-divider',
      dataComposition: 'executive-data',
      demoComposition: 'executive-demo',
      closingComposition: 'executive-close',
      imageTreatment: 'right-panel',
    },
  }),
  preset({
    id: 'presentation_pitch_dark',
    label: 'Pitch Noturno',
    desc: 'Azul profundo, violeta elétrico e contraste alto para visão, produto e oportunidade.',
    previewVariant: 'spotlight',
    brand: {
      bg: '#070b18',
      titleColor: '#f8fafc',
      subtitleColor: '#d0d5dd',
      textColor: '#b2ccff',
      accent: '#9e77ed',
      titleFont: FF.spaceGrotesk,
      bodyFont: FF.interTight,
      textTitleWeight: 700,
      textTitleCase: 'normal',
      textTitleTracking: -1,
      textTitleLeading: 104,
      textSubLeading: 140,
      showPageBadge: true,
    },
    slideDefaults: { layout: 'ml', align: 'left' },
    presentationDefaults: {
      coverComposition: 'spotlight',
      contentComposition: 'statement-proof',
      dividerComposition: 'pitch-divider',
      dataComposition: 'pitch-data',
      demoComposition: 'pitch-demo',
      closingComposition: 'pitch-close',
      imageTreatment: 'full-bleed-dark',
    },
  }),
  preset({
    id: 'presentation_workshop',
    label: 'Workshop Vivo',
    desc: 'Creme quente, laranja e blocos didáticos para aulas, exercícios e facilitação.',
    previewVariant: 'cards',
    brand: {
      bg: '#fff7ed',
      titleColor: '#431407',
      subtitleColor: '#7c2d12',
      textColor: '#7c2d12',
      accent: '#c2410c',
      titleFont: FF.dmSans,
      bodyFont: FF.inter,
      textTitleWeight: 700,
      textTitleCase: 'normal',
      textTitleTracking: 0,
      textTitleLeading: 110,
      textSubLeading: 150,
      showPageBadge: true,
    },
    slideDefaults: { layout: 'tl', align: 'left' },
    presentationDefaults: {
      coverComposition: 'friendly-grid',
      contentComposition: 'lesson-cards',
      dividerComposition: 'workshop-divider',
      dataComposition: 'workshop-data',
      demoComposition: 'workshop-demo',
      closingComposition: 'workshop-close',
      imageTreatment: 'rounded-panel',
    },
  }),
  preset({
    id: 'presentation_data',
    label: 'Dados & Insights',
    desc: 'Azul-gelo, gráficos limpos e hierarquia analítica para relatórios executivos.',
    previewVariant: 'data',
    brand: {
      bg: '#ecf4ff',
      titleColor: '#0b1f3a',
      subtitleColor: '#344054',
      textColor: '#475467',
      accent: '#0063b8',
      titleFont: FF.interTight,
      bodyFont: FF.inter,
      textTitleWeight: 700,
      textTitleCase: 'normal',
      textTitleTracking: 0,
      textTitleLeading: 108,
      textSubLeading: 145,
      showPageBadge: true,
    },
    slideDefaults: { layout: 'tl', align: 'left' },
    presentationDefaults: {
      coverComposition: 'metric-led',
      contentComposition: 'chart-commentary',
      dividerComposition: 'data-divider',
      dataComposition: 'data-evidence',
      demoComposition: 'data-demo',
      closingComposition: 'data-close',
      imageTreatment: 'data-first',
    },
  }),
  preset({
    id: 'presentation_case_study',
    label: 'Caso em Evidência',
    desc: 'Verde profundo, lima e fotografia ampla para contexto, execução e resultados.',
    previewVariant: 'case',
    brand: {
      bg: '#10211a',
      titleColor: '#f7fee7',
      subtitleColor: '#d9f99d',
      textColor: '#d1fae5',
      accent: '#a3e635',
      titleFont: FF.interTight,
      bodyFont: FF.inter,
      textTitleWeight: 700,
      textTitleCase: 'normal',
      textTitleTracking: 0,
      textTitleLeading: 106,
      textSubLeading: 142,
      showPageBadge: true,
    },
    slideDefaults: { layout: 'bl', align: 'left' },
    presentationDefaults: {
      coverComposition: 'photo-result',
      contentComposition: 'before-after',
      dividerComposition: 'case-divider',
      dataComposition: 'case-data',
      demoComposition: 'case-demo',
      closingComposition: 'case-close',
      imageTreatment: 'wide-photo',
    },
  }),
  preset({
    id: 'presentation_keynote',
    label: 'Keynote Cinemático',
    desc: 'Preto, branco e coral para frases marcantes, imagens imersivas e ritmo de palco.',
    previewVariant: 'keynote',
    brand: {
      bg: '#09090b',
      titleColor: '#fafafa',
      subtitleColor: '#d4d4d8',
      textColor: '#a1a1aa',
      accent: '#fb7185',
      titleFont: FF.playfair,
      bodyFont: FF.interTight,
      textTitleWeight: 700,
      textTitleCase: 'normal',
      textTitleTracking: -1,
      textTitleLeading: 102,
      textSubLeading: 145,
      showPageBadge: false,
    },
    slideDefaults: { layout: 'mc', align: 'center' },
    presentationDefaults: {
      coverComposition: 'cinematic-statement',
      contentComposition: 'single-idea',
      dividerComposition: 'keynote-divider',
      dataComposition: 'keynote-evidence',
      demoComposition: 'keynote-demo',
      closingComposition: 'keynote-close',
      imageTreatment: 'full-bleed-cinematic',
    },
  }),
]);

export const PRESENTATION_VISUAL_PRESET_BY_ID = Object.freeze(
  Object.fromEntries(PRESENTATION_VISUAL_PRESETS.map((item) => [item.id, item])),
);

const VISUAL_PRESET_ALIASES = Object.freeze({
  executive: 'presentation_executive_light',
  executivo: 'presentation_executive_light',
  claro: 'presentation_executive_light',
  pitch: 'presentation_pitch_dark',
  dark: 'presentation_pitch_dark',
  workshop: 'presentation_workshop',
  aula: 'presentation_workshop',
  data: 'presentation_data',
  dados: 'presentation_data',
  report: 'presentation_data',
  case: 'presentation_case_study',
  estudo_de_caso: 'presentation_case_study',
  keynote: 'presentation_keynote',
  manifesto: 'presentation_keynote',
});

function presetSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizePresentationVisualPreset(value, fallback = DEFAULT_PRESENTATION_VISUAL_PRESET_ID) {
  const raw = value && typeof value === 'object' ? value.id : value;
  const slug = presetSlug(raw);
  const canonical = VISUAL_PRESET_ALIASES[slug] || slug;
  if (PRESENTATION_VISUAL_PRESET_BY_ID[canonical]) return canonical;

  const fallbackSlug = presetSlug(fallback);
  const normalizedFallback = VISUAL_PRESET_ALIASES[fallbackSlug] || fallbackSlug;
  return PRESENTATION_VISUAL_PRESET_BY_ID[normalizedFallback]
    ? normalizedFallback
    : DEFAULT_PRESENTATION_VISUAL_PRESET_ID;
}

export function getPresentationVisualPreset(value) {
  return PRESENTATION_VISUAL_PRESET_BY_ID[normalizePresentationVisualPreset(value)];
}

/** Aplica só a assinatura visual; conteúdo e logo existentes são preservados. */
export function applyPresentationVisualPreset(brand, presetId) {
  const normalized = normalizePresentationVisualPreset(presetId);
  return applyVisualPreset(brand, normalized, PRESENTATION_VISUAL_PRESETS);
}

export function getPresentationSlideOverrides(presetId) {
  const normalized = normalizePresentationVisualPreset(presetId);
  return getSlideOverridesForPreset(normalized, PRESENTATION_VISUAL_PRESETS);
}

const PRESENTATION_DATA_ROLES = new Set([
  'data', 'metric', 'result', 'matrix', 'comparison', 'priorities',
]);
const PRESENTATION_DEMO_ROLES = new Set([
  'demo', 'example', 'evidence', 'story', 'people', 'application',
]);
const PRESENTATION_DIVIDER_ROLES = new Set([
  'agenda', 'question', 'reframe', 'contrast', 'statement', 'vision', 'objectives',
]);

function normalizeCompositionInput(input, stageArg, indexArg, countArg) {
  const objectInput = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const isOptions = ['slide', 'stage', 'index', 'count']
    .some((key) => Object.prototype.hasOwnProperty.call(objectInput, key));
  const slide = isOptions ? (objectInput.slide || {}) : objectInput;
  const stage = isOptions ? (objectInput.stage || {}) : (stageArg || {});
  const rawIndex = isOptions ? objectInput.index : indexArg;
  const rawCount = isOptions ? objectInput.count : countArg;
  const index = Math.max(0, Math.trunc(Number(rawIndex) || 0));
  const count = Math.max(1, Math.trunc(Number(rawCount) || 1));
  return { slide, stage, index, count };
}

function presentationCompositionKind({ slide, stage, index, count }) {
  if (index === 0) return 'cover';
  if (index >= count - 1) return 'closing';
  const role = String(
    stage?.visualRole || slide?.presentationVisualRole || slide?.visualRole || '',
  ).trim().toLowerCase();
  if (PRESENTATION_DATA_ROLES.has(role)) return 'data';
  if (PRESENTATION_DEMO_ROLES.has(role)) return 'demo';
  if (PRESENTATION_DIVIDER_ROLES.has(role)) return 'divider';
  return 'content';
}

function clonePresentationZones(zones) {
  return Object.fromEntries(
    Object.entries(zones || {}).map(([key, rect]) => [key, { ...rect }]),
  );
}

/**
 * Traduz um padrão visual em composição real do slide 16:9.
 *
 * Forma recomendada:
 * `getPresentationCompositionOverrides(presetId, { slide, stage, index, count })`.
 * A forma posicional `(presetId, slide, stage, index, count)` também é aceita.
 * O helper não cria conteúdo visual: uma zona de evidência vazia continua vazia.
 */
export function getPresentationCompositionOverrides(
  presetId,
  input = {},
  stageArg = {},
  indexArg = 0,
  countArg = 1,
) {
  const normalizedPresetId = normalizePresentationVisualPreset(presetId);
  const presetDefinition = getPresentationVisualPreset(normalizedPresetId);
  const { slide, stage, index, count } = normalizeCompositionInput(
    input,
    stageArg,
    indexArg,
    countArg,
  );
  const kind = presentationCompositionKind({ slide, stage, index, count });
  const defaults = presetDefinition.presentationDefaults || {};
  const field = kind === 'closing' ? 'closingComposition' : `${kind}Composition`;
  const configuredComposition = defaults[field]
    || (kind === 'cover' ? defaults.coverComposition : defaults.contentComposition);
  const compositionId = PRESENTATION_COMPOSITION_ALIASES[configuredComposition]
    || configuredComposition;
  const profile = PRESENTATION_COMPOSITIONS[compositionId]
    || PRESENTATION_COMPOSITIONS[PRESENTATION_COMPOSITION_ALIASES[defaults.contentComposition]]
    || PRESENTATION_COMPOSITIONS['executive-content'];
  const visualRole = String(
    stage?.visualRole
    || slide?.presentationVisualRole
    || slide?.visualRole
    || 'content',
  ).trim().toLowerCase() || 'content';

  return {
    ...getPresentationSlideOverrides(normalizedPresetId),
    layout: profile.layout,
    align: profile.align,
    photoRegion: profile.photoRegion,
    bgFit: profile.bgFit,
    overlay: profile.overlay,
    showSwipeCue: false,
    canvas: {
      enabled: false,
      applied: true,
      variant: 'classic',
      source: 'presentation-preset',
      preserveZones: true,
      zones: clonePresentationZones(profile.zones),
    },
    // Metadados explícitos: úteis para prompts, edição e migrações futuras.
    presentationPresetId: normalizedPresetId,
    presentationComposition: kind,
    presentationCompositionId: compositionId,
    presentationVisualRole: visualRole,
    titlePosition: profile.titlePosition,
    imagePosition: profile.imagePosition,
    presentationLayout: {
      titlePosition: profile.titlePosition,
      imagePosition: profile.imagePosition,
      imageTreatment: defaults.imageTreatment || '',
      visualRole,
    },
  };
}

function textLines({ color, x, y, widths, height = 5, gap = 4, align = 'left' }) {
  return widths.map((width, index) => {
    const left = align === 'center' ? x - (width / 2) : x;
    return (
      <rect
        key={`${x}-${y}-${index}`}
        x={left}
        y={y + index * (height + gap)}
        width={width}
        height={height}
        rx={height / 3}
        fill={color}
      />
    );
  });
}

/** Miniatura realmente horizontal para seletores de apresentação. */
export function renderPresentationPresetPreview(presetOrId, svgStyle = {}) {
  const p = presetOrId && typeof presetOrId === 'object'
    ? presetOrId
    : getPresentationVisualPreset(presetOrId);
  const b = p?.brand || getPresentationVisualPreset().brand;
  const variant = p?.previewVariant || 'split';
  const title = b.titleColor || '#ffffff';
  const body = b.subtitleColor || title;
  const accent = b.accent || title;
  const bg = b.bg || '#111111';
  const centered = variant === 'keynote';

  return (
    <svg
      viewBox="0 0 160 90"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', borderRadius: 8, overflow: 'hidden', ...svgStyle }}
    >
      <rect width="160" height="90" fill={bg} />

      {variant === 'split' && (
        <>
          <rect x="104" width="56" height="90" fill={accent} opacity="0.14" />
          <rect x="112" y="12" width="38" height="55" rx="5" fill={accent} opacity="0.28" />
          <circle cx="131" cy="38" r="13" fill={accent} opacity="0.38" />
        </>
      )}
      {variant === 'spotlight' && (
        <>
          <circle cx="126" cy="20" r="42" fill={accent} opacity="0.23" />
          <circle cx="126" cy="20" r="23" fill={accent} opacity="0.17" />
          <path d="M93 82 L154 25" stroke={accent} strokeWidth="2" opacity="0.6" />
        </>
      )}
      {variant === 'cards' && (
        <>
          <rect x="91" y="17" width="28" height="24" rx="4" fill={accent} opacity="0.26" />
          <rect x="123" y="17" width="25" height="24" rx="4" fill={accent} opacity="0.5" />
          <rect x="91" y="45" width="57" height="25" rx="4" fill={accent} opacity="0.18" />
        </>
      )}
      {variant === 'data' && (
        <g transform="translate(91 19)">
          {[22, 38, 28, 51].map((height, index) => (
            <rect key={height} x={index * 14} y={51 - height} width="9" height={height} rx="2" fill={accent} opacity={0.35 + index * 0.15} />
          ))}
          <path d="M0 42 C12 38, 23 43, 36 25 S51 19, 57 9" fill="none" stroke={title} strokeWidth="2" opacity="0.72" />
        </g>
      )}
      {variant === 'case' && (
        <>
          <rect x="86" width="74" height="90" fill={accent} opacity="0.12" />
          <path d="M87 70 L110 42 L123 55 L145 22 L160 34 V90 H87Z" fill={accent} opacity="0.30" />
          <circle cx="127" cy="29" r="11" fill={title} opacity="0.13" />
        </>
      )}
      {variant === 'keynote' && (
        <>
          <circle cx="80" cy="43" r="35" fill={accent} opacity="0.12" />
          <circle cx="80" cy="43" r="22" fill={accent} opacity="0.08" />
          <rect x="46" y="70" width="68" height="2" rx="1" fill={accent} />
        </>
      )}

      <rect x="10" y="9" width="18" height="2.5" rx="1.2" fill={accent} />
      <rect x="139" y="9" width="11" height="2.5" rx="1.2" fill={body} opacity="0.55" />

      <g>
        {textLines({
          color: title,
          x: centered ? 80 : 12,
          y: centered ? 30 : 27,
          widths: centered ? [84, 62] : [68, 57],
          height: centered ? 8 : 7,
          gap: 4,
          align: centered ? 'center' : 'left',
        })}
        {textLines({
          color: body,
          x: centered ? 80 : 12,
          y: centered ? 55 : 51,
          widths: centered ? [47] : [58, 45],
          height: 2.6,
          gap: 2.5,
          align: centered ? 'center' : 'left',
        })}
      </g>
    </svg>
  );
}
