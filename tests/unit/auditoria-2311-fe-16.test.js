import { describe, expect, it } from 'vitest';
import smartcrop from 'smartcrop';
import { portraitTopAnchor, topSkinRegion } from '../../src/utils/photo-framing.js';

// Auditoria 23/11 (FE-16): o reforço "pele mais alta = rosto" (reteste 22/11)
// depende de um limiar RGB. Não vê pele escura nem foto em preto e branco, e
// trata parede bege ou madeira como pele. Reprodução com o smartcrop real, sem
// navegador.
//
// Decisão de 24/11 (reteste real, RT24 item 8): foto retrato em zona paisagem
// ou quadrada enquadra pelo topo (`portraitTopAnchor`), sem depender da cor da
// pele. O caso da pele escura passou a valer. O da natureza-morta continua
// `it.fails`: é o custo aceito da âncora (objeto no pé de uma foto retrato fica
// fora do recorte até a pessoa ajustar à mão).
function image(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const [r, g, b] = paint(x, y);
    const i = (y * width + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
  return { width, height, data };
}
const imageOperations = {
  open: (img) => Promise.resolve(img),
  resample: (img) => Promise.resolve(img),
  getData: (img) => Promise.resolve(new smartcrop.ImgData(img.width, img.height, img.data)),
};
/** O mesmo caminho de `analyze` em photo-framing.js quando não há FaceDetector. */
async function squareCrop(img) {
  const anchor = portraitTopAnchor(img.width, img.height, 1080, 1080);
  if (anchor) return { x: 0, y: Math.round((anchor.bgY / 100) * (img.height - img.width)), width: img.width, height: img.width };
  const head = topSkinRegion(img.data, img.width, img.height);
  const result = await smartcrop.crop(img, {
    width: 1080, height: 1080, minScale: 1, maxScale: 1, prescale: false, boost: head ? [head] : [], imageOperations,
  });
  return result.topCrop;
}
const W = 240; const H = 384;
const FACE = [Math.round(H * 0.115), Math.round(H * 0.285)];
const detail = (x, y, a, b) => (((x >> 2) + (y >> 2)) % 2 ? a : b);
/** Retrato: rosto no terço superior, tronco, e mãos sovando a massa embaixo. */
const portrait = (skin, wall) => image(W, H, (x, y) => {
  const fx = (x - W / 2) / (W * 0.11); const fy = (y - H * 0.2) / (H * 0.085);
  if (fx * fx + fy * fy <= 1) return skin;
  if (y > H * 0.3 && y < H * 0.7 && Math.abs(x - W / 2) < W * 0.28) return [30, 30, 60];
  if (y >= H * 0.72 && y < H * 0.9 && Math.abs(x - W / 2) < W * 0.36) return detail(x, y, skin, [235, 225, 200]);
  return wall;
});
const containsFace = (crop) => crop.y <= FACE[0] && crop.y + crop.height >= FACE[1];
const NEUTRAL_WALL = [60, 70, 90];

describe('auditoria 23/11 FE-16: enquadramento automático sem detector de rosto', () => {
  it('pele clara em fundo neutro: o rosto fica no recorte 1:1', async () => {
    expect(containsFace(await squareCrop(portrait([210, 150, 120], NEUTRAL_WALL)))).toBe(true);
  });

  it('pele escura em fundo neutro: o rosto fica no recorte 1:1', async () => {
    expect(containsFace(await squareCrop(portrait([80, 50, 35], NEUTRAL_WALL)))).toBe(true);
  });

  it('foto em preto e branco: o rosto fica no recorte 1:1', async () => {
    expect(containsFace(await squareCrop(portrait([120, 120, 120], [40, 40, 40])))).toBe(true);
  });

  it.fails('fundo bege sem pessoa não puxa o recorte para o topo (custo aceito da âncora pelo topo)', async () => {
    // Objeto detalhado na parte de baixo, parede bege lisa em cima.
    const still = image(W, H, (x, y) => (y > H * 0.62 && y < H * 0.95 && Math.abs(x - W / 2) < 70
      ? detail(x, y, [40, 90, 60], [230, 230, 220]) : [210, 180, 140]));
    const crop = await squareCrop(still);
    expect(crop.y).toBeGreaterThan(0);
    expect(crop.y + crop.height).toBeGreaterThanOrEqual(Math.round(H * 0.95));
  });
});
