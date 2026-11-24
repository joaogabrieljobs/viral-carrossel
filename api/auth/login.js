import { publicErrorBody } from '../lib/public-error.js';
import { createHash } from 'node:crypto';
import { applyCors, rejectCrossSiteRequest } from '../lib/cors.js';
import { createAccessToken, readCurrentAccessCookie, setAccessCookie, setCheckoutIdentityCookie, setLoginHintCookie } from '../lib/access.js';
import {
  normalizeEmail,
  isValidEmail,
  getAuthRecordsMatchingPassword,
  passwordAuthConfigured,
  verifyPassword,
} from '../lib/password-auth.js';
import { getStripe } from '../lib/stripe.js';
import { FREE_PLAN } from '../../shared/plans.js';
import { resolveAccountEntitlement } from '../lib/account-entitlements.js';
import { consumeRateLimit, rateLimitResponse, rateLimitClientIp } from '../lib/rate-limit.js';
import {
  accountIdentityBackendEnabled, getAccountByStripeCustomerId, getPasswordRecordByStripeCustomerId,
} from '../lib/account-identity-postgres.js';

/**
 * Confirma a senha da conta JÁ autenticada, antes de uma ação destrutiva
 * (ex.: "Sair e apagar deste aparelho"). Não emite nem altera cookie: a conta
 * vem da sessão, nunca do corpo, então não serve para entrar em outra conta.
 * Conta sem senha (só Google) responde `hasPassword: false`.
 */
async function confirmCurrentPassword(req, res, password) {
  let access;
  try { access = await readCurrentAccessCookie(req); }
  catch { return res.status(503).json({ error: 'Não foi possível verificar sua sessão. Tente novamente.' }); }
  if (!access?.customerId) return res.status(401).json({ error: 'Entre na sua conta para continuar.' });
  let record;
  if (accountIdentityBackendEnabled()) {
    record = await getPasswordRecordByStripeCustomerId(access.customerId);
  } else {
    const customer = await getStripe().customers.retrieve(access.customerId);
    record = customer && !customer.deleted
      ? { salt: customer.metadata?.vc_pw_salt || null, hash: customer.metadata?.vc_pw_hash || null }
      : null;
  }
  const hasPassword = !!(record?.salt && record?.hash);
  if (!hasPassword) return res.status(200).json({ verified: false, hasPassword: false });
  // GB-13: pergunta sem senha só quer saber se a conta tem senha, para o diálogo
  // abrir no campo certo. Não há palpite a conferir, então não gasta o limite.
  if (!String(password || '')) return res.status(200).json({ verified: false, hasPassword: true });
  // Limite por conta (AUTH-05): a confirmação saía antes dos limites do login e,
  // com a sessão de alguém, cada resposta dizia se o palpite conferia, sem teto.
  // A conta vem da sessão, então um terceiro não consegue gastar o balde alheio.
  const limited = await consumeRateLimit(req, {
    limit: 5, windowMs: 15 * 60_000, keyPrefix: 'login-confirm', failClosed: true,
    subject: createHash('sha256').update(String(access.customerId)).digest('hex').slice(0, 40),
  });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);
  const verified = verifyPassword(String(password || ''), record);
  return res.status(verified ? 200 : 401).json(verified
    ? { verified: true, hasPassword: true }
    : { verified: false, hasPassword: true, error: 'Senha incorreta.' });
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

/**
 * POST /api/auth/login — e-mail + senha → cookie de sessão.
 * Sem assinatura ativa a conta entra no plano grátis (`free: true`).
 */
export default async function handler(req, res) {
  applyCors(req, res, { credentials: true });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (rejectCrossSiteRequest(req, res)) return;

  const limited = await consumeRateLimit(req, {
    limit: 20, windowMs: 60_000, keyPrefix: 'login', failClosed: true,
  });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  if (!passwordAuthConfigured()) {
    return res.status(503).json({ error: 'Login por e-mail indisponível.' });
  }

  const { email, password, purpose } = readBody(req);
  if (purpose === 'confirm') {
    try { return await confirmCurrentPassword(req, res, password); }
    catch (e) {
      console.error('[auth/login confirm]', e?.message || e);
      return res.status(e?.status === 503 ? 503 : 500).json({ error: 'Não foi possível confirmar a senha agora.' });
    }
  }
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail) || !String(password || '')) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  // Dois limites por e-mail além do limite por IP (MOO-05, AUTH-01).
  // 1) Por e-mail + origem, 10 em 15 min: quem erra a senha esgota só o próprio
  //    balde. Antes o balde era só do e-mail, e 10 tentativas de um terceiro no
  //    começo de cada janela davam 429 à dona da conta com a senha certa.
  // 2) Por e-mail, 100 em 15 min: várias origens não multiplicam sem teto as
  //    tentativas contra a mesma conta. Tentativa barrada em (1) não conta em (2).
  // Cada tentativa barrada deixa de consultar a senha e o Stripe. Google e
  // "Esqueci a senha" seguem livres.
  const emailKey = createHash('sha256').update(cleanEmail).digest('hex').slice(0, 40);
  const pairKey = createHash('sha256').update(`${cleanEmail}|${rateLimitClientIp(req)}`).digest('hex').slice(0, 40);
  const perOrigin = await consumeRateLimit(req, {
    limit: 10, windowMs: 15 * 60_000, keyPrefix: 'login-email-ip', failClosed: true, subject: pairKey,
  });
  if (perOrigin) return rateLimitResponse(res, perOrigin.retryAfterSec);
  const perEmail = await consumeRateLimit(req, {
    limit: 100, windowMs: 15 * 60_000, keyPrefix: 'login-email', failClosed: true, subject: emailKey,
  });
  if (perEmail) return rateLimitResponse(res, perEmail.retryAfterSec);

  try {
    const matches = await getAuthRecordsMatchingPassword(cleanEmail, password);
    if (!matches.length) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }
    if (matches.length > 1) {
      return res.status(409).json({ error: 'Há mais de uma conta com esta senha. Entre em contato com o suporte para identificar a conta certa.' });
    }
    const record = matches[0];

    const dbIdentity = accountIdentityBackendEnabled();
    let customerId = record.customerId;
    if (dbIdentity) {
      const account = await getAccountByStripeCustomerId(customerId);
      if (!account || account.id !== record.accountId || account.email !== cleanEmail
        || account.identityEpoch !== record.identityEpoch) {
        return res.status(401).json({ error: 'A conta mudou. Entre novamente para continuar.' });
      }
    } else {
      const stripe = getStripe();
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer || customer.deleted || normalizeEmail(customer.email) !== cleanEmail) {
        return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      }
      if (record.identityEpoch !== String(customer.metadata?.vc_identity_epoch || '')) {
        return res.status(401).json({ error: 'A conta mudou. Entre novamente para continuar.' });
      }
      customerId = customer.id;
    }

    const entitlement = await resolveAccountEntitlement(customerId);
    const token = createAccessToken({
      customerId,
      email: cleanEmail,
      identityEpoch: record.identityEpoch,
      ...(dbIdentity ? { accountId: record.accountId } : {}),
      ...(dbIdentity ? { iatMs: Math.max(Date.now(), Number(record.sessionRevokedBefore || 0) + 1) } : {}),
    });
    if (!entitlement.active) {
      // Plano grátis: a senha prova a identidade, então a sessão existe.
      // O cookie não concede nada pago — cada rota de IA, nuvem e agente
      // confere a assinatura por conta própria e responde 402.
      setCheckoutIdentityCookie(res, {
        email: cleanEmail,
        customerId,
        source: 'verified_login',
        identityEpoch: record.identityEpoch,
      });
      setLoginHintCookie(res, cleanEmail);
      setAccessCookie(res, token);
      return res.status(200).json({
        active: false,
        free: true,
        plan: FREE_PLAN.id,
        email: cleanEmail,
        customerId,
        login: 'password',
      });
    }

    setAccessCookie(res, token);
    return res.status(200).json({
      active: true,
      email: cleanEmail,
      customerId,
      login: 'password',
    });
  } catch (e) {
    console.error('[auth/login]', e?.message || e);
    return res.status(e?.status === 503 ? 503 : 500).json(publicErrorBody(e, 'login_error', 'Não foi possível entrar agora. Tente novamente em instantes.'));
  }
}
