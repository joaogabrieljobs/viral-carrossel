/** Atomic, owner-scoped visual edits with a private undo snapshot per project. */
import { createHash } from 'node:crypto';
import { getPostgresConnection } from './postgres-connection.js';
import { getAccountProject, listAccountProjects } from './library-sync-postgres.js';
import { applyVisualPatchToEntry, projectDesignView } from './visual-patch.js';
import { applyContentPatchToEntry } from './content-patch.js';

const PROJECT_ID = /^[^\u0000]{1,500}$/;
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const OWNER_ID = /^[A-Za-z0-9_.-]{1,80}$/;

function fail(status, code, message, extra = {}) {
  throw Object.assign(new Error(message), { status, code, ...extra });
}

function ownerId(value) {
  if (typeof value !== 'string' || !OWNER_ID.test(value)) fail(401, 'agent_account_invalid', 'Conta inválida.');
  return value;
}

function projectId(value) {
  if (typeof value !== 'string' || !PROJECT_ID.test(value) || !value.trim()) {
    fail(400, 'visual_project_id_invalid', 'ID de projeto inválido.');
  }
  return value;
}

export function requestId(value) {
  if (typeof value !== 'string' || !REQUEST_ID.test(value)) {
    fail(400, 'visual_request_id_invalid', 'requestId deve ter entre 8 e 128 caracteres seguros.');
  }
  return value;
}

function version(value) {
  if (!Number.isSafeInteger(value) || value < 1) fail(400, 'visual_version_invalid', 'Versão base inválida.');
  return value;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

function requestHash(input) {
  return createHash('sha256').update(JSON.stringify(stable(input))).digest('hex');
}

function safeJob(row) {
  if (!row) return null;
  return {
    requestId: row.request_id,
    projectId: row.project_id,
    status: row.status,
    beforeVersion: Number(row.before_version),
    afterVersion: Number(row.after_version),
    changedSlideCount: Number(row.changed_slide_count),
    changedBrandFields: row.changed_brand_fields || [],
    createdAt: row.created_at,
    undoneAt: row.undone_at || null,
    undoRequestId: row.undo_request_id || null,
    undoVersion: row.undo_version == null ? null : Number(row.undo_version),
  };
}

function safeLabel(value) {
  return typeof value === 'string'
    ? value.replace(/data:[^\s"']+/gi, '[mídia]').slice(0, 200) : '';
}

export async function listAgentProjects(ownerValue, { cursor, limit = 25 } = {}) {
  const owner = ownerId(ownerValue);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) fail(400, 'visual_limit_invalid', 'Limite inválido.');
  const result = await listAccountProjects(owner, { cursor, limit });
  return {
    projects: (result.projects || []).map(project => ({
      id: project.id,
      version: project.version,
      updatedAt: project.updatedAt,
      name: safeLabel(project.entry?.name || project.entry?.title),
      slideCount: project.slideCount ?? null,
    })),
    nextCursor: result.nextCursor || null,
    total: result.total ?? null,
  };
}

export async function getAgentProject(ownerValue, idValue, { includeText = false } = {}) {
  const project = await getAccountProject(ownerId(ownerValue), projectId(idValue));
  if (!project || project.deleted) fail(404, 'visual_project_not_found', 'Projeto não encontrado.');
  return projectDesignView(project, { includeText });
}

function snapshotForUndo(entry) {
  const clone = structuredClone(entry);
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string' && (value.startsWith('data:') || value.startsWith('blob:'))) node[key] = null;
      else if (value && typeof value === 'object') walk(value);
    }
  };
  walk(clone);
  return clone;
}

async function forgetExpiredVisualJobs(tx, owner) {
  await tx.unsafe(
    `DELETE FROM moont.agent_visual_jobs
     WHERE owner_id = $1 AND created_at < now() - interval '30 days'`,
    [owner],
  );
}

export async function previewAgentVisualBatch(ownerValue, input) {
  const project = await getAccountProject(ownerId(ownerValue), projectId(input?.projectId));
  if (!project || project.deleted) fail(404, 'visual_project_not_found', 'Projeto não encontrado.');
  const base = version(input?.baseVersion);
  if (project.version !== base) {
    fail(409, 'project_conflict', 'O projeto mudou na nuvem.', { cloudVersion: project.version });
  }
  const result = applyVisualPatchToEntry(project.entry, input.patch, input.slideIds, { brandScope: input.brandScope });
  return {
    projectId: project.id,
    baseVersion: base,
    slideCount: result.selectedSlideCount,
    selectedSlideCount: result.selectedSlideCount,
    changedSlideCount: result.changes.length,
    brandChanges: result.brandChanges,
    changes: result.changes,
  };
}

export async function previewAgentTextEdit(ownerValue, input) {
  const project = await getAccountProject(ownerId(ownerValue), projectId(input?.projectId));
  if (!project || project.deleted) fail(404, 'content_project_not_found', 'Projeto não encontrado.');
  const base = version(input?.baseVersion);
  if (project.version !== base) {
    fail(409, 'project_conflict', 'O projeto mudou na nuvem.', { cloudVersion: project.version });
  }
  const result = applyContentPatchToEntry(project.entry, input.patch);
  return {
    projectId: project.id,
    baseVersion: base,
    changedSlideCount: result.changedSlideCount,
    changes: result.changes,
    projectChanges: result.projectChanges,
  };
}

export async function getAgentVisualJob(ownerValue, idValue) {
  const owner = ownerId(ownerValue);
  const id = requestId(idValue);
  const rows = await getPostgresConnection().unsafe(
    `SELECT request_id, project_id, status, before_version, after_version,
       changed_slide_count, changed_brand_fields, created_at, undone_at,
       undo_request_id, undo_version
     FROM moont.agent_visual_jobs WHERE owner_id = $1 AND request_id = $2`,
    [owner, id],
  );
  if (!rows[0]) fail(404, 'visual_job_not_found', 'Alteração não encontrada.');
  return safeJob(rows[0]);
}

async function lockAccountAndProject(tx, owner, id) {
  const states = await tx.unsafe(
    `SELECT owner_id FROM moont.account_libraries WHERE owner_id = $1 FOR UPDATE`, [owner],
  );
  if (!states[0]) fail(404, 'visual_project_not_found', 'Projeto não encontrado.');
  const rows = await tx.unsafe(
    `SELECT project_id, entry, version, deleted_at FROM moont.account_projects
     WHERE owner_id = $1 AND project_id = $2 FOR UPDATE`, [owner, id],
  );
  const row = rows[0];
  if (!row || row.deleted_at != null || !row.entry) fail(404, 'visual_project_not_found', 'Projeto não encontrado.');
  return row;
}

async function updateProject(tx, owner, id, entry, baseVersion, timestamp) {
  const rows = await tx.unsafe(
    `UPDATE moont.account_projects
     SET entry = $3::jsonb, version = version + 1, updated_at = $4
     WHERE owner_id = $1 AND project_id = $2 AND version = $5 AND deleted_at IS NULL
     RETURNING version`,
    [owner, id, JSON.stringify({ ...entry, updatedAt: timestamp }), timestamp, baseVersion],
  );
  if (!rows[0]) fail(409, 'project_conflict', 'O projeto mudou na nuvem.');
  await tx.unsafe(
    `UPDATE moont.account_libraries SET revision = revision + 1, updated_at = $2
     WHERE owner_id = $1`, [owner, timestamp],
  );
  return Number(rows[0].version);
}

function validateApplyInput(input) {
  const id = projectId(input?.projectId);
  const base = version(input?.baseVersion);
  const rid = requestId(input?.requestId);
  if (!input?.patch || typeof input.patch !== 'object' || Array.isArray(input.patch)) {
    fail(400, 'visual_patch_invalid', 'Patch visual inválido.');
  }
  return { id, base, rid };
}

export async function applyAgentVisualBatch(ownerValue, tokenId, input) {
  const owner = ownerId(ownerValue);
  const { id, base, rid } = validateApplyInput(input);
  if (typeof tokenId !== 'string' || !tokenId) fail(401, 'agent_token_invalid', 'Credencial inválida.');
  // Do not trust a client preview. Compute again under the project lock.
  const hash = requestHash({ projectId: id, baseVersion: base, slideIds: input.slideIds ?? null,
    brandScope: input.brandScope ?? null, patch: input.patch });
  // Ensure legacy libraries are migrated before taking our own transaction.
  await getAccountProject(owner, id);
  return getPostgresConnection().begin(async tx => {
    await forgetExpiredVisualJobs(tx, owner);
    const row = await lockAccountAndProject(tx, owner, id);
    const existing = await tx.unsafe(
      `SELECT * FROM moont.agent_visual_jobs WHERE owner_id = $1 AND request_id = $2`, [owner, rid],
    );
    if (existing[0]) {
      if (existing[0].request_hash !== hash || existing[0].project_id !== id) {
        fail(409, 'visual_request_reused', 'requestId já usado para outra alteração.');
      }
      return safeJob(existing[0]);
    }
    const currentVersion = Number(row.version);
    if (currentVersion !== base) {
      fail(409, 'project_conflict', 'O projeto mudou na nuvem.', { cloudVersion: currentVersion });
    }
    const result = applyVisualPatchToEntry(row.entry, input.patch, input.slideIds, { brandScope: input.brandScope });
    const changed = result.changes.length > 0 || result.brandChanges.length > 0;
    const afterVersion = changed
      ? await updateProject(tx, owner, id, result.entry, currentVersion, Date.now())
      : currentVersion;
    const jobs = await tx.unsafe(
      `INSERT INTO moont.agent_visual_jobs
       (owner_id, request_id, project_id, token_id, request_hash, before_version,
        after_version, changed_slide_count, changed_brand_fields, before_entry)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
       RETURNING request_id, project_id, status, before_version, after_version,
         changed_slide_count, changed_brand_fields, created_at, undone_at,
         undo_request_id, undo_version`,
      [owner, rid, id, tokenId, hash, currentVersion, afterVersion,
        result.changes.length, JSON.stringify(result.brandChanges), JSON.stringify(snapshotForUndo(row.entry))],
    );
    return safeJob(jobs[0]);
  });
}

export async function applyAgentTextEdit(ownerValue, tokenId, input) {
  const owner = ownerId(ownerValue);
  const { id, base, rid } = validateApplyInput(input);
  if (typeof tokenId !== 'string' || !tokenId) fail(401, 'agent_token_invalid', 'Credencial inválida.');
  const hash = requestHash({ kind: 'content', projectId: id, baseVersion: base, patch: input.patch });
  await getAccountProject(owner, id);
  return getPostgresConnection().begin(async tx => {
    await forgetExpiredVisualJobs(tx, owner);
    const row = await lockAccountAndProject(tx, owner, id);
    const existing = await tx.unsafe(
      `SELECT * FROM moont.agent_visual_jobs WHERE owner_id = $1 AND request_id = $2`, [owner, rid],
    );
    if (existing[0]) {
      if (existing[0].request_hash !== hash || existing[0].project_id !== id) {
        fail(409, 'content_request_reused', 'requestId já usado para outra alteração.');
      }
      return safeJob(existing[0]);
    }
    const currentVersion = Number(row.version);
    if (currentVersion !== base) {
      fail(409, 'project_conflict', 'O projeto mudou na nuvem.', { cloudVersion: currentVersion });
    }
    const result = applyContentPatchToEntry(row.entry, input.patch);
    const changed = result.changedSlideCount > 0 || Object.keys(result.projectChanges).length > 0;
    const afterVersion = changed
      ? await updateProject(tx, owner, id, result.entry, currentVersion, Date.now())
      : currentVersion;
    const changedFields = [
      ...Object.keys(result.projectChanges),
      ...new Set(result.changes.flatMap(change => Object.keys(change.fields))),
    ];
    const jobs = await tx.unsafe(
      `INSERT INTO moont.agent_visual_jobs
       (owner_id, request_id, project_id, token_id, request_hash, before_version,
        after_version, changed_slide_count, changed_brand_fields, before_entry)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
       RETURNING request_id, project_id, status, before_version, after_version,
         changed_slide_count, changed_brand_fields, created_at, undone_at,
         undo_request_id, undo_version`,
      [owner, rid, id, tokenId, hash, currentVersion, afterVersion,
        result.changedSlideCount, JSON.stringify(changedFields), JSON.stringify(snapshotForUndo(row.entry))],
    );
    return safeJob(jobs[0]);
  });
}

export async function applyAgentImageEdit(ownerValue, tokenId, input) {
  const owner = ownerId(ownerValue);
  const id = projectId(input?.projectId);
  const base = version(input?.baseVersion);
  const rid = requestId(input?.requestId);
  const slideId = String(input?.slideId || '').trim();
  const assetId = String(input?.assetId || '').trim();
  if (!slideId || slideId.length > 200) fail(400, 'image_slide_id_invalid', 'ID do card inválido.');
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(assetId)) fail(400, 'image_asset_id_invalid', 'Asset de imagem inválido.');
  if (typeof tokenId !== 'string' || !tokenId) fail(401, 'agent_token_invalid', 'Credencial inválida.');
  const hash = requestHash({ kind: 'image', projectId: id, baseVersion: base, slideId, assetId });
  await getAccountProject(owner, id);
  return getPostgresConnection().begin(async tx => {
    await forgetExpiredVisualJobs(tx, owner);
    const row = await lockAccountAndProject(tx, owner, id);
    const existing = await tx.unsafe(
      `SELECT * FROM moont.agent_visual_jobs WHERE owner_id = $1 AND request_id = $2`, [owner, rid],
    );
    if (existing[0]) {
      if (existing[0].request_hash !== hash || existing[0].project_id !== id) {
        fail(409, 'image_request_reused', 'requestId já usado para outra imagem.');
      }
      return safeJob(existing[0]);
    }
    const currentVersion = Number(row.version);
    if (currentVersion !== base) fail(409, 'project_conflict', 'O projeto mudou na nuvem.', { cloudVersion: currentVersion });
    const slides = Array.isArray(row.entry?.doc?.slides) ? row.entry.doc.slides : [];
    let found = false;
    const nextSlides = slides.map(slide => {
      if (slide?.id !== slideId) return slide;
      found = true;
      const next = { ...slide, bgImageAssetId: assetId, bgImageSource: 'ai', bgImageFailed: false, bgImageError: null,
        imgMode: 'dalle', bgFit: 'cover', bgX: 50, bgY: 50, bgZoom: 100 };
      delete next.bgImage;
      delete next.bgImageId;
      return next;
    });
    if (!found) fail(404, 'image_slide_missing', 'Card não encontrado neste projeto.');
    const nextEntry = { ...row.entry, doc: { ...row.entry.doc, slides: nextSlides } };
    const afterVersion = await updateProject(tx, owner, id, nextEntry, currentVersion, Date.now());
    const jobs = await tx.unsafe(
      `INSERT INTO moont.agent_visual_jobs
       (owner_id, request_id, project_id, token_id, request_hash, before_version,
        after_version, changed_slide_count, changed_brand_fields, before_entry)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8::jsonb, $9::jsonb)
       RETURNING request_id, project_id, status, before_version, after_version,
         changed_slide_count, changed_brand_fields, created_at, undone_at,
         undo_request_id, undo_version`,
      [owner, rid, id, tokenId, hash, currentVersion, afterVersion,
        JSON.stringify([`image:${slideId}`]), JSON.stringify(snapshotForUndo(row.entry))],
    );
    return safeJob(jobs[0]);
  });
}

export async function undoAgentVisualBatch(ownerValue, input) {
  const owner = ownerId(ownerValue);
  const rid = requestId(input?.requestId);
  const undoId = requestId(input?.undoRequestId);
  if (rid === undoId) fail(400, 'visual_undo_id_invalid', 'Use outro ID para desfazer.');
  const found = await getAgentVisualJob(owner, rid);
  await getAccountProject(owner, found.projectId); // ensure account migration
  return getPostgresConnection().begin(async tx => {
    await forgetExpiredVisualJobs(tx, owner);
    const row = await lockAccountAndProject(tx, owner, found.projectId);
    const priorUndo = await tx.unsafe(
      `SELECT request_id FROM moont.agent_visual_jobs
       WHERE owner_id = $1 AND undo_request_id = $2`, [owner, undoId],
    );
    if (priorUndo[0] && priorUndo[0].request_id !== rid) {
      fail(409, 'visual_undo_request_reused', 'undoRequestId já usado para outra alteração.');
    }
    const jobs = await tx.unsafe(
      `SELECT * FROM moont.agent_visual_jobs WHERE owner_id = $1 AND request_id = $2 FOR UPDATE`,
      [owner, rid],
    );
    const job = jobs[0];
    if (!job) fail(410, 'visual_undo_expired', 'O prazo de 30 dias para desfazer esta alteração acabou.');
    if (job.status === 'undone') {
      if (job.undo_request_id !== undoId) fail(409, 'visual_already_undone', 'Esta alteração já foi desfeita.');
      return safeJob(job);
    }
    const currentVersion = Number(row.version);
    if (currentVersion !== Number(job.after_version)) {
      fail(409, 'project_conflict', 'O projeto foi editado depois dessa alteração; não é seguro desfazê-la automaticamente.',
        { cloudVersion: currentVersion });
    }
    const changed = Number(job.after_version) !== Number(job.before_version);
    const undoVersion = changed
      ? await updateProject(tx, owner, found.projectId, job.before_entry, currentVersion, Date.now())
      : currentVersion;
    const updated = await tx.unsafe(
      `UPDATE moont.agent_visual_jobs SET status = 'undone', undone_at = now(),
         undo_request_id = $3, undo_version = $4
       WHERE owner_id = $1 AND request_id = $2
       RETURNING request_id, project_id, status, before_version, after_version,
         changed_slide_count, changed_brand_fields, created_at, undone_at,
         undo_request_id, undo_version`,
      [owner, rid, undoId, undoVersion],
    );
    return safeJob(updated[0]);
  });
}
