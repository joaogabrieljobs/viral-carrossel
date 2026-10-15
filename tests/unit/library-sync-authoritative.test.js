import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SK } from '../../src/utils/storage.js';
import { semImagensDeRuntime } from '../../src/utils/image-store.js';
import { originalImageAssetId } from '../../src/utils/cloud-image-assets.js';
import { rememberDeletedProjectIds } from '../../src/utils/project-deletions.js';
import {
  packLibraryForCloud, pullAccountLibraryAuthoritative, hydrateProjectEntryFromCloud,
} from '../../src/utils/library-sync.js';

const imageMocks = vi.hoisted(() => ({ read: vi.fn(), store: vi.fn() }));
vi.mock('../../src/utils/image-store.js', async (importOriginal) => ({
  ...(await importOriginal()),
  imagemComoDataUrl: imageMocks.read,
  guardarImagemDoSlide: imageMocks.store,
}));

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
  };
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function manifest() {
  return {
    customerId: 'cus_janine', revision: 4, updatedAt: 500,
    activeDocId: 'janine', activeBrandId: 'brand',
    brands: [{ id: 'brand', name: 'Clínica Janine' }], folders: [],
    deletedIds: ['deleted-remotely'],
    docs: [
      { id: 'janine', name: 'Clínica Janine', doc: {
        slides: [{ id: 's1', title: 'Cuidados', bgImageAssetId: 'missing-photo' }],
        brand: { id: 'brand' }, styleKit: { refImages: [] },
      } },
      { id: 'other', name: 'Outro projeto', doc: {
        slides: [{ id: 's2', title: 'Outro', bgImageAssetId: 'other-photo' }],
        brand: { id: 'brand' }, styleKit: { refImages: [] },
      } },
    ],
  };
}

describe('leitura autoritativa da biblioteca v2', () => {
  let local;
  let requests;

  beforeEach(() => {
    local = memoryStorage();
    requests = [];
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', memoryStorage());
    local.setItem(SK.dataOwner, JSON.stringify('email:janine@example.com'));
    imageMocks.read.mockReset().mockResolvedValue(null);
    imageMocks.store.mockReset().mockResolvedValue({ bgImageId: 'stored-photo', bgImage: 'blob:stored' });
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      requests.push({ url, options });
      if (url.includes('?full=1')) return response({ ok: true, manifest: manifest() });
      if (url.includes('?asset=')) return response({ error: 'Asset não encontrado.' }, 404);
      throw new Error(`Pedido inesperado: ${url}`);
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const owner = {
    expectedOwnerId: 'cus_janine', localOwnerId: 'email:janine@example.com',
  };

  it('restaura projeto vivo apesar de tombstone local antigo e não grava cache antes do React', async () => {
    rememberDeletedProjectIds(['janine']);
    local.setItem(SK.library, JSON.stringify([{ id: 'stale', name: 'Stale' }]));
    const before = local.getItem(SK.library);
    const deletionsBefore = local.getItem(SK.libraryDeletedIds);
    const write = vi.spyOn(local, 'setItem');

    const result = await pullAccountLibraryAuthoritative({ ...owner, hydrateImages: 'none' });

    expect(result.snapshot.library.map((project) => project.id)).toEqual(['janine', 'other']);
    expect(result.snapshot.deletedIds).toEqual(['deleted-remotely']);
    expect(result.projectCount).toBe(2);
    expect(result.localPersisted).toBe(false);
    expect(local.getItem(SK.library)).toBe(before);
    expect(local.getItem(SK.libraryDeletedIds)).toBe(deletionsBefore);
    expect(write).not.toHaveBeenCalled();
    expect(requests.filter(({ url }) => url.includes('?asset='))).toHaveLength(0);
  });

  it('asset 404 não bloqueia textos nem lista e baixa apenas o projeto selecionado', async () => {
    const result = await pullAccountLibraryAuthoritative({ ...owner, selectedProjectId: 'janine' });

    expect(result).toMatchObject({ ok: true, projectCount: 2, assetsMissing: 1 });
    expect(result.snapshot.library[0].doc.slides[0].title).toBe('Cuidados');
    expect(result.snapshot.library[1].doc.slides[0].title).toBe('Outro');
    expect(requests.filter(({ url }) => url.includes('?asset='))).toHaveLength(1);
    expect(requests.some(({ url }) => url.includes('other-photo'))).toBe(false);
  });

  it('permite hidratar o detalhe de outro projeto sob demanda', async () => {
    const result = await hydrateProjectEntryFromCloud(manifest().docs[1]);
    expect(result.entry.doc.slides[0].title).toBe('Outro');
    expect(result.assetsMissing).toBe(1);
    expect(requests.filter(({ url }) => url.includes('?asset='))).toHaveLength(1);
  });

  it('informa progresso monotônico quando fotos terminam fora de ordem e uma retorna 404', async () => {
    const entry = {
      id: 'janine', doc: { slides: [
        { id: 's1', title: 'Primeiro', bgImageAssetId: 'photo-1' },
        { id: 's2', title: 'Segundo', bgImageAssetId: 'photo-2' },
        { id: 's3', title: 'Sem foto remota' },
        { id: 's4', title: 'Quarto', bgImageAssetId: 'photo-4' },
      ] },
    };
    const original = structuredClone(entry);
    const pending = new Map();
    vi.stubGlobal('fetch', vi.fn((url) => new Promise((resolve) => {
      const assetId = new URL(url, 'https://moont.test').searchParams.get('asset');
      pending.set(assetId, resolve);
    })));
    const events = [];
    const resultPromise = hydrateProjectEntryFromCloud(entry, {
      onProgress: (progress) => events.push(progress),
    });
    await vi.waitFor(() => expect(pending.size).toBe(3));

    pending.get('photo-2')(response({ asset: { dataUrl: 'data:image/jpeg;base64,YQ==' } }));
    await vi.waitFor(() => expect(events).toHaveLength(1));
    pending.get('photo-4')(response({ error: 'Asset não encontrado.' }, 404));
    await vi.waitFor(() => expect(events).toHaveLength(2));
    pending.get('photo-1')(response({ asset: { dataUrl: 'data:image/jpeg;base64,YQ==' } }));
    const result = await resultPromise;

    expect(events).toEqual([
      { projectId: 'janine', completed: 1, total: 3, loaded: 1, missing: 0 },
      { projectId: 'janine', completed: 2, total: 3, loaded: 1, missing: 1 },
      { projectId: 'janine', completed: 3, total: 3, loaded: 2, missing: 1 },
    ]);
    expect(result.assetsMissing).toBe(1);
    expect(result.entry.doc.slides.map((slide) => slide.title)).toEqual(
      original.doc.slides.map((slide) => slide.title));
    expect(entry).toEqual(original);
  });

  it('ignora falha do observador de progresso e não emite eventos sem fotos', async () => {
    const onProgress = vi.fn(() => { throw new Error('falha na interface'); });
    const withPhoto = await hydrateProjectEntryFromCloud(manifest().docs[0], { onProgress });
    expect(withPhoto.entry.doc.slides[0].title).toBe('Cuidados');
    expect(onProgress).toHaveBeenCalledWith({
      projectId: 'janine', completed: 1, total: 1, loaded: 0, missing: 1,
    });

    onProgress.mockClear();
    const withoutPhoto = await hydrateProjectEntryFromCloud({
      id: 'empty', doc: { slides: [{ id: 'text-only', title: 'Texto' }] },
    }, { onProgress });
    expect(withoutPhoto.entry.doc.slides[0].title).toBe('Texto');
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('mostra foto baixada sem IndexedDB, mas persiste só a referência do asset remoto', async () => {
    const photo = 'data:image/jpeg;base64,YQ==';
    imageMocks.store.mockResolvedValue({ bgImage: photo, bgImageId: null });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cloud-photo');
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url.includes('?asset=')) return response({ asset: { dataUrl: photo } });
      throw new Error(`Pedido inesperado: ${url}`);
    }));

    const { entry } = await hydrateProjectEntryFromCloud(manifest().docs[0]);
    const slide = entry.doc.slides[0];
    expect(slide).toMatchObject({ bgImage: 'blob:cloud-photo', bgImageId: null,
      bgImageAssetId: 'missing-photo' });
    const persisted = semImagensDeRuntime([entry]);
    expect(persisted[0].doc.slides[0].bgImage).toBeUndefined();
    expect(JSON.stringify(persisted)).not.toContain('data:image');
    const packed = await packLibraryForCloud({ library: [entry], brandRoster: [], libraryFolders: [] });
    expect(packed.manifest.docs[0].doc.slides[0].bgImageAssetId).toBe('missing-photo');
    expect(packed.assets.size).toBe(0);
  });

  it('preserva a única cópia local quando o asset ainda não foi baixado da nuvem', async () => {
    const photo = 'data:image/jpeg;base64,YQ==';
    const assetId = await originalImageAssetId(photo);
    const project = manifest().docs[0];
    project.doc.slides[0].bgImageAssetId = assetId;
    imageMocks.store.mockResolvedValue({ bgImage: photo, bgImageId: null });

    const { entry } = await hydrateProjectEntryFromCloud(project, {
      localAssets: new Map([[assetId, photo]]),
    });

    expect(entry.doc.slides[0].bgImage).toBe(photo);
    expect(semImagensDeRuntime([entry])[0].doc.slides[0].bgImage).toBe(photo);
    expect(requests.filter(({ url }) => url.includes('?asset='))).toHaveLength(0);
  });

  it('vazio confirmado pela mesma conta substitui a lista stale por zero', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      requests.push({ url, options });
      if (url.includes('?full=1')) return response({ empty: true }, 404);
      if (JSON.parse(options.body || '{}').action === 'status') {
        return response({ ok: true, empty: true, customerId: 'cus_janine' });
      }
      throw new Error(`Pedido inesperado: ${url}`);
    }));
    local.setItem(SK.library, JSON.stringify([{ id: 'stale' }]));
    const result = await pullAccountLibraryAuthoritative(owner);
    expect(result).toMatchObject({ ok: true, empty: true, projectCount: 0 });
    expect(result.snapshot.library).toEqual([]);
    expect(local.getItem(SK.library)).toContain('stale');
  });

  it('rejeita manifesto de outra conta antes de atualizar o React', async () => {
    const wrong = { ...manifest(), customerId: 'cus_someone_else' };
    vi.stubGlobal('fetch', vi.fn(async () => response({ ok: true, manifest: wrong })));
    const onBeforeApply = vi.fn();
    await expect(pullAccountLibraryAuthoritative({ ...owner, onBeforeApply }))
      .rejects.toThrow('outra conta');
    expect(onBeforeApply).not.toHaveBeenCalled();
  });

  it('empacotamento v2 ignora exclusão local já refutada pela nuvem', async () => {
    rememberDeletedProjectIds(['janine']);
    const packed = await packLibraryForCloud({
      library: [{ id: 'janine', name: 'Clínica Janine', doc: { slides: [] } }],
      brandRoster: [], libraryFolders: [], deletedIds: [], ignoreLocalDeletedIds: true,
    });
    expect(packed.manifest.docs.map((project) => project.id)).toEqual(['janine']);
    expect(packed.manifest.deletedIds).toEqual([]);
  });
});
