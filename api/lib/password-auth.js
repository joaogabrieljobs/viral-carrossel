/**
 * Contas e-mail + senha (hash scrypt) em Upstash Redis.
 * Chave: vc:auth:{email} → JSON { salt, hash, customerId?, updatedAt }
 */
import crypto from 'crypto';

const memory = new Map();
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 64;

function hasUpstash() {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim()
    && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function authKey(email) {
  return `vc:auth:${normalizeEmail(email)}`;
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function isValidPassword(password) {
  const p = String(password || '');
  return p.length >= 8 && p.length <= 128;
}

async function upstash(command) {
  const base = process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN.trim();
  const res = await fetch(`${base}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upstash ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return json?.result;
}

function scryptHash(password, salt) {
  return crypto.scryptSync(String(password), salt, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  }).toString('base64');
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64');
  const hash = scryptHash(password, salt);
  return { salt, hash };
}

export function verifyPassword(password, record) {
  if (!record?.salt || !record?.hash) return false;
  const next = scryptHash(password, record.salt);
  const a = Buffer.from(next);
  const b = Buffer.from(String(record.hash));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function getAuthRecord(email) {
  const key = authKey(email);
  if (hasUpstash()) {
    const raw = await upstash(['GET', key]);
    if (!raw) return null;
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
  }
  return memory.get(key) || null;
}

export async function setAuthRecord(email, record) {
  const key = authKey(email);
  const payload = {
    ...record,
    email: normalizeEmail(email),
    updatedAt: Math.floor(Date.now() / 1000),
  };
  if (hasUpstash()) {
    await upstash(['SET', key, JSON.stringify(payload)]);
  } else {
    memory.set(key, payload);
  }
  return payload;
}

/** Cria ou atualiza senha. Não sobrescreve se `overwrite` for false e já existir. */
export async function upsertPassword(email, password, { customerId = null, overwrite = true } = {}) {
  const clean = normalizeEmail(email);
  if (!isValidEmail(clean)) throw new Error('E-mail inválido');
  if (!isValidPassword(password)) throw new Error('Senha deve ter entre 8 e 128 caracteres');

  const existing = await getAuthRecord(clean);
  if (existing && !overwrite) {
    throw new Error('Conta já existe');
  }

  const { salt, hash } = hashPassword(password);
  return setAuthRecord(clean, {
    salt,
    hash,
    customerId: customerId || existing?.customerId || null,
  });
}

export function generatePassword(length = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function passwordAuthConfigured() {
  return hasUpstash() || process.env.NODE_ENV !== 'production';
}
