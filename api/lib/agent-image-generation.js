/**
 * Geração de imagens para cards via MCP, como job assíncrono.
 *
 * Reaproveita o pipeline do editor: mesma fila SJinn (GPT Image 2, 1K), mesma
 * quota do plano (reserva → confirma no sucesso, devolve na falha) e o mesmo
 * armazenamento de originais que o navegador usa para sincronizar fotos.
 *
 * A chamada registra um placeholder único por requestId, reserva um crédito
 * por card e devolve na hora. A geração segue em `waitUntil`;
 * `get_change_status(requestId)` mostra o
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
  createAgentImageJob, expireAgentImageJob, finishAgentImageJob, getAgentVisualJobInternal,
  imageJobHash, isImageJobStale, listAgentImageJobsForSettlement,
  markAgentImageJobCreditsSettled, selectImageSlides,
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
  const results = await Promise.all(operationIds.map(async operationId => {
    try {
      await refundImageCredit({ customerId: ownerId, periodStartSec, operationId });
      return null;
    } catch (error) {
      console.error('[agent-image] refund', operationId, error?.message || error);
      return operationId;
    }
  }));
  return results.filter(Boolean);
}

async function reserveCredits(ownerId, quota, slides) {
  const reserved = [];
  const ownedReservations = [];
  let last = null;
  for (const slide of slides) {
    let consumed;
    try {
      consumed = await consumeImageCredit({
        customerId: ownerId, periodStartSec: quota.periodStartSec, periodEndSec: quota.periodEndSec,
        limit: quota.limit, operationId: slide.operationId,
      });
    } catch (error) {
      // A conexão pode cair depois de o backend confirmar a reserva. Inclua a
      // operação corrente na compensação: refund por operationId ausente é
      // no-op, e por operationId confirmado é idempotente.
      const uncertainReservations = [...new Set([...ownedReservations, slide.operationId])];
      await refundAll(ownerId, quota.periodStartSec, uncertainReservations);
      fail(503, 'quota_store_error', 'Não foi possível reservar o crédito de imagem. Nenhum crédito foi usado.',
        { cause: error?.code, ownedReservations:uncertainReservations });
    }
    // Só uma reserva ainda aberta pode pertencer a uma chamada concorrente do
    // mesmo requestId. Operações já liquidadas ou reembolsadas estão fechadas:
    // reutilizá-las criaria uma imagem sem nova cobrança.
    if (consumed.replayed && consumed.reason !== 'already_reserved') {
      await refundAll(ownerId, quota.periodStartSec, ownedReservations);
      fail(409, 'image_request_closed',
        'Este requestId já foi encerrado. Gere um novo requestId para tentar novamente.',
        { ownedReservations:[...ownedReservations] });
    }
    if (!consumed.allowed && !consumed.replayed) {
      await refundAll(ownerId, quota.periodStartSec, ownedReservations);
      fail(402, 'quota_exhausted', 'Quota de imagens insuficiente para este job. Nenhum crédito foi usado.',
        { needed: slides.length, remaining: consumed.remaining ?? 0, limit: quota.limit,
          ownedReservations:[...ownedReservations] });
    }
    reserved.push(slide.operationId);
    // `already_reserved` significa que outra chamada abriu a mesma reserva.
    // Ela pode ser reutilizada pelo requestId, mas nunca pertence a esta
    // chamada para fins de reembolso: numa corrida, devolver esse crédito
    // cancelaria a cobrança do job vencedor.
    if (consumed.allowed === true && consumed.replayed !== true) {
      ownedReservations.push(slide.operationId);
    }
    last = consumed;
  }
  return {
    reserved,
    ownedReservations,
    quota: { used: last?.used ?? null, limit: quota.limit, remaining: last?.remaining ?? null, tier: quota.tier },
  };
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
  const results = await Promise.all(slides.map(async slide => {
    if (!slide.operationId || slide.creditReserved === false) return true;
    try {
      if (slide.status === 'done') await settleImageCredit({ customerId: ownerId, periodStartSec, operationId: slide.operationId });
      else if (slide.status === 'failed') await refundImageCredit({ customerId: ownerId, periodStartSec, operationId: slide.operationId });
      return true;
    } catch (error) {
      console.error('[agent-image] settle', slide.operationId, error?.message || error);
      return false;
    }
  }));
  return results.every(Boolean);
}

async function settleTerminalState(ownerId, requestId, state, fallbackPeriodStartSec = 0) {
  if (state?.job?.status === 'pending') return false;
  if (state?.meta?.creditsSettled === true || state?.meta?.creditsSettled === 'true') return true;
  const periodStartSec = Number(state?.meta?.periodStartSec || fallbackPeriodStartSec);
  if (!(periodStartSec > 0)) return false;
  if (!await settleCredits(ownerId, periodStartSec, state?.slides || [])) return false;
  try {
    return await markAgentImageJobCreditsSettled(ownerId, requestId);
  } catch (error) {
    // A quota já foi liquidada, mas o marcador não. A próxima passagem
    // repete operações idempotentes e tenta persistir o marcador novamente.
    console.error('[agent-image] settlement marker', requestId, error?.message || error);
    return false;
  }
}

const settlementDelay = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Reconsulta o estado terminal e repete operações idempotentes de quota. */
async function retryTerminalSettlement(ownerId, requestId, attempts = 4, finishOutcomes = null) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      let state = await getAgentVisualJobInternal(ownerId, requestId);
      if (state.job?.status === 'pending') {
        if (!Array.isArray(finishOutcomes)) return false;
        const closed = await finishAgentImageJob(ownerId, requestId, finishOutcomes);
        state = closed?.job?.status && closed.job.status !== 'pending'
          ? closed
          : await getAgentVisualJobInternal(ownerId, requestId);
      }
      if (state.job?.status === 'pending') throw new Error('job ainda pendente');
      if (await settleTerminalState(ownerId, requestId, state)) return true;
    } catch (error) {
      console.error('[agent-image] settlement retry', requestId, error?.message || error);
    }
    if (attempt < attempts - 1) await settlementDelay(250 * (2 ** attempt));
  }
  return false;
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
  if (finished.finished) {
    const settled = await settleTerminalState(ownerId, requestId, finished, periodStartSec);
    if (!settled) await retryTerminalSettlement(ownerId, requestId);
  }
  return finished.job;
}

function defaultSchedule(promise) {
  // Fora da Vercel não há contexto de requisição; a promessa segue no processo.
  waitUntil(promise.catch(error => console.error('[agent-image] job', error?.message || error)));
}

/**
 * Entrada da ferramenta `generate_slide_image`. Valida, registra o placeholder,
 * reserva créditos e agenda a geração. Repetir o requestId devolve o job atual
 * sem reservar nem gerar de novo.
 */
export async function startAgentImageJob(ownerId, tokenId, input, { schedule = defaultSchedule } = {}) {
  const requestId = String(input?.requestId || '');
  let existing = null;
  try { existing = await getAgentVisualJobInternal(ownerId, requestId); }
  catch (error) { if (error?.code !== 'visual_job_not_found') throw error; }
  if (existing) {
    const expectedHash = imageJobHash({
      projectId:input?.projectId,
      baseVersion:input?.baseVersion,
      slideIds:input?.slideIds,
    });
    if (existing.job?.kind !== 'image' || existing.job?.projectId !== input?.projectId
      || existing.requestHash !== expectedHash) {
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
  const aspectRatio = imageAspectRatio(project.entry?.doc);
  let created;
  try {
    created = await createAgentImageJob(ownerId, tokenId, {
      projectId: project.id, baseVersion: project.version, requestId, slideIds: input?.slideIds,
      slides, meta: { aspectRatio, periodStartSec: quota.periodStartSec, tier: quota.tier },
    });
  } catch (error) { throw error; }
  if (created.existing) {
    // O placeholder único por requestId é criado antes de qualquer reserva.
    // Só a chamada vencedora chega à quota; concorrentes apenas acompanham.
    return getAgentChangeStatus(ownerId, requestId);
  }

  let reservation;
  try {
    reservation = await reserveCredits(ownerId, quota, slides);
  } catch (error) {
    // Fecha o placeholder imediatamente. Assim o mesmo requestId não fica
    // pendente por 12 minutos quando a reserva falha.
    const owned = new Set(Array.isArray(error?.ownedReservations) ? error.ownedReservations : []);
    const failureOutcomes = slides.map(slide => ({
      slideId:slide.slideId,
      errorCode:error?.code || 'quota_reservation_failed',
      creditReserved:owned.has(slide.operationId),
    }));
    const closed = await finishAgentImageJob(ownerId, requestId, failureOutcomes).catch(finishError => {
      console.error('[agent-image] close unreserved job', finishError?.message || finishError);
      return null;
    });
    const cleanupOk = closed?.finished
      ? await settleCredits(ownerId, quota.periodStartSec, closed.slides)
      : false;
    if (!cleanupOk) schedule(retryTerminalSettlement(ownerId, requestId, 4, failureOutcomes));
    throw error;
  }
  const { reserved, quota: balance } = reservation;
  schedule(runAgentImageJob({
    ownerId, requestId, slides, aspectRatio, periodStartSec: quota.periodStartSec,
    deadlineAt: Date.now() + IMAGE_JOB_DEADLINE_MS,
  }));
  return { ...created.job, creditsReserved: reserved.length, quota: balance,
    note: 'Geração em andamento. Consulte get_change_status com este requestId até status deixar de ser pending.' };
}

/** `get_change_status`: igual ao job normal, mas expira um job de imagem travado. */
export async function getAgentChangeStatus(ownerId, requestId) {
  const state = await getAgentVisualJobInternal(ownerId, requestId);
  const job = state.job;
  if (!isImageJobStale(job)) {
    if (job.status !== 'pending') {
      await settleTerminalState(ownerId, requestId, state);
    }
    return job;
  }
  const expired = await expireAgentImageJob(ownerId, requestId);
  if (expired.expired) {
    await settleTerminalState(ownerId, requestId, expired);
  }
  return expired.job;
}

/**
 * Reconciliador durável: liquida jobs terminais e expira pendentes abandonados.
 * Repetições são seguras porque cada operação de quota é idempotente e o
 * marcador persistente só é gravado depois de todas concluírem.
 */
export async function reconcileAgentImageCredits({ limit = 50 } = {}) {
  const candidates = await listAgentImageJobsForSettlement({ limit });
  const result = { scanned:candidates.length, settled:0, pending:0, failed:0 };
  for (const candidate of candidates) {
    const ownerId = candidate.ownerId;
    const requestId = candidate.job?.requestId;
    try {
      let state = candidate;
      if (state.job?.status === 'pending') {
        if (!isImageJobStale(state.job)) {
          result.pending += 1;
          continue;
        }
        state = await expireAgentImageJob(ownerId, requestId);
      }
      if (await settleTerminalState(ownerId, requestId, state)) result.settled += 1;
      else result.pending += 1;
    } catch (error) {
      result.failed += 1;
      console.error('[agent-image] reconciliation', requestId, error?.message || error);
    }
  }
  return result;
}
