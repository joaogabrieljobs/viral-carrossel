import { it, expect, vi, afterEach } from 'vitest';
import { generateDALLE, setAIRuntimeSettings, buildGptImageFullPrompt } from '../../src/utils/ai-client.js';
afterEach(() => { vi.unstubAllGlobals(); setAIRuntimeSettings({}); });
const refs = ['data:image/png;base64,YQ==', 'data:image/png;base64,Yg==', 'data:image/png;base64,Yw=='];
it('OpenAI recebe as três referências e não troca para geração sem referência', async () => {
  setAIRuntimeSettings({ useOwnImageKey: true, imageProvider: 'openai', keys: { openai: 'test-fake' } });
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: 'result' }] }) }));
  vi.stubGlobal('fetch', fetchMock);
  await generateDALLE('3D world', 'test-fake', null, { refImages: refs, imgExtraPrompt: '3D expressivo' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, opts] = fetchMock.mock.calls[0];
  expect(url).toContain('/images/edits');
  expect(opts.body.getAll('image[]')).toHaveLength(3);
  fetchMock.mockReset().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: 'ref refused' } }) });
  await expect(generateDALLE('3D world', 'test-fake', null, { refImages: refs })).rejects.toThrow('ref refused');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toContain('/images/edits');
});
it('plano envia todos os uploads locais na mesma geração, sem descartá-los', async () => {
  setAIRuntimeSettings({ useOwnImageKey: false });
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ b64_json: 'result' }) });
  vi.stubGlobal('fetch', fetchMock);
  await generateDALLE('world', '', null, { refImages: refs });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/ai/sjinn-image');
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.operationId).toMatch(/^[A-Za-z0-9._:-]{1,160}$/);
  expect(body.imageList).toEqual(refs);
  // Anexos sem papel declarado valem como moodboard de estilo: sem estética padrão.
  expect(body.prompt).toContain('REFERENCE ROLES: Use moodboard images for medium, palette, lighting and composition.');
  expect(body.prompt).toContain('STYLE REFERENCE (moodboard): the attached reference images define the look of this image.');
  expect(body.prompt).not.toContain('DEFAULT ART DIRECTION');
  expect(body.prompt).not.toContain('use editorial photography');
});
it('reusa o identificador fornecido para a mesma tentativa de geração', async () => {
  setAIRuntimeSettings({ useOwnImageKey: false });
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ b64_json: 'result' }) });
  vi.stubGlobal('fetch', fetchMock);
  await generateDALLE('world', '', null, { operationId: 'retry-safe-123' });
  await generateDALLE('world', '', null, { operationId: 'retry-safe-123' });
  expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).operationId))
    .toEqual(['retry-safe-123', 'retry-safe-123']);
});
it('envia o contexto de uso para relacionar o crédito ao projeto e ao card', async () => {
  setAIRuntimeSettings({ useOwnImageKey: false });
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ b64_json: 'result' }) });
  vi.stubGlobal('fetch', fetchMock);
  const usageContext = {
    projectId: 'project-123', projectName: 'Campanha', cardId: 'slide-7', cardNumber: 7,
  };
  await generateDALLE('world', '', null, { usageContext });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).usageContext).toEqual(usageContext);
});
it('plano rejeita referências não suportadas antes da requisição', async () => {
  setAIRuntimeSettings({ useOwnImageKey: false });
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  await expect(generateDALLE('world', '', null, { refImages: ['data:image/svg+xml;base64,PHN2Zz4='] })).rejects.toMatchObject({ code: 'reference_invalid', platformImage: true });
  expect(fetchMock).not.toHaveBeenCalled();
});
it('direção expressiva não recebe imposição de fotografia realista', () => {
  const prompt = buildGptImageFullPrompt('floating 3D world', null, 'PROJECT VISUAL STYLE BIBLE: expressive 3D, orange graphic accents', { route: 'sjinn', withReference: true });
  expect(prompt).toContain('REFERENCE ROLES:');
  expect(prompt).toContain('expressive 3D');
  expect(prompt).not.toMatch(/DEFAULT ART DIRECTION|use editorial photography|STYLE REFERENCE \(moodboard\)/i);
  expect(prompt.length).toBeLessThanOrEqual(4000);
  expect(prompt).toContain('HARD RULES: No lettering, captions, logos or watermarks anywhere in the image.');
});
