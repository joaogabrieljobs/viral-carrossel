import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SK, lsSet, lockAccountDataWrites, unlockAccountDataWrites, areAccountDataWritesLocked,
} from '../../src/utils/storage.js';
import {
  applyCloudManifest, pullLibraryFromCloud, pushLibraryToCloud,
  pushLibraryToCloudBestEffort, reconcileLibraryCloud,
} from '../../src/utils/library-sync.js';

const imageMocks = vi.hoisted(() => ({
  read: vi.fn(),
  store: vi.fn(),
}));

vi.mock('../../src/utils/image-store.js', async (importOriginal) => ({
  ...(await importOriginal()),
  imagemComoDataUrl: imageMocks.read,
  guardarImagemDoSlide: imageMocks.store,
}));

function response(data, status = 200) {
  return new Response(JSON.stringify(data), { status });
}

function cloudLibrary(count = 5) {
  return {
    revision: 4,
    updatedAt: 800,
    activeDocId: 'p1',
    activeBrandId: 'b1',
    brands: [{ id: 'b1', name: 'Marca' }],
    folders: [{ id: 'f1', name: 'Clientes' }],
    docs: Array.from({ length: count }, (_, index) => ({
      id: `p${index + 1}`,
      name: index === 0 ? 'Clínica Janine' : `Projeto ${index + 1}`,
      updatedAt: 500,
      doc: {
        slides: [{ id: `s${index + 1}`, title: `Texto ${index + 1}`, bgImageAssetId: 'missing-photo' }],
        brand: { name: 'Marca' },
        styleKit: { contextMd: 'Brief preservado', refImages: [] },
      },
    })),
  };
}

function installCloudApi(manifest) {
  const requests = [];
  const fetchMock = vi.fn(async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ url, body, signal: options.signal });
    if (url.includes('?asset=')) return response({ error: 'Asset não encontrado.' }, 404);
    if (url.includes('?full=1')) return response({ ok: true, manifest });
    if (body?.action === 'status') return response({
      ok: true,
      meta: { revision: manifest.revision, projectCount: manifest.docs.length, assetIds: manifest.assetIds || [] },
    });
    if (body?.action === 'push') return response({
      ok: true, revision: manifest.revision, updatedAt: manifest.updatedAt, projectCount: manifest.docs.length,
    });
    if (body?.action === 'putAsset') return response({ ok: true });
    throw new Error(`Pedido inesperado: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { requests, fetchMock };
}

function makeMemoryStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key(i) { return [...map.keys()][i] ?? null; },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
  };
}

describe('library-sync client pack', () => {
  let local;

  beforeEach(() => {
    local = makeMemoryStorage();
    vi.stubGlobal('localStorage', local);
    unlockAccountDataWrites();
    imageMocks.read.mockReset().mockResolvedValue(null);
    imageMocks.store.mockReset().mockResolvedValue({ bgImageId: 'restored-photo', bgImage: 'blob:restored' });
  });

  afterEach(() => {
    unlockAccountDataWrites();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('packLibraryForCloud monta manifesto com projetos locais', async () => {
    local.setItem(SK.library, JSON.stringify([
      {
        id: 'p1',
        name: 'Carrossel',
        doc: {
          slides: [{ id: 's1', title: 'Oi', bgImageId: null, bgImage: null }],
          brand: { id: 'default', name: 'Marca' },
          styleKit: { contextMd: 'brief', refImages: [] },
        },
      },
    ]));
    local.setItem(SK.libraryFolders, JSON.stringify([]));
    local.setItem(SK.brands, JSON.stringify([{ id: 'default', name: 'Marca' }]));
    local.setItem(SK.activeBrandId, JSON.stringify('default'));
    local.setItem(SK.activeDocId, JSON.stringify('p1'));

    const { packLibraryForCloud } = await import('../../src/utils/library-sync.js');
    const { manifest, projectCount, assets } = await packLibraryForCloud();
    expect(projectCount).toBe(1);
    expect(manifest.docs[0].name).toBe('Carrossel');
    expect(manifest.docs[0].doc.slides[0].title).toBe('Oi');
    expect(manifest.vcVersion).toBe(3);
    expect(assets.size).toBe(0);
  });

  it('localLibraryFingerprint reflecte updatedAt e contagem', async () => {
    local.setItem(SK.library, JSON.stringify([
      { id: 'a', updatedAt: 100 },
      { id: 'b', updatedAt: 500, createdAt: 1 },
    ]));
    const { localLibraryFingerprint } = await import('../../src/utils/library-sync.js');
    expect(localLibraryFingerprint()).toEqual({ count: 2, maxUpdated: 500 });
  });

  it('pull restaura todos os textos mesmo com asset 404 e entrega o snapshot para React', async () => {
    const manifest = cloudLibrary();
    const { requests } = installCloudApi(manifest);
    const pulled = await pullLibraryFromCloud();

    expect(pulled).toMatchObject({ ok: true, projectCount: 5, assetsMissing: 1 });
    expect(pulled.snapshot).toMatchObject({
      activeDocId: 'p1', activeBrandId: 'b1', libraryFolders: manifest.folders, brandRoster: manifest.brands,
    });
    expect(pulled.snapshot.library.map((entry) => entry.name)).toContain('Clínica Janine');
    expect(pulled.snapshot.library[4].doc.slides[0].title).toBe('Texto 5');
    expect(JSON.parse(local.getItem(SK.library))).toHaveLength(5);
    expect(requests.filter((request) => request.url.includes('?asset='))).toHaveLength(1);
    expect(pulled.warnings[0]).toContain('todos os projetos foram restaurados');
  });

  it('trava pagehide/autosave stale antes de devolver o pull', async () => {
    installCloudApi(cloudLibrary());
    await pullLibraryFromCloud();
    expect(areAccountDataWritesLocked()).toBe(true);
    expect(lsSet(SK.library, [{ id: 'old-react-project' }])).toBe(false);
    expect(JSON.parse(local.getItem(SK.library))).toHaveLength(5);
    unlockAccountDataWrites();
    expect(lsSet(SK.library, [{ id: 'new-project' }])).toBe(true);
  });

  it('hidrata fotos com ID estável e persiste sem URLs de runtime', async () => {
    const manifest = cloudLibrary(1);
    const { fetchMock } = installCloudApi(manifest);
    const normalFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url, opts) => url.includes('?asset=')
      ? response({ asset: { dataUrl: 'data:image/jpeg;base64,YQ==' } }) : normalFetch(url, opts));
    imageMocks.store.mockImplementation(async (_src, meta) => ({ bgImageId: meta.id, bgImage: 'blob:runtime-photo' }));
    const pulled = await pullLibraryFromCloud();
    expect(imageMocks.store).toHaveBeenCalledWith('data:image/jpeg;base64,YQ==', { id: 'missing-photo' });
    expect(pulled.snapshot.library[0].doc.slides[0].bgImage).toBe('blob:runtime-photo');
    const storedSlide = JSON.parse(local.getItem(SK.library))[0].doc.slides[0];
    expect(storedSlide.bgImageId).toBe('missing-photo');
    expect(storedSlide.bgImage).toBeUndefined();
  });

  it('mantém a foto local da mesma imagem quando o asset remoto retorna 404', async () => {
    const manifest = cloudLibrary(1);
    const localDoc = structuredClone(manifest.docs[0]);
    localDoc.doc.slides[0].bgImageId = 'cached-photo-id';
    local.setItem(SK.library, JSON.stringify([localDoc]));
    imageMocks.read.mockImplementation(async (id) => id === 'cached-photo-id' ? 'data:image/jpeg;base64,YQ==' : null);
    installCloudApi(manifest);
    const pulled = await pullLibraryFromCloud();
    expect(pulled.snapshot.library[0].doc.slides[0]).toMatchObject({
      bgImageAssetId: 'missing-photo', bgImageId: 'cached-photo-id', bgImage: 'data:image/jpeg;base64,YQ==',
    });
    expect(JSON.parse(local.getItem(SK.library))[0].doc.slides[0].bgImageId).toBe('cached-photo-id');
  });

  it('preserva referências remotas no próximo push quando fotos e logos faltam', async () => {
    const manifest = cloudLibrary(1);
    manifest.docs[0].doc.slides[0].logoImageAssetId = 'missing-logo';
    manifest.docs[0].doc.slides[0].logoImageId = 'old-local-logo';
    manifest.docs[0].doc.brand.logoAssetId = 'missing-logo';
    manifest.docs[0].doc.styleKit.refImages = [{ name: 'Referência', assetId: 'missing-reference' }];
    installCloudApi(manifest);
    const pulled = await pullLibraryFromCloud();
    expect(pulled.assetsMissing).toBe(3);
    unlockAccountDataWrites();
    const { packLibraryForCloud } = await import('../../src/utils/library-sync.js');
    const packed = await packLibraryForCloud();
    expect(packed.manifest.docs[0].doc.slides[0]).toMatchObject({
      bgImageAssetId: 'missing-photo', logoImageAssetId: 'missing-logo',
    });
    expect(packed.manifest.docs[0].doc.brand.logoAssetId).toBe('missing-logo');
    expect(packed.manifest.docs[0].doc.styleKit.refImages[0].assetId).toBe('missing-reference');
  });

  it('Salvar recebe a união da nuvem e reporta a contagem realmente aplicada localmente', async () => {
    const manifest = cloudLibrary();
    local.setItem(SK.library, JSON.stringify([manifest.docs[0]]));
    const { requests } = installCloudApi(manifest);
    const result = await pushLibraryToCloud({ pullAfter: true });

    expect(result).toMatchObject({ ok: true, projectCount: 5, localProjectCount: 5, pullError: '', assetsMissing: 1 });
    expect(result.snapshot.library).toHaveLength(5);
    expect(JSON.parse(local.getItem(SK.library))).toHaveLength(5);
    expect(requests.find((request) => request.body?.action === 'push').body.replace).toBe(false);
    expect(requests.some((request) => request.url.includes('?full=1'))).toBe(true);
  });

  it.each([
    { label: 'lista de 2 na mesma revisão que confirmou 5', count: 2, revision: 4, message: 'confirmou 5 projeto(s)' },
    { label: 'revisão anterior à confirmação do push', count: 5, revision: 3, message: 'versão anterior' },
  ])('recusa $label antes de alterar a biblioteca local', async ({ count, revision, message }) => {
    const cloud = cloudLibrary();
    const original = [cloud.docs[0]];
    local.setItem(SK.library, JSON.stringify(original));
    const { fetchMock } = installCloudApi(cloud);
    const normalFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url, opts) => url.includes('?full=1')
      ? response({ manifest: { ...cloudLibrary(count), revision } }) : normalFetch(url, opts));
    const beforeApply = vi.fn();
    const result = await pushLibraryToCloud({ pullAfter: true, beforeApply });

    expect(result).toMatchObject({ ok: false, projectCount: 5, localProjectCount: 1, snapshot: null });
    expect(result.pullError).toContain(message);
    expect(beforeApply).not.toHaveBeenCalled();
    expect(JSON.parse(local.getItem(SK.library))).toEqual(original);
    expect(areAccountDataWritesLocked()).toBe(false);
  });

  it('aceita uma revisão mais nova recebida após alteração concorrente na nuvem', async () => {
    const cloud = cloudLibrary();
    local.setItem(SK.library, JSON.stringify([cloud.docs[0]]));
    const { fetchMock } = installCloudApi(cloud);
    const normalFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url, opts) => url.includes('?full=1')
      ? response({ manifest: { ...cloudLibrary(2), revision: 5 } }) : normalFetch(url, opts));

    const result = await pushLibraryToCloud({ pullAfter: true });
    expect(result).toMatchObject({ ok: true, revision: 5, projectCount: 2, localProjectCount: 2 });
    expect(result.snapshot.library).toHaveLength(2);
    expect(JSON.parse(local.getItem(SK.library))).toHaveLength(2);
  });

  it('não reporta sucesso quando a persistência da lista falha e restaura as chaves anteriores', async () => {
    const original = [cloudLibrary(1).docs[0]];
    local.setItem(SK.library, JSON.stringify(original));
    local.setItem(SK.libraryFolders, JSON.stringify([{ id: 'old-folder' }]));
    installCloudApi(cloudLibrary());
    const setItem = local.setItem.bind(local);
    vi.spyOn(local, 'setItem').mockImplementation((key, value) => {
      if (key === SK.library && JSON.parse(value).length === 5) throw new Error('quota');
      setItem(key, value);
    });

    const result = await pushLibraryToCloud({ pullAfter: true });
    expect(result.ok).toBe(false);
    expect(result.pullError).toContain('não foi possível gravar a lista');
    expect(result.snapshot).toBeNull();
    expect(result.localProjectCount).toBe(1);
    expect(JSON.parse(local.getItem(SK.library))).toEqual(original);
    expect(JSON.parse(local.getItem(SK.libraryFolders))).toEqual([{ id: 'old-folder' }]);
    expect(areAccountDataWritesLocked()).toBe(false);
  });

  it('preserva novo projeto criado enquanto aguardava o download', async () => {
    const newer = [{ id: 'new-local-project', name: 'Novo projeto' }];
    vi.stubGlobal('fetch', vi.fn(async () => {
      local.setItem(SK.library, JSON.stringify(newer));
      return response({ manifest: cloudLibrary() });
    }));
    await expect(pullLibraryFromCloud()).rejects.toThrow('A biblioteca mudou');
    expect(JSON.parse(local.getItem(SK.library))).toEqual(newer);
    expect(local.getItem(SK.libraryCloudMeta)).toBeNull();
  });

  it('beforeApply preserva edição do React ainda pendente no debounce local', async () => {
    const manifest = cloudLibrary();
    local.setItem(SK.library, JSON.stringify([manifest.docs[0]]));
    installCloudApi(manifest);
    const edited = structuredClone(manifest.docs[0]);
    edited.doc.slides[0].title = 'Edição feita durante o download';
    const beforeApply = vi.fn(() => {
      local.setItem(SK.library, JSON.stringify([edited]));
    });
    const result = await pushLibraryToCloud({ pullAfter: true, beforeApply });
    expect(beforeApply).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.pullError).toContain('A biblioteca mudou');
    expect(JSON.parse(local.getItem(SK.library))[0].doc.slides[0].title).toBe(edited.doc.slides[0].title);
  });

  it('não aplica dados de uma conta depois de logout ou troca de conta', async () => {
    local.setItem(SK.dataOwner, JSON.stringify('email:a@example.test'));
    vi.stubGlobal('fetch', vi.fn(async () => {
      local.setItem(SK.dataOwner, JSON.stringify('email:b@example.test'));
      return response({ manifest: cloudLibrary() });
    }));
    await expect(pullLibraryFromCloud()).rejects.toThrow('A conta mudou');
    expect(local.getItem(SK.library)).toBeNull();
    expect(local.getItem(SK.libraryCloudMeta)).toBeNull();
  });

  it('não aplica dados se logout travou as gravações durante a hidratação', async () => {
    const { fetchMock } = installCloudApi(cloudLibrary());
    const normalFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (url, opts) => {
      if (url.includes('?asset=')) lockAccountDataWrites();
      return normalFetch(url, opts);
    });
    await expect(pullLibraryFromCloud()).rejects.toThrow('A conta mudou');
    expect(local.getItem(SK.library)).toBeNull();
  });

  it('login aplica snapshot à UI mesmo com meta na mesma revisão e lista local menor', async () => {
    const manifest = cloudLibrary();
    local.setItem(SK.library, JSON.stringify([manifest.docs[0]]));
    local.setItem(SK.libraryCloudMeta, JSON.stringify({ revision: manifest.revision, projectCount: 5 }));
    const replace = vi.fn();
    vi.stubGlobal('window', { location: { href: 'https://example.test/?app=1', replace } });
    installCloudApi(manifest);
    const toast = vi.fn();
    let uiLibrary = [];
    const onApplied = vi.fn(async (snapshot) => {
      expect(areAccountDataWritesLocked()).toBe(true);
      uiLibrary = snapshot.library;
      unlockAccountDataWrites();
    });
    expect(await reconcileLibraryCloud({ toast, onApplied })).toBe('ok');
    expect(uiLibrary).toHaveLength(5);
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    expect(toast.mock.calls[0][0]).toContain('5 projeto(s)');
  });

  it('login num navegador vazio entrega os cinco projetos antes do toast', async () => {
    vi.stubGlobal('window', { location: { href: 'https://example.test/', replace: vi.fn() } });
    const { requests } = installCloudApi(cloudLibrary());
    const toast = vi.fn();
    const onApplied = vi.fn(async (snapshot) => {
      expect(toast).not.toHaveBeenCalled();
      expect(snapshot.library).toHaveLength(5);
      unlockAccountDataWrites();
    });
    expect(await reconcileLibraryCloud({ toast, onApplied })).toBe('ok');
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(requests.some((request) => request.body?.action === 'push')).toBe(false);
  });

  it('best-effort de logout só envia e não modifica lista nem meta após o lock', async () => {
    const original = [cloudLibrary(1).docs[0]];
    local.setItem(SK.library, JSON.stringify(original));
    lockAccountDataWrites();
    const { requests } = installCloudApi(cloudLibrary());
    expect(await pushLibraryToCloudBestEffort()).toBe(true);
    expect(requests.some((request) => request.url.includes('?full=1'))).toBe(false);
    expect(JSON.parse(local.getItem(SK.library))).toEqual(original);
    expect(local.getItem(SK.libraryCloudMeta)).toBeNull();
  });

  it('timeout aborta o push e uma resposta atrasada não recria meta após logout', async () => {
    vi.useFakeTimers();
    local.setItem(SK.library, JSON.stringify([cloudLibrary(1).docs[0]]));
    const { fetchMock } = installCloudApi(cloudLibrary());
    const normalFetch = fetchMock.getMockImplementation();
    let releasePush;
    let pushSignal;
    fetchMock.mockImplementation((url, opts) => {
      if (JSON.parse(opts.body || '{}').action === 'push') {
        pushSignal = opts.signal;
        return new Promise((resolve) => { releasePush = resolve; });
      }
      return normalFetch(url, opts);
    });
    const pending = pushLibraryToCloudBestEffort(50);
    await vi.advanceTimersByTimeAsync(50);
    expect(await pending).toBe(false);
    expect(pushSignal.aborted).toBe(true);
    local.clear();
    releasePush(response({ ok: true, projectCount: 5, revision: 10 }));
    await vi.advanceTimersByTimeAsync(1);
    expect(local.getItem(SK.libraryCloudMeta)).toBeNull();
    expect(local.getItem(SK.library)).toBeNull();
  });

  it('reenvia uma foto referenciada no manifesto cujo upload anterior falhou', async () => {
    const manifest = cloudLibrary(1);
    manifest.assetIds = ['photo-1'];
    const localDoc = structuredClone(manifest.docs[0]);
    localDoc.doc.slides[0] = { id: 's1', title: 'Oi', bgImageId: 'photo-1', bgImage: 'data:image/jpeg;base64,YQ==' };
    local.setItem(SK.library, JSON.stringify([localDoc]));
    const { requests } = installCloudApi(manifest);
    const result = await pushLibraryToCloud({ pullAfter: false });
    expect(result.assetsUploaded).toBe(1);
    expect(requests.filter((request) => request.body?.action === 'putAsset')).toHaveLength(1);
  });

  it('rejeita manifesto inválido sem substituir a biblioteca por uma lista vazia', async () => {
    local.setItem(SK.library, JSON.stringify([{ id: 'existing' }]));
    await expect(applyCloudManifest({ docs: null })).rejects.toThrow('Manifesto da nuvem inválido');
    expect(JSON.parse(local.getItem(SK.library))).toEqual([{ id: 'existing' }]);
  });
});
