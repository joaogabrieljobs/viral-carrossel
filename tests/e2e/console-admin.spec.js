// Console admin de ponta a ponta (docs/product/console-admin.md). O navegador
// fala com a rota real (api/admin.js) e a loja real, sobre PGlite com todas as
// migrações. Só a sessão e o envio do e-mail são simulados.
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createAdminHandler } from '../../api/admin.js';
import { createAdminStore } from '../../api/lib/admin-store.js';
import { createAccountEntitlementStore } from '../../api/lib/account-entitlements.js';
import { createTemplatesHandler } from '../../api/templates.js';
import { createPublishedTemplatesStore } from '../../api/lib/published-templates-store.js';
import { resetRateLimits } from '../../api/lib/rate-limit.js';

test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);
const capturar = async (page, nome) => {
  if (!process.env.MOONT_CAPTURAS) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/admin-${nome}.png`, fullPage: true });
};

const ADMIN = 'cus_admin';
const COMUM = 'cus_comum';
const CLIENTE_ID = '33333333-3333-4333-8333-333333333333';

let db;
let adminHandler;
let templatesHandler;
let emails = [];

test.beforeAll(async () => {
  db = new PGlite();
  const dir = new URL('../../db/migrations/', import.meta.url);
  for (const arquivo of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(arquivo, dir), 'utf8'));
  }
  const sql = {
    unsafe: (statement, params = []) => db.query(statement, params).then((r) => r.rows),
    begin: (work) => db.transaction((tx) => work({ unsafe: (statement, params = []) => tx.query(statement, params).then((r) => r.rows) })),
  };
  const readAccess = async (req) => (req.headers['x-e2e-owner'] ? { customerId: req.headers['x-e2e-owner'], email: 'joao@teste.exemplo' } : null);
  const entitlements = createAccountEntitlementStore({ sql });
  adminHandler = createAdminHandler({
    store: createAdminStore({ sql, env: {} }),
    readAccess,
    grant: (input, hooks) => entitlements.grantAccess(input, hooks),
    revoke: (input, hooks) => entitlements.revokeAccess(input, hooks),
    sendCode: async (mail) => { emails.push(mail); },
    countSubscriptions: async () => ({ total: 12, byTier: { creator: 8, pro: 3, max: 1 } }),
    findSubscription: async () => ({ status: 'none' }),
  });
  templatesHandler = createTemplatesHandler({ store: createPublishedTemplatesStore({ sql }), readAccess });

  await db.exec(`INSERT INTO moont.admin_roles (owner_id, role, granted_by, reason) VALUES ('${ADMIN}', 'admin', 'teste', 'teste')`);
  await db.query(`INSERT INTO moont.accounts (id, primary_email) VALUES ($1::uuid, 'cliente@empresa.exemplo')`, [CLIENTE_ID]);
  await db.query(`INSERT INTO moont.account_stripe_customers (stripe_customer_id, account_id, verified_at) VALUES ('cus_cliente', $1::uuid, now())`, [CLIENTE_ID]);
  await db.query(`INSERT INTO moont.account_identities (account_id, provider, provider_subject, email_normalized, migration_source)
    VALUES ($1::uuid, 'google', 'sub-123', 'cliente@empresa.exemplo', 'registration')`, [CLIENTE_ID]);
  await db.query(`INSERT INTO moont.image_quota_periods (owner_id, period_start_sec, used, legacy_used) VALUES ('cus_cliente', $1, 46, 0)`,
    [Math.floor(Date.now() / 1000) - 5 * 86400]);
});
test.afterAll(async () => { await db?.close(); });
test.beforeEach(() => { resetRateLimits(); emails = []; });

function rotaReal(handler, owner) {
  return async (route) => {
    const request = route.request();
    const res = { statusCode: 200, headers: {}, body: undefined,
      status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; },
      end() { return this; }, setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
      getHeader(name) { return this.headers[name.toLowerCase()]; } };
    const url = new URL(request.url());
    await handler({ method: request.method(), url: url.pathname + url.search,
      headers: { ...(owner ? { 'x-e2e-owner': owner } : {}), origin: 'http://localhost:4173' }, body: request.postData() || undefined }, res);
    return route.fulfill({ status: res.statusCode, json: res.body ?? {} });
  };
}

async function abrir(page, owner) {
  await page.route('**/api/admin**', rotaReal(adminHandler, owner));
  await page.route('**/api/templates**', rotaReal(templatesHandler, owner));
  await page.goto('/admin');
}

test('conta comum em /admin vê "página não encontrada" e o console nem é baixado', async ({ page }) => {
  const scripts = [];
  page.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(r.url()); });
  await abrir(page, COMUM);
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
  expect(scripts.some((u) => /AdminConsole/.test(u))).toBe(false);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

test('admin vê os números, abre uma conta, concede Max sem limite com o código do e-mail e revoga', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await abrir(page, ADMIN);
  await expect(page.getByRole('heading', { name: 'Console admin' })).toBeVisible();
  const inicio = page.getByRole('region', { name: 'Início' });
  await expect(inicio).toContainText('Assinaturas ativas');
  await expect(inicio).toContainText('Criador 8, Pro 3, Max 1');
  await capturar(page, '1-inicio');

  await page.getByRole('tab', { name: 'Contas' }).click();
  await page.getByLabel('Buscar por e-mail ou cliente Stripe').fill('empresa');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByRole('table', { name: 'Contas encontradas' }).getByRole('button', { name: 'cliente@empresa.exemplo' }).click();
  const ficha = page.getByRole('region', { name: 'Ficha da conta' });
  await expect(ficha).toContainText('Plano grátis');
  await expect(ficha).toContainText('Google (cliente@empresa.exemplo)');
  await expect(ficha).toContainText('46');

  const conceder = ficha.getByRole('group', { name: 'Conceder isenção' });
  await conceder.getByLabel('Plano').selectOption('max');
  await conceder.getByLabel(/Sem limite de imagens/).check();
  await expect(conceder.getByRole('button', { name: 'Pedir código e conceder' })).toBeDisabled();
  await conceder.getByLabel('Motivo (fica na trilha)').fill('Conta do dono, sem limite');
  await conceder.getByRole('button', { name: 'Pedir código e conceder' }).click();
  await expect(conceder).toContainText('Enviamos um código para jo••@teste.exemplo');
  expect(emails).toHaveLength(1);
  await capturar(page, '2-codigo');
  await conceder.getByLabel('Código de 6 dígitos').fill('000000' === emails[0].code ? '111111' : '000000');
  await conceder.getByRole('button', { name: 'Confirmar' }).click();
  await expect(conceder.getByRole('alert')).toHaveText('Código incorreto.');
  await conceder.getByLabel('Código de 6 dígitos').fill(emails[0].code);
  await conceder.getByRole('button', { name: 'Confirmar' }).click();
  await expect(ficha).toContainText('Isenta · Max · sem limite de imagens');
  await capturar(page, '3-isenta');

  await ficha.getByLabel('Motivo para revogar').fill('Fim do teste');
  await ficha.getByRole('button', { name: 'Pedir código e revogar' }).click();
  await ficha.getByLabel('Código de 6 dígitos').fill(emails[1].code);
  await ficha.getByRole('button', { name: 'Confirmar' }).click();
  await expect(ficha).toContainText('Plano grátis');
  await expect(ficha).toContainText('revogada em');

  await page.getByRole('tab', { name: 'Trilha' }).click();
  const trilha = page.getByRole('table', { name: 'Trilha do console' });
  await expect(trilha).toContainText('Revogou isenção');
  await expect(trilha).toContainText('Concedeu isenção');
  await expect(trilha).toContainText('Abriu a ficha');
  await capturar(page, '4-trilha');

  await page.getByRole('tab', { name: 'Saúde' }).click();
  await expect(page.getByRole('region', { name: 'Saúde' })).toContainText('Reservas de imagem presas');
  await page.getByRole('tab', { name: 'Moderação' }).click();
  await expect(page.getByRole('region', { name: 'Moderação de modelos' })).toContainText('Nenhuma denúncia para revisar.');
});

test('celular: console cabe em 390 px, com cards no lugar de tabela', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await abrir(page, ADMIN);
  await expect(page.getByRole('heading', { name: 'Console admin' })).toBeVisible();
  await page.getByRole('tab', { name: 'Contas' }).click();
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByRole('list', { name: 'Contas encontradas' })).toContainText('cliente@empresa.exemplo');
  const larguras = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vista: window.innerWidth }));
  expect(larguras.doc).toBeLessThanOrEqual(larguras.vista);
  await capturar(page, '5-celular');
  await ctx.close();
});
