import { describe, expect, it, vi } from 'vitest';
import {
  cloudSaveContinuation, decideCloudAutoPush, isProjectOutboxUnavailable, putProjectDirectly,
  selectRestoredProjectId,
} from '../../src/utils/project-sync-control.js';

describe('gatilho de salvamento automático', () => {
  it('não reenvia o mesmo conteúdo quando o botão deixa de estar ocupado', () => {
    const first = decideCloudAutoPush({ key: 'edit-1', lastKey: 'boot', dirty: true, inFlight: false });
    expect(first).toMatchObject({ lastKey: 'edit-1', schedule: true, defer: false });
    expect(decideCloudAutoPush({
      key: 'edit-1', lastKey: first.lastKey, dirty: false, inFlight: false,
    })).toMatchObject({ schedule: false, defer: false });
  });

  it('adia uma nova edição feita durante o envio sem confundir hidratação com edição', () => {
    expect(decideCloudAutoPush({
      key: 'media-hydrated', lastKey: 'boot', dirty: false, inFlight: true,
    })).toMatchObject({ schedule: false, defer: false });
    expect(decideCloudAutoPush({
      key: 'edit-2', lastKey: 'edit-1', dirty: true, inFlight: true,
    })).toMatchObject({ schedule: false, defer: true });
  });
});

describe('edições durante um envio confirmado', () => {
  it('continua autosave e Salvar sem transformar edição sucessora em conflito', () => {
    for (const source of ['auto', 'salvar', 'profile']) {
      expect(cloudSaveContinuation({ source, current: false, sameOwner: true })).toBe('send_latest');
    }
    for (const source of ['sync', 'logout']) {
      expect(cloudSaveContinuation({ source, current: false, sameOwner: true })).toBe('changed_before_restore');
    }
    expect(cloudSaveContinuation({ source: 'auto', current: true, sameOwner: false })).toBe('owner_changed');
    expect(cloudSaveContinuation({ source: 'auto', current: true, sameOwner: true })).toBe('confirmed');
  });
});

describe('projeto selecionado ao restaurar a conta', () => {
  const library = [{ id: 'copy', conflictSourceId: 'original' }, { id: 'original' }, { id: 'other' }];
  it('mantém o projeto escolhido mesmo se uma cópia é a primeira ou o metadata é antigo', () => {
    expect(selectRestoredProjectId({ library, preferredId: 'original', metadataActiveId: 'other', manifestActiveId: 'copy' }))
      .toBe('original');
    expect(selectRestoredProjectId({ library })).toBe('original');
  });
  it('respeita a cópia escolhida explicitamente e faz fallback se o anterior foi excluído', () => {
    expect(selectRestoredProjectId({ library, preferredId: 'copy' })).toBe('copy');
    expect(selectRestoredProjectId({ library, preferredId: 'deleted', metadataActiveId: 'other' })).toBe('other');
    expect(selectRestoredProjectId({ library: [] })).toBe('');
  });
});

describe('salvamento sem IndexedDB', () => {
  const entry = { id: 'janine', name: 'Clínica', doc: { title: 'Nova versão' }, updatedAt: 123 };
  const options = {
    baseVersion: 4,
    expectedOwnerId: 'cus_janine',
    fingerprint: ({ updatedAt: _timestamp, ...content }) => JSON.stringify(content),
    isProjectConflict: (error) => error?.code === 'project_conflict',
  };

  it('usa PUT versionado e só retorna após confirmação do servidor', async () => {
    const receipt = { id: 'janine', version: 5, entry };
    const putProject = vi.fn().mockResolvedValue(receipt);
    const getProject = vi.fn();
    await expect(putProjectDirectly(entry, { ...options, putProject, getProject })).resolves.toBe(receipt);
    expect(putProject).toHaveBeenCalledWith(entry, {
      baseVersion: 4, expectedOwnerId: 'cus_janine',
    });
    expect(getProject).not.toHaveBeenCalled();
  });

  it('reconhece resposta perdida somente com mesma versão e conteúdo remoto', async () => {
    const conflict = Object.assign(new Error('Conflito'), { code: 'project_conflict' });
    const putProject = vi.fn().mockRejectedValue(conflict);
    const remote = { id: 'janine', version: 5, entry: { ...entry, updatedAt: 999 } };
    await expect(putProjectDirectly(entry, {
      ...options, putProject, getProject: vi.fn().mockResolvedValue(remote),
    })).resolves.toBe(remote);
    await expect(putProjectDirectly(entry, {
      ...options, putProject,
      getProject: vi.fn().mockResolvedValue({ ...remote, entry: { ...entry, doc: { title: 'Outro texto' } } }),
    })).rejects.toBe(conflict);
  });

  it('não ressuscita projeto excluído nem transforma erro de rede em sucesso', async () => {
    const deleted = Object.assign(new Error('Excluído'), { code: 'project_deleted' });
    const putProject = vi.fn().mockRejectedValue(deleted);
    const getProject = vi.fn();
    await expect(putProjectDirectly(entry, { ...options, putProject, getProject })).rejects.toBe(deleted);
    expect(getProject).not.toHaveBeenCalled();
    expect(isProjectOutboxUnavailable({ code: 'project_outbox_timeout' })).toBe(true);
    expect(isProjectOutboxUnavailable({ name: 'QuotaExceededError' })).toBe(true);
    expect(isProjectOutboxUnavailable({ code: 'project_network_error' })).toBe(false);
  });
});
