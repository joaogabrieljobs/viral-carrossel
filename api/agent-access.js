/** Gestão de credenciais pessoais para ligar o Codex ao Moont. */
import { allowedOrigins, applyCors } from './lib/cors.js';
import { requireActiveSubscription } from './lib/require-access.js';
import { resolveLibraryOwnerId } from './lib/library-sync-store.js';
import { consumeRateLimit, rateLimitResponse } from './lib/rate-limit.js';
import {
  AgentTokenError,
  createAgentToken,
  listAgentTokens,
  revokeAgentToken,
} from './lib/agent-token-store.js';

export const config = { maxDuration: 30 };

function parseBody(req) {
  const raw = req.body;
  if (typeof raw === 'string') {
    if (Buffer.byteLength(raw, 'utf8') > 4096) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  try { if (Buffer.byteLength(JSON.stringify(raw), 'utf8') > 4096) return null; }
  catch { return null; }
  return raw;
}

function sendError(res, cause) {
  if (cause instanceof AgentTokenError) {
    return res.status(cause.status).json({ error: cause.message, code: cause.code });
  }
  console.error('[agent-access]', cause?.code || 'agent_access_error');
  const unavailable = cause?.code === 'library_storage_unconfigured'
    || cause?.code === 'library_storage_unavailable';
  return res.status(unavailable ? 503 : 500).json({
    error: 'Não foi possível acessar as integrações agora.',
    code: unavailable ? 'agent_storage_unavailable' : 'agent_access_error',
  });
}

export default async function handler(req, res) {
  applyCors(req, res, { credentials: true });
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Use GET, POST ou DELETE.' });
  }
  if (process.env.LIBRARY_SYNC_BACKEND !== 'postgres') {
    return res.status(503).json({ error: 'Integrações ainda não disponíveis.', code: 'agent_backend_disabled' });
  }
  // Mesmo com cookie SameSite, conferir Origin evita criação/revogação por
  // páginas de outro subdomínio e formulários sem preflight.
  if (req.method !== 'GET' && !allowedOrigins().has(req.headers?.origin)) {
    return res.status(403).json({ error: 'Origem não autorizada.', code: 'agent_origin_denied' });
  }
  if (req.method !== 'GET' && !/^application\/json(?:;|$)/i.test(String(req.headers?.['content-type'] || ''))) {
    return res.status(415).json({ error: 'Envie JSON.', code: 'agent_json_required' });
  }
  const limited = await consumeRateLimit(req, {
    limit: 30, windowMs: 60_000, keyPrefix: 'agent-access',
  });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  const access = await requireActiveSubscription(req, res, { asJson: true });
  if (!access) return;
  const ownerId = resolveLibraryOwnerId(access);
  if (!ownerId) return res.status(401).json({ error: 'Conta não identificada.', code: 'agent_account_missing' });

  try {
    if (req.method === 'GET') {
      const credentials = await listAgentTokens(ownerId);
      return res.status(200).json({ ok: true, credentials });
    }
    const body = parseBody(req);
    if (!body) {
      return res.status(400).json({ error: 'JSON inválido ou muito grande.', code: 'agent_bad_body' });
    }
    if (req.method === 'POST') {
      const result = await createAgentToken(ownerId, {
        label: body.label ?? 'Codex',
        scopes: body.scopes ?? ['projects:read', 'projects:write'],
      });
      return res.status(201).json({ ok: true, ...result });
    }
    const credential = await revokeAgentToken(ownerId, body.id);
    return res.status(200).json({ ok: true, credential });
  } catch (cause) {
    return sendError(res, cause);
  }
}
