/**
 * Metadados globais da conta (marcas, pastas, perfil e onboarding).
 * A API é autoritativa; um cache local antigo nunca é enviado automaticamente
 * por cima dos dados que outro dispositivo já gravou.
 */
import { readDataOwner } from './account-data-owner.js';
import { packLibraryForCloud, hydrateCloudBrandRoster, uploadAssetsBestEffort } from './library-sync.js';
import { areAccountDataWritesLocked, isAccountDataWriteOwnerCurrent } from './storage.js';

const META_API = '/api/account-library-meta';
const MAX_METADATA_BYTES = 512 * 1024;

export class AccountMetadataError extends Error {
  constructor(message, { status = 0, code = 'account_meta_request_failed', cloudRevision } = {}) {
    super(message);
    this.name = 'AccountMetadataError';
    this.status = status;
    this.code = code;
    if (cloudRevision !== undefined) this.cloudRevision = cloudRevision;
  }
}

function error(message, code) {
  return new AccountMetadataError(message, { code });
}

function assertOwner({ localOwnerId, signal, isCurrent, forWrite = false } = {}) {
  if (signal?.aborted) throw error('Sincronização cancelada.', 'account_meta_aborted');
  if (!localOwnerId || readDataOwner() !== localOwnerId || !isAccountDataWriteOwnerCurrent()) {
    throw error('A conta mudou durante a sincronização.', 'account_meta_owner_changed');
  }
  if (forWrite && areAccountDataWritesLocked()) {
    throw error('Os dados da conta ainda estão sendo restaurados.', 'account_meta_locked');
  }
  if (typeof isCurrent === 'function' && !isCurrent()) {
    throw error('Os dados da conta mudaram durante o envio. Salve novamente.', 'account_meta_changed_during_sync');
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateResponse(data) {
  if (data?.ok !== true || !isRecord(data.metadata)
    || !Number.isSafeInteger(data.revision) || data.revision < 0) {
    throw error('A nuvem não confirmou os dados da conta.', 'account_meta_bad_response');
  }
  return {
    metadata: data.metadata,
    revision: data.revision,
    updatedAt: Number.isSafeInteger(data.updatedAt) ? data.updatedAt : 0,
  };
}

async function request(method, body, { expectedOwnerId, localOwnerId, signal, isCurrent } = {}) {
  assertOwner({ localOwnerId, signal, isCurrent, forWrite: method !== 'GET' });
  if (typeof expectedOwnerId !== 'string' || !expectedOwnerId.trim()) {
    throw error('Não foi possível confirmar a conta para sincronizar.', 'account_meta_owner_unverified');
  }
  let response;
  try {
    response = await fetch(META_API, {
      method,
      credentials: 'include',
      cache: 'no-store',
      signal,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        'X-Account-Owner': expectedOwnerId,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw error('Não foi possível conectar aos dados da conta. Tente novamente.', 'account_meta_network_error');
  }
  let data;
  try { data = await response.json(); } catch { data = null; }
  assertOwner({ localOwnerId, signal, isCurrent, forWrite: method !== 'GET' });
  if (!response.ok || data?.ok !== true) {
    throw new AccountMetadataError(data?.error || 'Não foi possível sincronizar os dados da conta.', {
      status: response.status,
      code: data?.code || 'account_meta_request_failed',
      cloudRevision: data?.cloudRevision,
    });
  }
  return validateResponse(data);
}

/** Consulta sem modificar cache ou estado React. */
export async function getAccountLibraryMetadata(options = {}) {
  return request('GET', undefined, options);
}

/** Um 404/405 indica deploy anterior sem a API; 503 deve permanecer falha. */
export function isAccountMetadataEndpointUnsupported(cause) {
  return cause instanceof AccountMetadataError && [404, 405].includes(cause.status);
}

/**
 * Prepara todos os dados globais e seus logos, sem incluir documentos.
 * O snapshot explícito permite ao editor salvar mudanças ainda só no React.
 */
export async function prepareAccountLibraryMetadata(snapshot = {}, {
  localOwnerId, signal, isCurrent,
} = {}) {
  if (!isRecord(snapshot)) throw error('Dados globais da conta inválidos.', 'account_meta_bad_data');
  assertOwner({ localOwnerId, signal, isCurrent, forWrite: true });
  const packingSnapshot = { library: [], deletedIds: [] };
  for (const key of ['brandRoster', 'libraryFolders', 'activeBrandId', 'activeDocId']) {
    if (Object.hasOwn(snapshot, key)) packingSnapshot[key] = snapshot[key];
  }
  const { manifest, assets, packingFailed } = await packLibraryForCloud(packingSnapshot);
  assertOwner({ localOwnerId, signal, isCurrent, forWrite: true });
  if (packingFailed) {
    throw error(`Não foi possível preparar ${packingFailed} logo(s) para a nuvem.`, 'account_meta_asset_too_large');
  }
  const metadata = {
    brands: manifest.brands,
    folders: manifest.folders,
    activeBrandId: manifest.activeBrandId,
    activeDocId: manifest.activeDocId,
    userProfile: Object.hasOwn(snapshot, 'userProfile') ? snapshot.userProfile : manifest.userProfile,
    onboardingDone: Object.hasOwn(snapshot, 'onboardingDone') ? snapshot.onboardingDone : manifest.onboardingDone,
    modesIntroDone: Object.hasOwn(snapshot, 'modesIntroDone') ? snapshot.modesIntroDone : manifest.modesIntroDone,
    assetIds: manifest.assetIds,
  };
  let bytes;
  try { bytes = new TextEncoder().encode(JSON.stringify(metadata)).byteLength; }
  catch { throw error('Dados globais da conta inválidos.', 'account_meta_bad_data'); }
  if (bytes > MAX_METADATA_BYTES) {
    throw error('As marcas e preferências excedem o tamanho permitido na nuvem.', 'account_meta_too_large');
  }
  return { metadata, assets };
}

/**
 * Exige a revisão observada na nuvem. Se outra aba mudou marca/pasta/perfil,
 * retorna 409 para o chamador resolver; nunca faz overwrite cego.
 */
export async function saveAccountLibraryMetadata(snapshot, {
  baseRevision, expectedOwnerId, localOwnerId, signal, isCurrent,
} = {}) {
  if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) {
    throw error('Confirme a revisão dos dados da conta antes de salvar.', 'account_meta_bad_revision');
  }
  const guard = () => assertOwner({ localOwnerId, signal, isCurrent, forWrite: true });
  const prepared = await prepareAccountLibraryMetadata(snapshot, { localOwnerId, signal, isCurrent });
  guard();
  const uploaded = prepared.assets.size
    ? await uploadAssetsBestEffort(prepared.assets, { owner: localOwnerId, signal, assertCurrent: guard })
    : { uploaded: 0, skipped: 0, failed: 0 };
  guard();
  if (uploaded.failed) {
    throw error(`Não foi possível enviar ${uploaded.failed} logo(s). Tente novamente.`, 'account_meta_asset_upload_failed');
  }
  const saved = await request('PUT', {
    metadata: prepared.metadata, baseRevision,
  }, { expectedOwnerId, localOwnerId, signal, isCurrent });
  guard();
  if (saved.revision <= baseRevision) {
    throw error('A nuvem não confirmou a nova revisão dos dados da conta.', 'account_meta_bad_response');
  }
  return { ...saved, assetsUploaded: uploaded.uploaded, assetsReused: uploaded.skipped };
}

/**
 * Puxa dados globais sem tocar em projetos. Assets ausentes deixam a marca sem
 * logo; os textos, pastas e perfil ainda são devolvidos para a UI.
 */
export async function restoreAccountLibraryMetadata({
  expectedOwnerId, localOwnerId, signal, localBrands = [], localAssets, isCurrent,
} = {}) {
  const remote = await getAccountLibraryMetadata({ expectedOwnerId, localOwnerId, signal, isCurrent });
  const hydrated = await hydrateCloudBrandRoster(remote.metadata.brands, {
    signal, localBrands, localAssets,
  });
  assertOwner({ localOwnerId, signal, isCurrent });
  return {
    ...remote,
    metadata: { ...remote.metadata, brands: hydrated.brands },
    assetsMissing: hydrated.assetsMissing,
  };
}

function hasRemoteAccountMetadata(remote) {
  if (remote.revision > 0) return true; // inclui exclusão intencional de todas as marcas/pastas
  const value = remote.metadata;
  return !!(
    value.brands?.length || value.folders?.length || value.assetIds?.length
    || value.activeBrandId || value.activeDocId || value.onboardingDone || value.modesIntroDone
    || (isRecord(value.userProfile) && Object.keys(value.userProfile).length)
  );
}

/**
 * Migração única do cache local: só cria metadados se a conta ainda não tiver
 * nenhum registro global na nuvem. A revisão 0 e o 409 protegem outro browser.
 * Chamar depois de concluir o restore/lock do login.
 */
export async function migrateLocalAccountMetadataIfEmpty(snapshot, options = {}) {
  const remote = await getAccountLibraryMetadata(options);
  if (hasRemoteAccountMetadata(remote)) return { ...remote, migrated: false };
  const local = await prepareAccountLibraryMetadata(snapshot, options);
  if (!hasRemoteAccountMetadata({ metadata: local.metadata, revision: 0 })) {
    return { ...remote, migrated: false };
  }
  try {
    await saveAccountLibraryMetadata(snapshot, { ...options, baseRevision: 0 });
  } catch (cause) {
    if (cause?.status !== 409 || cause?.code !== 'account_meta_conflict') throw cause;
    // Outra aba ganhou a criação. Releia seus dados; a cópia local antiga
    // nunca deve substituir a marca/pasta mais nova.
    return { ...(await getAccountLibraryMetadata(options)), migrated: false };
  }
  return { ...(await getAccountLibraryMetadata(options)), migrated: true };
}
