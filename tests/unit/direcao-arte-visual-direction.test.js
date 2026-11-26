// Direção de arte das imagens (docs/product/direcao-de-arte-imagens.md), parte 1:
// visualDirection no roteiro (v2 e v3), uma vez por deck, opcional e
// retrocompatível. O código valida enums e hex, dá prioridade às cores do kit
// e, no modo livre, alinha a paleta da imagem com deckDesign.palette.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_PLAN_PROMPT_VERSION, PRESENTATION_PLAN_SCHEMA_VERSION,
  attachPresentationPlan, buildPresentationPlanPrompt, coercePresentationPlanShape, validatePresentationPlan,
} from '../../src/utils/presentation-plan.js';
import {
  VISUAL_DIRECTION_ROLES, alignVisualDirectionWithDeck, applyKitColors, coerceVisualDirection,
  composeVisualDirectionBlock, isValidVisualDirection, kitVisualColors, resolveSlideVisualDirection,
  visualDirectionFromDeckDesign,
} from '../../src/utils/visual-direction.js';
import { composeImageDirection } from '../../src/utils/image-direction.js';
import { buildImagePrompt } from '../../shared/image-prompt.js';
import { normalizeDeckDesign } from '../../src/utils/free-design.js';

const SRC = [{ id: 's1', title: 'Fonte', text: 'O festival reúne 40 mil pessoas em 12 noites.' }];

// Inspirada na referência do ChatGPT (docs/product/referencia-prompts-chatgpt-apoteose.md).
const APOTEOSE_VISUAL_DIRECTION = Object.freeze(JSON.parse(readFileSync(new URL('../fixtures/apoteose-direcao-arte.json', import.meta.url), 'utf8')).visualDirection);

const planoV2 = (extra = {}) => ({
  schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION,
  promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
  objective: 'Apresentar o festival', audience: 'Patrocinadores', thesis: 'O festival move a cidade',
  rules: [], evidence: [{ id: 'e1', status: 'fact', sourceId: 's1', quote: 'O festival reúne 40 mil pessoas em 12 noites.', claim: '40 mil pessoas' }],
  gaps: [], signature: '',
  slides: [0, 1, 2].map(i => ({
    index: i + 1, visualRole: i === 0 ? 'cover' : i === 2 ? 'closing' : 'content', purpose: i === 0 ? 'introduction' : i === 2 ? 'decision' : 'context',
    question: `Pergunta ${i + 1}?`, keyMessage: `Mensagem ${i + 1}.`, evidenceIds: i === 1 ? ['e1'] : [],
    scene: { subject: `crowd ${i}`, action: 'dancing', setting: 'street', shot: ['wide', 'medium', 'close-up'][i] }, avoid: '',
  })),
  ...extra,
});

describe('visualDirection: forma, coerção e validação', () => {
  it('papéis fechados', () => {
    expect(VISUAL_DIRECTION_ROLES).toEqual(['base', 'subject_light', 'shadow', 'graphic', 'accent']);
  });

  it('a referência da Apoteose é válida como está', () => {
    expect(isValidVisualDirection(structuredClone(APOTEOSE_VISUAL_DIRECTION))).toBe(true);
    expect(coerceVisualDirection(structuredClone(APOTEOSE_VISUAL_DIRECTION))).toEqual(APOTEOSE_VISUAL_DIRECTION);
  });

  it('coerção: hex em maiúsculas (#abc vira #AABBCC), item fora do enum ou com hex inválido sai, papel duplicado com o mesmo hex sai', () => {
    const value = coerceVisualDirection({
      palette: [
        { role: 'base', hex: '#171344' }, { role: 'base', hex: '#171344' },
        { role: 'subject_light', hex: 'ff6a1a' }, { role: 'glow', hex: '#FFFFFF' },
        { role: 'shadow', hex: '#b17' }, { role: 'graphic', hex: 'cyan' },
      ],
      finish: '  grain  ', atmosphere: 42, graphics: 'NONE', avoid: '',
    });
    expect(value.palette).toEqual([{ role: 'base', hex: '#171344' }, { role: 'subject_light', hex: '#FF6A1A' }, { role: 'shadow', hex: '#BB1177' }]);
    expect(value).toMatchObject({ finish: 'grain', atmosphere: '', graphics: 'none', avoid: '' });
    expect(isValidVisualDirection(value)).toBe(true);
  });

  it('coerção: menos de 3 cores válidas → null; mais de 6 → as 6 primeiras; textos longos cortados em fim de palavra', () => {
    expect(coerceVisualDirection({ palette: [{ role: 'base', hex: '#000000' }, { role: 'accent', hex: '#FF0000' }] })).toBeNull();
    expect(coerceVisualDirection('paleta índigo')).toBeNull();
    const many = coerceVisualDirection({ palette: Array.from({ length: 8 }, (_, i) => ({ role: VISUAL_DIRECTION_ROLES[i % 5], hex: `#00000${i}` })), finish: 'grain '.repeat(80) });
    expect(many.palette).toHaveLength(6);
    expect(many.finish.length).toBeLessThanOrEqual(240);
    expect(many.finish.endsWith(' ')).toBe(false);
  });

  it('validação estrita: chave extra, role fora do enum, hex sem # ou paleta curta são inválidos', () => {
    const ok = structuredClone(APOTEOSE_VISUAL_DIRECTION);
    expect(isValidVisualDirection({ ...ok, mood: 'x' })).toBe(false);
    expect(isValidVisualDirection({ ...ok, palette: [...ok.palette.slice(0, 4), { role: 'glow', hex: '#FFFFFF' }] })).toBe(false);
    expect(isValidVisualDirection({ ...ok, palette: [...ok.palette.slice(0, 4), { role: 'accent', hex: '60EC2E' }] })).toBe(false);
    expect(isValidVisualDirection({ ...ok, palette: ok.palette.slice(0, 2) })).toBe(false);
    expect(isValidVisualDirection({ ...ok, finish: 'x'.repeat(241) })).toBe(false);
  });
});

describe('visualDirection no roteiro v2 e v3', () => {
  it('o pedido do roteiro v2 e v3 pede visualDirection a partir do briefing, do estilo e das cores do kit', () => {
    for (const freeDesign of [false, true]) {
      const prompt = buildPresentationPlanPrompt({ brief: 'Festa', sources: SRC, count: 6, freeDesign });
      expect(prompt).toContain('DIREÇÃO VISUAL DO DECK');
      expect(prompt).toContain('"visualDirection":{"palette":[{"role":"base","hex":"#RRGGBB"}');
      expect(prompt).toContain('base, subject_light, shadow, graphic, accent');
      expect(prompt).toContain('proponha uma paleta coerente com o briefing');
    }
    expect(buildPresentationPlanPrompt({ brief: 'Festa', sources: SRC, count: 6, freeDesign: true })).toContain('base é o bg de deckDesign.palette');
  });

  it('cores do kit entram no pedido; referência sem descrição: a IA não inventa a cor dela', () => {
    const withColors = buildPresentationPlanPrompt({ brief: 'Festa', sources: SRC, count: 6, kitColors: ['#171344', '#FF6A1A'] });
    expect(withColors).toContain('Cores do kit (use exatamente estes hex): #171344, #FF6A1A.');
    const refOnly = buildPresentationPlanPrompt({ brief: 'Festa', sources: SRC, count: 6, kitReferenceWithoutText: true });
    expect(refOnly).toContain('O kit tem imagem de referência que você não vê');
    expect(refOnly).not.toContain('Cores do kit (use exatamente');
  });

  it('plano v2 com visualDirection é válido e o roteiro a guarda; sem ela, nenhuma chave nova', () => {
    const plain = validatePresentationPlan(coercePresentationPlanShape(planoV2(), { count: 3 }), { count: 3, sources: SRC });
    expect(plain.valid).toBe(true);
    expect(plain.plan).not.toHaveProperty('visualDirection');
    const withVd = validatePresentationPlan(coercePresentationPlanShape(planoV2({ visualDirection: structuredClone(APOTEOSE_VISUAL_DIRECTION) }), { count: 3 }), { count: 3, sources: SRC });
    expect(withVd.errors).toEqual([]);
    expect(withVd.plan.visualDirection).toEqual(APOTEOSE_VISUAL_DIRECTION);
  });

  it('visualDirection inválida: o coerce corrige ou tira; sem coerce, a validação recusa', () => {
    const broken = planoV2({ visualDirection: { palette: [{ role: 'base', hex: '#171344' }], finish: 'grain' } });
    const coerced = coercePresentationPlanShape(structuredClone(broken), { count: 3 });
    expect(coerced.visualDirection).toBeNull();
    const result = validatePresentationPlan(coerced, { count: 3, sources: SRC });
    expect(result.valid).toBe(true);
    expect(result.plan).not.toHaveProperty('visualDirection');
    expect(validatePresentationPlan(broken, { count: 3, sources: SRC }).issues).toContainEqual({ code: 'visual_direction', path: 'visualDirection' });
  });

  it('attachPresentationPlan leva a direção visual a cada slide (vale ao refazer uma imagem)', () => {
    const { plan } = validatePresentationPlan(planoV2({ visualDirection: structuredClone(APOTEOSE_VISUAL_DIRECTION) }), { count: 3, sources: SRC });
    const draft = attachPresentationPlan({ slides: [{ title: 'a' }, { title: 'b' }, { title: 'c' }] }, plan);
    expect(draft.slides.map(slide => slide.presentationPlan.visualDirection)).toEqual([0, 1, 2].map(() => APOTEOSE_VISUAL_DIRECTION));
    const { plan: semVd } = validatePresentationPlan(planoV2(), { count: 3, sources: SRC });
    expect(attachPresentationPlan({ slides: [{}, {}, {}] }, semVd).slides[0].presentationPlan).not.toHaveProperty('visualDirection');
  });
});

describe('prioridade do kit (o código sobrepõe)', () => {
  it('cores rotuladas do kit: fundo vira base, destaque vira accent', () => {
    const kit = { contextMd: 'Fundo: #0D1B2A\nDestaque: #E0A458' };
    expect(kitVisualColors(kit)).toEqual({ base: '#0D1B2A', accent: '#E0A458', colors: ['#0D1B2A', '#E0A458'] });
    const vd = applyKitColors(structuredClone(APOTEOSE_VISUAL_DIRECTION), kit);
    expect(vd.palette.find(item => item.role === 'base').hex).toBe('#0D1B2A');
    expect(vd.palette.find(item => item.role === 'accent').hex).toBe('#E0A458');
    // Com menos de 3 cores, o kit não é paleta: os outros papéis ficam.
    expect(vd.palette.find(item => item.role === 'graphic').hex).toBe('#27DDE5');
    expect(vd.paletteSource).toBe('kit');
  });

  it('kit com paleta (3+ cores): cada papel vai para a cor do kit mais próxima, sem repetir enquanto houver cor livre', () => {
    const kit = { stylePrompt: 'Paleta: #1B1B3A, #F26B21, #C2185B, #00BCD4.' };
    const vd = applyKitColors(structuredClone(APOTEOSE_VISUAL_DIRECTION), kit);
    expect(vd.palette.map(item => item.hex)).toEqual(['#1B1B3A', '#F26B21', '#C2185B', '#00BCD4', '#F26B21']);
  });

  it('kit sem cor escrita (só referência) não muda a paleta proposta', () => {
    const kit = { stylePrompt: 'Siga a referência anexada.', refImages: [{ id: 'r', imageId: 'r' }] };
    expect(kitVisualColors(kit).colors).toEqual([]);
    expect(applyKitColors(structuredClone(APOTEOSE_VISUAL_DIRECTION), kit)).toEqual(APOTEOSE_VISUAL_DIRECTION);
  });
});

describe('modo livre: a paleta da imagem combina com deckDesign.palette', () => {
  const deck = normalizeDeckDesign({
    palette: { bg: '#171344', surface: '#241E5C', ink: '#F5F2EC', muted: '#C9C4E8', accent: '#FF6A1A', accent2: '#27DDE5', inverse: '#F5F2EC', inverseInk: '#171344' },
    fonts: { display: 'Fraunces', text: 'Inter' }, mood: 'Night party, orange light on faces, magenta shadows.',
  });

  it('sem visualDirection, ela é derivada do deck: base = bg, luz = accent, grafismo = accent2, sombra = o tom mais escuro restante', () => {
    const vd = visualDirectionFromDeckDesign(deck);
    expect(vd.palette).toEqual([
      { role: 'base', hex: '#171344' }, { role: 'subject_light', hex: '#FF6A1A' }, { role: 'graphic', hex: '#27DDE5' }, { role: 'shadow', hex: deck.palette.surface },
    ]);
    expect(vd.atmosphere).toBe('Night party, orange light on faces, magenta shadows.');
    expect(vd.paletteSource).toBe('deck');
  });

  it('com visualDirection, base e accent seguem o deck e o resto fica', () => {
    const vd = alignVisualDirectionWithDeck({ ...structuredClone(APOTEOSE_VISUAL_DIRECTION), palette: [{ role: 'base', hex: '#000000' }, { role: 'subject_light', hex: '#FF6A1A' }, { role: 'graphic', hex: '#27DDE5' }, { role: 'accent', hex: '#60EC2E' }] }, deck);
    expect(vd.palette).toEqual([{ role: 'base', hex: '#171344' }, { role: 'subject_light', hex: '#FF6A1A' }, { role: 'graphic', hex: '#27DDE5' }, { role: 'accent', hex: '#FF6A1A' }]);
  });

  it('resolveSlideVisualDirection: slide do modo livre usa o deck gravado; slide comum sem plano → null', () => {
    const free = { presentationPresetId: 'presentation_free', presentationDeckDesign: deck, presentationPlan: { schemaVersion: 3 } };
    expect(resolveSlideVisualDirection({ slide: free }).palette[0]).toEqual({ role: 'base', hex: '#171344' });
    expect(resolveSlideVisualDirection({ slide: { presentationPlan: { schemaVersion: 2 } } })).toBeNull();
    expect(resolveSlideVisualDirection({ slide: { presentationPlan: { visualDirection: APOTEOSE_VISUAL_DIRECTION } } }).palette).toEqual(APOTEOSE_VISUAL_DIRECTION.palette);
  });
});

describe('bloco VISUAL DIRECTION do pedido de imagem', () => {
  it('paleta com papéis e hex, acabamento, atmosfera, grafismos e exclusões do deck', () => {
    const block = composeVisualDirectionBlock(APOTEOSE_VISUAL_DIRECTION);
    expect(block.split('\n')[0]).toBe('VISUAL DIRECTION (shared by every image of this deck):');
    expect(block).toContain('Palette: base colour, the dominant field #171344; light on the subject #FF6A1A; shadows #B41275; graphic interventions #27DDE5; small accents #60EC2E.');
    expect(block).toContain(`Finish: ${APOTEOSE_VISUAL_DIRECTION.finish}`);
    expect(block).toContain(`Atmosphere: ${APOTEOSE_VISUAL_DIRECTION.atmosphere}`);
    expect(block).toContain(`Graphics: ${APOTEOSE_VISUAL_DIRECTION.graphics}`);
    expect(block).toContain(`Deck exclusions: ${APOTEOSE_VISUAL_DIRECTION.avoid}.`);
    expect(composeVisualDirectionBlock({ ...APOTEOSE_VISUAL_DIRECTION, graphics: 'none' })).toContain('Graphics: no graphic interventions.');
  });

  it('paleta proposta pela IA com referência de estilo anexada: a referência manda na cor', () => {
    expect(composeVisualDirectionBlock(APOTEOSE_VISUAL_DIRECTION, { referenceLook: true })).toContain('If the attached style reference shows different colours, follow the reference');
    expect(composeVisualDirectionBlock({ ...APOTEOSE_VISUAL_DIRECTION, paletteSource: 'kit' }, { referenceLook: true })).not.toContain('follow the reference');
  });

  it('slide sem visualDirection: a direção do pedido não ganha nada e o pedido fica igual ao de antes', () => {
    const slide = { imageQuery: 'crowd 1, dancing, street, medium', presentationPlan: { schemaVersion: 2, scene: { subject: 'crowd 1', action: 'dancing', setting: 'street', shot: 'medium' }, avoid: '', imageRules: [] } };
    const direction = composeImageDirection({ slide, fmt: 'apresentacao', presentationPanel: true, presentationFamily: 'presentation_cinematic' });
    expect(direction).not.toHaveProperty('visualDirection');
    expect(direction).not.toHaveProperty('sceneBrief');
    const prompt = buildImagePrompt({ scene: slide.imageQuery, ...direction }, { route: 'sjinn' }).prompt;
    expect(prompt.startsWith('SCENE: crowd 1, dancing, street, medium')).toBe(true);
    expect(prompt).not.toContain('VISUAL DIRECTION');
  });
});
