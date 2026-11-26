import { TITLE_FONTS } from './design-data.js';
import { BODY_FONTS } from './brand-visuals.js';
import { nearestPaletteHex, normalizeReferencePalette, rgbToLab } from './reference-palette.js';
import { wcagContrast } from './wcag.js';

// A IA escolhe apenas valores que o editor sabe representar, nunca CSS arbitrário.
export const PROJECT_DESIGN_SCHEMA = {
  layout: '', titleFont: '', bodyFont: '', titleCase: '', titleWeight: 400,
  bg: '', titleColor: '', subtitleColor: '', textColor: '', accent: '',
};

const COLOR_LABELS = [
  { re: /fundo|background|\bbg\b|grafite|graphite/i, key: 'bg' },
  { re: /acento|accent|rose|rosa|destaque/i, key: 'accent' },
  { re: /subt[ií]tulo/i, key: 'subtitleColor' },
  { re: /t[ií]tulo/i, key: 'titleColor' },
  { re: /texto|corpo/i, key: 'textColor' },
];

/** Cores escritas no brief. O gerador não pode trocá-las por creme ou cinza. */
export function explicitBrandColorsFromKit(kit) {
  const text = `${kit?.contextMd || ''}\n${kit?.stylePrompt || ''}`;
  const patch = {};
  const re = /([^\n#]{0,64})#([0-9a-fA-F]{6})\b/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const label = match[1] || '';
    const hex = `#${match[2]}`;
    const hit = COLOR_LABELS.find((item) => item.re.test(label));
    if (hit && !patch[hit.key]) patch[hit.key] = hex;
  }
  return patch;
}

export function buildProjectDesignInstructions(kit) {
  if (!kit?.contextMd?.trim() && !kit?.stylePrompt?.trim()) return '';
  const locked = explicitBrandColorsFromKit(kit);
  const lockedLine = Object.keys(locked).length
    ? ` Cores já definidas no brief e que devem ser copiadas exatamente: ${Object.entries(locked).map(([key, hex]) => `${key} ${hex}`).join(', ')}.`
    : '';
  return `IDENTIDADE EDITÁVEL DO PROJETO:
Preencha projectDesign a partir das regras explícitas do brief e estilo. Campo não especificado: string vazia (titleWeight: 0). Não deduza a identidade a partir do assunto, nem transforme cores de acento em filtros de imagem. Se o brief nomeia grafite, rose ou qualquer #RRGGBB, use esse valor. Não troque a paleta do brief por creme, cinza ou preto genérico.${lockedLine}
layout: fullbleed se o brief exigir imagem em toda a peça; classic se pedir foto em área separada; vazio se não especificado.
titleFont: nome exato entre ${TITLE_FONTS.map(f => f.name).join(', ')}.
bodyFont: nome exato entre ${BODY_FONTS.map(f => f.name).join(', ')}.
Se a fonte pedida não existir na lista, deixe vazio. titleCase: upper, lower ou normal. titleWeight: peso indicado, 100 a 900; Anton e Bebas Neue usam 400. Cores somente #RRGGBB. Não invente logo nem use nomes de arquivos como imagens. O editor aplicará esses valores apenas ao projeto atual.`;
}

export function projectDesignBrandPatch(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const patch = {};
  const title = TITLE_FONTS.find(f => f.name === raw.titleFont);
  const body = BODY_FONTS.find(f => f.name === raw.bodyFont);
  if (title) { patch.titleFont = title.val; patch.customTitleFont = null; }
  if (body) patch.bodyFont = body.val;
  if (['upper', 'lower', 'normal'].includes(raw.titleCase)) patch.textTitleCase = raw.titleCase;
  if (Number.isInteger(raw.titleWeight) && raw.titleWeight >= 100 && raw.titleWeight <= 900) patch.textTitleWeight = raw.titleWeight;
  if (title && ['Anton', 'Bebas Neue'].includes(title.name)) patch.textTitleWeight = 400;
  for (const key of ['bg', 'titleColor', 'subtitleColor', 'textColor', 'accent']) {
    if (typeof raw[key] === 'string' && /^#[0-9a-f]{6}$/i.test(raw[key])) patch[key] = raw[key];
  }
  return patch;
}

/** Fotos com overlay escuro precisam de texto claro; não altera a paleta salva. */
export function needsLightPhotoText(slide) {
  const fullPhoto = slide?.photoRegion == null || slide.photoRegion === 'full';
  const photo = slide?.canvas?.zones?.photo;
  const canvasFullPhoto = !photo || (photo.w >= 90 && photo.h >= 90);
  return !!slide?.bgImage && fullPhoto && canvasFullPhoto && !(slide?.useCultureLayout && String(slide.bodyAfterImage || '').trim()) && (slide.overlay ?? 0) >= 38;
}

/* Paleta da referência no desenho do projeto (carrossel, 26/11/2026) ------- */

const DESIGN_COLOR_KEYS = ['bg', 'titleColor', 'subtitleColor', 'textColor', 'accent'];
const HEX6_DESIGN = /^#[0-9a-f]{6}$/i;
const chroma = (hex) => {
  const [, a, b] = rgbToLab([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
  return Math.hypot(a, b);
};
const readableOn = (bg, pool, min) => pool.find((c) => c !== bg && wcagContrast(c, bg) >= min) || null;
const plainInk = (bg) => (wcagContrast('#111111', bg) >= wcagContrast('#FFFFFF', bg) ? '#111111' : '#FFFFFF');

/**
 * Desenho do projeto do carrossel com as cores da imagem de referência do kit
 * (extraídas no navegador, reference-palette.js). Mesma regra da apresentação
 * (snapPlanColorsToReference): cor que a IA do texto escreveu vai para a mais
 * próxima entre as escritas no kit e as da referência; cor que ela deixou
 * vazia sai da referência por papel (fundo = a mais pesada; título, apoio e
 * corpo = a primeira que lê 4,5:1 no fundo, senão preto ou branco; acento = a
 * mais saturada que lê 3:1). As cores escritas no kit continuam acima (o app
 * as aplica depois). Sem referência, devolve o desenho como veio.
 */
export function projectDesignWithReferencePalette(raw, referenceColors = [], { kitColors = [] } = {}) {
  const reference = normalizeReferencePalette(referenceColors).map((c) => c.hex);
  if (!reference.length) return raw;
  const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const kit = (Array.isArray(kitColors) ? kitColors : []).map((c) => String(c || '').toUpperCase()).filter((c) => HEX6_DESIGN.test(c));
  const allowed = [...new Set([...kit, ...reference])];
  const given = (key) => (typeof base[key] === 'string' && HEX6_DESIGN.test(base[key]) ? nearestPaletteHex(base[key], allowed) : '');
  const bg = given('bg') || reference[0];
  const others = reference.filter((c) => c !== bg);
  const ink = (key, fallback) => {
    const own = given(key);
    return own && wcagContrast(own, bg) >= 4.5 ? own : fallback;
  };
  const titleColor = ink('titleColor', readableOn(bg, others, 4.5) || plainInk(bg));
  const subtitleColor = ink('subtitleColor', titleColor);
  const textColor = ink('textColor', readableOn(bg, others.filter((c) => c !== titleColor), 4.5) || titleColor);
  const vivid = [...others].sort((a, b) => chroma(b) - chroma(a));
  const accent = given('accent') || readableOn(bg, vivid, 3) || titleColor;
  const out = { ...base, bg, titleColor, subtitleColor, textColor, accent };
  for (const key of DESIGN_COLOR_KEYS) if (!HEX6_DESIGN.test(out[key])) delete out[key];
  return out;
}
