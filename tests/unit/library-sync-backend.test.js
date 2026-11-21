import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stores = vi.hoisted(() => ({
  auth: vi.fn(), limit: vi.fn(),
  legacyMeta: vi.fn(), legacyManifest: vi.fn(), legacyPut: vi.fn(),
  pgMeta: vi.fn(), pgManifest: vi.fn(), pgPut: vi.fn(),
  asset: vi.fn(),
}));

vi.mock('../../api/lib/require-access.js', () => ({ requireActiveSubscription: stores.auth }));
vi.mock('../../api/lib/rate-limit.js', () => ({
  consumeRateLimit: stores.limit,
  rateLimitResponse: vi.fn(),
}));
vi.mock('../../api/lib/library-sync-store.js', () => ({
  getLibrarySyncMeta: stores.legacyMeta,
  getLibraryManifest: stores.legacyManifest,
  putLibraryManifest: stores.legacyPut,
  putLibraryAsset: vi.fn(),
  putLibraryAssetChunk: vi.fn(),
  getLibraryAsset: stores.asset,
  resolveLibraryOwnerId: (access) => access.customerId || '',
}));
vi.mock('../../api/lib/library-sync-postgres.js', () => ({
  getLibrarySyncMeta: stores.pgMeta,
  getLibraryManifest: stores.pgManifest,
  putLibraryManifest: stores.pgPut,
}));

import handler from '../../api/library-sync.js';

async function request(method, { query = {}, body } = {}) {
  const res = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn(), end: vi.fn() };
  res.status.mockReturnValue(res);
  await handler({ method, query, body, headers: {} }, res);
  return {
    status: res.status.mock.calls.at(-1)?.[0],
    body: res.json.mock.calls.at(-1)?.[0],
  };
}

describe('roteamento gradual da biblioteca', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stores.auth.mockResolvedValue({ customerId: 'cus_test', email: 'test@example.com' });
    stores.limit.mockResolvedValue(null);
    stores.legacyMeta.mockResolvedValue({ revision: 1, projectCount: 1 });
    stores.pgMeta.mockResolvedValue({ revision: 2, projectCount: 2 });
    stores.legacyManifest.mockResolvedValue({ docs: [{ id: 'old' }] });
    stores.pgManifest.mockResolvedValue({ docs: [{ id: 'new' }] });
    stores.legacyPut.mockResolvedValue({ manifest: { revision: 3 }, meta: { revision: 3, updatedAt: 3, projectCount: 1, assetIds: [] } });
    stores.pgPut.mockResolvedValue({ manifest: { revision: 4 }, meta: { revision: 4, updatedAt: 4, projectCount: 2, assetIds: [] } });
    stores.asset.mockResolvedValue({ assetId: 'photo' });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('mantém o armazenamento existente enquanto a migração não é ativada', async () => {
    const status = await request('GET');
    const full = await request('GET', { query: { full: '1' } });
    expect(status.body.meta.projectCount).toBe(1);
    expect(full.body.manifest.docs[0].id).toBe('old');
    expect(stores.pgMeta).not.toHaveBeenCalled();
  });

  it('usa Postgres para metadados e projetos, mantendo assets privados no Blob', async () => {
    vi.stubEnv('LIBRARY_SYNC_BACKEND', 'postgres');
    const status = await request('GET');
    const full = await request('GET', { query: { full: '1' } });
    const asset = await request('GET', { query: { asset: 'photo' } });
    expect(status.body.meta.projectCount).toBe(2);
    expect(full.body.manifest.docs[0].id).toBe('new');
    expect(asset.body.asset.assetId).toBe('photo');
    expect(stores.legacyPut).not.toHaveBeenCalled();
  });

  // MOO-22: o push legado gravava projetos pelo relógio do cliente, com
  // force/baseRevision opcionais e sem limite por projeto. A interface V2
  // grava por /api/projects com versão; o push só vem de bundle antigo.
  it.each([
    ['push comum', { action: 'push', manifest: { docs: [{ id: 'new' }] }, baseRevision: 2 }],
    ['push com force', { action: 'push', force: true, manifest: { docs: [{ id: 'new', updatedAt: 9e15 }] } }],
    ['push sem baseRevision', { action: 'push', allowShrink: true, manifest: { docs: [{ id: 'new' }] } }],
  ])('com Postgres recusa %s com 410 e não grava nada', async (_nome, body) => {
    vi.stubEnv('LIBRARY_SYNC_BACKEND', 'postgres');
    const push = await request('POST', { body });
    expect(push.status).toBe(410);
    expect(push.body.code).toBe('library_push_retired');
    expect(push.body.error).toMatch(/atualize a página/i);
    expect(stores.pgPut).not.toHaveBeenCalled();
    expect(stores.legacyPut).not.toHaveBeenCalled();
  });

  it('com Postgres mantém status e envio de fotos usados pela interface V2', async () => {
    vi.stubEnv('LIBRARY_SYNC_BACKEND', 'postgres');
    const status = await request('POST', { body: { action: 'status' } });
    expect(status.status).toBe(200);
    expect(status.body.meta.projectCount).toBe(2);
  });

  it('sem Postgres o push legado continua aceito', async () => {
    const push = await request('POST', { body: { action: 'push', manifest: { docs: [{ id: 'old' }] } } });
    expect(push.status).toBe(200);
    expect(push.body.projectCount).toBe(1);
    expect(stores.legacyPut).toHaveBeenCalled();
  });
});
