/**
 * POST /api/ai/sjinn-image
 * Gera 1 imagem GPT Image 2 via SJinn (chave só no servidor) e consome quota do plano.
 *
 * Body: { prompt: string, aspectRatio?: '2:3'|'1:1'|..., resolution?: '1K'|'2K'|'4K' }
 * Resposta: { b64_json, mime, quota: { used, limit, remaining, tier } }
 */
import { applyCors } from '../lib/cors.js';
import { requireActiveSubscription } from '../lib/require-access.js';
import { findActiveSubscription } from '../lib/stripe.js';
import { billingDisabled } from '../lib/access.js';
import {
  resolveTierFromSubscription,
  imageQuotaForTier,
  periodBoundsFromSubscription,
} from '../lib/plans.js';
import {
  consumeImageCredit,
  refundImageCredit,
  getQuotaUsage,
} from '../lib/image-quota.js';
import { consumeRateLimit, rateLimitResponse } from '../lib/rate-limit.js';
import {
  isSjinnConfigured,
  createGptImage2Task,
  waitForSjinnTask,
  downloadImageAsBase64,
  extractSjinnOutputUrl,
} from '../lib/sjinn.js';

export const config = {
  maxDuration: 120,
};

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export default async function handler(req, res) {
  applyCors(req, res, { credentials: true });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const limited = consumeRateLimit(req, { limit: 12, windowMs: 60_000, keyPrefix: 'sjinn-img' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  if (!isSjinnConfigured()) {
    return res.status(503).json({
      error: 'Geração de imagem indisponível no momento. Tente de novo ou use a sua chave em Configurar IA.',
      code: 'sjinn_unconfigured',
    });
  }

  const access = await requireActiveSubscription(req, res);
  if (!access) return;

  const body = readBody(req);
  const prompt = String(body.prompt || '').trim();
  if (prompt.length < 8) {
    return res.status(400).json({ error: 'Prompt de imagem demasiado curto.' });
  }

  const aspectRatio = ['1:1', '16:9', '9:16', '3:2', '2:3', 'auto'].includes(body.aspectRatio)
    ? body.aspectRatio
    : '2:3';
  const resolution = ['1K', '2K', '4K'].includes(body.resolution) ? body.resolution : '1K';

  let tier = 'creator';
  let periodStartSec = Math.floor(Date.now() / 1000);
  let periodEndSec = periodStartSec + 30 * 24 * 3600;
  let customerId = access.customerId || 'billing-disabled';
  let limit = 50;

  try {
    if (billingDisabled() || access.billingDisabled) {
      tier = 'max';
      limit = 300;
      customerId = `dev:${access.email || 'local'}`;
    } else {
      const sub = await findActiveSubscription(access.customerId);
      if (!sub) {
        return res.status(402).json({ error: 'Assinatura inativa.' });
      }
      tier = resolveTierFromSubscription(sub);
      const bounds = periodBoundsFromSubscription(sub);
      periodStartSec = bounds.periodStartSec || periodStartSec;
      periodEndSec = bounds.periodEndSec || periodEndSec;
      limit = imageQuotaForTier(tier);
      customerId = access.customerId;
    }
  } catch (e) {
    console.error('[sjinn-image] plan resolve', e?.message || e);
    return res.status(503).json({ error: 'Não foi possível verificar o plano.' });
  }

  if (limit <= 0) {
    return res.status(402).json({
      error: 'O plano Essencial não inclui geração de imagem. Faça upgrade para o Criador ou active a sua chave em Configurações → Avançado.',
      code: 'plan_no_images',
      tier,
      quota: { used: 0, limit: 0, remaining: 0, tier },
    });
  }

  let consumed;
  try {
    consumed = await consumeImageCredit({
      customerId,
      periodStartSec,
      periodEndSec,
      limit,
    });
  } catch (e) {
    console.error('[sjinn-image] quota', e?.message || e);
    return res.status(503).json({
      error: 'Não foi possível reservar crédito de imagem. Tente de novo.',
      code: 'quota_store_error',
    });
  }

  if (!consumed.allowed) {
    return res.status(402).json({
      error: 'Quota de imagens esgotada neste ciclo. Faça upgrade ou aguarde a renovação.',
      code: 'quota_exhausted',
      tier,
      quota: {
        used: consumed.used,
        limit: consumed.limit,
        remaining: 0,
        tier,
      },
    });
  }

  try {
    const taskId = await createGptImage2Task({ prompt, aspectRatio, resolution });
    const data = await waitForSjinnTask(taskId);
    const url = extractSjinnOutputUrl(data);
    if (!url) throw new Error('A geração de imagem não devolveu resultado.');
    const { b64_json, mime } = await downloadImageAsBase64(url);

    return res.status(200).json({
      b64_json,
      mime,
      taskId,
      tier,
      quota: {
        used: consumed.used,
        limit: consumed.limit,
        remaining: consumed.remaining,
        tier,
      },
    });
  } catch (e) {
    console.error('[sjinn-image]', e?.message || e);
    try {
      await refundImageCredit({ customerId, periodStartSec });
    } catch (refundErr) {
      console.error('[sjinn-image] refund', refundErr?.message || refundErr);
    }
    const usage = await getQuotaUsage({ customerId, periodStartSec, limit }).catch(() => null);
    return res.status(502).json({
      error: e?.message || 'Falha ao gerar imagem.',
      code: e?.code || 'sjinn_error',
      tier,
      quota: usage
        ? { used: usage.used, limit: usage.limit, remaining: usage.remaining, tier }
        : undefined,
    });
  }
}
