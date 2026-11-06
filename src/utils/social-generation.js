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

/**
 * Last deterministic step when no complete sentence fits as a title: move the
 * opening clause (up to a comma, semicolon, colon or dash) into the title. All
 * words stay on the card, in the same order; nothing is invented or dropped.
 */
export function recoverSocialTitleAtClause(slide) {
  const sentence = recoverSocialTitle(slide);
  if (!socialTitleMissing(sentence)) return sentence;
  const subtitle = String(slide?.subtitle || '').trim();
  if (!subtitle) return slide;
  const spans = [
    ...markdownBoldAccentIntervalsUtf16(subtitle),
    ...markdownItalicIntervalsUtf16(subtitle),
  ];
  const clauses = /\s*[,;:\u2013\u2014](?=\s)/gu;
  for (const match of subtitle.matchAll(clauses)) {
    const end = match.index + match[0].length;
    const title = subtitle.slice(0, match.index).trim();
    const rest = subtitle.slice(end).trim();
    if (title.length < 8 || title.length > 120 || !rest) continue;
    if (spans.some(([lo, hi]) => end > lo && end < hi)) continue;
    return { ...slide, title, subtitle: rest };
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

const REPEAT_STOPWORDS = new Set([
  'a', 'as', 'o', 'os', 'de', 'da', 'das', 'do', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'com',
  'the', 'a', 'an', 'of', 'to', 'and', 'in', 'on', 'for', 'with', 'your', 'you', 'is', 'are',
]);

function repeatWords(value) {
  return String(value || '')
    .replace(/[*_~`]+/g, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [];
}

function repeatedPhraseCandidates(slide) {
  const words = repeatWords([slide?.title, slide?.subtitle, slide?.bodyAfterImage].filter(Boolean).join(' '));
  const phrases = new Set();
  for (let size = Math.min(6, words.length); size >= 3; size -= 1) {
    for (let start = 0; start + size <= words.length; start += 1) {
      const part = words.slice(start, start + size);
      if (part.join(' ').length < 15) continue;
      if (part.filter(word => !REPEAT_STOPWORDS.has(word)).length < 2) continue;
      phrases.add(part.join(' '));
    }
  }
  for (let index = 0; index + 1 < words.length; index += 1) {
    if (/^\d+(?:[.,]\d+)?$/.test(words[index]) && !REPEAT_STOPWORDS.has(words[index + 1])) {
      phrases.add(`${words[index]} ${words[index + 1]}`);
    }
  }
  return phrases;
}

/** Detecta repetição lexical entre cards; não compara ocorrências dentro do mesmo card. */
export function auditRepeatedSocialPhrases(slides, config = {}) {
  if (!requiresSocialTitles(config)) return [];
  const occurrences = new Map();
  (Array.isArray(slides) ? slides : []).forEach((slide, slideIndex) => {
    for (const phrase of repeatedPhraseCandidates(slide)) {
      if (!occurrences.has(phrase)) occurrences.set(phrase, new Set());
      occurrences.get(phrase).add(slideIndex);
    }
  });
  const candidates = [...occurrences.entries()]
    .filter(([, indexes]) => indexes.size > 1)
    .map(([phrase, indexes]) => ({ phrase, slideIndexes: [...indexes].sort((a, b) => a - b) }))
    .sort((a, b) => b.phrase.split(' ').length - a.phrase.split(' ').length || b.phrase.length - a.phrase.length);
  const selected = [];
  for (const candidate of candidates) {
    const sameCardsAlreadyCovered = selected.some(item => (
      item.slideIndexes.join(',') === candidate.slideIndexes.join(',')
      && item.phrase.includes(candidate.phrase)
    ));
    if (!sameCardsAlreadyCovered) selected.push(candidate);
    if (selected.length >= 8) break;
  }
  return selected;
}
