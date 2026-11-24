/**
 * DB-05: marcador dos projetos com edição ainda não enviada à conta.
 *
 * Ao ocultar ou fechar a aba só dá para contar com escrita síncrona. O cache
 * local (localStorage) recebe a edição, mas o boot da conta troca a lista pela
 * da nuvem. O marcador, gravado no mesmo instante, diz ao boot seguinte quais
 * projetos do cache ainda não foram enviados e em que versão da conta se
 * baseavam. O boot os põe na fila durável com essa versão antes de baixar a
 * lista; o conflito continua sendo decidido pela versão no servidor.
 */
const KEY = 'vc_unsent_projects';

function defaultStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

/** Resumo curto e síncrono do conteúdo; o conteúdo inteiro já está no cache. */
function shortHash(text) {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b + code, 0x85ebca6b) ^ (b >>> 13);
  }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}${text.length.toString(36)}`;
}

/** `null` quando não há nada pendente (a chave deve ser removida). */
export function buildUnsentProjectMarker({ owner, library, baselines, versions, fingerprint }) {
  if (!owner) return null;
  const projects = {};
  for (const entry of Array.isArray(library) ? library : []) {
    if (!entry?.id) continue;
    const content = fingerprint(entry);
    if (baselines.get(entry.id) === content) continue;
    const version = versions.get(entry.id);
    projects[entry.id] = {
      baseVersion: Number.isSafeInteger(version) && version >= 0 ? version : 0,
      hash: shortHash(content),
    };
  }
  return Object.keys(projects).length ? { v: 1, owner, projects } : null;
}

export function writeUnsentProjectMarker(marker, storage = defaultStorage()) {
  try {
    if (marker) storage.setItem(KEY, JSON.stringify(marker));
    else storage.removeItem(KEY);
    return true;
  } catch { return false; }
}

/** Marcador de outra conta ou ilegível é descartado: nunca vale para a atual. */
export function readUnsentProjectMarker(owner, storage = defaultStorage()) {
  let marker = null;
  try { marker = JSON.parse(storage.getItem(KEY) || 'null'); } catch { marker = null; }
  const valid = marker && marker.v === 1 && marker.owner === owner && owner
    && marker.projects && typeof marker.projects === 'object' && !Array.isArray(marker.projects);
  if (!valid) {
    if (marker !== null) writeUnsentProjectMarker(null, storage);
    return null;
  }
  return marker;
}

/**
 * Boot: cada projeto marcado que está no cache local, com o mesmo conteúdo do
 * momento em que foi marcado, entra na fila durável com a versão observada.
 * Não passa por cima de exclusão ou revisão que já esteja na fila. O marcador
 * só perde o que foi enfileirado ou não vale mais; falha da fila o conserva.
 */
export async function requeueUnsentCachedProjects({
  owner, library, fingerprint, getPendingOp, prepare, queue, storage = defaultStorage(),
}) {
  const result = { queued: 0, skipped: 0, failed: 0 };
  const marker = readUnsentProjectMarker(owner, storage);
  if (!marker) return result;
  const cache = new Map((Array.isArray(library) ? library : []).map((entry) => [entry?.id, entry]));
  const remaining = {};
  for (const [id, mark] of Object.entries(marker.projects)) {
    const entry = cache.get(id);
    if (!entry || !Number.isSafeInteger(mark?.baseVersion) || mark.baseVersion < 0
      || shortHash(fingerprint(entry)) !== mark.hash) {
      result.skipped += 1;
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      const existing = await getPendingOp(id);
      if (existing && existing.kind !== 'put') {
        result.skipped += 1;
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const prepared = await prepare(entry);
      // eslint-disable-next-line no-await-in-loop
      await queue(prepared.entry, { baseVersion: mark.baseVersion, assets: prepared.assets });
      result.queued += 1;
    } catch {
      remaining[id] = mark;
      result.failed += 1;
    }
  }
  writeUnsentProjectMarker(Object.keys(remaining).length ? { ...marker, projects: remaining } : null, storage);
  return result;
}
