import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  subscription: vi.fn(), usage: vi.fn(), consume: vi.fn(), refund: vi.fn(), settle: vi.fn(),
  create: vi.fn(), wait: vi.fn(), download: vi.fn(), put: vi.fn(), putChunk: vi.fn(),
  project: vi.fn(), job: vi.fn(), createJob: vi.fn(), finishJob: vi.fn(), expireJob: vi.fn(),
  waitUntil: vi.fn(),
}));
vi.mock('@vercel/functions', () => ({ waitUntil: mocked.waitUntil }));
vi.mock('../../api/lib/stripe.js', () => ({ findActiveSubscription: mocked.subscription }));
vi.mock('../../api/lib/plans.js', () => ({
  resolveTierFromSubscription: () => 'creator', imageQuotaForTier: () => 50,
  periodBoundsFromSubscription: () => ({ periodStartSec: 100, periodEndSec: 200 }),
}));
vi.mock('../../api/lib/image-quota.js', () => ({
  getQuotaUsage: mocked.usage, consumeImageCredit: mocked.consume,
  refundImageCredit: mocked.refund, settleImageCredit: mocked.settle,
}));
vi.mock('../../api/lib/sjinn.js', () => ({
  isSjinnConfigured: () => true, createGptImage2Task: mocked.create,
  waitForSjinnTask: mocked.wait, downloadImageAsBase64: mocked.download,
  extractSjinnOutputUrl: data => data?.url || null, SJINN_DEADLINE_MS: 240000,
}));
vi.mock('../../api/lib/library-sync-store.js', () => ({
  putLibraryAsset: mocked.put, putLibraryAssetChunk: mocked.putChunk, ASSET_CHUNK_CHARS: 40,
}));
vi.mock('../../api/lib/library-sync-postgres.js', () => ({ getAccountProject: mocked.project }));
vi.mock('../../api/lib/agent-visual-batch.js', async importOriginal => {
  const actual = await importOriginal();
  return {
    selectImageSlides: actual.selectImageSlides, isImageJobStale: actual.isImageJobStale,
    getAgentVisualJob: mocked.job, createAgentImageJob: mocked.createJob,
    finishAgentImageJob: mocked.finishJob, expireAgentImageJob: mocked.expireJob,
  };
});

import {
  startAgentImageJob, runAgentImageJob, getAgentChangeStatus, imageAspectRatio,
  imageOperationId, storeGeneratedAsset,
} from '../../api/lib/agent-image-generation.js';

const owner = 'cus_1';
const requestId = 'image-request-01';
const input = { projectId: 'p', baseVersion: 3, requestId };
const notFound = () => Object.assign(new Error('missing'), { code: 'visual_job_not_found' });
const op = slideId => imageOperationId(requestId, slideId);

function project() {
  return { id: 'p', version: 3, deleted: false, entry: { id: 'p', doc: { formatId: 'stories', slides: [
    { id: 's1', imageQuery: 'retrato editorial em luz natural' },
    { id: 's2', imageQuery: 'consultório moderno com plantas' },
    { id: 's3', imageQuery: 'já tem foto', bgImageAssetId: 'photo-3' },
  ] } } };
}

function pendingJob(slides = ['s1', 's2']) {
  return {
    job: { requestId, projectId: 'p', status: 'pending', kind: 'image', beforeVersion: 3, afterVersion: null,
      slides: slides.map(slideId => ({ slideId, status: 'pending' })), createdAt: new Date().toISOString() },
    slides: slides.map(slideId => ({ slideId, status: 'pending', operationId: op(slideId) })),
    meta: { kind: 'image', periodStartSec: 100 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.subscription.mockResolvedValue({ id: 'sub' });
  mocked.usage.mockResolvedValue({ used: 1, limit: 50, remaining: 49, allowed: true });
  mocked.consume.mockImplementation(async ({ operationId }) => ({ allowed: true, used: 2, limit: 50, remaining: 48, operationId }));
  mocked.refund.mockResolvedValue({ refunded: true });
  mocked.settle.mockResolvedValue({ status: 'consumed' });
  mocked.create.mockImplementation(async ({ prompt }) => `task-${prompt.length}`);
  mocked.wait.mockResolvedValue({ url: 'https://images.example/result.png' });
  mocked.download.mockResolvedValue({ b64_json: 'QUJD', mime: 'image/png' });
  mocked.put.mockResolvedValue({ assetId: 'ok' });
  mocked.putChunk.mockImplementation(async (_owner, assetId, body) => ({ assetId, complete: body.index === body.total - 1 }));
  mocked.job.mockRejectedValue(notFound());
  mocked.project.mockResolvedValue(project());
  mocked.createJob.mockResolvedValue({ ...pendingJob(), existing: false });
});

describe('startAgentImageJob', () => {
  it('reserva um crédito por card, registra o job pendente e agenda a geração', async () => {
    const schedule = vi.fn();
    mocked.finishJob.mockResolvedValue({ finished: true, job: { status: 'applied' }, slides: [] });
    const result = await startAgentImageJob(owner, 'token', input, { schedule });
    expect(mocked.consume).toHaveBeenCalledTimes(2);
    expect(mocked.consume.mock.calls.map(call => call[0].operationId)).toEqual([op('s1'), op('s2')]);
    expect(mocked.consume.mock.calls[0][0].operationId).toMatch(/^mcp_[a-f0-9]{56}$/);
    expect(mocked.createJob).toHaveBeenCalledWith(owner, 'token', expect.objectContaining({
      projectId: 'p', baseVersion: 3, requestId, slideIds: undefined,
      slides: [expect.objectContaining({ slideId: 's1', operationId: op('s1') }), expect.objectContaining({ slideId: 's2' })],
      meta: expect.objectContaining({ aspectRatio: '9:16', periodStartSec: 100, tier: 'creator' }),
    }));
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: 'pending', creditsReserved: 2, quota: { remaining: 48, tier: 'creator' } });
    expect(result.slides.map(slide => slide.status)).toEqual(['pending', 'pending']);
    expect(mocked.refund).not.toHaveBeenCalled();
    await schedule.mock.calls[0][0];
  });

  it('não gera nem cobra quando o projeto mudou, o card já tem foto ou falta imageQuery', async () => {
    const schedule = vi.fn();
    await expect(startAgentImageJob(owner, 'token', { ...input, baseVersion: 2 }, { schedule }))
      .rejects.toMatchObject({ code: 'project_conflict', cloudVersion: 3 });
    await expect(startAgentImageJob(owner, 'token', { ...input, slideIds: ['s3'] }, { schedule }))
      .rejects.toMatchObject({ code: 'image_already_present', slideIds: ['s3'] });
    const broken = project();
    broken.entry.doc.slides[0].imageQuery = '';
    mocked.project.mockResolvedValueOnce(broken);
    await expect(startAgentImageJob(owner, 'token', input, { schedule }))
      .rejects.toMatchObject({ code: 'image_query_missing', slideIds: ['s1'] });
    expect(mocked.consume).not.toHaveBeenCalled();
    expect(mocked.createJob).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
  });

  it('recusa sem cobrar quando o saldo não cobre o job e devolve o que reservou numa corrida', async () => {
    const schedule = vi.fn();
    mocked.usage.mockResolvedValueOnce({ used: 49, limit: 50, remaining: 1, allowed: true });
    await expect(startAgentImageJob(owner, 'token', input, { schedule }))
      .rejects.toMatchObject({ code: 'quota_exhausted', needed: 2, remaining: 1 });
    expect(mocked.consume).not.toHaveBeenCalled();
    mocked.consume
      .mockResolvedValueOnce({ allowed: true, used: 50, limit: 50, remaining: 0 })
      .mockResolvedValueOnce({ allowed: false, reason: 'exhausted', used: 50, limit: 50, remaining: 0 });
    await expect(startAgentImageJob(owner, 'token', input, { schedule }))
      .rejects.toMatchObject({ code: 'quota_exhausted' });
    expect(mocked.refund).toHaveBeenCalledTimes(1);
    expect(mocked.refund.mock.calls[0][0]).toMatchObject({ customerId: owner, periodStartSec: 100, operationId: op('s1') });
    expect(schedule).not.toHaveBeenCalled();
  });

  it('devolve os créditos se o registro do job falhar e repete pelo requestId sem cobrar', async () => {
    const schedule = vi.fn();
    mocked.createJob.mockRejectedValueOnce(Object.assign(new Error('mudou'), { code: 'project_conflict', cloudVersion: 4 }));
    await expect(startAgentImageJob(owner, 'token', input, { schedule })).rejects.toMatchObject({ code: 'project_conflict' });
    expect(mocked.refund.mock.calls.map(call => call[0].operationId).sort()).toEqual([op('s1'), op('s2')].sort());
    expect(schedule).not.toHaveBeenCalled();

    vi.clearAllMocks();
    mocked.job.mockResolvedValue(pendingJob().job);
    const replay = await startAgentImageJob(owner, 'token', input, { schedule });
    expect(replay).toMatchObject({ requestId, status: 'pending' });
    expect(mocked.consume).not.toHaveBeenCalled();
    expect(mocked.createJob).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
    await expect(startAgentImageJob(owner, 'token', { ...input, slideIds: ['s1'] }, { schedule }))
      .rejects.toMatchObject({ code: 'image_request_reused' });
    await expect(startAgentImageJob(owner, 'token', { ...input, projectId: 'other' }, { schedule }))
      .rejects.toMatchObject({ code: 'image_request_reused' });
  });

  it('recusa plano sem imagens e assinatura inativa antes de reservar', async () => {
    mocked.subscription.mockResolvedValueOnce(null);
    await expect(startAgentImageJob(owner, 'token', input, { schedule: vi.fn() })).rejects.toMatchObject({ code: 'subscription_inactive' });
    expect(mocked.consume).not.toHaveBeenCalled();
  });

  it('usa waitUntil por padrão para manter a geração viva após responder', async () => {
    mocked.finishJob.mockResolvedValue({ finished: true, job: { status: 'applied' }, slides: [] });
    await startAgentImageJob(owner, 'token', input);
    expect(mocked.waitUntil).toHaveBeenCalledTimes(1);
    await mocked.waitUntil.mock.calls[0][0];
  });
});

describe('runAgentImageJob', () => {
  const ctx = () => ({ ownerId: owner, requestId, aspectRatio: '9:16', periodStartSec: 100,
    slides: pendingJob().slides.map(slide => ({ ...slide, imageQuery: `direção ${slide.slideId}` })) });

  it('gera em paralelo pelo mesmo pipeline do editor, grava o original e liquida os créditos', async () => {
    mocked.finishJob.mockImplementation(async (_owner, _request, outcomes) => ({
      finished: true,
      job: { requestId, status: 'applied', afterVersion: 4 },
      slides: outcomes.map(outcome => ({ ...outcome, status: outcome.assetId ? 'done' : 'failed', operationId: op(outcome.slideId) })),
    }));
    const job = await runAgentImageJob(ctx());
    expect(mocked.create).toHaveBeenCalledTimes(2);
    expect(mocked.create).toHaveBeenCalledWith({ prompt: 'direção s1', aspectRatio: '9:16', resolution: '1K', imageList: [] });
    expect(mocked.put).toHaveBeenCalledWith(owner, expect.stringMatching(/^original_[a-f0-9]{64}$/), { dataUrl: 'data:image/png;base64,QUJD' });
    const outcomes = mocked.finishJob.mock.calls[0][2];
    expect(outcomes.map(outcome => outcome.slideId)).toEqual(['s1', 's2']);
    expect(outcomes.every(outcome => /^original_/.test(outcome.assetId))).toBe(true);
    expect(mocked.settle).toHaveBeenCalledTimes(2);
    expect(mocked.refund).not.toHaveBeenCalled();
    expect(job).toMatchObject({ status: 'applied', afterVersion: 4 });
  });

  it('devolve o crédito do card que falhou e confirma o que deu certo', async () => {
    mocked.wait.mockResolvedValueOnce({ url: 'https://images.example/a.png' })
      .mockRejectedValueOnce(Object.assign(new Error('demorou'), { code: 'sjinn_timeout' }));
    mocked.finishJob.mockImplementation(async (_owner, _request, outcomes) => ({
      finished: true, job: { status: 'applied' },
      slides: outcomes.map(outcome => ({ ...outcome, status: outcome.assetId ? 'done' : 'failed', operationId: op(outcome.slideId) })),
    }));
    await runAgentImageJob(ctx());
    const outcomes = mocked.finishJob.mock.calls[0][2];
    expect(outcomes[1]).toEqual({ slideId: 's2', errorCode: 'sjinn_timeout' });
    expect(mocked.settle.mock.calls[0][0].operationId).toBe(op('s1'));
    expect(mocked.refund.mock.calls[0][0].operationId).toBe(op('s2'));
  });

  it('não liquida nada quando o fechamento do job falha; o leitor expira depois', async () => {
    mocked.finishJob.mockRejectedValue(new Error('db down'));
    expect(await runAgentImageJob(ctx())).toBeNull();
    expect(mocked.settle).not.toHaveBeenCalled();
    expect(mocked.refund).not.toHaveBeenCalled();
  });
});

describe('getAgentChangeStatus', () => {
  it('devolve o job como está e só expira um pendente antigo, devolvendo os créditos', async () => {
    mocked.job.mockResolvedValue(pendingJob().job);
    expect(await getAgentChangeStatus(owner, requestId)).toMatchObject({ status: 'pending' });
    expect(mocked.expireJob).not.toHaveBeenCalled();
    const stale = pendingJob();
    stale.job.createdAt = new Date(Date.now() - 20 * 60_000).toISOString();
    mocked.job.mockResolvedValue(stale.job);
    mocked.expireJob.mockResolvedValue({ expired: true, job: { ...stale.job, status: 'failed', errorCode: 'image_job_timeout' },
      slides: stale.slides.map(slide => ({ ...slide, status: 'failed', errorCode: 'image_job_timeout' })), meta: stale.meta });
    const expired = await getAgentChangeStatus(owner, requestId);
    expect(expired).toMatchObject({ status: 'failed', errorCode: 'image_job_timeout' });
    expect(mocked.refund.mock.calls.map(call => call[0].operationId).sort()).toEqual([op('s1'), op('s2')].sort());
  });
});

describe('helpers', () => {
  it('mapeia formato para proporção como o editor', () => {
    expect(imageAspectRatio({ formatId: 'apresentacao' })).toBe('16:9');
    expect(imageAspectRatio({ formatId: 'quadrado' })).toBe('1:1');
    expect(imageAspectRatio({ formatId: 'stories' })).toBe('9:16');
    expect(imageAspectRatio({ formatId: 'carrossel' })).toBe('2:3');
  });

  it('grava imagens grandes em partes com o mesmo identificador do navegador', async () => {
    const dataUrl = `data:image/png;base64,${'A'.repeat(70)}`;
    const assetId = await storeGeneratedAsset(owner, dataUrl);
    expect(assetId).toMatch(/^original_chunks_[a-f0-9]{64}$/);
    expect(mocked.put).not.toHaveBeenCalled();
    expect(mocked.putChunk).toHaveBeenCalledTimes(3);
    expect(mocked.putChunk.mock.calls.map(call => [call[2].index, call[2].total, call[2].data.length]))
      .toEqual([[0, 3, 40], [1, 3, 40], [2, 3, 12]]);
  });
});
