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

export async function getCurrentAgentSecurityContext(ownerId) {
  if (billingDisabled()) return { agentEpoch: '', accountId: null, sessionRevokedBefore: 0 };
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
    return {
      agentEpoch: String(account.agentEpoch || ''),
      accountId: account.id,
      sessionRevokedBefore: Number(account.sessionRevokedBefore || 0),
    };
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
  const sessionRevokedBefore = Number(customer.metadata?.vc_session_revoked_before || 0);
  if (!Number.isSafeInteger(sessionRevokedBefore) || sessionRevokedBefore < 0) {
    fail(401, 'agent_account_invalid', 'Conta da integração inválida.');
  }
  return { agentEpoch, accountId: null, sessionRevokedBefore };
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
export async function createAgentToken(ownerId, {
  label = 'Codex', scopes = ['projects:read', 'projects:write'],
  expiresInSec = 90 * 86400, oauthClientId = null,
} = {}, { connection = null, identity: knownIdentity = null } = {}) {
  const owner = validateOwner(ownerId);
  const cleanLabel = normalizeLabel(label);
  const cleanScopes = normalizeScopes(scopes);
  if (oauthClientId != null && !UUID_PATTERN.test(String(oauthClientId))) {
    fail(400, 'agent_oauth_client_invalid', 'Cliente OAuth inválido.');
  }
  const identity = knownIdentity || await getCurrentAgentSecurityContext(owner);
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  if (!Number.isSafeInteger(expiresInSec) || expiresInSec < 300 || expiresInSec > 90 * 86400) {
    fail(400, 'agent_expiry_invalid', 'Validade inválida para a integração.');
  }
  const sql = connection || getPostgresConnection();
  const rows = await sql.unsafe(
    `INSERT INTO moont.agent_tokens
       (owner_id, agent_epoch, account_id, token_hash, label, scopes, expires_at, oauth_client_id)
     VALUES ($1, $2, $3::uuid, $4, $5, $6::text[], now() + ($7 * interval '1 second'), $8::uuid)
     RETURNING id, label, scopes, agent_epoch, account_id, oauth_client_id,
       created_at, expires_at, revoked_at`,
    [owner, identity.agentEpoch, identity.accountId, hashToken(token), cleanLabel,
      cleanScopes, expiresInSec, oauthClientId],
  );
  return { token, credential: publicRow(rows[0], identity) };
}

export async function listAgentTokens(ownerId) {
  const owner = validateOwner(ownerId);
  const identity = await getCurrentAgentSecurityContext(owner);
  const rows = await getPostgresConnection().unsafe(
    `WITH ranked AS (
       SELECT id, label, scopes, agent_epoch, account_id, oauth_client_id,
         created_at, expires_at, revoked_at,
         CASE WHEN oauth_client_id IS NOT NULL
           THEN row_number() OVER (
             PARTITION BY oauth_client_id
             ORDER BY (revoked_at IS NULL AND expires_at > now()) DESC, created_at DESC
           )
           ELSE 1
         END AS oauth_rank
       FROM moont.agent_tokens
       WHERE owner_id = $1
         AND expires_at > now() - interval '7 days'
         AND (revoked_at IS NULL OR revoked_at > now() - interval '7 days')
     )
     SELECT id, label, scopes, agent_epoch, account_id, oauth_client_id,
       created_at, expires_at, revoked_at
     FROM ranked
     WHERE oauth_rank = 1
     ORDER BY (revoked_at IS NULL AND expires_at > now()) DESC, created_at DESC
     LIMIT 100`,
    [owner],
  );
  return rows.map((row) => publicRow(row, identity));
}

/** Mantém só a credencial OAuth recém-emitida para a mesma conexão. */
export async function revokeSupersededOAuthTokens(ownerId, oauthClientId, exceptTokenId, { connection = null } = {}) {
  const owner = validateOwner(ownerId);
  if (!UUID_PATTERN.test(String(oauthClientId || ''))) fail(400, 'agent_oauth_client_invalid', 'Cliente OAuth inválido.');
  if (typeof exceptTokenId !== 'string' || !UUID_PATTERN.test(exceptTokenId)) {
    fail(400, 'agent_token_id_invalid', 'Identificador de integração inválido.');
  }
  const sql = connection || getPostgresConnection();
  const rows = await sql.unsafe(
    `UPDATE moont.agent_tokens SET revoked_at = now()
     WHERE owner_id = $1 AND oauth_client_id = $2::uuid AND id <> $3::uuid
       AND revoked_at IS NULL
     RETURNING id`,
    [owner, oauthClientId, exceptTokenId],
  );
  return rows.length;
}

/** Executada pelo cron diário: remove apenas credenciais sem validade há 7 dias. */
export async function cleanupExpiredAgentTokens({ retentionDays = 7 } = {}) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 90) {
    throw new TypeError('Retenção de tokens inválida.');
  }
  const rows = await getPostgresConnection().unsafe(
    `DELETE FROM moont.agent_tokens
     WHERE expires_at < now() - ($1 * interval '1 day')
       OR (revoked_at IS NOT NULL AND revoked_at < now() - ($1 * interval '1 day'))
     RETURNING id`,
    [retentionDays],
  );
  return { deleted: rows.length };
}

export async function revokeAgentToken(ownerId, tokenId) {
  const owner = validateOwner(ownerId);
  if (typeof tokenId !== 'string' || !UUID_PATTERN.test(tokenId)) {
    fail(400, 'agent_token_id_invalid', 'Identificador de integração inválido.');
  }
  return getPostgresConnection().begin(async tx => {
    const rows = await tx.unsafe(
      `UPDATE moont.agent_tokens SET revoked_at = now()
       WHERE owner_id = $1 AND id = $2::uuid AND revoked_at IS NULL
       RETURNING id, label, scopes, oauth_client_id, created_at, expires_at, revoked_at`,
      [owner, tokenId],
    );
    if (!rows[0]) fail(404, 'agent_token_not_found', 'Integração não encontrada nesta conta.');
    if (rows[0].oauth_client_id) {
      await tx.unsafe(
        `UPDATE moont.oauth_refresh_tokens SET revoked_at = now()
         WHERE owner_id = $1 AND client_id = $2::uuid AND revoked_at IS NULL`,
        [owner, rows[0].oauth_client_id],
      );
    }
    return publicRow(rows[0]);
  });
}

/**
 * Limpeza compensatória para um token que ainda não foi entregue ao cliente.
 * Diferente da revogação solicitada pelo utilizador, não encerra a família
 * OAuth inteira: isso permite desfazer uma emissão parcial sem derrubar outras
 * integrações válidas da conta.
 */
export async function revokeIssuedAgentToken(ownerId, tokenId) {
  const owner = validateOwner(ownerId);
  if (typeof tokenId !== 'string' || !UUID_PATTERN.test(tokenId)) return false;
  const rows = await getPostgresConnection().unsafe(
    `UPDATE moont.agent_tokens SET revoked_at = now()
     WHERE owner_id = $1 AND id = $2::uuid AND revoked_at IS NULL
     RETURNING id`,
    [owner, tokenId],
  );
  return Boolean(rows[0]);
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
    const identity = await getCurrentAgentSecurityContext(row.owner_id);
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
