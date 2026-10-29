/**
 * Geração de imagens para cards via MCP, como job assíncrono.
 *
 * Reaproveita o pipeline do editor: mesma fila SJinn (GPT Image 2, 1K), mesma
 * quota do plano (reserva → confirma no sucesso, devolve na falha) e o mesmo
 * armazenamento de originais que o navegador usa para sincronizar fotos.
 *
 * A chamada reserva um crédito por card, registra o job `pending` e devolve na
 * hora. A geração segue em `waitUntil`; `get_change_status(requestId)` mostra o
 * estado por card e a versão nova ao concluir.
 */
import { createHash } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { findActiveSubscription } from './stripe.js';
import { resolveTierFromSubscription, imageQuotaForTier, periodBoundsFromSubscription } from './plans.js';
import { consumeImageCredit, refundImageCredit, settleImageCredit, getQuotaUsage } from './image-quota.js';
import {
  isSjinnConfigured, createGptImage2Task, waitForSjinnTask, downloadImageAsBase64,
  extractSjinnOutputUrl, SJINN_DEADLINE_MS,
} from './sjinn.js';
import { putLibraryAsset, putLibraryAssetChunk, ASSET_CHUNK_CHARS } from './library-sync-store.js';
import { getAccountProject } from './library-sync-postgres.js';
import {
  createAgentImageJob, expireAgentImageJob, finishAgentImageJob, getAgentVisualJob,
  isImageJobStale, selectImageSlides,
} from './agent-visual-batch.js';

/** Abaixo do `maxDuration` de 300 s com folga para gravar o resultado. */
export const IMAGE_JOB_DEADLINE_MS = 265_000;
const IMAGE_CONCURRENCY = 4;

function fail(status, code, message, extra = {}) {
  throw Object.assign(new Error(message), { status, code, ...extra });
}

/** Mesma regra do editor; o SJinn não aceita 4:5, então feed cai em 2:3. */
export function imageAspectRatio(doc) {
  const format = String(doc?.format || doc?.formatId || '').toLowerCase();
  if (format.includes('apresent') || format === '16:9') return '16:9';
  if (format.includes('storie') || format === '9:16') return '9:16';
  if (format.includes('quadr') || format === '1:1') return '1:1';
  return '2:3';
}

/** Chave válida nos dois backends de quota (Postgres aceita `:`; o legado não). */
export function imageOperationId(requestId, slideId) {
  const digest = createHash('sha256').update(`${requestId}\n${slideId}`).digest('hex');
  return `mcp_${digest.slice(0, 56)}`;
}

/** Mesmo identificador e mesmo protocolo de partes que o navegador usa ao sincronizar. */
export async function storeGeneratedAsset(ownerId, dataUrl) {
  const hash = createHash('sha256').update(dataUrl, 'utf8').digest('hex');
  if (dataUrl.length <= ASSET_CHUNK_CHARS) {
    const assetId = `original_${hash}`;
    await putLibraryAsset(ownerId, assetId, { dataUrl });
    return assetId;
  }
  const assetId = `original_chunks_${hash}`;
  const total = Math.ceil(dataUrl.length / ASSET_CHUNK_CHARS);
  for (let index = 0; index < total; index += 1) {
    const saved = await putLibraryAssetChunk(ownerId, assetId, {
      index, total, totalChars: dataUrl.length,
      data: dataUrl.slice(index * ASSET_CHUNK_CHARS, (index + 1) * ASSET_CHUNK_CHARS),
    });
    if (index === total - 1 && saved?.complete !== true) {
      throw Object.assign(new Error('A nuvem não confirmou o envio completo da imagem.'), { code: 'image_asset_incomplete' });
    }
  }
  return assetId;
}

async function quotaContext(ownerId) {
  const sub = await findActiveSubscription(ownerId).catch(() => null);
  if (!sub) fail(402, 'subscription_inactive', 'Assinatura inativa.');
  const tier = resolveTierFromSubscription(sub);
  const limit = imageQuotaForTier(tier);
  if (limit <= 0) fail(402, 'plan_no_images', 'Seu plano não inclui geração de imagens.');
  const { periodStartSec, periodEndSec } = periodBoundsFromSubscription(sub);
  if (!periodStartSec || !periodEndSec) {
    fail(503, 'quota_period_unavailable', 'Não foi possível confirmar o período da assinatura. Nenhum crédito foi usado.');
  }
  return { tier, limit, periodStartSec, periodEndSec };
}

async function refundAll(ownerId, periodStartSec, operationIds) {
  await Promise.all(operationIds.map(operationId => refundImageCredit({ customerId: ownerId, periodStartSec, operationId })
    .catch(error => console.error('[agent-image] refund', operationId, error?.message || error))));
}

async function reserveCredits(ownerId, quota, slides) {
  const reserved = [];
  let last = null;
  for (const slide of slides) {
    let consumed;
    try {
      consumed = await consumeImageCredit({
        customerId: ownerId, periodStartSec: quota.periodStartSec, periodEndSec: quota.periodEndSec,
        limit: quota.limit, operationId: slide.operationId,
      });
    } catch (error) {
      await refundAll(ownerId, quota.periodStartSec, reserved);
      fail(503, 'quota_store_error', 'Não foi possível reservar o crédito de imagem. Nenhum crédito foi usado.',
        { cause: error?.code });
    }
    // Uma reserva repetida vem de uma tentativa anterior que caiu antes de
    // registrar o job: o crédito já é desta operação e continua válido.
    if (!consumed.allowed && !consumed.replayed) {
      await refundAll(ownerId, quota.periodStartSec, reserved);
      fail(402, 'quota_exhausted', 'Quota de imagens insuficiente para este job. Nenhum crédito foi usado.',
        { needed: slides.length, remaining: consumed.remaining ?? 0, limit: quota.limit });
    }
    reserved.push(slide.operationId);
    last = consumed;
  }
  return { reserved, quota: { used: last?.used ?? null, limit: quota.limit, remaining: last?.remaining ?? null, tier: quota.tier } };
}

async function generateOne(ownerId, slide, aspectRatio, deadlineAt) {
  const remaining = deadlineAt - Date.now();
  if (remaining < 5_000) return { slideId: slide.slideId, errorCode: 'image_job_timeout' };
  try {
    const taskId = await createGptImage2Task({ prompt: slide.imageQuery, aspectRatio, resolution: '1K', imageList: [] });
    const data = await waitForSjinnTask(taskId, { deadlineMs: Math.min(SJINN_DEADLINE_MS, deadlineAt - Date.now()) });
    const url = extractSjinnOutputUrl(data);
    if (!url) return { slideId: slide.slideId, errorCode: 'image_result_missing' };
    const { b64_json, mime = 'image/png' } = await downloadImageAsBase64(url);
    const assetId = await storeGeneratedAsset(ownerId, `data:${mime};base64,${b64_json}`);
    return { slideId: slide.slideId, assetId, taskId };
  } catch (error) {
    console.error('[agent-image] slide', slide.slideId, error?.code || '', error?.message || error);
    return { slideId: slide.slideId, errorCode: typeof error?.code === 'string' ? error.code : 'image_generation_failed' };
  }
}

async function mapWithConcurrency(items, limit, work) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Liquida os créditos conforme o estado final de cada card. */
async function settleCredits(ownerId, periodStartSec, slides) {
  await Promise.all(slides.map(async slide => {
    if (!slide.operationId) return;
    try {
      if (slide.status === 'done') await settleImageCredit({ customerId: ownerId, periodStartSec, operationId: slide.operationId });
      else if (slide.status === 'failed') await refundImageCredit({ customerId: ownerId, periodStartSec, operationId: slide.operationId });
    } catch (error) {
      console.error('[agent-image] settle', slide.operationId, error?.message || error);
    }
  }));
}

export async function runAgentImageJob({ ownerId, requestId, slides, aspectRatio, periodStartSec, deadlineAt }) {
  const deadline = deadlineAt || Date.now() + IMAGE_JOB_DEADLINE_MS;
  const outcomes = await mapWithConcurrency(slides, IMAGE_CONCURRENCY,
    slide => generateOne(ownerId, slide, aspectRatio, deadline));
  let finished;
  try {
    finished = await finishAgentImageJob(ownerId, requestId, outcomes);
  } catch (error) {
    // O job fica `pending` até o leitor marcá-lo expirado e devolver os créditos.
    console.error('[agent-image] finish', requestId, error?.code || '', error?.message || error);
    return null;
  }
  if (finished.finished) await settleCredits(ownerId, periodStartSec, finished.slides);
  return finished.job;
}

function defaultSchedule(promise) {
  // Fora da Vercel não há contexto de requisição; a promessa segue no processo.
  waitUntil(promise.catch(error => console.error('[agent-image] job', error?.message || error)));
}

/**
 * Entrada da ferramenta `generate_slide_image`. Valida, reserva créditos,
 * registra o job e agenda a geração. Repetir o requestId devolve o job atual
 * sem reservar nem gerar de novo.
 */
export async function startAgentImageJob(ownerId, tokenId, input, { schedule = defaultSchedule } = {}) {
  const requestId = String(input?.requestId || '');
  let existing = null;
  try { existing = await getAgentVisualJob(ownerId, requestId); }
  catch (error) { if (error?.code !== 'visual_job_not_found') throw error; }
  if (existing) {
    const requested = Array.isArray(input?.slideIds) ? [...new Set(input.slideIds.map(String))].sort() : null;
    const recorded = (existing.slides || []).map(slide => slide.slideId).sort();
    const sameSelection = !requested || JSON.stringify(requested) === JSON.stringify(recorded);
    if (existing.kind !== 'image' || existing.projectId !== input?.projectId || !sameSelection) {
      fail(409, 'image_request_reused', 'requestId já usado para outra alteração.');
    }
    return getAgentChangeStatus(ownerId, requestId);
  }

  if (!isSjinnConfigured()) fail(503, 'sjinn_unconfigured', 'Geração de imagem indisponível no momento.');
  const project = await getAccountProject(ownerId, String(input?.projectId || ''));
  if (!project || project.deleted) fail(404, 'visual_project_not_found', 'Projeto não encontrado.');
  if (project.version !== input?.baseVersion) {
    fail(409, 'project_conflict', 'O projeto mudou na nuvem.', { cloudVersion: project.version });
  }
  const selected = selectImageSlides(project.entry, input?.slideIds);
  const slides = selected.map(slide => ({ ...slide, operationId: imageOperationId(requestId, slide.slideId) }));

  const quota = await quotaContext(ownerId);
  const usage = await getQuotaUsage({ customerId: ownerId, periodStartSec: quota.periodStartSec,
    periodEndSec: quota.periodEndSec, limit: quota.limit })
    .catch(() => fail(503, 'quota_store_error', 'Não foi possível consultar a quota de imagens. Nenhum crédito foi usado.'));
  if (usage.remaining < slides.length) {
    fail(402, 'quota_exhausted', 'Quota de imagens insuficiente para este job. Nenhum crédito foi usado.',
      { needed: slides.length, remaining: usage.remaining, limit: usage.limit });
  }
  const { reserved, quota: balance } = await reserveCredits(ownerId, quota, slides);

  const aspectRatio = imageAspectRatio(project.entry?.doc);
  let created;
  try {
    created = await createAgentImageJob(ownerId, tokenId, {
      projectId: project.id, baseVersion: project.version, requestId, slideIds: input?.slideIds,
      slides, meta: { aspectRatio, periodStartSec: quota.periodStartSec, tier: quota.tier },
    });
  } catch (error) {
    await refundAll(ownerId, quota.periodStartSec, reserved);
    throw error;
  }
  if (created.existing) {
    // Corrida com outra chamada igual: o job dela vale; os créditos desta voltam.
    await refundAll(ownerId, quota.periodStartSec, reserved);
    return getAgentChangeStatus(ownerId, requestId);
  }
  schedule(runAgentImageJob({
    ownerId, requestId, slides, aspectRatio, periodStartSec: quota.periodStartSec,
    deadlineAt: Date.now() + IMAGE_JOB_DEADLINE_MS,
  }));
  return { ...created.job, creditsReserved: reserved.length, quota: balance,
    note: 'Geração em andamento. Consulte get_change_status com este requestId até status deixar de ser pending.' };
}

/** `get_change_status`: igual ao job normal, mas expira um job de imagem travado. */
export async function getAgentChangeStatus(ownerId, requestId) {
  const job = await getAgentVisualJob(ownerId, requestId);
  if (!isImageJobStale(job)) return job;
  const expired = await expireAgentImageJob(ownerId, requestId);
  if (expired.expired) {
    const periodStartSec = Number(expired.meta?.periodStartSec);
    if (periodStartSec > 0) await settleCredits(ownerId, periodStartSec, expired.slides);
  }
  return expired.job;
}
