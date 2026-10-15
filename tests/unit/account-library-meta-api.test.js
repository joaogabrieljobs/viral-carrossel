import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const access = vi.hoisted(() => ({ require: vi.fn(), limit: vi.fn(), rateLimited: vi.fn() }));
const store = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../../api/lib/require-access.js', () => ({ requireActiveSubscription: access.require }));
vi.mock('../../api/lib/rate-limit.js', () => ({
  consumeRateLimit: access.limit, rateLimitResponse: access.rateLimited,
}));
vi.mock('../../api/lib/library-sync-postgres.js', () => ({
  getAccountLibraryMeta: store.get, putAccountLibraryMeta: store.put,
}));

import handler from '../../api/account-library-meta.js';

function response() {
  const res = { status: vi.fn(), json: vi.fn(), end: vi.fn(), setHeader: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.end.mockReturnValue(res);
  return res;
}

async function request(method, { body, headers } = {}) {
  const res = response();
  await handler({ method, body, headers: headers || {} }, res);
  return {
    status: res.status.mock.calls.at(-1)?.[0],
    body: res.json.mock.calls.at(-1)?.[0],
    headers: res.setHeader.mock.calls,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('LIBRARY_SYNC_BACKEND', 'postgres');
  access.require.mockResolvedValue({ customerId: 'cus_janine', email: 'janine@example.test' });
  access.limit.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

describe('/api/account-library-meta', () => {
  it('não cria snapshot no banco antes da troca do backend', async () => {
    vi.stubEnv('LIBRARY_SYNC_BACKEND', 'blob');
    expect(await request('GET')).toMatchObject({
      status: 503, body: { code: 'account_meta_backend_disabled' },
    });
    expect(store.get).not.toHaveBeenCalled();
  });
  it('lê e grava os dados globais apenas na conta autenticada', async () => {
    const metadata = { brands: [{ id: 'janine', name: 'Clínica Janine' }], folders: [] };
    store.get.mockResolvedValue({ metadata, revision: 3, updatedAt: 123 });
    store.put.mockResolvedValue({ metadata: { ...metadata, folders: [{ id: 'a' }] }, revision: 4, updatedAt: 124 });

    expect(await request('GET')).toMatchObject({
      status: 200, body: { ok: true, metadata, revision: 3 },
    });
    expect(store.get).toHaveBeenCalledWith('cus_janine');
    const saved = await request('PUT', {
      body: { metadata: { folders: [{ id: 'a' }] }, baseRevision: 3 },
      headers: { 'x-account-owner': 'cus_janine' },
    });
    expect(saved).toMatchObject({ status: 200, body: { ok: true, revision: 4 } });
    expect(store.put).toHaveBeenCalledWith('cus_janine', { folders: [{ id: 'a' }] }, { baseRevision: 3 });

    access.require.mockResolvedValue({ customerId: 'cus_other' });
    await request('GET');
    expect(store.get).toHaveBeenLastCalledWith('cus_other');
  });

  it('bloqueia escrita de outra conta e versão stale com 409 explícito', async () => {
    const wrongOwner = await request('PUT', {
      body: { metadata: { folders: [] }, baseRevision: 1 },
      headers: { 'x-account-owner': 'cus_other' },
    });
    expect(wrongOwner).toMatchObject({ status: 409, body: { code: 'account_meta_owner_changed' } });
    expect(store.put).not.toHaveBeenCalled();
    expect((await request('GET', { headers: { 'x-account-owner': 'cus_other' } })).status).toBe(409);
    expect(store.get).not.toHaveBeenCalled();

    store.put.mockRejectedValue(Object.assign(new Error('stale'), {
      code: 'account_meta_conflict', cloudRevision: 5,
    }));
    const stale = await request('PUT', { body: { metadata: { folders: [] }, baseRevision: 1 } });
    expect(stale).toMatchObject({ status: 409, body: { code: 'account_meta_conflict', cloudRevision: 5 } });
  });

  it('rejeita documentos, revisões inválidas e corpo acima do limite', async () => {
    expect((await request('PUT', { body: '{' })).status).toBe(400);
    expect((await request('PUT', { body: { metadata: {}, baseRevision: -1 } })).status).toBe(400);
    expect((await request('PUT', { body: { docs: [], baseRevision: 0 } })).status).toBe(400);
    expect((await request('PUT', {
      body: { metadata: { userProfile: { bio: 'x'.repeat(512 * 1024) } }, baseRevision: 0 },
    })).status).toBe(413);
    expect(store.put).not.toHaveBeenCalled();
  });

  it('exige sessão ativa, limita pedidos e preserva indisponibilidade do banco', async () => {
    access.require.mockResolvedValue(null);
    expect((await request('GET')).body).toBeUndefined();
    expect(store.get).not.toHaveBeenCalled();
    access.require.mockResolvedValue({ customerId: 'cus_janine' });
    access.limit.mockResolvedValue({ retryAfterSec: 5 });
    access.rateLimited.mockImplementation((res) => res.status(429).json({ error: 'Limite' }));
    expect((await request('GET')).status).toBe(429);
    access.limit.mockResolvedValue(null);
    store.get.mockRejectedValue(Object.assign(new Error('offline'), { code: 'library_storage_unavailable' }));
    expect((await request('GET')).status).toBe(503);
    expect((await request('OPTIONS')).status).toBe(204);
    expect((await request('POST')).status).toBe(405);
  });
});
