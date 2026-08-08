import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import {
  Sparkles, Search, Download, Trash2, Copy,
  Plus, Palette, Layout, LayoutGrid, Crop, Wand2, Loader2,
  Bookmark, Shuffle, Lock, Move, FlipHorizontal2, RotateCcw,
  Video, Film,
  TrendingUp, RefreshCw, X, Upload, Link as LinkIcon,
  FileText, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Type, Quote, BookOpen, Image as ImageIcon,
  ArrowUp, ArrowDown, Zap, Flame, Lightbulb, Highlighter,
  ChevronRight, ChevronLeft, ChevronDown, Check, Instagram, Settings, Maximize2, Minus,
  Home, Layers, SlidersHorizontal, User,
  Newspaper, Brain, HeartHandshake, GraduationCap, ScrollText, Megaphone,
  Target, Camera,
} from 'lucide-react';
import { extractDominantColor } from './src/utils/color-extraction.js';
import { extractJSON } from './src/utils/parsers.js';
import { saveHookToLibrary, getHooksForNiche } from './src/utils/hooks-library.js';
import { SCHEMA_VERSION, migrateDoc } from './src/utils/schema-migration.js';
import { videoPut, videoGet, videoDelete, videoCleanupOrphans, videoStorageUsage, newVideoId, getVideoUrl, setVideoUrlMap } from './src/utils/video-store.js';
import AutoFitText from './src/components/AutoFitText.jsx';
import WcagBadge from './src/components/WcagBadge.jsx';
import VisualStylePicker from './src/components/VisualStylePicker.jsx';
import OnboardingLanding from './src/components/OnboardingLanding.jsx';
import Paywall from './src/components/Paywall.jsx';
import LoginModal from './src/components/LoginModal.jsx';
import AccountProfile from './src/components/AccountProfile.jsx';
import {
  fetchAccessSession,
  confirmCheckoutSession,
  openBillingPortal,
  logoutAccess,
} from './src/lib/billing.js';
import { VISUAL_PRESETS, VISUAL_PRESET_BY_ID, applyVisualPreset, getSlideOverridesForPreset } from './src/styles/visual-presets.jsx';
import { useScrollLock } from './src/hooks/useScrollLock.js';
import { hydrateBrandTextColors, effectiveTitleFontFamily } from './src/utils/brand-helpers.js';
import { SectionLabel as S } from './src/components/ui/SectionLabel.jsx';
import ModesIntroModal from './src/components/ModesIntroModal.jsx';
import PromptDialog from './src/components/PromptDialog.jsx';
import OnboardingTour from './src/components/OnboardingTour.jsx';
import HelpModal from './src/components/HelpModal.jsx';
import BrandsModal from './src/components/BrandsModal.jsx';
import LibraryModal from './src/components/LibraryModal.jsx';
import ImageCropModal from './src/components/ImageCropModal.jsx';
import PhotoPositionModal from './src/components/PhotoPositionModal.jsx';
import KeysModal from './src/components/KeysModal.jsx';
import TemplatesModal from './src/components/TemplatesModal.jsx';
import { resolveSlideBrandBg } from './src/utils/brand-helpers.js';
import { STATUS_DEFS, STATUS_BY_ID, fmtDate, isDefault } from './src/utils/library-helpers.js';
import { FORMATS } from './src/utils/formats.js';
import { PALETTES, TITLE_FONTS, TEMPLATES } from './src/utils/design-data.js';
import { getServerStatus } from './src/utils/server-status.js';
import {
  AUTOFIT_MIN_SCALE,
  DARK_CREAM,
  FONT_PAIRINGS,
  applyCompositionToSlide,
  clampTitleWeight,
  getComposition,
  inferCompositionId,
  pairingMatchesBrand,
  suggestCreativePresetForVisual,
} from './src/utils/slide-design-system.js';
import {
  GEN_MODES,
  GEN_MODE_BY_ID,
  isPersoHybridDensity,
  buildPersoHybridLayoutBlock,
  buildBrandBlock,
  buildImgParamsBlockPT,
  buildImgParamsTagsEN,
  VC_ZWSP,
  normalizeMaterialField,
  isUrlOnlyNormalizedText,
  normalizedMaterialPieces,
  extractHttpUrlsFromMaterial,
  FETCH_SOURCE_API,
  materialHasUserInput,
  buildMaterialBlock,
  buildMaterialPriorityBlock,
  CREATIVE_PRESETS,
  CREATIVE_PRESET_BY_ID,
  SLIDE_TEXT_DENSITY_OPTIONS,
  SLIDE_TEXT_DENSITY_BY_ID,
  TEXT_DENSITY_TARGET_MULT,
  scaledCharBand,
  tendenciaStyleSandwichCharBands,
  scaledCeiling,
  MID_SUBTITLE_CHAR_BANDS,
  midSubtitleBandFor,
  buildSlideTextDensityOverrides,
  buildSlideTextDensityRefineHint,
  stripLeadingSlideCardLabel,
  isTendenciaCulturaPreset,
  buildTendenciaCulturaPackBlock,
  buildQuickTemplatePackBlock,
  buildTendenciaCulturaRefineSlideHint,
  coerceCultureTone,
  buildGenerationIntroLine,
  buildGenerationLanguageLayer,
  buildGenerationSlideLayoutRules,
  buildGenerationImageLayer,
  buildNarrativeModeReminder,
  buildRefineSingleSlideRules,
  buildCaptionOutlineInstructions,
  buildHookVariationRules,
  buildRefineVoiceRules,
  buildCaptionVoiceRules,
  buildResearchPromptBias,
  quickTemplateIdFromPreset,
  isQuickTemplatePreset,
  QUICK_TEMPLATE_CREATIVE_PRESET_ENTRIES,
} from './src/utils/generation-prompts.js';
import { GLOBAL_STYLE } from './src/styles/global-style.js';
import {
  cultureDarkBackdropFromBrand,
  vcCustomBodyFace,
  effectiveBodyFontFamily,
  LAYOUT_POS_LAB_ROWS,
  LAYOUTS,
  DEFAULT_LAYOUT,
  PHOTO_REGION_IDS,
  normalizePhotoRegion,
  VC_PHOTO_ZONE_HIT_LAYER_STYLE,
  normalizeSlideImgMode,
  slideStoredPresentationCssFilter,
  cultureResolveSurface,
  VC_TEXT_ZONE_STYLE,
  canvasClassicTitlePaddingXPx,
  canvasClassicSubtitlePaddingXPx,
  canvasCultureSandwichPaddingXPx,
  canvasCultureSandwichBottomPaddingXPx,
  ClassicCanvasInner,
  ClassicLegadoInsetPhotoColumn,
  SlideCardInner,
  vcHandleBadgeBoxPositionStyle,
  vcHandleAvatarImgStyle,
} from './src/components/card/SlideCardInner.jsx';
import {
  PRESENTATION_IMG_ADJ_KEYS,
  DEFAULT_PRESENTATION_IMG_ADJUST,
  normalizePresentationImgAdjust,
  buildPresentationImageFilter,
  presentationAdjustIsNeutral,
  presentationImgAdjustEquivalent,
  FullscreenViewer,
} from './src/components/card/FullscreenViewer.jsx';
import {
  AccountHomeShell,
} from './src/components/AccountHomeShell.jsx';
import {
  normalizeCardVisualStyle,
  CARD_VISUAL_STYLE_OPTIONS,
  QUICK_TEMPLATE_NARRATIVE_MODE,
  GenerateModal,
} from './src/components/panels/GenerateModal.jsx';
import {
  formatPresentationAdjDisp,
  FULLSCREEN_IMG_ADJ_ROWS,
  FullscreenImageAdjustBar,
} from './src/components/card/FullscreenImageAdjustBar.jsx';
import {
  NARRATIVE_MODE_REF_VOICE_PAIRING,
  ModePicker,
  ReferenceProfilesCuradoria,
  IMG_AXES,
  ImgParamsPanel,
} from './src/components/panels/generate-modal-parts.jsx';
import {
  PerSlideImageRefBlock,
} from './src/components/panels/PerSlideImageRefBlock.jsx';
import {
  ExportMoreFormats,
} from './src/components/panels/ExportMoreFormats.jsx';
import {
  HookVariationsModal,
} from './src/components/panels/HookVariationsModal.jsx';
import {
  PRESET_NICHES,
  ResearchPanel,
} from './src/components/panels/ResearchPanel.jsx';
import {
  vcIsCoarseTouchDevice,
  vcPhotoZoneTapSlopPx,
  pctBox,
  VC_ZONE_DRAG_MIME,
  CanvasZonesOverlay,
} from './src/components/card/CanvasZonesOverlay.jsx';
import {
  VcBgPatternLayer,
  listCultureParagraphWindows,
  pushTrimmedParagraphWindow,
  clipAccentIntervalsToWindow,
  CultureInlineRich,
  CultureRichParagraphs,
  OverflowScaler,
} from './src/components/card/render-primitives.jsx';
import {
  EditorFormatSelector,
  APP_MODES,
  ModeSwitcher,
  DRAWER_SNAPS,
  DRAWER_DEFAULT_SNAP,
  MobileDrawer,
  RefineBtn,
} from './src/components/ui/editor-chrome.jsx';
import {
  FONT_CAT_LABELS,
  FontPairingPicker,
  FontPicker,
} from './src/components/ui/font-pickers.jsx';
import {
  layoutMiniBars,
  LayoutMiniIcon,
  ImageFocalMiniIcon,
  PhotoRegionMiniIcon,
} from './src/components/ui/mini-icons.jsx';
import {
  Slider,
  Toggle,
  ColorRow,
  SavedIndicator,
  ToastStack,
} from './src/components/ui/primitives.jsx';
import {
  vcFixHtml2CanvasImages,
  vcPreferFileShareForDownloads,
  downloadBlob,
} from './src/utils/export-helpers.js';
import {
  SK,
  readInitialShellView,
  VC_QUOTA_SLIM_ALREADY_NOTIFIED,
  VC_QUOTA_HARD_ALREADY_NOTIFIED,
  lsSet,
} from './src/utils/storage.js';
import {
  vcHexToRgb,
  vcNormalizeHex,
  vcRelLuminance01,
  cultureReadableInks,
  brandMatchesPalette,
  BODY_FONTS,
  vcBgPatternDivStyle,
  REFERENCE_PROFILES,
} from './src/utils/brand-visuals.js';
import {
  slideAutoAdjustPatch,
  DEFAULT_CANVAS_ZONES_COVER_FULLBLEED,
  slideHasPendingPhotoIntent,
  inferCanvasDefaults,
  applyFinalizeCanvasMarginsToSlides,
  canvasZonesFontScalePatch,
  sandwichPhotoZoneImgStyle,
  attachGenerationCanvasLayouts,
} from './src/utils/canvas-zones.js';
import {
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
} from './src/utils/doc-schema.js';
import {
  mergeUtf16AccentIntervals,
  normalizeDestaqueSpansForLen,
  markdownBoldAccentIntervalsUtf16,
  unifyAccentIntervalsUtf16,
  stripAdjacentMarkdownBoldFences,
  cultureAccentRenderablePieces,
  contiguousTextEditBounds,
  remapDestaqueSpansOnEdit,
} from './src/utils/text-spans.js';
import {
  VC_BG_SAVE_MAX_PX,
  VC_BG_SAVE_JPEG_Q,
  VC_BG_COMPRESS_MIN_CHARS,
  vcShrinkDataUrlForStorage,
  vcImageFileToStorageDataUrl,
  canvasToPngBlob,
} from './src/utils/image-storage.js';
import {
  DEFAULT_SLIDE_TEXT_INSET,
  CANVAS_ZONE_MIN,
  SANDWICH_PHOTO_ZONE_MIN_H_PCT,
  SANDWICH_PHOTO_ZONE_ABSOLUTE_MIN_H_PCT,
  SANDWICH_TEXT_ZONE_MIN_H_PCT,
  clampRect,
  DEFAULT_CANVAS_ZONES_CLASSIC,
  DEFAULT_CANVAS_ZONES_SANDWICH,
  DEFAULT_CANVAS_ZONES_STAT,
  CANVAS_AUTO_EDGE_PCT,
  CANVAS_AUTO_TEXT_INSET_MIN,
  tightenCanvasTextZoneRect,
  estimateWrappedLines,
  finalizeCanvasMarginsForAutoAdjust,
} from './src/utils/canvas-layout.js';
import {
  IS_LOCAL_DEV,
  USE_ANTHROPIC_PROXY,
  ANTHROPIC_URL,
  OPENAI_CHAT_URL,
  OPENAI_IMAGE_URL,
  OPENAI_IMAGE_EDITS_URL,
  COMPATIBLE_AI_URL,
  enhanceNetworkError,
  AI_SYSTEM_PT,
  setAIRuntimeSettings,
  getTextModel,
  getProviderKey,
  callAnthropic,
  callOpenAIChat,
  COMPATIBLE_DIRECT_URLS,
  callCompatibleChat,
  callAI,
  callAIwithSearch,
  GPT_IMAGE_ART_DIRECTION,
  dataUrlToBlob,
  blobFromSlideRef,
  buildGptImageFullPrompt,
  generateZaiImage,
  OPENAI_IMAGE_MODELS,
  getOpenAIImageOrder,
  generateDALLEEdits,
  generateDALLE,
  generateDALLEWithRetry,
} from './src/utils/ai-client.js';
import {
  DEFAULT_AI_SETTINGS,
  IMAGE_PROVIDERS,
  normalizeAISettings,
  TEXT_PROVIDERS,
} from './src/config/ai-providers.js';

// ─── VIDEO URL MAP (módulo-level, sincronizado do App.videoUrls state) ───────

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
// Plausible (carregado via index.html). Helper que é no-op se ad blocker bloquear
// ou se window.plausible não estiver disponível (dev local, etc.).
function trackEvent(name, props) {
  try {
    if (typeof window === 'undefined') return;
    if (typeof window.plausible !== 'function') return;
    window.plausible(name, props ? { props } : undefined);
  } catch { /* never break app por causa de analytics */ }
}





/** Landing de introdução: entrada padrão do site até o utilizador clicar Entrar. */
function shouldShowOnboardingLanding() {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('app') === '1' || q.get('studio') === '1') return false;
    if (q.get('landing') === '1' || q.get('intro') === '1' || q.get('welcome') === '1') return true;
    return sessionStorage.getItem(SK.landingDismissed) !== '1';
  } catch {
    return true;
  }
}

function dismissOnboardingLanding() {
  try {
    sessionStorage.setItem(SK.landingDismissed, '1');
    localStorage.setItem(SK.landingDone, '1');
  } catch { /* */ }
}


// ─── CONSTANTS ────────────────────────────────────────────────────────────────



















function guessFontFileFormat(file) {
  const n = (file?.name || '').toLowerCase();
  if (n.endsWith('.woff2')) return 'woff2';
  if (n.endsWith('.woff')) return 'woff';
  if (n.endsWith('.ttf')) return 'truetype';
  if (n.endsWith('.otf')) return 'opentype';
  const t = (file?.type || '').toLowerCase();
  if (t.includes('woff2')) return 'woff2';
  if (t.includes('woff')) return 'woff';
  if (t.includes('ttf')) return 'truetype';
  if (t.includes('otf')) return 'opentype';
  return 'woff2';
}











/** Ponto de ancoragem da foto (background-position % por slide). — Mesmos ids que LAYOUTS (tl…br). */
const IMAGE_FOCAL_XY = {
  tl: [20, 24], tc: [50, 24], tr: [80, 24],
  ml: [20, 50], mc: [50, 50], mr: [80, 50],
  bl: [20, 76], bc: [50, 76], br: [80, 76],
};

/** Presets de «modo» da imagem (encaixe + zoom). */
const IMAGE_MODE_PRESETS = [
  { id: 'full', label: 'Preencher', sub: 'cobre a zona · sem barras', patch: { bgFit: 'cover', bgX: 50, bgY: 50, bgZoom: 100 } },
  { id: 'show_all', label: 'Mais quadrado', sub: 'foto toda visível · vãos com fundo do card', patch: { bgFit: 'contain', bgX: 50, bgY: 50, bgZoom: 100 } },
  { id: 'vertical', label: 'Mais vertical', sub: 'recorte lateral', patch: { bgFit: 'cover', bgX: 50, bgY: 50, bgZoom: 132 } },
  { id: 'wide', label: 'Mais largo', sub: 'vê mais da cena', patch: { bgFit: 'cover', bgX: 50, bgY: 50, bgZoom: 86 } },
  { id: 'manual', label: 'Manual', sub: 'zoom % · tamanho livre', patch: { bgFit: 'custom' } },
];

function activeImageModePresetId(slide) {
  const fit = slide.bgFit ?? 'cover';
  const z = slide.bgZoom ?? 100;
  const x = slide.bgX ?? 50;
  const y = slide.bgY ?? 50;
  const nearCenter = Math.abs(x - 50) < 4 && Math.abs(y - 50) < 4;
  const zNear = (t) => Math.abs(z - t) < 3;
  if (fit === 'custom') return 'manual';
  if (fit === 'contain' && zNear(100) && nearCenter) return 'show_all';
  if (fit === 'cover' && zNear(100) && nearCenter) return 'full';
  if (fit === 'cover' && z >= 124) return 'vertical';
  if (fit === 'cover' && z <= 90) return 'wide';
  return null;
}

/** Qual célula da grelha 3×3 melhor corresponde a bgX/bgY (null se fora do molde). */
function activeImageFocalLayoutId(slide) {
  const x = slide.bgX ?? 50;
  const y = slide.bgY ?? 50;
  let best = null;
  let bestD = Infinity;
  for (const l of LAYOUTS) {
    const [px, py] = IMAGE_FOCAL_XY[l.id];
    const d = (x - px) ** 2 + (y - py) ** 2;
    if (d < bestD) { bestD = d; best = l.id; }
  }
  return bestD < 12 * 12 ? best : null;
}







const PHOTO_REGION_GRID = [
  { id: 'full', lab1: 'FUNDO', lab2: 'CHEIO' },
  { id: 'inset_h_top', lab1: 'FAIXA', lab2: 'TOPO' },
  { id: 'inset_h_middle', lab1: 'FAIXA', lab2: 'MEIO' },
  { id: 'inset_h_bottom', lab1: 'FAIXA', lab2: 'BASE' },
  { id: 'inset_h_narrow_mid', lab1: 'FAIXA', lab2: 'FINA' },
];











const BG_PATTERN_OPTIONS = [
  { id: 'none', label: 'Nenhum' },
  { id: 'grid', label: 'Grade (quadriculado)' },
  { id: 'dots', label: 'Bolinhas' },
  { id: 'hlines', label: 'Linhas horizontais' },
  { id: 'dlines', label: 'Linhas diagonais' },
  { id: 'diag_grid', label: 'Xadrez diagonal' },
];





// ─── MODOS DE GERAÇÃO ─────────────────────────────────────────────────────────


const REFERENCE_PROFILE_BY_ID = Object.fromEntries(REFERENCE_PROFILES.map(p => [p.id, p]));









// ─── UTILS ────────────────────────────────────────────────────────────────────



// Persistência leve em localStorage com fallback seguro
const lsGet = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
};










// ─── BIBLIOTECA + PERFIS DE MARCA ─────────────────────────────────────────────
// Esquema novo de persistência (lazily migrado a partir do `vc_doc` antigo):
//   vc_library = [{ id, name, status, createdAt, updatedAt, doc }]
//   vc_brands  = [{ id, name, ...brand }]
//   vc_active_doc_id   = string (qual carrossel está sendo editado agora)
//   vc_active_brand_id = string (qual perfil de marca aplicar por padrão em novos carrosséis)
// Cria uma entrada de biblioteca a partir de um doc completo.
const mkLibEntry = (doc, name = 'Sem título') => {
  const now = Date.now();
  return {
    id: uid(),
    name,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    doc,
  };
};

// Hook: state que sincroniza com localStorage (debounced) + sync entre abas
// via evento `storage` (que só dispara em OUTRAS abas — não na que escreveu).
function usePersistedState(key, initial) {
  const [val, setVal] = React.useState(() => lsGet(key, initial));
  const tRef = React.useRef(null);
  const lastWrittenRef = React.useRef(null);
  React.useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => {
      lastWrittenRef.current = JSON.stringify(val);
      lsSet(key, val);
    }, 300);
    return () => { if (tRef.current) clearTimeout(tRef.current); };
  }, [key, val]);
  React.useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== key || e.newValue == null) return;
      // Ignora eco da própria escrita (alguns browsers reentram)
      if (e.newValue === lastWrittenRef.current) return;
      try {
        setVal(JSON.parse(e.newValue));
      } catch (err) {
        console.warn(`[usePersistedState] storage event JSON inválido para "${key}":`, err.message);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);
  return [val, setVal];
}

// Hook: histórico para undo/redo. Mudanças muito próximas no tempo
// (ex: digitar em um input) são agrupadas em um único snapshot.
// canUndo e canRedo são booleanos reativos — mudam de valor quando o histórico muda,
// o que permite que botões de undo/redo reflitam o estado corretamente sem polling.
function useHistory(initialState, { limit = 100, coalesceMs = 600 } = {}) {
  const [state, setStateInternal] = React.useState(initialState);
  const past = React.useRef([]);
  const future = React.useRef([]);
  const skipNext = React.useRef(false);
  const lastPushAt = React.useRef(0);
  // Guards contra StrictMode double-invoke: React 18 roda o updater 2× em dev
  // pra detectar side-effects. Sem isso, push duplica entradas e undo/redo pulam steps.
  const lastPushedPrev = React.useRef(null);
  const lastUndoPrev = React.useRef(null);
  const lastRedoPrev = React.useRef(null);
  // Versão incremental: muda sempre que o histórico muda → permite derivar canUndo/canRedo reativos
  const [histVer, setHistVer] = React.useState(0);
  const bumpHist = React.useCallback(() => setHistVer(v => v + 1), []);

  const push = React.useCallback((updater) => {
    setStateInternal((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next === prev) return prev;
      if (skipNext.current) { skipNext.current = false; return next; }
      // Guard StrictMode: se já empurramos exatamente este prev no último ciclo, é re-invoke
      if (lastPushedPrev.current === prev) return next;
      lastPushedPrev.current = prev;
      const now = Date.now();
      const coalesce = (now - lastPushAt.current) < coalesceMs;
      lastPushAt.current = now;
      if (!coalesce) {
        past.current.push(prev);
        if (past.current.length > limit) past.current.shift();
        future.current = [];
        Promise.resolve().then(bumpHist);
      } else {
        future.current = [];
      }
      return next;
    });
  }, [limit, coalesceMs, bumpHist]);

  // setState que NÃO grava no histórico (uso interno)
  const setSilent = React.useCallback((updater) => {
    skipNext.current = true;
    setStateInternal(updater);
  }, []);

  const undo = React.useCallback(() => {
    setStateInternal((prev) => {
      if (lastUndoPrev.current === prev) return prev; // StrictMode guard
      if (!past.current.length) return prev;
      lastUndoPrev.current = prev;
      const previous = past.current.pop();
      future.current.push(prev);
      Promise.resolve().then(bumpHist);
      return previous;
    });
  }, [bumpHist]);

  const redo = React.useCallback(() => {
    setStateInternal((prev) => {
      if (lastRedoPrev.current === prev) return prev; // StrictMode guard
      if (!future.current.length) return prev;
      lastRedoPrev.current = prev;
      const next = future.current.pop();
      past.current.push(prev);
      Promise.resolve().then(bumpHist);
      return next;
    });
  }, [bumpHist]);

  const reset = React.useCallback((next) => {
    past.current = [];
    future.current = [];
    setStateInternal(next);
    bumpHist();
  }, [bumpHist]);

  // Valores reativos derivados da versão do histórico
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canUndo = React.useMemo(() => past.current.length > 0, [histVer]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canRedo = React.useMemo(() => future.current.length > 0, [histVer]);

  return { state, set: push, setSilent, undo, redo, reset, canUndo, canRedo };
}







// extractJSON foi extraído para src/utils/parsers.js


// Bundle local (chunk lazy do Vite) — antes vinha do cdnjs em runtime:
// export quebrava offline e dependia de CDN de terceiro (audit-produto #7).
const loadHtml2Canvas = async () => (await import('html2canvas')).default;



// Carrega jsPDF on-demand — bundle local (chunk lazy do Vite), sem CDN.
const loadJsPdf = async () => (await import('jspdf')).jsPDF;

/**
 * Safari iOS ignora `.click()` em `<input type="file" hidden>`. Mantém elemento ativo mas fora da vista.
 * @see https://bugs.webkit.org/show_bug.cgi?id=22261 (padrões semelhantes)
 */
const VC_TRIGGERABLE_FILE_INPUT_STYLE = {
  position: 'fixed',
  left: -9999,
  top: 0,
  width: '1px',
  height: '1px',
  margin: 0,
  padding: 0,
  opacity: 0.02,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  border: 'none',
  /** `none` quebra `.click()` sintético no Safari iOS em vários casos. */
  pointerEvents: 'auto',
  zIndex: 2,
};

/** Input dedicado à zona foto — WebKit iOS costuma bloquear menos sem `clipPath` agressivo. */
const VC_PHOTO_ZONE_FILE_INPUT_STYLE = {
  ...VC_TRIGGERABLE_FILE_INPUT_STYLE,
  clipPath: 'none',
  width: 4,
  height: 4,
  opacity: 0.05,
};



/** `id` do input global (sidebar / fallback). */
const VC_PHOTO_ZONE_FILE_INPUT_ID = 'vc-photo-zone-file';











async function downloadCanvasPng(canvas, filename) {
  const blob = await canvasToPngBlob(canvas);
  await downloadBlob(blob, filename);
}








/** Presets de filtro pré-configurados — atalho pra ajuste rápido na sidebar.
 *  Aplicados via `updateSlide({ presentationImgAdjust: PRESET[id] })`. */
const PRESENTATION_IMG_FILTER_PRESETS = [
  { id: 'neutro',    label: 'Neutro',    desc: 'Sem filtro', vals: { ...DEFAULT_PRESENTATION_IMG_ADJUST } },
  { id: 'editorial', label: 'Editorial', desc: 'Contraste +, cor sutil', vals: { exposure:0, brightness:-3, contrast:14, color:-6, blacks:6, tonalidade:0 } },
  { id: 'vintage',   label: 'Vintage',   desc: 'Quente + suave',           vals: { exposure:4, brightness:2, contrast:-6, color:10, blacks:-8, tonalidade:12 } },
  { id: 'bw',        label: 'P&B',       desc: 'Preto e branco contrastado', vals: { exposure:0, brightness:0, contrast:18, color:-50, blacks:8, tonalidade:0 } },
];







































function unionDestaqueRangeIntoSpans(spansIn, selA, selB, len) {
  const lo = Math.max(0, Math.min(len, Math.min(selA, selB)));
  const hi = Math.max(0, Math.min(len, Math.max(selA, selB)));
  if (hi <= lo || !len) return normalizeDestaqueSpansForLen(spansIn, len);
  return normalizeDestaqueSpansForLen([...(spansIn || []), [lo, hi]], len);
}













function rectsEqual(a, b) {
  return a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}











/** Personalizado · densidades 1/1 ou 1/2: dois primeiros full-bleed, miolo tipo Cultura com sanduíche. */



































ClassicCanvasInner.displayName = 'ClassicCanvasInner';


ClassicLegadoInsetPhotoColumn.displayName = 'ClassicLegadoInsetPhotoColumn';

// AutoFitText foi extraído para src/components/AutoFitText.jsx



// ─── SLIDE CARD ───────────────────────────────────────────────────────────────



// Memoiza SlideCard: re-renderiza apenas quando suas props relevantes mudam.
// Isso é crítico no desktop, onde até 10 slides são renderizados simultaneamente.
const SlideCard = React.memo(SlideCardInner, (prev, next) => {
  if (prev.fmt !== next.fmt) return false;
  if (prev.num !== next.num || prev.total !== next.total || prev.scale !== next.scale) return false;
  if (prev.brand !== next.brand) return false;
  if (prev.slide !== next.slide) return false;
  if (prev.presentationImgFilter !== next.presentationImgFilter) return false;
  if (prev.creativePreset !== next.creativePreset) return false;
  if (prev.showCanvasChrome !== next.showCanvasChrome) return false;
  if (prev.enableZoneSwapDrag !== next.enableZoneSwapDrag) return false;
  if (prev.slideIndex !== next.slideIndex) return false;
  if (prev.onCanvasZonePatch !== next.onCanvasZonePatch) return false;
  if (prev.onPhotoZoneRequest !== next.onPhotoZoneRequest) return false;
  if (prev.onPhotoZoneNativeFile !== next.onPhotoZoneNativeFile) return false;
  return true;
});

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────







// Fonte única das tabs do editor (sidebar desktop + bottom bar mobile).
// Criador: Home + Narrativa + Visual + Imagem + Marca · Diretor: + Texto · Studio: + Layout
const EDITOR_TABS = [
  { id:'home',      icon:Home,     label:'Home',      mode:'criador' },
  { id:'narrativa', icon:Wand2,    label:'Narrativa', mode:'criador' },
  { id:'visual',    icon:Palette,  label:'Visual',    mode:'criador' },
  { id:'imagem',    icon:ImageIcon,label:'Imagem',    mode:'criador' },
  { id:'texto',     icon:Type,     label:'Texto',     mode:'diretor' },
  { id:'layout',    icon:Layout,   label:'Layout',    mode:'studio' },
  { id:'brand',     icon:Instagram,label:'Marca',     mode:'criador' },
];
const APP_MODE_RANK = { criador: 1, diretor: 2, studio: 3 };
const visibleEditorTabs = (appMode) =>
  EDITOR_TABS.filter((t) => APP_MODE_RANK[t.mode] <= (APP_MODE_RANK[appMode] || 1));


/**
 * ModesIntroModal — onboarding dos 3 modos. Aparece na primeira visita
 * e pode ser reaberto via menu "?". Glass dark premium.
 */





// Color row
// Biblioteca de hooks foi extraída para src/utils/hooks-library.js

// WcagBadge foi extraído para src/components/WcagBadge.jsx









 // 55dvh





// ─── TOAST STACK ──────────────────────────────────────────────────────────────



// ─── PROMPT DIALOG (substitui window.prompt) ──────────────────────────────────

// ─── IMAGE CROP MODAL ─────────────────────────────────────────────────────────
/** Recorta a imagem de fundo no canvas; proporção 4:5 opcional (feed Instagram). */

// ─── REFINE BUTTON ────────────────────────────────────────────────────────────



// ─── KEYS MODAL ───────────────────────────────────────────────────────────────

// ─── GENERATE MODAL ───────────────────────────────────────────────────────────



// ─── RESEARCH PANEL ───────────────────────────────────────────────────────────



// ─── TEMPLATES MODAL ──────────────────────────────────────────────────────────

// ─── HOOK VARIATIONS MODAL ────────────────────────────────────────────────────



// ─── PER-SLIDE REF + EXTRA PROMPT (marca / produto) ───────────────────────────



// ─── SIDEBAR CONTENT ─────────────────────────────────────────────────────────

function SidebarContent({
  slide, slides, activeIdx, brand, setBrand, updateSlide,
  addSlide, deleteSlide, duplicateSlide, moveSlide, refineSlide, refining,
  generateCaption, genCaption, caption, setCaption, setSetupOpen, setResearchOpen, fileInputRef,
  exportSlide, exportAll, exportPDF, exportPhotosOnly = () => {}, exporting, exportProgress, tab, setTab,
  openaiKey, hasOpenAI=false, setKeysOpen,
  setTemplatesOpen, setHookVarsOpen, refineAll, askPrompt, toast,
  material = { content:'', sources:'', context:'' }, setMaterial = () => {},
  imgParams = { fidelity:50, creativity:50, irreverence:50, objectivity:50 },
  setImgParams = () => {},
  setBrandsOpen, brandRoster = [], activeBrandId,
  setLibraryOpen = () => {}, libraryCount = 0,
  onPickVideo = () => {}, onRemoveVideo = () => {},
  openRefImagePicker = () => {},
  slideImgGenBusy = {},
  generateSlideImageAt = () => {},
  creativePreset = 'livre',
  fmt = 'carrossel',
  applyTypographyToAllCards,
  applyBrandTypographyToAllSlides,
  canvasEditMode = false, setCanvasEditMode = () => {},
  showPreviewAlignGrid = false, setShowPreviewAlignGrid = () => {},
  anyCanvasEnabled = false,
  patchCanvasZonesAt = () => {},
  openPhotoZoneImport = () => {},
  handleBatchPhotos = () => {},
  batchPhotoInputRef = { current: null },
  enableCanvasLayout = () => {},
  disableCanvasLayout = () => {},
  onOpenImageCrop = () => {},
  onOpenPhotoPosition = () => {},
  remixWithTone = () => {},
  hasLastGenerate = false,
  visualPreset = null,
  applyVisualPreset: applyVisualPresetCb = () => {},
  appMode = 'criador',
  setActiveIdx = () => {},
  activeEntry = null,
}) {
  const [dalleLoading, setDalleLoading] = React.useState(false);

  const applyDalleQuery = async (q) => {
    if (!hasOpenAI) { toast?.('Configure o provedor de imagem em ⚙ (OpenAI ou Z.ai).', 'error'); return; }
    updateSlide({ imageQuery: q, imgMode: 'dalle', bgImage: null, overlay: 70 });
    setDalleLoading(true);
    try {
      const url = await generateDALLE(q, openaiKey, imgParams, {
        refImage: slide.refImage,
        imgExtraPrompt: slide.imgExtraPrompt,
      });
      updateSlide({ bgImage: url, bgImageSource: 'ai' });
    } catch(e) { toast?.('GPT Image 2: '+e.message, 'error'); }
    finally { setDalleLoading(false); }
  };

  const replaceImg = async () => {
    const q = await askPrompt({
      title: 'Buscar imagem',
      label: 'PALAVRAS-CHAVE EM INGLÊS',
      defaultValue: slide.imageQuery || 'dramatic dark portrait',
      placeholder: 'Ex: cinematic moody portrait studio',
      cta: 'Aplicar',
    });
    if (!q) return;
    await applyDalleQuery(q);
  };

  const refreshImg = async () => {
    if (!slide.imageQuery) return replaceImg();
    await applyDalleQuery(slide.imageQuery);
  };

  const askUrlImg = async () => {
    const u = await askPrompt({
      title: 'Imagem por URL',
      label: 'URL DA IMAGEM',
      defaultValue: '',
      placeholder: 'https://...',
      cta: 'Usar imagem',
    });
    if (u) updateSlide({ bgImage: u });
  };

  const btnStyle = (active) => ({
    padding:'7px 0', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer',
    fontFamily:'var(--font-ui)', transition:'all 0.12s', border:'1px solid',
    display:'flex', alignItems:'center', justifyContent:'center', gap:5,
    background: active ? 'var(--accent)' : 'var(--bg-card)',
    borderColor: active ? 'var(--accent)' : 'var(--border)',
    color: active ? '#fff' : 'var(--text-secondary)',
  });

  const bgFitKey = slide.bgFit ?? 'custom';
  const sidebarBgPreviewFilter = slide.bgImage ? slideStoredPresentationCssFilter(slide) : undefined;

  const titleTaRef = React.useRef(null);
  const subtitleTaRef = React.useRef(null);
  const sandwichBodyTaRef = React.useRef(null);
  const lastTextFieldRef = React.useRef('title');
  const pendTitleSel = React.useRef(null);
  const pendSubtitleSel = React.useRef(null);
  const pendSandwichBodySel = React.useRef(null);
  // Captura a última seleção feita em qualquer textarea — usada como source-of-truth pelo
  // botão "Marcar Destaque" (mais robusto que document.activeElement, que pode mudar em
  // mobile quando o user toca o botão).
  const lastSelectionRef = React.useRef({ field: null, start: 0, end: 0, text: '' });
  const captureSelection = React.useCallback((field, ta) => {
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    if (end <= start) return; // só guarda quando há seleção real (range > 0)
    lastSelectionRef.current = { field, start, end, text: (ta.value || '').slice(start, end) };
  }, []);

  React.useLayoutEffect(() => {
    const p = pendTitleSel.current;
    pendTitleSel.current = null;
    if (!p) return;
    const el = titleTaRef.current;
    if (!el) return;
    el.selectionStart = p.s;
    el.selectionEnd = p.e;
  }, [slide.title]);

  React.useLayoutEffect(() => {
    const p = pendSubtitleSel.current;
    pendSubtitleSel.current = null;
    if (!p) return;
    const el = subtitleTaRef.current;
    if (!el) return;
    el.selectionStart = p.s;
    el.selectionEnd = p.e;
  }, [slide.subtitle]);

  React.useLayoutEffect(() => {
    const p = pendSandwichBodySel.current;
    pendSandwichBodySel.current = null;
    if (!p) return;
    const el = sandwichBodyTaRef.current;
    if (!el) return;
    el.selectionStart = p.s;
    el.selectionEnd = p.e;
  }, [slide.bodyAfterImage]);

  const marcarDestaque = React.useCallback(() => {
    const cultureBody = creativePreset === 'tendencia_cultura' || slide.useCultureLayout;
    const sel = lastSelectionRef.current;
    // Lista de candidatos de campo onde a seleção pode estar — ordenada pela prioridade
    // (campo capturado no onSelect primeiro). Cada candidato é {key, text}.
    const candidates = [];
    const pushCand = (key, text) => {
      if (typeof text === 'string') candidates.push({ key, text });
    };
    if (sel.field === 'title') pushCand('title', slide.title);
    else if (sel.field === 'subtitle') pushCand('subtitle', slide.subtitle);
    else if (sel.field === 'bodyAfterImage' && cultureBody) pushCand('bodyAfterImage', slide.bodyAfterImage);
    // Fallback: tenta os outros campos também, por se o sel.field estiver stale (raro mas possível)
    if (slide.title != null) pushCand('title', slide.title);
    if (slide.subtitle != null) pushCand('subtitle', slide.subtitle);
    if (cultureBody && slide.bodyAfterImage != null) pushCand('bodyAfterImage', slide.bodyAfterImage);

    // Tenta achar o trecho selecionado em cada candidato. Critério:
    //  1. preferir match exato nos índices capturados (mais rápido + preserva intenção)
    //  2. fallback: substring search (text contains sel.text) — se houver, calcular offset
    //  3. CRÍTICO: usar índices contra a versão TRIMMED do texto, pois o renderer trima
    //     antes de aplicar os spans (linha 5449: bodyAfterCulture = slide.bodyAfterImage.trim())
    let resolved = null;
    const wanted = (sel.text || '').trim();
    if (!wanted) {
      toast?.('Selecione um trecho de texto antes de marcar.', 'info');
      return;
    }
    // Renderer trata cada campo diferente:
    //  - title:          text={slide.title || ''}                — usa RAW
    //  - subtitle:       text={slide.subtitle}                   — usa RAW
    //  - bodyAfterImage: text={(slide.bodyAfterImage||'').trim()} — usa TRIMMED
    // Spans precisam ser armazenados contra a versão que o renderer recebe.
    const renderedTextFor = (key, raw) => key === 'bodyAfterImage' ? String(raw || '').trim() : String(raw || '');
    for (const c of candidates) {
      const raw = c.text || '';
      const rendered = renderedTextFor(c.key, raw);
      const renderOffset = rendered ? raw.indexOf(rendered) : 0;
      // Tentativa 1: índices capturados batem (texto identico no raw na faixa selecionada)
      const liveAtIdx = raw.slice(sel.start, sel.end);
      if (liveAtIdx === sel.text) {
        const renderStart = Math.max(0, sel.start - Math.max(0, renderOffset));
        const renderEnd = Math.min(rendered.length, sel.end - Math.max(0, renderOffset));
        if (renderEnd > renderStart && rendered.slice(renderStart, renderEnd) === sel.text) {
          resolved = { key: c.key, text: rendered, start: renderStart, end: renderEnd };
          break;
        }
      }
      // Tentativa 2: substring search no texto que o renderer realmente recebe
      const found = rendered.indexOf(wanted);
      if (found >= 0) {
        resolved = { key: c.key, text: rendered, start: found, end: found + wanted.length };
        break;
      }
    }

    if (!resolved) {
      toast?.('Não encontrei o trecho selecionado em nenhum campo. Selecione de novo e tente.', 'info');
      return;
    }

    const dsPrev = slide.destaqueSpans && typeof slide.destaqueSpans === 'object' ? slide.destaqueSpans : {};
    const curField = dsPrev[resolved.key] ?? [];
    const merged = unionDestaqueRangeIntoSpans(curField, resolved.start, resolved.end, resolved.text.length);
    console.log('[Destaque]', {
      field: resolved.key,
      selectedText: wanted,
      indexRange: [resolved.start, resolved.end],
      textInRender: resolved.text.slice(resolved.start, resolved.end),
      mergedSpans: merged,
      brandAccentHex: brand?.accent,
    });
    updateSlide({
      destaqueSpans: {
        ...dsPrev,
        [resolved.key]: merged,
      },
    });
    const preview = wanted.length > 30 ? wanted.slice(0, 30) + '…' : wanted;
    const fieldLabel = resolved.key === 'title' ? 'título' : resolved.key === 'subtitle' ? 'subtítulo' : 'texto';
    toast?.(`Destaque aplicado em "${preview}" (${fieldLabel}). Cor: ${brand?.accent || 'auto'}`, 'success', 3500);
  }, [slide.title, slide.subtitle, slide.bodyAfterImage, slide.destaqueSpans, creativePreset, slide.useCultureLayout, updateSlide, toast, brand?.accent]);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Tab bar — sub-nav. Polish: ícone 13 (era 11), aria-label,
          aria-current, role=tab pra screen readers. Sombra inset abaixo
          + borda mais escura pra separar visualmente do conteúdo
          (especialmente no drawer mobile, onde tab bar e body têm mesmo
          bg-sidebar e antes fundiam visualmente). */}
      <div
        data-vc-tour="sidebar-tabs"
        role="tablist"
        aria-label="Áreas de edição do projeto"
        style={{
          // Grid 3 colunas — 6 domínios em 2 linhas, todos visíveis sem overflow.
          // Era flex single-row que cortava quando passou de 4 itens.
          display:'grid',
          gridTemplateColumns:'repeat(3, minmax(0, 1fr))',
          rowGap: 0,
          borderBottom:'1px solid var(--border)',
          boxShadow:'0 6px 12px -8px rgba(0,0,0,0.18)',
          flexShrink:0,
          position:'relative', zIndex:1,
        }}
      >
        {(() => {
          // FASE 2 Narrative OS — tabs filtradas por appMode (fonte única EDITOR_TABS)
          return visibleEditorTabs(appMode);
        })().map(t=>{
          const active = tab===t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-current={active ? 'page' : undefined}
              onClick={()=>setTab(t.id)}
              className={`tab-bar-item ${active?'active':''}`}
            >
              <t.icon size={13} strokeWidth={active ? 2.25 : 2}/>{t.label}
            </button>
          );
        })}
      </div>

      {/* Scrollable body */}
      <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:20, paddingBottom:24 }}>

        {/* FASE 1 Narrative OS: split Cards em Imagem + Layout + (Tipografia
            em Visual + Texto card em Narrativa). Outer condition cobre os 4
            tabs que reusam seções daqui; cada section interno gate por tab. */}
        {(tab==='imagem' || tab==='layout' || tab==='texto' || tab==='narrativa' || tab==='slide') && (
          <>
            {(tab==='layout'||tab==='slide') && (<S
              title="Composição"
              hint="Zonas redimensionáveis dentro do card. Ative primeiro abaixo; depois mostre as molduras para clicar direto na área da foto. Pino de swap troca texto/foto entre cards."
            >
              {/* Polish: CTA primário com fontWeight 600 + ícone (era 400 e
                  parecia botão fantasma). Quando ativo, vira selo de sucesso
                  com Check em vez de só trocar cor. Desativar fica como link
                  sutil pra reduzir peso visual. Toggle vai pra baixo — só faz
                  sentido depois de ativar. */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <button
                  type="button"
                  onClick={enableCanvasLayout}
                  disabled={anyCanvasEnabled}
                  style={{
                    width:'100%', minHeight:44, padding:'0 18px', borderRadius:9999,
                    cursor: anyCanvasEnabled ? 'default' : 'pointer',
                    border:`1px solid ${anyCanvasEnabled ? 'var(--success, #16a34a)' : 'var(--accent)'}`,
                    background: anyCanvasEnabled ? 'var(--success, #16a34a)' : 'var(--accent)',
                    color:'#fff',
                    fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    transition:'background-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
                  }}
                  onMouseDown={(e) => { if (!anyCanvasEnabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {anyCanvasEnabled
                    ? <><Check size={14} strokeWidth={2.5}/>Composição ativa</>
                    : <><Sparkles size={14}/>Ativar composição</>}
                </button>
                {anyCanvasEnabled && (
                  <button
                    type="button"
                    onClick={disableCanvasLayout}
                    aria-label="Desativar composição em todos os cards"
                    style={{
                      alignSelf:'center', minHeight:32, padding:'0 14px',
                      cursor:'pointer', border:'none', background:'transparent',
                      color:'var(--text-muted)', fontSize:11, fontFamily:'var(--font-ui)',
                      letterSpacing:'-0.005em', textDecoration:'underline',
                      textUnderlineOffset:'3px', textDecorationColor:'var(--hairline)',
                      transition:'color 0.12s, text-decoration-color 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.textDecorationColor='var(--text-muted)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.textDecorationColor='var(--hairline)'; }}
                  >
                    Desativar composição
                  </button>
                )}
              </div>
              {/* Toggle só faz sentido depois de ativar — fica desabilitado e
                  com hint visual claro do porquê quando canvas está off. */}
              <div style={{ opacity: anyCanvasEnabled ? 1 : 0.55, transition:'opacity 0.15s' }}>
                <Toggle
                  label="Mostrar zonas no card"
                  value={canvasEditMode}
                  onChange={(v) => {
                    if (!anyCanvasEnabled) {
                      toast?.('Ative primeiro a composição com o botão acima.', 'info');
                      return;
                    }
                    setCanvasEditMode(v);
                  }}
                />
                {!anyCanvasEnabled && (
                  <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-ui)', marginTop:4, letterSpacing:'-0.005em' }}>
                    Disponível depois de ativar o canvas.
                  </div>
                )}
              </div>
            </S>)}

            {(tab==='imagem'||tab==='slide') && (<S
              title="Importar imagens"
              hint="Separa da tipografia: só afeta a foto de fundo mostrada na zona de imagem do card. O primeiro ficheiro vai para o slide 1, o segundo para o slide 2, e assim por diante."
            >
              {/* Polish: 3 botões com mesmo padrão drop-zone (ícone num
                  círculo accent + label primary + subtítulo). Hover puxa
                  fundo accent-surface + borda accent. Visual e a11y unificados
                  com os uploads da Marca. */}
              {(() => {
                const importBtnStyle = {
                  width:'100%', minHeight:60, padding:'10px 14px', borderRadius:11,
                  cursor:'pointer', border:'1px solid var(--hairline)',
                  background:'var(--bg-card)', fontFamily:'var(--font-ui)',
                  display:'flex', alignItems:'center', gap:12, textAlign:'left',
                  transition:'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth)',
                };
                const importIconWrap = {
                  width:30, height:30, borderRadius:'50%', flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background:'var(--accent-surface)', color:'var(--accent)',
                };
                const importTextWrap = { display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0 };
                const importTitle = { fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', lineHeight:1.3 };
                const importSub = { fontSize:10, color:'var(--text-muted)', letterSpacing:'-0.005em', lineHeight:1.35 };
                const onEnter = e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.background='var(--accent-surface)'; };
                const onLeave = e => { e.currentTarget.style.borderColor='var(--hairline)'; e.currentTarget.style.background='var(--bg-card)'; };
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <button type="button" onClick={() => batchPhotoInputRef.current?.click()} style={importBtnStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>
                      <span style={importIconWrap} aria-hidden><Upload size={14} strokeWidth={2.25}/></span>
                      <span style={importTextWrap}>
                        <span style={importTitle}>Importar em lote</span>
                        <span style={importSub}>Distribui um arquivo por slide na ordem (1 → N)</span>
                      </span>
                    </button>
                    <button type="button" onClick={() => openPhotoZoneImport?.(activeIdx)} style={importBtnStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>
                      <span style={importIconWrap} aria-hidden><ImageIcon size={14} strokeWidth={2.25}/></span>
                      <span style={importTextWrap}>
                        <span style={importTitle}>Importar foto neste slide</span>
                        <span style={importSub}>Substitui só a zona de imagem do card {activeIdx + 1}</span>
                      </span>
                    </button>
                    <button type="button" onClick={() => onPickVideo?.()} style={importBtnStyle} onMouseEnter={onEnter} onMouseLeave={onLeave} title="MP4 / MOV / WebM até 60 MB. Substitui foto se houver.">
                      <span style={importIconWrap} aria-hidden><Video size={14} strokeWidth={2.25}/></span>
                      <span style={importTextWrap}>
                        <span style={importTitle}>Importar vídeo neste slide</span>
                        <span style={importSub}>MP4 · MOV · WebM — até 60 MB · substitui a foto</span>
                      </span>
                    </button>
                    {slide.videoId ? (
                      <button
                        type="button"
                        onClick={() => onRemoveVideo?.()}
                        style={{
                          alignSelf:'center', minHeight:32, padding:'0 14px',
                          cursor:'pointer', border:'none', background:'transparent',
                          color:'var(--text-muted)', fontSize:11, fontFamily:'var(--font-ui)',
                          letterSpacing:'-0.005em',
                          display:'inline-flex', alignItems:'center', gap:6,
                          transition:'color 0.12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color='var(--accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color='var(--text-muted)'; }}
                      >
                        <Trash2 size={11} aria-hidden/>
                        Remover vídeo do slide
                        {slide.videoName ? <span style={{ opacity:0.6, marginLeft:4 }}>({slide.videoName.slice(0, 18)}…)</span> : null}
                      </button>
                    ) : null}
                  </div>
                );
              })()}
            </S>)}

            {(tab==='imagem'||tab==='slide') && slide.bgImage ? (
              <S title="Posicionar foto" hint="Arraste a foto livremente num preview grande pra centralizar. Usa o mesmo bgX/bgY já existente, só a UX é melhor.">
                <button
                  type="button"
                  onClick={() => onOpenPhotoPosition()}
                  style={{
                    width: '100%', minHeight: 40, borderRadius: 11, cursor: 'pointer',
                    border: '1px solid var(--accent)', background: 'var(--success-surface)',
                    color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
                    fontFamily: 'var(--font-ui)', letterSpacing: '-0.011em',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <Move size={14} aria-hidden/>
                  Abrir preview grande pra arrastar
                </button>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>
                  Tem grade de rule-of-thirds + crosshair pra centralizar com precisão.
                </div>
              </S>
            ) : null}

            {/* D4: Filtros pré-configurados — só faz sentido se há foto no slide ativo */}
            {(tab==='imagem'||tab==='slide') && slide.bgImage ? (
              <S title="Filtro da foto (preset)" hint="Atalho rápido. Pra ajuste fino use o painel «Ajustes da foto» em tela cheia.">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {PRESENTATION_IMG_FILTER_PRESETS.map((p) => {
                    const isActive = (() => {
                      if (p.id === 'neutro') return presentationAdjustIsNeutral(slide.presentationImgAdjust);
                      return presentationImgAdjustEquivalent(slide.presentationImgAdjust, p.vals);
                    })();
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (p.id === 'neutro') {
                            updateSlide({ presentationImgAdjust: undefined });
                          } else {
                            updateSlide({ presentationImgAdjust: { ...p.vals } });
                          }
                        }}
                        style={{
                          padding:'10px 12px', borderRadius:8, cursor:'pointer',
                          border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: isActive ? 'var(--success-surface)' : 'var(--bg-card)',
                          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontSize:12, fontFamily:'var(--font-ui)', textAlign:'left',
                          display:'flex', flexDirection:'column', gap:2, letterSpacing:'-0.011em',
                        }}
                      >
                        <span style={{ fontWeight:600 }}>{p.label}</span>
                        <span style={{ fontSize:10, color:'var(--text-muted)' }}>{p.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </S>
            ) : null}

            {(tab==='narrativa'||tab==='slide') && (<S title={`Texto — card ${activeIdx+1} / ${slides.length}`}>
              <div>
                <label className="vc-label-sm" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <span>Título</span>
                  {(slide.title || '').trim() ? (
                    <button
                      type="button"
                      onClick={() => {
                        setHookLibrary(prev => saveHookToLibrary(prev, {
                          hook: slide.title,
                          niche,
                          tone: brand.tone,
                        }));
                        toast('Hook salvo na biblioteca — vai aparecer em futuras gerações do mesmo nicho.', 'success');
                      }}
                      title="Salvar este título na biblioteca de hooks para reutilizar em novos carrosséis"
                      style={{
                        background:'none', border:'none', cursor:'pointer',
                        color:'var(--text-muted)', fontSize:10, fontFamily:'var(--font-ui)',
                        padding:'4px 8px', borderRadius:6, letterSpacing:'-0.011em',
                        display:'inline-flex', alignItems:'center', gap:4,
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Bookmark size={11} aria-hidden/> Salvar como hook
                    </button>
                  ) : null}
                </label>
                <textarea
                  ref={titleTaRef}
                  onFocus={() => { lastTextFieldRef.current = 'title'; }}
                  onSelect={(e) => captureSelection('title', e.currentTarget)}
                  onKeyUp={(e) => captureSelection('title', e.currentTarget)}
                  value={slide.title}
                  onChange={(e) => {
                    const nw = e.target.value;
                    const old = slide.title ?? '';
                    const ds = slide.destaqueSpans && typeof slide.destaqueSpans === 'object' ? slide.destaqueSpans : {};
                    const nextTitleSpans = remapDestaqueSpansOnEdit(old, nw, ds.title ?? []);
                    updateSlide({
                      title: nw,
                      destaqueSpans: { ...ds, title: nextTitleSpans },
                    });
                  }}
                  rows={2}
                  className="vc-input vc-textarea"
                  style={{ fontSize:17, fontWeight:600 }}
                />
              </div>
              <div>
                <label className="vc-label-sm">Subtítulo</label>
                <textarea
                  ref={subtitleTaRef}
                  onFocus={() => { lastTextFieldRef.current = 'subtitle'; }}
                  onSelect={(e) => captureSelection('subtitle', e.currentTarget)}
                  onKeyUp={(e) => captureSelection('subtitle', e.currentTarget)}
                  value={slide.subtitle}
                  onChange={(e) => {
                    const nw = e.target.value;
                    const old = slide.subtitle ?? '';
                    const ds = slide.destaqueSpans && typeof slide.destaqueSpans === 'object' ? slide.destaqueSpans : {};
                    const nextSubSpans = remapDestaqueSpansOnEdit(old, nw, ds.subtitle ?? []);
                    updateSlide({
                      subtitle: nw,
                      destaqueSpans: { ...ds, subtitle: nextSubSpans },
                    });
                  }}
                  rows={3}
                  className="vc-input vc-textarea"
                  style={{ fontSize:17, color:'var(--text-secondary)', fontWeight:400 }}
                />
              </div>
              {(creativePreset === 'tendencia_cultura' || slide.useCultureLayout) && (
                <>
                  <div>
                    <label className="vc-label-sm">Texto abaixo da imagem (sandwich)</label>
                    <textarea
                      ref={sandwichBodyTaRef}
                      onFocus={() => { lastTextFieldRef.current = 'bodyAfter'; }}
                      onSelect={(e) => captureSelection('bodyAfterImage', e.currentTarget)}
                      onKeyUp={(e) => captureSelection('bodyAfterImage', e.currentTarget)}
                      value={slide.bodyAfterImage ?? ''}
                      onChange={(e) => {
                        const nw = e.target.value;
                        const old = slide.bodyAfterImage ?? '';
                        const ds = slide.destaqueSpans && typeof slide.destaqueSpans === 'object' ? slide.destaqueSpans : {};
                        const nextB = remapDestaqueSpansOnEdit(old, nw, ds.bodyAfterImage ?? []);
                        updateSlide({
                          bodyAfterImage: nw,
                          destaqueSpans: { ...ds, bodyAfterImage: nextB },
                        });
                      }}
                      rows={4}
                      placeholder={
                        'Parágrafo abaixo da foto no layout editorial. Marque Destaque na barra lateral ou mantenha **trecho** nos slides antigos.'
                      }
                      className="vc-input vc-textarea"
                      style={{ fontSize:17, color:'var(--text-secondary)', fontWeight:400 }}
                    />
                  </div>
                  <div>
                    <label className="vc-label-sm">Superfície (auto = claro/escuro alternado)</label>
                    <select
                      value={slide.cultureTone || ''}
                      onChange={e=>updateSlide({ cultureTone: e.target.value })}
                      className="vc-input"
                      style={{ fontSize:12, height:36 }}
                    >
                      <option value="">Automático</option>
                      <option value="light">Claro</option>
                      <option value="dark">Escuro</option>
                      <option value="accent">Cor Destaques da marca (superfície)</option>
                    </select>
                  </div>
                </>
              )}
              <button
                type="button"
                onMouseDown={(e) => {
                  if (refining) return;
                  e.preventDefault(); // mantém foco no textarea (desktop)
                  e.currentTarget.style.transform = 'scale(0.95)';
                }}
                onTouchStart={(e) => {
                  if (refining) return;
                  // Em touch o blur do textarea acontece ANTES do click — captura a seleção viva agora
                  const ae = typeof document !== 'undefined' ? document.activeElement : null;
                  if (ae === titleTaRef.current) captureSelection('title', titleTaRef.current);
                  else if (ae === subtitleTaRef.current) captureSelection('subtitle', subtitleTaRef.current);
                  else if (ae === sandwichBodyTaRef.current) captureSelection('bodyAfterImage', sandwichBodyTaRef.current);
                  e.currentTarget.style.transform = 'scale(0.95)';
                }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                onClick={marcarDestaque}
                disabled={refining}
                title="Aplica a cor Destaques da marca ao trecho selecionado (sem alterar o texto). Use no título, subtítulo ou bloco inferior."
                aria-label="Marcar destaque no texto selecionado"
                style={{
                  width:'100%', minHeight:36, borderRadius:9999, cursor: refining ? 'not-allowed' : 'pointer',
                  border:'1px solid var(--accent)', background:'var(--bg-pearl)', color:'var(--accent)',
                  fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  opacity: refining ? 0.5 : 1,
                  transition:'transform 0.1s var(--ease-smooth)',
                }}
              >
                <Highlighter size={15} aria-hidden />
                Marcar Destaque
              </button>
              <RefineBtn onRefine={refineSlide} busy={refining}/>
              <button
                onClick={()=>setHookVarsOpen(true)}
                disabled={refining}
                aria-label="Gerar variações de gancho"
                style={{
                  width:'100%', height:36, borderRadius:8, cursor:'pointer',
                  background:'var(--bg-card)', border:'1px solid var(--border)',
                  color:'var(--text-secondary)', fontSize:11, fontWeight:600, fontFamily:'var(--font-ui)',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 0.12s',
                }}
                onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
                onMouseLeave={e=>{e.currentTarget.style.color='var(--text-secondary)';e.currentTarget.style.borderColor='var(--border)';}}
              >
                <Zap size={11} style={{ color:'var(--accent)' }}/>Gerar 5 variações de gancho
              </button>
            </S>)}

            {(tab==='imagem'||tab==='slide') && (
              <PerSlideImageRefBlock
                slide={slide}
                onChangeExtra={(v) => updateSlide({ imgExtraPrompt: v })}
                onRemoveRef={() => updateSlide({ refImage: null })}
                onPickRef={() => openRefImagePicker(activeIdx)}
                onGenerateImage={() => generateSlideImageAt(activeIdx)}
                generateImageBusy={!!slideImgGenBusy[slide.id]}
                generateImageDisabled={
                  !(slide.imageQuery || '').trim() ||
                  (normalizeSlideImgMode(slide.imgMode) === 'dalle' && !hasOpenAI)
                }
              />
            )}

            {(tab==='imagem'||tab==='slide') && (<S title={slide.canvas?.enabled ? 'Imagem na área da foto' : 'Imagem de fundo'}>
              {slide.bgImage && (
                <div style={{ position:'relative', marginBottom:2, borderRadius:8, overflow:'hidden' }}>
                  <img
                    src={slide.bgImage}
                    alt=""
                    style={{
                      width:'100%',
                      height:80,
                      objectFit:'cover',
                      display:'block',
                      ...(sidebarBgPreviewFilter ? { filter: sidebarBgPreviewFilter } : {}),
                    }}
                  />
                  {/* overlay label showing query */}
                  {slide.imageQuery && (
                    <div style={{
                      position:'absolute', bottom:0, left:0, right:0,
                      background:'linear-gradient(transparent, rgba(0,0,0,0.7))',
                      padding:'12px 8px 6px', fontSize:9,
                      color:'rgba(255,255,255,0.65)', fontFamily:'var(--font-mono)',
                      letterSpacing:'0.04em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                    }}>{slide.imageQuery}</div>
                  )}
                  {/* action buttons */}
                  <div style={{ position:'absolute', top:5, right:5, display:'flex', gap:4 }}>
                    {slide.imageQuery && (
                      <button onClick={refreshImg} disabled={dalleLoading} title="Nova foto (mesmo tema)" style={{
                        background:'rgba(0,0,0,0.7)', border:'1px solid rgba(255,255,255,0.1)',
                        color:'#fff', padding:'4px 5px', borderRadius:5, cursor:dalleLoading?'wait':'pointer', display:'flex',
                        opacity:dalleLoading?0.45:1,
                      }}><RefreshCw size={10}/></button>
                    )}
                    <button onClick={()=>updateSlide({bgImage:null})} title="Remover imagem" style={{
                      background:'rgba(0,0,0,0.7)', border:'1px solid rgba(255,255,255,0.1)',
                      color:'#fff', padding:'4px 5px', borderRadius:5, cursor:'pointer', display:'flex',
                    }}><Trash2 size={10}/></button>
                  </div>
                </div>
              )}
              <div style={{
                fontSize:11, lineHeight:1.47, letterSpacing:'-0.011em', fontFamily:'var(--font-ui)',
                color:'var(--text-muted)',
                background:'var(--bg-pearl)', border:'1px solid var(--hairline)', borderRadius:11,
                padding:'8px 10px',
              }}>
                {hasOpenAI
                  ? 'Fundo: GPT Image 2. Buscar altera as palavras-chave; ⟳ gera outra imagem com o mesmo tema.'
                  : 'Para gerar fundos por IA, configure a chave OpenAI (⚙). Até lá: Upload ou URL.'}
              </div>

              {(() => {
                const bodyCv = (String(slide.bodyAfterImage || '')).trim();
                const sandwichLike =
                  (creativePreset === 'tendencia_cultura' || slide.useCultureLayout) &&
                  !!bodyCv &&
                  (!!slide.bgImage || slideHasPendingPhotoIntent(slide));
                const cultureStatFlatLike =
                  (creativePreset === 'tendencia_cultura' || slide.useCultureLayout) &&
                  !slide.bgImage &&
                  !slideHasPendingPhotoIntent(slide) &&
                  !!bodyCv &&
                  !!(String(slide.subtitle || '').trim());
                const photoInsetBlocked = !!slide.canvas?.enabled || sandwichLike || cultureStatFlatLike;
                const pr = normalizePhotoRegion(slide);
                return (
                  <div>
                    <div style={{
                      fontFamily:'var(--font-mono)',
                      fontSize:10,
                      letterSpacing:'0.06em',
                      fontWeight:600,
                      color:'var(--text-muted)',
                      textTransform:'uppercase',
                      marginBottom:6,
                    }}>Área da foto no card</div>
                    {photoInsetBlocked ? (
                      <div style={{
                        fontSize:11, lineHeight:1.47, color:'var(--text-muted)', fontFamily:'var(--font-ui)',
                        background:'var(--bg-pearl)', border:'1px solid var(--hairline)', borderRadius:11, padding:'8px 10px',
                      }}>
                        Faixa com margens e cantos arredondados só no <strong style={{ fontWeight:600 }}>layout clássico</strong>
                        {' '}(sem canvas e sem sanduíche cultura neste card).
                      </div>
                    ) : (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                        {PHOTO_REGION_GRID.map((row) => {
                          const active = pr === row.id;
                          return (
                            <button
                              key={row.id}
                              type="button"
                              onClick={() => updateSlide({ photoRegion: row.id })}
                              style={{
                                ...btnStyle(active),
                                flexDirection: 'column',
                                gap: 4,
                                padding: '8px 4px 6px',
                                minHeight: 72,
                              }}
                              aria-label={`${row.lab1} ${row.lab2}`}
                            >
                              <PhotoRegionMiniIcon regionId={row.id} active={active} />
                              <span style={{
                                fontSize:8,
                                fontWeight:600,
                                fontFamily:'var(--font-mono)',
                                letterSpacing:'0.04em',
                                lineHeight:1.15,
                                textAlign:'center',
                                color: active ? '#fff' : 'var(--text-muted)',
                              }}>
                                {row.lab1}<br />{row.lab2}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Action buttons */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[
                  { icon:Upload, label:'Upload', action:()=>fileInputRef.current?.click() },
                  { icon:LinkIcon, label:'URL', action:askUrlImg },
                  { icon:Search, label:'Buscar', action:()=>replaceImg() },
                  {
                    icon: Crop,
                    label: 'Recortar',
                    action: () => onOpenImageCrop?.(),
                    disabled: !slide.bgImage,
                  },
                ].map(({ icon: Icon, label, action, disabled })=>(
                  <button
                    key={label}
                    type="button"
                    onClick={action}
                    disabled={disabled}
                    style={{
                      background: disabled ? 'var(--bg-pearl)' : 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding:'8px 0',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      display:'flex', flexDirection:'column',
                      alignItems:'center', gap:4, transition:'all 0.12s',
                      color: 'var(--text-muted)',
                      opacity: disabled ? 0.55 : 1,
                    }}
                    onMouseEnter={(e)=>{
                      if (disabled) return;
                      e.currentTarget.style.color='var(--text-primary)';
                      e.currentTarget.style.borderColor='var(--accent)';
                    }}
                    onMouseLeave={(e)=>{
                      if (disabled) return;
                      e.currentTarget.style.color='var(--text-muted)';
                      e.currentTarget.style.borderColor='var(--border)';
                    }}
                  >
                    <Icon size={12}/><span style={{ fontSize:11, fontWeight:600, letterSpacing:'-0.011em' }}>{label}</span>
                  </button>
                ))}
              </div>

              {slide.imageQuery && (
                <div style={{
                  fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)',
                  background:'var(--accent-surface)', border:'1px solid rgba(0,0,0,0.1)',
                  borderRadius:8, padding:'6px 10px', lineHeight:1.5,
                }}>
                  {hasOpenAI ? 'GPT · ' : ''}Palavras-chave · &quot;{slide.imageQuery}&quot;
                </div>
              )}

              {slide.bgImage && (
                <>
                  {slide.canvas?.enabled && (
                    <div style={{
                      fontSize:11, lineHeight:1.47, letterSpacing:'-0.011em', fontFamily:'var(--font-ui)',
                      color:'var(--text-muted)',
                      background:'var(--bg-pearl)', border:'1px solid var(--hairline)', borderRadius:11,
                      padding:'8px 10px',
                    }}>
                      Com <strong style={{ fontWeight:600 }}>canvas</strong> ativo, o modo e o foco aplicam-se à{' '}
                      <strong style={{ fontWeight:600 }}>foto dentro da zona de imagem</strong> — arraste a moldura no preview para mudar o quadro.
                    </div>
                  )}
                  <div>
                    <div style={{
                      fontFamily:'var(--font-mono)',
                      fontSize:10,
                      letterSpacing:'0.06em',
                      fontWeight:600,
                      color:'var(--text-muted)',
                      textTransform:'uppercase',
                      marginBottom:6,
                    }}>Modo da imagem</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                      {IMAGE_MODE_PRESETS.map((m) => {
                        const on = activeImageModePresetId(slide) === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => updateSlide(m.patch)}
                            style={{
                              ...btnStyle(on),
                              flexDirection: 'column',
                              gap: 2,
                              padding: '8px 6px',
                              minHeight: 52,
                              textAlign: 'center',
                            }}
                            aria-label={`${m.label}: ${m.sub}`}
                          >
                            <span style={{ fontSize:11, fontWeight:600, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>{m.label}</span>
                            <span style={{ fontSize:9, fontFamily:'var(--font-ui)', opacity: on ? 0.92 : 1, color: on ? 'rgba(255,255,255,0.92)' : 'var(--text-muted)' }}>{m.sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{
                      fontFamily:'var(--font-mono)',
                      fontSize:10,
                      letterSpacing:'0.06em',
                      fontWeight:600,
                      color:'var(--text-muted)',
                      textTransform:'uppercase',
                      marginBottom:6,
                    }}>Foco no recorte</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                      {LAYOUTS.map((l) => {
                        const active = activeImageFocalLayoutId(slide) === l.id;
                        const [px, py] = IMAGE_FOCAL_XY[l.id];
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => updateSlide({ bgX: px, bgY: py })}
                            style={{
                              ...btnStyle(active),
                              flexDirection: 'column',
                              gap: 4,
                              padding: '8px 4px 6px',
                              minHeight: 76,
                            }}
                            aria-label={`Foco da imagem ${l.posLab[0]} ${l.posLab[1]}`}
                            title={`Ancorar recorte: ${l.posLab.join(' ')}`}
                          >
                            <ImageFocalMiniIcon layoutId={l.id} active={active} />
                            <span style={{
                              fontSize:8,
                              fontWeight:600,
                              fontFamily:'var(--font-mono)',
                              letterSpacing:'0.04em',
                              lineHeight:1.15,
                              textAlign:'center',
                              color: active ? '#fff' : 'var(--text-muted)',
                            }}>
                              {l.posLab[0]}<br />{l.posLab[1]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Slider label="Posição X fina" value={slide.bgX} min={0} max={100} onChange={v=>updateSlide({bgX:v})}/>
                  <Slider label="Posição Y fina" value={slide.bgY} min={0} max={100} onChange={v=>updateSlide({bgY:v})}/>
                  <Slider
                    label={bgFitKey === 'custom' ? 'Zoom (%)' : 'Escala do recorte'}
                    value={slide.bgZoom}
                    min={50}
                    max={300}
                    onChange={v=>updateSlide({bgZoom:v})}
                  />
                  <Slider label="Overlay escuro" value={slide.overlay} min={0} max={100} onChange={v=>updateSlide({overlay:v})}/>
                  <Slider label="Opacidade" value={slide.bgOpacity} min={0} max={100} onChange={v=>updateSlide({bgOpacity:v})}/>
                  <Toggle label="Espelhar horizontalmente" value={slide.bgMirror} onChange={v=>updateSlide({bgMirror:v})}/>
                </>
              )}
            </S>)}

            {(tab==='imagem'||tab==='slide') && (<S title="Padrão sobre o fundo" hint="Textura discreta por cima da cor e da foto (incluída nas exportações).">
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {BG_PATTERN_OPTIONS.map((opt) => {
                  const on = (slide.bgPattern ?? 'none') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateSlide({ bgPattern: opt.id })}
                      style={{
                        width:'100%',
                        textAlign:'left',
                        padding:'10px 12px',
                        borderRadius:10,
                        cursor:'pointer',
                        border:`1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                        background: on ? 'var(--accent-surface-strong)' : 'var(--bg-card)',
                        fontSize:12,
                        fontWeight:600,
                        fontFamily:'var(--font-ui)',
                        color:'var(--text-primary)',
                        letterSpacing:'-0.011em',
                        transition:'border-color 0.12s, background 0.12s',
                      }}
                    >{opt.label}</button>
                  );
                })}
              </div>
            </S>)}

            {(tab==='layout'||tab==='slide') && (<><details className="vc-adjust-details" style={{ border:'1px solid var(--hairline)', borderRadius:12, background:'var(--bg-card)' }}>
              <summary style={{
                padding:'10px 12px',
                cursor:'pointer',
                display:'flex',
                alignItems:'center',
                justifyContent:'space-between',
                fontFamily:'var(--font-mono)',
                fontSize:10,
                letterSpacing:'0.06em',
                fontWeight:600,
                color:'var(--text-secondary)',
                textTransform:'uppercase',
                userSelect:'none',
              }}>
                Grade de imagens
                <ChevronDown size={14} strokeWidth={2} style={{ opacity:0.45, flexShrink:0 }} aria-hidden />
              </summary>
              <div style={{ padding:'0 12px 12px' }}>
                <Toggle label="Mostrar grade" value={showPreviewAlignGrid} onChange={setShowPreviewAlignGrid} />
                <p style={{
                  margin:'8px 0 0',
                  fontSize:11,
                  lineHeight:1.47,
                  color:'var(--text-muted)',
                  fontFamily:'var(--font-ui)',
                  letterSpacing:'-0.011em',
                }}>
                  Grelha só no preview do editor — não entra nas exportações.
                </p>
              </div>
            </details>

            <details className="vc-adjust-details" open style={{ border:'1px solid var(--hairline)', borderRadius:12, background:'var(--bg-card)' }}>
              <summary style={{
                padding:'10px 12px',
                cursor:'pointer',
                display:'flex',
                alignItems:'center',
                justifyContent:'space-between',
                fontFamily:'var(--font-mono)',
                fontSize:10,
                letterSpacing:'0.06em',
                fontWeight:600,
                color:'var(--text-secondary)',
                textTransform:'uppercase',
                userSelect:'none',
              }}>
                Título & subtítulo
                <ChevronDown size={14} strokeWidth={2} style={{ opacity:0.45, flexShrink:0 }} aria-hidden />
              </summary>
              <div style={{ padding:'0 12px 12px', display:'flex', flexDirection:'column', gap:12 }}>
                {slide.canvas?.enabled && (
                  <div style={{
                    fontSize:11, lineHeight:1.47, letterSpacing:'-0.011em', fontFamily:'var(--font-ui)',
                    color:'var(--text-muted)',
                    background:'var(--bg-pearl)', border:'1px solid var(--hairline)', borderRadius:11,
                    padding:'8px 10px',
                  }}>
                    Com composição ativa, esta grelha afeta o posicionamento <strong style={{ fontWeight:600 }}>dentro</strong>
                    {' '}das zonas de texto do preview (junto com «Distância das bordas»).
                    Para mover o quadro inteiro no card, use o modo edição de zonas no preview e arraste a moldura.
                  </div>
                )}
                <div>
                  <div style={{
                    fontFamily:'var(--font-mono)',
                    fontSize:10,
                    letterSpacing:'0.06em',
                    fontWeight:600,
                    color:'var(--text-muted)',
                    textTransform:'uppercase',
                    marginBottom:6,
                  }}>Layout & posição</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                    {LAYOUTS.map((l) => {
                      const active = slide.layout === l.id;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => updateSlide({ layout: l.id })}
                          style={{
                            ...btnStyle(active),
                            flexDirection: 'column',
                            gap: 4,
                            padding: '8px 4px 6px',
                            minHeight: 76,
                          }}
                          aria-label={`${l.posLab[0]} ${l.posLab[1]}`}
                          title={`${l.posLab[0]} ${l.posLab[1]}`}
                        >
                          <LayoutMiniIcon layoutId={l.id} active={active} />
                          <span style={{
                            fontSize:8,
                            fontWeight:600,
                            fontFamily:'var(--font-mono)',
                            letterSpacing:'0.04em',
                            lineHeight:1.15,
                            textAlign:'center',
                            color: active ? '#fff' : 'var(--text-muted)',
                          }}>
                            {l.posLab[0]}<br />{l.posLab[1]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div style={{
                    fontFamily:'var(--font-mono)',
                    fontSize:10,
                    letterSpacing:'0.06em',
                    fontWeight:600,
                    color:'var(--text-muted)',
                    textTransform:'uppercase',
                    marginBottom:6,
                  }}>Alinhamento</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:4 }}>
                    {[
                      { id:'left', icon:AlignLeft, title:'Esquerda', short:'ESQ.' },
                      { id:'center', icon:AlignCenter, title:'Centro', short:'CENTRO' },
                      { id:'right', icon:AlignRight, title:'Direita', short:'DIR.' },
                      { id:'justify', icon:AlignJustify, title:'Justificar', short:'JUST.' },
                    ].map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => updateSlide({ align: a.id })}
                        style={{
                          ...btnStyle(slide.align === a.id),
                          flexDirection: 'column',
                          gap: 4,
                          padding: '8px 2px',
                          minHeight: 52,
                        }}
                        title={a.title}
                        aria-label={a.title}
                      >
                        <a.icon size={13} />
                        <span style={{
                          fontSize:8,
                          fontWeight:600,
                          fontFamily:'var(--font-mono)',
                          letterSpacing:'0.03em',
                          color: slide.align === a.id ? '#fff' : 'var(--text-muted)',
                        }}>{a.short}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <Toggle label="Glass ao redor do conteúdo" value={!!slide.textBg} onChange={(v) => updateSlide({ textBg: v })} />
                {slide.textBg && (
                  <Slider label="Opacidade do glass" value={slide.textBgOpacity ?? 55} min={10} max={90} onChange={(v) => updateSlide({ textBgOpacity: v })} />
                )}
                <Slider label="Distância das bordas" value={slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET} min={1} max={20} onChange={(v) => updateSlide({ textInset: v })} />
              </div>
            </details></>)}

            {(tab==='layout'||tab==='slide') && (<S
              title="Ajuste automático"
              hint="Cover e tipografia; com canvas reorganiza foto e todas as zonas de texto em conjunto (largura útil ~6%, espaçamentos entre foto/título/subtítulo ou topo/foto/rodapé) para caber dentro da margem do cartão e evitar cortes."
            >
              <button
                type="button"
                onClick={() => {
                  const p = slideAutoAdjustPatch(slide, { creativePreset, fmt });
                  if (!Object.keys(p).length) {
                    toast?.('Nada urgente a ajustar neste cartão.', 'info');
                    return;
                  }
                  updateSlide(p);
                  const parts = [];
                  if (p.bgFit != null || p.bgX != null || p.bgY != null || p.bgZoom != null) parts.push('foto a preencher a zona (cover)');
                  if (p.canvas) parts.push('zonas normalizadas');
                  if (p.titleSize != null || p.subSize != null || p.bodyAfterSize != null || p.titleLeading != null || p.subLeading != null || p.textInset != null) {
                    parts.push('tipografia calibrada');
                  }
                  if (p.layout != null || p.align != null) parts.push('bloco de texto reposicionado');
                  toast?.(`Ajuste aplicado: ${parts.join(' · ')}.`, 'success');
                }}
                style={{
                  width:'100%', minHeight:40, borderRadius:9999, cursor:'pointer',
                  border:'1px solid var(--accent)',
                  background:'var(--accent)', color:'#fff',
                  fontSize:13, fontWeight:400, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                  transition:'transform 0.1s var(--ease-smooth)',
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <SlidersHorizontal size={15} aria-hidden/>
                Ajuste automático
              </button>
            </S>)}

            {(tab==='texto'||tab==='slide') && (<S title="Tamanho">
              <Slider label="Tamanho título"    value={slide.titleSize} min={50} max={180} onChange={v=>updateSlide({titleSize:v})}/>
              <Slider label="Tamanho subtítulo" value={slide.subSize}   min={50} max={180} onChange={v=>updateSlide({subSize:v})}/>
              {(creativePreset === 'tendencia_cultura' || slide.useCultureLayout || !!(String(slide.bodyAfterImage || '').trim())) ? (
                <Slider
                  label="Tamanho — texto abaixo da foto"
                  value={slide.bodyAfterSize ?? slide.subSize ?? 100}
                  min={50}
                  max={180}
                  onChange={(v) => updateSlide({ bodyAfterSize: v })}
                />
              ) : null}
            </S>)}

            {(tab==='texto'||tab==='slide') && (<S title="Estilo do título" hint="Peso e caixa são os controles primários. Tracking/leading em «Ajustes avançados».">
              <div>
                <label className="vc-label-sm">
                  Peso da fonte
                </label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:4 }}>
                  {[400, 600, 700, 800].map(w => (
                    <button key={w} onClick={()=>updateSlide({titleWeight:w})}
                      style={{
                        padding:'7px 0', borderRadius:6, fontSize:11, cursor:'pointer',
                        fontWeight:w, fontFamily: effectiveTitleFontFamily(brand), transition:'all 0.12s',
                        background: (slide.titleWeight ?? 800) === w ? 'var(--text-primary)' : 'var(--bg-card)',
                        border: `1px solid ${(slide.titleWeight ?? 800) === w ? 'transparent' : 'var(--border)'}`,
                        color:    (slide.titleWeight ?? 800) === w ? 'var(--bg-base)'  : 'var(--text-secondary)',
                      }}
                    >{w}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="vc-label-sm">
                  Caixa
                </label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                  {[
                    { id:'normal', label:'Normal' },
                    { id:'upper',  label:'AaA → AAA' },
                    { id:'lower',  label:'AaA → aaa' },
                  ].map(c => (
                    <button key={c.id} onClick={()=>updateSlide({titleCase:c.id})}
                      style={{
                        padding:'7px 4px', borderRadius:6, fontSize:10, cursor:'pointer',
                        fontWeight:600, fontFamily:'var(--font-ui)', transition:'all 0.12s',
                        background: (slide.titleCase ?? 'normal') === c.id ? 'var(--text-primary)' : 'var(--bg-card)',
                        border: `1px solid ${(slide.titleCase ?? 'normal') === c.id ? 'transparent' : 'var(--border)'}`,
                        color:    (slide.titleCase ?? 'normal') === c.id ? 'var(--bg-base)'  : 'var(--text-secondary)',
                      }}
                    >{c.label}</button>
                  ))}
                </div>
              </div>
              {/* Ajustes avançados: tracking + leading do título.
                  Escondidos por default — reduz cognitive overload no
                  domínio Texto (90% dos users não vão mexer aqui). */}
              <details className="vc-adjust-details" style={{ marginTop:6, border:'1px solid var(--hairline)', borderRadius:11, background:'var(--bg-pearl)' }}>
                <summary style={{
                  padding:'10px 12px', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.06em',
                  fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase',
                  userSelect:'none',
                }}>
                  Ajustes avançados (título)
                  <ChevronDown size={14} strokeWidth={2} style={{ opacity:0.45, flexShrink:0 }} aria-hidden/>
                </summary>
                <div style={{ padding:'0 12px 12px' }}>
                  <Slider label="Entre letras (tracking)" value={slide.titleTracking ?? 0} min={-10} max={30} onChange={v=>updateSlide({titleTracking:v})}/>
                  <Slider label="Entre linhas (leading)"  value={slide.titleLeading ?? 105} min={80} max={180} onChange={v=>updateSlide({titleLeading:v})}/>
                </div>
              </details>
            </S>)}

            {/* Subtítulo: tracking/leading também vão atrás de details
                (são ajustes finos, não primary controls). */}
            {(tab==='texto'||tab==='slide') && (<S title="Estilo do subtítulo" hint="Ajustes finos de espaçamento em «Ajustes avançados».">
              <details className="vc-adjust-details" style={{ border:'1px solid var(--hairline)', borderRadius:11, background:'var(--bg-pearl)' }}>
                <summary style={{
                  padding:'10px 12px', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.06em',
                  fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase',
                  userSelect:'none',
                }}>
                  Ajustes avançados (subtítulo)
                  <ChevronDown size={14} strokeWidth={2} style={{ opacity:0.45, flexShrink:0 }} aria-hidden/>
                </summary>
                <div style={{ padding:'0 12px 12px' }}>
                  <Slider label="Entre letras (tracking)" value={slide.subTracking ?? 0} min={-10} max={30} onChange={v=>updateSlide({subTracking:v})}/>
                  <Slider label="Entre linhas (leading)"  value={slide.subLeading ?? 150} min={100} max={220} onChange={v=>updateSlide({subLeading:v})}/>
                </div>
              </details>
            </S>)}

            {(tab==='texto'||tab==='slide') && (<S title="Legibilidade">
              <Toggle label="Sombra no texto" value={slide.textShadow!==false} onChange={v=>updateSlide({textShadow:v})}/>
              <div style={{ marginTop:10, paddingTop:12, borderTop:'1px solid var(--hairline)' }}>
                <button
                  type="button"
                  disabled={!applyTypographyToAllCards || slides.length <= 1}
                  onClick={() => applyTypographyToAllCards?.()}
                  title={slides.length <= 1 ? 'Precisa de pelo menos dois cards' : 'Copia tamanhos, espaçamento e legibilidade para todos os slides'}
                  aria-label="Aplicar tipografia deste card a todos os slides"
                  style={{
                    width:'100%', minHeight:44,
                    padding:'0 16px',
                    borderRadius:9999,
                    border:'1px solid var(--accent)',
                    background:'var(--accent)',
                    color:'#fff',
                    fontSize:12,
                    fontWeight:600,
                    fontFamily:'var(--font-ui)',
                    letterSpacing:'-0.011em',
                    cursor: (!applyTypographyToAllCards || slides.length <= 1) ? 'not-allowed' : 'pointer',
                    opacity: (!applyTypographyToAllCards || slides.length <= 1) ? 0.45 : 1,
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    gap:8,
                    transition:'transform 0.1s var(--ease-smooth), opacity 0.12s',
                  }}
                  onMouseDown={e => { if (slides.length > 1 && applyTypographyToAllCards) e.currentTarget.style.transform = 'scale(0.95)'; }}
                  onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <Layers size={14} strokeWidth={2}/>
                  Aplicar em todos os cards
                </button>
                <p style={{
                  margin:'8px 0 0',
                  fontSize:11,
                  lineHeight:1.47,
                  letterSpacing:'-0.011em',
                  color:'var(--text-muted)',
                }}>
                  Usa os ajustes de <strong style={{ fontWeight:600, color:'var(--text-secondary)' }}>Tamanho</strong>,{' '}
                  <strong style={{ fontWeight:600, color:'var(--text-secondary)' }}>Espaçamento</strong>,
                  {' '}<strong style={{ fontWeight:600, color:'var(--text-secondary)' }}>Título &amp; subtítulo</strong>{' '}
                  e <strong style={{ fontWeight:600, color:'var(--text-secondary)' }}>Legibilidade</strong> deste card em todos os slides (não altera textos nem posição no grid).
                </p>
              </div>
            </S>)}

            {(tab==='layout'||tab==='slide') && (<S title="Operações">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[
                  { label:'Duplicar', icon:Copy, action:()=>duplicateSlide(activeIdx), disabled:false },
                  { label:'Apagar', icon:Trash2, action:()=>deleteSlide(activeIdx), disabled:slides.length<=1, danger:true },
                  { label:'Subir', icon:ArrowUp, action:()=>moveSlide(activeIdx,-1), disabled:activeIdx===0 },
                  { label:'Descer', icon:ArrowDown, action:()=>moveSlide(activeIdx,1), disabled:activeIdx===slides.length-1 },
                ].map(({label,icon:Icon,action,disabled,danger})=>(
                  <button key={label} onClick={action} disabled={disabled} style={{
                    background:'var(--bg-card)', border:'1px solid var(--border)',
                    borderRadius:8, padding:'8px 0', cursor:disabled?'not-allowed':'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    fontSize:11, fontWeight:600, fontFamily:'var(--font-ui)',
                    color: disabled ? 'var(--text-muted)' : danger ? '#f87171' : 'var(--text-secondary)',
                    opacity: disabled ? 0.35 : 1, transition:'all 0.12s',
                  }}
                  onMouseEnter={e=>{ if(!disabled) e.currentTarget.style.color = danger ? '#ef4444' : 'var(--text-primary)'; }}
                  onMouseLeave={e=>{ if(!disabled) e.currentTarget.style.color = danger ? '#f87171' : 'var(--text-secondary)'; }}
                  >
                    <Icon size={11}/>{label}
                  </button>
                ))}
              </div>
            </S>)}
          </>
        )}

        {/* Visual (FASE 1 Narrative OS): domínio dedicado ao mood/estética.
            Padrão Visual ganha protagonismo aqui — era enterrado na Marca. */}
        {tab==='visual' && (
          <>
            <div style={{
              padding:'4px 0 8px',
              fontSize:13, color:'var(--text-secondary)',
              fontFamily:'var(--font-ui)', letterSpacing:'-0.011em', lineHeight:1.5,
            }}>
              <strong style={{ color:'var(--text-primary)' }}>Escolha um padrão visual.</strong>
              {' '}Paleta, fontes e tipografia mudam de uma vez.
              Cada estilo tem uma assinatura própria (header bar, pill, ornaments…).
            </div>
            <VisualStylePicker
              value={visualPreset}
              onChange={applyVisualPresetCb}
              presets={VISUAL_PRESETS}
              title=""
            />
          </>
        )}

        {/* FASE 1 final + 6 domínios: outer cobre brand+visual+texto.
            Marca = identidade pura, Visual = mood/paletas, Texto = fontes. */}
        {(tab==='brand' || tab==='visual' || tab==='texto') && (
          <>
            {/* Switcher de perfis de marca — útil pra freelance/agência alternar entre clientes */}
            {tab==='brand' && setBrandsOpen && (
              <S title="Perfis de marca" hint="Salve combinações completas (cores, fontes, logo, bio, tom) e troque entre clientes/projetos com 1 clique.">
                <button
                  onClick={() => setBrandsOpen(true)}
                  style={{
                    width:'100%', padding:'10px 12px', borderRadius:9, cursor:'pointer',
                    background:'var(--bg-card)', border:'1px solid var(--border)',
                    display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
                    transition:'all 0.12s',
                  }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                    <div style={{ display:'flex', gap:2, flexShrink:0 }}>
                      {(() => {
                        const sw = hydrateBrandTextColors(brand);
                        return [brand.bg, brand.titleColor, sw.subtitleColor, sw.textColor, brand.accent];
                      })().map((c,i)=>(
                        <div key={i} style={{ width:14, height:14, borderRadius:3, background:c, border:'1px solid rgba(255,255,255,0.08)' }}/>
                      ))}
                    </div>
                    <div style={{ textAlign:'left', minWidth:0, flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {brandRoster.find(b => b.id === activeBrandId)?.name || 'Perfil personalizado'}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.04em' }}>
                        {brandRoster.length} {brandRoster.length === 1 ? 'perfil' : 'perfis'} salvos
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={13} color="var(--text-muted)"/>
                </button>
              </S>
            )}

            {/* Padrão Visual migrado pra aba Visual (FASE 1 Narrative OS).
                Marca agora foca em identidade pura: logo, handle, bio, tom. */}

            {tab==='texto' && (<S title="Texto nos slides" hint="Padrão da marca para tamanho, tracking e peso. Cards novos herdam; ajustes finos por card continuam em Cards.">
              <div>
                <div style={{
                  fontFamily:'var(--font-mono)',
                  fontSize:10,
                  letterSpacing:'0.06em',
                  fontWeight:600,
                  color:'var(--text-muted)',
                  textTransform:'uppercase',
                  marginBottom:6,
                }}>Tamanho</div>
                <Slider label="Tamanho título" value={brand.textTitleSize ?? 100} min={50} max={180} onChange={v => setBrand({ ...brand, textTitleSize: v })} />
                <Slider label="Tamanho subtítulo" value={brand.textSubSize ?? 100} min={50} max={180} onChange={v => setBrand({ ...brand, textSubSize: v })} />
                {(creativePreset === 'tendencia_cultura' || slides.some((s) => s.useCultureLayout || !!(String(s.bodyAfterImage || '').trim()))) ? (
                  <Slider
                    label="Tamanho — texto abaixo da foto"
                    value={brand.textBodyAfterSize ?? brand.textSubSize ?? 100}
                    min={50}
                    max={180}
                    onChange={(v) => setBrand({ ...brand, textBodyAfterSize: v })}
                  />
                ) : null}
              </div>
              <div style={{ marginTop: 4 }}>
                <div style={{
                  fontFamily:'var(--font-mono)',
                  fontSize:10,
                  letterSpacing:'0.06em',
                  fontWeight:600,
                  color:'var(--text-muted)',
                  textTransform:'uppercase',
                  marginBottom:6,
                }}>Espaçamento — Título</div>
                <Slider label="Entre letras (tracking)" value={brand.textTitleTracking ?? 0} min={-10} max={30} onChange={v => setBrand({ ...brand, textTitleTracking: v })} />
                <Slider label="Entre linhas (leading)" value={brand.textTitleLeading ?? 105} min={80} max={180} onChange={v => setBrand({ ...brand, textTitleLeading: v })} />
                <div>
                  <label className="vc-label-sm">Peso da fonte</label>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:4 }}>
                    {[400, 600, 700, 800].map(w => (
                      <button key={w} type="button" onClick={()=>setBrand({ ...brand, textTitleWeight: w })}
                        style={{
                          padding:'7px 0', borderRadius:6, fontSize:11, cursor:'pointer',
                          fontWeight:w, fontFamily: effectiveTitleFontFamily(brand), transition:'all 0.12s',
                          background: (brand.textTitleWeight ?? 800) === w ? 'var(--text-primary)' : 'var(--bg-card)',
                          border: `1px solid ${(brand.textTitleWeight ?? 800) === w ? 'transparent' : 'var(--border)'}`,
                          color:    (brand.textTitleWeight ?? 800) === w ? 'var(--bg-base)'  : 'var(--text-secondary)',
                        }}
                      >{w}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="vc-label-sm">Caixa do título</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                    {[
                      // Preview-as-label: cada botão mostra "Ab" renderizado no caso real
                      // — usuário vê o efeito antes de clicar. CSS textTransform faz o resto.
                      { id:'normal', label:'Aa',   title:'Como digitado (Title case)',  cssCase:'none',      hint:'Como digitado' },
                      { id:'upper',  label:'Aa',   title:'Tudo MAIÚSCULO',              cssCase:'uppercase', hint:'MAIÚSCULAS' },
                      { id:'lower',  label:'Aa',   title:'tudo minúsculo',              cssCase:'lowercase', hint:'minúsculas' },
                    ].map(c => {
                      const on = (brand.textTitleCase ?? 'normal') === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={()=>setBrand({ ...brand, textTitleCase: c.id })}
                          title={c.title}
                          aria-label={c.title}
                          aria-pressed={on}
                          style={{
                            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                            gap:2, padding:'8px 4px', borderRadius:8, cursor:'pointer',
                            fontFamily:'var(--font-ui)', transition:'all 0.12s',
                            background: on ? 'var(--text-primary)' : 'var(--bg-card)',
                            border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
                            color:    on ? 'var(--bg-base)' : 'var(--text-secondary)',
                          }}
                        >
                          {/* Preview tipográfico — o "Aa" é renderizado no caso real */}
                          <span style={{
                            fontSize:16, fontWeight:700, lineHeight:1, letterSpacing:'-0.02em',
                            textTransform: c.cssCase,
                          }}>{c.label}</span>
                          <span style={{
                            fontSize:9, fontFamily:'var(--font-mono)',
                            letterSpacing:'0.04em', textTransform:'uppercase',
                            opacity: on ? 0.85 : 0.6,
                          }}>{c.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 4 }}>
                <div style={{
                  fontFamily:'var(--font-mono)',
                  fontSize:10,
                  letterSpacing:'0.06em',
                  fontWeight:600,
                  color:'var(--text-muted)',
                  textTransform:'uppercase',
                  marginBottom:6,
                }}>Espaçamento — Subtítulo</div>
                <Slider label="Entre letras (tracking)" value={brand.textSubTracking ?? 0} min={-10} max={30} onChange={v => setBrand({ ...brand, textSubTracking: v })} />
                <Slider label="Entre linhas (leading)" value={brand.textSubLeading ?? 150} min={100} max={220} onChange={v => setBrand({ ...brand, textSubLeading: v })} />
              </div>
              <div style={{ marginTop:10, paddingTop:12, borderTop:'1px solid var(--hairline)' }}>
                <button
                  type="button"
                  onClick={() => applyBrandTypographyToAllSlides?.()}
                  aria-label="Aplicar tipografia da marca a todos os slides"
                  style={{
                    width:'100%', minHeight:44,
                    padding:'0 16px',
                    borderRadius:9999,
                    border:'1px solid var(--accent)',
                    background:'var(--accent)',
                    color:'#fff',
                    fontSize:12,
                    fontWeight:600,
                    fontFamily:'var(--font-ui)',
                    letterSpacing:'-0.011em',
                    cursor:'pointer',
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    gap:8,
                    transition:'transform 0.1s var(--ease-smooth)',
                  }}
                  onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                  onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <Layers size={14} strokeWidth={2}/>
                  Aplicar tipografia a todos os slides
                </button>
                <p style={{
                  margin:'8px 0 0',
                  fontSize:11,
                  lineHeight:1.47,
                  letterSpacing:'-0.011em',
                  color:'var(--text-muted)',
                }}>
                  Não altera textos nem layout — só copia os valores acima para cada card (como em Cards → Legibilidade → Aplicar em todos).
                </p>
              </div>
            </S>)}

            {tab==='brand' && (<S title="Perfil Instagram" hint="A foto do perfil aparece no círculo colorido ao lado do @ nos cards (aba Marca).">
              <div>
                <label className="vc-label-sm">@ Username</label>
                <input
                  value={brand.handle || ''}
                  onChange={e=>setBrand({...brand,handle:e.target.value})}
                  placeholder="@seu.perfil"
                  className="vc-input"
                />
              </div>
              <Toggle label="Mostrar @ nos slides" value={brand.showHandle} onChange={v=>setBrand({...brand,showHandle:v})}/>
              <details
                className="vc-adjust-details"
                style={{
                  marginTop: 10,
                  border: '1px solid var(--hairline)',
                  borderRadius: 11,
                  background: 'var(--bg-pearl)',
                }}
              >
                <summary style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  userSelect: 'none',
                }}>
                  Posição do @ no card
                  <ChevronDown size={14} strokeWidth={2} style={{ opacity: 0.45, flexShrink: 0 }} aria-hidden />
                </summary>
                <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.45, margin: 0, fontFamily: 'var(--font-ui)' }}>
                    Percentagem da largura e da altura do cartão — referência no canto superior esquerdo da pílula. Pode alinhar ao texto ou ao fundo.
                  </p>
                  <Slider label="Da esquerda (%)" value={brand.handleBadgeX ?? 5} min={0} max={100} onChange={(v) => setBrand({ ...brand, handleBadgeX: v })} />
                  <Slider label="Do topo (%)" value={brand.handleBadgeY ?? 4} min={0} max={100} onChange={(v) => setBrand({ ...brand, handleBadgeY: v })} />
                  <button
                    type="button"
                    onClick={() => setBrand({ ...brand, handleBadgeX: 5, handleBadgeY: 4 })}
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: 2,
                      fontSize: 11,
                      padding: '7px 14px',
                      borderRadius: 9999,
                      border: '1px solid var(--hairline)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-ui)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      letterSpacing: '-0.011em',
                    }}
                  >
                    Repor posição padrão
                  </button>
                </div>
              </details>
              <div style={{ marginTop: 10 }}>
                <label className="vc-label-sm">Foto no ícone do @</label>
                {brand.handleAvatar ? (
                  <>
                  <div style={{
                    display:'flex', alignItems:'center', gap:10,
                    background:'var(--bg-card)', border:'1px solid var(--border)',
                    borderRadius:9, padding:10, marginTop:4,
                  }}>
                    <div style={{
                      width:48, height:48, borderRadius:'50%', flexShrink:0,
                      overflow:'hidden',
                      border:'2px solid var(--hairline)',
                      background:`conic-gradient(from 45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)`,
                      padding:2, boxSizing:'border-box',
                    }}>
                    <div style={{
                      width:'100%', height:'100%', borderRadius:'50%', overflow:'hidden',
                      background:'#0a0a0a',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <img
                        src={brand.handleAvatar}
                        alt=""
                        draggable={false}
                        style={vcHandleAvatarImgStyle(brand)}
                      />
                    </div>
                  </div>
                    <div style={{ flex:1, fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', lineHeight:1.45 }}>
                      Aparece dentro do anel do badge nos cards.
                    </div>
                    <button
                      type="button"
                      onClick={() => setBrand({
                        ...brand,
                        handleAvatar: null,
                        handleAvatarPosX: 50,
                        handleAvatarPosY: 50,
                        handleAvatarRotate: 0,
                        handleAvatarZoom: 100,
                      })}
                      title="Remover foto do perfil"
                      style={{ width:30, height:30, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                    >
                      <Trash2 size={11}/>
                    </button>
                  </div>
                  <details
                    className="vc-adjust-details"
                    open
                    style={{
                      marginTop: 10,
                      border: '1px solid var(--hairline)',
                      borderRadius: 11,
                      background: 'var(--bg-pearl)',
                    }}
                  >
                    <summary style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.06em',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      userSelect: 'none',
                    }}>
                      Enquadramento 360° no círculo
                      <ChevronDown size={14} strokeWidth={2} style={{ opacity: 0.45, flexShrink: 0 }} aria-hidden />
                    </summary>
                    <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.45, margin: 0, fontFamily: 'var(--font-ui)' }}>
                        Posição, rotação e zoom valem só para a foto dentro do anel do @ nos cards.
                      </p>
                      <Slider label="Esquerda → direita" value={brand.handleAvatarPosX ?? 50} min={0} max={100} onChange={(v) => setBrand({ ...brand, handleAvatarPosX: v })} />
                      <Slider label="Topo → base" value={brand.handleAvatarPosY ?? 50} min={0} max={100} onChange={(v) => setBrand({ ...brand, handleAvatarPosY: v })} />
                      <Slider label="Rotação (°)" value={brand.handleAvatarRotate ?? 0} min={0} max={360} onChange={(v) => setBrand({ ...brand, handleAvatarRotate: v })} />
                      <Slider label="Zoom no círculo" value={brand.handleAvatarZoom ?? 100} min={85} max={200} onChange={(v) => setBrand({ ...brand, handleAvatarZoom: v })} />
                      <button
                        type="button"
                        onClick={() => setBrand({
                          ...brand,
                          handleAvatarPosX: 50,
                          handleAvatarPosY: 50,
                          handleAvatarRotate: 0,
                          handleAvatarZoom: 100,
                        })}
                        style={{
                          alignSelf: 'flex-start',
                          marginTop: 2,
                          fontSize: 11,
                          padding: '7px 14px',
                          borderRadius: 9999,
                          border: '1px solid var(--hairline)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-ui)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          letterSpacing: '-0.011em',
                        }}
                      >
                        Repor enquadramento
                      </button>
                    </div>
                  </details>
                  </>
                ) : (
                  // Drop-zone do avatar do @: borda sólida hairline, ícone num
                  // círculo accent-surface; hover puxa fundo accent-surface sem
                  // mudar borda pra accent (evita o "tracejado vermelho" agressivo).
                  <label
                    style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'12px 14px', minHeight:60, borderRadius:11,
                      cursor:'pointer', marginTop:6,
                      background:'var(--bg-card)', border:'1px solid var(--hairline)',
                      color:'var(--text-secondary)',
                      fontFamily:'var(--font-ui)',
                      transition:'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth)',
                    }}
                    onMouseEnter={e=>{
                      e.currentTarget.style.borderColor='var(--accent)';
                      e.currentTarget.style.background='var(--accent-surface)';
                    }}
                    onMouseLeave={e=>{
                      e.currentTarget.style.borderColor='var(--hairline)';
                      e.currentTarget.style.background='var(--bg-card)';
                    }}
                  >
                    <span style={{
                      width:32, height:32, borderRadius:'50%', flexShrink:0,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      background:'var(--accent-surface)', color:'var(--accent)',
                    }} aria-hidden>
                      <Upload size={14} strokeWidth={2.25}/>
                    </span>
                    <span style={{ display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', lineHeight:1.3 }}>
                        Carregar foto de perfil
                      </span>
                      <span style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:'-0.005em' }}>
                        PNG · JPG · WebP — até 2&nbsp;MB
                      </span>
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display:'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          toast?.('Imagem muito grande. Máximo 2MB.', 'error');
                          e.target.value = '';
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => setBrand({ ...brand, handleAvatar: reader.result });
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            </S>)}

            {tab==='brand' && (creativePreset === 'tendencia_cultura' || slides.some((s) => s.useCultureLayout)) && (
              <S title="Barra editorial (opcional)" hint="Aparece fina no topo dos cards no pacote Tendência/Cultura, como nas referências tipo brandsdecoded.">
                <div>
                  <label className="vc-label-sm">Texto à esquerda (ex.: Powered by…)</label>
                  <input
                    value={brand.cultureHeaderLeft ?? ''}
                    onChange={e=>setBrand({ ...brand, cultureHeaderLeft: e.target.value })}
                    className="vc-input"
                    placeholder="Powered by Content Machine"
                    style={{ fontSize:12 }}
                  />
                </div>
                <div>
                  <label className="vc-label-sm">Ano (direita)</label>
                  <input
                    value={brand.cultureHeaderYear ?? ''}
                    onChange={e=>setBrand({ ...brand, cultureHeaderYear: e.target.value })}
                    className="vc-input"
                    placeholder="2026"
                    style={{ fontSize:12 }}
                  />
                </div>
              </S>
            )}

            {tab==='brand' && (<S title="Logo da marca" hint="Aplicado automaticamente em todos os cards. PNG transparente é o ideal.">
              {brand.logo ? (
                <div style={{
                  display:'flex', alignItems:'center', gap:10,
                  background:'var(--bg-card)', border:'1px solid var(--border)',
                  borderRadius:9, padding:10,
                }}>
                  <div style={{
                    width:54, height:54, borderRadius:6, flexShrink:0,
                    background:`url(${brand.logo}) center/contain no-repeat`,
                    border:'1px solid var(--border)',
                    backgroundColor:'rgba(255,255,255,0.04)',
                  }}/>
                  <div style={{ flex:1, fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', lineHeight:1.45 }}>
                    Logo aplicada · canto {{ tl:'sup. esquerdo', tr:'sup. direito', bl:'inf. esquerdo', br:'inf. direito' }[brand.logoPosition || 'tr']}
                  </div>
                  <button
                    onClick={() => setBrand({ ...brand, logo: null })}
                    title="Remover logo"
                    style={{ width:30, height:30, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                  >
                    <Trash2 size={11}/>
                  </button>
                </div>
              ) : (
                // Mesmo padrão drop-zone do avatar: borda sólida hairline,
                // ícone num círculo accent, hover = fundo accent-surface.
                <label
                  style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'12px 14px', minHeight:60, borderRadius:11,
                    cursor:'pointer',
                    background:'var(--bg-card)', border:'1px solid var(--hairline)',
                    color:'var(--text-secondary)',
                    fontFamily:'var(--font-ui)',
                    transition:'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth)',
                  }}
                  onMouseEnter={e=>{
                    e.currentTarget.style.borderColor='var(--accent)';
                    e.currentTarget.style.background='var(--accent-surface)';
                  }}
                  onMouseLeave={e=>{
                    e.currentTarget.style.borderColor='var(--hairline)';
                    e.currentTarget.style.background='var(--bg-card)';
                  }}
                >
                  <span style={{
                    width:32, height:32, borderRadius:'50%', flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background:'var(--accent-surface)', color:'var(--accent)',
                  }} aria-hidden>
                    <Upload size={14} strokeWidth={2.25}/>
                  </span>
                  <span style={{ display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', lineHeight:1.3 }}>
                      Carregar logo da marca
                    </span>
                    <span style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:'-0.005em' }}>
                      PNG · JPG · SVG — até 2&nbsp;MB (PNG transparente é o ideal)
                    </span>
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    style={{ display:'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) {
                        toast?.('Imagem muito grande. Máximo 2MB.', 'error');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => setBrand({ ...brand, logo: reader.result });
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
              {brand.logo && (
                <>
                  <div>
                    <label className="vc-label-sm">Posição</label>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4 }}>
                      {[
                        { id:'tl', label:'↖' },
                        { id:'tr', label:'↗' },
                        { id:'bl', label:'↙' },
                        { id:'br', label:'↘' },
                      ].map(p => {
                        const on = (brand.logoPosition || 'tr') === p.id;
                        return (
                          <button key={p.id} onClick={()=>setBrand({...brand, logoPosition: p.id})}
                            style={{
                              padding:'8px 0', borderRadius:6, fontSize:14, cursor:'pointer',
                              background: on ? 'var(--text-primary)' : 'var(--bg-card)',
                              border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
                              color: on ? 'var(--bg-base)' : 'var(--text-secondary)',
                              fontWeight:700,
                            }}
                          >{p.label}</button>
                        );
                      })}
                    </div>
                  </div>
                  <Slider label="Tamanho da logo" value={brand.logoSize ?? 30} min={20} max={80} onChange={v=>setBrand({...brand, logoSize: v})}/>
                  <Slider label="Opacidade" value={brand.logoOpacity ?? 90} min={20} max={100} onChange={v=>setBrand({...brand, logoOpacity: v})}/>
                </>
              )}
            </S>)}

            {tab==='brand' && (<S title="Identidade verbal" hint="Esses campos viram contexto da IA em toda geração — quanto mais preciso, mais consistente o carrossel fica.">
              <div>
                <label className="vc-label-sm">Bio / o que faço</label>
                <textarea
                  value={brand.bio || ''} onChange={e=>setBrand({...brand,bio:e.target.value})} rows={2}
                  placeholder="Ex: Estrategista de marca para indústria estética. Decodifico mercado e marcas."
                  className="vc-input vc-textarea" style={{ resize:'vertical', minHeight:54 }}
                />
              </div>
              <div>
                <label className="vc-label-sm">Posicionamento</label>
                <textarea
                  value={brand.positioning || ''} onChange={e=>setBrand({...brand,positioning:e.target.value})} rows={2}
                  placeholder="Ex: Conteúdo estratégico, sem motivacional. Dois passos à frente do óbvio."
                  className="vc-input vc-textarea" style={{ resize:'vertical', minHeight:54 }}
                />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div>
                  <label className="vc-label-sm">Tom padrão</label>
                  <input
                    value={brand.defaultTone || ''} onChange={e=>setBrand({...brand,defaultTone:e.target.value})}
                    placeholder="Ex: direto, provocativo"
                    className="vc-input"
                  />
                </div>
                <div>
                  <label className="vc-label-sm">Público</label>
                  <input
                    value={brand.defaultAudience || ''} onChange={e=>setBrand({...brand,defaultAudience:e.target.value})}
                    placeholder="Ex: empreendedores"
                    className="vc-input"
                  />
                </div>
              </div>
              <div>
                <label className="vc-label-sm">Assinatura / CTA recorrente</label>
                <input
                  value={brand.signature || ''} onChange={e=>setBrand({...brand,signature:e.target.value})}
                  placeholder='Ex: "Salve para revisar antes da próxima campanha."'
                  className="vc-input"
                />
              </div>
              <div>
                <label className="vc-label-sm">Links / site / portfolio</label>
                <input
                  value={brand.links || ''} onChange={e=>setBrand({...brand,links:e.target.value})}
                  placeholder="Ex: site.com.br · linktr.ee/marca"
                  className="vc-input"
                />
              </div>
            </S>)}

            {tab==='visual' && (<><S title="Paletas prontas">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {PALETTES.map(p=>(
                  <button
                    key={p.name}
                    type="button"
                    className="palette-swatch"
                    onClick={() =>
                      setBrand((b) => ({
                        ...b,
                        bg: p.bg,
                        titleColor: p.title,
                        subtitleColor: p.subtitle,
                        textColor: p.text,
                        accent: p.accent,
                      }))
                    }
                    style={{
                      background:'var(--bg-card)',
                      border: brandMatchesPalette(brand, p)
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border)',
                      borderRadius:8, padding:'10px 10px 8px', textAlign:'left', cursor:'pointer',
                      transition:'all 0.15s',
                    }}
                  >
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
                      {[p.bg, p.title, p.subtitle, p.text, p.accent].map((c,i)=>(
                        <div key={i} style={{ width:18, height:18, borderRadius:4, background:c, border:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}/>
                      ))}
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', fontWeight:600, letterSpacing:'0.02em' }}>{p.name}</div>
                  </button>
                ))}
              </div>
            </S>

            <S title="Cores manuais" hint="Título = primeira e última folha · Subtítulo = linha curta nos slides do meio · Texto = parágrafos e blocos de corpo (sanduíche inclusive). Destaques = trechos marcados no editor.">
              <ColorRow label="Fundo" value={brand.bg} onChange={v=>setBrand({...brand,bg:v})}/>
              <Toggle
                label="Intercalar fundo entre cards"
                value={!!brand.interleaveBg}
                onChange={(v) => setBrand({
                  ...brand,
                  interleaveBg: v,
                  ...((v && !(String(brand.bgAlternate || '').trim())) ? { bgAlternate: '#f5f5f7' } : {}),
                })}
              />
              {brand.interleaveBg ? (
                <div style={{
                  fontSize:11, lineHeight:1.47, letterSpacing:'-0.011em', fontFamily:'var(--font-ui)',
                  color:'var(--text-muted)', marginTop:-4, marginBottom:2,
                }}>
                  Slides 1 e 3 usam «Fundo» · 2 e 4 usam a segunda cor. Um «Fundo por slide» substitui esta regra nesse card.
                </div>
              ) : null}
              {brand.interleaveBg ? (
                <ColorRow
                  label="Segundo fundo"
                  value={(brand.bgAlternate && String(brand.bgAlternate).trim()) ? brand.bgAlternate : '#f5f5f7'}
                  onChange={v=>setBrand({ ...brand, bgAlternate: v })}
                />
              ) : null}
              {(() => {
                const bh = hydrateBrandTextColors(brand);
                const activeBgImage = slides[activeIdx]?.bgImage;
                return (
                  <>
                    <ColorRow label="Título" value={bh.titleColor} onChange={v=>setBrand({...brand,titleColor:v})} contrastBg={brand.bg} contrastKind="large"/>
                    <ColorRow label="Subtítulo (meio)" value={bh.subtitleColor} onChange={v=>setBrand({...brand,subtitleColor:v})} contrastBg={brand.bg} contrastKind="body"/>
                    <ColorRow label="Texto" value={bh.textColor} onChange={v=>setBrand({...brand,textColor:v})} contrastBg={brand.bg} contrastKind="body"/>
                    <ColorRow label="Destaques" value={brand.accent} onChange={v=>setBrand({...brand,accent:v})} contrastBg={brand.bg} contrastKind="body"/>
                    {activeBgImage ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const hex = await extractDominantColor(activeBgImage);
                          if (hex) {
                            setBrand({ ...brand, accent: hex });
                            toast(`Cor de destaque extraída da foto: ${hex}`, 'success');
                          } else {
                            toast('Não consegui extrair cor dominante (imagem muito uniforme?).', 'warning');
                          }
                        }}
                        style={{
                          marginTop: 6, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                          background: 'var(--bg-card)', border: '1px solid var(--border)',
                          color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-ui)',
                          letterSpacing: '-0.011em', textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}
                      >
                        <Sparkles size={14} style={{ color: 'var(--accent)' }} aria-hidden/>
                        <span>Usar cor dominante da foto do card atual como «Destaques»</span>
                      </button>
                    ) : null}
                  </>
                );
              })()}
            </S>
            </>)}

            {tab==='texto' && (<>
            <S title="Fontes próprias (ficheiro)" hint="WOFF2, WOFF, TTF ou OTF até 5MB. As listas abaixo (Google) ficam como reserva se o ficheiro não tiver todos os pesos.">
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label className="vc-label-sm">Ficheiro — títulos da marca</label>
                  {brand.customTitleFont?.dataUrl ? (
                    <div style={{
                      display:'flex', alignItems:'center', gap:10, marginTop:4,
                      background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:9, padding:10,
                    }}>
                      <div
                        style={{
                          fontSize:18, fontWeight:600, color:'var(--text-primary)', fontFamily: effectiveTitleFontFamily(brand),
                          letterSpacing:'-0.022em', lineHeight:1, flex:1, minWidth:0,
                        }}
                      >
                        Aa
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={brand.customTitleFont.fileName}>
                        {brand.customTitleFont.fileName || 'fonte-título'}
                      </div>
                      <button
                        type="button"
                        onClick={() => setBrand({ ...brand, customTitleFont: null })}
                        title="Remover fonte de título"
                        style={{ width:30, height:30, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
                      >
                        <Trash2 size={11}/>
                      </button>
                    </div>
                  ) : (
                    <label
                      style={{
                        display:'flex', alignItems:'center', gap:12,
                        padding:'10px 14px', minHeight:54, borderRadius:11,
                        cursor:'pointer', marginTop:6,
                        background:'var(--bg-card)', border:'1px solid var(--hairline)',
                        fontFamily:'var(--font-ui)',
                        transition:'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth)',
                      }}
                      onMouseEnter={e=>{
                        e.currentTarget.style.borderColor='var(--accent)';
                        e.currentTarget.style.background='var(--accent-surface)';
                      }}
                      onMouseLeave={e=>{
                        e.currentTarget.style.borderColor='var(--hairline)';
                        e.currentTarget.style.background='var(--bg-card)';
                      }}
                    >
                      <span style={{
                        width:30, height:30, borderRadius:'50%', flexShrink:0,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        background:'var(--accent-surface)', color:'var(--accent)',
                      }} aria-hidden>
                        <Upload size={13} strokeWidth={2.25}/>
                      </span>
                      <span style={{ display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', lineHeight:1.3 }}>
                          Carregar fonte do título
                        </span>
                        <span style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:'-0.005em' }}>
                          WOFF2 · WOFF · TTF · OTF — até 5&nbsp;MB
                        </span>
                      </span>
                      <input
                        type="file"
                        accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                        style={{ display:'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const max = 5 * 1024 * 1024;
                          if (file.size > max) {
                            toast?.('Ficheiro demasiado grande. Máximo 5MB.', 'error');
                            e.target.value = '';
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => setBrand({
                            ...brand,
                            customTitleFont: {
                              dataUrl: reader.result,
                              format: guessFontFileFormat(file),
                              fileName: file.name,
                            },
                          });
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
                <div>
                  <label className="vc-label-sm">Ficheiro — corpo / subtítulo</label>
                  {brand.customBodyFont?.dataUrl ? (
                    <div style={{
                      display:'flex', alignItems:'center', gap:10, marginTop:4,
                      background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:9, padding:10,
                    }}>
                      <div
                        style={{
                          fontSize:14, fontWeight:400, color:'var(--text-primary)', fontFamily: effectiveBodyFontFamily(brand),
                          letterSpacing:'-0.011em', lineHeight:1.35, flex:1, minWidth:0,
                        }}
                      >
                        Texto de exemplo
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={brand.customBodyFont.fileName}>
                        {brand.customBodyFont.fileName || 'fonte-corpo'}
                      </div>
                      <button
                        type="button"
                        onClick={() => setBrand({ ...brand, customBodyFont: null })}
                        title="Remover fonte de corpo"
                        style={{ width:30, height:30, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
                      >
                        <Trash2 size={11}/>
                      </button>
                    </div>
                  ) : (
                    <label
                      style={{
                        display:'flex', alignItems:'center', gap:12,
                        padding:'10px 14px', minHeight:54, borderRadius:11,
                        cursor:'pointer', marginTop:6,
                        background:'var(--bg-card)', border:'1px solid var(--hairline)',
                        fontFamily:'var(--font-ui)',
                        transition:'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth)',
                      }}
                      onMouseEnter={e=>{
                        e.currentTarget.style.borderColor='var(--accent)';
                        e.currentTarget.style.background='var(--accent-surface)';
                      }}
                      onMouseLeave={e=>{
                        e.currentTarget.style.borderColor='var(--hairline)';
                        e.currentTarget.style.background='var(--bg-card)';
                      }}
                    >
                      <span style={{
                        width:30, height:30, borderRadius:'50%', flexShrink:0,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        background:'var(--accent-surface)', color:'var(--accent)',
                      }} aria-hidden>
                        <Upload size={13} strokeWidth={2.25}/>
                      </span>
                      <span style={{ display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', lineHeight:1.3 }}>
                          Carregar fonte do corpo
                        </span>
                        <span style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:'-0.005em' }}>
                          WOFF2 · WOFF · TTF · OTF — até 5&nbsp;MB
                        </span>
                      </span>
                      <input
                        type="file"
                        accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                        style={{ display:'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const max = 5 * 1024 * 1024;
                          if (file.size > max) {
                            toast?.('Ficheiro demasiado grande. Máximo 5MB.', 'error');
                            e.target.value = '';
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => setBrand({
                            ...brand,
                            customBodyFont: {
                              dataUrl: reader.result,
                              format: guessFontFileFormat(file),
                              fileName: file.name,
                            },
                          });
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </S>

            <FontPairingPicker
              brand={brand}
              onApply={(p) => setBrand({
                ...brand,
                titleFont: p.titleFont,
                bodyFont: p.bodyFont,
                textTitleWeight: clampTitleWeight(p.titleFont, p.textTitleWeight),
              })}
            >
              <FontPicker title="Fonte — Título" fonts={TITLE_FONTS} active={brand.titleFont} onChange={val=>setBrand({...brand,titleFont:val})}/>
              <FontPicker title="Fonte — Corpo"  fonts={BODY_FONTS}  active={brand.bodyFont}  onChange={val=>setBrand({...brand,bodyFont:val})}/>
            </FontPairingPicker>
            </>)}
          </>
        )}

        {/* Conteúdo base agora vive dentro de Narrativa (FASE 1 merge) —
            matéria-prima da IA pertence ao domínio narrativo. */}
        {tab==='narrativa' && (
          <>
            <S
              title="Conteúdo base"
              hint="Texto, anotação ou rascunho que a IA usará como matéria-prima ao gerar/refinar slides. Pode ser longo."
            >
              <textarea
                value={material.content || ''}
                onChange={e => setMaterial({ ...material, content: e.target.value })}
                rows={8}
                placeholder={'Ex: cole aqui sua transcrição de aula, post antigo, outline do tema, ' +
                  'pesquisa de mercado, depoimentos de clientes, notas de leitura...\n\n' +
                  'A IA usa este texto como base de fatos antes de inventar.'}
                className="vc-input vc-textarea"
                style={{ minHeight:140, resize:'vertical', lineHeight:1.5 }}
              />
              {normalizeMaterialField(material.content) ? (
                <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.04em', textAlign:'right' }}>
                  {normalizeMaterialField(material.content).length.toLocaleString('pt-BR')} caracteres
                </div>
              ) : null}
            </S>

            <S
              title="Fontes & referências"
              hint="URLs (uma por linha ou várias separadas por espaço): ao gerar o carrossel, o app tenta ler o texto da página no servidor e envia esse conteúdo à IA — sem isso os modelos não abrem links. Sites com paywall, login forte ou só JavaScript podem falhar."
            >
              <textarea
                value={material.sources || ''}
                onChange={e => setMaterial({ ...material, sources: e.target.value })}
                rows={6}
                placeholder={'https://hbr.org/...\n' +
                  'Pesquisa Edelman Trust Barometer 2026\n' +
                  '"O luxo deixou de ser status. Virou tempo." — entrevista X\n' +
                  '@autor.referência'}
                className="vc-input vc-textarea"
                style={{ minHeight:110, resize:'vertical', lineHeight:1.5, fontFamily:'var(--font-mono)', fontSize:11 }}
              />
            </S>

            <S
              title="Contexto extra para o prompt"
              hint="Instruções específicas que a IA deve seguir nesta geração. Sobrepõe regras default."
            >
              <textarea
                value={material.context || ''}
                onChange={e => setMaterial({ ...material, context: e.target.value })}
                rows={4}
                placeholder={'Ex: "Evite jargão técnico, foque em casos brasileiros. ' +
                  'Use linguagem mais informal. Cite dados quando relevante. ' +
                  'Não use a palavra X. Termine sempre com pergunta provocativa."'}
                className="vc-input vc-textarea"
                style={{ minHeight:80, resize:'vertical', lineHeight:1.5 }}
              />
            </S>

            <S title="Atalhos rápidos">
              {/* Hierarquia: CTA primário full-width, Limpar como link sutil.
                  Era grid 1fr-1fr que forçava 'Gerar com este material' a
                  quebrar em 2 linhas (apertado e feio). */}
              <button
                onClick={() => setSetupOpen(true)}
                style={{
                  width:'100%', height:44, borderRadius:9999, cursor:'pointer',
                  background:'var(--accent)', border:'none',
                  color:'#fff', fontSize:14, fontWeight:600, fontFamily:'var(--font-ui)',
                  letterSpacing:'-0.011em',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  whiteSpace:'nowrap',
                  transition:'background-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
                }}
              >
                <Sparkles size={14}/>Gerar com este material
              </button>
              <button
                onClick={() => setMaterial({ ...material, content: '', sources: '', context: '', refProfileId: null })}
                disabled={!materialHasUserInput(material)}
                style={{
                  alignSelf:'center', minHeight:32, padding:'4px 12px',
                  cursor: !materialHasUserInput(material) ? 'not-allowed' : 'pointer',
                  border:'none', background:'transparent',
                  color:'var(--text-muted)', fontSize:11, fontFamily:'var(--font-ui)',
                  letterSpacing:'-0.005em',
                  display:'inline-flex', alignItems:'center', gap:5,
                  opacity: !materialHasUserInput(material) ? 0.4 : 1,
                  transition:'color 0.12s',
                }}
              >
                <Trash2 size={11}/>Limpar tudo
              </button>
            </S>
          </>
        )}

        {/* HOME / Storyboard — visão geral do projeto. Sequência de cards,
            estatísticas, fluxo narrativo. "Mesa criativa" cinematográfica. */}
        {tab==='home' && (
          <>
            {/* Saudação + status */}
            <div style={{
              padding: '18px 16px',
              borderRadius: 16,
              border: '1px solid var(--glass-border-strong)',
              background: 'linear-gradient(135deg, rgba(255,45,141,0.10) 0%, rgba(143,125,255,0.06) 100%)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              boxShadow: '0 0 32px rgba(255, 45, 141, 0.10), inset 0 1px 0 rgba(255,255,255,0.10)',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                marginBottom: 6, fontFamily: 'var(--font-mono)',
              }}>
                Storyboard
              </div>
              <div style={{
                fontSize: 18, fontWeight: 600, color: 'var(--text-primary)',
                letterSpacing: '-0.016em', lineHeight: 1.25, marginBottom: 4,
                fontFamily: 'var(--font-display)',
              }}>
                {activeEntry?.name || 'Carrossel sem título'}
              </div>
              <div style={{
                fontSize: 12, color: 'var(--text-muted)',
                letterSpacing: '-0.005em',
              }}>
                {slides.length} card{slides.length === 1 ? '' : 's'} ·
                {' '}{slides.filter(s => s.bgImage).length} com imagem ·
                {' '}{slides.filter(s => (s.title || '').trim()).length} com título
              </div>
            </div>

            {/* Fluxo narrativo — mini-thumbs vertical */}
            <S title="Fluxo da narrativa" hint="Sequência dos cards e progressão. Clique pra editar.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {slides.map((s, i) => {
                  const isActive = i === activeIdx;
                  const hasImg = !!s.bgImage;
                  const titlePreview = (s.title || '').trim().slice(0, 50) || '— sem título —';
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: 10, borderRadius: 12,
                        border: `1px solid ${isActive ? 'rgba(255, 45, 141, 0.42)' : 'var(--glass-border)'}`,
                        background: isActive
                          ? 'linear-gradient(135deg, rgba(255,45,141,0.10) 0%, rgba(255,45,141,0.03) 100%)'
                          : 'rgba(255, 255, 255, 0.04)',
                        cursor: 'pointer', textAlign: 'left',
                        boxShadow: isActive
                          ? '0 0 16px rgba(255, 45, 141, 0.16), inset 0 1px 0 rgba(255,255,255,0.08)'
                          : 'none',
                        transition: 'all 0.18s var(--ease-smooth)',
                      }}
                    >
                      {/* Mini thumb */}
                      <div style={{
                        width: 40, height: 50, borderRadius: 6, flexShrink: 0,
                        background: hasImg
                          ? `url(${s.bgImage}) center/cover, ${s.bg || brand.bg || '#0a0a0a'}`
                          : (s.bg || brand.bg || '#0a0a0a'),
                        border: '1px solid var(--glass-border)',
                        position: 'relative',
                      }}>
                        <span style={{
                          position: 'absolute', bottom: 2, left: 3,
                          fontSize: 8, fontWeight: 700, color: '#fff',
                          fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                        }}>{String(i + 1).padStart(2, '0')}</span>
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 600,
                          color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                          letterSpacing: '-0.011em',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          marginBottom: 2,
                        }}>{titlePreview}</div>
                        <div style={{
                          fontSize: 10, color: 'var(--text-muted)',
                          letterSpacing: '-0.005em',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          {hasImg && <><ImageIcon size={9}/>foto</>}
                          {hasImg && (s.title || '').trim() && <span style={{ opacity: 0.5 }}>·</span>}
                          {(s.title || '').trim() && <><Type size={9}/>texto</>}
                          {!hasImg && !(s.title || '').trim() && <span style={{ color: 'var(--text-muted)' }}>vazio</span>}
                        </div>
                      </div>
                      {isActive && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: 'var(--accent)',
                          fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                        }}>Ativo</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </S>

            {/* Ação rápida — gerar novo */}
            <S title="Ações rápidas">
              <button
                onClick={() => setSetupOpen?.(true)}
                style={{
                  width: '100%', minHeight: 48, borderRadius: 9999,
                  background: 'linear-gradient(135deg, #ff2d8d 0%, #ff4fa1 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.10)',
                  color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-ui)',
                  letterSpacing: '-0.011em', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 8px 24px rgba(255, 45, 141, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
                }}
              >
                <Sparkles size={15}/>Novo carrossel com IA
              </button>
            </S>
          </>
        )}

        {/* Narrativa (FASE 1): IA + Conteúdo gradual. Por enquanto só os
            controles que estavam na aba IA (gerar/refinar/legenda/tom). */}
        {tab==='narrativa' && (
          <>
            <S title="Gerar conteúdo">
              <button onClick={()=>setSetupOpen(true)} style={{
                width:'100%', height:44, borderRadius:9999, border:'none', cursor:'pointer',
                background:'var(--accent)',
                color:'#fff', fontSize:14, fontWeight:400, fontFamily:'var(--font-ui)',
                letterSpacing:'-0.016em',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                transition:'background-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
              }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--accent-hover)'}
              onMouseLeave={e=>e.currentTarget.style.background='var(--accent)'}
              onMouseDown={e=>e.currentTarget.style.transform='scale(0.98)'}
              onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
              >
                <Sparkles size={14}/>Novo carrossel com IA
              </button>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <button onClick={()=>setTemplatesOpen?.(true)} style={{
                  height:38, borderRadius:8, cursor:'pointer',
                  background:'var(--bg-card)', border:'1px solid var(--border)',
                  color:'var(--text-secondary)', fontSize:11, fontWeight:600, fontFamily:'var(--font-ui)',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 0.12s',
                }}
                onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
                onMouseLeave={e=>{e.currentTarget.style.color='var(--text-secondary)';e.currentTarget.style.borderColor='var(--border)';}}
                aria-label="Abrir templates prontos"
                >
                  <Layout size={12}/>Templates
                </button>
                <button onClick={()=>setResearchOpen(true)} style={{
                  height:38, borderRadius:8, cursor:'pointer',
                  background:'var(--bg-card)', border:'1px solid var(--border)',
                  color:'var(--text-secondary)', fontSize:11, fontWeight:600, fontFamily:'var(--font-ui)',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 0.12s',
                }}
                onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
                onMouseLeave={e=>{e.currentTarget.style.color='var(--text-secondary)';e.currentTarget.style.borderColor='var(--border)';}}
                aria-label="Pesquisar nicho"
                >
                  <TrendingUp size={12}/>Pesquisar
                </button>
              </div>
            </S>

            <S title="Refinar todos os cards" hint="Aplica uma instrução a todo o carrossel mantendo coerência narrativa.">
              {/* Variante prominent: CTA drop-zone (círculo accent + título +
                  subtítulo) pra ler como botão e não como fundo desbotado. */}
              <RefineBtn
                onRefine={refineAll}
                busy={refining}
                variant="prominent"
                label="Refinar com IA"
                subtitle="Aplica uma instrução em todos os cards de uma vez"
              />
            </S>

            {hasLastGenerate ? (
              <S title="Refazer com tom alternativo" hint="Usa o mesmo tema/material da última geração mas com inflexão de tom diferente. O carrossel atual fica em Cmd+Z (undo) pra você comparar.">
                {/* Polish: cards verticais com label grande + micro-descrição em cinza.
                    Hover puxa borda accent + lift sutil. Disabled durante refining. */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                  {[
                    { id:'analitico',  label:'Analítico',  blurb:'Editorial, calmo, conceitual.', hint:'mais analítico-editorial, conceitual e calmo, com profundidade de raciocínio' },
                    { id:'provocador', label:'Provocador', blurb:'Contraintuitivo, vira a tese.',  hint:'mais provocador e contraintuitivo, virando a tese óbvia do avesso sem deixar de sustentar' },
                    { id:'leve',       label:'Leve',       blurb:'Direto, humor sutil, curto.',   hint:'mais leve, conversacional e direto, com humor sutil e frases curtas' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => remixWithTone(opt.hint, opt.label)}
                      disabled={refining}
                      title={opt.hint}
                      style={{
                        display:'flex', flexDirection:'column', alignItems:'flex-start', gap:4,
                        padding:'10px 10px 11px', borderRadius:10, cursor: refining ? 'not-allowed' : 'pointer',
                        background:'var(--bg-card)', border:'1px solid var(--border)',
                        color:'var(--text-secondary)',
                        fontFamily:'var(--font-ui)',
                        opacity: refining ? 0.5 : 1,
                        transition:'border-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth), background-color 0.15s var(--ease-smooth)',
                        textAlign:'left',
                      }}
                      onMouseEnter={e => {
                        if (refining) return;
                        e.currentTarget.style.borderColor = 'var(--accent)';
                        e.currentTarget.style.background = 'var(--accent-surface)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.background = 'var(--bg-card)';
                      }}
                      onMouseDown={e => { if (!refining) e.currentTarget.style.transform = 'scale(0.97)'; }}
                      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em' }}>
                        {opt.label}
                      </span>
                      <span style={{ fontSize:10, lineHeight:1.35, color:'var(--text-muted)', letterSpacing:'-0.005em' }}>
                        {opt.blurb}
                      </span>
                    </button>
                  ))}
                </div>
              </S>
            ) : null}

            <S title="Legenda do post">
              {caption ? (
                <>
                  <textarea value={caption} onChange={e=>setCaption(e.target.value)} rows={7}
                    className="vc-input vc-textarea"
                    style={{ fontSize:11, lineHeight:1.6, fontFamily:'var(--font-mono)', color:'var(--text-secondary)' }}
                  />
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    <button onClick={()=>navigator.clipboard?.writeText(caption)} className="vc-btn vc-btn-ghost" style={{ height:34 }}>
                      <Copy size={11}/>Copiar
                    </button>
                    <button onClick={generateCaption} disabled={genCaption} className="vc-btn vc-btn-ghost" style={{ height:34, opacity:genCaption?0.5:1 }}>
                      {genCaption ? <Loader2 size={11} style={{animation:'spin 0.8s linear infinite'}}/> : <RefreshCw size={11}/>}Regerar
                    </button>
                  </div>
                </>
              ) : (
                // Empty state da legenda: solid border + ícone num círculo
                // accent, mesma estética dos uploads. Hover puxa fundo accent-surface.
                <button onClick={generateCaption} disabled={genCaption} style={{
                  width:'100%', minHeight:60, padding:'12px 16px', borderRadius:11,
                  cursor:genCaption?'not-allowed':'pointer',
                  background:'var(--bg-card)', border:'1px solid var(--hairline)',
                  fontFamily:'var(--font-ui)',
                  display:'flex', alignItems:'center', gap:12,
                  opacity:genCaption?0.6:1,
                  transition:'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth)',
                }}
                onMouseEnter={e=>{if(!genCaption){e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.background='var(--accent-surface)';}}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--hairline)';e.currentTarget.style.background='var(--bg-card)';}}
                >
                  <span style={{
                    width:32, height:32, borderRadius:'50%', flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background:'var(--accent-surface)', color:'var(--accent)',
                  }} aria-hidden>
                    {genCaption ? <Loader2 size={14} style={{animation:'spin 0.8s linear infinite'}}/> : <FileText size={14} strokeWidth={2.25}/>}
                  </span>
                  <span style={{ display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0, textAlign:'left' }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', lineHeight:1.3 }}>
                      Gerar legenda para o post
                    </span>
                    <span style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:'-0.005em' }}>
                      IA escreve com base no carrossel atual
                    </span>
                  </span>
                </button>
              )}
            </S>
          </>
        )}
      </div>

      {/* Download footer — uma única row: dropdown "Baixar" (com card N + ZIP
          + PDF + fotos limpas dentro) + Projetos + ✓ Salvo. Liberta ~80px
          que antes eram do CTA fixo "Baixar card N". */}
      <div style={{ borderTop:'1px solid var(--border)', padding:'10px 12px', display:'flex', alignItems:'center', gap:8, justifyContent:'space-between', flexShrink:0 }}>
        <ExportMoreFormats
          slides={slides}
          exporting={exporting}
          exportProgress={exportProgress}
          activeIdx={activeIdx}
          onExportSlide={exportSlide}
          onExportAll={exportAll}
          onExportPDF={exportPDF}
          onExportPhotosOnly={exportPhotosOnly}
          hideSlideOption={false}
        />
        <button
          onClick={() => setLibraryOpen(true)}
          aria-label="Abrir biblioteca de projetos salvos"
          title={libraryCount > 1 ? `${libraryCount} projetos salvos` : 'Meus projetos salvos'}
          style={{
            minHeight:32, cursor:'pointer',
            border:'none', background:'transparent',
            color:'var(--text-muted)', fontSize:11, fontFamily:'var(--font-ui)',
            letterSpacing:'-0.005em',
            display:'inline-flex', alignItems:'center', gap:5,
            transition:'color 0.12s',
            padding:'4px 6px', borderRadius:6, whiteSpace:'nowrap',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <BookOpen size={11}/>
          {libraryCount > 1
            ? <>Projetos · <strong style={{ color:'inherit', fontWeight:700 }}>{libraryCount}</strong></>
            : 'Projetos'}
        </button>
        <span
          title="Salvando automaticamente"
          aria-label="Salvando automaticamente"
          style={{
            display:'inline-flex', alignItems:'center', gap:4,
            fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-ui)',
            letterSpacing:'-0.005em', whiteSpace:'nowrap',
          }}
        >
          <Check size={10} strokeWidth={3} style={{ color:'var(--accent)' }} aria-hidden/>
          Salvo
        </span>
      </div>
    </div>
  );
}






// ─── MAIN APP ─────────────────────────────────────────────────────────────────















/** Evita ecrã em branco quando `vc_library` ou import JSON tem doc incompleto (sem slides, etc.). */
// SCHEMA_VERSION + migrateDoc foram extraídos para src/utils/schema-migration.js



export default function App() {
  // ── BIBLIOTECA + PERFIS DE MARCA (multi-doc) ────────────────────────────────
  // Schema novo (vc_library + vc_brands). Migra automaticamente do `vc_doc`
  // legado se existir e a biblioteca estiver vazia.
  const [library, setLibrary] = useState(() => {
    const lib = lsGet(SK.library, null);
    if (Array.isArray(lib) && lib.length) {
      return lib.map((e) => ({ ...e, doc: ensureDocShape(e.doc || {}) }));
    }
    const legacy = lsGet(SK.legacyDoc, null);
    if (legacy && legacy.slides?.length) {
      // Migra o doc antigo pra primeira entrada da biblioteca
      return [mkLibEntry(ensureDocShape({ ...DEFAULT_DOC, ...legacy }), 'Carrossel')];
    }
    return [mkLibEntry(DEFAULT_DOC, 'Carrossel')];
  });
  const [activeDocId, setActiveDocId] = useState(() => {
    const stored = lsGet(SK.activeDocId, null);
    if (stored) return stored;
    const lib = lsGet(SK.library, null);
    return Array.isArray(lib) && lib[0]?.id ? lib[0].id : null;
  });
  const [brandRoster, setBrandRoster] = useState(() => {
    const stored = lsGet(SK.brands, null);
    if (Array.isArray(stored) && stored.length) return stored.map(hydrateBrandTextColors);
    return [hydrateBrandTextColors({ ...DEFAULT_BRAND })];
  });
  const [activeBrandId, setActiveBrandId] = useState(() => lsGet(SK.activeBrandId, 'default'));

  const libraryPersistRef = useRef(library);
  libraryPersistRef.current = library;

  /** Evita perder fotos (base64) ao puxar-para-atualizar no telemóvel antes do debounce. */
  useEffect(() => {
    const flushLibrary = () => lsSet(SK.library, libraryPersistRef.current);
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flushLibrary();
    };
    window.addEventListener('pagehide', flushLibrary);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', flushLibrary);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, []);

  // Persiste os 3 stores (debounced — sincronização imediata acima nos eventos do sistema)
  // Auto-save da biblioteca + tracking do último save pro indicador no header
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const firstSaveRef = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => {
      lsSet(SK.library, library);
      if (firstSaveRef.current) { firstSaveRef.current = false; return; }
      setLastSavedAt(Date.now());
    }, 100);
    return () => clearTimeout(t);
  }, [library]);
  useEffect(() => { lsSet(SK.activeDocId, activeDocId); }, [activeDocId]);
  useEffect(() => { lsSet(SK.brands, brandRoster); }, [brandRoster]);
  useEffect(() => { lsSet(SK.activeBrandId, activeBrandId); }, [activeBrandId]);

  // Guard de primeira visita: localStorage vazio → activeDocId nasce null porque a
  // biblioteca ainda não foi persistida. Sem isso, o efeito de save-back faz early-
  // return em `if (!activeDocId)` e as edições da primeira sessão são perdidas.
  useEffect(() => {
    if (!activeDocId && library[0]?.id) setActiveDocId(library[0].id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Doc ativo da biblioteca + ponteiro pro index dele (pra updates eficientes)
  const activeEntry = library.find(e => e.id === activeDocId) || library[0];
  const initialDoc  = ensureDocShape(activeEntry?.doc || DEFAULT_DOC);

  const history = useHistory(initialDoc);
  // Quando trocar de doc ativo, recarrega o histórico com o novo doc
  useEffect(() => {
    if (activeEntry?.doc) history.reset(ensureDocShape(activeEntry.doc));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId]);

  const doc = (history.state && typeof history.state === 'object') ? history.state : DEFAULT_DOC;
  const brand = doc.brand && typeof doc.brand === 'object' ? doc.brand : DEFAULT_BRAND;
  // Nunca deixar slides vazio: senão `slide` fica undefined e a árvore inteira rebenta (tela branca).
  const slides = (Array.isArray(doc.slides) && doc.slides.length > 0) ? doc.slides : [mkSlide(1, brand)];
  const slidesLiveRef = useRef(slides);
  slidesLiveRef.current = slides;
  const fmt = doc.fmt && FORMATS[doc.fmt] ? doc.fmt : 'carrossel';
  const caption = typeof doc.caption === 'string' ? doc.caption : '';
  const material  = doc.material  || { content:'', sources:'', context:'' };
  const imgParams = doc.imgParams || { fidelity:50, creativity:50, irreverence:50, objectivity:50 };
  const mode      = doc.mode      || 'editorial';
  const creativePreset = doc.creativePreset ?? 'livre';
  const slideTextDensityRaw = doc.slideTextDensity ?? '1_1';
  const slideTextDensity = SLIDE_TEXT_DENSITY_BY_ID[slideTextDensityRaw] ? slideTextDensityRaw : '1_1';
  const cardVisualStyle = normalizeCardVisualStyle(doc.cardVisualStyle);

  // Helpers que aceitam value OU função, mantendo a API "useState-like"
  const setSlides    = useCallback(next => history.set(d => ({ ...d, slides:    typeof next==='function' ? next(d.slides)   : next })), [history]);
  const setBrand = useCallback(
    (next) =>
      history.set((d) => {
        const cur = hydrateBrandTextColors(d.brand && typeof d.brand === 'object' ? d.brand : { ...DEFAULT_BRAND });
        const brandNextRaw =
          typeof next === 'function' ? next(cur) : { ...cur, ...next };
        const brandNext = hydrateBrandTextColors(brandNextRaw);
        return { ...d, brand: brandNext };
      }),
    [history],
  );
  const setFmt       = useCallback(next => history.set(d => {
    const raw = typeof next === 'function' ? next(d.fmt) : next;
    return { ...d, fmt: FORMATS[raw] ? raw : 'carrossel' };
  }), [history]);

  const setCaption   = useCallback(next => history.set(d => ({ ...d, caption:   typeof next==='function' ? next(d.caption)  : next })), [history]);
  const setMaterial  = useCallback(next => history.set(d => ({
    ...d,
    material: typeof next==='function'
      ? next(d.material || { content:'', sources:'', context:'' })
      : next,
  })), [history]);
  const setImgParams = useCallback(next => history.set(d => ({
    ...d,
    imgParams: typeof next==='function'
      ? next(d.imgParams || { fidelity:50, creativity:50, irreverence:50, objectivity:50 })
      : next,
  })), [history]);
  const setMode      = useCallback(next => history.set(d => ({
    ...d,
    mode: typeof next==='function' ? next(d.mode || 'editorial') : next,
  })), [history]);
  const setCreativePreset = useCallback(next => history.set(d => ({
    ...d,
    creativePreset: typeof next==='function' ? next(d.creativePreset ?? 'livre') : next,
  })), [history]);

  // ── PADRÃO VISUAL ────────────────────────────────────────────────────────
  // Trackeia qual dos 12 presets visuais o user escolheu (null = nenhum).
  // Persistido no doc — antes era useState local e o picker "esquecia" a
  // seleção em reload/troca de projeto, mesmo com as cores já aplicadas.
  const visualPreset = doc.visualPreset ?? null;
  const setVisualPreset = useCallback(next => history.set(d => ({
    ...d,
    visualPreset: typeof next === 'function' ? next(d.visualPreset ?? null) : next,
  })), [history]);
  const applyVisualStylePreset = useCallback((presetId) => {
    if (!presetId) return;
    setVisualPreset(presetId);
    setBrand((b) => applyVisualPreset(b, presetId));
    // Aplica overrides de slide (align, layout) se preset definir slideDefaults.
    // Cada slide preserva seus campos próprios — só sobrescreve os do preset.
    const slideOverrides = getSlideOverridesForPreset(presetId);
    if (Object.keys(slideOverrides).length > 0) {
      setSlides((slides) => slides.map((s) => ({ ...s, ...slideOverrides })));
    }
    // Alinha pele visual + arco narrativo (utilizador pode mudar depois).
    const fromPreset = VISUAL_PRESET_BY_ID?.[presetId]?.creativePreset
      || suggestCreativePresetForVisual(presetId);
    if (fromPreset) setCreativePreset(fromPreset);
    trackEvent('visual_preset_applied', { preset: presetId, creativePreset: fromPreset || null });
  }, [setBrand, setSlides, setCreativePreset]);
  const setSlideTextDensity = useCallback(next => history.set(d => ({
    ...d,
    slideTextDensity: typeof next==='function' ? next(d.slideTextDensity ?? '1_1') : next,
  })), [history]);
  const setCardVisualStyle = useCallback(next => history.set(d => ({
    ...d,
    cardVisualStyle: typeof next === 'function'
      ? next(normalizeCardVisualStyle(d.cardVisualStyle))
      : normalizeCardVisualStyle(next),
  })), [history]);

  // ── BIBLIOTECA: handlers ────────────────────────────────────────────────────
  const renameDoc = useCallback((docId, newName) => {
    setLibrary(prev => prev.map(e => e.id === docId ? { ...e, name: newName, updatedAt: Date.now() } : e));
  }, []);
  const setDocStatus = useCallback((docId, newStatus) => {
    setLibrary(prev => prev.map(e => e.id === docId ? { ...e, status: newStatus, updatedAt: Date.now() } : e));
  }, []);
  const [shellView, setShellView] = useState(readInitialShellView);
  useEffect(() => {
    lsSet(SK.shellView, shellView);
  }, [shellView]);

  const openDoc = useCallback((docId) => {
    setActiveDocId(docId);
    setLibraryOpen(false);
    setShellView('project');
  }, []);
  const newDoc = useCallback((seedDoc = null, name = 'Novo carrossel') => {
    // Aplica brand ativo no doc novo
    const activeBrand = brandRoster.find(b => b.id === activeBrandId) || brandRoster[0] || DEFAULT_BRAND;
    const hydratedBrand = hydrateBrandTextColors({ ...activeBrand });
    const seeded = seedDoc || {};
    const baseDoc = {
      ...DEFAULT_DOC,
      ...seeded,
      brand: hydratedBrand,
      slides: Array.isArray(seeded.slides) && seeded.slides.length
        ? seeded.slides
        : [mkSlide(1, hydratedBrand)],
    };
    const entry = mkLibEntry(baseDoc, name);
    setLibrary(prev => [entry, ...prev]);
    setActiveDocId(entry.id);
    setLibraryOpen(false);
    setShellView('project');
  }, [brandRoster, activeBrandId]);
  const duplicateDoc = useCallback((docId) => {
    setLibrary(prev => {
      const src = prev.find(e => e.id === docId);
      if (!src) return prev;
      const copy = mkLibEntry(JSON.parse(JSON.stringify(src.doc)), `${src.name} (cópia)`);
      return [copy, ...prev];
    });
  }, []);
  const deleteDoc = useCallback((docId) => {
    setLibrary(prev => {
      const next = prev.filter(e => e.id !== docId);
      if (next.length === 0) {
        // Sempre mantém pelo menos 1 doc na biblioteca
        const seed = mkLibEntry(DEFAULT_DOC, 'Carrossel');
        setActiveDocId(seed.id);
        return [seed];
      }
      if (docId === activeDocId) setActiveDocId(next[0].id);
      return next;
    });
  }, [activeDocId]);

  // ── TOAST helpers — declarados ANTES de qualquer callback que os referencie
  // no array de deps (exportDoc, exportAllDocs etc.). Ordem importa: deps array
  // é avaliado no momento do useCallback, e const é TDZ até a linha rodar.
  const [toasts, setToasts] = useState([]);
  const dismissToast = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);
  const toast = useCallback((message, kind='info', ttl=3500) => {
    const id = uid();
    setToasts(t => [...t, { id, message, kind }]);
    if (ttl > 0) setTimeout(() => dismissToast(id), ttl);
  }, [dismissToast]);
  const setError = useCallback((msg) => { if (msg) toast(msg, 'error', 5000); }, [toast]);

  // ── EXPORT / IMPORT de projetos ─────────────────────────────────────────────
  // Exporta UMA entrada da biblioteca como arquivo .json
  const exportDoc = useCallback(async (docId) => {
    const entry = library.find(e => e.id === docId);
    if (!entry) return;
    const blob = new Blob([JSON.stringify({ vcVersion: 1, docs: [entry] }, null, 2)], { type: 'application/json' });
    const fname = `${(entry.name || 'carrossel').replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'carrossel'}.json`;
    await downloadBlob(blob, fname);
    toast(`Backup "${fname}" salvo. Importe depois pra restaurar.`, 'success', 4500);
    trackEvent('export_json_single', { size_kb: String(Math.round(blob.size / 1024)) });
  }, [library, toast]);

  // Exporta TODA a biblioteca de uma vez
  const exportAllDocs = useCallback(async () => {
    const blob = new Blob([JSON.stringify({ vcVersion: 1, docs: library }, null, 2)], { type: 'application/json' });
    const fname = `viral-carrossel-backup-${new Date().toISOString().slice(0,10)}.json`;
    await downloadBlob(blob, fname);
    toast(`Backup completo "${fname}" — ${library.length} projeto(s). Guarde em local seguro.`, 'success', 5500);
    trackEvent('export_json_full', { project_count: String(library.length), size_kb: String(Math.round(blob.size / 1024)) });
  }, [library, toast]);

  // Importa um arquivo .json exportado anteriormente (merge na biblioteca)
  const importDocRef = useRef(null);
  const handleImportFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const docs = parsed.docs || (Array.isArray(parsed) ? parsed : null);
        if (!docs?.length) throw new Error('Formato inválido');
        // Cada doc importado recebe um novo id pra evitar conflitos
        const newEntries = docs.map(e => ({
          ...e,
          id: uid(),
          name: e.name || 'Importado',
          importedAt: Date.now(),
        }));
        setLibrary(prev => [...newEntries, ...prev]);
        // Ativa o primeiro importado
        setActiveDocId(newEntries[0].id);
        setLibraryOpen(false);
        setShellView('project');
      } catch {
        window.dispatchEvent(new CustomEvent('vc:quota-exceeded', {
          detail: 'Arquivo inválido ou corrompido. Verifique se é um backup exportado pelo Viral Carrossel.',
        }));
      }
    };
    reader.readAsText(file);
  }, []);

  // ── PERFIS DE MARCA: handlers ───────────────────────────────────────────────
  const applyBrand = useCallback((brandId) => {
    const b = brandRoster.find(x => x.id === brandId);
    if (!b) return;
    setActiveBrandId(brandId);
    history.set(d => ({ ...d, brand: hydrateBrandTextColors({ ...b }) }));
  }, [brandRoster, history]);
  const upsertBrand = useCallback((brandObj) => {
    const norm = hydrateBrandTextColors(brandObj);
    setBrandRoster((prev) => {
      const exists = prev.find((b) => b.id === norm.id);
      if (exists) return prev.map((b) => (b.id === norm.id ? norm : b));
      return [...prev, norm];
    });
  }, []);
  const deleteBrand = useCallback((brandId) => {
    const brand = brandRoster.find(b => b.id === brandId);
    const name = brand?.name || 'esta marca';
    if (!window.confirm(`Apagar a marca "${name}"?\n\nProjetos que usam essa marca vão voltar pra padrão.`)) return;
    setBrandRoster(prev => {
      const next = prev.filter(b => b.id !== brandId);
      if (!next.length) return [hydrateBrandTextColors({ ...DEFAULT_BRAND })];
      return next;
    });
    if (brandId === activeBrandId) setActiveBrandId('default');
  }, [activeBrandId, brandRoster]);
  // Salva o brand do doc atual como um perfil novo na "estante"
  const saveCurrentBrandAsProfile = useCallback((name) => {
    const newBrand = { ...doc.brand, id: uid(), name: name || `Perfil ${brandRoster.length + 1}` };
    upsertBrand(newBrand);
    setActiveBrandId(newBrand.id);
    return newBrand;
  }, [doc.brand, brandRoster.length, upsertBrand]);

  // Autosave: salva o doc atual na entrada da biblioteca (debounced)
  useEffect(() => {
    if (!activeDocId) return;
    const t = setTimeout(() => {
      setLibrary(prev => prev.map(e => e.id === activeDocId
        ? { ...e, doc, updatedAt: Date.now() }
        : e
      ));
    }, 400);
    return () => clearTimeout(t);
  }, [doc, activeDocId]);

  const [activeIdx, setActiveIdx] = useState(0);
  const [tab, setTab] = useState('brand');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [canvasEditMode, setCanvasEditMode] = useState(false);
  const [showPreviewAlignGrid, setShowPreviewAlignGrid] = useState(() => {
    try { return localStorage.getItem(SK.previewGrid) === '1'; } catch { return false; }
  });
  /** QA: simula leitura à distância do polegar (tipo menor no preview). */
  const [thumbQaMode, setThumbQaMode] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [hookVarsOpen, setHookVarsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [landingOpen, setLandingOpen] = useState(() => shouldShowOnboardingLanding());
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [paywallEmail, setPaywallEmail] = useState('');
  const [loginHint, setLoginHint] = useState('');
  const [accountTab, setAccountTab] = useState('projects'); // projects | profile
  const [access, setAccess] = useState({ status: 'loading', active: false, email: null });
  const accessActive = !!access.active;

  const enterStudio = useCallback(() => {
    dismissOnboardingLanding();
    setLandingOpen(false);
    setPaywallOpen(false);
    setAccountTab('projects');
    setShellView('home');
    trackEvent('landing_complete');
  }, []);

  const goAccount = useCallback((tab = 'projects') => {
    // Assinatura vive dentro do Perfil (legado: 'plan' → profile)
    setAccountTab(tab === 'plan' ? 'profile' : tab);
    setShellView('home');
  }, []);

  const refreshAccess = useCallback(async () => {
    const session = await fetchAccessSession();
    setAccess({
      status: session.billingDisabled ? 'disabled' : (session.active ? 'active' : 'inactive'),
      active: !!session.active,
      email: session.email || null,
      billingDisabled: !!session.billingDisabled,
      currentPeriodEnd: session.currentPeriodEnd || null,
    });
    return session;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const q = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : null;
      const sessionId = q?.get('session_id');
      const billing = q?.get('billing');

      if (billing === 'success' && sessionId) {
        try {
          await confirmCheckoutSession(sessionId);
          trackEvent('billing_success');
        } catch (e) {
          console.warn('[billing] confirm failed', e);
        }
      }
      // Limpa TODO param de billing da URL (success/restored/cancel) — sem isso,
      // reload em ?billing=cancel reabre o paywall e ?billing=restored re-entra
      // no studio indefinidamente.
      if (billing) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('billing');
          url.searchParams.delete('session_id');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        } catch { /* */ }
      }

      const loginStatus = q?.get('login');
      const loginEmail = q?.get('email') || '';
      if (loginStatus) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('login');
          url.searchParams.delete('email');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        } catch { /* */ }
      }

      const session = await refreshAccess();
      if (cancelled) return;

      if (q?.get('app') === '1' || q?.get('studio') === '1') {
        dismissOnboardingLanding();
        setLandingOpen(false);
        if (!session.active) setPaywallOpen(true);
        return;
      }
      if (q?.get('landing') === '1' || q?.get('intro') === '1' || q?.get('welcome') === '1') {
        setLandingOpen(true);
      }
      if (billing === 'success' && session.active) {
        enterStudio();
      }
      if ((billing === 'restored' || loginStatus === 'google') && session.active) {
        trackEvent('login_google_ok');
        enterStudio();
      }
      if (billing === 'cancel') {
        setPaywallOpen(true);
        setLandingOpen(false);
      }

      if (loginStatus === 'no_subscription') {
        setPaywallEmail(loginEmail);
        setLoginHint(loginEmail
          ? `Nenhuma assinatura ativa em ${loginEmail}. Assine abaixo para entrar.`
          : 'Nenhuma assinatura ativa nesta conta Google. Assine abaixo para entrar.');
        setLandingOpen(false);
        setPaywallOpen(true);
        setLoginOpen(false);
      } else if (loginStatus === 'denied') {
        setLoginHint('Login Google cancelado. Tente de novo.');
        setLoginOpen(true);
      } else if (loginStatus === 'google_unconfigured') {
        setLoginHint('Login Google ainda não configurado neste ambiente.');
        setLoginOpen(true);
      } else if (loginStatus === 'invalid_state' || loginStatus === 'error') {
        setLoginHint('Não foi possível entrar com Google. Tente de novo.');
        setLoginOpen(true);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshAccess, enterStudio]);

  const completeLanding = useCallback(async () => {
    const session = await refreshAccess();
    if (session.active) {
      enterStudio();
      return;
    }
    setLandingOpen(false);
    setPaywallOpen(true);
    trackEvent('paywall_open');
  }, [refreshAccess, enterStudio]);

  const reopenLanding = useCallback(() => {
    try { sessionStorage.removeItem(SK.landingDismissed); } catch { /* */ }
    setPaywallOpen(false);
    setLandingOpen(true);
  }, []);

  const openPortal = useCallback(async () => {
    try {
      const { url } = await openBillingPortal();
      if (url) window.location.href = url;
    } catch (e) {
      console.warn('[billing] portal', e);
      alert(e?.message || 'Não foi possível abrir o portal de assinatura.');
    }
  }, []);
  const handleLogout = useCallback(async () => {
    await logoutAccess();
    trackEvent('logout');
    // Sessão morta no servidor — recarrega pro shell reavaliar (paywall/landing).
    window.location.assign('/');
  }, []);
  const [tourOpen, setTourOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [imgPrompt, setImgPrompt] = useState({ open:false, mode:null, defaultValue:'' });
  const [imageCropOpen, setImageCropOpen] = useState(false);
  const [photoPositionOpen, setPhotoPositionOpen] = useState(false);
  // Configuração unificada de IA. Preferências (sem segredos) ficam no localStorage;
  // chaves ficam na sessão por padrão e só persistem se o usuário autorizar.
  const [aiSettings, setAISettings] = useState(() => {
    try {
      const savedConfig = JSON.parse(localStorage.getItem(SK.aiSettings) || '{}');
      const savedKeys = JSON.parse(
        localStorage.getItem(SK.aiKeys) ||
        sessionStorage.getItem(SK.aiKeys) ||
        '{}',
      );
      // Migração transparente da janela antiga.
      const legacyOpenAI =
        localStorage.getItem(SK.openaiKey) ||
        sessionStorage.getItem(SK.openaiKey) ||
        '';
      const legacyAnthropic =
        localStorage.getItem(SK.anthropicKey) ||
        sessionStorage.getItem(SK.anthropicKey) ||
        '';
      const legacyClaudeModel = localStorage.getItem(SK.claudeModel);
      return normalizeAISettings({
        ...savedConfig,
        keys: {
          ...savedKeys,
          openai: savedKeys.openai || legacyOpenAI,
          anthropic: savedKeys.anthropic || legacyAnthropic,
        },
        textModels: {
          ...(savedConfig.textModels || {}),
          ...(!savedConfig.textModels?.anthropic && legacyClaudeModel
            ? { anthropic: legacyClaudeModel === 'opus' ? 'claude-opus-5' : 'claude-sonnet-5' }
            : {}),
        },
        persistKeys:
          savedConfig.persistKeys ??
          (localStorage.getItem(SK.openaiKeyPersist) === '1' ||
            localStorage.getItem(SK.anthropicKeyPersist) === '1'),
      });
    } catch {
      return normalizeAISettings(DEFAULT_AI_SETTINGS);
    }
  });
  useEffect(() => {
    setAIRuntimeSettings(aiSettings);
    try {
      const { keys, ...safeSettings } = aiSettings;
      localStorage.setItem(SK.aiSettings, JSON.stringify(safeSettings));
      const target = aiSettings.persistKeys ? localStorage : sessionStorage;
      const other = aiSettings.persistKeys ? sessionStorage : localStorage;
      target.setItem(SK.aiKeys, JSON.stringify(keys));
      other.removeItem(SK.aiKeys);
      // Remove cópias legadas para não deixar segredos duplicados.
      localStorage.removeItem(SK.openaiKey);
      sessionStorage.removeItem(SK.openaiKey);
      localStorage.removeItem(SK.anthropicKey);
      sessionStorage.removeItem(SK.anthropicKey);
    } catch { /* storage privado/bloqueado */ }
  }, [aiSettings]);
  const openaiKey = aiSettings.keys.openai || '';
  const anthropicKey = aiSettings.keys.anthropic || '';
  // Biblioteca de hooks aprovados (B2)
  const [hookLibrary, setHookLibrary] = useState(() => lsGet(SK.hookLibrary, []));
  // FASE 2 Narrative OS: Sistema de Modos (Criador/Diretor/Studio)
  // Default Criador — esconde complexidade pra 90% dos users.
  // Persiste em localStorage pra preservar entre sessions.
  const [appMode, setAppModeState] = useState(() => {
    const saved = lsGet(SK.appMode, 'criador');
    return ['criador', 'diretor', 'studio'].includes(saved) ? saved : 'criador';
  });
  const setAppMode = useCallback((next) => {
    if (!['criador', 'diretor', 'studio'].includes(next)) return;
    setAppModeState(next);
    lsSet(SK.appMode, next);
    trackEvent('app_mode_change', { mode: next });
  }, []);
  // Modal de boas-vindas dos 3 modos — primeira visita só.
  const [modesIntroOpen, setModesIntroOpen] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || landingOpen) return undefined;
    try {
      if (!localStorage.getItem(SK.modesIntro)) {
        const t = window.setTimeout(() => setModesIntroOpen(true), 600);
        return () => window.clearTimeout(t);
      }
    } catch { /* */ }
    return undefined;
  }, [landingOpen]);
  const closeModesIntro = useCallback(() => {
    setModesIntroOpen(false);
    try { localStorage.setItem(SK.modesIntro, '1'); } catch { /* */ }
  }, []);
  useEffect(() => { lsSet(SK.hookLibrary, hookLibrary); }, [hookLibrary]);
  // ── VÍDEOS — IndexedDB store + Map reativo de id → blob URL ──────────────────
  // videoId no slide referencia o blob no IndexedDB. Aqui criamos object URLs sob
  // demanda e revogamos no unmount. Cleanup de orphans roda quando slides mudam.
  const [videoUrls, setVideoUrls] = useState({}); // { [videoId]: blobUrl }
  const videoUrlsRef = useRef({});
  videoUrlsRef.current = videoUrls;
  // Wrapper que mantém o cache de object URLs (video-store) SINCRONIZADO com setVideoUrls.
  // Sem isso, o renderer (que lê o map module-level via getVideoUrl) ficava
  // 1 render atrás — bloco do <video> nunca disparava porque getVideoUrl
  // retornava null no primeiro render após import. useEffect só roda DEPOIS
  // do commit, então o mapa ficava stale até o próximo render espontâneo.
  const setVideoUrlsSync = useCallback((nextOrFn) => {
    setVideoUrls(prev => {
      const next = typeof nextOrFn === 'function' ? nextOrFn(prev) : nextOrFn;
      setVideoUrlMap(next);
      videoUrlsRef.current = next;
      return next;
    });
  }, []);
  // Defesa em profundidade: mesmo se algo escapar, useEffect garante sync.
  useEffect(() => { setVideoUrlMap(videoUrls); }, [videoUrls]);
  // Refetch URLs sempre que algum slide aponta pra videoId que não temos URL gerada
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const idsInUse = (library || []).flatMap(e => (e.doc?.slides || []).map(s => s.videoId).filter(Boolean));
      const uniqIds = [...new Set(idsInUse)];
      const missing = uniqIds.filter(id => !videoUrlsRef.current[id]);
      if (missing.length === 0) return;
      const newUrls = { ...videoUrlsRef.current };
      for (const id of missing) {
        try {
          const entry = await videoGet(id);
          if (cancelled) return;
          if (entry?.blob) {
            newUrls[id] = URL.createObjectURL(entry.blob);
          }
        } catch (err) {
          console.warn(`[video] falha ao carregar ${id}:`, err.message);
        }
      }
      if (!cancelled) setVideoUrlsSync(newUrls);
    })();
    return () => { cancelled = true; };
  }, [library, setVideoUrlsSync]);
  // Cleanup periódico de orphans (vídeos sem slide apontando) — 1× por sessão após boot
  useEffect(() => {
    const id = setTimeout(async () => {
      try {
        const inUse = (library || []).flatMap(e => (e.doc?.slides || []).map(s => s.videoId).filter(Boolean));
        const removed = await videoCleanupOrphans(inUse);
        if (removed > 0) console.log(`[video] cleanup: removeu ${removed} vídeo(s) orfão(s)`);
      } catch { /* */ }
    }, 5000);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Revogar todas as object URLs quando o componente desmonta (raro mas correto)
  useEffect(() => () => {
    Object.values(videoUrlsRef.current).forEach(url => {
      try { URL.revokeObjectURL(url); } catch { /* */ }
    });
  }, []);
  // Últimos args passados a handleGenerate — permite remix com tom alternativo sem reabrir modal (B1)
  const lastGenerateArgsRef = useRef(null);
  const [hasLastGenerate, setHasLastGenerate] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(SK.previewGrid, showPreviewAlignGrid ? '1' : '0'); } catch { /* */ }
  }, [showPreviewAlignGrid]);
  // Ref para cancelar loops de geração de imagem órfãos (race-condition guard)
  const imgGenAbortRef = useRef(null);
  const slideImgGenIdsRef = useRef(new Set());
  const [slideImgGenBusy, setSlideImgGenBusy] = useState({});
  // Progresso da geração (texto + imagens) — exibido como barra fixa enquanto roda
  const [genProgress, setGenProgress] = useState(null); // null | { phase, current, total, label }
  const [serverStatus, setServerStatus] = useState({ anthropic:false, openai:false, dev:false });
  const selectedTextProvider = aiSettings.textProvider;
  const selectedImageKeyProvider = aiSettings.imageProvider === 'zai' ? 'zai' : 'openai';
  // Nome legado (`hasOpenAI`) preservado nos componentes de imagem; agora significa
  // "há um provedor de imagem configurado", inclusive Z.ai.
  const hasOpenAI =
    !!aiSettings.keys[selectedImageKeyProvider] ||
    (selectedImageKeyProvider === 'openai' && IS_LOCAL_DEV && serverStatus.openai);
  const hasAnthropic = serverStatus.anthropic || !!anthropicKey;
  const hasAnyAI =
    !!aiSettings.keys[selectedTextProvider] ||
    (selectedTextProvider === 'openai' && IS_LOCAL_DEV && serverStatus.openai) ||
    (selectedTextProvider === 'anthropic' && hasAnthropic);
  const [niche, setNiche] = useState('');

  // Tour guiado — primeira visita (pode repetir pela ajuda)
  useEffect(() => {
    if (typeof window === 'undefined' || landingOpen) return undefined;
    try {
      if (!localStorage.getItem(SK.onboarding)) {
        const t = window.setTimeout(() => setTourOpen(true), 850);
        return () => window.clearTimeout(t);
      }
    } catch { /* ignore */ }
    return undefined;
  }, [landingOpen]);
  const [prefilledTopic, setPrefilledTopic] = useState('');
  const [refining, setRefining] = useState(false);
  const [genCaption, setGenCaption] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current:0, total:0 });
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const fileInputRef = useRef(null);
  const batchPhotoInputRef = useRef(null);
  const photoZoneInputRef = useRef(null);
  const photoZoneTargetIdxRef = useRef(null);
  const refImageInputRef = useRef(null);
  const videoFileInputRef = useRef(null);
  const refImageTargetIdxRef = useRef(null);
  const slideRefs = useRef({});

  // Escuta eventos de quota do localStorage — disparados por lsSet quando o storage enche
  useEffect(() => {
    const onQuotaWarning  = (e) => toast(e.detail, 'warn', 8000);
    const onQuotaExceeded = (e) => toast(e.detail, 'error', 0); // ttl=0 → permanente até fechar
    window.addEventListener('vc:quota-warning',  onQuotaWarning);
    window.addEventListener('vc:quota-exceeded', onQuotaExceeded);
    return () => {
      window.removeEventListener('vc:quota-warning',  onQuotaWarning);
      window.removeEventListener('vc:quota-exceeded', onQuotaExceeded);
    };
  }, [toast]);

  // Cancela loops de imagem em voo quando o componente desmonta
  useEffect(() => {
    return () => {
      if (imgGenAbortRef.current) imgGenAbortRef.current.cancelled = true;
    };
  }, []);

  // Inject global styles + Google Fonts para todas as famílias do FontPicker
  useEffect(() => {
    // CSS tokens / reset
    const style = document.createElement('style');
    style.id = 'vc-global-styles';
    style.textContent = GLOBAL_STYLE;
    if (!document.getElementById('vc-global-styles')) document.head.appendChild(style);

    // Google Fonts — cobre todos os itens de TITLE_FONTS e BODY_FONTS.
    // Usar <link> em vez de @import evita bloqueio de render e é mais rápido.
    const FONTS_URL =
      'https://fonts.googleapis.com/css2?' +
      'family=Anton&' +
      'family=Archivo+Black&' +
      'family=Bebas+Neue&' +
      'family=Big+Shoulders+Display:wght@400;500;600;700;800;900&' +
      'family=Bricolage+Grotesque:wght@300;400;500;600;700&' +
      'family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&' +
      'family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600&' +
      'family=DM+Sans:wght@300;400;500;600;700&' +
      'family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&' +
      'family=Familjen+Grotesk:wght@400;500;600;700&' +
      'family=Fraunces:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&' +
      'family=Funnel+Display:wght@300;400;500;600;700&' +
      'family=IBM+Plex+Mono:wght@300;400;500;600;700&' +
      'family=IBM+Plex+Sans:wght@300;400;500;600;700&' +
      'family=Instrument+Serif:ital@0;1&' +
      'family=Inter:wght@300;400;500;600;700&' +
      'family=Inter+Tight:wght@300;400;500;600;700&' +
      'family=Italiana&' +
      'family=JetBrains+Mono:wght@400;500;600&' +
      'family=Libre+Caslon+Display&' +
      'family=Major+Mono+Display&' +
      'family=Manrope:wght@300;400;500;600;700&' +
      'family=Oswald:wght@300;400;500;600;700&' +
      'family=Outfit:wght@300;400;500;600;700&' +
      'family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&' +
      'family=Plus+Jakarta+Sans:wght@300;400;500;600;700&' +
      'family=Poppins:wght@300;400;500;600;700&' +
      'family=Raleway:wght@300;400;500;600;700&' +
      'family=Sora:wght@300;400;500;600;700&' +
      'family=Source+Sans+3:wght@300;400;500;600;700&' +
      'family=Space+Grotesk:wght@300;400;500;600;700&' +
      'family=Space+Mono:wght@400;700&' +
      'family=Spectral:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&' +
      'family=Syne:wght@400;500;600;700;800&' +
      'family=Unbounded:wght@300;400;500;600;700&' +
      'family=Yeseva+One&' +
      'display=swap';

    if (!document.getElementById('vc-google-fonts')) {
      const mkLink = (attrs) => {
        const el = document.createElement('link');
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        return el;
      };
      document.head.appendChild(mkLink({ rel:'preconnect', href:'https://fonts.googleapis.com' }));
      document.head.appendChild(mkLink({ rel:'preconnect', href:'https://fonts.gstatic.com', crossorigin:'' }));
      document.head.appendChild(mkLink({ id:'vc-google-fonts', rel:'stylesheet', href:FONTS_URL }));
    }

    return () => {
      const s = document.getElementById('vc-global-styles'); if (s) s.remove();
      const f = document.getElementById('vc-google-fonts');  if (f) f.remove();
    };
  }, []);

  // Fontes de ficheiro (.woff2 / .ttf / …) injetadas por perfil — cards + pré-visualizações
  useEffect(() => {
    const id = 'vc-custom-brand-fonts';
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    const rules = [];
    const push = (b) => {
      if (!b?.id) return;
      if (b.customTitleFont?.dataUrl && b.customTitleFont?.format) {
        const u = JSON.stringify(b.customTitleFont.dataUrl);
        rules.push(
          `@font-face{font-family:'${vcCustomTitleFace(b.id)}';src:url(${u}) format('${b.customTitleFont.format}');font-display:swap;}`,
        );
      }
      if (b.customBodyFont?.dataUrl && b.customBodyFont?.format) {
        const u = JSON.stringify(b.customBodyFont.dataUrl);
        rules.push(
          `@font-face{font-family:'${vcCustomBodyFace(b.id)}';src:url(${u}) format('${b.customBodyFont.format}');font-display:swap;}`,
        );
      }
    };
    push(brand);
    (brandRoster || []).forEach(push);
    el.textContent = rules.join('\n');
  }, [brand, brandRoster]);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Detecta quais providers o servidor já tem configurados (.env.local)
  // pra que DALL·E e fallback OpenAI funcionem mesmo sem chave colada na UI.
  useEffect(() => {
    let alive = true;
    getServerStatus().then(s => { if (alive) setServerStatus(s); });
    return () => { alive = false; };
  }, []);

  // Prompt assíncrono via modal (substitui window.prompt — mobile-friendly e a11y)
  const promptResolveRef = useRef(null);
  const askPrompt = useCallback((opts) => new Promise((resolve) => {
    promptResolveRef.current = resolve;
    setImgPrompt({ open:true, ...opts });
  }), []);
  const closeImgPrompt = useCallback(() => {
    promptResolveRef.current?.(null);
    promptResolveRef.current = null;
    setImgPrompt({ open:false, mode:null, defaultValue:'' });
  }, []);
  const confirmImgPrompt = useCallback((value) => {
    promptResolveRef.current?.(value);
    promptResolveRef.current = null;
    setImgPrompt({ open:false, mode:null, defaultValue:'' });
  }, []);

  const isMobile = vw < 768;
  const f = FORMATS[fmt] || FORMATS.carrossel;
  const previewScale = useMemo(() => {
    if (isMobile) {
      /* Margens laterais maiores para o texto não “escorrer” junto ao bezel / overscroll */
      const side = Math.max(16, vw * 0.04);
      const base = Math.min((vw - side * 2) / f.w, 0.92);
      return thumbQaMode ? base * 0.72 : base;
    }
    // Desktop: thumbnail compacta na faixa horizontal (QA reduz ~feed 4:5 à distância).
    const base = Math.min(360 / f.w, 0.44);
    return thumbQaMode ? Math.min(base * 0.7, 0.28) : base;
  }, [isMobile, vw, f, thumbQaMode]);

  const slide = slides[activeIdx] ?? slides[0] ?? mkSlide(1, brand);
  const empty = isDefault(slides);

  useEffect(() => {
    if (!slide.bgImage && imageCropOpen) setImageCropOpen(false);
    if (!slide.bgImage && photoPositionOpen) setPhotoPositionOpen(false);
  }, [slide.bgImage, imageCropOpen, photoPositionOpen]);

  const editorIconBtn = ({
    onClick,
    title,
    ariaLabel,
    children,
    active = false,
    tour,
    style: extraStyle = {},
  }) => (
    <button
      type="button"
      data-vc-tour={tour}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || title}
      style={{
        width: isMobile ? 40 : 34,
        height: isMobile ? 40 : 34,
        borderRadius: 9999,
        border: `1px solid ${active ? 'var(--success-border)' : 'var(--border)'}`,
        background: active ? 'var(--success-surface)' : 'var(--bg-card)',
        color: active ? 'var(--success-text)' : 'var(--text-muted)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.12s',
        position: 'relative',
        flexShrink: 0,
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );

  const editorPillBtn = (onClick, label, Icon) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 34, padding: '0 12px', borderRadius: 9999,
        border: '1px solid var(--border)', background: 'var(--bg-card)',
        color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
        fontFamily: 'var(--font-ui)', display: 'inline-flex', alignItems: 'center', gap: 6,
        flexShrink: 0,
      }}
    >
      <Icon size={13} color="var(--text-muted)" /> {label}
    </button>
  );

  /** Conta no extremo direito — padrão SaaS (avatar/conta à direita). */
  const editorAccountNav = !isMobile && (
    <nav aria-label="Conta" style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
      {editorPillBtn(() => goAccount('profile'), 'Perfil', User)}
    </nav>
  );

  const editorGenerateBtn = (
    <button
      type="button"
      data-vc-tour="generate"
      onClick={() => setSetupOpen(true)}
      aria-label="Gerar carrossel com IA"
      style={{
        height: isMobile ? 40 : 40,
        padding: isMobile ? '0 14px' : '0 20px',
        borderRadius: 9999,
        border: 'none',
        cursor: 'pointer',
        background: 'var(--accent)',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'var(--font-ui)',
        letterSpacing: '-0.016em',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        flexShrink: 0,
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <Sparkles size={14} />
      {isMobile ? 'Gerar' : 'Gerar com IA'}
    </button>
  );

  const editorHeaderActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 6, flexShrink: 0 }}>
      <ModeSwitcher value={appMode} onChange={setAppMode} compact={isMobile} />
      {!isMobile && editorIconBtn({
        onClick: () => setTemplatesOpen(true),
        title: 'Templates prontos',
        children: <Layout size={13} />,
      })}
      {editorIconBtn({
        onClick: () => setLibraryOpen(true),
        title: `Biblioteca · ${library.length} carrosséis`,
        ariaLabel: 'Abrir biblioteca',
        tour: 'library',
        children: (
          <>
            <BookOpen size={13} />
            {library.length > 1 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-mono)',
                background: 'var(--accent)', color: '#fff',
                padding: '1px 5px', borderRadius: 99, lineHeight: 1.2,
                minWidth: 14, textAlign: 'center', pointerEvents: 'none',
              }}>{library.length}</span>
            )}
          </>
        ),
      })}
      {!empty && editorIconBtn({
        onClick: () => setFullscreenOpen(true),
        title: 'Tela cheia (F)',
        children: <Maximize2 size={13} />,
      })}
      {!isMobile && editorIconBtn({
        onClick: () => setHelpOpen(true),
        title: 'Ajuda e atalhos',
        children: <span style={{ fontSize: 14, fontWeight: 600 }}>?</span>,
      })}
      {editorIconBtn({
        onClick: () => setKeysOpen(true),
        title: hasAnyAI
          ? `IA pronta · texto ${aiSettings.textProvider} · imagem ${aiSettings.imageProvider}`
          : 'Configurar provedores de IA',
        ariaLabel: 'Configurar IA',
        tour: 'settings',
        active: hasAnyAI,
        children: <Settings size={13} />,
      })}
      {!isMobile && editorIconBtn({
        onClick: () => setResearchOpen(true),
        title: 'Pesquisar nicho',
        children: <TrendingUp size={14} />,
      })}
      {isMobile && editorGenerateBtn}
    </div>
  );

  const updateSlide = useCallback(patch => {
    setSlides(s => s.map((sl, i) => {
      if (i !== activeIdx) return sl;
      const next = { ...sl, ...patch };
      const mayScaleZones =
        (patch.titleSize != null || patch.subSize != null || patch.bodyAfterSize != null) &&
        !!next.canvas?.enabled &&
        next.canvas?.zones &&
        typeof next.canvas.zones === 'object';
      if (!mayScaleZones) return next;
      const cz = canvasZonesFontScalePatch(sl, next);
      return cz ? { ...next, ...cz } : next;
    }));
  }, [activeIdx]);

  const updateSlideAt = useCallback((idx, patch) => {
    setSlides(s => s.map((sl, i) => (i === idx ? { ...sl, ...patch } : sl)));
  }, []);

  const patchCanvasZonesAt = useCallback((idx, zonePatch) => {
    setSlides((prev) => {
      const sl = prev[idx];
      if (!sl?.canvas?.enabled || !sl.canvas.zones) return prev;
      const nextZones = { ...sl.canvas.zones };
      for (const [k, rect] of Object.entries(zonePatch)) {
        if (rect && typeof rect === 'object') nextZones[k] = clampRect(rect);
      }
      return prev.map((s, i) =>
        i === idx ? { ...s, canvas: { ...s.canvas, zones: nextZones } } : s,
      );
    });
  }, []);

  const consumePhotoZoneFileForSlide = useCallback((slideIdx, file) => {
    if (!file) return;
    const sIdx = Math.trunc(Number(slideIdx));
    if (!Number.isFinite(sIdx) || sIdx < 0 || sIdx >= slidesLiveRef.current.length) {
      toast('Não foi possível aplicar a foto a este slide.', 'error', 4000);
      return;
    }
    void vcImageFileToStorageDataUrl(file).then((url) => {
      if (typeof url !== 'string' || url.length < 32) {
        toast('Não foi possível processar a imagem. Tente JPEG ou PNG.', 'error', 4500);
        return;
      }
      if (!url.startsWith('data:')) {
        toast('Formato não reconhecido após leitura. Tente outro ficheiro.', 'error', 4500);
        return;
      }
      updateSlideAt(sIdx, { bgImage: url, bgImageSource: 'imported' });
    });
  }, [updateSlideAt, toast]);

  const handlePhotoZoneNativeFile = useCallback((slideIdx, e) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    consumePhotoZoneFileForSlide(slideIdx, file);
  }, [consumePhotoZoneFileForSlide]);

  const preparePhotoZoneImportTarget = useCallback((idx) => {
    if (idx == null || !Number.isFinite(Number(idx))) return;
    const slideIdx = Math.trunc(Number(idx));
    photoZoneTargetIdxRef.current = slideIdx;
    const el = photoZoneInputRef.current;
    if (!el) return;
    el.setAttribute('data-vc-photo-zone-idx', String(slideIdx));
    el.value = '';
  }, []);

  const openPhotoZoneImport = useCallback((idx) => {
    preparePhotoZoneImportTarget(idx);
    try {
      photoZoneInputRef.current?.click();
    } catch (_) { /* ignore */ }
  }, [preparePhotoZoneImportTarget]);

  const handlePhotoZoneBgFile = useCallback((e) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    const fromAttr = input.getAttribute('data-vc-photo-zone-idx');
    let idx =
      fromAttr != null && fromAttr !== ''
        ? Number(fromAttr)
        : photoZoneTargetIdxRef.current;
    photoZoneTargetIdxRef.current = null;
    input.removeAttribute('data-vc-photo-zone-idx');
    input.value = '';
    if (!file || idx == null || !Number.isFinite(idx)) return;
    consumePhotoZoneFileForSlide(Math.trunc(idx), file);
  }, [consumePhotoZoneFileForSlide]);

  // Importar vídeo no slide ativo — guarda blob no IndexedDB, atualiza slide.videoId
  const importVideoToActiveSlide = useCallback(async (file) => {
    if (!file) return;
    const MAX_BYTES = 60 * 1024 * 1024; // 60MB — Safari iOS quebra acima disso
    if (file.size > MAX_BYTES) {
      toast(`Vídeo grande demais (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: 60 MB. Comprima antes (CapCut, HandBrake).`, 'error', 6000);
      return;
    }
    try {
      const id = newVideoId();
      await videoPut(id, file, { mime: file.type, name: file.name });
      // Limpa videoId antigo se houver (cleanup async, não bloqueia)
      const oldId = slides[activeIdx]?.videoId;
      if (oldId) {
        videoDelete(oldId).catch(() => {});
        const oldUrl = videoUrlsRef.current[oldId];
        if (oldUrl) {
          try { URL.revokeObjectURL(oldUrl); } catch { /* */ }
        }
      }
      // Cria object URL imediato pra render rápido. Sync = mapa module-level
      // atualiza ANTES do próximo render (não fica 1 ciclo atrás).
      const url = URL.createObjectURL(file);
      setVideoUrlsSync(prev => ({ ...prev, [id]: url }));
      // Atualiza slide: limpa bgImage (mutual exclusion), seta videoId
      updateSlide({
        videoId: id,
        videoMime: file.type || 'video/mp4',
        videoName: file.name,
        bgImage: null,
        bgImageFailed: false,
        bgImageSource: null,
      });
      const usage = await videoStorageUsage().catch(() => null);
      const usageNote = usage ? ` · uso total ${usage.totalMB.toFixed(1)} MB / ${usage.count} vídeos` : '';
      toast(`Vídeo importado (${(file.size / 1024 / 1024).toFixed(1)} MB)${usageNote}`, 'success', 4000);
      trackEvent('video_imported', { size_mb: String(Math.round(file.size / 1024 / 1024)), mime: file.type || 'unknown' });
    } catch (e) {
      console.error('[video] erro ao importar:', e);
      toast(`Erro ao importar vídeo: ${e.message}`, 'error', 6000);
    }
  }, [activeIdx, slides, updateSlide, toast]);

  // Remover vídeo do slide ativo (apaga do IndexedDB também)
  const removeVideoFromActiveSlide = useCallback(async () => {
    const slide = slides[activeIdx];
    const oldId = slide?.videoId;
    if (!oldId) return;
    try {
      await videoDelete(oldId);
      const oldUrl = videoUrlsRef.current[oldId];
      if (oldUrl) {
        try { URL.revokeObjectURL(oldUrl); } catch { /* */ }
        setVideoUrlsSync(prev => {
          const next = { ...prev };
          delete next[oldId];
          return next;
        });
      }
      updateSlide({ videoId: null, videoMime: null, videoName: null });
      toast('Vídeo removido do card.', 'info');
    } catch (e) {
      console.error('[video] erro ao remover:', e);
    }
  }, [activeIdx, slides, updateSlide, toast]);

  const handleBatchPhotos = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    const readOne = (file) =>
      vcImageFileToStorageDataUrl(file).then((url) =>
        typeof url === 'string' && url.length >= 32 ? url : null,
      );

    void (async () => {
      const urls = await Promise.all(files.map(readOne));
      const slideCount = slidesLiveRef.current.length;
      const n = Math.min(urls.length, slideCount);

      setSlides((prev) => {
        const cap = Math.min(urls.length, prev.length);
        return prev.map((sl, j) => {
          if (j >= cap) return sl;
          const data = urls[j];
          return data ? { ...sl, bgImage: data, bgImageSource: 'imported' } : sl;
        });
      });

      const extraFiles = urls.length > slideCount;
      const leftoverSlides = slideCount > urls.length;
      if (extraFiles || leftoverSlides) {
        toast(
          extraFiles
            ? `Foram aplicadas ${n} fotos (até ao slide ${n}). Mais ${urls.length - n} ficheiros extra ignorados.`
            : `Foram aplicadas ${n} fotos aos primeiros slides; ${slideCount - n} cards ficaram sem ficheiro novo.`,
          'info',
        );
      } else {
        toast(`${n} fotos aplicadas (slide 1 a ${n}).`, 'success');
      }
    })();
  }, [setSlides, toast]);

  const enableCanvasLayout = useCallback(() => {
    setSlides((prev) =>
      prev.map((s) => {
        const d = inferCanvasDefaults(s, creativePreset);
        return {
          ...s,
          canvas: {
            enabled: true,
            variant: d.variant,
            zones: { ...d.zones },
          },
        };
      }),
    );
    setCanvasEditMode(true);
    toast('Composição ativada em todos os cards. Use o toggle para mover e redimensionar zonas.', 'success');
  }, [creativePreset, setSlides, toast]);

  const disableCanvasLayout = useCallback(() => {
    setSlides((prev) => prev.map((s) => (s.canvas ? { ...s, canvas: { ...s.canvas, enabled: false } } : s)));
    setCanvasEditMode(false);
    toast('Composição desativada (as zonas ficam guardadas).', 'info');
  }, [setSlides, toast]);

  const swapCanvasZoneContent = useCallback((toIdx, raw) => {
    let parsed;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return;
    }
    const fromIdx = parsed?.slideIdx;
    const zone = parsed?.zone;
    if (!Number.isFinite(fromIdx) || typeof zone !== 'string') return;
    if (fromIdx === toIdx) return;
    setSlides((prev) => {
      const a = prev[fromIdx];
      const b = prev[toIdx];
      if (!a || !b) return prev;
      const next = [...prev];
      if (zone === 'photo') {
        next[fromIdx] = { ...a, bgImage: b.bgImage };
        next[toIdx] = { ...b, bgImage: a.bgImage };
      } else if (zone === 'title') {
        next[fromIdx] = { ...a, title: b.title };
        next[toIdx] = { ...b, title: a.title };
      } else if (zone === 'subtitle') {
        next[fromIdx] = { ...a, subtitle: b.subtitle };
        next[toIdx] = { ...b, subtitle: a.subtitle };
      } else if (zone === 'top') {
        next[fromIdx] = { ...a, title: b.title, subtitle: b.subtitle };
        next[toIdx] = { ...b, title: a.title, subtitle: a.subtitle };
      } else if (zone === 'bottom') {
        next[fromIdx] = { ...a, bodyAfterImage: b.bodyAfterImage };
        next[toIdx] = { ...b, bodyAfterImage: a.bodyAfterImage };
      } else {
        return prev;
      }
      return next;
    });
    toast('Conteúdo da zona trocado entre os cards.', 'success');
  }, [setSlides, toast]);

  /** Replica tamanhos, espaçamento e legibilidade do card ativo para todos os slides. */
  const applyTypographyToAllCards = useCallback(() => {
    setSlides((list) => {
      const src = list[activeIdx];
      if (!src) return list;
      const patch = {
        titleSize: src.titleSize ?? 100,
        subSize: src.subSize ?? 100,
        bodyAfterSize: src.bodyAfterSize ?? src.subSize ?? 100,
        titleTracking: src.titleTracking ?? 0,
        titleLeading: src.titleLeading ?? 105,
        titleWeight: src.titleWeight ?? 800,
        titleCase: src.titleCase ?? 'normal',
        subTracking: src.subTracking ?? 0,
        subLeading: src.subLeading ?? 150,
        textShadow: src.textShadow !== false,
        textBg: !!src.textBg,
        textBgOpacity: src.textBgOpacity ?? 55,
        textInset: src.textInset ?? DEFAULT_SLIDE_TEXT_INSET,
      };
      return list.map((sl) => ({ ...sl, ...patch }));
    });
    toast('Tipografia deste card aplicada a todos os slides', 'success');
  }, [activeIdx, setSlides, toast]);

  const applyBrandTypographyToAllSlides = useCallback(() => {
    const patch = typographyPatchFromBrand(brand);
    setSlides((list) => list.map((sl) => ({ ...sl, ...patch })));
    toast('Tipografia da marca aplicada a todos os slides.', 'success');
  }, [brand, setSlides, toast]);

  // Auto-aplica tipografia da marca em TODOS os slides quando user mexe nos sliders
  // do painel "Texto nos slides". Antes precisava apertar o botão "Aplicar a todos".
  // Skip primeira renderização (evita sobrescrever per-card overrides no boot).
  const brandTypoFirstRunRef = useRef(true);
  useEffect(() => {
    if (brandTypoFirstRunRef.current) {
      brandTypoFirstRunRef.current = false;
      return;
    }
    const patch = typographyPatchFromBrand(brand);
    setSlides((list) => list.map((sl) => ({ ...sl, ...patch })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    brand.textTitleSize, brand.textSubSize, brand.textBodyAfterSize,
    brand.textTitleTracking, brand.textTitleLeading, brand.textTitleWeight, brand.textTitleCase,
    brand.textSubTracking, brand.textSubLeading,
  ]);

  const persistFullscreenPresentationAdjustDraft = useCallback((draftBySlideId) => {
    if (!draftBySlideId || typeof draftBySlideId !== 'object') return;
    setSlides((prev) =>
      prev.map((sl) => {
        if (!Object.prototype.hasOwnProperty.call(draftBySlideId, sl.id)) return sl;
        const normalized = normalizePresentationImgAdjust(draftBySlideId[sl.id]);
        const next = { ...sl };
        if (presentationAdjustIsNeutral(normalized)) delete next.presentationImgAdjust;
        else next.presentationImgAdjust = normalized;
        return next;
      }),
    );
    toast('Ajustes da foto gravados no projeto.', 'success');
  }, [setSlides, toast]);

  const generateSlideImageAt = useCallback(async (idx) => {
    const snap = slides[idx];
    if (!snap) return;
    const slideId = snap.id;
    if (slideImgGenIdsRef.current.has(slideId)) return;

    const q = (snap.imageQuery || '').trim();
    if (!q) {
      toast(
        'Este card ainda não tem palavras-chave de imagem. Gere o carrossel com IA ou defina-as em Cards → Imagem de fundo.',
        'error',
      );
      return;
    }

    if (!hasOpenAI) {
      toast('Configure o provedor de imagem em ⚙ (OpenAI ou Z.ai).', 'error');
      return;
    }

    slideImgGenIdsRef.current.add(slideId);
    setSlideImgGenBusy(prev => ({ ...prev, [slideId]: true }));
    try {
      const url = await generateDALLEWithRetry(q, openaiKey, imgParams, {
        refImage: snap.refImage,
        imgExtraPrompt: snap.imgExtraPrompt,
      });
      setSlides(prev => {
        const j = prev.findIndex(sl => sl.id === slideId);
        return j < 0 ? prev : prev.map((sl, k) => (k === j ? { ...sl, bgImage: url, imgMode: 'dalle', overlay: 70, bgImageFailed: false, bgImageSource: 'ai' } : sl));
      });
      toast(`Slide ${idx + 1}: imagem gerada`, 'success');
    } catch (e) {
      toast(`GPT Image: ${e.message}`, 'error');
    } finally {
      slideImgGenIdsRef.current.delete(slideId);
      setSlideImgGenBusy(prev => {
        const next = { ...prev };
        delete next[slideId];
        return next;
      });
    }
  }, [slides, hasOpenAI, openaiKey, imgParams, setSlides, toast]);

  const openRefImagePicker = useCallback((slideIdx) => {
    refImageTargetIdxRef.current = slideIdx;
    refImageInputRef.current?.click();
  }, []);
  const handleRefImageFile = useCallback((e) => {
    const file = e.target.files?.[0];
    const idx = refImageTargetIdxRef.current;
    refImageTargetIdxRef.current = null;
    e.target.value = '';
    if (!file || idx == null) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateSlideAt(idx, { refImage: reader.result });
    };
    reader.readAsDataURL(file);
  }, [updateSlideAt]);

  // Repara histórico se `slides` estiver vazio (storage/import estragado) — sem novo passo de undo.
  useLayoutEffect(() => {
    const raw = history.state?.slides;
    if (Array.isArray(raw) && raw.length > 0) return;
    history.setSilent(d => ({
      ...d,
      slides: [mkSlide(1, d.brand && typeof d.brand === 'object' ? d.brand : DEFAULT_BRAND)],
    }));
    // history omitido de propósito — só repara ao trocar de doc
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId]);

  const addSlide = useCallback(() => {
    const pr = normalizeCardVisualStyle(doc.cardVisualStyle);
    const n = { ...mkSlide(slides.length + 1, brand), layout: 'bl', align: 'left', photoRegion: pr };
    setSlides([...slides, n]); setActiveIdx(slides.length);
  }, [slides, brand, doc.cardVisualStyle, setSlides]);
  const deleteSlide = useCallback((i) => {
    if (slides.length<=1) return;
    const slide = slides[i];
    const preview = (slide?.title || '').trim().slice(0, 50) || `Card ${i+1}`;
    if (!window.confirm(`Apagar "${preview}"?\n\nEsta ação não pode ser desfeita por completo (o Cmd+Z pode recuperar nesta sessão).`)) return;
    const next = slides.filter((_,j)=>j!==i).map((s,j)=>({...s,num:j+1}));
    setSlides(next); setActiveIdx(Math.min(activeIdx, next.length-1));
  }, [slides, activeIdx]);
  const duplicateSlide = useCallback((i) => {
    const dup = {...slides[i], id:uid(), num:slides.length+1};
    const next = [...slides]; next.splice(i+1,0,dup);
    setSlides(next.map((s,j)=>({...s,num:j+1}))); setActiveIdx(i+1);
  }, [slides]);
  const moveSlide = useCallback((i,d) => {
    const j=i+d; if(j<0||j>=slides.length) return;
    const next=[...slides]; [next[i],next[j]]=[next[j],next[i]];
    setSlides(next.map((s,k)=>({...s,num:k+1}))); setActiveIdx(j);
  }, [slides]);

  const handleGenerate = async ({
    topic,
    count,
    niche: n,
    tone,
    audience,
    imgMode: chosenMode = 'dalle',
    imgParams: axes,
    mode: chosenNarrativeMode,
    creativePreset: presetArg,
    slideTextDensity: densityArg,
    cardVisualStyle: cardStyleArg,
    fetchImagesNow = true,
  }) => {
    // Captura args pra Remix com tom alternativo (B1) — não inclui fetchImagesNow nem chosenMode
    // pra que o remix herde os defaults atuais.
    lastGenerateArgsRef.current = {
      topic, count, niche: n, tone, audience,
      imgParams: axes, mode: chosenNarrativeMode,
      creativePreset: presetArg, slideTextDensity: densityArg,
      cardVisualStyle: cardStyleArg,
    };
    setHasLastGenerate(true);
    trackEvent('carousel_generate_start', {
      preset: presetArg ?? creativePreset ?? 'livre',
      mode: chosenNarrativeMode || mode || 'editorial',
      count: String(count || 0),
      with_images: fetchImagesNow ? 'true' : 'false',
    });
    try {
    const effectiveAxes = axes || imgParams;
    const cp = presetArg ?? creativePreset ?? 'livre';
    const effectiveMode = isTendenciaCulturaPreset(cp)
      ? 'editorial'
      : isQuickTemplatePreset(cp)
        ? (QUICK_TEMPLATE_NARRATIVE_MODE[quickTemplateIdFromPreset(cp)] || 'editorial')
        : (chosenNarrativeMode || mode || 'editorial');
    const tdRaw = densityArg ?? slideTextDensity ?? '1_1';
    const td = SLIDE_TEXT_DENSITY_BY_ID[tdRaw] ? tdRaw : '1_1';
    const cvStyle = normalizeCardVisualStyle(cardStyleArg ?? doc.cardVisualStyle);
    const modeDef = GEN_MODE_BY_ID[effectiveMode] || GEN_MODES[0];
    const brandBlock = buildBrandBlock(brand);
    const { materialBlock, materialPriorityBlock } = await resolveMaterialPromptParts(material, toast);
    const imgParamsBlock = buildImgParamsBlockPT(effectiveAxes);
    const introLine = buildGenerationIntroLine(cp);
    const langLayer = buildGenerationLanguageLayer(cp, tone, effectiveMode);
    const imageLayer = buildGenerationImageLayer(cp, topic, n, audience);
    const slideLayoutRules = buildGenerationSlideLayoutRules(effectiveMode, cp, td);
    const tendenciaPackBlock = isTendenciaCulturaPreset(cp) ? buildTendenciaCulturaPackBlock(count, td) : '';
    const quickTid = quickTemplateIdFromPreset(cp);
    const quickPackBlock = quickTid ? buildQuickTemplatePackBlock(quickTid, count) : '';

    const persoHybridActive = isPersoHybridDensity(cp, td);
    const persoHybridBlock = persoHybridActive ? buildPersoHybridLayoutBlock(count, td) : '';

    const jsonShapeLine = isTendenciaCulturaPreset(cp)
      ? '{"slides":[{"title":"…","subtitle":"…","imageQuery":"… (inglês, 8–15 palavras)","bodyAfterImage":"… (regras: capa + último slide vazio; miolo COM foto = obrigatório)","cultureTone":"opcional: light | dark | accent ou omita"}],"caption":"legenda…"}'
      : persoHybridActive
        ? '{"slides":[{"title":"…","subtitle":"…","imageQuery":"… (inglês, 8–15 palavras)","bodyAfterImage":"… (slides 1–2 vazio; desde o 3º = sanduíche se houver foto)","cultureTone":"opcional"}],"caption":"legenda…"}'
        : '{"slides":[{"title":"…","subtitle":"…","imageQuery":"…"}],"caption":"legenda…"}';

    const idiomaRegra = `
REGRA DE IDIOMA (obrigatória):
- Redija em português brasileiro: "title", "subtitle", "bodyAfterImage" (se existir) e "caption".
- Exceção: cada "imageQuery" permanece em INGLÊS (8–15 palavras), conforme a seção de direção de imagem — não traduza esse campo para o português.

PROIBIDO RÓTULO DE ENUMERAÇÃO DO CARROSSEL NOS CAMPOS DE TEXTO:
- Não escreva "Slide 1", "Slide 01", "Slide 2 —", "Card 3", "SLIDE 6:" nem equivalentes em "title", "subtitle" ou "bodyAfterImage". O utilizador já vê o número do card na interface — o copy deve ser só conteúdo editorial (gancho, tese, prosa).
`;

    const contextoModoPerso =
      isTendenciaCulturaPreset(cp)
        ? ''
        : isQuickTemplatePreset(cp)
          ? [
              n ? `Nicho: ${n}` : '',
              audience ? `Público-alvo: ${audience}` : '',
              `Tom de voz (marca): ${tone}`,
            ].filter(Boolean).join('\n')
          : [
              n ? `Nicho: ${n}` : '',
              audience ? `Público-alvo: ${audience}` : '',
              `Tom de voz solicitado: ${tone}`,
            ].filter(Boolean).join('\n');
    const modoNarrativoBloco =
      isTendenciaCulturaPreset(cp)
        ? '(Contexto estrutural: use apenas o PACOTE TENDÊNCIA/CULTURA abaixo — ignore modos narrativos editoriais tipo editorial/viral/storytelling.)'
        : modeDef.method;

    const hasPromptMaterial = !!(
      String(materialBlock || '').trim() ||
      String(materialPriorityBlock || '').trim()
    );

    const prompt = `${introLine}
${hasPromptMaterial ? `${materialBlock}${materialPriorityBlock}` : ''}Crie um carrossel de ${count} slides para Instagram sobre: "${topic}"
${contextoModoPerso ? `${contextoModoPerso}\n` : ''}${brandBlock}
${hasPromptMaterial ? '' : `${materialBlock}${materialPriorityBlock}`}${imgParamsBlock}

${idiomaRegra}

${modoNarrativoBloco}
${tendenciaPackBlock}
${quickPackBlock ? `${quickPackBlock}\n` : ''}

${slideLayoutRules}
${persoHybridBlock ? `${persoHybridBlock}\n` : ''}

${langLayer}

${imageLayer}

JSON exato a retornar (sem mais nada):
${jsonShapeLine}`;

    setGenProgress({ phase: 'text', current: 0, total: 1, label: 'Escrevendo texto dos slides…' });
    const result = await callAI(prompt, { json:true, maxTokens:4096, openaiKey });
    if (!result?.slides?.length) { setGenProgress(null); throw new Error('IA não retornou slides. Tente um tema mais específico.'); }
    setGenProgress({ phase: 'text', current: 1, total: 1, label: 'Texto pronto, preparando cards…' });

    const resolvedImgMode = normalizeSlideImgMode(chosenMode || 'dalle');
    const nSlides = result.slides.length;

    const newSlides = applyFinalizeCanvasMarginsToSlides(
      attachGenerationCanvasLayouts(
      result.slides.map((s, i) => {
      let q = ((s.imageQuery ?? s.image_query) || '').trim();
      const title = stripLeadingSlideCardLabel(String(s.title ?? '').trim());
      const subtitle = stripLeadingSlideCardLabel(String(s.subtitle ?? '').trim());
      // Fallback: capa e encerramento de Cultura/Perso Hybrid SEMPRE devem ter foto
      // (full-bleed). Se a IA omitiu imageQuery, gera uma a partir do título+subtitle
      // em inglês básico — o pipeline DALL·E ainda passa.
      const isFullBleedSlot =
        (isTendenciaCulturaPreset(cp) && (i === 0 || i === nSlides - 1)) ||
        (isPersoHybridDensity(cp, td) && i <= 1);
      if (!q && isFullBleedSlot && (title || subtitle)) {
        const seed = `${title} ${subtitle}`.trim().slice(0, 120);
        q = `editorial photo illustrating: ${seed} — cinematic, documentary mood, natural lighting`;
        console.warn(`[handleGenerate] IA omitiu imageQuery do slide ${i+1} (full-bleed) — usando fallback baseado em título.`);
      }
      const base = {
        ...mkSlide(i + 1, brand),
        title,
        subtitle,
        imageQuery: q,
        imgMode: resolvedImgMode,
        bgImage: null,
        layout: i === 0 ? 'mc' : 'bl',
        align: i === 0 ? 'center' : 'left',
        useCultureLayout: false,
        photoRegion: cvStyle,
      };

      if (isTendenciaCulturaPreset(cp)) {
        let rawBody = typeof s.bodyAfterImage === 'string'
          ? s.bodyAfterImage
          : typeof s.body_after_image === 'string'
            ? s.body_after_image
            : '';
        let bodyAfterImage = stripLeadingSlideCardLabel(rawBody.trim());
        const ct = coerceCultureTone(s.cultureTone ?? s.culture_tone);

        let overlay = 0;
        const fullBleed = i === 0 || i === nSlides - 1;
        if (fullBleed) {
          bodyAfterImage = '';
          overlay = q ? 70 : 0;
        } else if (q && bodyAfterImage) {
          overlay = 0;
        } else if (q) {
          overlay = 70;
        }
        return { ...base, bodyAfterImage, cultureTone: ct, overlay };
      }

      if (persoHybridActive) {
        let rawBody = typeof s.bodyAfterImage === 'string'
          ? s.bodyAfterImage
          : typeof s.body_after_image === 'string'
            ? s.body_after_image
            : '';
        let bodyAfterImage = stripLeadingSlideCardLabel(rawBody.trim());
        const ct = coerceCultureTone(s.cultureTone ?? s.culture_tone);
        let overlay = 0;
        const fullBleedPair = i <= 1;

        if (fullBleedPair) {
          bodyAfterImage = '';
          overlay = q ? 70 : 0;
          return { ...base, bodyAfterImage, cultureTone: ct, overlay, useCultureLayout: false };
        }

        const sandwichRow = !!(q && bodyAfterImage);
        if (sandwichRow) overlay = 0;
        else if (q) overlay = 70;
        return {
          ...base,
          bodyAfterImage,
          cultureTone: ct,
          overlay,
          useCultureLayout: true,
        };
      }

      return { ...base, overlay: q ? 70 : 0 };
      }),
      { creativePreset: cp, slideTextDensity: td },
      ),
      fmt,
    );
    setSlides(newSlides); setActiveIdx(0); setShellView('project');
    const quickTplSynced = isQuickTemplatePreset(cp) ? TEMPLATES.find((x) => x.id === quickTemplateIdFromPreset(cp)) : null;
    if (quickTplSynced) {
      const pal = PALETTES[quickTplSynced.palette] || PALETTES[0];
      setBrand((b) => ({
        ...b,
        bg: pal.bg,
        titleColor: pal.title,
        subtitleColor: pal.subtitle,
        textColor: pal.text,
        accent: pal.accent,
      }));
    }
    if (isMobile) {
      setTab('slide');
      setDrawerOpen(true);
    }
    if (n) setNiche(n);
    if (result.caption) setCaption(result.caption);

    // GPT Image: preenche bgImage assincronamente (slide a slide)
    // Guard contra race-condition: cancela qualquer loop anterior ainda em voo.
    if (imgGenAbortRef.current) imgGenAbortRef.current.cancelled = true;
    const abort = { cancelled: false };
    imgGenAbortRef.current = abort;

    let imgFailCount = 0;

    if (fetchImagesNow) {
      if (hasOpenAI) {
        const slidesWithImage = newSlides.map((sl, i) => ({ sl, i, q: result.slides[i]?.imageQuery || sl.imageQuery }))
                                          .filter(x => !!(x.q && String(x.q).trim()));
        const totalImgs = slidesWithImage.length;
        let doneImgs = 0;
        setGenProgress({ phase: 'images', current: 0, total: totalImgs, label: `Gerando imagens (0/${totalImgs})…` });
        for (const { i, q } of slidesWithImage) {
          if (abort.cancelled) break;
          setGenProgress({ phase: 'images', current: doneImgs, total: totalImgs, label: `Gerando imagem do card ${i+1} (${doneImgs+1}/${totalImgs})…` });
          try {
            const url = await generateDALLEWithRetry(q, openaiKey, effectiveAxes, {
              refImage: newSlides[i]?.refImage,
              imgExtraPrompt: newSlides[i]?.imgExtraPrompt,
            });
            if (!abort.cancelled)
              setSlides(prev => prev.map((sl, idx) => idx === i ? { ...sl, bgImage: url, bgImageFailed: false, bgImageSource: 'ai' } : sl));
          } catch(e) {
            imgFailCount++;
            console.warn(`Image gen slide ${i+1}:`, e.message);
            if (!abort.cancelled)
              setSlides(prev => prev.map((sl, idx) => idx === i ? { ...sl, bgImageFailed: true } : sl));
          }
          doneImgs++;
          setGenProgress({ phase: 'images', current: doneImgs, total: totalImgs, label: `Gerando imagens (${doneImgs}/${totalImgs})…` });
        }
      }

      if (!abort.cancelled && imgFailCount > 0) {
        toast(
          imgFailCount === 1
            ? '1 imagem não carregou após retry — toque na área da foto para tentar de novo.'
            : `${imgFailCount} imagens não carregaram após retry — toque nas áreas das fotos para tentar de novo.`,
          'warning',
          6000,
        );
      }
    } else if (result.slides.some(s => (s.imageQuery || '').trim())) {
      toast(
        'Imagens não foram geradas agora — já existem zonas de foto nos cards (toque na área para importar ou use «Gerar imagem»).',
        'info',
        5500,
      );
    }
      trackEvent('carousel_generate_success', {
        slide_count: String(newSlides.length),
        image_failures: String(imgFailCount),
      });
    } catch (err) {
      trackEvent('carousel_generate_error', {
        msg: String(err?.message || '').slice(0, 80),
      });
      throw err;
    } finally {
      setGenProgress(null);
    }
  };

  const refineSlide = async (instruction) => {
    setRefining(true); setError('');
    try {
      const ctx = slides.map((s,i)=>`${i+1}. ${s.title}`).join('\n');
      const brandBlock = buildBrandBlock(brand);
      const { materialBlock, materialPriorityBlock } = await resolveMaterialPromptParts(material, toast);
      const voiceRefine = buildRefineVoiceRules(creativePreset, mode);
      const cultureRef = buildTendenciaCulturaRefineSlideHint(creativePreset, slideTextDensity);
      const nSl = slides.length;
      const isCultureSandwichSlide =
        isTendenciaCulturaPreset(creativePreset) && activeIdx > 0 && activeIdx < nSl - 1;
      const isPersoHybridRefineSlide =
        isPersoHybridDensity(creativePreset, slideTextDensity) && activeIdx >= 2;
      const refineNeedsBodyAfter = isCultureSandwichSlide || isPersoHybridRefineSlide;
      const singleJson = refineNeedsBodyAfter
        ? '{"title":"...","subtitle":"...","bodyAfterImage":"..."}'
        : '{"title":"...","subtitle":"..."}';
      const r = await callAI(
        `Atue como editor de carrossel para Instagram. Responda APENAS com JSON.

${buildNarrativeModeReminder(mode)}

Contexto do carrossel:\n${ctx}
${brandBlock}${materialBlock}${materialPriorityBlock}
Slide ${activeIdx+1} (atual):
Título: "${slide.title}"
Subtítulo: "${slide.subtitle}"
${refineNeedsBodyAfter ? `Corpo abaixo da imagem / bloco inferior — bodyAfterImage atual:\n${JSON.stringify(slide.bodyAfterImage ?? '')}\n` : ''}
Instrução de refinamento: ${instruction}

REGRAS:
${voiceRefine}
${cultureRef}
- PROIBIDO devolver "Slide N", "Card N" ou "01." como título; só copy editorial (o app mostra o índice do card).
${isPersoHybridRefineSlide ? '- Layout Personalizado (1/1 ou 1/2): slides desta posição usam formato sanduíche — mantenha payoff em bodyAfterImage abaixo da foto.\n' : ''}
${buildRefineSingleSlideRules(mode, slideTextDensity)}
- Mantenha coerência com os outros slides e com o modo narrativo acima.
- Respeite a identidade verbal e o material acima.

Retorne exatamente: ${singleJson}`,
        { json:true, openaiKey }
      );
      const patch = {
        title: stripLeadingSlideCardLabel(String(r.title ?? slide.title ?? '').trim()),
        subtitle: stripLeadingSlideCardLabel(String(r.subtitle ?? slide.subtitle ?? '').trim()),
      };
      if (typeof r.bodyAfterImage === 'string' && refineNeedsBodyAfter) {
        patch.bodyAfterImage = stripLeadingSlideCardLabel(String(r.bodyAfterImage).trim());
      }
      updateSlide(patch);
    } catch(e) { setError(e.message); }
    finally { setRefining(false); }
  };

  const generateCaption = async () => {
    setGenCaption(true); setError('');
    try {
      const ctx = slides.map((s,i)=>`Slide ${i+1}: ${s.title} — ${s.subtitle}`).join('\n');
      const brandBlock = buildBrandBlock(brand);
      const capRules = buildCaptionVoiceRules(creativePreset, mode);
      const { materialBlock, materialPriorityBlock } = await resolveMaterialPromptParts(material, toast);
      const r = await callAI(
        `Atue como estrategista de conteúdo para Instagram. Crie a legenda para este carrossel em português brasileiro.

${buildNarrativeModeReminder(mode)}

Carrossel:
${ctx}
${brandBlock}${materialBlock}${materialPriorityBlock}
${buildCaptionOutlineInstructions(mode)}

REGRAS:
${capRules}
- 8-12 linhas de texto. Use quebras de linha para ritmo.
- Adicionar no final 8-12 hashtags estratégicas ao nicho.
- Respeite a identidade verbal e o material acima. Se houver assinatura recorrente, finalize com ela quando fizer sentido.
- Apenas a legenda e as hashtags, nada mais.`,
        { openaiKey }
      );
      const INSTAGRAM_CAPTION_LIMIT = 2200;
      let finalCaption = r.trim();
      if (finalCaption.length > INSTAGRAM_CAPTION_LIMIT) {
        const over = finalCaption.length - INSTAGRAM_CAPTION_LIMIT;
        finalCaption = finalCaption.slice(0, INSTAGRAM_CAPTION_LIMIT - 1).trimEnd() + '…';
        toast(`Legenda excedia o limite do Instagram em ${over} caracteres — cortei o final.`, 'warning', 5000);
      }
      setCaption(finalCaption);
    } catch(e) { setError(e.message); }
    finally { setGenCaption(false); }
  };

  // Garante que: (a) fontes web carregaram (b) imagens dos slides estão carregadas
  // (c) o React já flushou o DOM offscreen. Sem isso, o html2canvas pode capturar
  // texto sem fonte ou imagens ainda em loading.
  const waitForRender = async () => {
    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch {}
    }
    // 2 frames pra garantir que o React fez paint do DOM offscreen
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    // Aguarda imagens dentro dos refs offscreen carregarem
    const imgs = [];
    for (const id in slideRefs.current) {
      const el = slideRefs.current[id];
      if (!el) continue;
      el.querySelectorAll('img').forEach(img => imgs.push(img));
    }
    await Promise.all(imgs.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise(res => {
        img.addEventListener('load',  res, { once:true });
        img.addEventListener('error', res, { once:true });
        setTimeout(res, 3000); // failsafe
      });
    }));
  };

  const renderSlideToCanvas = async (slideObj) => {
    const h2c = await loadHtml2Canvas();
    const el = slideRefs.current[slideObj.id];
    if (!el) throw new Error('Elemento de export não encontrado');
    const f = FORMATS[fmt] || FORMATS.carrossel;
    const w = Math.max(1, Math.round(el.offsetWidth || el.scrollWidth || f.w));
    const h = Math.max(1, Math.round(el.offsetHeight || el.scrollHeight || f.h));
    return h2c(el, {
      scale: 2,                 // 2× resolução final pra ficar nítido
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: null,
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      onclone: (clonedDoc, clonedEl) => {
        vcFixHtml2CanvasImages(clonedDoc, clonedEl);
      },
    });
  };

  const exportSlide = async (idx) => {
    setExporting(true); setExportProgress({current:1,total:1});
    try {
      const slide = slides[idx];
      // Se card tem vídeo, baixa o vídeo bruto + uma cópia PNG do card sem o vídeo
      // (pra você sobrepor manualmente no CapCut/InShot)
      if (slide?.videoId) {
        const entry = await videoGet(slide.videoId);
        if (entry?.blob) {
          const ext = (entry.mime || 'video/mp4').split('/')[1].split(';')[0] || 'mp4';
          await downloadBlob(entry.blob, `slide-${String(idx+1).padStart(2,'0')}-video.${ext}`);
          toast(`Vídeo do card ${idx+1} baixado. Adicione o texto no editor de vídeo (CapCut, InShot, etc).`, 'success', 6000);
          return;
        }
      }
      await loadHtml2Canvas();
      await waitForRender();
      const canvas = await renderSlideToCanvas(slide);
      await downloadCanvasPng(canvas, `slide-${String(idx+1).padStart(2,'0')}.png`);
      toast(`Card ${idx+1} baixado`, 'success');
    } catch(e) { setError('Erro ao exportar: '+e.message); }
    finally { setExporting(false); }
  };

  const exportAll = async () => {
    setExporting(true);
    setExportProgress({current:0,total:slides.length});
    try {
      await loadHtml2Canvas();
      await waitForRender();
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const videoSlides = [];
      for (let i=0; i<slides.length; i++) {
        setExportProgress({current:i+1,total:slides.length});
        const slide = slides[i];
        if (slide?.videoId) {
          // Slide com vídeo: empacota o vídeo bruto + ainda gera o PNG do preview
          // (o PNG ajuda a visualizar; o vídeo é o material editável no CapCut)
          try {
            const entry = await videoGet(slide.videoId);
            if (entry?.blob) {
              const ext = (entry.mime || 'video/mp4').split('/')[1].split(';')[0] || 'mp4';
              zip.file(`slide-${String(i+1).padStart(2,'0')}-video.${ext}`, entry.blob);
              videoSlides.push({ idx: i+1, title: slide.title, subtitle: slide.subtitle, body: slide.bodyAfterImage || '' });
            }
          } catch (e) {
            console.warn(`Falha ao empacotar vídeo do slide ${i+1}:`, e.message);
          }
        }
        // PNG do preview sempre (mesmo se tem vídeo — útil de referência)
        const canvas = await renderSlideToCanvas(slide);
        const blob = await canvasToPngBlob(canvas);
        const suffix = slide?.videoId ? '-preview' : '';
        zip.file(`slide-${String(i+1).padStart(2,'0')}${suffix}.png`, blob);
      }
      // README explicando como usar quando há vídeos
      if (videoSlides.length > 0) {
        const readme = [
          '# Carrossel — Material de Exportação',
          '',
          `Este ZIP contém ${slides.length} card(s).`,
          `${videoSlides.length} card(s) têm VÍDEO em vez de foto estática.`,
          '',
          '## Cards com vídeo',
          '',
          ...videoSlides.map(v => [
            `### Slide ${String(v.idx).padStart(2, '0')}`,
            `- Vídeo bruto: slide-${String(v.idx).padStart(2, '0')}-video.*`,
            `- Preview com texto: slide-${String(v.idx).padStart(2, '0')}-preview.png`,
            `- Título: ${v.title || '(vazio)'}`,
            v.subtitle ? `- Subtítulo: ${v.subtitle}` : null,
            v.body ? `- Corpo: ${v.body}` : null,
            '',
          ].filter(Boolean).join('\n')),
          '',
          '## Como combinar texto + vídeo',
          '',
          '1. Abre o vídeo no CapCut, InShot, Premiere ou similar',
          '2. Adiciona uma camada de texto por cima usando o título/subtítulo acima',
          '3. Exporta como MP4 com proporção 4:5 (1080×1350) pra feed do Instagram',
          '4. Pra carrossel misto (foto + vídeo), suba todos juntos no Instagram',
          '',
          '(Cards SEM vídeo já vêm prontos como PNG — basta postar.)',
        ].join('\n');
        zip.file('LEIA-ME.md', readme);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadBlob(zipBlob, `carrossel-${stamp}.zip`);
      const videoNote = videoSlides.length > 0 ? ` (${videoSlides.length} c/ vídeo — veja LEIA-ME.md)` : '';
      toast(`ZIP com ${slides.length} cards pronto${videoNote}`, 'success');
      trackEvent('export_zip', { card_count: String(slides.length), videos: String(videoSlides.length) });
    } catch(e) { setError('Erro ao exportar: '+e.message); }
    finally { setExporting(false); }
  };

  // Baixa as imagens RAW (sem texto/overlay) — útil pra guardar geração IA paga.
  // Filtra slides com bgImage; nomeia ia-NN.png pra geradas, foto-NN.png pra importadas.
  const exportPhotosOnly = async () => {
    const withPhotos = slides
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !!s.bgImage);
    if (withPhotos.length === 0) {
      toast('Nenhum card tem foto pra baixar.', 'info');
      return;
    }
    setExporting(true);
    setExportProgress({ current: 0, total: withPhotos.length });
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      let aiCount = 0;
      for (let k = 0; k < withPhotos.length; k++) {
        setExportProgress({ current: k + 1, total: withPhotos.length });
        const { s, i } = withPhotos[k];
        try {
          const blob = await blobFromSlideRef(s.bgImage);
          const ext = blob.type.includes('png') ? 'png'
            : blob.type.includes('jpeg') ? 'jpg'
            : blob.type.includes('webp') ? 'webp'
            : 'png';
          const tag = s.bgImageSource === 'ai' ? 'ia' : 'foto';
          if (s.bgImageSource === 'ai') aiCount++;
          zip.file(`${tag}-${String(i + 1).padStart(2, '0')}.${ext}`, blob);
        } catch (e) {
          console.warn(`Falha ao empacotar foto do slide ${i + 1}:`, e.message);
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadBlob(zipBlob, `carrossel-fotos-${stamp}.zip`);
      toast(
        aiCount > 0
          ? `${withPhotos.length} fotos baixadas (${aiCount} geradas por IA — guarde pra reuso!)`
          : `${withPhotos.length} fotos baixadas no ZIP`,
        'success',
        5000,
      );
    } catch (e) {
      setError('Erro ao baixar fotos: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  // Exporta todos os slides em UM único PDF (1 slide por página, dimensões reais)
  const exportPDF = async () => {
    setExporting(true);
    setExportProgress({current:0,total:slides.length});
    try {
      const [, JsPDF] = await Promise.all([loadHtml2Canvas(), loadJsPdf()]);
      await waitForRender();
      const f = FORMATS[fmt] || FORMATS.carrossel;
      const pdf = new JsPDF({ unit:'px', format:[f.w, f.h], orientation: f.h > f.w ? 'portrait' : 'landscape', compress:true });
      for (let i=0; i<slides.length; i++) {
        setExportProgress({current:i+1,total:slides.length});
        const canvas = await renderSlideToCanvas(slides[i]);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        if (i > 0) pdf.addPage([f.w, f.h], f.h > f.w ? 'portrait' : 'landscape');
        pdf.addImage(dataUrl, 'JPEG', 0, 0, f.w, f.h);
      }
      pdf.save(`carrossel-${Date.now()}.pdf`);
      toast(`PDF com ${slides.length} slides gerado`, 'success');
    } catch(e) { setError('Erro ao gerar PDF: '+e.message); }
    finally { setExporting(false); }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void vcImageFileToStorageDataUrl(file).then((url) => {
      if (typeof url !== 'string' || url.length < 32) {
        toast('Não foi possível processar a imagem.', 'error', 4500);
        return;
      }
      updateSlide({ bgImage: url, bgImageSource: 'imported' });
    });
    e.target.value = '';
  };

  // B1: Remix com tom alternativo — re-roda handleGenerate com os mesmos args mas
  // adicionando um hint de tom. Usuário pode comparar com Cmd+Z (undo) depois.
  const remixWithTone = useCallback(async (toneHint, hintLabel) => {
    const prev = lastGenerateArgsRef.current;
    if (!prev) {
      toast('Gere um carrossel primeiro — depois use o remix para variar o tom.', 'info');
      return;
    }
    toast(`Refazendo com tom «${hintLabel}»… o atual fica em Cmd+Z.`, 'info', 4000);
    const blendedTone = (prev.tone || '').trim()
      ? `${prev.tone} — variação solicitada: ${toneHint}`
      : `Variação solicitada: ${toneHint}`;
    await handleGenerate({ ...prev, tone: blendedTone });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  // Refina TODOS os slides com uma instrução geral (passa contexto para coerência)
  const refineAll = useCallback(async (instruction) => {
    if (!slides.length) return;
    setRefining(true);
    try {
      const ctx = slides.map((s, i) =>
        `${i + 1}. Título: "${s.title}" | Subtítulo: "${s.subtitle}"${
          isTendenciaCulturaPreset(creativePreset) ? ` | bodyAfterImage: ${JSON.stringify(s.bodyAfterImage ?? '')}` : ''
        }`,
      ).join('\n');
      const brandBlock = buildBrandBlock(brand);
      const { materialBlock, materialPriorityBlock } = await resolveMaterialPromptParts(material, toast);
      const voiceBulk = buildRefineVoiceRules(creativePreset, mode);
      const layoutBulk = buildGenerationSlideLayoutRules(mode, creativePreset, slideTextDensity);
      const r = await callAI(
        `Atue como editor de carrossel para Instagram. Reescreva TODOS os slides do carrossel abaixo aplicando a instrução do usuário, mantendo coerência narrativa entre eles.

${buildNarrativeModeReminder(mode)}

Carrossel atual:
${ctx}
${brandBlock}${materialBlock}${materialPriorityBlock}
Instrução: ${instruction}

REGRAS DE VOZ:
${voiceBulk}
${buildTendenciaCulturaRefineSlideHint(creativePreset, slideTextDensity)}
- PROIBIDO "Slide N" / "Card N" como título ou abertura de texto — só conteúdo editorial.
- Mantenha exatamente ${slides.length} slides na mesma ordem (slide 1 = abertura do arco do modo; último = fecho/CTA conforme o modo).
- Respeite a identidade verbal e o material acima.

${layoutBulk}

Retorne APENAS JSON: ${isTendenciaCulturaPreset(creativePreset)
          ? '{"slides":[{"title":"...","subtitle":"...","bodyAfterImage":"..."}]}'
          : '{"slides":[{"title":"...","subtitle":"..."}]}'}`,
        { json:true, openaiKey }
      );
      if (!r?.slides?.length) throw new Error('IA não retornou slides');
      setSlides(prev => prev.map((s, i) => {
        const total = prev.length;
        const isCultureSandwich =
          isTendenciaCulturaPreset(creativePreset) && i !== 0 && i !== total - 1;
        const isHybridSandwich =
          isPersoHybridDensity(creativePreset, slideTextDensity) && i >= 2;
        const allowBodyAfter = isCultureSandwich || isHybridSandwich;
        return {
          ...s,
          title: stripLeadingSlideCardLabel(String(r.slides[i]?.title ?? s.title ?? '').trim()),
          subtitle: stripLeadingSlideCardLabel(String(r.slides[i]?.subtitle ?? s.subtitle ?? '').trim()),
          ...(allowBodyAfter && typeof r.slides[i]?.bodyAfterImage === 'string'
            ? { bodyAfterImage: stripLeadingSlideCardLabel(String(r.slides[i].bodyAfterImage).trim()) }
            : {}),
        };
      }));
      toast('Todos os slides refinados', 'success');
    } catch(e) { setError(e.message); }
    finally { setRefining(false); }
  }, [slides, setSlides, setError, toast, openaiKey, brand, material, creativePreset, mode, slideTextDensity]);

  // Aplica um template pronto (preenche slides + brand + composições)
  const applyTemplate = useCallback((tpl) => {
    const palette = PALETTES[tpl.palette] || PALETTES[0];
    const pairing = FONT_PAIRINGS.find((p) => p.id === tpl.pairingId);
    const titleFont = pairing
      ? { val: pairing.titleFont }
      : (TITLE_FONTS[tpl.titleFont] || TITLE_FONTS[0]);
    const bodyFont = pairing
      ? { val: pairing.bodyFont }
      : (BODY_FONTS[tpl.bodyFont] || BODY_FONTS[0]);
    const zonesByKey = {
      cover: DEFAULT_CANVAS_ZONES_COVER_FULLBLEED,
      classic: DEFAULT_CANVAS_ZONES_CLASSIC,
      sandwich: DEFAULT_CANVAS_ZONES_SANDWICH,
      stat: DEFAULT_CANVAS_ZONES_STAT,
    };
    let newSlides = [];
    history.set((d) => {
      const nextBrand = {
        ...d.brand,
        bg: palette.bg,
        titleColor: palette.title,
        subtitleColor: palette.subtitle,
        textColor: palette.text,
        accent: palette.accent,
        titleFont: titleFont.val,
        bodyFont: bodyFont.val,
        textTitleWeight: clampTitleWeight(
          titleFont.val,
          pairing?.textTitleWeight ?? d.brand?.textTitleWeight ?? 700,
        ),
        showSwipeCue: true,
      };
      const hb = hydrateBrandTextColors(nextBrand);
      const n = tpl.slides.length;
      newSlides = tpl.slides.map((s, i) => {
        const composition = s.composition || inferCompositionId({
          index: i,
          total: n,
          hasPhoto: !!s.q,
          hasBodyAfter: !!s.body,
          isStat: s.composition === 'stat_proof' || (!s.q && /%|×|x\b|\d/.test(String(s.title || ''))),
        });
        const base = {
          ...mkSlide(i + 1, hb),
          title: s.title,
          subtitle: s.subtitle,
          bodyAfterImage: s.body || '',
          imageQuery: s.q || '',
          imgMode: 'dalle',
          bgImage: null,
          layout: i === 0 ? 'mc' : 'bl',
          align: i === 0 ? 'center' : 'left',
        };
        return applyCompositionToSlide(base, composition, zonesByKey);
      });
      return {
        ...d,
        slides: newSlides,
        brand: hb,
        creativePreset: tpl.creativePreset || d.creativePreset || 'livre',
      };
    });
    setActiveIdx(0);
    toast(`Template "${tpl.name}" aplicado`, 'success');
    trackEvent('template_applied', { template: tpl.id || tpl.name, slides: tpl.slides.length });
    // Guard contra race-condition (mesmo padrão do handleGenerate)
    if (imgGenAbortRef.current) imgGenAbortRef.current.cancelled = true;
    const abort = { cancelled: false };
    imgGenAbortRef.current = abort;
    (async () => {
      if (!hasOpenAI || !String(openaiKey || '').trim()) return;
      let failCount = 0;
      for (let i = 0; i < tpl.slides.length; i++) {
        if (abort.cancelled) break;
        const q = tpl.slides[i]?.q;
        if (!q) continue;
        try {
          const url = await generateDALLEWithRetry(q, openaiKey, imgParams, {
            refImage: newSlides[i]?.refImage,
            imgExtraPrompt: newSlides[i]?.imgExtraPrompt,
          });
          if (!abort.cancelled)
            setSlides(prev => prev.map((sl, j) => j === i ? { ...sl, bgImage: url, bgImageFailed: false, bgImageSource: 'ai' } : sl));
        } catch (e) {
          failCount++;
          console.warn(`Template imagem slide ${i + 1}:`, e.message);
          if (!abort.cancelled)
            setSlides(prev => prev.map((sl, j) => j === i ? { ...sl, bgImageFailed: true } : sl));
        }
      }
      if (!abort.cancelled && failCount > 0)
        toast(`${failCount} imagem(ns) do template não carregou.`, 'warning', 5000);
    })();
  }, [history, toast, setSlides, hasOpenAI, openaiKey, imgParams]);

  // Reordena slides (drag-and-drop)
  const reorderSlides = useCallback((from, to) => {
    if (from === to || from < 0 || to < 0 || from >= slides.length || to >= slides.length) return;
    setSlides(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((s, i) => ({ ...s, num: i+1 }));
    });
    setActiveIdx(to);
  }, [slides.length, setSlides]);

  // Atalhos de teclado globais
  useEffect(() => {
    const isEditable = (el) => {
      if (!el) return false;
      const tag = (el.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || el.isContentEditable;
    };
    const onKey = (e) => {
      // Permite undo/redo mesmo com modais abertos? Não — bloqueamos se houver modal.
      const anyModalOpen = setupOpen || researchOpen || keysOpen || templatesOpen || hookVarsOpen || helpOpen || imgPrompt.open || fullscreenOpen || tourOpen || libraryOpen || brandsOpen || imageCropOpen || photoPositionOpen;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key;

      if (shellView === 'home') {
        if (mod && k === '/') {
          e.preventDefault();
          setHelpOpen(o => !o);
          return;
        }
        if (!mod && !isEditable(e.target) && !anyModalOpen && k === '?') {
          e.preventDefault();
          setHelpOpen(o => !o);
          return;
        }
        return;
      }

      // Atalhos com modificador (funcionam mesmo em campos de texto, exceto undo dentro do campo)
      if (mod && !e.shiftKey && (k === 'z' || k === 'Z')) {
        if (isEditable(e.target)) return; // deixa o input fazer undo nativo
        e.preventDefault(); history.undo(); return;
      }
      if (mod && ((e.shiftKey && (k === 'z' || k === 'Z')) || k === 'y' || k === 'Y')) {
        if (isEditable(e.target)) return;
        e.preventDefault(); history.redo(); return;
      }
      if (mod && (k === 'd' || k === 'D')) {
        if (isEditable(e.target)) return;
        e.preventDefault(); duplicateSlide(activeIdx); return;
      }
      if (mod && (k === 'e' || k === 'E')) {
        if (isEditable(e.target)) return;
        e.preventDefault(); exportSlide(activeIdx); return;
      }
      if (mod && (k === 's' || k === 'S')) {
        if (isEditable(e.target)) return;
        e.preventDefault(); exportAll(); return;
      }
      if (mod && (k === '/' )) {
        e.preventDefault(); setHelpOpen(o=>!o); return;
      }

      // Atalhos sem modificador — só fora de campos de texto e sem modal aberto
      if (isEditable(e.target) || anyModalOpen) return;
      if (k === 'ArrowLeft')  { e.preventDefault(); setActiveIdx(i => Math.max(0, i-1)); return; }
      if (k === 'ArrowRight') { e.preventDefault(); setActiveIdx(i => Math.min(slides.length-1, i+1)); return; }
      if (k === 'Delete' || k === 'Backspace') { if (slides.length > 1) { e.preventDefault(); deleteSlide(activeIdx); } return; }
      if (k === 'n' || k === 'N') { e.preventDefault(); addSlide(); return; }
      if (k === 'f' || k === 'F') { e.preventDefault(); setFullscreenOpen(o=>!o); return; }
      if (k === '?') { e.preventDefault(); setHelpOpen(o=>!o); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIdx, slides.length, history, setupOpen, researchOpen, keysOpen, templatesOpen, hookVarsOpen, helpOpen, imgPrompt.open, fullscreenOpen, tourOpen, libraryOpen, brandsOpen, imageCropOpen, shellView]); // eslint-disable-line

  const sidebarProps = {
    slide, slides, activeIdx, brand, setBrand, updateSlide,
    addSlide, deleteSlide, duplicateSlide, moveSlide, refineSlide, refining,
    generateCaption, genCaption, caption, setCaption, setSetupOpen, setResearchOpen, fileInputRef,
    exportSlide, exportAll, exportPDF, exporting, exportProgress, tab, setTab,
    openaiKey, hasOpenAI, setKeysOpen,
    setTemplatesOpen, setHookVarsOpen, refineAll, askPrompt, toast,
    material, setMaterial,
    imgParams, setImgParams,
    setBrandsOpen, brandRoster, activeBrandId,
    setLibraryOpen, libraryCount: library.length,
    onPickVideo: () => videoFileInputRef.current?.click(),
    onRemoveVideo: removeVideoFromActiveSlide,
    openRefImagePicker,
    slideImgGenBusy,
    generateSlideImageAt,
    creativePreset,
    fmt,
    applyTypographyToAllCards,
    applyBrandTypographyToAllSlides,
    canvasEditMode, setCanvasEditMode,
    showPreviewAlignGrid, setShowPreviewAlignGrid,
    anyCanvasEnabled: slides.some((s) => s.canvas?.enabled),
    patchCanvasZonesAt,
    openPhotoZoneImport,
    handleBatchPhotos,
    batchPhotoInputRef,
    enableCanvasLayout,
    disableCanvasLayout,
    onOpenImageCrop: () => setImageCropOpen(true),
    onOpenPhotoPosition: () => setPhotoPositionOpen(true),
    remixWithTone,
    hasLastGenerate,
    exportPhotosOnly,
    visualPreset,
    applyVisualPreset: applyVisualStylePreset,
    appMode,
    setActiveIdx,
    activeEntry,
  };

  const desktopThumbWidth = f.w * previewScale;

  if (landingOpen) {
    return (
      <div
        className="vc-landing-shell"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          background: 'var(--bg-primary, #0e0c14)',
        }}
      >
        <style>{GLOBAL_STYLE}</style>
        <OnboardingLanding
          onEnter={completeLanding}
          onLogin={() => { setLoginHint(''); setLoginOpen(true); }}
          isMobile={isMobile}
        />
        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          initialEmail={paywallEmail}
          hint={loginHint}
          onAlreadyActive={async () => {
            await refreshAccess();
            setLoginOpen(false);
            enterStudio();
          }}
        />
      </div>
    );
  }

  if (access.status === 'loading') {
    return (
      <div style={{
        width: '100%', height: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary, #0e0c14)', color: 'var(--text-muted, #8a8696)',
        fontFamily: 'var(--font-ui)', fontSize: 14,
      }}>
        <style>{GLOBAL_STYLE}</style>
        A verificar assinatura…
      </div>
    );
  }

  if (paywallOpen || !accessActive) {
    return (
      <div
        className="vc-landing-shell"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          background: 'var(--bg-primary, #0e0c14)',
        }}
      >
        <style>{GLOBAL_STYLE}</style>
        <Paywall
          isMobile={isMobile}
          initialEmail={paywallEmail}
          loginHint={loginHint}
          onBack={reopenLanding}
          onAlreadyActive={async () => {
            await refreshAccess();
            enterStudio();
          }}
        />
        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          initialEmail={paywallEmail}
          hint={loginHint}
          onAlreadyActive={async () => {
            await refreshAccess();
            setLoginOpen(false);
            enterStudio();
          }}
        />
      </div>
    );
  }

  return (
    <div style={{
      width:'100%', height:'100vh', background:'var(--bg-base)', color:'var(--text-primary)',
      display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:'var(--font-ui)',
    }}>

      {shellView === 'home' ? (
        <AccountHomeShell
          library={library}
          activeDocId={activeDocId}
          activeEntryName={activeEntry?.name}
          brandCount={brandRoster.length}
          aiSettings={aiSettings}
          hasTextAI={hasAnyAI}
          hasImageAI={hasOpenAI}
          isMobile={isMobile}
          onGenerate={() => setSetupOpen(true)}
          onOpenLibrary={() => setLibraryOpen(true)}
          onOpenTemplates={() => setTemplatesOpen(true)}
          onOpenResearch={() => setResearchOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
          onOpenSettings={() => setKeysOpen(true)}
          onContinueEditor={() => setShellView('project')}
          onManageBilling={access.billingDisabled ? undefined : openPortal}
          onLogout={access.billingDisabled ? undefined : handleLogout}
          onOpenBrands={() => setBrandsOpen(true)}
          accessEmail={access.email}
          currentPeriodEnd={access.currentPeriodEnd}
          accountTab={accountTab}
          setAccountTab={setAccountTab}
          openDoc={openDoc}
          newDoc={newDoc}
          renameDoc={renameDoc}
          duplicateDoc={duplicateDoc}
          deleteDoc={deleteDoc}
          setDocStatus={setDocStatus}
          exportDoc={exportDoc}
          askPrompt={askPrompt}
        />
      ) : (
      <>
      {/* ── HEADER ── No mobile, esconde quando drawer aberto (mais espaço
          pros cards). Reaparece quando user fecha o drawer (pull down). */}
      <header style={{
        borderBottom:'1px solid var(--border)', background:'var(--bg-sidebar)',
        flexShrink:0,
        overflow: 'hidden',
        /* Mobile collapse: slide up + colapsa altura quando drawerOpen */
        ...(isMobile && drawerOpen ? {
          maxHeight: 0,
          opacity: 0,
          paddingTop: 0,
          paddingBottom: 0,
          borderBottom: 'none',
          pointerEvents: 'none',
          transform: 'translateY(-12px)',
        } : {}),
        transition: 'max-height 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s cubic-bezier(0.22, 1, 0.36, 1), padding 0.32s, transform 0.32s, border-color 0.22s',
        ...(isMobile ? {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 10,
          padding: `calc(10px + env(safe-area-inset-top, 0)) max(12px, env(safe-area-inset-left, 0px)) 12px max(12px, env(safe-area-inset-right, 0px))`,
          /* maxHeight grande pra não cortar quando aberto; collapse pra 0 quando drawer abre */
          maxHeight: drawerOpen ? 0 : 240,
        } : {
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
          alignItems: 'center',
          padding: 'env(safe-area-inset-top, 0) 14px 0',
          height: `calc(56px + env(safe-area-inset-top, 0))`,
          gap: 12,
        }),
      }}>
        {isMobile ? (
          <>
            <div style={{
              display:'flex',
              alignItems:'center',
              justifyContent:'space-between',
              width:'100%',
              gap:8,
              minHeight: 44,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1 }}>
                <button
                  type="button"
                  onClick={() => goAccount('projects')}
                  title="Projetos"
                  aria-label="Projetos"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 9999,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Home size={15} />
                </button>
                <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1 }}>
                  <div style={{
                    width:32, height:32, borderRadius:8, background:'var(--logo-mark-bg)',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                  }}>
                    <Flame size={14} color="var(--logo-mark-fg)"/>
                  </div>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{
                      fontSize:14, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.022em',
                      lineHeight:1.1, fontFamily:'var(--font-display)',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    }}>
                      Viral<span style={{ color:'var(--accent)' }}>.</span>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                {editorHeaderActions}
                <button
                  type="button"
                  onClick={() => goAccount('profile')}
                  title="Perfil"
                  aria-label="Perfil"
                  style={{
                    width: 40, height: 40, borderRadius: 9999,
                    border: '1px solid var(--border)', background: 'var(--bg-card)',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <User size={15} />
                </button>
              </div>
            </div>
            <EditorFormatSelector fmt={fmt} setFmt={setFmt} layout="mobile" />
          </>
        ) : (
          <>
        {/* Esquerda — marca + Projetos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: 'var(--logo-mark-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Flame size={14} color="var(--logo-mark-fg)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 15, fontWeight: 600, color: 'var(--text-primary)',
              letterSpacing: '-0.022em', lineHeight: 1, fontFamily: 'var(--font-display)',
            }}>
              Viral<span style={{ color: 'var(--accent)' }}>.</span>
            </div>
            {activeEntry && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={async () => {
                    const current = activeEntry.name || 'Carrossel';
                    const next = await askPrompt({
                      title: 'Renomear projeto',
                      label: 'Nome',
                      defaultValue: current,
                      placeholder: 'Ex: Meu carrossel viral',
                      cta: 'Renomear',
                    });
                    if (next && next.trim() && next !== current) renameDoc(activeEntry.id, next.trim());
                  }}
                  style={{
                    fontSize: 11, color: 'var(--text-muted)', letterSpacing: '-0.011em',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    textAlign: 'left',
                  }}
                  title="Clique para renomear"
                >
                  {activeEntry.name || 'Sem título'}
                </button>
                <SavedIndicator savedAt={lastSavedAt} />
              </div>
            )}
          </div>
          {editorPillBtn(() => goAccount('projects'), 'Projetos', Home)}
        </div>

        {/* Centro — Gerar com IA */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {editorGenerateBtn}
        </div>

        {/* Direita — ferramentas + Perfil (extremo direito) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', background: 'var(--bg-card)',
            borderRadius: 9999, padding: 3, gap: 0, border: '1px solid var(--border)', flexShrink: 0,
          }}>
            <button
              type="button"
              onClick={history.undo}
              disabled={!history.canUndo}
              title="Desfazer (⌘Z)"
              aria-label="Desfazer"
              style={{
                width: 28, height: 26, borderRadius: 9999, border: 'none', background: 'transparent',
                color: 'var(--text-muted)', cursor: history.canUndo ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: history.canUndo ? 1 : 0.35,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7L3 9"/></svg>
            </button>
            <button
              type="button"
              onClick={history.redo}
              disabled={!history.canRedo}
              title="Refazer (⌘⇧Z)"
              aria-label="Refazer"
              style={{
                width: 28, height: 26, borderRadius: 9999, border: 'none', background: 'transparent',
                color: 'var(--text-muted)', cursor: history.canRedo ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: history.canRedo ? 1 : 0.35,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M21 13a9 9 0 1 1-3-7l3 3"/></svg>
            </button>
          </div>
          <EditorFormatSelector fmt={fmt} setFmt={setFmt} layout="desktop" />
          {editorHeaderActions}
          {editorAccountNav}
        </div>
          </>
        )}
      </header>

      {/* ── BODY ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Desktop sidebar — glass dark panel premium (Narrative OS) */}
        {!isMobile && (
          <aside style={{
            width:272,
            borderRight:'1px solid var(--glass-border)',
            background:'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%), var(--bg-secondary)',
            backdropFilter:'blur(32px) saturate(180%)',
            WebkitBackdropFilter:'blur(32px) saturate(180%)',
            boxShadow:'inset -1px 0 0 rgba(255,255,255,0.04)',
            display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0,
          }}>
            <SidebarContent {...sidebarProps}/>
          </aside>
        )}

        {/* Mobile drawer com backdrop + swipe-to-dismiss
            (puxa o handle pra baixo > 80px ou velocidade > 0.4 → fecha) */}
        {isMobile && (
          <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <SidebarContent {...sidebarProps}/>
          </MobileDrawer>
        )}

        {/* ── EXPORT REFS (offscreen, scale=1) ──
            Mantemos UMA árvore oculta com cada slide em escala real (1080×1350).
            html2canvas captura SEMPRE estes elementos — nunca os preview escalados,
            que distorcem o resultado por causa do `transform: scale()` aplicado. */}
        <div style={{ position:'fixed', left:'-99999px', top:0, pointerEvents:'none', opacity:0, zIndex:-1 }} aria-hidden>
          {slides.map((s,i)=>(
            <SlideCard
              key={`exp-${s.id}`}
              ref={el=>slideRefs.current[s.id]=el}
              slide={s} fmt={fmt} brand={brand} num={i+1} total={slides.length} scale={1}
              creativePreset={creativePreset}
              showCanvasChrome={false}
            />
          ))}
        </div>

        {/* ── CANVAS ── */}
        <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg-base)' }}>

          {/* ── THUMBNAIL STRIP ── Mobile: colapsa junto com header quando
              drawer aberto. Desktop: sempre visível. */}
          <div
            data-vc-tour="thumbnails"
            style={{
            background:'var(--bg-sidebar)', borderBottom:'1px solid var(--border)',
            padding: isMobile ? '8px 10px' : '10px 14px',
            flexShrink:0,
            overflow: 'hidden',
            ...(isMobile && drawerOpen ? {
              maxHeight: 0,
              opacity: 0,
              paddingTop: 0,
              paddingBottom: 0,
              borderBottom: 'none',
              pointerEvents: 'none',
              transform: 'translateY(-8px)',
            } : isMobile ? {
              maxHeight: 200,
            } : {}),
            transition: 'max-height 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s, padding 0.32s, transform 0.32s, border-color 0.22s',
          }}
          >
            <div style={{ display:'flex', alignItems:'center', gap:6, overflowX:'auto', paddingBottom:2 }}>
              {slides.map((s, i) => {
                const stripThumbFil = slideStoredPresentationCssFilter(s);
                return (
                <button
                  key={s.id}
                  onClick={()=>setActiveIdx(i)}
                  draggable
                  onDragStart={e=>{
                    e.dataTransfer.setData('text/plain', String(i));
                    e.dataTransfer.effectAllowed = 'move';
                    e.currentTarget.style.opacity = '0.5';
                  }}
                  onDragEnd={e=>{ e.currentTarget.style.opacity = ''; }}
                  onDragOver={e=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; }}
                  onDrop={e=>{
                    e.preventDefault();
                    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                    if (Number.isFinite(from)) reorderSlides(from, i);
                  }}
                  className={`slide-thumb ${i===activeIdx?'active':''}`}
                  style={{ background:'none', border:'none', padding:0, cursor:'grab' }}
                  title="Clique para selecionar · arraste para reordenar"
                  aria-label={`Slide ${i+1} de ${slides.length}`}
                >
                  <div style={{
                    width:44, height:56, borderRadius:4, overflow:'hidden', position:'relative',
                    background: resolveSlideBrandBg(brand, i, s),
                    backgroundImage: s.bgImage?`url(${s.bgImage})`:'none',
                    backgroundSize:'cover', backgroundPosition:'center',
                    ...(stripThumbFil ? { filter: stripThumbFil } : {}),
                  }}>
                    {s.bgImage && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.35)' }}/>}
                    <span style={{
                      position:'absolute', bottom:3, left:4,
                      fontSize:7, fontWeight:700, color:'rgba(255,255,255,0.7)',
                      fontFamily:'var(--font-mono)', letterSpacing:'0.04em',
                    }}>{String(i+1).padStart(2,'0')}</span>
                  </div>
                </button>
                );
              })}
              <button onClick={addSlide} style={{
                flexShrink:0, width:44, height:56, borderRadius:4,
                border:'1px dashed var(--border)', background:'transparent',
                color:'var(--text-muted)', cursor:'pointer', display:'flex',
                alignItems:'center', justifyContent:'center',
                transition:'all 0.15s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)';}}
              ><Plus size={14}/></button>
            </div>
          </div>

          {/* ── MAIN CANVAS AREA ── */}
          <div style={{ flex:1, overflow:'auto' }}>
            {empty ? (
              // Empty state
              <div className="empty-grid" style={{
                minHeight:'100%',
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                padding: isMobile ? '20px 16px 28px' : 24,
                boxSizing: 'border-box',
              }}>
                <div style={{
                  textAlign:'center',
                  maxWidth: isMobile ? 'min(100%, 360px)' : 340,
                  width: '100%',
                  animation:'fadeUp 0.3s var(--ease-smooth)',
                }}>
                  <div style={{
                    width: isMobile ? 64 : 72,
                    height: isMobile ? 64 : 72,
                    borderRadius:18,
                    background:'var(--accent)',
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    margin:'0 auto 24px',
                  }}>
                    <Sparkles size={isMobile ? 28 : 32} color="#fff"/>
                  </div>
                  <div style={{
                    fontSize: isMobile ? 28 : 40,
                    fontWeight:600,
                    fontFamily:'var(--font-display)',
                    color:'var(--text-primary)',
                    letterSpacing:'-0.022em',
                    marginBottom:12,
                    lineHeight:1.07,
                  }}>
                    Crie seu carrossel<br/>
                    <span style={{ color:'var(--accent)' }}>viral.</span>
                  </div>
                  <p style={{
                    fontSize:17,
                    color:'var(--text-secondary)',
                    marginBottom: isMobile ? 24 : 32,
                    lineHeight:1.47,
                    letterSpacing:'-0.011em',
                    fontWeight:400,
                  }}>
                    {isMobile
                      ? 'Informe o tema e a IA gera gancho, slides e legenda prontos para postar.'
                      : <>Informe o tema e a IA gera gancho,<br/>slides e legenda prontos para postar.</>}
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <button onClick={()=>setSetupOpen(true)} aria-label="Gerar carrossel com IA" style={{
                      minHeight:48,
                      borderRadius:9999,
                      border:'none',
                      cursor:'pointer',
                      background:'var(--accent)',
                      color:'#fff',
                      fontSize:15,
                      fontWeight:400,
                      fontFamily:'var(--font-ui)',
                      letterSpacing:'-0.016em',
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center',
                      gap:10,
                      padding: '0 20px',
                      transition:'background-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
                    }}>
                      <Sparkles size={16}/>Gerar carrossel com IA
                    </button>
                    <div style={{
                      display:'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                      gap:8,
                    }}>
                      <button onClick={()=>setTemplatesOpen(true)} aria-label="Abrir templates" style={{
                        minHeight: isMobile ? 44 : 42,
                        borderRadius:10,
                        cursor:'pointer',
                        background:'var(--bg-elevated)',
                        border:'1px solid var(--border)',
                        color:'var(--text-secondary)',
                        fontSize:13,
                        fontWeight:600,
                        fontFamily:'var(--font-ui)',
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        gap:6,
                        transition:'all 0.12s',
                      }}
                      onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
                      onMouseLeave={e=>{e.currentTarget.style.color='var(--text-secondary)';e.currentTarget.style.borderColor='var(--border)';}}
                      >
                        <Layout size={12}/>Templates
                      </button>
                      <button onClick={()=>setResearchOpen(true)} aria-label="Pesquisar nicho" style={{
                        minHeight: isMobile ? 44 : 42,
                        borderRadius:10,
                        cursor:'pointer',
                        background:'var(--bg-elevated)',
                        border:'1px solid var(--border)',
                        color:'var(--text-secondary)',
                        fontSize:13,
                        fontWeight:600,
                        fontFamily:'var(--font-ui)',
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        gap:6,
                        transition:'all 0.12s',
                      }}
                      onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
                      onMouseLeave={e=>{e.currentTarget.style.color='var(--text-secondary)';e.currentTarget.style.borderColor='var(--border)';}}
                      >
                        <Search size={12}/>Pesquisar
                      </button>
                    </div>
                    <div style={{
                      marginTop:6, fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)',
                      display:'flex', justifyContent:'center', alignItems:'center', gap:6, letterSpacing:'0.04em',
                    }}>
                      <span className="kbd">?</span> para ver atalhos
                    </div>
                  </div>
                </div>
              </div>
            ) : isMobile ? (
              // Mobile: single slide with floating arrows + swipe — com modo canvas, reduzimos conflito com o swipe lateral
              <div
                style={{
                  display:'flex', flexDirection:'column', alignItems:'center',
                  padding:'16px 12px calc(80px + env(safe-area-inset-bottom, 0))',
                  minHeight:'100%', position:'relative',
                }}
                onTouchStart={e => {
                  if (canvasEditMode) return;
                  e.currentTarget.dataset.tx = String(e.touches[0].clientX);
                }}
                onTouchEnd={e => {
                  if (canvasEditMode) return;
                  const start = parseFloat(e.currentTarget.dataset.tx || '0');
                  const dx = e.changedTouches[0].clientX - start;
                  if (Math.abs(dx) > 50) {
                    if (dx < 0) setActiveIdx(Math.min(slides.length-1, activeIdx+1));
                    else setActiveIdx(Math.max(0, activeIdx-1));
                  }
                }}
              >
                <div
                  style={{
                    animation:'fadeUp 0.2s var(--ease-smooth)',
                    position:'relative',
                    ...(canvasEditMode ? { touchAction: 'none' } : {}),
                  }}
                >
                  <SlideCard
                    slide={slide}
                    fmt={fmt}
                    brand={brand}
                    num={activeIdx+1}
                    total={slides.length}
                    scale={previewScale}
                    creativePreset={creativePreset}
                    slideIndex={activeIdx}
                    showCanvasChrome={canvasEditMode && !!(slide.canvas?.enabled && slide.canvas?.zones)}
                    onCanvasZonePatch={patchCanvasZonesAt}
                    onPhotoZoneRequest={openPhotoZoneImport}
                    onPhotoZoneNativeFile={handlePhotoZoneNativeFile}
                    enableZoneSwapDrag={canvasEditMode}
                  />
                  {showPreviewAlignGrid ? (
                    <div
                      aria-hidden
                      style={{
                        position:'absolute',
                        inset:0,
                        zIndex:6,
                        pointerEvents:'none',
                        borderRadius:10,
                        backgroundImage: 'linear-gradient(rgba(99,102,241,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.14) 1px, transparent 1px)',
                        backgroundSize: '10% 10%',
                      }}
                    />
                  ) : null}

                  {/* Onboarding hint — só aparece quando slide ainda tem texto-placeholder */}
                  {slide.title === 'Seu título aqui' && slides.length === 1 ? (
                    <div
                      aria-hidden
                      style={{
                        position:'absolute', inset:0, zIndex:10, pointerEvents:'none',
                        display:'flex', alignItems:'flex-start', justifyContent:'center',
                        padding: `${f.h * previewScale * 0.05}px`,
                      }}
                    >
                      <div style={{
                        background:'rgba(20,20,22,0.92)', color:'#fff',
                        padding:'10px 14px', borderRadius:10,
                        fontSize:11, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em',
                        lineHeight:1.5, maxWidth:'88%',
                        backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
                        boxShadow:'0 8px 24px rgba(0,0,0,0.32)',
                        animation:'fadeUp 0.4s var(--ease-smooth)',
                      }}>
                        <div style={{ fontWeight:600, marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
                          <Sparkles size={12} style={{ color:'var(--accent)' }}/>
                          Comece em 3 caminhos
                        </div>
                        <div style={{ opacity:0.85, fontSize:10, lineHeight:1.6 }}>
                          → Click <strong style={{ color:'#fff' }}>Gerar com IA</strong> no canto<br/>
                          → Escolha um <strong style={{ color:'#fff' }}>Template pronto</strong><br/>
                          → Ou edite o título e copy aqui mesmo
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Setas flutuantes */}
                  {activeIdx > 0 && (
                    <button
                      onClick={()=>setActiveIdx(activeIdx-1)}
                      aria-label="Slide anterior"
                      style={{
                        position:'absolute', left:-6, top:'50%', transform:'translateY(-50%)',
                        width:40, height:40, borderRadius:'50%',
                        background:'rgba(0,0,0,0.55)', border:'1px solid rgba(255,255,255,0.18)',
                        color:'#fff', cursor:'pointer', backdropFilter:'blur(6px)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        boxShadow:'0 4px 12px rgba(0,0,0,0.35)',
                      }}
                    ><ChevronLeft size={18}/></button>
                  )}
                  {activeIdx < slides.length-1 && (
                    <button
                      onClick={()=>setActiveIdx(activeIdx+1)}
                      aria-label="Próximo slide"
                      style={{
                        position:'absolute', right:-6, top:'50%', transform:'translateY(-50%)',
                        width:40, height:40, borderRadius:'50%',
                        background:'rgba(0,0,0,0.55)', border:'1px solid rgba(255,255,255,0.18)',
                        color:'#fff', cursor:'pointer', backdropFilter:'blur(6px)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        boxShadow:'0 4px 12px rgba(0,0,0,0.35)',
                      }}
                    ><ChevronRight size={18}/></button>
                  )}
                </div>

                {/* Ações rápidas do card atual — pill flutuante com tela cheia,
                    baixar, grade. Acima dos dots pra ficar visível mesmo quando
                    o drawer está aberto (área do card é metade superior). */}
                <div style={{ display:'flex', justifyContent:'center', marginTop:12 }}>
                  <div style={{
                    display:'inline-flex', alignItems:'center', gap:2,
                    padding:4, borderRadius:9999,
                    background:'var(--bg-card)', border:'1px solid var(--border)',
                    boxShadow:'0 2px 8px rgba(0,0,0,0.06)',
                  }}>
                    <button
                      type="button"
                      onClick={() => setFullscreenOpen(true)}
                      title="Visualizar em tela cheia"
                      aria-label={`Visualizar card ${activeIdx+1} em tela cheia`}
                      style={{
                        minWidth:36, minHeight:36, borderRadius:9999, cursor:'pointer',
                        background:'transparent', border:'none', color:'var(--text-secondary)',
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        transition:'background 0.12s, color 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background='var(--bg-pearl)'; e.currentTarget.style.color='var(--text-primary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-secondary)'; }}
                    >
                      <Maximize2 size={15}/>
                    </button>
                    <button
                      type="button"
                      onClick={() => exportSlide(activeIdx)}
                      disabled={exporting}
                      title={`Baixar card ${activeIdx+1} em PNG`}
                      aria-label={`Baixar card ${activeIdx+1}`}
                      style={{
                        minWidth:36, minHeight:36, borderRadius:9999, cursor: exporting ? 'not-allowed' : 'pointer',
                        background:'transparent', border:'none', color:'var(--text-secondary)',
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        transition:'background 0.12s, color 0.12s',
                        opacity: exporting ? 0.5 : 1,
                      }}
                      onMouseEnter={e => { if(!exporting){ e.currentTarget.style.background='var(--bg-pearl)'; e.currentTarget.style.color='var(--text-primary)'; } }}
                      onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-secondary)'; }}
                    >
                      {exporting ? <Loader2 size={15} style={{animation:'spin 0.8s linear infinite'}}/> : <Download size={15}/>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPreviewAlignGrid(g => !g)}
                      title={showPreviewAlignGrid ? 'Esconder grade de alinhamento' : 'Mostrar grade de alinhamento'}
                      aria-label={showPreviewAlignGrid ? 'Esconder grade' : 'Mostrar grade'}
                      aria-pressed={showPreviewAlignGrid}
                      style={{
                        minWidth:36, minHeight:36, borderRadius:9999, cursor:'pointer',
                        background: showPreviewAlignGrid ? 'var(--accent-surface)' : 'transparent',
                        border:'none', color: showPreviewAlignGrid ? 'var(--accent)' : 'var(--text-secondary)',
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        transition:'background 0.12s, color 0.12s',
                      }}
                      onMouseEnter={e => { if(!showPreviewAlignGrid){ e.currentTarget.style.background='var(--bg-pearl)'; e.currentTarget.style.color='var(--text-primary)'; } }}
                      onMouseLeave={e => { if(!showPreviewAlignGrid){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-secondary)'; } }}
                    >
                      <LayoutGrid size={15}/>
                    </button>
                    <button
                      type="button"
                      onClick={() => setThumbQaMode((v) => !v)}
                      title={thumbQaMode ? 'Sair do preview telemóvel (distância)' : 'QA: preview à distância do polegar'}
                      aria-label="Preview qualidade tipográfica"
                      aria-pressed={thumbQaMode}
                      style={{
                        minWidth:36, minHeight:36, borderRadius:9999, cursor:'pointer',
                        background: thumbQaMode ? 'var(--accent-surface)' : 'transparent',
                        border:'none', color: thumbQaMode ? 'var(--accent)' : 'var(--text-secondary)',
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        transition:'background 0.12s, color 0.12s',
                        fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
                      }}
                    >
                      Aa
                    </button>
                  </div>
                </div>

                {/* Dots + contador */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, marginTop:14 }}>
                  <div style={{ display:'flex', gap:5 }}>
                    {slides.map((_, i) => (
                      <button
                        key={i}
                        onClick={()=>setActiveIdx(i)}
                        aria-label={`Ir para slide ${i+1}`}
                        style={{
                          width: i===activeIdx ? 18 : 6, height:6, borderRadius:99,
                          background: i===activeIdx ? 'var(--accent)' : 'var(--border)',
                          border:'none', cursor:'pointer', padding:0,
                          transition:'width 0.18s var(--ease-smooth), background 0.18s',
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.06em' }}>
                    {String(activeIdx+1).padStart(2,'0')} / {String(slides.length).padStart(2,'0')} — arraste ou use setas
                  </span>
                </div>

                <PerSlideImageRefBlock
                  slide={slide}
                  width={Math.min(vw - 48, f.w * previewScale)}
                  onChangeExtra={(v) => updateSlide({ imgExtraPrompt: v })}
                  onRemoveRef={() => updateSlide({ refImage: null })}
                  onPickRef={() => openRefImagePicker(activeIdx)}
                  onGenerateImage={() => generateSlideImageAt(activeIdx)}
                  generateImageBusy={!!slideImgGenBusy[slide.id]}
                  generateImageDisabled={
                    !(slide.imageQuery || '').trim() ||
                    (normalizeSlideImgMode(slide.imgMode) === 'dalle' && !hasOpenAI)
                  }
                />
              </div>
            ) : (
              // Desktop: all slides row
              <div style={{ padding:'28px 24px', display:'flex', gap:20, alignItems:'flex-start', minHeight:'100%' }}>
                {slides.map((s,i)=>(
                  <div
                    key={s.id}
                    style={{ flexShrink:0, animation:`fadeUp 0.2s ${i*0.04}s both var(--ease-smooth)` }}
                    onDragOver={(e) => {
                      if (!canvasEditMode) return;
                      if (Array.from(e.dataTransfer.types || []).includes(VC_ZONE_DRAG_MIME)) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }
                    }}
                    onDrop={(e) => {
                      if (!canvasEditMode) return;
                      e.preventDefault();
                      const raw = e.dataTransfer.getData(VC_ZONE_DRAG_MIME);
                      if (raw) swapCanvasZoneContent(i, raw);
                    }}
                  >
                    <div
                      onClick={()=>setActiveIdx(i)}
                      style={{
                        position:'relative',
                        cursor:'pointer', borderRadius:10, overflow:'hidden',
                        transition:'all 0.15s var(--ease-smooth)',
                        boxShadow: i===activeIdx
                          ? '0 0 0 2px var(--accent-focus)'
                          : 'none',
                        opacity: i===activeIdx ? 1 : 0.65,
                      }}
                      onMouseEnter={e=>{ if(i!==activeIdx) e.currentTarget.style.opacity='0.9'; }}
                      onMouseLeave={e=>{ if(i!==activeIdx) e.currentTarget.style.opacity='0.65'; }}
                    >
                      <SlideCard
                        slide={s}
                        fmt={fmt}
                        brand={brand}
                        num={i+1}
                        total={slides.length}
                        scale={previewScale}
                        creativePreset={creativePreset}
                        slideIndex={i}
                        showCanvasChrome={
                          canvasEditMode && !!(s.canvas?.enabled && s.canvas?.zones) && i === activeIdx
                        }
                        onCanvasZonePatch={patchCanvasZonesAt}
                        onPhotoZoneRequest={openPhotoZoneImport}
                        onPhotoZoneNativeFile={handlePhotoZoneNativeFile}
                        enableZoneSwapDrag={canvasEditMode}
                      />
                      {showPreviewAlignGrid ? (
                        <div
                          aria-hidden
                          style={{
                            position:'absolute',
                            inset:0,
                            zIndex:40,
                            pointerEvents:'none',
                            borderRadius:10,
                            backgroundImage: 'linear-gradient(rgba(99,102,241,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.14) 1px, transparent 1px)',
                            backgroundSize: '10% 10%',
                          }}
                        />
                      ) : null}
                    </div>
                    <div style={{ marginTop:8, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 2px', gap:6 }}>
                      <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.06em', flexShrink:0 }}>
                        {String(i+1).padStart(2,'0')}
                      </span>
                      <div style={{ display:'flex', alignItems:'center', gap:2 }}>
                        <button
                          onClick={(e)=>{ e.stopPropagation(); setActiveIdx(i); setFullscreenOpen(true); }}
                          title="Visualizar em tela cheia"
                          aria-label={`Visualizar card ${i+1} em tela cheia`}
                          style={{
                            background:'none', border:'none', color:'var(--text-muted)',
                            cursor:'pointer', padding:6, borderRadius:6, transition:'color 0.12s, background 0.12s',
                            display:'inline-flex', alignItems:'center', justifyContent:'center',
                            minWidth:32, minHeight:32,
                          }}
                          onMouseEnter={e=>e.currentTarget.style.color='var(--text-primary)'}
                          onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}
                        ><Maximize2 size={11}/></button>
                        <button
                          onClick={(e)=>{ e.stopPropagation(); setShowPreviewAlignGrid(g => !g); }}
                          title={showPreviewAlignGrid ? 'Esconder grade de alinhamento' : 'Mostrar grade de alinhamento em todos os cards'}
                          aria-label={showPreviewAlignGrid ? 'Esconder grade' : 'Mostrar grade'}
                          aria-pressed={showPreviewAlignGrid}
                          style={{
                            background: showPreviewAlignGrid ? 'var(--success-surface)' : 'none',
                            border: showPreviewAlignGrid ? '1px solid var(--accent)' : '1px solid transparent',
                            color: showPreviewAlignGrid ? 'var(--accent)' : 'var(--text-muted)',
                            cursor:'pointer', padding:4, borderRadius:4, transition:'all 0.12s',
                            display:'inline-flex', alignItems:'center', justifyContent:'center',
                            minWidth:24, minHeight:24,
                          }}
                          onMouseEnter={e=>{ if(!showPreviewAlignGrid) e.currentTarget.style.color='var(--text-primary)'; }}
                          onMouseLeave={e=>{ if(!showPreviewAlignGrid) e.currentTarget.style.color='var(--text-muted)'; }}
                        ><LayoutGrid size={11}/></button>
                        {s.bgImage ? (
                          <button
                            onClick={(e)=>{ e.stopPropagation(); setActiveIdx(i); setPhotoPositionOpen(true); }}
                            title="Editar / reposicionar foto"
                            aria-label={`Editar foto do card ${i+1}`}
                            style={{
                              background:'none', border:'none', color:'var(--text-muted)',
                              cursor:'pointer', padding:4, borderRadius:4, transition:'color 0.12s',
                              display:'inline-flex', alignItems:'center', justifyContent:'center',
                              minWidth:24, minHeight:24,
                            }}
                            onMouseEnter={e=>e.currentTarget.style.color='var(--text-primary)'}
                            onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}
                          ><Crop size={11}/></button>
                        ) : null}
                        <button
                          onClick={(e)=>{ e.stopPropagation(); exportSlide(i); }}
                          disabled={exporting}
                          title="Baixar card em PNG"
                          aria-label={`Baixar card ${i+1}`}
                          style={{
                            background:'none', border:'none', color:'var(--text-muted)',
                            cursor:'pointer', padding:6, borderRadius:6, transition:'color 0.12s, background 0.12s',
                            display:'inline-flex', alignItems:'center', justifyContent:'center',
                            minWidth:32, minHeight:32,
                          }}
                          onMouseEnter={e=>e.currentTarget.style.color='var(--text-primary)'}
                          onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}
                        ><Download size={11}/></button>
                      </div>
                    </div>
                    <PerSlideImageRefBlock
                      slide={s}
                      width={desktopThumbWidth}
                      onChangeExtra={(v) => updateSlideAt(i, { imgExtraPrompt: v })}
                      onRemoveRef={() => updateSlideAt(i, { refImage: null })}
                      onPickRef={() => openRefImagePicker(i)}
                      onGenerateImage={() => generateSlideImageAt(i)}
                      generateImageBusy={!!slideImgGenBusy[s.id]}
                      generateImageDisabled={
                        !((s.imageQuery || '').trim()) ||
                        (normalizeSlideImgMode(s.imgMode) === 'dalle' && !hasOpenAI)
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mobile bottom bar — 6 abas em grid 3×2 (proeminentes) + FAB
              Exportar circular compacto. Tabs maiores, Exportar não domina. */}
          {isMobile && !empty && !drawerOpen && (
            <div
              data-vc-tour="mobile-bar"
              style={{
              position:'fixed', bottom:0, left:0, right:0, zIndex:20,
              /* Glass dark + ambient pink glow no top */
              background:'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%), rgba(15, 13, 22, 0.85)',
              backdropFilter:'blur(32px) saturate(180%)',
              WebkitBackdropFilter:'blur(32px) saturate(180%)',
              borderTop:'1px solid var(--glass-border-strong)',
              padding:'10px 10px calc(10px + env(safe-area-inset-bottom, 0))',
              display:'flex', gap:10, alignItems:'stretch',
              boxShadow:'0 -16px 40px rgba(0,0,0,0.42), 0 -32px 80px rgba(255,45,141,0.08)',
            }}
            >
              <div style={{
                flex:1, display:'grid',
                gridTemplateColumns:'repeat(3, minmax(0, 1fr))',
                gap:6,
              }}>
              {visibleEditorTabs(appMode).map(({ id, label, icon:Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    onClick={() => { setTab(id); setDrawerOpen(true); }}
                    style={{
                      minHeight:54, padding:'4px 6px',
                      borderRadius:14,
                      border: active
                        ? '1px solid rgba(255, 45, 141, 0.42)'
                        : '1px solid var(--glass-border)',
                      background: active
                        ? 'linear-gradient(135deg, rgba(255,45,141,0.18) 0%, rgba(255,45,141,0.08) 100%)'
                        : 'var(--bg-glass)',
                      color: active ? '#fff' : 'var(--text-secondary)',
                      fontSize:12, fontWeight:600, fontFamily:'var(--font-ui)', cursor:'pointer',
                      display:'flex', flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6,
                      letterSpacing:'-0.011em',
                      backdropFilter:'blur(18px)',
                      WebkitBackdropFilter:'blur(18px)',
                      /* Active: ambient glow magenta + inset highlight */
                      boxShadow: active
                        ? '0 0 24px rgba(255, 45, 141, 0.32), 0 4px 16px rgba(255, 45, 141, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.14)'
                        : '0 4px 12px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                      transition:'all 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                    onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
                    onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    aria-label={`Abrir aba ${label}`}
                    aria-pressed={active}
                  >
                    <Icon size={15} strokeWidth={active ? 2.25 : 2}/>{label}
                  </button>
                );
              })}
              </div>
              {/* Exportar FAB circular — proporcional aos tabs (não mais 40% largura) */}
              <button
                onClick={() => exportSlide(activeIdx)}
                disabled={exporting}
                style={{
                  alignSelf:'center',
                  width:60, height:60, borderRadius:'50%',
                  border:'none', cursor:'pointer',
                  background:'var(--accent)', color:'#fff',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
                  letterSpacing:'-0.011em',
                  opacity:exporting?0.5:1,
                  boxShadow:
                    '0 2px 4px rgba(255, 61, 139, 0.34), 0 8px 22px rgba(255, 61, 139, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  transition:'background 0.15s var(--ease-smooth), transform 0.12s var(--ease-smooth), box-shadow 0.22s',
                }}
                onTouchStart={e => { if (!exporting) e.currentTarget.style.transform = 'scale(0.94)'; }}
                onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                aria-label="Exportar card atual"
                title="Exportar"
              >
                <Download size={20} strokeWidth={2.5}/>
                <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.02em' }}>EXPORTAR</span>
              </button>
            </div>
          )}
        </main>
      </div>
      </>
      )}

      {/* File inputs: evitar hidden (Safari iOS bloqueia .click() via JS). */}
      <input ref={fileInputRef} type="file" accept="image/*" style={VC_TRIGGERABLE_FILE_INPUT_STYLE} aria-hidden="true" tabIndex={-1} onChange={handleImageUpload}/>
      <input ref={batchPhotoInputRef} type="file" accept="image/*" multiple style={VC_TRIGGERABLE_FILE_INPUT_STYLE} aria-hidden="true" tabIndex={-1} onChange={handleBatchPhotos}/>
      <input id={VC_PHOTO_ZONE_FILE_INPUT_ID} ref={photoZoneInputRef} type="file" accept="image/*" style={VC_PHOTO_ZONE_FILE_INPUT_STYLE} aria-hidden="true" tabIndex={-1} onChange={handlePhotoZoneBgFile}/>
      <input ref={refImageInputRef} type="file" accept="image/*" style={VC_TRIGGERABLE_FILE_INPUT_STYLE} aria-hidden="true" tabIndex={-1} onChange={handleRefImageFile}/>
      <input ref={videoFileInputRef} type="file" accept="video/*" style={VC_TRIGGERABLE_FILE_INPUT_STYLE} aria-hidden="true" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importVideoToActiveSlide(f); }}/>

      {/* Toast notifications */}
      <ToastStack toasts={toasts} onDismiss={dismissToast}/>

      {/* Onboarding dos 3 modos — primeira visita ou reabrível via ? */}
      <ModesIntroModal
        open={modesIntroOpen}
        currentMode={appMode}
        onSelect={(m) => { setAppMode(m); closeModesIntro(); toast(`Modo ${m.charAt(0).toUpperCase() + m.slice(1)} ativo. Boa criação!`, 'success', 4000); }}
        onClose={closeModesIntro}
      />

      {/* Barra de progresso fixa no rodapé durante geração de carrossel */}
      {genProgress && (() => {
        const pct = genProgress.total > 0
          ? Math.min(100, Math.max(0, (genProgress.current / genProgress.total) * 100))
          : (genProgress.phase === 'text' ? 30 : 0);
        return (
          <div style={{
            position:'fixed', left:0, right:0, bottom:0, zIndex:9999,
            pointerEvents:'none',
          }}>
            <div style={{
              maxWidth: 560, margin:'0 auto 16px', padding:'12px 16px',
              background:'rgba(20,20,22,0.95)', color:'#fff',
              backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)',
              borderRadius: 14, border:'1px solid rgba(255,255,255,0.1)',
              boxShadow:'0 12px 40px rgba(0,0,0,0.32)',
              fontFamily:'var(--font-ui)',
              pointerEvents:'auto',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <Loader2 size={14} style={{ animation:'spin 0.8s linear infinite', color:'var(--accent)', flexShrink:0 }}/>
                <span style={{ fontSize:13, fontWeight:600, letterSpacing:'-0.011em', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {genProgress.label || 'Gerando…'}
                </span>
                {genProgress.total > 0 && (
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontFamily:'var(--font-mono)', flexShrink:0 }}>
                    {genProgress.current}/{genProgress.total}
                  </span>
                )}
              </div>
              <div style={{
                height: 4, background:'rgba(255,255,255,0.12)', borderRadius:9999, overflow:'hidden',
              }}>
                <div style={{
                  height:'100%',
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, var(--accent), #ffb3d1)',
                  borderRadius: 9999,
                  transition: 'width 0.35s ease-out',
                }}/>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modals */}
      <KeysModal
        open={keysOpen}
        onClose={()=>setKeysOpen(false)}
        aiSettings={aiSettings}
        onSaveSettings={setAISettings}
      />
      <GenerateModal
        open={setupOpen}
        onClose={()=>{setSetupOpen(false);setPrefilledTopic('');}}
        onGenerate={handleGenerate}
        defaultNiche={niche}
        defaultTopic={prefilledTopic}
        defaultTone={brand.defaultTone || ''}
        defaultAudience={brand.defaultAudience || ''}
        hasOpenAI={hasOpenAI}
        hasAnthropic={hasAnthropic}
        imageProviderLabel={
          aiSettings.imageProvider === 'zai'
            ? (aiSettings.imageModels?.zai === 'glm-image' ? 'GLM-Image · Z.ai' : 'CogView-4 · Z.ai')
            : (aiSettings.imageModels?.openai === 'gpt-image-1.5' ? 'GPT Image 1.5' : 'GPT Image 2')
        }
        onOpenKeys={() => setKeysOpen(true)}
        onGoToMaterial={() => {
          setShellView('project');
          // «Fontes & referências» vive na tab narrativa — 'material' não é uma
          // tab real e deixava a sidebar vazia.
          setTab('narrativa');
          if (isMobile) setDrawerOpen(true);
        }}
        brandSummary={[
          brand.bio?.trim() && 'bio',
          brand.positioning?.trim() && 'posicionamento',
          brand.signature?.trim() && 'assinatura',
        ].filter(Boolean)}
        materialSummary={(() => {
          const { c, s, x } = normalizedMaterialPieces(material);
          return [
            c && `conteúdo (${c.length.toLocaleString('pt-BR')} chars)`,
            s && 'fontes',
            x && 'contexto',
            REFERENCE_PROFILE_BY_ID[material.refProfileId]?.label &&
              `voz ref.: ${REFERENCE_PROFILE_BY_ID[material.refProfileId].label}`,
          ].filter(Boolean);
        })()}
        imgParams={imgParams}
        onImgParamsChange={setImgParams}
        mode={mode}
        onModeChange={setMode}
        creativePreset={creativePreset}
        onCreativePresetChange={setCreativePreset}
        slideTextDensity={slideTextDensity}
        onSlideTextDensityChange={setSlideTextDensity}
        cardVisualStyle={cardVisualStyle}
        onCardVisualStyleChange={setCardVisualStyle}
        visualPreset={visualPreset}
        onVisualPresetChange={applyVisualStylePreset}
        material={material}
        setMaterial={setMaterial}
        hookLibrary={hookLibrary}
      />
      <ResearchPanel
        open={researchOpen}
        onClose={()=>setResearchOpen(false)}
        onSetNiche={setNiche}
        onUseIdea={text=>{setResearchOpen(false);setPrefilledTopic(text);setSetupOpen(true);}}
        narrativeMode={mode}
        creativePreset={creativePreset}
        openaiKey={openaiKey}
      />
      <TemplatesModal
        open={templatesOpen}
        onClose={()=>setTemplatesOpen(false)}
        onApply={applyTemplate}
      />
      <HookVariationsModal
        open={hookVarsOpen}
        onClose={()=>setHookVarsOpen(false)}
        slide={slide}
        niche={niche}
        brand={brand}
        material={material}
        openaiKey={openaiKey}
        narrativeMode={mode}
        creativePreset={creativePreset}
        onPick={(h)=>{
          updateSlide({ title: h.title, subtitle: h.subtitle || slide.subtitle });
          toast('Gancho atualizado', 'success');
        }}
      />
      <PromptDialog
        open={imgPrompt.open}
        title={imgPrompt.title || 'Editar'}
        label={imgPrompt.label}
        defaultValue={imgPrompt.defaultValue || ''}
        placeholder={imgPrompt.placeholder || ''}
        cta={imgPrompt.cta || 'Aplicar'}
        onClose={closeImgPrompt}
        onConfirm={confirmImgPrompt}
      />
      <ImageCropModal
        open={imageCropOpen && !!slide.bgImage}
        imageSrc={slide.bgImage || ''}
        onClose={() => setImageCropOpen(false)}
        onApply={(dataUrl) => updateSlide({ bgImage: dataUrl })}
      />
      <PhotoPositionModal
        open={photoPositionOpen}
        slide={slide}
        fmt={fmt}
        onClose={() => setPhotoPositionOpen(false)}
        onChange={(patch) => updateSlide(patch)}
      />
      <OnboardingTour
        open={tourOpen}
        onDismiss={() => {
          try { localStorage.setItem(SK.onboarding, '1'); } catch {}
          setTourOpen(false);
        }}
        isMobile={isMobile}
        empty={empty}
        setTab={setTab}
        setDrawerOpen={setDrawerOpen}
        onEnterEditor={() => setShellView('project')}
        onPrepareRefsTourStep={() => {
          setCreativePreset('livre');
          setSetupOpen(true);
        }}
      />
      <HelpModal
        open={helpOpen}
        onClose={()=>setHelpOpen(false)}
        onShowLanding={() => { setHelpOpen(false); reopenLanding(); }}
        onStartTour={() => { setHelpOpen(false); setTourOpen(true); }}
      />
      <FullscreenViewer
        open={fullscreenOpen} onClose={()=>setFullscreenOpen(false)}
        slides={slides} fmt={fmt} brand={brand}
        activeIdx={activeIdx} setActiveIdx={setActiveIdx}
        onSavePresentationAdjust={persistFullscreenPresentationAdjustDraft}
        creativePreset={creativePreset}
      />
      <LibraryModal
        open={libraryOpen}
        onClose={()=>setLibraryOpen(false)}
        library={library}
        activeDocId={activeDocId}
        onOpen={openDoc}
        onNew={()=>newDoc()}
        onDuplicate={duplicateDoc}
        onDelete={deleteDoc}
        onRename={renameDoc}
        onSetStatus={setDocStatus}
        onExportDoc={exportDoc}
        onExportAll={exportAllDocs}
        onImportTrigger={() => importDocRef.current?.click()}
      />
      {/* Input oculto para importar JSON */}
      <input
        ref={importDocRef}
        type="file"
        accept=".json,application/json"
        style={{ display:'none' }}
        onChange={handleImportFile}
      />
      <BrandsModal
        open={brandsOpen}
        onClose={()=>setBrandsOpen(false)}
        brands={brandRoster}
        activeBrandId={activeBrandId}
        currentBrand={brand}
        onApply={applyBrand}
        onSave={saveCurrentBrandAsProfile}
        onDelete={deleteBrand}
      />

      {/* Export progress FAB */}
      {exporting && exportProgress.total > 1 && (
        <div className="export-fab">
          <div style={{ width:28, height:28, borderRadius:'50%', border:'2px solid var(--border)', borderTopColor:'var(--accent)', animation:'spin 0.7s linear infinite', flexShrink:0 }}/>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>A exportar cards</div>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', marginTop:2, letterSpacing:'0.04em' }}>
              {exportProgress.current} / {exportProgress.total}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HELP / KEYBOARD SHORTCUTS MODAL ──────────────────────────────────────────

// ─── FULLSCREEN VIEWER ────────────────────────────────────────────────────────
// Apresentação tela cheia com setas e swipe; ESC fecha.



// ─── LIBRARY MODAL ────────────────────────────────────────────────────────────
// Lista os carrosséis salvos com mini-thumbnail, nome editável, status e ações.




