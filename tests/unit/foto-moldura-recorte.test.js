import { describe, expect, it } from 'vitest';
import {
  PHOTO_FRAME_MIN_PCT, PHOTO_ZOOM_MAX, PHOTO_ZOOM_MIN,
  moveFrameRect, panPhoto, photoCropState, resizeFrameRect, zoomPhoto,
} from '../../src/utils/photo-frame.js';

// Pedido do João (27/11): clicar na foto e mudar o tamanho da moldura, mover a
// foto de lugar no card com a mão, e com duplo clique recortar (arrastar a
// imagem dentro da moldura e dar zoom).
describe('moldura da foto: mover', () => {
  it('desloca em % do card e mantém o tamanho', () => {
    expect(moveFrameRect({ x: 10, y: 20, w: 40, h: 30 }, 5, -10)).toEqual({ x: 15, y: 10, w: 40, h: 30 });
  });
  it('não sai do card', () => {
    expect(moveFrameRect({ x: 10, y: 20, w: 40, h: 30 }, 90, 90)).toEqual({ x: 60, y: 70, w: 40, h: 30 });
    expect(moveFrameRect({ x: 10, y: 20, w: 40, h: 30 }, -50, -50)).toEqual({ x: 0, y: 0, w: 40, h: 30 });
  });
});

describe('moldura da foto: redimensionar pelas alças', () => {
  const r = { x: 20, y: 20, w: 40, h: 40 };
  it('canto inferior direito cresce para a direita e para baixo', () => {
    expect(resizeFrameRect(r, 'se', 10, 5)).toEqual({ x: 20, y: 20, w: 50, h: 45 });
  });
  it('canto superior esquerdo move a origem e mantém a borda oposta', () => {
    expect(resizeFrameRect(r, 'nw', -10, 5)).toEqual({ x: 10, y: 25, w: 50, h: 35 });
  });
  it('lados mudam um eixo só', () => {
    expect(resizeFrameRect(r, 'e', 10, 30)).toEqual({ x: 20, y: 20, w: 50, h: 40 });
    expect(resizeFrameRect(r, 'n', 30, -5)).toEqual({ x: 20, y: 15, w: 40, h: 45 });
  });
  it('tem tamanho mínimo e não passa da borda do card', () => {
    expect(resizeFrameRect(r, 'se', -100, -100)).toEqual({ x: 20, y: 20, w: PHOTO_FRAME_MIN_PCT, h: PHOTO_FRAME_MIN_PCT });
    expect(resizeFrameRect(r, 'se', 100, 100)).toEqual({ x: 20, y: 20, w: 80, h: 80 });
    expect(resizeFrameRect(r, 'nw', 100, 100)).toEqual({ x: 60 - PHOTO_FRAME_MIN_PCT, y: 60 - PHOTO_FRAME_MIN_PCT, w: PHOTO_FRAME_MIN_PCT, h: PHOTO_FRAME_MIN_PCT });
  });
});

describe('recorte: arrastar a imagem dentro da moldura', () => {
  // Moldura 1000×500 px, foto 2000×2000: em "cover" a foto vira 1000×1000.
  const geo = { frameW: 1000, frameH: 500, imageW: 2000, imageH: 2000 };
  it('na direção sem sobra a imagem não anda; na outra, anda junto com o dedo', () => {
    const state = photoCropState({ bgX: 50, bgY: 50, bgZoom: 100, bgFit: 'cover' });
    // Sobra vertical = 500 px. Puxar 100 px para baixo mostra a parte de cima: -20%.
    expect(panPhoto(state, 300, 100, geo)).toMatchObject({ bgX: 50, bgY: 30 });
  });
  it('com zoom, sobra imagem nos dois eixos e dá para enquadrar a faixa fina', () => {
    const state = photoCropState({ bgX: 50, bgY: 50, bgZoom: 200, bgFit: 'cover' });
    // Largura 2000, sobra 1000: 100 px para a esquerda mostra mais da direita (+10%).
    expect(panPhoto(state, -100, 0, geo)).toMatchObject({ bgX: 60, bgY: 50 });
  });
  it('não passa da borda da imagem', () => {
    const state = photoCropState({ bgX: 50, bgY: 50, bgZoom: 100, bgFit: 'cover' });
    expect(panPhoto(state, 0, 5000, geo).bgY).toBe(0);
    expect(panPhoto(state, 0, -5000, geo).bgY).toBe(100);
  });
  it('o deslocamento antigo da foto entra no enquadramento e zera', () => {
    const state = photoCropState({ bgX: 50, bgY: 50, bgZoom: 100, bgFit: 'cover', elementOffsets: { photo: { x: 10, y: -5 } } });
    expect(state).toMatchObject({ bgX: 40, bgY: 55 });
    expect(panPhoto(state, 0, 0, geo)).toEqual({ bgX: 40, bgY: 55, bgZoom: 100, bgFit: 'cover', photoFraming: 'manual', elementOffsets: { photo: { x: 0, y: 0 } } });
  });
  it('foto "contain" vira "cover" ao recortar, para preencher a moldura', () => {
    expect(photoCropState({ bgFit: 'contain' }).bgFit).toBe('cover');
  });
});

describe('recorte: zoom', () => {
  const state = photoCropState({ bgX: 50, bgY: 50, bgZoom: 100, bgFit: 'cover' });
  it('multiplica e respeita os limites', () => {
    expect(zoomPhoto(state, 1.5).bgZoom).toBe(150);
    expect(zoomPhoto(state, 0.2).bgZoom).toBe(PHOTO_ZOOM_MIN);
    expect(zoomPhoto({ ...state, bgZoom: 380 }, 2).bgZoom).toBe(PHOTO_ZOOM_MAX);
  });
});
