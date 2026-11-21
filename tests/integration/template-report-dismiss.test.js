// MOO-31: três contas grátis ocultavam qualquer modelo e "Manter"/"Restaurar"
// apagavam as denúncias, deixando as mesmas contas ocultá-lo de novo sem fim.
// Agora (migração 023) as denúncias dispensadas ficam guardadas e não contam,
// a mesma conta não denuncia de novo o mesmo modelo, e só contas com
// assinatura ativa ou isenção disparam a ocultação.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { makeReq, makeRes } from '../helpers/http.js';
import { createTemplatesHandler } from '../../api/templates.js';
import { createPublishedTemplatesStore } from '../../api/lib/published-templates-store.js';
import { resetRateLimits } from '../../api/lib/rate-limit.js';

const AUTORA = 'cus_autora';
const MOD = 'cus_moderador';
const PAGAS = ['cus_p1', 'cus_p2', 'cus_p3', 'cus_p4', 'cus_p5', 'cus_p6'];
const GRATIS = ['cus_g1', 'cus_g2', 'cus_g3'];
let seq = 0;

async function ambiente(migracoes) {
  const db = new PGlite();
  await db.exec('CREATE SCHEMA moont;');
  for (const arquivo of migracoes) {
    await db.exec(readFileSync(new URL(`../../db/migrations/${arquivo}`, import.meta.url), 'utf8'));
  }
  const sql = {
    unsafe: (statement, params = []) => db.query(statement, params).then((r) => r.rows),
    begin: (work) => db.transaction((tx) => work({ unsafe: (statement, params = []) => tx.query(statement, params).then((r) => r.rows) })),
  };
  await sql.unsafe('INSERT INTO moont.template_moderators (owner_id, note) VALUES ($1, $2)', [MOD, 'teste']);
  const handler = createTemplatesHandler({
    store: createPublishedTemplatesStore({ sql }),
    readAccess: async (req) => (req.headers['x-test-owner'] ? { customerId: req.headers['x-test-owner'], email: 'x@teste.exemplo' } : null),
    resolveEntitlement: async (customerId) => ({ active: !GRATIS.includes(customerId) }),
  });
  async function call(ownerId, body) {
    resetRateLimits();
    const res = makeRes();
    await handler(makeReq({ method: 'POST', url: '/api/templates', body, headers: { 'x-test-owner': ownerId } }), res);
    return res;
  }
  async function modelo() {
    seq += 1;
    const id = `tpl_${String(seq).padStart(20, '0')}`;
    await sql.unsafe(`INSERT INTO moont.published_templates (id, owner_id, name, format, content, content_bytes)
      VALUES ($1, $2, 'Modelo', 'stories', '{"v":1}'::jsonb, 9)`, [id, AUTORA]);
    return id;
  }
  const status = async (id) => (await sql.unsafe('SELECT status, report_count FROM moont.published_templates WHERE id = $1', [id]))[0];
  return { db, sql, call, modelo, status };
}

const BASE = ['015_published_templates.sql', '016_template_moderation.sql'];

describe('MOO-31 com a migração 023', () => {
  let env;
  beforeAll(async () => { env = await ambiente([...BASE, '021_published_template_uses.sql', '023_template_report_dismissal.sql']); }, 60_000);
  afterAll(async () => { await env?.db.close(); });

  it('depois de Manter, as mesmas contas denunciando de novo não ocultam (duplicate: true)', async () => {
    const id = await env.modelo();
    for (const conta of PAGAS.slice(0, 3)) await env.call(conta, { action: 'report', id, reason: 'x' });
    expect((await env.status(id)).status).toBe('hidden');
    expect((await env.call(MOD, { action: 'moderate', id, decision: 'keep' })).body.status).toBe('published');
    for (const conta of PAGAS.slice(0, 3)) {
      expect((await env.call(conta, { action: 'report', id })).body).toMatchObject({ duplicate: true });
    }
    expect(await env.status(id)).toEqual({ status: 'published', report_count: 0 });
    // O histórico fica: as denúncias continuam guardadas, marcadas como dispensadas.
    const linhas = await env.sql.unsafe('SELECT dismissed_at FROM moont.published_template_reports WHERE template_id = $1', [id]);
    expect(linhas).toHaveLength(3);
    expect(linhas.every((l) => l.dismissed_at)).toBe(true);
    // Três contas pagas novas ainda conseguem ocultar.
    for (const conta of PAGAS.slice(3, 6)) await env.call(conta, { action: 'report', id });
    expect(await env.status(id)).toEqual({ status: 'hidden', report_count: 3 });
  });

  it('denúncias de contas grátis ficam registradas para a moderação, mas não ocultam', async () => {
    const id = await env.modelo();
    for (const conta of GRATIS) {
      expect((await env.call(conta, { action: 'report', id, reason: 'grátis' })).body).toMatchObject({ reported: true, duplicate: false });
    }
    expect(await env.status(id)).toEqual({ status: 'published', report_count: 3 });
    const res = makeRes();
    await createTemplatesHandler({
      store: createPublishedTemplatesStore({ sql: env.sql }),
      readAccess: async () => ({ customerId: MOD, email: 'm@teste.exemplo' }),
    })(makeReq({ method: 'GET', url: '/api/templates?moderation=1', headers: {} }), res);
    const item = res.body.templates.find((t) => t.id === id);
    expect(item.reports).toHaveLength(3);
    expect(item.reports.every((r) => r.countsTowardHide === false)).toBe(true);
    // Duas pagas + três grátis: ainda não oculta; a terceira paga oculta.
    await env.call(PAGAS[0], { action: 'report', id });
    await env.call(PAGAS[1], { action: 'report', id });
    expect((await env.status(id)).status).toBe('published');
    await env.call(PAGAS[2], { action: 'report', id });
    expect((await env.status(id)).status).toBe('hidden');
  });

  it('Restaurar também dispensa as denúncias em vez de apagar', async () => {
    const id = await env.modelo();
    for (const conta of PAGAS.slice(0, 2)) await env.call(conta, { action: 'report', id });
    await env.call(MOD, { action: 'moderate', id, decision: 'remove' });
    await env.call(MOD, { action: 'moderate', id, decision: 'restore' });
    const linhas = await env.sql.unsafe('SELECT dismissed_at FROM moont.published_template_reports WHERE template_id = $1', [id]);
    expect(linhas).toHaveLength(2);
    expect(linhas.every((l) => l.dismissed_at)).toBe(true);
    expect((await env.call(PAGAS[0], { action: 'report', id })).body.duplicate).toBe(true);
  });
});

describe('MOO-31 antes da migração 023 (galeria continua funcionando)', () => {
  let env;
  beforeAll(async () => { env = await ambiente(BASE); }, 60_000);
  afterAll(async () => { await env?.db.close(); });

  it('contas grátis já não ocultam; Manter mantém o comportamento anterior', async () => {
    const id = await env.modelo();
    for (const conta of GRATIS) await env.call(conta, { action: 'report', id });
    expect((await env.status(id)).status).toBe('published');
    for (const conta of PAGAS.slice(0, 3)) await env.call(conta, { action: 'report', id });
    expect((await env.status(id)).status).toBe('hidden');
    expect((await env.call(MOD, { action: 'moderate', id, decision: 'keep' })).body.status).toBe('published');
  });
});
