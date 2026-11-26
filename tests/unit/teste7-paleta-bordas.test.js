import { describe, expect, it } from 'vitest';
import * as palette from '../../src/utils/reference-palette.js';
import { resolveSlideVisualDirection, snapVisualDirectionToPalette } from '../../src/utils/visual-direction.js';

const COLORS = [
  { hex: '#0E0E0F', weight: 0.48 },
  { hex: '#2B2158', weight: 0.23 },
  { hex: '#28B2D4', weight: 0.048 },
  { hex: '#9D2559', weight: 0.044 },
  { hex: '#C43B42', weight: 0.039 },
  { hex: '#F8701E', weight: 0.023 },
];
const VD = {
  palette: [{ role: 'base', hex: '#0E0E0F' }, { role: 'shadow', hex: '#2B2158' },
    { role: 'subject_light', hex: '#F8701E' }, { role: 'graphic', hex: '#28B2D4' }],
  finish: 'Grão de impressão.', atmosphere: 'Festa urbana.', graphics: '', avoid: '',
};
const hexRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
function referenceImage({ frameX = 0, frameY = 0, noise = false } = {}) {
  const innerWidth = 100; const innerHeight = 80;
  const width = innerWidth + 2 * frameX; const height = innerHeight + 2 * frameY;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const inArt = x >= frameX && x < frameX + innerWidth && y >= frameY && y < frameY + innerHeight;
    const ix = x - frameX; const iy = y - frameY;
    // A faixa índigo à esquerda pertence à arte. Não é borda só por ser lisa.
    const hex = !inArt ? '#0E0E0F' : ix < 65 ? '#2B2158' : iy < 40 ? '#F8701E' : '#28B2D4';
    const rgb = hexRgb(hex).map(c => !inArt && noise ? c + ((x + y) % 3) - 1 : c);
    data.set([...rgb, 255], (y * width + x) * 4);
  }
  return { data, width, height };
}

describe('Teste 7: bordas da referência fora da quantização', () => {
  const art = referenceImage();
  const expected = palette.extractPaletteFromPixels(art.data, art);
  for (const frame of [{ frameY: 35 }, { frameX: 45 }, { frameX: 25, frameY: 35 }, { frameX: 25, frameY: 35, noise: true }]) {
    it(`remove a moldura lisa ${JSON.stringify(frame)} sem remover a área índigo da arte`, () => {
      const image = referenceImage(frame);
      expect(palette.extractPaletteFromPixels(image.data, { ...image, ignoreFlatBorders: true })).toEqual(expected);
    });
  }
  it('o opt-in não muda a extração dos carrosséis existentes', () => {
    const image = referenceImage({ frameY: 35 });
    const legacy = palette.extractPaletteFromPixels(image.data, image);
    expect(legacy.find(c => c.hex === '#0E0E0F')?.weight).toBeGreaterThan(0.4);
    expect(palette.extractPaletteFromPixels(image.data, { ...image, ignoreFlatBorders: false })).toEqual(legacy);
  });
  it('uma referência de cor única permanece válida', () => {
    const width = 40; const height = 40; const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i += 1) data.set([43, 33, 88, 255], i * 4);
    expect(palette.extractPaletteFromPixels(data, { width, height, ignoreFlatBorders: true })).toEqual([{ hex: '#2B2158', weight: 1 }]);
  });
});

describe('Teste 7: base escura saturada da referência', () => {
  it('preto e branco neutros cedem ao índigo presente em 23% da referência', () => {
    expect(palette.preferredReferenceBaseHex('#0E0E0F', COLORS)).toBe('#2B2158');
    expect(palette.preferredReferenceBaseHex('#FFFFFF', COLORS)).toBe('#2B2158');
  });
  it('respeita o limiar de 15%, sem transformar um pequeno acento em base', () => {
    const withWeight = weight => COLORS.map(c => c.hex === '#2B2158' ? { ...c, weight } : c);
    expect(palette.preferredReferenceBaseHex('#0E0E0F', withWeight(0.15))).toBe('#2B2158');
    expect(palette.preferredReferenceBaseHex('#0E0E0F', withWeight(0.149))).toBe('#0E0E0F');
  });
  it('preserva uma base cromática, uma base explícita do kit e listas sem pesos', () => {
    expect(palette.preferredReferenceBaseHex('#78234B', COLORS)).toBe('#78234B');
    expect(palette.preferredReferenceBaseHex('#0E0E0F', COLORS, { explicitBase: '#0E0E0F' })).toBe('#0E0E0F');
    expect(palette.preferredReferenceBaseHex('#0E0E0F', COLORS.map(c => c.hex))).toBe('#0E0E0F');
  });
  it('prioriza peso e desempata de forma determinística', () => {
    const candidates = [...COLORS, { hex: '#222B66', weight: 0.3 }];
    expect(palette.preferredReferenceBaseHex('#000000', candidates)).toBe('#222B66');
    expect(palette.preferredReferenceBaseHex('#000000', [...candidates].reverse())).toBe('#222B66');
  });
  it('aplica a base na direção visual e mantém sombra diferente quando possível', () => {
    const result = snapVisualDirectionToPalette(VD, COLORS);
    expect(result.palette.find(c => c.role === 'base').hex).toBe('#2B2158');
    expect(result.palette.find(c => c.role === 'shadow').hex).not.toBe('#2B2158');
    expect(result.palette.find(c => c.role === 'subject_light').hex).toBe('#F8701E');
    expect(result.paletteSource).toBe('reference');
  });
  it('regenerar uma imagem lê os pesos guardados e respeita fundo explícito do kit', () => {
    const kit = { refImages: [{ imageId: 'flyer-teste7' }], referencePalette: { refIds: ['flyer-teste7'], colors: COLORS } };
    const slide = { presentationPlan: { visualDirection: VD } };
    expect(resolveSlideVisualDirection({ slide, styleKit: kit }).palette.find(c => c.role === 'base').hex).toBe('#2B2158');
    expect(resolveSlideVisualDirection({ slide, styleKit: { ...kit, stylePrompt: 'Fundo #0E0E0F.' } }).palette.find(c => c.role === 'base').hex).toBe('#0E0E0F');
  });
});
