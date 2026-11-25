import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import * as review from '../../src/utils/editorial-review.js';
import { goalTitleAsFactSlides } from '../../src/utils/factual-grounding.js';
import { buildPresentationPlanPrompt, validatePresentationPlan } from '../../src/utils/presentation-plan.js';
import EditorialReviewNotice from '../../src/components/EditorialReviewNotice.jsx';

// Teste 4 da Apoteose (produção, modo livre, roteiro v3, 25/11): o dono viu
// a frase da promessa nos slides 9 e 10, linhas de apoio que repetem o próprio
// slide (6 e 7) e o título do 8 dando como fato o que o apoio chama de
// intenção ("pretende se consolidar"). A assinatura "Como se o Carnaval não
// fosse suficiente" (capa, slide 2 e citação do 9) não é repetição.
const fixture = JSON.parse(readFileSync(new URL('../fixtures/apoteose-teste4.json', import.meta.url), 'utf8'));
const SIGNATURE = 'Como se o Carnaval não fosse suficiente';
const PROMISE = /promessa de se comportar/;
const known = new Set(fixture.presentationPlan.evidence.map(item => item.id));
const source = { id: 'material', title: 'Apoteose', text: [fixture.materialTrecho, ...fixture.presentationPlan.evidence.map(item => item.quote)].join('\n') };
const planFor = (extra = {}) => ({
  ...structuredClone(fixture.presentationPlan),
  evidence: fixture.presentationPlan.evidence.map(item => ({ ...item, sourceId: 'material' })),
  deckDesign: null,
  slides: fixture.slides.map(({ presentationPlan: entry }) => ({
    index: entry.index, visualRole: entry.visualRole, purpose: entry.purpose, question: entry.question, keyMessage: entry.keyMessage,
    evidenceIds: entry.evidenceIds.filter(id => known.has(id)), scene: null, avoid: '', design: entry.design,
  })),
  ...extra,
});
const writtenSlides = () => fixture.slides.map(({ presentationPlan, ...slide }) => ({ ...structuredClone(slide), imageQuery: '', speakerNotes: '' }));
const config = () => ({
  count: 10, presetId: 'apresentacao', presentationPath: 'auto', presentationPlanning: true, freeDesign: true,
  planningContext: { brief: 'Apresentar a Apoteose.', sources: [source] },
});

/** IA simulada: roteiro, lotes de redação, revisão sem edições e os dois reparos. */
function deckAI({ facts = () => ({ edits: [] }), repetition = () => ({ edits: [] }), slides = writtenSlides } = {}) {
  return vi.fn(async (prompt) => {
    if (prompt.includes('PLANEJAMENTO ESTRUTURADO')) return planFor();
    const batch = prompt.match(/apenas as posições ([\d, ]+) do plano/);
    if (batch) {
      const deck = slides();
      return { caption: '', slides: batch[1].split(',').map(position => deck[Number(position) - 1]) };
    }
    if (prompt.includes('REPARO DE FATOS')) return facts(prompt);
    if (prompt.includes('REPARO DE REPETIÇÃO')) return repetition(prompt);
    return { edits: [] };
  });
}
const promptWith = (ai, marker) => ai.mock.calls.map(call => call[0]).find(prompt => prompt.includes(marker)) || '';
const titleFix = { edits: [{ slideIndex: 7, reason: 'O título afirma como fato uma intenção do material.', title: 'A meta: o esquenta **mais badalado de São Paulo**' }] };
const repetitionFix = { edits: [
  { slideIndex: 8, reason: 'A frase da promessa fica no fecho.', subtitle: 'O conceito de campanha resume a festa em uma linha.' },
  { slideIndex: 5, reason: 'O apoio repete o título.', bodyAfterImage: '' },
] };

describe('Teste 4: o plano validado é o do deck real', () => {
  it('o editor leva a repetição que sobrou ao bloco de revisão, fora do status', () => {
    const source = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
    expect(source).toContain("repetitionNotice = '', repetitionRemaining = [] } = await generateReviewedCarousel(");
    expect(source).toContain("editorialReviewIssues: [...(reviewStatus === 'needs_attention' ? (editorialViolations.length ? editorialViolations : editorialIssues) : []), ...repetitionRemaining].map(");
  });

  it('o roteiro da fixture passa na validação v3 sem campo de assinatura', () => {
    const checked = validatePresentationPlan(planFor(), { count: 10, sources: [source], freeDesign: true });
    expect(checked.errors).toEqual([]);
    expect(checked.plan).not.toHaveProperty('signature');
  });
});

describe('item 1: assinatura do deck não é repetição', () => {
  it('Teste 4 (sem campo): a frase curta do material citada literalmente na capa é a assinatura', () => {
    expect(review.deckSignatures(fixture.slides, fixture.presentationPlan)).toEqual([`${SIGNATURE}.`]);
  });

  it('a assinatura sai da conta da trinca e da frase repetida; a promessa continua', () => {
    const signatures = review.deckSignatures(fixture.slides, fixture.presentationPlan);
    expect(review.repeatedPhraseSlides(fixture.slides).map(item => item.phrase)).toContain('carnaval fosse suficiente');
    const phrases = review.repeatedPhraseSlides(fixture.slides, { signatures });
    expect(phrases.map(item => item.phrase)).not.toContain('carnaval fosse suficiente');
    expect(phrases).toContainEqual({ phrase: 'intervalo entre promessa', slideIndexes: [1, 8, 9] });
    const sentences = review.repeatedSentenceSlides([...fixture.slides, { title: 'Extra', subtitle: `E, ${SIGNATURE.toLowerCase()}, ainda existe o esquenta.` }], { signatures });
    expect(sentences.map(item => item.phrase).join(' ')).not.toMatch(/suficiente/);
  });

  it('frase que está na capa e no fecho é assinatura, mesmo sem plano', () => {
    const deck = [
      { title: 'Pão de fermentação natural, feito sem pressa', subtitle: 'A Padaria Ponto abre às sete.' },
      { title: 'Fermentação longa', subtitle: 'Pão de fermentação natural, feito sem pressa: a massa descansa 36 horas.' },
      { title: 'Encomendas', subtitle: 'Pelo WhatsApp, até as 18h.' },
      { title: 'Passe na padaria amanhã cedo', subtitle: 'Pão de fermentação natural, feito sem pressa.' },
    ];
    expect(review.repeatedPhraseSlides(deck, { signatures: [] }).map(item => item.slideIndexes)).toContainEqual([0, 1, 3]);
    expect(review.deckSignatures(deck)).toEqual(['Pão de fermentação natural, feito sem pressa']);
    expect(review.repeatedPhraseSlides(deck)).toEqual([]);
    // Título igual na capa e no fecho é título repetido (auditoria 23/11 B1), não assinatura.
    expect(review.deckSignatures([{ title: 'Validar a assinatura do piloto' }, { title: 'Meio' }, { title: 'Validar a assinatura do piloto' }])).toEqual([]);
    expect(review.repeatedPhraseSlides(deck)).toEqual([]);
  });

  it('o roteiro pode marcar a assinatura no campo signature (v2 e v3), copiada do material', () => {
    const marked = validatePresentationPlan(planFor({ signature: SIGNATURE }), { count: 10, sources: [source], freeDesign: true });
    expect(marked.errors).toEqual([]);
    expect(marked.plan.signature).toBe(SIGNATURE);
    expect(review.deckSignatures([{ title: 'A' }, { title: 'B' }], marked.plan)).toEqual([SIGNATURE]);
    // Frase que não está no material não vira assinatura (não é fonte de exceção).
    const invented = validatePresentationPlan(planFor({ signature: 'A melhor festa do Brasil' }), { count: 10, sources: [source], freeDesign: true });
    expect(invented.errors).toEqual([]);
    expect(invented.plan).not.toHaveProperty('signature');
    expect(validatePresentationPlan(planFor({ signature: 42 }), { count: 10, sources: [source], freeDesign: true }).issues.map(item => item.code)).toContain('invalid_signature');
  });

  it('o pedido do roteiro pede a assinatura em uma linha (hash do pedido v2 atualizado)', () => {
    const SRC = [{ id: 's1', title: 'Fonte', text: 'O festival reúne 40 mil pessoas em 12 noites.' }];
    const prompt = buildPresentationPlanPrompt({ brief: 'Festival', sources: SRC, count: 10, presentationPath: 'auto' });
    expect(prompt).toMatch(/- signature guarda a frase de assinatura ou gancho/);
    expect(prompt).toContain('"gaps":["decisão essencial ainda aberta"],"signature":""');
    expect(createHash('sha256').update(prompt).digest('hex').slice(0, 16)).not.toBe('35b81b983596f508');
  });

  it('a revisão é avisada de que a assinatura não é repetição', () => {
    const prompt = review.buildEditorialReviewPrompt('Material.', { slides: writtenSlides(), caption: '' }, { presetId: 'apresentacao', presentationPlan: planFor(), count: 10 });
    expect(prompt).toContain(`ASSINATURA DO DECK — "${SIGNATURE}."`);
    expect(prompt).not.toMatch(/"carnaval fosse suficiente" aparece/);
  });
});

describe('item 3: linha de apoio contida no parágrafo do mesmo slide', () => {
  it('slide 7: "Atual sem depender de tendências" está no subtitle e o campo fica vazio', () => {
    const cleaned = review.withoutEchoedSupportLines(fixture.slides);
    expect(cleaned[6].bodyAfterImage).toBe('');
    cleaned.forEach((slide, index) => { if (index !== 6) expect(slide).toBe(fixture.slides[index]); });
  });

  it('apoio com menos de 80% das palavras no parágrafo fica', () => {
    const slide = { title: 'Fermentação', subtitle: 'A massa descansa 36 horas antes de ir ao forno.', bodyAfterImage: 'A massa descansa e ganha sabor no frio.' };
    expect(review.withoutEchoedSupportLines([slide])[0]).toBe(slide);
  });
});

describe('item 4: título que dá como fato o que o apoio chama de intenção', () => {
  it('slide 8: "O mais badalado de São Paulo" contra "pretende se consolidar"', () => {
    expect(goalTitleAsFactSlides(fixture.slides)).toEqual([7]);
  });

  it('título que já fala de meta, ou apoio sem intenção, não conta', () => {
    expect(goalTitleAsFactSlides([{ title: 'A meta: o mais badalado de São Paulo', subtitle: 'A Apoteose pretende ser o esquenta mais badalado da cidade.' }])).toEqual([]);
    expect(goalTitleAsFactSlides([{ title: 'O mais badalado de São Paulo', subtitle: 'O esquenta mais badalado da cidade desde 2019.' }])).toEqual([]);
    expect(goalTitleAsFactSlides([{ title: 'Pão em 36 horas', subtitle: 'Queremos abrir uma segunda loja em Curitiba.' }])).toEqual([]);
  });
});

describe('aceite: Teste 4 pelo fluxo de revisão e reparo', () => {
  it('termina sem a promessa em 9 e 10 juntos, sem eco em 6 e 7, com a assinatura na capa e o fecho intacto', async () => {
    const ai = deckAI({ facts: () => titleFix, repetition: () => repetitionFix });
    const output = await review.generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    const slides = output.result.slides;
    expect(PROMISE.test(slides[8].subtitle) && PROMISE.test(slides[9].subtitle)).toBe(false);
    expect(slides[5].bodyAfterImage).toBe('');
    expect(slides[6].bodyAfterImage).toBe('');
    expect(review.supportEchoesTitleIndexes(slides, { lastLine: true })).toEqual([]);
    expect(slides[0].bodyAfterImage).toBe(SIGNATURE);
    expect(slides[8].presentationBlocks).toEqual([{ type: 'quote', text: `${SIGNATURE}.`, author: '' }]);
    expect(slides[9]).toMatchObject({ title: fixture.slides[9].title, subtitle: fixture.slides[9].subtitle, bodyAfterImage: fixture.slides[9].bodyAfterImage });
    expect(slides[7].title).toBe(titleFix.edits[0].title);
    // O título do 8 foi ao reparo de fatos; a repetição não pede a capa nem o fecho.
    expect(promptWith(ai, 'REPARO DE FATOS')).toMatch(/edite somente os slides com slideIndex 7\./);
    expect(promptWith(ai, 'REPARO DE FATOS')).toContain('o apoio do mesmo slide trata como intenção (pretende, quer, busca, meta): slideIndex 7, "O mais badalado de São Paulo"');
    const repetitionPrompt = promptWith(ai, 'REPARO DE REPETIÇÃO');
    expect(repetitionPrompt).toMatch(/REPARO DE REPETIÇÃO: edite somente os slides com slideIndex 1, 5, 8\./);
    expect(repetitionPrompt).not.toMatch(/"carnaval fosse suficiente" nos slideIndex/);
    expect(output.reviewStatus).toBe('repaired');
    expect(output.repetitionRemaining).toBeUndefined();
  });

  it('antes: o deck do Teste 4 tem a promessa em 9 e 10 e o apoio do 7 dentro do parágrafo', () => {
    expect(PROMISE.test(fixture.slides[8].subtitle) && PROMISE.test(fixture.slides[9].subtitle)).toBe(true);
    expect(fixture.slides[9].subtitle).toContain(fixture.slides[8].subtitle.replace(/^A festa existe /, '').replace(/\.$/, ''));
    expect(fixture.slides[6].subtitle.toLowerCase()).toContain(fixture.slides[6].bodyAfterImage.toLowerCase());
  });
});

describe('item 2: reparo de repetição aceita melhora parcial e avisa o que sobrou', () => {
  it('Teste 4: o reparo tira a promessa do 9 e deixa o eco do 6; aceita e avisa o slide 6', async () => {
    const ai = deckAI({ facts: () => titleFix, repetition: () => ({ edits: [repetitionFix.edits[0]] }) });
    const output = await review.generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(output.result.slides[8].subtitle).toBe(repetitionFix.edits[0].subtitle);
    // Repetição é qualidade: o deck não vira rascunho; o aviso vai à parte.
    expect(output.reviewStatus).toBe('repaired');
    expect(output.violations).toBeUndefined();
    expect(output.repetitionRemaining).toEqual([{ kind: 'repetition_remaining', code: 'repetition_remaining', slideIndex: 5, field: null }]);
  });

  it('frase igual em três slides: o reparo que a tira de um é aceito (antes era recusado)', async () => {
    // Igual ao trecho comum de 9 e 10: as três cópias só têm sequências comuns às três.
    const full = 'Ela existe no intervalo entre a promessa de se comportar e a absoluta falta de intenção de cumpri-la.';
    const slides = () => writtenSlides().map((slide, index) => (index === 1 ? { ...slide, bodyAfterImage: full } : slide));
    const ai = deckAI({ slides, facts: () => titleFix, repetition: () => ({ edits: [{ slideIndex: 1, reason: 'Frase igual à do fecho.', bodyAfterImage: '' }] }) });
    const output = await review.generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(output.result.slides[1].bodyAfterImage).toBe('');
    expect(output.reviewStatus).toBe('repaired');
    expect(output.repetitionRemaining.map(item => item.slideIndex)).toEqual([5, 8, 9]);
    const html = renderToStaticMarkup(React.createElement(EditorialReviewNotice, { status: output.reviewStatus, issues: output.repetitionRemaining, isPresentation: true }));
    expect(html).toContain('Repetição para conferir — revise antes de exportar');
    expect(html).not.toContain('Rascunho preservado');
    expect(html).toContain('Sobrou repetição depois do reparo automático nos slides 6, 9 e 10. Reescreva o trecho repetido antes de exportar.');
    expect(html).toContain('Slides: 6, 9, 10');
    // Depois de "Conferi o conteúdo" o bloco some; sem repetição, nada aparece.
    expect(renderToStaticMarkup(React.createElement(EditorialReviewNotice, { status: 'reviewed_by_user', issues: output.repetitionRemaining, isPresentation: true }))).toBe('');
    expect(renderToStaticMarkup(React.createElement(EditorialReviewNotice, { status: 'repaired', issues: [], isPresentation: true }))).toBe('');
  });
});
