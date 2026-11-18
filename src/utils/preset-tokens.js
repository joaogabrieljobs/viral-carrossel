/**
 * Tokens dos presets visuais.
 *
 * Os presets nasceram de referências reais e carregavam textos daquelas marcas
 * hardcoded ("NMLSS ACADEMY", "@JONATHANCADORE", "FOI NO SHOW DO COLDPLAY").
 * Isso vazava a marca de terceiros para o carrossel do usuário.
 *
 * Agora o preset escreve um token e o card resolve na hora do render:
 *
 *   '{handle}'        → @dousuario
 *   '{marca}'         → nome do perfil de marca ativo (ou o handle sem @)
 *   '{ano}'           → ano corrente (não envelhece como '2025' fixo)
 *   '{exemplo:TEXTO}' → amostra visual do preset
 *
 * DOIS MODOS
 *
 *   'card'    — o que é impresso no card e na exportação. Token sem valor
 *               resolve para vazio; `{exemplo:…}` é sempre vazio. Nenhum texto
 *               provisório ("SUA MARCA", "@seuperfil", "#SUAHASHTAG") chega ao
 *               resultado de quem ainda não cadastrou uma marca.
 *   'preview' — miniaturas do seletor de estilos. Aqui o preset mostra a sua
 *               cara: tokens sem valor viram o texto provisório e `{exemplo:…}`
 *               mostra a amostra.
 *
 * ORIGEM DO TEXTO
 *
 * Não reconhecemos texto provisório pelo valor: um usuário pode digitar
 * "SUA EDITORIA" de propósito (há um teste E2E que faz exatamente isso). A
 * origem fica no próprio campo — enquanto ele contém um token, é automático;
 * quando a pessoa digita, o token some e o texto passa a ser dela, sempre
 * impresso. Texto sem token passa intacto.
 */

const PLACEHOLDER_HANDLE = '@seuperfil';
const PLACEHOLDER_MARCA = 'SUA MARCA';

const RE_HANDLE = /\{handle\}/gi;
const RE_MARCA = /\{marca\}/gi;
const RE_ANO = /\{ano\}/gi;
const RE_EXEMPLO = /\{exemplo:([^{}]*)\}/gi;

/** Os sete campos de assinatura que um preset pode escrever na marca. */
export const PRESET_CHROME_TEXT_FIELDS = Object.freeze([
  'cultureHeaderLeft', 'cultureHeaderCenter', 'cultureHeaderYear',
  'footerPillText', 'footerBarLeft', 'footerBarCenter', 'footerBarRight',
]);
const HEADER_FIELDS = ['cultureHeaderLeft', 'cultureHeaderCenter', 'cultureHeaderYear'];
const FOOTER_BAR_FIELDS = ['footerBarLeft', 'footerBarCenter', 'footerBarRight'];

const matches = (re, texto) => { re.lastIndex = 0; return re.test(texto); };

/** Handle real da marca, com @ e sem espaços; '' quando não há um. */
function handleReal(brand) {
  const raw = String(brand?.handle || '').trim();
  if (!raw || raw.toLowerCase() === PLACEHOLDER_HANDLE) return '';
  return raw.startsWith('@') ? raw : `@${raw}`;
}

/** Nome real da marca; cai no handle sem @; '' quando não há nenhum. */
function marcaReal(brand) {
  const nome = String(brand?.name || '').trim();
  if (nome && nome.toLowerCase() !== 'padrão') return nome;
  return handleReal(brand).replace(/^@/, '');
}

/**
 * Resolve tokens de um texto de preset.
 * @param {string} texto
 * @param {object} brand
 * @param {{ modo?: 'card' | 'preview' }} [opcoes]
 * @returns {string}
 */
export function resolvePresetText(texto, brand, { modo = 'card' } = {}) {
  if (typeof texto !== 'string' || !texto) return texto;
  if (!texto.includes('{')) return texto;
  const preview = modo === 'preview';
  const handle = handleReal(brand) || (preview ? PLACEHOLDER_HANDLE : '');
  const marca = marcaReal(brand) || (preview ? PLACEHOLDER_MARCA : '');
  return texto
    .replace(RE_HANDLE, handle)
    .replace(RE_ANO, String(new Date().getFullYear()))
    .replace(RE_MARCA, marca)
    .replace(RE_EXEMPLO, (_, amostra) => (preview ? amostra : ''));
}

/** A coluna depende de um token que, para esta marca, não tem valor? */
function colunaSemValor(raw, brand) {
  if (!raw.includes('{')) return false;
  if (matches(RE_EXEMPLO, raw)) return true;
  if (matches(RE_HANDLE, raw) && !handleReal(brand)) return true;
  if (matches(RE_MARCA, raw) && !marcaReal(brand)) return true;
  return false;
}

/** O texto original da coluna é só o ano (com ou sem ©, barras, espaços)? */
function colunaSoAno(raw) {
  if (!matches(RE_ANO, raw)) return false;
  return raw.replace(RE_ANO, '').replace(/[^\p{L}\p{N}]/gu, '') === '';
}

/**
 * Uma coluna inteira some quando depende de token sem valor: "Por {marca}"
 * sem marca não vira "Por " solto no card.
 */
function resolverColuna(raw, brand) {
  if (colunaSemValor(raw, brand)) return '';
  return resolvePresetText(raw, brand);
}

/**
 * Resolve os sete campos de assinatura e aplica as regras de visibilidade:
 *
 * - Selo do rodapé: aparece se o texto resolvido não é vazio.
 * - Cabeçalho: cada coluna sem valor some; o grupo aparece se sobrar ao menos
 *   uma coluna substantiva. Coluna que é só `{ano}` não conta — ano sozinho
 *   não justifica a barra.
 * - Barra do rodapé (três colunas): atômica. Se qualquer coluna definida
 *   perder o valor, a barra inteira some; é uma ficha de três campos.
 *
 * Devolve `{ brand, ocultos }`. `brand` é o mesmo objeto quando nada muda.
 * `ocultos` lista os grupos que sumiram por falta de valor
 * ('header' | 'pill' | 'footerBar') — a interface usa para convidar a
 * pessoa a preencher a marca, sem bloquear nada.
 */
export function resolvePresetChromeDetalhado(brand) {
  if (!brand || typeof brand !== 'object') return { brand, ocultos: [] };
  const texto = (k) => (typeof brand[k] === 'string' ? brand[k] : '');
  if (!PRESET_CHROME_TEXT_FIELDS.some((k) => texto(k).includes('{'))) return { brand, ocultos: [] };

  const out = { ...brand };
  const ocultos = [];
  const gravar = (k, valor) => { if (typeof brand[k] === 'string') out[k] = valor; };

  // Selo
  const pillRaw = texto('footerPillText');
  if (pillRaw.trim()) {
    const pill = resolverColuna(pillRaw, brand);
    gravar('footerPillText', pill);
    if (!pill.trim()) ocultos.push('pill');
  }

  // Cabeçalho
  const header = HEADER_FIELDS.map((k) => {
    const raw = texto(k);
    const valor = raw.trim() ? resolverColuna(raw, brand) : raw;
    return { k, raw, valor, substantiva: !!valor.trim() && !colunaSoAno(raw) };
  });
  const headerDefinido = header.some((c) => c.raw.trim());
  const headerVisivel = header.some((c) => c.substantiva);
  for (const c of header) gravar(c.k, headerVisivel ? c.valor : '');
  if (headerDefinido && !headerVisivel) ocultos.push('header');

  // Barra do rodapé
  const barra = FOOTER_BAR_FIELDS.map((k) => {
    const raw = texto(k);
    return { k, raw, perdida: !!raw.trim() && colunaSemValor(raw, brand) };
  });
  const barraPerdida = barra.some((c) => c.perdida);
  for (const c of barra) gravar(c.k, barraPerdida ? '' : resolvePresetText(c.raw, brand));
  if (barraPerdida) ocultos.push('footerBar');

  return { brand: out, ocultos };
}

/** Marca com os campos de assinatura prontos para o card e a exportação. */
export function resolvePresetChrome(brand) {
  return resolvePresetChromeDetalhado(brand).brand;
}

/**
 * Valor para exibir num campo de edição: as amostras `{exemplo:…}` somem, e o
 * campo aparece vazio para a pessoa preencher. Os demais tokens ficam visíveis.
 */
export function textoParaEdicao(valor) {
  if (typeof valor !== 'string' || !valor.includes('{')) return valor ?? '';
  return valor.replace(RE_EXEMPLO, '');
}

/** Primeira amostra `{exemplo:…}` do valor, para usar como placeholder do campo. */
export function exemploDe(valor) {
  if (typeof valor !== 'string') return '';
  RE_EXEMPLO.lastIndex = 0;
  const m = RE_EXEMPLO.exec(valor);
  RE_EXEMPLO.lastIndex = 0;
  return m ? m[1] : '';
}

export { PLACEHOLDER_HANDLE, PLACEHOLDER_MARCA };
