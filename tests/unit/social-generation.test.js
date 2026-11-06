import { describe, expect, it, vi } from 'vitest';
import { buildGenerationSlideLayoutRules, buildRefineSingleSlideRules, buildGenerationJsonContract } from '../../src/utils/generation-prompts.js';
import { validateCarouselDraft, generateReviewedCarousel, generationMaxTokens, editorialReviewMaxTokens, socialIssuesMessage } from '../../src/utils/editorial-review.js';
import { auditRepeatedSocialPhrases, recoverSocialTitle, recoverSocialTitleAtClause, requiresSocialTitles } from '../../src/utils/social-generation.js';
import { compatibleReasoningPayload } from '../../src/utils/ai-client.js';
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
    ['tendencia_cultura', 'viral'], ['livre', 'storytelling'], ['livre', 'none'],
  ])('exige e recupera título em todo modo social: %s/%s', (presetId, narrativeMode) => {
    expect(requiresSocialTitles({ presetId, narrativeMode })).toBe(true);
    const first = draft();
    const result = validateCarouselDraft(first, { ...config, presetId, narrativeMode });
    expect(result.slides[2].title).toBe('Fora do algoritmo.');
  });

  it('mantém apresentação fora do contrato de títulos sociais', () => {
    expect(requiresSocialTitles({ presetId: 'apresentacao', narrativeMode: 'viral' })).toBe(false);
  });

  it('identifica número e expressão repetidos entre cards sem contar repetição interna', () => {
    const slides = [
      { title: 'A história começou', subtitle: '22 anos de prática construíram confiança.' },
      { title: 'O problema antigo', subtitle: 'Botões em outro idioma afastavam clientes.' },
      { title: 'O diagnóstico', subtitle: 'Mesmo com 22 anos de prática, o site confundia.' },
      { title: 'A reconstrução', subtitle: 'Corrigimos os botões em outro idioma antes do lançamento.' },
    ];
    expect(auditRepeatedSocialPhrases(slides, config)).toEqual(expect.arrayContaining([
      expect.objectContaining({ phrase: '22 anos de pratica', slideIndexes: [0, 2] }),
      expect.objectContaining({ phrase: 'botoes em outro idioma', slideIndexes: [1, 3] }),
    ]));
  });

  it('faz apenas as2chamadas existentes e apresenta à revisão todos os títulos recuperados', async () => {
    const ai = vi.fn().mockResolvedValueOnce(draft()).mockResolvedValueOnce({ edits: [] });
    const result = await generateReviewedCarousel({ prompt: 'Campanha Halloween', config }, ai);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(ai.mock.calls[1][0]).toContain('TODOS os cards, em qualquer modo narrativo, exigem title curto');
    expect(result.result.slides.every(slide => slide.title.trim() && slide.title !== 'Seu título aqui')).toBe(true);
  });

  it('usa a revisão existente para um subtítulo longo sem fronteira segura, sem truncar nem chamar outra vez', async () => {
    const first = draft();
    first.slides[2].subtitle = 'Um argumento longo sem pontuação '.repeat(8).trim();
    const originalText = first.slides[2].subtitle;
    const ai = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce({ edits: [{ slideIndex: 2, reason: 'Título ausente e apoio longo', title: 'Um endereço que permanece', subtitle: 'Um argumento direto que cabe em até três linhas.' }] });
    const output = await generateReviewedCarousel({ prompt: 'brief', config }, ai);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(ai.mock.calls[1][0]).toContain('preencha title nos slideIndex 2');
    expect(output.result.slides[2].title).toBe('Um endereço que permanece');
    expect(output.result.slides[2].subtitle).not.toBe(originalText);
    expect(output.result.slides[2].subtitle.length).toBeLessThanOrEqual(160);
  });

  it('Seguir meu pedido entrega 5 cards com título e apoio de no máximo 3 linhas', async () => {
    const first = draft();
    first.slides = first.slides.map((slide, index) => ({
      ...slide,
      title: '',
      subtitle: `Card ${index + 1}. ${'Explicação extensa sem criar promessa nova. '.repeat(5)}`,
    }));
    const edits = first.slides.map((_, slideIndex) => ({
      slideIndex,
      reason: 'Separar título e condensar o apoio',
      title: `Título específico ${slideIndex + 1}`,
      subtitle: `Apoio direto ${slideIndex + 1}.\nUma segunda linha útil.\nFecho curto.`,
    }));
    const ai = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce({ edits });
    const output = await generateReviewedCarousel({
      prompt: 'Brief sem modo narrativo imposto',
      config: { ...config, narrativeMode: 'none' },
    }, ai);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(output.result.slides).toHaveLength(5);
    output.result.slides.forEach(slide => {
      expect(slide.title.trim()).toBeTruthy();
      expect(slide.subtitle.length).toBeLessThanOrEqual(160);
      expect(slide.subtitle.split('\n')).toHaveLength(3);
    });
  });

  it.each([new Error('offline'), { edits: [] }])('abre o rascunho completo com aviso quando o único reparo falha, sem título inventado', async review => {
    const first = draft();
    first.slides[2].subtitle = 'Um argumento longo sem pontuação '.repeat(8).trim();
    const ai = vi.fn().mockResolvedValueOnce(first);
    if (review instanceof Error) ai.mockRejectedValueOnce(review); else ai.mockResolvedValueOnce(review);
    const output = await generateReviewedCarousel({ prompt: 'brief', config }, ai);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(output.reviewStatus).toBe('needs_attention');
    expect(output.socialIssues.missingTitles).toEqual([2]);
    expect(output.result.slides).toHaveLength(5);
    expect(output.result.slides[2].title).toBe('');
    expect(output.result.slides[2].subtitle).toBe(first.slides[2].subtitle);
    expect(output.result.slides[2].bodyAfterImage).toBe(first.slides[2].bodyAfterImage);
    expect(socialIssuesMessage(output.socialIssues)).toContain('card 3');
  });

  it('carrossel de 7 cards: revisão truncada não descarta o rascunho pago e completa títulos pela oração existente', async () => {
    const seven = { ...config, count: 7 };
    const first = draft();
    first.slides = [...first.slides, ...draft().slides.slice(0, 2)];
    first.slides[5] = { ...first.slides[5], title: '', subtitle: 'Quando o cliente procura no Google, o site responde com horário, endereço e contato em um só lugar sem depender de algoritmo nenhum para aparecer' };
    first.slides[6] = { ...first.slides[6], subtitle: 'Long support '.repeat(16).trim() };
    const truncated = Object.assign(new Error('A resposta da IA ficou incompleta.'), { code: 'ai_output_truncated' });
    const ai = vi.fn().mockResolvedValueOnce(first).mockRejectedValueOnce(truncated);
    const output = await generateReviewedCarousel({ prompt: 'brief', config: seven, aiOptions: { maxTokens: generationMaxTokens(7) } }, ai);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(ai.mock.calls[1][1]).toMatchObject({ maxTokens: editorialReviewMaxTokens(7), reasoning: false, json: true });
    expect(output.reviewStatus).toBe('needs_attention');
    expect(output.reviewError).toBe('ai_output_truncated');
    expect(output.result.slides).toHaveLength(7);
    expect(output.result.slides[5].title).toBe('Quando o cliente procura no Google');
    expect(`${output.result.slides[5].title}, ${output.result.slides[5].subtitle}`).toBe(first.slides[5].subtitle);
    expect(output.socialIssues).toMatchObject({
      missingTitles: [],
      longSupport: [6],
      repeatedPhrases: [expect.objectContaining({ phrase: 'um endereco da sua marca', slideIndexes: [1, 6] })],
    });
    expect(output.result.slides[6].subtitle).toBe(first.slides[6].subtitle);
  });

  it('revisão que deixa um apoio longo abre o texto revisado com aviso, em vez de lançar erro', async () => {
    const first = draft();
    first.slides[1].subtitle = 'Apoio longo '.repeat(20).trim();
    const ai = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce({ edits: [{ slideIndex: 0, reason: 'Capa', title: 'Seu negócio aparece no mapa?' }] });
    const output = await generateReviewedCarousel({ prompt: 'brief', config }, ai);
    expect(output.reviewStatus).toBe('needs_attention');
    expect(output.result.slides[0].title).toBe('Seu negócio aparece no mapa?');
    expect(output.socialIssues.longSupport).toEqual([1]);
    expect(socialIssuesMessage(output.socialIssues)).toBe('Texto gerado e preservado. Revise o apoio do card 2 antes de publicar.');
  });

  it('mantém o bloqueio de promessa comercial sem apoio mesmo quando a revisão falha', async () => {
    const first = draft();
    first.slides[1].subtitle = 'Resultado garantido para sua loja.';
    const ai = vi.fn().mockResolvedValueOnce(first).mockRejectedValueOnce(new Error('offline'));
    const error = await generateReviewedCarousel({ prompt: 'brief', config: { ...config, commercialClaimSource: 'Site para restaurantes.' } }, ai).catch(value => value);
    expect(error.code).toBe('unsupported_commercial_claim');
    expect(error.generatedDraft.slides[1].subtitle).toBe(first.slides[1].subtitle);
  });

  it('move a primeira oração para o título só quando não há frase completa, sem perder palavras', () => {
    expect(recoverSocialTitleAtClause({ title: '', subtitle: 'Sem site próprio, o cliente some no feed e ninguém encontra o horário certo da sua loja nem o telefone para pedir um orçamento rápido' }))
      .toEqual({ title: 'Sem site próprio', subtitle: 'o cliente some no feed e ninguém encontra o horário certo da sua loja nem o telefone para pedir um orçamento rápido' });
    expect(recoverSocialTitleAtClause({ title: '', subtitle: 'Frase completa. Resto.' })).toEqual({ title: 'Frase completa.', subtitle: 'Resto.' });
    const noBoundary = { title: '', subtitle: 'palavras '.repeat(30).trim() };
    expect(recoverSocialTitleAtClause(noBoundary)).toBe(noBoundary);
  });

  it('dimensiona o orçamento do rascunho e da revisão pelo número de cards, no teto da plataforma', () => {
    expect(generationMaxTokens(7)).toBeGreaterThan(3072 + 7 * 512);
    expect(generationMaxTokens(7)).toBeLessThanOrEqual(8192);
    expect(generationMaxTokens(24)).toBe(8192);
    expect(generationMaxTokens(8, { presentation: true })).toBe(3072 + 8 * 512);
    expect(editorialReviewMaxTokens(3)).toBeLessThan(editorialReviewMaxTokens(7));
    expect(editorialReviewMaxTokens(7)).toBe(8192);
  });

  it('desliga o raciocínio só na Z.ai e só quando pedido', () => {
    expect(compatibleReasoningPayload('zai', false)).toEqual({ thinking: { type: 'disabled' } });
    expect(compatibleReasoningPayload('zai', undefined)).toEqual({});
    expect(compatibleReasoningPayload('kimi', false)).toEqual({});
  });

  it('o contrato de markup corresponde ao suporte real sem remover underscores de URLs', () => {
    const prompt = buildGenerationJsonContract('livre', '1_1', 5);
    expect(prompt).toContain('_underscores_');
    expect(prompt).not.toContain('o card mostraria o símbolo');
    expect(visible('Uma *porta de entrada de verdade* em get_webexpresso.com.')).toBe('Uma porta de entrada de verdade em get_webexpresso.com.');
  });
});
