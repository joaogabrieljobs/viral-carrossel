import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

const quota = vi.hoisted(() => ({
  getQuotaUsagePostgres: vi.fn(),
  consumeImageCreditPostgres: vi.fn(),
  settleImageCreditPostgres: vi.fn(),
  refundImageCreditPostgres: vi.fn(),
}));
const sjinn = vi.hoisted(() => ({
  createGptImage2Task: vi.fn(), waitForSjinnTask: vi.fn(),
  downloadImageAsBase64: vi.fn(),
}));
vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));
vi.mock('../../api/lib/image-quota-postgres.js', () => quota);
vi.mock('../../api/lib/sjinn.js', () => ({
  isSjinnConfigured: () => true,
  SJINN_DEADLINE_MS: 240_000,
  createGptImage2Task: sjinn.createGptImage2Task,
  waitForSjinnTask: sjinn.waitForSjinnTask,
  extractSjinnOutputUrl: () => 'https://example.com/generated.png',
  downloadImageAsBase64: sjinn.downloadImageAsBase64,
}));

import handler from '../../api/ai/sjinn-image.js';
import { createAccessToken, COOKIE_NAME } from '../../api/lib/access.js';
import { makeReq, makeRes } from '../helpers/http.js';

const customerId = 'cus_pg_img';
const periodStartSec = 1_790_000_000;
const periodEndSec = periodStartSec + 30 * 86400;

async function generate(operationId = 'stable-generation-1') {
  const response = makeRes();
  await handler(makeReq({
    method: 'POST',
    headers: { origin: 'https://viralcarrossel.com.br' },
    cookie: `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId, email: 'x@teste.exemplo' }))}`,
    body: { prompt: 'Imagem editorial para um card da clínica', operationId },
  }), response);
  return response;
}

beforeEach(() => {
  vi.resetAllMocks();
  resetStripeMock();
  vi.stubEnv('IMAGE_QUOTA_BACKEND', 'postgres');
  stripeMock.subscriptions.list.mockResolvedValue({ data: [{
    ...subAtiva(customerId),
    metadata: { tier: 'creator' },
    items: { data: [{ current_period_start: periodStartSec, current_period_end: periodEndSec }] },
  }] });
  quota.consumeImageCreditPostgres.mockResolvedValue({ allowed: true, used: 1, limit: 50, remaining: 49 });
  quota.getQuotaUsagePostgres.mockResolvedValue({ used: 0, limit: 50, remaining: 50, allowed: true });
  quota.settleImageCreditPostgres.mockResolvedValue({ used: 1, status: 'consumed' });
  quota.refundImageCreditPostgres.mockResolvedValue({ used: 0, refunded: true });
  sjinn.createGptImage2Task.mockResolvedValue('task-1');
  sjinn.waitForSjinnTask.mockResolvedValue({});
  sjinn.downloadImageAsBase64.mockResolvedValue({ b64_json: 'image', mime: 'image/png' });
});

afterEach(() => vi.unstubAllEnvs());

describe('geração com quota Postgres', () => {
  it('reserva e confirma uma vez usando o ID do cliente', async () => {
    const result = await generate();
    expect(result.statusCode).toBe(200);
    expect(result.body.operationId).toBe('stable-generation-1');
    expect(quota.consumeImageCreditPostgres).toHaveBeenCalledWith(expect.objectContaining({
      customerId, periodStartSec, periodEndSec, operationId: 'stable-generation-1', limit: 50,
    }));
    expect(quota.settleImageCreditPostgres).toHaveBeenCalledWith({
      customerId, periodStartSec, operationId: 'stable-generation-1',
    });
    expect(quota.refundImageCreditPostgres).not.toHaveBeenCalled();
  });

  it('uma repetição do mesmo ID não inicia outra tarefa paga nem acusa quota esgotada', async () => {
    quota.consumeImageCreditPostgres
      .mockResolvedValueOnce({ allowed: true, used: 1, limit: 50, remaining: 49 })
      .mockResolvedValueOnce({ allowed: false, used: 1, limit: 50, remaining: 49,
        replayed: true, reason: 'already_consumed' });
    expect((await generate()).statusCode).toBe(200);
    const repeat = await generate();
    expect(repeat.statusCode).toBe(409);
    expect(repeat.body.code).toBe('image_operation_replayed');
    expect(sjinn.createGptImage2Task).toHaveBeenCalledTimes(1);
    expect(quota.refundImageCreditPostgres).not.toHaveBeenCalled();
  });

  it('falha de geração reembolsa precisamente a reserva da tentativa', async () => {
    sjinn.waitForSjinnTask.mockRejectedValueOnce(Object.assign(new Error('Tempo esgotado'), { code: 'sjinn_timeout' }));
    const result = await generate('failed-generation-1');
    expect(result.statusCode).toBe(502);
    expect(quota.refundImageCreditPostgres).toHaveBeenCalledWith({
      customerId, periodStartSec, operationId: 'failed-generation-1',
    });
    expect(quota.settleImageCreditPostgres).not.toHaveBeenCalled();
  });
});
