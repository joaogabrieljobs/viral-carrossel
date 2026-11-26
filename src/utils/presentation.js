/**
 * Domínio do modo Apresentação.
 *
 * O editor é compartilhado com o carrossel, mas intenção, arco narrativo e
 * formato pertencem a um produto diferente. Este módulo concentra essas
 * decisões para a UI e os prompts não precisarem inferi-las por texto solto.
 */

import { PRESENTATION_TITLE_EYEBROW_RULES } from './presentation-eyebrow.js';
import { buildPitchStrategyBlock, buildPitchFieldRules, buildPitchEvidenceRules, buildPitchReviewRules, PITCH_SYSTEM_PT, PITCH_PROVENANCE_RULE } from './pitch-content.js';
import {
  presentationSystemForRoute, presentationFieldsForRoute, presentationStrategyForRoute,
  presentationReviewForRoute, presentationRefineForRoute, presentationLanguageForRoute, presentationImagesForRoute,
  PRESENTATION_SUMMARY_EVIDENCE_RULES, PRESENTATION_PROVENANCE_RULE, PRESENTATION_STAGE_EVIDENCE_RULE,
} from './presentation-content.js';

export { PRESENTATION_PROVENANCE_RULE } from './presentation-content.js';

export const APRESENTACAO_PRESET_ID = 'apresentacao';
export const PRESENTATION_PRODUCT_KIND = 'apresentacao';
export const DEFAULT_PRESENTATION_PATH_ID = 'auto';
export const PRESENTATION_SLIDE_LIMITS = Object.freeze({ min: 5, max: 24 });
import { FAMILY_KEYS, familySpec, familyFromPresetId, normalizeFamilyKey } from './presentation-families.js';

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
    ...(definition.id === 'pitch' ? { contentMode: 'pitch' } : {}),
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
    suggestedVisualPreset: 'presentation_executive_minimal',
    stages: [
      { label: 'CAPA', instruction: 'Identifique tema e finalidade, usando o nome do negócio sem qualificadores de bastidor. Se o conteúdo for um exemplo fictício ou simulado e puder ser confundido com caso real, indique sua natureza de forma discreta no apoio da abertura, no idioma solicitado; não transforme “fictício” em parte do nome ou da manchete.', headlineMode: 'topic', visualRole: 'context' },
      { label: 'CONTEXTO OU MAPA', instruction: 'Mostre por que o assunto importa e, quando ajudar, o percurso do deck.', visualRole: 'diagram' },
      { label: 'CORPO', instruction: 'Desenvolva uma ideia sustentada por slide, com informação ou conceito presente no material. Dados e exemplos só entram quando fornecidos; diagramas apenas organizam relações sustentadas e não contam como prova. Em conteúdo conceitual, explique o raciocínio sem simular validação; se não houver contribuição distinta sustentada, una ou omita a função no planejamento.', evidenceRequired: true },
      { label: 'SÍNTESE', instruction: 'Reúna as conclusões que sustentam a decisão ou aprendizagem.', visualRole: 'summary' },
      { label: 'FECHO', instruction: 'Feche com a aprendizagem, a decisão solicitada ou o próximo passo sustentado pelo material. Preserve decisões pendentes como pedidos, sem anunciar aprovação ou execução; use “se aprovado” quando o avanço depender desse aceite e preserve o CTA solicitado.', visualRole: 'decision' },
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
    suggestedVisualPreset: 'presentation_premium_dark',
    stages: [
      { label: 'EMPRESA E PROPÓSITO', instruction: 'Defina em uma frase o que muda, para quem e por que a empresa existe.', headlineMode: 'topic', visualRole: 'context' },
      { label: 'CLIENTE E PROBLEMA', instruction: 'Apresente o público e o problema descritos no material; inclua efeito, custo e alternativa atual somente quando documentados. Se o briefing trouxer apenas a solução, descreva a necessidade à qual ela se dirige como proposta, sem afirmar que o público vive uma dor, sofre uma perda ou usa uma alternativa não informada.' },
      { label: 'POR QUE AGORA', instruction: 'Explique uma mudança documentada que abre a oportunidade; sem base, omita esta função em vez de fabricar urgência.', evidenceRequired: true, optionalWhenMissing: true },
      { label: 'SOLUÇÃO E MECANISMO', instruction: 'Explique o produto e o mecanismo descrito no material, ligando suas ações à necessidade apresentada. Diferencie o que ele faz do resultado que pretende alcançar; só afirme causa do problema ou resolução comprovada quando houver sustentação explícita.', visualRole: 'diagram' },
      { label: 'PRODUTO OU DEMONSTRAÇÃO', instruction: 'Mostre o fluxo ou experiência principal em texto editável; screenshot somente se fornecido. Separe software de serviço humano.', visualRole: 'demo' },
      { label: 'MERCADO E CLIENTE IDEAL', instruction: 'Delimite segmento, comprador e oportunidade com dados sustentados. Sem dimensionamento, explique apenas o recorte fornecido; hipótese ou plano de validação só entra quando constar do material, preservado como proposta. Se nem o recorte estiver sustentado, omita esta função e registre a lacuna essencial no planejamento.', visualRole: 'data', evidenceRequired: true },
      { label: 'TRAÇÃO E PROVA', instruction: 'Apresente validações reais com período, unidade e comparação quando conhecidos; diferencie resultados de planos e testes futuros. Se não houver validação realizada, não crie tração: descreva apenas o estágio documentado ou um teste já proposto, com essa modalidade, sem apresentá-lo como prova; omita a função quando não houver contribuição própria.', visualRole: 'data', evidenceRequired: true },
      { label: 'MODELO DE NEGÓCIO', instruction: 'Mostre pagador, lógica de receita e preço somente quando informados.', visualRole: 'diagram' },
      { label: 'ALTERNATIVAS E VANTAGEM', instruction: 'Compare apenas alternativas documentadas e critérios sustentados; não invente concorrentes ou superioridade.', visualRole: 'comparison', evidenceRequired: true, optionalWhenMissing: true },
      { label: 'AQUISIÇÃO', instruction: 'Explique os canais e o percurso de aquisição informados, distinguindo operação atual de plano ou hipótese. Não deduza canal, desempenho ou teste a realizar; sem material, omita a função e registre no planejamento apenas a lacuna relevante para a decisão.' },
      { label: 'EQUIPE', instruction: 'Relacione experiência real e responsabilidades à execução; sem dados de equipe, não invente competências nem uma página genérica.', visualRole: 'people', optionalWhenMissing: true },
      { label: 'MARCOS E RECURSOS', instruction: 'Relacione os planos, recursos e marcos fornecidos, preservando o que está disponível, solicitado ou condicionado à aprovação. Mostre o que o recurso pedido pretende viabilizar apenas quando essa relação estiver informada; não invente projeções, alocações, datas ou financiamento aprovado.' },
      { label: 'PEDIDO', instruction: 'Declare a decisão ou recurso solicitado e o que pretende viabilizar, sem inventar captação, valor ou próximo encontro. Combine esta função com Decisão e próximo passo quando tratarem do mesmo avanço; apresente o pedido uma única vez e preserve condições de aprovação.', visualRole: 'decision' },
      { label: 'DECISÃO E PRÓXIMO PASSO', instruction: 'Feche com o avanço solicitado e sua finalidade, combinando com Pedido quando for a mesma decisão. Inclua contato somente se informado e condicione passos dependentes ao aceite ainda pendente; não termine apenas com fotografia, logo ou promessa abstrata.', visualRole: 'decision' },
    ],
  }),
  path({
    id: 'aula_workshop',
    label: 'Aula / Workshop',
    shortLabel: 'Aula',
    description: 'Organiza conceitos, procedimentos e critérios fornecidos para que o público possa compreendê-los e aplicá-los.',
    intent: 'Fazer o público compreender e aplicar um conceito ao final da sessão.',
    deliveryMode: 'live',
    defaultSlideCount: 12,
    suggestedVisualPreset: 'presentation_modular_cards',
    stages: [
      { label: 'RELEVÂNCIA E DIAGNÓSTICO', instruction: 'Conecte o tema ao público e abra com uma pergunta curta que revele o ponto de partida.', visualRole: 'question' },
      { label: 'OBJETIVOS OBSERVÁVEIS', instruction: 'Diga o que o participante será capaz de explicar, decidir ou fazer ao final.', visualRole: 'objectives' },
      { label: 'MAPA DA SESSÃO', instruction: 'Oriente o percurso entre explicação, prática e síntese quando ajudar; não ocupe uma página só para repetir títulos.', headlineMode: 'topic', visualRole: 'agenda', optionalWhenMissing: true },
      { label: 'CONCEITO', instruction: 'Explique uma ideia por vez, com linguagem adequada ao conhecimento prévio do público.', visualRole: 'diagram' },
      { label: 'EXEMPLO RESOLVIDO', instruction: 'Demonstre o conceito com fatos, processo ou decisão presentes no material, mostrando raciocínio e critério. Sem caso fornecido, use uma aplicação direta do conceito que não acrescente pessoas, cenas, números ou acontecimentos; não fabrique cenário para completar a etapa. Se uma oferta não trouxer conteúdo ensinável suficiente, registre a incompatibilidade no planejamento em vez de transformá-la em aula ou lista de condições comerciais.', visualRole: 'example' },
      { label: 'VERIFICAÇÃO RÁPIDA', instruction: 'Faça uma pergunta que permita checar entendimento antes de avançar.', visualRole: 'question' },
      { label: 'ATIVIDADE', instruction: 'Declare tarefa, insumos disponíveis, entrega e critério de sucesso sobre o mesmo objeto no título e apoio, derivados do conceito ou caso fornecido. Não dependa de material apenas prometido na oferta nem invente contexto para viabilizar o exercício. Inclua duração somente quando informada; não transforme estimativa em agenda ou compromisso.', density: 'medium', visualRole: 'instructions' },
      { label: 'DEBRIEF', instruction: 'Corrija a mesma entrega da atividade anterior com resposta modelo e justificativa pelo critério anunciado. Quando útil, mostre uma resposta inadequada explicitamente didática, sem alegar que é um erro frequente ou ocorrido. Preserve lacunas do caso; uma pergunta sobre outro conceito não substitui a correção.', visualRole: 'discussion' },
      { label: 'NOVO BLOCO', instruction: 'Repita conceito → exemplo → verificação → prática apenas quando o escopo exigir.', optionalWhenMissing: true },
      { label: 'SÍNTESE POR BLOCOS', instruction: 'Agrupe os princípios essenciais sem repetir o roteiro falado.', visualRole: 'summary' },
      { label: 'TRANSFERÊNCIA', instruction: 'Só após corrigir a atividade do caso, proponha aplicação ao contexto do participante, sem inventar os dados pessoais dele ou mudar a tarefa já avaliada.', visualRole: 'application' },
      { label: 'PRÓXIMA AÇÃO E RECURSOS', instruction: 'Feche com aplicação executável; materiais, links e acompanhamento apenas quando disponíveis.', visualRole: 'decision' },
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
    suggestedVisualPreset: 'presentation_executive_minimal',
    stages: [
      { label: 'CAPA PERSONALIZADA', instruction: 'Nomeie proposta e objetivo; identifique o cliente somente se informado, sem acrescentar “fictício” ao nome ou ao título. Se a proposta for uma simulação que possa ser confundida com oferta real, sinalize discretamente sua natureza no apoio da abertura, no idioma solicitado; não copie notas de bastidor para a manchete.', headlineMode: 'topic', visualRole: 'context' },
      { label: 'RESUMO DE VALOR', instruction: 'Resuma situação, resultado desejado e proposta em linguagem do cliente.' },
      { label: 'DESAFIO E IMPACTO', instruction: 'Explique o cenário e o desafio descritos, incluindo efeito atual no negócio somente quando documentado. Se houver apenas uma necessidade ou resultado desejado, apresente-o nessa modalidade; não deduza perdas, insatisfação ou causa a partir da solução oferecida.', evidenceRequired: true },
      { label: 'OBJETIVOS E SUCESSO', instruction: 'Organize os resultados desejados e critérios de sucesso fornecidos, preservando sua modalidade e relação com o pedido. Não crie metas, métricas ou condições de aceite; diferencie objetivo, critério de sucesso e obrigação comercial. Se uma definição essencial estiver pendente, formule a decisão a combinar sem apresentar novo critério como acordado.' },
      { label: 'ABORDAGEM E BENEFÍCIO', instruction: 'Explique a solução, método, benefício e por que se encaixam no contexto.', visualRole: 'diagram' },
      { label: 'ESCOPO E ACEITE', instruction: 'Separe entregáveis e critérios de aceite sem inventar itens ausentes.', density: 'medium' },
      { label: 'CRONOGRAMA E DEPENDÊNCIAS', instruction: 'Organize etapas, marcos, dependências e responsabilidades conhecidas.', visualRole: 'timeline' },
      { label: 'PROVA PRÓXIMA', instruction: 'Apoie alegações relevantes com a evidência disponível e preserve seu alcance: processo documentado explica funcionamento ou execução, mas não comprova eficácia nem resultado. Não invente case ou validação; sem prova de resultado, mantenha o benefício como finalidade proposta e omita a função autônoma se ela apenas repetir a abordagem.', visualRole: 'evidence', evidenceRequired: true },
      { label: 'INVESTIMENTO E CONDIÇÕES', instruction: 'Mostre opções, preço, validade e pagamento somente quando fornecidos.', visualRole: 'comparison' },
      { label: 'PRESSUPOSTOS E EXCLUSÕES', instruction: 'Declare somente limites, dependências, riscos e exclusões fornecidos; mantenha seus qualificadores temporais e a distinção entre categorias. Não acrescente cláusulas ou exclusões usuais, nem amplie ou reduza o escopo; destaque apenas condições que mudem a decisão.', density: 'medium' },
      { label: 'PLANO MÚTUO', instruction: 'Organize os passos informados de cada parte, preservando responsáveis, datas e dependências disponíveis. Não transforme ausência em obrigação nova: decisões essenciais ainda abertas devem ser formuladas como algo a combinar, sem “não informado” ou campos de preenchimento; passos posteriores ao aceite ficam condicionados à aprovação. Una ao fecho quando não houver contribuição distinta.', visualRole: 'decision' },
      { label: 'FECHO E PENDÊNCIAS', instruction: 'Feche com o que aprovar e o que ainda combinar, sem uma página genérica de perguntas. Contato ou encontro somente quando informado.', density: 'minimal', visualRole: 'decision' },
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
    suggestedVisualPreset: 'presentation_data_first',
    stages: [
      { label: 'ASSUNTO, PERÍODO E DECISÃO', instruction: 'Identifique recorte, período e a decisão que o relatório deve apoiar.', headlineMode: 'topic', visualRole: 'context' },
      { label: 'RESUMO EXECUTIVO', instruction: 'Antecipe as poucas conclusões sustentadas mais relevantes e a decisão requerida; não preencha uma contagem fixa de achados.', visualRole: 'summary' },
      { label: 'SCORECARD', instruction: 'Mostre indicadores disponíveis com unidade, período e base. Meta só se fornecida, diferença só com entradas comparáveis; não invente tendência.', visualRole: 'data', evidenceRequired: true },
      { label: 'ACHADO', instruction: 'Use uma conclusão sustentada no título e apresente a evidência que a apoia, com contexto e limites relevantes no próprio slide. A evidência pode ser textual; use gráfico ou tabela editável somente quando houver dados e recurso apropriados, sem inventar imagem comprobatória.', visualRole: 'data', evidenceRequired: true },
      { label: 'IMPLICAÇÃO', instruction: 'Explique o que o achado muda para o negócio sem atribuir causalidade sem prova.' },
      { label: 'FATORES E HIPÓTESES', instruction: 'Separe fatores associados, hipóteses e limitações metodológicas.', density: 'medium', visualRole: 'analysis' },
      { label: 'RISCOS E OPORTUNIDADES', instruction: 'Priorize por impacto, probabilidade e urgência quando houver base.', visualRole: 'matrix', evidenceRequired: true },
      { label: 'RECOMENDAÇÕES', instruction: 'Ligue cada ação ao achado que a justifica; impacto, esforço ou orçamento só quando sustentados.', visualRole: 'priorities' },
      { label: 'OPÇÕES E TRADE-OFFS', instruction: 'Compare escolhas reais e suas consequências para a decisão.', visualRole: 'comparison' },
      { label: 'DECISÃO REQUERIDA', instruction: 'Declare escolha, responsável, prazo e checkpoint somente quando informados.', visualRole: 'decision' },
      { label: 'APÊNDICE', instruction: 'Método e definições podem complementar a leitura; limitações essenciais acompanham o achado. Não encerre o deck com um apêndice genérico.', density: 'medium', visualRole: 'source', optionalWhenMissing: true },
    ],
  }),
  path({
    id: 'estudo_de_caso',
    label: 'Estudo de caso',
    shortLabel: 'Caso',
    description: 'Analisa o contexto, as decisões e as ações de um caso documentado, com resultados quando disponíveis.',
    intent: 'Analisar um caso documentado pelas decisões e ações registradas, explicando o que se pode aprender com elas e, quando houver resultados, o que as evidências permitem atribuir à intervenção.',
    deliveryMode: 'hybrid',
    density: 'medium',
    defaultSlideCount: 11,
    suggestedVisualPreset: 'presentation_photo_essay',
    stages: [
      { label: 'RESULTADO OBSERVADO', instruction: 'Abra com a mudança documentada e seus limites ou, se o caso estiver em andamento, com a decisão ou ação que já ocorreu. Se a passagem puder levar o leitor a tomar uma simulação por resultado real, identifique-a no apoio dessa passagem, inclusive na abertura quando for ali que o resultado aparece. Use o nome fornecido do negócio. Uma oferta sem caso delimitado exige complemento antes da redação.', visualRole: 'result', evidenceRequired: true },
      { label: 'CONTEXTO E BASELINE', instruction: 'Explique cliente ou cenário, público, período e ponto de partida.', visualRole: 'context' },
      { label: 'DESAFIO E IMPACTO', instruction: 'Apresente a restrição, risco ou problema documentados e seu efeito inicial somente quando observado. Não deduza o diagnóstico nem o prejuízo a partir da intervenção; se a fonte trouxer apenas um objetivo, mantenha-o como intenção e omita esta função quando não acrescentar base própria.', evidenceRequired: true },
      { label: 'OBJETIVO E MÉTRICA', instruction: 'Apresente o objetivo e a forma de observação definidos no material, distinguindo o planejado do que foi efetivamente medido. Não invente métrica, meta ou desenho de avaliação retrospectivo; registre no planejamento uma lacuna essencial sem convertê-la em compromisso.', visualRole: 'metric' },
      { label: 'DIAGNÓSTICO', instruction: 'Separe evidências, hipótese e limites do que era conhecido.', visualRole: 'analysis' },
      { label: 'ESTRATÉGIA', instruction: 'Descreva a escolha central documentada e sua justificativa quando informada. Quando o material permitir apenas relacionar escolha e problema, apresente a relação como interpretação limitada aos fatos, sem atribuir intenção, decisão ou eficácia não registradas.', visualRole: 'diagram' },
      { label: 'EXECUÇÃO E DECISÕES', instruction: 'Mostre etapas e decisões relevantes sem virar lista operacional.', visualRole: 'timeline' },
      { label: 'ANTES E DEPOIS', instruction: 'Compare apenas observações fornecidas com definições e condições compatíveis, preservando unidade, população ou eventos observados, período, fonte e limites relevantes. Sem base comparável, não construa antes/depois; omita a função ou incorpore a limitação essencial ao resultado. Use esta etapa para explicar a comparação, sem repetir integralmente a abertura e Resultados.', visualRole: 'comparison', evidenceRequired: true },
      { label: 'RESULTADOS', instruction: 'Apresente apenas métricas, depoimentos ou fatos de resultado presentes nas fontes, com alcance e contexto necessários. Acrescente uma dimensão sustentada que ainda não tenha sido explicada; se repetir Antes e depois, combine as funções. Sem resultados, omita esta função em vez de rotular planos ou condições da oferta como efeitos observados.', visualRole: 'data', evidenceRequired: true },
      { label: 'ATRIBUIÇÃO E LIMITES', instruction: 'Explicite os limites de atribuição sustentados pelo desenho e pelos dados do caso; inclua fatores externos específicos somente quando informados. Não invente explicações alternativas nem use ausência de prova como prova de efeito; mantenha a ressalva essencial junto à afirmação correspondente e use esta etapa apenas para aprofundá-la.', density: 'medium', visualRole: 'source' },
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
    suggestedVisualPreset: 'presentation_cinematic',
    stages: [
      { label: 'BIG IDEA', instruction: 'Declare um ponto de vista memorável e o que está em jogo, sem clickbait.', headlineMode: 'topic', visualRole: 'statement' },
      { label: 'TERRENO COMUM', instruction: 'Abra uma conexão com o público por uma situação ou observação presente no material. Sem experiência documentada, use uma pergunta ancorada no tema ou formule o ponto de vista como proposta; não afirme que todos vivem, sentem, pensam ou fazem algo, nem invente cena ou memória.', visualRole: 'story' },
      { label: 'O QUE É', instruction: 'Apresente a situação atual e a tensão documentadas no material, preservando o recorte e o alcance da evidência. Se houver apenas um ponto de vista, explicite a leitura defendida sem convertê-la em diagnóstico geral; não fabrique conflito para sustentar a tese.', visualRole: 'evidence', evidenceRequired: true },
      { label: 'O QUE PODERIA SER', instruction: 'Contraste com uma possibilidade concreta e desejável.', visualRole: 'vision' },
      { label: 'HISTÓRIA OU PROVA', instruction: 'Dê corpo à tese com exemplo, relato ou dado presente no material, preservando seu alcance. Uma imagem ilustrativa pode apoiar a compreensão, mas não comprova a tese nem documenta pessoa, acontecimento ou resultado; sem evidência, desenvolva apenas o raciocínio sustentado e não simule prova.', visualRole: 'story', evidenceRequired: true },
      { label: 'OBSTÁCULO', instruction: 'Examine o obstáculo, a restrição ou a objeção descritos no material, preservando a diferença entre fato e hipótese. Não atribua crenças ou resistência ao público nem declare causa impeditiva sem base; se não houver obstáculo informado, avance para a nova interpretação sem inventar antagonismo.' },
      { label: 'VIRADA', instruction: 'Apresente a nova lente que reorganiza o problema.', visualRole: 'reframe' },
      { label: 'CICLOS DE CONTRASTE', instruction: 'Use contraste somente quando acrescentar um argumento distinto, sem repetir a tese nem fabricar uma falsa oposição.', visualRole: 'contrast', optionalWhenMissing: true },
      { label: 'PRINCÍPIOS', instruction: 'Desdobre a visão nos princípios sustentados pelo material, com frases curtas e memoráveis; use duas ou três ideias apenas se cada uma acrescentar uma orientação distinta. Não complete quantidade com slogan ou generalização sem base.' },
      { label: 'IMPLICAÇÕES', instruction: 'Mostre o que muda em escolhas, comportamento ou estratégia.' },
      { label: 'NOVA REALIDADE', instruction: 'Descreva uma possibilidade futura como visão ou hipótese, sem prometer resultado inevitável.', visualRole: 'vision' },
      { label: 'CHAMADO', instruction: 'Feche com a ação ou reflexão coerente com a visão e com o CTA solicitado, quando houver. Não invente compromisso, prazo, benefício ou canal de contato; uma proposta de ação deve permanecer convite, nunca compromisso já assumido pelo público.', visualRole: 'decision' },
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

/**
 * Campo "Outro" da quantidade (auditoria 23/11, GB-07). A apresentação gera de
 * 5 a 24 slides; aceitar de 1 a 4 mostrava no resumo um número e créditos que a
 * geração não cumpria. Campo vazio não é erro: a pessoa ainda está digitando.
 */
const CUSTOM_COUNT_MAX = 24;

export function customCountLimits(isPresentation) {
  return isPresentation
    ? { min: PRESENTATION_SLIDE_LIMITS.min, max: PRESENTATION_SLIDE_LIMITS.max }
    : { min: 1, max: CUSTOM_COUNT_MAX };
}

export function customCountIssue(raw, { isPresentation = false } = {}) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const { min, max } = customCountLimits(isPresentation);
  const n = Number(text);
  if (!Number.isInteger(n)) return `Digite um número inteiro de ${min} a ${max}.`;
  if (n < min) return isPresentation ? `Apresentações têm no mínimo ${min} slides.` : `O mínimo é ${min} card.`;
  if (n > max) return `O máximo é ${max} ${isPresentation ? 'slides' : 'cards'}.`;
  return '';
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

/**
 * Uma oferta isolada (preço, vagas, prazo) não sustenta Aula nem Estudo de
 * caso. A redação recebe a regra antes da sequência-base (catálogo 22/11).
 */
const PATH_COMPATIBILITY = Object.freeze({
  aula_workshop: 'COMPATIBILIDADE DA AULA: uma oferta isolada não é conteúdo de ensino. Use somente um conceito, procedimento ou critério presente nas fontes para construir explicação, exercício executável e correção; não transforme preço, vagas ou prazo em tópicos pedagógicos. Use a contribuição atribuída a cada posição no plano; não invente conhecimento ou pratique uma habilidade que o material não ensina.',
  estudo_de_caso: 'COMPATIBILIDADE DO CASO: uma oferta isolada não é estudo de caso. Siga apenas um plano sustentado por um caso delimitado, suas decisões ou intervenção; sem resultado, analise o processo informado e seus limites, sem anunciar transformação, comparação ou medição futura inexistentes. Use a contribuição atribuída a cada posição no plano; não substitua o caso por catálogo comercial.',
});

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
  const compatibility = PATH_COMPATIBILITY[route.id] ? `\n${PATH_COMPATIBILITY[route.id]}\n` : '';

  return `
CAMINHO DO DECK — ${route.label.toUpperCase()}:
Objetivo: ${route.intent}
Modo de entrega: ${route.deliveryMode === 'live' ? 'apresentado ao vivo' : route.deliveryMode === 'leave-behind' ? 'deve funcionar também sem apresentador' : 'híbrido — projeção e leitura posterior'}.
Densidade predominante: ${route.density}.
Total: ${n} slides. Siga o plano validado; combine etapas próximas e omita funções sem base somente quando a redistribuição mantiver contribuições distintas sustentadas. Mantenha a quantidade e a ordem do plano. Nos lotes, escreva somente as posições atribuídas e use o plano geral para dar continuidade. Se o espaço não bastar, priorize a informação essencial; não apague condições para caber.
${autoRule}
${compatibility}
SEQUÊNCIA-BASE:
${stageLines}
${PRESENTATION_STAGE_EVIDENCE_RULE}
`;
}

/**
 * Pacote estratégico para decks 16:9.
 * O segundo argumento é opcional para preservar chamadas existentes.
 */
export function buildApresentacaoPackBlock(slideCount, pathId = DEFAULT_PRESENTATION_PATH_ID) {
  const route = getPresentationPath(pathId);
  const n = clampPresentationSlideCount(slideCount, route.defaultSlideCount);
  if (route.id === 'pitch') {
    return `PACOTE ATIVO — APRESENTAÇÃO / PITCH 16:9 (prioridade sobre fórmulas de carrossel e síntese para palestra):\n${buildPresentationPathBlock(route.id, n)}\n${buildPitchStrategyBlock()}`;
  }
  return `PACOTE ATIVO — APRESENTAÇÃO / DECK 16:9 (prioridade sobre fórmulas de carrossel Instagram):
${buildPresentationPathBlock(route.id, n)}
${presentationStrategyForRoute(route)}`;
}

export function buildApresentacaoIntroLine() {
  return 'Atue como designer de apresentações e estrategista de narrativa. Produza um DECK 16:9 (não carrossel Instagram): uma ideia por slide, tipografia dominante, JSON válido apenas — sem markdown, sem texto extra.';
}

export function buildApresentacaoRefineHint(pathId = DEFAULT_PRESENTATION_PATH_ID) {
  const route = getPresentationPath(pathId);
  if (route.id === 'pitch') return `Pacote Apresentação 16:9 (Pitch):\n${buildPitchFieldRules()}\n${buildPitchEvidenceRules()}\n${PITCH_PROVENANCE_RULE}\nPreserve o caminho do deck, o estágio do negócio e os fatos sustentados. Desenvolva o argumento disponível sem transformá-lo em um slogan.`;
  return `Pacote Apresentação 16:9 (${route.label}):
${presentationRefineForRoute(route)}
Preserve a função desta posição. Ao refinar um slide, os demais são contexto; ao refinar o deck, preserve quantidade e ordem.`;
}

/** Opções locais à chamada: o caminho nunca muda o provedor global. */
export function presentationAIOptions(presetId, pathId) {
  if (!isApresentacaoPreset(presetId)) return {};
  const route = getPresentationPath(pathId);
  return { contentMode: route.id === 'pitch' ? 'pitch' : 'presentation', presentationPath: route.id };
}

export function buildPresentationSystemPrompt(pathId) {
  const route = getPresentationPath(pathId);
  return route.id === 'pitch' ? PITCH_SYSTEM_PT : presentationSystemForRoute(route);
}

export function buildPresentationFieldRules(pathId) {
  const route = getPresentationPath(pathId);
  return `${route.id === 'pitch' ? buildPitchFieldRules() : presentationFieldsForRoute(route)}
TIPOGRAFIA E RITMO DE LEITURA:
${PRESENTATION_TITLE_EYEBROW_RULES}
- O parágrafo desenvolve, sem repetir o título.
- Em subtitle e bodyAfterImage, use **negrito** em uma ou duas expressões realmente decisivas (dado, condição, ação ou contraste), sem criar um fato novo. O trecho destacado deve existir na própria frase. Não destaque o parágrafo inteiro, não use marcação em títulos nem nas células dos blocos nativos.
- Use parágrafos curtos com uma função cada. Uma quebra de linha separa ideias, não cada palavra. Não alinhe com espaços, não desenhe colunas ou tabelas com caracteres e não use CAIXA ALTA em frases de leitura.
- Se existir um quadro de métricas, comparação ou etapas, o texto acima explica o significado. Não repita todas as células em prosa. Valores, unidades e limitações ficam juntos no quadro editável.`;
}

export function buildPresentationReviewRules(pathId) {
  const route = getPresentationPath(pathId);
  return `${route.id === 'pitch' ? buildPitchReviewRules() : presentationReviewForRoute(route)}
Preserve os destaques **negrito** dentro das strings de subtitle e bodyAfterImage quando marcam uma ideia relevante e sustentada. Remova destaque do parágrafo inteiro ou de uma promessa sem fonte. O JSON não recebe cercas Markdown nem formatação externa. Nenhum destaque pode acrescentar um fato ou esconder uma condição.`;
}

export function buildPresentationLanguageRules(pathId, tone) {
  return presentationLanguageForRoute(getPresentationPath(pathId), tone);
}

export function buildPresentationImageRules(pathId, topic, projectDirection, familyKey) {
  const base = presentationImagesForRoute(getPresentationPath(pathId), topic, projectDirection);
  if (!familyKey) return base;
  return `${base}\n${buildPresentationFamilyImageRules(familyKey)}`;
}

export function buildPresentationFamilyImageRules(familyKey) {
  if (!familyKey) return '';
  // Direção visual da família escolhida (luz, paleta, recorte), em português.
  // A cena do briefing vem primeiro; texto, número, gráfico e logo ficam fora.
  const spec = familySpec(FAMILY_KEYS.includes(familyKey) || ['premium', 'data'].includes(familyKey)
    ? normalizeFamilyKey(familyKey) : familyFromPresetId(familyKey));
  return `DIREÇÃO VISUAL — ${spec.label.toUpperCase()}: ${spec.photo.direction} A imageQuery descreve primeiro a cena do briefing. Use luz e tratamento coerentes e varie a escala quando isso ajudar a mensagem. Siga a estética explícita do projeto e proteja as características principais no recorte real do painel. Texto, letras, números, gráficos e logotipos ficam fora da imagem gerada.`;
}

export function buildPresentationSummaryRules(pathId) {
  const route = getPresentationPath(pathId);
  return `RESUMO — ${route.label.toUpperCase()}: sintetize a progressão, evidências e aprendizagem, decisão ou próximo passo do deck. Preserve hipóteses e pendências; não acrescente fatos.
${route.id === 'pitch' ? buildPitchEvidenceRules() : PRESENTATION_SUMMARY_EVIDENCE_RULES}
${route.id === 'pitch' ? PITCH_PROVENANCE_RULE : PRESENTATION_PROVENANCE_RULE}`;
}

/**
 * Reteste 21/11, MF-11 (A06): o briefing não tinha "antes", o Estudo de caso
 * virou lista de fatos e o app não avisou. Aviso fora do slide, para a pessoa
 * completar o material ou escolher outro tipo. O texto do aviso veio do
 * catálogo final (22/11); a detecção continua sendo a falta de ponto de partida.
 */
const CASE_BASELINE = /\b(?:antes|depois|passou|passaram|passamos|era|eram|aumentou|aumentaram|caiu|ca[íi]ram|cresceu|cresceram|reduziu|reduzimos|dobrou|subiu|baixou|melhorou|piorou|em rela[çc][ãa]o a|comparad[oa])\b|\bde\s+\S+\s+(?:\S+\s+)?para\s+\d/i;

export function presentationPathMaterialNotice(pathId, sourceText) {
  if (getPresentationPath(pathId)?.id !== 'estudo_de_caso') return '';
  if (CASE_BASELINE.test(String(sourceText || ''))) return '';
  return 'Para analisar um caso, acrescente o contexto e uma decisão ou ação que já aconteceu. Um caso em andamento pode ser apresentado com o resultado pendente. Para divulgar apenas a oferta, escolha Proposta.';
}

/**
 * Reteste 22/11 (WebExpresso): com briefing de oferta, "Contar uma história",
 * "Ir a fundo" e "Aula" viravam a mesma lista do Caso, sem aviso. A checagem
 * olha o material, não o texto gerado: vale com ou sem revisão.
 */
const STORY_MARKERS = /\b(?:fund(?:ou|ad[oa])|abriu|come[cç]ou|quando|hist[oó]ria|era uma vez|virada|decidiu|desde\s+(?:19|20)\d{2}|em\s+(?:19|20)\d{2}|founded|started|opened|when|story|since\s+(?:19|20)\d{2}|in\s+(?:19|20)\d{2})\b/i;
const TEACHING_MARKERS = /\b(?:como\s+(?:fazer|usar|escolher|montar)|passo|etapa|porque|por que|erro|exemplo|m[eé]todo|t[eé]cnica|conceito|exerc[ií]cio|how\s+to|step|why|mistake|example|method|technique|concept)\b/i;
const DEEP_MIN_WORDS = 150;

/**
 * Texto que o aviso de material confere (auditoria 23/11, IA-03). No carrossel
 * a base factual vem em `factualSource`; na apresentação, em
 * `presentationSources`. Ler só o tema dava aviso falso em Caso e Aula mesmo
 * com o material completo no Conteúdo base.
 */
export function materialNoticeSourceText(topic, { factualSource = '', presentationSources = [] } = {}) {
  const sources = Array.isArray(presentationSources) ? presentationSources : [];
  const sourceTexts = sources.flatMap(source => (
    Array.isArray(source?.chunks) && source.chunks.length ? source.chunks.map(chunk => chunk?.text) : [source?.text]
  ));
  return [topic, factualSource, ...sourceTexts].filter(text => typeof text === 'string' && text.trim()).join('\n');
}

export function narrativeModeMaterialNotice(modeId, sourceText) {
  const text = String(sourceText || '');
  const id = String(modeId || '');
  if (id === 'estudo_de_caso') return presentationPathMaterialNotice(id, text);
  if (id === 'storytelling' && !STORY_MARKERS.test(text)) {
    return 'Para contar a história, acrescente dois momentos ligados entre si ou descreva como o processo começa e o que acontece em seguida. Para publicar as condições da oferta, escolha “Seguir meu pedido”.';
  }
  if (id === 'deep' && (text.match(/\p{L}+/gu) || []).length < DEEP_MIN_WORDS) {
    return 'Que relação o leitor deve entender? Acrescente como o processo funciona, por que uma condição muda a decisão ou um exemplo que permita explicar essa relação. Para apenas apresentar a oferta, escolha “Seguir meu pedido”.';
  }
  if (id === 'aula_workshop' && !TEACHING_MARKERS.test(text)) {
    return 'Para montar a aula, acrescente o conceito, procedimento ou critério a ensinar e o material que permite explicá-lo ou aplicá-lo. Para divulgar apenas a oferta, escolha Proposta ou Pitch.';
  }
  return '';
}
