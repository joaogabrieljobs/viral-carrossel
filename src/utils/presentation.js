/**
 * Modo Apresentação (estilo Gamma) — mesmo motor de carrossel, formato 16:9
 * e arco de deck (capa → agenda → corpo → fecho).
 */

export const APRESENTACAO_PRESET_ID = 'apresentacao';

export function isApresentacaoPreset(presetId) {
  return presetId === APRESENTACAO_PRESET_ID;
}

/** Defaults ao criar / alternar para apresentação. */
export function presentationDocPatch() {
  return {
    creativePreset: APRESENTACAO_PRESET_ID,
    fmt: 'apresentacao',
    mode: 'editorial',
    quickCardCount: '10',
    slideTextDensity: '1_2',
    cardVisualStyle: 'full',
    autoAdjustOnGenerate: true,
  };
}

/**
 * Pacote estratégico para decks 16:9 (pitch, aula, proposta, relatório curto).
 * Distribui funções pelo N de slides — Gamma-like sem inventar produto paralelo.
 */
export function buildApresentacaoPackBlock(slideCount) {
  const n = Math.min(16, Math.max(5, slideCount | 0));
  return `
PACOTE ATIVO — APRESENTAÇÃO / DECK 16:9 (prioridade sobre fórmulas de carrossel Instagram):
Você está a criar SLIDES DE APRESENTAÇÃO (paisagem), não cards de feed vertical.
Pense em Gamma / pitch deck / aula: uma ideia por slide, tipografia dominante, pouco texto.

Validação do pedido:
- Qual é a decisão ou aprendizagem que o público deve levar?
- Qual é o público na sala (cliente, investidor, time, alunos)?

Arco de referência (distribua as FUNÇÕES pelos ${n} slides — se N menor, una etapas; se maior, aprofunde com evidência):

S1 CAPA · título da apresentação + subtítulo com promessa ou contexto (para quem / o quê).
S2 AGENDA ou PROBLEMA · 3–5 pontos do percurso OU o problema concreto que motiva o deck.
S3–S${Math.max(3, n - 2)} CORPO · um argumento por slide: tese curta em "title", desenvolvimento em "subtitle" (2–4 frases ou bullets separados por " · "). Sem sanduíche de foto Instagram; imageQuery só quando a imagem ilustra o ponto.
PENÚLTIMO (se N≥6) · SÍNTESE · o que ficou claro / quadro-resumo.
ÚLTIMO (posição ${n}) · FECHO · próximo passo, CTA ou pergunta de decisão — nunca lista interminável.

REGRAS DE CAMPO (JSON do app):
- "title": curto, 3–10 palavras, legível em 16:9 a distância.
- "subtitle": o corpo do slide — frases completas ou itens separados por " · " (não use markdown de lista).
- "bodyAfterImage": quase sempre "" (vazio). Só use se precisar de uma linha de rodapé factual.
- "imageQuery": inglês, 8–15 palavras, opcional; capa e fecho podem ter imagem atmosférica; miolo só se ajudar.
- NÃO escreva "Slide 1" no título. NÃO use jargão de Instagram (salvar, comentar, feed).

TOM: profissional, claro, concreto. Preferir substantivos e verbos de decisão a adjetivos vazios.
`;
}

export function buildApresentacaoIntroLine() {
  return 'Atue como designer de apresentações e estrategista de narrativa. Produza um DECK 16:9 (não carrossel Instagram): uma ideia por slide, tipografia dominante, JSON válido apenas — sem markdown, sem texto extra.';
}

export function buildApresentacaoRefineHint() {
  return '- Pacote Apresentação 16:9: title curto; subtitle = corpo (frases ou itens com " · "); bodyAfterImage vazio salvo rodapé factual. Não force sanduíche de foto nem CTAs de Instagram.';
}
