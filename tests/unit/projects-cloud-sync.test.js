import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { originalImageAssetId } from '../../src/utils/cloud-image-assets.js';
import { bindAccountDataWriteOwner, SK, unlockAccountDataWrites } from '../../src/utils/storage.js';
import {
  prepareProjectCloudPayload, saveProjectEntryToCloud,
} from '../../src/utils/projects-cloud-sync.js';

const OWNER = 'email:alice@example.test';
const EXPECTED_OWNER = 'cus_alice';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status });
}

function entry(slides = [{ id: 's1', title: 'Cuidado com a pele' }]) {
  return {
    id: 'janine', name: 'Clínica Janine', folderId: 'clinic', updatedAt: 12,
    doc: { slides, styleKit: { refImages: [] } },
  };
}

function opts(overrides = {}) {
  return {
    ownerId: OWNER, expectedOwnerId: EXPECTED_OWNER, baseVersion: 4,
    snapshot: {
      activeBrandId: 'brand-1',
      brandRoster: [{ id: 'brand-1', name: 'Clínica Janine' }, { id: 'other-brand', name: 'Outra' }],
      libraryFolders: [{ id: 'clinic', name: 'Clínicas' }, { id: 'other', name: 'Outra' }],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', storage());
  vi.stubGlobal('sessionStorage', storage());
  localStorage.setItem(SK.dataOwner, JSON.stringify(OWNER));
  bindAccountDataWriteOwner(OWNER, { switchedHere: true });
  unlockAccountDataWrites();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  unlockAccountDataWrites();
  vi.unstubAllGlobals();
});

describe('salvamento incremental por projeto', () => {
  it('empacota só o projeto ativo e o contexto correspondente', async () => {
    const packed = await prepareProjectCloudPayload(entry(), opts());
    expect(packed.entry.id).toBe('janine');
    expect(packed.entry.doc.brand).toMatchObject({ id: 'brand-1', name: 'Clínica Janine' });
    expect(packed.accountContext).toEqual({
      brands: [{ id: 'brand-1', name: 'Clínica Janine', logo: null }],
      folders: [{ id: 'clinic', name: 'Clínicas' }],
    });
    expect(packed.assets.size).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('envia a foto antes de confirmar somente um projeto e sua versão', async () => {
    const image = 'data:image/png;base64,Y2xpbmljYS1qYW5pbmU=';
    const assetId = await originalImageAssetId(image);
    fetch.mockImplementation(async (url, request) => {
      if (url === '/api/library-sync') return json({ ok: true, assetId });
      if (url === '/api/projects') {
        const body = JSON.parse(request.body);
        return json({ ok: true, project: { id: 'janine', entry: body.entry, version: 5 } });
      }
      throw new Error(`Pedido inesperado: ${url}`);
    });
    const result = await saveProjectEntryToCloud(opts({
      entry: entry([{ id: 's1', title: 'Texto novo', bgImage: image }]),
    }));
    expect(result).toMatchObject({ ok: true, version: 5, assetsUploaded: 1 });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/api/library-sync', '/api/projects']);
    const assetBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(assetBody).toMatchObject({ action: 'putAsset', assetId, dataUrl: image });
    const projectRequest = fetch.mock.calls[1][1];
    expect(projectRequest.headers['X-Project-Owner']).toBe(EXPECTED_OWNER);
    const body = JSON.parse(projectRequest.body);
    expect(body.baseVersion).toBe(4);
    expect(body.entry.doc.slides[0]).toMatchObject({
      title: 'Texto novo', bgImage: null, bgImageAssetId: assetId,
    });
    expect(JSON.stringify(body)).not.toContain(image);
    expect(body.entry.doc.brand.name).toBe('Clínica Janine');
  });

  it('não envia o projeto se a foto não foi confirmada', async () => {
    fetch.mockResolvedValue(json({ error: 'Falha no armazenamento.' }, 503));
    await expect(saveProjectEntryToCloud(opts({
      entry: entry([{ id: 's1', bgImage: 'data:image/png;base64,Y2xpbmljYS1mYWxoYQ==' }]),
    }))).rejects.toMatchObject({ code: 'project_asset_upload_failed' });
    expect(fetch.mock.calls.every(([url]) => url === '/api/library-sync')).toBe(true);
  });

  it('propaga conflito de versão sem substituir a edição de outro browser', async () => {
    fetch.mockResolvedValue(json({
      error: 'Projeto alterado na nuvem.', code: 'project_conflict', cloudVersion: 8,
    }, 409));
    await expect(saveProjectEntryToCloud(opts({ entry: entry() }))).rejects.toMatchObject({
      status: 409, code: 'project_conflict', cloudVersion: 8,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body).baseVersion).toBe(4);
  });

  it('exige versão conhecida e conta confirmada antes de iniciar o envio', async () => {
    await expect(saveProjectEntryToCloud(opts({ entry: entry(), baseVersion: undefined })))
      .rejects.toMatchObject({ code: 'project_bad_version' });
    await expect(saveProjectEntryToCloud(opts({ entry: entry(), expectedOwnerId: null })))
      .rejects.toMatchObject({ code: 'project_owner_unverified' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('cancela antes do PUT se a edição mudar durante o upload', async () => {
    let current = true;
    fetch.mockImplementation(async (url) => {
      if (url !== '/api/library-sync') throw new Error('O projeto não deveria ser enviado');
      current = false;
      return json({ ok: true });
    });
    await expect(saveProjectEntryToCloud(opts({
      entry: entry([{ id: 's1', bgImage: 'data:image/png;base64,Y2xpbmljYS1lZGl0YWRh' }]),
      isCurrent: () => current,
    }))).rejects.toMatchObject({ code: 'project_changed_during_sync' });
    expect(fetch.mock.calls.every(([url]) => url === '/api/library-sync')).toBe(true);
  });
});
