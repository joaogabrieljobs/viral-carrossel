import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as grounding from '../../src/utils/factual-grounding.js';
import { generateReviewedCarousel } from '../../src/utils/editorial-review.js';
import { PRESENTATION_FIELD_GROUNDING_RULES } from '../../src/utils/presentation-content.js';
import { buildPresentationPlanBlock, PRESENTATION_PLAN_PROMPT_VERSION } from '../../src/utils/presentation-plan.js';
import { buildResearchUserPrompt } from '../../src/utils/research-prompts.js';

const { isBriefingNote, stripBriefingNotes } = grounding;

// QA 24/11 (texto 1), produção dd6f657, briefing em inglês (BLK FROGDAY): a
// lacuna do briefing virou slide em Pitch 6 e 10, Proposta 8 e 10, Relatório 7
// e Caso 3, 9 e 10 ("no prior … documented", "unspecified", "cannot be
// evaluated", "available evidence"). A lacuna vai para o aviso de material.
describe('QA 24/11 texto 1: lacuna do briefing não é texto de slide', () => {
  it.each([
    'No prior results documented.',
    'No prior client results were documented.',
    'No previous campaigns have been documented for this offer.',
    'Timeline: unspecified.',
    'Hosting and maintenance terms remain unspecified.',
    'Return on investment cannot be evaluated.',
    'Performance against competitors cannot be assessed without baseline data.',
    'The available evidence does not show prior demand.',
    'Insufficient data to compare with the old model.',
    'It is not possible to evaluate retention yet.',
    'Nenhum resultado anterior documentado.',
    'Sem resultados anteriores documentados.',
    'O retorno não pode ser avaliado.',
    'Não é possível avaliar o retorno sem dados de base.',
    'As evidências disponíveis não mostram demanda anterior.',
    'Dados insuficientes para comparar com o modelo antigo.',
    'Não há dimensionamento de mercado ou perfil detalhado de cliente ideal.',
    'Oferta em curso, sem métricas anteriores informadas',
    'No data on conversion is available.',
    'Not specified',
  ])('reconhece como lacuna: %s', sentence => {
    expect(isBriefingNote(sentence)).toBe(true);
  });

  it.each([
    'No payment until you see the finished site.',
    'No setup fees. No contracts.',
    'More information available at blkfrog.com/brief.',
    'Every step is documented in your dashboard.',
    'You cannot be charged before you approve the site.',
    'We can’t start without your logo.',
    'Evidence of your work goes on the homepage.',
    'Spots are available until Nov 30.',
    'Não dá para comparar com o pão de mercado.',
    'Nenhum pedido fica sem resposta.',
    'Sem taxa de adesão.',
    'Os pães estão disponíveis de terça a domingo.',
    'Contrato por tempo indefinido.',
    'Não é possível retirar depois das 13h.',
    'Cada etapa fica documentada no seu painel.',
    'Nenhum valor é cobrado sem ser informado antes.',
    'Sem surpresas, tudo detalhado na proposta.',
    'No previous site, no problem, templates available for three segments.',
    'No data is shared with third parties.',
    'Rush delivery? Not available.',
  ])('fato do cliente continua no slide: %s', sentence => {
    expect(isBriefingNote(sentence)).toBe(false);
  });

  it('tira a frase da lacuna e preserva o fato ao lado', () => {
    expect(stripBriefingNotes('The site costs $797. No prior results documented.')).toBe('The site costs $797.');
    expect(stripBriefingNotes('O site custa US$ 797. O retorno não pode ser avaliado.')).toBe('O site custa US$ 797.');
  });

  it('tira só a ressalva de abertura e preserva a afirmação', () => {
    expect(stripBriefingNotes('Based on the available evidence, the offer targets small businesses.')).toBe('The offer targets small businesses.');
    expect(stripBriefingNotes('Com base nas informações disponíveis, a oferta atende pequenos negócios.')).toBe('A oferta atende pequenos negócios.');
  });

  it('devolve as lacunas tiradas, para o aviso de material', () => {
    expect(grounding.splitBriefingNotes('The site costs $797. No prior results documented.'))
      .toEqual({ text: 'The site costs $797.', notes: ['No prior results documented.'] });
    expect(grounding.splitBriefingNotes('The site costs $797.')).toEqual({ text: 'The site costs $797.', notes: [] });
  });

  it('o aviso de material cita a lacuna fora do slide e some quando não há lacuna', () => {
    const notice = grounding.materialGapNotice(['No prior results documented.', 'No prior results documented.', 'Hosting terms are not defined']);
    expect(notice).toContain('No prior results documented');
    expect(notice).toContain('Hosting terms are not defined');
    expect(notice.match(/No prior results documented/g)).toHaveLength(1);
    expect(notice).toMatch(/fora do texto/);
    expect(notice).not.toMatch(/—/);
    expect(grounding.materialGapNotice([])).toBe('');
    expect(grounding.materialGapNotice(undefined)).toBe('');
  });
});

describe('QA 24/11 texto 1: a geração manda a lacuna para o aviso de material', () => {
  const sources = [{ id: 'brief', text: 'BLK FROGDAY: a website for $797. You only pay when you like it. Offer valid through Nov 30.' }];
  const plan = () => ({
    schemaVersion: 1, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
    objective: 'Sell the BLK FROGDAY website', audience: 'Small businesses', thesis: 'A website for $797, paid on approval.',
    evidence: [{ id: 'e1', status: 'fact', sourceId: 'brief', quote: 'You only pay when you like it.', claim: 'Payment on approval.' }],
    gaps: ['Hosting terms after delivery'],
    slides: [
      { index: 1, visualRole: 'cover', purpose: 'introduction', question: 'What is the offer?', keyMessage: 'A website for $797.', evidenceIds: ['e1'], imageBrief: '' },
      { index: 2, visualRole: 'data', purpose: 'business_model', question: 'How does payment work?', keyMessage: 'You pay on approval.', evidenceIds: ['e1'], imageBrief: '' },
      { index: 3, visualRole: 'closing', purpose: 'decision', question: 'What is next?', keyMessage: 'Book before Nov 30.', evidenceIds: [], imageBrief: '' },
    ],
  });
  const config = () => ({
    count: 3, presetId: 'apresentacao', presentationPath: 'pitch', presentationPlanning: true,
    planningContext: { brief: 'Create a pitch for BLK FROGDAY.', sources },
  });
  const slide = (title, subtitle, extra = {}) => ({ title, subtitle, bodyAfterImage: '', imageQuery: '', speakerNotes: '', ...extra });

  it('frase e célula de lacuna saem do slide e chegam em materialGaps, junto com as lacunas do plano', async () => {
    const draft = { caption: 'BLK FROGDAY.', slides: [
      slide('A website for $797', 'You only pay when you like it.'),
      slide('You pay on approval', 'Payment happens when you like the site. No prior results documented.', { presentationBlocks: [{ type: 'comparison', headers: ['Item', 'Condition'], rows: [['Price', '$797'], ['Hosting', 'Unspecified']] }] }),
      slide('Book before Nov 30', 'Offer valid through Nov 30.'),
    ] };
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(draft).mockResolvedValueOnce({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(ai).toHaveBeenCalledTimes(3);
    expect(output.result.slides[1].subtitle).toBe('Payment happens when you like the site.');
    expect(output.result.slides[1].presentationBlocks).toEqual([{ type: 'comparison', headers: ['Item', 'Condition'], rows: [['Price', '$797']] }]);
    expect(output.materialGaps).toEqual(['Hosting terms after delivery', 'No prior results documented.', 'Hosting: Unspecified']);
    expect(JSON.stringify(output.result.slides)).not.toMatch(/documented|unspecified/i);
  });

  it('slide cujo título é a lacuna vai para o reparo por IA que já existe; se o reparo falha, o slide fica marcado', async () => {
    const draft = { caption: 'BLK FROGDAY.', slides: [
      slide('A website for $797', 'You only pay when you like it.'),
      slide('No prior results documented', 'Client outcomes cannot be evaluated.'),
      slide('Book before Nov 30', 'Offer valid through Nov 30.'),
    ] };
    const repair = { edits: [{ slideIndex: 1, reason: 'Slide comentava dado ausente', title: 'You pay on approval', subtitle: 'You only pay when you like it.' }] };
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(draft).mockResolvedValueOnce({ edits: [] }).mockResolvedValueOnce(repair);
    const output = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(ai.mock.calls[3][0]).toContain('REPARO DE FATOS');
    expect(ai.mock.calls[3][0]).toContain('No prior results documented');
    expect(output.result.slides[1].title).toBe('You pay on approval');
    expect(output.materialGaps).toEqual(['Hosting terms after delivery']);

    const failing = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(draft).mockResolvedValueOnce({ edits: [] }).mockRejectedValueOnce(new Error('fora do ar'));
    const kept = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, failing);
    expect(kept.result.slides[1].title).toBe('');
    expect(kept.reviewStatus).toBe('needs_attention');
    expect(kept.violations).toContainEqual(expect.objectContaining({ kind: 'missing_title', slideIndex: 1 }));
    expect(kept.materialGaps).toEqual(['Hosting terms after delivery', 'No prior results documented', 'Client outcomes cannot be evaluated.']);
  });

  it('carrossel: a lacuna que a revisão deixou no card chega em materialGaps', async () => {
    const cards = { caption: 'Legenda.', slides: [
      { title: 'Site por US$ 797', subtitle: 'Você só paga quando gosta.', imageQuery: '' },
      { title: 'Pagamento na aprovação', subtitle: 'O pagamento acontece quando você aprova. Nenhum resultado anterior documentado.', imageQuery: '' },
    ] };
    const ai = vi.fn().mockResolvedValueOnce(cards).mockResolvedValueOnce({ edits: [] });
    const output = await generateReviewedCarousel({ prompt: 'Material.', config: { count: 2, presetId: 'livre', densityId: '1_1', factualSource: 'Site por US$ 797. Você só paga quando gosta.' } }, ai);
    expect(output.materialGaps).toEqual(['Nenhum resultado anterior documentado.']);
  });

  it('o editor junta as lacunas ao aviso de material do projeto', () => {
    const source = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
    // RT24 (texto 1): o aviso de repetição entra na mesma lista.
    expect(source).toMatch(/materialNotice: \[pathMaterialNotice, materialGapNotice\(materialGaps\), repetitionNotice\]\.filter\(Boolean\)\.join\(' '\)/);
  });
});

describe('QA 24/11 texto 1: o pedido ao modelo manda a lacuna para fora do slide', () => {
  it('a regra de fidelidade da apresentação proíbe a lacuna no texto visível', () => {
    expect(PRESENTATION_FIELD_GROUNDING_RULES).toContain(grounding.PRESENTATION_GAP_RULE);
    expect(grounding.PRESENTATION_GAP_RULE).toMatch(/cannot be evaluated/);
    expect(grounding.PRESENTATION_GAP_RULE).toMatch(/gaps/);
  });

  it('o contrato da redação diz que as lacunas do plano aparecem fora do slide', () => {
    const block = buildPresentationPlanBlock({ slides: [], gaps: ['Hosting terms'] });
    expect(block).toContain('As lacunas (gaps) são mostradas à pessoa fora do slide, no aviso sobre o material: nunca as escreva em título, apoio ou bloco.');
  });

  it('a pesquisa de apresentação manda a lacuna para o campo de aviso', () => {
    const prompt = buildResearchUserPrompt({ niche: 'sites', productKind: 'apresentacao', creativePreset: 'apresentacao', presentationPath: 'pitch' });
    expect(prompt).not.toContain('Identifique claramente hipóteses e lacunas.');
    expect(prompt).toContain('Identifique claramente as hipóteses. O que falta fica só no campo warning, nunca em título, ângulo, evidência ou abertura.');
  });
});
