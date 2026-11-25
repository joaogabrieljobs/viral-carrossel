// Modo livre de apresentação, fase 2 (docs/product/modo-livre-apresentacao.md):
// roteiro v3 com deckDesign e design por slide, só no preset presentation_free.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_PLAN_FREE_PROMPT_VERSION,
  attachPresentationPlan,
  buildPresentationPlanBlock,
  buildPresentationPlanPrompt,
  coercePresentationPlanShape,
  presentationPlanSchema,
  validatePresentationPlan,
} from '../../src/utils/presentation-plan.js';
import { generatePresentationPlan } from '../../src/utils/presentation-planning.js';
import {
  DEFAULT_DECK_DESIGN, FREE_FAMILY_GUIDE, FREE_FONT_FAMILIES, FREE_ICONS, deckDesignFromBrand,
} from '../../src/utils/free-design.js';
import { FAMILY_KEYS } from '../../src/utils/presentation-families.js';

const h = v => createHash('sha256').update(v).digest('hex').slice(0, 16);
const SRC = [{ id: 's1', title: 'Fonte', text: 'O festival reúne 40 mil pessoas em 12 noites.' }];

/** Roteiro v3 mínimo e válido, com N posições. */
export const planoV3 = (n = 6, designOf = () => null, extra = {}) => ({
  schemaVersion: 3,
  promptVersion: 'presentation-plan-v3',
  objective: 'Apresentar o festival',
  audience: 'Patrocinadores',
  thesis: 'O festival move a cidade',
  rules: [],
  evidence: [{ id: 'e1', status: 'fact', sourceId: 's1', quote: 'O festival reúne 40 mil pessoas em 12 noites.', claim: '40 mil pessoas em 12 noites' }],
  gaps: [],
  deckDesign: {
    palette: { bg: '#F7F3EA', surface: '#E4DCCB', ink: '#1A1712', muted: '#4E4738', accent: '#B4235A', accent2: '#1F4E5F', inverse: '#1A1712', inverseInk: '#F7F3EA' },
    fonts: { display: 'Space Grotesk', text: 'IBM Plex Sans' },
    mood: 'Warm dusk light, saturated magenta accents, crowded streets with motion blur.',
  },
  slides: Array.from({ length: n }, (_, i) => ({
    index: i + 1,
    visualRole: i === 0 ? 'cover' : i === n - 1 ? 'closing' : 'content',
    purpose: i === 0 ? 'introduction' : i === n - 1 ? 'decision' : 'context',
    question: `Pergunta ${i + 1}?`,
    keyMessage: `Mensagem ${i + 1}.`,
    evidenceIds: i === 1 ? ['e1'] : [],
    scene: { subject: `crowd ${i}`, action: 'dancing', setting: 'street', shot: ['wide', 'medium', 'close-up', 'detail', 'overhead', 'aerial'][i % 6] },
    avoid: '',
    ...(designOf(i) ? { design: designOf(i) } : {}),
  })),
  ...extra,
});

describe('modo livre, fase 2: roteiro v2 inalterado para os outros presets', () => {
  it('o pedido v2 é byte a byte o mesmo de antes (hash medido em 6d40332)', () => {
    expect(h(buildPresentationPlanPrompt({ brief: 'Festival', sources: SRC, count: 10, presentationPath: 'auto' }))).toBe('35b81b983596f508');
    expect(h(buildPresentationPlanPrompt({ brief: 'Festival', sources: SRC, count: 8, presentationPath: 'pitch', compactRepair: true }))).toBe('135aebd49994edb4');
  });

  it('o pedido v2 não fala em direção de arte, deckDesign ou design', () => {
    const p = buildPresentationPlanPrompt({ brief: 'Festival', sources: SRC, count: 10 });
    expect(p).not.toMatch(/deckDesign|DIREÇÃO DE ARTE|"design"/);
  });

  it('roteiro v3 só é aceito no modo livre; v2 com campos de design é recusado', () => {
    expect(validatePresentationPlan(planoV3(6), { count: 6, sources: SRC }).valid).toBe(false);
    const v2 = { ...planoV3(6), schemaVersion: 2, promptVersion: 'presentation-plan-v2' };
    expect(validatePresentationPlan(v2, { count: 6, sources: SRC, freeDesign: true }).issues.map(i => i.code)).toContain('unknown_field');
  });
});

describe('modo livre, fase 2: pedido do roteiro v3', () => {
  const p = buildPresentationPlanPrompt({ brief: 'Festival', sources: SRC, count: 10, freeDesign: true });

  it('versão v3 com deckDesign no topo e design por slide no contrato', () => {
    expect(PRESENTATION_PLAN_FREE_PROMPT_VERSION).toBe('presentation-plan-v3');
    expect(p).toContain('presentation-plan-v3');
    expect(p).toMatch(/"schemaVersion":3/);
    expect(p).toMatch(/"deckDesign":\{"palette":\{"bg":/);
    expect(p).toMatch(/"design":\{"family":/);
    for (const key of ['bg', 'surface', 'ink', 'muted', 'accent', 'accent2', 'inverse', 'inverseInk']) expect(p).toContain(`"${key}"`);
  });

  it('pede diversidade de composição como diretor de arte e coerência de paleta e fontes', () => {
    expect(p).toMatch(/diretor de arte/i);
    for (const termo of [/fundo/i, /foto/i, /bloco/i, /família/i, /negrito/i, /coerên/i, /paleta/i, /par de fontes/i]) expect(p).toMatch(termo);
    // Enums fechados da spec.
    expect(p).toMatch(/ground: bg, surface, inverse, accent, photo/);
    expect(p).toMatch(/photo: none, small, half, full/);
    expect(p).toMatch(/block: none, comparison, metrics, steps, quote, bignumber, icons/);
  });

  it('lista as 20 fontes da biblioteca local e as 10 famílias, cada uma com uma linha', () => {
    expect(FREE_FONT_FAMILIES).toHaveLength(20);
    for (const font of FREE_FONT_FAMILIES) expect(p).toContain(font);
    expect(Object.keys(FREE_FAMILY_GUIDE).sort()).toEqual([...FAMILY_KEYS].sort());
    for (const family of FAMILY_KEYS) {
      expect(FREE_FAMILY_GUIDE[family].length, family).toBeGreaterThan(30);
      expect(p).toContain(`- ${family}: ${FREE_FAMILY_GUIDE[family]}`);
    }
    for (const icon of FREE_ICONS) expect(p).toContain(icon);
  });

  it('mesmo limite de saída: o pedido continua compacto', () => {
    const v2 = buildPresentationPlanPrompt({ brief: 'Festival', sources: SRC, count: 10 });
    expect(p.length - v2.length).toBeLessThan(6000);
  });
});

describe('modo livre, fase 2: forma e validação do roteiro v3', () => {
  it('v3 válido passa e guarda deckDesign e design normalizados', () => {
    const plan = planoV3(6, i => ({ family: FAMILY_KEYS[i], ground: 'bg', photo: 'half', block: 'none', emphasis: [], icons: [] }));
    const v = validatePresentationPlan(coercePresentationPlanShape(plan, { count: 6 }), { count: 6, sources: SRC, freeDesign: true });
    expect(v.errors).toEqual([]);
    expect(presentationPlanSchema(v.plan)).toBe(3);
    expect(v.plan.deckDesign.fonts).toEqual({ display: 'Space Grotesk', text: 'IBM Plex Sans' });
    expect(v.plan.deckDesign.palette.accent).toBe('#B4235A');
    expect(v.plan.slides[2].design).toMatchObject({ family: FAMILY_KEYS[2], ground: 'bg', photo: 'half' });
    // Cena, avoid e regras do v2 continuam valendo no v3.
    expect(v.plan.slides[0].scene.subject).toBe('crowd 0');
  });

  it('valor fora do enum, hex inválido e fonte fora da biblioteca são corrigidos sem novo pedido', () => {
    const plan = planoV3(6, i => (i === 1 ? { family: 'cinema', ground: 'dark', photo: 'large', block: 'table', emphasis: ['x'], icons: ['star'] } : null), {
      deckDesign: { palette: { bg: 'creme', accent: '#12', ink: '#111' }, fonts: { display: 'Playfair Display', text: 'Anton' }, mood: '' },
    });
    const v = validatePresentationPlan(coercePresentationPlanShape(plan, { count: 6 }), { count: 6, sources: SRC, freeDesign: true });
    expect(v.errors).toEqual([]);
    // O suporte do bloco depende do texto final: é conferido na composição.
    expect(v.plan.slides[1].design).toMatchObject({ family: 'cinematic', ground: 'inverse', photo: 'half', block: 'comparison', icons: [], emphasis: ['x'] });
    expect(v.plan.deckDesign.palette.bg).toBe(DEFAULT_DECK_DESIGN.palette.bg);
    expect(v.plan.deckDesign.fonts.display).toBe('Fraunces');
    // Anton só serve para título: o texto corrido vai para a fonte de texto mais próxima.
    expect(v.plan.deckDesign.fonts.text).toBe('Space Grotesk');
    expect(v.plan.deckDesign.mood).toBe(DEFAULT_DECK_DESIGN.mood);
  });

  it('design ausente fica null: o diretor determinístico preenche depois', () => {
    const v = validatePresentationPlan(coercePresentationPlanShape(planoV3(6), { count: 6 }), { count: 6, sources: SRC, freeDesign: true });
    expect(v.valid).toBe(true);
    expect(v.plan.slides.every(s => s.design === null)).toBe(true);
    const semDeck = planoV3(6);
    delete semDeck.deckDesign;
    expect(validatePresentationPlan(coercePresentationPlanShape(semDeck, { count: 6 }), { count: 6, sources: SRC, freeDesign: true }).plan.deckDesign).toBe(null);
  });

  it('campo extra no design ou no topo continua recusado', () => {
    const extraTopo = validatePresentationPlan({ ...planoV3(6), layoutHtml: '<div>' }, { count: 6, sources: SRC, freeDesign: true });
    expect(extraTopo.valid).toBe(false);
  });

  it('a redação recebe o design das posições e repete os trechos de negrito', () => {
    const plan = validatePresentationPlan(coercePresentationPlanShape(planoV3(6, i => (i === 1 ? { family: 'editorial', ground: 'bg', photo: 'half', block: 'none', emphasis: ['40 mil'] } : null)), { count: 6 }), { count: 6, sources: SRC, freeDesign: true }).plan;
    const block = buildPresentationPlanBlock(plan);
    expect(block).toMatch(/emphasis/);
    expect(block).toMatch(/literalmente/);
  });
});

describe('modo livre, fase 2: attachPresentationPlan com v3', () => {
  const plan = validatePresentationPlan(coercePresentationPlanShape(planoV3(4, i => [
    { family: 'editorial', ground: 'bg', photo: 'full', block: 'none', emphasis: ['Festival'] },
    { family: 'swiss', ground: 'surface', photo: 'none', block: 'bignumber', emphasis: ['40 mil'] },
    null,
    { family: 'luxury', ground: 'accent', photo: 'small', block: 'none', emphasis: [] },
  ][i]), { count: 4 }), { count: 4, sources: SRC, freeDesign: true }).plan;
  const draft = { slides: [0, 1, 2, 3].map(i => ({ title: i === 1 ? 'Somos 40 mil' : `Festival ${i}`, subtitle: 'Texto', imageQuery: 'x' })) };
  const out = attachPresentationPlan(draft, plan);

  it('design da posição segue com o slide; página photo:none não pede imagem', () => {
    expect(out.slides[0].presentationPlan.design).toMatchObject({ family: 'editorial', photo: 'full' });
    expect(out.slides[0].imageQuery).toBe(plan.slides[0].scene ? 'crowd 0, dancing, street, wide' : '');
    expect(out.slides[1].imageQuery).toBe('');
    expect(out.slides[2].presentationPlan.design).toBe(null);
    expect(out.slides[0].presentationPlan.schemaVersion).toBe(3);
  });

  it('o deck da IA não vai para cada slide (só o design da posição)', () => {
    expect(out.slides[0].presentationPlan.deckDesign).toBeUndefined();
  });
});

describe('modo livre, fase 2: ciclo do roteiro com reparo', () => {
  const resposta = plan => async () => JSON.stringify(plan);

  it('modo livre pede o v3 e aceita a resposta v3', async () => {
    const prompts = [];
    const callAI = async (prompt) => { prompts.push(prompt); return planoV3(6, i => ({ family: FAMILY_KEYS[i], ground: 'bg', photo: 'half', block: 'none' })); };
    const { plan } = await generatePresentationPlan({ brief: 'Festival', sources: SRC, count: 6, freeDesign: true }, callAI);
    expect(prompts[0]).toContain('presentation-plan-v3');
    expect(presentationPlanSchema(plan)).toBe(3);
    expect(plan.deckDesign.fonts.display).toBe('Space Grotesk');
  });

  it('modo livre aceita um roteiro v2 (sem design): o diretor determinístico decide', async () => {
    const v2 = { ...planoV3(6), schemaVersion: 2, promptVersion: 'presentation-plan-v2' };
    delete v2.deckDesign;
    const { plan } = await generatePresentationPlan({ brief: 'Festival', sources: SRC, count: 6, freeDesign: true }, resposta(v2));
    expect(presentationPlanSchema(plan)).toBe(2);
  });

  it('o reparo do modo livre continua pedindo o v3', async () => {
    const prompts = [];
    const callAI = async (prompt) => {
      prompts.push(prompt);
      return prompts.length === 1 ? { ...planoV3(6), slides: [] } : planoV3(6);
    };
    const { plan } = await generatePresentationPlan({ brief: 'Festival', sources: SRC, count: 6, freeDesign: true }, callAI);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('presentation-plan-v3');
    expect(presentationPlanSchema(plan)).toBe(3);
  });

  it('preset comum continua pedindo o v2', async () => {
    const prompts = [];
    const v2 = { ...planoV3(6), schemaVersion: 2, promptVersion: 'presentation-plan-v2' };
    delete v2.deckDesign;
    await generatePresentationPlan({ brief: 'Festival', sources: SRC, count: 6 }, async (prompt) => { prompts.push(prompt); return v2; });
    expect(prompts[0]).toContain('presentation-plan-v2');
    expect(prompts[0]).not.toContain('presentation-plan-v3');
  });
});

describe('modo livre, fase 2: kit com cores sobrepõe o deckDesign da IA', () => {
  it('cores e fontes do kit substituem; a IA completa o resto', () => {
    const ia = planoV3(6).deckDesign;
    const d = deckDesignFromBrand({ bg: '#0D1B2A', accent: '#E0A458', titleColor: '#F4F1DE' }, ia);
    expect(d.palette).toMatchObject({ bg: '#0D1B2A', accent: '#E0A458', ink: '#F4F1DE' });
    expect(d.fonts).toEqual({ display: 'Space Grotesk', text: 'IBM Plex Sans' });
    expect(d.mood).toBe(ia.mood);
    const comFonte = deckDesignFromBrand({ titleFont: '"Inter Tight", sans-serif' }, ia);
    expect(comFonte.fonts.display).toBe('Inter Tight');
    expect(comFonte.palette.accent).toBe('#B4235A');
  });
});

describe('modo livre, fase 2: geração passa o modo livre ao roteiro', () => {
  const source = readFileSync(new URL('../../src/utils/editorial-review.js', import.meta.url), 'utf8');
  it('generatePlannedPresentation repassa freeDesign ao ciclo do roteiro', () => {
    expect(source).toMatch(/generatePresentationPlan\(\{[^}]*freeDesign: config\.freeDesign === true/);
  });
});
