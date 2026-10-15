import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createAccountIdentityStore } from '../../api/lib/account-identity-postgres.js';
import { hashPassword, verifyPassword } from '../../api/lib/password-auth.js';

function fakeDatabase() {
  let state = {
    accounts: new Map(),
    stripe: new Map(),
    identities: new Map(),
    credentials: new Map(),
    nextId: 1,
  };
  let tail = Promise.resolve();

  function accountRow(customerId) {
    const link = state.stripe.get(customerId);
    if (!link) return [];
    const account = state.accounts.get(link.account_id);
    return [{ ...account, stripe_customer_id: customerId, verified_at: link.verified_at }];
  }

  const sql = {
    async unsafe(statement, params) {
      const marker = statement.match(/\/\* (identity_[a-z_]+) \*\//)?.[1];
      switch (marker) {
        case 'identity_account_by_stripe':
          return accountRow(params[0]);
        case 'identity_account_by_google': {
          const identity = state.identities.get(`google:${params[0]}`);
          if (!identity) return [];
          const link = [...state.stripe.entries()].find(([, value]) =>
            value.account_id === identity.account_id);
          return [{ ...state.accounts.get(identity.account_id),
            stripe_customer_id: link?.[0] || null,
            verified_at: link?.[1]?.verified_at || null }];
        }
        case 'identity_password_candidates':
          return [...state.identities.values()]
            .filter((identity) => identity.provider === 'password'
              && identity.email_normalized === params[0])
            .map((identity) => {
              const account = state.accounts.get(identity.account_id);
              const credential = state.credentials.get(identity.account_id);
              const link = [...state.stripe.entries()].find(([, value]) =>
                value.account_id === identity.account_id);
              return { ...account, stripe_customer_id: link?.[0] || null,
                password_salt: credential.password_salt,
                password_hash: credential.password_hash,
                algorithm: 'scrypt-n16384-r8-p1-key64' };
            });
        case 'identity_accounts_by_email':
          return [...state.accounts.values()]
            .filter((account) => account.primary_email === params[0])
            .map((account) => {
              const link = [...state.stripe.entries()].find(([, value]) =>
                value.account_id === account.id);
              const credential = state.credentials.get(account.id);
              return { ...account, stripe_customer_id: link?.[0] || null,
                password_salt: credential?.password_salt || null,
                password_hash: credential?.password_hash || null };
            });
        case 'identity_password_by_stripe': {
          const [account] = accountRow(params[0]);
          if (!account) return [];
          const credential = state.credentials.get(account.id);
          return [{ ...account, password_salt: credential?.password_salt || null,
            password_hash: credential?.password_hash || null }];
        }
        case 'identity_locked_account':
          return accountRow(params[0]);
        case 'identity_lock_customer':
          return [];
        case 'identity_insert_account': {
          const id = `00000000-0000-4000-8000-${String(state.nextId++).padStart(12, '0')}`;
          state.accounts.set(id, {
            id, primary_email: params[0], identity_epoch: params[1],
            session_revoked_before: params[2],
          });
          return [{ id }];
        }
        case 'identity_insert_stripe':
          if (state.stripe.has(params[0])) throw Object.assign(new Error('duplicate'), { code: '23505' });
          state.stripe.set(params[0], { account_id: params[1], verified_at: '2026-10-15T00:00:00Z' });
          return [];
        case 'identity_insert_provider': {
          const key = `${params[1]}:${params[2]}`;
          if (state.identities.has(key)) return [];
          state.identities.set(key, {
            account_id: params[0], provider: params[1], provider_subject: params[2],
            email_normalized: params[3],
          });
          return [{ account_id: params[0] }];
        }
        case 'identity_provider_owner': {
          const identity = state.identities.get(`${params[0]}:${params[1]}`);
          return identity ? [{ account_id: identity.account_id }] : [];
        }
        case 'identity_insert_credential':
          state.credentials.set(params[0], {
            password_salt: params[1], password_hash: params[2],
          });
          return [];
        case 'identity_upsert_credential':
          state.credentials.set(params[0], {
            password_salt: params[1], password_hash: params[2],
          });
          return [];
        case 'identity_clear_credential':
          state.credentials.delete(params[0]);
          return [];
        case 'identity_clear_password_identity':
          for (const [key, identity] of state.identities) {
            if (identity.account_id === params[0] && identity.provider === 'password') {
              state.identities.delete(key);
            }
          }
          return [];
        case 'identity_account_google_identities':
          return [...state.identities.values()]
            .filter((identity) => identity.account_id === params[0] && identity.provider === 'google')
            .map((identity) => ({ provider_subject: identity.provider_subject }));
        case 'identity_update_security': {
          const account = state.accounts.get(params[0]);
          state.accounts.set(params[0], {
            ...account, identity_epoch: params[1], session_revoked_before: params[2],
          });
          return [];
        }
        default:
          throw new Error(`SQL não simulado: ${marker}`);
      }
    },
    async begin(callback) {
      let release;
      const completed = new Promise((resolve) => { release = resolve; });
      const previous = tail;
      tail = completed;
      await previous;
      const before = structuredClone(state);
      try { return await callback(sql); }
      catch (error) { state = before; throw error; }
      finally { release(); }
    },
  };

  return { sql, snapshot: () => structuredClone(state) };
}

function makeStore(customers) {
  const database = fakeDatabase();
  const retrieveCustomer = vi.fn(async (id) => customers.get(id) || null);
  return {
    store: createAccountIdentityStore({ sql: database.sql, retrieveCustomer }),
    retrieveCustomer,
    snapshot: database.snapshot,
  };
}

describe('account-identity-postgres', () => {
  it('migra scrypt e epoch do customer Stripe exato sem usar email como ID', async () => {
    const secret = hashPassword('SenhaSegura123');
    const customers = new Map([['cus_janine', {
      id: 'cus_janine', email: ' JANINE@EXAMPLE.COM ', metadata: {
        vc_pw_salt: secret.salt, vc_pw_hash: secret.hash,
        vc_identity_epoch: 'abc123', vc_session_revoked_before: '1792000000000',
        vc_google_sub: 'google-janine',
      },
    }]]);
    const { store } = makeStore(customers);

    const account = await store.getOrCreateAccountForStripeCustomer('cus_janine');
    expect(account.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(account.email).toBe('janine@example.com');
    expect(account.stripeCustomerId).toBe('cus_janine');
    expect(account.identityEpoch).toBe('abc123');
    expect(account.sessionRevokedBefore).toBe(1792000000000);
    expect((await store.getAccountByGoogleSubject('google-janine')).id).toBe(account.id);
    const [candidate] = await store.findPasswordCandidatesByEmail(' JANINE@EXAMPLE.COM ');
    expect(candidate.id).toBe(account.id);
    expect(candidate.salt).toBe(secret.salt);
    expect(candidate.hash).toBe(secret.hash);
    expect(verifyPassword('SenhaSegura123', candidate)).toBe(true);
  });

  it('clientes Stripe com o mesmo email continuam contas distintas', async () => {
    const first = hashPassword('SegredoA123');
    const second = hashPassword('SegredoB123');
    const customers = new Map([
      ['cus_a', { id: 'cus_a', email: 'pessoa@example.com', metadata: {
        vc_pw_salt: first.salt, vc_pw_hash: first.hash,
      } }],
      ['cus_b', { id: 'cus_b', email: 'pessoa@example.com', metadata: {
        vc_pw_salt: second.salt, vc_pw_hash: second.hash,
      } }],
    ]);
    const { store, snapshot } = makeStore(customers);
    const accountA = await store.getOrCreateAccountForStripeCustomer('cus_a');
    const accountB = await store.getOrCreateAccountForStripeCustomer('cus_b');
    expect(accountA.id).not.toBe(accountB.id);
    const candidates = await store.findPasswordCandidatesByEmail('pessoa@example.com');
    expect(candidates).toHaveLength(2);
    expect(candidates.filter((candidate) => verifyPassword('SegredoA123', candidate)))
      .toMatchObject([{ stripeCustomerId: 'cus_a' }]);
    expect(snapshot().accounts.size).toBe(2);
  });

  it('migração concorrente do mesmo customer cria só uma conta', async () => {
    const customers = new Map([['cus_a', {
      id: 'cus_a', email: 'pessoa@example.com', metadata: {},
    }]]);
    const { store, snapshot } = makeStore(customers);
    const [left, right] = await Promise.all([
      store.getOrCreateAccountForStripeCustomer('cus_a'),
      store.getOrCreateAccountForStripeCustomer('cus_a'),
    ]);
    expect(left.id).toBe(right.id);
    expect(snapshot().accounts.size).toBe(1);
    expect(snapshot().stripe.size).toBe(1);
  });

  it('rejeita o mesmo Google sub em outro customer sem unir ou deixar conta órfã', async () => {
    const customers = new Map([
      ['cus_a', { id: 'cus_a', email: 'a@example.com', metadata: { vc_google_sub: 'same-sub' } }],
      ['cus_b', { id: 'cus_b', email: 'b@example.com', metadata: { vc_google_sub: 'same-sub' } }],
    ]);
    const { store, snapshot } = makeStore(customers);
    const first = await store.getOrCreateAccountForStripeCustomer('cus_a');
    await expect(store.getOrCreateAccountForStripeCustomer('cus_b'))
      .rejects.toMatchObject({ code: 'identity_provider_conflict' });
    expect(snapshot().accounts.size).toBe(1);
    expect(await store.getAccountByStripeCustomerId('cus_b')).toBeNull();
    expect((await store.getAccountByGoogleSubject('same-sub')).id).toBe(first.id);
  });

  it('corrida entre customers com o mesmo Google sub termina com um único dono', async () => {
    const customers = new Map([
      ['cus_a', { id: 'cus_a', email: 'a@example.com', metadata: { vc_google_sub: 'shared' } }],
      ['cus_b', { id: 'cus_b', email: 'b@example.com', metadata: { vc_google_sub: 'shared' } }],
    ]);
    const { store, snapshot } = makeStore(customers);
    const results = await Promise.allSettled([
      store.getOrCreateAccountForStripeCustomer('cus_a'),
      store.getOrCreateAccountForStripeCustomer('cus_b'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected'))
      .toMatchObject([{ reason: { code: 'identity_provider_conflict' } }]);
    expect(snapshot().accounts.size).toBe(1);
    const account = await store.getAccountByGoogleSubject('shared');
    expect(account.id).toBe(results.find((result) => result.status === 'fulfilled').value.id);
  });

  it('repetir a migração preserva hash e epoch já copiados', async () => {
    const original = hashPassword('SenhaOriginal1');
    const customer = { id: 'cus_a', email: 'a@example.com', metadata: {
      vc_pw_salt: original.salt, vc_pw_hash: original.hash, vc_identity_epoch: 'old',
    } };
    const { store, snapshot, retrieveCustomer } = makeStore(new Map([['cus_a', customer]]));
    const first = await store.getOrCreateAccountForStripeCustomer('cus_a');
    customer.metadata = { vc_identity_epoch: 'different' };
    const second = await store.getOrCreateAccountForStripeCustomer('cus_a');
    expect(second).toEqual(first);
    expect(snapshot().credentials.get(first.id).password_hash).toBe(original.hash);
    expect(retrieveCustomer).toHaveBeenCalledTimes(1);
  });

  it('troca de senha usa CAS e revoga as sessões anteriores', async () => {
    const original = hashPassword('SenhaOriginal1');
    const next = hashPassword('SenhaNovaForte2');
    const customers = new Map([['cus_a', { id: 'cus_a', email: 'a@example.com', metadata: {
      vc_pw_salt: original.salt, vc_pw_hash: original.hash, vc_identity_epoch: 'before',
    } }]]);
    const { store } = makeStore(customers);
    const before = await store.getOrCreateAccountForStripeCustomer('cus_a');
    const changed = await store.setAccountPassword('cus_a', {
      ...next, expectedHash: original.hash, expectedEpoch: 'before',
    });
    expect(changed.identityEpoch).not.toBe(before.identityEpoch);
    expect(changed.sessionRevokedBefore).toBeGreaterThan(0);
    const record = await store.getPasswordRecordByStripeCustomerId('cus_a');
    expect(verifyPassword('SenhaNovaForte2', record)).toBe(true);
    await expect(store.setAccountPassword('cus_a', {
      ...next, expectedHash: original.hash, expectedEpoch: 'before',
    })).rejects.toMatchObject({ code: 'identity_credential_conflict' });
  });

  it('primeiro vínculo Google confirmado remove a senha antiga e revoga sessões', async () => {
    const secret = hashPassword('SenhaOriginal1');
    const customers = new Map([['cus_a', { id: 'cus_a', email: 'a@example.com', metadata: {
      vc_pw_salt: secret.salt, vc_pw_hash: secret.hash,
    } }]]);
    const { store } = makeStore(customers);
    const before = await store.getOrCreateAccountForStripeCustomer('cus_a');
    const linked = await store.linkVerifiedGoogleIdentity('cus_a', {
      sub: 'google-1', email: 'a@example.com',
    });
    expect(linked.identityEpoch).not.toBe(before.identityEpoch);
    expect(await store.findPasswordCandidatesByEmail('a@example.com')).toEqual([]);
    expect((await store.getAccountByGoogleSubject('google-1')).id).toBe(before.id);
    await expect(store.linkVerifiedGoogleIdentity('cus_a', {
      sub: 'google-2', email: 'a@example.com',
    })).rejects.toMatchObject({ code: 'identity_provider_conflict' });
  });

  it('logout revoga uma conta sem tocar nas credenciais', async () => {
    const secret = hashPassword('SenhaOriginal1');
    const customers = new Map([['cus_a', { id: 'cus_a', email: 'a@example.com', metadata: {
      vc_pw_salt: secret.salt, vc_pw_hash: secret.hash,
    } }]]);
    const { store } = makeStore(customers);
    const before = await store.getOrCreateAccountForStripeCustomer('cus_a');
    const after = await store.revokeAccountSessions('cus_a');
    expect(after.identityEpoch).not.toBe(before.identityEpoch);
    expect(after.sessionRevokedBefore).toBeGreaterThan(0);
    expect((await store.getPasswordRecordByStripeCustomerId('cus_a')).hash).toBe(secret.hash);
  });

  it('não cria vínculo com customer Stripe ausente ou não confirmado', async () => {
    const customers = new Map([['cus_bad', {
      id: 'cus_other', email: 'x@example.com', metadata: {},
    }]]);
    const { store, snapshot } = makeStore(customers);
    await expect(store.getOrCreateAccountForStripeCustomer('cus_missing'))
      .rejects.toMatchObject({ code: 'identity_customer_not_verified' });
    await expect(store.getOrCreateAccountForStripeCustomer('cus_bad'))
      .rejects.toMatchObject({ code: 'identity_customer_not_verified' });
    expect(snapshot().accounts.size).toBe(0);
  });

  it('schema garante vínculos únicos por ID e permite emails repetidos', () => {
    const ddl = readFileSync(new URL('../../db/migrations/003_accounts.sql', import.meta.url), 'utf8');
    expect(ddl).toMatch(/id uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
    expect(ddl).toMatch(/stripe_customer_id text PRIMARY KEY/);
    expect(ddl).toMatch(/account_id uuid NOT NULL UNIQUE REFERENCES moont\.accounts/);
    expect(ddl).toMatch(/UNIQUE \(provider, provider_subject\)/);
    expect(ddl).not.toMatch(/UNIQUE\s*\(primary_email\)|UNIQUE\s*\(email_normalized\)/);
  });
});
