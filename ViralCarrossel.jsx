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
import { videoPut, videoGet, videoDelete, videoCleanupOrphans, videoStorageUsage, newVideoId } from './src/utils/video-store.js';
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
// Permite os componentes de render (SlideCardInner, ClassicCanvasInner) lerem
// o object URL de um vídeo sem precisar threadear via props.
let __vcVideoUrlMap = {};
function getVideoUrl(videoId) {
  return videoId ? __vcVideoUrlMap[videoId] || null : null;
}

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

// ─── STORAGE KEYS ─────────────────────────────────────────────────────────────
// Chaves centralizadas — nunca use string literal de localStorage diretamente.
const SK = {
  library:       'vc_library',
  legacyDoc:     'vc_doc',
  activeDocId:   'vc_active_doc_id',
  brands:        'vc_brands',
  activeBrandId: 'vc_active_brand_id',
  openaiKey:     'vc_openai_key',
  /** Toggle: usuário escolheu manter chave persistida (true) ou apenas na sessão (false / ausente). */
  openaiKeyPersist: 'vc_openai_key_persist',
  /** Chave Anthropic do navegador (em local dev, vai via proxy). */
  anthropicKey:  'vc_anthropic_key',
  anthropicKeyPersist: 'vc_anthropic_key_persist',
  /** Modelo Claude preferido: 'sonnet' (default, rápido) ou 'opus' (qualidade máxima). */
  claudeModel:   'vc_claude_model',
  aiSettings:    'vc_ai_settings',
  aiKeys:        'vc_ai_keys',
  /** Biblioteca de hooks (capas) que o usuário aprovou — sugerida em novas gerações do mesmo nicho. */
  hookLibrary:   'vc_hook_library',
  onboarding:    'vc_onboarding_done',
  /** Landing cinematográfica — dispensada nesta sessão após "Entrar no studio". */
  landingDismissed: 'vc_landing_dismissed',
  /** Legado (não usar para decidir se abre a landing). */
  landingDone:   'vc_landing_done',
  shellView:     'vc_shell_view',
  /** Lista no editor: grelha de alinhamento sobre o preview (não exportada). */
  previewGrid:   'vc_preview_align_grid',
  /** Sistema de Modos (FASE 2 Narrative OS): criador (default, 90%
      dos users), diretor (intermediate), studio (avançado). Controla
      progressive disclosure global. */
  appMode:       'vc_app_mode',
  /** Onboarding dos 3 modos — primeira visita ou clique no chip "?". */
  modesIntro:    'vc_modes_intro_done',
};

/** Preferência Home vs Editor: persiste como JSON `"home"` | `"project"` */
function readInitialShellView() {
  try {
    const raw = localStorage.getItem(SK.shellView);
    if (raw != null) {
      const val = JSON.parse(raw);
      if (val === 'home' || val === 'project') return val;
    }
  } catch {
    /* ignore */
  }
  try {
    const rawLib = localStorage.getItem(SK.library);
    if (!rawLib) return 'home';
    const lib = JSON.parse(rawLib);
    if (Array.isArray(lib) && lib.length) {
      const hasNonTrivial = lib.some((e) => {
        const sl = e?.doc?.slides;
        if (!Array.isArray(sl) || sl.length !== 1) return true;
        return sl[0]?.title !== 'Seu título aqui';
      });
      if (hasNonTrivial) return 'project';
    }
  } catch {
    /* ignore */
  }
  return 'home';
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

/** Proporção de exportação — uma linha no desktop; grelha largura total no mobile (evita barra apertada). */
function EditorFormatSelector({ fmt, setFmt, layout }) {
  // Mobile: segmented pill compacto (38px) em vez de grid 3-cards 80px+.
  // Liberta espaço vertical pro user ver os cards no preview enquanto
  // o drawer está aberto (drawer já é 55dvh).
  const grid = false;
  const wrapStyle = layout === 'mobile'
    ? {
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-card)',
        borderRadius: 9999,
        padding: 3,
        gap: 2,
        border: '1px solid var(--border)',
        width: '100%',
        flexShrink: 0,
      }
    : {
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-card)',
        borderRadius: 8,
        padding: 3,
        gap: 2,
        border: '1px solid var(--border)',
        flexShrink: 0,
      };

  return (
    <div style={wrapStyle} role="group" aria-label="Formato do card (exportação)">
      {Object.entries(FORMATS).map(([k, v]) => {
        const isActive = fmt === k;
        const ratio = v.h / v.w;
        const miniW = 14;
        const miniH = Math.max(10, Math.min(20, miniW * ratio));
        const compactLabel = v.label.split(/\s+/)[0];
        return (
          <button
            key={k}
            type="button"
            onClick={() => setFmt(k)}
            title={`${v.label} · ${v.w}×${v.h}`}
            style={
              grid
                ? {
                    minHeight: 44,
                    padding: '6px 4px',
                    borderRadius: 11,
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: 'var(--font-ui)',
                    letterSpacing: '-0.011em',
                    cursor: 'pointer',
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--hairline)'}`,
                    background: isActive ? 'var(--accent-surface-strong)' : 'var(--bg-base)',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    transition: 'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth)',
                  }
                : {
                    // No mobile (wrapper width 100%) preciso flex:1 pra
                    // 3 botões dividirem largura igualmente; no desktop
                    // fica padding natural (auto-width pill clássico).
                    flex: layout === 'mobile' ? '1 1 0' : 'initial',
                    minHeight: layout === 'mobile' ? 32 : undefined,
                    padding: layout === 'mobile' ? '6px 10px' : '5px 14px',
                    borderRadius: 9999,
                    fontSize: layout === 'mobile' ? 12 : 13,
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: 'var(--font-ui)',
                    letterSpacing: '-0.011em',
                    cursor: 'pointer',
                    border: 'none',
                    transition: 'background-color 0.15s var(--ease-smooth), color 0.15s var(--ease-smooth)',
                    background: isActive ? 'var(--bg-base)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                  }
            }
          >
            {grid && (
              <span
                style={{
                  display: 'inline-block',
                  width: miniW,
                  height: miniH,
                  border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--text-muted)'}`,
                  borderRadius: 2,
                  flexShrink: 0,
                }}
              />
            )}
            {layout === 'mobile' ? compactLabel : (grid ? compactLabel : v.label)}
          </button>
        );
      })}
    </div>
  );
}







/**
 * Nos slides Cultura/Tendência, a superfície «dark» alternada usava sempre #272729, ignorando
 * paletas tipo Coral/Carbon onde `brand.bg` já é escuro. Se o utilizador define fundo escuro na marca,
 * essa cor passa ao card em modo «dark». Fundos claros mantêm uma telha fixa institucional.
 */
function cultureDarkBackdropFromBrand(brandBg) {
  const fb = vcNormalizeHex('#272729');
  const n = vcNormalizeHex(brandBg || fb || '#272729');
  const rgb = n ? vcHexToRgb(n) : null;
  if (!rgb) return fb || '#272729';
  const L = vcRelLuminance01(rgb);
  if (L <= 0.2) return n;
  const tile = vcHexToRgb('#272729');
  if (!tile) return fb || '#272729';
  const out = ['r', 'g', 'b'].map((k) => Math.round(rgb[k] * 0.32 + tile[k] * 0.68));
  return `#${out.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}







/** Face CSS única por perfil de marca pro corpo de texto (evita colisão entre perfis e Google Fonts). */
const vcCustomBodyFace = (brandId) => `VCBrandBody-${brandId || 'default'}`;

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

function effectiveBodyFontFamily(brand) {
  if (!brand) return '"Inter Tight", sans-serif';
  return brand.customBodyFont?.dataUrl
    ? `${vcCustomBodyFace(brand.id)}, ${brand.bodyFont}`
    : brand.bodyFont;
}

const LAYOUT_POS_LAB_ROWS = [
  ['SUP.', 'ESQ.'], ['SUP.', 'CENTRO'], ['SUP.', 'DIR.'],
  ['MEIO', 'ESQ.'], ['MEIO', 'CENTRO'], ['MEIO', 'DIR.'],
  ['INF.', 'ESQ.'], ['INF.', 'CENTRO'], ['INF.', 'DIR.'],
];

const LAYOUTS = [
  { id:'tl', jc:'flex-start', ai:'flex-start', label:'↖', posLab: LAYOUT_POS_LAB_ROWS[0] },
  { id:'tc', jc:'flex-start', ai:'center',     label:'↑', posLab: LAYOUT_POS_LAB_ROWS[1] },
  { id:'tr', jc:'flex-start', ai:'flex-end',   label:'↗', posLab: LAYOUT_POS_LAB_ROWS[2] },
  { id:'ml', jc:'center',     ai:'flex-start', label:'←', posLab: LAYOUT_POS_LAB_ROWS[3] },
  { id:'mc', jc:'center',     ai:'center',     label:'⊕', posLab: LAYOUT_POS_LAB_ROWS[4] },
  { id:'mr', jc:'center',     ai:'flex-end',   label:'→', posLab: LAYOUT_POS_LAB_ROWS[5] },
  { id:'bl', jc:'flex-end',   ai:'flex-start', label:'↙', posLab: LAYOUT_POS_LAB_ROWS[6] },
  { id:'bc', jc:'flex-end',   ai:'center',     label:'↓', posLab: LAYOUT_POS_LAB_ROWS[7] },
  { id:'br', jc:'flex-end',   ai:'flex-end',   label:'↘', posLab: LAYOUT_POS_LAB_ROWS[8] },
];
/** Fallback de layout quando o slide tem id inválido / legacy — middle-center é o mais neutro. */
const DEFAULT_LAYOUT = LAYOUTS.find(l => l.id === 'mc') || LAYOUTS[4];

function layoutMiniBars(layoutId) {
  const yByRow = { t: 10, m: 21.5, b: 33 };
  const row = layoutId[0];
  const col = layoutId[1];
  const y = yByRow[row] ?? 21.5;
  const anchor = col === 'l' ? 'start' : col === 'c' ? 'center' : 'end';
  const tw = 17;
  const th = 4;
  const sw = 22;
  const sh = 3;
  const g = 1.5;
  const totalH = th + g + sh;
  const y0 = y - totalH / 2;
  const pad = 6;
  const W = 44;
  let tx;
  let sx;
  if (anchor === 'start') { tx = pad; sx = pad; }
  else if (anchor === 'center') { tx = (W - tw) / 2; sx = (W - sw) / 2; }
  else { tx = W - pad - tw; sx = W - pad - sw; }
  return {
    frame: { x: 4, y: 4, w: 36, h: 36, r: 5 },
    title: { x: tx, y: y0, w: tw, h: th },
    sub: { x: sx, y: y0 + th + g, w: sw, h: sh },
  };
}

function LayoutMiniIcon({ layoutId, active }) {
  const { frame, title: t, sub: s } = layoutMiniBars(layoutId);
  const frameStroke = active ? 'rgba(255,255,255,0.9)' : '#9a9a9e';
  const barFill = active ? 'rgba(255,255,255,0.95)' : '#6e6e73';
  return (
    <svg width="40" height="40" viewBox="0 0 44 44" aria-hidden style={{ display: 'block' }}>
      <rect
        x={frame.x}
        y={frame.y}
        width={frame.w}
        height={frame.h}
        rx={frame.r}
        ry={frame.r}
        fill="none"
        stroke={frameStroke}
        strokeWidth="1.25"
      />
      <rect x={t.x} y={t.y} width={t.w} height={t.h} rx="1.5" fill={barFill} />
      <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="1.25" fill={barFill} opacity="0.82" />
    </svg>
  );
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

function ImageFocalMiniIcon({ layoutId, active }) {
  const frame = { x: 4, y: 4, w: 36, h: 36, r: 5 };
  const centers = {
    tl: [12, 13], tc: [22, 13], tr: [32, 13],
    ml: [12, 22], mc: [22, 22], mr: [32, 22],
    bl: [12, 31], bc: [22, 31], br: [32, 31],
  };
  const [cx, cy] = centers[layoutId] || [22, 22];
  const bw = 15;
  const bh = 10;
  const frameStroke = active ? 'rgba(255,255,255,0.9)' : '#9a9a9e';
  const blobFill = active ? 'rgba(255,255,255,0.92)' : '#6e6e73';
  return (
    <svg width="40" height="40" viewBox="0 0 44 44" aria-hidden style={{ display: 'block' }}>
      <rect
        x={frame.x}
        y={frame.y}
        width={frame.w}
        height={frame.h}
        rx={frame.r}
        ry={frame.r}
        fill="none"
        stroke={frameStroke}
        strokeWidth="1.25"
      />
      <rect
        x={cx - bw / 2}
        y={cy - bh / 2}
        width={bw}
        height={bh}
        rx="2"
        fill={blobFill}
        opacity="0.95"
      />
    </svg>
  );
}

/** Região da foto no layout clássico (sem canvas / sem sanduíche cultura). */
const PHOTO_REGION_IDS = new Set(['full', 'inset_h_top', 'inset_h_middle', 'inset_h_bottom', 'inset_h_narrow_mid']);

function normalizePhotoRegion(slide) {
  const r = slide?.photoRegion ?? 'full';
  return PHOTO_REGION_IDS.has(r) ? r : 'full';
}

const PHOTO_REGION_GRID = [
  { id: 'full', lab1: 'FUNDO', lab2: 'CHEIO' },
  { id: 'inset_h_top', lab1: 'FAIXA', lab2: 'TOPO' },
  { id: 'inset_h_middle', lab1: 'FAIXA', lab2: 'MEIO' },
  { id: 'inset_h_bottom', lab1: 'FAIXA', lab2: 'BASE' },
  { id: 'inset_h_narrow_mid', lab1: 'FAIXA', lab2: 'FINA' },
];



function normalizeCardVisualStyle(v) {
  const r = typeof v === 'string' ? v : 'full';
  return CARD_VISUAL_STYLE_IDS.has(r) ? r : 'full';
}

const CARD_VISUAL_STYLE_OPTIONS = [
  { id: 'full', short: 'FUNDO', desc: 'Imagem em tela cheia com texto por cima.' },
  { id: 'inset_h_top', short: 'FOTO ↑', desc: 'Faixa de foto no topo, texto abaixo.' },
  { id: 'inset_h_middle', short: 'MEIO', desc: 'Título, faixa de foto no meio e subtítulo.' },
  { id: 'inset_h_bottom', short: 'FOTO ↓', desc: 'Texto no topo, faixa de foto em baixo.' },
];

function PhotoRegionMiniIcon({ regionId, active }) {
  const frame = { x: 4, y: 4, w: 36, h: 36, r: 5 };
  const stroke = active ? 'rgba(255,255,255,0.9)' : '#9a9a9e';
  const fill = active ? 'rgba(255,255,255,0.9)' : '#6e6e73';
  let inner = null;
  if (regionId === 'full') {
    inner = <rect x="9" y="9" width="26" height="26" rx="3" fill={fill} opacity={0.4} />;
  } else if (regionId === 'inset_h_top') {
    inner = <rect x="8" y="8" width="28" height="10" rx="2" fill={fill} />;
  } else if (regionId === 'inset_h_middle') {
    inner = <rect x="8" y="17" width="28" height="10" rx="2" fill={fill} />;
  } else if (regionId === 'inset_h_bottom') {
    inner = <rect x="8" y="26" width="28" height="10" rx="2" fill={fill} />;
  } else if (regionId === 'inset_h_narrow_mid') {
    inner = <rect x="10" y="19" width="24" height="7" rx="2" fill={fill} />;
  }
  return (
    <svg width="40" height="40" viewBox="0 0 44 44" aria-hidden style={{ display: 'block' }}>
      <rect
        x={frame.x}
        y={frame.y}
        width={frame.w}
        height={frame.h}
        rx={frame.r}
        ry={frame.r}
        fill="none"
        stroke={stroke}
        strokeWidth="1.25"
      />
      {inner}
    </svg>
  );
}



const BG_PATTERN_OPTIONS = [
  { id: 'none', label: 'Nenhum' },
  { id: 'grid', label: 'Grade (quadriculado)' },
  { id: 'dots', label: 'Bolinhas' },
  { id: 'hlines', label: 'Linhas horizontais' },
  { id: 'dlines', label: 'Linhas diagonais' },
  { id: 'diag_grid', label: 'Xadrez diagonal' },
];



function VcBgPatternLayer({ pattern, style: extra }) {
  const st = vcBgPatternDivStyle(pattern);
  if (!st) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        ...st,
        ...(extra || {}),
      }}
    />
  );
}

// ─── MODOS DE GERAÇÃO ─────────────────────────────────────────────────────────


const REFERENCE_PROFILE_BY_ID = Object.fromEntries(REFERENCE_PROFILES.map(p => [p.id, p]));

/** Sugestões de voz de referência por modo narrativo (opcional — serve de guia, não de regra fixa). */
const NARRATIVE_MODE_REF_VOICE_PAIRING = {
  editorial: 'Editorial premium · Tech didático · Finanças pop BR',
  deep: 'Editorial premium · Tech didático · Coach sóbrio',
  pain: 'Coach sóbrio · Clínica / estética · Microcriador BR',
  viral: 'Microcriador BR · Gancho provocador',
  storytelling: 'Storytelling em cena · Microcriador BR · Editorial premium',
  how_to: 'Tech didático · Coach sóbrio · Microcriador BR',
  jornalistico: 'Editorial premium · Tech didático',
  sensacionalista: 'Gancho provocador · Microcriador BR',
};

const PRESET_NICHES = [
  'Marketing digital','Empreendedorismo','Finanças pessoais','Saúde mental',
  'Fitness','Nutrição','Tecnologia','IA & produtividade','Design',
  'Carreira','Investimentos','Relacionamentos','Medicina estética','Direito',
];


/** Modo narrativo interno por arquétipo (template) — utilizador não escolhe (só em Personalizado). */
const QUICK_TEMPLATE_NARRATIVE_MODE = {
  erro_comum: 'editorial',
  tendencia: 'editorial',
  decodificacao: 'deep',
  comportamento: 'storytelling',
};


// ─── UTILS ────────────────────────────────────────────────────────────────────



// Persistência leve em localStorage com fallback seguro
const lsGet = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
};
// Evita spam de toast quando cada debounce de gravação volta a bater no limite.
let VC_QUOTA_SLIM_ALREADY_NOTIFIED = false;
let VC_QUOTA_HARD_ALREADY_NOTIFIED = false;







// lsSet retorna true em sucesso, false em falha.
// Em caso de QuotaExceededError dispara evento customizado que o App escuta para exibir toast.
const lsSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    const isQuota = err instanceof DOMException && (
      err.code === 22 || err.code === 1014 ||
      err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
    if (isQuota) {
      // Tenta salvar uma versão compacta: remove bgImage (base64) de todos os slides
      try {
        const slim = JSON.parse(JSON.stringify(value));
        if (key === 'vc_library' && Array.isArray(slim)) {
          slim.forEach(entry => {
            (entry.doc?.slides || []).forEach(s => { delete s.bgImage; });
          });
          localStorage.setItem(key, JSON.stringify(slim));
          if (!VC_QUOTA_SLIM_ALREADY_NOTIFIED) {
            VC_QUOTA_SLIM_ALREADY_NOTIFIED = true;
            window.dispatchEvent(new CustomEvent('vc:quota-warning', {
              detail: 'Limite de armazenamento quase atingido. Imagens de fundo foram omitidas do cache. Exporte seus projetos como JSON para não perder dados.',
            }));
          }
          return true;
        }
      } catch { /* fallback falhou também */ }
      if (!VC_QUOTA_HARD_ALREADY_NOTIFIED) {
        VC_QUOTA_HARD_ALREADY_NOTIFIED = true;
        window.dispatchEvent(new CustomEvent('vc:quota-exceeded', {
          detail: 'Limite de armazenamento do browser atingido. Exporte seus projetos como JSON antes que dados sejam perdidos.',
        }));
      }
    }
    return false;
  }
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

/**
 * html2canvas 1.4.x rasteriza mal `<img>` com `object-fit` + `transform` (sanduíche Cultura) — faixa achatada/larga.
 * Substituir por `div` com `background-*` replica o enquadramento sem distorcer no PNG/PDF.
 */
function vcFixHtml2CanvasImages(clonedDoc, clonedSlideRoot) {
  if (!clonedSlideRoot?.querySelectorAll) return;
  const view = clonedDoc.defaultView;
  if (!view?.getComputedStyle) return;
  const list = Array.from(clonedSlideRoot.querySelectorAll('img'));
  list.forEach((img) => {
    const src = img.getAttribute('src');
    if (!src) return;
    const parent = img.parentElement;
    if (!parent) return;

    const computed = view.getComputedStyle(img);
    const fit = (computed.objectFit || 'fill').trim();
    const pos = computed.objectPosition || '50% 50%';
    let bgSize = '100% 100%';
    if (fit === 'cover') bgSize = 'cover';
    else if (fit === 'contain') bgSize = 'contain';

    const stub = clonedDoc.createElement('div');
    stub.setAttribute('data-vc-html2canvas-img', '');
    const cssUrl = `url("${src.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`;
    stub.style.position = computed.position === 'static' ? 'absolute' : computed.position;
    stub.style.top = computed.top;
    stub.style.left = computed.left;
    stub.style.right = computed.right;
    stub.style.bottom = computed.bottom;
    stub.style.width = computed.width;
    stub.style.height = computed.height;
    stub.style.margin = computed.margin;
    stub.style.padding = computed.padding;
    stub.style.border = computed.border;
    stub.style.boxSizing = computed.boxSizing || 'border-box';
    stub.style.display = 'block';
    stub.style.transform = 'none';
    stub.style.filter = computed.filter;
    stub.style.opacity = computed.opacity;
    stub.style.borderRadius = computed.borderRadius;
    stub.style.pointerEvents = 'none';
    stub.style.backgroundImage = cssUrl;
    stub.style.backgroundRepeat = 'no-repeat';
    stub.style.backgroundSize = bgSize;
    stub.style.backgroundPosition = pos;

    parent.replaceChild(stub, img);
  });
}

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

/** Cobre a zona foto: toque direto no `<input>` (WebKit/iOS). Opacidade > 0 — alguns motores ignoram camada totalmente invisível. */
const VC_PHOTO_ZONE_HIT_LAYER_STYLE = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  margin: 0,
  padding: 0,
  border: 'none',
  opacity: 0.03,
  cursor: 'pointer',
  fontSize: 28,
  zIndex: 4,
  display: 'block',
  boxSizing: 'border-box',
};

/** `id` do input global (sidebar / fallback). */
const VC_PHOTO_ZONE_FILE_INPUT_ID = 'vc-photo-zone-file';

function vcIsCoarseTouchDevice() {
  return typeof window !== 'undefined' &&
    ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);
}

/** Distância máx. (Manhattan em px) para contar «toque» na zona foto — 18px era pouco com rato em card escalado. */
function vcPhotoZoneTapSlopPx() {
  if (typeof window === 'undefined') return 72;
  try {
    if (window.matchMedia?.('(pointer: coarse)').matches) return 140;
  } catch { /* ignore */ }
  if (vcIsCoarseTouchDevice()) return 140;
  return 72;
}

/** Telemóveis / Safari: após awaits o gesto já não abre âncoras — Web Share API (ficheiro) costuma funcionar. */
function vcPreferFileShareForDownloads() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  try {
    if ((navigator.maxTouchPoints ?? 0) > 0 && window.matchMedia('(max-width: 768px)').matches)
      return true;
  } catch { /* ignore */ }
  return false;
}

/** Descarga um Blob; em mobile tenta primeiro partilhar ficheiro, depois `<a download>`. */
async function downloadBlob(blob, filename) {
  const mime = blob.type || 'application/octet-stream';
  const tryShare =
    vcPreferFileShareForDownloads() &&
    typeof navigator.share === 'function' &&
    typeof File !== 'undefined' &&
    typeof navigator.canShare === 'function';

  if (tryShare) {
    try {
      const file = new File([blob], filename, { type: mime });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      /* continua para âncora */
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}



async function downloadCanvasPng(canvas, filename) {
  const blob = await canvasToPngBlob(canvas);
  await downloadBlob(blob, filename);
}

/** Migra modos antigos e `web_trend` (desativado na UI) → GPT Image. */
const normalizeSlideImgMode = (m) => {
  void m;
  return 'dalle';
};


/** Ajustes de imagem apenas para preview (ex.: tela cheia); valores típicos −50…+50, 0 = neutro. */
const PRESENTATION_IMG_ADJ_KEYS = ['exposure', 'brightness', 'contrast', 'color', 'blacks', 'tonalidade'];

const DEFAULT_PRESENTATION_IMG_ADJUST = Object.freeze({
  exposure: 0,
  brightness: 0,
  contrast: 0,
  color: 0,
  blacks: 0,
  tonalidade: 0,
});

/** Presets de filtro pré-configurados — atalho pra ajuste rápido na sidebar.
 *  Aplicados via `updateSlide({ presentationImgAdjust: PRESET[id] })`. */
const PRESENTATION_IMG_FILTER_PRESETS = [
  { id: 'neutro',    label: 'Neutro',    desc: 'Sem filtro', vals: { ...DEFAULT_PRESENTATION_IMG_ADJUST } },
  { id: 'editorial', label: 'Editorial', desc: 'Contraste +, cor sutil', vals: { exposure:0, brightness:-3, contrast:14, color:-6, blacks:6, tonalidade:0 } },
  { id: 'vintage',   label: 'Vintage',   desc: 'Quente + suave',           vals: { exposure:4, brightness:2, contrast:-6, color:10, blacks:-8, tonalidade:12 } },
  { id: 'bw',        label: 'P&B',       desc: 'Preto e branco contrastado', vals: { exposure:0, brightness:0, contrast:18, color:-50, blacks:8, tonalidade:0 } },
];

function normalizePresentationImgAdjust(raw) {
  const o = typeof raw === 'object' && raw ? raw : {};
  const out = { ...DEFAULT_PRESENTATION_IMG_ADJUST };
  const clampN = (k, lo, hi) => {
    const x = typeof o[k] === 'number' && Number.isFinite(o[k]) ? o[k] : 0;
    return Math.round(Math.max(lo, Math.min(hi, x)));
  };
  out.exposure = clampN('exposure', -50, 50);
  out.brightness = clampN('brightness', -50, 50);
  out.contrast = clampN('contrast', -50, 50);
  out.color = clampN('color', -50, 50);
  out.blacks = clampN('blacks', -50, 50);
  out.tonalidade = clampN('tonalidade', -45, 45);
  return out;
}

function buildPresentationImageFilter(vals) {
  const v = normalizePresentationImgAdjust(vals);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const expMul = Math.pow(2, clamp(v.exposure / 100, -0.8, 0.8));
  const briMul = clamp(1 + v.brightness / 120, 0.65, 1.45);
  const blkLift = clamp(1 + v.blacks / 130, 0.72, 1.35);
  const bright = clamp(expMul * briMul * blkLift, 0.22, 2.85);
  const contrastPct = clamp(100 + v.contrast * 0.55 - v.blacks * 0.1, 32, 200);
  const satPct = clamp(100 + v.color * 1.05, 0, 220);
  const hue = clamp(v.tonalidade, -45, 45);
  return `brightness(${bright}) contrast(${contrastPct}%) saturate(${satPct}%) hue-rotate(${hue}deg)`;
}

function presentationAdjustIsNeutral(v) {
  const n = normalizePresentationImgAdjust(v);
  return !PRESENTATION_IMG_ADJ_KEYS.some((k) => n[k] !== 0);
}

/** Filtro CSS dos ajustes gravados (`presentationImgAdjust`), ou undefined se neutro ou sem imagem. */
function slideStoredPresentationCssFilter(slide) {
  if (!slide?.bgImage) return undefined;
  const n = normalizePresentationImgAdjust(slide.presentationImgAdjust);
  if (presentationAdjustIsNeutral(n)) return undefined;
  return buildPresentationImageFilter(n);
}

/** Compara dois conjuntos já normalizados (ou brutos antes de normalizar). */
function presentationImgAdjustEquivalent(a, b) {
  const na = normalizePresentationImgAdjust(a);
  const nb = normalizePresentationImgAdjust(b);
  return PRESENTATION_IMG_ADJ_KEYS.every((k) => na[k] === nb[k]);
}

function formatPresentationAdjDisp(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '0';
  if (v === 0) return '0';
  return v > 0 ? `+${v}` : String(v);
}

const FULLSCREEN_IMG_ADJ_ROWS = [
  { key: 'exposure', label: 'Exposição', step: 5, min: -50, max: 50 },
  { key: 'brightness', label: 'Brilho', step: 5, min: -50, max: 50 },
  { key: 'contrast', label: 'Contraste', step: 5, min: -50, max: 50 },
  { key: 'color', label: 'Cor', step: 5, min: -50, max: 50, hint: 'Saturação da imagem.' },
  { key: 'blacks', label: 'Pretos', step: 5, min: -50, max: 50, hint: 'Levanta ou reforça áreas escuras (simulado).' },
  { key: 'tonalidade', label: 'Tonalidade', step: 3, min: -45, max: 45, hint: 'Matiz (desloca tons quentes/frios).' },
];

function FullscreenImageAdjustBar({
  disabled,
  adj,
  onBump,
  onSetKey,
  onResetSlide,
  onSave,
  anyDirty,
  hasPendingPersist,
  onClose,
}) {
  const btnBase = {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.07)',
    color: 'var(--accent-on-dark)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    opacity: disabled ? 0.35 : 1,
    transition: 'background 0.15s, transform 0.1s',
  };
  return (
    <div
      style={{
        pointerEvents: 'auto',
        maxWidth: 560,
        width: 'calc(100% - 40px)',
        margin: '0 auto',
        padding: '11px 12px 10px',
        borderRadius: 14,
        background: 'rgba(12,12,14,0.78)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxSizing: 'border-box',
      }}
      role="region"
      aria-label="Ajustes de imagem na apresentação"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.92)',
            fontFamily: 'var(--font-ui)',
            letterSpacing: '-0.022em',
            lineHeight: 1.2,
          }}
        >
          Ajustes da foto
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {typeof onClose === 'function' && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar painel de ajustes da foto"
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: 9999,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.88)',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--font-ui)',
                letterSpacing: '-0.011em',
                cursor: 'pointer',
                transition: 'background 0.15s, transform 0.1s',
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.95)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Fechar
            </button>
          )}
          <button
            type="button"
            disabled={disabled || !hasPendingPersist}
            onClick={onSave}
            aria-label="Salvar ajustes da foto neste projeto"
            style={{
              height: 30,
              padding: '0 14px',
              borderRadius: 9999,
              border: `1px solid ${hasPendingPersist && !disabled ? 'transparent' : 'rgba(255,255,255,0.14)'}`,
              background:
                hasPendingPersist && !disabled ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: hasPendingPersist && !disabled ? '#fff' : 'rgba(255,255,255,0.45)',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--font-ui)',
              letterSpacing: '-0.011em',
              cursor: disabled || !hasPendingPersist ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.45 : 1,
              transition: 'background 0.15s, transform 0.1s',
            }}
            onMouseDown={(e) => {
              if (!disabled && hasPendingPersist) e.currentTarget.style.transform = 'scale(0.95)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Salvar
          </button>
          <button
            type="button"
            disabled={disabled || !anyDirty}
            onClick={onResetSlide}
            aria-label="Redefinir ajustes deste slide"
            style={{
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--font-ui)',
              letterSpacing: '-0.011em',
              color: 'rgba(255,255,255,0.55)',
              background: 'transparent',
              border: 'none',
              cursor: disabled || !anyDirty ? 'not-allowed' : 'pointer',
              padding: '4px 2px',
              opacity: disabled || !anyDirty ? 0.42 : 1,
            }}
          >
            Redefinir este slide
          </button>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(252px, 1fr))',
          columnGap: 14,
          rowGap: 12,
          maxHeight: 'min(42vh, 360px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingBottom: 2,
          WebkitOverflowScrolling: 'touch',
          opacity: disabled ? 0.45 : 1,
          scrollbarWidth: 'thin',
        }}
      >
        {FULLSCREEN_IMG_ADJ_ROWS.map((row) => {
          const val = adj[row.key];
          const atMin = val <= row.min;
          const atMax = val >= row.max;
          const span = row.max - row.min || 1;
          const pct = ((val - row.min) / span) * 100;
          return (
            <div
              key={row.key}
              title={row.hint || undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                paddingBottom: 10,
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 10,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'var(--font-ui)',
                    color: 'rgba(255,255,255,0.58)',
                    letterSpacing: '-0.011em',
                    lineHeight: 1.25,
                  }}
                >
                  {row.label}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    fontFamily: 'var(--font-mono)',
                    color: 'rgba(255,255,255,0.95)',
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                    letterSpacing: '-0.02em',
                  }}
                  aria-live="polite"
                >
                  {formatPresentationAdjDisp(val)}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <button
                  type="button"
                  aria-label={`Diminuir ${row.label}`}
                  disabled={disabled || atMin}
                  style={btnBase}
                  onMouseDown={(e) => {
                    if (!disabled && !atMin) e.currentTarget.style.transform = 'scale(0.95)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onClick={() => onBump(row.key, -row.step)}
                >
                  <Minus size={12} strokeWidth={2.25} />
                </button>
                <input
                  type="range"
                  className="vc-fs-pres-range"
                  aria-label={`${row.label}: deslizar para ajustar`}
                  aria-valuemin={row.min}
                  aria-valuemax={row.max}
                  aria-valuenow={val}
                  disabled={disabled}
                  min={row.min}
                  max={row.max}
                  step={row.step}
                  value={val}
                  onChange={(e) => onSetKey(row.key, Number(e.target.value))}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    margin: '2px 0',
                    '--pct': `${pct}%`,
                    backgroundImage: `linear-gradient(to right, var(--accent-on-dark) 0%, var(--accent-on-dark) ${pct}%, rgba(255,255,255,0.2) ${pct}%, rgba(255,255,255,0.2) 100%)`,
                  }}
                />
                <button
                  type="button"
                  aria-label={`Aumentar ${row.label}`}
                  disabled={disabled || atMax}
                  style={btnBase}
                  onMouseDown={(e) => {
                    if (!disabled && !atMax) e.currentTarget.style.transform = 'scale(0.95)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onClick={() => onBump(row.key, row.step)}
                >
                  <Plus size={12} strokeWidth={2.25} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {!disabled && (
        <div
          style={{
            marginTop: 8,
            fontSize: 10,
            fontWeight: 400,
            lineHeight: 1.45,
            color: 'rgba(255,255,255,0.36)',
            fontFamily: 'var(--font-ui)',
            letterSpacing: '-0.011em',
          }}
        >
          Use «Salvar» para gravar no projeto (persiste ao fechar). Exportação PNG/PDF usa esta foto assim
          quando salvo. Ao fechar sem salvar, as alterações em aberto continuam só na sessão atual.
        </div>
      )}
      {disabled && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.45)',
            fontFamily: 'var(--font-ui)',
            letterSpacing: '-0.011em',
            lineHeight: 1.45,
          }}
        >
          Adicione uma imagem de fundo ao slide para ajustar.
        </div>
      )}
    </div>
  );
}













/** Parágrafos separados por `\n\n+` como no preview; devolve intervalos globais UTF-16 do texto trimmed. */
function listCultureParagraphWindows(fullRaw) {
  const raw = String(fullRaw ?? '');
  const windows = [];
  const reSep = /\n\n+/g;
  let chunkStartGlob = 0;
  let m;
  while ((m = reSep.exec(raw)) !== null) {
    pushTrimmedParagraphWindow(raw, chunkStartGlob, m.index, windows);
    chunkStartGlob = m.index + m[0].length;
  }
  pushTrimmedParagraphWindow(raw, chunkStartGlob, raw.length, windows);
  return windows;
}

function pushTrimmedParagraphWindow(raw, globFrom, globTo, out) {
  const chunk = raw.slice(globFrom, globTo);
  let lead = 0;
  while (lead < chunk.length && /\s/.test(chunk[lead])) lead++;
  let trail = chunk.length - 1;
  while (trail >= lead && /\s/.test(chunk[trail])) trail--;
  if (trail < lead) return;
  const display = chunk.slice(lead, trail + 1);
  out.push({ globStart: globFrom + lead, globEnd: globFrom + trail + 1, display });
}

function clipAccentIntervalsToWindow(intervalsGlob, ws, we) {
  if (!intervalsGlob?.length) return [];
  const clipped = [];
  for (const [s, e] of intervalsGlob) {
    const a = Math.max(s, ws);
    const b = Math.min(e, we);
    if (b > a) clipped.push([a - ws, b - ws]);
  }
  return mergeUtf16AccentIntervals(clipped);
}





function unionDestaqueRangeIntoSpans(spansIn, selA, selB, len) {
  const lo = Math.max(0, Math.min(len, Math.min(selA, selB)));
  const hi = Math.max(0, Math.min(len, Math.max(selA, selB)));
  if (hi <= lo || !len) return normalizeDestaqueSpansForLen(spansIn, len);
  return normalizeDestaqueSpansForLen([...(spansIn || []), [lo, hi]], len);
}

function CultureInlineRich({
  text,
  baseColor,
  accentColor,
  fontFamily,
  fontSize,
  lineHeight,
  fontWeight,
  letterSpacing,
  destaqueSpans,
}) {
  const wrapStyle = {
    color: baseColor,
    fontFamily,
    fontSize,
    lineHeight,
    fontWeight,
    letterSpacing,
    margin: 0,
    display: 'block',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  };
  if (text == null || text === '') return null;
  const parts = cultureAccentRenderablePieces(text, destaqueSpans);
  return (
    <span style={wrapStyle}>
      {parts.map((p, i) =>
        p.type === 'accent' ? (
          // Accent: SEMPRE visualmente distinto do base, mesmo quando a cor está washout.
          // - fontWeight 800 garante destaque acima de base 400/500/600 padrão
          // - se a cor accent estiver muito próxima do base (washout em fundos com baixo contraste),
          //   o weight extra ainda permite o usuário ver o destaque
          <span key={i} style={{
            color: accentColor,
            fontWeight: 800,
          }}>{p.v}</span>
        ) : (
          <span key={i}>{p.v}</span>
        ),
      )}
    </span>
  );
}

function CultureRichParagraphs({
  text,
  ink,
  accentColor,
  fontFamily,
  fontSize,
  lineHeight,
  fontWeight,
  letterSpacing,
  paraGap,
  destaqueSpans = null,
}) {
  const full = text ?? '';
  const windows = listCultureParagraphWindows(full);
  const globSpans = unifyAccentIntervalsUtf16(full, destaqueSpans);
  if (!windows.length) return null;
  return windows.map((w, idx) => (
    <p
      key={idx}
      style={{
        margin: 0,
        marginBottom: idx < windows.length - 1 ? paraGap : 0,
        textAlign: 'left',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <CultureInlineRich
        text={w.display}
        destaqueSpans={clipAccentIntervalsToWindow(globSpans, w.globStart, w.globEnd)}
        baseColor={ink}
        accentColor={accentColor}
        fontFamily={fontFamily}
        fontSize={fontSize}
        lineHeight={lineHeight}
        fontWeight={fontWeight}
        letterSpacing={letterSpacing}
      />
    </p>
  ));
}

function cultureResolveSurface(slide, num) {
  const t = (slide.cultureTone || '').trim();
  if (t === 'light' || t === 'dark' || t === 'accent') return t;
  return num % 2 === 0 ? 'light' : 'dark';
}





/** Quebra de linha segura em zonas estreitas (mobile / canvas). */
const VC_TEXT_ZONE_STYLE = {
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  hyphens: 'auto',
  boxSizing: 'border-box',
};

function rectsEqual(a, b) {
  return a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}











/** Personalizado · densidades 1/1 ou 1/2: dois primeiros full-bleed, miolo tipo Cultura com sanduíche. */
















/** Reforço de padding lateral em zonas texto canvas — tracking negativo + fontes grandes “comem” a margem antes do padding nominal. */
function canvasClassicTitlePaddingXPx(f, slide) {
  const insetZn = slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
  const base = f.w * (0.012 + insetZn * 0.004);
  const gutter = (f.w * CANVAS_AUTO_EDGE_PCT) / 100 * 0.34;
  const lsEm = ((-3 + (slide.titleTracking ?? 0)) / 100);
  const fsPx = f.w * 0.084 * ((slide.titleSize ?? 100) / 100);
  const bleed = lsEm < 0 ? (-lsEm) * fsPx * 1.75 : fsPx * 0.048;
  return Math.max(base, gutter + base * 0.12, base + bleed, f.w * 0.024);
}

function canvasClassicSubtitlePaddingXPx(f, slide) {
  const insetZn = slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
  const base = f.w * (0.012 + insetZn * 0.004);
  const gutter = (f.w * CANVAS_AUTO_EDGE_PCT) / 100 * 0.3;
  const lsEm = ((-1 + (slide.subTracking ?? 0)) / 100);
  const fsPx = f.w * 0.028 * ((slide.subSize ?? 100) / 100);
  const bleed = lsEm < 0 ? (-lsEm) * fsPx * 1.6 : fsPx * 0.058;
  return Math.max(base, gutter + base * 0.1, base + bleed, f.w * 0.021);
}

function canvasCultureSandwichPaddingXPx(f, slide) {
  const insetZn = slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
  const base = f.w * (0.012 + insetZn * 0.004);
  const tLs = ((-2.4 + (slide.titleTracking ?? 0)) / 100);
  const tFs = f.w * 0.036 * ((slide.titleSize ?? 100) / 100);
  const sLs = ((-1 + (slide.subTracking ?? 0)) / 100);
  const sFs = f.w * 0.031 * ((slide.subSize ?? 100) / 100);
  const bT = tLs < 0 ? (-tLs) * tFs * 1.55 + tFs * 0.05 : tFs * 0.048;
  const bS = sLs < 0 ? (-sLs) * sFs * 1.35 + sFs * 0.052 : sFs * 0.048;
  return Math.max(base, (f.w * CANVAS_AUTO_EDGE_PCT) / 100 * 0.32, base + Math.max(bT, bS * 0.75), f.w * 0.022);
}

function canvasCultureSandwichBottomPaddingXPx(f, slide) {
  const insetZn = slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
  const base = f.w * (0.012 + insetZn * 0.004);
  const ls = ((-1 + (slide.subTracking ?? 0)) / 100);
  const fsPx = f.w * 0.029 * (((slide.bodyAfterSize ?? slide.subSize) ?? 100) / 100);
  const bleed = ls < 0 ? (-ls) * fsPx * 1.45 : fsPx * 0.055;
  return Math.max(base, (f.w * CANVAS_AUTO_EDGE_PCT) / 100 * 0.28, base + bleed, f.w * 0.021);
}



function pctBox(rect, f) {
  const r = clampRect(rect);
  return {
    position: 'absolute',
    left: (f.w * r.x) / 100,
    top: (f.h * r.y) / 100,
    width: (f.w * r.w) / 100,
    height: (f.h * r.h) / 100,
    boxSizing: 'border-box',
  };
}



const VC_ZONE_DRAG_MIME = 'application/x-vc-canvas-zone';

/** Contorno + arrastar / redimensionar canto SE (zonas canvas). Opcional: grip para trocar conteúdo entre slides.
 *  A zona `photo` fica por cima do conteúdo — `photoZoneTap` abre o import de imagem em clique simples (sem arrasto). */
/** `interactionScale` = `transform: scale()` aplicado ao card na pré-visualização; sem isto o arrasto em ecrã fica «lento/errado» no telemóvel. */
function CanvasZonesOverlay({ f, zones, keys, onPatch, swapSlideIdx = null, swapZoneKeys, photoZoneTap = null, photoZoneFileChange = null, interactionScale = 1 }) {
  const dragRef = React.useRef(null);
  const zonesRef = React.useRef(zones);
  zonesRef.current = zones;

  const swapKeysEffective = React.useMemo(() => {
    if (swapSlideIdx == null) return null;
    if (Array.isArray(swapZoneKeys) && swapZoneKeys.length === 0) return [];
    const allow = swapZoneKeys && swapZoneKeys.length
      ? new Set(swapZoneKeys)
      : null;
    return keys.filter((k) => (allow ? allow.has(k) : true));
  }, [keys, swapSlideIdx, swapZoneKeys]);

  React.useEffect(() => {
    const sPx = Math.max(0.05, interactionScale || 1);
    const step = (clientX, clientY) => {
      const d = dragRef.current;
      if (!d || !onPatch) return;
      const dx = clientX - d.lastX;
      const dy = clientY - d.lastY;
      d.dist = (d.dist ?? 0) + Math.abs(dx) + Math.abs(dy);
      d.lastX = clientX;
      d.lastY = clientY;
      const cur = zonesRef.current[d.key];
      if (!cur) return;
      const b = clampRect(cur);
      const nx = dx / (f.w * sPx);
      const ny = dy / (f.h * sPx);
      if (d.mode === 'move') {
        onPatch({
          [d.key]: clampRect({
            ...b,
            x: b.x + nx * 100,
            y: b.y + ny * 100,
          }),
        });
      } else {
        onPatch({
          [d.key]: clampRect({
            ...b,
            w: b.w + nx * 100,
            h: b.h + ny * 100,
          }),
        });
      }
    };

    const mm = (e) => step(e.clientX, e.clientY);
    const tm = (e) => {
      if (!dragRef.current || !e.touches?.[0]) return;
      step(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    };
    /** Toque rápido sem arrasto relevante na zona foto = import (telemóveis: jitter do dedo aumenta tolerância). */
    const finish = () => {
      const d = dragRef.current;
      if (!d?.key || !photoZoneTap) {
        dragRef.current = null;
        return;
      }
      const tapSlop = d.key === 'photo' ? vcPhotoZoneTapSlopPx() : 18;
      /*
       * Toque na zona foto: `el.click()` no input file tem de correr no mesmo turno que o toque do utilizador
       * (Safari iOS). `tryPhotoZoneTapOnTouch` no `onTouchEnd` da zona faz isso.
       * O `touchend` no window pode disparar *antes* do handler da zona com delegação React — não esvaziar
       * `dragRef` aqui, senão o tap perde o estado. Limpa num microtask se a zona não consumiu.
       */
      if (d.key === 'photo' && d.fromTouch) {
        queueMicrotask(() => {
          if (dragRef.current === d) dragRef.current = null;
        });
        return;
      }
      dragRef.current = null;
      if (d.key === 'photo' && d.mode === 'move' && (d.dist ?? 0) < tapSlop) photoZoneTap();
    };

    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', finish);
    window.addEventListener('touchmove', tm, { passive: false });
    window.addEventListener('touchend', finish);
    window.addEventListener('touchcancel', finish);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', finish);
      window.removeEventListener('touchmove', tm);
      window.removeEventListener('touchend', finish);
      window.removeEventListener('touchcancel', finish);
    };
  }, [f.h, f.w, onPatch, photoZoneTap, interactionScale]);

  if (!zones || !onPatch) return null;

  return (
    <>
      {keys.map((k) => {
        if (!zones[k]) return null;
        const r = clampRect(zones[k]);
        const box = pctBox(r, f);
        const showSwapGrip = swapKeysEffective && swapKeysEffective.includes(k);

        const startResizeTouch = (e) => {
          const t = e.touches?.[0];
          if (!t) return;
          e.preventDefault();
          e.stopPropagation();
          dragRef.current = {
            key: k,
            mode: 'se',
            lastX: t.clientX,
            lastY: t.clientY,
            dist: 0,
          };
        };

        const startMove = (clientX, clientY, ev) => {
          ev.preventDefault?.();
          ev.stopPropagation?.();
          const fromTouch = !!(ev && String(ev.type || '').startsWith('touch'));
          dragRef.current = {
            key: k,
            mode: 'move',
            lastX: clientX,
            lastY: clientY,
            dist: 0,
            fromTouch,
          };
        };

        /** Safari/iOS: `input.click()` tem de correr na mesma cadeia do toque do utilizador.
         *  Abre o import aqui no `onTouchEnd` da zona; o fallback no `window` (`finish`) cobre rato. */
        const photoTapSlop = k === 'photo' ? vcPhotoZoneTapSlopPx() : 18;
        const tryPhotoZoneTapOnTouch = (e) => {
          if (k !== 'photo' || !photoZoneTap) return;
          const d = dragRef.current;
          if (!d || d.key !== 'photo' || d.mode !== 'move') return;
          if ((d.dist ?? 0) >= photoTapSlop) {
            dragRef.current = null;
            return;
          }
          e.stopPropagation();
          photoZoneTap();
          dragRef.current = null;
        };
        /** Rato: abre o ficheiro no `mouseup` da própria zona (mais fiável com delegação React / escalado). */
        const tryPhotoZoneTapOnMouseUp = (e) => {
          if (k !== 'photo' || !photoZoneTap) return;
          if (e.button !== 0) return;
          const d = dragRef.current;
          if (!d || d.key !== 'photo' || d.mode !== 'move' || d.fromTouch) return;
          if ((d.dist ?? 0) >= photoTapSlop) return;
          e.stopPropagation();
          photoZoneTap();
          dragRef.current = null;
        };

        return (
          <div
            key={k}
            style={{
              ...box,
              zIndex: 45,
              pointerEvents: 'auto',
              touchAction: 'none',
              border: '2px dashed var(--accent)',
              borderRadius: 8,
              background: 'var(--accent-surface)',
            }}
            onTouchStart={(e) => {
              if (e.target.closest('input[type="file"]') || e.target.closest('[data-vc-handle]') || e.target.closest('[data-vc-swap-grip]')) return;
              const t = e.touches[0];
              if (!t) return;
              startMove(t.clientX, t.clientY, e);
            }}
            onTouchEnd={(e) => {
              if (e.target.closest('input[type="file"]') || e.target.closest('[data-vc-handle]') || e.target.closest('[data-vc-swap-grip]')) return;
              tryPhotoZoneTapOnTouch(e);
            }}
            onMouseDown={(e) => {
              if (e.target.closest('input[type="file"]') || e.target.closest('[data-vc-handle]') || e.target.closest('[data-vc-swap-grip]')) return;
              startMove(e.clientX, e.clientY, e);
            }}
            onMouseUp={(e) => {
              if (e.target.closest('input[type="file"]') || e.target.closest('[data-vc-handle]') || e.target.closest('[data-vc-swap-grip]')) return;
              tryPhotoZoneTapOnMouseUp(e);
            }}
          >
            {k === 'photo' && photoZoneFileChange ? (
              <input
                type="file"
                accept="image/*"
                onChange={photoZoneFileChange}
                onTouchStart={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  left: '10%',
                  top: '10%',
                  width: '80%',
                  height: '80%',
                  opacity: 0.03,
                  zIndex: 1,
                  fontSize: 24,
                  cursor: 'pointer',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  boxSizing: 'border-box',
                }}
                aria-label="Importar imagem — toque no centro; arraste pelas bordas da moldura para mover"
              />
            ) : null}
            {showSwapGrip && (
              <div
                data-vc-swap-grip
                draggable
                title="Arrastar para outro card para trocar conteúdo"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    VC_ZONE_DRAG_MIME,
                    JSON.stringify({ slideIdx: swapSlideIdx, zone: k }),
                  );
                  e.dataTransfer.effectAllowed = 'copyMove';
                }}
                style={{
                  position: 'absolute',
                  left: 5,
                  top: 5,
                  padding: '6px 12px',
                  minWidth: 36,
                  minHeight: 32,
                  borderRadius: 9999,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font-ui)',
                  letterSpacing: '-0.022em',
                  background: 'var(--accent)',
                  color: '#fff',
                  cursor: 'grab',
                  zIndex: 2,
                  lineHeight: 1.2,
                  userSelect: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              ><Shuffle size={14} aria-hidden/></div>
            )}
            <div
              data-vc-handle
              title="Redimensionar"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dragRef.current = {
                  key: k,
                  mode: 'se',
                  lastX: e.clientX,
                  lastY: e.clientY,
                  dist: 0,
                };
              }}
              onTouchStart={startResizeTouch}
              style={{
                position: 'absolute',
                right: -4,
                bottom: -4,
                width: 18,
                height: 18,
                borderRadius: 3,
                background: 'var(--accent)',
                cursor: 'nwse-resize',
                border: '2px solid #fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              }}
            />
          </div>
        );
      })}
    </>
  );
}

/** Layout canvas (variant classic): zonas foto + título + subtítulo em %. */
const ClassicCanvasInner = React.forwardRef(({
  f,
  slide,
  brand,
  bg,
  titleFF,
  bodyFF,
  isBebas,
  culture,
  cultureAccentCol,
  cultureCoverOnly,
  showCultureIdx,
  num,
  total,
  hideInstaBadge,
  /** Cor do campo título (1.º / último vs meio já resolvida no pai). */
  titleInk,
  /** Corpo: subtítulo «texto», parágrafos, etc. */
  bodyInk,
  imgModeNorm,
  effectivePresentationFilter,
  bgFit,
  bgPos,
  bgScale,
  imgReady,
  imgErr,
  imgLoading,
  showCanvasChrome,
  onCanvasPatch,
  onPhotoZoneClick,
  onPhotoZoneFileChange = null,
  swapSlideIdx = null,
  swapZoneKeys,
  interactionScale = 1,
}, ref) => {
  const zcv = slide.canvas.zones;
  const Lzn = LAYOUTS.find((l) => l.id === slide.layout) || DEFAULT_LAYOUT;
  const insetZn = slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
  const padTitleXp = canvasClassicTitlePaddingXPx(f, slide);
  const padSubtitleXp = canvasClassicSubtitlePaddingXPx(f, slide);
  const padYZn = f.h * (0.006 + insetZn * 0.002);
  const pr = clampRect(zcv.photo || DEFAULT_CANVAS_ZONES_CLASSIC.photo);
  const tr = clampRect(zcv.title || DEFAULT_CANVAS_ZONES_CLASSIC.title);
  const sr = clampRect(zcv.subtitle || DEFAULT_CANVAS_ZONES_CLASSIC.subtitle);
  const shadow = slide.textShadow !== false
    ? '0 2px 24px rgba(0,0,0,0.85), 0 1px 6px rgba(0,0,0,0.95)'
    : 'none';
  const textBgColor = slide.textBg
    ? `rgba(0,0,0,${(slide.textBgOpacity ?? 55) / 100 * 0.75})`
    : 'transparent';
  const alignInner =
    slide.align === 'center' ? 'center' :
    slide.align === 'right' ? 'flex-end' :
    slide.align === 'justify' ? 'stretch' : 'flex-start';
  const pendingPhotoZone = slideHasPendingPhotoIntent(slide) && !slide.bgImage;
  const photoZoneInteractive = !!(onPhotoZoneClick && (showCanvasChrome || pendingPhotoZone));
  const photoZoneNativeHit = !!(photoZoneInteractive && onPhotoZoneFileChange);
  const photoZoneBoxStyle = { ...pctBox(pr, f), zIndex: 2, overflow: 'hidden', position: 'relative' };
  const photoZoneChildren = (
    <>
        {slide.bgImage && imgReady && !imgErr && (
          <div style={{ position:'absolute', inset:0, overflow:'hidden' }}>
            <div style={{
              position:'absolute', inset:0,
              backgroundImage:`url(${slide.bgImage})`,
              backgroundPosition:bgPos,
              backgroundRepeat:'no-repeat',
              opacity:slide.bgOpacity/100,
              ...(bgFit === 'custom'
                ? {
                    backgroundSize:`${slide.bgZoom}%`,
                    transform: slide.bgMirror ? 'scaleX(-1)' : 'none',
                  }
                : {
                    backgroundSize: bgFit === 'contain' ? 'contain' : 'cover',
                    transform: `${slide.bgMirror ? 'scaleX(-1) ' : ''}scale(${bgScale})`,
                    transformOrigin: bgPos,
                  }),
              ...(effectivePresentationFilter ? { filter: effectivePresentationFilter } : {}),
            }}/>
          </div>
        )}
        {slide.bgImage && imgReady && !imgErr && slide.overlay > 0 && (
          <div style={{
            position:'absolute', inset:0,
            background: cultureCoverOnly
              ? `linear-gradient(to top, rgba(0,0,0,${Math.min(0.92, slide.overlay/100 * 1.05)}) 0%, rgba(0,0,0,${slide.overlay/100*0.35}) 45%, transparent 72%)`
              : `linear-gradient(175deg, rgba(0,0,0,${slide.overlay/100*0.4}) 0%, rgba(0,0,0,${slide.overlay/100}) 100%)`,
          }}/>
        )}
        <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 2 }} />
        {imgLoading && (
          <div style={{
            position:'absolute', inset:0, zIndex:5,
            background:'rgba(10,9,8,0.92)',
            display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:f.h*0.018,
          }}>
            <div style={{
              width:f.w*0.07, height:f.w*0.07,
              borderRadius:'50%',
              border:`${f.w*0.006}px solid rgba(255,255,255,0.1)`,
              borderTopColor:'var(--accent)',
              animation:'spin 0.9s linear infinite',
            }}/>
            <span style={{ color:'rgba(255,255,255,0.55)', fontSize:f.w*0.026, fontWeight:600, letterSpacing:'-0.011em' }}>
              {imgModeNorm === 'dalle' ? 'Gerando com GPT Image 2…' : 'Carregando…'}
            </span>
          </div>
        )}
        {(showCanvasChrome || pendingPhotoZone) && !slide.bgImage && (
          <div style={{
            position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            color:'rgba(255,255,255,0.45)', fontSize:f.w*0.026, fontWeight:600, textAlign:'center', padding:f.w*0.06,
          }}>
            {pendingPhotoZone ? 'Toque para inserir foto' : 'Clique para inserir foto'}
          </div>
        )}
    </>
  );

  return (
    <div
      ref={ref}
      style={{ width:f.w, height:f.h, background:bg, position:'relative', overflow:'hidden', fontFamily: bodyFF }}
    >
      <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 1 }} />
      <div
        style={photoZoneBoxStyle}
        onClick={photoZoneInteractive && !photoZoneNativeHit ? (e) => { e.stopPropagation(); onPhotoZoneClick(); } : undefined}
        role={photoZoneInteractive && !photoZoneNativeHit ? 'button' : undefined}
      >
        {photoZoneChildren}
        {photoZoneNativeHit ? (
          <input
            type="file"
            accept="image/*"
            onChange={onPhotoZoneFileChange}
            onTouchStart={(e) => e.stopPropagation()}
            style={VC_PHOTO_ZONE_HIT_LAYER_STYLE}
            aria-label="Importar imagem na zona da foto"
          />
        ) : null}
      </div>

      <OverflowScaler
        containerStyle={{
          ...pctBox(tr, f),
          ...VC_TEXT_ZONE_STYLE,
          zIndex: 4,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: Lzn.jc,
          alignItems: Lzn.ai,
          textAlign: slide.align,
          background: textBgColor,
          backdropFilter: slide.textBg ? 'blur(8px)' : 'none',
          borderRadius: slide.textBg ? f.w * 0.022 : 0,
          padding: slide.textBg ? `${f.h * 0.018}px ${f.w * 0.03}px` : `${padYZn}px ${padTitleXp}px`,
        }}
        deps={[slide.title, slide.titleSize, tr.w, tr.h, f.w, f.h, slide.titleLeading]}
        minScale={0.45}
      >
        {(titleScale) => (
        <div
          style={{
            width: '100%',
            minWidth: 0,
            alignSelf: 'stretch',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: alignInner,
          }}
        >
        <h1 style={{
          color: titleInk,
          fontFamily: titleFF,
          fontSize: f.w * 0.084 * (slide.titleSize / 100) * titleScale,
          lineHeight: (slide.titleLeading ?? 105) / 100,
          fontWeight: slide.titleWeight ?? 800,
          letterSpacing: `${(-3 + (slide.titleTracking ?? 0)) / 100}em`,
          margin: 0,
          overflowWrap: 'break-word',
          wordBreak: 'normal',
          maxWidth: '100%',
          width: '100%',
          boxSizing: 'border-box',
          textTransform:
            slide.titleCase === 'upper' ? 'uppercase' :
            slide.titleCase === 'lower' ? 'lowercase' :
            isBebas ? 'uppercase' : 'none',
          textShadow: shadow,
        }}>{culture ? (
          <CultureInlineRich
            text={slide.title || ''}
            destaqueSpans={slide.destaqueSpans?.title}
            baseColor={titleInk}
            accentColor={cultureAccentCol}
            fontFamily={titleFF}
            fontSize={f.w * 0.084 * (slide.titleSize / 100) * titleScale}
            lineHeight={(slide.titleLeading ?? 105) / 100}
            fontWeight={slide.titleWeight ?? 800}
            letterSpacing={`${(-3 + (slide.titleTracking ?? 0)) / 100}em`}
          />
        ) : slide.title}</h1>
        </div>
        )}
      </OverflowScaler>

      <OverflowScaler
        containerStyle={{
          ...pctBox(sr, f),
          ...VC_TEXT_ZONE_STYLE,
          zIndex: 4,
          overflow: 'hidden',
          background: textBgColor,
          backdropFilter: slide.textBg ? 'blur(8px)' : 'none',
          borderRadius: slide.textBg ? f.w * 0.022 : 0,
          padding: slide.textBg ? `${f.h * 0.018}px ${f.w * 0.03}px` : `${padYZn}px ${padSubtitleXp}px`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: Lzn.jc,
          alignItems: Lzn.ai,
          textAlign: slide.align,
        }}
        deps={[slide.subtitle, slide.subSize, sr.w, sr.h, f.w, f.h, slide.subLeading]}
        minScale={0.78}
      >
        {(subScale) => (
        <div
          style={{
            width: '100%',
            minWidth: 0,
            alignSelf: 'stretch',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: alignInner,
          }}
        >
        {slide.subtitle && (
          culture ? (
            <div style={{ letterSpacing: `${(-1 + (slide.subTracking ?? 0)) / 100}em`, textShadow: shadow, width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
              <CultureRichParagraphs
                text={slide.subtitle}
                destaqueSpans={slide.destaqueSpans?.subtitle}
                ink={bodyInk}
                accentColor={cultureAccentCol}
                fontFamily={bodyFF}
                fontSize={f.w * 0.028 * (slide.subSize / 100) * subScale}
                lineHeight={(slide.subLeading ?? 150) / 100}
                fontWeight={400}
                letterSpacing={`${(-1 + (slide.subTracking ?? 0)) / 100}em`}
                paraGap={f.h * 0.010 * subScale}
              />
            </div>
          ) : (
            <p style={{
              color: bodyInk,
              fontFamily: bodyFF,
              fontSize: f.w * 0.028 * (slide.subSize / 100) * subScale,
              lineHeight: (slide.subLeading ?? 150) / 100,
              fontWeight: 400,
              margin: 0,
              overflowWrap: 'break-word',
              wordBreak: 'normal',
              maxWidth: '100%',
              width: '100%',
              boxSizing: 'border-box',
              letterSpacing: `${(-1 + (slide.subTracking ?? 0)) / 100}em`,
              textShadow: shadow,
            }}>{slide.subtitle}</p>
          )
        )}
        </div>
        )}
      </OverflowScaler>

      {culture && (() => {
        const hasHdr = !!(brand.cultureHeaderLeft || '').trim() || !!(brand.cultureHeaderYear || '').trim();
        const onPhoto = !!(slide.bgImage && imgReady && !imgErr);
        const barMuted = onPhoto ? 'rgba(255,255,255,0.62)' : 'rgba(29,29,31,0.45)';
        return (
          <>
            {hasHdr && (
              <div style={{
                position:'absolute', top:f.h*0.028, left:f.w*0.05, right:f.w*0.16, zIndex:24,
                display:'flex', justifyContent:'space-between', alignItems:'center', gap:f.w*0.02,
              }}>
                <span style={{
                  fontSize:f.w*0.022, color:barMuted, fontFamily:bodyFF, fontWeight:400, letterSpacing:'-0.011em',
                  maxWidth:'34%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                }}>{(brand.cultureHeaderLeft || '').trim()}</span>
                <span style={{
                  flex:1, textAlign:'center', fontSize:f.w*0.022, color:barMuted, fontFamily:bodyFF, fontWeight:600,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                }}>{brand.handle}</span>
                <span style={{ fontSize:f.w*0.022, color:barMuted, fontFamily:bodyFF }}>
                  {(brand.cultureHeaderYear || '').trim()}{(brand.cultureHeaderYear || '').trim() ? ' //' : ''}
                </span>
              </div>
            )}
            {showCultureIdx && (
              <div style={{
                position:'absolute', top:f.h*0.032, right:f.w*0.05, zIndex:26,
                background: onPhoto ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.07)',
                color: onPhoto ? '#fff' : '#1d1d1f',
                padding:`${f.h*0.006}px ${f.w*0.022}px`, borderRadius:999,
                fontSize:f.w*0.026, fontWeight:600, fontFamily:bodyFF, letterSpacing:'-0.02em',
              }}>{num}/{total}</div>
            )}
          </>
        );
      })()}

      {brand.showHandle && slide.showHandle && !hideInstaBadge && (
        <div style={{
          ...vcHandleBadgeBoxPositionStyle(brand),
          display:'flex', alignItems:'center', gap:f.w*0.012,
          background:'rgba(255,255,255,0.08)',
          backdropFilter:'blur(12px)',
          padding:`${f.h*0.01}px ${f.w*0.022}px`,
          borderRadius:999,
          border:'1px solid rgba(255,255,255,0.12)',
        }}>
          <div style={{
            width:f.w*0.034, height:f.w*0.034, borderRadius:'50%',
            background:'conic-gradient(from 45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
            display:'flex', alignItems:'center', justifyContent:'center',
            flexShrink: 0,
          }}>
            <div style={{
              width:'76%', height:'76%', borderRadius:'50%',
              overflow:'hidden',
              background: brand.handleAvatar ? '#0a0a0a' : bg,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {brand.handleAvatar ? (
                <img
                  src={brand.handleAvatar}
                  alt=""
                  draggable={false}
                  style={vcHandleAvatarImgStyle(brand)}
                />
              ) : (
                <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ width:'54%', height:'54%', borderRadius:'50%', border:`${f.w*0.004}px solid ${brand.titleColor}` }}/>
                </div>
              )}
            </div>
          </div>
          <span style={{ color:brand.titleColor, fontSize:f.w*0.022, fontWeight:600, fontFamily: bodyFF, letterSpacing:'-0.01em' }}>
            {brand.handle}
          </span>
        </div>
      )}

      {brand.logo && (() => {
        const handleAtTop = brand.showHandle;
        const pos = brand.logoPosition || 'tr';
        const margin = f.w * 0.045;
        const sizePx = (brand.logoSize ?? 30) * (f.w / 1080);
        const topOffset = handleAtTop && pos.startsWith('t') && pos.endsWith('r') ? margin + f.h * 0.05 : margin;
        const style = {
          position:'absolute',
          width: sizePx, height: sizePx,
          opacity: (brand.logoOpacity ?? 90) / 100,
          backgroundImage: `url(${brand.logo})`,
          backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
          zIndex: 23,
        };
        if (pos === 'tl') Object.assign(style, { top: margin,    left: margin });
        if (pos === 'tr') Object.assign(style, { top: topOffset, right: margin });
        if (pos === 'bl') Object.assign(style, { bottom: margin, left: margin });
        if (pos === 'br') Object.assign(style, { bottom: margin, right: margin });
        return <div style={style} aria-hidden/>;
      })()}

      {showCanvasChrome && onCanvasPatch && (
        <CanvasZonesOverlay
          f={f}
          zones={slide.canvas.zones}
          keys={['photo', 'title', 'subtitle']}
          onPatch={onCanvasPatch}
          swapSlideIdx={swapSlideIdx}
          swapZoneKeys={swapZoneKeys}
          photoZoneTap={onPhotoZoneFileChange ? null : (onPhotoZoneClick || null)}
          photoZoneFileChange={onPhotoZoneFileChange}
          interactionScale={interactionScale}
        />
      )}
    </div>
  );
});
ClassicCanvasInner.displayName = 'ClassicCanvasInner';

/** Clássico: foto em faixa horizontal com margens (sem canvas / sem sanduíche cultura no card). */
const ClassicLegadoInsetPhotoColumn = React.forwardRef(({
  f,
  slide,
  brand,
  bg,
  L,
  isBebas,
  titleFF,
  bodyFF,
  displayTitleInk,
  displayBodyInk,
  cultureRichText,
  cultureAccentCol,
  sandwichSkin,
  showCultureIdx,
  num,
  total,
  hideInstaBadge,
  imgReady,
  imgErr,
  imgLoading,
  imgModeNorm,
  effectivePresentationFilter,
  bgFit,
  bgPos,
  bgScale,
  photoRegionId,
  onPhotoZoneClick,
  showCanvasChrome,
}, ref) => {
  const pr = photoRegionId;
  const bandFrac = pr === 'inset_h_narrow_mid' ? 0.28 : 0.36;
  const sideM = f.w * 0.06;
  const rad = f.w * 0.022;
  const bandH = f.h * bandFrac;
  const inset = slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
  const padH = f.w * (0.04 + inset * 0.004);
  const shadow = slide.textShadow !== false
    ? '0 2px 24px rgba(0,0,0,0.85), 0 1px 6px rgba(0,0,0,0.95)'
    : 'none';
  const textBgColor = slide.textBg
    ? `rgba(0,0,0,${(slide.textBgOpacity ?? 55) / 100 * 0.75})`
    : 'transparent';
  const alignItemsBox =
    slide.align === 'center' ? 'center' :
    slide.align === 'right' ? 'flex-end' :
    slide.align === 'justify' ? 'stretch' : 'flex-start';

  const textGlass = (children) => (
    <div style={{
      background: textBgColor,
      backdropFilter: slide.textBg ? 'blur(8px)' : 'none',
      borderRadius: slide.textBg ? f.w * 0.025 : 0,
      padding: slide.textBg ? `${f.h * 0.022}px ${f.w * 0.04}px` : 0,
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: alignItemsBox,
      gap: f.h * 0.018,
      maxWidth: '100%',
    }}>{children}</div>
  );

  const titleEl = (
    <h1 style={{
      color: displayTitleInk, fontFamily: titleFF,
      fontSize: f.w * 0.084 * (slide.titleSize / 100),
      lineHeight: (slide.titleLeading ?? 105) / 100,
      fontWeight: slide.titleWeight ?? 800,
      letterSpacing: `${(-3 + (slide.titleTracking ?? 0)) / 100}em`,
      margin: 0,
      textTransform:
        slide.titleCase === 'upper' ? 'uppercase' :
        slide.titleCase === 'lower' ? 'lowercase' :
        isBebas ? 'uppercase' : 'none',
      textShadow: shadow,
    }}>{cultureRichText ? (
      <CultureInlineRich
        text={slide.title || ''}
        destaqueSpans={slide.destaqueSpans?.title}
        baseColor={displayTitleInk}
        accentColor={cultureAccentCol}
        fontFamily={titleFF}
        fontSize={f.w * 0.084 * (slide.titleSize / 100)}
        lineHeight={(slide.titleLeading ?? 105) / 100}
        fontWeight={slide.titleWeight ?? 800}
        letterSpacing={`${(-3 + (slide.titleTracking ?? 0)) / 100}em`}
      />
    ) : slide.title}</h1>
  );

  const subtitleEl = slide.subtitle ? (
    cultureRichText ? (
      <div style={{
        margin: 0,
        maxWidth: '100%',
        letterSpacing: `${(-1 + (slide.subTracking ?? 0)) / 100}em`,
        textShadow: shadow,
      }}>
        <CultureRichParagraphs
          text={slide.subtitle}
          destaqueSpans={slide.destaqueSpans?.subtitle}
          ink={displayBodyInk}
          accentColor={cultureAccentCol}
          fontFamily={bodyFF}
          fontSize={f.w * 0.028 * (slide.subSize / 100)}
          lineHeight={(slide.subLeading ?? 150) / 100}
          fontWeight={400}
          letterSpacing={`${(-1 + (slide.subTracking ?? 0)) / 100}em`}
          paraGap={f.h * 0.010}
        />
      </div>
    ) : (
      <p style={{
        color: displayBodyInk, fontFamily: bodyFF,
        fontSize: f.w * 0.028 * (slide.subSize / 100),
        lineHeight: (slide.subLeading ?? 150) / 100,
        fontWeight: 400, margin: 0,
        letterSpacing: `${(-1 + (slide.subTracking ?? 0)) / 100}em`,
        textShadow: shadow,
      }}>{slide.subtitle}</p>
    )
  ) : null;

  const bothText = textGlass(<>{titleEl}{subtitleEl}</>);
  const titleOnlyWrapped = textGlass(<>{titleEl}</>);
  const subOnlyWrapped = textGlass(<>{subtitleEl}</>);

  const bandClickable = !!(onPhotoZoneClick && (showCanvasChrome || slideHasPendingPhotoIntent(slide)) && !slide.bgImage);

  const photoBand = (
    <div
      role={bandClickable ? 'button' : undefined}
      onClick={bandClickable ? (e) => { e.stopPropagation(); onPhotoZoneClick(); } : undefined}
      style={{
        flex: '0 0 auto',
        height: bandH,
        marginLeft: sideM,
        marginRight: sideM,
        borderRadius: rad,
        overflow: 'hidden',
        position: 'relative',
        background: bg,
        zIndex: 2,
        boxShadow: 'var(--shadow-product)',
        cursor: bandClickable ? 'pointer' : undefined,
      }}
    >
      {slide.bgImage && imgReady && !imgErr ? (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${slide.bgImage})`,
            backgroundPosition: bgPos,
            backgroundRepeat: 'no-repeat',
            opacity: slide.bgOpacity / 100,
            ...(bgFit === 'custom'
              ? {
                  backgroundSize: `${slide.bgZoom}%`,
                  transform: slide.bgMirror ? 'scaleX(-1)' : 'none',
                }
              : {
                  backgroundSize: bgFit === 'contain' ? 'contain' : 'cover',
                  transform: `${slide.bgMirror ? 'scaleX(-1) ' : ''}scale(${bgScale})`,
                  transformOrigin: bgPos,
                }),
            ...(effectivePresentationFilter ? { filter: effectivePresentationFilter } : {}),
          }}/>
          {slide.overlay > 0 ? (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
              background: `linear-gradient(175deg, rgba(0,0,0,${slide.overlay / 100 * 0.35}) 0%, rgba(0,0,0,${slide.overlay / 100 * 0.88}) 100%)`,
            }}/>
          ) : null}
        </>
      ) : slideHasPendingPhotoIntent(slide) ? (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: f.w * 0.024, fontWeight: 600, textAlign: 'center', padding: f.w * 0.04,
        }}>Toque para inserir foto</div>
      ) : null}
    </div>
  );

  const textColBase = {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: L.jc,
    alignItems: L.ai,
    overflow: 'hidden',
    textAlign: slide.align,
    ...VC_TEXT_ZONE_STYLE,
  };

  let mainColumn = null;
  if (pr === 'inset_h_top') {
    mainColumn = (
      <>
        {photoBand}
        <div style={{ ...textColBase, padding: `${f.h * 0.014}px ${padH}px ${f.h * 0.02}px`, gap: f.h * 0.01 }}>
          {bothText}
        </div>
      </>
    );
  } else if (pr === 'inset_h_bottom') {
    mainColumn = (
      <>
        <div style={{ ...textColBase, padding: `${f.h * 0.04}px ${padH}px ${f.h * 0.012}px` }}>
          {bothText}
        </div>
        {photoBand}
      </>
    );
  } else {
    mainColumn = (
      <>
        <div style={{
          ...textColBase,
          flex: '1 1 0',
          justifyContent: 'center',
          padding: `${f.h * 0.02}px ${padH}px ${f.h * 0.01}px`,
        }}>
          {titleOnlyWrapped}
        </div>
        {photoBand}
        <div style={{
          ...textColBase,
          flex: '1 1 0',
          justifyContent: 'center',
          padding: `${f.h * 0.01}px ${padH}px ${f.h * 0.02}px`,
        }}>
          {subOnlyWrapped}
        </div>
      </>
    );
  }

  return (
    <div
      ref={ref}
      style={{
        width: f.w,
        height: f.h,
        background: bg,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: bodyFF,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 1 }} />

      {imgLoading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5,
          background: 'rgba(10,9,8,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: f.h * 0.018,
        }}>
          <div style={{
            width: f.w * 0.07, height: f.w * 0.07,
            borderRadius: '50%',
            border: `${f.w * 0.006}px solid rgba(255,255,255,0.1)`,
            borderTopColor: 'var(--accent)',
            animation: 'spin 0.9s linear infinite',
          }}/>
          <span style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: f.w * 0.026,
            fontWeight: 600,
            letterSpacing: '-0.011em',
          }}>
            {imgModeNorm === 'dalle' ? 'Gerando com GPT Image 2…' : 'Carregando…'}
          </span>
          {imgModeNorm === 'dalle' && (
            <span style={{
              color: 'rgba(255,255,255,0.32)',
              fontSize: f.w * 0.02,
              letterSpacing: '-0.011em',
            }}>GPT Image 2 · OpenAI · ~30s por slide</span>
          )}
        </div>
      )}

      {sandwichSkin && (() => {
        const hasHdr = !!(brand.cultureHeaderLeft || '').trim() || !!(brand.cultureHeaderYear || '').trim();
        const onPhoto = !!(slide.bgImage && imgReady && !imgErr);
        const barMuted = onPhoto ? 'rgba(255,255,255,0.62)' : 'rgba(29,29,31,0.45)';
        return (
          <>
            {hasHdr && (
              <div style={{
                position: 'absolute', top: f.h * 0.028, left: f.w * 0.05, right: f.w * 0.16, zIndex: 24,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: f.w * 0.02,
              }}>
                <span style={{
                  fontSize: f.w * 0.022, color: barMuted, fontFamily: bodyFF, fontWeight: 400, letterSpacing: '-0.011em',
                  maxWidth: '34%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{(brand.cultureHeaderLeft || '').trim()}</span>
                <span style={{
                  flex: 1, textAlign: 'center', fontSize: f.w * 0.022, color: barMuted, fontFamily: bodyFF, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{brand.handle}</span>
                <span style={{ fontSize: f.w * 0.022, color: barMuted, fontFamily: bodyFF }}>
                  {(brand.cultureHeaderYear || '').trim()}{(brand.cultureHeaderYear || '').trim() ? ' //' : ''}
                </span>
              </div>
            )}
            {showCultureIdx && (
              <div style={{
                position: 'absolute', top: f.h * 0.032, right: f.w * 0.05, zIndex: 26,
                background: onPhoto ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.07)',
                color: onPhoto ? '#fff' : '#1d1d1f',
                padding: `${f.h * 0.006}px ${f.w * 0.022}px`, borderRadius: 999,
                fontSize: f.w * 0.026, fontWeight: 600, fontFamily: bodyFF, letterSpacing: '-0.02em',
              }}>{num}/{total}</div>
            )}
          </>
        );
      })()}

      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 3,
        paddingTop: sandwichSkin ? f.h * 0.052 : f.h * 0.02,
        gap: f.h * 0.012,
      }}>
        {mainColumn}
      </div>

      {brand.showHandle && slide.showHandle && !hideInstaBadge && (
        <div style={{
          ...vcHandleBadgeBoxPositionStyle(brand),
          display: 'flex', alignItems: 'center', gap: f.w * 0.012,
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          padding: `${f.h * 0.01}px ${f.w * 0.022}px`,
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.12)',
        }}>
          <div style={{
            width: f.w * 0.034, height: f.w * 0.034, borderRadius: '50%',
            background: 'conic-gradient(from 45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <div style={{
              width: '76%', height: '76%', borderRadius: '50%',
              overflow: 'hidden',
              background: brand.handleAvatar ? '#0a0a0a' : bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {brand.handleAvatar ? (
                <img
                  src={brand.handleAvatar}
                  alt=""
                  draggable={false}
                  style={vcHandleAvatarImgStyle(brand)}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '54%', height: '54%', borderRadius: '50%', border: `${f.w * 0.004}px solid ${brand.titleColor}` }}/>
                </div>
              )}
            </div>
          </div>
          <span style={{ color: brand.titleColor, fontSize: f.w * 0.022, fontWeight: 600, fontFamily: bodyFF, letterSpacing: '-0.01em' }}>
            {brand.handle}
          </span>
        </div>
      )}

      {brand.logo && (() => {
        const handleAtTop = brand.showHandle;
        const pos = brand.logoPosition || 'tr';
        const margin = f.w * 0.045;
        const sizePx = (brand.logoSize ?? 30) * (f.w / 1080);
        const topOffset = handleAtTop && pos.startsWith('t') && pos.endsWith('r') ? margin + f.h * 0.05 : margin;
        const style = {
          position: 'absolute',
          width: sizePx, height: sizePx,
          opacity: (brand.logoOpacity ?? 90) / 100,
          backgroundImage: `url(${brand.logo})`,
          backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
          zIndex: 23,
        };
        if (pos === 'tl') Object.assign(style, { top: margin, left: margin });
        if (pos === 'tr') Object.assign(style, { top: topOffset, right: margin });
        if (pos === 'bl') Object.assign(style, { bottom: margin, left: margin });
        if (pos === 'br') Object.assign(style, { bottom: margin, right: margin });
        return <div style={style} aria-hidden />;
      })()}
    </div>
  );
});
ClassicLegadoInsetPhotoColumn.displayName = 'ClassicLegadoInsetPhotoColumn';

// AutoFitText foi extraído para src/components/AutoFitText.jsx

// ─── OVERFLOW SCALER ──────────────────────────────────────────────────────────
// Mede o próprio container e fornece um scale factor (via render-prop) que pode
// ser aplicado uniformemente aos fontSize dos textos filhos.
// Diferente do AutoFitText (que envolve UM elemento de texto), o OverflowScaler
// permite que MÚLTIPLOS elementos (title + subtitle + body + photo zone) coexistam
// dentro dele, e o scale uniforme garante hierarquia tipográfica preservada.
//
// Uso:
//   <OverflowScaler containerStyle={{...}} deps={[title, subtitle, body]} minScale={0.7}>
//     {(scale) => (<>... fontSize={baseSize * scale} ...</>)}
//   </OverflowScaler>
function OverflowScaler({ containerStyle, deps = [], minScale = AUTOFIT_MIN_SCALE, children }) {
  const ref = React.useRef(null);
  const [scale, setScale] = React.useState(1);
  const iterationsRef = React.useRef(0);
  // Reset ao trocar conteúdo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    setScale(1);
    iterationsRef.current = 0;
  }, deps);
  // Mede e reduz se transbordou — converge em ≤6 frames
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Hard limit pra evitar loop infinito em casos patológicos
    if (iterationsRef.current > 8) return;
    iterationsRef.current++;
    const clientH = el.clientHeight;
    if (clientH <= 0) return;
    const contentH = el.scrollHeight;
    if (contentH <= clientH + 1) return;
    // Desconta photo zone (altura fixa, não escala)
    const photoEl = el.querySelector('[data-vc-photo-zone="1"]');
    const photoH = photoEl ? photoEl.getBoundingClientRect().height : 0;
    const textContentH = Math.max(1, contentH - photoH);
    const availForText = Math.max(1, clientH - photoH);
    // Estimativa: scale precisa ajustar pela razão de área (h escalada ≈ h × scale)
    // Safety factor 0.98: tira um pequeno respiro pra evitar ficar exatamente no limite,
    // mas suficientemente conservador pra não encolher demais.
    const target = Math.max(minScale, scale * (availForText / textContentH) * 0.98);
    if (target < scale - 0.003) {
      setScale(target);
    }
  });
  // Fallback: re-medir após fontes carregarem (1s) — corrige casos onde a primeira
  // medida foi tirada antes de a fonte web aplicar
  React.useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      if (cancelled) return;
      iterationsRef.current = 0;
      // Force uma re-medida resetando pra 1 (vai re-disparar o ciclo de encolhimento)
      setScale((s) => (s < 1 ? 1 : s));
    }, 600);
    return () => { cancelled = true; clearTimeout(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return (
    <div ref={ref} style={containerStyle}>
      {children(scale)}
    </div>
  );
}

// ─── SLIDE CARD ───────────────────────────────────────────────────────────────

const SlideCardInner = React.forwardRef(({
  slide, fmt, brand, num, total, scale = 1, presentationImgFilter, creativePreset = 'livre',
  slideIndex: slideIndexProp,
  showCanvasChrome = false,
  onCanvasZonePatch = null,
  onPhotoZoneRequest = null,
  /** `(slideIdx, ev) => void` — `<input type=file>` sobre a zona (WebKit/iOS). */
  onPhotoZoneNativeFile = null,
  enableZoneSwapDrag = false,
}, ref) => {
  const f = FORMATS[fmt] || FORMATS.carrossel;
  const slideIdx = slideIndexProp != null ? slideIndexProp : num - 1;
  const zonePatchRef = React.useRef(onCanvasZonePatch);
  const brandPal = hydrateBrandTextColors(brand);
  const carouselEdgeSlide = total >= 1 && (slideIdx === 0 || slideIdx === total - 1);
  const carouselTitleInk = carouselEdgeSlide ? brandPal.titleColor : brandPal.subtitleColor;
  const carouselBodyInk = brandPal.textColor;
  zonePatchRef.current = onCanvasZonePatch;
  const photoReqRef = React.useRef(onPhotoZoneRequest);
  photoReqRef.current = onPhotoZoneRequest;
  const photoNativeRef = React.useRef(onPhotoZoneNativeFile);
  photoNativeRef.current = onPhotoZoneNativeFile;
  const onCanvasPatch = React.useCallback((p) => {
    zonePatchRef.current?.(slideIdx, p);
  }, [slideIdx]);
  const onPhotoZoneClick = React.useCallback(() => {
    photoReqRef.current?.(slideIdx);
  }, [slideIdx]);
  const onPhotoZoneFileInputChange = React.useCallback((e) => {
    photoNativeRef.current?.(slideIdx, e);
  }, [slideIdx]);
  const L = LAYOUTS.find(l=>l.id===slide.layout) || DEFAULT_LAYOUT;
  const bg = resolveSlideBrandBg(brand, slideIdx, slide);
  const isBebas = brand.titleFont?.includes('Bebas');
  const imgModeNorm = normalizeSlideImgMode(slide.imgMode);
  const bgFit = slide.bgFit ?? 'custom';
  const bgPos = `${slide.bgX}% ${slide.bgY}%`;
  const bgScale = (slide.bgZoom ?? 100) / 100;

  const [imgReady, setImgReady] = React.useState(false);
  const [imgErr, setImgErr] = React.useState(false);

  React.useEffect(() => {
    if (!slide.bgImage) { setImgReady(false); setImgErr(false); return; }
    setImgReady(false); setImgErr(false);
    const img = new window.Image();
    img.onload  = () => setImgReady(true);
    img.onerror = () => { setImgErr(true); setImgReady(true); };
    img.src = slide.bgImage;
    return () => { img.onload = null; img.onerror = null; };
  }, [slide.bgImage]);

  const imgLoading = !!slide.bgImage && !imgReady;

  const derivedStoredPresentationFilter = slideStoredPresentationCssFilter(slide);

  let effectivePresentationFilter;
  if (presentationImgFilter === undefined) {
    effectivePresentationFilter = derivedStoredPresentationFilter;
  } else if (presentationImgFilter == null || presentationImgFilter === '') {
    effectivePresentationFilter = undefined;
  } else {
    effectivePresentationFilter = presentationImgFilter;
  }

  const titleFF = effectiveTitleFontFamily(brand);
  const bodyFF = effectiveBodyFontFamily(brand);

  const culturePack = creativePreset === 'tendencia_cultura';
  const sandwichSkin = culturePack || !!slide.useCultureLayout;
  const cultureRichText = culturePack || !!slide.useCultureLayout;
  const bodyAfterCulture = (slide.bodyAfterImage || '').trim();
  const sandwich =
    sandwichSkin &&
    !!bodyAfterCulture &&
    (!!slide.bgImage || slideHasPendingPhotoIntent(slide));
  const cultureStatFlat =
    sandwichSkin &&
    !slide.bgImage &&
    !slideHasPendingPhotoIntent(slide) &&
    !!bodyAfterCulture &&
    !!(slide.subtitle || '').trim();
  const cultureCoverOnly =
    culturePack &&
    num === 1 &&
    (!!slide.bgImage || slideHasPendingPhotoIntent(slide)) &&
    !sandwich &&
    !cultureStatFlat;
  // Badge classic (com avatar circular + handle) deve aparecer em TODOS os modos —
  // o usuário controla via toggle "Mostrar @ nos slides" e posição via sliders handleBadgeX/Y.
  // (Antes era escondido em culturePack assumindo que o handle iria na editorial bar,
  // mas isso ignorava os sliders de posição.)
  const hideInstaBadge = false;
  // Desligado: contador "N/M" no canto superior direito do card foi removido a pedido.
  // (UI já mostra o número do card via tabs/navegação fora do canvas.)
  // Badge "N/M" canto sup direito — ativado por brand.showPageBadge
  // (era hardcoded false; agora opt-in via preset visual Sports Editorial etc).
  const showCultureIdx = !!brand.showPageBadge;
  const cultureAccentCol = brand.accent || '#000000';

  const slideCardBg = resolveSlideBrandBg(brand, slideIdx, slide) || '#fafafc';
  let displayTitleInk = carouselTitleInk;
  let displayBodyInk = carouselBodyInk;
  if (culturePack || sandwichSkin) {
    const cr = cultureReadableInks(slideCardBg, carouselTitleInk, carouselBodyInk, cultureAccentCol);
    displayTitleInk = cr.titleInk;
    displayBodyInk = cr.bodyInk;
    if (
      cultureCoverOnly &&
      (slide.bgImage || slideHasPendingPhotoIntent(slide)) &&
      (slide.overlay ?? 0) >= 38
    ) {
      const rgbBg = vcHexToRgb(vcNormalizeHex(slideCardBg) || '#fafafc');
      const Lbg = rgbBg ? vcRelLuminance01(rgbBg) : 0.96;
      if (Lbg >= 0.55) {
        displayTitleInk = DARK_CREAM.title;
        displayBodyInk = 'rgba(245,245,247,0.92)';
      }
    }
  }

  let inner;
  const cvEnabled = !!(slide.canvas && slide.canvas.enabled && slide.canvas.zones);
  const cvVar = slide.canvas?.variant;
  const cultureLayoutInferred = inferCanvasDefaults(slide, creativePreset);
  const cultureVariantForLayout = slide.canvas?.variant ?? cultureLayoutInferred.variant;
  const cultureZonesForLayout =
    slide.canvas?.zones && typeof slide.canvas.zones === 'object'
      ? slide.canvas.zones
      : cultureLayoutInferred.zones;
  const useCultureCanvasZones =
    (sandwich || cultureStatFlat) &&
    (cultureVariantForLayout === 'sandwich' || cultureVariantForLayout === 'stat');

  if (useCultureCanvasZones) {
    const z = cultureZonesForLayout;
    const surface = cultureResolveSurface(slide, num);
    const lightCultureBg = resolveSlideBrandBg(brand, slideIdx, slide) || '#fafafc';
    const bgSolid = surface === 'dark' ? cultureDarkBackdropFromBrand(brand.bg) : surface === 'accent' ? (brand.accent || '#000000') : lightCultureBg;
    const cr = cultureReadableInks(bgSolid, carouselTitleInk, carouselBodyInk, cultureAccentCol);
    const hasBar = !!(brand.cultureHeaderLeft || '').trim() || !!(brand.cultureHeaderYear || '').trim();
    const Lzn = LAYOUTS.find((l) => l.id === slide.layout) || DEFAULT_LAYOUT;
    const alignInner =
      slide.align === 'center' ? 'center' :
      slide.align === 'right' ? 'flex-end' :
      slide.align === 'justify' ? 'stretch' : 'flex-start';
    const insetZn = slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
    const padXCvTop = canvasCultureSandwichPaddingXPx(f, slide);
    const padXCvBottom = canvasCultureSandwichBottomPaddingXPx(f, slide);
    const padYCv = f.h * (0.004 + insetZn * 0.002);
    const topR = z.top ? clampRect(z.top) : { x: 6, y: 8, w: 88, h: 28 };
    const photoR = z.photo ? clampRect(z.photo) : { x: 6, y: 30, w: 88, h: 42 };
    const botR = z.bottom ? clampRect(z.bottom) : { x: 6, y: 74, w: 88, h: 23 };
    const sandwichPhotoInteractive = !!((showCanvasChrome || (sandwich && slideHasPendingPhotoIntent(slide))) && onPhotoZoneClick);
    const sandwichPhotoNativeHit = !!(sandwichPhotoInteractive && onPhotoZoneNativeFile);
    const sandwichPhotoBoxStyle = {
      ...pctBox(photoR, f),
      zIndex: 2,
      overflow: 'hidden',
      borderRadius: f.w * 0.017,
      background: cr.solidBgIsLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
      boxShadow: 'var(--shadow-product)',
    };
    inner = (
      <div
        ref={ref}
        style={{ width:f.w, height:f.h, background:bgSolid, position:'relative', overflow:'hidden', fontFamily: bodyFF }}
      >
        <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 1 }} />
        {hasBar && (
          <div style={{
            position:'absolute', top:f.h*0.028, left:f.w*0.05, right:f.w*0.16, zIndex:25,
            display:'flex', justifyContent:'space-between', alignItems:'center', gap:f.w*0.02,
          }}>
            <span style={{
              fontSize:f.w*0.022, color:cr.inkMuted, fontFamily:bodyFF, fontWeight:400, letterSpacing:'-0.011em',
              maxWidth:'32%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{(brand.cultureHeaderLeft || '').trim()}</span>
            <span style={{
              flex:1, textAlign:'center', fontSize:f.w*0.022, color:cr.inkMuted, fontFamily:bodyFF, fontWeight:600,
              letterSpacing:'-0.011em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{brand.handle}</span>
            <span style={{ fontSize:f.w*0.022, color:cr.inkMuted, fontFamily:bodyFF, letterSpacing:'-0.011em' }}>
              {(brand.cultureHeaderYear || '').trim()}{(brand.cultureHeaderYear || '').trim() ? ' //' : ''}
            </span>
          </div>
        )}
        {showCultureIdx && (
          <div style={{
            position:'absolute', top:f.h*0.032, right:f.w*0.05, zIndex:30,
            background: cr.solidBgIsLight ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.28)',
            color: cr.solidBgIsLight ? '#1d1d1f' : '#ffffff',
            padding:`${f.h*0.006}px ${f.w*0.022}px`, borderRadius:999,
            fontSize:f.w*0.026, fontWeight:600, fontFamily:bodyFF, letterSpacing:'-0.02em',
          }}>{num}/{total}</div>
        )}

        <OverflowScaler
          containerStyle={{
            ...pctBox(topR, f),
            ...VC_TEXT_ZONE_STYLE,
            zIndex: 4,
            overflow: 'hidden',
            padding: `${padYCv}px ${padXCvTop}px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: Lzn.ai,
            textAlign: slide.align === 'justify' ? 'left' : slide.align,
          }}
          deps={[slide.title, slide.subtitle, slide.titleSize, slide.subSize, topR.w, topR.h, f.w, f.h]}
          minScale={AUTOFIT_MIN_SCALE}
        >
          {(topScale) => (
          <div
            style={{
              width: '100%',
              minWidth: 0,
              alignSelf: 'stretch',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              alignItems: alignInner,
              gap: f.h * 0.012 * topScale,
            }}
          >
          {(slide.title || '').trim() ? (
            <h2 style={{
              margin: 0,
              fontFamily: titleFF,
              overflowWrap: 'break-word',
              wordBreak: 'normal',
              maxWidth: '100%',
              width: '100%',
              boxSizing: 'border-box',
              textTransform:
                slide.titleCase === 'upper' ? 'uppercase' :
                slide.titleCase === 'lower' ? 'lowercase' : 'none',
            }}>
              <CultureInlineRich
                text={slide.title || ''}
                destaqueSpans={slide.destaqueSpans?.title}
                baseColor={cr.titleInk}
                accentColor={cr.accentInk}
                fontFamily={titleFF}
                fontSize={f.w * 0.036 * (slide.titleSize / 100) * topScale}
                lineHeight={(slide.titleLeading ?? 105) / 100}
                fontWeight={slide.titleWeight ?? 600}
                letterSpacing={`${(-2.4 + (slide.titleTracking ?? 0)) / 100}em`}
              />
            </h2>
          ) : null}
          <CultureRichParagraphs
            text={slide.subtitle}
            destaqueSpans={slide.destaqueSpans?.subtitle}
            ink={cr.subtitleInk}
            accentColor={cr.accentInk}
            fontFamily={bodyFF}
            fontSize={f.w * 0.031 * (slide.subSize / 100) * topScale}
            lineHeight={(slide.subLeading ?? 142) / 100}
            fontWeight={600}
            letterSpacing={`${(-1 + (slide.subTracking ?? 0)) / 100}em`}
            paraGap={f.h * 0.012 * topScale}
          />
          </div>
          )}
        </OverflowScaler>

        {cultureVariantForLayout === 'sandwich' && (
          <div
            style={{
              ...sandwichPhotoBoxStyle,
              cursor: sandwichPhotoInteractive ? 'pointer' : undefined,
            }}
            onClick={sandwichPhotoInteractive && !sandwichPhotoNativeHit ? (e) => { e.stopPropagation(); onPhotoZoneClick(); } : undefined}
            role={sandwichPhotoInteractive && !sandwichPhotoNativeHit ? 'button' : undefined}
          >
            {sandwich && imgLoading && (
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.2)' }}>
                <div style={{
                  width:f.w*0.065, height:f.w*0.065, borderRadius:'50%',
                  border:`${f.w*0.005}px solid rgba(255,255,255,0.2)`,
                  borderTopColor: cr.accentInk, animation:'spin 0.9s linear infinite',
                }}/>
              </div>
            )}
            {sandwich && slide.videoId && getVideoUrl(slide.videoId) && (
              <>
                <video
                  src={getVideoUrl(slide.videoId)}
                  autoPlay loop muted playsInline
                  style={sandwichPhotoZoneImgStyle(slide, effectivePresentationFilter)}
                />
                {slide.overlay > 0 ? (
                  <div
                    style={{
                      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
                      background: `linear-gradient(175deg, rgba(0,0,0,${slide.overlay / 100 * 0.4}) 0%, rgba(0,0,0,${slide.overlay / 100}) 100%)`,
                    }}
                  />
                ) : null}
                <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 2 }} />
              </>
            )}
            {sandwich && !slide.videoId && imgReady && !imgErr && slide.bgImage && (
              <>
                <img
                  src={slide.bgImage}
                  alt=""
                  draggable={false}
                  style={sandwichPhotoZoneImgStyle(slide, effectivePresentationFilter)}
                />
                {slide.overlay > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      zIndex: 1,
                      background: `linear-gradient(175deg, rgba(0,0,0,${slide.overlay / 100 * 0.4}) 0%, rgba(0,0,0,${slide.overlay / 100}) 100%)`,
                    }}
                  />
                ) : null}
                <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 2 }} />
              </>
            )}
            {sandwich && !slide.videoId && !slide.bgImage && (
              <div style={{
                position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
                color:cr.inkMuted, fontSize:f.w*0.024, fontWeight:600, textAlign:'center', padding:f.w*0.04,
              }}>
                {slideHasPendingPhotoIntent(slide) ? 'Toque para inserir foto' : 'Área da imagem'}
              </div>
            )}
            {sandwichPhotoNativeHit ? (
              <input
                type="file"
                accept="image/*"
                onChange={onPhotoZoneFileInputChange}
                onTouchStart={(e) => e.stopPropagation()}
                style={VC_PHOTO_ZONE_HIT_LAYER_STYLE}
                aria-label="Importar imagem na zona da foto"
              />
            ) : null}
          </div>
        )}

        <OverflowScaler
          containerStyle={{
            ...pctBox(botR, f),
            ...VC_TEXT_ZONE_STYLE,
            zIndex: 4,
            overflow: 'hidden',
            padding: `${padYCv}px ${padXCvBottom}px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: Lzn.ai,
            textAlign: slide.align === 'justify' ? 'left' : slide.align,
          }}
          deps={[bodyAfterCulture, slide.bodyAfterSize, slide.subSize, botR.w, botR.h, f.w, f.h]}
          minScale={AUTOFIT_MIN_SCALE}
        >
          {(botScale) => (
          <CultureRichParagraphs
            text={bodyAfterCulture}
            destaqueSpans={slide.destaqueSpans?.bodyAfterImage}
            ink={cr.bodyInk}
            accentColor={cr.accentInk}
            fontFamily={bodyFF}
            fontSize={f.w * 0.029 * ((slide.bodyAfterSize ?? slide.subSize ?? 100) / 100) * botScale}
            lineHeight={(slide.subLeading ?? 145) / 100}
            fontWeight={600}
            letterSpacing={`${(-1 + (slide.subTracking ?? 0)) / 100}em`}
            paraGap={f.h * 0.01 * botScale}
          />
          )}
        </OverflowScaler>

        {showCanvasChrome && onCanvasPatch && cvEnabled && (
          <CanvasZonesOverlay
            f={f}
            zones={slide.canvas.zones}
            keys={cultureVariantForLayout === 'stat' ? ['top', 'bottom'] : ['top', 'photo', 'bottom']}
            onPatch={onCanvasPatch}
            swapSlideIdx={enableZoneSwapDrag && showCanvasChrome ? slideIdx : null}
            swapZoneKeys={cultureVariantForLayout === 'stat' ? ['top', 'bottom'] : ['top', 'photo', 'bottom']}
            photoZoneTap={onPhotoZoneNativeFile ? null : (onPhotoZoneClick || null)}
            photoZoneFileChange={onPhotoZoneNativeFile ? onPhotoZoneFileInputChange : null}
            interactionScale={scale}
          />
        )}

        {brand.logo && (() => {
          const pos = brand.logoPosition || 'tr';
          const margin = f.w * 0.045;
          const sizePx = (brand.logoSize ?? 30) * (f.w / 1080);
          const topOffset = hasBar && pos.startsWith('t') && pos.endsWith('r') ? margin + f.h * 0.072 : margin;
          const st = {
            position:'absolute',
            width: sizePx, height: sizePx,
            opacity: (brand.logoOpacity ?? 90) / 100,
            backgroundImage: `url(${brand.logo})`,
            backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
            zIndex: 20,
          };
          if (pos === 'tl') Object.assign(st, { top: margin, left: margin });
          if (pos === 'tr') Object.assign(st, { top: topOffset, right: margin });
          if (pos === 'bl') Object.assign(st, { bottom: margin, left: margin });
          if (pos === 'br') Object.assign(st, { bottom: margin, right: margin });
          return <div style={st} aria-hidden/>;
        })()}
      </div>
    );
  } else if (sandwich || cultureStatFlat) {
    const surface = cultureResolveSurface(slide, num);
    const lightCultureBg = resolveSlideBrandBg(brand, slideIdx, slide) || '#fafafc';
    const bgSolid = surface === 'dark' ? cultureDarkBackdropFromBrand(brand.bg) : surface === 'accent' ? (brand.accent || '#000000') : lightCultureBg;
    const cr = cultureReadableInks(bgSolid, carouselTitleInk, carouselBodyInk, cultureAccentCol);
    const hasBar = !!(brand.cultureHeaderLeft || '').trim() || !!(brand.cultureHeaderYear || '').trim();
    const flatPhotoNativeHit = !!(
      sandwich &&
      !slide.bgImage &&
      slideHasPendingPhotoIntent(slide) &&
      onPhotoZoneClick &&
      onPhotoZoneNativeFile
    );
    const flatPhotoPlaceholderStyle = {
      width: '100%',
      borderRadius: f.w * 0.017,
      height: f.h * (SANDWICH_PHOTO_ZONE_MIN_H_PCT / 100),
      minHeight: f.h * 0.22,
      maxHeight: f.h * 0.32,
      flex: '0 1 auto',
      flexShrink: 1,
      background: cr.solidBgIsLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)',
      border: cr.solidBgIsLight ? `1px dashed ${cr.inkMuted}` : '1px dashed rgba(255,255,255,0.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: cr.inkMuted,
      fontWeight: 600,
      fontSize: f.w * 0.024,
      textAlign: 'center',
      padding: f.w * 0.04,
    };
    inner = (
      <div
        ref={ref}
        style={{ width:f.w, height:f.h, background:bgSolid, position:'relative', overflow:'hidden', fontFamily: bodyFF }}
      >
        <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 1 }} />
        {hasBar && (
          <div style={{
            position:'absolute', top:f.h*0.028, left:f.w*0.05, right:f.w*0.16, zIndex:25,
            display:'flex', justifyContent:'space-between', alignItems:'center', gap:f.w*0.02,
          }}>
            <span style={{
              fontSize:f.w*0.022, color:cr.inkMuted, fontFamily:bodyFF, fontWeight:400, letterSpacing:'-0.011em',
              maxWidth:'32%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{(brand.cultureHeaderLeft || '').trim()}</span>
            <span style={{
              flex:1, textAlign:'center', fontSize:f.w*0.022, color:cr.inkMuted, fontFamily:bodyFF, fontWeight:600,
              letterSpacing:'-0.011em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{brand.handle}</span>
            <span style={{ fontSize:f.w*0.022, color:cr.inkMuted, fontFamily:bodyFF, letterSpacing:'-0.011em' }}>
              {(brand.cultureHeaderYear || '').trim()}{(brand.cultureHeaderYear || '').trim() ? ' //' : ''}
            </span>
          </div>
        )}
        {showCultureIdx && (
          <div style={{
            position:'absolute', top:f.h*0.032, right:f.w*0.05, zIndex:30,
            background: cr.solidBgIsLight ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.28)',
            color: cr.solidBgIsLight ? '#1d1d1f' : '#ffffff',
            padding:`${f.h*0.006}px ${f.w*0.022}px`, borderRadius:999,
            fontSize:f.w*0.026, fontWeight:600, fontFamily:bodyFF, letterSpacing:'-0.02em',
          }}>{num}/{total}</div>
        )}
        {sandwich && imgLoading && (
          <div style={{
            position:'absolute', inset:0, zIndex:6, display:'flex', alignItems:'center', justifyContent:'center',
            background: cr.solidBgIsLight ? 'rgba(250,250,252,0.92)' : 'rgba(10,10,12,0.88)',
          }}>
            <div style={{
              width:f.w*0.065, height:f.w*0.065, borderRadius:'50%',
              border:`${f.w*0.005}px solid ${cr.solidBgIsLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'}`,
              borderTopColor: cr.accentInk, animation:'spin 0.9s linear infinite',
            }}/>
          </div>
        )}
        <OverflowScaler
          containerStyle={{
            position:'absolute',
            top: f.h * (hasBar ? 0.09 : 0.065),
            left: f.w * 0.05,
            right: f.w * 0.05,
            bottom: f.h * 0.05,
            display:'flex',
            flexDirection:'column',
            gap: f.h * 0.024,
            // Sempre flex-start: space-between empurrava o primeiro item PRA CIMA quando havia
            // overflow (causa do bug "texto cortado no topo"). Com flex-start, overflow vai pra
            // baixo onde overflow:hidden corta sem comprometer leitura do começo.
            justifyContent: 'flex-start',
            ...VC_TEXT_ZONE_STYLE,
            overflow: 'hidden',
            minWidth: 0,
            minHeight: 0,
          }}
          deps={[
            slide.title, slide.subtitle, bodyAfterCulture,
            f.w, f.h, slide.titleSize, slide.subSize, slide.bodyAfterSize,
            sandwich, !!slide.bgImage,
          ]}
          minScale={0.78}
        >
          {(scale) => (<>
          {(slide.title || '').trim() ? (
            <h2 style={{
              margin: 0,
              fontFamily: titleFF,
              overflowWrap: 'break-word',
              wordBreak: 'normal',
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
            }}>
              <CultureInlineRich
                text={slide.title || ''}
                destaqueSpans={slide.destaqueSpans?.title}
                baseColor={cr.titleInk}
                accentColor={cr.accentInk}
                fontFamily={titleFF}
                fontSize={f.w * 0.036 * ((slide.titleSize ?? 100) / 100) * scale}
                lineHeight={1.14}
                fontWeight={600}
                letterSpacing="-0.024em"
              />
            </h2>
          ) : null}
          <CultureRichParagraphs
            text={slide.subtitle}
            destaqueSpans={slide.destaqueSpans?.subtitle}
            ink={cr.subtitleInk}
            accentColor={cr.accentInk}
            fontFamily={bodyFF}
            fontSize={f.w * 0.031 * ((slide.subSize ?? 100) / 100) * scale}
            lineHeight={1.42}
            fontWeight={600}
            letterSpacing="-0.018em"
            paraGap={f.h*0.012}
          />
          {sandwich && !slide.bgImage && slideHasPendingPhotoIntent(slide) && (
            <div
              data-vc-photo-zone="1"
              style={{
                ...flatPhotoPlaceholderStyle,
                position: 'relative',
                cursor: onPhotoZoneClick ? 'pointer' : undefined,
                ...(slide.bgImageFailed ? {
                  borderColor: cr.accentInk,
                  color: cr.accentInk,
                } : null),
              }}
              role={onPhotoZoneClick && !flatPhotoNativeHit ? 'button' : undefined}
              onClick={
                onPhotoZoneClick && !flatPhotoNativeHit
                  ? (ev) => {
                    ev.stopPropagation();
                    onPhotoZoneClick();
                  }
                  : undefined
              }
            >
              {slide.bgImageFailed ? 'Falha ao gerar — toque para tentar de novo' : 'Toque para inserir foto'}
              {flatPhotoNativeHit ? (
                <input
                  type="file"
                  accept="image/*"
                  onChange={onPhotoZoneFileInputChange}
                  onTouchStart={(e) => e.stopPropagation()}
                  style={{
                    ...VC_PHOTO_ZONE_HIT_LAYER_STYLE,
                    borderRadius: f.w * 0.017,
                  }}
                  aria-label="Importar imagem na zona da foto"
                />
              ) : null}
            </div>
          )}
          {sandwich && slide.videoId && getVideoUrl(slide.videoId) && (
            <div data-vc-photo-zone="1" style={{
              width:'100%', flex: '0 1 auto',
              height: f.h * (SANDWICH_PHOTO_ZONE_MIN_H_PCT / 100),
              minHeight: f.h * 0.22, maxHeight: f.h * 0.32,
              borderRadius: f.w * 0.017, overflow:'hidden', flexShrink:1, position:'relative',
              background: cr.solidBgIsLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
              boxShadow: 'var(--shadow-product)',
            }}>
              <video
                src={getVideoUrl(slide.videoId)}
                autoPlay loop muted playsInline
                style={sandwichPhotoZoneImgStyle(slide, effectivePresentationFilter)}
              />
              {slide.overlay > 0 ? (
                <div style={{
                  position:'absolute', inset:0, pointerEvents:'none', zIndex:1,
                  background: `linear-gradient(175deg, rgba(0,0,0,${slide.overlay/100*0.4}) 0%, rgba(0,0,0,${slide.overlay/100}) 100%)`,
                }}/>
              ) : null}
              <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 2 }} />
              <span
                title="Vídeo importado"
                style={{
                  position: 'absolute', top: f.h * 0.012, right: f.w * 0.018, zIndex: 3,
                  fontSize: f.w * 0.018, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em', color: '#ffffff', background: 'rgba(0,0,0,0.48)',
                  padding: `${f.h * 0.004}px ${f.w * 0.012}px`, borderRadius: 9999,
                  backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', pointerEvents: 'none',
                  display:'inline-flex', alignItems:'center', gap:4,
                }}
              ><Video size={Math.max(8, f.w * 0.018)} aria-hidden/> VÍDEO</span>
            </div>
          )}
          {sandwich && !slide.videoId && imgReady && !imgErr && slide.bgImage && (
            <div data-vc-photo-zone="1" style={{
              width:'100%',
              flex: '0 1 auto',
              height: f.h * (SANDWICH_PHOTO_ZONE_MIN_H_PCT / 100),
              minHeight: f.h * 0.22,
              maxHeight: f.h * 0.32,
              borderRadius: f.w * 0.017,
              overflow:'hidden',
              flexShrink:1,
              position:'relative',
              background: cr.solidBgIsLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
              boxShadow: 'var(--shadow-product)',
            }}>
              <img
                src={slide.bgImage}
                alt=""
                draggable={false}
                style={sandwichPhotoZoneImgStyle(slide, effectivePresentationFilter)}
              />
              {slide.overlay > 0 ? (
                <div style={{
                  position:'absolute', inset:0, pointerEvents:'none', zIndex:1,
                  background: `linear-gradient(175deg, rgba(0,0,0,${slide.overlay/100*0.4}) 0%, rgba(0,0,0,${slide.overlay/100}) 100%)`,
                }}/>
              ) : null}
              <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 2 }} />
              {slide.bgImageSource === 'ai' ? (
                <span
                  title="Imagem gerada por IA"
                  style={{
                    position: 'absolute',
                    top: f.h * 0.012,
                    right: f.w * 0.018,
                    zIndex: 3,
                    fontSize: f.w * 0.018,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.04em',
                    color: '#ffffff',
                    background: 'rgba(0,0,0,0.48)',
                    padding: `${f.h * 0.004}px ${f.w * 0.012}px`,
                    borderRadius: 9999,
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    pointerEvents: 'none',
                  }}
                >✨ IA</span>
              ) : null}
            </div>
          )}
          {/* Body sem AutoFitText: deixa OverflowScaler medir a altura real e escalar
              uniformemente. Wrapper com width 100% pro CultureRichParagraphs ocupar a largura. */}
          <div style={{ width: '100%' }}>
            <CultureRichParagraphs
              text={bodyAfterCulture}
              destaqueSpans={slide.destaqueSpans?.bodyAfterImage}
              ink={cr.bodyInk}
              accentColor={cr.accentInk}
              fontFamily={bodyFF}
              fontSize={f.w * 0.029 * ((slide.bodyAfterSize ?? slide.subSize ?? 100) / 100) * scale}
              lineHeight={1.45}
              fontWeight={600}
              letterSpacing="-0.016em"
              paraGap={f.h*0.01}
            />
          </div>
          </>)}
        </OverflowScaler>
        {brand.logo && (() => {
          const pos = brand.logoPosition || 'tr';
          const margin = f.w * 0.045;
          const sizePx = (brand.logoSize ?? 30) * (f.w / 1080);
          const topOffset = hasBar && pos.startsWith('t') && pos.endsWith('r') ? margin + f.h * 0.072 : margin;
          const style = {
            position:'absolute',
            width: sizePx, height: sizePx,
            opacity: (brand.logoOpacity ?? 90) / 100,
            backgroundImage: `url(${brand.logo})`,
            backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
            zIndex: 20,
          };
          if (pos === 'tl') Object.assign(style, { top: margin,    left: margin });
          if (pos === 'tr') Object.assign(style, { top: topOffset, right: margin });
          if (pos === 'bl') Object.assign(style, { bottom: margin, left: margin });
          if (pos === 'br') Object.assign(style, { bottom: margin, right: margin });
          return <div style={style} aria-hidden/>;
        })()}
        {brand.showHandle && slide.showHandle && !hideInstaBadge && (brand.handle || '').trim() && (
          <div style={{
            ...vcHandleBadgeBoxPositionStyle(brand),
            display:'flex', alignItems:'center', gap:f.w*0.012,
            background: cr.solidBgIsLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
            backdropFilter:'blur(12px)',
            padding:`${f.h*0.01}px ${f.w*0.022}px`,
            borderRadius:999,
            border: cr.solidBgIsLight ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.12)',
          }}>
            <div style={{
              width:f.w*0.034, height:f.w*0.034, borderRadius:'50%',
              background:'conic-gradient(from 45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink: 0,
            }}>
              <div style={{
                width:'76%', height:'76%', borderRadius:'50%',
                overflow:'hidden',
                background: brand.handleAvatar ? '#0a0a0a' : bgSolid,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                {brand.handleAvatar ? (
                  <img
                    src={brand.handleAvatar}
                    alt=""
                    draggable={false}
                    style={vcHandleAvatarImgStyle(brand)}
                  />
                ) : (
                  <div style={{ width:'100%', height:'100%', borderRadius:'50%', background: bgSolid, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ width:'54%', height:'54%', borderRadius:'50%', border:`${f.w*0.004}px solid ${cr.titleInk}` }}/>
                  </div>
                )}
              </div>
            </div>
            <span style={{ color: cr.titleInk, fontSize:f.w*0.022, fontWeight:600, fontFamily: bodyFF, letterSpacing:'-0.01em' }}>
              {brand.handle}
            </span>
          </div>
        )}
      </div>
    );
  } else if (cvEnabled && cvVar === 'classic') {
    inner = (
      <ClassicCanvasInner
        ref={ref}
        f={f}
        slide={slide}
        brand={brand}
        bg={bg}
        titleFF={titleFF}
        bodyFF={bodyFF}
        isBebas={isBebas}
        culture={cultureRichText}
        cultureAccentCol={cultureAccentCol}
        cultureCoverOnly={cultureCoverOnly}
        showCultureIdx={showCultureIdx}
        num={num}
        total={total}
        hideInstaBadge={hideInstaBadge}
        titleInk={displayTitleInk}
        bodyInk={displayBodyInk}
        imgModeNorm={imgModeNorm}
        effectivePresentationFilter={effectivePresentationFilter}
        bgFit={bgFit}
        bgPos={bgPos}
        bgScale={bgScale}
        imgReady={imgReady}
        imgErr={imgErr}
        imgLoading={imgLoading}
        showCanvasChrome={showCanvasChrome}
        onCanvasPatch={onCanvasPatch}
        onPhotoZoneClick={onPhotoZoneClick}
        onPhotoZoneFileChange={onPhotoZoneNativeFile ? onPhotoZoneFileInputChange : undefined}
        swapSlideIdx={enableZoneSwapDrag && showCanvasChrome ? slideIdx : null}
        swapZoneKeys={undefined}
        interactionScale={scale}
      />
    );
  } else if (normalizePhotoRegion(slide) !== 'full' && !cvEnabled && !(sandwich || cultureStatFlat)) {
    inner = (
      <ClassicLegadoInsetPhotoColumn
        ref={ref}
        f={f}
        slide={slide}
        brand={brand}
        bg={bg}
        L={L}
        isBebas={isBebas}
        titleFF={titleFF}
        bodyFF={bodyFF}
        displayTitleInk={displayTitleInk}
        displayBodyInk={displayBodyInk}
        cultureRichText={cultureRichText}
        cultureAccentCol={cultureAccentCol}
        sandwichSkin={sandwichSkin}
        showCultureIdx={showCultureIdx}
        num={num}
        total={total}
        hideInstaBadge={hideInstaBadge}
        imgReady={imgReady}
        imgErr={imgErr}
        imgLoading={imgLoading}
        imgModeNorm={imgModeNorm}
        effectivePresentationFilter={effectivePresentationFilter}
        bgFit={bgFit}
        bgPos={bgPos}
        bgScale={bgScale}
        photoRegionId={normalizePhotoRegion(slide)}
        onPhotoZoneClick={onPhotoZoneClick}
        showCanvasChrome={showCanvasChrome}
      />
    );
  } else {
    inner = (
    <div
      ref={ref}
      style={{ width:f.w, height:f.h, background:bg, position:'relative', overflow:'hidden', fontFamily: bodyFF }}
    >
      {/* BG Image — bgFit: cover (preenche) | contain (inteira) | custom (zoom % legado) */}
      {slide.bgImage && imgReady && !imgErr && (
        <div style={{ position:'absolute', inset:0, overflow:'hidden' }}>
          <div style={{
            position:'absolute', inset:0,
            backgroundImage:`url(${slide.bgImage})`,
            backgroundPosition:bgPos,
            backgroundRepeat:'no-repeat',
            opacity:slide.bgOpacity/100,
            ...(bgFit === 'custom'
              ? {
                  backgroundSize:`${slide.bgZoom}%`,
                  transform: slide.bgMirror ? 'scaleX(-1)' : 'none',
                }
              : {
                  backgroundSize: bgFit === 'contain' ? 'contain' : 'cover',
                  transform: `${slide.bgMirror ? 'scaleX(-1) ' : ''}scale(${bgScale})`,
                  transformOrigin: bgPos,
                }),
            ...(effectivePresentationFilter ? { filter: effectivePresentationFilter } : {}),
          }}/>
        </div>
      )}
      {slide.bgImage && imgReady && !imgErr && slide.overlay > 0 && (
        <div style={{
          position:'absolute', inset:0,
          background: cultureCoverOnly
            ? `linear-gradient(to top, rgba(0,0,0,${Math.min(0.92, slide.overlay/100 * 1.05)}) 0%, rgba(0,0,0,${slide.overlay/100*0.35}) 45%, transparent 72%)`
            : `linear-gradient(175deg, rgba(0,0,0,${slide.overlay/100*0.4}) 0%, rgba(0,0,0,${slide.overlay/100}) 100%)`,
        }}/>
      )}
      <VcBgPatternLayer pattern={slide.bgPattern} style={{ zIndex: 1 }} />

      {/* Header bar 3-col + badge "N/M" — usado por presets visuais editoriais
          (Sports Editorial etc) em modo full-bleed (não-Cultura). Já existe
          variante no renderer Cultura; aqui é versão simplificada pra classic. */}
      {(() => {
        const hLeft  = (brand.cultureHeaderLeft  || '').trim();
        // Centro: se preset setar explicitamente (mesmo ''), respeita.
        // Senão (undefined/null), fallback pro handle do user.
        const hCenter = (typeof brand.cultureHeaderCenter === 'string'
          ? brand.cultureHeaderCenter
          : (brand.handle || '')).trim();
        const hRight = (brand.cultureHeaderYear  || '').trim();
        const hasHeaderBar = !!(hLeft || hRight) || (!!hCenter && brand.cultureHeaderLeft);
        const hasPageBadge = !!brand.showPageBadge;
        if (!hasHeaderBar && !hasPageBadge) return null;
        // Cor branca translúcida quando há foto BG; senão tom da marca.
        const headerColor = slide.bgImage ? 'rgba(255,255,255,0.85)' : (displayBodyInk || '#555');
        const badgeBg = slide.bgImage ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.12)';
        const badgeColor = slide.bgImage ? '#fff' : (displayBodyInk || '#222');
        return (
          <>
            {hasHeaderBar && (
              <div style={{
                position:'absolute', top:f.h*0.028, left:f.w*0.05,
                right: hasPageBadge ? f.w*0.16 : f.w*0.05,
                zIndex:25,
                display:'flex', justifyContent:'space-between', alignItems:'center',
                gap:f.w*0.02, pointerEvents:'none',
              }}>
                <span style={{
                  fontSize:f.w*0.020, color:headerColor, fontFamily:bodyFF,
                  fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase',
                  maxWidth:'32%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                }}>{hLeft}</span>
                <span style={{
                  flex:1, textAlign:'center',
                  fontSize:f.w*0.020, color:headerColor, fontFamily:bodyFF,
                  fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                }}>{hCenter}</span>
                <span style={{
                  fontSize:f.w*0.020, color:headerColor, fontFamily:bodyFF,
                  fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase',
                  maxWidth:'32%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'right',
                }}>{hRight}</span>
              </div>
            )}
            {hasPageBadge && (
              <div style={{
                position:'absolute', top:f.h*0.024, right:f.w*0.05, zIndex:30,
                background: badgeBg, color: badgeColor,
                padding:`${f.h*0.006}px ${f.w*0.022}px`, borderRadius:9999,
                fontSize:f.w*0.024, fontWeight:600, fontFamily:bodyFF,
                letterSpacing:'-0.011em', fontVariantNumeric:'tabular-nums',
                backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)',
                pointerEvents:'none',
              }}>{num}/{total}</div>
            )}
          </>
        );
      })()}

      {/* Loading até a URL da imagem terminar de baixar */}
      {imgLoading && (
        <div style={{
          position:'absolute', inset:0, zIndex:5,
          background:'rgba(10,9,8,0.92)',
          display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:f.h*0.018,
        }}>
          <div style={{
            width:f.w*0.07, height:f.w*0.07,
            borderRadius:'50%',
            border:`${f.w*0.006}px solid rgba(255,255,255,0.1)`,
            borderTopColor:'var(--accent)',
            animation:'spin 0.9s linear infinite',
          }}/>
          <span style={{
            color:'rgba(255,255,255,0.55)',
            fontSize:f.w*0.026,
            fontWeight:600,
            letterSpacing:'-0.011em',
          }}>
            {imgModeNorm === 'dalle' ? 'Gerando com GPT Image 2…' : 'Carregando…'}
          </span>
          {imgModeNorm === 'dalle' && (
          <span style={{
            color:'rgba(255,255,255,0.32)',
            fontSize:f.w*0.02,
            letterSpacing:'-0.011em',
          }}>GPT Image 2 · OpenAI · ~30s por slide</span>
          )}
        </div>
      )}

      {sandwichSkin && (() => {
        const hasHdr = !!(brand.cultureHeaderLeft || '').trim() || !!(brand.cultureHeaderYear || '').trim();
        const onPhoto = !!(slide.bgImage && imgReady && !imgErr);
        const barMuted = onPhoto ? 'rgba(255,255,255,0.62)' : 'rgba(29,29,31,0.45)';
        return (
          <>
            {hasHdr && (
              <div style={{
                position:'absolute', top:f.h*0.028, left:f.w*0.05, right:f.w*0.16, zIndex:24,
                display:'flex', justifyContent:'space-between', alignItems:'center', gap:f.w*0.02,
              }}>
                <span style={{
                  fontSize:f.w*0.022, color:barMuted, fontFamily:bodyFF, fontWeight:400, letterSpacing:'-0.011em',
                  maxWidth:'34%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                }}>{(brand.cultureHeaderLeft || '').trim()}</span>
                <span style={{
                  flex:1, textAlign:'center', fontSize:f.w*0.022, color:barMuted, fontFamily:bodyFF, fontWeight:600,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                }}>{brand.handle}</span>
                <span style={{ fontSize:f.w*0.022, color:barMuted, fontFamily:bodyFF }}>
                  {(brand.cultureHeaderYear || '').trim()}{(brand.cultureHeaderYear || '').trim() ? ' //' : ''}
                </span>
              </div>
            )}
            {showCultureIdx && (
              <div style={{
                position:'absolute', top:f.h*0.032, right:f.w*0.05, zIndex:26,
                background: onPhoto ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.07)',
                color: onPhoto ? '#fff' : '#1d1d1f',
                padding:`${f.h*0.006}px ${f.w*0.022}px`, borderRadius:999,
                fontSize:f.w*0.026, fontWeight:600, fontFamily:bodyFF, letterSpacing:'-0.02em',
              }}>{num}/{total}</div>
            )}
          </>
        );
      })()}

      {/* Handle badge */}
      {brand.showHandle && slide.showHandle && !hideInstaBadge && (
        <div style={{
          ...vcHandleBadgeBoxPositionStyle(brand),
          display:'flex', alignItems:'center', gap:f.w*0.012,
          background:'rgba(255,255,255,0.08)',
          backdropFilter:'blur(12px)',
          padding:`${f.h*0.01}px ${f.w*0.022}px`,
          borderRadius:999,
          border:'1px solid rgba(255,255,255,0.12)',
        }}>
          <div style={{
            width:f.w*0.034, height:f.w*0.034, borderRadius:'50%',
            background:'conic-gradient(from 45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
            display:'flex', alignItems:'center', justifyContent:'center',
            flexShrink: 0,
          }}>
            <div style={{
              width:'76%', height:'76%', borderRadius:'50%',
              overflow:'hidden',
              background: brand.handleAvatar ? '#0a0a0a' : bg,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {brand.handleAvatar ? (
                <img
                  src={brand.handleAvatar}
                  alt=""
                  draggable={false}
                  style={vcHandleAvatarImgStyle(brand)}
                />
              ) : (
                <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ width:'54%', height:'54%', borderRadius:'50%', border:`${f.w*0.004}px solid ${brand.titleColor}` }}/>
                </div>
              )}
            </div>
          </div>
          <span style={{ color:brand.titleColor, fontSize:f.w*0.022, fontWeight:600, fontFamily: bodyFF, letterSpacing:'-0.01em' }}>
            {brand.handle}
          </span>
        </div>
      )}

      {/* Main content */}
      {(() => {
        const inset = (slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET);
        const padH = f.w * (0.04 + inset * 0.004);
        const padVTop = f.h * (0.09 + inset * 0.003);
        const padVBot = f.h * (0.06 + inset * 0.003);
        const shadow = slide.textShadow !== false
          ? '0 2px 24px rgba(0,0,0,0.85), 0 1px 6px rgba(0,0,0,0.95)'
          : 'none';
        const textBgColor = slide.textBg
          ? `rgba(0,0,0,${(slide.textBgOpacity ?? 55) / 100 * 0.75})`
          : 'transparent';
        return (
          <div style={{
            position:'absolute', inset:0,
            padding:`${padVTop}px ${padH}px ${padVBot}px`,
            display:'flex', flexDirection:'column',
            justifyContent:L.jc, alignItems:L.ai,
            textAlign:slide.align,
            overflow: 'hidden',
            ...VC_TEXT_ZONE_STYLE,
          }}>
            <div style={{
              background:textBgColor,
              backdropFilter: slide.textBg ? 'blur(8px)' : 'none',
              borderRadius: slide.textBg ? f.w*0.025 : 0,
              padding: slide.textBg ? `${f.h*0.022}px ${f.w*0.04}px` : 0,
              display:'inline-flex', flexDirection:'column',
              alignItems:
                slide.align==='center'  ? 'center'   :
                slide.align==='right'   ? 'flex-end' :
                slide.align==='justify' ? 'stretch'  :
                                          'flex-start',
              gap: f.h*0.018,
              maxWidth:'92%',
            }}>
              {/* Star ornament (8-pontas) — usado em presets como Case Study Neon.
                  Centrado independente do align do título. */}
              {brand.showStarOrnament && (
                <svg
                  viewBox="0 0 24 24"
                  width={f.w*0.045}
                  height={f.w*0.045}
                  style={{ alignSelf:'center', flexShrink:0 }}
                  aria-hidden
                >
                  <g fill={brand.accent || displayTitleInk}>
                    <polygon points="12,1 13,11 23,12 13,13 12,23 11,13 1,12 11,11"/>
                    <g transform="rotate(45 12 12)">
                      <polygon points="12,3 13,11 21,12 13,13 12,21 11,13 3,12 11,11"/>
                    </g>
                  </g>
                </svg>
              )}
              {/* Eyebrow — texto MAIÚSCULAS pequeno acima do título.
                  Usado em refs editoriais (NBA, NMLSS, Cadore). */}
              {slide.eyebrowText && (
                <span style={{
                  fontSize: f.w*0.024,
                  fontFamily: bodyFF,
                  fontWeight: 600,
                  color: displayBodyInk,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  lineHeight: 1.3,
                  margin: 0,
                  alignSelf: brand.showStarOrnament ? 'center' : 'auto',
                  textShadow: shadow,
                }}>{slide.eyebrowText}</span>
              )}
              <h1 style={{
                color: displayTitleInk, fontFamily: titleFF,
                fontSize:f.w*0.084*(slide.titleSize/100),
                lineHeight:(slide.titleLeading ?? 105)/100,
                fontWeight:slide.titleWeight ?? 800,
                // tracking em centi-em: default -3 (-0.03em). User pode ir de -10 a +30 → -0.13em a +0.27em
                letterSpacing:`${(-3 + (slide.titleTracking ?? 0)) / 100}em`,
                margin:0,
                textTransform:
                  slide.titleCase === 'upper' ? 'uppercase' :
                  slide.titleCase === 'lower' ? 'lowercase' :
                  isBebas ? 'uppercase' : 'none',
                textShadow: shadow,
              }}>{cultureRichText ? (
                <CultureInlineRich
                  text={slide.title || ''}
                  destaqueSpans={slide.destaqueSpans?.title}
                  baseColor={displayTitleInk}
                  accentColor={cultureAccentCol}
                  fontFamily={titleFF}
                  fontSize={f.w*0.084*(slide.titleSize/100)}
                  lineHeight={(slide.titleLeading ?? 105)/100}
                  fontWeight={slide.titleWeight ?? 800}
                  letterSpacing={`${(-3 + (slide.titleTracking ?? 0)) / 100}em`}
                />
              ) : slide.title}</h1>
              {/* Subtítulo — preset controla via brand.subtitleVisible/Weight/Case
                  (presets editoriais como Sports/NMLSS escondem subtítulo pra
                  não competir com eyebrow+título). */}
              {slide.subtitle && brand.subtitleVisible !== false && (
                cultureRichText ? (
                  <div style={{
                    margin:0,
                    maxWidth:'100%',
                    letterSpacing:`${(-1 + (slide.subTracking ?? 0)) / 100}em`,
                    textShadow: shadow,
                  }}>
                    <CultureRichParagraphs
                      text={slide.subtitle}
                      destaqueSpans={slide.destaqueSpans?.subtitle}
                      ink={displayBodyInk}
                      accentColor={cultureAccentCol}
                      fontFamily={bodyFF}
                      fontSize={f.w*0.028*(slide.subSize/100)}
                      lineHeight={(slide.subLeading ?? 150)/100}
                      fontWeight={brand.subtitleWeight ?? 400}
                      letterSpacing={`${(-1 + (slide.subTracking ?? 0)) / 100}em`}
                      paraGap={f.h*0.010}
                    />
                  </div>
                ) : (
                <p style={{
                  color: displayBodyInk, fontFamily: bodyFF,
                  fontSize:f.w*0.028*(slide.subSize/100),
                  lineHeight:(slide.subLeading ?? 150)/100,
                  fontWeight: brand.subtitleWeight ?? 400,
                  margin:0,
                  letterSpacing:`${(-1 + (slide.subTracking ?? 0)) / 100}em`,
                  textShadow: shadow,
                  textTransform: brand.subtitleCase === 'upper' ? 'uppercase'
                    : brand.subtitleCase === 'lower' ? 'lowercase' : 'none',
                  fontStyle: brand.subtitleItalic ? 'italic' : 'normal',
                }}>{slide.subtitle}</p>
              ))}
              {/* After-title text (Bold Promo Pink REF 4): linha curta abaixo
                  do título. Suporta strikethroughText pra preço antigo riscado:
                  "DE R$99" riscado + "POR R$0,00 (100% GRATUITO)" intacto. */}
              {slide.afterTitleText && (
                <p style={{
                  color: displayTitleInk, fontFamily: titleFF,
                  fontSize: f.w*0.034,
                  fontWeight: slide.titleWeight ?? 800,
                  letterSpacing: `${(-3 + (slide.titleTracking ?? 0)) / 100}em`,
                  margin: 0,
                  textTransform: slide.titleCase === 'upper' ? 'uppercase' : 'none',
                  textShadow: shadow,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: f.w*0.014,
                  alignItems: 'baseline',
                }}>
                  {slide.strikethroughText && (
                    <span style={{
                      textDecoration: 'line-through',
                      textDecorationColor: brand.accent || '#dc2626',
                      textDecorationThickness: f.w*0.004,
                      opacity: 0.85,
                    }}>{slide.strikethroughText}</span>
                  )}
                  <span>{slide.afterTitleText}</span>
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Footer bar 3 colunas (Authority Black REF 11): Topic / Brought by / Save.
          Texto pequeno MAIÚSCULAS distribuído no rodapé, similar ao header
          mas em baixo. Cada coluna tem label cinza + valor branco em 2 linhas. */}
      {(() => {
        const fLeft = brand.footerBarLeft;
        const fCenter = brand.footerBarCenter;
        const fRight = brand.footerBarRight;
        const hasFooter = !!(fLeft || fCenter || fRight);
        if (!hasFooter) return null;
        const labelColor = slide.bgImage ? 'rgba(255,255,255,0.55)' : (displayBodyInk || '#888');
        const valueColor = slide.bgImage ? '#ffffff' : (displayTitleInk || '#000');
        const Col = ({ data }) => {
          if (!data) return <div style={{ flex:1 }}/>;
          const [label, value] = String(data).split('|');
          return (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:f.h*0.004 }}>
              <span style={{ fontSize: f.w*0.020, fontFamily: bodyFF, color: labelColor,
                letterSpacing:'0.04em', textTransform:'uppercase' }}>{label || ''}</span>
              {value && (
                <span style={{ fontSize: f.w*0.022, fontFamily: bodyFF, color: valueColor,
                  fontWeight: 700 }}>{value}</span>
              )}
            </div>
          );
        };
        return (
          <div style={{
            position:'absolute', bottom: f.h*0.038, left: f.w*0.05, right: f.w*0.05,
            zIndex: 25, display:'flex', justifyContent:'space-between', alignItems:'flex-start',
            gap: f.w*0.02, pointerEvents:'none',
          }}>
            <Col data={fLeft}/>
            <Col data={fCenter}/>
            <Col data={fRight}/>
          </div>
        );
      })()}

      {/* Footer pill com seta — usado em presets como Case Study Neon
          (CTA verde-neon) e Reflexivo Cream (handle pill). Texto + seta
          circular contrastante. Cor de fundo = brand.accent. */}
      {brand.footerPillText && (() => {
        const pillBg = brand.footerPillBg || brand.accent || '#0a0a0a';
        const pillFg = brand.footerPillFg || (pillBg === brand.accent ? '#0a0a0a' : '#ffffff');
        // Seta opcional — REF 2/5 mostram, REF 3 (Mood Sépia hashtag) não.
        // Default true se undefined; só esconde quando explicitamente false.
        const showArrow = brand.footerPillArrow !== false;
        // Padding-right encolhe quando não tem seta (visual mais compacto).
        const padRight = showArrow ? f.w*0.014 : f.w*0.028;
        return (
          <div style={{
            position:'absolute', bottom: f.h*0.058,
            left:'50%', transform:'translateX(-50%)',
            zIndex:25, pointerEvents:'none',
          }}>
            <div style={{
              background: pillBg, color: pillFg,
              padding: `${f.h*0.012}px ${padRight}px ${f.h*0.012}px ${f.w*0.028}px`,
              borderRadius: 9999,
              display:'inline-flex', alignItems:'center', gap: f.w*0.018,
              fontSize: f.w*0.026, fontWeight:700, fontFamily: bodyFF,
              letterSpacing:'-0.011em', whiteSpace:'nowrap',
              textTransform: 'uppercase',
              boxShadow:'0 4px 16px rgba(0,0,0,0.18)',
            }}>
              {brand.footerPillText}
              {showArrow && (
                <span style={{
                  width: f.w*0.05, height: f.w*0.05, borderRadius:'50%',
                  background: pillFg, color: pillBg,
                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                  fontSize: f.w*0.030, fontWeight:700, lineHeight:1,
                  flexShrink:0,
                }}>→</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Logo da marca — renderiza em qualquer canto, baseado no brand.logoPosition */}
      {brand.logo && (() => {
        // Se o handle está no topo, evita conflito com a logo (desloca pra mais longe)
        const handleAtTop = brand.showHandle;
        const pos = brand.logoPosition || 'tr';
        const margin = f.w * 0.045;
        const sizePx = (brand.logoSize ?? 30) * (f.w / 1080); // proporção em relação ao slide
        // Quando o handle está no topo direito e a logo no topo direito, desloca a logo pra baixo do handle
        const topOffset = handleAtTop && pos.startsWith('t') && pos.endsWith('r') ? margin + f.h * 0.05 : margin;
        const style = {
          position:'absolute',
          width: sizePx, height: sizePx,
          opacity: (brand.logoOpacity ?? 90) / 100,
          backgroundImage: `url(${brand.logo})`,
          backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
        };
        if (pos === 'tl') Object.assign(style, { top: margin,    left: margin });
        if (pos === 'tr') Object.assign(style, { top: topOffset, right: margin });
        if (pos === 'bl') Object.assign(style, { bottom: margin, left: margin });
        if (pos === 'br') Object.assign(style, { bottom: margin, right: margin });
        return <div style={style} aria-hidden/>;
      })()}
    </div>
  );
  }

  const surfaceQuick = (sandwich || cultureStatFlat) ? cultureResolveSurface(slide, num) : null;
  const lightCultureOuter = resolveSlideBrandBg(brand, slideIdx, slide) || '#fafafc';
  const outerBg = surfaceQuick
    ? (surfaceQuick === 'dark' ? cultureDarkBackdropFromBrand(brand.bg) : surfaceQuick === 'accent' ? (brand.accent || '#000000') : lightCultureOuter)
    : bg;

  const showSwipe = slide.showSwipeCue !== false
    && brand.showSwipeCue !== false
    && total > 1
    && slideIdx < total - 1
    && getComposition(slide.composition)?.showSwipeCue !== false;
  const showEdgePeek = !!(slide.edgePeek || getComposition(slide.composition)?.edgePeek);

  return (
    <div style={{
      width:f.w*scale, height:f.h*scale,
      position:'relative', overflow:'hidden',
      borderRadius: scale < 0.9 ? 10 : 0,
      flexShrink:0, background: outerBg,
    }}>
      <div style={{ transform:`scale(${scale})`, transformOrigin:'top left', width:f.w, height:f.h, position:'relative' }}>
        {inner}
        {showEdgePeek && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: f.w * 0.028,
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.18))',
              pointerEvents: 'none',
              zIndex: 40,
            }}
          />
        )}
        {showSwipe && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: f.w * 0.028,
              top: '50%',
              transform: 'translateY(-50%)',
              width: f.w * 0.055,
              height: f.w * 0.055,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.35)',
              color: '#F2EDE4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: f.w * 0.032,
              fontWeight: 600,
              fontFamily: 'var(--font-ui), system-ui, sans-serif',
              pointerEvents: 'none',
              zIndex: 41,
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            →
          </div>
        )}
      </div>
    </div>
  );
});

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

// Section wrapper
// Agrupador de fontes por categoria com filtro lateral.
// `fonts` é um array de { name, val, cat? }; cats reconhecidas:
// 'sans', 'display', 'serif', 'editorial', 'mono'
const FONT_CAT_LABELS = {
  all:       'Todas',
  sans:      'Sans',
  display:   'Display',
  serif:     'Serif',
  editorial: 'Editorial',
  mono:      'Mono',
};
const FontPairingPicker = ({ brand, onApply, children }) => {
  const [showAll, setShowAll] = React.useState(false);
  return (
    <>
      <S title="Pairings tipográficos" hint="Combinações curadas para carrosséis virais. “Todas as fontes” abre os pickers individuais.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
          {FONT_PAIRINGS.map((p) => {
            const active = pairingMatchesBrand(brand, p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onApply(p)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-surface)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'grid',
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: p.titleFont, color: 'var(--text-primary)' }}>
                  {p.name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                  {p.use} · título + corpo
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          style={{
            marginTop: 8,
            height: 34,
            borderRadius: 9999,
            border: '1px solid var(--border)',
            background: 'var(--bg-pearl)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
        >
          {showAll ? 'Ocultar fontes individuais' : 'Todas as fontes'}
        </button>
      </S>
      {showAll ? children : null}
    </>
  );
};

const FontPicker = ({ title, fonts, active, onChange }) => {
  const [cat, setCat] = React.useState('all');
  const cats = React.useMemo(() => {
    const s = new Set(fonts.map(f => f.cat || 'sans'));
    return ['all', ...['sans','display','serif','editorial','mono'].filter(c => s.has(c))];
  }, [fonts]);
  const filtered = cat === 'all' ? fonts : fonts.filter(f => (f.cat || 'sans') === cat);
  return (
    <S title={title}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:2 }}>
        {cats.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            style={{
              fontSize:11, padding:'4px 12px', borderRadius:9999, cursor:'pointer',
              fontWeight:400, letterSpacing:'-0.011em',
              transition:'background-color 0.15s var(--ease-smooth), color 0.15s var(--ease-smooth)',
              background: cat === c ? 'var(--accent)' : 'var(--bg-pearl)',
              border: `1px solid ${cat === c ? 'var(--accent)' : 'var(--hairline)'}`,
              color: cat === c ? '#fff' : 'var(--text-secondary)',
            }}
          >{FONT_CAT_LABELS[c] || c}</button>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, maxHeight:240, overflowY:'auto', paddingRight:4 }}>
        {filtered.map(f => (
          <button key={f.name} onClick={()=>onChange(f.val)}
            style={{
              padding:'9px 8px', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer',
              fontFamily:f.val, transition:'all 0.12s', textAlign:'left',
              background: active===f.val ? 'var(--text-primary)' : 'var(--bg-card)',
              border: `1px solid ${active===f.val ? 'transparent' : 'var(--border)'}`,
              color: active===f.val ? 'var(--bg-base)' : 'var(--text-secondary)',
              minHeight:36, display:'flex', alignItems:'center',
            }}
            title={f.name}
          >{f.name}</button>
        ))}
      </div>
    </S>
  );
};

/**
 * ModeSwitcher — chip dropdown pra trocar entre Criador / Diretor / Studio.
 * Controla progressive disclosure global do Narrative OS (FASE 2).
 *
 * - Criador (90% users): só tema, estilo, intensidade, gerar. Tabs reduzidas.
 * - Diretor (intermediate): + narrativa, branding, composição, IA, estética.
 * - Studio (advanced): tudo + grids, tracking, overlays, canvas, ajustes finos.
 */
const APP_MODES = [
  { id: 'criador',  label: 'Criador',  icon: Sparkles,    desc: 'Simples — tema, estilo e gerar' },
  { id: 'diretor',  label: 'Diretor',  icon: SlidersHorizontal, desc: 'Controle intermediário' },
  { id: 'studio',   label: 'Studio',   icon: Settings,    desc: 'Avançado — todos os controles' },
];

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
function ModeSwitcher({ value, onChange, compact = false }) {
  const [open, setOpen] = React.useState(false);
  // Posição calculada em px (não CSS `absolute` relativo ao wrapper) porque o
  // <header> pai usa `overflow:hidden` (pro collapse mobile) e clipava o menu,
  // deixando os itens visíveis-mas-inclicáveis / invisíveis. `position:fixed`
  // ancorado via getBoundingClientRect escapa desse clipping.
  const [menuPos, setMenuPos] = React.useState(null);
  const refMenu = React.useRef(null);
  const current = APP_MODES.find((m) => m.id === value) || APP_MODES[0];
  React.useLayoutEffect(() => {
    if (!open) return;
    const updatePos = () => {
      const r = refMenu.current?.getBoundingClientRect();
      if (!r) return;
      const menuW = 220;
      const vw = typeof window !== 'undefined' ? window.innerWidth : 9999;
      const left = Math.min(r.left, Math.max(8, vw - menuW - 8));
      setMenuPos({ top: r.bottom + 8, left });
    };
    updatePos();
    const onClickOutside = (e) => {
      if (!refMenu.current || !refMenu.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);
  const Ic = current.icon;
  return (
    <div ref={refMenu} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Modo atual: ${current.label}. Clique para mudar.`}
        title={`Modo: ${current.label} — ${current.desc}`}
        style={{
          minHeight: 34, padding: compact ? '0 10px' : '0 12px',
          borderRadius: 9999,
          border: '1px solid var(--glass-border-strong)',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(18px) saturate(180%)',
          WebkitBackdropFilter: 'blur(18px) saturate(180%)',
          color: 'var(--text-primary)',
          fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)',
          letterSpacing: '-0.011em',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        }}
      >
        <Ic size={13} strokeWidth={2.25} style={{ color: 'var(--accent)' }}/>
        {!compact && <span>{current.label}</span>}
        <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}/>
      </button>
      {open && menuPos && (
        <div
          role="menu"
          style={{
            position: 'fixed', top: menuPos.top, left: menuPos.left,
            minWidth: 220,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%), var(--bg-secondary)',
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            border: '1px solid var(--glass-border-strong)',
            borderRadius: 14,
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.42), 0 0 40px rgba(255, 45, 141, 0.10)',
            padding: 4, zIndex: 100,
            animation: 'fadeUp 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {APP_MODES.map((m) => {
            const I = m.icon;
            const active = m.id === value;
            return (
              <button
                key={m.id}
                role="menuitem"
                type="button"
                onClick={() => { onChange(m.id); setOpen(false); }}
                aria-current={active}
                style={{
                  width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', borderRadius: 10, border: 'none',
                  background: active ? 'rgba(255, 45, 141, 0.10)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font-ui)',
                  transition: 'background 0.15s var(--ease-smooth)',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: active ? 'rgba(255, 45, 141, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <I size={14} strokeWidth={2.25}/>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'block', fontSize: 13, fontWeight: 600,
                    color: active ? 'var(--accent)' : 'var(--text-primary)',
                    letterSpacing: '-0.011em', lineHeight: 1.2,
                  }}>{m.label}</span>
                  <span style={{
                    display: 'block', fontSize: 11, color: 'var(--text-muted)',
                    marginTop: 2, lineHeight: 1.3,
                  }}>{m.desc}</span>
                </span>
                {active && <Check size={13} strokeWidth={2.5} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 4 }}/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * ModesIntroModal — onboarding dos 3 modos. Aparece na primeira visita
 * e pode ser reaberto via menu "?". Glass dark premium.
 */

// Slider with dynamic fill
const Slider = ({ label, value, min, max, onChange }) => {
  const pct = ((value - min) / (max - min)) * 100;
  const apply = (v) => {
    const n = +v;
    if (Number.isNaN(n)) return;
    onChange(Math.min(max, Math.max(min, n)));
  };
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <span style={{ fontSize:13, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', fontWeight:400, letterSpacing:'-0.011em' }}>{label}</span>
        <span style={{ fontSize:13, color:'var(--text-primary)', fontFamily:'var(--font-ui)', fontWeight:600, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.011em' }}>{value}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => apply(e.target.value)}
        onInput={(e) => apply(e.target.value)}
        style={{ '--pct': `${pct}%`, touchAction: 'pan-x', minHeight: 32 }}
      />
    </div>
  );
};

// Toggle switch
const Toggle = ({ label, value, onChange }) => (
  <button
    onClick={()=>onChange(!value)}
    style={{
      width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
      background:'var(--bg-card)', border:'1px solid var(--border)',
      borderRadius:8, padding:'8px 12px', cursor:'pointer', outline:'none',
    }}
  >
    <span style={{ fontSize:12, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', fontWeight:500 }}>{label}</span>
    <div style={{
      width:34, height:18, borderRadius:99, position:'relative',
      background: value ? 'var(--accent)' : 'var(--border)',
      transition:'background 0.2s',
      flexShrink:0,
    }}>
      <div style={{
        width:12, height:12, borderRadius:'50%', background:'#fff',
        position:'absolute', top:3,
        left: value ? 19 : 3,
        transition:'left 0.2s var(--ease-bounce)',
        boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
      }}/>
    </div>
  </button>
);

// Color row
// Biblioteca de hooks foi extraída para src/utils/hooks-library.js

// WcagBadge foi extraído para src/components/WcagBadge.jsx

const ColorRow = ({ label, value, onChange, contrastBg, contrastKind }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
    <div style={{ position:'relative', flexShrink:0 }}>
      <div style={{
        width:28, height:28, borderRadius:6, background:value,
        border:'1px solid var(--border)', cursor:'pointer', overflow:'hidden',
      }}>
        <input type="color" value={value} onChange={e=>onChange(e.target.value)}
          style={{ opacity:0, position:'absolute', inset:0, cursor:'pointer', width:'100%', height:'100%' }}
        />
      </div>
    </div>
    <input
      value={value} onChange={e=>onChange(e.target.value)}
      className="vc-input" style={{ fontSize:13, fontFamily:'var(--font-mono)', flex:1 }}
    />
    {contrastBg ? <WcagBadge fg={value} bg={contrastBg} kind={contrastKind || 'body'} /> : null}
    <span style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'var(--font-ui)', flexShrink:0, width:60, textAlign:'right', letterSpacing:'-0.011em', fontWeight:600 }}>
      {label}
    </span>
  </div>
);

// ─── MODE PICKER ──────────────────────────────────────────────────────────────
// Seletor visual dos modos narrativos. Cada card mostra ícone + nome + 1-line
// descrição. Selecionado tem borda accent e background glow.
function ModePicker({ value, onChange }) {
  const active = GEN_MODE_BY_ID[value] || GEN_MODES[0];
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <label className="vc-label" style={{ marginBottom:0 }}>
          Modo narrativo
        </label>
        <span style={{
          fontSize:10, color:'var(--text-muted)',
          fontFamily:'var(--font-mono)', letterSpacing:'0.04em',
        }}>
          {GEN_MODES.length} modos
        </span>
      </div>
      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))',
        gap:6,
      }}>
        {GEN_MODES.map(m => {
          const on = value === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              style={{
                padding:'10px 10px 9px', borderRadius:10, cursor:'pointer', textAlign:'left',
                border:`1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                background: on ? 'var(--accent-surface-strong)' : 'var(--bg-card)',
                transition:'all 0.12s',
                display:'flex', flexDirection:'column', gap:3, minHeight:60,
              }}
              title={m.desc}
            >
              <div style={{
                fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)',
                color: on ? 'var(--accent)' : 'var(--text-primary)',
                letterSpacing:'-0.011em',
                display:'flex', alignItems:'center', gap:8,
              }}>
                <m.Icon
                  size={17}
                  strokeWidth={2}
                  aria-hidden
                  style={{
                    flexShrink:0,
                    color: on ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                />
                {m.label}
              </div>
              <div style={{
                fontSize:10.5, color:'var(--text-muted)', lineHeight:1.4,
                fontFamily:'var(--font-ui)',
              }}>{m.desc}</div>
            </button>
          );
        })}
      </div>
      {/* Resumo do modo selecionado — preview do que será injetado */}
      <div style={{
        marginTop:8, fontSize:10.5, color:'var(--text-muted)',
        fontFamily:'var(--font-ui)', lineHeight:1.5,
        padding:'7px 10px', background:'var(--bg-card)',
        border:'1px dashed var(--border)', borderRadius:8,
        display:'flex', alignItems:'flex-start', gap:8,
      }}>
        <active.Icon
          size={16}
          strokeWidth={2}
          aria-hidden
          style={{ flexShrink:0, marginTop:1, color:'var(--accent)' }}
        />
        <span>
          <span style={{ color:'var(--text-secondary)', fontWeight:600 }}>{active.label}: </span>
          {active.desc}.
        </span>
      </div>
    </div>
  );
}

function ReferenceProfilesCuradoria({ material, setMaterial }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label className="vc-label" style={{ marginBottom: 4 }}>Curadoria: voz de referência</label>
        <div style={{
          fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
          lineHeight: 1.5, marginTop: 2,
        }}>
          Inspire tom e ritmo do texto (carrosséis fortes no Instagram). Não copia posts nem nomes de perfis.
        </div>
      </div>
      <div style={{
        fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.47, letterSpacing: '-0.011em',
        padding: '8px 10px', background: 'var(--bg-pearl)', borderRadius: 11, border: '1px solid var(--hairline)',
      }}>
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Sugestões por modo narrativo
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {GEN_MODES.map((m) => (
            <li key={m.id} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
              <m.Icon
                size={15}
                strokeWidth={2}
                aria-hidden
                style={{ flexShrink:0, marginTop:2, color:'var(--text-secondary)' }}
              />
              <span>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{m.label}</span>
                {' — '}
                {NARRATIVE_MODE_REF_VOICE_PAIRING[m.id]}
              </span>
            </li>
          ))}
        </ul>
        <p style={{ margin: '10px 0 0', fontSize: 11, lineHeight: 1.47 }}>
          Você pode combinar modo e voz livremente até encontrar o tom que mais agrada — não há par obrigatório.
        </p>
      </div>
      <div data-vc-tour="ref-profiles" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={() => setMaterial({ ...material, refProfileId: null })}
          style={{
            alignSelf: 'flex-start', height: 32, padding: '0 14px', borderRadius: 9999,
            border: `1px solid ${!material.refProfileId ? 'var(--accent)' : 'var(--border)'}`,
            background: !material.refProfileId ? 'var(--accent-surface-strong)' : 'var(--bg-card)',
            color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)',
            cursor: 'pointer', letterSpacing: '-0.011em',
          }}
        >
          Nenhuma referência fixa
        </button>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))',
          gap: 8,
        }}>
          {REFERENCE_PROFILES.map((p) => {
            const on = material.refProfileId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setMaterial({ ...material, refProfileId: p.id })}
                title={p.promptBlock.slice(0, 220) + '…'}
                style={{
                  textAlign: 'left', padding: '10px 10px', borderRadius: 11,
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                  background: on ? 'var(--accent-surface)' : 'var(--bg-card)',
                  cursor: 'pointer', transition: 'border-color 0.12s',
                  minHeight: 72,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.011em', lineHeight: 1.25 }}>
                  {p.label}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.35 }}>
                  {p.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── IMG PARAMS PANEL ─────────────────────────────────────────────────────────
// 4 sliders bipolares (esquerda/direita são extremos opostos). Cada um modula
// uma faceta do prompt de geração de imagem. Os valores são guardados no doc
// (persistem entre re-aberturas) e só viram instrução de prompt fora da faixa
// neutra (35..65) — assim "centro" significa "deixa a IA decidir".
const IMG_AXES = [
  { key:'fidelity',    Icon: Target,   label:'Fidelidade ao tema', left:'Metafórico', right:'Literal',     hint:'Quão direto a imagem retrata o assunto' },
  { key:'creativity',  Icon: Sparkles, label:'Criatividade',       left:'Convencional', right:'Inusitado',  hint:'Composições clássicas vs inesperadas' },
  { key:'irreverence', Icon: Flame,    label:'Irreverência',       left:'Sério',     right:'Cheeky',        hint:'Tom contemplativo vs bem-humorado' },
  { key:'objectivity', Icon: Camera,   label:'Objetividade',       left:'Atmosférico', right:'Documental',  hint:'Atmosfera/emoção vs ação/fato' },
];
function ImgParamsPanel({ value, onChange }) {
  const reset = () => IMG_AXES.forEach(a => onChange(a.key, 50));
  return (
    <div>
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:10,
      }}>
        <label style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em' }}>
          Direção da imagem
        </label>
        <button
          type="button"
          onClick={reset}
          style={{
            fontSize:11, padding:'3px 9px', borderRadius:99, cursor:'pointer',
            background:'transparent', border:'1px solid var(--border)',
            color:'var(--text-muted)', fontFamily:'var(--font-ui)',
          }}
          title="Voltar tudo ao centro (sem instruções específicas)"
        >Resetar</button>
      </div>
      <div style={{
        background:'var(--bg-card)', border:'1px solid var(--border)',
        borderRadius:11, padding:12, display:'flex', flexDirection:'column', gap:14,
      }}>
        {IMG_AXES.map(axis => {
          const v = value[axis.key] ?? 50;
          const isCenter = v >= 35 && v <= 65;
          // Cor do eixo: muted se centro, accent se foi puxado pra um lado
          const dot = isCenter ? 'var(--text-muted)' : 'var(--accent)';
          return (
            <div key={axis.key}>
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                marginBottom:6, gap:8,
              }}>
                <span style={{
                  fontSize:12, fontWeight:600, color:'var(--text-secondary)',
                  letterSpacing:'-0.011em', display:'flex', alignItems:'center', gap:8,
                }}>
                  <axis.Icon size={16} strokeWidth={2} aria-hidden style={{ flexShrink:0, color:'var(--text-secondary)' }} />
                  {axis.label}
                </span>
                <span style={{
                  fontSize:10, color: isCenter ? 'var(--text-muted)' : dot,
                  fontFamily:'var(--font-mono)', letterSpacing:'0.04em',
                  fontWeight:700,
                }}>
                  {isCenter ? 'AUTO' : v}
                </span>
              </div>
              <input
                type="range"
                min={0} max={100} step={5} value={v}
                onChange={e => onChange(axis.key, parseInt(e.target.value, 10))}
                style={{ '--pct': `${v}%` }}
                aria-label={`${axis.label}: ${axis.left} a ${axis.right}`}
              />
              <div style={{
                display:'flex', justifyContent:'space-between',
                marginTop:4, fontSize:9.5, color:'var(--text-muted)',
                fontFamily:'var(--font-mono)', letterSpacing:'0.06em', textTransform:'uppercase',
              }}>
                <span style={{ color: v <= 25 ? 'var(--text-secondary)' : undefined }}>{axis.left}</span>
                <span style={{ color: v >= 75 ? 'var(--text-secondary)' : undefined }}>{axis.right}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop:6, fontSize:10, color:'var(--text-muted)',
        fontFamily:'var(--font-ui)', lineHeight:1.5,
      }}>
        Valores no centro (AUTO) deixam a IA livre. Puxe para um lado quando quiser direção forte.
      </div>
    </div>
  );
}

// ─── MOBILE DRAWER ────────────────────────────────────────────────────────────
// Bottom-sheet com 3 snaps de altura (small/medium/large) — user arrasta
// pra cima pra expandir ou pra baixo pra encolher/fechar. Cada drag termina
// no snap mais próximo (não fica em altura arbitrária — UX consistente).
const DRAWER_SNAPS = [
  { id: 'small',  dvh: 35, label: 'Pequeno' },
  { id: 'medium', dvh: 55, label: 'Médio' },   // default
  { id: 'large',  dvh: 85, label: 'Grande' },
];
const DRAWER_DEFAULT_SNAP = 1; // 55dvh

function MobileDrawer({ open, onClose, children }) {
  const panelRef  = useRef(null);
  const startRef  = useRef({ y:0, t:0, snap: DRAWER_DEFAULT_SNAP });
  const dragging  = useRef(false);
  // Snap atual — reset pra default ao reabrir o drawer.
  const [snapIdx, setSnapIdx] = useState(DRAWER_DEFAULT_SNAP);
  useEffect(() => { if (open) setSnapIdx(DRAWER_DEFAULT_SNAP); }, [open]);

  const currentDvh = DRAWER_SNAPS[snapIdx].dvh;

  // Aplica offset de drag direto no DOM (sem re-render por frame)
  const applyDrag = useCallback((dy) => {
    if (!panelRef.current) return;
    // Durante drag ativo: sem transição. Ao soltar/abrir: transição smooth.
    panelRef.current.style.transition = dragging.current ? 'none' : 'transform 0.28s var(--ease-smooth), height 0.28s var(--ease-smooth)';
    panelRef.current.style.transform  = open ? `translateY(${dy}px)` : 'translateY(110%)';
  }, [open]);

  // Bloqueia scroll do body quando aberto, evita "double-scroll" no iOS
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    applyDrag(0);
    return () => { document.body.style.overflow = prev; };
  }, [open, applyDrag]);

  const onTouchStart = (e) => {
    // Só reage a arrasto iniciado no handle (não no scroll do conteúdo)
    if (!e.target.closest('[data-drawer-handle]')) return;
    dragging.current = true;
    startRef.current = { y: e.touches[0].clientY, t: Date.now(), snap: snapIdx };
    applyDrag(0);
  };
  const onTouchMove = (e) => {
    if (!dragging.current) return;
    const dy = e.touches[0].clientY - startRef.current.y;
    // Permite drag em AMBAS as direções: dy>0 encolhe (move pra baixo),
    // dy<0 expande visualmente o painel pra cima (clamping em -20px pra
    // sinalizar limite sem permitir voo).
    const clamped = Math.max(-20, dy);
    applyDrag(clamped);
  };
  const onTouchEnd = (e) => {
    if (!dragging.current) return;
    const dy = e.changedTouches[0].clientY - startRef.current.y;
    const dt = Math.max(1, Date.now() - startRef.current.t);
    const velocity = dy / dt; // px/ms (positivo = pra baixo)
    dragging.current = false;
    applyDrag(0);

    // Threshold: 60px ou velocidade alta. Drag pra baixo = próximo snap menor
    // (ou fecha se já no menor). Drag pra cima = próximo snap maior.
    const threshold = 60;
    const fastDown = dy > threshold || velocity > 0.4;
    const fastUp = dy < -threshold || velocity < -0.4;
    const startSnap = startRef.current.snap;

    if (fastDown) {
      const next = startSnap - 1;
      if (next < 0) onClose();
      else setSnapIdx(next);
    } else if (fastUp) {
      const next = Math.min(DRAWER_SNAPS.length - 1, startSnap + 1);
      setSnapIdx(next);
    }
    // Drag pequeno = volta pro snap original (applyDrag(0) já cuida).
  };

  return (
    <>
      {/* Backdrop dim leve sem blur — cards visíveis acima */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.18)',
            zIndex:30, animation:'fadeIn 0.18s',
          }}
        />
      )}
      {/* Painel resizable — altura controlada por snapIdx, drag escolhe entre
          os 3 snaps (pequeno/médio/grande) ou fecha no limite inferior. */}
      <div
        ref={panelRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position:'fixed', bottom:0, left:0, right:0, zIndex:40,
          background:'var(--bg-sidebar)',
          borderTop:'1px solid var(--border)',
          borderRadius:'18px 18px 0 0',
          display:'flex', flexDirection:'column',
          height:`${currentDvh}dvh`, maxHeight:`${currentDvh}dvh`,
          boxShadow:'0 -8px 40px rgba(0,0,0,0.35)',
          transform: open ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 0.28s var(--ease-smooth), height 0.28s var(--ease-smooth)',
          paddingBottom:'env(safe-area-inset-bottom, 0)',
        }}
      >
        {/* Handle tactível com 3 dots indicando snap atual. Drag pra cima
            expande, pra baixo encolhe ou fecha. */}
        <div
          data-drawer-handle
          style={{
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            padding:'10px 16px 6px', flexShrink:0,
            cursor:'grab', userSelect:'none', touchAction:'none',
            position:'relative', gap:4,
          }}
          title={`Tamanho ${DRAWER_SNAPS[snapIdx].label} · arraste pra cima/baixo`}
        >
          {/* Pill principal — visualmente óbvia */}
          <div style={{
            width:56, height:5, background:'var(--text-muted)', borderRadius:99,
            opacity:0.55,
          }}/>
          {/* 3 dots indicando snap atual (pequeno/médio/grande) */}
          <div style={{ display:'flex', gap:4, marginTop:2 }} aria-hidden>
            {DRAWER_SNAPS.map((s, i) => (
              <div key={s.id} style={{
                width: i === snapIdx ? 14 : 4, height:4, borderRadius:99,
                background: i === snapIdx ? 'var(--accent)' : 'var(--border)',
                transition:'width 0.2s var(--ease-smooth), background 0.2s',
              }}/>
            ))}
          </div>
          <button
            onClick={onClose}
            style={{
              position:'absolute', right:10, top:8,
              background:'none', border:'none', color:'var(--text-muted)',
              cursor:'pointer', padding:8, borderRadius:6,
              minWidth:36, minHeight:36,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}
            aria-label="Fechar editor"
          ><X size={16}/></button>
        </div>
        {children}
      </div>
    </>
  );
}

// ─── SAVED INDICATOR — mostra "Salvo há Xs" perto do nome do projeto ─────────
// Reduz ansiedade do user ("vou perder?") sem ser intrusivo. Atualiza
// progressivamente: agora → "agora mesmo", < 60s → "Xs", < 1h → "Xmin",
// > 1h → "Xh". Re-renderiza a cada 30s pra refrescar o texto.
function SavedIndicator({ savedAt }) {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    if (!savedAt) return;
    const id = setInterval(force, 30000);
    return () => clearInterval(id);
  }, [savedAt]);
  if (!savedAt) return null;
  const diff = Date.now() - savedAt;
  let label;
  if (diff < 5000) label = 'agora mesmo';
  else if (diff < 60000) label = `há ${Math.round(diff / 1000)}s`;
  else if (diff < 3600000) label = `há ${Math.round(diff / 60000)}min`;
  else label = `há ${Math.round(diff / 3600000)}h`;
  return (
    <span
      title="Auto-save: alterações são gravadas automaticamente. Clique no botão 'Meus projetos' pra gerenciar versões."
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
        letterSpacing: '-0.005em', opacity: 0.7,
        cursor: 'help',
      }}
    >
      <span style={{ color: 'var(--success-text)', fontSize: 9 }}>✓</span>
      Salvo {label}
    </span>
  );
}

// ─── TOAST STACK ──────────────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  // Container "polite" não rouba o foco. Item de error usa role="alert" pra anúncio
  // imediato em screen readers (warning também pra não passar despercebido).
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map(t => {
        const isUrgent = t.kind === 'error' || t.kind === 'warning';
        return (
          <div
            key={t.id}
            className={`toast-item toast-${t.kind}`}
            role={isUrgent ? 'alert' : 'status'}
            aria-live={isUrgent ? 'assertive' : 'polite'}
          >
            <span style={{ flex:1 }}>{t.message}</span>
            <button onClick={()=>onDismiss(t.id)} aria-label="Fechar notificação">
              <X size={12}/>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── PROMPT DIALOG (substitui window.prompt) ──────────────────────────────────

// ─── IMAGE CROP MODAL ─────────────────────────────────────────────────────────
/** Recorta a imagem de fundo no canvas; proporção 4:5 opcional (feed Instagram). */

// ─── REFINE BUTTON ────────────────────────────────────────────────────────────

/**
 * RefineBtn — CTA pra refinar texto via IA. Quando colapsado, oferece o
 * gatilho; quando aberto, expõe presets + input livre.
 *
 * `variant` controla apenas a aparência do estado colapsado:
 *   - 'compact'    (default): ghost height 36, pro uso dentro dos cards
 *                  onde já tem "Marcar Destaque" + "Gerar variações" juntos.
 *   - 'prominent': drop-zone com círculo accent + label + subtítulo, pro
 *                  uso na sidebar Refinar onde é o CTA principal da seção.
 */
function RefineBtn({ onRefine, busy, variant = 'compact', label = 'Refinar com IA', subtitle = 'IA reescreve mantendo a voz do carrossel' }) {
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState('');
  const presets = ['Mais direto','Mais curto','Adicione número','Tom técnico','Tom casual','Mais polêmico','Storytelling'];

  if (!open) {
    if (variant === 'prominent') {
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          style={{
            width:'100%', minHeight:60, padding:'10px 14px', borderRadius:11,
            cursor:'pointer', border:'1px solid var(--hairline)',
            background:'var(--bg-card)', fontFamily:'var(--font-ui)',
            display:'flex', alignItems:'center', gap:12, textAlign:'left',
            transition:'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth)',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.background='var(--accent-surface)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='var(--hairline)'; e.currentTarget.style.background='var(--bg-card)'; }}
        >
          <span style={{
            width:32, height:32, borderRadius:'50%', flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            background:'var(--accent-surface)', color:'var(--accent)',
          }} aria-hidden>
            <Wand2 size={14} strokeWidth={2.25}/>
          </span>
          <span style={{ display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0 }}>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', lineHeight:1.3 }}>
              {label}
            </span>
            <span style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:'-0.005em', lineHeight:1.35 }}>
              {subtitle}
            </span>
          </span>
        </button>
      );
    }
    return (
      <button onClick={()=>setOpen(true)} className="vc-btn vc-btn-ghost" style={{ width:'100%', height:36 }}>
        <Wand2 size={12}/>
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div style={{
      background:'var(--bg-pearl)', border:'1px solid var(--accent)',
      borderRadius:11, padding:12, display:'flex', flexDirection:'column', gap:8,
      animation:'fadeUp 0.15s var(--ease-smooth)',
    }}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
        {presets.map(p=>(
          <button key={p} onClick={()=>{onRefine(p);setOpen(false);}} disabled={busy}
            style={{
              fontSize:10, padding:'4px 10px', borderRadius:99,
              background:'var(--bg-elevated)', border:'1px solid var(--border)',
              color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-ui)',
              transition:'all 0.12s',
            }}
            onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
            onMouseLeave={e=>{e.currentTarget.style.color='var(--text-secondary)';e.currentTarget.style.borderColor='var(--border)';}}
          >{p}</button>
        ))}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <input
          value={txt} onChange={e=>setTxt(e.target.value)}
          placeholder="Instrução personalizada…"
          className="vc-input" style={{ flex:1, fontSize:12 }}
          onKeyDown={e=>{if(e.key==='Enter'&&txt.trim()){onRefine(txt);setTxt('');setOpen(false);}}}
        />
        <button
          onClick={()=>{if(txt.trim()){onRefine(txt);setTxt('');setOpen(false);}}}
          disabled={busy||!txt.trim()}
          className="vc-btn vc-btn-primary"
          style={{ padding:'0 12px', height:36, opacity: (busy||!txt.trim()) ? 0.4 : 1 }}
        >
          {busy ? <Loader2 size={11} style={{animation:'spin 0.8s linear infinite'}}/> : <Wand2 size={11}/>}
        </button>
        <button onClick={()=>{setOpen(false);setTxt('');}} className="vc-btn vc-btn-ghost" style={{ height:36, padding:'0 10px' }}>
          <X size={12}/>
        </button>
      </div>
    </div>
  );
}

// ─── KEYS MODAL ───────────────────────────────────────────────────────────────

// ─── GENERATE MODAL ───────────────────────────────────────────────────────────

function GenerateModal({
  open, onClose, onGenerate,
  defaultNiche='', defaultTopic='', defaultTone='', defaultAudience='',
  hasOpenAI=false, hasAnthropic=false, onOpenKeys,
  imageProviderLabel = 'GPT Image 2',
  brandSummary, materialSummary,
  onGoToMaterial,
  imgParams = { fidelity:50, creativity:50, irreverence:50, objectivity:50 },
  onImgParamsChange,
  mode: defaultMode = 'editorial',
  onModeChange,
  creativePreset: defaultCreativePreset = 'livre',
  onCreativePresetChange,
  slideTextDensity: defaultSlideTextDensity = '1_1',
  onSlideTextDensityChange,
  cardVisualStyle: defaultCardVisualStyle = 'full',
  onCardVisualStyleChange,
  visualPreset: defaultVisualPreset = null,
  onVisualPresetChange,
  material = { content: '', sources: '', context: '', refProfileId: null },
  setMaterial = () => {},
  hookLibrary = [],
}) {
  const [topic, setTopic] = useState(defaultTopic);
  const [count, setCount] = useState(6);
  const [niche, setNiche] = useState(defaultNiche);
  const [audience, setAudience] = useState(defaultAudience || '');
  const [mode, setMode] = useState(defaultMode);
  const [packCreative, setPackCreative] = useState(defaultCreativePreset || 'livre');
  const [textDensity, setTextDensity] = useState(defaultSlideTextDensity || '1_1');
  useEffect(() => { if (open) setMode(defaultMode); }, [open, defaultMode]);
  useEffect(() => { if (open) setPackCreative(defaultCreativePreset || 'livre'); }, [open, defaultCreativePreset]);
  useEffect(() => { if (open) setTextDensity(defaultSlideTextDensity || '1_1'); }, [open, defaultSlideTextDensity]);
  const [cardStyle, setCardStyle] = useState(() => normalizeCardVisualStyle(defaultCardVisualStyle));
  useEffect(() => {
    if (open) setCardStyle(normalizeCardVisualStyle(defaultCardVisualStyle));
  }, [open, defaultCardVisualStyle]);
  // Padrão visual selecionado (paleta + fontes + tipografia). Null = mantém
  // marca atual sem mudanças. Aplicado ao brand no momento de gerar.
  const [visualPreset, setVisualPresetLocal] = useState(defaultVisualPreset);
  useEffect(() => { if (open) setVisualPresetLocal(defaultVisualPreset); }, [open, defaultVisualPreset]);
  // Cópia local mutável dos eixos da imagem (commit no doc só ao gerar)
  const [params, setParams] = useState(imgParams);
  useEffect(() => { if (open) setParams(imgParams); }, [open, imgParams]);
  const setAxis = (key, val) => setParams(p => ({ ...p, [key]: val }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Wizard multi-step: 1=Ideia, 2=Formato, 3=Imagens, 4=Revisão.
  // Reset pra step 1 sempre que reabre — usuário pega o fluxo limpo.
  const [step, setStep] = useState(1);
  useEffect(() => { if (open) setStep(1); }, [open]);
  const STEPS = useMemo(() => ([
    { id: 1, label: 'Ideia' },
    { id: 2, label: 'Formato' },
    { id: 3, label: 'Imagens' },
    { id: 4, label: 'Revisão' },
  ]), []);
  // Labels amigáveis para densidade (IDs internos preservados pra compatibilidade
  // com docs salvos). "1/1, 1/2..." era abstrato — "Denso/Balanceado/Minimal"
  // comunica intenção direta.
  const DENSITY_FRIENDLY = useMemo(() => ({
    '1_1': 'Denso',
    '1_2': 'Balanceado',
    '1_3': 'Médio',
    '1_4': 'Minimal',
    '1_5': 'Mínimo',
  }), []);

  useEffect(()=>{ if(open){ setErr(''); if(defaultTopic) setTopic(defaultTopic); } },[open,defaultTopic]);
  useEffect(()=>{ if(defaultNiche) setNiche(defaultNiche); },[defaultNiche]);
  useEffect(()=>{ if(defaultAudience) setAudience(defaultAudience); },[defaultAudience]);

  const hasMaterialPack =
    Array.isArray(materialSummary) && materialSummary.length > 0;
  const hasContextPack =
    (Array.isArray(brandSummary) && brandSummary.length > 0) ||
    hasMaterialPack;
  /** Personalizado (`livre`) expõe modo narrativo, nicho e público (tom base vem da Marca). Demais pacotes trazem estrutura fixa. */
  const modoPersonalizado = packCreative === 'livre';
  const narrativeLockedForPack =
    !modoPersonalizado && isQuickTemplatePreset(packCreative)
      ? (QUICK_TEMPLATE_NARRATIVE_MODE[quickTemplateIdFromPreset(packCreative)] || 'editorial')
      : null;
  /** Tema digitado OU nicho OU Marca/Material preenchidos — evita botão morto só com contexto injetado. */
  const resolvedGenerationTopic = (() => {
    const t = topic.trim();
    if (t) return t;
    if (modoPersonalizado && niche.trim()) return `Conteúdo focado no nicho: ${niche.trim()}`;
    if (hasContextPack) return 'Conteúdo baseado no material de referência e na identidade da marca.';
    return '';
  })();

  // Step 1 exige tema válido (resolvedGenerationTopic já cobre fallbacks
  // de nicho/contexto). Demais steps liberados — usuário pode revisar valores
  // default e seguir adiante.
  const canProceed = step === 1 ? !!resolvedGenerationTopic : true;

  if (!open) return null;

  const run = async ({ withImages } = { withImages: true }) => {
    if (!resolvedGenerationTopic) {
      setErr(
        modoPersonalizado
          ? 'Informe o tema em “Sobre o que é o conteúdo?”, ou o nicho, ou preencha Marca e Conteúdo.'
          : 'Informe o tema em “Sobre o que é o conteúdo?” ou preencha Marca e Conteúdo.',
      );
      return;
    }
    setBusy(true); setErr('');
    try {
      const toneFromBrand = (defaultTone || '').trim() || 'direto e provocativo';
      const narrativeForGenerate = modoPersonalizado
        ? mode
        : (narrativeLockedForPack ?? 'editorial');
      onImgParamsChange?.(params);
      onModeChange?.(narrativeForGenerate);
      onCreativePresetChange?.(packCreative);
      onSlideTextDensityChange?.(textDensity);
      onCardVisualStyleChange?.(cardStyle);
      // Aplica padrão visual ao brand ANTES da geração — IA usa as cores
      // novas pra recomendar paleta consistente nos slides.
      if (visualPreset && onVisualPresetChange) onVisualPresetChange(visualPreset);
      await onGenerate({
        topic: resolvedGenerationTopic,
        count,
        niche: modoPersonalizado ? niche : '',
        tone: toneFromBrand,
        audience: modoPersonalizado ? audience : '',
        imgMode: 'dalle',
        imgParams: params,
        mode: narrativeForGenerate,
        creativePreset: packCreative,
        slideTextDensity: textDensity,
        cardVisualStyle: cardStyle,
        fetchImagesNow: !!withImages,
      });
      onClose();
    } catch(e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel vc-modal-scroll" onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          flexShrink: 0, background:'var(--bg-sidebar)', zIndex: 2,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:32, height:32, borderRadius:8, background:'var(--accent)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Sparkles size={14} color="#fff"/>
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>Configurar carrossel</div>
              <div className="vc-eyebrow">Passo {step} de {STEPS.length} · {STEPS[step-1].label}</div>
            </div>
          </div>
          <button onClick={onClose} className="vc-icon-btn" aria-label="Fechar">
            <X size={16}/>
          </button>
        </div>

        {/* Stepper — clicável apenas pra steps já alcançados; avanço é controlado
            pelo Continuar (que valida campos obrigatórios). */}
        <div role="tablist" aria-label="Etapas do wizard" style={{
          display:'flex', gap:4, padding:'10px 14px',
          borderBottom:'1px solid var(--border)',
          background:'var(--bg-sidebar)', flexShrink:0, zIndex:1,
          overflowX:'auto',
        }}>
          {STEPS.map((s) => {
            const isActive = s.id === step;
            const isCompleted = s.id < step;
            const isClickable = s.id <= step;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`gen-step-${s.id}`}
                disabled={!isClickable || busy}
                onClick={() => isClickable && setStep(s.id)}
                style={{
                  flex:'1 1 0', minWidth:90, minHeight:44,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  padding:'8px 10px', borderRadius:11,
                  border:`1px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                  background: isActive ? 'var(--accent-surface)' : 'transparent',
                  cursor: isClickable ? 'pointer' : 'not-allowed',
                  fontFamily:'var(--font-ui)',
                  transition:'background-color 0.15s var(--ease-smooth), border-color 0.15s',
                  opacity: !isClickable ? 0.45 : 1,
                }}
              >
                <span style={{
                  width:22, height:22, borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background: (isActive || isCompleted) ? 'var(--accent)' : 'var(--bg-pearl)',
                  color: (isActive || isCompleted) ? '#fff' : 'var(--text-muted)',
                  fontSize:11, fontWeight:700, flexShrink:0,
                  border: `1px solid ${(isActive || isCompleted) ? 'var(--accent)' : 'var(--hairline)'}`,
                  fontVariantNumeric:'tabular-nums',
                }}>
                  {isCompleted ? <Check size={12} strokeWidth={3}/> : s.id}
                </span>
                <span style={{
                  fontSize:12,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  letterSpacing:'-0.011em', whiteSpace:'nowrap',
                }}>{s.label}</span>
              </button>
            );
          })}
        </div>

        <div
          className="vc-modal-scroll-body"
          id={`gen-step-${step}`}
          role="tabpanel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            padding: '16px 20px',
            paddingBottom: 24,
          }}
        >
          {/* ═══════════ STEP 1 — IDEIA ═══════════
              Pacote criativo, tema, hooks salvos. Personalizado expõe modo
              narrativo, nicho, público. Outros pacotes mostram aviso explicando
              estrutura fixa. */}
          {step === 1 && (
            <>
              {onGoToMaterial && (
                <div
                  role="region"
                  aria-label="Conteúdo para geração"
                  style={{
                    borderRadius:11,
                    border:'1px solid var(--hairline)',
                    background:'var(--bg-pearl)',
                    padding:'12px 14px',
                    display:'flex',
                    flexDirection:'column',
                    gap:10,
                  }}
                >
                  <div style={{ fontSize:13, lineHeight:1.47, color:'var(--text-primary)', letterSpacing:'-0.011em' }}>
                    {hasMaterialPack ? (
                      <>
                        <span style={{ fontWeight:600 }}>Conteúdo</span>
                        {' '}já tem base — você pode ajustar matéria-prima, fontes e instruções na aba Conteúdo quando quiser.
                      </>
                    ) : (
                      <>
                        Vai gerar só pelo tema abaixo? Para basear o carrossel em{' '}
                        <span style={{ fontWeight:600 }}>texto, links ou notas</span>, preencha primeiro a aba{' '}
                        <span style={{ fontWeight:600 }}>Conteúdo</span> — assim a IA não inventa em cima de um ponto genérico.
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { onGoToMaterial(); onClose(); }}
                    style={{
                      alignSelf:'flex-start', minHeight:44, padding:'0 20px',
                      borderRadius:9999, border:'none', background:'var(--accent)',
                      color:'#fff', fontSize:13, fontWeight:600,
                      fontFamily:'var(--font-ui)', letterSpacing:'-0.011em',
                      cursor:'pointer', transition:'transform 0.1s var(--ease-smooth)',
                    }}
                    onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                    onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    Ir para a aba Conteúdo
                  </button>
                </div>
              )}

              {/* Pacote criativo — primeiro: define se há camada editorial fixa ou fluxo personalizado */}
              <div>
                <label className="vc-label">Pacote criativo da IA</label>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {CREATIVE_PRESETS.map((p) => {
                    const on = packCreative === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPackCreative(p.id)}
                        style={{
                          textAlign:'left', padding:'12px 14px', borderRadius:11,
                          border:`1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                          background: on ? 'var(--accent-surface)' : 'var(--bg-card)',
                          cursor:'pointer', transition:'border-color 0.12s',
                        }}
                      >
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em' }}>{p.label}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4, lineHeight:1.4 }}>{p.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Topic */}
              <div>
                <label className="vc-label">Sobre o que é o conteúdo?</label>
                <textarea
                  value={topic} onChange={e=>setTopic(e.target.value)} rows={3}
                  placeholder="Ex: como freelancers usam IA para triplicar a produtividade sem estresse"
                  className="vc-input vc-textarea"
                />
                {/* B2: Hooks salvos pra este nicho — clicar preenche o tema */}
                {(() => {
                  const suggestions = getHooksForNiche(hookLibrary, niche, 3);
                  if (suggestions.length === 0) return null;
                  return (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Bookmark size={10} aria-hidden/>
                        Hooks salvos {niche ? `(nicho «${niche}»)` : ''}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {suggestions.map(h => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => setTopic(h.hook)}
                            title={`Usado ${h.usageCount}× · salvo ${new Date(h.savedAt).toLocaleDateString('pt-BR')}`}
                            style={{
                              textAlign: 'left', padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                              background: 'var(--bg-card)', border: '1px solid var(--border)',
                              color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-ui)',
                              letterSpacing: '-0.011em', lineHeight: 1.4,
                              transition: 'border-color 0.12s, color 0.12s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                          >
                            {h.hook}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {hasContextPack && (
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6, lineHeight:1.47, letterSpacing:'-0.011em' }}>
                    {modoPersonalizado ? (
                      <>Opcional se já houver Marca e Conteúdo: você pode gerar só com esse contexto, ou preencher o nicho abaixo no lugar do tema.</>
                    ) : (
                      <>
                        {isQuickTemplatePreset(packCreative) ? (
                          <>O pacote <span style={{ fontWeight:600 }}>{CREATIVE_PRESET_BY_ID[packCreative]?.label}</span> segue o arco dos Templates prontos — use este campo ou Marca/Conteúdo como fonte do tema.</>
                        ) : (
                          <>O pacote <span style={{ fontWeight:600 }}>Tendência/Cultura</span> já traz estrutura e voz típicas — use este campo ou o material de Marca/Conteúdo como fonte para o tema em jogo.</>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Modo narrativo, público-alvo, nicho — só fazem parte do fluxo Personalizado */}
              {modoPersonalizado && (
                <>
                  <ModePicker value={mode} onChange={setMode}/>
                  <ReferenceProfilesCuradoria material={material} setMaterial={setMaterial} />
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <label className="vc-label">Nicho</label>
                      <input value={niche} onChange={e=>setNiche(e.target.value)} placeholder="Ex: marketing digital" className="vc-input"/>
                    </div>
                    <div>
                      <label className="vc-label">Para quem?</label>
                      <input value={audience} onChange={e=>setAudience(e.target.value)} placeholder="Ex: empreendedores" className="vc-input"/>
                    </div>
                  </div>
                </>
              )}

              {!modoPersonalizado && (
                <div
                  aria-live="polite"
                  style={{
                    fontSize:11, color:'var(--text-muted)', lineHeight:1.47, letterSpacing:'-0.011em',
                    padding:'10px 12px', background:'var(--bg-pearl)',
                    borderRadius:11, border:'1px solid var(--hairline)',
                  }}
                >
                  <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>
                    {isQuickTemplatePreset(packCreative)
                      ? `Pacote ${CREATIVE_PRESET_BY_ID[packCreative]?.label}:`
                      : 'Pacote Tendência/Cultura:'}
                  </span>{' '}
                  {isQuickTemplatePreset(packCreative)
                    ? 'estrutura de arco fixa (Templates prontos). Modo narrativo, nicho e público não são escolhidos — ajuste o tema acima, tom na Marca e a densidade nos próximos passos.'
                    : 'estrutura de arco e regras de texto vêm definidas pelo pacote. Modo narrativo, nicho e público-alvo do fluxo Personalizado não são usados aqui — ajuste o tema acima e a densidade de texto no próximo passo.'}
                </div>
              )}
            </>
          )}

          {/* ═══════════ STEP 2 — FORMATO ═══════════
              Padrão visual (paleta/fontes/tipografia), número de cards,
              densidade de texto, estilo da foto. Tudo que afeta o look. */}
          {step === 2 && (
            <>
              {/* Padrão visual — 12 presets curados extraídos de referências
                  reais (NBA editorial, case study neon, luxury, viral hype...).
                  Override APENAS de cores/fontes/tipografia — não mexe em
                  creativePreset nem layout dos slides. */}
              <VisualStylePicker
                value={visualPreset}
                onChange={setVisualPresetLocal}
                presets={VISUAL_PRESETS}
              />

              {/* Slide count — decisão imediata pro usuário */}
              <div>
                <label className="vc-label">Número de cards</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {[3,4,5,6,7,8,9,10].map(n=>(
                    <button key={n} onClick={()=>setCount(n)} style={{
                      width:44, height:44, borderRadius:11, fontSize:15, fontWeight:600,
                      cursor:'pointer', fontFamily:'var(--font-ui)', letterSpacing:'-0.014em',
                      fontVariantNumeric:'tabular-nums',
                      transition:'background-color 0.15s var(--ease-smooth), color 0.15s var(--ease-smooth)',
                      background: count===n ? 'var(--accent)' : 'var(--bg-pearl)',
                      border: `1px solid ${count===n ? 'var(--accent)' : 'var(--hairline)'}`,
                      color: count===n ? '#fff' : 'var(--text-primary)',
                    }}>{n}</button>
                  ))}
                </div>
              </div>

              {/* Densidade de texto — labels amigáveis (DENSITY_FRIENDLY). ID interno
                  preservado pra compat com docs salvos. */}
              <div>
                <label className="vc-label" id="slide-text-density-label">Texto por card</label>
                <div
                  role="group"
                  aria-labelledby="slide-text-density-label"
                  style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}
                >
                  {SLIDE_TEXT_DENSITY_OPTIONS.map((opt) => {
                    const on = textDensity === opt.id;
                    const friendly = DENSITY_FRIENDLY[opt.id] || opt.label;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setTextDensity(opt.id)}
                        style={{
                          minWidth: 86, height: 44, padding: '0 14px',
                          borderRadius: 11, fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'var(--font-ui)',
                          letterSpacing: '-0.011em',
                          transition: 'background-color 0.15s var(--ease-smooth), color 0.15s var(--ease-smooth)',
                          background: on ? 'var(--accent)' : 'var(--bg-pearl)',
                          border: `1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                          color: on ? '#fff' : 'var(--text-primary)',
                        }}
                      >
                        {friendly}
                      </button>
                    );
                  })}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.47,
                  letterSpacing: '-0.011em', marginTop: 4,
                }}>
                  {SLIDE_TEXT_DENSITY_OPTIONS.find(o => o.id === textDensity)?.desc}
                  {' '}
                  Valores menores geram menos caracteres nos subtítulos ao usar IA (geração e refinamento).
                </div>
              </div>

              {/* Estilo visual da foto vs texto (layout clássico) */}
              <div>
                <label className="vc-label" id="card-visual-style-label">Estilo dos cards</label>
                <div
                  role="group"
                  aria-labelledby="card-visual-style-label"
                  style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}
                >
                  {CARD_VISUAL_STYLE_OPTIONS.map((opt) => {
                    const on = cardStyle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={on}
                        title={`${opt.short}: ${opt.desc}`}
                        onClick={() => setCardStyle(opt.id)}
                        style={{
                          minWidth: 72, minHeight: 76, padding: '8px 6px',
                          borderRadius: 11, cursor: 'pointer',
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', gap: 4,
                          transition: 'background-color 0.15s var(--ease-smooth), color 0.15s var(--ease-smooth)',
                          background: on ? 'var(--accent)' : 'var(--bg-pearl)',
                          border: `1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                          color: on ? '#fff' : 'var(--text-primary)',
                        }}
                      >
                        <PhotoRegionMiniIcon regionId={opt.id} active={on} />
                        <span style={{
                          fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-mono)',
                          letterSpacing: '0.06em', textTransform: 'uppercase',
                          textAlign: 'center', lineHeight: 1.15, maxWidth: 68,
                        }}>{opt.short}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.47,
                  letterSpacing: '-0.011em', marginTop: 4,
                }}>
                  {CARD_VISUAL_STYLE_OPTIONS.find((o) => o.id === cardStyle)?.desc}{' '}
                  Aplica-se ao layout clássico (sem canvas no card). Pacotes Cultura podem alterar alguns slides (sanduíche / tela cheia).
                </div>
              </div>
            </>
          )}

          {/* ═══════════ STEP 3 — IMAGENS ═══════════ */}
          {step === 3 && (
            <>
              <div>
                <label className="vc-label">Imagens dos Cards</label>
                {hasOpenAI ? (
                  <div style={{
                    padding:'10px 12px', borderRadius:8, border:'1.5px solid var(--accent)',
                    background:'var(--accent-surface-strong)', position:'relative',
                  }}>
                    <span style={{
                      position:'absolute', top:-9, right:8, fontSize:11, fontWeight:600,
                      background:'var(--accent)', color:'#fff', padding:'2px 9px', borderRadius:9999,
                      letterSpacing:'-0.011em',
                    }}>Ativo</span>
                    <div style={{ fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)', color:'var(--text-primary)', marginBottom:3, letterSpacing:'-0.011em' }}>
                      {imageProviderLabel}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>
                      Geração a partir do tema e das palavras-chave de cada slide
                    </div>
                  </div>
                ) : (
                  <div style={{
                    fontSize:13, color:'var(--text-secondary)', background:'var(--bg-pearl)',
                    border:'1px solid var(--hairline)', borderRadius:11, padding:'10px 12px',
                    fontFamily:'var(--font-ui)', lineHeight:1.47, letterSpacing:'-0.011em',
                  }}>
                    Sem provedor de imagem, o carrossel sai com texto e palavras-chave. Depois use Upload/URL em cada card, ou configure OpenAI/Z.ai em ⚙.
                  </div>
                )}
                {!hasOpenAI && (
                  <div style={{
                    marginTop:8, fontSize:13, color:'var(--text-secondary)', background:'var(--accent-surface)',
                    border:'1px solid rgba(0,0,0,0.14)', borderRadius:8, padding:'10px 12px',
                    fontFamily:'var(--font-ui)', letterSpacing:'-0.011em', lineHeight:1.47,
                    display:'flex', flexDirection:'column', gap:8,
                  }}>
                    <div>
                      Em ⚙ → Configuração escolha <b>OpenAI</b> (GPT Image) ou <b>Z.ai</b> (CogView/GLM-Image) e cole a chave.
                    </div>
                    {onOpenKeys && (
                      <button
                        type="button"
                        onClick={() => { onClose(); setTimeout(onOpenKeys, 80); }}
                        style={{
                          alignSelf:'flex-start',
                          background:'var(--accent)', color:'#fff', border:'none',
                          borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:600,
                          cursor:'pointer', fontFamily:'var(--font-ui)',
                          display:'flex', alignItems:'center', gap:6,
                        }}
                      >
                        <Settings size={12}/> Configurar chave OpenAI
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Eixos só alteram prompts do GPT Image (geração). */}
              {hasOpenAI && (
                <ImgParamsPanel value={params} onChange={setAxis} />
              )}
            </>
          )}

          {/* ═══════════ STEP 4 — REVISÃO ═══════════
              Recap das escolhas + contexto aplicado + erros. Botões de gerar
              vivem no footer fixo, mas mostramos aqui o hint do que cada um faz. */}
          {step === 4 && (
            <>
              {/* Recap das escolhas — comunicação clara antes do clique final */}
              <div style={{
                padding:'14px 16px', borderRadius:11,
                border:'1px solid var(--hairline)', background:'var(--bg-pearl)',
                display:'flex', flexDirection:'column', gap:10,
              }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', fontFamily:'var(--font-ui)', letterSpacing:'0.04em', textTransform:'uppercase' }}>
                  Pronto pra gerar
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'minmax(0,auto) 1fr', columnGap:14, rowGap:8, fontSize:13, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em', alignItems:'center' }}>
                  <span style={{ color:'var(--text-muted)' }}>Tema</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500 }}>
                    {resolvedGenerationTopic.length > 100
                      ? `${resolvedGenerationTopic.slice(0, 100)}…`
                      : resolvedGenerationTopic}
                  </span>

                  <span style={{ color:'var(--text-muted)' }}>Pacote</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{CREATIVE_PRESET_BY_ID[packCreative]?.label}</span>

                  {modoPersonalizado && (
                    <>
                      <span style={{ color:'var(--text-muted)' }}>Modo narrativo</span>
                      <span style={{ color:'var(--text-primary)', fontWeight:500, display:'inline-flex', alignItems:'center', gap:6 }}>
                        {(() => {
                          const ModeIc = GEN_MODE_BY_ID[mode]?.Icon;
                          return ModeIc ? <ModeIc size={13} strokeWidth={2} style={{ color:'var(--text-secondary)', flexShrink:0 }} /> : null;
                        })()}
                        {GEN_MODE_BY_ID[mode]?.label}
                      </span>
                    </>
                  )}

                  <span style={{ color:'var(--text-muted)' }}>Cards</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500, fontVariantNumeric:'tabular-nums' }}>{count}</span>

                  <span style={{ color:'var(--text-muted)' }}>Densidade</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{DENSITY_FRIENDLY[textDensity] || textDensity}</span>

                  <span style={{ color:'var(--text-muted)' }}>Estilo</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{CARD_VISUAL_STYLE_OPTIONS.find(o=>o.id===cardStyle)?.short}</span>

                  <span style={{ color:'var(--text-muted)' }}>Imagens</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500 }}>
                    {hasOpenAI ? imageProviderLabel : 'Só palavras-chave'}
                  </span>
                </div>
              </div>

              {/* Contexto que será injetado no prompt — feedback claro pro user */}
              {((brandSummary && brandSummary.length) || (materialSummary && materialSummary.length)) && (
                <div style={{
                  fontSize:13, color:'var(--text-secondary)', background:'var(--success-surface)',
                  border:'1px solid var(--success-border)', borderRadius:8, padding:'10px 12px', letterSpacing:'-0.011em',
                  fontFamily:'var(--font-ui)', lineHeight:1.5,
                }}>
                  <div style={{ fontWeight:600, color:'var(--success-text)', marginBottom:6, fontSize:12, letterSpacing:'-0.011em' }}>
                    Contexto aplicado nesta geração
                  </div>
                  {brandSummary && brandSummary.length > 0 && (
                    <div>Marca: {brandSummary.join(', ')}</div>
                  )}
                  {materialSummary && materialSummary.length > 0 && (
                    <div>Conteúdo: {materialSummary.join(', ')}</div>
                  )}
                </div>
              )}

              {/* Hint pros 2 botões do footer */}
              <div style={{
                fontSize:11, color:'var(--text-muted)', lineHeight:1.47, letterSpacing:'-0.011em',
                padding:'10px 12px', borderRadius:11, border:'1px solid var(--hairline)', background:'var(--bg-card)',
              }}>
                <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>Texto + imagem:</span> mais lento, usa créditos do provedor de imagem.
                {' '}
                <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>Só texto:</span> rápido — você gera as imagens depois, card a card.
              </div>

              {err && (
                <div style={{
                  fontSize:13, color:'#c5251c', background:'rgba(255,59,48,0.10)', letterSpacing:'-0.011em',
                  border:'1px solid #7f1d1d', borderRadius:8, padding:'10px 14px',
                  fontFamily:'var(--font-ui)',
                }}>{err}</div>
              )}
            </>
          )}
        </div>

        {/* ═══════════ FOOTER FIXO ═══════════
            Voltar/Cancelar à esquerda, Continuar (steps 1-3) ou Gerar (step 4)
            à direita. Continuar valida canProceed; em step 4 mostra 2 botões
            de geração com mesma lógica de disabled da versão antiga. */}
        <div style={{
          display:'flex', gap:8, padding:'14px 20px',
          borderTop:'1px solid var(--border)',
          background:'var(--bg-sidebar)', flexShrink:0,
          paddingBottom:'max(14px, env(safe-area-inset-bottom, 0px))',
          alignItems:'center', flexWrap:'wrap',
        }}>
          <button
            onClick={step === 1 ? onClose : () => setStep(step - 1)}
            disabled={busy}
            className="vc-btn vc-btn-ghost"
            style={{ height:44, padding:'0 16px', display:'inline-flex', alignItems:'center', gap:6 }}
          >
            {step > 1 && <ChevronLeft size={15}/>}
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          <div style={{ flex:1 }}/>
          {step < 4 && (
            <button
              type="button"
              onClick={() => canProceed && setStep(step + 1)}
              disabled={!canProceed || busy}
              title={!canProceed ? 'Informe o tema (ou nicho, ou contexto Marca/Conteúdo) para continuar' : 'Próximo passo'}
              style={{
                height:44, minWidth:160, padding:'0 22px', borderRadius:9999, border:'none',
                cursor: (canProceed && !busy) ? 'pointer' : 'not-allowed',
                background: (canProceed && !busy) ? 'var(--accent)' : 'var(--bg-pearl)',
                color: (canProceed && !busy) ? '#fff' : 'var(--text-muted)',
                fontSize:14, fontWeight:600, fontFamily:'var(--font-ui)', letterSpacing:'-0.014em',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                opacity: (canProceed && !busy) ? 1 : 0.6,
                transition: 'background-color 0.15s var(--ease-smooth)',
              }}
            >
              Continuar <ChevronRight size={15}/>
            </button>
          )}
          {step === 4 && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
              {/* Secundário: só texto + imageQuery. Rápido e barato. */}
              <button
                type="button"
                onClick={() => run({ withImages: false })}
                disabled={busy || !resolvedGenerationTopic}
                title="Gera só texto e palavras-chave da imagem (rápido). Você pode gerar cada imagem depois no botão «Gerar imagem» do card."
                style={{
                  height:44, padding:'0 18px', borderRadius:9999,
                  cursor: (busy || !resolvedGenerationTopic) ? 'not-allowed' : 'pointer',
                  background: 'var(--bg-pearl)', color: 'var(--text-primary)',
                  fontSize:14, fontWeight:600, fontFamily:'var(--font-ui)',
                  letterSpacing:'-0.014em', border:'1px solid var(--border)',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  transition:'border-color 0.15s, background 0.15s',
                  opacity: (busy || !resolvedGenerationTopic) ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!busy && resolvedGenerationTopic) e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <Sparkles size={15} style={{ color: 'var(--text-muted)' }}/>Só texto
              </button>
              {/* Primário: texto + imagens GPT Image. Disabled se sem OpenAI. */}
              <button
                type="button"
                onClick={() => run({ withImages: true })}
                disabled={busy || !resolvedGenerationTopic || !hasOpenAI}
                title={!hasOpenAI ? 'Configure o provedor de imagem em ⚙' : `Gera texto E imagens (${imageProviderLabel})`}
                style={{
                  height:44, padding:'0 18px', borderRadius:9999, border:'none',
                  cursor: (busy || !resolvedGenerationTopic || !hasOpenAI) ? 'not-allowed' : 'pointer',
                  background: (busy || !resolvedGenerationTopic || !hasOpenAI) ? 'var(--bg-pearl)' : 'var(--accent)',
                  color: (busy || !resolvedGenerationTopic || !hasOpenAI) ? 'var(--text-muted)' : '#fff',
                  fontSize:14, fontWeight:600, fontFamily:'var(--font-ui)',
                  letterSpacing:'-0.014em',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  transition:'background-color 0.15s var(--ease-smooth)',
                  opacity: (busy || !resolvedGenerationTopic || !hasOpenAI) ? 0.6 : 1,
                }}
              >
                {busy
                  ? <><Loader2 size={15} style={{animation:'spin 0.8s linear infinite'}}/>Gerando…</>
                  : <><Sparkles size={15}/>Texto + imagem</>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── RESEARCH PANEL ───────────────────────────────────────────────────────────

function ResearchPanel({ open, onClose, onUseIdea, onSetNiche, narrativeMode = 'editorial', creativePreset = 'livre', openaiKey = '' }) {
  const [niche, setNiche] = useState('');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [degraded, setDegraded] = useState(false);

  if (!open) return null;

  const buildResearchUserPrompt = () =>
    `Atue como estrategista sênior de conteúdo, branding e cultura de mercado. Pesquise tendências REAIS e atuais na web.

Nicho: "${niche}"
${buildResearchPromptBias(narrativeMode, creativePreset)}
ENTREGUE SOMENTE este JSON exato (sem texto extra, sem markdown):
{
  "trending_topics": [{"topic":"...","why":"por que isso está movimentando o mercado agora"}],
  "viral_hooks": ["..."],
  "carousel_ideas": [{"title":"...","angle":"..."}],
  "warning": null
}

REGRAS:
- viral_hooks: use estes formatos estratégicos — "X não está fazendo Y, está fazendo Z", "Não é sobre X. É sobre Y.", "Todo mundo viu X. Pouca gente entendeu Y.", "O mercado de X está deixando de ser sobre Y. Agora é sobre Z.", "O erro de X é achar que Y. Na prática, o jogo está em Z.", "Quando todo mundo começa a fazer X, o valor migra para Y.", "O próximo diferencial competitivo em X será Y." — Tom assertivo, sofisticado, sem clichês, sem motivacional.
- carousel_ideas: siga os 7 tipos de post estratégico: decodificação de marca, de comportamento, de categoria, de campanha, de erro comum, de tendência, de mercado futuro. O campo "angle" deve revelar a tese contraintuitiva.
- trending_topics: fatos REAIS com data recente.
- Mínimo: 5 trending_topics, 7 viral_hooks, 5 carousel_ideas. Português BR.`;

  const run = async () => {
    if (!niche.trim()) { setErr('Informe o nicho'); return; }
    setBusy(true); setErr(''); setData(null); setDegraded(false);
    try {
      const r = await callAIwithSearch(buildResearchUserPrompt(), { json: true });
      setData(r);
      onSetNiche?.(niche);
    } catch (e1) {
      if (!getProviderKey(_aiRuntimeSettings.textProvider)) {
        setErr(e1.message || String(e1));
        return;
      }
      try {
        const r = await callAI(
          `${buildResearchUserPrompt()}

CONTEXTO TÉCNICO — SEM WEB AO VIVO:
Você não tem acesso à internet. Não invente datas, manchetes ou “estudo de 2025” verificáveis. Em trending_topics, use ângulos plausíveis do nicho e deixe "why" como leitura estratégica (não como notícia datada). Preencha "warning" com uma frase curta: resultado sem pesquisa web em tempo real.`,
          { json: true, openaiKey },
        );
        setData(r);
        setDegraded(true);
        onSetNiche?.(niche);
      } catch (e2) {
        setErr(e2.message || String(e2));
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel-wide" onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--bg-sidebar)', zIndex:1,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:32, height:32, borderRadius:8,
              background:'linear-gradient(135deg, #f59e0b, #d97706)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <TrendingUp size={14} color="#fff"/>
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>Pesquisa de nicho</div>
              <div className="vc-eyebrow">Pesquisa com IA + web ao vivo</div>
            </div>
          </div>
          <button onClick={onClose} className="vc-icon-btn" aria-label="Fechar">
            <X size={16}/>
          </button>
        </div>

        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
          {/* Search bar */}
          <div style={{ display:'flex', gap:8 }}>
            <input
              value={niche} onChange={e=>setNiche(e.target.value)}
              placeholder="Nicho ou tema (ex: nutrição, vendas B2B, saúde mental…)"
              className="vc-input" style={{ flex:1 }}
              onKeyDown={e=>{if(e.key==='Enter')run();}}
            />
            <button onClick={run} disabled={busy||!niche.trim()} className="vc-btn vc-btn-primary"
              style={{ padding:'0 16px', height:40, opacity:(busy||!niche.trim())?0.5:1 }}
            >
              {busy ? <Loader2 size={14} style={{animation:'spin 0.8s linear infinite'}}/> : <Search size={14}/>}
            </button>
          </div>

          {/* Preset niches */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            {PRESET_NICHES.map(n=>(
              <button key={n} onClick={()=>setNiche(n)} style={{
                fontSize:11, padding:'4px 10px', borderRadius:99, cursor:'pointer',
                fontFamily:'var(--font-ui)', fontWeight:500,
                background:'var(--bg-card)', border:'1px solid var(--border)',
                color:'var(--text-secondary)', transition:'all 0.12s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
              onMouseLeave={e=>{e.currentTarget.style.color='var(--text-secondary)';e.currentTarget.style.borderColor='var(--border)';}}
              >{n}</button>
            ))}
          </div>

          {err && (
            <div style={{ fontSize:13, color:'#c5251c', background:'rgba(255,59,48,0.10)', border:'1px solid rgba(255,59,48,0.22)', borderRadius:11, padding:'10px 14px', letterSpacing:'-0.011em' }}>{err}</div>
          )}

          {degraded && !err && (
            <div style={{
              fontSize:12, color:'var(--text-secondary)', background:'var(--bg-pearl)', border:'1px solid var(--hairline)',
              borderRadius:11, padding:'10px 14px', letterSpacing:'-0.011em', lineHeight:1.45, fontFamily:'var(--font-ui)',
            }}>
              Sem pesquisa web ao vivo nesta sessão — resultado via OpenAI (chave em ⚙). Trate tendências como leitura estratégica, não como notícias datadas.
            </div>
          )}

          {busy && (
            <div style={{ textAlign:'center', padding:'32px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
              <div style={{ position:'relative', width:40, height:40 }}>
                <div style={{ width:40, height:40, borderRadius:'50%', border:'2px solid var(--border)', borderTopColor:'var(--accent-amber)', animation:'spin 1s linear infinite' }}/>
              </div>
              <p style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'var(--font-ui)' }}>Pesquisando tendências na web…</p>
            </div>
          )}

          {data && !busy && (
            <div style={{ display:'flex', flexDirection:'column', gap:20, animation:'fadeUp 0.2s' }}>
              {data.warning && (
                <div style={{ fontSize:12, color:'#fcd34d', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:8, padding:'10px 14px', display:'flex', gap:8 }}>
                  <Flame size={13} style={{flexShrink:0, marginTop:1, color:'#f59e0b'}}/>{data.warning}
                </div>
              )}

              {data.carousel_ideas?.length > 0 && (
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:10, display:'flex', alignItems:'center', gap:6, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>
                    <Lightbulb size={12} style={{color:'var(--accent-amber)'}}/>Ideias prontas — clique para usar
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {data.carousel_ideas.map((idea,i)=>(
                      <button key={i} className="idea-card" onClick={()=>onUseIdea(idea.title+(idea.angle?'. '+idea.angle:''))}>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', lineHeight:1.29, marginBottom:6, fontFamily:'var(--font-ui)', letterSpacing:'-0.014em' }}>{idea.title}</div>
                        <div style={{ fontSize:11, color:'var(--text-secondary)', lineHeight:1.4, fontFamily:'var(--font-ui)' }}>{idea.angle}</div>
                        <div style={{ marginTop:10, fontSize:13, color:'var(--accent)', fontWeight:600, letterSpacing:'-0.011em' }}>Usar  →</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {data.viral_hooks?.length > 0 && (
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:10, display:'flex', alignItems:'center', gap:6, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>
                    <Zap size={12} style={{color:'var(--accent)'}}/>Ganchos virais
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {data.viral_hooks.map((h,i)=>(
                      <div key={i} className="hook-row">
                        <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', marginTop:1, width:16, flexShrink:0 }}>{String(i+1).padStart(2,'0')}</span>
                        <span style={{ flex:1, fontSize:12, color:'var(--text-secondary)', lineHeight:1.5, fontFamily:'var(--font-ui)' }}>{h}</span>
                        <button onClick={()=>navigator.clipboard?.writeText(h)} aria-label="Copiar gancho" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:8, borderRadius:6, transition:'color 0.12s, background 0.12s', flexShrink:0, minWidth:32, minHeight:32, display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                          onMouseEnter={e=>{ e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.background='rgba(0,0,0,0.04)'; }}
                          onMouseLeave={e=>{ e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.background='none'; }}
                        ><Copy size={11}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.trending_topics?.length > 0 && (
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:10, display:'flex', alignItems:'center', gap:6, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>
                    <TrendingUp size={12} style={{color:'var(--accent-amber)'}}/>Trending agora
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {data.trending_topics.map((t,i)=>(
                      <div key={i} style={{ background:'var(--bg-card)', borderRadius:8, padding:'10px 12px' }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-ui)' }}>{t.topic}</div>
                        <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:3, lineHeight:1.4, fontFamily:'var(--font-ui)' }}>{t.why}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TEMPLATES MODAL ──────────────────────────────────────────────────────────

// ─── HOOK VARIATIONS MODAL ────────────────────────────────────────────────────

function HookVariationsModal({
  open,
  onClose,
  onPick,
  slide,
  niche,
  openaiKey,
  brand,
  material,
  narrativeMode = 'editorial',
  creativePreset = 'livre',
}) {
  const [busy, setBusy] = useState(false);
  const [hooks, setHooks] = useState([]);
  const [err, setErr] = useState('');

  const run = useCallback(async () => {
    setBusy(true); setErr(''); setHooks([]);
    try {
      const brandBlock = buildBrandBlock(brand);
      const { materialBlock, materialPriorityBlock } = await resolveMaterialPromptParts(material);
      const r = await callAI(
        `Atue como copywriter sênior. Gere 5 variações de gancho (slide 1 de carrossel Instagram) com base no contexto abaixo.

${buildNarrativeModeReminder(narrativeMode)}
${brandBlock}${materialBlock}${materialPriorityBlock}
Tema atual: "${slide?.title || ''}"
Contexto: "${slide?.subtitle || ''}"
${niche ? `Nicho: ${niche}` : ''}

REGRAS:
${buildHookVariationRules(narrativeMode, creativePreset)}
- Se houver MATÉRIA-PRIMA, FONTES & REFERÊNCIAS ou INSTRUÇÕES acima, os ganchos devem estar alinhados a esse material (não genéricos).

Retorne APENAS JSON: {"hooks":[{"title":"...","subtitle":"frase curta de 1 linha que justifica o gancho"}]}`,
        { json: true, openaiKey }
      );
      setHooks(r.hooks || []);
    } catch(e) { setErr(e.message); }
    finally { setBusy(false); }
  }, [
    slide?.title,
    slide?.subtitle,
    niche,
    openaiKey,
    narrativeMode,
    creativePreset,
    brand,
    material,
  ]);

  useEffect(() => { if (open) run(); }, [open, run]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e=>e.stopPropagation()}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--bg-sidebar)', zIndex:1,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:32, height:32, borderRadius:8, background:'var(--accent)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Zap size={14} color="#fff"/>
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>Variações de gancho</div>
              <div className="vc-eyebrow">5 alternativas · escolha a melhor</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="vc-icon-btn">
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:10 }}>
          {busy && (
            <div style={{ textAlign:'center', padding:'24px 0' }}>
              <Loader2 size={22} style={{ animation:'spin 0.8s linear infinite', color:'var(--accent)' }}/>
              <p style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'var(--font-ui)', marginTop:10 }}>Gerando variações…</p>
            </div>
          )}
          {err && (
            <div style={{ fontSize:13, color:'#c5251c', background:'rgba(255,59,48,0.10)', border:'1px solid rgba(255,59,48,0.22)', borderRadius:11, padding:'10px 14px', letterSpacing:'-0.011em' }}>{err}</div>
          )}
          {!busy && hooks.map((h, i) => (
            <button
              key={i}
              onClick={()=>{ onPick(h); onClose(); }}
              className="idea-card"
              style={{ display:'flex', alignItems:'flex-start', gap:10 }}
            >
              <span style={{ fontSize:13, color:'var(--accent)', fontWeight:600, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.011em', marginTop:1, width:22, flexShrink:0 }}>
                {String(i+1).padStart(2,'0')}
              </span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-ui)', lineHeight:1.29, letterSpacing:'-0.014em' }}>{h.title}</div>
                {h.subtitle && (
                  <div style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', marginTop:4, lineHeight:1.4 }}>{h.subtitle}</div>
                )}
              </div>
              <ChevronRight size={14} style={{ color:'var(--text-muted)', flexShrink:0, marginTop:3 }}/>
            </button>
          ))}
          {!busy && hooks.length > 0 && (
            <button onClick={run} className="vc-btn vc-btn-ghost" style={{ width:'100%', height:36, marginTop:4 }}>
              <RefreshCw size={11}/>Gerar outras 5
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PER-SLIDE REF + EXTRA PROMPT (marca / produto) ───────────────────────────

function PerSlideImageRefBlock({
  slide, width, onChangeExtra, onRemoveRef, onPickRef,
  onGenerateImage, generateImageBusy, generateImageDisabled,
}) {
  const extra = slide.imgExtraPrompt ?? '';
  const ref = slide.refImage;
  return (
    <div
      style={{
        width: width || '100%',
        marginTop: 10,
        padding: 12,
        borderRadius: 11,
        border: '1px solid var(--hairline)',
        background: 'var(--bg-pearl)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.011em', marginBottom: 8 }}>
        Referência + direção da imagem
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
        <button
          type="button"
          onClick={onPickRef}
          style={{
            flexShrink: 0,
            width: 56,
            height: 56,
            borderRadius: 8,
            border: '1px dashed var(--border)',
            background: 'var(--bg-card)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            transition: 'border-color 0.12s, color 0.12s',
          }}
          title="Enviar foto de referência (produto, embalagem, mood)"
          aria-label="Adicionar imagem de referência"
        >
          {ref ? (
            <img src={ref} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 7 }} />
          ) : (
            <ImageIcon size={20} strokeWidth={1.75} />
          )}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label className="vc-label-sm" style={{ display: 'block', marginBottom: 4 }}>
            Prompt extra (este slide)
          </label>
          <textarea
            value={extra}
            onChange={(e) => onChangeExtra(e.target.value)}
            rows={3}
            placeholder="Ex.: fundo branco minimalista, garrafa centralizada, sombra suave, estética skincare premium…"
            className="vc-input vc-textarea"
            style={{ fontSize: 13, lineHeight: 1.47, letterSpacing: '-0.011em', width: '100%', resize: 'vertical', minHeight: 56 }}
          />
        </div>
      </div>
      {typeof onGenerateImage === 'function' && (
        <button
          type="button"
          onClick={onGenerateImage}
          disabled={generateImageDisabled || generateImageBusy}
          aria-busy={generateImageBusy || undefined}
          className="vc-btn vc-btn-primary"
          title={
            generateImageDisabled
              ? 'Defina palavras-chave de imagem neste card (aba Cards ou ao gerar o carrossel).'
              : 'Gera só a imagem deste slide com GPT Image ou Web trend, conforme o modo atual.'
          }
          style={{
            width: '100%',
            height: 34,
            marginTop: 0,
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 400,
            fontFamily: 'var(--font-ui)',
            letterSpacing: '-0.011em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {generateImageBusy ? (
            <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <Sparkles size={12} />
          )}
          Gerar imagem
        </button>
      )}
      {ref && (
        <button
          type="button"
          onClick={onRemoveRef}
          style={{
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'var(--font-ui)',
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            letterSpacing: '-0.011em',
          }}
        >
          Remover referência
        </button>
      )}
    </div>
  );
}

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

// ─── EXPORT MORE FORMATS — único dropdown "Baixar" com todas as saídas ────────
// Antes era um botão secundário ("Mais formatos") abaixo do CTA fixo "Baixar
// card N". Agora absorve a opção do card individual como PRIMEIRA do menu e
// vira o único ponto de download da app — economiza 50px no footer mobile.
function ExportMoreFormats({
  slides, exporting, exportProgress,
  activeIdx, onExportSlide,
  onExportAll, onExportPDF, onExportPhotosOnly,
  hideSlideOption = false,
}) {
  const [open, setOpen] = React.useState(false);
  const refMenu = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (!refMenu.current) return;
      if (!refMenu.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const photoCount = slides.filter(s => !!s.bgImage).length;
  const aiCount = slides.filter(s => s.bgImageSource === 'ai').length;
  const menuItemStyle = {
    display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
    border:'none', background:'transparent', cursor:'pointer', borderRadius:6,
    fontSize:12, fontFamily:'var(--font-ui)', color:'var(--text-primary)',
    transition:'background 0.12s', textAlign:'left', width:'100%',
  };
  return (
    <div ref={refMenu} style={{ position:'relative', flex:'0 0 auto' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={exporting}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Opções de download"
        style={{
          minHeight:36, padding:'0 16px', borderRadius:9999, border:'none',
          background:'var(--text-primary)', color:'#fff',
          fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)',
          letterSpacing:'-0.011em', cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
          opacity: exporting ? 0.5 : 1,
          transition:'opacity 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
          whiteSpace:'nowrap',
        }}
      >
        <Download size={13}/>
        {exporting && exportProgress
          ? `${exportProgress.current}/${exportProgress.total}…`
          : 'Exportar'}
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }}/>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position:'absolute', bottom:'100%', left:0, marginBottom:6, minWidth:260,
            background:'var(--bg-base)', border:'1px solid var(--hairline)',
            borderRadius:10, boxShadow:'0 8px 28px rgba(0,0,0,0.12)',
            padding:6, display:'flex', flexDirection:'column', gap:2, zIndex:50,
          }}
        >
          {/* Card individual — primeira opção, era o CTA fixo antes */}
          {!hideSlideOption && onExportSlide && (
            <button
              role="menuitem"
              type="button"
              onClick={() => { setOpen(false); onExportSlide(activeIdx); }}
              disabled={exporting}
              style={menuItemStyle}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-pearl)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Download size={13} style={{ color:'var(--accent)' }}/>
              <span style={{ flex:1, fontWeight:600 }}>Card {activeIdx + 1}</span>
              <span style={{ color:'var(--text-muted)', fontSize:10, fontFamily:'var(--font-mono)' }}>PNG</span>
            </button>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={() => { setOpen(false); onExportAll(); }}
            disabled={exporting}
            style={menuItemStyle}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-pearl)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Download size={13} style={{ color:'var(--text-muted)' }}/>
            <span style={{ flex:1 }}>Carrossel completo</span>
            <span style={{ color:'var(--text-muted)', fontSize:10, fontFamily:'var(--font-mono)' }}>
              ZIP · {slides.length} cards
            </span>
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => { setOpen(false); onExportPDF(); }}
            disabled={exporting}
            style={menuItemStyle}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-pearl)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <FileText size={13} style={{ color:'var(--text-muted)' }}/>
            <span style={{ flex:1 }}>Carrossel em PDF</span>
          </button>
          {photoCount > 0 && (
            <button
              role="menuitem"
              type="button"
              onClick={() => { setOpen(false); onExportPhotosOnly(); }}
              disabled={exporting}
              style={menuItemStyle}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-pearl)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              title="Salva as imagens raw (sem texto) — útil pra reusar fotos geradas por IA"
            >
              <ImageIcon size={13} style={{ color:'var(--text-muted)' }}/>
              <span style={{ flex:1 }}>Apenas fotos limpas</span>
              <span style={{ color:'var(--text-muted)', fontSize:10, fontFamily:'var(--font-mono)' }}>
                {photoCount}{aiCount > 0 ? ` · ${aiCount} IA` : ''}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}




// ─── MAIN APP ─────────────────────────────────────────────────────────────────

/** Posição absoluta da pílula @ no card — % do cartão (canto superior esquerdo do badge). */
function vcHandleBadgeBoxPositionStyle(brand) {
  const x = typeof brand?.handleBadgeX === 'number' ? Math.min(100, Math.max(0, brand.handleBadgeX)) : 5;
  const y = typeof brand?.handleBadgeY === 'number' ? Math.min(100, Math.max(0, brand.handleBadgeY)) : 4;
  return {
    position: 'absolute',
    left: `${x}%`,
    top: `${y}%`,
    zIndex: 22,
  };
}

/** Foto do @ no badge: posição, rotação completa e zoom dentro do círculo (object-fit + transform). */
function vcHandleAvatarImgStyle(brand) {
  const x = typeof brand?.handleAvatarPosX === 'number' ? Math.min(100, Math.max(0, brand.handleAvatarPosX)) : 50;
  const y = typeof brand?.handleAvatarPosY === 'number' ? Math.min(100, Math.max(0, brand.handleAvatarPosY)) : 50;
  const rotRaw = typeof brand?.handleAvatarRotate === 'number' ? brand.handleAvatarRotate : 0;
  const rot = ((rotRaw % 360) + 360) % 360;
  const zoomPct = typeof brand?.handleAvatarZoom === 'number' ? Math.min(220, Math.max(85, brand.handleAvatarZoom)) : 100;
  const sc = zoomPct / 100;
  return {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: `${x}% ${y}%`,
    display: 'block',
    transform: `rotate(${rot}deg) scale(${sc})`,
    transformOrigin: `${x}% ${y}%`,
  };
}











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
  // Wrapper que mantém __vcVideoUrlMap SINCRONIZADO com o setVideoUrls.
  // Sem isso, o renderer (que lê o map module-level via getVideoUrl) ficava
  // 1 render atrás — bloco do <video> nunca disparava porque getVideoUrl
  // retornava null no primeiro render após import. useEffect só roda DEPOIS
  // do commit, então o mapa ficava stale até o próximo render espontâneo.
  const setVideoUrlsSync = useCallback((nextOrFn) => {
    setVideoUrls(prev => {
      const next = typeof nextOrFn === 'function' ? nextOrFn(prev) : nextOrFn;
      __vcVideoUrlMap = next;
      videoUrlsRef.current = next;
      return next;
    });
  }, []);
  // Defesa em profundidade: mesmo se algo escapar, useEffect garante sync.
  useEffect(() => { __vcVideoUrlMap = videoUrls; }, [videoUrls]);
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

// ─── ACCOUNT HOME — visão da conta + lista de projetos (antes do editor) ─────
function AccountHomeShell({
  library,
  activeDocId,
  activeEntryName,
  brandCount,
  aiSettings = DEFAULT_AI_SETTINGS,
  hasTextAI,
  hasImageAI,
  isMobile,
  onGenerate,
  onOpenLibrary,
  onOpenTemplates,
  onOpenResearch,
  onOpenHelp,
  onOpenSettings,
  onContinueEditor,
  openDoc,
  newDoc,
  renameDoc,
  duplicateDoc,
  deleteDoc,
  setDocStatus,
  exportDoc,
  askPrompt,
  onManageBilling,
  onLogout,
  onOpenBrands,
  accessEmail,
  currentPeriodEnd,
  accountTab = 'projects',
  setAccountTab,
}) {
  const totalCards = useMemo(
    () => library.reduce((n, e) => n + (Array.isArray(e.doc?.slides) ? e.doc.slides.length : 0), 0),
    [library],
  );

  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const navBtn = (id, label, Icon) => {
    const active = accountTab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setAccountTab?.(id)}
        style={{
          height: isMobile ? 36 : 36,
          padding: '0 12px',
          borderRadius: 9999,
          border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
          background: active ? 'var(--accent-surface)' : 'var(--bg-card)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'var(--font-ui)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
        }}
      >
        <Icon size={13} color={active ? 'var(--accent)' : 'var(--text-muted)'} />
        {label}
      </button>
    );
  };

  const generateBtn = (fullWidth = false) => (
    <button
      type="button"
      data-vc-tour="generate"
      onClick={() => onGenerate()}
      style={{
        width: fullWidth ? '100%' : 'auto',
        height: fullWidth ? 48 : 40,
        minHeight: fullWidth ? 48 : 40,
        padding: '0 22px',
        borderRadius: 9999,
        border: 'none',
        cursor: 'pointer',
        background: 'var(--accent)',
        color: '#fff',
        fontSize: fullWidth ? 15 : 13,
        fontWeight: 600,
        letterSpacing: '-0.016em',
        fontFamily: 'var(--font-ui)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        boxShadow: '0 0 0 1px rgba(255,45,141,0.25)',
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <Sparkles size={fullWidth ? 15 : 14} /> Gerar com IA
    </button>
  );

  const items = useMemo(() => (
    [...library]
      .filter(e => !search.trim() || (e.name || '').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  ), [library, search]);

  const textProvider = TEXT_PROVIDERS[aiSettings.textProvider] || TEXT_PROVIDERS.openai;
  const imageProvider = IMAGE_PROVIDERS[aiSettings.imageProvider] || IMAGE_PROVIDERS.openai;
  const textModelName = textProvider.models.find((m) => m.id === aiSettings.textModels?.[aiSettings.textProvider])?.name
    || aiSettings.textModels?.[aiSettings.textProvider]
    || 'Modelo';
  const imageModelName = imageProvider.models.find((m) => m.id === aiSettings.imageModels?.[aiSettings.imageProvider])?.name
    || aiSettings.imageModels?.[aiSettings.imageProvider]
    || 'Modelo';
  const aiReady = hasTextAI && hasImageAI;
  const projectName = activeEntryName || 'Sem título';

  const headerBtn = {
    height: isMobile ? 40 : 36,
    padding: '0 12px',
    borderRadius: 9999,
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  };

  return (
    <div
      data-vc-tour="account-home"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-base)',
        minHeight: 0,
        minWidth: 0,
        width: '100%',
      }}
    >
      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-sidebar)',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) auto minmax(0, 1fr)',
        alignItems: 'center',
        gap: isMobile ? 12 : 16,
        padding: isMobile
          ? `calc(10px + env(safe-area-inset-top, 0)) max(12px, env(safe-area-inset-left, 0px)) 12px max(12px, env(safe-area-inset-right, 0px))`
          : `calc(10px + env(safe-area-inset-top, 0)) 16px 10px`,
        flexShrink: 0,
      }}>
        {/* Esquerda — marca + Projetos */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
          justifyContent: 'flex-start',
        }}>
          <button
            type="button"
            onClick={() => setAccountTab?.('projects')}
            title="Projetos"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minWidth: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              color: 'inherit',
              textAlign: 'left',
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10, background: 'var(--logo-mark-bg)',
              display: 'grid', placeItems: 'center', flexShrink: 0,
              border: '1px solid var(--border)',
            }}>
              <Flame size={16} color="var(--logo-mark-fg)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 17, fontWeight: 600, letterSpacing: '-0.022em',
                fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1.2,
              }}>
                Viral<span style={{ color: 'var(--accent)' }}>.</span>
              </div>
              <div style={{
                marginTop: 2, fontSize: 11, color: 'var(--text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: isMobile ? 140 : 180,
              }}>
                {accessEmail || 'Studio · dados neste aparelho'}
              </div>
            </div>
          </button>
          {!isMobile && navBtn('projects', 'Projetos', Layers)}
        </div>

        {/* Centro — Gerar com IA */}
        {!isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {generateBtn(false)}
          </div>
        )}

        {/* Direita — ferramentas + Perfil (extremo direito; Assinatura fica dentro do Perfil) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          minWidth: 0,
          flexWrap: 'wrap',
        }}>
          {isMobile ? (
            <>
              <button
                type="button"
                onClick={() => onOpenSettings()}
                aria-label="Configurar IA"
                style={{
                  ...headerBtn,
                  border: `1px solid ${aiReady ? 'var(--success-border)' : 'var(--border)'}`,
                  background: aiReady ? 'var(--success-surface)' : 'var(--bg-pearl)',
                  color: aiReady ? 'var(--success-text)' : 'var(--text-secondary)',
                }}
              >
                <Settings size={13} /> IA
              </button>
              {navBtn('profile', 'Perfil', User)}
            </>
          ) : (
            <>
              <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }} aria-label="Ferramentas">
                <button type="button" onClick={() => onOpenTemplates()} style={headerBtn}>
                  <Layout size={13} /> Templates
                </button>
                <button type="button" onClick={() => onOpenResearch()} style={headerBtn}>
                  <TrendingUp size={13} /> Pesquisa
                </button>
                <button type="button" onClick={() => onOpenHelp()} style={headerBtn} aria-label="Ajuda">?</button>
                <button
                  type="button"
                  onClick={() => onOpenSettings()}
                  style={{
                    ...headerBtn,
                    border: `1px solid ${aiReady ? 'var(--success-border)' : 'var(--border)'}`,
                    background: aiReady ? 'var(--success-surface)' : 'var(--bg-pearl)',
                    color: aiReady ? 'var(--success-text)' : 'var(--text-secondary)',
                  }}
                >
                  <Settings size={13} /> Configurar IA
                </button>
              </nav>
              <nav aria-label="Conta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {navBtn('profile', 'Perfil', User)}
              </nav>
            </>
          )}
        </div>

        {isMobile && (
          <div style={{ gridColumn: '1 / -1' }}>
            {generateBtn(true)}
          </div>
        )}
      </header>

      <div style={{
        flex: 1, minHeight: 0, minWidth: 0, width: '100%',
        overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{
          boxSizing: 'border-box', width: '100%', maxWidth: accountTab === 'profile' ? 820 : 720,
          marginLeft: 'auto', marginRight: 'auto',
          padding: isMobile ? '24px 16px 40px' : '40px 24px 72px',
          display: 'grid', gap: 28,
        }}>
          {accountTab === 'profile' && (
            <>
              <header>
                <p className="vc-eyebrow" style={{ margin: '0 0 8px' }}>Conta</p>
                <h2 style={{
                  margin: 0, fontSize: isMobile ? 24 : 28, fontWeight: 600,
                  letterSpacing: '-0.024em', fontFamily: 'var(--font-display)',
                  color: 'var(--text-primary)', lineHeight: 1.15,
                }}>
                  Perfil pessoal
                </h2>
                <p style={{
                  margin: '8px 0 0', fontSize: 15, lineHeight: 1.45,
                  color: 'var(--text-muted)', maxWidth: '52ch',
                }}>
                  Seu nome, bio, redes e assinatura.
                </p>
              </header>
              <AccountProfile
                email={accessEmail}
                libraryCount={library.length}
                brandCount={brandCount}
                totalCards={totalCards}
                aiSettings={aiSettings}
                hasTextAI={hasTextAI}
                hasImageAI={hasImageAI}
                isMobile={isMobile}
                onOpenSettings={onOpenSettings}
                onManageBilling={onManageBilling}
                onLogout={onLogout}
                onOpenBrands={onOpenBrands}
                currentPeriodEnd={currentPeriodEnd}
              />
            </>
          )}

          {accountTab === 'projects' && (
          <>
          <header>
            <p className="vc-eyebrow" style={{ margin: '0 0 8px' }}>Início</p>
            <h2 style={{
              margin: 0, fontSize: isMobile ? 24 : 28, fontWeight: 600,
              letterSpacing: '-0.024em', fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)', lineHeight: 1.15,
            }}>
              Seus projetos
            </h2>
            <p style={{
              margin: '8px 0 0', fontSize: 15, lineHeight: 1.45,
              color: 'var(--text-muted)', maxWidth: '52ch',
            }}>
              Continue o carrossel em edição ou comece um novo.
            </p>
          </header>

          <section
            aria-label="Projeto atual"
            style={{
              border: '1.5px solid var(--accent)',
              background: 'var(--accent-surface)',
              borderRadius: 16,
              padding: isMobile ? 16 : 20,
              display: 'grid',
              gap: 14,
            }}
          >
            <div>
              <div className="vc-eyebrow" style={{ marginBottom: 6 }}>Em edição</div>
              <h3 style={{
                margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.022em',
                color: 'var(--text-primary)',
              }}>
                {projectName}
              </h3>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                No editor: Marca → Conteúdo → Cards → IA
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                onClick={onContinueEditor}
                style={{
                  height: 40, padding: '0 18px', borderRadius: 9999, border: 'none',
                  background: 'var(--accent)', color: '#fff', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-ui)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                Continuar no editor <ChevronRight size={15} />
              </button>
              <button
                type="button"
                onClick={() => newDoc()}
                style={{
                  height: 40, padding: '0 16px', borderRadius: 9999,
                  border: '1px solid var(--border)', background: 'var(--bg-base)',
                  color: 'var(--text-primary)', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-ui)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <Plus size={14} /> Novo projeto
              </button>
            </div>
          </section>

          <section aria-label="Resumo">
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: 10,
            }}>
              {[
                { label: 'Projetos', value: library.length },
                { label: 'Marcas', value: brandCount },
                { label: 'Cards', value: totalCards },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    background: 'var(--bg-pearl)',
                    borderRadius: 12,
                    border: '1px solid var(--hairline)',
                    padding: '14px 16px',
                  }}
                >
                  <div style={{
                    fontSize: 10, letterSpacing: '0.08em', fontWeight: 600,
                    textTransform: 'uppercase', color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)', marginBottom: 6,
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontSize: 26, fontWeight: 600, letterSpacing: '-0.028em',
                    fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1,
                  }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section
            aria-label="Estado da IA"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              borderRadius: 16,
              padding: 18,
              display: 'grid',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div className="vc-eyebrow" style={{ marginBottom: 6 }}>IA</div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {aiReady ? 'Pronta para gerar' : 'Configure para gerar'}
                </h3>
                <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Escolha quem escreve e quem gera as imagens
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenSettings()}
                style={{
                  height: 36, padding: '0 14px', borderRadius: 9999, flexShrink: 0,
                  border: aiReady ? '1px solid var(--border)' : 'none',
                  background: aiReady ? 'var(--bg-pearl)' : 'var(--accent)',
                  color: aiReady ? 'var(--text-primary)' : '#fff',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)',
                }}
              >
                {aiReady ? 'Ajustar' : 'Configurar IA'}
              </button>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 8,
            }}>
              {[
                { label: 'Texto', name: textProvider.name, model: textModelName, ok: hasTextAI },
                { label: 'Imagens', name: imageProvider.name, model: imageModelName, ok: hasImageAI },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    background: 'var(--bg-pearl)',
                    display: 'grid',
                    gap: 4,
                  }}
                >
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--text-muted)',
                  }}>
                    {row.label}
                  </span>
                  <strong style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {row.name}
                  </strong>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.model}</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4,
                    fontSize: 10, fontFamily: 'var(--font-mono)',
                    color: row.ok ? 'var(--success)' : 'var(--text-muted)',
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: row.ok ? 'var(--success)' : 'var(--hairline)',
                    }} />
                    {row.ok ? 'Conectado' : 'Falta chave'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Lista de projetos" style={{ display: 'grid', gap: 14 }}>
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center',
              justifyContent: 'space-between', gap: 10,
            }}>
              <div>
                <div className="vc-eyebrow" style={{ marginBottom: 4 }}>Biblioteca</div>
                <h3 style={{
                  margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.022em',
                  fontFamily: 'var(--font-display)', color: 'var(--text-primary)',
                }}>
                  Todos os projetos
                </h3>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => onOpenLibrary()}
                  data-vc-tour="library"
                  style={{
                    height: 36, padding: '0 14px', borderRadius: 9999,
                    border: '1px solid var(--border)', background: 'var(--bg-base)',
                    cursor: 'pointer', color: 'var(--text-secondary)',
                    fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)',
                  }}
                >
                  Abrir biblioteca
                </button>
                <button
                  type="button"
                  onClick={() => newDoc()}
                  style={{
                    height: 36, padding: '0 14px', borderRadius: 9999, border: 'none',
                    cursor: 'pointer', background: 'var(--accent)', color: '#fff',
                    fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Plus size={13} /> Novo
                </button>
              </div>
            </div>

            <input
              type="search"
              placeholder="Buscar projeto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="vc-input"
              aria-label="Buscar projetos"
              style={{ width: '100%' }}
            />


        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.length === 0 && (
            <div style={{
              padding: 36,
              textAlign: 'center',
              color: 'var(--text-muted)',
              border: '1px dashed var(--hairline)',
              borderRadius: 16,
              fontSize: 14,
              lineHeight: 1.45,
            }}>
              {search.trim()
                ? 'Nenhum projeto com esse nome.'
                : 'Ainda sem projetos. Crie um novo ou gere com IA.'}
            </div>
          )}
          {items.map(entry => {
            const isActive = entry.id === activeDocId;
            const slides = entry.doc?.slides || [];
            const firstSlide = slides[0];
            const bg = resolveSlideBrandBg(entry.doc?.brand || {}, 0, firstSlide || {});
            return (
              <div
                key={entry.id}
                style={{
                  background: isActive ? 'var(--accent-surface)' : 'var(--bg-pearl)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--hairline)'}`,
                  borderRadius: 14,
                  padding: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'border-color 0.15s var(--ease-smooth)',
                }}
              >
                <button
                  type="button"
                  onClick={() => openDoc(entry.id)}
                  aria-label={`Abrir ${entry.name}`}
                  style={{
                    width: 56,
                    height: 70,
                    borderRadius: 11,
                    flexShrink: 0,
                    cursor: 'pointer',
                    border: '1px solid var(--hairline)',
                    background: bg,
                    backgroundImage: firstSlide?.bgImage ? `url(${firstSlide.bgImage})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {firstSlide?.bgImage && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.28)',
                    }} />
                  )}
                  <span style={{
                    position: 'absolute',
                    bottom: 5,
                    left: 6,
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    opacity: 0.85,
                  }}>{slides.length}</span>
                </button>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => openDoc(entry.id)}
                      title="Abrir projeto no editor"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: 16,
                        fontWeight: 600,
                        letterSpacing: '-0.022em',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      {entry.name || 'Sem título'}
                      {isActive && (
                        <span style={{
                          marginLeft: 8,
                          fontSize: 10,
                          fontWeight: 600,
                          color: 'var(--accent)',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                        }}>
                          atual
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const next = await askPrompt({
                          title: 'Renomear projeto',
                          label: 'Nome',
                          defaultValue: entry.name || '',
                          placeholder: 'Ex: Lançamento de produto',
                          cta: 'Guardar',
                        });
                        if (next?.trim()) renameDoc(entry.id, next.trim());
                      }}
                      style={{
                        padding: '2px 6px',
                        fontSize: 11,
                        color: 'var(--accent)',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        background: 'transparent',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Renomear
                    </button>
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {slides.length} card{slides.length !== 1 ? 's' : ''}
                    {entry.updatedAt ? ` · ${fmtDate(entry.updatedAt)}` : ''}
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  alignItems: 'stretch',
                  flexShrink: 0,
                }}>
                  <select
                    aria-label={`Estado para ${entry.name}`}
                    value={entry.status}
                    onChange={e => setDocStatus(entry.id, e.target.value)}
                    style={{
                      fontSize: 11,
                      padding: '4px 6px',
                      borderRadius: 8,
                      background: 'var(--bg-card)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      minWidth: 100,
                      fontFamily: 'var(--font-ui)',
                    }}
                  >
                    {STATUS_DEFS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" onClick={() => duplicateDoc(entry.id)} title="Duplicar"
                      aria-label={`Duplicar ${entry.name}`}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: 'var(--bg-base)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                      }}
                    ><Copy size={13} /></button>
                    <button type="button" onClick={() => exportDoc(entry.id)} title="Exportar JSON"
                      aria-label={`Exportar ${entry.name}`}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: 'var(--bg-base)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                      }}
                    ><Download size={13} /></button>
                    {confirmDeleteId === entry.id ? (
                      <>
                        <button type="button" onClick={() => { deleteDoc(entry.id); setConfirmDeleteId(null); }}
                          style={{
                            padding: '0 10px',
                            height: 32,
                            borderRadius: 8,
                            border: '1px solid rgba(255,59,48,0.35)',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#ff3b30',
                            background: 'rgba(255,59,48,0.08)',
                          }}
                        >
                          Confirmar eliminação
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          background: 'var(--bg-base)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        ><X size={13} /></button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmDeleteId(entry.id)}
                        aria-label={`Apagar ${entry.name}`}
                        style={{
                          width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
                          cursor: 'pointer',
                          background: 'var(--bg-base)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff3b30',
                        }}
                      ><Trash2 size={13} /></button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

          <p style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.45,
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}>
            Atalhos: Templates e Pesquisa no topo · chaves de IA em Configurar IA
          </p>
          </section>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LIBRARY MODAL ────────────────────────────────────────────────────────────
// Lista os carrosséis salvos com mini-thumbnail, nome editável, status e ações.

function FullscreenViewer({ open, onClose, slides, fmt, brand, activeIdx, setActiveIdx, onSavePresentationAdjust, creativePreset = 'livre' }) {
  useScrollLock(open);
  const touchRef = useRef({ x:0, y:0 });
  const [size, setSize] = useState({ w:0, h:0 });
  const [photoAdjustOpen, setPhotoAdjustOpen] = useState(false);
  /** Rascunho da tela cheia: apenas slides com entrada explícita; ausente = usar `slide.presentationImgAdjust`. */
  const [imgAdjBySlide, setImgAdjBySlide] = useState({});

  useEffect(() => {
    if (!open) {
      setPhotoAdjustOpen(false);
      return;
    }
    const upd = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (photoAdjustOpen) setPhotoAdjustOpen(false);
        else onClose();
      }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); setActiveIdx(Math.max(0, activeIdx - 1)); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setActiveIdx(Math.min(slides.length - 1, activeIdx + 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, activeIdx, slides.length, setActiveIdx, onClose, photoAdjustOpen]);

  if (!open || !slides[activeIdx]) return null;

  const activeSlideFs = slides[activeIdx];
  const slideFsId = activeSlideFs.id;
  const hasBgImageFs = !!activeSlideFs.bgImage;

  const overlayDraftFs = imgAdjBySlide[slideFsId];
  const adjFs =
    overlayDraftFs !== undefined
      ? normalizePresentationImgAdjust(overlayDraftFs)
      : normalizePresentationImgAdjust(activeSlideFs.presentationImgAdjust);
  const presentationImgFilterFs =
    hasBgImageFs && !presentationAdjustIsNeutral(adjFs)
      ? buildPresentationImageFilter(adjFs)
      : null;
  const fsAdjDirtyUi = !presentationAdjustIsNeutral(adjFs);

  const fsPendingPersist =
    slides.some((sl) => {
      if (!Object.prototype.hasOwnProperty.call(imgAdjBySlide, sl.id)) return false;
      return !presentationImgAdjustEquivalent(sl.presentationImgAdjust, imgAdjBySlide[sl.id]);
    }) && !!onSavePresentationAdjust;

  const bumpFsAdj = (key, delta) => {
    if (!hasBgImageFs) return;
    setImgAdjBySlide((prev) => {
      const row = FULLSCREEN_IMG_ADJ_ROWS.find((r) => r.key === key);
      if (!row) return prev;
      const prevDraft = prev[slideFsId];
      const base =
        prevDraft !== undefined
          ? { ...normalizePresentationImgAdjust(prevDraft) }
          : { ...normalizePresentationImgAdjust(activeSlideFs.presentationImgAdjust) };
      let nextVal = base[key] + delta;
      nextVal = Math.round(nextVal / row.step) * row.step;
      nextVal = Math.max(row.min, Math.min(row.max, nextVal));
      return { ...prev, [slideFsId]: { ...base, [key]: nextVal } };
    });
  };

  const setFsAdjKey = (key, rawVal) => {
    if (!hasBgImageFs) return;
    setImgAdjBySlide((prev) => {
      const row = FULLSCREEN_IMG_ADJ_ROWS.find((r) => r.key === key);
      if (!row) return prev;
      const prevDraft = prev[slideFsId];
      const base =
        prevDraft !== undefined
          ? { ...normalizePresentationImgAdjust(prevDraft) }
          : { ...normalizePresentationImgAdjust(activeSlideFs.presentationImgAdjust) };
      let nextVal = Math.round(Number(rawVal));
      if (!Number.isFinite(nextVal)) return prev;
      nextVal = Math.round(nextVal / row.step) * row.step;
      nextVal = Math.max(row.min, Math.min(row.max, nextVal));
      return { ...prev, [slideFsId]: { ...base, [key]: nextVal } };
    });
  };

  const resetFsSlideAdj = () => {
    setImgAdjBySlide((prev) => ({
      ...prev,
      [slideFsId]: { ...DEFAULT_PRESENTATION_IMG_ADJUST },
    }));
  };

  const submitFsPersist = () => {
    if (!onSavePresentationAdjust || !fsPendingPersist) return;
    onSavePresentationAdjust(imgAdjBySlide);
  };

  const f = FORMATS[fmt] || FORMATS.carrossel;
  const padding = 32;
  const bottomReserve = photoAdjustOpen ? 232 : 108;
  const scale = Math.min(
    (size.w - padding * 2) / f.w,
    (size.h - padding * 2 - bottomReserve) / f.h,
    1,
  );
  const realScale = Number.isFinite(scale) && scale > 0 ? scale : 0.8;

  const onTouchStart = e => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = e => {
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) setActiveIdx(Math.min(slides.length - 1, activeIdx + 1));
      else setActiveIdx(Math.max(0, activeIdx - 1));
    }
  };

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Apresentação em tela cheia"
      style={{
        position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.96)',
        display:'flex', alignItems:'center', justifyContent:'center',
        animation:'fadeUp 0.2s var(--ease-smooth)',
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, padding:'14px 20px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background:'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
        zIndex:2,
      }}>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', fontFamily:'var(--font-mono)', letterSpacing:'0.08em' }}>
          {String(activeIdx+1).padStart(2,'0')} / {String(slides.length).padStart(2,'0')}
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar tela cheia"
          style={{
            display:'flex', alignItems:'center', gap:6,
            background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)',
            color:'#fff', borderRadius:8, padding:'6px 12px', cursor:'pointer',
            fontSize:12, fontFamily:'var(--font-ui)', fontWeight:600,
          }}
        >
          <X size={13}/> ESC para sair
        </button>
      </div>

      {/* Slide */}
      <div style={{ pointerEvents:'none' }}>
        <SlideCard
          slide={activeSlideFs} fmt={fmt} brand={brand}
          num={activeIdx+1} total={slides.length} scale={realScale}
          creativePreset={creativePreset}
          showCanvasChrome={false}
          {...(overlayDraftFs !== undefined
            ? { presentationImgFilter: presentationImgFilterFs }
            : {})}
        />
      </div>

      {/* Setas */}
      {activeIdx > 0 && (
        <button
          onClick={() => setActiveIdx(activeIdx - 1)}
          aria-label="Slide anterior"
          style={{
            position:'absolute', left:24, top:'50%', transform:'translateY(-50%)',
            width:48, height:48, borderRadius:'50%',
            background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)',
            color:'#fff', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            backdropFilter:'blur(8px)',
          }}
        >‹</button>
      )}
      {activeIdx < slides.length - 1 && (
        <button
          onClick={() => setActiveIdx(activeIdx + 1)}
          aria-label="Próximo slide"
          style={{
            position:'absolute', right:24, top:'50%', transform:'translateY(-50%)',
            width:48, height:48, borderRadius:'50%',
            background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)',
            color:'#fff', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            backdropFilter:'blur(8px)', fontSize:24, lineHeight:1,
          }}
        >›</button>
      )}

      {/* Ajustes de imagem — abre sob demanda (botão ou tecla já documentada na barra) */}
      <div
        style={{
          position: 'absolute',
          bottom: 58,
          left: 0,
          right: 0,
          zIndex: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto', width: '100%', display: 'flex', justifyContent: 'center', paddingLeft: 20, paddingRight: 20, boxSizing: 'border-box' }}>
          {!photoAdjustOpen ? (
            <button
              type="button"
              disabled={!hasBgImageFs}
              onClick={() => setPhotoAdjustOpen(true)}
              aria-label={
                hasBgImageFs ? 'Abrir ajustes da foto' : 'Ajustes da foto indisponíveis sem imagem de fundo'
              }
              title={hasBgImageFs ? undefined : 'Adicione uma imagem de fundo para ajustar.'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 18px',
                borderRadius: 9999,
                border: `1px solid ${hasBgImageFs ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)'}`,
                background: hasBgImageFs ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                color: hasBgImageFs ? '#fff' : 'rgba(255,255,255,0.35)',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--font-ui)',
                letterSpacing: '-0.022em',
                cursor: hasBgImageFs ? 'pointer' : 'not-allowed',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                transition: 'background 0.15s, transform 0.1s',
              }}
              onMouseDown={(e) => {
                if (hasBgImageFs) e.currentTarget.style.transform = 'scale(0.95)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <SlidersHorizontal size={14} aria-hidden strokeWidth={2.25} />
              Ajustar foto
            </button>
          ) : (
            <FullscreenImageAdjustBar
              disabled={!hasBgImageFs}
              adj={adjFs}
              onBump={bumpFsAdj}
              onSetKey={setFsAdjKey}
              onResetSlide={resetFsSlideAdj}
              onSave={submitFsPersist}
              anyDirty={fsAdjDirtyUi}
              hasPendingPersist={fsPendingPersist}
              onClose={() => setPhotoAdjustOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Dots */}
      <div style={{
        position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)',
        display:'flex', gap:6, padding:'8px 14px',
        background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)',
        borderRadius:99, backdropFilter:'blur(8px)',
      }}>
        {slides.map((_, i) => (
          <button
            key={i}
            aria-label={`Ir para slide ${i+1}`}
            onClick={() => setActiveIdx(i)}
            style={{
              width: i === activeIdx ? 22 : 8, height:8, borderRadius:99,
              background: i === activeIdx ? '#fff' : 'rgba(255,255,255,0.35)',
              border:'none', padding:0, cursor:'pointer',
              transition:'width 0.18s var(--ease-smooth), background 0.18s',
            }}
          />
        ))}
      </div>
    </div>
  );
}


