/**
 * Console admin do Moont (docs/product/console-admin.md).
 *
 * Regras herdadas do console do MUSA:
 * - quem não tem papel não descobre que o console existe (404);
 * - número que não pôde ser lido volta como `null` com o motivo, nunca como 0;
 * - toda escrita grava `moont.admin_actions` na MESMA transação; a trilha é
 *   imutável (trigger na migração 018);
 * - ações de risco exigem código enviado ao e-mail do próprio admin (D1).
 */
import { createHash, randomInt } from 'node:crypto';
import { getPostgresConnection } from './postgres-connection.js';

export const ADMIN_PAGE_SIZE = 25;
export const CHALLENGE_TTL_MS = 10 * 60_000;
export const CHALLENGE_MAX_ATTEMPTS = 5;
export const ADMIN_TIERS = ['essential', 'creator', 'pro', 'max'];

const OWNER = /^[A-Za-z0-9_.-]{1,255}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUSTOMER = /^cus_[A-Za-z0-9_]{1,251}$/;

export const adminFail = (code, message, status = 400) => Object.assign(new Error(message), { code, status });
const notFound = () => adminFail('admin_not_found', 'Não encontrado.', 404);
const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex');
const iso = (value) => (value == null ? null : new Date(value).toISOString());
const num = (value) => (value == null ? null : Number(value));

/** Contas de emergência (env), como no MUSA: vencem a tabela e não dependem do banco. */
export function emergencyAdmins(env = process.env) {
  return new Set(String(env.MOONT_ADMIN_ACCOUNTS || '').split(/[\s,;]+/).map((s) => s.trim()).filter((s) => OWNER.test(s)));
}

/** Hash estável do que a ação vai fazer: o código vale só para aquele pedido exato. */
export function payloadHash(action, payload) {
  const keys = Object.keys(payload || {}).sort();
  return sha256(JSON.stringify([action, keys.map((k) => [k, payload[k] ?? null])]));
}

function cleanText(value, label, max = 500) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!text || text.length > max) throw adminFail('admin_bad_input', `${label} é obrigatório (até ${max} caracteres).`);
  return text;
}

/** Lê um número; se a fonte falhar, devolve null com o motivo (zero não é ausência). */
async function metric(source, read) {
  try { return { value: await read(), source }; }
  catch (error) {
    console.warn('[admin] métrica', source, error?.message || error);
    return { value: null, source, reason: 'Fonte indisponível agora.' };
  }
}

export function createAdminStore({ sql: injectedSql, env = process.env } = {}) {
  const connection = () => injectedSql || getPostgresConnection();
  const q = (statement, params = []) => connection().unsafe(statement, params);

  async function roleOf(ownerId) {
    if (typeof ownerId !== 'string' || !OWNER.test(ownerId)) return null;
    if (emergencyAdmins(env).has(ownerId)) return 'admin';
    const rows = await q(`/* admin_role */ SELECT role FROM moont.admin_roles WHERE owner_id = $1 AND revoked_at IS NULL`, [ownerId]);
    return rows[0]?.role || null;
  }

  async function recordAction(tx, { actorId, actorRole, action, target = null, reason, details = {} }) {
    await tx.unsafe(`/* admin_action */
      INSERT INTO moont.admin_actions (actor_id, actor_role, action, target, reason, details)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)`, [actorId, actorRole, action, target, reason, JSON.stringify(details)]);
  }

  async function overview({ countSubscriptions } = {}) {
    const [accounts, subscriptions, exempt, images, failures, templates] = await Promise.all([
      metric('Banco: contas', async () => {
        const [r] = await q(`SELECT count(*)::int AS total,
          count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS d7,
          count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS d30 FROM moont.accounts`);
        return { total: r.total, last7: r.d7, last30: r.d30 };
      }),
      metric('Stripe: assinaturas ativas', async () => {
        if (typeof countSubscriptions !== 'function') throw new Error('stripe_unavailable');
        return countSubscriptions();
      }),
      metric('Banco: isenções', async () => {
        const [r] = await q(`SELECT count(*)::int AS active,
          count(*) FILTER (WHERE unlimited_images)::int AS unlimited
          FROM moont.account_access_grants WHERE revoked_at IS NULL
            AND (expires_at_sec IS NULL OR expires_at_sec > extract(epoch FROM now()))`);
        return { active: r.active, unlimited: r.unlimited };
      }),
      metric('Banco: cota de imagens', async () => {
        const [r] = await q(`SELECT
          count(*) FILTER (WHERE status = 'consumed' AND created_at > now() - interval '30 days')::int AS d30,
          count(*) FILTER (WHERE status = 'consumed' AND created_at > now() - interval '7 days')::int AS d7
          FROM moont.image_quota_operations`);
        return { last7: r.d7, last30: r.d30 };
      }),
      metric('Banco: cota de imagens', async () => {
        const [r] = await q(`SELECT count(*)::int AS d7 FROM moont.image_quota_operations
          WHERE status = 'refunded' AND created_at > now() - interval '7 days'`);
        return { refunded7: r.d7 };
      }),
      metric('Banco: galeria de modelos', async () => {
        const [r] = await q(`SELECT count(*) FILTER (WHERE status = 'published')::int AS published,
          count(*) FILTER (WHERE status <> 'removed' AND (status = 'hidden' OR report_count > 0))::int AS pending
          FROM moont.published_templates`);
        return { published: r.published, pendingModeration: r.pending };
      }),
    ]);
    return { accounts, subscriptions, exempt, images, failures, templates };
  }

  async function searchAccounts({ query = '', page = 1 } = {}) {
    const term = String(query || '').trim().toLowerCase().slice(0, 120);
    const pageNumber = Math.max(1, Math.min(1000, Number.parseInt(page, 10) || 1));
    const offset = (pageNumber - 1) * ADMIN_PAGE_SIZE;
    const rows = await q(`/* admin_accounts */
      SELECT a.id, a.primary_email, a.created_at, s.stripe_customer_id,
        COALESCE((SELECT array_agg(DISTINCT i.provider) FROM moont.account_identities i WHERE i.account_id = a.id), '{}') AS providers,
        EXISTS (SELECT 1 FROM moont.account_access_grants g WHERE g.account_id = a.id AND g.revoked_at IS NULL
          AND (g.expires_at_sec IS NULL OR g.expires_at_sec > extract(epoch FROM now()))) AS exempt
      FROM moont.accounts a
      LEFT JOIN moont.account_stripe_customers s ON s.account_id = a.id
      WHERE $1 = ''
        OR lower(coalesce(a.primary_email, '')) LIKE '%' || $1 || '%'
        OR s.stripe_customer_id = $1
        OR EXISTS (SELECT 1 FROM moont.account_identities i WHERE i.account_id = a.id AND i.email_normalized LIKE '%' || $1 || '%')
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3`, [term.replace(/[%_\\]/g, ''), ADMIN_PAGE_SIZE + 1, offset]);
    return {
      page: pageNumber,
      hasMore: rows.length > ADMIN_PAGE_SIZE,
      accounts: rows.slice(0, ADMIN_PAGE_SIZE).map((r) => ({
        id: r.id, email: r.primary_email, createdAt: iso(r.created_at), customerId: r.stripe_customer_id || null,
        providers: Array.isArray(r.providers) ? r.providers : [], exempt: r.exempt === true,
      })),
    };
  }

  /** Ficha de uma conta. Abrir a ficha fica na trilha (leitura de dado pessoal). */
  async function getAccount(actor, accountId, { findSubscription, now = Date.now() } = {}) {
    if (!UUID.test(accountId || '')) throw adminFail('admin_bad_input', 'Conta inválida.');
    const [account] = await q(`SELECT a.id, a.primary_email, a.created_at, s.stripe_customer_id
      FROM moont.accounts a LEFT JOIN moont.account_stripe_customers s ON s.account_id = a.id WHERE a.id = $1::uuid`, [accountId]);
    if (!account) throw notFound();
    const customerId = account.stripe_customer_id || null;
    const [identities, grants, quota, library, billing, templates, role] = await Promise.all([
      q(`SELECT provider, email_normalized, created_at FROM moont.account_identities WHERE account_id = $1::uuid ORDER BY created_at`, [accountId]),
      q(`SELECT * FROM moont.account_access_grants WHERE account_id = $1::uuid ORDER BY created_at DESC LIMIT 20`, [accountId]),
      customerId ? metric('Banco: cota de imagens', () => q(`SELECT period_start_sec, period_end_sec, used FROM moont.image_quota_periods
        WHERE owner_id = $1 ORDER BY period_start_sec DESC LIMIT 3`, [customerId])) : { value: [], source: 'Banco: cota de imagens' },
      customerId ? metric('Banco: biblioteca', async () => (await q(`SELECT project_count, updated_at FROM moont.account_libraries WHERE owner_id = $1`, [customerId]))[0]
        // Sem linha na biblioteca: a conta nunca sincronizou, então são 0 projetos na nuvem (fato, não falha de leitura).
        || { project_count: 0, updated_at: null })
        : { value: null, source: 'Banco: biblioteca', reason: 'Conta sem cliente Stripe vinculado.' },
      customerId ? metric('Banco: avisos do Stripe', () => q(`SELECT event_type, object_status, received_at FROM moont.billing_events
        WHERE customer_id = $1 ORDER BY received_at DESC LIMIT 10`, [customerId])) : { value: [], source: 'Banco: avisos do Stripe' },
      customerId ? metric('Banco: galeria de modelos', async () => (await q(`SELECT count(*) FILTER (WHERE status <> 'removed')::int AS active,
        count(*) FILTER (WHERE status = 'removed')::int AS removed FROM moont.published_templates WHERE owner_id = $1`, [customerId]))[0])
        : { value: null, source: 'Banco: galeria de modelos' },
      customerId ? q(`SELECT role FROM moont.admin_roles WHERE owner_id = $1 AND revoked_at IS NULL`, [customerId]) : [],
    ]);
    const subscription = customerId && typeof findSubscription === 'function'
      ? await metric('Stripe: assinatura', () => findSubscription(customerId))
      : { value: null, source: 'Stripe: assinatura', reason: customerId ? 'Stripe indisponível.' : 'Conta sem cliente Stripe vinculado.' };

    await connection().begin((tx) => recordAction(tx, {
      actorId: actor.id, actorRole: actor.role, action: 'view_account', target: accountId,
      reason: 'Abriu a ficha da conta', details: {},
    }));

    return {
      id: account.id, email: account.primary_email, createdAt: iso(account.created_at), customerId,
      role: role[0]?.role || null,
      identities: identities.map((i) => ({ provider: i.provider, email: i.email_normalized, createdAt: iso(i.created_at) })),
      grants: grants.map(grantRow),
      quota: quotaForAccount(quota, {
        nowSec: Math.floor(now / 1000),
        // Com isenção ativa o ciclo da cota pode seguir a âncora da isenção,
        // não o Stripe (account-entitlements); aí vale só a data da linha.
        subscriptionStartSec: hasActiveGrant(grants, Math.floor(now / 1000))
          ? null : num(subscription.value?.periodStartSec),
      }),
      library: { ...library, value: library.value ? { projectCount: num(library.value.project_count), updatedAt: num(library.value.updated_at) ? iso(num(library.value.updated_at)) : null } : library.value },
      billingEvents: { ...billing, value: billing.value ? billing.value.map((e) => ({ type: e.event_type, status: e.object_status, receivedAt: iso(e.received_at) })) : null },
      templates,
      subscription,
    };
  }

  /**
   * MOO-39: `value` traz só a linha do ciclo vigente (ou nada); a tela lê
   * value[0] como "ciclo atual". As últimas linhas ficam em `history`.
   * Ciclo vigente: o início informado pelo Stripe, quando houver; senão a
   * linha com início <= agora < fim. Linha sem fim gravado (criada pela tela
   * de Uso) só vale se começou há menos de 31 dias.
   */
  function hasActiveGrant(grants, nowSec) {
    return grants.some((g) => g.revoked_at == null && num(g.starts_at_sec) <= nowSec
      && (g.expires_at_sec == null || num(g.expires_at_sec) > nowSec));
  }

  function quotaForAccount(quota, { nowSec, subscriptionStartSec }) {
    if (!quota.value) return { ...quota, value: null, history: null };
    const rows = quota.value.map((p) => {
      const start = num(p.period_start_sec);
      const end = p.period_end_sec == null ? null : num(p.period_end_sec);
      return { start, end, used: num(p.used) };
    });
    const isCurrent = (row) => (subscriptionStartSec > 0
      ? row.start === subscriptionStartSec
      : row.start <= nowSec && (row.end ? nowSec < row.end : nowSec - row.start < 31 * 86_400));
    // Linhas vêm em ordem decrescente de início: a primeira vigente é a atual.
    const currentRow = rows.find(isCurrent) || null;
    const history = rows.map((row) => ({
      periodStart: iso(row.start * 1000),
      periodEnd: row.end ? iso(row.end * 1000) : null,
      used: row.used,
      current: row === currentRow,
    }));
    return { ...quota, value: history.filter((row) => row.current), history };
  }

  function grantRow(g) {
    return {
      id: g.id, accountId: g.account_id, tier: g.tier, unlimitedImages: g.unlimited_images === true,
      startsAt: iso(num(g.starts_at_sec) * 1000), expiresAt: g.expires_at_sec == null ? null : iso(num(g.expires_at_sec) * 1000),
      revokedAt: iso(g.revoked_at), reason: g.reason, createdAt: iso(g.created_at),
    };
  }

  async function listGrants({ includeRevoked = false } = {}) {
    const rows = await q(`/* admin_grants */
      SELECT g.*, a.primary_email FROM moont.account_access_grants g JOIN moont.accounts a ON a.id = g.account_id
      WHERE $1::boolean OR (g.revoked_at IS NULL AND (g.expires_at_sec IS NULL OR g.expires_at_sec > extract(epoch FROM now())))
      ORDER BY g.created_at DESC LIMIT 100`, [includeRevoked === true]);
    return rows.map((g) => ({ ...grantRow(g), email: g.primary_email }));
  }

  async function health({ checkPrices } = {}) {
    const [stuck, images24h, agentJobs, webhooks, tokens, planPrices] = await Promise.all([
      metric('Banco: cota de imagens', async () => {
        const [r] = await q(`SELECT count(*)::int AS n, min(created_at) AS oldest FROM moont.image_quota_operations
          WHERE status = 'reserved' AND created_at < now() - interval '15 minutes'`);
        return { count: r.n, oldest: iso(r.oldest) };
      }),
      metric('Banco: cota de imagens', async () => {
        const [r] = await q(`SELECT count(*) FILTER (WHERE status = 'consumed')::int AS consumed,
          count(*) FILTER (WHERE status = 'refunded')::int AS refunded FROM moont.image_quota_operations
          WHERE created_at > now() - interval '24 hours'`);
        return { consumed: r.consumed, refunded: r.refunded };
      }),
      metric('Banco: jobs do agente', async () => {
        const failed = await q(`SELECT coalesce(error_code, 'sem_codigo') AS code, count(*)::int AS n FROM moont.agent_visual_jobs
          WHERE status = 'failed' AND created_at > now() - interval '24 hours' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`);
        const [pending] = await q(`SELECT count(*)::int AS n FROM moont.agent_visual_jobs
          WHERE status = 'pending' AND created_at < now() - interval '15 minutes'`);
        return { failedByCode: failed.map((r) => ({ code: r.code, count: r.n })), stuckPending: pending.n };
      }),
      metric('Banco: avisos do Stripe', async () => {
        const [r] = await q(`SELECT max(received_at) AS last, count(*) FILTER (WHERE received_at > now() - interval '24 hours')::int AS d1
          FROM moont.billing_events`);
        return { lastReceivedAt: iso(r.last), last24h: r.d1 };
      }),
      metric('Banco: acesso de agentes', async () => {
        const [a] = await q(`SELECT count(*)::int AS n FROM moont.agent_tokens WHERE revoked_at IS NULL AND expires_at > now()`);
        const [o] = await q(`SELECT count(*)::int AS n FROM moont.oauth_refresh_tokens WHERE revoked_at IS NULL AND expires_at > now()`);
        return { agentTokens: a.n, oauthSessions: o.n };
      }),
      // MOO-38: preço da tela × price do Stripe. Falha do Stripe vira "—".
      typeof checkPrices === 'function'
        ? metric('Stripe: preços dos planos', () => checkPrices())
        : { value: null, source: 'Stripe: preços dos planos', reason: 'Conferência não configurada.' },
    ]);
    return { stuckReservations: stuck, images24h, agentJobs, webhooks, tokens, planPrices };
  }

  async function listActions({ target = '' } = {}) {
    const filter = String(target || '').trim().slice(0, 255);
    const rows = await q(`/* admin_actions_list */
      SELECT id, actor_id, actor_role, action, target, reason, details, created_at FROM moont.admin_actions
      WHERE $1 = '' OR target = $1 ORDER BY id DESC LIMIT 100`, [filter]);
    return rows.map((r) => ({ id: num(r.id), actorId: r.actor_id, actorRole: r.actor_role, action: r.action,
      target: r.target, reason: r.reason, details: r.details || {}, createdAt: iso(r.created_at) }));
  }

  /** Cria o código de uma ação de risco. O código em claro só sai daqui para o e-mail. */
  async function createChallenge(actor, action, payload, { now = Date.now() } = {}) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const [row] = await q(`/* admin_challenge_create */
      INSERT INTO moont.admin_challenges (owner_id, action, payload_hash, code_hash, expires_at)
      VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [actor.id, action, payloadHash(action, payload), sha256(`pending:${code}`), new Date(now + CHALLENGE_TTL_MS)]);
    // O hash final amarra o código ao id do desafio.
    await q(`UPDATE moont.admin_challenges SET code_hash = $2 WHERE id = $1::uuid`, [row.id, sha256(`${row.id}:${code}`)]);
    return { challengeId: row.id, code };
  }

  /**
   * Conta a tentativa ANTES de comparar o código, numa instrução própria e já
   * confirmada (AUTH-04). O teto vale mesmo com pedidos em paralelo: quem não
   * consegue incrementar não chega à comparação. A tentativa certa também gasta
   * uma das cinco.
   */
  async function claimChallengeAttempt(actor, { challengeId, now = Date.now() }) {
    if (!UUID.test(challengeId || '')) throw adminFail('admin_code_invalid', 'Código inválido.', 403);
    const [claimed] = await q(`/* admin_challenge_attempt */
      UPDATE moont.admin_challenges SET attempts = attempts + 1
      WHERE id = $1::uuid AND owner_id = $2 AND used_at IS NULL AND expires_at > $3 AND attempts < $4
      RETURNING attempts`, [challengeId, actor.id, new Date(now), CHALLENGE_MAX_ATTEMPTS]);
    if (claimed) return;
    const [row] = await q(`SELECT attempts, used_at, expires_at FROM moont.admin_challenges WHERE id = $1::uuid AND owner_id = $2`, [challengeId, actor.id]);
    if (row && !row.used_at && new Date(row.expires_at).getTime() > now && Number(row.attempts) >= CHALLENGE_MAX_ATTEMPTS) {
      throw adminFail('admin_code_locked', 'Tentativas esgotadas. Peça outro código.', 403);
    }
    throw adminFail('admin_code_expired', 'Código expirado ou já usado. Peça outro.', 403);
  }

  /** Confere e consome o código dentro da transação da própria ação. A tentativa já foi contada. */
  async function consumeChallenge(tx, actor, { challengeId, code, action, payload, now = Date.now() }) {
    if (!UUID.test(challengeId || '') || !/^\d{6}$/.test(String(code || ''))) throw adminFail('admin_code_invalid', 'Código inválido.', 403);
    const [row] = await tx.unsafe(`SELECT * FROM moont.admin_challenges WHERE id = $1::uuid AND owner_id = $2 FOR UPDATE`, [challengeId, actor.id]);
    if (!row || row.used_at || new Date(row.expires_at).getTime() <= now || row.action !== action) {
      throw adminFail('admin_code_expired', 'Código expirado ou já usado. Peça outro.', 403);
    }
    if (Number(row.attempts) > CHALLENGE_MAX_ATTEMPTS) throw adminFail('admin_code_locked', 'Tentativas esgotadas. Peça outro código.', 403);
    if (row.payload_hash !== payloadHash(action, payload)) throw adminFail('admin_code_mismatch', 'O código foi pedido para outra ação. Peça outro.', 403);
    if (row.code_hash !== sha256(`${challengeId}:${code}`)) {
      throw adminFail('admin_code_invalid', 'Código incorreto.', 403);
    }
    await tx.unsafe(`UPDATE moont.admin_challenges SET used_at = now() WHERE id = $1::uuid`, [challengeId]);
  }

  /** Âncora da cota: o ciclo já em uso pela conta, para não zerar nem duplicar consumo. */
  async function quotaAnchorFor(customerId, nowSec) {
    if (!CUSTOMER.test(customerId || '')) return nowSec;
    const [row] = await q(`SELECT period_start_sec FROM moont.image_quota_periods WHERE owner_id = $1
      ORDER BY period_start_sec DESC LIMIT 1`, [customerId]);
    const start = num(row?.period_start_sec);
    return start && start <= nowSec && nowSec - start < 31 * 86400 ? start : nowSec;
  }

  return {
    roleOf, recordAction, overview, searchAccounts, getAccount, listGrants, health, listActions,
    createChallenge, claimChallengeAttempt, consumeChallenge, quotaAnchorFor,
    begin: (work) => connection().begin(work),
    customerOf: async (accountId) => (await q(`SELECT stripe_customer_id FROM moont.account_stripe_customers WHERE account_id = $1::uuid`, [accountId]))[0]?.stripe_customer_id || null,
  };
}

export { cleanText };
