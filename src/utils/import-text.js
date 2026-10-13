/**
 * Importação de texto estruturado: 1 página/bloco = 1 card.
 * Interpreta rótulos (Título, Headline, Subtítulo, CTA, Legenda) — não os cola no card.
 * Legenda vai só para a caption do post, nunca para o slide.
 */

import { mkSlide } from './doc-schema.js';

const SEPARATOR_LINE_RE = /^(?:-{3,}|={3,}.*|página\s*\d+\b.*|page\s*\d+\b.*|(?:card|slide)\s*\d+\b.*)$/i;

/** Tokens que abrem um campo (com ou sem `:`). Ordem: mais específicos primeiro. */
const FIELD_TOKEN_RE = /\b(call[\s-]?to[\s-]?action|subt[ií]tulo|subtitle|t[ií]tulo|headline|gancho|hook|abertura|title|corpo|texto|cta|chamada|fecho|convite|legenda|caption)\b\s*:?\s*/gi;

const TOKEN_TO_FIELD = Object.freeze({
  titulo: 'titulo',
  title: 'titulo',
  headline: 'headline',
  gancho: 'headline',
  hook: 'headline',
  abertura: 'headline',
  subtitulo: 'subtitulo',
  subtitle: 'subtitulo',
  corpo: 'subtitulo',
  texto: 'subtitulo',
  cta: 'cta',
  chamada: 'cta',
  'call to action': 'cta',
  'call-to-action': 'cta',
  'calltoaction': 'cta',
  fecho: 'cta',
  convite: 'cta',
  legenda: 'legenda',
  caption: 'legenda',
});

/** Padrão visual ao importar texto → card editorial full-bleed legível. */
export const IMPORT_TEXT_VISUAL = Object.freeze({
  photoRegion: 'full',
  layout: 'ml',
  align: 'left',
  textShadow: true,
  textBg: false,
  overlay: 52,
  elementsUnlocked: true,
  cultureTone: '',
});

function normalizeToken(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim();
}

function fieldFromToken(raw) {
  const key = normalizeToken(raw).replace(/\s+/g, ' ');
  const compact = key.replace(/\s+/g, '');
  return TOKEN_TO_FIELD[key] || TOKEN_TO_FIELD[compact] || null;
}

/** Remove vazamentos tipo "Headline Foo" / "Subtítulo: Foo" do valor já mapeado. */
export function scrubLabelLeak(text) {
  let out = String(text || '').trim();
  if (!out) return '';
  // Prefixos repetidos no início
  out = out.replace(
    /^(?:t[ií]tulo|title|headline|gancho|hook|abertura|subt[ií]tulo|subtitle|corpo|texto|cta|chamada|fecho|convite|legenda|caption)\s*:?\s+/i,
    '',
  );
  // Rótulos soltos no meio (não devem aparecer no card)
  out = out.replace(
    /\s+\b(?:t[ií]tulo|title|headline|gancho|hook|subt[ií]tulo|subtitle|cta|chamada|legenda|caption)\b\s*:?\s+/gi,
    ' ',
  );
  return out.replace(/\s{2,}/g, ' ').trim();
}

function splitPages(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return { pages: [], trailingCaption: '' };

  let body = text;
  let trailingCaption = '';

  // LEGENDA no fim do documento (bloco dedicado, após linha em branco ou rótulo sozinho)
  const captionTail = text.match(/(?:\n|^)(?:legenda|caption)\s*:?\s*\n([\s\S]*)$/i);
  if (captionTail && captionTail.index != null) {
    trailingCaption = captionTail[1].trim();
    body = text.slice(0, captionTail.index).trim();
  }

  const pages = [];
  for (const formPart of body.split('\f')) {
    const lines = formPart.split('\n');
    let buf = [];
    const flush = () => {
      const chunk = buf.join('\n').trim();
      if (chunk) pages.push(chunk);
      buf = [];
    };
    for (const line of lines) {
      if (SEPARATOR_LINE_RE.test(line.trim())) {
        flush();
        continue;
      }
      buf.push(line);
    }
    flush();
  }

  return { pages: pages.length ? pages : (body ? [body] : []), trailingCaption };
}

/**
 * Interpreta rótulos com ou sem `:`, em linhas próprias ou inline no parágrafo.
 */
function parseLabeledBlock(pageText) {
  const fields = {
    titulo: '',
    headline: '',
    subtitulo: '',
    cta: '',
    legenda: '',
  };
  const source = String(pageText || '').replace(/\r\n/g, '\n').trim();
  if (!source) return { fields, unlabeled: [] };

  const matches = [...source.matchAll(FIELD_TOKEN_RE)];
  if (!matches.length) {
    const lines = source.split('\n').map((l) => l.trim()).filter(Boolean);
    return { fields, unlabeled: lines };
  }

  const unlabeled = [];
  const before = source.slice(0, matches[0].index).trim();
  if (before) unlabeled.push(...before.split('\n').map((l) => l.trim()).filter(Boolean));

  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const field = fieldFromToken(m[1]);
    if (!field) continue;
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
    const value = source.slice(start, end).trim();
    if (!value) continue;
    fields[field] = fields[field] ? `${fields[field]}\n${value}`.trim() : value;
  }

  return { fields, unlabeled };
}

/** Separa tema em MAIÚSCULAS colado ao fim do headline (ex.: "Frase. ÁCIDO HIALURÔNICO"). */
function peelThemeFromHeadline(headline) {
  let h = String(headline || '').trim();
  let theme = '';
  const lines = h.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const last = lines[lines.length - 1];
    if (last === last.toLocaleUpperCase('pt-BR') && last.length <= 64 && /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(last)) {
      theme = last;
      h = lines.slice(0, -1).join('\n').trim();
      return { headline: h, theme };
    }
  }
  const inline = h.match(/^(.*[.!?])\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s/-]{2,60})$/);
  if (inline && inline[2] === inline[2].toLocaleUpperCase('pt-BR')) {
    return { headline: inline[1].trim(), theme: inline[2].trim() };
  }
  return { headline: h, theme: '' };
}

function mapFieldsToSlide(fields, unlabeled) {
  let titulo = scrubLabelLeak(fields.titulo);
  let headline = scrubLabelLeak(fields.headline);
  const subtitulo = scrubLabelLeak(fields.subtitulo);
  const cta = scrubLabelLeak(fields.cta);
  // Legenda NUNCA entra no card — só devolve para a caption do post.
  const legenda = scrubLabelLeak(fields.legenda);

  const unlabeledClean = unlabeled.map(scrubLabelLeak).filter(Boolean);

  if (headline) {
    const peeled = peelThemeFromHeadline(headline);
    headline = peeled.headline;
    if (peeled.theme && !titulo) titulo = peeled.theme;
  }

  // Headline = título visual do card; Título/tema reforça o subtítulo (não o headline).
  let title = headline || titulo || unlabeledClean[0] || '';
  title = scrubLabelLeak(title);

  let subtitle = '';
  if (headline && titulo && headline !== titulo) {
    subtitle = [titulo, subtitulo].filter(Boolean).join('\n\n');
  } else if (subtitulo) {
    subtitle = subtitulo;
  } else {
    subtitle = unlabeledClean.slice(1).join('\n');
  }
  subtitle = scrubLabelLeak(subtitle);

  // CTA só no corpo inferior — nunca misturado com subtítulo.
  const bodyAfterImage = cta;

  return {
    title,
    subtitle,
    bodyAfterImage,
    legenda,
  };
}

/**
 * Parseia texto bruto em cards + legenda do documento.
 * @returns {{ cards: Array<{title,subtitle,bodyAfterImage}>, caption: string, pageCount: number }}
 */
export function parseImportedText(raw) {
  const { pages, trailingCaption } = splitPages(raw);
  const cards = [];
  const captionParts = [];
  if (trailingCaption) captionParts.push(scrubLabelLeak(trailingCaption));

  for (const page of pages) {
    const { fields, unlabeled } = parseLabeledBlock(page);
    const mapped = mapFieldsToSlide(fields, unlabeled);
    if (mapped.legenda) captionParts.push(mapped.legenda);
    // Só cria card se houver conteúdo de slide (não só legenda)
    if (!mapped.title && !mapped.subtitle && !mapped.bodyAfterImage) continue;
    cards.push({
      title: mapped.title,
      subtitle: mapped.subtitle,
      bodyAfterImage: mapped.bodyAfterImage,
    });
  }

  return {
    cards,
    caption: captionParts.filter(Boolean).join('\n\n').trim(),
    pageCount: pages.length,
  };
}

/**
 * Aplica cards parseados aos slides + padrão visual de importação.
 */
export function applyImportedTextToSlides(slides, parsed, mkSlideFn = mkSlide, brand = null, opts = {}) {
  const list = Array.isArray(slides) ? slides : [];
  const cards = Array.isArray(parsed?.cards) ? parsed.cards : [];
  if (!cards.length) return { slides: list, created: 0, updated: 0 };

  const isPresentation = !!opts.isPresentation;
  const next = [];
  let created = 0;
  let updated = 0;
  const n = cards.length;

  for (let i = 0; i < n; i += 1) {
    const card = cards[i];
    const existing = i < list.length ? list[i] : null;
    const isCover = i === 0;
    const isClose = i === n - 1;
    let base = existing
      ? { ...existing, num: i + 1 }
      : {
          ...mkSlideFn(i + 1, brand),
        };
    if (!existing) created += 1;
    else updated += 1;

    base = {
      ...base,
      num: i + 1,
      title: scrubLabelLeak(card.title || ''),
      subtitle: scrubLabelLeak(card.subtitle || ''),
      // CTA no fecho; miolo pode ter CTA curto em bodyAfterImage
      bodyAfterImage: scrubLabelLeak(card.bodyAfterImage || ''),
      ...IMPORT_TEXT_VISUAL,
      layout: isPresentation ? 'ml' : (isCover ? 'mc' : 'ml'),
      align: isCover && !isPresentation ? 'center' : 'left',
      showSwipeCue: isPresentation ? false : !isClose,
      // Garante que nada de legenda ficou em campos do card
    };
    next.push(base);
  }

  if (list.length > cards.length) {
    for (let i = cards.length; i < list.length; i += 1) {
      next.push({ ...list[i], num: i + 1 });
    }
  }

  return { slides: next, created, updated };
}

export const IMPORT_TEXT_TEMPLATE = `=== Card 1 ===
Headline: Seus traços orientam o planejamento.
Título: Ácido hialurônico facial
Subtítulo: Planejamento de volume e contorno.
CTA:

=== Card 2 ===
Headline: Segundo argumento
Subtítulo: Continuidade da narrativa.
CTA: Agende uma consulta para conhecer as possibilidades.

LEGENDA:
O ácido hialurônico pode ser utilizado no preenchimento facial. #estetica #hialuronico
`;
