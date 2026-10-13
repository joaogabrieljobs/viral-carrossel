import { beforeEach, describe, expect, it, vi } from 'vitest';

const put = vi.fn();
const get = vi.fn();
const head = vi.fn();

vi.mock('@vercel/blob', () => ({
  put: (...args) => put(...args),
  get: (...args) => get(...args),
  head: (...args) => head(...args),
}));

describe('project-share-store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('VITEST', 'true');
    vi.stubEnv('NODE_ENV', 'test');
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
});
