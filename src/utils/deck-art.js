/**
 * Arte de fundo reaproveitada (docs/product/direcao-de-arte-imagens.md, parte 4).
 *
 * No deck da Apoteose feito no ChatGPT, os slides de posicionamento,
 * personalidade e fecho usavam o mesmo fundo abstrato da identidade: papel
 * índigo liso com grão fino e um único grafismo ciano/laranja na borda
 * direita. No Moont, a página sem foto ficava só com a cor sólida.
 *
 * Aqui: uma imagem abstrata por deck, sem pessoas, pedida UMA vez (1 crédito
 * de imagem) com o acabamento e os grafismos da própria direção visual, sem
 * impor a estética da Apoteose a outros projetos. O bloco COMPOSITION reserva
 * o lado do texto. A arte fica guardada como as fotos (IndexedDB e nuvem) nos
 * slides com `ground: 'art'`; sem ela, a página fica na cor base.
 *
 * Módulo puro: sem React e sem DOM.
 */
import {
  FREE_ART_GRAPHIC_FROM, FREE_ART_TEXT_MAX, FREE_PRESENTATION_PRESET_ID, slideSkipsImageGeneration,
} from './free-design.js';
import {
  alignVisualDirectionWithDeck, composeVisualDirectionBlock, resolveSlideVisualDirection, resolveSocialFreeVisualDirection, visualHex,
} from './visual-direction.js';
import { composeImgExtraPrompt, normalizeStyleKit } from './style-kit.js';
import { wcagContrast } from './wcag.js';
import { composeSocialFreeArtComposition, isSocialFreeSlide, normalizeSocialFreeFormat } from './social-free-prompt.js';
import { normalizeReferenceVisualAnalysis } from './reference-visual-analysis.js';

/** Pedido de cena da arte (o mesmo texto vai em `sceneBrief.query`). */
export const DECK_ART_SCENE = 'Abstract identity background for this presentation deck, no people.';
export const SOCIAL_DECK_ART_SCENE = 'Abstract identity background for this social carousel, no people.';
export const DECK_ART_FIELDS = Object.freeze(['presentationArtImageId', 'presentationArtImage', 'presentationArtImageAssetId']);

const isSocialArt = slide => isSocialFreeSlide(slide) && slide?.socialFreeDesign?.ground === 'art' && slide.socialFreeDesign.photo === 'none';
const isArt = slide => slide?.presentationFreeDesign?.ground === 'art' || isSocialArt(slide);
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
  const photos = list.filter(slide => !(isSocialFreeSlide(slide) ? slide?.socialFreeDesign?.photo === 'none' : slideSkipsImageGeneration(slide)) && String(slide?.imageQuery || '').trim()).length;
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

/** Direção visual em vigor para a arte, alinhada à marca efetiva do deck. */
function artVisualDirection(slide, styleKit) {
  if (isSocialFreeSlide(slide)) return resolveSocialFreeVisualDirection({ slide, styleKit })
    || (slide?.socialDeckDesign ? alignVisualDirectionWithDeck(null, slide.socialDeckDesign) : null);
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
export function composeDeckArtImageDirection({ slides = [], styleKit = null, baseReferenceCount = 0, fmt = null, formatViews = null, referenceVisualAnalysis = null } = {}) {
  const first = deckArtSlides(slides)[0] || (Array.isArray(slides) ? slides[0] : null) || {};
  const socialFree = isSocialFreeSlide(first);
  const referenceAnalysis = !socialFree ? normalizeReferenceVisualAnalysis(referenceVisualAnalysis) : null;
  const referenceBackground = referenceAnalysis?.direction.background;
  // A análise substitui a estética inferida do plano, não as proibições
  // globais validadas do briefing. O avoid local pertence à cena da página
  // e não se transfere para este asset abstrato compartilhado.
  const imageRules = referenceBackground && Array.isArray(first.presentationPlan?.imageRules)
    ? first.presentationPlan.imageRules.filter(rule => typeof rule === 'string' && rule.trim()) : [];
  const socialFormat = normalizeSocialFreeFormat(fmt || first.socialPlan?.formato);
  const resolved = artVisualDirection(first, styleKit);
  const deck = (socialFree ? first.socialDeckDesign : first.presentationDeckDesign)?.palette || {};
  const base = roleHex(resolved, 'base') || visualHex(deck.bg) || '#111111';
  // Mesmo sem roteiro, o pedido é de arte abstrata: uma direção mínima
  // impede o montador comum de reintroduzir a fotografia/grão padrão.
  // Só compõe texto; não cria nem grava uma paleta de roteiro fictícia.
  const vd = referenceBackground
    ? { ...resolved, palette: resolved?.palette || [{ role: 'base', hex: base }],
      finish: referenceBackground.finish || resolved?.finish || '', graphics: referenceBackground.graphics || resolved?.graphics || 'none' }
    : resolved || { palette: [{ role: 'base', hex: base }], finish: 'Clean, uniform colour field.', graphics: 'none' };
  const hasGraphics = Boolean(vd.graphics && vd.graphics !== 'none');
  const ink = visualHex(first.titleColor) || (isLightInk(base) ? '#111111' : '#FFFFFF');
  const tone = isLightInk(ink) ? 'dark' : 'light';
  const kit = normalizeStyleKit(styleKit);
  const refs = Math.max(0, Number(baseReferenceCount) || 0);
  const subject = socialFree
    ? `SUBJECT AND CASTING: No people, faces, hands or bodies. An abstract identity background shared by this social carousel: a uniform ${tone} field in ${base}, with editable text zones defined by COMPOSITION.`
    : `SUBJECT AND CASTING: No people, faces, hands or bodies. An abstract identity background for this deck: about three quarters of the image is one uniform ${tone} field in ${base}.`;
  const graphicLocation = socialFree ? 'outside the actual protected text areas' : 'near the right edge';
  const graphics = `LIGHT, TEXTURE AND GRAPHICS OF THIS SLIDE: Apply the finish, atmosphere and light/shadow roles specified in VISUAL DIRECTION to this abstract background, without a photographic subject. ${hasGraphics ? `Use only the specified graphic language ${graphicLocation}, with large areas of breathing room; do not add other motifs or textures.` : `No graphic interventions or added motifs. Keep the whole frame uniform in ${base}.`}`;
  const composition = socialFree
    ? composeSocialFreeArtComposition(deckArtSlides(slides), { fmt: socialFormat, formatViews, base, graphics: hasGraphics })
    : `COMPOSITION (space for the slide text): Type is laid over the left ${FREE_ART_TEXT_MAX}% of the frame, several lines of ${tone === 'dark' ? 'white' : 'dark'} type. Keep that area flat, ${tone} and calm in ${base}: a uniform, low-detail surface with no shapes, dots, gradients or texture changes in it.${hasGraphics ? ` Keep the graphics near the right edge, mostly from about ${FREE_ART_GRAPHIC_FROM}% of the frame width onward.` : ' Keep the rest of the frame equally calm, with no graphic interventions.'}`;
  return {
    format: socialFree ? 'carousel' : 'presentation',
    ...(socialFree ? { socialFree: true } : {}),
    directedPrompt: {
      version: 2, kind: socialFree ? 'social_free' : 'presentation_free', visual: vd,
      // Um fundo usa textura e grafismos da referência; o sujeito fotográfico
      // observado não deve contaminar este asset deliberadamente abstrato.
      ...(referenceBackground ? { referenceDirection: `Surface finish: ${vd.finish} Graphic language: ${vd.graphics}`,
        referenceRestrictions: referenceAnalysis.direction.restrictions, assetRole: 'background' } : {}),
      scene: {
        subject: subject.replace(/^SUBJECT AND CASTING: /, ''),
        light: 'Apply the palette light and shadow roles to this abstract background, without a photographic subject.',
        graphics: hasGraphics ? `${vd.graphics}. Restrict interventions ${graphicLocation}; add no other motifs or textures.` : 'none',
      },
      variation: [], references: Array.from({ length: refs }, () => ({ label: '', role: 'moodboard' })),
    },
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
    avoid: [...imageRules, !referenceBackground && vd.avoid, 'people, faces, hands, bodies or silhouettes', 'photographs of places or objects', 'unrequested decorative motifs'].filter(Boolean),
    composition,
    visualDirection: composeVisualDirectionBlock(vd, { referenceLook: refs > 0 }),
    sceneBrief: { query: socialFree ? SOCIAL_DECK_ART_SCENE : DECK_ART_SCENE, subject, action: '', light: graphics },
  };
}
