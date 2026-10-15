/**
 * Sync da biblioteca com a nuvem (por conta autenticada).
 * Manifesto leve + assets de imagem enviados à parte (limite body serverless).
 */
import { SK, lsSet, areAccountDataWritesLocked, lockAccountDataWrites, lockOtherAccountTabs, unlockAccountDataWrites, waitForAccountWriteLockProbe } from './storage.js';
import { lsGet } from './telemetry.js';
import {
  dataUrlParaBlob, imagemComoDataUrl, guardarImagemDoSlide, newImageId,
  semImagensDeRuntime, semLogosDeRuntimeDasMarcas,
} from './image-store.js';
import { exportBrandLogo, exportSlideLogo, importBrandLogo, importSlideLogo } from './slide-logo.js';
import { importSlideReference } from './slide-reference.js';
import { migrateProjectReferences } from './style-kit-storage.js';
import { USER_PROFILE_KEY } from './user-profile.js';
import { CLOUD_IMAGE_PART_CHARS, CLOUD_IMAGE_MAX_CHARS, originalImageAssetId, isOriginalImageAsset, imageContentType } from './cloud-image-assets.js';
import { hasConfirmedOriginalUpload, rememberConfirmedOriginalUpload } from './cloud-upload-receipts.js';
import { readDeletedProjectIds, rememberDeletedProjectIds, mergeDeletedProjectIds } from './project-deletions.js';
import { readDataOwner } from './account-data-owner.js';
export { rememberDeletedProjectIds } from './project-deletions.js';

export const LIBRARY_CLOUD_META_KEY = SK.libraryCloudMeta;
export const LIBRARY_CLOUD_META_FALLBACK_KEY = 'vc_library_cloud_meta_fallback';
export const CLOUD_LIBRARY_RESTORE_BLOCKED_MESSAGE = 'Não foi possível restaurar a versão mais recente dos seus projetos. A cópia deste navegador está desatualizada. Verifique sua conexão e tente novamente.';
const SYNC_API = '/api/library-sync';
const MAX_BODY_CHARS = 2_800_000;
const AUTHORITATIVE_MANIFEST_TIMEOUT_MS = 30_000;

function captureSyncContext() {
  return {
    owner: localStorage.getItem(SK.dataOwner),
    library: localStorage.getItem(SK.library),
    deletedIds: JSON.stringify(readDeletedProjectIds()),
  };
}

function assertSyncContext(context, { signal, checkLibrary = false, allowLocked = false } = {}) {
  if (signal?.aborted) throw new Error('Sincronização cancelada.');
  if (localStorage.getItem(SK.dataOwner) !== context.owner
    || (!allowLocked && areAccountDataWritesLocked())) {
    throw new Error('A conta mudou durante a sincronização. Entre novamente para atualizar a biblioteca.');
  }
  if (checkLibrary && (localStorage.getItem(SK.library) !== context.library
    || JSON.stringify(readDeletedProjectIds()) !== context.deletedIds)) {
    throw new Error('A biblioteca mudou durante a sincronização. Suas alterações foram preservadas; sincronize novamente.');
  }
}

function readCloudMeta() {
  let primary = null;
  try {
    const raw = localStorage.getItem(LIBRARY_CLOUD_META_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) primary = parsed;
  } catch { /* o recibo curto da aba ainda pode estar disponível */ }
  try {
    const fallback = JSON.parse(sessionStorage.getItem(LIBRARY_CLOUD_META_FALLBACK_KEY) || 'null');
    if (fallback?.owner !== localStorage.getItem(SK.dataOwner)
      || !fallback?.meta || typeof fallback.meta !== 'object' || Array.isArray(fallback.meta)) return primary;
    const version = (meta) => [
      Number(meta.revision || 0), Number(meta.updatedAt || 0),
      Number(meta.recordedAt || Math.max(Number(meta.lastPullAt || 0), Number(meta.lastPushAt || 0))),
    ];
    const candidate = version(fallback.meta);
    const stored = version(primary || {});
    const newerAt = candidate.findIndex((value, index) => value !== stored[index]);
    if (!primary || (newerAt >= 0 && candidate[newerAt] > stored[newerAt])) return fallback.meta;
  } catch { /* sessão indisponível ou de outra conta */ }
  return primary;
}

function writeCloudMeta(meta) {
  const stored = {
    ...meta, recordedAt: Math.max(Date.now(), Number(readCloudMeta()?.recordedAt || 0) + 1),
  };
  const raw = JSON.stringify(stored);
  try {
    localStorage.setItem(LIBRARY_CLOUD_META_KEY, raw);
    if (localStorage.getItem(LIBRARY_CLOUD_META_KEY) === raw) {
      try { sessionStorage.removeItem(LIBRARY_CLOUD_META_FALLBACK_KEY); } catch { /* */ }
      return true;
    }
  } catch { /* quota: manter apenas o recibo curto, sem duplicar os projetos */ }
  try {
    const shortMeta = Object.fromEntries([
      'revision', 'updatedAt', 'projectCount', 'lastPullAt', 'lastPushAt', 'localPersisted', 'needsPull', 'pendingRevision', 'recordedAt',
    ].filter((key) => stored[key] !== undefined).map((key) => [key, stored[key]]));
    sessionStorage.setItem(LIBRARY_CLOUD_META_FALLBACK_KEY, JSON.stringify({
      owner: localStorage.getItem(SK.dataOwner), meta: shortMeta,
    }));
  } catch { /* ambos os mecanismos de armazenamento estão indisponíveis */ }
  return false;
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

async function collectAsset(dataUrl, bag) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null;
  if (!imageContentType(dataUrl) || dataUrl.length > CLOUD_IMAGE_MAX_CHARS) {
    bag.packingFailed = (bag.packingFailed || 0) + 1;
    return null;
  }
  // O hash separa o original das cópias JPEG/720px já existentes na nuvem e
  // identifica os mesmos bytes mesmo quando o IndexedDB muda de ID no restore.
  const assetId = await originalImageAssetId(dataUrl);
  bag.set(assetId, dataUrl);
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
  if (dataUrl) bgAssetId = await collectAsset(dataUrl, assets);

  let logoAssetId = null;
  if (typeof sl.logoImage === 'string' && sl.logoImage.startsWith('data:')) {
    logoAssetId = await collectAsset(sl.logoImage, assets);
  } else if (sl.logoImageId) {
    try {
      const logoUrl = await imagemComoDataUrl(sl.logoImageId);
      logoAssetId = await collectAsset(logoUrl, assets);
    } catch { /* */ }
  }

  // A referência orienta a próxima geração e precisa viajar separadamente da
  // foto final. stripRuntime remove os bytes, nunca a identidade do anexo.
  let refDataUrl = typeof sl.refImage === 'string' && sl.refImage.startsWith('data:image/')
    ? sl.refImage : null;
  if (!refDataUrl && sl.refImageId) {
    try { refDataUrl = await imagemComoDataUrl(sl.refImageId); } catch { /* mantém a referência ausente identificada */ }
  }
  const refAssetId = await collectAsset(refDataUrl, assets);
  const refIdentity = refAssetId || sl.refImageAssetId || sl.refImageId
    || (refDataUrl ? newImageId() : undefined);

  const clean = stripRuntime({
    ...sl,
    bgImage: null,
    logoImage: null,
    refImage: typeof sl.refImage === 'string' && /^https:\/\//i.test(sl.refImage) ? sl.refImage : null,
    bgImageAssetId: bgAssetId || sl.bgImageAssetId || undefined,
    logoImageAssetId: logoAssetId || sl.logoImageAssetId || undefined,
    refImageAssetId: refIdentity,
  });
  return clean;
}

async function packBrandForCloud(brand, assets) {
  let packed = brand;
  try { packed = await exportBrandLogo(brand); } catch { /* */ }
  let logoAssetId = null;
  if (typeof packed?.logo === 'string' && packed.logo.startsWith('data:')) {
    logoAssetId = await collectAsset(packed.logo, assets);
  } else if (packed?.logoImageId) {
    try {
      const url = await imagemComoDataUrl(packed.logoImageId);
      logoAssetId = await collectAsset(url, assets);
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
    const assetId = await collectAsset(dataUrl, assets);
    if (assetId || ref?.assetId) refs.push({ name: ref?.name, assetId: assetId || ref.assetId });
  }
  let logoAssetId = null;
  if (kit?.logo?.dataUrl) {
    logoAssetId = await collectAsset(kit.logo.dataUrl, assets);
  } else if (kit?.logo?.imageId) {
    try {
      const url = await imagemComoDataUrl(kit.logo.imageId);
      logoAssetId = await collectAsset(url, assets);
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
 * Monta manifesto + assets. O snapshot explícito inclui a edição que ainda
 * está no React quando o cache do navegador recusou a gravação.
 */
export async function packLibraryForCloud(snapshot) {
  const readSnapshot = (key, storageKey, fallback) => (
    snapshot && Object.prototype.hasOwnProperty.call(snapshot, key)
      ? snapshot[key] : lsGet(storageKey, fallback)
  );
  const docsRaw = readSnapshot('library', SK.library, []) || [];
  const folders = readSnapshot('libraryFolders', SK.libraryFolders, []) || [];
  const brandsRaw = readSnapshot('brandRoster', SK.brands, []) || [];
  const activeBrandId = readSnapshot('activeBrandId', SK.activeBrandId, '') || '';
  const activeDocId = readSnapshot('activeDocId', SK.activeDocId, '') || '';
  if (!Array.isArray(docsRaw) || !Array.isArray(brandsRaw) || !Array.isArray(folders)) {
    throw new Error('A biblioteca em edição não está pronta para sincronizar. Tente novamente.');
  }
  let userProfile = null;
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (raw) userProfile = JSON.parse(raw);
  } catch { /* */ }

  const assets = new Map();
  const docs = [];
  // A API de projetos v2 decide exclusões por tombstone versionado no servidor.
  // Uma exclusão antiga deste browser não pode esconder um projeto vivo na nuvem.
  const deletedIds = snapshot?.ignoreLocalDeletedIds === true
    ? mergeDeletedProjectIds(snapshot?.deletedIds)
    : mergeDeletedProjectIds(readDeletedProjectIds(), snapshot?.deletedIds);
  const deleted = new Set(deletedIds);
  for (const entry of docsRaw) {
    if (deleted.has(String(entry?.id))) continue;
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
    deletedIds,
    userProfile: userProfile && typeof userProfile === 'object' ? stripRuntime(userProfile) : null,
    onboardingDone: onboardingDone || null,
    modesIntroDone: modesIntroDone || null,
  };

  return { manifest, assets, projectCount: docs.length, packingFailed: assets.packingFailed || 0 };
}

function waitForSyncRetry(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Sincronização cancelada.')); return; }
    const abort = () => { clearTimeout(timer); reject(new Error('Sincronização cancelada.')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

async function syncRequest(payload, { method = 'POST', query = '', signal, rateLimitRetry = true } = {}) {
  if (signal?.aborted) throw new Error('Sincronização cancelada.');
  const owner = localStorage.getItem(SK.dataOwner);
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
      cache: method === 'GET' ? 'no-store' : undefined,
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
  if (res.status === 429 && rateLimitRetry) {
    // Originais grandes usam mais pedidos. Respeitar a janela do servidor
    // evita confundir limite transitório com foto ausente; logout pode cancelar.
    const retryAfter = Number(res.headers.get('Retry-After'));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 60) : 1;
    await res.text().catch(() => '');
    await waitForSyncRetry(delay * 1000, signal);
    if (localStorage.getItem(SK.dataOwner) !== owner) throw new Error('A conta mudou durante a sincronização.');
    return syncRequest(payload, { method, query, signal, rateLimitRetry: false });
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
export async function uploadAssetsBestEffort(assets, { owner, signal, assertCurrent } = {}) {
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let lastError = '';
  const entries = [...assets.entries()];

  for (const [assetId, dataUrl] of entries) {
    assertCurrent?.();
    if (signal?.aborted) throw new Error('Sincronização cancelada.');
    // Um timeout não deve obrigar a reenviar as primeiras fotos a cada save.
    // Só recibos desta conta e dos mesmos bytes dispensam um novo upload.
    if (hasConfirmedOriginalUpload(owner, assetId)) {
      skipped += 1;
      continue;
    }
    let ok = false;
    for (let attempt = 0; attempt < 2 && !ok; attempt += 1) {
      assertCurrent?.();
      try {
        // eslint-disable-next-line no-await-in-loop
        if (dataUrl.length <= CLOUD_IMAGE_PART_CHARS) {
          const saved = await syncRequest({ action: 'putAsset', assetId, dataUrl, contentType: imageContentType(dataUrl) }, { signal });
          if (saved.ok !== true || (saved.assetId && saved.assetId !== assetId)) {
            throw new Error('A nuvem não confirmou o envio da imagem.');
          }
        } else {
          const total = Math.ceil(dataUrl.length / CLOUD_IMAGE_PART_CHARS);
          for (let index = 0; index < total; index += 1) {
            assertCurrent?.();
            const saved = await syncRequest({
              action: 'putAssetChunk', assetId, index, total, totalChars: dataUrl.length,
              data: dataUrl.slice(index * CLOUD_IMAGE_PART_CHARS, (index + 1) * CLOUD_IMAGE_PART_CHARS),
            }, { signal });
            if (saved.ok !== true || (saved.assetId && saved.assetId !== assetId)
              || (index === total - 1 && saved.complete !== true)) {
              throw new Error('A nuvem não confirmou o envio completo da imagem.');
            }
          }
        }
        // Uma resposta tardia de um pedido cancelado ou de outra conta não
        // confirma proteção e não autoriza pular o original na próxima vez.
        assertCurrent?.();
        if (signal?.aborted) throw new Error('Sincronização cancelada.');
        rememberConfirmedOriginalUpload(owner, assetId);
        uploaded += 1;
        ok = true;
      } catch (e) {
        if (signal?.aborted) throw e;
        lastError = String(e?.message || e || 'upload');
        // Pausa curta entre retries / rate-limit.
        // eslint-disable-next-line no-await-in-loop
        await waitForSyncRetry(280, signal);
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
 *   signal?: AbortSignal, beforeApply?: () => void, snapshot?: object,
 *   allowMemoryFallback?: boolean }} [opts]
 *   allowShrink/replace: substitui a nuvem (raro).
 *   pullAfter: após push, puxa manifesto completo → localStorage (Sync/Salvar).
 */
export async function pushLibraryToCloud(opts = {}) {
  const context = captureSyncContext();
  const guardOpts = { signal: opts.signal, allowLocked: opts.pullAfter === false };
  const allowMemoryFallback = !!opts.snapshot || opts.allowMemoryFallback === true;
  assertSyncContext(context, { ...guardOpts, checkLibrary: true });
  const localMeta = readCloudMeta();
  const status = await fetchLibraryCloudStatus({ signal: opts.signal });
  assertSyncContext(context, { ...guardOpts, checkLibrary: true });
  const { manifest, assets, projectCount, packingFailed } = await packLibraryForCloud(opts.snapshot);
  assertSyncContext(context, { ...guardOpts, checkLibrary: true });
  // Uma substituição grande demais ainda pode carregar o ID remoto da foto
  // anterior. Publicá-lo e dar pull apagaria a nova edição. Não publicar nada.
  if (packingFailed) {
    throw new Error(`Não foi possível preparar ${packingFailed} imagem(ns) para a nuvem. Os originais continuam neste navegador. O limite de envio é 36 MB por imagem.`);
  }
  if (!projectCount && !(manifest.brands || []).length && !(manifest.deletedIds || []).length) {
    if (opts.pullAfter === true && !status?.empty) {
      const pulled = await pullLibraryFromCloud({
        signal: opts.signal, context, beforeApply: opts.beforeApply, expectedMeta: status.meta,
        localSnapshot: opts.snapshot, allowMemoryFallback,
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
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      // Uma disputa entre dispositivos é transitória. Reenviar o mesmo
      // manifesto permite ao servidor reler e unir os projetos por ID.
      // Depois do primeiro conflito nunca repetir um replace.
      const body = attempt === 0 ? pushBody : {
        action: 'push', manifest, force: true, replace: false,
      };
      // eslint-disable-next-line no-await-in-loop
      result = await syncRequest(body, { signal: opts.signal });
      break;
    } catch (e) {
      if (e?.code !== 'library_conflict' || attempt === 3) throw e;
      assertSyncContext(context, { ...guardOpts, checkLibrary: true });
      // eslint-disable-next-line no-await-in-loop
      await waitForSyncRetry(120 * (2 ** attempt), opts.signal);
      assertSyncContext(context, { ...guardOpts, checkLibrary: true });
    }
  }

  assertSyncContext(context, { ...guardOpts, checkLibrary: true });
  // Não apagar tombstones após confirmação: abas antigas e cofres ainda
  // podem trazer os mesmos IDs e precisam continuar sujeitos à exclusão.

  // 2) Fotos depois (não falha o save).
  const assetStats = assets.size
    ? await uploadAssetsBestEffort(assets, {
      owner: context.owner,
      signal: opts.signal,
      assertCurrent: () => assertSyncContext(context, guardOpts),
    })
    : { uploaded: 0, skipped: 0, failed: 0, lastError: '' };

  assertSyncContext(context, guardOpts);

  // Sync/Salvar: SEMPRE puxar a lista completa da nuvem para o browser.
  // Sem isto a UI fica com 1 projecto enquanto o toast diz «4 na nuvem».
  const cloudProjects = Number(result.projectCount || 0);
  const mustPull = opts.pullAfter !== false && (opts.pullAfter === true || cloudProjects > projectCount);
  let needsReload = false;
  let pullError = '';
  let snapshot = null;
  let assetsMissing = 0;
  let warnings = [];
  let localPersisted = null;
  let cacheError = '';
  if (mustPull) {
    try {
      assertSyncContext(context, { ...guardOpts, checkLibrary: true });
      const pulled = await pullLibraryFromCloud({
        signal: opts.signal, context, beforeApply: opts.beforeApply, expectedMeta: result,
        localSnapshot: opts.snapshot, localAssets: assets, allowMemoryFallback,
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
        localPersisted = pulled.localPersisted;
        cacheError = pulled.cacheError || '';
        result = { ...result, revision: pulled.revision, updatedAt: pulled.updatedAt, projectCount: pulled.projectCount };
      }
    } catch (e) {
      pullError = String(e?.message || e || 'falha ao restaurar lista');
    }
  }

  const confirmedCount = Number(result.projectCount || 0);
  if (mustPull && !pullError && snapshot) {
    const applied = readCloudMeta() || {};
    writeCloudMeta({
      ...applied,
      revision: result.revision,
      updatedAt: result.updatedAt,
      projectCount: snapshot.library.length,
      lastPushAt: Date.now(),
      needsPull: false,
    });
  } else if (!areAccountDataWritesLocked()) {
    const metaCount = confirmedCount > projectCount ? projectCount : (confirmedCount || projectCount);
    const pullFailed = mustPull && !!pullError;
    writeCloudMeta({
      // A resposta do push confirma a nuvem, não o conteúdo deste browser.
      // Mesmo 5=5 pode conter projetos diferentes se o GET falhou.
      revision: pullFailed ? localMeta?.revision : result.revision,
      updatedAt: pullFailed ? localMeta?.updatedAt : result.updatedAt,
      projectCount: metaCount,
      needsPull: pullFailed || confirmedCount > metaCount,
      ...(pullFailed ? { pendingRevision: result.revision } : {}),
      lastPushAt: Date.now(),
      lastPullAt: localMeta?.lastPullAt || null,
      localPersisted: localMeta?.localPersisted,
    });
  }

  return {
    ok: !pullError,
    cloudSaved: true,
    revision: result.revision,
    updatedAt: result.updatedAt,
    projectCount: result.projectCount,
    localProjectCount: snapshot ? snapshot.library.length : localLibraryFingerprint().count,
    assetCount: assets.size,
    assetsUploaded: assetStats.uploaded,
    assetsSkipped: assetStats.skipped,
    assetsFailed: assetStats.failed,
    assetError: assetStats.lastError,
    needsReload,
    pullError,
    localPersisted,
    cacheError,
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
    let dataUrl = data?.asset?.dataUrl || null;
    if (data?.asset?.chunked) {
      const { total, totalChars } = data.asset;
      if (!Number.isInteger(totalChars) || totalChars <= CLOUD_IMAGE_PART_CHARS || totalChars > CLOUD_IMAGE_MAX_CHARS
        || total !== Math.ceil(totalChars / CLOUD_IMAGE_PART_CHARS)) return null;
      const parts = [];
      for (let index = 0; index < total; index += 1) {
        const part = await syncRequest(null, {
          method: 'GET', query: `asset=${encodeURIComponent(assetId)}&part=${index}`, signal,
        });
        const value = part?.asset?.data;
        const expectedLength = Math.min(CLOUD_IMAGE_PART_CHARS, totalChars - index * CLOUD_IMAGE_PART_CHARS);
        if (part?.asset?.index !== index || typeof value !== 'string' || value.length !== expectedLength) return null;
        parts.push(value);
      }
      dataUrl = parts.join('');
    }
    // Nunca aplica um original incompleto ou outro arquivo sob a mesma chave.
    if (dataUrl && isOriginalImageAsset(assetId) && await originalImageAssetId(dataUrl) !== assetId) return null;
    return dataUrl;
  } catch {
    return null;
  }
}

async function resolveCachedAsset(assetId, assetCache) {
  if (!assetId) return null;
  if (assetCache.has(assetId)) return assetCache.get(assetId);
  // Salvar já tem os bytes originais preparados. Evita baixá-los de novo e
  // mantém a foto local íntegra mesmo quando um upload precisa ser retomado.
  const prepared = assetCache.localAssets?.get(assetId);
  if (prepared && isOriginalImageAsset(assetId)) return prepared;
  const pending = fetchAssetDataUrl(assetId, assetCache.signal).then((dataUrl) => {
    if (dataUrl) assetCache.downloaded?.add(assetId);
    else assetCache.missing.add(assetId);
    return dataUrl || null;
  });
  assetCache.set(assetId, pending);
  return pending;
}

/** Recupera o PNG original de uma logo que a compactação antiga achatou em JPEG.
 * Só reutiliza o arquivo local quando a identidade remota coincide. */
async function resolveCloudLogo(assetId, assetCache, local = {}) {
  const remote = await resolveCachedAsset(assetId, assetCache);
  if (remote?.startsWith('data:image/png;')) return remote;
  const prepared = assetCache.localAssets?.get(assetId);
  if (prepared?.startsWith('data:image/png;')) return prepared;
  if (assetId && (local?.assetId === assetId || local?.imageId === assetId)) {
    if (local.dataUrl?.startsWith('data:image/png;')) return local.dataUrl;
    if (local.imageId) {
      try {
        const original = await imagemComoDataUrl(local.imageId);
        if (original?.startsWith('data:image/png;')) return original;
      } catch { /* preserva a cópia remota se o original não estiver acessível */ }
    }
  }
  return remote;
}

async function hydrateSlideFromCloud(slide, assetCache, localSlide, imageResult) {
  try {
    if (imageResult) imageResult.loaded = false;
    let sl = { ...slide };
    const bgAsset = sl.bgImageAssetId;
    if (bgAsset) {
      const dataUrl = await resolveCachedAsset(bgAsset, assetCache);
      if (dataUrl) {
        try {
          const sameLocalPhoto = localSlide?.bgImageAssetId === bgAsset;
          const packed = await guardarImagemDoSlide(dataUrl, {
            id: (sameLocalPhoto && localSlide?.bgImageId) || bgAsset,
          });
          // Se o IndexedDB falhar, guardarImagemDoSlide devolve o data URL sem
          // ID. Para um asset baixado e confirmado na nuvem, um object URL
          // conserva a prévia sem levar megabytes para o localStorage.
          let runtimePhoto = packed;
          if (!packed.bgImageId && assetCache.downloaded?.has(bgAsset)
            && typeof packed.bgImage === 'string' && packed.bgImage.startsWith('data:image/')) {
            try {
              const blob = dataUrlParaBlob(dataUrl);
              runtimePhoto = { bgImage: blob ? URL.createObjectURL(blob) : null, bgImageId: null };
            } catch {
              runtimePhoto = { bgImage: null, bgImageId: null };
            }
          }
          sl = { ...sl, ...runtimePhoto, bgImageFailed: false, bgImageError: null };
          if (imageResult) imageResult.loaded = !!(runtimePhoto.bgImageId || runtimePhoto.bgImage);
        } catch { /* */ }
      } else {
        // Uma falha remota não remove a cópia desta mesma foto no navegador.
        const sameLocalPhoto = localSlide?.bgImageAssetId === bgAsset
          || localSlide?.bgImageId === bgAsset
          || (sl.bgImageId && localSlide?.bgImageId === sl.bgImageId);
        const localId = (sameLocalPhoto && localSlide?.bgImageId) || sl.bgImageId || bgAsset;
        try {
          const localPhoto = await imagemComoDataUrl(localId);
          if (localPhoto) {
            sl = { ...sl, bgImage: localPhoto, bgImageId: localId, bgImageFailed: false, bgImageError: null };
            if (imageResult) imageResult.loaded = true;
          }
        } catch { /* continua com os textos e a referência remota */ }
      }
    }
    const logoAsset = sl.logoImageAssetId;
    if (logoAsset) {
      const dataUrl = await resolveCloudLogo(logoAsset, assetCache, {
        assetId: localSlide?.logoImageAssetId, imageId: localSlide?.logoImageId, dataUrl: localSlide?.logoImage,
      });
      // O ID de outro navegador não confirma uma gravação local. PNG só recebe
      // um novo ID após import; JPEG legado continua portátil até ser trocado.
      if (dataUrl) sl = { ...sl, logoImage: dataUrl, logoImageId: null };
    }
    try { sl = await importSlideLogo(sl); } catch { /* */ }
    const refAsset = sl.refImageAssetId;
    if (refAsset) {
      let dataUrl = await resolveCachedAsset(refAsset, assetCache);
      // A referência legada pode ainda não ter ID local. O asset preparado
      // neste mesmo push mantém a associação exata se o upload/GET falhar.
      if (!dataUrl) dataUrl = assetCache.localAssets?.get(refAsset) || null;
      let localId = null;
      if (!dataUrl) {
        const sameLocalReference = localSlide?.refImageAssetId === refAsset
          || localSlide?.refImageId === refAsset
          || (sl.refImageId && localSlide?.refImageId === sl.refImageId);
        if (sameLocalReference && typeof localSlide?.refImage === 'string'
          && localSlide.refImage.startsWith('data:image/')) dataUrl = localSlide.refImage;
        localId = (sameLocalReference && localSlide?.refImageId) || sl.refImageId || refAsset;
        if (!dataUrl) {
          try { dataUrl = await imagemComoDataUrl(localId); } catch { /* a referência fica identificada como indisponível */ }
        }
      }
      if (dataUrl) {
        try {
          const sameLocalReference = localSlide?.refImageAssetId === refAsset;
          const packed = await guardarImagemDoSlide(dataUrl, {
            id: localId || (sameLocalReference && localSlide?.refImageId) || refAsset,
          });
          sl = {
            ...sl, refImageId: packed.bgImageId || null, refImage: packed.bgImageId ? null : dataUrl,
            refImageFailed: false, refImageError: null,
          };
          if (packed.bgImageId && packed.bgImage?.startsWith('blob:')) URL.revokeObjectURL(packed.bgImage);
        } catch {
          // Conserva os bytes durante uma indisponibilidade local; a migração
          // poderá tentar novamente sem alterar a referência escolhida.
          sl = { ...sl, refImageId: null, refImage: dataUrl, refImageFailed: false, refImageError: null };
        }
      } else {
        sl = {
          ...sl, refImage: null, refImageFailed: true,
          refImageError: 'A referência deste card está indisponível. Importe-a novamente antes de gerar.',
        };
      }
    } else {
      try { sl = await importSlideReference(sl); } catch { /* preserva o anexo legado */ }
    }
    return sl;
  } catch {
    if (imageResult) imageResult.loaded = false;
    return { ...slide };
  }
}

async function hydrateBrandFromCloud(brand, assetCache, localBrand) {
  try {
    let next = { ...(brand || {}) };
    if (next.logoAssetId) {
      const dataUrl = await resolveCloudLogo(next.logoAssetId, assetCache, {
        assetId: localBrand?.logoAssetId, imageId: localBrand?.logoImageId, dataUrl: localBrand?.logo,
      });
      if (dataUrl) next = { ...next, logo: dataUrl, logoImageId: null };
    }
    try { next = await importBrandLogo(next); } catch { /* */ }
    return next;
  } catch {
    return { ...(brand || {}) };
  }
}

/** Reutiliza a hidratação de logos sem carregar documentos da biblioteca. */
export async function hydrateCloudBrandRoster(brands, { signal, localBrands = [], localAssets } = {}) {
  const locals = Array.isArray(localBrands) ? localBrands : [];
  const assetCache = new Map();
  assetCache.signal = signal;
  assetCache.missing = new Set();
  assetCache.downloaded = new Set();
  assetCache.localAssets = localAssets;
  const result = [];
  for (const brand of (Array.isArray(brands) ? brands : [])) {
    try {
      result.push(await hydrateBrandFromCloud(brand, assetCache,
        locals.find((item) => item?.id === brand?.id)));
    } catch {
      // Uma logo indisponível não pode impedir o restore dos dados da conta.
      result.push(brand);
    }
  }
  return { brands: result, assetsMissing: assetCache.missing.size };
}

async function hydrateStyleKitFromCloud(styleKit, assetCache, localStyleKit) {
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
      const dataUrl = await resolveCloudLogo(kit.logo.assetId, assetCache, localStyleKit?.logo);
      if (dataUrl) kit.logo = { ...kit.logo, dataUrl, imageId: null };
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

function cloudAssetCache(signal, localAssets) {
  const cache = new Map();
  cache.signal = signal;
  cache.missing = new Set();
  cache.downloaded = new Set();
  cache.localAssets = localAssets;
  return cache;
}

async function hydrateProjectEntry(entry, assetCache, localEntry, onProgress) {
  if (!entry?.doc || typeof entry.doc !== 'object') return entry;
  const localDoc = localEntry?.doc;
  try {
    const localSlides = Array.isArray(localDoc?.slides) ? localDoc.slides : [];
    const sourceSlides = Array.isArray(entry.doc.slides) ? entry.doc.slides : [];
    const total = sourceSlides.filter((slide) => !!slide?.bgImageAssetId).length;
    let completed = 0;
    let loaded = 0;
    const slides = Array.isArray(entry.doc.slides)
      ? await Promise.all(sourceSlides.map(async (slide) => {
        const imageResult = slide?.bgImageAssetId ? { loaded: false } : null;
        const hydrated = await hydrateSlideFromCloud(
          slide, assetCache, localSlides.find((item) => item?.id === slide?.id), imageResult,
        );
        if (imageResult) {
          completed += 1;
          if (imageResult.loaded) loaded += 1;
          try { onProgress?.({ projectId: entry.id, completed, total, loaded, missing: completed - loaded }); }
          catch { /* observação de progresso não pode interromper a restauração */ }
        }
        return hydrated;
      }))
      : [];
    return {
      ...entry,
      doc: {
        ...entry.doc,
        slides,
        brand: await hydrateBrandFromCloud(entry.doc.brand, assetCache, localDoc?.brand),
        styleKit: await hydrateStyleKitFromCloud(entry.doc.styleKit, assetCache, localDoc?.styleKit),
      },
    };
  } catch {
    // A estrutura e os textos continuam disponíveis quando uma foto falha.
    return { ...entry, doc: { ...entry.doc, slides: Array.isArray(entry.doc.slides)
      ? entry.doc.slides.map((slide) => ({ ...slide })) : [] } };
  }
}

/** Hidrata apenas o detalhe aberto, sem buscar fotos de todos os projetos.
 * onProgress acompanha os fundos com bgImageAssetId por card, inclusive 404;
 * projetos sem fundos remotos não emitem eventos. Logos não entram na contagem.
 */
export async function hydrateProjectEntryFromCloud(entry, { signal, localEntry, localAssets, onProgress } = {}) {
  if (!entry || typeof entry !== 'object' || !entry.id) {
    throw new Error('Projeto da nuvem inválido.');
  }
  if (signal?.aborted) throw new Error('Sincronização cancelada.');
  const assetCache = cloudAssetCache(signal, localAssets);
  const hydrated = await hydrateProjectEntry(entry, assetCache, localEntry, onProgress);
  if (signal?.aborted) throw new Error('Sincronização cancelada.');
  return { entry: hydrated, assetsMissing: assetCache.missing.size };
}

function assertAuthoritativeRead({ expectedOwnerId, localOwnerId, ownerAtStart, signal, manifest }) {
  if (signal?.aborted) throw new Error('Sincronização cancelada.');
  if (!expectedOwnerId || !localOwnerId || localStorage.getItem(SK.dataOwner) !== ownerAtStart
    || readDataOwner() !== localOwnerId) {
    throw new Error('A conta mudou durante a sincronização. Entre novamente para atualizar a biblioteca.');
  }
  if (manifest && manifest.customerId !== expectedOwnerId) {
    throw new Error('A nuvem respondeu para outra conta. A biblioteca atual foi preservada.');
  }
}

async function readAuthoritativeManifest(signal) {
  // Um GET ou corpo travado não pode manter o boot na tela de restauração para
  // sempre. O race cobre também clientes/testes que ignoram AbortSignal; ao
  // perder a corrida, a resposta tardia nunca chega a aplicar um snapshot.
  if (signal?.aborted) throw new Error('Sincronização cancelada.');
  const controller = new AbortController();
  let timedOut = false;
  let rejectCancelled;
  const cancelled = new Promise((_, reject) => { rejectCancelled = reject; });
  const onRequestAbort = () => rejectCancelled(new Error(timedOut
    ? 'Tempo de restauração da biblioteca esgotado. Verifique sua conexão e tente novamente.'
    : 'Sincronização cancelada.'));
  const onCallerAbort = () => controller.abort();
  controller.signal.addEventListener('abort', onRequestAbort, { once: true });
  signal?.addEventListener('abort', onCallerAbort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AUTHORITATIVE_MANIFEST_TIMEOUT_MS);
  try {
    return await Promise.race([
      syncRequest(null, { method: 'GET', query: 'full=1', signal: controller.signal }),
      cancelled,
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
    controller.signal.removeEventListener('abort', onRequestAbort);
  }
}

/**
 * Leitura autoritativa para a biblioteca v2. Somente a nuvem determina quais
 * projetos estão vivos; tombstones locais legados não filtram a lista. O
 * retorno é um snapshot para React, sem gravar localStorage ou fazer push.
 * `selected` hidrata imagens só do projeto aberto; `none` carrega a estrutura
 * imediatamente; `all` serve para importações explícitas, não para o boot.
 */
export async function pullAccountLibraryAuthoritative({
  signal, expectedOwnerId, localOwnerId = readDataOwner(), selectedProjectId,
  hydrateImages = 'selected', localSnapshot, localAssets, onBeforeApply,
} = {}) {
  if (!['none', 'selected', 'all'].includes(hydrateImages)) {
    throw new Error('Modo de hidratação inválido.');
  }
  const ownerAtStart = localStorage.getItem(SK.dataOwner);
  const guard = (manifest) => assertAuthoritativeRead({
    expectedOwnerId, localOwnerId, ownerAtStart, signal, manifest,
  });
  guard();
  const data = await readAuthoritativeManifest(signal);
  guard();
  if (data.empty) {
    // O 404 vazio não traz manifesto com owner. Confirme a sessão antes de
    // substituir uma lista local por zero projetos.
    const status = await fetchLibraryCloudStatus({ signal });
    guard();
    if (status.customerId !== expectedOwnerId || !status.empty) {
      throw new Error('Não foi possível confirmar a biblioteca vazia desta conta.');
    }
    const snapshot = {
      library: [], deletedIds: [], libraryFolders: [], brandRoster: [],
      activeDocId: '', activeBrandId: '',
    };
    onBeforeApply?.(snapshot);
    guard();
    return { ok: true, empty: true, snapshot, projectCount: 0,
      revision: 0, updatedAt: 0, assetsMissing: 0, localPersisted: false, warnings: [] };
  }
  const manifest = data.manifest;
  if (!manifest || !Array.isArray(manifest.docs)) {
    throw new Error('A nuvem não devolveu uma biblioteca válida.');
  }
  guard(manifest);
  const remoteDeletedIds = mergeDeletedProjectIds(manifest.deletedIds);
  const remotelyDeleted = new Set(remoteDeletedIds);
  const liveDocs = manifest.docs.filter((entry) => entry?.id && !remotelyDeleted.has(String(entry.id)));
  const activeDocId = liveDocs.some((entry) => entry.id === manifest.activeDocId)
    ? manifest.activeDocId : liveDocs[0]?.id || '';
  const selectedId = liveDocs.some((entry) => entry.id === selectedProjectId)
    ? selectedProjectId : activeDocId;
  const localDocs = Array.isArray(localSnapshot?.library) ? localSnapshot.library : [];
  const assetCache = cloudAssetCache(signal, localAssets);
  const docs = [];
  for (const entry of liveDocs) {
    guard();
    if (hydrateImages === 'all' || (hydrateImages === 'selected' && entry.id === selectedId)) {
      // eslint-disable-next-line no-await-in-loop
      docs.push(await hydrateProjectEntry(entry, assetCache,
        localDocs.find((item) => item?.id === entry.id)));
    } else {
      docs.push(entry);
    }
  }
  const remoteBrands = Array.isArray(manifest.brands) ? manifest.brands : [];
  const localBrands = Array.isArray(localSnapshot?.brandRoster) ? localSnapshot.brandRoster : [];
  const brands = [];
  for (const brand of remoteBrands) {
    guard();
    if (hydrateImages === 'none') {
      brands.push(brand);
    } else {
      // eslint-disable-next-line no-await-in-loop
      brands.push(await hydrateBrandFromCloud(brand, assetCache,
        localBrands.find((item) => item?.id === brand?.id)));
    }
  }
  const snapshot = {
    library: docs,
    deletedIds: remoteDeletedIds,
    libraryFolders: Array.isArray(manifest.folders) ? manifest.folders : [],
    brandRoster: brands,
    activeDocId,
    activeBrandId: manifest.activeBrandId ?? brands[0]?.id ?? '',
    userProfile: manifest.userProfile || null,
    onboardingDone: manifest.onboardingDone || null,
    modesIntroDone: manifest.modesIntroDone || null,
  };
  onBeforeApply?.(snapshot);
  guard();
  const assetsMissing = assetCache.missing.size;
  return {
    ok: true, empty: false, snapshot, projectCount: docs.length,
    revision: Number(manifest.revision || 0), updatedAt: Number(manifest.updatedAt || 0),
    assetsMissing, localPersisted: false,
    warnings: assetsMissing
      ? [`${assetsMissing} imagem(ns) indisponível(is); todos os projetos foram restaurados.`] : [],
  };
}

/**
 * Aplica manifesto da nuvem ao localStorage (e IndexedDB).
 * Devolve snapshot para a UI e mantém gravações travadas até o chamador
 * atualizar o estado React ou recarregar a página.
 */
export async function applyCloudManifest(manifest, {
  context = captureSyncContext(), signal, beforeApply, localSnapshot, localAssets, allowMemoryFallback = false,
} = {}) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.docs)) {
    throw new Error('Manifesto da nuvem inválido.');
  }
  assertSyncContext(context, { signal, checkLibrary: true });
  const assetCache = new Map();
  assetCache.signal = signal;
  assetCache.missing = new Set();
  assetCache.downloaded = new Set();
  assetCache.localAssets = localAssets;
  let localDocs = [];
  if (Array.isArray(localSnapshot?.library)) localDocs = localSnapshot.library;
  else {
    try { localDocs = JSON.parse(context.library || '[]'); } catch { /* cache corrompida pode ser restaurada */ }
  }
  const docs = [];
  const deletedIds = mergeDeletedProjectIds(readDeletedProjectIds(), localSnapshot?.deletedIds, manifest.deletedIds);
  const deleted = new Set(deletedIds);
  for (const entry of (manifest.docs || [])) {
    if (deleted.has(String(entry?.id))) continue;
    if (!entry?.doc) {
      docs.push(entry);
      continue;
    }
    try {
      const localDoc = (Array.isArray(localDocs) ? localDocs : [])
        .find((localEntry) => localEntry?.id === entry.id)?.doc;
      const localSlides = localDoc?.slides || [];
      const slides = Array.isArray(entry.doc.slides)
        ? await Promise.all(entry.doc.slides.map((s) => hydrateSlideFromCloud(s, assetCache,
          localSlides.find((localSlide) => localSlide?.id === s?.id))))
        : [];
      docs.push({
        ...entry,
        doc: {
          ...entry.doc,
          slides,
          brand: await hydrateBrandFromCloud(entry.doc.brand, assetCache, localDoc?.brand),
          styleKit: await hydrateStyleKitFromCloud(entry.doc.styleKit, assetCache, localDoc?.styleKit),
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
  const localBrands = localSnapshot?.brandRoster || lsGet(SK.brands, []) || [];
  for (const profile of (Array.isArray(manifest.brands) ? manifest.brands : [])) {
    try {
      brands.push(await hydrateBrandFromCloud(profile, assetCache,
        Array.isArray(localBrands) ? localBrands.find((item) => item?.id === profile.id) : undefined));
    } catch {
      brands.push(profile);
    }
  }

  beforeApply?.();
  assertSyncContext(context, { signal, checkLibrary: true });
  if (!lockOtherAccountTabs()) {
    throw new Error('Outra aba está atualizando a biblioteca. Aguarde e sincronize novamente.');
  }
  try {
  rememberDeletedProjectIds(deletedIds);
  const snapshot = {
    library: docs,
    deletedIds,
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
  let cacheError = '';
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
    cacheError = 'A biblioteca está na nuvem, mas não foi possível gravar a lista neste navegador. Libere espaço e sincronize novamente.';
    if (!allowMemoryFallback) {
      throw new Error(cacheError);
    }
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
    localPersisted: !cacheError,
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
    localPersisted: !cacheError,
    cacheError,
    assetsMissing,
    warnings: assetsMissing ? [`${assetsMissing} imagem(ns) indisponível(is); todos os projetos foram restaurados.`] : [],
  };
  } catch (error) {
    // Falha antes da aplicação React: não deixar a outra aba parada pelo TTL.
    unlockAccountDataWrites();
    throw error;
  }
}

export async function pullLibraryFromCloud({
  context = captureSyncContext(), signal, beforeApply, expectedMeta, localSnapshot, localAssets, allowMemoryFallback = false,
} = {}) {
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
  const applied = await applyCloudManifest(data.manifest, {
    context, signal, beforeApply, localSnapshot, localAssets, allowMemoryFallback,
  });
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
 * @returns {Promise<'ok'|'reloading'|'skipped'|'blocked'>}
 */
export async function reconcileLibraryCloud({ toast, onApplied, localSnapshot } = {}) {
  if (typeof window === 'undefined') return 'skipped';
  // No reload, o lease anterior só é retomado depois de verificar se a aba
  // original ainda existe. Não classificar esse intervalo como falha de sync.
  await waitForAccountWriteLockProbe();
  const localMeta = readCloudMeta();
  const hasRestoredSnapshot = Array.isArray(localSnapshot?.library);
  // O cofre durável já restaurado na UI é mais recente que a cache que não
  // coube em localStorage. Apenas essa cache antiga exige pull obrigatório.
  // Um push já confirmado cujo GET falhou deixou um recibo `needsPull`.
  // Sem snapshot novo do cofre, a cache antiga não deve ser enviada de novo.
  const requiresCloudRestore = (localMeta?.localPersisted === false || localMeta?.needsPull === true)
    && !hasRestoredSnapshot;
  try {
    const status = await fetchLibraryCloudStatus();
    const local = localLibraryFingerprint();
    const hasLocalChanges = local.count > 0 || readDeletedProjectIds().length > 0;
    // O callback aplica a união ao React antes de liberar autosave. Sem ele,
    // um reload ainda precisaria do cache persistido e deve continuar estrito.
    const allowMemoryFallback = typeof onApplied === 'function';
    let result;
    if (hasRestoredSnapshot) {
      result = await pushLibraryToCloud({
        snapshot: localSnapshot, force: true, pullAfter: true, allowMemoryFallback,
      });
    } else if (requiresCloudRestore) {
      // A memória recebeu uma versão que não coube em localStorage. No próximo
      // boot esta cache não representa uma edição local e nunca pode fazer push.
      // O mesmo vale quando o manifesto subiu, mas o pull não foi confirmado.
      const expectedRevision = Math.max(Number(localMeta?.revision || 0), Number(localMeta?.pendingRevision || 0));
      const expectedMeta = Number(status?.meta?.revision || 0) >= expectedRevision
        ? status.meta : { ...status?.meta, revision: expectedRevision };
      result = await pullLibraryFromCloud({ expectedMeta, allowMemoryFallback });
      if (!result.snapshot) throw new Error(CLOUD_LIBRARY_RESTORE_BLOCKED_MESSAGE);
    } else if (hasLocalChanges) {
      result = await pushLibraryToCloud({ force: true, pullAfter: true, allowMemoryFallback });
    } else if (!status.empty && status.meta) {
      result = await pullLibraryFromCloud({ expectedMeta: status.meta, allowMemoryFallback });
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
      const cacheDetail = result.localPersisted === false
        ? ' A lista foi atualizada, mas o navegador continua sem espaço para a cópia local.' : '';
      toast(`Biblioteca sincronizada: ${result.projectCount} projeto(s).${detail}${cacheDetail}`,
        result.assetsMissing || cacheDetail ? 'warning' : 'success', 5000);
    }
    return 'ok';
  } catch (e) {
    if (typeof toast === 'function') {
      toast(requiresCloudRestore ? CLOUD_LIBRARY_RESTORE_BLOCKED_MESSAGE
        : e?.message || 'Não foi possível sincronizar a biblioteca.', 'warning', 5500);
    }
    return requiresCloudRestore ? 'blocked' : 'skipped';
  }
}

/** Best-effort (logout/auto) — só envia; devolve o recibo, incluindo falhas de assets. */
export async function pushLibraryToCloudBestEffort(timeoutMs = 8_000, opts = {}) {
  const controller = new AbortController();
  let timer;
  let rejectAborted;
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  if (opts.signal?.aborted) controller.abort();
  else opts.signal?.addEventListener('abort', abortFromCaller, { once: true });
  try {
    const cancelled = new Promise((_, reject) => {
      rejectAborted = () => reject(new Error(timedOut
        ? 'Tempo de sincronização esgotado.' : 'Sincronização cancelada.'));
      if (controller.signal.aborted) rejectAborted();
      else controller.signal.addEventListener('abort', rejectAborted, { once: true });
    });
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const result = await Promise.race([
      pushLibraryToCloud({
        snapshot: opts.snapshot, force: true, allowShrink: false,
        allowLocked: true, pullAfter: false, signal: controller.signal,
      }),
      cancelled,
    ]);
    return result;
  } catch (error) {
    return { ok: false, cloudSaved: false, pushError: String(error?.message || error || 'Falha ao sincronizar.') };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', abortFromCaller);
    controller.signal.removeEventListener('abort', rejectAborted);
  }
}

export { readCloudMeta, writeCloudMeta };
