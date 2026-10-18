/**
 * Armazenamento de projetos partilhados entre contas/equipas.
 * Preferência: Upstash Redis (docs leves) → Vercel Blob privado (docs com fotos).
 * O store Blob do projeto é privado — `access: 'public'` falhava com "fetch failed".
 */

import { randomBytes } from 'crypto';
import { put, get, head } from '@vercel/blob';
import { isUpstashDisabled } from './upstash-config.js';

const SHARE_PREFIX = 'vc:project-share:';
const BLOB_PREFIX = 'project-shares/';
const SHARE_TTL_SEC = 60 * 60 * 24 * 30; // 30 dias
/** Redis: payload curto. Blob: projectos com fotos embutidas. */
const MAX_REDIS_CHARS = 450_000;
const MAX_BLOB_CHARS = 12_000_000;
const MAX_PAYLOAD_CHARS = MAX_BLOB_CHARS;
const memory = new Map();
const localMutations = new Map();

function hasUpstash() {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') return false;
  if (isUpstashDisabled()) return false;
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
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function resetShareMemory() {
  memory.clear();
  localMutations.clear();
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

async function putBlobPrivate(pathname, serialized, ifMatch) {
  const signal = AbortSignal.timeout(45_000);
  await put(pathname, serialized, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
    abortSignal: signal,
    ...(ifMatch ? { ifMatch } : {}),
  });
}

function strongBlobEtag(etag) {
  // Blob.get pode devolver W/"…"; If-Match do put exige o ETag forte.
  return typeof etag === 'string' ? etag.replace(/^W\/(?=")/, '') : etag;
}

async function readBlobPrivateVersioned(pathname) {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (result === null) return null; // 404 legítimo do SDK.
  if (!result?.stream) throw new Error('Blob sem conteúdo ao ler a partilha.');
  const chunks = [];
  const reader = result.stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return { record: JSON.parse(buf.toString('utf8')), etag: strongBlobEtag(result.blob?.etag) || null };
}

async function readBlobPrivate(pathname) {
  return (await readBlobPrivateVersioned(pathname))?.record || null;
}

async function putRedis(key, serialized) {
  const result = await upstash(['SET', key, serialized, 'EX', String(SHARE_TTL_SEC)]);
  if (result !== 'OK') throw new Error('Redis não confirmou a gravação.');
}

export async function putSharedProject(record, {
  blobIfMatch = null,
  blobOnly = false,
  allowImageStripping = true,
  failClosedOnRedisError = false,
} = {}) {
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
  if (!blobOnly && hasUpstash() && !tooBigForRedis) {
    try {
      await putRedis(key, serialized);
      return payload;
    } catch (e) {
      // Uma mutação que leu a versão vigente no Redis não pode mudar de
      // armazenamento após uma escrita falhada: a versão antiga continuaria
      // a ser lida e poderia mascarar a atualização salva no Blob.
      if (failClosedOnRedisError) throw e;
      errors.push(`redis: ${e?.message || e}`);
    }
  }

  // 2) Blob privado (store do projeto não aceita public).
  if (hasBlob()) {
    try {
      await putBlobPrivate(pathname, serialized, blobIfMatch);
      // Ponteiro leve no Redis (se existir) para descoberta rápida.
      if (!blobOnly && hasUpstash()) {
        // Se falhar, não anunciar sucesso: um Redis antigo poderia servir
        // a versão anterior apesar de o Blob já conter a nova.
        await putRedis(key, JSON.stringify({
          code,
          blobPath: pathname,
          revision: payload.revision,
          updatedAt: payload.updatedAt,
          name: payload.name,
        }));
      }
      return payload;
    } catch (e) {
      if (blobOnly) throw e;
      errors.push(`blob: ${e?.message || e}`);
    }
  }

  if (blobOnly) {
    throw Object.assign(new Error('Blob indisponível para atualizar a partilha.'), {
      code: 'share_storage_unconfigured',
    });
  }

  // 3) Fallback: texto sem fotos no Redis.
  if (allowImageStripping && hasUpstash()) {
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

function validCode(code) {
  const normalized = String(code || '').trim().toUpperCase();
  return /^[A-Z0-9]{6,12}$/.test(normalized) ? normalized : '';
}

function shareExpired(record) {
  const updatedAt = Number(record?.updatedAt);
  return Number.isFinite(updatedAt) && updatedAt > 0
    && Date.now() - updatedAt >= SHARE_TTL_SEC * 1000;
}

function storageReadUnavailable() {
  return Object.assign(new Error('Não foi possível confirmar a versão atual da partilha.'), {
    code: 'share_storage_unconfigured',
  });
}

function blobNotFound(error) {
  return error?.name === 'BlobNotFoundError'
    || error?.status === 404 || error?.statusCode === 404;
}

async function readBlobForMutation(pathname) {
  let versioned;
  try {
    versioned = await readBlobPrivateVersioned(pathname);
  } catch (error) {
    if (blobNotFound(error)) return null;
    // Blobs públicos antigos podem ser lidos pelo URL devolvido por head.
    // Erros de rede/parse na leitura privada nunca caem em outro snapshot.
    if (error?.name !== 'BlobAccessError') throw storageReadUnavailable();
  }
  if (versioned) {
    if (!versioned.etag || !versioned.record?.doc) throw storageReadUnavailable();
    return shareExpired(versioned.record) ? null : versioned;
  }

  let meta;
  try { meta = await head(pathname); }
  catch (error) {
    if (blobNotFound(error)) return null;
    throw storageReadUnavailable();
  }
  if (!meta) return null;
  if (!meta.etag || !meta.url) throw storageReadUnavailable();
  try {
    const response = await fetch(meta.url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error('Blob público inacessível.');
    const record = await response.json();
    if (!record?.doc) throw new Error('Documento inválido.');
    return shareExpired(record) ? null : { record, etag: strongBlobEtag(meta.etag) };
  } catch {
    throw storageReadUnavailable();
  }
}

async function readCurrentForMutation(code) {
  const key = `${SHARE_PREFIX}${code}`;
  const pathname = `${BLOB_PREFIX}${code}.json`;
  if (hasUpstash()) {
    let raw;
    try { raw = await upstash(['GET', key]); }
    catch { throw storageReadUnavailable(); }
    if (raw) {
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch { throw storageReadUnavailable(); }
      if (parsed?.blobPath) {
        if (!hasBlob()) throw storageReadUnavailable();
        const versioned = await readBlobForMutation(parsed.blobPath);
        if (!versioned) throw storageReadUnavailable();
        return { ...versioned, source: 'blob' };
      }
      if (!parsed?.doc) throw storageReadUnavailable();
      return { record: parsed, source: 'redis' };
    }
    // Sem chave Redis, apenas um Blob realmente legível pode recuperar uma
    // partilha antiga que não chegou a receber ponteiro.
    if (hasBlob()) {
      const versioned = await readBlobForMutation(pathname);
      return versioned ? { ...versioned, source: 'blob' } : null;
    }
    return null;
  }
  if (hasBlob()) {
    const versioned = await readBlobForMutation(pathname);
    return versioned && !shareExpired(versioned.record)
      ? { ...versioned, source: 'blob' } : null;
  }
  // Somente dev/test sem armazenamento remoto usam o mapa em memória.
  const record = await getSharedProject(code);
  return record ? { record } : null;
}

async function withLocalMutationLock(code, fn) {
  const previous = localMutations.get(code) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  localMutations.set(code, current);
  await previous;
  try { return await fn(); }
  finally {
    release();
    if (localMutations.get(code) === current) localMutations.delete(code);
  }
}

async function withRedisMutationLock(code, fn) {
  const key = `${SHARE_PREFIX}${code}:mutation-lock`;
  const token = randomBytes(20).toString('hex');
  // A função serverless expira em 60 s; o lock sobrevive por mais 10 s.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    // SET NX é atómico entre instâncias, inclusive quando o documento está no Blob.
    // eslint-disable-next-line no-await-in-loop
    let acquired;
    try { acquired = await upstash(['SET', key, token, 'NX', 'PX', '70000']); }
    catch {
      throw Object.assign(new Error('Não foi possível coordenar a partilha agora.'), {
        code: 'share_storage_unconfigured',
      });
    }
    if (acquired === 'OK') {
      try { return await fn(); }
      finally {
        const release = 'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end';
        await upstash(['EVAL', release, '1', key, token]).catch(() => {});
      }
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Object.assign(new Error('Projeto ocupado. Tente novamente em alguns segundos.'), {
    code: 'share_busy',
  });
}

/**
 * Aplica uma mudança à versão atual. Redis serializa entre instâncias; sem Redis,
 * o ETag do Blob impede overwrite de outra instância e permite tentar de novo.
 */
export async function mutateSharedProject(code, change) {
  const normalized = validCode(code);
  if (!normalized) return null;

  const mutate = async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const versioned = await readCurrentForMutation(normalized);
      const current = versioned?.record;
      if (!current) return null;
      const next = await change(current);
      if (!next || next === current) return current;
      try {
        if (versioned.source === 'blob' && hasBlob()) {
          // ETag e documento vêm da mesma leitura. Nunca buscar ETag novo com
          // head() para combinar com um snapshot potencialmente antigo.
          if (!versioned.etag) throw storageReadUnavailable();
          return await putSharedProject(next, { blobOnly: true, blobIfMatch: versioned.etag });
        }
        if (hasUpstash()) return await putSharedProject(next, {
          allowImageStripping: false,
          failClosedOnRedisError: true,
        });
        return await putSharedProject(next);
      } catch (error) {
        const conflict = error?.name === 'BlobPreconditionFailedError'
          || error?.statusCode === 412 || error?.status === 412;
        if (!conflict) throw error;
        if (attempt === 4) {
          throw Object.assign(new Error('A partilha mudou durante a gravação. Tente novamente.'), {
            code: 'share_busy',
          });
        }
      }
    }
    return null;
  };

  if (hasUpstash()) return withRedisMutationLock(normalized, mutate);
  return withLocalMutationLock(normalized, mutate);
}

export async function getSharedProject(code) {
  const normalized = validCode(code);
  if (!normalized) return null;
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
            if (fromBlob && !shareExpired(fromBlob)) return fromBlob;
          }
          if (parsed?.doc) return parsed;
        } catch { /* ignore */ }
      }
    } catch { /* tenta Blob */ }
  }

  if (hasBlob()) {
    try {
      const fromBlob = await readBlobPrivate(pathname);
      if (fromBlob && !shareExpired(fromBlob)) return fromBlob;
    } catch { /* ignore */ }
    // Compat: blobs antigos públicos (se existirem).
    try {
      const meta = await head(pathname).catch(() => null);
      if (meta?.url) {
        const res = await fetch(meta.url, { signal: AbortSignal.timeout(20_000) });
        if (res.ok) {
          const legacy = await res.json();
          if (!shareExpired(legacy)) {
            try { await putBlobPrivate(pathname, JSON.stringify(legacy)); } catch { /* a leitura antiga continua válida */ }
            return legacy;
          }
        }
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
