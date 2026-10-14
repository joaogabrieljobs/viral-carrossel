import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { packLibraryForCloud, pushLibraryToCloud, applyCloudManifest } from '../../src/utils/library-sync.js';
import { originalImageAssetId } from '../../src/utils/cloud-image-assets.js';
import { SK, unlockAccountDataWrites } from '../../src/utils/storage.js';

const images = vi.hoisted(() => ({ read: vi.fn(), put: vi.fn() }));
vi.mock('../../src/utils/image-store.js', async (original) => ({
  ...(await original()), imagemComoDataUrl: images.read, imagePut: images.put,
}));

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const JPEG = 'data:image/jpeg;base64,anBlZw==';
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}
function snapshot(doc = {}) {
  return { library: [{ id: 'p1', doc: { slides: [], ...doc } }], brandRoster: [], libraryFolders: [] };
}
function browserCanvas() {
  const fillRect = vi.fn();
  const encode = vi.fn((type) => type === 'image/png' ? PNG : JPEG);
  vi.stubGlobal('Image', class {
    naturalWidth = 2400;
    naturalHeight = 480;
    set src(_) { queueMicrotask(() => this.onload()); }
  });
  vi.stubGlobal('document', { createElement: vi.fn(() => ({
    getContext: () => ({ fillRect, drawImage: vi.fn() }), toDataURL: encode,
  })) });
  return { fillRect, encode };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', storage());
  vi.stubGlobal('sessionStorage', storage());
  vi.stubGlobal('FileReader', class {
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
        this.onload?.();
      });
    }
  });
  unlockAccountDataWrites();
  images.read.mockReset().mockResolvedValue(PNG);
  images.put.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  unlockAccountDataWrites();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('logos transparentes na sincronização', () => {
  it('preserva PNG original de card, marca, perfil e kit mesmo com Canvas disponível', async () => {
    const canvas = browserCanvas();
    const input = snapshot({
      slides: [{ id: 's1', logoImageId: 'card-logo' }],
      brand: { id: 'b1', logoImageId: 'brand-logo' },
      styleKit: { logo: { imageId: 'project-logo' } },
    });
    input.brandRoster = [{ id: 'b2', logoImageId: 'roster-logo' }];
    const packed = await packLibraryForCloud(input);
    // Mesmo original deduplicado sem reencode e separado de qualquer JPEG legado.
    expect([...packed.assets.keys()]).toEqual([await originalImageAssetId(PNG)]);
    expect([...packed.assets.values()]).toEqual([PNG]);
    expect(canvas.fillRect).not.toHaveBeenCalled();
    expect(canvas.encode).not.toHaveBeenCalled();
    expect(JSON.stringify(packed.manifest)).not.toContain('data:image');
    // O JPEG legado no ID original pode continuar no servidor; a nova chave
    // impede que a ordem de extensões do backend o devolva no lugar do PNG.
    expect(packed.manifest.docs[0].doc.styleKit.logo.assetId).toBe(await originalImageAssetId(PNG));
  });

  it('preserva PNG grande e fotos sem Canvas, downsample nem fundo artificial', async () => {
    const canvas = browserCanvas();
    const oversized = `data:image/png;base64,${'A'.repeat(2_400_000)}`;
    const packed = await packLibraryForCloud(snapshot({ slides: [{ id: 's1', logoImage: oversized }] }));
    expect([...packed.assets.values()]).toEqual([oversized]);
    const photo = await packLibraryForCloud(snapshot({ slides: [{ id: 's1', bgImage: PNG }] }));
    expect([...photo.assets.values()]).toEqual([PNG]);
    expect(canvas.fillRect).not.toHaveBeenCalled();
    expect(canvas.encode).not.toHaveBeenCalled();
  });

  it('a segunda tentativa de upload também mantém o PNG e o content-type', async () => {
    const canvas = browserCanvas();
    const uploads = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body);
      if (body.action === 'status') return response({ ok: true, empty: true });
      if (body.action === 'push') return response({ ok: true, revision: 1, projectCount: 1 });
      if (body.action === 'putAsset') {
        uploads.push(body);
        return uploads.length === 1 ? response({ error: 'Falha transitória' }, 503) : response({ ok: true });
      }
      throw new Error(`Ação inesperada: ${body.action}`);
    }));
    const result = await pushLibraryToCloud({ pullAfter: false, snapshot: snapshot({
      slides: [{ id: 's1', logoImage: PNG }],
    }) });
    expect(result.assetsFailed).toBe(0);
    expect(uploads).toHaveLength(2);
    expect(uploads.every((item) => item.dataUrl === PNG && item.contentType === 'image/png')).toBe(true);
    expect(canvas.fillRect).not.toHaveBeenCalled();
  });

  it('restaura o PNG local correspondente quando a nuvem ainda contém o JPEG antigo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ asset: { dataUrl: JPEG } })));
    const local = snapshot({
      slides: [{ id: 's1', logoImageAssetId: 'card-asset', logoImageId: 'card-original' }],
      brand: { id: 'b1', logoAssetId: 'brand-asset', logoImageId: 'brand-original' },
      styleKit: { logo: { assetId: 'project-asset', imageId: 'project-original' } },
    });
    local.brandRoster = [{ id: 'b2', logoAssetId: 'roster-asset', logoImageId: 'roster-original' }];
    const manifest = {
      docs: [{ id: 'p1', doc: {
        slides: [{ id: 's1', logoImageAssetId: 'card-asset' }],
        brand: { id: 'b1', logoAssetId: 'brand-asset' },
        styleKit: { logo: { assetId: 'project-asset' } },
      } }],
      brands: [{ id: 'b2', logoAssetId: 'roster-asset' }],
    };
    const result = await applyCloudManifest(manifest, { localSnapshot: local });
    expect(images.read.mock.calls.map(([id]) => id).sort()).toEqual([
      'brand-original', 'card-original', 'project-original', 'roster-original',
    ]);
    expect(images.put).toHaveBeenCalledTimes(4);
    for (const [, blob] of images.put.mock.calls) {
      expect(blob.type).toBe('image/png');
      expect(Buffer.from(await blob.arrayBuffer()).toString('base64')).toBe(PNG.split(',')[1]);
    }
    const doc = result.snapshot.library[0].doc;
    expect(doc.slides[0].logoImageId).toMatch(/^img_/);
    expect(doc.brand.logoImageId).toMatch(/^img_/);
    expect(doc.styleKit.logo.imageId).toMatch(/^img_/);
    expect(result.snapshot.brandRoster[0].logoImageId).toMatch(/^img_/);
  });

  it('não troca uma logo por PNG de outro asset nem apaga JPEG legado ao salvar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ asset: { dataUrl: JPEG } })));
    const local = snapshot({
      slides: [{ id: 's1', logoImageAssetId: 'different-asset', logoImageId: 'different-logo' }],
      brand: { id: 'b1', logoAssetId: 'different-brand', logoImageId: 'different-logo' },
    });
    const result = await applyCloudManifest({ docs: [{ id: 'p1', doc: {
      slides: [{ id: 's1', logoImageAssetId: 'old-asset', logoImageId: 'other-browser-id' }],
      brand: { id: 'b1', logoAssetId: 'old-brand', logoImageId: 'other-browser-id' },
    } }], brands: [] }, { localSnapshot: local });
    expect(images.read).not.toHaveBeenCalled();
    expect(images.put).not.toHaveBeenCalled();
    expect(result.snapshot.library[0].doc.slides[0]).toMatchObject({ logoImage: JPEG, logoImageId: null });
    const persisted = JSON.parse(localStorage.getItem(SK.library))[0].doc;
    expect(persisted.slides[0]).toMatchObject({ logoImage: JPEG, logoImageId: null });
    expect(persisted.brand).toMatchObject({ logo: JPEG, logoImageId: null });
  });

  it('logo PNG recebida não perde os bytes se a gravação local falha após vir com ID antigo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ asset: { dataUrl: PNG } })));
    images.put.mockRejectedValue(new Error('IndexedDB indisponível'));
    await applyCloudManifest({ docs: [{ id: 'p1', doc: {
      slides: [{ id: 's1', logoImageAssetId: 'remote', logoImageId: 'stale' }],
      brand: { id: 'b1', logoAssetId: 'remote', logoImageId: 'stale' },
    } }], brands: [] });
    const persisted = JSON.parse(localStorage.getItem(SK.library))[0].doc;
    expect(persisted.slides[0]).toMatchObject({ logoImage: PNG, logoImageId: null });
    expect(persisted.brand).toMatchObject({ logo: PNG, logoImageId: null });
  });
});
