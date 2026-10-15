/**
 * Contas e-mail + senha (hash scrypt) no metadata do customer Stripe.
 * Campos: vc_pw_salt, vc_pw_hash (≤500 chars cada — cabem no Stripe metadata).
 * Não depende de Upstash (quota de imagem continua lá).
 */
import crypto from 'crypto';
import { getStripe } from './stripe.js';
import { getLibrarySyncMeta } from './library-sync-store.js';
import {
  accountIdentityBackendEnabled,
  findAccountsByEmail,
  findPasswordCandidatesByEmail,
  getOrCreateAccountForStripeCustomer,
  setAccountPassword,
} from './account-identity-postgres.js';

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

async function customersByEmail(email) {
  const stripe = getStripe();
  const clean = normalizeEmail(email);
  const customers = [];
  let startingAfter;
  for (let page = 0; page < 10; page += 1) {
    const result = await stripe.customers.list({
      email: clean,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    customers.push(...result.data.filter((customer) =>
      !customer.deleted && normalizeEmail(customer.email) === clean));
    if (!result.has_more) break;
    startingAfter = result.data.at(-1)?.id;
    if (!startingAfter || page === 9) throw new Error('Muitos clientes para o mesmo e-mail');
  }
  return customers.sort((a, b) => {
    const left = Number.isFinite(a.created) ? a.created : Number.MAX_SAFE_INTEGER;
    const right = Number.isFinite(b.created) ? b.created : Number.MAX_SAFE_INTEGER;
    return left - right;
  });
}

async function importStripeIdentitiesForEmail(email) {
  const customers = await customersByEmail(email);
  await Promise.all(customers.map((customer) => getOrCreateAccountForStripeCustomer(customer.id)));
  return customers;
}

function dbAuthRecord(account) {
  return account ? {
    customerId: account.stripeCustomerId,
    accountId: account.id,
    email: account.email,
    salt: account.salt,
    hash: account.hash,
    identityEpoch: account.identityEpoch,
    sessionRevokedBefore: account.sessionRevokedBefore,
  } : null;
}

async function findCustomerByEmail(email) {
  const customers = await customersByEmail(email);
  return customers.find((customer) => customer.metadata?.vc_pw_salt && customer.metadata?.vc_pw_hash)
    || customers[0]
    || null;
}

function authRecord(customer, email) {
  return {
    customerId: customer.id,
    email: normalizeEmail(email),
    salt: customer.metadata?.vc_pw_salt || null,
    hash: customer.metadata?.vc_pw_hash || null,
    identityEpoch: customer.metadata?.vc_identity_epoch || '',
  };
}

export async function getAuthRecord(email) {
  if (accountIdentityBackendEnabled()) {
    await importStripeIdentitiesForEmail(email);
    return dbAuthRecord((await findAccountsByEmail(email))[0]);
  }
  const customer = await findCustomerByEmail(email);
  return customer ? authRecord(customer, email) : null;
}

/** Recuperação nunca pode definir uma senha em outra conta duplicada do e-mail. */
export async function getPasswordRecoveryRecord(email) {
  if (accountIdentityBackendEnabled()) {
    await importStripeIdentitiesForEmail(email);
    const accounts = await findAccountsByEmail(email);
    // Duas contas com o mesmo email não podem receber um reset por escolha
    // implícita; mesmo endereço não prova qual customer é o titular.
    return accounts.length === 1 ? dbAuthRecord(accounts[0]) : null;
  }
  const customers = await customersByEmail(email);
  if (customers.length < 2) return customers[0] ? authRecord(customers[0], email) : null;

  const linked = customers.filter((customer) => customer.metadata?.vc_google_sub);
  if (linked.length === 1) return authRecord(linked[0], email);
  if (linked.length > 1) return null;

  let counts;
  try {
    counts = await Promise.all(customers.map(async (customer) =>
      Number((await getLibrarySyncMeta(customer.id))?.projectCount || 0)));
  } catch {
    return null;
  }
  const withProjects = customers.filter((_, index) => counts[index] > 0);
  if (withProjects.length === 1) return authRecord(withProjects[0], email);
  if (withProjects.length > 1) return null;

  const withPassword = customers.filter((customer) =>
    customer.metadata?.vc_pw_salt && customer.metadata?.vc_pw_hash);
  return withPassword.length === 1 ? authRecord(withPassword[0], email) : null;
}

/** A senha deve conferir no customer exato; e-mail igual não prova que sejam a mesma conta. */
export async function getAuthRecordsMatchingPassword(email, password) {
  if (accountIdentityBackendEnabled()) {
    await importStripeIdentitiesForEmail(email);
    return (await findPasswordCandidatesByEmail(email))
      .filter((record) => record.salt && record.hash && verifyPassword(password, record))
      .map(dbAuthRecord);
  }
  const customers = await customersByEmail(email);
  return customers
    .map((customer) => authRecord(customer, email))
    .filter((record) => record.salt && record.hash && verifyPassword(password, record));
}

export async function setAuthRecord(email, record) {
  const stripe = getStripe();
  const clean = normalizeEmail(email);
  if (accountIdentityBackendEnabled()) {
    let customerId = record.customerId;
    if (!customerId) {
      const created = await stripe.customers.create({
        email: clean, metadata: { product: 'viral-carrossel' },
      });
      customerId = created.id;
    }
    const account = await getOrCreateAccountForStripeCustomer(customerId);
    const saved = await setAccountPassword(customerId, { salt: record.salt, hash: record.hash });
    return {
      email: clean, customerId, accountId: account.id,
      salt: record.salt, hash: record.hash, identityEpoch: saved.identityEpoch,
      updatedAt: Math.floor(Date.now() / 1000),
    };
  }
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
  return Boolean(String(process.env.STRIPE_SECRET_KEY || '').trim())
    && (!accountIdentityBackendEnabled()
      || Boolean(String(process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim()));
}
