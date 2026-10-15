import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ProjectApiError, deleteProject, getProject, isProjectConflict,
  listProjects, listProjectsPage, putProject,
} from '../../src/utils/projects-client.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status });
}

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('cliente de projetos por conta', () => {
  it('percorre todas as páginas e envia a identidade canônica ao servidor', async () => {
    fetch.mockResolvedValueOnce(json({
      ok: true, projects: [{ id: 'a', version: 1 }], nextCursor: 'next:1', total: 2,
    })).mockResolvedValueOnce(json({
      ok: true, projects: [{ id: 'b', version: 3 }], nextCursor: null, total: 2,
    }));
    const rows = await listProjects({ limit: 1, expectedOwnerId: 'cus_alice' });
    expect(rows.map((row) => row.id)).toEqual(['a', 'b']);
    expect(fetch.mock.calls[0][0]).toBe('/api/projects?limit=1');
    expect(fetch.mock.calls[1][0]).toBe('/api/projects?limit=1&cursor=next%3A1');
    expect(fetch.mock.calls[0][1]).toMatchObject({
      credentials: 'include', cache: 'no-store', headers: { 'X-Project-Owner': 'cus_alice' },
    });
  });

  it('expõe total e não aceita cursor repetido ou resposta parcial inválida', async () => {
    fetch.mockResolvedValueOnce(json({ ok: true, projects: [], nextCursor: null, total: 0 }));
    expect(await listProjectsPage()).toMatchObject({ projects: [], total: 0 });
    fetch.mockReset().mockImplementation(async () => json({ ok: true, projects: [], nextCursor: 'same' }));
    await expect(listProjects()).rejects.toMatchObject({ code: 'project_bad_cursor' });
    fetch.mockReset().mockResolvedValue(json({ ok: true, nextCursor: null }));
    await expect(listProjectsPage()).rejects.toMatchObject({ code: 'project_bad_response' });
  });

  it('grava, lê e exclui com versão base, opId e cookie da conta', async () => {
    const entry = { id: 'clinica', name: 'Clínica', doc: { slides: [{ title: 'Olá' }] } };
    const saved = { id: 'clinica', entry, version: 7 };
    fetch.mockResolvedValueOnce(json({ ok: true, project: saved }))
      .mockResolvedValueOnce(json({ ok: true, project: saved }))
      .mockResolvedValueOnce(json({ ok: true, project: { id: 'clinica', version: 8, deleted: true } }));
    expect(await putProject(entry, { baseVersion: 6, opId: 'op-1', expectedOwnerId: 'cus_a' })).toEqual(saved);
    expect(await getProject('clinica')).toEqual(saved);
    expect(await deleteProject('clinica', { baseVersion: 7, opId: 'op-2', expectedOwnerId: 'cus_a' }))
      .toMatchObject({ version: 8, deleted: true });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ entry, baseVersion: 6, opId: 'op-1' });
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ id: 'clinica', baseVersion: 7, opId: 'op-2' });
    expect(fetch.mock.calls[2][1].headers['X-Project-Owner']).toBe('cus_a');
    expect(fetch.mock.calls[1][0]).toBe('/api/projects?id=clinica');
  });

  it('distingue 404 de conflito, erro de rede e troca de conta', async () => {
    fetch.mockResolvedValueOnce(json({ error: 'Não encontrado', code: 'project_not_found' }, 404));
    expect(await getProject('none')).toBeNull();
    fetch.mockResolvedValueOnce(json({ error: 'Conflito', code: 'project_conflict', cloudVersion: 12 }, 409));
    let conflict;
    try { await putProject({ id: 'a' }, { baseVersion: 1 }); } catch (error) { conflict = error; }
    expect(conflict).toBeInstanceOf(ProjectApiError);
    expect(conflict).toMatchObject({ status: 409, code: 'project_conflict', cloudVersion: 12 });
    expect(isProjectConflict(conflict)).toBe(true);
    fetch.mockResolvedValueOnce(json({ error: 'Outra conta', code: 'project_owner_changed' }, 409));
    await expect(deleteProject('a', { baseVersion: 1 })).rejects.toMatchObject({
      code: 'project_owner_changed', status: 409,
    });
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(getProject('a')).rejects.toMatchObject({ code: 'project_network_error' });
  });

  it('rejeita entradas inválidas antes de chamar a API', async () => {
    await expect(putProject({ id: '../other' }, { baseVersion: 0 })).rejects.toMatchObject({ code: 'project_bad_id' });
    await expect(deleteProject('valid', { baseVersion: -1 })).rejects.toMatchObject({ code: 'project_bad_version' });
    await expect(listProjectsPage({ limit: 101 })).rejects.toMatchObject({ code: 'project_bad_limit' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
