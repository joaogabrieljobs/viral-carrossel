/**
 * Biblioteca na nuvem por conta (customerId).
 * Manifesto JSON + assets de imagem em Blob privado; meta leve no Redis.
 * Sem TTL — projetos da conta persistem enquanto a assinatura existir.
 */

import { put, get, BlobPreconditionFailedError } from '@vercel/blob';
import { createHash } from 'node:crypto';

const META_PREFIX = 'vc:library-sync:meta:';
const BLOB_PREFIX = 'library-sync/';
const MAX_MANIFEST_CHARS = 3_500_000;
const MAX_ASSET_CHARS = 2_400_000;
const ASSET_CHUNK_CHARS = 2_000_000;
const MAX_ORIGINAL_ASSET_CHARS = 48_000_000;
const MAX_ASSET_CHUNKS = 24;
const MAX_ASSETS = 800;
const memoryMeta = new Map();
const memoryManifest = new Map();
const memoryAssets = new Map();
const memoryOriginals = new Map();

function usesBlobOnly(customerId) {
  if (process.env.LIBRARY_SYNC_STORAGE?.trim() !== 'blob') return false;
  const owners = process.env.LIBRARY_SYNC_BLOB_OWNERS?.trim();
  return !owners || owners.split(',').some((owner) => owner.trim() === customerId);
}

function hasUpstash(customerId) {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') return false;
  // Escolha operacional explícita: o Redis usado por outros recursos pode não
  // participar da biblioteca. Não é um fallback automático após erro de rede.
  if (usesBlobOnly(customerId)) return false;
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

function allowMemory() {
  return process.env.VITEST === 'true'
    || process.env.NODE_ENV === 'test'
    || process.env.NODE_ENV === 'development';
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

function sanitizeCustomerId(customerId) {
  const id = String(customerId || '').trim();
  if (!id || id.length > 80) return '';
  // Stripe cus_… ou fallback em_email
  if (!/^[a-zA-Z0-9_.-]+$/.test(id)) return '';
  return id;
}

/** Chave estável por conta: customerId Stripe, senão email sanitizado. */
export function resolveLibraryOwnerId(access = {}) {
  const cus = sanitizeCustomerId(access.customerId);
  if (cus) return cus;
  const email = String(access.email || '').trim().toLowerCase();
  if (email) {
    const slug = email.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 60);
    if (slug) return sanitizeCustomerId(`em_${slug}`);
  }
  if (access.billingDisabled) return 'billing-disabled';
  return '';
}

function sanitizeAssetId(assetId) {
  const id = String(assetId || '').trim();
  if (!id || id.length > 120) return '';
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) return '';
  return id;
}

function manifestPath(customerId) {
  return `${BLOB_PREFIX}${customerId}/manifest.json`;
}

function assetPath(customerId, assetId, ext = 'bin') {
  const safeExt = String(ext || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
  return `${BLOB_PREFIX}${customerId}/assets/${assetId}.${safeExt}`;
}

function extForMime(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/avif') return 'avif';
  return 'jpg';
}

function mimeFromPath(pathname) {
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.gif')) return 'image/gif';
  if (pathname.endsWith('.avif')) return 'image/avif';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

function parseDataUrl(dataUrl) {
  const src = String(dataUrl || '');
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(src);
  if (!m) return null;
  try {
    const bytes = Buffer.from(m[2], 'base64');
    if (!bytes.length) return null;
    return { mime: m[1], bytes };
  } catch {
    return null;
  }
}

function blobAuthOpts() {
  // Token estático: fallback fiável quando OIDC do store falha ou não está ligado.
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token ? { token } : {};
}

async function putBlobPrivate(pathname, body, contentType = 'application/json', writeOptions = {}) {
  const signal = AbortSignal.timeout(45_000);
  await put(pathname, body, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    cacheControlMaxAge: 60,
    abortSignal: signal,
    ...blobAuthOpts(),
    ...writeOptions,
  });
}

async function readBlobPrivate(pathname, { withVersion = false } = {}) {
  let stage = 'blob_get';
  try {
    const result = await get(pathname, { access: 'private', useCache: false, ...blobAuthOpts() });
    if (!result?.stream) return null;
    stage = 'blob_stream';
    const chunks = [];
    const reader = result.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    stage = 'blob_decode';
    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return withVersion ? { buffer, etag: result.blob?.etag } : buffer;
  } catch (error) {
    error.libraryReadStage = stage;
    throw error;
  }
}

function storageUnconfiguredError(errors = []) {
  return Object.assign(
    new Error(
      errors.length
        ? `Não foi possível gravar a biblioteca na nuvem (${errors.join(' · ')}).`
        : 'Sync de biblioteca exige Blob ou Redis configurado no servidor (Vercel).',
    ),
    { code: 'library_storage_unconfigured' },
  );
}

/**
 * @param {string} customerId
 * @returns {Promise<null | { customerId, revision, updatedAt, projectCount, assetIds, blobPath }>}
 */
export async function getLibrarySyncMeta(customerId) {
  const id = sanitizeCustomerId(customerId);
  if (!id) return null;
  const manifest = await getLibraryManifest(id);
  return manifest ? metaForManifest(id, manifest) : null;
}

function metaForManifest(id, manifest) {
  return {
    customerId: id,
    revision: Number(manifest.revision || 1),
    updatedAt: Number(manifest.updatedAt || 0),
    projectCount: manifest.docs.length,
    assetIds: Array.isArray(manifest.assetIds) ? manifest.assetIds : [],
    blobPath: manifestPath(id),
  };
}

function compareManifestVersion(a, b) {
  return Number(a?.revision || 0) - Number(b?.revision || 0)
    || Number(a?.updatedAt || 0) - Number(b?.updatedAt || 0);
}

function deletedProjectIds(...lists) {
  return new Set(lists.flatMap((list) => (Array.isArray(list) ? list : []))
    .map((value) => String(value || '').trim()).filter(Boolean));
}

function libraryReadError(diagnostics = []) {
  return Object.assign(
    new Error('Não foi possível confirmar a biblioteca mais recente na nuvem. Tente sincronizar novamente.'),
    { code: 'library_storage_unavailable', storageDiagnostics: diagnostics },
  );
}

// Só classificação técnica: nunca registrar documento, conta, URL ou token.
function readFailureDiagnostic(source, error) {
  const safeCode = (value) => /^[a-zA-Z0-9_]{1,80}$/.test(String(value || '')) ? String(value) : undefined;
  return {
    source,
    stage: safeCode(error?.libraryReadStage) || 'manifest_parse',
    name: safeCode(error?.name),
    code: safeCode(error?.code),
    causeCode: safeCode(error?.cause?.code),
    httpStatus: Number(/Failed to fetch blob: (\d{3})/.exec(error?.message || '')?.[1]) || undefined,
  };
}

/**
 * @param {string} customerId
 * @returns {Promise<object|null>}
 */
export async function getLibraryManifest(customerId) {
  return (await readLibraryState(customerId)).manifest;
}

async function readLibraryState(customerId) {
  const id = sanitizeCustomerId(customerId);
  const state = { manifest: null, blobExists: false, blobEtag: null, redisRaw: null, redisMetaRaw: null, memoryValue: null };
  if (!id) return state;
  if (usesBlobOnly(id) && !hasBlob() && !allowMemory()) {
    throw storageUnconfiguredError(['Blob não configurado para a biblioteca']);
  }
  const pathname = manifestPath(id);
  const candidates = [];
  let cachedMeta = null;
  let readFailed = false;
  const diagnostics = [];
  const addCandidate = (value) => {
    if (!value || !Array.isArray(value.docs)) throw libraryReadError();
    candidates.push(value);
  };

  if (hasBlob()) {
    try {
      const result = await readBlobPrivate(pathname, { withVersion: true });
      if (result) {
        state.blobExists = true;
        state.blobEtag = result.etag;
        addCandidate(JSON.parse(result.buffer.toString('utf8')));
      }
    } catch (error) {
      readFailed = true;
      diagnostics.push(readFailureDiagnostic('blob', error));
    }
  }

  if (hasUpstash(id)) {
    try {
      const [raw, rawMeta] = await Promise.all([
        upstash(['GET', `${META_PREFIX}${id}:full`]),
        upstash(['GET', `${META_PREFIX}${id}`]),
      ]);
      state.redisRaw = raw || null;
      state.redisMetaRaw = rawMeta || null;
      if (raw) addCandidate(JSON.parse(raw));
      if (rawMeta) cachedMeta = JSON.parse(rawMeta);
    } catch (error) {
      readFailed = true;
      diagnostics.push(readFailureDiagnostic('redis', error));
    }
  }

  if (allowMemory()) {
    const local = memoryManifest.get(id);
    state.memoryValue = local || null;
    if (local) addCandidate(local);
    cachedMeta ||= memoryMeta.get(`${META_PREFIX}${id}`) || null;
  }

  // Redis pode conter um save mais novo após falha do put no Blob. Status,
  // pull e merge precisam escolher a mesma versão, nunca fontes diferentes.
  const latest = candidates.sort((a, b) => compareManifestVersion(b, a))[0] || null;
  // Falha de leitura não significa biblioteca vazia. Gravar assim apagaria
  // os projetos que só existem na fonte temporariamente indisponível.
  if (readFailed || (cachedMeta && (!latest || compareManifestVersion(cachedMeta, latest) > 0))) {
    throw libraryReadError(diagnostics.length ? diagnostics : [{ source: 'metadata', stage: 'manifest_behind' }]);
  }
  if (!latest) return state;
  // Exclusões são permanentes para este ID. Uma réplica antiga pode guardar
  // tombstones que versões do cliente anteriores deixaram de reenviar.
  const deletedIds = deletedProjectIds(...candidates.map((candidate) => candidate.deletedIds));
  state.manifest = {
    ...latest,
    docs: latest.docs.filter((doc) => !deletedIds.has(String(doc?.id))),
    deletedIds: [...deletedIds],
  };
  return state;
}

function entryUpdatedAt(entry) {
  return Number(entry?.updatedAt || entry?.createdAt || 0);
}

/** União por id — entrada mais recente ganha. Nunca descarta o lado em falta. */
function mergeById(cloudList, localList) {
  const map = new Map();
  for (const entry of (cloudList || [])) {
    if (!entry?.id) continue;
    map.set(String(entry.id), entry);
  }
  for (const entry of (localList || [])) {
    if (!entry?.id) continue;
    const key = String(entry.id);
    const prev = map.get(key);
    if (!prev || entryUpdatedAt(entry) >= entryUpdatedAt(prev)) {
      map.set(key, entry);
    }
  }
  return [...map.values()];
}

/**
 * @param {string} customerId
 * @param {object} manifest
 * @param {{ baseRevision?: number, force?: boolean, replace?: boolean }} [opts]
 */
export async function putLibraryManifest(customerId, manifest, opts = {}) {
  const id = sanitizeCustomerId(customerId);
  if (!id) {
    throw Object.assign(new Error('Conta inválida para sync.'), { code: 'library_bad_owner' });
  }
  if (!manifest || typeof manifest !== 'object') {
    throw Object.assign(new Error('Manifesto inválido.'), { code: 'library_bad_manifest' });
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await putLibraryManifestAttempt(id, manifest, opts, attempt > 0);
    } catch (error) {
      if (error?.code !== 'library_write_conflict') throw error;
      if (attempt === 2) {
        throw Object.assign(new Error('A biblioteca mudou durante o envio. Sincronize novamente.'), {
          code: 'library_conflict',
        });
      }
    }
  }
}

function writeConflict() {
  return Object.assign(new Error('A biblioteca mudou durante a gravação.'), { code: 'library_write_conflict' });
}

function blobWriteConflict(error, wasMissing) {
  return error instanceof BlobPreconditionFailedError
    || error?.name === 'BlobPreconditionFailedError' || error?.code === 'precondition_failed'
    || error?.status === 412 || error?.statusCode === 412
    || (wasMissing && /already exists/i.test(error?.message || ''));
}

// Redis confirma a mesma leitura e publica manifesto + meta numa operação.
// Um conflito não pode virar fallback e sobrescrever uma exclusão mais nova.
const REDIS_MANIFEST_CAS = `
local full = redis.call('GET', KEYS[1]) or ''
local meta = redis.call('GET', KEYS[2]) or ''
if full ~= ARGV[1] or meta ~= ARGV[2] then return 0 end
redis.call('SET', KEYS[1], ARGV[3])
redis.call('SET', KEYS[2], ARGV[4])
return 1
`;

async function putLibraryManifestAttempt(id, manifest, opts, retrying) {
  const state = await readLibraryState(id);
  const cloudManifest = state.manifest;
  const existing = cloudManifest ? metaForManifest(id, cloudManifest) : null;
  const baseRevision = Number(opts.baseRevision);
  if (
    existing
    && !retrying
    && !opts.force
    && Number.isFinite(baseRevision)
    && Number(existing.revision) !== baseRevision
  ) {
    throw Object.assign(
      new Error('A biblioteca na nuvem mudou noutro dispositivo. Puxe a versão da nuvem ou force o envio.'),
      { code: 'library_conflict', cloudRevision: existing.revision, cloudUpdatedAt: existing.updatedAt },
    );
  }

  const revision = existing
    ? (opts.force && Number.isFinite(baseRevision) && baseRevision === Number(existing.revision)
      ? Number(existing.revision) + 1
      : Number(existing.revision || 0) + 1)
    : 1;

  // Por defeito: MERGE com a nuvem (união). `replace: true` só quando o cliente
  // quer mesmo encolher (apagar projectos que só existem na nuvem).
  let docs = Array.isArray(manifest.docs) ? manifest.docs : [];
  let folders = Array.isArray(manifest.folders) ? manifest.folders : [];
  let brands = Array.isArray(manifest.brands) ? manifest.brands : [];
  let assetIds = Array.isArray(manifest.assetIds) ? manifest.assetIds : [];

  const deletedIds = deletedProjectIds(cloudManifest?.deletedIds, manifest.deletedIds);
  if (opts.replace && cloudManifest) {
    // Substituição explícita também é uma exclusão: sem tombstone, o próximo
    // push de um navegador antigo traria os projetos omitidos de volta.
    const retainedIds = new Set(docs.map((doc) => String(doc?.id)));
    for (const doc of cloudManifest.docs) {
      if (doc?.id && !retainedIds.has(String(doc.id))) deletedIds.add(String(doc.id));
    }
  }

  if (!opts.replace && cloudManifest) {
    docs = mergeById(cloudManifest.docs, docs);
    folders = mergeById(cloudManifest.folders, folders);
    brands = mergeById(cloudManifest.brands, brands);
    assetIds = [
      ...(Array.isArray(cloudManifest.assetIds) ? cloudManifest.assetIds : []),
      ...assetIds,
    ];
  }

  if (deletedIds.size) {
    docs = docs.filter((d) => d?.id && !deletedIds.has(String(d.id)));
  }

  assetIds = [...new Set(assetIds.map(sanitizeAssetId).filter(Boolean))].slice(0, MAX_ASSETS);

  const payload = {
    vcVersion: 3,
    ...manifest,
    docs,
    folders,
    brands,
    customerId: id,
    revision,
    updatedAt: Date.now(),
    assetIds,
    deletedIds: [...deletedIds],
  };
  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_MANIFEST_CHARS) {
    throw Object.assign(
      new Error('Biblioteca grande demais para a nuvem. Remova projetos antigos ou imagens pesadas.'),
      { code: 'library_too_large' },
    );
  }

  const pathname = manifestPath(id);
  const meta = {
    customerId: id,
    revision: payload.revision,
    updatedAt: payload.updatedAt,
    projectCount: Array.isArray(payload.docs) ? payload.docs.length : 0,
    assetIds,
    blobPath: pathname,
  };
  const errors = [];

  if (hasBlob()) {
    if (state.blobExists && !state.blobEtag) {
      throw libraryReadError([{ source: 'blob', stage: 'missing_etag' }]);
    }
    try {
      await putBlobPrivate(pathname, serialized, 'application/json', state.blobExists
        ? { ifMatch: state.blobEtag, allowOverwrite: true }
        : { allowOverwrite: false });
      if (hasUpstash(id)) {
        try {
          await upstash(['SET', `${META_PREFIX}${id}`, JSON.stringify(meta)]);
        } catch { /* blob já tem o manifesto */ }
      }
      if (allowMemory()) {
        memoryMeta.set(`${META_PREFIX}${id}`, meta);
        memoryManifest.set(id, payload);
      }
      return { manifest: payload, meta };
    } catch (e) {
      if (blobWriteConflict(e, !state.blobExists)) throw writeConflict();
      errors.push(`blob: ${e?.message || e}`);
    }
  }

  if (hasUpstash(id) && serialized.length <= 450_000) {
    try {
      const accepted = await upstash(['EVAL', REDIS_MANIFEST_CAS, 2,
        `${META_PREFIX}${id}:full`, `${META_PREFIX}${id}`,
        state.redisRaw || '', state.redisMetaRaw || '', serialized, JSON.stringify(meta)]);
      if (Number(accepted) !== 1) throw writeConflict();
      return { manifest: payload, meta };
    } catch (e) {
      if (e?.code === 'library_write_conflict') throw e;
      errors.push(`redis: ${e?.message || e}`);
    }
  }

  if (allowMemory()) {
    if ((memoryManifest.get(id) || null) !== state.memoryValue) throw writeConflict();
    memoryMeta.set(`${META_PREFIX}${id}`, meta);
    memoryManifest.set(id, payload);
    return { manifest: payload, meta };
  }

  throw storageUnconfiguredError(errors);
}

function assetError(message, code = 'library_bad_asset') {
  return Object.assign(new Error(message), { code });
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function originalAssetPath(id, aid, suffix) {
  return `${BLOB_PREFIX}${id}/original-assets/${aid}/${suffix}`;
}

async function writeOriginalObject(pathname, value) {
  const serialized = JSON.stringify(value);
  if (hasBlob()) {
    try {
      await putBlobPrivate(pathname, serialized);
      return;
    } catch (error) {
      if (!allowMemory()) throw storageUnconfiguredError(['Falha ao gravar a imagem original no Blob']);
    }
  }
  if (!allowMemory()) throw storageUnconfiguredError();
  memoryOriginals.set(pathname, serialized);
}

async function readOriginalObject(pathname) {
  if (hasBlob()) {
    try {
      const buffer = await readBlobPrivate(pathname);
      if (buffer) return JSON.parse(buffer.toString('utf8'));
    } catch (error) {
      // Ausência é diferente de indisponibilidade; nunca confirma um upload
      // com base numa leitura que falhou.
      if (error?.status !== 404 && error?.statusCode !== 404
        && error?.name !== 'BlobNotFoundError') {
        throw assetError('Não foi possível ler a imagem original na nuvem.', 'library_storage_unavailable');
      }
    }
  }
  const serialized = allowMemory() ? memoryOriginals.get(pathname) : null;
  return serialized ? JSON.parse(serialized) : null;
}

function originalHash(aid, chunked = false) {
  return new RegExp(`^original_${chunked ? 'chunks_' : ''}([a-f0-9]{64})$`).exec(aid)?.[1] || '';
}

function validateChunkShape(total, totalChars) {
  return Number.isInteger(total) && total >= 2 && total <= MAX_ASSET_CHUNKS
    && Number.isInteger(totalChars) && totalChars > ASSET_CHUNK_CHARS
    && totalChars <= MAX_ORIGINAL_ASSET_CHARS
    && total === Math.ceil(totalChars / ASSET_CHUNK_CHARS);
}

function chunkLength(index, total, totalChars) {
  return index === total - 1 ? totalChars - index * ASSET_CHUNK_CHARS : ASSET_CHUNK_CHARS;
}

async function readOriginalDescriptor(id, aid) {
  const descriptor = await readOriginalObject(originalAssetPath(id, aid, 'complete.json'));
  if (!descriptor) return null;
  if (descriptor.assetId !== aid || descriptor.chunked !== true
    || !validateChunkShape(descriptor.total, descriptor.totalChars)
    || !Array.isArray(descriptor.hashes) || descriptor.hashes.length !== descriptor.total
    || !descriptor.hashes.every((hash) => /^[a-f0-9]{64}$/.test(hash))) {
    throw assetError('A imagem original na nuvem está incompleta.', 'library_asset_incomplete');
  }
  return descriptor;
}

/**
 * Partes endereçadas pelo conteúdo ficam imutáveis após a publicação. Os
 * apontadores temporários podem ser reenviados; o descriptor só é publicado
 * depois de verificar todos os bytes e o hash da imagem completa.
 */
export async function putLibraryAssetChunk(customerId, assetId, body) {
  const id = sanitizeCustomerId(customerId);
  const aid = sanitizeAssetId(assetId);
  const hash = originalHash(aid, true);
  const { index, total, totalChars, data } = body || {};
  if (!id || !hash || !validateChunkShape(total, totalChars)
    || !Number.isInteger(index) || index < 0 || index >= total
    || typeof data !== 'string' || data.length !== chunkLength(index, total, totalChars)
    || /[^\x20-\x7e]/.test(data)) {
    throw assetError('Parte da imagem inválida.');
  }
  const partHash = sha256(data);
  const partPath = originalAssetPath(id, aid, `parts/${index}-${partHash}.json`);
  const existing = await readOriginalDescriptor(id, aid);
  if (existing) {
    if (existing.total !== total || existing.totalChars !== totalChars || existing.hashes[index] !== partHash) {
      throw assetError('Esta parte não corresponde à imagem original.');
    }
    // Também permite recuperar uma parte removida/interrompida sem mudar o
    // descriptor publicado. O hash já confirmou que os bytes são os mesmos.
    const stored = await readOriginalObject(partPath);
    if (stored?.index !== index || stored.data !== data) {
      await writeOriginalObject(partPath, { index, data });
    }
    return { assetId: aid, index, total, complete: true };
  }

  await writeOriginalObject(partPath, { index, data });
  await writeOriginalObject(originalAssetPath(id, aid, `pending/${index}.json`), {
    index, total, totalChars, hash: partHash,
  });
  if (index !== total - 1) return { assetId: aid, index, total, complete: false };

  const parts = await Promise.all(Array.from({ length: total }, async (_, partIndex) => {
    const pointer = await readOriginalObject(originalAssetPath(id, aid, `pending/${partIndex}.json`));
    if (pointer?.index !== partIndex || pointer.total !== total || pointer.totalChars !== totalChars
      || !/^[a-f0-9]{64}$/.test(pointer.hash || '')) return null;
    const part = await readOriginalObject(originalAssetPath(id, aid, `parts/${partIndex}-${pointer.hash}.json`));
    if (part?.index !== partIndex || typeof part.data !== 'string'
      || part.data.length !== chunkLength(partIndex, total, totalChars)
      || sha256(part.data) !== pointer.hash) return null;
    return { data: part.data, hash: pointer.hash };
  }));
  if (parts.some((part) => !part)) {
    throw assetError('O envio da imagem ainda não terminou. Reenvie as partes em falta.', 'library_asset_incomplete');
  }
  const dataUrl = parts.map((part) => part.data).join('');
  if (sha256(dataUrl) !== hash || !parseDataUrl(dataUrl)) {
    throw assetError('As partes recebidas não correspondem à imagem original.');
  }
  await writeOriginalObject(originalAssetPath(id, aid, 'complete.json'), {
    assetId: aid, chunked: true, total, totalChars,
    hashes: parts.map((part) => part.hash), updatedAt: Date.now(),
  });
  return { assetId: aid, index, total, complete: true };
}

/**
 * Assets legados são binários. Originais pequenos guardam o data URL exato,
 * inclusive MIME e padding base64, para preservar o hash durante o round-trip.
 * @param {string} customerId
 * @param {string} assetId
 * @param {{ dataUrl: string, contentType?: string }} body
 */
export async function putLibraryAsset(customerId, assetId, body) {
  const id = sanitizeCustomerId(customerId);
  const aid = sanitizeAssetId(assetId);
  if (!id || !aid) {
    throw Object.assign(new Error('Asset inválido.'), { code: 'library_bad_asset' });
  }
  const dataUrl = String(body?.dataUrl || '');
  const hash = originalHash(aid);
  if (aid.startsWith('original_') && !hash) throw assetError('Identificador de imagem original inválido.');
  if (dataUrl.length > (hash ? ASSET_CHUNK_CHARS : MAX_ASSET_CHARS)) {
    throw assetError('Imagem grande demais para envio numa única parte.', 'library_asset_too_large');
  }
  if (hash && sha256(dataUrl) !== hash) throw assetError('A imagem recebida não corresponde ao original.');
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    throw Object.assign(new Error('Asset deve ser data URL de imagem.'), { code: 'library_bad_asset' });
  }
  if (dataUrl.length > MAX_ASSET_CHARS || parsed.bytes.length > 1_800_000) {
    throw Object.assign(new Error('Imagem grande demais para sync.'), { code: 'library_asset_too_large' });
  }

  // O conteúdo recebido, e não um rótulo externo, define o formato.
  const contentType = parsed.mime;
  const ext = extForMime(contentType);
  const pathname = assetPath(id, aid, ext);
  const record = { assetId: aid, dataUrl, contentType, updatedAt: Date.now() };
  if (hash) {
    await writeOriginalObject(originalAssetPath(id, aid, 'original.json'), record);
    return { assetId: aid, bytes: parsed.bytes.length, contentType };
  }
  const errors = [];

  if (hasBlob()) {
    try {
      await putBlobPrivate(pathname, parsed.bytes, contentType);
      if (allowMemory()) memoryAssets.set(`${id}:${aid}`, record);
      return { assetId: aid, bytes: parsed.bytes.length, contentType };
    } catch (e) {
      errors.push(`blob: ${e?.message || e}`);
    }
  }

  if (allowMemory()) {
    memoryAssets.set(`${id}:${aid}`, record);
    return { assetId: aid, bytes: parsed.bytes.length, contentType };
  }

  throw storageUnconfiguredError(errors);
}

/**
 * @param {string} customerId
 * @param {string} assetId
 */
export async function getLibraryAsset(customerId, assetId, { part } = {}) {
  const id = sanitizeCustomerId(customerId);
  const aid = sanitizeAssetId(assetId);
  if (!id || !aid) return null;

  if (originalHash(aid, true)) {
    if (part !== undefined && (!Number.isInteger(part) || part < 0 || part >= MAX_ASSET_CHUNKS)) {
      throw assetError('Índice da parte inválido.');
    }
    const descriptor = await readOriginalDescriptor(id, aid);
    if (!descriptor) return null;
    if (part === undefined) {
      return { assetId: aid, chunked: true, total: descriptor.total, totalChars: descriptor.totalChars };
    }
    if (part >= descriptor.total) throw assetError('Índice da parte inválido.');
    const stored = await readOriginalObject(originalAssetPath(id, aid, `parts/${part}-${descriptor.hashes[part]}.json`));
    if (stored?.index !== part || typeof stored.data !== 'string'
      || stored.data.length !== chunkLength(part, descriptor.total, descriptor.totalChars)
      || sha256(stored.data) !== descriptor.hashes[part]) return null;
    return { index: part, data: stored.data };
  }

  if (part !== undefined) throw assetError('Esta imagem não tem partes.');
  if (originalHash(aid)) {
    const original = await readOriginalObject(originalAssetPath(id, aid, 'original.json'));
    if (!original || typeof original.dataUrl !== 'string' || sha256(original.dataUrl) !== originalHash(aid)) return null;
    return original;
  }
  if (aid.startsWith('original_')) return null;

  if (hasBlob()) {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bin']) {
      try {
        const pathname = assetPath(id, aid, ext);
        const buf = await readBlobPrivate(pathname);
        if (!buf?.length) continue;
        // Compat: assets antigos eram JSON { dataUrl }.
        if (ext === 'bin' || (buf[0] === 0x7b /* { */)) {
          try {
            const parsed = JSON.parse(buf.toString('utf8'));
            if (parsed?.dataUrl) return parsed;
          } catch { /* binário */ }
        }
        const contentType = mimeFromPath(pathname);
        return {
          assetId: aid,
          contentType,
          dataUrl: `data:${contentType};base64,${buf.toString('base64')}`,
          updatedAt: Date.now(),
        };
      } catch { /* tenta outra extensão */ }
    }
  }

  return memoryAssets.get(`${id}:${aid}`) || null;
}

/** Testes: limpa memória. */
export function resetLibrarySyncStoreForTests() {
  memoryMeta.clear();
  memoryManifest.clear();
  memoryAssets.clear();
  memoryOriginals.clear();
}

export {
  MAX_MANIFEST_CHARS,
  MAX_ASSET_CHARS,
  ASSET_CHUNK_CHARS,
  MAX_ORIGINAL_ASSET_CHARS,
  MAX_ASSET_CHUNKS,
  MAX_ASSETS,
  sanitizeCustomerId,
  sanitizeAssetId,
};
