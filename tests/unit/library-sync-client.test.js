import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { originalImageAssetId, CLOUD_IMAGE_MAX_CHARS, CLOUD_IMAGE_PART_CHARS } from '../../src/utils/cloud-image-assets.js';
import { readDeletedProjectIds, rememberDeletedProjectIds } from '../../src/utils/project-deletions.js';
import {
  SK, lsSet, lockAccountDataWrites, unlockAccountDataWrites, areAccountDataWritesLocked,
} from '../../src/utils/storage.js';
import {
  applyCloudManifest, pullLibraryFromCloud, pushLibraryToCloud,
  pushLibraryToCloudBestEffort, reconcileLibraryCloud,
  readCloudMeta, writeCloudMeta, LIBRARY_CLOUD_META_FALLBACK_KEY,
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
    vi.stubGlobal('sessionStorage', makeMemoryStorage());
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

  it('snapshot explícito envia a edição atual mesmo quando localStorage ainda guarda a versão antiga', async () => {
    const old = cloudLibrary(1);
    old.docs[0].doc.slides[0] = { id: 's1', title: 'Texto antigo' };
    local.setItem(SK.library, JSON.stringify(old.docs));
    local.setItem(SK.activeDocId, JSON.stringify('antigo'));
    const current = structuredClone(old.docs);
    current[0].doc.slides[0].title = 'Edição que não coube no cache';
    current.push({ id: 'novo-projeto', name: 'Novo projeto', doc: { slides: [] } });
    const snapshot = {
      library: current, libraryFolders: [{ id: 'f-current', name: 'Pasta atual' }],
      brandRoster: [{ id: 'b-current', name: 'Marca atual' }],
      activeDocId: 'novo-projeto', activeBrandId: 'b-current',
    };
    const { requests } = installCloudApi(old);
    await pushLibraryToCloud({ snapshot, pullAfter: false });
    const { manifest } = requests.find((request) => request.body?.action === 'push').body;
    expect(manifest.docs[0].doc.slides[0].title).toBe('Edição que não coube no cache');
    expect(manifest.docs).toHaveLength(2);
    expect(manifest).toMatchObject({ folders: snapshot.libraryFolders, brands: snapshot.brandRoster,
      activeDocId: snapshot.activeDocId, activeBrandId: snapshot.activeBrandId });
    expect(JSON.parse(local.getItem(SK.library))[0].doc.slides[0].title).toBe('Texto antigo');
  });

  it('pack envia a referência do card como asset separado sem bytes dentro do manifesto', async () => {
    const reference = 'data:image/jpeg;base64,cmVmZXJlbmNpYQ==';
    imageMocks.read.mockImplementation(async (id) => id === 'ref-card-1' ? reference : null);
    const { packLibraryForCloud } = await import('../../src/utils/library-sync.js');
    const packed = await packLibraryForCloud({ library: [{ id: 'p1', doc: {
      slides: [{ id: 's1', refImageId: 'ref-card-1', refImage: null, imgExtraPrompt: 'Preserve o enquadramento' }],
    } }], brandRoster: [], libraryFolders: [] });
    expect(packed.assets.get(await originalImageAssetId(reference))).toBe(reference);
    expect(packed.manifest.docs[0].doc.slides[0]).toMatchObject({
      refImageAssetId: await originalImageAssetId(reference), imgExtraPrompt: 'Preserve o enquadramento', refImage: null,
    });
    expect(JSON.stringify(packed.manifest)).not.toContain('data:image');
  });

  it('pack migra referência data URL legada para um asset e preserva anexo remoto ausente', async () => {
    const { packLibraryForCloud } = await import('../../src/utils/library-sync.js');
    const reference = 'data:image/jpeg;base64,cmVm';
    const packed = await packLibraryForCloud({ library: [{ id: 'p1', doc: { slides: [
      { id: 's1', refImage: reference },
      { id: 's2', refImageId: 'old-browser-id', refImageAssetId: 'remote-reference' },
    ] } }], brandRoster: [], libraryFolders: [] });
    const [legacy, remote] = packed.manifest.docs[0].doc.slides;
    expect(legacy.refImageAssetId).toBeTruthy();
    expect(packed.assets.get(legacy.refImageAssetId)).toBe(reference);
    expect(remote.refImageAssetId).toBe('remote-reference');
    expect(packed.assets.size).toBe(1);
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

  it('pull hidrata a referência do card em IndexedDB com ID estável', async () => {
    const manifest = cloudLibrary(1);
    manifest.docs[0].doc.slides[0] = { id: 's1', refImageAssetId: 'reference-1', refImageId: 'other-browser-id' };
    const { fetchMock } = installCloudApi(manifest);
    const normalFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url, opts) => url.includes('?asset=')
      ? response({ asset: { dataUrl: 'data:image/jpeg;base64,YQ==' } }) : normalFetch(url, opts));
    imageMocks.store.mockImplementation(async (_src, meta) => ({ bgImageId: meta.id, bgImage: 'blob:runtime' }));
    const pulled = await pullLibraryFromCloud();
    expect(imageMocks.store).toHaveBeenCalledWith('data:image/jpeg;base64,YQ==', { id: 'reference-1' });
    expect(pulled.snapshot.library[0].doc.slides[0]).toMatchObject({
      refImageId: 'reference-1', refImageAssetId: 'reference-1', refImage: null, refImageFailed: false,
    });
  });

  it('404 da referência não derruba a lista nem apaga a referência local correspondente', async () => {
    const manifest = cloudLibrary(1);
    manifest.docs[0].doc.slides[0] = { id: 's1', title: 'Texto preservado', refImageAssetId: 'reference-1' };
    const localDoc = structuredClone(manifest.docs[0]);
    localDoc.doc.slides[0].refImageId = 'cached-reference';
    local.setItem(SK.library, JSON.stringify([localDoc]));
    imageMocks.read.mockImplementation(async (id) => id === 'cached-reference' ? 'data:image/jpeg;base64,YQ==' : null);
    imageMocks.store.mockImplementation(async (_src, meta) => ({ bgImageId: meta.id, bgImage: 'blob:runtime' }));
    installCloudApi(manifest);
    const pulled = await pullLibraryFromCloud();
    expect(pulled).toMatchObject({ ok: true, projectCount: 1, assetsMissing: 1 });
    expect(pulled.snapshot.library[0].doc.slides[0]).toMatchObject({
      title: 'Texto preservado', refImageAssetId: 'reference-1', refImageId: 'cached-reference', refImageFailed: false,
    });
  });

  it('pull conserva os bytes da referência quando IndexedDB devolve fallback sem ID', async () => {
    const manifest = cloudLibrary(1);
    manifest.docs[0].doc.slides[0] = { id: 's1', refImageAssetId: 'reference-1' };
    const source = 'data:image/jpeg;base64,YQ==';
    const { fetchMock } = installCloudApi(manifest);
    const normalFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url, opts) => url.includes('?asset=')
      ? response({ asset: { dataUrl: source } }) : normalFetch(url, opts));
    imageMocks.store.mockResolvedValue({ bgImageId: null, bgImage: source });
    const pulled = await pullLibraryFromCloud();
    expect(pulled.snapshot.library[0].doc.slides[0]).toMatchObject({
      refImageAssetId: 'reference-1', refImageId: null, refImage: source, refImageFailed: false,
    });
    expect(JSON.parse(local.getItem(SK.library))[0].doc.slides[0].refImage).toBe(source);
  });

  it('404 mantém a identidade da referência ausente e não reutiliza imagem local de outro anexo', async () => {
    const manifest = cloudLibrary(1);
    manifest.docs[0].doc.slides[0] = { id: 's1', title: 'Texto preservado', refImageAssetId: 'reference-1' };
    const localDoc = structuredClone(manifest.docs[0]);
    localDoc.doc.slides[0] = { id: 's1', refImageId: 'different-reference', refImageAssetId: 'other-asset' };
    local.setItem(SK.library, JSON.stringify([localDoc]));
    imageMocks.read.mockImplementation(async (id) => id === 'different-reference' ? 'data:image/jpeg;base64,YQ==' : null);
    installCloudApi(manifest);
    const pulled = await pullLibraryFromCloud();
    expect(pulled).toMatchObject({ ok: true, projectCount: 1 });
    expect(pulled.snapshot.library[0].doc.slides[0]).toMatchObject({
      title: 'Texto preservado', refImageAssetId: 'reference-1', refImage: null, refImageFailed: true,
    });
    expect(pulled.snapshot.library[0].doc.slides[0].refImageError).toContain('Importe-a novamente');
    expect(imageMocks.read).not.toHaveBeenCalledWith('different-reference');
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

  it('Salvar com snapshot entrega a união verificada ao React mesmo se o cache estiver cheio', async () => {
    const manifest = cloudLibrary();
    manifest.docs.forEach((entry) => { entry.doc.slides[0].bgImageAssetId = null; });
    const original = [structuredClone(manifest.docs[0])];
    original[0].doc.slides[0].title = 'Cache antigo';
    local.setItem(SK.library, JSON.stringify(original));
    local.setItem(SK.libraryFolders, JSON.stringify([{ id: 'old-folder' }]));
    const { requests } = installCloudApi(manifest);
    const setItem = local.setItem.bind(local);
    vi.spyOn(local, 'setItem').mockImplementation((key, value) => {
      if (key === SK.library && JSON.parse(value).length === 5) throw new Error('quota');
      setItem(key, value);
    });
    const beforeApply = vi.fn();
    const result = await pushLibraryToCloud({
      pullAfter: true, beforeApply, snapshot: { library: [manifest.docs[0]], brandRoster: [], libraryFolders: [] },
    });
    expect(result).toMatchObject({ ok: true, cloudSaved: true, localPersisted: false, projectCount: 5, localProjectCount: 5, pullError: '' });
    expect(result.cacheError).toContain('não foi possível gravar a lista');
    expect(JSON.parse(local.getItem(SK.libraryCloudMeta)).localPersisted).toBe(false);
    expect(result.snapshot.library).toMatchObject(manifest.docs);
    expect(beforeApply).toHaveBeenCalledTimes(1);
    expect(requests.find((request) => request.body?.action === 'push').body.manifest.docs[0].doc.slides[0].title).toBe('Texto 1');
    expect(JSON.parse(local.getItem(SK.library))).toEqual(original);
    expect(JSON.parse(local.getItem(SK.libraryFolders))).toEqual([{ id: 'old-folder' }]);
    expect(areAccountDataWritesLocked()).toBe(true);
    expect(lsSet(SK.library, original)).toBe(false);
  });

  it('snapshot explícito não relaxa verificação de versão e contagem recebidas da nuvem', async () => {
    const manifest = cloudLibrary();
    local.setItem(SK.library, JSON.stringify([manifest.docs[0]]));
    const { fetchMock } = installCloudApi(manifest);
    const normalFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url, opts) => url.includes('?full=1')
      ? response({ manifest: cloudLibrary(2) }) : normalFetch(url, opts));
    const result = await pushLibraryToCloud({ snapshot: { library: [manifest.docs[0]] }, pullAfter: true });
    expect(result).toMatchObject({ ok: false, cloudSaved: true, snapshot: null });
    expect(result.pullError).toContain('confirmou 5 projeto(s)');
    expect(areAccountDataWritesLocked()).toBe(false);
  });

  it('snapshot explícito mantém o guard do cache e recusa edição concorrente antes do push', async () => {
    const manifest = cloudLibrary(1);
    const { fetchMock } = installCloudApi(manifest);
    const normalFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url, opts) => {
      if (JSON.parse(opts?.body || '{}').action === 'status') local.setItem(SK.library, JSON.stringify([{ id: 'new-local' }]));
      return normalFetch(url, opts);
    });
    await expect(pushLibraryToCloud({ snapshot: { library: manifest.docs } })).rejects.toThrow('A biblioteca mudou');
    expect(fetchMock.mock.calls.some(([, opts]) => JSON.parse(opts?.body || '{}').action === 'push')).toBe(false);
  });

  it('snapshot usa a referência atual em memória no 404 e preserva o guard de edição React', async () => {
    const manifest = cloudLibrary(1);
    manifest.docs[0].doc.slides[0] = { id: 's1', title: 'Texto atual', refImageAssetId: 'reference-now' };
    local.setItem(SK.library, JSON.stringify([{ id: 'p1', doc: { slides: [{ id: 's1', title: 'Cache antigo' }] } }]));
    const current = structuredClone(manifest.docs);
    current[0].doc.slides[0].refImage = 'data:image/jpeg;base64,YQ==';
    imageMocks.store.mockImplementation(async (_src, meta) => ({ bgImageId: meta.id, bgImage: 'blob:runtime' }));
    installCloudApi(manifest);
    const result = await pushLibraryToCloud({ snapshot: { library: current }, pullAfter: true });
    expect(result.snapshot.library[0].doc.slides[0]).toMatchObject({ refImageId: 'reference-now', refImageFailed: false });
    unlockAccountDataWrites();
    const editedAgain = await pushLibraryToCloud({
      snapshot: { library: current }, pullAfter: true,
      beforeApply: () => { throw new Error('A edição atual mudou enquanto sincronizava.'); },
    });
    expect(editedAgain).toMatchObject({ ok: false, cloudSaved: true, snapshot: null });
    expect(editedAgain.pullError).toContain('edição atual mudou');
    expect(areAccountDataWritesLocked()).toBe(false);
  });

  it('referência legada sem ID usa o original preparado após confirmação do upload', async () => {
    const source = 'data:image/jpeg;base64,YQ==';
    let uploadedManifest;
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const body = JSON.parse(opts?.body || '{}');
      if (body.action === 'status') return response({ ok: true, empty: true });
      if (body.action === 'push') {
        uploadedManifest = { ...body.manifest, revision: 1 };
        return response({ ok: true, projectCount: 1, revision: 1 });
      }
      if (body.action === 'putAsset') return response({ ok: true });
      if (url.includes('?asset=')) return response({ error: 'Asset não encontrado.' }, 404);
      return response({ ok: true, manifest: uploadedManifest });
    }));
    imageMocks.store.mockImplementation(async (_src, meta) => ({ bgImageId: meta.id, bgImage: 'blob:runtime' }));
    const result = await pushLibraryToCloud({ pullAfter: true, snapshot: { library: [{
      id: 'p1', doc: { slides: [{ id: 's1', refImage: source }] },
    }] } });
    expect(result).toMatchObject({ ok: true, assetsMissing: 0 });
    const restored = result.snapshot.library[0].doc.slides[0];
    expect(restored.refImageId).toBe(uploadedManifest.docs[0].doc.slides[0].refImageAssetId);
    expect(restored.refImageFailed).toBe(false);
    expect(imageMocks.store).toHaveBeenCalledWith(source, { id: restored.refImageId });
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

  it('boot com cache cheio aplica a união ao React antes de liberar autosave, sem reload stale', async () => {
    const manifest = cloudLibrary();
    local.setItem(SK.library, JSON.stringify([manifest.docs[0]]));
    const setItem = local.setItem.bind(local);
    vi.spyOn(local, 'setItem').mockImplementation((key, value) => {
      if (key === SK.library && JSON.parse(value).length > 1) throw new Error('quota');
      setItem(key, value);
    });
    const replace = vi.fn();
    vi.stubGlobal('window', { location: { href: 'https://example.test/?app=1', replace } });
    installCloudApi(manifest);
    const toast = vi.fn();
    const onApplied = vi.fn(async (snapshot, receipt) => {
      expect(areAccountDataWritesLocked()).toBe(true);
      expect(snapshot.library).toHaveLength(5);
      expect(receipt.localPersisted).toBe(false);
      expect(toast).not.toHaveBeenCalled();
      unlockAccountDataWrites();
    });
    expect(await reconcileLibraryCloud({ toast, onApplied })).toBe('ok');
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(JSON.parse(local.getItem(SK.library))).toHaveLength(1);
    expect(toast.mock.calls[0]).toEqual([expect.stringContaining('navegador continua sem espaço'), 'warning', 5000]);
    expect(replace).not.toHaveBeenCalled();
  });

  it('cofre restaurado vence a cache antiga e envia a edição atual mesmo com localPersisted false', async () => {
    vi.stubGlobal('window', { location: { href: 'https://example.test/', replace: vi.fn() } });
    const stale = cloudLibrary(1).docs;
    local.setItem(SK.library, JSON.stringify(stale));
    local.setItem(SK.libraryCloudMeta, JSON.stringify({ revision: 3, projectCount: 1, localPersisted: false }));
    const current = structuredClone(stale);
    current[0].updatedAt = 900;
    current[0].doc.slides[0].title = 'Edição recuperada do cofre';
    const localSnapshot = { library: current, brandRoster: [], libraryFolders: [] };
    const merged = cloudLibrary(2);
    merged.docs[0] = structuredClone(current[0]);
    const { requests } = installCloudApi(merged);
    const setItem = local.setItem.bind(local);
    vi.spyOn(local, 'setItem').mockImplementation((key, value) => {
      if (key === SK.library) throw new Error('quota');
      setItem(key, value);
    });
    const onApplied = vi.fn((snapshot, result) => {
      expect(snapshot.library).toHaveLength(2);
      expect(snapshot.library[0].doc.slides[0].title).toBe('Edição recuperada do cofre');
      expect(result.localPersisted).toBe(false);
      unlockAccountDataWrites();
    });
    expect(await reconcileLibraryCloud({ localSnapshot, onApplied })).toBe('ok');
    const pushed = requests.find(({ body }) => body?.action === 'push').body.manifest;
    expect(pushed.docs[0].doc.slides[0].title).toBe('Edição recuperada do cofre');
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(JSON.parse(local.getItem(SK.library))[0].doc.slides[0].title).toBe(stale[0].doc.slides[0].title);
  });

  it('falha na nuvem não bloqueia a edição já restaurada do cofre mesmo com cache antiga marcada', async () => {
    vi.stubGlobal('window', { location: { href: 'https://example.test/', replace: vi.fn() } });
    local.setItem(SK.libraryCloudMeta, JSON.stringify({ revision: 3, projectCount: 1, localPersisted: false }));
    const localSnapshot = { library: cloudLibrary(1).docs, brandRoster: [], libraryFolders: [] };
    const before = structuredClone(localSnapshot);
    vi.stubGlobal('fetch', vi.fn(async () => response({ error: 'Rede indisponível.' }, 503)));
    const onApplied = vi.fn();
    const toast = vi.fn();
    expect(await reconcileLibraryCloud({ localSnapshot, onApplied, toast })).toBe('skipped');
    expect(localSnapshot).toEqual(before);
    expect(onApplied).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Rede indisponível.', 'warning', 5500);
  });

  it('marcador de cache stale obriga pull antes de qualquer push e limpa o marcador após persistir', async () => {
    const manifest = cloudLibrary();
    const stale = [structuredClone(manifest.docs[0])];
    stale[0].doc.slides[0].title = 'Edição velha do cache';
    local.setItem(SK.library, JSON.stringify(stale));
    local.setItem(SK.libraryCloudMeta, JSON.stringify({ localPersisted: false, revision: 4, projectCount: 5 }));
    const { requests } = installCloudApi(manifest);
    vi.stubGlobal('window', { location: { href: 'https://example.test/', replace: vi.fn() } });
    const onApplied = vi.fn(async (snapshot) => {
      expect(snapshot.library[0].doc.slides[0].title).toBe('Texto 1');
      unlockAccountDataWrites();
    });
    expect(await reconcileLibraryCloud({ onApplied })).toBe('ok');
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(requests.some((request) => request.body?.action === 'push')).toBe(false);
    expect(JSON.parse(local.getItem(SK.libraryCloudMeta)).localPersisted).toBe(true);
    expect(JSON.parse(local.getItem(SK.library))).toHaveLength(5);
  });

  it('recibo needsPull restaura a versão da nuvem antes de reenviar uma lista stale de igual tamanho', async () => {
    const manifest = cloudLibrary(1);
    const stale = structuredClone(manifest.docs);
    stale[0].doc.slides[0].title = 'Versão antiga deste browser';
    local.setItem(SK.library, JSON.stringify(stale));
    local.setItem(SK.libraryCloudMeta, JSON.stringify({
      localPersisted: true, needsPull: true, revision: 3,
      pendingRevision: manifest.revision, projectCount: 1,
    }));
    const { requests } = installCloudApi(manifest);
    vi.stubGlobal('window', { location: { href: 'https://example.test/', replace: vi.fn() } });
    const onApplied = vi.fn((snapshot) => {
      expect(snapshot.library[0].doc.slides[0].title).toBe('Texto 1');
      unlockAccountDataWrites();
    });

    expect(await reconcileLibraryCloud({ onApplied })).toBe('ok');
    expect(requests.some((request) => request.body?.action === 'push')).toBe(false);
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(JSON.parse(local.getItem(SK.libraryCloudMeta)).needsPull).toBeUndefined();
  });

  it.each(['status', 'pull', 'empty', 'old-revision'])('cache stale e falha %s bloqueiam o boot sem push nem aplicar dados velhos', async (failure) => {
    const manifest = cloudLibrary();
    local.setItem(SK.library, JSON.stringify([manifest.docs[0]]));
    local.setItem(SK.libraryCloudMeta, JSON.stringify({ localPersisted: false, revision: 4, projectCount: 5 }));
    const { requests, fetchMock } = installCloudApi(manifest);
    const normalFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url, opts) => {
      const isStatus = JSON.parse(opts?.body || '{}').action === 'status';
      if ((failure === 'status' && isStatus) || (failure === 'pull' && url.includes('?full=1'))) {
        return response({ error: 'Rede temporariamente indisponível.' }, 503);
      }
      if (failure === 'empty' && url.includes('?full=1')) return response({ empty: true });
      if (failure === 'old-revision' && url.includes('?full=1')) return response({ manifest: { ...manifest, revision: 3 } });
      return normalFetch(url, opts);
    });
    vi.stubGlobal('window', { location: { href: 'https://example.test/', replace: vi.fn() } });
    const onApplied = vi.fn();
    const toast = vi.fn();
    expect(await reconcileLibraryCloud({ onApplied, toast })).toBe('blocked');
    expect(onApplied).not.toHaveBeenCalled();
    expect(requests.some((request) => request.body?.action === 'push')).toBe(false);
    expect(JSON.parse(local.getItem(SK.library))).toHaveLength(1);
    expect(JSON.parse(local.getItem(SK.libraryCloudMeta)).localPersisted).toBe(false);
    expect(toast.mock.calls[0][0]).toContain('cópia deste navegador está desatualizada');
  });

  it('auto-push não remove o marcador de cache stale antes de um pull persistido', async () => {
    const manifest = cloudLibrary(1);
    local.setItem(SK.library, JSON.stringify(manifest.docs));
    local.setItem(SK.libraryCloudMeta, JSON.stringify({ localPersisted: false, revision: 4 }));
    installCloudApi(manifest);
    await pushLibraryToCloud({ snapshot: { library: manifest.docs }, pullAfter: false });
    expect(JSON.parse(local.getItem(SK.libraryCloudMeta)).localPersisted).toBe(false);
  });

  it('cache e metadados recusados deixam recibo na aba e bloqueiam boot offline sem push stale', async () => {
    const manifest = cloudLibrary();
    local.setItem(SK.dataOwner, JSON.stringify('email:a@example.test'));
    local.setItem(SK.library, JSON.stringify([manifest.docs[0]]));
    local.setItem(SK.libraryCloudMeta, JSON.stringify({ localPersisted: true, revision: 4, updatedAt: 800, recordedAt: 1 }));
    const setItem = local.setItem.bind(local);
    vi.spyOn(local, 'setItem').mockImplementation((key, value) => {
      if ([SK.library, SK.libraryCloudMeta].includes(key)) throw new Error('quota');
      setItem(key, value);
    });
    const { requests, fetchMock } = installCloudApi(manifest);
    const result = await pushLibraryToCloud({ snapshot: { library: [manifest.docs[0]] }, pullAfter: true });
    expect(result.localPersisted).toBe(false);
    expect(JSON.parse(local.getItem(SK.libraryCloudMeta)).localPersisted).toBe(true);
    expect(readCloudMeta().localPersisted).toBe(false);
    const fallback = JSON.parse(sessionStorage.getItem(LIBRARY_CLOUD_META_FALLBACK_KEY));
    expect(fallback.owner).toBe(JSON.stringify('email:a@example.test'));
    expect(JSON.stringify(fallback).length).toBeLessThan(500);
    unlockAccountDataWrites();
    const pushesBeforeReload = requests.filter((request) => request.body?.action === 'push').length;
    fetchMock.mockResolvedValue(response({ error: 'Offline.' }, 503));
    vi.stubGlobal('window', { location: { href: 'https://example.test/', replace: vi.fn() } });
    const onApplied = vi.fn();
    expect(await reconcileLibraryCloud({ onApplied })).toBe('blocked');
    expect(onApplied).not.toHaveBeenCalled();
    expect(requests.filter((request) => request.body?.action === 'push')).toHaveLength(pushesBeforeReload);
  });

  it('recibo de sessionStorage não atravessa conta e só prevalece sobre metadados mais antigos', () => {
    local.setItem(SK.dataOwner, JSON.stringify('email:a@example.test'));
    local.setItem(SK.libraryCloudMeta, JSON.stringify({ revision: 5, updatedAt: 900, localPersisted: true }));
    sessionStorage.setItem(LIBRARY_CLOUD_META_FALLBACK_KEY, JSON.stringify({
      owner: JSON.stringify('email:a@example.test'),
      meta: { revision: 4, updatedAt: 800, recordedAt: Date.now(), localPersisted: false },
    }));
    expect(readCloudMeta()).toMatchObject({ revision: 5, localPersisted: true });
    sessionStorage.setItem(LIBRARY_CLOUD_META_FALLBACK_KEY, JSON.stringify({
      owner: JSON.stringify('email:a@example.test'),
      meta: { revision: 6, updatedAt: 1000, recordedAt: Date.now(), localPersisted: false },
    }));
    expect(readCloudMeta()).toMatchObject({ revision: 6, localPersisted: false });
    local.setItem(SK.dataOwner, JSON.stringify('email:b@example.test'));
    expect(readCloudMeta()).toMatchObject({ revision: 5, localPersisted: true });
  });

  it('gravação confirmada em localStorage remove o fallback da aba sem espelhar metadados', () => {
    local.setItem(SK.dataOwner, JSON.stringify('email:a@example.test'));
    sessionStorage.setItem(LIBRARY_CLOUD_META_FALLBACK_KEY, JSON.stringify({
      owner: JSON.stringify('email:a@example.test'),
      meta: { revision: 4, updatedAt: 800, localPersisted: false },
    }));
    expect(writeCloudMeta({ revision: 5, updatedAt: 900, localPersisted: true })).toBe(true);
    expect(readCloudMeta()).toMatchObject({ revision: 5, localPersisted: true });
    expect(sessionStorage.getItem(LIBRARY_CLOUD_META_FALLBACK_KEY)).toBeNull();
  });

  it('best-effort de logout só envia e não modifica lista nem meta após o lock', async () => {
    const original = [cloudLibrary(1).docs[0]];
    local.setItem(SK.library, JSON.stringify(original));
    lockAccountDataWrites();
    const { requests } = installCloudApi(cloudLibrary());
    expect(await pushLibraryToCloudBestEffort()).toMatchObject({ ok: true, cloudSaved: true, assetsFailed: 0 });
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
    expect(await pending).toMatchObject({ ok: false, cloudSaved: false, pushError: 'Tempo de sincronização esgotado.' });
    expect(pushSignal.aborted).toBe(true);
    local.clear();
    releasePush(response({ ok: true, projectCount: 5, revision: 10 }));
    await vi.advanceTimersByTimeAsync(1);
    expect(local.getItem(SK.libraryCloudMeta)).toBeNull();
    expect(local.getItem(SK.library)).toBeNull();
  });

  it('reenvia uma foto referenciada no manifesto cujo upload anterior falhou', async () => {
    const manifest = cloudLibrary(1);
    const photo = 'data:image/jpeg;base64,YQ==';
    manifest.assetIds = [await originalImageAssetId(photo)];
    const localDoc = structuredClone(manifest.docs[0]);
    localDoc.doc.slides[0] = { id: 's1', title: 'Oi', bgImageId: 'photo-1', bgImage: 'data:image/jpeg;base64,YQ==' };
    local.setItem(SK.library, JSON.stringify([localDoc]));
    const { requests } = installCloudApi(manifest);
    const result = await pushLibraryToCloud({ pullAfter: false });
    expect(result.assetsUploaded).toBe(1);
    expect(requests.filter((request) => request.body?.action === 'putAsset')).toHaveLength(1);
  });

  it('retoma depois do timeout sem reenviar fotos já confirmadas nem confiar em resposta tardia', async () => {
    local.setItem(SK.dataOwner, 'email:resume@example.test');
    const firstPhoto = 'data:image/png;base64,Zmlyc3Q=';
    const secondPhoto = 'data:image/png;base64,c2Vjb25k';
    const firstId = await originalImageAssetId(firstPhoto);
    const secondId = await originalImageAssetId(secondPhoto);
    const snapshot = { library: [{ id: 'p1', doc: { slides: [
      { id: 's1', bgImage: firstPhoto }, { id: 's2', bgImage: secondPhoto },
    ] } }] };
    const { fetchMock, requests } = installCloudApi(cloudLibrary(1));
    const normalFetch = fetchMock.getMockImplementation();
    let releaseSecond;
    let signal;
    let interruptedId;
    let uploads = 0;
    let secondStarted;
    const started = new Promise((resolve) => { secondStarted = resolve; });
    fetchMock.mockImplementation((url, opts) => {
      const body = JSON.parse(opts.body || '{}');
      if (body.action === 'putAsset' && ++uploads === 2) {
        signal = opts.signal;
        interruptedId = body.assetId;
        secondStarted();
        return new Promise((resolve) => { releaseSecond = resolve; });
      }
      return normalFetch(url, opts);
    });
    const pending = pushLibraryToCloudBestEffort(150, { snapshot });
    await started;
    expect(await pending).toMatchObject({ ok: false, cloudSaved: false });
    expect(signal.aborted).toBe(true);
    releaseSecond(response({ ok: true, assetId: interruptedId }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    fetchMock.mockImplementation(normalFetch);
    expect(await pushLibraryToCloudBestEffort(5_000, { snapshot })).toMatchObject({
      ok: true, cloudSaved: true, assetsUploaded: 1, assetsSkipped: 1, assetsFailed: 0,
    });
    expect(requests.filter(({ body }) => body?.action === 'putAsset').map(({ body }) => body.assetId).sort())
      .toEqual([firstId, secondId].sort());
  });

  it('só guarda recibo de uma resposta que confirma o upload, mesmo com HTTP 200', async () => {
    local.setItem(SK.dataOwner, 'email:failed-upload@example.test');
    const snapshot = { library: [{ id: 'p1', doc: { slides: [
      { id: 's1', refImage: 'data:image/png;base64,ZmFpbGVk' },
    ] } }] };
    const { fetchMock } = installCloudApi(cloudLibrary(1));
    const normalFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url, opts) => JSON.parse(opts.body || '{}').action === 'putAsset'
      ? response({ ok: false }) : normalFetch(url, opts));
    expect(await pushLibraryToCloud({ snapshot, pullAfter: false })).toMatchObject({
      assetsUploaded: 0, assetsSkipped: 0, assetsFailed: 1,
    });
    fetchMock.mockImplementation(normalFetch);
    expect(await pushLibraryToCloud({ snapshot, pullAfter: false })).toMatchObject({
      assetsUploaded: 1, assetsSkipped: 0, assetsFailed: 0,
    });
    expect(await pushLibraryToCloud({ snapshot, pullAfter: false })).toMatchObject({
      assetsUploaded: 0, assetsSkipped: 1, assetsFailed: 0,
    });
  });

  it('chunks só geram recibo quando a última resposta confirma a imagem completa', async () => {
    local.setItem(SK.dataOwner, 'email:chunk-upload@example.test');
    const photo = `data:image/png;base64,${'A'.repeat(CLOUD_IMAGE_PART_CHARS)}`;
    const snapshot = { library: [{ id: 'p1', doc: { slides: [{ id: 's1', bgImage: photo }] } }] };
    const { fetchMock } = installCloudApi(cloudLibrary(1));
    const normalFetch = fetchMock.getMockImplementation();
    let complete = false;
    let parts = 0;
    fetchMock.mockImplementation((url, opts) => {
      const body = JSON.parse(opts.body || '{}');
      if (body.action === 'putAssetChunk') {
        parts += 1;
        return response({ ok: true, assetId: body.assetId, complete: complete && body.index === body.total - 1 });
      }
      return normalFetch(url, opts);
    });
    expect(await pushLibraryToCloud({ snapshot, pullAfter: false })).toMatchObject({
      assetsUploaded: 0, assetsFailed: 1,
    });
    expect(parts).toBe(4);
    complete = true;
    expect(await pushLibraryToCloud({ snapshot, pullAfter: false })).toMatchObject({
      assetsUploaded: 1, assetsSkipped: 0, assetsFailed: 0,
    });
    expect(parts).toBe(6);
    expect(await pushLibraryToCloud({ snapshot, pullAfter: false })).toMatchObject({
      assetsUploaded: 0, assetsSkipped: 1, assetsFailed: 0,
    });
    expect(parts).toBe(6);
  });

  it('recibos não atravessam contas e uma troca de conta durante o upload não cria recibo', async () => {
    const ownerA = 'email:upload-account-a@example.test';
    local.setItem(SK.dataOwner, ownerA);
    const snapshot = { library: [{ id: 'p1', doc: { slides: [
      { id: 's1', bgImage: 'data:image/png;base64,YWNjb3VudA==' },
    ] } }] };
    const { fetchMock, requests } = installCloudApi(cloudLibrary(1));
    const normalFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url, opts) => {
      if (JSON.parse(opts.body || '{}').action === 'putAsset') {
        local.setItem(SK.dataOwner, 'email:upload-account-b@example.test');
      }
      return normalFetch(url, opts);
    });
    await expect(pushLibraryToCloud({ snapshot, pullAfter: false })).rejects.toThrow('A conta mudou');
    fetchMock.mockImplementation(normalFetch);
    expect(await pushLibraryToCloud({ snapshot, pullAfter: false })).toMatchObject({ assetsUploaded: 1, assetsSkipped: 0 });
    local.setItem(SK.dataOwner, ownerA);
    expect(await pushLibraryToCloud({ snapshot, pullAfter: false })).toMatchObject({ assetsUploaded: 1, assetsSkipped: 0 });
    expect(requests.filter(({ body }) => body?.action === 'putAsset')).toHaveLength(3);
  });

  it('cancelamento externo interrompe best-effort imediatamente e não envia o próximo asset', async () => {
    local.setItem(SK.dataOwner, 'email:cancel-upload@example.test');
    const snapshot = { library: [{ id: 'p1', doc: { slides: [
      { id: 's1', bgImage: 'data:image/png;base64,Y2FuY2VsLTE=' },
      { id: 's2', bgImage: 'data:image/png;base64,Y2FuY2VsLTI=' },
    ] } }] };
    const { fetchMock } = installCloudApi(cloudLibrary(1));
    const normalFetch = fetchMock.getMockImplementation();
    let release;
    let start;
    const started = new Promise((resolve) => { start = resolve; });
    let uploads = 0;
    fetchMock.mockImplementation((url, opts) => {
      if (JSON.parse(opts.body || '{}').action === 'putAsset') {
        uploads += 1;
        start();
        return new Promise((resolve) => { release = resolve; });
      }
      return normalFetch(url, opts);
    });
    const controller = new AbortController();
    const pending = pushLibraryToCloudBestEffort(60_000, { snapshot, signal: controller.signal });
    await started;
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, cloudSaved: false, pushError: 'Sincronização cancelada.' });
    release(response({ ok: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(uploads).toBe(1);
    fetchMock.mockImplementation(normalFetch);
    expect(await pushLibraryToCloudBestEffort(5_000, { snapshot })).toMatchObject({
      assetsUploaded: 2, assetsSkipped: 0, assetsFailed: 0,
    });
  });

  it('cancelar um push concorrente não cancela o outro nem apaga seu recibo', async () => {
    local.setItem(SK.dataOwner, 'email:parallel-upload@example.test');
    const snapshot = { library: [{ id: 'p1', doc: { slides: [
      { id: 's1', bgImage: 'data:image/png;base64,cGFyYWxsZWw=' },
    ] } }] };
    const { fetchMock } = installCloudApi(cloudLibrary(1));
    const normalFetch = fetchMock.getMockImplementation();
    let release;
    let start;
    const started = new Promise((resolve) => { start = resolve; });
    fetchMock.mockImplementation((url, opts) => {
      if (JSON.parse(opts.body || '{}').action === 'putAsset') {
        start();
        return new Promise((resolve) => { release = resolve; });
      }
      return normalFetch(url, opts);
    });
    const controller = new AbortController();
    const first = pushLibraryToCloudBestEffort(60_000, { snapshot, signal: controller.signal });
    await started;
    fetchMock.mockImplementation(normalFetch);
    const second = await pushLibraryToCloudBestEffort(5_000, { snapshot });
    expect(second).toMatchObject({ ok: true, assetsUploaded: 1, assetsFailed: 0 });
    controller.abort();
    expect(await first).toMatchObject({ ok: false });
    release(response({ ok: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await pushLibraryToCloudBestEffort(5_000, { snapshot })).toMatchObject({
      ok: true, assetsUploaded: 0, assetsSkipped: 1, assetsFailed: 0,
    });
  });

  it('logout envia o snapshot em memória com lock e devolve falhas de imagem para impedir descarte', async () => {
    const manifest = cloudLibrary(1);
    local.setItem(SK.library, JSON.stringify(manifest.docs));
    const { fetchMock, requests } = installCloudApi(manifest);
    const normalFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url, opts) => JSON.parse(opts?.body || '{}').action === 'putAsset'
      ? response({ error: 'Upload indisponível.' }, 503) : normalFetch(url, opts));
    lockAccountDataWrites();
    const snapshot = { library: [{ id: 'p1', doc: { slides: [{
      id: 's1', title: 'Edição só em memória', refImage: 'data:image/jpeg;base64,YQ==',
    }] } }] };
    const result = await pushLibraryToCloudBestEffort(5_000, { snapshot });
    expect(result).toMatchObject({ ok: true, cloudSaved: true, assetsFailed: 1, assetsUploaded: 0 });
    expect(result.assetError).toBe('Upload indisponível.');
    expect(requests.find((request) => request.body?.action === 'push').body.manifest.docs[0].doc.slides[0].title).toBe('Edição só em memória');
    expect(requests.some((request) => request.url.includes('?full=1'))).toBe(false);
    expect(JSON.parse(local.getItem(SK.library))).toEqual(manifest.docs);
  });

  it('imagem acima do limite interrompe o push antes de restaurar uma foto antiga', async () => {
    const manifest = cloudLibrary(1);
    const { requests } = installCloudApi(manifest);
    const { packLibraryForCloud } = await import('../../src/utils/library-sync.js');
    const snapshot = { library: [{ id: 'p1', doc: { slides: [
      { id: 's1', refImageAssetId: 'old-photo', refImage: `data:image/jpeg;base64,${'A'.repeat(CLOUD_IMAGE_MAX_CHARS)}` },
      { id: 's2', refImageId: 'old-missing-reference', refImageAssetId: 'old-cloud-reference' },
    ] } }] };
    const packed = await packLibraryForCloud(snapshot);
    expect(packed.packingFailed).toBe(1);
    expect(packed.assets.size).toBe(0);
    await expect(pushLibraryToCloud({ snapshot, pullAfter: true })).rejects.toThrow('Os originais continuam neste navegador');
    expect(requests.some(({ body }) => body?.action === 'push')).toBe(false);
    expect(imageMocks.store).not.toHaveBeenCalled();
  });

  it('rejeita manifesto inválido sem substituir a biblioteca por uma lista vazia', async () => {
    local.setItem(SK.library, JSON.stringify([{ id: 'existing' }]));
    await expect(applyCloudManifest({ docs: null })).rejects.toThrow('Manifesto da nuvem inválido');
    expect(JSON.parse(local.getItem(SK.library))).toEqual([{ id: 'existing' }]);
  });

  it('push confirmado conserva exclusões e não reenvia projetos de uma lista stale', async () => {
    const cloud = cloudLibrary(1);
    const { requests } = installCloudApi(cloud);
    local.setItem(SK.library, JSON.stringify(cloudLibrary(2).docs));
    rememberDeletedProjectIds(['p2']);
    await pushLibraryToCloud({ pullAfter: false });
    const sent = requests.find(({ body }) => body?.action === 'push').body.manifest;
    expect(sent.docs.map(entry => entry.id)).toEqual(['p1']);
    expect(sent.deletedIds).toEqual(['p2']);
    expect(readDeletedProjectIds()).toEqual(['p2']);
    expect(JSON.parse(local.getItem(SK.libraryDeletedIds))).toEqual(['p2']);
    expect(JSON.parse(local.getItem(SK.libraryCloudMeta)).projectCount).toBe(1);
  });

  it('push sem pull não grava na meta uma contagem maior do que a lista local', async () => {
    local.setItem(SK.library, JSON.stringify(cloudLibrary(1).docs));
    const fetchMock = vi.fn(async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : null;
      if (body?.action === 'push') return response({ ok: true, revision: 9, updatedAt: 900, projectCount: 5 });
      if (body?.action === 'status') return response({ ok: true, meta: { revision: 9, projectCount: 5 } });
      throw new Error(`Pedido inesperado: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    await pushLibraryToCloud({ pullAfter: false });
    const meta = JSON.parse(local.getItem(SK.libraryCloudMeta));
    expect(meta.projectCount).toBe(1);
    expect(meta.needsPull).toBe(true);
  });

  it('GET falho com contagem igual conserva revisão local e pede novo pull', async () => {
    local.setItem(SK.library, JSON.stringify(cloudLibrary(1).docs));
    local.setItem(SK.libraryCloudMeta, JSON.stringify({ revision: 3, updatedAt: 700, projectCount: 1, needsPull: false }));
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : null;
      if (body?.action === 'status') return response({ ok: true, meta: { revision: 4, projectCount: 1 } });
      if (body?.action === 'push') return response({ ok: true, revision: 5, updatedAt: 900, projectCount: 1 });
      if (url.includes('?full=1')) return response({ error: 'temporariamente indisponível' }, 503);
      throw new Error(`Pedido inesperado: ${url}`);
    }));
    const result = await pushLibraryToCloud({ pullAfter: true });
    expect(result).toMatchObject({ ok: false, cloudSaved: true, projectCount: 1 });
    const meta = JSON.parse(local.getItem(SK.libraryCloudMeta));
    expect(meta).toMatchObject({ revision: 3, updatedAt: 700, projectCount: 1,
      needsPull: true, pendingRevision: 5 });
  });

  it('falha de aplicação do pull libera o lease da outra aba imediatamente', async () => {
    const manifest = cloudLibrary(1);
    installCloudApi(manifest);
    local.setItem(SK.library, JSON.stringify([{ id: 'anterior', doc: { slides: [] } }]));
    const setItem = local.setItem.bind(local);
    vi.spyOn(local, 'setItem').mockImplementation((key, value) => {
      if (key === SK.library) throw new Error('quota');
      setItem(key, value);
    });
    await expect(applyCloudManifest(manifest)).rejects.toThrow('Libere espaço');
    expect(local.getItem('vc_account_write_lock')).toBeNull();
    expect(areAccountDataWritesLocked()).toBe(false);
  });

  it('pull reúne exclusões locais e remotas antes de restaurar a lista', async () => {
    const manifest = { ...cloudLibrary(3), deletedIds: ['p2'], activeDocId: 'p2' };
    installCloudApi(manifest);
    rememberDeletedProjectIds(['p3']);
    const result = await applyCloudManifest(manifest);
    expect(result.projectCount).toBe(1);
    expect(result.snapshot.library.map(entry => entry.id)).toEqual(['p1']);
    expect(result.snapshot.activeDocId).toBe('p1');
    expect(result.snapshot.deletedIds).toEqual(['p2', 'p3']);
    expect(readDeletedProjectIds()).toEqual(['p2', 'p3']);
  });

  it('exclusão com quota e tombstone recuperado do cofre entram no push', async () => {
    const original = local.setItem;
    local.setItem = (key, value) => {
      if (key === SK.libraryDeletedIds) throw new DOMException('quota', 'QuotaExceededError');
      original(key, value);
    };
    rememberDeletedProjectIds(['p2']);
    const { packLibraryForCloud } = await import('../../src/utils/library-sync.js');
    const packed = await packLibraryForCloud({ library: cloudLibrary(3).docs, deletedIds: ['p3'] });
    expect(packed.manifest.docs.map(entry => entry.id)).toEqual(['p1']);
    expect(packed.manifest.deletedIds).toEqual(['p2', 'p3']);
    expect(packed.projectCount).toBe(1);
  });
});
