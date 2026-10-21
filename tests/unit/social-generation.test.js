import { describe, expect, it, vi } from 'vitest';
import { buildGenerationSlideLayoutRules, buildRefineSingleSlideRules, buildGenerationJsonContract } from '../../src/utils/generation-prompts.js';
import { validateCarouselDraft, generateReviewedCarousel } from '../../src/utils/editorial-review.js';
import { recoverSocialTitle, requiresSocialTitles } from '../../src/utils/social-generation.js';
import { cultureAccentRenderablePieces } from '../../src/utils/text-spans.js';

const config = { count: 5, presetId: 'livre', densityId: '1_1', narrativeMode: 'viral' };
const draft = () => ({
  caption: 'A campanha de Halloween da WebExpresso.',
  slides: [
    { title: 'Seu negócio aparece?', subtitle: 'O endereço ajuda a encontrá-lo.', imageQuery: 'night storefront', bodyAfterImage: '' },
    { title: 'Um endereço da sua marca', subtitle: 'O site reúne seus contatos.', imageQuery: 'cafe owner', bodyAfterImage: '' },
    { title: '', subtitle: 'Fora do algoritmo. Um endereço próprio continua acessível pelo link.', imageQuery: 'quiet restaurant', bodyAfterImage: 'O plano está em estudo.' },
    { title: 'Seu título aqui', subtitle: 'Uma *porta de entrada de verdade*. Horários e contatos em um só lugar.', imageQuery: 'workshop desk', bodyAfterImage: 'Visite get_webexpresso.com.' },
    { title: '', subtitle: 'Da descoberta à conversa. O cliente chega com uma pergunta específica.', imageQuery: 'shop at dusk', bodyAfterImage: 'Use o link do seu site.' },
  ],
});
const visible = (text) => cultureAccentRenderablePieces(text).map(piece => piece.v).join('');

describe('Prender atenção: títulos completos e preservação do texto', () => {
  it.each(['1_1', '1_2'])('declara título obrigatório e volume do modo, sem ensaio Cultura, densidade=%s', density => {
    const prompt = buildGenerationSlideLayoutRules('viral', 'livre', density, 5);
    const refine = buildRefineSingleSlideRules('viral', density, { presetId: 'livre', slideIndex: 3, slideCount: 5 });
    expect(prompt).toContain('TODOS os cards');
    expect(prompt).toContain('"title" OBRIGATÓRIO');
    expect(prompt).not.toContain('title" se fizer sentido');
    expect(prompt).not.toContain('prosa de várias frases');
    expect(prompt).toContain('Pode deixar o payoff vazio');
    const expected = density === '1_1' ? ['52–128', '38–92'] : ['38–92', '27–66'];
    for (const band of expected) {
      expect(prompt).toContain(band);
      expect(refine).toContain(band);
    }
  });

  it('recupera cards3–5 movendo a primeira frase, sem perder corpo, imagem ou ressalvas', () => {
    const first = draft();
    const original = structuredClone(first);
    const result = validateCarouselDraft(first, config);
    expect(result.slides.map(slide => slide.title)).toEqual([
      'Seu negócio aparece?', 'Um endereço da sua marca', 'Fora do algoritmo.',
      'Uma *porta de entrada de verdade*.', 'Da descoberta à conversa.',
    ]);
    result.slides.slice(2).forEach((slide, relativeIndex) => {
      const before = first.slides[relativeIndex + 2];
      expect([slide.title, slide.subtitle].filter(Boolean).join(' ')).toBe(before.subtitle);
      expect(slide.bodyAfterImage).toBe(before.bodyAfterImage);
      expect(slide.imageQuery).toBe(before.imageQuery);
    });
    expect(first).toEqual(original);
  });

  it.each([
    ['Uma frase curta\nO desenvolvimento continua.', 'Uma frase curta', 'O desenvolvimento continua.'],
    ['**O cliente chegou.** E o endereço ficou fácil.', '**O cliente chegou.**', 'E o endereço ficou fácil.'],
    ['_Your business is a ghost._ They search. You stay invisible.', '_Your business is a ghost._', 'They search. You stay invisible.'],
    ['O site custa US$ 39.99. O escopo está definido.', 'O site custa US$ 39.99.', 'O escopo está definido.'],
  ])('separa só numa fronteira completa: %s', (subtitle, title, remainder) => {
    expect(recoverSocialTitle({ title: '', subtitle })).toEqual({ title, subtitle: remainder });
  });

  it('não divide um destaque que atravessa a fronteira de duas frases', () => {
    const subtitle = '**Uma ideia. E sua continuação.** O resto do argumento.';
    const result = recoverSocialTitle({ title: '', subtitle });
    expect(result.title).toBe('**Uma ideia. E sua continuação.**');
    expect(result.subtitle).toBe('O resto do argumento.');
    expect([visible(result.title), visible(result.subtitle)].join(' ')).toBe(visible(subtitle));
  });

  it.each([
    ['tendencia_cultura', 'viral'], ['apresentacao', 'viral'], ['livre', 'storytelling'], ['livre', 'none'],
  ])('não reinterpreta títulos vazios de outro contrato: %s/%s', (presetId, narrativeMode) => {
    expect(requiresSocialTitles({ presetId, narrativeMode })).toBe(false);
    const first = draft();
    const result = validateCarouselDraft(first, { ...config, presetId, narrativeMode });
    expect(result.slides[2].title).toBe('');
  });

  it('faz apenas as2chamadas existentes e apresenta à revisão todos os títulos recuperados', async () => {
    const ai = vi.fn().mockResolvedValueOnce(draft()).mockResolvedValueOnce({ edits: [] });
    const result = await generateReviewedCarousel({ prompt: 'Campanha Halloween', config }, ai);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(ai.mock.calls[1][0]).toContain('TODOS os cards exigem title curto');
    expect(result.result.slides.every(slide => slide.title.trim() && slide.title !== 'Seu título aqui')).toBe(true);
  });

  it('usa a revisão existente para um subtítulo longo sem fronteira segura, sem truncar nem chamar outra vez', async () => {
    const first = draft();
    first.slides[2].subtitle = 'Um argumento longo sem pontuação '.repeat(8).trim();
    const originalText = first.slides[2].subtitle;
    const ai = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce({ edits: [{ slideIndex: 2, reason: 'Título ausente', title: 'Um endereço que permanece' }] });
    const output = await generateReviewedCarousel({ prompt: 'brief', config }, ai);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(ai.mock.calls[1][0]).toContain('preencha title nos slideIndex 2');
    expect(output.result.slides[2].title).toBe('Um endereço que permanece');
    expect(output.result.slides[2].subtitle).toBe(originalText);
  });

  it.each([new Error('offline'), { edits: [] }])('não aceita um título vazio caso o único reparo falhe, preservando o rascunho completo', async review => {
    const first = draft();
    first.slides[2].subtitle = 'Um argumento longo sem pontuação '.repeat(8).trim();
    const ai = vi.fn().mockResolvedValueOnce(first);
    if (review instanceof Error) ai.mockRejectedValueOnce(review); else ai.mockResolvedValueOnce(review);
    const error = await generateReviewedCarousel({ prompt: 'brief', config }, ai).catch(value => value);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(error.code).toBe('social_title_missing');
    expect(error.generatedDraft.slides[2].subtitle).toBe(first.slides[2].subtitle);
    expect(error.generatedDraft.slides[2].bodyAfterImage).toBe(first.slides[2].bodyAfterImage);
  });

  it('o contrato de markup corresponde ao suporte real sem remover underscores de URLs', () => {
    const prompt = buildGenerationJsonContract('livre', '1_1', 5);
    expect(prompt).toContain('_underscores_');
    expect(prompt).not.toContain('o card mostraria o símbolo');
    expect(visible('Uma *porta de entrada de verdade* em get_webexpresso.com.')).toBe('Uma porta de entrada de verdade em get_webexpresso.com.');
  });
});
