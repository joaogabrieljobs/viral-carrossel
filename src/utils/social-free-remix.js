/** Conserva a direção já aprovada ao aplicar apenas a redação de um remix. */
import { normalizeSocialFreeScene } from './social-free-plan.js';
import { normalizeSocialFreeFormat } from './social-free-prompt.js';
import { presentationSceneQuery } from './presentation-plan.js';

const object = value => value && typeof value === 'object' && !Array.isArray(value);
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const text = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
const free = slide => object(slide?.socialFreeDesign);
const cardFields = ['role', 'scene', 'avoid', 'design', 'eyebrow'];

function avoidLines(value) {
  return [...new Set((Array.isArray(value) ? value : [value]).map(text).filter(Boolean))].slice(0, 8).map(line => line.slice(0, 240));
}

function generatedImagePatch(generated) {
  const scene = normalizeSocialFreeScene(generated?.socialPlan?.scene ?? generated?.scene);
  const query = presentationSceneQuery(scene) || text(generated?.imageQuery);
  if (!query) return null;
  const source = owns(generated?.socialPlan, 'avoid') ? generated.socialPlan : generated;
  return { scene, imageQuery: query, ...(owns(source, 'avoid') ? { avoid: avoidLines(source.avoid) } : {}) };
}

/**
 * `slides` já passou por mergeRemixedSlides: seus três campos de texto são
 * mantidos literalmente. Design, mídia, blocos, rótulos e ajustes vêm do
 * card original; nem a redação nova nem um plano proposto o recompõem.
 */
export function preserveSocialFreeRemix({ sourceSlides = [], slides = [], generatedSlides = [], socialPlan = null, deckDesign = null, withImages = false, formato = 'carrossel' } = {}) {
  if (!Array.isArray(sourceSlides) || !Array.isArray(slides) || sourceSlides.length !== slides.length
    || (withImages && (!Array.isArray(generatedSlides) || sourceSlides.length !== generatedSlides.length))) {
    throw new Error('O remix precisa manter a quantidade de cards.');
  }
  const first = sourceSlides.find(free);
  const previousPlan = object(socialPlan) ? socialPlan : null;
  const socialDeckDesign = object(deckDesign) ? deckDesign : previousPlan?.deckDesign || first?.socialDeckDesign || null;
  if (!first) return { slides, socialPlan, socialDeckDesign };
  const format = previousPlan?.formato || first.socialPlan?.formato || normalizeSocialFreeFormat(formato);
  const visualDirection = previousPlan?.visualDirection || first.socialPlan?.visualDirection || null;
  const previousCards = Array.isArray(previousPlan?.cards) ? previousPlan.cards : [];
  const cards = [];
  const next = sourceSlides.map((source, index) => {
    const previousCard = previousCards.find(card => card?.index === index) || previousCards[index] || {};
    if (!free(source)) {
      cards.push({ ...previousCard, index });
      return slides[index];
    }
    const currentPlan = object(source.socialPlan) ? source.socialPlan : previousCard;
    const card = { ...previousCard, index, ...Object.fromEntries(cardFields.filter(key => owns(currentPlan, key)).map(key => [key, currentPlan[key]])) };
    const result = { ...source, ...Object.fromEntries(['title', 'subtitle', 'bodyAfterImage']
      .filter(key => owns(slides[index], key)).map(key => [key, slides[index][key]])) };
    if (source.socialFreeDesign.photo === 'none') result.imageQuery = '';
    else if (withImages) {
      const patch = generatedImagePatch(generatedSlides[index]);
      if (patch) {
        Object.assign(result, patch);
        const planned = { scene: patch.scene, ...(owns(patch, 'avoid') ? { avoid: patch.avoid } : {}) };
        result.socialPlan = { ...currentPlan, ...planned };
        Object.assign(card, planned);
      }
    }
    cards.push(card);
    return result;
  });
  return {
    slides: next,
    socialDeckDesign,
    socialPlan: { ...(previousPlan || { version: 1, kind: 'social_free', formato: format, visualDirection, signature: '' }), deckDesign: socialDeckDesign, cards },
  };
}
