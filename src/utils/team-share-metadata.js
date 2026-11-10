/**
 * Uma cópia é um projeto novo. Metadados de colaboração identificam a
 * revisão remota do projeto de origem e nunca podem atravessar uma duplicação,
 * inclusive quando a cópia é criada automaticamente para resolver conflito.
 */
export function detachTeamShareMetadata(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const copy = JSON.parse(JSON.stringify(doc));
  delete copy.shareCode;
  delete copy.shareProjectId;
  delete copy.shareRevision;
  delete copy.shareUpdatedAt;
  delete copy.shareMeta;
  return copy;
}

function looksLikeLegacyCopy(entry) {
  const id = String(entry?.id || '');
  // O nome é conteúdo do usuário e não prova que houve duplicação. Projetos
  // legítimos podem se chamar "Campanha (cópia)" e ainda pertencer à equipe.
  // Só sinais estruturais gravados pelo fluxo de conflito autorizam remover o
  // vínculo remoto durante a migração.
  return !!entry?.conflictSourceId
    || /^conflict-/i.test(id);
}

/** Neutraliza cópias antigas criadas antes da remoção dos metadados. */
export function detachLegacyTeamShareCopies(entries) {
  if (!Array.isArray(entries)) return entries;
  let changed = false;
  const next = entries.map((entry) => {
    if (!entry?.doc?.shareCode || entry.doc.shareProjectId || !looksLikeLegacyCopy(entry)) return entry;
    changed = true;
    return { ...entry, doc: detachTeamShareMetadata(entry.doc) };
  });
  return changed ? next : entries;
}
