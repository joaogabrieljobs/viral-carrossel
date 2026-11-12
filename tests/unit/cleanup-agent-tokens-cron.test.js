import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeReq, makeRes } from '../helpers/http.js';

const deps = vi.hoisted(() => ({
  cleanupImages: vi.fn(),
  cleanupTokens: vi.fn(),
}));

vi.mock('../../api/lib/image-references.js', () => ({
  cleanupStaleImageReferences: deps.cleanupImages,
}));
vi.mock('../../api/lib/agent-token-store.js', () => ({
  cleanupExpiredAgentTokens: deps.cleanupTokens,
}));

import handler from '../../api/cron/cleanup-image-references.js';

describe('limpeza diária de credenciais OAuth', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'cron-secret-test');
    vi.stubEnv('LIBRARY_SYNC_BACKEND', 'postgres');
    deps.cleanupImages.mockResolvedValue({ deleted: 1, hasMore: false });
    deps.cleanupTokens.mockResolvedValue({ deleted: 3 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it('remove tokens expirados junto da limpeza diária', async () => {
    const response = makeRes();
    await handler(makeReq({
      method: 'GET', headers: { authorization: 'Bearer cron-secret-test' },
    }), response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      deleted: 1, hasMore: false, agentTokens: { deleted: 3 },
    });
    expect(deps.cleanupTokens).toHaveBeenCalledOnce();
  });

  it('preserva a limpeza de imagens quando a limpeza de tokens falha', async () => {
    deps.cleanupTokens.mockRejectedValue(new Error('database unavailable'));
    const response = makeRes();
    await handler(makeReq({
      method: 'GET', headers: { authorization: 'Bearer cron-secret-test' },
    }), response);

    expect(response.statusCode).toBe(200);
    expect(response.body.agentTokens).toEqual({ deleted: 0, failed: true });
  });

  it('a falha do Blob não impede a remoção diária dos tokens', async () => {
    deps.cleanupImages.mockRejectedValue(new Error('blob unavailable'));
    const response = makeRes();
    await handler(makeReq({
      method: 'GET', headers: { authorization: 'Bearer cron-secret-test' },
    }), response);

    expect(response.statusCode).toBe(503);
    expect(deps.cleanupTokens).toHaveBeenCalledOnce();
  });
});
