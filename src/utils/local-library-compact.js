/**
 * QA-2411 (conta 3): forma compacta da cópia local dos projetos.
 *
 * Cada slide de apresentação carrega o mapa de tipografia de todas as funções
 * (capa, conteúdo, dados, fechamento...), quase igual de um slide para outro.
 * Na memória e na conta o documento continua inteiro; só o que vai para o
 * armazenamento do navegador guarda cada bloco uma vez por projeto e, no
 * slide, a posição do bloco. Abrir desfaz a troca e devolve o documento byte a
 * byte. Nada é recalculado: um ajuste feito à mão volta como estava.
 *
 * Cada projeto leva a própria tabela dentro do documento, então o cofre da
 * conta, a fila e a recuperação podem mover projetos um a um.
 */
const FIELD = 'presentationTypographyByComposition';
const TABLE = 'localTypographyTable';
const REF = '$localTypography';

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const isRef = (value) => isPlainObject(value) && Array.isArray(value[REF]);
const cloneBlock = (value) => (value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value);

function expandDoc(doc) {
  if (!isPlainObject(doc)) return doc;
  const slides = Array.isArray(doc.slides) ? doc.slides : null;
  const hasTable = Object.prototype.hasOwnProperty.call(doc, TABLE);
  const hasRefs = !!slides?.some((slide) => isRef(slide?.[FIELD]));
  if (!hasTable && !hasRefs) return doc;
  const table = Array.isArray(doc[TABLE]) ? doc[TABLE] : [];
  const { [TABLE]: _table, ...rest } = doc;
  if (!slides) return rest;
  return {
    ...rest,
    slides: slides.map((slide) => {
      if (!isRef(slide?.[FIELD])) return slide;
      const map = {};
      for (const pair of slide[FIELD][REF]) {
        if (!Array.isArray(pair) || !(pair[1] in table)) continue;
        // Cada slide recebe a sua cópia do bloco: nenhum compartilha objeto.
        Object.defineProperty(map, String(pair[0]), {
          value: cloneBlock(table[pair[1]]), enumerable: true, writable: true, configurable: true,
        });
      }
      return { ...slide, [FIELD]: map };
    }),
  };
}

function compactDoc(source) {
  const doc = expandDoc(source);
  if (!isPlainObject(doc) || !Array.isArray(doc.slides)) return doc;
  const table = [];
  const positions = new Map();
  let blocks = 0;
  const slides = doc.slides.map((slide) => {
    const map = slide?.[FIELD];
    if (!isPlainObject(map)) return slide;
    const keys = Object.keys(map);
    // `undefined` não sobrevive ao JSON de qualquer forma; mapa vazio fica como está.
    if (!keys.length || keys.some((key) => map[key] === undefined)) return slide;
    const pairs = keys.map((key) => {
      const text = JSON.stringify(map[key]);
      let position = positions.get(text);
      if (position === undefined) {
        position = table.push(map[key]) - 1;
        positions.set(text, position);
      }
      blocks += 1;
      return [key, position];
    });
    return { ...slide, [FIELD]: { [REF]: pairs } };
  });
  // Sem bloco repetido não há o que economizar: o documento segue como está.
  if (table.length >= blocks) return doc;
  return { ...doc, slides, [TABLE]: table };
}

function mapDocs(library, change) {
  if (!Array.isArray(library)) return library;
  let changed = false;
  const next = library.map((entry) => {
    if (!isPlainObject(entry) || !isPlainObject(entry.doc)) return entry;
    const doc = change(entry.doc);
    if (doc === entry.doc) return entry;
    changed = true;
    return { ...entry, doc };
  });
  return changed ? next : library;
}

/** Documento como o app usa. Sem nada compactado, devolve a mesma referência. */
export function expandDocFromLocalCopy(doc) {
  return expandDoc(doc);
}

/** O que `lsSet` grava em `vc_library`. A biblioteca recebida não é alterada. */
export function compactLibraryForLocalCopy(library) {
  return mapDocs(library, compactDoc);
}

/** Lê tanto o formato antigo (documento inteiro) quanto o compacto. */
export function expandLibraryFromLocalCopy(library) {
  return mapDocs(library, expandDoc);
}

/** Leitura direta da cópia local para quem não passa por `lsGet`. */
export function readLocalLibrary(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem('vc_library') || '[]');
    return Array.isArray(parsed) ? expandLibraryFromLocalCopy(parsed) : [];
  } catch { return []; }
}
