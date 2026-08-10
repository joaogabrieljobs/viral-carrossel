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
import { vcCustomTitleFace, hydrateBrandTextColors, effectiveTitleFontFamily } from './src/utils/brand-helpers.js';
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
  resolveMaterialPromptParts,
} from './src/utils/generation-prompts.js';
import { GLOBAL_STYLE } from './src/styles/global-style.js';
import { useExport } from './src/hooks/useExport.js';
import { useAccess } from './src/hooks/useAccess.js';
import { useLibrary } from './src/hooks/useLibrary.js';
import { useToasts } from './src/hooks/useToasts.js';
import { useAiSettings } from './src/hooks/useAiSettings.js';
import {
  SlideCard,
} from './src/components/card/SlideCard.jsx';
import {
  shouldShowOnboardingLanding,
  dismissOnboardingLanding,
  mkLibEntry,
} from './src/utils/landing-gate.js';
import {
  usePersistedState,
  useHistory,
} from './src/hooks/useHistory.js';
import {
  trackEvent,
  lsGet,
} from './src/utils/telemetry.js';
import {
  guessFontFileFormat,
  IMAGE_FOCAL_XY,
  IMAGE_MODE_PRESETS,
  activeImageModePresetId,
  activeImageFocalLayoutId,
  PHOTO_REGION_GRID,
  BG_PATTERN_OPTIONS,
  PRESENTATION_IMG_FILTER_PRESETS,
  unionDestaqueRangeIntoSpans,
  EDITOR_TABS,
  APP_MODE_RANK,
  visibleEditorTabs,
  SidebarContent,
} from './src/components/SidebarContent.jsx';
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












// ─── CONSTANTS ────────────────────────────────────────────────────────────────































































// ─── MODOS DE GERAÇÃO ─────────────────────────────────────────────────────────


const REFERENCE_PROFILE_BY_ID = Object.fromEntries(REFERENCE_PROFILES.map(p => [p.id, p]));









// ─── UTILS ────────────────────────────────────────────────────────────────────


























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









































































function rectsEqual(a, b) {
  return a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}











/** Personalizado · densidades 1/1 ou 1/2: dois primeiros full-bleed, miolo tipo Cultura com sanduíche. */



































ClassicCanvasInner.displayName = 'ClassicCanvasInner';


ClassicLegadoInsetPhotoColumn.displayName = 'ClassicLegadoInsetPhotoColumn';

// AutoFitText foi extraído para src/components/AutoFitText.jsx



// ─── SLIDE CARD ───────────────────────────────────────────────────────────────





// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────










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

  const [libraryOpen, setLibraryOpen] = useState(false);  // declarado antes de useLibrary (usa setLibraryOpen)
  const { toasts, dismissToast, toast, setError } = useToasts();
  const {
    renameDoc, setDocStatus, openDoc, newDoc, duplicateDoc, deleteDoc,
    exportDoc, exportAllDocs, handleImportFile,
    shellView, setShellView, importDocRef,
  } = useLibrary({
    library, setLibrary, activeDocId, setActiveDocId,
    history, slides, brand, brandRoster, activeBrandId, setLibraryOpen, toast, setError,
  });

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
  /**
   * Quadro do desktop: os cards ficam numa fila que rola na horizontal. Clicar
   * numa miniatura só mudava `activeIdx` — o quadro não andava, então a partir
   * do 5.º card o slide selecionado ficava fora da janela sem nenhuma pista de
   * como chegar lá. Aqui trazemos o card ativo para a vista.
   */
  const boardScrollRef = useRef(null);
  const boardCardRefs = useRef([]);
  const [tab, setTab] = useState('brand');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [canvasEditMode, setCanvasEditMode] = useState(false);
  const [showPreviewAlignGrid, setShowPreviewAlignGrid] = useState(() => {
    try { return localStorage.getItem(SK.previewGrid) === '1'; } catch { return false; }
  });
  useEffect(() => {
    const alvo = boardCardRefs.current[activeIdx];
    const quadro = boardScrollRef.current;
    if (!alvo || !quadro) return;
    const rc = quadro.getBoundingClientRect();
    const ra = alvo.getBoundingClientRect();
    // Só mexe quando o card realmente está (parcialmente) fora — evita puxar o
    // quadro a cada clique num card já visível.
    if (ra.left >= rc.left - 1 && ra.right <= rc.right + 1) return;
    const delta = (ra.left + ra.width / 2) - (rc.left + rc.width / 2);
    quadro.scrollBy({ left: delta, behavior: 'smooth' });
  }, [activeIdx]);

  /** QA: simula leitura à distância do polegar (tipo menor no preview). */
  const [thumbQaMode, setThumbQaMode] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [hookVarsOpen, setHookVarsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const {
    landingOpen, setLandingOpen,
    paywallOpen, setPaywallOpen,
    loginOpen, setLoginOpen,
    paywallEmail, setPaywallEmail,
    loginHint, setLoginHint,
    access, setAccess,
    accessActive,
    accountTab, setAccountTab,
    enterStudio,
    goAccount,
    refreshAccess,
    completeLanding,
    reopenLanding,
    openPortal,
    handleLogout,
  } = useAccess({ setShellView, onLeaveEditor: () => setDrawerOpen(false) });
  const [tourOpen, setTourOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [imgPrompt, setImgPrompt] = useState({ open:false, mode:null, defaultValue:'' });
  const [imageCropOpen, setImageCropOpen] = useState(false);
  const [photoPositionOpen, setPhotoPositionOpen] = useState(false);
  const { aiSettings, setAISettings, openaiKey, anthropicKey } = useAiSettings();
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

  /** Novo deslocamento de um elemento do card (arrasto direto na pré-visualização). */
  const patchElementOffsetAt = useCallback((idx, chave, offset) => {
    setSlides((prev) => prev.map((s, i) => (
      i === idx
        ? { ...s, elementOffsets: { ...(s.elementOffsets || {}), [chave]: offset } }
        : s
    )));
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
      // Antes ia para a tab 'slide' — que não existe em EDITOR_TABS e renderiza
      // a união de layout+imagem+texto, entregando ferramentas de Studio a um
      // usuário no modo Criador. 'narrativa' existe em todos os modos e é onde
      // o texto recém-gerado é editado.
      setTab('narrativa');
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
  const {
    waitForRender,
    renderSlideToCanvas,
    exportSlide,
    exportAll,
    exportPhotosOnly,
    exportPDF,
  } = useExport({
    slides, fmt, slideRefs,
    setExporting, setExportProgress, setError, toast,
  });

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
      // Qualquer overlay bloqueia os atalhos. Landing/paywall/login e a intro de
      // modos faltavam: com eles abertos, setas/Delete/F agiam no documento por baixo.
      const anyModalOpen = setupOpen || researchOpen || keysOpen || templatesOpen || hookVarsOpen || helpOpen || imgPrompt.open || fullscreenOpen || tourOpen || libraryOpen || brandsOpen || imageCropOpen || photoPositionOpen || modesIntroOpen || landingOpen || paywallOpen || loginOpen;
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
  }, [activeIdx, slides.length, history, setupOpen, researchOpen, keysOpen, templatesOpen, hookVarsOpen, helpOpen, imgPrompt.open, fullscreenOpen, tourOpen, libraryOpen, brandsOpen, imageCropOpen, photoPositionOpen, modesIntroOpen, landingOpen, paywallOpen, loginOpen, shellView]); // eslint-disable-line

  const sidebarProps = {
    // setHookLibrary/niche: botão "salvar hook na biblioteca" (SidebarContent).
    // hookLibrary em si só é lido pelo GenerateModal — não entra aqui.
    setHookLibrary, niche,
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
      <div className="vc-editor-shell" style={{ flex:1, display:'flex', overflow:'hidden' }}>

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
              <button onClick={addSlide} aria-label="Adicionar card ao carrossel" style={{
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
          <div ref={boardScrollRef} style={{ flex:1, overflow:'auto' }}>
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
                    movableElements={!canvasEditMode}
                    onElementOffsetChange={patchElementOffsetAt}
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
                    ref={(el) => { boardCardRefs.current[i] = el; }}
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
                        movableElements={i === activeIdx && !canvasEditMode}
                        onElementOffsetChange={patchElementOffsetAt}
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
                {/* Respiro no fim da fila: o padding-right do contentor flex não
                    entra no scrollWidth, e sem isto o último card fica colado
                    à borda quando se rola até ao fim. */}
                <div aria-hidden style={{ flexShrink:0, width:4 }}/>
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




