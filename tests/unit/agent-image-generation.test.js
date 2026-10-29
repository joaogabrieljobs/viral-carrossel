import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  subscription: vi.fn(), consume: vi.fn(), refund: vi.fn(), settle: vi.fn(),
  create: vi.fn(), wait: vi.fn(), download: vi.fn(), put: vi.fn(),
  project: vi.fn(), job: vi.fn(), apply: vi.fn(),
}));
vi.mock('../../api/lib/stripe.js', () => ({ findActiveSubscription: mocked.subscription }));
vi.mock('../../api/lib/plans.js', () => ({
  resolveTierFromSubscription: () => 'creator', imageQuotaForTier: () => 50,
  periodBoundsFromSubscription: () => ({ periodStartSec: 100, periodEndSec: 200 }),
}));
vi.mock('../../api/lib/image-quota.js', () => ({
  consumeImageCredit: mocked.consume, refundImageCredit: mocked.refund, settleImageCredit: mocked.settle,
}));
vi.mock('../../api/lib/sjinn.js', () => ({
  isSjinnConfigured: () => true, createGptImage2Task: mocked.create,
  waitForSjinnTask: mocked.wait, downloadImageAsBase64: mocked.download,
  extractSjinnOutputUrl: () => 'https://images.example/result.png', SJINN_DEADLINE_MS: 240000,
}));
vi.mock('../../api/lib/library-sync-store.js', () => ({ putLibraryAsset: mocked.put }));
vi.mock('../../api/lib/agent-visual-batch.js', () => ({
  getAgentProject: mocked.project, getAgentVisualJob: mocked.job, applyAgentImageEdit: mocked.apply,
}));

import { generateAndApplyAgentSlideImage, imageAspectRatio } from '../../api/lib/agent-image-generation.js';

beforeEach(() => {
  vi.clearAllMocks();
  mocked.subscription.mockResolvedValue({ id: 'sub' });
  mocked.consume.mockResolvedValue({ allowed: true, used: 1, limit: 50, remaining: 49 });
  mocked.refund.mockResolvedValue(null); mocked.settle.mockResolvedValue(null);
  mocked.create.mockResolvedValue('task-1'); mocked.wait.mockResolvedValue({});
  mocked.download.mockResolvedValue({ b64_json: 'QUJD', mime: 'image/png' });
  mocked.job.mockRejectedValue(Object.assign(new Error('missing'), { code: 'visual_job_not_found' }));
  mocked.project.mockResolvedValue({ id: 'p', version: 3, format: 'stories', slides: [
    { id: 's1', imageQuery: 'editorial portrait in natural light', hasPhoto: false },
  ] });
  mocked.apply.mockResolvedValue({ requestId: 'request-image-01', status: 'applied', afterVersion: 4 });
});

describe('agent image generation', () => {
  it('gera, salva o asset e aplica no card com quota e versão', async () => {
    const result = await generateAndApplyAgentSlideImage('cus_1', 'token', {
      projectId: 'p', baseVersion: 3, slideId: 's1', requestId: 'request-image-01',
    });
    expect(mocked.create).toHaveBeenCalledWith(expect.objectContaining({ aspectRatio: '9:16', resolution: '1K' }));
    expect(mocked.put).toHaveBeenCalledWith('cus_1', expect.stringMatching(/^agent_[a-f0-9]{48}$/),
      { dataUrl: 'data:image/png;base64,QUJD', contentType: 'image/png' });
    expect(mocked.apply).toHaveBeenCalledWith('cus_1', 'token', expect.objectContaining({
      projectId: 'p', baseVersion: 3, slideId: 's1', requestId: 'request-image-01',
    }));
    expect(result).toMatchObject({ hasPhoto: true, slideId: 's1', quota: { remaining: 49 } });
  });

  it('não gera quando a versão mudou ou o card já tem foto', async () => {
    await expect(generateAndApplyAgentSlideImage('cus_1', 'token', {
      projectId: 'p', baseVersion: 2, slideId: 's1', requestId: 'request-image-02',
    })).rejects.toMatchObject({ code: 'project_conflict', cloudVersion: 3 });
    mocked.project.mockResolvedValueOnce({ id: 'p', version: 3, slides: [{ id: 's1', hasPhoto: true }] });
    await expect(generateAndApplyAgentSlideImage('cus_1', 'token', {
      projectId: 'p', baseVersion: 3, slideId: 's1', requestId: 'request-image-03',
    })).rejects.toMatchObject({ code: 'image_already_present' });
    expect(mocked.create).not.toHaveBeenCalled();
  });

  it('repetição concluída devolve o mesmo job sem gastar outro crédito', async () => {
    mocked.job.mockResolvedValue({ projectId: 'p', requestId: 'request-image-01', changedBrandFields: ['image:s1'] });
    const result = await generateAndApplyAgentSlideImage('cus_1', 'token', {
      projectId: 'p', baseVersion: 3, slideId: 's1', requestId: 'request-image-01',
    });
    expect(result).toMatchObject({ replayed: true, hasPhoto: true });
    expect(mocked.consume).not.toHaveBeenCalled();
  });

  it('devolve o crédito quando o projeto muda durante a geração', async () => {
    mocked.apply.mockRejectedValue(Object.assign(new Error('mudou'), { code: 'project_conflict', status: 409 }));
    await expect(generateAndApplyAgentSlideImage('cus_1', 'token', {
      projectId: 'p', baseVersion: 3, slideId: 's1', requestId: 'request-image-04',
    })).rejects.toMatchObject({ code: 'project_conflict' });
    expect(mocked.refund).toHaveBeenCalledWith(expect.objectContaining({ operationId: 'mcp:request-image-04' }));
    expect(mocked.settle).not.toHaveBeenCalled();
  });

  it('mapeia os formatos para a proporção da imagem', () => {
    expect(imageAspectRatio({ format: 'apresentacao' })).toBe('16:9');
    expect(imageAspectRatio({ format: 'quadrado' })).toBe('1:1');
    expect(imageAspectRatio({ format: 'feed' })).toBe('2:3');
  });
});
