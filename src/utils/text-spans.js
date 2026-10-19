// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).

/** Junta intervalos UTF-16 [lo, hi) ordenados sem sobrepor. */
function mergeUtf16AccentIntervals(intervals) {
  if (!intervals?.length) return [];
  const xs = intervals.filter(([a, b]) => b > a).map(([a, b]) => [a, b]).sort((x, y) => x[0] - y[0]);
  const out = [];
  let cs = xs[0][0];
  let ce = xs[0][1];
  for (let i = 1; i < xs.length; i++) {
    const [a, b] = xs[i];
    if (a <= ce) ce = Math.max(ce, b);
    else {
      out.push([cs, ce]);
      cs = a;
      ce = b;
    }
  }
  out.push([cs, ce]);
  return out;
}

function normalizeDestaqueSpansForLen(spans, len) {
  if (!len || len < 1) return [];
  const n = spans || [];
  return mergeUtf16AccentIntervals(
    n.map((pair) => {
      const a = typeof pair?.[0] === 'number' ? pair[0] : Number(pair?.[0]);
      const b = typeof pair?.[1] === 'number' ? pair[1] : Number(pair?.[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return [-1, -1];
      const lo = Math.max(0, Math.min(len, Math.floor(a)));
      const hi = Math.max(0, Math.min(len, Math.floor(b)));
      return lo < hi ? [lo, hi] : [-1, -1];
    }).filter(([a, b]) => b > a),
  );
}

/** Regiões “acento” apenas no interior de `\*\*…\*\*` (asteriscos não pintados). */
function markdownBoldAccentIntervalsUtf16(full) {
  const s = String(full ?? '');
  const iv = [];
  const re = /\*\*([^*]+)\*\*/g;
  let m;
  while ((m = re.exec(s)) !== null) iv.push([m.index + 2, m.index + m[0].length - 2]);
  return mergeUtf16AccentIntervals(iv);
}

/** Itálico de um asterisco só. Não pega o miolo de `**negrito**`. */
function markdownItalicIntervalsUtf16(full) {
  const s = String(full ?? '');
  const bold = markdownBoldAccentIntervalsUtf16(s);
  const iv = [];
  const re = /(^|[^*])\*([^*\n]+)\*(?!\*)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const start = m.index + m[1].length + 1;
    const end = start + m[2].length;
    const insideBold = bold.some(([lo, hi]) => start >= lo && end <= hi);
    if (!insideBold) iv.push([start, end]);
  }
  return mergeUtf16AccentIntervals(iv);
}

function unifyAccentIntervalsUtf16(full, explicitSpans) {
  const len = full.length;
  const md = markdownBoldAccentIntervalsUtf16(full);
  const ex = normalizeDestaqueSpansForLen(explicitSpans, len);
  return mergeUtf16AccentIntervals([...md, ...ex]);
}

/** Remove pares `**` e `*` colados às zonas (marcadores Markdown — não aparecem no cartão). */
function stripAdjacentMarkdownBoldFences(fragment) {
  let s = String(fragment ?? '');
  let prev = null;
  while (prev !== s) {
    prev = s;
    if (s.startsWith('**')) s = s.slice(2);
    else if (s.startsWith('*')) s = s.slice(1);
    if (s.endsWith('**')) s = s.slice(0, -2);
    else if (s.endsWith('*')) s = s.slice(0, -1);
  }
  return s;
}

function pushCleanPiece(pieces, type, raw) {
  const cleaned = type === 'base' ? stripAdjacentMarkdownBoldFences(raw) : raw;
  if (cleaned.length) pieces.push({ type, v: cleaned });
}

/** Trechos `{ type:'base'|'accent'|'italic', v }` na ordem do texto. */
function cultureAccentRenderablePieces(fullText, explicitSpans) {
  const full = String(fullText ?? '');
  const len = full.length;
  if (!len) return [];
  const marks = [
    ...unifyAccentIntervalsUtf16(full, explicitSpans).map(([lo, hi]) => ({ type: 'accent', lo, hi })),
    ...markdownItalicIntervalsUtf16(full).map(([lo, hi]) => ({ type: 'italic', lo, hi })),
  ].sort((a, b) => a.lo - b.lo || a.hi - b.hi);
  const pieces = [];
  let ptr = 0;
  for (const mark of marks) {
    const lo = Math.max(0, mark.lo);
    const hi = Math.min(len, mark.hi);
    if (hi <= lo || lo < ptr) continue;
    if (ptr < lo) pushCleanPiece(pieces, 'base', full.slice(ptr, lo));
    pushCleanPiece(pieces, mark.type, full.slice(lo, hi));
    ptr = hi;
  }
  if (ptr < len) pushCleanPiece(pieces, 'base', full.slice(ptr));
  return pieces.length ? pieces : [{ type: 'base', v: stripAdjacentMarkdownBoldFences(full) || full }];
}

function contiguousTextEditBounds(prevStr, nextStr) {
  const p = String(prevStr ?? '');
  const n = String(nextStr ?? '');
  if (p === n) return null;
  const L0 = p.length;
  const L1 = n.length;
  let a = 0;
  while (a < L0 && a < L1 && p[a] === n[a]) a++;
  let b = 0;
  while (b < L0 - a && b < L1 - a && p[L0 - 1 - b] === n[L1 - 1 - b]) b++;
  const delStart = a;
  const delEndEx = L0 - b;
  const newMidEndEx = L1 - b;
  const oldMid = p.slice(delStart, delEndEx);
  const newMid = n.slice(delStart, newMidEndEx);
  const rebuiltOld = p.slice(0, delStart) + oldMid + p.slice(L0 - b);
  const rebuiltNew = n.slice(0, delStart) + newMid + n.slice(L1 - b);
  if (rebuiltOld !== p || rebuiltNew !== n) return null;
  return { delStart, delEndEx, oldMidLen: oldMid.length, newMidLen: newMid.length };
}

/** Ajusta intervalos quando o texto do campo é editado por uma substituição contígua. */
function remapDestaqueSpansOnEdit(prevText, nextText, spansIn) {
  const prev = String(prevText ?? '');
  const next = String(nextText ?? '');
  if (prev === next) return normalizeDestaqueSpansForLen(spansIn, next.length);
  const bounds = contiguousTextEditBounds(prev, next);
  let nextSpans = [...(spansIn || [])];
  if (!bounds) {
    return [];
  }
  const delta = bounds.newMidLen - bounds.oldMidLen;
  const delStart = bounds.delStart;
  const delEndEx = bounds.delEndEx;
  const adjusted = [];
  for (const [s, e] of nextSpans) {
    const lo = typeof s === 'number' ? s : 0;
    const hi = typeof e === 'number' ? e : 0;
    if (hi <= lo) continue;
    if (hi <= delStart) adjusted.push([lo, hi]);
    else if (lo >= delEndEx) adjusted.push([lo + delta, hi + delta]);
  }
  return normalizeDestaqueSpansForLen(adjusted, next.length);
}

export {
  mergeUtf16AccentIntervals,
  normalizeDestaqueSpansForLen,
  markdownBoldAccentIntervalsUtf16,
  markdownItalicIntervalsUtf16,
  unifyAccentIntervalsUtf16,
  stripAdjacentMarkdownBoldFences,
  cultureAccentRenderablePieces,
  contiguousTextEditBounds,
  remapDestaqueSpansOnEdit,
};
