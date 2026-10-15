import crypto from 'crypto';
import { getStripe } from './stripe.js';
import {
  accountIdentityBackendEnabled,
  getOrCreateAccountForStripeCustomer,
} from './account-identity-postgres.js';

const COOKIE_NAME = 'vc_access';
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 dias

// Nunca reusar STRIPE_SECRET_KEY como chave de assinatura de cookie —
// segredos de domínios distintos, rotação independente.
function getSecret() {
  const s = process.env.ACCESS_COOKIE_SECRET;
  if (!s) throw new Error('ACCESS_COOKIE_SECRET em falta');
  return s;
}

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function fromB64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64').toString('utf8');
}

function sign(payloadB64) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/** @param {{ customerId: string, email: string }} data */
export function createAccessToken(data) {
  const iatMs = Number.isSafeInteger(data.iatMs) ? data.iatMs : Date.now();
  const payload = {
    customerId: data.customerId,
    email: data.email,
    iat: Math.floor(iatMs / 1000),
    iatMs,
    ...(data.identityEpoch ? { identityEpoch: data.identityEpoch } : {}),
    ...(data.accountId ? { accountId: data.accountId } : {}),
  };
  const body = b64urlJson(payload);
  return `${body}.${sign(body)}`;
}

export function verifyAccessToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromB64url(body));
    if (!payload.customerId || !payload.email) return null;
    if (payload.accountId
      && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(payload.accountId)) return null;
    if (payload.iat && Date.now() / 1000 - payload.iat > MAX_AGE_SEC) return null;
    if (payload.iatMs && payload.iatMs > Date.now() + 60_000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const header = req.headers?.cookie || req.headers?.Cookie || '';
  const out = {};
  String(header)
    .split(';')
    .forEach((part) => {
      const idx = part.indexOf('=');
      if (idx === -1) return;
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (k) {
        try { out[k] = decodeURIComponent(v); }
        catch { /* cookie malformado não pode derrubar a autenticação */ }
      }
    });
  return out;
}

export function readAccessCookie(req) {
  const cookies = parseCookies(req);
  return verifyAccessToken(cookies[COOKIE_NAME]);
}

/** Rejeita também sessões anteriores a uma recuperação de senha. */
export async function readCurrentAccessCookie(req) {
  const access = readAccessCookie(req);
  if (!access) return null;
  if (accountIdentityBackendEnabled()) {
    let account;
    try { account = await getOrCreateAccountForStripeCustomer(access.customerId); }
    catch (error) {
      if (error?.code === 'identity_customer_not_found'
        || error?.code === 'identity_customer_not_verified'
        || error?.code === 'identity_bad_customer') return null;
      throw error;
    }
    if (!account || (access.accountId && access.accountId !== account.id)
      || String(access.identityEpoch || '') !== String(account.identityEpoch || '')) return null;
    const issuedAt = Number(access.iatMs || access.iat * 1000 || 0);
    if (account.sessionRevokedBefore && issuedAt <= account.sessionRevokedBefore) return null;
    return { ...access, accountId: account.id };
  }
  let customer;
  try { customer = await getStripe().customers.retrieve(access.customerId); }
  catch (error) { if (error.code === 'resource_missing') return null; throw error; }
  if (!customer || customer.deleted) return null;
  const identityEpoch = String(customer.metadata?.vc_identity_epoch || '');
  if (identityEpoch && access.identityEpoch !== identityEpoch) return null;
  const revokedBefore = Number(customer.metadata?.vc_session_revoked_before || 0);
  const issuedAt = Number(access.iatMs || access.iat * 1000 || 0);
  if (revokedBefore && issuedAt <= revokedBefore) return null;
  return access;
}

function appendSetCookie(res, value) {
  const prev = res.getHeader?.('Set-Cookie');
  if (!prev) {
    res.setHeader('Set-Cookie', value);
  } else if (Array.isArray(prev)) {
    res.setHeader('Set-Cookie', [...prev, value]);
  } else {
    res.setHeader('Set-Cookie', [prev, value]);
  }
}

export function setAccessCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${MAX_AGE_SEC}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  appendSetCookie(res, parts.join('; '));
}

export function clearAccessCookie(res) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  appendSetCookie(res, parts.join('; '));
}

export const CHECKOUT_COOKIE = 'vc_checkout';
export const CHECKOUT_MAX_AGE_SEC = 60 * 60 * 24;
const CHECKOUT_COOKIE_PREFIX = `${CHECKOUT_COOKIE}_`;
export const LOGIN_HINT_COOKIE = 'vc_login_hint';
export const CHECKOUT_IDENTITY_COOKIE = 'vc_identity_checkout';
const CHECKOUT_IDENTITY_MAX_AGE_SEC = 60 * 10;

function browserCookie(name, value, { maxAge, httpOnly }) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
  ];
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

/** Um cookie independente por sessão evita que duas abas sobrescrevam o checkout uma da outra. */
export function checkoutCookieName(sessionId) {
  return `${CHECKOUT_COOKIE_PREFIX}${crypto.createHmac('sha256', getSecret()).update(String(sessionId)).digest('hex').slice(0, 20)}`;
}

export function setCheckoutCookie(res, sessionId) {
  const body = b64urlJson({
    v: 1,
    sessionId,
    nonce: crypto.randomBytes(16).toString('hex'),
    iat: Math.floor(Date.now() / 1000),
  });
  appendSetCookie(res, browserCookie(checkoutCookieName(sessionId), `v1.${body}.${sign(body)}`, {
    maxAge: CHECKOUT_MAX_AGE_SEC,
    httpOnly: true,
  }));
}

export function clearCheckoutCookie(res, sessionId) {
  appendSetCookie(res, browserCookie(checkoutCookieName(sessionId), '', {
    maxAge: 0,
    httpOnly: true,
  }));
}

/** Só aceita id + nonce protegidos pelo HMAC, ainda dentro do prazo. */
export function readCheckoutCookies(req) {
  const now = Math.floor(Date.now() / 1000);
  return Object.entries(parseCookies(req))
    .filter(([name]) => name.startsWith(CHECKOUT_COOKIE_PREFIX))
    .flatMap(([name, value]) => {
      const [version, body, signature, extra] = String(value).split('.');
      if (version !== 'v1' || !body || !signature || extra) return [];
      const expected = sign(body);
      const a = Buffer.from(signature);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return [];
      try {
        const data = JSON.parse(fromB64url(body));
        if (data.v !== 1 || !/^cs_[A-Za-z0-9_]+$/.test(data.sessionId)
          || !/^[a-f0-9]{32}$/.test(data.nonce)
          || name !== checkoutCookieName(data.sessionId)
          || !Number.isSafeInteger(data.iat)
          || data.iat > now + 60
          || now - data.iat > CHECKOUT_MAX_AGE_SEC) return [];
        const binding = crypto.createHmac('sha256', getSecret())
          .update(`${data.sessionId}:${data.nonce}`).digest('hex');
        return [{ sessionId: data.sessionId, cookieName: name, binding }];
      } catch { return []; }
    });
}

export function readCheckoutCookie(req) {
  const matches = readCheckoutCookies(req);
  return matches.length === 1 ? matches[0].sessionId : '';
}

/** Liga temporariamente o checkout a um customer após login verificado ou cadastro novo. */
export function setCheckoutIdentityCookie(res, { email, customerId, source, identityEpoch = '' }) {
  if (!['verified_login', 'new_registration'].includes(source)
    || !/^cus_[A-Za-z0-9_]+$/.test(String(customerId || ''))) {
    throw new Error('Identidade do checkout inválida');
  }
  const body = b64urlJson({
    v: 1,
    email: String(email || '').trim().toLowerCase(),
    customerId,
    source,
    identityEpoch: String(identityEpoch || ''),
    iat: Math.floor(Date.now() / 1000),
  });
  const signature = sign(`checkout-identity:${body}`);
  appendSetCookie(res, browserCookie(CHECKOUT_IDENTITY_COOKIE, `v1.${body}.${signature}`, {
    maxAge: CHECKOUT_IDENTITY_MAX_AGE_SEC,
    httpOnly: true,
  }));
}

export function readCheckoutIdentityCookie(req) {
  const value = parseCookies(req)[CHECKOUT_IDENTITY_COOKIE];
  const [version, body, signature, extra] = String(value || '').split('.');
  if (version !== 'v1' || !body || !signature || extra) return null;
  const expected = sign(`checkout-identity:${body}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(fromB64url(body));
    const now = Math.floor(Date.now() / 1000);
    if (data.v !== 1 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
      || data.email !== data.email.trim().toLowerCase()
      || !/^cus_[A-Za-z0-9_]+$/.test(data.customerId)
      || !['verified_login', 'new_registration'].includes(data.source)
      || (data.identityEpoch != null && !/^[a-f0-9]{0,64}$/.test(data.identityEpoch))
      || !Number.isSafeInteger(data.iat)
      || data.iat > now + 60
      || now - data.iat > CHECKOUT_IDENTITY_MAX_AGE_SEC) return null;
    return { email: data.email, customerId: data.customerId, source: data.source,
      ...(data.identityEpoch ? { identityEpoch: data.identityEpoch } : {}) };
  } catch { return null; }
}

export function clearCheckoutIdentityCookie(res) {
  appendSetCookie(res, browserCookie(CHECKOUT_IDENTITY_COOKIE, '', {
    maxAge: 0,
    httpOnly: true,
  }));
}

/** E-mail do Google sem plano: preenche o paywall sem ir para a URL (logs/Referer). */
export function setLoginHintCookie(res, email) {
  appendSetCookie(res, browserCookie(LOGIN_HINT_COOKIE, email, {
    maxAge: 300,
    httpOnly: false,
  }));
}

export { COOKIE_NAME, MAX_AGE_SEC };

export function billingDisabled() {
  const flag = process.env.BILLING_DISABLED === 'true' || process.env.BILLING_DISABLED === '1';
  if (!flag) return false;
  // Guard: flag é dev-only. Em produção (Vercel prod ou NODE_ENV=production
  // fora da Vercel) ignora, mesmo se alguém setar por engano.
  if (process.env.VERCEL_ENV === 'production') return false;
  if (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'production') return false;
  return true;
}
