/**
 * Rótulos fixos que o desenho escreve no card: não saem do texto da pessoa
 * nem da geração, então não acompanhavam o idioma do conteúdo (QA 24/11).
 *
 * A composição continua gravando o rótulo em português (projetos salvos não
 * mudam); a troca acontece ao desenhar, pelo idioma do conteúdo
 * (`content-label-language.js`). Português, idioma desconhecido e rótulo fora
 * desta lista saem como estão.
 */
const FIXED_LABELS = Object.freeze({
  // Selo de arrastar dos estilos (visual-presets.jsx, design-data.js).
  'ARRASTA PRO LADO': { en: 'SWIPE', es: 'DESLIZA' },
  // Numeração de cena: Cinema (social-families.js) e Cinemático (presentation-families.js).
  CENA: { en: 'SCENE', es: 'ESCENA' },
  // Ficha técnica (FICHA_LABEL em social-families.js).
  CONTEXTO: { en: 'CONTEXT', es: 'CONTEXTO' },
  PONTO: { en: 'POINT', es: 'PUNTO' },
  FIGURA: { en: 'FIGURE', es: 'FIGURA' },
  TESE: { en: 'THESIS', es: 'TESIS' },
  ETAPAS: { en: 'STEPS', es: 'PASOS' },
  'COMPARAÇÃO': { en: 'COMPARISON', es: 'COMPARACIÓN' },
  FECHO: { en: 'CLOSING', es: 'CIERRE' },
  // Técnico (presentation-families.js). "FIG." e "TAB." valem nos três idiomas.
  FIM: { en: 'END', es: 'FIN' },
  NOTA: { en: 'NOTE', es: 'NOTA' },
});

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Palavra inteira; sem lookbehind (Safari antigo não aceita).
const LABEL_WORD = new RegExp(
  `(^|[^\\p{L}\\p{N}])(${Object.keys(FIXED_LABELS).sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`,
  'gu',
);
const TOKEN = /(\{\w+\??\})/;

const translated = (label, lang) => FIXED_LABELS[label]?.[lang] || label;

/**
 * Selo e campos de assinatura da marca: troca só o texto que é exatamente o
 * rótulo do padrão. Qualquer edição da pessoa deixa de ser o rótulo e sai como
 * ela escreveu.
 */
export function localizeFixedLabel(text, lang) {
  if (typeof text !== 'string' || !Object.hasOwn(FIXED_LABELS, text)) return text;
  return translated(text, lang);
}

/**
 * Texto de dispositivo gráfico da família ("CENA {n}", "§{n} · PONTO"). A
 * troca é feita no molde, antes de os tokens receberem o conteúdo: nome de
 * marca, chapéu e legenda da pessoa passam intactos.
 */
export function localizeLabelTemplate(template, lang) {
  if (typeof template !== 'string' || (lang !== 'en' && lang !== 'es')) return template;
  return template.split(TOKEN)
    .map((part, index) => (index % 2 ? part : part.replace(LABEL_WORD, (_, before, label) => `${before}${translated(label, lang)}`)))
    .join('');
}
