import crypto from 'crypto';
import { getAppUrl } from './stripe.js';

const STATE_COOKIE = 'vc_google_oauth';
const STATE_MAX_AGE = 60 * 10; // 10 min

function cleanEnv(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

export function getGoogleClientId() {
  return cleanEnv(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID);
}

export function getGoogleClientSecret() {
  return cleanEnv(process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAuthConfigured() {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

export function getGoogleRedirectUri(req) {
  const fromEnv = cleanEnv(process.env.GOOGLE_REDIRECT_URI);
  if (fromEnv) return fromEnv;
  return `${getAppUrl(req)}/api/auth/google/callback`;
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function createOAuthState() {
  return b64url(crypto.randomBytes(24));
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

export function setOAuthStateCookie(res, state) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const parts = [
    `${STATE_COOKIE}=${encodeURIComponent(state)}`,
    'Path=/',
    `Max-Age=${STATE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  appendSetCookie(res, parts.join('; '));
}

export function clearOAuthStateCookie(res) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const parts = [
    `${STATE_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  appendSetCookie(res, parts.join('; '));
}

export function readOAuthStateCookie(req) {
  const header = req.headers?.cookie || req.headers?.Cookie || '';
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === STATE_COOKIE) {
      try { return decodeURIComponent(v); } catch { return v; }
    }
  }
  return null;
}

export function buildGoogleAuthUrl(req, state) {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getGoogleRedirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(req, code) {
  const body = new URLSearchParams({
    code,
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    redirect_uri: getGoogleRedirectUri(req),
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokens = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokens.access_token) {
    const msg = tokens.error_description || tokens.error || 'Falha ao trocar código Google';
    throw new Error(msg);
  }

  const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json().catch(() => ({}));
  if (!profileRes.ok || !profile.email) {
    throw new Error('Não foi possível ler o e-mail da conta Google');
  }
  if (profile.email_verified === false) {
    throw new Error('Confirme o e-mail da conta Google e tente de novo');
  }

  return {
    email: String(profile.email).trim().toLowerCase(),
    name: profile.name || null,
    picture: profile.picture || null,
  };
}

export { STATE_COOKIE };
