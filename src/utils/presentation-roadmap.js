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
  aula_workshop: 'o tema do material vira conteúdo de aprendizagem, e o negócio entra como caso para explicar, exemplificar e praticar.',
  proposta_comercial: 'a proposta é a oferta descrita no material, feita ao público do briefing: o que ele recebe, em que condições e que decisão toma.',
  relatorio_executivo: 'os dados do material viram indicadores, achados e recomendações para uma decisão.',
  estudo_de_caso: 'o negócio do material é o caso: contexto, desafio, escolha, execução e resultado com os dados informados.',
  keynote_manifesto: 'o material sustenta uma tese que muda a forma de ver o tema e termina num chamado.',
});

/** Bloco do prompt de planejamento: uma etapa por posição, na ordem do caminho. */
export function buildPresentationRoadmapPrompt(pathId, count) {
  const route = getPresentationPath(pathId);
  const roadmap = presentationRoadmap(pathId, count);
  // Um briefing de negócio com objetivo comercial ("atrair clientes") puxava
  // todos os caminhos para um folheto. O caminho escolhido define a entrega.
  const framing = route.id === 'auto' ? '' : `TIPO DE ENTREGA: ${route.label}. ${route.intent} Mesmo que o briefing descreva um negócio ou traga um objetivo comercial, esta apresentação é ${route.label}: ${PATH_FRAMING[route.id] || 'o negócio e seus fatos entram como objeto, caso ou evidência dessa entrega.'} objective e thesis descrevem o que ${route.deliveryMode === 'live' ? 'o público aprende, sente ou passa a fazer' : 'o leitor avalia ou decide'} ao final. Não invente fornecedor, serviço, cliente ou entregável que o material não descreve.\n`;
  return `${framing}ROTEIRO POR POSIÇÃO — ${roadmap.length} slides, uma etapa deste caminho para cada posição, nesta ordem:
${roadmap.map((stage, index) => `${index + 1}. ${stage.label}: ${stage.instruction}${stage.optionalWhenMissing ? ' Sem base no material, use a posição para a etapa vizinha.' : ''}`).join('\n')}
Comece a keyMessage de cada posição com o nome da etapa e dois-pontos (ex.: "${roadmap[Math.min(1, roadmap.length - 1)].label}: …"). A question e a keyMessage de cada posição respondem à etapa indicada usando os fatos do material que a sustentam. Não organize o deck na ordem em que os fatos aparecem no briefing nem dedique uma página a cada dado. Quando faltar informação para a etapa, cumpra-a com o raciocínio que o material permite e registre a lacuna em gaps, sem inventar número, cliente, prazo ou resultado. A lacuna fica só em gaps: a keyMessage não diz que algo "não foi informado" ou está "a definir"; mostra o que existe e o próximo passo.`;
}
