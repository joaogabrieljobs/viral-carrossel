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
import { composeFamilyTreatment as composeTreatmentBlock } from '../../shared/image-prompt.js';
import { socialPhotoDirection } from './social-families.js';
import { FREE_PRESENTATION_PRESET_ID, presentationPhotoDirection } from './presentation-families.js';
import { freePhotoDirectionEnglish } from './free-design.js';

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
  return `visualBible — ficha de continuidade do carrossel:
• Inclua até ${VISUAL_BIBLE_MAX_ENTITIES} entidades recorrentes ou pertinentes às imagens, uma por pessoa, objeto ou lugar descrito no material. Use um id curto em minúsculas por entidade e reutilize-o ao longo do projeto.
• Escreva en em inglês, com até 40 palavras, preferindo 12–40 quando houver atributos suficientes, como uma descrição completa dos atributos visíveis fornecidos. Preserve cor, material, forma, quantidade e roupa quando conhecidos. Reserve never, em inglês, para exclusões expressas do material. Se não houver exclusão, use "".
• Registre apenas o que identifica a entidade entre as cenas. A ação, o lugar momentâneo, a pose e o enquadramento pertencem à imageQuery. Posição só é atributo fixo quando faz parte do desenho do objeto ou lugar.
• Não deduza idade, etnia, marca, cargo, acessório, emoção ou aparência de uma pessoa pelo nome. Não complete a extensão com novos atributos. Mencione na cena apenas as entidades pertinentes.
• Sem entidades visuais fornecidas, devolva "visualBible": {"entities": []}.`;
}

/** Cabeçalho da ficha no pedido de imagem (catálogo final, I25). */
// Texto que estava no ar antes do catálogo: a versão curta do catálogo deixou o
// gerador pôr todos os elementos da ficha em todas as cenas (reteste de 22/11).
const SUBJECTS_HEADER = 'PROJECT SUBJECTS — whenever one of these appears in the scene it must match this description exactly, and look the same in every image of this project. These descriptions fix appearance only (face, hair, clothing, color, material, shape). Any action, pose or place written in them does not apply here: the SCENE decides action, pose, setting and which subjects appear. Do not add a subject the scene does not call for. Do not add attributes, accessories or objects that contradict these descriptions:';
const comPonto = (texto) => (/[.!?]$/.test(texto) ? texto : `${texto}.`);

/**
 * Bloco em inglês para o gerador de imagem. A ficha fixa aparência; ação, pose
 * e lugar vêm da cena (reteste 0b1cb62, E04: a ficha trazia ação e toda foto
 * repetia a mesma cena). Não conta como direção estética: acrescentá-la não
 * troca a linguagem visual do pedido.
 * O teto é aplicado em entidades inteiras, nunca no meio de uma linha.
 */
export function composeSubjectsDirection(visualBible, { excludeEntityIds = [] } = {}) {
  const bible = normalizeVisualBible(visualBible);
  if (!bible) return '';
  const excluded = new Set(excludeEntityIds);
  const entities = bible.entities.filter((e) => !excluded.has(e.id));
  if (!entities.length) return '';
  const linhas = [];
  let tamanho = SUBJECTS_HEADER.length;
  for (const e of entities) {
    const linha = `- ${e.id}: ${comPonto(e.en)}${e.never ? ` Exclude: ${comPonto(e.never)}` : ''}`;
    if (linhas.length && tamanho + 1 + linha.length > SUBJECTS_MAX) break;
    linhas.push(linha);
    tamanho += 1 + linha.length;
  }
  return `${SUBJECTS_HEADER}\n${linhas.join('\n')}`;
}

/** Tratamento da família visual, em inglês, para o gerador (I26). */
export function composeFamilyTreatment(familyEnglish) {
  return composeTreatmentBlock(familyEnglish);
}

/** Id de preset/padrão da biblioteca de apresentações gravado no slide. */
const libraryPresentationId = (slide) => {
  const id = String(slide?.presentationPresetId || slide?.presentationPatternId || '');
  return /^(?:pds\.|presentation_)/.test(id) ? id : '';
};

/**
 * Direção da família ativa, na versão inglesa do formato selecionado.
 * Carrossel: família da biblioteca social v4. Apresentação: família do deck —
 * `presentationFamily` explícita (a mesma chave enviada ao modelo de texto) ou
 * o preset da biblioteca gravado no slide. Sem família ativa, devolve ''.
 */
export function familyDirectionEnglish({ slide = null, fmt = 'carrossel', presentationFamily } = {}) {
  if (fmt === 'apresentacao') {
    const key = presentationFamily === undefined ? libraryPresentationId(slide) : presentationFamily;
    // Modo livre (fase 2): clima e paleta do deck, não a luz de uma família.
    if (key === FREE_PRESENTATION_PRESET_ID) return freePhotoDirectionEnglish(slide?.presentationDeckDesign);
    return key ? presentationPhotoDirection(key, 'en') : '';
  }
  return slide?.socialCompositionVersion >= 4 ? socialPhotoDirection(slide.socialFamily, 'en') : '';
}

/**
 * Partes da cena deste card, cada uma no seu bloco do pedido: enquadramento do
 * painel (I27–I30), ficha visual (I25) e família em inglês (I26).
 */
export function composeSceneParts({ visualBible = null, slide = null, fmt = 'carrossel', excludeEntityIds = [], presentationFamily, compositionAware = false } = {}) {
  return {
    framing: compositionAware
      ? [imageFramingDirection(slide || {}, fmt, { overlayNote: false, base: false })].filter(Boolean).map(text => `FRAMING: ${text}`).join('')
      : `FRAMING: ${imageFramingDirection(slide || {}, fmt)}`,
    subjects: composeSubjectsDirection(visualBible, { excludeEntityIds }),
    familyEnglish: familyDirectionEnglish({ slide, fmt, presentationFamily }),
  };
}

/** As mesmas partes em um texto só, na ordem em que entram no pedido. */
export function composeSceneDirection(options = {}) {
  const partes = composeSceneParts(options);
  return [partes.framing, partes.subjects, composeFamilyTreatment(partes.familyEnglish)].filter(Boolean).join('\n\n');
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

/** Âncora de identidade (catálogo final, I24): a mesma pessoa volta e a âncora é o último anexo. */
export const PERSON_IDENTITY_DIRECTION = 'IDENTITY ANCHOR: The last attached image is the identity reference for the recurring person assigned to this scene. Match visible facial features, hair, skin tone and build. Use the project subject sheet for specified wardrobe. Use only the requested scene for action, pose, framing, setting and objects. Match neither the background nor the pose of the anchor unless the current scene calls for it.';

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
// Reteste 0b1cb62 (E04): a âncora em cena sem pessoa nenhuma fazia a padeira
// aparecer em toda foto, na mesma pose. Cena sem pessoa (pães, fachada, mãos
// com celular) não recebe a âncora e tira a pessoa da ficha deste pedido.
const SCENE_PEOPLE = /\b(?:staff|team|teams|people|person|persons|customer|customers|client|clients|worker|workers|employee|employees|woman|women|man|men|baker|bakers|chef|chefs|cook|cooks|vendor|seller|owner|crowd|family|friends|group|girl|boy|lady|guy|she|he|her|him|face|portrait)\b/i;

export function planPersonAnchor({ visualBible = null, imageQuery = '', anchorUrl = null, refCount = 0 } = {}) {
  const id = firstPersonId(visualBible);
  const showsPerson = !!id && sceneShowsPerson(imageQuery, visualBible);
  if (id && !showsPerson && !SCENE_PEOPLE.test(String(imageQuery || ''))) {
    return { refImages: [], direction: '', canBecomeAnchor: false, excludeEntityIds: [id] };
  }
  const none = { refImages: [], direction: '', canBecomeAnchor: showsPerson && !anchorUrl, excludeEntityIds: [] };
  if (!id || !anchorUrl || refCount >= 4) return none;
  // Cena que cita a pessoa: texto do catálogo (I24). O mapa de referências
  // liga a âncora ao id da ficha (`entityId`).
  // Cena com gente, mas que não cita a pessoa (reteste T04): o catálogo final
  // não cobre este caso; a variante condicional é mantida com o vocabulário
  // dos blocos novos para não devolver o rosto trocado em cenas de equipe.
  const direction = showsPerson
    ? PERSON_IDENTITY_DIRECTION
    : `IDENTITY ANCHOR: The last attached image is the identity reference for "${id}" from PROJECT SUBJECTS. Only if "${id}" appears in this scene, match visible facial features, hair, skin tone and build. Use only the requested scene for action, pose, framing, setting and objects. Do not add "${id}" or any person the scene does not call for. Other people in the scene are different people with their own faces.`;
  return { refImages: [anchorUrl], direction, canBecomeAnchor: false, excludeEntityIds: [], entityId: id };
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
