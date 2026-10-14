import { isOriginalImageAsset } from './cloud-image-assets.js';

// Só hashes de originais confirmados pela API entram aqui. O manifesto contém
// referências a uploads pendentes e nunca serve como comprovante de envio.
export const CLOUD_UPLOAD_RECEIPTS_KEY = 'vc_cloud_upload_receipts';
const MAX_RECEIPTS = 512;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const receipts = new Map();
let restored = false;

function validIdentity(owner, assetId) {
  return typeof owner === 'string' && owner.length > 0 && isOriginalImageAsset(assetId);
}

function receiptKey(owner, assetId) {
  return JSON.stringify([owner, assetId]);
}

function prune() {
  const oldest = Date.now() - MAX_AGE_MS;
  for (const [key, entry] of receipts) {
    if (entry.at < oldest) receipts.delete(key);
  }
  while (receipts.size > MAX_RECEIPTS) receipts.delete(receipts.keys().next().value);
}

function restore() {
  if (restored) return;
  restored = true;
  try {
    const saved = JSON.parse(sessionStorage.getItem(CLOUD_UPLOAD_RECEIPTS_KEY) || 'null');
    if (saved?.version !== 1 || !Array.isArray(saved.receipts)) return;
    for (const entry of saved.receipts.slice(-MAX_RECEIPTS)) {
      if (validIdentity(entry?.owner, entry?.assetId) && Number.isFinite(entry.at)
        && entry.at <= Date.now()) receipts.set(receiptKey(entry.owner, entry.assetId), entry);
    }
    prune();
  } catch { /* sem sessionStorage, a retomada continua possível nesta página */ }
}

export function hasConfirmedOriginalUpload(owner, assetId) {
  if (!validIdentity(owner, assetId)) return false;
  restore();
  prune();
  return receipts.has(receiptKey(owner, assetId));
}

/** Chamar apenas depois de confirmar a resposta e revalidar conta/cancelamento. */
export function rememberConfirmedOriginalUpload(owner, assetId) {
  if (!validIdentity(owner, assetId)) return;
  restore();
  const key = receiptKey(owner, assetId);
  receipts.delete(key);
  receipts.set(key, { owner, assetId, at: Date.now() });
  prune();
  try {
    sessionStorage.setItem(CLOUD_UPLOAD_RECEIPTS_KEY, JSON.stringify({
      version: 1, receipts: [...receipts.values()],
    }));
  } catch { /* não usar localStorage: a quota cheia não pode reiniciar uploads */ }
}
