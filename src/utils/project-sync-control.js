/** Decide o autoenvio por conteúdo, não por renders nem pelo estado do botão. */
export function decideCloudAutoPush({ key, lastKey, dirty, inFlight }) {
  if (key === lastKey || !dirty) return { lastKey: key, schedule: false, defer: false };
  return { lastKey: key, schedule: !inFlight, defer: inFlight };
}

/**
 * Navegar entre projetos é estado local da interface, não uma edição da conta.
 * O projeto ativo ainda pode viajar num salvamento real, mas nunca dispara o
 * aviso "pendente" sozinho.
 */
export function accountMetadataContentKey({ activeDocId: _activeDocId, ...content } = {}) {
  return JSON.stringify(content);
}

/** Abrir uma biblioteca não troca silenciosamente o projeto que a pessoa escolheu. */
export function selectRestoredProjectId({ library = [], preferredId, metadataActiveId, manifestActiveId } = {}) {
  const live = Array.isArray(library) ? library.filter((entry) => entry?.id) : [];
  for (const id of [preferredId, metadataActiveId, manifestActiveId]) {
    if (id && live.some((entry) => entry.id === id)) return id;
  }
  return live.find((entry) => !entry.conflictSourceId)?.id || live[0]?.id || '';
}

/** Um snapshot confirmado pode ter uma edição sucessora ainda por enviar. */
export function cloudSaveContinuation({ source, current, sameOwner }) {
  if (!sameOwner) return 'owner_changed';
  if (current) return 'confirmed';
  return source === 'sync' || source === 'logout' ? 'changed_before_restore' : 'send_latest';
}

/**
 * FE-18: como abrir um projeto pela biblioteca. Projeto com alteração local
 * ainda não enviada abre a versão local; pedir "salve antes" era impossível,
 * porque o Salvar já aponta para o projeto que está no editor. Só o projeto
 * igual ao confirmado (ou ainda sem confirmação) confere a versão da conta.
 */
export function decideProjectOpen({ isActive, baseline, entryFingerprint, editorFingerprint }) {
  if (!baseline) return 'fetch';
  if (isActive && (baseline !== entryFingerprint || baseline !== editorFingerprint)) return 'keep_editor';
  return baseline !== entryFingerprint ? 'open_local' : 'fetch';
}

/**
 * FE-18: no Sync e no salvamento automático cada projeto é enviado por conta
 * própria. O que falha (imagem que não sobe, tamanho) não impede os seguintes.
 */
export async function persistProjectsIndependently(entries, persist, { failFast = false } = {}) {
  const results = [];
  const failures = [];
  for (const entry of entries) {
    try {
      // eslint-disable-next-line no-await-in-loop
      results.push({ entry, result: await persist(entry) });
    } catch (error) {
      if (failFast) throw error;
      failures.push({ entry, error });
    }
  }
  return { results, failures };
}

/** Junta as falhas de envio num aviso só e diz de qual projeto é a primeira. */
export function combinedProjectSyncError(failures, { activeId } = {}) {
  if (!failures?.length) return null;
  const [first] = failures;
  if (failures.length === 1 && first.entry?.id === activeId) return first.error;
  const detail = `Projeto “${first.entry?.name || 'Sem título'}”: ${first.error?.message || 'não foi possível enviar.'}`;
  return Object.assign(new Error(failures.length > 1
    ? `${failures.length} projetos não foram enviados à conta. ${detail}` : detail), {
    code: first.error?.code, cause: first.error,
  });
}

/**
 * DB-05: ao ocultar ou fechar a aba, o que ainda não foi enviado entra na
 * fila durável com a versão que esta aba observou. O boot seguinte envia a
 * fila antes de baixar a lista, então a edição não é trocada pela da nuvem.
 * As fotos seguem para a fila junto; o envio à rede continua sendo do Sync.
 */
export async function queueUnsentProjectEdits({ library, baselines, versions, fingerprint, prepare, queue }) {
  let queued = 0;
  let failed = 0;
  for (const entry of Array.isArray(library) ? library : []) {
    if (!entry?.id || baselines.get(entry.id) === fingerprint(entry)) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      const prepared = await prepare(entry);
      // eslint-disable-next-line no-await-in-loop
      await queue(prepared.entry, { baseVersion: versions.get(entry.id) ?? 0, assets: prepared.assets });
      queued += 1;
    } catch { failed += 1; } // o cache local e o próximo envio continuam valendo
  }
  return { queued, failed };
}

const OUTBOX_UNAVAILABLE_CODES = new Set([
  'project_outbox_unavailable', 'project_outbox_timeout', 'project_outbox_failed',
]);
const OUTBOX_UNAVAILABLE_NAMES = new Set([
  'QuotaExceededError', 'UnknownError', 'InvalidStateError', 'NotFoundError', 'SecurityError',
]);

export function isProjectOutboxUnavailable(error) {
  return OUTBOX_UNAVAILABLE_CODES.has(error?.code) || OUTBOX_UNAVAILABLE_NAMES.has(error?.name);
}

/**
 * Sem IndexedDB, confirma um PUT versionado na API. Uma resposta perdida só é
 * tratada como sucesso se a versão e o conteúdo remoto coincidirem.
 */
export async function putProjectDirectly(entry, {
  baseVersion, expectedOwnerId, putProject, getProject, isProjectConflict, fingerprint,
}) {
  try {
    return await putProject(entry, { baseVersion, expectedOwnerId });
  } catch (error) {
    if (!isProjectConflict(error)) throw error;
    const remote = await getProject(entry.id, { expectedOwnerId });
    if (remote?.version === baseVersion + 1
      && fingerprint(remote.entry) === fingerprint(entry)) return remote;
    throw error;
  }
}
