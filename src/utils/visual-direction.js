/**
 * Direção visual do deck (docs/product/direcao-de-arte-imagens.md, parte 1).
 *
 * O deck da Apoteose feito no ChatGPT era consistente porque toda imagem saía
 * do mesmo texto-base: cada cor com um papel e um hex (índigo #171344 de base,
 * laranja #FF6A1A como luz sobre as pessoas, magenta #B41275 nas sombras,
 * ciano #27DDE5 nos grafismos, verde #60EC2E em acentos), mais acabamento,
 * atmosfera e exclusões. No Moont cada slide adivinhava a paleta.
 *
 * O roteiro (v2 e v3) traz `visualDirection` uma vez por deck. A IA propõe; o
 * código valida em listas fechadas e hex, dá prioridade às cores escritas no
 * kit e, no modo livre, alinha com `deckDesign.palette`. Plano sem
 * visualDirection (e fora do modo livre) gera o pedido de imagem de antes.
 */
import { explicitBrandColorsFromKit } from './style-kit-design.js';
import { wcagContrast } from './wcag.js';
import { kitReferencePalette, nearestPaletteHex, preferredReferenceBaseHex } from './reference-palette.js';

export const VISUAL_DIRECTION_ROLES = Object.freeze(['base', 'subject_light', 'shadow', 'graphic', 'accent']);
export const VISUAL_DIRECTION_TEXT_LIMITS = Object.freeze({ finish: 240, atmosphere: 200, graphics: 240, avoid: 240 });
export const VISUAL_DIRECTION_PALETTE_MIN = 3;
export const VISUAL_DIRECTION_PALETTE_MAX = 6;
const KEYS = Object.freeze(['palette', 'finish', 'atmosphere', 'graphics', 'avoid']);
const HEX6 = /^#[0-9A-F]{6}$/;
const FREE_PRESET = 'presentation_free';

const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);

/** '#abc' ou 'ABCDEF' → '#AABBCC'; outra coisa → null. */
export function visualHex(value) {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(value ?? '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  return `#${h.toUpperCase()}`;
}

/** Corta em fim de palavra, sem espaço sobrando. */
function clip(value, limit) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return (space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, '');
}

/**
 * Coerção da resposta da IA: hex normalizado, item fora do enum ou com hex
 * inválido sai, repetição exata sai, até 6 cores. Menos de 3 cores válidas
 * não é paleta: devolve null (o plano continua válido, sem direção visual).
 */
export function coerceVisualDirection(raw) {
  if (!isObject(raw) || !Array.isArray(raw.palette)) return null;
  const seen = new Set();
  const palette = [];
  for (const item of raw.palette) {
    if (!isObject(item)) continue;
    const role = String(item.role || '').trim();
    const hex = visualHex(item.hex);
    if (!VISUAL_DIRECTION_ROLES.includes(role) || !hex || seen.has(`${role}${hex}`)) continue;
    seen.add(`${role}${hex}`);
    palette.push({ role, hex });
  }
  if (palette.length < VISUAL_DIRECTION_PALETTE_MIN) return null;
  const graphics = clip(raw.graphics, VISUAL_DIRECTION_TEXT_LIMITS.graphics);
  return {
    palette: palette.slice(0, VISUAL_DIRECTION_PALETTE_MAX),
    finish: clip(raw.finish, VISUAL_DIRECTION_TEXT_LIMITS.finish),
    atmosphere: clip(raw.atmosphere, VISUAL_DIRECTION_TEXT_LIMITS.atmosphere),
    graphics: /^none\.?$/i.test(graphics) ? 'none' : graphics,
    avoid: clip(raw.avoid, VISUAL_DIRECTION_TEXT_LIMITS.avoid),
  };
}

/** Validação estrita do contrato (depois do coerce): chaves, enums, hex e tamanhos. */
export function isValidVisualDirection(value) {
  if (!isObject(value) || Object.keys(value).some(key => !KEYS.includes(key))) return false;
  if (!Array.isArray(value.palette) || value.palette.length < VISUAL_DIRECTION_PALETTE_MIN || value.palette.length > VISUAL_DIRECTION_PALETTE_MAX) return false;
  if (!value.palette.every(item => isObject(item) && Object.keys(item).every(key => ['role', 'hex'].includes(key))
    && VISUAL_DIRECTION_ROLES.includes(item.role) && HEX6.test(String(item.hex)))) return false;
  return Object.entries(VISUAL_DIRECTION_TEXT_LIMITS).every(([key, limit]) => value[key] === undefined
    || (typeof value[key] === 'string' && value[key].length <= limit));
}

/* ------------------------------------------------------------------------ */
/* Kit: as cores escritas no kit têm prioridade                             */
/* ------------------------------------------------------------------------ */

/**
 * Cores escritas no kit (estilo e brief). `base` e `accent` vêm das cores
 * rotuladas (fundo, destaque), a mesma leitura que já fixa a marca do deck;
 * `colors` são todos os hex, na ordem em que aparecem.
 */
export function kitVisualColors(kit) {
  const text = `${kit?.contextMd || ''}\n${kit?.stylePrompt || ''}`;
  const colors = [...new Set([...text.matchAll(/#([0-9a-fA-F]{6})\b/g)].map(match => `#${match[1].toUpperCase()}`))];
  const labeled = explicitBrandColorsFromKit(kit || {});
  return { base: visualHex(labeled.bg) || null, accent: visualHex(labeled.accent) || null, colors };
}

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const distance = (a, b) => rgb(a).reduce((sum, c, i) => sum + (c - rgb(b)[i]) ** 2, 0);

/**
 * O código sobrepõe a proposta com as cores do kit. Base e destaque rotulados
 * no kit valem para os papéis base e accent. Kit com paleta (3 cores ou mais)
 * substitui cada papel pela cor do kit mais próxima, sem repetir cor enquanto
 * houver cor livre. Kit com 1 ou 2 cores não é paleta: os outros papéis ficam.
 */
export function applyKitColors(visualDirection, kit) {
  if (!visualDirection) return visualDirection;
  const { base, accent, colors } = kitVisualColors(kit);
  if (!colors.length) return visualDirection;
  const used = new Set([base, accent].filter(Boolean));
  const free = colors.filter(color => !used.has(color));
  const palette = visualDirection.palette.map((item) => {
    if (item.role === 'base' && base) return { ...item, hex: base };
    if (item.role === 'accent' && accent) return { ...item, hex: accent };
    if (colors.length < 3) return item;
    const pool = free.length ? free : colors;
    const nearest = pool.reduce((best, color) => (distance(color, item.hex) < distance(best, item.hex) ? color : best), pool[0]);
    const at = free.indexOf(nearest);
    if (at >= 0) free.splice(at, 1);
    return { ...item, hex: nearest };
  });
  if (base && !palette.some(item => item.role === 'base') && palette.length < VISUAL_DIRECTION_PALETTE_MAX) palette.unshift({ role: 'base', hex: base });
  return { ...visualDirection, palette, paletteSource: 'kit' };
}

/* ------------------------------------------------------------------------ */
/* Referência: as cores extraídas da imagem do kit (Teste 6, item 1)        */
/* ------------------------------------------------------------------------ */

/**
 * Hex da direção visual que não está na lista (cores da referência mais as
 * escritas no kit) vira o mais próximo dela. A IA só distribui os papéis.
 * Sem lista: o valor volta igual (comportamento de antes).
 */
export function snapVisualDirectionToPalette(visualDirection, allowed = [], { source = 'reference', explicitBase } = {}) {
  const pool = (Array.isArray(allowed) ? allowed : []).map(c => visualHex(c?.hex || c)).filter(Boolean);
  if (!visualDirection || !Array.isArray(visualDirection.palette) || !pool.length) return visualDirection;
  // Cores diferentes na proposta ficam diferentes na lista enquanto houver
  // cor livre (a sombra quase preta não vira a própria base); a mesma cor
  // repetida pela IA continua repetida.
  const mapped = new Map();
  const rawBase = visualHex(visualDirection.palette.find(item => item.role === 'base')?.hex);
  const snappedBase = rawBase ? nearestPaletteHex(rawBase, pool) : null;
  const preferredBase = snappedBase ? preferredReferenceBaseHex(snappedBase, allowed, { explicitBase }) : null;
  const changedBase = preferredBase && preferredBase !== snappedBase;
  if (changedBase) mapped.set(rawBase, preferredBase);
  for (const item of visualDirection.palette) {
    const hex = visualHex(item.hex);
    if (!hex || mapped.has(hex)) continue;
    const used = new Set(mapped.values());
    const free = pool.filter(c => !used.has(c));
    mapped.set(hex, pool.includes(hex) && !(changedBase && used.has(hex)) ? hex : nearestPaletteHex(hex, free.length ? free : pool));
  }
  const seen = new Set();
  const palette = visualDirection.palette.map(item => ({ ...item, hex: mapped.get(visualHex(item.hex)) || nearestPaletteHex(item.hex, pool) }))
    .filter(item => !seen.has(`${item.role}${item.hex}`) && seen.add(`${item.role}${item.hex}`));
  return { ...visualDirection, palette, paletteSource: visualDirection.paletteSource === 'kit' ? 'kit' : source };
}

/* ------------------------------------------------------------------------ */
/* Modo livre: a paleta da imagem combina com a do deck                     */
/* ------------------------------------------------------------------------ */

const deckPalette = deck => (isObject(deck?.palette) ? deck.palette : {});
const luminance = hex => wcagContrast(hex, '#000000');

/** Sem visualDirection no roteiro v3: base = bg, luz = accent, grafismo = accent2, sombra = o tom mais escuro restante. */
export function visualDirectionFromDeckDesign(deck) {
  const p = deckPalette(deck);
  const bg = visualHex(p.bg);
  if (!bg) return null;
  const shadow = [p.inverse, p.ink, p.surface].map(visualHex).filter(hex => hex && hex !== bg)
    .sort((a, b) => luminance(a) - luminance(b))[0];
  const palette = [
    { role: 'base', hex: bg },
    visualHex(p.accent) ? { role: 'subject_light', hex: visualHex(p.accent) } : null,
    visualHex(p.accent2) ? { role: 'graphic', hex: visualHex(p.accent2) } : null,
    shadow ? { role: 'shadow', hex: shadow } : null,
  ].filter(Boolean);
  return {
    palette, finish: '', atmosphere: clip(deck?.mood, VISUAL_DIRECTION_TEXT_LIMITS.atmosphere), graphics: '', avoid: '',
    paletteSource: 'deck',
  };
}

/** Com visualDirection no roteiro v3: base e accent seguem o deck; os outros papéis ficam. */
export function alignVisualDirectionWithDeck(visualDirection, deck) {
  if (!visualDirection) return visualDirectionFromDeckDesign(deck);
  const p = deckPalette(deck);
  const bg = visualHex(p.bg);
  const accent = visualHex(p.accent);
  const palette = visualDirection.palette.map(item => (item.role === 'base' && bg ? { ...item, hex: bg }
    : item.role === 'accent' && accent ? { ...item, hex: accent } : item));
  if (bg && !palette.some(item => item.role === 'base')) palette.unshift({ role: 'base', hex: bg });
  return { ...visualDirection, palette: palette.slice(0, VISUAL_DIRECTION_PALETTE_MAX) };
}

/**
 * Direção visual em vigor para a imagem do slide: a do roteiro (gravada no
 * slide por attachPresentationPlan), alinhada ao deck no modo livre e com as
 * cores do kit por cima. Sem roteiro com direção e fora do modo livre: null.
 */
export function resolveSlideVisualDirection({ slide = null, styleKit = null } = {}) {
  const raw = slide?.presentationPlan?.visualDirection;
  let value = raw ? coerceVisualDirection(raw) : null;
  if (value && raw?.paletteSource) value.paletteSource = raw.paletteSource;
  const free = slide?.presentationPresetId === FREE_PRESET && isObject(slide?.presentationDeckDesign);
  if (free) value = alignVisualDirectionWithDeck(value, slide.presentationDeckDesign);
  if (!value) return null;
  // Paleta extraída da referência e guardada no kit: vale também ao refazer
  // uma imagem depois. As cores escritas no kit continuam vencendo.
  const reference = kitReferencePalette(styleKit);
  const kitColors = kitVisualColors(styleKit);
  if (reference.length) value = snapVisualDirectionToPalette(value, [...reference, ...kitColors.colors], { explicitBase: kitColors.base });
  return applyKitColors(value, styleKit);
}

/* ------------------------------------------------------------------------ */
/* Bloco do pedido de imagem                                                */
/* ------------------------------------------------------------------------ */

const ROLE_LABELS = Object.freeze({
  base: 'base colour, the dominant field',
  subject_light: 'light on the subject',
  shadow: 'shadows',
  graphic: 'graphic interventions',
  accent: 'small accents',
});
const sentence = text => (/[.!?]$/.test(text) ? text : `${text}.`);

/**
 * VISUAL DIRECTION, primeiro bloco do pedido (método do ChatGPT): paleta com
 * papéis e hex, acabamento, atmosfera, grafismos e exclusões do deck.
 * Uma linha por item: no aperto do orçamento saem linhas inteiras, de baixo
 * para cima; a paleta nunca sai.
 */
export function composeVisualDirectionBlock(visualDirection, { referenceLook = false } = {}) {
  if (!visualDirection || !Array.isArray(visualDirection.palette) || !visualDirection.palette.length) return '';
  const palette = visualDirection.palette.map(item => `${ROLE_LABELS[item.role] || item.role} ${item.hex}`).join('; ');
  const graphics = visualDirection.graphics === 'none' ? 'no graphic interventions.' : visualDirection.graphics ? sentence(visualDirection.graphics) : '';
  // Ordem de corte no aperto: as linhas de baixo saem primeiro (a frase de
  // consistência antes das exclusões); cabeçalho e paleta nunca saem.
  return [
    'VISUAL DIRECTION (shared by every image of this deck):',
    `Palette: ${palette}.`,
    // A IA não vê a referência: se ela anexada mostrar outra cor, vale a dela.
    // Paleta que já saiu da referência (extraída pelo código) dispensa a frase.
    referenceLook && !['kit', 'reference'].includes(visualDirection.paletteSource) ? 'If the attached style reference has other colours, its colours win; keep these roles.' : '',
    visualDirection.finish ? `Finish: ${sentence(visualDirection.finish)}` : '',
    visualDirection.atmosphere ? `Atmosphere: ${sentence(visualDirection.atmosphere)}` : '',
    graphics ? `Graphics: ${graphics}` : '',
    visualDirection.avoid ? `Deck exclusions: ${sentence(visualDirection.avoid)}` : '',
    'Colour, light and finish stay; faces, scenes, wardrobe and framing vary.',
  ].filter(Boolean).join('\n');
}

/**
 * Cor da área reservada ao texto: a da paleta que mais contrasta com a tinta
 * do slide (a base escura sob texto claro, por exemplo). Sem tinta conhecida,
 * a base.
 */
export function reservedAreaColour(visualDirection, ink = '') {
  const palette = Array.isArray(visualDirection?.palette) ? visualDirection.palette : [];
  if (!palette.length) return '';
  const tinta = visualHex(ink);
  if (!tinta) return (palette.find(item => item.role === 'base') || palette[0]).hex;
  return palette.reduce((best, item) => (wcagContrast(tinta, item.hex) > wcagContrast(tinta, best.hex) ? item : best), palette[0]).hex;
}
