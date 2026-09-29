import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';
vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));
vi.mock('@vercel/blob', () => ({ put: vi.fn(), del: vi.fn(), list: vi.fn(), issueSignedToken: vi.fn(), presignUrl: vi.fn() }));
vi.mock('../../api/lib/sjinn.js', () => ({
  isSjinnConfigured: () => true, SJINN_DEADLINE_MS: 240000,
  createGptImage2Task: vi.fn(), waitForSjinnTask: vi.fn(), extractSjinnOutputUrl: () => 'https://example.com/result.png', downloadImageAsBase64: vi.fn(),
}));
import { put, del, list, issueSignedToken, presignUrl } from '@vercel/blob';
import { createGptImage2Task, waitForSjinnTask, downloadImageAsBase64 } from '../../api/lib/sjinn.js';
import { parseImageReferences, stageImageReferences, cleanupStaleImageReferences, REFERENCE_PREFIX, REFERENCE_URL_TTL_MS } from '../../api/lib/image-references.js';
import { MAX_REFERENCE_BYTES } from '../../shared/image-references.js';
import handler from '../../api/ai/sjinn-image.js';
import cleanupHandler from '../../api/cron/cleanup-image-references.js';
import middleware from '../../middleware.js';
import { makeReq, makeRes } from '../helpers/http.js';
import { createAccessToken, COOKIE_NAME } from '../../api/lib/access.js';
import { consumeImageCredit, resetMemoryQuotas } from '../../api/lib/image-quota.js';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

beforeEach(() => {
  vi.resetAllMocks(); resetStripeMock(); resetMemoryQuotas();
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test_fake');
  vi.stubEnv('BLOB_STORE_ID', ''); vi.stubEnv('VERCEL_OIDC_TOKEN', '');
  stripeMock.subscriptions.list.mockResolvedValue({ data: [{ ...subAtiva('cus_ref'), metadata: { tier: 'creator' } }] });
  put.mockImplementation(async pathname => ({ pathname }));
  del.mockResolvedValue();
  issueSignedToken.mockResolvedValue({ delegationToken: 'fake', clientSigningToken: 'fake-secret' });
  presignUrl.mockImplementation(async (_, { pathname }) => ({ presignedUrl: `https://store.private.blob.vercel-storage.com/${pathname}?signed=fake` }));
  createGptImage2Task.mockResolvedValue('task_ref'); waitForSjinnTask.mockResolvedValue({});
  downloadImageAsBase64.mockResolvedValue({ b64_json: 'fake-image', mime: 'image/png' });
});
afterEach(() => vi.unstubAllEnvs());

async function generate(imageList, { signedIn = true } = {}) {
  const res = makeRes();
  await handler(makeReq({ method: 'POST', headers: { origin: 'https://viralcarrossel.com.br' },
    cookie: signedIn ? `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId: 'cus_ref', email: 'x@teste.exemplo' }))}` : null,
    body: { prompt: 'Mundo 3D expressivo de referência', imageList },
  }), res);
  return res;
}

it('quatro anexos viram links privados de GET e são apagados depois do resultado; debita uma imagem', async () => {
  const started = Date.now();
  const res = await generate(Array(4).fill(PNG));
  expect(res.statusCode).toBe(200); expect(res.body.quota.used).toBe(1);
  expect(put).toHaveBeenCalledTimes(4);
  expect(new Set(put.mock.calls.map(([path]) => path)).size).toBe(4);
  for (const [path, bytes, opts] of put.mock.calls) {
    expect(path).toMatch(/^image-references\/temporary\//);
    expect(bytes.equals(Buffer.from(PNG.split(',')[1], 'base64'))).toBe(true);
    expect(opts).toMatchObject({ access: 'private', contentType: 'image/png', addRandomSuffix: false, allowOverwrite: false });
  }
  const args = createGptImage2Task.mock.calls[0][0];
  expect(args.imageList).toEqual(put.mock.calls.map(([path]) => `https://store.private.blob.vercel-storage.com/${path}?signed=fake`));
  expect(issueSignedToken.mock.calls[0][0]).toMatchObject({ pathname: put.mock.calls[0][0], operations: ['get'] });
  expect(issueSignedToken.mock.calls[0][0].validUntil).toBeGreaterThanOrEqual(started + REFERENCE_URL_TTL_MS);
  expect(issueSignedToken.mock.calls[0][0].validUntil).toBeLessThanOrEqual(Date.now() + REFERENCE_URL_TTL_MS);
  expect(del).toHaveBeenCalledWith(put.mock.calls.map(([path]) => path), expect.anything());
  expect(del.mock.invocationCallOrder[0]).toBeGreaterThan(downloadImageAsBase64.mock.invocationCallOrder[0]);
  expect(JSON.stringify(res.body)).not.toMatch(/signed=|fake-secret|vercel-storage/);
});

it('upload parcial espera os demais, limpa todas as cópias e devolve o crédito sem chamar SJinn', async () => {
  put.mockRejectedValueOnce(new Error('private token must not leak')).mockImplementation(async pathname => {
    await new Promise(resolve => setTimeout(resolve, 5)); return { pathname };
  });
  const res = await generate([PNG, PNG]);
  expect(res.statusCode).toBe(502); expect(res.body.code).toBe('reference_upload_failed');
  expect(res.body.quota.used).toBe(0);
  expect(createGptImage2Task).not.toHaveBeenCalled();
  expect(del.mock.calls[0][0]).toHaveLength(2);
  expect(JSON.stringify(res.body)).not.toContain('private token');
});

it('falha na geração limpa os anexos e reembolsa; falha na limpeza não perde o resultado', async () => {
  waitForSjinnTask.mockRejectedValueOnce(Object.assign(new Error('Tempo esgotado'), { code: 'sjinn_timeout' }));
  const failed = await generate([PNG]);
  expect(failed.statusCode).toBe(502); expect(failed.body.quota.used).toBe(0); expect(del).toHaveBeenCalledTimes(1);
  del.mockRejectedValueOnce(new Error('storage temporarily down'));
  const ok = await generate([PNG]);
  expect(ok.statusCode).toBe(200); expect(ok.body.b64_json).toBe('fake-image');
});

it('sem autenticação ou plano sem imagens não faz upload', async () => {
  expect((await generate([PNG], { signedIn: false })).statusCode).toBe(401);
  stripeMock.subscriptions.list.mockResolvedValue({ data: [{ ...subAtiva('cus_ref'), metadata: { tier: 'essential' } }] });
  expect((await generate([PNG])).body.code).toBe('plan_no_images');
  expect(put).not.toHaveBeenCalled();
});

it('quota esgotada não inicia upload nem tarefa paga', async () => {
  const periodStartSec = 1000;
  stripeMock.subscriptions.list.mockResolvedValue({ data: [{ ...subAtiva('cus_ref'), current_period_start: periodStartSec, metadata: { tier: 'creator' } }] });
  for (let i = 0; i < 50; i++) await consumeImageCredit({ customerId: 'cus_ref', periodStartSec, limit: 50 });
  const res = await generate([PNG]);
  expect(res.body.code).toBe('quota_exhausted');
  expect(put).not.toHaveBeenCalled(); expect(createGptImage2Task).not.toHaveBeenCalled();
});

it('tempo de upload reduz o orçamento de polling sem ultrapassar a função', async () => {
  const now = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
  try {
    put.mockImplementation(async pathname => { clock.mockReturnValue(now + 18000); return { pathname }; });
    expect((await generate([PNG])).statusCode).toBe(200);
    expect(waitForSjinnTask.mock.calls[0][1].deadlineMs).toBe(222000);
  } finally { clock.mockRestore(); }
});

it('sem armazenamento não cobra e HTTPS continua funcionando sem Blob', async () => {
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
  const failed = await generate([PNG]);
  expect(failed.statusCode).toBe(503); expect(failed.body.code).toBe('reference_storage_unconfigured');
  const ok = await generate(['https://example.com/ref.png']);
  expect(ok.statusCode).toBe(200); expect(ok.body.quota.used).toBe(1);
  expect(put).not.toHaveBeenCalled(); expect(del).not.toHaveBeenCalled();
});

it('valida limite, base64, MIME e assinatura antes do upload', () => {
  for (const refs of [[...Array(5).fill(PNG)], ['data:image/svg+xml;base64,PHN2Zz4='], ['data:image/png;base64,YQ=='], [PNG.replace('image/png', 'image/jpeg')], ['http://example.com/ref.png'], ['https://secret:password@example.com/ref.png'], [42], {}]) {
    expect(() => parseImageReferences(refs)).toThrow();
  }
  expect(() => parseImageReferences([`data:image/png;base64,${Buffer.alloc(MAX_REFERENCE_BYTES + 1).toString('base64')}`])).toThrow();
  expect(put).not.toHaveBeenCalled();
});

it('preserva ordem entre referência HTTPS e arquivo local sem apagar arquivo externo', async () => {
  const staged = await stageImageReferences(parseImageReferences(['https://example.com/ref.png', PNG]));
  expect(staged.imageList[0]).toBe('https://example.com/ref.png');
  await staged.cleanup();
  expect(del.mock.calls[0][0]).toEqual([put.mock.calls[0][0]]);
});

it('limpeza diária remove só órfãos antigos do prefixo e percorre páginas', async () => {
  const now = Date.now();
  list.mockResolvedValueOnce({ blobs: [
    { pathname: `${REFERENCE_PREFIX}old.png`, uploadedAt: new Date(now - 7200000) },
    { pathname: `${REFERENCE_PREFIX}active.png`, uploadedAt: new Date(now - 60000) },
    { pathname: 'other-project/file.png', uploadedAt: new Date(0) },
  ], hasMore: true, cursor: 'next' }).mockResolvedValueOnce({ blobs: [{ pathname: `${REFERENCE_PREFIX}older.png`, uploadedAt: new Date(0) }], hasMore: false });
  expect(await cleanupStaleImageReferences({ now })).toEqual({ deleted: 2, hasMore: false });
  expect(del.mock.calls.flatMap(([paths]) => paths)).toEqual([`${REFERENCE_PREFIX}old.png`, `${REFERENCE_PREFIX}older.png`]);
  expect(list.mock.calls[1][0]).toMatchObject({ cursor: 'next', prefix: REFERENCE_PREFIX });
});

it('limpeza agendada exige segredo próprio; não aceita cookie de usuário', async () => {
  vi.stubEnv('CRON_SECRET', 'test-cron-secret');
  const unauthorized = makeRes();
  await cleanupHandler(makeReq({ method: 'GET' }), unauthorized);
  expect(unauthorized.statusCode).toBe(401); expect(list).not.toHaveBeenCalled();
  list.mockResolvedValue({ blobs: [], hasMore: false });
  const authorized = makeRes();
  await cleanupHandler(makeReq({ method: 'GET', headers: { authorization: 'Bearer test-cron-secret' } }), authorized);
  expect(authorized.statusCode).toBe(200);
});

it('o domínio técnico deixa o cron chegar à autenticação sem redirecionar o restante do app', () => {
  const request = path => new Request(`https://deployment.vercel.app${path}`, { headers: { host: 'deployment.vercel.app' } });
  expect(middleware(request('/api/cron/cleanup-image-references'))).toBeUndefined();
  const page = middleware(request('/?app=1'));
  expect(page.status).toBe(308);
  expect(page.headers.get('location')).toBe('https://viralcarrossel.com.br/?app=1');
});
