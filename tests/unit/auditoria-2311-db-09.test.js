// DB-09 (auditoria de 23/11): a listagem paginada da biblioteca seguia a ordem
// de "editado por último". Um projeto salvo entre duas páginas subia para o
// topo, ficava acima do cursor e não vinha em página nenhuma. O boot e o Sync
// comparavam a contagem e paravam com "A biblioteca mudou".
// Banco real embutido (PGlite) com todas as migrações.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createLibraryPostgresStore } from '../../api/lib/library-sync-postgres.js';

vi.setConfig({ testTimeout: 60_000 });
let db; let store; let clock = 1_800_000_000_000;

beforeAll(async () => {
  db = new PGlite();
  const dir = new URL('../../db/migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(f, dir), 'utf8'));
  const sql = {
    unsafe: (s, p = []) => db.query(s, p).then((r) => r.rows),
    begin: (...args) => {
      const work = args.at(-1);
      return db.transaction((tx) => work({ unsafe: (s, p = []) => tx.query(s, p).then((r) => r.rows) }));
    },
  };
  // Relógio controlado: cada gravação recebe um instante próprio.
  store = createLibraryPostgresStore({ sql, readLegacyManifest: async () => null, now: () => (clock += 1000) });
}, 120_000);
afterAll(async () => { await db?.close(); });

async function criar(owner, ids) {
  for (const id of ids) {
    await store.putAccountProject(owner, { id, name: id, doc: { slides: [{ id: `${id}-1` }] } }, { baseVersion: 0 });
  }
}

/** Lista como o aplicativo: páginas em sequência, com uma ação entre elas. */
async function listarTudo(owner, { limit, order, entrePaginas }) {
  const ids = [];
  let cursor; let pages = 0;
  do {
    const page = await store.listAccountProjects(owner, { limit, cursor, ...(order ? { order } : {}) });
    ids.push(...page.projects.map((project) => project.id));
    cursor = page.nextCursor;
    pages += 1;
    if (cursor) await entrePaginas?.(pages);
  } while (cursor);
  return ids;
}

describe('DB-09: projeto editado entre duas páginas não some da listagem', () => {
  it('cinco projetos, página de 2, o mais antigo é salvo antes da segunda página: vêm os 5, sem repetir', async () => {
    const owner = 'cus_db09_edicao';
    await criar(owner, ['p1', 'p2', 'p3', 'p4', 'p5']);
    const ids = await listarTudo(owner, {
      limit: 2,
      order: 'stable',
      entrePaginas: async (page) => {
        if (page !== 1) return;
        await store.putAccountProject(owner, { id: 'p1', name: 'p1 editado', doc: { slides: [] } }, { baseVersion: 1 });
      },
    });
    expect([...ids].sort()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('projeto criado no meio da listagem entra no fim', async () => {
    const owner = 'cus_db09_novo';
    await criar(owner, ['a', 'b', 'c']);
    const ids = await listarTudo(owner, {
      limit: 2,
      order: 'stable',
      entrePaginas: async (page) => {
        if (page === 1) await criar(owner, ['d']);
      },
    });
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });

  it('a página estável mantém o formato: resumo sem o documento, total e contagem de cards', async () => {
    const owner = 'cus_db09_formato';
    await criar(owner, ['x', 'y']);
    const page = await store.listAccountProjects(owner, { limit: 1, order: 'stable' });
    expect(page.total).toBe(2);
    expect(page.projects).toHaveLength(1);
    expect(page.projects[0]).toMatchObject({ id: 'x', version: 1, slideCount: 1 });
    expect(page.projects[0].entry).not.toHaveProperty('doc');
    expect(typeof page.nextCursor).toBe('string');
  });

  it('cursor antigo (emitido antes da troca) continua a paginação que começou, na ordem antiga', async () => {
    const owner = 'cus_db09_cursor_antigo';
    await criar(owner, ['m', 'n', 'o']);
    const recent = await store.listAccountProjects(owner, { limit: 2 });
    expect(recent.projects.map((project) => project.id)).toEqual(['o', 'n']);
    const rest = await store.listAccountProjects(owner, { limit: 2, cursor: recent.nextCursor, order: 'stable' });
    expect(rest.projects.map((project) => project.id)).toEqual(['m']);
    expect(rest.nextCursor).toBeNull();
  });

  it('a ordem "editado por último" continua valendo para quem não pede a estável (agente)', async () => {
    const owner = 'cus_db09_agente';
    await criar(owner, ['r', 's', 't']);
    await store.putAccountProject(owner, { id: 'r', name: 'r editado', doc: { slides: [] } }, { baseVersion: 1 });
    const page = await store.listAccountProjects(owner, { limit: 3 });
    expect(page.projects.map((project) => project.id)).toEqual(['r', 't', 's']);
  });

  it('cursor estável adulterado ou usado na ordem errada é recusado', async () => {
    const owner = 'cus_db09_cursor_ruim';
    await criar(owner, ['u', 'v']);
    const stable = await store.listAccountProjects(owner, { limit: 1, order: 'stable' });
    await expect(store.listAccountProjects(owner, { limit: 1, cursor: stable.nextCursor }))
      .rejects.toMatchObject({ code: 'project_bad_cursor' });
    const forged = Buffer.from(JSON.stringify(['s', -1])).toString('base64url');
    await expect(store.listAccountProjects(owner, { limit: 1, cursor: forged, order: 'stable' }))
      .rejects.toMatchObject({ code: 'project_bad_cursor' });
    await expect(store.listAccountProjects(owner, { limit: 1, order: 'qualquer' }))
      .rejects.toMatchObject({ code: 'project_bad_limit' });
  });
});
