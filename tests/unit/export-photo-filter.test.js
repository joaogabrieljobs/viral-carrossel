import { describe, expect, it, vi } from 'vitest';
import { applyExportPhotoFilterPixels, parseExportPhotoFilter, exportFilteredPhotoSource } from '../../src/utils/export-photo-filter.js';
const filtered = (filter, input) => { const pixels = new Uint8ClampedArray(input); applyExportPhotoFilterPixels(pixels, parseExportPhotoFilter(filter)); return [...pixels]; };
describe('tratamento fotográfico no bitmap exportado', () => {
  it('preto e branco preserva transparência e a ordem dos filtros muda o resultado', () => {
    expect(filtered('grayscale(1)', [255, 0, 0, 128])).toEqual([54, 54, 54, 128]);
    expect(filtered('grayscale(1) brightness(2)', [255, 0, 0, 128])).toEqual([108, 108, 108, 128]);
    expect(filtered('brightness(2) grayscale(1)', [255, 0, 0, 128])).toEqual([54, 54, 54, 128]);
  });
  it('preserva identidades, limita canais e aceita o ajuste manual em porcentagem', () => {
    expect(filtered('contrast(100%) saturate(100%) hue-rotate(0deg) sepia(0)', [20, 80, 160, 255])).toEqual([20, 80, 160, 255]);
    expect(filtered('brightness(200%) contrast(2)', [20, 80, 160, 255])).toEqual([0, 192, 255, 255]);
    expect(parseExportPhotoFilter('url(https://example.com/filtro.svg)')).toBeNull();
    expect(parseExportPhotoFilter('none')).toBeNull();
    expect(parseExportPhotoFilter('contrast(-1)')).toBeNull();
  });
  it('em webview sem filter usa os pixels da imagem inteira e mantém alfa', () => {
    const pixels = { data: new Uint8ClampedArray([255, 0, 0, 90]) };
    const ctx = { drawImage: vi.fn(), getImageData: () => pixels, putImageData: vi.fn() };
    const canvas = { getContext: () => ctx, toDataURL: () => 'filtered' };
    const result = exportFilteredPhotoSource({ createElement: () => canvas }, { naturalWidth: 1, naturalHeight: 1 }, 'grayscale(1)');
    expect(result).toBe('filtered');
    expect([...pixels.data]).toEqual([54, 54, 54, 90]);
    expect(ctx.putImageData).toHaveBeenCalledWith(pixels, 0, 0);
  });
});
