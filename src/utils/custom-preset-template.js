/**
 * Modelo guardado num padrão personalizado ("Salvar padrão").
 *
 * Salvar e "Publicar como modelo" capturam a mesma coisa: a estrutura visual
 * do projeto inteiro (um card por papel — capa, conteúdo, fechamento — com
 * caixas, tamanhos, tipografia e cores), pelo mesmo módulo e o mesmo contrato
 * (`published-template.js`): nada de texto, foto, logo, nome ou @.
 * Aplicar o padrão a todos os cards usa o mesmo caminho do "Usar modelo" da
 * galeria, então o resultado é idêntico ao do modelo publicado.
 *
 * Antes, o padrão guardava só o card ativo e aplicá-lo apagava família,
 * fundo, paleta e composição de cada página. Padrões antigos, sem modelo,
 * continuam no caminho antigo.
 *
 * Para caber nos metadados da conta (512 KB para tudo), o modelo é guardado
 * compactado: valores de objeto repetidos entre cards (tipografia por perfil,
 * zonas) ficam uma vez numa lista e os cards apontam para ela.
 */
import {
  TEMPLATE_VERSION,
  applyTemplateToDoc,
  buildTemplateContent,
  sanitizeTemplateContent,
} from './published-template.js';

const POOL_REF = '$pool';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const POOL_MIN_CHARS = 24;

/**
 * Troca objetos repetidos (em qualquer nível dos cards) por referência a uma
 * lista única. A tipografia por perfil se repete quase igual entre cards: os
 * perfis iguais viram uma entrada só.
 */
export function packPresetTemplate(content) {
  const pool = [];
  const index = new Map();
  const pack = (value) => {
    if (Array.isArray(value)) return value.map(pack);
    if (!isPlainObject(value)) return value;
    const packed = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, pack(item)]));
    const key = JSON.stringify(packed);
    if (key.length < POOL_MIN_CHARS) return packed;
    if (!index.has(key)) {
      index.set(key, pool.length);
      pool.push(packed);
    }
    return { [POOL_REF]: index.get(key) };
  };
  const slides = content.slides.map((slide) => Object.fromEntries(
    Object.entries(slide).map(([field, value]) => [field, pack(value)]),
  ));
  return { v: content.v, format: content.format, brand: content.brand, slides, ...(pool.length ? { pool } : {}) };
}

/** Desfaz `packPresetTemplate`. Referência quebrada ou circular derruba o valor. */
export function unpackPresetTemplate(packed) {
  if (!isPlainObject(packed) || !Array.isArray(packed.slides)) return null;
  const pool = Array.isArray(packed.pool) ? packed.pool : [];
  const unpack = (value, depth = 0) => {
    if (depth > 12) return undefined;
    if (Array.isArray(value)) return value.map((item) => unpack(item, depth + 1)).filter((item) => item !== undefined);
    if (!isPlainObject(value)) return value;
    if (Object.hasOwn(value, POOL_REF)) {
      const ref = value[POOL_REF];
      return Number.isInteger(ref) && ref >= 0 && ref < pool.length ? unpack(pool[ref], depth + 1) : undefined;
    }
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      const next = unpack(item, depth + 1);
      if (next !== undefined) out[key] = next;
    }
    return out;
  };
  const slides = packed.slides.map((slide) => {
    const out = {};
    for (const [field, value] of Object.entries(isPlainObject(slide) ? slide : {})) {
      const next = unpack(value);
      if (next !== undefined) out[field] = next;
    }
    return out;
  });
  return { v: packed.v, format: packed.format, brand: isPlainObject(packed.brand) ? packed.brand : {}, slides };
}

/** Captura o modelo do projeto aberto, já limpo como o servidor o gravaria. */
export function captureCustomPresetTemplate(doc) {
  try {
    return packPresetTemplate(sanitizeTemplateContent(buildTemplateContent(doc || {})));
  } catch {
    return undefined;
  }
}

function isPresentationDoc(doc) {
  return doc?.productKind === 'apresentacao' || doc?.fmt === 'apresentacao' || doc?.creativePreset === 'apresentacao';
}

/**
 * Aplica o modelo guardado no padrão a todos os cards, como a galeria faz.
 * Devolve null quando o padrão não tem modelo (padrão antigo), é de outro
 * produto ou o modelo não passa na validação: o chamador segue o caminho antigo.
 */
export function applyCustomVisualPresetTemplate(doc, preset) {
  if (!preset?.isCustom || !preset.template || preset.template.v !== TEMPLATE_VERSION) return null;
  const presetIsPresentation = preset.productKind === 'apresentacao';
  if (presetIsPresentation !== isPresentationDoc(doc)) return null;
  const content = unpackPresetTemplate(preset.template);
  if (!content) return null;
  try {
    return { ...applyTemplateToDoc(doc, content), visualPreset: preset.id };
  } catch {
    return null;
  }
}
