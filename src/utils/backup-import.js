/**
 * Leitura do arquivo de backup antes de importar (auditoria 23/11, GB-09).
 * Um arquivo de terceiros entrava como veio: `name` que não é texto derrubava
 * a busca de projetos, e slides com o mesmo `id` passavam a ser editados em
 * conjunto. Aqui o que dá para consertar é consertado. O que não é projeto
 * fica de fora e é contado, para a tela dizer; nada some em silêncio.
 */
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

function backupEntryName(value) {
  if (typeof value === 'string') return value.trim() ? value : 'Importado';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return 'Importado';
}

/** Mantém o primeiro uso de cada id; repetido, vazio ou que não é texto ganha id novo. */
function withUniqueSlideIds(slides, idFactory) {
  const seen = new Set();
  return slides.map((slide) => {
    if (!isRecord(slide)) return slide;
    let id = typeof slide.id === 'string' ? slide.id : '';
    while (!id || seen.has(id)) id = String(idFactory());
    seen.add(id);
    return id === slide.id ? slide : { ...slide, id };
  });
}

/**
 * @returns {{ entries: object[], skipped: number }} projetos legíveis, na
 *   ordem do arquivo, e quantos itens não eram projeto.
 */
export function readBackupEntries(parsed, idFactory = () => Math.random().toString(36).slice(2, 9)) {
  const list = Array.isArray(parsed) ? parsed : isRecord(parsed) ? parsed.docs : null;
  if (!Array.isArray(list) || !list.length) return { entries: [], skipped: 0 };
  const entries = [];
  let skipped = 0;
  for (const raw of list) {
    if (!isRecord(raw) || !isRecord(raw.doc)) { skipped += 1; continue; }
    entries.push({
      ...raw,
      name: backupEntryName(raw.name),
      doc: Array.isArray(raw.doc.slides)
        ? { ...raw.doc, slides: withUniqueSlideIds(raw.doc.slides, idFactory) }
        : raw.doc,
    });
  }
  return { entries, skipped };
}
