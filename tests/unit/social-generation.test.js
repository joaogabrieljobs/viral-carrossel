import { describe, expect, it, vi } from 'vitest';
import { buildGenerationSlideLayoutRules, buildRefineSingleSlideRules, buildGenerationJsonContract } from '../../src/utils/generation-prompts.js';
import { validateCarouselDraft, generateReviewedCarousel } from '../../src/utils/editorial-review.js';
import { auditSocialTextDensity, longSocialSupportIndexes, recoverSocialTitle, recoverSocialTitleForEditing, requiresSocialTitles } from '../../src/utils/social-generation.js';
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
    const expected = density === '1_1' ? ['até 160 caracteres', 'juntos: até 300 caracteres'] : ['até 140 caracteres', 'até 100 caracteres', 'juntos: até 220 caracteres'];
    for (const ceiling of expected) {
      expect(prompt).toContain(ceiling);
      expect(refine).toContain(ceiling);
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

  it.each([new Error('offline'), { edits: [] }])('abre o rascunho completo para edição caso a revisão de título falhe', async review => {
    const first = draft();
    first.slides[2].subtitle = 'Um argumento longo sem pontuação '.repeat(8).trim();
    const ai = vi.fn().mockResolvedValueOnce(first);
    if (review instanceof Error) ai.mockRejectedValueOnce(review); else ai.mockResolvedValueOnce(review);
    const onDraft = vi.fn();
    const output = await generateReviewedCarousel({ prompt: 'brief', config, onDraft }, ai);
    expect(ai).toHaveBeenCalledTimes(review instanceof Error ? 2 : 3);
    expect(onDraft).toHaveBeenCalledWith(expect.objectContaining({ slides:expect.any(Array) }), { phase:'reviewing' });
    expect(output.reviewStatus).toBe('needs_attention');
    expect(output.result.slides).toHaveLength(5);
    expect(output.result.slides[2].title).toBeTruthy();
    expect(output.issues).toContainEqual({ slideIndex:2, code:'social_title_recovered' });
    expect(output.violations).toContainEqual(expect.objectContaining({ kind:'density', slideIndex:2 }));
    expect(`${output.result.slides[2].title} ${output.result.slides[2].subtitle}`.trim()).toBe(first.slides[2].subtitle);
    expect(output.result.slides[2].bodyAfterImage).toBe(first.slides[2].bodyAfterImage);
  });

  it('recupera título sem pontuação por fronteira de palavra sem perder texto', () => {
    const slide = { title:'', subtitle:'Uma explicação extensa sem pontuação que ainda precisa permanecer inteira para edição' };
    const recovered = recoverSocialTitleForEditing(slide);
    expect(recovered.title).toBeTruthy();
    expect(`${recovered.title} ${recovered.subtitle}`.trim()).toBe(slide.subtitle);
  });

  it('preserva o rascunho com promessa sem apoio como revisão pendente explícita', async () => {
    const first = draft();
    first.slides[2] = { ...first.slides[2], title:'', subtitle:`Grátis para sempre. ${'Texto longo sem pontuação '.repeat(8)}` };
    const ai = vi.fn().mockResolvedValueOnce(first).mockRejectedValueOnce(new Error('offline'));
    const output = await generateReviewedCarousel({
      prompt:'brief',
      config:{ ...config, commercialClaimSource:'Brief sem preço ou gratuidade.' },
    }, ai);
    expect(output.reviewStatus).toBe('needs_attention');
    expect(output.violations).toContainEqual(expect.objectContaining({ kind:'factual', category:'preço', slideIndex:2 }));
    expect(output.result.slides).toHaveLength(5);
  });

  it('o contrato de markup corresponde ao suporte real sem remover underscores de URLs', () => {
    const prompt = buildGenerationJsonContract('livre', '1_1', 5);
    expect(prompt).toContain('_underscores_');
    expect(prompt).not.toContain('o card mostraria o símbolo');
    expect(visible('Uma *porta de entrada de verdade* em get_webexpresso.com.')).toBe('Uma porta de entrada de verdade em get_webexpresso.com.');
  });
});

describe('densidade considera o card inteiro, sem cortar conteúdo', () => {
  const balanced = { presetId: 'livre', densityId: '1_2' };

  it.each(['none', 'editorial', 'how_to', 'storytelling', 'viral', 'pain', 'deep', 'jornalistico', 'sensacionalista'])('barra o corpo longo que escapava em %s', narrativeMode => {
    const slides = [{ title: 'O telefone antigo', subtitle: 'Um contato desatualizado dificulta a conversa.', bodyAfterImage: 'Confira o número e revise as informações antes de publicar. '.repeat(5) }];
    const before = structuredClone(slides);
    const violations = auditSocialTextDensity(slides, { ...balanced, narrativeMode });
    expect(violations.map(item => item.field)).toEqual(['bodyAfterImage', 'support']);
    expect(longSocialSupportIndexes(slides, { ...balanced, narrativeMode })).toEqual([0]);
    expect(slides).toEqual(before);
  });

  it('rejeita dois blocos individualmente válidos cuja soma excede o orçamento', () => {
    const violations = auditSocialTextDensity([{ title: 'Uma só ideia', subtitle: 'a'.repeat(130), bodyAfterImage: 'b'.repeat(95) }], balanced);
    expect(violations).toEqual([{ slideIndex: 0, field: 'support', chars: 226, maxChars: 220 }]);
  });

  it('mede texto visível, permite corpo vazio e preserva uma ressalva completa', () => {
    const slides = [{ title: '**O próximo passo**', subtitle: 'Solicite uma análise do site. Os resultados dependem do diagnóstico.', bodyAfterImage: '' }];
    expect(auditSocialTextDensity(slides, balanced)).toEqual([]);
    expect(slides[0].subtitle).toContain('dependem do diagnóstico');
    expect(auditSocialTextDensity([{ title: '_Curto_', subtitle: `**${'a'.repeat(140)}**`, bodyAfterImage: '' }], balanced)).toEqual([]);
  });

  it('detecta texto escondido em título, quebras demais e densidade Essencial', () => {
    expect(auditSocialTextDensity([{ title: 'Uma frase longa '.repeat(8), subtitle: 'a\nb\nc\nd' }], balanced).map(item => item.field)).toEqual(['title', 'subtitle']);
    expect(auditSocialTextDensity([{ title: 'Uma só ideia', subtitle: 'a'.repeat(71) }], { ...balanced, densityId: '1_5' }).map(item => item.field)).toEqual(['subtitle']);
  });

  it('não aplica o limite social a apresentações', () => {
    expect(auditSocialTextDensity([{ title: 'a'.repeat(100), bodyAfterImage: 'b'.repeat(500) }], { presetId: 'apresentacao', densityId: '1_2' })).toEqual([]);
  });
});
