// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import { Layout, X } from 'lucide-react';
import { SCHEMA_VERSION, migrateDoc } from './schema-migration.js';
import { hydrateBrandTextColors } from './brand-helpers.js';
import { FORMATS } from './formats.js';
import { clampTitleWeight } from './slide-design-system.js';
import { GEN_MODES, CREATIVE_PRESETS, SLIDE_TEXT_DENSITY_BY_ID } from './generation-prompts.js';
import { DEFAULT_SLIDE_TEXT_INSET } from './canvas-layout.js';

/** Preferência ao gerar / novo slide: só 4 modos clássicos (sem faixa fina). */
const CARD_VISUAL_STYLE_IDS = new Set(['full', 'inset_h_top', 'inset_h_middle', 'inset_h_bottom']);

const BG_PATTERN_IDS = new Set(['none', 'grid', 'dots', 'hlines', 'dlines', 'diag_grid']);

const uid = () => Math.random().toString(36).slice(2, 9);

/** Tipografia padrão da marca (`text*` no doc). Slides novos herdam via `mkSlide(n, brand)`. */
function typographyPatchFromBrand(brand) {
  const b = brand && typeof brand === 'object' ? brand : {};
  const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const tc = b.textTitleCase;
  const titleCase = tc === 'upper' || tc === 'lower' || tc === 'normal' ? tc : 'normal';
  let w = num(b.textTitleWeight, 700);
  w = clampTitleWeight(b.titleFont, w);
  return {
    titleSize: num(b.textTitleSize, 100),
    subSize: num(b.textSubSize, 100),
    bodyAfterSize: num(b.textBodyAfterSize, 100),
    titleTracking: num(b.textTitleTracking, 0),
    subTracking: num(b.textSubTracking, 0),
    titleLeading: num(b.textTitleLeading, 105),
    subLeading: num(b.textSubLeading, 150),
    titleWeight: w,
    titleCase,
  };
}

const mkSlide = (n = 1, brand = null) => {
  const t = typographyPatchFromBrand(brand);
  return {
  id: uid(), num: n,
  title: 'Seu título aqui',
  subtitle: 'Subtítulo descritivo que reforça o gancho principal do carrossel.',
  layout: 'mc', align: 'center',
  bgImage: null, imageQuery: '',
  /** Vídeo de fundo (mutually exclusive c/ bgImage). Guardado em IndexedDB pelo id;
   *  o blob URL é regenerado a cada load da app via useVideoLoader. */
  videoId: null,
  videoMime: null,
  videoName: null,
  /** Campo opcional `presentationImgAdjust` (tela cheia) — não definido em slides novos; ver FullscreenViewer. */
  /** Data URL ou URL https — enviada à API de imagem como referência (produto, pack, moodboard). */
  refImage: null,
  /** Instruções extras por slide (marca, packshot, cor de fundo) — entram no prompt Web trend e GPT Image. */
  imgExtraPrompt: '',
  imgMode: 'dalle',
  bgX: 50, bgY: 50, bgZoom: 100,
  /** 'cover' = preenche o card | 'contain' = imagem inteira visível | 'custom' = zoom % legado */
  bgFit: 'cover',
  bgOpacity: 100, bgMirror: false,
  /**
   * Layout clássico: `full` = foto a fundo atrás do texto.
   * `inset_h_*` = faixa com margens e cantos arredondados (só sem canvas e sem sanduíche cultura).
   */
  photoRegion: 'full',
  overlay: 60, titleSize: t.titleSize, subSize: t.subSize,
  /** Textura opcional sobre cor/foto do card (exportada). */
  bgPattern: 'none',
  /** Tamanho do bloco de texto abaixo da foto (sanduíche / Cultura). Default = subtítulo. */
  bodyAfterSize: t.bodyAfterSize,
  customBg: null, showHandle: true,
  /**
   * Deslocamento livre de cada elemento (arrasto direto na pré-visualização),
   * em % das dimensões do card. `{}` = tudo no lugar do layout.
   * Ver src/utils/card-elements.js.
   */
  elementOffsets: {},
  // text-on-image controls
  textShadow: false,  // drop shadow — desligado por defeito (toggle «Sombra no texto»)
  textBg: false,      // pill/box background behind text block
  textBgOpacity: 55,  // opacity of that box (0-100)
  textInset: DEFAULT_SLIDE_TEXT_INSET, // padding multiplier — how far from edges (1-20)
  // typography controls (valores iniciais da marca; por slide em Cards)
  titleTracking: t.titleTracking,
  subTracking: t.subTracking,
  titleLeading: t.titleLeading,
  subLeading: t.subLeading,
  titleCase: t.titleCase,
  titleWeight: t.titleWeight,
  /** Bloco inferior (modo Tendência/Cultura — layout “sandwich”: texto · imagem inline · texto). */
  bodyAfterImage: '',
  /** '' = auto por índice do slide · 'light' | 'dark' | 'accent' força superfície no sandwich/stat. */
  cultureTone: '',
  /**
   * Editor tipo canvas — zonas em % do card (0–100). `null` = layout fluido legado.
   * variant: 'classic' (foto full / texto) | 'sandwich' | 'stat'
   */
  canvas: null,
  /** Composition ID (slide-design-system) — hook_fullbleed, sandwich_editorial, etc. */
  composition: '',
  /** Cue → na borda direita (swipe). Default on excepto CTA. */
  showSwipeCue: true,
  /** Peek visual na borda (reveal_bridge / panorama leve). */
  edgePeek: false,
  /** Intervalos UTF-16 [início,fim exclusivo) na cor Destaques — texto bruto sem marcadores asterisco. */
  destaqueSpans: undefined,
};
};

const DEFAULT_BRAND = {
  id: 'default',
  name: 'Padrão',
  handle: '', showHandle: false,
  /** Posição da pílula @ no card (0–100% da largura / altura; referência = canto sup. esq. do badge). */
  handleBadgeX: 5,
  handleBadgeY: 4,
  /* Visual neutro: quadro Figma (preto/branco); pairing Autoridade B2B por defeito. */
  titleFont: '"Outfit", sans-serif',
  bodyFont: '"Inter", sans-serif',
  bg: '#fafafc',
  titleColor: '#000000',
  /** Linha curta sob o título nos cards do meio (nem capa nem fecho). */
  subtitleColor: '#363636',
  /** Parágrafos / corpo (ex-bloco «Subtítulo» da marca). */
  textColor: '#363636',
  accent: '#000000',
  /** Cue → entre slides (exceto último). */
  showSwipeCue: true,
  /** Ímpar (slides 1,3…) = `bg` · Par (2,4…) = `bgAlternate` quando activo e cor definida. */
  interleaveBg: false,
  /** Segunda cor de fundo para intercalção (margem/pérola por defeito). */
  bgAlternate: '#f5f5f7',
  // Identidade verbal — usada como contexto em todas as gerações de IA
  bio: '',
  positioning: '',
  defaultTone: '',
  defaultAudience: '',
  signature: '',
  links: '',
  // Logo (data URL) — aplicado automaticamente nos slides quando setado
  logo: null,
  /** Foto do perfil no badge @ (data URL) — substitui o ícone decorativo circular */
  handleAvatar: null,
  /** Enquadramento da foto dentro do círculo do badge (0–100 = object-position %). */
  handleAvatarPosX: 50,
  handleAvatarPosY: 50,
  /** Rotação da foto no badge (graus, 0–360). */
  handleAvatarRotate: 0,
  /** Zoom dentro do círculo (100 = neutro; >100 aproxima). */
  handleAvatarZoom: 100,
  /** Tipografia padrão dos slides (aba Marca → Texto nos slides). */
  textTitleSize: 100,
  textSubSize: 100,
  textBodyAfterSize: 100,
  textTitleTracking: 0,
  textSubTracking: 0,
  textTitleLeading: 105,
  textSubLeading: 150,
  textTitleWeight: 700,
  textTitleCase: 'normal',
  /** Fonte própria (título) — { dataUrl, format, fileName } */
  customTitleFont: null,
  /** Fonte própria (corpo / subtítulo) */
  customBodyFont: null,
  logoSize: 30,           // tamanho do logo em px na escala real (1080px)
  logoPosition: 'tr',     // canto: 'tl' | 'tr' | 'bl' | 'br'
  logoOpacity: 90,        // 0-100
  /** Barra editorial fina no topo dos cards (modo Tendência/Cultura) — opcional. */
  cultureHeaderLeft: '',
  /** Ex.: 2026 — mostrado como “2026 //” à direita da barra. */
  cultureHeaderYear: '',
};

/** Fundo do card (sem foto custom por slide): ímpar → `bg`, par → `bgAlternate` quando «Intercalar fundo» está ligado. `slideIndex0` = 0 para o 1.º card. */
const DEFAULT_DOC = {
  fmt: 'carrossel',
  brand: DEFAULT_BRAND,
  slides: [mkSlide(1, DEFAULT_BRAND)],
  caption: '',
  // Material de referência usado pela IA na geração e refinamento de slides
  material: {
    content: '',     // texto base do post (rascunho, transcrição, anotação livre)
    sources: '',     // fontes/referências (URLs, papers, citações), texto livre uma por linha
    context: '',     // instruções extras pra IA ("evite X", "foque em Y", "mencione Z")
    refProfileId: null, // um dos REFERENCE_PROFILES.id — voz de referência curada
  },
  // Direção de imagem — 4 eixos 0..100 que viram modificadores do prompt do GPT Image (OpenAI).
  imgParams: {
    fidelity:    50,  // 0=metafórico/indireto · 100=literal/direto ao tema
    creativity:  50,  // 0=convencional · 100=composição inusitada/conceitual
    irreverence: 50,  // 0=sério/sóbrio · 100=irreverente/cheeky
    objectivity: 50,  // 0=atmosférico/abstrato · 100=documentário/factual
  },
  // Modo narrativo padrão. Persistido entre sessões pra que o usuário
  // não precise reescolher toda vez. Um dos GEN_MODES.id.
  mode: 'editorial',
  // Pacote criativo da IA — default personalizado (id interno `livre`) ou Tendência/Cultura.
  creativePreset: 'livre',
  /** Volume de texto alvo nos cards ao gerar/refinar — 1/1 … 1/5 (fracionado). */
  slideTextDensity: '1_1',
  /** Região da foto por defeito nos slides gerados / novos (`photoRegion`). */
  cardVisualStyle: 'full',
};

/** URLs de demo que ficaram presas em docs persistidos — removidas de «Fontes & referências» ao hidratar. */
const STALE_MATERIAL_SOURCE_MARKERS = [
  'scielo.br/j/csc/a/dYG5hm6GvzMT6pLXVySYSyv',
];

function tokenLooksLikeStaleMaterialSource(tok) {
  const t = String(tok).trim().toLowerCase();
  if (!t) return false;
  return STALE_MATERIAL_SOURCE_MARKERS.some((m) => t.includes(m.toLowerCase()));
}

/** Retira tokens de URL legadas (linhas ou espaço-separados) sem mexer no resto do texto. */
function scrubStaleMaterialSources(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return typeof raw === 'string' ? raw : '';
  const lines = raw.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push('');
      continue;
    }
    const tokens = trimmed.split(/\s+/).filter((tok) => !tokenLooksLikeStaleMaterialSource(tok));
    const joined = tokens.join(' ').trim();
    if (joined) out.push(joined);
  }
  let s = out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
  return s;
}

function ensureDocShape(d) {
  if (!d || typeof d !== 'object') {
    return { ...JSON.parse(JSON.stringify(DEFAULT_DOC)), __v: SCHEMA_VERSION };
  }
  const migrated = migrateDoc(d);
  const out = {
    ...DEFAULT_DOC,
    ...migrated,
    __v: SCHEMA_VERSION,
    brand: hydrateBrandTextColors({ ...DEFAULT_BRAND, ...(migrated.brand && typeof migrated.brand === 'object' ? migrated.brand : {}) }),
    material: { ...DEFAULT_DOC.material, ...(migrated.material && typeof migrated.material === 'object' ? migrated.material : {}) },
    imgParams: { ...DEFAULT_DOC.imgParams, ...(migrated.imgParams && typeof migrated.imgParams === 'object' ? migrated.imgParams : {}) },
  };
  out.material.sources = scrubStaleMaterialSources(
    typeof out.material.sources === 'string' ? out.material.sources : ''
  );
  if (!Array.isArray(out.slides) || out.slides.length === 0) {
    out.slides = [mkSlide(1, out.brand)];
  } else {
    out.slides = out.slides.map((sl) => {
      if (!sl || typeof sl !== 'object') return mkSlide(1, out.brand);
      const bp = sl.bgPattern;
      return { ...sl, bgPattern: BG_PATTERN_IDS.has(bp) ? bp : 'none' };
    });
  }
  if (!FORMATS[out.fmt]) out.fmt = 'carrossel';
  if (!out.mode) out.mode = 'editorial';
  if (out.creativePreset == null) out.creativePreset = 'livre';
  if (out.creativePreset === 'estudio_editorial') out.creativePreset = 'tendencia_cultura';
  if (!CREATIVE_PRESETS.some(p => p.id === out.creativePreset)) out.creativePreset = 'livre';
  if (out.slideTextDensity == null) out.slideTextDensity = '1_1';
  if (!SLIDE_TEXT_DENSITY_BY_ID[out.slideTextDensity]) out.slideTextDensity = '1_1';
  if (out.cardVisualStyle == null) out.cardVisualStyle = 'full';
  if (!CARD_VISUAL_STYLE_IDS.has(out.cardVisualStyle)) out.cardVisualStyle = 'full';
  if (typeof out.caption !== 'string') out.caption = '';
  return out;
}

export {
  CARD_VISUAL_STYLE_IDS,
  BG_PATTERN_IDS,
  uid,
  typographyPatchFromBrand,
  mkSlide,
  DEFAULT_BRAND,
  DEFAULT_DOC,
  STALE_MATERIAL_SOURCE_MARKERS,
  tokenLooksLikeStaleMaterialSource,
  scrubStaleMaterialSources,
  ensureDocShape,
};
