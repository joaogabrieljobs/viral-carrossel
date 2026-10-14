// Transporte de originais. Os limites são por pedido, nunca por resolução.
export const CLOUD_IMAGE_PART_CHARS = 2_000_000;
export const CLOUD_IMAGE_MAX_CHARS = 48_000_000;

export async function originalImageAssetId(dataUrl) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataUrl));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `original_${dataUrl.length > CLOUD_IMAGE_PART_CHARS ? 'chunks_' : ''}${hash}`;
}

export function isOriginalImageAsset(assetId) {
  return /^original_(?:chunks_)?[a-f0-9]{64}$/.test(assetId || '');
}

export function imageContentType(dataUrl) {
  return /^data:(image\/[a-zA-Z0-9.+-]+);base64,/.exec(dataUrl)?.[1] || null;
}
