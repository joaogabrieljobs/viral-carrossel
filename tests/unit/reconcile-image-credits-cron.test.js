import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ reconcile:vi.fn() }));
vi.mock('../../api/lib/agent-image-generation.js', () => ({
  reconcileAgentImageCredits:mocked.reconcile,
}));

import handler from '../../api/cron/reconcile-image-credits.js';

function response() {
  return {
    statusCode:200,
    headers:{},
    body:null,
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

describe('cron de reconciliação de créditos de imagem', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'cron-test-secret');
    mocked.reconcile.mockResolvedValue({ scanned:2, settled:2, pending:0, failed:0 });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('recusa chamada sem o segredo do cron', async () => {
    const res = response();
    await handler({ method:'GET', headers:{} }, res);
    expect(res.statusCode).toBe(401);
    expect(mocked.reconcile).not.toHaveBeenCalled();
  });

  it('executa o reconciliador autenticado sem depender de polling', async () => {
    const res = response();
    await handler({
      method:'GET', headers:{ authorization:'Bearer cron-test-secret' },
    }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ scanned:2, settled:2, pending:0, failed:0 });
    expect(mocked.reconcile).toHaveBeenCalledWith({ limit:100 });
  });
});
