const PROVIDERS = {
  zai: {
    chat: 'https://api.z.ai/api/paas/v4/chat/completions',
    images: 'https://api.z.ai/api/paas/v4/images/generations',
  },
  kimi: {
    chat: 'https://api.moonshot.ai/v1/chat/completions',
  },
};

import { applyCors } from '../lib/cors.js';
import { requireActiveSubscription } from '../lib/require-access.js';
import { consumeRateLimit, rateLimitResponse } from '../lib/rate-limit.js';
import { assertPublicHttpUrl } from '../../urlSourceFetch.js';

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

async function fetchProviderImageAsBase64(imageUrl) {
  // Revalida URL pública — evita SSRF se o upstream devolver URL interna.
  const safe = assertPublicHttpUrl(imageUrl);
  const imageResponse = await fetch(safe, { redirect: 'error' });
  if (!imageResponse.ok) {
    throw new Error('Não foi possível baixar a imagem gerada.');
  }
  const mime = imageResponse.headers.get('content-type') || 'image/png';
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  return { b64_json: bytes.toString('base64'), mime };
}

export default async function handler(req, res) {
  applyCors(req, res, { credentials: true });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const limited = consumeRateLimit(req, { limit: 40, windowMs: 60_000, keyPrefix: 'compatible' });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec, true);

  const access = await requireActiveSubscription(req, res, { errorShape: 'nested' });
  if (!access) return;

  const { provider, operation = 'chat', apiKey, payload } = readBody(req);
  const target = PROVIDERS[provider]?.[operation];
  if (!target || !['chat', 'images'].includes(operation)) {
    return res.status(400).json({ error: { message: 'Provedor ou operação inválida.' } });
  }
  if (!String(apiKey || '').trim()) {
    return res.status(400).json({ error: { message: `Chave ${provider} ausente.` } });
  }
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: { message: 'Payload ausente.' } });
  }

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${String(apiKey).trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const raw = await upstream.text();
    if (operation === 'images' && upstream.ok) {
      const data = JSON.parse(raw);
      const imageUrl = data?.data?.[0]?.url;
      if (imageUrl) {
        try {
          const { b64_json, mime } = await fetchProviderImageAsBase64(imageUrl);
          return res.status(200).json({
            ...data,
            data: [{ ...data.data[0], url: undefined, b64_json, mime }],
          });
        } catch (e) {
          return res.status(502).json({
            error: { message: e?.message || 'Não foi possível baixar a imagem gerada.' },
          });
        }
      }
    }
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(raw);
  } catch (error) {
    console.error(`[ai/compatible] ${provider}/${operation}`, error?.message || error);
    return res.status(502).json({ error: { message: 'Falha ao conectar ao provedor de IA.' } });
  }
}
