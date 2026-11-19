/**
 * Sistema de sequência dos carrosséis: decide a FUNÇÃO de cada card a partir
 * da posição, do conteúdo real (foto, quadro, lista, tamanho do texto) e do
 * modo narrativo. Família visual e modo narrativo continuam independentes:
 * o modo muda o ritmo de funções, nunca a família nem o texto.
 */
import { visibleSocialText } from './social-generation.js';
import { normalizePresentationBlocks } from './presentation-quality.js';
import { SOCIAL_COMPOSERS } from './social-families.js';

/**
 * Matriz modo narrativo × função visual (documentada para revisão).
 *  - shortStatement: até quantos caracteres de título + apoio um card sem foto
 *    vira afirmação tipográfica (0 = só quando o card é muito curto).
 *  - listFromText: o modo trata cards com itens em linha como lista/etapas.
 *  - stepNumbers: os cards de desenvolvimento ganham numeração de etapa.
 *  - rhythm: descrição da alternância esperada.
 */
export const NARRATIVE_VISUAL_MATRIX = Object.freeze({
  none: { shortStatement: 70, listFromText: true, stepNumbers: false, rhythm: 'Segue a ordem do briefing; foto onde houver, afirmação só para frases curtas.' },
  editorial: { shortStatement: 80, listFromText: true, stepNumbers: false, rhythm: 'Tese → argumento → evidência (foto/quadro) → consequência → fecho.' },
  how_to: { shortStatement: 40, listFromText: true, stepNumbers: true, rhythm: 'Promessa → etapas numeradas em progressão → recapitulação.' },
  storytelling: { shortStatement: 110, listFromText: false, stepNumbers: false, rhythm: 'Cena (foto) → virada (afirmação) → consequência (desenvolvimento), alternados.' },
  viral: { shortStatement: 110, listFromText: true, stepNumbers: false, rhythm: 'Gancho forte → revelação em afirmações curtas → resposta.' },
  pain: { shortStatement: 100, listFromText: true, stepNumbers: false, rhythm: 'Dor reconhecida (afirmação) → causa (desenvolvimento) → saída (lista).' },
  deep: { shortStatement: 60, listFromText: true, stepNumbers: false, rhythm: 'Contexto → causas → exemplo → implicações; mais desenvolvimento, poucas afirmações.' },
  jornalistico: { shortStatement: 50, listFromText: true, stepNumbers: false, rhythm: 'Fato (capa) → contexto → dados (quadro) → por que importa.' },
  sensacionalista: { shortStatement: 120, listFromText: true, stepNumbers: false, rhythm: 'Contraste alto: afirmações curtas alternadas com prova; fatos fiéis ao briefing.' },
});

const LIST_LINE = /^\s*(?:[-•–·▪●]|\d{1,2}[.)]|[a-e][.)])\s+\S/;

export function textListItems(slide) {
  const lines = [slide?.subtitle, slide?.bodyAfterImage].filter(Boolean).join('\n').split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.filter((l) => LIST_LINE.test(l));
}

const chars = (v) => Array.from(visibleSocialText(v || '')).length;
const hasPhoto = (s) => !!(s?.imageQuery || s?.bgImage || s?.bgImageId || s?.bgImageAssetId);

/**
 * @returns {string[]} uma função por card (ver SOCIAL_FUNCTIONS)
 */
export function assignSocialFunctions(slides, { narrative = 'editorial' } = {}) {
  const m = NARRATIVE_VISUAL_MATRIX[narrative] || NARRATIVE_VISUAL_MATRIX.editorial;
  const n = slides.length;
  const out = slides.map((slide, i) => {
    if (i === 0) return 'cover';
    if (i === n - 1 && n > 1) return 'closing';
    const blocks = normalizePresentationBlocks(slide.presentationBlocks);
    if (blocks[0]?.type === 'comparison' || blocks[0]?.type === 'metrics') return 'comparison';
    if (blocks[0]?.type === 'steps') return 'list';
    if (m.listFromText && textListItems(slide).length >= 3) return 'list';
    if (hasPhoto(slide)) return 'photo';
    const total = chars(slide.title) + chars(slide.subtitle) + chars(slide.bodyAfterImage);
    if (total <= m.shortStatement && chars(slide.title) <= 90) return 'statement';
    if (i === 1) return 'opener';
    return 'development';
  });
  // Ritmo: duas afirmações seguidas perdem força; a segunda volta a ser
  // desenvolvimento quando há texto de apoio para desenvolver.
  for (let i = 1; i < out.length; i += 1) {
    if (out[i] !== 'statement' || out[i - 1] !== 'statement') continue;
    // Volta a desenvolvimento o card que tem apoio para desenvolver.
    if (chars(slides[i].subtitle) > 0) out[i] = 'development';
    else if (chars(slides[i - 1].subtitle) > 0) out[i - 1] = i - 1 === 1 ? 'opener' : 'development';
  }
  return out;
}

/** Variante de ritmo: alterna a geometria de funções que se repetem. */
export function rhythmVariants(functions) {
  const seen = {};
  return functions.map((fn) => { seen[fn] = (seen[fn] ?? -1) + 1; return seen[fn]; });
}

/**
 * Bloco do prompt de texto para carrosséis da biblioteca v4. Não aumenta
 * limites: distribui o mesmo contrato por função, para que "Balanceado" vire
 * cards com ritmo (afirmação curta, lista em itens, foto com legenda) e não
 * um bloco de texto repetido em todos os cards.
 */
export function buildSocialSequencePrompt({ family = null, narrative = 'editorial' } = {}) {
  const f = SOCIAL_COMPOSERS[family];
  if (!f) return '';
  const m = NARRATIVE_VISUAL_MATRIX[narrative] || NARRATIVE_VISUAL_MATRIX.editorial;
  return `SEQUÊNCIA VISUAL (${f.kind === 'viral' ? 'estilo' : 'família'} ${f.label}; o texto continua seu, o layout é escolhido pelo app):
- Ritmo do modo: ${m.rhythm}
- Capa: title forte e curto (até 8 palavras); subtitle de uma frase ou vazio.
- Card de afirmação: quando a ideia cabe numa frase, escreva só o title (até 12 palavras) e deixe subtitle vazio. Use em no máximo um card a cada três.
- Lista/etapas: quando o conteúdo for de fato uma sequência, escreva 3 a 5 itens no subtitle, um por linha, começando com "- " (ou "1. " para etapas), cada item com até 45 caracteres.
- Card com foto: subtitle de até duas frases curtas; a imagem carrega parte da explicação.
- Desenvolvimento: uma ideia, subtitle de uma ou duas frases. Não repita o mesmo tamanho de texto em todos os cards.
- Encerramento: diga o próximo passo que o material sustenta; não invente oferta, preço, prazo ou benefício.
- Nunca escreva texto, título, gráfico, tabela ou logo para a imagem: a imageQuery descreve apenas a cena fotográfica.`;
}
