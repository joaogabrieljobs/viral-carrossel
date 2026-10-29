import { createHash } from 'node:crypto';
import { findActiveSubscription } from './stripe.js';
import { resolveTierFromSubscription, imageQuotaForTier, periodBoundsFromSubscription } from './plans.js';
import { consumeImageCredit, refundImageCredit, settleImageCredit } from './image-quota.js';
import { isSjinnConfigured, createGptImage2Task, waitForSjinnTask, downloadImageAsBase64,
  extractSjinnOutputUrl, SJINN_DEADLINE_MS } from './sjinn.js';
import { putLibraryAsset } from './library-sync-store.js';
import { applyAgentImageEdit, getAgentProject, getAgentVisualJob } from './agent-visual-batch.js';

function fail(status, code, message, extra = {}) {
  throw Object.assign(new Error(message), { status, code, ...extra });
}

export function imageAspectRatio(doc) {
  const format = String(doc?.format || doc?.formatId || '').toLowerCase();
  if (format.includes('apresent') || format === '16:9') return '16:9';
  if (format.includes('storie') || format === '9:16') return '9:16';
  if (format.includes('quadr') || format === '1:1') return '1:1';
  return '2:3';
}

export async function generateAgentImage({ ownerId, requestId, prompt, aspectRatio }) {
  if (!isSjinnConfigured()) fail(503, 'sjinn_unconfigured', 'Geração de imagem indisponível no momento.');
  const cleanPrompt = String(prompt || '').trim();
  if (cleanPrompt.length < 8 || cleanPrompt.length > 4000) {
    fail(400, 'image_prompt_invalid', 'A direção de imagem deve ter entre 8 e 4000 caracteres.');
  }
  const sub = await findActiveSubscription(ownerId).catch(() => null);
  if (!sub) fail(402, 'subscription_inactive', 'Assinatura inativa.');
  const tier = resolveTierFromSubscription(sub);
  const limit = imageQuotaForTier(tier);
  if (limit <= 0) fail(402, 'plan_no_images', 'Seu plano não inclui geração de imagens.');
  const { periodStartSec, periodEndSec } = periodBoundsFromSubscription(sub);
  if (!periodStartSec || !periodEndSec) fail(503, 'quota_period_unavailable', 'Não foi possível confirmar o período da assinatura.');
  const operationId = `mcp:${requestId}`;
  const consumed = await consumeImageCredit({ customerId: ownerId, periodStartSec, periodEndSec, limit, operationId })
    .catch(() => fail(503, 'quota_store_error', 'Não foi possível reservar o crédito de imagem.'));
  if (!consumed.allowed) {
    fail(consumed.replayed ? 409 : 402,
      consumed.replayed ? 'image_operation_replayed' : 'quota_exhausted',
      consumed.replayed ? 'Esta geração já foi iniciada ou concluída. Consulte get_change_status.' : 'Quota de imagens esgotada.');
  }
  try {
    const taskId = await createGptImage2Task({ prompt: cleanPrompt, aspectRatio, resolution: '1K', imageList: [] });
    const data = await waitForSjinnTask(taskId, { deadlineMs: SJINN_DEADLINE_MS });
    const url = extractSjinnOutputUrl(data);
    if (!url) fail(502, 'image_result_missing', 'A geração não devolveu uma imagem.');
    const { b64_json, mime = 'image/png' } = await downloadImageAsBase64(url);
    const dataUrl = `data:${mime};base64,${b64_json}`;
    const assetId = `agent_${createHash('sha256').update(dataUrl).digest('hex').slice(0, 48)}`;
    await putLibraryAsset(ownerId, assetId, { dataUrl, contentType: mime });
    return {
      assetId, taskId,
      quota: { used: consumed.used, limit: consumed.limit, remaining: consumed.remaining, tier },
      settle: () => settleImageCredit({ customerId: ownerId, periodStartSec, operationId }).catch(() => {}),
      refund: () => refundImageCredit({ customerId: ownerId, periodStartSec, operationId }).catch(() => {}),
    };
  } catch (error) {
    await refundImageCredit({ customerId: ownerId, periodStartSec, operationId }).catch(() => {});
    if (error?.status) throw error;
    fail(502, error?.code || 'image_generation_failed', error?.message || 'Falha ao gerar imagem.');
  }
}

export async function generateAndApplyAgentSlideImage(ownerId, tokenId, input) {
  try {
    const existing = await getAgentVisualJob(ownerId, input.requestId);
    if (existing.projectId !== input.projectId
      || !existing.changedBrandFields.includes(`image:${input.slideId}`)) {
      fail(409, 'image_request_reused', 'requestId já usado para outra alteração.');
    }
    return { ...existing, slideId: input.slideId, hasPhoto: true, replayed: true };
  } catch (error) {
    if (error?.code !== 'visual_job_not_found') throw error;
  }
  const project = await getAgentProject(ownerId, input.projectId, { includeText: true });
  if (project.version !== input.baseVersion) {
    fail(409, 'project_conflict', 'O projeto mudou na nuvem.', { cloudVersion: project.version });
  }
  const slide = project.slides.find(item => item.id === input.slideId);
  if (!slide) fail(404, 'image_slide_missing', 'Card não encontrado neste projeto.');
  if (slide.hasPhoto) fail(409, 'image_already_present', 'Este card já possui imagem.');
  const generated = await generateAgentImage({ ownerId, requestId: input.requestId,
    prompt: slide.imageQuery, aspectRatio: input.aspectRatio || imageAspectRatio(project) });
  try {
    const job = await applyAgentImageEdit(ownerId, tokenId, { ...input, assetId: generated.assetId });
    await generated.settle();
    return { ...job, slideId: input.slideId, assetId: generated.assetId, hasPhoto: true, quota: generated.quota };
  } catch (error) {
    await generated.refund();
    throw error;
  }
}
