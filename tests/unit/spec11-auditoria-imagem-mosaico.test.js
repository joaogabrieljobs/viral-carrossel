import { afterEach, describe, expect, it, vi } from 'vitest';
import * as audit from '../../src/utils/image-audit.js';

// Spec 1.1, entrega 5: um mosaico só, em baixa resolução, montado no navegador
// com as imagens que já estão em memória (data URL). Sem baixar de novo e sem
// buscar URL externa.
const dataUrl = (n) => `data:image/png;base64,SLIDE${n}`;

function fakeCanvas({ sizeFor = () => 1000 } = {}) {
  const calls = { canvases: [], drawImage: [], fillText: [], toDataURL: [] };
  const createCanvas = (width, height) => {
    const ctx = {
      fillStyle: '', font: '', textBaseline: '',
      fillRect: () => {},
      drawImage: (img, ...args) => calls.drawImage.push({ src: img.src, args }),
      fillText: (label) => calls.fillText.push(label),
    };
    const canvas = {
      width, height, getContext: () => ctx,
      toDataURL: (type, quality) => {
        calls.toDataURL.push({ type, quality, width });
        return `data:image/jpeg;base64,${'A'.repeat(sizeFor({ width, quality }))}`;
      },
    };
    calls.canvases.push(canvas);
    return canvas;
  };
  const loadImage = vi.fn(async (src) => ({ src, naturalWidth: 1344, naturalHeight: 768 }));
  return { calls, createCanvas, loadImage };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('spec 1.1 entrega 5 — mosaico da auditoria', () => {
  it('grade pequena: colunas pelo total e células 16:9 até 1024 px de largura', () => {
    expect(audit.imageAuditMosaicLayout?.(3)).toMatchObject({ columns: 2, rows: 2, cellWidth: 512, cellHeight: 288, width: 1024, height: 576 });
    expect(audit.imageAuditMosaicLayout?.(7)).toMatchObject({ columns: 3, rows: 3, cellWidth: 341 });
    expect(audit.imageAuditMosaicLayout?.(10)).toMatchObject({ columns: 4, rows: 3, cellWidth: 256, cellHeight: 144 });
    expect(audit.imageAuditMosaicLayout?.(10, { maxWidth: 512 })).toMatchObject({ cellWidth: 128, width: 512 });
  });

  it('um único JPEG com cada miniatura numerada pelo slide, só com imagens em memória', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { calls, createCanvas, loadImage } = fakeCanvas();
    const mosaic = await audit.buildImageAuditMosaic?.([
      { slideId: 's2', slideIndex: 1, dataUrl: dataUrl(2) },
      { slideId: 's3', slideIndex: 2, dataUrl: 'https://cdn.exemplo/s3.png' },
      { slideId: 's4', slideIndex: 3, dataUrl: 'blob:https://moont.ai/abc' },
      { slideId: 's5', slideIndex: 4, dataUrl: dataUrl(5) },
    ], { createCanvas, loadImage });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(loadImage.mock.calls.map(([src]) => src)).toEqual([dataUrl(2), dataUrl(5)]);
    expect(calls.drawImage.map(call => call.src)).toEqual([dataUrl(2), dataUrl(5)]);
    expect(calls.fillText).toEqual(['2', '5']);
    expect(calls.canvases).toHaveLength(1);
    expect(calls.toDataURL[0].type).toBe('image/jpeg');
    expect(calls.toDataURL[0].quality).toBeLessThanOrEqual(0.6);
    expect(mosaic.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(mosaic.slides.map(slide => slide.slideId)).toEqual(['s2', 's5']);
  });

  it('reduz qualidade e tamanho até caber no teto do pedido; se não couber, não manda', async () => {
    const big = fakeCanvas({ sizeFor: ({ width, quality }) => (width >= 1024 || quality > 0.3 ? 200_000 : 50_000) });
    const mosaic = await audit.buildImageAuditMosaic?.([{ slideId: 's1', slideIndex: 0, dataUrl: dataUrl(1) }], big);
    expect(mosaic.dataUrl.length).toBeLessThanOrEqual(audit.IMAGE_AUDIT_MOSAIC_MAX_CHARS);
    expect(big.calls.toDataURL.at(-1).width).toBeLessThan(1024);

    const huge = fakeCanvas({ sizeFor: () => 500_000 });
    expect(await audit.buildImageAuditMosaic?.([{ slideId: 's1', slideIndex: 0, dataUrl: dataUrl(1) }], huge)).toBeNull();
  });

  it('sem nenhuma imagem em memória não monta mosaico', async () => {
    const { createCanvas, loadImage } = fakeCanvas();
    expect(await audit.buildImageAuditMosaic?.([{ slideId: 's1', slideIndex: 0, dataUrl: 'https://x/y.png' }], { createCanvas, loadImage })).toBeNull();
    expect(await audit.buildImageAuditMosaic?.([], { createCanvas, loadImage })).toBeNull();
    expect(loadImage).not.toHaveBeenCalled();
  });

  it('imagem que não decodifica fica de fora sem derrubar o mosaico', async () => {
    const env = fakeCanvas();
    env.loadImage.mockImplementationOnce(async () => { throw new Error('decode'); });
    const mosaic = await audit.buildImageAuditMosaic?.([
      { slideId: 's1', slideIndex: 0, dataUrl: dataUrl(1) },
      { slideId: 's2', slideIndex: 1, dataUrl: dataUrl(2) },
    ], env);
    expect(mosaic.slides.map(slide => slide.slideId)).toEqual(['s2']);
    expect(env.calls.fillText).toEqual(['2']);
  });
});
