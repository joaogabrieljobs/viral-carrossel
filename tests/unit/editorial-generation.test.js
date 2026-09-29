import { describe, expect, it, vi } from 'vitest';
import { CONTENT_OBJECTIVES, EDITORIAL_STRUCTURES, buildEditorialStrategyBlock, normalizeInstagramCaption } from '../../src/utils/editorial-strategy.js';
import { applyEditorialReview, generateReviewedCarousel, validateCarouselDraft } from '../../src/utils/editorial-review.js';
import { buildCaptionVoiceRules } from '../../src/utils/generation-prompts.js';
import { ensureDocShape } from '../../src/utils/doc-schema.js';

const config = { count: 3, presetId: 'tendencia_cultura', densityId: '1_1' };
const draft = () => ({
  slides: [
    { title: 'Uma pergunta específica', subtitle: 'Uma promessa', imageQuery: 'one', bodyAfterImage: '', cultureTone: 'dark' },
    { title: '', subtitle: 'Um argumento', imageQuery: 'two', bodyAfterImage: 'Uma consequência' },
    { title: 'Conclusão', subtitle: 'Uma pergunta', imageQuery: 'three', bodyAfterImage: '' },
  ], caption: 'Uma legenda #um #dois #três #quatro #cinco #seis',
});

describe('objetivos e biblioteca editorial', () => {
  it('cada objetivo explícito tem estrutura com critérios e origem editorial', () => {
    expect(EDITORIAL_STRUCTURES).toHaveLength(6);
    for (const o of CONTENT_OBJECTIVES.filter(o => o.id !== 'auto')) {
      const s = EDITORIAL_STRUCTURES.find(s => s.objective === o.id);
      expect(s).toMatchObject({ evidence: 'editorial_hypothesis', reviewedAt: '2026-09-22' });
      expect(s.useWhen).toBeTruthy();
      expect(s.avoidWhen).toBeTruthy();
      expect(buildEditorialStrategyBlock(o.id)).toContain(s.arc);
    }
  });
  it('objetivo não substitui o modo ou arco de pacote', () => {
    expect(buildEditorialStrategyBlock('saves', 'tendencia_cultura')).toContain('não sobreponha um segundo arco');
    expect(buildEditorialStrategyBlock('auto')).toContain('compare três abordagens');
    expect(buildEditorialStrategyBlock('auto')).toContain('capa e segundo slide juntos');
  });
  it('projetos antigos e valores desconhecidos ganham auto sem perder texto', () => {
    expect(ensureDocShape({ contentObjective: 'saves' }).contentObjective).toBe('saves');
    const old = ensureDocShape({ contentObjective: 'unknown', caption: 'Preservada' });
    expect(old.contentObjective).toBe('auto');
    expect(old.caption).toBe('Preservada');
    expect(ensureDocShape({}).contentObjective).toBe('auto');
  });
  it('limite de hashtags vale para prompt e saída, incluindo acentos', () => {
    for (const preset of ['livre', 'tendencia_cultura']) {
      const prompt = buildCaptionVoiceRules(preset);
      expect(prompt).toContain('até 5');
      expect(prompt).not.toMatch(/5-8|8-12/);
    }
    const caption = normalizeInstagramCaption(draft().caption);
    expect(caption).toContain('#três');
    expect(caption).not.toContain('#seis');
    expect(caption.match(/#/g)).toHaveLength(5);
    expect(normalizeInstagramCaption('a'.repeat(2300))).toHaveLength(2200);
  });
});

describe('geração com uma revisão editorial', () => {
  it('faz exatamente duas chamadas e aplica somente os campos de texto reprovados', async () => {
    const first = draft();
    const original = structuredClone(first);
    const ai = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce({ edits: [
      { slideIndex: 1, reason: 'Abstração', subtitle: 'Um exemplo concreto' },
    ] });
    const onReview = vi.fn();
    const output = await generateReviewedCarousel({ prompt: 'briefing', config, aiOptions: { maxTokens: 4608 }, onReview }, ai);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(ai.mock.calls[1][0]).toContain('Uma consequência');
    expect(ai.mock.calls[1][0]).toContain('promessa da capa');
    expect(ai.mock.calls[1][1]).toEqual({ maxTokens: 4608, json: true });
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(output.reviewStatus).toBe('revised');
    expect(output.result.slides[1].subtitle).toBe('Um exemplo concreto');
    expect(output.result.slides[1].imageQuery).toBe('two');
    expect(output.result.slides[0]).toEqual(original.slides[0]);
    expect(first).toEqual(original);
  });
  it('uma revisão sem problemas mantém o rascunho', async () => {
    const ai = vi.fn().mockResolvedValueOnce(draft()).mockResolvedValueOnce({ edits: [] });
    expect((await generateReviewedCarousel({ prompt: '', config }, ai)).reviewStatus).toBe('unchanged');
  });
  it.each([
    ['falha de rede', new Error('offline')],
    ['índice fora do arco', { edits: [{ slideIndex: 9, reason: 'x', title: 'Outro' }] }],
    ['mudança de imagem', { edits: [{ slideIndex: 1, reason: 'x', imageQuery: 'new image' }] }],
    ['corpo na capa', { edits: [{ slideIndex: 0, reason: 'x', bodyAfterImage: 'Não cabe' }] }],
    ['campo não textual', { edits: [{ slideIndex: 1, reason: 'x', subtitle: null }] }],
    ['índices duplicados', { edits: [{ slideIndex: 1, reason: 'x', subtitle: 'A' }, { slideIndex: 1, reason: 'x', subtitle: 'B' }] }],
    ['legenda inválida', { edits: [], caption: [] }],
  ])('mantém a primeira versão quando houver %s, sem tentar novamente', async (_, review) => {
    const ai = vi.fn().mockResolvedValueOnce(draft());
    if (review instanceof Error) ai.mockRejectedValueOnce(review); else ai.mockResolvedValueOnce(review);
    const output = await generateReviewedCarousel({ prompt: '', config }, ai);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(output.reviewStatus).toBe('unavailable');
    expect(output.result).toEqual(validateCarouselDraft(draft(), config));
  });
  it('não revisa nem publica geração com quantidade errada', async () => {
    const ai = vi.fn().mockResolvedValue({ slides: [], caption: '' });
    await expect(generateReviewedCarousel({ prompt: '', config }, ai)).rejects.toThrow('quantidade');
    expect(ai).toHaveBeenCalledTimes(1);
  });
  it('respeita as diferentes posições de bodyAfterImage no híbrido', () => {
    const hybrid = { ...config, presetId: 'livre' };
    const first = validateCarouselDraft(draft(), hybrid);
    expect(first.slides[1].bodyAfterImage).toBe('');
    const reviewed = applyEditorialReview(first, { edits: [{ slideIndex: 2, reason: 'Conclusão', bodyAfterImage: 'Payoff final' }] }, hybrid);
    expect(reviewed.slides[2].bodyAfterImage).toBe('Payoff final');
    expect(() => applyEditorialReview(first, { edits: [{ slideIndex: 1, reason: 'x', bodyAfterImage: 'Inválido' }] }, hybrid)).toThrow();
  });
});
