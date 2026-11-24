// DB-04 (auditoria de 23/11): um 409 nos dados da conta (marcas, pastas,
// perfil, ganchos, padrões) quase nunca se resolvia na aba. A comparação
// incluía o projeto aberto e a lista de imagens, que quase sempre diferem, e
// uma pasta criada em outro aparelho bastava para Salvar, Sync e Sair falharem
// até recarregar.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const owner = vi.hoisted(() => ({ current: 'email:janine@example.test' }));
const cloud = vi.hoisted(() => ({ pack: vi.fn(), hydrate: vi.fn(), upload: vi.fn() }));
vi.mock('../../src/utils/account-data-owner.js', () => ({ readDataOwner: () => owner.current }));
vi.mock('../../src/utils/storage.js', () => ({
  SK: { hookLibrary: 'vc_hook_library' },
  areAccountDataWritesLocked: () => false,
  isAccountDataWriteOwnerCurrent: () => true,
}));
vi.mock('../../src/utils/library-sync.js', () => ({
  packLibraryForCloud: cloud.pack,
  hydrateCloudBrandRoster: cloud.hydrate,
  uploadAssetsBestEffort: cloud.upload,
}));

import {
  ACCOUNT_META_CONFLICT_HELP, resolveAccountMetadataConflict, saveAccountLibraryMetadata,
} from '../../src/utils/account-library-meta.js';

import { cloudSyncFailureMessage } from '../../src/utils/cloud-sync-feedback.js';

const opts = { expectedOwnerId: 'cus_janine', localOwnerId: 'email:janine@example.test' };
const response = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const conflict = (cloudRevision) => response(409, {
  error: 'Esses dados mudaram em outro dispositivo. Atualize antes de salvar.',
  code: 'account_meta_conflict', cloudRevision,
});

// O que a conta tinha quando esta aba abriu (revisão 7).
const base = {
  brands: [{ id: 'janine', name: 'Clínica Janine', color: '#111111', logoAssetId: 'logo-1' }],
  folders: [{ id: 'clientes', name: 'Clientes', createdAt: 1 }],
  activeBrandId: 'janine', activeDocId: 'clinica', userProfile: { name: 'João' },
  onboardingDone: '1', modesIntroDone: null, assetIds: ['logo-1'],
  hookLibrary: [], customVisualPresets: [],
};

function packLocal(overrides = {}) {
  cloud.pack.mockResolvedValue({
    manifest: { ...base, docs: [], ...overrides },
    assets: new Map(), packingFailed: 0,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  cloud.pack.mockReset();
  cloud.upload.mockReset().mockResolvedValue({ uploaded: 0, skipped: 0, failed: 0 });
  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('localStorage', { getItem: () => null });
});

describe('DB-04: conflito de revisão dos dados da conta se resolve na aba', () => {
  it('pasta criada no celular + marca alterada no computador: grava as duas e conclui na revisão 9', async () => {
    // Nesta aba: a cor da marca mudou. O projeto aberto e as imagens também diferem.
    packLocal({
      brands: [{ ...base.brands[0], color: '#ff0066' }],
      activeDocId: 'outro-projeto', assetIds: ['logo-1'],
    });
    const remote = {
      ...base,
      folders: [...base.folders, { id: 'lancamentos', name: 'Lançamentos', createdAt: 2 }],
      activeDocId: 'projeto-do-celular', assetIds: ['logo-1', 'foto-do-celular'],
    };
    fetch.mockResolvedValueOnce(conflict(8))
      .mockResolvedValueOnce(response(200, { ok: true, revision: 8, updatedAt: 10, metadata: remote }))
      .mockImplementationOnce(async (_url, request) => response(200, {
        ok: true, revision: 9, updatedAt: 11, metadata: JSON.parse(request.body).metadata,
      }));
    const saved = await saveAccountLibraryMetadata({}, {
      ...opts, baseRevision: 7, resolveRevisionConflict: true, baseMetadata: base,
    });
    expect(saved.revision).toBe(9);
    const retry = JSON.parse(fetch.mock.calls[2][1].body);
    expect(retry.baseRevision).toBe(8);
    expect(retry.metadata.folders.map((folder) => folder.id)).toEqual(['clientes', 'lancamentos']);
    expect(retry.metadata.brands[0].color).toBe('#ff0066');
    // A aba precisa passar a mostrar a pasta que veio da conta.
    expect(saved.adoptedFolders.map((folder) => folder.id)).toEqual(['clientes', 'lancamentos']);
  });

  it('só o projeto aberto e a lista de imagens diferem: não é conflito de verdade', async () => {
    packLocal({ activeDocId: 'outro-projeto', assetIds: ['logo-1'] });
    const remote = { ...base, activeDocId: 'projeto-do-celular', assetIds: ['logo-1', 'foto-nova'] };
    fetch.mockResolvedValueOnce(conflict(8))
      .mockResolvedValueOnce(response(200, { ok: true, revision: 8, metadata: remote }))
      .mockResolvedValueOnce(response(200, { ok: true, revision: 9, metadata: remote }));
    // Sem a base (chamadores antigos) também resolve.
    await expect(saveAccountLibraryMetadata({}, { ...opts, baseRevision: 7, resolveRevisionConflict: true }))
      .resolves.toMatchObject({ revision: 9 });
  });

  it('a mesma marca alterada nos dois lados continua sendo conflito, sem sobrescrever', async () => {
    packLocal({ brands: [{ ...base.brands[0], color: '#ff0066' }] });
    const remote = { ...base, brands: [{ ...base.brands[0], color: '#00aa55' }] };
    fetch.mockResolvedValueOnce(conflict(8))
      .mockResolvedValueOnce(response(200, { ok: true, revision: 8, metadata: remote }));
    await expect(saveAccountLibraryMetadata({}, {
      ...opts, baseRevision: 7, resolveRevisionConflict: true, baseMetadata: base,
    })).rejects.toMatchObject({ status: 409, code: 'account_meta_conflict' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('pastas: junta o que cada lado criou, respeita a exclusão feita no outro aparelho e recusa edição dupla', () => {
    const local = { ...base, folders: [...base.folders, { id: 'aqui', name: 'Criada aqui', createdAt: 3 }] };
    const remoteAdded = { ...base, folders: [...base.folders, { id: 'la', name: 'Criada lá', createdAt: 4 }] };
    expect(resolveAccountMetadataConflict({ local, remote: remoteAdded, base }).metadata.folders.map((f) => f.id))
      .toEqual(['clientes', 'aqui', 'la']);

    const remoteDeleted = { ...base, folders: [] };
    expect(resolveAccountMetadataConflict({ local, remote: remoteDeleted, base }).metadata.folders.map((f) => f.id))
      .toEqual(['aqui']);

    const localRenamed = { ...base, folders: [{ ...base.folders[0], name: 'Clientes 2026' }] };
    const remoteRenamed = { ...base, folders: [{ ...base.folders[0], name: 'Contas' }] };
    expect(resolveAccountMetadataConflict({ local: localRenamed, remote: remoteRenamed, base })).toBeNull();
    // Renomeada só no outro aparelho: vale o nome de lá.
    expect(resolveAccountMetadataConflict({ local: base, remote: remoteRenamed, base }).metadata.folders[0].name)
      .toBe('Contas');
  });

  it('perfil alterado no outro aparelho não é sobrescrito pelo desta aba', () => {
    const remote = { ...base, userProfile: { name: 'João Silva' } };
    expect(resolveAccountMetadataConflict({ local: base, remote, base })).toBeNull();
  });

  it('o conflito real diz a saída e o que acontece com a alteração local, sem culpar os projetos', () => {
    expect(ACCOUNT_META_CONFLICT_HELP).toContain('recarregue a página');
    expect(ACCOUNT_META_CONFLICT_HELP).toContain('não será enviada');
    const error = Object.assign(new Error(ACCOUNT_META_CONFLICT_HELP), { code: 'account_meta_conflict', status: 409 });
    // Os projetos já foram confirmados: o aviso não pode dizer que a edição não chegou à conta.
    expect(cloudSyncFailureMessage(error, { localSaved: true })).toBe(ACCOUNT_META_CONFLICT_HELP);
  });
});
