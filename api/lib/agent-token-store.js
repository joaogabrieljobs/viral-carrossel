/** Credenciais pessoais para o MCP local. O banco guarda só um hash do segredo. */
import { createHash, randomBytes } from 'node:crypto';
import { billingDisabled } from './access.js';
import {
  accountIdentityBackendEnabled,
  getOrCreateAccountForStripeCustomer,
} from './account-identity-postgres.js';
import { getPostgresConnection } from './postgres-connection.js';
import { findActiveSubscription, getStripe } from './stripe.js';

const TOKEN_PREFIX = 'moont_pat_';
const TOKEN_PATTERN = /^moont_pat_[A-Za-z0-9_-]{43}$/;
const OWNER_PATTERN = /^[A-Za-z0-9_.-]{1,80}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_SCOPES = new Set(['projects:read', 'projects:write']);

export class AgentTokenError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AgentTokenError';
    this.status = status;
    this.code = code;
  }
}

function fail(status, code, message) {
  throw new AgentTokenError(status, code, message);
}

const subscriptionCache = new Map();
const SUBSCRIPTION_CACHE_MS = 45_000;

export function clearAgentSubscriptionCache() {
  subscriptionCache.clear();
}

async function cachedActiveSubscription(ownerId) {
  const hit = subscriptionCache.get(ownerId);
  if (hit && hit.until > Date.now()) return hit.active;
  const active = await findActiveSubscription(ownerId);
  subscriptionCache.set(ownerId, { active: Boolean(active), until: Date.now() + SUBSCRIPTION_CACHE_MS });
  if (subscriptionCache.size > 500) {
    const now = Date.now();
    for (const [key, value] of subscriptionCache) {
      if (value.until <= now) subscriptionCache.delete(key);
    }
  }
  return Boolean(active);
}

function validateOwner(ownerId) {
  if (typeof ownerId !== 'string' || !OWNER_PATTERN.test(ownerId)) {
    fail(401, 'agent_account_missing', 'Conta não identificada. Entre novamente.');
  }
  return ownerId;
}

function normalizeScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length < 1 || scopes.length > 2
    || scopes.some((scope) => !VALID_SCOPES.has(scope))) {
    fail(400, 'agent_scopes_invalid', 'Permissões inválidas para a integração.');
  }
  return [...new Set(scopes)];
}

function normalizeLabel(label) {
  const clean = String(label ?? 'Codex').trim();
  if (!clean || clean.length > 80 || /[\u0000-\u001f\u007f]/.test(clean)) {
    fail(400, 'agent_label_invalid', 'Nome inválido para a integração.');
  }
  return clean;
}

function hashToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

async function currentAgentIdentity(ownerId) {
  if (billingDisabled()) return { agentEpoch: '', accountId: null };
  if (!/^cus_[A-Za-z0-9_]+$/.test(ownerId)) {
    fail(401, 'agent_account_invalid', 'Conta da integração inválida.');
  }
  if (accountIdentityBackendEnabled()) {
    let account;
    try { account = await getOrCreateAccountForStripeCustomer(ownerId); }
    catch (cause) {
      if (['identity_customer_not_found', 'identity_customer_not_verified', 'identity_bad_customer']
        .includes(cause?.code)) fail(401, 'agent_account_invalid', 'Conta da integração inválida.');
      fail(503, 'agent_identity_unavailable', 'Não foi possível verificar a conta agora.');
    }
    if (!account?.id || !UUID_PATTERN.test(account.id)) {
      fail(401, 'agent_account_invalid', 'Conta da integração inválida.');
    }
    return { agentEpoch: String(account.agentEpoch || ''), accountId: account.id };
  }
  let customer;
  try { customer = await getStripe().customers.retrieve(ownerId); }
  catch (cause) {
    if (cause?.code === 'resource_missing') fail(401, 'agent_account_invalid', 'Conta da integração inválida.');
    fail(503, 'agent_identity_unavailable', 'Não foi possível verificar a conta agora.');
  }
  if (!customer || customer.deleted || customer.id !== ownerId) {
    fail(401, 'agent_account_invalid', 'Conta da integração inválida.');
  }
  const agentEpoch = String(customer.metadata?.vc_agent_epoch || '');
  if (agentEpoch.length > 255) fail(401, 'agent_account_invalid', 'Conta da integração inválida.');
  return { agentEpoch, accountId: null };
}

function publicRow(row, identity = null) {
  return {
    id: row.id,
    label: row.label,
    scopes: row.scopes,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    invalidated: identity
      ? String(row.agent_epoch || '') !== identity.agentEpoch
        || Boolean(row.account_id && String(row.account_id) !== identity.accountId)
      : false,
  };
}

/** Cria um segredo aleatório de 256 bits; devolve-o uma única vez. */
export async function createAgentToken(ownerId, { label = 'Codex', scopes = ['projects:read', 'projects:write'] } = {}) {
  const owner = validateOwner(ownerId);
  const cleanLabel = normalizeLabel(label);
  const cleanScopes = normalizeScopes(scopes);
  const identity = await currentAgentIdentity(owner);
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  const rows = await getPostgresConnection().unsafe(
    `INSERT INTO moont.agent_tokens
       (owner_id, agent_epoch, account_id, token_hash, label, scopes, expires_at)
     VALUES ($1, $2, $3::uuid, $4, $5, $6::text[], now() + interval '90 days')
     RETURNING id, label, scopes, agent_epoch, account_id, created_at, expires_at, revoked_at`,
    [owner, identity.agentEpoch, identity.accountId, hashToken(token), cleanLabel, cleanScopes],
  );
  return { token, credential: publicRow(rows[0], identity) };
}

export async function listAgentTokens(ownerId) {
  const owner = validateOwner(ownerId);
  const identity = await currentAgentIdentity(owner);
  const rows = await getPostgresConnection().unsafe(
    `SELECT id, label, scopes, agent_epoch, account_id, created_at, expires_at, revoked_at
     FROM moont.agent_tokens WHERE owner_id = $1 ORDER BY created_at DESC`,
    [owner],
  );
  return rows.map((row) => publicRow(row, identity));
}

export async function revokeAgentToken(ownerId, tokenId) {
  const owner = validateOwner(ownerId);
  if (typeof tokenId !== 'string' || !UUID_PATTERN.test(tokenId)) {
    fail(400, 'agent_token_id_invalid', 'Identificador de integração inválido.');
  }
  const rows = await getPostgresConnection().unsafe(
    `UPDATE moont.agent_tokens SET revoked_at = now()
     WHERE owner_id = $1 AND id = $2::uuid AND revoked_at IS NULL
     RETURNING id, label, scopes, created_at, expires_at, revoked_at`,
    [owner, tokenId],
  );
  if (!rows[0]) fail(404, 'agent_token_not_found', 'Integração não encontrada nesta conta.');
  return publicRow(rows[0]);
}

/**
 * Autentica a API usada pelo plugin local. Cada requisição consulta o banco,
 * portanto revogação e vencimento valem imediatamente, inclusive em outras
 * instâncias do servidor.
 * @returns {Promise<{ownerId: string, tokenId: string, scopes: string[]}>}
 */
export async function authenticateAgentRequest(req, { scope } = {}) {
  if (!VALID_SCOPES.has(scope)) {
    throw new TypeError('Permissão obrigatória e conhecida para autenticar o agente.');
  }
  const header = req?.headers?.authorization ?? req?.headers?.Authorization;
  if (typeof header !== 'string') {
    fail(401, 'agent_token_missing', 'Conecte sua conta Moont ao Codex.');
  }
  const match = /^Bearer (\S+)$/i.exec(header);
  const token = match?.[1];
  if (!token || !TOKEN_PATTERN.test(token)) {
    fail(401, 'agent_token_invalid', 'Credencial de integração inválida.');
  }

  let rows;
  try {
    rows = await getPostgresConnection().unsafe(
      `SELECT id, owner_id, agent_epoch, account_id, scopes FROM moont.agent_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
       LIMIT 1`,
      [hashToken(token)],
    );
  } catch {
    fail(503, 'agent_token_storage_unavailable', 'Não foi possível verificar a integração agora.');
  }
  const row = rows[0];
  if (!row) fail(401, 'agent_token_invalid', 'Integração inválida, vencida ou revogada. Crie outra chave em Perfil → Integração Codex.');
  if (!Array.isArray(row.scopes) || !row.scopes.includes(scope)) {
    fail(403, 'agent_scope_denied', 'Esta integração não permite essa operação.');
  }

  // Recuperação de senha/troca de provedor muda agent_epoch. Logout comum
  // muda apenas identity_epoch e mantém a integração pareada.
  if (!billingDisabled()) {
    const identity = await currentAgentIdentity(row.owner_id);
    if (String(row.agent_epoch || '') !== identity.agentEpoch
      || (row.account_id && String(row.account_id) !== identity.accountId)) {
      fail(401, 'agent_token_revoked_by_recovery', 'Esta integração foi encerrada após uma alteração de segurança na conta.');
    }
    let active;
    try { active = await cachedActiveSubscription(row.owner_id); }
    catch { fail(503, 'agent_subscription_unavailable', 'Não foi possível verificar a assinatura agora.'); }
    if (!active) fail(402, 'agent_subscription_inactive', 'Assinatura inativa.');
  }

  return { ownerId: row.owner_id, tokenId: row.id, scopes: [...row.scopes] };
}
