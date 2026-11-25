// Reteste 24/11 (conta 5): a galeria "Imagens" listava 39 imagens da conta e
// nenhuma aparecia, com o servidor respondendo 200 com os bytes. A busca na
// conta passava pela hidratação do projeto, que grava no navegador e devolve um
// endereço `blob:`; para virar miniatura esse endereço era lido com fetch, que
// a política de segurança do site no ar recusa (connect-src não inclui blob:).
// Com a gravação local falhando, o caminho era o mesmo e o resultado também.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { originalImageAssetId } from '../../src/utils/cloud-image-assets.js';

const DATA_OWNER_KEY = 'vc_data_owner';

const OWNER = 'email:ingrid@example.test';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const bytesOf = async (blob) => Array.from(new Uint8Array(await blob.arrayBuffer()));
const pngBytes = Array.from(Uint8Array.from(atob(PNG.split(',')[1]), (char) => char.charCodeAt(0)));

function memory() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
  };
}

/** Banco de imagens do navegador: `put` falha por cota cheia, fica pendurado ou grava. */
function imageDatabase(mode) {
  const records = new Map();
  const puts = [];
  const db = {
    objectStoreNames: { contains: () => true },
    close() {},
    transaction() {
      const tx = { error: null, abort() { queueMicrotask(() => tx.onabort?.()); } };
      tx.objectStore = () => ({
        get(id) {
          const request = {};
          queueMicrotask(() => { request.result = records.get(id); request.onsuccess?.(); });
          return request;
        },
        put(value) {
          puts.push(value.id);
          const request = {};
          if (mode === 'hang') return request;
          queueMicrotask(() => {
            if (mode === 'full') {
              request.error = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
              tx.error = request.error;
              request.onerror?.();
              tx.onabort?.();
              return;
            }
            records.set(value.id, value);
            request.onsuccess?.();
            tx.oncomplete?.();
          });
          return request;
        },
      });
      return tx;
    },
  };
  return {
    records, puts,
    open: () => {
      const request = { result: db };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
}

/** A conta responde 200 com os bytes; ler `blob:` com fetch falha, como no site no ar. */
function accountFetch(assets) {
  return vi.fn(async (url) => {
    const target = String(url);
    if (target.startsWith('blob:')) throw new TypeError('Failed to fetch');
    const assetId = new URL(target, 'https://moont.ai').searchParams.get('asset');
    const dataUrl = assets[assetId];
    return new Response(JSON.stringify(dataUrl ? { ok: true, asset: { dataUrl } } : { error: 'Asset não encontrado.' }),
      { status: dataUrl ? 200 : 404 });
  });
}

let assetId;
let ref;
let fetchImageFromAccount;
let loadAccountImage;
beforeEach(async () => {
  const local = memory();
  local.setItem(DATA_OWNER_KEY, JSON.stringify(OWNER));
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', memory());
  // Cada teste abre o banco de imagens do zero, como uma aba nova.
  vi.resetModules();
  const storage = await import('../../src/utils/storage.js');
  storage.bindAccountDataWriteOwner(OWNER, { switchedHere: true });
  ({ fetchImageFromAccount, loadAccountImage } = await import('../../src/utils/account-images.js'));
  assetId = await originalImageAssetId(PNG);
  ref = { key: assetId, imageId: null, assetId, docId: 'p1', slideId: 's1', docName: 'Deck', cardNum: 1 };
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('RT24 conta 5: miniatura da galeria usa os bytes que a conta entregou', () => {
  it('armazenamento cheio: gravar falha e a imagem aparece mesmo assim', async () => {
    const idb = imageDatabase('full');
    vi.stubGlobal('indexedDB', idb);
    vi.stubGlobal('fetch', accountFetch({ [assetId]: PNG }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const blob = await fetchImageFromAccount(ref);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(await bytesOf(blob)).toEqual(pngBytes);
    // Gravar no navegador continua sendo tentado, com o id que a galeria procura depois.
    await vi.waitFor(() => expect(idb.puts).toEqual([assetId]));
  });

  it('sem armazenamento nenhum (aba privada) a imagem também aparece', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('fetch', accountFetch({ [assetId]: PNG }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await bytesOf(await fetchImageFromAccount(ref))).toEqual(pngBytes);
  });

  it('gravação pendurada não segura a miniatura', async () => {
    const idb = imageDatabase('hang');
    vi.stubGlobal('indexedDB', idb);
    vi.stubGlobal('fetch', accountFetch({ [assetId]: PNG }));
    const settled = await Promise.race([
      fetchImageFromAccount(ref).then((blob) => bytesOf(blob)),
      new Promise((resolve) => setTimeout(() => resolve('pendurou'), 1_500)),
    ]);
    expect(settled).toEqual(pngBytes);
  });

  it('com espaço, a imagem fica guardada e a próxima abertura não baixa de novo', async () => {
    const idb = imageDatabase('ok');
    vi.stubGlobal('indexedDB', idb);
    const fetch = accountFetch({ [assetId]: PNG });
    vi.stubGlobal('fetch', fetch);
    const first = await loadAccountImage(ref);
    expect(first.source).toBe('account');
    await vi.waitFor(() => expect(idb.records.get(assetId)?.owner).toBe(OWNER));
    const calls = fetch.mock.calls.length;
    const second = await loadAccountImage(ref);
    expect(second.source).toBe('local');
    expect(await bytesOf(second.blob)).toEqual(pngBytes);
    expect(fetch).toHaveBeenCalledTimes(calls);
  });

  it('a conta sem essa imagem, ou com outro arquivo sob o mesmo nome, segue como erro que dá para repetir', async () => {
    vi.stubGlobal('indexedDB', imageDatabase('ok'));
    vi.stubGlobal('fetch', accountFetch({}));
    expect(await fetchImageFromAccount(ref)).toBeNull();
    await expect(loadAccountImage(ref)).rejects.toMatchObject({ code: 'download_failed' });
    vi.stubGlobal('fetch', accountFetch({ [assetId]: PNG.replace('iVBOR', 'iVBOQ') }));
    expect(await fetchImageFromAccount(ref)).toBeNull();
  });

  it('nenhum passo da galeria lê endereço blob: com fetch', () => {
    const source = readFileSync(new URL('../../src/utils/account-images.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/origemParaBlob/);
    expect(source).not.toMatch(/hydrateProjectEntryFromCloud/);
  });
});
