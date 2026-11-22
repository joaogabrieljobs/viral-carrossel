import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_PATHS, getPresentationPath, buildApresentacaoPackBlock, buildPresentationSystemPrompt,
  buildPresentationReviewRules, buildPresentationSummaryRules, buildPresentationImageRules,
  buildPresentationFamilyImageRules, narrativeModeMaterialNotice, presentationPathMaterialNotice,
} from '../../src/utils/presentation.js';
import { buildPresentationPlanPrompt } from '../../src/utils/presentation-plan.js';
import { presentationRoadmap } from '../../src/utils/presentation-roadmap.js';
import { familySpec } from '../../src/utils/presentation-families.js';

// Catálogo final de prompts de apresentação (22/11). O texto de cada bloco
// passou por revisão fora do app; estes testes fixam o que mudou em cada
// destino, sem depender do arquivo do catálogo (que não entra no repositório).
const PATH_IDS = PRESENTATION_PATHS.map(route => route.id);
const stageOf = (pathId, label) => getPresentationPath(pathId).stages.find(stage => stage.label === label);

describe('catálogo final 22/11 — etapas dos caminhos', () => {
  // [caminho, etapa, trecho que só existe na instrução revisada]
  const REVISED = [
    ['auto', 'CAPA', 'Identifique tema e finalidade, usando o nome do negócio sem qualificadores de bastidor'],
    ['auto', 'CORPO', 'Desenvolva uma ideia sustentada por slide, com informação ou conceito presente no material'],
    ['auto', 'FECHO', 'Feche com a aprendizagem, a decisão solicitada ou o próximo passo sustentado pelo material'],
    ['pitch', 'CLIENTE E PROBLEMA', 'Apresente o público e o problema descritos no material'],
    ['pitch', 'SOLUÇÃO E MECANISMO', 'Explique o produto e o mecanismo descrito no material, ligando suas ações à necessidade apresentada'],
    ['pitch', 'MERCADO E CLIENTE IDEAL', 'Delimite segmento, comprador e oportunidade com dados sustentados'],
    ['pitch', 'TRAÇÃO E PROVA', 'Se não houver validação realizada, não crie tração: descreva apenas o estágio documentado ou um teste já'],
    ['pitch', 'AQUISIÇÃO', 'Explique os canais e o percurso de aquisição informados, distinguindo operação atual de plano ou hipótese'],
    ['pitch', 'MARCOS E RECURSOS', 'Relacione os planos, recursos e marcos fornecidos, preservando o que está disponível, solicitado ou'],
    ['pitch', 'PEDIDO', 'Declare a decisão ou recurso solicitado e o que pretende viabilizar, sem inventar captação, valor ou próximo'],
    ['pitch', 'DECISÃO E PRÓXIMO PASSO', 'Feche com o avanço solicitado e sua finalidade, combinando com Pedido quando for a mesma decisão'],
    ['aula_workshop', 'EXEMPLO RESOLVIDO', 'Demonstre o conceito com fatos, processo ou decisão presentes no material, mostrando raciocínio e critério'],
    ['aula_workshop', 'ATIVIDADE', 'Declare tarefa, insumos disponíveis, entrega e critério de sucesso sobre o mesmo objeto no título e apoio,'],
    ['aula_workshop', 'DEBRIEF', 'Corrija a mesma entrega da atividade anterior com resposta modelo e justificativa pelo critério anunciado'],
    ['proposta_comercial', 'CAPA PERSONALIZADA', 'identifique o cliente somente se informado, sem acrescentar “fictício” ao nome ou ao título'],
    ['proposta_comercial', 'DESAFIO E IMPACTO', 'Explique o cenário e o desafio descritos, incluindo efeito atual no negócio somente quando documentado'],
    ['proposta_comercial', 'OBJETIVOS E SUCESSO', 'Organize os resultados desejados e critérios de sucesso fornecidos, preservando sua modalidade e relação com'],
    ['proposta_comercial', 'PROVA PRÓXIMA', 'Apoie alegações relevantes com a evidência disponível e preserve seu alcance: processo documentado explica'],
    ['proposta_comercial', 'PRESSUPOSTOS E EXCLUSÕES', 'Declare somente limites, dependências, riscos e exclusões fornecidos'],
    ['proposta_comercial', 'PLANO MÚTUO', 'Organize os passos informados de cada parte, preservando responsáveis, datas e dependências disponíveis'],
    ['relatorio_executivo', 'ACHADO', 'Use uma conclusão sustentada no título e apresente a evidência que a apoia, com contexto e limites relevantes'],
    ['estudo_de_caso', 'RESULTADO OBSERVADO', 'Abra com a mudança documentada e seus limites ou, se o caso estiver em andamento, com a decisão ou ação que'],
    ['estudo_de_caso', 'DESAFIO E IMPACTO', 'Apresente a restrição, risco ou problema documentados e seu efeito inicial somente quando observado'],
    ['estudo_de_caso', 'OBJETIVO E MÉTRICA', 'Apresente o objetivo e a forma de observação definidos no material, distinguindo o planejado do que foi'],
    ['estudo_de_caso', 'ESTRATÉGIA', 'Descreva a escolha central documentada e sua justificativa quando informada'],
    ['estudo_de_caso', 'ANTES E DEPOIS', 'Compare apenas observações fornecidas com definições e condições compatíveis, preservando unidade, população'],
    ['estudo_de_caso', 'RESULTADOS', 'Apresente apenas métricas, depoimentos ou fatos de resultado presentes nas fontes, com alcance e contexto'],
    ['estudo_de_caso', 'ATRIBUIÇÃO E LIMITES', 'Explicite os limites de atribuição sustentados pelo desenho e pelos dados do caso'],
    ['keynote_manifesto', 'TERRENO COMUM', 'Abra uma conexão com o público por uma situação ou observação presente no material'],
    ['keynote_manifesto', 'O QUE É', 'Apresente a situação atual e a tensão documentadas no material, preservando o recorte e o alcance da evidência'],
    ['keynote_manifesto', 'HISTÓRIA OU PROVA', 'Dê corpo à tese com exemplo, relato ou dado presente no material, preservando seu alcance'],
    ['keynote_manifesto', 'OBSTÁCULO', 'Examine o obstáculo, a restrição ou a objeção descritos no material, preservando a diferença entre fato e'],
    ['keynote_manifesto', 'PRINCÍPIOS', 'Desdobre a visão nos princípios sustentados pelo material, com frases curtas e memoráveis'],
    ['keynote_manifesto', 'CHAMADO', 'Feche com a ação ou reflexão coerente com a visão e com o CTA solicitado, quando houver'],
  ];
  it('34 instruções de etapa foram revisadas', () => expect(REVISED).toHaveLength(34));
  it.each(REVISED)('%s · %s', (pathId, label, fragment) => {
    expect(stageOf(pathId, label).instruction).toContain(fragment);
  });

  it('nota de produção "fictício" não vira parte do nome, do título nem da abertura', () => {
    const all = PRESENTATION_PATHS.flatMap(route => route.stages.map(stage => stage.instruction)).join('\n');
    expect(all).not.toContain('continua identificado como fictício');
    expect(all).not.toContain('preserve casos fictícios como fictícios');
    expect(all).not.toContain('Declare quando fictício');
    expect(stageOf('auto', 'CAPA').instruction).toContain('não transforme “fictício” em parte do nome ou da manchete');
    expect(stageOf('proposta_comercial', 'CAPA PERSONALIZADA').instruction).toContain('não copie notas de bastidor para a manchete');
  });

  it('rótulo, evidência exigida, opcional e papel visual das etapas não mudaram', () => {
    const signature = route => route.stages.map(stage => `${stage.label}|${stage.evidenceRequired ? 'E' : ''}|${stage.optionalWhenMissing ? 'O' : ''}|${stage.visualRole}`);
    expect(signature(getPresentationPath('auto'))).toEqual(['CAPA|||context', 'CONTEXTO OU MAPA|||diagram', 'CORPO|E||evidence', 'SÍNTESE|||summary', 'FECHO|||decision']);
    expect(signature(getPresentationPath('estudo_de_caso'))).toEqual([
      'RESULTADO OBSERVADO|E||result', 'CONTEXTO E BASELINE|||context', 'DESAFIO E IMPACTO|E||evidence', 'OBJETIVO E MÉTRICA|||metric',
      'DIAGNÓSTICO|||analysis', 'ESTRATÉGIA|||diagram', 'EXECUÇÃO E DECISÕES|||timeline', 'ANTES E DEPOIS|E||comparison',
      'RESULTADOS|E||data', 'ATRIBUIÇÃO E LIMITES|||source', 'APRENDIZADOS E APLICAÇÃO|||decision',
    ]);
    expect(PRESENTATION_PATHS.map(route => route.stages.length)).toEqual([5, 14, 12, 12, 11, 11, 12]);
  });

  it('ordem padrão das etapas por caminho, na quantidade padrão de slides', () => {
    const order = pathId => {
      const route = getPresentationPath(pathId);
      return presentationRoadmap(pathId, route.defaultSlideCount).map(stage => route.stages.indexOf(stage) + 1).join(', ');
    };
    expect(order('auto')).toBe('1, 2, 3, 3, 3, 3, 3, 3, 4, 5');
    expect(order('pitch')).toBe('1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14');
    expect(order('aula_workshop')).toBe('1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12');
    expect(order('proposta_comercial')).toBe('1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12');
    expect(order('relatorio_executivo')).toBe('1, 2, 3, 3, 4, 5, 6, 7, 8, 9, 10');
    expect(order('estudo_de_caso')).toBe('1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11');
    expect(order('keynote_manifesto')).toBe('1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12');
  });
});

describe('catálogo final 22/11 — visão geral dos caminhos', () => {
  it('Estudo de caso analisa um caso documentado; não promete transformação', () => {
    const route = getPresentationPath('estudo_de_caso');
    expect(route.label).toBe('Estudo de caso');
    expect(route.description).toBe('Analisa o contexto, as decisões e as ações de um caso documentado, com resultados quando disponíveis.');
    expect(route.intent).toBe('Analisar um caso documentado pelas decisões e ações registradas, explicando o que se pode aprender com elas e, quando houver resultados, o que as evidências permitem atribuir à intervenção.');
  });
  it('Aula organiza o que foi fornecido', () => {
    expect(getPresentationPath('aula_workshop').description).toBe('Organiza conceitos, procedimentos e critérios fornecidos para que o público possa compreendê-los e aplicá-los.');
  });
  it('os caminhos mantêm id, nome interno, quantidade padrão e modo de entrega', () => {
    expect(PRESENTATION_PATHS.map(route => `${route.id}|${route.label}|${route.defaultSlideCount}|${route.deliveryMode}`)).toEqual([
      'auto|Auto|10|hybrid', 'pitch|Pitch|13|leave-behind', 'aula_workshop|Aula / Workshop|12|live', 'proposta_comercial|Proposta comercial|12|leave-behind',
      'relatorio_executivo|Relatório executivo|11|leave-behind', 'estudo_de_caso|Estudo de caso|11|hybrid', 'keynote_manifesto|Keynote / Manifesto|12|live',
    ]);
  });
  it('rótulo de tela do caso é "Analisar um caso"', () => {
    const source = readFileSync(new URL('../../src/components/CreateProjectFlow.jsx', import.meta.url), 'utf8');
    expect(source).toContain("estudo_de_caso:'Analisar um caso'");
    expect(source).not.toContain('Demonstrar uma transformação');
  });
});

describe('catálogo final 22/11 — 1. prompt de sistema', () => {
  it('Estudo de caso: finalidade e profundidade sem pressupor mudança', () => {
    const system = buildPresentationSystemPrompt('estudo_de_caso');
    expect(system).toContain('Caminho: Estudo de caso. Finalidade: Analisar um caso documentado pelas decisões e ações registradas');
    expect(system).toContain('as escolhas, as mudanças registradas quando houver e até onde a evidência permite concluir');
    expect(system).not.toContain('Demonstrar como uma transformação aconteceu');
  });
});

describe('catálogo final 22/11 — 3. pedido de planejamento', () => {
  const prompt = (pathId, count) => buildPresentationPlanPrompt({ brief: '[briefing]', userInstructions: '[instruções]', count: count || getPresentationPath(pathId).defaultSlideCount, presentationPath: pathId });

  it.each(PATH_IDS)('%s: roteiro de referência, compatibilidade do material e regras de evidência', (pathId) => {
    const text = prompt(pathId);
    const n = getPresentationPath(pathId).defaultSlideCount;
    expect(text).toContain(`ROTEIRO DE REFERÊNCIA — ${n} slides: preserve a progressão abaixo quando sustentada; adapte funções sem base conforme a regra de compatibilidade:`);
    expect(text).toContain('Evidência obrigatória vale para a afirmação factual que a etapa pretende fazer. Se a instrução admitir um conceito, uma decisão documentada ou um caso em andamento, use o suporte correspondente. Uma função opcional sem material pode ser redistribuída conforme o plano; não apresente resultados ausentes como observados.');
    expect(text).toContain('Preencha question com a pergunta daquela posição. Inicie keyMessage com o nome da etapa e dois-pontos, como previsto no plano, seguidos de sua contribuição específica. O limite de 160 caracteres inclui o prefixo. O redator usa apenas a mensagem após o prefixo ao compor o texto público. Não organize o deck na ordem dos fatos do briefing nem dedique automaticamente uma página a cada dado.');
    expect(text).toContain('Lacunas editoriais ficam em gaps; condições, incertezas e decisões pendentes essenciais à interpretação também acompanham a keyMessage pertinente, em linguagem do público, sem inventar decisão, número, cliente, prazo ou resultado.');
    expect(text).toContain(`COMPATIBILIDADE DO MATERIAL — verifique antes de distribuir as posições:
- O modo organiza informação existente; não cria acontecimentos, conceitos, mecanismos, sensações ou resultados. Se uma função não tiver base, combine-a com uma função vizinha sustentada ou use a posição para outra pergunta pertinente e realmente distinta, preservando o objetivo e a ordem lógica.
- Preencha as posições com contribuições sustentadas e preserve a quantidade selecionada. Use gaps para as lacunas relevantes ao objetivo. Ausência de dado opcional permite adaptar a função. Não complete uma posição com uma lacuna, uma repetição ou um fato novo.
- Rótulos de etapas, IDs, gaps e instruções deste plano são internos e não devem aparecer como títulos ou texto dos slides.

FIDELIDADE EM TODOS OS CAMPOS:
- Não use garantir, garante, garantia nem garantido quando o material não usa essa palavra. Uma encomenda reserva o pedido; não garante disponibilidade, frescor ou resultado. Diga o que acontece ("reserva", "separa", "fica pronto para retirada").`);
    expect(text).toContain(`- evidence contém no máximo ${n + 4} itens concisos; isso é teto, não meta. Reutilize o mesmo evidenceId quando ele sustentar perguntas e contribuições diferentes; isso não autoriza repetir a mesma afirmação em várias páginas. Cada fato`);
    expect(text).toContain('as mesmas evidências podem sustentar contribuições distintas sem duplicar o texto dos slides.');
    expect(text).toContain('- Em apresentação conceitual, use apenas os conceitos fornecidos; a ausência de dados próprios não autoriza acrescentar teoria externa. evidence é o catálogo do plano inteiro. Pode ser [] em um deck conceitual sem evidências citáveis, desde que a explicação se limite aos conceitos fornecidos. Para um slide sem evidência própria, use evidenceIds: [] apenas nessa posição. Fatos ou propostas específicos exigem os trechos literais definidos acima. Registre informação ausente essencial em gaps; não fabrique fonte para completar o plano.');
    for (const old of ['ROTEIRO POR POSIÇÃO', 'Comece a keyMessage de cada posição', 'Sem base no material, use a posição para a etapa vizinha', 'Reutilize a mesma evidência quando apoiar várias páginas', 'podem sustentar várias páginas', 'sem dados próprios, evidence pode ser []', 'A lacuna fica só em gaps']) {
      expect(text, old).not.toContain(old);
    }
  });

  it('o roteiro numera uma etapa por posição e marca evidência obrigatória e etapa opcional', () => {
    const pitch = prompt('pitch', 14);
    expect(pitch).toMatch(/\n1\. EMPRESA E PROPÓSITO: Defina em uma frase o que muda, para quem e por que a empresa existe\.\n/);
    expect(pitch).toMatch(/\n3\. POR QUE AGORA: [^\n]+ \[evidência obrigatória; opcional se faltar material\]\n/);
    expect(pitch).toMatch(/\n7\. TRAÇÃO E PROVA: [^\n]+ \[evidência obrigatória\]\n/);
    expect(pitch).toMatch(/\n11\. EQUIPE: [^\n]+ \[opcional se faltar material\]\n/);
    expect(pitch).toMatch(/\n14\. DECISÃO E PRÓXIMO PASSO: [^\n]+\nEvidência obrigatória vale/);
    // Na quantidade padrão (13), a etapa opcional "Por que agora" sai primeiro.
    expect(prompt('pitch')).not.toContain('POR QUE AGORA:');
  });

  it('na recuperação compacta, o limite citado no roteiro acompanha o limite do contrato', () => {
    const repair = buildPresentationPlanPrompt({ brief: '[briefing]', count: 10, presentationPath: 'auto', compactRepair: true });
    expect(repair).toContain('O limite de 120 caracteres inclui o prefixo.');
    expect(repair).toContain('keyMessage até 120');
    expect(repair).not.toContain('O limite de 160 caracteres');
    expect(prompt('auto')).toContain('keyMessage até 160');
  });

  it('tipo de entrega: Automático não recebe; Pitch, Proposta e Keynote mantêm o enquadramento', () => {
    expect(prompt('auto')).not.toContain('TIPO DE ENTREGA');
    expect(prompt('pitch')).toContain('TIPO DE ENTREGA: Pitch. Levar investidores, parceiros ou liderança a entender a oportunidade e tomar uma decisão. Mesmo que o briefing descreva um negócio ou traga um objetivo comercial, esta apresentação é Pitch: o negócio do material é a oportunidade apresentada: problema, solução, prova e pedido. objective e thesis descrevem o que o leitor avalia ou decide ao final. Não invente fornecedor, serviço, cliente ou entregável que o material não descreve.\nROTEIRO DE REFERÊNCIA');
    expect(prompt('proposta_comercial')).toContain('esta apresentação é Proposta comercial: a proposta é a oferta descrita no material, feita ao público do briefing');
    expect(prompt('keynote_manifesto')).toContain('objective e thesis descrevem o que o público aprende, sente ou passa a fazer ao final.');
  });
  it('tipo de entrega da Aula exige um núcleo ensinável; oferta com preço, vagas e prazo não basta', () => {
    const aula = prompt('aula_workshop');
    expect(aula).toContain('TIPO DE ENTREGA: Aula / Workshop. Defina objective e thesis como uma aprendizagem observável apoiada no conteúdo fornecido. Antes de adotar esse caminho, identifique um conceito, procedimento ou critério que a fonte permita explicar, aplicar e corrigir; uma oferta com preço, vagas e prazo não basta. Se existir esse núcleo, ensine-o com exemplo, exercício e correção baseados nos mesmos insumos, sem transformar condições comerciais em uma aula sobre a oferta. Sem núcleo ensinável, aplique a regra de incompatibilidade do material; não crie teoria, cenário, fornecedor, serviço, cliente ou entregável para salvar o modo.\nROTEIRO DE REFERÊNCIA');
    expect(aula).not.toContain('o negócio entra como caso para explicar, exemplificar e praticar');
    expect(aula).toContain('NO PLANO DA AULA: descreva a tarefa concreta em uma posição purpose=practice');
  });
  it('tipo de entrega do Relatório não transforma condição comercial em indicador', () => {
    expect(prompt('relatorio_executivo')).toContain('esta apresentação é Relatório executivo: organize os indicadores, observações e recomendações sustentados pelo material para apoiar uma decisão. Preço, número de vagas e prazo de oferta continuam condições comerciais, não indicadores de desempenho; se não houver resultados observados, não invente achados nem simule uma avaliação de resultados. objective e thesis descrevem o que o leitor avalia ou decide ao final. Não invente fornecedor, serviço, cliente ou entregável que o material não descreve.\nROTEIRO DE REFERÊNCIA');
  });
  it('tipo de entrega do Caso pede caso delimitado; oferta não é caso', () => {
    const caso = prompt('estudo_de_caso');
    expect(caso).toContain('INTENÇÃO DE ESTUDO DE CASO: Analisar um caso documentado pelas decisões e ações registradas');
    expect(caso).toContain('TIPO DE ENTREGA: Estudo de caso. Use esse caminho quando houver um caso delimitado com contexto e decisões ou intervenção documentados; resultado observado e transformação só quando fornecidos. Se houver execução em andamento, analise decisões e processo sem prometer um antes/depois. Uma oferta, preço, vagas ou prazo não constituem caso: sem base narrativa e analítica, aplique a regra de incompatibilidade do material. objective e thesis descrevem o que o leitor pode avaliar e aprender com essa evidência; não invente fornecedor, serviço, cliente, entregável ou acontecimento.\nROTEIRO DE REFERÊNCIA');
    expect(caso).not.toContain('o negócio do material é o caso');
  });
});

describe('catálogo final 22/11 — 4. pacote do caminho', () => {
  it.each(PATH_IDS)('%s: segue o plano validado e explica a evidência obrigatória', (pathId) => {
    const route = getPresentationPath(pathId);
    const pack = buildApresentacaoPackBlock(route.defaultSlideCount, pathId);
    expect(pack).toContain(`Total: ${route.defaultSlideCount} slides. Siga o plano validado; combine etapas próximas e omita funções sem base somente quando a redistribuição mantiver contribuições distintas sustentadas. Mantenha a quantidade e a ordem do plano. Nos lotes, escreva somente as posições atribuídas e use o plano geral para dar continuidade. Se o espaço não bastar, priorize a informação essencial; não apague condições para caber.`);
    expect(pack).toMatch(/\nSEQUÊNCIA-BASE:\n1\. [^\n]+\n(?:\d+\. [^\n]+\n)+Evidência obrigatória vale para a afirmação factual que a etapa pretende fazer\. Se a instrução admitir um conceito, uma decisão documentada ou um caso em andamento, use o suporte correspondente\. Uma função opcional sem material pode ser redistribuída conforme o plano; não apresente resultados ausentes como observados\.\n\n/);
    expect(pack).toContain('- Não use garantir, garante, garantia nem garantido quando o material não usa essa palavra.');
    expect(pack).not.toContain('Estas funções não exigem uma página cada');
  });

  it.each(PATH_IDS.filter(id => id !== 'pitch'))('%s: redige pela contribuição do plano e trata nota de produção e cenário didático', (pathId) => {
    const pack = buildApresentacaoPackBlock(10, pathId);
    expect(pack).toContain('Antes de redigir, identifique objetivo, público, estágio e uso; inventarie fatos, exemplos, hipóteses, restrições e lacunas. Use a pergunta e a contribuição atribuídas no plano para redigir cada posição deste lote. Não exponha notas de produção nem uma lista de dados ausentes. Preserve, junto da afirmação afetada, a condição, limitação ou decisão pendente necessária para o público interpretar a evidência ou avaliar a proposta; omita apenas lacunas irrelevantes. Uma ressalva essencial não é comentário sobre o briefing. Siga a progressão do plano validado e desenvolva perguntas distintas, sem redistribuir fatos apenas para cumprir posições. Não preencha páginas com generalidades para atingir a quantidade. Descarte o prefixo da etapa em keyMessage antes de redigir o título, o apoio, as notas e o resumo. Use a contribuição do slide como base. IDs e notas de planejamento ficam nos campos internos.\nEm conteúdo analítico');
    expect(pack).toContain('- Notas de produção como "fictício", "exemplo" e "rascunho" não entram automaticamente no título nem qualificam o nome da marca. Quando um caso, depoimento, dado ou resultado simulado puder ser confundido com evidência real, identifique sua natureza no apoio ou junto da afirmação pertinente; não o apresente como cliente ou resultado real. Uma sugestão de atividade não vira compromisso comercial.');
    expect(pack).toContain('- Não atribua fatos, falas, sensações, problemas recorrentes ou compromissos a pessoas sem base. Use cenários didáticos somente se fornecidos ou expressamente solicitados; uma restrição a usar apenas as fontes fornecidas prevalece, mesmo sobre exemplos rotulados como hipotéticos. Nunca complete uma lacuna factual com um cenário plausível nem transforme exemplo em caso ou resultado real.');
    expect(pack).not.toContain('Planeje a pergunta, contribuição e sustentação de cada posição');
    expect(pack).not.toContain('Se o material for fictício, simulado ou didático, preserve essa natureza na abertura');
    expect(pack).not.toContain('Cenários didáticos podem ser propostos quando pertinentes');
  });

  it('Aula e Caso recebem a regra de compatibilidade antes da sequência-base', () => {
    expect(buildApresentacaoPackBlock(12, 'aula_workshop')).toContain('Siga a lógica de Aula / Workshop; não converta o material em carrossel social.\n\nCOMPATIBILIDADE DA AULA: uma oferta isolada não é conteúdo de ensino. Use somente um conceito, procedimento ou critério presente nas fontes para construir explicação, exercício executável e correção; não transforme preço, vagas ou prazo em tópicos pedagógicos. Use a contribuição atribuída a cada posição no plano; não invente conhecimento ou pratique uma habilidade que o material não ensina.\n\nSEQUÊNCIA-BASE:\n');
    expect(buildApresentacaoPackBlock(11, 'estudo_de_caso')).toContain('Siga a lógica de Estudo de caso; não converta o material em carrossel social.\n\nCOMPATIBILIDADE DO CASO: uma oferta isolada não é estudo de caso. Siga apenas um plano sustentado por um caso delimitado, suas decisões ou intervenção; sem resultado, analise o processo informado e seus limites, sem anunciar transformação, comparação ou medição futura inexistentes. Use a contribuição atribuída a cada posição no plano; não substitua o caso por catálogo comercial.\n\nSEQUÊNCIA-BASE:\n');
    for (const pathId of ['auto', 'pitch', 'proposta_comercial', 'relatorio_executivo', 'keynote_manifesto']) {
      expect(buildApresentacaoPackBlock(10, pathId)).not.toMatch(/COMPATIBILIDADE D[AO] /);
    }
  });

  it('estratégia da Aula: erro didático identificado, tempo e exemplo hipotético só quando pedidos', () => {
    const pack = buildApresentacaoPackBlock(12, 'aula_workshop');
    expect(pack).toContain('Use contraste entre exemplo correto e erro didático identificado quando pertinente, sem afirmar frequência real.');
    expect(pack).toContain('Tempo somente se informado ou se o usuário pedir expressamente uma estimativa didática, identificada como sugestão e nunca como agenda aprovada.');
    expect(pack).toContain('- Se o usuário solicitar expressamente um exemplo hipotético e não restringir as fontes aos dados fornecidos, proponha um exemplo simples e identificado; a ausência de caso não autoriza essa criação por si só. Não atribua métricas, histórias ou resultados fictícios a pessoas ou organizações reais.');
    expect(pack).not.toContain('Se não houver caso fornecido e as instruções permitirem');
  });
  it('estratégia de Proposta, Relatório e Caso não cria processo, acompanhamento nem medição', () => {
    expect(buildApresentacaoPackBlock(12, 'proposta_comercial')).toContain('Sem caso, explique somente o processo e os critérios de validação já fornecidos, sem tratá-los como prova de resultado e sem criar depoimentos, etapas ou critérios novos.');
    expect(buildApresentacaoPackBlock(11, 'relatorio_executivo')).toContain('- Termine com a decisão requerida e inclua próximo ponto de acompanhamento somente quando fornecido.');
    const caso = buildApresentacaoPackBlock(11, 'estudo_de_caso');
    expect(caso).toContain('Objetivo: Analisar um caso documentado pelas decisões e ações registradas');
    expect(caso).toContain('descreva medição futura somente quando prevista nas fontes, mantendo seu estágio.');
    expect(caso).not.toContain('descreva o que ainda será medido');
  });
  it('estratégia do Keynote não fabrica vivência, oposição nem objeção', () => {
    const pack = buildApresentacaoPackBlock(12, 'keynote_manifesto');
    expect(pack).toContain('- Organize a experiência ou questão fornecida, sua tensão, história ou prova disponível, interpretação, princípios, implicações e chamado. Adapte as funções ao material: não crie uma vivência compartilhada, história, oposição ou compromisso para preencher o arco; cada contraste sustentado precisa avançar a tese, sem repetir o slogan.');
    expect(pack).toContain('- Trate as objeções fornecidas com honestidade; não atribua ao público crenças ou resistências ausentes. Quando o próprio argumento tiver um limite documentado, esclareça-o sem inventar um opositor, caricaturar a situação atual ou fabricar uma falsa dicotomia.');
    expect(pack).not.toContain('Trate a melhor objeção relevante');
  });
  it('estratégia do Pitch não preenche seção com risco, plano de pesquisa, teste ou canal inventado', () => {
    const pack = buildApresentacaoPackBlock(13, 'pitch');
    expect(pack).toContain('- Notas de produção como "fictício", "exemplo" e "rascunho" não entram automaticamente na abertura nem qualificam o nome da empresa. Se um caso, dado ou resultado simulado puder parecer evidência real, identifique sua natureza no apoio ou junto da afirmação pertinente; nunca apresente caso de teste como cliente real nem atividade sugerida como compromisso comercial.');
    expect(pack).toContain('Diagnóstico e alternativa atual só entram quando fornecidos; preserve como hipótese o que já vier assim no material. Se ausentes, não crie um risco ou diagnóstico para preencher a seção: desenvolva apenas o problema documentado e registre a lacuna no planejamento.');
    expect(pack).toContain('- Solução/produto: descreva entrada, ação e saída sustentadas pelo material, diferenciando uso observado, funcionamento descrito e resultado pretendido. Não atribua causa ou eficácia sem evidência; explique o mecanismo proposto e quem ele pretende beneficiar. Separe software, serviço humano e complementos.');
    expect(pack).toContain('sem dados de dimensão, explique apenas o recorte e as hipóteses de validação já fornecidos, sem fabricar tamanho de mercado nem criar um plano de pesquisa.');
    expect(pack).toContain('Sem tração comprovada, apresente testes e critérios de validação somente se já constarem como plano; caso contrário, desenvolva o estágio documentado e registre a lacuna, sem criar um teste para ocupar o slide.');
    expect(pack).toContain('- Aquisição: explique os canais, caminho até a adoção, retenção e hipóteses de expansão fornecidos, preservando o estágio de cada um. Não invente canais, comportamento de compra nem um plano de expansão para completar essa função.');
    expect(pack).not.toContain('Material fictício ou simulado continua identificado como fictício na abertura');
  });
});

describe('catálogo final 22/11 — 7. revisão editorial', () => {
  it.each(PATH_IDS.filter(id => id !== 'pitch'))('%s: elimina redundância preservando a retomada mínima', (pathId) => {
    const rules = buildPresentationReviewRules(pathId);
    expect(rules).toContain('Elimine redundância entre páginas e campos; preserve apenas a retomada mínima necessária para síntese, compreensão ou decisão, sem reapresentar detalhes como conteúdo novo. Um slide curto e completo não precisa ser ampliado; altere apenas defeitos concretos.');
    expect(rules).not.toContain('Elimine repetição entre páginas e entre título, apoio e bloco de dados');
    expect(rules).toContain('- Notas de produção como "fictício", "exemplo" e "rascunho" não entram automaticamente no título nem qualificam o nome da marca.');
    expect(rules).toContain('Use cenários didáticos somente se fornecidos ou expressamente solicitados; uma restrição a usar apenas as fontes fornecidas prevalece, mesmo sobre exemplos rotulados como hipotéticos.');
    expect(rules).toContain('- Não use garantir, garante, garantia nem garantido quando o material não usa essa palavra.');
  });
  it('Pitch: repetição sem contribuição disponível não é corrigida com detalhe inventado', () => {
    const rules = buildPresentationReviewRules('pitch');
    expect(rules).toContain('Se um slide apenas repetir outro, substitua a repetição por uma contribuição distinta já sustentada e pertinente àquela etapa. Quando não houver contribuição disponível, não invente detalhes nem considere a estrutura corrigida: a insuficiência exige novo planejamento antes da publicação, sem alterar o schema desta revisão.');
    expect(rules).not.toContain('acrescente um detalhe sustentado pertinente àquela etapa');
    expect(rules).toContain('- Notas de produção como "fictício", "exemplo" e "rascunho" não entram automaticamente na abertura nem qualificam o nome da empresa.');
    expect(rules).toContain('- Não use garantir, garante, garantia nem garantido quando o material não usa essa palavra.');
  });
  it('Caso: confere contexto e ações; comparação só quando o caso a apresenta', () => {
    const rules = buildPresentationReviewRules('estudo_de_caso');
    expect(rules).toContain('Confira o contexto inicial e as ações documentadas. Verifique comparação e resultado apenas quando o caso os apresentar. Diferencie evidência de narrativa promocional, resultado observado de meta e associação de atribuição causal. O aprendizado explicita as condições em que pode ser aplicado?');
    expect(rules).toContain('Sem ponto de partida, não invente o antes, a mudança nem a causa; apresente somente o processo ou resultado efetivamente documentado. Se o material for apenas uma oferta, não aprove o deck como estudo de caso: ele exige novo planejamento com complemento do usuário ou mudança de caminho autorizada. Recupere explicações');
    expect(rules).not.toContain('Verifique baseline, intervenção, comparação e resultado');
  });
});

describe('catálogo final 22/11 — 8. resumo', () => {
  it.each(PATH_IDS.filter(id => id !== 'pitch'))('%s: o resumo não cria exemplo novo', (pathId) => {
    const rules = buildPresentationSummaryRules(pathId);
    expect(rules).toContain('- Não atribua fatos, falas, sensações, problemas recorrentes ou compromissos a pessoas sem base. No resumo, use somente cenários e exemplos já presentes no deck e sustentados pelas fontes ou expressamente solicitados; não crie exemplos novos nesta etapa. Nunca complete uma lacuna factual com um cenário plausível nem transforme exemplo em caso ou resultado real.');
    expect(rules).not.toContain('Use cenários didáticos somente se fornecidos');
    expect(rules).toContain('- Notas de produção como "fictício", "exemplo" e "rascunho" não entram automaticamente no título nem qualificam o nome da marca.');
    expect(rules).toContain('- Não use garantir, garante, garantia nem garantido quando o material não usa essa palavra.');
  });
  it('Pitch: nota de produção e garantia seguem a mesma regra no resumo', () => {
    const rules = buildPresentationSummaryRules('pitch');
    expect(rules).toContain('- Notas de produção como "fictício", "exemplo" e "rascunho" não entram automaticamente na abertura nem qualificam o nome da empresa.');
    expect(rules).toContain('- Não use garantir, garante, garantia nem garantido quando o material não usa essa palavra.');
    expect(rules).not.toContain('Material fictício ou simulado continua identificado como fictício');
  });
});

describe('catálogo final 22/11 — 9. avisos de tela', () => {
  const oferta = 'WebExpresso faz landing page para pequenos negócios nos Estados Unidos. Preço: US$ 399. São 10 vagas, até 30 de novembro.';
  it('Aula sem conteúdo a ensinar', () => {
    expect(narrativeModeMaterialNotice('aula_workshop', oferta)).toBe('Para montar a aula, acrescente o conceito, procedimento ou critério a ensinar e o material que permite explicá-lo ou aplicá-lo. Para divulgar apenas a oferta, escolha Proposta ou Pitch.');
  });
  it('Caso sem contexto nem ação registrada', () => {
    const notice = 'Para analisar um caso, acrescente o contexto e uma decisão ou ação que já aconteceu. Um caso em andamento pode ser apresentado com o resultado pendente. Para divulgar apenas a oferta, escolha Proposta.';
    expect(presentationPathMaterialNotice('estudo_de_caso', oferta)).toBe(notice);
    expect(narrativeModeMaterialNotice('estudo_de_caso', oferta)).toBe(notice);
  });
  it('modos de carrossel que usam a mesma função (catálogo de carrossel)', () => {
    expect(narrativeModeMaterialNotice('storytelling', oferta)).toBe('Para contar a história, acrescente dois momentos ligados entre si ou descreva como o processo começa e o que acontece em seguida. Para publicar as condições da oferta, escolha “Seguir meu pedido”.');
    expect(narrativeModeMaterialNotice('deep', oferta)).toBe('Que relação o leitor deve entender? Acrescente como o processo funciona, por que uma condição muda a decisão ou um exemplo que permita explicar essa relação. Para apenas apresentar a oferta, escolha “Seguir meu pedido”.');
  });
});

describe('catálogo final 22/11 — imageQuery das apresentações', () => {
  it.each(PATH_IDS.filter(id => id !== 'pitch'))('%s: a imagem é descrita para o painel do slide, respeitando o recorte', (pathId) => {
    const rules = buildPresentationImageRules(pathId, 'Ateliê de cerâmica', '', '');
    expect(rules).toContain('- Para “Ateliê de cerâmica”, escolha apenas contexto ou exemplo visual que ajude essa função.');
    expect(rules).toContain('- Se útil, descreva a imagem em INGLÊS, 8–15 palavras, para o painel de imagem do slide 16:9, respeitando seu recorte, sem texto, números ou logo incorporados.');
    expect(rules).not.toContain('formato horizontal 16:9');
  });
  it('a frase da família visual envolve a direção em português da própria família', () => {
    const spec = familySpec('editorial');
    expect(buildPresentationFamilyImageRules('editorial')).toBe(`DIREÇÃO VISUAL — ${spec.label.toUpperCase()}: ${spec.photo.direction} A imageQuery descreve primeiro a cena do briefing. Use luz e tratamento coerentes e varie a escala quando isso ajudar a mensagem. Siga a estética explícita do projeto e proteja as características principais no recorte real do painel. Texto, letras, números, gráficos e logotipos ficam fora da imagem gerada.`);
    expect(buildPresentationFamilyImageRules('')).toBe('');
    expect(buildPresentationImageRules('auto', 'Tema', '', 'editorial')).toContain('\nDIREÇÃO VISUAL — ');
  });
});
