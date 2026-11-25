import { describe, expect, it, vi } from 'vitest';
import * as grounding from '../../src/utils/factual-grounding.js';
import { generateReviewedCarousel } from '../../src/utils/editorial-review.js';
import { PRESENTATION_FIELD_GROUNDING_RULES } from '../../src/utils/presentation-content.js';
import { PRESENTATION_PLAN_PROMPT_VERSION } from '../../src/utils/presentation-plan.js';

const { auditDraftFactuality, buildFactualGroundingPrompt, buildReviewFactCheckPrompt } = grounding;

// QA 24/11 (texto 8), produção dd6f657, briefing em inglês (BLK FROGDAY): as
// apresentações trouxeram tabelas comparando a oferta com "Typical upfront
// engagement" e com o "old model". O briefing não fala de mercado, de outras
// agências nem de um modelo anterior.
const brief = 'Black Frog builds websites for local businesses in San Diego. BLK FROGDAY, Nov 23 to 30: we build your new site first, and you only pay when you like it. The site is $797, and this week a new logo (or a refresh of yours) is included.';
const CATEGORY = 'comparação com o mercado sem fonte';
const audit = (text, factualSource = brief) => auditDraftFactuality(
  { slides: [{ title: 'Offer', subtitle: text, bodyAfterImage: '' }] },
  { count: 1, presetId: 'apresentacao', factualSource, currentYear: 2026 },
).filter(issue => issue.category === CATEGORY);

describe('QA 24/11 texto 8: comparação com o mercado que o material não traz', () => {
  it.each([
    'Typical upfront engagement',
    'Old model',
    'Unlike other agencies, we build first.',
    'The traditional agency model asks for a deposit.',
    'Better than the industry standard.',
    'Your competitors already have a site.',
    'Compared to the market, the risk is on us.',
    'Diferente das outras agências, o site vem primeiro.',
    'No modelo antigo, você pagava antes de ver.',
    'Abaixo da média do mercado.',
    'Agência tradicional cobra entrada.',
    'A concorrência cobra antes de entregar.',
    'Um contrato típico pede sinal.',
  ])('marca: %s', text => {
    expect(audit(text)).toHaveLength(1);
    expect(audit(text)[0]).toMatchObject({ slideIndex: 0, field: 'subtitle', category: CATEGORY });
  });

  it.each([
    'We build your new site first.',
    'Old site or no site, we build the new one first.',
    'You only pay when you like it.',
    'A new model for local businesses.',
    'Compare the three templates before you choose.',
    'O mercado de San Diego é o foco.',
    'Feito para o comércio do bairro.',
    'Antes e depois: o site novo entra no ar primeiro.',
  ])('não marca fala do cliente: %s', text => {
    expect(audit(text)).toEqual([]);
  });

  it('não marca a comparação que o material traz', () => {
    const comMercado = `${brief} Most agencies ask for 50% upfront before any work starts.`;
    expect(audit('Typical upfront engagement', comMercado)).toEqual([]);
    expect(audit('Other agencies ask for a deposit first.', comMercado)).toEqual([]);
    expect(audit('A agência tradicional cobra entrada.', 'Agências tradicionais cobram 50% de entrada. Aqui você só paga quando gosta.')).toEqual([]);
  });

  it('não marca o antes e depois do próprio cliente quando o material descreve o antes', () => {
    expect(audit('The old way: orders by phone. Now: WhatsApp.', 'Until 2024 the bakery took orders by phone. Since 2025 orders come through WhatsApp.')).toEqual([]);
    expect(audit('No modelo antigo o pedido vinha por telefone.', 'Antes a padaria recebia pedidos por telefone. Agora o pedido chega pelo WhatsApp.')).toEqual([]);
  });

  it('o antes do cliente não libera comparação com terceiros', () => {
    expect(audit('Unlike other agencies, orders arrive by WhatsApp.', 'Until 2024 the bakery took orders by phone. Since 2025 orders come through WhatsApp.')).toHaveLength(1);
  });
});

describe('QA 24/11 texto 8: tabela de comparação inventada na apresentação', () => {
  const sources = [{ id: 'brief', text: brief }];
  const plan = () => ({
    schemaVersion: 1, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
    objective: 'Sell the BLK FROGDAY website', audience: 'Local businesses', thesis: 'New site first, payment when you like it.',
    evidence: [{ id: 'e1', status: 'fact', sourceId: 'brief', quote: 'you only pay when you like it', claim: 'Payment on approval.' }],
    gaps: [],
    slides: [
      { index: 1, visualRole: 'cover', purpose: 'introduction', question: 'What is the offer?', keyMessage: 'New site first.', evidenceIds: ['e1'], imageBrief: '' },
      { index: 2, visualRole: 'data', purpose: 'business_model', question: 'How does payment work?', keyMessage: 'You pay when you like it.', evidenceIds: ['e1'], imageBrief: '' },
      { index: 3, visualRole: 'closing', purpose: 'decision', question: 'What is next?', keyMessage: 'Book this week.', evidenceIds: [], imageBrief: '' },
    ],
  });
  const config = () => ({
    count: 3, presetId: 'apresentacao', presentationPath: 'pitch', presentationPlanning: true,
    planningContext: { brief: 'Create a pitch for BLK FROGDAY.', sources },
  });
  const slide = (title, subtitle, extra = {}) => ({ title, subtitle, bodyAfterImage: '', imageQuery: '', speakerNotes: '', ...extra });
  const invented = [{ type: 'comparison', headers: ['Item', 'BLK FROGDAY', 'Typical upfront engagement'], rows: [['Payment', 'When you like the site', 'Before work starts'], ['Approach', 'Site first', 'Old model']] }];
  const draft = () => ({ caption: 'BLK FROGDAY.', slides: [
    slide('New site first', 'You only pay when you like it.'),
    slide('Payment comes after the site', 'The site is $797.', { presentationBlocks: invented }),
    slide('Book this week', 'BLK FROGDAY runs Nov 23 to 30.'),
  ] });

  it('cabeçalho e célula inventados vão para o reparo de fatos, que troca a tabela', async () => {
    const supported = [{ type: 'steps', items: [{ title: 'We build your new site', body: '' }, { title: 'You pay when you like it', body: 'The site is $797.' }] }];
    const repair = { edits: [{ slideIndex: 1, reason: 'Comparação com o mercado sem fonte', presentationBlocks: supported }] };
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(draft()).mockResolvedValueOnce({ edits: [] }).mockResolvedValueOnce(repair);
    const output = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(ai.mock.calls[3][0]).toContain('REPARO DE FATOS');
    expect(ai.mock.calls[3][0]).toContain('typical upfront engagement');
    expect(ai.mock.calls[3][0]).toContain('old model');
    expect(output.result.slides[1].presentationBlocks).toEqual(supported);
    expect(output.reviewStatus).toBe('repaired');
    expect(output.violations).toBeUndefined();
  });

  it('se o reparo falha, a tabela fica marcada para conferência', async () => {
    const ai = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValueOnce(draft()).mockResolvedValueOnce({ edits: [] }).mockRejectedValueOnce(new Error('fora do ar'));
    const output = await generateReviewedCarousel({ prompt: 'Material.', config: config() }, ai);
    expect(output.reviewStatus).toBe('needs_attention');
    expect(output.violations.filter(issue => issue.category === CATEGORY).map(issue => [issue.slideIndex, issue.claim]))
      .toEqual([[1, 'typical upfront engagement'], [1, 'old model']]);
  });
});

describe('QA 24/11 texto 8: o pedido ao modelo proíbe a comparação inventada', () => {
  it('a regra vai no pedido de fatos do carrossel, na apresentação e na checagem da revisão', () => {
    expect(grounding.MARKET_COMPARISON_RULE).toMatch(/Typical upfront engagement/);
    expect(grounding.MARKET_COMPARISON_RULE).toMatch(/modelo antigo/);
    expect(buildFactualGroundingPrompt({ factualSource: brief })).toContain(grounding.MARKET_COMPARISON_RULE);
    expect(PRESENTATION_FIELD_GROUNDING_RULES).toContain(`- ${grounding.MARKET_COMPARISON_RULE}`);
    expect(buildReviewFactCheckPrompt()).toContain('- comparação com o mercado, concorrentes ou um "modelo antigo" que o material não descreve, inclusive em coluna ou linha de tabela ("typical upfront engagement", "old model", "agência tradicional", "média do mercado").');
  });
});
