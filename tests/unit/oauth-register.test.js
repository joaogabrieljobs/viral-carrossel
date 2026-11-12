import { beforeEach, describe, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({
  register:vi.fn(),
  limit:vi.fn(),
}));

vi.mock('../../api/lib/oauth-store.js', () => ({ registerOAuthClient:deps.register }));
vi.mock('../../api/lib/rate-limit.js', () => ({ consumeRateLimit:deps.limit }));

import register from '../../api/oauth/register.js';

function response() {
  const res = { setHeader:vi.fn(), status:vi.fn(), json:vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe('registro dinâmico OAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('responde backend indisponível no contrato OAuth', async () => {
    deps.limit.mockResolvedValue({ unavailable:true, retryAfterSec:0 });
    const res = response();
    await register({ method:'POST', headers:{}, body:{} }, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error:'temporarily_unavailable',
      error_description:expect.stringContaining('temporariamente indisponível'),
    });
    expect(deps.register).not.toHaveBeenCalled();
  });

  it('mantém Retry-After e corpo OAuth quando o limite é excedido', async () => {
    deps.limit.mockResolvedValue({ retryAfterSec:17 });
    const res = response();
    await register({ method:'POST', headers:{}, body:{} }, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '17');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error:'temporarily_unavailable',
      error_description:expect.any(String),
    }));
  });
});
