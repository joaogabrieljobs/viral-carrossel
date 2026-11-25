import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { isBriefingNote, stripBriefingNotes } from '../../src/utils/factual-grounding.js';
import * as review from '../../src/utils/editorial-review.js';
import { PRESENTATION_PLAN_PROMPT_VERSION } from '../../src/utils/presentation-plan.js';

// Reteste real de 24/11 (RT24 texto 3), e6085f3. Relatório, slide 8, ainda
// dizia no apoio "…are not described in the offer". Caso, slide 10, tinha como
// título a pergunta "What happens if you don't like the site?", que é a própria
// lacuna listada no aviso de material, com corpo que não responde.
const { projects } = JSON.parse(readFileSync(new URL('../fixtures/rt24-projetos.json', import.meta.url), 'utf8'));
const project = name => projects.find(item => item.name === name);

describe('RT24 texto 3: "not described" é lacuna', () => {
  it('a frase real do Relatório sai e o resto do apoio fica', () => {
    const subtitle = project('A3 Relatorio').slides[7].subtitle;
    expect(subtitle).toContain('are not described in the offer');
    expect(stripBriefingNotes(subtitle)).toBe('Seeing the site before paying reduces upfront risk: you review the finished work and only pay **$797** if you like it. The offer ends Nov 30, 11:59 PM PT, so the window is limited.');
  });

  it.each([
    'Maintenance, hosting, and recurring costs after delivery are not described in the offer.',
    'Delivery time is not described.',
    'Support terms were not outlined in the offer.',
    'The review criteria are not explained in the material.',
    'O prazo de entrega não é descrito na oferta.',
    'Os custos de hospedagem não estão descritos.',
  ])('reconhece: %s', sentence => {
    expect(isBriefingNote(sentence)).toBe(true);
  });

  it.each([
    'Hosting is not included in the $797.',
    'What you see is not a mockup: it is your finished site.',
    'You are not charged before you see the site.',
    'O site não é um modelo pronto: é feito para o seu negócio.',
  ])('fato do cliente continua: %s', sentence => {
    expect(isBriefingNote(sentence)).toBe(false);
  });

  it('nenhuma outra frase visível dos seis projetos reais vira lacuna', () => {
    const flagged = projects.flatMap(item => item.slides.flatMap((slide, index) => ['title', 'subtitle', 'bodyAfterImage']
      .flatMap(field => String(slide[field] || '').split(/\n|(?<=[.!?…])\s+/u).filter(sentence => sentence.trim() && isBriefingNote(sentence))
        .map(sentence => `${item.name} ${index + 1}: ${sentence}`))));
    expect(flagged).toEqual(['A3 Relatorio 8: Maintenance, hosting, and recurring costs after delivery are not described in the offer.']);
  });
});

describe('RT24 texto 3: título que é a pergunta de uma lacuna', () => {
  const caso = project('A4 Caso');
  const withTitle = (item, index, title) => item.slides.map((slide, i) => (i === index ? { ...slide, title } : slide));

  it('Caso real: a pergunta do slide 10 é a lacuna que o plano listou', () => {
    expect(caso.plan.gaps[3]).toMatch(/não gostar do site/);
    expect(review.gapQuestionSlides(withTitle(caso, 9, 'What happens if you don\'t like the site?'), caso.plan)).toEqual([9]);
  });

  it('título que afirma o que o material traz não é lacuna (Caso como ficou salvo)', () => {
    expect(caso.slides[9].title).toBe('You pay only if you like the site');
    expect(review.gapQuestionSlides(caso.slides, caso.plan)).toEqual([]);
  });

  it('pergunta cujo assunto não está nas lacunas fica (Pitch real, mesma pergunta no plano)', () => {
    const pitch = project('A1 Pitch');
    expect(pitch.plan.slides[10].question).toBe('E se eu não gostar do site?');
    expect(review.gapQuestionSlides(withTitle(pitch, 10, 'What if I don\'t like the site?'), pitch.plan)).toEqual([]);
  });

  const sources = [{ id: 'brief', text: 'BLK FROGDAY: we build your new site first, and you only pay when you like it. The site is $797.' }];
  const plan = () => ({
    schemaVersion: 1, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
    objective: 'Apresentar a oferta', audience: 'Negócios locais', thesis: 'Site primeiro, pagamento quando gostar.',
    evidence: [{ id: 'e1', status: 'fact', sourceId: 'brief', quote: 'you only pay when you like it', claim: 'Paga quando gosta.' }],
    gaps: ['Sem detalhes sobre o que acontece se o cliente não gostar do site — se há custo ou obrigação.'],
    slides: [
      { index: 1, visualRole: 'cover', purpose: 'introduction', question: 'Qual é a oferta?', keyMessage: 'Site primeiro.', evidenceIds: ['e1'], imageBrief: '' },
      { index: 2, visualRole: 'content', purpose: 'solution', question: 'E se eu não gostar do site — há obrigação?', keyMessage: 'O material diz que o cliente paga só se gostar.', evidenceIds: ['e1'], imageBrief: '' },
      { index: 3, visualRole: 'closing', purpose: 'decision', question: 'Qual é o próximo passo?', keyMessage: 'Enviar o link.', evidenceIds: [], imageBrief: '' },
    ],
  });
  const config = () => ({ count: 3, presetId: 'apresentacao', presentationPath: 'estudo_de_caso', presentationPlanning: true, planningContext: { brief: 'Create a case deck.', sources } });
  const slide = (title, subtitle) => ({ title, subtitle, bodyAfterImage: '', imageQuery: '', speakerNotes: '' });
  const draft = () => ({ caption: 'BLK FROGDAY.', slides: [
    slide('Your new site is built first', 'You only pay when you like it.'),
    slide('What happens if you don\'t like the site?', 'Confirm terms directly before starting.'),
    slide('The site is $797', 'BLK FROGDAY.'),
  ] });

  it('a geração manda o slide para o reparo de fatos que já existe', async () => {
    const repair = { edits: [{ slideIndex: 1, reason: 'O título era a lacuna', title: 'You pay only if you like the site', subtitle: 'We build your new site first.' }] };
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(draft()).mockResolvedValueOnce({ edits: [] }).mockResolvedValueOnce(repair);
    const output = await review.generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(ai).toHaveBeenCalledTimes(4);
    expect(ai.mock.calls[3][0]).toContain('REPARO DE FATOS');
    expect(ai.mock.calls[3][0]).toContain('What happens if you don\'t like the site?');
    expect(output.result.slides[1].title).toBe('You pay only if you like the site');
    expect(output.violations).toBeUndefined();
  });

  it('se o reparo falha, o título sai e o slide fica marcado', async () => {
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(draft()).mockResolvedValueOnce({ edits: [] }).mockRejectedValueOnce(new Error('fora do ar'));
    const output = await review.generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(output.result.slides[1].title).toBe('');
    expect(output.reviewStatus).toBe('needs_attention');
    expect(output.violations).toContainEqual(expect.objectContaining({ kind: 'missing_title', slideIndex: 1 }));
    expect(output.materialGaps).toEqual(plan().gaps);
  });
});
