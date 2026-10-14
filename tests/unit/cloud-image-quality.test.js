import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { packLibraryForCloud, pushLibraryToCloud, applyCloudManifest, fetchLibraryCloudStatus } from '../../src/utils/library-sync.js';
import { originalImageAssetId, CLOUD_IMAGE_PART_CHARS } from '../../src/utils/cloud-image-assets.js';
import { SK, unlockAccountDataWrites } from '../../src/utils/storage.js';
import {
  putLibraryManifest, getLibraryManifest, getLibrarySyncMeta, putLibraryAsset,
  putLibraryAssetChunk, getLibraryAsset, resetLibrarySyncStoreForTests,
} from '../../api/lib/library-sync-store.js';

const images = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock('../../src/utils/image-store.js', async (original) => ({
  ...(await original()), imagemComoDataUrl: images.read, guardarImagemDoSlide: images.write,
}));
const photo = `data:image/jpeg;base64,${Buffer.alloc(3_300_000, 173).toString('base64')}`;
const snapshot = (source = photo) => ({ library: [{ id: 'p1', updatedAt: 1, doc: {
  slides: [{ id: 's1', title: 'Detalhe preservado', bgImage: source, bgImageId: 'local-original' }],
} }], brandRoster: [], libraryFolders: [], activeDocId: 'p1' });
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
function storage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, val) => map.set(key, String(val)),
    removeItem: (key) => map.delete(key) };
}
function connectCloud({ failPart, corruptPart } = {}) {
  const requests = [];
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    const query = new URL(url, 'https://moont.test').searchParams;
    const body = options.body && JSON.parse(options.body);
    requests.push({ query, body, chars: options.body?.length || 0 });
    try {
      if (query.has('asset')) {
        const asset = await getLibraryAsset('cus_quality', query.get('asset'), {
          part: query.has('part') ? Number(query.get('part')) : undefined,
        });
        if (asset && query.get('part') === String(corruptPart)) asset.data = asset.data.replace(/r/, 'b');
        return asset ? response({ ok: true, asset }) : response({ error: 'Asset não encontrado.' }, 404);
      }
      if (query.has('full')) return response({ ok: true, manifest: await getLibraryManifest('cus_quality') });
      if (body.action === 'status') {
        const meta = await getLibrarySyncMeta('cus_quality');
        return response({ ok: true, meta, empty: !meta });
      }
      if (body.action === 'push') {
        const { meta } = await putLibraryManifest('cus_quality', body.manifest);
        return response({ ok: true, ...meta });
      }
      if (body.action === 'putAsset') return response({ ok: true,
        ...await putLibraryAsset('cus_quality', body.assetId, body) });
      if (body.action === 'putAssetChunk') {
        if (body.index === failPart) return response({ error: 'Conexão interrompida.' }, 503);
        return response({ ok: true, ...await putLibraryAssetChunk('cus_quality', body.assetId, body) });
      }
      throw new Error(`Ação inesperada: ${body.action}`);
    } catch (error) { return response({ error: error.message }, 500); }
  }));
  return requests;
}
beforeEach(() => {
  vi.stubGlobal('localStorage', storage());
  vi.stubGlobal('sessionStorage', storage());
  vi.stubEnv('VITEST', 'true');
  unlockAccountDataWrites();
  resetLibrarySyncStoreForTests();
  images.read.mockReset().mockResolvedValue(null);
  images.write.mockReset().mockImplementation(async (_source, { id }) => ({ bgImage: `blob:${id}`, bgImageId: id }));
});
afterEach(() => { unlockAccountDataWrites(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('qualidade original entre navegador e nuvem', () => {
  it('empacota os mesmos bytes sem Canvas e deduplica o original por conteúdo', async () => {
    const canvas = vi.fn(() => { throw new Error('Nenhuma recompressão permitida'); });
    vi.stubGlobal('document', { createElement: canvas });
    const input = snapshot();
    input.library[0].doc.slides.push({ id: 's2', bgImage: photo, bgImageId: 'outro-id-local' });
    const packed = await packLibraryForCloud(input);
    const id = await originalImageAssetId(photo);
    expect(packed.assets.size).toBe(1);
    expect(packed.assets.get(id)).toBe(photo);
    expect(packed.manifest.docs[0].doc.slides.every((slide) => slide.bgImageAssetId === id)).toBe(true);
    expect(id).toMatch(/^original_chunks_[a-f0-9]{64}$/);
    expect(canvas).not.toHaveBeenCalled();
  });

  it('Salvar e restore em navegador novo mantêm exatamente um original acima do limite HTTP', async () => {
    const requests = connectCloud();
    const saved = await pushLibraryToCloud({ snapshot: snapshot(), pullAfter: true });
    expect(saved).toMatchObject({ ok: true, assetsFailed: 0, assetsUploaded: 1, projectCount: 1 });
    expect(images.write.mock.calls[0][0]).toBe(photo);
    const parts = requests.filter(({ body }) => body?.action === 'putAssetChunk');
    expect(parts).toHaveLength(3);
    expect(parts.map(({ body }) => body.data).join('')).toBe(photo);
    expect(parts.every(({ chars }) => chars < 2_800_000)).toBe(true);
    // Novo navegador: nada no IndexedDB e nenhuma cópia preparada do push.
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', storage());
    unlockAccountDataWrites();
    images.write.mockClear();
    const restored = await applyCloudManifest(await getLibraryManifest('cus_quality'));
    expect(restored).toMatchObject({ projectCount: 1, assetsMissing: 0 });
    expect(images.write.mock.calls[0][0]).toBe(photo);
    expect(requests.filter(({ query }) => query.has('part'))).toHaveLength(3);
    expect(JSON.parse(localStorage.getItem(SK.library))[0].doc.slides[0].title).toBe('Detalhe preservado');
  });

  it('retry não degrada a imagem; falha preserva o original local e restaura os textos em outro navegador', async () => {
    const requests = connectCloud({ failPart: 1 });
    const saved = await pushLibraryToCloud({ snapshot: snapshot(), pullAfter: true });
    expect(saved).toMatchObject({ ok: true, assetsUploaded: 0, assetsFailed: 1 });
    const retries = requests.filter(({ body }) => body?.action === 'putAssetChunk' && body.index === 0);
    expect(retries).toHaveLength(2);
    expect(retries.every(({ body }) => body.data === photo.slice(0, CLOUD_IMAGE_PART_CHARS))).toBe(true);
    expect(images.write.mock.calls[0][0]).toBe(photo);
    vi.stubGlobal('localStorage', storage());
    unlockAccountDataWrites();
    images.write.mockClear();
    const restored = await applyCloudManifest(await getLibraryManifest('cus_quality'));
    expect(restored).toMatchObject({ projectCount: 1, assetsMissing: 1 });
    expect(images.write).not.toHaveBeenCalled();
  });

  it('detecta alteração de uma parte pelo hash e não grava uma foto corrompida', async () => {
    connectCloud({ corruptPart: 1 });
    await pushLibraryToCloud({ snapshot: snapshot(), pullAfter: false });
    images.write.mockClear();
    const restored = await applyCloudManifest(await getLibraryManifest('cus_quality'));
    expect(restored).toMatchObject({ projectCount: 1, assetsMissing: 1 });
    expect(images.write).not.toHaveBeenCalled();
  });

  it('respeita Retry-After antes de repetir um pedido limitado', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '2' } }))
      .mockResolvedValue(response({ ok: true, empty: true }));
    vi.stubGlobal('fetch', fetch);
    const pending = fetchLibraryCloudStatus();
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('logout cancela a espera do rate limit sem enviar um pedido tardio', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '60' } }));
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    const pending = fetchLibraryCloudStatus({ signal: controller.signal });
    const rejection = expect(pending).rejects.toThrow('Sincronização cancelada');
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    await rejection;
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('troca de conta durante Retry-After impede reenvio na outra conta', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '2' } })));
    const pending = fetchLibraryCloudStatus();
    const rejection = expect(pending).rejects.toThrow('A conta mudou');
    await vi.advanceTimersByTimeAsync(1);
    localStorage.setItem(SK.dataOwner, 'outra-conta');
    await vi.advanceTimersByTimeAsync(2000);
    await rejection;
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
