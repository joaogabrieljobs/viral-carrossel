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
import { presentationSceneQuery } from './presentation-plan.js';

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

const OTHER_SCENES_MAX = 5;
const OTHER_SCENE_CHARS = 120;

const sceneSummary = (scene) => {
  const texto = presentationSceneQuery(scene);
  if (texto.length <= OTHER_SCENE_CHARS) return texto;
  const corte = texto.slice(0, OTHER_SCENE_CHARS + 1).lastIndexOf(' ');
  return texto.slice(0, corte > 0 ? corte : OTHER_SCENE_CHARS).replace(/[\s,;]+$/, '');
};

/**
 * Spec 1.1, referência (pedido do dono, 25/11): a referência do kit vai em
 * todas as imagens da apresentação, e cada slide precisa propor uma cena nova.
 * Devolve as cenas planejadas (roteiro v2, `presentationPlan.scene`) dos
 * outros slides, resumidas: até 5, as mais próximas do slide, na ordem do
 * deck. Fica de fora slide sem cena e cena igual à deste slide. Deck sem
 * roteiro v2 não tem cena: lista vazia, pedido igual ao de antes.
 */
export function presentationOtherScenes(slides, index) {
  const list = Array.isArray(slides) ? slides : [];
  if (!Number.isInteger(index) || index < 0 || index >= list.length) return [];
  const sceneOf = (slide) => {
    const scene = slide?.presentationPlan?.scene;
    return scene && typeof scene === 'object' ? sceneSummary(scene) : '';
  };
  const own = sceneOf(list[index]).toLowerCase();
  const candidates = list.map((slide, position) => ({ position, text: position === index ? '' : sceneOf(slide) }))
    .filter((item) => item.text && item.text.toLowerCase() !== own);
  const seen = new Set();
  return candidates
    .sort((a, b) => Math.abs(a.position - index) - Math.abs(b.position - index) || a.position - b.position)
    .filter((item) => { const key = item.text.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; })
    .slice(0, OTHER_SCENES_MAX)
    .sort((a, b) => a.position - b.position)
    .map((item) => item.text);
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
 * @param {object[]} [input.deckSlides] slides do deck (apresentação): cenas dos outros slides
 * @param {number} [input.slideIndex] posição deste slide em `deckSlides`
 */
export function composeImageDirection({
  styleKit = null, slide = null, fmt = 'carrossel', visualBible = null, slideDirection,
  anchorPlan = null, baseReferenceCount, presentationPanel = false, presentationFamily,
  deckSlides = null, slideIndex = -1,
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
  const apresentacao = fmt === 'apresentacao';
  const avoid = apresentacao ? presentationImageAvoid(card) : [];
  const otherScenes = apresentacao ? presentationOtherScenes(deckSlides, slideIndex) : [];
  return {
    format: fmt === 'apresentacao' ? 'presentation' : 'carousel',
    framing: cena.framing,
    referenceCount: references.length,
    styleMoodboard: references.some((ref) => ref.role === 'moodboard'),
    // Spec 1.1: na apresentação, da referência de estilo do kit (sem @rótulo)
    // sai só o visual, com ou sem estilo escrito. @rótulo continua como está.
    styleReferenceLook: apresentacao && references.some((ref) => ref.role === 'moodboard' && !ref.label),
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
    ...(otherScenes.length ? { otherScenes } : {}),
  };
}
