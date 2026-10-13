import { applyCors } from './lib/cors.js';
import { requireActiveSubscription } from './lib/require-access.js';
import { consumeRateLimit, rateLimitResponse } from './lib/rate-limit.js';
import {
  getSharedProject,
  putSharedProject,
  makeCode,
} from './lib/project-share-store.js';

/** Partilhas com fotos embutidas podem demorar a gravar no Blob. */
export const config = { maxDuration: 60 };

function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body && typeof req.body === 'object' ? req.body : {};
}

export default async function handler(req, res) {
  applyCors(req, res, { credentials: true });
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Use GET ou POST' });
  }

  const limited = await consumeRateLimit(req, {
    limit: 40,
    windowMs: 60_000,
    keyPrefix: 'project-share',
  });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  const access = await requireActiveSubscription(req, res, { asJson: true });
  if (!access) return;

  try {
    if (req.method === 'GET') {
      const code = req.query?.code || req.query?.c || '';
      const share = await getSharedProject(code);
      if (!share) return res.status(404).json({ error: 'Código inválido ou expirado.' });
      return res.status(200).json({
        ok: true,
        code: share.code,
        name: share.name,
        revision: share.revision,
        updatedAt: share.updatedAt,
        ownerEmail: share.ownerEmail || null,
        members: share.members || [],
        doc: share.doc,
      });
    }

    const body = parseBody(req);
    const action = String(body.action || 'create').toLowerCase();

    if (action === 'join' || action === 'pull') {
      const share = await getSharedProject(body.code);
      if (!share) return res.status(404).json({ error: 'Código inválido ou expirado.' });
      const email = access.email || access.customerId || 'membro';
      const members = Array.isArray(share.members) ? [...share.members] : [];
      if (email && !members.includes(email)) {
        members.push(email);
        await putSharedProject({
          ...share,
          members,
          revision: share.revision || 1,
          keepRevision: true,
        });
      }
      return res.status(200).json({
        ok: true,
        code: share.code,
        name: share.name,
        revision: share.revision,
        updatedAt: share.updatedAt,
        ownerEmail: share.ownerEmail || null,
        members,
        doc: share.doc,
      });
    }

    if (action === 'push' || action === 'update') {
      const existing = await getSharedProject(body.code);
      if (!existing) return res.status(404).json({ error: 'Código inválido ou expirado.' });
      if (!body.doc || typeof body.doc !== 'object') {
        return res.status(400).json({ error: 'Documento em falta.' });
      }
      const saved = await putSharedProject({
        ...existing,
        doc: body.doc,
        name: typeof body.name === 'string' && body.name.trim()
          ? body.name.trim().slice(0, 120)
          : existing.name,
        ownerEmail: existing.ownerEmail || access.email || null,
        revision: existing.revision || 1,
      });
      return res.status(200).json({
        ok: true,
        code: saved.code,
        revision: saved.revision,
        updatedAt: saved.updatedAt,
      });
    }

    // create
    if (!body.doc || typeof body.doc !== 'object') {
      return res.status(400).json({ error: 'Documento em falta.' });
    }
    let code = makeCode();
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await getSharedProject(code))) break;
      code = makeCode();
    }
    const saved = await putSharedProject({
      code,
      doc: body.doc,
      name: typeof body.name === 'string' && body.name.trim()
        ? body.name.trim().slice(0, 120)
        : 'Projeto partilhado',
      ownerEmail: access.email || null,
      ownerId: access.customerId || null,
      members: access.email ? [access.email] : [],
      revision: 0,
    });
    return res.status(201).json({
      ok: true,
      code: saved.code,
      revision: saved.revision,
      updatedAt: saved.updatedAt,
    });
  } catch (e) {
    const msg = e?.message || 'Falha na partilha.';
    const status = e?.code === 'share_too_large' ? 413 : 500;
    console.error('[project-share]', msg);
    return res.status(status).json({ error: msg });
  }
}
