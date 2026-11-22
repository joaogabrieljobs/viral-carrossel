/**
 * Sistema de sequência dos carrosséis: decide a FUNÇÃO de cada card a partir
 * da posição, do conteúdo real (foto, quadro, lista, tamanho do texto) e do
 * modo narrativo. Família visual e modo narrativo continuam independentes:
 * o modo muda o ritmo de funções, nunca a família nem o texto.
 */
import { socialTextLimits, visibleSocialText } from './social-generation.js';
import { normalizePresentationBlocks } from './presentation-quality.js';
import { SOCIAL_COMPOSERS } from './social-families.js';
import { scaledCeiling } from './generation-prompts.js';

/**
 * Matriz modo narrativo × função visual (documentada para revisão).
 *  - shortStatement: até quantos caracteres de título + apoio um card sem foto
 *    vira afirmação tipográfica (0 = só quando o card é muito curto).
 *  - listFromText: o modo trata cards com itens em linha como lista/etapas.
 *  - stepNumbers: os cards de desenvolvimento ganham numeração de etapa.
 *  - rhythm: descrição da alternância esperada; vai ao prompt como "Ritmo" e
 *    só pede etapas que o material sustenta (catálogo 22/11).
 */
export const NARRATIVE_VISUAL_MATRIX = Object.freeze({
  none: { shortStatement: 70, listFromText: true, stepNumbers: false, rhythm: 'Siga a organização solicitada pelo usuário; use a ordem do briefing apenas quando ela fizer parte do pedido.' },
  editorial: { shortStatement: 80, listFromText: true, stepNumbers: false, rhythm: 'Tese sustentada → argumento → evidência fornecida → consequência → fecho; não crie etapa sem apoio.' },
  how_to: { shortStatement: 40, listFromText: true, stepNumbers: true, rhythm: 'Objetivo do procedimento → passos reais em ordem → conclusão; um passo por card, sem comprimir vários passos em lista.' },
  storytelling: { shortStatement: 110, listFromText: false, stepNumbers: false, rhythm: 'Ação ou processo fornecido → mudança documentada, se houver → sequência e desfecho sustentados; sem personagem ou virada fabricados.' },
  viral: { shortStatement: 110, listFromText: true, stepNumbers: false, rhythm: 'Gancho honesto → respostas progressivas → conclusão; cada card entrega informação, sem esconder a resposta por obrigação.' },
  pain: { shortStatement: 100, listFromText: true, stepNumbers: false, rhythm: 'Dificuldade fornecida → obstáculo ou causa sustentada → saída oferecida; não exija lista nem causa não comprovada.' },
  deep: { shortStatement: 60, listFromText: true, stepNumbers: false, rhythm: 'Pergunta delimitada → relações ou mecanismos fornecidos → demonstração sustentada → implicações; não invente causas ou exemplos.' },
  jornalistico: { shortStatement: 50, listFromText: true, stepNumbers: false, rhythm: 'Fato principal → contexto fornecido → detalhe relevante → implicação sustentada; não repita o fato da capa.' },
  sensacionalista: { shortStatement: 120, listFromText: true, stepNumbers: false, rhythm: 'Contrastes sustentados e afirmações curtas alternadas com explicação ou evidência; sem urgência, prova ou surpresa fabricadas.' },
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
 * limites: repete os tetos do contrato da densidade escolhida e diz como
 * distribuir o texto (afirmação curta, lista só quando é lista, foto com
 * legenda), para que os cards tenham ritmo sem inventar conteúdo.
 */
export function buildSocialSequencePrompt({ family = null, narrative = 'editorial', densityId } = {}) {
  const f = SOCIAL_COMPOSERS[family];
  if (!f) return '';
  const m = NARRATIVE_VISUAL_MATRIX[narrative] || NARRATIVE_VISUAL_MATRIX.editorial;
  const limits = socialTextLimits({ densityId });
  return `SEQUÊNCIA VISUAL — ${f.kind === 'viral' ? 'estilo' : 'família'} ${f.label}. O app escolhe o layout.
- Ritmo: ${m.rhythm}
Capa: título de até 8 palavras e subtítulo de uma frase ou vazio. Nos demais cards, título de até ${limits.titleWords} palavras e ${limits.title} caracteres. Para uma afirmação que caiba sozinha no título, deixe subtitle e bodyAfterImage vazios. Use essa composição no máximo uma vez a cada três cards.
Escreva em prosa por padrão. Use marcadores apenas no card que apresentar uma enumeração de itens independentes prevista no pedido ou no formato específico daquele card. A sequência narrativa entre cards não é uma enumeração. Em uma lista legítima, use um item fornecido por linha, prefixado por "- " ou por número quando a ordem for relevante. Use no máximo 5 itens de até 45 caracteres cada, e aplique o menor teto ativo de linhas e caracteres. Se a enumeração não couber, exponha a ideia em prosa dentro do teto e preserve as condições essenciais.
Desenvolva uma ideia por card. Nos cards com foto, use até duas frases curtas. O limite do subtitle dos dois primeiros cards é de ${scaledCeiling(80, densityId)} caracteres quando o layout híbrido correspondente estiver ativo. Respeite também os limites combinados de subtitle e bodyAfterImage. A imagem ilustra a ideia, e as condições essenciais ficam no texto. Para um card sem foto, deixe imageQuery vazia. Para fotografia, descreva a cena sem texto, gráfico, tabela ou logo incorporados.
No fecho, use o CTA do pedido ou uma conclusão sustentada. Preserve as condições da oferta.`;
}
