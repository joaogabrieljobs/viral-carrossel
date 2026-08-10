/**
 * Tokens dos presets visuais.
 *
 * Os presets nasceram de referências reais e carregavam textos daquelas marcas
 * hardcoded ("NMLSS ACADEMY", "@JONATHANCADORE", "FOI NO SHOW DO COLDPLAY").
 * Isso vazava a marca de terceiros para o carrossel do usuário.
 *
 * Agora o preset escreve um token e o card resolve na hora do render:
 *
 *   '{handle}'    → @dousuario (ou '@seuperfil' se ainda não configurou)
 *   '{ano}'       → ano corrente (não envelhece como '2025' fixo)
 *   '{marca}'     → nome do perfil de marca ativo (ou 'SUA MARCA')
 *
 * Texto sem token passa intacto.
 */

const PLACEHOLDER_HANDLE = '@seuperfil';
const PLACEHOLDER_MARCA = 'SUA MARCA';

/** handle da marca, normalizado com @ e sem espaços */
function handleDe(brand) {
  const raw = String(brand?.handle || '').trim();
  if (!raw || raw === PLACEHOLDER_HANDLE) return PLACEHOLDER_HANDLE;
  return raw.startsWith('@') ? raw : `@${raw}`;
}

function marcaDe(brand) {
  const nome = String(brand?.name || '').trim();
  if (nome && nome.toLowerCase() !== 'padrão') return nome;
  const h = handleDe(brand);
  return h === PLACEHOLDER_HANDLE ? PLACEHOLDER_MARCA : h.replace(/^@/, '');
}

/**
 * Resolve tokens de um texto de preset.
 * @param {string} texto
 * @param {object} brand
 * @returns {string}
 */
export function resolvePresetText(texto, brand) {
  if (typeof texto !== 'string' || !texto) return texto;
  if (!texto.includes('{')) return texto;
  return texto
    .replace(/\{handle\}/gi, handleDe(brand))
    .replace(/\{ano\}/gi, String(new Date().getFullYear()))
    .replace(/\{marca\}/gi, marcaDe(brand));
}

export { PLACEHOLDER_HANDLE, PLACEHOLDER_MARCA };
