// MOO-24: `account_projects` e `agent_visual_jobs` apontavam para
// `account_libraries` com ON DELETE CASCADE. Um DELETE na biblioteca levava
// todos os projetos e o histórico do agente sem trilha. A migração 022 troca
// para RESTRICT. Roda todas as migrações em ordem, como em produção.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const dir = new URL('../../db/migrations/', import.meta.url);
let db;

async function fks() {
  const { rows } = await db.query(`SELECT c.conrelid::regclass::text AS tabela, c.conname, c.confdeltype
    FROM pg_constraint c
    WHERE c.contype = 'f' AND c.confrelid = 'moont.account_libraries'::regclass
    ORDER BY 1, 2`);
  return rows;
}

beforeAll(async () => {
  db = new PGlite();
  for (const arquivo of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(arquivo, dir), 'utf8'));
  }
}, 60_000);
afterAll(async () => { await db?.close(); });

describe('MOO-24: biblioteca da conta não apaga projetos em cascata', () => {
  it('as duas chaves estrangeiras para account_libraries ficam com RESTRICT', async () => {
    expect(await fks()).toEqual([
      { tabela: 'moont.account_projects', conname: 'account_projects_owner_id_fkey', confdeltype: 'r' },
      { tabela: 'moont.agent_visual_jobs', conname: 'agent_visual_jobs_owner_id_fkey', confdeltype: 'r' },
    ]);
  });

  it('apagar a biblioteca com projetos falha e não leva os projetos junto', async () => {
    await db.exec(`INSERT INTO moont.account_libraries (owner_id) VALUES ('cus_restrict');
      INSERT INTO moont.account_projects (owner_id, project_id, entry, updated_at, sort_order)
      VALUES ('cus_restrict', 'p1', '{"id":"p1"}'::jsonb, 1, 0);`);
    await expect(db.query(`DELETE FROM moont.account_libraries WHERE owner_id = 'cus_restrict'`))
      .rejects.toMatchObject({ code: '23503' }); // foreign_key_violation
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM moont.account_projects WHERE owner_id = 'cus_restrict'`);
    expect(rows[0].n).toBe(1);
  });

  it('reaplicar a migração não duplica nem altera as chaves', async () => {
    const antes = await fks();
    await db.exec(readFileSync(new URL('022_account_library_restrict.sql', dir), 'utf8'));
    expect(await fks()).toEqual(antes);
  });
});
