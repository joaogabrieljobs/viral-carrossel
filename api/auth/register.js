import { waitUntil } from '@vercel/functions';
import { applyCors, rejectCrossSiteRequest } from '../lib/cors.js';
import { createAccessToken, setAccessCookie, setCheckoutIdentityCookie, setLoginHintCookie } from '../lib/access.js';
import { FREE_PLAN } from '../../shared/plans.js';
import {
  normalizeEmail,
  isValidEmail,
  isValidPassword,
  getAuthRecord,
  hashPassword,
  passwordAuthConfigured,
} from '../lib/password-auth.js';
import { getStripe } from '../lib/stripe.js';
import { consumeRateLimit, rateLimitResponse } from '../lib/rate-limit.js';
import { accountIdentityBackendEnabled, setAccountPassword } from '../lib/account-identity-postgres.js';
import { passwordResetConfigured, sendExistingAccountNotice } from '../lib/password-reset.js';
import { createHash } from 'node:crypto';

function registrationIdempotencyKey(email, phase) {
  const digest = createHash('sha256').update(String(email), 'utf8').digest('hex');
  return `moont-register-${phase}-${digest}`;
}

function registrationConflict(error) {
  return error?.code === 'identity_credential_conflict'
    || error?.code === 'identity_provider_conflict'
    || error?.code === 'idempotency_key_in_use'
    || error?.type === 'StripeIdempotencyError';
}

// Mesma resposta para e-mail com conta e para cadastro que perdeu a corrida:
// não confirma se o endereço existe (MOO-16). Quem é dono recebe a orientação
// na própria caixa; quem não é não aprende nada sobre a base.
const CHECK_EMAIL_MESSAGE = 'Confira seu e-mail para continuar. Se este endereço estiver ligado a uma conta, '
  + 'enviamos instruções para entrar. Você também pode tocar em "Entrar" e usar sua senha, o Google '
  + 'ou "Esqueci minha senha".';

function respondCheckEmail(res, email) {
  if (passwordResetConfigured()) {
    // waitUntil: o envio não pesa no tempo de resposta nem some na Vercel.
    waitUntil(sendExistingAccountNotice(email)
      .then(delivery => console.info('[auth/register] aviso de conta existente', { delivery }))
      .catch(error => console.error('[auth/register] aviso de conta existente falhou', {
        code: /^email_http_\d{3}$/.test(error?.message) ? error.message : 'service_error',
      })));
  }
  return res.status(200).json({ ok: true, checkEmail: true, message: CHECK_EMAIL_MESSAGE });
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

/**
 * POST /api/auth/register — cria conta e-mail+senha.
 * Cliente preexistente só pode ser associado após autenticação; o cadastro
 * público cria sempre uma identidade Stripe nova, que entra no plano grátis
 * (sessão sem assinatura: IA, nuvem e agentes continuam recusando).
 * E-mail que já tem conta recebe a mesma resposta 200 neutra (`checkEmail`),
 * sem sessão, e a orientação para entrar segue por e-mail (MOO-16).
 */
export default async function handler(req, res) {
  applyCors(req, res, { credentials: true });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (rejectCrossSiteRequest(req, res)) return;

  const limited = await consumeRateLimit(req, {
    limit: 10, windowMs: 60_000, keyPrefix: 'register', failClosed: true,
  });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  if (!passwordAuthConfigured()) {
    return res.status(503).json({ error: 'Criar conta indisponível.' });
  }

  const { email, password } = readBody(req);
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres.' });
  }

  try {
    // O hash vem antes da consulta: e-mail com e sem conta pagam o mesmo scrypt.
    const { salt, hash } = hashPassword(password);
    const existing = await getAuthRecord(cleanEmail);
    if (existing) return respondCheckEmail(res, cleanEmail);

    const dbIdentity = accountIdentityBackendEnabled();
    const stripe = getStripe();
    // A chave por email faz chamadas simultâneas convergirem no mesmo customer.
    // A senha é ligada no passo seguinte com CAS/idempotência própria.
    const customer = await stripe.customers.create({
      email: cleanEmail,
      metadata: { product: 'viral-carrossel' },
    }, { idempotencyKey: registrationIdempotencyKey(cleanEmail, 'customer') });
    const identity = dbIdentity
      ? await setAccountPassword(customer.id, { salt, hash, expectedHash: '' })
      : null;
    if (!dbIdentity) {
      await stripe.customers.update(customer.id, {
        metadata: {
          ...(customer.metadata || {}),
          product: 'viral-carrossel',
          vc_pw_salt: salt,
          vc_pw_hash: hash,
        },
      }, { idempotencyKey: registrationIdempotencyKey(cleanEmail, 'credential') });
    }
    setCheckoutIdentityCookie(res, {
      email: cleanEmail,
      customerId: customer.id,
      source: 'new_registration',
      ...(identity ? { identityEpoch: identity.identityEpoch } : {}),
    });
    setLoginHintCookie(res, cleanEmail);
    // Conta nova entra direto no plano grátis. A sessão nasce depois da
    // credencial: no backend de identidade, definir a senha revoga tudo o
    // que foi emitido antes, então o token precisa ser posterior a isso.
    setAccessCookie(res, createAccessToken({
      customerId: customer.id,
      email: cleanEmail,
      ...(identity ? {
        identityEpoch: identity.identityEpoch,
        accountId: identity.id,
        iatMs: Math.max(Date.now(), Number(identity.sessionRevokedBefore || 0) + 1),
      } : {}),
    }));

    return res.status(200).json({
      active: false,
      free: true,
      plan: FREE_PLAN.id,
      email: cleanEmail,
      customerId: customer.id,
      message: 'Conta criada. Você entrou no plano grátis.',
    });
  } catch (e) {
    if (registrationConflict(e)) return respondCheckEmail(res, cleanEmail);
    console.error('[auth/register]', e?.message || e);
    return res.status(500).json({ error: 'Não foi possível criar a conta agora.' });
  }
}
