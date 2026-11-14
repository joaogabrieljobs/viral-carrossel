import { cultureAccentRenderablePieces, markdownBoldAccentIntervalsUtf16, markdownItalicIntervalsUtf16 } from './text-spans.js';

const TITLE_PLACEHOLDER = /^(?:seu t[ií]tulo aqui|your title here)[.!…]*$/iu;

export function requiresSocialTitles(config = {}) {
  return config.presetId !== 'apresentacao';
}

export const SOCIAL_SUPPORT_MAX_CHARS = 160;
export const SOCIAL_SUPPORT_MAX_LINES = 3;

// A visual region is not an extra copy budget. All narrative modes share these
// ceilings, including text split above/below an image. Shorter copy is welcome.
const SOCIAL_TEXT_LIMITS = Object.freeze({
  '1_1': { label: 'Denso', title: 80, titleWords: 12, subtitle: 160, bodyAfterImage: 160, support: 300 },
  '1_2': { label: 'Balanceado', title: 72, titleWords: 10, subtitle: 140, bodyAfterImage: 100, support: 220 },
  '1_3': { label: 'Curto', title: 64, titleWords: 10, subtitle: 110, bodyAfterImage: 70, support: 150 },
  '1_4': { label: 'Mínimo', title: 56, titleWords: 9, subtitle: 90, bodyAfterImage: 50, support: 110 },
  '1_5': { label: 'Essencial', title: 48, titleWords: 8, subtitle: 70, bodyAfterImage: 40, support: 80 },
});

export function socialTextLimits(config = {}) {
  return { ...(SOCIAL_TEXT_LIMITS[config.densityId] || SOCIAL_TEXT_LIMITS['1_1']), maxLines: SOCIAL_SUPPORT_MAX_LINES };
}

function visibleSocialText(value) {
  return cultureAccentRenderablePieces(String(value || '').trim()).map(piece => piece.v).join('');
}

/** Report excess without cutting a condition, number or completed sentence. */
export function auditSocialTextDensity(slides, config = {}) {
  if (!requiresSocialTitles(config)) return [];
  const limits = socialTextLimits(config);
  return (Array.isArray(slides) ? slides : []).flatMap((slide, slideIndex) => {
    const violations = [];
    const text = Object.fromEntries(['title', 'subtitle', 'bodyAfterImage'].map(field => [field, visibleSocialText(slide?.[field])]));
    for (const field of Object.keys(text)) {
      const chars = Array.from(text[field]).length;
      const lines = text[field] ? text[field].split(/\r\n|\r|\n/).length : 0;
      const words = text[field] ? text[field].split(/\s+/u).length : 0;
      if (chars > limits[field] || (field !== 'title' && lines > limits.maxLines) || (field === 'title' && words > limits.titleWords)) {
        violations.push({ slideIndex, field, chars, maxChars: limits[field],
          ...(field === 'title' ? { words, maxWords: limits.titleWords } : { lines, maxLines: limits.maxLines }),
        });
      }
    }
    const supportChars = Array.from([text.subtitle, text.bodyAfterImage].filter(Boolean).join(' ')).length;
    if (supportChars > limits.support) violations.push({ slideIndex, field: 'support', chars: supportChars, maxChars: limits.support });
    return violations;
  });
}

/** Same contract is sent to generation, review and individual refinements. */
export function buildSocialTextLimitsPrompt(config = {}) {
  if (!requiresSocialTitles(config)) return '';
  const limits = socialTextLimits(config);
  return `CONTRATO DE TEXTO — ${limits.label}, igual em todos os modos narrativos:
- title: obrigatório e específico, até ${limits.title} caracteres e ${limits.titleWords} palavras; nunca "Seu título aqui".
- subtitle: até ${limits.subtitle} caracteres e ${limits.maxLines} linhas curtas.
- bodyAfterImage: opcional quando permitido pelo layout, até ${limits.bodyAfterImage} caracteres e ${limits.maxLines} linhas curtas. Deixe vazio se não acrescentar informação.
- subtitle + bodyAfterImage juntos: até ${limits.support} caracteres, incluindo o espaço entre blocos. A zona abaixo da imagem não é espaço para continuar um texto longo.
- São TETOS, nunca metas mínimas. Uma ideia por card, uma ou duas frases de apoio; não preencha espaço, repita a legenda nem acrescente exemplos para atingir um tamanho. Preserve condições e fatos ao sintetizar. Não esconda excesso em título, outro campo ou fonte menor.
- O modo organiza a sequência; não altera estes limites. Não aumente a quantidade pedida para acomodar texto. Se o usuário pediu texto literal, preserve-o para revisão em vez de cortá-lo silenciosamente.`;
}

export function socialTitleMissing(slide) {
  const title = String(slide?.title || '').trim();
  return !title || TITLE_PLACEHOLDER.test(title);
}

/**
 * Recover an existing complete opening line/sentence, never invent a headline
 * or crop a sentence to fit. The remaining copy stays in the subtitle. A split
 * inside a supported emphasis span is unsafe and is left to editorial review.
 */
export function recoverSocialTitle(slide) {
  if (!socialTitleMissing(slide)) return slide;
  const subtitle = String(slide?.subtitle || '').trim();
  if (!subtitle) return slide;
  const spans = [
    ...markdownBoldAccentIntervalsUtf16(subtitle),
    ...markdownItalicIntervalsUtf16(subtitle),
  ];
  const endings = /[.!?…](?:["”’')\]]|\*{1,2}|_{1,2})*(?=\s|$)|\n+/gu;
  const candidates = Array.from(subtitle.matchAll(endings), match => match.index + match[0].length);
  candidates.push(subtitle.length);
  for (const end of candidates) {
    const title = subtitle.slice(0, end).trim();
    if (!title || title.length > 120) continue;
    if (spans.some(([lo, hi]) => end > lo && end < hi)) continue;
    return { ...slide, title, subtitle: subtitle.slice(end).trim() };
  }
  return slide;
}

/**
 * Última barreira local quando a revisão externa fica indisponível ou devolve
 * um JSON inválido. Move um trecho inteiro do apoio para o título e mantém o
 * restante no subtítulo: nenhum caractere do rascunho é descartado.
 */
export function recoverSocialTitleForEditing(slide) {
  const recovered = recoverSocialTitle(slide);
  if (!socialTitleMissing(recovered)) return recovered;
  const subtitle = String(recovered?.subtitle || '').trim();
  if (!subtitle) return recovered;
  const preferredMax = Math.min(96, subtitle.length);
  const sample = subtitle.slice(0, preferredMax);
  const boundary = sample.lastIndexOf(' ');
  const end = boundary >= 32 ? boundary : preferredMax;
  const title = subtitle.slice(0, end).trim();
  const remainder = subtitle.slice(end).trim();
  return title ? { ...recovered, title, subtitle:remainder } : recovered;
}

export function missingSocialTitleIndexes(slides, config = {}) {
  return requiresSocialTitles(config)
    ? (Array.isArray(slides) ? slides : []).flatMap((slide, index) => socialTitleMissing(slide) ? [index] : [])
    : [];
}

export function longSocialSupportIndexes(slides, config = {}) {
  return [...new Set(auditSocialTextDensity(slides, config).filter(item => item.field !== 'title').map(item => item.slideIndex))];
}
