import { describe, expect, it, vi } from 'vitest';

vi.mock('smartcrop', () => ({ default: { crop: vi.fn() } }));

// Reteste 22/11: trocar o formato cortava a cabeça (Stories cards 2 e 4,
// Quadrado 1, 3 e 4). Sem FaceDetector no navegador, o smartcrop escolhia a
// região de mais detalhe (mãos sovando a massa). A pele mais alta da foto,
// em geral o rosto, entra como reforço do recorte.
function image(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const [r, g, b] = paint(x, y);
    const i = (y * width + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
  return data;
}
const SKIN = [210, 150, 120];
const WALL = [40, 40, 45];

describe('reforço do rosto sem detector', () => {
  it('escolhe a pele mais alta (rosto) e não as mãos', async () => {
    const { topSkinRegion } = await import('../../src/utils/photo-framing.js');
    const w = 40; const h = 50;
    const data = image(w, h, (x, y) => (
      (y >= 6 && y < 14 && x >= 16 && x < 24) || (y >= 34 && y < 40 && x >= 8 && x < 32) ? SKIN : WALL));
    const region = topSkinRegion(data, w, h);
    expect(region.y).toBeLessThan(8);
    expect(region.y + region.height).toBeLessThan(30);
    expect(region.x).toBeLessThan(18);
    expect(region.weight).toBeGreaterThan(0);
  });
  it('foto sem pele não ganha reforço', async () => {
    const { topSkinRegion } = await import('../../src/utils/photo-framing.js');
    expect(topSkinRegion(image(20, 20, () => WALL), 20, 20)).toBeNull();
  });
});
