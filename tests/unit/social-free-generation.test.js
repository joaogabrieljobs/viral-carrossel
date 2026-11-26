import { describe, expect, it, vi } from 'vitest';
import { generateReviewedCarousel, validateCarouselDraft } from '../../src/utils/editorial-review.js';
import { presentationSceneQuery } from '../../src/utils/presentation-plan.js';

const deckDesign = {
  palette: { bg: '#17364B', surface: '#24536A', ink: '#FFFFFF', muted: '#E0E9EE', accent: '#E6BC65', accent2: '#75BED0', inverse: '#F4F0E7', inverseInk: '#17364B' },
  fonts: { display: 'Open Sans', text: 'Inter' }, mood: 'Quiet workshop with neutral natural light.',
};
const visualDirection = {
  palette: [{ role: 'base', hex: '#17364B' }, { role: 'subject_light', hex: '#E6BC65' }, { role: 'graphic', hex: '#75BED0' }],
  finish: 'Smooth matte colour without grain.', atmosphere: 'Precise and calm.', graphics: 'none', avoid: 'Party scenes and decorative textures.',
};
const texts = [
  ['A oficina encontra a cidade', 'Um espaço para observar processos criativos.'],
  ['O gesto vem primeiro', 'Mãos trabalham argila sobre uma bancada de madeira.'],
  ['Ideias em conversa', 'Cadernos reúnem esboços que orientam novas experiências.'],
  ['Participe da conversa', 'Comente qual processo você gostaria de conhecer.'],
];
const makeDraft = () => ({
  deckDesign, visualDirection, caption: 'Processos criativos em uma oficina aberta.',
  slides: texts.map(([title, subtitle], index) => ({
    title, subtitle, bodyAfterImage: '', imageQuery: `old generic query ${index}`,
    scene: { subject: index === 0 ? 'An adult ceramic artist' : `Workshop scene ${index}`, wardrobe: 'Plain cotton clothing', action: 'Shaping clay', expression: 'Concentrated', setting: 'Open workshop', light: 'Neutral daylight', graphics: 'none', shot: 'medium portrait' },
    avoid: ['Lettering', 'Festival crowds'], eyebrow: index ? '' : 'REMOVE COVER LABEL',
    design: { family: 'editorial', ground: index === 2 ? 'art' : 'photo', photo: index === 2 ? 'none' : 'full', block: 'none', emphasis: [], icons: [] },
  })),
});
const config = { count: 4, presetId: 'livre', densityId: '1_1', narrativeMode: 'storytelling' };
const run = async (draft = makeDraft(), options = {}) => {
  const { responses = [], ...extra } = options;
  const socialFree = Object.hasOwn(options, 'socialFree') ? options.socialFree : { formato: 'carrossel' };
  const ai = vi.fn().mockResolvedValueOnce(draft).mockResolvedValueOnce({ edits: [] });
  responses.forEach(response => response instanceof Error ? ai.mockRejectedValueOnce(response) : ai.mockResolvedValueOnce(response));
  const source = [...texts.flat(), 'Escolha os materiais antes de testar novas formas.', 'Desenhos ajudam a organizar perguntas e possibilidades.'].join('\n');
  const output = await generateReviewedCarousel({ prompt: source, config: { ...config, factualSource: source }, socialFree, ...extra }, ai);
  return { output, ai };
};

describe('Livre social: direção dentro do mesmo pedido editorial', () => {
  it.each(['carrossel', 'quadrado', 'stories'])('escreve texto e direção em uma chamada e expõe socialPlan separado, %s', async formato => {
    const input = makeDraft();
    const { output, ai } = await run(input, { socialFree: { formato } });
    expect(ai).toHaveBeenCalledTimes(2);
    expect(ai.mock.calls[0][0]).toContain('MODO LIVRE SOCIAL');
    expect(ai.mock.calls[0][0]).toContain('deckDesign');
    expect(ai.mock.calls[0][0]).toContain('visualDirection');
    expect(ai.mock.calls[0][0]).toContain('mesmo objeto JSON');
    expect(output.plan).toBeUndefined();
    expect(output.socialPlan).toMatchObject({ version: 1, kind: 'social_free', formato });
    expect(output.socialPlan.cards).toHaveLength(4);
    expect(output.result.slides[0].eyebrow).toBe('');
    expect(output.result.slides.slice(1).every(slide => typeof slide.eyebrow === 'string' && slide.eyebrow.length > 0)).toBe(true);
    expect(output.result.slides[0].socialPlan.scene).toEqual(input.slides[0].scene);
    expect(output.result.slides[0].socialDeckDesign).toEqual(output.socialPlan.deckDesign);
    expect(output.result.slides[0].socialFreeDesign).toEqual(output.result.slides[0].design);
    expect(output.result.slides[0].imageQuery).toBe(presentationSceneQuery(input.slides[0].scene));
    expect(output.result.slides[2].imageQuery).toBe('');
    expect(output.reviewDiagnostics).toContainEqual(expect.objectContaining({ stage: 'repetition', outcome: 'repetition_none' }));
    expect(JSON.parse(JSON.stringify(output.socialPlan))).toEqual(output.socialPlan);
  });

  it('flag false mantém os mesmos bytes dos dois pedidos atuais', async () => {
    const draft = makeDraft();
    const omitted = await run(draft, { socialFree: undefined });
    const disabled = await run(draft, { socialFree: false });
    expect(disabled.ai.mock.calls.map(call => call[0])).toEqual(omitted.ai.mock.calls.map(call => call[0]));
    expect(disabled.output.socialPlan).toBeUndefined();
    expect(disabled.output.reviewDiagnostics).toBeUndefined();
    expect(disabled.output.result.slides[1].eyebrow).toBeUndefined();
  });

  it('preserva eyebrow só com a flag explícita e mantém o catálogo sem esse campo', () => {
    const input = makeDraft();
    input.slides[1].eyebrow = 'A OFICINA';
    expect(validateCarouselDraft(input, { ...config, socialFree: true }).slides[1].eyebrow).toBe('A OFICINA');
    expect(validateCarouselDraft(input, config).slides[1].eyebrow).toBeUndefined();
  });

  it('a marca explícita e o peso da referência chegam ao deck e à imagem', async () => {
    const input = makeDraft();
    input.deckDesign = { ...deckDesign, palette: { ...deckDesign.palette, bg: '#000000' } };
    const referenceColors = [{ hex: '#0E0E0F', weight: 0.48 }, { hex: '#173E68', weight: 0.30 }, { hex: '#E6BC65', weight: 0.12 }, { hex: '#75BED0', weight: 0.10 }];
    const inferred = await run(input, { socialFree: { formato: 'quadrado', referenceColors } });
    expect(inferred.output.socialPlan.deckDesign.palette.bg).toBe('#173E68');
    expect(inferred.output.socialPlan.visualDirection.palette.find(item => item.role === 'base').hex).toBe('#173E68');
    const explicit = await run(input, { socialFree: { formato: 'quadrado', referenceColors, brand: { bg: '#0E0E0F' } } });
    expect(explicit.output.socialPlan.deckDesign.palette.bg).toBe('#0E0E0F');
  });

  it('capa acima de oito palavras recebe reparo editorial sem corte determinístico', async () => {
    const input = makeDraft();
    input.slides[0].title = 'A oficina abre espaço para criar novas ideias em conjunto';
    const { output, ai } = await run(input, { responses: [{ edits: [{ slideIndex: 0, reason: 'Capa com até oito palavras', title: 'A oficina abre novas ideias' }] }] });
    expect(ai).toHaveBeenCalledTimes(3);
    expect(ai.mock.calls[2][0]).toContain('social_free_cover_title');
    expect(output.result.slides[0].title).toBe('A oficina abre novas ideias');
  });

  it('sem cena nem consulta não deixa uma intenção de foto vazia; art mantém scene null', async () => {
    const input = makeDraft();
    input.slides[1].scene = null;
    input.slides[1].imageQuery = '';
    const { output } = await run(input);
    expect(output.result.slides[1].socialFreeDesign.photo).toBe('none');
    expect(output.result.slides[1].socialFreeDesign.ground).not.toBe('photo');
    expect(output.socialPlan.cards[2].scene).toBeNull();
    expect(output.result.slides[2].scene).toBeNull();
  });
});

describe('Livre social: repetição em dois cards e assinatura', () => {
  const phrase = 'Pessoas criativas constroem pontes duradouras entre comunidades diferentes.';
  const repeated = () => {
    const draft = makeDraft();
    draft.slides[1].subtitle = `${phrase} A argila revela o gesto das mãos.`;
    draft.slides[2].subtitle = `${phrase} Cadernos registram desenhos e perguntas.`;
    return draft;
  };

  it('repara frase em dois cards e guarda diagnóstico persistível', async () => {
    const { output, ai } = await run(repeated(), { responses: [{ edits: [{ slideIndex: 2, reason: 'Retirar frase repetida', subtitle: 'Desenhos ajudam a organizar perguntas e possibilidades.' }] }] });
    expect(ai).toHaveBeenCalledTimes(3);
    expect(ai.mock.calls[2][0]).toContain('REPARO DE REPETIÇÃO');
    expect(output.result.slides[2].subtitle).toBe('Desenhos ajudam a organizar perguntas e possibilidades.');
    expect(output.reviewDiagnostics).toContainEqual(expect.objectContaining({ stage: 'repetition', outcome: 'repetition_repaired', sizeAfter: 0 }));
  });

  it('falha de serviço preserva o texto e registra repetição não resolvida', async () => {
    const input = repeated();
    const { output } = await run(input, { responses: [Object.assign(new Error('indisponível'), { status: 503 })] });
    expect(output.result.slides.map(slide => slide.title)).toEqual(input.slides.map(slide => slide.title));
    expect(output.result.slides[2].subtitle).toBe(input.slides[2].subtitle);
    expect(output.reviewDiagnostics).toContainEqual(expect.objectContaining({ stage: 'repetition', outcome: 'repetition_request_failed', status: 503 }));
    expect(output.issues).toContainEqual(expect.objectContaining({ code: 'repetition_remaining' }));
    expect(JSON.parse(JSON.stringify(output.reviewDiagnostics))).toEqual(output.reviewDiagnostics);
  });

  it('corrigir a capa não registra como resolvida uma repetição que permanece no miolo', async () => {
    const input = repeated();
    input.slides[0].title = 'A oficina abre espaço para criar novas ideias em conjunto';
    const { output } = await run(input, { responses: [{ edits: [{ slideIndex: 0, reason: 'Capa com até oito palavras', title: 'A oficina abre novas ideias' }] }] });
    expect(output.result.slides[0].title).toBe('A oficina abre novas ideias');
    const diagnostic = output.reviewDiagnostics.find(item => item.stage === 'repetition');
    expect(diagnostic.outcome).toBe('repetition_not_improved');
    expect(diagnostic.sizeAfter).toBe(diagnostic.sizeBefore);
    expect(diagnostic.sizeAfter).toBeGreaterThan(0);
    expect(output.issues).toContainEqual(expect.objectContaining({ code: 'repetition_remaining' }));
  });

  it('reparo que tenta editar design é resposta inválida, não falha da chamada', async () => {
    const input = repeated();
    const { output } = await run(input, { responses: [{ edits: [{ slideIndex: 2, reason: 'Trocar layout', design: { family: 'cinematic' } }] }] });
    expect(output.reviewDiagnostics).toContainEqual(expect.objectContaining({ outcome: 'repetition_invalid_response' }));
    expect(output.result.slides[2].socialFreeDesign.family).toBe('editorial');
    expect(output.result.slides[2].subtitle).toBe(input.slides[2].subtitle);
  });

  it('reparo fora dos cards repetidos fica recusado com diagnóstico específico', async () => {
    const input = repeated();
    const { output } = await run(input, { responses: [{ edits: [{ slideIndex: 0, reason: 'Editar capa fora do reparo', title: 'Uma mudança indevida' }] }] });
    expect(output.reviewDiagnostics).toContainEqual(expect.objectContaining({ outcome: 'repetition_out_of_scope', outOfScope: [0] }));
    expect(output.result.slides[0].title).toBe(input.slides[0].title);
  });

  it('a revisão não apaga a assinatura já escrita na capa e no fecho', async () => {
    const input = makeDraft();
    input.signature = phrase;
    input.slides[0].subtitle = phrase;
    input.slides[3].subtitle = `${phrase} Comente sua ideia.`;
    const ai = vi.fn().mockResolvedValueOnce(input).mockResolvedValueOnce({ edits: [
      { slideIndex: 0, reason: 'Retirar assinatura', subtitle: '' },
      { slideIndex: 3, reason: 'Retirar assinatura', subtitle: 'Comente sua ideia.' },
    ] });
    const output = await generateReviewedCarousel({ prompt: 'Uma oficina aberta.', config, socialFree: { formato: 'carrossel' } }, ai);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(output.result.slides[0].subtitle).toBe(phrase);
    expect(output.result.slides[3].subtitle).toBe(input.slides[3].subtitle);
  });

  it('assinatura literal na capa e no fecho fica fora da contagem, mas não libera o miolo', async () => {
    const draft = makeDraft();
    draft.signature = phrase;
    draft.slides[0].subtitle = phrase;
    draft.slides[3].subtitle = `${phrase} Comente sua ideia.`;
    const { output, ai } = await run(draft);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(output.socialPlan.signature).toBe(phrase);
    expect(output.result.slides[0].subtitle).toBe(phrase);
    expect(output.reviewDiagnostics).toContainEqual(expect.objectContaining({ outcome: 'repetition_none' }));
    const middle = structuredClone(draft);
    middle.slides[1].subtitle = phrase;
    middle.slides[2].subtitle = phrase;
    const blocked = await run(middle, { responses: [{ edits: [] }] });
    expect(blocked.ai).toHaveBeenCalledTimes(3);
    expect(blocked.output.reviewDiagnostics).toContainEqual(expect.objectContaining({ outcome: 'repetition_not_improved' }));
  });
});
