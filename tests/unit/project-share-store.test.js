import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const put = vi.fn();
const get = vi.fn();
const head = vi.fn();

vi.mock('@vercel/blob', () => ({
  put: (...args) => put(...args),
  get: (...args) => get(...args),
  head: (...args) => head(...args),
}));

describe('project-share-store', () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('VITEST', 'true');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('UPSTASH_DISABLED', '');
  });

  it('grava em memória em test sem Blob/Redis', async () => {
    const { putSharedProject, getSharedProject } = await import('../../api/lib/project-share-store.js');
    const saved = await putSharedProject({
      code: 'ABCD1234',
      name: 'Teste',
      doc: { slides: [{ title: 'A' }] },
      revision: 0,
    });
    expect(saved.code).toBe('ABCD1234');
    const loaded = await getSharedProject('ABCD1234');
    expect(loaded?.doc?.slides?.[0]?.title).toBe('A');
  });

  it('em produção sem Blob/Redis falha em vez de gravar só em memória', async () => {
    vi.stubEnv('VITEST', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');

    const { putSharedProject } = await import('../../api/lib/project-share-store.js');
    await expect(putSharedProject({
      code: 'FAIL0001',
      name: 'Sem store',
      doc: { slides: [{ title: 'A' }] },
      revision: 0,
    })).rejects.toMatchObject({ code: 'share_storage_unconfigured' });
  });

  it('usa Blob privado (não public) quando configurado e payload grande', async () => {
    vi.stubEnv('VITEST', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    put.mockResolvedValue({ url: 'https://blob.example/x' });

    const { putSharedProject } = await import('../../api/lib/project-share-store.js');
    const hugeDoc = {
      slides: Array.from({ length: 20 }, (_, i) => ({
        title: `S${i}`,
        bgImage: `data:image/jpeg;base64,${'A'.repeat(30_000)}`,
      })),
    };
    await putSharedProject({
      code: 'ZZZZ9999',
      name: 'Grande',
      doc: hugeDoc,
      revision: 0,
    });
    expect(put).toHaveBeenCalled();
    const opts = put.mock.calls[0][2];
    expect(opts.access).toBe('private');
  });

  it('flag de corte publica e lê partilha no Blob sem consultar Redis legado', async () => {
    vi.stubEnv('VITEST', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('UPSTASH_DISABLED', '1');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'redis-test');
    const redisFetch = vi.fn().mockRejectedValue(new Error('Redis indisponível'));
    vi.stubGlobal('fetch', redisFetch);
    let record;
    put.mockImplementation(async (_path, serialized) => { record = JSON.parse(serialized); return { etag: 'v1' }; });
    get.mockImplementation(async () => ({
      stream: new Response(JSON.stringify(record)).body,
      blob: { etag: 'v1' },
    }));

    const { putSharedProject, getSharedProject } = await import('../../api/lib/project-share-store.js');
    await putSharedProject({ code: 'BLOBONLY', name: 'Equipa', doc: { slides: [{ title: 'A' }] } });
    expect((await getSharedProject('BLOBONLY')).doc.slides[0].title).toBe('A');
    expect(put.mock.calls[0][2].access).toBe('private');
    expect(redisFetch).not.toHaveBeenCalled();
  });

  it('conflito de ETag relê Blob e une membro sem restaurar documento antigo', async () => {
    vi.stubEnv('VITEST', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    let latest = { code: 'RACE1234', revision: 1, name: 'Equipa',
      members: ['dona@exemplo.test'], doc: { slides: [{ title: 'Antigo' }] } };
    let etag = 'v1';
    let conflictOnce = true;
    get.mockImplementation(async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(Buffer.from(JSON.stringify(latest)));
          controller.close();
        },
      }),
      blob: { etag },
    }));
    put.mockImplementation(async (_path, serialized, opts) => {
      if (opts.ifMatch && conflictOnce) {
        conflictOnce = false;
        latest = { ...latest, doc: { slides: [{ title: 'Publicado entretanto' }] }, revision: 2 };
        etag = 'v2';
        const error = new Error('precondition failed');
        error.name = 'BlobPreconditionFailedError';
        throw error;
      }
      expect(opts.ifMatch).toBe(etag);
      latest = JSON.parse(serialized);
      etag = 'v3';
      return { etag };
    });

    const { mutateSharedProject } = await import('../../api/lib/project-share-store.js');
    const saved = await mutateSharedProject('RACE1234', (current) => ({
      ...current, members: [...current.members, 'membro@exemplo.test'], keepRevision: true,
    }));
    expect(saved.members).toEqual(['dona@exemplo.test', 'membro@exemplo.test']);
    expect(saved.doc.slides[0].title).toBe('Publicado entretanto');
    expect(put).toHaveBeenCalledTimes(2);
    expect(put.mock.calls[0][2].ifMatch).toBe('v1');
    expect(put.mock.calls[1][2].ifMatch).toBe('v2');
  });

  it('normaliza ETag fraco devolvido pelo Blob antes de atualizar uma partilha', async () => {
    vi.stubEnv('VITEST', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('UPSTASH_DISABLED', '1');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test');
    get.mockResolvedValue({
      stream: new Response(JSON.stringify({ code: 'WEAK1234', revision: 1,
        members: [], doc: { slides: [{ title: 'A' }] } })).body,
      blob: { etag: 'W/"version-1"' },
    });
    put.mockResolvedValue({ etag: '"version-2"' });

    const { mutateSharedProject } = await import('../../api/lib/project-share-store.js');
    await mutateSharedProject('WEAK1234', (current) => ({
      ...current, members: ['novo@exemplo.test'], keepRevision: true,
    }));
    expect(put).toHaveBeenCalledOnce();
    expect(put.mock.calls[0][2].ifMatch).toBe('"version-1"');
  });

  it('partilha guardada só no Blob expira após 30 dias e não aceita alterações', async () => {
    vi.stubEnv('VITEST', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('UPSTASH_DISABLED', '1');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test');
    const { getSharedProject, mutateSharedProject, SHARE_TTL_SEC } =
      await import('../../api/lib/project-share-store.js');
    const expired = {
      code: 'EXPIRED1', revision: 1, updatedAt: Date.now() - SHARE_TTL_SEC * 1000 - 1,
      members: [], doc: { slides: [{ title: 'Privado' }] },
    };
    get.mockImplementation(async () => ({
      stream: new Response(JSON.stringify(expired)).body,
      blob: { etag: '"old"' },
    }));

    expect(await getSharedProject('EXPIRED1')).toBeNull();
    expect(await mutateSharedProject('EXPIRED1', (current) => ({
      ...current, members: ['novo@exemplo.test'], keepRevision: true,
    }))).toBeNull();
    expect(put).not.toHaveBeenCalled();
  });

  it('falha de GET no Blob não combina memória antiga com ETag novo', async () => {
    const { putSharedProject, mutateSharedProject } =
      await import('../../api/lib/project-share-store.js');
    await putSharedProject({ code: 'STALE001', revision: 0,
      members: ['antiga@exemplo.test'], doc: { slides: [{ title: 'Antigo' }] } });
    vi.stubEnv('VITEST', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test');
    get.mockRejectedValue(new Error('fetch failed'));
    head.mockResolvedValue({ etag: 'versao-mais-recente', url: 'https://blob.example/doc' });

    await expect(mutateSharedProject('STALE001', (current) => ({
      ...current, members: [...current.members, 'nova@exemplo.test'], keepRevision: true,
    }))).rejects.toMatchObject({ code: 'share_storage_unconfigured' });
    expect(head).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('404 real no Blob não ressuscita cópia antiga em memória', async () => {
    const { putSharedProject, mutateSharedProject } =
      await import('../../api/lib/project-share-store.js');
    await putSharedProject({ code: 'STALE002', revision: 0,
      members: [], doc: { slides: [{ title: 'Antigo' }] } });
    vi.stubEnv('VITEST', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test');
    get.mockResolvedValue(null);
    head.mockRejectedValue(Object.assign(new Error('404'), { name: 'BlobNotFoundError' }));

    const saved = await mutateSharedProject('STALE002', (current) => ({
      ...current, members: ['novo@exemplo.test'], keepRevision: true,
    }));
    expect(saved).toBeNull();
    expect(put).not.toHaveBeenCalled();
  });

  it('Blob sem ETag não autoriza overwrite mesmo com documento válido', async () => {
    vi.stubEnv('VITEST', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test');
    get.mockResolvedValue({
      stream: new ReadableStream({ start(controller) {
        controller.enqueue(Buffer.from(JSON.stringify({
          code: 'STALE003', revision: 1, members: [], doc: { slides: [] },
        })));
        controller.close();
      } }),
      blob: {},
    });
    const { mutateSharedProject } = await import('../../api/lib/project-share-store.js');
    await expect(mutateSharedProject('STALE003', (current) => ({
      ...current, members: ['novo@exemplo.test'], keepRevision: true,
    }))).rejects.toMatchObject({ code: 'share_storage_unconfigured' });
    expect(put).not.toHaveBeenCalled();
  });

  it('falha de GET Redis após lock não usa Blob nem memória antiga', async () => {
    const { putSharedProject, mutateSharedProject } =
      await import('../../api/lib/project-share-store.js');
    await putSharedProject({ code: 'STALE004', revision: 0,
      members: [], doc: { slides: [{ title: 'Antigo' }] } });
    vi.stubEnv('VITEST', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'redis-test');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test');
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const [command] = JSON.parse(init.body);
      if (command === 'GET') throw new Error('Redis offline');
      return { ok: true, json: async () => ({ result: command === 'SET' ? 'OK' : 1 }) };
    }));

    await expect(mutateSharedProject('STALE004', (current) => ({
      ...current, members: ['novo@exemplo.test'], keepRevision: true,
    }))).rejects.toMatchObject({ code: 'share_storage_unconfigured' });
    expect(get).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it.each(['erro HTTP', 'SET sem confirmação'])(
    'falha de escrita no Redis (%s) não confirma mutação pelo Blob',
    async (failure) => {
      vi.stubEnv('VITEST', 'false');
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'redis-test');
      vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test');
      const original = { code: 'FAILSET1', revision: 1,
        members: ['dona@exemplo.test'], doc: { slides: [{ title: 'Original' }] } };
      vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
        const [command, key] = JSON.parse(init.body);
        if (command === 'GET') {
          return { ok: true, json: async () => ({ result: JSON.stringify(original) }) };
        }
        if (command === 'EVAL') return { ok: true, json: async () => ({ result: 1 }) };
        if (command === 'SET' && key.endsWith(':mutation-lock')) {
          return { ok: true, json: async () => ({ result: 'OK' }) };
        }
        if (failure === 'erro HTTP') {
          return { ok: false, status: 503, text: async () => 'temporarily unavailable' };
        }
        return { ok: true, json: async () => ({ result: null }) };
      }));

      const { mutateSharedProject, getSharedProject } =
        await import('../../api/lib/project-share-store.js');
      await expect(mutateSharedProject('FAILSET1', (current) => ({
        ...current, members: [...current.members, 'nova@exemplo.test'], keepRevision: true,
      }))).rejects.toThrow();
      expect(put).not.toHaveBeenCalled();
      expect((await getSharedProject('FAILSET1')).members).toEqual(['dona@exemplo.test']);
    },
  );

  it('mutação de partilha apontada pelo Redis permanece no Blob com ETag', async () => {
    vi.stubEnv('VITEST', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'redis-test');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test');
    let stored = { code: 'BLOBREF1', revision: 1,
      members: ['dona@exemplo.test'], doc: { slides: [{ title: 'Original' }] } };
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const [command, key] = JSON.parse(init.body);
      if (command === 'GET') {
        return { ok: true, json: async () => ({ result: JSON.stringify({
          code: 'BLOBREF1', blobPath: 'project-shares/BLOBREF1.json', revision: 1,
        }) }) };
      }
      if (command === 'SET' && key.endsWith(':mutation-lock')) {
        return { ok: true, json: async () => ({ result: 'OK' }) };
      }
      if (command === 'EVAL') return { ok: true, json: async () => ({ result: 1 }) };
      throw new Error('Documento apontado pelo Redis não deve migrar para SET direto.');
    }));
    get.mockImplementation(async () => ({
      stream: new ReadableStream({ start(controller) {
        controller.enqueue(Buffer.from(JSON.stringify(stored)));
        controller.close();
      } }),
      blob: { etag: 'original-etag' },
    }));
    put.mockImplementation(async (_path, serialized, opts) => {
      expect(opts.ifMatch).toBe('original-etag');
      stored = JSON.parse(serialized);
      return { etag: 'new-etag' };
    });

    const { mutateSharedProject, getSharedProject } =
      await import('../../api/lib/project-share-store.js');
    await mutateSharedProject('BLOBREF1', (current) => ({
      ...current, members: [...current.members, 'nova@exemplo.test'], keepRevision: true,
    }));
    expect((await getSharedProject('BLOBREF1')).members).toEqual([
      'dona@exemplo.test', 'nova@exemplo.test',
    ]);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('lock Redis serializa duas entradas feitas por instâncias concorrentes', async () => {
    vi.stubEnv('VITEST', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'redis-test');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
    const kv = new Map();
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const [command, key, value, ...args] = JSON.parse(init.body);
      let result = null;
      if (command === 'GET') result = kv.get(key) ?? null;
      if (command === 'SET') {
        if (!args.includes('NX') || !kv.has(key)) {
          kv.set(key, value);
          result = 'OK';
        }
      }
      if (command === 'EVAL') {
        const lockKey = args[0];
        const token = args[1];
        if (kv.get(lockKey) === token) {
          kv.delete(lockKey);
          result = 1;
        }
      }
      return { ok: true, json: async () => ({ result }) };
    }));
    const { putSharedProject, mutateSharedProject, getSharedProject } =
      await import('../../api/lib/project-share-store.js');
    await putSharedProject({ code: 'RACE5678', revision: 0,
      members: ['dona@exemplo.test'], doc: { slides: [{ title: 'Original' }] } });
    const join = (email) => mutateSharedProject('RACE5678', (current) => ({
      ...current, members: [...current.members, email], keepRevision: true,
    }));
    await Promise.all([join('a@exemplo.test'), join('b@exemplo.test')]);
    const final = await getSharedProject('RACE5678');
    expect(final.members).toEqual(expect.arrayContaining([
      'dona@exemplo.test', 'a@exemplo.test', 'b@exemplo.test',
    ]));
    expect(final.doc.slides[0].title).toBe('Original');
  });

  it('makeCode usa bytes criptográficos, não Math.random', async () => {
    const random = vi.spyOn(Math, 'random');
    const { makeCode } = await import('../../api/lib/project-share-store.js');
    const code = makeCode();
    expect(random).not.toHaveBeenCalled();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    random.mockRestore();
  });
});
