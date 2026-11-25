import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as review from '../../src/utils/editorial-review.js';

// Spec 1.1, entrega 3 (QA Ingrid, 24/11): na Apoteose real (10 slides,
// Cinemático) a mesma frase aparecia em dois slides e a revisão não pegou.
// - slides 3 e 4: "O Carnaval aparece como estado de espírito, não como
//   representação literal";
// - slides 3 e 10: "entre a promessa de se comportar e a absoluta falta de
//   intenção de cumpri-la";
// - slide 10: a última linha do apoio repete o próprio título.
// Causa: a trinca de palavras só conta a partir de 3 slides, a comparação de
// corpo divide pelo slide inteiro e o eco de título olhava só o apoio inteiro.
const apoteose = JSON.parse(readFileSync(new URL('../fixtures/apoteose.json', import.meta.url), 'utf8'));
const slides = apoteose.slides;

describe('Spec 1.1 entrega 3: as regras de antes não pegam a Apoteose', () => {
  it('nenhuma regra antiga marca os slides 3 e 4 nem 3 e 10', () => {
    expect(review.repeatedPhraseSlides(slides)).toEqual([]);
    expect(review.repeatedFactSlides(slides)).toEqual([]);
    expect(review.repeatedContentSlides(slides)).toEqual([]);
    expect(review.bodySimilarity(slides[2], slides[3])).toBeLessThan(review.REPEATED_BODY_THRESHOLD);
    expect(review.bodySimilarity(slides[2], slides[9])).toBeLessThan(review.REPEATED_BODY_THRESHOLD);
    // O apoio inteiro do slide 10 é longo: a regra antiga não o vê.
    expect(review.supportEchoesTitleIndexes(slides)).toEqual([]);
  });
});

describe('Spec 1.1 entrega 3: frase inteira repetida em dois slides', () => {
  it('Apoteose real: marca 3 e 4 e 3 e 10, com a frase como está no slide', () => {
    expect(review.REPEATED_SENTENCE_WORDS).toBe(6);
    expect(review.repeatedSentenceSlides(slides)).toEqual([
      { phrase: 'A festa existe nesse intervalo entre a promessa de se comportar e a absoluta falta de intenção de cumpri-la', slideIndexes: [2, 9] },
      { phrase: 'O Carnaval aparece como estado de espírito, não como representação literal', slideIndexes: [2, 3] },
    ]);
  });

  it('frase curta de ligação igual em dois slides não conta', () => {
    const deck = [
      { title: 'Abertura', subtitle: 'Veja como funciona na prática. A padaria abre às sete.' },
      { title: 'Pedido', subtitle: 'Veja como funciona na prática. O pedido chega pelo WhatsApp.' },
      { title: 'Fecho', subtitle: 'Mas há um detalhe importante. A retirada é na padaria.', bodyAfterImage: 'Mas há um detalhe importante.' },
    ];
    expect(review.repeatedSentenceSlides(deck)).toEqual([]);
  });

  it('bloco repetido tem regra própria e não entra na frase', () => {
    const block = [{ type: 'metrics', items: [{ label: 'Preço do site', value: 'US$ 797', detail: 'Pago só depois de aprovar o site pronto e publicado' }, { label: 'Logo', value: 'Incluso', detail: 'Logo nova ou revisão da atual sem custo extra nesta semana' }] }];
    expect(review.repeatedSentenceSlides([{ title: 'Oferta', presentationBlocks: block }, { title: 'Resumo', presentationBlocks: block }])).toEqual([]);
  });
});

describe('Spec 1.1 entrega 3: última linha do apoio igual ao título', () => {
  it('Apoteose real: slide 10 marcado só quando a última linha conta', () => {
    expect(slides[9].title).toBe('Apoteose, o esquenta de Carnaval de São Paulo');
    expect(slides[9].bodyAfterImage).toBe('Apoteose, o esquenta de Carnaval de São Paulo.');
    expect(review.supportEchoesTitleIndexes(slides, { lastLine: true })).toEqual([9]);
  });

  it('última linha que só retoma uma palavra do título não conta', () => {
    const deck = [{ title: 'US$ 399 e 10 vagas até 30 de novembro', subtitle: 'A oferta pode ser paga à vista. A reserva está disponível até 30 de novembro, dentro do limite de vagas.' }];
    expect(review.supportEchoesTitleIndexes(deck, { lastLine: true })).toEqual([]);
  });

  it('o carrossel continua com a regra antiga na revisão', () => {
    const deck = [{ title: 'Apoteose, o esquenta de Carnaval de São Paulo', subtitle: 'Um texto longo de apoio que explica a festa com calma e detalhe. Apoteose, o esquenta de Carnaval de São Paulo.' }];
    expect(review.supportEchoesTitleIndexes(deck)).toEqual([]);
    expect(review.buildEditorialReviewPrompt('', { slides: deck }, { presetId: 'livre', densityId: '1_1', count: 1 })).not.toContain('APOIO QUE REPETE O TÍTULO');
  });
});

describe('Spec 1.1 entrega 3: a Apoteose vai ao reparo de repetição que já existe', () => {
  // O roteiro real da Apoteose é v1 (imageBrief); o formato antigo continua aceito.
  const plan = () => structuredClone(apoteose.presentationPlan);
  const sources = [{ id: 'source-base', text: apoteose.presentationPlan.evidence.map(item => item.quote).join('\n') }];
  const config = () => ({
    count: 10, presetId: 'apresentacao', presentationPath: 'pitch', presentationPlanning: true,
    planningContext: { brief: 'Apresentar a Apoteose.', sources },
  });
  const deck = () => slides.map(({ presentationComposition, ...slide }) => ({ ...slide, speakerNotes: '' }));
  // Roteiro, quatro lotes de redação (3+3+3+1) e a revisão sem edições.
  const written = ai => ai.mockResolvedValueOnce(plan())
    .mockResolvedValueOnce({ caption: '', slides: deck().slice(0, 3) })
    .mockResolvedValueOnce({ caption: '', slides: deck().slice(3, 6) })
    .mockResolvedValueOnce({ caption: '', slides: deck().slice(6, 9) })
    .mockResolvedValueOnce({ caption: '', slides: deck().slice(9) })
    .mockResolvedValueOnce({ edits: [] });
  const repairPrompt = ai => ai.mock.calls.map(call => call[0]).find(prompt => prompt.includes('REPARO DE REPETIÇÃO')) || '';

  it('o reparo recebe as duas frases e o eco, e edita só esses slides', async () => {
    const ai = written(vi.fn()).mockResolvedValue({ edits: [] });
    await review.generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    const prompt = repairPrompt(ai);
    expect(prompt).toContain('Frase repetida em dois slides');
    expect(prompt).toContain('"O Carnaval aparece como estado de espírito, não como representação literal" nos slideIndex 2 e 3');
    expect(prompt).toContain('cumpri-la" nos slideIndex 2 e 9');
    expect(prompt).toContain('Apoio que termina repetindo o título do próprio slide: slideIndex 9');
    expect(prompt).toMatch(/edite somente os slides com slideIndex 2, 3, 9\./);
  });

  it('o reparo que tira as repetições é aceito', async () => {
    const fix = { edits: [
      { slideIndex: 3, reason: 'Frase igual ao slide 3', subtitle: 'A Apoteose propõe uma interpretação contemporânea da cultura carnavalesca brasileira, sem reproduzir necessariamente sua estética tradicional.' },
      { slideIndex: 9, reason: 'Frase igual ao slide 3 e linha igual ao título', subtitle: 'Como se o Carnaval não fosse suficiente.', bodyAfterImage: '' },
    ] };
    const ai = vi.fn();
    written(ai);
    ai.mockImplementation(async prompt => (prompt.includes('REPARO DE REPETIÇÃO') ? fix : { edits: [] }));
    const output = await review.generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(review.repeatedSentenceSlides(output.result.slides)).toEqual([]);
    expect(review.supportEchoesTitleIndexes(output.result.slides, { lastLine: true })).toEqual([]);
    expect(output.result.slides[9].subtitle).toBe('Como se o Carnaval não fosse suficiente.');
  });
});
