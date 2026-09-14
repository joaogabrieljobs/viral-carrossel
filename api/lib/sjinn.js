/**
 * Cliente SJinn Tool API (servidor only).
 * Docs: https://sjinn.ai/docs/api/tool
 */

const BASE = 'https://sjinn.ai/api/un-api';
const POLL_MS = 5_000;
const MAX_ATTEMPTS = 24; // ~2 min após create

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

export async function waitForSjinnTask(taskId, { pollMs = POLL_MS, maxAttempts = MAX_ATTEMPTS } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollMs));
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

export async function downloadImageAsBase64(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download da imagem falhou (${res.status})`);
  const mime = (res.headers.get('content-type') || 'image/png').split(';')[0].trim() || 'image/png';
  const bytes = Buffer.from(await res.arrayBuffer());
  return { b64_json: bytes.toString('base64'), mime };
}
