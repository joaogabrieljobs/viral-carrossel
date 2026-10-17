/**
 * Cliente de partilha de projeto entre contas da equipa.
 * Ao publicar: embute fotos (data URL) a partir do IndexedDB.
 * Ao entrar/puxar: grava essas fotos de volta no IndexedDB local.
 *
 * Limite: pedido serverless Vercel ~4,5 MB. Acima disso a plataforma devolve
 * 413 sem CORS e o browser mascara como "fetch failed".
 */

import { guardarImagemDoSlide, imagemComoDataUrl } from './image-store.js';
import { ensurePngDataUrl, exportBrandLogo, exportSlideLogo, importBrandLogo, importSlideLogo } from './slide-logo.js';
import { exportSlideReference, importSlideReference } from './slide-reference.js';
import { exportProjectReferences, migrateProjectReferences } from './style-kit-storage.js';

const TEAM_SHARE_API = '/api/project-share';
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

function forgetForeignAsset(slide) {
  if (!slide || typeof slide !== 'object') return slide;
  const next = { ...slide };
  delete next.bgImageAssetId;
  return next;
}

async function assembleAssetDataUrl(load) {
  const data = await load();
  let dataUrl = data?.asset?.dataUrl || null;
  if (data?.asset?.chunked) {
    const total = Number(data.asset.total);
    const totalChars = Number(data.asset.totalChars);
    if (!Number.isInteger(total) || total < 1 || !Number.isInteger(totalChars) || totalChars < 1) return null;
    const parts = [];
    for (let index = 0; index < total; index += 1) {
      const part = await load(index);
      const value = part?.asset?.data;
      if (part?.asset?.index !== index || typeof value !== 'string' || !value) return null;
      parts.push(value);
    }
    dataUrl = parts.join('');
    if (dataUrl.length !== totalChars) return null;
  }
  return typeof dataUrl === 'string' && dataUrl.startsWith('data:image/') ? dataUrl : null;
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

function isDataImage(value) {
  return typeof value === 'string' && value.startsWith('data:image/');
}

/** A mesma logo em todos os cards não precisa viajar 23 vezes. */
function dedupeRepeatedLogos(doc) {
  const slides = Array.isArray(doc?.slides) ? doc.slides : [];
  const logo = slides.find((slide) => isDataImage(slide?.logoImage))?.logoImage;
  if (!logo) return doc;
  const copies = slides.filter((slide) => slide?.logoImage === logo).length;
  if (copies < 2) return doc;
  const brand = doc.brand && typeof doc.brand === 'object' ? { ...doc.brand } : {};
  if (!isDataImage(brand.logo) && logo.startsWith('data:image/png;') && logo.length <= SHARE_IMAGE_MAX_CHARS) {
    brand.logo = logo;
  }
  return {
    ...doc,
    brand,
    slides: slides.map((slide) => (
      slide?.logoImage === logo
        ? { ...slide, logoImage: null, logoImageId: undefined }
        : slide
    )),
  };
}

function stripDataImages(value, depth = 0) {
  if (depth > 12 || value == null) return { value, removed: 0 };
  if (typeof value === 'string') {
    return isDataImage(value) ? { value: null, removed: 1 } : { value, removed: 0 };
  }
  if (Array.isArray(value)) {
    let removed = 0;
    const next = value.map((item) => {
      const stripped = stripDataImages(item, depth + 1);
      removed += stripped.removed;
      return stripped.value;
    });
    return { value: next, removed };
  }
  if (typeof value === 'object') {
    let removed = 0;
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      const stripped = stripDataImages(item, depth + 1);
      removed += stripped.removed;
      next[key] = stripped.value;
    }
    return { value: next, removed };
  }
  return { value, removed: 0 };
}

/**
 * Prepara o documento para sync: texto + fotos embutidas em data URL compactas.
 */
export async function packDocWithImagesForShare(doc) {
  const working = cloneDocForPack(doc && typeof doc === 'object' ? doc : {});
  let packedImages = 0;
  let imagesOmitted = 0;

  working.slides = await Promise.all((working.slides || []).map(async (slide) => {
    let next = slide;
    // Logo e referência que já estão na nuvem não entram no JSON. A outra
    // conta lê o arquivo original pelo código, um por vez.
    if (next.logoImageAssetId) {
      next = { ...next, logoImage: null, logoImageId: undefined };
    } else {
      try { next = await exportSlideLogo(next); } catch { /* logo local em falta não bloqueia o texto */ }
    }
    if (next.refImageAssetId) {
      next = { ...next, refImage: null, refImageId: undefined };
    } else {
      next = await exportSlideReference(next);
    }
    // A foto já está na nuvem de quem publica. Embutir aqui a reduziria a
    // 720 px. A outra conta lê o arquivo original pelo código.
    if (next.bgImageAssetId) {
      next = { ...next, bgImage: null, bgImageId: undefined };
    } else {
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
          next = { ...next, bgImage: compact, bgImageId: undefined };
          packedImages += 1;
        } else {
          next = { ...next, bgImage: null };
          imagesOmitted += 1;
        }
      }
    }
    if (typeof next.bgImage === 'string' && next.bgImage.startsWith('blob:')) {
      next = { ...next, bgImage: null };
    }
    return next;
  }));

  try {
    working.brand = await exportBrandLogo(working.brand);
    // JPEG apaga a transparência e o import só aceita PNG. Logo grande fica
    // só com o id, para a outra conta ler o PNG original.
    if (working.brand && typeof working.brand === 'object') {
      const logo = working.brand.logo;
      const portablePng = typeof logo === 'string'
        && logo.startsWith('data:image/png;')
        && logo.length <= SHARE_IMAGE_MAX_CHARS;
      working.brand = {
        ...working.brand,
        logo: portablePng ? logo : null,
      };
    }
  } catch { /* ignore */ }
  // Moodboard / refs de estilo incham o pedido — partilha leva só o brief em texto.
  if (working.styleKit && typeof working.styleKit === 'object') {
    working.styleKit = {
      ...working.styleKit,
      refImages: [],
      logo: working.styleKit.logo
        ? {
          imageId: working.styleKit.logo.imageId,
          assetId: working.styleKit.logo.assetId,
          name: working.styleKit.logo.name,
        }
        : working.styleKit.logo,
    };
  }

  let clean = dedupeRepeatedLogos(stripRuntimeBlobs(working));
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
          return { ...s, bgImage: null, bgImageAssetId: s.bgImageAssetId };
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

  // Logo, referência ou outra imagem que o corte das fotos não alcança.
  if (serialized.length > MAX_SHARE_DOC_CHARS) {
    const stripped = stripDataImages(clean);
    if (stripped.removed > 0) {
      imagesOmitted += stripped.removed;
      clean = stripped.value;
      packedImages = countPackedDataImages(clean);
      serialized = JSON.stringify(clean);
    }
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

async function adoptShareLogo(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null;
  const png = await ensurePngDataUrl(dataUrl);
  if (png?.startsWith('data:image/png;') || png?.startsWith('data:image/jpeg')) return png;
  return null;
}

/**
 * Depois de puxar da equipa: data URLs / fotos do dono da partilha → IndexedDB local.
 * O ID do asset fica na conta de quem publicou; nesta conta ele é apagado
 * para o editor não o procurar no Blob errado.
 */
export async function hydrateSharedDocImages(doc, { code } = {}) {
  if (!doc || typeof doc !== 'object') return doc;
  const shareCode = normalizeShareCode(code || doc.shareCode || '');
  const next = { ...doc };

  try {
    next.styleKit = await migrateProjectReferences(next.styleKit);
  } catch { /* ignore */ }
  try {
    const brandLogoIsPng = typeof next.brand?.logo === 'string' && next.brand.logo.startsWith('data:image/png;');
    if (shareCode && next.brand?.logoAssetId && !brandLogoIsPng) {
      const logo = await adoptShareLogo(await fetchShareAssetDataUrl(shareCode, next.brand.logoAssetId));
      next.brand = logo
        ? { ...next.brand, logo, logoAssetId: undefined, logoForeign: undefined }
        : { ...next.brand, logo: null, logoAssetId: undefined, logoForeign: true };
    }
    next.brand = await importBrandLogo(next.brand);
  } catch { /* ignore */ }

  if (!Array.isArray(next.slides)) return next;

  next.slides = await Promise.all(next.slides.map(async (slide) => {
    let sl = await importSlideLogo(slide);
    try { sl = await importSlideReference(sl); } catch { /* a referência em data URL é o caminho normal */ }

    const slideLogoIsPng = typeof sl.logoImage === 'string' && sl.logoImage.startsWith('data:image/png;');
    if (shareCode && sl?.logoImageAssetId && !slideLogoIsPng) {
      const logo = await adoptShareLogo(await fetchShareAssetDataUrl(shareCode, sl.logoImageAssetId));
      if (logo) {
        sl = { ...sl, logoImage: logo, logoImageAssetId: undefined, logoImageForeign: undefined };
        try { sl = await importSlideLogo(sl); } catch { /* */ }
      } else {
        sl = { ...sl, logoImage: null, logoImageAssetId: undefined, logoImageForeign: true };
      }
    }
    if (shareCode && sl?.refImageAssetId && !(typeof sl.refImage === 'string' && sl.refImage.startsWith('data:'))) {
      const ref = await fetchShareAssetDataUrl(shareCode, sl.refImageAssetId);
      if (ref) {
        sl = { ...sl, refImage: ref, refImageAssetId: undefined, refImageId: undefined };
        try { sl = await importSlideReference(sl); } catch { /* */ }
      }
    }

    let src = '';
    if (sl?.bgImageAssetId && shareCode) {
      src = await fetchShareAssetDataUrl(shareCode, sl.bgImageAssetId) || '';
    }
    if (!src) src = typeof sl?.bgImage === 'string' ? sl.bgImage : '';
    if (!src || src.startsWith('blob:')) {
      if (sl?.bgImageAssetId) {
        return {
          ...sl,
          bgImage: null,
          bgImageFailed: true,
          bgImageForeign: true,
          bgImageError: 'A foto da equipa não chegou. Puxe as alterações novamente.',
        };
      }
      return forgetForeignAsset({ ...sl, bgImage: null });
    }

    if (src.startsWith('data:')) {
      try {
        return {
          ...forgetForeignAsset(sl),
          ...(await guardarImagemDoSlide(src)),
          bgImageFailed: false,
          bgImageError: null,
        };
      } catch {
        return forgetForeignAsset({ ...sl, bgImage: null });
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
          ...forgetForeignAsset(sl),
          ...packed,
          bgImageFailed: false,
          bgImageError: null,
        };
      } catch {
        return {
          ...forgetForeignAsset(sl),
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

async function shareRequest(payload, { method = 'POST', code, asset, part } = {}) {
  const params = new URLSearchParams();
  if (code) params.set('code', code);
  if (asset) params.set('asset', asset);
  if (part !== undefined) params.set('part', String(part));
  const url = method === 'GET'
    ? `${TEAM_SHARE_API}?${params.toString()}`
    : TEAM_SHARE_API;
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

async function fetchShareAssetDataUrl(code, assetId) {
  if (!code || !assetId) return null;
  try {
    return await assembleAssetDataUrl(async (part) => shareRequest(null, {
      method: 'GET', code, asset: assetId, part,
    }));
  } catch {
    return null;
  }
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

/** Link de convite sempre no domínio da sessão: https://moont.ai/?share=AB12CD34&app=1 */
export function buildTeamShareInviteUrl(code, origin) {
  const normalized = normalizeShareCode(code);
  if (!normalized) return '';
  const base = origin || 'https://moont.ai';
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
