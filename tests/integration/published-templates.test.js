// Publicar modelo (docs/product/publicar-modelo.md) contra Postgres de verdade
// (PGlite, embutido): a migração 015 roda como em produção e as checagens de
// dono são provadas no próprio SQL, não num banco falso.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { makeReq, makeRes } from '../helpers/http.js';
import { createTemplatesHandler } from '../../api/templates.js';
import {
  createPublishedTemplatesStore, MAX_PUBLISHED_PER_OWNER, MAX_PUBLISHES_PER_DAY, REPORTS_TO_HIDE, GALLERY_PAGE_SIZE,
} from '../../api/lib/published-templates-store.js';
import { buildTemplateContent } from '../../src/utils/published-template.js';
import { resetRateLimits } from '../../api/lib/rate-limit.js';

let db;
let sql;
let handler;

const A = 'cus_autora';
const B = 'cus_outra';
const C = 'cus_terceira';

beforeAll(async () => {
  db = new PGlite();
  await db.exec('CREATE SCHEMA moont;');
  for (const arquivo of ['015_published_templates.sql', '016_template_moderation.sql', '021_published_template_uses.sql', '023_template_report_dismissal.sql']) {
    await db.exec(readFileSync(new URL(`../../db/migrations/${arquivo}`, import.meta.url), 'utf8'));
  }
  sql = {
    unsafe: (statement, params = []) => db.query(statement, params).then((result) => result.rows),
    begin: (work) => db.transaction((tx) => work({
      unsafe: (statement, params = []) => tx.query(statement, params).then((result) => result.rows),
    })),
  };
  const store = createPublishedTemplatesStore({ sql });
  // A sessão de teste vem do cabeçalho `x-test-owner`; sem ele, sem sessão.
  handler = createTemplatesHandler({
    store,
    readAccess: async (req) => (req.headers['x-test-owner'] ? { customerId: req.headers['x-test-owner'], email: 'x@teste.exemplo' } : null),
    // Aqui toda conta tem assinatura ativa; contas grátis em template-report-dismiss.test.js (MOO-31).
    resolveEntitlement: async () => ({ active: true }),
  });
}, 60_000);

afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec('DELETE FROM moont.published_template_uses; DELETE FROM moont.published_template_reports; DELETE FROM moont.published_templates; DELETE FROM moont.template_moderators; DELETE FROM moont.template_moderation_events;');
});

async function call(ownerId, { method = 'POST', url = '/api/templates', body } = {}) {
  const res = makeRes();
  await handler(makeReq({ method, url, body, headers: ownerId ? { 'x-test-owner': ownerId } : {} }), res);
  return res;
}

/** Projeto "real", cheio de conteúdo e identidade de cliente. */
function projetoDoCliente() {
  return {
    fmt: 'stories',
    brand: {
      name: 'Clínica Janine', handle: '@clinicajanine', bio: 'Medicina regenerativa',
      logo: 'data:image/png;base64,AAAA', logoImageId: 'logo-1', customTitleFont: 'data:font/woff2;base64,AAAA',
      titleFont: 'Playfair Display', bodyFont: 'Inter', bg: '#101820', titleColor: '#fff5d1', accent: '#d7ff5a',
      footerPillText: '@clinicajanine', footerBarLeft: '{handle}', footerBarRight: '{ano}', cultureHeaderLeft: 'CLÍNICA JANINE',
    },
    caption: 'Legenda do cliente',
    styleKit: { contextMd: 'Brief confidencial', refImages: [{ id: 'r', dataUrl: 'data:image/png;base64,AA' }] },
    slides: [
      { id: 's1', title: 'Medicina regenerativa não mascara o problema', subtitle: 'Texto do cliente', layout: 'mc', align: 'center',
        bgImage: 'data:image/png;base64,AAAA', bgImageAssetId: 'asset-cliente', imageQuery: 'médica com modelo anatômico',
        eyebrowText: 'DRA. JANINE', overlay: 40, titleSize: 120,
        canvas: { enabled: true, variant: 'classic', zones: { title: { x: 6, y: 60, w: 88, h: 20 }, photo: { x: 0, y: 0, w: 100, h: 58 } } } },
      { id: 's2', title: 'Segundo', subtitle: 'Mais texto', layout: 'ml', align: 'left', overlays: [{ id: 'cta', text: 'AGENDE JÁ' }] },
      { id: 's3', title: 'Agende sua avaliação', subtitle: 'WhatsApp (11) 99999-0000', layout: 'mc', textShadow: false },
    ],
  };
}

async function publicar(ownerId, extra = {}) {
  return call(ownerId, { body: { action: 'publish', name: 'Editorial clínico', description: 'Capa com foto em cima', content: buildTemplateContent(projetoDoCliente()), ...extra } });
}

describe('publicar modelo — conteúdo e identidade do cliente ficam fora', () => {
  it('o servidor grava só a estrutura, mesmo que o navegador mande conteúdo junto', async () => {
    const malicioso = {
      ...buildTemplateContent(projetoDoCliente()),
      caption: 'vazou', brand: { ...projetoDoCliente().brand }, // marca inteira, com nome, @, logo
      slides: projetoDoCliente().slides.map((slide, i) => ({ role: i === 0 ? 'cover' : 'content', ...slide })),
    };
    const res = await call(A, { body: { action: 'publish', name: 'Editorial clínico', content: malicioso } });
    expect(res.statusCode).toBe(201);
    const [row] = await sql.unsafe('SELECT content FROM moont.published_templates');
    const gravado = JSON.stringify(row.content);
    for (const proibido of ['Clínica Janine', 'clinicajanine', 'Medicina regenerativa', 'data:image', 'data:font', 'asset-cliente',
      'médica', 'DRA. JANINE', 'AGENDE', '99999', 'Brief confidencial', 'vazou', 'Texto do cliente', 'CLÍNICA JANINE']) {
      expect(gravado, proibido).not.toContain(proibido);
    }
    // A estrutura vai: fontes, cores, diagramação das zonas e marcadores.
    expect(row.content.brand).toMatchObject({ titleFont: 'Playfair Display', bg: '#101820', footerBarLeft: '{handle}', footerBarRight: '{ano}' });
    expect(row.content.brand.footerPillText).toBeUndefined();
    expect(row.content.slides[0]).toMatchObject({ role: 'cover', layout: 'mc', overlay: 40, titleSize: 120 });
    expect(row.content.slides[0].canvas.zones.title).toEqual({ x: 6, y: 60, w: 88, h: 20 });
    expect(row.content.format).toBe('stories');
  });

  it('a resposta da galeria nunca expõe o dono nem a contagem de denúncias', async () => {
    await publicar(A);
    const res = await call(B, { method: 'GET' });
    expect(res.statusCode).toBe(200);
    expect(res.body.templates).toHaveLength(1);
    expect(res.body.templates[0]).toMatchObject({ name: 'Editorial clínico', mine: false, format: 'stories' });
    const json = JSON.stringify(res.body);
    expect(json).not.toContain(A);
    expect(json).not.toContain('owner');
    expect(json).not.toContain('report');
  });

  it('nome e descrição viram texto de uma linha, sem marcação; nome é obrigatório', async () => {
    const vazio = await call(A, { body: { action: 'publish', name: '   ', content: buildTemplateContent(projetoDoCliente()) } });
    expect(vazio.statusCode).toBe(400);
    const res = await call(A, { body: { action: 'publish', name: '<b>Modelo</b>\nnovo', description: 'x'.repeat(400), authorName: '  Ana  ',
      content: buildTemplateContent(projetoDoCliente()) } });
    expect(res.statusCode).toBe(201);
    expect(res.body.template).toMatchObject({ name: 'b Modelo /b novo', authorName: 'Ana' });
    expect(res.body.template.description).toHaveLength(160);
  });

  it('modelo inválido ou grande demais é recusado sem gravar', async () => {
    expect((await call(A, { body: { action: 'publish', name: 'X', content: { v: 1, format: 'feed', slides: [] } } })).statusCode).toBe(400);
    const grande = await call(A, { body: { action: 'publish', name: 'X', content: { ...buildTemplateContent(projetoDoCliente()), lixo: 'x'.repeat(60_000) } } });
    expect(grande.statusCode).toBe(413);
    expect(await sql.unsafe('SELECT id FROM moont.published_templates')).toHaveLength(0);
  });
});

describe('publicar modelo — permissão (ninguém edita nem apaga modelo alheio)', () => {
  it('sem sessão não lista, não lê e não publica', async () => {
    await publicar(A);
    expect((await call(null, { method: 'GET' })).statusCode).toBe(401);
    expect((await call(null, { body: { action: 'publish', name: 'X', content: buildTemplateContent(projetoDoCliente()) } })).statusCode).toBe(401);
  });

  it('B não renomeia nem apaga o modelo de A; A consegue', async () => {
    const { body } = await publicar(A);
    const id = body.template.id;
    const renomear = await call(B, { body: { action: 'update', id, name: 'Roubado', description: '' } });
    expect(renomear.statusCode).toBe(404);
    const apagar = await call(B, { body: { action: 'delete', id } });
    expect(apagar.statusCode).toBe(404);
    const [intacto] = await sql.unsafe('SELECT name, owner_id FROM moont.published_templates WHERE id = $1', [id]);
    expect(intacto).toEqual({ name: 'Editorial clínico', owner_id: A });

    const renomeado = await call(A, { body: { action: 'update', id, name: 'Editorial clínico v2', description: 'nova', authorName: '' } });
    expect(renomeado.statusCode).toBe(200);
    expect(renomeado.body.template).toMatchObject({ name: 'Editorial clínico v2', authorName: null, mine: true });
    expect((await call(A, { body: { action: 'delete', id } })).statusCode).toBe(200);
    expect((await call(B, { method: 'GET' })).body.templates).toEqual([]);
    expect((await call(B, { method: 'GET', url: `/api/templates?id=${id}` })).statusCode).toBe(404);
  });

  it('"meus modelos" só traz os da própria conta', async () => {
    await publicar(A);
    await publicar(B, { name: 'Da B' });
    const minhaA = await call(A, { method: 'GET', url: '/api/templates?mine=1' });
    expect(minhaA.body.templates.map((t) => t.name)).toEqual(['Editorial clínico']);
    expect(minhaA.body.templates[0]).toMatchObject({ mine: true, status: 'published' });
  });

  it('dono no corpo do pedido é ignorado: vale a sessão', async () => {
    const res = await call(B, { body: { action: 'publish', name: 'Teste', ownerId: A, owner_id: A, content: buildTemplateContent(projetoDoCliente()) } });
    expect(res.statusCode).toBe(201);
    const [row] = await sql.unsafe('SELECT owner_id FROM moont.published_templates');
    expect(row.owner_id).toBe(B);
  });
});

describe('publicar modelo — limites e moderação', () => {
  it(`limite por dia (${MAX_PUBLISHES_PER_DAY}) e total por conta (${MAX_PUBLISHED_PER_OWNER})`, async () => {
    for (let i = 0; i < MAX_PUBLISHES_PER_DAY; i += 1) expect((await publicar(A, { name: `M${i}` })).statusCode).toBe(201);
    const sexto = await publicar(A, { name: 'demais hoje' });
    expect(sexto.statusCode).toBe(429);
    expect(sexto.body.code).toBe('template_daily_limit');
    // Outra conta não é afetada.
    expect((await publicar(B)).statusCode).toBe(201);
    // Dias depois, o limite total segura em 10. (A janela de 10 pedidos por
    // minuto é outra proteção; zera para isolar o limite do banco.)
    resetRateLimits();
    await sql.unsafe("UPDATE moont.published_templates SET created_at = now() - interval '3 days' WHERE owner_id = $1", [A]);
    for (let i = 0; i < MAX_PUBLISHED_PER_OWNER - MAX_PUBLISHES_PER_DAY; i += 1) expect((await publicar(A, { name: `N${i}` })).statusCode).toBe(201);
    await sql.unsafe("UPDATE moont.published_templates SET created_at = now() - interval '3 days' WHERE owner_id = $1", [A]);
    const decimoPrimeiro = await publicar(A, { name: 'onze' });
    expect(decimoPrimeiro.statusCode).toBe(409);
    expect(decimoPrimeiro.body.code).toBe('template_owner_limit');
  });

  it(`denúncia: uma por conta, ninguém denuncia o próprio, ${REPORTS_TO_HIDE} contas tiram da galeria`, async () => {
    const id = (await publicar(A)).body.template.id;
    expect((await call(A, { body: { action: 'report', id } })).statusCode).toBe(400);
    expect((await call(B, { body: { action: 'report', id, reason: 'conteúdo indevido' } })).body).toMatchObject({ reported: true, duplicate: false });
    expect((await call(B, { body: { action: 'report', id } })).body).toMatchObject({ duplicate: true });
    expect((await call(C, { body: { action: 'report', id } })).statusCode).toBe(200);
    expect((await call(B, { method: 'GET' })).body.templates).toHaveLength(1); // 2 denúncias: continua
    expect((await call('cus_quarta', { body: { action: 'report', id } })).statusCode).toBe(200);
    expect((await call(B, { method: 'GET' })).body.templates).toHaveLength(0); // 3: saiu
    expect((await call(B, { method: 'GET', url: `/api/templates?id=${id}` })).statusCode).toBe(404);
    // A autora ainda vê o próprio modelo, marcado como oculto.
    const minha = await call(A, { method: 'GET', url: '/api/templates?mine=1' });
    expect(minha.body.templates[0]).toMatchObject({ id, status: 'hidden' });
    expect((await call(B, { body: { action: 'use', id } })).statusCode).toBe(404);
  });

  it('usar conta um uso; galeria pagina do mais novo ao mais antigo e filtra formato', async () => {
    const id = (await publicar(A)).body.template.id;
    expect((await call(B, { body: { action: 'use', id } })).body.useCount).toBe(1);
    expect((await call(C, { body: { action: 'use', id } })).body.useCount).toBe(2);
    for (let i = 0; i < GALLERY_PAGE_SIZE + 3; i += 1) {
      await sql.unsafe(`INSERT INTO moont.published_templates (id, owner_id, name, format, content, content_bytes, created_at)
        VALUES ($1, $2, $3, $4, '{"v":1}'::jsonb, 9, now() - ($5 || ' minutes')::interval)`,
      [`tpl_${String(i).padStart(20, '0')}`, `cus_lote${i}`, `Lote ${i}`, i % 2 ? 'carrossel' : 'stories', String(i + 1)]);
    }
    const p1 = await call(B, { method: 'GET' });
    expect(p1.body.templates).toHaveLength(GALLERY_PAGE_SIZE);
    expect(p1.body.templates[0].name).toBe('Editorial clínico');
    const p2 = await call(B, { method: 'GET', url: `/api/templates?cursor=${p1.body.nextCursor}` });
    expect(p2.body.templates).toHaveLength(4);
    expect(p2.body.nextCursor).toBeNull();
    const ids = new Set([...p1.body.templates, ...p2.body.templates].map((t) => t.id));
    expect(ids.size).toBe(GALLERY_PAGE_SIZE + 4);
    const soCarrossel = await call(B, { method: 'GET', url: '/api/templates?format=carrossel' });
    expect(soCarrossel.body.templates.every((t) => t.format === 'carrossel')).toBe(true);
    expect((await call(B, { method: 'GET', url: '/api/templates?cursor=lixo' })).statusCode).toBe(400);
  });
});

describe('moderação da galeria', () => {
  const MOD = 'cus_moderador';
  const tornarModerador = (id) => sql.unsafe('INSERT INTO moont.template_moderators (owner_id, note) VALUES ($1, $2)', [id, 'teste']);
  async function denunciado(vezes = 1) {
    const id = (await publicar(A)).body.template.id;
    const contas = ['cus_d1', 'cus_d2', 'cus_d3', 'cus_d4'];
    for (let i = 0; i < vezes; i += 1) await call(contas[i], { body: { action: 'report', id, reason: `motivo ${i + 1}` } });
    return id;
  }

  it('quem não modera não vê a fila nem decide: a rota responde 404 como se não existisse', async () => {
    const id = await denunciado(1);
    for (const conta of [A, B]) {
      expect((await call(conta, { method: 'GET', url: '/api/templates?moderation=1' })).statusCode).toBe(404);
      expect((await call(conta, { body: { action: 'moderate', id, decision: 'remove' } })).statusCode).toBe(404);
    }
    expect((await sql.unsafe('SELECT status FROM moont.published_templates WHERE id = $1', [id]))[0].status).toBe('published');
    expect(await sql.unsafe('SELECT * FROM moont.template_moderation_events')).toEqual([]);
    expect((await call(B, { method: 'GET' })).body.moderator).toBeUndefined();
  });

  it('a galeria avisa o moderador; a fila traz ocultos primeiro, com motivos e sem identificar quem denunciou nem a autora', async () => {
    await tornarModerador(MOD);
    expect((await call(MOD, { method: 'GET' })).body.moderator).toBe(true);
    const leve = await denunciado(1);
    resetRateLimits();
    const oculto = (await call(B, { body: { action: 'publish', name: 'Oculto', content: buildTemplateContent(projetoDoCliente()) } })).body.template.id;
    for (const conta of ['cus_x1', 'cus_x2', 'cus_x3']) await call(conta, { body: { action: 'report', id: oculto, reason: 'copia marca' } });
    const fila = await call(MOD, { method: 'GET', url: '/api/templates?moderation=1' });
    expect(fila.statusCode).toBe(200);
    expect(fila.body.templates.map((t) => [t.id, t.status, t.reportCount])).toEqual([[oculto, 'hidden', 3], [leve, 'published', 1]]);
    expect(fila.body.templates[1].reports).toEqual([{ reason: 'motivo 1', createdAt: expect.any(String), countsTowardHide: true }]);
    const json = JSON.stringify(fila.body);
    for (const segredo of [A, B, 'cus_d1', 'cus_x1', 'owner']) expect(json).not.toContain(segredo);
  });

  it('manter devolve à galeria e dispensa as denúncias; ocultar tira sem apagar; remover guarda e restaurar devolve; tudo vai para o histórico', async () => {
    await tornarModerador(MOD);
    const id = await denunciado(3);
    expect((await call(B, { method: 'GET' })).body.templates).toHaveLength(0);
    const manter = await call(MOD, { body: { action: 'moderate', id, decision: 'keep' } });
    expect(manter.body).toMatchObject({ decision: 'keep', status: 'published' });
    expect((await call(B, { method: 'GET' })).body.templates).toHaveLength(1);
    expect((await call(MOD, { method: 'GET', url: '/api/templates?moderation=1' })).body.templates).toEqual([]);
    // MOO-31: antes este teste fixava que as mesmas contas podiam denunciar de
    // novo depois de Manter — era exatamente o defeito (3 contas ocultavam o
    // modelo sem fim). Agora a denúncia dispensada fica guardada e a mesma
    // conta recebe duplicate: true; o modelo continua publicado.
    expect((await call('cus_d1', { body: { action: 'report', id } })).body).toMatchObject({ duplicate: true });
    expect((await sql.unsafe('SELECT status FROM moont.published_templates WHERE id = $1', [id]))[0].status).toBe('published');

    expect((await call(MOD, { body: { action: 'moderate', id, decision: 'hide' } })).body.status).toBe('hidden');
    expect((await call(B, { method: 'GET' })).body.templates).toHaveLength(0);
    expect((await call(A, { method: 'GET', url: '/api/templates?mine=1' })).body.templates[0].status).toBe('hidden');

    // Restaurar só vale para removido.
    expect((await call(MOD, { body: { action: 'moderate', id, decision: 'restore' } })).statusCode).toBe(409);

    // Remover (João, 19/11): sai da galeria e dos modelos da autora, mas fica guardado.
    expect((await call(MOD, { body: { action: 'moderate', id, decision: 'remove' } })).body).toMatchObject({ status: 'removed' });
    const [guardado] = await sql.unsafe('SELECT status, removed_at FROM moont.published_templates WHERE id = $1', [id]);
    expect(guardado.status).toBe('removed');
    expect(guardado.removed_at).not.toBeNull();
    expect((await call(B, { method: 'GET' })).body.templates).toHaveLength(0);
    expect((await call(A, { method: 'GET', url: '/api/templates?mine=1' })).body.templates).toEqual([]);
    expect((await call(A, { method: 'GET', url: `/api/templates?id=${id}` })).statusCode).toBe(404);
    expect((await call(A, { body: { action: 'update', id, name: 'Volta' } })).statusCode).toBe(404);
    expect((await call(A, { body: { action: 'delete', id } })).statusCode).toBe(404);
    expect((await call('cus_d2', { body: { action: 'report', id } })).statusCode).toBe(404);
    expect((await call(B, { body: { action: 'use', id } })).statusCode).toBe(404);
    // Fora da fila de denúncias, dentro de "Removidos".
    expect((await call(MOD, { method: 'GET', url: '/api/templates?moderation=1' })).body.templates).toEqual([]);
    const removidos = (await call(MOD, { method: 'GET', url: '/api/templates?moderation=1&view=removed' })).body.templates;
    expect(removidos.map((t) => [t.id, t.status])).toEqual([[id, 'removed']]);
    expect(removidos[0].removedAt).toEqual(expect.any(String));
    // Removido não decide de novo sem antes restaurar.
    expect((await call(MOD, { body: { action: 'moderate', id, decision: 'keep' } })).statusCode).toBe(409);

    const restaurar = await call(MOD, { body: { action: 'moderate', id, decision: 'restore' } });
    expect(restaurar.body).toMatchObject({ decision: 'restore', status: 'published' });
    expect((await call(B, { method: 'GET' })).body.templates.map((t) => t.id)).toEqual([id]);
    expect((await call(A, { method: 'GET', url: '/api/templates?mine=1' })).body.templates[0]).toMatchObject({ id, status: 'published' });
    expect((await call(MOD, { method: 'GET', url: '/api/templates?moderation=1&view=removed' })).body.templates).toEqual([]);
    const [devolvido] = await sql.unsafe('SELECT report_count, removed_at FROM moont.published_templates WHERE id = $1', [id]);
    expect(devolvido).toEqual({ report_count: 0, removed_at: null });

    const historico = await sql.unsafe('SELECT decision, template_owner_id, moderator_id, template_name FROM moont.template_moderation_events ORDER BY id');
    expect(historico.map((h) => h.decision)).toEqual(['keep', 'hide', 'remove', 'restore']);
    expect(historico.every((h) => h.template_owner_id === A && h.moderator_id === MOD && h.template_name === 'Editorial clínico')).toBe(true);
    expect((await call(MOD, { body: { action: 'moderate', id: 'tpl_' + 'a'.repeat(20), decision: 'keep' } })).statusCode).toBe(404);
    expect((await call(MOD, { body: { action: 'moderate', id, decision: 'apagar' } })).statusCode).toBe(400);
  });

  it('removido não conta no limite de modelos da autora, mas conta no limite do dia', async () => {
    await tornarModerador(MOD);
    const ids = [];
    for (let i = 0; i < MAX_PUBLISHES_PER_DAY; i += 1) ids.push((await publicar(A, { name: `M${i}` })).body.template.id);
    resetRateLimits();
    await call(MOD, { body: { action: 'moderate', id: ids[0], decision: 'remove' } });
    expect((await publicar(A, { name: 'ainda hoje' })).body.code).toBe('template_daily_limit');
    resetRateLimits();
    await sql.unsafe("UPDATE moont.published_templates SET created_at = now() - interval '3 days' WHERE owner_id = $1", [A]);
    // 4 ativos + 6 novos = 10 ativos (em dois dias, por causa do limite diário).
    const envelhecer = () => sql.unsafe("UPDATE moont.published_templates SET created_at = now() - interval '3 days' WHERE owner_id = $1", [A]);
    for (let i = 0; i < MAX_PUBLISHES_PER_DAY; i += 1) expect((await publicar(A, { name: `N${i}` })).statusCode).toBe(201);
    resetRateLimits();
    await envelhecer();
    expect((await publicar(A, { name: 'décimo ativo' })).statusCode).toBe(201);
    expect((await publicar(A, { name: 'demais' })).body.code).toBe('template_owner_limit');
  });

  it('a fila mostra o histórico do autor sem identificá-lo', async () => {
    await tornarModerador(MOD);
    const primeiro = await denunciado(1);
    await call(MOD, { body: { action: 'moderate', id: primeiro, decision: 'remove' } });
    resetRateLimits();
    await denunciado(1);
    const [item] = (await call(MOD, { method: 'GET', url: '/api/templates?moderation=1' })).body.templates;
    expect(item).toMatchObject({ authorTemplateCount: 1, authorStrikes: 1 });
  });
});
