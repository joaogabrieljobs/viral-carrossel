import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/utils/image-store.js', async (importOriginal) => ({
  ...(await importOriginal()), imagePut: vi.fn(), imageGet: vi.fn(), newImageId: () => 'ref_new',
}));
import { imagePut, imageGet, semImagensDeRuntime } from '../../src/utils/image-store.js';
import { storeSlideReference, importSlideReference, resolveSlideReference, exportSlideReference } from '../../src/utils/slide-reference.js';

const DATA = 'data:image/png;base64,YWJj';
const file = () => new Blob(['abc'], { type: 'image/png' });
beforeEach(() => {
  imagePut.mockReset().mockResolvedValue(undefined);
  imageGet.mockReset().mockResolvedValue({ blob: file() });
  vi.stubGlobal('FileReader', class {
    readAsDataURL(blob) {
      blob.arrayBuffer().then(bytes => {
        this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;
        this.onload?.();
      });
    }
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('referência por card', () => {
  it('guarda bytes originais, mesmo grandes, e devolve só ID depois de confirmar a gravação', async () => {
    let confirm;
    imagePut.mockImplementationOnce(() => new Promise(resolve => { confirm = resolve; }));
    const original = new Blob([new Uint8Array(4 * 1024 * 1024)], { type: 'image/png' });
    let resolved = false;
    const pending = storeSlideReference(original).then(result => { resolved = true; return result; });
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(imagePut).toHaveBeenCalledWith('ref_new', original);
    confirm();
    const stored = await pending;
    expect(stored).toEqual({ refImageId: 'ref_new', refImage: null, refImageAssetId: null });
    expect(JSON.stringify(semImagensDeRuntime([{ doc: { slides: [stored] } }])).length).toBeLessThan(200);
  });

  it('não publica um ID falso quando o armazenamento falha', async () => {
    imagePut.mockRejectedValue(new Error('quota'));
    await expect(storeSlideReference(file())).rejects.toThrow('a imagem anterior foi preservada');
    await expect(storeSlideReference(new Blob(['text'], { type: 'text/plain' }))).rejects.toThrow('imagem válido');
  });

  it('migra base64 legado com ID estável e preserva os demais campos', async () => {
    const original = { id: 's', title: 'Original', refImage: DATA, refImageAssetId: 'cloud_ref', refImageFailed: true, refImageError: '404' };
    const migrated = await importSlideReference(original);
    expect(migrated).toEqual({ ...original, refImageId: 'cloud_ref', refImage: null, refImageFailed: false, refImageError: null });
    expect(imagePut.mock.calls[0][0]).toBe('cloud_ref');
    expect(await imagePut.mock.calls[0][1].text()).toBe('abc');
    expect(original.refImage).toBe(DATA);
    expect(await importSlideReference(migrated)).toBe(migrated);
    expect(imagePut).toHaveBeenCalledTimes(1);
  });

  it('migração mal sucedida mantém a única cópia, inclusive se houver ID órfão', async () => {
    imagePut.mockRejectedValue(new Error('blocked'));
    const original = { refImage: DATA, refImageId: 'orphan' };
    expect(await importSlideReference(original)).toBe(original);
    expect(semImagensDeRuntime([{ doc: { slides: [original] } }])[0].doc.slides[0].refImage).toBe(DATA);
    const invalid = { refImage: 'data:image/png;base64,%%%' };
    expect(await importSlideReference(invalid)).toBe(invalid);
  });

  it('resolve ID específico antes da string legada', async () => {
    expect(await resolveSlideReference({ refImageId: 'stored', refImage: 'https://example.test/old.png' })).toBe(DATA);
    expect(imageGet).toHaveBeenCalledWith('stored');
  });

  it('resolve fallback portátil quando o ID local desaparece', async () => {
    imageGet.mockResolvedValue(null);
    expect(await resolveSlideReference({ refImageId: 'missing', refImage: DATA })).toBe(DATA);
    imageGet.mockRejectedValue(new Error('storage blocked'));
    expect(await resolveSlideReference({ refImageId: 'missing', refImage: DATA })).toBe(DATA);
    expect(await resolveSlideReference({})).toBeNull();
  });

  it('referência ID ou asset remoto indisponível lança erro legível', async () => {
    imageGet.mockResolvedValue(null);
    await expect(resolveSlideReference({ refImageId: 'missing' })).rejects.toMatchObject({ code: 'slide_reference_unavailable' });
    await expect(resolveSlideReference({ refImageAssetId: 'cloud_missing' })).rejects.toThrow('Reenvie a referência');
    await expect(resolveSlideReference({ refImageFailed: true })).rejects.toThrow('Reenvie a referência');
  });

  it('exporta bytes portáteis sem IDs privados e preserva o texto', async () => {
    const original = { id: 's', title: 'Original', refImageId: 'stored', refImageAssetId: 'cloud', refImageFailed: false, refImageError: null };
    expect(await exportSlideReference(original)).toEqual({ id: 's', title: 'Original', refImage: DATA });
    expect(original.refImageId).toBe('stored');
    imageGet.mockResolvedValue(null);
    await expect(exportSlideReference(original)).rejects.toThrow('Reenvie a referência');
    expect((await exportSlideReference({ ...original, refImage: DATA })).refImage).toBe(DATA);
    const noReference = { title: 'Só texto' };
    expect(await exportSlideReference(noReference)).toBe(noReference);
  });

  it('embute referências legadas HTTPS no backup e falha explicitamente se não puder ler', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => file() });
    vi.stubGlobal('fetch', fetchMock);
    expect(await exportSlideReference({ refImage: 'https://example.test/photo.png' })).toEqual({ refImage: DATA });
    fetchMock.mockResolvedValue({ ok: false });
    await expect(exportSlideReference({ refImage: 'blob:missing' })).rejects.toThrow('Reenvie a referência');
  });
});
