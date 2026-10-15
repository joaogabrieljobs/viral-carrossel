/** Cliente da API de projetos individuais. A sessão é determinada pelo cookie. */
const PROJECTS_API = '/api/projects';
const PROJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;

export class ProjectApiError extends Error {
  constructor(message, { status = 0, code = 'project_request_failed', cloudVersion } = {}) {
    super(message);
    this.name = 'ProjectApiError';
    this.status = status;
    this.code = code;
    if (cloudVersion !== undefined) this.cloudVersion = cloudVersion;
  }
}

function assertProjectId(id) {
  if (typeof id !== 'string' || !PROJECT_ID.test(id)) {
    throw new ProjectApiError('ID de projeto inválido.', { code: 'project_bad_id' });
  }
}

function assertVersion(version) {
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new ProjectApiError('Versão do projeto inválida.', { code: 'project_bad_version' });
  }
}

function projectFromResponse(data, expectedId) {
  const project = data?.project;
  if (!project || project.id !== expectedId
    || !Number.isSafeInteger(project.version) || project.version < 0) {
    throw new ProjectApiError('A nuvem não confirmou a versão deste projeto.', {
      code: 'project_bad_response',
    });
  }
  return project;
}

async function projectRequest(method, query = {}, body, { signal, expectedOwnerId } = {}) {
  const params = new URLSearchParams(query);
  const queryString = params.toString();
  const url = queryString ? `${PROJECTS_API}?${queryString}` : PROJECTS_API;
  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'include',
      cache: 'no-store',
      signal,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(expectedOwnerId ? { 'X-Project-Owner': expectedOwnerId } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new ProjectApiError('Não foi possível conectar aos seus projetos. Tente novamente.', {
      code: 'project_network_error',
    });
  }
  let data;
  try { data = await response.json(); }
  catch { data = null; }
  if (!response.ok || data?.ok !== true) {
    throw new ProjectApiError(data?.error || 'Não foi possível acessar seus projetos.', {
      status: response.status,
      code: data?.code || 'project_request_failed',
      cloudVersion: data?.cloudVersion,
    });
  }
  return data;
}

export async function listProjectsPage({ cursor, limit = 50, signal, expectedOwnerId } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ProjectApiError('Limite de página inválido.', { code: 'project_bad_limit' });
  }
  const query = { limit: String(limit) };
  if (cursor != null) query.cursor = String(cursor);
  const data = await projectRequest('GET', query, undefined, { signal, expectedOwnerId });
  if (!Array.isArray(data.projects)) {
    throw new ProjectApiError('Resposta inválida da biblioteca.', { code: 'project_bad_response' });
  }
  return { projects: data.projects, nextCursor: data.nextCursor || null, total: data.total };
}

/** Busca todas as páginas, sem confundir uma página parcial com a biblioteca completa. */
export async function listProjects({ limit = 50, signal, expectedOwnerId } = {}) {
  const projects = [];
  const seenCursors = new Set();
  let cursor;
  do {
    const page = await listProjectsPage({ cursor, limit, signal, expectedOwnerId });
    projects.push(...page.projects);
    cursor = page.nextCursor;
    if (cursor && seenCursors.has(cursor)) {
      throw new ProjectApiError('A paginação da biblioteca não avançou.', { code: 'project_bad_cursor' });
    }
    if (cursor) seenCursors.add(cursor);
  } while (cursor);
  return projects;
}

/** Retorna null apenas quando o projeto não existe; os demais erros são propagados. */
export async function getProject(id, { signal, expectedOwnerId } = {}) {
  assertProjectId(id);
  try {
    const data = await projectRequest('GET', { id }, undefined, { signal, expectedOwnerId });
    return projectFromResponse(data, id);
  } catch (error) {
    if (error?.status === 404 && error?.code === 'project_not_found') return null;
    throw error;
  }
}

export async function putProject(entry, { baseVersion, signal, expectedOwnerId, opId } = {}) {
  assertProjectId(entry?.id);
  assertVersion(baseVersion);
  const data = await projectRequest('PUT', {}, {
    entry, baseVersion,
    ...(opId ? { opId } : {}),
  }, { signal, expectedOwnerId });
  return projectFromResponse(data, entry.id);
}

export async function deleteProject(id, { baseVersion, signal, expectedOwnerId, opId } = {}) {
  assertProjectId(id);
  assertVersion(baseVersion);
  const data = await projectRequest('DELETE', {}, {
    id, baseVersion,
    ...(opId ? { opId } : {}),
  }, { signal, expectedOwnerId });
  return projectFromResponse(data, id);
}

export function isProjectConflict(error) {
  return error?.status === 409 && error?.code === 'project_conflict';
}

export function isProjectDeletedConflict(error) {
  return error?.status === 409 && error?.code === 'project_deleted';
}
