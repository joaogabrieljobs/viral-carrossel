import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';
const deps = vi.hoisted(() => ({
  query: vi.fn(), account: vi.fn(), password: vi.fn(), usage: vi.fn(), consume: vi.fn(),
  activity: vi.fn(), setPassword: vi.fn(), settle: vi.fn(), refund: vi.fn(), generate: vi.fn(), project: vi.fn(),
  imageJob: vi.fn(), createJob: vi.fn(), authorize: vi.fn(), google: vi.fn(),
}));
vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));
vi.mock('../../api/lib/postgres-connection.js', () => ({ getPostgresConnection: () => ({ unsafe: deps.query }) }));
vi.mock('../../api/lib/account-identity-postgres.js', () => ({
  accountIdentityBackendEnabled: () => true,
  getOrCreateAccountForStripeCustomer: deps.account, getAccountByStripeCustomerId: deps.account,
  getAccountByGoogleSubject: deps.account, linkVerifiedGoogleIdentity: deps.account,
  revokeAccountSessions: vi.fn(),
}));
vi.mock('../../api/lib/password-auth.js', async original => ({
  ...await original(), getAuthRecordsMatchingPassword: deps.password, upsertPassword: deps.setPassword,
}));
vi.mock('../../api/lib/image-quota.js', () => ({
  getQuotaUsage: deps.usage, getImageQuotaActivity: deps.activity,
  consumeImageCredit: deps.consume, settleImageCredit: deps.settle, refundImageCredit: deps.refund,
  rememberImageResult: async () => true, recallImageResult: async () => null,
}));
vi.mock('../../api/lib/sjinn.js', () => ({
  isSjinnConfigured: () => true, createGptImage2Task: deps.generate,
  waitForSjinnTask: async () => ({ url: 'https://example.test/image.png' }),
  downloadImageAsBase64: async () => ({ b64_json: 'QUJD', mime: 'image/png' }),
  extractSjinnOutputUrl: data => data.url, SJINN_DEADLINE_MS: 240000,
}));
vi.mock('../../api/lib/library-sync-postgres.js', () => ({
  getAccountProject: deps.project, getLibrarySyncMeta: vi.fn(),
}));
vi.mock('../../api/lib/agent-visual-batch.js', async original => ({
  ...await original(), getAgentVisualJobInternal: deps.imageJob, createAgentImageJob: deps.createJob,
}));
vi.mock('../../api/lib/oauth-store.js', () => ({
  oauthResource: 'https://moont.ai/mcp',
  validateOAuthRequest: async () => ({ client: { client_name: 'Test' }, scopes: ['projects:read'], redirectUri: 'https://chatgpt.com/oauth/callback' }),
  createAuthorizationCode: deps.authorize,
}));
vi.mock('../../api/lib/google-auth.js', () => ({
  googleAuthConfigured: () => true, readOAuthStateCookie: () => 'state-test', clearOAuthStateCookie: vi.fn(),
  exchangeGoogleCode: deps.google, getGoogleCanonicalOrigin: () => 'https://moont.ai',
}));
import { createAccessToken, COOKIE_NAME, verifyAccessToken } from '../../api/lib/access.js';
import { requireActiveSubscription, resetActiveAccessCacheForTests } from '../../api/lib/require-access.js';
import { authenticateAgentRequest, clearAgentSubscriptionCache } from '../../api/lib/agent-token-store.js';
import { startAgentImageJob } from '../../api/lib/agent-image-generation.js';
import { findActiveSubscription } from '../../api/lib/stripe.js';
import session from '../../api/auth/session.js';
import login from '../../api/auth/login.js';
import setPassword from '../../api/auth/set-password.js';
import googleCallback from '../../api/auth/google/callback.js';
import checkout from '../../api/stripe/checkout.js';
import authorize from '../../api/oauth/authorize.js';
import image from '../../api/ai/sjinn-image.js';
import { makeReq, makeRes, cookieValue } from '../helpers/http.js';

const owner = { id: '11111111-1111-4111-8111-111111111111', stripeCustomerId: 'cus_exempt',
  email: 'owner@example.test', identityEpoch: 'epoch-1', agentEpoch: 'agent-1', sessionRevokedBefore: 0 };
const anchor = Date.parse('2026-10-31T13:42:09Z') / 1000;
const now = Date.parse('2026-11-14T16:00:00Z');
const grant = { id: '22222222-2222-4222-8222-222222222222', account_id: owner.id,
  tier: 'creator', starts_at_sec: anchor, expires_at_sec: null, quota_anchor_sec: anchor, revoked_at: null };
const tokenRow = { id: '33333333-3333-4333-8333-333333333333', owner_id: owner.stripeCustomerId,
  agent_epoch: owner.agentEpoch, account_id: owner.id, scopes: ['projects:read', 'projects:write'] };
let currentGrant;
let currentToken;
let outage;
const cookie = (customerId = owner.stripeCustomerId, accountId = owner.id, epoch = owner.identityEpoch) =>
  `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId, accountId, identityEpoch: epoch, email: owner.email }))}`;
const agentReq = () => makeReq({ headers: { authorization: `Bearer moont_pat_${'a'.repeat(43)}` } });

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.clearAllMocks(); resetStripeMock();
  resetActiveAccessCacheForTests(); clearAgentSubscriptionCache();
  vi.stubEnv('ACCOUNT_ENTITLEMENTS_BACKEND', 'postgres');
  vi.stubEnv('DATABASE_URL', 'postgresql://synthetic.invalid/test');
  currentGrant = { ...grant }; currentToken = { ...tokenRow }; outage = false;
  deps.account.mockImplementation(async id => id === 'cus_other' ? { ...owner, id: '44444444-4444-4444-8444-444444444444', stripeCustomerId: id } : { ...owner });
  deps.query.mockImplementation(async (statement, params) => {
    if (statement.includes('entitlement_active_by_verified_customer')) {
      if (outage) throw new Error('database unavailable');
      return params[0] === owner.stripeCustomerId && currentGrant ? [currentGrant] : [];
    }
    if (statement.includes('FROM moont.agent_tokens')) return currentToken ? [currentToken] : [];
    throw new Error(`Unexpected SQL: ${statement}`);
  });
  deps.password.mockResolvedValue([{ customerId: owner.stripeCustomerId, accountId: owner.id,
    identityEpoch: owner.identityEpoch, sessionRevokedBefore: 0 }]);
  stripeMock.customers.retrieve.mockResolvedValue({ id: owner.stripeCustomerId, email: owner.email, metadata: {} });
  deps.usage.mockResolvedValue({ used: 28, limit: 50, remaining: 22, allowed: true });
  deps.activity.mockResolvedValue([]);
  deps.consume.mockResolvedValue({ used: 29, limit: 50, remaining: 21, allowed: true });
  deps.settle.mockResolvedValue({ status: 'consumed' });
  deps.setPassword.mockResolvedValue({ customerId: owner.stripeCustomerId });
  deps.generate.mockResolvedValue('task-test');
  deps.google.mockResolvedValue({ sub: 'google-sub-test', email: owner.email });
  deps.authorize.mockResolvedValue('auth-code-test');
  deps.project.mockResolvedValue({ id: 'project-test', version: 1, entry: { doc: { slides: [{ id: 'slide-1', imageQuery: 'natural editorial photography' }] } } });
  deps.imageJob.mockRejectedValue(Object.assign(new Error('missing'), { code: 'visual_job_not_found' }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('authenticated account exemption across app and MCP', () => {
  it('session preserves account identity, Creator 50, consumed balance and existing period key', async () => {
    const res = makeRes(); await session(makeReq({ cookie: cookie() }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ active: true, accessSource: 'exempt', billingExempt: true,
      status: 'exempt', customerId: owner.stripeCustomerId, email: owner.email, tier: 'creator',
      currentPeriodStart: '2026-10-31T13:42:09.000Z', currentPeriodEnd: '2026-11-30T13:42:09.000Z',
      imageQuota: { used: 28, limit: 50, remaining: 22 } });
    expect(deps.usage).toHaveBeenCalledWith({ customerId: owner.stripeCustomerId, periodStartSec: anchor, limit: 50 });
    // Isenção abaixo do Max consulta a assinatura para não rebaixar quem paga (MOO-13).
    expect(stripeMock.subscriptions.list).toHaveBeenCalledWith(expect.objectContaining({ customer: owner.stripeCustomerId }));
    // Billing helper remains truthful even when app access is exempt.
    expect(await findActiveSubscription(owner.stripeCustomerId)).toBeNull();
  });

  it('project/proxy gate still rejects anonymous, foreign, and stale-epoch sessions', async () => {
    const ok = makeRes(); expect(await requireActiveSubscription(makeReq({ cookie: cookie() }), ok)).toMatchObject({ customerId: owner.stripeCustomerId });
    for (const [authCookie, expected] of [[null, 401], [cookie('cus_other', '44444444-4444-4444-8444-444444444444'), 402], [cookie(owner.stripeCustomerId, owner.id, 'old-epoch'), 401]]) {
      const res = makeRes(); expect(await requireActiveSubscription(makeReq({ cookie: authCookie }), res)).toBeNull(); expect(res.statusCode).toBe(expected);
    }
  });

  it.each(['revoked', 'expired', 'missing'])('does not preserve cached access after %s grant', async kind => {
    await requireActiveSubscription(makeReq({ cookie: cookie() }), makeRes());
    if (kind === 'revoked') currentGrant.revoked_at = new Date();
    if (kind === 'expired') currentGrant.expires_at_sec = now / 1000;
    if (kind === 'missing') currentGrant = null;
    const res = makeRes(); expect(await requireActiveSubscription(makeReq({ cookie: cookie() }), res)).toBeNull();
    expect(res.statusCode).toBe(402);
  });

  it('database outage returns 503 for session and protected routes, without paid fallback', async () => {
    outage = true;
    const res = makeRes(); await session(makeReq({ cookie: cookie() }), res);
    expect(res.statusCode).toBe(503); expect(res.body.active).toBe(false);
    const protectedRes = makeRes(); await requireActiveSubscription(makeReq({ cookie: cookie() }), protectedRes);
    expect(protectedRes.statusCode).toBe(503); expect(stripeMock.subscriptions.list).not.toHaveBeenCalled();
  });

  it('password and Google login issue normal authenticated cookies for exempt account', async () => {
    const res = makeRes(); await login(makeReq({ method: 'POST', body: { email: owner.email, password: 'valid-test-password' } }), res);
    expect(res.statusCode).toBe(200);
    expect(verifyAccessToken(cookieValue(res, COOKIE_NAME))).toMatchObject({ accountId: owner.id, customerId: owner.stripeCustomerId, identityEpoch: owner.identityEpoch });
    const google = makeRes(); await googleCallback(makeReq({ url: '/api/auth/google/callback?code=test-code&state=state-test' }), google);
    expect(google.redirectUrl).toBe('https://moont.ai/?billing=restored&login=google');
    expect(verifyAccessToken(cookieValue(google, COOKIE_NAME))).toMatchObject({ accountId: owner.id, customerId: owner.stripeCustomerId });
  });

  it('bootstrap password setup accepts exempt account without force and still requires operator secret', async () => {
    vi.stubEnv('BOOTSTRAP_SECRET', 'synthetic-bootstrap-secret');
    stripeMock.customers.list.mockResolvedValue({ data: [{ id: owner.stripeCustomerId, email: owner.email }], has_more: false });
    const req = makeReq({ method: 'POST', headers: { 'x-bootstrap-secret': 'synthetic-bootstrap-secret' }, body: { email: owner.email, password: 'ValidTestPassword123!' } });
    const res = makeRes(); await setPassword(req, res);
    expect(res.statusCode).toBe(200); expect(deps.setPassword).toHaveBeenCalledWith(owner.email, 'ValidTestPassword123!', { customerId: owner.stripeCustomerId, overwrite: true });
    const rejected = makeRes(); await setPassword({ ...req, headers: {} }, rejected); expect(rejected.statusCode).toBe(401);
    expect(deps.setPassword).toHaveBeenCalledOnce();
  });

  it('source outage blocks password/Google login with 503 and does not issue access cookies', async () => {
    outage = true;
    const res = makeRes(); await login(makeReq({ method: 'POST', body: { email: owner.email, password: 'valid-test-password' } }), res);
    expect(res.statusCode).toBe(503); expect(cookieValue(res, COOKIE_NAME)).toBeNull();
    const google = makeRes(); await googleCallback(makeReq({ url: '/api/auth/google/callback?code=test-code&state=state-test' }), google);
    expect(google.statusCode).toBe(503); expect(cookieValue(google, COOKIE_NAME)).toBeNull();
  });

  it('exempt checkout recognizes authenticated owner without making any paid checkout', async () => {
    vi.stubEnv('STRIPE_PRICE_ID_CREATOR', ''); vi.stubEnv('STRIPE_PRICE_ID', '');
    const res = makeRes(); await checkout(makeReq({ method: 'POST', cookie: cookie(), body: { email: owner.email, tier: 'creator' } }), res);
    expect(res.statusCode).toBe(200); expect(res.body).toMatchObject({ alreadyActive: true, billingExempt: true, tier: 'creator' });
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    expect(stripeMock.customers.retrieve).not.toHaveBeenCalled();
  });

  it('OAuth authorization still requires session and grants normal scoped code', async () => {
    const req = makeReq({ method: 'POST', cookie: cookie(), body: { response_type: 'code', code_challenge_method: 'S256', state: 'state-test', decision: 'allow' } });
    const res = makeRes(); await authorize(req, res);
    expect(res.statusCode).toBe(302); expect(res.redirectUrl).toContain('code=auth-code-test');
    expect(deps.authorize).toHaveBeenCalledWith(expect.objectContaining({ ownerId: owner.stripeCustomerId, scopes: ['projects:read'] }));
    const anonymous = makeRes(); await authorize({ ...req, headers: {} }, anonymous); expect(anonymous.statusCode).toBe(401);
  });

  it('MCP checks fresh entitlement on each request and preserves scopes/epochs', async () => {
    currentGrant = null;
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subAtiva(owner.stripeCustomerId)] });
    await authenticateAgentRequest(agentReq(), { scope: 'projects:read' }); // paid path before grant
    currentGrant = { ...grant }; stripeMock.subscriptions.list.mockResolvedValue({ data: [] });
    expect(await authenticateAgentRequest(agentReq(), { scope: 'projects:read' })).toMatchObject({ ownerId: owner.stripeCustomerId });
    currentGrant = null;
    await expect(authenticateAgentRequest(agentReq(), { scope: 'projects:read' })).rejects.toMatchObject({ status: 402 });
    currentGrant = { ...grant }; currentToken.scopes = ['projects:read'];
    await expect(authenticateAgentRequest(agentReq(), { scope: 'projects:write' })).rejects.toMatchObject({ status: 403 });
    currentToken = { ...tokenRow, account_id: '44444444-4444-4444-8444-444444444444' };
    await expect(authenticateAgentRequest(agentReq(), { scope: 'projects:read' })).rejects.toMatchObject({ status: 401 });
    currentToken = { ...tokenRow, agent_epoch: 'old-agent-epoch' };
    await expect(authenticateAgentRequest(agentReq(), { scope: 'projects:read' })).rejects.toMatchObject({ status: 401 });
  });

  it('fresh grant unlocks inactive MCP immediately; outage remains 503', async () => {
    currentGrant = null;
    await expect(authenticateAgentRequest(agentReq(), { scope: 'projects:read' })).rejects.toMatchObject({ status: 402 });
    currentGrant = { ...grant };
    expect(await authenticateAgentRequest(agentReq(), { scope: 'projects:read' })).toMatchObject({ ownerId: owner.stripeCustomerId });
    outage = true; await expect(authenticateAgentRequest(agentReq(), { scope: 'projects:read' })).rejects.toMatchObject({ status: 503 });
  });

  it('editor images consume finite Creator credits on exact existing cycle and stop when exhausted', async () => {
    const req = () => makeReq({ method: 'POST', cookie: cookie(), body: { prompt: 'Natural editorial photography', operationId: 'exemption-image-test' } });
    const res = makeRes(); await image(req(), res);
    expect(res.statusCode).toBe(200);
    expect(deps.consume).toHaveBeenCalledWith(expect.objectContaining({ customerId: owner.stripeCustomerId, periodStartSec: anchor, limit: 50 }));
    expect(res.body.quota).toMatchObject({ limit: 50, used: 29, remaining: 21 });
    deps.consume.mockResolvedValue({ used: 50, limit: 50, remaining: 0, allowed: false });
    const exhausted = makeRes(); await image(req(), exhausted);
    expect(exhausted.statusCode).toBe(402); expect(deps.generate).toHaveBeenCalledOnce();
  });

  it('MCP image generation uses same finite Creator budget and refuses exhausted account before reserving', async () => {
    deps.usage.mockResolvedValue({ used: 50, limit: 50, remaining: 0, allowed: false });
    await expect(startAgentImageJob(owner.stripeCustomerId, tokenRow.id, { projectId: 'project-test', baseVersion: 1, requestId: 'request-image-test' }))
      .rejects.toMatchObject({ status: 402, code: 'quota_exhausted', limit: 50 });
    expect(deps.usage).toHaveBeenCalledWith(expect.objectContaining({ customerId: owner.stripeCustomerId, periodStartSec: anchor, limit: 50 }));
    expect(deps.createJob).not.toHaveBeenCalled(); expect(deps.consume).not.toHaveBeenCalled();
  });
});
