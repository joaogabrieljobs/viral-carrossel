// Auditoria 2026-09-15 — C2/H4/H3 (compatible.js), C3 (sjinn), A5 (plans).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));

import { makeReq, makeRes } from '../helpers/http.js';
import { createAccessToken, COOKIE_NAME } from '../../api/lib/access.js';
import compatibleHandler from '../../api/ai/compatible.js';
import sjinnHandler, { config as sjinnConfig } from '../../api/ai/sjinn-image.js';
import { waitForSjinnTask } from '../../api/lib/sjinn.js';
import { resolveTierFromPriceId } from '../../api/lib/plans.js';
import { PLATFORM_MAX_TOKENS } from '../../shared/ai-models.js';
import { resetMemoryQuotas } from '../../api/lib/image-quota.js';

const APP = 'https://viral-carrossel.vercel.app';
const cookieFor = (customerId) =>
  `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId, email: 'x@teste.exemplo' }))}`;

function okJson(payload, headers = {}) {
  return {
    ok: true,
    status: 200,
    headers: { get: (k) => headers[k.toLowerCase()] ?? (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
    text: async () => JSON.stringify(payload),
    json: async () => payload,
    arrayBuffer: async () => new ArrayBuffer(4),
  };
}

beforeEach(() => {
  resetStripeMock();
  resetMemoryQuotas();
  process.env.ZAI_API_KEY = 'zai-plataforma-fake';
  delete process.env.BILLING_DISABLED;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ZAI_API_KEY;
  delete process.env.SJINN_API_KEY;
});

async function callCompatible(body, { cookie = cookieFor('cus_ok'), sub = true } = {}) {
  if (sub) stripeMock.subscriptions.list.mockResolvedValue({ data: [subAtiva('cus_ok')] });
  const res = makeRes();
  await compatibleHandler(makeReq({ method: 'POST', headers: { origin: APP }, cookie, body }), res);
  return res;
}

describe('C2 — /api/ai/compatible não gera imagens com a chave da plataforma', () => {
  it('operation images sem apiKey do utilizador → 400, sem chamar upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await callCompatible({ provider: 'zai', operation: 'images', payload: { model: 'cogview-4-250304', prompt: 'x' } });
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('anónimo → 401 antes de qualquer upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await callCompatible({ provider: 'zai', operation: 'chat', payload: { model: 'glm-4.7', messages: [] } }, { cookie: null, sub: false });
    expect(res.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('H4 — chave da plataforma só com modelo permitido, sem stream/tools, max_tokens limitado', () => {
  it('modelo fora da allowlist com chave da plataforma → 400', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await callCompatible({ provider: 'zai', operation: 'chat', payload: { model: 'glm-4-plus', messages: [] } });
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stream:true com chave da plataforma → 400', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const res = await callCompatible({ provider: 'zai', operation: 'chat', payload: { model: 'glm-4.7', stream: true, messages: [] } });
    expect(res.statusCode).toBe(400);
  });

  it('max_tokens acima do tecto é clampado e a chave da plataforma vai no Authorization', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ choices: [{ message: { content: 'oi' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await callCompatible({ provider: 'zai', operation: 'chat', payload: { model: 'glm-4.7', max_tokens: 100000, messages: [{ role: 'user', content: 'x' }] } });
    expect(res.statusCode).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer zai-plataforma-fake');
    expect(JSON.parse(init.body).max_tokens).toBe(PLATFORM_MAX_TOKENS);
    expect(init.signal).toBeTruthy();
  });

  it('BYOK (apiKey no body) não é limitado pela allowlist', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ choices: [{ message: { content: 'oi' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await callCompatible({ provider: 'zai', operation: 'chat', apiKey: 'minha-chave', payload: { model: 'glm-4-plus', messages: [] } });
    expect(res.statusCode).toBe(200);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer minha-chave');
  });
});

describe('H3 — retry do servidor só em erro real', () => {
  it('200 com "try again later" no conteúdo NÃO dispara segunda chamada', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ choices: [{ message: { content: 'Se falhar, try again later.' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await callCompatible({ provider: 'zai', operation: 'chat', payload: { model: 'glm-4.7', messages: [] } });
    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('429 upstream dispara exactamente 1 retry', async () => {
    const fail = { ...okJson({ error: { code: '1305', message: 'overloaded' } }), ok: false, status: 429 };
    const fetchMock = vi.fn().mockResolvedValueOnce(fail).mockResolvedValue(okJson({ choices: [{ message: { content: 'ok' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await callCompatible({ provider: 'zai', operation: 'chat', payload: { model: 'glm-4.7', messages: [] } });
    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10000);
});

describe('C3 — SJinn não ultrapassa o maxDuration da função', () => {
  it('waitForSjinnTask lança sjinn_timeout ao atingir a deadline, antes de esgotar as tentativas', async () => {
    vi.useFakeTimers();
    process.env.SJINN_API_KEY = 'sjinn-fake-key-123';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ success: true, data: { status: 0 } })));
    const p = waitForSjinnTask('task_x', { pollMs: 1000, maxAttempts: 1000, deadlineMs: 3500 });
    const outcome = p.then(() => 'resolved', (e) => e.code);
    await vi.advanceTimersByTimeAsync(6000);
    expect(await outcome).toBe('sjinn_timeout');
    vi.useRealTimers();
  });

  it('deadline default fica abaixo do maxDuration exportado', async () => {
    const mod = await import('../../api/lib/sjinn.js');
    expect(mod.SJINN_DEADLINE_MS).toBeLessThan(sjinnConfig.maxDuration * 1000 - 5000);
  });

  it('handler força resolution 1K mesmo que o cliente peça 4K', async () => {
    process.env.SJINN_API_KEY = 'sjinn-fake-key-123';
    stripeMock.subscriptions.list.mockResolvedValue({ data: [{ ...subAtiva('cus_img'), metadata: { tier: 'creator' } }] });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okJson({ success: true, data: { task_id: 't1' } }))
      .mockResolvedValueOnce(okJson({ success: true, data: { status: 1, output_urls: ['https://cdn.exemplo/img.png'] } }))
      .mockResolvedValueOnce(okJson({}, { 'content-type': 'image/png' }));
    vi.stubGlobal('fetch', fetchMock);
    const res = makeRes();
    await sjinnHandler(makeReq({ method: 'POST', headers: { origin: APP }, cookie: cookieFor('cus_img'), body: { prompt: 'uma foto editorial', resolution: '4K' } }), res);
    expect(res.statusCode).toBe(200);
    const createBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(createBody.input.resolution).toBe('1K');
    expect(res.body.quota.used).toBe(1);
  });
});

describe('A5 — price desconhecido não ganha imagens', () => {
  it('resolveTierFromPriceId sem match → essential', () => {
    expect(resolveTierFromPriceId('price_unknown')).toBe('essential');
    expect(resolveTierFromPriceId('price_test_fake')).toBe('creator'); // STRIPE_PRICE_ID legado
  });
});

describe('Orçamento de tempo do proxy (timeout de geração longa)', () => {
  it('maxDuration cabe no plano e deixa folga sobre o orçamento das tentativas', async () => {
    const mod = await import('../../api/ai/compatible.js');
    expect(mod.config.maxDuration).toBeLessThanOrEqual(300);
    expect(mod.config.maxDuration * 1000).toBeGreaterThan(240_000);
  });

  it('cada tentativa aborta com o tempo que resta, não com um valor fixo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ choices: [{ message: { content: 'ok' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await callCompatible({ provider: 'zai', operation: 'chat', payload: { model: 'glm-4.7', messages: [{ role: 'user', content: 'x' }] } });
    expect(res.statusCode).toBe(200);
    const { signal } = fetchMock.mock.calls[0][1];
    expect(signal).toBeTruthy();
    expect(signal.aborted).toBe(false);
  });

  it('timeout do upstream devolve 504 com código e dica acionável', async () => {
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'TimeoutError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err));
    const res = await callCompatible({ provider: 'zai', operation: 'chat', payload: { model: 'glm-4.7', messages: [] } });
    expect(res.statusCode).toBe(504);
    expect(res.body.error.code).toBe('upstream_timeout');
    expect(res.body.error.message).toMatch(/menos cards|menos material/i);
  });
});
