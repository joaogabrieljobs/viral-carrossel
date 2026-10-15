import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/status.js';

afterEach(() => vi.unstubAllEnvs());

function status() {
  let body;
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn((value) => { body = value; }),
  };
  handler({ method: 'GET', headers: {} }, res);
  return body;
}

describe('status do Redis legado', () => {
  it('mostra desativado mesmo com credenciais quando a flag de corte está ligada', () => {
    vi.stubEnv('VERCEL_ENV', 'development');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
    vi.stubEnv('UPSTASH_DISABLED', '1');
    expect(status().upstash).toBe(false);
    vi.stubEnv('UPSTASH_DISABLED', '');
    expect(status().upstash).toBe(true);
  });
});
