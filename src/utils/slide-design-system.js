/**
 * Design system de slide Instagram — tipografia, composições, safe zones.
 * Separado do chrome da app (DESIGN.md / Figma).
 */

/** Pairings curados — UI Marca mostra estes primeiro; resto fica em “Todas”. */
export const FONT_PAIRINGS = [
  {
    id: 'editorial_cultura',
    name: 'Editorial cultura',
    titleFont: '"Instrument Serif", serif',
    bodyFont: '"Inter Tight", sans-serif',
    textTitleWeight: 400,
    use: 'Tendência/Cultura',
  },
  {
    id: 'autoridade_b2b',
    name: 'Autoridade B2B',
    titleFont: '"Outfit", sans-serif',
    bodyFont: '"Inter", sans-serif',
    textTitleWeight: 700,
    use: 'Erro comum, case',
  },
  {
    id: 'hype_escuro',
    name: 'Hype escuro',
    titleFont: '"Syne", sans-serif',
    bodyFont: '"DM Sans", sans-serif',
    textTitleWeight: 700,
    use: 'Viral / promo',
  },
  {
    id: 'magazine_cream',
    name: 'Magazine cream',
    titleFont: '"Fraunces", serif',
    bodyFont: '"Source Sans 3", sans-serif',
    textTitleWeight: 600,
    use: 'Decodificação',
  },
  {
    id: 'minimal_clean',
    name: 'Minimal clean',
    titleFont: '"Inter Tight", sans-serif',
    bodyFont: '"Inter Tight", sans-serif',
    textTitleWeight: 700,
    use: 'How-to, checklist',
  },
];

/** Floor do AutoFit / OverflowScaler — abaixo disso o hook viral morre. */
export const AUTOFIT_MIN_SCALE = 0.85;

/** Tinta creme em fundos escuros (nunca branco puro no body). */
export const DARK_CREAM = {
  title: '#F2EDE4',
  subtitle: 'rgba(242,237,228,0.92)',
  body: 'rgba(242,237,228,0.84)',
  muted: 'rgba(242,237,228,0.54)',
};

/**
 * Escala tipográfica por papel do slide (@1080w).
 * titleSize/subSize são % sobre as bases do renderer (0.084·w / 0.028·w).
 */
export const TYPE_SCALE_BY_ROLE = {
  hook: { titleSize: 78, subSize: 100, titleLeading: 105, subLeading: 140 },
  miolo: { titleSize: 52, subSize: 105, titleLeading: 108, subLeading: 145 },
  sandwich: { titleSize: 48, subSize: 100, bodyAfterSize: 100, titleLeading: 110, subLeading: 145 },
  stat: { titleSize: 145, subSize: 95, titleLeading: 100, subLeading: 140 },
  quote: { titleSize: 62, subSize: 90, titleLeading: 112, subLeading: 150 },
  list: { titleSize: 55, subSize: 100, titleLeading: 108, subLeading: 145 },
  cta: { titleSize: 68, subSize: 100, titleLeading: 105, subLeading: 140 },
};

/**
 * Biblioteca de composições — ID partilhado por IA, templates e renderer.
 * `canvas` espelha variants já existentes no ViralCarrossel.
 */
export const COMPOSITIONS = {
  hook_fullbleed: {
    id: 'hook_fullbleed',
    label: 'Hook full-bleed',
    role: 'hook',
    canvasVariant: 'classic',
    zonesKey: 'cover',
    overlay: 62,
    showSwipeCue: true,
  },
  sandwich_editorial: {
    id: 'sandwich_editorial',
    label: 'Sanduíche editorial',
    role: 'sandwich',
    canvasVariant: 'sandwich',
    zonesKey: 'sandwich',
    overlay: 0,
    showSwipeCue: true,
  },
  stat_proof: {
    id: 'stat_proof',
    label: 'Stat proof',
    role: 'stat',
    canvasVariant: 'stat',
    zonesKey: 'stat',
    overlay: 0,
    showSwipeCue: true,
  },
  split_ab: {
    id: 'split_ab',
    label: 'Split A/B',
    role: 'miolo',
    canvasVariant: 'classic',
    zonesKey: 'classic',
    overlay: 45,
    showSwipeCue: true,
  },
  quote_pull: {
    id: 'quote_pull',
    label: 'Pull quote',
    role: 'quote',
    canvasVariant: 'classic',
    zonesKey: 'classic',
    overlay: 50,
    showSwipeCue: true,
  },
  list_beat: {
    id: 'list_beat',
    label: 'List beat',
    role: 'list',
    canvasVariant: 'classic',
    zonesKey: 'classic',
    overlay: 40,
    showSwipeCue: true,
  },
  reveal_bridge: {
    id: 'reveal_bridge',
    label: 'Reveal / bridge',
    role: 'miolo',
    canvasVariant: 'classic',
    zonesKey: 'cover',
    overlay: 55,
    showSwipeCue: true,
    edgePeek: true,
  },
  cta_close: {
    id: 'cta_close',
    label: 'CTA close',
    role: 'cta',
    canvasVariant: 'classic',
    zonesKey: 'cover',
    overlay: 58,
    showSwipeCue: false,
  },
};


/** Visual preset → pacote criativo sugerido (pele + arco). */
export const VISUAL_TO_CREATIVE_PRESET = {
  sports_editorial: 'quick_erro_comum',
  case_study_neon: 'quick_decodificacao',
  mood_sepia: 'quick_comportamento',
  bold_promo_rosa: 'quick_erro_comum',
  reflexivo_cream: 'quick_decodificacao',
  tabloid_keywords: 'quick_tendencia',
  editorial_magazine: 'tendencia_cultura',
  luxury_hybrid: 'quick_decodificacao',
  viral_hype_dark: 'quick_erro_comum',
  cinematic_hybrid: 'tendencia_cultura',
  authority_black: 'quick_erro_comum',
  minimal_clean: 'livre',
};

export function suggestCreativePresetForVisual(visualPresetId) {
  return VISUAL_TO_CREATIVE_PRESET[visualPresetId] || null;
}

/**
 * Ponte inversa, CURADA: pacote criativo → padrão visual que melhor veste
 * aquele arco. Não é a inversa mecânica de VISUAL_TO_CREATIVE_PRESET (vários
 * padrões partilham o mesmo pacote); é uma escolha editorial de 1-para-1 para
 * o picker poder marcar "combina com seu conteúdo".
 */
export const SUGGESTED_VISUAL_PRESET_BY_CREATIVE = {
  quick_erro_comum: 'authority_black',      // autoridade escura + ficha técnica
  quick_tendencia: 'tabloid_keywords',      // manchete de plantão + destaques
  quick_decodificacao: 'case_study_neon',   // estudo de caso com prova
  quick_comportamento: 'mood_sepia',        // reflexivo, quote-driven
  tendencia_cultura: 'editorial_magazine',  // capa de revista
};

export function suggestVisualPresetForCreative(creativePresetId) {
  return SUGGESTED_VISUAL_PRESET_BY_CREATIVE[creativePresetId] || null;
}

export function getComposition(id) {
  return COMPOSITIONS[id] || null;
}

export function typeScaleForRole(role) {
  return TYPE_SCALE_BY_ROLE[role] || TYPE_SCALE_BY_ROLE.miolo;
}

/**
 * Aplica composição + escala tipográfica a um slide (merge shallow).
 * `zones` devem ser passados pelo caller (defaults do ViralCarrossel).
 */
export function applyCompositionToSlide(slide, compositionId, zonesByKey = {}) {
  const comp = getComposition(compositionId);
  if (!comp) return { ...slide, composition: compositionId || slide.composition };
  const scale = typeScaleForRole(comp.role);
  const zones = zonesByKey[comp.zonesKey];
  const next = {
    ...slide,
    composition: comp.id,
    overlay: comp.overlay ?? slide.overlay,
    titleSize: scale.titleSize,
    subSize: scale.subSize,
    titleLeading: scale.titleLeading,
    subLeading: scale.subLeading,
    showSwipeCue: comp.showSwipeCue,
    edgePeek: !!comp.edgePeek,
  };
  if (scale.bodyAfterSize != null) next.bodyAfterSize = scale.bodyAfterSize;
  if (zones && comp.canvasVariant) {
    next.canvas = {
      enabled: true,
      variant: comp.canvasVariant,
      zones: { ...zones },
    };
  }
  return next;
}

/** Inferência de composição a partir da posição no arco (templates / geração). */
export function inferCompositionId({ index, total, hasPhoto, hasBodyAfter, isStat }) {
  if (index === 0) return 'hook_fullbleed';
  if (index === total - 1) return 'cta_close';
  if (isStat || (hasBodyAfter && !hasPhoto)) return 'stat_proof';
  if (hasBodyAfter && hasPhoto) return 'sandwich_editorial';
  if (index === Math.floor(total / 2) && hasPhoto) return 'reveal_bridge';
  return hasPhoto ? 'hook_fullbleed' : 'list_beat';
}

/** Fontes Google com peso máximo 700 — evita faux-bold 800. */
const FONTS_MAX_700 = [
  'Inter',
  'Inter Tight',
  'DM Sans',
  'Outfit',
  'Manrope',
  'Sora',
  'Plus Jakarta',
  'Source Sans',
  'IBM Plex',
  'Familjen',
  'Space Grotesk',
];

export function clampTitleWeight(fontFamily, weight) {
  const w = Number(weight) || 700;
  const face = String(fontFamily || '');
  const capped = FONTS_MAX_700.some((n) => face.includes(n));
  if (capped && w > 700) return 700;
  return Math.min(900, Math.max(400, w));
}

export function pairingMatchesBrand(brand, pairing) {
  if (!brand || !pairing) return false;
  return brand.titleFont === pairing.titleFont && brand.bodyFont === pairing.bodyFont;
}
