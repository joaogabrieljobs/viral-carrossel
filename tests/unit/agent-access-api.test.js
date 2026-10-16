import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({
  access: vi.fn(), rate: vi.fn(), create: vi.fn(), list: vi.fn(), revoke: vi.fn(),
}));
vi.mock('../../api/lib/require-access.js', () => ({ requireActiveSubscription: deps.access }));
vi.mock('../../api/lib/rate-limit.js', () => ({
  consumeRateLimit: deps.rate,
  rateLimitResponse: vi.fn(),
}));
vi.mock('../../api/lib/agent-token-store.js', () => ({
  AgentTokenError: class AgentTokenError extends Error {},
  createAgentToken: deps.create,
  listAgentTokens: deps.list,
  revokeAgentToken: deps.revoke,
}));

import handler from '../../api/agent-access.js';

function response() {
  const res = { status: vi.fn(), json: vi.fn(), end: vi.fn(), setHeader: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.end.mockReturnValue(res);
  return res;
}

async function request(method, { body, origin = 'http://localhost:5173', contentType = 'application/json' } = {}) {
  const res = response();
  await handler({
    method,
    headers: { origin, 'content-type': contentType },
    body,
  }, res);
  return { status: res.status.mock.calls.at(-1)?.[0], body: res.json.mock.calls.at(-1)?.[0] };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('LIBRARY_SYNC_BACKEND', 'postgres');
  vi.stubEnv('VERCEL_ENV', 'development');
  deps.access.mockResolvedValue({ customerId: 'cus_alice', email: 'alice@example.test' });
  deps.rate.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

describe('/api/agent-access', () => {
  it('nega criação e revogação de outra origem, antes de consultar sessão ou banco', async () => {
    expect(await request('POST', { origin: 'https://evil.example', body: { label: 'Codex' } }))
      .toMatchObject({ status: 403, body: { code: 'agent_origin_denied' } });
    expect(await request('DELETE', { origin: 'https://evil.example', body: { id: 'a' } }))
      .toMatchObject({ status: 403, body: { code: 'agent_origin_denied' } });
    expect(deps.access).not.toHaveBeenCalled();
    expect(deps.create).not.toHaveBeenCalled();
    expect(deps.revoke).not.toHaveBeenCalled();
  });

  it('exige JSON na mutação e conta ativa, sem permitir criar chave sem plano', async () => {
    expect(await request('POST', { contentType: 'text/plain', body: '{}' }))
      .toMatchObject({ status: 415, body: { code: 'agent_json_required' } });
    deps.access.mockImplementationOnce(async (_req, res) => {
      res.status(402).json({ error: 'Assinatura inativa.' });
      return null;
    });
    expect(await request('POST', { body: { label: 'Codex' } })).toMatchObject({ status: 402 });
    expect(deps.create).not.toHaveBeenCalled();
  });

  it('cria na conta autenticada e retorna segredo só nessa resposta', async () => {
    const credential = { id: 'one', label: 'Codex', scopes: ['projects:read', 'projects:write'] };
    deps.create.mockResolvedValue({ token: 'moont_pat_secret', credential });
    deps.list.mockResolvedValue([credential]);
    const post = await request('POST', { body: { label: 'Codex' } });
    expect(post).toMatchObject({ status: 201, body: { ok: true, token: 'moont_pat_secret' } });
    expect(deps.create).toHaveBeenCalledWith('cus_alice', {
      label: 'Codex', scopes: ['projects:read', 'projects:write'],
    });
    const get = await request('GET');
    expect(get).toMatchObject({ status: 200, body: { ok: true, credentials: [credential] } });
    expect(JSON.stringify(get.body)).not.toContain('moont_pat_secret');
    expect(deps.list).toHaveBeenCalledWith('cus_alice');
  });

  it('revoga somente pelo proprietário atual', async () => {
    deps.revoke.mockResolvedValue({ id: 'one', revokedAt: new Date() });
    expect(await request('DELETE', { body: { id: 'one' } })).toMatchObject({ status: 200 });
    expect(deps.revoke).toHaveBeenCalledWith('cus_alice', 'one');
    deps.access.mockResolvedValue({ customerId: 'cus_bob', email: 'bob@example.test' });
    expect(await request('DELETE', { body: { id: 'one' } })).toMatchObject({ status: 200 });
    expect(deps.revoke).toHaveBeenLastCalledWith('cus_bob', 'one');
  });
});
