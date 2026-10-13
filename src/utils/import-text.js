/**
 * Importação de texto estruturado: 1 página/bloco = 1 card.
 * Interpreta rótulos (Título, Headline, Subtítulo, CTA, Legenda) — não os cola como texto cru.
 * Legenda por página → `slide.caption` (não desenha no card). LEGENDA global no fim → caption do post.
 */

import { mkSlide } from './doc-schema.js';

const SEPARATOR_LINE_RE = /^(?:-{3,}|={3,}.*|página\s*\d+\b.*|page\s*\d+\b.*|(?:card|slide)\s*\d+\b.*)$/i;

/**
 * Rótulos de campo. Ambíguos (gancho/corpo/abertura/texto) SÓ com `:` —
 * senão "Gancho forte" / "Abertura\nCorpo" viram campos por engano.
 */
const FIELD_TOKEN_RE =
  /\b(?:(call[\s-]?to[\s-]?action|subt[ií]tulo|subtitle|t[ií]tulo|headline|title|cta|chamada|fecho|convite|legenda|caption)\b\s*:?\s*|(gancho|hook|abertura|corpo|texto)\s*:\s*)/gi;

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

/**
 * Padrão visual premium ao importar: tipografia limpa, sem sombra/glow,
 * sem caixa atrás do texto, overlay só o necessário para foto.
 */
export const IMPORT_TEXT_VISUAL = Object.freeze({
  photoRegion: 'full',
  layout: 'mc',
  align: 'center',
  textShadow: false,
  textBg: false,
  textBgOpacity: 0,
  overlay: 28,
  elementsUnlocked: true,
  cultureTone: '',
  useCultureLayout: false,
  titleCase: 'normal',
  titleWeight: 600,
  titleLeading: 112,
  subLeading: 148,
  titleTracking: -0.5,
  subTracking: 0,
  titleSize: 100,
  subSize: 92,
  composition: '',
  edgePeek: false,
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
  // Rótulos claros: `:` opcional. Ambíguos (gancho/corpo/abertura) SÓ com `:`.
  out = out.replace(
    /^(?:(?:t[ií]tulo|title|headline|subt[ií]tulo|subtitle|cta|chamada|fecho|convite|legenda|caption)\s*:?\s+|(?:gancho|hook|abertura|corpo|texto)\s*:\s+)/i,
    '',
  );
  out = out.replace(
    /\s+\b(?:(?:t[ií]tulo|title|headline|subt[ií]tulo|subtitle|cta|chamada|legenda|caption)\b\s*:?\s+|(?:gancho|hook|abertura|corpo|texto)\s*:\s+)/gi,
    ' ',
  );
  return out.replace(/\s{2,}/g, ' ').trim();
}

function splitPages(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return { pages: [], trailingCaption: '' };

  let body = text;
  let trailingCaption = '';

  // LEGENDA no fim do documento (bloco dedicado)
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
    const token = m[1] || m[2];
    const field = fieldFromToken(token);
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
  const lines = h.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const last = lines[lines.length - 1];
    if (last === last.toLocaleUpperCase('pt-BR') && last.length <= 64 && /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(last)) {
      return { headline: lines.slice(0, -1).join('\n').trim(), theme: last };
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
  const legenda = scrubLabelLeak(fields.legenda);

  const unlabeledClean = unlabeled.map(scrubLabelLeak).filter(Boolean);

  if (headline) {
    const peeled = peelThemeFromHeadline(headline);
    headline = peeled.headline;
    if (peeled.theme && !titulo) titulo = peeled.theme;
  }

  let title = headline || titulo || unlabeledClean[0] || '';
  title = scrubLabelLeak(title);

  let subtitle = '';
  if (headline && titulo && headline !== titulo) {
    // Tema curto + subtítulo descritivo — tipografia limpa, sem amontoar labels
    subtitle = [titulo, subtitulo].filter(Boolean).join('\n');
  } else if (subtitulo) {
    subtitle = subtitulo;
  } else {
    subtitle = unlabeledClean.slice(1).join('\n');
  }
  subtitle = scrubLabelLeak(subtitle);

  return {
    title,
    subtitle,
    bodyAfterImage: cta,
    caption: legenda,
  };
}

/**
 * @returns {{ cards: Array<{title,subtitle,bodyAfterImage,caption}>, caption: string, pageCount: number }}
 */
export function parseImportedText(raw) {
  const { pages, trailingCaption } = splitPages(raw);
  const cards = [];
  // Só a LEGENDA global do documento vai para a caption do post.
  const docCaption = scrubLabelLeak(trailingCaption);

  for (const page of pages) {
    const { fields, unlabeled } = parseLabeledBlock(page);
    const mapped = mapFieldsToSlide(fields, unlabeled);
    if (!mapped.title && !mapped.subtitle && !mapped.bodyAfterImage && !mapped.caption) continue;
    cards.push({
      title: mapped.title,
      subtitle: mapped.subtitle,
      bodyAfterImage: mapped.bodyAfterImage,
      caption: mapped.caption,
    });
  }

  return {
    cards,
    caption: docCaption,
    pageCount: pages.length,
  };
}

/** Junta legendas dos cards para copiar / exportar o post. */
export function joinSlideCaptions(slides) {
  return (Array.isArray(slides) ? slides : [])
    .map((s) => String(s?.caption || '').trim())
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Aplica cards parseados aos slides + padrão visual premium de importação.
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
      : { ...mkSlideFn(i + 1, brand) };
    if (!existing) created += 1;
    else updated += 1;

    base = {
      ...base,
      num: i + 1,
      title: scrubLabelLeak(card.title || ''),
      subtitle: scrubLabelLeak(card.subtitle || ''),
      bodyAfterImage: scrubLabelLeak(card.bodyAfterImage || ''),
      caption: scrubLabelLeak(card.caption || ''),
      ...IMPORT_TEXT_VISUAL,
      layout: isPresentation ? 'ml' : 'mc',
      align: 'center',
      showSwipeCue: isPresentation ? false : !isClose,
      // Evita herdar sandwich cultura / tipografia gritada do card anterior
      useCultureLayout: false,
      textShadow: false,
      textBg: false,
      titleCase: 'normal',
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

/** Modelo técnico vazio — só rótulos (Headline, Título, Subtítulo, CTA, Legenda). */
export const IMPORT_TEXT_TEMPLATE = `=== Card 1 ===
Headline: 
Título: 
Subtítulo: 
CTA: 
Legenda: 

=== Card 2 ===
Headline: 
Título: 
Subtítulo: 
CTA: 
Legenda: 
`;
