/**
 * Arte de fundo reaproveitada (docs/product/direcao-de-arte-imagens.md, parte 4).
 *
 * No deck da Apoteose feito no ChatGPT, os slides de posicionamento,
 * personalidade e fecho usavam o mesmo fundo abstrato da identidade: papel
 * índigo liso com grão fino e um único grafismo ciano/laranja na borda
 * direita. No Moont, a página sem foto ficava só com a cor sólida.
 *
 * Aqui: uma imagem abstrata por deck, sem pessoas, pedida UMA vez (1 crédito
 * de imagem) com a direção visual do deck e o bloco COMPOSITION reservando o
 * lado do texto. Ela fica guardada como as fotos (IndexedDB e nuvem) nos
 * slides com `ground: 'art'`; sem ela, a página fica na cor base.
 *
 * Módulo puro: sem React e sem DOM.
 */
import {
  FREE_ART_GRAPHIC_FROM, FREE_ART_TEXT_MAX, FREE_PRESENTATION_PRESET_ID, slideSkipsImageGeneration,
} from './free-design.js';
import {
  alignVisualDirectionWithDeck, composeVisualDirectionBlock, resolveSlideVisualDirection, visualHex,
} from './visual-direction.js';
import { composeImgExtraPrompt, normalizeStyleKit } from './style-kit.js';
import { wcagContrast } from './wcag.js';

/** Pedido de cena da arte (o mesmo texto vai em `sceneBrief.query`). */
export const DECK_ART_SCENE = 'Abstract identity background for this presentation deck, no people.';
export const DECK_ART_FIELDS = Object.freeze(['presentationArtImageId', 'presentationArtImage', 'presentationArtImageAssetId']);

const isArt = slide => slide?.presentationFreeDesign?.ground === 'art';
const hasArtImage = slide => DECK_ART_FIELDS.some(key => !!slide?.[key]);

/** Páginas do deck com fundo de arte. */
export function deckArtSlides(slides) {
  return (Array.isArray(slides) ? slides : []).filter(isArt);
}

/** O deck tem página de arte e ainda não tem a imagem: pede 1 imagem. */
export function deckNeedsArt(slides) {
  const art = deckArtSlides(slides);
  return art.length > 0 && !art.some(hasArtImage);
}

/**
 * Créditos de imagem de uma geração: uma foto por página que pede foto e 1
 * para a arte do deck inteiro (só quando ela ainda não existe). Página de
 * arte não tem foto, então o total nunca passa do número de slides.
 */
export function deckImageCredits(slides) {
  const list = Array.isArray(slides) ? slides : [];
  const photos = list.filter(slide => !slideSkipsImageGeneration(slide) && String(slide?.imageQuery || '').trim()).length;
  const art = deckNeedsArt(list) ? 1 : 0;
  return { photos, art, total: photos + art };
}

/**
 * Guarda a arte nas páginas de arte (o mesmo id em todas): `patch` traz
 * `presentationArtImageId` (IndexedDB) e `presentationArtImage` (prévia).
 * As outras páginas não mudam.
 */
export function applyDeckArt(slides, patch = {}) {
  const fields = Object.fromEntries(DECK_ART_FIELDS.filter(key => patch[key]).map(key => [key, patch[key]]));
  if (!Object.keys(fields).length) return slides;
  return (Array.isArray(slides) ? slides : []).map(slide => (isArt(slide) ? { ...slide, ...fields } : slide));
}

/** A página mostra a arte do deck (há imagem guardada e o fundo é de arte). */
export function slideShowsDeckArt(slide) {
  return isArt(slide) && hasArtImage(slide) && slide.presentationArtImageFailed !== true;
}

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

/**
 * Camada de fundo da página de arte: a imagem em tela cheia e a proteção na
 * cor base do lado do texto (opacidade calculada na composição para 4,5:1).
 * Sem imagem carregada: null, e a página fica na cor base.
 */
export function deckArtLayer(slide) {
  if (!isArt(slide) || typeof slide.presentationArtImage !== 'string' || !slide.presentationArtImage) return null;
  const scrim = slide.presentationArtScrim || {};
  const color = visualHex(scrim.color) || visualHex(slide.customBg) || '#000000';
  const [r, g, b] = rgb(color);
  const a = Math.max(0, Math.min(1, (Number(scrim.opacity) || 0) / 100));
  const reach = Math.max(10, Math.min(100, Number(scrim.reach) || FREE_ART_TEXT_MAX + 4));
  return {
    image: slide.presentationArtImage,
    gradient: `linear-gradient(to right, rgba(${r}, ${g}, ${b}, ${a}) 0%, rgba(${r}, ${g}, ${b}, ${a}) ${reach}%, rgba(${r}, ${g}, ${b}, 0) ${Math.min(100, reach + 10)}%)`,
  };
}

/* ------------------------------------------------------------------------ */
/* Pedido de imagem                                                         */
/* ------------------------------------------------------------------------ */

const isLightInk = hex => wcagContrast(hex, '#000000') >= wcagContrast(hex, '#FFFFFF');
const roleHex = (vd, role) => vd?.palette?.find(item => item.role === role)?.hex || '';

/** Direção visual em vigor para a arte: a do roteiro alinhada ao deck, com o kit por cima. */
function artVisualDirection(slide, styleKit) {
  const free = { ...slide, presentationPresetId: slide?.presentationPresetId || FREE_PRESENTATION_PRESET_ID };
  return resolveSlideVisualDirection({ slide: free, styleKit })
    || (slide?.presentationDeckDesign ? alignVisualDirectionWithDeck(null, slide.presentationDeckDesign) : null);
}

/**
 * Partes do pedido da arte para `shared/image-prompt.js` (o mesmo caminho das
 * fotos, com o mesmo orçamento): direção visual do deck, assunto abstrato sem
 * pessoas, COMPOSITION reservando o lado do texto, grafismo da direção visual
 * concentrado na borda direita e as restrições de sempre. A referência do kit,
 * quando enviada, vale só pelo visual.
 */
export function composeDeckArtImageDirection({ slides = [], styleKit = null, baseReferenceCount = 0 } = {}) {
  const first = deckArtSlides(slides)[0] || (Array.isArray(slides) ? slides[0] : null) || {};
  const vd = artVisualDirection(first, styleKit);
  const deck = first.presentationDeckDesign?.palette || {};
  const base = roleHex(vd, 'base') || visualHex(deck.bg) || '#171344';
  const graphic = roleHex(vd, 'graphic') || visualHex(deck.accent2) || visualHex(deck.accent) || '';
  const light = roleHex(vd, 'subject_light') || visualHex(deck.accent) || '';
  const shadow = roleHex(vd, 'shadow') || '';
  const accent = roleHex(vd, 'accent') || '';
  const ink = visualHex(first.titleColor) || (isLightInk(base) ? '#111111' : '#FFFFFF');
  const tone = isLightInk(ink) ? 'dark' : 'light';
  const fluid = [light, shadow].filter(Boolean).join(' and ');
  const kit = normalizeStyleKit(styleKit);
  const refs = Math.max(0, Number(baseReferenceCount) || 0);
  const subject = `SUBJECT AND CASTING: No people, faces, hands or bodies. An abstract identity background for this deck: about three quarters of the image is one uniform field of ${tone} paper in ${base}, with fine, even grain.`;
  const graphics = `LIGHT, TEXTURE AND GRAPHICS OF THIS SLIDE: At the right edge, one single large organic graphic shape${graphic ? ` in ${graphic}` : ''} with a cut-paper look (rounded extensions, texture dots and open areas), running past the frame and cut by it${fluid ? `, overlapping one fluid shape in ${fluid}` : ''}${accent ? `; a small cluster of ${accent} dots near the lower right corner` : ''}. Screen-print texture, abstract graphic language, no repeating pattern, no excess elements, large areas of breathing room.`;
  const composition = `COMPOSITION (space for the slide text): Type is laid over the left ${FREE_ART_TEXT_MAX}% of the frame, several lines of ${tone === 'dark' ? 'white' : 'dark'} type. Keep that area flat, ${tone} and calm in ${base}: uniform paper with fine grain, no shapes, dots, gradients or texture changes in it. Keep the graphics near the right edge, mostly from about ${FREE_ART_GRAPHIC_FROM}% of the frame width onward.`;
  return {
    format: 'presentation',
    framing: '',
    referenceCount: refs,
    styleMoodboard: refs > 0,
    styleReferenceLook: refs > 0,
    referenceMap: '',
    identityAnchor: '',
    presentationPanel: false,
    slideAction: '',
    subjects: '',
    styleBody: [composeImgExtraPrompt(kit, '')].filter(Boolean),
    familyEnglish: '',
    avoid: ['people, faces, hands, bodies or silhouettes', 'photographs of places or objects', 'repeating patterns or wallpaper'],
    composition,
    ...(vd ? { visualDirection: composeVisualDirectionBlock(vd, { referenceLook: refs > 0 }) } : {}),
    sceneBrief: { query: DECK_ART_SCENE, subject, action: '', light: graphics },
  };
}
