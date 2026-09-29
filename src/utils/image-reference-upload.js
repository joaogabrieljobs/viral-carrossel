import {
  MAX_IMAGE_REFERENCES, MAX_REFERENCE_BYTES,
  REFERENCE_DATA_URL_PATTERN, isHttpsImageReference,
} from '../../shared/image-references.js';

function referenceError(message) {
  return Object.assign(new Error(message), { code: 'reference_invalid', platformImage: true });
}

function fitsUpload(value) {
  const encoded = value.slice(value.indexOf(',') + 1);
  return (encoded.length * 3 / 4) - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0) <= MAX_REFERENCE_BYTES;
}

async function prepareReference(value) {
  if (isHttpsImageReference(value)) return value;
  if (typeof value !== 'string' || !REFERENCE_DATA_URL_PATTERN.test(value)) {
    throw referenceError('Use referências PNG, JPEG ou WebP. Nenhum crédito foi usado.');
  }
  if (fitsUpload(value)) return value;

  // Apenas a cópia de envio é reduzida; o original no projeto continua intacto.
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(referenceError('Não foi possível abrir uma referência. Reenvie a imagem.'));
    image.src = value;
  });
  if (!img.naturalWidth || !img.naturalHeight) throw referenceError('Referência sem dimensões válidas.');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw referenceError('Não foi possível preparar a referência neste navegador.');
  for (const edge of [1536, 1024, 768]) {
    const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.88, 0.72, 0.55]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (result.startsWith('data:image/jpeg;base64,') && fitsUpload(result)) return result;
    }
  }
  throw referenceError('Uma referência é grande demais para enviar. Escolha uma imagem menor. Nenhum crédito foi usado.');
}

export async function prepareImageReferencesForUpload(refs = []) {
  if (!Array.isArray(refs) || refs.length > MAX_IMAGE_REFERENCES) {
    throw referenceError('Envie até quatro referências por imagem.');
  }
  try { return await Promise.all(refs.map(prepareReference)); }
  catch (error) { throw Object.assign(error, { platformImage: true }); }
}
