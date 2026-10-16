/**
 * Migração progressiva da identidade Stripe para uma conta interna do Moont.
 * Nunca escolhe uma conta por email: o vínculo é o customer recuperado da API
 * Stripe; Google usa o sub estável do provedor. Ainda não altera o login legado.
 */
import { getStripe } from './stripe.js';
import { getPostgresConnection } from './postgres-connection.js';
import crypto from 'node:crypto';

const SQL = {
  accountByStripe: `/* identity_account_by_stripe */
    SELECT a.id, a.primary_email, a.identity_epoch, a.agent_epoch, a.session_revoked_before,
      s.stripe_customer_id, s.verified_at
    FROM moont.account_stripe_customers s
    JOIN moont.accounts a ON a.id = s.account_id
    WHERE s.stripe_customer_id = $1`,
  accountByGoogle: `/* identity_account_by_google */
    SELECT a.id, a.primary_email, a.identity_epoch, a.agent_epoch, a.session_revoked_before,
      s.stripe_customer_id, s.verified_at
    FROM moont.account_identities i
    JOIN moont.accounts a ON a.id = i.account_id
    LEFT JOIN moont.account_stripe_customers s ON s.account_id = a.id
    WHERE i.provider = 'google' AND i.provider_subject = $1`,
  passwordCandidates: `/* identity_password_candidates */
    SELECT a.id, a.primary_email, a.identity_epoch, a.agent_epoch, a.session_revoked_before,
      s.stripe_customer_id, c.password_salt, c.password_hash, c.algorithm
    FROM moont.account_identities i
    JOIN moont.accounts a ON a.id = i.account_id
    JOIN moont.account_password_credentials c ON c.account_id = a.id
    LEFT JOIN moont.account_stripe_customers s ON s.account_id = a.id
    WHERE i.provider = 'password' AND i.email_normalized = $1`,
  accountsByEmail: `/* identity_accounts_by_email */
    SELECT a.id, a.primary_email, a.identity_epoch, a.agent_epoch, a.session_revoked_before,
      s.stripe_customer_id, c.password_salt, c.password_hash
    FROM moont.accounts a
    JOIN moont.account_stripe_customers s ON s.account_id = a.id
    LEFT JOIN moont.account_password_credentials c ON c.account_id = a.id
    WHERE a.primary_email = $1 ORDER BY a.created_at, a.id`,
  passwordByStripe: `/* identity_password_by_stripe */
    SELECT a.id, a.primary_email, a.identity_epoch, a.agent_epoch, a.session_revoked_before,
      s.stripe_customer_id, c.password_salt, c.password_hash
    FROM moont.account_stripe_customers s
    JOIN moont.accounts a ON a.id = s.account_id
    LEFT JOIN moont.account_password_credentials c ON c.account_id = a.id
    WHERE s.stripe_customer_id = $1`,
  lockedAccount: `/* identity_locked_account */
    SELECT a.id, a.primary_email, a.identity_epoch, a.agent_epoch, a.session_revoked_before,
      s.stripe_customer_id
    FROM moont.account_stripe_customers s
    JOIN moont.accounts a ON a.id = s.account_id
    WHERE s.stripe_customer_id = $1 FOR UPDATE OF a`,
  lockCustomer: `/* identity_lock_customer */
    SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))`,
  insertAccount: `/* identity_insert_account */
    INSERT INTO moont.accounts
      (primary_email, identity_epoch, agent_epoch, session_revoked_before)
    VALUES ($1, $2, $3, $4)
    RETURNING id`,
  insertStripe: `/* identity_insert_stripe */
    INSERT INTO moont.account_stripe_customers
      (stripe_customer_id, account_id, verified_at)
    VALUES ($1, $2::uuid, now())`,
  insertIdentity: `/* identity_insert_provider */
    INSERT INTO moont.account_identities
      (account_id, provider, provider_subject, email_normalized, migration_source)
    VALUES ($1::uuid, $2, $3, $4, 'stripe_metadata')
    ON CONFLICT (provider, provider_subject) DO NOTHING
    RETURNING account_id`,
  identityOwner: `/* identity_provider_owner */
    SELECT account_id FROM moont.account_identities
    WHERE provider = $1 AND provider_subject = $2`,
  insertCredential: `/* identity_insert_credential */
    INSERT INTO moont.account_password_credentials
      (account_id, password_salt, password_hash)
    VALUES ($1::uuid, $2, $3)`,
  upsertCredential: `/* identity_upsert_credential */
    INSERT INTO moont.account_password_credentials
      (account_id, password_salt, password_hash)
    VALUES ($1::uuid, $2, $3)
    ON CONFLICT (account_id) DO UPDATE
    SET password_salt = EXCLUDED.password_salt,
      password_hash = EXCLUDED.password_hash, updated_at = now()`,
  clearCredential: `/* identity_clear_credential */
    DELETE FROM moont.account_password_credentials WHERE account_id = $1::uuid`,
  clearPasswordIdentity: `/* identity_clear_password_identity */
    DELETE FROM moont.account_identities
    WHERE account_id = $1::uuid AND provider = 'password'`,
  accountGoogleIdentities: `/* identity_account_google_identities */
    SELECT provider_subject FROM moont.account_identities
    WHERE account_id = $1::uuid AND provider = 'google'`,
  updateSecurity: `/* identity_update_security */
    UPDATE moont.accounts
    SET identity_epoch = $2, session_revoked_before = $3,
      agent_epoch = COALESCE($4::text, agent_epoch), updated_at = now()
    WHERE id = $1::uuid`,
};

function fail(message, code) {
  return Object.assign(new Error(message), { code });
}

function customerId(value) {
  const id = String(value || '');
  if (id.length > 255 || !/^cus_[A-Za-z0-9_]+$/.test(id)) {
    throw fail('Cliente Stripe inválido.', 'identity_bad_customer');
  }
  return id;
}

function googleSubject(value) {
  const subject = String(value || '');
  if (!subject || subject.length > 255) {
    throw fail('Identidade Google inválida.', 'identity_bad_google_subject');
  }
  return subject;
}

function normalizedEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length >= 3 && email.length <= 320 ? email : null;
}

function legacyMetadata(customer) {
  const metadata = customer.metadata || {};
  const salt = String(metadata.vc_pw_salt || '');
  const hash = String(metadata.vc_pw_hash || '');
  const googleSub = String(metadata.vc_google_sub || '');
  const identityEpoch = String(metadata.vc_identity_epoch || '');
  const agentEpoch = String(metadata.vc_agent_epoch || '');
  const revokedRaw = String(metadata.vc_session_revoked_before || '0');
  const revokedBefore = Number(revokedRaw);

  if (Boolean(salt) !== Boolean(hash) || salt.length > 500 || hash.length > 500
    || googleSub.length > 255 || identityEpoch.length > 255 || agentEpoch.length > 255
    || !Number.isSafeInteger(revokedBefore) || revokedBefore < 0) {
    throw fail('Metadados de autenticação legados inválidos.', 'identity_invalid_legacy_metadata');
  }
  return { salt, hash, googleSub, identityEpoch, agentEpoch, revokedBefore };
}

function accountFromRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    email: row.primary_email || null,
    stripeCustomerId: row.stripe_customer_id || null,
    identityEpoch: row.identity_epoch || '',
    agentEpoch: row.agent_epoch || '',
    sessionRevokedBefore: Number(row.session_revoked_before || 0),
    stripeVerifiedAt: row.verified_at || null,
  };
}

function passwordRecordFromRow(row) {
  if (!row) return null;
  return {
    ...accountFromRow(row),
    salt: row.password_salt || null,
    hash: row.password_hash || null,
  };
}

export function accountIdentityBackendEnabled() {
  return process.env.ACCOUNT_IDENTITY_BACKEND === 'postgres';
}

async function query(sql, key, params = []) {
  // SQL constante e valores exclusivamente parametrizados.
  return sql.unsafe(SQL[key], params);
}

async function defaultSql() {
  const url = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (!url) throw fail('Banco de identidade não configurado.', 'identity_storage_unconfigured');
  return getPostgresConnection();
}

async function defaultRetrieveCustomer(id) {
  return getStripe().customers.retrieve(id);
}

async function guardStorage(work) {
  try {
    return await work();
  } catch (error) {
    if (typeof error?.code === 'string' && error.code.startsWith('identity_')) throw error;
    if (error?.code === '23505') {
      throw fail('Esta identidade já pertence a outra conta.', 'identity_provider_conflict');
    }
    if (error?.code === '42P01' || error?.code === '3F000') {
      throw fail('Migração SQL de identidade não aplicada.', 'identity_storage_unconfigured');
    }
    throw fail('Banco de identidade temporariamente indisponível.', 'identity_storage_unavailable');
  }
}

/**
 * `retrieveCustomer` deve recuperar o customer exato da API Stripe, no servidor.
 * A factory permite testes sem rede; nunca aceite ID/email de um corpo HTTP como
 * prova de titularidade. O login atual já fornece um customerId autenticado.
 */
export function createAccountIdentityStore({ sql: injectedSql, retrieveCustomer = defaultRetrieveCustomer } = {}) {
  async function connection() { return injectedSql || defaultSql(); }

  async function getAccountByStripeCustomerId(value) {
    const id = customerId(value);
    return guardStorage(async () => {
      const sql = await connection();
      return accountFromRow((await query(sql, 'accountByStripe', [id]))[0]);
    });
  }

  async function getAccountByGoogleSubject(value) {
    const subject = googleSubject(value);
    return guardStorage(async () => {
      const sql = await connection();
      return accountFromRow((await query(sql, 'accountByGoogle', [subject]))[0]);
    });
  }

  /** A busca devolve TODOS os candidatos; mesmo email nunca une duas contas. */
  async function findPasswordCandidatesByEmail(value) {
    const email = normalizedEmail(value);
    if (!email) return [];
    return guardStorage(async () => {
      const sql = await connection();
      const rows = await query(sql, 'passwordCandidates', [email]);
      return rows.map((row) => ({
        ...accountFromRow(row),
        salt: row.password_salt,
        hash: row.password_hash,
        algorithm: row.algorithm,
      }));
    });
  }

  async function findAccountsByEmail(value) {
    const email = normalizedEmail(value);
    if (!email) return [];
    return guardStorage(async () => {
      const sql = await connection();
      return (await query(sql, 'accountsByEmail', [email])).map(passwordRecordFromRow);
    });
  }

  async function getPasswordRecordByStripeCustomerId(value) {
    const id = customerId(value);
    return guardStorage(async () => {
      const sql = await connection();
      return passwordRecordFromRow((await query(sql, 'passwordByStripe', [id]))[0]);
    });
  }

  async function getOrCreateAccountForStripeCustomer(value) {
    const id = customerId(value);
    const existing = await getAccountByStripeCustomerId(id);
    if (existing) return existing;

    let customer;
    try {
      customer = await retrieveCustomer(id);
    } catch (error) {
      if (error?.code === 'resource_missing') {
        throw fail('Cliente Stripe não encontrado.', 'identity_customer_not_found');
      }
      throw fail('Não foi possível verificar o cliente Stripe.', 'identity_stripe_unavailable');
    }
    if (!customer || customer.deleted || customer.id !== id) {
      throw fail('Cliente Stripe não confirmado.', 'identity_customer_not_verified');
    }

    const email = normalizedEmail(customer.email);
    const legacy = legacyMetadata(customer);
    return guardStorage(async () => {
      const sql = await connection();
      return sql.begin(async (tx) => {
        // Evita contas órfãs quando dois logins migram o mesmo customer juntos.
        await query(tx, 'lockCustomer', [id]);
        const current = (await query(tx, 'accountByStripe', [id]))[0];
        if (current) return accountFromRow(current);

        const accountId = (await query(tx, 'insertAccount', [
          email, legacy.identityEpoch, legacy.agentEpoch, legacy.revokedBefore,
        ]))[0].id;
        await query(tx, 'insertStripe', [id, accountId]);

        async function linkProvider(provider, subject) {
          const inserted = await query(tx, 'insertIdentity', [accountId, provider, subject, email]);
          if (inserted.length) return;
          const owner = (await query(tx, 'identityOwner', [provider, subject]))[0];
          if (String(owner?.account_id) !== String(accountId)) {
            throw fail('Esta identidade já pertence a outra conta.', 'identity_provider_conflict');
          }
        }

        if (legacy.salt && legacy.hash) {
          await linkProvider('password', id);
          await query(tx, 'insertCredential', [accountId, legacy.salt, legacy.hash]);
        }
        if (legacy.googleSub) await linkProvider('google', legacy.googleSub);

        return accountFromRow((await query(tx, 'accountByStripe', [id]))[0]);
      });
    });
  }

  async function setAccountPassword(value, { salt, hash, expectedHash, expectedEpoch } = {}) {
    const id = customerId(value);
    if (!salt || !hash || String(salt).length > 500 || String(hash).length > 500) {
      throw fail('Credencial inválida.', 'identity_bad_credential');
    }
    await getOrCreateAccountForStripeCustomer(id);
    return guardStorage(async () => {
      const sql = await connection();
      return sql.begin(async (tx) => {
        const account = (await query(tx, 'lockedAccount', [id]))[0];
        if (!account) throw fail('Conta não encontrada.', 'identity_customer_not_found');
        const current = (await query(tx, 'passwordByStripe', [id]))[0];
        if ((expectedHash !== undefined && String(current?.password_hash || '') !== String(expectedHash || ''))
          || (expectedEpoch !== undefined
            && String(account.identity_epoch || '') !== String(expectedEpoch || ''))) {
          throw fail('A credencial mudou durante a operação.', 'identity_credential_conflict');
        }
        const epoch = crypto.randomBytes(16).toString('hex');
        const agentEpoch = crypto.randomBytes(16).toString('hex');
        const revokedBefore = Date.now();
        await query(tx, 'upsertCredential', [account.id, String(salt), String(hash)]);
        const inserted = await query(tx, 'insertIdentity', [account.id, 'password', id, account.primary_email]);
        if (!inserted.length) {
          const owner = (await query(tx, 'identityOwner', ['password', id]))[0];
          if (String(owner?.account_id) !== String(account.id)) {
            throw fail('Esta identidade já pertence a outra conta.', 'identity_provider_conflict');
          }
        }
        await query(tx, 'updateSecurity', [account.id, epoch, revokedBefore, agentEpoch]);
        return { ...accountFromRow(account), identityEpoch: epoch, agentEpoch, sessionRevokedBefore: revokedBefore };
      });
    });
  }

  /** Chamado apenas depois de validar o callback OAuth Google e seu `sub`. */
  async function linkVerifiedGoogleIdentity(value, { sub, email } = {}) {
    const id = customerId(value);
    const subject = googleSubject(sub);
    const verifiedEmail = normalizedEmail(email);
    if (!verifiedEmail) throw fail('Email Google inválido.', 'identity_bad_google_email');
    await getOrCreateAccountForStripeCustomer(id);
    return guardStorage(async () => {
      const sql = await connection();
      return sql.begin(async (tx) => {
        const account = (await query(tx, 'lockedAccount', [id]))[0];
        if (!account) throw fail('Conta não encontrada.', 'identity_customer_not_found');
        const links = await query(tx, 'accountGoogleIdentities', [account.id]);
        if (links.some((link) => link.provider_subject === subject)) {
          return accountFromRow(account);
        }
        // Um sub diferente não pode reclamar a conta através do mesmo email.
        if (links.length) throw fail('A conta já usa outro Google.', 'identity_provider_conflict');
        const inserted = await query(tx, 'insertIdentity', [account.id, 'google', subject, verifiedEmail]);
        if (!inserted.length) {
          const owner = (await query(tx, 'identityOwner', ['google', subject]))[0];
          if (String(owner?.account_id) !== String(account.id)) {
            throw fail('Esta identidade já pertence a outra conta.', 'identity_provider_conflict');
          }
        }
        // Regra de segurança legada: primeiro vínculo Google revoga a senha
        // existente e todas as sessões, pois a escolha inicial pode usar email.
        await query(tx, 'clearCredential', [account.id]);
        await query(tx, 'clearPasswordIdentity', [account.id]);
        const epoch = crypto.randomBytes(16).toString('hex');
        const agentEpoch = crypto.randomBytes(16).toString('hex');
        const revokedBefore = Date.now();
        await query(tx, 'updateSecurity', [account.id, epoch, revokedBefore, agentEpoch]);
        return { ...accountFromRow(account), identityEpoch: epoch, agentEpoch, sessionRevokedBefore: revokedBefore };
      });
    });
  }

  async function revokeAccountSessions(value) {
    const id = customerId(value);
    await getOrCreateAccountForStripeCustomer(id);
    return guardStorage(async () => {
      const sql = await connection();
      return sql.begin(async (tx) => {
        const account = (await query(tx, 'lockedAccount', [id]))[0];
        if (!account) throw fail('Conta não encontrada.', 'identity_customer_not_found');
        const epoch = crypto.randomBytes(16).toString('hex');
        const revokedBefore = Date.now();
        await query(tx, 'updateSecurity', [account.id, epoch, revokedBefore, null]);
        return { ...accountFromRow(account), identityEpoch: epoch, sessionRevokedBefore: revokedBefore };
      });
    });
  }

  return {
    getAccountByStripeCustomerId,
    getAccountByGoogleSubject,
    findPasswordCandidatesByEmail,
    findAccountsByEmail,
    getPasswordRecordByStripeCustomerId,
    getOrCreateAccountForStripeCustomer,
    setAccountPassword,
    linkVerifiedGoogleIdentity,
    revokeAccountSessions,
  };
}

const defaultStore = createAccountIdentityStore();
export const getAccountByStripeCustomerId = defaultStore.getAccountByStripeCustomerId;
export const getAccountByGoogleSubject = defaultStore.getAccountByGoogleSubject;
export const findPasswordCandidatesByEmail = defaultStore.findPasswordCandidatesByEmail;
export const findAccountsByEmail = defaultStore.findAccountsByEmail;
export const getPasswordRecordByStripeCustomerId = defaultStore.getPasswordRecordByStripeCustomerId;
export const getOrCreateAccountForStripeCustomer = defaultStore.getOrCreateAccountForStripeCustomer;
export const setAccountPassword = defaultStore.setAccountPassword;
export const linkVerifiedGoogleIdentity = defaultStore.linkVerifiedGoogleIdentity;
export const revokeAccountSessions = defaultStore.revokeAccountSessions;
