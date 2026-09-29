import { afterEach, describe, expect, it, vi } from 'vitest';
import { startAIJob, runAIJob, cancelAllAIGeneration, getAIGenerationCount, subscribeAIGeneration } from '../../src/utils/generation-control.js';
import { callAI, callAIwithSearch, generateDALLEWithRetry, setAIRuntimeSettings } from '../../src/utils/ai-client.js';
import { generateReviewedCarousel } from '../../src/utils/editorial-review.js';

afterEach(() => { cancelAllAIGeneration(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('cancelamento global', () => {
  it('cancela trabalhos simultâneos, descarta resultado tardio e permite novo trabalho', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAIGeneration(listener);
    let late;
    const old = runAIJob(() => new Promise(resolve => { late = resolve; }));
    const rejected = expect(old).rejects.toMatchObject({ code: 'generation_cancelled' });
    const parent = startAIJob();
    const nested = runAIJob(() => new Promise(() => {}), parent.signal);
    const nestedRejected = expect(nested).rejects.toMatchObject({ code: 'generation_cancelled' });
    await Promise.resolve();
    expect(getAIGenerationCount()).toBe(3);
    cancelAllAIGeneration();
    await Promise.all([rejected, nestedRejected]);
    late('resultado que não deve ser aplicado');
    await expect(runAIJob(async () => 'nova geração')).resolves.toBe('nova geração');
    expect(getAIGenerationCount()).toBe(0);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it.each(['zai', 'openai', 'anthropic', 'kimi'])('interrompe transporte de texto %s sem fallback', async provider => {
    setAIRuntimeSettings({ textProvider: provider, keys: { [provider]: 'synthetic-test-key' } });
    let requestSignal;
    const fetchMock = vi.fn((_, options) => { requestSignal = options.signal; return new Promise(() => {}); });
    vi.stubGlobal('fetch', fetchMock);
    const result = callAI('brief');
    const assertion = expect(result).rejects.toMatchObject({ code: 'generation_cancelled' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    cancelAllAIGeneration();
    await assertion;
    expect(requestSignal.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('pesquisa web também participa do comando global', async () => {
    setAIRuntimeSettings({ keys: { anthropic: 'synthetic-test-key' } });
    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const result = callAIwithSearch('pesquisa');
    const assertion = expect(result).rejects.toMatchObject({ code: 'generation_cancelled' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    cancelAllAIGeneration();
    await assertion;
  });

  it('cancela imagem em voo sem nova tentativa', async () => {
    setAIRuntimeSettings({ useOwnImageKey: false });
    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const result = generateDALLEWithRetry('a scene', '', null);
    const assertion = expect(result).rejects.toMatchObject({ code: 'generation_cancelled' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    cancelAllAIGeneration();
    await assertion;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('cancela durante espera de retry sem disparar outro pedido', async () => {
    vi.useFakeTimers();
    setAIRuntimeSettings({ useOwnImageKey: false });
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    const result = generateDALLEWithRetry('a scene', '');
    const assertion = expect(result).rejects.toMatchObject({ code: 'generation_cancelled' });
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    cancelAllAIGeneration();
    await assertion;
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('cancelar a revisão não publica o rascunho como revisão indisponível', async () => {
    const parent = startAIJob();
    const ai = vi.fn().mockResolvedValueOnce({ slides: [{ title: 'Rascunho', subtitle: '', imageQuery: '' }], caption: '' })
      .mockImplementationOnce(() => runAIJob(() => new Promise(() => {}), parent.signal));
    const result = generateReviewedCarousel({ prompt: '', config: { count: 1, presetId: 'livre', densityId: '1_5' }, aiOptions: { signal: parent.signal } }, ai);
    const assertion = expect(result).rejects.toMatchObject({ code: 'generation_cancelled' });
    await vi.waitFor(() => expect(ai).toHaveBeenCalledTimes(2));
    cancelAllAIGeneration();
    await assertion;
  });
});
