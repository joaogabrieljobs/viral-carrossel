/**
 * Rótulo acima do título (docs/product/direcao-de-arte-imagens.md, parte 5).
 *
 * No deck da Apoteose do ChatGPT cada página tinha um rótulo curto em caixa
 * alta acima do título ("A FESTA", "O POSICIONAMENTO"). No Moont ele é o campo
 * opcional `eyebrow` do slide: 1 a 3 palavras, guardado em caixa alta e
 * desenhado pelas famílias que já têm rótulo de cabeçalho (token {kicker}) e
 * pelo modo livre. Fora do contrato, o rótulo sai inteiro (nunca é cortado).
 */
export const PRESENTATION_EYEBROW_MAX_WORDS = 3;
export const PRESENTATION_EYEBROW_MAX_CHARS = 32;
/** Piso de leitura do rótulo num slide de 1920 px. */
export const PRESENTATION_EYEBROW_MIN_PX = 24;

const EDGE = /^[\s·•|:;,.\-–—]+|[\s·•|:;,.\-–—]+$/gu;

export function normalizePresentationEyebrow(value) {
  if (typeof value !== 'string') return '';
  const text = value.replace(/\*\*/g, '').replace(/["“”«»]/g, '').replace(/\s+/g, ' ').replace(EDGE, '').trim();
  if (!text) return '';
  if (text.split(' ').length > PRESENTATION_EYEBROW_MAX_WORDS || text.length > PRESENTATION_EYEBROW_MAX_CHARS) return '';
  return text.toLocaleUpperCase('pt-BR');
}

/**
 * Regras de redação do título e do rótulo, para todas as apresentações (v2 e
 * v3, inclusive pitch). As regras de fato e de repetição continuam as mesmas.
 */
export const PRESENTATION_TITLE_EYEBROW_RULES = `- Título curto e de autor: até 6 palavras quando possível, como uma manchete ("Brasil na pista"), e não repete o subtitle nem o eyebrow. Estenda somente para preservar um número ou condição essencial.
- eyebrow (opcional): rótulo acima do título com 1 a 3 palavras em CAIXA ALTA que nomeia a seção ou o tema da página ("A FESTA", "O PÚBLICO"); use "" quando não acrescentar. Sem número, promessa ou fato novo; não conta como título.`;
