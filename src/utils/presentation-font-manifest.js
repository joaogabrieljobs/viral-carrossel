/**
 * Fontes da biblioteca de templates 2.0 — todas SIL Open Font License 1.1,
 * distribuídas pelo Google Fonts (repositório google/fonts, pasta ofl/).
 * A licença permite uso comercial, embutir em PDF/imagem e redistribuir com o
 * aplicativo; não permite vender as fontes isoladamente.
 *
 * No app completo, ensurePresentationFonts declara as faces WOFF locais
 * compartilhadas pelo Studio e pela exportação. O URL Google abaixo fica
 * disponível para consumidores externos que não tenham os arquivos locais.
 */
export const PRESENTATION_LIBRARY_FONTS = Object.freeze([
  { family: 'Fraunces', axes: 'ital,opsz,wght@0,9..144,300..700;1,9..144,300..700', license: 'OFL-1.1', source: 'https://github.com/undercasetype/Fraunces' },
  { family: 'Source Serif 4', axes: 'ital,opsz,wght@0,8..60,400..700;1,8..60,400..700', license: 'OFL-1.1', source: 'https://github.com/adobe-fonts/source-serif' },
  { family: 'Inter Tight', axes: 'wght@500..700', license: 'OFL-1.1', source: 'https://github.com/rsms/inter-tight' },
  { family: 'Inter', axes: 'wght@400..600', license: 'OFL-1.1', source: 'https://github.com/rsms/inter' },
  { family: 'Archivo', axes: 'wght@400..800', license: 'OFL-1.1', source: 'https://github.com/Omnibus-Type/Archivo' },
  { family: 'Barlow Condensed', axes: 'wght@500;600', license: 'OFL-1.1', source: 'https://github.com/jpt/barlow' },
  { family: 'Barlow', axes: 'wght@400;500', license: 'OFL-1.1', source: 'https://github.com/jpt/barlow' },
  { family: 'Bodoni Moda', axes: 'ital,opsz,wght@0,6..96,400..500;1,6..96,400..500', license: 'OFL-1.1', source: 'https://github.com/indestructible-type/Bodoni' },
  { family: 'Jost', axes: 'wght@400..500', license: 'OFL-1.1', source: 'https://github.com/indestructible-type/Jost' },
  { family: 'Anton', axes: '', license: 'OFL-1.1', source: 'https://github.com/googlefonts/AntonFont' },
  { family: 'Space Grotesk', axes: 'wght@400..700', license: 'OFL-1.1', source: 'https://github.com/floriankarsten/space-grotesk' },
  { family: 'Syne', axes: 'wght@600..800', license: 'OFL-1.1', source: 'https://gitlab.com/bonjour-monde/fonderie/syne-typeface' },
  { family: 'DM Sans', axes: 'opsz,wght@9..40,400..700', license: 'OFL-1.1', source: 'https://github.com/googlefonts/dm-fonts' },
  { family: 'IBM Plex Sans', axes: 'wght@400..600', license: 'OFL-1.1', source: 'https://github.com/IBM/plex' },
  { family: 'IBM Plex Mono', axes: 'wght@400;500', license: 'OFL-1.1', source: 'https://github.com/IBM/plex' },
  { family: 'Instrument Serif', axes: 'ital@0;1', license: 'OFL-1.1', source: 'https://github.com/Instrument/instrument-serif' },
  { family: 'Instrument Sans', axes: 'wght@400..600', license: 'OFL-1.1', source: 'https://github.com/Instrument/instrument-sans' },
  { family: 'Plus Jakarta Sans', axes: 'wght@400..800', license: 'OFL-1.1', source: 'https://github.com/tokotype/PlusJakartaSans' },
]);

export const PRESENTATION_FONTS_CSS_URL = `https://fonts.googleapis.com/css2?${PRESENTATION_LIBRARY_FONTS
  .map((f) => `family=${encodeURIComponent(f.family).replace(/%20/g, '+')}${f.axes ? `:${f.axes}` : ''}`)
  .join('&')}&display=swap`;

/** Faces locais compartilhadas pelo Studio e pela árvore de exportação. */
export const PRESENTATION_FONT_FACES = Object.freeze([
  {
    "family": "Fraunces",
    "file": "Fraunces.woff",
    "weight": "100 900",
    "style": "normal"
  },
  {
    "family": "Fraunces",
    "file": "Fraunces-Italic.woff",
    "weight": "100 900",
    "style": "italic"
  },
  {
    "family": "Source Serif 4",
    "file": "SourceSerif4.woff",
    "weight": "200 900",
    "style": "normal"
  },
  {
    "family": "Source Serif 4",
    "file": "SourceSerif4-Italic.woff",
    "weight": "200 900",
    "style": "italic"
  },
  {
    "family": "Inter Tight",
    "file": "InterTight.woff",
    "weight": "100 900",
    "style": "normal"
  },
  {
    "family": "Inter",
    "file": "Inter.woff",
    "weight": "100 900",
    "style": "normal"
  },
  {
    "family": "Archivo",
    "file": "Archivo.woff",
    "weight": "100 900",
    "style": "normal"
  },
  {
    "family": "Barlow Condensed",
    "file": "BarlowCondensed-Medium.woff",
    "weight": "500",
    "style": "normal"
  },
  {
    "family": "Barlow Condensed",
    "file": "BarlowCondensed-SemiBold.woff",
    "weight": "600",
    "style": "normal"
  },
  {
    "family": "Barlow",
    "file": "Barlow-Regular.woff",
    "weight": "400",
    "style": "normal"
  },
  {
    "family": "Barlow",
    "file": "Barlow-Medium.woff",
    "weight": "500",
    "style": "normal"
  },
  {
    "family": "Bodoni Moda",
    "file": "BodoniModa.woff",
    "weight": "400 900",
    "style": "normal"
  },
  {
    "family": "Bodoni Moda",
    "file": "BodoniModa-Italic.woff",
    "weight": "400 900",
    "style": "italic"
  },
  {
    "family": "Jost",
    "file": "Jost.woff",
    "weight": "100 900",
    "style": "normal"
  },
  {
    "family": "Anton",
    "file": "Anton-Regular.woff",
    "weight": "400",
    "style": "normal"
  },
  {
    "family": "Space Grotesk",
    "file": "SpaceGrotesk.woff",
    "weight": "300 700",
    "style": "normal"
  },
  {
    "family": "Syne",
    "file": "Syne.woff",
    "weight": "400 800",
    "style": "normal"
  },
  {
    "family": "DM Sans",
    "file": "DMSans.woff",
    "weight": "100 1000",
    "style": "normal"
  },
  {
    "family": "IBM Plex Sans",
    "file": "IBMPlexSans.woff",
    "weight": "100 700",
    "style": "normal"
  },
  {
    "family": "IBM Plex Mono",
    "file": "IBMPlexMono-Regular.woff",
    "weight": "400",
    "style": "normal"
  },
  {
    "family": "IBM Plex Mono",
    "file": "IBMPlexMono-Medium.woff",
    "weight": "500",
    "style": "normal"
  },
  {
    "family": "Instrument Serif",
    "file": "InstrumentSerif-Regular.woff",
    "weight": "400",
    "style": "normal"
  },
  {
    "family": "Instrument Serif",
    "file": "InstrumentSerif-Italic.woff",
    "weight": "400",
    "style": "italic"
  },
  {
    "family": "Instrument Sans",
    "file": "InstrumentSans.woff",
    "weight": "400 700",
    "style": "normal"
  },
  {
    "family": "Plus Jakarta Sans",
    "file": "PlusJakartaSans.woff",
    "weight": "200 800",
    "style": "normal"
  }
]);

export const PRESENTATION_FONT_STYLE_ID = 'vc-presentation-fonts';
export const PRESENTATION_FONT_CSS = PRESENTATION_FONT_FACES.map(face =>
  `@font-face{font-family:"${face.family}";src:url("/fonts/presentation/${face.file}") format("woff");font-weight:${face.weight};font-style:${face.style};font-display:swap}`
).join('\n');

/** Declara as faces antes de fonts.load(), sem aguardar uma folha externa. */
export function ensurePresentationFonts(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc?.head || !doc.createElement) return null;
  const existing = doc.getElementById(PRESENTATION_FONT_STYLE_ID);
  if (existing) return existing;
  const style = doc.createElement('style');
  style.id = PRESENTATION_FONT_STYLE_ID;
  style.textContent = PRESENTATION_FONT_CSS;
  doc.head.appendChild(style);
  return style;
}
