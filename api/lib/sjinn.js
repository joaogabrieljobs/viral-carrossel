/**
 * Cliente SJinn Tool API (servidor only).
 * Docs: https://sjinn.ai/docs/api/tool
 */

import { assertPublicHttpUrl } from '../../urlSourceFetch.js';

const BASE = 'https://sjinn.ai/api/un-api';
const POLL_MS = 5_000;
const MAX_ATTEMPTS = 30;
/** Deadline absoluta do polling, abaixo do `maxDuration` de api/ai/sjinn-image.js
 *  com folga para download + refund. O spike mediu ~82 s por imagem GPT Image 2
 *  (qa-session/sjinn-spike/report.json), logo 95 s deixava 2 de 3 imagens a morrer
 *  por timeout do nosso lado — não do SJinn. */
export const SJINN_DEADLINE_MS = 240_000;
const SJINN_FETCH_TIMEOUT_MS = 15_000;

function apiKey() {
  return String(process.env.SJINN_API_KEY || '').trim();
}

export function isSjinnConfigured() {
  return apiKey().length > 8;
}

async function sjinnFetch(path, body) {
  const key = apiKey();
  if (!key) throw new Error('SJINN_API_KEY não configurada no servidor.');
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SJINN_FETCH_TIMEOUT_MS),
  });
  const json = await res.json().catch(() => ({}));
  return { httpStatus: res.status, json };
}

export async function createGptImage2Task({ prompt, aspectRatio = '2:3', resolution = '1K', imageList = [] }) {
  const input = {
    prompt: String(prompt || '').slice(0, 4000),
    aspect_ratio: aspectRatio,
    resolution,
  };
  if (Array.isArray(imageList) && imageList.length) {
    input.image_list = imageList.filter((u) => /^https?:\/\//i.test(u)).slice(0, 4);
  }
  const { httpStatus, json } = await sjinnFetch('/create_tool_task', {
    tool_type: 'gpt-image-2-api',
    input,
  });
  if (!json?.success || !json?.data?.task_id) {
    const msg = json?.errorMsg || `SJinn create falhou (${httpStatus})`;
    const err = new Error(msg);
    err.code = json?.error_code;
    err.status = httpStatus;
    throw err;
  }
  return json.data.task_id;
}

export async function waitForSjinnTask(
  taskId,
  { pollMs = POLL_MS, maxAttempts = MAX_ATTEMPTS, deadlineMs = SJINN_DEADLINE_MS } = {},
) {
  const startedAt = Date.now();
  const timeout = () => {
    const err = new Error('A geração de imagem demorou demasiado. Tente de novo.');
    err.code = 'sjinn_timeout';
    return err;
  };
  for (let i = 0; i < maxAttempts; i++) {
    // Primeiro poll imediato — evita 5s mortos no início.
    if (i > 0) await new Promise((r) => setTimeout(r, pollMs));
    if (Date.now() - startedAt > deadlineMs) throw timeout();
    const { json } = await sjinnFetch('/query_tool_task_status', { task_id: taskId });
    const status = json?.data?.status;
    if (status === 1) return json.data;
    if (status === -1) {
      const err = new Error(json?.data?.error || json?.errorMsg || 'SJinn task failed');
      err.code = 'sjinn_failed';
      throw err;
    }
  }
  const err = new Error('A geração de imagem demorou demasiado. Tente de novo.');
  err.code = 'sjinn_timeout';
  throw err;
}

/** Extrai URL de imagem da resposta SJinn (campos variam entre tools). */
export function extractSjinnOutputUrl(data) {
  if (!data || typeof data !== 'object') return null;
  const list = data.output_urls || data.outputUrls || data.urls || [];
  if (Array.isArray(list) && list[0]) return String(list[0]);
  if (typeof data.output_url === 'string') return data.output_url;
  if (typeof data.url === 'string') return data.url;
  return null;
}

export async function downloadImageAsBase64(url) {
  // Revalida a URL devolvida pelo upstream (mesmo padrão de api/ai/compatible.js).
  const safe = assertPublicHttpUrl(url);
  const res = await fetch(safe, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Download da imagem falhou (${res.status})`);
  const mime = (res.headers.get('content-type') || 'image/png').split(';')[0].trim() || 'image/png';
  const bytes = Buffer.from(await res.arrayBuffer());
  return { b64_json: bytes.toString('base64'), mime };
}
