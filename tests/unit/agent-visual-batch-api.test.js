import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  auth: vi.fn(), limit: vi.fn(), rateResponse: vi.fn(),
  list: vi.fn(), project: vi.fn(), job: vi.fn(), preview: vi.fn(), apply: vi.fn(), undo: vi.fn(),
  previewText: vi.fn(), applyText: vi.fn(),
  image: vi.fn(),
}));
vi.mock('../../api/lib/agent-image-generation.js', () => ({ generateAndApplyAgentSlideImage: mocked.image }));
vi.mock('../../api/lib/agent-token-store.js', () => ({ authenticateAgentRequest: mocked.auth }));
vi.mock('../../api/lib/rate-limit.js', () => ({
  consumeRateLimit: mocked.limit, rateLimitResponse: mocked.rateResponse,
}));
vi.mock('../../api/lib/agent-visual-batch.js', () => ({
  listAgentProjects: mocked.list, getAgentProject: mocked.project,
  getAgentVisualJob: mocked.job, previewAgentVisualBatch: mocked.preview,
  applyAgentVisualBatch: mocked.apply, undoAgentVisualBatch: mocked.undo,
  previewAgentTextEdit: mocked.previewText, applyAgentTextEdit: mocked.applyText,
}));

import handler from '../../api/agent-visual-batch.js';

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
  return { status: res.status.mock.calls.at(-1)?.[0], body: res.json.mock.calls.at(-1)?.[0] };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('LIBRARY_SYNC_BACKEND', 'postgres');
  mocked.auth.mockResolvedValue({ ownerId: 'cus_alice', tokenId: 'token-1', scopes: ['projects:read', 'projects:write'] });
  mocked.limit.mockResolvedValue(null);
});

describe('/api/agent-visual-batch', () => {
  it('autentica leitura/lista/preview e escrita/apply/undo com escopos distintos', async () => {
    mocked.list.mockResolvedValue({ projects: [], nextCursor: null, total: 0 });
    mocked.project.mockResolvedValue({ id: 'p', version: 1, slides: [] });
    mocked.preview.mockResolvedValue({ projectId: 'p', slideCount: 0, changes: [] });
    mocked.apply.mockResolvedValue({ requestId: 'request-01', status: 'applied' });
    mocked.undo.mockResolvedValue({ requestId: 'request-01', status: 'undone' });
    mocked.previewText.mockResolvedValue({ projectId: 'p', changedSlideCount: 1, changes: [] });
    mocked.applyText.mockResolvedValue({ requestId: 'request-text-01', status: 'applied' });
    mocked.image.mockResolvedValue({ requestId: 'request-image-01', status: 'applied', hasPhoto: true });
    await request('GET', { query: { op: 'projects' } });
    await request('GET', { query: { op: 'project', id: 'p' } });
    await request('POST', { body: { action: 'preview', projectId: 'p' } });
    await request('POST', { body: { action: 'apply', projectId: 'p' } });
    await request('POST', { body: { action: 'undo', requestId: 'request-01' } });
    await request('POST', { body: { action: 'preview_text', projectId: 'p' } });
    await request('POST', { body: { action: 'apply_text', projectId: 'p' } });
    await request('POST', { body: { action: 'generate_image', projectId: 'p', slideId: 's1' } });
    expect(mocked.auth.mock.calls.map(call => call[1].scope))
      .toEqual(['projects:read', 'projects:read', 'projects:read', 'projects:write', 'projects:write', 'projects:read', 'projects:write', 'projects:write']);
    expect(mocked.apply).toHaveBeenCalledWith('cus_alice', 'token-1', { action: 'apply', projectId: 'p' });
    expect(mocked.applyText).toHaveBeenCalledWith('cus_alice', 'token-1', { action: 'apply_text', projectId: 'p' });
    expect(mocked.image).toHaveBeenCalledWith('cus_alice', 'token-1', { action: 'generate_image', projectId: 'p', slideId: 's1' });
  });

  it('bloqueia antes de consultar o projeto quando o Bearer não é válido', async () => {
    mocked.auth.mockRejectedValue(Object.assign(new Error('Credencial inválida.'), { status: 401, code: 'agent_token_invalid' }));
    const result = await request('GET', { query: { op: 'project', id: 'p' } });
    expect(result).toMatchObject({ status: 401, body: { code: 'agent_token_invalid' } });
    expect(mocked.project).not.toHaveBeenCalled();
  });

  it('mapeia conflitos e cursores inválidos sem expor snapshots', async () => {
    mocked.apply.mockRejectedValue(Object.assign(new Error('Conflito'), {
      status: 409, code: 'project_conflict', cloudVersion: 9,
    }));
    const conflict = await request('POST', { body: { action: 'apply' } });
    expect(conflict).toMatchObject({ status: 409, body: { code: 'project_conflict', cloudVersion: 9 } });
    expect(JSON.stringify(conflict)).not.toContain('before_entry');
    mocked.list.mockRejectedValue(Object.assign(new Error('cursor'), { code: 'project_bad_cursor' }));
    expect(await request('GET', { query: { op: 'projects', cursor: 'bad' } }))
      .toMatchObject({ status: 400, body: { code: 'project_bad_cursor' } });
  });
});
