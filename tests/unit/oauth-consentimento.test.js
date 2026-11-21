// MOO-17 — tela de consentimento OAuth com registro dinâmico aberto:
// o host de retorno vem antes do nome informado pelo aplicativo, e host não
// verificado exige confirmação explícita, conferida no servidor.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({
  readCurrentAccessCookie: vi.fn(),
  billingDisabled: vi.fn(),
  findActiveSubscription: vi.fn(),
  validateOAuthRequest: vi.fn(),
  createAuthorizationCode: vi.fn(),
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
  createAuthorizationCode: deps.createAuthorizationCode,
}));

import authorize from '../../api/oauth/authorize.js';

const RETORNO_ESTRANHO = 'https://x.exemplo/cb';

function query(overrides = {}) {
  return {
    response_type: 'code', code_challenge_method: 'S256', resource: 'https://moont.ai/mcp',
    state: 'state-1', client_id: 'client-1', redirect_uri: RETORNO_ESTRANHO,
    scope: 'projects:read projects:write', code_challenge: 'c'.repeat(43), ...overrides,
  };
}
function response() {
  const res = { setHeader: vi.fn(), status: vi.fn(), send: vi.fn(), end: vi.fn(), redirect: vi.fn() };
  res.status.mockReturnValue(res); res.send.mockReturnValue(res); return res;
}
async function get(q = query()) {
  const res = response();
  await authorize({ method: 'GET', query: q }, res);
  return { res, html: res.send.mock.calls[0]?.[0] || '' };
}
async function post(body) {
  const res = response();
  await authorize({ method: 'POST', body }, res);
  return { res, html: res.send.mock.calls[0]?.[0] || '' };
}
function cliente(client_name, redirectUri = RETORNO_ESTRANHO) {
  deps.validateOAuthRequest.mockResolvedValue({
    client: { client_name }, scopes: ['projects:read', 'projects:write'], redirectUri,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.readCurrentAccessCookie.mockResolvedValue({ customerId: 'cus_1', email: 'pessoa@empresa.com' });
  deps.billingDisabled.mockReturnValue(false);
  deps.findActiveSubscription.mockResolvedValue({ id: 'sub_1', status: 'active' });
  deps.createAuthorizationCode.mockResolvedValue('code-1');
  cliente('ChatGPT');
});

describe('tela de consentimento (render)', () => {
  it('cliente "ChatGPT" com retorno estranho não vira título "Conectar ChatGPT"', async () => {
    const { html } = await get();
    expect(html).not.toContain('Conectar ChatGPT');
    const titulo = html.match(/<h1>(.*?)<\/h1>/)[1];
    expect(titulo).toContain('x.exemplo');
    expect(titulo).not.toContain('ChatGPT');
  });

  it('mostra o host de retorno antes do nome, e o nome rotulado como informado pelo aplicativo', async () => {
    const { html } = await get();
    const host = html.indexOf('x.exemplo');
    const rotulo = html.indexOf('Nome informado pelo aplicativo');
    const nome = html.indexOf('ChatGPT');
    expect(host).toBeGreaterThan(-1);
    expect(rotulo).toBeGreaterThan(host);
    expect(nome).toBeGreaterThan(rotulo);
  });

  it('host não verificado exige caixa "Confio em <host>" no formulário', async () => {
    const { html } = await get();
    expect(html).toContain('Aplicativo não verificado pela Moont');
    expect(html).toMatch(/<input type="checkbox" name="trust_host" value="x\.exemplo" required>/);
    expect(html).toContain('Confio em x.exemplo');
  });

  it('host verificado (chatgpt.com) não pede a confirmação extra', async () => {
    cliente('ChatGPT', 'https://chatgpt.com/oauth/callback');
    const { html } = await get(query({ redirect_uri: 'https://chatgpt.com/oauth/callback' }));
    expect(html).not.toContain('name="trust_host"');
    expect(html).not.toContain('Aplicativo não verificado');
    expect(html.match(/<h1>(.*?)<\/h1>/)[1]).toContain('chatgpt.com');
  });

  it('escapa nome do aplicativo e parâmetros refletidos', async () => {
    cliente('<img src=x onerror=alert(1)>"\'&');
    const { html } = await get(query({ state: '"><script>alert(2)</script>' }));
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert(2)');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;');
    expect(html).toContain('value="&quot;&gt;&lt;script&gt;alert(2)&lt;/script&gt;"');
  });

  it('trust_host e decision vindos no link não viram campos ocultos pré-preenchidos', async () => {
    const { html } = await get(query({ trust_host: 'x.exemplo', decision: 'allow' }));
    expect(html).not.toContain('<input type="hidden" name="trust_host"');
    expect(html).not.toContain('<input type="hidden" name="decision"');
  });
});

describe('POST de consentimento', () => {
  it('host não verificado sem a confirmação é recusado e não emite código', async () => {
    const { res, html } = await post({ ...query(), decision: 'allow' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(html).toContain('Confio em x.exemplo');
    expect(res.redirect).not.toHaveBeenCalled();
    expect(deps.createAuthorizationCode).not.toHaveBeenCalled();
  });

  it('confirmação com outro host também é recusada', async () => {
    const { res } = await post({ ...query(), decision: 'allow', trust_host: 'chatgpt.com' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(deps.createAuthorizationCode).not.toHaveBeenCalled();
  });

  it('host não verificado com "Confio em x.exemplo" marcado autoriza normalmente', async () => {
    const { res } = await post({ ...query(), decision: 'allow', trust_host: 'x.exemplo' });
    expect(deps.createAuthorizationCode).toHaveBeenCalledTimes(1);
    expect(res.redirect).toHaveBeenCalledWith(302, expect.stringContaining('https://x.exemplo/cb?state=state-1&code=code-1'));
  });

  it('cancelar não exige a confirmação', async () => {
    const { res } = await post({ ...query(), decision: 'deny' });
    expect(res.redirect).toHaveBeenCalledWith(302, expect.stringContaining('error=access_denied'));
    expect(deps.createAuthorizationCode).not.toHaveBeenCalled();
  });

  it('host verificado autoriza sem confirmação extra (ChatGPT, Claude e loopback do Claude Code)', async () => {
    for (const redirect of ['https://chatgpt.com/oauth/callback', 'https://claude.ai/api/mcp/auth_callback', 'http://127.0.0.1:32123/callback']) {
      cliente('Cliente', redirect);
      deps.createAuthorizationCode.mockClear();
      await post({ ...query({ redirect_uri: redirect }), decision: 'allow' });
      expect(deps.createAuthorizationCode).toHaveBeenCalledTimes(1);
    }
  });
});
