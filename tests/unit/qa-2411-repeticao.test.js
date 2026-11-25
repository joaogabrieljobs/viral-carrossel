import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as review from '../../src/utils/editorial-review.js';
import { PRESENTATION_PLAN_PROMPT_VERSION } from '../../src/utils/presentation-plan.js';

const { generateReviewedCarousel, buildEditorialReviewPrompt } = review;

// QA 24/11 (texto 3), produção dd6f657: a revisão marcava título repetido e
// entregava assim; card que a IA não devolveu era preenchido com cópia do CTA;
// só título igual contava como repetição; a apresentação repetia o mesmo bloco
// de passos em dois slides.
const card = (title, subtitle, extra = {}) => ({ title, subtitle, imageQuery: '', ...extra });

describe('QA 24/11 texto 3: repetição de corpo e paráfrase', () => {
  it('o limiar é 80% dos radicais do card maior, e vale nos dois sentidos', () => {
    expect(review.REPEATED_CONTENT_THRESHOLD).toBe(0.8);
    const a = card('Alfa', 'banana cereja damasco figo goiaba');
    // 5 de 6 radicais em comum: 0,83.
    expect(review.slideSimilarity(a, card('Alfa', 'banana cereja damasco figo laranja'))).toBeCloseTo(5 / 6);
    expect(review.repeatedContentSlides([a, card('Alfa', 'banana cereja damasco figo laranja')])).toEqual([{ slideIndex: 1, duplicateOf: 0, score: 0.83 }]);
    // 4 de 6: 0,67, abaixo do limiar.
    expect(review.slideSimilarity(a, card('Alfa', 'banana cereja damasco laranja manga'))).toBeCloseTo(4 / 6);
    expect(review.repeatedContentSlides([a, card('Alfa', 'banana cereja damasco laranja manga')])).toEqual([]);
  });

  it('pega a paráfrase com títulos diferentes (par real do catálogo de 22/11)', () => {
    const slides = [
      card('Fermento Lento', 'Pão de fermentação natural de 36 horas.'),
      card('Encomende pão pelo WhatsApp', 'Faça sua encomenda na Fermento Lento.'),
      card('Peça seu pão pelo WhatsApp', 'Encomende na Fermento Lento.'),
    ];
    expect(review.repeatedContentSlides(slides).map(item => [item.slideIndex, item.duplicateOf])).toEqual([[2, 1]]);
  });

  it('não pega cards que só compartilham o assunto (par real, 0,70)', () => {
    const slides = [
      card('Encomende pelo WhatsApp com 1 dia de antecedência', 'Você reserva o pão antes de buscar na padaria.'),
      card('Mande sua encomenda pelo WhatsApp', 'Escolha o pão, reserve com um dia de antecedência e venha buscar.'),
    ];
    expect(review.repeatedContentSlides(slides)).toEqual([]);
  });

  it('card curto demais não entra na conta, e passos numerados não são repetição', () => {
    expect(review.repeatedContentSlides([card('Passo 1', 'Escolha o pão.'), card('Passo 2', 'Escolha o pão.')])).toEqual([]);
    expect(review.repeatedContentSlides([
      card('Passo 1: escolha o pão', 'Camponês, integral ou brioche, direto no cardápio.'),
      card('Passo 2: mande a mensagem', 'Peça pelo WhatsApp um dia antes da retirada.'),
    ])).toEqual([]);
  });
});

describe('QA 24/11 texto 3: o mesmo bloco de passos em mais de um slide', () => {
  const steps = (...titles) => [{ type: 'steps', items: titles.map(title => ({ title, body: '' })) }];
  it('marca o segundo slide com o mesmo bloco, mesmo com outra redação nos corpos', () => {
    const slides = [
      card('Como pedir', 'Três passos.', { presentationBlocks: [{ type: 'steps', items: [{ title: 'Escolha o pão', body: 'Camponês, integral ou brioche.' }, { title: 'Mande a mensagem', body: 'Pelo WhatsApp, um dia antes.' }, { title: 'Retire na padaria', body: '' }] }] }),
      card('Preços', 'Tabela.', { presentationBlocks: [{ type: 'comparison', headers: ['Pão', 'Preço'], rows: [['Camponês', 'R$ 24']] }] }),
      card('Próximo passo', 'Faça o pedido.', { presentationBlocks: steps('Escolha o pão', 'Mande a mensagem', 'Retire na padaria') }),
    ];
    expect(review.repeatedStepBlockSlides(slides)).toEqual([{ slideIndex: 2, duplicateOf: 0 }]);
  });
  it('blocos de passos diferentes ficam', () => {
    const slides = [
      card('Como pedir', 'Três passos.', { presentationBlocks: steps('Escolha o pão', 'Mande a mensagem', 'Retire na padaria') }),
      card('Como fazemos', 'O processo.', { presentationBlocks: steps('Fermentação de 36 horas', 'Modelagem', 'Forno') }),
    ];
    expect(review.repeatedStepBlockSlides(slides)).toEqual([]);
  });
});

describe('QA 24/11 texto 3: carrossel repara o card repetido', () => {
  const source = 'Padaria Fermento Lento, no Rio Vermelho. Pão de fermentação natural de 36 horas. Três pães: camponês, integral e brioche. Encomenda pelo WhatsApp com 1 dia de antecedência. Retirada na padaria.';
  const config = extra => ({ count: 4, presetId: 'livre', densityId: '1_1', factualSource: source, ...extra });
  const draft = () => ({ caption: 'Legenda.', slides: [
    card('Fermento Lento, no Rio Vermelho', 'Pão de fermentação natural de 36 horas.'),
    card('Três pães para escolher', 'Camponês, integral e brioche.'),
    card('Encomende pelo WhatsApp', 'A Fermento Lento recebe encomendas com 1 dia de antecedência.'),
    card('Um dia antes', 'Encomendas na Fermento Lento pelo WhatsApp, com 1 dia de antecedência.'),
  ] });

  it('a paráfrase entra no reparo por IA que já existe, com a instrução de reescrever', async () => {
    const repair = { edits: [{ slideIndex: 3, reason: 'Repetia o card anterior', title: 'Retire na padaria', subtitle: 'A encomenda fica pronta para retirada.' }] };
    const ai = vi.fn().mockResolvedValueOnce(draft()).mockResolvedValueOnce({ edits: [] }).mockResolvedValueOnce(repair);
    const output = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(ai).toHaveBeenCalledTimes(3);
    expect(ai.mock.calls[2][0]).toContain('REPARO DIRECIONADO');
    expect(ai.mock.calls[2][0]).toContain('CARD REPETIDO');
    expect(ai.mock.calls[2][0]).toMatch(/slideIndex 3 repete o slideIndex 2/);
    expect(output.result.slides).toHaveLength(4);
    expect(output.result.slides[3].title).toBe('Retire na padaria');
    expect(output.reviewStatus).toBe('repaired');
  });

  it('se o reparo por IA falha, o card repetido sai e o projeto avisa que ficou com menos cards', async () => {
    const ai = vi.fn().mockResolvedValueOnce(draft()).mockResolvedValueOnce({ edits: [] }).mockRejectedValueOnce(new Error('fora do ar'));
    const output = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(output.result.slides.map(slide => slide.title)).toEqual(['Fermento Lento, no Rio Vermelho', 'Três pães para escolher', 'Encomende pelo WhatsApp']);
    expect(output.reviewStatus).toBe('needs_attention');
    expect(output.violations).toContainEqual({ kind: 'normalization', slideIndex: null, code: 'repeated_cards_removed' });
    expect(output.violations.some(item => item.kind === 'repeated_content')).toBe(false);
  });

  it('quando a quantidade é fixa (refazer ou roteiro do usuário), o card repetido fica e é marcado', async () => {
    for (const extra of [{ keepCardCount: true }, { explicitCardScript: { count: 4, blocks: [] } }]) {
      const ai = vi.fn().mockResolvedValueOnce(draft()).mockResolvedValueOnce({ edits: [] }).mockRejectedValueOnce(new Error('fora do ar'));
      const output = await generateReviewedCarousel({ prompt: 'Material.', config: config(extra) }, ai);
      expect(output.result.slides).toHaveLength(4);
      expect(output.violations).toContainEqual(expect.objectContaining({ kind: 'repeated_content', slideIndex: 3, duplicateOf: 2 }));
    }
  });

  it('o editor avisa a geração de que refazer mantém a quantidade de cards', () => {
    const source = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
    expect(source).toMatch(/keepCardCount: !!remix,/);
  });
});

describe('QA 24/11 texto 3: card que a IA não devolveu não recebe cópia do CTA', () => {
  const source = 'Padaria Fermento Lento, no Rio Vermelho. Pão de fermentação natural de 36 horas. Encomenda pelo WhatsApp com 1 dia de antecedência.';
  const config = { count: 4, presetId: 'livre', densityId: '1_1', factualSource: source };
  const short = () => ({ caption: 'Legenda.', slides: [
    card('Fermento Lento, no Rio Vermelho', 'Pão de fermentação natural de 36 horas.'),
    card('Por que 36 horas', 'A fermentação natural leva 36 horas.'),
    card('Encomende pelo WhatsApp', 'Peça com 1 dia de antecedência.'),
  ] });

  it('o pedido de revisão não manda preencher o card vazio com o que já está escrito', () => {
    const padded = review.validateCarouselDraft(short(), { ...config, allowMissingSocialTitles: true, allowLongSocialSupport: true, allowIncompleteDraft: true });
    const prompt = buildEditorialReviewPrompt('Material.', padded, config);
    expect(prompt).not.toMatch(/preencha title nos slideIndex[^.]*\b3\b/);
    expect(prompt).toContain('CARD SEM TEXTO — o slideIndex 3 veio vazio. Só preencha com uma informação do material que ainda não está em outro card; não copie nem parafraseie o CTA ou outro card. Sem informação nova, deixe title e subtitle vazios.');
  });

  it('a cópia do CTA no card vazio é desfeita: o espaço fica vazio e marcado', async () => {
    const copy = { edits: [{ slideIndex: 3, reason: 'Card vazio', title: 'Encomende pelo WhatsApp', subtitle: 'Peça com 1 dia de antecedência.' }] };
    const ai = vi.fn().mockResolvedValueOnce(short()).mockResolvedValueOnce(copy).mockResolvedValue({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: 'Material.', config }, ai);
    expect(output.result.slides).toHaveLength(4);
    expect(output.result.slides[3]).toMatchObject({ title: '', subtitle: '' });
    expect(output.result.slides[2].title).toBe('Encomende pelo WhatsApp');
    expect(output.reviewStatus).toBe('needs_attention');
    expect(output.violations).toContainEqual({ kind: 'normalization', slideIndex: null, code: 'missing_slides_padded' });
  });

  it('conteúdo novo do material no card vazio é aceito', async () => {
    const fresh = { edits: [{ slideIndex: 3, reason: 'Card vazio', title: 'No Rio Vermelho', subtitle: 'A padaria fica no bairro.' }] };
    const ai = vi.fn().mockResolvedValueOnce(short()).mockResolvedValueOnce(fresh).mockResolvedValue({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: 'Material.', config }, ai);
    expect(output.result.slides[3].title).toBe('No Rio Vermelho');
  });
});

describe('QA 24/11 texto 3: apresentação repara slide e bloco de passos repetidos', () => {
  const sources = [{ id: 'brief', text: 'A padaria Fermento Lento vende pão de fermentação natural. O pedido chega pelo WhatsApp. A retirada é na padaria. O pão leva farinha, água e sal.' }];
  const plan = () => ({
    schemaVersion: 1, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
    objective: 'Apresentar a padaria', audience: 'Moradores do bairro', thesis: 'Pão de fermentação natural com pedido pelo WhatsApp.',
    evidence: [
      { id: 'e1', status: 'fact', sourceId: 'brief', quote: 'O pedido chega pelo WhatsApp.', claim: 'Pedido pelo WhatsApp.' },
      { id: 'e2', status: 'fact', sourceId: 'brief', quote: 'O pão leva farinha, água e sal.', claim: 'Três ingredientes.' },
    ],
    gaps: [],
    slides: [
      { index: 1, visualRole: 'cover', purpose: 'introduction', question: 'O que a padaria vende?', keyMessage: 'ABERTURA: Pão de fermentação natural.', evidenceIds: ['e1'], imageBrief: '' },
      { index: 2, visualRole: 'content', purpose: 'solution', question: 'Como o pedido chega?', keyMessage: 'PEDIDO: O pedido chega pelo WhatsApp.', evidenceIds: ['e1'], imageBrief: '' },
      { index: 3, visualRole: 'content', purpose: 'solution', question: 'Do que o pão é feito?', keyMessage: 'PRODUTO: O pão leva farinha, água e sal.', evidenceIds: ['e2'], imageBrief: '' },
      { index: 4, visualRole: 'closing', purpose: 'decision', question: 'Qual é o próximo passo?', keyMessage: 'FECHO: Retirada na padaria.', evidenceIds: [], imageBrief: '' },
    ],
  });
  const config = () => ({
    count: 4, presetId: 'apresentacao', presentationPath: 'pitch', presentationPlanning: true,
    planningContext: { brief: 'Criar apresentação da padaria.', sources },
  });
  const slide = (title, subtitle, extra = {}) => ({ title, subtitle, bodyAfterImage: '', imageQuery: '', speakerNotes: '', ...extra });
  // A redação vem em lotes de três slides: quatro slides são duas chamadas.
  const written = (ai, draft) => ai.mockResolvedValueOnce(plan())
    .mockResolvedValueOnce({ ...draft, slides: draft.slides.slice(0, 3) }).mockResolvedValueOnce({ caption: '', slides: draft.slides.slice(3) });
  const duplicated = () => ({ caption: 'Resumo.', slides: [
    slide('Fermento Lento', 'A padaria vende pão de fermentação natural.'),
    slide('O pedido chega pelo WhatsApp', 'A padaria recebe o pedido pelo WhatsApp.'),
    slide('Pedido recebido pelo WhatsApp', 'O pedido chega à padaria pelo WhatsApp.'),
    slide('Retirada na padaria', 'A retirada é na padaria.'),
  ] });

  it('slide que repete outro com outras palavras entra no reparo de repetição que já existe', async () => {
    const repair = { edits: [{ slideIndex: 2, reason: 'Repetia o slide anterior', title: 'Farinha, água e sal', subtitle: 'O pão leva farinha, água e sal.' }] };
    const ai = written(vi.fn(), duplicated()).mockResolvedValueOnce({ edits: [] }).mockResolvedValueOnce(repair);
    const output = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(ai.mock.calls[4][0]).toContain('REPARO DE REPETIÇÃO');
    expect(ai.mock.calls[4][0]).toMatch(/slideIndex 2 repete o slideIndex 1/);
    expect(output.result.slides[2].title).toBe('Farinha, água e sal');
    expect(output.reviewStatus).toBe('repaired');
  });

  it('se o reparo por IA falha, o slide repetido recebe a contribuição própria do plano', async () => {
    const ai = written(vi.fn(), duplicated()).mockResolvedValueOnce({ edits: [] }).mockRejectedValueOnce(new Error('fora do ar'));
    const output = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(output.result.slides).toHaveLength(4);
    expect(output.result.slides[2]).toMatchObject({ title: 'Do que o pão é feito?', subtitle: 'O pão leva farinha, água e sal.' });
    expect(output.result.slides[1].title).toBe('O pedido chega pelo WhatsApp');
    expect(review.repeatedContentSlides(output.result.slides)).toEqual([]);
    expect(output.reviewStatus).toBe('repaired');
  });

  it('o mesmo bloco de passos não fica em dois slides, mesmo sem a IA', async () => {
    const steps = () => [{ type: 'steps', items: [{ title: 'Pedido pelo WhatsApp', body: '' }, { title: 'Retirada na padaria', body: '' }] }];
    const draft = { caption: 'Resumo.', slides: [
      slide('Fermento Lento', 'A padaria vende pão de fermentação natural.'),
      slide('Como pedir', 'Dois passos.', { presentationBlocks: steps() }),
      slide('Farinha, água e sal', 'O pão leva farinha, água e sal.'),
      slide('Próximo passo', 'Faça o pedido.', { presentationBlocks: steps() }),
    ] };
    const ai = written(vi.fn(), draft).mockResolvedValueOnce({ edits: [] }).mockRejectedValueOnce(new Error('fora do ar'));
    const output = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(ai.mock.calls[4][0]).toContain('REPARO DE REPETIÇÃO');
    expect(ai.mock.calls[4][0]).toMatch(/Mesmo bloco de passos nos slideIndex 1 e 3/);
    expect(output.result.slides[1].presentationBlocks).toEqual(steps());
    expect(output.result.slides[3].presentationBlocks).toEqual([]);
    expect(review.repeatedStepBlockSlides(output.result.slides)).toEqual([]);
  });
});
