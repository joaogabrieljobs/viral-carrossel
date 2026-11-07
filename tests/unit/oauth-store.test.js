import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const deps = vi.hoisted(() => ({
  query: vi.fn(),
  identity: vi.fn(),
  begin: vi.fn(),
}));

const sql = {
  unsafe: deps.query,
  begin: callback => deps.begin(callback),
};

vi.mock('../../api/lib/postgres-connection.js', () => ({
  getPostgresConnection: () => sql,
}));
vi.mock('../../api/lib/agent-token-store.js', () => ({
  getCurrentAgentSecurityContext: deps.identity,
}));

import {
  consumeAuthorizationCode,
  createAuthorizationCode,
  createRefreshToken,
  rotateRefreshToken,
} from '../../api/lib/oauth-store.js';

const clientId = '11111111-1111-4111-8111-111111111111';
const resource = 'https://moont.ai/mcp';
const ownerId = 'cus_alice';

function storedRefresh(overrides = {}) {
  return {
    token_hash: 'hash', client_id: clientId, client_name: 'Claude', owner_id: ownerId,
    resource, scopes: ['projects:read', 'projects:write'], revoked_at: null,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    created_at: new Date(Date.now() - 10_000).toISOString(),
    agent_epoch: 'security-1', account_id: '22222222-2222-4222-8222-222222222222',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.begin.mockImplementation(async callback => callback(sql));
  deps.identity.mockResolvedValue({
    agentEpoch: 'security-1', accountId: '22222222-2222-4222-8222-222222222222',
    sessionRevokedBefore: 0,
  });
  deps.query.mockResolvedValue([]);
});

describe('refresh OAuth vinculado à segurança da conta', () => {
  it('grava a época e a conta ao emitir o refresh token', async () => {
    const token = await createRefreshToken({
      clientId, ownerId, scopes: ['projects:read', 'projects:write'],
    });

    expect(token).toMatch(/^moont_refresh_[A-Za-z0-9_-]{43}$/);
    const [statement, params] = deps.query.mock.calls[0];
    expect(statement).toContain('agent_epoch, account_id');
    expect(params.slice(1)).toEqual([
      clientId, ownerId, resource, ['projects:read', 'projects:write'],
      'security-1', '22222222-2222-4222-8222-222222222222',
    ]);
    expect(params[0]).not.toContain('moont_refresh_');
  });

  it('continua emitindo durante a janela antes da migração do banco', async () => {
    deps.query
      .mockRejectedValueOnce(Object.assign(new Error('column missing'), { code: '42703' }))
      .mockResolvedValueOnce([]);

    await expect(createRefreshToken({ clientId, ownerId, scopes: ['projects:read'] }))
      .resolves.toMatch(/^moont_refresh_/);

    expect(deps.query).toHaveBeenCalledTimes(2);
    expect(deps.query.mock.calls[1][0]).not.toContain('agent_epoch, account_id');
  });

  it('rotaciona quando a época e a conta continuam iguais', async () => {
    deps.query.mockImplementation(async statement => {
      if (statement.includes('SELECT owner_id')) return [{ owner_id: ownerId }];
      if (statement.includes('SELECT r.*')) return [storedRefresh()];
      return [];
    });

    await expect(rotateRefreshToken({ token: 'refresh-old', clientId, resource }))
      .resolves.toEqual(expect.objectContaining({
        ownerId, scopes: ['projects:read', 'projects:write'], clientName: 'Claude',
        securitySnapshot: expect.objectContaining({ agentEpoch: 'security-1' }),
      }));
    expect(deps.query.mock.calls.some(([statement]) =>
      statement.includes('WHERE token_hash = $1'))).toBe(true);
    expect(deps.identity.mock.invocationCallOrder[0])
      .toBeLessThan(deps.begin.mock.invocationCallOrder[0]);
  });

  it('mantém a integração depois de logout comum quando agent_epoch não mudou', async () => {
    deps.identity.mockResolvedValue({
      agentEpoch: 'security-1', accountId: '22222222-2222-4222-8222-222222222222',
      sessionRevokedBefore: Date.now(),
    });
    deps.query.mockImplementation(async statement => {
      if (statement.includes('SELECT owner_id')) return [{ owner_id: ownerId }];
      if (statement.includes('SELECT r.*')) return [storedRefresh()];
      return [];
    });

    await expect(rotateRefreshToken({ token: 'refresh-old', clientId, resource }))
      .resolves.toMatchObject({ ownerId, clientName:'Claude' });
    expect(deps.query.mock.calls.some(([statement]) =>
      statement.includes('WHERE owner_id = $1 AND revoked_at IS NULL'))).toBe(false);
  });

  it('recusa e revoga a família quando a recuperação muda a época', async () => {
    deps.identity.mockResolvedValue({
      agentEpoch: 'security-2', accountId: '22222222-2222-4222-8222-222222222222',
      sessionRevokedBefore: 0,
    });
    deps.query.mockImplementation(async statement => {
      if (statement.includes('SELECT owner_id')) return [{ owner_id: ownerId }];
      if (statement.includes('SELECT r.*')) return [storedRefresh()];
      return [];
    });

    await expect(rotateRefreshToken({ token: 'refresh-old', clientId, resource }))
      .rejects.toMatchObject({ code: 'invalid_grant' });
    expect(deps.query.mock.calls.some(([statement, params]) =>
      statement.includes('WHERE owner_id = $1') && params[0] === ownerId)).toBe(true);
  });

  it('invalida também refresh legado emitido antes da redefinição de senha', async () => {
    const changedAt = Date.now() - 1_000;
    deps.identity.mockResolvedValue({
      agentEpoch: 'security-2', accountId: null, sessionRevokedBefore: changedAt,
    });
    deps.query.mockImplementation(async statement => {
      if (statement.includes('SELECT owner_id')) return [{ owner_id: ownerId }];
      if (statement.includes('SELECT r.*')) return [storedRefresh({
        agent_epoch: undefined, account_id: undefined,
        created_at: new Date(changedAt - 5_000).toISOString(),
      })];
      return [];
    });

    await expect(rotateRefreshToken({ token: 'refresh-legacy', clientId, resource }))
      .rejects.toMatchObject({ code: 'invalid_grant' });
  });
});

describe('authorization code vinculado à segurança da conta', () => {
  it('grava época e conta junto do código curto', async () => {
    const code = await createAuthorizationCode({
      clientId,
      ownerId,
      redirectUri:'https://claude.ai/api/mcp/auth_callback',
      scopes:['projects:read'],
      codeChallenge:'a'.repeat(43),
    });
    expect(code).toMatch(/^moont_code_/);
    const [statement, params] = deps.query.mock.calls[0];
    expect(statement).toContain('agent_epoch, account_id');
    expect(params.slice(-2)).toEqual([
      'security-1', '22222222-2222-4222-8222-222222222222',
    ]);
  });

  it('recusa código emitido antes de recuperação de conta', async () => {
    const verifier = 'v'.repeat(43);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    deps.identity.mockResolvedValue({
      agentEpoch:'security-2', accountId:'22222222-2222-4222-8222-222222222222',
      sessionRevokedBefore:Date.now(),
    });
    deps.query.mockImplementation(async statement => {
      if (statement.includes('SELECT owner_id FROM moont.oauth_codes')) return [{ owner_id:ownerId }];
      if (statement.includes('SELECT c.*')) return [{
        code_hash:'hash', client_id:clientId, client_name:'Claude', owner_id:ownerId,
        redirect_uri:'https://claude.ai/api/mcp/auth_callback', resource,
        scopes:['projects:read'], code_challenge:challenge,
        expires_at:new Date(Date.now() + 60_000).toISOString(), used_at:null,
        agent_epoch:'security-1', account_id:'22222222-2222-4222-8222-222222222222',
      }];
      return [];
    });

    await expect(consumeAuthorizationCode({
      code:'moont_code_old', clientId,
      redirectUri:'https://claude.ai/api/mcp/auth_callback', resource, verifier,
    })).rejects.toMatchObject({ code:'invalid_grant' });
    expect(deps.query.mock.calls.some(([statement]) => statement.includes('SET used_at = now()'))).toBe(false);
  });
});
