import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const deps = vi.hoisted(() => ({
  query: vi.fn(), begin:vi.fn(), activeSubscription: vi.fn(), billingDisabled: vi.fn(),
  customer: vi.fn(), identityBackend: vi.fn(), account: vi.fn(),
}));
vi.mock('../../api/lib/postgres-connection.js', () => ({
  getPostgresConnection: () => ({ unsafe: deps.query, begin:deps.begin }),
}));
vi.mock('../../api/lib/stripe.js', () => ({
  findActiveSubscription: deps.activeSubscription,
  getStripe: () => ({ customers: { retrieve: deps.customer } }),
}));
vi.mock('../../api/lib/access.js', () => ({ billingDisabled: deps.billingDisabled }));
vi.mock('../../api/lib/account-identity-postgres.js', () => ({
  accountIdentityBackendEnabled: deps.identityBackend,
  getOrCreateAccountForStripeCustomer: deps.account,
}));

import {
  authenticateAgentRequest,
  cleanupExpiredAgentTokens,
  clearAgentSubscriptionCache,
  createAgentToken,
  listAgentTokens,
  revokeSupersededOAuthTokens,
  revokeAgentToken,
} from '../../api/lib/agent-token-store.js';

const tokenId = '0b532933-1e84-4110-9521-ece64204d0f5';
const row = {
  id: tokenId,
  owner_id: 'cus_alice',
  agent_epoch: 'security-1',
  account_id: null,
  label: 'Codex',
  scopes: ['projects:read', 'projects:write'],
  created_at: new Date('2026-10-15T12:00:00Z'),
  expires_at: new Date('2027-01-13T12:00:00Z'),
  revoked_at: null,
};

beforeEach(() => {
  clearAgentSubscriptionCache();
  vi.clearAllMocks();
  deps.billingDisabled.mockReturnValue(false);
  deps.identityBackend.mockReturnValue(false);
  deps.customer.mockResolvedValue({ id: 'cus_alice', metadata: { vc_agent_epoch: 'security-1' } });
  deps.activeSubscription.mockResolvedValue({ status: 'active' });
  deps.begin.mockImplementation(async callback => callback({ unsafe:deps.query }));
});

describe('credenciais pessoais do agente', () => {
  it('cria 256 bits aleatórios e persiste só o hash, sem devolver hash na listagem', async () => {
    deps.query.mockResolvedValueOnce([row]);
    const created = await createAgentToken('cus_alice', { label: 'Meu Codex' });
    expect(created.token).toMatch(/^moont_pat_[A-Za-z0-9_-]{43}$/);
    expect(created.credential).not.toHaveProperty('token_hash');
    const [statement, params] = deps.query.mock.calls[0];
    expect(statement).toContain('INSERT INTO moont.agent_tokens');
    expect(params).toEqual([
      'cus_alice',
      'security-1',
      null,
      createHash('sha256').update(created.token).digest('hex'),
      'Meu Codex',
      ['projects:read', 'projects:write'],
      90 * 86400,
      null,
    ]);
    expect(JSON.stringify(params)).not.toContain(created.token);

    deps.query.mockResolvedValueOnce([row]);
    const listed = await listAgentTokens('cus_alice');
    expect(listed).toEqual([created.credential]);
    expect(JSON.stringify(listed)).not.toContain(created.token);
    expect(deps.query.mock.calls[1][1]).toEqual(['cus_alice']);
    expect(deps.query.mock.calls[1][0]).toContain('LIMIT 100');
    expect(deps.query.mock.calls[1][0]).toContain("expires_at > now() - interval '7 days'");
    expect(deps.query.mock.calls[1][0]).toContain('PARTITION BY oauth_client_id');
    expect(deps.query.mock.calls[1][0]).toContain('oauth_rank = 1');
  });

  it('renovação OAuth revoga os tokens anteriores da mesma conexão', async () => {
    const clientId = '11111111-1111-4111-8111-111111111111';
    deps.query.mockResolvedValueOnce([{ id: '22222222-2222-4222-8222-222222222222' }]);
    expect(await revokeSupersededOAuthTokens(
      'cus_alice', clientId, tokenId,
    )).toBe(1);
    const [statement, params] = deps.query.mock.calls[0];
    expect(statement).toContain('oauth_client_id = $2::uuid');
    expect(statement).toContain('id <> $3::uuid');
    expect(params).toEqual(['cus_alice', clientId, tokenId]);
  });

  it('separa conexões OAuth de mesmo nome pelo client_id e revoga só a família escolhida', async () => {
    const clientId = '11111111-1111-4111-8111-111111111111';
    deps.query.mockResolvedValueOnce([{
      ...row, oauth_client_id: clientId, revoked_at: new Date(),
    }]).mockResolvedValueOnce([{ token_hash:'refresh-hash' }]);

    await expect(revokeAgentToken('cus_alice', tokenId)).resolves.toMatchObject({ id:tokenId });
    expect(deps.query.mock.calls[1][0]).toContain('client_id = $2::uuid');
    expect(deps.query.mock.calls[1][1]).toEqual(['cus_alice', clientId]);
  });

  it('revoga acesso e refresh da conexão na mesma transação', async () => {
    const clientId = '11111111-1111-4111-8111-111111111111';
    deps.query.mockResolvedValueOnce([{
      ...row, oauth_client_id:clientId, revoked_at:new Date(),
    }]).mockRejectedValueOnce(Object.assign(new Error('storage down'), { code:'db_down' }));

    await expect(revokeAgentToken('cus_alice', tokenId)).rejects.toMatchObject({ code:'db_down' });
    expect(deps.begin).toHaveBeenCalledTimes(1);
    expect(deps.query.mock.calls[1][0]).toContain('client_id = $2::uuid');
  });

  it('cron apaga credenciais vencidas ou revogadas depois da retenção', async () => {
    deps.query.mockResolvedValueOnce([{ id: tokenId }, { id: '22222222-2222-4222-8222-222222222222' }]);
    expect(await cleanupExpiredAgentTokens()).toEqual({ deleted: 2 });
    const [statement, params] = deps.query.mock.calls[0];
    expect(statement).toContain('DELETE FROM moont.agent_tokens');
    expect(statement).toContain('expires_at <');
    expect(params).toEqual([7]);
  });

  it('revoga somente uma credencial da conta autenticada', async () => {
    deps.query.mockResolvedValueOnce([]);
    await expect(revokeAgentToken('cus_bob', tokenId)).rejects.toMatchObject({ status: 404 });
    expect(deps.query.mock.calls[0][1]).toEqual(['cus_bob', tokenId]);
    deps.query.mockResolvedValueOnce([{ ...row, revoked_at: new Date() }]);
    expect((await revokeAgentToken('cus_alice', tokenId)).revokedAt).toBeInstanceOf(Date);
  });

  it('aceita o escopo pedido após validar token e assinatura em cada chamada', async () => {
    const createdRow = { ...row };
    deps.query.mockResolvedValueOnce([createdRow]);
    const { token } = await createAgentToken('cus_alice');
    deps.query.mockResolvedValueOnce([createdRow]);
    expect(await authenticateAgentRequest({ headers: { authorization: `Bearer ${token}` } }, { scope: 'projects:write' }))
      .toEqual({ ownerId: 'cus_alice', tokenId, scopes: row.scopes });
    expect(deps.activeSubscription).toHaveBeenCalledWith('cus_alice');
    expect(deps.query.mock.calls[1][1]).toEqual([
      createHash('sha256').update(token).digest('hex'),
    ]);
  });

  it('nega tokens ausentes, expirados/revogados, permissões insuficientes e plano inativo', async () => {
    await expect(authenticateAgentRequest({ headers: {} }, { scope: 'projects:read' }))
      .rejects.toMatchObject({ status: 401, code: 'agent_token_missing' });
    await expect(authenticateAgentRequest({ headers: { authorization: 'Bearer abc' } }, { scope: 'projects:read' }))
      .rejects.toMatchObject({ status: 401, code: 'agent_token_invalid' });
    const { token } = await (async () => {
      deps.query.mockResolvedValueOnce([row]);
      return createAgentToken('cus_alice');
    })();
    const req = { headers: { authorization: `Bearer ${token}` } };
    // A consulta exclui revoked_at e expires_at; nenhuma linha é autorização.
    deps.query.mockResolvedValueOnce([]);
    await expect(authenticateAgentRequest(req, { scope: 'projects:read' }))
      .rejects.toMatchObject({ status: 401, code: 'agent_token_invalid' });
    expect(deps.query.mock.calls.at(-1)[0]).toContain('expires_at > now()');
    expect(deps.query.mock.calls.at(-1)[0]).toContain('revoked_at IS NULL');
    deps.query.mockResolvedValueOnce([{ ...row, scopes: ['projects:read'] }]);
    await expect(authenticateAgentRequest(req, { scope: 'projects:write' }))
      .rejects.toMatchObject({ status: 403, code: 'agent_scope_denied' });
    deps.query.mockResolvedValueOnce([row]);
    deps.activeSubscription.mockResolvedValueOnce(null);
    await expect(authenticateAgentRequest(req, { scope: 'projects:read' }))
      .rejects.toMatchObject({ status: 402, code: 'agent_subscription_inactive' });
  });

  it('mantém o plugin após logout, mas invalida imediatamente após recuperação de senha', async () => {
    deps.query.mockResolvedValueOnce([row]);
    const { token } = await createAgentToken('cus_alice');
    const req = { headers: { authorization: `Bearer ${token}` } };
    // Logout gira identity_epoch do cookie, porém não vc_agent_epoch.
    deps.customer.mockResolvedValueOnce({ id: 'cus_alice', metadata: {
      vc_identity_epoch: 'logout-epoch', vc_agent_epoch: 'security-1',
    } });
    deps.query.mockResolvedValueOnce([row]);
    await expect(authenticateAgentRequest(req, { scope: 'projects:read' })).resolves.toMatchObject({ ownerId: 'cus_alice' });
    // Recuperação gira vc_agent_epoch; a consulta ao token continua válida,
    // mas a comparação com a conta corrente o rejeita.
    deps.customer.mockResolvedValueOnce({ id: 'cus_alice', metadata: { vc_agent_epoch: 'security-2' } });
    deps.query.mockResolvedValueOnce([row]);
    await expect(authenticateAgentRequest(req, { scope: 'projects:read' }))
      .rejects.toMatchObject({ status: 401, code: 'agent_token_revoked_by_recovery' });
    deps.customer.mockResolvedValueOnce({ id: 'cus_alice', metadata: { vc_agent_epoch: 'security-2' } });
    deps.query.mockResolvedValueOnce([row]);
    expect((await listAgentTokens('cus_alice'))[0].invalidated).toBe(true);
  });

  it('com identidade em Postgres, vincula a chave à conta e à epoch de segurança', async () => {
    const accountId = '8f9eac30-c16f-4456-ac33-f88df78be984';
    deps.identityBackend.mockReturnValue(true);
    deps.account.mockResolvedValue({ id: accountId, agentEpoch: 'db-security-1' });
    deps.query.mockResolvedValueOnce([row]);
    const { token } = await createAgentToken('cus_alice');
    expect(deps.query.mock.calls[0][1].slice(0, 3)).toEqual(['cus_alice', 'db-security-1', accountId]);
    deps.query.mockResolvedValueOnce([{ ...row, account_id: accountId, agent_epoch: 'db-security-1' }]);
    const req = { headers: { authorization: `Bearer ${token}` } };
    await expect(authenticateAgentRequest(req, { scope: 'projects:read' })).resolves.toMatchObject({ ownerId: 'cus_alice' });
    deps.account.mockResolvedValue({ id: accountId, agentEpoch: 'db-security-2' });
    deps.query.mockResolvedValueOnce([{ ...row, account_id: accountId, agent_epoch: 'db-security-1' }]);
    await expect(authenticateAgentRequest(req, { scope: 'projects:read' }))
      .rejects.toMatchObject({ status: 401, code: 'agent_token_revoked_by_recovery' });
  });
});
