/**
 * Modo livre de apresentação ("O Moont decide"), fase 1.
 * Spec: docs/product/modo-livre-apresentacao.md.
 *
 * - `deckDesign` (um por deck): paleta de 8 cores, par de fontes da biblioteca
 *   local e uma frase de clima para a foto.
 * - `design` (um por slide, enums fechados): família, fundo, tamanho da foto,
 *   bloco, trechos em destaque e ícones.
 * - Normalizadores corrigem qualquer valor fora do contrato para o permitido
 *   mais próximo, sem novo pedido à IA.
 * - Diretor de arte determinístico: escolhe o design de cada página entre as
 *   geometrias que as 10 famílias já desenham, garantindo em código contraste,
 *   ritmo e variedade de fundos e fotos. Mesma entrada, mesma saída.
 *
 * Módulo puro: sem React e sem DOM.
 */
import {
  FAMILY_KEYS, FREE_PRESENTATION_PRESET_ID, PRESENTATION_FAMILIES, familySpec, groundInks,
  normalizeFamilyKey,
} from './presentation-families.js';
import {
  contentAwarePresentationLayout, contentAwarePresentationOverrides, fittedTitleSize, hasBlocks,
  hasVisual, photoSizeOfLayout, resolvePresentationCompositionKind,
} from './presentation-composition.js';
import { pitchCompositionOverrides } from './pitch-content.js';
import { titleTrackingBase } from './title-tracking.js';
import { wcagContrast } from './wcag.js';

export { FREE_PRESENTATION_PRESET_ID };

export const FREE_GROUNDS = Object.freeze(['bg', 'surface', 'inverse', 'accent', 'photo']);
export const FREE_PHOTO_SIZES = Object.freeze(['none', 'small', 'half', 'full']);
export const FREE_BLOCKS = Object.freeze(['none', 'comparison', 'metrics', 'steps', 'quote', 'bignumber', 'icons']);
/** Lista fechada de ícones lucide (nomes kebab-case) para o bloco de ícones. */
export const FREE_ICONS = Object.freeze([
  'check', 'arrow-right', 'trending-up', 'trending-down', 'users', 'user', 'calendar', 'clock',
  'map-pin', 'star', 'heart', 'lightbulb', 'target', 'shield', 'zap', 'globe', 'music', 'camera',
  'book-open', 'briefcase', 'bar-chart', 'dollar-sign', 'leaf', 'sparkles', 'message-circle', 'rocket',
]);
export const FREE_PALETTE_KEYS = Object.freeze(['bg', 'surface', 'ink', 'muted', 'accent', 'accent2', 'inverse', 'inverseInk']);

/* ------------------------------------------------------------------------ */
/* Fontes: só as 20 da biblioteca local (presentation-font-manifest.js)      */
/* ------------------------------------------------------------------------ */

const f = (generic, display, text, extra = {}) => ({ generic, display, text, ...extra });
/**
 * Métricas por papel. `text: null` marca as faces de título (condensadas ou de
 * peso único) que não servem para texto corrido: o normalizador troca pela
 * mais próxima da mesma linha (`textFallback`).
 */
const FONT_SPECS = Object.freeze({
  Fraunces: f('Georgia, serif', { weight: 380, widthFactor: 0.5, tracking: -2.2 }, { weight: 400, tracking: 0 }, { serif: true }),
  'Source Serif 4': f('serif', { weight: 600, widthFactor: 0.52, tracking: -1.5 }, { weight: 400, tracking: 0 }, { serif: true }),
  'Inter Tight': f('sans-serif', { weight: 600, widthFactor: 0.52, tracking: -2.4 }, { weight: 400, tracking: -0.4 }),
  Inter: f('sans-serif', { weight: 600, widthFactor: 0.55, tracking: -2.4 }, { weight: 400, tracking: -0.4 }),
  Archivo: f('sans-serif', { weight: 800, widthFactor: 0.6, tracking: -4.2 }, { weight: 400, tracking: -0.6 }),
  'Barlow Condensed': f('Arial Narrow, sans-serif', { weight: 600, widthFactor: 0.47, tracking: 1.2, case: 'upper' }, null, { textFallback: 'Barlow', condensed: true }),
  Barlow: f('Arial, sans-serif', { weight: 500, widthFactor: 0.52, tracking: -1 }, { weight: 400, tracking: 0 }),
  'Bodoni Moda': f('Didot, serif', { weight: 400, widthFactor: 0.52, tracking: -1.2 }, null, { textFallback: 'Jost', serif: true }),
  Jost: f('sans-serif', { weight: 500, widthFactor: 0.52, tracking: -1.5 }, { weight: 400, tracking: 0.4 }),
  Anton: f('sans-serif', { weight: 400, widthFactor: 0.5, tracking: 0.4, case: 'upper' }, null, { textFallback: 'Space Grotesk', condensed: true }),
  'Space Grotesk': f('sans-serif', { weight: 700, widthFactor: 0.56, tracking: -2 }, { weight: 400, tracking: -0.6 }),
  Syne: f('Arial, sans-serif', { weight: 700, widthFactor: 0.64, tracking: -2.6 }, null, { textFallback: 'DM Sans' }),
  'DM Sans': f('Arial, sans-serif', { weight: 700, widthFactor: 0.55, tracking: -2 }, { weight: 400, tracking: -0.2 }),
  'IBM Plex Sans': f('sans-serif', { weight: 500, widthFactor: 0.54, tracking: -2 }, { weight: 400, tracking: -0.2 }),
  'IBM Plex Mono': f('monospace', { weight: 500, widthFactor: 0.6, tracking: -2 }, { weight: 400, tracking: 0 }, { mono: true }),
  'Instrument Serif': f('Georgia, serif', { weight: 400, widthFactor: 0.44, tracking: -1.4 }, null, { textFallback: 'Instrument Sans', serif: true }),
  'Instrument Sans': f('Arial, sans-serif', { weight: 600, widthFactor: 0.52, tracking: -1.5 }, { weight: 400, tracking: -0.2 }),
  'Plus Jakarta Sans': f('sans-serif', { weight: 700, widthFactor: 0.58, tracking: -2.6 }, { weight: 400, tracking: -0.3 }),
  Figtree: f('sans-serif', { weight: 700, widthFactor: 0.55, tracking: -2 }, { weight: 400, tracking: -0.2 }),
  Oswald: f('sans-serif', { weight: 600, widthFactor: 0.45, tracking: 0, case: 'upper' }, null, { textFallback: 'Inter', condensed: true }),
});
export const FREE_FONT_FAMILIES = Object.freeze(Object.keys(FONT_SPECS));

/** Especificação de fonte no formato das famílias (css, peso, largura, tracking, caixa). */
export function freeFontSpec(name, role = 'display') {
  const spec = FONT_SPECS[name] || FONT_SPECS[role === 'display' ? DEFAULT_DECK_DESIGN.fonts.display : DEFAULT_DECK_DESIGN.fonts.text];
  const metrics = (role === 'display' ? spec.display : spec.text) || spec.display;
  return { family: name, css: `"${name}", ${spec.generic}`, ...metrics };
}

const fold = value => String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
/** Primeira família de uma pilha CSS ('"Inter Tight", sans-serif' → 'Inter Tight'). */
const firstFamily = value => String(value || '').split(',')[0].replace(/["']/g, '').trim();

/** Fonte da biblioteca exatamente pedida (nome ou pilha CSS), sem adivinhar. */
export function libraryFontName(value) {
  const wanted = fold(firstFamily(value));
  if (!wanted) return null;
  return FREE_FONT_FAMILIES.find(name => fold(name) === wanted) || null;
}

/** Fonte da biblioteca mais próxima do pedido, adequada ao papel. */
export function nearestFreeFont(value, role = 'display') {
  const fallback = role === 'display' ? DEFAULT_DECK_DESIGN.fonts.display : DEFAULT_DECK_DESIGN.fonts.text;
  let name = libraryFontName(value);
  if (!name) {
    const raw = fold(value);
    if (!raw) return fallback;
    name = FREE_FONT_FAMILIES.find(item => raw.includes(fold(item)) || fold(item).includes(raw))
      || (/mono|code|courier/.test(raw) ? 'IBM Plex Mono'
        : /condensed|narrow|compressed|bebas|league/.test(raw) ? (role === 'display' ? 'Barlow Condensed' : 'Barlow')
          : /serif|garamond|playfair|didot|bodoni|georgia|times|baskerville|lora|merriweather/.test(raw) && !/sans/.test(raw)
            ? (role === 'display' ? 'Fraunces' : 'Source Serif 4')
            : fallback);
  }
  if (role === 'text' && !FONT_SPECS[name].text) return FONT_SPECS[name].textFallback;
  return name;
}

/* ------------------------------------------------------------------------ */
/* Cores                                                                    */
/* ------------------------------------------------------------------------ */

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;
/** '#abc' → '#AABBCC'; qualquer outra coisa → null. */
export function normalizeHex(value) {
  const m = HEX.exec(String(value ?? '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  return `#${h.toUpperCase()}`;
}
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
/** Mistura `a` sobre `b` (t = 1 é `a`). */
export function mixHex(a, b, t) {
  const A = rgb(normalizeHex(a)); const B = rgb(normalizeHex(b));
  return `#${A.map((c, i) => Math.round(c * t + B[i] * (1 - t)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
const isLight = hex => wcagContrast(hex, '#000000') >= wcagContrast(hex, '#FFFFFF');
/** Primeira cor que lê sobre o fundo (≥ 4,5); senão a mistura mínima rumo ao preto ou ao branco. */
function readable(bg, candidates) {
  for (const c of candidates) if (c && wcagContrast(c, bg) >= 4.5) return c;
  const base = candidates.find(Boolean) || '#000000';
  const pole = isLight(bg) ? '#000000' : '#FFFFFF';
  for (let t = 0.05; t <= 1; t = Math.round((t + 0.05) * 100) / 100) {
    const c = mixHex(pole, base, t);
    if (wcagContrast(c, bg) >= 4.5) return c;
  }
  return pole;
}

export const DEFAULT_DECK_DESIGN = Object.freeze({
  palette: Object.freeze({
    bg: '#F5F2EC', surface: '#EAE5DB', ink: '#15171C', muted: '#53575F',
    accent: '#C2410C', accent2: '#1E3A5F', inverse: '#15171C', inverseInk: '#F5F2EC',
  }),
  fonts: Object.freeze({ display: 'Fraunces', text: 'Inter' }),
  mood: 'Luz natural, tons quentes e neutros, enquadramento editorial com espaço para o texto.',
});

/** Completa a paleta a partir do que veio e garante leitura (≥ 4,5) em todos os fundos de texto. */
function completePalette(raw = {}) {
  const d = DEFAULT_DECK_DESIGN.palette;
  const given = Object.fromEntries(FREE_PALETTE_KEYS.map(key => [key, normalizeHex(raw?.[key])]));
  const bg = given.bg || d.bg;
  const light = isLight(bg);
  const ink = readable(bg, [given.ink, light ? d.ink : d.inverseInk]);
  const surface = given.surface && wcagContrast(ink, given.surface) >= 4.5 ? given.surface
    : readableSurface(bg, ink);
  const muted = readable(bg, [given.muted, mixHex(ink, bg, 0.72), ink]);
  const mutedOk = wcagContrast(muted, surface) >= 4.5 ? muted : readable(surface, [muted, ink]);
  const accent = given.accent || d.accent;
  const accent2 = given.accent2 || (given.accent ? mixHex(accent, ink, 0.55) : d.accent2);
  // Fundo invertido: o oposto do fundo, para a página escura (ou clara) existir.
  const inverseRaw = given.inverse && wcagContrast(given.inverse, bg) >= 3 ? given.inverse
    : light ? (isLight(ink) ? d.inverse : ink) : (isLight(ink) ? ink : d.bg);
  const inverseInk = readable(inverseRaw, [given.inverseInk, bg, light ? d.inverseInk : d.ink]);
  return { bg, surface, ink, muted: mutedOk, accent, accent2, inverse: inverseRaw, inverseInk };
}

/** Superfície próxima do fundo (um passo rumo à tinta) onde a tinta ainda lê. */
function readableSurface(bg, ink) {
  for (const t of [0.06, 0.04, 0.02, 0]) {
    const c = t ? mixHex(ink, bg, t) : bg;
    if (wcagContrast(ink, c) >= 4.5) return c;
  }
  return bg;
}

/** Corrige um deckDesign: hex inválido vira o padrão, fonte fora da biblioteca vira a mais próxima. */
export function normalizeDeckDesign(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_DECK_DESIGN;
  const fonts = raw.fonts && typeof raw.fonts === 'object' ? raw.fonts : {};
  const mood = typeof raw.mood === 'string' && raw.mood.trim() ? raw.mood.trim().slice(0, 240) : DEFAULT_DECK_DESIGN.mood;
  return {
    palette: completePalette(raw.palette),
    fonts: {
      display: nearestFreeFont(fonts.display, 'display'),
      text: nearestFreeFont(fonts.text, 'text'),
    },
    mood,
  };
}

/**
 * Deck a partir da marca efetiva (kit aplicado): as cores e fontes da marca
 * substituem as do padrão e o código completa o que faltar.
 */
export function deckDesignFromBrand(brand = {}, base = DEFAULT_DECK_DESIGN) {
  const b = brand && typeof brand === 'object' ? brand : {};
  const start = normalizeDeckDesign(base);
  const bg = normalizeHex(b.bg);
  const ink = normalizeHex(b.titleColor);
  const muted = normalizeHex(b.textColor) || normalizeHex(b.subtitleColor);
  const accent = normalizeHex(b.accent);
  // Fundo novo: superfície, invertido e tintas que faltarem são recalculados
  // para ele. Sem fundo novo, o resto da paleta de partida continua.
  const palette = bg && bg !== start.palette.bg
    ? { bg, ink, muted, accent: accent || start.palette.accent, accent2: accent ? null : start.palette.accent2 }
    : { ...start.palette, ...(ink ? { ink } : {}), ...(muted ? { muted } : {}), ...(accent ? { accent, accent2: null } : {}) };
  return normalizeDeckDesign({
    palette,
    fonts: {
      display: libraryFontName(b.titleFont) || start.fonts.display,
      text: libraryFontName(b.bodyFont) || start.fonts.text,
    },
    mood: start.mood,
  });
}

/** Paleta completa no formato das famílias (groundInks, chrome e blocos). */
export function freePaletteOverrides(deckDesign) {
  const p = normalizeDeckDesign(deckDesign).palette;
  return {
    bg: p.bg, surface: p.surface, ink: p.ink, muted: p.muted,
    accent: p.accent, accent2: p.accent2, accent3: mixHex(p.accent, p.bg, 0.22),
    rule: mixHex(p.ink, p.bg, 0.45),
    inverse: p.inverse, inverseInk: p.inverseInk, inverseMuted: readable(p.inverse, [mixHex(p.inverseInk, p.inverse, 0.72), p.inverseInk]),
  };
}

/** Campos de marca que o deck define (fundo, tintas, destaque e fontes). */
export function freeBrandPatch(deckDesign) {
  const d = normalizeDeckDesign(deckDesign);
  const display = freeFontSpec(d.fonts.display, 'display');
  const text = freeFontSpec(d.fonts.text, 'text');
  return {
    bg: d.palette.bg, titleColor: d.palette.ink, subtitleColor: d.palette.muted, textColor: d.palette.muted,
    accent: d.palette.accent, titleFont: display.css, subtitleFont: text.css, bodyFont: text.css,
    textTitleWeight: display.weight, textTitleCase: display.case === 'upper' ? 'upper' : 'normal',
  };
}

/* ------------------------------------------------------------------------ */
/* Design por slide                                                         */
/* ------------------------------------------------------------------------ */

const GROUND_ALIASES = {
  light: 'bg', claro: 'bg', background: 'bg', paper: 'bg', papel: 'bg', fundo: 'bg',
  card: 'surface', superficie: 'surface', panel: 'surface', painel: 'surface',
  dark: 'inverse', escuro: 'inverse', invertido: 'inverse', inverted: 'inverse', black: 'inverse', preto: 'inverse',
  color: 'accent', cor: 'accent', destaque: 'accent', brand: 'accent',
  image: 'photo', foto: 'photo', fullbleed: 'photo', imagem: 'photo',
};
const PHOTO_ALIASES = {
  sem: 'none', semfoto: 'none', no: 'none', off: 'none', nenhuma: 'none', false: 'none',
  pequena: 'small', thumb: 'small', detalhe: 'small', detail: 'small',
  metade: 'half', large: 'half', grande: 'half', medium: 'half', media: 'half', side: 'half', lateral: 'half',
  cheia: 'full', telacheia: 'full', fullbleed: 'full', bleed: 'full', inteira: 'full', true: 'full',
};
const BLOCK_ALIASES = {
  table: 'comparison', tabela: 'comparison', comparacao: 'comparison', compare: 'comparison',
  metric: 'metrics', metricas: 'metrics', kpi: 'metrics', numbers: 'metrics', numeros: 'metrics',
  step: 'steps', etapas: 'steps', passos: 'steps', process: 'steps', processo: 'steps', timeline: 'steps',
  citacao: 'quote', depoimento: 'quote', testimonial: 'quote',
  number: 'bignumber', numero: 'bignumber', numerogrande: 'bignumber', stat: 'bignumber',
  icone: 'icons', icon: 'icons', icones: 'icons',
};
const FAMILY_ALIASES = {
  editorialcontemporaneo: 'editorial', revista: 'editorial', magazine: 'editorial',
  executivo: 'executive', minimal: 'executive', suico: 'swiss', grid: 'swiss',
  cinema: 'cinematic', cinematico: 'cinematic', filme: 'cinematic', keynote: 'cinematic',
  premium: 'luxury', luxo: 'luxury', tipografico: 'typographic', manifesto: 'typographic',
  data: 'cultural', artistico: 'cultural', colagem: 'cultural', tecnico: 'technical', blueprint: 'technical',
  fotografico: 'photo', ensaio: 'photo', humano: 'photo', cards: 'modular', cartoes: 'modular',
};

function enumValue(value, allowed, aliases, fallback) {
  const raw = String(value ?? '').trim();
  if (allowed.includes(raw)) return raw;
  const key = fold(raw);
  const exact = allowed.find(item => fold(item) === key);
  return exact || aliases[key] || fallback;
}

export function normalizeFreeFamily(value, fallback = 'executive') {
  const raw = String(value ?? '').trim();
  if (FAMILY_KEYS.includes(raw)) return raw;
  const key = fold(raw);
  return FAMILY_KEYS.find(item => fold(item) === key) || FAMILY_ALIASES[key]
    || (['premium', 'data'].includes(raw) ? normalizeFamilyKey(raw) : fallback);
}

const slideText = slide => [slide?.title, slide?.subtitle, slide?.bodyAfterImage].filter(Boolean).join('\n');
const slideBlockTypes = slide => (Array.isArray(slide?.presentationBlocks) ? slide.presentationBlocks : []).map(b => b?.type);

/** O roteiro sustenta o bloco? Sem dado, o bloco cai para `none` (spec, regra 4). */
function blockSupported(block, slide, icons) {
  if (['comparison', 'metrics', 'steps'].includes(block)) return slideBlockTypes(slide).includes(block);
  if (block === 'bignumber') return /\d/.test(slideText(slide));
  if (block === 'quote') return /["“”«»]|^\s*[—–-]\s/m.test(slideText(slide)) || slideBlockTypes(slide).includes('quote');
  if (block === 'icons') return icons.length > 0;
  return true;
}

/** Corrige o design de um slide para os enums fechados da spec. */
export function normalizeSlideDesign(raw, slide = {}) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const iconsIn = Array.isArray(d.icons) ? d.icons : [];
  const icons = [...new Set(iconsIn.map(i => String(i || '').trim().toLowerCase()).filter(i => FREE_ICONS.includes(i)))].slice(0, 4);
  let block = enumValue(d.block, FREE_BLOCKS, BLOCK_ALIASES, 'none');
  if (!blockSupported(block, slide, icons)) block = 'none';
  const text = slideText(slide);
  const emphasis = (Array.isArray(d.emphasis) ? d.emphasis : [])
    .map(item => String(item || '').replace(/\*\*/g, '').trim())
    .filter(item => item && text.includes(item))
    .slice(0, 3);
  return {
    family: normalizeFreeFamily(d.family),
    ground: enumValue(d.ground, FREE_GROUNDS, GROUND_ALIASES, 'bg'),
    photo: enumValue(d.photo, FREE_PHOTO_SIZES, PHOTO_ALIASES, 'none'),
    block,
    emphasis,
    icons: block === 'icons' ? icons : [],
  };
}

/* ------------------------------------------------------------------------ */
/* Geometria e foto                                                         */
/* ------------------------------------------------------------------------ */

const PHOTO_RANK = { none: 0, small: 1, half: 2, full: 3 };
export { photoSizeOfLayout };
const textOnPhoto = layout => !!(layout?.photo && (layout.scrim || layout.inkOnPhoto));
const withoutVisual = slide => ({ ...slide, bgImage: '', bgImageId: null, bgImageAssetId: null, imageQuery: '' });
const r = value => Math.round(Number(value) || 0);
const geometryOf = ({ ground, photo, scrim, title, subtitle }) => [
  ground || 'bg', photo ? `${r(photo.x)}:${r(photo.w)}` : 'sem-foto', photo && scrim ? 'scrim' : '', r(title?.x), r(subtitle?.x),
].join('|');

/** Geometria de uma página composta no modo livre (fundo, foto, texto sobre foto, colunas). */
export function freeSlideGeometry(slide = {}) {
  const zones = slide.canvas?.zones || {};
  return geometryOf({
    ground: slide.presentationFreeDesign?.ground || slide.presentationGround,
    photo: slide.presentationSuppressPhoto ? null : zones.photo,
    scrim: Number(slide.overlay) > 0,
    title: zones.title,
    subtitle: zones.subtitle,
  });
}

const ALTERNATIVE_KINDS = ['content', 'demo', 'divider'];
/** Função de página fixa (capa, fecho, bloco nativo) ou null quando o diretor pode alternar. */
function fixedKind(slide, index, count) {
  if (hasBlocks(slide)) return 'data';
  if (index === 0) return 'cover';
  if (index >= count - 1) return 'closing';
  return null;
}

/**
 * Função de página que desenha a foto pedida na família. Se a família não tem
 * a geometria pedida, fica a mais próxima que ela tem: nunca um layout novo.
 */
export function resolveFreeKind({ family, photo, slide = {}, stage = {}, index = 0, count = 1 }) {
  const role = resolvePresentationCompositionKind({ slide, stage, index, count });
  const fixed = fixedKind(slide, index, count);
  if (fixed) return fixed;
  if (photo === 'none' || !hasVisual(slide)) return role;
  const kinds = [role, ...ALTERNATIVE_KINDS.filter(k => k !== role)];
  const want = PHOTO_RANK[photo] ?? 0;
  let best = kinds[0];
  let bestDistance = Infinity;
  for (const kind of kinds) {
    const size = photoSizeOfLayout(contentAwarePresentationLayout(kind, slide, family));
    const distance = Math.abs((PHOTO_RANK[size] ?? 0) - want);
    if (distance < bestDistance) { best = kind; bestDistance = distance; }
    if (!distance) break;
  }
  return best;
}

/* ------------------------------------------------------------------------ */
/* Diretor de arte determinístico                                           */
/* ------------------------------------------------------------------------ */

const MAX_FAMILIES = 4;
const ACCENT_KINDS = new Set(['cover', 'divider', 'closing']);

function previousDesigns(previous = []) {
  return (Array.isArray(previous) ? previous : []).map(item => ({
    family: item?.presentationFreeDesign?.family || item?.presentationDesignFamily || null,
    kind: item?.presentationComposition || null,
    ground: item?.presentationFreeDesign?.ground || item?.presentationGround || 'bg',
    photo: item?.presentationFreeDesign?.photo || (item?.presentationSuppressPhoto ? 'none' : 'half'),
    geometry: freeSlideGeometry(item || {}),
  }));
}

/** Ordem de famílias do deck: estável para a mesma paleta e o mesmo clima. */
function familyOrder(deckDesign) {
  const d = normalizeDeckDesign(deckDesign);
  const seed = [...`${d.mood}${Object.values(d.palette).join('')}${d.fonts.display}`].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 9973, 7);
  const offset = seed % FAMILY_KEYS.length;
  return FAMILY_KEYS.map((_, i) => FAMILY_KEYS[(i + offset) % FAMILY_KEYS.length]);
}

/** Candidatos (família × foto × fundo) que as famílias já sabem desenhar para esta página. */
function candidatesFor({ slide, stage, index, count }) {
  const visual = hasVisual(slide);
  const out = [];
  for (const family of FAMILY_KEYS) {
    const seen = new Set();
    for (const photo of visual ? ['full', 'half', 'small', 'none'] : ['none']) {
      const layoutSlide = photo === 'none' ? withoutVisual(slide) : slide;
      const kind = resolveFreeKind({ family, photo, slide: layoutSlide, stage, index, count });
      const layout = contentAwarePresentationLayout(kind, layoutSlide, family);
      const size = photoSizeOfLayout(layout);
      if (seen.has(`${kind}|${size}`)) continue;
      seen.add(`${kind}|${size}`);
      const onPhoto = textOnPhoto(layout);
      // Bloco nativo (tabela, métricas, etapas) só em fundo claro ou de
      // superfície: o tratamento de evidência das famílias usa a tinta da
      // paleta, desenhada para esses fundos.
      const grounds = onPhoto ? ['photo']
        : hasBlocks(slide) ? ['bg', 'surface']
          : ['bg', 'surface', 'inverse', ...(ACCENT_KINDS.has(kind) ? ['accent'] : [])];
      for (const ground of grounds) {
        out.push({
          family, kind, photo: size, ground, native: onPhoto || ground === layout.ground,
          geometry: geometryOf({ ground, photo: layout.photo, scrim: !!layout.scrim, title: layout.title, subtitle: layout.subtitle }),
        });
      }
    }
  }
  return out;
}

function scoreCandidate(c, { prev, role, visual, order, enough }) {
  const last = prev.at(-1);
  const count = (key, value) => prev.filter(p => p[key] === value).length;
  const families = new Set(prev.map(p => p.family).filter(Boolean));
  const grounds = new Set(prev.map(p => p.ground));
  const photos = new Set(prev.map(p => p.photo));
  let s = 0;
  if (c.kind !== role && !['cover', 'closing', 'data'].includes(c.kind)) s += 3;
  if (visual && c.photo === 'none') s += 6;
  s += count('photo', c.photo) * 1.5;
  if (enough && photos.size < 3 && !photos.has(c.photo)) s -= 4;
  if (!c.native) s += 1.5;
  s += count('ground', c.ground);
  if (enough && grounds.size < 3 && !grounds.has(c.ground)) s -= 3;
  if (last && last.ground === c.ground) s += 2;
  if (!families.has(c.family) && families.size >= MAX_FAMILIES) s += 20;
  if (last && last.family === c.family) s += 4;
  if (prev.slice(-3).some(p => p.family === c.family)) s += 2;
  s += count('family', c.family) * 0.5;
  if (last && last.geometry === c.geometry) s += 2;
  return s + order.indexOf(c.family) * 0.01;
}

/**
 * Design de uma página, conhecendo as anteriores. Rodado slide a slide dá o
 * mesmo resultado que o deck inteiro (geração e "aplicar estilo" concordam).
 * Regras duras: nunca 3 geometrias iguais seguidas; nunca 2 seguidas com a
 * mesma família e a mesma função de página.
 */
export function directFreeSlideDesign({ slide = {}, stage = {}, index = 0, count = 1, previous = [], deckDesign } = {}) {
  const prev = previousDesigns(previous);
  const [before, last] = prev.slice(-2);
  const role = resolvePresentationCompositionKind({ slide, stage, index, count });
  const allowed = candidatesFor({ slide, stage, index, count }).filter(c => !(
    (last && before && last.geometry === c.geometry && before.geometry === c.geometry)
    || (last && last.family === c.family && last.kind === c.kind)));
  const context = { prev, role, visual: hasVisual(slide), order: familyOrder(deckDesign), enough: count >= 6 };
  let best = null;
  let bestScore = Infinity;
  for (const c of allowed) {
    const score = scoreCandidate(c, context);
    if (score < bestScore) { best = c; bestScore = score; }
  }
  const chosen = best || { family: 'executive', ground: 'bg', photo: hasVisual(slide) ? 'half' : 'none' };
  const block = slideBlockTypes(slide).find(type => ['comparison', 'metrics', 'steps'].includes(type)) || 'none';
  return normalizeSlideDesign({ family: chosen.family, ground: chosen.ground, photo: chosen.photo, block }, slide);
}

/* ------------------------------------------------------------------------ */
/* Composição da página                                                     */
/* ------------------------------------------------------------------------ */

/** Deck em vigor: o pedido, o gravado no slide ou nas páginas anteriores, ou o padrão. */
export function resolveDeckDesign(deckDesign, slide = {}, previous = []) {
  const source = deckDesign || slide?.presentationDeckDesign
    || (Array.isArray(previous) ? [...previous].reverse().find(item => item?.presentationDeckDesign)?.presentationDeckDesign : null);
  return normalizeDeckDesign(source);
}

const tracking = (display) => Math.round(((display.tracking || 0) - titleTrackingBase(display.css)) * 100) / 100;

/**
 * Compõe a página no modo livre: geometria da família escolhida, fundo e
 * tinta pela paleta do deck, fontes do deck e foto no tamanho decidido.
 */
export function freePresentationCompositionOverrides(base, {
  slide = {}, stage = {}, index = 0, count = 1, previous = [], deckDesign = null,
} = {}) {
  const deck = resolveDeckDesign(deckDesign, slide, previous);
  const directed = directFreeSlideDesign({ slide, stage, index, count, previous, deckDesign: deck });
  const visual = hasVisual(slide);
  const layoutSlide = directed.photo === 'none' || !visual ? withoutVisual(slide) : slide;
  const family = directed.family;
  const kind = resolveFreeKind({ family, photo: directed.photo, slide: layoutSlide, stage, index, count });
  const layout = contentAwarePresentationLayout(kind, layoutSlide, family);
  const photo = visual ? photoSizeOfLayout(layout) : 'none';
  const onPhoto = photo !== 'none' && textOnPhoto(layout);
  const ground = onPhoto ? 'photo' : (directed.ground === 'photo' ? layout.ground : directed.ground);
  const design = { ...directed, photo, ground };
  const freeBase = { ...base, presentationFreeDesign: design };
  const composed = stage?.contentMode === 'pitch'
    ? pitchCompositionOverrides(freeBase, layoutSlide, kind)
    : contentAwarePresentationOverrides(freeBase, layoutSlide, kind, { deliveryMode: stage?.deliveryMode });

  const palette = freePaletteOverrides(deck);
  const chromeGround = onPhoto ? layout.ground : ground;
  const inks = onPhoto
    ? { bg: palette.inverse, ink: readable('#111111', [palette.inverseInk, palette.bg, '#FFFFFF']), muted: readable('#111111', [palette.inverseMuted, palette.inverseInk, '#F5F5F7']) }
    : groundInks(family, ground, palette);
  const display = freeFontSpec(deck.fonts.display, 'display');
  const text = freeFontSpec(deck.fonts.text, 'text');
  const fam = familySpec(family).fonts.display;
  // A família calibrou o corpo do título para a própria fonte; uma fonte do
  // deck mais larga começa proporcionalmente menor e passa pelo mesmo ajuste.
  const scale = Math.min(1, (fam.widthFactor || 0.55) / (display.widthFactor || 0.55));
  const zones = composed.canvas?.zones || {};
  const titleSize = scale < 1 && zones.title
    ? fittedTitleSize(Math.round(composed.titleSize * scale), slide.title, zones.title, display.css)
    : composed.titleSize;
  const typographyAll = composed.presentationTypographyByComposition || {};
  const typo = typographyAll[kind] || {};
  return {
    ...composed,
    presentationPresetId: FREE_PRESENTATION_PRESET_ID,
    presentationPatternId: FREE_PRESENTATION_PRESET_ID,
    presentationFreeDesign: design,
    presentationDeckDesign: deck,
    presentationPaletteOverrides: palette,
    presentationGround: chromeGround,
    presentationChrome: {
      ...composed.presentationChrome,
      ground: chromeGround,
      fonts: { display, text },
    },
    presentationNumericTypography: { fontFamily: display.css, weight: display.weight },
    customBg: inks.bg,
    titleColor: inks.ink,
    subtitleColor: inks.ink,
    textColor: inks.muted,
    titleSize,
    titleWeight: display.weight,
    titleCase: display.case === 'upper' ? 'upper' : 'normal',
    subTracking: 1 + (text.tracking || 0),
    presentationTypographyByComposition: {
      ...typographyAll,
      [kind]: {
        ...typo,
        title: {
          ...typo.title, fontFamily: display.css, weight: display.weight, tracking: tracking(display),
          case: display.case === 'upper' ? 'upper' : 'normal', italic: false, sizePercent: titleSize,
        },
        subtitle: { ...typo.subtitle, fontFamily: text.css, weight: Math.max(400, text.weight || 400), tracking: 1 + (text.tracking || 0) },
      },
    },
  };
}

/** Campos que só existem no modo livre; saem quando o deck volta a um preset comum. */
export const FREE_SLIDE_FIELDS = Object.freeze([
  'presentationFreeDesign', 'presentationDeckDesign', 'presentationPaletteOverrides',
  'presentationNumericTypography', 'customBg', 'titleColor', 'subtitleColor', 'textColor',
  'titleWeight', 'titleCase',
]);

/** Slide composto no modo livre volta ao estado neutro antes de outro preset. */
export function stripFreeSlideFields(slide) {
  if (!slide?.presentationFreeDesign) return slide;
  const out = { ...slide };
  for (const key of FREE_SLIDE_FIELDS) delete out[key];
  return out;
}

export function isFreePresentationPreset(value) {
  if (value && typeof value === 'object') return value.isFree === true || value.id === FREE_PRESENTATION_PRESET_ID;
  return value === FREE_PRESENTATION_PRESET_ID;
}

/** Página do modo livre sem foto: não gera imagem (spec: `photo: none`). */
export function slideSkipsImageGeneration(slide) {
  return !!slide?.presentationFreeDesign && slide.presentationFreeDesign.photo === 'none';
}

/* ------------------------------------------------------------------------ */
/* Validador                                                                */
/* ------------------------------------------------------------------------ */

/** Regras da spec verificadas num deck composto. Lista vazia = deck válido. */
export function freeDeckViolations(slides = []) {
  const list = Array.isArray(slides) ? slides : [];
  const out = [];
  const geo = list.map(freeSlideGeometry);
  list.forEach((s, i) => {
    const d = s.presentationFreeDesign;
    if (!d) { out.push({ code: 'free_design_missing', slideIndex: i }); return; }
    if (i >= 2 && geo[i] === geo[i - 1] && geo[i] === geo[i - 2]) out.push({ code: 'free_rhythm_geometry', slideIndex: i });
    const a = list[i - 1];
    if (a?.presentationFreeDesign && a.presentationFreeDesign.family === d.family && a.presentationComposition === s.presentationComposition) {
      out.push({ code: 'free_rhythm_family_kind', slideIndex: i });
    }
    const surface = d.ground === 'photo' ? '#111111' : s.customBg;
    for (const key of ['titleColor', 'subtitleColor', 'textColor']) {
      if (!s[key] || !surface || wcagContrast(s[key], surface) < 4.5) out.push({ code: 'free_contrast', slideIndex: i, field: key });
    }
  });
  const withDesign = list.filter(s => s.presentationFreeDesign);
  if (withDesign.length >= 6) {
    if (new Set(withDesign.map(s => s.presentationFreeDesign.ground)).size < 3) out.push({ code: 'free_grounds_variety', slideIndex: null });
    const visualPages = withDesign.filter(s => hasVisual(s)).length;
    if (visualPages >= 3 && new Set(withDesign.map(s => s.presentationFreeDesign.photo)).size < 3) out.push({ code: 'free_photo_variety', slideIndex: null });
  }
  return out;
}

export const FREE_FAMILY_LABELS = Object.freeze(Object.fromEntries(FAMILY_KEYS.map(key => [key, PRESENTATION_FAMILIES[key].label])));
