/**
 * Console admin do Moont (docs/product/console-admin.md).
 *
 * Quem não tem papel recebe 404 em tudo, como se a rota não existisse.
 * `suporte` só lê; `admin` também concede e revoga isenção. Ações de risco
 * pedem antes um código enviado ao e-mail do próprio admin (D1).
 *
 *   GET  /api/admin?view=me
 *   GET  /api/admin?view=overview
 *   GET  /api/admin?view=accounts&q=&page=
 *   GET  /api/admin?view=account&id=<uuid>      (fica na trilha)
 *   GET  /api/admin?view=grants[&all=1]
 *   GET  /api/admin?view=health
 *   GET  /api/admin?view=actions[&target=]
 *   POST { action:'challenge', intent:'grant'|'revoke', payload }
 *   POST { action:'grant',  challengeId, code, accountId, tier, unlimitedImages, reason }
 *   POST { action:'revoke', challengeId, code, accountId, grantId, reason }
 *
 * A moderação de modelos continua em /api/templates (quem tem papel modera).
 */
import { applyCors } from './lib/cors.js';
import { readCurrentAccessCookie } from './lib/access.js';
import { consumeRateLimit, rateLimitResponse } from './lib/rate-limit.js';
import { resolveLibraryOwnerId } from './lib/library-sync-store.js';
import { grantAccountAccess, revokeAccountAccess } from './lib/account-entitlements.js';
import { getStripe, findActiveSubscription, isSubscriptionActive } from './lib/stripe.js';
import { resolveTierFromSubscription, periodBoundsFromSubscription, getStripePriceIdForTier } from './lib/plans.js';
import { PLAN_TIERS, PLAN_ORDER } from '../shared/plans.js';
import { createAdminStore, adminFail, cleanText, ADMIN_TIERS, CHALLENGE_TTL_MS } from './lib/admin-store.js';

export const config = { maxDuration: 30 };

const INTENTS = new Set(['grant', 'revoke']);

function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return req.body && typeof req.body === 'object' ? req.body : null;
}

function maskEmail(email) {
  const [user, domain] = String(email || '').split('@');
  if (!user || !domain) return '';
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

/** Só os campos que a ação usa, normalizados: é isto que o código amarra. */
export function intentPayload(intent, body = {}) {
  if (intent === 'grant') {
    const tier = ADMIN_TIERS.includes(body.tier) ? body.tier : null;
    if (!tier) throw adminFail('admin_bad_input', 'Plano inválido.');
    return { accountId: String(body.accountId || ''), tier, unlimitedImages: body.unlimitedImages === true, reason: cleanText(body.reason, 'Motivo') };
  }
  if (intent === 'revoke') {
    return { accountId: String(body.accountId || ''), grantId: String(body.grantId || ''), reason: cleanText(body.reason, 'Motivo') };
  }
  throw adminFail('admin_bad_input', 'Ação inválida.');
}

/** Exportada para teste. Plano não identificado conta como "desconhecido" (MOO-39). */
export async function countActiveSubscriptionsByTier() {
  const stripe = getStripe();
  const byTier = {};
  let total = 0;
  for (const status of ['active', 'trialing']) {
    for await (const sub of stripe.subscriptions.list({ status, limit: 100 })) {
      if (!isSubscriptionActive(sub)) continue;
      const tier = resolveTierFromSubscription(sub, { strict: true }) || 'desconhecido';
      byTier[tier] = (byTier[tier] || 0) + 1;
      total += 1;
      if (total >= 5000) break;
    }
  }
  return { total, byTier };
}

const brl = (cents) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

/**
 * MOO-38: o preço da tela vem de shared/plans.js; o cobrado vem do price
 * Stripe configurado por env. Nada amarrava os dois. Confere, por plano,
 * valor, moeda, intervalo mensal e se o price está ativo. Só leitura.
 */
export async function checkPlanPrices({ stripe = getStripe(), priceIdForTier = getStripePriceIdForTier } = {}) {
  const divergences = [];
  const unconfigured = [];
  let checked = 0;
  for (const tier of PLAN_ORDER) {
    const plan = PLAN_TIERS[tier];
    const priceId = priceIdForTier(tier);
    if (!priceId) { unconfigured.push(tier); continue; }
    checked += 1;
    const issues = [];
    let price = null;
    try {
      // eslint-disable-next-line no-await-in-loop
      price = await stripe.prices.retrieve(priceId);
    } catch {
      issues.push('Não foi possível ler o preço no Stripe (price inexistente ou Stripe indisponível).');
    }
    if (price) {
      const expectedCents = Math.round(plan.priceBRL * 100);
      if (price.unit_amount !== expectedCents) {
        issues.push(`Valor: tela mostra ${brl(expectedCents)}, Stripe cobra ${Number.isFinite(price.unit_amount) ? brl(price.unit_amount) : 'valor variável'}.`);
      }
      if (price.currency !== 'brl') issues.push(`Moeda: esperado brl, Stripe usa ${price.currency || '—'}.`);
      const interval = price.recurring?.interval;
      const count = price.recurring?.interval_count ?? 1;
      if (interval !== 'month' || count !== 1) {
        issues.push(`Intervalo: esperado mensal, Stripe usa ${interval ? `${count} ${interval}` : 'cobrança única'}.`);
      }
      if (price.active === false) issues.push('Price inativo no Stripe.');
    }
    if (issues.length) divergences.push({ tier, priceId, screen: plan.priceLabel, issues });
  }
  return { checked, ok: divergences.length === 0, divergences, unconfigured };
}

async function defaultFindSubscription(customerId) {
  const sub = await findActiveSubscription(customerId);
  if (!sub) return { status: 'none' };
  const bounds = periodBoundsFromSubscription(sub);
  return {
    status: sub.status, tier: resolveTierFromSubscription(sub), periodEnd: bounds.periodEnd,
    // Início do ciclo vigente: decide qual linha da cota é a atual (MOO-39).
    periodStartSec: bounds.periodStartSec || null,
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
  };
}

async function defaultSendCode({ to, code, intent }) {
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.AUTH_EMAIL_FROM?.trim()) {
    throw adminFail('admin_email_unavailable', 'Envio de e-mail não configurado. Nenhuma ação foi feita.', 503);
  }
  const what = intent === 'grant' ? 'conceder uma isenção' : 'revogar uma isenção';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM, to: [to], subject: `Código do console admin: ${code}`,
      text: `Seu código para ${what} no console admin da Moont é ${code}.\n\nEle vale por ${CHALLENGE_TTL_MS / 60_000} minutos e só serve para essa ação.\n\nSe não foi você, ignore este e-mail e avise o time.`,
    }),
  });
  if (!response.ok) throw adminFail('admin_email_failed', 'Não foi possível enviar o código. Nenhuma ação foi feita.', 503);
}

function send(res, cause) {
  const status = Number.isInteger(cause?.status) ? cause.status : 500;
  if (status >= 500 && status !== 503) console.error('[admin]', cause?.code || '', cause?.message || cause);
  return res.status(status).json({
    error: status >= 500 && status !== 503 ? 'Não foi possível concluir. Nada foi alterado.' : cause.message,
    code: cause?.code || 'admin_error',
  });
}

export function createAdminHandler({
  store = createAdminStore(),
  readAccess = readCurrentAccessCookie,
  grant = grantAccountAccess,
  revoke = revokeAccountAccess,
  sendCode = defaultSendCode,
  countSubscriptions = countActiveSubscriptionsByTier,
  findSubscription = defaultFindSubscription,
  checkPrices = checkPlanPrices,
  now = () => Date.now(),
} = {}) {
  return async function handler(req, res) {
    applyCors(req, res, { credentials: true });
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    if (req.method === 'OPTIONS') return res.status(204).end();
    const hidden = () => res.status(404).json({ error: 'Não encontrado.', code: 'admin_not_found' });
    if (!['GET', 'POST'].includes(req.method)) return hidden();

    let access;
    try { access = await readAccess(req); }
    catch { return res.status(503).json({ error: 'Não foi possível verificar sua sessão.', code: 'session_unavailable' }); }
    const owner = access?.customerId ? resolveLibraryOwnerId(access) : '';
    if (!owner) return hidden();

    let role;
    try { role = await store.roleOf(owner); }
    catch (cause) {
      console.error('[admin] papel', cause?.message || cause);
      return res.status(503).json({ error: 'Não foi possível verificar o acesso.', code: 'admin_role_unavailable' });
    }
    if (!role) return hidden();
    const actor = { id: owner, role, email: access.email || '' };

    const limited = await consumeRateLimit(req, { limit: 120, windowMs: 60_000, keyPrefix: 'admin', subject: owner });
    if (limited) return rateLimitResponse(res, limited.retryAfterSec);

    try {
      if (req.method === 'GET') {
        const url = new URL(req.url || '/', 'https://moont.ai');
        const view = url.searchParams.get('view') || 'me';
        switch (view) {
          case 'me': return res.status(200).json({ ok: true, role, email: actor.email });
          case 'overview': return res.status(200).json({ ok: true, ...(await store.overview({ countSubscriptions })) });
          case 'accounts': return res.status(200).json({ ok: true, ...(await store.searchAccounts({ query: url.searchParams.get('q'), page: url.searchParams.get('page') })) });
          case 'account': return res.status(200).json({ ok: true, account: await store.getAccount(actor, url.searchParams.get('id'), { findSubscription, now: now() }) });
          case 'grants': return res.status(200).json({ ok: true, grants: await store.listGrants({ includeRevoked: url.searchParams.get('all') === '1' }) });
          case 'health': return res.status(200).json({ ok: true, ...(await store.health({ checkPrices })) });
          case 'actions': return res.status(200).json({ ok: true, actions: await store.listActions({ target: url.searchParams.get('target') }) });
          default: return res.status(400).json({ error: 'Visão inválida.', code: 'admin_bad_view' });
        }
      }

      const body = parseBody(req);
      if (!body) return res.status(400).json({ error: 'Pedido inválido.', code: 'admin_bad_request' });
      if (role !== 'admin') throw adminFail('admin_forbidden', 'Seu papel só permite consultar.', 403);

      if (body.action === 'challenge') {
        if (!INTENTS.has(body.intent)) throw adminFail('admin_bad_input', 'Ação inválida.');
        const payload = intentPayload(body.intent, body.payload || {});
        if (!actor.email) throw adminFail('admin_no_email', 'Sua sessão não tem e-mail para receber o código.', 409);
        const codeLimited = await consumeRateLimit(req, { limit: 5, windowMs: 10 * 60_000, keyPrefix: 'admin-code', subject: owner, failClosed: true });
        if (codeLimited) return rateLimitResponse(res, codeLimited.retryAfterSec);
        const { challengeId, code } = await store.createChallenge(actor, body.intent, payload, { now: now() });
        await sendCode({ to: actor.email, code, intent: body.intent });
        return res.status(200).json({ ok: true, challengeId, sentTo: maskEmail(actor.email), expiresInMinutes: CHALLENGE_TTL_MS / 60_000 });
      }

      if (body.action === 'grant' || body.action === 'revoke') {
        const intent = body.action;
        const payload = intentPayload(intent, body);
        const customerId = await store.customerOf(payload.accountId).catch(() => null);
        if (!customerId) throw adminFail('admin_not_found', 'Conta não encontrada ou sem cliente verificado.', 404);
        // Ninguém se isenta sozinho, e conta com papel de admin ou suporte não
        // recebe nem perde isenção por outro admin (MOO-19). Revogar a própria
        // isenção continua permitido.
        const selfTarget = customerId === owner;
        if ((intent === 'grant' && selfTarget) || (!selfTarget && await store.roleOf(customerId))) {
          throw adminFail('admin_target_forbidden', 'Esta ação não pode ser feita na sua conta nem em outra conta da equipe.', 403);
        }
        // Conta a tentativa antes de abrir a transação da ação (AUTH-04).
        await store.claimChallengeAttempt(actor, { challengeId: body.challengeId, now: now() });
        const hooks = {
          before: (tx) => store.consumeChallenge(tx, actor, { challengeId: body.challengeId, code: body.code, action: intent, payload, now: now() }),
          after: (tx, result) => store.recordAction(tx, {
            actorId: actor.id, actorRole: role, action: intent === 'grant' ? 'grant_exemption' : 'revoke_exemption',
            target: payload.accountId, reason: payload.reason,
            details: intent === 'grant'
              ? { grantId: result.grant.id, tier: payload.tier, unlimitedImages: payload.unlimitedImages }
              : { grantId: payload.grantId },
          }),
        };
        const nowSec = Math.floor(now() / 1000);
        if (intent === 'grant') {
          const result = await grant({
            accountId: payload.accountId, tier: payload.tier, unlimitedImages: payload.unlimitedImages,
            startsAtSec: nowSec, expiresAtSec: null, quotaAnchorSec: await store.quotaAnchorFor(customerId, nowSec),
            requestId: `admin-grant-${body.challengeId}`, actor: `admin:${owner}`, reason: payload.reason,
          }, hooks);
          return res.status(200).json({ ok: true, grant: result.grant });
        }
        await revoke({
          accountId: payload.accountId, grantId: payload.grantId,
          requestId: `admin-revoke-${body.challengeId}`, actor: `admin:${owner}`, reason: payload.reason,
        }, hooks);
        return res.status(200).json({ ok: true, revoked: true });
      }

      return res.status(400).json({ error: 'Ação inválida.', code: 'admin_bad_action' });
    } catch (cause) {
      if (cause?.code === 'entitlement_grant_conflict') {
        return res.status(409).json({ error: 'Esta conta já tem uma isenção ativa. Revogue a atual antes de conceder outra.', code: cause.code });
      }
      return send(res, cause);
    }
  };
}

export default createAdminHandler();
