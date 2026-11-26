// Teste 6 da Apoteose, item 1: a paleta da referência sai da imagem, pelo
// código (sem IA, sem rede). A Z.ai, que não vê imagem, inventou
// #1A0B2E/#F5C842/#E94560 em vez das cores do flyer.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../helpers/png.js';
import {
  extractPaletteFromPixels, hexDeltaE, kitReferencePalette, nearestPaletteHex, referencePaletteKitField,
} from '../../src/utils/reference-palette.js';
import { buildPresentationPlanPrompt } from '../../src/utils/presentation-plan.js';
import { generatePresentationPlan } from '../../src/utils/presentation-planning.js';
import {
  composeVisualDirectionBlock, resolveSlideVisualDirection, snapVisualDirectionToPalette,
} from '../../src/utils/visual-direction.js';
import { normalizeStyleKit } from '../../src/utils/style-kit.js';

const FLYER = decodePng(new URL('../fixtures/apoteose-flyer-referencia.png', import.meta.url));
const T6 = JSON.parse(readFileSync(new URL('../fixtures/apoteose-teste6.json', import.meta.url), 'utf8'));
const SRC = [{ id: 's1', title: 'Fonte', text: 'O festival reúne 40 mil pessoas em 12 noites.' }];
const planoV3 = n => ({
  schemaVersion: 3, promptVersion: 'presentation-plan-v3', objective: 'Apresentar a festa', audience: 'Convidados', thesis: 'A festa antecipa o Carnaval',
  rules: [], evidence: [{ id: 'e1', status: 'fact', sourceId: 's1', quote: 'O festival reúne 40 mil pessoas em 12 noites.', claim: '40 mil pessoas' }], gaps: [],
  slides: Array.from({ length: n }, (_, i) => ({
    index: i + 1, visualRole: i === 0 ? 'cover' : i === n - 1 ? 'closing' : 'content', purpose: i === 0 ? 'introduction' : i === n - 1 ? 'decision' : 'context',
    question: `Pergunta ${i + 1}?`, keyMessage: `Mensagem ${i + 1}.`, evidenceIds: i === 1 ? ['e1'] : [],
    scene: { subject: `crowd ${i}`, action: 'dancing', setting: 'street', shot: ['wide', 'medium', 'close-up', 'detail', 'overhead', 'aerial'][i % 6] }, avoid: '',
  })),
});

const hsl = (hex) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const l = (max + min) / 2;
  return { h: (h * 60 + 360) % 360, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l };
};
const has = (palette, test) => palette.some(c => test(hsl(c.hex)));

describe('item 1: extração determinística da paleta do flyer', () => {
  const palette = extractPaletteFromPixels(FLYER.data, FLYER);

  it('5 a 6 cores com peso, da mais pesada à mais leve', () => {
    expect(palette.length).toBeGreaterThanOrEqual(5);
    expect(palette.length).toBeLessThanOrEqual(6);
    for (const c of palette) {
      expect(c.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(c.weight).toBeGreaterThan(0);
    }
    expect(palette.map(c => c.weight)).toEqual([...palette.map(c => c.weight)].sort((a, b) => b - a));
  });

  it('tem índigo/violeta escuro, laranja/âmbar, ciano/azul-claro e verde (por matiz)', () => {
    expect(has(palette, c => c.h >= 220 && c.h <= 290 && c.l < 0.3)).toBe(true);
    expect(has(palette, c => c.h >= 10 && c.h <= 45 && c.s > 0.5 && c.l > 0.4)).toBe(true);
    expect(has(palette, c => c.h >= 180 && c.h <= 215 && c.l > 0.5)).toBe(true);
    expect(has(palette, c => c.h >= 80 && c.h <= 150 && c.s > 0.4)).toBe(true);
    // A cor dominante é a base escura.
    expect(hsl(palette[0].hex).l).toBeLessThan(0.3);
  });

  it('não tem o amarelo #F5C842 que a IA inventou', () => {
    expect(palette.every(c => hexDeltaE(c.hex, '#F5C842') > 20)).toBe(true);
    expect(has(palette, c => c.h > 45 && c.h < 70 && c.l > 0.5)).toBe(false);
  });

  it('determinística e sem branco de texto/logo', () => {
    expect(extractPaletteFromPixels(FLYER.data, FLYER)).toEqual(palette);
    expect(palette.every(c => hsl(c.hex).l < 0.85)).toBe(true);
    const w = 40; const h = 40;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i += 1) {
      const red = i % w < 10;
      data.set(red ? [200, 30, 40, 255] : [250, 250, 248, 255], i * 4);
    }
    expect(extractPaletteFromPixels(data, { width: w, height: h })).toEqual([{ hex: '#C81E28', weight: 1 }]);
  });
});

describe('item 1: as cores da referência entram no pedido do roteiro', () => {
  const palette = extractPaletteFromPixels(FLYER.data, FLYER);

  it('o pedido do roteiro lista as cores extraídas como obrigatórias', () => {
    const prompt = buildPresentationPlanPrompt({ brief: 'Apoteose', sources: SRC, count: 6, freeDesign: true, referenceColors: palette, kitReferenceWithoutText: true });
    for (const c of palette) expect(prompt).toContain(c.hex);
    expect(prompt).toMatch(/Cores da referência[^\n]*obrigatórias/);
    expect(prompt).toMatch(/deckDesign\.palette/);
    // A frase "não descreva nem invente as cores dela" sai: agora há cores.
    expect(prompt).not.toContain('não descreva nem invente as cores dela');
  });

  it('sem referência extraída o pedido fica como antes', () => {
    const antes = buildPresentationPlanPrompt({ brief: 'Apoteose', sources: SRC, count: 6, freeDesign: true, kitReferenceWithoutText: true });
    expect(antes).not.toContain('Cores da referência');
    expect(antes).toContain('não descreva nem invente as cores dela');
    expect(buildPresentationPlanPrompt({ brief: 'Apoteose', sources: SRC, count: 6, freeDesign: true, kitReferenceWithoutText: true, referenceColors: [] })).toBe(antes);
  });
});

describe('item 1: o código troca o hex fora da lista pelo mais próximo', () => {
  const palette = extractPaletteFromPixels(FLYER.data, FLYER);
  const allowed = palette.map(c => c.hex);

  it('roteiro do Teste 6: visualDirection e deckDesign (cores) saem da lista', async () => {
    const plano = { ...planoV3(6), deckDesign: T6.deckDesign, visualDirection: T6.visualDirection };
    const { plan } = await generatePresentationPlan({ brief: 'Apoteose', sources: SRC, count: 6, freeDesign: true, referenceColors: palette }, async () => plano);
    for (const item of plan.visualDirection.palette) expect(allowed).toContain(item.hex);
    expect(plan.visualDirection.paletteSource).toBe('reference');
    for (const key of ['bg', 'accent', 'accent2']) expect(allowed).toContain(plan.deckDesign.palette[key]);
    expect(Object.values(plan.deckDesign.palette)).not.toContain('#F5C842');
  });

  it('cores escritas no kit vencem as extraídas (ficam como estão)', async () => {
    const plano = { ...planoV3(6), deckDesign: { ...T6.deckDesign, palette: { ...T6.deckDesign.palette, accent: '#E94560' } }, visualDirection: T6.visualDirection };
    const { plan } = await generatePresentationPlan({ brief: 'Apoteose', sources: SRC, count: 6, freeDesign: true, referenceColors: palette, kitColors: ['#E94560'] }, async () => plano);
    expect(plan.deckDesign.palette.accent).toBe('#E94560');
    expect(plan.visualDirection.palette.find(p => p.role === 'graphic').hex).toBe('#E94560');
  });

  it('sem referência o roteiro fica como a IA mandou', async () => {
    const plano = { ...planoV3(6), deckDesign: T6.deckDesign, visualDirection: T6.visualDirection };
    const { plan } = await generatePresentationPlan({ brief: 'Apoteose', sources: SRC, count: 6, freeDesign: true }, async () => plano);
    expect(plan.visualDirection.palette.map(p => p.hex)).toEqual(T6.visualDirection.palette.map(p => p.hex));
    expect(plan.deckDesign.palette.accent).toBe('#F5C842');
  });

  it('nearestPaletteHex e snapVisualDirectionToPalette', () => {
    expect(nearestPaletteHex('#F5C842', ['#000000', '#FFFF00'])).toBe('#FFFF00');
    const vd = snapVisualDirectionToPalette(structuredClone(T6.visualDirection), palette);
    expect(vd.palette.every(item => allowed.includes(item.hex))).toBe(true);
    expect(snapVisualDirectionToPalette(T6.visualDirection, [])).toBe(T6.visualDirection);
  });
});

describe('item 1: a paleta fica no kit do projeto para refazer a imagem depois', () => {
  const palette = extractPaletteFromPixels(FLYER.data, FLYER);
  const kit = { stylePrompt: T6.styleKitStylePrompt, refImages: [{ id: 'r1', imageId: 'img-flyer', name: 'flyer' }] };

  it('o kit guarda a paleta presa às referências de onde saiu', () => {
    const field = referencePaletteKitField(kit, palette);
    const saved = normalizeStyleKit({ ...kit, referencePalette: field });
    expect(kitReferencePalette(saved)).toEqual(palette);
    // Trocou a referência: a paleta guardada não vale mais.
    expect(kitReferencePalette({ ...saved, refImages: [{ id: 'r2', imageId: 'outra', name: 'x' }] })).toEqual([]);
    expect(normalizeStyleKit({ ...kit, referencePalette: { refIds: ['img-flyer'], colors: [{ hex: 'azul' }] } }).referencePalette).toBeUndefined();
  });

  it('refazer a imagem depois usa a paleta guardada (pedido de imagem sem o amarelo)', () => {
    const saved = normalizeStyleKit({ ...kit, referencePalette: referencePaletteKitField(kit, palette) });
    const slide = { presentationPresetId: 'presentation_free', presentationDeckDesign: T6.deckDesign, presentationPlan: { visualDirection: T6.visualDirection } };
    const vd = resolveSlideVisualDirection({ slide, styleKit: saved });
    expect(vd.palette.every(item => palette.some(c => c.hex === item.hex))).toBe(true);
    const block = composeVisualDirectionBlock(vd, { referenceLook: true });
    expect(block).not.toContain('#F5C842');
    expect(block).not.toContain('its colours win');
  });
});

describe('item 1: a geração passa as cores extraídas ao roteiro', () => {
  const review = readFileSync(new URL('../../src/utils/editorial-review.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
  it('generatePlannedPresentation repassa referenceColors', () => {
    expect(review).toMatch(/generatePresentationPlan\(\{[\s\S]*?referenceColors: Array\.isArray\(planning\.referenceColors\)/);
  });
  it('a geração de apresentação extrai a paleta da referência e guarda no kit', () => {
    expect(app).toMatch(/extractReferencePaletteFromSources\(await resolveImageReferences\(styleKit/);
    expect(app).toMatch(/planningContext: \{[\s\S]*?referenceColors,/);
    expect(app).toMatch(/referencePalette: referencePaletteField/);
  });
});
