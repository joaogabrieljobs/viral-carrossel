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
  expect(body.imageList).toEqual(refs);
  expect(body.prompt).toContain('REFERENCE IMAGES ARE ATTACHED');
  expect(body.prompt).not.toContain('photorealistic real-photograph rendering');
});
it('plano rejeita referências não suportadas antes da requisição', async () => {
  setAIRuntimeSettings({ useOwnImageKey: false });
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  await expect(generateDALLE('world', '', null, { refImages: ['data:image/svg+xml;base64,PHN2Zz4='] })).rejects.toMatchObject({ code: 'reference_invalid', platformImage: true });
  expect(fetchMock).not.toHaveBeenCalled();
});
it('direção expressiva não recebe imposição de fotografia realista', () => {
  const prompt = buildGptImageFullPrompt('floating 3D world', null, 'PROJECT VISUAL STYLE BIBLE: expressive 3D, orange graphic accents', { priorityFirst: true, withReference: true });
  expect(prompt).toContain('REFERENCE IMAGES ARE ATTACHED');
  expect(prompt).toContain('expressive 3D');
  expect(prompt).not.toMatch(/photorealistic real-photograph rendering|muted|quiet/i);
  expect(prompt.slice(0, 4000)).toContain('no text');
});
