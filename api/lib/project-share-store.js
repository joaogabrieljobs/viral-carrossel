/**
 * Armazenamento de projetos partilhados entre contas/equipas.
 * Preferência: Upstash Redis (docs leves) → Vercel Blob privado (docs com fotos).
 * O store Blob do projeto é privado — `access: 'public'` falhava com "fetch failed".
 */

import { put, get, head } from '@vercel/blob';

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
  const timer = setTimeout(() => controller.abort(), 8_000);
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

/** Remove data URLs embutidas para caber no Redis. */
function stripDocImages(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const slides = Array.isArray(doc.slides)
    ? doc.slides.map((s) => ({
      ...s,
      bgImage: typeof s?.bgImage === 'string' && s.bgImage.startsWith('data:') ? null : s?.bgImage,
    }))
    : doc.slides;
  const brand = doc.brand && typeof doc.brand === 'object'
    ? {
      ...doc.brand,
      logo: typeof doc.brand.logo === 'string' && doc.brand.logo.startsWith('data:')
        ? null
        : doc.brand.logo,
    }
    : doc.brand;
  return { ...doc, slides, brand };
}

async function putBlobPrivate(pathname, serialized) {
  const signal = AbortSignal.timeout(45_000);
  await put(pathname, serialized, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
    abortSignal: signal,
  });
}

async function readBlobPrivate(pathname) {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result?.stream) return null;
  const chunks = [];
  const reader = result.stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}

async function putRedis(key, serialized) {
  await upstash(['SET', key, serialized, 'EX', String(SHARE_TTL_SEC)]);
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
  let serialized = JSON.stringify(payload);
  assertSharePayloadSize(serialized);
  const key = `${SHARE_PREFIX}${code}`;
  const pathname = `${BLOB_PREFIX}${code}.json`;
  const tooBigForRedis = serialized.length > MAX_REDIS_CHARS;
  const errors = [];

  // 1) Redis quando cabe — mais fiável e barato.
  if (hasUpstash() && !tooBigForRedis) {
    try {
      await putRedis(key, serialized);
      return payload;
    } catch (e) {
      errors.push(`redis: ${e?.message || e}`);
    }
  }

  // 2) Blob privado (store do projeto não aceita public).
  if (hasBlob()) {
    try {
      await putBlobPrivate(pathname, serialized);
      // Ponteiro leve no Redis (se existir) para descoberta rápida.
      if (hasUpstash()) {
        try {
          await putRedis(key, JSON.stringify({
            code,
            blobPath: pathname,
            revision: payload.revision,
            updatedAt: payload.updatedAt,
            name: payload.name,
          }));
        } catch { /* blob já tem o doc */ }
      }
      return payload;
    } catch (e) {
      errors.push(`blob: ${e?.message || e}`);
    }
  }

  // 3) Fallback: texto sem fotos no Redis.
  if (hasUpstash()) {
    try {
      const strippedDoc = stripDocImages(payload.doc);
      const light = {
        ...payload,
        doc: {
          ...strippedDoc,
          shareMeta: {
            ...(strippedDoc?.shareMeta || {}),
            imagesStrippedOnServer: true,
          },
        },
      };
      serialized = JSON.stringify(light);
      if (serialized.length <= MAX_REDIS_CHARS) {
        await putRedis(key, serialized);
        return light;
      }
    } catch (e) {
      errors.push(`redis-light: ${e?.message || e}`);
    }
  }

  // 4) Memória só em dev/test — em produção serverless a memória morre entre
  // invocações e o join devolve «Código inválido ou expirado».
  const allowMemory = process.env.VITEST === 'true'
    || process.env.NODE_ENV === 'test'
    || process.env.NODE_ENV === 'development';
  if (allowMemory) {
    memory.set(key, { value: serialized, expiresAt: Date.now() + SHARE_TTL_SEC * 1000 });
    return payload;
  }

  throw Object.assign(
    new Error(
      errors.length
        ? `Não foi possível gravar a partilha (${errors.join(' · ')}). Verifique Blob/Redis no Vercel.`
        : 'Partilha exige Blob ou Redis configurado no servidor (Vercel).',
    ),
    { code: 'share_storage_unconfigured' },
  );
}

export async function getSharedProject(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(normalized)) return null;
  const key = `${SHARE_PREFIX}${normalized}`;
  const pathname = `${BLOB_PREFIX}${normalized}.json`;

  // Redis primeiro (doc completo ou ponteiro blobPath).
  if (hasUpstash()) {
    try {
      const raw = await upstash(['GET', key]);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.blobPath && hasBlob()) {
            const fromBlob = await readBlobPrivate(parsed.blobPath).catch(() => null);
            if (fromBlob) return fromBlob;
          }
          if (parsed?.doc) return parsed;
        } catch { /* ignore */ }
      }
    } catch { /* tenta Blob */ }
  }

  if (hasBlob()) {
    try {
      const fromBlob = await readBlobPrivate(pathname);
      if (fromBlob) return fromBlob;
    } catch { /* ignore */ }
    // Compat: blobs antigos públicos (se existirem).
    try {
      const meta = await head(pathname).catch(() => null);
      if (meta?.url) {
        const res = await fetch(meta.url, { signal: AbortSignal.timeout(20_000) });
        if (res.ok) return await res.json();
      }
    } catch { /* ignore */ }
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
