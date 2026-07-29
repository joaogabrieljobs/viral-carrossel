import crypto from 'crypto';

const COOKIE_NAME = 'vc_access';
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 dias

function getSecret() {
  const s = process.env.ACCESS_COOKIE_SECRET || process.env.STRIPE_SECRET_KEY;
  if (!s) throw new Error('ACCESS_COOKIE_SECRET (ou STRIPE_SECRET_KEY) em falta');
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
  const payload = {
    customerId: data.customerId,
    email: data.email,
    iat: Math.floor(Date.now() / 1000),
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
    if (payload.iat && Date.now() / 1000 - payload.iat > MAX_AGE_SEC) return null;
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
      if (k) out[k] = decodeURIComponent(v);
    });
  return out;
}

export function readAccessCookie(req) {
  const cookies = parseCookies(req);
  return verifyAccessToken(cookies[COOKIE_NAME]);
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

export { COOKIE_NAME, MAX_AGE_SEC };

export function billingDisabled() {
  return process.env.BILLING_DISABLED === 'true' || process.env.BILLING_DISABLED === '1';
}
