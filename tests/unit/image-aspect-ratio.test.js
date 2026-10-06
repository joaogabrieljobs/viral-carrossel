import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildGptImageFullPrompt,
  generateDALLE,
  generateZaiImage,
  normalizeImageAspectRatio,
  resolveOpenAIImageSize,
  resolveSjinnAspectRatio,
  resolveZaiImageSize,
  setAIRuntimeSettings,
} from '../../src/utils/ai-client.js';

afterEach(() => {
  vi.unstubAllGlobals();
  setAIRuntimeSettings({});
});

describe('proporção da geração de imagens', () => {
  it('mantém 16:9 no plano e converte apenas o 4:5 não suportado para 2:3', () => {
    expect(normalizeImageAspectRatio('16:9')).toBe('16:9');
    expect(normalizeImageAspectRatio('desconhecida')).toBe('4:5');
    expect(resolveSjinnAspectRatio('16:9')).toBe('16:9');
    expect(resolveSjinnAspectRatio('4:5')).toBe('2:3');
  });

  it('seleciona dimensões landscape adequadas para cada família OpenAI', () => {
    expect(resolveOpenAIImageSize({ name: 'gpt-image-2' }, '16:9')).toBe('1536x864');
    expect(resolveOpenAIImageSize({ name: 'gpt-image-1.5' }, '16:9')).toBe('1536x1024');
    expect(resolveOpenAIImageSize({ name: 'dall-e-3' }, '16:9')).toBe('1792x1024');
    expect(resolveOpenAIImageSize({ name: 'gpt-image-2' }, '9:16')).toBe('864x1536');
  });

  it('usa os tamanhos widescreen suportados pelo GLM Image e CogView', () => {
    expect(resolveZaiImageSize('glm-image', '16:9')).toBe('1728x960');
    expect(resolveZaiImageSize('cogview-4-250304', '16:9')).toBe('1344x768');
    expect(resolveZaiImageSize('glm-image', '3:2')).toBe('1568x1056');
  });

  it('mantém stories em proporção vertical 9:16 no provedor ZAI', () => {
    expect(resolveZaiImageSize('glm-image', '9:16')).toBe('960x1728');
    expect(resolveZaiImageSize('cogview-4-250304', '9:16')).toBe('768x1344');
  });

  it('orienta o prompt de apresentação para 16:9 sem impor fotografia a uma direção expressiva', () => {
    const wide = buildGptImageFullPrompt('crescimento trimestral', null, '', { aspectRatio: '16:9' });
    expect(wide).toMatch(/widescreen 16:9 presentation visual/i);

    const directed = buildGptImageFullPrompt(
      'crescimento trimestral',
      null,
      'Infográfico vetorial expressivo com formas geométricas',
      { aspectRatio: '16:9', withReference: true },
    );
    expect(directed).toMatch(/widescreen 16:9 presentation canvas/i);
    expect(directed).not.toMatch(/photorealistic real-photograph rendering/i);
  });

  it('envia 16:9 ao endpoint de imagens do plano', async () => {
    setAIRuntimeSettings({ useOwnImageKey: false });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ b64_json: 'resultado' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await generateDALLE('visual de apresentação', '', null, { aspectRatio: '16:9' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.aspectRatio).toBe('16:9');
    expect(body.prompt).toMatch(/widescreen 16:9/i);
  });

  it('envia dimensão 16:9 ao GPT Image 2 com chave própria', async () => {
    setAIRuntimeSettings({
      useOwnImageKey: true,
      imageProvider: 'openai',
      imageModels: { openai: 'gpt-image-2' },
      keys: { openai: 'test-fake' },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'resultado' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await generateDALLE('visual de apresentação', 'test-fake', null, { aspectRatio: '16:9' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-image-2');
    expect(body.size).toBe('1536x864');
  });

  it('envia dimensão widescreen ao GLM Image com chave própria', async () => {
    setAIRuntimeSettings({
      useOwnImageKey: true,
      imageProvider: 'zai',
      imageModels: { zai: 'glm-image' },
      keys: { zai: 'test-fake' },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ url: 'https://cdn.exemplo/slide.png' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await generateZaiImage('visual de apresentação', null, '', undefined, { aspectRatio: '16:9' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.provider).toBe('zai');
    expect(body.payload.size).toBe('1728x960');
  });
});
