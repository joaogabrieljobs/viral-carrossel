import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const blob = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn() }));
const auth = vi.hoisted(() => ({ require: vi.fn(), limit: vi.fn() }));
vi.mock('@vercel/blob', () => blob);
vi.mock('../../api/lib/require-access.js', () => ({ requireActiveSubscription: auth.require }));
vi.mock('../../api/lib/rate-limit.js', () => ({ consumeRateLimit: auth.limit, rateLimitResponse: vi.fn() }));
import {
  putLibraryAsset, putLibraryAssetChunk, getLibraryAsset,
  resetLibrarySyncStoreForTests, ASSET_CHUNK_CHARS,
} from '../../api/lib/library-sync-store.js';
import handler from '../../api/library-sync.js';

const owner = 'cus_original';
const digest = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const original = `data:image/png;base64,${Buffer.alloc(1_600_000, 0xa7).toString('base64')}`;
const assetId = `original_chunks_${digest(original)}`;
function chunks(dataUrl = original) {
  const total = Math.ceil(dataUrl.length / ASSET_CHUNK_CHARS);
  return Array.from({ length: total }, (_, index) => ({
    index, total, totalChars: dataUrl.length,
    data: dataUrl.slice(index * ASSET_CHUNK_CHARS, (index + 1) * ASSET_CHUNK_CHARS),
  }));
}

let stored;
beforeEach(() => {
  resetLibrarySyncStoreForTests();
  vi.clearAllMocks();
  vi.stubEnv('VITEST', 'true');
  vi.stubEnv('NODE_ENV', 'test');
  stored = new Map();
  blob.put.mockImplementation(async (path, body) => { stored.set(path, Buffer.from(body)); return {}; });
  blob.get.mockImplementation(async (path) => stored.has(path)
    ? { stream: new Response(stored.get(path)).body } : null);
  auth.require.mockResolvedValue({ customerId: owner, email: 'original@example.test' });
  auth.limit.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

for (const mode of ['memory', 'private Blob']) {
  describe(`originais sem recompressão — ${mode}`, () => {
    beforeEach(() => {
      if (mode === 'private Blob') {
        vi.stubEnv('VITEST', 'false');
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-private-token');
      }
    });

    it.each(['png', 'jpeg', 'webp', 'gif', 'avif'])('preserva bytes e MIME de %s, isolados por conta', async (type) => {
      const dataUrl = `data:image/${type};base64,AQIDBA==`;
      const id = `original_${digest(dataUrl)}`;
      await putLibraryAsset(owner, id, { dataUrl, contentType: 'image/jpeg' });
      expect(await getLibraryAsset(owner, id)).toMatchObject({ dataUrl, contentType: `image/${type}` });
      expect(await getLibraryAsset('cus_another', id)).toBeNull();
      if (mode === 'private Blob') {
        expect(blob.put).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.objectContaining({ access: 'private' }));
      }
    });

    it('restaura imagem grande byte a byte apenas depois de confirmar todas as partes', async () => {
      const parts = chunks();
      expect(await putLibraryAssetChunk(owner, assetId, parts[0])).toMatchObject({ complete: false });
      expect(await getLibraryAsset(owner, assetId)).toBeNull();
      expect(await getLibraryAsset(owner, assetId, { part: 0 })).toBeNull();
      expect(await putLibraryAssetChunk(owner, assetId, parts[1])).toMatchObject({ complete: true });
      expect(await getLibraryAsset(owner, assetId)).toEqual({
        assetId, chunked: true, total: parts.length, totalChars: original.length,
      });
      const restored = [];
      for (let index = 0; index < parts.length; index++) {
        restored.push((await getLibraryAsset(owner, assetId, { part: index })).data);
      }
      expect(restored.join('')).toBe(original);
      expect(await getLibraryAsset('cus_another', assetId)).toBeNull();
      expect(await getLibraryAsset('cus_another', assetId, { part: 0 })).toBeNull();
    });

    it('última parte em falta de predecessoras falha; retries são idempotentes', async () => {
      const parts = chunks();
      await expect(putLibraryAssetChunk(owner, assetId, parts[1])).rejects.toMatchObject({ code: 'library_asset_incomplete' });
      expect(await getLibraryAsset(owner, assetId)).toBeNull();
      await putLibraryAssetChunk(owner, assetId, parts[0]);
      await putLibraryAssetChunk(owner, assetId, parts[0]);
      await putLibraryAssetChunk(owner, assetId, parts[1]);
      expect(await putLibraryAssetChunk(owner, assetId, parts[1])).toMatchObject({ complete: true });
      await expect(putLibraryAssetChunk(owner, assetId, {
        ...parts[0], data: parts[0].data.replace('data:', 'dAta:'),
      })).rejects.toMatchObject({ code: 'library_bad_asset' });
      expect((await getLibraryAsset(owner, assetId, { part: 0 })).data).toBe(parts[0].data);
    });

    it('hash incorreto nunca publica um descriptor nem muda outro asset', async () => {
      const parts = chunks();
      const wrongId = `original_chunks_${'0'.repeat(64)}`;
      await putLibraryAssetChunk(owner, wrongId, parts[0]);
      await expect(putLibraryAssetChunk(owner, wrongId, parts[1])).rejects.toMatchObject({ code: 'library_bad_asset' });
      expect(await getLibraryAsset(owner, wrongId)).toBeNull();
      await expect(putLibraryAsset(owner, `original_${'0'.repeat(64)}`, {
        dataUrl: 'data:image/png;base64,AQIDBA==',
      })).rejects.toMatchObject({ code: 'library_bad_asset' });
    });

    it('recusa índices, limites e caminhos externos antes de escrever', async () => {
      const first = chunks()[0];
      for (const body of [
        { ...first, index: -1 }, { ...first, index: 1.5 }, { ...first, index: 2 },
        { ...first, total: 25, totalChars: 50_000_000 },
        { ...first, data: `${first.data}A` }, { ...first, totalChars: first.totalChars - 2_000_000 },
      ]) {
        await expect(putLibraryAssetChunk(owner, assetId, body)).rejects.toMatchObject({ code: 'library_bad_asset' });
      }
      await expect(putLibraryAssetChunk('../cus_other', assetId, first)).rejects.toMatchObject({ code: 'library_bad_asset' });
      await expect(putLibraryAssetChunk(owner, '../other/image', first)).rejects.toMatchObject({ code: 'library_bad_asset' });
      await expect(getLibraryAsset(owner, assetId, { part: -1 })).rejects.toMatchObject({ code: 'library_bad_asset' });
      expect(blob.put).not.toHaveBeenCalled();
    });
  });
}

describe('falhas do Blob privado', () => {
  beforeEach(() => {
    vi.stubEnv('VITEST', 'false'); vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-private-token');
  });
  it('parte ausente ou corrompida não é entregue como original', async () => {
    for (const part of chunks()) await putLibraryAssetChunk(owner, assetId, part);
    const partPath = [...stored.keys()].find((path) => path.includes('/parts/0-'));
    stored.delete(partPath);
    expect(await getLibraryAsset(owner, assetId, { part: 0 })).toBeNull();
    await putLibraryAssetChunk(owner, assetId, chunks()[0]);
    expect((await getLibraryAsset(owner, assetId, { part: 0 })).data).toBe(chunks()[0].data);
    stored.set(partPath, Buffer.from(JSON.stringify({ index: 0, data: 'corrompido' })));
    expect(await getLibraryAsset(owner, assetId, { part: 0 })).toBeNull();
    await putLibraryAssetChunk(owner, assetId, chunks()[0]);
    expect((await getLibraryAsset(owner, assetId, { part: 0 })).data).toBe(chunks()[0].data);
  });
  it('não confirma finalização se falha a publicação do descriptor; retry recupera', async () => {
    const parts = chunks();
    await putLibraryAssetChunk(owner, assetId, parts[0]);
    const put = blob.put.getMockImplementation();
    blob.put.mockImplementation(async (path, ...args) => {
      if (path.endsWith('/complete.json')) throw new Error('unavailable');
      return put(path, ...args);
    });
    await expect(putLibraryAssetChunk(owner, assetId, parts[1])).rejects.toMatchObject({ code: 'library_storage_unconfigured' });
    expect(await getLibraryAsset(owner, assetId)).toBeNull();
    blob.put.mockImplementation(put);
    expect(await putLibraryAssetChunk(owner, assetId, parts[1])).toMatchObject({ complete: true });
  });
});

describe('API autenticada das imagens originais', () => {
  async function request(method, { body, query } = {}) {
    const res = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn(), end: vi.fn() };
    res.status.mockReturnValue(res);
    await handler({ method, body, query, headers: {} }, res);
    return { status: res.status.mock.calls.at(-1)?.[0], body: res.json.mock.calls.at(-1)?.[0] };
  }
  it('aceita putAssetChunk, normaliza action e permite ler partes pela conta autenticada', async () => {
    const parts = chunks();
    for (const part of parts) {
      expect((await request('POST', { body: { action: 'putAssetChunk', assetId, ...part } })).status).toBe(200);
    }
    expect((await request('GET', { query: { asset: assetId } })).body.asset).toMatchObject({ chunked: true, total: 2 });
    expect((await request('GET', { query: { asset: assetId, part: '1' } })).body.asset).toEqual({ index: 1, data: parts[1].data });
    auth.require.mockResolvedValue({ customerId: 'cus_other' });
    expect((await request('GET', { query: { asset: assetId, part: '0' } })).status).toBe(404);
  });
  it('não devolve sucesso em envio incompleto e recusa parâmetros inválidos', async () => {
    const last = chunks().at(-1);
    expect((await request('POST', { body: { action: 'putAssetChunk', assetId, ...last } })).status).toBe(409);
    expect((await request('GET', { query: { asset: assetId } })).status).toBe(404);
    for (const part of ['-1', '1.2', ['0'], '../other']) {
      expect((await request('GET', { query: { asset: assetId, part } })).status).toBe(400);
    }
    auth.require.mockResolvedValue(null);
    expect((await request('POST', { body: { action: 'putAssetChunk', assetId, ...chunks()[0] } })).body).toBeUndefined();
  });
});
