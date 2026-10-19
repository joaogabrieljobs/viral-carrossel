/** Contrato compartilhado entre redação, revisão e composição do Pitch. */
export const isPitchPath = (pathId) => ['pitch', 'pitch_deck', 'investor_pitch'].includes(pathId);

export function pitchTextLimits(kind = 'content') {
  const cover = kind === 'cover';
  const closing = kind === 'closing';
  return {
    title: { maxChars: 90, maxLines: 2 },
    subtitle: { maxChars: cover ? 220 : closing ? 320 : 360, maxLines: cover ? 4 : 8 },
    body: { maxChars: cover ? 120 : 180, maxLines: 4 },
    wordsPerSlide: 110,
  };
}

export function buildPitchFieldRules() {
  return `CAMPOS DO PITCH — LEITURA AUTÔNOMA:
- title: uma conclusão específica, até 90 caracteres e duas linhas. Não basta nomear a seção ("Problema", "Solução", "Mercado").
- subtitle é o desenvolvimento do argumento, não uma legenda: no miolo, escreva duas a quatro frases curtas, normalmente 220–360 caracteres. Conecte situação concreta, mecanismo e consequência. O piso é uma orientação, nunca motivo para inventar ou repetir.
- bodyAfterImage é um segundo bloco de conteúdo: evidência, exemplo real, detalhe operacional, comparação, implicação ou ressalva, até 180 caracteres. Complete o raciocínio sem repetir o subtitle. Pode ficar vazio quando não houver complemento útil; não o reserve a fontes.
- Capa: identifique empresa, produto, cliente e valor já na abertura; subtitle até 220 caracteres, bodyAfterImage até 120. Fecho: decisão e próximo passo, subtitle até 320 e bodyAfterImage até 180.
- Até 110 palavras por slide. Use frases completas e quebras apenas entre ideias; não use " · " para simular uma lista. Um argumento por slide, com apoio suficiente para ser entendido sem fala do apresentador.
- imageQuery pode ser "". Só peça uma imagem quando ela acrescentar contexto real; nunca peça um gráfico, uma tela de produto, um depoimento ou uma prova inventados. Os fatos, o fluxo e as comparações precisam estar no texto editável.
- Não use instruções de Instagram nem referências ao processo de extração. Preserve unidades, datas, condições e incertezas dos fatos usados.`;
}

export const PITCH_PROVENANCE_RULE = `ENTREGA FINAL AUTÔNOMA: escreva na voz da empresa, diretamente para o público. Não mencione o manual, seus autores ou exemplos, arquivos enviados, nomes de documentos, "matéria-prima", "conteúdo extraído", "segundo o material" ou rodapés "Fonte:". Essa regra vale para título, subtitle, bodyAfterImage e caption. A origem serve à conferência interna, não à narrativa final. Preserve ressalvas factuais e a distinção entre hipótese, plano e resultado real.`;

export function buildPitchStrategyBlock() {
  return `PITCH COMPLETO PARA LEITURA AUTÔNOMA — NÃO É TEASER NEM ROTEIRO DE PALESTRA.
O destinatário deve compreender o negócio, avaliar a oportunidade e saber qual decisão tomar apenas lendo o deck.

PREPARAÇÃO EDITORIAL (use para planejar; não exponha notas de análise):
1. Identifique público da decisão (investidor, parceiro ou liderança), estágio do negócio, produto, cliente, pagador e pedido. Se o público não estiver definido, apresente a lógica do negócio sem presumir uma rodada de investimento.
2. Faça um inventário do que está sustentado: fatos, números com unidade/período, mecanismo do produto, diferenciais demonstráveis, validações, restrições e planos. Separe fato realizado de hipótese e intenção. Use o manual como método; nunca transfira empresas, métricas ou casos ilustrativos dele para o negócio apresentado.
3. Selecione a tese e construa a sequência causal: dor concreta → impacto → mecanismo da solução → oportunidade acessível → prova → execução → decisão. Adapte a estrutura ao material e ao estágio, sem preencher seções com generalidades.

PROFUNDIDADE OBRIGATÓRIA, QUANDO O MATERIAL PERMITIR:
- Abertura: explique o que a empresa faz e para quem. Não esconda o produto até a metade do deck.
- Problema: descreva uma situação de uso, a alternativa atual e o custo ou consequência da dor. Mostre por que resolvê-la importa, além de um slogan.
- Por que agora: conecte uma mudança concreta à oportunidade. Não invente tendência, urgência ou estatística de mercado.
- Solução/produto: descreva entrada, ação e resultado de um uso real, como o mecanismo resolve a causa e quem recebe o valor. Demonstração pode ser textual; não dependa de uma foto futura.
- Mercado: delimite segmento inicial, geografia, comprador e acesso. Use TAM/SAM/SOM somente com números sustentados; sem dados, explique o recorte e a hipótese a validar, sem fabricar tamanho de mercado.
- Modelo de negócio: quem usa, quem paga, pelo quê e com qual recorrência ou lógica de receita. Preço, margem e unit economics apenas quando conhecidos.
- Alternativas: compare a solução atual e concorrentes por critérios relevantes. Explique o diferencial com mecanismo ou evidência, sem alegar que ninguém concorre.
- Tração e validação: diferencie operação, receita, pilotos, protótipo, licenças e aprendizados de metas futuras. Feedback, clientes e depoimentos só se existirem. Sem tração comprovada, apresente o teste e o critério de validação como plano.
- Aquisição: canal inicial, caminho até a adoção, retenção e hipótese de expansão; não liste canais sem explicar como funcionam para esse comprador.
- Equipe: relacione competências reais à execução. Nunca invente nomes, cargos, parceiros ou credenciais.
- Marcos, recursos e pedido: conecte a decisão solicitada ao trabalho, marco verificável e risco que será reduzido. Sem valor informado, não invente valuation ou captação. Feche com um próximo passo compatível com o estágio.
- Se faltar um dado essencial, formule a limitação ou hipótese de modo profissional ou una a seção a outra. Não escreva "não consta no documento", campos [preencher], números fictícios ou páginas vazias.

${buildPitchFieldRules()}
${PITCH_PROVENANCE_RULE}`;
}

export function buildPitchReviewRules() {
  return `REVISÃO DE PROFUNDIDADE DO PITCH:
Um slide de conteúdo com apenas título e slogan está incompleto. Desenvolva o argumento com os fatos já disponíveis no briefing: situação/mecanismo e consequência, mais evidência ou detalhe útil. Não trate "edits":[] como resposta aceitável para esse problema.
Confira se a abertura explica o negócio, a sequência sustenta a decisão e cada seção responde às perguntas de negócio. Corte redundância; não confunda mais texto com mais informação. Não acrescente fatos novos para atingir um mínimo.
subtitle e bodyAfterImage podem ser reescritos e ampliados dentro dos limites: ambos são conteúdo principal editável. Não remeta a uma imagem ausente para explicar a tese.
${PITCH_PROVENANCE_RULE}`;
}

/** Defesa para rodapés de extração comuns, inclusive se a revisão de IA falhar.
 * Não remove nomes de empresas, métricas, unidades nem qualificadores de risco. */
export function cleanPitchText(value) {
  return String(value ?? '')
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:[-*]\s*)?(?:\*\*)?(?:fonte|fontes|source|sources|referência de extração)\s*(?:\*\*)?\s*:/i.test(line))
    .map((line) => line.replace(/^\s*(?:segundo|conforme|de acordo com|com base n[oa])\s+(?:o|a|os|as)?\s*(?:material|documento|arquivo|conteúdo|manual)(?:\s+(?:enviado|fornecido|anexado|extraído|de referência))?\s*,\s*/i, ''))
    .join('\n').trim();
}

export function cleanPitchSlide(slide) {
  return {
    ...slide,
    ...Object.fromEntries(['title', 'subtitle', 'bodyAfterImage']
      .filter((field) => typeof slide[field] === 'string')
      .map((field) => [field, cleanPitchText(slide[field])])),
  };
}

/** Espaço de leitura compatível com os mesmos limites enviados ao modelo. */
export function pitchCompositionOverrides(base, slide, kind) {
  const cover = kind === 'cover';
  const withVisual = !!(slide.bgImage || slide.bgImageId || String(slide.imageQuery || '').trim());
  const previousTypography = base.presentationTypographyByComposition || {};
  const typography = previousTypography[kind] || {};
  return {
    ...base,
    align: 'left',
    overlay: 0,
    presentationContentMode: 'pitch',
    presentationRequiresImage: false,
    presentationTextLimits: pitchTextLimits(kind),
    titleSize: cover ? 55 : 46,
    subSize: 72,
    subLeading: 135,
    subTracking: 0,
    bodyAfterSize: 104,
    bodyLeading: 135,
    presentationTypographyByComposition: {
      ...previousTypography,
      [kind]: {
        ...typography,
        title: { ...typography.title, sizePercent: cover ? 55 : 46, leadingPercent: 110, case: 'normal' },
        subtitle: { ...typography.subtitle, sizePercent: 72, leadingPercent: 135, tracking: 0, case: 'normal' },
      },
    },
    canvas: {
      ...base.canvas,
      zones: {
        title: { x: 6, y: cover ? 23 : 12, w: 88, h: 22 },
        subtitle: { x: 6, y: cover ? 50 : 38, w: withVisual ? 55 : 82, h: cover ? 42 : 56 },
        photo: { x: 65, y: cover ? 50 : 39, w: 29, h: cover ? 40 : 49 },
      },
    },
  };
}
