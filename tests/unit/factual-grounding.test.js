import { describe, expect, it, vi } from 'vitest';
import { auditDraftFactuality, factualEvidenceText } from '../../src/utils/factual-grounding.js';
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
