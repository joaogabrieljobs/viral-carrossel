import { describe, expect, it, vi } from 'vitest';
import { generateReviewedCarousel, PRESENTATION_REVIEW_SYSTEM_PROMPT } from '../../src/utils/editorial-review.js';
import { PRESENTATION_PLAN_PROMPT_VERSION } from '../../src/utils/presentation-plan.js';

const sources = [{ id: 'brief', text: 'O software está construído. A assinatura ainda está em estudo. O piloto pago será a próxima validação.' }];
const plan = () => ({
  schemaVersion: 1, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
  objective: 'Avaliar a primeira oferta', audience: 'Parceiros', thesis: 'Validar a continuidade em uma primeira oferta paga.',
  evidence: [
    { id: 'e1', status: 'fact', sourceId: 'brief', quote: 'O software está construído.', claim: 'Software construído.' },
    { id: 'e2', status: 'proposal', sourceId: 'brief', quote: 'A assinatura ainda está em estudo.', claim: 'Assinatura em estudo.' },
  ],
  gaps: ['Preço ainda não definido.'],
  slides: [
    { index: 1, visualRole: 'cover', purpose: 'introduction', question: 'Qual é a proposta?', keyMessage: 'Acompanhar com continuidade.', evidenceIds: ['e1'], imageBrief: 'A person reviewing their personal records at a desk' },
    { index: 2, visualRole: 'data', purpose: 'business_model', question: 'Como a oferta poderá gerar receita?', keyMessage: 'Validar a assinatura antes de escalar.', evidenceIds: ['e2'], imageBrief: '' },
    { index: 3, visualRole: 'closing', purpose: 'decision', question: 'Qual é o próximo passo?', keyMessage: 'Definir o piloto pago.', evidenceIds: [], imageBrief: '' },
  ],
});
const draft = () => ({
  slides: [
    { title: 'Um histórico contínuo', subtitle: 'Software para organizar informações.', bodyAfterImage: '', imageQuery: 'person at a desk', speakerNotes: 'O software está construído.' },
    { title: 'Validar a assinatura', subtitle: 'Uma oferta em estudo.', bodyAfterImage: '', imageQuery: '', speakerNotes: 'O preço ainda será definido.', presentationBlocks: [{ type: 'steps', items: [{ title: 'Definir escopo', body: 'Delimitar a primeira oferta.' }, { title: 'Testar', body: 'Acompanhar o piloto pago.' }] }] },
    { title: 'Preparar o piloto pago', subtitle: 'A próxima validação depende de escopo e preço.', bodyAfterImage: '', imageQuery: '', speakerNotes: '' },
  ], caption: 'Próximos passos da primeira oferta.',
});
const config = overrides => ({
  count: 3, presetId: 'apresentacao', presentationPath: 'pitch', presentationPlanning: true,
  planningContext: { brief: 'Criar apresentação para parceiros.', sources }, ...overrides,
});
const planWithCount = count => {
  const value = plan();
  value.slides = Array.from({ length: count }, (_, index) => ({
    ...value.slides[index === 0 ? 0 : index === count - 1 ? 2 : 1],
    index: index + 1, question: `Qual é a contribuição ${index + 1}?`,
    keyMessage: `Contribuição ${index + 1} para definir a oferta.`,
  }));
  return value;
};
const batch = (offset, size = 3) => ({
  slides: Array.from({ length: size }, (_, index) => ({
    title: `Mensagem ${offset + index + 1}`, subtitle: 'A oferta continua em estudo.', bodyAfterImage: '', imageQuery: '',
    speakerNotes: 'Preço a definir.', presentationBlocks: [],
  })), caption: 'Primeira oferta em estudo.',
});

describe('apresentação planejada e revisada', () => {
  it('planeja antes de escrever, valida evidências e persiste o papel de cada slide', async () => {
    const onStage = vi.fn();
    const onPlan = vi.fn();
    const onDraft = vi.fn();
    const limitsForPlan = vi.fn(() => []);
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(draft()).mockResolvedValueOnce({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: 'Material e direção visual.', config: config({ presentationLimitsForPlan: limitsForPlan }), onStage, onPlan, onDraft }, ai);
    expect(ai).toHaveBeenCalledTimes(3);
    expect(ai.mock.calls[0][0]).toContain('PLANEJAMENTO ESTRUTURADO');
    expect(ai.mock.calls[1][0]).toContain('PLANO EDITORIAL VALIDADO');
    expect(ai.mock.calls[2][0]).toContain('Compare também o roteiro validado');
    expect(limitsForPlan).toHaveBeenCalledTimes(3);
    expect(output.plan.evidence[1].status).toBe('proposal');
    expect(output.result.slides[1].presentationPlan).toMatchObject({ purpose: 'business_model', visualRole: 'data', evidenceStatus: ['proposal'] });
    expect(output.result.slides[1].speakerNotes).toContain('preço ainda será definido');
    expect(onStage.mock.calls.map(call => call[0])).toEqual(['planning', 'writing', 'reviewing']);
    expect(onPlan).toHaveBeenCalledTimes(1);
    expect(onPlan.mock.invocationCallOrder[0]).toBeLessThan(onDraft.mock.invocationCallOrder[0]);
    expect(onDraft.mock.calls.map(([, meta]) => meta.phase)).toEqual(['writing', 'reviewing']);
    expect(ai.mock.calls[0][1].contentMode).toBe('presentation');
    expect(ai.mock.calls.slice(1).every(([, options]) => options.contentMode === 'pitch')).toBe(true);
    expect(ai.mock.calls.every(([, options]) => options.json && options.temperature === 0.2 && options.maxTokens === 8192 && options.thinking === 'disabled')).toBe(true);
  });

  it('leva a tarefa já escrita ao debrief no lote seguinte e preserva instruções completas nas três etapas', async () => {
    const lessonPlan = planWithCount(6);
    lessonPlan.slides[2] = { ...lessonPlan.slides[2], purpose: 'practice', visualRole: 'content',
      question: 'Quais afirmações são fato e proposta?', keyMessage: 'Classificar duas afirmações e justificar pela modalidade.', evidenceIds: ['e1', 'e2'] };
    lessonPlan.slides[3] = { ...lessonPlan.slides[3], purpose: 'learning', visualRole: 'content',
      question: 'Como corrigir as duas classificações?', keyMessage: 'Construído é fato; assinatura em estudo é proposta.', evidenceIds: ['e1', 'e2'] };
    const firstBatch = batch(0);
    firstBatch.slides[2] = { title: 'Classifique as duas afirmações',
      subtitle: 'Entregue duas linhas: software construído e assinatura em estudo. Classifique cada uma e justifique.',
      bodyAfterImage: 'Critério: distinguir o que existe da intenção.', speakerNotes: 'Use somente as duas afirmações do caso.',
      imageQuery: '', presentationBlocks: [], bgImageId: 'media-must-not-become-evidence' };
    const secondBatch = batch(3);
    secondBatch.slides[0] = { title: 'Confira as duas classificações',
      subtitle: 'Software construído é fato. Assinatura em estudo é proposta, pois ainda depende de validação.',
      bodyAfterImage: 'Não classifique uma intenção como resultado.', speakerNotes: '', imageQuery: '', presentationBlocks: [] };
    const instructions = 'Contexto adicional. '.repeat(180) + 'RESTRIÇÃO FINAL: use apenas as duas afirmações fornecidas; não crie outro caso.';
    const ai = vi.fn().mockResolvedValueOnce(lessonPlan).mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce(secondBatch).mockResolvedValueOnce({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: 'Ensine a distinguir fato de proposta.',
      config: config({ count: 6, presentationPath: 'aula', userInstructions: instructions }) }, ai);
    expect(ai).toHaveBeenCalledTimes(4); // no extra planning/review call
    for (const [prompt] of ai.mock.calls.slice(0, 3)) expect(prompt).toContain(instructions);
    expect(ai.mock.calls[3][0]).toContain(JSON.stringify(instructions));
    expect(ai.mock.calls[0][0]).toContain('CONTRATO DA ATIVIDADE E DA CORREÇÃO');
    const previousTask = JSON.parse(ai.mock.calls[2][0].match(/ATIVIDADES JÁ REDIGIDAS — CONTINUIDADE, NÃO FONTE FACTUAL:\n([^\n]+)/)[1]);
    expect(previousTask).toEqual([{ index: 3, title: firstBatch.slides[2].title,
      subtitle: firstBatch.slides[2].subtitle, bodyAfterImage: firstBatch.slides[2].bodyAfterImage,
      presentationBlocks: [], speakerNotes: firstBatch.slides[2].speakerNotes }]);
    expect(JSON.stringify(previousTask)).not.toContain('media-must-not-become-evidence');
    expect(output.result.slides).toHaveLength(6);
    expect(output.result.slides[3].title).toBe(secondBatch.slides[0].title);
  });

  it('interrompe antes da redação se a fonte ou a citação for inventada', async () => {
    const invalid = plan();
    invalid.evidence[0].quote = 'Retenção de 95% comprovada.';
    const ai = vi.fn().mockResolvedValue(invalid);
    await expect(generateReviewedCarousel({ prompt: '', config: config() }, ai)).rejects.toMatchObject({ code: 'presentation_plan_invalid' });
    expect(ai).toHaveBeenCalledTimes(2);
  });

  it('revisão tem sistema e contrato próprios, fontes originais e instruções completas, sem receitas da redação', async () => {
    const instructions = 'Use somente os dados fornecidos; não invente nomes, datas nem fornecedores.\n'
      + 'Preserve esta instrução completa. '.repeat(120) + 'FIM DAS INSTRUÇÕES ATUAIS.';
    const original = 'O piloto não teve grupo de controle. Data de início permanece em definição.';
    const firstPlan = plan(); firstPlan.evidence[0].claim = 'CLAIM GERADO NÃO É FONTE: Ana aprovou fornecedor A em 10/06.';
    const ai = vi.fn().mockResolvedValueOnce(firstPlan).mockResolvedValueOnce(draft()).mockResolvedValueOnce({ edits: [] });
    await generateReviewedCarousel({
      prompt: 'RECEITA VISUAL EXEMPLO NÃO FACTUAL: fornecedor B, Maria e 10/07. JSON exato a retornar: {"slides":[]}',
      config: config({ userInstructions: instructions, factualSource: 'Contexto factual atual.', planningContext: {
        brief: 'Criar uma aula somente com o material original.', sources: [...sources, { id: 'anexo', text: original }],
      } }), aiOptions: { systemPrompt: 'Você é o redator: gere slides completos.' },
    }, ai);
    const [reviewPrompt, reviewOptions] = ai.mock.calls[2];
    expect(ai.mock.calls[1][1].systemPrompt).toBe('Você é o redator: gere slides completos.');
    expect(reviewOptions).toMatchObject({ systemPrompt: PRESENTATION_REVIEW_SYSTEM_PROMPT, thinking: 'disabled', maxTokens: 8192 });
    expect(reviewPrompt).toContain(JSON.stringify(instructions));
    expect(reviewPrompt).toContain(original);
    expect(reviewPrompt).toContain('Contexto factual atual.');
    expect(reviewPrompt).toContain('Criar uma aula somente com o material original.');
    expect(reviewPrompt).toContain('ROTEIRO — SOMENTE ESTRUTURA, NÃO É FONTE FACTUAL');
    expect(reviewPrompt).toContain('CONTRATO DE PATCH PARA BLOCOS');
    expect(reviewPrompt).toContain('"edits":[{"slideIndex":0');
    expect(reviewPrompt).not.toContain('RECEITA VISUAL EXEMPLO');
    expect(reviewPrompt).not.toContain('JSON exato a retornar');
    expect(reviewPrompt).not.toContain('CLAIM GERADO NÃO É FONTE');
    expect(reviewPrompt).not.toContain('em cada slide inclua presentationBlocks');
  });

  it.each([
    { edits: [], slides: [{ title: 'Outro deck' }] },
    { edits: [{ slideIndex: 0, reason: 'Trocar imagem', imageQuery: 'another image' }] },
  ])('rejeita resposta de revisão que mistura patches e campos de geração (%j)', async review => {
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(draft()).mockResolvedValueOnce(review);
    const output = await generateReviewedCarousel({ prompt: '', config: config() }, ai);
    expect(output.reviewStatus).toBe('unavailable');
    expect(output.result.slides[0].title).toBe(draft().slides[0].title);
    expect(output.result.slides[0].imageQuery).toBe(draft().slides[0].imageQuery);
    expect(ai).toHaveBeenCalledTimes(3);
  });

  it('cancelamento entre plano e redação impede a próxima chamada', async () => {
    const abort = new AbortController();
    const ai = vi.fn().mockImplementation(async () => { abort.abort(Object.assign(new Error('cancelado'), { code: 'generation_cancelled' })); return plan(); });
    await expect(generateReviewedCarousel({ prompt: '', config: config(), aiOptions: { signal: abort.signal } }, ai)).rejects.toMatchObject({ code: 'generation_cancelled' });
    expect(ai).toHaveBeenCalledOnce();
  });

  it('revisão corrige texto e bloco sem alterar o roteiro ou a imagem', async () => {
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(draft()).mockResolvedValueOnce({ edits: [{
      slideIndex: 1, reason: 'Explicitar que a oferta ainda é proposta.', subtitle: 'Assinatura proposta; preço a definir.',
      presentationBlocks: [{ type: 'steps', items: [{ title: 'Definir escopo', body: 'Descrever a oferta proposta.' }, { title: 'Testar piloto', body: 'Medir a disposição a pagar.' }] }],
    }] });
    const output = await generateReviewedCarousel({ prompt: '', config: config() }, ai);
    expect(output.reviewStatus).toBe('revised');
    expect(output.result.slides[1].presentationBlocks[0].items[1].title).toBe('Testar piloto');
    expect(output.result.slides[0].imageQuery).toBe('person at a desk');
    expect(output.result.slides[1].presentationPlan.evidenceIds).toEqual(['e2']);
  });

  it('preserva o corpo nas notas quando um bloco passa a carregar o detalhe visual', async () => {
    const first = draft();
    first.slides[1].bodyAfterImage = 'A contratação será avaliada após delimitar o escopo.';
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(first).mockResolvedValueOnce({ edits: [] });
    const { result } = await generateReviewedCarousel({ prompt: '', config: config() }, ai);
    expect(result.slides[1].bodyAfterImage).toBe('');
    expect(result.slides[1].speakerNotes).toContain('A contratação será avaliada após delimitar o escopo.');
  });

  it('faz um único reparo semântico restrito aos slides que excedem o limite', async () => {
    const limits = [{ title: { maxChars: 18 } }];
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(draft())
      .mockResolvedValueOnce({ edits: [] })
      .mockResolvedValueOnce({ edits: [{ slideIndex: 0, reason: 'Ajustar título sem perder a proposta.', title: 'Histórico contínuo', speakerNotes: 'O software está construído.' }] });
    const output = await generateReviewedCarousel({ prompt: '', config: config({ presentationTextLimits: limits }) }, ai);
    expect(ai).toHaveBeenCalledTimes(4);
    expect(output.reviewStatus).toBe('repaired');
    expect(ai.mock.calls[3][0]).toContain('slideIndex 0');
    expect(ai.mock.calls[3][1].systemPrompt).toBe(PRESENTATION_REVIEW_SYSTEM_PROMPT);
    expect(output.result.slides[0].title).toBe('Histórico contínuo');
  });

  it('preserva o rascunho completo quando não consegue reescrever, sem cortar condições', async () => {
    const first = draft();
    first.slides[0].title = 'Benefício esperado, condicionado à validação do piloto';
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(first)
      .mockRejectedValueOnce(new Error('revisão indisponível')).mockRejectedValueOnce(new Error('reparo indisponível'));
    const output = await generateReviewedCarousel({ prompt: '', config: config({ presentationTextLimits: [{ title: { maxChars: 18 } }] }) }, ai);
    expect(ai).toHaveBeenCalledTimes(4);
    expect(output.reviewStatus).toBe('needs_attention');
    expect(output.result.slides[0].title).toBe(first.slides[0].title);
    expect(output.violations[0].slideIndex).toBe(0);
  });

  it('cancelar reparo não publica um resultado tardio', async () => {
    const abort = new AbortController();
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(draft()).mockResolvedValueOnce({ edits: [] })
      .mockImplementationOnce(async () => { abort.abort(Object.assign(new Error('cancelado'), { code: 'generation_cancelled' })); return { edits: [] }; });
    await expect(generateReviewedCarousel({ prompt: '', config: config({ presentationTextLimits: [{ title: { maxChars: 4 } }] }), aiOptions: { signal: abort.signal } }, ai)).rejects.toMatchObject({ code: 'generation_cancelled' });
  });

  it.each([6, 12])('escreve %i slides em lotes de três com ordem global e prévias progressivas', async count => {
    const onDraft = vi.fn(); const onPlan = vi.fn(); const onStage = vi.fn();
    const ai = vi.fn().mockResolvedValueOnce(planWithCount(count));
    for (let offset = 0; offset < count; offset += 3) ai.mockResolvedValueOnce(batch(offset));
    ai.mockResolvedValueOnce({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: 'Material de origem.', config: config({ count }), onDraft, onPlan, onStage }, ai);
    expect(ai).toHaveBeenCalledTimes(2 + count / 3);
    expect(output.result.slides.map(slide => slide.title)).toEqual(Array.from({ length: count }, (_, index) => `Mensagem ${index + 1}`));
    expect(output.result.slides.map(slide => slide.presentationPlan.index)).toEqual(Array.from({ length: count }, (_, index) => index + 1));
    expect(onDraft.mock.calls.filter(([, meta]) => meta.phase === 'writing').map(([value, meta]) => [value.slides.length, meta.completedCount, meta.totalCount, meta.partial]))
      .toEqual(Array.from({ length: count / 3 }, (_, index) => [(index + 1) * 3, (index + 1) * 3, count, (index + 1) * 3 < count]));
    for (let offset = 0; offset < count; offset += 3) {
      const prompt = ai.mock.calls[1 + offset / 3][0];
      expect(prompt).toContain(`apenas as posições ${offset + 1}, ${offset + 2}, ${offset + 3}`);
      expect(prompt).toContain('EXATAMENTE 3 objetos');
      if (offset > 0) expect(prompt).toContain('Mensagem 1');
    }
    expect(onPlan).toHaveBeenCalledTimes(1);
    expect(onStage.mock.calls.map(call => call[0])).toEqual(['planning', ...Array(count / 3).fill('writing'), 'reviewing']);
  });

  it('preserva três slides completos quando o lote seguinte falha duas vezes', async () => {
    const ai = vi.fn().mockResolvedValueOnce(planWithCount(6)).mockResolvedValueOnce(batch(0))
      .mockRejectedValueOnce(Object.assign(new Error('truncado'), { code: 'ai_output_truncated' }))
      .mockRejectedValueOnce(Object.assign(new Error('truncado'), { code: 'ai_output_truncated' }));
    const onDraft = vi.fn(); const onReview = vi.fn();
    const output = await generateReviewedCarousel({ prompt: '', config: config({ count: 6 }), onDraft, onReview }, ai);
    expect(ai).toHaveBeenCalledTimes(4);
    expect(output).toMatchObject({ incomplete: true, completedCount: 3, totalCount: 6, reviewStatus: 'needs_attention' });
    expect(output.result.slides.map(slide => slide.title)).toEqual(['Mensagem 1', 'Mensagem 2', 'Mensagem 3']);
    expect(output.violations).toContainEqual(expect.objectContaining({ code: 'presentation_incomplete', completedCount: 3, totalCount: 6 }));
    expect(onDraft).toHaveBeenCalledTimes(1);
    expect(onReview).not.toHaveBeenCalled();
  });

  it('o último lote de uma apresentação com cinco slides contém apenas as duas posições restantes', async () => {
    const ai = vi.fn().mockResolvedValueOnce(planWithCount(5)).mockResolvedValueOnce(batch(0)).mockResolvedValueOnce(batch(3, 2)).mockResolvedValueOnce({ edits: [] });
    const onDraft = vi.fn();
    const output = await generateReviewedCarousel({ prompt: '', config: config({ count: 5 }), onDraft }, ai);
    expect(ai).toHaveBeenCalledTimes(4);
    expect(ai.mock.calls[2][0]).toContain('EXATAMENTE 2 objetos');
    expect(ai.mock.calls[2][0]).toContain('apenas as posições 4, 5');
    expect(output.result.slides).toHaveLength(5);
    expect(output.result.slides.at(-1).presentationPlan).toMatchObject({ index: 5, visualRole: 'closing' });
    expect(onDraft.mock.calls.filter(([, meta]) => meta.phase === 'writing').map(([value]) => value.slides.length)).toEqual([3, 5]);
  });

  it('cancelamento na prévia do primeiro lote impede a geração do próximo', async () => {
    const abort = new AbortController();
    const ai = vi.fn().mockResolvedValueOnce(planWithCount(6)).mockResolvedValueOnce(batch(0));
    const onDraft = vi.fn(() => abort.abort(Object.assign(new Error('cancelado'), { code: 'generation_cancelled' })));
    await expect(generateReviewedCarousel({ prompt: '', config: config({ count: 6 }), aiOptions: { signal: abort.signal }, onDraft }, ai)).rejects.toMatchObject({ code: 'generation_cancelled' });
    expect(ai).toHaveBeenCalledTimes(2);
    expect(onDraft).toHaveBeenCalledTimes(1);
  });

  it.each([' ', 'Fonte: material fornecido'])('repara título ausente ou removido pela limpeza (%j) antes de mostrar a prévia', async title => {
    const invalid = batch(0); invalid.slides[1].title = title;
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(invalid).mockResolvedValueOnce(batch(0)).mockResolvedValueOnce({ edits: [] });
    const onDraft = vi.fn(); const onStage = vi.fn();
    const output = await generateReviewedCarousel({ prompt: '', config: config(), onDraft, onStage }, ai);
    expect(ai).toHaveBeenCalledTimes(4);
    expect(ai.mock.calls[2][0]).toContain('A resposta anterior deste lote não pôde ser utilizada');
    expect(onStage.mock.calls.map(call => call[0])).toContain('writing_repair');
    expect(onDraft.mock.calls[0][0].slides.every(slide => slide.title.trim())).toBe(true);
    expect(output.result.slides[1].title).toBe('Mensagem 2');
  });

  it('uma revisão que apaga o título mantém o rascunho com título', async () => {
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(batch(0))
      .mockResolvedValueOnce({ edits: [{ slideIndex: 1, reason: 'Simplificar', title: '' }] });
    const output = await generateReviewedCarousel({ prompt: '', config: config() }, ai);
    expect(output.result.slides[1].title).toBe('Mensagem 2');
    expect(output.reviewStatus).toBe('unavailable');
  });

  it('não ignora um bloco inválido no lote, mesmo com texto válido', async () => {
    const invalid = batch(0); invalid.slides[1].presentationBlocks = [{ type: 'execute-code', script: 'removeProjects()' }];
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(invalid).mockResolvedValueOnce(batch(0)).mockResolvedValueOnce({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: '', config: config() }, ai);
    expect(ai).toHaveBeenCalledTimes(4);
    expect(output.result.slides[1].presentationBlocks).toEqual([]);
    expect(JSON.stringify(output.result)).not.toContain('removeProjects');
  });

  it.each([
    { code: 'session_required' }, { code: 'subscription_required' }, { code: 'unauthorized', status: 401 }, { code: 'forbidden', status: 403 }, { isSessionGate: true },
  ])('não repete chamada do primeiro lote quando há bloqueio de acesso %j', async details => {
    const denied = Object.assign(new Error('Acesso necessário.'), details);
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockRejectedValue(denied);
    await expect(generateReviewedCarousel({ prompt: '', config: config() }, ai)).rejects.toBe(denied);
    expect(ai).toHaveBeenCalledTimes(2);
  });

  it('bloqueio de acesso após o primeiro lote preserva os slides concluídos sem repetir requisição', async () => {
    const denied = Object.assign(new Error('Sessão encerrada.'), { code: 'session_required', isSessionGate: true });
    const ai = vi.fn().mockResolvedValueOnce(planWithCount(6)).mockResolvedValueOnce(batch(0)).mockRejectedValue(denied);
    const output = await generateReviewedCarousel({ prompt: '', config: config({ count: 6 }) }, ai);
    expect(ai).toHaveBeenCalledTimes(3);
    expect(output).toMatchObject({ incomplete: true, completedCount: 3, totalCount: 6, reviewStatus: 'needs_attention' });
    expect(output.interruptionReason).toBe('session_required');
    expect(output.result.slides.map(slide => slide.title)).toEqual(['Mensagem 1', 'Mensagem 2', 'Mensagem 3']);
  });

  it.each([
    [{ status: 402, code: 'subscription_inactive' }, 'subscription_required'],
    [{ status: 403 }, 'access_denied'],
    [{ status: 429, code: 'rate_limited' }, 'rate_limited'],
  ])('preserva 6 de 12 e a causa de acesso sem confundir com erro da IA (%j)', async (details, interruptionReason) => {
    const denied = Object.assign(new Error('Texto privado da conta e do provedor.'), details);
    const ai = vi.fn().mockResolvedValueOnce(planWithCount(12)).mockResolvedValueOnce(batch(0)).mockResolvedValueOnce(batch(3)).mockRejectedValue(denied);
    const onStage = vi.fn();
    const output = await generateReviewedCarousel({ prompt: '', config: config({ count: 12 }), onStage }, ai);
    expect(ai).toHaveBeenCalledTimes(4);
    expect(output).toMatchObject({ incomplete: true, completedCount: 6, totalCount: 12, interruptionReason });
    expect(output.violations).toContainEqual(expect.objectContaining({ code: 'presentation_incomplete', kind: 'incomplete', interruptionReason, completedCount: 6, totalCount: 12 }));
    expect(output.issues).toContainEqual(expect.objectContaining({ code: 'presentation_incomplete', interruptionReason }));
    expect(output.writingDiagnostics.at(-1)).toMatchObject({ from: 7, to: 9, attempt: 1, outcome: 'access_interrupted', httpStatus: details.status,
      issue: { code: interruptionReason, path: '$' } });
    expect(onStage).toHaveBeenLastCalledWith('writing_interrupted', expect.objectContaining({ interruptionReason, completedCount: 6 }));
    expect(JSON.stringify(output.writingDiagnostics)).not.toContain('Texto privado');
  });

  it('recuperação informa o campo estrutural do lote com índice global, sem registrar conteúdo privado', async () => {
    const invalid = batch(3);
    invalid.slides[1].presentationBlocks = [{ type: 'metrics', items: [{ label: 'Informação privada', value: 90 }] }];
    const metadata = { provider: 'zai', model: 'glm-4.7', finishReason: 'stop', completionTokens: 630, promptTokens: 800, rawText: 'Segredo do briefing' };
    const onResponseMetadata = vi.fn();
    const ai = vi.fn().mockResolvedValueOnce(planWithCount(6)).mockResolvedValueOnce(batch(0))
      .mockImplementationOnce(async (_prompt, options) => { options.onResponseMetadata(metadata); return invalid; })
      .mockResolvedValueOnce(batch(3)).mockResolvedValueOnce({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: '', config: config({ count: 6 }), aiOptions: { onResponseMetadata } }, ai);
    expect(output.result.slides).toHaveLength(6);
    expect(ai).toHaveBeenCalledTimes(5);
    expect(output.writingDiagnostics[1]).toMatchObject({ from: 4, to: 6, attempt: 1, outcome: 'failed',
      issue: { code: 'presentation_blocks_invalid', path: 'slides[1].presentationBlocks', slideIndex: 4 },
      response: { model: 'glm-4.7', finishReason: 'stop', completionTokens: 630 } });
    expect(ai.mock.calls[3][0]).toContain('presentation_blocks_invalid');
    expect(ai.mock.calls[3][0]).toContain('todos os valores textuais de blocos devem ser strings');
    expect(onResponseMetadata).toHaveBeenCalledWith(metadata);
    expect(JSON.stringify(output.writingDiagnostics)).not.toMatch(/Informação privada|Segredo|rawText/);
  });

  it.each(['unchanged', 'unavailable'])('marca número sem fonte para conferência quando a revisão fica %s', async review => {
    const raw = batch(0); raw.slides[1].title = 'Retenção de 90%';
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(raw);
    if (review === 'unavailable') ai.mockRejectedValueOnce(new Error('revisão indisponível'));
    else ai.mockResolvedValueOnce({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: '', config: config({ factualSource: sources[0].text }) }, ai);
    expect(ai).toHaveBeenCalledTimes(3);
    expect(output.reviewStatus).toBe('needs_attention');
    expect(output.violations).toContainEqual(expect.objectContaining({ slideIndex: 1, field: 'title', kind: 'factual', category: 'dado sem fonte', claim: '90%' }));
    // A literal detector is not a semantic editor: it flags and preserves the
    // complete draft instead of silently deleting a possible calculation.
    expect(output.result.slides[1].title).toBe('Retenção de 90%');
  });

  it('confere também números de blocos nativos e notas, preservando o conteúdo para revisão', async () => {
    const raw = batch(0);
    raw.slides[1].presentationBlocks = [{ type: 'metrics', items: [{ label: 'Retenção', value: '90%', detail: 'Observação do piloto.' }] }];
    raw.slides[2].speakerNotes = 'A oferta alcançou 40 clientes.';
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(raw).mockResolvedValueOnce({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: '', config: config({ factualSource: sources[0].text }) }, ai);
    expect(output.reviewStatus).toBe('needs_attention');
    expect(output.violations).toContainEqual(expect.objectContaining({ slideIndex: 1, kind: 'factual', claim: '90%' }));
    expect(output.violations).toContainEqual(expect.objectContaining({ slideIndex: 2, kind: 'factual', claim: '40 clientes' }));
    expect(output.result.slides[1].presentationBlocks[0].items[0].value).toBe('90%');
    expect(output.result.slides[2].speakerNotes).toBe('A oferta alcançou 40 clientes.');
  });

  it.each(['text', 'chunks'])('confere o material original do reteste de 14/11 vindo de %s, sem usar o plano como prova', async sourceFormat => {
    // Trechos literais do material fictício em apresentacoes-producao-2026-11-14.md.
    const originalMaterial = 'Não inclui software próprio nem automação.\n'
      + 'O piloto gratuito ocorreu em quatro equipes de uma organização fictícia, com oito pessoas por equipe. A duração média registrada passou de 45 para 33 minutos.\n'
      + 'A oferta proposta é um programa de seis semanas por R$ 6.000, com pagamento de 50% no início e 50% na entrega.\n'
      + 'Ainda não existem contratos pagos nem dados sobre disposição a pagar.';
    const suppliedSource = { id: 'material', text: originalMaterial,
      ...(sourceFormat === 'chunks' ? { text: 'Material extraído separadamente.', chunks: [{ text: originalMaterial }] } : {}) };
    const raw = batch(0);
    raw.slides[0].subtitle = 'Caso fictício: piloto gratuito. Duração média observada: 33 minutos.';
    raw.slides[1].subtitle = 'Oferta proposta: seis semanas por R$ 6.000; 50% no início e 50% na entrega.';
    raw.slides[2].subtitle = 'Não inclui software ou automação.';
    const actualConfig = config({ factualSource: 'Apresente o método de reuniões.',
      userInstructions: 'O prazo para decidir é 2 dias.',
      planningContext: { brief: 'Apresente o método de reuniões.', sources: [...sources, suppliedSource] },
    });
    raw.slides[2].speakerNotes = 'O prazo para decidir é 2 dias.';
    const clean = await generateReviewedCarousel({ prompt: '', config: actualConfig }, vi.fn()
      .mockResolvedValueOnce(plan()).mockResolvedValueOnce(raw).mockResolvedValueOnce({ edits: [] }));
    expect(clean.reviewStatus).toBe('unchanged');
    expect(clean.violations).toBeUndefined();

    // Even a syntactically valid plan cannot make its own invented metric true.
    const inventedPlan = plan(); inventedPlan.evidence[0].claim = 'A retenção alcançou 90%.';
    raw.slides[0].title = 'A retenção alcançou 90%';
    const flagged = await generateReviewedCarousel({ prompt: 'Exemplo de estilo: retenção de 90%.', config: actualConfig }, vi.fn()
      .mockResolvedValueOnce(inventedPlan).mockResolvedValueOnce(raw).mockResolvedValueOnce({ edits: [] }));
    expect(flagged.reviewStatus).toBe('needs_attention');
    expect(flagged.violations).toContainEqual(expect.objectContaining({ field: 'title', claim: '90%', kind: 'factual' }));
  });
});
