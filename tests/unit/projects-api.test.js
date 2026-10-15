import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ require: vi.fn(), limit: vi.fn(), limitedResponse: vi.fn() }));
const pg = vi.hoisted(() => ({
  list: vi.fn(), get: vi.fn(), put: vi.fn(), remove: vi.fn(),
}));
vi.mock('../../api/lib/require-access.js', () => ({ requireActiveSubscription: auth.require }));
vi.mock('../../api/lib/rate-limit.js', () => ({
  consumeRateLimit: auth.limit, rateLimitResponse: auth.limitedResponse,
}));
vi.mock('../../api/lib/library-sync-postgres.js', () => ({
  listAccountProjects: pg.list,
  getAccountProject: pg.get,
  putAccountProject: pg.put,
  deleteAccountProject: pg.remove,
}));

import handler from '../../api/projects.js';

function response() {
  const res = { status: vi.fn(), json: vi.fn(), end: vi.fn(), setHeader: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.end.mockReturnValue(res);
  return res;
}

async function request(method, { body, query, headers } = {}) {
  const res = response();
  await handler({ method, body, query, headers: headers || {} }, res);
  return {
    status: res.status.mock.calls.at(-1)?.[0],
    body: res.json.mock.calls.at(-1)?.[0],
    headers: res.setHeader.mock.calls,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('LIBRARY_SYNC_BACKEND', 'postgres');
  auth.require.mockResolvedValue({ customerId: 'cus_alice', email: 'alice@example.test' });
  auth.limit.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

describe('/api/projects', () => {
  it('não importa a biblioteca antes da troca do backend', async () => {
    vi.stubEnv('LIBRARY_SYNC_BACKEND', 'blob');
    expect(await request('GET')).toMatchObject({
      status: 503, body: { code: 'project_backend_disabled' },
    });
    expect(pg.list).not.toHaveBeenCalled();
  });
  it('lista só a conta autenticada com paginação e busca um projeto pelo ID', async () => {
    const rows = new Map([
      ['cus_alice', [{ id: 'project-a', entry: { id: 'project-a', name: 'Alice' }, version: 2 }]],
      ['cus_bob', [{ id: 'project-b', entry: { id: 'project-b', name: 'Bob' }, version: 1 }]],
    ]);
    pg.list.mockImplementation(async (owner, { cursor, limit }) => ({
      projects: rows.get(owner).slice(0, limit), nextCursor: cursor ? null : 'next_1',
    }));
    pg.get.mockImplementation(async (owner, id) => rows.get(owner)?.find((row) => row.id === id) || null);

    expect(await request('GET', { query: { limit: '1' } })).toMatchObject({
      status: 200,
      body: { ok: true, projects: rows.get('cus_alice'), nextCursor: 'next_1' },
    });
    expect(pg.list).toHaveBeenCalledWith('cus_alice', { cursor: undefined, limit: 1 });
    expect((await request('GET', { query: { id: 'project-b' } })).status).toBe(404);
    expect(pg.get).toHaveBeenCalledWith('cus_alice', 'project-b');
    expect((await request('GET', { query: { id: 'project-a' } })).body.project.entry.name).toBe('Alice');

    auth.require.mockResolvedValue({ customerId: 'cus_bob', email: 'bob@example.test' });
    expect((await request('GET', { query: { cursor: 'next_1', limit: '25' } })).body.projects)
      .toEqual(rows.get('cus_bob'));
    expect(pg.list).toHaveBeenLastCalledWith('cus_bob', { cursor: 'next_1', limit: 25 });
  });

  it('grava e exclui por ID somente dentro da conta, sempre com versão base', async () => {
    const entry = { id: 'project-1', name: 'Clínica', doc: { slides: [] } };
    const saved = { id: entry.id, entry, version: 1, updatedAt: 123 };
    pg.put.mockResolvedValue(saved);
    pg.remove.mockResolvedValue({ id: entry.id, entry: null, version: 2, deleted: true });

    expect((await request('PUT', { body: { entry, baseVersion: 0 } })).body)
      .toEqual({ ok: true, project: saved });
    expect(pg.put).toHaveBeenCalledWith('cus_alice', entry, { baseVersion: 0 });
    expect((await request('DELETE', { body: { id: entry.id, baseVersion: 1 } })).body.project)
      .toMatchObject({ id: entry.id, deleted: true, version: 2 });
    expect(pg.remove).toHaveBeenCalledWith('cus_alice', entry.id, { baseVersion: 1 });
  });

  it('lista apenas metadados leves e deixa os slides para GET por ID', async () => {
    const row = {
      id: 'project-1', version: 4, updatedAt: 123,
      entry: { id: 'project-1', name: 'Campanha', status: 'draft', doc: { slides: [{ title: 'Privado' }] } },
    };
    pg.list.mockResolvedValue({ projects: [row], nextCursor: null, total: 1 });
    pg.get.mockResolvedValue(row);
    const list = await request('GET');
    expect(list.body).toMatchObject({ ok: true, total: 1, projects: [{ id: 'project-1', version: 4 }] });
    expect(list.body.projects[0].entry).not.toHaveProperty('doc');
    const detail = await request('GET', { query: { id: 'project-1' } });
    expect(detail.body.project.entry.doc.slides[0].title).toBe('Privado');
  });

  it('responde 409 com a versão atual quando o projeto mudou na nuvem', async () => {
    pg.put.mockRejectedValue(Object.assign(new Error('stale'), {
      code: 'project_conflict', cloudVersion: 7,
    }));
    const result = await request('PUT', { body: { entry: { id: 'a' }, baseVersion: 2 } });
    expect(result).toMatchObject({
      status: 409,
      body: { code: 'project_conflict', cloudVersion: 7 },
    });
  });

  it('bloqueia escrita pendente de outra conta pelo header X-Project-Owner', async () => {
    const entry = { id: 'project-1', doc: { slides: [] } };
    const oldOwner = await request('PUT', {
      body: { entry, baseVersion: 0 }, headers: { 'x-project-owner': 'cus_bob' },
    });
    expect(oldOwner).toMatchObject({ status: 409, body: { code: 'project_owner_changed' } });
    expect((await request('DELETE', {
      body: { id: entry.id, baseVersion: 1 }, headers: { 'x-project-owner': 'cus_bob' },
    })).status).toBe(409);
    expect(pg.put).not.toHaveBeenCalled();
    expect(pg.remove).not.toHaveBeenCalled();

    pg.put.mockResolvedValue({ id: entry.id, entry, version: 1 });
    const currentOwner = await request('PUT', {
      body: { entry, baseVersion: 0 }, headers: { 'x-project-owner': 'cus_alice' },
    });
    expect(currentOwner.status).toBe(200);
    expect(pg.put).toHaveBeenCalledWith('cus_alice', entry, { baseVersion: 0 });
    const options = await request('OPTIONS');
    expect(options.headers).toContainEqual(['Access-Control-Allow-Headers', 'Content-Type, X-Project-Owner']);
  });

  it('bloqueia também uma leitura antiga se o cookie passou a ser de outra conta', async () => {
    const result = await request('GET', {
      query: { id: 'project-1' }, headers: { 'x-project-owner': 'cus_bob' },
    });
    expect(result).toMatchObject({ status: 409, body: { code: 'project_owner_changed' } });
    expect(pg.get).not.toHaveBeenCalled();
  });

  it('rejeita ID, paginação, versão e tamanho inválidos antes do banco', async () => {
    expect((await request('GET', { query: { id: '../cus_bob/project' } })).status).toBe(400);
    expect((await request('GET', { query: { id: ['a', 'b'] } })).status).toBe(400);
    expect((await request('GET', { query: { limit: '101' } })).status).toBe(400);
    expect((await request('GET', { query: { cursor: ['cursor'] } })).status).toBe(400);
    expect((await request('PUT', { body: { entry: { id: 'project-1' } } })).status).toBe(400);
    expect((await request('PUT', { body: { entry: { id: '../other' }, baseVersion: 0 } })).status).toBe(400);
    expect((await request('DELETE', { body: { id: 'project-1', baseVersion: -1 } })).status).toBe(400);
    expect((await request('PUT', { body: '{' })).status).toBe(400);
    expect((await request('PUT', {
      body: { entry: { id: 'project-1', doc: { text: 'x'.repeat(2 * 1024 * 1024) } }, baseVersion: 0 },
    })).status).toBe(413);
    expect(pg.list).not.toHaveBeenCalled();
    expect(pg.get).not.toHaveBeenCalled();
    expect(pg.put).not.toHaveBeenCalled();
    expect(pg.remove).not.toHaveBeenCalled();
  });

  it('recusa sessão sem dono e indisponibilidade do banco sem cair no cache local', async () => {
    auth.require.mockResolvedValue({});
    expect((await request('GET')).status).toBe(401);
    expect(pg.list).not.toHaveBeenCalled();
    auth.require.mockResolvedValue({ customerId: 'cus_alice' });
    pg.list.mockRejectedValue(Object.assign(new Error('missing configuration'), {
      code: 'library_storage_unconfigured',
    }));
    expect((await request('GET')).status).toBe(503);
  });

  it('só atende sessões válidas, respeita limite e aceita preflight de PUT/DELETE', async () => {
    auth.require.mockResolvedValue(null);
    expect((await request('GET')).body).toBeUndefined();
    expect(pg.list).not.toHaveBeenCalled();
    auth.limit.mockResolvedValue({ retryAfterSec: 5 });
    auth.limitedResponse.mockImplementation((res) => res.status(429).json({ error: 'Limite' }));
    expect((await request('GET')).status).toBe(429);
    const options = await request('OPTIONS');
    expect(options.status).toBe(204);
    expect(options.headers).toContainEqual(['Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS']);
    expect((await request('POST')).status).toBe(405);
  });
});
