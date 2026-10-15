import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function memoryStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key(index) { return [...map.keys()][index] ?? null; },
    getItem(key) { return map.get(key) ?? null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  };
}

// O browser E2E verifica IndexedDB real; aqui simulamos apenas a transação de
// mídia para exercitar A → B → A e a limpeza de órfãos de forma determinística.
function mediaIndexedDB() {
  const databases = new Map();
  const deleteDatabase = vi.fn((name) => {
    const request = {};
    queueMicrotask(() => { databases.delete(name); request.onsuccess?.(); });
    return request;
  });
  const open = vi.fn((name) => {
    const request = {};
    queueMicrotask(() => {
      let data = databases.get(name);
      const fresh = !data;
      if (!data) {
        data = { stores: new Map() };
        databases.set(name, data);
      }
      const db = {
        objectStoreNames: { contains: (store) => data.stores.has(store) },
        createObjectStore: (store) => { data.stores.set(store, new Map()); },
        close: vi.fn(),
        transaction: (store) => {
          const tx = {};
          let pending = 0;
          const rows = data.stores.get(store);
          tx.objectStore = () => {
            const run = (operation) => {
              const req = {};
              pending += 1;
              queueMicrotask(() => {
                req.result = operation();
                req.onsuccess?.();
                pending -= 1;
                if (pending === 0) queueMicrotask(() => tx.oncomplete?.());
              });
              return req;
            };
            return {
              put: (entry) => run(() => { rows.set(entry.id, entry); return entry.id; }),
              get: (id) => run(() => rows.get(id)),
              getAll: () => run(() => [...rows.values()]),
              getAllKeys: () => run(() => [...rows.keys()]),
              delete: (id) => run(() => rows.delete(id)),
            };
          };
          return tx;
        },
      };
      request.result = db;
      if (fresh) request.onupgradeneeded?.({ target: { result: db } });
      request.onsuccess?.();
    });
    return request;
  });
  return { open, deleteDatabase, databases };
}

const owner = (id) => JSON.stringify(`email:${id}@example.test`);
const photo = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

describe('mídia local por conta', () => {
  let local;
  let session;
  let idb;

  beforeEach(() => {
    vi.resetModules();
    local = memoryStorage();
    session = memoryStorage();
    idb = mediaIndexedDB();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('indexedDB', idb);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('preserva 23 fotos do cofre ao alternar A → B → A, sem mostrá-las em B', async () => {
    const { SK } = await import('../../src/utils/storage.js');
    local.setItem(SK.dataOwner, owner('a'));
    const aLibrary = [{ id: 'projeto-a', doc: {
      slides: Array.from({ length: 23 }, (_, i) => ({ id: `card-${i}`, bgImageId: `foto-a-${i}` })),
    } }];
    local.setItem(SK.library, JSON.stringify(aLibrary));
    const aImages = await import('../../src/utils/image-store.js');
    await Promise.all(aLibrary[0].doc.slides.map((slide) => aImages.imagePut(slide.bgImageId, photo())));
    // Idade suficiente para o cleanup de órfãos da conta B tentar apagar A.
    const rows = idb.databases.get('viral-carrossel-img').stores.get('images');
    for (const entry of rows.values()) entry.savedAt = Date.now() - 120_000;

    const { clearAccountLocalData } = await import('../../src/utils/clear-account-data.js');
    await clearAccountLocalData();
    expect(idb.deleteDatabase).not.toHaveBeenCalled();
    local.setItem(SK.dataOwner, owner('b'));
    local.setItem(SK.library, JSON.stringify([{ id: 'projeto-b', doc: { slides: [{ bgImageId: 'foto-b' }] } }]));
    vi.resetModules();
    const bImages = await import('../../src/utils/image-store.js');
    await bImages.imagePut('foto-b', photo());
    expect(await bImages.imageGet('foto-a-0')).toBeNull();
    expect(await bImages.imageStorageUsage()).toMatchObject({ count: 1 });
    expect(await bImages.imageCleanupOrphans(['foto-b'])).toBe(0);
    expect(rows.size).toBe(24);

    local.setItem(SK.dataOwner, owner('a'));
    local.setItem(SK.library, JSON.stringify(aLibrary));
    vi.resetModules();
    const restoredA = await import('../../src/utils/image-store.js');
    const entries = await Promise.all(aLibrary[0].doc.slides.map((slide) => restoredA.imageGet(slide.bgImageId)));
    expect(entries).toHaveLength(23);
    expect(entries.every((entry) => entry?.blob?.size === 3)).toBe(true);
    expect(await restoredA.imageGet('foto-b')).toBeNull();
  });

  it('arquivo legado sem owner só aparece quando é referenciado pela biblioteca ativa', async () => {
    const { SK } = await import('../../src/utils/storage.js');
    local.setItem(SK.library, JSON.stringify([{ id: 'a', doc: { slides: [{ bgImageId: 'legada' }] } }]));
    const images = await import('../../src/utils/image-store.js');
    await images.imagePut('legada', photo());
    const rows = idb.databases.get('viral-carrossel-img').stores.get('images');
    delete rows.get('legada').owner;
    expect(await images.imageGet('legada')).toBeTruthy();
    local.setItem(SK.dataOwner, owner('b'));
    local.setItem(SK.library, JSON.stringify([{ id: 'b', doc: { slides: [] } }]));
    vi.resetModules();
    const bImages = await import('../../src/utils/image-store.js');
    expect(await bImages.imageGet('legada')).toBeNull();
    expect(await bImages.imageCleanupOrphans([])).toBe(0);
    expect(rows.has('legada')).toBe(true);
  });

  it('mesmo asset ID na nuvem gera uma cópia local de B sem substituir a foto de A', async () => {
    const { SK } = await import('../../src/utils/storage.js');
    local.setItem(SK.dataOwner, owner('a'));
    const aImages = await import('../../src/utils/image-store.js');
    await aImages.imagePut('asset-compartilhado', new Blob(['foto-a'], { type: 'image/png' }));
    local.setItem(SK.dataOwner, owner('b'));
    vi.resetModules();
    const bImages = await import('../../src/utils/image-store.js');
    const result = await bImages.guardarImagemDoSlide('data:image/png;base64,Zm90by1i', { id: 'asset-compartilhado' });
    expect(result.bgImageId).not.toBe('asset-compartilhado');
    expect((await bImages.imageGet(result.bgImageId))?.blob.size).toBe(6);
    local.setItem(SK.dataOwner, owner('a'));
    vi.resetModules();
    const again = await import('../../src/utils/image-store.js');
    expect(await (await again.imageGet('asset-compartilhado')).blob.text()).toBe('foto-a');
  });

  it('vídeo de A não é apagado pelo cleanup da conta B', async () => {
    const { SK } = await import('../../src/utils/storage.js');
    local.setItem(SK.dataOwner, owner('a'));
    local.setItem(SK.library, JSON.stringify([{ id: 'a', doc: { slides: [{ videoId: 'video-a' }] } }]));
    const aVideos = await import('../../src/utils/video-store.js');
    await aVideos.videoPut('video-a', new Blob(['a'], { type: 'video/mp4' }));
    local.setItem(SK.dataOwner, owner('b'));
    local.setItem(SK.library, JSON.stringify([{ id: 'b', doc: { slides: [] } }]));
    vi.resetModules();
    const bVideos = await import('../../src/utils/video-store.js');
    expect(await bVideos.videoGet('video-a')).toBeNull();
    expect(await bVideos.videoCleanupOrphans([])).toBe(0);
    local.setItem(SK.dataOwner, owner('a'));
    vi.resetModules();
    const again = await import('../../src/utils/video-store.js');
    expect((await again.videoGet('video-a'))?.blob.size).toBe(1);
  });

  it('mantém acesso à foto quando o mesmo dono migra de Stripe id para email', async () => {
    const { SK } = await import('../../src/utils/storage.js');
    local.setItem(SK.dataOwner, JSON.stringify('id:cus_1'));
    const before = await import('../../src/utils/image-store.js');
    await before.imagePut('foto-antiga', photo());
    local.setItem(SK.dataOwner, owner('a'));
    local.setItem(SK.dataOwnerAliases, JSON.stringify(['id:cus_1', `email:a@example.test`]));
    vi.resetModules();
    const after = await import('../../src/utils/image-store.js');
    expect((await after.imageGet('foto-antiga'))?.blob.size).toBe(3);
    local.setItem(SK.dataOwner, owner('b'));
    local.setItem(SK.dataOwnerAliases, JSON.stringify([`email:b@example.test`]));
    vi.resetModules();
    const other = await import('../../src/utils/image-store.js');
    expect(await other.imageGet('foto-antiga')).toBeNull();
  });
});
