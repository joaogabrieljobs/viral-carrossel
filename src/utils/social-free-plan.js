/** Normalização editorial do roteiro social; não recompõe projetos ao abrir. */
import { applyFreeEmphasis, deckDesignFromBrand, normalizeDeckDesign, snapDeckDesignToPalette } from './free-design.js';
import { normalizeSocialFreeDesign } from './social-free-design.js';
import { normalizeSocialFreeFormat } from './social-free-prompt.js';
import { explicitBrandColorsFromKit } from './style-kit-design.js';
import { kitReferencePalette } from './reference-palette.js';
import { alignVisualDirectionWithDeck, applyKitColors, coerceVisualDirection, kitVisualColors, snapVisualDirectionToPalette, visualHex } from './visual-direction.js';
import { presentationSceneQuery, PRESENTATION_SCENE_BRIEF_FIELDS } from './presentation-plan.js';
import { normalizePresentationBlocks } from './presentation-quality.js';
import { deriveFreeEyebrow, personalityComparison } from './free-draft.js';
import { normalizePresentationEyebrow } from './presentation-eyebrow.js';
import { contentLabelLanguage } from './content-label-language.js';

const object = value => value && typeof value === 'object' && !Array.isArray(value);
const clean = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
const plain = value => clean(value).replace(/[*_]/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const ROLES = Object.freeze(['cover', 'opening', 'content', 'list', 'comparison', 'proof', 'statement', 'closing']);
const PURPOSE = { opening: 'context', content: 'other', list: 'process', comparison: 'comparison', proof: 'evidence', statement: 'summary', closing: 'summary' };

export function normalizeSocialFreeScene(value) {
  if (!object(value)) return null;
  const scene = Object.fromEntries(PRESENTATION_SCENE_BRIEF_FIELDS.map(key => [key, clean(value[key]).slice(0, 300)]));
  return scene.subject ? scene : null;
}

function avoidLines(value) {
  return [...new Set((Array.isArray(value) ? value : [value]).map(clean).filter(Boolean))].slice(0, 8).map(line => line.slice(0, 240));
}

function supportedSignature(value, slides, source) {
  const signature = clean(value).replace(/[*_]/g, '').slice(0, 240);
  if (!signature) return '';
  const asText = slide => ['title', 'subtitle', 'bodyAfterImage'].map(key => plain(slide?.[key])).join(' ');
  return plain(source).includes(plain(signature)) || (slides.length > 1 && asText(slides[0]).includes(plain(signature)) && asText(slides.at(-1)).includes(plain(signature))) ? signature : '';
}

function blockFromText(slide, design) {
  const supplied = normalizePresentationBlocks(Array.isArray(slide.presentationBlocks) ? slide.presentationBlocks : slide.socialBlocks);
  if (supplied.length) return { ...slide, presentationBlocks: supplied };
  if (design.block !== 'comparison') return { ...slide, presentationBlocks: [] };
  const compared = personalityComparison({ ...slide, presentationBlocks: [] });
  if (!compared.presentationBlocks?.length) return { ...slide, presentationBlocks: [] };
  // O social não tem notas do apresentador. Contexto que não virou par continua
  // visível no apoio; a tabela contém só o que saiu do texto original.
  const context = String(compared.speakerNotes || '').trim();
  const result = { ...slide, subtitle: context, bodyAfterImage: '', presentationBlocks: compared.presentationBlocks };
  return result;
}

/** Identidade explícita da marca e paleta extraída prevalecem sobre a proposta. */
export function normalizeSocialFreePlan(draft, { formato = 'carrossel', brand = {}, styleKit = null, referenceColors = [], signature = '', source = '' } = {}) {
  const slides = Array.isArray(draft?.slides) ? draft.slides : [];
  const kitColors = kitVisualColors(styleKit);
  const effectiveBrand = { ...explicitBrandColorsFromKit(styleKit || {}), ...(object(brand) ? brand : {}) };
  const reference = Array.isArray(referenceColors) && referenceColors.length ? referenceColors : kitReferencePalette(styleKit);
  const explicitColors = Object.values(effectiveBrand).map(visualHex).filter(Boolean);
  const allowed = [...reference, ...kitColors.colors, ...explicitColors];
  const explicitBase = visualHex(effectiveBrand.bg) || kitColors.base;
  let deckDesign = deckDesignFromBrand(effectiveBrand, normalizeDeckDesign(draft?.deckDesign));
  if (reference.length || kitColors.colors.length >= 3) deckDesign = snapDeckDesignToPalette(deckDesign, allowed, { explicitBase });
  let visualDirection = applyKitColors(coerceVisualDirection(draft?.visualDirection), styleKit);
  visualDirection = alignVisualDirectionWithDeck(visualDirection, deckDesign);
  if (reference.length || kitColors.colors.length >= 3) visualDirection = snapVisualDirectionToPalette(visualDirection, allowed, { explicitBase });
  visualDirection = alignVisualDirectionWithDeck(visualDirection, deckDesign);
  const lang = contentLabelLanguage(slides);
  const used = new Set(slides.map(slide => normalizePresentationEyebrow(slide?.eyebrow)).filter(Boolean));
  const cards = slides.map((slide, index) => {
    let design = normalizeSocialFreeDesign(slide?.design || slide?.socialFreeDesign);
    const proposedScene = normalizeSocialFreeScene(slide?.scene);
    const hasMedia = ['bgImage', 'bgImageId', 'bgImageAssetId', 'videoId'].some(key => !!slide?.[key]);
    if (design.photo !== 'none' && !proposedScene && !clean(slide?.imageQuery) && !hasMedia) {
      design = { ...design, photo: 'none', ground: design.ground === 'photo' ? 'bg' : design.ground };
    }
    const role = index === 0 ? 'cover' : index === slides.length - 1 ? 'closing' : ROLES.includes(slide?.role) ? slide.role : 'content';
    const eyebrow = index === 0 ? '' : normalizePresentationEyebrow(slide?.eyebrow) || deriveFreeEyebrow({ ...slide, presentationPlan: { visualRole: role, purpose: PURPOSE[role] } }, { index, count: slides.length, used, lang, coverTitle: slides[0]?.title });
    if (eyebrow) used.add(eyebrow);
    return { index, role, scene: design.photo === 'none' ? null : proposedScene, avoid: avoidLines(slide?.avoid), design, eyebrow };
  });
  const plan = {
    version: 1, kind: 'social_free', formato: normalizeSocialFreeFormat(formato), deckDesign, visualDirection,
    signature: supportedSignature(signature || draft?.signature, slides, source), cards,
  };
  const enriched = slides.map((slide, index) => {
    const card = cards[index];
    const content = blockFromText(slide, card.design);
    return {
      ...content,
      ...Object.fromEntries(['title', 'subtitle', 'bodyAfterImage'].filter(key => typeof content[key] === 'string')
        .map(key => [key, applyFreeEmphasis(content[key], card.design.emphasis)])),
      scene: card.scene, avoid: card.avoid, design: card.design, eyebrow: card.eyebrow,
      imageQuery: card.design.photo === 'none' ? '' : presentationSceneQuery(card.scene) || clean(slide.imageQuery),
      socialPresetId: 'social_free', socialFreeDesign: card.design, socialDeckDesign: deckDesign,
      socialPlan: { ...card, kind: 'social_free', formato: plan.formato, visualDirection },
    };
  });
  return { result: { ...draft, slides: enriched, deckDesign, visualDirection, signature: plan.signature }, socialPlan: plan };
}

/** A revisão altera texto, nunca recria o plano ou a direção da imagem. */
export function socialPlanAfterReview(result, socialPlan) {
  const cards = result.slides.map((slide, index) => ({ ...socialPlan.cards[index], index, eyebrow: slide.eyebrow || '' }));
  const plan = { ...socialPlan, cards };
  return {
    socialPlan: plan,
    result: { ...result, slides: result.slides.map((slide, index) => ({ ...slide,
      socialPlan: { ...cards[index], kind: 'social_free', formato: plan.formato, visualDirection: plan.visualDirection },
      socialDeckDesign: plan.deckDesign, socialFreeDesign: cards[index].design,
    })) },
  };
}
