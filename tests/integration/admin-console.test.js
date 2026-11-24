// Console admin (docs/product/console-admin.md) contra Postgres de verdade
// (PGlite) com todas as migrações: papéis, trilha imutável, código por e-mail
// e isenção na mesma transação que a trilha.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';

// PGlite com todas as migrações fica lento com a máquina carregada.
vi.setConfig({ testTimeout: 30_000 });
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { makeReq, makeRes } from '../helpers/http.js';
import { createAdminHandler } from '../../api/admin.js';
import { createAdminStore } from '../../api/lib/admin-store.js';
import { createAccountEntitlementStore } from '../../api/lib/account-entitlements.js';
import { createPublishedTemplatesStore } from '../../api/lib/published-templates-store.js';
import { resetRateLimits } from '../../api/lib/rate-limit.js';

const ADMIN = 'cus_admin';
const SUPORTE = 'cus_suporte';
const COMUM = 'cus_comum';
const EMERGENCIA = 'cus_emergencia';
const CLIENTE_ID = '33333333-3333-4333-8333-333333333333';
const CLIENTE = 'cus_cliente';

let db;
let sql;
let clock;
let emails;
let subscriptions;
let findSub;
let prices;
let handler;

beforeAll(async () => {
  db = new PGlite();
  const dir = new URL('../../db/migrations/', import.meta.url);
  for (const arquivo of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(arquivo, dir), 'utf8'));
  }
  sql = {
    unsafe: (statement, params = []) => db.query(statement, params).then((r) => r.rows),
    begin: (work) => db.transaction((tx) => work({ unsafe: (statement, params = []) => tx.query(statement, params).then((r) => r.rows) })),
  };
  const entitlements = createAccountEntitlementStore({ sql });
  handler = createAdminHandler({
    store: createAdminStore({ sql, env: { MOONT_ADMIN_ACCOUNTS: EMERGENCIA } }),
    readAccess: async (req) => (req.headers['x-test-owner'] ? { customerId: req.headers['x-test-owner'], email: `${req.headers['x-test-owner']}@teste.exemplo` } : null),
    grant: (input, hooks) => entitlements.grantAccess(input, hooks),
    revoke: (input, hooks) => entitlements.revokeAccess(input, hooks),
    sendCode: async (mail) => { emails.push(mail); },
    countSubscriptions: async () => subscriptions(),
    findSubscription: async (customerId) => findSub(customerId),
    checkPrices: async () => prices(),
    now: () => clock,
  });
}, 60_000);

afterAll(async () => { await db?.close(); });

beforeEach(async () => {
  resetRateLimits();
  clock = Date.parse('2026-11-19T12:00:00Z');
  emails = [];
  subscriptions = async () => ({ total: 4, byTier: { creator: 3, max: 1 } });
  findSub = async () => ({ status: 'none' });
  prices = async () => ({ checked: 4, ok: true, divergences: [], unconfigured: [] });
  // Trilha é imutável por trigger: cada teste recria só o que pode.
  await db.exec(`
    DROP TRIGGER IF EXISTS admin_actions_append_only ON moont.admin_actions;
    DROP TRIGGER IF EXISTS account_access_grant_events_append_only ON moont.account_access_grant_events;
    TRUNCATE moont.admin_actions, moont.admin_challenges, moont.admin_roles, moont.account_access_grant_events CASCADE;
    CREATE TRIGGER admin_actions_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON moont.admin_actions
      FOR EACH STATEMENT EXECUTE FUNCTION moont.prevent_admin_action_mutation();
    CREATE TRIGGER account_access_grant_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON moont.account_access_grant_events
      FOR EACH STATEMENT EXECUTE FUNCTION moont.prevent_access_grant_event_mutation();
    DELETE FROM moont.account_access_grants; DELETE FROM moont.image_quota_operations; DELETE FROM moont.image_quota_periods;
    DELETE FROM moont.account_identities; DELETE FROM moont.account_stripe_customers; DELETE FROM moont.accounts;
    DELETE FROM moont.template_moderators;
  `);
  await sql.unsafe(`INSERT INTO moont.admin_roles (owner_id, role, granted_by, reason) VALUES
    ($1, 'admin', 'teste', 'teste'), ($2, 'suporte', 'teste', 'teste')`, [ADMIN, SUPORTE]);
  await sql.unsafe(`INSERT INTO moont.accounts (id, primary_email) VALUES ($1::uuid, 'cliente@empresa.exemplo')`, [CLIENTE_ID]);
  await sql.unsafe(`INSERT INTO moont.account_stripe_customers (stripe_customer_id, account_id, verified_at) VALUES ($1, $2::uuid, now())`, [CLIENTE, CLIENTE_ID]);
  await sql.unsafe(`INSERT INTO moont.account_identities (account_id, provider, provider_subject, email_normalized, migration_source)
    VALUES ($1::uuid, 'password', $2, 'cliente@empresa.exemplo', 'registration')`, [CLIENTE_ID, CLIENTE]);
  const inicioCiclo = Math.floor(Date.parse('2026-11-10T00:00:00Z') / 1000);
  await sql.unsafe(`INSERT INTO moont.image_quota_periods (owner_id, period_start_sec, used, legacy_used) VALUES ($1, $2, 46, 0)`, [CLIENTE, inicioCiclo]);
});

async function call(ownerId, { method = 'GET', url = '/api/admin', body } = {}) {
  const res = makeRes();
  await handler(makeReq({ method, url, body, headers: ownerId ? { 'x-test-owner': ownerId } : {} }), res);
  return res;
}

const pedido = { accountId: CLIENTE_ID, tier: 'max', unlimitedImages: true, reason: 'Conta do dono, sem limite' };
async function pedirCodigo(owner = ADMIN, intent = 'grant', payload = pedido) {
  const res = await call(owner, { method: 'POST', body: { action: 'challenge', intent, payload } });
  return { res, code: emails.at(-1)?.code, challengeId: res.body?.challengeId };
}

describe('console admin — quem entra', () => {
  it('sem sessão ou sem papel, toda a rota responde 404 como se não existisse', async () => {
    for (const conta of [null, COMUM]) {
      for (const url of ['/api/admin?view=me', '/api/admin?view=overview', `/api/admin?view=account&id=${CLIENTE_ID}`]) {
        expect((await call(conta, { url })).statusCode).toBe(404);
      }
      expect((await call(conta, { method: 'POST', body: { action: 'challenge', intent: 'grant', payload: pedido } })).statusCode).toBe(404);
    }
    expect(emails).toEqual([]);
    expect(await sql.unsafe('SELECT * FROM moont.admin_actions')).toEqual([]);
  });

  it('a conta de emergência (variável de ambiente) entra como admin sem linha no banco', async () => {
    expect((await call(EMERGENCIA, { url: '/api/admin?view=me' })).body).toMatchObject({ role: 'admin' });
  });

  it('papel revogado não entra', async () => {
    await sql.unsafe(`UPDATE moont.admin_roles SET revoked_at = now(), revoked_by = 'teste' WHERE owner_id = $1`, [SUPORTE]);
    expect((await call(SUPORTE, { url: '/api/admin?view=me' })).statusCode).toBe(404);
  });

  it('suporte consulta tudo mas não pede código nem concede', async () => {
    expect((await call(SUPORTE, { url: '/api/admin?view=overview' })).statusCode).toBe(200);
    expect((await call(SUPORTE, { url: '/api/admin?view=accounts&q=cliente' })).body.accounts).toHaveLength(1);
    const negado = await call(SUPORTE, { method: 'POST', body: { action: 'challenge', intent: 'grant', payload: pedido } });
    expect(negado.statusCode).toBe(403);
    expect(emails).toEqual([]);
  });
});

describe('console admin — leitura', () => {
  it('início: números do banco e do Stripe; fonte fora vira "—" com motivo, nunca zero', async () => {
    const ok = (await call(ADMIN, { url: '/api/admin?view=overview' })).body;
    expect(ok.accounts.value).toMatchObject({ total: 1, last7: 1 });
    expect(ok.subscriptions.value).toEqual({ total: 4, byTier: { creator: 3, max: 1 } });
    subscriptions = async () => { throw new Error('stripe fora'); };
    const fora = (await call(ADMIN, { url: '/api/admin?view=overview' })).body;
    expect(fora.subscriptions).toMatchObject({ value: null, reason: expect.any(String) });
    expect(fora.accounts.value.total).toBe(1);
  });

  it('busca por e-mail e abre a ficha; abrir a ficha fica na trilha', async () => {
    const busca = (await call(ADMIN, { url: '/api/admin?view=accounts&q=EMPRESA.exemplo' })).body;
    expect(busca.accounts.map((a) => a.id)).toEqual([CLIENTE_ID]);
    const ficha = (await call(ADMIN, { url: `/api/admin?view=account&id=${CLIENTE_ID}` })).body.account;
    expect(ficha).toMatchObject({ email: 'cliente@empresa.exemplo', customerId: CLIENTE, grants: [] });
    expect(ficha.quota.value[0]).toMatchObject({ used: 46 });
    expect(JSON.stringify(ficha)).not.toContain('password_hash');
    const trilha = await sql.unsafe('SELECT actor_id, action, target FROM moont.admin_actions');
    expect(trilha).toEqual([{ actor_id: ADMIN, action: 'view_account', target: CLIENTE_ID }]);
    expect((await call(ADMIN, { url: '/api/admin?view=account&id=nao-e-uuid' })).statusCode).toBe(400);
  });

  // MOO-39: a ficha lia as 3 últimas linhas e a tela mostrava v[0] como
  // "ciclo atual" mesmo quando era um ciclo já encerrado.
  it('ficha mostra como ciclo atual só o ciclo vigente; ciclo encerrado fica no histórico', async () => {
    await sql.unsafe('DELETE FROM moont.image_quota_periods');
    const inicio = Math.floor(Date.parse('2026-09-10T00:00:00Z') / 1000);
    const fim = Math.floor(Date.parse('2026-10-10T00:00:00Z') / 1000);
    await sql.unsafe(`INSERT INTO moont.image_quota_periods (owner_id, period_start_sec, period_end_sec, used, legacy_used)
      VALUES ($1, $2, $3, 30, 0)`, [CLIENTE, inicio, fim]);
    const ficha = (await call(ADMIN, { url: `/api/admin?view=account&id=${CLIENTE_ID}` })).body.account;
    expect(ficha.quota.value).toEqual([]);
    expect(ficha.quota.history).toEqual([
      expect.objectContaining({ used: 30, current: false, periodStart: '2026-09-10T00:00:00.000Z', periodEnd: '2026-10-10T00:00:00.000Z' }),
    ]);
  });

  it('ciclo sem fim gravado só conta como atual se começou há menos de um mês', async () => {
    await sql.unsafe('DELETE FROM moont.image_quota_periods');
    const antigo = Math.floor(Date.parse('2026-08-01T00:00:00Z') / 1000);
    await sql.unsafe(`INSERT INTO moont.image_quota_periods (owner_id, period_start_sec, used, legacy_used)
      VALUES ($1, $2, 12, 0)`, [CLIENTE, antigo]);
    const ficha = (await call(ADMIN, { url: `/api/admin?view=account&id=${CLIENTE_ID}` })).body.account;
    expect(ficha.quota.value).toEqual([]);
    expect(ficha.quota.history[0]).toMatchObject({ used: 12, current: false });
  });

  it('quando o Stripe informa o início do ciclo, ele decide qual linha é a atual', async () => {
    findSub = async () => ({ status: 'active', tier: 'creator', periodStartSec: Math.floor(Date.parse('2026-11-15T00:00:00Z') / 1000) });
    const ficha = (await call(ADMIN, { url: `/api/admin?view=account&id=${CLIENTE_ID}` })).body.account;
    // A linha de 10/11 não é o ciclo que o Stripe diz estar vigente.
    expect(ficha.quota.value).toEqual([]);
    expect(ficha.quota.history[0]).toMatchObject({ used: 46, current: false });
    findSub = async () => ({ status: 'active', tier: 'creator', periodStartSec: Math.floor(Date.parse('2026-11-10T00:00:00Z') / 1000) });
    const atual = (await call(ADMIN, { url: `/api/admin?view=account&id=${CLIENTE_ID}` })).body.account;
    expect(atual.quota.value).toEqual([expect.objectContaining({ used: 46, current: true })]);
  });

  it('saúde e trilha respondem sem erro com o banco vazio', async () => {
    const saude = (await call(ADMIN, { url: '/api/admin?view=health' })).body;
    expect(saude.stuckReservations.value).toEqual({ count: 0, oldest: null });
    expect(saude.agentJobs.value).toEqual({ failedByCode: [], stuckPending: 0 });
    expect((await call(ADMIN, { url: '/api/admin?view=actions' })).body.actions).toEqual([]);
  });

  // MOO-38: a Saúde confere o preço da tela com o price do Stripe.
  it('saúde mostra divergências de preço; Stripe fora vira "—" com motivo, sem derrubar a visão', async () => {
    prices = async () => ({ checked: 1, ok: false, divergences: [{ tier: 'pro', priceId: 'price_pro', screen: 'R$ 197', issues: ['x'] }], unconfigured: [] });
    const saude = (await call(ADMIN, { url: '/api/admin?view=health' })).body;
    expect(saude.planPrices).toMatchObject({ source: 'Stripe: preços dos planos', value: { ok: false, divergences: [{ tier: 'pro' }] } });
    prices = async () => { throw new Error('stripe fora'); };
    const fora = (await call(ADMIN, { url: '/api/admin?view=health' })).body;
    expect(fora.planPrices).toMatchObject({ value: null, reason: expect.any(String) });
    expect(fora.stuckReservations.value).toEqual({ count: 0, oldest: null });
  });
});

describe('console admin — isenção com código por e-mail', () => {
  it('concede Max sem limite com o código certo, na mesma transação da trilha, mantendo o ciclo da cota', async () => {
    const { res, code, challengeId } = await pedirCodigo();
    expect(res.body).toMatchObject({ sentTo: expect.stringMatching(/^cu•+@teste\.exemplo$/), expiresInMinutes: 10 });
    expect(emails[0]).toMatchObject({ to: `${ADMIN}@teste.exemplo`, intent: 'grant' });
    expect(code).toMatch(/^\d{6}$/);
    expect(JSON.stringify(res.body)).not.toContain(code);

    const ok = await call(ADMIN, { method: 'POST', body: { action: 'grant', challengeId, code, ...pedido } });
    expect(ok.statusCode).toBe(200);
    expect(ok.body.grant).toMatchObject({ tier: 'max', unlimitedImages: true });
    const [g] = await sql.unsafe('SELECT tier, unlimited_images, quota_anchor_sec, actor FROM moont.account_access_grants');
    expect(g).toMatchObject({ tier: 'max', unlimited_images: true, actor: `admin:${ADMIN}` });
    expect(Number(g.quota_anchor_sec)).toBe(Math.floor(Date.parse('2026-11-10T00:00:00Z') / 1000));
    const trilha = await sql.unsafe(`SELECT action, target, reason, details FROM moont.admin_actions WHERE action = 'grant_exemption'`);
    expect(trilha).toEqual([{ action: 'grant_exemption', target: CLIENTE_ID, reason: pedido.reason,
      details: { grantId: ok.body.grant.id, tier: 'max', unlimitedImages: true } }]);

    // O mesmo código não serve duas vezes.
    expect((await call(ADMIN, { method: 'POST', body: { action: 'grant', challengeId, code, ...pedido } })).statusCode).toBe(403);
    // Com isenção ativa, outra concessão pede revogar antes.
    const outro = await pedirCodigo();
    const conflito = await call(ADMIN, { method: 'POST', body: { action: 'grant', challengeId: outro.challengeId, code: outro.code, ...pedido } });
    expect(conflito.statusCode).toBe(409);
    expect((await sql.unsafe('SELECT used_at FROM moont.admin_challenges WHERE id = $1::uuid', [outro.challengeId]))[0].used_at).toBeNull();
  });

  it('código errado, de outra ação, de outro admin ou vencido não concede nada', async () => {
    const { code, challengeId } = await pedirCodigo();
    const errado = String((Number(code) + 1) % 1_000_000).padStart(6, '0');
    expect((await call(ADMIN, { method: 'POST', body: { action: 'grant', challengeId, code: errado, ...pedido } })).body.code).toBe('admin_code_invalid');
    expect((await sql.unsafe('SELECT attempts FROM moont.admin_challenges'))[0].attempts).toBe(1);
    // Código pedido para "sem limite", usado para Pro com limite: recusado.
    expect((await call(ADMIN, { method: 'POST', body: { action: 'grant', challengeId, code, ...pedido, tier: 'pro', unlimitedImages: false } })).body.code).toBe('admin_code_mismatch');
    // Outro admin não usa o código de quem pediu.
    expect((await call(EMERGENCIA, { method: 'POST', body: { action: 'grant', challengeId, code, ...pedido } })).statusCode).toBe(403);
    clock += 11 * 60_000;
    expect((await call(ADMIN, { method: 'POST', body: { action: 'grant', challengeId, code, ...pedido } })).body.code).toBe('admin_code_expired');
    expect(await sql.unsafe('SELECT id FROM moont.account_access_grants')).toEqual([]);
    expect(await sql.unsafe(`SELECT id FROM moont.admin_actions WHERE action = 'grant_exemption'`)).toEqual([]);
  });

  it('cinco erros travam o código', async () => {
    const { code, challengeId } = await pedirCodigo();
    const errado = String((Number(code) + 1) % 1_000_000).padStart(6, '0');
    for (let i = 0; i < 5; i += 1) await call(ADMIN, { method: 'POST', body: { action: 'grant', challengeId, code: errado, ...pedido } });
    expect((await call(ADMIN, { method: 'POST', body: { action: 'grant', challengeId, code, ...pedido } })).body.code).toBe('admin_code_locked');
  });

  // AUTH-04 (auditoria 23/11): a tentativa era contada depois da transação
  // desfeita, em outra consulta. Pedidos em paralelo liam o contador antes do
  // incremento do anterior e passavam todos do teto de 5.
  it('20 palpites em paralelo: só 5 chegam a ser comparados e o código trava', async () => {
    const { code, challengeId } = await pedirCodigo();
    const palpite = (i) => String((Number(code) + 1 + i) % 1_000_000).padStart(6, '0');
    const respostas = await Promise.all(Array.from({ length: 20 }, (_, i) =>
      call(ADMIN, { method: 'POST', body: { action: 'grant', challengeId, code: palpite(i), ...pedido } })));
    const codigos = respostas.map((r) => r.body.code);
    expect(codigos.filter((c) => c === 'admin_code_invalid')).toHaveLength(5);
    expect(codigos.filter((c) => c === 'admin_code_locked')).toHaveLength(15);
    expect((await sql.unsafe('SELECT attempts FROM moont.admin_challenges'))[0].attempts).toBe(5);
    expect((await call(ADMIN, { method: 'POST', body: { action: 'grant', challengeId, code, ...pedido } })).body.code).toBe('admin_code_locked');
    expect(await sql.unsafe('SELECT id FROM moont.account_access_grants')).toEqual([]);
  });

  it('revoga com código e trilha', async () => {
    const c1 = await pedirCodigo();
    const grantId = (await call(ADMIN, { method: 'POST', body: { action: 'grant', challengeId: c1.challengeId, code: c1.code, ...pedido } })).body.grant.id;
    const revogar = { accountId: CLIENTE_ID, grantId, reason: 'Fim do teste' };
    const c2 = await pedirCodigo(ADMIN, 'revoke', revogar);
    const ok = await call(ADMIN, { method: 'POST', body: { action: 'revoke', challengeId: c2.challengeId, code: c2.code, ...revogar } });
    expect(ok.body).toMatchObject({ revoked: true });
    expect((await sql.unsafe('SELECT revoked_at FROM moont.account_access_grants'))[0].revoked_at).not.toBeNull();
    expect((await call(ADMIN, { url: '/api/admin?view=grants' })).body.grants).toEqual([]);
    const acoes = (await call(ADMIN, { url: `/api/admin?view=actions&target=${CLIENTE_ID}` })).body.actions.map((a) => a.action);
    expect(acoes).toEqual(['revoke_exemption', 'grant_exemption']);
  });

  it('motivo é obrigatório', async () => {
    const res = await call(ADMIN, { method: 'POST', body: { action: 'challenge', intent: 'grant', payload: { ...pedido, reason: '   ' } } });
    expect(res.statusCode).toBe(400);
    expect(emails).toEqual([]);
  });
});

describe('console admin — trilha e moderação', () => {
  it('a trilha não aceita alteração nem exclusão', async () => {
    await call(ADMIN, { url: `/api/admin?view=account&id=${CLIENTE_ID}` });
    await expect(sql.unsafe(`UPDATE moont.admin_actions SET reason = 'apagado'`)).rejects.toThrow(/não aceita/);
    await expect(sql.unsafe('DELETE FROM moont.admin_actions')).rejects.toThrow(/não aceita/);
  });

  it('quem tem papel no console modera modelos; papel revogado deixa de moderar', async () => {
    const templates = createPublishedTemplatesStore({ sql });
    expect(await templates.isModerator(ADMIN)).toBe(true);
    expect(await templates.isModerator(SUPORTE)).toBe(true);
    expect(await templates.isModerator(COMUM)).toBe(false);
    await sql.unsafe(`UPDATE moont.admin_roles SET revoked_at = now(), revoked_by = 'teste' WHERE owner_id = $1`, [ADMIN]);
    expect(await templates.isModerator(ADMIN)).toBe(false);
  });
});

// MOO-19 (auditoria 20/11): o documento diz que ação contra outra conta admin
// é recusada, mas o handler aceitava, inclusive o admin isentar a si mesmo.
describe('MOO-19 — admin não concede isenção a si nem age sobre outro admin', () => {
  const ADMIN_CONTA = '44444444-4444-4444-8444-444444444444';
  beforeEach(async () => {
    await sql.unsafe(`INSERT INTO moont.accounts (id, primary_email) VALUES ($1::uuid, 'admin@empresa.exemplo')`, [ADMIN_CONTA]);
    await sql.unsafe(`INSERT INTO moont.account_stripe_customers (stripe_customer_id, account_id, verified_at) VALUES ($1, $2::uuid, now())`, [ADMIN, ADMIN_CONTA]);
  });

  it('isenção para a própria conta responde 403 e não cria concessão', async () => {
    const proprio = { ...pedido, accountId: ADMIN_CONTA };
    const { code, challengeId } = await pedirCodigo(ADMIN, 'grant', proprio);
    const res = await call(ADMIN, { method: 'POST', body: { action: 'grant', challengeId, code, ...proprio } });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('admin_target_forbidden');
    expect(await sql.unsafe('SELECT id FROM moont.account_access_grants WHERE account_id = $1::uuid', [ADMIN_CONTA])).toEqual([]);
  });

  it('isenção para conta com papel de admin ou suporte responde 403', async () => {
    await sql.unsafe(`INSERT INTO moont.admin_roles (owner_id, role, granted_by, reason) VALUES ($1, 'suporte', 'teste', 'teste')`, [CLIENTE]);
    const { code, challengeId } = await pedirCodigo(ADMIN, 'grant', pedido);
    const res = await call(ADMIN, { method: 'POST', body: { action: 'grant', challengeId, code, ...pedido } });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('admin_target_forbidden');
  });
});
