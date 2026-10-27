import { beforeEach, describe, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({
  createAgentToken: vi.fn(),
  consumeAuthorizationCode: vi.fn(),
  createRefreshToken: vi.fn(),
  rotateRefreshToken: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock('../../api/lib/agent-token-store.js', () => ({ createAgentToken: deps.createAgentToken }));
vi.mock('../../api/lib/oauth-store.js', () => ({
  oauthResource: 'https://moont.ai/mcp',
  consumeAuthorizationCode: deps.consumeAuthorizationCode,
  createRefreshToken: deps.createRefreshToken,
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
    deps.createAgentToken.mockResolvedValue({ token: 'moont_agent_access' });
    deps.createRefreshToken.mockResolvedValue('moont_refresh_next');
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
});
