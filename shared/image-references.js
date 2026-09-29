// Quatro referências em base64 + prompt ficam abaixo do limite de 4,5 MB da função.
export const MAX_IMAGE_REFERENCES = 4;
export const MAX_REFERENCE_BYTES = 700 * 1024;
export const MAX_REFERENCE_DATA_URL_CHARS = Math.ceil(MAX_REFERENCE_BYTES / 3) * 4 + 32;
export const REFERENCE_DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export function isHttpsImageReference(value) {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}
