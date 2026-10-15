/** Projetos por conta, com versões independentes e exclusão persistente. */
import { applyCors } from './lib/cors.js';
import { requireActiveSubscription } from './lib/require-access.js';
import { consumeRateLimit, rateLimitResponse } from './lib/rate-limit.js';
import { resolveLibraryOwnerId } from './lib/library-sync-store.js';
import {
  listAccountProjects,
  getAccountProject,
  putAccountProject,
  deleteAccountProject,
} from './lib/library-sync-postgres.js';

export const config = { maxDuration: 60 };

const MAX_PROJECT_BYTES = 2 * 1024 * 1024;
const PROJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;

function error(status, message, code, extra = {}) {
  return { status, body: { error: message, code, ...extra } };
}

function validId(value) {
  return typeof value === 'string' && PROJECT_ID.test(value);
}

function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return req.body;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validVersion(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function projectSummary(row) {
  if (!isRecord(row)) return row;
  const { entry, ...meta } = row;
  if (!isRecord(entry)) return meta;
  // A lista nunca transporta o documento inteiro: slides e imagens vêm só no detalhe.
  const { doc, ...details } = entry;
  return { ...meta, entry: details };
}

function mapStoreError(cause) {
  switch (cause?.code) {
    case 'project_conflict':
      return error(409, 'Este projeto mudou na nuvem. Atualize antes de salvar.', cause.code, {
        cloudVersion: cause.cloudVersion,
      });
    case 'project_bad_id':
    case 'project_bad_entry':
    case 'project_bad_cursor':
    case 'project_bad_limit':
    case 'project_bad_version':
    case 'library_bad_owner':
      return error(400, 'Dados do projeto inválidos.', cause.code);
    case 'project_too_large':
      return error(413, 'Este projeto excede o tamanho permitido.', cause.code);
    case 'library_storage_unconfigured':
    case 'library_storage_unavailable':
      return error(503, 'O armazenamento de projetos está indisponível. Tente novamente.', cause.code);
    default:
      console.error('[projects]', cause?.code || 'projects_error', cause?.message || cause);
      return error(500, 'Não foi possível acessar seus projetos.', 'projects_error');
  }
}

export default async function handler(req, res) {
  applyCors(req, res, { credentials: true });
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Project-Owner');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Use GET, PUT ou DELETE.' });
  }
  // Um GET já importa o manifesto legado para o Postgres. Nunca abrir este
  // endpoint enquanto o aplicativo ainda grava a biblioteca no Blob.
  if (process.env.LIBRARY_SYNC_BACKEND !== 'postgres') {
    return res.status(503).json({
      error: 'A nova biblioteca ainda não está disponível.', code: 'project_backend_disabled',
    });
  }

  const limited = await consumeRateLimit(req, {
    limit: 120, windowMs: 60_000, keyPrefix: 'projects',
  });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  const access = await requireActiveSubscription(req, res, { asJson: true });
  if (!access) return;
  const owner = resolveLibraryOwnerId(access);
  if (!owner) return res.status(401).json({ error: 'Sessão sem identificador de conta.' });
  const intendedOwner = req.headers?.['x-project-owner'] ?? req.headers?.['X-Project-Owner'];
  if (intendedOwner !== undefined && intendedOwner !== owner) {
    return res.status(409).json({
      error: 'A conta mudou durante o acesso aos projetos. Entre novamente e sincronize.',
      code: 'project_owner_changed',
    });
  }

  try {
    if (req.method === 'GET') {
      if (Object.prototype.hasOwnProperty.call(req.query || {}, 'id')) {
        const id = req.query.id;
        if (!validId(id)) return res.status(400).json({ error: 'ID de projeto inválido.', code: 'project_bad_id' });
        const project = await getAccountProject(owner, id);
        if (!project || project.deleted) return res.status(404).json({ error: 'Projeto não encontrado.', code: 'project_not_found' });
        return res.status(200).json({ ok: true, project });
      }

      const rawLimit = req.query?.limit;
      const limit = rawLimit === undefined ? 25 : Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ error: 'Limite inválido (1 a 100).', code: 'project_bad_limit' });
      }
      const cursor = req.query?.cursor;
      if (cursor !== undefined && (typeof cursor !== 'string' || !cursor || cursor.length > 512)) {
        return res.status(400).json({ error: 'Cursor inválido.', code: 'project_bad_cursor' });
      }
      const result = await listAccountProjects(owner, { cursor, limit });
      return res.status(200).json({
        ok: true,
        projects: (result.projects || []).map(projectSummary),
        nextCursor: result.nextCursor || null,
        total: result.total ?? null,
      });
    }

    const body = parseBody(req);
    if (!isRecord(body)) return res.status(400).json({ error: 'JSON inválido.', code: 'project_bad_body' });
    if (!validVersion(body.baseVersion)) {
      return res.status(400).json({ error: 'Versão do projeto inválida.', code: 'project_bad_version' });
    }

    if (req.method === 'PUT') {
      const entry = body.entry ?? body.project;
      if (!isRecord(entry) || !validId(entry.id)) {
        return res.status(400).json({ error: 'Projeto ou ID inválido.', code: 'project_bad_entry' });
      }
      const bytes = Buffer.byteLength(JSON.stringify(entry), 'utf8');
      if (bytes > MAX_PROJECT_BYTES) {
        return res.status(413).json({ error: 'Este projeto excede o tamanho permitido.', code: 'project_too_large' });
      }
      const project = await putAccountProject(owner, entry, { baseVersion: body.baseVersion });
      return res.status(200).json({ ok: true, project });
    }

    const id = body.id;
    if (!validId(id)) return res.status(400).json({ error: 'ID de projeto inválido.', code: 'project_bad_id' });
    const project = await deleteAccountProject(owner, id, { baseVersion: body.baseVersion });
    return res.status(200).json({ ok: true, project });
  } catch (cause) {
    const mapped = mapStoreError(cause);
    return res.status(mapped.status).json(mapped.body);
  }
}
