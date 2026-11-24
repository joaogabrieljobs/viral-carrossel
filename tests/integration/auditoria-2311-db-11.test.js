// DB-11 (auditoria de 23/11): o limite de 5 publicações por dia contava só os
// modelos que ainda existiam. Publicar, apagar e publicar de novo passava do
// limite quantas vezes a pessoa quisesse.
// Este arquivo cobre só o limite do dia. Apagar um modelo oculto por denúncias
// (e levar junto as denúncias) continua como estava: depende de decisão.
// Postgres de verdade (PGlite) com as migrações dos modelos.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { makeReq, makeRes } from '../helpers/http.js';
import { createTemplatesHandler } from '../../api/templates.js';
import { createPublishedTemplatesStore, MAX_PUBLISHES_PER_DAY } from '../../api/lib/published-templates-store.js';
import { buildTemplateContent } from '../../src/utils/published-template.js';

let db;
let handler;
const A = 'cus_autora';
const B = 'cus_outra';

beforeAll(async () => {
  db = new PGlite();
  await db.exec('CREATE SCHEMA moont;');
  for (const arquivo of ['015_published_templates.sql', '016_template_moderation.sql', '021_published_template_uses.sql', '023_template_report_dismissal.sql']) {
    await db.exec(readFileSync(new URL(`../../db/migrations/${arquivo}`, import.meta.url), 'utf8'));
  }
  const sql = {
    unsafe: (statement, params = []) => db.query(statement, params).then((result) => result.rows),
    begin: (work) => db.transaction((tx) => work({
      unsafe: (statement, params = []) => tx.query(statement, params).then((result) => result.rows),
    })),
  };
  handler = createTemplatesHandler({
    store: createPublishedTemplatesStore({ sql }),
    readAccess: async (req) => (req.headers['x-test-owner'] ? { customerId: req.headers['x-test-owner'], email: 'x@teste.exemplo' } : null),
    resolveEntitlement: async () => ({ active: true }),
  });
}, 120_000);

afterAll(async () => { await db?.close(); });
beforeEach(async () => { await db.exec('DELETE FROM moont.published_templates;'); });

async function call(ownerId, body) {
  const res = makeRes();
  await handler(makeReq({ method: 'POST', url: '/api/templates', body, headers: { 'x-test-owner': ownerId } }), res);
  return res;
}

const conteudo = () => buildTemplateContent({
  fmt: 'stories',
  brand: { titleFont: 'Inter', bodyFont: 'Inter', bg: '#101820', titleColor: '#ffffff', accent: '#d7ff5a' },
  slides: [{ id: 's1', title: 'Capa', layout: 'mc' }],
});
const publicar = (ownerId, name = 'Modelo') => call(ownerId, { action: 'publish', name, content: conteudo() });

describe('DB-11: apagar e publicar de novo não fura o limite de publicações do dia', () => {
  it(`publica e apaga ${MAX_PUBLISHES_PER_DAY} vezes: a publicação seguinte responde 429`, async () => {
    for (let i = 0; i < MAX_PUBLISHES_PER_DAY; i += 1) {
      const published = await publicar(A, `Ciclo ${i}`);
      expect(published.statusCode).toBe(201);
      expect((await call(A, { action: 'delete', id: published.body.template.id })).statusCode).toBe(200);
    }
    const [{ n }] = (await db.query('SELECT count(*)::int AS n FROM moont.published_templates')).rows;
    expect(n).toBe(0);

    const extra = await publicar(A, 'Mais uma hoje');
    expect(extra.statusCode).toBe(429);
    expect(extra.body).toMatchObject({
      code: 'template_daily_limit',
      limit: MAX_PUBLISHES_PER_DAY,
      error: `Cada conta publica até ${MAX_PUBLISHES_PER_DAY} modelos por dia. Tente amanhã.`,
    });
    // Outra conta não é afetada.
    expect((await publicar(B)).statusCode).toBe(201);
  });

  it('pedido recusado na validação não gasta as publicações do dia', async () => {
    // Fica abaixo de 10 pedidos por minuto, que é outra proteção.
    for (let i = 0; i < MAX_PUBLISHES_PER_DAY + 1; i += 1) {
      const invalido = i % 2 ? { name: '', content: conteudo() } : { name: 'Sem conteúdo', content: null };
      expect((await call(A, { action: 'publish', ...invalido })).statusCode).toBe(400);
    }
    expect((await publicar(A, 'Primeiro de verdade')).statusCode).toBe(201);
  });
});
