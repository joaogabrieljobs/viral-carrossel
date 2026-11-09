/**
 * Uma cópia é um projeto novo. Metadados de colaboração identificam a
 * revisão remota do projeto de origem e nunca podem atravessar uma duplicação,
 * inclusive quando a cópia é criada automaticamente para resolver conflito.
 */
export function detachTeamShareMetadata(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const copy = JSON.parse(JSON.stringify(doc));
  delete copy.shareCode;
  delete copy.shareRevision;
  delete copy.shareUpdatedAt;
  delete copy.shareMeta;
  return copy;
}
