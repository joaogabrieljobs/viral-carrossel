import { describe, expect, it, vi } from 'vitest';
import {
  decideCloudAutoPush, isProjectOutboxUnavailable, putProjectDirectly,
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
