import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const blob = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn() }));
vi.mock('@vercel/blob', async (importOriginal) => ({ ...(await importOriginal()), ...blob }));
import { BlobPreconditionFailedError } from '@vercel/blob';
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

  it('exclusões sobrevivem ao próximo save sem deletedIds e ao push de um navegador antigo', async () => {
    const original = [
      { id: 'clinica', name: 'CLINICA JANINE ARAUJO', updatedAt: 10, doc: { slides: Array.from({ length: 23 }, (_, i) => ({ id: `s${i}` })) } },
      { id: 'antigo-1', name: 'Projeto antigo', updatedAt: 10, doc: {} },
      { id: 'antigo-2', name: 'Outro projeto', updatedAt: 10, doc: {} },
    ];
    await putLibraryManifest('cus_delete_history', { docs: original });
    await putLibraryManifest('cus_delete_history', { docs: [original[0]], deletedIds: ['antigo-1', 'antigo-2'] }, { force: true });
    // O cliente limpa a fila de exclusões depois do primeiro recibo de push.
    await putLibraryManifest('cus_delete_history', { docs: [original[0]], deletedIds: [] }, { force: true });
    const stale = await putLibraryManifest('cus_delete_history', { docs: original }, { force: true });
    expect(stale.manifest.docs.map((doc) => doc.id)).toEqual(['clinica']);
    expect(stale.manifest.deletedIds).toEqual(['antigo-1', 'antigo-2']);
    expect(stale.meta.projectCount).toBe(1);
    const restored = await getLibraryManifest('cus_delete_history');
    expect(restored.docs).toHaveLength(1);
    expect(restored.docs[0].doc.slides).toHaveLength(23);
    expect(await getLibrarySyncMeta('cus_delete_history')).toMatchObject({ projectCount: 1 });
  });

  it('une exclusões sucessivas e não restaura um ID excluído com updatedAt maior ou replace', async () => {
    await putLibraryManifest('cus_delete_union', { docs: [{ id: 'a' }, { id: 'b' }, { id: 'keep' }] });
    await putLibraryManifest('cus_delete_union', { docs: [], deletedIds: ['a'] }, { force: true });
    await putLibraryManifest('cus_delete_union', { docs: [], deletedIds: ['b', 'a'] }, { force: true });
    const restored = await putLibraryManifest('cus_delete_union', {
      docs: [{ id: 'a', updatedAt: Date.now() + 10_000 }, { id: 'keep' }, { id: 'new-id', name: 'Recriado' }],
      deletedIds: [],
    }, { force: true, replace: true });
    expect(restored.manifest.deletedIds).toEqual(['a', 'b']);
    expect(restored.manifest.docs.map((doc) => doc.id)).toEqual(['keep', 'new-id']);
  });

  it('replace registra os IDs removidos para impedir que um merge posterior os ressuscite', async () => {
    const original = [{ id: 'keep' }, { id: 'removed' }];
    await putLibraryManifest('cus_replace_delete', { docs: original });
    const replacement = await putLibraryManifest('cus_replace_delete', { docs: [{ id: 'keep' }] }, { force: true, replace: true });
    expect(replacement.manifest.deletedIds).toEqual(['removed']);
    const stale = await putLibraryManifest('cus_replace_delete', { docs: original }, { force: true });
    expect(stale.manifest.docs.map((doc) => doc.id)).toEqual(['keep']);
    expect(stale.manifest.deletedIds).toEqual(['removed']);
  });

  it('uma exclusão não afeta o mesmo ID em outra conta', async () => {
    await putLibraryManifest('cus_deleted_owner', { docs: [], deletedIds: ['shared-id'] });
    const other = await putLibraryManifest('cus_other_owner', { docs: [{ id: 'shared-id', name: 'Outro dono' }] });
    expect(other.manifest.docs).toHaveLength(1);
    expect(other.manifest.deletedIds).toEqual([]);
  });

  describe('consistência Blob/Redis em produção', () => {
    const customerId = 'cus_production';
    const metaKey = `vc:library-sync:meta:${customerId}`;
    let redis;
    let requests;
    let blobVersion = 0;

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
      const etag = `etag-${++blobVersion}`;
      blob.get.mockImplementation(async () => value
        ? { stream: new Response(JSON.stringify(value)).body, blob: { etag } } : null);
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
      vi.stubEnv('LIBRARY_SYNC_STORAGE', '');
      vi.stubEnv('LIBRARY_SYNC_BLOB_OWNERS', '');
      vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test');
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test');
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
      redis = new Map();
      requests = [];
      vi.stubGlobal('fetch', vi.fn(async (_url, opts) => {
        const command = JSON.parse(opts.body);
        const [operation, key, value] = command;
        requests.push([operation, key]);
        if (operation === 'SET') redis.set(key, value);
        if (operation === 'EVAL') {
          const [, , , fullKey, cacheKey, expectedFull, expectedMeta, full, meta] = command;
          const accepted = (redis.get(fullKey) || '') === expectedFull && (redis.get(cacheKey) || '') === expectedMeta;
          if (accepted) { redis.set(fullKey, full); redis.set(cacheKey, meta); }
          return new Response(JSON.stringify({ result: accepted ? 1 : 0 }));
        }
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

    it('GET e status filtram IDs excluídos mesmo se a versão antiga guardou docs conflitantes', async () => {
      setBlob({ ...manifest(3, 2), deletedIds: ['p1'] });
      expect((await getLibraryManifest(customerId)).docs.map((doc) => doc.id)).toEqual(['p0']);
      expect(await getLibrarySyncMeta(customerId)).toMatchObject({ revision: 3, projectCount: 1 });
    });

    it('preserva tombstones de ambas as réplicas e os grava no próximo push', async () => {
      setBlob({ ...manifest(2, 1), deletedIds: ['p1'] });
      setRedis({ ...manifest(3, 3), deletedIds: ['p2'] });
      blob.put.mockImplementation(async (_path, body) => setBlob(JSON.parse(body)));
      const restored = await getLibraryManifest(customerId);
      expect(restored.docs.map((doc) => doc.id)).toEqual(['p0']);
      expect(restored.deletedIds.sort()).toEqual(['p1', 'p2']);
      expect(await getLibrarySyncMeta(customerId)).toMatchObject({ revision: 3, projectCount: 1 });
      const saved = await putLibraryManifest(customerId, { docs: manifest(1, 3).docs, deletedIds: [] }, { force: true });
      expect(saved.manifest.docs.map((doc) => doc.id)).toEqual(['p0']);
      expect(saved.manifest.deletedIds.sort()).toEqual(['p1', 'p2']);
      expect((await getLibraryManifest(customerId)).deletedIds.sort()).toEqual(['p1', 'p2']);
    });

    it('CAS impede aba antiga de sobrescrever a exclusão simultânea, mesmo com force', async () => {
      vi.stubEnv('LIBRARY_SYNC_STORAGE', 'blob');
      const original = manifest(1, 3);
      original.docs[0] = { id: 'p0', name: 'CLINICA JANINE ARAUJO', doc: { slides: Array.from({ length: 23 }, (_, i) => ({ id: `s${i}` })) } };
      let stored = structuredClone(original);
      let version = 1;
      let arrivals = 0;
      let release;
      const bothArrived = new Promise((resolve) => { release = resolve; });
      blob.get.mockImplementation(async () => ({
        stream: new Response(JSON.stringify(stored)).body, blob: { etag: `v${version}` },
      }));
      blob.put.mockImplementation(async (_path, body, options) => {
        const arrival = ++arrivals;
        if (arrival === 2) release();
        if (arrival <= 2) await bothArrived;
        if (options.ifMatch !== `v${version}`) throw new BlobPreconditionFailedError();
        stored = JSON.parse(body);
        version += 1;
      });
      const [deleted, stale] = await Promise.all([
        putLibraryManifest(customerId, { docs: [original.docs[0]], deletedIds: ['p1', 'p2'] }, { force: true }),
        putLibraryManifest(customerId, { docs: original.docs, deletedIds: [] }, { force: true }),
      ]);
      expect(deleted.meta.projectCount).toBe(1);
      expect(stale.meta.projectCount).toBe(1);
      expect(blob.put).toHaveBeenCalledTimes(3);
      expect(blob.put.mock.calls.map((call) => call[2].ifMatch)).toEqual(['v1', 'v1', 'v2']);
      expect(stored.docs).toHaveLength(1);
      expect(stored.docs[0].doc.slides).toHaveLength(23);
      expect(stored.deletedIds).toEqual(['p1', 'p2']);
      expect((await getLibraryManifest(customerId)).docs).toHaveLength(1);
    });

    it('criação concorrente nunca sobrescreve sem condição e refaz merge após already exists', async () => {
      vi.stubEnv('LIBRARY_SYNC_STORAGE', 'blob');
      let stored = null;
      let version = 0;
      let arrivals = 0;
      let release;
      const bothArrived = new Promise((resolve) => { release = resolve; });
      blob.get.mockImplementation(async () => stored
        ? { stream: new Response(JSON.stringify(stored)).body, blob: { etag: `v${version}` } } : null);
      blob.put.mockImplementation(async (_path, body, options) => {
        const arrival = ++arrivals;
        if (arrival === 2) release();
        if (arrival <= 2) await bothArrived;
        if (stored && options.allowOverwrite === false) throw new Error('Blob already exists');
        if (stored && options.ifMatch !== `v${version}`) throw new BlobPreconditionFailedError();
        stored = JSON.parse(body);
        version += 1;
      });
      await Promise.all([
        putLibraryManifest(customerId, { docs: [{ id: 'first' }] }, { force: true }),
        putLibraryManifest(customerId, { docs: [{ id: 'second' }] }, { force: true }),
      ]);
      expect(blob.put.mock.calls.slice(0, 2).every((call) => call[2].allowOverwrite === false)).toBe(true);
      expect(blob.put.mock.calls[2][2].ifMatch).toBe('v1');
      expect(stored.docs.map((doc) => doc.id)).toEqual(['first', 'second']);
    });

    it('conflito CAS esgotado nunca tenta fallback Redis nem grava meta', async () => {
      setBlob(manifest(1, 2));
      setRedis(manifest(1, 2));
      const conflict = new BlobPreconditionFailedError();
      expect(conflict.name).toBe('Error');
      blob.put.mockRejectedValue(conflict);
      await expect(putLibraryManifest(customerId, { docs: [], deletedIds: ['p1'] }, { force: true }))
        .rejects.toMatchObject({ code: 'library_conflict' });
      expect(blob.put).toHaveBeenCalledTimes(3);
      expect(requests.filter(([operation]) => operation !== 'GET')).toEqual([]);
      expect(JSON.parse(redis.get(`${metaKey}:full`)).docs).toHaveLength(2);
    });

    it('não grava às cegas se a leitura Blob não informou o ETag', async () => {
      blob.get.mockResolvedValue({ stream: new Response(JSON.stringify(manifest(1, 2))).body, blob: {} });
      await expect(putLibraryManifest(customerId, { docs: [] }, { force: true }))
        .rejects.toMatchObject({ code: 'library_storage_unavailable' });
      expect(blob.put).not.toHaveBeenCalled();
      expect(requests.filter(([operation]) => operation !== 'GET')).toEqual([]);
    });

    it('fallback Redis usa CAS atômico e preserva exclusões contra push simultâneo antigo', async () => {
      const original = manifest(1, 3);
      original.docs[0].doc.slides = Array.from({ length: 23 }, (_, i) => ({ id: `s${i}` }));
      setBlob(original);
      setRedis(original);
      blob.put.mockRejectedValue(new Error('Blob temporariamente indisponível'));
      await Promise.all([
        putLibraryManifest(customerId, { docs: [original.docs[0]], deletedIds: ['p1', 'p2'] }, { force: true }),
        putLibraryManifest(customerId, { docs: original.docs }, { force: true }),
      ]);
      const stored = JSON.parse(redis.get(`${metaKey}:full`));
      expect(stored.docs.map((doc) => doc.id)).toEqual(['p0']);
      expect(stored.docs[0].doc.slides).toHaveLength(23);
      expect(stored.deletedIds).toEqual(['p1', 'p2']);
      expect(JSON.parse(redis.get(metaKey))).toMatchObject({ projectCount: 1, revision: 3 });
      expect(requests.filter(([operation]) => operation === 'EVAL')).toHaveLength(3);
      expect(requests.filter(([operation]) => operation === 'SET')).toEqual([]);
    });

    it('Blob explícito restaura e une a biblioteca mesmo com Redis externo inacessível', async () => {
      vi.stubEnv('LIBRARY_SYNC_STORAGE', 'blob');
      fetch.mockRejectedValue(new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } }));
      setBlob(manifest(137, 9));
      blob.put.mockImplementation(async (_path, body) => setBlob(JSON.parse(body)));

      expect(await getLibrarySyncMeta(customerId)).toMatchObject({ revision: 137, projectCount: 9 });
      const saved = await putLibraryManifest(customerId, {
        docs: [{ id: 'local', name: 'Novo projeto', doc: {} }],
      }, { baseRevision: 137 });
      expect(saved.meta).toMatchObject({ revision: 138, projectCount: 10 });
      expect((await getLibraryManifest(customerId)).docs.map((doc) => doc.id))
        .toEqual([...Array.from({ length: 9 }, (_, i) => `p${i}`), 'local']);
      expect(await getLibrarySyncMeta(customerId)).toMatchObject({ revision: 138, projectCount: 10 });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('não ignora falha Redis automaticamente quando ele participa da biblioteca', async () => {
      setBlob(manifest(137, 9));
      fetch.mockRejectedValue(new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } }));

      await expect(putLibraryManifest(customerId, { docs: [] }, { force: true }))
        .rejects.toMatchObject({ code: 'library_storage_unavailable' });
      expect(blob.put).not.toHaveBeenCalled();
    });

    it('permite ativar Blob só para a conta auditada sem alterar outras bibliotecas', async () => {
      vi.stubEnv('LIBRARY_SYNC_STORAGE', 'blob');
      vi.stubEnv('LIBRARY_SYNC_BLOB_OWNERS', ` ${customerId} `);
      fetch.mockRejectedValue(new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } }));
      setBlob(manifest(137, 9));
      expect(await getLibrarySyncMeta(customerId)).toMatchObject({ projectCount: 9 });
      expect(fetch).not.toHaveBeenCalled();
      await expect(getLibrarySyncMeta('cus_not_audited')).rejects.toMatchObject({ code: 'library_storage_unavailable' });
      expect(fetch).toHaveBeenCalled();
    });

    it('Blob explícito mantém falhas reais visíveis e nunca troca para Redis', async () => {
      vi.stubEnv('LIBRARY_SYNC_STORAGE', 'blob');
      setBlob(manifest(137, 9));
      blob.put.mockRejectedValue(new Error('Blob indisponível'));
      await expect(putLibraryManifest(customerId, { docs: [] }, { force: true }))
        .rejects.toMatchObject({ code: 'library_storage_unconfigured' });

      blob.put.mockClear();
      blob.get.mockRejectedValue(new Error('timeout'));
      await expect(putLibraryManifest(customerId, { docs: [] }, { force: true }))
        .rejects.toMatchObject({ code: 'library_storage_unavailable' });
      expect(blob.put).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('Blob explícito sem credenciais não anuncia biblioteca vazia nem usa Redis', async () => {
      vi.stubEnv('LIBRARY_SYNC_STORAGE', 'blob');
      vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
      vi.stubEnv('BLOB_STORE_ID', '');
      vi.stubEnv('VERCEL_OIDC_TOKEN', '');
      await expect(getLibrarySyncMeta(customerId)).rejects.toMatchObject({ code: 'library_storage_unconfigured' });
      expect(fetch).not.toHaveBeenCalled();
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
