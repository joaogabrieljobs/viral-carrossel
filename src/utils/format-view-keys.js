/**
 * Tira ajustes guardados por proporção (`formatViews`). Fora do Feed, e sempre
 * em apresentação, cor, fonte e layout mexidos ficam na vista do formato e
 * vencem o valor do projeto: quando um padrão ou modelo passa a valer para o
 * projeto inteiro, as chaves que ele define precisam sair de todas as vistas.
 *
 * Sem dependências: também é carregado pelo servidor (published-template.js).
 * Devolve o mesmo objeto quando não havia nada a tirar.
 */
export function dropKeysFromFormatViews(formatViews, { brandKeys = [], slideKeys = [] } = {}) {
  if (!formatViews || typeof formatViews !== 'object') return formatViews;
  let changed = false;
  const strip = (source, keys) => {
    if (!source || typeof source !== 'object' || !keys.some((key) => Object.hasOwn(source, key))) return source;
    const kept = { ...source };
    for (const key of keys) delete kept[key];
    changed = true;
    return kept;
  };
  const next = {};
  for (const [fmt, bucket] of Object.entries(formatViews)) {
    if (!bucket || typeof bucket !== 'object') { next[fmt] = bucket; continue; }
    const out = { ...bucket };
    if (bucket.brand) out.brand = strip(bucket.brand, brandKeys);
    if (bucket.slides && typeof bucket.slides === 'object') {
      out.slides = Object.fromEntries(Object.entries(bucket.slides).map(([id, entry]) => [id, strip(entry, slideKeys)]));
    }
    next[fmt] = out;
  }
  return changed ? next : formatViews;
}
