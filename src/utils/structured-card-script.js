const DEFAULT_MAX_CARDS = 24;

const LABEL_DEFINITIONS = Object.freeze([
  { kind: 'card', pattern: 'cards?' },
  { kind: 'slide', pattern: 'slides?' },
  { kind: 'page', pattern: 'p[aá]ginas?', ambiguous: true },
  { kind: 'page', pattern: 'pages?', ambiguous: true },
  { kind: 'carousel', pattern: 'car{1,2}os{1,2}(?:el|[eé]is)' },
  { kind: 'carousel', pattern: 'carousels?' },
  { kind: 'idea', pattern: 'id[eé]ias?', ambiguous: true },
  { kind: 'idea', pattern: 'ideas?', ambiguous: true },
  { kind: 'post', pattern: 'posts?', ambiguous: true },
  { kind: 'post', pattern: 'postage(?:m|ns)', ambiguous: true },
  { kind: 'post', pattern: 'publica(?:ç|c)(?:[aã]o|[oõ]es)', ambiguous: true },
  { kind: 'block', pattern: 'blocos?' },
  { kind: 'block', pattern: 'blocks?' },
  { kind: 'screen', pattern: 'telas?' },
  { kind: 'screen', pattern: 'screens?' },
  { kind: 'piece', pattern: 'pe[çc]as?' },
  { kind: 'story', pattern: 'stories|story' },
  { kind: 'card', pattern: 'cart(?:a|ã)o|cart(?:o|õ)es' },
  { kind: 'slide', pattern: 'diapositivas?' },
]);

const CARD_LABEL_RE = LABEL_DEFINITIONS.map(({ pattern }) => pattern).join('|');
const NUMBER_WORDS = Object.freeze({
  um: 1, uma: 1, one: 1, uno: 1,
  dois: 2, duas: 2, two: 2, dos: 2,
  tres: 3, 'três': 3, three: 3,
  quatro: 4, four: 4, cuatro: 4,
  cinco: 5, five: 5,
  seis: 6, six: 6,
  sete: 7, seven: 7,
  oito: 8, eight: 8,
  nove: 9, nine: 9,
  dez: 10, ten: 10,
  onze: 11, eleven: 11,
  doze: 12, twelve: 12,
});
const NUMBER_WORD_RE = Object.keys(NUMBER_WORDS)
  .sort((a, b) => b.length - a.length)
  .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const NUMBER_TOKEN_RE = `(?:0*\\d{1,3}|${NUMBER_WORD_RE})`;

// O número decimal é recusado no próprio marcador para que `Card 1.5` não
// seja interpretado como Card 1. O total opcional (`de 3`, `/3`, `of 3`) é
// consumido junto do rótulo, sem vazar para o texto publicado.
const CARD_MARKER_RE = new RegExp(
  `\\b(${CARD_LABEL_RE})[ \\t]*(?:(?:n(?:[º°o]|ro)?\\.?|n[uú]mero|number|num\\.?)[ \\t]*)?(?:#[ \\t]*)?(?:[-–—][ \\t]*)?(${NUMBER_TOKEN_RE})(?![\\d]|[.,]\\d)(?:[ \\t]*(?:(?:de|of)[ \\t]+(${NUMBER_TOKEN_RE})|/[ \\t]*(0*\\d{1,3})))?`,
  'giu',
);

// O marcador principal recusa decimais com lookahead para não transformar
// `Card 1.5` em `Card 1`. Ainda precisamos detectar a ocorrência e invalidar
// o roteiro inteiro quando ela aparece entre marcadores legítimos.
const DECIMAL_CARD_MARKER_RE = new RegExp(
  `\\b(?:${CARD_LABEL_RE})[ \\t]*(?:(?:n(?:[º°o]|ro)?\\.?|n[uú]mero|number|num\\.?)[ \\t]*)?(?:#[ \\t]*)?(?:[-–—][ \\t]*)?0*\\d{1,3}[.,]\\d+\\b`,
  'iu',
);

function normalizeLabel(raw) {
  const value = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const found = LABEL_DEFINITIONS.find(({ pattern }) => new RegExp(`^(?:${pattern})$`, 'iu').test(value));
  return found || { kind: 'card', ambiguous: false };
}

function parseNumberToken(raw) {
  const normalized = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/^0*\d{1,3}$/.test(normalized)) return Number(normalized);
  return NUMBER_WORDS[normalized] || null;
}

function resolveMarkerStart(source, index) {
  const lineStart = source.lastIndexOf('\n', Math.max(0, index - 1)) + 1;
  const linePrefix = source.slice(lineStart, index);
  if (/^[ \t]*(?:(?:={2,}|#{1,6}|\*{1,3}|_{1,3})[ \t]*)?$/.test(linePrefix)) {
    return lineStart;
  }
  // Markdown também pode envolver um rótulo no meio de uma linha:
  // `... . **Card 2**`. A fronteira semântica está antes dos asteriscos.
  const inlinePrefix = source.slice(lineStart, index).match(/(?:\*{1,3}|_{1,3})[ \t]*$/u);
  return inlinePrefix ? index - inlinePrefix[0].length : index;
}

function markerHasExplicitBoundary(source, markerStart) {
  if (markerStart === 0) return true;
  const before = source.slice(0, markerStart);
  if (before.endsWith('\n')) return true;
  return /[.!?;:—–-]\s*$/u.test(before);
}

function resolveContentStart(source, markerEnd) {
  const suffix = source.slice(markerEnd);
  const markdownClose = '(?:[ \\t]*(?:\\*{1,3}|_{1,3}|={2,}))?';
  // Com pontuação, o emoji seguinte pertence ao conteúdo (`Card 1: 🔥 ...`).
  const punctuation = suffix.match(new RegExp(
    `^${markdownClose}[ \\t]*(?:[:,;.)]|[-–—]{1,3})[ \\t]*(?:\\n[ \\t]*)?`,
    'u',
  ));
  if (punctuation) return markerEnd + punctuation[0].length;
  // Sem pontuação, emoji/seta é o próprio separador (`Card 1 👉 ...`).
  const visual = suffix.match(new RegExp(
    `^${markdownClose}[ \\t]*(?:(?:[>»→⇒➜➡▶►•])|(?:\\p{Extended_Pictographic}(?:\\uFE0F|\\u200D\\p{Extended_Pictographic})*))+[ \\t]*(?:\\n[ \\t]*)?`,
    'u',
  ));
  if (visual) return markerEnd + visual[0].length;
  const separator = suffix.match(new RegExp(
    `^${markdownClose}[ \\t]*(?:\\n[ \\t]*)?`,
    'u',
  ));
  return markerEnd + String(separator?.[0] || '').length;
}

function cleanupBlockText(value) {
  let cleaned = String(value || '')
    .replace(/^[ \t]*(?:-{3,}|={3,})[ \t]*$/gmu, '')
    .replace(/[ \t]*(?:-{3,}|={3,})[ \t]*$/u, '')
    .trim();
  // Separadores e markdown podem estar aninhados (`**A**\n---`). Faça mais
  // de uma passada para nenhum resíduo ficar visível no card importado.
  for (let pass = 0; pass < 3; pass += 1) {
    const next = cleaned
      .replace(/^[ \t]*(?:\*{1,3}|_{1,3})[ \t]*/u, '')
      .replace(/[ \t]*(?:\*{1,3}|_{1,3})[ \t]*$/u, '')
      .replace(/[ \t]*(?:-{3,}|={3,})[ \t]*$/u, '')
      .trim();
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
}

function isNaturalComparisonConnector(text) {
  return /^(?:e|ou|vs\.?|versus|contra(?:\s+(?:o|a|os|as))?|de|do|da|para|at[eé])$/iu.test(String(text || '').trim());
}

function normalizeMaxCards(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2 ? parsed : DEFAULT_MAX_CARDS;
}

function wordNumberHasContentSeparator(source, match) {
  const rawNumber = String(match?.[2] || '');
  if (/^0*\d{1,3}$/u.test(rawNumber)) return true;
  const markerEnd = (match?.index || 0) + String(match?.[0] || '').length;
  const suffix = source.slice(markerEnd);
  return /^(?:[ \t]*(?:\*{1,3}|_{1,3}|={2,}))?[ \t]*(?:[:,;.)]|[-–—]{1,3}|[>»→⇒➜➡▶►•]|\p{Extended_Pictographic}|\n|$)/u.test(suffix);
}

function markerHasStrongInlineStructure(candidate) {
  const rawNumber = String(candidate?.match?.[2] || '');
  if (/^0\d+$/u.test(rawNumber)) return true;

  const rawMarker = String(candidate?.match?.[0] || '');
  const rawLabel = String(candidate?.match?.[1] || '');
  const numberAt = rawMarker.indexOf(rawNumber, rawLabel.length);
  const between = numberAt >= 0 ? rawMarker.slice(rawLabel.length, numberAt) : '';
  return /#|[-–—]|n(?:[º°o]|ro)?\.?|n[uú]mero|number|num\.?/iu.test(between);
}

function findOrderedMarkers(source, ceiling) {
  const matcher = new RegExp(CARD_MARKER_RE.source, CARD_MARKER_RE.flags);
  const candidates = [...source.matchAll(matcher)].map((match) => ({
    match,
    number: parseNumberToken(match[2]),
    declaredTotal: parseNumberToken(match[3] || match[4]),
    label: normalizeLabel(match[1]),
    markerStart: resolveMarkerStart(source, match.index || 0),
    contentStart: resolveContentStart(source, (match.index || 0) + match[0].length),
  })).filter((candidate) => wordNumberHasContentSeparator(source, candidate.match));

  const first = candidates.find((candidate) => (
    candidate.number === 1 && markerHasExplicitBoundary(source, candidate.markerStart)
  ));
  if (!first) return [];

  // Card 00 é conteúdo estruturado fora da sequência, não um preâmbulo. Se
  // aparecer antes do Card 01, não esconda a capa nem altere a quantidade.
  if (candidates.some((candidate) => (
    candidate.number === 0
    && (candidate.match.index || 0) < (first.match.index || 0)
  ))) return [];

  const ordered = [first];
  let expected = 2;
  for (const candidate of candidates) {
    if ((candidate.match.index || 0) <= (first.match.index || 0)) continue;
    // Depois do primeiro rótulo, uma referência no meio da frase não abre um
    // novo bloco. Exceção: marcadores fortes como `Card 03`, `Card-3`, `#3`
    // ou `nº 3`, que preservam roteiros compactos sem reabrir referências
    // naturais como "compare o card 2 com o card 3".
    const hasBoundary = markerHasExplicitBoundary(source, candidate.markerStart);
    if (!hasBoundary) {
      if (!markerHasStrongInlineStructure(candidate)) continue;
      // Um marcador forte é intenção estrutural, portanto fora de ordem ou
      // duplicado invalida o roteiro em vez de desaparecer silenciosamente.
      if (candidate.number !== expected) return [];
    }
    if (candidate.number !== expected) {
      // Uma numeração fora da sequência em posição de cabeçalho é lacuna ou
      // duplicação real.
      return [];
    }
    ordered.push(hasBoundary ? candidate : { ...candidate, inlineMarker: true });
    expected += 1;
    if (ordered.length > ceiling) return [];
  }
  const declaredTotals = [...new Set(ordered
    .map((candidate) => candidate.declaredTotal)
    .filter((value) => Number.isInteger(value)))];
  if (declaredTotals.length > 1) return [];
  if (declaredTotals.length === 1 && declaredTotals[0] !== ordered.length) return [];
  return ordered;
}

/**
 * Reconhece um roteiro que o usuário já dividiu explicitamente por página.
 * Rótulos semanticamente ambíguos (Post, Ideia e Página) são devolvidos com
 * `requiresConfirmation`, permitindo mostrar a prévia sem travar quantidade.
 */
export function parseExplicitCardScript(text, { maxCards = DEFAULT_MAX_CARDS } = {}) {
  const source = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!source) return null;
  if (DECIMAL_CARD_MARKER_RE.test(source)) return null;

  const ceiling = normalizeMaxCards(maxCards);
  const positions = findOrderedMarkers(source, ceiling);
  if (positions.length < 2 || positions.length > ceiling) return null;

  const blocks = positions.map((position, index) => {
    const start = position.contentStart;
    const end = index + 1 < positions.length ? positions[index + 1].markerStart : source.length;
    return {
      number: index + 1,
      text: cleanupBlockText(source.slice(start, end)),
    };
  });
  if (blocks.some((block) => !block.text || isNaturalComparisonConnector(block.text))) return null;

  const labelKinds = [...new Set(positions.map((position) => position.label.kind))];
  const ambiguousLabels = [...new Set(positions
    .filter((position) => position.label.ambiguous)
    .map((position) => position.label.kind))];
  const hasInlineMarker = positions.some((position) => position.inlineMarker === true);
  const requiresConfirmation = ambiguousLabels.length > 0 || hasInlineMarker;

  return {
    count: blocks.length,
    blocks,
    preamble: source.slice(0, positions[0].markerStart).trim(),
    labelKinds,
    requiresConfirmation,
    ambiguity: requiresConfirmation
      ? { reason: hasInlineMarker ? 'inline-marker' : 'ambiguous-label', labels: ambiguousLabels }
      : null,
  };
}

export function canAutoApplyExplicitCardScript(script) {
  return !!script && script.requiresConfirmation !== true;
}

/** Bloco de alta prioridade compartilhado pelos prompts de geração/revisão. */
export function buildExplicitCardScriptPrompt(script) {
  if (!script || !Array.isArray(script.blocks) || script.blocks.length < 2) return '';
  const blocks = script.blocks.map((block) => `CARD ${block.number}\n${block.text}`).join('\n\n');
  const preamble = String(script.preamble || '').trim();
  return `\nROTEIRO EXPLÍCITO POR CARD — PRIORIDADE MÁXIMA DO PEDIDO ATUAL:
- Gere exatamente ${script.count} cards, na mesma ordem abaixo.
- O CARD N corresponde somente ao bloco CARD N. Não funda, troque, antecipe, omita nem crie cards extras.
- Preserve a função, os fatos, as restrições, as ofertas e o CTA de cada bloco. Não invente dados.
- Você pode melhorar clareza e concisão e distribuir o bloco entre title, subtitle e bodyAfterImage, sem mudar a intenção.
- Os rótulos "CARD N" organizam o roteiro e não devem aparecer no texto publicado.
- Se um modo narrativo ou preset sugerir outra sequência, este roteiro explícito prevalece.
${preamble ? `\nCONTEXTO ANTES DO ROTEIRO:\n${preamble}\n` : ''}
<roteiro_por_card>
${blocks}
</roteiro_por_card>\n`;
}
