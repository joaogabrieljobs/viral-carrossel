// MOO-32: `use_count` dos modelos publicados subia a cada POST `use`, de
// qualquer conta e sem limite. Agora conta no máximo uma vez por conta e dia
// (migração 021). Antes de a migração ser aplicada, o código mantém o
// comportamento anterior em vez de derrubar a galeria.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createPublishedTemplatesStore } from '../../api/lib/published-templates-store.js';

const AUTORA = 'cus_autora';
const B = 'cus_b';
const C = 'cus_c';
const TPL = 'tpl_aaaaaaaaaaaaaaaaaaaa';

async function banco(migracoes) {
  const db = new PGlite();
  await db.exec('CREATE SCHEMA moont;');
  for (const arquivo of migracoes) {
    await db.exec(readFileSync(new URL(`../../db/migrations/${arquivo}`, import.meta.url), 'utf8'));
  }
  const sql = {
    unsafe: (statement, params = []) => db.query(statement, params).then((result) => result.rows),
    begin: (work) => db.transaction((tx) => work({
      unsafe: (statement, params = []) => tx.query(statement, params).then((result) => result.rows),
    })),
  };
  await sql.unsafe(`INSERT INTO moont.published_templates (id, owner_id, name, format, content, content_bytes)
    VALUES ($1, $2, 'Modelo', 'stories', '{"v":1}'::jsonb, 9)`, [TPL, AUTORA]);
  return { db, sql, store: createPublishedTemplatesStore({ sql }) };
}

describe('MOO-32: uso de modelo contado uma vez por conta e dia', () => {
  let comTabela;
  let semTabela;
  beforeAll(async () => {
    comTabela = await banco(['015_published_templates.sql', '016_template_moderation.sql', '021_published_template_uses.sql']);
    semTabela = await banco(['015_published_templates.sql', '016_template_moderation.sql']);
  }, 60_000);
  afterAll(async () => { await comTabela?.db.close(); await semTabela?.db.close(); });

  it('a mesma conta repetindo o uso no mesmo dia não infla o contador', async () => {
    const { store, sql } = comTabela;
    for (let i = 0; i < 5; i += 1) await store.recordUse(TPL, B);
    expect((await store.recordUse(TPL, B)).useCount).toBe(1);
    expect((await store.recordUse(TPL, C)).useCount).toBe(2);
    // Outro dia conta de novo para a mesma conta.
    await sql.unsafe(`UPDATE moont.published_template_uses SET day = day - 1 WHERE owner_id = $1`, [B]);
    expect((await store.recordUse(TPL, B)).useCount).toBe(3);
    const [linha] = await sql.unsafe('SELECT use_count FROM moont.published_templates WHERE id = $1', [TPL]);
    expect(linha.use_count).toBe(3);
  });

  it('modelo inexistente ou oculto continua 404', async () => {
    const { store, sql } = comTabela;
    await expect(store.recordUse('tpl_bbbbbbbbbbbbbbbbbbbb', B)).rejects.toMatchObject({ status: 404 });
    await sql.unsafe(`UPDATE moont.published_templates SET status = 'hidden' WHERE id = $1`, [TPL]);
    await expect(store.recordUse(TPL, 'cus_nova')).rejects.toMatchObject({ status: 404 });
    await sql.unsafe(`UPDATE moont.published_templates SET status = 'published' WHERE id = $1`, [TPL]);
  });

  it('antes da migração 021 a galeria continua funcionando (comportamento anterior)', async () => {
    const { store } = semTabela;
    expect((await store.recordUse(TPL, B)).useCount).toBe(1);
    expect((await store.recordUse(TPL, B)).useCount).toBe(2);
  });
});
