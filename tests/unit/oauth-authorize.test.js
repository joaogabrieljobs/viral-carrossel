import { beforeEach, describe, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({
  readCurrentAccessCookie: vi.fn(),
  billingDisabled: vi.fn(),
  findActiveSubscription: vi.fn(),
  validateOAuthRequest: vi.fn(),
}));

vi.mock('../../api/lib/access.js', () => ({
  readCurrentAccessCookie: deps.readCurrentAccessCookie,
  billingDisabled: deps.billingDisabled,
}));
vi.mock('../../api/lib/stripe.js', () => ({ findActiveSubscription: deps.findActiveSubscription }));
vi.mock('../../api/lib/library-sync-store.js', () => ({ resolveLibraryOwnerId: vi.fn(() => 'owner-1') }));
vi.mock('../../api/lib/oauth-store.js', () => ({
  oauthResource: 'https://moont.ai/mcp',
  validateOAuthRequest: deps.validateOAuthRequest,
  createAuthorizationCode: vi.fn(async () => 'code-1'),
}));

import authorize from '../../api/oauth/authorize.js';

function request() {
  return {
    method: 'GET',
    query: {
      response_type: 'code', code_challenge_method: 'S256', resource: 'https://moont.ai/mcp',
      state: 'state-1', client_id: 'client-1', redirect_uri: 'https://chatgpt.com/oauth/callback',
      scope: 'projects:read projects:write', code_challenge: 'challenge-1',
    },
  };
}

function response() {
  const res = { setHeader: vi.fn(), status: vi.fn(), send: vi.fn(), end: vi.fn(), redirect: vi.fn() };
  res.status.mockReturnValue(res); res.send.mockReturnValue(res); return res;
}

describe('autorização OAuth do MCP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deps.readCurrentAccessCookie.mockResolvedValue({ customerId:'cus_1', email:'pessoa@empresa.com' });
    deps.billingDisabled.mockReturnValue(false);
    deps.findActiveSubscription.mockResolvedValue({ id:'sub_1', status:'active' });
    deps.validateOAuthRequest.mockResolvedValue({
      client:{ client_name:'ChatGPT' }, scopes:['projects:read','projects:write'],
      redirectUri:'https://chatgpt.com/oauth/callback',
    });
  });

  it('mostra qual conta Moont será conectada', async () => {
    const res = response();
    await authorize(request(), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send.mock.calls[0][0]).toContain('pessoa@empresa.com');
    expect(res.send.mock.calls[0][0]).toContain('Conectar ChatGPT');
  });

  it('aceita o callback OAuth do Claude no fluxo MCP sem resource explícito', async () => {
    deps.validateOAuthRequest.mockResolvedValue({
      client:{ client_name:'Claude' }, scopes:['projects:read','projects:write'],
      redirectUri:'https://claude.ai/api/mcp/auth_callback',
    });
    const req = request();
    delete req.query.resource;
    req.query.redirect_uri = 'https://claude.ai/api/mcp/auth_callback';
    const res = response();
    await authorize(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send.mock.calls[0][0]).toContain('Conectar Claude');
    expect(deps.validateOAuthRequest).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'https://moont.ai/mcp',
      redirectUri: 'https://claude.ai/api/mcp/auth_callback',
    }));
  });

  it('explica quando a conta não tem assinatura ativa', async () => {
    deps.findActiveSubscription.mockResolvedValue(null);
    const res = response();
    await authorize(request(), res);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.send.mock.calls[0][0]).toContain('Assinatura inativa');
    expect(res.send.mock.calls[0][0]).toContain('pessoa@empresa.com');
  });

  it('não transforma falha temporária da cobrança em botão sem resposta', async () => {
    deps.findActiveSubscription.mockRejectedValue(new Error('Stripe indisponível'));
    const res = response();
    await authorize(request(), res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.send.mock.calls[0][0]).toContain('Não foi possível verificar sua assinatura');
    expect(res.send.mock.calls[0][0]).toContain('Tentar novamente');
  });

  it('trata cliente antigo ausente como assinatura inativa', async () => {
    deps.findActiveSubscription.mockRejectedValue(Object.assign(new Error('No such customer'), { code:'resource_missing' }));
    const res = response();
    await authorize(request(), res);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.send.mock.calls[0][0]).toContain('Assinatura inativa');
  });
});
