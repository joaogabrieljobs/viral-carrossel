/** Bearer-only, visual-only batch operations for the local Moont MCP plugin. */
import { applyCors } from './lib/cors.js';
import { consumeRateLimit, rateLimitResponse } from './lib/rate-limit.js';
import { authenticateAgentRequest } from './lib/agent-token-store.js';
import {
  applyAgentTextEdit, applyAgentVisualBatch, getAgentProject, getAgentVisualJob,
  listAgentProjects, previewAgentTextEdit, previewAgentVisualBatch, undoAgentVisualBatch,
} from './lib/agent-visual-batch.js';
import { VISUAL_PATCH_SCHEMA } from './lib/visual-patch.js';
import { CONTENT_PATCH_SCHEMA } from './lib/content-patch.js';
import { generateAndApplyAgentSlideImage } from './lib/agent-image-generation.js';

export const config = { maxDuration: 300 };
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function parseBody(req) {
  const raw = req.body;
  if (typeof raw === 'string') {
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      throw Object.assign(new Error('Pedido demasiado grande.'), { status: 413, code: 'visual_body_too_large' });
    }
    try { return JSON.parse(raw); } catch { return null; }
  }
  if (raw && Buffer.byteLength(JSON.stringify(raw), 'utf8') > MAX_BODY_BYTES) {
    throw Object.assign(new Error('Pedido demasiado grande.'), { status: 413, code: 'visual_body_too_large' });
  }
  return raw;
}

function errorResponse(res, cause) {
  const validationErrors = new Set(['project_bad_cursor', 'project_bad_limit', 'project_bad_id']);
  const status = Number.isInteger(cause?.status) && cause.status >= 400 && cause.status < 600
    ? cause.status : validationErrors.has(cause?.code) ? 400
      : cause?.code === 'library_storage_unconfigured'
      || cause?.code === 'library_storage_unavailable' ? 503 : 500;
  const code = cause?.code || 'visual_batch_error';
  if (status >= 500) console.error('[agent-visual-batch]', code);
  const safeMessage = status >= 500
    ? 'Não foi possível acessar seus projetos agora.'
    : cause.message || 'Não foi possível concluir a alteração.';
  return res.status(status).json({ error: safeMessage, code,
    ...(Number.isSafeInteger(cause?.cloudVersion) ? { cloudVersion: cause.cloudVersion } : {}),
    ...(status === 400 && cause?.path ? { path: cause.path } : {}),
  });
}

export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Use GET ou POST.', code: 'visual_method_invalid' });
  }
  if (process.env.LIBRARY_SYNC_BACKEND !== 'postgres') {
    return res.status(503).json({ error: 'Biblioteca na nuvem indisponível.', code: 'project_backend_disabled' });
  }

  try {
    const limited = await consumeRateLimit(req, {
      limit: 120, windowMs: 60_000, keyPrefix: 'agent-visual-batch',
    });
    if (limited) return rateLimitResponse(res, limited.retryAfterSec);

    const body = req.method === 'POST' ? parseBody(req) : null;
    if (req.method === 'POST' && (!body || typeof body !== 'object' || Array.isArray(body))) {
      return res.status(400).json({ error: 'JSON inválido.', code: 'visual_body_invalid' });
    }
    const previewActions = new Set(['preview', 'preview_text']);
    const scope = req.method === 'POST' && !previewActions.has(body.action) ? 'projects:write' : 'projects:read';
    const agent = await authenticateAgentRequest(req, { scope });
    const byAccount = await consumeRateLimit(req, {
      limit: 120, windowMs: 60_000, keyPrefix: 'agent-visual-account', subject: agent.tokenId,
    });
    if (byAccount) return rateLimitResponse(res, byAccount.retryAfterSec);

    if (req.method === 'GET') {
      const op = req.query?.op || 'projects';
      if (op === 'schema') return res.status(200).json({ ok: true, schema: VISUAL_PATCH_SCHEMA });
      if (op === 'content_schema') return res.status(200).json({ ok: true, schema: CONTENT_PATCH_SCHEMA });
      if (op === 'projects') {
        const rawLimit = req.query?.limit;
        const limit = rawLimit == null ? 25 : Number(rawLimit);
        const result = await listAgentProjects(agent.ownerId, { cursor: req.query?.cursor, limit });
        return res.status(200).json({ ok: true, ...result });
      }
      if (op === 'project') {
        const includeText = req.query?.includeText === '1' || req.query?.includeText === 'true';
        const project = await getAgentProject(agent.ownerId, req.query?.id, { includeText });
        return res.status(200).json({ ok: true, project });
      }
      if (op === 'job') {
        const job = await getAgentVisualJob(agent.ownerId, req.query?.requestId);
        return res.status(200).json({ ok: true, job });
      }
      return res.status(400).json({ error: 'Operação inválida.', code: 'visual_operation_invalid' });
    }

    if (body.action === 'preview') {
      const result = await previewAgentVisualBatch(agent.ownerId, body);
      return res.status(200).json({ ok: true, ...result });
    }
    if (body.action === 'apply') {
      const job = await applyAgentVisualBatch(agent.ownerId, agent.tokenId, body);
      return res.status(200).json({ ok: true, job });
    }
    if (body.action === 'preview_text') {
      const result = await previewAgentTextEdit(agent.ownerId, body);
      return res.status(200).json({ ok: true, ...result });
    }
    if (body.action === 'apply_text') {
      const job = await applyAgentTextEdit(agent.ownerId, agent.tokenId, body);
      return res.status(200).json({ ok: true, job });
    }
    if (body.action === 'generate_image') {
      const result = await generateAndApplyAgentSlideImage(agent.ownerId, agent.tokenId, body);
      return res.status(200).json({ ok: true, job: result });
    }
    if (body.action === 'undo') {
      const job = await undoAgentVisualBatch(agent.ownerId, body);
      return res.status(200).json({ ok: true, job });
    }
    return res.status(400).json({ error: 'Ação inválida.', code: 'visual_action_invalid' });
  } catch (cause) {
    return errorResponse(res, cause);
  }
}
