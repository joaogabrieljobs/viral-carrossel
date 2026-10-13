/**
 * Sync da biblioteca com a nuvem (por conta autenticada).
 * Manifesto leve + assets de imagem enviados à parte (limite body serverless).
 */
import { SK, lsSet } from './storage.js';
import { lsGet } from './telemetry.js';
import { imagemComoDataUrl, guardarImagemDoSlide, newImageId } from './image-store.js';
import { exportBrandLogo, exportSlideLogo, importBrandLogo, importSlideLogo } from './slide-logo.js';
import { exportProjectReferences, migrateProjectReferences } from './style-kit-storage.js';
import { USER_PROFILE_KEY } from './user-profile.js';

export const LIBRARY_CLOUD_META_KEY = SK.libraryCloudMeta;
const SYNC_API = '/api/library-sync';
const MAX_BODY_CHARS = 2_800_000;
const MAX_ASSET_CHARS = 2_200_000;
const IMAGE_MAX_EDGE = 960;
const IMAGE_MAX_CHARS = 280_000;

function readCloudMeta() {
  try {
    const raw = localStorage.getItem(LIBRARY_CLOUD_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeCloudMeta(meta) {
  try {
    localStorage.setItem(LIBRARY_CLOUD_META_KEY, JSON.stringify(meta));
  } catch { /* quota */ }
}

async function compactDataUrl(dataUrl) {
  const src = String(dataUrl || '');
  if (!src.startsWith('data:image/')) return null;
  if (src.length <= IMAGE_MAX_CHARS && src.startsWith('data:image/jpeg')) return src;
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return src.length <= MAX_ASSET_CHARS ? src : null;
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
    if (!ctx) return src.length <= IMAGE_MAX_CHARS ? src : null;
    for (const edge of [IMAGE_MAX_EDGE, 720, 512]) {
      const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.78, 0.6, 0.45]) {
        const out = canvas.toDataURL('image/jpeg', quality);
        if (out.startsWith('data:image/jpeg') && out.length <= IMAGE_MAX_CHARS) return out;
      }
    }
  } catch { /* */ }
  return src.length <= MAX_ASSET_CHARS ? src : null;
}

function stripRuntime(value, depth = 0) {
  if (depth > 10 || value == null) return value;
  if (typeof value === 'string') {
    if (value.startsWith('blob:')) return null;
    if (value.startsWith('data:image/')) return null;
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => stripRuntime(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = stripRuntime(v, depth + 1);
    return out;
  }
  return value;
}

async function collectAsset(dataUrl, preferredId, bag) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null;
  const compact = await compactDataUrl(dataUrl);
  if (!compact) return null;
  const assetId = String(preferredId || newImageId()).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  if (!bag.has(assetId)) bag.set(assetId, compact);
  return assetId;
}

async function packSlideForCloud(slide, assets) {
  let sl = await exportSlideLogo(slide);
  let bgAssetId = null;
  let dataUrl = typeof sl.bgImage === 'string' && sl.bgImage.startsWith('data:') ? sl.bgImage : null;
  if (!dataUrl && sl.bgImageId) {
    try { dataUrl = await imagemComoDataUrl(sl.bgImageId); } catch { /* */ }
  }
  if (dataUrl) bgAssetId = await collectAsset(dataUrl, sl.bgImageId, assets);

  let logoAssetId = null;
  if (typeof sl.logoImage === 'string' && sl.logoImage.startsWith('data:')) {
    logoAssetId = await collectAsset(sl.logoImage, sl.logoImageId, assets);
  } else if (sl.logoImageId) {
    try {
      const logoUrl = await imagemComoDataUrl(sl.logoImageId);
      logoAssetId = await collectAsset(logoUrl, sl.logoImageId, assets);
    } catch { /* */ }
  }

  const clean = stripRuntime({
    ...sl,
    bgImage: null,
    logoImage: null,
    bgImageAssetId: bgAssetId || undefined,
    logoImageAssetId: logoAssetId || undefined,
  });
  return clean;
}

async function packBrandForCloud(brand, assets) {
  let packed = brand;
  try { packed = await exportBrandLogo(brand); } catch { /* */ }
  let logoAssetId = null;
  if (typeof packed?.logo === 'string' && packed.logo.startsWith('data:')) {
    logoAssetId = await collectAsset(packed.logo, packed.logoImageId, assets);
  } else if (packed?.logoImageId) {
    try {
      const url = await imagemComoDataUrl(packed.logoImageId);
      logoAssetId = await collectAsset(url, packed.logoImageId, assets);
    } catch { /* */ }
  }
  return stripRuntime({
    ...packed,
    logo: null,
    logoAssetId: logoAssetId || undefined,
  });
}

async function packStyleKitForCloud(styleKit, assets) {
  let kit = styleKit;
  try { kit = await exportProjectReferences(styleKit); } catch { /* */ }
  const refs = [];
  for (const ref of (kit?.refImages || [])) {
    let dataUrl = typeof ref?.dataUrl === 'string' && ref.dataUrl.startsWith('data:')
      ? ref.dataUrl
      : null;
    if (!dataUrl && ref?.imageId) {
      try { dataUrl = await imagemComoDataUrl(ref.imageId); } catch { /* */ }
    }
    const assetId = await collectAsset(dataUrl, ref?.imageId, assets);
    if (assetId) refs.push({ name: ref?.name, assetId });
  }
  let logoAssetId = null;
  if (kit?.logo?.dataUrl) {
    logoAssetId = await collectAsset(kit.logo.dataUrl, kit.logo.imageId, assets);
  } else if (kit?.logo?.imageId) {
    try {
      const url = await imagemComoDataUrl(kit.logo.imageId);
      logoAssetId = await collectAsset(url, kit.logo.imageId, assets);
    } catch { /* */ }
  }
  return stripRuntime({
    ...kit,
    refImages: refs,
    logo: kit?.logo
      ? { name: kit.logo.name, assetId: logoAssetId || undefined }
      : kit?.logo,
  });
}

/**
 * Lê biblioteca local e monta manifesto + mapa de assets.
 */
export async function packLibraryForCloud() {
  const docsRaw = lsGet(SK.library, []) || [];
  const folders = lsGet(SK.libraryFolders, []) || [];
  const brandsRaw = lsGet(SK.brands, []) || [];
  const activeBrandId = lsGet(SK.activeBrandId, '') || '';
  const activeDocId = lsGet(SK.activeDocId, '') || '';
  let userProfile = null;
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (raw) userProfile = JSON.parse(raw);
  } catch { /* */ }

  const assets = new Map();
  const docs = [];
  for (const entry of docsRaw) {
    if (!entry?.doc) {
      docs.push(stripRuntime(entry));
      continue;
    }
    const slides = Array.isArray(entry.doc.slides)
      ? await Promise.all(entry.doc.slides.map((s) => packSlideForCloud(s, assets)))
      : [];
    docs.push(stripRuntime({
      ...entry,
      doc: {
        ...entry.doc,
        slides,
        brand: await packBrandForCloud(entry.doc.brand, assets),
        styleKit: await packStyleKitForCloud(entry.doc.styleKit, assets),
      },
    }));
  }

  const brands = [];
  for (const profile of brandsRaw) {
    brands.push(await packBrandForCloud(profile, assets));
  }

  const assetIds = [...assets.keys()];
  let onboardingDone = null;
  let modesIntroDone = null;
  try {
    onboardingDone = localStorage.getItem(SK.onboarding);
    modesIntroDone = localStorage.getItem(SK.modesIntro);
  } catch { /* */ }
  const manifest = {
    vcVersion: 3,
    folders,
    brands,
    activeBrandId,
    activeDocId,
    docs,
    assetIds,
    userProfile: userProfile && typeof userProfile === 'object' ? stripRuntime(userProfile) : null,
    onboardingDone: onboardingDone || null,
    modesIntroDone: modesIntroDone || null,
  };

  return { manifest, assets, projectCount: docs.length };
}

async function syncRequest(payload, { method = 'POST', query = '' } = {}) {
  const url = query ? `${SYNC_API}?${query}` : SYNC_API;
  const body = method === 'GET' ? undefined : JSON.stringify(payload);
  if (body && body.length > MAX_BODY_CHARS) {
    throw new Error('Pedido de sync demasiado grande. Tente de novo (imagens serão enviadas à parte).');
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
    if (/failed to fetch|networkerror|load failed/i.test(raw)) {
      throw new Error('Não foi possível sincronizar (rede). Verifique a ligação e tente de novo.');
    }
    throw e instanceof Error ? e : new Error(raw);
  }
  const rawText = await res.text().catch(() => '');
  let data = {};
  try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = {}; }
  if (!res.ok) {
    if (res.status === 409) {
      const err = new Error(data.error || 'Conflito com a nuvem.');
      err.code = 'library_conflict';
      err.cloudRevision = data.cloudRevision;
      err.cloudUpdatedAt = data.cloudUpdatedAt;
      throw err;
    }
    if (res.status === 413) throw new Error(data.error || 'Biblioteca grande demais para a nuvem.');
    if (res.status === 401 || res.status === 402) {
      throw new Error(data.error || 'Faça login com assinatura activa para sincronizar.');
    }
    if (res.status === 503) {
      throw new Error(data.error || 'Sync indisponível no servidor (configure Blob no Vercel).');
    }
    if (res.status === 404 && data.empty) return { ok: true, empty: true, ...data };
    throw new Error(data.error || `Falha no sync (${res.status})`);
  }
  return data;
}

export async function fetchLibraryCloudStatus() {
  return syncRequest({ action: 'status' });
}

/** Upload de fotos — best-effort. Nunca bloqueia o save da estrutura do projeto. */
async function uploadAssetsBestEffort(assets, remoteAssetIds = []) {
  const remote = new Set(remoteAssetIds || []);
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const entries = [...assets.entries()];
  // Paralelo limitado — evita timeout / rate-limit do serverless.
  const concurrency = 3;
  for (let i = 0; i < entries.length; i += concurrency) {
    const chunk = entries.slice(i, i + concurrency);
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(chunk.map(async ([assetId, dataUrl]) => {
      if (remote.has(assetId)) {
        skipped += 1;
        return;
      }
      try {
        await syncRequest({
          action: 'putAsset',
          assetId,
          dataUrl,
          contentType: dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
        });
        uploaded += 1;
      } catch {
        failed += 1;
      }
    }));
  }
  return { uploaded, skipped, failed };
}

/**
 * Envia biblioteca local → nuvem.
 * Ordem: 1) manifesto (textos/estrutura) 2) fotos best-effort.
 * @param {{ force?: boolean }} [opts]
 */
export async function pushLibraryToCloud(opts = {}) {
  const localMeta = readCloudMeta();
  const status = await fetchLibraryCloudStatus();
  const { manifest, assets, projectCount } = await packLibraryForCloud();
  if (!projectCount && !(manifest.brands || []).length) {
    return { ok: true, empty: true, skipped: true, revision: localMeta?.revision || 0 };
  }

  // 1) Estrutura primeiro — garante que o projeto não «some» mesmo se fotos falharem.
  const baseRevision = opts.force
    ? undefined
    : (localMeta?.revision ?? status?.meta?.revision);
  let result;
  try {
    result = await syncRequest({
      action: 'push',
      manifest,
      baseRevision: status?.empty ? undefined : baseRevision,
      force: opts.force === true,
    });
  } catch (e) {
    if (e?.code === 'library_conflict') {
      result = await syncRequest({
        action: 'push',
        manifest,
        force: true,
      });
    } else {
      throw e;
    }
  }

  // 2) Fotos depois (não falha o save).
  const assetStats = assets.size
    ? await uploadAssetsBestEffort(assets, status?.meta?.assetIds || [])
    : { uploaded: 0, skipped: 0, failed: 0 };

  writeCloudMeta({
    revision: result.revision,
    updatedAt: result.updatedAt,
    projectCount: result.projectCount,
    lastPushAt: Date.now(),
    lastPullAt: localMeta?.lastPullAt || null,
  });
  return {
    ok: true,
    revision: result.revision,
    updatedAt: result.updatedAt,
    projectCount: result.projectCount,
    assetCount: assets.size,
    assetsUploaded: assetStats.uploaded,
    assetsFailed: assetStats.failed,
  };
}

async function fetchAssetDataUrl(assetId) {
  const data = await syncRequest(null, { method: 'GET', query: `asset=${encodeURIComponent(assetId)}` });
  return data?.asset?.dataUrl || null;
}

async function hydrateSlideFromCloud(slide, assetCache) {
  let sl = { ...slide };
  const bgAsset = sl.bgImageAssetId;
  if (bgAsset) {
    let dataUrl = assetCache.get(bgAsset);
    if (!dataUrl) {
      dataUrl = await fetchAssetDataUrl(bgAsset);
      if (dataUrl) assetCache.set(bgAsset, dataUrl);
    }
    if (dataUrl) {
      try {
        const packed = await guardarImagemDoSlide(dataUrl);
        sl = { ...sl, ...packed, bgImageFailed: false, bgImageError: null };
      } catch { /* */ }
    }
    delete sl.bgImageAssetId;
  }
  const logoAsset = sl.logoImageAssetId;
  if (logoAsset) {
    let dataUrl = assetCache.get(logoAsset);
    if (!dataUrl) {
      dataUrl = await fetchAssetDataUrl(logoAsset);
      if (dataUrl) assetCache.set(logoAsset, dataUrl);
    }
    if (dataUrl) sl = { ...sl, logoImage: dataUrl };
    delete sl.logoImageAssetId;
  }
  try { sl = await importSlideLogo(sl); } catch { /* */ }
  return sl;
}

async function hydrateBrandFromCloud(brand, assetCache) {
  let next = { ...brand };
  if (next.logoAssetId) {
    let dataUrl = assetCache.get(next.logoAssetId);
    if (!dataUrl) {
      dataUrl = await fetchAssetDataUrl(next.logoAssetId);
      if (dataUrl) assetCache.set(next.logoAssetId, dataUrl);
    }
    if (dataUrl) next = { ...next, logo: dataUrl };
    delete next.logoAssetId;
  }
  try { next = await importBrandLogo(next); } catch { /* */ }
  return next;
}

async function hydrateStyleKitFromCloud(styleKit, assetCache) {
  let kit = { ...(styleKit || {}) };
  const refs = [];
  for (const ref of (kit.refImages || [])) {
    if (!ref?.assetId) continue;
    let dataUrl = assetCache.get(ref.assetId);
    if (!dataUrl) {
      dataUrl = await fetchAssetDataUrl(ref.assetId);
      if (dataUrl) assetCache.set(ref.assetId, dataUrl);
    }
    if (dataUrl) refs.push({ name: ref.name, dataUrl });
  }
  kit.refImages = refs;
  if (kit.logo?.assetId) {
    let dataUrl = assetCache.get(kit.logo.assetId);
    if (!dataUrl) {
      dataUrl = await fetchAssetDataUrl(kit.logo.assetId);
      if (dataUrl) assetCache.set(kit.logo.assetId, dataUrl);
    }
    if (dataUrl) kit.logo = { ...kit.logo, dataUrl, assetId: undefined };
  }
  try { kit = await migrateProjectReferences(kit); } catch { /* */ }
  return kit;
}

/**
 * Aplica manifesto da nuvem ao localStorage (e IndexedDB).
 */
export async function applyCloudManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Manifesto da nuvem inválido.');
  }
  const assetCache = new Map();
  const docs = [];
  for (const entry of (manifest.docs || [])) {
    if (!entry?.doc) {
      docs.push(entry);
      continue;
    }
    const slides = Array.isArray(entry.doc.slides)
      ? await Promise.all(entry.doc.slides.map((s) => hydrateSlideFromCloud(s, assetCache)))
      : [];
    docs.push({
      ...entry,
      doc: {
        ...entry.doc,
        slides,
        brand: await hydrateBrandFromCloud(entry.doc.brand, assetCache),
        styleKit: await hydrateStyleKitFromCloud(entry.doc.styleKit, assetCache),
      },
    });
  }

  const brands = [];
  for (const profile of (manifest.brands || [])) {
    brands.push(await hydrateBrandFromCloud(profile, assetCache));
  }

  lsSet(SK.library, docs);
  lsSet(SK.libraryFolders, Array.isArray(manifest.folders) ? manifest.folders : []);
  lsSet(SK.brands, brands);
  if (manifest.activeBrandId != null) lsSet(SK.activeBrandId, manifest.activeBrandId);
  if (manifest.activeDocId != null) lsSet(SK.activeDocId, manifest.activeDocId);
  if (manifest.userProfile && typeof manifest.userProfile === 'object') {
    try {
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(manifest.userProfile));
    } catch { /* */ }
  }
  // Conta que já usou a app: não reabrir tour/modes intro.
  if (manifest.onboardingDone || docs.length > 0) {
    try { localStorage.setItem(SK.onboarding, '1'); } catch { /* */ }
  }
  if (manifest.modesIntroDone || docs.length > 0) {
    try { localStorage.setItem(SK.modesIntro, '1'); } catch { /* */ }
  }

  writeCloudMeta({
    revision: Number(manifest.revision || 0),
    updatedAt: Number(manifest.updatedAt || 0),
    projectCount: docs.length,
    lastPullAt: Date.now(),
    lastPushAt: readCloudMeta()?.lastPushAt || null,
  });

  return { projectCount: docs.length, revision: manifest.revision };
}

export async function pullLibraryFromCloud() {
  const data = await syncRequest(null, { method: 'GET', query: 'full=1' });
  if (data.empty || !data.manifest) {
    return { ok: true, empty: true, projectCount: 0 };
  }
  const applied = await applyCloudManifest(data.manifest);
  return { ok: true, empty: false, ...applied };
}

function libraryLooksOccupied() {
  try {
    const lib = lsGet(SK.library, []);
    return Array.isArray(lib) && lib.length > 0;
  } catch {
    return false;
  }
}

/** Contagem + updatedAt mais recente da biblioteca local (anti-wipe no reconcile). */
export function localLibraryFingerprint() {
  try {
    const lib = lsGet(SK.library, []) || [];
    if (!Array.isArray(lib) || !lib.length) return { count: 0, maxUpdated: 0 };
    let maxUpdated = 0;
    for (const entry of lib) {
      const t = Number(entry?.updatedAt || entry?.createdAt || 0);
      if (t > maxUpdated) maxUpdated = t;
    }
    return { count: lib.length, maxUpdated };
  } catch {
    return { count: 0, maxUpdated: 0 };
  }
}

function reloadAfterCloudPull() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('app', '1');
    url.searchParams.delete('login');
    window.location.replace(url.pathname + url.search + url.hash);
  } catch {
    window.location.replace('/?app=1');
  }
}

/**
 * Reconcilia nuvem ↔ local após login.
 * Nunca substitui biblioteca local ocupada por uma nuvem mais velha / sem meta local.
 * @returns {Promise<'ok'|'reloading'|'skipped'>}
 */
export async function reconcileLibraryCloud({ toast } = {}) {
  if (typeof window === 'undefined') return 'skipped';
  let status;
  try {
    status = await fetchLibraryCloudStatus();
  } catch (e) {
    if (typeof toast === 'function') {
      toast(e?.message || 'Sync na nuvem indisponível agora.', 'warning', 4500);
    }
    return 'skipped';
  }

  const local = localLibraryFingerprint();
  const localOccupied = local.count > 0;
  const localMeta = readCloudMeta();
  const cloud = status?.meta;

  try {
    if (!cloud || status.empty) {
      if (localOccupied) {
        const pushed = await pushLibraryToCloud({ force: true });
        if (typeof toast === 'function' && !pushed.skipped) {
          toast(`Biblioteca guardada na nuvem (${pushed.projectCount} projeto(s)).`, 'success', 4500);
        }
      }
      return 'ok';
    }

    // Local vazio → restaurar da nuvem.
    if (!localOccupied) {
      await pullLibraryFromCloud();
      if (typeof toast === 'function') {
        toast('Projetos restaurados da nuvem nesta conta.', 'success', 5000);
      }
      reloadAfterCloudPull();
      return 'reloading';
    }

    const cloudRev = Number(cloud.revision || 0);
    const localRev = Number(localMeta?.revision || 0);
    const cloudAt = Number(cloud.updatedAt || 0);
    const cloudCount = Number(cloud.projectCount || 0);

    // Local sem meta de sync: NÃO puxar (apagava projetos novos). Empurrar.
    if (!localMeta) {
      await pushLibraryToCloud({ force: true });
      if (typeof toast === 'function') {
        toast(`Biblioteca guardada na nuvem (${local.count} projeto(s)).`, 'success', 4500);
      }
      return 'ok';
    }

    const localClearlyNewer = local.maxUpdated > cloudAt + 1_500
      || local.count > cloudCount;

    // Só puxar se a nuvem for claramente mais nova e não tiver menos projetos.
    const cloudClearlyNewer = cloudRev > localRev
      && cloudAt >= local.maxUpdated
      && cloudCount >= local.count
      && !localClearlyNewer;

    if (cloudClearlyNewer) {
      await pullLibraryFromCloud();
      if (typeof toast === 'function') {
        toast('Projetos actualizados a partir da nuvem.', 'success', 5000);
      }
      reloadAfterCloudPull();
      return 'reloading';
    }

    await pushLibraryToCloud({ force: localClearlyNewer || cloudRev !== localRev });
    return 'ok';
  } catch (e) {
    if (typeof toast === 'function') {
      toast(e?.message || 'Não foi possível sincronizar a biblioteca.', 'warning', 5500);
    }
    return 'skipped';
  }
}

/** Best-effort antes do logout (não bloqueia saída se falhar). */
export async function pushLibraryToCloudBestEffort(timeoutMs = 8_000) {
  try {
    await Promise.race([
      pushLibraryToCloud({ force: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    return true;
  } catch {
    return false;
  }
}

export { readCloudMeta, writeCloudMeta };
