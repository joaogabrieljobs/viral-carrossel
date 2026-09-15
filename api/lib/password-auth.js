/**
 * Contas e-mail + senha (hash scrypt) no metadata do customer Stripe.
 * Campos: vc_pw_salt, vc_pw_hash (≤500 chars cada — cabem no Stripe metadata).
 * Não depende de Upstash (quota de imagem continua lá).
 */
import crypto from 'crypto';
import { getStripe } from './stripe.js';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 64;

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

async function findCustomerByEmail(email) {
  const stripe = getStripe();
  const clean = normalizeEmail(email);
  const list = await stripe.customers.list({ email: clean, limit: 5 });
  return list.data.find((c) => !c.deleted) || list.data[0] || null;
}

export async function getAuthRecord(email) {
  const customer = await findCustomerByEmail(email);
  if (!customer) return null;
  const salt = customer.metadata?.vc_pw_salt;
  const hash = customer.metadata?.vc_pw_hash;
  if (!salt || !hash) {
    return { customerId: customer.id, email: normalizeEmail(email), salt: null, hash: null };
  }
  return {
    customerId: customer.id,
    email: normalizeEmail(email),
    salt,
    hash,
  };
}

export async function setAuthRecord(email, record) {
  const stripe = getStripe();
  const clean = normalizeEmail(email);
  let customerId = record.customerId;
  let customer = null;

  if (customerId) {
    customer = await stripe.customers.retrieve(customerId);
  } else {
    customer = await findCustomerByEmail(clean);
    customerId = customer?.id;
  }

  if (!customer || customer.deleted) {
    customer = await stripe.customers.create({
      email: clean,
      metadata: {
        product: 'viral-carrossel',
        vc_pw_salt: record.salt,
        vc_pw_hash: record.hash,
      },
    });
    return {
      email: clean,
      customerId: customer.id,
      salt: record.salt,
      hash: record.hash,
      updatedAt: Math.floor(Date.now() / 1000),
    };
  }

  await stripe.customers.update(customer.id, {
    metadata: {
      ...customer.metadata,
      vc_pw_salt: record.salt,
      vc_pw_hash: record.hash,
    },
  });

  return {
    email: clean,
    customerId: customer.id,
    salt: record.salt,
    hash: record.hash,
    updatedAt: Math.floor(Date.now() / 1000),
  };
}

/** Cria ou atualiza senha. Não sobrescreve se `overwrite` for false e já existir hash. */
export async function upsertPassword(email, password, { customerId = null, overwrite = true } = {}) {
  const clean = normalizeEmail(email);
  if (!isValidEmail(clean)) throw new Error('E-mail inválido');
  if (!isValidPassword(password)) throw new Error('Senha deve ter entre 8 e 128 caracteres');

  const existing = await getAuthRecord(clean);
  if (existing?.hash && !overwrite) {
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
  return Boolean(String(process.env.STRIPE_SECRET_KEY || '').trim());
}
