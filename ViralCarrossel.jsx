import { ProjectContextBanner } from './src/components/ProjectContextBanner.jsx';
import { startAIJob, runAIJob, cancelAllAIGeneration, getAIGenerationCount, throwIfGenerationCancelled, isGenerationCancelled } from './src/utils/generation-control.js';
import { buildRemixBlock, mergeRemixedSlides } from './src/utils/carousel-remix.js';
import { GenerationStatus } from './src/components/GenerationStatus.jsx';
import { buildEditorialStrategyBlock, buildContentObjectiveReminder, normalizeContentObjective, normalizeInstagramCaption } from './src/utils/editorial-strategy.js';
import {
  assertPresentationTextLimits,
  buildPresentationLimitsBlock,
  generateReviewedCarousel,
  presentationTextLimitsFromSlides,
} from './src/utils/editorial-review.js';
import { buildPerformanceGuidance, savePublicationResult, removePublicationResult } from './src/utils/publication-results.js';
import { PublicationResultsModal } from './src/components/panels/PublicationResultsModal.jsx';
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { flushSync } from 'react-dom';
import {
  Sparkles, Search, Download, Trash2, Copy,
  Plus, Palette, Layout, LayoutGrid, Crop, Wand2, Loader2, Save,
  Bookmark, Shuffle, Lock, Move, FlipHorizontal2, RotateCcw,
  Video, Film,
  TrendingUp, RefreshCw, X, Upload, Link as LinkIcon,
  FileText, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Type, Quote, BookOpen, Image as ImageIcon,
  ArrowUp, ArrowDown, Zap, Lightbulb, Highlighter,
  ChevronRight, ChevronLeft, ChevronDown, Check, Instagram, Settings, Maximize2, Minus,
  Home, Layers, SlidersHorizontal, User,
  Newspaper, Brain, HeartHandshake, GraduationCap, ScrollText, Megaphone,
  Target, Camera,
} from 'lucide-react';
import { extractDominantColor } from './src/utils/color-extraction.js';
import { extractJSON } from './src/utils/parsers.js';
import { saveHookToLibrary, getHooksForNiche } from './src/utils/hooks-library.js';
import { SCHEMA_VERSION, migrateDoc } from './src/utils/schema-migration.js';
import { videoPut, videoGet, videoDelete, videoStorageUsage, newVideoId, getVideoUrl, setVideoUrlMap } from './src/utils/video-store.js';
import {
  guardarImagemDoSlide,
  applyPersistedImagePatches,
  applySlidePatchIfImageCurrent,
  slideImageIdentity,
  imageGet,
  imageDelete,
  imageCleanupOrphans,
  imageStorageUsage,
  semImagensDeRuntime,
  semLogosDeRuntimeDasMarcas,
  idsDeImagemEmUso,
  dataUrlParaBlob,
} from './src/utils/image-store.js';
import { storeSlideReference, importSlideReference } from './src/utils/slide-reference.js';
import { makeTextOverlay, addOverlayToSlide, updateOverlayOnSlide, normalizeOverlays, MAX_CARD_OVERLAYS } from './src/utils/card-overlays.js';
import { getAccountVaultImageIds, snapshotAccountVaultForOwners } from './src/utils/account-vault.js';
import { readDataOwner, dataOwnerAliases } from './src/utils/account-data-owner.js';
import AutoFitText from './src/components/AutoFitText.jsx';
import WcagBadge from './src/components/WcagBadge.jsx';
import VisualStylePicker from './src/components/VisualStylePicker.jsx';
import BrandLogo from './src/components/BrandLogo.jsx';
import BootScreen from './src/components/BootScreen.jsx';
import { readDeletedProjectIds, rememberDeletedProjectIds } from './src/utils/project-deletions.js';
import AccountProfile from './src/components/AccountProfile.jsx';
import {
  fetchAccessSession,
  confirmCheckoutSession,
  openBillingPortal,
  logoutAccess,
} from './src/lib/billing.js';
import { VISUAL_PRESETS, applyVisualPreset, getSlideOverridesForPreset, PRESET_BRAND_SIGNATURE_KEYS } from './src/styles/visual-presets.jsx';
import {
  PRESENTATION_VISUAL_PRESETS,
  PRESENTATION_VISUAL_PRESET_CATALOG,
  DEFAULT_PRESENTATION_VISUAL_PRESET_ID,
  buildPresentationDesignSystemPromptBlock,
  getPresentationCompositionOverrides,
  resolvePresentationVisualPresetDefinition,
} from './src/styles/presentation-presets.jsx';
import {
  createCustomVisualPreset,
  readCustomVisualPresets,
  writeCustomVisualPresets,
} from './src/utils/custom-visual-presets.js';
import { useScrollLock } from './src/hooks/useScrollLock.js';
import { vcCustomTitleFace, hydrateBrandTextColors, effectiveTitleFontFamily } from './src/utils/brand-helpers.js';
import { SectionLabel as S } from './src/components/ui/SectionLabel.jsx';
import PromptDialog from './src/components/PromptDialog.jsx';
import { resolveSlideBrandBg } from './src/utils/brand-helpers.js';
import { STATUS_DEFS, STATUS_BY_ID, fmtDate, isDefault } from './src/utils/library-helpers.js';
import { normalizeLibraryEntry, normalizeLibraryFolders } from './src/utils/library-organizer.js';
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
  resolveGenMode,
  normalizeNarrativeModeId,
  buildBrandVoiceBlock,
  isPersoHybridDensity,
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
  buildCarouselTextContext,
  buildGenerationJsonContract,
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
import {
  isApresentacaoPreset,
  buildApresentacaoPackBlock,
  buildApresentacaoRefineHint,
  presentationDocPatch,
  APRESENTACAO_PRESET_ID,
  normalizePresentationPath,
  getPresentationPath,
  clampPresentationSlideCount,
} from './src/utils/presentation.js';
import {
  applyBatchPhotosToSlides,
  summarizeBatchPhotoImport,
} from './src/utils/batch-photos.js';
import { applyImportedTextToSlides } from './src/utils/import-text.js';
import {
  DEFAULT_CAROUSEL_VISUAL_PRESET_ID,
  applyCarouselVisualPresetToDoc,
  applyPresentationVisualPresetToSlide,
  applyPresentationVisualPresetToDoc,
  applyPresentationVisualPresetToSlides,
  presentationStageAt,
} from './src/utils/presentation-state.js';
import {
  normalizeStyleKit,
  buildProjectContextBlock,
  buildStyleKitTextHint,
  composeImgExtraPrompt,
  resolveQuickGenerationRequest,
  buildGenerationTaskBlock,
} from './src/utils/style-kit.js';
import { buildProjectDesignInstructions, projectDesignBrandPatch, PROJECT_DESIGN_SCHEMA } from './src/utils/style-kit-design.js';
import { resolveImageReferences, migrateProjectReferences } from './src/utils/style-kit-storage.js';
import { imageGenerationAccess, slideImageGenerationState } from './src/utils/image-generation-readiness.js';
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
import { SeriesPanel } from './src/components/panels/SeriesPanel.jsx';
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
  areAccountDataWritesLocked,
  lockAccountDataWrites,
  unlockAccountDataWrites,
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
  autoAdjustSlides,
  canvasZonesFontScalePatch,
  sandwichPhotoZoneImgStyle,
  attachGenerationCanvasLayouts,
  enableCanvasLayoutSlides,
  disableCanvasLayoutSlides,
  removeCanvasLayoutSlides,
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
  buildBrandToneAnalysisPrompt,
  brandToneFromAnalysis,
  parseBrandToneAnalysisResponse,
  brandToneIsReady,
} from './src/utils/brand-tone.js';
import {
  resolveLogoDataUrl,
  applyGenerationLogoPolicy,
  storeSlideLogo,
} from './src/utils/slide-logo.js';
import { appModeLabel } from './src/utils/ui-depth-labels.js';

const OnboardingLanding = lazy(() => import('./src/components/OnboardingLandingProduct.jsx'));
const Paywall = lazy(() => import('./src/components/Paywall.jsx'));
const LoginModal = lazy(() => import('./src/components/LoginModal.jsx'));
const ModesIntroModal = lazy(() => import('./src/components/ModesIntroModal.jsx'));
const OnboardingTour = lazy(() => import('./src/components/OnboardingTour.jsx'));
const HelpModal = lazy(() => import('./src/components/HelpModal.jsx'));
const BrandsModal = lazy(() => import('./src/components/BrandsModal.jsx'));
const LibraryModal = lazy(() => import('./src/components/LibraryModal.jsx'));
const ImageCropModal = lazy(() => import('./src/components/ImageCropModal.jsx'));
const PhotoPositionModal = lazy(() => import('./src/components/PhotoPositionModal.jsx'));
const KeysModal = lazy(() => import('./src/components/KeysModal.jsx'));
const TemplatesModal = lazy(() => import('./src/components/TemplatesModal.jsx'));

function imageAspectRatioForFormat(fmt) {
  if (fmt === 'apresentacao') return '16:9';
  if (fmt === 'quadrado') return '1:1';
  if (fmt === 'stories') return '9:16';
  return '4:5';
}

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
  const [libraryFolders, setLibraryFolders] = useState(() => (
    normalizeLibraryFolders(lsGet(SK.libraryFolders, []))
  ));
  const [library, setLibrary] = useState(() => {
    const folders = normalizeLibraryFolders(lsGet(SK.libraryFolders, []));
    const lib = lsGet(SK.library, null);
    if (Array.isArray(lib) && lib.length) {
      return lib.map((e) => normalizeLibraryEntry({ ...e, doc: ensureDocShape(e.doc || {}) }, folders));
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
  const brandRosterPersistRef = useRef(brandRoster);
  brandRosterPersistRef.current = brandRoster;
  const libraryFoldersPersistRef = useRef(libraryFolders);
  libraryFoldersPersistRef.current = libraryFolders;
  /** Aponta para `flushPersistNow`, definido mais abaixo (precisa do `doc`). */
  const flushPersistRef = useRef(null);
  const accessSessionRef = useRef(null);
  // O documento de exemplo do primeiro render não pode ir para a nuvem antes
  // de conhecer a conta e restaurar a biblioteca que já pertence a ela.
  const [accountLibraryReady, setAccountLibraryReady] = useState(false);
  const [accountRestoreError, setAccountRestoreError] = useState('');
  const accountLibraryReadyRef = useRef(false);
  const markAccountLibraryReady = useCallback(() => {
    accountLibraryReadyRef.current = true;
    setAccountRestoreError('');
    setAccountLibraryReady(true);
  }, []);
  const [cloudSyncBusy, setCloudSyncBusy] = useState(false);
  const cloudSyncInFlightRef = useRef(false);
  const cloudAutoPushRef = useRef(null);
  const stopCloudAutoPush = useCallback(async () => {
    const pending = cloudAutoPushRef.current;
    if (!pending) return;
    pending.controller.abort();
    await pending.promise?.catch(() => {});
  }, []);
  const docAutosaveTimerRef = useRef(null);

  // Após sync/pull: o reload pode disparar pagehide que regrava a biblioteca
  // React (stale) por cima da nuvem. O lock impede isso; aqui libertamos no boot.
  useEffect(() => {
    try { unlockAccountDataWrites(); } catch { /* */ }
  }, []);

  /**
   * Evita perder fotos (base64) e as últimas edições ao puxar-para-atualizar no
   * telemóvel: a cadeia normal é doc → (400ms) → biblioteca → (100ms) →
   * localStorage, logo um flush que só copiasse a biblioteca perdia o que foi
   * escrito nos últimos 400 ms. `flushPersistNow` junta o doc em edição.
   */
  useEffect(() => {
    const flushLibrary = () => {
      // Logout/troca de conta: não repor biblioteca no pagehide.
      if (!accountLibraryReadyRef.current || areAccountDataWritesLocked()) return;
      if (flushPersistRef.current) { flushPersistRef.current(); return; }
      lsSet(SK.library, semImagensDeRuntime(libraryPersistRef.current));
      lsSet(SK.libraryFolders, libraryFoldersPersistRef.current);
      lsSet(SK.brands, semLogosDeRuntimeDasMarcas(brandRosterPersistRef.current));
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flushLibrary();
    };
    // pagehide + beforeunload: Safari iOS por vezes não dispara visibilitychange
    // ao fechar o tab (auditoria FE-007).
    window.addEventListener('pagehide', flushLibrary);
    window.addEventListener('beforeunload', flushLibrary);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', flushLibrary);
      window.removeEventListener('beforeunload', flushLibrary);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, []);

  // Persiste os 3 stores (debounced — sincronização imediata acima nos eventos do sistema)
  // Auto-save da biblioteca + tracking do último save pro indicador no header
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const firstSaveRef = useRef(true);
  useEffect(() => {
    if (!accountLibraryReady) return undefined;
    const t = setTimeout(() => {
      if (!lsSet(SK.library, semImagensDeRuntime(library))) return;
      if (firstSaveRef.current) { firstSaveRef.current = false; return; }
      setLastSavedAt(Date.now());
    }, 100);
    return () => clearTimeout(t);
  }, [library, accountLibraryReady]);
  useEffect(() => { if (accountLibraryReady) lsSet(SK.libraryFolders, libraryFolders); }, [libraryFolders, accountLibraryReady]);
  useEffect(() => { if (accountLibraryReady) lsSet(SK.activeDocId, activeDocId); }, [activeDocId, accountLibraryReady]);
  useEffect(() => { if (accountLibraryReady) lsSet(SK.brands, semLogosDeRuntimeDasMarcas(brandRoster)); }, [brandRoster, accountLibraryReady]);
  useEffect(() => { if (accountLibraryReady) lsSet(SK.activeBrandId, activeBrandId); }, [activeBrandId, accountLibraryReady]);

  // Guard de primeira visita: localStorage vazio → activeDocId nasce null porque a
  // biblioteca ainda não foi persistida. Sem isso, o efeito de save-back faz early-
  // return em `if (!activeDocId)` e as edições da primeira sessão são perdidas.
  useEffect(() => {
    if (!activeDocId && library[0]?.id) setActiveDocId(library[0].id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Doc ativo da biblioteca + ponteiro pro index dele (pra updates eficientes)
  const activeEntry = library.find(e => e.id === activeDocId) || library[0];
  const activeProjectRef = useRef(activeEntry?.id);
  activeProjectRef.current = activeEntry?.id;
  const initialDoc  = ensureDocShape(activeEntry?.doc || DEFAULT_DOC);

  // O perfil ativo acompanha a marca gravada no projeto antes de o histórico
  // carregar o novo doc. Evita que a identidade do projeto A seja sincronizada
  // por engano no perfil que estava ativo ao abrir o projeto B.
  useLayoutEffect(() => {
    const projectBrandId = activeEntry?.doc?.brand?.id;
    if (
      projectBrandId
      && projectBrandId !== activeBrandId
      && brandRoster.some((item) => item.id === projectBrandId)
    ) setActiveBrandId(projectBrandId);
    // A identidade deve ser sincronizada somente ao trocar de projeto. Incluir
    // activeBrandId aqui restaura por engano o ID antigo da biblioteca durante
    // os milissegundos entre aplicar uma marca e o autosave do documento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId]);

  const history = useHistory(initialDoc);
  // Carrega antes de pintar: não expõe o brief do projeto anterior por um frame.
  useLayoutEffect(() => {
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
  const styleKit = useMemo(() => normalizeStyleKit(doc.styleKit), [doc.styleKit]);
  const mode      = doc.mode      || 'editorial';
  const creativePreset = doc.creativePreset ?? 'livre';
  const contentObjective = normalizeContentObjective(doc.contentObjective);
  const performanceSettings = { account: brand.handle || '', windowDays: 7, enabled: true, ...activeEntry?.performanceSettings };
  const slideTextDensityRaw = doc.slideTextDensity ?? '1_1';
  const slideTextDensity = SLIDE_TEXT_DENSITY_BY_ID[slideTextDensityRaw] ? slideTextDensityRaw : '1_1';
  const cardVisualStyle = normalizeCardVisualStyle(doc.cardVisualStyle);
  const quickCardCount = doc.quickCardCount === 'auto' ? 'auto' : (Number(doc.quickCardCount) || 'auto');
  const autoAdjustOnGenerate = doc.autoAdjustOnGenerate !== false;
  const activeProductKind = isApresentacaoPreset(creativePreset) || fmt === 'apresentacao'
    ? 'apresentacao'
    : 'carrossel';
  const presentationPath = normalizePresentationPath(doc.presentationPath);

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
    const nextFmt = FORMATS[raw] ? raw : 'carrossel';
    if (nextFmt === 'apresentacao') {
      if (d.productKind === 'apresentacao' && isApresentacaoPreset(d.creativePreset)) {
        return { ...d, fmt: nextFmt };
      }
      return applyPresentationVisualPresetToDoc(
        d,
        DEFAULT_PRESENTATION_VISUAL_PRESET_ID,
        PRESENTATION_VISUAL_PRESETS,
        { initialize: true },
      );
    }
    if (d.fmt === 'apresentacao' && isApresentacaoPreset(d.creativePreset)) {
      return applyCarouselVisualPresetToDoc(
        d,
        DEFAULT_CAROUSEL_VISUAL_PRESET_ID,
        VISUAL_PRESETS,
        { fmt: nextFmt },
      );
    }
    return { ...d, fmt: nextFmt, productKind: 'carrossel' };
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
  const setStyleKit = useCallback(next => history.set(d => ({
    ...d,
    styleKit: normalizeStyleKit(
      typeof next === 'function'
        ? next(normalizeStyleKit(d.styleKit))
        : next,
    ),
  })), [history]);
  const setMode      = useCallback(next => history.set(d => ({
    ...d,
    mode: typeof next==='function' ? next(d.mode || 'editorial') : next,
  })), [history]);
  const setCreativePreset = useCallback(next => history.set(d => {
    const creativePreset = typeof next === 'function' ? next(d.creativePreset ?? 'livre') : next;
    if (isApresentacaoPreset(creativePreset)) {
      if (d.productKind === 'apresentacao' && isApresentacaoPreset(d.creativePreset)) {
        return { ...d, creativePreset };
      }
      return applyPresentationVisualPresetToDoc(
        d,
        DEFAULT_PRESENTATION_VISUAL_PRESET_ID,
        PRESENTATION_VISUAL_PRESETS,
        { initialize: true },
      );
    }
    // Sai do deck: volta ao feed 4:5 se ainda estava em 16:9.
    if (isApresentacaoPreset(d.creativePreset) && d.fmt === 'apresentacao') {
      return {
        ...applyCarouselVisualPresetToDoc(
          d,
          DEFAULT_CAROUSEL_VISUAL_PRESET_ID,
          VISUAL_PRESETS,
          { fmt: 'carrossel' },
        ),
        creativePreset,
      };
    }
    return { ...d, creativePreset };
  }), [history]);

  // ── PADRÃO VISUAL ────────────────────────────────────────────────────────
  // Trackeia qual dos 12 presets visuais o user escolheu (null = nenhum).
  // Persistido no doc — antes era useState local e o picker "esquecia" a
  // seleção em reload/troca de projeto, mesmo com as cores já aplicadas.
  const visualPreset = doc.visualPreset ?? null;
  const [customVisualPresets, setCustomVisualPresets] = useState(() => readCustomVisualPresets());
  const visualPresets = useMemo(
    () => [...VISUAL_PRESETS, ...PRESENTATION_VISUAL_PRESET_CATALOG, ...customVisualPresets],
    [customVisualPresets],
  );
  useEffect(() => {
    writeCustomVisualPresets(customVisualPresets);
  }, [customVisualPresets]);
  const setVisualPreset = useCallback(next => history.set(d => ({
    ...d,
    visualPreset: typeof next === 'function' ? next(d.visualPreset ?? null) : next,
  })), [history]);
  const applyVisualStylePreset = useCallback((presetId) => {
    if (!presetId) return;
    const preset = resolvePresentationVisualPresetDefinition(presetId, visualPresets);
    if (!preset) return;
    const resolvedPresetId = preset.id;
    const isPresentationVisual = preset?.productKind === 'apresentacao';
    const fromPreset = preset?.creativePreset || suggestCreativePresetForVisual(resolvedPresetId);
    history.set((d) => {
      if (isPresentationVisual) {
        return applyPresentationVisualPresetToDoc(d, resolvedPresetId, visualPresets, {
          initialize: d.productKind !== 'apresentacao' || !isApresentacaoPreset(d.creativePreset),
        });
      }
      const next = d.productKind === 'apresentacao' || isApresentacaoPreset(d.creativePreset)
        ? applyCarouselVisualPresetToDoc(d, resolvedPresetId, visualPresets, { fmt: 'carrossel' })
        : {
            ...d,
            visualPreset: resolvedPresetId,
            brand: applyVisualPreset(d.brand, resolvedPresetId, visualPresets),
            slides: (Array.isArray(d.slides) ? d.slides : []).map((slide) => ({
              ...slide,
              ...getSlideOverridesForPreset(resolvedPresetId, visualPresets),
            })),
          };
      return fromPreset ? { ...next, creativePreset: fromPreset } : next;
    });
    trackEvent('visual_preset_applied', { preset: resolvedPresetId, creativePreset: fromPreset || null });
  }, [history, visualPresets]);
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
  const setQuickCardCount = useCallback(next => history.set(d => ({
    ...d,
    quickCardCount: typeof next === 'function' ? next(d.quickCardCount ?? 'auto') : next,
  })), [history]);
  const setPresentationPath = useCallback(next => history.set(d => ({
    ...d,
    presentationPath: normalizePresentationPath(
      typeof next === 'function' ? next(d.presentationPath ?? 'auto') : next,
    ),
  })), [history]);

  const [libraryOpen, setLibraryOpen] = useState(false);  // declarado antes de useLibrary (usa setLibraryOpen)
  const { toasts, dismissToast, toast, setError } = useToasts();
  const {
    renameDoc, setDocStatus, setDocFolder, setDocPublicationDate,
    createFolder, renameFolder, deleteFolder,
    openDoc, newDoc, duplicateDoc, newFromContext, createSeriesDrafts, deleteDoc,
    exportDoc, exportAllDocs, handleImportFile,
    shellView, setShellView, importDocRef,
  } = useLibrary({
    library, setLibrary, libraryFolders, setLibraryFolders, activeDocId, setActiveDocId,
    history, slides, brand, brandRoster, setBrandRoster, activeBrandId, setActiveBrandId,
    setLibraryOpen, toast, setError, visualPresets,
  });
  const askPromptRef = useRef(null);
  const createProjectByKind = useCallback(async (kind = 'carrossel', projectName) => {
    const isPresentation = kind === 'apresentacao';
    const fallback = isPresentation ? 'Nova apresentação' : 'Nova comunicação';
    // Sem 2º argumento (Home / Biblioteca / Gerar): pede nome.
    // Com nome explícito (já perguntado na conta): não pergunta de novo.
    let name = projectName !== undefined ? String(projectName || '').trim() : '';
    if (projectName === undefined) {
      const ask = askPromptRef.current;
      if (typeof ask === 'function') {
        const answered = await ask({
          title: isPresentation ? 'Nome da apresentação' : 'Nome da comunicação',
          label: 'Como se chama este projeto?',
          placeholder: isPresentation ? 'Ex.: Pitch clínica' : 'Ex.: Clínica Janine',
          cta: 'Criar',
          defaultValue: '',
        });
        if (answered === null || answered === undefined) return false;
        name = String(answered).trim();
      }
    }
    const rosterBrand = brandRoster.find((b) => b.id === activeBrandId)
      || brandRoster[0]
      || brand;
    const identity = hydrateBrandTextColors({ ...rosterBrand });
    const presentationSeed = isPresentation
      ? applyPresentationVisualPresetToDoc({
          ...presentationDocPatch(),
          brand: identity,
          slides: [mkSlide(1, identity)],
        }, DEFAULT_PRESENTATION_VISUAL_PRESET_ID, PRESENTATION_VISUAL_PRESETS, { initialize: true })
      : { brand: identity };
    newDoc(presentationSeed, name || fallback);
    return true;
  }, [brand, brandRoster, activeBrandId, newDoc]);

  /** Selecciona marca para produção (Home) sem sobrescrever o projeto aberto. */
  const selectBrandForProduction = useCallback((brandId) => {
    if (!brandId || !brandRoster.some((b) => b.id === brandId)) return;
    setActiveBrandId(brandId);
  }, [brandRoster]);

  /** Actualiza o contexto default (brief/estilo) de um perfil de marca. */
  const saveBrandContext = useCallback((brandId, styleKit) => {
    setBrandRoster((prev) => prev.map((b) => (
      b.id === brandId
        ? { ...b, styleKit: {
          stylePrompt: String(styleKit?.stylePrompt || '').slice(0, 4000),
          contextMd: String(styleKit?.contextMd || '').slice(0, 48000),
          refImages: Array.isArray(styleKit?.refImages) ? styleKit.refImages : (b.styleKit?.refImages || []),
          logoOnGenerate: styleKit?.logoOnGenerate === false ? false : true,
          ...(styleKit?.logo ? { logo: styleKit.logo } : (b.styleKit?.logo ? { logo: b.styleKit.logo } : {})),
          ...(styleKit?.name ? { name: String(styleKit.name).slice(0, 60) } : {}),
        } }
        : b
    )));
  }, []);

  useEffect(() => {
    if (!activeEntry?.id) return;
    const currentName = String(activeEntry.name || '').trim();
    if (activeProductKind === 'apresentacao' && ['Novo carrossel', 'Nova comunicação'].includes(currentName)) {
      renameDoc(activeEntry.id, 'Nova apresentação');
    } else if (activeProductKind === 'carrossel' && currentName === 'Nova apresentação') {
      renameDoc(activeEntry.id, 'Nova comunicação');
    }
  }, [activeEntry?.id, activeEntry?.name, activeProductKind, renameDoc]);

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
    const fallbackBrand = hydrateBrandTextColors({ ...DEFAULT_BRAND });
    setLibrary((current) => current.map((entry) => (
      entry?.doc?.brand?.id === brandId
        ? { ...entry, doc: { ...entry.doc, brand: { ...fallbackBrand } } }
        : entry
    )));
    if (doc.brand?.id === brandId) {
      history.set((current) => ({ ...current, brand: { ...fallbackBrand } }));
    }
    if (brandId === activeBrandId) setActiveBrandId('default');
  }, [activeBrandId, brandRoster, doc.brand?.id, history, setLibrary]);
  // Salva o brand do doc atual como um perfil novo na "estante"
  const saveCurrentBrandAsProfile = useCallback((name) => {
    const kit = doc.styleKit && typeof doc.styleKit === 'object' ? doc.styleKit : null;
    const newBrand = {
      ...doc.brand,
      id: uid(),
      name: name || `Perfil ${brandRoster.length + 1}`,
      // Contexto do projeto actual vira o default da marca (herdado em projetos novos).
      ...(kit ? { styleKit: {
        stylePrompt: String(kit.stylePrompt || ''),
        contextMd: String(kit.contextMd || ''),
        refImages: Array.isArray(kit.refImages) ? kit.refImages : [],
        logoOnGenerate: kit.logoOnGenerate !== false,
        ...(kit.logo ? { logo: kit.logo } : {}),
        ...(kit.name ? { name: kit.name } : {}),
      } } : {}),
    };
    upsertBrand(newBrand);
    // O perfil selecionado e o perfil gravado no projeto precisam mudar na
    // mesma ação. Caso contrário, o sincronizador por projeto restaura o ID
    // antigo no render seguinte.
    history.set((current) => ({ ...current, brand: hydrateBrandTextColors(newBrand) }));
    setActiveBrandId(newBrand.id);
    return newBrand;
  }, [doc.brand, doc.styleKit, brandRoster.length, history, upsertBrand]);

  const editorSyncStateRef = useRef({ doc, activeDocId, activeBrandId });
  editorSyncStateRef.current = { doc, activeDocId, activeBrandId };

  /** Grava agora, sem esperar os debounces do autosave. Devolve a biblioteca gravada. */
  const flushPersistNow = useCallback(({ requireSaved = false, returnSnapshot = false } = {}) => {
    if (!accountLibraryReadyRef.current || areAccountDataWritesLocked()) {
      if (requireSaved || returnSnapshot) throw new Error('A biblioteca ainda está sendo restaurada. Aguarde e tente novamente.');
      return libraryPersistRef.current || [];
    }
    // A edição pendente já entra neste flush. Seu debounce antigo não pode
    // reaplicar o mesmo doc com outro updatedAt durante o pull.
    clearTimeout(docAutosaveTimerRef.current);
    const agora = Date.now();
    const lib = (libraryPersistRef.current || []).map((e) => (
      e.id === activeDocId && e.doc !== doc ? { ...e, doc, updatedAt: agora } : e
    ));
    libraryPersistRef.current = lib;
    const saved = [
      lsSet(SK.library, semImagensDeRuntime(lib)),
      lsSet(SK.libraryFolders, libraryFoldersPersistRef.current),
      lsSet(SK.activeDocId, activeDocId),
      lsSet(SK.brands, semLogosDeRuntimeDasMarcas(brandRoster)),
      lsSet(SK.activeBrandId, activeBrandId),
    ].every(Boolean);
    if (!saved && requireSaved) {
      throw new Error('Não foi possível gravar a biblioteca neste navegador. A sincronização não foi concluída.');
    }
    if (saved) setLastSavedAt(agora);
    if (returnSnapshot) {
      const documentFingerprint = JSON.stringify(semImagensDeRuntime([{ doc }])[0].doc);
      const libraryFingerprint = JSON.stringify(semImagensDeRuntime(lib));
      const foldersFingerprint = JSON.stringify(libraryFoldersPersistRef.current);
      const brandsFingerprint = JSON.stringify(semLogosDeRuntimeDasMarcas(brandRoster));
      return {
        snapshot: { library: lib, deletedIds: readDeletedProjectIds(), brandRoster, libraryFolders: libraryFoldersPersistRef.current, activeDocId, activeBrandId },
        localPersisted: saved,
        isCurrent: () => {
          const current = editorSyncStateRef.current;
          return current.activeDocId === activeDocId
            && current.activeBrandId === activeBrandId
            && JSON.stringify(semImagensDeRuntime([{ doc: current.doc }])[0].doc) === documentFingerprint
            && JSON.stringify(semImagensDeRuntime(libraryPersistRef.current)) === libraryFingerprint
            && JSON.stringify(libraryFoldersPersistRef.current) === foldersFingerprint
            && JSON.stringify(semLogosDeRuntimeDasMarcas(brandRosterPersistRef.current)) === brandsFingerprint;
        },
      };
    }
    return lib;
  }, [doc, activeDocId, brandRoster, activeBrandId]);
  flushPersistRef.current = flushPersistNow;

  const applyCloudLibrarySnapshot = useCallback((snapshot, result) => {
    if (!Array.isArray(snapshot?.library) || snapshot.library.length !== Number(result?.projectCount)) {
      throw new Error('A lista recebida não corresponde à biblioteca da nuvem. Tente sincronizar novamente.');
    }
    rememberDeletedProjectIds(snapshot.deletedIds || []);
    const folders = normalizeLibraryFolders(snapshot.libraryFolders || []);
    const restored = snapshot.library.map((entry) => normalizeLibraryEntry({
      ...entry, doc: ensureDocShape(entry.doc || {}),
    }, folders));
    const nextActiveId = restored.some((entry) => entry.id === snapshot.activeDocId)
      ? snapshot.activeDocId : (restored[0]?.id || null);
    const nextDoc = restored.find((entry) => entry.id === nextActiveId)?.doc || DEFAULT_DOC;
    const roster = snapshot.brandRoster?.length
      ? snapshot.brandRoster.map(hydrateBrandTextColors)
      : [hydrateBrandTextColors({ ...DEFAULT_BRAND })];

    // O pull mantém o storage protegido até todos os estados e refs apontarem
    // para a mesma lista. Só então pagehide e autosave podem gravar novamente.
    lockAccountDataWrites();
    flushSync(() => {
      libraryPersistRef.current = restored;
      libraryFoldersPersistRef.current = folders;
      brandRosterPersistRef.current = roster;
      setLibrary(restored);
      setLibraryFolders(folders);
      setBrandRoster(roster);
      setActiveDocId(nextActiveId);
      setActiveBrandId(snapshot.activeBrandId || nextDoc.brand?.id || 'default');
      history.reset(nextDoc);
      setLastSavedAt(Date.now());
    });
    unlockAccountDataWrites();
    return restored.length;
  }, [history.reset]);

  // Salvar e Sync usam a mesma transação: flush → merge → pull → React → toast.
  // O ref bloqueia também dois cliques antes de o estado busy renderizar.
  const syncProjectLibrary = useCallback(async (source = 'sync') => {
    if (cloudSyncInFlightRef.current) return;
    cloudSyncInFlightRef.current = true;
    setCloudSyncBusy(true);
    let localSaved = false;
    try {
      await stopCloudAutoPush();
      const pending = flushPersistNow({ returnSnapshot: true });
      const lib = pending.snapshot.library;
      setLibrary(lib);
      localSaved = pending.localPersisted;
      const owner = readDataOwner();
      const session = accessSessionRef.current;
      const owners = [...new Set([owner, ...dataOwnerAliases(session?.email, session?.customerId)].filter(Boolean))];
      await snapshotAccountVaultForOwners(owners, { snapshot: pending.snapshot });

      const { pushLibraryToCloud } = await import('./src/utils/library-sync.js');
      const result = await pushLibraryToCloud({
        force: true,
        allowShrink: false,
        pullAfter: true,
        snapshot: pending.snapshot,
        beforeApply: () => {
          if (!pending.isCurrent()) {
            // Inclui texto digitado há menos de 400 ms, ainda fora do storage.
            setLibrary(flushPersistRef.current());
            throw new Error('Você editou um projeto durante a sincronização. As alterações foram preservadas; salve novamente.');
          }
        },
      });
      if (!result?.ok || result.pullError || !result.snapshot) {
        throw new Error(result?.pullError || 'Não foi possível confirmar a lista completa da conta. Tente sincronizar novamente.');
      }
      const count = applyCloudLibrarySnapshot(result.snapshot, result);
      // O cofre do logout também deve conter a união restaurada da nuvem.
      await snapshotAccountVaultForOwners(owners, { snapshot: result.snapshot });
      trackEvent('library_cloud_push', { project_count: String(count), source });
      const photosPending = Number(result.assetsFailed || 0) + Number(result.assetsMissing || 0);
      const cachePending = result.localPersisted === false;
      toast(
        cachePending
          ? `Lista atualizada: ${count} projeto(s). ${photosPending ? 'Algumas fotos ainda não foram confirmadas na nuvem.' : 'Cópia confirmada na nuvem.'} O navegador continua sem espaço para a cópia local.`
          : photosPending
          ? `Lista sincronizada: ${count} projeto(s). Algumas fotos estão indisponíveis; os textos foram restaurados.`
          : `${source === 'salvar' ? 'Projeto salvo na sua conta' : 'Lista sincronizada'} · ${count} projeto(s).`,
        photosPending || cachePending ? 'warning' : 'success',
        photosPending || cachePending ? 6500 : 3500,
      );
    } catch (e) {
      toast(
        `${localSaved ? 'Projeto salvo neste navegador. ' : ''}Sincronização incompleta: ${e?.message || 'tente novamente.'}`,
        'warning',
        7000,
      );
    } finally {
      cloudSyncInFlightRef.current = false;
      setCloudSyncBusy(false);
    }
  }, [flushPersistNow, applyCloudLibrarySnapshot, stopCloudAutoPush, toast]);

  const salvarProjeto = useCallback(() => syncProjectLibrary('salvar'), [syncProjectLibrary]);

  // Autosave: salva o doc atual na entrada da biblioteca (debounced)
  useEffect(() => {
    if (!activeDocId || !accountLibraryReady) return;
    const t = setTimeout(() => {
      if (areAccountDataWritesLocked()) return;
      setLibrary(prev => prev.map(e => e.id === activeDocId
        ? { ...e, doc, updatedAt: Date.now() }
        : e
      ));
    }, 400);
    docAutosaveTimerRef.current = t;
    return () => clearTimeout(t);
  }, [doc, activeDocId, accountLibraryReady]);

  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedCardElement, setSelectedCardElement] = useState(null);
  const [editingTextArea, setEditingTextArea] = useState(null);
  useEffect(() => {
    setActiveIdx(0);
    setSelectedCardElement(null);
    setEditingTextArea(null);
  }, [activeDocId]);
  useEffect(() => {
    setActiveIdx((index) => Math.min(index, Math.max(0, slides.length - 1)));
  }, [slides.length]);
  const activeCardId = slides[activeIdx]?.id;
  useEffect(() => {
    // Clicar em um texto de outro card ativa o card e seleciona o texto juntos.
    setSelectedCardElement(current => current?.slideId === activeCardId ? current : null);
  }, [activeCardId]);
  const saveCustomVisualPreset = useCallback((label) => {
    const preset = createCustomVisualPreset({
      label,
      brand,
      slide: slides[activeIdx] || slides[0] || {},
      creativePreset,
      productKind: activeProductKind,
    });
    setCustomVisualPresets((current) => [...current, preset]);
    setVisualPreset(preset.id);
    toast(`Padrão “${preset.label}” salvo na biblioteca visual.`, 'success', 5200);
    trackEvent('custom_visual_preset_saved', { preset: preset.id });
  }, [activeIdx, activeProductKind, brand, creativePreset, setVisualPreset, slides, toast]);
  /**
   * Quadro do desktop: os cards ficam numa fila que rola na horizontal. Clicar
   * numa miniatura só mudava `activeIdx` — o quadro não andava, então a partir
   * do 5.º card o slide selecionado ficava fora da janela sem nenhuma pista de
   * como chegar lá. Aqui trazemos o card ativo para a vista.
   */
  const boardScrollRef = useRef(null);
  const boardCardRefs = useRef([]);
  const thumbnailStripRef = useRef(null);
  const thumbnailRefs = useRef([]);
  const [tab, setTab] = useState('home');
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

  // Um projeto novo pode começar no mesmo índice do anterior (normalmente 0).
  // Nesse caso o efeito acima não dispara e a fila conserva o scrollLeft antigo,
  // abrindo o deck com os primeiros slides escondidos. A identidade do primeiro
  // slide também muda ao gerar novamente no mesmo projeto, por isso participa da
  // dependência.
  useLayoutEffect(() => {
    const quadro = boardScrollRef.current;
    if (quadro) quadro.scrollTo({ left: 0, behavior: 'auto' });
    const faixa = thumbnailStripRef.current;
    if (faixa) faixa.scrollTo({ left: 0, behavior: 'auto' });
  }, [activeDocId, slides[0]?.id]);

  // A miniatura ativa precisa acompanhar a navegação em decks longos.
  useEffect(() => {
    const faixa = thumbnailStripRef.current;
    const alvo = thumbnailRefs.current[activeIdx];
    if (!faixa || !alvo) return;
    const left = alvo.offsetLeft;
    const right = left + alvo.offsetWidth;
    if (left >= faixa.scrollLeft && right <= faixa.scrollLeft + faixa.clientWidth) return;
    faixa.scrollTo({
      left: Math.max(0, left - (faixa.clientWidth - alvo.offsetWidth) / 2),
      behavior: 'smooth',
    });
  }, [activeIdx, activeDocId, slides.length]);

  /** QA: simula leitura à distância do polegar (tipo menor no preview). */
  const [thumbQaMode, setThumbQaMode] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupProductKind, setSetupProductKind] = useState(activeProductKind);
  const openGenerationSetup = useCallback((kind = activeProductKind) => {
    const normalizedKind = kind === 'apresentacao' ? 'apresentacao' : 'carrossel';
    setSetupProductKind(normalizedKind);
    setSetupOpen(true);
  }, [activeProductKind]);
  const generateProjectByKind = useCallback(async (kind = activeProductKind) => {
    const normalizedKind = kind === 'apresentacao' ? 'apresentacao' : 'carrossel';
    // A Home é também a porta de criação. Se o pedido troca o tipo de produto,
    // abre um destino próprio antes do wizard para não transformar/apagar o
    // projeto que estava aberto.
    if (normalizedKind !== activeProductKind) {
      const created = await createProjectByKind(normalizedKind);
      if (created === false) return;
    }
    openGenerationSetup(normalizedKind);
  }, [activeProductKind, createProjectByKind, openGenerationSetup]);
  const setSetupOpenForSidebar = useCallback((open, kind = activeProductKind) => {
    if (open) openGenerationSetup(kind);
    else setSetupOpen(false);
  }, [activeProductKind, openGenerationSetup]);
  const [researchOpen, setResearchOpen] = useState(false);
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
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
    refreshImageUsage,
    completeLanding,
    reopenLanding,
    openPortal,
    handleLogout,
  } = useAccess({
    setShellView,
    onLeaveEditor: () => setDrawerOpen(false),
    onBeforeLogout: async () => {
      await stopCloudAutoPush();
      const pending = flushPersistRef.current({ returnSnapshot: true });
      setLibrary(pending.snapshot.library);
      return pending;
    },
    onCloudLibraryApplied: applyCloudLibrarySnapshot,
    onLibraryReady: markAccountLibraryReady,
    onLibraryBlocked: setAccountRestoreError,
    toast,
  });
  accessSessionRef.current = access;
  const handleSyncCloud = useCallback(() => {
    if (!access?.active) {
      toast('Entre na conta para sincronizar seus projetos.', 'warning', 4500);
      return;
    }
    return syncProjectLibrary('sync');
  }, [access?.active, syncProjectLibrary, toast]);
  // Auto-push na nuvem ~4s após editar a biblioteca (não depende só do logout).
  const cloudAutoPushTimerRef = useRef(null);
  const cloudAutoPushSkipFirstRef = useRef(true);
  useEffect(() => {
    if (!access?.active || !accountLibraryReady || cloudSyncBusy) return undefined;
    if (cloudAutoPushSkipFirstRef.current) {
      cloudAutoPushSkipFirstRef.current = false;
      return undefined;
    }
    if (areAccountDataWritesLocked()) return undefined;
    if (cloudAutoPushTimerRef.current) clearTimeout(cloudAutoPushTimerRef.current);
    const controller = new AbortController();
    cloudAutoPushTimerRef.current = setTimeout(() => {
      import('./src/utils/library-sync.js')
        .then(async ({ pushLibraryToCloudBestEffort }) => {
          if (controller.signal.aborted || areAccountDataWritesLocked() || cloudSyncInFlightRef.current) return;
          await stopCloudAutoPush();
          if (controller.signal.aborted || areAccountDataWritesLocked() || cloudSyncInFlightRef.current) return;
          const pending = flushPersistRef.current({ returnSnapshot: true });
          const task = { controller, promise: pushLibraryToCloudBestEffort(12_000, {
            snapshot: pending.snapshot, signal: controller.signal,
          }) };
          cloudAutoPushRef.current = task;
          try { await task.promise; }
          finally { if (cloudAutoPushRef.current === task) cloudAutoPushRef.current = null; }
        })
        .catch(() => {});
    }, 4_000);
    return () => {
      controller.abort();
      if (cloudAutoPushTimerRef.current) clearTimeout(cloudAutoPushTimerRef.current);
    };
  }, [library, access?.active, accountLibraryReady, cloudSyncBusy, stopCloudAutoPush]);
  const [tourOpen, setTourOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  /** Índice do card cuja legenda está aberta no painel (null = fechado). */
  const [captionEditorIdx, setCaptionEditorIdx] = useState(null);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [imgPrompt, setImgPrompt] = useState({ open:false, mode:null, defaultValue:'' });
  const [imageCropOpen, setImageCropOpen] = useState(false);
  const [photoPositionOpen, setPhotoPositionOpen] = useState(false);
  const { aiSettings, setAISettings, openaiKey, anthropicKey } = useAiSettings();
  // Biblioteca de hooks aprovados (B2)
  const [hookLibrary, setHookLibrary] = useState(() => lsGet(SK.hookLibrary, []));
  // FASE 2 Narrative OS: Sistema de Modos (Criador/Diretor/Studio).
  // Default Criador até a sessão estar resolvida — evita herdar o modo do
  // utilizador anterior no mesmo browser antes do logout limpar (FE-015).
  const [appMode, setAppModeState] = useState('criador');
  const appModeHydratedRef = useRef(false);
  useEffect(() => {
    if (appModeHydratedRef.current) return;
    if (access.status === 'loading') return;
    appModeHydratedRef.current = true;
    if (!access.active) return;
    const saved = lsGet(SK.appMode, 'criador');
    if (['criador', 'diretor', 'studio'].includes(saved)) setAppModeState(saved);
  }, [access.status, access.active]);
  const setAppMode = useCallback((next) => {
    if (!['criador', 'diretor', 'studio'].includes(next)) return;
    setAppModeState(next);
    // Nunca deixe ativa uma aba que o modo recém-selecionado esconde.
    setTab((current) => (
      visibleEditorTabs(next).some(({ id }) => id === current) ? current : 'home'
    ));
    lsSet(SK.appMode, next);
    trackEvent('app_mode_change', { mode: next });
  }, []);
  const creatorIdentitySnapshot = useMemo(() => ({
    name: brand.name,
    handle: brand.handle,
    bio: brand.bio,
    positioning: brand.positioning,
    defaultTone: brand.defaultTone,
    defaultAudience: brand.defaultAudience,
    signature: brand.signature,
    brandTone: brand.brandTone,
    useBrandVoice: brand.useBrandVoice !== false,
    voiceSourceUrls: brand.voiceSourceUrls,
    voiceSampleText: brand.voiceSampleText,
    voiceImageTexts: brand.voiceImageTexts,
    logo: brand.logo,
    logoImageId: brand.logoImageId,
    logoPosition: brand.logoPosition,
    logoSize: brand.logoSize,
    logoOpacity: brand.logoOpacity,
  }), [
    brand.name, brand.handle, brand.bio, brand.positioning, brand.defaultTone,
    brand.defaultAudience, brand.signature, brand.brandTone, brand.useBrandVoice,
    brand.voiceSourceUrls, brand.voiceSampleText, brand.voiceImageTexts, brand.logo, brand.logoImageId, brand.logoPosition,
    brand.logoSize, brand.logoOpacity,
  ]);
  const creatorIdentitySyncRef = useRef({ projectId: null, serialized: '' });
  const skipCreatorIdentitySyncRef = useRef(false);
  useEffect(() => {
    const projectId = activeEntry?.id || null;
    const serialized = JSON.stringify(creatorIdentitySnapshot);
    if (creatorIdentitySyncRef.current.projectId !== projectId) {
      creatorIdentitySyncRef.current = { projectId, serialized };
      return;
    }
    if (skipCreatorIdentitySyncRef.current) {
      skipCreatorIdentitySyncRef.current = false;
      creatorIdentitySyncRef.current = { projectId, serialized };
      return;
    }
    if (creatorIdentitySyncRef.current.serialized === serialized) return;
    creatorIdentitySyncRef.current = { projectId, serialized };
    if (appMode !== 'criador' || !activeBrandId || (brand.id && brand.id !== activeBrandId)) return;
    setBrandRoster((currentRoster) => {
      const index = currentRoster.findIndex((item) => item.id === activeBrandId);
      if (index < 0) return currentRoster;
      const current = currentRoster[index];
      const changed = Object.entries(creatorIdentitySnapshot).some(([key, value]) => (
        key === 'brandTone' || key === 'voiceSourceUrls' || key === 'voiceImageTexts'
          ? JSON.stringify(current[key] ?? null) !== JSON.stringify(value ?? null)
          : current[key] !== value
      ));
      if (!changed) return currentRoster;
      const nextRoster = [...currentRoster];
      nextRoster[index] = hydrateBrandTextColors({
        ...current,
        ...creatorIdentitySnapshot,
        id: current.id,
      });
      return nextRoster;
    });
  }, [appMode, activeBrandId, activeEntry?.id, creatorIdentitySnapshot]);
  // Modal de boas-vindas dos 3 modos — só na 1.ª visita da conta (nunca a cada geração).
  const [modesIntroOpen, setModesIntroOpen] = useState(false);
  const modesIntroScheduledRef = useRef(false);
  const bootProjectsRef = useRef(null);
  if (bootProjectsRef.current === null) {
    const persistedLibrary = lsGet(SK.library, null);
    const legacyDoc = lsGet(SK.legacyDoc, null);
    const hadSavedProjects = (Array.isArray(persistedLibrary) && persistedLibrary.length > 0)
      || !!legacyDoc?.slides?.length;
    // `library` sempre contém um Carrossel de exemplo, mesmo no primeiro acesso.
    // Guardar o ID permite distinguir esse placeholder de projetos restaurados
    // da nuvem quando o carregamento da conta terminar.
    bootProjectsRef.current = {
      hadSavedProjects,
      placeholderId: hadSavedProjects ? null : library[0]?.id,
    };
  }
  const hadProjectsAtRestoreRef = useRef(null);
  if (accountLibraryReady && hadProjectsAtRestoreRef.current === null) {
    // A decisão de primeira visita pertence ao boot. Criar o primeiro projeto
    // nesta sessão não pode cancelá-la nem suprimir o tour da primeira geração.
    hadProjectsAtRestoreRef.current = bootProjectsRef.current.hadSavedProjects
      || library.some((entry) => entry.id !== bootProjectsRef.current.placeholderId);
  }
  const hadProjectsAtRestore = hadProjectsAtRestoreRef.current === true;
  useEffect(() => {
    if (typeof window === 'undefined' || landingOpen || !accountLibraryReady) return undefined;
    try {
      if (localStorage.getItem(SK.modesIntro)) return undefined;
      // Conta com projetos salvos ou restaurados — sem modal de primeira visita.
      if (hadProjectsAtRestore) {
        localStorage.setItem(SK.modesIntro, '1');
        localStorage.setItem(SK.onboarding, '1');
        return undefined;
      }
      if (!modesIntroScheduledRef.current) {
        modesIntroScheduledRef.current = true;
        let opened = false;
        const t = window.setTimeout(() => {
          opened = true;
          setModesIntroOpen(true);
        }, 600);
        return () => {
          window.clearTimeout(t);
          if (!opened) modesIntroScheduledRef.current = false;
        };
      }
    } catch { /* */ }
    return undefined;
  }, [landingOpen, accountLibraryReady, hadProjectsAtRestore]);
  // Identidade estável: como props inline, entravam nas deps do layout effect do
  // tour e realimentavam o ciclo render → effect → setState → render (React #185).
  const tourEnterEditor = useCallback(() => setShellView('project'), [setShellView]);
  const tourPrepareRefsStep = useCallback(() => {
    openGenerationSetup('carrossel');
  }, [openGenerationSetup]);
  const closeModesIntro = useCallback(() => {
    setModesIntroOpen(false);
    try { localStorage.setItem(SK.modesIntro, '1'); } catch { /* */ }
  }, []);
  useEffect(() => { lsSet(SK.hookLibrary, hookLibrary); }, [hookLibrary]);
  // ── IMAGENS — bytes em IndexedDB, object URL em runtime ─────────────────────
  // O documento guarda `bgImageId`; `bgImage` é recriado a cada load. Também
  // migramos aqui as data URLs de projetos antigos: ficavam no localStorage e
  // eram apagadas quando a quota enchia.
  // Mapa id → object URL. NÃO é um marcador de "já feito": no boot o
  // `history.reset` troca o documento depois de o patch entrar, logo a hidratação
  // tem de poder repetir-se. Com o mapa, repetir é de graça (sem ler o disco).
  const imagemUrlsRef = useRef(new Map());
  const legacyBrandLogoJobsRef = useRef(new Set());
  useEffect(() => {
    const targets = (brandRoster || []).filter((profile) => (
      !profile?.logoImageId
      && typeof profile?.logo === 'string'
      && profile.logo.startsWith('data:image/png;base64,')
    ));
    for (const profile of targets) {
      const portableLogo = profile.logo;
      const jobKey = `${profile.id || 'sem-id'}:${portableLogo.length}:${portableLogo.slice(-24)}`;
      if (legacyBrandLogoJobsRef.current.has(jobKey)) continue;
      legacyBrandLogoJobsRef.current.add(jobKey);
      (async () => {
        const blob = dataUrlParaBlob(portableLogo);
        if (!blob) return;
        const stored = await storeSlideLogo(blob);
        if (!stored.logoImageId) return; // PNG já persistível no documento; não repetir a mesma migração.
        imagemUrlsRef.current.set(stored.logoImageId, stored.logoImage);
        setBrandRoster((current) => current.map((item) => (
          item?.id === profile.id && item.logo === portableLogo && !item.logoImageId
            ? { ...item, logo: stored.logoImage, logoImageId: stored.logoImageId }
            : item
        )));
        history.setSilent((current) => {
          if (
            current.brand?.id !== profile.id
            || current.brand?.logo !== portableLogo
            || current.brand?.logoImageId
          ) return current;
          skipCreatorIdentitySyncRef.current = true;
          return {
            ...current,
            brand: {
              ...current.brand,
              logo: stored.logoImage,
              logoImageId: stored.logoImageId,
            },
          };
        });
      })().catch(() => {}).finally(() => {
        legacyBrandLogoJobsRef.current.delete(jobKey);
      });
    }
  }, [brandRoster, history.setSilent]);

  useEffect(() => {
    const projectId = activeEntry?.id;
    const portableLogo = typeof brand.logo === 'string' ? brand.logo : '';
    const rosterWillMigrate = (brandRoster || []).some((profile) => (
      profile?.id === brand.id
      && !profile.logoImageId
      && profile.logo === portableLogo
    ));
    if (
      rosterWillMigrate
      || brand.logoImageId
      || !portableLogo.startsWith('data:image/png;base64,')
    ) return undefined;
    let cancelled = false;
    (async () => {
      const blob = dataUrlParaBlob(portableLogo);
      if (!blob) return;
      const stored = await storeSlideLogo(blob);
      if (!stored.logoImageId) return;
      if (cancelled || activeProjectRef.current !== projectId) {
        URL.revokeObjectURL(stored.logoImage);
        return;
      }
      history.setSilent((current) => {
        if (current.brand?.logo !== portableLogo || current.brand?.logoImageId) {
          URL.revokeObjectURL(stored.logoImage);
          return current;
        }
        skipCreatorIdentitySyncRef.current = true;
        imagemUrlsRef.current.set(stored.logoImageId, stored.logoImage);
        return {
          ...current,
          brand: {
            ...current.brand,
            logo: stored.logoImage,
            logoImageId: stored.logoImageId,
          },
        };
      });
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [activeEntry?.id, brand.id, brand.logo, brand.logoImageId, brandRoster, history.setSilent]);

  useEffect(() => {
    const projectId = activeEntry?.id;
    // A logo do kit é uma biblioteca por projeto e só vira padrão global
    // quando a marca aponta para ela. Isto mantém “aplicar neste card” isolado.
    // O fallback migra apenas o formato antigo, que guardava ID no kit e a
    // mesma imagem em base64 na marca.
    const logoImageId = brand.logoImageId;
    if (!logoImageId || (brand.logo && String(brand.logo).startsWith('blob:'))) return undefined;
    let cancelled = false;
    (async () => {
      let url = imagemUrlsRef.current.get(logoImageId);
      if (!url) {
        const entry = await imageGet(logoImageId);
        if (!entry?.blob) return;
        url = URL.createObjectURL(entry.blob);
        imagemUrlsRef.current.set(logoImageId, url);
      }
      if (cancelled || activeProjectRef.current !== projectId) return;
      history.setSilent((current) => {
        const currentId = current.brand?.logoImageId;
        if (currentId !== logoImageId || current.brand?.logo === url) return current;
        skipCreatorIdentitySyncRef.current = true;
        return {
          ...current,
          brand: { ...current.brand, logo: url, logoImageId },
        };
      });
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [activeEntry?.id, brand.logo, brand.logoImageId, history.setSilent]);

  useEffect(() => {
    let cancelled = false;
    const targets = slides.filter(sl => sl.logoImageId && !sl.logoImage);
    if (!targets.length) return;
    Promise.all(targets.map(async sl => {
      let url = imagemUrlsRef.current.get(sl.logoImageId);
      if (!url) {
        const entry = await imageGet(sl.logoImageId);
        if (!entry?.blob) return null;
        url = URL.createObjectURL(entry.blob);
        imagemUrlsRef.current.set(sl.logoImageId, url);
      }
      return { id: sl.id, imageId: sl.logoImageId, url };
    })).then(patches => {
      if (cancelled || !patches.some(Boolean)) return;
      history.setSilent(d => {
        let changed = false;
        const next = d.slides.map(sl => {
          const patch = patches.find(p => p?.id === sl.id && p.imageId === sl.logoImageId);
          if (!patch || sl.logoImage) return sl;
          changed = true;
          return { ...sl, logoImage: patch.url };
        });
        return changed ? { ...d, slides: next } : d;
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [slides, activeEntry?.id, history.setSilent]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const alvo = (slidesLiveRef.current || []).map((sl) => ({ sl, id: sl.id }));
      const paraMigrar = alvo.filter(({ sl }) => typeof sl.bgImage === 'string' && sl.bgImage.startsWith('data:') && !sl.bgImageId);
      const paraHidratar = alvo.filter(({ sl }) => sl.bgImageId && !sl.bgImage);
      if (!paraMigrar.length && !paraHidratar.length) return;

      const patches = [];
      for (const { sl, id } of paraMigrar) {
        try {
          const patch = await guardarImagemDoSlide(sl.bgImage);
          if (patch.bgImageId) {
            imagemUrlsRef.current.set(patch.bgImageId, patch.bgImage);
            patches.push({ id, expectedImageId: null, expectedSource: sl.bgImage, patch });
          }
        } catch (e) { console.warn('[imagem] migração falhou:', e?.message || e); }
      }
      for (const { sl, id } of paraHidratar) {
        const cache = imagemUrlsRef.current.get(sl.bgImageId);
        if (cache) {
          patches.push({ id, expectedImageId: sl.bgImageId, patch: { bgImage: cache, bgImageFailed: false, bgImageError: null } });
          continue;
        }
        try {
          const entry = await Promise.race([
            imageGet(sl.bgImageId),
            new Promise((_, reject) => setTimeout(() => reject(new Error('hydrate timeout')), 8_000)),
          ]);
          if (entry?.blob) {
            const url = URL.createObjectURL(entry.blob);
            imagemUrlsRef.current.set(sl.bgImageId, url);
            patches.push({ id, expectedImageId: sl.bgImageId, patch: { bgImage: url, bgImageFailed: false, bgImageError: null } });
          } else {
            // Um ID sem bytes no IndexedDB deixava o slide num limbo: parecia
            // sem imagem e também era excluído do lote de reparação para sempre.
            patches.push({
              id,
              expectedImageId: sl.bgImageId,
              patch: {
                bgImage: null,
                bgImageId: null,
                bgImageFailed: true,
                bgImageError: 'stored_image_missing',
              },
            });
          }
        } catch (e) {
          console.warn('[imagem] leitura falhou:', e?.message || e);
          // Timeout/bloqueio: tirar do spinner eterno. O utilizador reimporta.
          patches.push({
            id,
            expectedImageId: sl.bgImageId,
            patch: {
              bgImageFailed: true,
              bgImageError: e?.message?.includes('timeout') ? 'hydrate_timeout' : 'stored_image_unavailable',
            },
          });
        }
      }
      if (cancelado || !patches.length) return;
      // `setSilent`: hidratar não é edição do utilizador, não entra no undo.
      history.setSilent((d) => {
        const slidesAtuais = d.slides || [];
        const proximos = applyPersistedImagePatches(slidesAtuais, patches);
        return proximos === slidesAtuais ? d : { ...d, slides: proximos };
      });
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId, slides]);

  // Migra moodboards antigos sem substituir edições feitas enquanto o disco grava.
  useEffect(() => {
    const projectId = activeEntry?.id;
    const source = doc.styleKit;
    if (!(source?.refImages || []).some(r => r.dataUrl && !r.imageId) && !source?.logo?.dataUrl) return;
    let cancelled = false;
    migrateProjectReferences(source).then(migrated => {
      if (cancelled || activeProjectRef.current !== projectId) return;
      // O fallback mantém o PNG portátil; isso não é uma nova edição do kit.
      if (JSON.stringify(migrated) === JSON.stringify(source)) return;
      history.setSilent(current => current.styleKit === source ? { ...current, styleKit: migrated } : current);
    }).catch(() => toast('As referências antigas ainda não puderam ser migradas. Exporte um backup antes de limpar o navegador.', 'warning'));
    return () => { cancelled = true; };
  }, [activeEntry?.id, doc.styleKit]);

  // Referências antigas também saem do JSON. Só removemos os bytes embutidos
  // após confirmar o IndexedDB; edições feitas durante a migração prevalecem.
  const referenceMigrationsRef = useRef(new Map());
  useEffect(() => {
    if (!accountLibraryReady || areAccountDataWritesLocked()) return;
    const owner = readDataOwner();
    for (const entry of library) {
      for (const slide of entry.doc?.slides || []) {
        if (!slide.refImage?.startsWith('data:image/')) continue;
        const key = `${entry.id}:${slide.id}`;
        if (referenceMigrationsRef.current.get(key) === slide.refImage) continue;
        referenceMigrationsRef.current.set(key, slide.refImage);
        importSlideReference(slide).then(migrated => {
          if (migrated === slide || readDataOwner() !== owner || areAccountDataWritesLocked()) return;
          const patchSlide = current => current.id === slide.id && current.refImage === slide.refImage
            && current.refImageId === slide.refImageId
            ? { ...current, refImage: null, refImageId: migrated.refImageId, refImageFailed: false, refImageError: null }
            : current;
          setLibrary(current => current.map(project => project.id === entry.id
            ? { ...project, doc: { ...project.doc, slides: project.doc.slides.map(patchSlide) } }
            : project));
          if (editorSyncStateRef.current.activeDocId === entry.id) {
            history.setSilent(current => ({ ...current, slides: current.slides.map(patchSlide) }));
          }
        }).catch(() => { /* A cópia original permanece no documento. */ });
      }
    }
  }, [library, accountLibraryReady, history.setSilent]);

  // Limpeza das imagens que nenhum projeto referencia.
  // Duas passagens: cedo (após boot) e tarde (após imports/edits) — FE-011.
  useEffect(() => {
    const run = async () => {
      try {
        const inUse = new Set(idsDeImagemEmUso(
          libraryPersistRef.current,
          brandRosterPersistRef.current,
        ));
        for (const id of await getAccountVaultImageIds()) inUse.add(id);
        for (const id of idsDeImagemEmUso([{ doc: editorSyncStateRef.current.doc }], [])) inUse.add(id);
        const removidas = await imageCleanupOrphans([...inUse]);
        if (removidas > 0) console.log(`[imagem] limpeza: ${removidas} imagem(ns) órfã(s) removida(s)`);
      } catch { /* IndexedDB indisponível */ }
    };
    const t1 = setTimeout(run, 8_000);
    const t2 = setTimeout(run, 5 * 60_000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // A biblioteca ainda está vazia durante o restore e o cofre durável pode
  // referenciar vídeos ausentes da lista ativa. Sem índice de refs do cofre,
  // um GC automático destruiria a única cópia local desses arquivos.
  // Revogar todas as object URLs quando o componente desmonta (raro mas correto)
  useEffect(() => () => {
    Object.values(videoUrlsRef.current).forEach(url => {
      try { URL.revokeObjectURL(url); } catch { /* */ }
    });
    imagemUrlsRef.current.forEach((url) => {
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
  const generationRef = useRef(null);
  const slideImgGenIdsRef = useRef(new Set());
  const [slideImgGenBusy, setSlideImgGenBusy] = useState({});
  // Progresso da geração (texto + imagens) — exibido como barra fixa enquanto roda
  const [genProgress, setGenProgress] = useState(null); // null | { phase, current, total, label }
  /** Cancela import de fotos em curso (lote / foto única). */
  const importAbortRef = useRef(null);
  // O drawer mobile e a sidebar desktop desmontam ao mudar a largura da tela.
  // Mantém o pedido no editor para não perdê-lo ao girar o celular/cancelar.
  const [quickPrompt, setQuickPrompt] = useState('');
  const cancelGeneration = useCallback(() => {
    if (imgGenAbortRef.current) imgGenAbortRef.current.cancelled = true;
    if (importAbortRef.current) importAbortRef.current.cancelled = true;
    generationRef.current?.cancel();
    cancelAllAIGeneration();
    generationRef.current = null;
    setGenProgress(null);
    slideImgGenIdsRef.current.clear();
    setSlideImgGenBusy({});
    setAnalyzingBrandTone(false);
    setRefining(false);
    setGenCaption(false);
    toast('Operação cancelada. O que já foi concluído foi mantido.', 'info');
  }, [toast]);
  useEffect(() => {
    setQuickPrompt(
      typeof activeEntry?.doc?.quickPromptDraft === 'string'
        ? activeEntry.doc.quickPromptDraft
        : '',
    );
    lastGenerateArgsRef.current = null;
    setHasLastGenerate(false);
    return () => {
      generationRef.current?.cancel();
      generationRef.current = null;
      if (imgGenAbortRef.current) imgGenAbortRef.current.cancelled = true;
      cancelAllAIGeneration();
      setGenProgress(null);
    };
  }, [activeEntry?.id]);
  useEffect(() => {
    const projectId = activeEntry?.id;
    if (!projectId) return undefined;
    const timer = window.setTimeout(() => {
      if (activeProjectRef.current !== projectId) return;
      history.setSilent((current) => (
        (current.quickPromptDraft || '') === quickPrompt
          ? current
          : { ...current, quickPromptDraft: quickPrompt }
      ));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [activeEntry?.id, history.setSilent, quickPrompt]);

  const [serverStatus, setServerStatus] = useState({ anthropic:false, openai:false, dev:false });
  const selectedTextProvider = aiSettings.textProvider;
  const selectedImageKeyProvider = aiSettings.imageProvider === 'zai' ? 'zai' : 'openai';
  const useOwnImageKey = !!aiSettings.useOwnImageKey;
  const hasByokImageKey =
    !!aiSettings.keys[selectedImageKeyProvider]?.trim() ||
    (selectedImageKeyProvider === 'openai' && IS_LOCAL_DEV && serverStatus.openai);
  const imageGenerationAvailability = useMemo(
    () => imageGenerationAccess({ access, useOwnImageKey, hasByokImageKey }),
    [access, useOwnImageKey, hasByokImageKey],
  );
  // Nome legado (`hasOpenAI`): pode gerar imagem (plataforma ou BYOK avançado).
  const hasOpenAI = imageGenerationAvailability.canGenerate;
  const hasAnthropic = !!anthropicKey;
  // Texto incluso no plano = Z.ai no servidor. Assinante não precisa de chave.
  const hasAnyAI =
    !!access.active
    || !!access.billingDisabled
    || !!aiSettings.keys[selectedTextProvider]
    || (selectedTextProvider === 'openai' && IS_LOCAL_DEV && serverStatus.openai)
    || (selectedTextProvider === 'zai');
  const [niche, setNiche] = useState('');
  useEffect(() => {
    // Nicho pertence ao briefing do projeto aberto. Limpar também é essencial:
    // sem isso, um projeto vazio herdava silenciosamente o nicho anterior.
    setNiche(String(activeEntry?.doc?.editorialContext?.niche || ''));
  }, [activeEntry?.id]);

  // Tour guiado — uma única vez por conta (1.ª geração). Depois só pela Ajuda.
  const tourScheduledRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || landingOpen || !accountLibraryReady || modesIntroOpen) return undefined;
    if (isDefault(slides)) return undefined;
    try {
      if (localStorage.getItem(SK.onboarding)) return undefined;
      // Reentrada com projetos salvos ou restaurados → não interromper.
      if (hadProjectsAtRestore) {
        localStorage.setItem(SK.onboarding, '1');
        localStorage.setItem(SK.modesIntro, '1');
        return undefined;
      }
      if (localStorage.getItem(SK.modesIntro) !== '1') return undefined;
      if (tourScheduledRef.current || tourOpen) return undefined;
      tourScheduledRef.current = true;
      let opened = false;
      const t = window.setTimeout(() => {
        opened = true;
        setTourOpen(true);
      }, 850);
      return () => {
        window.clearTimeout(t);
        if (!opened) tourScheduledRef.current = false;
      };
    } catch { /* ignore */ }
    return undefined;
  }, [landingOpen, accountLibraryReady, hadProjectsAtRestore, modesIntroOpen, slides, tourOpen]);
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
  const referenceUploadRef = useRef(0);
  const slideRefs = useRef({});
  const lastForeignWriteWarningRef = useRef(0);

  // Escuta eventos de quota do localStorage — disparados por lsSet quando o storage enche
  useEffect(() => {
    const onQuotaWarning  = (e) => toast(e.detail, 'warn', 8000);
    const onForeignWriteBlocked = () => {
      const now = Date.now();
      if (now - lastForeignWriteWarningRef.current < 10_000) return;
      lastForeignWriteWarningRef.current = now;
      toast('Outra aba está atualizando seus projetos. Esta alteração não foi salva; volte à aba mais recente antes de continuar.', 'warning', 8_000);
    };
    let warningId;
    const onQuotaExceeded = (e) => { warningId = toast(e.detail, 'error', 0); };
    const onQuotaRecovered = () => { if (warningId) dismissToast(warningId); };
    window.addEventListener('vc:quota-warning',  onQuotaWarning);
    window.addEventListener('vc:quota-exceeded', onQuotaExceeded);
    window.addEventListener('vc:quota-recovered', onQuotaRecovered);
    window.addEventListener('vc:account-write-blocked', onForeignWriteBlocked);
    return () => {
      window.removeEventListener('vc:quota-warning',  onQuotaWarning);
      window.removeEventListener('vc:quota-exceeded', onQuotaExceeded);
      window.removeEventListener('vc:quota-recovered', onQuotaRecovered);
      window.removeEventListener('vc:account-write-blocked', onForeignWriteBlocked);
    };
  }, [toast, dismissToast]);

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
      'family=Archivo:wght@400;500;600;700;800&' +
      'family=Archivo+Black&' +
      'family=Bebas+Neue&' +
      'family=Big+Shoulders+Display:wght@400;500;600;700;800;900&' +
      'family=Bricolage+Grotesque:wght@300;400;500;600;700&' +
      'family=Cormorant:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&' +
      'family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&' +
      'family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600&' +
      'family=DM+Sans:wght@300;400;500;600;700&' +
      'family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&' +
      'family=Familjen+Grotesk:wght@400;500;600;700&' +
      'family=Fraunces:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&' +
      'family=Funnel+Display:wght@300;400;500;600;700&' +
      'family=IBM+Plex+Mono:wght@300;400;500;600;700&' +
      'family=IBM+Plex+Sans:wght@300;400;500;600;700&' +
      'family=IBM+Plex+Sans+Condensed:wght@300;400;500;600;700&' +
      'family=Instrument+Serif:ital@0;1&' +
      'family=Inter:wght@300;400;500;600;700&' +
      'family=Inter+Tight:wght@300;400;500;600;700&' +
      'family=Italiana&' +
      'family=JetBrains+Mono:wght@400;500;600;700&' +
      'family=Jost:wght@300;400;500;600;700&' +
      'family=Libre+Caslon+Display&' +
      'family=Libre+Franklin:wght@300;400;500;600;700&' +
      'family=Major+Mono+Display&' +
      'family=Manrope:wght@300;400;500;600;700&' +
      'family=Montserrat:wght@300;400;500;600;700&' +
      'family=Oswald:wght@300;400;500;600;700&' +
      'family=Outfit:wght@300;400;500;600;700&' +
      'family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&' +
      'family=Plus+Jakarta+Sans:wght@300;400;500;600;700&' +
      'family=Poppins:wght@300;400;500;600;700&' +
      'family=Raleway:wght@300;400;500;600;700&' +
      'family=Sora:wght@300;400;500;600;700&' +
      'family=Source+Sans+3:wght@300;400;500;600;700&' +
      'family=Source+Serif+4:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&' +
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
  askPromptRef.current = askPrompt;
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
  /* A assinatura tem proporção natural: as ferramentas descem antes de
     comprimir a marca ou sobrepor Salvar e Projetos. */
  const headerTight = !isMobile && vw < 1536;
  /* <1000px: some o atalho "Projetos" do header (o rodapé já tem um igual). */
  const headerVeryTight = !isMobile && vw < 1000;
  const f = FORMATS[fmt] || FORMATS.carrossel;
  const previewScale = useMemo(() => {
    if (isMobile) {
      /* Margens laterais maiores para o texto não “escorrer” junto ao bezel / overscroll */
      const side = Math.max(16, vw * 0.04);
      const base = Math.min((vw - side * 2) / f.w, 0.92);
      return thumbQaMode ? base * 0.72 : base;
    }
    // No desktop, a apresentação é uma superfície de edição 16:9. Limitá-la à
    // mesma largura de uma miniatura 4:5 tornava texto, erros e zonas de imagem
    // praticamente ilegíveis. O alvo cresce com a área útil e mantém um limite
    // confortável para a fila horizontal.
    const targetWidth = fmt === 'apresentacao'
      ? Math.min(920, Math.max(720, (vw - 272) * 0.66))
      : 360;
    const base = Math.min(targetWidth / f.w, fmt === 'apresentacao' ? 0.5 : 0.44);
    return thumbQaMode ? Math.min(base * 0.7, 0.28) : base;
  }, [isMobile, vw, f, fmt, thumbQaMode]);

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

  /** Conta no extremo direito — padrão SaaS (avatar/conta à direita).
      Em tablets, mantém apenas o ícone para reservar espaço ao CTA central. */
  const editorAccountNav = !isMobile && (
    <nav aria-label="Conta" style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
      {headerVeryTight
        ? editorIconBtn({
            onClick: () => goAccount('profile'),
            title: 'Perfil',
            children: <User size={13} />,
          })
        : editorPillBtn(() => goAccount('profile'), 'Perfil', User)}
    </nav>
  );

  const editorGenerateBtn = (
    <button
      type="button"
      data-vc-tour="generate"
      onClick={() => {
        // Criar rápido: foca a sidebar (mesmo fluxo do canvas vazio) — UX-003R.
        if (appMode === 'criador') {
          setTab('home');
          if (isMobile) setDrawerOpen(true);
          requestAnimationFrame(() => {
            document.querySelector('[data-vc-quick-prompt]')?.focus?.();
          });
          return;
        }
        openGenerationSetup(activeProductKind);
      }}
      aria-label={appMode === 'criador'
        ? 'Escrever o pedido na sidebar'
        : `Gerar ${activeProductKind === 'apresentacao' ? 'apresentação' : 'carrossel'} com IA`}
      style={{
        height: isMobile ? 40 : 40,
        padding: isMobile || headerVeryTight ? '0 14px' : '0 20px',
        borderRadius: 9999,
        border: appMode === 'criador' ? '1px solid var(--border)' : 'none',
        cursor: 'pointer',
        background: appMode === 'criador' ? 'var(--bg-card)' : 'var(--accent)',
        color: appMode === 'criador' ? 'var(--text-primary)' : '#fff',
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
      <Sparkles size={14} color={appMode === 'criador' ? 'var(--accent)' : undefined} />
      {isMobile ? 'Gerar' : (appMode === 'criador' ? 'Assistente IA' : 'Gerar com IA')}
    </button>
  );

  /* Histórico (desfazer/refazer) + formato de exportação. No desktop largo
     vive à direita; abaixo de 1200px desce para a 2ª linha do header. */
  const historyFormatGroup = (
    <>
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
              width: 32, height: 30, borderRadius: 9999, border: 'none', background: 'transparent',
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
              width: 32, height: 30, borderRadius: 9999, border: 'none', background: 'transparent',
              color: 'var(--text-muted)', cursor: history.canRedo ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: history.canRedo ? 1 : 0.35,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M21 13a9 9 0 1 1-3-7l3 3"/></svg>
          </button>
        </div>
        <EditorFormatSelector fmt={fmt} setFmt={setFmt} layout="desktop" />
    </>
  );

  const editorHeaderActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 6, flexShrink: 0 }}>
      <ModeSwitcher value={appMode} onChange={setAppMode} compact={isMobile || headerVeryTight} />
      {!isMobile && activeProductKind !== 'apresentacao' && editorIconBtn({
        onClick: () => setTemplatesOpen(true),
        title: 'Templates prontos',
        children: <Layout size={13} />,
      })}
      {editorIconBtn({
        onClick: () => setLibraryOpen(true),
        title: `Biblioteca · ${library.length} projetos`,
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
      {!empty && !isMobile && editorIconBtn({
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
        title: hasAnyAI && hasOpenAI
          ? 'IA pronta · texto e imagens disponíveis'
          : (hasAnyAI ? `Texto pronto · ${imageGenerationAvailability.message}` : 'Configurar provedores de IA'),
        ariaLabel: 'Configurar IA',
        tour: 'settings',
        active: false,
        style: hasAnyAI && hasOpenAI ? { position: 'relative' } : {},
        children: (
          <>
            <Settings size={13} />
            {hasAnyAI && hasOpenAI ? (
              <span aria-hidden style={{
                position: 'absolute', top: 5, right: 5, width: 6, height: 6,
                borderRadius: 99, background: 'var(--success)',
              }} />
            ) : null}
          </>
        ),
      })}
      {!isMobile && editorIconBtn({
        onClick: () => setResearchOpen(true),
        title: 'Pesquisar nicho',
        children: <TrendingUp size={14} />,
      })}
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

  const patchInlineTextAt = useCallback((idx, field, text) => {
    if (!field) return;
    if (field.startsWith('ov_')) {
      setSlides(current => current.map((slide, i) => i === idx
        ? updateOverlayOnSlide(slide, field.slice(3), { text }) : slide));
      return;
    }
    updateSlideAt(idx, { [field]: text });
  }, [setSlides, updateSlideAt]);

  const createTextAreaAt = useCallback((idx, position = {}) => {
    const slide = slides[idx];
    if (!slide) return;
    if (normalizeOverlays(slide.overlays).length >= MAX_CARD_OVERLAYS) {
      toast('Este card já tem 12 elementos extras. Remova um para criar outro texto.', 'warning', 4500);
      return;
    }
    const overlay = makeTextOverlay({
      // Pelo botão, deixa o texto inicial longe do bloco principal do layout.
      y: String(slide.layout || '').startsWith('t') ? 70 : 22,
      ...position,
      color: brand.textColor || brand.titleColor,
    });
    // O blur do texto anterior pode atualizar o mesmo card neste evento.
    setSlides(current => current.map(item => item.id === slide.id
      ? addOverlayToSlide(item, overlay) : item));
    setActiveIdx(idx);
    setCanvasEditMode(false);
    setSelectedCardElement({ slideId: slide.id, key: `ov_${overlay.id}` });
    setEditingTextArea({ slideId: slide.id, overlayId: overlay.id });
    if (isMobile) setDrawerOpen(false);
  }, [slides, brand.textColor, brand.titleColor, setSlides, toast, isMobile]);

  const finishTextAreaEdit = useCallback(() => setEditingTextArea(null), []);

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
    // Import no card cancela job GPT desse lote (overlay falso bloqueava o toque).
    if (imgGenAbortRef.current) imgGenAbortRef.current.cancelled = true;
    cancelAllAIGeneration();
    slideImgGenIdsRef.current.clear();
    setSlideImgGenBusy({});
    const job = { cancelled: false };
    importAbortRef.current = job;
    setGenProgress({ phase: 'import', current: 0, total: 1, label: 'A importar foto… 0/1' });
    void (async () => {
      try {
        if (job.cancelled) return;
        setGenProgress({ phase: 'import', current: 0, total: 1, label: 'A ler foto… 0/1' });
        const url = await vcImageFileToStorageDataUrl(file);
        if (job.cancelled) return;
        if (typeof url !== 'string' || url.length < 32) {
          toast('Não foi possível processar a imagem. Tente JPEG ou PNG.', 'error', 4500);
          return;
        }
        if (!url.startsWith('data:')) {
          toast('Formato não reconhecido após leitura. Tente outro ficheiro.', 'error', 4500);
          return;
        }
        setGenProgress({ phase: 'import', current: 0, total: 1, label: 'A guardar foto… 0/1' });
        let patch;
        try {
          patch = await guardarImagemDoSlide(url);
        } catch (err) {
          console.warn('[foto] IndexedDB falhou, usando memória', err);
          patch = { bgImage: url, bgImageId: null };
        }
        if (job.cancelled) return;
        if (!patch?.bgImage && !patch?.bgImageId) {
          toast('Não foi possível guardar a imagem.', 'error', 4500);
          return;
        }
        if (patch.bgImageId && patch.bgImage) {
          imagemUrlsRef.current.set(patch.bgImageId, patch.bgImage);
        }
        updateSlideAt(sIdx, {
          ...patch,
          bgImageSource: 'imported',
          bgImageFailed: false,
          bgImageError: null,
        });
        setGenProgress({ phase: 'import', current: 1, total: 1, label: 'Foto importada · 1/1' });
        toast('Foto importada.', 'success', 2500);
      } catch (err) {
        if (job.cancelled) return;
        console.error('[foto]', err);
        toast(err?.message || 'Falha ao importar a foto.', 'error', 5000);
      } finally {
        if (importAbortRef.current === job) importAbortRef.current = null;
        setGenProgress((prev) => (prev?.phase === 'import' ? null : prev));
      }
    })();
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
    const targetProjectId = activeProjectRef.current;
    const targetSlide = slidesLiveRef.current?.[activeIdx];
    if (!targetProjectId || !targetSlide?.id) return;
    const targetSlideId = targetSlide.id;
    const expectedImageIdentity = slideImageIdentity(targetSlide);
    const expectedVideoId = targetSlide.videoId || null;
    try {
      const id = newVideoId();
      await videoPut(id, file, { mime: file.type, name: file.name });
      const liveTarget = activeProjectRef.current === targetProjectId
        ? slidesLiveRef.current?.find((slide) => slide.id === targetSlideId)
        : null;
      if (
        !liveTarget
        || slideImageIdentity(liveTarget) !== expectedImageIdentity
        || (liveTarget.videoId || null) !== expectedVideoId
      ) {
        videoDelete(id).catch(() => {});
        return;
      }
      // Cria object URL imediato pra render rápido. Sync = mapa module-level
      // atualiza ANTES do próximo render (não fica 1 ciclo atrás).
      const url = URL.createObjectURL(file);
      setVideoUrlsSync(prev => ({ ...prev, [id]: url }));
      // Atualiza slide: limpa bgImage (mutual exclusion), seta videoId
      let patchApplied = false;
      setSlides((prev) => {
        if (activeProjectRef.current !== targetProjectId) return prev;
        const current = prev.find((slide) => slide.id === targetSlideId);
        if (!current || (current.videoId || null) !== expectedVideoId) return prev;
        const next = applySlidePatchIfImageCurrent(prev, {
          id: targetSlideId,
          expectedImageIdentity,
          patch: {
            videoId: id,
            videoMime: file.type || 'video/mp4',
            videoName: file.name,
            bgImage: null,
            bgImageId: null,
            bgImageFailed: false,
            bgImageError: null,
            bgImageSource: null,
          },
        });
        if (next !== prev) patchApplied = true;
        return next;
      });
      // O updater acima pode ser descartado se o utilizador trocar de projeto,
      // slide, imagem ou vídeo enquanto o IndexedDB conclui a escrita. Espere o
      // commit do React e só então remova o vídeo anterior. Assim uma corrida
      // nunca deixa o documento apontando para um blob que já foi apagado.
      await new Promise((resolve) => {
        const schedule = typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame
          : (callback) => setTimeout(callback, 0);
        schedule(() => schedule(resolve));
      });
      if (!patchApplied) {
        videoDelete(id).catch(() => {});
        setVideoUrlsSync((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        try { URL.revokeObjectURL(url); } catch { /* */ }
        return;
      }

      const appliedTarget = activeProjectRef.current === targetProjectId
        ? slidesLiveRef.current?.find((slide) => slide.id === targetSlideId)
        : null;
      const oldId = expectedVideoId;
      // Se o utilizador já saiu do projeto (ou substituiu novamente o vídeo),
      // mantenha o blob anterior por segurança. A limpeza de órfãos da próxima
      // sessão o remove sem risco de quebrar um projeto persistido.
      if (oldId && appliedTarget?.videoId === id) {
        videoDelete(oldId).catch(() => {});
        const oldUrl = videoUrlsRef.current[oldId];
        setVideoUrlsSync((prev) => {
          const next = { ...prev };
          delete next[oldId];
          return next;
        });
        if (oldUrl) {
          try { URL.revokeObjectURL(oldUrl); } catch { /* */ }
        }
      }
      const usage = await videoStorageUsage().catch(() => null);
      const usageNote = usage ? ` · uso total ${usage.totalMB.toFixed(1)} MB / ${usage.count} vídeos` : '';
      toast(`Vídeo importado (${(file.size / 1024 / 1024).toFixed(1)} MB)${usageNote}`, 'success', 4000);
      trackEvent('video_imported', { size_mb: String(Math.round(file.size / 1024 / 1024)), mime: file.type || 'unknown' });
    } catch (e) {
      console.error('[video] erro ao importar:', e);
      toast(`Erro ao importar vídeo: ${e.message}`, 'error', 6000);
    }
  }, [activeIdx, setSlides, toast]);

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

  const handleImportTextApply = useCallback((parsed) => {
    const isPresentation = activeProductKind === 'apresentacao';
    const { slides: next, created, updated } = applyImportedTextToSlides(
      slidesLiveRef.current,
      parsed,
      mkSlide,
      brand,
      { isPresentation },
    );
    setSlides(next);
    // LEGENDA global do documento → caption do post; legendas por página ficam em slide.caption
    if (parsed?.caption) setCaption(parsed.caption);
    const perCard = (parsed?.cards || []).filter((c) => String(c.caption || '').trim()).length;
    setActiveIdx(0);
    toast(
      `Texto importado: ${updated} ${isPresentation ? 'slide' : 'card'}${updated === 1 ? '' : 's'}${created ? ` · ${created} novo${created === 1 ? '' : 's'}` : ''}${perCard ? ` · ${perCard} legenda${perCard === 1 ? '' : 's'} nos cards` : ''}${parsed?.caption ? ' · legenda do post' : ''}.`,
      'success',
      5000,
    );
    trackEvent('import_text_apply', {
      cards: String(parsed?.cards?.length || 0),
      created: String(created),
    });
  }, [activeProductKind, brand, setCaption, setSlides, toast]);

  const handleTeamShareLinked = useCallback((meta) => {
    history.set((d) => ({
      ...d,
      shareCode: meta?.code || d.shareCode || '',
      shareRevision: meta?.revision ?? d.shareRevision ?? 0,
      shareUpdatedAt: meta?.updatedAt ?? Date.now(),
    }));
  }, [history]);

  const handleTeamDocPulled = useCallback(async (payload) => {
    if (!payload?.doc || typeof payload.doc !== 'object') return;
    const { hydrateSharedDocImages } = await import('./src/utils/project-share.js');
    const hydrated = await hydrateSharedDocImages(payload.doc);
    const shaped = ensureDocShape({
      ...hydrated,
      shareCode: payload.code || hydrated.shareCode || '',
      shareRevision: payload.revision ?? hydrated.shareRevision ?? 0,
      shareUpdatedAt: payload.updatedAt ?? Date.now(),
    });
    history.reset(shaped);
    setActiveIdx(0);
    const withPhoto = (shaped.slides || []).filter((s) => s.bgImage || s.bgImageId).length;
    if (withPhoto) {
      toast(`${withPhoto} imagem${withPhoto === 1 ? '' : 'ns'} aberta${withPhoto === 1 ? '' : 's'} da equipa.`, 'success', 4000);
    }
  }, [history, toast]);

  /** Entrar / link ?share=: cria projeto na lib ou reabre o que já tem o mesmo código. */
  const handleTeamShareJoined = useCallback(async (payload) => {
    if (!payload?.doc || typeof payload.doc !== 'object') return;
    const { hydrateSharedDocImages, normalizeShareCode } = await import('./src/utils/project-share.js');
    const hydrated = await hydrateSharedDocImages(payload.doc);
    const code = normalizeShareCode(payload.code || hydrated.shareCode || '');
    const shaped = ensureDocShape({
      ...hydrated,
      shareCode: code || hydrated.shareCode || '',
      shareRevision: payload.revision ?? hydrated.shareRevision ?? 0,
      shareUpdatedAt: payload.updatedAt ?? Date.now(),
    });
    const name = String(payload.name || '').trim() || 'Projeto da equipa';
    let targetId = null;
    let created = false;
    setLibrary((prev) => {
      const flushed = prev.map((e) => (
        e.id === activeDocId
          ? { ...e, doc: history.state, updatedAt: Date.now() }
          : e
      ));
      const existing = code
        ? flushed.find((e) => normalizeShareCode(e.doc?.shareCode) === code)
        : null;
      if (existing) {
        targetId = existing.id;
        return flushed.map((e) => (
          e.id === existing.id
            ? {
              ...e,
              doc: shaped,
              name: e.name || name,
              updatedAt: Date.now(),
            }
            : e
        ));
      }
      const entry = mkLibEntry(shaped, name);
      targetId = entry.id;
      created = true;
      return [entry, ...flushed];
    });
    if (targetId) {
      if (targetId === activeDocId) {
        history.reset(shaped);
      } else {
        setActiveDocId(targetId);
      }
      setShellView('project');
      setLibraryOpen(false);
      setActiveIdx(0);
    }
    const withPhoto = (shaped.slides || []).filter((s) => s.bgImage || s.bgImageId).length;
    toast(
      created
        ? `Projeto da equipa adicionado à biblioteca${withPhoto ? ` · ${withPhoto} imagem${withPhoto === 1 ? '' : 'ns'}` : ''}.`
        : `Projeto da equipa actualizado${withPhoto ? ` · ${withPhoto} imagem${withPhoto === 1 ? '' : 'ns'}` : ''}.`,
      'success',
      5000,
    );
    trackEvent('team_share_joined', { created: created ? '1' : '0' });
  }, [activeDocId, history, toast]);

  // Link ?share=CÓDIGO (stash sobrevive ao login Google): entra e abre o projeto.
  const shareInviteInFlight = useRef('');
  useEffect(() => {
    if (!accessActive) return undefined;
    let cancelled = false;
    (async () => {
      const {
        peekPendingShareCode,
        consumePendingShareCode,
        joinProjectShare,
        normalizeShareCode,
      } = await import('./src/utils/project-share.js');
      const code = normalizeShareCode(peekPendingShareCode());
      if (!code || shareInviteInFlight.current === code) return;
      shareInviteInFlight.current = code;
      try {
        const res = await joinProjectShare(code);
        if (cancelled) return;
        consumePendingShareCode();
        await handleTeamShareJoined(res);
        enterStudio();
      } catch (e) {
        shareInviteInFlight.current = '';
        if (!cancelled) {
          toast(e?.message || 'Não foi possível abrir o link da equipa.', 'error', 6000);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [accessActive, handleTeamShareJoined, enterStudio, toast]);

  const handleBatchPhotos = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    // Import manual ganha à geração GPT em curso — evita overlay «Gerando…»
    // em todos os cards e corrida por quota enquanto o utilizador cola fotos.
    if (imgGenAbortRef.current) imgGenAbortRef.current.cancelled = true;
    cancelAllAIGeneration();
    slideImgGenIdsRef.current.clear();
    setSlideImgGenBusy({});

    const job = { cancelled: false };
    importAbortRef.current = job;
    const total = files.length;
    setGenProgress({
      phase: 'import',
      current: 0,
      total,
      label: `A importar fotos… 0/${total}`,
    });

    const readOne = async (file) => {
      try {
        const url = await vcImageFileToStorageDataUrl(file);
        return typeof url === 'string' && url.length >= 32 ? url : null;
      } catch {
        return null;
      }
    };

    void (async () => {
      try {
        // Sequencial: evita saturar canvas/IDB e falhas silenciosas em lote grande.
        const urls = [];
        for (let i = 0; i < files.length; i += 1) {
          if (job.cancelled) break;
          const file = files[i];
          setGenProgress({
            phase: 'import',
            current: i,
            total,
            label: `A importar fotos… ${i}/${total}`,
          });
          const dataUrl = await readOne(file);
          if (job.cancelled) break;
          if (!dataUrl) {
            urls.push(null);
            setGenProgress({
              phase: 'import',
              current: i + 1,
              total,
              label: `A importar fotos… ${i + 1}/${total}`,
            });
            continue;
          }
          try {
            const patch = await guardarImagemDoSlide(dataUrl);
            if (patch?.bgImage || patch?.bgImageId) {
              if (patch.bgImageId && patch.bgImage) {
                imagemUrlsRef.current.set(patch.bgImageId, patch.bgImage);
              }
              urls.push({ ...patch, bgImageFailed: false, bgImageError: null });
            } else {
              urls.push({ bgImage: dataUrl, bgImageId: null, bgImageFailed: false, bgImageError: null });
            }
          } catch (err) {
            console.warn('[batch-photos] guardar falhou', err);
            urls.push({ bgImage: dataUrl, bgImageId: null, bgImageFailed: false, bgImageError: null });
          }
          setGenProgress({
            phase: 'import',
            current: i + 1,
            total,
            label: `A importar fotos… ${i + 1}/${total}`,
          });
        }

        if (job.cancelled) {
          // Aplica o que já foi lido antes do cancelamento.
          const partial = urls.filter((p) => p && (p.bgImage || p.bgImageId));
          if (partial.length) {
            const isPresentation = activeProductKind === 'apresentacao';
            setSlides((prev) => applyBatchPhotosToSlides(prev, urls, mkSlide, brand, { isPresentation }));
            setActiveIdx(0);
            toast(`${partial.length} foto${partial.length === 1 ? '' : 's'} aplicada${partial.length === 1 ? '' : 's'} antes do cancelamento.`, 'info', 4500);
          }
          return;
        }

        const beforeCount = slidesLiveRef.current.length;
        const isPresentation = activeProductKind === 'apresentacao';
        const validCount = urls.filter((p) => p && (p.bgImage || p.bgImageId)).length;

        if (validCount > 0) {
          setSlides((prev) => applyBatchPhotosToSlides(
            prev,
            urls,
            mkSlide,
            brand,
            { isPresentation },
          ));
        }

        const created = Math.max(0, validCount - beforeCount);
        const leftoverSlides = Math.max(0, beforeCount - validCount);
        const skippedNulls = urls.length - validCount;
        const summary = summarizeBatchPhotoImport({
          applied: validCount,
          created,
          leftoverSlides,
          skippedNulls,
        });
        toast(summary.message, summary.tone, 5000);
        if (validCount > 0) setActiveIdx(0);
      } catch (err) {
        if (job.cancelled) return;
        console.error('[batch-photos]', err);
        toast(err?.message || 'Falha ao importar imagens. Use JPEG ou PNG e recarregue (Cmd+Shift+R).', 'error', 7000);
      } finally {
        if (importAbortRef.current === job) importAbortRef.current = null;
        setGenProgress((prev) => (prev?.phase === 'import' ? null : prev));
      }
    })();
  }, [activeProductKind, brand, setSlides, toast]);

  const enableCanvasLayout = useCallback(() => {
    // Reutiliza zonas guardadas — antes repunha os defaults e perdia a foto ajustada (bug 2026-09-15).
    setSlides((prev) => enableCanvasLayoutSlides(prev, creativePreset));
    setCanvasEditMode(true);
    toast('Composição ativada em todos os cards. Use o toggle para mover e redimensionar zonas.', 'success');
  }, [creativePreset, setSlides, toast]);

  const disableCanvasLayout = useCallback(() => {
    // Só sai do modo de edição: o card continua a renderizar a composição (zonas guardadas).
    setSlides((prev) => disableCanvasLayoutSlides(prev));
    setCanvasEditMode(false);
    toast('Edição da composição desativada — o layout ajustado fica no card.', 'info');
  }, [setSlides, toast]);

  const autoAdjustAllSlides = useCallback(() => {
    setSlides((prev) => autoAdjustSlides(prev, { creativePreset, fmt }));
    toast('Todos os cards foram ajustados às áreas seguras.', 'success');
  }, [creativePreset, fmt, setSlides, toast]);

  const removeCanvasLayout = useCallback(() => {
    setSlides((prev) => removeCanvasLayoutSlides(prev));
    setCanvasEditMode(false);
    toast('Composição removida — cards voltaram ao layout padrão.', 'info');
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
        const imageKeys = [
          'bgImage', 'bgImageId', 'bgImageSource', 'bgImageFailed', 'bgImageError',
          'bgFit', 'bgZoom', 'bgPosX', 'bgPosY', 'bgFlipX', 'bgFlipY', 'bgOpacity',
        ];
        const imagePatch = (source) => Object.fromEntries(
          imageKeys.map((key) => [key, source[key] ?? (key === 'bgImageId' ? null : undefined)]),
        );
        next[fromIdx] = { ...a, ...imagePatch(b) };
        next[toIdx] = { ...b, ...imagePatch(a) };
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

  const generateSlideImageAt = useCallback(async (idx, parentSignal = null, target = null) => {
    const generationProjectId = target?.projectId || activeProjectRef.current;
    if (!generationProjectId || activeProjectRef.current !== generationProjectId) {
      return { ok: false, reason: 'stale_target' };
    }
    const liveSlides = slidesLiveRef.current || slides;
    const snap = target?.slideId
      ? liveSlides.find((slide) => slide.id === target.slideId)
      : (liveSlides[idx] || slides[idx]);
    if (!snap) return { ok: false, reason: 'slide_missing' };
    const slideId = snap.id;
    const expectedImageIdentity = slideImageIdentity(snap);
    if (slideImgGenIdsRef.current.has(slideId)) return { ok: false, reason: 'already_generating', slideId };

    const itemLabel = fmt === 'apresentacao' ? 'slide' : 'card';

    const imageState = slideImageGenerationState(snap, imageGenerationAvailability, styleKit);
    if (!imageState.canGenerate) {
      toast(imageState.message, 'error');
      return { ok: false, reason: imageState.reason, slideId };
    }

    slideImgGenIdsRef.current.add(slideId);
    setSlideImgGenBusy(prev => ({ ...prev, [slideId]: true }));
    const job = startAIJob(parentSignal);
    try {
      const url = await generateDALLEWithRetry(imageState.query, openaiKey, imgParams, {
        signal: job.signal,
        refImages: await runAIJob(() => resolveImageReferences(styleKit, snap.refImage, snap.refImageId || snap.refImageAssetId), job.signal),
        imgExtraPrompt: composeImgExtraPrompt(styleKit, imageState.extraPrompt),
        aspectRatio: imageAspectRatioForFormat(fmt),
      });
      // Bytes para o IndexedDB; no documento fica só o id (ver image-store.js).
      const patchImg = await guardarImagemDoSlide(url);
      throwIfGenerationCancelled(job.signal);
      const liveTarget = activeProjectRef.current === generationProjectId
        ? slidesLiveRef.current?.find((slide) => slide.id === slideId)
        : null;
      if (!liveTarget || slideImageIdentity(liveTarget) !== expectedImageIdentity) {
        if (patchImg.bgImageId) imageDelete(patchImg.bgImageId).catch(() => {});
        return { ok: false, reason: 'stale_target', slideId };
      }
      setSlides(prev => activeProjectRef.current !== generationProjectId ? prev : applySlidePatchIfImageCurrent(prev, {
        id: slideId,
        expectedImageIdentity,
        patch: {
          ...patchImg,
          imgMode: 'dalle',
          bgFit: 'cover',
          bgX: 50,
          bgY: 50,
          bgZoom: 100,
          bgImageFailed: false,
          bgImageError: null,
          bgImageSource: 'ai',
        },
      }));
      toast(`${itemLabel === 'slide' ? 'Slide' : 'Card'} ${idx + 1}: imagem gerada`, 'success');
      return { ok: true, slideId };
    } catch (e) {
      if (isGenerationCancelled(e)) throw e;
      if (activeProjectRef.current === generationProjectId) {
        setSlides(prev => applySlidePatchIfImageCurrent(prev, {
          id: slideId,
          expectedImageIdentity,
          patch: {
            bgImageFailed: true,
            bgImageError: e?.code || e?.message || 'generation_failed',
          },
        }));
        toast(`Imagem do ${itemLabel} ${idx + 1}: ${e.message}`, 'error');
      }
      return { ok: false, slideId, error: e };
    } finally {
      job.finish();
      slideImgGenIdsRef.current.delete(slideId);
      setSlideImgGenBusy(prev => {
        const next = { ...prev };
        delete next[slideId];
        return next;
      });
    }
  }, [slides, fmt, imageGenerationAvailability, openaiKey, imgParams, styleKit, setSlides, toast]);

  useEffect(() => {
    const onQuota = (ev) => {
      const q = ev?.detail;
      if (!q || typeof q !== 'object') return;
      setAccess((prev) => ({
        ...prev,
        imageQuota: {
          ...(prev.imageQuota || {}),
          ...q,
        },
        tier: q.tier || prev.tier,
      }));
    };
    window.addEventListener('vc:image-quota', onQuota);
    return () => window.removeEventListener('vc:image-quota', onQuota);
  }, [setAccess]);

  const openRefImagePicker = useCallback((slideIdx) => {
    refImageTargetIdxRef.current = slideIdx;
    refImageInputRef.current?.click();
  }, []);
  const handleRefImageFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    const idx = refImageTargetIdxRef.current;
    refImageTargetIdxRef.current = null;
    e.target.value = '';
    if (!file || idx == null) return;
    const projectId = activeDocId;
    const source = slides[idx];
    if (!source) return;
    const request = ++referenceUploadRef.current;
    try {
      const stored = await storeSlideReference(file);
      if (request !== referenceUploadRef.current || editorSyncStateRef.current.activeDocId !== projectId) return;
      history.set(current => ({ ...current, slides: current.slides.map(slide => (
        slide.id === source.id && slide.refImage === source.refImage
          && slide.refImageId === source.refImageId && slide.refImageAssetId === source.refImageAssetId
          ? { ...slide, ...stored, refImageFailed: false, refImageError: null } : slide
      )) }));
    } catch (error) {
      toast(error.message, 'warning', 6000);
    }
  }, [activeDocId, slides, history.set, toast]);
  const removeSlideReference = useCallback((idx) => {
    referenceUploadRef.current += 1;
    updateSlideAt(idx, { refImage: null, refImageId: null, refImageAssetId: null, refImageFailed: false, refImageError: null });
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
    if (activeProductKind === 'apresentacao') {
      const seed = {
        ...mkSlide(slides.length + 1, brand),
        layout: 'ml',
        align: 'left',
        photoRegion: 'full',
        bodyAfterImage: '',
        showSwipeCue: false,
      };
      const newSlide = applyPresentationVisualPresetToSlide(
        seed,
        visualPreset || DEFAULT_PRESENTATION_VISUAL_PRESET_ID,
        presentationPath,
        visualPresets,
        { index: slides.length, count: slides.length + 1 },
      );
      setSlides([
        ...slides,
        { ...newSlide, num: slides.length + 1 },
      ]);
      setActiveIdx(slides.length);
      return;
    }
    const pr = normalizeCardVisualStyle(doc.cardVisualStyle);
    const n = { ...mkSlide(slides.length + 1, brand), layout: 'bl', align: 'left', photoRegion: pr };
    setSlides([...slides, n]); setActiveIdx(slides.length);
  }, [
    activeProductKind,
    slides,
    brand,
    doc.cardVisualStyle,
    setSlides,
    visualPreset,
    presentationPath,
    visualPresets,
  ]);
  const deleteSlide = useCallback((i) => {
    if (slides.length<=1) return;
    const slide = slides[i];
    const preview = (slide?.title || '').trim().slice(0, 50) || `Card ${i+1}`;
    if (!window.confirm(`Apagar "${preview}"?\n\nEsta ação não pode ser desfeita por completo (o Cmd+Z pode recuperar nesta sessão).`)) return;
    const next = slides.filter((_,j)=>j!==i).map((s,j)=>({...s,num:j+1}));
    setSlides(next); setActiveIdx(Math.min(activeIdx, next.length-1));
  }, [slides, activeIdx]);
  const deleteCardTarget = useCallback((i) => {
    if (selectedCardElement?.slideId === slides[i]?.id && selectedCardElement.key) {
      const key = selectedCardElement.key;
      if (key.startsWith('ov_')) {
        const overlayId = key.slice(3);
        const overlays = (slides[i]?.overlays || []).filter((o) => o?.id !== overlayId);
        const elementOffsets = { ...(slides[i]?.elementOffsets || {}) };
        delete elementOffsets[key];
        updateSlideAt(i, { overlays, elementOffsets });
      } else if (key === 'photo') {
        updateSlideAt(i, {
          bgImage: null,
          bgImageId: null,
          bgImageSource: null,
          bgImageError: null,
          videoId: null,
          bgImageFailed: false,
        });
      } else if (key === 'logo') {
        updateSlideAt(i, { logoHidden: true });
      } else if (key === 'eyebrow') {
        updateSlideAt(i, { eyebrowText: '' });
      } else if (key === 'pill') {
        setBrand((b) => ({ ...b, footerPillText: '' }));
      } else {
        const hiddenElements = Array.from(new Set([...(slides[i]?.hiddenElements || []), key]));
        updateSlideAt(i, { hiddenElements });
      }
      setSelectedCardElement(null);
      toast('Elemento removido. Use Desfazer para recuperar.', 'success', 3500);
      return;
    }
    deleteSlide(i);
  }, [deleteSlide, selectedCardElement, slides, toast, updateSlideAt, setBrand]);
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
    contentObjective: objectiveArg,
    slideTextDensity: densityArg,
    cardVisualStyle: cardStyleArg,
    visualPreset: visualPresetArg,
    presentationPath: presentationPathArg,
    fetchImagesNow = true,
    announcement = false,
    remix = false,
  }) => {
    if (generationRef.current && !generationRef.current.signal.aborted) return { cancelled: true };
    if (getAIGenerationCount() > 0) {
      toast('Há outra operação de IA em andamento. Conclua ou cancele antes de iniciar uma nova geração.', 'info', 4800);
      return { cancelled: true };
    }
    const generationProjectId = activeProjectRef.current;
    const job = startAIJob();
    generationRef.current = job;
    const checkActive = () => {
      if (activeProjectRef.current !== generationProjectId || generationRef.current !== job) job.cancel();
      throwIfGenerationCancelled(job.signal);
    };
    const requestedPresetId = presetArg ?? creativePreset ?? 'livre';
    const requestedPresentationPath = normalizePresentationPath(
      presentationPathArg ?? presentationPath,
    );
    if (isApresentacaoPreset(requestedPresetId)) {
      count = clampPresentationSlideCount(
        count,
        getPresentationPath(requestedPresentationPath).defaultSlideCount,
      );
    }
    const sourceSlides = slides;
    setGenProgress({ phase: 'text', current: 0, total: 1, label: 'Preparando contexto do projeto…' });
    trackEvent('carousel_generate_start', {
      product: isApresentacaoPreset(requestedPresetId) ? 'apresentacao' : 'carrossel',
      preset: requestedPresetId,
      mode: chosenNarrativeMode || mode || 'editorial',
      count: String(count || 0),
      with_images: fetchImagesNow ? 'true' : 'false',
    });
    try {
    const effectiveAxes = axes || imgParams;
    const cp = requestedPresetId;
    const isPresentationGeneration = isApresentacaoPreset(cp);
    const presentationPathId = requestedPresentationPath;
    const objective = normalizeContentObjective(objectiveArg ?? contentObjective);
    const effectiveMode = isApresentacaoPreset(cp)
      ? 'editorial'
      : isTendenciaCulturaPreset(cp)
      ? 'editorial'
      : isQuickTemplatePreset(cp)
        ? (QUICK_TEMPLATE_NARRATIVE_MODE[quickTemplateIdFromPreset(cp)] || 'editorial')
        : normalizeNarrativeModeId(chosenNarrativeMode || mode || 'editorial');
    const tdRaw = densityArg ?? slideTextDensity ?? '1_1';
    const performanceGuidance = buildPerformanceGuidance(library, {
      ...performanceSettings, objective, niche: n || '', mode: effectiveMode, presetId: cp,
    });
    const td = SLIDE_TEXT_DENSITY_BY_ID[tdRaw] ? tdRaw : '1_1';
    const cvStyle = normalizeCardVisualStyle(cardStyleArg ?? doc.cardVisualStyle);
    const requestedVisualPreset = visualPresetArg ?? visualPreset ?? null;
    // Arquivos externos podem persistir o ID canônico da fonte (`pds.*`).
    // Resolva-o para o ID de runtime antes de montar prompt, composições e
    // metadados; caso contrário a geração cairia silenciosamente no padrão
    // sugerido pelo caminho narrativo.
    const requestedVisualPresetDef = resolvePresentationVisualPresetDefinition(
      requestedVisualPreset,
      visualPresets,
    );
    const effectiveVisualPreset = isPresentationGeneration
      ? (requestedVisualPresetDef?.productKind === 'apresentacao'
          ? requestedVisualPresetDef.id
          : getPresentationPath(presentationPathId).suggestedVisualPreset)
      : (requestedVisualPresetDef?.productKind === 'apresentacao'
          || (activeProductKind === 'apresentacao' && !requestedVisualPresetDef)
        ? DEFAULT_CAROUSEL_VISUAL_PRESET_ID
        : (requestedVisualPresetDef?.id || requestedVisualPreset));
    const effectiveVisualPresetDef = resolvePresentationVisualPresetDefinition(
      effectiveVisualPreset,
      visualPresets,
    );
    const modeDef = resolveGenMode(effectiveMode);
    const brandBlock = buildBrandBlock(brand);
    const brandVoiceBlock = buildBrandVoiceBlock(brand, {
      enabled: brand.useBrandVoice !== false && brandToneIsReady(brand),
    });
    const projectContextBlock = buildProjectContextBlock(styleKit);
    const styleKitTextHint = buildStyleKitTextHint(styleKit);
    const { materialBlock, materialPriorityBlock } = await runAIJob(() => resolveMaterialPromptParts(material, toast), job.signal);
    checkActive();
    const imgParamsBlock = buildImgParamsBlockPT(effectiveAxes);
    const introLine = buildGenerationIntroLine(cp);
    const langLayer = buildGenerationLanguageLayer(cp, tone, effectiveMode);
    const imageLayer = buildGenerationImageLayer(cp, topic, n, audience, !!(styleKit.contextMd.trim() || styleKit.stylePrompt.trim()));
    const slideLayoutRules = buildGenerationSlideLayoutRules(effectiveMode, cp, td, count);
    const tendenciaPackBlock = isTendenciaCulturaPreset(cp) ? buildTendenciaCulturaPackBlock(count, td) : '';
    const apresentacaoPackBlock = isPresentationGeneration
      ? buildApresentacaoPackBlock(count, presentationPathId)
      : '';
    const apresentacaoDesignBlock = isPresentationGeneration
      ? buildPresentationDesignSystemPromptBlock(effectiveVisualPresetDef)
      : '';
    const presentationRoute = isPresentationGeneration
      ? getPresentationPath(presentationPathId)
      : null;
    const presentationStages = presentationRoute?.stages || [];
    const presentationTextLimits = isPresentationGeneration && !effectiveVisualPresetDef?.isCustom
      ? Array.from({ length: Number(count) }, (_, index) => {
          const stage = presentationStageAt(presentationPathId, index, Number(count));
          const limits = getPresentationCompositionOverrides(effectiveVisualPreset, {
            slide: {}, stage, index, count: Number(count),
          }).presentationTextLimits || {};
          return {
            title: limits.title,
            subtitle: limits.subtitle,
            bodyAfterImage: limits.body,
          };
        })
      : null;
    const quickTid = quickTemplateIdFromPreset(cp);
    const quickPackBlock = quickTid ? buildQuickTemplatePackBlock(quickTid, count) : '';

    const persoHybridActive = isPersoHybridDensity(cp, td);
    const projectDesignInstructions = remix ? '' : buildProjectDesignInstructions(styleKit);
    const remixBlock = remix ? buildRemixBlock(sourceSlides, fetchImagesNow) : '';
    const jsonShapeLine = buildGenerationJsonContract(cp, td, count, projectDesignInstructions ? PROJECT_DESIGN_SCHEMA : null);

    const idiomaRegra = `
REGRA DE IDIOMA (obrigatória):
- Redija em português brasileiro: "title", "subtitle", "bodyAfterImage" (se existir) e "caption".
- Exceção: cada "imageQuery" permanece em INGLÊS (8–15 palavras), conforme a seção de direção de imagem — não traduza esse campo para o português.
`;

    const contextoModoPerso =
      isPresentationGeneration
        ? [
            n ? `Área ou contexto: ${n}` : '',
            audience ? `Público da apresentação: ${audience}` : '',
            `Tom de voz solicitado: ${tone}`,
          ].filter(Boolean).join('\n')
        : isTendenciaCulturaPreset(cp)
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
      effectiveMode === 'none' ? modeDef.method : announcement && !chosenNarrativeMode ? 'Arco publicitário: apresente o produto e a possibilidade concreta que ele oferece, desenvolva benefícios sustentados pelo brief e encerre com um próximo passo. Cada card deve ser uma peça pronta para o público.' : isApresentacaoPreset(cp)
        ? '(Contexto estrutural: use apenas o PACOTE APRESENTAÇÃO abaixo — ignore arcos de carrossel Instagram.)'
        : isTendenciaCulturaPreset(cp)
        ? '(Contexto estrutural: use apenas o PACOTE TENDÊNCIA/CULTURA abaixo — ignore modos narrativos editoriais tipo editorial/viral/storytelling.)'
        : modeDef.method;

    const hasPromptMaterial = !!(
      String(materialBlock || '').trim() ||
      String(materialPriorityBlock || '').trim()
    );

    const deliveryLine = isPresentationGeneration
      ? `Crie uma APRESENTAÇÃO (deck 16:9) de ${count} slides sobre: "${topic}"`
      : `Crie um carrossel de ${count} slides para Instagram sobre: "${topic}"`;
    const generationTaskBlock = isPresentationGeneration
      ? `TAREFA: transforme o tema e as fontes em um deck pronto para apresentar. Cada slide deve avançar o caminho escolhido, sustentar uma única ideia e funcionar em uma tela 16:9. A conclusão deve deixar clara a decisão, aprendizagem ou próxima ação.`
      : buildGenerationTaskBlock(topic, announcement);

    const prompt = `${introLine}
${hasPromptMaterial ? `${materialBlock}${materialPriorityBlock}` : ''}${deliveryLine}
${contextoModoPerso ? `${contextoModoPerso}\n` : ''}${brandBlock}${projectContextBlock}${styleKitTextHint}
${hasPromptMaterial ? '' : `${materialBlock}${materialPriorityBlock}`}${imgParamsBlock}

${generationTaskBlock}
${idiomaRegra}

${effectiveMode === 'none' || isPresentationGeneration ? '' : buildEditorialStrategyBlock(objective, cp, performanceGuidance.preferredStructureId)}
${effectiveMode === 'none' || isPresentationGeneration ? '' : performanceGuidance.prompt}

${modoNarrativoBloco}
${brandVoiceBlock}
${apresentacaoPackBlock}
${apresentacaoDesignBlock}
${tendenciaPackBlock}
${quickPackBlock ? `${quickPackBlock}\n` : ''}

${slideLayoutRules}

${langLayer}

${imageLayer}
${projectDesignInstructions}
${remixBlock}

${buildCaptionOutlineInstructions(effectiveMode, cp)}
${buildCaptionVoiceRules(cp, effectiveMode)}

JSON exato a retornar (sem mais nada):
${jsonShapeLine}`;

    setGenProgress({ phase: 'text', current: 0, total: 1, label: 'Escrevendo texto dos slides…' });
    // Orçamento de saída cresce com o número de cards (T/C 1/1 traz subtitle + bodyAfterImage por slide) — auditoria M2.
    const genMaxTokens = Math.min(8192, 3072 + Math.max(1, Number(count) || 1) * 512);
    const { result, reviewStatus } = await generateReviewedCarousel({
      prompt,
      config: {
        count: Number(count),
        presetId: cp,
        densityId: td,
        presentationTextLimits,
      },
      aiOptions: { maxTokens: genMaxTokens, openaiKey, signal: job.signal },
      onReview: () => { checkActive(); setGenProgress({ phase: 'text', current: 0, total: 1, label: 'Revisando clareza e coerência…' }); },
    }, callAI);
    checkActive();
    if (reviewStatus === 'unavailable') toast('Texto gerado. A revisão automática não foi concluída; mantive a primeira versão.', 'warning', 6500);
    if (!result?.slides?.length) { setGenProgress(null); throw new Error('IA não retornou slides. Tente um tema mais específico.'); }
    setGenProgress({ phase: 'text', current: 1, total: 1, label: 'Texto pronto, preparando cards…' });

    // O modal aplica o preset e dispara a geração no mesmo gesto. Não dependemos
    // do próximo render do React: a marca efetiva já nasce com a paleta/fontes
    // escolhidas, evitando que o primeiro lote use o preset anterior.
    const presetBrand = effectiveVisualPreset
      ? applyVisualPreset(brand, effectiveVisualPreset, visualPresets)
      : brand;
    const generationBrand = {
      ...presetBrand,
      ...((projectDesignInstructions && !effectiveVisualPreset && !brand.visualIdentityLocked)
        ? projectDesignBrandPatch(result.projectDesign)
        : {}),
    };
    let projectLogoAsset = null;
    if (styleKit?.logoOnGenerate !== false && styleKit?.logo) {
      try {
        const logoUrl = await resolveLogoDataUrl(generationBrand, styleKit);
        if (logoUrl) projectLogoAsset = {
          logoImageId: styleKit.logo.imageId || null,
          logoImage: logoUrl,
        };
      } catch { /* logo opcional — geração segue sem bloquear */ }
    }
    const resolvedImgMode = normalizeSlideImgMode(chosenMode || 'dalle');
    const nSlides = result.slides.length;

    const visualSlideOverrides = effectiveVisualPreset
      ? getSlideOverridesForPreset(effectiveVisualPreset, visualPresets)
      : {};
    let newSlides = remix ? mergeRemixedSlides(sourceSlides, result.slides, fetchImagesNow) : (
      attachGenerationCanvasLayouts(
      result.slides.map((s, i) => {
      let q = ((s.imageQuery ?? s.image_query) || '').trim();
      const title = stripLeadingSlideCardLabel(String(s.title ?? '').trim());
      const subtitle = stripLeadingSlideCardLabel(String(s.subtitle ?? '').trim());
      const stageIndex = presentationStages.length <= 1 || nSlides <= 1
        ? 0
        : Math.round((i * (presentationStages.length - 1)) / (nSlides - 1));
      const stage = isPresentationGeneration
        ? (presentationStages[stageIndex] || {})
        : {};
      // Resolve uma única vez a composição efetiva antes de decidir se o
      // slide precisa de imagem. Presets personalizados mantêm a composição
      // livre do usuário e, por isso, não recebem fallback automático.
      const compositionOverrides = isPresentationGeneration && !effectiveVisualPresetDef?.isCustom
        ? getPresentationCompositionOverrides(effectiveVisualPreset, {
            slide: s,
            stage,
            index: i,
            count: nSlides,
          })
        : {};
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
      // Só composições que declaram uma imagem obrigatória recebem fallback.
      // Capas/divisores tipográficos continuam intencionalmente sem imagem.
      if (
        !q
        && isPresentationGeneration
        && compositionOverrides.presentationRequiresImage === true
        && (title || subtitle)
      ) {
        const seed = `${title}. ${subtitle}`.trim().slice(0, 220);
        q = `widescreen presentation visual illustrating: ${seed}. Editorial evidence or clean diagrammatic concept, strong 16:9 composition, no embedded text, no logo`;
        console.warn(`[handleGenerate] IA omitiu imageQuery obrigatória do slide ${i+1} da apresentação — usando fallback semântico.`);
      }
      const base = {
        ...mkSlide(i + 1, generationBrand),
        title,
        subtitle,
        imageQuery: q,
        imgMode: resolvedImgMode,
        bgImage: null,
        layout: i === 0 ? 'mc' : 'bl',
        align: i === 0 ? 'center' : 'left',
        useCultureLayout: false,
        photoRegion: projectDesignInstructions && result.projectDesign?.layout === 'fullbleed' ? 'full' : cvStyle,
        ...(projectDesignInstructions && result.projectDesign?.layout === 'fullbleed' && q
          ? { composition: i === nSlides - 1 ? 'cta_close' : 'hook_fullbleed' } : {}),
        ...visualSlideOverrides,
      };

      if (isApresentacaoPreset(cp)) {
        const rawBodyAfterImage = typeof s.bodyAfterImage === 'string'
          ? s.bodyAfterImage
          : typeof s.body_after_image === 'string'
            ? s.body_after_image
            : '';
        const presetAlign = compositionOverrides.align || base.align || 'left';
        const deckLayout = compositionOverrides.layout || (
          presetAlign === 'center'
            ? 'mc'
            : i === 0
              ? (base.layout || 'tl')
              : i === nSlides - 1
                ? (presetAlign === 'right' ? 'mr' : 'ml')
                : (i % 2 === 0 ? 'mr' : 'ml')
        );
        return {
          ...base,
          ...compositionOverrides,
          layout: deckLayout,
          align: presetAlign,
          photoRegion: compositionOverrides.photoRegion || 'full',
          useCultureLayout: false,
          bodyAfterImage: stripLeadingSlideCardLabel(rawBodyAfterImage.trim()),
          presentationStageId: stage.id || null,
          presentationStageLabel: stage.label || '',
          showSwipeCue: false,
          overlay: compositionOverrides.overlay ?? (
            i === 0 ? Math.max(55, Number(base.overlay) || 60) : (Number(base.overlay) || 45)
          ),
        };
      }
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
    ));
    if (!remix) {
      newSlides = autoAdjustOnGenerate
        ? autoAdjustSlides(newSlides, { creativePreset: cp, fmt: isPresentationGeneration ? 'apresentacao' : fmt })
        : applyFinalizeCanvasMarginsToSlides(newSlides, isPresentationGeneration ? 'apresentacao' : fmt);
    }
    if (!remix) {
      newSlides = applyGenerationLogoPolicy(newSlides, {
        enabled: styleKit?.logoOnGenerate !== false,
        projectLogoAsset,
        hasBrandLogo: !!(generationBrand?.logo || generationBrand?.logoImageId),
      });
    }
    checkActive();
    if (!remix) {
      lastGenerateArgsRef.current = {
        topic, count, niche: n, tone, audience, announcement,
        imgParams: effectiveAxes, mode: effectiveMode, creativePreset: cp,
        contentObjective: objective, slideTextDensity: td, cardVisualStyle: cvStyle,
        presentationPath: presentationPathId,
      };
      setHasLastGenerate(true);
    }
    history.set(d => ({
      ...d, brand: generationBrand, slides: newSlides, mode: effectiveMode, creativePreset: cp,
      ...(isPresentationGeneration
        ? { fmt: 'apresentacao', productKind: 'apresentacao', presentationPath: presentationPathId }
        : {
            fmt: fmt && fmt !== 'apresentacao' ? fmt : 'carrossel',
            productKind: 'carrossel',
          }),
      visualPreset: effectiveVisualPreset || null,
      presentationDesignSystemId: isPresentationGeneration
        ? (effectiveVisualPresetDef?.sourceId || null)
        : undefined,
      presentationDesignSystemVersion: isPresentationGeneration
        ? (effectiveVisualPresetDef?.sourceVersion || null)
        : undefined,
      slideTextDensity: td, contentObjective: objective, editorialReviewStatus: reviewStatus,
      editorialContext: {
        topic,
        niche: n || '',
        generatedAt: new Date().toISOString(),
        suggestedStructureId: isPresentationGeneration
          ? presentationPathId
          : performanceGuidance.preferredStructureId,
      },
    }));
    setActiveIdx(0); setShellView('project');
    // A IA escreveu subtítulos, logo eles têm de aparecer. Vários padrões visuais
    // versões antigas podiam deixar `subtitleVisible: false` gravado no projeto e
    // esconder o texto recém-gerado sem o utilizador perceber.
    if (!remix && newSlides.some((sl) => String(sl.subtitle || '').trim())) {
      setBrand((b) => (b?.subtitleVisible === false ? { ...b, subtitleVisible: true } : b));
    }
    const quickTplSynced = isQuickTemplatePreset(cp) ? TEMPLATES.find((x) => x.id === quickTemplateIdFromPreset(cp)) : null;
    if (quickTplSynced && !remix) {
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
    let imgQuotaStop = false;

    if (fetchImagesNow) {
      if (hasOpenAI) {
        const slidesWithImage = newSlides.map((sl, i) => ({ sl, slideId: sl.id, i, q: result.slides[i]?.imageQuery || sl.imageQuery }))
                                          .filter(x => !!(x.q && String(x.q).trim()));
        const totalImgs = slidesWithImage.length;
        let doneImgs = 0;
        const attemptedImageSlideIds = new Set();
        setGenProgress({ phase: 'images', current: 0, total: totalImgs, label: `Gerando imagens (0/${totalImgs})…` });
        for (const { slideId, i, q } of slidesWithImage) {
          if (abort.cancelled || activeProjectRef.current !== generationProjectId) break;
          attemptedImageSlideIds.add(slideId);
          setGenProgress({
            phase: 'images',
            current: doneImgs,
            total: totalImgs,
            label: `Gerando imagem do ${isPresentationGeneration ? 'slide' : 'card'} ${i+1} (${doneImgs+1}/${totalImgs})…`,
          });
          try {
            checkActive();
            const url = await generateDALLEWithRetry(q, openaiKey, effectiveAxes, {
              signal: job.signal,
              refImages: await resolveImageReferences(styleKit, newSlides[i]?.refImage, newSlides[i]?.refImageId || newSlides[i]?.refImageAssetId),
              imgExtraPrompt: composeImgExtraPrompt(styleKit, newSlides[i]?.imgExtraPrompt),
              aspectRatio: isPresentationGeneration ? '16:9' : imageAspectRatioForFormat(fmt),
            });
            checkActive();
            const patchImg = await guardarImagemDoSlide(url);
            checkActive();
            if (!abort.cancelled && activeProjectRef.current === generationProjectId)
              setSlides(prev => prev.map((sl) => sl.id === slideId ? {
                ...sl,
                ...patchImg,
                bgFit: 'cover',
                bgX: 50,
                bgY: 50,
                bgZoom: 100,
                bgImageFailed: false,
                bgImageError: null,
                bgImageSource: 'ai',
              } : sl));
          } catch(e) {
            if (isGenerationCancelled(e) || job.signal.aborted) throw e;
            imgFailCount++;
            console.warn(`Image gen slide ${i+1}:`, e.message);
            if (!abort.cancelled && activeProjectRef.current === generationProjectId)
              setSlides(prev => prev.map((sl) => sl.id === slideId ? {
                ...sl,
                bgImageFailed: true,
                bgImageError: e?.code || e?.message || 'generation_failed',
              } : sl));
            // Quota esgotada / plano sem imagens / sessão: os restantes cards falhariam igual — pára aqui (auditoria H6).
            if (['reference_unsupported', 'reference_invalid', 'reference_storage_unconfigured', 'reference_upload_failed', 'quota_exhausted', 'plan_no_images', 'session_required', 'subscription_inactive', 'rate_limited'].includes(e?.code)) {
              if (!abort.cancelled) toast(e.message, 'error', 7000);
              imgQuotaStop = true;
              doneImgs++;
              setGenProgress({
                phase: 'images',
                current: doneImgs,
                total: totalImgs,
                label: `Geração interrompida (${doneImgs}/${totalImgs})`,
              });
              break;
            }
          }
          doneImgs++;
          setGenProgress({ phase: 'images', current: doneImgs, total: totalImgs, label: `Gerando imagens (${doneImgs}/${totalImgs})…` });
        }
        if (imgQuotaStop) {
          const remainingIds = new Set(
            slidesWithImage
              .filter(({ slideId }) => !attemptedImageSlideIds.has(slideId))
              .map(({ slideId }) => slideId),
          );
          if (remainingIds.size) {
            imgFailCount += remainingIds.size;
            setSlides(prev => prev.map((sl) => remainingIds.has(sl.id) ? {
              ...sl,
              bgImageFailed: true,
              bgImageError: 'batch_generation_stopped',
            } : sl));
          }
        }
      }

      if (!abort.cancelled && imgFailCount > 0 && !imgQuotaStop) {
        toast(
          imgFailCount === 1
            ? '1 imagem não carregou após retry — toque na área da foto para tentar de novo.'
            : `${imgFailCount} imagens não carregaram após retry — toque nas áreas das fotos para tentar de novo.`,
          'warning',
          6000,
        );
      }
    } else if (!remix && result.slides.some(s => (s.imageQuery || '').trim())) {
      toast(
        isPresentationGeneration
          ? 'Imagens não foram geradas agora — os slides já têm áreas prontas para importar ou gerar uma imagem.'
          : 'Imagens não foram geradas agora — já existem zonas de foto nos cards (toque na área para importar ou use «Gerar imagem»).',
        'info',
        5500,
      );
    }
      checkActive();
      trackEvent('carousel_generate_success', {
        product: isPresentationGeneration ? 'apresentacao' : 'carrossel',
        slide_count: String(newSlides.length),
        image_failures: String(imgFailCount),
      });
      try {
        if (!lsGet(SK.backupNudgeDone, false)) {
          lsSet(SK.backupNudgeDone, true);
          // FE-013: flush síncrono antes do toast — o autosave 100ms ainda
          // podia estar pendente quando o utilizador fechasse a aba.
          // A imagem acabou de entrar por `setSlides`; esperar o próximo tick
          // evita gravar o snapshot anterior sem os blobs/IDs recém-gerados.
          window.setTimeout(() => flushPersistRef.current?.(), 0);
          toast('Projeto na sua conta e neste navegador. «Salvar» ou Sync na nuvem actualizam a cópia remota.', 'info', 7500);
        }
      } catch { /* */ }
      return { cancelled: false };
    } catch (err) {
      if (isGenerationCancelled(err) || job.signal.aborted) return { cancelled: true };
      trackEvent('carousel_generate_error', {
        msg: String(err?.message || '').slice(0, 80),
      });
      throw err;
    } finally {
      job.finish();
      if (generationRef.current === job) { generationRef.current = null; setGenProgress(null); }
    }
  };

  const refineSlide = async (instruction) => {
    const projectId = activeProjectRef.current;
    setRefining(true); setError('');
    const job = startAIJob();
    try {
      const ctx = buildCarouselTextContext(slides);
      const isPresentationRefine = isApresentacaoPreset(creativePreset);
      const brandBlock = buildBrandBlock(brand);
      const projectContextBlock = buildProjectContextBlock(styleKit);
      const styleKitTextHint = buildStyleKitTextHint(styleKit);
      const { materialBlock, materialPriorityBlock } = await runAIJob(() => resolveMaterialPromptParts(material, toast), job.signal);
      const voiceRefine = buildRefineVoiceRules(creativePreset, mode);
      const nSl = slides.length;
      const presentationRefineTextLimits = isPresentationRefine
        ? presentationTextLimitsFromSlides(slides)
        : null;
      const presentationRefineLimitsBlock = isPresentationRefine
        ? buildPresentationLimitsBlock(
            { presentationTextLimits: presentationRefineTextLimits },
            nSl,
            [activeIdx],
          )
        : '';
      const isCultureSandwichSlide =
        isTendenciaCulturaPreset(creativePreset) && activeIdx > 0 && activeIdx < nSl - 1;
      const isPersoHybridRefineSlide =
        isPersoHybridDensity(creativePreset, slideTextDensity) && activeIdx >= 2;
      const refineNeedsBodyAfter = isPresentationRefine || isCultureSandwichSlide || isPersoHybridRefineSlide;
      const singleJson = refineNeedsBodyAfter
        ? '{"title":"...","subtitle":"...","bodyAfterImage":"..."}'
        : '{"title":"...","subtitle":"..."}';
      const r = await callAI(
        `${isPresentationRefine
          ? 'Atue como editor de apresentações profissionais 16:9.'
          : 'Atue como editor de carrossel para Instagram.'} Responda APENAS com JSON.

${isPresentationRefine ? '' : buildNarrativeModeReminder(mode)}
${isPresentationRefine ? '' : buildContentObjectiveReminder(contentObjective)}

Contexto ${isPresentationRefine ? 'da apresentação' : 'do carrossel'}:\n${ctx}
${brandBlock}${projectContextBlock}${styleKitTextHint}${materialBlock}${materialPriorityBlock}
Slide ${activeIdx+1} (atual):
Título: "${slide.title}"
Subtítulo: "${slide.subtitle}"
${refineNeedsBodyAfter ? `${isPresentationRefine ? 'Fonte, unidade, período, ressalva ou instrução' : 'Corpo abaixo da imagem / bloco inferior'} — bodyAfterImage atual:\n${JSON.stringify(slide.bodyAfterImage ?? '')}\n` : ''}
Instrução de refinamento: ${instruction}

REGRAS:
${voiceRefine}
${isPresentationRefine ? buildApresentacaoRefineHint(presentationPath) : ''}
${presentationRefineLimitsBlock}
${isPresentationRefine ? '- Preserve bodyAfterImage literalmente, a menos que a instrução peça sua correção e o novo texto esteja sustentado pelo pedido ou material. Nunca invente fonte, número, unidade ou período.\n' : ''}
${isPersoHybridRefineSlide ? '- Layout Personalizado (1/1 ou 1/2): slides desta posição usam formato sanduíche — mantenha payoff em bodyAfterImage abaixo da foto.\n' : ''}
${buildRefineSingleSlideRules(mode, slideTextDensity, { presetId: creativePreset, slideIndex: activeIdx, slideCount: nSl })}
- Mantenha coerência com os outros slides e com o modo narrativo acima.
- Respeite a identidade verbal e o material acima.

Retorne exatamente: ${singleJson}`,
        { json:true, openaiKey, signal: job.signal }
      );
      throwIfGenerationCancelled(job.signal);
      const patch = {
        title: stripLeadingSlideCardLabel(String(r.title ?? slide.title ?? '').trim()),
        subtitle: stripLeadingSlideCardLabel(String(r.subtitle ?? slide.subtitle ?? '').trim()),
      };
      if (typeof r.bodyAfterImage === 'string' && refineNeedsBodyAfter) {
        patch.bodyAfterImage = stripLeadingSlideCardLabel(String(r.bodyAfterImage).trim());
      }
      if (isPresentationRefine) {
        const candidateSlides = slides.map((item, index) => (
          index === activeIdx ? { ...item, ...patch } : item
        ));
        const currentSlideOnlyLimits = presentationRefineTextLimits.map((limits, index) => (
          index === activeIdx ? limits : {}
        ));
        assertPresentationTextLimits(
          candidateSlides,
          currentSlideOnlyLimits,
          'Refinamento',
        );
      }
      if (activeProjectRef.current === projectId) updateSlide(patch);
    } catch(e) { if (!isGenerationCancelled(e)) setError(e.message); }
    finally { job.finish(); setRefining(false); }
  };

  const generateCaption = async () => {
    const projectId = activeProjectRef.current;
    setGenCaption(true); setError('');
    const job = startAIJob();
    try {
      const ctx = buildCarouselTextContext(slides);
      const brandBlock = buildBrandBlock(brand);
      const projectContextBlock = buildProjectContextBlock(styleKit);
      const isPresentationSummary = isApresentacaoPreset(creativePreset);
      const capRules = buildCaptionVoiceRules(creativePreset, mode);
      const { materialBlock, materialPriorityBlock } = await runAIJob(() => resolveMaterialPromptParts(material, toast), job.signal);
      const r = await callAI(
        `${isPresentationSummary
          ? 'Atue como editor de apresentações. Crie um resumo executivo e notas breves para acompanhar este deck em português brasileiro.'
          : 'Atue como estrategista de conteúdo para Instagram. Crie a legenda para este carrossel em português brasileiro.'}

${isPresentationSummary ? '' : buildNarrativeModeReminder(mode)}
${isPresentationSummary ? '' : buildContentObjectiveReminder(contentObjective)}

${isPresentationSummary ? 'Apresentação' : 'Carrossel'}:
${ctx}
${brandBlock}${projectContextBlock}${materialBlock}${materialPriorityBlock}
${buildCaptionOutlineInstructions(mode, creativePreset)}

REGRAS:
${capRules}
${isPresentationSummary
  ? '- Sintetize a tese, os principais pontos e a decisão ou próximo passo. Não use hashtags, gatilhos sociais ou pedidos para compartilhar.'
  : '- Hashtags no final, na quantidade indicada nas REGRAS acima.'}
- Respeite a identidade verbal e use o material para conferir os fatos.
- Entregue apenas ${isPresentationSummary ? 'o resumo e as notas' : 'a legenda e as hashtags'}, nada mais.`,
        { openaiKey, signal: job.signal }
      );
      throwIfGenerationCancelled(job.signal);
      const finalCaption = isPresentationSummary
        ? String(r?.summary ?? r?.caption ?? r ?? '').trim()
        : normalizeInstagramCaption(r);

      if (activeProjectRef.current === projectId) {
        setCaption(finalCaption);
        // Legenda regenerada também preenche o card activo (modelo por card).
        updateSlideAt(activeIdx, { caption: finalCaption });
      }
      return finalCaption;
    } catch(e) {
      if (!isGenerationCancelled(e)) setError(e.message);
      return '';
    }
    finally { job.finish(); setGenCaption(false); }
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
    e.target.value = '';
    if (!file) return;
    consumePhotoZoneFileForSlide(activeIdx, file);
  };

  // B1: Remix com tom alternativo — re-roda handleGenerate com os mesmos args mas
  // adicionando um hint de tom. Usuário pode comparar com Cmd+Z (undo) depois.
  const remixWithTone = async (toneHint, hintLabel, { withImages = false } = {}) => {
    const prev = lastGenerateArgsRef.current;
    if (!prev) {
      toast('Gere um projeto primeiro — depois use o remix para variar o tom.', 'info');
      return;
    }
    toast(`Refazendo com tom «${hintLabel}»… o atual fica em Cmd+Z.`, 'info', 4000);
    const blendedTone = (prev.tone || '').trim()
      ? `${prev.tone} — variação solicitada: ${toneHint}`
      : `Variação solicitada: ${toneHint}`;
    try {
      return await handleGenerate({
        ...prev, tone: blendedTone, count: slides.length, remix: true,
        mode, creativePreset, slideTextDensity, contentObjective, cardVisualStyle, imgParams,
        fetchImagesNow: withImages && hasOpenAI,
      });
    } catch (e) {
      toast(e?.message || 'Não foi possível refazer com o novo tom.', 'error', 6000);
    }
  };

  /** Geração rápida a partir do prompt da aba Narrativa (usa styleKit + material). */
  const handleQuickGenerateFromNarrativa = async (promptText, {
    withImages = false,
    narrativeMode = 'none',
    cardCount = 'auto',
    productKind = null,
    presentationPath: quickPresentationPath = null,
  } = {}) => {
    const topic = String(promptText || '').trim();
    if (!topic) {
      toast('Escreva o que você quer gerar no prompt.', 'error');
      return;
    }
    try {
      const wantPresentation = productKind
        ? productKind === 'apresentacao'
        : isApresentacaoPreset(creativePreset);
      const selectedPresentationPath = normalizePresentationPath(quickPresentationPath ?? presentationPath);
      const presentationRoute = getPresentationPath(selectedPresentationPath);
      const maxSlides = 24;
      const resolved = resolveQuickGenerationRequest(
        topic,
        wantPresentation ? presentationRoute.defaultSlideCount : 6,
        maxSlides,
      );
      const preferredCount = cardCount === 'auto' ? resolved.count : Number(cardCount);
      const count = wantPresentation
        ? (Number.isInteger(preferredCount) && preferredCount >= 1 && preferredCount <= maxSlides
            ? preferredCount
            : clampPresentationSlideCount(preferredCount, presentationRoute.defaultSlideCount))
        : (Number.isInteger(preferredCount) && preferredCount >= 1 && preferredCount <= maxSlides
            ? preferredCount
            : resolved.count);
      const { announcement } = resolved;
      const toneFromBrand = (brandToneIsReady(brand) && brand.useBrandVoice !== false)
        ? (brand.brandTone?.summary || brand.defaultTone || '').trim()
        : ((brand.defaultTone || '').trim() || 'direto e concreto');
      const currentVisualPresetDef = resolvePresentationVisualPresetDefinition(
        visualPreset,
        visualPresets,
      );
      return await handleGenerate({
        topic,
        count,
        niche: styleKit.contextMd.trim() ? '' : (niche || ''),
        tone: styleKit.contextMd.trim() && !(brandToneIsReady(brand) && brand.useBrandVoice !== false)
          ? 'Use a voz do brief do projeto; na ausência, PT-BR direto e concreto'
          : (toneFromBrand || 'direto e concreto'),
        audience: styleKit.contextMd.trim() ? '' : (brand.defaultAudience || ''),
        imgMode: 'dalle',
        imgParams,
        mode: wantPresentation ? 'editorial' : normalizeNarrativeModeId(narrativeMode),
        announcement: wantPresentation ? false : announcement,
        creativePreset: wantPresentation
          ? APRESENTACAO_PRESET_ID
          : (isApresentacaoPreset(creativePreset) ? 'livre' : (creativePreset || 'livre')),
        contentObjective: wantPresentation ? 'auto' : (announcement ? 'leads' : contentObjective),
        slideTextDensity: wantPresentation ? '1_2' : (announcement ? '1_5' : slideTextDensity),
        cardVisualStyle,
        visualPreset: wantPresentation
          ? (currentVisualPresetDef?.productKind === 'apresentacao'
              ? currentVisualPresetDef.id
              : presentationRoute.suggestedVisualPreset)
          : (currentVisualPresetDef?.productKind === 'apresentacao'
              ? DEFAULT_CAROUSEL_VISUAL_PRESET_ID
              : (currentVisualPresetDef?.id || visualPreset)),
        presentationPath: selectedPresentationPath,
        fetchImagesNow: withImages && hasOpenAI,
      });
    } catch (e) {
      if (!isGenerationCancelled(e)) toast(e?.message || 'Não foi possível gerar a partir do prompt.', 'error', 6000);
      return { cancelled: true };
    }
  };

  const [analyzingBrandTone, setAnalyzingBrandTone] = useState(false);
  /** Analisa e devolve o rascunho — o painel confirma antes de gravar (spec Fatia 2 / alinhamento). */
  const analyzeBrandTone = useCallback(async (options = {}) => {
    if (analyzingBrandTone) return null;
    if (!hasAnyAI) {
      setKeysOpen(true);
      toast('Ative a IA de texto para analisar o tom.', 'info');
      return null;
    }
    const job = startAIJob(options.signal);
    setAnalyzingBrandTone(true);
    try {
      const prompt = buildBrandToneAnalysisPrompt({
        brand,
        styleKit,
        projectName: activeEntry?.name || styleKit?.name || '',
        socialEvidence: options.socialEvidence,
      });
      const raw = await runAIJob(
        () => callAI(prompt, {
          json: true,
          jsonParser: parseBrandToneAnalysisResponse,
          openaiKey,
          signal: job.signal,
          maxTokens: 3072,
        }),
        job.signal,
      );
      throwIfGenerationCancelled(job.signal);
      const parsed = raw?.result ?? raw;
      const tone = brandToneFromAnalysis(parsed);
      if (!tone?.method) throw new Error('A IA não devolveu um perfil de tom utilizável.');
      return tone;
    } catch (e) {
      if (isGenerationCancelled(e)) return null;
      throw e;
    } finally {
      job.finish?.();
      setAnalyzingBrandTone(false);
    }
  }, [analyzingBrandTone, hasAnyAI, brand, styleKit, activeEntry?.name, openaiKey, toast, setKeysOpen]);

  // Refina TODOS os slides com uma instrução geral (passa contexto para coerência)
  const refineAll = useCallback(async (instruction) => {
    const projectId = activeProjectRef.current;
    if (!slides.length) return;
    setRefining(true);
    const job = startAIJob();
    try {
      const refiningPresentation = isApresentacaoPreset(creativePreset);
      const refineAllHybrid = isPersoHybridDensity(creativePreset, slideTextDensity);
      const refineAllWantsBody = refiningPresentation
        || isTendenciaCulturaPreset(creativePreset)
        || refineAllHybrid;
      const presentationRefineTextLimits = refiningPresentation
        ? presentationTextLimitsFromSlides(slides)
        : null;
      const presentationRefineLimitsBlock = refiningPresentation
        ? buildPresentationLimitsBlock(
            { presentationTextLimits: presentationRefineTextLimits },
            slides.length,
          )
        : '';
      const ctx = slides.map((s, i) =>
        `${i + 1}. Título: "${s.title}" | Subtítulo: "${s.subtitle}"${
          refineAllWantsBody ? ` | bodyAfterImage: ${JSON.stringify(s.bodyAfterImage ?? '')}` : ''
        }`,
      ).join('\n');
      const brandBlock = buildBrandBlock(brand);
      const projectContextBlock = buildProjectContextBlock(styleKit);
      const styleKitTextHint = buildStyleKitTextHint(styleKit);
      const { materialBlock, materialPriorityBlock } = await runAIJob(() => resolveMaterialPromptParts(material, toast), job.signal);
      const voiceBulk = buildRefineVoiceRules(creativePreset, mode);
      const layoutBulk = buildGenerationSlideLayoutRules(mode, creativePreset, slideTextDensity, slides.length);
      const refinePrompt = refiningPresentation
        ? `Atue como editor de apresentações profissionais. Reescreva TODOS os slides do deck 16:9 abaixo aplicando a instrução do usuário, preservando uma progressão própria de apresentação e o caminho ${getPresentationPath(presentationPath).label}.

Deck atual:
${ctx}
${brandBlock}${projectContextBlock}${styleKitTextHint}${materialBlock}${materialPriorityBlock}
Instrução: ${instruction}

REGRAS:
${voiceBulk}
${buildApresentacaoRefineHint(presentationPath)}
${presentationRefineLimitsBlock}
- Mantenha exatamente ${slides.length} slides na mesma ordem e uma ideia central por slide.
- Nos slides de conteúdo, escreva o título como conclusão sustentada pelo subtítulo ou pela evidência disponível.
- Não invente números, fontes, resultados ou fatos ausentes do material.
- Preserve cada bodyAfterImage literalmente, a menos que a instrução peça sua correção e o novo texto esteja sustentado pelo pedido ou material. Use esse campo somente para fonte, unidade, período, ressalva ou instrução.
- Não use ganchos, cliffhangers, “arraste”, hashtags nem CTA de Instagram.
- Respeite a identidade verbal, o modo de entrega e o material acima.

${layoutBulk}

Retorne APENAS JSON: {"slides":[{"title":"...","subtitle":"...","bodyAfterImage":"..."}]}`
        : `Atue como editor de carrossel para Instagram. Reescreva TODOS os slides do carrossel abaixo aplicando a instrução do usuário, mantendo coerência narrativa entre eles.

${buildNarrativeModeReminder(mode)}
${buildContentObjectiveReminder(contentObjective)}

Carrossel atual:
${ctx}
${brandBlock}${projectContextBlock}${styleKitTextHint}${materialBlock}${materialPriorityBlock}
Instrução: ${instruction}

REGRAS DE VOZ:
${voiceBulk}
${buildTendenciaCulturaRefineSlideHint(creativePreset, slideTextDensity)}
${isApresentacaoPreset(creativePreset) ? buildApresentacaoRefineHint() : ''}
${refineAllHybrid ? '- Layout Personalizado (1/1 ou 1/2): do 3.º slide em diante o card é sanduíche — reescreva também "bodyAfterImage" (payoff abaixo da foto) mantendo o campo vazio nos slides 1–2.\n' : ''}- Mantenha exatamente ${slides.length} slides na mesma ordem (slide 1 = abertura do arco do modo; último = fecho/CTA conforme o modo).
- Respeite a identidade verbal e o material acima.

${layoutBulk}

Retorne APENAS JSON: ${refineAllWantsBody
          ? '{"slides":[{"title":"...","subtitle":"...","bodyAfterImage":"..."}]}'
          : '{"slides":[{"title":"...","subtitle":"..."}]}'}`;
      const r = await callAI(
        refinePrompt,
        { json:true, openaiKey, signal: job.signal }
      );
      throwIfGenerationCancelled(job.signal);
      if (!r?.slides?.length) throw new Error('IA não retornou slides');
      if (activeProjectRef.current !== projectId) return;
      const applyRefinedSlides = source => source.map((s, i) => {
        const total = source.length;
        const isCultureSandwich =
          isTendenciaCulturaPreset(creativePreset) && i !== 0 && i !== total - 1;
        const isHybridSandwich =
          isPersoHybridDensity(creativePreset, slideTextDensity) && i >= 2;
        const allowBodyAfter = refiningPresentation || isCultureSandwich || isHybridSandwich;
        return {
          ...s,
          title: stripLeadingSlideCardLabel(String(r.slides[i]?.title ?? s.title ?? '').trim()),
          subtitle: stripLeadingSlideCardLabel(String(r.slides[i]?.subtitle ?? s.subtitle ?? '').trim()),
          ...(allowBodyAfter && typeof r.slides[i]?.bodyAfterImage === 'string'
            ? { bodyAfterImage: stripLeadingSlideCardLabel(String(r.slides[i].bodyAfterImage).trim()) }
            : {}),
        };
      });
      const refinedSlides = applyRefinedSlides(slides);
      if (refiningPresentation) {
        assertPresentationTextLimits(
          refinedSlides,
          presentationRefineTextLimits,
          'Refinamento',
        );
      }
      setSlides(prev => applyRefinedSlides(prev));
      toast('Todos os slides refinados', 'success');
    } catch(e) { if (!isGenerationCancelled(e)) setError(e.message); }
    finally { job.finish(); setRefining(false); }
  }, [slides, setSlides, setError, toast, openaiKey, brand, material, styleKit, creativePreset, mode, slideTextDensity, contentObjective, presentationPath]);

  // Aplica um template pronto (preenche slides + brand + composições)
  const applyTemplate = useCallback((tpl) => {
    if (activeProductKind === 'apresentacao') {
      setTemplatesOpen(false);
      toast('Os templates prontos são de carrossel. Abra ou crie um carrossel para aplicá-los.', 'info', 5200);
      return;
    }
    const projectId = activeProjectRef.current;
    const palette = PALETTES[tpl.palette] || PALETTES[0];
    // Fontes vêm SÓ do pairing — os índices titleFont/bodyFont dos templates
    // eram ignorados aqui mas exibidos no preview do modal, então o card do
    // modal podia mostrar uma fonte que nunca seria aplicada.
    const pairing = FONT_PAIRINGS.find((p) => p.id === tpl.pairingId) || FONT_PAIRINGS[0];
    const titleFont = { val: pairing.titleFont };
    const bodyFont = { val: pairing.bodyFont };
    const zonesByKey = {
      cover: DEFAULT_CANVAS_ZONES_COVER_FULLBLEED,
      classic: DEFAULT_CANVAS_ZONES_CLASSIC,
      sandwich: DEFAULT_CANVAS_ZONES_SANDWICH,
      stat: DEFAULT_CANVAS_ZONES_STAT,
    };
    let newSlides = [];
    history.set((d) => {
      // Assinatura do template (barra editorial, contador, selo) substitui a
      // anterior por inteiro — a mesma regra anti-acúmulo dos padrões visuais.
      const brandLimpo = { ...d.brand };
      for (const k of PRESET_BRAND_SIGNATURE_KEYS) delete brandLimpo[k];
      const nextBrand = {
        ...brandLimpo,
        ...(tpl.signature || {}),
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
        productKind: 'carrossel',
        fmt: d.fmt === 'apresentacao' ? 'carrossel' : d.fmt,
        visualPreset: null,
      };
    });
    setActiveIdx(0);
    toast(`Template "${tpl.name}" aplicado`, 'success');
    trackEvent('template_applied', { template: tpl.id || tpl.name, slides: tpl.slides.length });
    // Guard contra race-condition (mesmo padrão do handleGenerate)
    if (imgGenAbortRef.current) imgGenAbortRef.current.cancelled = true;
    const templateJob = startAIJob();
    const abort = { cancelled: false };
    templateJob.signal.addEventListener('abort', () => { abort.cancelled = true; }, { once: true });
    imgGenAbortRef.current = abort;
    (async () => {
      // Modo plano (SJinn) não usa chave OpenAI — o gate antigo por `openaiKey` deixava templates sem foto (auditoria H7).
      if (!hasOpenAI) { templateJob.finish(); return; }
      let failCount = 0;
      for (let i = 0; i < tpl.slides.length; i++) {
        if (abort.cancelled || activeProjectRef.current !== projectId) break;
        const q = tpl.slides[i]?.q;
        if (!q) continue;
        const slideId = newSlides[i]?.id;
        try {
          const url = await generateDALLEWithRetry(q, openaiKey, imgParams, {
            signal: templateJob.signal,
            refImages: await resolveImageReferences(styleKit, newSlides[i]?.refImage, newSlides[i]?.refImageId || newSlides[i]?.refImageAssetId),
            imgExtraPrompt: composeImgExtraPrompt(styleKit, newSlides[i]?.imgExtraPrompt),
            aspectRatio: imageAspectRatioForFormat(fmt === 'apresentacao' ? 'carrossel' : fmt),
          });
          const patchImg = await guardarImagemDoSlide(url);
          if (!abort.cancelled && activeProjectRef.current === projectId)
            setSlides(prev => prev.map((sl) => sl.id === slideId ? {
              ...sl,
              ...patchImg,
              bgImageFailed: false,
              bgImageError: null,
              bgImageSource: 'ai',
            } : sl));
        } catch (e) {
          if (isGenerationCancelled(e)) break;
          failCount++;
          console.warn(`Template imagem slide ${i + 1}:`, e.message);
          if (!abort.cancelled && activeProjectRef.current === projectId)
            setSlides(prev => prev.map((sl) => sl.id === slideId ? {
              ...sl,
              bgImageFailed: true,
              bgImageError: e?.code || e?.message || 'generation_failed',
            } : sl));
        }
      }
      templateJob.finish();
      if (!abort.cancelled && failCount > 0)
        toast(failCount === 1
          ? '1 imagem do template não carregou. Toque no card para tentar de novo.'
          : `${failCount} imagens do template não carregaram. Toque no card para tentar de novo.`, 'warning', 5000);
    })();
  }, [activeProductKind, fmt, history, toast, setSlides, hasOpenAI, openaiKey, imgParams, styleKit]);

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
      const anyModalOpen = resultsOpen || setupOpen || researchOpen || seriesOpen || keysOpen || templatesOpen || hookVarsOpen || helpOpen || imgPrompt.open || fullscreenOpen || tourOpen || libraryOpen || brandsOpen || imageCropOpen || photoPositionOpen || modesIntroOpen || landingOpen || paywallOpen || loginOpen;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key;

      // Cmd/Ctrl+S: grava já. Vale mesmo com modal aberto — nunca é destrutivo.
      if (mod && (k === 's' || k === 'S')) {
        e.preventDefault();
        salvarProjeto();
        return;
      }

      // Só o salvamento explícito atravessa overlays. Todo o restante pertence
      // ao diálogo aberto; nunca editar/exportar o documento escondido atrás.
      if (anyModalOpen) return;

      if (resultsOpen) return;
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
      if (k === 'Delete' || k === 'Backspace') {
        // Com elemento seleccionado: apaga só esse (CTA, texto, logo…).
        // Sem selecção: não apaga o card inteiro — use o ícone do lixo.
        if (selectedCardElement?.slideId === slides[activeIdx]?.id && selectedCardElement.key) {
          e.preventDefault();
          deleteCardTarget(activeIdx);
        }
        return;
      }
      if (k === 'n' || k === 'N') { e.preventDefault(); addSlide(); return; }
      if (k === 'f' || k === 'F') { e.preventDefault(); setFullscreenOpen(o=>!o); return; }
      if (k === '?') { e.preventDefault(); setHelpOpen(o=>!o); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIdx, slides, selectedCardElement, deleteCardTarget, history, setupOpen, researchOpen, seriesOpen, resultsOpen, keysOpen, templatesOpen, hookVarsOpen, helpOpen, imgPrompt.open, fullscreenOpen, tourOpen, libraryOpen, brandsOpen, imageCropOpen, photoPositionOpen, modesIntroOpen, landingOpen, paywallOpen, loginOpen, shellView]); // eslint-disable-line

  const sidebarProps = {
    // setHookLibrary/niche: botão "salvar hook na biblioteca" (SidebarContent).
    // hookLibrary em si só é lido pelo GenerateModal — não entra aqui.
    setHookLibrary, niche,
    onOpenResults: () => setResultsOpen(true),
    slide, slides, activeIdx, brand, setBrand, updateSlide,
    setSlides,
    addSlide, deleteSlide, duplicateSlide, moveSlide, refineSlide, refining,
    generateCaption, genCaption, caption, setCaption,
    setSetupOpen: setSetupOpenForSidebar,
    setResearchOpen, fileInputRef,
    exportSlide, exportAll, exportPDF, exporting, exportProgress, tab, setTab,
    openaiKey, hasOpenAI, imageGenerationAvailability, hasTextAI: hasAnyAI, setKeysOpen,
    setTemplatesOpen, setHookVarsOpen, refineAll, askPrompt, toast,
    material, setMaterial,
    styleKit, setStyleKit,
    onQuickGenerate: handleQuickGenerateFromNarrativa,
    quickPrompt, setQuickPrompt,
    quickNarrativeMode: doc.quickNarrativeMode || 'none',
    onQuickNarrativeModeChange: value => history.set(d => ({ ...d, quickNarrativeMode: value })),
    genBusy: !!genProgress,
    imgParams, setImgParams,
    setBrandsOpen, brandRoster, activeBrandId,
    onSelectBrand: selectBrandForProduction,
    onSaveBrandContext: saveBrandContext,
    setLibraryOpen, libraryCount: library.length,
    library,
    activeDocId,
    onOpenProject: openDoc,
    onNewProject: createProjectByKind,
    onDeleteProject: (docId) => {
      const id = docId || activeDocId;
      if (!id) return;
      const entry = library.find((e) => e.id === id);
      const name = (entry?.name || 'este projeto').trim() || 'este projeto';
      if (!window.confirm(`Apagar o projeto «${name}» por completo?\n\nTodos os cards serão removidos da biblioteca deste navegador.`)) return;
      deleteDoc(id);
      toast('Projeto apagado.', 'success', 3000);
    },
    selectedCardElement,
    onSelectCardElement: (key) => setSelectedCardElement({ slideId: slide.id, key }),
    onCreateText: () => createTextAreaAt(activeIdx),
    onGenerateProject: generateProjectByKind,
    onPickVideo: () => videoFileInputRef.current?.click(),
    onRemoveVideo: removeVideoFromActiveSlide,
    openRefImagePicker,
    slideImgGenBusy,
    generateSlideImageAt,
    creativePreset,
    setCreativePreset,
    fmt,
    applyTypographyToAllCards,
    applyBrandTypographyToAllSlides,
    canvasEditMode, setCanvasEditMode,
    showPreviewAlignGrid, setShowPreviewAlignGrid,
    anyCanvasEnabled: slides.some((s) => s.canvas?.enabled),
    anyCanvasSaved: slides.some((s) => !!s.canvas?.zones),
    removeCanvasLayout,
    patchCanvasZonesAt,
    openPhotoZoneImport,
    onImportPhotoAt: consumePhotoZoneFileForSlide,
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
    visualPresets,
    saveCustomVisualPreset,
    quickCardCount,
    setQuickCardCount,
    presentationPath,
    setPresentationPath,
    autoAdjustAllSlides,
    appMode,
    setActiveIdx,
    activeEntry,
    analyzingBrandTone,
    analyzeBrandTone,
    setAppMode,
    exportDoc,
    onImportTextApply: handleImportTextApply,
    onTeamShareLinked: handleTeamShareLinked,
    onTeamDocPulled: handleTeamDocPulled,
    onTeamShareJoined: handleTeamShareJoined,
    historyDoc: doc,
    generateMissingImages: async (targetSlideIds = null) => {
      const targetSet = Array.isArray(targetSlideIds) && targetSlideIds.length
        ? new Set(targetSlideIds)
        : null;
      const candidates = slides
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => String(s.imageQuery || '').trim())
        .filter(({ s }) => !s.bgImage)
        .filter(({ s }) => targetSet ? targetSet.has(s.id) : true);
      if (!candidates.length) {
        toast(`Nenhum ${activeProductKind === 'apresentacao' ? 'slide' : 'card'} pendente de imagem (ou sem palavras-chave).`, 'info');
        return;
      }
      trackEvent('criar_rapido_images', { count: String(candidates.length) });
      // Mantém um job pai vivo durante o lote. Sem ele, cancelar abortava apenas
      // a imagem atual e o loop começava o card seguinte como uma nova geração.
      const batchJob = startAIJob();
      const generationProjectId = activeProjectRef.current;
      let generated = 0;
      let restored = 0;
      let failed = 0;
      try {
        for (const { s, i } of candidates) {
          throwIfGenerationCancelled(batchJob.signal);
          if (activeProjectRef.current !== generationProjectId) break;
          // Um ID persistido pode estar apenas aguardando hidratação. Recupera
          // seus bytes antes de gastar quota; se o registro sumiu, limpa o ID
          // órfão para que a geração abaixo possa reparar o slide.
          if (s.bgImageId) {
            let storageReadFailed = false;
            try {
              const cached = imagemUrlsRef.current.get(s.bgImageId);
              const entry = cached ? null : await imageGet(s.bgImageId);
              const restoredUrl = cached || (entry?.blob ? URL.createObjectURL(entry.blob) : null);
              if (restoredUrl) {
                imagemUrlsRef.current.set(s.bgImageId, restoredUrl);
                setSlides(prev => activeProjectRef.current !== generationProjectId ? prev : applyPersistedImagePatches(prev, [{
                  id: s.id,
                  expectedImageId: s.bgImageId,
                  patch: { bgImage: restoredUrl, bgImageFailed: false, bgImageError: null },
                }]));
                restored++;
                continue;
              }
            } catch (error) {
              console.warn('[imagem] recuperação antes do lote falhou:', error?.message || error);
              storageReadFailed = true;
            }
            if (storageReadFailed) {
              // Uma falha de leitura pode ser temporária. Não apaga a referência
              // persistida nem gasta quota gerando outra imagem por cima dela.
              setSlides(prev => activeProjectRef.current !== generationProjectId ? prev : applyPersistedImagePatches(prev, [{
                id: s.id,
                expectedImageId: s.bgImageId,
                patch: { bgImageFailed: true, bgImageError: 'stored_image_unavailable' },
              }]));
              failed++;
              continue;
            }
          }
          // eslint-disable-next-line no-await-in-loop
          const result = await generateSlideImageAt(i, batchJob.signal, {
            projectId: generationProjectId,
            slideId: s.id,
          });
          if (result?.ok) generated++;
          else {
            failed++;
            if (s.bgImageId && result?.reason !== 'stale_target' && result?.reason !== 'already_generating') {
              setSlides(prev => activeProjectRef.current !== generationProjectId ? prev : applyPersistedImagePatches(prev, [{
                id: s.id,
                expectedImageId: s.bgImageId,
                patch: {
                  bgImage: null,
                  bgImageId: null,
                  bgImageFailed: true,
                  bgImageError: 'stored_image_missing',
                },
              }]));
            }
          }
          throwIfGenerationCancelled(batchJob.signal);
        }
        const parts = [];
        if (generated) parts.push(`${generated} gerada${generated === 1 ? '' : 's'}`);
        if (restored) parts.push(`${restored} recuperada${restored === 1 ? '' : 's'}`);
        if (failed) parts.push(`${failed} com falha`);
        if (parts.length) {
          toast(`Imagens: ${parts.join(' · ')}.`, failed ? 'warning' : 'success', 5200);
        }
      } catch (error) {
        if (!isGenerationCancelled(error)) {
          toast(error?.message || 'Não foi possível concluir as imagens.', 'error');
        }
      } finally {
        batchJob.finish();
      }
    },
    imagesBatchBusy: Object.values(slideImgGenBusy || {}).some(Boolean),
    onOpenSeries: () => setSeriesOpen(true),
    libraryFolders,
    setDocFolder,
    setDocPublicationDate,
    createFolder,
    setDocStatus,
  };

  const desktopThumbWidth = f.w * previewScale;
  const isPresentationProject = activeProductKind === 'apresentacao';
  const stripThumbWidth = isPresentationProject ? 80 : 44;
  const stripThumbHeight = isPresentationProject ? 45 : 56;
  const completePasswordLogin = () => {
    // Passa pelo mesmo isolamento/restauração usado no retorno do Google.
    lockAccountDataWrites();
    window.location.assign('/?app=1&login=password');
  };

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
        <Suspense fallback={<BootScreen />}>
          <OnboardingLanding
            onEnter={completeLanding}
            onEnterProfessional={() => {
              setAppMode('diretor');
              trackEvent('landing_enter_profissional');
              completeLanding();
            }}
            onLogin={() => { setLoginHint(''); setLoginOpen(true); }}
            isMobile={isMobile}
          />
          <LoginModal
            open={loginOpen}
            onClose={() => setLoginOpen(false)}
            initialEmail={paywallEmail}
            hint={loginHint}
            onLoggedIn={completePasswordLogin}
          />
        </Suspense>
      </div>
    );
  }

  if (access.status === 'loading' || (accessActive && !accountLibraryReady)) {
    return (
      <BootScreen
        label={accessActive ? 'Restaurando seus projetos…' : 'Abrindo sua conta…'}
        busy={!accountRestoreError}
      >
        {accountRestoreError && <div role="alert" style={{ lineHeight: 1.6 }}>
          <p>{accountRestoreError}</p>
          <button className="vc-btn vc-btn-primary" onClick={() => window.location.reload()}>Tentar novamente</button>
        </div>}
      </BootScreen>
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
        <Suspense fallback={<BootScreen label="Abrindo sua conta…" />}>
          <Paywall
            isMobile={isMobile}
            initialEmail={paywallEmail}
            loginHint={loginHint}
            onBack={reopenLanding}
            onLogin={() => setLoginOpen(true)}
          />
          <LoginModal
            open={loginOpen}
            onClose={() => setLoginOpen(false)}
            initialEmail={paywallEmail}
            hint={loginHint}
            onLoggedIn={completePasswordLogin}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div style={{
      width:'100%', height:'100vh', background:'var(--bg-base)', color:'var(--text-primary)',
      display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:'var(--font-ui)',
      ...(activeProductKind === 'apresentacao' ? {
        '--accent-primary': '#d7ff5a',
        '--accent-hover': '#c5ed45',
        '--accent-rgb': '215, 255, 90',
        '--accent-gradient-start': '#d7ff5a',
        '--accent-gradient-end': '#a8d43d',
        '--accent': '#d7ff5a',
        '--accent-focus': '#d7ff5a',
        '--accent-secondary': '#e8ff9b',
        '--accent-surface': 'rgba(215, 255, 90, 0.11)',
        '--accent-surface-strong': 'rgba(215, 255, 90, 0.18)',
        '--accent-glow': 'rgba(215, 255, 90, 0.28)',
        '--text-on-accent': '#090a0f',
      } : {}),
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
          useOwnImageKey={useOwnImageKey}
          appMode={appMode}
          onGenerate={generateProjectByKind}
          onOpenLibrary={() => setLibraryOpen(true)}
          onOpenTemplates={() => setTemplatesOpen(true)}
          onOpenResearch={() => setResearchOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
          onOpenSettings={() => setKeysOpen(true)}
          onContinueEditor={() => setShellView('project')}
          onManageBilling={access.billingDisabled ? undefined : openPortal}
          onLogout={handleLogout}
          onSyncCloud={access.active ? handleSyncCloud : null}
          cloudSyncBusy={cloudSyncBusy || !accountLibraryReady}
          onOpenBrands={() => setBrandsOpen(true)}
          accessEmail={access.email}
          currentPeriodEnd={access.currentPeriodEnd}
          currentPeriodStart={access.currentPeriodStart}
          planTier={access.tier || null}
          onRefreshUsage={refreshImageUsage}
          imageQuota={access.imageQuota}
          accountTab={accountTab}
          setAccountTab={setAccountTab}
          openDoc={openDoc}
          newDoc={createProjectByKind}
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
          /* Direita = auto (largura de conteúdo). Com 1fr o grupo de
             ferramentas transbordava para a esquerda e sobrepunha o CTA
             "Gerar com IA" (28px a 1440px, 87px a 1100px). */
          gridTemplateColumns: 'minmax(0, 1fr) auto auto',
          alignItems: 'center',
          ...(headerTight ? {
            /* 2 linhas: histórico + formato descem, em vez de sobrepor o CTA. */
            padding: 'env(safe-area-inset-top, 0) 14px 8px',
            rowGap: 8,
            columnGap: 12,
          } : {
            padding: 'env(safe-area-inset-top, 0) 14px 0',
            height: `calc(56px + env(safe-area-inset-top, 0))`,
            gap: 12,
          }),
        }),
      }}>
        {isMobile ? (
          <>
            {/* Linha 1 — navegação: Início · marca · Gerar · Perfil */}
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
                <BrandLogo height={22} style={{ maxWidth: 'min(100%, 140px)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {editorGenerateBtn}
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
            {/* Linha 2 — ferramentas secundárias (modo / biblioteca / IA) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              minHeight: 40,
            }}>
              {editorHeaderActions}
            </div>
            <EditorFormatSelector fmt={fmt} setFmt={setFmt} layout="mobile" />
          </>
        ) : (
          <>
        {/* Esquerda — marca + Projetos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, overflow: 'hidden' }}>
          <BrandLogo
            variant={headerVeryTight ? 'mark' : 'wordmark'}
            height={26}
            style={{ maxWidth: headerVeryTight ? 26 : 220 }}
          />
          <div style={{ minWidth: 0 }}>
            {activeEntry && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'nowrap', minWidth: 0 }}>
                <button
                  type="button"
                  onClick={async () => {
                    const current = activeEntry.name || 'Carrossel';
                    const next = await askPrompt({
                      title: 'Renomear projeto',
                      label: 'Nome',
                      defaultValue: current,
                      placeholder: 'Ex: Campanha de lançamento',
                      cta: 'Renomear',
                    });
                    if (next && next.trim() && next !== current) renameDoc(activeEntry.id, next.trim());
                  }}
                  style={{
                    fontSize: 11, color: 'var(--text-muted)', letterSpacing: '-0.011em',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    maxWidth: headerVeryTight ? 68 : (headerTight ? 96 : 160), minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    textAlign: 'left',
                  }}
                  title="Clique para renomear"
                >
                  {activeEntry.name || 'Sem título'}
                </button>
                {!headerTight && <SavedIndicator savedAt={lastSavedAt} />}
                <button
                  type="button"
                  onClick={salvarProjeto}
                  disabled={cloudSyncBusy || !accountLibraryReady}
                  aria-busy={cloudSyncBusy}
                  title="Salvar projeto agora (⌘S)"
                  aria-label="Salvar projeto agora"
                  style={{
                    width: headerVeryTight ? 30 : 'auto', height: headerVeryTight ? 30 : 24,
                    padding: headerVeryTight ? 0 : '0 10px', borderRadius: 9999,
                    border: '1px solid var(--border)', background: 'var(--bg-card)',
                    color: 'var(--text-primary)', fontSize: 11, fontWeight: 600,
                    fontFamily: 'var(--font-ui)', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  <Save size={11} aria-hidden/>
                  {!headerVeryTight && (cloudSyncBusy ? 'Salvando…' : 'Salvar')}
                </button>
              </div>
            )}
          </div>
          {!headerTight && editorPillBtn(() => goAccount('projects'), 'Projetos', Home)}
        </div>

        {/* Centro — Gerar com IA */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {editorGenerateBtn}
        </div>

        {/* Direita — ferramentas + Perfil (extremo direito) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0 }}>
          {!headerTight && historyFormatGroup}
          {editorHeaderActions}
          {editorAccountNav}
        </div>

        {/* Linha 2 (desktop estreito) — histórico + formato */}
        {headerTight && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {historyFormatGroup}
          </div>
        )}
          </>
        )}
      </header>

      <ProjectContextBanner
        styleKit={styleKit}
        projectName={activeEntry?.name}
        onUndo={history.undo}
        canUndo={history.canUndo}
      />

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
        <div data-vc-export-tree style={{ position:'fixed', left:'-99999px', top:0, pointerEvents:'none', opacity:0, zIndex:-1 }} aria-hidden>
          {slides.map((s,i)=>(
            <SlideCard
              key={`exp-${s.id}`}
              ref={el=>slideRefs.current[s.id]=el}
              slide={s} fmt={fmt} brand={brand} num={i+1} total={slides.length} scale={1}
              creativePreset={creativePreset}
              showCanvasChrome={false}
              forExport
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
            <div
              ref={thumbnailStripRef}
              style={{ display:'flex', alignItems:'center', gap:6, overflowX:'auto', paddingBottom:2, scrollPaddingInline:8 }}
            >
              {slides.map((s, i) => {
                const stripThumbFil = slideStoredPresentationCssFilter(s);
                return (
                <button
                  key={s.id}
                  ref={(el) => { thumbnailRefs.current[i] = el; }}
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
                  aria-label={`${isPresentationProject ? 'Slide' : 'Card'} ${i+1} de ${slides.length}`}
                >
                  <div style={{
                    width:stripThumbWidth, height:stripThumbHeight, borderRadius:4, overflow:'hidden', position:'relative',
                    background: resolveSlideBrandBg(brand, i, s),
                    ...(stripThumbFil ? { filter: stripThumbFil } : {}),
                  }}>
                    <span style={{
                      position:'absolute', left:5, right:5, top:'50%', transform:'translateY(-50%)',
                      fontSize:isPresentationProject ? 5.5 : 5, lineHeight:1.14, fontWeight:700,
                      color:'rgba(255,255,255,0.82)', overflow:'hidden', display:'-webkit-box',
                      WebkitLineClamp: isPresentationProject ? 2 : 3, WebkitBoxOrient:'vertical',
                      textAlign:'left', overflowWrap:'anywhere',
                    }}>
                      {s.bgImageFailed ? 'Imagem pendente' : (s.title || 'Sem título')}
                    </span>
                    {s.bgImage ? (
                      <div style={{ position:'absolute', inset:0, overflow:'hidden' }}>
                        <img
                          src={s.bgImage}
                          alt=""
                          loading="eager"
                          onError={(event) => { event.currentTarget.parentElement.style.display = 'none'; }}
                          style={{
                            position:'absolute', inset:0, width:'100%', height:'100%',
                            objectFit:s.bgFit === 'contain' ? 'contain' : 'cover',
                            objectPosition:`${s.bgX ?? 50}% ${s.bgY ?? 50}%`,
                            transform:`scale(${Math.max(0.5, (s.bgZoom ?? 100) / 100)}) scaleX(${s.bgMirror ? -1 : 1})`,
                          }}
                        />
                        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.10)' }}/>
                      </div>
                    ) : null}
                    <span style={{
                      position:'absolute', bottom:3, left:4,
                      fontSize:7, fontWeight:700, color:'rgba(255,255,255,0.7)',
                      fontFamily:'var(--font-mono)', letterSpacing:'0.04em',
                    }}>{String(i+1).padStart(2,'0')}</span>
                  </div>
                </button>
                );
              })}
              <button onClick={addSlide} aria-label={`Adicionar ${isPresentationProject ? 'slide à apresentação' : 'card ao carrossel'}`} style={{
                flexShrink:0, width:stripThumbWidth, height:stripThumbHeight, borderRadius:4,
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
                padding: isMobile ? '20px 16px calc(108px + env(safe-area-inset-bottom, 0))' : 24,
                boxSizing: 'border-box',
              }}>
                <div style={{
                  textAlign:'center',
                  maxWidth: isMobile ? 'min(100%, 360px)' : 360,
                  width: '100%',
                  padding: '0 12px',
                  boxSizing: 'border-box',
                  animation:'fadeUp 0.3s var(--ease-smooth)',
                }}>
                  <div style={{
                    width: isMobile ? 64 : 72,
                    height: isMobile ? 64 : 72,
                    borderRadius: 18,
                    margin: '0 auto 24px',
                    overflow: 'hidden',
                    boxShadow: '0 0 28px rgba(91, 83, 232, 0.28)',
                  }}>
                    <BrandLogo variant="mark" height={isMobile ? 64 : 72} style={{ borderRadius: 18 }} />
                  </div>
                  <div style={{
                    fontSize: isMobile ? 26 : 36,
                    fontWeight:600,
                    fontFamily:'var(--font-display)',
                    color:'var(--text-primary)',
                    letterSpacing:'-0.022em',
                    marginBottom:12,
                    lineHeight:1.1,
                    padding: '0 4px',
                    wordBreak: 'break-word',
                  }}>
                    Escolha como sua ideia<br/><span style={{ color:'var(--accent)' }}>vai avançar.</span>
                  </div>
                  <p style={{
                    fontSize:15,
                    color:'var(--text-secondary)',
                    marginBottom: isMobile ? 24 : 32,
                    lineHeight:1.45,
                    letterSpacing:'-0.011em',
                    fontWeight:400,
                    padding: '0 4px',
                    wordBreak: 'break-word',
                  }}>
                    Comunicação transforma uma ideia em sequência de cards.<br/>
                    Apresentação organiza contexto, argumento e evidência em slides.
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:10, width: '100%' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (appMode === 'criador') {
                          if (activeProductKind === 'apresentacao') setCreativePreset('livre');
                          setTab('home');
                          if (isMobile) setDrawerOpen(true);
                          requestAnimationFrame(() => {
                            const el = document.querySelector('[data-vc-quick-prompt]');
                            el?.focus?.();
                          });
                          return;
                        }
                        generateProjectByKind('carrossel');
                      }}
                      aria-label={appMode === 'criador' ? 'Escrever o pedido na sidebar' : 'Gerar carrossel com IA'}
                      style={{
                      minHeight:56,
                      width: '100%',
                      boxSizing: 'border-box',
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
                      padding: '10px 18px',
                      overflow: 'hidden',
                      transition:'background-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
                    }}>
                      <Sparkles size={16} style={{ flexShrink: 0 }}/>
                      <span style={{ display:'grid', gap:2, textAlign:'left', minWidth: 0 }}>
                        <strong style={{ fontSize:15, lineHeight:1.1 }}>Moont Comunica</strong>
                        <span style={{ fontSize:11, lineHeight:1.2, opacity:0.82, fontWeight:500 }}>Ideia → sequência de cards</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (appMode === 'criador') {
                          setCreativePreset(APRESENTACAO_PRESET_ID);
                          setTab('home');
                          if (isMobile) setDrawerOpen(true);
                          requestAnimationFrame(() => {
                            document.querySelector('[data-vc-quick-prompt]')?.focus?.();
                          });
                          return;
                        }
                        generateProjectByKind('apresentacao');
                      }}
                      aria-label="Gerar apresentação com IA"
                      style={{
                        minHeight:56,
                        width: '100%',
                        boxSizing: 'border-box',
                        borderRadius:9999,
                        border:'1px solid var(--border)',
                        cursor:'pointer',
                        background:'var(--bg-elevated)',
                        color:'var(--text-primary)',
                        fontSize:15,
                        fontWeight:600,
                        fontFamily:'var(--font-ui)',
                        letterSpacing:'-0.016em',
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        gap:10,
                        padding: '10px 18px',
                        overflow: 'hidden',
                        transition:'border-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
                      }}
                      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      <Layers size={16} style={{ flexShrink: 0 }}/>
                      <span style={{ display:'grid', gap:2, textAlign:'left', minWidth: 0 }}>
                        <strong style={{ fontSize:15, lineHeight:1.1 }}>Moont Apresenta</strong>
                        <span style={{ fontSize:11, lineHeight:1.2, color:'var(--text-muted)', fontWeight:500 }}>Contexto → argumento → evidência</span>
                      </span>
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
                  padding:'16px 12px calc(108px + env(safe-area-inset-bottom, 0))',
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
                    generateImageBusy={!!slideImgGenBusy[slide.id]}
                    enableZoneSwapDrag={canvasEditMode}
                    movableElements={!canvasEditMode}
                    onElementOffsetChange={patchElementOffsetAt}
                    onInlineTextChange={(field, text) => patchInlineTextAt(activeIdx, field, text)}
                    onCreateText={(position) => createTextAreaAt(activeIdx, position)}
                    autoEditOverlayId={editingTextArea?.slideId === slide.id ? editingTextArea.overlayId : null}
                    onOverlayEditEnd={finishTextAreaEdit}
                    onElementSelect={(key) => setSelectedCardElement({ slideId: slide.id, key })}
                    selectedElement={selectedCardElement?.slideId === slide.id ? selectedCardElement.key : null}
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
                          {appMode === 'criador' ? 'Comece pelo pedido' : 'Comece em 3 caminhos'}
                        </div>
                        <div style={{ opacity:0.85, fontSize:10, lineHeight:1.6 }}>
                          {appMode === 'criador' ? (
                            <>→ Escreva o pedido na <strong style={{ color:'#fff' }}>sidebar</strong><br/>
                            → Toque em <strong style={{ color:'#fff' }}>{activeProductKind === 'apresentacao' ? 'Gerar apresentação' : 'Moont Comunica'}</strong><br/>
                            → Revise e baixe {activeProductKind === 'apresentacao' ? 'o PDF' : 'os PNGs'}</>
                          ) : activeProductKind === 'apresentacao' ? (
                            <>→ Clique em <strong style={{ color:'#fff' }}>Gerar com IA</strong> no canto<br/>
                            → Escolha a <strong style={{ color:'#fff' }}>estrutura da apresentação</strong><br/>
                            → Ou edite o slide aqui mesmo</>
                          ) : (
                            <>→ Clique em <strong style={{ color:'#fff' }}>Gerar com IA</strong> no canto<br/>
                            → Escolha um <strong style={{ color:'#fff' }}>Template pronto</strong><br/>
                            → Ou edite o card aqui mesmo</>
                          )}
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
                      onClick={() => setCaptionEditorIdx(activeIdx)}
                      title="Ver e editar legenda deste card"
                      aria-label={`Legenda do card ${activeIdx + 1}`}
                      style={{
                        minWidth:36, minHeight:36, borderRadius:9999, cursor:'pointer',
                        background: String(slide?.caption || '').trim() ? 'var(--accent-surface)' : 'transparent',
                        border:'none',
                        color: String(slide?.caption || '').trim() ? 'var(--accent)' : 'var(--text-secondary)',
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        transition:'background 0.12s, color 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background='var(--bg-pearl)'; e.currentTarget.style.color='var(--text-primary)'; }}
                      onMouseLeave={e => {
                        const has = String(slide?.caption || '').trim();
                        e.currentTarget.style.background = has ? 'var(--accent-surface)' : 'transparent';
                        e.currentTarget.style.color = has ? 'var(--accent)' : 'var(--text-secondary)';
                      }}
                    >
                      <AlignLeft size={15}/>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCardTarget(activeIdx)}
                      disabled={slides.length <= 1 && selectedCardElement?.slideId !== slide.id}
                      title={selectedCardElement?.slideId === slide.id ? 'Excluir elemento selecionado' : (slides.length <= 1 ? 'O projeto precisa manter pelo menos um card' : `Excluir card ${activeIdx + 1}`)}
                      aria-label={selectedCardElement?.slideId === slide.id ? 'Excluir elemento selecionado' : `Excluir card ${activeIdx + 1}`}
                      style={{
                        minWidth:36, minHeight:36, borderRadius:9999,
                        cursor: slides.length <= 1 && selectedCardElement?.slideId !== slide.id ? 'not-allowed' : 'pointer',
                        background:'transparent', border:'none', color:'#f87171',
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        opacity: slides.length <= 1 && selectedCardElement?.slideId !== slide.id ? 0.35 : 1,
                      }}
                    >
                      <Trash2 size={15}/>
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
                  collapsible
                  key={`img-ref-m-${slide.id}`}
                  slide={slide}
                  width={Math.min(vw - 48, f.w * previewScale)}
                  onChangeExtra={(v) => updateSlide({ imgExtraPrompt: v })}
                  onRemoveRef={() => removeSlideReference(activeIdx)}
                  onPickRef={() => openRefImagePicker(activeIdx)}
                  onGenerateImage={() => generateSlideImageAt(activeIdx)}
                  generateImageBusy={!!slideImgGenBusy[slide.id]}
                  itemLabel={isPresentationProject ? 'slide' : 'card'}
                  generationState={slideImageGenerationState(slide, imageGenerationAvailability, styleKit)}
                />
              </div>
            ) : (
              // Desktop: all slides row
              <div style={{ padding:'28px 48px', display:'flex', gap:20, alignItems:'flex-start', minHeight:'100%' }}>
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
                      }}
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
                        generateImageBusy={!!slideImgGenBusy[s.id]}
                        enableZoneSwapDrag={canvasEditMode}
                        movableElements={!canvasEditMode}
                        onElementOffsetChange={patchElementOffsetAt}
                        onInlineTextChange={(field, text) => patchInlineTextAt(i, field, text)}
                        onCreateText={(position) => createTextAreaAt(i, position)}
                        autoEditOverlayId={editingTextArea?.slideId === s.id ? editingTextArea.overlayId : null}
                        onOverlayEditEnd={finishTextAreaEdit}
                        onElementSelect={(key) => { setActiveIdx(i); setSelectedCardElement({ slideId: s.id, key }); }}
                        selectedElement={selectedCardElement?.slideId === s.id ? selectedCardElement.key : null}
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
                          onClick={(e)=>{ e.stopPropagation(); setActiveIdx(i); setCaptionEditorIdx(i); }}
                          title="Ver e editar legenda deste card"
                          aria-label={`Legenda do card ${i+1}`}
                          style={{
                            background: String(s.caption || '').trim() ? 'var(--accent-surface)' : 'none',
                            border:'none',
                            color: String(s.caption || '').trim() ? 'var(--accent)' : 'var(--text-muted)',
                            cursor:'pointer', padding:6, borderRadius:6, transition:'color 0.12s, background 0.12s',
                            display:'inline-flex', alignItems:'center', justifyContent:'center',
                            minWidth:32, minHeight:32,
                          }}
                          onMouseEnter={e=>e.currentTarget.style.color='var(--text-primary)'}
                          onMouseLeave={e=>{
                            const has = String(s.caption || '').trim();
                            e.currentTarget.style.color = has ? 'var(--accent)' : 'var(--text-muted)';
                          }}
                        ><AlignLeft size={11}/></button>
                        <button
                          onClick={(e)=>{ e.stopPropagation(); setActiveIdx(i); deleteCardTarget(i); }}
                          disabled={slides.length <= 1 && selectedCardElement?.slideId !== s.id}
                          title={selectedCardElement?.slideId === s.id ? 'Excluir elemento selecionado' : (slides.length <= 1 ? 'O projeto precisa manter pelo menos um card' : `Excluir card ${i+1}`)}
                          aria-label={selectedCardElement?.slideId === s.id ? 'Excluir elemento selecionado' : `Excluir card ${i+1}`}
                          style={{
                            background:'none', border:'none', color:'#f87171',
                            cursor: slides.length <= 1 && selectedCardElement?.slideId !== s.id ? 'not-allowed' : 'pointer', padding:6, borderRadius:6,
                            display:'inline-flex', alignItems:'center', justifyContent:'center',
                            minWidth:32, minHeight:32, opacity: slides.length <= 1 && selectedCardElement?.slideId !== s.id ? 0.35 : 1,
                          }}
                        ><Trash2 size={11}/></button>
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
                      collapsible
                      key={`img-ref-${s.id}`}
                      slide={s}
                      width={desktopThumbWidth}
                      onChangeExtra={(v) => updateSlideAt(i, { imgExtraPrompt: v })}
                      onRemoveRef={() => removeSlideReference(i)}
                      onPickRef={() => openRefImagePicker(i)}
                      onGenerateImage={() => generateSlideImageAt(i)}
                      generateImageBusy={!!slideImgGenBusy[s.id]}
                      itemLabel={isPresentationProject ? 'slide' : 'card'}
                      generationState={slideImageGenerationState(s, imageGenerationAvailability, styleKit)}
                    />
                  </div>
                ))}
                {/* Respiro no fim da fila: o padding-right do contentor flex não
                    entra no scrollWidth, e sem isto o último card fica colado
                    à borda quando se rola até ao fim. */}
                <div
                  aria-hidden
                  style={{
                    flexShrink:0,
                    width:Math.max(48, Math.floor((vw - 272 - desktopThumbWidth) / 2)),
                  }}
                />
              </div>
            )}
          </div>

          {/* Mobile bottom bar — tabs sempre visíveis (também no empty) + Exportar
              compacto. Chrome claro alinhado ao DS Figma (sem glow saturado). */}
          {isMobile && !drawerOpen && (
            <nav
              data-vc-tour="mobile-bar"
              aria-label="Abas do editor"
              style={{
              position:'fixed', bottom:0, left:0, right:0, zIndex:20,
              background:'var(--bg-sidebar)',
              borderTop:'1px solid var(--hairline)',
              padding:'8px 8px calc(8px + env(safe-area-inset-bottom, 0))',
              display:'flex', gap:8, alignItems:'stretch',
              boxShadow:'0 -4px 16px rgba(0,0,0,0.06)',
            }}
            >
              <div style={{
                flex:1, display:'flex',
                gap:4,
                overflowX:'auto',
                WebkitOverflowScrolling:'touch',
                scrollbarWidth:'none',
              }}>
              {visibleEditorTabs(appMode).map(({ id, label, icon:Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className="vc-pressable"
                    onClick={() => { setTab(id); setDrawerOpen(true); }}
                    style={{
                      flex:'1 0 auto',
                      minWidth:56,
                      minHeight:56,
                      padding:'6px 8px',
                      borderRadius:12,
                      border: active
                        ? '1px solid var(--accent)'
                        : '1px solid transparent',
                      background: active
                        ? 'var(--accent-surface)'
                        : 'transparent',
                      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontSize:12, fontWeight:600, fontFamily:'var(--font-ui)', cursor:'pointer',
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3,
                      letterSpacing:'-0.011em',
                      transition:'background 0.15s var(--ease-smooth), border-color 0.15s, color 0.15s',
                    }}
                    aria-label={`Abrir aba ${label}`}
                    aria-pressed={active}
                  >
                    <Icon size={18} strokeWidth={active ? 2.35 : 2}/>
                    <span style={{ lineHeight:1.1, whiteSpace:'nowrap' }}>{label}</span>
                  </button>
                );
              })}
              </div>
              {!empty && (
              <button
                type="button"
                className="vc-pressable"
                onClick={() => exportSlide(activeIdx)}
                disabled={exporting}
                style={{
                  alignSelf:'center',
                  width:56, height:56, borderRadius:9999,
                  border:'none', cursor: exporting ? 'wait' : 'pointer',
                  background:'var(--accent)', color:'var(--accent-on-dark, #fff)',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1,
                  letterSpacing:'-0.011em',
                  opacity:exporting?0.5:1,
                  flexShrink:0,
                  transition:'transform 0.12s var(--ease-smooth), opacity 0.15s',
                }}
                aria-label="Exportar card atual"
                title="Exportar"
              >
                <Download size={18} strokeWidth={2.4}/>
                <span style={{ fontSize:8, fontWeight:700, letterSpacing:'0.04em' }}>PNG</span>
              </button>
              )}
            </nav>
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

      {/* Lazy modals — fora do chunk inicial do studio */}
      <Suspense fallback={null}>
      {/* Onboarding dos 3 modos — primeira visita ou reabrível via ? */}
      <ModesIntroModal
        open={modesIntroOpen}
        currentMode={appMode}
        onSelect={(m) => { setAppMode(m); closeModesIntro(); toast(`${appModeLabel(m)} ativo. Pode mudar a qualquer momento.`, 'success', 4000); }}
        onClose={closeModesIntro}
      />

      <GenerationStatus
        progress={analyzingBrandTone
          ? { phase: 'tone', label: 'Analisando publicações e tom da marca…' }
          : genProgress}
        onCancel={cancelGeneration}
      />

      {/* Modals */}
      <KeysModal
        open={keysOpen}
        onClose={()=>setKeysOpen(false)}
        aiSettings={aiSettings}
        onSaveSettings={setAISettings}
      />
      <GenerateModal
        open={setupOpen}
        productKind={setupProductKind}
        presentationPath={presentationPath}
        onClose={()=>{setSetupOpen(false);setPrefilledTopic('');}}
        onGenerate={handleGenerate}
        onCancelGeneration={cancelGeneration}
        defaultNiche={niche}
        defaultTopic={prefilledTopic}
        defaultTone={brand.defaultTone || ''}
        defaultAudience={brand.defaultAudience || ''}
        hasOpenAI={hasOpenAI}
        hasAnthropic={hasAnthropic}
        defaultWithImages={appMode !== 'criador'}
        imageProviderLabel={
          aiSettings.imageModels?.openai === 'gpt-image-1.5' ? 'GPT Image 1.5' : 'GPT Image 2'
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
        contentObjective={contentObjective}
        resultsLibrary={library}
        performanceSettings={performanceSettings}
        onCreativePresetChange={setCreativePreset}
        slideTextDensity={slideTextDensity}
        onSlideTextDensityChange={setSlideTextDensity}
        cardVisualStyle={cardVisualStyle}
        onCardVisualStyleChange={setCardVisualStyle}
        visualPreset={visualPreset}
        onVisualPresetChange={applyVisualStylePreset}
        visualPresets={visualPresets}
        material={material}
        setMaterial={setMaterial}
        hookLibrary={hookLibrary}
      />
      {resultsOpen && <PublicationResultsModal
        key={activeEntry.id}
        doc={doc}
        library={library}
        projectId={activeEntry.id}
        settings={performanceSettings}
        onSettingsChange={patch => setLibrary(prev => prev.map(entry => entry.id === activeEntry.id
          ? { ...entry, performanceSettings: { ...performanceSettings, ...patch } } : entry))}
        onSave={(projectId, record) => {
          const next = savePublicationResult(library, projectId, record);
          setLibrary(next.map(entry => entry.id === activeEntry.id && !performanceSettings.account
            ? { ...entry, performanceSettings: { ...performanceSettings, account: record.account } } : entry));
        }}
        onRemove={id => setLibrary(prev => removePublicationResult(prev, id))}
        onClose={() => setResultsOpen(false)}
      />}
      <ResearchPanel
        open={researchOpen}
        onClose={()=>setResearchOpen(false)}
        onSetNiche={setNiche}
        onUseIdea={(text, researchMaterial) => {
          if (researchMaterial) setMaterial(m => ({
            ...m,
            content: [m.content, researchMaterial.content].filter(Boolean).join('\n\n'),
            sources: [m.sources, researchMaterial.sources].filter(Boolean).join('\n'),
          }));
          setResearchOpen(false); setPrefilledTopic(text); openGenerationSetup(activeProductKind);
        }}
        contentObjective={contentObjective}
        narrativeMode={mode}
        creativePreset={creativePreset}
        productKind={activeProductKind}
        presentationPath={presentationPath}
        openaiKey={openaiKey}
      />
      <SeriesPanel
        open={seriesOpen}
        onClose={() => setSeriesOpen(false)}
        projectId={activeEntry?.id}
        brand={brand}
        styleKit={styleKit}
        folderId={activeEntry?.folderId || ''}
        folders={libraryFolders}
        onCreateFolder={createFolder}
        openaiKey={openaiKey}
        toast={toast}
        onCreateDrafts={async (drafts) => {
          createSeriesDrafts(drafts);
          if (drafts[0]?.quickPrompt) setQuickPrompt(drafts[0].quickPrompt);
        }}
      />
      <TemplatesModal
        open={templatesOpen}
        onClose={()=>setTemplatesOpen(false)}
        onApply={applyTemplate}
      />
      {!isApresentacaoPreset(creativePreset) && <HookVariationsModal
        open={hookVarsOpen}
        onClose={()=>setHookVarsOpen(false)}
        slide={slide}
        slides={slides}
        contentObjective={contentObjective}
        niche={niche}
        brand={brand}
        material={material}
        styleKit={styleKit}
        openaiKey={openaiKey}
        narrativeMode={mode}
        creativePreset={creativePreset}
        onPick={(h)=>{
          updateSlide({ title: h.title, subtitle: h.subtitle || slide.subtitle });
          toast('Gancho atualizado', 'success');
        }}
      />}
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
        fmt={fmt}
        onClose={() => setImageCropOpen(false)}
        onApply={(dataUrl) => { void guardarImagemDoSlide(dataUrl).then((patch) => updateSlide({
          ...patch,
          bgImageSource: 'edited',
          bgImageFailed: false,
          bgImageError: null,
        })); }}
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
          try {
            localStorage.setItem(SK.onboarding, '1');
            localStorage.setItem(SK.modesIntro, '1');
          } catch { /* */ }
          tourScheduledRef.current = true;
          setTourOpen(false);
        }}
        isMobile={isMobile}
        empty={empty}
        setTab={setTab}
        setDrawerOpen={setDrawerOpen}
        onEnterEditor={tourEnterEditor}
        onPrepareRefsTourStep={tourPrepareRefsStep}
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
        caption={slides[activeIdx]?.caption || ''}
        setCaption={(value) => {
          const next = typeof value === 'function'
            ? value(slides[activeIdx]?.caption || '')
            : value;
          updateSlideAt(activeIdx, { caption: String(next ?? '') });
        }}
        captionLabel="Legenda deste card"
      />
      {captionEditorIdx != null && slides[captionEditorIdx] ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Legenda do card ${captionEditorIdx + 1}`}
          onClick={() => setCaptionEditorIdx(null)}
          style={{ zIndex: 1200 }}
        >
          <div
            className="modal-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 480, width: 'min(480px, calc(100% - 32px))', padding: 0 }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>
                  Legenda · card {String(captionEditorIdx + 1).padStart(2, '0')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Não aparece no visual do card — só para publicar / copiar.
                </div>
              </div>
              <button
                type="button"
                className="vc-icon-btn"
                aria-label="Fechar"
                onClick={() => setCaptionEditorIdx(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              <textarea
                className="vc-input vc-textarea"
                autoFocus
                rows={7}
                value={slides[captionEditorIdx].caption || ''}
                onChange={(e) => updateSlideAt(captionEditorIdx, { caption: e.target.value })}
                placeholder="Escreva a legenda deste card e as hashtags…"
                style={{ fontSize: 13, lineHeight: 1.5, resize: 'vertical', minHeight: 140 }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="vc-btn vc-btn-ghost"
                  style={{ minHeight: 36, fontSize: 12 }}
                  onClick={() => {
                    const text = String(slides[captionEditorIdx]?.caption || '').trim();
                    if (text) navigator.clipboard?.writeText(text);
                    toast?.(text ? 'Legenda copiada.' : 'Legenda vazia.', text ? 'success' : 'info', 2500);
                  }}
                >
                  <Copy size={13} /> Copiar
                </button>
                <button
                  type="button"
                  className="vc-btn"
                  style={{
                    minHeight: 36, fontSize: 12, borderRadius: 9999, border: 'none',
                    background: 'var(--accent)', color: '#fff', fontWeight: 600, padding: '0 16px',
                  }}
                  onClick={() => setCaptionEditorIdx(null)}
                >
                  Feito
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <LibraryModal
        open={libraryOpen}
        onClose={()=>setLibraryOpen(false)}
        library={library}
        folders={libraryFolders}
        activeDocId={activeDocId}
        onOpen={openDoc}
        onNew={createProjectByKind}
        onDuplicate={duplicateDoc}
        onNewFromContext={newFromContext}
        onDelete={deleteDoc}
        onRename={renameDoc}
        onSetStatus={setDocStatus}
        onSetFolder={setDocFolder}
        onSetPublicationDate={setDocPublicationDate}
        onCreateFolder={createFolder}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        onExportDoc={exportDoc}
        onExportAll={exportAllDocs}
        onImportTrigger={() => importDocRef.current?.click()}
        appMode={appMode}
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
      </Suspense>

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
