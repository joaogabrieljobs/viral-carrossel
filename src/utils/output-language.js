// Idioma do texto visível. As regras do app são escritas em português, mas o
// texto final segue o pedido explícito do usuário ou, sem pedido, a língua do brief.

const LANGS = {
  en: { label: 'inglês', native: 'English' },
  es: { label: 'espanhol', native: 'Español' },
  pt: { label: 'português brasileiro', native: 'Português' },
};

export const OUTPUT_LANGUAGE_LABELS = Object.fromEntries(Object.entries(LANGS).map(([k, v]) => [k, v.label]));

const STOPWORDS = {
  en: ['the', 'and', 'of', 'to', 'is', 'are', 'with', 'for', 'you', 'your', 'that', 'this', 'it', 'in', 'on', 'who', 'what', 'how', 'from', 'my', 'we', 'our', 'they', 'be'],
  pt: ['de', 'que', 'e', 'o', 'os', 'as', 'para', 'com', 'não', 'nao', 'uma', 'um', 'você', 'voce', 'é', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'por', 'mais', 'seu', 'sua'],
  es: ['el', 'los', 'las', 'del', 'y', 'que', 'para', 'con', 'una', 'por', 'es', 'su', 'tu', 'usted', 'pero', 'muy', 'cómo', 'como', 'qué'],
};

/** Pedido explícito de idioma nas instruções do usuário ("Write everything in English", "escreva em inglês"). */
const LANG_NAMES = {
  en: '(?:english|ingl[eê]s)',
  es: '(?:spanish|espa[nñ]ol|espanhol)',
  pt: '(?:portuguese|portugu[eê]s)',
};
const ASK = '\\b(?:write|escrev[a-z]*|redij[a-z]*|texto|text|idioma|language|output|sa[ií]da|tudo|everything|all)\\b';

export function explicitOutputLanguage(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return null;
  for (const [lang, name] of Object.entries(LANG_NAMES)) {
    const direct = new RegExp(`(?:^|[^a-z])(?:in|em|en)\\s+${name}(?![a-z])`);
    const asked = new RegExp(`${ASK}[^.\\n]{0,24}\\b(?:in|em|en)\\s+${name}(?![a-z])`);
    const labelled = new RegExp(`\\b(?:language|idioma|output(?:\\s+language)?|l[ií]ngua)\\s*(?::|=|-)\\s*${name}(?![a-z])`);
    const visibleFields = new RegExp(`\\b(?:all\\s+)?(?:titles?|texts?|copy|content|headlines?|captions?)\\b[^.\\n]{0,32}\\b(?:in|em|en|must\\s+be|should\\s+be)\\s+${name}(?![a-z])`);
    if (direct.test(t) || asked.test(t) || labelled.test(t) || visibleFields.test(t)) return lang;
  }
  return null;
}

/** Língua predominante de um texto livre. null quando curto ou ambíguo. */
export function detectTextLanguage(text) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .split(/[^a-zà-ÿ]+/i)
    .filter(Boolean);
  if (words.length < 12) return null;
  const score = {};
  for (const [lang, list] of Object.entries(STOPWORDS)) {
    const set = new Set(list);
    score[lang] = words.reduce((n, w) => n + (set.has(w) ? 1 : 0), 0);
  }
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  if (best[1] < 3 || best[1] < second[1] * 1.6) return null;
  return best[0];
}

/** Idioma de saída: pedido explícito > língua do brief > português (padrão). */
export function resolveOutputLanguage({ instructions = '', content = '', topic = '' } = {}) {
  const explicit = explicitOutputLanguage(instructions);
  if (explicit) return explicit;
  return detectTextLanguage(`${topic}\n${content}`) || 'pt';
}

/** Bloco que entra no fim do prompt. Vazio no padrão português, para não mudar o comportamento atual. */
export function buildOutputLanguageBlock(material = {}, topic = '') {
  const lang = resolveOutputLanguage({
    instructions: material?.context,
    content: material?.content,
    topic,
  });
  if (lang === 'pt' || !LANGS[lang]) return '';
  const { label, native } = LANGS[lang];
  return `
IDIOMA DE SAÍDA (prevalece sobre qualquer menção a português neste pedido e nas regras do sistema): escreva TODO o texto visível ao leitor em ${label} (${native}): títulos, subtítulos, corpo, CTA, legenda e notas do apresentador. As regras deste pedido estão em português só por serem internas do app. Não traduza nomes próprios nem marcas. Os nomes de campos do schema continuam como estão.
`;
}

/** Reforço curto no papel de sistema para o modelo não voltar ao português padrão. */
export function buildOutputLanguageSystemInstruction(lang) {
  if (lang === 'en') {
    return 'OUTPUT LANGUAGE OVERRIDE: Write every reader-visible field in natural English, including titles, subtitles, body copy and captions. Keep only image search queries in English as already required. Portuguese instructions are internal product rules, not the requested output language.';
  }
  if (lang === 'es') {
    return 'IDIOMA DE SALIDA OBLIGATORIO: escribe en español natural todos los campos visibles para el lector, incluidos títulos, subtítulos, cuerpo y leyenda. Las instrucciones en portugués son reglas internas del producto, no el idioma de salida.';
  }
  return '';
}
