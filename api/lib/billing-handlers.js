import crypto from 'crypto';
import {
  getStripe,
  getAppUrl,
  getPriceId,
  findActiveSubscription,
  isSubscriptionActive,
} from '../lib/stripe.js';
import {
  createAccessToken,
  setAccessCookie,
  readCurrentAccessCookie,
  clearAccessCookie,
  setCheckoutCookie,
  readCheckoutCookies,
  clearCheckoutCookie,
  CHECKOUT_MAX_AGE_SEC,
  readCheckoutIdentityCookie,
  clearCheckoutIdentityCookie,
  billingDisabled,
} from '../lib/access.js';
import {
  PLAN_ORDER,
  getPlan,
  getStripePriceIdForTier,
  resolveTierFromSubscription,
  imageQuotaForTier,
  periodBoundsFromSubscription,
} from './plans.js';
import { getQuotaUsage } from './image-quota.js';
import {
  accountIdentityBackendEnabled,
  getOrCreateAccountForStripeCustomer,
  revokeAccountSessions,
} from './account-identity-postgres.js';
import { invalidateActiveAccessForCustomer } from './require-access.js';
import { consumeRateLimit, rateLimitResponse } from './rate-limit.js';

import { applyCors } from './cors.js';

function cors(req, res) {
  applyCors(req, res, { credentials: true });
}

function readJson(req) {
  if (req.body == null) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return req.body;
}

/** GET /api/auth/session — estado da assinatura do cookie atual */
export async function handleSession(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const limited = await consumeRateLimit(req, { limit: 60, windowMs: 60_000, keyPrefix: 'session' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  if (billingDisabled()) {
    return res.status(200).json({
      active: true,
      billingDisabled: true,
      email: null,
      status: 'disabled',
      tier: 'max',
      plan: getPlan('max'),
      imageQuota: {
        status: 'available',
        available: true,
        allowed: true,
        used: 0,
        limit: imageQuotaForTier('max'),
        remaining: imageQuotaForTier('max'),
        tier: 'max',
      },
    });
  }

  try {
    const access = await readCurrentAccessCookie(req);
    if (!access?.customerId) {
      return res.status(200).json({ active: false, email: null, status: 'anonymous' });
    }

    const sub = await findActiveSubscription(access.customerId);
    if (!sub) {
      invalidateActiveAccessForCustomer(access.customerId);
      return res.status(200).json({
        active: false,
        email: access.email,
        status: 'inactive',
      });
    }

    const tier = resolveTierFromSubscription(sub);
    const bounds = periodBoundsFromSubscription(sub);
    const limit = imageQuotaForTier(tier);
    let imageQuota = {
      status: 'unavailable',
      available: false,
      allowed: false,
      used: null,
      limit,
      remaining: null,
      tier,
      code: 'quota_store_unavailable',
    };
    try {
      if (limit > 0 && !bounds.periodStartSec) {
        throw Object.assign(new Error('Período da assinatura indisponível.'), { code: 'quota_period_unavailable' });
      }
      imageQuota = {
        ...(limit > 0 ? await getQuotaUsage({
          customerId: access.customerId,
          periodStartSec: bounds.periodStartSec,
          limit,
        }) : { used: 0, limit: 0, remaining: 0, allowed: false }),
        status: 'available',
        available: true,
        tier,
      };
    } catch (qe) {
      imageQuota.code = qe?.code === 'quota_period_unavailable' ? qe.code : 'quota_store_unavailable';
      console.warn('[auth/session] quota', qe?.message || qe);
    }

    return res.status(200).json({
      active: true,
      email: access.email,
      customerId: access.customerId,
      status: sub.status,
      currentPeriodEnd: bounds.periodEnd,
      currentPeriodStart: bounds.periodStart,
      tier,
      plan: getPlan(tier),
      imageQuota,
    });
  } catch (e) {
    console.error('[auth/session]', e?.message || e);
    return res.status(500).json({ active: false, error: 'session_error' });
  }
}

/** POST /api/stripe/checkout — cria Checkout Session de assinatura */
export async function handleCheckout(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (billingDisabled()) {
    return res.status(400).json({ error: 'Billing desativado neste ambiente' });
  }

  const limited = await consumeRateLimit(req, { limit: 8, windowMs: 60_000, keyPrefix: 'checkout' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  try {
    const { email, tier: rawTier } = readJson(req);
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Informe um e-mail válido' });
    }

    const tier = PLAN_ORDER.includes(rawTier) ? rawTier : 'creator';
    const stripe = getStripe();
    const priceId = getStripePriceIdForTier(tier) || getPriceId();
    if (!priceId) {
      return res.status(500).json({ error: `Price Stripe não configurado para o plano ${tier}` });
    }
    const appUrl = getAppUrl(req);

    // O e-mail do formulário não prova titularidade de um customer existente.
    // Só login anterior ou prova curta emitida após Google/senha/cadastro novo
    // podem vincular este checkout a uma conta que já possui projetos.
    const identity = readCheckoutIdentityCookie(req);
    const proofMatches = identity?.email === cleanEmail;
    // O Google pode identificar o customer com os projetos mesmo quando este
    // browser ainda tem acesso a outro customer duplicado do mesmo e-mail.
    const access = proofMatches ? null : await readCurrentAccessCookie(req);
    const accessMatches = !proofMatches && String(access?.email || '').trim().toLowerCase() === cleanEmail;
    const boundCustomerId = proofMatches ? identity.customerId
      : accessMatches ? access.customerId : null;
    let customer;
    if (boundCustomerId) {
      customer = await stripe.customers.retrieve(boundCustomerId);
      if (!customer || customer.deleted || String(customer.email || '').trim().toLowerCase() !== cleanEmail) {
        return res.status(403).json({ error: 'A conta mudou. Entre novamente antes de assinar.' });
      }
    } else {
      let existingCustomer = null;
      let startingAfter;
      for (let page = 0; page < 10; page += 1) {
        const result = await stripe.customers.list({
          email: cleanEmail,
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
        existingCustomer = result.data.find((entry) => !entry.deleted);
        if (existingCustomer || !result.has_more) break;
        startingAfter = result.data.at(-1)?.id;
        if (!startingAfter || page === 9) throw new Error('Muitos clientes para o mesmo e-mail');
      }
      if (existingCustomer) {
        return res.status(200).json({
          requireLogin: true,
          message: 'Este e-mail já tem conta. Entre com Google ou sua senha antes de escolher o plano.',
        });
      }
      customer = await stripe.customers.create({
        email: cleanEmail,
        metadata: { product: 'viral-carrossel' },
      });
    }

    const active = await findActiveSubscription(customer.id);
    if (active) {
      // NÃO emitir cookie só com e-mail — isso permitia entrar sem prova de identidade.
      // Login de assinante = Google OAuth (ou retorno do Stripe Checkout após pagar).
      return res.status(200).json({
        alreadyActive: true,
        requireLogin: true,
        message: 'Este e-mail já tem assinatura ativa. Entre na sua conta para acessar o studio.',
      });
    }

    const account = accountIdentityBackendEnabled()
      ? await getOrCreateAccountForStripeCustomer(customer.id)
      : null;
    const identityEpoch = account
      ? String(account.identityEpoch || '')
      : String(customer.metadata?.vc_identity_epoch || '');
    if (proofMatches && String(identity.identityEpoch || '') !== identityEpoch) {
      return res.status(403).json({ error: 'Sua sessão de assinatura mudou. Entre novamente antes de assinar.' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      client_reference_id: customer.id,
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_MAX_AGE_SEC - 60,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?billing=success`,
      cancel_url: `${appUrl}/?billing=cancel`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      subscription_data: {
        metadata: {
          product: 'viral-carrossel',
          tier,
          image_quota: String(imageQuotaForTier(tier)),
        },
      },
      metadata: {
        product: 'viral-carrossel',
        email: cleanEmail,
        tier,
        ...(identityEpoch ? { vc_identity_epoch: identityEpoch } : {}),
      },
    });

    clearCheckoutIdentityCookie(res);
    setCheckoutCookie(res, session.id);
    return res.status(200).json({ url: session.url, sessionId: session.id, tier });
  } catch (e) {
    console.error('[stripe/checkout]', e);
    return res.status(500).json({ error: e.message || 'checkout_error' });
  }
}

/** POST /api/stripe/confirm — troca session_id do Checkout por cookie de acesso */
export async function handleConfirm(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const limited = await consumeRateLimit(req, { limit: 20, windowMs: 60_000, keyPrefix: 'confirm' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  try {
    const boundSessions = readCheckoutCookies(req);
    if (!boundSessions.length) {
      return res.status(401).json({
        error: 'Confirme a compra neste browser, a partir do checkout que você iniciou.',
      });
    }
    const { sessionId: bodySession } = readJson(req);
    const selected = bodySession
      ? boundSessions.find(({ sessionId }) => sessionId === String(bodySession))
      : boundSessions.length === 1 ? boundSessions[0] : null;
    if (!selected) {
      if (!bodySession) {
        return res.status(409).json({ error: 'Há mais de um checkout neste browser. Volte à aba onde iniciou esta compra.' });
      }
      return res.status(403).json({
        error: 'Esta confirmação não corresponde ao checkout deste browser.',
      });
    }
    const sessionId = selected.sessionId;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(String(sessionId), {
      expand: ['subscription', 'customer'],
    });
    // A marcação é idempotente para o mesmo browser. Se a resposta HTTP se
    // perder depois do update no Stripe, a aba original ainda pode repetir.
    if (session.metadata?.vc_confirmed_at
      && session.metadata?.vc_confirmed_binding !== selected.binding) {
      return res.status(409).json({ error: 'Este checkout já foi confirmado.' });
    }

    if (session.mode !== 'subscription') {
      return res.status(400).json({ error: 'Sessão inválida' });
    }

    const paid = session.payment_status === 'paid'
      || session.payment_status === 'no_payment_required';
    if (!paid) {
      return res.status(402).json({ error: 'Pagamento ainda não confirmado' });
    }

    const customerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;
    const email = session.customer_details?.email
      || session.customer_email
      || (typeof session.customer === 'object' ? session.customer?.email : null)
      || session.metadata?.email;

    if (!customerId || !email) {
      return res.status(400).json({ error: 'Cliente Stripe incompleto' });
    }

    // Primeiro login Google troca a versão da identidade. Checkout anterior
    // (inclusive retry idempotente com cookie guardado) nunca reabre a conta.
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer || customer.deleted) {
      return res.status(403).json({ error: 'Esta conta já não está disponível.' });
    }
    const account = accountIdentityBackendEnabled()
      ? await getOrCreateAccountForStripeCustomer(customerId)
      : null;
    const identityEpoch = account
      ? String(account.identityEpoch || '')
      : String(customer.metadata?.vc_identity_epoch || '');
    if (String(session.metadata?.vc_identity_epoch || '') !== identityEpoch) {
      return res.status(403).json({ error: 'Esta compra pertence a uma sessão antiga da conta. Entre novamente.' });
    }

    const sub = typeof session.subscription === 'object'
      ? session.subscription
      : await findActiveSubscription(customerId);

    if (!isSubscriptionActive(sub) && !(await findActiveSubscription(customerId))) {
      return res.status(402).json({ error: 'Assinatura inativa' });
    }

    if (!session.metadata?.vc_confirmed_at) {
      await stripe.checkout.sessions.update(sessionId, {
        metadata: {
          ...(session.metadata || {}),
          vc_confirmed_at: String(Date.now()),
          vc_confirmed_binding: selected.binding,
        },
      });
    }

    const token = createAccessToken({
      customerId, email, identityEpoch,
      ...(account ? {
        accountId: account.id,
        iatMs: Math.max(Date.now(), account.sessionRevokedBefore + 1),
      } : {}),
    });
    clearCheckoutCookie(res, sessionId);
    clearCheckoutIdentityCookie(res);
    setAccessCookie(res, token);

    return res.status(200).json({
      active: true,
      email,
    });
  } catch (e) {
    console.error('[stripe/confirm]', e?.message || e);
    return res.status(500).json({ error: 'confirm_error' });
  }
}

/** POST /api/stripe/portal — Customer Portal Stripe */
export async function handlePortal(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const limited = await consumeRateLimit(req, { limit: 10, windowMs: 60_000, keyPrefix: 'portal' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  try {
    const access = await readCurrentAccessCookie(req);
    if (!access?.customerId) {
      return res.status(401).json({ error: 'Faça login pela assinatura primeiro' });
    }

    const stripe = getStripe();
    const appUrl = getAppUrl(req);
    const portal = await stripe.billingPortal.sessions.create({
      customer: access.customerId,
      return_url: `${appUrl}/?app=1`,
    });

    return res.status(200).json({ url: portal.url });
  } catch (e) {
    console.error('[stripe/portal]', e);
    return res.status(500).json({ error: e.message || 'portal_error' });
  }
}

/** POST /api/auth/logout — limpa cookie */
export async function handleLogout(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let sessionsRevoked = false;
  let revocationError = null;
  try {
    const access = await readCurrentAccessCookie(req);
    if (access?.customerId) {
      invalidateActiveAccessForCustomer(access.customerId);
      try {
        if (accountIdentityBackendEnabled()) {
          await revokeAccountSessions(access.customerId);
        } else {
          await getStripe().customers.update(access.customerId, {
            metadata: {
              vc_session_revoked_before: String(Date.now()),
              vc_identity_epoch: crypto.randomBytes(16).toString('hex'),
            },
          });
        }
        sessionsRevoked = true;
      } catch (e) {
        console.error('[auth/logout] revoke', e?.message || e);
        revocationError = 'revocation_failed';
      }
    }
  } catch (e) {
    console.error('[auth/logout] current access', e?.message || e);
    revocationError = 'revocation_unverified';
  }
  try {
    for (const checkout of readCheckoutCookies(req)) clearCheckoutCookie(res, checkout.sessionId);
  } catch (e) {
    // Mesmo com configuração de assinatura indisponível, o cookie de acesso
    // local precisa ser removido antes da resposta.
    console.error('[auth/logout] checkout cookies', e?.message || e);
  }
  clearAccessCookie(res);
  clearCheckoutIdentityCookie(res);
  return res.status(200).json({
    ok: true,
    localCookieCleared: true,
    sessionsRevoked,
    ...(revocationError ? { warning: revocationError } : {}),
  });
}
