/**
 * Biblioteca transacional por conta. Os documentos ficam em linhas independentes;
 * imagens continuam no Vercel Blob pelo módulo legado. Nenhuma falha do banco
 * é interpretada como biblioteca vazia ou motivo para voltar a gravar no Blob.
 */
import { getPostgresConnection } from './postgres-connection.js';

const MAX_ASSETS = 800;
const MAX_PROJECT_ID = 500;
const MAX_PAGE_SIZE = 100;
const MAX_ACCOUNT_META_BYTES = 512 * 1024;
const ACCOUNT_META_FIELDS = new Set([
  'brands', 'folders', 'userProfile', 'onboardingDone', 'modesIntroDone',
  'activeBrandId', 'activeDocId', 'assetIds',
]);

const SQL = {
  state: `/* moont_state */
    SELECT owner_id, revision, updated_at, project_count, next_order,
      manifest_meta, meta_revision, meta_updated_at
    FROM moont.account_libraries WHERE owner_id = $1`,
  lockedState: `/* moont_locked_state */
    SELECT owner_id, revision, updated_at, project_count, next_order,
      manifest_meta, meta_revision, meta_updated_at
    FROM moont.account_libraries WHERE owner_id = $1 FOR UPDATE`,
  insertState: `/* moont_insert_state */
    INSERT INTO moont.account_libraries
      (owner_id, revision, updated_at, project_count, next_order, manifest_meta, migrated_from_blob)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
    ON CONFLICT (owner_id) DO NOTHING RETURNING owner_id`,
  updateState: `/* moont_update_state */
    UPDATE moont.account_libraries
    SET revision = $2, updated_at = $3, project_count = $4,
      next_order = $5, manifest_meta = $6::jsonb,
      meta_revision = meta_revision + (manifest_meta IS DISTINCT FROM $6::jsonb)::int,
      meta_updated_at = CASE WHEN manifest_meta IS DISTINCT FROM $6::jsonb
        THEN $3 ELSE meta_updated_at END
    WHERE owner_id = $1`,
  updateMetadataState: `/* moont_update_metadata_state */
    UPDATE moont.account_libraries
    SET revision = $2, updated_at = $3, meta_revision = $4,
      meta_updated_at = $3, manifest_meta = $5::jsonb
    WHERE owner_id = $1`,
  allProjects: `/* moont_all_projects */
    SELECT project_id, entry, version, updated_at, deleted_at, sort_order
    FROM moont.account_projects WHERE owner_id = $1 ORDER BY sort_order, project_id`,
  oneProject: `/* moont_one_project */
    SELECT project_id, entry, version, updated_at, deleted_at, sort_order
    FROM moont.account_projects WHERE owner_id = $1 AND project_id = $2`,
  page: `/* moont_page */
    SELECT project_id, entry - 'doc' AS entry, version, updated_at, sort_order,
      jsonb_array_length(CASE WHEN jsonb_typeof(entry->'doc'->'slides') = 'array'
        THEN entry->'doc'->'slides' ELSE '[]'::jsonb END) AS slide_count
    FROM moont.account_projects
    WHERE owner_id = $1 AND deleted_at IS NULL
      AND ($2::bigint IS NULL OR (updated_at, sort_order) < ($2::bigint, $3::bigint))
    ORDER BY updated_at DESC, sort_order DESC LIMIT $4`,
  upsertProjects: `/* moont_upsert_projects */
    INSERT INTO moont.account_projects
      (owner_id, project_id, entry, version, updated_at, deleted_at, sort_order)
    SELECT $1, item.project_id, item.entry, item.version,
      item.updated_at, item.deleted_at, item.sort_order
    FROM jsonb_to_recordset($2::jsonb) AS item(
      project_id text, entry jsonb, version bigint, updated_at bigint,
      deleted_at bigint, sort_order bigint
    )
    ON CONFLICT (owner_id, project_id) DO UPDATE
    SET entry = EXCLUDED.entry, version = EXCLUDED.version,
      updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at,
      sort_order = EXCLUDED.sort_order`,
  deleteAgentVisualJobs: `/* moont_delete_agent_visual_jobs */
    DELETE FROM moont.agent_visual_jobs WHERE owner_id = $1 AND project_id = $2`,
};

function fail(message, code, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

function ownerId(value) {
  const owner = String(value || '').trim();
  if (!owner || owner.length > 80 || !/^[a-zA-Z0-9_.-]+$/.test(owner)) {
    throw fail('Conta inválida para sincronização.', 'library_bad_owner');
  }
  return owner;
}

function projectId(value) {
  const id = String(value || '');
  if (!id.trim() || id.length > MAX_PROJECT_ID || id.includes('\0')) {
    throw fail('Identificador de projeto inválido.', 'project_bad_id');
  }
  return id;
}

function object(value) {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function entryUpdatedAt(entry) {
  return integer(entry?.updatedAt || entry?.createdAt, 0);
}

function cleanAssetIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : [])
    .map((value) => String(value || '').trim())
    .filter((value) => value.length <= 120 && /^[a-zA-Z0-9._-]+$/.test(value)))].slice(0, MAX_ASSETS);
}

function mergeById(cloud, local) {
  const merged = new Map();
  for (const entry of (Array.isArray(cloud) ? cloud : [])) {
    if (entry?.id) merged.set(String(entry.id), entry);
  }
  for (const entry of (Array.isArray(local) ? local : [])) {
    if (!entry?.id) continue;
    const id = String(entry.id);
    const previous = merged.get(id);
    if (!previous || entryUpdatedAt(entry) >= entryUpdatedAt(previous)) merged.set(id, entry);
  }
  return [...merged.values()];
}

function manifestHeader(manifest) {
  const {
    docs: _docs, deletedIds: _deletedIds, customerId: _customerId,
    revision: _revision, updatedAt: _updatedAt, ...header
  } = object(manifest);
  return header;
}

function rowsFromLegacy(manifest) {
  const deleted = new Set((Array.isArray(manifest.deletedIds) ? manifest.deletedIds : [])
    .map((id) => projectId(id)));
  const rows = new Map();
  for (const entry of manifest.docs) {
    if (!entry?.id) continue;
    const id = projectId(entry.id);
    if (deleted.has(id)) continue;
    const previous = rows.get(id);
    if (!previous || entryUpdatedAt(entry) >= previous.updated_at) {
      rows.set(id, {
        project_id: id, entry, version: 1,
        updated_at: entryUpdatedAt(entry) || integer(manifest.updatedAt),
        deleted_at: null, sort_order: previous?.sort_order ?? rows.size,
      });
    }
  }
  for (const id of deleted) {
    rows.set(id, {
      project_id: id, entry: null, version: 1,
      updated_at: integer(manifest.updatedAt),
      deleted_at: integer(manifest.updatedAt) || Date.now(), sort_order: rows.size,
    });
  }
  return [...rows.values()];
}

function toRow(row) {
  return {
    project_id: row.project_id,
    entry: row.entry == null ? null : object(row.entry),
    version: integer(row.version, 1),
    updated_at: integer(row.updated_at),
    deleted_at: row.deleted_at == null ? null : integer(row.deleted_at),
    sort_order: integer(row.sort_order),
    ...(row.slide_count == null ? {} : { slide_count: integer(row.slide_count) }),
  };
}

function toProject(row) {
  return {
    id: row.project_id,
    entry: row.entry == null ? null : object(row.entry),
    version: integer(row.version, 1),
    updatedAt: integer(row.updated_at),
    deleted: row.deleted_at != null,
    ...(row.slide_count == null ? {} : { slideCount: integer(row.slide_count) }),
  };
}

function composeManifest(owner, state, rows) {
  const live = rows.filter((row) => row.deleted_at == null);
  const deleted = rows.filter((row) => row.deleted_at != null);
  return {
    ...object(state.manifest_meta),
    vcVersion: 3,
    customerId: owner,
    revision: integer(state.revision),
    updatedAt: integer(state.updated_at),
    docs: live.map((row) => object(row.entry)),
    deletedIds: deleted.map((row) => row.project_id),
    folders: Array.isArray(object(state.manifest_meta).folders)
      ? object(state.manifest_meta).folders : [],
    brands: Array.isArray(object(state.manifest_meta).brands)
      ? object(state.manifest_meta).brands : [],
    assetIds: cleanAssetIds(object(state.manifest_meta).assetIds),
  };
}

function metaFor(owner, state) {
  return {
    customerId: owner,
    revision: integer(state.revision),
    updatedAt: integer(state.updated_at),
    projectCount: integer(state.project_count),
    assetIds: cleanAssetIds(object(state.manifest_meta).assetIds),
    storage: 'postgres',
  };
}

function accountMetadata(headerValue) {
  const header = object(headerValue);
  return {
    brands: Array.isArray(header.brands) ? header.brands : [],
    folders: Array.isArray(header.folders) ? header.folders : [],
    userProfile: header.userProfile && typeof header.userProfile === 'object'
      && !Array.isArray(header.userProfile) ? header.userProfile : null,
    onboardingDone: header.onboardingDone ?? null,
    modesIntroDone: header.modesIntroDone ?? null,
    activeBrandId: typeof header.activeBrandId === 'string' ? header.activeBrandId : '',
    activeDocId: typeof header.activeDocId === 'string' ? header.activeDocId : '',
    assetIds: cleanAssetIds(header.assetIds),
  };
}

function accountMetadataResponse(state) {
  return {
    metadata: accountMetadata(state.manifest_meta),
    revision: integer(state.meta_revision),
    updatedAt: integer(state.meta_updated_at),
  };
}

function validAccountMetadataPatch(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw fail('Dados globais da conta inválidos.', 'account_meta_bad_data');
  }
  let serialized;
  try { serialized = JSON.stringify(data); } catch {
    throw fail('Dados globais da conta inválidos.', 'account_meta_bad_data');
  }
  if (typeof serialized !== 'string') throw fail('Dados globais da conta inválidos.', 'account_meta_bad_data');
  if (Buffer.byteLength(serialized, 'utf8') > MAX_ACCOUNT_META_BYTES) {
    throw fail('Dados globais da conta demasiado grandes.', 'account_meta_too_large');
  }
  const patch = JSON.parse(serialized);
  for (const [key, value] of Object.entries(patch)) {
    if (!ACCOUNT_META_FIELDS.has(key)) throw fail('Campo global da conta inválido.', 'account_meta_bad_data');
    if ((key === 'brands' || key === 'folders')
      && (!Array.isArray(value) || !value.every((item) => item && typeof item === 'object' && !Array.isArray(item)))) {
      throw fail('Marcas ou pastas inválidas.', 'account_meta_bad_data');
    }
    if (key === 'userProfile' && value !== null
      && (!value || typeof value !== 'object' || Array.isArray(value))) {
      throw fail('Perfil inválido.', 'account_meta_bad_data');
    }
    if ((key === 'activeBrandId' || key === 'activeDocId')
      && (typeof value !== 'string' || value.length > 500)) {
      throw fail('Identificador ativo inválido.', 'account_meta_bad_data');
    }
    if ((key === 'onboardingDone' || key === 'modesIntroDone')
      && value !== null && typeof value !== 'string' && typeof value !== 'boolean') {
      throw fail('Preferência inválida.', 'account_meta_bad_data');
    }
    if (key === 'assetIds' && (!Array.isArray(value)
      || value.some((id) => typeof id !== 'string' || id.length > 120
        || !/^[A-Za-z0-9._-]+$/.test(id)))) {
      throw fail('Referências de imagens inválidas.', 'account_meta_bad_data');
    }
  }
  return patch;
}

async function run(sql, key, params = []) {
  // Todos os comandos são constantes e todos os valores são parâmetros $n.
  return sql.unsafe(SQL[key], params);
}

async function defaultSql() {
  return getPostgresConnection();
}

async function defaultLegacyReader(owner) {
  const module = await import('./library-sync-store.js');
  if (typeof module.readLegacyLibraryManifest !== 'function') {
    throw fail('Leitor de migração da biblioteca indisponível.', 'library_storage_unconfigured');
  }
  return module.readLegacyLibraryManifest(owner);
}

async function guardStorage(work) {
  try { return await work(); } catch (error) {
    if (typeof error?.code === 'string'
      && (error.code.startsWith('library_') || error.code.startsWith('project_')
        || error.code.startsWith('account_meta_'))) throw error;
    if (error?.code === '42P01' || error?.code === '3F000' || error?.code === '42703') {
      throw fail('Migração SQL da biblioteca não aplicada.', 'library_storage_unconfigured');
    }
    throw fail('Banco da biblioteca temporariamente indisponível.', 'library_storage_unavailable');
  }
}

function assertBaseVersion(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw fail('Informe a versão do projeto para guardar com segurança.', 'project_bad_version');
  }
  return value;
}

function assertEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw fail('Projeto inválido.', 'project_bad_entry');
  }
  projectId(entry.id);
  return entry;
}

function conflict(row, state) {
  return fail('Este projeto mudou em outro dispositivo. Atualize antes de salvar.', 'project_conflict', {
    cloudVersion: row ? integer(row.version) : 0,
    cloudRevision: integer(state.revision),
  });
}

function deletedConflict(row, state) {
  return fail('Este projeto foi excluído em outro dispositivo. Revise a edição local antes de criar outro projeto.', 'project_deleted', {
    cloudVersion: integer(row.version),
    cloudRevision: integer(state.revision),
  });
}

/** Factory injetável para testes; a instância de produção usa DATABASE_URL/POSTGRES_URL. */
export function createLibraryPostgresStore({ sql: injectedSql, readLegacyManifest = defaultLegacyReader, now = Date.now } = {}) {
  async function connection() { return injectedSql || defaultSql(); }

  async function ensureMigrated(sql, owner) {
    const existing = (await run(sql, 'state', [owner]))[0];
    if (existing) return existing;

    // A leitura é feita antes de criar a conta no banco. Se o Blob falhar, não
    // há linha vazia que pudesse esconder projetos existentes.
    const legacy = await readLegacyManifest(owner);
    if (legacy && !Array.isArray(legacy.docs)) {
      throw fail('Manifesto anterior da biblioteca inválido.', 'library_storage_unavailable');
    }
    const importedRows = legacy ? rowsFromLegacy(legacy) : [];
    const revision = legacy ? Math.max(1, integer(legacy.revision, 1)) : 0;
    const updatedAt = legacy ? integer(legacy.updatedAt) || now() : 0;
    const header = legacy ? manifestHeader(legacy) : { vcVersion: 3 };
    const count = importedRows.filter((row) => row.deleted_at == null).length;

    return sql.begin(async (tx) => {
      const inserted = await run(tx, 'insertState', [
        owner, revision, updatedAt, count, importedRows.length,
        JSON.stringify(header), !!legacy,
      ]);
      if (inserted.length && importedRows.length) {
        await run(tx, 'upsertProjects', [owner, JSON.stringify(importedRows)]);
      }
      return (await run(tx, 'state', [owner]))[0];
    });
  }

  async function getLibrarySyncMeta(ownerValue) {
    const owner = ownerId(ownerValue);
    return guardStorage(async () => {
      const sql = await connection();
      const state = await ensureMigrated(sql, owner);
      return integer(state.revision) ? metaFor(owner, state) : null;
    });
  }

  async function getLibraryManifest(ownerValue) {
    const owner = ownerId(ownerValue);
    return guardStorage(async () => {
      const sql = await connection();
      await ensureMigrated(sql, owner);
      // Header e projetos precisam vir do mesmo snapshot; uma escrita pode
      // chegar entre as duas consultas quando há vários dispositivos.
      return sql.begin('isolation level repeatable read read only', async (tx) => {
        const state = (await run(tx, 'state', [owner]))[0];
        if (!integer(state.revision)) return null;
        const rows = (await run(tx, 'allProjects', [owner])).map(toRow);
        return composeManifest(owner, state, rows);
      });
    });
  }

  async function putLibraryManifest(ownerValue, manifest, opts = {}) {
    const owner = ownerId(ownerValue);
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw fail('Manifesto inválido.', 'library_bad_manifest');
    }
    return guardStorage(async () => {
      const sql = await connection();
      await ensureMigrated(sql, owner);
      return sql.begin(async (tx) => {
        const state = (await run(tx, 'lockedState', [owner]))[0];
        const baseRevision = Number(opts.baseRevision);
        if (integer(state.revision) && !opts.force && Number.isFinite(baseRevision)
          && baseRevision !== integer(state.revision)) {
          throw fail('A biblioteca mudou em outro dispositivo. Sincronize novamente.', 'library_conflict', {
            cloudRevision: integer(state.revision), cloudUpdatedAt: integer(state.updated_at),
          });
        }
        const existingRows = (await run(tx, 'allProjects', [owner])).map(toRow);
        const rows = new Map(existingRows.map((row) => [row.project_id, row]));
        const changed = new Map();
        let nextOrder = integer(state.next_order);
        const timestamp = now();
        const incoming = Array.isArray(manifest.docs) ? manifest.docs : [];
        const incomingIds = new Set();
        const deletedIds = new Set((Array.isArray(manifest.deletedIds) ? manifest.deletedIds : [])
          .map((id) => projectId(id)));
        for (const entry of incoming) {
          if (entry?.id) incomingIds.add(projectId(entry.id));
        }
        if (opts.replace) {
          for (const row of existingRows) {
            if (row.deleted_at == null && !incomingIds.has(row.project_id)) deletedIds.add(row.project_id);
          }
        }
        for (const id of deletedIds) {
          const previous = rows.get(id);
          if (previous?.deleted_at != null) continue;
          const row = {
            project_id: id, entry: null, version: previous ? previous.version + 1 : 1,
            updated_at: timestamp, deleted_at: timestamp,
            sort_order: previous ? previous.sort_order : nextOrder++,
          };
          rows.set(id, row);
          changed.set(id, row);
        }
        for (const entry of incoming) {
          if (!entry?.id) continue;
          const id = projectId(entry.id);
          const previous = rows.get(id);
          if (previous?.deleted_at != null) continue; // tombstone definitivo
          if (previous && !opts.replace && entryUpdatedAt(entry) < entryUpdatedAt(previous.entry)) continue;
          if (previous && JSON.stringify(previous.entry) === JSON.stringify(entry)) continue;
          const row = {
            project_id: id, entry, version: previous ? previous.version + 1 : 1,
            updated_at: entryUpdatedAt(entry) || timestamp, deleted_at: null,
            sort_order: previous ? previous.sort_order : nextOrder++,
          };
          rows.set(id, row);
          changed.set(id, row);
        }
        const priorHeader = object(state.manifest_meta);
        const submittedHeader = manifestHeader(manifest);
        // O cliente legado ainda pode ter um push em trânsito durante o
        // cutover. Seus projetos podem entrar pelo merge acima, mas perfil,
        // marcas e pastas só mudam pela rota versionada de metadados v2.
        const header = opts.preserveAccountMetadata
          ? { ...priorHeader, vcVersion: 3 }
          : { ...priorHeader, ...submittedHeader, vcVersion: 3 };
        if (!opts.preserveAccountMetadata) {
          header.folders = opts.replace && Object.hasOwn(manifest, 'folders')
            ? (Array.isArray(manifest.folders) ? manifest.folders : [])
            : mergeById(priorHeader.folders, manifest.folders);
          header.brands = opts.replace && Object.hasOwn(manifest, 'brands')
            ? (Array.isArray(manifest.brands) ? manifest.brands : [])
            : mergeById(priorHeader.brands, manifest.brands);
        }
        header.assetIds = cleanAssetIds(opts.replace && Object.hasOwn(manifest, 'assetIds')
          && !opts.preserveAccountMetadata ? manifest.assetIds
          : [...(Array.isArray(priorHeader.assetIds) ? priorHeader.assetIds : []),
            ...(Array.isArray(manifest.assetIds) ? manifest.assetIds : [])]);
        const ordered = [...rows.values()].sort((a, b) => a.sort_order - b.sort_order);
        const projectCount = ordered.filter((row) => row.deleted_at == null).length;
        const revision = integer(state.revision) + 1;
        if (changed.size) await run(tx, 'upsertProjects', [owner, JSON.stringify([...changed.values()])]);
        await run(tx, 'updateState', [
          owner, revision, timestamp, projectCount, nextOrder, JSON.stringify(header),
        ]);
        const nextState = {
          ...state, revision, updated_at: timestamp, project_count: projectCount,
          next_order: nextOrder, manifest_meta: header,
        };
        return {
          manifest: composeManifest(owner, nextState, ordered),
          meta: metaFor(owner, nextState),
        };
      });
    });
  }

  async function listAccountProjects(ownerValue, { cursor, limit = 30 } = {}) {
    const owner = ownerId(ownerValue);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw fail('Tamanho de página inválido.', 'project_bad_limit');
    }
    let position = null;
    if (cursor != null && cursor !== '') {
      try {
        if (typeof cursor !== 'string' || cursor.length > 512) throw new Error('cursor');
        const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (!Array.isArray(decoded) || decoded.length !== 2
          || !decoded.every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error('cursor');
        position = decoded;
      } catch { throw fail('Cursor de projetos inválido.', 'project_bad_cursor'); }
    }
    return guardStorage(async () => {
      const sql = await connection();
      await ensureMigrated(sql, owner);
      return sql.begin('isolation level repeatable read read only', async (tx) => {
        const state = (await run(tx, 'state', [owner]))[0];
        const rows = await run(tx, 'page', [owner, position?.[0] ?? null, position?.[1] ?? null, limit + 1]);
        const visible = rows.slice(0, limit).map(toRow);
        const last = visible.at(-1);
        return {
          projects: visible.map(toProject),
          nextCursor: rows.length > limit && last
            ? Buffer.from(JSON.stringify([last.updated_at, last.sort_order])).toString('base64url') : null,
          total: integer(state.project_count),
        };
      });
    });
  }

  async function getAccountProject(ownerValue, idValue) {
    const owner = ownerId(ownerValue);
    const id = projectId(idValue);
    return guardStorage(async () => {
      const sql = await connection();
      await ensureMigrated(sql, owner);
      const row = (await run(sql, 'oneProject', [owner, id]))[0];
      return row && row.deleted_at == null ? toProject(toRow(row)) : null;
    });
  }

  async function putAccountProject(ownerValue, entryValue, { baseVersion } = {}) {
    const owner = ownerId(ownerValue);
    const entry = assertEntry(entryValue);
    const id = projectId(entry.id);
    const base = assertBaseVersion(baseVersion);
    return guardStorage(async () => {
      const sql = await connection();
      await ensureMigrated(sql, owner);
      return sql.begin(async (tx) => {
        const state = (await run(tx, 'lockedState', [owner]))[0];
        const previousRaw = (await run(tx, 'oneProject', [owner, id]))[0];
        const previous = previousRaw ? toRow(previousRaw) : null;
        if (previous?.deleted_at != null) throw deletedConflict(previous, state);
        if ((previous?.version || 0) !== base) throw conflict(previous, state);
        const timestamp = now();
        const stored = { ...entry, updatedAt: timestamp };
        const nextOrder = previous ? integer(state.next_order) : integer(state.next_order) + 1;
        const row = {
          project_id: id, entry: stored, version: base + 1,
          updated_at: timestamp, deleted_at: null,
          sort_order: previous ? previous.sort_order : integer(state.next_order),
        };
        await run(tx, 'upsertProjects', [owner, JSON.stringify([row])]);
        await run(tx, 'updateState', [
          owner, integer(state.revision) + 1, timestamp,
          integer(state.project_count) + (previous ? 0 : 1), nextOrder,
          JSON.stringify(object(state.manifest_meta)),
        ]);
        return toProject(row);
      });
    });
  }

  async function deleteAccountProject(ownerValue, idValue, { baseVersion } = {}) {
    const owner = ownerId(ownerValue);
    const id = projectId(idValue);
    const base = assertBaseVersion(baseVersion);
    return guardStorage(async () => {
      const sql = await connection();
      await ensureMigrated(sql, owner);
      return sql.begin(async (tx) => {
        const state = (await run(tx, 'lockedState', [owner]))[0];
        const previousRaw = (await run(tx, 'oneProject', [owner, id]))[0];
        const previous = previousRaw ? toRow(previousRaw) : null;
        if ((previous?.version || 0) !== base) throw conflict(previous, state);
        if (previous?.deleted_at != null) return toProject(previous);
        const timestamp = now();
        const nextOrder = previous ? integer(state.next_order) : integer(state.next_order) + 1;
        const row = {
          project_id: id, entry: null, version: base + 1,
          updated_at: timestamp, deleted_at: timestamp,
          sort_order: previous ? previous.sort_order : integer(state.next_order),
        };
        await run(tx, 'upsertProjects', [owner, JSON.stringify([row])]);
        await run(tx, 'deleteAgentVisualJobs', [owner, id]);
        await run(tx, 'updateState', [
          owner, integer(state.revision) + 1, timestamp,
          integer(state.project_count) - (previous ? 1 : 0), nextOrder,
          JSON.stringify(object(state.manifest_meta)),
        ]);
        return toProject(row);
      });
    });
  }

  async function getAccountLibraryMeta(ownerValue) {
    const owner = ownerId(ownerValue);
    return guardStorage(async () => {
      const sql = await connection();
      const state = await ensureMigrated(sql, owner);
      return accountMetadataResponse(state);
    });
  }

  async function putAccountLibraryMeta(ownerValue, patchValue, { baseRevision } = {}) {
    const owner = ownerId(ownerValue);
    if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) {
      throw fail('Revisão dos dados da conta inválida.', 'account_meta_bad_revision');
    }
    const patch = validAccountMetadataPatch(patchValue);
    return guardStorage(async () => {
      const sql = await connection();
      await ensureMigrated(sql, owner);
      return sql.begin(async (tx) => {
        const state = (await run(tx, 'lockedState', [owner]))[0];
        const revision = integer(state.meta_revision);
        if (revision !== baseRevision) {
          throw fail('Os dados globais da conta mudaram em outro dispositivo.', 'account_meta_conflict', {
            cloudRevision: revision,
          });
        }
        if (!Object.keys(patch).length) return accountMetadataResponse(state);
        const header = { ...object(state.manifest_meta), ...patch, vcVersion: 3 };
        // Projetos podem acrescentar imagens entre duas edições de perfil.
        // Referências antigas não são removidas por um patch de metadados.
        if (Object.hasOwn(patch, 'assetIds')) {
          header.assetIds = cleanAssetIds([
            ...(Array.isArray(object(state.manifest_meta).assetIds)
              ? object(state.manifest_meta).assetIds : []), ...patch.assetIds,
          ]);
        }
        const timestamp = now();
        await run(tx, 'updateMetadataState', [
          owner, integer(state.revision) + 1, timestamp, revision + 1, JSON.stringify(header),
        ]);
        return accountMetadataResponse({
          ...state, revision: integer(state.revision) + 1,
          updated_at: timestamp, meta_revision: revision + 1,
          meta_updated_at: timestamp, manifest_meta: header,
        });
      });
    });
  }

  return {
    getLibrarySyncMeta, getLibraryManifest, putLibraryManifest,
    listAccountProjects, getAccountProject, putAccountProject, deleteAccountProject,
    getAccountLibraryMeta, putAccountLibraryMeta,
  };
}

const productionStore = createLibraryPostgresStore();
export const getLibrarySyncMeta = (...args) => productionStore.getLibrarySyncMeta(...args);
export const getLibraryManifest = (...args) => productionStore.getLibraryManifest(...args);
export const putLibraryManifest = (...args) => productionStore.putLibraryManifest(...args);
export const listAccountProjects = (...args) => productionStore.listAccountProjects(...args);
export const getAccountProject = (...args) => productionStore.getAccountProject(...args);
export const putAccountProject = (...args) => productionStore.putAccountProject(...args);
export const deleteAccountProject = (...args) => productionStore.deleteAccountProject(...args);
export const getAccountLibraryMeta = (...args) => productionStore.getAccountLibraryMeta(...args);
export const putAccountLibraryMeta = (...args) => productionStore.putAccountLibraryMeta(...args);
