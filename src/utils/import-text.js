/**
 * Importação de texto estruturado: 1 página/bloco = 1 card.
 * Separa título, headline, subtítulo, CTA e legenda do post.
 */

import { mkSlide } from './doc-schema.js';

const SEPARATOR_LINE_RE = /^(?:-{3,}|={3,}.*|página\s*\d+\b.*|page\s*\d+\b.*|(?:card|slide)\s*\d+\b.*)$/i;

const FIELD_ALIASES = Object.freeze({
  titulo: ['titulo', 'título', 'title', 'tit'],
  headline: ['headline', 'gancho', 'hook', 'abertura'],
  subtitulo: ['subtitulo', 'subtítulo', 'subtitle', 'sub', 'corpo', 'texto'],
  cta: ['cta', 'chamada', 'call to action', 'call-to-action', 'fecho', 'convite'],
  legenda: ['legenda', 'caption', 'legenda do post', 'caption do post', 'hashtags'],
});

function normalizeKey(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_:]+$/g, '')
    .trim();
}

function matchField(key) {
  const k = normalizeKey(key);
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((alias) => normalizeKey(alias) === k)) return field;
  }
  return null;
}

function splitPages(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return { pages: [], trailingCaption: '' };

  // Bloco final de legenda separado do resto (fora das páginas).
  let body = text;
  let trailingCaption = '';
  const captionSplit = text.split(/\n(?=(?:legenda|caption)\s*:)/i);
  if (captionSplit.length > 1) {
    const last = captionSplit[captionSplit.length - 1];
    if (/^(?:legenda|caption)\s*:/i.test(last.trim())) {
      trailingCaption = last.replace(/^(?:legenda|caption)\s*:/i, '').trim();
      body = captionSplit.slice(0, -1).join('\n').trim();
    }
  }

  const pages = [];
  // Form-feed = quebra de página (Word/PDF colado).
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

function parseLabeledBlock(pageText) {
  const lines = String(pageText || '').split('\n');
  const fields = {
    titulo: '',
    headline: '',
    subtitulo: '',
    cta: '',
    legenda: '',
  };
  let current = null;
  const unlabeled = [];

  for (const line of lines) {
    const labeled = line.match(/^\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 /_-]{0,40})\s*:\s*(.*)$/);
    if (labeled) {
      const field = matchField(labeled[1]);
      if (field) {
        current = field;
        const rest = labeled[2].trim();
        fields[field] = fields[field]
          ? `${fields[field]}\n${rest}`.trim()
          : rest;
        continue;
      }
    }
    if (current) {
      fields[current] = fields[current]
        ? `${fields[current]}\n${line}`.trim()
        : line.trim();
    } else if (line.trim()) {
      unlabeled.push(line.trim());
    }
  }

  return { fields, unlabeled };
}

function mapFieldsToSlide(fields, unlabeled) {
  const titulo = (fields.titulo || '').trim();
  const headline = (fields.headline || '').trim();
  const subtitulo = (fields.subtitulo || '').trim();
  const cta = (fields.cta || '').trim();
  const legenda = (fields.legenda || '').trim();

  let title = '';
  let subtitle = '';
  let bodyAfterImage = '';

  if (headline && titulo && headline !== titulo) {
    title = headline;
    subtitle = [titulo, subtitulo].filter(Boolean).join('\n\n');
  } else {
    title = headline || titulo || unlabeled[0] || '';
    const restUnlabeled = headline || titulo ? unlabeled : unlabeled.slice(1);
    subtitle = subtitulo || restUnlabeled.join('\n');
  }

  if (cta) bodyAfterImage = cta;

  return {
    title: title.trim(),
    subtitle: subtitle.trim(),
    bodyAfterImage: bodyAfterImage.trim(),
    legenda: legenda.trim(),
  };
}

/**
 * Parseia texto bruto em cards + legenda do documento.
 * @returns {{ cards: Array<{title,subtitle,bodyAfterImage}>, caption: string, pageCount: number }}
 */
export function parseImportedText(raw) {
  const { pages, trailingCaption } = splitPages(raw);
  const cards = [];
  let caption = trailingCaption || '';

  for (const page of pages) {
    const { fields, unlabeled } = parseLabeledBlock(page);
    const mapped = mapFieldsToSlide(fields, unlabeled);
    if (mapped.legenda) {
      caption = caption ? `${caption}\n${mapped.legenda}` : mapped.legenda;
    }
    if (!mapped.title && !mapped.subtitle && !mapped.bodyAfterImage) continue;
    cards.push({
      title: mapped.title,
      subtitle: mapped.subtitle,
      bodyAfterImage: mapped.bodyAfterImage,
    });
  }

  return { cards, caption: caption.trim(), pageCount: pages.length };
}

/**
 * Aplica cards parseados aos slides: cria slides novos se faltar (sem teto).
 */
export function applyImportedTextToSlides(slides, parsed, mkSlideFn = mkSlide, brand = null, opts = {}) {
  const list = Array.isArray(slides) ? slides : [];
  const cards = Array.isArray(parsed?.cards) ? parsed.cards : [];
  if (!cards.length) return { slides: list, created: 0, updated: 0 };

  const isPresentation = !!opts.isPresentation;
  const next = [];
  let created = 0;
  let updated = 0;

  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i];
    const existing = i < list.length ? list[i] : null;
    let base = existing
      ? { ...existing, num: i + 1 }
      : {
          ...mkSlideFn(i + 1, brand),
          ...(isPresentation
            ? { layout: 'ml', align: 'left', photoRegion: 'full', showSwipeCue: false }
            : { layout: 'bl', align: 'left', photoRegion: 'full' }),
        };
    if (!existing) created += 1;
    else updated += 1;

    base = {
      ...base,
      num: i + 1,
      title: card.title || '',
      subtitle: card.subtitle || '',
      bodyAfterImage: card.bodyAfterImage || '',
      showSwipeCue: isPresentation ? false : (i < cards.length - 1),
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
Título: Nome curto do card
Headline: Gancho que prende em 1 linha
Subtítulo: Desenvolvimento do argumento em 2–4 frases.
CTA:

=== Card 2 ===
Título:
Headline: Segundo argumento
Subtítulo: Continuidade da narrativa.
CTA:

=== Card 3 ===
Título:
Headline: Fecho
Subtítulo: Síntese do que ficou claro.
CTA: Próximo passo concreto para o leitor.

LEGENDA:
Texto da legenda do post (fora dos cards). #hashtag1 #hashtag2
`;
