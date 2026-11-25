import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as review from '../../src/utils/editorial-review.js';
import { PRESENTATION_PLAN_PROMPT_VERSION } from '../../src/utils/presentation-plan.js';

// Reteste real de 24/11 (RT24 texto 1), e6085f3: repetições que uma pessoa viu
// e a regra não pegou. Pitch 10 e 11; Relatório 5 e 7 (mesmos 3 passos) e 3 e 6
// (mesmas métricas); carrossel Alto impacto 2 e 5. Causas, medidas nos textos
// reais:
// - a conta dividia pelo slide MAIOR somando título, apoio, corpo e blocos: um
//   título diferente ou um bloco a mais derrubava o resultado (Pitch 10~11 =
//   0,56; Alto impacto 2~5 = 0,67 com o corpo idêntico);
// - "builds" e "build" contavam como palavras diferentes;
// - bloco de passos precisava de 0,80 e os reais davam 0,70;
// - não havia regra para bloco de métricas.
const { brief, projects } = JSON.parse(readFileSync(new URL('../fixtures/rt24-projetos.json', import.meta.url), 'utf8'));
const project = name => projects.find(item => item.name === name);
const pairs = list => list.map(item => [item.slideIndex + 1, item.duplicateOf + 1]);
const pitch = project('A1 Pitch').slides;
const relatorio = project('A3 Relatorio').slides;

describe('RT24 texto 1: o corpo é comparado sem o título e sem os blocos', () => {
  it('o limiar do corpo é 0,70, com os pares reais dos dois lados', () => {
    expect(review.REPEATED_BODY_THRESHOLD).toBe(0.7);
    // Repetição que a pessoa apontou.
    expect(review.bodySimilarity(pitch[9], pitch[10])).toBeGreaterThanOrEqual(0.7);
    expect(review.bodySimilarity(relatorio[4], relatorio[6])).toBeGreaterThanOrEqual(0.7);
    // Mesmo assunto, slides com função diferente: ficam abaixo.
    expect(review.bodySimilarity(relatorio[6], relatorio[8])).toBeLessThan(0.7); // passos × recomendação (0,65)
    expect(review.bodySimilarity(pitch[3], pitch[8])).toBeLessThan(0.7); // quem tem site × quem não tem (0,63)
    expect(review.bodySimilarity(pitch[4], pitch[10])).toBeLessThan(0.7); // preço × resumo (0,60)
  });

  it('Pitch real: 10 e 11 são a mesma ideia com outras palavras', () => {
    expect(pitch[9].title).toBe('Site built first, payment only after approval, logo included');
    expect(pitch[10].title).toBe('Site built first, $797 when you like it, logo included');
    expect(pairs(review.repeatedContentSlides(pitch))).toEqual([[11, 10]]);
  });

  it('Relatório real: 5 e 7', () => {
    expect(pairs(review.repeatedContentSlides(relatorio))).toEqual([[7, 5]]);
  });

  it('Alto impacto real: 2 e 5 têm o corpo idêntico com títulos diferentes', () => {
    const slides = project('C2 Alto impacto').slides;
    expect([slides[1].title, slides[4].title]).toEqual(['Send your link or fill the brief', 'Two ways to start']);
    expect(pairs(review.repeatedContentSlides(slides))).toEqual([[5, 2]]);
  });

  it.each(['C1 Ensinar', 'A2 Proposta', 'A4 Caso'])('%s real: nenhum slide marcado', name => {
    expect(review.repeatedContentSlides(project(name).slides)).toEqual([]);
  });

  it('corpo curto igual não basta: precisa de seis radicais', () => {
    const slides = [1, 2, 3].map(n => ({ title: `Decisão ${n}`, subtitle: 'Uma consequência concreta.', bodyAfterImage: 'Próximo passo.' }));
    expect(review.repeatedContentSlides(slides)).toEqual([]);
  });
});

describe('RT24 texto 1: blocos de passos e de métricas entre slides', () => {
  it('Relatório real: 5 e 7 têm os mesmos três passos', () => {
    expect(relatorio[4].presentationBlocks[0].items.map(item => item.title)).toEqual(['Send your link or brief', 'Black Frog builds your site', 'Review before paying']);
    expect(relatorio[6].presentationBlocks[0].items.map(item => item.title)).toEqual(['Send your link or brief', 'We build your new site', 'Review before paying']);
    expect(pairs(review.repeatedStepBlockSlides(relatorio))).toEqual([[7, 5]]);
  });

  it('Proposta real: processo (5) e calendário (7) são blocos de passos diferentes', () => {
    const slides = project('A2 Proposta').slides;
    expect(slides[4].presentationBlocks[0].type).toBe('steps');
    expect(slides[6].presentationBlocks[0].type).toBe('steps');
    expect(review.repeatedStepBlockSlides(slides)).toEqual([]);
  });

  it('Relatório real: 3 e 6 têm as mesmas métricas', () => {
    expect(relatorio[5].presentationBlocks[0].items.map(item => item.label)).toEqual(['Site price', 'Logo included', 'Payment timing']);
    expect(pairs(review.repeatedMetricBlockSlides(relatorio))).toEqual([[6, 3]]);
  });

  it('Caso real: métricas de oferta (4) e de prazo (9) são blocos diferentes', () => {
    const slides = project('A4 Caso').slides;
    expect(slides[3].presentationBlocks[0].type).toBe('metrics');
    expect(slides[8].presentationBlocks[0].type).toBe('metrics');
    expect(review.repeatedMetricBlockSlides(slides)).toEqual([]);
  });

  it('mesmo rótulo com valores diferentes é dado novo, não repetição', () => {
    const metric = (value, detail) => [{ type: 'metrics', items: [{ label: 'Pães vendidos', value, detail }, { label: 'Equipe', value: detail === '2024' ? '4' : '6', detail }] }];
    expect(review.repeatedMetricBlockSlides([{ title: '2024', presentationBlocks: metric('35.000', '2024') }, { title: '2025', presentationBlocks: metric('41.200', '2025') }])).toEqual([]);
  });
});

describe('RT24 texto 1: a apresentação real repara ou avisa', () => {
  const sources = [{ id: 'brief', text: brief }];
  const real = project('A3 Relatorio');
  const plan = () => ({
    schemaVersion: 1, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
    objective: 'Apresentar a oferta', audience: 'Negócios locais', thesis: 'Site primeiro, pagamento quando gostar.',
    evidence: [{ id: 'e1', status: 'fact', sourceId: 'brief', quote: 'you see the new site before any payment', claim: 'Vê antes de pagar.' }],
    gaps: [],
    slides: real.plan.slides.slice(0, 9).map(entry => ({ ...entry, evidenceIds: ['e1'], imageBrief: '' })),
  });
  const config = () => ({ count: 9, presetId: 'apresentacao', presentationPath: 'relatorio', presentationPlanning: true, planningContext: { brief: 'Create a report deck.', sources } });
  const batch = (from, to) => ({ caption: '', slides: real.slides.slice(from, to).map(slide => ({ ...slide, imageQuery: '' })) });
  const written = ai => ai.mockResolvedValueOnce(plan()).mockResolvedValueOnce(batch(0, 3)).mockResolvedValueOnce(batch(3, 6)).mockResolvedValueOnce(batch(6, 9));

  it('sem reparo da IA: o segundo bloco igual sai e o aviso diz quais slides repetem, sem virar rascunho', async () => {
    const ai = written(vi.fn()).mockResolvedValueOnce({ edits: [] }).mockRejectedValueOnce(new Error('fora do ar'));
    const output = await review.generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    // Plano, três lotes, revisão e um único reparo.
    expect(ai).toHaveBeenCalledTimes(6);
    expect(ai.mock.calls[5][0]).toContain('REPARO DE REPETIÇÃO');
    expect(ai.mock.calls[5][0]).toContain('Mesmo bloco de passos nos slideIndex 4 e 6');
    expect(ai.mock.calls[5][0]).toContain('Mesmo bloco de métricas nos slideIndex 2 e 5');
    expect(ai.mock.calls[5][0]).toMatch(/slideIndex 6 \(repete o 4\)/);
    expect(output.result.slides).toHaveLength(9);
    expect(output.result.slides[4].presentationBlocks).toHaveLength(1);
    expect(output.result.slides[6].presentationBlocks).toEqual([]);
    expect(output.result.slides[2].presentationBlocks).toHaveLength(1);
    expect(output.result.slides[5].presentationBlocks).toEqual([]);
    // O texto do slide não é trocado por texto do plano.
    expect(output.result.slides[6].title).toBe(real.slides[6].title);
    expect(output.repetitionNotice).toBe('Os slides 5 e 7 dizem o mesmo com outras palavras. O material rende menos slides do que o pedido: junte os dois, reescreva um deles ou gere de novo com menos slides.');
    expect(output.reviewStatus).toBe('repaired');
    expect(output.violations).toBeUndefined();
  });

  it('com o reparo da IA, o slide reescrito fica e não há aviso', async () => {
    const repair = { edits: [
      { slideIndex: 6, reason: 'Repetia o slide 5', title: 'BLK FROGDAY runs Nov 23 to 30', subtitle: 'The offer ends Nov 30, 11:59 PM PT.', presentationBlocks: [] },
      { slideIndex: 5, reason: 'Métricas repetidas', presentationBlocks: [] },
    ] };
    const ai = written(vi.fn()).mockResolvedValueOnce({ edits: [] }).mockResolvedValueOnce(repair);
    const output = await review.generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(ai).toHaveBeenCalledTimes(6);
    expect(output.result.slides[6].title).toBe('BLK FROGDAY runs Nov 23 to 30');
    expect(output.repetitionNotice).toBeUndefined();
    expect(output.reviewStatus).toBe('repaired');
  });

  it('o editor junta o aviso de repetição ao aviso sobre o material', () => {
    const source = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
    expect(source).toMatch(/materialNotice: \[pathMaterialNotice, materialGapNotice\(materialGaps\), repetitionNotice\]\.filter\(Boolean\)\.join\(' '\)/);
  });
});

describe('RT24 texto 1: o carrossel real repara ou tira o card', () => {
  const cards = name => ({ caption: 'Legenda.', slides: project(name).slides.map(slide => ({ ...slide, imageQuery: '' })) });
  const config = { count: 6, presetId: 'livre', densityId: '1_1', factualSource: brief };

  it('Alto impacto: sem reparo da IA, o card 5 sai e o projeto avisa', async () => {
    const ai = vi.fn().mockResolvedValueOnce(cards('C2 Alto impacto')).mockResolvedValueOnce({ edits: [] }).mockRejectedValueOnce(new Error('fora do ar'));
    const output = await review.generateReviewedCarousel({ prompt: 'Material.', config }, ai);
    expect(ai).toHaveBeenCalledTimes(3);
    expect(ai.mock.calls[2][0]).toMatch(/slideIndex 4 repete o slideIndex 1/);
    expect(output.result.slides.map(slide => slide.title)).toEqual(['We build it first. You pay when you like it.', 'Send your link or fill the brief', 'Your new site is $797', 'Built for local service businesses', 'Offer ends Nov 30, 11:59 PM PT']);
    expect(output.violations).toContainEqual({ kind: 'normalization', slideIndex: null, code: 'repeated_cards_removed' });
  });

  it('Ensinar: nenhum reparo, nenhum card a menos', async () => {
    const ai = vi.fn().mockResolvedValueOnce(cards('C1 Ensinar')).mockResolvedValue({ edits: [] });
    const output = await review.generateReviewedCarousel({ prompt: 'Material.', config: { ...config, narrativeMode: 'how_to' } }, ai);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(output.result.slides).toHaveLength(6);
    expect(output.reviewStatus).toBe('unchanged');
  });

  it('quando o repetido é o último card, sai o anterior e o fecho fica', async () => {
    // Par real do catálogo de 22/11 (carrossel da padaria, cards 4 e 6).
    const draft = { caption: 'Legenda.', slides: [
      { title: 'Fermento Lento, no Rio Vermelho', subtitle: 'Pão de fermentação natural de 36 horas.', imageQuery: '' },
      { title: 'Três pães para escolher', subtitle: 'Camponês, integral e brioche.', imageQuery: '' },
      { title: 'Encomende com um dia de antecedência', subtitle: 'A encomenda é feita pelo WhatsApp com 1 dia de antecedência, para retirada na padaria.', imageQuery: '' },
      { title: 'Encomende seu pão pelo WhatsApp', subtitle: 'Faça sua encomenda pelo WhatsApp com 1 dia de antecedência e retire na padaria.', imageQuery: '' },
    ] };
    const source = 'Padaria Fermento Lento, no Rio Vermelho. Pão de fermentação natural de 36 horas. Três pães: camponês, integral e brioche. Encomenda pelo WhatsApp com 1 dia de antecedência. Retirada na padaria.';
    const ai = vi.fn().mockResolvedValueOnce(draft).mockResolvedValueOnce({ edits: [] }).mockRejectedValueOnce(new Error('fora do ar'));
    const output = await review.generateReviewedCarousel({ prompt: 'Material.', config: { count: 4, presetId: 'livre', densityId: '1_1', factualSource: source } }, ai);
    expect(output.result.slides.map(slide => slide.title)).toEqual(['Fermento Lento, no Rio Vermelho', 'Três pães para escolher', 'Encomende seu pão pelo WhatsApp']);
  });
});
