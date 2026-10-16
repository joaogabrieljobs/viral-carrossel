import { describe, expect, it, vi } from 'vitest';
import { createLibraryPostgresStore } from '../../api/lib/library-sync-postgres.js';

function fakeDatabase() {
  let states = new Map();
  let projects = new Map();
  let failingCommand = '';
  const copy = (value) => structuredClone(value);
  const keyFor = (owner, id) => `${owner}\0${id}`;

  function client(currentStates, currentProjects) {
    return {
      async unsafe(query, params) {
        const operation = /\/\* (moont_\w+) \*\//.exec(query)?.[1];
        if (operation === failingCommand) throw new Error('Postgres indisponível');
        const [owner] = params;
        if (operation === 'moont_state' || operation === 'moont_locked_state') {
          const row = currentStates.get(owner);
          return row ? [copy(row)] : [];
        }
        if (operation === 'moont_insert_state') {
          if (currentStates.has(owner)) return [];
          const [, revision, updatedAt, count, nextOrder, meta, migrated] = params;
          currentStates.set(owner, {
            owner_id: owner, revision, updated_at: updatedAt, project_count: count,
            next_order: nextOrder, manifest_meta: JSON.parse(meta), migrated_from_blob: migrated,
            meta_revision: 0, meta_updated_at: 0,
          });
          return [{ owner_id: owner }];
        }
        if (operation === 'moont_update_state') {
          const [, revision, updatedAt, count, nextOrder, meta] = params;
          const state = currentStates.get(owner);
          const nextMeta = JSON.parse(meta);
          const metaChanged = JSON.stringify(state.manifest_meta) !== JSON.stringify(nextMeta);
          currentStates.set(owner, {
            ...state, revision, updated_at: updatedAt, project_count: count,
            next_order: nextOrder, manifest_meta: nextMeta,
            meta_revision: state.meta_revision + (metaChanged ? 1 : 0),
            meta_updated_at: metaChanged ? updatedAt : state.meta_updated_at,
          });
          return [];
        }
        if (operation === 'moont_update_metadata_state') {
          const [, revision, updatedAt, metaRevision, meta] = params;
          currentStates.set(owner, {
            ...currentStates.get(owner), revision, updated_at: updatedAt,
            meta_revision: metaRevision, meta_updated_at: updatedAt,
            manifest_meta: JSON.parse(meta),
          });
          return [];
        }
        if (operation === 'moont_upsert_projects') {
          for (const row of JSON.parse(params[1])) currentProjects.set(keyFor(owner, row.project_id), copy(row));
          return [];
        }
        if (operation === 'moont_all_projects') {
          return [...currentProjects.entries()]
            .filter(([key]) => key.startsWith(`${owner}\0`))
            .map(([, row]) => copy(row))
            .sort((a, b) => a.sort_order - b.sort_order || a.project_id.localeCompare(b.project_id));
        }
        if (operation === 'moont_delete_agent_visual_jobs') return [];
        if (operation === 'moont_one_project') {
          const row = currentProjects.get(keyFor(owner, params[1]));
          return row ? [copy(row)] : [];
        }
        if (operation === 'moont_page') {
          const [, cursorTime, cursorOrder, limit] = params;
          return [...currentProjects.entries()]
            .filter(([key, row]) => key.startsWith(`${owner}\0`) && row.deleted_at == null)
            .map(([, row]) => copy(row))
            .filter((row) => cursorTime == null
              || row.updated_at < cursorTime
              || (row.updated_at === cursorTime && row.sort_order < cursorOrder))
            .sort((a, b) => b.updated_at - a.updated_at || b.sort_order - a.sort_order)
            .slice(0, limit)
            .map((row) => ({
              ...row,
              entry: Object.fromEntries(Object.entries(row.entry).filter(([name]) => name !== 'doc')),
              slide_count: Array.isArray(row.entry.doc?.slides) ? row.entry.doc.slides.length : 0,
            }));
        }
        throw new Error(`Query desconhecida: ${operation}`);
      },
      async begin(options, callback) {
        const action = typeof options === 'function' ? options : callback;
        const nextStates = new Map([...currentStates].map(([key, value]) => [key, copy(value)]));
        const nextProjects = new Map([...currentProjects].map(([key, value]) => [key, copy(value)]));
        const result = await action(client(nextStates, nextProjects));
        currentStates.clear();
        currentProjects.clear();
        for (const [key, value] of nextStates) currentStates.set(key, value);
        for (const [key, value] of nextProjects) currentProjects.set(key, value);
        return result;
      },
    };
  }

  return {
    sql: client(states, projects),
    failOn(command) { failingCommand = command; },
    snapshot() { return { states: copy([...states]), projects: copy([...projects]) }; },
  };
}

function store(db, legacy = vi.fn(async () => null)) {
  let timestamp = 1_000;
  return createLibraryPostgresStore({
    sql: db.sql, readLegacyManifest: legacy, now: () => ++timestamp,
  });
}

describe('biblioteca Postgres por conta', () => {
  it('importa o manifesto Blob uma vez e preserva documentos, metadados e exclusões', async () => {
    const db = fakeDatabase();
    const legacy = vi.fn(async (owner) => owner === 'cus_janine' ? {
      revision: 12, updatedAt: 900,
      docs: [
        { id: 'clinica', name: 'Clínica Janine', updatedAt: 800,
          doc: { slides: Array.from({ length: 23 }, (_, i) => ({ id: `card-${i}` })) } },
        { id: 'apagado', name: 'Não deve voltar', doc: {} },
      ],
      deletedIds: ['apagado'],
      folders: [{ id: 'folder-1', name: 'Clientes' }],
      brands: [{ id: 'brand-1', name: 'Janine' }],
      assetIds: ['original_abc'], activeDocId: 'clinica', userProfile: { name: 'João' },
    } : null);
    const adapter = store(db, legacy);

    expect(await adapter.getLibrarySyncMeta('cus_janine')).toMatchObject({
      revision: 12, projectCount: 1, assetIds: ['original_abc'], storage: 'postgres',
    });
    const restored = await adapter.getLibraryManifest('cus_janine');
    expect(restored.docs).toHaveLength(1);
    expect(restored.docs[0].doc.slides).toHaveLength(23);
    expect(restored.deletedIds).toEqual(['apagado']);
    expect(restored.folders[0].name).toBe('Clientes');
    expect(restored.brands[0].name).toBe('Janine');
    expect(restored.userProfile.name).toBe('João');
    expect(await adapter.getAccountProject('cus_janine', 'apagado')).toBeNull();
    expect(legacy).toHaveBeenCalledTimes(1);

    expect(await adapter.getLibrarySyncMeta('cus_other')).toBeNull();
    expect(await adapter.getAccountProject('cus_other', 'clinica')).toBeNull();
    expect(legacy).toHaveBeenCalledTimes(2);
  });

  it('faz merge por ID e mantém tombstones contra um navegador antigo', async () => {
    const db = fakeDatabase();
    const adapter = store(db);
    await adapter.putLibraryManifest('cus_merge', {
      docs: [{ id: 'clinica', name: 'Janine', updatedAt: 1 },
        { id: 'old', name: 'Antigo', updatedAt: 1 }],
      brands: [{ id: 'brand', updatedAt: 1 }], assetIds: ['image1'],
    });
    const second = await adapter.putLibraryManifest('cus_merge', {
      docs: [{ id: 'new', name: 'Novo', updatedAt: 2 }], assetIds: ['image2'],
      deletedIds: ['old'],
    });
    expect(second.meta).toMatchObject({ revision: 2, projectCount: 2,
      assetIds: ['image1', 'image2'] });
    expect(second.manifest.docs.map((entry) => entry.id)).toEqual(['clinica', 'new']);
    expect(second.manifest.deletedIds).toEqual(['old']);
    expect(second.manifest.brands).toHaveLength(1);

    const stale = await adapter.putLibraryManifest('cus_merge', {
      docs: [{ id: 'old', name: 'Ressuscitar', updatedAt: 100_000 }], deletedIds: [],
    }, { force: true });
    expect(stale.manifest.docs.map((entry) => entry.id)).toEqual(['clinica', 'new']);
    expect(stale.manifest.deletedIds).toEqual(['old']);
    expect(stale.meta.projectCount).toBe(2);
    await expect(adapter.putLibraryManifest('cus_merge', { docs: [] }, { baseRevision: 1 }))
      .rejects.toMatchObject({ code: 'library_conflict', cloudRevision: 3 });
  });

  it('push legado não reverte perfil ou marcas da rota v2 durante o cutover', async () => {
    const adapter = store(fakeDatabase());
    await adapter.putAccountProject('cus_cutover', {
      id: 'janine', name: 'Janine', doc: { slides: [{ id: 'a' }] },
    }, { baseVersion: 0 });
    await adapter.putAccountLibraryMeta('cus_cutover', {
      brands: [{ id: 'brand', name: 'Marca nova' }],
      folders: [{ id: 'folder', name: 'Pasta nova' }],
      userProfile: { name: 'Atual' },
    }, { baseRevision: 0 });
    const result = await adapter.putLibraryManifest('cus_cutover', {
      docs: [{ id: 'outro', name: 'Projeto antigo', updatedAt: 2 }],
      brands: [{ id: 'brand', name: 'Marca antiga' }],
      folders: [{ id: 'folder', name: 'Pasta antiga' }],
      userProfile: { name: 'Antigo' },
      assetIds: ['image_old'],
    }, { preserveAccountMetadata: true });
    expect(result.manifest.docs.map((entry) => entry.id)).toEqual(['janine', 'outro']);
    expect(result.manifest.brands[0].name).toBe('Marca nova');
    expect(result.manifest.folders[0].name).toBe('Pasta nova');
    expect(result.manifest.userProfile.name).toBe('Atual');
    expect(result.meta.assetIds).toContain('image_old');
  });

  it('suporta escrita granular versionada, exclusão, paginação leve e isolamento', async () => {
    const db = fakeDatabase();
    const adapter = store(db);
    const first = await adapter.putAccountProject('cus_a', {
      id: 'one', name: 'Primeiro', doc: { slides: [{ id: 'card-1' }] },
    }, { baseVersion: 0 });
    expect(first).toMatchObject({ id: 'one', version: 1, deleted: false });
    await adapter.putAccountProject('cus_a', { id: 'two', name: 'Segundo', doc: { slides: [] } }, { baseVersion: 0 });
    await adapter.putAccountProject('cus_a', { id: 'three', name: 'Terceiro' }, { baseVersion: 0 });
    await expect(adapter.putAccountProject('cus_a', { id: 'one', name: 'Stale' }, { baseVersion: 0 }))
      .rejects.toMatchObject({ code: 'project_conflict', cloudVersion: 1 });

    const page1 = await adapter.listAccountProjects('cus_a', { limit: 2 });
    expect(page1.total).toBe(3);
    expect(page1.projects.map((project) => project.id)).toEqual(['three', 'two']);
    expect(page1.projects[0].entry).not.toHaveProperty('doc');
    const page2 = await adapter.listAccountProjects('cus_a', { limit: 2, cursor: page1.nextCursor });
    expect(page2.projects.map((project) => project.id)).toEqual(['one']);
    expect(page2.projects[0].slideCount).toBe(1);
    expect(page2.nextCursor).toBeNull();
    expect((await adapter.getAccountProject('cus_a', 'one')).entry.doc.slides).toHaveLength(1);
    expect(await adapter.getAccountProject('cus_b', 'one')).toBeNull();

    const updated = await adapter.putAccountProject('cus_a', {
      id: 'one', name: 'Editado', doc: { slides: [{ id: 'card-1' }, { id: 'card-2' }] },
    }, { baseVersion: 1 });
    expect(updated.version).toBe(2);
    const deleted = await adapter.deleteAccountProject('cus_a', 'one', { baseVersion: 2 });
    expect(deleted).toMatchObject({ version: 3, deleted: true, entry: null });
    await expect(adapter.putAccountProject('cus_a', { id: 'one', name: 'Voltou' }, { baseVersion: 0 }))
      .rejects.toMatchObject({ code: 'project_deleted', cloudVersion: 3 });
    await expect(adapter.putAccountProject('cus_a', { id: 'one', name: 'Voltou' }, { baseVersion: 3 }))
      .rejects.toMatchObject({ code: 'project_deleted', cloudVersion: 3 });
    expect((await adapter.getLibraryManifest('cus_a')).deletedIds).toContain('one');
    expect((await adapter.listAccountProjects('cus_a')).total).toBe(2);
  });

  it('não confirma escrita parcial após falha do banco nem transforma falha em vazio', async () => {
    const db = fakeDatabase();
    const legacy = vi.fn(async () => null);
    const adapter = store(db, legacy);
    await adapter.putAccountProject('cus_safe', { id: 'keep', doc: { slides: [] } }, { baseVersion: 0 });
    const before = db.snapshot();
    db.failOn('moont_upsert_projects');
    await expect(adapter.putLibraryManifest('cus_safe', {
      docs: [{ id: 'new', doc: {} }], deletedIds: ['keep'],
    })).rejects.toMatchObject({ code: 'library_storage_unavailable' });
    expect(db.snapshot()).toEqual(before);

    db.failOn('moont_state');
    await expect(adapter.getLibrarySyncMeta('cus_safe'))
      .rejects.toMatchObject({ code: 'library_storage_unavailable' });
    expect(legacy).toHaveBeenCalledTimes(1);
  });

  it('não marca conta como migrada se a leitura do Blob legado falha', async () => {
    const db = fakeDatabase();
    const legacy = vi.fn().mockRejectedValue(new Error('Blob temporariamente indisponível'));
    const adapter = store(db, legacy);
    await expect(adapter.getLibrarySyncMeta('cus_existing'))
      .rejects.toMatchObject({ code: 'library_storage_unavailable' });
    expect(db.snapshot().states).toEqual([]);
    expect(legacy).toHaveBeenCalledTimes(1);
  });

  it('expõe apenas dados globais da conta e preserva os 23 cards ao editar perfil e pastas', async () => {
    const db = fakeDatabase();
    const adapter = store(db, vi.fn(async (owner) => owner === 'cus_janine' ? ({
      revision: 9, updatedAt: 900,
      docs: [{ id: 'clinica', name: 'Janine',
        doc: { slides: Array.from({ length: 23 }, (_, i) => ({ id: `slide-${i}` })) } }],
      brands: [{ id: 'janine', name: 'Clínica Janine' }],
      folders: [{ id: 'clientes', name: 'Clientes' }],
      userProfile: { name: 'João' }, onboardingDone: '1',
      assetIds: ['image_old'],
    }) : null));
    const before = await adapter.getAccountLibraryMeta('cus_janine');
    expect(before).toMatchObject({
      revision: 0, metadata: {
        brands: [{ id: 'janine' }], folders: [{ id: 'clientes' }],
        userProfile: { name: 'João' }, onboardingDone: '1',
      },
    });
    expect(before.metadata).not.toHaveProperty('docs');

    const updated = await adapter.putAccountLibraryMeta('cus_janine', {
      userProfile: { name: 'João Gabriel' },
      folders: [{ id: 'clientes', name: 'Clientes premium' }],
      assetIds: ['image_new'],
    }, { baseRevision: before.revision });
    expect(updated.revision).toBe(1);
    expect(updated.metadata).toMatchObject({
      brands: [{ id: 'janine' }],
      folders: [{ id: 'clientes', name: 'Clientes premium' }],
      userProfile: { name: 'João Gabriel' },
      assetIds: ['image_old', 'image_new'],
    });
    expect((await adapter.getLibraryManifest('cus_janine')).docs[0].doc.slides).toHaveLength(23);
    expect((await adapter.getAccountLibraryMeta('cus_other')).metadata.brands).toEqual([]);
    expect((await adapter.getAccountProject('cus_other', 'clinica'))).toBeNull();
  });

  it('retorna 409 em metadados desatualizados sem confundir gravação de projeto com edição global', async () => {
    const db = fakeDatabase();
    const adapter = store(db);
    await adapter.putAccountProject('cus_a', { id: 'one', doc: { slides: [] } }, { baseVersion: 0 });
    const initial = await adapter.getAccountLibraryMeta('cus_a');
    expect(initial.revision).toBe(0);
    await adapter.putAccountProject('cus_a', { id: 'one', doc: { slides: [{ id: 'card' }] } }, { baseVersion: 1 });
    expect((await adapter.getAccountLibraryMeta('cus_a')).revision).toBe(0);

    await adapter.putAccountLibraryMeta('cus_a', { brands: [{ id: 'brand', name: 'Nova' }] },
      { baseRevision: 0 });
    await adapter.putAccountProject('cus_a', { id: 'one', doc: { slides: [{ id: 'card-2' }] } },
      { baseVersion: 2 });
    expect((await adapter.getAccountLibraryMeta('cus_a')).revision).toBe(1);
    await expect(adapter.putAccountLibraryMeta('cus_a', { folders: [] }, { baseRevision: 0 }))
      .rejects.toMatchObject({ code: 'account_meta_conflict', cloudRevision: 1 });
    expect((await adapter.getAccountLibraryMeta('cus_a')).metadata.folders).toEqual([]);

    // Um sync legado que altera metadados também deve invalidar edição stale.
    await adapter.putLibraryManifest('cus_a', { docs: [], activeBrandId: 'brand' });
    await expect(adapter.putAccountLibraryMeta('cus_a', { activeBrandId: 'old' }, { baseRevision: 1 }))
      .rejects.toMatchObject({ code: 'account_meta_conflict', cloudRevision: 2 });
  });

  it('rejeita corpos de documentos e tipos inválidos nos metadados antes da transação', async () => {
    const db = fakeDatabase();
    const adapter = store(db);
    await expect(adapter.putAccountLibraryMeta('cus_a', { docs: [{ id: 'x' }] }, { baseRevision: 0 }))
      .rejects.toMatchObject({ code: 'account_meta_bad_data' });
    await expect(adapter.putAccountLibraryMeta('cus_a', { brands: 'invalid' }, { baseRevision: 0 }))
      .rejects.toMatchObject({ code: 'account_meta_bad_data' });
    await expect(adapter.putAccountLibraryMeta('cus_a', { userProfile: {} }, { baseRevision: -1 }))
      .rejects.toMatchObject({ code: 'account_meta_bad_revision' });
    expect(db.snapshot().states).toEqual([]);
  });
});
