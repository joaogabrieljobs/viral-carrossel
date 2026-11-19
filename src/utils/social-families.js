/**
 * Biblioteca de carrosséis — famílias visuais em dados declarativos.
 *
 * Independente da biblioteca de apresentações: outra proporção, outro ritmo
 * de leitura (polegar, não projetor) e outra sequência. A IA escolhe assunto e
 * função de cada card; geometria, escala, dispositivos gráficos e tratamento
 * de foto saem daqui. Cores vêm da marca efetiva (preset ou identidade do
 * usuário): a família define relações (chão invertido, acento, fio), não hex.
 *
 * Unidades: zonas em % do card; tipo em px numa largura de 1080 (os três
 * formatos sociais têm 1080 de largura).
 *
 * Entrelinha e tracking do título respeitam os mínimos calibrados por face em
 * tests/e2e/titulo-linhas-nao-colam.spec.js (acentos de caixa alta não podem
 * tocar a linha de cima; tracking final ≥ −0,025 em).
 */
import { FORMATS } from './formats.js';

export const SOCIAL_LIBRARY_VERSION = 4;

/** Funções de card — a sequência é montada com elas (social-sequence.js). */
export const SOCIAL_FUNCTIONS = Object.freeze([
  'cover', 'opener', 'development', 'photo', 'statement', 'list', 'comparison', 'closing',
]);

export const SOCIAL_FUNCTION_LABELS = Object.freeze({
  cover: 'Capa', opener: 'Abertura do argumento', development: 'Desenvolvimento', photo: 'Exemplo fotográfico',
  statement: 'Afirmação tipográfica', list: 'Lista / etapas', comparison: 'Comparação', closing: 'Encerramento',
});

const FF = {
  fraunces: '"Fraunces", serif', figtree: '"Figtree", sans-serif', anton: '"Anton", sans-serif',
  interTight: '"Inter Tight", sans-serif', archivo: '"Archivo", sans-serif', instrumentSerif: '"Instrument Serif", serif',
  inter: '"Inter", sans-serif', bodoni: '"Bodoni Moda", serif', jost: '"Jost", sans-serif',
  plexSans: '"IBM Plex Sans", sans-serif', plexMono: '"IBM Plex Mono", monospace', syne: '"Syne", sans-serif',
  dmSans: '"DM Sans", sans-serif', oswald: '"Oswald", sans-serif',
};

/**
 * Cada família:
 *  - type: fontes, pesos reais (nunca acima do que a fonte tem), caixa, tracking
 *  - brand: paleta padrão (substituída pela marca do usuário quando houver)
 *  - pick: arquétipo por função (com e sem foto)
 *  - scale: px do título por função; body/support em px
 *  - grounds: chão por função (ritmo da sequência)
 *  - photo: tratamento (filtro de lista fechada), moldura, raio, direção p/ prompt
 *  - devices: linguagem gráfica (ver chromeFor)
 */
export const SOCIAL_FAMILIES = Object.freeze({
  revista: {
    id: 'revista', label: 'Revista', presetId: 'social_revista',
    intent: 'Editorial com serifa óptica: chapéu, fio de revista, aspas, legenda e capa com foto em passe-partout.',
    type: { title: FF.fraunces, body: FF.figtree, titleWeight: 400, titleCase: 'normal', titleTracking: 1, titleLeading: 106, bodyWeight: 400, italicStatements: true },
    brand: { bg: '#F2EDE4', titleColor: '#1C1A17', subtitleColor: '#1C1A17', textColor: '#5A534B', accent: '#A8321E' },
    pick: { cover: ['coverFramed', 'coverType'], opener: 'opener', development: ['devRule', 'devColumn'], photo: ['photoStack', 'photoColumn'], statement: 'statementQuote', list: 'list', comparison: 'compare', closing: ['closingFramed', 'closingType'] },
    scale: { cover: 118, statement: 112, opener: 100, development: 92, photo: 80, list: 84, closing: 96, body: 44, support: 34 },
    grounds: { statement: 'surface' },
    photo: { filter: 'saturate(0.92) contrast(1.03) sepia(0.05)', frame: 'framed', radius: 0,
      directionEn: 'Editorial magazine photography: soft natural side light, paper and earth tones, subject on one third with clean negative space beside it.',
      direction: 'Fotografia editorial de revista: luz natural lateral, sombras macias, tons de papel e terra, assunto num terço com espaço negativo limpo ao lado.' },
    devices: 'revista',
  },
  manchete: {
    id: 'manchete', label: 'Manchete', presetId: 'social_manchete',
    intent: 'Tipografia expressiva de tabloide: palavra gigante, quebras desenhadas, faixas de cor e foto como recorte duro.',
    type: { title: FF.anton, body: FF.interTight, titleWeight: 400, titleCase: 'upper', titleTracking: 1, titleLeading: 122, bodyWeight: 400 },
    brand: { bg: '#0B0B0B', titleColor: '#FFFFFF', subtitleColor: '#FFFFFF', textColor: '#D9D9D9', accent: '#FF4D1F' },
    pick: { cover: ['coverBleed', 'coverType'], opener: 'openerMega', development: ['devMega', 'devRule'], photo: ['photoInset', 'photoStack'], statement: 'statementMega', list: 'list', comparison: 'compare', closing: ['closingBleed', 'closingMega'] },
    scale: { cover: 150, statement: 176, opener: 120, development: 112, photo: 104, list: 96, closing: 132, body: 44, support: 34 },
    grounds: { statement: 'accent', closing: 'inverse' },
    photo: { filter: 'grayscale(1) contrast(1.2)', frame: 'bleed', radius: 0,
      directionEn: 'Hard-cut high-contrast black and white photography: faces, hands, gestures or objects in close-up against a simple background that does not compete with type.',
      direction: 'Recortes duros em preto e branco de alto contraste: rostos, mãos, gestos, objetos em close; fundo simples para não competir com a palavra.' },
    devices: 'manchete',
  },
  grade: {
    id: 'grade', label: 'Grade suíça', presetId: 'social_grade',
    intent: 'Grade assimétrica, contraste extremo de escala, numeral de índice e um bloco de cor como gesto.',
    type: { title: FF.archivo, body: FF.archivo, titleWeight: 800, titleCase: 'normal', titleTracking: 1, titleLeading: 110, bodyWeight: 400 },
    brand: { bg: '#FFFFFF', titleColor: '#0A0A0A', subtitleColor: '#0A0A0A', textColor: '#4A4A45', accent: '#E3001B' },
    pick: { cover: ['coverGrid', 'coverGrid'], opener: 'openerIndex', development: ['devIndex', 'devIndex'], photo: ['photoGrid', 'photoGrid'], statement: 'statementBlock', list: 'listIndex', comparison: 'compare', closing: ['closingGrid', 'closingGrid'] },
    scale: { cover: 132, statement: 128, opener: 100, development: 92, photo: 84, list: 84, closing: 104, body: 42, support: 32 },
    grounds: { statement: 'accent' },
    photo: { filter: 'grayscale(1) contrast(1.12)', frame: 'module', radius: 0,
      directionEn: 'Architecture, objects and surfaces with clear geometry, frontal angle, hard shadow, plenty of plain sky or wall; must work in black and white.',
      direction: 'Arquitetura, objetos e superfícies com geometria clara, ângulo frontal, sombra dura, muito céu ou parede lisa; funciona em preto e branco.' },
    devices: 'grade',
  },
  documental: {
    id: 'documental', label: 'Documental', presetId: 'social_documental',
    intent: 'Fotografia protagonista: retrato e detalhe com legenda numerada, intervalo escuro entre capítulos.',
    type: { title: FF.instrumentSerif, body: FF.inter, titleWeight: 400, titleCase: 'normal', titleTracking: 1, titleLeading: 104, bodyWeight: 400, italicStatements: true },
    brand: { bg: '#F7F3EC', titleColor: '#1D1B18', subtitleColor: '#1D1B18', textColor: '#5F574F', accent: '#8C5A3C' },
    pick: { cover: ['coverBleed', 'coverType'], opener: 'opener', development: ['devRule', 'devRule'], photo: ['photoFramed', 'photoColumn'], statement: 'statementQuote', list: 'list', comparison: 'compare', closing: ['closingBleed', 'closingType'] },
    scale: { cover: 124, statement: 112, opener: 100, development: 92, photo: 80, list: 84, closing: 96, body: 44, support: 34 },
    grounds: { statement: 'inverse' },
    photo: { filter: 'saturate(1.02) contrast(1.02) sepia(0.04)', frame: 'framed', radius: 0,
      directionEn: 'Documentary photography: real people at work, half-body portraits, hands and craft details; window light, true skin, faces and hands fully inside the frame.',
      direction: 'Fotografia documental: pessoas reais trabalhando, retratos de meio corpo, mãos e detalhes de ofício; luz de janela, pele verdadeira, rosto e mãos inteiros no quadro.' },
    devices: 'documental',
  },
  produto: {
    id: 'produto', label: 'Produto', presetId: 'social_produto',
    intent: 'Luxo discreto: produto isolado em fundo sólido, serifa de alto contraste, moldura fina e muito silêncio.',
    type: { title: FF.bodoni, body: FF.jost, titleWeight: 400, titleCase: 'normal', titleTracking: 1, titleLeading: 108, bodyWeight: 400 },
    brand: { bg: '#16120E', titleColor: '#EFE8DC', subtitleColor: '#EFE8DC', textColor: '#B3A897', accent: '#C2A878' },
    pick: { cover: ['coverProduct', 'coverType'], opener: 'openerCenter', development: ['devCenter', 'devCenter'], photo: ['photoProduct', 'photoProduct'], statement: 'statementCenter', list: 'list', comparison: 'compare', closing: ['closingProduct', 'closingCenter'] },
    scale: { cover: 104, statement: 100, opener: 88, development: 80, photo: 72, list: 76, closing: 88, body: 42, support: 32 },
    grounds: { photo: 'surface', statement: 'inverse' },
    photo: { filter: 'saturate(0.8) contrast(1.05)', frame: 'product', radius: 0,
      directionEn: 'Product still life: the whole object centered and fully visible, plain dark or linen background, single raking light, soft shadow; nothing cropped at the edges, no text on the product.',
      direction: 'Still de produto: objeto inteiro e centralizado, fundo liso escuro ou linho, luz rasante única, sombra suave; nada cortado nas bordas, sem texto no produto.' },
    devices: 'produto',
  },
  ficha: {
    id: 'ficha', label: 'Ficha técnica', presetId: 'social_ficha',
    intent: 'Informação modular: rótulos monoespaçados, módulos com borda, números tabulares e comparação legível.',
    type: { title: FF.plexSans, body: FF.plexSans, label: FF.plexMono, titleWeight: 600, titleCase: 'normal', titleTracking: 1, titleLeading: 112, bodyWeight: 400 },
    brand: { bg: '#0F1115', titleColor: '#EEF0F3', subtitleColor: '#EEF0F3', textColor: '#A2A9B4', accent: '#C0FF32' },
    pick: { cover: ['coverModule', 'coverModule'], opener: 'openerModule', development: ['devModule', 'devModule'], photo: ['photoModule', 'photoModule'], statement: 'statementModule', list: 'listModule', comparison: 'compare', closing: ['closingModule', 'closingModule'] },
    scale: { cover: 104, statement: 104, opener: 88, development: 80, photo: 72, list: 76, closing: 88, body: 40, support: 30 },
    grounds: {},
    photo: { filter: 'grayscale(0.4) contrast(1.08)', frame: 'module', radius: 0,
      directionEn: 'Technical figure: screen, object, process or workspace, clean frontal framing, high contrast, dark background.',
      direction: 'Imagem como figura de ficha: tela, objeto, processo ou ambiente de trabalho, enquadramento frontal limpo, contraste alto e fundo escuro.' },
    devices: 'ficha',
  },
  minimal: {
    id: 'minimal', label: 'Minimal', presetId: 'social_minimal',
    intent: 'Uma ideia por página com muito ar, alinhamento rigoroso e um único fio.',
    type: { title: FF.interTight, body: FF.interTight, titleWeight: 600, titleCase: 'normal', titleTracking: 1, titleLeading: 114, bodyWeight: 400 },
    brand: { bg: '#FAFAF7', titleColor: '#0E0E0E', subtitleColor: '#1F1F1F', textColor: '#5B5B58', accent: '#0E0E0E' },
    pick: { cover: ['coverSplit', 'coverType'], opener: 'opener', development: ['devRule', 'devRule'], photo: ['photoStack', 'photoStack'], statement: 'statementLeft', list: 'list', comparison: 'compare', closing: ['coverSplit', 'closingType'] },
    scale: { cover: 108, statement: 116, opener: 96, development: 88, photo: 78, list: 80, closing: 92, body: 44, support: 34 },
    grounds: {},
    photo: { filter: 'saturate(0.95)', frame: 'bleed', radius: 0,
      directionEn: 'Clean bright photography, few elements, light and tidy background, sharp subject with generous empty space.',
      direction: 'Fotografia limpa e luminosa, poucos elementos, fundo claro e organizado, assunto nítido com bastante espaço livre.' },
    devices: 'minimal',
  },
  poster: {
    id: 'poster', label: 'Pôster', presetId: 'social_poster',
    intent: 'Cultura e promoção: blocos de cor, círculo, foto recortada com bloco deslocado e tipografia larga.',
    type: { title: FF.syne, body: FF.dmSans, titleWeight: 700, titleCase: 'normal', titleTracking: 1, titleLeading: 110, bodyWeight: 400 },
    brand: { bg: '#F1E9DC', titleColor: '#1C1A17', subtitleColor: '#1C1A17', textColor: '#4F4940', accent: '#E0245E' },
    pick: { cover: ['coverPoster', 'coverType'], opener: 'opener', development: ['devRule', 'devColumn'], photo: ['photoPoster', 'photoPoster'], statement: 'statementMega', list: 'list', comparison: 'compare', closing: ['closingPoster', 'closingType'] },
    scale: { cover: 118, statement: 132, opener: 100, development: 92, photo: 84, list: 84, closing: 100, body: 44, support: 34 },
    grounds: { statement: 'accent' },
    photo: { filter: 'contrast(1.06) saturate(1.05)', frame: 'offset', radius: 0,
      directionEn: 'Culture, events, studios and colourful objects; a figure that reads as a cut-out on a simple background, direct light, poster energy.',
      direction: 'Cultura, eventos, ateliês e objetos com cor; figura recortável sobre fundo simples, luz direta, energia de cartaz.' },
    devices: 'poster',
  },
  cinema: {
    id: 'cinema', label: 'Cinema', presetId: 'social_cinema',
    intent: 'Sequência de cenas: foto de ponta a ponta com faixa de letterbox, título condensado e cartela preta.',
    type: { title: FF.oswald, body: FF.inter, titleWeight: 600, titleCase: 'upper', titleTracking: 1, titleLeading: 120, bodyWeight: 400 },
    brand: { bg: '#0B0B0C', titleColor: '#F2EFE9', subtitleColor: '#F2EFE9', textColor: '#B1ACA3', accent: '#E8B04A' },
    pick: { cover: ['coverBleed', 'coverType'], opener: 'openerCenter', development: ['devRule', 'devRule'], photo: ['photoBleed', 'photoStack'], statement: 'statementCenter', list: 'list', comparison: 'compare', closing: ['closingBleed', 'closingCenter'] },
    scale: { cover: 132, statement: 116, opener: 100, development: 92, photo: 92, list: 84, closing: 104, body: 42, support: 32 },
    grounds: { statement: 'inverseDark' },
    photo: { filter: 'contrast(1.08) saturate(0.85) brightness(0.95)', frame: 'bleed', radius: 0,
      directionEn: 'Film still: wide scene, small human figure in the frame, golden hour or night with practical lights; low horizon, open sky for the title.',
      direction: 'Fotograma de filme: cena ampla, pessoa pequena no quadro, hora dourada ou noite com luz prática; horizonte baixo, céu livre para o título.' },
    devices: 'cinema',
  },
});

export const SOCIAL_FAMILY_KEYS = Object.freeze(Object.keys(SOCIAL_FAMILIES));

/** IDs salvos dos 12 estilos anteriores → família + paleta preservada. */
export const LEGACY_SOCIAL_STYLE_FAMILY = Object.freeze({
  sports_editorial: 'manchete', case_study_neon: 'ficha', mood_sepia: 'documental', bold_promo_rosa: 'poster',
  reflexivo_cream: 'revista', tabloid_keywords: 'manchete', editorial_magazine: 'revista', luxury_hybrid: 'produto',
  viral_hype_dark: 'manchete', cinematic_hybrid: 'cinema', authority_black: 'ficha', minimal_clean: 'minimal',
});

/** Família de uma identidade própria: decide pela fonte de título da marca. */
export function familyForBrand(brand = {}) {
  const f = String(brand.titleFont || '').toLowerCase();
  if (/anton|bebas|oswald|big shoulders|archivo black|barlow condensed/.test(f)) return 'manchete';
  if (/bodoni|didot|italiana|cormorant/.test(f)) return 'produto';
  if (/mono/.test(f)) return 'ficha';
  if (/serif|fraunces|playfair|garamond|newsreader|spectral|caslon|yeseva|dm serif|gloock|crimson/.test(f)) return 'revista';
  if (/syne|unbounded|righteous|lilita/.test(f)) return 'poster';
  return 'minimal';
}

export function socialFamilyFor(presetOrId, brand) {
  const id = typeof presetOrId === 'string' ? presetOrId : presetOrId?.id;
  const declared = typeof presetOrId === 'object' ? presetOrId?.socialFamily : null;
  if (declared && SOCIAL_FAMILIES[declared]) return declared;
  if (SOCIAL_FAMILIES[id]) return id;
  const byPreset = SOCIAL_FAMILY_KEYS.find((k) => SOCIAL_FAMILIES[k].presetId === id);
  if (byPreset) return byPreset;
  if (LEGACY_SOCIAL_STYLE_FAMILY[id]) return LEGACY_SOCIAL_STYLE_FAMILY[id];
  return familyForBrand(brand || (typeof presetOrId === 'object' ? presetOrId?.brand : {}));
}

/* ------------------------------------------------------------------ */
/* Formatos                                                            */
/* ------------------------------------------------------------------ */

/** Área útil por formato (%). Stories reserva as faixas da interface. */
export function formatFrame(formato = 'carrossel') {
  const f = FORMATS[formato] || FORMATS.carrossel;
  const key = FORMATS[formato] ? formato : 'carrossel';
  const kind = key === 'stories' ? 'tall' : key === 'quadrado' ? 'square' : 'feed';
  return {
    key, kind, w: f.w, h: f.h,
    e: 7.5,                                   // margem lateral
    // Topo: em Feed e Quadrado, 9% bastam (logo/cabeçalho cabem); Stories
    // usa a zona segura real da interface.
    t: kind === 'tall' ? f.topSafePct : kind === 'square' ? 9 : 8.5,
    b: kind === 'tall' ? f.bottomSafePct : kind === 'square' ? 9 : 8.5,
    py: (px) => (px / f.h) * 100,             // px → % da altura
  };
}

const z = (x, y, w, h) => ({ x: round(x), y: round(y), w: round(w), h: round(h) });
function round(v) { return Math.round(v * 100) / 100; }

/* ------------------------------------------------------------------ */
/* Arquétipos — geometria por formato                                  */
/* ------------------------------------------------------------------ */
/*
 * Cada arquétipo devolve { title, subtitle, photo?, evidence?, align, anchors,
 * scrim?, photoFit?, titleRole } em % do card. Recebem o quadro do formato
 * (F) e reorganizam a página para ele: no Quadrado, foto empilhada vira
 * coluna lateral; no Stories, o bloco de texto fica entre as faixas seguras.
 */
const A = {
  coverBleed: (F) => ({
    photo: z(0, 0, 100, 100), scrim: { mode: 'scrim', amount: 58 },
    title: z(F.e, F.kind === 'tall' ? 38 : 34, 100 - 2 * F.e, F.kind === 'square' ? 36 : 34),
    subtitle: z(F.e, (F.kind === 'tall' ? 38 : 34) + (F.kind === 'square' ? 37.5 : 35.5), 100 - 2 * F.e - 6, 100 - F.b - ((F.kind === 'tall' ? 38 : 34) + (F.kind === 'square' ? 37.5 : 35.5))),
    anchors: { title: 'end', subtitle: 'start' }, onPhoto: true,
  }),
  coverSplit: (F) => F.kind === 'square'
    ? { photo: z(50, 0, 50, 100), title: z(F.e, 22, 50 - F.e - 4, 44), subtitle: z(F.e, 68, 50 - F.e - 4, 100 - F.b - 68), anchors: { title: 'end', subtitle: 'start' } }
    : { photo: z(0, 0, 100, F.kind === 'tall' ? 52 : 54), title: z(F.e, (F.kind === 'tall' ? 52 : 54) + 4, 100 - 2 * F.e, F.kind === 'tall' ? 18 : 22), subtitle: z(F.e, (F.kind === 'tall' ? 52 : 54) + (F.kind === 'tall' ? 23 : 27), 100 - 2 * F.e, 100 - F.b - ((F.kind === 'tall' ? 52 : 54) + (F.kind === 'tall' ? 23 : 27))) },
  coverFramed: (F) => F.kind === 'square'
    ? { photo: z(F.e, F.t, 44, 100 - F.t - F.b), title: z(F.e + 48, F.t + 4, 100 - 2 * F.e - 48, 50), subtitle: z(F.e + 48, F.t + 56, 100 - 2 * F.e - 48, 100 - F.b - F.t - 56) }
    : { photo: z(F.e, F.t, 100 - 2 * F.e, F.kind === 'tall' ? 40 : 46), title: z(F.e, F.t + (F.kind === 'tall' ? 43 : 49), 100 - 2 * F.e, F.kind === 'tall' ? 16 : 19), subtitle: z(F.e, F.t + (F.kind === 'tall' ? 60 : 69), 100 - 2 * F.e, 100 - F.b - F.t - (F.kind === 'tall' ? 60 : 69)) },
  coverType: (F) => ({ title: z(F.e, F.t + 6, 100 - 2 * F.e, F.kind === 'square' ? 52 : 50), subtitle: z(F.e, F.t + (F.kind === 'square' ? 62 : 60), 100 - 2 * F.e - 10, 100 - F.b - F.t - (F.kind === 'square' ? 62 : 60)), anchors: { title: 'end', subtitle: 'start' } }),
  coverGrid: (F, photo) => photo
    ? (F.kind === 'square'
      ? { photo: z(52, F.t, 100 - 52 - F.e, 26), title: z(F.e, F.t + 28, 100 - 2 * F.e, 38), subtitle: z(46, F.t + 68, 100 - 46 - F.e, 100 - F.b - F.t - 68), anchors: { title: 'end', subtitle: 'start' } }
      : { photo: z(46, F.t, 100 - 46 - F.e, F.kind === 'tall' ? 30 : 34), title: z(F.e, F.kind === 'tall' ? 48 : 48, 100 - 2 * F.e, F.kind === 'tall' ? 22 : 26), subtitle: z(46, F.kind === 'tall' ? 72 : 77, 100 - 46 - F.e, 100 - F.b - (F.kind === 'tall' ? 72 : 77)), anchors: { title: 'end', subtitle: 'start' } })
    : { title: z(F.e, F.kind === 'square' ? 36 : 38, 100 - 2 * F.e, 36), subtitle: z(46, F.kind === 'square' ? 76 : 77, 100 - 46 - F.e, 100 - F.b - (F.kind === 'square' ? 76 : 77)), anchors: { title: 'end', subtitle: 'start' } },
  coverProduct: (F) => F.kind === 'square'
    ? { photo: z(18, F.t, 64, 54), photoFit: 'contain', title: z(F.e, F.t + 57, 100 - 2 * F.e, 18), subtitle: z(F.e + 8, F.t + 76, 100 - 2 * F.e - 16, 100 - F.b - F.t - 76), align: 'center' }
    : { photo: z(14, F.t + 2, 72, F.kind === 'tall' ? 42 : 48), photoFit: 'contain', title: z(F.e, F.t + (F.kind === 'tall' ? 47 : 53), 100 - 2 * F.e, F.kind === 'tall' ? 16 : 18), subtitle: z(F.e + 6, F.t + (F.kind === 'tall' ? 64 : 72), 100 - 2 * F.e - 12, 100 - F.b - F.t - (F.kind === 'tall' ? 64 : 72)), align: 'center' },
  coverModule: (F, photo) => photo
    ? (F.kind === 'square'
      ? { photo: z(F.e, F.t + 6, 40, 100 - F.t - F.b - 6), title: z(F.e + 44, F.t + 6, 100 - 2 * F.e - 44, 52), subtitle: z(F.e + 44, F.t + 60, 100 - 2 * F.e - 44, 100 - F.b - F.t - 60) }
      : { photo: z(F.e, F.t + 6, 100 - 2 * F.e, F.kind === 'tall' ? 32 : 36), title: z(F.e, F.t + (F.kind === 'tall' ? 41 : 45), 100 - 2 * F.e, F.kind === 'tall' ? 20 : 24), subtitle: z(F.e, F.t + (F.kind === 'tall' ? 62 : 70), 100 - 2 * F.e, 100 - F.b - F.t - (F.kind === 'tall' ? 62 : 70)) })
    : { title: z(F.e, F.t + 10, 100 - 2 * F.e, 44), subtitle: z(F.e, F.t + 58, 100 - 2 * F.e, 100 - F.b - F.t - 58) },
  coverPoster: (F) => F.kind === 'square'
    ? { photo: z(48, F.t + 4, 100 - 48 - F.e - 4, 58), title: z(F.e, F.t + 4, 40, 58), subtitle: z(F.e, F.t + 66, 100 - 2 * F.e, 100 - F.b - F.t - 66) }
    : { photo: z(F.e + 12, F.t + 2, 100 - 2 * F.e - 16, F.kind === 'tall' ? 36 : 40), title: z(F.e, F.t + (F.kind === 'tall' ? 42 : 47), 100 - 2 * F.e, F.kind === 'tall' ? 22 : 24), subtitle: z(F.e, F.t + (F.kind === 'tall' ? 65 : 72), 100 - 2 * F.e - 10, 100 - F.b - F.t - (F.kind === 'tall' ? 65 : 72)) },

  opener: (F) => ({ title: z(F.e, F.t + 8, 100 - 2 * F.e, F.kind === 'square' ? 34 : 30), subtitle: z(F.e, F.t + (F.kind === 'square' ? 46 : 42), 100 - 2 * F.e - 6, 100 - F.b - F.t - (F.kind === 'square' ? 46 : 42)) }),
  openerMega: (F) => ({ title: z(F.e, F.t + 4, 100 - 2 * F.e, F.kind === 'square' ? 50 : 46), subtitle: z(F.e, F.t + (F.kind === 'square' ? 58 : 54), 100 - 2 * F.e, 100 - F.b - F.t - (F.kind === 'square' ? 58 : 54)) }),
  openerIndex: (F) => ({ title: z(F.e, F.t + 26, 100 - 2 * F.e, 30), subtitle: z(F.kind === 'square' ? 40 : 34, F.t + 60, 100 - (F.kind === 'square' ? 40 : 34) - F.e, 100 - F.b - F.t - 60) }),
  openerCenter: (F) => ({ title: z(F.e + 4, F.kind === 'tall' ? 34 : 26, 100 - 2 * F.e - 8, 28), subtitle: z(F.e + 10, F.kind === 'tall' ? 64 : 58, 100 - 2 * F.e - 20, 100 - F.b - (F.kind === 'tall' ? 64 : 58)), align: 'center' }),
  openerModule: (F) => ({ title: z(F.e, F.t + 8, 100 - 2 * F.e, 28), subtitle: z(F.e + 3, F.t + 44, 100 - 2 * F.e - 6, 100 - F.b - F.t - 48) }),

  devRule: (F) => ({ title: z(F.e, F.t + 6, 100 - 2 * F.e, F.kind === 'square' ? 30 : 27), subtitle: z(F.e, F.t + (F.kind === 'square' ? 40 : 37), 100 - 2 * F.e - 4, 100 - F.b - F.t - (F.kind === 'square' ? 40 : 37)) }),
  devColumn: (F) => F.kind === 'tall'
    ? A.devRule(F)
    : { title: z(F.e, F.t + 6, 38, 100 - F.t - F.b - 6), subtitle: z(F.e + 44, F.t + 6, 100 - 2 * F.e - 44, 100 - F.t - F.b - 6) },
  devMega: (F) => ({ title: z(F.e, F.t + 4, 100 - 2 * F.e, F.kind === 'square' ? 46 : 44), subtitle: z(F.e, F.t + (F.kind === 'square' ? 54 : 52), 100 - 2 * F.e, 100 - F.b - F.t - (F.kind === 'square' ? 54 : 52)) }),
  devIndex: (F) => ({ title: z(F.e, F.t + 22, 100 - 2 * F.e, F.kind === 'square' ? 28 : 26), subtitle: z(F.kind === 'square' ? 40 : 30, F.t + (F.kind === 'square' ? 54 : 52), 100 - (F.kind === 'square' ? 40 : 30) - F.e, 100 - F.b - F.t - (F.kind === 'square' ? 54 : 52)) }),
  devCenter: (F) => ({ title: z(F.e + 4, F.t + 14, 100 - 2 * F.e - 8, 26), subtitle: z(F.e + 10, F.t + 46, 100 - 2 * F.e - 20, 100 - F.b - F.t - 46), align: 'center' }),
  devModule: (F) => ({ title: z(F.e, F.t + 8, 100 - 2 * F.e, 24), subtitle: z(F.e + 3, F.t + 38, 100 - 2 * F.e - 6, 100 - F.b - F.t - 42) }),

  photoStack: (F) => F.kind === 'square'
    ? { photo: z(0, 0, 50, 100), title: z(54, F.t, 100 - 54 - F.e, 40), subtitle: z(54, F.t + 43, 100 - 54 - F.e, 100 - F.t - F.b - 43) }
    : { photo: z(0, 0, 100, F.kind === 'tall' ? 50 : 50), title: z(F.e, F.kind === 'tall' ? 54 : 54, 100 - 2 * F.e, F.kind === 'tall' ? 14 : 17), subtitle: z(F.e, F.kind === 'tall' ? 69 : 72.5, 100 - 2 * F.e, 100 - F.b - (F.kind === 'tall' ? 69 : 72.5)) },
  photoColumn: (F) => F.kind === 'tall'
    ? A.photoStack(F)
    : { photo: z(0, 0, F.kind === 'square' ? 46 : 46, 100), title: z(51, F.t, 100 - 51 - F.e, 42), subtitle: z(51, F.t + 45, 100 - 51 - F.e, 100 - F.t - F.b - 45) },
  photoFramed: (F) => F.kind === 'square'
    ? { photo: z(F.e, F.t, 52, 100 - F.t - F.b - 6), title: z(F.e + 56, F.t, 100 - 2 * F.e - 56, 44), subtitle: z(F.e + 56, F.t + 47, 100 - 2 * F.e - 56, 100 - F.t - F.b - 47) }
    : { photo: z(F.e, F.t, 100 - 2 * F.e, F.kind === 'tall' ? 42 : 48), title: z(F.e, F.t + (F.kind === 'tall' ? 47 : 54), 100 - 2 * F.e, F.kind === 'tall' ? 13 : 15), subtitle: z(F.e, F.t + (F.kind === 'tall' ? 61 : 70), 100 - 2 * F.e, 100 - F.b - F.t - (F.kind === 'tall' ? 61 : 70)) },
  photoInset: (F) => F.kind === 'square'
    ? { photo: z(60, F.t, 100 - 60 - F.e, 40), title: z(F.e, F.t, 50, 56), subtitle: z(F.e, F.t + 60, 100 - 2 * F.e, 100 - F.t - F.b - 60) }
    : { photo: z(54, F.t, 100 - 54 - F.e, F.kind === 'tall' ? 26 : 30), title: z(F.e, F.t + (F.kind === 'tall' ? 30 : 34), 100 - 2 * F.e, F.kind === 'tall' ? 30 : 32), subtitle: z(F.e, F.t + (F.kind === 'tall' ? 62 : 68), 100 - 2 * F.e, 100 - F.b - F.t - (F.kind === 'tall' ? 62 : 68)) },
  photoGrid: (F) => F.kind === 'square'
    ? { photo: z(F.e, F.t, 100 - 2 * F.e, 40), title: z(F.e, F.t + 43, 100 - 2 * F.e, 17), subtitle: z(34, F.t + 62, 100 - 34 - F.e, 100 - F.b - F.t - 62) }
    : { photo: z(F.e, F.t, 100 - 2 * F.e, F.kind === 'tall' ? 38 : 44), title: z(F.e, F.t + (F.kind === 'tall' ? 41 : 47), 100 - 2 * F.e, F.kind === 'tall' ? 15 : 17), subtitle: z(34, F.t + (F.kind === 'tall' ? 58 : 66), 100 - 34 - F.e, 100 - F.b - F.t - (F.kind === 'tall' ? 58 : 66)) },
  photoProduct: (F) => F.kind === 'square'
    ? { photo: z(F.e, F.t, 50, 100 - F.t - F.b), photoFit: 'contain', title: z(F.e + 54, F.t + 10, 100 - 2 * F.e - 54, 36), subtitle: z(F.e + 54, F.t + 50, 100 - 2 * F.e - 54, 100 - F.t - F.b - 50) }
    : { photo: z(16, F.t, 68, F.kind === 'tall' ? 44 : 50), photoFit: 'contain', title: z(F.e, F.t + (F.kind === 'tall' ? 48 : 55), 100 - 2 * F.e, F.kind === 'tall' ? 13 : 14), subtitle: z(F.e + 8, F.t + (F.kind === 'tall' ? 62 : 70), 100 - 2 * F.e - 16, 100 - F.b - F.t - (F.kind === 'tall' ? 62 : 70)), align: 'center' },
  photoModule: (F) => F.kind === 'square'
    ? { photo: z(F.e, F.t + 6, 46, 100 - F.t - F.b - 6), title: z(F.e + 50, F.t + 6, 100 - 2 * F.e - 50, 38), subtitle: z(F.e + 50, F.t + 46, 100 - 2 * F.e - 50, 100 - F.t - F.b - 46) }
    : { photo: z(F.e, F.t + 6, 100 - 2 * F.e, F.kind === 'tall' ? 34 : 40), title: z(F.e, F.t + (F.kind === 'tall' ? 43 : 49), 100 - 2 * F.e, F.kind === 'tall' ? 14 : 16), subtitle: z(F.e, F.t + (F.kind === 'tall' ? 59 : 67), 100 - 2 * F.e, 100 - F.b - F.t - (F.kind === 'tall' ? 59 : 67)) },
  photoPoster: (F) => F.kind === 'square'
    ? { photo: z(F.e, F.t, 44, 64), title: z(F.e + 48, F.t, 100 - 2 * F.e - 48, 64), subtitle: z(F.e, F.t + 68, 100 - 2 * F.e, 100 - F.t - F.b - 68) }
    : { photo: z(F.e, F.t, 100 - 2 * F.e - 12, F.kind === 'tall' ? 40 : 46), title: z(F.e, F.t + (F.kind === 'tall' ? 45 : 52), 100 - 2 * F.e, F.kind === 'tall' ? 14 : 16), subtitle: z(F.e, F.t + (F.kind === 'tall' ? 60 : 69), 100 - 2 * F.e - 10, 100 - F.b - F.t - (F.kind === 'tall' ? 60 : 69)) },
  photoBleed: (F) => ({ ...A.coverBleed(F), scrim: { mode: 'scrim', amount: 52 } }),

  statementQuote: (F) => ({ title: z(F.e + 2, F.kind === 'tall' ? 30 : 22, 100 - 2 * F.e - 4, F.kind === 'tall' ? 36 : 46), subtitle: z(F.e + 2, F.kind === 'tall' ? 68 : 72, 100 - 2 * F.e - 20, 100 - F.b - (F.kind === 'tall' ? 68 : 72)), anchors: { title: 'end', subtitle: 'start' }, titleItalic: true }),
  statementMega: (F) => { const th = F.kind === 'square' ? 58 : F.kind === 'tall' ? 48 : 60; return { title: z(F.e, F.t, 100 - 2 * F.e, th), subtitle: z(F.e, F.t + th + 3, 100 - 2 * F.e - 10, 100 - F.b - F.t - th - 3), anchors: { title: 'end', subtitle: 'start' } }; },
  statementBlock: (F) => ({ title: z(F.e, F.kind === 'tall' ? 30 : 28, 100 - 2 * F.e, 40), subtitle: z(F.e, F.kind === 'tall' ? 72 : 71, 60, 100 - F.b - (F.kind === 'tall' ? 72 : 71)), anchors: { title: 'end', subtitle: 'start' } }),
  statementCenter: (F) => ({ title: z(F.e + 2, F.kind === 'tall' ? 32 : 26, 100 - 2 * F.e - 4, F.kind === 'tall' ? 32 : 38), subtitle: z(F.e + 12, F.kind === 'tall' ? 66 : 68, 100 - 2 * F.e - 24, 100 - F.b - (F.kind === 'tall' ? 66 : 68)), align: 'center', anchors: { title: 'end', subtitle: 'start' } }),
  statementLeft: (F) => ({ title: z(F.e, F.kind === 'tall' ? 30 : 24, 100 - 2 * F.e - 8, F.kind === 'tall' ? 36 : 44), subtitle: z(F.e, F.kind === 'tall' ? 68 : 72, 100 - 2 * F.e - 20, 100 - F.b - (F.kind === 'tall' ? 68 : 72)), anchors: { title: 'end', subtitle: 'start' } }),
  statementModule: (F) => ({ title: z(F.e + 4, F.kind === 'tall' ? 32 : 26, 100 - 2 * F.e - 8, F.kind === 'tall' ? 30 : 38), subtitle: z(F.e + 4, F.kind === 'tall' ? 64 : 68, 100 - 2 * F.e - 8, 100 - F.b - (F.kind === 'tall' ? 64 : 68) - 4), anchors: { title: 'end', subtitle: 'start' } }),

  list: (F) => ({ title: z(F.e, F.t + 4, 100 - 2 * F.e, F.kind === 'square' ? 22 : 20), subtitle: z(F.e, F.t + (F.kind === 'square' ? 29 : 27), 100 - 2 * F.e, 100 - F.b - F.t - (F.kind === 'square' ? 29 : 27)), evidence: z(F.e, F.t + (F.kind === 'square' ? 29 : 27), 100 - 2 * F.e, 100 - F.b - F.t - (F.kind === 'square' ? 29 : 27)) }),
  listIndex: (F) => ({ title: z(F.e, F.t + 4, 100 - 2 * F.e, 22), subtitle: z(F.kind === 'square' ? 30 : 22, F.t + 30, 100 - (F.kind === 'square' ? 30 : 22) - F.e, 100 - F.b - F.t - 30), evidence: z(F.e, F.t + 30, 100 - 2 * F.e, 100 - F.b - F.t - 30) }),
  listModule: (F) => ({ title: z(F.e, F.t + 6, 100 - 2 * F.e, 20), subtitle: z(F.e + 3, F.t + 32, 100 - 2 * F.e - 6, 100 - F.b - F.t - 36), evidence: z(F.e, F.t + 30, 100 - 2 * F.e, 100 - F.b - F.t - 30) }),
  compare: (F) => ({ title: z(F.e, F.t + 4, 100 - 2 * F.e, 18), subtitle: z(F.e, F.t + 23, 100 - 2 * F.e, F.kind === 'tall' ? 8 : 10), evidence: z(F.e, F.t + (F.kind === 'tall' ? 33 : 35), 100 - 2 * F.e, 100 - F.b - F.t - (F.kind === 'tall' ? 33 : 35)) }),

  closingType: (F) => ({ title: z(F.e, F.kind === 'tall' ? 30 : 24, 100 - 2 * F.e, F.kind === 'tall' ? 30 : 38), subtitle: z(F.e, F.kind === 'tall' ? 64 : 66, 100 - 2 * F.e - 14, 100 - F.b - (F.kind === 'tall' ? 64 : 66)), anchors: { title: 'end', subtitle: 'start' } }),
  closingMega: (F) => A.statementMega(F),
  closingCenter: (F) => A.statementCenter(F),
  closingFramed: (F) => A.coverFramed(F),
  closingBleed: (F) => ({ ...A.coverBleed(F), scrim: { mode: 'scrim', amount: 60 } }),
  closingGrid: (F, photo) => A.coverGrid(F, photo),
  closingProduct: (F) => A.coverProduct(F),
  closingModule: (F, photo) => A.coverModule(F, photo),
  closingPoster: (F) => A.coverPoster(F),
};

export const SOCIAL_ARCHETYPES = Object.freeze(Object.keys(A));

/**
 * Nenhum arquétipo entrega apoio com menos de 10% de altura: Stories e
 * Quadrado têm faixas seguras maiores e as frações do Feed não bastam. A
 * altura vem da foto acima (até 24% de foto) ou do título (até 12%).
 */
const MIN_SUPPORT = 10;
function reserveSupport(raw, usePhoto) {
  const S = raw.subtitle; const T = raw.title;
  const need = MIN_SUPPORT - S.h;
  if (!(need > 0) || T.y + T.h > S.y + 0.01) return raw;
  const P = usePhoto ? raw.photo : null;
  if (P && P.y + P.h <= T.y + 0.5 && P.h - need >= 24 && !raw.onPhoto) {
    return { ...raw, photo: z(P.x, P.y, P.w, P.h - need), title: z(T.x, T.y - need, T.w, T.h), subtitle: z(S.x, S.y - need, S.w, S.h + need) };
  }
  if (T.h - need >= 12) return { ...raw, title: z(T.x, T.y, T.w, T.h - need), subtitle: z(S.x, S.y - need, S.w, S.h + need) };
  return raw;
}

/** Dispositivos recalculados sobre as zonas finais (depois do ajuste de densidade). */
export function socialDevices(familyKey, fn, L, formato = 'carrossel', { photo = false, topReserve = 0 } = {}) {
  // L.hasSub / L.subUsed (altura real do apoio, em %) vêm do ajuste de densidade.
  const F = formatFrame(formato);
  if (topReserve > F.t) F.t = Math.min(topReserve, F.t + 8);
  return devicesFor(familyKey, fn, L, F, { photo });
}

/* ------------------------------------------------------------------ */
/* Linguagem gráfica                                                   */
/* ------------------------------------------------------------------ */
/*
 * Dispositivos declarativos (ver social-chrome.js). Cores são tokens da
 * marca: ink, body, muted, accent, ground, rule. Nada aqui é texto do
 * usuário: só numeração ({n}/{total}) e o nome da marca ({marca}) quando
 * cadastrado. Coordenadas acompanham as zonas, então seguem o formato.
 */
const rule = (x, y, w, h, color = 'rule', extra) => ({ t: 'rule', x, y, w, h, color, ...extra });
const block = (x, y, w, h, color, extra) => ({ t: 'block', x, y, w, h, color, ...extra });
const text = (x, y, w, value, extra) => ({ t: 'text', x, y, w, text: value, size: 26, color: 'muted', role: 'body', ...extra });

function devicesFor(familyKey, fn, L, F, { photo, index }) {
  const T = L.title; const S = L.subtitle; const P = L.photo;
  const top = Math.max(2.5, F.t - 4.5);
  const out = [];
  switch (SOCIAL_FAMILIES[familyKey].devices) {
    case 'revista':
      if (fn === 'statement') out.push(text(F.e, T.y - F.py(150), 20, '“', { size: 220, color: 'accent', role: 'title', leading: 1 }));
      else if (!L.onPhoto) {
        out.push(rule(F.e, top + 2.8, 100 - 2 * F.e, 0.1, 'ink'));
        out.push(text(F.e, top, 60, fn === 'cover' ? '{marca}' : '{n} — {total}', { size: 28, italic: true, role: 'title' }));
      }
      if (P && fn !== 'cover' && !L.onPhoto && P.y + P.h < 92) out.push(rule(P.x, P.y + P.h + 1.2, Math.min(18, P.w), 0.35, 'accent'));
      if (fn === 'cover' && !photo) out.push(rule(F.e, T.y + T.h + 1.4, 10, 0.4, 'accent'));
      break;
    case 'manchete':
      if (fn === 'statement' || fn === 'closing') out.push(text(F.e, 100 - F.b - 2, 30, '{n}/{total}', { size: 26, color: 'ink', role: 'body', weight: 600 }));
      if (!L.onPhoto && fn !== 'statement') out.push(block(F.e, T.y - 2.2, 16, F.kind === 'tall' ? 0.5 : 0.7, 'accent'));
      if (fn === 'development' && S.y - (T.y + T.h) >= 1.8) out.push(rule(F.e, (T.y + T.h + S.y) / 2, 100 - 2 * F.e, F.kind === 'tall' ? 0.2 : 0.25, 'ink'));
      if (fn === 'cover' && photo) out.push(block(F.e, T.y + T.h + 0.8, 26, F.kind === 'tall' ? 0.5 : 0.7, 'accent', { z: 'over' }));
      break;
    case 'grade':
      // Grade visível só nas margens (marcas de coluna), nunca atrás do texto.
      out.push({ t: 'grid', cols: 6, margin: F.e, color: 'rule', opacity: 0.5, bands: [[0, Math.max(1.5, F.t - 3)], [100 - Math.max(1.5, F.b - 3), 100]] });
      if ((fn === 'development' || fn === 'opener') && T.y - F.py(200) >= F.t - 1) out.push(text(F.e, T.y - F.py(200), 40, '{n}', { size: 180, color: 'accent', role: 'title', weight: 800, leading: 0.9 }));
      if (fn === 'cover') out.push(block(photo ? F.e : 60, F.t, photo ? 34 : 100 - 60 - F.e, photo ? (F.kind === 'square' ? 30 : 20) : 24, 'accent'));
      if (fn === 'photo' && P) out.push(block(P.x, P.y + P.h, 22, F.kind === 'tall' ? 0.6 : 0.9, 'accent'));
      if (fn === 'closing') out.push(block(F.e, F.t, 30, F.kind === 'tall' ? 0.6 : 1.2, 'accent'));
      break;
    case 'documental':
      if (P && !L.onPhoto) out.push(text(P.x, P.y + P.h + 0.8, 60, '{n} — {total}', { size: 21, italic: false, color: 'muted' }));
      if (!photo && fn !== 'statement') out.push(rule(F.e, T.y - 2.5, 12, 0.3, 'accent'));
      break;
    case 'produto':
      if (P && !L.onPhoto) out.push({ t: 'frame', x: P.x - 2, y: P.y - F.py(22), w: P.w + 4, h: P.h + F.py(44), color: 'accent', opacity: 0.6 });
      out.push(rule(50 - 4, (L.align === 'center' ? T.y : T.y) - 2.2, 8, 0.12, 'accent'));
      if (fn === 'cover' || fn === 'closing') out.push(text(F.e, 100 - F.b - 1.5, 100 - 2 * F.e, '{marca}', { size: 20, align: 'center', tracking: 24, case: 'upper', color: 'muted' }));
      break;
    case 'ficha':
      out.push(text(F.e, top, 70, fn === 'cover' ? '§{n} · {marca?}' : `§{n} · ${FICHA_LABEL[fn] || ''}`, { size: 25, color: 'accent', role: 'label', tracking: 4 }));
      if (!L.onPhoto && L.hasSub && ['opener', 'development', 'list'].includes(fn)) out.push({ t: 'frame', x: S.x - 3, y: S.y - 2, w: S.w + 6, h: Math.min(S.h, L.subUsed ?? S.h) + 4, color: 'rule' });
      if (P) out.push({ t: 'frame', x: P.x, y: P.y, w: P.w, h: P.h, color: 'accent', z: 'over', opacity: 0.9 });
      break;
    case 'minimal':
      if (!L.onPhoto) out.push(text(100 - F.e - 20, top, 20, '{n}', { size: 24, align: 'right', color: 'muted', role: 'body' }));
      if (fn === 'development' || fn === 'opener' || fn === 'list') out.push(rule(F.e, Math.max(T.y + T.h + 0.4, S.y - 1.4), 8, 0.15, 'ink'));
      break;
    case 'poster':
      if (P && fn !== 'cover' || (fn === 'cover' && P)) out.push(block(P.x + 3, P.y + F.py(40), P.w, P.h, 'accent'));
      if (fn === 'cover' || fn === 'closing') out.push({ t: 'circle', x: 100 - F.e - 22, y: F.kind === 'tall' ? 100 - F.b - 14 : 100 - F.b - 18, d: 20, color: 'accent', opacity: photo ? 0 : 1 });
      if (fn === 'development' || fn === 'opener') out.push({ t: 'circle', x: 100 - F.e - 10, y: F.t - 3, d: 9, color: 'accent' });
      break;
    case 'cinema':
      if (L.onPhoto) {
        out.push(block(0, 0, 100, F.kind === 'tall' ? 6 : 8, 'ground', { z: 'over' }));
        out.push(block(0, F.kind === 'tall' ? 94 : 92, 100, F.kind === 'tall' ? 6 : 8, 'ground', { z: 'over' }));
        out.push(text(F.e, F.kind === 'tall' ? 2.2 : 2.8, 40, 'CENA {n}', { size: 22, color: 'accent', tracking: 14, z: 'over', role: 'title' }));
      } else out.push(text(L.align === 'center' ? F.e : F.e, T.y - 3.6, L.align === 'center' ? 100 - 2 * F.e : 40, 'CENA {n}', { size: 22, color: 'accent', tracking: 14, role: 'title', align: L.align === 'center' ? 'center' : 'left' }));
      break;
    default:
  }
  return out;
}

const FICHA_LABEL = { opener: 'CONTEXTO', development: 'PONTO', photo: 'FIGURA', statement: 'TESE', list: 'ETAPAS', comparison: 'COMPARAÇÃO', closing: 'FECHO' };

/* ------------------------------------------------------------------ */
/* API                                                                  */
/* ------------------------------------------------------------------ */

/** Px de título por função (largura 1080). */
export function socialTitlePx(familyKey, fn) {
  const s = SOCIAL_FAMILIES[familyKey].scale;
  return s[fn] ?? s.development;
}

/**
 * Layout completo de um card.
 * @param {string} familyKey
 * @param {string} fn função do card
 * @param {{ formato?: string, photo?: boolean, structured?: boolean, variant?: number, index?: number }} opts
 */
export function socialCardLayout(familyKey, fn, { formato = 'carrossel', photo = false, structured = false, variant = 0, index = 0, topReserve = 0 } = {}) {
  const family = SOCIAL_FAMILIES[familyKey] || SOCIAL_FAMILIES.minimal;
  const F = formatFrame(formato);
  // Logo no topo: o conteúdo começa abaixo da faixa dela.
  if (topReserve > F.t) F.t = Math.min(topReserve, F.t + 8);
  const choice = family.pick[fn] ?? family.pick.development;
  let name;
  if (Array.isArray(choice)) {
    // cover/closing: [com foto, sem foto]; development/photo: alternância de ritmo.
    name = ['cover', 'closing'].includes(fn) ? (photo ? choice[0] : choice[1]) : choice[variant % choice.length];
  } else name = choice;
  // Função fotográfica sem foto não deixa moldura vazia: vira desenvolvimento.
  if (fn === 'photo' && !photo) return socialCardLayout(familyKey, 'development', { formato, photo: false, structured, variant, index, topReserve });
  let raw = A[name](F, photo);
  // A foto escolhida pela pessoa nunca some: se o arquétipo não tem área de
  // foto, o card usa o arquétipo fotográfico da família.
  if (photo && !raw.photo) {
    const alt = family.pick.photo;
    name = Array.isArray(alt) ? alt[0] : alt;
    raw = A[name](F, photo);
  }
  const usePhoto = photo && !!raw.photo;
  raw = reserveSupport(raw, usePhoto);
  const L = {
    family: family.id, fn, formato: F.key, archetype: name,
    align: raw.align || 'left',
    anchors: raw.anchors || { title: 'start', subtitle: 'start' },
    title: raw.title, subtitle: raw.subtitle,
    photo: usePhoto ? raw.photo : null,
    evidence: structured && raw.evidence ? raw.evidence : null,
    photoFit: raw.photoFit || 'cover',
    scrim: usePhoto && raw.scrim ? raw.scrim : null,
    onPhoto: usePhoto && !!raw.onPhoto,
    titleItalic: !!raw.titleItalic && !!family.type.italicStatements,
    ground: usePhoto && raw.onPhoto ? 'bg' : (family.grounds[fn] || 'bg'),
    titlePx: Math.round(socialTitlePx(family.id, fn) * (F.kind === 'square' ? 0.92 : 1)),
    // Lista/etapas: os itens são o conteúdo da página, em corpo de leitura maior.
    bodyPx: fn === 'list' ? Math.round(family.scale.body * 1.18) : family.scale.body, supportPx: family.scale.support,
  };
  // Página com quadro: o apoio vira uma linha de contexto acima dele.
  if (L.evidence && fn !== 'comparison') {
    L.subtitle = z(L.subtitle.x, L.subtitle.y, L.subtitle.w, Math.min(10, L.subtitle.h));
    L.evidence = z(L.evidence.x, L.subtitle.y + 11, L.evidence.w, L.evidence.h - 11);
  }
  // Sem foto, uma área prevista para a foto nunca fica vazia.
  if (!usePhoto && raw.photo && !['coverGrid', 'coverModule', 'closingGrid', 'closingModule'].includes(name)) {
    const alt = fn === 'cover' || fn === 'closing' ? (fn === 'cover' ? 'coverType' : 'closingType') : 'devRule';
    return { ...socialCardLayout(familyKey, fn === 'cover' || fn === 'closing' ? fn : 'development', { formato, photo: false, structured, variant: 0, index, topReserve }), archetype: alt };
  }
  L.chrome = devicesFor(family.id, fn, L, F, { photo: usePhoto, index });
  return L;
}

/** Conversões para os campos do renderer (`largura × 0,084 × titleSize%`). */
export const toTitleSize = (px) => Math.round((px / (1080 * 0.084)) * 1000) / 10;
export const toSubSize = (px) => Math.round((px / (1080 * 0.028)) * 1000) / 10;
export const toBodySize = (px) => Math.round((px / (1080 * 0.018)) * 1000) / 10;

/** Direção fotográfica da família (pt para revisão/UI; en para o gerador de imagem). */
export function socialPhotoDirection(familyKey, lang = 'pt') {
  const f = SOCIAL_FAMILIES[familyKey];
  if (!f) return '';
  return lang === 'en' ? f.photo.directionEn : f.photo.direction;
}
