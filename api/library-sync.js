/**
 * Sync da biblioteca por conta autenticada (multiutilizador).
 * GET  → meta ou manifesto completo (?full=1) ou asset (?asset=id)
 * POST → action: push | putAsset | status
 */
import { applyCors } from './lib/cors.js';
import { requireActiveSubscription } from './lib/require-access.js';
import { consumeRateLimit, rateLimitResponse } from './lib/rate-limit.js';
import {
  getLibrarySyncMeta,
  getLibraryManifest,
  putLibraryManifest,
  putLibraryAsset,
  getLibraryAsset,
  resolveLibraryOwnerId,
} from './lib/library-sync-store.js';

export const config = { maxDuration: 60 };

function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body && typeof req.body === 'object' ? req.body : {};
}

function ownerId(access) {
  return resolveLibraryOwnerId(access || {});
}

function mapStoreError(e) {
  const code = e?.code || '';
  if (code === 'library_conflict') {
    return {
      status: 409,
      body: {
        error: e.message,
        code,
        cloudRevision: e.cloudRevision,
        cloudUpdatedAt: e.cloudUpdatedAt,
      },
    };
  }
  if (code === 'library_too_large' || code === 'library_asset_too_large') {
    return { status: 413, body: { error: e.message, code } };
  }
  if (code === 'library_storage_unconfigured') {
    return { status: 503, body: { error: e.message, code } };
  }
  if (code === 'library_bad_owner' || code === 'library_bad_manifest' || code === 'library_bad_asset') {
    return { status: 400, body: { error: e.message, code } };
  }
  return { status: 500, body: { error: e?.message || 'Falha no sync da biblioteca.' } };
}

export default async function handler(req, res) {
  applyCors(req, res, { credentials: true });
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Use GET ou POST' });
  }

  const limited = await consumeRateLimit(req, {
    limit: 60,
    windowMs: 60_000,
    keyPrefix: 'library-sync',
  });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  const access = await requireActiveSubscription(req, res, { asJson: true });
  if (!access) return;

  const customerId = ownerId(access);
  if (!customerId) {
    return res.status(401).json({ error: 'Sessão sem identificador de conta.' });
  }

  try {
    if (req.method === 'GET') {
      const assetId = req.query?.asset || req.query?.a || '';
      if (assetId) {
        const asset = await getLibraryAsset(customerId, assetId);
        if (!asset) return res.status(404).json({ error: 'Asset não encontrado.' });
        return res.status(200).json({ ok: true, asset });
      }
      const full = req.query?.full === '1' || req.query?.full === 'true';
      if (full) {
        const manifest = await getLibraryManifest(customerId);
        if (!manifest) {
          return res.status(404).json({ error: 'Nenhuma biblioteca na nuvem para esta conta.', empty: true });
        }
        return res.status(200).json({ ok: true, manifest });
      }
      const meta = await getLibrarySyncMeta(customerId);
      if (!meta) {
        return res.status(200).json({ ok: true, empty: true, meta: null });
      }
      return res.status(200).json({ ok: true, empty: false, meta });
    }

    const body = parseBody(req);
    const action = String(body.action || 'status').toLowerCase();

    if (action === 'status') {
      const meta = await getLibrarySyncMeta(customerId);
      return res.status(200).json({
        ok: true,
        empty: !meta,
        meta: meta || null,
        customerId,
        email: access.email || null,
      });
    }

    if (action === 'putAsset') {
      const saved = await putLibraryAsset(customerId, body.assetId, {
        dataUrl: body.dataUrl,
        contentType: body.contentType,
      });
      return res.status(200).json({ ok: true, ...saved });
    }

    if (action === 'push') {
      const { manifest, meta } = await putLibraryManifest(
        customerId,
        {
          ...(body.manifest && typeof body.manifest === 'object' ? body.manifest : {}),
          email: access.email || body.manifest?.email || null,
        },
        {
          baseRevision: body.baseRevision,
          force: body.force === true,
        },
      );
      return res.status(200).json({
        ok: true,
        revision: meta.revision,
        updatedAt: meta.updatedAt,
        projectCount: meta.projectCount,
        assetIds: meta.assetIds,
        manifestRevision: manifest.revision,
      });
    }

    return res.status(400).json({ error: 'Ação inválida. Use status, putAsset ou push.' });
  } catch (e) {
    const mapped = mapStoreError(e);
    if (mapped.status >= 500) {
      console.error('[library-sync]', e?.message || e, e?.code || '', e?.stack?.slice?.(0, 200) || '');
    }
    return res.status(mapped.status).json(mapped.body);
  }
}
