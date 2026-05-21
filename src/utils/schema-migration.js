/** Versionamento de schema pra documents persistidos no localStorage.
 *
 *  Como adicionar uma nova migration:
 *  1. Incrementar SCHEMA_VERSION.
 *  2. Registrar handler em SCHEMA_MIGRATIONS[N] = (doc) => { ...transformar...; return doc; }
 *  3. NUNCA editar migrations passadas — elas rodaram em produção e mudá-las
 *     quebraria contas que pularam versões intermediárias. */

export const SCHEMA_VERSION = 1;

export const SCHEMA_MIGRATIONS = {
  // 1: stamp inicial — apenas marca docs antigos com __v=1 sem transformar nada.
  //    Próximas migrations rodariam sequencialmente: 1→2, 2→3, etc.
  1: (doc) => doc,
};

/** Aplica migrations sequenciais do __v atual do doc até SCHEMA_VERSION.
 *  Errors em uma migration não interrompem — loga e continua, deixando o doc
 *  parcialmente migrado. (Mais permissivo que falhar e perder o documento.) */
export function migrateDoc(rawDoc) {
  if (!rawDoc || typeof rawDoc !== 'object') return rawDoc;
  const fromVersion = Number.isInteger(rawDoc.__v) ? rawDoc.__v : 0;
  if (fromVersion >= SCHEMA_VERSION) return rawDoc;
  let current = rawDoc;
  for (let v = fromVersion + 1; v <= SCHEMA_VERSION; v++) {
    const fn = SCHEMA_MIGRATIONS[v];
    if (!fn) continue;
    try {
      current = fn(current);
    } catch (e) {
      console.warn(
        `[schema] migration v${v} falhou — mantendo doc parcialmente migrado:`,
        e.message,
      );
    }
  }
  current.__v = SCHEMA_VERSION;
  return current;
}
