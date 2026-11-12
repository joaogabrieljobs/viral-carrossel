import {
  createAgentToken,
  getCurrentAgentSecurityContext,
  revokeSupersededOAuthTokens,
  revokeIssuedAgentToken,
} from '../lib/agent-token-store.js';
import {
  consumeAuthorizationCode,
  createRefreshToken,
  oauthResource,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../lib/oauth-store.js';
import { consumeRateLimit } from '../lib/rate-limit.js';
import { oauthRateLimitResponse } from '../lib/oauth-rate-limit.js';
function body(req) { if (typeof req.body === 'string') return Object.fromEntries(new URLSearchParams(req.body)); return req.body || {}; }

function sameSecurityContext(left, right) {
  return String(left?.agentEpoch || '') === String(right?.agentEpoch || '')
    && String(left?.accountId || '') === String(right?.accountId || '');
}

const OAUTH_REQUEST_ERRORS = new Set([
  'invalid_grant', 'invalid_request', 'invalid_scope', 'invalid_target',
  'invalid_client', 'unsupported_grant_type',
]);

function oauthError(res, cause) {
  if (OAUTH_REQUEST_ERRORS.has(cause?.code)) {
    return res.status(400).json({
      error:cause.code,
      error_description:cause.message || 'Pedido OAuth inválido.',
    });
  }
  console.error('[oauth-token]', cause?.code || 'oauth_token_unavailable');
  return res.status(503).json({
    error:'temporarily_unavailable',
    error_description:'Não foi possível renovar a conexão agora. Tente novamente em instantes.',
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({ error:'invalid_request' });
  const limited = await consumeRateLimit(req,{
    limit:30, windowMs:60_000, keyPrefix:'oauth-token', failClosed:true,
  });
  if (limited) return oauthRateLimitResponse(res, limited);
  const p = body(req);
  try {
    const refreshing = p.grant_type === 'refresh_token';
    let grant;
    if (p.grant_type === 'authorization_code') {
      grant = await consumeAuthorizationCode({ code:p.code, clientId:p.client_id, redirectUri:p.redirect_uri, resource:p.resource, verifier:p.code_verifier });
    } else if (refreshing) {
      grant = await rotateRefreshToken({
        token:p.refresh_token, clientId:p.client_id, resource:p.resource,
        issue:async ({ grant:rotationGrant, tx, identity }) => {
          const client = String(rotationGrant.clientName || 'Assistente').trim().slice(0, 60);
          const oauthLabel = `MCP OAuth — ${client}`;
          const issued = await createAgentToken(rotationGrant.ownerId, {
            label:oauthLabel, scopes:rotationGrant.scopes, expiresInSec:3600,
            oauthClientId:p.client_id,
          }, { connection:tx, identity });
          const refresh = await createRefreshToken({
            clientId:p.client_id, ownerId:rotationGrant.ownerId, scopes:rotationGrant.scopes,
          }, { connection:tx, identity });
          await revokeSupersededOAuthTokens(
            rotationGrant.ownerId, p.client_id, issued.credential.id, { connection:tx },
          );
          return { issued, refresh };
        },
      });
    } else {
      throw Object.assign(new Error('Grant não suportado.'), { code:'unsupported_grant_type' });
    }
    // O refresh traz o snapshot que foi validado antes de consumir a credencial
    // anterior. No authorization_code, capturamos o mesmo contexto agora.
    const securitySnapshot = grant.securitySnapshot
      || await getCurrentAgentSecurityContext(grant.ownerId);
    const client = String(grant.clientName || 'Assistente').trim().slice(0, 60);
    const oauthLabel = `MCP OAuth — ${client}`;
    let issued = grant.issued?.issued || null;
    let refresh = grant.issued?.refresh || '';
    if (refreshing) {
      return res.status(200).json({ access_token:issued.token, token_type:'Bearer', expires_in:3600,
        refresh_token:refresh, scope:grant.scopes.join(' '), resource:oauthResource });
    }
    try {
      issued = await createAgentToken(grant.ownerId,{ label:oauthLabel, scopes:grant.scopes,
        expiresInSec:3600, oauthClientId:p.client_id });
      refresh = await createRefreshToken({ clientId:p.client_id, ownerId:grant.ownerId, scopes:grant.scopes });
      const currentSecurity = await getCurrentAgentSecurityContext(grant.ownerId);
      if (!sameSecurityContext(securitySnapshot, currentSecurity)) {
        await Promise.allSettled([
          revokeIssuedAgentToken(grant.ownerId, issued?.credential?.id),
          revokeRefreshToken({ token:refresh, ownerId:grant.ownerId, revokeFamily:true, clientId:p.client_id }),
        ]);
        throw Object.assign(new Error('Renovação encerrada após uma alteração de segurança.'), {
          code:'invalid_grant', status:400, credentialsCleaned:true,
        });
      }
      await revokeSupersededOAuthTokens(grant.ownerId, p.client_id, issued.credential.id);
    } catch (cause) {
      if (!cause?.credentialsCleaned) {
        await Promise.allSettled([
          issued?.credential?.id
            ? revokeIssuedAgentToken(grant.ownerId, issued.credential.id)
            : Promise.resolve(false),
          refresh
            ? revokeRefreshToken({ token:refresh, ownerId:grant.ownerId })
            : Promise.resolve(false),
        ]);
      }
      throw cause;
    }
    return res.status(200).json({ access_token:issued.token, token_type:'Bearer', expires_in:3600, refresh_token:refresh, scope:grant.scopes.join(' '), resource:oauthResource });
  } catch (cause) { return oauthError(res, cause); }
}
