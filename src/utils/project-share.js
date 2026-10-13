/**
 * Cliente de partilha de projeto entre contas da equipa.
 * Ao publicar: embute fotos (data URL) a partir do IndexedDB.
 * Ao entrar/puxar: grava essas fotos de volta no IndexedDB local.
 *
 * Limite: pedido serverless Vercel ~4,5 MB. Acima disso a plataforma devolve
 * 413 sem CORS e o browser mascara como "fetch failed".
 */

import { guardarImagemDoSlide, imagemComoDataUrl } from './image-store.js';
import { exportBrandLogo, exportSlideLogo, importBrandLogo, importSlideLogo } from './slide-logo.js';
import { exportProjectReferences, migrateProjectReferences } from './style-kit-storage.js';

const SHARE_API = '/api/project-share';
/**
 * Folga abaixo do FUNCTION_PAYLOAD_TOO_LARGE (~4,5 MB).
 * O envelope JSON ({action,name,doc}) também conta — por isso o tecto do doc
 * fica mais baixo que o do pedido.
 */
const MAX_SHARE_BODY_CHARS = 2_800_000;
const MAX_SHARE_DOC_CHARS = 2_500_000;
const SHARE_IMAGE_MAX_EDGE = 720;
const SHARE_IMAGE_MAX_CHARS = 220_000;

function stripRuntimeBlobs(value, depth = 0) {
  if (depth > 8 || value == null) return value;
  if (typeof value === 'string') {
    if (value.startsWith('blob:')) return null;
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => stripRuntimeBlobs(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = stripRuntimeBlobs(item, depth + 1);
    }
    return out;
  }
  return value;
}

function cloneDocForPack(doc) {
  const slides = Array.isArray(doc?.slides)
    ? doc.slides.map((s) => ({
      ...s,
      bgImage: typeof s?.bgImage === 'string' && s.bgImage.startsWith('data:')
        ? s.bgImage
        : null,
    }))
    : [];
  return {
    ...doc,
    slides,
    brand: doc?.brand
      ? {
        ...doc.brand,
        logo: typeof doc.brand.logo === 'string' && doc.brand.logo.startsWith('data:')
          ? doc.brand.logo
          : null,
      }
      : doc?.brand,
  };
}

/** Reduz data URL para caber no pedido de partilha (JPEG). */
async function compactDataUrlForShare(dataUrl) {
  const src = String(dataUrl || '');
  if (!src.startsWith('data:image/')) return null;
  if (src.length <= SHARE_IMAGE_MAX_CHARS && src.startsWith('data:image/jpeg')) return src;

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return src.length <= SHARE_IMAGE_MAX_CHARS ? src : null;
  }

  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('img'));
      image.src = src;
    });
    if (!img.naturalWidth || !img.naturalHeight) return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return src.length <= SHARE_IMAGE_MAX_CHARS ? src : null;

    for (const edge of [SHARE_IMAGE_MAX_EDGE, 720, 512]) {
      const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.72, 0.55, 0.4]) {
        const out = canvas.toDataURL('image/jpeg', quality);
        if (out.startsWith('data:image/jpeg') && out.length <= SHARE_IMAGE_MAX_CHARS) return out;
      }
    }
  } catch { /* fallback abaixo */ }

  return src.length <= SHARE_IMAGE_MAX_CHARS ? src : null;
}

function stripEmbeddedImages(doc) {
  const slides = Array.isArray(doc?.slides)
    ? doc.slides.map((s) => ({
      ...s,
      bgImage: typeof s?.bgImage === 'string' && s.bgImage.startsWith('data:') ? null : s?.bgImage,
    }))
    : [];
  const brand = doc?.brand && typeof doc.brand === 'object'
    ? {
      ...doc.brand,
      logo: typeof doc.brand.logo === 'string' && doc.brand.logo.startsWith('data:')
        ? null
        : doc.brand.logo,
    }
    : doc?.brand;
  let styleKit = doc?.styleKit;
  if (styleKit && typeof styleKit === 'object') {
    styleKit = {
      ...styleKit,
      refImages: Array.isArray(styleKit.refImages)
        ? styleKit.refImages.map((r) => (
          r && typeof r.dataUrl === 'string' && r.dataUrl.startsWith('data:')
            ? { ...r, dataUrl: undefined }
            : r
        )).filter((r) => r && (r.imageId || r.dataUrl))
        : [],
      logo: styleKit.logo && typeof styleKit.logo.dataUrl === 'string'
        ? { ...styleKit.logo, dataUrl: undefined, imageId: styleKit.logo.imageId }
        : styleKit.logo,
    };
  }
  return { ...doc, slides, brand, styleKit };
}

function countPackedDataImages(doc) {
  let n = 0;
  for (const s of doc?.slides || []) {
    if (typeof s?.bgImage === 'string' && s.bgImage.startsWith('data:')) n += 1;
  }
  return n;
}

/**
 * Prepara o documento para sync: texto + fotos embutidas em data URL compactas.
 */
export async function packDocWithImagesForShare(doc) {
  const working = cloneDocForPack(doc && typeof doc === 'object' ? doc : {});
  let packedImages = 0;
  let imagesOmitted = 0;

  working.slides = await Promise.all((working.slides || []).map(async (slide) => {
    let next = await exportSlideLogo(slide);
    let dataUrl = typeof next.bgImage === 'string' && next.bgImage.startsWith('data:')
      ? next.bgImage
      : null;
    if (!dataUrl && next.bgImageId) {
      try {
        dataUrl = await imagemComoDataUrl(next.bgImageId);
      } catch { /* mantém sem imagem */ }
    }
    if (dataUrl) {
      const compact = await compactDataUrlForShare(dataUrl);
      if (compact) {
        next = { ...next, bgImage: compact };
        packedImages += 1;
      } else {
        next = { ...next, bgImage: null };
        imagesOmitted += 1;
      }
    }
    if (typeof next.bgImage === 'string' && next.bgImage.startsWith('blob:')) {
      next = { ...next, bgImage: null };
    }
    return next;
  }));

  try {
    working.brand = await exportBrandLogo(working.brand);
    if (typeof working.brand?.logo === 'string' && working.brand.logo.startsWith('data:')) {
      const logo = await compactDataUrlForShare(working.brand.logo);
      working.brand = { ...working.brand, logo };
    }
  } catch { /* ignore */ }
  // Moodboard / refs de estilo incham o pedido — partilha leva só o brief em texto.
  if (working.styleKit && typeof working.styleKit === 'object') {
    working.styleKit = {
      ...working.styleKit,
      refImages: [],
      logo: working.styleKit.logo
        ? { imageId: working.styleKit.logo.imageId, name: working.styleKit.logo.name }
        : working.styleKit.logo,
    };
  }

  let clean = stripRuntimeBlobs(working);
  let serialized = JSON.stringify(clean);

  // Remove fotos uma a uma até caber (em vez de tirar todas de uma vez).
  while (serialized.length > MAX_SHARE_DOC_CHARS && countPackedDataImages(clean) > 0) {
    let dropped = false;
    clean = {
      ...clean,
      slides: (clean.slides || []).map((s) => {
        if (dropped) return s;
        if (typeof s?.bgImage === 'string' && s.bgImage.startsWith('data:')) {
          dropped = true;
          imagesOmitted += 1;
          packedImages = Math.max(0, packedImages - 1);
          return { ...s, bgImage: null };
        }
        return s;
      }),
    };
    if (!dropped) break;
    serialized = JSON.stringify(clean);
  }

  if (serialized.length > MAX_SHARE_DOC_CHARS) {
    const before = countPackedDataImages(clean);
    clean = stripEmbeddedImages(clean);
    imagesOmitted += before;
    packedImages = 0;
    serialized = JSON.stringify(clean);
  }

  // Último recurso: material/referências longas.
  if (serialized.length > MAX_SHARE_DOC_CHARS && clean.material) {
    clean = {
      ...clean,
      material: {
        ...(clean.material || {}),
        content: String(clean.material.content || '').slice(0, 12_000),
        sources: String(clean.material.sources || '').slice(0, 4_000),
        context: String(clean.material.context || '').slice(0, 4_000),
      },
    };
    serialized = JSON.stringify(clean);
  }

  return {
    doc: {
      ...clean,
      shareMeta: {
        ...(clean.shareMeta || {}),
        syncedAt: Date.now(),
        packedImages,
        includesImages: packedImages > 0,
        imagesOmitted,
        payloadChars: serialized.length,
      },
    },
    packedImages,
    imagesOmitted,
    payloadChars: serialized.length,
  };
}

/** Compat: versão síncrona (mantém data URLs já presentes). */
export function sanitizeDocForShare(doc) {
  const clean = stripRuntimeBlobs(cloneDocForPack(doc && typeof doc === 'object' ? doc : {}));
  return {
    ...clean,
    shareMeta: {
      ...(clean.shareMeta || {}),
      syncedAt: Date.now(),
    },
  };
}

/**
 * Depois de puxar da equipa: data URLs / https → IndexedDB local + object URLs.
 */
export async function hydrateSharedDocImages(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const next = { ...doc };

  try {
    next.styleKit = await migrateProjectReferences(next.styleKit);
  } catch { /* ignore */ }
  try {
    next.brand = await importBrandLogo(next.brand);
  } catch { /* ignore */ }

  if (!Array.isArray(next.slides)) return next;

  next.slides = await Promise.all(next.slides.map(async (slide) => {
    let sl = await importSlideLogo(slide);
    const src = typeof sl?.bgImage === 'string' ? sl.bgImage : '';
    if (!src) return { ...sl, bgImage: null };

    if (src.startsWith('data:')) {
      try {
        return {
          ...sl,
          ...(await guardarImagemDoSlide(src)),
          bgImageFailed: false,
          bgImageError: null,
        };
      } catch {
        return { ...sl, bgImage: null };
      }
    }

    if (/^https:\/\//i.test(src)) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20_000);
        let res;
        try {
          res = await fetch(src, { credentials: 'omit', signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const packed = await guardarImagemDoSlide(blob);
        return {
          ...sl,
          ...packed,
          bgImageFailed: false,
          bgImageError: null,
        };
      } catch {
        return {
          ...sl,
          bgImage: null,
          bgImageFailed: true,
          bgImageError: 'Falha ao abrir imagem da equipa',
        };
      }
    }

    if (src.startsWith('blob:')) {
      return { ...sl, bgImage: null };
    }
    return sl;
  }));

  return next;
}

async function shareRequest(payload, { method = 'POST', code } = {}) {
  const url = method === 'GET'
    ? `${SHARE_API}?code=${encodeURIComponent(code || '')}`
    : SHARE_API;
  const body = method === 'GET' ? undefined : JSON.stringify(payload);
  if (body && body.length > MAX_SHARE_BODY_CHARS) {
    throw new Error(
      'Projeto grande demais para partilhar de uma vez. Remova algumas fotos dos cards e tente de novo.',
    );
  }
  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
      body,
    });
  } catch (e) {
    const raw = String(e?.message || e || '');
    if (/failed to fetch|fetch failed|networkerror|load failed/i.test(raw)) {
      throw new Error(
        'Não foi possível partilhar (rede ou projeto demasiado grande com fotos). Tente de novo; se falhar, remova fotos pesadas dos cards.',
      );
    }
    throw e instanceof Error ? e : new Error(raw || 'Falha na partilha.');
  }
  const rawText = await res.text().catch(() => '');
  let data = {};
  try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = {}; }
  if (!res.ok) {
    if (res.status === 413 || /PAYLOAD_TOO_LARGE|Entity Too Large/i.test(rawText)) {
      throw new Error(
        'Projeto grande demais para o servidor (fotos). Remova ou regenere imagens mais leves e tente de novo.',
      );
    }
    if (res.status === 401) {
      throw new Error(typeof data?.error === 'string' ? data.error : 'Faça login pela assinatura para partilhar.');
    }
    if (res.status === 503) {
      throw new Error(
        typeof data?.error === 'string'
          ? data.error
          : 'Partilha indisponível no servidor (Blob/Redis). Peça ao admin para configurar o armazenamento.',
      );
    }
    if (res.status === 404) {
      throw new Error(
        typeof data?.error === 'string'
          ? `${data.error} Crie um link novo em «Criar link para a equipa» (códigos antigos podem ter falhado ao gravar).`
          : 'Código inválido ou expirado. Peça um link novo à equipa.',
      );
    }
    const errMsg = typeof data?.error === 'string'
      ? data.error
      : (data?.error?.message || (rawText && rawText.length < 180 ? rawText.trim() : null) || `Falha na partilha (${res.status})`);
    throw new Error(errMsg);
  }
  return data;
}

export async function createProjectShare({ doc, name }) {
  const { doc: packed, packedImages, imagesOmitted } = await packDocWithImagesForShare(doc);
  const res = await shareRequest({
    action: 'create',
    name,
    doc: packed,
  });
  return { ...res, packedImages, imagesOmitted };
}

export async function pushProjectShare({ code, doc, name }) {
  const { doc: packed, packedImages, imagesOmitted } = await packDocWithImagesForShare(doc);
  const res = await shareRequest({
    action: 'push',
    code,
    name,
    doc: packed,
  });
  return { ...res, packedImages, imagesOmitted };
}

export async function joinProjectShare(code) {
  const normalized = normalizeShareCode(code);
  if (!normalized) {
    throw new Error('Código incompleto — use o código de 8 caracteres ou o link completo ?share=…');
  }
  return shareRequest({ action: 'join', code: normalized });
}

export async function pullProjectShare(code) {
  return shareRequest(null, { method: 'GET', code: String(code || '').trim().toUpperCase() });
}

/** sessionStorage: sobrevive ao OAuth Google que devolve sem ?share= */
export const PENDING_SHARE_KEY = 'vc_pending_share';

export function normalizeShareCode(raw) {
  const code = String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length >= 6 && code.length <= 12 ? code : '';
}

/** Link de convite: https://…/?share=AB12CD34&app=1 */
export function buildTeamShareInviteUrl(code, origin) {
  const normalized = normalizeShareCode(code);
  if (!normalized) return '';
  let base = origin;
  if (!base && typeof globalThis !== 'undefined' && globalThis.location?.origin) {
    base = globalThis.location.origin;
  }
  if (!base) base = 'https://viralcarrossel.com.br';
  const url = new URL('/', base);
  url.searchParams.set('share', normalized);
  url.searchParams.set('app', '1');
  return url.toString();
}

export function readShareCodeFromSearch(search) {
  try {
    const q = new URLSearchParams(String(search || '').replace(/^\?/, ''));
    return normalizeShareCode(q.get('share'));
  } catch {
    return '';
  }
}

export function stashPendingShareCode(code) {
  const normalized = normalizeShareCode(code);
  if (!normalized || typeof sessionStorage === 'undefined') return '';
  try { sessionStorage.setItem(PENDING_SHARE_KEY, normalized); } catch { /* */ }
  return normalized;
}

export function peekPendingShareCode() {
  if (typeof sessionStorage === 'undefined') return '';
  try {
    return normalizeShareCode(sessionStorage.getItem(PENDING_SHARE_KEY));
  } catch {
    return '';
  }
}

export function consumePendingShareCode() {
  const code = peekPendingShareCode();
  if (!code || typeof sessionStorage === 'undefined') return code;
  try { sessionStorage.removeItem(PENDING_SHARE_KEY); } catch { /* */ }
  return code;
}

/** Grava ?share= no stash e remove da URL (OAuth / reload limpos). */
export function captureShareInviteFromLocation() {
  if (typeof globalThis === 'undefined' || !globalThis.location) return '';
  const fromUrl = readShareCodeFromSearch(globalThis.location.search);
  if (fromUrl) stashPendingShareCode(fromUrl);
  const pending = peekPendingShareCode();
  if (fromUrl) {
    try {
      const url = new URL(globalThis.location.href);
      url.searchParams.delete('share');
      const next = url.pathname + url.search + url.hash;
      globalThis.history?.replaceState?.({}, '', next);
    } catch { /* */ }
  }
  return pending;
}
