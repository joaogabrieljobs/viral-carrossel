import { beforeEach, describe, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({
  createAgentToken: vi.fn(),
  getCurrentAgentSecurityContext: vi.fn(),
  revokeSupersededOAuthTokens: vi.fn(),
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
  revokeSupersededOAuthTokens: deps.revokeSupersededOAuthTokens,
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
    deps.revokeSupersededOAuthTokens.mockResolvedValue(1);
    deps.revokeRefreshToken.mockResolvedValue(true);
  });

  it('responde falha fechada no formato OAuth', async () => {
    deps.consumeRateLimit.mockResolvedValueOnce({ unavailable:true, retryAfterSec:0 });
    const res = response();
    await token({ method:'POST', body:{} }, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error:'temporarily_unavailable',
      error_description:expect.stringContaining('temporariamente indisponível'),
    });
    expect(deps.consumeAuthorizationCode).not.toHaveBeenCalled();
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
      oauthClientId:'client-1',
    }));
    expect(deps.revokeSupersededOAuthTokens).toHaveBeenCalledWith(
      'owner-1', 'client-1', '11111111-1111-4111-8111-111111111111',
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      access_token: 'moont_agent_access', refresh_token: 'moont_refresh_next', resource: 'https://moont.ai/mcp',
    });
  });

  it('emite e deduplica a rotação dentro da transação fornecida pelo store', async () => {
    const tx = { unsafe:vi.fn() };
    deps.rotateRefreshToken.mockImplementation(async ({ issue }) => {
      const grant = {
        ownerId:'owner-1', scopes:['projects:read'], clientName:'Claude',
        securitySnapshot:{ agentEpoch:'security-1', accountId:'account-1', sessionRevokedBefore:0 },
      };
      const issued = await issue({ grant, tx, identity:grant.securitySnapshot });
      return { ...grant, issued };
    });
    const req = { method:'POST', body:{
      grant_type:'refresh_token', refresh_token:'moont_refresh_old',
      client_id:'client-1', resource:'https://moont.ai/mcp',
    } };
    const res = response();

    await token(req, res);

    expect(deps.createAgentToken).toHaveBeenCalledWith('owner-1', expect.objectContaining({
      oauthClientId:'client-1',
    }), expect.objectContaining({ connection:tx }));
    expect(deps.createRefreshToken).toHaveBeenCalledWith(expect.objectContaining({
      clientId:'client-1', ownerId:'owner-1',
    }), expect.objectContaining({ connection:tx }));
    expect(deps.revokeSupersededOAuthTokens).toHaveBeenCalledWith(
      'owner-1', 'client-1', '11111111-1111-4111-8111-111111111111', { connection:tx },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('não desconecta a integração por logout comum quando época e conta são iguais', async () => {
    deps.rotateRefreshToken.mockImplementation(async ({ issue }) => {
      const grant = {
        ownerId:'owner-1', scopes:['projects:read'], clientName:'Claude',
        securitySnapshot:{ agentEpoch:'security-1', accountId:'account-1', sessionRevokedBefore:Date.now() },
      };
      return { ...grant, issued:await issue({ grant, tx:{ unsafe:vi.fn() }, identity:grant.securitySnapshot }) };
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

  it('mantém erro de pedido em 400, mas falha transitória de storage em 503 OAuth', async () => {
    const request = { method:'POST', body:{
      grant_type:'refresh_token', refresh_token:'moont_refresh_old',
      client_id:'client-1', resource:'https://moont.ai/mcp',
    } };
    deps.rotateRefreshToken.mockRejectedValueOnce(Object.assign(
      new Error('Renovação inválida ou expirada.'), { code:'invalid_grant', status:400 },
    ));
    const invalid = response();
    await token(request, invalid);
    expect(invalid.status).toHaveBeenCalledWith(400);
    expect(invalid.json).toHaveBeenCalledWith(expect.objectContaining({ error:'invalid_grant' }));

    deps.rotateRefreshToken.mockRejectedValueOnce(Object.assign(
      new Error('database connection lost'), { code:'db_down' },
    ));
    const unavailable = response();
    await token(request, unavailable);
    expect(unavailable.status).toHaveBeenCalledWith(503);
    expect(unavailable.json).toHaveBeenCalledWith({
      error:'temporarily_unavailable',
      error_description:expect.stringContaining('Tente novamente'),
    });
    expect(unavailable.json.mock.calls[0][0].error_description).not.toContain('database');
  });
});
