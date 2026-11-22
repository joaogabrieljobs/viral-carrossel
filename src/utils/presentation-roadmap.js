/**
 * Etapa de cada posição de uma apresentação (MF-11).
 *
 * O plano antes recebia a lista inteira de etapas do caminho "sem alocar por
 * índice fixo". Com um briefing factual, os sete caminhos voltavam à mesma
 * sequência de fatos (36 horas, três pães, horário, 41.200, encomenda): Aula
 * sem conceito nem prática, Proposta sem escopo, Relatório sem recomendação,
 * Caso sem antes e depois. Aqui cada posição recebe uma etapa do caminho, e o
 * layout usa a mesma etapa (presentationStageAt), mantendo texto e composição
 * alinhados.
 */
import { getPresentationPath } from './presentation.js';
import { PRESENTATION_STAGE_EVIDENCE_RULE } from './presentation-content.js';

/** Escolhe `count` etapas espalhadas por `list`, preservando a primeira e a última. */
function spread(list, count) {
  if (list.length === 1 || count <= 1) return Array.from({ length: count }, () => list[0]);
  return Array.from({ length: count }, (_, index) => list[Math.round((index * (list.length - 1)) / (count - 1))]);
}

/**
 * Mais páginas que etapas: capa e fecho continuam únicos; as páginas extras
 * desdobram as etapas de desenvolvimento que pedem evidência (ou, sem elas,
 * todas as do miolo), em rodízio e ao lado da etapa de origem.
 */
function expand(all, count) {
  // Um apêndice opcional no fim não fecha o deck (Relatório): a decisão fecha.
  const stages = all.length > 3 && all.at(-1).optionalWhenMissing ? all.slice(0, -1) : all;
  if (stages.length < 3) return spread(stages, count);
  const middle = stages.slice(1, -1);
  const growable = middle.filter(stage => stage.evidenceRequired && !stage.optionalWhenMissing);
  const targets = growable.length ? growable : middle;
  const copies = new Map(middle.map(stage => [stage, 1]));
  for (let extra = 0; extra < count - stages.length; extra += 1) {
    const stage = targets[extra % targets.length];
    copies.set(stage, copies.get(stage) + 1);
  }
  return [stages[0], ...middle.flatMap(stage => Array.from({ length: copies.get(stage) }, () => stage)), stages.at(-1)];
}

/**
 * Ordem de corte quando o deck tem menos páginas que etapas. Sai primeiro o
 * que é opcional ou se funde com a etapa vizinha; ficam as etapas que definem
 * o caminho (Aula: conceito, exemplo, atividade, correção; Proposta: escopo,
 * investimento, decisão; Relatório: indicadores, achado, recomendação; Caso:
 * desafio, estratégia, antes e depois, resultados).
 */
const DROP_ORDER = Object.freeze({
  auto: ['CONTEXTO OU MAPA', 'SÍNTESE'],
  pitch: ['POR QUE AGORA', 'ALTERNATIVAS E VANTAGEM', 'EQUIPE', 'AQUISIÇÃO', 'PRODUTO OU DEMONSTRAÇÃO', 'MARCOS E RECURSOS', 'MERCADO E CLIENTE IDEAL', 'PEDIDO', 'MODELO DE NEGÓCIO'],
  aula_workshop: ['MAPA DA SESSÃO', 'NOVO BLOCO', 'VERIFICAÇÃO RÁPIDA', 'TRANSFERÊNCIA', 'SÍNTESE POR BLOCOS', 'OBJETIVOS OBSERVÁVEIS'],
  proposta_comercial: ['PROVA PRÓXIMA', 'RESUMO DE VALOR', 'PRESSUPOSTOS E EXCLUSÕES', 'CRONOGRAMA E DEPENDÊNCIAS', 'OBJETIVOS E SUCESSO', 'PLANO MÚTUO'],
  relatorio_executivo: ['APÊNDICE', 'FATORES E HIPÓTESES', 'OPÇÕES E TRADE-OFFS', 'RISCOS E OPORTUNIDADES', 'IMPLICAÇÃO', 'RESUMO EXECUTIVO'],
  estudo_de_caso: ['ATRIBUIÇÃO E LIMITES', 'OBJETIVO E MÉTRICA', 'DIAGNÓSTICO', 'EXECUÇÃO E DECISÕES', 'CONTEXTO E BASELINE'],
  keynote_manifesto: ['CICLOS DE CONTRASTE', 'IMPLICAÇÕES', 'TERRENO COMUM', 'NOVA REALIDADE', 'PRINCÍPIOS', 'OBSTÁCULO'],
});

/**
 * Etapas por posição. Com menos páginas que etapas, sai primeiro o que é
 * opcional, depois a ordem de corte do caminho, mantendo capa e fecho e a
 * ordem original. Com mais páginas, as etapas se desdobram em ordem.
 */
export function presentationRoadmap(pathId, count) {
  const route = getPresentationPath(pathId);
  const stages = route.stages || [];
  const n = Math.max(1, Math.round(Number(count) || 1));
  if (!stages.length) return Array.from({ length: n }, () => ({}));
  if (n < 2) return [stages[0]];
  if (n >= stages.length) return expand(stages, n);
  const kept = [...stages];
  const drop = [
    ...stages.filter(stage => stage.optionalWhenMissing).map(stage => stage.label),
    ...(DROP_ORDER[route.id] || []),
  ];
  for (const label of drop) {
    if (kept.length <= n) break;
    // Capa e fecho ficam; um apêndice opcional no fim pode sair.
    const at = kept.findIndex((stage, index) => stage.label === label && index > 0 && (index < kept.length - 1 || stage.optionalWhenMissing));
    if (at >= 0) kept.splice(at, 1);
  }
  // Deck muito curto: espalha o que restou, preservando capa e fecho.
  return kept.length > n ? spread(kept, n) : kept;
}

/** Como o material vira cada tipo de entrega (sem inventar outro negócio). */
const PATH_FRAMING = Object.freeze({
  pitch: 'o negócio do material é a oportunidade apresentada: problema, solução, prova e pedido.',
  proposta_comercial: 'a proposta é a oferta descrita no material, feita ao público do briefing: o que ele recebe, em que condições e que decisão toma.',
  relatorio_executivo: 'organize os indicadores, observações e recomendações sustentados pelo material para apoiar uma decisão. Preço, número de vagas e prazo de oferta continuam condições comerciais, não indicadores de desempenho; se não houver resultados observados, não invente achados nem simule uma avaliação de resultados.',
  keynote_manifesto: 'o material sustenta uma tese que muda a forma de ver o tema e termina num chamado.',
});

/**
 * Aula e Estudo de caso dependem do que o material traz (catálogo final
 * 22/11): uma oferta com preço, vagas e prazo não vira aula nem caso. O
 * enquadramento destes dois caminhos é próprio e substitui o texto padrão.
 */
const PATH_DELIVERY = Object.freeze({
  aula_workshop: 'Defina objective e thesis como uma aprendizagem observável apoiada no conteúdo fornecido. Antes de adotar esse caminho, identifique um conceito, procedimento ou critério que a fonte permita explicar, aplicar e corrigir; uma oferta com preço, vagas e prazo não basta. Se existir esse núcleo, ensine-o com exemplo, exercício e correção baseados nos mesmos insumos, sem transformar condições comerciais em uma aula sobre a oferta. Sem núcleo ensinável, aplique a regra de incompatibilidade do material; não crie teoria, cenário, fornecedor, serviço, cliente ou entregável para salvar o modo.',
  estudo_de_caso: 'Use esse caminho quando houver um caso delimitado com contexto e decisões ou intervenção documentados; resultado observado e transformação só quando fornecidos. Se houver execução em andamento, analise decisões e processo sem prometer um antes/depois. Uma oferta, preço, vagas ou prazo não constituem caso: sem base narrativa e analítica, aplique a regra de incompatibilidade do material. objective e thesis descrevem o que o leitor pode avaliar e aprender com essa evidência; não invente fornecedor, serviço, cliente, entregável ou acontecimento.',
});

function deliveryFraming(route) {
  if (route.id === 'auto') return '';
  if (PATH_DELIVERY[route.id]) return `TIPO DE ENTREGA: ${route.label}. ${PATH_DELIVERY[route.id]}\n`;
  // Um briefing de negócio com objetivo comercial ("atrair clientes") puxava
  // todos os caminhos para um folheto. O caminho escolhido define a entrega.
  return `TIPO DE ENTREGA: ${route.label}. ${route.intent} Mesmo que o briefing descreva um negócio ou traga um objetivo comercial, esta apresentação é ${route.label}: ${PATH_FRAMING[route.id] || 'o negócio e seus fatos entram como objeto, caso ou evidência dessa entrega.'} objective e thesis descrevem o que ${route.deliveryMode === 'live' ? 'o público aprende, sente ou passa a fazer' : 'o leitor avalia ou decide'} ao final. Não invente fornecedor, serviço, cliente ou entregável que o material não descreve.\n`;
}

/** Marcas da etapa, no mesmo vocabulário da sequência-base da redação. */
function stageMarks(stage) {
  const marks = [stage.evidenceRequired ? 'evidência obrigatória' : '', stage.optionalWhenMissing ? 'opcional se faltar material' : ''].filter(Boolean);
  return marks.length ? ` [${marks.join('; ')}]` : '';
}

/**
 * Bloco do prompt de planejamento: uma etapa por posição, na ordem do caminho.
 * `keyMessageLimit` acompanha o limite do contrato (menor na recuperação compacta).
 */
export function buildPresentationRoadmapPrompt(pathId, count, { keyMessageLimit = 160 } = {}) {
  const route = getPresentationPath(pathId);
  const roadmap = presentationRoadmap(pathId, count);
  return `${deliveryFraming(route)}ROTEIRO DE REFERÊNCIA — ${roadmap.length} slides: preserve a progressão abaixo quando sustentada; adapte funções sem base conforme a regra de compatibilidade:
${roadmap.map((stage, index) => `${index + 1}. ${stage.label}: ${stage.instruction}${stageMarks(stage)}`).join('\n')}
${PRESENTATION_STAGE_EVIDENCE_RULE}
Preencha question com a pergunta daquela posição. Inicie keyMessage com o nome da etapa e dois-pontos, como previsto no plano, seguidos de sua contribuição específica. O limite de ${keyMessageLimit} caracteres inclui o prefixo. O redator usa apenas a mensagem após o prefixo ao compor o texto público. Não organize o deck na ordem dos fatos do briefing nem dedique automaticamente uma página a cada dado. Lacunas editoriais ficam em gaps; condições, incertezas e decisões pendentes essenciais à interpretação também acompanham a keyMessage pertinente, em linguagem do público, sem inventar decisão, número, cliente, prazo ou resultado.

COMPATIBILIDADE DO MATERIAL — verifique antes de distribuir as posições:
- O modo organiza informação existente; não cria acontecimentos, conceitos, mecanismos, sensações ou resultados. Se uma função não tiver base, combine-a com uma função vizinha sustentada ou use a posição para outra pergunta pertinente e realmente distinta, preservando o objetivo e a ordem lógica.
- Preencha as posições com contribuições sustentadas e preserve a quantidade selecionada. Use gaps para as lacunas relevantes ao objetivo. Ausência de dado opcional permite adaptar a função. Não complete uma posição com uma lacuna, uma repetição ou um fato novo.
- Rótulos de etapas, IDs, gaps e instruções deste plano são internos e não devem aparecer como títulos ou texto dos slides.`;
}
