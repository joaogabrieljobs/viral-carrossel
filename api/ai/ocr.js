import { applyCors } from '../lib/cors.js';
import { requireActiveSubscription } from '../lib/require-access.js';
import { consumeRateLimit, rateLimitResponse } from '../lib/rate-limit.js';
import { parseImageReferences } from '../lib/image-references.js';
import { consumeOcrCredit, refundOcrCredit } from '../lib/ocr-quota.js';

const OCR_URL = 'https://api.z.ai/api/paas/v4/layout_parsing';
const OCR_TEXT_MAX = 18_000;
export const config = { maxDuration: 90 };
let providerUnavailableUntil = 0;

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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const limited = consumeRateLimit(req, { limit: 15, windowMs: 60_000, keyPrefix: 'carousel-ocr' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);

  const access = await requireActiveSubscription(req, res, { asJson: true });
  if (!access) return;

  let quotaConsumed = false;
  try {
    const { image } = readBody(req);
    let parsed;
    try { [parsed] = parseImageReferences([image]); }
    catch { return res.status(400).json({ error: 'Envie uma imagem PNG ou JPG válida.' }); }
    if (!parsed?.bytes || !['image/png', 'image/jpeg'].includes(parsed.mime)) {
      return res.status(400).json({ error: 'Envie uma imagem PNG ou JPG válida.' });
    }
    const key = String(process.env.ZAI_API_KEY || '').trim();
    if (!key) return res.status(503).json({ error: 'A leitura de imagens está temporariamente indisponível.' });
    if (Date.now() < providerUnavailableUntil) {
      return res.status(503).json({ error: 'A leitura online está indisponível. O app tentará ler no seu aparelho.' });
    }
    const quota = await consumeOcrCredit({ customerId: access.customerId || 'dev' });
    if (!quota.allowed) {
      return res.status(quota.reason === 'exhausted' ? 429 : 503).json({
        error: quota.reason === 'exhausted'
          ? `Limite diário de ${quota.limit} imagens atingido. Tente novamente amanhã.`
          : 'A leitura de imagens está temporariamente indisponível.',
      });
    }
    quotaConsumed = true;
    const file = `data:${parsed.mime};base64,${parsed.bytes.toString('base64')}`;
    const upstream = await fetch(OCR_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'glm-ocr',
        file,
        return_crop_images: false,
        need_layout_visualization: false,
      }),
      signal: AbortSignal.timeout(75_000),
    });
    const raw = await upstream.text();
    let payload = null;
    try { payload = JSON.parse(raw); } catch { /* tratado como falha do provedor */ }
    if (!upstream.ok || !payload || payload?.code) {
      console.error('[carousel-ocr] upstream_error', upstream.status, payload?.code || 'invalid_json');
      if (upstream.status === 401 || upstream.status === 403) {
        providerUnavailableUntil = Date.now() + 5 * 60_000;
      }
      await refundOcrCredit({ customerId: access.customerId || 'dev' });
      quotaConsumed = false;
      const responseStatus = upstream.status === 429
        ? 429
        : (upstream.status === 401 || upstream.status === 403 ? 503 : 502);
      return res.status(responseStatus).json({
        error: upstream.status === 429
          ? 'Muitas imagens ao mesmo tempo. Aguarde um instante e tente de novo.'
          : (upstream.status === 401 || upstream.status === 403)
            ? 'A leitura online está indisponível. O app tentará ler no seu aparelho.'
            : 'Não foi possível ler esta imagem. Tente outro arquivo.',
      });
    }
    const text = String(payload?.md_results || '').trim().slice(0, OCR_TEXT_MAX);
    if (text.replace(/\s/g, '').length < 3) {
      await refundOcrCredit({ customerId: access.customerId || 'dev' });
      quotaConsumed = false;
      return res.status(422).json({ error: 'Não encontrei texto legível nesta imagem.' });
    }
    return res.status(200).json({ ok: true, text });
  } catch (error) {
    if (quotaConsumed) await refundOcrCredit({ customerId: access.customerId || 'dev' });
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return res.status(504).json({ error: 'A leitura demorou demais. Tente uma imagem menor.' });
    }
    console.error('[carousel-ocr] request_error', error?.message || error);
    return res.status(502).json({ error: 'Não foi possível concluir a leitura da imagem. Tente novamente.' });
  }
}
