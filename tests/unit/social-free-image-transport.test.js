import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateDALLEWithRetry, setAIRuntimeSettings } from '../../src/utils/ai-client.js';
import { composeImageDirection } from '../../src/utils/image-direction.js';
import { composeDeckArtImageDirection } from '../../src/utils/deck-art.js';
import { presentationSceneQuery } from '../../src/utils/presentation-plan.js';

const reference = 'data:image/png;base64,YQ==';
const scene = { subject: 'An adult ceramic artist', action: 'Shaping clay', setting: 'Quiet workshop', shot: 'medium shot' };
const visualDirection = {
  palette: [{ role: 'base', hex: '#173E68' }, { role: 'subject_light', hex: '#F6EFE0' }, { role: 'graphic', hex: '#D3A45B' }],
  finish: 'Smooth matte colour.', atmosphere: 'Quiet workshop.', graphics: 'none', avoid: 'Crowds and lettering.',
};
const slide = {
  id: 'card-1', socialPresetId: 'social_free',
  socialFreeDesign: { family: 'editorial', ground: 'photo', photo: 'full', block: 'none' },
  socialDeckDesign: { palette: { bg: '#173E68', ink: '#F6EFE0', accent: '#D3A45B', accent2: '#75BED0' } },
  socialPlan: { scene, avoid: ['Festival crowds'], visualDirection },
  titleColor: '#F6EFE0',
  canvas: { zones: { photo: { x: 0, y: 0, w: 100, h: 100 }, title: { x: 8, y: 14, w: 48, h: 20 } } },
};
const styleKit = { refImages: [{ id: 'style', dataUrl: reference }] };

afterEach(() => { vi.unstubAllGlobals(); setAIRuntimeSettings({}); });

async function sentPrompt(imageDirection, query, aspectRatio) {
  setAIRuntimeSettings({ useOwnImageKey: false });
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ b64_json: 'result' }) });
  vi.stubGlobal('fetch', fetchMock);
  await generateDALLEWithRetry(query, '', null, { imageDirection, aspectRatio, refImages: [reference] }, { retries: 0 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/ai/sjinn-image');
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.imageList).toEqual([reference]);
  return body;
}

describe('Livre social no transporte real de imagem', () => {
  it.each([['carrossel', '4:5', '1080 × 1350'], ['quadrado', '1:1', '1080 × 1080'], ['stories', '9:16', '1080 × 1920']])('leva composição e referência visual ao HTTP no formato %s', async (fmt, ratio, dimensions) => {
    const direction = composeImageDirection({ slide, fmt, styleKit, baseReferenceCount: 1 });
    const body = await sentPrompt(direction, presentationSceneQuery(scene), ratio);
    expect(body.prompt).toContain('COMPOSITION');
    expect(body.prompt).toContain(dimensions);
    expect(body.prompt).toContain('VISUAL DIRECTION');
    expect(body.prompt).toContain('SUBJECT AND CASTING');
    expect(body.prompt).toContain('never for people, objects, framing or composition');
    expect(body.prompt).not.toContain('medium, palette, lighting and composition.');
    expect(body.prompt).not.toContain('16:9');
    expect(body.prompt.length).toBeLessThanOrEqual(4000);
  });

  it('leva a arte compartilhada sem grafismos pelo mesmo transporte', async () => {
    const artSlide = { ...slide, socialFreeDesign: { ...slide.socialFreeDesign, ground: 'art', photo: 'none' } };
    const direction = composeDeckArtImageDirection({ slides: [artSlide], styleKit, fmt: 'quadrado', baseReferenceCount: 1 });
    const body = await sentPrompt(direction, direction.sceneBrief.query, '1:1');
    expect(body.prompt).toContain('COMPOSITION');
    expect(body.prompt).toContain('1080 × 1080');
    expect(body.prompt).toContain('#173E68');
    expect(body.prompt).toContain('No graphic intervention');
    expect(body.prompt).not.toContain('use editorial photography');
    expect(body.prompt).not.toContain('16:9');
  });

  it('flag ausente ou falsa mantém o pedido de catálogo byte a byte', async () => {
    const legacy = { format: 'carousel', styleBody: 'Editorial photograph with natural light.', referenceCount: 1 };
    const absent = await sentPrompt(legacy, 'Quiet workshop', '4:5');
    const disabled = await sentPrompt({ ...legacy, socialFree: false }, 'Quiet workshop', '4:5');
    expect(disabled.prompt).toBe(absent.prompt);
    expect(absent.prompt).toContain('medium, palette, lighting and composition.');
    expect(absent.prompt).not.toContain('COMPOSITION');
  });
});
