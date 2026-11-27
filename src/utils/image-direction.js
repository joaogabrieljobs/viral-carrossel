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
import { composeVisualDirectionBlock, resolveSlideVisualDirection, resolveSocialFreeVisualDirection } from './visual-direction.js';
import { composeCompositionBlock } from './image-composition.js';
import { composeSocialFreeComposition, isSocialFreeSlide, socialFreeImageSlide } from './social-free-prompt.js';
import { normalizeReferenceVisualAnalysis } from './reference-visual-analysis.js';

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

export function socialFreeImageAvoid(slide) {
  const value = slide?.socialPlan?.avoid ?? slide?.avoid;
  return [...new Set((Array.isArray(value) ? value : [value]).filter(line => typeof line === 'string' && line.trim())
    .map(line => line.replace(/\s+/g, ' ').trim().slice(0, 240)))].slice(0, 8);
}

export function socialFreeOtherScenes(slides, index) {
  return presentationOtherScenes((Array.isArray(slides) ? slides : []).map(slide => ({ presentationPlan: slide?.socialPlan })), index);
}

/** Diferenças fotografáveis, sem gastar o resumo repetindo o mesmo sujeito. */
function directedSceneVariation(slides, index, social) {
  const list = Array.isArray(slides) ? slides : [];
  if (!Number.isInteger(index) || index < 0 || index >= list.length) return [];
  const ownScene = (social ? list[index]?.socialPlan : list[index]?.presentationPlan)?.scene;
  const ownKey = ['action', 'setting', 'shot'].map(key => clean(ownScene?.[key])).join('|').toLowerCase();
  const seen = new Set([ownKey]);
  return list.map((slide, position) => {
    const plan = social ? slide?.socialPlan : slide?.presentationPlan;
    const design = social ? slide?.socialFreeDesign : slide?.presentationFreeDesign;
    const scene = plan?.scene;
    if (position === index || design?.photo === 'none' || plan?.design?.photo === 'none' || !scene) return null;
    const value = { index: position, action: clean(scene.action), setting: clean(scene.setting), shot: clean(scene.shot) };
    return value.action || value.setting || value.shot ? value : null;
  }).filter(Boolean)
    .sort((a, b) => Math.abs(a.index - index) - Math.abs(b.index - index) || a.index - b.index)
    .filter(value => {
      const key = [value.action, value.setting, value.shot].join('|').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, OTHER_SCENES_MAX);
}

const clean = value => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().replace(/[.;,\s]+$/, '') : '');

/**
 * Direção de arte (parte 2): a cena do roteiro como briefing de foto, em três
 * blocos na ordem do método do ChatGPT — assunto e casting (com figurino e
 * lugar), ação e expressão, luz e grafismos do slide. O plano entra no bloco
 * COMPOSITION quando há composição; sem ela, fica no assunto. `query` é o
 * pedido de imagem que o roteiro gravou: se a pessoa reescreveu a imagem do
 * slide, vale o texto dela (SCENE) e estes blocos não entram.
 */
export function presentationSceneBrief(scene, { shotInComposition = false } = {}) {
  if (!scene || typeof scene !== 'object' || !clean(scene.subject)) return null;
  const subject = [
    clean(scene.subject),
    clean(scene.wardrobe) ? `Wardrobe: ${clean(scene.wardrobe)}` : '',
    clean(scene.setting) ? `Setting: ${clean(scene.setting)}` : '',
    !shotInComposition && clean(scene.shot) ? `Shot: ${clean(scene.shot)}` : '',
  ].filter(Boolean).join('. ');
  const action = [clean(scene.action), clean(scene.expression) ? `expression: ${clean(scene.expression)}` : ''].filter(Boolean).join('; ');
  const light = [clean(scene.light), clean(scene.graphics) ? `Graphics on this slide: ${clean(scene.graphics)}` : ''].filter(Boolean).join('. ');
  return {
    query: presentationSceneQuery(scene),
    subject: `SUBJECT AND CASTING: ${subject}.`,
    action: action ? `ACTION AND EXPRESSION: ${action}.` : '',
    light: light ? `LIGHT, TEXTURE AND GRAPHICS OF THIS SLIDE: ${light}.` : '',
  };
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
  deckSlides = null, slideIndex = -1, socialFree = false, formatViews = null,
  referenceVisualAnalysis = null,
} = {}) {
  const apresentacao = fmt === 'apresentacao';
  const source = slide || {};
  const entry = formatViews?.[fmt]?.slides?.[source.id];
  const exitedFreeHere = Object.hasOwn(entry || {}, 'socialFreeDesign') && entry.socialFreeDesign === null;
  // A composição e a decisão de usar o plano pertencem à mesma vista.
  // Um estilo fixo nesta proporção não reativa a direção Livre da base.
  const card = !apresentacao && (socialFree === true || isSocialFreeSlide(source))
    ? socialFreeImageSlide(source, { fmt, formatViews }) : source;
  const kit = normalizeStyleKit(styleKit);
  const direcao = String(slideDirection ?? card.imgExtraPrompt ?? '').trim().slice(0, SLIDE_DIRECTION_MAX);
  const estetica = isAestheticDirection(direcao);
  const { references, comAncora } = sentReferences({ kit, slide: card, anchorPlan, baseReferenceCount });
  // Instrução de ação cita os @rótulos: fica junto do mapa. Sem mapa, vira
  // bloco próprio. Em nenhum dos casos conta como estilo.
  const referenceMap = composeReferenceMap(references, estetica ? '' : direcao);
  const livreSocial = !apresentacao && !exitedFreeHere && (socialFree === true || isSocialFreeSlide(card));
  const livreApresentacao = apresentacao && card.presentationPresetId === 'presentation_free';
  const directed = livreSocial || livreApresentacao;
  const referenceAnalysis = livreApresentacao ? normalizeReferenceVisualAnalysis(referenceVisualAnalysis) : null;
  // Direção de arte (partes 1 a 3): direção visual do deck (roteiro, modo
  // livre e kit), cena como briefing e o espaço do texto no quadro.
  const visual = apresentacao ? resolveSlideVisualDirection({ slide: card, styleKit })
    : livreSocial ? resolveSocialFreeVisualDirection({ slide: card, styleKit }) : null;
  const plan = apresentacao ? card.presentationPlan : livreSocial ? card.socialPlan : null;
  const plannedScene = plan?.scene && typeof plan.scene === 'object' ? plan.scene : null;
  // No contrato Livre, shot pertence à cena e só entra se o pedido ainda
  // coincide com ela. A geometria não carrega enquadramento antigo em uma
  // imagem reescrita manualmente, nem contradiz scene.graphics: none.
  const composition = apresentacao ? composeCompositionBlock(card, { visualDirection: visual, shot: !directed && visual && plannedScene ? clean(plannedScene.shot) : '', directed })
    : livreSocial ? composeSocialFreeComposition(card, { fmt, formatViews, visualDirection: visual }) : '';
  const sceneBrief = visual || directed ? presentationSceneBrief(plannedScene, { shotInComposition: !!composition }) : null;
  const cena = composeSceneParts({
    visualBible, slide: card, fmt,
    excludeEntityIds: anchorPlan?.excludeEntityIds || [], presentationFamily,
    compositionAware: !!composition,
  });
  const avoid = apresentacao ? presentationImageAvoid(card) : livreSocial ? socialFreeImageAvoid(card) : [];
  const otherScenes = apresentacao ? presentationOtherScenes(deckSlides, slideIndex) : livreSocial ? socialFreeOtherScenes(deckSlides, slideIndex) : [];
  const styleReferenceLook = (apresentacao || livreSocial) && references.some((ref) => ref.role === 'moodboard' && (livreSocial || !ref.label));
  return {
    format: fmt === 'apresentacao' ? 'presentation' : 'carousel',
    ...(livreSocial ? { socialFree: true } : {}),
    ...(directed ? { directedPrompt: {
      version: 2, kind: livreSocial ? 'social_free' : 'presentation_free',
      visual, scene: plannedScene ? { ...plannedScene } : null,
      ...(referenceAnalysis ? { referenceDirection: referenceAnalysis.synthesis,
        referenceRestrictions: referenceAnalysis.direction.restrictions } : {}),
      variation: directedSceneVariation(deckSlides, slideIndex, livreSocial),
      references, manualDirection: direcao,
    } } : {}),
    framing: cena.framing,
    referenceCount: references.length,
    styleMoodboard: references.some((ref) => ref.role === 'moodboard'),
    // Spec 1.1: na apresentação, da referência de estilo do kit (sem @rótulo)
    // sai só o visual, com ou sem estilo escrito. @rótulo continua como está.
    styleReferenceLook,
    referenceMap,
    identityAnchor: comAncora ? anchorPlan.direction : '',
    presentationPanel: !livreSocial && presentationPanel === true,
    slideAction: !estetica && direcao && !referenceMap ? composeImgExtraPrompt(null, direcao) : '',
    subjects: cena.subjects,
    // Segmentos separados: se o orçamento apertar, a bíblia do projeto cede
    // antes da direção escrita para este slide.
    styleBody: [composeImgExtraPrompt(kit, ''), estetica ? composeImgExtraPrompt(null, direcao) : ''].filter(Boolean),
    familyEnglish: cena.familyEnglish,
    ...(avoid.length ? { avoid } : {}),
    ...(otherScenes.length ? { otherScenes } : {}),
    ...(composition ? { composition } : {}),
    ...(visual ? { visualDirection: composeVisualDirectionBlock(visual, { referenceLook: styleReferenceLook }) } : {}),
    ...(sceneBrief ? { sceneBrief } : {}),
  };
}
