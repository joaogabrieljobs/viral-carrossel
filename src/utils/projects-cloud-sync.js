/**
 * Salva um projeto isoladamente. Os bytes das imagens continuam no Blob; a
 * linha versionada do projeto só é confirmada depois de todos os uploads.
 */
import { readDataOwner } from './account-data-owner.js';
import { packLibraryForCloud, uploadAssetsBestEffort } from './library-sync.js';
import { ProjectApiError, putProject } from './projects-client.js';
import { areAccountDataWritesLocked, isAccountDataWriteOwnerCurrent } from './storage.js';

const PROJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const MAX_ENTRY_BYTES = 2 * 1024 * 1024;

function cloudError(message, code) {
  return new ProjectApiError(message, { code });
}

function assertCurrent(ownerId, { signal, isCurrent } = {}) {
  if (signal?.aborted) throw cloudError('Sincronização cancelada.', 'project_sync_aborted');
  if (!ownerId || readDataOwner() !== ownerId || !isAccountDataWriteOwnerCurrent()) {
    throw cloudError('A conta mudou durante o salvamento. Nada foi confirmado para a conta atual.', 'project_owner_changed');
  }
  if (areAccountDataWritesLocked()) {
    throw cloudError('A biblioteca ainda está sendo restaurada. Tente salvar novamente.', 'project_library_locked');
  }
  if (typeof isCurrent === 'function' && !isCurrent()) {
    throw cloudError('O projeto mudou durante o envio. As novas alterações continuam no editor; salve novamente.', 'project_changed_during_sync');
  }
}

function selectedBrand(entry, snapshot) {
  const id = entry?.doc?.brand?.id || snapshot?.activeBrandId;
  return (snapshot?.brandRoster || []).find((brand) => brand?.id === id) || null;
}

function selectedFolder(entry, snapshot) {
  return (snapshot?.libraryFolders || []).find((folder) => folder?.id === entry?.folderId) || null;
}

/**
 * Empacota somente o projeto ativo e seu contexto relevante. `accountContext`
 * deve ser gravado por uma futura rota de metadados da conta; a API /projects
 * persiste exclusivamente `entry`.
 */
export async function prepareProjectCloudPayload(entry, { snapshot = {}, ownerId, signal, isCurrent } = {}) {
  if (typeof entry?.id !== 'string' || !PROJECT_ID.test(entry.id)) {
    throw cloudError('ID de projeto inválido.', 'project_bad_id');
  }
  assertCurrent(ownerId, { signal, isCurrent });
  const brand = selectedBrand(entry, snapshot);
  const folder = selectedFolder(entry, snapshot);
  const document = entry.doc && !entry.doc.brand && brand
    ? { ...entry.doc, brand }
    : entry.doc;
  const singleEntry = document === entry.doc ? entry : { ...entry, doc: document };
  const { manifest, assets, packingFailed } = await packLibraryForCloud({
    library: [singleEntry],
    brandRoster: brand ? [brand] : [],
    libraryFolders: folder ? [folder] : [],
    activeBrandId: brand?.id || entry?.doc?.brand?.id || '',
    activeDocId: entry.id,
    deletedIds: [],
    ignoreLocalDeletedIds: true,
  });
  assertCurrent(ownerId, { signal, isCurrent });
  if (packingFailed) {
    throw cloudError(`Não foi possível preparar ${packingFailed} imagem(ns) para a nuvem.`, 'project_asset_too_large');
  }
  const packed = manifest.docs?.[0];
  if (manifest.docs?.length !== 1 || packed?.id !== entry.id) {
    throw cloudError('Este projeto foi excluído ou mudou durante a preparação. Nada foi enviado.', 'project_changed_during_sync');
  }
  let bytes;
  try { bytes = new TextEncoder().encode(JSON.stringify(packed)).byteLength; }
  catch { throw cloudError('Não foi possível preparar este projeto para salvar.', 'project_bad_entry'); }
  if (bytes > MAX_ENTRY_BYTES) {
    throw cloudError('Este projeto excede o tamanho permitido na nuvem.', 'project_too_large');
  }
  return {
    entry: packed,
    assets,
    accountContext: { brands: manifest.brands, folders: manifest.folders },
  };
}

/**
 * Exige uma versão observada anteriormente na nuvem. Versão 0 cria um projeto;
 * uma linha já existente devolve 409 em vez de ser substituída às cegas.
 *
 * O retorno confirma apenas este projeto, nunca a biblioteca completa.
 */
export async function saveProjectEntryToCloud({
  entry, snapshot, baseVersion, ownerId, expectedOwnerId, signal, isCurrent,
} = {}) {
  if (!Number.isSafeInteger(baseVersion) || baseVersion < 0) {
    throw cloudError('Confirme a versão deste projeto antes de salvar.', 'project_bad_version');
  }
  if (typeof expectedOwnerId !== 'string' || !expectedOwnerId) {
    throw cloudError('Não foi possível confirmar a conta para salvar.', 'project_owner_unverified');
  }
  const guard = () => assertCurrent(ownerId, { signal, isCurrent });
  const prepared = await prepareProjectCloudPayload(entry, {
    snapshot, ownerId, signal, isCurrent,
  });
  guard();
  const assets = prepared.assets.size
    ? await uploadAssetsBestEffort(prepared.assets, { owner: ownerId, signal, assertCurrent: guard })
    : { uploaded: 0, skipped: 0, failed: 0, lastError: '' };
  guard();
  if (assets.failed) {
    throw cloudError(
      `Não foi possível enviar ${assets.failed} imagem(ns). O projeto continua no editor; tente salvar novamente.`,
      'project_asset_upload_failed',
    );
  }
  const project = await putProject(prepared.entry, {
    baseVersion, expectedOwnerId, signal,
  });
  guard();
  return {
    ok: true,
    project,
    version: project.version,
    assetsUploaded: assets.uploaded,
    assetsReused: assets.skipped,
    accountContext: prepared.accountContext,
  };
}
