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
import { rendererSubtitleSizePercent, rendererTitleSizePercent } from './presentation-families.js';
import { pitchCompositionOverrides } from './pitch-content.js';
import { resolveChromeColor } from './presentation-chrome.js';
import { titleTrackingBase } from './title-tracking.js';
import { wcagContrast } from './wcag.js';
import { markdownBoldAccentIntervalsUtf16 } from './text-spans.js';
import { PRESENTATION_ICON_NAMES } from './presentation-icons.js';
import { FREE_FONT_ADVANCES, FREE_FONT_CHARSET } from './free-font-metrics.js';
import { inkOver, mirrorChrome, mirrorTextZones, sideScrim, textOverPhoto } from './image-composition.js';
import { reservedAreaColour, resolveSlideVisualDirection } from './visual-direction.js';
import { nearestPaletteHex } from './reference-palette.js';

export { FREE_PRESENTATION_PRESET_ID };

export const FREE_GROUNDS = Object.freeze(['bg', 'surface', 'inverse', 'accent', 'photo', 'art']);
/**
 * Direção de arte, parte 4 (docs/product/direcao-de-arte-imagens.md): arte de
 * fundo reaproveitada. Uma imagem abstrata da identidade por deck, com o
 * grafismo a partir de ~78% da largura e o resto liso na cor base; até 3
 * páginas sem foto a usam como fundo, com o texto até 72% da largura.
 */
export const FREE_ART_MAX_SLIDES = 3;
export const FREE_ART_TEXT_MAX = 72;
export const FREE_ART_GRAPHIC_FROM = 78;
export const FREE_PHOTO_SIZES = Object.freeze(['none', 'small', 'half', 'full']);
export const FREE_BLOCKS = Object.freeze(['none', 'comparison', 'metrics', 'steps', 'quote', 'bignumber', 'icons']);
/** Lista fechada de ícones lucide (nomes kebab-case) para o bloco de ícones. */
export const FREE_ICONS = PRESENTATION_ICON_NAMES;
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
    bg: '#F5F2EC', surface: '#E4DCCB', ink: '#15171C', muted: '#53575F',
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
  const surface = given.surface && distinctSurface(given.surface, bg, ink) ? given.surface
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

/**
 * Diferença mínima entre o fundo e a superfície (razão de luminância). Na
 * conferência da fase 1, #F5F2EC e #EAE5DB (≈1,1) não se distinguiam na tela
 * e a regra de "3 fundos" contava duas páginas iguais como fundos diferentes.
 */
export const FREE_SURFACE_MIN_CONTRAST = 1.18;
const distinctSurface = (c, bg, ink) => wcagContrast(c, bg) >= FREE_SURFACE_MIN_CONTRAST && wcagContrast(ink, c) >= 4.5;

/** Superfície um passo rumo à tinta (ou ao polo oposto), distinta do fundo e onde a tinta ainda lê. */
function readableSurface(bg, ink) {
  const pole = isLight(bg) ? '#000000' : '#FFFFFF';
  for (const toward of [ink, pole === '#000000' ? '#FFFFFF' : '#000000', pole]) {
    for (let t = 0.04; t <= 0.4; t = Math.round((t + 0.02) * 100) / 100) {
      const c = mixHex(toward, bg, t);
      if (distinctSurface(c, bg, ink)) return c;
    }
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

/**
 * Teste 6, item 1: com a paleta extraída da referência, as cores do deck
 * (fundo, superfície, destaque e destaque 2) vêm da lista; o hex fora dela
 * vira o mais próximo. O destaque evita a cor do fundo (e lê sobre ele, 3:1,
 * quando a lista permite). A tinta da página invertida (inverseInk) vem da
 * lista quando ainda lê 4,5:1. As outras tintas de leitura (ink, muted e
 * inverse) continuam neutras e recalculadas pelo contraste. Sem lista: igual.
 */
export const FREE_REFERENCE_SNAP_KEYS = Object.freeze(['bg', 'surface', 'accent', 'accent2']);
export function snapDeckDesignToPalette(deckDesign, allowed = []) {
  const pool = [...new Set((Array.isArray(allowed) ? allowed : []).map(c => normalizeHex(c?.hex || c)).filter(Boolean))];
  if (!deckDesign || typeof deckDesign !== 'object' || !pool.length) return deckDesign;
  const raw = deckDesign.palette && typeof deckDesign.palette === 'object' ? deckDesign.palette : {};
  const palette = { ...raw };
  const nearest = (hex, candidates) => (normalizeHex(hex) ? nearestPaletteHex(normalizeHex(hex), candidates.length ? candidates : pool) : null);
  palette.bg = nearest(raw.bg, pool) || raw.bg;
  const notBg = pool.filter(c => c !== palette.bg);
  palette.surface = nearest(raw.surface, pool) || raw.surface;
  const readableOnBg = notBg.filter(c => !palette.bg || wcagContrast(c, palette.bg) >= 3);
  palette.accent = nearest(raw.accent, readableOnBg.length ? readableOnBg : notBg) || raw.accent;
  const rest = notBg.filter(c => c !== palette.accent);
  palette.accent2 = nearest(raw.accent2, rest.length ? rest : notBg) || raw.accent2;
  // Tinta da página invertida: a cor da lista mais próxima, se ainda lê (4,5:1).
  const inverse = normalizeHex(raw.inverse);
  const inverseInk = inverse && normalizeHex(raw.inverseInk) ? nearest(raw.inverseInk, pool.filter(c => wcagContrast(c, inverse) >= 4.5)) : null;
  if (inverseInk && wcagContrast(inverseInk, inverse) >= 4.5) palette.inverseInk = inverseInk;
  return { ...deckDesign, palette };
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
  arte: 'art', artwork: 'art', identidade: 'art', identity: 'art', abstract: 'art', abstrato: 'art', grafismo: 'art',
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
function blockSupported(block, slide) {
  // Fase 3: o bloco é desenhado a partir de presentationBlocks. Proposta sem o
  // bloco escrito (ou que a guarda de fatos derrubou) não desenha nada: none.
  return block === 'none' || slideBlockTypes(slide).includes(block);
}
/** Ícones do bloco escrito (fase 3) ou, sem ele, os propostos. */
const writtenIcons = slide => (Array.isArray(slide?.presentationBlocks) ? slide.presentationBlocks : [])
  .find(b => b?.type === 'icons' && Array.isArray(b.items))?.items.map(item => item?.icon) || [];

/**
 * Uma linha por família para o diretor de arte da IA (roteiro v3): o que a
 * página parece e onde a foto costuma ficar. Vem das geometrias que as
 * famílias desenham hoje (presentation-art-direction.js).
 */
export const FREE_FAMILY_GUIDE = Object.freeze({
  editorial: 'revista contemporânea: título serifado grande, fios finos, foto em coluna à direita ou à esquerda na demonstração.',
  executive: 'sóbrio e arejado: muito espaço em branco, foto em painel à direita, divisor escuro com foto estreita à esquerda.',
  swiss: 'grade suíça: módulos rígidos e alinhamento à esquerda, foto em módulo à direita ou à esquerda na demonstração, divisor em cor de destaque.',
  cinematic: 'cinema: foto em tela cheia com título sobre véu escuro na capa e na demonstração, faixa de foto larga no conteúdo.',
  luxury: 'luxo discreto: margens largas, foto estreita e alta, divisor escuro, poucas palavras por página.',
  typographic: 'tipográfico expressivo: título enorme ocupa a página, foto pequena como pontuação, divisor e fecho sem foto.',
  cultural: 'cultural e artístico: colagem com recortes e cor sobreposta, foto em coluna à direita ou à esquerda.',
  technical: 'técnico: grade de blueprint, rótulos em mono, foto à direita, à esquerda na demonstração ou pequena no divisor.',
  photo: 'fotográfico e humano: foto inteira na capa, foto grande ao lado do texto e meia página no fecho.',
  modular: 'modular: texto em cartões arredondados ao lado de um cartão de foto, divisor escuro com foto pequena.',
});

/** Fontes de título que não servem para texto corrido (o `text` do deck). */
export const FREE_DISPLAY_ONLY_FONTS = Object.freeze(FREE_FONT_FAMILIES.filter(name => !FONT_SPECS[name].text));

const clipPhrase = value => String(value ?? '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().slice(0, 60).trim();

/**
 * Design proposto pela IA no roteiro v3, só com os enums corrigidos. Ainda
 * não há texto escrito: se o bloco tem dado e se os trechos de negrito estão
 * no texto é conferido na composição (normalizeSlideDesign com o slide).
 * Sem objeto, null: o diretor determinístico decide a página.
 */
export function normalizeProposedDesign(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const block = enumValue(raw.block, FREE_BLOCKS, BLOCK_ALIASES, 'none');
  const icons = [...new Set((Array.isArray(raw.icons) ? raw.icons : []).map(i => String(i || '').trim().toLowerCase()).filter(i => FREE_ICONS.includes(i)))].slice(0, 4);
  return {
    family: normalizeFreeFamily(raw.family),
    ground: enumValue(raw.ground, FREE_GROUNDS, GROUND_ALIASES, 'bg'),
    photo: enumValue(raw.photo, FREE_PHOTO_SIZES, PHOTO_ALIASES, 'none'),
    block,
    emphasis: [...new Set((Array.isArray(raw.emphasis) ? raw.emphasis : []).map(clipPhrase).filter(Boolean))].slice(0, 3),
    icons: block === 'icons' ? icons : [],
  };
}

/** Corrige o design de um slide para os enums fechados da spec. */
export function normalizeSlideDesign(raw, slide = {}) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const written = writtenIcons(slide);
  const iconsIn = written.length ? written : Array.isArray(d.icons) ? d.icons : [];
  const icons = [...new Set(iconsIn.map(i => String(i || '').trim().toLowerCase()).filter(i => FREE_ICONS.includes(i)))].slice(0, 4);
  let block = enumValue(d.block, FREE_BLOCKS, BLOCK_ALIASES, 'none');
  if (!blockSupported(block, slide)) block = 'none';
  const text = slideText(slide);
  // Trecho que está no texto, sem diferença de caixa; guarda a grafia do texto.
  const lower = text.toLowerCase();
  const emphasis = [...new Set((Array.isArray(d.emphasis) ? d.emphasis : [])
    .map(item => String(item || '').replace(/\*\*/g, '').trim())
    .map((item) => { const at = item ? lower.indexOf(item.toLowerCase()) : -1; return at >= 0 ? text.slice(at, at + item.length) : ''; })
    .filter(Boolean))]
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

/**
 * Cartão da família atrás de uma zona de texto (ex.: cartões do Modular): o
 * bloco de chrome que cobre a maior parte da zona. O texto lê contra ele, não
 * contra o fundo da página.
 */
function textPanel(layout, zone) {
  if (!zone) return null;
  const area = zone.w * zone.h;
  const covering = (layout.chrome || []).filter((d) => {
    if (d.t !== 'block' || !(d.w > 0) || !(d.h > 0)) return false;
    const w = Math.min(d.x + d.w, zone.x + zone.w) - Math.max(d.x, zone.x);
    const h = Math.min(d.y + d.h, zone.y + zone.h) - Math.max(d.y, zone.y);
    return w > 0 && h > 0 && w * h >= area * 0.6;
  });
  return covering.at(-1) || null;
}
const hasTextPanel = layout => !!(textPanel(layout, layout.title) || textPanel(layout, layout.subtitle));

/** Tratamento único das fotos no modo livre: nada de preto e branco de uma família só. */
export const FREE_PHOTO_TREATMENT = 'saturate(0.94) contrast(1.03)';

const ALTERNATIVE_KINDS = ['content', 'demo', 'divider'];
const DIVIDER_COPY_MAX = 180;
const shortCopy = slide => `${slide?.subtitle || ''}${slide?.bodyAfterImage || ''}`.replace(/\*\*/g, '').trim().length <= DIVIDER_COPY_MAX;
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
const MAX_PROPOSED_FAMILIES = 6;
const ACCENT_KINDS = new Set(['cover', 'divider', 'closing']);

function previousDesigns(previous = []) {
  return (Array.isArray(previous) ? previous : []).map(item => ({
    family: item?.presentationFreeDesign?.family || item?.presentationDesignFamily || null,
    kind: item?.presentationComposition || null,
    ground: item?.presentationFreeDesign?.ground || item?.presentationGround || 'bg',
    photo: item?.presentationFreeDesign?.photo || (item?.presentationSuppressPhoto ? 'none' : 'half'),
    geometry: freeSlideGeometry(item || {}),
    shape: freeSlideGeometry({ ...(item || {}), presentationFreeDesign: { ground: '' }, presentationGround: '' }),
    side: item?.presentationSuppressPhoto ? null : photoSide(item?.canvas?.zones?.photo, item?.presentationFreeDesign?.photo),
  }));
}

/** Lado da foto lateral (pequena ou metade); foto cheia ou sem foto não tem lado. */
function photoSide(zone, size) {
  if (!zone || !(zone.w > 0) || !['small', 'half'].includes(size)) return null;
  return zone.x + zone.w / 2 < 50 ? 'left' : 'right';
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
    // Cada geometria que a família desenha para esta página: a função pedida
    // pelo tamanho da foto e, fora de capa, fecho e bloco nativo, as outras
    // funções intercambiáveis (conteúdo, demonstração e divisor), que trazem a
    // foto do outro lado. Sem elas o diretor só via a foto à direita.
    const role = resolvePresentationCompositionKind({ slide, stage, index, count });
    const tries = [];
    for (const photo of visual ? ['full', 'half', 'small', 'none'] : ['none']) {
      const layoutSlide = photo === 'none' ? withoutVisual(slide) : slide;
      tries.push([resolveFreeKind({ family, photo, slide: layoutSlide, stage, index, count }), layoutSlide]);
    }
    if (visual && !fixedKind(slide, index, count)) {
      // Divisor tem caixa de apoio curta: só para página de texto curto.
      for (const kind of [role, ...ALTERNATIVE_KINDS]) if (kind !== 'divider' || shortCopy(slide)) tries.push([kind, slide]);
    } else if (!visual && !fixedKind(slide, index, count) && shortCopy(slide) && ACCENT_TEXT_PURPOSES.has(slidePurpose(slide))) {
      // Direção de arte, parte 5: página de frase, síntese ou comportamento
      // sem foto pode virar texto em cor cheia com título grande (divisor).
      tries.push(['divider', slide]);
    }
    for (const [kind, layoutSlide] of tries) {
      const layout = contentAwarePresentationLayout(kind, layoutSlide, family);
      const size = photoSizeOfLayout(layout);
      if (seen.has(`${kind}|${size}`)) continue;
      seen.add(`${kind}|${size}`);
      const onPhoto = textOnPhoto(layout);
      // Bloco nativo (tabela, métricas, etapas) só em fundo claro ou de
      // superfície: o tratamento de evidência das famílias usa a tinta da
      // paleta, desenhada para esses fundos.
      // Cartão atrás do texto: o fundo da página fica o da família, senão o
      // cartão (cor de superfície) pode cair sobre um fundo do mesmo tom da tinta.
      // Arte de fundo (parte 4): só página sem foto e sem cartão atrás do texto.
      // Com bloco, só a comparação (a personalidade em duas colunas); os outros
      // blocos ficam no fundo claro ou de superfície, como antes.
      // A tabela precisa de 50% da largura: com bloco, a arte fica para a
      // página só com título e tabela (a tabela ocupa a coluna do apoio).
      const art = size === 'none' && !onPhoto && !hasTextPanel(layout)
        && slideBlockTypes(slide).every(type => type === 'comparison')
        && (!hasBlocks(slide) || !supportCopy(slide)) ? ['art'] : [];
      const grounds = onPhoto ? ['photo']
        : hasTextPanel(layout) ? [layout.ground]
        : hasBlocks(slide) ? ['bg', 'surface', ...art]
          : ['bg', 'surface', 'inverse', ...(ACCENT_KINDS.has(kind) ? ['accent'] : []), ...art];
      for (const ground of grounds) {
        out.push({
          family, kind, photo: size, ground, native: onPhoto || ground === layout.ground, side: photoSide(layout.photo, size),
          artBlock: ground === 'art' && slideBlockTypes(slide).includes('comparison'),
          geometry: geometryOf({ ground, photo: layout.photo, scrim: !!layout.scrim, title: layout.title, subtitle: layout.subtitle }),
          shape: geometryOf({ ground: '', photo: layout.photo, scrim: !!layout.scrim, title: layout.title, subtitle: layout.subtitle }),
        });
      }
    }
  }
  return out;
}

/** Função semântica da página no roteiro (purpose), ou ''. */
const slidePurpose = slide => String(slide?.presentationPlan?.purpose || '');
/**
 * Páginas em que a arte de fundo faz sentido (parte 4): posicionamento e
 * visão, personalidade e comportamento (other), síntese e fecho.
 */
const ART_PURPOSES = new Set(['vision', 'summary', 'decision']);
/** Páginas de frase, síntese ou comportamento: candidatas a texto em cor cheia (parte 5). */
const ACCENT_TEXT_PURPOSES = new Set(['other', 'summary', 'objection', 'learning']);

/** Peso da proposta da IA (roteiro v3): forte o bastante para valer, sem passar por cima das regras duras. */
const PROPOSAL_WEIGHT = Object.freeze({ family: 10, photo: 6, ground: 6 });

function scoreCandidate(c, { prev, role, visual, order, enough, proposal, purpose = '' }) {
  const last = prev.at(-1);
  const count = (key, value) => prev.filter(p => p[key] === value).length;
  const families = new Set(prev.map(p => p.family).filter(Boolean));
  const grounds = new Set(prev.map(p => p.ground));
  const photos = new Set(prev.map(p => p.photo));
  let s = 0;
  if (c.kind !== role && !['cover', 'closing', 'data'].includes(c.kind)) s += 3;
  // Página com foto não perde a foto (a imagem já existe ou foi pedida).
  if (visual && c.photo === 'none') s += 14;
  s += count('photo', c.photo) * 1.5;
  if (enough && photos.size < 3 && !photos.has(c.photo)) s -= 4;
  if (!c.native) s += 1.5;
  s += count('ground', c.ground);
  if (enough && grounds.size < 3 && !grounds.has(c.ground)) s -= 3;
  if (last && last.ground === c.ground) s += 2;
  // Teto de famílias do deck: 4 quando o código decide sozinho; até 6 quando
  // a família vem da proposta do diretor de arte da IA.
  if (!families.has(c.family) && families.size >= (proposal?.family === c.family ? MAX_PROPOSED_FAMILIES : MAX_FAMILIES)) s += 20;
  if (last && last.family === c.family) s += 4;
  if (prev.slice(-3).some(p => p.family === c.family)) s += 2;
  s += count('family', c.family) * 0.5;
  if (last && last.geometry === c.geometry) s += 2;
  // Mesma página (família, foto e colunas) já usada no deck: só o fundo
  // mudaria, e fundo claro e de superfície quase não se distinguem.
  s += prev.filter(p => p.shape === c.shape).length * 2.5;
  // Lado da foto (conferência da fase 1: quase todas à direita). Quando a
  // família desenha os dois lados, o diretor alterna; nunca inventa layout.
  if (c.side) {
    const sides = prev.map(p => p.side).filter(Boolean);
    s += sides.filter(side => side === c.side).length * 0.8;
    if (sides.at(-1) === c.side) s += 1.5;
    if (sides.length >= 2 && sides.slice(-2).every(side => side === c.side)) s += 3;
  }
  // Arte de fundo (parte 4): só onde a página pede posicionamento,
  // personalidade, síntese ou fecho; nas outras, um fundo como os demais.
  // A personalidade em duas colunas (comparação) também pede arte.
  if (c.ground === 'art') s += ART_PURPOSES.has(purpose) || c.kind === 'closing' || c.artBlock ? -4 : 5;
  // Texto em cor cheia com título grande (parte 5): página de frase.
  if (c.ground === 'accent' && c.photo === 'none' && c.kind === 'divider' && ACCENT_TEXT_PURPOSES.has(purpose)) s -= 4;
  // A IA propõe, o código garante: cada campo que bate com a proposta pesa a
  // favor; regras de ritmo e de variedade já filtraram os candidatos.
  if (proposal) {
    if (c.family === proposal.family) s -= PROPOSAL_WEIGHT.family;
    if (c.photo === proposal.photo) s -= PROPOSAL_WEIGHT.photo;
    if (c.ground === proposal.ground) s -= PROPOSAL_WEIGHT.ground;
  }
  return s + order.indexOf(c.family) * 0.01;
}

/**
 * Variedade garantida (spec, regra 2): quando faltam mais fundos (ou tamanhos
 * de foto) diferentes do que páginas para completá-los, a página só pode
 * acrescentar um valor novo, se a família tiver algum.
 */
function forceVariety(allowed, { prev, index, count, visual }) {
  if (count < 6) return allowed;
  const remaining = count - index;
  let out = allowed;
  for (const [key, applies] of [['ground', true], ['photo', visual]]) {
    if (!applies) continue;
    const seen = new Set(prev.map(p => p[key]));
    if (seen.size >= 3 || 3 - seen.size < remaining) continue;
    // Página com foto não perde a foto para variar: 'none' só vale como fundo.
    const fresh = out.filter(c => !seen.has(c[key]) && !(key === 'photo' && c.photo === 'none'));
    if (fresh.length) out = fresh;
  }
  return out;
}

/** Proposta de design gravada no roteiro v3 da página, ou null. */
export function proposedSlideDesign(slide) {
  return normalizeProposedDesign(slide?.presentationPlan?.design);
}

/**
 * Design de uma página, conhecendo as anteriores. Rodado slide a slide dá o
 * mesmo resultado que o deck inteiro (geração e "aplicar estilo" concordam).
 * Regras duras: nunca 3 geometrias iguais seguidas; nunca 2 seguidas com a
 * mesma família e a mesma função de página.
 */
export function directFreeSlideDesign(input = {}) {
  return directFreeSlide(input).design;
}

/**
 * Design e função de página do candidato escolhido. A composição usa a mesma
 * função de página que o candidato mediu: recalcular a função pelo tamanho da
 * foto trocava a demonstração (foto à esquerda) pelo conteúdo (foto à
 * direita) e o diretor nunca conseguia trocar a foto de lado.
 */
function directFreeSlide({ slide = {}, stage = {}, index = 0, count = 1, previous = [], deckDesign } = {}) {
  const prev = previousDesigns(previous);
  const [before, last] = prev.slice(-2);
  const role = resolvePresentationCompositionKind({ slide, stage, index, count });
  const proposal = proposedSlideDesign(slide);
  const visual = hasVisual(slide);
  let allowed = forceVariety(candidatesFor({ slide, stage, index, count }).filter(c => !(
    (last && before && last.geometry === c.geometry && before.geometry === c.geometry)
    || (last && last.family === c.family && last.kind === c.kind))), { prev, index, count, visual });
  // Página com foto não perde a foto (a imagem existe ou foi pedida): sem
  // isso, abrir o projeto restaurava a foto e recompunha a página.
  const withPhoto = visual ? allowed.filter(c => c.photo !== 'none') : allowed;
  if (withPhoto.length) allowed = withPhoto;
  // Direção de arte (parte 3): ground photo pedido pela IA é a foto cheia com
  // o texto sobre o espaço reservado, quando alguma família a desenha aqui
  // (Cinemático e Fotográfico); a família proposta cede, o fundo não.
  if (visual && proposal?.ground === 'photo') {
    const onPhoto = allowed.filter(c => c.ground === 'photo');
    if (onPhoto.length) allowed = onPhoto;
  }
  // Arte de fundo em até 3 páginas por deck (parte 4).
  if (prev.filter(p => p.ground === 'art').length >= FREE_ART_MAX_SLIDES) {
    const withoutArt = allowed.filter(c => c.ground !== 'art');
    if (withoutArt.length) allowed = withoutArt;
  }
  // Nunca 3 fotos laterais seguidas do mesmo lado quando há outra geometria
  // com foto (também com a proposta da IA): o código garante o ritmo do lado.
  const sides = prev.map(p => p.side).filter(Boolean);
  const sameSide = sides.length >= 2 && sides.at(-1) === sides.at(-2) ? sides.at(-1) : null;
  const alternated = sameSide ? allowed.filter(c => c.side !== sameSide && !(visual && c.photo === 'none')) : allowed;
  // Com proposta da IA, troca de lado só se a família proposta desenha o
  // outro lado: o lado não troca a família que o diretor de arte escolheu.
  const familyAlternates = !proposal || alternated.some(c => c.family === proposal.family);
  if (alternated.length && familyAlternates) allowed = alternated;
  const context = { prev, role, visual, order: familyOrder(deckDesign), enough: count >= 6, proposal, purpose: slidePurpose(slide) };
  let best = null;
  let bestScore = Infinity;
  for (const c of allowed) {
    const score = scoreCandidate(c, context);
    if (score < bestScore) { best = c; bestScore = score; }
  }
  const chosen = best || { family: 'executive', ground: 'bg', photo: hasVisual(slide) ? 'half' : 'none' };
  // O bloco da página é o que está escrito em presentationBlocks (fase 3:
  // citação, número grande e ícones também). Proposta sem bloco escrito, ou
  // derrubada pela guarda de fatos, fica none. Negrito e ícones propostos
  // passam pelo mesmo normalizador.
  const native = slideBlockTypes(slide).find(type => FREE_BLOCKS.includes(type) && type !== 'none');
  const block = native || 'none';
  const design = normalizeSlideDesign({
    family: chosen.family, ground: chosen.ground, photo: chosen.photo, block,
    emphasis: proposal?.emphasis || [], icons: proposal?.icons || [],
  }, slide);
  return { design, kind: chosen.kind || null };
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

/* Adornos da família no modo livre ----------------------------------------- */

const lum = hex => wcagContrast(hex, '#000000');
const covers = (d, x, y) => d.w > 0 && d.h > 0 && x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h;
const inside = (zone, x, y) => !!zone && zone.w > 0 && zone.h > 0 && covers(zone, x, y);
/** Faixa de letterbox (Cinemático): bloco de largura total, fino, por cima da foto. */
const isLetterbox = d => d.t === 'block' && d.w >= 99 && d.h <= 12 && d.z === 'over';
/** Tamanho a partir do qual o adorno é texto grande (WCAG: 3:1). */
const LARGE_CHROME_PX = 48;

/**
 * Chrome da família com as cores do deck resolvidas e lidas contra o que fica
 * atrás (conferência da fase 1): "CENA nn" em laranja sobre preto (3,5:1),
 * faixas do Cinemático creme com kit escuro e fio de destaque sumindo no
 * fundo de destaque. No modo livre cada adorno vira cor fixa:
 * - faixa de letterbox: a cor mais escura do deck;
 * - texto: ≥ 4,5:1 (≥ 3:1 se grande) contra o bloco ou o fundo atrás dele,
 *   ou sai quando fica sobre a foto sem faixa;
 * - fio: nunca da cor do que está atrás (≥ 1,5:1).
 */
export function freeChromeDevices(chrome, { family, ground, palette, photoZone = null, deckColors = null }) {
  const color = token => (/^#/.test(String(token)) ? token : resolveChromeColor(family, ground, token, palette));
  const page = groundInks(family, ground, palette).bg;
  const darkest = [palette.inverse, palette.bg, palette.ink, palette.surface].filter(Boolean).sort((a, b) => lum(a) - lum(b))[0];
  const inks = [palette.ink, palette.inverseInk, palette.accent2, palette.muted];
  // Teste 6, item 7: foto cheia no modo livre ocupa o quadro inteiro; as
  // faixas de cinema (letterbox) do Cinemático saem.
  const fullPhoto = !!photoZone && photoZone.x <= 0 && photoZone.y <= 0 && photoZone.w >= 100 && photoZone.h >= 100;
  // Teste 6, item 4: moldura, bloco, círculo, fio e grade usam só as cores da
  // paleta do deck. A cor de mistura da família (accent3, a moldura marrom do
  // Cultural) vira a cor do deck mais próxima; se ela é a do fundo atrás, o
  // adorno some.
  const allowed = Array.isArray(deckColors) && deckColors.length ? [...new Set(deckColors.map(normalizeHex).filter(Boolean))] : null;
  const inDeck = (c, avoid = null) => {
    const hex = normalizeHex(c);
    if (!allowed || !hex) return c;
    if (allowed.includes(hex)) return hex === avoid ? null : hex;
    const pick = nearestPaletteHex(hex, allowed);
    return pick === avoid ? null : pick;
  };
  const resolved = (Array.isArray(chrome) ? chrome : []).flatMap((d) => {
    if (isLetterbox(d) && fullPhoto) return [];
    if (d.t === 'block' || d.t === 'circle' || d.t === 'frame') {
      if (isLetterbox(d)) return [{ ...d, color: darkest }];
      const c = inDeck(color(d.color), d.z === 'over' && inside(photoZone, d.x + 0.1, d.y + 0.1) ? null : page);
      return c ? [{ ...d, color: c }] : [];
    }
    if (d.t === 'grid') { const c = inDeck(color(d.color), page); return c ? [{ ...d, color: c }] : []; }
    return [d];
  });
  const behind = (x, y, self) => {
    const block = [...resolved].reverse().find(d => d !== self && (d.t === 'block' || (d.t === 'circle' && covers({ x: d.x, y: d.y, w: d.d, h: d.d * 16 / 9 }, x, y))) && (d.t !== 'block' || covers(d, x, y)));
    if (block) return block.color;
    return inside(photoZone, x, y) ? null : page;
  };
  const out = [];
  for (const d of resolved) {
    if (d.t === 'rule') {
      const bgColor = behind(d.x + 0.1, d.y, d) || page;
      const c = color(d.color);
      if (allowed) {
        // Fio na cor do deck mais próxima que ainda se vê (≥ 1,5:1); sem nenhuma, sai.
        const seen = allowed.filter(hex => wcagContrast(hex, bgColor) >= 1.5);
        if (seen.length) out.push({ ...d, color: nearestPaletteHex(normalizeHex(c) || seen[0], seen) });
        continue;
      }
      out.push({ ...d, color: wcagContrast(c, bgColor) >= 1.5 ? c : readable(bgColor, inks) });
    } else if (d.t === 'pill') {
      const pillBg = color(d.color);
      const ink = color(d.ink || 'inverseInk');
      out.push({ ...d, color: pillBg, ink: wcagContrast(ink, pillBg) >= 4.5 ? ink : readable(pillBg, [ink, ...inks]) });
    } else if (d.t === 'text') {
      const bgColor = behind(d.x + 0.5, d.y + 0.5, d);
      if (!bgColor) continue;
      const c = color(d.color);
      const opacity = d.opacity ?? 1;
      const seen = opacity < 1 ? mixHex(c, bgColor, opacity) : c;
      const min = (d.size || 0) >= LARGE_CHROME_PX ? 3 : 4.5;
      out.push(wcagContrast(seen, bgColor) >= min ? { ...d, color: c } : { ...d, color: readable(bgColor, [c, ...inks]), opacity: 1 });
    } else out.push(d);
  }
  return out;
}

/* Tipografia e leitura no modo livre ---------------------------------------- */

/**
 * Teto do título com a fonte do deck (conferência da fase 1): o Tipográfico
 * desenha 150 a 220 px para a Archivo pesada; com outra fonte o título enchia
 * meia página. Capa e divisor mantêm a voz de abertura.
 */
export const FREE_TITLE_MAX_PX = Object.freeze({ cover: 176, divider: 176, other: 128 });
const titlePxOf = size => size * 1920 * 0.084 / 100;
const subPxOf = size => size * 1920 * 0.028 / 100;
const SUPPORT_MAX_PX = 32;
const STACK_GAP = 3.5;

/* Largura medida (fase 3) ---------------------------------------------------- */

const advanceCache = new Map();
/** Avanço por caractere (em) de uma fonte da biblioteca no papel pedido; null se não medida. */
function advances(font, role) {
  const key = `${font}|${role === 'display' ? 'display' : 'text'}`;
  if (advanceCache.has(key)) return advanceCache.get(key);
  const raw = FREE_FONT_ADVANCES[key];
  let out = null;
  if (raw) {
    const values = raw.split(',').map(Number);
    const map = new Map([...FREE_FONT_CHARSET].map((c, i) => [c, values[i] / 1000]));
    const lower = [...'abcdefghijklmnopqrstuvwxyz'].map(c => map.get(c));
    out = { map, fallback: lower.reduce((a, b) => a + b, 0) / lower.length };
  }
  advanceCache.set(key, out);
  return out;
}

/**
 * Largura de um texto (px) na fonte do deck, pelas métricas geradas do canvas
 * (free-font-metrics.js), com o espaçamento entre letras em em. Sem kerning:
 * fica um pouco acima do que o navegador desenha, nunca abaixo.
 */
export function freeTextWidth(text, px, font, role = 'text', { trackingEm = 0, upper = false } = {}) {
  const value = upper ? String(text || '').toUpperCase() : String(text || '');
  const table = advances(font, role);
  const chars = [...value];
  if (!table) return chars.length * 0.55 * px;
  return chars.reduce((sum, c) => sum + (table.map.get(c) ?? table.fallback) + trackingEm, 0) * px;
}

/**
 * Linhas de um texto quebrado por palavras numa coluna, com a largura real da
 * fonte do deck (conferência da fase 2: a largura média contava 3 linhas num
 * título que o navegador desenha em 2 e abria um vão até o apoio). Folga de 2%
 * para a diferença de arredondamento entre a medida e o desenho.
 */
export function freeTextLines(value, widthPx, px, font, role = 'text', options = {}) {
  const limit = Math.max(1, widthPx * 0.98);
  const space = freeTextWidth(' ', px, font, role, options);
  return String(value || '').replace(/\*\*/g, '').split('\n').reduce((total, paragraph) => {
    let lines = 1;
    let used = 0;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const w = freeTextWidth(word, px, font, role, options);
      if (used && used + space + w > limit) { lines += 1 + Math.floor(w / limit); used = w % limit; } else used += (used ? space : 0) + w;
    }
    return total + lines;
  }, 0);
}

function estimateLines(value, widthPx, px, widthFactor) {
  const capacity = Math.max(1, widthPx / (px * (widthFactor || 0.55)));
  return String(value || '').replace(/\*\*/g, '').split('\n').reduce((total, paragraph) => {
    let lines = 1;
    let used = 0;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const chars = [...word].length;
      if (used && used + 1 + chars > capacity) { lines += 1; used = 0; }
      used += (used ? 1 : 0) + chars;
    }
    return total + lines;
  }, 0);
}

/**
 * Leitura sem vazio (conferência da fase 1, Executivo com leitura longa): a
 * zona do título é calculada para a fonte da família; com a fonte do deck o
 * título ocupa menos linhas e o apoio ficava longe dele, com a metade de baixo
 * da coluna vazia. Nas páginas de conteúdo e demonstração com o apoio logo
 * abaixo do título (mesma coluna, fora da foto e sem bloco), o apoio sobe para
 * perto do título (os adornos que o seguem sobem junto), a coluna desce até o
 * fim da área de leitura ao lado da foto e o corpo cresce em passos de 2 px até
 * 32 px enquanto o texto estimado couber. Nunca diminui.
 */
function compactReading({ zones, chrome, slide, titleSize, subSize, display, text, kind, leading, titleLeading }) {
  const t = zones.title;
  const sub = zones.subtitle;
  if (!t || !sub || !['content', 'demo'].includes(kind)) return null;
  if (!(sub.y >= t.y + 1) || Math.min(t.x + t.w, sub.x + sub.w) - Math.max(t.x, sub.x) <= Math.min(t.w, sub.w) * 0.4) return null;
  // Mesma conta do aperto da pilha das famílias (tightenStack), com a largura
  // medida da fonte do deck (free-font-metrics.js): a zona do título encolhe
  // para o que o título ocupa, e o apoio começa logo abaixo, sem sobrepor.
  const titlePx = titlePxOf(titleSize);
  const lines = freeTextLines(String(slide.title || ''), 1920 * t.w / 100 - 24, titlePx, display.family, 'display',
    { trackingEm: (display.tracking || 0) / 100, upper: display.case === 'upper' });
  const breathing = Math.max(20, titlePx * 0.44 + 1080 * 0.012);
  const needed = Math.round(((lines * titlePx * titleLeading + breathing) / 1080) * 10000) / 100 + 0.5;
  const titleZone = needed < t.h - 1 ? { ...t, h: needed } : t;
  const photo = zones.photo && zones.photo.w > 0 && Math.min(sub.x + sub.w, zones.photo.x + zones.photo.w) - Math.max(sub.x, zones.photo.x) <= 0 ? zones.photo : null;
  const top = Math.round(Math.min(sub.y, titleZone.y + titleZone.h + STACK_GAP) * 100) / 100;
  const bottom = Math.max(sub.y + sub.h, photo ? Math.min(90, photo.y + photo.h) : 0);
  const zone = { ...sub, y: top, h: Math.round((bottom - top) * 100) / 100 };
  const delta = sub.y - top;
  const copy = String(slide.subtitle || '').replace(/\*\*/g, '').trim();
  const tail = String(slide.bodyAfterImage || '').replace(/\*\*/g, '').trim();
  const widthPx = 1920 * zone.w / 100 - 24;
  const heightPx = 1080 * zone.h / 100 - 14;
  const copyLines = (value, px) => (text?.family ? freeTextLines(value, widthPx, px, text.family, 'text') : estimateLines(value, widthPx, px, 0.55));
  const height = px => copyLines(copy, px) * px * leading + (tail ? 0.8 * px + copyLines(tail, px * 0.85) * px * 0.85 * leading : 0);
  const startPx = subPxOf(subSize);
  let px = startPx;
  if (copy) for (let next = Math.ceil(startPx / 2) * 2; next <= SUPPORT_MAX_PX && height(next) <= heightPx; next += 2) px = Math.max(px, next);
  if (delta < 1 && px === startPx) return null;
  return {
    zone,
    titleZone: delta >= 1 ? titleZone : t,
    subSize: px === startPx ? subSize : rendererSubtitleSizePercent(px),
    chrome: delta >= 1 ? chrome.map(d => (d.follow === 'subtitle' ? { ...d, y: Math.round((d.y - delta) * 100) / 100 } : d)) : chrome,
  };
}

/**
 * Teste 6 (26/11), item 3: na foto cheia com o texto num lado (Cinemático,
 * slide 9) a caixa do apoio era a da família (13% da altura) e o ajuste
 * automático encolhia apoio e corpo para ~14 px. Aqui vale o piso das outras
 * páginas: o título encolhe para as linhas que ocupa, o apoio começa logo
 * abaixo, na largura do título, e vai até 90% da altura; o corpo parte de
 * 26 px (piso de 25 px no passo de 2) e cresce até 32 px enquanto couber.
 * Se não couber, o bloco de texto sobe (até 10% do topo). Nunca diminui.
 */
export const FREE_PHOTO_SUPPORT_MIN_PX = 26;
const PHOTO_TEXT_TOP = 10;
const PHOTO_TEXT_BOTTOM = 90;
function photoReading({ zones, chrome, slide, titleSize, subSize, display, text, kind, leading, titleLeading }) {
  const t = zones.title;
  const sub = zones.subtitle;
  if (!t || !sub || !['cover', 'content', 'demo', 'closing'].includes(kind)) return null;
  if (Math.min(t.x + t.w, sub.x + sub.w) - Math.max(t.x, sub.x) <= Math.min(t.w, sub.w) * 0.4) return null;
  const copy = String(slide.subtitle || '').replace(/\*\*/g, '').trim();
  const tail = String(slide.bodyAfterImage || '').replace(/\*\*/g, '').trim();
  if (!copy && !tail) return null;
  const titlePx = titlePxOf(titleSize);
  const lines = freeTextLines(String(slide.title || ''), 1920 * t.w / 100 - 24, titlePx, display.family, 'display',
    { trackingEm: (display.tracking || 0) / 100, upper: display.case === 'upper' });
  const breathing = Math.max(20, titlePx * 0.44 + 1080 * 0.012);
  const titleH = Math.min(t.h, Math.round(((lines * titlePx * titleLeading + breathing) / 1080) * 10000) / 100 + 0.5);
  const x = sub.x;
  const w = Math.abs(sub.x - t.x) < 0.5 ? Math.max(sub.w, t.w) : sub.w;
  const bottom = Math.max(PHOTO_TEXT_BOTTOM, sub.y + sub.h);
  const widthPx = 1920 * w / 100 - 24;
  const copyLines = (value, px) => (text?.family ? freeTextLines(value, widthPx, px, text.family, 'text') : estimateLines(value, widthPx, px, 0.55));
  // Altura do apoio mais o corpo (0,85 do apoio, como no desenho), em %.
  const supportH = px => ((copy ? copyLines(copy, px) * px * leading : 0)
    + (tail ? (copy ? 0.8 * px : 0) + copyLines(tail, px * 0.85) * px * 0.85 * leading : 0) + 14) / 1080 * 100;
  const fits = px => titleH + STACK_GAP + supportH(px) + 0.1 <= bottom - PHOTO_TEXT_TOP;
  const startPx = Math.max(subPxOf(subSize), FREE_PHOTO_SUPPORT_MIN_PX);
  let px = startPx;
  for (let next = Math.ceil(startPx / 2) * 2; next <= SUPPORT_MAX_PX && fits(next); next += 2) px = Math.max(px, next);
  // Folga de 0,1% para o arredondamento das caixas.
  const needed = titleH + STACK_GAP + supportH(px) + 0.1;
  // O título fica onde a família o pôs, a não ser que o texto não caiba abaixo.
  const titleY = Math.floor(Math.max(PHOTO_TEXT_TOP, Math.min(t.y + t.h - titleH, bottom - needed)) * 100) / 100;
  const titleZone = { ...t, y: titleY, h: titleH };
  const top = Math.round((titleY + titleH + STACK_GAP) * 100) / 100;
  const zone = { ...sub, x, w, y: top, h: Math.round((bottom - top) * 100) / 100 };
  const delta = sub.y - top;
  return {
    zone,
    titleZone,
    subSize: px === subPxOf(subSize) ? subSize : rendererSubtitleSizePercent(px),
    chrome: chrome.map(d => (d.follow === 'subtitle' ? { ...d, y: Math.round((d.y - delta) * 100) / 100 } : d)),
  };
}

/**
 * Cartão atrás do apoio (Modular) com texto curto (conferência da fase 2, kit,
 * página 7): o cartão da família ocupa até o pé da coluna e o texto curto
 * deixava a metade de baixo vazia. O corpo cresce até 32 px enquanto couber;
 * o cartão sobe para logo abaixo do título (largura medida da fonte do deck) e
 * abraça o texto, com as mesmas margens internas. Com título e apoio no mesmo
 * cartão, o cartão fica e o conteúdo vai para o meio dele. Nunca passa do
 * cartão da família nem diminui o texto.
 */
function panelReading({ zones, chrome, slide, titleSize, subSize, display, text, kind, leading, titleLeading }) {
  const t = zones.title;
  const sub = zones.subtitle;
  if (!t || !sub || !['content', 'demo'].includes(kind)) return null;
  const panel = textPanel({ chrome }, sub);
  if (!panel || !(sub.y >= t.y + 1)) return null;
  const shared = textPanel({ chrome }, t) === panel;
  if (!shared && textPanel({ chrome }, t)) return null;
  const index = chrome.indexOf(panel);
  const padTop = sub.y - panel.y;
  const padBottom = panel.y + panel.h - (sub.y + sub.h);
  const copy = String(slide.subtitle || '').replace(/\*\*/g, '').trim();
  const tail = String(slide.bodyAfterImage || '').replace(/\*\*/g, '').trim();
  if (!copy) return null;
  const widthPx = 1920 * sub.w / 100 - 24;
  const heightPx = 1080 * sub.h / 100 - 14;
  const lines = (value, px) => freeTextLines(value, widthPx, px, text.family, 'text');
  const height = px => lines(copy, px) * px * leading + (tail ? 0.8 * px + lines(tail, px * 0.85) * px * 0.85 * leading : 0);
  const startPx = subPxOf(subSize);
  let px = startPx;
  for (let next = Math.ceil(startPx / 2) * 2; next <= SUPPORT_MAX_PX && height(next) <= heightPx; next += 2) px = Math.max(px, next);
  // Altura do texto com a folga de leitura da zona (14 px) e 1% de margem.
  const textH = Math.round(((height(px) + 14) / 1080 * 100 + 1) * 100) / 100;
  const subH = Math.min(sub.h, textH);
  const titlePx = titlePxOf(titleSize);
  const titleLines = freeTextLines(String(slide.title || ''), 1920 * t.w / 100 - 24, titlePx, display.family, 'display',
    { trackingEm: (display.tracking || 0) / 100, upper: display.case === 'upper' });
  const breathing = Math.max(20, titlePx * 0.44 + 1080 * 0.012);
  const needed = Math.round(((titleLines * titlePx * titleLeading + breathing) / 1080) * 10000) / 100 + 0.5;
  const titleZone = needed < t.h - 1 ? { ...t, h: needed } : t;
  const grownSize = px === startPx ? subSize : rendererSubtitleSizePercent(px);
  if (shared) {
    // Título e apoio no mesmo cartão (demonstração do Modular): o cartão fica
    // do tamanho da família, ao lado da foto, e o conteúdo vai para o meio dele.
    const top = t.y - panel.y;
    const inner = panel.h - top - padBottom;
    const total = titleZone.h + STACK_GAP + subH;
    const free = inner - total;
    if (free < 4 && px === startPx) return null;
    const y = Math.round((t.y + Math.max(0, free) / 2) * 100) / 100;
    const subY = Math.round((y + titleZone.h + STACK_GAP) * 100) / 100;
    return {
      zone: { ...sub, y: subY, h: Math.round(Math.min(subH, panel.y + panel.h - padBottom - subY) * 100) / 100 },
      titleZone: { ...titleZone, y },
      subSize: grownSize,
      chrome: chrome.map(d => (d.follow === 'subtitle' ? { ...d, y: Math.round((d.y + subY - sub.y) * 100) / 100 } : d)),
    };
  }
  // Revisão da folha livre-f3 (kit, página 7): o cartão que abraçava o texto
  // terminava no meio da foto ao lado. Com foto ao lado, o cartão fica da
  // altura da foto e leva o título e o apoio no meio dele, como na
  // demonstração do Modular (cartão e foto lado a lado, do mesmo tamanho).
  const photo = zones.photo && zones.photo.w > 1 && zones.photo.h > 1
    && Math.min(panel.x + panel.w, zones.photo.x + zones.photo.w) - Math.max(panel.x, zones.photo.x) <= 0 ? zones.photo : null;
  if (photo) {
    const inTitle = measuredTitleZone({ ...t, x: sub.x, w: sub.w, y: 0, h: 100 }, { slide, titleSize, display, titleLeading });
    const inner = photo.h - padTop - padBottom;
    const group = inTitle.h + 1 + subH;
    if (group <= inner) {
      const card = { ...panel, y: photo.y, h: photo.h };
      const y = Math.round((photo.y + padTop + (inner - group) / 2) * 100) / 100;
      const subY = Math.round((y + inTitle.h + 1) * 100) / 100;
      return {
        titleZone: { ...inTitle, y }, zone: { ...sub, y: subY, h: subH }, subSize: grownSize, titlePanel: card,
        chrome: chrome.map((d, i) => (i === index ? card : d)),
      };
    }
  }
  // Sem foto ao lado (ou texto que não cabe com o título): o cartão sobe para
  // logo abaixo do título, termina onde a coluna da família termina e o texto
  // fica no meio dele.
  const cardY = Math.round(Math.min(panel.y, titleZone.y + titleZone.h + STACK_GAP) * 100) / 100;
  const delta = panel.y - cardY;
  if (sub.h - subH < 3 && delta < 1 && px === startPx) return null;
  const bottom = panel.y + panel.h;
  const card = { ...panel, y: cardY, h: Math.round((bottom - cardY) * 100) / 100 };
  const innerTop = cardY + padTop;
  const innerBottom = bottom - padBottom;
  const subY = Math.round((innerTop + Math.max(0, (innerBottom - innerTop - subH) / 2)) * 100) / 100;
  return {
    zone: { ...sub, y: subY, h: Math.round(Math.min(subH, innerBottom - subY) * 100) / 100 },
    titleZone: delta >= 1 ? titleZone : t,
    subSize: grownSize,
    chrome: chrome.map((d, i) => {
      if (i === index) return card;
      if (d.follow !== 'subtitle') return d;
      // Cartão vizinho que acompanha o apoio cresce junto; o número dele fica no meio.
      if (d.t === 'block') return { ...d, y: Math.round((d.y - delta) * 100) / 100, h: Math.round((d.h + delta) * 100) / 100 };
      return { ...d, y: Math.round((d.y - delta / 2) * 100) / 100 };
    }),
  };
}

/* Acabamento antes de publicar (revisão da folha livre-f3) ------------------- */

/**
 * Adornos narrativos das famílias que não fazem sentido fora delas: o "CENA nn"
 * do Cinemático e os rótulos de ficha do Técnico ("FIG.", "TAB.", "§", "NOTA",
 * "FIM") apareciam em páginas do modo livre que não são cinema nem ficha. O
 * número da página em pílula (Modular) repetia o fólio do deck. Saem; o fólio
 * do deck continua numerando as páginas. O número de seção do divisor fica,
 * sem o "§". Presets comuns não passam por aqui.
 */
const NARRATIVE_CHROME = /CENA|TAB\.|FIG\.|NOTA|FIM\b|§/;
// Teste 6 (26/11), item 4: o "05" em pílula do Modular. No modo livre a
// numeração como adorno (página, seção, total) sai; o fólio do deck fica.
const NUMERAL_ORNAMENT = /^[\s§·|/\-–—.:#]*(?:\{(?:index|section|total)\}[\s§·|/\-–—.:#]*)+$/;
export function freeNeutralChrome(chrome) {
  const list = Array.isArray(chrome) ? chrome : [];
  const numerals = list.filter(d => (d.t === 'text' || d.t === 'pill') && NUMERAL_ORNAMENT.test(String(d.text || '')));
  // Cartão pequeno que só segurava o número sai junto (sem cartão vazio).
  const host = d => d.t === 'block' && d.w * d.h <= 300 && numerals.some(n => {
    const x = n.x + (n.w || 0) / 2; const y = n.y + 1;
    return x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h;
  });
  return list.flatMap((d) => {
    if (numerals.includes(d) || host(d)) return [];
    if (d.t !== 'text' && d.t !== 'pill') return [d];
    const value = String(d.text || '');
    if (d.t === 'pill' && /\{index\}/.test(value)) return [];
    return NARRATIVE_CHROME.test(value) ? [] : [d];
  });
}

const round2 = value => Math.round(value * 100) / 100;
/** Inset do texto dentro da zona (12 px de cada lado num slide de 1920). */
const TEXT_INSET = 0.625;

/** Zona do título do tamanho das linhas que o título ocupa, com a fonte do deck. */
function measuredTitleZone(t, { slide, titleSize, display, titleLeading }) {
  const titlePx = titlePxOf(titleSize);
  const lines = freeTextLines(String(slide.title || ''), 1920 * t.w / 100 - 24, titlePx, display.family, 'display',
    { trackingEm: (display.tracking || 0) / 100, upper: display.case === 'upper' });
  const breathing = Math.max(20, titlePx * 0.44 + 1080 * 0.012);
  const needed = round2((lines * titlePx * titleLeading + breathing) / 1080 * 100) + 0.5;
  return needed < t.h - 1 ? { ...t, h: needed } : t;
}

/** Altura (% do slide) do apoio e do texto final numa coluna, sem folga. */
function supportHeightPct(slide, widthPct, px, text, leading) {
  const copy = String(slide.subtitle || '').replace(/\*\*/g, '').trim();
  const tail = String(slide.bodyAfterImage || '').replace(/\*\*/g, '').trim();
  const widthPx = 1920 * widthPct / 100 - 24;
  const lines = (value, size) => (text?.family ? freeTextLines(value, widthPx, size, text.family, 'text') : estimateLines(value, widthPx, size, 0.55));
  const h = (copy ? lines(copy, px) * px * leading : 0) + (tail ? 0.8 * px + lines(tail, px * 0.85) * px * 0.85 * leading : 0);
  return h / 1080 * 100;
}

/** Adornos logo acima de uma zona, na coluna dela (fio ou barra de destaque que a abre). */
function anchoredAbove(d, zone, reach = 8) {
  if (!['rule', 'block', 'text', 'pill'].includes(d.t) || d.w >= 99 || d.follow) return false;
  return d.y < zone.y && d.y >= zone.y - reach && d.x >= zone.x - 1 && d.x < zone.x + zone.w;
}
const crosses = (d, r) => (d.t === 'rule' || d.t === 'block') && d.w > 0 && d.h > 0
  && d.x < r.x + r.w && d.x + d.w > r.x && d.y < r.y + r.h && d.y + d.h > r.y;

/** Teto do número grande (PresentationBlocks.bigNumberFit). */
const BIG_NUMBER_MAX_PX = 400;

/** Altura estimada (% do slide) da linha de ícones, como PresentationBlocks a desenha. */
function iconsHeightPct(block, widthPct, text) {
  const items = block.items || [];
  const n = Math.max(1, items.length);
  const column = (1920 * widthPct / 100 - (n - 1) * 48) / n;
  const badge = Math.min(160, column * 0.6);
  const lines = (value, px) => (value ? freeTextLines(value, column * 0.95, px, text.family, 'text') : 0);
  const titleLines = Math.max(1, ...items.map(item => lines(item.title, 38)));
  const bodyLines = Math.max(0, ...items.map(item => lines(item.body, 28)));
  return (badge + 28 + titleLines * 38 * 1.18 + (bodyLines ? 12 + bodyLines * 28 * 1.4 : 0)) / 1080 * 100;
}

/** Altura estimada (% do slide) da citação e do número grande, como PresentationBlocks os desenha. */
function blockHeightPct(block, ev, heightPct, { display, text }) {
  const widthPx = 1920 * ev.w / 100;
  const heightPx = 1080 * heightPct / 100;
  if (block.type === 'quote') {
    const author = block.author ? 26 * 1.4 + 22 : 0;
    let total = 0;
    for (let size = 72; size >= 40; size -= 4) {
      const lines = freeTextLines(block.text, widthPx - 8, size, display.family, 'display', { trackingEm: -0.01 });
      total = 96 * 0.62 + lines * size * 1.18 + author;
      if (total <= heightPx) break;
    }
    return total / 1080 * 100;
  }
  const perPx = freeTextWidth(block.value, 1, display.family, 'display', { trackingEm: -0.03 });
  const byWidth = perPx > 0 ? (widthPx * 0.95) / perPx : 260;
  const size = Math.max(Math.min(96, byWidth), Math.min(BIG_NUMBER_MAX_PX, heightPx * 0.5, byWidth));
  const label = freeTextLines(block.label, widthPx, 36, text.family, 'text') * 36 * 1.2;
  const detail = block.detail ? 10 + freeTextLines(block.detail, widthPx, 26, text.family, 'text') * 26 * 1.35 : 0;
  return (size * 1.02 + 18 + label + detail) / 1080 * 100;
}

/**
 * Página de dados com citação, número grande ou ícones e o apoio numa coluna ao
 * lado do bloco (revisão da folha livre-f3):
 * - ícones: o bloco ficava espremido na coluna da direita, com a metade
 *   esquerda e a base vazias. Agora o apoio vem logo abaixo do título e os
 *   ícones ocupam a largura útil abaixo dele, na linha do texto do título, com
 *   margens iguais; o bloco vai até o pé da área de leitura e os ícones ficam
 *   no meio dela. Fio ou cartão que cruzaria o bloco sai.
 * - citação e número grande com o título em cima: apoio e bloco formam uma
 *   linha que começa no mesmo ponto (âncora `start`), no meio da área abaixo
 *   do título; o fio que acompanha o apoio vai do começo ao fim da linha.
 * - citação e número grande com o título na coluna (Suíço): título no alto,
 *   bloco e apoio terminam na linha de baixo da coluna (âncora `end`).
 */
function blockReading({ zones, chrome, slide, titleSize, subSize, display, text, kind, leading, titleLeading }) {
  const t = zones.title;
  const sub = zones.subtitle;
  const ev = zones.evidence;
  const block = (Array.isArray(slide.presentationBlocks) ? slide.presentationBlocks : [])[0];
  if (kind !== 'data' || !t || !sub || !ev || !['quote', 'bignumber', 'icons'].includes(block?.type)) return null;
  if (!(ev.x >= sub.x + sub.w - 0.5)) return null;
  const column = ev.y <= t.y + 1;
  const px = subPxOf(subSize);
  const measureInput = { slide, titleSize, display, titleLeading };
  const bandBottom = Math.min(91, Math.max(ev.y + ev.h, sub.y + sub.h));
  const hasCopy = !!String(slide.subtitle || slide.bodyAfterImage || '').trim();

  if (block.type === 'icons') {
    const margin = t.x;
    const titleZone = measuredTitleZone({ ...t, w: column ? Math.min(62, 100 - 2 * margin) : t.w }, measureInput);
    const subW = Math.min(100 - 2 * margin, Math.max(sub.w, 56));
    const subY = round2(titleZone.y + titleZone.h + 1);
    const subH = hasCopy ? round2(supportHeightPct(slide, subW, px, text, leading) + 1.5) : 0;
    const top = subY + subH + 4;
    const w = round2(100 - 2 * margin - 2 * TEXT_INSET);
    const free = bandBottom - top - iconsHeightPct(block, w, text);
    // Os ícones ficam no terço de cima do espaço livre (centro óptico).
    const evY = round2(top + Math.max(0, free / 3));
    const evidence = { x: round2(margin + TEXT_INSET), y: evY, w, h: round2(bandBottom - evY) };
    if (evidence.h < 25) return null;
    const zone = { ...sub, x: t.x, y: subY, w: subW, h: Math.max(subH, 1) };
    const delta = subY - sub.y;
    const moved = chrome
      .filter(d => !(d.follow === 'subtitle' && crosses(d, evidence)))
      .map(d => (d.follow === 'subtitle' || anchoredAbove(d, sub, 4) ? { ...d, y: round2(d.y + delta) } : d))
      .filter(d => !crosses(d, evidence));
    return { titleZone, zone, evidence, chrome: moved, anchor: 'start' };
  }

  const titleZone = measuredTitleZone(t, measureInput);
  const subH = hasCopy ? supportHeightPct(slide, sub.w, px, text, leading) : 0;
  if (column) {
    const subY = round2(Math.max(titleZone.y + titleZone.h + STACK_GAP, bandBottom - subH));
    return {
      titleZone, zone: { ...sub, y: subY, h: round2(Math.max(1, bandBottom - subY + 1.5)) },
      evidence: { ...ev, y: t.y, h: round2(bandBottom - t.y) },
      chrome, anchor: 'end',
    };
  }
  const bandTop = titleZone.y + titleZone.h + STACK_GAP;
  const band = bandBottom - bandTop;
  let rowTop = bandTop;
  let rowH = Math.max(subH, blockHeightPct(block, ev, band, { display, text }));
  // A linha fica no terço de cima do espaço livre (centro óptico), não no meio.
  for (let pass = 0; pass < 2; pass += 1) {
    rowTop = bandTop + Math.max(0, (band - rowH) / 3);
    rowH = Math.max(subH, blockHeightPct(block, ev, bandBottom - rowTop, { display, text }));
  }
  rowTop = round2(rowTop);
  const h = round2(bandBottom - rowTop);
  if (h < 25) return null;
  const delta = rowTop - sub.y;
  const moved = chrome.map((d) => {
    if (d.follow === 'subtitle' && d.h > d.w) return { ...d, y: rowTop, h: round2(Math.min(rowH, h)) };
    if (d.follow === 'subtitle' || anchoredAbove(d, sub, 4)) return { ...d, y: round2(d.y + delta) };
    return d;
  });
  return { titleZone, zone: { ...sub, y: rowTop, h }, evidence: { ...ev, y: rowTop, h }, chrome: moved, anchor: 'start' };
}

/**
 * Fecho com título e apoio na mesma coluna (revisão da folha livre-f3, fecho
 * do Cultural): a zona do título tinha 40% da altura para um título de 2
 * linhas e o apoio ficava lá embaixo, com um vão no meio. O apoio vem logo
 * abaixo das linhas do título e o par fica no meio da coluna da família; o fio
 * ou a barra que abre o título desce junto.
 */
function closingReading({ zones, chrome, slide, titleSize, subSize, display, text, kind, leading, titleLeading }) {
  const t = zones.title;
  const sub = zones.subtitle;
  if (kind !== 'closing' || !t || !sub || !(sub.y >= t.y + 1)) return null;
  if (Math.min(t.x + t.w, sub.x + sub.w) - Math.max(t.x, sub.x) <= Math.min(t.w, sub.w) * 0.4) return null;
  const titleZone = measuredTitleZone(t, { slide, titleSize, display, titleLeading });
  if (t.h - titleZone.h < 3) return null;
  const gap = 1.5;
  const subH = supportHeightPct(slide, sub.w, subPxOf(subSize), text, leading);
  const stack = titleZone.h + gap + subH;
  // Com foto ao lado, o par fica no meio da foto; sem foto, no meio da coluna.
  const photo = zones.photo && zones.photo.w > 1 && zones.photo.h >= stack
    && Math.min(t.x + t.w, zones.photo.x + zones.photo.w) - Math.max(t.x, zones.photo.x) <= 0 ? zones.photo : null;
  const spanTop = photo ? photo.y : t.y;
  const spanBottom = photo ? photo.y + photo.h : sub.y + sub.h;
  const y = round2(spanTop + Math.max(0, (spanBottom - spanTop - stack) / 2));
  const subY = round2(y + titleZone.h + gap);
  if (subY >= sub.y - 1) return null;
  const shift = y - t.y;
  return {
    titleZone: { ...titleZone, y },
    zone: { ...sub, y: subY, h: round2(Math.max(subH + 2, sub.y + sub.h - subY)) },
    chrome: chrome.map(d => (d.follow === 'subtitle' ? { ...d, y: round2(d.y + subY - sub.y) }
      : anchoredAbove(d, t) ? { ...d, y: round2(d.y + shift) } : d)),
  };
}

/* Rótulo acima do título (parte 5) ------------------------------------------- */

/**
 * Adorno do eyebrow no modo livre: logo acima das linhas do título (a âncora
 * da família decide onde elas começam), alinhado ao texto, 24 px em caixa
 * alta, na primeira cor que lê sobre a superfície do título.
 */
function eyebrowDevice({ title, anchor = 'start', surface, inks, measure, devices = [] }) {
  if (!title || !(title.w > 1) || !surface) return null;
  // Altura das linhas do título, sem a folga de respiro da zona.
  const titlePx = titlePxOf(measure.titleSize);
  const lines = freeTextLines(String(measure.slide?.title || ''), 1920 * title.w / 100 - 24, titlePx, measure.display.family, 'display',
    { trackingEm: (measure.display.tracking || 0) / 100, upper: measure.display.case === 'upper' });
  const needed = Math.min(title.h, (lines * titlePx * measure.titleLeading) / 1080 * 100 + 1.5);
  const top = anchor === 'end' ? title.y + title.h - needed : anchor === 'center' ? title.y + (title.h - needed) / 2 : title.y;
  // Fio ou barra da família que abre o título: o rótulo fica acima dele.
  const opener = devices.filter(d => ['rule', 'block'].includes(d.t) && d.w < 99 && d.h < 3 && d.y < top + 0.5 && d.y > top - 7
    && d.x < title.x + title.w && d.x + d.w > title.x).sort((a, b) => a.y - b.y)[0];
  const y = opener ? opener.y - 3.4 : top - 4.2;
  return {
    t: 'text', x: round2(title.x + TEXT_INSET), y: round2(Math.max(2, y)), w: round2(Math.max(10, title.w - 2 * TEXT_INSET)),
    // Por cima da foto cheia (texto sobre o lado reservado), como o título.
    text: '{kicker}', role: 'label', size: 24, weight: 700, tracking: 12, case: 'upper', color: readable(surface, inks), z: 'over',
  };
}

/* Arte de fundo (parte 4) ---------------------------------------------------- */

const ART_TEXT_KEYS = ['title', 'subtitle', 'evidence'];
const supportCopy = slide => `${slide?.subtitle || ''}${slide?.bodyAfterImage || ''}`.replace(/\*\*/g, '').trim();
/** Largura mínima do quadro de dados (auditoria de layout). */
const EVIDENCE_MIN_W = 50;
const ART_IMAGE_FIELDS = ['presentationArtImageId', 'presentationArtImage', 'presentationArtImageAssetId'];

/**
 * Página com arte de fundo: o grafismo ocupa a borda direita (a partir de
 * ~78%), então o texto da família vai para o lado liso. As zonas de texto e os
 * adornos são comprimidos na horizontal, da margem esquerda da família até
 * 72% da largura, mantendo a mesma geometria (proporções, alinhamento e
 * ordem). O que já cabe fica igual.
 */
export function compressForArt(composed, slide = {}) {
  const zones = composed?.canvas?.zones || {};
  const texts = ART_TEXT_KEYS.map(key => zones[key]).filter(z => z && z.w > 1 && z.h > 1);
  if (!texts.length) return composed;
  const left = Math.min(...texts.map(z => z.x));
  const right = Math.max(...texts.map(z => z.x + z.w));
  if (right <= FREE_ART_TEXT_MAX) return { ...composed, presentationChrome: { ...composed.presentationChrome, chrome: clipToArtEdge(composed.presentationChrome?.chrome) } };
  const k = (FREE_ART_TEXT_MAX - left) / (right - left);
  const map = v => (v <= left ? v : round2(left + (v - left) * k));
  const span = (x, w) => { const x0 = map(x); return { x: x0, w: round2(Math.max(0, map(x + w) - x0)) }; };
  const nextZones = { ...zones };
  for (const key of ART_TEXT_KEYS) {
    const z = zones[key];
    if (z && z.w > 1 && z.h > 1) nextZones[key] = { ...z, ...span(z.x, z.w) };
  }
  // Página só com título e tabela: a tabela ocupa também a coluna do apoio,
  // da margem até 72%, para manter a largura de leitura do quadro.
  const ev = nextZones.evidence;
  const widened = !!ev && ev.w < EVIDENCE_MIN_W && !supportCopy(slide);
  if (widened) nextZones.evidence = { ...ev, x: left, w: round2(FREE_ART_TEXT_MAX - left) };
  const chrome = (composed.presentationChrome?.chrome || []).map((d) => {
    if (!Number.isFinite(d?.x) || d.t === 'grid') return d;
    if (Number.isFinite(d.w)) return { ...d, ...span(d.x, d.w) };
    return { ...d, x: map(d.x) };
  // O fio que separava o apoio (vazio) da tabela cruzaria a tabela alargada.
  }).filter(d => !(widened && d.follow === 'subtitle' && crosses(d, nextZones.evidence)));
  return {
    ...composed,
    canvas: { ...composed.canvas, zones: nextZones },
    presentationChrome: { ...composed.presentationChrome, chrome: clipToArtEdge(chrome) },
  };
}

/** Fios e blocos da família param no lado liso: nada cruza o grafismo da arte. */
function clipToArtEdge(chrome = []) {
  return (Array.isArray(chrome) ? chrome : []).flatMap((d) => {
    if (!['rule', 'block'].includes(d?.t) || !Number.isFinite(d.x) || !Number.isFinite(d.w)) return [d];
    if (d.x >= FREE_ART_TEXT_MAX) return [];
    return d.x + d.w > FREE_ART_TEXT_MAX ? [{ ...d, w: round2(FREE_ART_TEXT_MAX - d.x) }] : [d];
  });
}

/** Imagem de arte do deck já guardada no slide ou numa página anterior. */
function deckArtFields(slide, previous) {
  const carrier = [slide, ...[...(Array.isArray(previous) ? previous : [])].reverse()]
    .find(item => item && ART_IMAGE_FIELDS.some(key => item[key]));
  return carrier ? Object.fromEntries(ART_IMAGE_FIELDS.filter(key => carrier[key]).map(key => [key, carrier[key]])) : {};
}

/**
 * Proteção do texto sobre a arte, na cor base: cheia do lado do texto até
 * além de 72%, com a menor opacidade que garante 4,5:1 para todas as tintas
 * mesmo se o lado "liso" da imagem vier com o pior pixel (branco ou preto).
 */
export function artScrim(base, inks = []) {
  const tintas = inks.filter(Boolean);
  const surfaces = a => ['#FFFFFF', '#000000'].map(worst => mixHex(base, worst, a / 100));
  let opacity = 100;
  for (let a = 30; a <= 100; a += 1) {
    if (surfaces(a).every(surface => tintas.every(ink => wcagContrast(ink, surface) >= 4.5))) { opacity = a; break; }
  }
  // Superfície de pior caso para as conferências: a que menos contrasta com o título.
  const [white, black] = surfaces(opacity);
  const surface = !tintas.length || wcagContrast(tintas[0], white) <= wcagContrast(tintas[0], black) ? white : black;
  return { side: 'left', color: base, opacity, reach: FREE_ART_TEXT_MAX + 4, surface };
}

/**
 * Compõe a página no modo livre: geometria da família escolhida, fundo e
 * tinta pela paleta do deck, fontes do deck e foto no tamanho decidido.
 */
export function freePresentationCompositionOverrides(base, {
  slide = {}, stage = {}, index = 0, count = 1, previous = [], deckDesign = null,
} = {}) {
  const deck = resolveDeckDesign(deckDesign, slide, previous);
  const { design: directed, kind: chosenKind } = directFreeSlide({ slide, stage, index, count, previous, deckDesign: deck });
  const visual = hasVisual(slide);
  const layoutSlide = directed.photo === 'none' || !visual ? withoutVisual(slide) : slide;
  const family = directed.family;
  const kind = chosenKind || resolveFreeKind({ family, photo: directed.photo, slide: layoutSlide, stage, index, count });
  const layout = contentAwarePresentationLayout(kind, layoutSlide, family);
  const photo = visual ? photoSizeOfLayout(layout) : 'none';
  const onPhoto = photo !== 'none' && textOnPhoto(layout);
  const ground = onPhoto ? 'photo' : (directed.ground === 'photo' ? layout.ground : directed.ground);
  // Arte de fundo só em página sem foto; com foto, o fundo da família.
  const art = ground === 'art' && photo === 'none';
  const design = { ...directed, photo, ground: ground === 'art' && !art ? layout.ground : ground };
  const freeBase = { ...base, presentationFreeDesign: design };
  let composed = stage?.contentMode === 'pitch'
    ? pitchCompositionOverrides(freeBase, layoutSlide, kind)
    : contentAwarePresentationOverrides(freeBase, layoutSlide, kind, { deliveryMode: stage?.deliveryMode });
  // Foto cheia com texto num lado (direção de arte, parte 3): o lado do texto
  // alterna entre as páginas assim. O lado direito é o espelho da geometria
  // da família; nenhuma zona nova.
  if (onPhoto) {
    const natural = textOverPhoto(composed.canvas?.zones || {});
    const lastSide = [...(Array.isArray(previous) ? previous : [])].reverse()
      .find(item => item?.overlayMode === 'side' && ['left', 'right'].includes(item.overlaySide))?.overlaySide;
    if (natural?.mode === 'overlay' && natural.fullBleed && natural.side === 'left' && lastSide === 'left') {
      composed = {
        ...composed,
        canvas: { ...composed.canvas, zones: mirrorTextZones(composed.canvas.zones) },
        presentationChrome: { ...composed.presentationChrome, chrome: mirrorChrome(composed.presentationChrome?.chrome) },
      };
    }
  }

  if (art) composed = compressForArt(composed, layoutSlide);

  const palette = freePaletteOverrides(deck);
  // A arte é a cor base (bg) com o grafismo na borda direita: tintas e adornos do fundo claro/base.
  const chromeGround = onPhoto ? layout.ground : art ? 'bg' : design.ground;
  const inks = onPhoto
    ? { bg: palette.inverse, ink: readable('#111111', [palette.inverseInk, palette.bg, '#FFFFFF']), muted: readable('#111111', [palette.inverseMuted, palette.inverseInk, '#F5F5F7']) }
    : groundInks(family, chromeGround, palette);
  // Texto sobre cartão da família lê contra o cartão.
  const zonesNow = composed.canvas?.zones || {};
  const panelColor = (zone) => {
    const panel = !onPhoto && textPanel(layout, zone);
    return panel ? resolveChromeColor(family, chromeGround, panel.color, palette) : null;
  };
  let surfaceTitle = panelColor(zonesNow.title) || (onPhoto ? '#111111' : inks.bg);
  let surfaceText = panelColor(zonesNow.subtitle) || (onPhoto ? '#111111' : inks.bg);
  let titleInk = readable(surfaceTitle, [inks.ink, palette.ink, palette.inverseInk]);
  const textInk = readable(surfaceText, [inks.ink, palette.ink, palette.inverseInk]);
  let mutedInk = readable(surfaceText, [inks.muted, palette.muted, palette.inverseMuted, textInk]);
  // Arte de fundo: proteção na cor base com 4,5:1 sobre o pior pixel do lado liso.
  const artProtection = art ? artScrim(palette.bg, [titleInk, textInk, mutedInk]) : null;
  if (artProtection) {
    surfaceTitle = artProtection.surface;
    surfaceText = artProtection.surface;
  }
  const display = freeFontSpec(deck.fonts.display, 'display');
  const text = freeFontSpec(deck.fonts.text, 'text');
  const fam = familySpec(family).fonts.display;
  // A família calibrou o corpo do título para a própria fonte; uma fonte do
  // deck mais larga começa proporcionalmente menor e passa pelo mesmo ajuste.
  const scale = Math.min(1, (fam.widthFactor || 0.55) / (display.widthFactor || 0.55));
  const zones = composed.canvas?.zones || {};
  // Coluna comprimida para o lado liso da arte: o título passa pelo mesmo ajuste.
  const fittedSize = (scale < 1 || art) && zones.title
    ? fittedTitleSize(Math.round(composed.titleSize * scale), slide.title, zones.title, display.css)
    : composed.titleSize;
  const titleCap = rendererTitleSizePercent(FREE_TITLE_MAX_PX[kind] || FREE_TITLE_MAX_PX.other);
  const titleSize = Math.min(fittedSize, titleCap);
  const typographyAll = composed.presentationTypographyByComposition || {};
  const typo = typographyAll[kind] || {};
  const photoZone = composed.presentationSuppressPhoto ? null : zones.photo;
  // Sem os adornos narrativos da família (CENA, FIG., §…): só o fólio do deck.
  const familyChrome = freeNeutralChrome(composed.presentationChrome?.chrome || []);
  // Cartão atrás do texto (Modular): o texto fica no cartão, que abraça o texto.
  const readingInput = { zones, chrome: familyChrome, slide: layoutSlide, titleSize, subSize: composed.subSize, display, text, kind,
    leading: (composed.subLeading || 150) / 100, titleLeading: familySpec(family).type.titleLeading || 1.05 };
  // Teste 6, item 3: foto cheia com texto num lado ganha o mesmo piso de
  // leitura das outras páginas (photoReading).
  const reading = onPhoto ? photoReading(readingInput)
    : hasBlocks(layoutSlide) ? blockReading(readingInput)
      : hasTextPanel(layout) ? panelReading(readingInput)
        : kind === 'closing' ? closingReading(readingInput) : compactReading(readingInput);
  const subSize = reading?.subSize ?? composed.subSize;
  // Texto sobre a foto num lado: proteção lateral na cor escura do deck (a da
  // direção visual que mais contrasta com a tinta), com 4,5:1 garantido sobre
  // o pior pixel da foto. A superfície de pior caso vale para as conferências.
  // Calculada depois da leitura, com as caixas finais do texto.
  let scrim = null;
  if (onPhoto) {
    const vd = resolveSlideVisualDirection({ slide: { ...slide, presentationPresetId: FREE_PRESENTATION_PRESET_ID, presentationDeckDesign: deck } });
    const readZones = reading ? { ...zonesNow, title: reading.titleZone, subtitle: reading.zone } : zonesNow;
    scrim = sideScrim({ zones: readZones, inks: [titleInk, textInk], colours: [reservedAreaColour(vd, titleInk), palette.inverse, palette.bg] });
    if (scrim) {
      surfaceTitle = scrim.surface;
      surfaceText = scrim.surface;
      mutedInk = inkOver(scrim.surface, mutedInk, textInk);
    }
  }
  // Título que entrou no cartão (Modular ao lado da foto) lê contra o cartão.
  if (reading?.titlePanel) {
    surfaceTitle = resolveChromeColor(family, chromeGround, reading.titlePanel.color, palette);
    titleInk = readable(surfaceTitle, [inks.ink, palette.ink, palette.inverseInk]);
  }
  // Sobre a arte, o adorno lê contra a superfície de pior caso do lado liso;
  // texto de adorno sobre o grafismo (borda direita) sai.
  const deckColors = Object.values(deck.palette);
  const devices = freeChromeDevices(reading ? reading.chrome : familyChrome, art
    ? { family, ground: chromeGround, palette: { ...palette, bg: artProtection.surface }, photoZone: { x: FREE_ART_TEXT_MAX, y: 0, w: 100 - FREE_ART_TEXT_MAX, h: 100 }, deckColors }
    : { family, ground: chromeGround, palette, photoZone, deckColors });
  // Rótulo acima do título (eyebrow, parte 5): no modo livre toda página tem
  // lugar para ele, logo acima da primeira linha do título, na cor de destaque
  // que lê sobre o que fica atrás (4,5:1); sem rótulo no slide, nada aparece.
  const chrome = devices.some(d => String(d.text || '').includes('{kicker'))
    ? devices
    : [...devices, eyebrowDevice({
      title: reading?.titleZone || zones.title, anchor: layout.anchors?.title, surface: surfaceTitle,
      inks: [palette.accent, palette.accent2, titleInk], measure: { slide, titleSize, display, titleLeading: familySpec(family).type.titleLeading || 1.05 }, devices,
    })].filter(Boolean);
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
      chrome,
      fonts: { display, text },
    },
    ...(reading ? { canvas: { ...composed.canvas, zones: { ...zones, title: reading.titleZone, subtitle: reading.zone, ...(reading.evidence ? { evidence: reading.evidence } : {}) } } } : {}),
    // Âncora da citação e do número grande na zona de dados (início ou fim).
    presentationBlockAnchor: reading?.anchor || undefined,
    subSize,
    presentationNumericTypography: { fontFamily: display.css, weight: display.weight },
    customBg: inks.bg,
    titleColor: titleInk,
    subtitleColor: textInk,
    textColor: mutedInk,
    presentationFreeTextSurfaces: { title: surfaceTitle, subtitle: surfaceText },
    ...(scrim ? { overlay: scrim.overlay, overlayMode: scrim.overlayMode, overlaySide: scrim.overlaySide, overlayReach: scrim.overlayReach, overlayColor: scrim.overlayColor } : {}),
    ...(artProtection ? {
      presentationArtScrim: { side: artProtection.side, color: artProtection.color, opacity: artProtection.opacity, reach: artProtection.reach },
      ...deckArtFields(slide, previous),
    } : {}),
    presentationPhotoTreatment: FREE_PHOTO_TREATMENT,
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
        subtitle: { ...typo.subtitle, fontFamily: text.css, weight: Math.max(400, text.weight || 400), tracking: 1 + (text.tracking || 0), sizePercent: subSize },
      },
    },
  };
}

/** Campos que só existem no modo livre; saem quando o deck volta a um preset comum. */
export const FREE_SLIDE_FIELDS = Object.freeze([
  'presentationFreeDesign', 'presentationDeckDesign', 'presentationPaletteOverrides',
  'presentationNumericTypography', 'presentationFreeTextSurfaces', 'customBg', 'titleColor', 'subtitleColor', 'textColor',
  'titleWeight', 'titleCase', 'presentationBlockAnchor', 'presentationArtScrim',
]);

/** Slide composto no modo livre volta ao estado neutro antes de outro preset. */
export function stripFreeSlideFields(slide) {
  if (!slide?.presentationFreeDesign) return slide;
  const out = { ...slide };
  for (const key of FREE_SLIDE_FIELDS) delete out[key];
  // Tabela de pares do modo livre (até 7 linhas): no preset comum vale o
  // teto de 5; os pares que sobram voltam ao apoio.
  const block = Array.isArray(out.presentationBlocks) ? out.presentationBlocks[0] : null;
  if (block?.type === 'comparison' && block.variant === 'pairs') {
    const { variant, ...plain } = block;
    const rows = Array.isArray(block.rows) ? block.rows : [];
    const extra = rows.slice(5).map(row => `${row[0]} ${row[1]}`).join(' ');
    out.presentationBlocks = [{ ...plain, rows: rows.slice(0, 5) }];
    if (extra) out.subtitle = [extra, String(out.subtitle || '').trim()].filter(Boolean).join(' ');
  }
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
/* Negrito proposto (emphasis) e direção de foto do deck                     */
/* ------------------------------------------------------------------------ */

/**
 * Marca cada trecho com `**…**` (parser de text-spans.js) na primeira vez que
 * ele aparece, sem diferença de caixa. Trecho que já está em negrito, ou que
 * cai dentro de um negrito, fica como está: nunca duplica marcador.
 */
export function applyFreeEmphasis(text, phrases = []) {
  let out = String(text ?? '');
  for (const raw of Array.isArray(phrases) ? phrases : []) {
    const phrase = String(raw ?? '').replace(/\*\*/g, '').trim();
    if (!phrase) continue;
    const lower = out.toLowerCase();
    const wanted = phrase.toLowerCase();
    const at = lower.indexOf(wanted);
    if (at < 0) continue;
    const end = at + phrase.length;
    // Já em negrito (inteiro ou em parte): o destaque existe, não duplica.
    if (markdownBoldAccentIntervalsUtf16(out).some(([lo, hi]) => at < hi + 2 && end > lo - 2)) continue;
    out = `${out.slice(0, at)}**${out.slice(at, end)}**${out.slice(end)}`;
  }
  return out;
}

const EMPHASIS_FIELDS = ['title', 'subtitle', 'bodyAfterImage'];

/**
 * Aplica os trechos de negrito do roteiro v3 (presentationPlan.design.emphasis)
 * no texto final de cada slide: cada trecho uma vez, no primeiro campo que o
 * contém. Slide sem trecho volta igual (mesma referência).
 */
export function applyPlanEmphasisToDraft(draft) {
  if (!Array.isArray(draft?.slides)) return draft;
  let changed = false;
  const slides = draft.slides.map((slide) => {
    const phrases = slide?.presentationPlan?.design?.emphasis;
    if (!Array.isArray(phrases) || !phrases.length) return slide;
    const next = { ...slide };
    for (const phrase of phrases) {
      const field = EMPHASIS_FIELDS.find(key => typeof next[key] === 'string' && next[key].toLowerCase().includes(String(phrase || '').replace(/\*\*/g, '').trim().toLowerCase()));
      if (field) next[field] = applyFreeEmphasis(next[field], [phrase]);
    }
    if (EMPHASIS_FIELDS.every(key => next[key] === slide[key])) return slide;
    changed = true;
    return next;
  });
  return changed ? { ...draft, slides } : draft;
}

const FREE_PHOTO_MOOD_MAX = 200;
/**
 * Direção de foto do deck no modo livre (spec, Renderização): o clima e a
 * paleta do deck, no lugar da luz de uma família. Curta, para caber no
 * orçamento do pedido de imagem como o tratamento das famílias.
 */
export function freePhotoDirectionEnglish(deckDesign) {
  const d = normalizeDeckDesign(deckDesign);
  const mood = d.mood.length > FREE_PHOTO_MOOD_MAX ? `${d.mood.slice(0, FREE_PHOTO_MOOD_MAX).replace(/\s+\S*$/, '')}.` : d.mood;
  const p = d.palette;
  return `Deck photo mood: ${mood.replace(/[.\s]+$/, '')}. Keep the colours in harmony with the deck palette (background ${p.bg}, accent ${p.accent}, secondary ${p.accent2}, dark ${p.inverse}), one consistent look for every photo.`;
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
    const page = d.ground === 'photo' ? '#111111' : s.customBg;
    for (const key of ['titleColor', 'subtitleColor', 'textColor']) {
      const surface = s.presentationFreeTextSurfaces?.[key === 'titleColor' ? 'title' : 'subtitle'] || page;
      if (!s[key] || !surface || wcagContrast(s[key], surface) < 4.5) out.push({ code: 'free_contrast', slideIndex: i, field: key });
    }
  });
  const withDesign = list.filter(s => s.presentationFreeDesign);
  // Arte de fundo (parte 4): até 3 páginas por deck.
  if (withDesign.filter(s => s.presentationFreeDesign.ground === 'art').length > FREE_ART_MAX_SLIDES) out.push({ code: 'free_art_limit', slideIndex: null });
  if (withDesign.length >= 6) {
    // Superfície que quase não se distingue do fundo conta como o mesmo fundo.
    const groundOf = (s) => {
      const g = s.presentationFreeDesign.ground;
      const p = s.presentationPaletteOverrides;
      return g === 'surface' && p?.bg && p?.surface && wcagContrast(p.bg, p.surface) < FREE_SURFACE_MIN_CONTRAST ? 'bg' : g;
    };
    if (new Set(withDesign.map(groundOf)).size < 3) out.push({ code: 'free_grounds_variety', slideIndex: null });
    const visualPages = withDesign.filter(s => hasVisual(s)).length;
    if (visualPages >= 3 && new Set(withDesign.map(s => s.presentationFreeDesign.photo)).size < 3) out.push({ code: 'free_photo_variety', slideIndex: null });
  }
  return out;
}

export const FREE_FAMILY_LABELS = Object.freeze(Object.fromEntries(FAMILY_KEYS.map(key => [key, PRESENTATION_FAMILIES[key].label])));
