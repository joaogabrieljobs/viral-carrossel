import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeReferenceVisuals, prepareReferenceVisualImages, requestReferenceVisualCompletion } from '../../src/utils/reference-visual-client.js';
import { referenceVisualContextKey, referenceVisualRecord, matchingReferenceVisualRecord, referenceVisualAnalysisForSavedPlan } from '../../src/utils/reference-visual-cache.js';
import { normalizeStyleKit } from '../../src/utils/style-kit.js';
import { originalImageAssetId } from '../../src/utils/cloud-image-assets.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6xkAAAAASUVORK5CYII=';
const analysis = {
  schemaVersion: 1,
  evidence: { medium: 'Editorial photography with printed accents.', light: 'Orange key light and magenta rim.',
    finish: 'Visible fine grain and skin texture.', graphics: 'Small cyan organic shapes around the photograph.' },
  interpretation: { atmosphere: 'Warm and energetic.' },
  direction: { invariants: ['Preserve photographic skin texture.'], variables: ['Cast and gesture.'],
    restrictions: ['No baked lettering.'], composition: 'Reserve quiet space according to each layout.' },
  synthesis: 'Editorial photography, textured skin and fine grain, orange key light, magenta rim, sparse cyan organic accents. Keep faces and gestures legible.',
};
const kit = { stylePrompt: 'Use the visual language of the attached flyer.', refImages: [{ id: 'ref1', imageId: 'img1' }] };
const context = { brief: 'An event about music and encounters.', application: 'Horizontal presentation 16:9' };
const response = (status, body) => ({ ok: status < 400, status, headers: new Headers(), text: async () => JSON.stringify(body) });

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('leitura real da referência antes do roteiro', () => {
  it('envia os pixels com o briefing uma vez e devolve uma análise validada, sem base64 persistido', async () => {
    const transport = vi.fn(async () => JSON.stringify(analysis));
    const prepare = vi.fn(async value => value);
    const loadSources = vi.fn(async () => [PNG]);
    const result = await analyzeReferenceVisuals({ kit, ...context, loadSources }, { transport, prepare });
    expect(transport).toHaveBeenCalledTimes(1);
    const messages = transport.mock.calls[0][0];
    expect(messages[1].content.filter(part => part.type === 'image_url')).toEqual([{ type: 'image_url', image_url: { url: PNG } }]);
    expect(messages[1].content[0].text).toContain(context.brief);
    expect(result.cached).toBe(false);
    expect(result.analysis.evidence.finish).toBe(analysis.evidence.finish);
    expect(result.record.model).toBe('glm-4.6v');
    expect(result.record.refIds).toEqual(['img1']);
    expect(JSON.stringify(result.record)).not.toContain('data:image');
  });

  it('reusa somente análise do mesmo conjunto de referências, briefing e direção', async () => {
    const record = referenceVisualRecord(kit, analysis, { ...context, contentIds: [await originalImageAssetId(PNG)] });
    const cachedKit = { ...kit, referenceVisual: record };
    const transport = vi.fn();
    const loadSources = vi.fn(async () => [PNG]);
    const result = await analyzeReferenceVisuals({ kit: cachedKit, ...context, loadSources }, { transport });
    expect(result.cached).toBe(true);
    expect(result.analysis.synthesis).toBe(analysis.synthesis);
    expect(transport).not.toHaveBeenCalled();
    expect(loadSources).toHaveBeenCalledTimes(1);
    expect(matchingReferenceVisualRecord({ ...cachedKit, stylePrompt: 'Watercolor now.' }, context)).toBeNull();
    expect(matchingReferenceVisualRecord(cachedKit, { ...context, brief: 'Architecture only.' })).toBeNull();
    expect(matchingReferenceVisualRecord({ ...cachedKit, refImages: [{ id: 'ref1', imageId: 'img2' }] }, context)).toBeNull();
    expect(matchingReferenceVisualRecord({ ...cachedKit, referenceVisual: { ...record, model: 'unknown' } }, context)).toBeNull();
    expect(normalizeStyleKit(cachedKit).referenceVisual).toEqual(record);
    expect(referenceVisualAnalysisForSavedPlan({ referenceVisualAnalysis: analysis }, cachedKit).synthesis).toBe(analysis.synthesis);
    expect(referenceVisualAnalysisForSavedPlan({ referenceVisualAnalysis: analysis }, { ...cachedKit, stylePrompt: 'New look.' })).toBeNull();
    expect(referenceVisualAnalysisForSavedPlan({ referenceVisualAnalysis: { ...analysis, synthesis: 'Different reading.' } }, cachedKit)).toBeNull();
    expect(normalizeStyleKit({ ...kit, referenceVisual: { ...record, analysis: { synthesis: 'invented' } } })).not.toHaveProperty('referenceVisual');
  });

  it('invalida também bytes inline alterados sob o mesmo ID, e a ordem do moodboard', () => {
    const a = { ...kit, refImages: [{ id: 'r1', dataUrl: PNG }, { id: 'r2', dataUrl: PNG }] };
    const b = { ...a, refImages: [{ ...a.refImages[0], dataUrl: PNG + 'changed' }, a.refImages[1]] };
    expect(referenceVisualContextKey(a, context)).not.toBe(referenceVisualContextKey(b, context));
    expect(referenceVisualContextKey(a, context)).not.toBe(referenceVisualContextKey({ ...a, refImages: [...a.refImages].reverse() }, context));
  });

  it('não inventa leitura quando falta imagem ou a resposta não tem evidências', async () => {
    const transport = vi.fn(async () => ({ synthesis: 'generic premium style' }));
    await expect(analyzeReferenceVisuals({ kit, ...context, loadSources: async () => [] }, { transport }))
      .rejects.toMatchObject({ code: 'reference_visual_missing_images' });
    expect(transport).not.toHaveBeenCalled();
    await expect(analyzeReferenceVisuals({ kit, ...context, loadSources: async () => [PNG] }, { transport, prepare: async value => value }))
      .rejects.toMatchObject({ code: 'reference_visual_invalid_response' });
    expect(transport).toHaveBeenCalledTimes(1);
    const absent = await analyzeReferenceVisuals({ kit: { refImages: [] }, ...context }, { transport });
    expect(absent).toBeNull();
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('interrompe antes do transporte se o projeto for cancelado', async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = vi.fn();
    await expect(analyzeReferenceVisuals({ kit, ...context, signal: controller.signal, loadSources: async () => [PNG] }, { transport }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(transport).not.toHaveBeenCalled();
  });
});

describe('cópia visual do moodboard', () => {
  it('mantém resolução suficiente e a imagem inteira, sem recortar nem alterar os originais', async () => {
    const large = 'data:image/png;base64,' + 'a'.repeat(400000);
    const drawImage = vi.fn();
    const canvas = { getContext: () => ({ fillRect: vi.fn(), drawImage }), toDataURL: vi.fn(() => PNG) };
    const image = { naturalWidth: 4000, naturalHeight: 2250 };
    const source = [large];
    const result = await prepareReferenceVisualImages(source, { loadImage: async () => image, createCanvas: () => canvas });
    expect(source).toEqual([large]);
    expect(result).toEqual([PNG]);
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(900);
    expect(drawImage).toHaveBeenCalledWith(image, 0, 0, 1600, 900);
  });

  it('preserva o original pequeno e recusa perder anexos silenciosamente', async () => {
    expect(await prepareReferenceVisualImages([PNG], { loadImage: async () => ({ naturalWidth: 1200, naturalHeight: 700 }) })).toEqual([PNG]);
    await expect(prepareReferenceVisualImages(Array(5).fill(PNG))).rejects.toMatchObject({ code: 'reference_visual_invalid_images' });
    await expect(prepareReferenceVisualImages(['https://example.com/image.png'])).rejects.toMatchObject({ code: 'reference_visual_invalid_images' });
    await expect(prepareReferenceVisualImages([PNG], { loadImage: async () => { throw new Error('decode'); } }))
      .rejects.toMatchObject({ code: 'reference_visual_image_unreadable' });
  });
});

describe('transporte da análise visual', () => {
  const messages = [{ role: 'system', content: 'Return the visual analysis as JSON.' }, { role: 'user', content: [{ type: 'text', text: 'Read this reference.' }, { type: 'image_url', image_url: { url: PNG } }] }];

  it('usa propósito e modelo de visão explícitos sem trocar o modelo de redação', async () => {
    const fetchImpl = vi.fn(async () => response(200, { choices: [{ message: { content: JSON.stringify(analysis) }, finish_reason: 'stop' }] }));
    expect(await requestReferenceVisualCompletion(messages, { fetchImpl })).toBe(JSON.stringify(analysis));
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/ai/compatible');
    expect(options.credentials).toBe('include');
    expect(JSON.parse(options.body)).toMatchObject({ provider: 'zai', operation: 'chat', purpose: 'reference_visual_analysis',
      payload: { model: 'glm-4.6v', messages, max_tokens: 3500, thinking: { type: 'disabled' } } });
    expect(JSON.parse(options.body)).not.toHaveProperty('apiKey');
  });

  it.each([401, 429, 503])('propaga erro HTTP%s sem nova tentativa paga', async status => {
    const fetchImpl = vi.fn(async () => response(status, { error: { code: 'text_quota_exhausted', message: 'Limite de texto atingido.' } }));
    await expect(requestReferenceVisualCompletion(messages, { fetchImpl })).rejects.toMatchObject({ status, code: 'text_quota_exhausted' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejeita saída truncada em vez de aceitar uma direção parcial', async () => {
    const fetchImpl = vi.fn(async () => response(200, { choices: [{ message: { content: JSON.stringify(analysis) }, finish_reason: 'length' }] }));
    await expect(requestReferenceVisualCompletion(messages, { fetchImpl })).rejects.toMatchObject({ code: 'reference_visual_incomplete' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
