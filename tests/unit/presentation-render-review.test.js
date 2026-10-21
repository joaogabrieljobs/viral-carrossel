import { describe, expect, it, vi } from 'vitest';
import { repairRenderedPresentation } from '../../src/utils/presentation-render-review.js';
import { PRESENTATION_PLAN_PROMPT_VERSION } from '../../src/utils/presentation-plan.js';

function input() {
  return {
    slides: [
      { id: 's0', title: 'Abertura que está adequada', subtitle: 'Não modificar', caption: '', presentationBlocks: [] },
      { id: 's1', title: 'Modelo de receita', subtitle: 'Proposta em estudo: assinatura por US$ 365/ano no primeiro ano, com detalhes operacionais que podem acompanhar a apresentação nas notas.',
        bodyAfterImage: 'O custo de atendimento deve ser medido na primeira coorte.', caption: 'Nota original que precisa continuar.', presentationBlocks: [],
        bgImage: 'blob:foto-original', logoImage: 'blob:logo-original', canvas: { zones: { title: { x: 6, y: 25, w: 88, h: 14 } } } },
    ],
    plan: { schemaVersion: 1, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
      evidence: [{ id: 'e1', status: 'proposal', claim: 'Preço proposto de US$ 365/ano.', quote: 'Preço proposto de US$ 365/ano.' },
        { id: 'secret-unrelated', status: 'fact', claim: 'Não pertence ao reparo', quote: 'Material de outro slide' }],
      slides: [{ index: 1, purpose: 'introduction', question: 'Abertura?', keyMessage: 'Abrir', evidenceIds: [] },
        { index: 2, purpose: 'business_model', question: 'Como gerar receita?', keyMessage: 'Preço é uma proposta em estudo.', evidenceIds: ['e1'] }],
    },
    issues: [{ code: 'render-overflow', slideId: 's1', slideIndex: 1 }], presentationPath: 'pitch',
    aiOptions: { openaiKey: 'not-in-prompt', maxTokens: 99999 },
  };
}
const validEdit = () => ({ slideIndex: 1, reason: 'Síntese preserva preço e condição.',
  subtitle: 'Proposta em estudo: US$ 365/ano no primeiro ano.', bodyAfterImage: '',
  caption: 'Nota original que precisa continuar.\n\nO custo de atendimento deve ser medido na primeira coorte. Detalhes operacionais acompanham a apresentação.' });

describe('one bounded repair after real render overflow', () => {
  it('returns minimal guarded patches and preserves the snapshot/media', async () => {
    const options = input(); const before = structuredClone(options);
    const call = vi.fn(async () => ({ edits: [validEdit()] }));
    const result = await repairRenderedPresentation(options, call);
    expect(result.status).toBe('repaired'); expect(result.patches).toHaveLength(1);
    expect(result.patches[0]).toMatchObject({ slideId: 's1', slideIndex: 1,
      before: { title: 'Modelo de receita', subtitle: before.slides[1].subtitle, caption: before.slides[1].caption },
      patch: { subtitle: 'Proposta em estudo: US$ 365/ano no primeiro ano.', bodyAfterImage: '' } });
    expect(result.patches[0].patch).not.toHaveProperty('title');
    expect(result.patches[0].patch).not.toHaveProperty('bgImage');
    expect(options).toEqual(before);
    expect(call).toHaveBeenCalledTimes(1);
    const [prompt, aiOptions] = call.mock.calls[0];
    expect(prompt).not.toContain('secret-unrelated');
    expect(prompt).not.toContain('Abertura que está adequada');
    expect(prompt).not.toContain('blob:foto-original');
    expect(prompt).not.toContain('not-in-prompt');
    expect(prompt).toContain('status":"proposal');
    expect(aiOptions).toMatchObject({ contentMode: 'pitch', json: true, temperature: 0.1 });
    expect(aiOptions.maxTokens).toBeLessThanOrEqual(8192);
  });

  it.each(['render-overlap', 'logo-overlap', 'render-outside', 'evidence-contrast'])('does not ask the language model to fix %s geometry or colors', async (code) => {
    const options = input(); options.issues[0].code = code;
    const call = vi.fn();
    expect(await repairRenderedPresentation(options, call)).toEqual({ status: 'unavailable', patches: [] });
    expect(call).not.toHaveBeenCalled();
  });

  it.each([
    { edits: [{ ...validEdit(), slideIndex: 0 }] },
    { edits: [{ ...validEdit(), slideIndex: '1' }] },
    { edits: [validEdit(), validEdit()] },
    { edits: [{ ...validEdit(), bgImage: 'https://example.com/changed.jpg' }] },
    { edits: [{ ...validEdit(), canvas: { zones: {} } }] },
    { edits: [{ ...validEdit(), reason: '' }] },
    { edits: [{ ...validEdit(), subtitle: ['Texto'] }] },
    { edits: [{ ...validEdit(), title: '' }] },
    { edits: [{ ...validEdit(), caption: 'Apaguei todas as notas anteriores.' }] },
    { edits: [{ ...validEdit(), subtitle: 'Preço realizado: US$ 365/ano no primeiro ano.' }] },
    { edits: [{ ...validEdit(), subtitle: 'Proposta em estudo: US$ 365/mês no primeiro ano.' }] },
    { edits: [{ ...validEdit(), subtitle: 'Proposta em estudo: US$ 366/ano no primeiro ano.' }] },
    { edits: [{ ...validEdit(), caption: 'Nota original que precisa continuar. Nova receita prevista de US$ 9.999.' }] },
    { edits: [validEdit()], layout: 'trocar' },
  ])('rejects invalid or fact-changing repair atomically (%j)', async (response) => {
    const options = input();
    const result = await repairRenderedPresentation(options, vi.fn(async () => response));
    expect(result).toEqual({ status: 'unavailable', patches: [] });
  });

  it('keeps the original draft on network failure or invalid JSON without retry', async () => {
    for (const response of [() => { throw new Error('Network'); }, () => '{ invalid']) {
      const call = vi.fn(response); const options = input(); const before = structuredClone(options.slides);
      expect(await repairRenderedPresentation(options, call)).toEqual({ status: 'unavailable', patches: [] });
      expect(call).toHaveBeenCalledTimes(1); expect(options.slides).toEqual(before);
    }
  });

  it('propagates cancellation before and during the call', async () => {
    const controller = new AbortController(); controller.abort();
    const before = input(); before.aiOptions.signal = controller.signal;
    const call = vi.fn(); await expect(repairRenderedPresentation(before, call)).rejects.toThrow(); expect(call).not.toHaveBeenCalled();
    const mid = new AbortController(); const during = input(); during.aiOptions.signal = mid.signal;
    await expect(repairRenderedPresentation(during, async () => { mid.abort(); return { edits: [validEdit()] }; })).rejects.toThrow();
  });

  it('requires a known planned document and only repairs known issue targets', async () => {
    const call = vi.fn();
    const missing = input(); missing.plan = null;
    expect((await repairRenderedPresentation(missing, call)).status).toBe('unavailable');
    const unknown = input(); unknown.issues[0].slideId = 'missing';
    expect((await repairRenderedPresentation(unknown, call)).status).toBe('unavailable');
    expect(call).not.toHaveBeenCalled();
  });
  it('also respects the actual composition limits instead of reintroducing overflow', async () => {
    const options = input(); options.slides[1].presentationTextLimits = { subtitle: { maxChars: 10 }, body: { maxChars: 0 } };
    expect((await repairRenderedPresentation(options, async () => ({ edits: [validEdit()] }))).status).toBe('unavailable');
  });
});

describe('native evidence repair preserves cells, values and conditions', () => {
  const nativeInput = () => {
    const options = input(); options.slides[1].subtitle = 'Uma oferta em estudo.'; options.slides[1].bodyAfterImage = '';
    options.slides[1].presentationBlocks = [{ type: 'comparison', headers: ['Oferta', 'Condição'], rows: [
      ['Plano inicial com acesso a todo o histórico longitudinal da plataforma', 'Proposta de US$ 365/ano no primeiro ano, para todos os recursos descritos na oferta inicial'],
      ['Teste de biomarcadores com escopo explicitado na contratação individual', 'Preço em estudo e compra opcional'],
    ] }];
    return options;
  };
  const nativeEdit = () => ({ slideIndex: 1, reason: 'Células concisas, condições mantidas.', presentationBlocks: [{ type: 'comparison', headers: ['Oferta', 'Condição'], rows: [
    ['Plano inicial', 'Proposta de US$ 365/ano no primeiro ano'], ['Biomarcadores', 'Preço em estudo · opcional'],
  ] }], caption: 'Nota original que precisa continuar.\n\nO plano dá acesso ao histórico longitudinal. O escopo dos biomarcadores fica explícito na contratação individual.' });

  it('compresses wording semantically without changing native structure', async () => {
    const result = await repairRenderedPresentation(nativeInput(), async () => ({ edits: [nativeEdit()] }));
    expect(result.status).toBe('repaired');
    expect(result.patches[0].patch.presentationBlocks[0].rows).toHaveLength(2);
    expect(result.patches[0].patch.presentationBlocks[0].rows[0][1]).toBe('Proposta de US$ 365/ano no primeiro ano');
  });
  it('rejects lost rows, swapped numeric cells and type changes', async () => {
    const fewer = nativeEdit(); fewer.presentationBlocks[0].rows.pop();
    const swapped = nativeEdit(); [swapped.presentationBlocks[0].rows[0][1], swapped.presentationBlocks[0].rows[1][1]] = [swapped.presentationBlocks[0].rows[1][1], swapped.presentationBlocks[0].rows[0][1]];
    const different = nativeEdit(); different.presentationBlocks = [{ type: 'metrics', items: [{ label: 'Oferta', value: 'US$ 365/ano' }] }];
    for (const edit of [fewer, swapped, different]) expect((await repairRenderedPresentation(nativeInput(), async () => ({ edits: [edit] }))).status).toBe('unavailable');
  });
  it('keeps displayed metric values immutable during a wording repair', async () => {
    const options = nativeInput(); options.slides[1].presentationBlocks = [{ type: 'metrics', items: [{ label: 'Uma base de usuários em planejamento', value: '1.000', detail: 'Projeção para o primeiro período de operação' }] }];
    const changed = { slideIndex: 1, reason: 'Resumir', presentationBlocks: [{ type: 'metrics', items: [{ label: 'Base prevista', value: '1000', detail: 'Projeção' }] }] };
    expect((await repairRenderedPresentation(options, async () => ({ edits: [changed] }))).status).toBe('unavailable');
  });
});
