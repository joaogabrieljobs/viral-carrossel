/**
 * Ficha visual do projeto — pessoas, objetos e lugares que aparecem nas imagens.
 *
 * Rodada R2 (15–16/11/2026): 7 de 9 carrosséis tiveram foto contradizendo o
 * briefing (camisa verde-oliva virou branca; porta solta virou porta em
 * parede; ateliê de cerâmica virou marcenaria) e o mesmo objeto mudou de
 * desenho entre a capa e o miolo. A causa: cada imagem era pedida só com uma
 * `imageQuery` de 8–15 palavras, escrita por card, sem descrição compartilhada.
 *
 * A ficha é escrita UMA vez, junto com o texto, com os atributos que o
 * material informa. Ela segue inteira em todo pedido de imagem do projeto;
 * a `imageQuery` continua descrevendo só a cena daquele card.
 *
 * É OPCIONAL e à prova de falha: se o modelo não devolver a ficha, ou
 * devolver algo inválido, a geração segue exatamente como antes.
 */
import { imageFramingDirection } from '../../shared/image-aspect.js';
import { socialPhotoDirection } from './social-families.js';

export const VISUAL_BIBLE_MAX_ENTITIES = 4;
const EN_MIN = 20;
const EN_MAX = 400;
const NEVER_MAX = 200;
const SUBJECTS_MAX = 1600;

/** Modelo do campo no contrato JSON do rascunho. */
export const VISUAL_BIBLE_SCHEMA = Object.freeze({ entities: [{ id: '', en: '', never: '' }] });

const limpar = (valor) => String(valor ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
const slug = (valor) => limpar(valor).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/**
 * Aceita só o que tem forma segura; descarta o resto sem lançar erro.
 * Devolve `null` quando não sobra nenhuma entidade utilizável.
 */
export function normalizeVisualBible(raw) {
  const lista = Array.isArray(raw?.entities) ? raw.entities : null;
  if (!lista) return null;
  const vistos = new Set();
  const entities = [];
  for (const item of lista) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const id = slug(item.id);
    const en = limpar(item.en).slice(0, EN_MAX);
    if (!id || vistos.has(id) || en.length < EN_MIN) continue;
    vistos.add(id);
    entities.push({ id, en, never: limpar(item.never).slice(0, NEVER_MAX) });
    if (entities.length >= VISUAL_BIBLE_MAX_ENTITIES) break;
  }
  return entities.length ? { entities } : null;
}

/** Instrução para o modelo de texto, anexada às regras de `imageQuery`. */
export function buildVisualBiblePromptRules() {
  return `visualBible — FICHA VISUAL DO PROJETO:
• Preencha quando o material descreve pessoas, objetos ou lugares concretos que aparecem nas imagens. Até ${VISUAL_BIBLE_MAX_ENTITIES} entidades, uma por pessoa, objeto ou lugar; a mesma entidade vale para todas as imagens em que ela aparece.
• Cada entidade: "id" curto em minúsculas; "en" em INGLÊS, 12–40 palavras, com TODOS os atributos visíveis que o material informa — cor, material, forma, quantidade, posição, roupa; "never" em INGLÊS com o que o material nega ou exclui para essa entidade ("" se nada).
• Copie os atributos do material. Não invente idade, etnia, marca, estampa ou detalhe ausente; o que o material não informa fica de fora da ficha.
• A ficha guarda o que NÃO muda. A imageQuery de cada card descreve só a cena: ação, estado do objeto naquele momento, ângulo e enquadramento.
• Material sem elementos visuais concretos: "visualBible": {"entities": []}.`;
}

/**
 * Bloco em inglês para o gerador de imagem. Vai junto do tema do card, e não
 * na "direção da marca": acrescentar a ficha não pode trocar a linguagem
 * visual que o projeto já recebia.
 */
export function composeSubjectsDirection(visualBible) {
  const bible = normalizeVisualBible(visualBible);
  if (!bible) return '';
  const linhas = bible.entities.map((e) => `- ${e.id}: ${e.en}${e.never ? ` NEVER: ${e.never}.` : ''}`);
  return (`PROJECT SUBJECTS — whenever one of these appears in the scene it must match this description exactly, and look the same in every image of this project:\n${linhas.join('\n')}\nDo not add attributes, accessories or objects that contradict these descriptions.`).slice(0, SUBJECTS_MAX);
}

/** Ficha + enquadramento do painel: tudo que descreve a cena deste card. */
export function composeSceneDirection({ visualBible = null, slide = null, fmt = 'carrossel' } = {}) {
  // Carrossel da biblioteca v4: a linguagem fotográfica da família chega ao
  // pedido real de imagem. Fica na cena (não na direção de marca), então uma
  // direção de marca ou referência enviada pela pessoa continua prevalecendo.
  const family = slide?.socialCompositionVersion >= 4 ? socialPhotoDirection(slide.socialFamily, 'en') : '';
  return [composeSubjectsDirection(visualBible), family ? `PHOTOGRAPHIC LANGUAGE: ${family}` : '', `FRAMING: ${imageFramingDirection(slide || {}, fmt)}`]
    .filter(Boolean).join('\n\n');
}

/**
 * MF-03 (lote B 21/11): a mesma pessoa mudava de rosto entre os cards. A
 * ficha em texto não segura identidade; uma imagem segura. A primeira imagem
 * gerada com a pessoa vira referência de identidade para os cards seguintes
 * em que ela aparece.
 */
const PERSON_WORDS = /\b(?:woman|women|man|men|person|people|baker|chef|cook|girl|boy|owner|founder|customer|client|worker|employee|teacher|doctor|nurse|lady|guy|female|male|she|he|her|him|his|face|portrait|mother|father|vendor|barista|seller)\b/i;

export function visualBibleHasPerson(visualBible) {
  const bible = normalizeVisualBible(visualBible);
  return !!bible?.entities.some(entity => PERSON_WORDS.test(`${entity.id} ${entity.en}`));
}

/** A cena deste card mostra a pessoa (não só mãos ou o produto). */
export function sceneShowsPerson(imageQuery, visualBible) {
  const bible = normalizeVisualBible(visualBible);
  const query = String(imageQuery || '');
  if (!bible || !query.trim()) return false;
  // Só a pessoa da ficha: "person holding a phone" pode ser um cliente e não
  // deve herdar o rosto da padeira. Vale o id da entidade ou as palavras de
  // pessoa da própria descrição (ex.: "woman", "baker").
  return bible.entities.some(entity => {
    if (!PERSON_WORDS.test(`${entity.id} ${entity.en}`)) return false;
    const own = new Set((`${entity.en}`.match(new RegExp(PERSON_WORDS.source, 'gi')) || []).map(word => word.toLowerCase())
      .filter(word => !['she', 'he', 'her', 'him', 'his', 'face', 'portrait', 'person', 'people', 'team'].includes(word)));
    const idHit = new RegExp(`\\b${entity.id.replace(/-/g, '[ -]')}\\b`, 'i').test(query);
    return idHit || [...own].some(word => new RegExp(`\\b${word}\\b`, 'i').test(query));
  });
}

export const PERSON_IDENTITY_DIRECTION = 'IDENTITY REFERENCE (explicitly requested): the LAST attached reference image shows the same person who appears in this scene. Reproduce exactly that person: same face, hair, skin tone, apparent age and build. Use that image ONLY for the person\'s identity. Do NOT copy its pose, action, camera angle, framing, objects or background: this image must show a clearly different moment, exactly as described in THEME OF THIS CARD.';

/** Primeira pessoa da ficha: é dela o rosto que a âncora segura. */
function firstPersonId(visualBible) {
  const bible = normalizeVisualBible(visualBible);
  return bible?.entities.find(entity => PERSON_WORDS.test(`${entity.id} ${entity.en}`))?.id || '';
}

/**
 * Reteste 21/11 (T04): a ficha segue em todo pedido de imagem, então o modelo
 * desenha a pessoa também em cenas cuja imageQuery não a cita ("storefront",
 * "team", "customer at counter"). Sem a âncora nessas cenas, o rosto mudava.
 * Toda imagem do projeto com pessoa na ficha recebe a âncora: pedido direto
 * quando a cena cita a pessoa, condicional quando não cita.
 */
export function planPersonAnchor({ visualBible = null, imageQuery = '', anchorUrl = null, refCount = 0 } = {}) {
  const id = firstPersonId(visualBible);
  const showsPerson = !!id && sceneShowsPerson(imageQuery, visualBible);
  const none = { refImages: [], direction: '', canBecomeAnchor: showsPerson && !anchorUrl };
  if (!id || !anchorUrl || refCount >= 4) return none;
  const others = 'Other people in the scene (customers, team members) are different people with their own faces; never give them this face.';
  const direction = showsPerson
    ? `${PERSON_IDENTITY_DIRECTION.replace('the same person who appears in this scene', `the same person "${id}" (see PROJECT SUBJECTS) who appears in this scene`)} ${others}`
    : `IDENTITY REFERENCE (explicitly requested): the LAST attached reference image shows the person "${id}" from PROJECT SUBJECTS. If "${id}" appears in this scene, reproduce exactly that person: same face, hair, skin tone, apparent age and build. Use that image ONLY for identity; do NOT copy its pose, camera angle, framing, objects or background. Do not add "${id}" or any person the THEME OF THIS CARD does not call for. ${others}`;
  return { refImages: [anchorUrl], direction, canBecomeAnchor: false };
}

/**
 * Refazer uma imagem só: a âncora é a foto já gerada de um card cuja cena
 * cita a pessoa (a mesma regra que escolhe a âncora na geração do projeto).
 */
export function pickPersonAnchorSlide(slides, visualBible, excludeSlideId = null) {
  if (!firstPersonId(visualBible) || !Array.isArray(slides)) return null;
  return slides.find(slide => slide && slide.id !== excludeSlideId && slide.bgImageId
    && sceneShowsPerson(slide.imageQuery, visualBible)) || null;
}
