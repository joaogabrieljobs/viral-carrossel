// Teste 6 da Apoteose, itens 2, 5 e 6 (texto do deck no modo livre):
// - 2: título do slide 10 igual à citação do bloco do mesmo slide;
// - 5: a IA não preencheu o eyebrow em nenhum slide;
// - 6: a personalidade em pares virou parágrafo ("X sem ser Y. ...").
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as review from '../../src/utils/editorial-review.js';
import {
  deriveFreeEyebrow, fillFreeEyebrows, finishFreeDraft, personalityComparison, personalityPairs,
} from '../../src/utils/free-draft.js';
import { buildFreeArtDirectionBlock } from '../../src/utils/presentation-plan.js';
import { normalizePresentationBlocks } from '../../src/utils/presentation-quality.js';

const T6 = JSON.parse(readFileSync(new URL('../fixtures/apoteose-teste6.json', import.meta.url), 'utf8'));
// Slides como saem da redação: texto, bloco e o roteiro (papel, função, design).
const draftSlides = () => T6.slides.map(s => ({
  title: s.title, subtitle: s.subtitle, bodyAfterImage: s.bodyAfterImage, eyebrow: '', presentationBlocks: structuredClone(s.presentationBlocks),
  presentationPlan: { schemaVersion: 3, promptVersion: 'presentation-plan-v3', visualRole: s.visualRole, purpose: s.purpose, design: structuredClone(s.design) },
}));

describe('item 2: título igual ao bloco ou ao apoio do mesmo slide vai ao reparo', () => {
  it('o slide 10 do Teste 6 (título = citação do bloco) é apontado; os outros não', () => {
    expect(review.titleEchoesSlideTextIndexes(draftSlides())).toEqual([9]);
  });

  it('quase igual também conta; título curto que só aparece dentro de um apoio longo não', () => {
    const base = { subtitle: '', bodyAfterImage: '', presentationBlocks: [] };
    expect(review.titleEchoesSlideTextIndexes([{ ...base, title: 'O esquenta que São Paulo espera', subtitle: 'O esquenta que São Paulo tanto espera.' }])).toEqual([0]);
    expect(review.titleEchoesSlideTextIndexes([{ ...base, title: 'Brasil na pista', subtitle: 'Curadoria brasileira e plural: hip-hop, funk e eletrônica conduzidos por DJs que levam o Brasil na pista e atravessam universos musicais.' }])).toEqual([]);
  });

  it('no deck gerado, o reparo reescreve o título e a assinatura fica no bloco', async () => {
    const source = { id: 'material', title: 'Apoteose', text: `Apoteose, pré-Carnaval em São Paulo. ${T6.signature} A festa que existe no intervalo entre a promessa de se comportar e a absoluta falta de intenção de cumpri-la.` };
    const plan = {
      schemaVersion: 3, promptVersion: 'presentation-plan-v3', objective: 'Apresentar a Apoteose', audience: 'Parceiros', thesis: 'A festa antecipa o Carnaval',
      rules: [], evidence: [], gaps: [], signature: T6.signature, deckDesign: null,
      slides: T6.slides.map((s, i) => ({ index: i + 1, visualRole: s.visualRole, purpose: s.purpose, question: `Pergunta ${i + 1}?`, keyMessage: `Mensagem ${i + 1}.`, evidenceIds: [], scene: null, avoid: '', design: s.design })),
    };
    const written = draftSlides().map(({ presentationPlan, ...slide }) => ({ ...slide, imageQuery: '', speakerNotes: '' }));
    const ai = vi.fn(async (prompt) => {
      if (prompt.includes('PLANEJAMENTO ESTRUTURADO')) return plan;
      const batch = prompt.match(/apenas as posições ([\d, ]+) do plano/);
      if (batch) return { caption: '', slides: batch[1].split(',').map(position => written[Number(position) - 1]) };
      if (prompt.includes('REPARO DE REPETIÇÃO')) return { edits: [{ slideIndex: 9, reason: 'Título igual à citação.', title: 'A promessa que ninguém cumpre' }] };
      return { edits: [] };
    });
    const output = await review.generateReviewedCarousel({ prompt: 'Material.', config: {
      count: 10, presetId: 'apresentacao', presentationPath: 'auto', presentationPlanning: true, freeDesign: true,
      planningContext: { brief: 'Apresentar a Apoteose.', sources: [source] },
    } }, ai);
    const repair = ai.mock.calls.map(call => call[0]).find(prompt => prompt.includes('REPARO DE REPETIÇÃO')) || '';
    expect(repair).toMatch(/Título igual ao bloco ou ao apoio do próprio slide: slideIndex 9/);
    const last = output.result.slides[9];
    expect(last.title).toBe('A promessa que ninguém cumpre');
    expect(last.presentationBlocks[0].text).toBe(T6.signature);
  });
});

describe('item 5: eyebrow em todas as páginas do modo livre, menos a capa', () => {
  it('rótulo determinístico pelo tema do texto ou pela função do slide, sem repetir', () => {
    const { slides } = fillFreeEyebrows({ slides: draftSlides() });
    expect(slides[0].eyebrow).toBe('');
    for (const slide of slides.slice(1)) {
      expect(slide.eyebrow).toMatch(/^[A-ZÀ-Ú ]{3,32}$/);
      expect(slide.eyebrow.split(' ').length).toBeLessThanOrEqual(3);
    }
    expect(slides.map(s => s.eyebrow)).toEqual(['', 'O COMPORTAMENTO', 'O NOME', 'A PROPOSTA', 'A MÚSICA', 'O PÚBLICO', 'A COMUNICAÇÃO', 'A PERSONALIDADE', 'O POSICIONAMENTO', 'APOTEOSE']);
  });

  it('o rótulo que a IA escreveu fica; sem tema, vale a função do slide', () => {
    const slides = draftSlides();
    slides[4].eyebrow = 'A PISTA';
    expect(fillFreeEyebrows({ slides }).slides[4].eyebrow).toBe('A PISTA');
    expect(deriveFreeEyebrow({ title: 'Receita', subtitle: 'Três fontes.', presentationPlan: { purpose: 'business_model' } }, { index: 2, count: 6, used: new Set() })).toBe('O MODELO');
    expect(deriveFreeEyebrow({ title: 'Revenue', subtitle: 'Three sources.', presentationPlan: { purpose: 'metrics' } }, { index: 2, count: 6, used: new Set(), lang: 'en' })).toBe('THE NUMBERS');
  });

  it('o pedido de redação do modo livre pede o eyebrow com firmeza e exemplo', () => {
    const source = readFileSync(new URL('../../src/utils/editorial-review.js', import.meta.url), 'utf8');
    expect(source).toContain('FREE_EYEBROW_RULE');
    expect(review.FREE_EYEBROW_RULE).toMatch(/obrigatório em todas as páginas, menos na capa/);
    expect(review.FREE_EYEBROW_RULE).toMatch(/"A MÚSICA"/);
  });
});

describe('item 6: personalidade em pares vira bloco comparison', () => {
  const slide8 = () => draftSlides()[7];

  it('os pares "traço sem ser/sem depender/sem recorrer…" saem do texto, na ordem', () => {
    const pairs = personalityPairs(slide8().subtitle);
    expect(pairs).toHaveLength(7);
    expect(pairs[0]).toEqual(['Brasileira', 'sem ser caricata.']);
    expect(pairs[5]).toEqual(['Contemporânea', 'sem depender de tendências.']);
    expect(pairs[6]).toEqual(['Bem-humorada', 'sem recorrer ao humor óbvio.']);
    expect(personalityPairs('Brasileira sem ser caricata. Sofisticada sem ser pretensiosa.')).toEqual([]);
  });

  it('o slide 8 ganha o bloco de duas colunas e o parágrafo encolhe', () => {
    const out = personalityComparison(slide8());
    const [block] = normalizePresentationBlocks(out.presentationBlocks);
    expect(block.type).toBe('comparison');
    expect(block.headers).toEqual(['Traço', 'Sem ser']);
    expect(block.rows[0]).toEqual(['Brasileira', 'sem ser caricata.']);
    expect(block.rows).toHaveLength(5);
    expect(out.presentationPlan.design.block).toBe('comparison');
    // O que não coube na tabela (até 5 linhas) fica no apoio, mais curto que antes.
    expect(out.subtitle).toBe('Contemporânea sem depender de tendências. Bem-humorada sem recorrer ao humor óbvio.');
    expect(out.subtitle.length).toBeLessThan(slide8().subtitle.length / 2);
    expect(out.bodyAfterImage).toBe(slide8().bodyAfterImage);
  });

  it('slide sem pares, ou que já tem bloco, volta igual', () => {
    const other = draftSlides()[1];
    expect(personalityComparison(other)).toBe(other);
    const withBlock = { ...slide8(), presentationBlocks: [{ type: 'quote', text: 'x', author: '' }] };
    expect(personalityComparison(withBlock)).toBe(withBlock);
  });

  it('finishFreeDraft aplica comparação, negrito e eyebrow no deck do Teste 6', () => {
    const { slides } = finishFreeDraft({ slides: draftSlides() });
    expect(slides[7].presentationBlocks[0].type).toBe('comparison');
    expect(slides.slice(1).every(s => s.eyebrow)).toBe(true);
    expect(slides[0].title).toBe('**Apoteose**');
  });

  it('o roteiro do modo livre reforça o bloco para a personalidade em pares', () => {
    expect(buildFreeArtDirectionBlock()).toMatch(/sem ser[^\n]*comparison[^\n]*duas colunas/);
  });
});
