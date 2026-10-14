import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const blob = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn() }));
vi.mock('@vercel/blob', () => blob);
import {
  getLibrarySyncMeta,
  getLibraryManifest,
  putLibraryManifest,
  putLibraryAsset,
  getLibraryAsset,
  resetLibrarySyncStoreForTests,
  resolveLibraryOwnerId,
} from '../../api/lib/library-sync-store.js';

describe('library-sync-store', () => {
  beforeEach(() => {
    resetLibrarySyncStoreForTests();
    vi.clearAllMocks();
    vi.stubEnv('VITEST', 'true');
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('isola manifesto por customerId', async () => {
    await putLibraryManifest('cus_aaa', {
      docs: [{ id: '1', name: 'A', doc: { slides: [] } }],
      folders: [],
      brands: [],
      assetIds: [],
    });
    await putLibraryManifest('cus_bbb', {
      docs: [{ id: '2', name: 'B', doc: { slides: [] } }],
      folders: [],
      brands: [],
      assetIds: [],
    });

    const a = await getLibraryManifest('cus_aaa');
    const b = await getLibraryManifest('cus_bbb');
    expect(a.docs[0].name).toBe('A');
    expect(b.docs[0].name).toBe('B');
    expect(a.customerId).toBe('cus_aaa');
    expect(b.customerId).toBe('cus_bbb');
  });

  it('incrementa revision e detecta conflito', async () => {
    const first = await putLibraryManifest('cus_x', {
      docs: [{ id: '1', name: 'v1', doc: {} }],
      assetIds: [],
    });
    expect(first.meta.revision).toBe(1);

    const second = await putLibraryManifest('cus_x', {
      docs: [{ id: '1', name: 'v2', doc: {} }],
      assetIds: [],
    }, { baseRevision: 1 });
    expect(second.meta.revision).toBe(2);

    await expect(
      putLibraryManifest('cus_x', {
        docs: [{ id: '1', name: 'stale', doc: {} }],
        assetIds: [],
      }, { baseRevision: 1 }),
    ).rejects.toMatchObject({ code: 'library_conflict' });

    const forced = await putLibraryManifest('cus_x', {
      docs: [{ id: '1', name: 'force', doc: {} }],
      assetIds: [],
    }, { force: true });
    expect(forced.manifest.docs[0].name).toBe('force');
    expect(forced.meta.revision).toBe(3);
  });

  it('grava e lê assets por conta', async () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    await putLibraryAsset('cus_img', 'img_1', { dataUrl, contentType: 'image/jpeg' });
    const got = await getLibraryAsset('cus_img', 'img_1');
    expect(got.dataUrl).toContain('data:image/jpeg;base64,');
    expect(await getLibraryAsset('cus_other', 'img_1')).toBeNull();

    const meta = await getLibrarySyncMeta('cus_missing');
    expect(meta).toBeNull();
  });

  it('resolveLibraryOwnerId prefere customerId e cai para email', () => {
    expect(resolveLibraryOwnerId({ customerId: 'cus_abc', email: 'a@b.com' })).toBe('cus_abc');
    expect(resolveLibraryOwnerId({ email: 'A@B.com' })).toBe('em_a_b_com');
    expect(resolveLibraryOwnerId({ billingDisabled: true })).toBe('billing-disabled');
  });

  it('merge por defeito não apaga projetos que só existem na nuvem', async () => {
    await putLibraryManifest('cus_merge', {
      docs: [
        { id: 'a', name: 'Clínica', updatedAt: 100, doc: {} },
        { id: 'b', name: 'Carrossel', updatedAt: 100, doc: {} },
      ],
      assetIds: [],
    });
    const merged = await putLibraryManifest('cus_merge', {
      docs: [
        { id: 'c', name: 'Novo', updatedAt: 200, doc: {} },
      ],
      assetIds: [],
    }, { force: true });
    const ids = merged.manifest.docs.map((d) => d.id).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
    expect(merged.meta.projectCount).toBe(3);
  });

  it('replace=true pode encolher; deletedIds remove no merge', async () => {
    await putLibraryManifest('cus_del', {
      docs: [
        { id: 'keep', name: 'Keep', updatedAt: 1, doc: {} },
        { id: 'gone', name: 'Gone', updatedAt: 1, doc: {} },
      ],
      assetIds: [],
    });
    const afterDel = await putLibraryManifest('cus_del', {
      docs: [{ id: 'keep', name: 'Keep', updatedAt: 2, doc: {} }],
      deletedIds: ['gone'],
      assetIds: [],
    }, { force: true });
    expect(afterDel.manifest.docs.map((d) => d.id)).toEqual(['keep']);

    const replaced = await putLibraryManifest('cus_del', {
      docs: [{ id: 'only', name: 'Only', updatedAt: 3, doc: {} }],
      assetIds: [],
    }, { force: true, replace: true });
    expect(replaced.manifest.docs.map((d) => d.id)).toEqual(['only']);
  });

  describe('consistência Blob/Redis em produção', () => {
    const customerId = 'cus_production';
    const metaKey = `vc:library-sync:meta:${customerId}`;
    let redis;
    let requests;

    function manifest(revision, count, updatedAt = revision * 100) {
      return {
        customerId,
        revision,
        updatedAt,
        docs: Array.from({ length: count }, (_, i) => ({ id: `p${i}`, updatedAt, doc: {} })),
        folders: [], brands: [], assetIds: [],
      };
    }

    function setBlob(value) {
      blob.get.mockImplementation(async () => value ? { stream: new Response(JSON.stringify(value)).body } : null);
    }

    function setRedis(value, { full = true } = {}) {
      redis.set(metaKey, JSON.stringify({
        customerId,
        revision: value.revision,
        updatedAt: value.updatedAt,
        projectCount: value.docs.length,
        assetIds: [],
      }));
      if (full) redis.set(`${metaKey}:full`, JSON.stringify(value));
    }

    beforeEach(() => {
      vi.stubEnv('VITEST', 'false');
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test');
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test');
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
      redis = new Map();
      requests = [];
      vi.stubGlobal('fetch', vi.fn(async (_url, opts) => {
        const [operation, key, value] = JSON.parse(opts.body);
        requests.push([operation, key]);
        if (operation === 'SET') redis.set(key, value);
        return new Response(JSON.stringify({ result: operation === 'GET' ? redis.get(key) || null : 'OK' }));
      }));
      blob.put.mockReset().mockResolvedValue({});
      setBlob(null);
    });

    it('status e pull usam a versão Redis mais nova quando Blob ficou antigo', async () => {
      setBlob(manifest(1, 2));
      setRedis(manifest(2, 5));

      expect((await getLibraryManifest(customerId)).docs).toHaveLength(5);
      expect(await getLibrarySyncMeta(customerId)).toMatchObject({ revision: 2, projectCount: 5 });
    });

    it('ignora meta Redis antiga quando Blob tem a revisão actual', async () => {
      setBlob(manifest(3, 5));
      setRedis(manifest(2, 2));

      expect(await getLibrarySyncMeta(customerId)).toMatchObject({ revision: 3, projectCount: 5 });
      expect((await getLibraryManifest(customerId)).docs).toHaveLength(5);
    });

    it('desempata revisões pelo updatedAt do manifesto verificado', async () => {
      setBlob(manifest(2, 2, 100));
      setRedis(manifest(2, 5, 200));

      expect(await getLibrarySyncMeta(customerId)).toMatchObject({ revision: 2, updatedAt: 200, projectCount: 5 });
    });

    it('fallback de escrita para Redis mantém os projectos no próximo pull e merge', async () => {
      setBlob(manifest(1, 2));
      setRedis(manifest(1, 2), { full: false });
      blob.put.mockRejectedValue(new Error('Blob temporariamente indisponível'));

      const saved = await putLibraryManifest(customerId, {
        docs: [{ id: 'p2', name: 'Clínica Janine', updatedAt: 300, doc: {} }],
      }, { baseRevision: 1 });
      expect(saved.meta.projectCount).toBe(3);
      expect(await getLibrarySyncMeta(customerId)).toMatchObject({ revision: 2, projectCount: 3 });
      expect((await getLibraryManifest(customerId)).docs.map((entry) => entry.id)).toEqual(['p0', 'p1', 'p2']);

      const next = await putLibraryManifest(customerId, { docs: [{ id: 'p3', doc: {} }] }, { baseRevision: 2 });
      expect(next.meta.projectCount).toBe(4);
    });

    it('não publica contagem nem substitui a nuvem quando só a meta está acessível', async () => {
      setRedis(manifest(2, 5), { full: false });

      await expect(getLibrarySyncMeta(customerId)).rejects.toMatchObject({ code: 'library_storage_unavailable' });
      await expect(putLibraryManifest(customerId, { docs: [{ id: 'local', doc: {} }] }, { force: true }))
        .rejects.toMatchObject({ code: 'library_storage_unavailable' });
      expect(blob.put).not.toHaveBeenCalled();
      expect(requests.filter(([operation]) => operation === 'SET')).toEqual([]);
    });

    it('não sobrescreve cinco projectos após erro transitório de leitura', async () => {
      setRedis(manifest(3, 5), { full: false });
      blob.get.mockRejectedValue(new Error('timeout'));

      await expect(putLibraryManifest(customerId, { docs: [{ id: 'local', doc: {} }] }, { force: true }))
        .rejects.toMatchObject({ code: 'library_storage_unavailable' });
      expect(blob.put).not.toHaveBeenCalled();
      expect(JSON.parse(redis.get(metaKey)).projectCount).toBe(5);
      expect(requests.filter(([operation]) => operation === 'SET')).toEqual([]);
    });

    it('rejeita manifesto antigo se a meta confirma uma revisão ainda inacessível', async () => {
      setBlob(manifest(1, 2));
      setRedis(manifest(2, 5), { full: false });

      await expect(getLibraryManifest(customerId)).rejects.toMatchObject({ code: 'library_storage_unavailable' });
    });
  });
});
