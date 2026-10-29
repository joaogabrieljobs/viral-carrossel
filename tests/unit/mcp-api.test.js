import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  auth: vi.fn(), limit: vi.fn(), list: vi.fn(), project: vi.fn(), job: vi.fn(),
  previewText: vi.fn(), applyText: vi.fn(), previewVisual: vi.fn(), applyVisual: vi.fn(), undo: vi.fn(),
  image: vi.fn(),
}));
vi.mock('../../api/lib/agent-image-generation.js', () => ({ startAgentImageJob: mocked.image, getAgentChangeStatus: mocked.job }));
vi.mock('../../api/lib/agent-token-store.js', async () => {
  class AgentTokenError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
  return { AgentTokenError, authenticateAgentRequest: mocked.auth };
});
vi.mock('../../api/lib/rate-limit.js', () => ({ consumeRateLimit: mocked.limit, rateLimitResponse: vi.fn() }));
vi.mock('../../api/lib/agent-visual-batch.js', () => ({
  listAgentProjects: mocked.list, getAgentProject: mocked.project, getAgentVisualJob: mocked.job,
  previewAgentTextEdit: mocked.previewText, applyAgentTextEdit: mocked.applyText,
  previewAgentVisualBatch: mocked.previewVisual, applyAgentVisualBatch: mocked.applyVisual,
  undoAgentVisualBatch: mocked.undo,
}));

import handler, { MCP_TOOLS } from '../../api/mcp.js';

function response() {
  const res = { headers: {}, setHeader: vi.fn((key, value) => { res.headers[key] = value; }), status: vi.fn(), json: vi.fn(), end: vi.fn() };
  res.status.mockReturnValue(res); res.json.mockReturnValue(res); res.end.mockReturnValue(res); return res;
}
async function send(body, headers = { 'content-type': 'application/json', authorization: 'Bearer token' }) {
  const res = response();
  await handler({ method: 'POST', body, headers }, res);
  return { status: res.status.mock.calls.at(-1)?.[0], body: res.json.mock.calls.at(-1)?.[0], headers: res.headers };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.auth.mockResolvedValue({ ownerId: 'cus_test', tokenId: 'token-id', scopes: ['projects:read', 'projects:write'] });
  mocked.limit.mockResolvedValue(null);
});

describe('remote MCP endpoint', () => {
  it('negocia o protocolo e anuncia ferramentas com permissões', async () => {
    const init = await send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    expect(init.body.result).toMatchObject({ protocolVersion: '2025-06-18', serverInfo: { name: 'moont' } });
    const listed = await send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    expect(listed.body.result.tools).toHaveLength(MCP_TOOLS.length);
    expect(listed.body.result.tools.find(item => item.name === 'apply_text_edit'))
      .toMatchObject({ annotations: { readOnlyHint: false }, securitySchemes: [{ scopes: ['projects:write'] }] });
    expect(listed.body.result.tools.find(item => item.name === 'generate_slide_image'))
      .toMatchObject({ annotations: { readOnlyHint: false }, securitySchemes: [{ scopes: ['projects:write'] }] });
  });

  it('separa escopo de leitura e escrita e retorna conteúdo estruturado', async () => {
    mocked.list.mockResolvedValue({ projects: [{ id: 'p1' }], total: 1 });
    const read = await send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_projects', arguments: {} } });
    expect(read.body.result.structuredContent.total).toBe(1);
    mocked.applyText.mockResolvedValue({ status: 'applied', requestId: 'request-01' });
    const write = await send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: {
      name: 'apply_text_edit', arguments: { projectId: 'p1', baseVersion: 1, patch: { projectName: 'Novo' }, requestId: 'request-01' },
    } });
    expect(write.body.result.isError).toBeUndefined();
    expect(mocked.auth.mock.calls.map(call => call[1].scope)).toEqual(['projects:read', 'projects:write']);
  });

  it('inicia o job de imagem com escopo de escrita e expõe o acompanhamento', async () => {
    mocked.image.mockResolvedValue({ requestId: 'image-request-01', status: 'pending', slides: [{ slideId: 's1', status: 'pending' }] });
    const result = await send({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: {
      name: 'generate_slide_image', arguments: { projectId: 'p1', baseVersion: 2, slideIds: ['s1'], requestId: 'image-request-01' },
    } });
    expect(result.body.result.structuredContent).toMatchObject({ status: 'pending', slides: [{ slideId: 's1', status: 'pending' }] });
    expect(mocked.image).toHaveBeenCalledWith('cus_test', 'token-id', { projectId: 'p1', baseVersion: 2, slideIds: ['s1'], requestId: 'image-request-01' });
    expect(mocked.auth).toHaveBeenCalledWith(expect.anything(), { scope: 'projects:write' });
    mocked.job.mockResolvedValue({ requestId: 'image-request-01', status: 'applied', afterVersion: 3, slides: [{ slideId: 's1', status: 'done' }] });
    const status = await send({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'get_change_status', arguments: { requestId: 'image-request-01' } } });
    expect(status.body.result.structuredContent).toMatchObject({ status: 'applied', afterVersion: 3 });
    expect(mocked.auth.mock.calls.at(-1)[1]).toEqual({ scope: 'projects:read' });
  });

  it('devolve os detalhes de recusa da geração sem vazar a stack', async () => {
    mocked.image.mockRejectedValue(Object.assign(new Error('Quota insuficiente.'), { code: 'quota_exhausted', needed: 3, remaining: 1 }));
    const result = await send({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: {
      name: 'generate_slide_image', arguments: { projectId: 'p1', baseVersion: 2, requestId: 'image-request-02' },
    } });
    expect(result.body.result.isError).toBe(true);
    expect(result.body.result.structuredContent).toEqual({ error: 'Quota insuficiente.', code: 'quota_exhausted', needed: 3, remaining: 1 });
  });

  it('responde 401 com descoberta OAuth quando a credencial falta', async () => {
    const { AgentTokenError } = await import('../../api/lib/agent-token-store.js');
    mocked.auth.mockRejectedValue(new AgentTokenError(401, 'agent_token_missing', 'ausente'));
    const result = await send({ jsonrpc: '2.0', id: 1, method: 'initialize' }, { 'content-type': 'application/json' });
    expect(result.status).toBe(401);
    expect(result.headers['WWW-Authenticate']).toContain('/.well-known/oauth-protected-resource');
  });
});
