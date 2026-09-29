import { randomUUID } from 'node:crypto';
import { put, del, list, issueSignedToken, presignUrl } from '@vercel/blob';
import {
  MAX_IMAGE_REFERENCES, MAX_REFERENCE_BYTES, MAX_REFERENCE_DATA_URL_CHARS,
  REFERENCE_DATA_URL_PATTERN, isHttpsImageReference,
} from '../../shared/image-references.js';

export const REFERENCE_PREFIX = 'image-references/temporary/';
export const REFERENCE_URL_TTL_MS = 15 * 60_000;
export const REFERENCE_ORPHAN_AGE_MS = 60 * 60_000;

function referenceError(message, code = 'reference_invalid') {
  return Object.assign(new Error(message), { code });
}

function hasImageSignature(bytes, mime) {
  if (mime === 'image/png') return bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/jpeg') return bytes.length >= 12 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

// Valida tudo antes da reserva de crédito e antes de qualquer upload.
export function parseImageReferences(refs = []) {
  if (!Array.isArray(refs) || refs.length > MAX_IMAGE_REFERENCES) {
    throw referenceError('Envie até quatro referências por imagem.');
  }
  return refs.map(ref => {
    if (isHttpsImageReference(ref)) return { url: ref };
    if (typeof ref !== 'string' || ref.length > MAX_REFERENCE_DATA_URL_CHARS) {
      throw referenceError('Referência inválida ou grande demais. Envie novamente uma imagem menor.');
    }
    const match = REFERENCE_DATA_URL_PATTERN.exec(ref);
    if (!match) throw referenceError('Use referências PNG, JPEG, WebP ou links HTTPS.');
    const [, mime, encoded] = match;
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length > MAX_REFERENCE_BYTES || bytes.toString('base64') !== encoded || !hasImageSignature(bytes, mime)) {
      throw referenceError('Uma referência não contém uma imagem válida. Reenvie o arquivo.');
    }
    return { bytes, mime };
  });
}

export function assertReferenceStorageConfigured(refs) {
  if (!refs.some(ref => ref.bytes)) return;
  if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)) {
    throw referenceError('O envio de referências está indisponível no momento. Seu moodboard foi mantido. Tente novamente mais tarde.', 'reference_storage_unconfigured');
  }
}

export async function stageImageReferences(refs) {
  const paths = [];
  const cleanup = async () => {
    if (!paths.length) return;
    try { await del(paths, { abortSignal: AbortSignal.timeout(8000) }); }
    catch { console.error('[image-references] cleanup_failed; daily cleanup will retry'); }
  };
  const signal = AbortSignal.timeout(20_000);
  const validUntil = Date.now() + REFERENCE_URL_TTL_MS;
  const results = await Promise.allSettled(refs.map(async ref => {
    if (ref.url) return ref.url;
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[ref.mime];
    const pathname = `${REFERENCE_PREFIX}${Date.now()}-${randomUUID()}.${ext}`;
    // Inclui o pathname antes do PUT: um timeout pode acontecer depois de gravar.
    paths.push(pathname);
    await put(pathname, ref.bytes, {
      access: 'private', addRandomSuffix: false, allowOverwrite: false,
      contentType: ref.mime, cacheControlMaxAge: 60, abortSignal: signal,
    });
    const token = await issueSignedToken({ pathname, operations: ['get'], validUntil, abortSignal: signal });
    const { presignedUrl } = await presignUrl(token, { pathname, operation: 'get', access: 'private', validUntil, useCache: false });
    return presignedUrl;
  }));
  if (results.some(result => result.status === 'rejected')) {
    await cleanup();
    // Não devolve mensagens do SDK que possam conter URLs assinadas ou credenciais.
    throw referenceError('Não foi possível enviar as referências. Tente novamente; o crédito reservado será devolvido.', 'reference_upload_failed');
  }
  return { imageList: results.map(result => result.value), cleanup };
}

// Recupera sobras de funções interrompidas. Nunca toca nos originais do navegador.
export async function cleanupStaleImageReferences({ now = Date.now() } = {}) {
  let cursor;
  let deleted = 0;
  for (let page = 0; page < 5; page++) {
    const result = await list({ prefix: REFERENCE_PREFIX, limit: 1000, ...(cursor ? { cursor } : {}), abortSignal: AbortSignal.timeout(8000) });
    const stale = result.blobs.filter(blob => blob.pathname.startsWith(REFERENCE_PREFIX) && new Date(blob.uploadedAt).getTime() < now - REFERENCE_ORPHAN_AGE_MS);
    if (stale.length) {
      await del(stale.map(blob => blob.pathname), { abortSignal: AbortSignal.timeout(8000) });
      deleted += stale.length;
    }
    if (!result.hasMore) return { deleted, hasMore: false };
    cursor = result.cursor;
  }
  return { deleted, hasMore: true };
}
