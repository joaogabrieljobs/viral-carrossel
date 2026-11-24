// DB-01 (auditoria de 23/11): texto com meio emoji (par substituto solto) ou
// caractere nulo fazia o Postgres recusar o documento ao converter para jsonb.
// O servidor respondia 503 "indisponível", a fila do navegador tratava como
// falha passageira e parava todos os projetos e o boot naquele navegador.
// Banco real embutido (PGlite) com todas as migrações, como em produção.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createLibraryPostgresStore, jsonbSafeText } from '../../api/lib/library-sync-postgres.js';

vi.setConfig({ testTimeout: 30_000 });
const OWNER = 'cus_db01';
const MEIO_EMOJI = 'Lançamento 🚀'.slice(0, 12); // corta o par no meio
let db; let store; let sql;

beforeAll(async () => {
  db = new PGlite();
  const dir = new URL('../../db/migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(f, dir), 'utf8'));
  sql = {
    unsafe: (s, p = []) => db.query(s, p).then((r) => r.rows),
    begin: (...args) => {
      const work = args.at(-1);
      return db.transaction((tx) => work({ unsafe: (s, p = []) => tx.query(s, p).then((r) => r.rows) }));
    },
  };
  store = createLibraryPostgresStore({ sql, readLegacyManifest: async () => null });
}, 60_000);
afterAll(async () => { await db?.close(); });

describe('DB-01: texto que o jsonb recusa não vira "armazenamento indisponível"', () => {
  it('a premissa: o banco recusa o escape de meio par e o \\u0000', async () => {
    expect(MEIO_EMOJI.isWellFormed()).toBe(false);
    await expect(db.query('SELECT $1::jsonb', [JSON.stringify({ t: MEIO_EMOJI })])).rejects.toBeTruthy();
    await expect(db.query('SELECT $1::jsonb', [JSON.stringify({ t: 'a\u0000b' })])).rejects.toBeTruthy();
  });

  it('projeto com meio emoji no nome e na legenda é gravado na versão 1, com o texto limpo', async () => {
    const saved = await store.putAccountProject(OWNER, {
      id: 'p-emoji', name: MEIO_EMOJI,
      doc: { slides: [{ id: 's1', title: `Chegou ${MEIO_EMOJI}`, body: 'Texto inteiro 🚀 continua igual' }] },
    }, { baseVersion: 0 });
    expect(saved.version).toBe(1);
    const read = await store.getAccountProject(OWNER, 'p-emoji');
    expect(read.entry.name).toBe('Lançamento �');
    expect(read.entry.name.isWellFormed()).toBe(true);
    expect(read.entry.doc.slides[0].body).toBe('Texto inteiro 🚀 continua igual');
  });

  it('projeto com caractere nulo é gravado sem ele', async () => {
    const saved = await store.putAccountProject(OWNER, {
      id: 'p-nulo', name: 'a\u0000b', doc: { slides: [{ id: 's1', title: 'fim\u0000' }] },
    }, { baseVersion: 0 });
    expect(saved.version).toBe(1);
    const read = await store.getAccountProject(OWNER, 'p-nulo');
    expect(read.entry.name).toBe('ab');
    expect(read.entry.doc.slides[0].title).toBe('fim');
  });

  it('dados da conta (pasta e marca) com meio emoji ou nulo também são gravados', async () => {
    const before = await store.getAccountLibraryMeta(OWNER);
    const saved = await store.putAccountLibraryMeta(OWNER, {
      folders: [{ id: 'f1', name: MEIO_EMOJI }],
      brands: [{ id: 'b1', name: 'Marca\u0000 X' }],
    }, { baseRevision: before.revision });
    expect(saved.revision).toBe(before.revision + 1);
    const read = await store.getAccountLibraryMeta(OWNER);
    expect(read.metadata.folders[0].name).toBe('Lançamento �');
    expect(read.metadata.brands[0].name).toBe('Marca X');
  });

  it('a limpeza não mexe em texto válido nem em valores que não são texto', () => {
    const value = { a: 'Olá 🚀', n: 3, ok: true, vazio: null, lista: ['é', 2, { 'ch\u0000ave': 'x' }] };
    expect(jsonbSafeText(value)).toEqual({ a: 'Olá 🚀', n: 3, ok: true, vazio: null, lista: ['é', 2, { chave: 'x' }] });
    expect(jsonbSafeText('\uDE80solto')).toBe('�solto');
  });
});

describe('DB-01: recusa de texto pelo banco vira erro do documento, não indisponibilidade', () => {
  it('22P05 do Postgres sai como library_bad_text; erro desconhecido continua indisponível', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = (code) => createLibraryPostgresStore({
      sql: { unsafe: async () => { throw Object.assign(new Error('db'), { code }); } },
      readLegacyManifest: async () => null,
    });
    await expect(failing('22P05').putAccountProject(OWNER, { id: 'p1' }, { baseVersion: 0 }))
      .rejects.toMatchObject({ code: 'library_bad_text' });
    await expect(failing('57P01').putAccountProject(OWNER, { id: 'p1' }, { baseVersion: 0 }))
      .rejects.toMatchObject({ code: 'library_storage_unavailable' });
    // O código do banco fica no log; antes a causa não era registrada.
    expect(log.mock.calls.flat().join(' ')).toContain('57P01');
    log.mockRestore();
  });
});
