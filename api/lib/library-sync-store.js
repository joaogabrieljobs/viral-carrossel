/**
 * Biblioteca na nuvem por conta (customerId).
 * Manifesto JSON + assets de imagem em Blob privado; meta leve no Redis.
 * Sem TTL — projetos da conta persistem enquanto a assinatura existir.
 */

import { put, get } from '@vercel/blob';

const META_PREFIX = 'vc:library-sync:meta:';
const BLOB_PREFIX = 'library-sync/';
const MAX_MANIFEST_CHARS = 3_500_000;
const MAX_ASSET_CHARS = 2_400_000;
const MAX_ASSETS = 800;
const memoryMeta = new Map();
const memoryManifest = new Map();
const memoryAssets = new Map();

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
  return 'jpg';
}

function mimeFromPath(pathname) {
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.webp')) return 'image/webp';
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

async function putBlobPrivate(pathname, body, contentType = 'application/json') {
  const signal = AbortSignal.timeout(45_000);
  await put(pathname, body, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    cacheControlMaxAge: 60,
    abortSignal: signal,
    ...blobAuthOpts(),
  });
}

async function readBlobPrivate(pathname) {
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
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
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
  const id = sanitizeCustomerId(customerId);
  if (!id) return null;
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
      const buf = await readBlobPrivate(pathname);
      if (buf) addCandidate(JSON.parse(buf.toString('utf8')));
    } catch (error) {
      readFailed = true;
      diagnostics.push(readFailureDiagnostic('blob', error));
    }
  }

  if (hasUpstash()) {
    try {
      const [raw, rawMeta] = await Promise.all([
        upstash(['GET', `${META_PREFIX}${id}:full`]),
        upstash(['GET', `${META_PREFIX}${id}`]),
      ]);
      if (raw) addCandidate(JSON.parse(raw));
      if (rawMeta) cachedMeta = JSON.parse(rawMeta);
    } catch (error) {
      readFailed = true;
      diagnostics.push(readFailureDiagnostic('redis', error));
    }
  }

  if (allowMemory()) {
    const local = memoryManifest.get(id);
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
  return latest;
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

  const cloudManifest = await getLibraryManifest(id);
  const existing = cloudManifest ? metaForManifest(id, cloudManifest) : null;
  const baseRevision = Number(opts.baseRevision);
  if (
    existing
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

  if (!opts.replace && cloudManifest) {
    docs = mergeById(cloudManifest.docs, docs);
    folders = mergeById(cloudManifest.folders, folders);
    brands = mergeById(cloudManifest.brands, brands);
    assetIds = [
      ...(Array.isArray(cloudManifest.assetIds) ? cloudManifest.assetIds : []),
      ...assetIds,
    ];
  }

  const deletedIds = new Set(
    (Array.isArray(manifest.deletedIds) ? manifest.deletedIds : [])
      .map((x) => String(x || '').trim())
      .filter(Boolean),
  );
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
    try {
      await putBlobPrivate(pathname, serialized, 'application/json');
      if (hasUpstash()) {
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
      errors.push(`blob: ${e?.message || e}`);
    }
  }

  if (hasUpstash() && serialized.length <= 450_000) {
    try {
      await upstash(['SET', `${META_PREFIX}${id}:full`, serialized]);
      await upstash(['SET', `${META_PREFIX}${id}`, JSON.stringify(meta)]);
      return { manifest: payload, meta };
    } catch (e) {
      errors.push(`redis: ${e?.message || e}`);
    }
  }

  if (allowMemory()) {
    memoryMeta.set(`${META_PREFIX}${id}`, meta);
    memoryManifest.set(id, payload);
    return { manifest: payload, meta };
  }

  throw storageUnconfiguredError(errors);
}

/**
 * Grava bytes da imagem (não JSON) — cabem mais e falham menos no Blob.
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
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    throw Object.assign(new Error('Asset deve ser data URL de imagem.'), { code: 'library_bad_asset' });
  }
  if (dataUrl.length > MAX_ASSET_CHARS || parsed.bytes.length > 1_800_000) {
    throw Object.assign(new Error('Imagem grande demais para sync.'), { code: 'library_asset_too_large' });
  }

  const contentType = String(body?.contentType || '').startsWith('image/')
    ? body.contentType
    : parsed.mime;
  const ext = extForMime(contentType);
  const pathname = assetPath(id, aid, ext);
  const record = { assetId: aid, dataUrl, contentType, updatedAt: Date.now() };
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
export async function getLibraryAsset(customerId, assetId) {
  const id = sanitizeCustomerId(customerId);
  const aid = sanitizeAssetId(assetId);
  if (!id || !aid) return null;

  if (hasBlob()) {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'bin']) {
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
}

export {
  MAX_MANIFEST_CHARS,
  MAX_ASSET_CHARS,
  MAX_ASSETS,
  sanitizeCustomerId,
  sanitizeAssetId,
};
