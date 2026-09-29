/** Biblioteca editorial versionada. Hipóteses para testar, não promessas de alcance. */
export const EDITORIAL_LIBRARY_VERSION = '2026-09-22';
export const INSTAGRAM_HASHTAG_LIMIT = 5;
export const INSTAGRAM_CAPTION_LIMIT = 2200;

export const EDITORIAL_SOURCES = [
  {
    id: 'instagram_best_practices', kind: 'official_guidance', reviewedAt: EDITORIAL_LIBRARY_VERSION,
    url: 'https://about.fb.com/news/2024/10/best-practices-education-hub-creators-instagram/',
    note: 'Orientações gerais e personalizadas por conta; não valida estas fórmulas.',
  },
  {
    id: 'instagram_hashtags', kind: 'platform_announcement', reviewedAt: EDITORIAL_LIBRARY_VERSION,
    url: 'https://www.threads.com/@creators/post/DSalXGPCWM4',
    corroborationUrl: 'https://www.socialmediatoday.com/news/instagram-implements-new-limits-on-hashtag-use/808309/',
    note: 'Limite anunciado de cinco hashtags; anúncio corroborado pela cobertura, sem promessa de alcance.',
  },
];

export const EDITORIAL_STRUCTURES = [
  {
    id: 'identification', objective: 'shares', label: 'Identificação',
    arc: 'situação reconhecível → tensão → explicação → consequência → frase que representa o leitor',
    useWhen: 'Há uma experiência específica que o público reconhece e gostaria de dividir.',
    avoidWhen: 'A identificação depende de estereótipos ou de afirmar que todo mundo sente o mesmo.',
    example: 'Você virou o suporte técnico da própria família.',
    cta: 'Convite opcional para enviar a quem vive a situação, sem pedir marcações em massa.',
  },
  {
    id: 'practical_reference', objective: 'saves', label: 'Referência prática',
    arc: 'problema concreto → procedimento → exemplo aplicado → erro a evitar → checklist',
    useWhen: 'O conteúdo oferece um procedimento ou critério que será útil consultar depois.',
    avoidWhen: 'Não há ação replicável; não invente passos para preencher slides.',
    example: 'O que revisar antes de enviar uma proposta.',
    cta: 'Salvamento com ocasião concreta de uso.',
  },
  {
    id: 'evidence_analysis', objective: 'authority', label: 'Análise sustentada',
    arc: 'leitura comum → evidência disponível → mecanismo → limite da interpretação → decisão',
    useWhen: 'Há observação, experiência identificada ou fonte para sustentar a análise.',
    avoidWhen: 'Não há evidência: use hipótese ou exemplo explicitamente hipotético, sem alegar comprovação.',
    example: 'O desconto pode estar escondendo outra dúvida.',
    cta: 'Pergunta específica sobre a decisão apresentada.',
  },
  {
    id: 'tradeoff', objective: 'conversation', label: 'Dilema real',
    arc: 'dilema → opção A → opção B → custos de cada escolha → critério → pergunta',
    useWhen: 'Existem alternativas defensáveis e uma escolha relevante para o público.',
    avoidWhen: 'Uma alternativa foi caricaturada só para provocar conflito.',
    example: 'Seu cliente precisa de mais opções ou de uma recomendação?',
    cta: 'Pergunta que pede experiência ou critério, sem resposta artificialmente binária.',
  },
  {
    id: 'diagnostic', objective: 'leads', label: 'Diagnóstico e demonstração',
    arc: 'sintoma → diagnóstico → demonstração → para quem serve → próximo passo',
    useWhen: 'Há problema e solução concretos, com oferta ou próximo passo realmente disponível.',
    avoidWhen: 'Não há oferta informada: não invente consultoria, gratuidade, escassez ou garantia.',
    example: 'A proposta foi lida. A decisão não veio.',
    cta: 'Próximo passo informado pela marca; sem oferta, convite para conversar sobre o problema.',
  },
  {
    id: 'cultural_signal', objective: 'culture', label: 'Leitura cultural',
    arc: 'sinal observado → contexto → tensão → interpretação → limite → consequência',
    useWhen: 'O material descreve um comportamento percebido e permite situá-lo.',
    avoidWhen: 'Um caso isolado seria generalizado como tendência de uma geração inteira.',
    example: 'Quando o hobby começa a parecer outro emprego.',
    cta: 'Pergunta de identificação ligada ao fenômeno, sem aula ou venda forçada.',
  },
].map(s => Object.freeze({ ...s, evidence: 'editorial_hypothesis', reviewedAt: EDITORIAL_LIBRARY_VERSION }));

export const CONTENT_OBJECTIVES = [
  { id: 'auto', label: 'Escolher pelo conteúdo', desc: 'A estrutura acompanha o tema, o público e o material disponível.' },
  { id: 'shares', label: 'Gerar compartilhamentos', desc: 'Dar nome a uma experiência que vale dividir.' },
  { id: 'saves', label: 'Gerar salvamentos', desc: 'Criar uma referência útil para consultar depois.' },
  { id: 'authority', label: 'Construir autoridade', desc: 'Explicar uma ideia com evidência e limites claros.' },
  { id: 'conversation', label: 'Abrir conversas', desc: 'Trazer um dilema e uma pergunta específica.' },
  { id: 'leads', label: 'Despertar interesse comercial', desc: 'Demonstrar como resolver um problema e indicar o próximo passo.' },
  { id: 'culture', label: 'Interpretar um comportamento', desc: 'Organizar uma percepção cultural com contexto.' },
];

export function normalizeContentObjective(value) {
  return CONTENT_OBJECTIVES.some(o => o.id === value) ? value : 'auto';
}

export function buildContentObjectiveReminder(value) {
  const id = normalizeContentObjective(value);
  const objective = CONTENT_OBJECTIVES.find(o => o.id === id);
  const structure = EDITORIAL_STRUCTURES.find(s => s.objective === id);
  return `OBJETIVO DO CONTEÚDO: ${objective.label}. ${objective.desc}
${structure ? `Ação final: ${structure.cta}` : 'Escolha uma única ação final que faça sentido para o conteúdo.'}
Preserve a promessa já feita e o modo/pacote escolhido; objetivo não autoriza novos fatos ou oferta inventada.`;
}

export function buildEditorialStrategyBlock(value, presetId = 'livre', preferredStructureId = null) {
  const id = normalizeContentObjective(value);
  const candidates = id === 'auto' ? EDITORIAL_STRUCTURES : EDITORIAL_STRUCTURES.filter(s => s.objective === id || s.id === preferredStructureId);
  return `${buildContentObjectiveReminder(id)}
BIBLIOTECA EDITORIAL (${EDITORIAL_LIBRARY_VERSION}; hipóteses de escrita, sem garantia de desempenho):
${candidates.map(s => `- ${s.label}: ${s.arc}. Use quando: ${s.useWhen} Evite quando: ${s.avoidWhen} Exemplo ilustrativo, não copie: "${s.example}".`).join('\n')}
${presetId === 'livre'
    ? 'O modo narrativo define a forma (cena, tutorial, análise); use a estrutura como funções adaptáveis dentro dele, sem trocar o modo.'
    : 'O pacote ativo mantém seu arco e layout. Use o objetivo para selecionar argumento, exemplo e CTA; não sobreponha um segundo arco.'}
Antes de redigir, compare três abordagens possíveis: utilidade direta, identificação e interpretação menos óbvia. Escolha a mais específica, relevante para o público e sustentada pelo material.
Planeje capa e segundo slide juntos: promessa clara e primeira entrega concreta. Cada slide seguinte acrescenta algo; o fecho cumpre a promessa.
Faça essa seleção internamente. Retorne apenas o JSON pedido, sem expor rascunhos ou notas de avaliação.`;
}

/** Limites do produto aplicados também quando o modelo ignora o prompt. */
export function normalizeInstagramCaption(value) {
  let tags = 0;
  return String(value || '').replace(/#[\p{L}\p{N}_]+/gu, tag => ++tags <= INSTAGRAM_HASHTAG_LIMIT ? tag : '')
    .trim().slice(0, INSTAGRAM_CAPTION_LIMIT).trimEnd();
}
