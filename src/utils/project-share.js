/**
 * Cliente de partilha de projeto entre contas da equipa.
 * Ao publicar: embute fotos (data URL) a partir do IndexedDB.
 * Ao entrar/puxar: grava essas fotos de volta no IndexedDB local.
 */

import { guardarImagemDoSlide, imagemComoDataUrl } from './image-store.js';
import { exportBrandLogo, exportSlideLogo, importBrandLogo, importSlideLogo } from './slide-logo.js';
import { exportProjectReferences, migrateProjectReferences } from './style-kit-storage.js';

const SHARE_API = '/api/project-share';

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

/**
 * Prepara o documento para sync: texto + fotos embutidas em data URL.
 */
export async function packDocWithImagesForShare(doc) {
  const working = cloneDocForPack(doc && typeof doc === 'object' ? doc : {});
  let packedImages = 0;

  working.slides = await Promise.all((working.slides || []).map(async (slide) => {
    let next = await exportSlideLogo(slide);
    const hasData = typeof next.bgImage === 'string' && next.bgImage.startsWith('data:');
    if (!hasData && next.bgImageId) {
      try {
        const dataUrl = await imagemComoDataUrl(next.bgImageId);
        if (dataUrl) {
          next = { ...next, bgImage: dataUrl };
          packedImages += 1;
        }
      } catch { /* mantém sem imagem */ }
    } else if (hasData) {
      packedImages += 1;
    }
    if (typeof next.bgImage === 'string' && next.bgImage.startsWith('blob:')) {
      next = { ...next, bgImage: null };
    }
    return next;
  }));

  try {
    working.brand = await exportBrandLogo(working.brand);
  } catch { /* ignore */ }
  try {
    working.styleKit = await exportProjectReferences(working.styleKit);
  } catch { /* ignore */ }

  const clean = stripRuntimeBlobs(working);
  return {
    doc: {
      ...clean,
      shareMeta: {
        ...(clean.shareMeta || {}),
        syncedAt: Date.now(),
        packedImages,
        includesImages: packedImages > 0,
      },
    },
    packedImages,
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
  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(payload),
    });
  } catch (e) {
    const raw = String(e?.message || e || '');
    if (/failed to fetch|fetch failed|networkerror|load failed/i.test(raw)) {
      throw new Error(
        'Não foi possível contactar o servidor de partilha. Em local, reinicie o Vite; em produção, confirme o deploy da API.',
      );
    }
    throw e instanceof Error ? e : new Error(raw || 'Falha na partilha.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = typeof data?.error === 'string'
      ? data.error
      : (data?.error?.message || `Falha na partilha (${res.status})`);
    throw new Error(errMsg);
  }
  return data;
}

export async function createProjectShare({ doc, name }) {
  const { doc: packed, packedImages } = await packDocWithImagesForShare(doc);
  const res = await shareRequest({
    action: 'create',
    name,
    doc: packed,
  });
  return { ...res, packedImages };
}

export async function pushProjectShare({ code, doc, name }) {
  const { doc: packed, packedImages } = await packDocWithImagesForShare(doc);
  const res = await shareRequest({
    action: 'push',
    code,
    name,
    doc: packed,
  });
  return { ...res, packedImages };
}

export async function joinProjectShare(code) {
  return shareRequest({ action: 'join', code: String(code || '').trim().toUpperCase() });
}

export async function pullProjectShare(code) {
  return shareRequest(null, { method: 'GET', code: String(code || '').trim().toUpperCase() });
}
