/**
 * Direção do pedido de imagem de um card — junta, já separados por papel, os
 * textos que o editor conhece: estilo do projeto, direção do slide, anexos,
 * âncora de identidade, painel de apresentação, ficha visual, família e
 * enquadramento. O resultado segue para `generateDALLE*` em
 * `options.imageDirection`; a ordem e o orçamento ficam em
 * `shared/image-prompt.js`.
 *
 * Seleção (catálogo final, 22/11/2026): só direção estética explícita ou
 * moodboard de estilo desligam a direção de arte padrão. Referência de produto
 * ou pessoa do card, âncora de identidade, painel e instrução de ação não.
 */
import { MAX_REF_IMAGES, composeImgExtraPrompt, normalizeStyleKit } from './style-kit.js';
import { composeReferenceMap, normalizeSlideReferenceMention, slideReferenceDescriptors } from './slide-reference.js';
import { composeSceneParts } from './visual-bible.js';
import { isAestheticDirection } from '../../shared/image-prompt.js';

const SLIDE_DIRECTION_MAX = 1200;

/**
 * Anexos na ordem real de envio, como `resolveImageReferences` os entrega:
 * as referências do card substituem o moodboard do projeto; a âncora de
 * identidade, quando existe, vai por último.
 */
function sentReferences({ kit, slide, anchorPlan, baseReferenceCount }) {
  const doCard = slideReferenceDescriptors(slide);
  const origem = doCard.length
    ? doCard.map((ref) => ({ label: ref.mention, role: 'subject' }))
    : kit.refImages.slice(0, MAX_REF_IMAGES).map((ref) => ({
      label: ref.mention ? normalizeSlideReferenceMention(ref.mention) : '', role: 'moodboard',
    }));
  const enviados = Number.isInteger(baseReferenceCount) && baseReferenceCount >= 0 ? baseReferenceCount : origem.length;
  // Quantidade diferente da esperada: os papéis valem, os rótulos não são confiáveis.
  const base = enviados === origem.length
    ? origem
    : Array.from({ length: enviados }, () => ({ label: '', role: doCard.length ? 'subject' : 'moodboard' }));
  const comAncora = !!anchorPlan?.direction && Array.isArray(anchorPlan.refImages) && anchorPlan.refImages.length > 0;
  return {
    references: comAncora ? [...base, { label: anchorPlan.entityId || '', role: 'identity' }] : base,
    comAncora,
  };
}

/**
 * @param {object} input
 * @param {object} [input.styleKit] kit do projeto (estilo escrito, brief, moodboard)
 * @param {object} [input.slide] card ou slide (referências, zonas, família)
 * @param {string} [input.fmt] 'carrossel' | 'quadrado' | 'stories' | 'apresentacao'
 * @param {object} [input.visualBible] ficha visual do projeto
 * @param {string} [input.slideDirection] direção escrita no card; padrão `slide.imgExtraPrompt`
 * @param {object} [input.anchorPlan] retorno de `planPersonAnchor`
 * @param {number} [input.baseReferenceCount] anexos do projeto/card realmente enviados
 * @param {boolean} [input.presentationPanel] imagem de painel de apresentação planejado
 * @param {string} [input.presentationFamily] família do deck; '' quando não há família ativa
 */
export function composeImageDirection({
  styleKit = null, slide = null, fmt = 'carrossel', visualBible = null, slideDirection,
  anchorPlan = null, baseReferenceCount, presentationPanel = false, presentationFamily,
} = {}) {
  const card = slide || {};
  const kit = normalizeStyleKit(styleKit);
  const direcao = String(slideDirection ?? card.imgExtraPrompt ?? '').trim().slice(0, SLIDE_DIRECTION_MAX);
  const estetica = isAestheticDirection(direcao);
  const { references, comAncora } = sentReferences({ kit, slide: card, anchorPlan, baseReferenceCount });
  // Instrução de ação cita os @rótulos: fica junto do mapa. Sem mapa, vira
  // bloco próprio. Em nenhum dos casos conta como estilo.
  const referenceMap = composeReferenceMap(references, estetica ? '' : direcao);
  const cena = composeSceneParts({
    visualBible, slide: card, fmt, excludeEntityIds: anchorPlan?.excludeEntityIds || [], presentationFamily,
  });
  return {
    format: fmt === 'apresentacao' ? 'presentation' : 'carousel',
    framing: cena.framing,
    referenceCount: references.length,
    styleMoodboard: references.some((ref) => ref.role === 'moodboard'),
    referenceMap,
    identityAnchor: comAncora ? anchorPlan.direction : '',
    presentationPanel: presentationPanel === true,
    slideAction: !estetica && direcao && !referenceMap ? composeImgExtraPrompt(null, direcao) : '',
    subjects: cena.subjects,
    // Segmentos separados: se o orçamento apertar, a bíblia do projeto cede
    // antes da direção escrita para este slide.
    styleBody: [composeImgExtraPrompt(kit, ''), estetica ? composeImgExtraPrompt(null, direcao) : ''].filter(Boolean),
    familyEnglish: cena.familyEnglish,
  };
}
