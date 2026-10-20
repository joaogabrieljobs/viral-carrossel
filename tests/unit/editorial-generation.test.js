import { describe, expect, it, vi } from 'vitest';
import { CONTENT_OBJECTIVES, EDITORIAL_STRUCTURES, buildEditorialStrategyBlock, normalizeInstagramCaption } from '../../src/utils/editorial-strategy.js';
import {
  applyEditorialReview,
  assertPresentationTextLimits,
  auditPresentationTextLimits,
  buildEditorialReviewPrompt,
  buildPresentationLimitsBlock,
  generateReviewedCarousel,
  normalizePresentationTextLimits,
  presentationTextLimitsFromSlides,
  validateCarouselDraft,
} from '../../src/utils/editorial-review.js';
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
  it('preserva fontes e ressalvas em apresentações sem tratá-las como legenda social', () => {
    const presentationConfig = { count: 2, presetId: 'apresentacao', densityId: '1_2' };
    const presentationDraft = {
      slides: [
        { title: 'A decisão', subtitle: 'O contexto', imageQuery: '', bodyAfterImage: '' },
        { title: 'A receita cresceu', subtitle: 'Comparação anual', imageQuery: '', bodyAfterImage: 'Fonte: relatório 2026 · R$ milhões' },
      ],
      caption: 'Resumo executivo',
    };
    const validated = validateCarouselDraft(presentationDraft, presentationConfig);
    expect(validated.slides[1].bodyAfterImage).toContain('Fonte: relatório 2026');
    const reviewPrompt = buildEditorialReviewPrompt('briefing', validated, presentationConfig);
    expect(reviewPrompt).toContain('REVISÃO DE APRESENTAÇÃO');
    expect(reviewPrompt).toContain('subtitle e bodyAfterImage são editáveis');
    expect(reviewPrompt).toContain('Não mencione o arquivo enviado');
    expect(reviewPrompt).not.toContain('CTA coerente com o objetivo');
  });

  it('permite condensar bodyAfterImage em apresentação sem alterar imagem ou demais dados', () => {
    const presentationConfig = {
      count: 2,
      presetId: 'apresentacao',
      densityId: '1_2',
      presentationTextLimits: [
        { title: { maxChars: 30, maxLines: 2 }, subtitle: { maxChars: 30, maxLines: 2 }, bodyAfterImage: { maxChars: 1, maxLines: 1 } },
        { title: { maxChars: 30, maxLines: 2 }, subtitle: { maxChars: 30, maxLines: 2 }, bodyAfterImage: { maxChars: 35, maxLines: 1 } },
      ],
    };
    const presentationDraft = validateCarouselDraft({
      slides: [
        { title: 'A decisão', subtitle: 'O contexto', imageQuery: '', bodyAfterImage: '' },
        { title: 'A receita cresceu', subtitle: 'Comparação anual', imageQuery: 'receita anual', bodyAfterImage: 'Fonte: relatório auditado · R$ milhões', layout: 'evidence' },
      ],
      caption: 'Resumo executivo',
    }, presentationConfig);

    const reviewed = applyEditorialReview(presentationDraft, {
      edits: [{
        slideIndex: 1,
        reason: 'Condensar a identificação da fonte',
        bodyAfterImage: 'Fonte: relatório auditado · R$ mi',
      }],
    }, presentationConfig);

    expect(reviewed.slides[1].bodyAfterImage).toBe('Fonte: relatório auditado · R$ mi');
    expect(reviewed.slides[1].imageQuery).toBe('receita anual');
    expect(reviewed.slides[1].layout).toBe('evidence');
    expect(presentationDraft.slides[1].bodyAfterImage).toBe('Fonte: relatório auditado · R$ milhões');
  });

  it('informa no prompt os limites de cada slide e os três campos editáveis', () => {
    const presentationConfig = {
      count: 2,
      presetId: 'apresentacao',
      presentationTextLimits: [
        { title: { maxChars: 50, maxLines: 2 }, subtitle: { maxChars: 40, maxLines: 1 } },
        { title: { maxChars: 64, maxLines: 2 }, bodyAfterImage: { maxChars: 80, maxLines: 2 } },
      ],
    };
    const prompt = buildEditorialReviewPrompt('briefing', {
      slides: [
        { title: 'Capa', subtitle: 'Promessa', imageQuery: '', bodyAfterImage: '' },
        { title: 'Evidência', subtitle: '', imageQuery: 'gráfico', bodyAfterImage: 'Fonte' },
      ],
      caption: '',
    }, presentationConfig);

    expect(prompt).toContain('Slide 1 (slideIndex 0): title: até 50 caracteres e até 2 linhas; subtitle: até 40 caracteres e até 1 linhas.');
    expect(prompt).toContain('Slide 2 (slideIndex 1): title: até 64 caracteres e até 2 linhas; bodyAfterImage: até 80 caracteres e até 2 linhas.');
    expect(prompt).toContain('title, subtitle ou bodyAfterImage');
    expect(prompt).toContain('validação automática conta apenas quebras de linha explícitas');
    expect(prompt).toContain('Não altere imageQuery');
  });

  it('audita caracteres e quebras explícitas sem estimar quebra visual de CSS', () => {
    const limits = [{
      title: { maxChars: 12, maxLines: 1 },
      subtitle: { maxChars: 100, maxLines: 2 },
      bodyAfterImage: { maxChars: 30, maxLines: 1 },
    }];
    expect(normalizePresentationTextLimits(limits, 1)[0].title).toEqual({ maxChars: 12, maxLines: 1 });

    const violations = auditPresentationTextLimits([{
      title: 'Título longo demais',
      subtitle: 'Uma linha muito comprida que pode quebrar visualmente, mas não contém newline',
      bodyAfterImage: 'Fonte A\nPeríodo B',
    }], limits);

    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'title', rule: 'maxChars', max: 12 }),
      expect.objectContaining({ field: 'bodyAfterImage', rule: 'maxLines', actual: 2, max: 1 }),
    ]));
    expect(violations).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'subtitle', rule: 'maxLines' }),
    ]));
  });

  it('converte limites da composição e permite orientar somente o slide refinado', () => {
    const limits = presentationTextLimitsFromSlides([
      {
        presentationTextLimits: {
          title: { maxChars: 24, maxLines: 2, role: 'display' },
          subtitle: { maxChars: 40, maxLines: 1 },
          body: { maxChars: 70, maxLines: 2 },
        },
      },
      { presentationTextLimits: null },
    ]);

    expect(limits[0]).toMatchObject({
      title: { maxChars: 24, maxLines: 2 },
      subtitle: { maxChars: 40, maxLines: 1 },
      bodyAfterImage: { maxChars: 70, maxLines: 2 },
    });
    expect(limits[1]).toEqual({ title: undefined, subtitle: undefined, bodyAfterImage: undefined });

    const block = buildPresentationLimitsBlock(
      { presentationTextLimits: limits },
      2,
      [0],
    );
    expect(block).toContain('Slide 1 (slideIndex 0)');
    expect(block).toContain('bodyAfterImage: até 70 caracteres e até 2 linhas');
    expect(block).not.toContain('Slide 2');
  });

  it('a revisão corrige um primeiro rascunho de apresentação acima do limite', async () => {
    const presentationConfig = {
      count: 1,
      presetId: 'apresentacao',
      presentationTextLimits: [{
        title: { maxChars: 10, maxLines: 1 },
        subtitle: { maxChars: 30, maxLines: 1 },
        bodyAfterImage: { maxChars: 20, maxLines: 1 },
      }],
    };
    const first = {
      slides: [{ title: 'Capa longa demais', subtitle: 'Promessa', imageQuery: 'cena', bodyAfterImage: '' }],
      caption: 'Resumo',
    };
    const ai = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce({ edits: [{ slideIndex: 0, reason: 'Encurtar a capa', title: 'Cabe aqui' }] });
    const output = await generateReviewedCarousel({ prompt: '', config: presentationConfig }, ai);

    expect(output.reviewStatus).toBe('revised');
    expect(output.result.slides[0].title).toBe('Cabe aqui');
    expect(output.result.slides[0].imageQuery).toBe('cena');
  });

  it('informa os limites exatos já no primeiro rascunho da apresentação', async () => {
    const presentationConfig = {
      count: 1,
      presetId: 'apresentacao',
      presentationTextLimits: [{
        title: { maxChars: 24, maxLines: 2 },
        subtitle: { maxChars: 48, maxLines: 2 },
      }],
    };
    const ai = vi.fn()
      .mockResolvedValueOnce({
        slides: [{ title: 'Cabe aqui', subtitle: 'Promessa clara', imageQuery: 'cena', bodyAfterImage: '' }],
        caption: 'Resumo',
      })
      .mockResolvedValueOnce({ edits: [] });

    await generateReviewedCarousel({ prompt: 'Briefing do deck', config: presentationConfig }, ai);

    expect(ai.mock.calls[0][0]).toContain('Briefing do deck');
    expect(ai.mock.calls[0][0]).toContain('LIMITES EDITORIAIS OBRIGATÓRIOS POR SLIDE');
    expect(ai.mock.calls[0][0]).toContain('title: até 24 caracteres e até 2 linhas');
    expect(ai.mock.calls[0][0]).toContain('subtitle: até 48 caracteres e até 2 linhas');
  });

  it('encurta o rascunho quando a revisão também passa do limite', async () => {
    const presentationConfig = {
      count: 1,
      presetId: 'apresentacao',
      presentationTextLimits: [{
        title: { maxChars: 10, maxLines: 1 },
        subtitle: { maxChars: 30, maxLines: 1 },
        bodyAfterImage: { maxChars: 20, maxLines: 1 },
      }],
    };
    const first = {
      slides: [{ title: 'Capa longa demais', subtitle: 'Promessa', imageQuery: 'cena', bodyAfterImage: '' }],
      caption: 'Resumo',
    };
    expect(() => applyEditorialReview(first, {
      edits: [{ slideIndex: 0, reason: 'Tentativa insuficiente', title: 'Ainda muito longo' }],
    }, presentationConfig)).toThrow('limite editorial');

    const ai = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce({ edits: [{ slideIndex: 0, reason: 'Tentativa insuficiente', title: 'Ainda muito longo' }] });
    const output = await generateReviewedCarousel({ prompt: '', config: presentationConfig }, ai);
    expect(output.reviewStatus).toBe('fitted');
    expect(output.result.slides[0].title.length).toBeLessThanOrEqual(10);
    expect(output.result.slides[0].title).not.toBe('Capa longa demais');
    expect(() => assertPresentationTextLimits(
      output.result.slides,
      presentationConfig.presentationTextLimits,
    )).not.toThrow();
  });

  it('encurta o rascunho também quando o serviço de revisão fica indisponível', async () => {
    const presentationConfig = {
      count: 1,
      presetId: 'apresentacao',
      presentationTextLimits: [{ title: { maxChars: 8, maxLines: 1 } }],
    };
    const ai = vi.fn()
      .mockResolvedValueOnce({
        slides: [{ title: 'Título que não cabe', subtitle: 'Promessa', imageQuery: '', bodyAfterImage: '' }],
        caption: '',
      })
      .mockRejectedValueOnce(new Error('offline'));

    const output = await generateReviewedCarousel({ prompt: '', config: presentationConfig }, ai);
    expect(output.reviewStatus).toBe('fitted');
    expect(output.result.slides[0].title.length).toBeLessThanOrEqual(8);
    expect(ai).toHaveBeenCalledTimes(2);
  });

  it('mantém fallback de apresentação quando o rascunho original cabe', async () => {
    const presentationConfig = {
      count: 1,
      presetId: 'apresentacao',
      presentationTextLimits: [{ title: { maxChars: 10, maxLines: 1 } }],
    };
    const first = {
      slides: [{ title: 'Cabe aqui', subtitle: 'Promessa', imageQuery: 'cena', bodyAfterImage: '' }],
      caption: 'Resumo',
    };
    const ai = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce({ edits: [{ slideIndex: 0, reason: 'Piorou', title: 'Agora ficou longo demais' }] });
    const output = await generateReviewedCarousel({ prompt: '', config: presentationConfig }, ai);

    expect(output.reviewStatus).toBe('unavailable');
    expect(output.result.slides[0].title).toBe('Cabe aqui');
    expect(() => assertPresentationTextLimits(
      output.result.slides,
      presentationConfig.presentationTextLimits,
    )).not.toThrow();
  });
});
