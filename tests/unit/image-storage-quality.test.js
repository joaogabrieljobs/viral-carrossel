import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  VC_FILE_DECODE_TIMEOUT_MS,
  vcImageFileToStorageDataUrl,
  vcShrinkDataUrlForStorage,
} from '../../src/utils/image-storage.js';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const sourceUrl = async (blob) => `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;

function nativeFileReader() {
  vi.stubGlobal('FileReader', class {
    readAsDataURL(file) {
      void sourceUrl(file).then((url) => {
        this.result = url;
        this.onload();
      });
    }
  });
}

describe('qualidade da foto importada', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp'])('preserva os bytes de %s acima do antigo limite de compressão', async (type) => {
    nativeFileReader();
    const createElement = vi.fn(() => { throw new Error('O original não deve passar pelo canvas.'); });
    vi.stubGlobal('document', { createElement });
    const bytes = Uint8Array.from({ length: 400_000 }, (_, index) => index % 256);
    const file = new Blob([bytes], { type });
    expect(await vcImageFileToStorageDataUrl(file)).toBe(await sourceUrl(file));
    expect(createElement).not.toHaveBeenCalled();
  });

  it('o adaptador legado não recomprime uma data URL nem remove seu MIME', async () => {
    const original = `data:image/png;base64,${'A'.repeat(400_000)}`;
    expect(await vcShrinkDataUrlForStorage(original)).toBe(original);
  });

  it.each(['throws', 'error'])('preserva o original pelo fallback quando FileReader %s', async (failure) => {
    vi.stubGlobal('FileReader', class {
      readAsDataURL() {
        if (failure === 'throws') throw new Error('Leitura indisponível');
        queueMicrotask(() => this.onerror());
      }
    });
    const file = new Blob([Uint8Array.from({ length: 80_000 }, (_, index) => index % 256)], { type: 'image/png' });
    expect(await vcImageFileToStorageDataUrl(file)).toBe(await sourceUrl(file));
  });

  it('encerra uma leitura que não responde sem tentar rasterizar a imagem', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('FileReader', class { readAsDataURL() {} });
    const pending = vcImageFileToStorageDataUrl(new Blob(['foto'], { type: 'image/jpeg' }));
    await vi.advanceTimersByTimeAsync(VC_FILE_DECODE_TIMEOUT_MS);
    expect(await pending).toBe('');
  });

  it('devolve falha de leitura quando nenhuma fonte está disponível', async () => {
    vi.stubGlobal('FileReader', class { constructor() { throw new Error('Falhou'); } });
    expect(await vcImageFileToStorageDataUrl({ arrayBuffer: async () => { throw new Error('Falhou'); } })).toBe('');
    expect(await vcImageFileToStorageDataUrl(null)).toBe('');
  });
});
