import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SK } from '../../src/utils/storage.js';
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
