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

/** Colunas devolvidas ao agente. `before_entry`, `token_id` e `request_hash` ficam privados. */
const JOB_COLUMNS = `request_id, project_id, status, before_version, after_version,
         changed_slide_count, changed_brand_fields, created_at, undone_at,
         undo_request_id, undo_version, slides, meta, error_code, finished_at`;
export const IMAGE_JOB_POLL_MS = 30_000;

function publicSlideState(slide) {
  if (!slide || typeof slide !== 'object') return null;
  return {
    slideId: slide.slideId,
    status: slide.status,
    ...(slide.errorCode ? { errorCode: slide.errorCode } : {}),
    ...(slide.assetId ? { assetId: slide.assetId } : {}),
  };
}

function safeJob(row) {
  if (!row) return null;
  const slides = Array.isArray(row.slides) ? row.slides.map(publicSlideState).filter(Boolean) : [];
  const pending = row.status === 'pending';
  return {
    requestId: row.request_id,
    projectId: row.project_id,
    status: row.status,
    beforeVersion: Number(row.before_version),
    afterVersion: pending ? null : Number(row.after_version),
    changedSlideCount: Number(row.changed_slide_count),
    changedBrandFields: row.changed_brand_fields || [],
    createdAt: row.created_at,
    undoneAt: row.undone_at || null,
    undoRequestId: row.undo_request_id || null,
    undoVersion: row.undo_version == null ? null : Number(row.undo_version),
    ...(row.meta?.kind ? { kind: row.meta.kind } : {}),
    ...(slides.length ? { slides } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    ...(row.finished_at ? { finishedAt: row.finished_at } : {}),
    ...(pending ? { pollAfterMs: IMAGE_JOB_POLL_MS } : {}),
  };
}

/** Estado interno do job, com os identificadores de crédito que o agente não vê. */
function internalJob(row) {
  return {
    job: safeJob(row),
    slides: Array.isArray(row.slides) ? row.slides : [],
    meta: row.meta && typeof row.meta === 'object' ? row.meta : {},
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
    `SELECT ${JOB_COLUMNS}
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
       RETURNING ${JOB_COLUMNS}`,
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
       RETURNING ${JOB_COLUMNS}`,
      [owner, rid, id, tokenId, hash, currentVersion, afterVersion,
        result.changedSlideCount, JSON.stringify(changedFields), JSON.stringify(snapshotForUndo(row.entry))],
    );
    return safeJob(jobs[0]);
  });
}

const MAX_IMAGE_SLIDES = 8;
const IMAGE_JOB_STALE_MS = 12 * 60_000;

export function slideHasPhoto(slide) {
  return Boolean(slide?.bgImageAssetId || slide?.bgImageId || slide?.bgImage);
}

/** Mesmo conjunto de campos que o editor grava após gerar uma imagem. */
function withGeneratedImage(slide, assetId) {
  const next = {
    ...slide, bgImageAssetId: assetId, bgImageSource: 'ai', bgImageFailed: false, bgImageError: null,
    imgMode: 'dalle', bgFit: 'cover', bgX: 50, bgY: 50, bgZoom: 100,
  };
  delete next.bgImage;
  delete next.bgImageId;
  return next;
}

function imageSlideIds(value) {
  if (value == null) return null;
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim() || item.length > 200)) {
    fail(400, 'image_slide_ids_invalid', 'slideIds deve ser uma lista de IDs de card.');
  }
  const ids = [...new Set(value.map(item => item.trim()))];
  if (!ids.length) fail(400, 'image_slide_ids_invalid', 'slideIds não pode ser vazio.');
  return ids;
}

/**
 * Escolhe os cards que vão receber imagem. Sem `slideIds`, todos os cards sem
 * foto. Recusa cards inexistentes, com foto, ou sem `imageQuery` utilizável.
 */
export function selectImageSlides(entry, slideIdsValue) {
  const requested = imageSlideIds(slideIdsValue);
  const slides = Array.isArray(entry?.doc?.slides) ? entry.doc.slides : [];
  let chosen;
  if (requested) {
    const byId = new Map(slides.filter(slide => slide?.id).map(slide => [slide.id, slide]));
    const missing = requested.filter(id => !byId.has(id));
    if (missing.length) fail(404, 'image_slide_missing', 'Card não encontrado neste projeto.', { slideIds: missing });
    chosen = requested.map(id => byId.get(id));
  } else {
    chosen = slides.filter(slide => slide?.id && !slideHasPhoto(slide));
  }
  const withPhoto = chosen.filter(slideHasPhoto).map(slide => slide.id);
  if (withPhoto.length) {
    fail(409, 'image_already_present', 'Estes cards já possuem imagem.', { slideIds: withPhoto });
  }
  const withoutQuery = chosen.filter(slide => String(slide.imageQuery || '').trim().length < 8).map(slide => slide.id);
  if (withoutQuery.length) {
    fail(422, 'image_query_missing', 'Estes cards não têm imageQuery utilizável. Edite a imageQuery com apply_text_edit antes de gerar.',
      { slideIds: withoutQuery });
  }
  if (!chosen.length) fail(409, 'image_nothing_to_generate', 'Nenhum card sem imagem neste projeto.');
  if (chosen.length > MAX_IMAGE_SLIDES) {
    fail(400, 'image_too_many_slides', `No máximo ${MAX_IMAGE_SLIDES} cards por chamada. Repita com outro requestId para os demais.`,
      { max: MAX_IMAGE_SLIDES, slideIds: chosen.map(slide => slide.id) });
  }
  return chosen.map(slide => ({ slideId: slide.id, imageQuery: String(slide.imageQuery).trim().slice(0, 4000) }));
}

export function imageJobHash({ projectId: id, baseVersion: base, slideIds }) {
  return requestHash({ kind: 'image', projectId: id, baseVersion: base, slideIds: slideIds ?? null });
}

/**
 * Registra o job de imagem como `pending` com CAS na versão do projeto. Os
 * créditos já foram reservados pelo chamador, que devolve tudo se isto falhar.
 * Repetir o mesmo requestId devolve o job existente sem reservar de novo.
 */
export async function createAgentImageJob(ownerValue, tokenId, input) {
  const owner = ownerId(ownerValue);
  const id = projectId(input?.projectId);
  const base = version(input?.baseVersion);
  const rid = requestId(input?.requestId);
  if (typeof tokenId !== 'string' || !tokenId) fail(401, 'agent_token_invalid', 'Credencial inválida.');
  const slides = Array.isArray(input?.slides) ? input.slides : [];
  if (!slides.length || slides.some(slide => !slide?.slideId || !slide?.operationId)) {
    fail(400, 'image_slide_ids_invalid', 'Cards do job inválidos.');
  }
  const hash = imageJobHash({ projectId: id, baseVersion: base, slideIds: input?.slideIds });
  const meta = { kind: 'image', ...(input?.meta || {}) };
  await getAccountProject(owner, id);
  return getPostgresConnection().begin(async tx => {
    await forgetExpiredVisualJobs(tx, owner);
    const row = await lockAccountAndProject(tx, owner, id);
    const existing = await tx.unsafe(
      `SELECT * FROM moont.agent_visual_jobs WHERE owner_id = $1 AND request_id = $2`, [owner, rid],
    );
    if (existing[0]) {
      if (existing[0].request_hash !== hash || existing[0].project_id !== id) {
        fail(409, 'image_request_reused', 'requestId já usado para outra alteração.');
      }
      return { ...internalJob(existing[0]), existing: true };
    }
    const currentVersion = Number(row.version);
    if (currentVersion !== base) fail(409, 'project_conflict', 'O projeto mudou na nuvem.', { cloudVersion: currentVersion });
    const current = new Map((row.entry?.doc?.slides || []).filter(slide => slide?.id).map(slide => [slide.id, slide]));
    const missing = slides.filter(slide => !current.has(slide.slideId)).map(slide => slide.slideId);
    if (missing.length) fail(404, 'image_slide_missing', 'Card não encontrado neste projeto.', { slideIds: missing });
    const withPhoto = slides.filter(slide => slideHasPhoto(current.get(slide.slideId))).map(slide => slide.slideId);
    if (withPhoto.length) fail(409, 'image_already_present', 'Estes cards já possuem imagem.', { slideIds: withPhoto });
    const state = slides.map(slide => ({ slideId: slide.slideId, status: 'pending', operationId: slide.operationId }));
    const jobs = await tx.unsafe(
      `INSERT INTO moont.agent_visual_jobs
       (owner_id, request_id, project_id, token_id, request_hash, before_version,
        after_version, changed_slide_count, changed_brand_fields, before_entry, status, slides, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $6, 0, '[]'::jsonb, $7::jsonb, 'pending', $8::jsonb, $9::jsonb)
       RETURNING ${JOB_COLUMNS}`,
      [owner, rid, id, tokenId, hash, currentVersion, JSON.stringify(snapshotForUndo(row.entry)),
        JSON.stringify(state), JSON.stringify(meta)],
    );
    return { ...internalJob(jobs[0]), existing: false };
  });
}

function mergeOutcomes(slides, outcomes, fallbackError) {
  const byId = new Map((outcomes || []).map(item => [item.slideId, item]));
  return slides.map(slide => {
    if (slide.status !== 'pending') return slide;
    const outcome = byId.get(slide.slideId);
    if (outcome?.assetId) return { ...slide, status: 'done', assetId: outcome.assetId };
    return { ...slide, status: 'failed', errorCode: outcome?.errorCode || fallbackError };
  });
}

async function settleImageJob(tx, owner, rid, { status, afterVersion, slides, errorCode }) {
  const done = slides.filter(slide => slide.status === 'done');
  const updated = await tx.unsafe(
    `UPDATE moont.agent_visual_jobs
     SET status = $3, after_version = $4, changed_slide_count = $5, changed_brand_fields = $6::jsonb,
         slides = $7::jsonb, error_code = $8, finished_at = now()
     WHERE owner_id = $1 AND request_id = $2
     RETURNING ${JOB_COLUMNS}`,
    [owner, rid, status, afterVersion, done.length, JSON.stringify(done.map(slide => `image:${slide.slideId}`)),
      JSON.stringify(slides), errorCode || null],
  );
  return internalJob(updated[0]);
}

/**
 * Fecha o job com os resultados por card. Grava as imagens prontas numa única
 * versão nova se o projeto ainda estiver na versão base; caso contrário tudo
 * falha com `project_conflict`. Devolve o estado interno para o chamador
 * confirmar ou devolver cada crédito.
 */
export async function finishAgentImageJob(ownerValue, requestIdValue, outcomes) {
  const owner = ownerId(ownerValue);
  const rid = requestId(requestIdValue);
  const found = await getAgentVisualJob(owner, rid);
  await getAccountProject(owner, found.projectId);
  return getPostgresConnection().begin(async tx => {
    const row = await lockAccountAndProject(tx, owner, found.projectId);
    const jobs = await tx.unsafe(
      `SELECT * FROM moont.agent_visual_jobs WHERE owner_id = $1 AND request_id = $2 FOR UPDATE`, [owner, rid],
    );
    const job = jobs[0];
    if (!job) fail(404, 'visual_job_not_found', 'Alteração não encontrada.');
    if (job.status !== 'pending') return { ...internalJob(job), finished: false };
    const currentVersion = Number(row.version);
    const base = Number(job.before_version);
    const slides = Array.isArray(job.slides) ? job.slides : [];
    if (currentVersion !== base) {
      const failed = slides.map(slide => (slide.status === 'pending'
        ? { ...slide, status: 'failed', errorCode: 'project_conflict' } : slide));
      return { ...await settleImageJob(tx, owner, rid, { status: 'failed', afterVersion: base, slides: failed,
        errorCode: 'project_conflict' }), finished: true };
    }
    const merged = mergeOutcomes(slides, outcomes, 'image_generation_failed');
    const assets = new Map(merged.filter(slide => slide.status === 'done').map(slide => [slide.slideId, slide.assetId]));
    let afterVersion = currentVersion;
    if (assets.size) {
      const nextSlides = (row.entry?.doc?.slides || []).map(slide => (assets.has(slide?.id)
        ? withGeneratedImage(slide, assets.get(slide.id)) : slide));
      const nextEntry = { ...row.entry, doc: { ...row.entry.doc, slides: nextSlides } };
      afterVersion = await updateProject(tx, owner, found.projectId, nextEntry, currentVersion, Date.now());
    }
    return { ...await settleImageJob(tx, owner, rid, {
      status: assets.size ? 'applied' : 'failed', afterVersion, slides: merged,
      errorCode: assets.size ? null : 'image_generation_failed',
    }), finished: true };
  });
}

export function isImageJobStale(job, now = Date.now()) {
  if (job?.status !== 'pending') return false;
  const createdAt = new Date(job.createdAt).getTime();
  return Number.isFinite(createdAt) && now - createdAt > IMAGE_JOB_STALE_MS;
}

/** Marca como `failed` um job `pending` que a função não conseguiu concluir. */
export async function expireAgentImageJob(ownerValue, requestIdValue) {
  const owner = ownerId(ownerValue);
  const rid = requestId(requestIdValue);
  return getPostgresConnection().begin(async tx => {
    const jobs = await tx.unsafe(
      `SELECT * FROM moont.agent_visual_jobs WHERE owner_id = $1 AND request_id = $2 FOR UPDATE`, [owner, rid],
    );
    const job = jobs[0];
    if (!job) fail(404, 'visual_job_not_found', 'Alteração não encontrada.');
    if (!isImageJobStale(safeJob(job))) return { ...internalJob(job), expired: false };
    const slides = mergeOutcomes(Array.isArray(job.slides) ? job.slides : [], [], 'image_job_timeout');
    return { ...await settleImageJob(tx, owner, rid, { status: 'failed', afterVersion: Number(job.before_version),
      slides, errorCode: 'image_job_timeout' }), expired: true };
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
    if (job.status === 'pending') fail(409, 'visual_job_pending', 'Esta geração ainda está em andamento; aguarde a conclusão.');
    if (job.status === 'failed') fail(409, 'visual_undo_not_applicable', 'Esta alteração falhou e não mudou o projeto.');
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
       RETURNING ${JOB_COLUMNS}`,
      [owner, rid, undoId, undoVersion],
    );
    return safeJob(updated[0]);
  });
}
