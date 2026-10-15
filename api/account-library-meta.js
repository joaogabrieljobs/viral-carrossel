/** Marcas, pastas e preferências globais da conta, sem documentos de projetos. */
import { applyCors } from './lib/cors.js';
import { requireActiveSubscription } from './lib/require-access.js';
import { consumeRateLimit, rateLimitResponse } from './lib/rate-limit.js';
import { resolveLibraryOwnerId } from './lib/library-sync-store.js';
import { getAccountLibraryMeta, putAccountLibraryMeta } from './lib/library-sync-postgres.js';

export const config = { maxDuration: 60 };

const MAX_METADATA_BYTES = 512 * 1024;

function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return req.body;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mapStoreError(cause) {
  switch (cause?.code) {
    case 'account_meta_conflict':
      return { status: 409, body: {
        error: 'Esses dados mudaram em outro dispositivo. Atualize antes de salvar.',
        code: cause.code, cloudRevision: cause.cloudRevision,
      } };
    case 'account_meta_bad_revision':
    case 'account_meta_bad_data':
    case 'library_bad_owner':
      return { status: 400, body: { error: 'Dados da conta inválidos.', code: cause.code } };
    case 'account_meta_too_large':
      return { status: 413, body: { error: 'Dados da conta excedem o tamanho permitido.', code: cause.code } };
    case 'library_storage_unconfigured':
    case 'library_storage_unavailable':
      return { status: 503, body: {
        error: 'Os dados da conta estão temporariamente indisponíveis. Tente novamente.', code: cause.code,
      } };
    default:
      console.error('[account-library-meta]', cause?.code || 'account_meta_error');
      return { status: 500, body: { error: 'Não foi possível acessar os dados da conta.', code: 'account_meta_error' } };
  }
}

export default async function handler(req, res) {
  applyCors(req, res, { credentials: true });
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Account-Owner');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'PUT'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT, OPTIONS');
    return res.status(405).json({ error: 'Use GET ou PUT.' });
  }
  if (process.env.LIBRARY_SYNC_BACKEND !== 'postgres') {
    return res.status(503).json({
      error: 'Os dados da conta ainda não estão disponíveis.', code: 'account_meta_backend_disabled',
    });
  }

  const limited = await consumeRateLimit(req, {
    limit: 120, windowMs: 60_000, keyPrefix: 'account-library-meta',
  });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  const access = await requireActiveSubscription(req, res, { asJson: true });
  if (!access) return;
  const owner = resolveLibraryOwnerId(access);
  if (!owner) return res.status(401).json({ error: 'Sessão sem identificador de conta.' });
  const intendedOwner = req.headers?.['x-account-owner'] ?? req.headers?.['X-Account-Owner'];
  if (intendedOwner !== undefined && intendedOwner !== owner) {
    return res.status(409).json({
      error: 'A conta mudou antes de salvar esses dados. Entre novamente e sincronize.',
      code: 'account_meta_owner_changed',
    });
  }

  try {
    if (req.method === 'GET') {
      const result = await getAccountLibraryMeta(owner);
      return res.status(200).json({ ok: true, ...result });
    }

    const body = parseBody(req);
    if (!isRecord(body) || !isRecord(body.metadata)) {
      return res.status(400).json({ error: 'JSON inválido.', code: 'account_meta_bad_data' });
    }
    if (!Number.isSafeInteger(body.baseRevision) || body.baseRevision < 0) {
      return res.status(400).json({ error: 'Revisão dos dados da conta inválida.', code: 'account_meta_bad_revision' });
    }
    let bytes;
    try { bytes = Buffer.byteLength(JSON.stringify(body.metadata), 'utf8'); }
    catch { return res.status(400).json({ error: 'JSON inválido.', code: 'account_meta_bad_data' }); }
    if (bytes > MAX_METADATA_BYTES) {
      return res.status(413).json({ error: 'Dados da conta excedem o tamanho permitido.', code: 'account_meta_too_large' });
    }

    const result = await putAccountLibraryMeta(owner, body.metadata, { baseRevision: body.baseRevision });
    return res.status(200).json({ ok: true, ...result });
  } catch (cause) {
    const mapped = mapStoreError(cause);
    return res.status(mapped.status).json(mapped.body);
  }
}
