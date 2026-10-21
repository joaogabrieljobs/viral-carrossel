import { describe, expect, it, vi } from 'vitest';
import { generateReviewedCarousel } from '../../src/utils/editorial-review.js';
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

describe('apresentação planejada e revisada', () => {
  it('planeja antes de escrever, valida evidências e persiste o papel de cada slide', async () => {
    const onStage = vi.fn();
    const limitsForPlan = vi.fn(() => []);
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(draft()).mockResolvedValueOnce({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: 'Material e direção visual.', config: config({ presentationLimitsForPlan: limitsForPlan }), onStage }, ai);
    expect(ai).toHaveBeenCalledTimes(3);
    expect(ai.mock.calls[0][0]).toContain('PLANEJAMENTO ESTRUTURADO');
    expect(ai.mock.calls[1][0]).toContain('PLANO EDITORIAL VALIDADO');
    expect(ai.mock.calls[2][0]).toContain('Compare também o roteiro validado');
    expect(limitsForPlan).toHaveBeenCalledTimes(3);
    expect(output.plan.evidence[1].status).toBe('proposal');
    expect(output.result.slides[1].presentationPlan).toMatchObject({ purpose: 'business_model', visualRole: 'data', evidenceStatus: ['proposal'] });
    expect(output.result.slides[1].speakerNotes).toContain('preço ainda será definido');
    expect(onStage.mock.calls.flat()).toEqual(['planning', 'writing', 'reviewing']);
    expect(ai.mock.calls.every(([, options]) => options.contentMode === 'pitch' && options.json && options.temperature === 0.2)).toBe(true);
  });

  it('interrompe antes da redação se a fonte ou a citação for inventada', async () => {
    const invalid = plan();
    invalid.evidence[0].quote = 'Retenção de 95% comprovada.';
    const ai = vi.fn().mockResolvedValue(invalid);
    await expect(generateReviewedCarousel({ prompt: '', config: config() }, ai)).rejects.toMatchObject({ code: 'presentation_plan_invalid' });
    expect(ai).toHaveBeenCalledOnce();
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
});
