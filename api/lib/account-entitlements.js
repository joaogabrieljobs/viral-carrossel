/** Account access is independent of Stripe billing. Grants never impersonate subscriptions. */
import { getPostgresConnection } from './postgres-connection.js';
import { findActiveSubscription } from './stripe.js';
import { PLAN_ORDER, periodBoundsFromSubscription, resolveTierFromSubscription } from './plans.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUSTOMER = /^cus_[A-Za-z0-9_]{1,251}$/;
const fail = (code, message, status = 503) => Object.assign(new Error(message), { code, status });

// Explicit deployment flag permits applying the private SQL migration before enabling reads.
export function accountEntitlementsEnabled() {
  return process.env.ACCOUNT_ENTITLEMENTS_BACKEND === 'postgres';
}

function second(value, label) {
  const sec = Number(value);
  if (!Number.isSafeInteger(sec) || sec <= 0 || sec > 253402214400) {
    throw fail('entitlement_invalid_input', `${label} inválido.`, 400);
  }
  return sec;
}

function textField(value, label, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw fail('entitlement_invalid_input', `${label} inválido.`, 400);
  }
  return value.trim();
}

/** Calendar-month recurrence keeps the original UTC day/time, clamping short months. */
export function monthlyQuotaBounds(anchorSec, nowSec = Math.floor(Date.now() / 1000)) {
  const anchor = new Date(second(anchorSec, 'Âncora') * 1000);
  const now = new Date(second(nowSec, 'Data') * 1000);
  const atMonth = (offset) => {
    const date = new Date(anchor);
    date.setUTCDate(1);
    date.setUTCMonth(anchor.getUTCMonth() + offset);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(anchor.getUTCDate(), lastDay));
    return date.getTime() / 1000;
  };
  let offset = (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + now.getUTCMonth() - anchor.getUTCMonth();
  if (atMonth(offset) > nowSec) offset -= 1;
  const periodStartSec = atMonth(offset);
  const periodEndSec = atMonth(offset + 1);
  return { periodStartSec, periodEndSec,
    periodStart: new Date(periodStartSec * 1000).toISOString(),
    periodEnd: new Date(periodEndSec * 1000).toISOString() };
}

function grantFromRow(row) {
  if (!row) return null;
  return { id: row.id, accountId: row.account_id, tier: row.tier,
    startsAtSec: Number(row.starts_at_sec), expiresAtSec: row.expires_at_sec == null ? null : Number(row.expires_at_sec),
    quotaAnchorSec: Number(row.quota_anchor_sec), revokedAt: row.revoked_at || null,
    unlimitedImages: row.unlimited_images === true };
}

async function storage(work) {
  try { return await work(); }
  catch (error) {
    if (error?.code?.startsWith('entitlement_')) throw error;
    throw fail('entitlement_store_unavailable', 'Não foi possível verificar o acesso da conta. Tente novamente.');
  }
}

/** Server-only API. Callers must already have authenticated the exact customer. */
export function createAccountEntitlementStore({ sql: injectedSql } = {}) {
  const connection = () => injectedSql || getPostgresConnection();
  async function findGrantForCustomer(customerId, nowSec = Math.floor(Date.now() / 1000)) {
    if (!CUSTOMER.test(customerId || '')) throw fail('entitlement_invalid_input', 'Conta inválida.', 400);
    return storage(async () => {
      const rows = await connection().unsafe(`/* entitlement_active_by_verified_customer */
        SELECT g.* FROM moont.account_access_grants g
        JOIN moont.account_stripe_customers s ON s.account_id = g.account_id
        WHERE s.stripe_customer_id = $1 AND s.verified_at IS NOT NULL
          AND g.revoked_at IS NULL AND g.starts_at_sec <= $2
          AND (g.expires_at_sec IS NULL OR g.expires_at_sec > $2)
        ORDER BY g.created_at DESC LIMIT 1`, [customerId, nowSec]);
      const grant = grantFromRow(rows[0]);
      if (grant && (!PLAN_ORDER.includes(grant.tier) || !UUID.test(grant.accountId)
        || !Number.isSafeInteger(grant.quotaAnchorSec) || grant.quotaAnchorSec <= 0)) {
        throw fail('entitlement_store_unavailable', 'Acesso da conta inválido.');
      }
      return grant;
    });
  }

  /** Idempotent account-scoped issuance. An explicit historical anchor preserves consumed quota. */
  async function grantAccess({ accountId, tier, startsAtSec, expiresAtSec = null,
    quotaAnchorSec, requestId, actor, reason, unlimitedImages = false }) {
    if (!UUID.test(accountId || '') || !PLAN_ORDER.includes(tier)) throw fail('entitlement_invalid_input', 'Conta ou plano inválido.', 400);
    const start = second(startsAtSec, 'Início');
    const expiry = expiresAtSec == null ? null : second(expiresAtSec, 'Validade');
    const anchor = second(quotaAnchorSec, 'Âncora da quota');
    if (anchor > start || (expiry != null && expiry <= start)) throw fail('entitlement_invalid_input', 'Período inválido.', 400);
    const key = textField(requestId, 'Idempotência', 200);
    const operator = textField(actor, 'Responsável', 200);
    const why = textField(reason, 'Motivo', 1000);
    return storage(() => connection().begin(async tx => {
      await tx.unsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`access-grant:${key}`]);
      const replay = (await tx.unsafe(`SELECT g.* FROM moont.account_access_grants g WHERE request_id = $1`, [key]))[0];
      if (replay) {
        if (String(replay.account_id) !== accountId || replay.tier !== tier
          || Number(replay.starts_at_sec) !== start || Number(replay.quota_anchor_sec) !== anchor
          || (replay.expires_at_sec == null ? null : Number(replay.expires_at_sec)) !== expiry
          || replay.actor !== operator || replay.reason !== why
          || (replay.unlimited_images === true) !== (unlimitedImages === true)) {
          throw fail('entitlement_request_conflict', 'Idempotência já utilizada para outra concessão.', 409);
        }
        return { grant: grantFromRow(replay), replayed: true };
      }
      const priorEvent = await tx.unsafe('SELECT id FROM moont.account_access_grant_events WHERE request_id = $1', [key]);
      if (priorEvent.length) throw fail('entitlement_request_conflict', 'Idempotência já utilizada para outra operação.', 409);
      // Locks serialize two distinct requests for the same account; email is never consulted.
      const account = await tx.unsafe(`SELECT a.id FROM moont.accounts a
        JOIN moont.account_stripe_customers s ON s.account_id = a.id
        WHERE a.id = $1::uuid AND s.verified_at IS NOT NULL FOR UPDATE OF a`, [accountId]);
      if (!account.length) throw fail('entitlement_account_unverified', 'Conta verificada não encontrada.', 404);
      const existing = await tx.unsafe(`SELECT id FROM moont.account_access_grants
        WHERE account_id = $1::uuid AND revoked_at IS NULL
          AND (expires_at_sec IS NULL OR expires_at_sec > $2)
          AND ($3::bigint IS NULL OR starts_at_sec < $3::bigint)`, [accountId, start, expiry]);
      if (existing.length) throw fail('entitlement_grant_conflict', 'Já existe concessão neste período. Revogue-a antes de substituir.', 409);
      const row = (await tx.unsafe(`INSERT INTO moont.account_access_grants
        (account_id, tier, starts_at_sec, expires_at_sec, quota_anchor_sec, request_id, actor, reason, unlimited_images)
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [accountId, tier, start, expiry, anchor, key, operator, why, unlimitedImages === true]))[0];
      await tx.unsafe(`INSERT INTO moont.account_access_grant_events
        (grant_id, account_id, action, request_id, actor, reason, details)
        VALUES ($1::uuid, $2::uuid, 'granted', $3, $4, $5, $6::jsonb)`,
      [row.id, accountId, key, operator, why, JSON.stringify({ tier, startsAtSec: start, expiresAtSec: expiry, quotaAnchorSec: anchor, unlimitedImages: unlimitedImages === true })]);
      return { grant: grantFromRow(row), replayed: false };
    }));
  }

  async function revokeAccess({ accountId, grantId, requestId, actor, reason }) {
    if (!UUID.test(accountId || '') || !UUID.test(grantId || '')) throw fail('entitlement_invalid_input', 'Concessão inválida.', 400);
    const key = textField(requestId, 'Idempotência', 200);
    const operator = textField(actor, 'Responsável', 200);
    const why = textField(reason, 'Motivo', 1000);
    return storage(() => connection().begin(async tx => {
      await tx.unsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`access-grant:${key}`]);
      const replay = (await tx.unsafe(`SELECT * FROM moont.account_access_grant_events WHERE request_id = $1`, [key]))[0];
      if (replay) {
        if (replay.action !== 'revoked' || replay.account_id !== accountId || replay.grant_id !== grantId
          || replay.actor !== operator || replay.reason !== why) throw fail('entitlement_request_conflict', 'Idempotência já utilizada.', 409);
        return { revoked: true, replayed: true };
      }
      await tx.unsafe('SELECT id FROM moont.accounts WHERE id = $1::uuid FOR UPDATE', [accountId]);
      const rows = await tx.unsafe(`UPDATE moont.account_access_grants SET revoked_at = now(), revoked_by = $3
        WHERE id = $1::uuid AND account_id = $2::uuid AND revoked_at IS NULL RETURNING id`, [grantId, accountId, operator]);
      if (!rows.length) throw fail('entitlement_grant_not_found', 'Concessão não encontrada ou já revogada.', 404);
      await tx.unsafe(`INSERT INTO moont.account_access_grant_events
        (grant_id, account_id, action, request_id, actor, reason, details)
        VALUES ($1::uuid, $2::uuid, 'revoked', $3, $4, $5, '{}'::jsonb)`, [grantId, accountId, key, operator, why]);
      return { revoked: true, replayed: false };
    }));
  }
  return { findGrantForCustomer, grantAccess, revokeAccess };
}

const defaultStore = createAccountEntitlementStore();
export const grantAccountAccess = input => defaultStore.grantAccess(input);
export const revokeAccountAccess = input => defaultStore.revokeAccess(input);

export async function resolveAccountExemption(customerId, { nowSec = Math.floor(Date.now() / 1000),
  enabled = accountEntitlementsEnabled(), store = defaultStore } = {}) {
  if (!enabled) return null;
  const grant = await store.findGrantForCustomer(customerId, nowSec);
  // Defensive checks also make injected stores fail closed for stale/revoked grants.
  if (!grant || grant.revokedAt || grant.startsAtSec > nowSec || (grant.expiresAtSec != null && grant.expiresAtSec <= nowSec)) return null;
  const bounds = monthlyQuotaBounds(grant.quotaAnchorSec, nowSec);
  return { active: true, accessSource: 'exempt', billingExempt: true, status: 'exempt',
    tier: grant.tier, accountId: grant.accountId, unlimitedImages: grant.unlimitedImages === true,
    quotaPeriodStart: bounds.periodStart, quotaPeriodEnd: bounds.periodEnd,
    quotaPeriodStartSec: bounds.periodStartSec, quotaPeriodEndSec: bounds.periodEndSec };
}

export async function resolveAccountEntitlement(customerId, options = {}) {
  const exempt = await resolveAccountExemption(customerId, options);
  if (exempt) return exempt;
  const subscription = await (options.findSubscription || findActiveSubscription)(customerId);
  if (!subscription) return { active: false, accessSource: null, billingExempt: false, status: 'inactive' };
  const bounds = periodBoundsFromSubscription(subscription);
  return { active: true, accessSource: 'stripe', billingExempt: false, status: subscription.status,
    tier: resolveTierFromSubscription(subscription), subscription,
    quotaPeriodStart: bounds.periodStart, quotaPeriodEnd: bounds.periodEnd,
    quotaPeriodStartSec: bounds.periodStartSec, quotaPeriodEndSec: bounds.periodEndSec };
}
