import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as review from '../../src/utils/editorial-review.js';

// Teste 4 da Apoteose, revisão de 25/11: o reparo de repetição sumia sem
// rastro em quatro caminhos (chamada falhou ou editou fora da lista; criou
// fato sem fonte ou passou do limite e foi descartado inteiro; devolveu o
// texto igual; deck anterior à entrega 3). O desfecho fica em
// reviewDiagnostics (presentationQuality.reviewDiagnostics no projeto).
const fixture = JSON.parse(readFileSync(new URL('../fixtures/apoteose-teste4.json', import.meta.url), 'utf8'));
const SIGNATURE = 'Como se o Carnaval não fosse suficiente';
const PROMISE = /promessa de se comportar/;
const known = new Set(fixture.presentationPlan.evidence.map(item => item.id));
const sourceWith = (extra = '') => ({ id: 'material', title: 'Apoteose', text: [fixture.materialTrecho, ...fixture.presentationPlan.evidence.map(item => item.quote), extra].filter(Boolean).join('\n') });
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
const config = (extraMaterial = '') => ({
  count: 10, presetId: 'apresentacao', presentationPath: 'auto', presentationPlanning: true, freeDesign: true,
  planningContext: { brief: 'Apresentar a Apoteose.', sources: [sourceWith(extraMaterial)] },
});

/** IA simulada: roteiro, lotes de redação, revisão sem edições e os dois reparos. */
function deckAI({ facts = () => titleFix, repetition = () => ({ edits: [] }), slides = writtenSlides, plan = planFor } = {}) {
  return vi.fn(async (prompt) => {
    if (prompt.includes('PLANEJAMENTO ESTRUTURADO')) return plan();
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
const generate = (ai, extraMaterial) => review.generateReviewedCarousel({ prompt: 'Material.', config: config(extraMaterial) }, ai);
const promptWith = (ai, marker) => ai.mock.calls.map(call => call[0]).find(prompt => prompt.includes(marker)) || '';
const repetitionEntries = output => output.reviewDiagnostics.filter(item => item.stage === 'repetition');
const promiseSlides = slides => slides.flatMap((slide, index) => (PROMISE.test([slide.title, slide.subtitle, slide.bodyAfterImage].join(' ')) ? [index] : []));

const titleFix = { edits: [{ slideIndex: 7, reason: 'O título afirma como fato uma intenção do material.', title: 'A meta: o esquenta **mais badalado de São Paulo**' }] };
// Reparo bom: a promessa sai dos slides 2 e 9 (índices 1 e 8) e fica no fecho; o eco do 6 sai.
const goodRepair = { edits: [
  { slideIndex: 1, reason: 'A frase da promessa fica no fecho.', bodyAfterImage: '' },
  { slideIndex: 5, reason: 'O apoio repete o título.', bodyAfterImage: '' },
  { slideIndex: 8, reason: 'A frase da promessa fica no fecho.', subtitle: 'O conceito de campanha resume a festa em uma linha.' },
] };

describe('aceite: Teste 4 com reparo simulado bom', () => {
  it('a frase da promessa termina em um slide só (o fecho) e o desfecho fica gravado com o tamanho antes e depois', async () => {
    expect(promiseSlides(writtenSlides())).toEqual([1, 8, 9]);
    const ai = deckAI({ repetition: () => goodRepair });
    const output = await generate(ai);
    expect(promiseSlides(output.result.slides)).toEqual([9]);
    expect(output.result.slides[0].bodyAfterImage).toBe(SIGNATURE);
    expect(output.reviewStatus).toBe('repaired');
    const [entry, ...rest] = repetitionEntries(output);
    expect(rest).toEqual([]);
    expect(entry).toMatchObject({ stage: 'repetition', outcome: 'repetition_repaired', targets: [1, 5, 8] });
    expect(entry.sizeBefore).toBeGreaterThan(0);
    expect(entry.sizeAfter).toBe(0);
    // A revisão continua registrada antes do reparo, como já era.
    expect(output.reviewDiagnostics[0]).toEqual({ attempt: 1, outcome: 'applied' });
  });

  it('a lista de desfechos do reparo é exportada e documentada', () => {
    expect(review.REPETITION_REPAIR_OUTCOMES).toEqual([
      'repetition_none', 'repetition_repaired', 'repetition_request_failed', 'repetition_invalid_response', 'repetition_out_of_scope',
      'repetition_not_improved', 'repetition_rejected_facts_or_limits', 'repetition_partially_salvaged',
    ]);
  });

  it('deck sem repetição registra repetition_none: diagnóstico sem nenhum registro de repetição é deck anterior a esta entrega', async () => {
    const clean = () => writtenSlides().map((slide, index) => (index === 1 ? { ...slide, bodyAfterImage: '' }
      : index === 8 ? { ...slide, subtitle: 'O conceito de campanha resume a festa em uma linha.' }
        : index === 5 ? { ...slide, bodyAfterImage: '' } : slide));
    const ai = deckAI({ slides: clean });
    const output = await generate(ai);
    expect(promptWith(ai, 'REPARO DE REPETIÇÃO')).toBe('');
    expect(repetitionEntries(output)).toEqual([{ stage: 'repetition', outcome: 'repetition_none', sizeBefore: 0, sizeAfter: 0 }]);
  });
});

describe('caminho 1: chamada falhou ou editou slide fora da lista', () => {
  it('edição em slide fora da lista: repetition_out_of_scope com os índices, deck segue como estava', async () => {
    const ai = deckAI({ repetition: () => ({ edits: [...goodRepair.edits, { slideIndex: 3, reason: 'Melhoria.', subtitle: 'Outra coisa.' }] }) });
    const output = await generate(ai);
    expect(promiseSlides(output.result.slides)).toEqual([1, 8, 9]);
    const [entry] = repetitionEntries(output);
    expect(entry).toMatchObject({ outcome: 'repetition_out_of_scope', outOfScope: [3], targets: [1, 5, 8] });
    expect(entry.sizeAfter).toBe(entry.sizeBefore);
  });

  it('chamada que falha: repetition_request_failed com status e mensagem', async () => {
    const ai = deckAI({ repetition: () => { throw Object.assign(new Error('Serviço indisponível'), { status: 503 }); } });
    const output = await generate(ai);
    const [entry] = repetitionEntries(output);
    expect(entry).toMatchObject({ outcome: 'repetition_request_failed', status: 503, message: 'Serviço indisponível' });
    expect(entry.sizeAfter).toBe(entry.sizeBefore);
  });

  it('resposta sem edits: repetition_invalid_response', async () => {
    const ai = deckAI({ repetition: () => ({ texto: 'não sei' }) });
    const output = await generate(ai);
    expect(repetitionEntries(output)[0]).toMatchObject({ outcome: 'repetition_invalid_response' });
  });
});

describe('caminho 3: o modelo devolveu o texto igual', () => {
  it('edição com o mesmo texto: repetition_not_improved, unchanged', async () => {
    const same = writtenSlides()[8].subtitle;
    const ai = deckAI({ repetition: () => ({ edits: [{ slideIndex: 8, reason: 'Repetição.', subtitle: same }] }) });
    const output = await generate(ai);
    const [entry] = repetitionEntries(output);
    expect(entry).toMatchObject({ outcome: 'repetition_not_improved', unchanged: true });
    expect(entry.sizeAfter).toBe(entry.sizeBefore);
  });

  it('edits vazio também é texto igual', async () => {
    const output = await generate(deckAI({ repetition: () => ({ edits: [] }) }));
    expect(repetitionEntries(output)[0]).toMatchObject({ outcome: 'repetition_not_improved', unchanged: true });
  });
});

describe('caminho 2: reparo que reduz a repetição mas cria fato sem fonte', () => {
  const invented = { slideIndex: 1, reason: 'A frase da promessa fica no fecho.', bodyAfterImage: 'Ingressos garantidos para 5 mil pessoas por noite.' };

  it('aproveita slide a slide: fica a edição boa, sai a que cria o fato (repetition_partially_salvaged)', async () => {
    const ai = deckAI({ repetition: () => ({ edits: [invented, goodRepair.edits[1], goodRepair.edits[2]] }) });
    const output = await generate(ai);
    const slides = output.result.slides;
    expect(slides[1].bodyAfterImage).toBe(writtenSlides()[1].bodyAfterImage);
    expect(slides[8].subtitle).toBe(goodRepair.edits[2].subtitle);
    expect(slides[5].bodyAfterImage).toBe('');
    expect(JSON.stringify(slides)).not.toContain('5 mil pessoas');
    const [entry] = repetitionEntries(output);
    expect(entry).toMatchObject({ outcome: 'repetition_partially_salvaged', rejectedBy: ['facts'], kept: [5, 8], dropped: [1] });
    expect(entry.sizeProposed).toBeLessThan(entry.sizeBefore);
    expect(entry.sizeAfter).toBeLessThan(entry.sizeBefore);
    expect(output.reviewStatus).toBe('repaired');
  });

  it('sem edição aproveitável: repetition_rejected_facts_or_limits, deck como estava', async () => {
    const ai = deckAI({ repetition: () => ({ edits: [invented] }) });
    const output = await generate(ai);
    expect(output.result.slides[1].bodyAfterImage).toBe(writtenSlides()[1].bodyAfterImage);
    const [entry] = repetitionEntries(output);
    expect(entry).toMatchObject({ outcome: 'repetition_rejected_facts_or_limits', rejectedBy: ['facts'], kept: [], dropped: [1] });
    expect(entry.sizeAfter).toBe(entry.sizeBefore);
  });
});

describe('assinatura da marca fora da contagem e fora do pedido do reparo', () => {
  it('Teste 4: o pedido de reparo não manda tirar a assinatura de nenhum slide', async () => {
    const ai = deckAI({ repetition: () => goodRepair });
    await generate(ai);
    const prompt = promptWith(ai, 'REPARO DE REPETIÇÃO');
    expect(prompt).not.toMatch(/suficiente" (aparece )?nos slideIndex/);
    expect(prompt).toContain(`Assinatura do deck, que não é repetição e fica onde está: "${SIGNATURE}."`);
  });

  it('assinatura marcada no roteiro, também em 3 slides, não entra como fato repetido nem no tamanho', async () => {
    // A assinatura aparece na capa, no slide 2 e no slide 4; a capa não é citação de evidência.
    const slides = () => writtenSlides().map((slide, index) => (index === 3 ? { ...slide, bodyAfterImage: `${SIGNATURE}, a curadoria é brasileira.` } : slide));
    const ai = deckAI({ slides, plan: () => planFor({ signature: SIGNATURE }), repetition: () => goodRepair });
    const output = await generate(ai);
    const prompt = promptWith(ai, 'REPARO DE REPETIÇÃO');
    expect(prompt).not.toMatch(/suficiente" (aparece )?nos slideIndex/);
    expect(prompt).toMatch(/REPARO DE REPETIÇÃO: edite somente os slides com slideIndex 1, 5, 8\./);
    expect(repetitionEntries(output)[0]).toMatchObject({ outcome: 'repetition_repaired', sizeAfter: 0 });
  });

  it('a assinatura medida no rascunho vale no pedido mesmo que a capa tenha deixado de citá-la', () => {
    const slides = writtenSlides().map((slide, index) => (index === 0 ? { ...slide, bodyAfterImage: '' }
      : index === 3 ? { ...slide, bodyAfterImage: `${SIGNATURE}, a curadoria é brasileira.` } : slide));
    const base = { presetId: 'apresentacao', presentationPlan: planFor(), count: 10 };
    expect(review.buildEditorialReviewPrompt('Material.', { slides, caption: '' }, base)).toMatch(/suficiente" aparece nos slideIndex 1, 3, 8/);
    const prompt = review.buildEditorialReviewPrompt('Material.', { slides, caption: '' }, { ...base, deckSignatures: [`${SIGNATURE}.`] });
    expect(prompt).not.toMatch(/suficiente" aparece/);
    expect(prompt).toContain(`ASSINATURA DO DECK — "${SIGNATURE}."`);
  });

  it('assinatura com número marcada no roteiro não conta como fato repetido', async () => {
    const LINE = '12 noites de esquenta';
    const slides = () => writtenSlides().map((slide, index) => ([0, 2, 6].includes(index) ? { ...slide, speakerNotes: '', bodyAfterImage: index === 0 ? LINE : `${LINE}, sem pausa.` } : slide));
    const ai = deckAI({ slides, plan: () => planFor({ signature: LINE }), repetition: () => goodRepair });
    const output = await generate(ai, `Apoteose: ${LINE}, sem pausa.`);
    const prompt = promptWith(ai, 'REPARO DE REPETIÇÃO');
    expect(prompt).not.toMatch(/"12 noites[^"]*" (aparece )?nos slideIndex/);
    expect(repetitionEntries(output)[0]).toMatchObject({ outcome: 'repetition_repaired' });
  });
});
