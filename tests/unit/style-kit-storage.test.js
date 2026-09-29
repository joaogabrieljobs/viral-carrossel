import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../src/utils/image-store.js', () => ({
  imageGet: vi.fn(), imagePut: vi.fn(), newImageId: vi.fn(() => 'img_new'),
  blobParaDataUrl: vi.fn(async () => 'data:image/png;base64,YQ=='),
  dataUrlParaBlob: vi.fn(() => new Blob(['a'], { type: 'image/png' })),
  imagemComoDataUrl: vi.fn(async () => 'data:image/png;base64,YQ=='),
}));
import { imageGet, imagePut, imagemComoDataUrl } from '../../src/utils/image-store.js';
import { migrateProjectReferences, exportProjectReferences, resolveImageReferences } from '../../src/utils/style-kit-storage.js';
beforeEach(() => vi.clearAllMocks());

describe('moodboard armazenado e transportado', () => {
  it('migra só após gravar o blob e não duplica referência já migrada', async () => {
    const kit = { contextMd: '# Brief', refImages: [{ id: 'a', dataUrl: 'data:image/png;base64,YQ==' }, { id: 'b', imageId: 'img_b' }] };
    const migrated = await migrateProjectReferences(kit);
    expect(imagePut).toHaveBeenCalledTimes(1);
    expect(migrated.refImages.map(r => r.imageId)).toEqual(['img_new', 'img_b']);
    expect(migrated.refImages.every(r => !r.dataUrl)).toBe(true);
    expect(kit.refImages[0].dataUrl).toBeTruthy();
  });
  it('backup embute bytes e não depende de IDs de outro navegador', async () => {
    const exported = await exportProjectReferences({ refImages: [{ id: 'r', imageId: 'img_r' }] });
    expect(exported.refImages[0].imageId).toBeUndefined();
    expect(exported.refImages[0].dataUrl).toMatch(/^data:image/);
    imagemComoDataUrl.mockResolvedValueOnce(null);
    await expect(exportProjectReferences({ refImages: [{ imageId: 'missing' }] })).rejects.toThrow(/indisponível/);
  });
  it('leva todas as refs, com override explícito do card', async () => {
    imageGet.mockResolvedValue({ blob: new Blob(['a']) });
    const kit = { refImages: [{ imageId: 'a' }, { imageId: 'b' }, { imageId: 'c' }] };
    expect(await resolveImageReferences(kit)).toHaveLength(3);
    imageGet.mockClear();
    expect(await resolveImageReferences(kit, 'data:image/png;base64,c2xpZGU=')).toEqual(['data:image/png;base64,c2xpZGU=']);
    expect(imageGet).not.toHaveBeenCalled();
    imageGet.mockResolvedValueOnce(null);
    await expect(resolveImageReferences({ refImages: [{ imageId: 'missing' }] })).rejects.toThrow(/Reenvie/);
  });
});
