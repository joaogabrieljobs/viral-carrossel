import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAccountEntitlementStore, monthlyQuotaBounds, resolveAccountEntitlement,
} from '../../api/lib/account-entitlements.js';
import { imageLimitForEntitlement, UNLIMITED_IMAGE_CEILING } from '../../api/lib/plans.js';

const accountId = '11111111-1111-4111-8111-111111111111';
const grantId = '22222222-2222-4222-8222-222222222222';
const sec = iso => Date.parse(iso) / 1000;
const anchor = sec('2026-01-31T13:42:09Z');
const now = sec('2026-02-28T13:42:10Z');
const grant = { id: grantId, accountId, tier: 'creator', startsAtSec: anchor,
  expiresAtSec: null, quotaAnchorSec: anchor, revokedAt: null };
const row = { id: grantId, account_id: accountId, tier: 'creator', starts_at_sec: anchor,
  expires_at_sec: null, quota_anchor_sec: anchor, revoked_at: null,
  request_id: 'grant-test-1', actor: 'test-operator', reason: 'Authorized test grant' };
const input = { accountId, tier: 'creator', startsAtSec: anchor, quotaAnchorSec: anchor,
  requestId: row.request_id, actor: row.actor, reason: row.reason };
afterEach(() => vi.unstubAllEnvs());

function sqlMock() {
  const unsafe = vi.fn();
  return { unsafe, begin: vi.fn(async work => work({ unsafe })) };
}

describe('account access entitlement resolver', () => {
  it('uses a finite explicit tier and stable quota cycle without inventing a subscription', async () => {
    const findSubscription = vi.fn();
    const entitlement = await resolveAccountEntitlement('cus_owner', { enabled: true, nowSec: now,
      store: { findGrantForCustomer: vi.fn().mockResolvedValue(grant) }, findSubscription });
    expect(entitlement).toEqual({ active: true, accessSource: 'exempt', billingExempt: true, status: 'exempt',
      tier: 'creator', accountId, unlimitedImages: false, quotaPeriodStart: '2026-02-28T13:42:09.000Z',
      quotaPeriodEnd: '2026-03-31T13:42:09.000Z', quotaPeriodStartSec: sec('2026-02-28T13:42:09Z'),
      quotaPeriodEndSec: sec('2026-03-31T13:42:09Z') });
    expect(entitlement).not.toHaveProperty('subscription');
  });

  // MOO-13 (auditoria 20/11): a isenção substituía a assinatura. Um assinante
  // Max que recebia isenção Criador caía de plano e continuava sendo cobrado.
  describe('MOO-13 — isenção não rebaixa quem já paga', () => {
    const paid = tier => ({ id: 'sub_real', status: 'active', metadata: { tier },
      items: { data: [{ current_period_start: anchor, current_period_end: now + 86400 }] } });
    const resolve = (candidate, findSubscription) => resolveAccountEntitlement('cus_owner', { enabled: true, nowSec: now,
      store: { findGrantForCustomer: vi.fn().mockResolvedValue(candidate) }, findSubscription });

    it('assinatura maior que a isenção prevalece', async () => {
      const entitlement = await resolve(grant, vi.fn().mockResolvedValue(paid('max')));
      expect(entitlement).toMatchObject({ active: true, accessSource: 'stripe', billingExempt: false, tier: 'max' });
    });

    it('isenção maior que a assinatura prevalece', async () => {
      const entitlement = await resolve({ ...grant, tier: 'pro' }, vi.fn().mockResolvedValue(paid('essential')));
      expect(entitlement).toMatchObject({ accessSource: 'exempt', tier: 'pro' });
    });

    it('isenção Max ou sem limite de imagens não consulta o Stripe', async () => {
      const findSubscription = vi.fn();
      await resolve({ ...grant, tier: 'max' }, findSubscription);
      await resolve({ ...grant, unlimitedImages: true }, findSubscription);
      expect(findSubscription).not.toHaveBeenCalled();
    });

    it('falha do Stripe mantém a isenção em vez de derrubar o acesso', async () => {
      const entitlement = await resolve(grant, vi.fn().mockRejectedValue(new Error('stripe offline')));
      expect(entitlement).toMatchObject({ active: true, accessSource: 'exempt', tier: 'creator' });
    });
  });

  it.each([null, { ...grant, revokedAt: new Date() }, { ...grant, expiresAtSec: now },
    { ...grant, startsAtSec: now + 1 }])('missing/revoked/expired/future grant does not activate access', async candidate => {
    const entitlement = await resolveAccountEntitlement('cus_owner', { enabled: true, nowSec: now,
      store: { findGrantForCustomer: vi.fn().mockResolvedValue(candidate) }, findSubscription: vi.fn().mockResolvedValue(null) });
    expect(entitlement).toEqual({ active: false, accessSource: null, billingExempt: false, status: 'inactive' });
  });

  it('preserves real paid subscription tier, period, and object when no grant exists', async () => {
    const subscription = { id: 'sub_real', status: 'trialing', metadata: { tier: 'pro' },
      items: { data: [{ current_period_start: anchor, current_period_end: now }] } };
    const entitlement = await resolveAccountEntitlement('cus_paid', { enabled: true, nowSec: now,
      store: { findGrantForCustomer: vi.fn().mockResolvedValue(null) }, findSubscription: vi.fn().mockResolvedValue(subscription) });
    expect(entitlement).toMatchObject({ active: true, accessSource: 'stripe', billingExempt: false,
      status: 'trialing', tier: 'pro', quotaPeriodStartSec: anchor, quotaPeriodEndSec: now });
    expect(entitlement.subscription).toBe(subscription);
  });

  it('fails closed on exemption database outage without falling back to paid access', async () => {
    const sql = sqlMock(); sql.unsafe.mockRejectedValue(new Error('database offline'));
    const findSubscription = vi.fn();
    await expect(resolveAccountEntitlement('cus_owner', { enabled: true, nowSec: now,
      store: createAccountEntitlementStore({ sql }), findSubscription })).rejects.toMatchObject({ status: 503, code: 'entitlement_store_unavailable' });
    expect(findSubscription).not.toHaveBeenCalled();
  });

  it('binds lookup to exact verified customer mapping and never selects by email', async () => {
    const sql = sqlMock();
    sql.unsafe.mockImplementation(async (_statement, [customer]) => customer === 'cus_owner' ? [row] : []);
    const store = createAccountEntitlementStore({ sql });
    expect((await store.findGrantForCustomer('cus_owner', now)).accountId).toBe(accountId);
    expect(await store.findGrantForCustomer('cus_other', now)).toBeNull();
    expect(sql.unsafe).toHaveBeenLastCalledWith(expect.stringContaining('s.stripe_customer_id = $1'), ['cus_other', now]);
    expect(sql.unsafe.mock.calls[0][0]).toContain('s.verified_at IS NOT NULL');
    expect(sql.unsafe.mock.calls[0][0]).not.toContain('email');
  });
});

describe('stable calendar-month quota anchor', () => {
  it.each([
    ['2026-02-28T13:42:08Z', '2026-01-31T13:42:09Z', '2026-02-28T13:42:09Z'],
    ['2026-02-28T13:42:09Z', '2026-02-28T13:42:09Z', '2026-03-31T13:42:09Z'],
    ['2026-04-30T13:42:09Z', '2026-04-30T13:42:09Z', '2026-05-31T13:42:09Z'],
    ['2028-02-29T13:42:09Z', '2028-02-29T13:42:09Z', '2028-03-31T13:42:09Z'],
  ])('clamps month ends without drifting the original day: %s', (at, start, end) => {
    expect(monthlyQuotaBounds(anchor, sec(at))).toMatchObject({ periodStartSec: sec(start), periodEndSec: sec(end) });
  });
  it('uses the existing cycle key even when a grant is issued later in the cycle', async () => {
    const at = sec('2026-02-12T17:00:00Z');
    const entitlement = await resolveAccountEntitlement('cus_owner', { enabled: true, nowSec: at,
      store: { findGrantForCustomer: vi.fn().mockResolvedValue({ ...grant, startsAtSec: at }) } });
    expect(entitlement.quotaPeriodStartSec).toBe(anchor);
  });
});

describe('private transactional grant administration', () => {
  it('inserts grant and audit together with explicit operator/reason/anchor', async () => {
    const sql = sqlMock();
    sql.unsafe.mockImplementation(async statement => {
      if (statement.includes('FOR UPDATE OF a')) return [{ id: accountId }];
      if (statement.includes('INSERT INTO moont.account_access_grants')) return [row];
      return [];
    });
    const result = await createAccountEntitlementStore({ sql }).grantAccess(input);
    expect(result).toMatchObject({ grant, replayed: false });
    expect(sql.begin).toHaveBeenCalledOnce();
    expect(sql.unsafe).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO moont.account_access_grants'),
      [accountId, 'creator', anchor, null, anchor, input.requestId, input.actor, input.reason, false]);
    expect(sql.unsafe).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO moont.account_access_grant_events'),
      [grantId, accountId, input.requestId, input.actor, input.reason, JSON.stringify({ tier: 'creator', startsAtSec: anchor, expiresAtSec: null, quotaAnchorSec: anchor, unlimitedImages: false })]);
  });

  it('isenção sem limite de imagens grava a marca, entra na auditoria e muda o limite resolvido', async () => {
    const sql = sqlMock();
    sql.unsafe.mockImplementation(async statement => {
      if (statement.includes('FOR UPDATE OF a')) return [{ id: accountId }];
      if (statement.includes('INSERT INTO moont.account_access_grants')) return [{ ...row, tier: 'max', unlimited_images: true }];
      return [];
    });
    const result = await createAccountEntitlementStore({ sql }).grantAccess({ ...input, tier: 'max', unlimitedImages: true });
    expect(result.grant).toMatchObject({ tier: 'max', unlimitedImages: true });
    expect(sql.unsafe).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO moont.account_access_grants'),
      [accountId, 'max', anchor, null, anchor, input.requestId, input.actor, input.reason, true]);
    expect(sql.unsafe).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO moont.account_access_grant_events'),
      expect.arrayContaining([JSON.stringify({ tier: 'max', startsAtSec: anchor, expiresAtSec: null, quotaAnchorSec: anchor, unlimitedImages: true })]));

    const entitlement = await resolveAccountEntitlement('cus_owner', { enabled: true, nowSec: now,
      store: { findGrantForCustomer: vi.fn().mockResolvedValue({ ...grant, tier: 'max', unlimitedImages: true }) } });
    expect(entitlement).toMatchObject({ tier: 'max', unlimitedImages: true });
    expect(imageLimitForEntitlement(entitlement)).toBe(UNLIMITED_IMAGE_CEILING);
    expect(imageLimitForEntitlement({ tier: 'max' })).toBe(300);
    expect(imageLimitForEntitlement({ tier: 'creator', unlimitedImages: 'true' })).toBe(50);
  });

  it('repetir a concessão mudando só o "sem limite" é conflito, não substituição silenciosa', async () => {
    const sql = sqlMock();
    sql.unsafe.mockImplementation(async statement => statement.includes('WHERE request_id = $1') ? [row] : []);
    await expect(createAccountEntitlementStore({ sql }).grantAccess({ ...input, unlimitedImages: true }))
      .rejects.toMatchObject({ status: 409, code: 'entitlement_request_conflict' });
  });

  it('replays exact request without writing another grant/audit, and rejects changed input', async () => {
    const sql = sqlMock(); sql.unsafe.mockImplementation(async statement => statement.includes('WHERE request_id = $1') ? [row] : []);
    const store = createAccountEntitlementStore({ sql });
    expect(await store.grantAccess(input)).toMatchObject({ replayed: true });
    expect(sql.unsafe.mock.calls.some(([statement]) => statement.includes('INSERT'))).toBe(false);
    await expect(store.grantAccess({ ...input, tier: 'max' })).rejects.toMatchObject({ status: 409, code: 'entitlement_request_conflict' });
  });

  it('rejects a grant requestId previously used for revocation with 409 before any mutation', async () => {
    const sql = sqlMock();
    sql.unsafe.mockImplementation(async statement => statement.includes('SELECT id FROM moont.account_access_grant_events') ? [{ id: 1 }] : []);
    await expect(createAccountEntitlementStore({ sql }).grantAccess(input)).rejects.toMatchObject({ status: 409, code: 'entitlement_request_conflict' });
    expect(sql.unsafe.mock.calls.some(([statement]) => statement.includes('INSERT'))).toBe(false);
  });

  it('rejects unverified accounts, overlaps, and invalid anchors before granting', async () => {
    const sql = sqlMock(); sql.unsafe.mockResolvedValue([]);
    const store = createAccountEntitlementStore({ sql });
    await expect(store.grantAccess(input)).rejects.toMatchObject({ code: 'entitlement_account_unverified' });
    await expect(store.grantAccess({ ...input, quotaAnchorSec: anchor + 1 })).rejects.toMatchObject({ code: 'entitlement_invalid_input' });
    sql.unsafe.mockImplementation(async statement => statement.includes('FOR UPDATE OF a') || statement.includes('SELECT id FROM moont.account_access_grants') ? [{ id: grantId }] : []);
    await expect(store.grantAccess(input)).rejects.toMatchObject({ code: 'entitlement_grant_conflict' });
  });

  it('audit insertion failure rejects the same transaction instead of reporting success', async () => {
    const sql = sqlMock();
    sql.unsafe.mockImplementation(async statement => {
      if (statement.includes('FOR UPDATE OF a')) return [{ id: accountId }];
      if (statement.includes('INSERT INTO moont.account_access_grants')) return [row];
      if (statement.includes('INSERT INTO moont.account_access_grant_events')) throw new Error('audit failed');
      return [];
    });
    await expect(createAccountEntitlementStore({ sql }).grantAccess(input)).rejects.toMatchObject({ status: 503 });
    expect(sql.begin).toHaveBeenCalledOnce();
  });

  it('revokes exact grant/account and audits atomically; request replay is idempotent', async () => {
    const sql = sqlMock(); sql.unsafe.mockImplementation(async statement => statement.includes('UPDATE moont.account_access_grants') ? [{ id: grantId }] : []);
    const store = createAccountEntitlementStore({ sql });
    const revoke = { accountId, grantId, requestId: 'revoke-1', actor: 'test-operator', reason: 'Test revocation' };
    expect(await store.revokeAccess(revoke)).toEqual({ revoked: true, replayed: false });
    expect(sql.unsafe).toHaveBeenCalledWith(expect.stringContaining('AND account_id = $2::uuid AND revoked_at IS NULL'), [grantId, accountId, revoke.actor]);
    sql.unsafe.mockImplementation(async statement => statement.includes('WHERE request_id = $1') ? [{
      account_id: accountId, grant_id: grantId, action: 'revoked', actor: revoke.actor, reason: revoke.reason,
    }] : []);
    expect(await store.revokeAccess(revoke)).toEqual({ revoked: true, replayed: true });
    await expect(store.revokeAccess({ ...revoke, accountId: '33333333-3333-4333-8333-333333333333' })).rejects.toMatchObject({ code: 'entitlement_request_conflict' });
  });
});
