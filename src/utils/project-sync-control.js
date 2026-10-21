/** Decide o autoenvio por conteúdo, não por renders nem pelo estado do botão. */
export function decideCloudAutoPush({ key, lastKey, dirty, inFlight }) {
  if (key === lastKey || !dirty) return { lastKey: key, schedule: false, defer: false };
  return { lastKey: key, schedule: !inFlight, defer: inFlight };
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
