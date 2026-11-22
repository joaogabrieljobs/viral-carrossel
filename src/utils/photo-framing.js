import smartcrop from 'smartcrop';
import { FORMATS } from './formats.js';

const cache = new Map();
const MAX_CACHE = 80;
const clamp = value => Math.max(0, Math.min(100, value));

function hasManualPhotoOffset(slide) {
  const offset = slide?.elementOffsets?.photo;
  return !!(offset && (Number(offset.x) !== 0 || Number(offset.y) !== 0));
}

/**
 * Projetos antigos não tinham `photoFraming`. Se a foto continua no recorte
 * central padrão, ela nunca foi posicionada pelo usuário e pode receber o
 * enquadramento inteligente com segurança. Qualquer ajuste legado é manual.
 */
export function usesAutomaticPhotoFraming(slide) {
  if (!slide || slide.photoFraming === 'manual') return false;
  if (slide.photoFraming === 'auto') return true;
  return (slide.bgX ?? 50) === 50
    && (slide.bgY ?? 50) === 50
    && (slide.bgZoom ?? 100) === 100
    && !hasManualPhotoOffset(slide);
}

/** Uma foto nova não deve herdar o recorte manual da imagem anterior. */
export function automaticPhotoFramingPatch(patch = {}, currentSlide = null) {
  const previousOffsets = currentSlide?.elementOffsets || patch.elementOffsets || {};
  return {
    ...patch,
    photoFraming: 'auto',
    bgFit: 'cover',
    bgX: 50,
    bgY: 50,
    bgZoom: 100,
    bgMirror: false,
    presentationImgAdjust: undefined,
    elementOffsets: { ...previousOffsets, photo: { x: 0, y: 0 } },
  };
}

/** CSS background-position é relativo à sobra do recorte, não ao centro da foto. */
export function cropToBackgroundPosition(crop, width, height) {
  if (!crop || !width || !height) return { bgX: 50, bgY: 50 };
  return {
    bgX: width - crop.width > 1 ? clamp(crop.x / (width - crop.width) * 100) : 50,
    bgY: height - crop.height > 1 ? clamp(crop.y / (height - crop.height) * 100) : 50,
  };
}

export function photoFramingRequest(slide, fmt) {
  if (!slide?.bgImage || !usesAutomaticPhotoFraming(slide) || slide.bgFit !== 'cover') return null;
  const f = FORMATS[fmt] || FORMATS.carrossel;
  const photo = (slide.canvas?.enabled || slide.canvas?.applied) && slide.canvas?.zones?.photo;
  const width = f.w * (photo ? photo.w / 100 : 1);
  const height = f.h * (photo ? photo.h / 100 : 1);
  if (!(width > 0 && height > 0)) return null;
  return { src: slide.bgImage, width, height, key: `${width / height}|${slide.bgImage}` };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const finish = (error) => {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      if (error) reject(error);
      else resolve(img);
    };
    const timer = setTimeout(() => finish(new Error('Imagem indisponível para enquadramento.')), 5000);
    img.onload = () => finish();
    img.onerror = () => finish(new Error('Imagem indisponível para enquadramento.'));
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}

async function faceBoosts(canvas) {
  // Melhoria progressiva: navegadores sem detector usam detalhe, contraste e
  // tons de pele. Nenhuma foto sai do navegador para realizar a análise.
  if (typeof globalThis.FaceDetector !== 'function') return [];
  let timer;
  try {
    const faces = await Promise.race([
      new globalThis.FaceDetector({ fastMode: true, maxDetectedFaces: 8 }).detect(canvas),
      new Promise(resolve => { timer = setTimeout(() => resolve([]), 500); }),
    ]);
    return faces.map(({ boundingBox: b }) => ({
      x: Math.max(0, b.x - b.width * 0.2),
      y: Math.max(0, b.y - b.height * 0.3),
      width: b.width * 1.4, height: b.height * 1.5, weight: 1,
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reteste 22/11: sem FaceDetector (a maioria dos navegadores), o smartcrop
 * escolhia a região de mais detalhe (mãos) e cortava a cabeça ao trocar de
 * formato. A pele mais alta da foto, em geral o rosto, vira reforço.
 */
const isSkin = (r, g, b) => r > 95 && g > 40 && b > 20 && r > g && r > b
  && (Math.max(r, g, b) - Math.min(r, g, b)) > 15 && Math.abs(r - g) > 15;

export function topSkinRegion(data, width, height) {
  if (!data || !(width > 0) || !(height > 0)) return null;
  const minRow = Math.max(2, Math.round(width * 0.04));
  let top = -1;
  for (let y = 0; y < height && top < 0; y += 1) {
    let count = 0;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (isSkin(data[i], data[i + 1], data[i + 2])) count += 1;
    }
    if (count >= minRow) top = y;
  }
  if (top < 0) return null;
  // Faixa abaixo do topo da pele, do tamanho de um rosto (até 18% da altura).
  const bottom = Math.min(height, top + Math.max(4, Math.round(height * 0.18)));
  let left = width; let right = -1;
  for (let y = top; y < bottom; y += 1) for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * 4;
    if (isSkin(data[i], data[i + 1], data[i + 2])) { left = Math.min(left, x); right = Math.max(right, x); }
  }
  if (right < left) return null;
  const pad = Math.round((right - left + 1) * 0.3);
  return {
    x: Math.max(0, left - pad), y: Math.max(0, top - pad),
    width: Math.min(width, right - left + 1 + pad * 2), height: Math.min(height, bottom - top + pad * 2), weight: 0.8,
  };
}

async function analyze({ src, width, height }) {
  const img = await loadImage(src);
  const scale = Math.min(1, 384 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  try {
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const faces = await faceBoosts(canvas);
    let boost = faces;
    if (!faces.length) {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      const head = topSkinRegion(pixels, canvas.width, canvas.height);
      boost = head ? [head] : [];
    }
    const result = await smartcrop.crop(canvas, {
      width, height, minScale: 1, maxScale: 1, prescale: false, boost,
    });
    return cropToBackgroundPosition(result.topCrop, canvas.width, canvas.height);
  } finally {
    canvas.width = canvas.height = 0;
  }
}

export function cachedPhotoFraming(request) {
  return request ? cache.get(request.key) : undefined;
}

export function requestPhotoFraming(request) {
  if (!request) return Promise.resolve(null);
  const existing = cache.get(request.key);
  if (existing) return existing.promise;
  // Uma análise por foto/proporção compartilhada por preview, tela cheia e export.
  const entry = { ready: false, position: null, promise: null };
  entry.promise = analyze(request).catch(() => null).then(position => {
    entry.position = position;
    entry.ready = true;
    return position;
  });
  cache.set(request.key, entry);
  if (cache.size > MAX_CACHE) {
    for (const [key, value] of cache) {
      if (value.ready) cache.delete(key);
      if (cache.size <= MAX_CACHE) break;
    }
  }
  return entry.promise;
}

/** Export só captura depois de o enquadramento calculado chegar ao DOM. */
export async function waitForPhotoFraming(roots, { timeoutMs = 7000 } = {}) {
  const started = Date.now();
  while ((roots || []).some(root => root?.getAttribute?.('data-vc-framing-pending') === 'true'
    || root?.closest?.('[data-vc-framing-pending="true"]'))) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('O enquadramento das fotos ainda está sendo preparado. Tente exportar novamente.');
    }
    await new Promise(resolve => setTimeout(resolve, 30));
  }
}
