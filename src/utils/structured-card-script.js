const DEFAULT_MAX_CARDS = 24;

// Primeiro coletamos os rótulos de forma permissiva. A intenção editorial é
// confirmada abaixo: o primeiro rótulo precisa abrir o texto/linha (ou vir após
// pontuação) e a sequência inteira precisa ser 1, 2, 3... Isso permite o caso
// humano "Card 01; ... card 02; ... card 03 ..." sem ativar por uma menção
// isolada como "veja o card 2".
const CARD_MARKER_RE = /\b(?:card|slide|p[aá]gina|page)[ \t]*0*(\d{1,3})\b/giu;

function resolveMarkerStart(source, index) {
  const lineStart = source.lastIndexOf('\n', Math.max(0, index - 1)) + 1;
  const linePrefix = source.slice(lineStart, index);
  return /^[ \t]*(?:(?:={2,}|#{1,6}|\*{1,2})[ \t]*)?$/.test(linePrefix)
    ? lineStart
    : index;
}

function firstMarkerHasExplicitBoundary(source, markerStart) {
  if (markerStart === 0) return true;
  const before = source.slice(0, markerStart);
  if (before.endsWith('\n')) return true;
  return /[.!?;:]\s*$/u.test(before);
}

function resolveContentStart(source, markerEnd) {
  const suffix = source.slice(markerEnd);
  const separator = suffix.match(/^(?:[ \t]*={2,})?[ \t]*(?:[:;\-—.)][ \t]*)?(?:\n[ \t]*)?/u);
  return markerEnd + String(separator?.[0] || '').length;
}

function isNaturalComparisonConnector(text) {
  return /^(?:e|ou|vs\.?|versus|contra)$/iu.test(String(text || '').trim());
}

function normalizeMaxCards(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2 ? parsed : DEFAULT_MAX_CARDS;
}

/**
 * Reconhece um roteiro que o usuário já dividiu explicitamente por página.
 * Retorna `null` diante de uma simples menção, lacuna, duplicação ou ordem
 * ambígua; geração e importação só mudam de comportamento com intenção clara.
 */
export function parseExplicitCardScript(text, { maxCards = DEFAULT_MAX_CARDS } = {}) {
  const source = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!source) return null;

  const ceiling = normalizeMaxCards(maxCards);
  const matcher = new RegExp(CARD_MARKER_RE.source, CARD_MARKER_RE.flags);
  const matches = [...source.matchAll(matcher)];
  if (matches.length < 2 || matches.length > ceiling) return null;

  const numbers = matches.map((match) => Number(match[1]));
  if (numbers.some((number, index) => number !== index + 1 || number > ceiling)) return null;

  const positions = matches.map((match) => ({
    markerStart: resolveMarkerStart(source, match.index || 0),
    contentStart: resolveContentStart(source, (match.index || 0) + match[0].length),
  }));
  if (!firstMarkerHasExplicitBoundary(source, positions[0].markerStart)) return null;
  const blocks = matches.map((match, index) => {
    const start = positions[index].contentStart;
    const end = index + 1 < positions.length ? positions[index + 1].markerStart : source.length;
    return {
      number: numbers[index],
      text: source.slice(start, end).trim(),
    };
  });
  if (blocks.some((block) => !block.text || isNaturalComparisonConnector(block.text))) return null;

  return {
    count: blocks.length,
    blocks,
    preamble: source.slice(0, positions[0].markerStart).trim(),
  };
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

