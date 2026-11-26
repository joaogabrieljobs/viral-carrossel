import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateDALLEWithRetry, setAIRuntimeSettings } from '../../src/utils/ai-client.js';

afterEach(() => { vi.unstubAllGlobals(); setAIRuntimeSettings({}); });

describe('Núcleo dirigido impossível de acomodar', () => {
  it.each(['sjinn', 'openai', 'zai'])('interrompe %s antes de fetch e não tenta novamente com uma cena incompleta', async route => {
    setAIRuntimeSettings({ useOwnImageKey: route !== 'sjinn', imageProvider: route === 'zai' ? 'zai' : 'openai', keys: { openai: 'test-fake', zai: 'test-fake' } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ b64_json: 'result', data: [{ b64_json: 'result' }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const query = 'A ceramic artist';
    const light = 'Indispensable precise lighting detail. '.repeat(1000);
    const direction = { format: 'carousel', socialFree: true,
      sceneBrief: { query, subject: query, light },
      directedPrompt: { version: 2, kind: 'social_free', scene: { subject: query, light },
        visual: { palette: [{ role: 'base', hex: '#17364B' }], graphics: 'none' }, variation: [], references: [] } };
    await expect(generateDALLEWithRetry(query, 'test-fake', null, { imageDirection: direction }, { retries: 2, backoffMs: 1 }))
      .rejects.toMatchObject({ code: 'prompt_core_too_long' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
