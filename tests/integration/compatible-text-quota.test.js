// MOO-11 (auditoria 20/11): o proxy de texto incluso passa a contar pedidos por
// conta quando a biblioteca usa Postgres; chave própria não conta.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));
const textQuota = vi.hoisted(() => ({ consume: vi.fn() }));
vi.mock('../../api/lib/text-quota.js', () => ({ consumeTextCredit: textQuota.consume, textDailyLimit: () => 800 }));

import { makeReq, makeRes } from '../helpers/http.js';
import { createAccessToken, COOKIE_NAME } from '../../api/lib/access.js';
import compatibleHandler from '../../api/ai/compatible.js';

const cookie = `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId: 'cus_ok', email: 'x@teste.exemplo' }))}`;
const body = (extra = {}) => ({ provider: 'zai', operation: 'chat', payload: { model: 'glm-4.7', messages: [{ role: 'user', content: 'oi' }] }, ...extra });
async function call(b) {
  stripeMock.subscriptions.list.mockResolvedValue({ data: [subAtiva('cus_ok')] });
  const res = makeRes();
  await compatibleHandler(makeReq({ method: 'POST', headers: { origin: 'https://moont.ai', 'x-real-ip': '10.1.1.1' }, cookie, body: b }), res);
  return res;
}

beforeEach(() => {
  resetStripeMock();
  process.env.ZAI_API_KEY = 'zai-plataforma-fake';
  vi.stubEnv('LIBRARY_SYNC_BACKEND', 'postgres');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' },
    text: async () => JSON.stringify({ choices: [{ message: { content: 'ok' } }] }) })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); delete process.env.ZAI_API_KEY; textQuota.consume.mockReset(); });

describe('MOO-11 — texto incluso com cota por conta', () => {
  it('cota esgotada responde 429 sem chamar o provedor', async () => {
    textQuota.consume.mockResolvedValue({ allowed: false, used: 800, limit: 800 });
    const res = await call(body());
    expect(res.statusCode).toBe(429);
    expect(res.body.error.message).toMatch(/limite diário/);
    expect(fetch).not.toHaveBeenCalled();
    expect(textQuota.consume).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'cus_ok' }));
  });

  it('com saldo, segue para o provedor', async () => {
    textQuota.consume.mockResolvedValue({ allowed: true, used: 1, limit: 800 });
    expect((await call(body())).statusCode).toBe(200);
  });

  it('chave própria não consome a cota do plano', async () => {
    await call(body({ apiKey: 'chave-do-usuario' }));
    expect(textQuota.consume).not.toHaveBeenCalled();
  });

  it('falha do banco não derruba a geração', async () => {
    textQuota.consume.mockRejectedValue(new Error('db offline'));
    expect((await call(body())).statusCode).toBe(200);
  });
});
