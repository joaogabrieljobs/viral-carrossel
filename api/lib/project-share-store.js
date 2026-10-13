/**
 * Armazenamento de projetos partilhados entre contas/equipas.
 * Preferência: Upstash Redis → Vercel Blob → memória (só dev/test).
 */

import { put, head } from '@vercel/blob';

const SHARE_PREFIX = 'vc:project-share:';
const BLOB_PREFIX = 'project-shares/';
const SHARE_TTL_SEC = 60 * 60 * 24 * 30; // 30 dias
/** Redis: payload curto. Blob: projectos com fotos embutidas. */
const MAX_REDIS_CHARS = 450_000;
const MAX_BLOB_CHARS = 12_000_000;
const MAX_PAYLOAD_CHARS = MAX_BLOB_CHARS;
const memory = new Map();

function hasUpstash() {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') return false;
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim()
    && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function hasBlob() {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') return false;
  return !!(
    process.env.BLOB_READ_WRITE_TOKEN
    || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
  );
}

async function upstash(command) {
  const base = process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const res = await fetch(`${base}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Upstash ${res.status}: ${text.slice(0, 120)}`);
    }
    const json = await res.json();
    return json?.result;
  } finally {
    clearTimeout(timer);
  }
}

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function assertSharePayloadSize(serialized) {
  if (serialized.length > MAX_BLOB_CHARS) {
    throw Object.assign(
      new Error('Projeto grande demais para partilhar (com fotos). Reduza imagens ou partilhe menos cards.'),
      { code: 'share_too_large' },
    );
  }
}

export async function putSharedProject(record) {
  const code = String(record.code || makeCode()).toUpperCase();
  const payload = {
    ...record,
    code,
    updatedAt: Date.now(),
    revision: record.keepRevision
      ? Math.max(1, Number(record.revision || 1))
      : Number(record.revision || 0) + 1,
  };
  delete payload.keepRevision;
  const serialized = JSON.stringify(payload);
  assertSharePayloadSize(serialized);
  const key = `${SHARE_PREFIX}${code}`;
  const tooBigForRedis = serialized.length > MAX_REDIS_CHARS;

  // Com fotos embutidas, preferir Blob (limite maior). Redis só para docs leves.
  if (hasBlob() && (tooBigForRedis || !hasUpstash())) {
    await put(`${BLOB_PREFIX}${code}.json`, serialized, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    });
  } else if (hasUpstash() && !tooBigForRedis) {
    await upstash(['SET', key, serialized, 'EX', String(SHARE_TTL_SEC)]);
  } else if (hasBlob()) {
    await put(`${BLOB_PREFIX}${code}.json`, serialized, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    });
  } else if (!tooBigForRedis) {
    memory.set(key, { value: serialized, expiresAt: Date.now() + SHARE_TTL_SEC * 1000 });
  } else {
    throw Object.assign(
      new Error('Partilha com fotos exige armazenamento Blob/Redis configurado no servidor.'),
      { code: 'share_storage_unconfigured' },
    );
  }
  return payload;
}

export async function getSharedProject(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(normalized)) return null;
  const key = `${SHARE_PREFIX}${normalized}`;

  // Tentar Blob primeiro (docs com fotos), depois Redis.
  if (hasBlob()) {
    try {
      const pathname = `${BLOB_PREFIX}${normalized}.json`;
      const meta = await head(pathname).catch(() => null);
      const url = meta?.url;
      if (url) {
        const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
        if (res.ok) return await res.json();
      }
    } catch { /* tenta Redis */ }
  }

  if (hasUpstash()) {
    const raw = await upstash(['GET', key]);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  try { return JSON.parse(entry.value); } catch { return null; }
}

export { makeCode, SHARE_TTL_SEC, MAX_PAYLOAD_CHARS };
