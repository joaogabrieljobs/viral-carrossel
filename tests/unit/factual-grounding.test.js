import { describe, expect, it, vi } from 'vitest';
import { auditDraftFactuality, auditUnsupportedCommercialClaims, factualEvidenceText } from '../../src/utils/factual-grounding.js';
import { assertSocialRefinement, generateReviewedCarousel } from '../../src/utils/editorial-review.js';

const source = 'Público: donos de clínicas, salões, restaurantes e prestadores locais. Problemas: telefone antigo, botões em outro idioma, navegação ruim no celular, ausência de CTA claro e imagens genéricas. Processo: diagnóstico, organizar conteúdo, criar versão responsiva, revisar informações e CTA, publicar e orientar a equipe. Benefício esperado: informação clara e caminho simples para contato. Caso permitido: uma dona de negócio abre o próprio site no celular e encontra o telefone antigo. CTA: solicitar uma análise do site.';
const config = { count: 3, presetId: 'livre', densityId: '1_2', factualSource: source, userInstructions: 'Não invente preço, prazo, percentual, garantia, taxas, clientes ou resultados. Use clientes, não pacientes.' };
const draft = () => ({ caption: 'Solicite uma análise do site.', slides: [
  { title: 'Seu site facilita o contato?', subtitle: 'Abra o site no celular e confira as informações.', bodyAfterImage: '', imageQuery: 'business owner with smartphone' },
  { title: 'Confira o telefone', subtitle: 'A dona de negócio encontrou o telefone antigo.', bodyAfterImage: '', imageQuery: 'phone' },
  { title: 'Organize o próximo passo', subtitle: 'Revise as informações e o CTA.', bodyAfterImage: 'Solicite uma análise do site.', imageQuery: 'workspace' },
] });

describe('fidelidade ao briefing — regressões dos nove modos', () => {
  it.each([
    ['telefone mudou três vezes', 'dado sem fonte'],
    ['telefone desconectado há dois anos', 'dado sem fonte'],
    ['O cliente encontra você com um toque.', 'dado sem fonte'],
    ['Seu site perde a maioria dos acessos.', 'afirmação absoluta'],
    ['Adaptação perfeita e fricção zero.', 'afirmação absoluta'],
    ['Quem desiste vai para o concorrente.', 'afirmação absoluta'],
    ['Envie uma mensagem no WhatsApp.', 'canal ou serviço não informado'],
    ['Agende uma consulta para seus pacientes.', 'canal ou serviço não informado'],
    ['Solicite sua análise sem compromisso.', 'preço'],
    ['Compre por R$ 399, sem taxas escondidas.', 'preço'],
    ['Seu site inclui agendamento.', 'item incluso'],
  ])('detecta detalhe sem fonte: %s', (text, category) => {
    const first = draft();
    first.slides[2].bodyAfterImage = text;
    expect(auditDraftFactuality(first, config)).toContainEqual(expect.objectContaining({ slideIndex: 2, field: 'bodyAfterImage', category }));
  });

  it('não confunde passos com métricas nem bloqueia inferência prudente e conselho genérico', () => {
    const first = draft();
    first.slides[0].title = '3 ajustes para revisar';
    first.slides[1].title = 'Passo 2: confira os contatos';
    first.slides[1].subtitle = 'Informações antigas podem dificultar o contato.';
    first.slides[2].bodyAfterImage = 'Se você já usa WhatsApp, confira o link.';
    expect(auditDraftFactuality(first, config)).toEqual([]);
  });

  it('reconhece números fornecidos em algarismos ou por extenso e não usa proibição como prova', () => {
    const first = draft();
    first.slides[1].subtitle = 'O telefone mudou três vezes.';
    first.slides[2].subtitle = 'A revisão leva 2 dias.';
    const actualSource = `${source}\nO telefone mudou 3 vezes.\nNão prometa entrega em 2 dias.`;
    const issues = auditDraftFactuality(first, { ...config, factualSource: actualSource });
    expect(issues).not.toContainEqual(expect.objectContaining({ slideIndex: 1 }));
    expect(issues).toContainEqual(expect.objectContaining({ slideIndex: 2, claim: '2 dias' }));
    expect(factualEvidenceText(actualSource)).not.toContain('2 dias');
  });

  it.each(['vinte e um dias', 'twenty-one days', 'twenty one days'])('não interpreta o sufixo de numeral composto como uma quantidade nova: %s', quantity => {
    const first = draft();
    first.slides[1].subtitle = `Prazo de revisão: ${quantity}.`;
    expect(auditDraftFactuality(first, { ...config, factualSource: `${source} Prazo de revisão: 21 dias.` })).toEqual([]);
  });

  it('verifica caption também e não aceita DM como parte de administração', () => {
    const first = draft();
    first.caption = 'Administração para pequenos negócios. Envie uma DM e aumente 50% dos resultados.';
    const issues = auditDraftFactuality(first, { ...config, factualSource: `${source} Administração.` });
    expect(issues).toContainEqual(expect.objectContaining({ field: 'caption', slideIndex: null, claim: 'DM' }));
    expect(issues).toContainEqual(expect.objectContaining({ field: 'caption', slideIndex: null, claim: '50%' }));
  });

  it('negação declarativa não comprova garantia, mas instrução atual pode fornecer preço real', () => {
    const first = draft();
    first.slides[2].subtitle = 'Resultado garantido.';
    first.slides[2].bodyAfterImage = 'Preço: R$ 399.';
    const issues = auditDraftFactuality(first, { ...config, factualSource: 'Não oferecemos resultado garantido.', userInstructions: 'Inclua o preço real: R$ 399.' });
    expect(issues).toContainEqual(expect.objectContaining({ field: 'subtitle', category: 'garantia' }));
    expect(issues).not.toContainEqual(expect.objectContaining({ field: 'bodyAfterImage' }));
  });

  it('não trata ressalva de resultado como promessa, mas ausência de taxas continua alegação comercial', () => {
    const first = draft();
    first.slides[1].subtitle = 'Não há garantia de resultado.';
    first.slides[2].subtitle = 'This is not guaranteed.';
    first.slides[2].bodyAfterImage = 'Sem taxas escondidas.';
    expect(auditDraftFactuality(first, config)).toEqual([
      expect.objectContaining({ slideIndex: 2, field: 'bodyAfterImage', category: 'preço' }),
    ]);
  });

  it.each(['Não inclui software ou automação.', 'Does not include software or automation.', "Doesn't include software or automation."])(
    'não classifica exclusão explícita como promessa de item incluso: %s', text => {
      const first = draft(); first.slides[1].subtitle = text;
      expect(auditDraftFactuality(first, { ...config, factualSource: 'Não inclui software próprio nem automação.' })).toEqual([]);
    },
  );

  it('a exclusão da fonte não autoriza prometer o item como incluso', () => {
    const first = draft(); first.slides[1].subtitle = 'Inclui software e automação.';
    expect(auditDraftFactuality(first, { ...config, factualSource: 'Não inclui software e automação.' }))
      .toContainEqual(expect.objectContaining({ field: 'subtitle', category: 'item incluso' }));
  });

  it('não estende a negação por uma conjunção até uma inclusão positiva', () => {
    const first = draft(); first.slides[1].subtitle = 'Não promete mas inclui software e automação.';
    expect(auditDraftFactuality(first, { ...config, factualSource: 'Não inclui software e automação.' }))
      .toContainEqual(expect.objectContaining({ field: 'subtitle', category: 'item incluso' }));
  });

  it.each(['O que o serviço inclui e exclui', 'O que inclui?', 'What the service includes and excludes'])('não trata título sem item como alegação: %s', title => {
    const first = draft(); first.slides[0].title = title;
    expect(auditDraftFactuality(first, config)).toEqual([]);
    expect(auditUnsupportedCommercialClaims(first.slides, source)).toEqual([]);
  });

  it.each(['O que inclui suporte adicional?', 'O serviço inclui suporte adicional.', 'Inclui e exclui suporte adicional'])('mantém a conferência quando há item nomeado: %s', title => {
    const first = draft(); first.slides[0].title = title;
    expect(auditDraftFactuality(first, config)).toContainEqual(expect.objectContaining({ field: 'title', category: 'item incluso' }));
    expect(auditUnsupportedCommercialClaims(first.slides, source)).toContainEqual(expect.objectContaining({ category: 'item incluso' }));
  });

  it('não une campos para fabricar uma alegação e mantém valores factuais fornecidos', () => {
    const first = draft();
    first.slides[2].title = 'Duas';
    first.slides[2].subtitle = 'Vezes em que vale conferir o site';
    first.slides[2].bodyAfterImage = 'O diagnóstico custa R$ 399.';
    expect(auditDraftFactuality(first, { ...config, factualSource: `${source}\nO diagnóstico custa R$ 399.` })).toEqual([]);
  });

  it.each(['none', 'editorial', 'how_to', 'storytelling', 'viral', 'pain', 'deep', 'jornalistico', 'sensacionalista'])('o modo %s usa fatos brutos, revisa invenções e mantém densidade', async narrativeMode => {
    const first = draft();
    first.slides[1].subtitle = 'O telefone mudou três vezes.';
    first.slides[2].bodyAfterImage = 'Um parágrafo desnecessário sobre detalhes do site. '.repeat(7);
    const ai = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce({ edits: [
      { slideIndex: 1, reason: 'O brief só informa telefone antigo', subtitle: 'O telefone antigo dificulta o contato.' },
      { slideIndex: 2, reason: 'Uma ideia, sem repetição', bodyAfterImage: 'Solicite uma análise do site.' },
    ] });
    const result = await generateReviewedCarousel({ prompt: 'TEMPLATE EXEMPLO: 24 horas, 98% e WhatsApp. Não são fatos.', config: { ...config, narrativeMode } }, ai);
    expect(result.reviewStatus).toBe('revised');
    expect(result.result.slides[1].subtitle).not.toContain('três vezes');
    expect(result.result.slides[2].bodyAfterImage).toBe('Solicite uma análise do site.');
    expect(ai).toHaveBeenCalledTimes(2);
    expect(ai.mock.calls[0][0]).toContain('<material_factual_do_usuario>');
    expect(ai.mock.calls[1][0]).toContain('slideIndex 1, subtitle: três vezes');
  });

  it('faz um reparo direcionado se a revisão mantém dado inventado, sem tocar nos cards corretos', async () => {
    const first = draft();
    first.slides[1].subtitle = 'O telefone está errado há dois anos.';
    const ai = vi.fn().mockResolvedValueOnce(first)
      .mockResolvedValueOnce({ edits: [] })
      .mockResolvedValueOnce({ edits: [{ slideIndex: 1, reason: 'Tempo não consta no material', subtitle: 'O telefone antigo pode dificultar o contato.' }] });
    const onStage = vi.fn();
    const result = await generateReviewedCarousel({ prompt: 'Brief', config, onStage }, ai);
    expect(result.reviewStatus).toBe('repaired');
    expect(ai).toHaveBeenCalledTimes(3);
    expect(ai.mock.calls[2][0]).toContain('Edite somente slideIndex 1.');
    expect(onStage).toHaveBeenCalledWith('repairing');
    expect(result.result.slides[0]).toEqual(first.slides[0]);
  });

  it('não perde correções úteis nem corta frases quando o último reparo falha', async () => {
    const first = draft();
    first.slides[1].subtitle = 'O telefone mudou três vezes.';
    first.slides[2].bodyAfterImage = 'Um texto longo com condição essencial no final. '.repeat(6) + 'Somente se o usuário autorizar.';
    const ai = vi.fn().mockResolvedValueOnce(first)
      .mockResolvedValueOnce({ edits: [{ slideIndex: 1, reason: 'Remover frequência inventada', subtitle: 'O telefone estava antigo.' }] })
      .mockRejectedValueOnce(new Error('offline'));
    const result = await generateReviewedCarousel({ prompt: 'Brief', config }, ai);
    expect(result.reviewStatus).toBe('needs_attention');
    expect(result.result.slides[1].subtitle).toBe('O telefone estava antigo.');
    expect(result.result.slides[2].bodyAfterImage).toBe(first.slides[2].bodyAfterImage);
    expect(result.violations).toContainEqual(expect.objectContaining({ kind: 'density', slideIndex: 2, field: 'bodyAfterImage' }));
    expect(ai).toHaveBeenCalledTimes(3);
  });

  it('não troca um rascunho seguro por invenção introduzida pela revisão', async () => {
    const first = draft();
    const ai = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce({ edits: [
      { slideIndex: 1, reason: 'Exemplo mais concreto', subtitle: 'O telefone está errado há dois anos.' },
      { slideIndex: 2, reason: 'Sintetizar', title: 'Revise o CTA' },
    ] });
    const result = await generateReviewedCarousel({ prompt: 'Brief', config }, ai);
    expect(result.result.slides[1].subtitle).toBe(first.slides[1].subtitle);
    expect(result.result.slides[2].title).toBe('Revise o CTA');
    expect(auditDraftFactuality(result.result, config)).toEqual([]);
    expect(ai).toHaveBeenCalledTimes(2);
  });

  it('refinamento não pode acrescentar fatos ou trocar a quantidade, e tem o mesmo limite Balanceado', () => {
    const before = draft();
    const candidate = draft();
    candidate.slides[2].subtitle = 'Tudo fica pronto em dois dias.';
    expect(() => assertSocialRefinement(before, candidate, config)).toThrow('informações sem apoio');
    candidate.slides[2].subtitle = 'Explicação longa demais. '.repeat(12);
    expect(() => assertSocialRefinement(before, candidate, config)).toThrow('limite de texto');
    expect(() => assertSocialRefinement(before, { slides: [] }, config)).toThrow('quantidade');
    expect(before).toEqual(draft());
  });

  it('publica prévia antes da revisão e ignora resposta tardia depois de cancelar', async () => {
    let finishReview;
    const ai = vi.fn().mockResolvedValueOnce(draft()).mockImplementationOnce(() => new Promise(resolve => { finishReview = resolve; }));
    const signal = new AbortController();
    const onDraft = vi.fn();
    const promise = generateReviewedCarousel({ prompt: 'Brief', config, onDraft, aiOptions: { signal: signal.signal } }, ai);
    await vi.waitFor(() => expect(ai).toHaveBeenCalledTimes(2));
    expect(onDraft).toHaveBeenCalledWith(draft(), { phase: 'reviewing' });
    signal.abort();
    finishReview({ edits: [] });
    await expect(promise).rejects.toBeTruthy();
    expect(ai).toHaveBeenCalledTimes(2);
  });
});

// MF-04: o auditor reprovava a dedução correta ("seis dias" de terça a
// domingo) e a célula de uma tabela colada ao cabeçalho seguinte ("41.200" +
// "Ano"), entregando a apresentação como "Rascunho preservado".
describe('MF-04 — deduções de calendário e tabelas não são dado inventado', () => {
  const padaria = 'Padaria de bairro. Equipe de 6 funcionários. Funciona de terça a domingo, das 7h às 13h. Fechada às segundas. Em 2025 vendeu 41.200 pães.';
  const cfg = { count: 1, presetId: 'livre', densityId: '1_1', factualSource: padaria };
  const um = text => ({ slides: [{ title: 'Horário', subtitle: text, bodyAfterImage: '' }] });

  it.each([
    'A padaria abre seis dias por semana.',
    'São 6 dias de pão fresco.',
    'Seis horas de loja aberta por dia.',
  ])('aceita contagem deduzida do horário informado: %s', text => {
    expect(auditDraftFactuality(um(text), cfg)).toEqual([]);
  });

  it('continua reprovando contagem que o horário não sustenta', () => {
    expect(auditDraftFactuality(um('Aberta sete dias por semana.'), cfg)).toContainEqual(expect.objectContaining({ claim: 'sete dias' }));
    expect(auditDraftFactuality(um('Oito horas de loja aberta.'), cfg)).toContainEqual(expect.objectContaining({ claim: 'Oito horas' }));
  });

  it('não junta o número de uma célula com a palavra da linha seguinte', () => {
    const draft = um('Volume do ano.');
    draft.slides[0].bodyAfterImage = 'Pães vendidos\n41.200\nAno\n2025';
    expect(auditDraftFactuality(draft, cfg)).toEqual([]);
  });

  it('segunda a sexta e monday to friday contam cinco dias', () => {
    const semana = { ...cfg, factualSource: 'Atendimento de segunda a sexta. Support Monday to Friday.' };
    expect(auditDraftFactuality(um('Cinco dias de atendimento. Five days a week.'), semana)).toEqual([]);
  });
});

describe('MF-04 — revisão conferida e generalização sobre terceiros', () => {
  const padaria = 'Padaria Fermento da Marta. Todos os pães usam fermentação natural de 36 horas. Encomendas com 1 dia de antecedência.';
  const cfg = { count: 3, presetId: 'livre', densityId: '1_1', factualSource: padaria };
  const rascunho = () => ({ caption: 'Conheça a padaria.', slides: [
    { title: 'Pão do bairro', subtitle: 'Fermentação natural de 36 horas.', bodyAfterImage: '', imageQuery: '' },
    { title: 'Sem pressa', subtitle: 'Todos os pães usam fermentação natural.', bodyAfterImage: '', imageQuery: '' },
    { title: 'Encomende', subtitle: 'Encomendas com 1 dia de antecedência.', bodyAfterImage: '', imageQuery: '' },
  ] });

  it('"a maioria dos pães industrializados" é generalização sem fonte', () => {
    const draft = rascunho();
    draft.slides[1].subtitle = 'A maioria dos pães industrializados acelera o processo.';
    expect(auditDraftFactuality(draft, cfg)).toContainEqual(expect.objectContaining({ slideIndex: 1, category: 'afirmação absoluta' }));
  });

  it('revisão válida com todas as edições recusadas por fato novo não vira "revisão não concluída"', async () => {
    const callAI = vi.fn()
      .mockResolvedValueOnce(rascunho())
      .mockResolvedValueOnce({ edits: [{ slideIndex: 1, reason: 'mais concreto', subtitle: 'Feito em 2 horas, todos os dias.' }] });
    const out = await generateReviewedCarousel({ prompt: 'Carrossel', config: cfg, aiOptions: {} }, callAI);
    expect(out.reviewStatus).toBe('unchanged');
    expect(out.result.slides[1].subtitle).toBe('Todos os pães usam fermentação natural.');
  });
});

describe('MF-04/MF-12 — rotina inventada e nota de briefing em oração', () => {
  const cfg = { count: 1, presetId: 'livre', densityId: '1_1', factualSource: 'Padaria de bairro. Funciona de terça a domingo, das 7h às 13h.' };
  const um = text => ({ slides: [{ title: 'Pão', subtitle: text, bodyAfterImage: '' }] });
  it.each(['Equipe pequena, pão feito à mão.', 'Pão fresco todos os dias.', 'Pão quentinho toda manhã.'])('marca rotina ou feitura sem fonte: %s', text => {
    expect(auditDraftFactuality(um(text), cfg)).toContainEqual(expect.objectContaining({ category: 'rotina ou feitura sem fonte' }));
  });
  it('não marca quando o material informa', () => {
    expect(auditDraftFactuality(um('Pão feito à mão.'), { ...cfg, factualSource: 'Todo pão é feito à mão.' })).toEqual([]);
  });
  it('remove só a oração da nota e preserva o restante do título', async () => {
    const { stripBriefingNotes } = await import('../../src/utils/factual-grounding.js');
    expect(stripBriefingNotes('Preços dos pães definidos; investimento da proposta não informado')).toBe('Preços dos pães definidos');
    expect(stripBriefingNotes('Investimento não informado.')).toBe('');
  });
});

describe('MF-04 — conta com preços informados não é preço inventado', () => {
  const cfg = { count: 1, presetId: 'livre', densityId: '1_1', factualSource: 'Camponês: R$ 28. Brioche: R$ 36.' };
  const um = text => ({ slides: [{ title: 'Resposta', subtitle: text, bodyAfterImage: '' }] });
  it('aceita a soma de unidades dos preços do material', () => {
    expect(auditDraftFactuality(um('Dois Camponês (R$ 56) e um Brioche: R$ 92.'), cfg)).toEqual([]);
  });
  it('continua marcando preço que não sai dos preços informados', () => {
    expect(auditDraftFactuality(um('Combo por R$ 50.'), cfg)).toContainEqual(expect.objectContaining({ category: 'preço', claim: 'R$ 50' }));
  });
});

describe('MF-04 (reteste 20/11) — anos informados', () => {
  const cfg = { count: 1, presetId: 'livre', densityId: '1_1', factualSource: 'Fundada em 2019. Em 2025 vendeu 41.200 pães.' };
  const um = text => ({ slides: [{ title: 'Volume', subtitle: text, bodyAfterImage: '' }] });
  it.each(['Em um ano, a padaria atingiu esse volume.', 'São seis anos de padaria, de 2019 a 2025.'])('aceita %s', text => {
    expect(auditDraftFactuality(um(text), cfg)).toEqual([]);
  });
  it('continua marcando período que os anos não sustentam', () => {
    expect(auditDraftFactuality(um('Em três anos dobrou as vendas.'), cfg)).toContainEqual(expect.objectContaining({ claim: 'três anos' }));
  });
});

// MOO-12 (auditoria 20/11): no 694fb09 qualquer número de 4 dígitos virava
// ano e sustentava "um ano" e qualquer diferença entre eles virava duração.
describe('MOO-12 — só ano de verdade sustenta duração', () => {
  const um = text => ({ slides: [{ title: 'Volume', subtitle: text, bodyAfterImage: '' }] });
  const audit = (source, text) => auditDraftFactuality(um(text), { count: 1, presetId: 'livre', densityId: '1_1', factualSource: source });

  it('quantidade de 4 dígitos não é ano: "2010 clientes em 2024" não sustenta "14 anos"', () => {
    expect(audit('Atendemos 2010 clientes em 2024.', 'Há 14 anos no mercado.')).toContainEqual(expect.objectContaining({ claim: '14 anos' }));
  });

  it('dois números de 4 dígitos sem ano não sustentam "quinze anos"', () => {
    expect(audit('Vendemos 2000 pães e 2015 bolos.', 'Há quinze anos no bairro.')).toContainEqual(expect.objectContaining({ claim: 'quinze anos' }));
  });

  it('ano sem resultado no mesmo período não sustenta "em um ano"', () => {
    expect(audit('Pesquisa de 2023 com moradores do bairro.', 'Dobrou o faturamento em um ano.')).toContainEqual(expect.objectContaining({ claim: 'um ano' }));
  });

  it('ano numa célula de tabela ("Ano 2025") com o volume ao lado continua sustentando "em um ano"', () => {
    expect(audit('Pães vendidos\n41.200\nAno\n2025', 'Em um ano, a padaria vendeu esse volume.')).toEqual([]);
  });
});

describe('lote B (21/11) — artigo não é contagem', () => {
  const cfg = { count: 1, presetId: 'livre', densityId: '1_1', factualSource: 'Padaria de bairro.' };
  it.each(['Um cliente retira na padaria.', 'Uma vez por semana a padaria fecha.'])('não marca: %s', text => {
    expect(auditDraftFactuality({ slides: [{ title: 'x', subtitle: text, bodyAfterImage: '' }] }, cfg)).toEqual([]);
  });
  it('continua marcando contagem real de clientes', () => {
    expect(auditDraftFactuality({ slides: [{ title: 'x', subtitle: 'Atendemos 300 clientes.', bodyAfterImage: '' }] }, cfg))
      .toContainEqual(expect.objectContaining({ claim: '300 clientes' }));
  });
});
