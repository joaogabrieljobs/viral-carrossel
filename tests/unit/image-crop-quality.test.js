import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareImageCrop } from '../../src/components/ImageCropModal.jsx';

afterEach(() => vi.unstubAllGlobals());

describe('qualidade do recorte', () => {
  it('preserva o arquivo original quando a região cobre a imagem inteira', async () => {
    const createElement = vi.fn();
    vi.stubGlobal('document', { createElement });
    const original = 'blob:original-jpeg-ou-png';
    expect(await prepareImageCrop(
      { naturalWidth: 6000, naturalHeight: 4000 },
      { x: 0, y: 0, w: 6000, h: 4000 },
      original,
    )).toBe(original);
    expect(createElement).not.toHaveBeenCalled();
  });

  it('mantém a região em resolução nativa e PNG transparente, sem JPEG intermediário', async () => {
    const png = new Blob(['png'], { type: 'image/png' });
    const ctx = { drawImage: vi.fn(), fillRect: vi.fn() };
    let encodedDimensions;
    const canvas = {
      getContext: () => ctx,
      toBlob: vi.fn((callback) => {
        encodedDimensions = [canvas.width, canvas.height];
        callback(png);
      }),
    };
    vi.stubGlobal('document', { createElement: () => canvas });
    const image = { naturalWidth: 6000, naturalHeight: 4000 };
    expect(await prepareImageCrop(image, { x: 100, y: 200, w: 4000, h: 3000 }, 'blob:original')).toBe(png);
    expect(encodedDimensions).toEqual([4000, 3000]);
    expect(ctx.drawImage).toHaveBeenCalledWith(image, 100, 200, 4000, 3000, 0, 0, 4000, 3000);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png', 1);
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });

  it('limita a região às bordas da fonte sem ampliar pixels', async () => {
    const ctx = { drawImage: vi.fn() };
    const canvas = {
      getContext: () => ctx,
      toBlob: callback => callback(new Blob(['png'], { type: 'image/png' })),
    };
    vi.stubGlobal('document', { createElement: () => canvas });
    const image = { naturalWidth: 100, naturalHeight: 80 };
    await prepareImageCrop(image, { x: 10.8, y: 20.3, w: 200, h: 200 }, 'blob:original');
    expect(ctx.drawImage).toHaveBeenCalledWith(image, 10, 20, 90, 60, 0, 0, 90, 60);
  });

  it('libera o buffer quando o navegador recusa um canvas grande', async () => {
    const canvas = { getContext: () => null };
    vi.stubGlobal('document', { createElement: () => canvas });
    await expect(prepareImageCrop(
      { naturalWidth: 6000, naturalHeight: 4000 },
      { x: 1, y: 1, w: 5000, h: 3000 },
      'blob:original',
    )).rejects.toThrow('Não foi possível preparar o recorte');
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });
});
