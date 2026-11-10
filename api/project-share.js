import { applyCors } from './lib/cors.js';
import { requireActiveSubscription } from './lib/require-access.js';
import { billingDisabled, readAccessCookie } from './lib/access.js';
import { consumeRateLimit, rateLimitResponse } from './lib/rate-limit.js';
import { getStripe } from './lib/stripe.js';
import {
  getSharedProject,
  putSharedProject,
  mutateSharedProject,
  deleteSharedProject,
  makeCode,
} from './lib/project-share-store.js';
import { getLibraryAsset } from './lib/library-sync-store.js';

/** Partilhas com fotos embutidas podem demorar a gravar no Blob. */
export const config = { maxDuration: 60 };

function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body && typeof req.body === 'object' ? req.body : {};
}

function sameIdentity(a, b) {
  const left = String(a || '').trim().toLowerCase();
  const right = String(b || '').trim().toLowerCase();
  return !!left && left === right;
}

function normalizedShareCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

function normalizedShareProjectId(value) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9_-]{8,80}$/.test(id) ? id : '';
}

/**
 * Identidade canônica do projeto remoto. Diferente do código de convite, ela
 * vincula uma revisão ao projeto que entrou pela partilha. Backups importados
 * e cópias removem este campo, portanto não conseguem publicar por engano por
 * cima do projeto da equipe só porque ainda carregavam um `shareCode` antigo.
 */
function shareProjectIdForRecord(share) {
  const persisted = normalizedShareProjectId(share?.shareProjectId);
  if (persisted) return persisted;
  const code = normalizedShareCode(share?.code);
  return code ? `legacy_${code}` : '';
}

function shareDocBoundToRecord(share) {
  const projectId = shareProjectIdForRecord(share);
  return {
    ...(share?.doc && typeof share.doc === 'object' ? share.doc : {}),
    shareCode: normalizedShareCode(share?.code),
    ...(projectId ? { shareProjectId: projectId } : {}),
  };
}

async function hasVerifiedEmail(access) {
  if (!access?.customerId || !access?.email) return false;
  try {
    const customer = await getStripe().customers.retrieve(access.customerId);
    return !!customer && !customer.deleted
      && !!customer.metadata?.vc_google_sub
      && sameIdentity(customer.email, access.email);
  } catch {
    // Um erro ao consultar a identidade nunca autoriza escrita por e-mail.
    return false;
  }
}

async function callerCanWrite(share, access) {
  // Partilhas antigas sem dono foram criadas pelo bypass de desenvolvimento.
  // A exceção nunca vale em produção nem para partilhas com dono real.
  if (access?.billingDisabled && billingDisabled() && !share?.ownerId && !share?.ownerEmail) return true;
  if (sameIdentity(access?.customerId, share?.ownerId)) return true;
  if (access?.billingDisabled && billingDisabled()
    && sameIdentity(share?.ownerId, 'dev:billing-disabled')) return true;
  const blocked = Array.isArray(share?.blockedMembers) ? share.blockedMembers : [];
  if (blocked.some((member) => sameIdentity(member, access?.customerId)
    || sameIdentity(member, access?.email))) return false;
  const members = Array.isArray(share?.members) ? share.members : [];
  if (members.some((member) => sameIdentity(member, access?.customerId))) return true;
  // E-mail é apenas fallback para partilhas antigas sem ID, após prova Google.
  const legacyEmailMatch = (!share?.ownerId && sameIdentity(access?.email, share?.ownerEmail))
    || members.some((member) => sameIdentity(member, access?.email)
      && !(share?.ownerId && sameIdentity(member, share?.ownerEmail)));
  return legacyEmailMatch && hasVerifiedEmail(access);
}

function callerIsOwner(share, access) {
  if (sameIdentity(access?.customerId, share?.ownerId)) return true;
  return !!(access?.billingDisabled && billingDisabled()
    && sameIdentity(share?.ownerId, 'dev:billing-disabled'));
}

function callerIsBlocked(share, access) {
  const blocked = Array.isArray(share?.blockedMembers) ? share.blockedMembers : [];
  return blocked.some((member) => sameIdentity(member, access?.customerId)
    || sameIdentity(member, access?.email));
}

function memberCount(share) {
  return new Set((Array.isArray(share?.members) ? share.members : [])
    .map((member) => String(member || '').trim().toLowerCase())
    .filter(Boolean)).size;
}

async function publicShareResponse(share, actor, { includeDoc = true } = {}) {
  const projectId = shareProjectIdForRecord(share);
  return {
    ok: true,
    code: share.code,
    name: share.name,
    revision: share.revision,
    updatedAt: share.updatedAt,
    expiresAt: share.expiresAt || null,
    isOwner: callerIsOwner(share, actor),
    isMember: await callerCanWrite(share, actor),
    memberCount: memberCount(share),
    ...(projectId ? { projectId } : {}),
    ...(includeDoc ? { doc: shareDocBoundToRecord(share) } : {}),
  };
}

function writableIdentity(access) {
  return access.customerId || access.email
    || (access.billingDisabled && billingDisabled() ? 'dev:billing-disabled' : '');
}

function referencedShareAssetIds(doc) {
  const ids = new Set();
  const add = (value) => {
    const id = String(value || '').trim();
    if (id) ids.add(id);
  };
  for (const slide of doc?.slides || []) {
    add(slide?.bgImageAssetId);
    add(slide?.logoImageAssetId);
    add(slide?.refImageAssetId);
    for (const ref of slide?.imageReferences || []) add(ref?.assetId);
  }
  add(doc?.brand?.logoAssetId);
  add(doc?.styleKit?.logo?.assetId);
  for (const ref of doc?.styleKit?.refImages || []) add(ref?.assetId);
  return ids;
}

function assetOwnersForRevision(doc, actor, fallbackOwnerId = '') {
  const ownerId = String(actor?.customerId || fallbackOwnerId || '').trim();
  if (!ownerId) return {};
  return Object.fromEntries([...referencedShareAssetIds(doc)].map((assetId) => [assetId, ownerId]));
}

function assetOwnerCandidates(share, assetId) {
  const candidates = [];
  const add = (value) => {
    const ownerId = String(value || '').trim();
    // IDs Stripe/dev não contêm @. E-mails legados nunca viram namespace de assets.
    if (!ownerId || ownerId.includes('@') || candidates.includes(ownerId)) return;
    candidates.push(ownerId);
  };
  add(share?.assetOwners?.[assetId]);
  add(share?.ownerId);
  for (const member of share?.members || []) add(member);
  return candidates;
}

async function getSharedAsset(share, assetId, options) {
  for (const ownerId of assetOwnerCandidates(share, assetId)) {
    // Uma revisão antiga não guardava a origem por asset. Procurar apenas no
    // dono e nos membros da própria partilha recupera essas fotos sem abrir
    // acesso a bibliotecas arbitrárias.
    // eslint-disable-next-line no-await-in-loop
    const asset = await getLibraryAsset(ownerId, assetId, options);
    if (asset) return asset;
  }
  return null;
}

export default async function handler(req, res) {
  applyCors(req, res, { credentials: true });
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Use GET ou POST' });
  }

  const readingShareAsset = req.method === 'GET' && !!(req.query?.asset || req.query?.a);
  const limited = await consumeRateLimit(req, {
    limit: readingShareAsset ? 800 : 40,
    windowMs: 60_000,
    keyPrefix: readingShareAsset ? 'project-share-asset' : 'project-share',
  });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  const access = await requireActiveSubscription(req, res, { asJson: true });
  if (!access) return;
  let signedAccess = null;
  if (access.billingDisabled && billingDisabled()) {
    try { signedAccess = readAccessCookie(req); } catch { /* dev sem secret */ }
  }
  const actor = signedAccess ? { ...access, ...signedAccess } : access;

  try {
    if (req.method === 'GET') {
      const code = req.query?.code || req.query?.c || '';
      const share = await getSharedProject(code);
      if (!share) return res.status(404).json({ error: 'Código inválido ou expirado.' });
      if (callerIsBlocked(share, actor)) {
        throw Object.assign(new Error('O acesso desta conta foi removido pelo dono do projeto.'), {
          code: 'share_forbidden',
        });
      }
      const assetId = String(req.query?.asset || req.query?.a || '').trim();
      if (assetId) {
        if (!referencedShareAssetIds(share.doc).has(assetId)) {
          return res.status(404).json({ error: 'Asset não encontrado.' });
        }
        const rawPart = req.query?.part;
        if (rawPart !== undefined && (typeof rawPart !== 'string' || !/^\d{1,2}$/.test(rawPart))) {
          return res.status(400).json({ error: 'Índice da parte inválido.', code: 'library_bad_asset' });
        }
        const asset = await getSharedAsset(share, assetId, {
          part: rawPart === undefined ? undefined : Number(rawPart),
        });
        if (!asset) return res.status(404).json({ error: 'Asset não encontrado.' });
        return res.status(200).json({ ok: true, asset });
      }
      return res.status(200).json(await publicShareResponse(share, actor));
    }

    const body = parseBody(req);
    const action = String(body.action || 'create').toLowerCase();

    if (action === 'join' || action === 'pull') {
      const identity = writableIdentity(actor);
      const share = await mutateSharedProject(body.code, (current) => {
        if (callerIsBlocked(current, actor)) {
          throw Object.assign(new Error('O acesso desta conta foi removido pelo dono do projeto.'), {
            code: 'share_forbidden',
          });
        }
        const members = Array.isArray(current.members) ? current.members : [];
        if (!identity || members.some((member) => sameIdentity(member, identity))) {
          return current;
        }
        return {
          ...current,
          members: [...members, identity],
          keepRevision: true,
        };
      });
      if (!share) return res.status(404).json({ error: 'Código inválido ou expirado.' });
      return res.status(200).json(await publicShareResponse(share, actor));
    }

    if (action === 'removemember' || action === 'remove_member') {
      const target = String(body.memberId || body.member || '').trim();
      if (!target || target.length > 254) {
        return res.status(400).json({ error: 'Membro inválido.' });
      }
      const share = await mutateSharedProject(body.code, (current) => {
        if (!callerIsOwner(current, actor)) {
          throw Object.assign(new Error('Só o dono pode remover membros.'), { code: 'share_forbidden' });
        }
        if (sameIdentity(target, current.ownerId) || sameIdentity(target, current.ownerEmail)) {
          return current;
        }
        const members = (Array.isArray(current.members) ? current.members : [])
          .filter((member) => !sameIdentity(member, target));
        const blockedMembers = Array.from(new Set([
          ...(Array.isArray(current.blockedMembers) ? current.blockedMembers : []),
          target,
        ]));
        return { ...current, members, blockedMembers, keepRevision: true };
      });
      if (!share) return res.status(404).json({ error: 'Código inválido ou expirado.' });
      return res.status(200).json(await publicShareResponse(share, actor, { includeDoc: false }));
    }

    if (action === 'revoke' || action === 'delete') {
      const share = await getSharedProject(body.code);
      if (!share) return res.status(404).json({ error: 'Código inválido ou expirado.' });
      if (!callerIsOwner(share, actor)) {
        throw Object.assign(new Error('Só o dono pode revogar esta partilha.'), { code: 'share_forbidden' });
      }
      await deleteSharedProject(body.code);
      return res.status(200).json({ ok: true, code: share.code, revoked: true });
    }

    if (action === 'push' || action === 'update') {
      if (!body.doc || typeof body.doc !== 'object') {
        return res.status(400).json({ error: 'Documento em falta.' });
      }
      const saved = await mutateSharedProject(body.code, async (existing) => {
        if (!(await callerCanWrite(existing, actor))) {
          throw Object.assign(new Error('Sem permissão para alterar este projeto.'), {
            code: 'share_forbidden',
          });
        }
        const requestedCode = normalizedShareCode(body.code);
        const documentCode = normalizedShareCode(body.doc.shareCode);
        const projectId = shareProjectIdForRecord(existing);
        const documentProjectId = normalizedShareProjectId(body.doc.shareProjectId);
        if (!requestedCode || documentCode !== requestedCode
          || !projectId || documentProjectId !== projectId) {
          throw Object.assign(new Error('Este código não pertence ao projeto enviado.'), {
            code: 'share_project_mismatch',
          });
        }
        return {
          ...existing,
          shareProjectId: projectId,
          doc: {
            ...body.doc,
            shareCode: requestedCode,
            shareProjectId: projectId,
          },
          assetOwners: assetOwnersForRevision(body.doc, actor, existing.ownerId),
          name: typeof body.name === 'string' && body.name.trim()
            ? body.name.trim().slice(0, 120)
            : existing.name,
          ownerEmail: existing.ownerEmail || actor.email || null,
          revision: existing.revision || 1,
        };
      });
      if (!saved) return res.status(404).json({ error: 'Código inválido ou expirado.' });
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
    const shareProjectId = `sp_${makeCode()}${makeCode()}`;
    const saved = await putSharedProject({
      code,
      // A própria revisão guardada leva o vínculo. Assim qualquer cliente que
      // entrar pelo código também recebe a defesa contra publicar outro projeto.
      shareProjectId,
      doc: { ...body.doc, shareCode: code, shareProjectId },
      name: typeof body.name === 'string' && body.name.trim()
        ? body.name.trim().slice(0, 120)
        : 'Projeto partilhado',
      ownerEmail: actor.email || null,
      ownerId: actor.customerId || (actor.billingDisabled && billingDisabled() ? 'dev:billing-disabled' : null),
      assetOwners: assetOwnersForRevision(body.doc, actor),
      members: writableIdentity(actor) ? [writableIdentity(actor)] : [],
      revision: 0,
    });
    return res.status(201).json({
      ok: true,
      code: saved.code,
      projectId: saved.shareProjectId,
      revision: saved.revision,
      updatedAt: saved.updatedAt,
    });
  } catch (e) {
    const msg = e?.message || 'Falha na partilha.';
    const status = e?.code === 'share_forbidden' ? 403
      : e?.code === 'share_project_mismatch' ? 409
      : e?.code === 'share_busy' ? 409
        : e?.code === 'share_too_large' ? 413
          : e?.code === 'share_storage_unconfigured' ? 503 : 500;
    console.error('[project-share]', msg, e?.code || '', e?.stack?.slice?.(0, 200) || '');
    return res.status(status).json({ error: msg });
  }
}
