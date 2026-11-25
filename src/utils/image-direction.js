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
 * Spec 1.1, entrega 1: o que a imagem do slide não pode mostrar, vindo do
 * roteiro v2 (rules de imagem que proíbem algo e o avoid da posição). O slide
 * guarda isso em presentationPlan, então vale também ao regenerar a imagem.
 * Plano v1 não tem esses campos: lista vazia, pedido igual ao de antes.
 */
export function presentationImageAvoid(slide) {
  const plan = slide?.presentationPlan;
  if (!plan || typeof plan !== 'object') return [];
  const lines = [...(Array.isArray(plan.imageRules) ? plan.imageRules : []), plan.avoid]
    .filter((line) => typeof line === 'string' && line.trim()).map((line) => line.replace(/\s+/g, ' ').trim().slice(0, 240));
  return [...new Set(lines)].slice(0, 8);
}

const PRESENTATION_REFERENCE_ROLES = Object.freeze(['cover', 'closing']);
const visualRoleOf = (slide) => String(slide?.presentationPlan?.visualRole || slide?.presentationVisualRole || slide?.visualRole || '');

/**
 * Spec 1.1, referência (decisão do João, 25/11): na Apoteose a referência do
 * kit, sem papel declarado, ia como moodboard em todas as imagens, e a mesma
 * mulher de máscara saiu em 7 de 10 slides. Na apresentação ela vai só na capa
 * e no fecho (papel visual cover e closing). Deck sem esse papel (gerado sem
 * roteiro, cujas etapas usam outros nomes) usa a primeira e a última posição
 * no lugar do que falta. Referência com @rótulo no kit tem papel declarado e
 * continua em toda imagem.
 */
export function presentationStyleReferenceAllowed(slides, index) {
  const list = Array.isArray(slides) ? slides : [];
  const roles = list.map(visualRoleOf);
  if (PRESENTATION_REFERENCE_ROLES.includes(roles[index])) return true;
  if (index === 0 && !roles.includes('cover')) return true;
  return index === list.length - 1 && list.length > 0 && !roles.includes('closing');
}

/**
 * Kit para a imagem de um slide de apresentação: fora da capa e do fecho,
 * sem as referências sem papel. O estilo escrito fica; ele e a família passam
 * a guiar a imagem, e o assunto vem da cena do slide. Carrossel e referência
 * do próprio slide não passam por aqui.
 */
export function presentationStyleKitForSlide(styleKit, slides, index) {
  const kit = normalizeStyleKit(styleKit);
  if (presentationStyleReferenceAllowed(slides, index)) return kit;
  return { ...kit, refImages: kit.refImages.filter((ref) => String(ref.mention || '').trim()) };
}

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
  const avoid = fmt === 'apresentacao' ? presentationImageAvoid(card) : [];
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
    ...(avoid.length ? { avoid } : {}),
  };
}
