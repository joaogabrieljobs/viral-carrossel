/**
 * Acabamento do texto do deck no modo livre, depois da redação e sem IA
 * (Teste 6 da Apoteose, 26/11):
 *
 * - item 6: a personalidade em pares ("Brasileira sem ser caricata.
 *   Sofisticada sem ser pretensiosa. ...") vira o bloco comparison de duas
 *   colunas (traço / "sem ser…", até 7 linhas), tirado do próprio texto, e a
 *   página fica só com título e tabela, sobre a arte de fundo;
 * - negrito do roteiro (applyPlanEmphasisToDraft);
 * - item 5: eyebrow em todas as páginas menos a capa. O que a IA escreveu
 *   fica; vazio, o código deriva um rótulo curto pelo tema do texto (A MÚSICA,
 *   O PÚBLICO...) ou pela função do slide no roteiro. Nunca um fato.
 */
import { applyPlanEmphasisToDraft } from './free-design.js';
import { normalizePresentationEyebrow } from './presentation-eyebrow.js';
import { contentLabelLanguage } from './content-label-language.js';
import { COMPARISON_PAIRS_MAX_ROWS } from './presentation-quality.js';

/* Item 6: personalidade em pares ------------------------------------------ */

export const PERSONALITY_PAIRS_MIN = 3;
// "Traço sem ser/sem depender/sem recorrer/sem perder/sem cair …": o traço tem
// 1 ou 2 palavras. O Teste 7 veio como lista em minúsculas depois de dois
// pontos, com vírgulas entre os pares. Só separa uma vírgula quando o trecho
// seguinte inicia outro par completo; vírgulas dentro de uma ressalva ficam.
const TRAIT = String.raw`[\p{L}][\p{L}-]*(?:\s[\p{L}-]+)?`;
const WITHOUT = String.raw`sem\s+(?:ser|depender|recorrer|perder|cair|virar|parecer|soar)\b`;
const PAIR = new RegExp(String.raw`^(${TRAIT})\s+(${WITHOUT}[^.!?]*[.!?]?)$`, 'u');
const PAIR_SEPARATOR = new RegExp(String.raw`(?<=[.!?])\s+|[,;]\s*(?=${TRAIT}\s+${WITHOUT})|(?<=:)\s*(?=${TRAIT}\s+${WITHOUT})`, 'u');
const sentencesOf = text => String(text || '').replace(/\*\*/g, '').split(PAIR_SEPARATOR).map(s => s.trim()).filter(Boolean);

/** Pares [traço, "sem ser…"] na ordem do texto; menos de 3 pares, []. */
export function personalityPairs(text) {
  const pairs = sentencesOf(text).map(sentence => PAIR.exec(sentence)).filter(Boolean)
    .map(match => [match[1].trim(), /[.!?]$/.test(match[2]) ? match[2].trim() : `${match[2].trim()}.`]);
  return pairs.length >= PERSONALITY_PAIRS_MIN ? pairs : [];
}

/**
 * Slide com 3 ou mais pares no apoio e sem bloco: o bloco comparison de pares
 * (variant 'pairs', até 7 linhas, só no modo livre) sai do texto. A página
 * fica só com título e tabela, como a página 10 do alvo do ChatGPT, para a
 * arte de fundo caber: o resto do apoio e o corpo vão para as notas do
 * apresentador, sem se perder. Mais de 7 pares, ou sem pares: volta igual.
 */
export function personalityComparison(slide) {
  if (!slide || typeof slide !== 'object') return slide;
  const blocks = Array.isArray(slide.presentationBlocks) ? slide.presentationBlocks : [];
  // A IA escreveu a tabela de pares no teto dela (5) e deixou o resto no apoio:
  // os pares do apoio entram na mesma tabela, até 7.
  const written = blocks.length === 1 && blocks[0]?.type === 'comparison' && Array.isArray(blocks[0].rows)
    && Array.isArray(blocks[0].headers) && blocks[0].headers.length === 2
    && blocks[0].rows.every(row => Array.isArray(row) && row.length === 2 && /^sem\s/i.test(String(row[1] || '')));
  if (blocks.length && !written) return slide;
  const inText = sentencesOf(slide.subtitle).map(sentence => PAIR.exec(sentence)).filter(Boolean)
    .map(match => [match[1].trim(), /[.!?]$/.test(match[2]) ? match[2].trim() : `${match[2].trim()}.`]);
  const pairs = written ? (inText.length ? [...blocks[0].rows, ...inText] : []) : personalityPairs(slide.subtitle);
  if (!pairs.length || pairs.length > COMPARISON_PAIRS_MAX_ROWS) return slide;
  const rest = sentencesOf(slide.subtitle).filter(sentence => !PAIR.test(sentence)).join(' ');
  const notes = [slide.speakerNotes, rest, String(slide.bodyAfterImage || '').replace(/\*\*/g, '').trim()]
    .map(value => String(value || '').trim()).filter(Boolean).join('\n');
  const design = slide.presentationPlan?.design;
  return {
    ...slide,
    subtitle: '',
    bodyAfterImage: '',
    ...(notes ? { speakerNotes: notes.slice(0, 6000) } : {}),
    presentationBlocks: [{ type: 'comparison', variant: 'pairs', headers: ['Traço', 'Sem ser'], rows: pairs }],
    ...(design && typeof design === 'object'
      ? { presentationPlan: { ...slide.presentationPlan, design: { ...design, block: 'comparison', icons: [] } } } : {}),
  };
}

/* Item 5: eyebrow ------------------------------------------------------------ */

// Rótulo pela função do slide no roteiro (purpose), nos três idiomas.
const PURPOSE_EYEBROWS = Object.freeze({
  introduction: ['ABERTURA', 'OPENING', 'APERTURA'],
  problem: ['O PROBLEMA', 'THE PROBLEM', 'EL PROBLEMA'],
  context: ['CONTEXTO', 'CONTEXT', 'CONTEXTO'],
  solution: ['A PROPOSTA', 'THE PROPOSAL', 'LA PROPUESTA'],
  comparison: ['COMPARAÇÃO', 'COMPARISON', 'COMPARACIÓN'],
  business_model: ['O MODELO', 'THE MODEL', 'EL MODELO'],
  journey: ['A JORNADA', 'THE JOURNEY', 'EL RECORRIDO'],
  process: ['O PROCESSO', 'THE PROCESS', 'EL PROCESO'],
  evidence: ['AS EVIDÊNCIAS', 'THE EVIDENCE', 'LA EVIDENCIA'],
  metrics: ['OS NÚMEROS', 'THE NUMBERS', 'LAS CIFRAS'],
  market: ['O MERCADO', 'THE MARKET', 'EL MERCADO'],
  team: ['A EQUIPE', 'THE TEAM', 'EL EQUIPO'],
  roadmap: ['PRÓXIMOS PASSOS', 'NEXT STEPS', 'PRÓXIMOS PASOS'],
  decision: ['A DECISÃO', 'THE DECISION', 'LA DECISIÓN'],
  summary: ['SÍNTESE', 'SUMMARY', 'SÍNTESIS'],
  learning: ['APRENDIZADOS', 'LEARNINGS', 'APRENDIZAJES'],
  practice: ['NA PRÁTICA', 'IN PRACTICE', 'EN LA PRÁCTICA'],
  case_study: ['O CASO', 'THE CASE', 'EL CASO'],
  vision: ['A VISÃO', 'THE VISION', 'LA VISIÓN'],
  objection: ['AS DÚVIDAS', 'THE QUESTIONS', 'LAS DUDAS'],
  other: ['EM FOCO', 'IN FOCUS', 'EN FOCO'],
});
const LANG_INDEX = { 'pt-BR': 0, pt: 0, en: 1, es: 2 };

// Tema que o próprio texto nomeia (português). A ordem decide o empate.
const THEMES = Object.freeze([
  ['A PERSONALIDADE', /\bpersonalidade\b|(?:\bsem (?:ser|depender|recorrer)\b.*){2}/],
  ['A MÚSICA', /\b(?:musica|musical|musicais|djs?|pista|repertorio|hip-hop|funk|eletronica)\b/],
  // "Encontro" aparece como metáfora em muitos apoios; só nomeia o tema no título.
  ['O ENCONTRO', /\b(?:encontro|encontros|reuniao|reunioes)\b/, true],
  ['O PÚBLICO', /\b(?:publico|convidados|frequenta|frequentadores|pessoas socialmente)\b/],
  ['O NOME', /\bo nome\b/],
  ['O POSICIONAMENTO', /\b(?:posicionamento|consolidar|ambicao)\b/],
  ['A COMUNICAÇÃO', /\b(?:comunicacao|linguagem|humor)\b/],
  ['O COMPORTAMENTO', /\bcomportament/],
  ['O UNIVERSO VISUAL', /\b(?:universo visual|identidade visual|fotografia|grafismos?)\b/],
]);

const plain = text => String(text || '').replace(/\*\*/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slideText = slide => plain([slide?.title, slide?.subtitle, slide?.bodyAfterImage,
  ...(Array.isArray(slide?.presentationBlocks) ? slide.presentationBlocks.map(block => JSON.stringify(block)) : [])].join('\n'));

/**
 * Rótulo derivado para um slide sem eyebrow. Capa: ''. Fecho: o nome da capa
 * (até 3 palavras), como "APOTEOSE". Os outros: o primeiro tema do texto
 * ainda não usado no deck; sem tema livre, a função do slide.
 */
export function deriveFreeEyebrow(slide, { index = 0, count = 1, used = new Set(), lang = 'pt-BR', coverTitle = '' } = {}) {
  const role = slide?.presentationPlan?.visualRole;
  if (index === 0 || role === 'cover') return '';
  const langIndex = LANG_INDEX[lang] ?? 0;
  if ((role === 'closing' || index === count - 1) && count > 1) {
    const name = normalizePresentationEyebrow(coverTitle);
    if (name && !used.has(name)) return name;
  }
  if (langIndex === 0) {
    // O título nomeia a ideia principal. Uma enumeração no apoio (música,
    // moda, arte...) não deve consumir o rótulo da página sobre música.
    for (const [text, title] of [[plain(slide?.title), true], [slideText(slide), false]]) {
      const theme = THEMES.find(([label, re, titleOnly]) => (title || !titleOnly) && !used.has(label) && re.test(text));
      if (theme) return theme[0];
    }
  }
  const purpose = PURPOSE_EYEBROWS[slide?.presentationPlan?.purpose] || PURPOSE_EYEBROWS.other;
  return purpose[langIndex];
}

/** Preenche o eyebrow vazio de cada página (menos a capa), sem repetir rótulo derivado. */
export function fillFreeEyebrows(draft, { lang } = {}) {
  if (!Array.isArray(draft?.slides) || !draft.slides.length) return draft;
  const language = lang || contentLabelLanguage(draft.slides);
  const used = new Set(draft.slides.map(slide => normalizePresentationEyebrow(slide?.eyebrow)).filter(Boolean));
  const coverTitle = draft.slides[0]?.title || '';
  let changed = false;
  const slides = draft.slides.map((slide, index) => {
    if (normalizePresentationEyebrow(slide?.eyebrow)) return slide;
    const eyebrow = deriveFreeEyebrow(slide, { index, count: draft.slides.length, used, lang: language, coverTitle });
    if (!eyebrow) return slide;
    used.add(eyebrow);
    changed = true;
    return { ...slide, eyebrow };
  });
  return changed ? { ...draft, slides } : draft;
}

/** Acabamento do modo livre: pares em comparação, negrito do roteiro e eyebrow. */
export function finishFreeDraft(draft) {
  if (!Array.isArray(draft?.slides)) return draft;
  let slides = draft.slides.map(personalityComparison);
  const compared = slides.some((slide, index) => slide !== draft.slides[index]) ? { ...draft, slides } : draft;
  const emphasized = applyPlanEmphasisToDraft(compared);
  return fillFreeEyebrows(emphasized);
}
