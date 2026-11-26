/**
 * A imagem conhece o layout (docs/product/direcao-de-arte-imagens.md, parte 3).
 *
 * No ChatGPT cada imagem nascia com o espaço do texto definido ("rosto nos
 * 48% à direita; os 50% à esquerda índigo escuro para tipografia"). No Moont
 * a imagem era gerada sem conhecer o layout e depois recortada. Aqui, a
 * partir da composição final do slide (zonas de título, apoio e evidência ×
 * zona da foto), o código calcula o lado e a fração do quadro da IMAGEM que
 * fica sob texto e escreve o bloco COMPOSITION do pedido.
 *
 * A foto em tela cheia com texto sobre o espaço reservado usa as geometrias
 * que as famílias já têm (Cinemático e Fotográfico): só a proteção muda, de
 * um véu de baixo para cima para uma proteção lateral na cor da base, com o
 * mínimo de opacidade que garante 4,5:1 mesmo sobre o pior pixel (branco ou
 * preto) da foto. Nenhuma zona nova: o lado direito é o espelho da mesma
 * geometria, usado no modo livre para alternar o lado do texto.
 */
import { wcagContrast } from './wcag.js';
import { reservedAreaColour, visualHex } from './visual-direction.js';

const TEXT_KEYS = Object.freeze(['title', 'subtitle', 'evidence']);
const validZone = z => !!z && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(z[k])) && z.w > 0 && z.h > 0;
const isFullBleed = z => z.w >= 92 && z.h >= 89;
const round2 = value => Math.round(value * 100) / 100;

function intersect(a, b) {
  const x0 = Math.max(a.x, b.x); const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w); const y1 = Math.min(a.y + a.h, b.y + b.h);
  return x1 - x0 > 0.5 && y1 - y0 > 0.5 ? { x0, y0, x1, y1 } : null;
}

/**
 * Onde o texto fica em relação à foto, nas coordenadas do quadro da imagem
 * (0–100 dentro da zona da foto). Sem texto sobre a foto: painel. Com texto:
 * o lado (left, right, bottom, top ou center), a fração reservada e, nas
 * laterais, se o texto fica na metade de baixo ou de cima.
 */
export function textOverPhoto(zones = {}) {
  const p = zones.photo;
  if (!validZone(p) || p.w < 10 || p.h < 10) return null;
  const fullBleed = isFullBleed(p);
  const parts = TEXT_KEYS.map(key => zones[key]).filter(validZone).map(zone => intersect(zone, p)).filter(Boolean);
  if (!parts.length) {
    return { mode: 'panel', panelSide: p.x + p.w / 2 < 50 ? 'left' : 'right', width: Math.round(p.w), height: Math.round(p.h), fullBleed };
  }
  const nx = v => ((v - p.x) / p.w) * 100;
  const ny = v => ((v - p.y) / p.h) * 100;
  const x0 = nx(Math.min(...parts.map(r => r.x0))); const x1 = nx(Math.max(...parts.map(r => r.x1)));
  const y0 = ny(Math.min(...parts.map(r => r.y0))); const y1 = ny(Math.max(...parts.map(r => r.y1)));
  const vertical = y0 >= 35 ? 'lower' : y1 <= 65 ? 'upper' : '';
  if (x0 <= 20 && x1 <= 75) return { mode: 'overlay', side: 'left', reserve: Math.ceil(x1 - 0.01), vertical, fullBleed };
  if (x1 >= 80 && x0 >= 25) return { mode: 'overlay', side: 'right', reserve: Math.ceil(100 - x0 - 0.01), vertical, fullBleed };
  if (y0 >= 35) return { mode: 'overlay', side: 'bottom', reserve: Math.ceil(100 - y0 - 0.01), vertical: '', fullBleed };
  if (y1 <= 65) return { mode: 'overlay', side: 'top', reserve: Math.ceil(y1 - 0.01), vertical: '', fullBleed };
  return { mode: 'overlay', side: 'center', reserve: 0, vertical: '', fullBleed };
}

/** Geometria texto × foto de um slide composto; null sem foto ou fora da composição versionada. */
export function photoTextGeometry(slide) {
  if (!slide || ![2, 3].includes(slide.presentationCompositionVersion) || slide.presentationSuppressPhoto) return null;
  return textOverPhoto(slide.canvas?.zones || {});
}

/**
 * Lado do texto espelhado (mesma geometria da família, do outro lado). O
 * bloco de texto se move inteiro: título e apoio continuam alinhados pela
 * esquerda entre si (espelhar zona a zona desalinhava as caixas de larguras
 * diferentes). A foto cheia não muda.
 */
export function mirrorTextZones(zones = {}) {
  const texts = TEXT_KEYS.filter(key => validZone(zones[key]));
  if (!texts.length) return { ...zones };
  const left = Math.min(...texts.map(key => zones[key].x));
  const right = Math.max(...texts.map(key => zones[key].x + zones[key].w));
  const dx = (100 - right) - left;
  const out = { ...zones };
  for (const key of texts) out[key] = { ...zones[key], x: round2(zones[key].x + dx) };
  return out;
}

/** Adornos da página espelhados junto com o texto. */
export function mirrorChrome(chrome = []) {
  return (Array.isArray(chrome) ? chrome : []).map((d) => {
    if (!Number.isFinite(d?.x)) return d;
    const width = Number.isFinite(d.w) ? d.w : Number.isFinite(d.d) ? d.d : 0;
    const align = d.align === 'left' ? 'right' : d.align === 'right' ? 'left' : d.align;
    return { ...d, x: round2(100 - d.x - width), ...(align ? { align } : {}) };
  });
}

/* ------------------------------------------------------------------------ */
/* Bloco COMPOSITION do pedido de imagem                                    */
/* ------------------------------------------------------------------------ */

const OPPOSITE = Object.freeze({ left: 'right', right: 'left', bottom: 'top', top: 'bottom' });
const isLightInk = hex => wcagContrast(hex, '#000000') >= wcagContrast(hex, '#FFFFFF');

/**
 * COMPOSITION: o espaço do texto no quadro da imagem.
 * - foto sob texto (tela cheia ou painel que recebe texto): lado e fração
 *   reservados, escuros (ou claros) e calmos na cor da paleta que contrasta
 *   com a tinta do slide; o assunto na fração restante; grafismos na borda
 *   oposta ao texto;
 * - painel lateral sem texto por cima: preencher o painel com o assunto,
 *   respeitando o recorte, voltado para o lado do texto;
 * - sem foto: '' (nenhuma imagem é pedida).
 */
export function composeCompositionBlock(slide, { visualDirection = null, shot = '' } = {}) {
  const g = photoTextGeometry(slide);
  if (!g) return '';
  const plano = String(shot || '').replace(/\s+/g, ' ').trim();
  const shotLine = plano ? `Shot: ${plano.replace(/[.\s]+$/, '')}. ` : '';
  if (g.mode === 'panel') {
    const size = `about ${g.width}% of its width${g.height < 95 ? `, ${g.height}% of its height` : ''}`;
    return `COMPOSITION (layout of this slide): ${shotLine}This image fills a panel on the ${g.panelSide} of the slide (${size}); the text sits beside it, not over it. Fill the frame with the subject and the scene, with no empty area for type; keep faces and key details clear of the edges so the crop keeps them. Let the subject face or open toward the ${OPPOSITE[g.panelSide]}, where the text is.`;
  }
  const ink = visualHex(slide.titleColor);
  const tone = !ink || isLightInk(ink) ? 'dark' : 'light';
  const colour = slide.overlayMode === 'side' && visualHex(slide.overlayColor) ? visualHex(slide.overlayColor) : reservedAreaColour(visualDirection, ink || '#FFFFFF');
  const where = g.side === 'center' ? 'the centre of the frame'
    : `the ${g.side} ${g.reserve}% of the frame${g.vertical ? `, mostly in its ${g.vertical} half` : ''}`;
  const subject = g.side === 'center' ? 'around that area, toward the frame edges'
    : `within the ${['left', 'right'].includes(g.side) ? OPPOSITE[g.side] : g.side === 'bottom' ? 'upper' : 'lower'} ${100 - g.reserve}%`;
  const graphics = visualDirection?.graphics && visualDirection.graphics !== 'none' && g.side !== 'center'
    ? ` Let graphics sit near the ${OPPOSITE[g.side]} edge, away from the type.` : '';
  return `COMPOSITION (space for the slide text): ${shotLine}Type is laid over ${where}. Keep that area ${tone} and quiet${colour ? ` in ${colour}` : ''}, with low detail and no faces, hands or key details in it. Place the subject ${subject}.${graphics}`;
}

/* ------------------------------------------------------------------------ */
/* Proteção lateral do texto sobre a foto                                   */
/* ------------------------------------------------------------------------ */

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
/** Mistura `a` sobre `b` com opacidade t (a mesma conta do navegador em sRGB). */
function mix(a, b, t) {
  const A = rgb(a); const B = rgb(b);
  return `#${A.map((c, i) => Math.round(c * t + B[i] * (1 - t)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Tinta que lê sobre a superfície (≥ 4,5): a própria, ou a mínima mistura rumo à tinta principal. */
export function inkOver(surface, ink, toward) {
  const base = visualHex(ink); const target = visualHex(toward) || base;
  if (!base) return ink;
  if (wcagContrast(base, surface) >= 4.5) return base;
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c = mix(target, base, Math.min(1, t));
    if (wcagContrast(c, surface) >= 4.5) return c;
  }
  return isLightInk(base) ? '#FFFFFF' : '#000000';
}

/**
 * Proteção lateral para a foto em tela cheia com texto num lado: cor (a da
 * paleta que contrasta ≥ 7:1 com as tintas, senão preto ou branco), lado,
 * alcance e a menor opacidade que garante 4,5:1 sobre o pior pixel possível
 * da foto. `surface` é essa superfície de pior caso, para as conferências.
 * Texto que não fica numa lateral (faixa de baixo de ponta a ponta) ou foto
 * em painel: null (vale o que a família já fazia).
 */
export function sideScrim({ zones = {}, inks = [], colours = [] } = {}) {
  const p = zones.photo;
  if (!validZone(p) || !isFullBleed(p)) return null;
  const g = textOverPhoto(zones);
  if (!g || g.mode !== 'overlay' || !['left', 'right'].includes(g.side)) return null;
  const tintas = inks.map(visualHex).filter(Boolean);
  if (!tintas.length) return null;
  const light = tintas.every(isLightInk);
  const worst = light ? '#FFFFFF' : '#000000';
  const colour = colours.map(visualHex).find(c => c && tintas.every(ink => wcagContrast(ink, c) >= 7)) || (light ? '#000000' : '#FFFFFF');
  let overlay = 100;
  for (let a = 30; a <= 100; a += 1) {
    if (tintas.every(ink => wcagContrast(ink, mix(colour, worst, a / 100)) >= 4.5)) { overlay = a; break; }
  }
  return {
    overlay, overlayMode: 'side', overlaySide: g.side, overlayReach: Math.min(100, g.reserve + 2), overlayColor: colour,
    surface: mix(colour, worst, overlay / 100),
  };
}

/** Gradiente da proteção lateral: cheia do lado do texto até o alcance, some logo depois. */
export function sideScrimGradient(slide) {
  const colour = visualHex(slide?.overlayColor) || '#000000';
  const [r, g, b] = rgb(colour);
  const a = Math.max(0, Math.min(1, (Number(slide?.overlay) || 0) / 100));
  const reach = Math.max(10, Math.min(100, Number(slide?.overlayReach) || 60));
  const dir = slide?.overlaySide === 'right' ? 'to left' : 'to right';
  return `linear-gradient(${dir}, rgba(${r}, ${g}, ${b}, ${a}) 0%, rgba(${r}, ${g}, ${b}, ${a}) ${reach}%, rgba(${r}, ${g}, ${b}, 0) ${Math.min(100, reach + 18)}%)`;
}
