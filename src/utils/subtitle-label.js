/**
 * A leading all-caps label is often a category or procedure name. Keep the
 * original string untouched: the editor still receives every space and line
 * break, while the card can give the label and supporting sentence separate
 * visual hierarchy. A mixed-case sentence does not qualify.
 */
export function splitLeadingUppercaseLabel(value) {
  const raw = String(value ?? '');
  const match = raw.match(/^\s*([\p{Lu}\p{M}\d]+(?:[-/][\p{Lu}\p{M}\d]+)*(?:[ \t\u00a0]+[\p{Lu}\p{M}\d]+(?:[-/][\p{Lu}\p{M}\d]+)*){0,5})(?=$|\s)([\s\S]*)$/u);
  if (!match) return null;

  const label = match[1];
  const remainder = match[2];
  if (label.replace(/[^\p{L}]/gu, '').length < 5) return null;
  // Avoid styling the first few capitals of a single mixed-case word.
  if (remainder && !/^\s/u.test(remainder)) return null;

  return { label, support: remainder.trim() };
}
