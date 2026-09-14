#!/usr/bin/env node
/**
 * Spike SJinn — GPT Image 2 (PRD planos-imagem-sjinn, task 1)
 *
 * Uso:
 *   SJINN_API_KEY=sk_... node scripts/spike-sjinn-image.mjs
 *   # ou com .env.local carregado via:
 *   node --env-file=.env.local scripts/spike-sjinn-image.mjs
 *
 * Gera 1 imagem ~4:5 (feed), faz polling, grava ficheiro + relatório JSON.
 * NÃO committa a chave. NÃO usa a key no browser.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const API_KEY = (process.env.SJINN_API_KEY || '').trim();
const BASE = 'https://sjinn.ai/api/un-api';
const OUT_DIR = join(process.cwd(), 'qa-session', 'sjinn-spike');
const POLL_MS = 5_000;
const MAX_ATTEMPTS = 36; // ~3 min
// 2:3 ≈ vertical; Instagram 4:5 não está na lista SJinn → 2:3 é o mais próximo
const ASPECT = process.env.SJINN_ASPECT || '2:3';
const RESOLUTION = process.env.SJINN_RESOLUTION || '1K';

const PROMPT =
  process.env.SJINN_PROMPT ||
  [
    'Photorealistic editorial photograph for an Instagram carousel slide.',
    'Quiet contemporary café table, soft morning window light, ceramic cup,',
    'shallow depth of field, subtle film grain, muted desaturated tones,',
    'generous negative space in the upper third for headline text overlay.',
    'No text, no logos, no watermarks, no people faces close-up.',
  ].join(' ');

function authHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function createTask() {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/create_tool_task`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      tool_type: 'gpt-image-2-api',
      input: {
        prompt: PROMPT,
        aspect_ratio: ASPECT,
        resolution: RESOLUTION,
      },
    }),
  });
  const json = await res.json().catch(() => ({}));
  const ms = Date.now() - t0;
  return { httpStatus: res.status, ms, json };
}

async function queryStatus(taskId) {
  const res = await fetch(`${BASE}/query_tool_task_status`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ task_id: taskId }),
  });
  const json = await res.json().catch(() => ({}));
  return { httpStatus: res.status, json };
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download falhou ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return { bytes: buf.length, contentType: res.headers.get('content-type') };
}

async function recentCredits(taskId) {
  const res = await fetch(`${BASE}/query_credits_usage?limit=10`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const json = await res.json().catch(() => ({}));
  const records = json?.data?.records || [];
  const match = records.find((r) => r.task_id === taskId) || null;
  return { httpStatus: res.status, match, latest: records[0] || null };
}

async function main() {
  if (!API_KEY) {
    console.error('Falta SJINN_API_KEY. Coloca em .env.local ou passa na linha de comando.');
    console.error('Ex.: node --env-file=.env.local scripts/spike-sjinn-image.mjs');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const startedAt = new Date().toISOString();
  const wall0 = Date.now();

  console.log('→ create_tool_task gpt-image-2-api', { aspect: ASPECT, resolution: RESOLUTION });
  const created = await createTask();
  console.log('  create:', created.httpStatus, `${created.ms}ms`, created.json?.success, created.json?.errorMsg || '');

  if (!created.json?.success || !created.json?.data?.task_id) {
    const report = {
      ok: false,
      phase: 'create',
      startedAt,
      created,
      note: 'create_tool_task falhou — ver error_code (100=saldo, 401=chave).',
    };
    await writeFile(join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    process.exit(2);
  }

  const taskId = created.json.data.task_id;
  console.log('  task_id:', taskId);

  let final = null;
  let polls = 0;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    polls += 1;
    await new Promise((r) => setTimeout(r, POLL_MS));
    const q = await queryStatus(taskId);
    const status = q.json?.data?.status;
    console.log(`  poll ${polls}: status=${status} http=${q.httpStatus}`);
    if (status === 1) {
      final = q;
      break;
    }
    if (status === -1) {
      final = q;
      break;
    }
  }

  const wallMs = Date.now() - wall0;
  const outputUrls = final?.json?.data?.output_urls || [];
  const status = final?.json?.data?.status;

  let downloadMeta = null;
  let localPath = null;
  if (status === 1 && outputUrls[0]) {
    const ext = outputUrls[0].includes('.jpg') || outputUrls[0].includes('.jpeg') ? 'jpg' : 'png';
    localPath = join(OUT_DIR, `gpt-image-2-${ASPECT.replace(':', 'x')}.${ext}`);
    downloadMeta = await download(outputUrls[0], localPath);
    console.log('  saved:', localPath, downloadMeta);
  }

  let credits = null;
  try {
    credits = await recentCredits(taskId);
    console.log('  credits match:', credits.match || credits.latest);
  } catch (e) {
    credits = { error: String(e?.message || e) };
  }

  const report = {
    ok: status === 1,
    startedAt,
    finishedAt: new Date().toISOString(),
    wallMs,
    wallSec: +(wallMs / 1000).toFixed(1),
    tool_type: 'gpt-image-2-api',
    credits_expected: 100,
    credits_observed: credits?.match?.cost_credits ?? null,
    credits,
    aspect_ratio: ASPECT,
    resolution: RESOLUTION,
    createMs: created.ms,
    polls,
    pollIntervalMs: POLL_MS,
    taskId,
    status,
    outputUrls,
    localPath,
    downloadMeta,
    createError: created.json?.success ? null : created.json,
    finalError: status === -1 ? final?.json : null,
    vercelNote:
      wallMs > 55_000
        ? 'Latência >55s — serverless default pode timeout; precisar maxDuration ou job async.'
        : 'Latência dentro de margem típica de função Vercel com maxDuration generoso.',
  };

  await writeFile(join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== SPIKE REPORT ===');
  console.log(JSON.stringify(report, null, 2));
  process.exit(status === 1 ? 0 : 3);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
