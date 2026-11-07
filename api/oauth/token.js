import {
  createAgentToken,
  getCurrentAgentSecurityContext,
  revokeIssuedAgentToken,
} from '../lib/agent-token-store.js';
import {
  consumeAuthorizationCode,
  createRefreshToken,
  oauthResource,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../lib/oauth-store.js';
import { consumeRateLimit, rateLimitResponse } from '../lib/rate-limit.js';
function body(req) { if (typeof req.body === 'string') return Object.fromEntries(new URLSearchParams(req.body)); return req.body || {}; }

function sameSecurityContext(left, right) {
  return String(left?.agentEpoch || '') === String(right?.agentEpoch || '')
    && String(left?.accountId || '') === String(right?.accountId || '');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({ error:'invalid_request' });
  const limited = await consumeRateLimit(req,{ limit:30, windowMs:60_000, keyPrefix:'oauth-token' });
  if (limited) return rateLimitResponse(res,limited.retryAfterSec);
  const p = body(req);
  try {
    const grant = p.grant_type === 'authorization_code'
      ? await consumeAuthorizationCode({ code:p.code, clientId:p.client_id, redirectUri:p.redirect_uri, resource:p.resource, verifier:p.code_verifier })
      : p.grant_type === 'refresh_token'
        ? await rotateRefreshToken({ token:p.refresh_token, clientId:p.client_id, resource:p.resource })
        : (() => { throw Object.assign(new Error('Grant não suportado.'), { code:'unsupported_grant_type' }); })();
    // O refresh traz o snapshot que foi validado antes de consumir a credencial
    // anterior. No authorization_code, capturamos o mesmo contexto agora.
    const securitySnapshot = grant.securitySnapshot
      || await getCurrentAgentSecurityContext(grant.ownerId);
    const client = String(grant.clientName || 'Assistente').trim().slice(0, 60);
    let issued = null;
    let refresh = '';
    try {
      issued = await createAgentToken(grant.ownerId,{ label:`MCP OAuth — ${client}`, scopes:grant.scopes, expiresInSec:3600 });
      refresh = await createRefreshToken({ clientId:p.client_id, ownerId:grant.ownerId, scopes:grant.scopes });
      const currentSecurity = await getCurrentAgentSecurityContext(grant.ownerId);
      if (!sameSecurityContext(securitySnapshot, currentSecurity)) {
        await Promise.allSettled([
          revokeIssuedAgentToken(grant.ownerId, issued?.credential?.id),
          revokeRefreshToken({ token:refresh, ownerId:grant.ownerId, revokeFamily:true }),
        ]);
        throw Object.assign(new Error('Renovação encerrada após uma alteração de segurança.'), {
          code:'invalid_grant', status:400, credentialsCleaned:true,
        });
      }
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
  } catch (cause) { return res.status(cause.status || 400).json({ error:cause.code || 'invalid_grant', error_description:cause.message }); }
}
