/**
 * Sync da biblioteca com a nuvem (por conta autenticada).
 * Manifesto leve + assets de imagem enviados à parte (limite body serverless).
 */
import { SK, lsSet, areAccountDataWritesLocked, lockAccountDataWrites } from './storage.js';
import { lsGet } from './telemetry.js';
import {
  imagemComoDataUrl, guardarImagemDoSlide, newImageId, semImagensDeRuntime, semLogosDeRuntimeDasMarcas,
} from './image-store.js';
import { exportBrandLogo, exportSlideLogo, importBrandLogo, importSlideLogo } from './slide-logo.js';
import { migrateProjectReferences } from './style-kit-storage.js';
import { USER_PROFILE_KEY } from './user-profile.js';

export const LIBRARY_CLOUD_META_KEY = SK.libraryCloudMeta;
const SYNC_API = '/api/library-sync';
const MAX_BODY_CHARS = 2_800_000;
const MAX_ASSET_CHARS = 1_600_000;
const IMAGE_MAX_EDGE = 720;
const IMAGE_MAX_CHARS = 160_000;

function captureSyncContext() {
  return {
    owner: localStorage.getItem(SK.dataOwner),
    library: localStorage.getItem(SK.library),
    deletedIds: localStorage.getItem(SK.libraryDeletedIds),
  };
}

function assertSyncContext(context, { signal, checkLibrary = false, allowLocked = false } = {}) {
  if (signal?.aborted) throw new Error('Sincronização cancelada.');
  if (localStorage.getItem(SK.dataOwner) !== context.owner
    || (!allowLocked && areAccountDataWritesLocked())) {
    throw new Error('A conta mudou durante a sincronização. Entre novamente para atualizar a biblioteca.');
  }
  if (checkLibrary && (localStorage.getItem(SK.library) !== context.library
    || localStorage.getItem(SK.libraryDeletedIds) !== context.deletedIds)) {
    throw new Error('A biblioteca mudou durante a sincronização. Suas alterações foram preservadas; sincronize novamente.');
  }
}

function readDeletedProjectIds() {
  try {
    const raw = localStorage.getItem(SK.libraryDeletedIds);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((x) => String(x || '').trim()).filter(Boolean))].slice(0, 500);
  } catch {
    return [];
  }
}

/** Marca projectos apagados para a nuvem os remover no merge. */
export function rememberDeletedProjectIds(ids = []) {
  const add = (Array.isArray(ids) ? ids : [ids])
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  if (!add.length) return;
  try {
    const next = [...new Set([...readDeletedProjectIds(), ...add])].slice(0, 500);
    localStorage.setItem(SK.libraryDeletedIds, JSON.stringify(next));
  } catch { /* quota */ }
}

function clearDeletedProjectIds(ids = []) {
  const drop = new Set((Array.isArray(ids) ? ids : []).map((x) => String(x || '').trim()).filter(Boolean));
  if (!drop.size) return;
  try {
    const next = readDeletedProjectIds().filter((id) => !drop.has(id));
    if (next.length) localStorage.setItem(SK.libraryDeletedIds, JSON.stringify(next));
    else localStorage.removeItem(SK.libraryDeletedIds);
  } catch { /* */ }
}

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
  let sl = slide;
  try { sl = await exportSlideLogo(slide); } catch { /* logo local em falta não bloqueia os textos */ }
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
    bgImageAssetId: bgAssetId || sl.bgImageAssetId || undefined,
    logoImageAssetId: logoAssetId || sl.logoImageAssetId || undefined,
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
    logoAssetId: logoAssetId || packed?.logoAssetId || undefined,
  });
}

async function packStyleKitForCloud(styleKit, assets) {
  const kit = styleKit;
  const refs = [];
  for (const ref of (kit?.refImages || [])) {
    let dataUrl = typeof ref?.dataUrl === 'string' && ref.dataUrl.startsWith('data:')
      ? ref.dataUrl
      : null;
    if (!dataUrl && ref?.imageId) {
      try { dataUrl = await imagemComoDataUrl(ref.imageId); } catch { /* */ }
    }
    const assetId = await collectAsset(dataUrl, ref?.imageId, assets);
    if (assetId || ref?.assetId) refs.push({ name: ref?.name, assetId: assetId || ref.assetId });
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
      ? { name: kit.logo.name, assetId: logoAssetId || kit.logo.assetId || undefined }
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
  const deletedIds = readDeletedProjectIds();
  const manifest = {
    vcVersion: 3,
    folders,
    brands,
    activeBrandId,
    activeDocId,
    docs,
    assetIds,
    deletedIds,
    userProfile: userProfile && typeof userProfile === 'object' ? stripRuntime(userProfile) : null,
    onboardingDone: onboardingDone || null,
    modesIntroDone: modesIntroDone || null,
  };

  return { manifest, assets, projectCount: docs.length };
}

async function syncRequest(payload, { method = 'POST', query = '', signal } = {}) {
  if (signal?.aborted) throw new Error('Sincronização cancelada.');
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
      signal,
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

export async function fetchLibraryCloudStatus(opts = {}) {
  return syncRequest({ action: 'status' }, opts);
}

/** Upload de fotos — 1 a 1 com retry; nunca bloqueia o save da estrutura. */
async function uploadAssetsBestEffort(assets, { signal, assertCurrent } = {}) {
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let lastError = '';
  const entries = [...assets.entries()];

  for (const [assetId, dataUrl] of entries) {
    assertCurrent?.();
    if (signal?.aborted) throw new Error('Sincronização cancelada.');
    // assetIds no manifesto são referências, não recibos de upload.
    // Reenvio idempotente recupera imagens de tentativas anteriores falhadas.
    let ok = false;
    for (let attempt = 0; attempt < 2 && !ok; attempt += 1) {
      assertCurrent?.();
      let payload = dataUrl;
      if (attempt === 1) {
        // Retry mais agressivo (menor).
        // eslint-disable-next-line no-await-in-loop
        payload = await compactDataUrl(dataUrl);
        if (!payload) break;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        await syncRequest({
          action: 'putAsset',
          assetId,
          dataUrl: payload,
          contentType: payload.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
        }, { signal });
        uploaded += 1;
        ok = true;
      } catch (e) {
        if (signal?.aborted) throw e;
        lastError = String(e?.message || e || 'upload');
        // Pausa curta entre retries / rate-limit.
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 280));
      }
    }
    if (!ok) failed += 1;
  }
  return { uploaded, skipped, failed, lastError };
}

/**
 * Envia biblioteca local → nuvem.
 * Ordem: 1) manifesto (textos/estrutura) 2) fotos best-effort.
 * Por defeito a nuvem faz MERGE (união) — projectos noutros browsers não somem.
 * @param {{ force?: boolean, allowShrink?: boolean, pullAfter?: boolean,
 *   signal?: AbortSignal, beforeApply?: () => void }} [opts]
 *   allowShrink/replace: substitui a nuvem (raro).
 *   pullAfter: após push, puxa manifesto completo → localStorage (Sync/Salvar).
 */
export async function pushLibraryToCloud(opts = {}) {
  const context = captureSyncContext();
  const guardOpts = { signal: opts.signal, allowLocked: opts.pullAfter === false };
  assertSyncContext(context, { ...guardOpts, checkLibrary: true });
  const localMeta = readCloudMeta();
  const status = await fetchLibraryCloudStatus({ signal: opts.signal });
  assertSyncContext(context, { ...guardOpts, checkLibrary: true });
  const { manifest, assets, projectCount } = await packLibraryForCloud();
  assertSyncContext(context, { ...guardOpts, checkLibrary: true });
  if (!projectCount && !(manifest.brands || []).length && !(manifest.deletedIds || []).length) {
    if (opts.pullAfter === true && !status?.empty) {
      const pulled = await pullLibraryFromCloud({
        signal: opts.signal, context, beforeApply: opts.beforeApply, expectedMeta: status.meta,
      });
      return { ...pulled, localProjectCount: pulled.projectCount, needsReload: !!pulled.snapshot };
    }
    return { ok: true, empty: true, skipped: true, revision: localMeta?.revision || 0 };
  }

  const replace = opts.allowShrink === true;
  const cloudCount = Number(status?.meta?.projectCount || 0);
  // Com merge, push mais pequeno é seguro. Com replace, bloquear auto-encolher.
  if (replace && !opts.force && cloudCount > projectCount) {
    return {
      ok: true,
      skipped: true,
      reason: 'cloud_has_more',
      projectCount: cloudCount,
      revision: status?.meta?.revision || localMeta?.revision || 0,
      assetsUploaded: 0,
      assetsFailed: 0,
    };
  }

  // 1) Estrutura primeiro — garante que o projeto não «some» mesmo se fotos falharem.
  const baseRevision = opts.force
    ? undefined
    : (localMeta?.revision ?? status?.meta?.revision);
  const pushBody = {
    action: 'push',
    manifest,
    baseRevision: status?.empty ? undefined : baseRevision,
    force: opts.force === true,
    replace,
  };
  let result;
  try {
    result = await syncRequest(pushBody, { signal: opts.signal });
  } catch (e) {
    if (e?.code === 'library_conflict') {
      // Conflito: ainda MERGE (nunca replace cego) para não apagar a nuvem.
      result = await syncRequest({
        action: 'push',
        manifest,
        force: true,
        replace: false,
      }, { signal: opts.signal });
    } else {
      throw e;
    }
  }

  assertSyncContext(context, { ...guardOpts, checkLibrary: true });
  if (!areAccountDataWritesLocked() && Array.isArray(manifest.deletedIds) && manifest.deletedIds.length) {
    clearDeletedProjectIds(manifest.deletedIds);
    context.deletedIds = localStorage.getItem(SK.libraryDeletedIds);
  }

  // 2) Fotos depois (não falha o save).
  const assetStats = assets.size
    ? await uploadAssetsBestEffort(assets, {
      signal: opts.signal,
      assertCurrent: () => assertSyncContext(context, guardOpts),
    })
    : { uploaded: 0, skipped: 0, failed: 0, lastError: '' };

  assertSyncContext(context, guardOpts);
  if (!areAccountDataWritesLocked()) writeCloudMeta({
    revision: result.revision,
    updatedAt: result.updatedAt,
    projectCount: result.projectCount,
    lastPushAt: Date.now(),
    lastPullAt: localMeta?.lastPullAt || null,
  });

  // Sync/Salvar: SEMPRE puxar a lista completa da nuvem para o browser.
  // Sem isto a UI fica com 1 projecto enquanto o toast diz «4 na nuvem».
  const cloudProjects = Number(result.projectCount || 0);
  const mustPull = opts.pullAfter !== false && (opts.pullAfter === true || cloudProjects > projectCount);
  let needsReload = false;
  let pullError = '';
  let snapshot = null;
  let assetsMissing = 0;
  let warnings = [];
  if (mustPull) {
    try {
      assertSyncContext(context, { ...guardOpts, checkLibrary: true });
      const pulled = await pullLibraryFromCloud({
        signal: opts.signal, context, beforeApply: opts.beforeApply, expectedMeta: result,
      });
      if (!pulled.snapshot || (cloudProjects > 0 && !pulled.projectCount)) {
        pullError = cloudProjects > 0
          ? `Nuvem reportou ${cloudProjects} projeto(s) mas o download veio vazio.`
          : 'Download da biblioteca veio vazio.';
      } else {
        needsReload = true;
        snapshot = pulled.snapshot;
        assetsMissing = pulled.assetsMissing;
        warnings = pulled.warnings;
        result = { ...result, revision: pulled.revision, updatedAt: pulled.updatedAt, projectCount: pulled.projectCount };
      }
    } catch (e) {
      pullError = String(e?.message || e || 'falha ao restaurar lista');
    }
  }

  return {
    ok: !pullError,
    revision: result.revision,
    updatedAt: result.updatedAt,
    projectCount: result.projectCount,
    localProjectCount: snapshot ? snapshot.library.length : localLibraryFingerprint().count,
    assetCount: assets.size,
    assetsUploaded: assetStats.uploaded,
    assetsFailed: assetStats.failed,
    assetError: assetStats.lastError || '',
    needsReload,
    pullError,
    snapshot,
    assetsMissing,
    warnings,
  };
}

/** Foto em falta NÃO pode derrubar o restore da lista de projetos. */
async function fetchAssetDataUrl(assetId, signal) {
  if (!assetId) return null;
  try {
    const data = await syncRequest(null, {
      method: 'GET',
      query: `asset=${encodeURIComponent(assetId)}`,
      signal,
    });
    return data?.asset?.dataUrl || null;
  } catch {
    return null;
  }
}

async function resolveCachedAsset(assetId, assetCache) {
  if (!assetId) return null;
  if (assetCache.has(assetId)) return assetCache.get(assetId);
  const pending = fetchAssetDataUrl(assetId, assetCache.signal).then((dataUrl) => {
    if (!dataUrl) assetCache.missing.add(assetId);
    return dataUrl || null;
  });
  assetCache.set(assetId, pending);
  return pending;
}

async function hydrateSlideFromCloud(slide, assetCache, localSlide) {
  try {
    let sl = { ...slide };
    const bgAsset = sl.bgImageAssetId;
    if (bgAsset) {
      const dataUrl = await resolveCachedAsset(bgAsset, assetCache);
      if (dataUrl) {
        try {
          const packed = await guardarImagemDoSlide(dataUrl, { id: bgAsset });
          sl = { ...sl, ...packed, bgImageFailed: false, bgImageError: null };
        } catch { /* */ }
      } else {
        // Uma falha remota não remove a cópia desta mesma foto no navegador.
        const sameLocalPhoto = localSlide?.bgImageAssetId === bgAsset
          || localSlide?.bgImageId === bgAsset
          || (sl.bgImageId && localSlide?.bgImageId === sl.bgImageId);
        const localId = (sameLocalPhoto && localSlide?.bgImageId) || sl.bgImageId || bgAsset;
        try {
          const localPhoto = await imagemComoDataUrl(localId);
          if (localPhoto) sl = { ...sl, bgImage: localPhoto, bgImageId: localId, bgImageFailed: false, bgImageError: null };
        } catch { /* continua com os textos e a referência remota */ }
      }
    }
    const logoAsset = sl.logoImageAssetId;
    if (logoAsset) {
      const dataUrl = await resolveCachedAsset(logoAsset, assetCache);
      if (dataUrl) sl = { ...sl, logoImage: dataUrl };
    }
    try { sl = await importSlideLogo(sl); } catch { /* */ }
    return sl;
  } catch {
    return { ...slide };
  }
}

async function hydrateBrandFromCloud(brand, assetCache) {
  try {
    let next = { ...(brand || {}) };
    if (next.logoAssetId) {
      const dataUrl = await resolveCachedAsset(next.logoAssetId, assetCache);
      if (dataUrl) next = { ...next, logo: dataUrl };
    }
    try { next = await importBrandLogo(next); } catch { /* */ }
    return next;
  } catch {
    return { ...(brand || {}) };
  }
}

async function hydrateStyleKitFromCloud(styleKit, assetCache) {
  try {
    let kit = { ...(styleKit || {}) };
    const refs = [];
    for (const ref of (kit.refImages || [])) {
      if (!ref?.assetId) {
        refs.push(ref);
        continue;
      }
      try {
        const dataUrl = await resolveCachedAsset(ref.assetId, assetCache);
        if (dataUrl) {
          const imported = await migrateProjectReferences({ refImages: [{ name: ref.name, dataUrl }] });
          refs.push({ ...imported.refImages[0], assetId: ref.assetId });
        } else refs.push({ ...ref });
      } catch { refs.push({ ...ref }); }
    }
    kit.refImages = [];
    const logoAssetId = kit.logo?.assetId;
    if (kit.logo?.assetId) {
      const dataUrl = await resolveCachedAsset(kit.logo.assetId, assetCache);
      if (dataUrl) kit.logo = { ...kit.logo, dataUrl };
    }
    try { kit = await migrateProjectReferences(kit); } catch { /* */ }
    return {
      ...kit,
      refImages: refs,
      ...(logoAssetId ? { logo: { ...styleKit.logo, ...kit.logo, assetId: logoAssetId } } : {}),
    };
  } catch {
    return { ...(styleKit || {}) };
  }
}

/**
 * Aplica manifesto da nuvem ao localStorage (e IndexedDB).
 * Devolve snapshot para a UI e mantém gravações travadas até o chamador
 * atualizar o estado React ou recarregar a página.
 */
export async function applyCloudManifest(manifest, { context = captureSyncContext(), signal, beforeApply } = {}) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.docs)) {
    throw new Error('Manifesto da nuvem inválido.');
  }
  assertSyncContext(context, { signal, checkLibrary: true });
  const assetCache = new Map();
  assetCache.signal = signal;
  assetCache.missing = new Set();
  let localDocs = [];
  try { localDocs = JSON.parse(context.library || '[]'); } catch { /* cache corrompida pode ser restaurada */ }
  const docs = [];
  for (const entry of (manifest.docs || [])) {
    if (!entry?.doc) {
      docs.push(entry);
      continue;
    }
    try {
      const localSlides = (Array.isArray(localDocs) ? localDocs : [])
        .find((localEntry) => localEntry?.id === entry.id)?.doc?.slides || [];
      const slides = Array.isArray(entry.doc.slides)
        ? await Promise.all(entry.doc.slides.map((s) => hydrateSlideFromCloud(s, assetCache,
          localSlides.find((localSlide) => localSlide?.id === s?.id))))
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
    } catch {
      // Estrutura do projeto > fotos: guarda o entry sem hidratar assets.
      docs.push({
        ...entry,
        doc: {
          ...entry.doc,
          slides: Array.isArray(entry.doc.slides)
            ? entry.doc.slides.map((s) => ({ ...s }))
            : [],
        },
      });
    }
  }

  const brands = [];
  for (const profile of (Array.isArray(manifest.brands) ? manifest.brands : [])) {
    try {
      brands.push(await hydrateBrandFromCloud(profile, assetCache));
    } catch {
      brands.push(profile);
    }
  }

  beforeApply?.();
  assertSyncContext(context, { signal, checkLibrary: true });
  const snapshot = {
    library: docs,
    libraryFolders: Array.isArray(manifest.folders) ? manifest.folders : [],
    brandRoster: brands,
    activeDocId: docs.some((entry) => entry?.id === manifest.activeDocId)
      ? manifest.activeDocId : docs[0]?.id || '',
    activeBrandId: manifest.activeBrandId ?? brands[0]?.id ?? '',
  };
  const writes = [
    [SK.libraryFolders, snapshot.libraryFolders],
    [SK.brands, semLogosDeRuntimeDasMarcas(snapshot.brandRoster)],
    [SK.activeBrandId, snapshot.activeBrandId],
    [SK.activeDocId, snapshot.activeDocId],
    [SK.library, semImagensDeRuntime(snapshot.library)],
  ];
  const previous = writes.map(([key]) => [key, localStorage.getItem(key)]);
  try {
    for (const [key, value] of writes) {
      if (!lsSet(key, value)) throw new Error('Gravação local recusada.');
    }
    const saved = JSON.parse(localStorage.getItem(SK.library));
    if (!Array.isArray(saved) || JSON.stringify(saved.map((entry) => entry?.id))
      !== JSON.stringify(docs.map((entry) => entry?.id))) {
      throw new Error('A lista gravada não corresponde à biblioteca recebida.');
    }
  } catch {
    // Não reportar sucesso nem deixar marcas/pastas de uma aplicação parcial.
    for (const [key, raw] of previous) {
      try {
        if (raw == null) localStorage.removeItem(key);
        else localStorage.setItem(key, raw);
      } catch { /* a biblioteca anterior continua na nuvem */ }
    }
    throw new Error('A biblioteca está na nuvem, mas não foi possível gravar a lista neste navegador. Libere espaço e sincronize novamente.');
  }
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
  // Mesmo turno síncrono da gravação: pagehide/autosave só volta a gravar
  // depois de React aplicar snapshot, ou no boot seguinte ao reload legado.
  lockAccountDataWrites();
  const assetsMissing = assetCache.missing.size;
  return {
    projectCount: docs.length,
    revision: manifest.revision,
    updatedAt: manifest.updatedAt,
    snapshot,
    assetsMissing,
    warnings: assetsMissing ? [`${assetsMissing} imagem(ns) indisponível(is); todos os projetos foram restaurados.`] : [],
  };
}

export async function pullLibraryFromCloud({ context = captureSyncContext(), signal, beforeApply, expectedMeta } = {}) {
  assertSyncContext(context, { signal, checkLibrary: true });
  const data = await syncRequest(null, { method: 'GET', query: 'full=1', signal });
  if (data.empty) {
    if (Number(expectedMeta?.projectCount || 0) > 0) {
      throw new Error('A nuvem confirmou projetos, mas devolveu uma biblioteca vazia. A lista local foi preservada; sincronize novamente.');
    }
    return { ok: true, empty: true, projectCount: 0 };
  }
  if (!data.manifest) throw new Error('A nuvem não devolveu a biblioteca. Sincronize novamente.');
  if (expectedMeta) {
    const expectedRevision = Number(expectedMeta.revision || 0);
    const receivedRevision = Number(data.manifest.revision || 0);
    const expectedCount = Number(expectedMeta.projectCount);
    const receivedCount = Array.isArray(data.manifest.docs) ? data.manifest.docs.length : NaN;
    if (!Number.isFinite(receivedRevision) || receivedRevision < expectedRevision) {
      throw new Error('A nuvem devolveu uma versão anterior à que acabou de salvar. A lista local foi preservada; sincronize novamente.');
    }
    if (receivedRevision === expectedRevision && Number.isFinite(expectedCount) && receivedCount !== expectedCount) {
      throw new Error(`A nuvem confirmou ${expectedCount} projeto(s), mas devolveu uma lista diferente. A lista local foi preservada; sincronize novamente.`);
    }
  }
  const applied = await applyCloudManifest(data.manifest, { context, signal, beforeApply });
  return { ok: true, empty: false, ...applied };
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
 * Reconcilia por união após login, mesmo se a revisão local avançou num push
 * anterior sem pull. A contagem da nuvem só é sucesso após aplicar a lista à UI.
 * @returns {Promise<'ok'|'reloading'|'skipped'>}
 */
export async function reconcileLibraryCloud({ toast, onApplied } = {}) {
  if (typeof window === 'undefined') return 'skipped';
  try {
    const status = await fetchLibraryCloudStatus();
    const local = localLibraryFingerprint();
    const hasLocalChanges = local.count > 0 || readDeletedProjectIds().length > 0;
    let result;
    if (hasLocalChanges) {
      result = await pushLibraryToCloud({ force: true, pullAfter: true });
    } else if (!status.empty && status.meta) {
      result = await pullLibraryFromCloud({ expectedMeta: status.meta });
    } else {
      return 'ok';
    }
    if (result.pullError || result.ok === false) {
      throw new Error(result.pullError || 'Não foi possível atualizar a lista local.');
    }
    if (!result.snapshot) return 'ok';
    if (typeof onApplied === 'function') {
      await onApplied(result.snapshot, result);
    } else {
      // applyCloudManifest já travou as gravações antes de devolver o resultado.
      reloadAfterCloudPull();
      return 'reloading';
    }
    if (typeof toast === 'function') {
      const detail = result.assetsMissing ? ` ${result.assetsMissing} imagem(ns) indisponível(is).` : '';
      toast(`Biblioteca sincronizada: ${result.projectCount} projeto(s).${detail}`,
        result.assetsMissing ? 'warning' : 'success', 5000);
    }
    return 'ok';
  } catch (e) {
    if (typeof toast === 'function') {
      toast(e?.message || 'Não foi possível sincronizar a biblioteca.', 'warning', 5500);
    }
    return 'skipped';
  }
}

/** Best-effort (logout/auto) — só envia; nunca altera a biblioteca local. */
export async function pushLibraryToCloudBestEffort(timeoutMs = 8_000) {
  const controller = new AbortController();
  let timer;
  try {
    const result = await Promise.race([
      pushLibraryToCloud({ force: true, allowShrink: false, pullAfter: false, signal: controller.signal }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Tempo de sincronização esgotado.'));
        }, timeoutMs);
      }),
    ]);
    return result.ok !== false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export { readCloudMeta, writeCloudMeta };
