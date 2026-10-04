import { prepareImageReferencesForUpload } from './image-reference-upload.js';
import { createBrowserOcrSession, shouldUseBrowserOcrFallback } from './browser-ocr.js';

export const CAROUSEL_OCR_MAX_IMAGES = 10;
export const CAROUSEL_OCR_MAX_TEXT_PER_IMAGE = 6_000;
export const CAROUSEL_OCR_MAX_STORED_TEXT = 30_000;
const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg']);

export function normalizeCarouselImageEvidence(items) {
  const normalized = [];
  let remaining = CAROUSEL_OCR_MAX_STORED_TEXT;
  for (const [index, item] of Array.from(items || []).slice(0, CAROUSEL_OCR_MAX_IMAGES).entries()) {
    if (remaining <= 0) break;
    const text = String(item?.text || '').trim().slice(0, Math.min(CAROUSEL_OCR_MAX_TEXT_PER_IMAGE, remaining));
    if (!text) continue;
    normalized.push({
      name: String(item?.name || `Imagem ${index + 1}`).slice(0, 100),
      text,
    });
    remaining -= text.length;
  }
  return normalized;
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(normalizeCarouselFileDataUrl(reader.result, file));
    reader.onerror = () => reject(new Error(`Não foi possível ler ${file?.name || 'a imagem'}.`));
    reader.readAsDataURL(file);
  });
}

/** Safari/iOS pode devolver application/octet-stream quando o File não traz
 * MIME. A extensão já foi validada; normalizamos somente PNG/JPG conhecidos. */
export function normalizeCarouselFileDataUrl(value, file) {
  const dataUrl = String(value || '');
  if (/^data:image\/(?:png|jpeg);base64,/i.test(dataUrl)) return dataUrl;
  const declared = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '');
  const mime = ACCEPTED_TYPES.has(declared)
    ? declared
    : (/\.png$/i.test(name) ? 'image/png' : (/\.jpe?g$/i.test(name) ? 'image/jpeg' : ''));
  if (!mime || !/^data:[^;,]*;base64,/i.test(dataUrl)) return dataUrl;
  return dataUrl.replace(/^data:[^;,]*;base64,/i, `data:${mime};base64,`);
}

export function validateCarouselOcrFiles(files) {
  const list = Array.from(files || []);
  if (!list.length) throw new Error('Escolha pelo menos uma imagem.');
  if (list.length > CAROUSEL_OCR_MAX_IMAGES) throw new Error(`Envie até ${CAROUSEL_OCR_MAX_IMAGES} imagens por análise.`);
  for (const file of list) {
    const declared = String(file?.type || '').toLowerCase();
    const extensionLooksValid = /\.(png|jpe?g)$/i.test(String(file?.name || ''));
    if (!ACCEPTED_TYPES.has(declared) && !(declared === '' && extensionLooksValid)) {
      throw new Error('Use somente imagens PNG ou JPG.');
    }
    if (Number(file?.size) > 12 * 1024 * 1024) throw new Error(`${file.name || 'Uma imagem'} ultrapassa 12 MB.`);
  }
  return list;
}

export async function readCarouselImageText(dataUrl, { fetchImpl = fetch, signal } = {}) {
  const [prepared] = await prepareImageReferencesForUpload([dataUrl]);
  const response = await fetchImpl('/api/ai/ocr', {
    method: 'POST',
    credentials: 'include',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ image: prepared }),
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* mensagem abaixo */ }
  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.error || `Não foi possível ler a imagem (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return String(payload.text || '').trim().slice(0, 18_000);
}

export async function extractCarouselImageEvidence(files, {
  fetchImpl,
  signal,
  onProgress,
  browserOcrFactory = createBrowserOcrSession,
} = {}) {
  const valid = validateCarouselOcrFiles(files);
  const evidence = [];
  const failures = [];
  let browserOcr = null;
  let preferBrowserOcr = false;
  let localCount = 0;
  try {
    for (let index = 0; index < valid.length; index += 1) {
      const file = valid[index];
      onProgress?.({ current: index + 1, total: valid.length, name: file.name, stage: preferBrowserOcr ? 'local' : 'server' });
      try {
        const dataUrl = await readAsDataUrl(file);
        let text = '';
        let serverError = null;
        if (!preferBrowserOcr) {
          try {
            text = await readCarouselImageText(dataUrl, { fetchImpl, signal });
          } catch (error) {
            if (error?.name === 'AbortError') throw error;
            serverError = error;
          }
        }
        if (!text) {
          if (serverError && !shouldUseBrowserOcrFallback(serverError)) throw serverError;
          if (!browserOcr) {
            browserOcr = await browserOcrFactory({
              signal,
              onProgress: (message) => onProgress?.({
                current: index + 1,
                total: valid.length,
                name: file.name,
                stage: 'local',
                progress: Number(message?.progress || 0),
              }),
            });
          }
          browserOcr.setProgress?.((message) => onProgress?.({
            current: index + 1,
            total: valid.length,
            name: file.name,
            stage: 'local',
            progress: Number(message?.progress || 0),
          }));
          text = await browserOcr.recognize(dataUrl);
          preferBrowserOcr = true;
          localCount += 1;
        }
        evidence.push({
          name: String(file.name || `Imagem ${index + 1}`).slice(0, 100),
          text: text.slice(0, CAROUSEL_OCR_MAX_TEXT_PER_IMAGE),
        });
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        failures.push({ name: file.name || `Imagem ${index + 1}`, error: error?.message || 'Falha na leitura.' });
      }
    }
  } finally {
    await browserOcr?.terminate?.();
  }
  return { evidence: normalizeCarouselImageEvidence(evidence), failures, localCount };
}
