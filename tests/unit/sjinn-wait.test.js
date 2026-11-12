/** Auditoria 11/11, achado 4: a espera do SJinn precisa obedecer ao prazo
 *  declarado (SJINN_DEADLINE_MS) e não cair por um erro passageiro de consulta. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../urlSourceFetch.js', () => ({ assertPublicHttpUrl: (url) => url }));

import { waitForSjinnTask, SJINN_DEADLINE_MS } from '../../api/lib/sjinn.js';

const status = (data) => ({ status: 200, json: async () => ({ success: true, data }) });
const pending = () => status({ status: 0 });
const done = () => status({ status: 1, output_urls: ['https://cdn.example/final.png'] });

/** Simula uma tarefa que fica pronta `readyAtMs` depois do começo da espera. */
function taskReadyAt(readyAtMs) {
  const startedAt = Date.now();
  return vi.fn(async () => (Date.now() - startedAt >= readyAtMs ? done() : pending()));
}

function settle(promise) {
  return promise.then((value) => ({ value }), (error) => ({ error }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('SJINN_API_KEY', 'sjinn-fake-key-123');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('waitForSjinnTask: prazo e tolerância', () => {
  it('tarefa pronta aos 200 s devolve a imagem (antes morria perto de 145 s)', async () => {
    const fetchMock = taskReadyAt(200_000);
    vi.stubGlobal('fetch', fetchMock);
    const outcome = settle(waitForSjinnTask('task_lenta'));
    await vi.advanceTimersByTimeAsync(205_000);
    const result = await outcome;
    expect(result.error).toBeUndefined();
    expect(result.value.output_urls[0]).toBe('https://cdn.example/final.png');
    expect(fetchMock).toHaveBeenCalledTimes(41);
  });

  it('tarefa que nunca termina encerra no prazo com sjinn_timeout, nem antes nem muito depois', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => pending()));
    const startedAt = Date.now();
    let finishedAt = null;
    const outcome = settle(waitForSjinnTask('task_eterna')).then((r) => { finishedAt = Date.now(); return r; });
    await vi.advanceTimersByTimeAsync(SJINN_DEADLINE_MS - 10_000);
    expect(finishedAt).toBeNull();
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await outcome;
    expect(result.error.code).toBe('sjinn_timeout');
    expect(finishedAt - startedAt).toBeGreaterThanOrEqual(SJINN_DEADLINE_MS);
    expect(finishedAt - startedAt).toBeLessThanOrEqual(SJINN_DEADLINE_MS + 5_000);
  });

  it('um erro de consulta no meio não derruba a geração', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(pending())
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(pending())
      .mockRejectedValueOnce(Object.assign(new Error('timeout'), { name: 'TimeoutError' }))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValue(done());
    vi.stubGlobal('fetch', fetchMock);
    const outcome = settle(waitForSjinnTask('task_instavel'));
    await vi.advanceTimersByTimeAsync(30_000);
    const result = await outcome;
    expect(result.error).toBeUndefined();
    expect(result.value.status).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('três erros de consulta seguidos desistem com o erro original', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(pending())
      .mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);
    const outcome = settle(waitForSjinnTask('task_fora_do_ar'));
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await outcome;
    expect(result.error).toBeInstanceOf(TypeError);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('falha declarada pelo SJinn continua saindo na hora, sem nova tentativa', async () => {
    const fetchMock = vi.fn(async () => status({ status: -1, error: 'conteúdo recusado' }));
    vi.stubGlobal('fetch', fetchMock);
    const outcome = settle(waitForSjinnTask('task_recusada'));
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await outcome;
    expect(result.error.code).toBe('sjinn_failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sem chave configurada falha na hora, sem gastar as tentativas', async () => {
    vi.stubEnv('SJINN_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const outcome = settle(waitForSjinnTask('task_sem_chave'));
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await outcome;
    expect(result.error.message).toMatch(/SJINN_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
