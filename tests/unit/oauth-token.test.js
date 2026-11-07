import { beforeEach, describe, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({
  createAgentToken: vi.fn(),
  getCurrentAgentSecurityContext: vi.fn(),
  revokeIssuedAgentToken: vi.fn(),
  consumeAuthorizationCode: vi.fn(),
  createRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  rotateRefreshToken: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock('../../api/lib/agent-token-store.js', () => ({
  createAgentToken: deps.createAgentToken,
  getCurrentAgentSecurityContext: deps.getCurrentAgentSecurityContext,
  revokeIssuedAgentToken: deps.revokeIssuedAgentToken,
}));
vi.mock('../../api/lib/oauth-store.js', () => ({
  oauthResource: 'https://moont.ai/mcp',
  consumeAuthorizationCode: deps.consumeAuthorizationCode,
  createRefreshToken: deps.createRefreshToken,
  revokeRefreshToken: deps.revokeRefreshToken,
  rotateRefreshToken: deps.rotateRefreshToken,
}));
vi.mock('../../api/lib/rate-limit.js', () => ({
  consumeRateLimit: deps.consumeRateLimit,
  rateLimitResponse: vi.fn(),
}));

import token from '../../api/oauth/token.js';

function response() {
  const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe('token OAuth do MCP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deps.consumeRateLimit.mockResolvedValue(null);
    deps.consumeAuthorizationCode.mockResolvedValue({
      ownerId: 'owner-1', scopes: ['projects:read', 'projects:write'], clientName: 'Claude',
    });
    deps.getCurrentAgentSecurityContext.mockResolvedValue({
      agentEpoch: 'security-1', accountId: 'account-1', sessionRevokedBefore: 0,
    });
    deps.createAgentToken.mockResolvedValue({
      token: 'moont_agent_access', credential: { id:'11111111-1111-4111-8111-111111111111' },
    });
    deps.createRefreshToken.mockResolvedValue('moont_refresh_next');
    deps.revokeIssuedAgentToken.mockResolvedValue(true);
    deps.revokeRefreshToken.mockResolvedValue(true);
  });

  it('identifica a conexão do Claude e aceita o fluxo antigo sem resource', async () => {
    const req = { method: 'POST', body: {
      grant_type: 'authorization_code', code: 'code-1', client_id: 'client-1',
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback', code_verifier: 'v'.repeat(43),
    } };
    const res = response();
    await token(req, res);
    expect(deps.consumeAuthorizationCode).toHaveBeenCalledWith(expect.objectContaining({ resource: undefined }));
    expect(deps.createAgentToken).toHaveBeenCalledWith('owner-1', expect.objectContaining({
      label: 'MCP OAuth — Claude', scopes: ['projects:read', 'projects:write'],
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      access_token: 'moont_agent_access', refresh_token: 'moont_refresh_next', resource: 'https://moont.ai/mcp',
    });
  });

  it('revoga as credenciais novas quando a segurança muda durante a rotação', async () => {
    deps.rotateRefreshToken.mockResolvedValue({
      ownerId: 'owner-1', scopes: ['projects:read'], clientName: 'Claude',
      securitySnapshot: { agentEpoch:'security-1', accountId:'account-1', sessionRevokedBefore:0 },
    });
    deps.getCurrentAgentSecurityContext.mockResolvedValue({
      agentEpoch:'security-2', accountId:'account-1', sessionRevokedBefore:100,
    });
    const req = { method:'POST', body:{
      grant_type:'refresh_token', refresh_token:'moont_refresh_old',
      client_id:'client-1', resource:'https://moont.ai/mcp',
    } };
    const res = response();

    await token(req, res);

    expect(deps.revokeIssuedAgentToken).toHaveBeenCalledWith(
      'owner-1', '11111111-1111-4111-8111-111111111111',
    );
    expect(deps.revokeRefreshToken).toHaveBeenCalledWith({
      token:'moont_refresh_next', ownerId:'owner-1', revokeFamily:true,
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error:'invalid_grant' }));
    expect(res.status).not.toHaveBeenCalledWith(200);
  });

  it('não desconecta a integração por logout comum quando época e conta são iguais', async () => {
    deps.rotateRefreshToken.mockResolvedValue({
      ownerId:'owner-1', scopes:['projects:read'], clientName:'Claude',
      securitySnapshot:{ agentEpoch:'security-1', accountId:'account-1', sessionRevokedBefore:0 },
    });
    deps.getCurrentAgentSecurityContext.mockResolvedValue({
      agentEpoch:'security-1', accountId:'account-1', sessionRevokedBefore:Date.now(),
    });
    const req = { method:'POST', body:{
      grant_type:'refresh_token', refresh_token:'moont_refresh_old',
      client_id:'client-1', resource:'https://moont.ai/mcp',
    } };
    const res = response();

    await token(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(deps.revokeRefreshToken).not.toHaveBeenCalledWith(expect.objectContaining({ revokeFamily:true }));
  });
});
