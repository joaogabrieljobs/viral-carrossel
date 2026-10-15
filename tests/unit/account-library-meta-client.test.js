import { beforeEach, describe, expect, it, vi } from 'vitest';

const owner = vi.hoisted(() => ({ current: 'email:janine@example.test', locked: false, tabCurrent: true }));
const cloud = vi.hoisted(() => ({ pack: vi.fn(), hydrate: vi.fn(), upload: vi.fn() }));
vi.mock('../../src/utils/account-data-owner.js', () => ({ readDataOwner: () => owner.current }));
vi.mock('../../src/utils/storage.js', () => ({
  areAccountDataWritesLocked: () => owner.locked,
  isAccountDataWriteOwnerCurrent: () => owner.tabCurrent,
}));
vi.mock('../../src/utils/library-sync.js', () => ({
  packLibraryForCloud: cloud.pack,
  hydrateCloudBrandRoster: cloud.hydrate,
  uploadAssetsBestEffort: cloud.upload,
}));

import {
  AccountMetadataError,
  getAccountLibraryMetadata,
  isAccountMetadataEndpointUnsupported,
  migrateLocalAccountMetadataIfEmpty,
  prepareAccountLibraryMetadata,
  restoreAccountLibraryMetadata,
  saveAccountLibraryMetadata,
} from '../../src/utils/account-library-meta.js';

const opts = {
  expectedOwnerId: 'cus_janine',
  localOwnerId: 'email:janine@example.test',
};

function response(status, data) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

beforeEach(() => {
  vi.restoreAllMocks();
  owner.current = opts.localOwnerId;
  owner.locked = false;
  owner.tabCurrent = true;
  cloud.pack.mockReset().mockResolvedValue({
    manifest: {
      brands: [{ id: 'janine', logoAssetId: 'logo-1' }],
      folders: [{ id: 'clientes' }],
      activeBrandId: 'janine', activeDocId: 'clinica',
      userProfile: { name: 'João' }, onboardingDone: '1', modesIntroDone: null,
      assetIds: ['logo-1'], docs: [],
    },
    assets: new Map([['logo-1', 'data:image/png;base64,AA==']]),
    packingFailed: 0,
  });
  cloud.upload.mockReset().mockResolvedValue({ uploaded: 1, skipped: 0, failed: 0 });
  cloud.hydrate.mockReset().mockResolvedValue({ brands: [{ id: 'janine', logo: 'local-logo' }], assetsMissing: 0 });
  vi.stubGlobal('fetch', vi.fn());
});

describe('metadados globais por conta no cliente', () => {
  it('lê a nuvem antes de qualquer envio e hidrata logos sem documentos', async () => {
    fetch.mockResolvedValue(response(200, {
      ok: true, revision: 7, updatedAt: 100,
      metadata: { brands: [{ id: 'janine', logoAssetId: 'logo-1' }], folders: [{ id: 'clientes' }] },
    }));
    const restored = await restoreAccountLibraryMetadata({ ...opts, localBrands: [{ id: 'janine' }] });
    expect(restored).toMatchObject({
      revision: 7,
      metadata: { brands: [{ id: 'janine', logo: 'local-logo' }], folders: [{ id: 'clientes' }] },
    });
    expect(cloud.hydrate).toHaveBeenCalledWith([{ id: 'janine', logoAssetId: 'logo-1' }], {
      signal: undefined, localBrands: [{ id: 'janine' }], localAssets: undefined,
    });
    expect(cloud.pack).not.toHaveBeenCalled();
    expect(cloud.upload).not.toHaveBeenCalled();
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'include' });
    expect(fetch.mock.calls[0][1].headers['X-Account-Owner']).toBe('cus_janine');
  });

  it('salva marcas e perfil com revisão conhecida depois de enviar seus logos', async () => {
    fetch.mockResolvedValue(response(200, {
      ok: true, revision: 4, updatedAt: 120,
      metadata: { brands: [{ id: 'janine' }], folders: [{ id: 'clientes' }] },
    }));
    const saved = await saveAccountLibraryMetadata({
      brandRoster: [{ id: 'janine' }], libraryFolders: [{ id: 'clientes' }],
      activeBrandId: 'janine', activeDocId: 'clinica', userProfile: { name: 'João' },
    }, { ...opts, baseRevision: 3 });
    expect(saved.revision).toBe(4);
    expect(saved.assetsUploaded).toBe(1);
    expect(cloud.pack).toHaveBeenCalledWith({
      library: [], deletedIds: [],
      brandRoster: [{ id: 'janine' }], libraryFolders: [{ id: 'clientes' }],
      activeBrandId: 'janine', activeDocId: 'clinica',
    });
    expect(cloud.upload).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ baseRevision: 3, metadata: {
      brands: [{ id: 'janine' }], folders: [{ id: 'clientes' }], userProfile: { name: 'João' },
    } });
    expect(body.metadata).not.toHaveProperty('docs');
    expect(body.metadata).not.toHaveProperty('deletedIds');
    expect(fetch.mock.calls[0][1].headers['X-Account-Owner']).toBe('cus_janine');
  });

  it('não sobrescreve a nuvem quando recebe 409; reporta a revisão atual', async () => {
    fetch.mockResolvedValue(response(409, {
      error: 'Dados mais recentes na nuvem.', code: 'account_meta_conflict', cloudRevision: 8,
    }));
    await expect(saveAccountLibraryMetadata({}, { ...opts, baseRevision: 3 }))
      .rejects.toMatchObject({ status: 409, code: 'account_meta_conflict', cloudRevision: 8 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].method).toBe('PUT');
  });

  it('preserva textos e pastas quando a logo remota está ausente', async () => {
    fetch.mockResolvedValue(response(200, {
      ok: true, revision: 2, metadata: {
        brands: [{ id: 'janine', name: 'Clínica Janine', logoAssetId: 'missing' }],
        folders: [{ id: 'clientes' }], userProfile: { name: 'João' },
      },
    }));
    cloud.hydrate.mockResolvedValue({
      brands: [{ id: 'janine', name: 'Clínica Janine', logoAssetId: 'missing' }], assetsMissing: 1,
    });
    const restored = await restoreAccountLibraryMetadata(opts);
    expect(restored.assetsMissing).toBe(1);
    expect(restored.metadata.brands[0].name).toBe('Clínica Janine');
    expect(restored.metadata.userProfile.name).toBe('João');
  });

  it('bloqueia troca de conta, lock de logout e versão desconhecida', async () => {
    await expect(saveAccountLibraryMetadata({}, opts))
      .rejects.toMatchObject({ code: 'account_meta_bad_revision' });
    owner.locked = true;
    await expect(saveAccountLibraryMetadata({}, { ...opts, baseRevision: 0 }))
      .rejects.toMatchObject({ code: 'account_meta_locked' });
    owner.locked = false;
    owner.current = 'email:other@example.test';
    await expect(getAccountLibraryMetadata(opts))
      .rejects.toMatchObject({ code: 'account_meta_owner_changed' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('descarta uma resposta tardia após troca de conta', async () => {
    fetch.mockImplementation(async () => {
      owner.current = 'email:other@example.test';
      return response(200, { ok: true, revision: 1, metadata: { brands: [] } });
    });
    await expect(getAccountLibraryMetadata(opts))
      .rejects.toMatchObject({ code: 'account_meta_owner_changed' });
  });

  it('distingue endpoint antigo de falha real no banco', async () => {
    expect(isAccountMetadataEndpointUnsupported(new AccountMetadataError('404', { status: 404 }))).toBe(true);
    expect(isAccountMetadataEndpointUnsupported(new AccountMetadataError('405', { status: 405 }))).toBe(true);
    expect(isAccountMetadataEndpointUnsupported(new AccountMetadataError('offline', { status: 503 }))).toBe(false);
    await expect(prepareAccountLibraryMetadata({}, { localOwnerId: opts.localOwnerId }))
      .resolves.toMatchObject({ metadata: { brands: [{ id: 'janine' }] } });
  });

  it('não reenvia marcas locais antigas quando a nuvem já possui dados ou exclusão intencional', async () => {
    fetch.mockResolvedValueOnce(response(200, {
      ok: true, revision: 3, metadata: { brands: [{ id: 'remote' }], folders: [] },
    }));
    const current = await migrateLocalAccountMetadataIfEmpty({ brandRoster: [{ id: 'stale' }] }, opts);
    expect(current.migrated).toBe(false);
    expect(cloud.pack).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);

    fetch.mockResolvedValueOnce(response(200, {
      ok: true, revision: 4, metadata: { brands: [], folders: [] },
    }));
    const deleted = await migrateLocalAccountMetadataIfEmpty({ brandRoster: [{ id: 'stale' }] }, opts);
    expect(deleted.migrated).toBe(false);
    expect(cloud.pack).not.toHaveBeenCalled();
  });

  it('migra cache local somente para conta vazia com revisão zero', async () => {
    fetch
      .mockResolvedValueOnce(response(200, { ok: true, revision: 0, metadata: { brands: [], folders: [] } }))
      .mockResolvedValueOnce(response(200, { ok: true, revision: 1, metadata: { brands: [{ id: 'janine' }], folders: [] } }))
      .mockResolvedValueOnce(response(200, { ok: true, revision: 1, metadata: { brands: [{ id: 'janine' }], folders: [] } }));
    const result = await migrateLocalAccountMetadataIfEmpty({ brandRoster: [{ id: 'janine' }] }, opts);
    expect(result.migrated).toBe(true);
    expect(fetch.mock.calls.map(([, request]) => request.method)).toEqual(['GET', 'PUT', 'GET']);
    expect(JSON.parse(fetch.mock.calls[1][1].body).baseRevision).toBe(0);
  });

  it('perde a corrida de migração sem sobrescrever a conta vencedora', async () => {
    fetch
      .mockResolvedValueOnce(response(200, { ok: true, revision: 0, metadata: { brands: [], folders: [] } }))
      .mockResolvedValueOnce(response(409, { code: 'account_meta_conflict', cloudRevision: 1 }))
      .mockResolvedValueOnce(response(200, { ok: true, revision: 1, metadata: { brands: [{ id: 'winner' }] } }));
    const result = await migrateLocalAccountMetadataIfEmpty({ brandRoster: [{ id: 'stale' }] }, opts);
    expect(result.migrated).toBe(false);
    expect(result.metadata.brands).toEqual([{ id: 'winner' }]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
