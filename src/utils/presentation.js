/**
 * Domínio do modo Apresentação.
 *
 * O editor é compartilhado com o carrossel, mas intenção, arco narrativo e
 * formato pertencem a um produto diferente. Este módulo concentra essas
 * decisões para a UI e os prompts não precisarem inferi-las por texto solto.
 */

export const APRESENTACAO_PRESET_ID = 'apresentacao';
export const PRESENTATION_PRODUCT_KIND = 'apresentacao';
export const DEFAULT_PRESENTATION_PATH_ID = 'auto';
export const PRESENTATION_SLIDE_LIMITS = Object.freeze({ min: 5, max: 16 });

export function isApresentacaoPreset(presetId) {
  return presetId === APRESENTACAO_PRESET_ID;
}

const path = (definition) => Object.freeze({
  productKind: PRESENTATION_PRODUCT_KIND,
  creativePreset: APRESENTACAO_PRESET_ID,
  deliveryMode: 'hybrid',
  density: 'low',
  ...definition,
  stages: Object.freeze(definition.stages.map((stage) => Object.freeze({
    headlineMode: 'assertion',
    visualRole: 'evidence',
    density: definition.density || 'low',
    evidenceRequired: false,
    ...stage,
  }))),
});

/**
 * Caminhos próprios de deck. `stages` descreve funções narrativas, não textos
 * prontos: a geração adapta o número de slides sem preencher o deck com
 * conteúdo fictício.
 */
export const PRESENTATION_PATHS = Object.freeze([
  path({
    id: 'auto',
    label: 'Auto',
    shortLabel: 'Automático',
    description: 'A IA escolhe a estrutura a partir do tema, público e resultado esperado.',
    intent: 'Descobrir o melhor arco para explicar, convencer ou orientar com clareza.',
    deliveryMode: 'hybrid',
    defaultSlideCount: 10,
    suggestedVisualPreset: 'presentation_executive_light',
    stages: [
      { label: 'CAPA', instruction: 'Título da apresentação e promessa ou contexto em uma linha.', headlineMode: 'topic', visualRole: 'context' },
      { label: 'CONTEXTO OU MAPA', instruction: 'Mostre por que o assunto importa e, quando ajudar, o percurso do deck.', visualRole: 'diagram' },
      { label: 'CORPO', instruction: 'Desenvolva uma afirmação verificável por slide, apoiada por evidência, exemplo, dado ou diagrama.', evidenceRequired: true },
      { label: 'SÍNTESE', instruction: 'Reúna as conclusões que sustentam a decisão ou aprendizagem.', visualRole: 'summary' },
      { label: 'FECHO', instruction: 'Declare a decisão, aprendizagem ou próximo passo.', visualRole: 'decision' },
    ],
  }),
  path({
    id: 'pitch',
    label: 'Pitch',
    shortLabel: 'Pitch',
    description: 'Apresenta oportunidade, solução, evidências e pedido com ritmo de decisão.',
    intent: 'Levar investidores, parceiros ou liderança a entender a oportunidade e tomar uma decisão.',
    deliveryMode: 'leave-behind',
    density: 'medium',
    defaultSlideCount: 13,
    suggestedVisualPreset: 'presentation_pitch_dark',
    stages: [
      { label: 'EMPRESA E PROPÓSITO', instruction: 'Defina em uma frase o que muda, para quem e por que a empresa existe.', headlineMode: 'topic', visualRole: 'context' },
      { label: 'CLIENTE E PROBLEMA', instruction: 'Mostre o usuário, a dor concreta, o custo da dor e a alternativa atual.' },
      { label: 'POR QUE AGORA', instruction: 'Explique a mudança de tecnologia, comportamento ou mercado que abre a oportunidade.', evidenceRequired: true },
      { label: 'SOLUÇÃO E MECANISMO', instruction: 'Explique o produto e como ele resolve a causa central do problema.', visualRole: 'diagram' },
      { label: 'PRODUTO OU DEMONSTRAÇÃO', instruction: 'Mostre o fluxo, screenshot ou experiência principal; evite fotografia decorativa.', visualRole: 'demo' },
      { label: 'MERCADO E CLIENTE IDEAL', instruction: 'Delimite público e oportunidade apenas com dados fornecidos e fonte.', visualRole: 'data', evidenceRequired: true },
      { label: 'TRAÇÃO E PROVA', instruction: 'Apresente a métrica principal com período, unidade, comparação e fonte.', visualRole: 'data', evidenceRequired: true },
      { label: 'MODELO DE NEGÓCIO', instruction: 'Mostre pagador, lógica de receita e preço somente quando informados.', visualRole: 'diagram' },
      { label: 'ALTERNATIVAS E VANTAGEM', instruction: 'Compare concorrentes e solução atual; declare a vantagem sem caricaturar as opções.', visualRole: 'comparison', evidenceRequired: true },
      { label: 'AQUISIÇÃO', instruction: 'Explique como o público chega ao produto e qual hipótese ainda precisa ser validada.' },
      { label: 'EQUIPE', instruction: 'Mostre por que este time tem capacidade específica para executar a proposta.', visualRole: 'people' },
      { label: 'MARCOS E RECURSOS', instruction: 'Relacione plano, uso dos recursos e marco financiado; não invente projeções.' },
      { label: 'PEDIDO', instruction: 'Declare valor, recurso, decisão ou próximo encontro e o que ele viabiliza.', visualRole: 'decision' },
      { label: 'VISÃO DE FUTURO', instruction: 'Feche com a nova realidade possível se o plano for executado.', density: 'minimal', visualRole: 'vision' },
    ],
  }),
  path({
    id: 'aula_workshop',
    label: 'Aula / Workshop',
    shortLabel: 'Aula',
    description: 'Organiza objetivos, conceitos, exemplos e prática para facilitar aprendizagem.',
    intent: 'Fazer o público compreender e aplicar um conceito ao final da sessão.',
    deliveryMode: 'live',
    defaultSlideCount: 12,
    suggestedVisualPreset: 'presentation_workshop',
    stages: [
      { label: 'RELEVÂNCIA E DIAGNÓSTICO', instruction: 'Conecte o tema ao público e abra com uma pergunta curta que revele o ponto de partida.', visualRole: 'question' },
      { label: 'OBJETIVOS OBSERVÁVEIS', instruction: 'Diga o que o participante será capaz de explicar, decidir ou fazer ao final.', visualRole: 'objectives' },
      { label: 'MAPA DA SESSÃO', instruction: 'Mostre os blocos e onde haverá prática, pausa e síntese.', headlineMode: 'topic', visualRole: 'agenda' },
      { label: 'CONCEITO', instruction: 'Explique uma ideia por vez, com linguagem adequada ao conhecimento prévio do público.', visualRole: 'diagram' },
      { label: 'EXEMPLO RESOLVIDO', instruction: 'Demonstre o conceito em um caso concreto, expondo raciocínio e critério.', visualRole: 'example' },
      { label: 'VERIFICAÇÃO RÁPIDA', instruction: 'Faça uma pergunta que permita checar entendimento antes de avançar.', visualRole: 'question' },
      { label: 'ATIVIDADE', instruction: 'Declare objetivo, instrução, tempo, formato, material e entrega esperada.', density: 'medium', visualRole: 'instructions' },
      { label: 'DEBRIEF', instruction: 'Mostre resposta ou critério, erro comum e pergunta de reflexão após a prática.', visualRole: 'discussion' },
      { label: 'NOVO BLOCO', instruction: 'Repita conceito → exemplo → verificação → prática apenas quando o escopo exigir.', optionalWhenMissing: true },
      { label: 'SÍNTESE POR BLOCOS', instruction: 'Agrupe os princípios essenciais sem repetir o roteiro falado.', visualRole: 'summary' },
      { label: 'TRANSFERÊNCIA', instruction: 'Aplique a aprendizagem a um contexto novo para testar compreensão.', visualRole: 'application' },
      { label: 'PRÓXIMA AÇÃO E RECURSOS', instruction: 'Feche com tarefa, material de apoio e forma de continuidade.', visualRole: 'decision' },
    ],
  }),
  path({
    id: 'proposta_comercial',
    label: 'Proposta comercial',
    shortLabel: 'Proposta',
    description: 'Conecta diagnóstico, solução, escopo, cronograma e decisão comercial.',
    intent: 'Dar segurança para o cliente avaliar valor, escopo e próximo passo.',
    deliveryMode: 'leave-behind',
    density: 'medium',
    defaultSlideCount: 12,
    suggestedVisualPreset: 'presentation_executive_light',
    stages: [
      { label: 'CAPA PERSONALIZADA', instruction: 'Nomeie proposta, cliente e resultado central sem slogan genérico.', headlineMode: 'topic', visualRole: 'context' },
      { label: 'RESUMO DE VALOR', instruction: 'Resuma situação, resultado desejado e proposta em linguagem do cliente.' },
      { label: 'DESAFIO E IMPACTO', instruction: 'Demonstre entendimento do cenário e do efeito atual no negócio.', evidenceRequired: true },
      { label: 'OBJETIVOS E SUCESSO', instruction: 'Converta o pedido em resultados e critérios de sucesso verificáveis.' },
      { label: 'ABORDAGEM E BENEFÍCIO', instruction: 'Explique a solução, método, benefício e por que se encaixam no contexto.', visualRole: 'diagram' },
      { label: 'ESCOPO E ACEITE', instruction: 'Separe entregáveis e critérios de aceite sem inventar itens ausentes.', density: 'medium' },
      { label: 'CRONOGRAMA E DEPENDÊNCIAS', instruction: 'Organize etapas, marcos, dependências e responsabilidades conhecidas.', visualRole: 'timeline' },
      { label: 'PROVA PRÓXIMA', instruction: 'Apoie cada alegação relevante com caso, evidência ou processo real disponível.', visualRole: 'evidence', evidenceRequired: true },
      { label: 'INVESTIMENTO E CONDIÇÕES', instruction: 'Mostre opções, preço, validade e pagamento somente quando fornecidos.', visualRole: 'comparison' },
      { label: 'PRESSUPOSTOS E EXCLUSÕES', instruction: 'Declare limites, dependências, riscos e o que não está incluído.', density: 'medium' },
      { label: 'PLANO MÚTUO', instruction: 'Defina decisão, responsável, data e passos de ambos os lados.', visualRole: 'decision' },
      { label: 'PERGUNTAS', instruction: 'Feche abrindo diálogo, com contato ou próximo encontro quando informado.', density: 'minimal', visualRole: 'question' },
    ],
  }),
  path({
    id: 'relatorio_executivo',
    label: 'Relatório executivo',
    shortLabel: 'Relatório',
    description: 'Resume indicadores, achados, riscos e recomendações para liderança.',
    intent: 'Permitir leitura rápida da situação e decisão baseada nas evidências disponíveis.',
    deliveryMode: 'leave-behind',
    density: 'medium',
    defaultSlideCount: 11,
    suggestedVisualPreset: 'presentation_data',
    stages: [
      { label: 'ASSUNTO, PERÍODO E DECISÃO', instruction: 'Identifique recorte, período e a decisão que o relatório deve apoiar.', headlineMode: 'topic', visualRole: 'context' },
      { label: 'RESUMO EXECUTIVO', instruction: 'Antecipe de três a cinco conclusões e a decisão requerida.', visualRole: 'summary' },
      { label: 'SCORECARD', instruction: 'Mostre atual, meta, delta e tendência com unidade, período e fonte.', visualRole: 'data', evidenceRequired: true },
      { label: 'ACHADO', instruction: 'Use uma conclusão no título e uma evidência visual por slide.', visualRole: 'data', evidenceRequired: true },
      { label: 'IMPLICAÇÃO', instruction: 'Explique o que o achado muda para o negócio sem atribuir causalidade sem prova.' },
      { label: 'FATORES E HIPÓTESES', instruction: 'Separe fatores associados, hipóteses e limitações metodológicas.', density: 'medium', visualRole: 'analysis' },
      { label: 'RISCOS E OPORTUNIDADES', instruction: 'Priorize por impacto, probabilidade e urgência quando houver base.', visualRole: 'matrix', evidenceRequired: true },
      { label: 'RECOMENDAÇÕES', instruction: 'Ligue cada ação ao achado que a justifica e estime impacto e esforço quando possível.', visualRole: 'priorities' },
      { label: 'OPÇÕES E TRADE-OFFS', instruction: 'Compare escolhas reais e suas consequências para a decisão.', visualRole: 'comparison' },
      { label: 'DECISÃO REQUERIDA', instruction: 'Declare escolha, responsável, prazo e checkpoint somente quando informados.', visualRole: 'decision' },
      { label: 'APÊNDICE', instruction: 'Reserve método, definições, fontes e limitações para consulta.', density: 'medium', visualRole: 'source', optionalWhenMissing: true },
    ],
  }),
  path({
    id: 'estudo_de_caso',
    label: 'Estudo de caso',
    shortLabel: 'Caso',
    description: 'Conta contexto, intervenção e resultado com evidências e aprendizados.',
    intent: 'Demonstrar como uma transformação aconteceu e o que pode ser aprendido dela.',
    deliveryMode: 'hybrid',
    density: 'medium',
    defaultSlideCount: 11,
    suggestedVisualPreset: 'presentation_case_study',
    stages: [
      { label: 'RESULTADO COMPROVADO', instruction: 'Abra com a transformação central somente se houver evidência; caso contrário, nomeie o caso sem prometer resultado.', visualRole: 'result', evidenceRequired: true },
      { label: 'CONTEXTO E BASELINE', instruction: 'Explique cliente ou cenário, público, período e ponto de partida.', visualRole: 'context' },
      { label: 'DESAFIO E IMPACTO', instruction: 'Mostre a restrição, risco ou problema e seu efeito inicial.', evidenceRequired: true },
      { label: 'OBJETIVO E MÉTRICA', instruction: 'Defina o que deveria mudar e como seria observado.', visualRole: 'metric' },
      { label: 'DIAGNÓSTICO', instruction: 'Separe evidências, hipótese e limites do que era conhecido.', visualRole: 'analysis' },
      { label: 'ESTRATÉGIA', instruction: 'Descreva a escolha central e por que ela respondia ao diagnóstico.', visualRole: 'diagram' },
      { label: 'EXECUÇÃO E DECISÕES', instruction: 'Mostre etapas e decisões relevantes sem virar lista operacional.', visualRole: 'timeline' },
      { label: 'ANTES E DEPOIS', instruction: 'Compare condições equivalentes e declare período e fonte.', visualRole: 'comparison', evidenceRequired: true },
      { label: 'RESULTADOS', instruction: 'Use somente métricas, depoimentos ou fatos presentes nas fontes.', visualRole: 'data', evidenceRequired: true },
      { label: 'ATRIBUIÇÃO E LIMITES', instruction: 'Declare fatores externos, incertezas e o que não pode ser atribuído à intervenção.', density: 'medium', visualRole: 'source' },
      { label: 'APRENDIZADOS E APLICAÇÃO', instruction: 'Extraia princípios transferíveis, limites e a próxima aplicação possível.', visualRole: 'decision' },
    ],
  }),
  path({
    id: 'keynote_manifesto',
    label: 'Keynote / Manifesto',
    shortLabel: 'Keynote',
    description: 'Constrói uma tese memorável com tensão, virada e chamado à ação.',
    intent: 'Mudar a forma como o público percebe um tema e mobilizá-lo em torno de uma ideia.',
    deliveryMode: 'live',
    density: 'minimal',
    defaultSlideCount: 12,
    suggestedVisualPreset: 'presentation_keynote',
    stages: [
      { label: 'BIG IDEA', instruction: 'Declare um ponto de vista memorável e o que está em jogo, sem clickbait.', headlineMode: 'topic', visualRole: 'statement' },
      { label: 'TERRENO COMUM', instruction: 'Comece em uma experiência ou verdade que o público reconhece.', visualRole: 'story' },
      { label: 'O QUE É', instruction: 'Mostre a realidade atual e sua tensão central.', visualRole: 'evidence', evidenceRequired: true },
      { label: 'O QUE PODERIA SER', instruction: 'Contraste com uma possibilidade concreta e desejável.', visualRole: 'vision' },
      { label: 'HISTÓRIA OU PROVA', instruction: 'Use exemplo verdadeiro, imagem ou dado único para dar corpo à tese.', visualRole: 'story', evidenceRequired: true },
      { label: 'OBSTÁCULO', instruction: 'Nomeie a crença, sistema ou resistência que impede a mudança.' },
      { label: 'VIRADA', instruction: 'Apresente a nova lente que reorganiza o problema.', visualRole: 'reframe' },
      { label: 'CICLOS DE CONTRASTE', instruction: 'Alterne realidade atual e possibilidade em dois ou três movimentos, um ponto por slide.', visualRole: 'contrast' },
      { label: 'PRINCÍPIOS', instruction: 'Desdobre a visão em duas ou três ideias curtas e memoráveis.' },
      { label: 'IMPLICAÇÕES', instruction: 'Mostre o que muda em escolhas, comportamento ou estratégia.' },
      { label: 'NOVA REALIDADE', instruction: 'Faça o público visualizar o estado futuro depois da ação.', visualRole: 'vision' },
      { label: 'CHAMADO', instruction: 'Feche com a ação ou compromisso que o público pode assumir.', visualRole: 'decision' },
    ],
  }),
]);

export const PRESENTATION_PATH_BY_ID = Object.freeze(
  Object.fromEntries(PRESENTATION_PATHS.map((item) => [item.id, item])),
);

const PRESENTATION_PATH_ALIASES = Object.freeze({
  automatico: 'auto',
  automatic: 'auto',
  pitch_deck: 'pitch',
  investor_pitch: 'pitch',
  aula: 'aula_workshop',
  workshop: 'aula_workshop',
  aula_e_workshop: 'aula_workshop',
  proposta: 'proposta_comercial',
  comercial: 'proposta_comercial',
  sales_proposal: 'proposta_comercial',
  relatorio: 'relatorio_executivo',
  relatorio_de_resultados: 'relatorio_executivo',
  executive_report: 'relatorio_executivo',
  case: 'estudo_de_caso',
  case_study: 'estudo_de_caso',
  estudo_caso: 'estudo_de_caso',
  keynote: 'keynote_manifesto',
  manifesto: 'keynote_manifesto',
});

function presentationPathSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Sempre devolve um id válido e estável para persistência. */
export function normalizePresentationPath(value, fallback = DEFAULT_PRESENTATION_PATH_ID) {
  const raw = value && typeof value === 'object'
    ? (value.id ?? value.presentationPath ?? value.pathId)
    : value;
  const slug = presentationPathSlug(raw);
  const canonical = PRESENTATION_PATH_ALIASES[slug] || slug;
  if (PRESENTATION_PATH_BY_ID[canonical]) return canonical;

  const fallbackSlug = presentationPathSlug(fallback);
  const normalizedFallback = PRESENTATION_PATH_ALIASES[fallbackSlug] || fallbackSlug;
  return PRESENTATION_PATH_BY_ID[normalizedFallback]
    ? normalizedFallback
    : DEFAULT_PRESENTATION_PATH_ID;
}

export function getPresentationPath(value) {
  return PRESENTATION_PATH_BY_ID[normalizePresentationPath(value)];
}

export function clampPresentationSlideCount(value, fallback = 10) {
  const parsed = Number(value);
  const fallbackNumber = Number.isFinite(Number(fallback)) ? Number(fallback) : 10;
  const n = Number.isFinite(parsed) ? Math.trunc(parsed) : Math.trunc(fallbackNumber);
  return Math.min(PRESENTATION_SLIDE_LIMITS.max, Math.max(PRESENTATION_SLIDE_LIMITS.min, n));
}

/** Defaults ao criar / alternar para apresentação. */
export function presentationDocPatch(options = DEFAULT_PRESENTATION_PATH_ID) {
  const opts = options && typeof options === 'object' ? options : { pathId: options };
  const presentationPath = normalizePresentationPath(opts.pathId ?? opts.presentationPath);
  const route = getPresentationPath(presentationPath);
  const quickCardCount = clampPresentationSlideCount(
    opts.slideCount ?? opts.quickCardCount,
    route.defaultSlideCount,
  );
  return {
    productKind: PRESENTATION_PRODUCT_KIND,
    creativePreset: APRESENTACAO_PRESET_ID,
    fmt: 'apresentacao',
    mode: 'editorial',
    presentationPath,
    quickCardCount: String(quickCardCount),
    slideTextDensity: '1_2',
    cardVisualStyle: 'full',
    autoAdjustOnGenerate: true,
  };
}

/** Bloco específico do caminho, consumível pelo prompt principal. */
export function buildPresentationPathBlock(pathId = DEFAULT_PRESENTATION_PATH_ID, slideCount) {
  const route = getPresentationPath(pathId);
  const n = clampPresentationSlideCount(slideCount, route.defaultSlideCount);
  const stageLines = route.stages
    .map((stage, index) => {
      const properties = [
        `título=${stage.headlineMode}`,
        `visual=${stage.visualRole}`,
        `densidade=${stage.density}`,
        stage.evidenceRequired ? 'evidência obrigatória' : '',
        stage.optionalWhenMissing ? 'opcional se faltar material' : '',
      ].filter(Boolean).join('; ');
      return `${index + 1}. ${stage.label} · ${stage.instruction} [${properties}]`;
    })
    .join('\n');
  const autoRule = route.id === DEFAULT_PRESENTATION_PATH_ID
    ? 'Escolha a ênfase do arco pelo objetivo e pelas fontes do usuário; não misture vários tipos de deck.'
    : `Siga a lógica de ${route.label}; não converta o material em carrossel social.`;

  return `
CAMINHO DO DECK — ${route.label.toUpperCase()}:
Objetivo: ${route.intent}
Modo de entrega: ${route.deliveryMode === 'live' ? 'apresentado ao vivo' : route.deliveryMode === 'leave-behind' ? 'deve funcionar também sem apresentador' : 'híbrido — projeção e leitura posterior'}.
Densidade predominante: ${route.density}.
Total: ${n} slides. Combine etapas próximas quando necessário. Se o espaço não bastar, reduza o escopo; não comprima várias mensagens em um slide.
${autoRule}

SEQUÊNCIA-BASE:
${stageLines}
`;
}

/**
 * Pacote estratégico para decks 16:9.
 * O segundo argumento é opcional para preservar chamadas existentes.
 */
export function buildApresentacaoPackBlock(slideCount, pathId = DEFAULT_PRESENTATION_PATH_ID) {
  const route = getPresentationPath(pathId);
  const n = clampPresentationSlideCount(slideCount, route.defaultSlideCount);
  return `
PACOTE ATIVO — APRESENTAÇÃO / DECK 16:9 (prioridade sobre fórmulas de carrossel Instagram):
Você está a criar SLIDES DE APRESENTAÇÃO (paisagem), não cards de feed vertical.
Pense em deck profissional: uma ideia por slide, hierarquia clara e espaço para leitura à distância.

Validação do pedido:
- Qual é a decisão, aprendizagem ou ação que o público deve levar?
- Quem estará na sala (cliente, investidor, liderança, time ou alunos)?
- Quais afirmações têm evidência nas fontes e quais ainda são hipóteses?

${buildPresentationPathBlock(route.id, n)}
REGRAS DE CAMPO (JSON do app):
- "title": capa/divisor pode ser curto; em slides de conteúdo escreva uma afirmação-conclusão clara, em até duas linhas, que já comunique a mensagem principal.
- "subtitle": apoio breve à afirmação — implicação, explicação curta ou poucos rótulos. Não transcreva a fala, não crie parágrafos longos e não simule listas com " · ".
- "bodyAfterImage": quase sempre ""; use para fonte, unidade, período, ressalva ou instrução de atividade indispensável.
- "imageQuery": inglês, 8–15 palavras, opcional. Prefira evidência, diagrama, demonstração, comparação ou contexto diretamente ligado à afirmação; evite fotografia genérica decorativa.
- Em slides analíticos, use a estrutura AFIRMAÇÃO → EVIDÊNCIA: título conclusivo e visual que permita verificar ou entender a afirmação.
- Em pitch, relatório e proposta, números precisam de unidade, período, comparação e fonte. Em keynote, privilegie imagem única, frase única, dado único ou pausa visual.
- Deck ao vivo: mantenha baixa densidade e deixe explicações secundárias para a fala. Leave-behind: inclua contexto suficiente para o slide fazer sentido sozinho, sem virar documento corrido.
- Toda tela deve ter título único, ordem de leitura evidente, contraste forte e texto legível à distância; não dependa apenas de cor para comunicar significado.
- Não escreva "Slide 1" no título. Não use jargão de Instagram (salvar, comentar, feed ou arrastar).
- Não use mini-ganchos, cliffhangers, "continue", CTA de compartilhar ou qualquer frase que dependa do gesto de deslizar.
- Não invente métricas, resultados, clientes, preços, citações ou fontes. Quando faltar informação, formule sem fingir precisão.

TOM: profissional, claro e concreto. Prefira substantivos e verbos de decisão a adjetivos vazios.
`;
}

export function buildApresentacaoIntroLine() {
  return 'Atue como designer de apresentações e estrategista de narrativa. Produza um DECK 16:9 (não carrossel Instagram): uma ideia por slide, tipografia dominante, JSON válido apenas — sem markdown, sem texto extra.';
}

export function buildApresentacaoRefineHint(pathId = DEFAULT_PRESENTATION_PATH_ID) {
  const route = getPresentationPath(pathId);
  return `- Pacote Apresentação 16:9 (${route.label}): capa pode ter title curto; conteúdo usa title como afirmação-conclusão em até duas linhas e subtitle apenas como apoio breve. Prefira evidência visual; bodyAfterImage só para fonte/ressalva/instrução. Preserve o caminho do deck e não use sanduíche de foto, bullets simulados ou CTAs de Instagram.`;
}
