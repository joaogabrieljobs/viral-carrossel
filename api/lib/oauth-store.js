import { createHash, randomBytes } from 'node:crypto';
import { getPostgresConnection } from './postgres-connection.js';

const RESOURCE = 'https://moont.ai/mcp';
const SCOPES = new Set(['projects:read', 'projects:write']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const secret = prefix => `${prefix}${randomBytes(32).toString('base64url')}`;
export const oauthResource = RESOURCE;

function fail(code, message, status = 400) { throw Object.assign(new Error(message), { code, status }); }
export function normalizeScopes(value) {
  const list = String(value || 'projects:read').split(/\s+/).filter(Boolean);
  if (!list.length || list.some(item => !SCOPES.has(item))) fail('invalid_scope', 'Permissões inválidas.');
  return [...new Set(list)];
}
function redirect(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error();
    return url.toString();
  } catch { fail('invalid_redirect_uri', 'Endereço de retorno inválido.'); }
}

export async function registerOAuthClient(input) {
  const uris = Array.isArray(input?.redirect_uris) ? [...new Set(input.redirect_uris.map(redirect))] : [];
  if (!uris.length || uris.length > 10) fail('invalid_client_metadata', 'Informe os endereços de retorno.');
  const name = String(input?.client_name || 'Cliente MCP').trim().slice(0, 100);
  const rows = await getPostgresConnection().unsafe(
    `INSERT INTO moont.oauth_clients (client_name, redirect_uris) VALUES ($1, $2::text[])
     RETURNING client_id, client_name, redirect_uris`, [name, uris],
  );
  return { client_id: rows[0].client_id, client_name: rows[0].client_name, redirect_uris: rows[0].redirect_uris,
    token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] };
}

export async function validateOAuthRequest({ clientId, redirectUri, resource, scope }) {
  if (!UUID.test(String(clientId || '')) || resource !== RESOURCE) fail('invalid_request', 'Cliente ou recurso inválido.');
  const rows = await getPostgresConnection().unsafe(
    `SELECT client_id, client_name, redirect_uris FROM moont.oauth_clients WHERE client_id = $1::uuid`, [clientId],
  );
  const cleanRedirect = redirect(redirectUri);
  if (!rows[0] || !rows[0].redirect_uris.includes(cleanRedirect)) fail('invalid_request', 'Cliente ou retorno não autorizado.');
  return { client: rows[0], redirectUri: cleanRedirect, scopes: normalizeScopes(scope) };
}

export async function createAuthorizationCode({ clientId, ownerId, redirectUri, scopes, codeChallenge }) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(codeChallenge || ''))) fail('invalid_request', 'PKCE S256 obrigatório.');
  const code = secret('moont_code_');
  await getPostgresConnection().unsafe(
    `INSERT INTO moont.oauth_codes
      (code_hash, client_id, owner_id, redirect_uri, resource, scopes, code_challenge, expires_at)
     VALUES ($1, $2::uuid, $3, $4, $5, $6::text[], $7, now() + interval '5 minutes')`,
    [hash(code), clientId, ownerId, redirectUri, RESOURCE, scopes, codeChallenge],
  );
  return code;
}

export async function consumeAuthorizationCode({ code, clientId, redirectUri, resource, verifier }) {
  if (!UUID.test(String(clientId || '')) || resource !== RESOURCE || !/^[A-Za-z0-9._~-]{43,128}$/.test(String(verifier || ''))) fail('invalid_grant', 'Código inválido.');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return getPostgresConnection().begin(async tx => {
    const rows = await tx.unsafe(
      `SELECT * FROM moont.oauth_codes WHERE code_hash = $1 FOR UPDATE`, [hash(code)],
    );
    const row = rows[0];
    if (!row || row.used_at || Date.parse(row.expires_at) <= Date.now() || row.client_id !== clientId
      || row.redirect_uri !== redirect(redirectUri) || row.resource !== RESOURCE || row.code_challenge !== challenge) {
      fail('invalid_grant', 'Código inválido ou expirado.');
    }
    await tx.unsafe(`UPDATE moont.oauth_codes SET used_at = now() WHERE code_hash = $1`, [hash(code)]);
    return { ownerId: row.owner_id, scopes: row.scopes };
  });
}

export async function createRefreshToken({ clientId, ownerId, scopes }) {
  const token = secret('moont_refresh_');
  await getPostgresConnection().unsafe(
    `INSERT INTO moont.oauth_refresh_tokens
      (token_hash, client_id, owner_id, resource, scopes, expires_at)
     VALUES ($1, $2::uuid, $3, $4, $5::text[], now() + interval '30 days')`,
    [hash(token), clientId, ownerId, RESOURCE, scopes],
  );
  return token;
}

export async function rotateRefreshToken({ token, clientId, resource }) {
  if (!UUID.test(String(clientId || '')) || resource !== RESOURCE) fail('invalid_grant', 'Renovação inválida.');
  return getPostgresConnection().begin(async tx => {
    const rows = await tx.unsafe(`SELECT * FROM moont.oauth_refresh_tokens WHERE token_hash = $1 FOR UPDATE`, [hash(token)]);
    const row = rows[0];
    if (!row || row.client_id !== clientId || row.resource !== RESOURCE || row.revoked_at || Date.parse(row.expires_at) <= Date.now()) fail('invalid_grant', 'Renovação inválida ou expirada.');
    await tx.unsafe(`UPDATE moont.oauth_refresh_tokens SET revoked_at = now() WHERE token_hash = $1`, [hash(token)]);
    return { ownerId: row.owner_id, scopes: row.scopes };
  });
}
