// DB-06 (auditoria de 23/11): o boot depende de GET /api/library-sync?full=1,
// que devolve todos os projetos numa resposta só. O limite de resposta de uma
// função da Vercel é 4,5 MB e faltava o número real da maior conta.
// Este arquivo cobre só a medição: o tamanho da resposta vai para o log.
// A troca do boot por leitura em páginas continua pendente.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stores = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), pgManifest: vi.fn() }));

vi.mock('../../api/lib/require-access.js', () => ({ requireActiveSubscription: stores.auth }));
vi.mock('../../api/lib/rate-limit.js', () => ({ consumeRateLimit: stores.limit, rateLimitResponse: vi.fn() }));
vi.mock('../../api/lib/library-sync-store.js', () => ({
  getLibrarySyncMeta: vi.fn(), getLibraryManifest: vi.fn(), putLibraryManifest: vi.fn(),
  putLibraryAsset: vi.fn(), putLibraryAssetChunk: vi.fn(), getLibraryAsset: vi.fn(),
  resolveLibraryOwnerId: (access) => access.customerId || '',
}));
vi.mock('../../api/lib/library-sync-postgres.js', () => ({
  getLibrarySyncMeta: vi.fn(), getLibraryManifest: stores.pgManifest, putLibraryManifest: vi.fn(),
}));

import handler, { FULL_MANIFEST_LOG_BYTES, FULL_MANIFEST_WARN_BYTES } from '../../api/library-sync.js';

async function fullGet() {
  const res = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn(), end: vi.fn() };
  res.status.mockReturnValue(res);
  await handler({ method: 'GET', query: { full: '1' }, headers: {} }, res);
  return { status: res.status.mock.calls.at(-1)?.[0], body: res.json.mock.calls.at(-1)?.[0] };
}

const manifestWith = (count, bytesEach) => ({
  revision: 7,
  docs: Array.from({ length: count }, (_, i) => ({ id: `p${i}`, doc: { text: 'x'.repeat(bytesEach) } })),
});

describe('DB-06: tamanho da resposta do manifesto completo fica no log', () => {
  let info; let warn;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('LIBRARY_SYNC_BACKEND', 'postgres');
    stores.auth.mockResolvedValue({ customerId: 'cus_grande', email: 'grande@example.test' });
    stores.limit.mockResolvedValue(null);
    info = vi.spyOn(console, 'info').mockImplementation(() => {});
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllEnvs(); info.mockRestore(); warn.mockRestore(); });

  it('resposta pequena não gera linha de log e chega inteira', async () => {
    stores.pgManifest.mockResolvedValue(manifestWith(3, 100));
    const result = await fullGet();
    expect(result.status).toBe(200);
    expect(result.body.manifest.docs).toHaveLength(3);
    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('resposta a partir de 1 MB registra bytes e quantidade de projetos, sem identificar a conta', async () => {
    const manifest = manifestWith(30, 40_000);
    stores.pgManifest.mockResolvedValue(manifest);
    const result = await fullGet();
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, manifest });
    const bytes = Buffer.byteLength(JSON.stringify({ ok: true, manifest }));
    expect(bytes).toBeGreaterThanOrEqual(FULL_MANIFEST_LOG_BYTES);
    expect(info).toHaveBeenCalledWith('[library-sync] full_manifest_bytes', bytes, 'projects', 30);
    expect(JSON.stringify(info.mock.calls)).not.toContain('cus_grande');
    expect(warn).not.toHaveBeenCalled();
  });

  it('resposta perto do limite de 4,5 MB sai como aviso', async () => {
    const manifest = manifestWith(60, 60_000);
    stores.pgManifest.mockResolvedValue(manifest);
    const result = await fullGet();
    expect(result.status).toBe(200);
    const bytes = Buffer.byteLength(JSON.stringify({ ok: true, manifest }));
    expect(bytes).toBeGreaterThanOrEqual(FULL_MANIFEST_WARN_BYTES);
    expect(warn).toHaveBeenCalledWith('[library-sync] full_manifest_near_limit', bytes, 'projects', 60);
  });

  it('falha ao medir não derruba a resposta', async () => {
    const manifest = manifestWith(1, 10);
    manifest.docs[0].big = 10n; // JSON.stringify recusa BigInt
    stores.pgManifest.mockResolvedValue(manifest);
    const result = await fullGet();
    expect(result.status).toBe(200);
    expect(result.body.manifest).toBe(manifest);
  });
});
