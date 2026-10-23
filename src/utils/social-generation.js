import { markdownBoldAccentIntervalsUtf16, markdownItalicIntervalsUtf16 } from './text-spans.js';

const TITLE_PLACEHOLDER = /^(?:seu t[ií]tulo aqui|your title here)[.!…]*$/iu;

export function requiresSocialTitles(config = {}) {
  return config.presetId !== 'apresentacao';
}

export const SOCIAL_SUPPORT_MAX_CHARS = 160;
export const SOCIAL_SUPPORT_MAX_LINES = 3;

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

export function missingSocialTitleIndexes(slides, config = {}) {
  return requiresSocialTitles(config)
    ? (Array.isArray(slides) ? slides : []).flatMap((slide, index) => socialTitleMissing(slide) ? [index] : [])
    : [];
}

export function longSocialSupportIndexes(slides, config = {}) {
  if (!requiresSocialTitles(config)) return [];
  return (Array.isArray(slides) ? slides : []).flatMap((slide, index) => {
    const support = String(slide?.subtitle || '').trim();
    const lines = support ? support.split(/\r\n|\r|\n/).length : 0;
    return support.length > SOCIAL_SUPPORT_MAX_CHARS || lines > SOCIAL_SUPPORT_MAX_LINES ? [index] : [];
  });
}
