// Publicar modelo de ponta a ponta entre duas contas (docs/product/publicar-modelo.md).
// O navegador fala com a rota real (api/templates.js) e a loja real, sobre um
// Postgres embutido (PGlite) com a migração 015: só a sessão é simulada.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';
import { createTemplatesHandler } from '../../api/templates.js';
import { createPublishedTemplatesStore } from '../../api/lib/published-templates-store.js';
import { resetRateLimits } from '../../api/lib/rate-limit.js';

test.describe.configure({ mode: 'serial' });
// MOONT_CAPTURAS=1 grava as telas para conferência visual (fora do portão).
const capturar = async (page, nome) => { if (process.env.MOONT_CAPTURAS) await page.screenshot({ path: `test-results/modelos-${nome}.png` }); };
test.setTimeout(120_000);

let db;
let handler;
test.beforeAll(async () => {
  db = new PGlite();
  await db.exec('CREATE SCHEMA moont;');
  await db.exec(readFileSync(new URL('../../db/migrations/015_published_templates.sql', import.meta.url), 'utf8'));
  const sql = {
    unsafe: (statement, params = []) => db.query(statement, params).then((r) => r.rows),
    begin: (work) => db.transaction((tx) => work({ unsafe: (statement, params = []) => tx.query(statement, params).then((r) => r.rows) })),
  };
  handler = createTemplatesHandler({
    store: createPublishedTemplatesStore({ sql }),
    readAccess: async (req) => (req.headers['x-e2e-owner'] ? { customerId: req.headers['x-e2e-owner'], email: `${req.headers['x-e2e-owner']}@teste.exemplo` } : null),
  });
});
test.afterAll(async () => { await db?.close(); });
test.beforeEach(async () => { resetRateLimits(); await db.exec('DELETE FROM moont.published_template_reports; DELETE FROM moont.published_templates;'); });

/** Encaminha /api/templates do navegador para a rota real, com a conta da página. */
function rotaReal(owner) {
  return async (route) => {
    const request = route.request();
    const res = { statusCode: 200, headers: {}, body: undefined,
      status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; },
      end() { return this; }, setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
      getHeader(name) { return this.headers[name.toLowerCase()]; } };
    const url = new URL(request.url());
    await handler({ method: request.method(), url: url.pathname + url.search,
      headers: { 'x-e2e-owner': owner, origin: 'http://localhost:4173' }, body: request.postData() || undefined }, res);
    return route.fulfill({ status: res.statusCode, json: res.body ?? {} });
  };
}

/** A entrada fica em Ajustes (Criar rápido) e em Visual (modos profissionais). */
async function entradaDaGaleria(page, botao) {
  const entrada = page.locator('[data-vc-template-gallery-entry]').first();
  if (!await entrada.isVisible().catch(() => false)) {
    const aba = page.getByRole('tab', { name: 'Ajustes', exact: true });
    if (await aba.isVisible().catch(() => false)) await aba.click();
    else await page.getByRole('button', { name: 'Abrir aba Ajustes', exact: true }).click();
  }
  await entrada.getByRole('button', { name: botao }).click();
}

const CONTA_A = { ...SESSAO_ATIVA, email: 'autora@teste.exemplo', customerId: 'cus_autora' };
const CONTA_B = { active: false, free: true, status: 'inactive', tier: 'free', email: 'gratis@teste.exemplo', customerId: 'cus_gratis',
  plan: { id: 'free', name: 'Plano Grátis', priceLabel: 'R$ 0', imageQuota: 0, projectLimit: 3 } };

async function abrir(page, sessao, projeto) {
  await mockApi(page, { session: sessao, extra: {
    '/api/templates': rotaReal(sessao.customerId),
    '/api/library-sync': (route) => route.fulfill({ json: { ok: true, empty: true, manifest: null, meta: null } }),
  } });
  await page.addInitScript(({ owner, projeto: p }) => {
    if (localStorage.getItem('vc_library') !== null) return;
    localStorage.setItem('vc_data_owner', JSON.stringify(owner));
    localStorage.setItem('vc_library', JSON.stringify([p]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(p.id));
  }, { owner: `email:${sessao.email}`, projeto });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
}

const projetoA = {
  id: 'proj-a', name: 'Clínica da autora', updatedAt: Date.now(),
  doc: { fmt: 'carrossel', brand: { name: 'Clínica da autora', handle: '@clinicaautora', titleFont: 'Playfair Display', bg: '#14213d', titleColor: '#fca311', textColor: '#e5e5e5' },
    caption: 'Legenda secreta da autora',
    slides: [
      { id: 'a1', title: 'Segredo da capa da autora', subtitle: 'Texto privado', layout: 'mc', align: 'center', titleSize: 130, textShadow: false },
      { id: 'a2', title: 'Miolo privado', subtitle: 'Mais texto privado', layout: 'ml', align: 'left', textShadow: false },
      { id: 'a3', title: 'Fechamento privado', subtitle: 'Contato privado', layout: 'mb', align: 'center', textShadow: false },
    ] },
};
const projetoB = {
  id: 'proj-b', name: 'Projeto da conta grátis', updatedAt: Date.now(),
  doc: { fmt: 'carrossel', brand: { name: 'Marca B', handle: '@marcab', titleFont: 'Inter', bg: '#ffffff', titleColor: '#000000' },
    slides: [1, 2, 3, 4].map((n) => ({ id: `b${n}`, title: `Texto ${n} da conta B`, subtitle: `Apoio ${n} de B`, layout: 'mt', align: 'right', textShadow: false })) },
};

test('A publica, B (plano grátis) encontra e aplica mantendo os próprios textos, A despublica e o modelo some', async ({ browser }) => {
  // ── Conta A publica o visual do projeto ─────────────────────────────────
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const pageA = await ctxA.newPage();
  await abrir(pageA, CONTA_A, projetoA);
  await entradaDaGaleria(pageA, 'Publicar como modelo');
  const galeriaA = pageA.getByRole('dialog', { name: 'Galeria de modelos' });
  await expect(galeriaA.getByText('Fica de fora:')).toBeVisible();
  // Prévia com texto do Moont, nunca o da autora.
  await expect(galeriaA.getByLabel('Prévia do modelo')).not.toContainText('Segredo');
  await pageA.waitForTimeout(700);
  await capturar(pageA, '1-publicar');
  await galeriaA.getByLabel('Nome do modelo').fill('Editorial azul e laranja');
  await galeriaA.getByLabel('Mostrar meu nome na galeria').check();
  await galeriaA.getByLabel('Nome que aparece').fill('Ana Designer');
  await galeriaA.getByRole('button', { name: 'Publicar na galeria' }).click();
  await expect(galeriaA.getByRole('list', { name: 'Meus modelos' })).toContainText('Editorial azul e laranja');
  await expect(galeriaA.getByRole('tab', { name: 'Meus modelos' })).toHaveAttribute('aria-selected', 'true');
  await pageA.waitForTimeout(500);
  await capturar(pageA, '2-meus-modelos');

  const [gravado] = (await db.query('SELECT owner_id, content FROM moont.published_templates')).rows;
  expect(gravado.owner_id).toBe('cus_autora');
  const json = JSON.stringify(gravado.content);
  for (const privado of ['Segredo', 'privado', 'clinicaautora', 'Clínica da autora', 'Legenda secreta']) expect(json).not.toContain(privado);

  // ── Conta B, no plano grátis, encontra e aplica ─────────────────────────
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const pageB = await ctxB.newPage();
  await abrir(pageB, CONTA_B, projetoB);
  await entradaDaGaleria(pageB, 'Galeria de modelos');
  const galeriaB = pageB.getByRole('dialog', { name: 'Galeria de modelos' });
  const item = galeriaB.getByRole('listitem', { name: 'Modelo Editorial azul e laranja' });
  await expect(item).toContainText('por Ana Designer');
  await expect(item).not.toContainText('Segredo');
  await capturar(pageB, '3-galeria');
  await item.getByRole('button', { name: 'Aplicar modelo Editorial azul e laranja' }).click();
  await capturar(pageB, '4-confirmar');
  await galeriaB.getByRole('alertdialog', { name: 'Aplicar modelo' }).getByRole('button', { name: 'Aplicar modelo' }).click();
  await expect(galeriaB).toHaveCount(0);

  await expect.poll(async () => pageB.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('vc_library') || '[]');
    return lib.find((e) => e.id === 'proj-b')?.doc?.slides?.map((s) => [s.title, s.layout, s.align]);
  }), { timeout: 15_000 }).toEqual([
    ['Texto 1 da conta B', 'mc', 'center'], // capa do modelo
    ['Texto 2 da conta B', 'ml', 'left'],   // conteúdo
    ['Texto 3 da conta B', 'ml', 'left'],   // conteúdo repetido
    ['Texto 4 da conta B', 'mb', 'center'], // fechamento
  ]);
  const docB = await pageB.evaluate(() => JSON.parse(localStorage.getItem('vc_library')).find((e) => e.id === 'proj-b').doc);
  expect(docB.brand).toMatchObject({ name: 'Marca B', handle: '@marcab', titleFont: 'Playfair Display', bg: '#14213d' });
  await expect(pageB.locator('main [data-vc-card-surface="b1"]')).toContainText('Texto 1 da conta B');
  await pageB.waitForTimeout(800);
  await capturar(pageB, '5-aplicado');
  expect((await db.query('SELECT use_count FROM moont.published_templates')).rows[0].use_count).toBe(1);

  // B não vê o modelo em "Meus modelos" nem consegue apagá-lo.
  await entradaDaGaleria(pageB, 'Galeria de modelos');
  await pageB.getByRole('dialog', { name: 'Galeria de modelos' }).getByRole('tab', { name: 'Meus modelos' }).click();
  await expect(pageB.getByRole('dialog', { name: 'Galeria de modelos' })).toContainText('Você ainda não publicou modelos.');
  const id = (await db.query('SELECT id FROM moont.published_templates')).rows[0].id;
  const tentativa = await pageB.evaluate(async (tplId) => (await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', id: tplId }) })).status, id);
  expect(tentativa).toBe(404);

  // ── A despublica; o modelo some da galeria de B ─────────────────────────
  pageA.once('dialog', (dialog) => dialog.accept());
  await galeriaA.getByRole('button', { name: 'Despublicar modelo Editorial azul e laranja' }).click();
  await expect(galeriaA).toContainText('Você ainda não publicou modelos.');
  await pageB.getByRole('dialog', { name: 'Galeria de modelos' }).getByRole('tab', { name: 'Galeria' }).click();
  await expect(pageB.getByRole('dialog', { name: 'Galeria de modelos' })).toContainText('Ainda não há modelos publicados');
  // O projeto de B que já usou o modelo não muda.
  const depois = await pageB.evaluate(() => JSON.parse(localStorage.getItem('vc_library')).find((e) => e.id === 'proj-b').doc.slides[0].layout);
  expect(depois).toBe('mc');
  await ctxA.close();
  await ctxB.close();
});

test('celular: galeria abre pelos Ajustes e cabe em 390 px', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await abrir(page, CONTA_A, projetoA);
  await entradaDaGaleria(page, 'Publicar como modelo');
  const galeria = page.getByRole('dialog', { name: 'Galeria de modelos' });
  await expect(galeria.getByRole('button', { name: 'Publicar na galeria' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const box = await galeria.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.waitForTimeout(700);
  await capturar(page, '6-celular-publicar');
  await ctx.close();
});
