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
  Home, Layers, SlidersHorizontal,
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
import { VISUAL_PRESETS, VISUAL_PRESET_BY_ID, applyVisualPreset, getSlideOverridesForPreset } from './src/styles/visual-presets.jsx';

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
  /** Biblioteca de hooks (capas) que o usuário aprovou — sugerida em novas gerações do mesmo nicho. */
  hookLibrary:   'vc_hook_library',
  onboarding:    'vc_onboarding_done',
  shellView:     'vc_shell_view',
  /** Lista no editor: grelha de alinhamento sobre o preview (não exportada). */
  previewGrid:   'vc_preview_align_grid',
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

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────

const GLOBAL_STYLE = `
  /* Airtable Design System (hard apply) — clean enterprise, deep navy + blue CTA.
     Source: getdesign.md/airtable. Tokens semânticos --theme_* preservados
     com nomes legacy (--accent etc) pra compat com o resto do código. */

  :root {
    /* — Airtable core palette — */
    --airtable-blue: #1b61c9;
    --airtable-blue-mid: #254fad;
    --airtable-blue-hover: #1652ad;
    --airtable-navy: #181d26;
    --airtable-border: #e0e2e6;
    --airtable-surface-light: #f8fafc;
    --airtable-spotlight: rgba(249, 252, 255, 0.97);
    --airtable-success: #006400;
    --airtable-text-weak: rgba(4, 14, 32, 0.69);
    --airtable-text-secondary-active: rgba(7, 12, 20, 0.82);

    /* — Surfaces — Airtable white canvas */
    --bg-base: #ffffff;
    --bg-parchment: var(--airtable-surface-light);
    --bg-pearl: var(--airtable-surface-light);
    --bg-sidebar: var(--airtable-surface-light);
    --bg-elevated: #ffffff;
    --bg-card: #ffffff;

    --bg-tile-1: #2a2f3a;
    --bg-tile-2: #2d3340;
    --bg-tile-3: #28303d;
    --bg-black: #181d26;

    --border: var(--airtable-border);
    --border-muted: #ecedf0;
    --hairline: var(--airtable-border);
    --divider-soft: rgba(24, 29, 38, 0.06);
    --border-on-dark: rgba(255, 255, 255, 0.10);

    --text-primary: var(--airtable-navy);
    --text-secondary: #333333;
    --text-muted: var(--airtable-text-weak);
    --text-on-dark: #ffffff;
    --text-on-dark-muted: rgba(255, 255, 255, 0.72);

    /* Ação principal = Airtable Blue (era magenta). Secondary = blue-mid. */
    --accent: var(--airtable-blue);
    --accent-hover: var(--airtable-blue-hover);
    --accent-focus: var(--airtable-blue);
    --accent-secondary: var(--airtable-blue-mid);
    --accent-on-dark: #ffffff;
    --accent-surface: rgba(27, 97, 201, 0.10);
    --accent-surface-strong: rgba(27, 97, 201, 0.18);
    --accent-magenta-surface: rgba(27, 97, 201, 0.08);  /* legacy alias */
    --accent-glow: rgba(45, 127, 249, 0.28);

    --logo-mark-bg: var(--accent-surface);
    --logo-mark-fg: var(--accent);

    --success: var(--airtable-success);
    --success-surface: rgba(0, 100, 0, 0.10);
    --success-border: rgba(0, 100, 0, 0.28);
    --success-text: #004d00;
    --danger: #d92d20;
    --warning: #b54708;

    /* Haas é proprietária — Inter é a fallback recomendada pelo spec Airtable */
    --font-ui: 'Inter', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif;
    --font-display: 'Inter', -apple-system, system-ui, 'Segoe UI', sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
    --font-serif: 'Inter', system-ui, serif;

    /* Airtable radius scale: 2px small, 12px buttons, 16-24px cards, 32px large */
    --radius-sm: 2px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 24px;
    --radius-pill: 9999px;

    --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
    --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

    /* Multi-layer blue-tinted shadow do Airtable */
    --shadow-product: rgba(0,0,0,0.32) 0px 0px 1px, rgba(0,0,0,0.08) 0px 0px 2px, rgba(45,127,249,0.28) 0px 1px 3px, rgba(0,0,0,0.06) 0px 0px 0px 0.5px inset;
    --shadow-soft: rgba(15, 48, 106, 0.05) 0px 0px 20px;

    --safe-top:    env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-left:   env(safe-area-inset-left, 0px);
    --safe-right:  env(safe-area-inset-right, 0px);
  }

  * { box-sizing: border-box; }

  body {
    background: var(--bg-base); color: var(--text-primary);
    font-family: var(--font-ui);
    font-size: 18px;
    line-height: 1.45;
    letter-spacing: -0.014em;
    font-weight: 400;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: 'kern' 1;
    overscroll-behavior-x: none;
    padding-top: env(safe-area-inset-top, 0);
  }

  /* Headlines — peso marca hierarquia (Figma usa display weight forte; UI compacta mantém 600) */
  h1, h2, h3, h4 {
    font-family: var(--font-display);
    font-weight: 600;
    letter-spacing: -0.022em;
    color: var(--text-primary);
  }

  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.32); }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes modalIn {
    from { opacity: 0; transform: scale(0.97) translateY(6px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes drawerIn {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 0 0 var(--accent-glow); }
    50%       { box-shadow: 0 0 0 6px var(--accent-glow); }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  /* A11Y — Focus rings globais. Pegando todos os elementos interativos que não
     tem ring explícito (botões inline com style={{ background:'none', border:'none' }}). */
  button:focus-visible,
  [role="button"]:focus-visible,
  a:focus-visible,
  [tabindex]:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 6px;
  }
  /* Inputs/textareas — focus já manipulado via box-shadow, mas garantia */
  input:focus-visible:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="range"]):not([type="file"]),
  textarea:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  /* A11Y — Reduced motion: respeita preferência do sistema (Mac/iOS/Windows).
     Reduz animações drasticamente sem desabilitá-las (mantém feedback de estado). */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 14px;
    background: transparent;
    outline: none;
    cursor: pointer;
    margin: 4px 0;
    background-image: linear-gradient(to right, var(--accent) 0%, var(--accent) var(--pct, 50%), var(--hairline) var(--pct, 50%), var(--hairline) 100%);
    background-repeat: no-repeat;
    background-size: 100% 2px;
    background-position: 0 50%;
    border-radius: 99px;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    transition: transform 0.15s var(--ease-smooth);
    box-shadow: 0 0 0 2px var(--bg-base);
    border: none;
  }
  input[type="range"]::-webkit-slider-thumb:active { transform: scale(0.95); }
  input[type="range"]::-moz-range-thumb {
    width: 16px; height: 16px; border-radius: 50%; background: var(--accent);
    border: 2px solid var(--bg-base);
  }
  @media (max-width: 767px) {
    input[type="range"] { height: 36px; touch-action: pan-x; min-height: 44px; }
    input[type="range"]::-webkit-slider-thumb { width: 22px; height: 22px; }
    input[type="range"]::-moz-range-thumb     { width: 22px; height: 22px; }
  }

  /* Sliders do painel escuro (tela cheia) — sky blue + anel legível */
  input[type="range"].vc-fs-pres-range::-webkit-slider-thumb {
    background: var(--accent-on-dark);
    box-shadow: 0 0 0 2px rgba(255,255,255,0.2);
  }
  input[type="range"].vc-fs-pres-range::-moz-range-thumb {
    background: var(--accent-on-dark);
    border: 2px solid rgba(255,255,255,0.22);
  }

  /* — Buttons (Figma DS: pill primário preto + capsule secundária) — */
  .vc-btn {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 8px; font-family: var(--font-ui); font-weight: 400;
    border-radius: 9999px; cursor: pointer;
    transition: background-color 0.15s var(--ease-smooth), color 0.15s var(--ease-smooth), opacity 0.15s, transform 0.1s var(--ease-smooth);
    border: none; outline: none; position: relative; overflow: hidden;
    letter-spacing: -0.022em;
    -webkit-tap-highlight-color: transparent;
  }
  .vc-btn:active { transform: scale(0.95); }
  .vc-btn:focus-visible { outline: 2px solid var(--accent-focus); outline-offset: 2px; }
  .vc-btn:disabled { opacity: 0.42; cursor: not-allowed; }

  /* Primary pill — preto / branco (DESIGN.md components.button-primary) */
  .vc-btn-primary {
    background: var(--accent); color: #fff;
    padding: 0 22px; height: 38px; font-size: 14px; font-weight: 400;
  }
  .vc-btn-primary:hover { background: var(--accent-hover); color: #fff; }

  /* Ghost capsule — pearl fill, soft ring */
  .vc-btn-ghost {
    background: var(--bg-pearl); color: var(--text-secondary);
    border: 1px solid var(--divider-soft);
    padding: 0 16px; height: 34px; font-size: 13px; font-weight: 400;
    border-radius: var(--radius-md);
  }
  .vc-btn-ghost:hover { color: var(--text-primary); background: #ebebeb; }

  /* Botão de ícone (close X de modal, controles minor) — touch target WCAG min 36px */
  .vc-icon-btn {
    background: none; border: none; cursor: pointer; color: var(--text-muted);
    min-width: 36px; min-height: 36px; padding: 8px; border-radius: 8px;
    display: inline-flex; align-items: center; justify-content: center;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
  }
  .vc-icon-btn:hover { color: var(--text-primary); background: rgba(0,0,0,0.06); }
  .vc-icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  /* Inputs — pill, white, hairline border */
  .vc-input {
    width: 100%; background: var(--bg-base); border: 1px solid var(--hairline);
    border-radius: 9999px; padding: 10px 18px; font-size: 14px;
    color: var(--text-primary); font-family: var(--font-ui);
    letter-spacing: -0.016em;
    outline: none; transition: border-color 0.15s, box-shadow 0.15s;
    -webkit-appearance: none; appearance: none;
  }
  .vc-input::placeholder { color: var(--text-muted); }
  .vc-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(255, 61, 139, 0.2); }
  @media (max-width: 767px) {
    .vc-input { font-size: 16px; padding: 12px 18px; }
  }

  .vc-textarea {
    resize: none; line-height: 1.45;
    border-radius: var(--radius-md);
    padding: 12px 16px;
  }

  /* Section labels — taxonomy mono. Polish: peso 600 (era 400) + traço mais
     presente (2px largo, 18px comprimento) + cor de texto secondary em
     hover/active pra dar respiro. */
  .section-label {
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-secondary);
    font-weight: 600;
    font-family: var(--font-mono);
    display: flex; align-items: center; gap: 10px;
  }
  .section-label::before {
    content: ''; display: block; width: 18px; height: 2px;
    background: var(--accent); border-radius: 2px;
    flex-shrink: 0;
  }

  /* Tab bar — grid 3-col × 2 rows. Active item ganha fundo + indicador
     accent à esquerda (em vez de underline bottom — funciona melhor em grid). */
  .tab-bar-item {
    padding: 11px 6px; font-size: 12px; font-weight: 500;
    letter-spacing: -0.014em; text-transform: none;
    font-family: var(--font-ui); cursor: pointer; border: none;
    background: transparent; display: flex; align-items: center;
    justify-content: center; gap: 6px; position: relative;
    transition: color 0.15s var(--ease-smooth), background-color 0.15s var(--ease-smooth);
    outline: none; color: var(--text-muted);
    min-height: 44px;
    border-right: 1px solid var(--hairline);
    border-bottom: 1px solid var(--hairline);
  }
  .tab-bar-item:nth-child(3n) { border-right: none; }
  .tab-bar-item:nth-last-child(-n+3) { border-bottom: none; }
  .tab-bar-item.active {
    color: var(--text-primary); font-weight: 600;
    background: var(--accent-surface);
  }
  .tab-bar-item.active::after {
    content: ''; position: absolute; bottom: 0; left: 14px; right: 14px;
    height: 2px; background: var(--accent); border-radius: 99px;
  }
  .tab-bar-item:hover:not(.active) {
    color: var(--text-secondary);
    background: var(--bg-pearl);
  }
  .tab-bar-item:focus-visible {
    outline: 2px solid var(--accent-focus, var(--accent));
    outline-offset: -2px;
    border-radius: 4px;
  }

  /* Slide thumbs — foco com anel de primário (--accent-focus) */
  .slide-thumb {
    position: relative; overflow: hidden; border-radius: 8px;
    transition: opacity 0.15s var(--ease-smooth), box-shadow 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth);
    cursor: pointer; flex-shrink: 0;
  }
  .slide-thumb.active { box-shadow: 0 0 0 2px var(--accent); }
  .slide-thumb:not(.active) { opacity: 0.5; }
  .slide-thumb:not(.active):hover { opacity: 0.9; }
  .slide-thumb:active { transform: scale(0.95); }

  .palette-swatch { transition: transform 0.1s var(--ease-smooth); border-radius: 8px; }
  .palette-swatch:hover { transform: scale(1.04); }
  .palette-swatch:active { transform: scale(0.95); }

  /* Cards — utility chassis: hairline border, lg radius Design System Figma */
  .idea-card {
    background: var(--bg-base); border: 1px solid var(--hairline);
    border-radius: var(--radius-lg); padding: 16px; text-align: left; cursor: pointer;
    transition: border-color 0.15s, background-color 0.15s, transform 0.1s var(--ease-smooth);
    display: block; width: 100%;
    color: var(--text-primary);
  }
  .idea-card:hover { border-color: var(--accent-secondary); background: var(--bg-pearl); }
  .idea-card:active { transform: scale(0.98); }

  .hook-row {
    display: flex; align-items: flex-start; gap: 12px;
    background: var(--bg-pearl); border: 1px solid var(--hairline);
    border-radius: var(--radius-md); padding: 12px 14px;
  }

  .empty-grid {
    background-image:
      linear-gradient(var(--border-muted) 1px, transparent 1px),
      linear-gradient(90deg, var(--border-muted) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  .shimmer-loading {
    background: linear-gradient(90deg, var(--bg-pearl) 25%, var(--bg-parchment) 50%, var(--bg-pearl) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  /* Floating sticky bar — pergamino + desfoque (token CSS --bg-parchment). */
  .export-fab {
    position: fixed; bottom: 24px; right: 20px; z-index: 50;
    background: rgba(245, 245, 247, 0.82);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    border: 1px solid var(--divider-soft);
    border-radius: 9999px; padding: 8px 12px 8px 18px;
    display: flex; align-items: center; gap: 12px;
    animation: slideUp 0.25s var(--ease-bounce);
    color: var(--text-primary);
  }

  /* Modals — frosted-glass overlay, parchment panel, no heavy chrome */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 50;
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    display: flex; align-items: flex-end; justify-content: center;
    animation: fadeIn 0.15s;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  @media (min-width: 640px) {
    .modal-overlay { align-items: center; padding: 16px; }
  }
  .modal-panel {
    background: var(--bg-base); border-top: 1px solid var(--hairline);
    width: 100%;
    /* iOS: descontar topo e base da safe area; svh evita cortar atrás da barra do Safari */
    max-height: calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 20px);
    overflow-y: auto; -webkit-overflow-scrolling: touch;
    animation: slideUp 0.2s var(--ease-smooth);
    border-top-left-radius: 18px; border-top-right-radius: 18px;
    padding-bottom: max(20px, calc(env(safe-area-inset-bottom, 0px) + 12px));
    color: var(--text-primary);
  }
  @supports (height: 100svh) {
    .modal-panel {
      max-height: calc(100svh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 16px);
    }
  }
  @media (min-width: 640px) {
    .modal-panel {
      border: 1px solid var(--hairline); border-radius: 18px;
      max-width: 480px; max-height: min(90vh, 900px);
      padding-bottom: 12px;
      animation: modalIn 0.2s var(--ease-smooth);
    }
  }
  /* Modal alto (ex.: Gerar): cabeçalho fixo + corpo com scroll — evita CTA escondido no mobile */
  .modal-panel.vc-modal-scroll {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding-bottom: 0;
  }
  .modal-panel.vc-modal-scroll .vc-modal-scroll-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    touch-action: pan-y;
  }
  .modal-panel-wide { max-width: 640px; }
  @media (max-width: 639px) {
    .modal-panel::before {
      content: ''; display: block; width: 36px; height: 4px;
      background: var(--hairline); border-radius: 99px;
      margin: 8px auto 0; flex-shrink: 0;
      position: sticky; top: 0;
    }
  }

  .error-toast {
    position: absolute; top: 60px; left: 50%; transform: translateX(-50%);
    z-index: 50; background: rgba(255, 59, 48, 0.95);
    color: #ffffff; font-size: 13px; padding: 10px 16px; border-radius: 11px;
    max-width: 90vw; display: flex; align-items: flex-start; gap: 8px;
    animation: fadeUp 0.2s;
    letter-spacing: -0.011em;
  }

  .toast-stack {
    position: fixed; top: 64px; left: 50%; transform: translateX(-50%);
    z-index: 60; display: flex; flex-direction: column; gap: 8px;
    width: min(420px, calc(100vw - 24px));
    pointer-events: none;
  }
  .toast-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 12px 16px; border-radius: 11px;
    font-size: 14px; font-family: var(--font-ui); font-weight: 400;
    letter-spacing: -0.016em;
    animation: fadeUp 0.18s var(--ease-smooth);
    pointer-events: auto;
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    border: 1px solid var(--divider-soft);
    line-height: 1.4;
  }
  .toast-item.toast-error  { background: rgba(255, 59, 48, 0.92);   color: #ffffff; border-color: transparent; }
  .toast-item.toast-success{ background: rgba(30, 166, 74, 0.92); color: #ffffff; border-color: transparent; }
  .toast-item.toast-info   { background: rgba(245, 245, 247, 0.92); color: var(--text-primary); }
  .toast-item button {
    background: none; border: none; cursor: pointer; color: inherit;
    opacity: 0.7; padding: 10px; flex-shrink: 0;
    min-width: 36px; min-height: 36px;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 6px;
  }
  .toast-item button:hover { opacity: 1; background: rgba(0,0,0,0.08); }

  .kbd {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 20px; height: 20px; padding: 0 6px;
    border-radius: 5px; background: var(--bg-pearl);
    border: 1px solid var(--hairline); color: var(--text-secondary);
    font-family: var(--font-mono); font-size: 11px; font-weight: 500;
  }

  /* Labels de formulário — Inter, sem caps forçadas — */
  .vc-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.011em;
    line-height: 1.29;
    margin-bottom: 8px;
    font-family: var(--font-ui);
    text-transform: none;
  }
  .vc-label-sm {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    letter-spacing: -0.011em;
    line-height: 1.29;
    margin-bottom: 6px;
    font-family: var(--font-ui);
    text-transform: none;
  }
  /* Eyebrow: small subtitle under modal headers, near-muted, non-caps */
  .vc-eyebrow {
    font-size: 13px;
    font-weight: 400;
    color: var(--text-muted);
    letter-spacing: -0.011em;
    margin-top: 2px;
    font-family: var(--font-ui);
    text-transform: none;
  }
  /* Meta caption — for slim labels next to numeric values, etc. Tight SF Pro, no caps. */
  .vc-meta {
    font-size: 12px;
    font-weight: 400;
    color: var(--text-muted);
    letter-spacing: -0.011em;
    font-family: var(--font-ui);
    text-transform: none;
  }

  /* Focus-visible: anel --accent-focus nos controlos interativos */
  button:focus-visible,
  [role="button"]:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--accent-focus);
    outline-offset: 2px;
    border-radius: inherit;
  }

  /* Respect users who request reduced motion */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  .vc-adjust-details > summary {
    list-style: none;
  }
  .vc-adjust-details > summary::-webkit-details-marker {
    display: none;
  }
`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const FORMATS = {
  carrossel: { w: 1080, h: 1350, label: 'Feed 4:5' },
  quadrado:  { w: 1080, h: 1080, label: 'Quadrado' },
  stories:   { w: 1080, h: 1920, label: 'Stories'  },
};

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

const PALETTES = [
  /** `subtitle`: cards do meio (linha curta sob o título) · `text`: corpo / blocos maiores · `accent`: Destaques. */
  { name:'Carbon',   bg:'#0a0a0a', title:'#ffffff', subtitle:'#e8e8e8', text:'#cfcfcf', accent:'#ff5736' },
  { name:'Midnight', bg:'#0c1220', title:'#ffffff', subtitle:'#dbeafe', text:'#b8c5d6', accent:'#6366f1' },
  { name:'Ivory',    bg:'#f5f1ea', title:'#0a0a0a', subtitle:'#3f3f46', text:'#52525b', accent:'#dc2626' },
  { name:'Forest',   bg:'#0d1f17', title:'#a3e635', subtitle:'#bef264', text:'#86efac', accent:'#a3e635' },
  { name:'Coral',    bg:'#1c0f0f', title:'#ff6b4a', subtitle:'#e8dcd8', text:'#e8b4b4', accent:'#ff5736' },
  { name:'Royal',    bg:'#1e1b4b', title:'#fde047', subtitle:'#eef0ff', text:'#c7d2fe', accent:'#fcd34d' },
  { name:'Mono',     bg:'#171717', title:'#fafafa', subtitle:'#e5e5e5', text:'#c8c8c8', accent:'#ffffff' },
  { name:'Cream',    bg:'#fef9e7', title:'#1a1a1a', subtitle:'#57534e', text:'#78716c', accent:'#b45309' },
  /* Neutro institucional — alinhado ao DEFAULT_BRAND e ao token --accent; índice fixo no final pra não quebrar templates (palette: 0–7). */
  { name:'Pearl',    bg:'#fafafc', title:'#000000', subtitle:'#363636', text:'#363636', accent:'#000000' },
];

/** Converte `#RGB`/`#RRGGBB`; retorna `{r,g,b}` ou null */
function vcHexToRgb(hex) {
  let s = String(hex || '').replace('#', '').trim();
  if (!s || (s.length !== 3 && s.length !== 6)) return null;
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = Number.parseInt(s, 16);
  if (!Number.isFinite(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function vcNormalizeHex(hex) {
  const rgb = vcHexToRgb(hex);
  if (!rgb) return null;
  return `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;
}

function vcRelLuminance01(rgb) {
  const chan = (c) => {
    const x = (c ?? 0) / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const r = chan(rgb.r);
  const g = chan(rgb.g);
  const b = chan(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
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

/**
 * Cores de texto / destaque a partir da luminância REAL do fundo do card Cultura/Tendência.
 * O modo «par/ímpar» (surface light/dark) não garante fundo claro em «light» quando `brand.bg` é cinza‑carvão —
 * antes aplicava‑se texto #515154 e sumia no fundo escuro.
 */
function cultureReadableInks(bgSolidHex, carouselTitleInk, carouselBodyInk, brandAccentHex) {
  const fb = vcNormalizeHex(bgSolidHex);
  const rgb = fb ? vcHexToRgb(fb) : null;
  const L = rgb ? vcRelLuminance01(rgb) : 0.35;
  const accentStr = typeof brandAccentHex === 'string' ? brandAccentHex.trim() : '';
  const accentHex = accentStr || '#000000';

  const darkBG = L <= 0.45;
  const lightBG = L >= 0.58;

  if (darkBG) {
    const aRgb = vcHexToRgb(vcNormalizeHex(accentHex) || '#000000');
    const aL = aRgb ? vcRelLuminance01(aRgb) : 0;
    const accentInk = !aRgb || aL < 0.42 ? '#dceeb1' : accentHex;
    return {
      titleInk: '#f5f5f7',
      subtitleInk: 'rgba(245,245,247,0.9)',
      bodyInk: 'rgba(245,245,247,0.82)',
      inkMuted: 'rgba(245,245,247,0.54)',
      accentInk,
      solidBgIsLight: false,
    };
  }
  if (lightBG) {
    return {
      titleInk: carouselTitleInk,
      subtitleInk: carouselBodyInk,
      bodyInk: carouselBodyInk,
      inkMuted: 'rgba(29,29,31,0.48)',
      accentInk: accentHex,
      solidBgIsLight: true,
    };
  }
  /* Fundos de luminância intermédia (ex.: acento saturado) — texto sempre claro + destaque pastel Figma */
  return {
    titleInk: '#ffffff',
    subtitleInk: 'rgba(255,255,255,0.92)',
    bodyInk: 'rgba(255,255,255,0.82)',
    inkMuted: 'rgba(255,255,255,0.62)',
    accentInk: '#dceeb1',
    solidBgIsLight: false,
  };
}

/** Normaliza marca: campo legado `subColor` migra para `textColor` e `subtitleColor` quando omitidos; remove `subColor` gravado para evitar duplicidade. */
function hydrateBrandTextColors(b) {
  if (!b || typeof b !== 'object') return b;
  const legacySub =
    typeof b.subColor === 'string' && b.subColor.trim() ? String(b.subColor).trim() : '';
  const textRaw = typeof b.textColor === 'string' && b.textColor.trim() ? String(b.textColor).trim() : '';
  const subLineRaw =
    typeof b.subtitleColor === 'string' && b.subtitleColor.trim()
      ? String(b.subtitleColor).trim()
      : '';
  const textColor = textRaw || legacySub || '#515154';
  const subtitleColor = subLineRaw || legacySub || textColor;
  const { subColor: _, ...rest } = b;
  return { ...rest, textColor, subtitleColor };
}

function brandMatchesPalette(brand, p) {
  if (!brand || !p) return false;
  const h = hydrateBrandTextColors(brand);
  const nb = vcNormalizeHex(h.bg);
  const nt = vcNormalizeHex(h.titleColor);
  const nSub = vcNormalizeHex(h.subtitleColor);
  const nTx = vcNormalizeHex(h.textColor);
  const na = vcNormalizeHex(h.accent);
  return !!(
    nb &&
    nt &&
    nSub &&
    nTx &&
    na &&
    nb === vcNormalizeHex(p.bg) &&
    nt === vcNormalizeHex(p.title) &&
    nSub === vcNormalizeHex(p.subtitle) &&
    nTx === vcNormalizeHex(p.text) &&
    na === vcNormalizeHex(p.accent)
  );
}

// Fontes para títulos — agrupadas por categoria pra UI navegável.
// `cat`: 'sans' | 'display' | 'serif' | 'editorial' | 'mono'
const TITLE_FONTS = [
  // Sans modern (default e variantes próximas)
  { name:'Outfit',         val:'"Outfit", sans-serif',                cat:'sans' },
  { name:'Inter Tight',    val:'"Inter Tight", sans-serif',           cat:'sans' },
  { name:'Inter',          val:'"Inter", sans-serif',                 cat:'sans' },
  { name:'Space Grotesk',  val:'"Space Grotesk", sans-serif',         cat:'sans' },
  { name:'DM Sans',        val:'"DM Sans", sans-serif',               cat:'sans' },
  { name:'Manrope',        val:'"Manrope", sans-serif',               cat:'sans' },
  { name:'Sora',           val:'"Sora", sans-serif',                  cat:'sans' },
  { name:'Plus Jakarta',   val:'"Plus Jakarta Sans", sans-serif',     cat:'sans' },
  { name:'Familjen',       val:'"Familjen Grotesk", sans-serif',      cat:'sans' },
  { name:'Bricolage',      val:'"Bricolage Grotesque", sans-serif',   cat:'sans' },
  { name:'Funnel',         val:'"Funnel Display", sans-serif',        cat:'sans' },
  // Display (impacto, headlines bombásticos)
  { name:'Bebas Neue',     val:'"Bebas Neue", sans-serif',            cat:'display' },
  { name:'Anton',          val:'"Anton", sans-serif',                 cat:'display' },
  { name:'Oswald',          val:'"Oswald", sans-serif',                cat:'display' },
  { name:'Archivo Black',  val:'"Archivo Black", sans-serif',         cat:'display' },
  { name:'Big Shoulders',  val:'"Big Shoulders Display", sans-serif', cat:'display' },
  { name:'Syne',           val:'"Syne", sans-serif',                  cat:'display' },
  { name:'Unbounded',      val:'"Unbounded", sans-serif',             cat:'display' },
  // Serif (autoridade, editorial)
  { name:'Playfair',       val:'"Playfair Display", serif',           cat:'serif' },
  { name:'Fraunces',       val:'"Fraunces", serif',                   cat:'serif' },
  { name:'Cormorant',      val:'"Cormorant Garamond", serif',         cat:'serif' },
  { name:'EB Garamond',    val:'"EB Garamond", serif',                cat:'serif' },
  { name:'Spectral',       val:'"Spectral", serif',                   cat:'serif' },
  { name:'Yeseva',         val:'"Yeseva One", serif',                 cat:'serif' },
  { name:'Italiana',       val:'"Italiana", serif',                   cat:'serif' },
  { name:'Caslon',         val:'"Libre Caslon Display", serif',       cat:'serif' },
  // Editorial / Mono
  { name:'Instrument',     val:'"Instrument Serif", serif',           cat:'editorial' },
  { name:'Major Mono',     val:'"Major Mono Display", monospace',     cat:'mono' },
];

// Fontes para corpo — leitura, peso menor, mais legíveis
const BODY_FONTS = [
  { name:'Inter Tight',   val:'"Inter Tight", sans-serif',   cat:'sans' },
  { name:'Inter',         val:'"Inter", sans-serif',         cat:'sans' },
  { name:'DM Sans',       val:'"DM Sans", sans-serif',       cat:'sans' },
  { name:'Space Grotesk', val:'"Space Grotesk", sans-serif', cat:'sans' },
  { name:'Manrope',       val:'"Manrope", sans-serif',       cat:'sans' },
  { name:'Sora',          val:'"Sora", sans-serif',          cat:'sans' },
  { name:'Outfit',        val:'"Outfit", sans-serif',        cat:'sans' },
  { name:'Plus Jakarta',  val:'"Plus Jakarta Sans", sans-serif', cat:'sans' },
  { name:'IBM Plex',      val:'"IBM Plex Sans", sans-serif', cat:'sans' },
  { name:'Source Sans',   val:'"Source Sans 3", sans-serif', cat:'sans' },
  { name:'Raleway',       val:'"Raleway", sans-serif',       cat:'sans' },
  { name:'Poppins',       val:'"Poppins", sans-serif',       cat:'sans' },
  { name:'Familjen',      val:'"Familjen Grotesk", sans-serif', cat:'sans' },
  // Serif body (estilo magazine)
  { name:'EB Garamond',   val:'"EB Garamond", serif',        cat:'serif' },
  { name:'Crimson',       val:'"Crimson Text", serif',       cat:'serif' },
  { name:'Spectral',      val:'"Spectral", serif',           cat:'serif' },
  { name:'Fraunces',      val:'"Fraunces", serif',           cat:'serif' },
  // Mono
  { name:'Space Mono',    val:'"Space Mono", monospace',     cat:'mono' },
  { name:'IBM Plex Mono', val:'"IBM Plex Mono", monospace',  cat:'mono' },
];

/** Faces CSS únicas por perfil de marca (evita colisão entre perfis e Google Fonts). */
const vcCustomTitleFace = (brandId) => `VCBrandTitle-${brandId || 'default'}`;
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

/** Fonte carregada primeiro; a lista Google abaixo é reserva (fallback). */
function effectiveTitleFontFamily(brand) {
  if (!brand) return '"Inter", sans-serif';
  return brand.customTitleFont?.dataUrl
    ? `${vcCustomTitleFace(brand.id)}, ${brand.titleFont}`
    : brand.titleFont;
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

/** Preferência ao gerar / novo slide: só 4 modos clássicos (sem faixa fina). */
const CARD_VISUAL_STYLE_IDS = new Set(['full', 'inset_h_top', 'inset_h_middle', 'inset_h_bottom']);

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

const BG_PATTERN_IDS = new Set(['none', 'grid', 'dots', 'hlines', 'dlines', 'diag_grid']);

const BG_PATTERN_OPTIONS = [
  { id: 'none', label: 'Nenhum' },
  { id: 'grid', label: 'Grade (quadriculado)' },
  { id: 'dots', label: 'Bolinhas' },
  { id: 'hlines', label: 'Linhas horizontais' },
  { id: 'dlines', label: 'Linhas diagonais' },
  { id: 'diag_grid', label: 'Xadrez diagonal' },
];

function vcBgPatternDivStyle(pattern) {
  if (!pattern || pattern === 'none') return null;
  const a = 'rgba(128,128,128,0.16)';
  const b = 'rgba(128,128,128,0.09)';
  switch (pattern) {
    case 'grid':
      return {
        backgroundImage: `linear-gradient(${a} 1px, transparent 1px), linear-gradient(90deg, ${a} 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
      };
    case 'dots':
      return {
        backgroundImage: `radial-gradient(circle, ${a} 1px, transparent 1.5px)`,
        backgroundSize: '14px 14px',
      };
    case 'hlines':
      return {
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 8px, ${a} 8px, ${a} 9px)`,
      };
    case 'dlines':
      return {
        backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 6px, ${b} 6px, ${b} 7px)`,
      };
    case 'diag_grid':
      return {
        backgroundImage: `
          repeating-linear-gradient(45deg, transparent, transparent 9px, ${b} 9px, ${b} 10px),
          repeating-linear-gradient(-45deg, transparent, transparent 9px, ${b} 9px, ${b} 10px)`,
      };
    default:
      return null;
  }
}

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
// Cada modo substitui a seção MÉTODO no prompt. Todos devem escalar ao número
// de slides pedido (hook → meio(s) → fecho), sem assumir sempre 5 slides no miolo.
const GEN_MODES = [
  {
    id: 'editorial',
    Icon: Newspaper,
    label: 'Editorial',
    desc: 'Tese forte, camadas de mercado e leitura que desmonta o óbvio',
    method: `MÉTODO EDITORIAL — leitura estratégica (escala ao número total de slides):
Objetivo: soar como análise de quem enxerga categoria, não como post motivacional.
- Slide 1 · HOOK/Tese: uma frase-tese contraintuitiva que para o scroll. Formatos úteis: "X não está fazendo Y, está fazendo Z.", "Não é sobre X. É sobre Y.", "Todo mundo viu X. Pouca gente entendeu Y.", "O mercado de X deixou de ser sobre Y. Agora é sobre Z."
- Slides do meio (2 até penúltimo): cada um = UMA camada nova — sem repetir o mesmo tipo de argumento. Ordens possíveis (combine conforme N): contexto de mercado → onde a leitura óbvia quebra → mecanismo ou estrutura por trás → impacto na categoria ou no consumidor → erro recorrente → contraste com o que "todo mundo faz". Vocabulário útil quando couber: categoria, distribuição, posicionamento, percepção, comportamento, recorrência, narrativa (da categoria), repertório, diferenciação, sinal, confiança.
- Último slide · Fecho: elegante, reflexivo (não obrigatoriamente "ganhe dinheiro"). Ex.: "Quem entende isso constrói marca. Quem ignora disputa preço." / "Salve antes da próxima campanha."
EVITE: tom de guru, frase vazia de inspiração, repetir "insights" genéricos em vários slides.`,
  },
  {
    id: 'deep',
    Icon: Brain,
    label: 'Profundo',
    desc: 'Autopsia do tema — variáveis, padrão escondido, o que muda na prática',
    method: `MÉTODO PROFUNDO — anatomia do fenômeno (modo "patologista"; escala ao N de slides):
Disseque o tema: variáveis, padrões, hipóteses testáveis. Zero "seja autêntico", zero conselho genérico.
- Slide 1 · HOOK: tese contraintuitiva que expõe um padrão escondido. Ex.: "Não existe X. Existe Y." / "Todo mundo mede X. O que importa é Y." / "X não é o problema. É sintoma."
- Slides do meio — distribua estas ETAPAS ao longo dos slides 2…penúltimo (se N for pequeno, una etapas adjacentes; se N for grande, detalhe mais dentro da mesma etapa):
  (A) AUTÓPSIA — o que acontece por dentro do fenômeno (mecanismo, não aparência): gatilho, fricção, atrito, sinal, ciclo, dependência.
  (B) PADRÃO OCULTO — princípio que conecta casos visíveis; nomeie o que se repete.
  (C) DEMONSTRAÇÃO — um caso onde o padrão aparece em ação.
  (D) IMPLICAÇÃO — o que muda na decisão ou na leitura quando você enxerga isso.
- Último slide · CTA: reflexivo, sem urgência falsa. Ex.: "Quem enxerga padrão vence quem corre atrás de truque."
Vocabulário preferido: mecanismo, gatilho, sinal, distribuição, comportamento, recorrência, fricção, antecipação, hipótese, variável, sistema. EVITE: hack, segredo, fórmula mágica.`,
  },
  {
    id: 'pain',
    Icon: HeartHandshake,
    label: 'Odisseia da Dor',
    desc: 'Nomeia a dor, valida, mostra o que falhou e uma saída honesta',
    method: `MÉTODO ODISSEIA DA DOR — jornada empática (escala ao N de slides):
Escreva para quem sofre com o tema agora. Nomear, validar, expor o ciclo, apontar direção pequena e real — não promessa. Tom sóbrio e perto; ZERO "você consegue", ZERO performance coaching.
- Slide 1 · IDENTIFICAÇÃO: o sentimento que o leitor mal consegue nomear — preciso o suficiente para ele pensar "sou eu". Ex.: "Você fez tudo certo. E ainda assim travou." / "Você não está cansado. Está exausto de fingir que está bem."
- Slides do meio — distribua ao longo de 2…penúltimo:
  VALIDAÇÃO (detalhes sensoriais e situações concretas da dor),
  FALSO REMÉDIO (o que tentaram e por que não segurou — sem julgar),
  RAIZ (mecanismo; sintoma vs causa — o que muda a autoimagem),
  SAÍDA (ângulo honesto e possível hoje — não milagre).
Se poucos slides: priorize validação → raiz → saída.
- Último slide: convite gentil. Ex.: "Salve pra reler quando o ciclo voltar." / pergunta nos comentários qual frase doeu primeiro.
Vocabulário: ciclo, raiz, sintoma, exaustão, repetição, pausa, presença. EVITE: jornada, mindset, foco, você nasceu pra isso.`,
  },
  {
    id: 'viral',
    Icon: TrendingUp,
    label: 'Viral Trends',
    desc: 'Parada de scroll, loop de tensão, prova e frase para guardar ou mandar',
    method: `MÉTODO VIRAL TRENDS — retenção e clareza algorítmica (escala ao N de slides):
Cada slide tem função para segurar o dedo e completar o arco. 90% morre no slide 1 — o hook decide tudo.
- Slide 1 · PARADA DE SCROLL (≤0,5s): UMA técnica abaixo. PROIBIDO abrir com "Hoje vou te ensinar", "Você sabia que", "5 dicas infalíveis".
  • INTERRUPÇÃO — contraria a expectativa do nicho.
  • PROMESSA NUMÉRICA específica — "3 decisões que mudam [X] em [prazo]."
  • REVELAÇÃO ATRASADA — resultado primeiro, causa depois.
  • IDENTIFICAÇÃO brutal — "isso sou eu."
  • PERGUNTA que tira sono — a dúvida às 2h.
- Slides do meio — distribua funções (repetir ou expandir se N for grande):
  BUILD-UP (abre loop; atrasa resposta),
  DESENVOLVIMENTO (prova parcial, autoridade rápida sem paper acadêmico),
  SHARE-TRIGGER (uma frase quotável memorável),
  PAYOFF (fecha o loop — o "ahá").
- Último slide: pergunta real nos comentários OU save com motivo concreto. EVITE: "segue pra mais", "marca o amigo", "compartilha se gostou".
Tom: curto, rápido, confiante; urgência sem sensacionalismo.`,
  },
  {
    id: 'storytelling',
    Icon: BookOpen,
    label: 'Storytelling',
    desc: 'História com arco — cena, tempo e virada (não headline de pitch)',
    method: `MÉTODO STORYTELLING — narrativa em cena (escala ao N de slides):
Conte uma história sobre o tema; não explique em modo manual. Cenas com tempo, lugar, gesto, detalhe verificável. Evite título conceitual genérico ("X: uma reflexão") no lugar de imagem viva.
- Slide 1 · IN MEDIAS RES: entre no meio da ação. Ex.: "Era 23h e ela releu o e-mail pela quinta vez." / "O cliente desligou antes da segunda frase."
- Slides do meio — distribua ao longo de 2…penúltimo:
  CONTEXTO (o que estava em jogo; sensorial),
  VIRADA (um evento concreto que muda tudo — número, fala, objeto),
  CONSEQUÊNCIA (como fica o mundo depois),
  e se couber GENERALIZAÇÃO leve (o que isso significa além deste caso) — antes do fecho.
Se poucos slides: contexto → virada → consequência.
- Último slide: convite a partilhar experiência. Ex.: "Já te aconteceu algo assim?" / "Qual foi teu '23h' com [tema]?"
Use verbos no passado/presente; EVITE "muitas pessoas", "em geral", gerúndio em excesso.`,
  },
  {
    id: 'how_to',
    Icon: GraduationCap,
    label: 'Passo-a-passo',
    desc: 'Manual — um passo por slide, imperativo e verificável',
    method: `MÉTODO PASSO-A-PASSO — tutorial replicável (escala ao N de slides):
Sem palestra motivacional. O leitor deve sair sabendo o que fazer na ordem certa.
- Slide 1 · PROMESSA: deixe explícito resultado + número de passos (alinhado ao total de slides intermediários). Ex.: "Como [resultado] em [K] passos."
- Slides do meio (2 até penúltimo): UM PASSO POR SLIDE, numerados em sequência real (Passo 1… Passo K). Em cada um:
  • TÍTULO: "Passo N · [verbo + objeto]" (nome curto e ativo).
  • SUBTÍTULO: (1) imperativo do que fazer; (2) como fazer com precisão; (3) erro comum OU mini-exemplo.
  Linguagem imperativa: "Identifique…", "Anote…", "Compare…" — evite "é importante que você…".
- Penúltimo slide (se K≥2): o ERRO que faz a maioria falhar mesmo seguindo o roteiro — específico ao tema.
- Último slide: save com utilidade + pergunta sobre qual passo testar primeiro.
Se houver mais slides que passos necessários: acrescente slide de checklist rápido ou variação do passo mais crítico — não encha com teoria.`,
  },
  {
    id: 'jornalistico',
    Icon: ScrollText,
    label: 'Jornalístico',
    desc: 'Fio tipo capa digital: selo de editoria, manchete e texto em pirâmide invertida',
    method: `MÉTODO JORNALÍSTICO — fio editorial / digital first (escala ao N de slides):
Soar como postagem de veículo sério ou newsletter de analítico — não viral barulhento nem pitch de marca.
- Slide 1 · CAPA: hierarquia de três camadas quando couber ao formato do JSON (use título e subtítulo de forma criativa para isso):
  (A) SELO/CATEGORIA — uma linha curta em tom de editoria em CAIXA ALTA OU caixa alta suave (ex.: "ANÁLISE", "MERCADO", "[NICHO]").
  (B) MANCHETE — frase forte, pode ser maior e mais objetiva que um hook meme; até ~12 palavras se precisar densidade.
  (C) LEAD/NUT — 1 linha ou 2 máximas: o "por que importa agora", factual e direto — sem perguntinha vazia.
- Slides do meio (2…penúltimo): cada um como BLOCO DE MATÉRIA — parágrafos curtos (estilo pirâmide invertida: fato/implicação → contexto → detalhe). Um slide = uma peça da história ou um ângulo novo (who/what/when/why/so what). Vocabulário: fonte implícita, consequência, precedente, cenário — sem jargão de guru.
- Último slide · FECHO: linha-editorial ou o que falta saber próximo — convite sóbrio (pergunta precisa ou "salve para acompanhar").
EVITE: "X mudou tudo" sem nuance; clickbait que o miolo não sustenta; tom de relatório institucional de marca.`,
  },
  {
    id: 'sensacionalista',
    Icon: Megaphone,
    label: 'Sensacionalista',
    desc: 'Ganchos tipo tablóide, tensão extrema e viradas — sem mentir nem prometer miragem',
    method: `MÉTODO SENSACIONALISTA — alto impacto, tom de tablóide moderno (escala ao N de slides):
Máximo drama na forma, honestidade no conteúdo: pode exagerar RITMO e TENSÃO lexical, não fatos nem promessas.
- Slide 1 · BERRANTE CONTROLADO — UMA destas âncoras (troque conforme tema):
  • REVELAÇÃO com custo ("O que ninguém te contou sobre [X]").
  • NÚMERO ou prazo espremido ("3 dias de [cenário] e já dá pra ver…").
  • PERGUNTA que arranha ("Por que [grupo] ainda acredita em [Y]?").
  PROIBIDO: "chocante!", "você não vai acreditar" vazio, ou prometer prova que o carrossel não entrega.
- Slides do meio — distribua tensão máxima: cada slide abre novo micro-gancho OU fecha um aberto antes; uso de cortes curtos, frases de efeito, contraste visceral ("parecia X / era Y"). Um slide deve ter a frase "compartilhável" de choque sóbrio quando houver espaço — não vulgaridade gratuita.
- Último slide: payoff real (o que ficou provado neste carrossel) + pergunta inflamável NOS FATOS OU save — sem arme-se sem fechar o arco.
Tom: urgência, segunda pessoa só quando intensificar impacto — sem moralismo.`,
  },
];
const GEN_MODE_BY_ID = Object.fromEntries(GEN_MODES.map(m => [m.id, m]));

/** Perfis de referência (curadoria): inspiram tom/ritmo na IA — não são scraping nem cópia de conteúdo. */
const REFERENCE_PROFILES = [
  {
    id: 'micro_br',
    label: 'Microcriador BR',
    desc: 'Curto, conversa de DM, comunidade.',
    promptBlock:
      'Tom de referência: microcriador BR — frases curtas, ritmo de conversa direta, zero corporativês, convite honesto ao comentário; uma ideia forte por slide; gíria leve só quando soa natural.',
  },
  {
    id: 'editorial_mag',
    label: 'Editorial premium',
    desc: 'Analítico, fôlego de revista.',
    promptBlock:
      'Tom de referência: editorial premium — vocabulário de mercado e cultura, síntese elegante, zero senso comum motivacional; tensão intelectual em vez de urgência vazia.',
  },
  {
    id: 'tech_didactic',
    label: 'Tech didático',
    desc: 'Claro, estruturado, sem jargon.',
    promptBlock:
      'Tom de referência: tech didático — explica mecanismo antes do hype, analogias cotidianas, imperativo limpo; sem buzzwords vazias (growth, escala, mindset).',
  },
  {
    id: 'coach_sober',
    label: 'Coach sóbrio',
    desc: 'Direto, adulto, sem lamúria.',
    promptBlock:
      'Tom de referência: coach sóbrio — confronto respeitoso, responsabilização adulta, zero frases de autoajuda; foco em decisão e consequência.',
  },
  {
    id: 'esthetic_clinic',
    label: 'Clínica / estética',
    desc: 'Confiança, precisão, acolhimento.',
    promptBlock:
      'Tom de referência: comunicação clínica premium — precisão sem alarmismo, acolhimento sem infantilizar; educação antes da venda.',
  },
  {
    id: 'finance_pop',
    label: 'Finanças pop BR',
    desc: 'Acessível, dados, sem pirâmide.',
    promptBlock:
      'Tom de referência: finanças para leigo BR — dados e exemplos em reais, antídoto a promessa rápida; clareza sobre risco e trade-off.',
  },
  {
    id: 'story_scene',
    label: 'Storytelling em cena',
    desc: 'Cenas, tempo, sensação.',
    promptBlock:
      'Tom de referência: storytelling em microcenas — tempo ("23h"), lugar, gesto; tensão narrativa; zero moral óbvia no último slide.',
  },
  {
    id: 'provocative_hook',
    label: 'Gancho provocador',
    desc: 'Contraintuitivo, debate nos comentários.',
    promptBlock:
      'Tom de referência: gancho provocador — tese que divide sala de aula; convite ao debate nos comentários sem clickbait desonesto.',
  },
];
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

// Templates: carrosséis prontos para começar rápido
const TEMPLATES = [
  {
    id: 'erro_comum',
    name: 'Erro Comum',
    desc: 'Quebra de leitura óbvia em qualquer nicho',
    palette: 0, titleFont: 0, bodyFont: 1,
    slides: [
      { title:'Você está fazendo errado.', subtitle:'O que parece técnica é, na verdade, sintoma de outra coisa.', q:'cinematic dark portrait moody' },
      { title:'A leitura óbvia.', subtitle:'O mercado vê o problema na superfície. Resolve só o que aparece.', q:'urban street night blur cinematic' },
      { title:'O mecanismo oculto.', subtitle:'O verdadeiro motor está duas camadas atrás. Quem enxerga, antecipa.', q:'minimal dark office abstract' },
      { title:'Quem entende, lidera.', subtitle:'Quem ignora, disputa preço. A diferença é estrutural.', q:'executive boardroom dark cinematic' },
      { title:'Salve para revisar.', subtitle:'Antes da sua próxima decisão estratégica.', q:'minimal abstract dark texture' },
    ],
  },
  {
    id: 'tendencia',
    name: 'Tendência de Mercado',
    desc: 'Antecipa um movimento que ninguém viu',
    palette: 1, titleFont: 2, bodyFont: 0,
    slides: [
      { title:'O mercado está mudando.', subtitle:'E quase ninguém percebeu para onde.', q:'futuristic city night blue' },
      { title:'O sinal antigo.', subtitle:'O que funcionava em 2023 já não move ponteiro.', q:'old technology vintage office' },
      { title:'O sinal novo.', subtitle:'Categoria, percepção e narrativa migraram. Quem leu, posicionou.', q:'modern minimal workspace blue' },
      { title:'O próximo diferencial.', subtitle:'Será de quem traduzir essa mudança em comportamento e produto.', q:'cinematic boardroom future' },
      { title:'Comente: você já viu?', subtitle:'Quero entender se isso bate com seu mercado.', q:'minimal abstract blue gradient' },
    ],
  },
  {
    id: 'decodificacao',
    name: 'Decodificação de Marca',
    desc: 'Por que uma marca está vencendo',
    palette: 2, titleFont: 5, bodyFont: 2,
    slides: [
      { title:'Por que essa marca vence.', subtitle:'Não é o produto. Não é o preço. Não é o canal.', q:'luxury retail store minimal' },
      { title:'O que parece ser.', subtitle:'Marketing bonito. Identidade visual forte. Bom storytelling.', q:'creative studio bright minimal' },
      { title:'O que realmente é.', subtitle:'Coerência radical entre promessa, repertório e comportamento.', q:'designer working desk minimal' },
      { title:'A lição replicável.', subtitle:'Marcas vencem quando deixam de explicar e passam a representar.', q:'minimal interior design cream' },
      { title:'Salve antes da próxima decisão.', subtitle:'De marca, posicionamento ou campanha.', q:'minimal cream abstract' },
    ],
  },
  {
    id: 'comportamento',
    name: 'Mudança de Comportamento',
    desc: 'Como o público mudou de verdade',
    palette: 3, titleFont: 6, bodyFont: 0,
    slides: [
      { title:'O público não é mais o mesmo.', subtitle:'E quase nenhuma marca atualizou a leitura.', q:'people crowd diverse modern' },
      { title:'O que ele dizia querer.', subtitle:'Conveniência, preço, rapidez. Era só a camada de cima.', q:'shopping mall busy people' },
      { title:'O que ele realmente quer.', subtitle:'Pertencimento, repertório e signo de identidade.', q:'community gathering authentic' },
      { title:'Como traduzir isso.', subtitle:'Em produto, narrativa e canal — sem teatralizar.', q:'authentic portrait natural light' },
      { title:'Quem entender, ganha relevância.', subtitle:'Quem ignorar, perde atenção primeiro, receita depois.', q:'minimal green nature abstract' },
    ],
  },
];

/** Modo narrativo interno por arquétipo (template) — utilizador não escolhe (só em Personalizado). */
const QUICK_TEMPLATE_NARRATIVE_MODE = {
  erro_comum: 'editorial',
  tendencia: 'editorial',
  decodificacao: 'deep',
  comportamento: 'storytelling',
};

function quickTemplateIdFromPreset(presetId) {
  if (presetId == null || typeof presetId !== 'string') return null;
  if (!presetId.startsWith('quick_')) return null;
  const tid = presetId.slice('quick_'.length);
  return TEMPLATES.some((t) => t.id === tid) ? tid : null;
}

function isQuickTemplatePreset(presetId) {
  return quickTemplateIdFromPreset(presetId) != null;
}

/** Entradas «Carbon / Midnight …» no seletor de pacote — mesmos arquétipos que Templates prontos. */
const QUICK_TEMPLATE_CREATIVE_PRESET_ENTRIES = TEMPLATES.map((t) => {
  const pal = PALETTES[t.palette] || PALETTES[0];
  return {
    id: `quick_${t.id}`,
    label: t.name,
    desc: `${t.desc} · Paleta ${pal.name} · arco fixo (sem modo narrativo, nicho ou público — como Templates prontos).`,
  };
});

// ─── UTILS ────────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

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

const VC_BG_SAVE_MAX_PX = 1536;
const VC_BG_SAVE_JPEG_Q = 0.88;
/** Só comprime fotos base64 «pesadas» — HEIC do iPhone passa quase sempre. */
const VC_BG_COMPRESS_MIN_CHARS = 380_000;

/** Redimensiona/recomprime data URLs de fundo antes de meter no localStorage (alivia quota). */
function vcShrinkDataUrlForStorage(dataUrl) {
  return new Promise((resolve) => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl);
      return;
    }
    if (dataUrl.length < VC_BG_COMPRESS_MIN_CHARS) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          resolve(dataUrl);
          return;
        }
        const fac = VC_BG_SAVE_MAX_PX / Math.max(w, h);
        const scale = fac < 1 ? fac : 1;
        const nw = Math.max(2, Math.round(w * scale));
        const nh = Math.max(2, Math.round(h * scale));
        const c = document.createElement('canvas');
        c.width = nw;
        c.height = nh;
        const ctx = c.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, nw, nh);
        const jpeg = c.toDataURL('image/jpeg', VC_BG_SAVE_JPEG_Q);
        resolve(jpeg.length < dataUrl.length ? jpeg : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Importação de ficheiro → JPEG (~max VC_BG_SAVE_MAX_PX).
 * Ordem: createImageBitmap (melhor com Blob/File) → Image + object URL → FileReader + shrink.
 * Evita depender só de data URLs gigantes no Image (Safari/iOS) e cobre browsers sem createObjectURL estável.
 */
function vcImageFileToStorageDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve('');
      return;
    }

    let settled = false;
    const finish = (url) => {
      if (settled) return;
      settled = true;
      resolve(typeof url === 'string' && url.length >= 32 ? url : '');
    };

    const tryDataUrlFallback = () => {
      const reader = new FileReader();
      reader.onload = () => {
        void vcShrinkDataUrlForStorage(String(reader.result || '')).then((url) =>
          finish(url),
        );
      };
      reader.onerror = () => finish('');
      reader.readAsDataURL(file);
    };

    const encodeFromWidthHeight = (drawable, w, h, closeFn) => {
      try {
        if (!w || !h) {
          closeFn?.();
          tryDataUrlFallback();
          return;
        }
        const fac = VC_BG_SAVE_MAX_PX / Math.max(w, h);
        const scale = fac < 1 ? fac : 1;
        const nw = Math.max(2, Math.round(w * scale));
        const nh = Math.max(2, Math.round(h * scale));
        const c = document.createElement('canvas');
        c.width = nw;
        c.height = nh;
        const ctx = c.getContext('2d');
        if (!ctx) {
          closeFn?.();
          tryDataUrlFallback();
          return;
        }
        ctx.drawImage(drawable, 0, 0, w, h, 0, 0, nw, nh);
        closeFn?.();
        const jpeg = c.toDataURL('image/jpeg', VC_BG_SAVE_JPEG_Q);
        if (typeof jpeg === 'string' && jpeg.startsWith('data:') && jpeg.length >= 32) {
          finish(jpeg);
          return;
        }
        tryDataUrlFallback();
      } catch {
        try {
          closeFn?.();
        } catch {
          /* */
        }
        tryDataUrlFallback();
      }
    };

    const tryImageWithObjectUrl = () => {
      let objUrl = '';
      try {
        objUrl = URL.createObjectURL(file);
      } catch {
        tryDataUrlFallback();
        return;
      }
      const img = new Image();
      const cleanup = () => {
        if (objUrl) {
          try {
            URL.revokeObjectURL(objUrl);
          } catch {
            /* */
          }
          objUrl = '';
        }
      };

      const runDraw = () => {
        encodeFromWidthHeight(img, img.naturalWidth, img.naturalHeight, cleanup);
      };

      img.onload = () => {
        if (typeof img.decode === 'function') {
          img.decode().then(runDraw).catch(() => {
            cleanup();
            tryDataUrlFallback();
          });
        } else {
          requestAnimationFrame(() => requestAnimationFrame(runDraw));
        }
      };
      img.onerror = () => {
        cleanup();
        tryDataUrlFallback();
      };
      img.src = objUrl;
    };

    if (typeof createImageBitmap === 'function') {
      createImageBitmap(file)
        .then((bmp) => {
          encodeFromWidthHeight(bmp, bmp.width, bmp.height, () => {
            try {
              bmp.close();
            } catch {
              /* */
            }
          });
        })
        .catch(() => {
          tryImageWithObjectUrl();
        });
      return;
    }

    tryImageWithObjectUrl();
  });
}

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
const STATUS_DEFS = [
  { id: 'draft',     label: 'Rascunho',  color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' },
  { id: 'ready',     label: 'Pronto',    color: '#86efac', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.3)' },
  { id: 'published', label: 'Publicado', color: '#a78bfa', bg: 'rgba(167,139,250,0.10)',border: 'rgba(167,139,250,0.3)' },
];
const STATUS_BY_ID = Object.fromEntries(STATUS_DEFS.map(s => [s.id, s]));

const fmtDate = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' })
    + ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
};

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

/** Padding multiplicador por defeito (slider «Distância das bordas»); slides antigos sem campo usam o mesmo fallback na renderização. */
const DEFAULT_SLIDE_TEXT_INSET = 10;

/** Tipografia padrão da marca (`text*` no doc). Slides novos herdam via `mkSlide(n, brand)`. */
function typographyPatchFromBrand(brand) {
  const b = brand && typeof brand === 'object' ? brand : {};
  const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const tc = b.textTitleCase;
  const titleCase = tc === 'upper' || tc === 'lower' || tc === 'normal' ? tc : 'normal';
  let w = num(b.textTitleWeight, 800);
  if (w < 400) w = 400;
  if (w > 900) w = 900;
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
  /** Intervalos UTF-16 [início,fim exclusivo) na cor Destaques — texto bruto sem marcadores asterisco. */
  destaqueSpans: undefined,
};
};

const isDefault = (slides) =>
  Array.isArray(slides) &&
  slides.length === 1 &&
  slides[0]?.title === 'Seu título aqui';

// extractJSON foi extraído para src/utils/parsers.js

// ─── AI BACKENDS ──────────────────────────────────────────────────────────────
// Detecta se está rodando localmente (Vite dev) — nesse caso usa o proxy
// configurado em vite.config.js para evitar CORS. Em produção (Claude artifact)
// bate direto na API porque o ambiente já está autenticado.
const IS_LOCAL_DEV =
  typeof window !== 'undefined' &&
  /^(localhost|127\.|0\.0|192\.168|10\.|\[::1\])/.test(window.location.hostname);

/** Em build de produção (ex.: Netlify com VITE_ANTHROPIC_PROXY) usa a função serverless → sem CORS. */
const USE_ANTHROPIC_PROXY =
  IS_LOCAL_DEV ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ANTHROPIC_PROXY === 'true');

const ANTHROPIC_URL = USE_ANTHROPIC_PROXY
  ? '/api/anthropic/v1/messages'
  : 'https://api.anthropic.com/v1/messages';
const OPENAI_CHAT_URL  = IS_LOCAL_DEV ? '/api/openai/v1/chat/completions'      : 'https://api.openai.com/v1/chat/completions';
const OPENAI_IMAGE_URL = IS_LOCAL_DEV ? '/api/openai/v1/images/generations'    : 'https://api.openai.com/v1/images/generations';
const OPENAI_IMAGE_EDITS_URL = IS_LOCAL_DEV ? '/api/openai/v1/images/edits'     : 'https://api.openai.com/v1/images/edits';

/** Converte "Failed to fetch" numa mensagem acionável (CORS, preview sem proxy, rede). */
function enhanceNetworkError(err, label) {
  const m = (err && err.message) ? err.message : String(err);
  if (!/failed to fetch|networkerror|load failed|network request failed/i.test(m)) {
    return err instanceof Error ? err : new Error(m);
  }
  const hosted = typeof window !== 'undefined' && !IS_LOCAL_DEV;
  const isClaude = /claude|anthropic/i.test(label);
  const isOpenAI = /openai|gpt|dall/i.test(label);
  let hint;
  if (!hosted) {
    // Dev local: provavelmente o proxy /api não está respondendo
    hint = 'Verifique se `npm run dev` está rodando e se há internet. Em local dev, o proxy /api precisa do servidor Vite ativo.';
  } else if (isClaude) {
    hint =
      'Em produção, Claude passa pelo proxy /api/anthropic (Netlify Function). ' +
      'Verifique se: (a) sua chave Anthropic está preenchida no ⚙ no header, OU ' +
      '(b) o admin do site configurou ANTHROPIC_API_KEY no Netlify. ' +
      'Como atalho, adicione apenas a chave OpenAI no ⚙ — ela cobre texto (GPT-4o) e imagens (DALL·E).';
  } else if (isOpenAI) {
    hint =
      'Sua chave OpenAI pode estar inválida, expirada ou sem saldo. ' +
      'Verifique em platform.openai.com/api-keys e platform.openai.com/account/billing. ' +
      'Se nunca configurou, adicione a chave no ícone ⚙ no header.';
  } else {
    hint =
      'Erro de rede ao chamar a API de IA. Verifique sua conexão e se as chaves no ⚙ estão corretas.';
  }
  return new Error(`${label}: falha de rede. ${hint}`);
}

// Cache do health-check do servidor (quais providers tem chave configurada)
let _serverStatusPromise = null;
const getServerStatus = ({ force = false } = {}) => {
  if (!IS_LOCAL_DEV) return Promise.resolve({ anthropic: true, openai: true, dev: false });
  if (force) _serverStatusPromise = null;
  if (_serverStatusPromise) return _serverStatusPromise;
  _serverStatusPromise = fetch('/api/status').then(r => r.json()).catch(() => ({ anthropic: false, openai: false, dev: true }));
  return _serverStatusPromise;
};

const AI_SYSTEM_PT = 'Você é especialista em conteúdo estratégico para Instagram no Brasil. Use português brasileiro em todo texto visível ao leitor (títulos, subtítulos, parágrafos, legendas), salvo quando o pedido do usuário exigir explicitamente outro idioma apenas num campo isolado — por exemplo palavras-chave de busca de imagem em inglês.';

// Backend Anthropic (Claude)
// Mutável em runtime via setClaudeModelPref — React component sincroniza via useEffect.
// Defaults para Sonnet (rápido); usuário pode trocar para Opus em ⚙ para qualidade máxima.
const CLAUDE_MODELS = {
  sonnet: 'claude-sonnet-4-6',
  opus:   'claude-opus-4-7',
};
let _claudeModelPref = 'sonnet';
const setClaudeModelPref = (v) => { _claudeModelPref = (v === 'opus' ? 'opus' : 'sonnet'); };
const getClaudeModelId = () => CLAUDE_MODELS[_claudeModelPref] || CLAUDE_MODELS.sonnet;

// Mutável em runtime — App.useEffect sincroniza após mudança no input do KeysModal.
let _anthropicUserKey = '';
const setAnthropicUserKey = (k) => { _anthropicUserKey = String(k || '').trim(); };

const callAnthropic = async (userMsg, { json = false, maxTokens = 4096, tools = null } = {}) => {
  const body = {
    model: getClaudeModelId(),
    max_tokens: maxTokens,
    system: AI_SYSTEM_PT,
    messages: [{ role: 'user', content: userMsg }],
  };
  if (tools) body.tools = tools;
  const headers = { 'Content-Type': 'application/json' };
  // Local dev: chave do usuário (se preenchida) é injetada via header pro proxy usar
  // como x-api-key no Anthropic. Sem chave do usuário, proxy usa ANTHROPIC_API_KEY do .env.local.
  if (IS_LOCAL_DEV && _anthropicUserKey) {
    headers['x-anthropic-key'] = _anthropicUserKey;
  }
  let res;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw enhanceNetworkError(e, 'Claude');
  }
  const raw = await res.text();
  if (res.status === 404 && IS_LOCAL_DEV && String(ANTHROPIC_URL).startsWith('/api')) {
    throw new Error(
      'Endpoint /api não existe neste servidor (ex.: `npm run preview` não inclui proxy). Use `npm run dev` para IA com Claude/OpenAI.',
    );
  }
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error(`Resposta inválida (HTTP ${res.status})`); }
  if (!res.ok || data.error) {
    const e = new Error(data?.error?.message || `Anthropic HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  const text = (data.content||[])
    .filter(b => b?.type === 'text')
    .map(b => b.text)
    .join('\n');
  if (!text.trim()) throw new Error('Claude retornou conteúdo vazio.');
  return json ? extractJSON(text) : text.trim();
};

// Backend OpenAI (gpt-4o) — usado como fallback quando só há chave OpenAI
const callOpenAIChat = async (userMsg, { json = false, maxTokens = 4096, key }) => {
  // Em local dev, o proxy usa a chave do .env.local quando o frontend não envia uma.
  // Fora do dev (Claude artifact), a chave é obrigatória.
  if (!IS_LOCAL_DEV && !key) throw new Error('Chave OpenAI ausente — configure em ⚙ no header.');
  const body = {
    model: 'gpt-4o',
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: `${AI_SYSTEM_PT} Responda APENAS o que foi pedido, sem texto extra, sem markdown explicativo.` },
      { role: 'user',   content: userMsg },
    ],
    temperature: 0.85,
  };
  if (json) body.response_format = { type: 'json_object' };
  const headers = { 'Content-Type': 'application/json' };
  if (IS_LOCAL_DEV) {
    if (key) headers['x-openai-key'] = key; // senão, proxy usa OPENAI_API_KEY do .env.local
  } else {
    headers['Authorization'] = `Bearer ${key}`;
  }
  let res;
  try {
    res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw enhanceNetworkError(e, 'OpenAI');
  }
  const raw = await res.text();
  if (res.status === 404 && IS_LOCAL_DEV && String(OPENAI_CHAT_URL).startsWith('/api')) {
    throw new Error(
      'Endpoint /api não existe neste servidor (ex.: `npm run preview`). Use `npm run dev` para IA com proxy.',
    );
  }
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error(`OpenAI: resposta inválida (HTTP ${res.status})`); }
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `OpenAI HTTP ${res.status}`);
  }
  const text = data.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new Error('OpenAI retornou conteúdo vazio.');
  return json ? extractJSON(text) : text.trim();
};

// Multi-provider: tenta Anthropic primeiro, cai para OpenAI se necessário.
// `openaiKey` é a chave configurada pelo usuário no UI (KeysModal).
// Em local dev, OpenAI também funciona sem chave do user se o servidor tiver
// `OPENAI_API_KEY` no .env.local (o proxy usa ela como fallback).
//
// Estratégia de erro: erros transitórios (429, 5xx, timeout, rede) no Anthropic
// recebem retry com backoff exponencial antes de cair para OpenAI — evita queimar
// crédito OpenAI quando o Claude está só sobrecarregado por uns segundos.
const callAI = async (userMsg, { json = false, maxTokens = 4096, openaiKey = null } = {}) => {
  const status = await getServerStatus();
  const openaiAvailable = !!openaiKey || (IS_LOCAL_DEV && status.openai);
  // Anthropic disponível se: prod (Claude artifact, sempre) || env.local tem key || user forneceu key via UI
  const anthropicAvailable = status.anthropic || !!_anthropicUserKey;
  const isTransient = (e) => {
    const msg = String(e?.message || '');
    return e instanceof TypeError ||
      e?.status === 429 || e?.status >= 500 ||
      /HTTP\s*(429|5\d\d)|rate.?limit|timeout|network|fetch failed/i.test(msg);
  };
  if (anthropicAvailable) {
    const backoffs = [0, 1000, 3000]; // 3 tentativas no Claude (imediata, +1s, +3s)
    let lastErr;
    for (let i = 0; i < backoffs.length; i++) {
      if (backoffs[i] > 0) await new Promise(r => setTimeout(r, backoffs[i]));
      try {
        return await callAnthropic(userMsg, { json, maxTokens });
      } catch (e) {
        lastErr = e;
        if (!isTransient(e) || i === backoffs.length - 1) break;
        console.warn(`[callAI] Claude transitório (tentativa ${i+1}/${backoffs.length}):`, e.message);
      }
    }
    if (openaiAvailable) {
      console.warn('[callAI] Claude esgotou tentativas, caindo para OpenAI:', lastErr?.message);
      return await callOpenAIChat(userMsg, { json, maxTokens, key: openaiKey });
    }
    throw lastErr;
  }
  if (openaiAvailable) {
    return await callOpenAIChat(userMsg, { json, maxTokens, key: openaiKey });
  }
  throw new Error('Sem chave de IA configurada. Adicione sua chave OpenAI em ⚙ no header (ou ANTHROPIC_API_KEY em .env.local para usar Claude).');
};

// Pesquisa com web_search é EXCLUSIVA do Claude/Anthropic.
const callAIwithSearch = async (userMsg, { json = false, maxTokens = 4096 } = {}) => {
  const status = await getServerStatus();
  if (!status.anthropic) {
    throw new Error('A pesquisa de nicho com web ao vivo precisa de uma chave Anthropic. Adicione ANTHROPIC_API_KEY em .env.local na raiz do projeto e reinicie o npm run dev.');
  }
  return callAnthropic(userMsg, {
    json, maxTokens,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  });
};

const loadHtml2Canvas = () => new Promise((res, rej) => {
  if (window.html2canvas) return res(window.html2canvas);
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  s.onload = () => res(window.html2canvas);
  s.onerror = () => rej(new Error('html2canvas load failed'));
  document.head.appendChild(s);
});

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

// Carrega jsPDF on-demand (UMD) — só baixa quando o usuário pedir export PDF
const loadJsPdf = () => new Promise((res, rej) => {
  if (window.jspdf?.jsPDF) return res(window.jspdf.jsPDF);
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
  s.onload = () => res(window.jspdf?.jsPDF);
  s.onerror = () => rej(new Error('jsPDF load failed'));
  document.head.appendChild(s);
});

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

/** PNG a partir do canvas (toBlob; fallback se o browser devolver null). */
function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
            return;
          }
          try {
            const dataUrl = canvas.toDataURL('image/png');
            const base64 = dataUrl.split(',')[1];
            if (!base64) throw new Error('PNG vazio');
            const bin = atob(base64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            resolve(new Blob([arr], { type: 'image/png' }));
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        },
        'image/png',
        1,
      );
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
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

// ─── WEB TREND (dev: Unsplash → Pexels → Commons | produção: só Commons no cliente)
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

const COMMONS_STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'not', 'are', 'but', 'com', 'como', 'de', 'da', 'do', 'das', 'dos',
  'em', 'um', 'uma', 'o', 'os', 'as', 'no', 'na', 'nos', 'nas', 'por', 'que', 'se', 'ao', 'aos', 'à', 'às',
  'é', 'e', 'ou', 'não', 'mais', 'muito', 'sobre', 'entre', 'sem', 'sua', 'seu', 'são', 'foi', 'ser', 'tem',
  'já', 'apenas', 'isso', 'esse', 'essa', 'neste', 'nesta', 'pelo', 'pela', 'aos',
]);

/** Reforços em inglês quando o texto do slide indica tech / energia / IA (evita resultado tipo “feira de ciências”). */
function expandTopicHintsForStockSearch(title, subtitle, imageQuery) {
  const blob = `${title || ''} ${subtitle || ''} ${imageQuery || ''}`;
  const hints = [];
  const rules = [
    [/\b(ia|i\.a\.|intelig[eê]ncia\s+artificial)\b/i, 'data center servers artificial intelligence infrastructure'],
    [/data\s*center|datacenter|centros?\s+de\s+dados/i, 'data center server room network cables cooling'],
    [/energia|energy|consumo|electricidade|electricity|power\b/i, 'electrical power infrastructure renewable energy grid'],
    [/nuvem|cloud\s+computing|\bcloud\b/i, 'cloud computing server infrastructure'],
    [/sustainable|sustent[aá]bilidade|carbono|emiss[oõ]es/i, 'sustainable energy solar wind infrastructure'],
    [/big\s*tech|silicon\s+valley|startup\s+tech/i, 'technology office modern workspace'],
    [/hackathon|feira\s+de\s+ci[eê]ncia|science\s+fair/i, 'science fair student project'],
  ];
  for (const [re, hint] of rules) {
    if (re.test(blob)) hints.push(hint);
  }
  return [...new Set(hints)].slice(0, 3).join(' ');
}

/** Combina imageQuery (IA) com palavras do título/subtítulo + hints temáticos para a busca não fugir do tema. */
function buildCommonsSearchQuery(imageQuery, title, subtitle, imgExtraPrompt = '') {
  const q = (imageQuery || '').trim();
  const extra = (imgExtraPrompt || '').trim();
  const text = `${title || ''} ${subtitle || ''}`;
  const words = text.match(/[\p{L}\p{N}]+/gu) || [];
  const keywords = words
    .filter(w => w.length > 2 && !COMMONS_STOP.has(w.toLowerCase()))
    .slice(0, 18)
    .join(' ');
  const extraWords = extra.match(/[\p{L}\p{N}]+/gu) || [];
  const extraPack = extraWords
    .filter(w => w.length > 2 && !COMMONS_STOP.has(w.toLowerCase()))
    .slice(0, 24)
    .join(' ');
  let merged = [keywords, q, extraPack].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const hintPack = expandTopicHintsForStockSearch(title, subtitle, q);
  if (hintPack) merged = `${merged} ${hintPack}`.replace(/\s+/g, ' ').trim();
  if (merged.length > 280) merged = merged.slice(0, 280);
  return merged || 'documentary photography';
}

const fetchWebTrendImage = async (query, seed = '', ctx = {}) => {
  const qBase = buildCommonsSearchQuery(query, ctx.title, ctx.subtitle, ctx.imgExtraPrompt);

  if (IS_LOCAL_DEV) {
    try {
      const params = new URLSearchParams({ q: qBase, seed: seed || '0' });
      const res = await fetch(`/api/web-trend-search?${params}`);
      if (res.ok) {
        const j = await res.json();
        if (j.url) return j.url;
      }
    } catch (e) {
      console.warn('[Web trend] API local:', e.message);
    }
  }

  const pickFromItems = (items, salt, hashKey) => {
    if (!items.length) return null;
    const raw = `${salt}:${hashKey}`;
    const hash = Math.abs([...raw].reduce((a, c) => (Math.imul(31, a) + c.charCodeAt(0)) | 0, 0));
    const idx = hash % items.length;
    const ii = items[idx];
    return (ii && (ii.thumburl || ii.url)) || null;
  };
  const runCommons = async (searchQ) => {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'search',
      gsrsearch: searchQ,
      gsrnamespace: '6',
      gsrlimit: '30',
      prop: 'imageinfo',
      iiprop: 'url|mime|thumburl',
      iiurlwidth: '1280',
    });
    const res = await fetch(`${COMMONS_API}?${params}`);
    if (!res.ok) throw new Error(`Busca Web trend falhou (HTTP ${res.status}).`);
    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return [];
    const out = [];
    for (const p of Object.values(pages)) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const mime = (ii.mime || '').toLowerCase();
      if (mime.includes('svg') || mime.includes('djvu') || mime.includes('pdf')) continue;
      if (ii.thumburl || ii.url) out.push(ii);
    }
    return out;
  };
  let items = await runCommons(qBase);
  let url = pickFromItems(items, seed || '0', qBase);
  if (!url) {
    const fb = 'photography documentary editorial';
    items = await runCommons(fb);
    url = pickFromItems(items, (seed || '0') + ':fb', fb);
  }
  if (!url) throw new Error('Nenhuma imagem encontrada. Tente palavras-chave em inglês (ex.: street, office, morning light).');
  return url;
};

// ─── GPT IMAGE 2 (OpenAI) ─────────────────────────────────────────────────────
// Migração de DALL·E 3 → gpt-image-2 (modelo flagship lançado em abril/2026):
// - Fotorealismo significativamente melhor (rosto, pele, texturas)
// - Sem o "prompt rewriting" agressivo do DALL·E 3 (não precisa do hack "I NEED to test…")
// - Sem `style:'vivid|natural'` — modelo já é natural por padrão
// - Suporta resoluções flexíveis (múltiplos de 16, max edge 3840px); `1024x1280` é
//   exato 4:5 do feed do Instagram, melhor que 1024x1792 (que era 9:16 no DALL·E 3).
//
// Prompt baseado nas best practices oficiais (developers.openai.com/cookbook):
// usar palavra "photorealistic" diretamente, vocabulário de fotografia (lente, luz,
// grão de filme), detalhes de textura real (poros, rugas, gasto de tecido), e
// EVITAR palavras que sugiram studio polish/staging.
const GPT_IMAGE_ART_DIRECTION = `You are an art director specialized in realistic imagery for editorial, institutional and commercial carousels. Create a visual support image for a card, always connected to the central theme of the content but avoiding obvious, generic or excessively literal solutions.

GENERAL DIRECTION
Generate realistic, natural and sophisticated images that look like real photographs or carefully composed documentary scenes captured in a real moment — not artificially created. Avoid creative exaggeration, visual fantasy, gratuitous surrealism, excess elements, overly dramatic compositions or visual cliché metaphors. The image must convey visual intelligence, subtlety and context.

AESTHETIC
Realistic, clean, contemporary, natural. Use natural or soft light, moderate contrast, sober balanced colors, real texture of environments and people, discrete cinematic composition, natural shallow depth of field, editorial premium atmosphere. Subtle film grain. Slightly desaturated muted tones. No glamorization, no heavy retouching, no studio strobes, no extreme contrast.

RELATION TO THEME
Connect to the card's theme intelligently and indirectly. Avoid clichés: no chess for "strategy", no rising graphs for "growth", no lightbulbs for "ideas", no floating holograms or robots for "technology", no generic corporate meetings for "business", no paint splashes for "creativity", no handshakes for "partnership". Suggest the concept through atmosphere, gesture, context, object or visual tension. The image is a sophisticated visual layer, not an obvious caption.

COMPOSITION FOR CAROUSEL
Designed for carousel cards. Leave visual breathing space for text overlay. Important elements never at edges. Negative space, slightly defocused background, one clear focal element, few objects, balance between information and visual silence. Image must not compete with text.

PEOPLE
Real, natural, spontaneous — never posed-model, no advertising smile. Contemporary, discrete clothing. Plausible situations. No artificially staged diversity, no generic corporate-ad composition. Real skin texture with visible pores and slight imperfections, natural unposed expressions.

ENVIRONMENTS
Real, well-observed: contemporary offices, urban streets, cafés, studios, homes, shops, behind-the-scenes, work spaces, cultural spaces, objects on tables, process details. The environment reinforces the theme without looking staged.

VISUAL QUALITY
Photorealistic, shot like 35mm film photograph at eye level using a 50mm lens, shallow depth of field, subtle film grain, natural color balance. Realistic materials, organic texture, subtle imperfections. Avoid: plasticized skin, deformed hands, malformed objects, floating elements, fake logos, excessive sharpness, evident AI aesthetic.

EXPECTED OUTPUT
A photorealistic, sophisticated and natural image related to the theme indirectly, with low saturation, moderate contrast, clean composition, generous text-friendly space, premium editorial appearance. Feels real, silent, intelligent and visually refined. Strictly no text, no captions, no watermarks, no logos inside the image.`;

function dataUrlToBlob(dataUrl) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error('Formato de imagem inválido.');
  const bin = atob(m[2]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const mime = (m[1] || 'image/png').split(';')[0].trim();
  return new Blob([arr], { type: mime || 'image/png' });
}

async function blobFromSlideRef(refImage) {
  if (!refImage || typeof refImage !== 'string') throw new Error('Referência ausente.');
  if (refImage.startsWith('data:')) return dataUrlToBlob(refImage);
  const res = await fetch(refImage);
  if (!res.ok) throw new Error('Não foi possível carregar a URL da imagem de referência.');
  return res.blob();
}

/** Prompt completo para GPT Image (geração ou edição com referência). */
function buildGptImageFullPrompt(q, imgParams, imgExtraPrompt, { withReference = false } = {}) {
  const safeTheme = (q || '').slice(0, 280);
  const axisTags = buildImgParamsTagsEN(imgParams);
  const extra = (imgExtraPrompt || '').trim().slice(0, 2000);
  const refLead = withReference
    ? 'REFERENCE IMAGE IS ATTACHED: Preserve brand/product identity — palette, materials, proportions, packaging style, typography mood. Produce a NEW editorial photograph suitable as a carousel slide background with generous negative space for headline/body text; reinterpret in a fresh scene aligned with the theme — do not output a flat crop of the reference alone.\n\n'
    : '';
  let body =
    `${GPT_IMAGE_ART_DIRECTION}\n\n` +
    refLead +
    `THEME OF THIS CARD: ${safeTheme}` +
    `${axisTags}`;
  if (extra) {
    body += `\n\nBRAND / CLIENT DIRECTION (priority — incorporate faithfully):\n${extra}`;
  }
  body += `\n\nNow create the image following all the directions above. Use photorealistic real-photograph rendering.`;
  return body;
}

// Lista de modelos OpenAI tentados em ordem (do mais novo/melhor pro mais antigo).
// `gpt-image-2` exige org verificada (>=abril/2026); `gpt-image-1` e `dall-e-3`
// não. O fallback acontece automaticamente quando a API retorna 403 (verificação)
// ou 404 (modelo não disponível na conta).
const OPENAI_IMAGE_MODELS = [
  // Família GPT Image (params modernos: quality high|medium|low, qualquer size múltiplo de 16)
  { name: 'gpt-image-2',   size: '1024x1280', quality: 'high' },
  { name: 'gpt-image-1.5', size: '1024x1536', quality: 'high' },
  { name: 'gpt-image-1',   size: '1024x1536', quality: 'high' },
  // Legacy: DALL·E 3 (params diferentes — usa hd/standard, vivid/natural)
  { name: 'dall-e-3',      size: '1024x1792', quality: 'hd', style: 'natural', responseFormat: true },
];

let _cachedModel = null; // memoiza o primeiro modelo que funcionou nesta sessão

/** Geração com uma ou mais imagens de referência (API edits — multipart). */
async function generateDALLEEdits(refBlob, prompt, apiKey) {
  if (!IS_LOCAL_DEV && !apiKey) throw new Error('Chave OpenAI ausente.');
  const headers = {};
  if (IS_LOCAL_DEV) {
    if (apiKey) headers['x-openai-key'] = apiKey;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const order = _cachedModel
    ? [_cachedModel, ...OPENAI_IMAGE_MODELS.filter(m => m.name !== _cachedModel.name)]
    : OPENAI_IMAGE_MODELS;

  let lastErr = null;
  for (const model of order) {
    const fd = new FormData();
    fd.append('model', model.name);
    fd.append('prompt', prompt.slice(0, model.name === 'dall-e-3' ? 4000 : 32000));
    fd.append('n', '1');
    fd.append('size', model.size);
    fd.append('quality', model.quality);
    if (model.style) fd.append('style', model.style);
    if (model.responseFormat) fd.append('response_format', 'b64_json');
    const ext =
      (refBlob.type && refBlob.type.includes('jpeg')) || (refBlob.type && refBlob.type.includes('jpg'))
        ? 'jpg'
        : 'png';
    fd.append('image[]', refBlob, `reference.${ext}`);

    try {
      let res;
      try {
        res = await fetch(OPENAI_IMAGE_EDITS_URL, { method: 'POST', headers, body: fd });
      } catch (e) {
        throw enhanceNetworkError(e, 'GPT Image (referência)');
      }
      if (res.status === 404 && IS_LOCAL_DEV && String(OPENAI_IMAGE_EDITS_URL).startsWith('/api')) {
        throw new Error(
          'Endpoint /api não existe (`npm run preview` não tem proxy). Use `npm run dev` para GPT Image.',
        );
      }
      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        const msg = errPayload.error?.message || `HTTP ${res.status}`;
        const shouldFallback =
          res.status === 403 ||
          res.status === 404 ||
          res.status === 400 ||
          /must be verified|model.*not.*found|does not have access|unsupported model|not supported/i.test(msg);
        if (shouldFallback) {
          console.warn(`[OpenAI Image edits] ${model.name}: ${msg} — próximo modelo`);
          lastErr = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }
      const d = await res.json();
      _cachedModel = model;
      return `data:image/png;base64,${d.data[0].b64_json}`;
    } catch (e) {
      if (e instanceof TypeError) { lastErr = e; continue; }
      throw e;
    }
  }
  throw new Error(
    lastErr?.message ||
      'Nenhum modelo aceitou imagem de referência. Tente gerar só com texto ou outro modelo.',
  );
}

/**
 * GPT Image a partir de texto. Opcional: `options.refImage` (data URL ou https) + `options.imgExtraPrompt`.
 * Com referência, usa POST /v1/images/edits; sem referência, /v1/images/generations.
 */
const generateDALLE = async (q, apiKey, imgParams = null, options = {}) => {
  const { refImage, imgExtraPrompt } = options || {};
  if (!IS_LOCAL_DEV && !apiKey) throw new Error('Chave OpenAI ausente.');

  if (refImage) {
    try {
      const blob = await blobFromSlideRef(refImage);
      const promptRef = buildGptImageFullPrompt(q, imgParams, imgExtraPrompt, { withReference: true });
      return await generateDALLEEdits(blob, promptRef, apiKey);
    } catch (e) {
      console.warn('[GPT Image] Referência indisponível, gerando só com texto:', e.message);
    }
  }

  const prompt = buildGptImageFullPrompt(q, imgParams, imgExtraPrompt, { withReference: false });
  const headers = { 'Content-Type': 'application/json' };
  if (IS_LOCAL_DEV) {
    if (apiKey) headers['x-openai-key'] = apiKey;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const order = _cachedModel
    ? [_cachedModel, ...OPENAI_IMAGE_MODELS.filter(m => m.name !== _cachedModel.name)]
    : OPENAI_IMAGE_MODELS;

  let lastErr = null;
  for (const model of order) {
    const body = {
      model: model.name,
      prompt: prompt.slice(0, model.name === 'dall-e-3' ? 4000 : 32000),
      n: 1,
      size: model.size,
      quality: model.quality,
    };
    if (model.style) body.style = model.style;
    if (model.responseFormat) body.response_format = 'b64_json';

    try {
      let res;
      try {
        res = await fetch(OPENAI_IMAGE_URL, { method: 'POST', headers, body: JSON.stringify(body) });
      } catch (e) {
        throw enhanceNetworkError(e, 'GPT Image');
      }
      if (res.status === 404 && IS_LOCAL_DEV && String(OPENAI_IMAGE_URL).startsWith('/api')) {
        throw new Error(
          'Endpoint /api não existe (`npm run preview` não tem proxy). Use `npm run dev` para GPT Image.',
        );
      }
      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        const msg = errPayload.error?.message || `HTTP ${res.status}`;
        const shouldFallback =
          res.status === 403 ||
          res.status === 404 ||
          /must be verified|model.*not.*found|does not have access|unsupported model/i.test(msg);
        if (shouldFallback) {
          console.warn(`[OpenAI Image] ${model.name} indisponível: ${msg} — tentando próximo modelo`);
          lastErr = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }
      const d = await res.json();
      _cachedModel = model;
      return `data:image/png;base64,${d.data[0].b64_json}`;
    } catch (e) {
      if (e instanceof TypeError) { lastErr = e; continue; }
      throw e;
    }
  }
  throw new Error(
    `Nenhum modelo de imagem da OpenAI disponível para sua conta. ` +
      `Último erro: ${lastErr?.message || 'desconhecido'}. ` +
      `Verifique sua organização em https://platform.openai.com/settings/organization/general`,
  );
};

/** Wrapper que tenta `generateDALLE` até N+1 vezes com backoff curto. Útil para rate-limits transitórios.
 *  Erros 4xx persistentes (auth, conteúdo, modelo indisponível) NÃO retentam — só rede / 5xx / 429. */
const generateDALLEWithRetry = async (q, apiKey, imgParams = null, options = {}, { retries = 1, backoffMs = 1200 } = {}) => {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await generateDALLE(q, apiKey, imgParams, options);
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || '');
      const isRetriable =
        e instanceof TypeError ||
        /HTTP\s*5\d\d|429|rate.?limit|timeout|network|fetch/i.test(msg);
      if (!isRetriable || attempt === retries) throw e;
      await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
    }
  }
  throw lastErr;
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

/** Junta intervalos UTF-16 [lo, hi) ordenados sem sobrepor. */
function mergeUtf16AccentIntervals(intervals) {
  if (!intervals?.length) return [];
  const xs = intervals.filter(([a, b]) => b > a).map(([a, b]) => [a, b]).sort((x, y) => x[0] - y[0]);
  const out = [];
  let cs = xs[0][0];
  let ce = xs[0][1];
  for (let i = 1; i < xs.length; i++) {
    const [a, b] = xs[i];
    if (a <= ce) ce = Math.max(ce, b);
    else {
      out.push([cs, ce]);
      cs = a;
      ce = b;
    }
  }
  out.push([cs, ce]);
  return out;
}

function normalizeDestaqueSpansForLen(spans, len) {
  if (!len || len < 1) return [];
  const n = spans || [];
  return mergeUtf16AccentIntervals(
    n.map((pair) => {
      const a = typeof pair?.[0] === 'number' ? pair[0] : Number(pair?.[0]);
      const b = typeof pair?.[1] === 'number' ? pair[1] : Number(pair?.[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return [-1, -1];
      const lo = Math.max(0, Math.min(len, Math.floor(a)));
      const hi = Math.max(0, Math.min(len, Math.floor(b)));
      return lo < hi ? [lo, hi] : [-1, -1];
    }).filter(([a, b]) => b > a),
  );
}

/** Regiões “acento” apenas no interior de `\*\*…\*\*` (asteriscos não pintados). */
function markdownBoldAccentIntervalsUtf16(full) {
  const s = String(full ?? '');
  const iv = [];
  const re = /\*\*([^*]+)\*\*/g;
  let m;
  while ((m = re.exec(s)) !== null) iv.push([m.index + 2, m.index + m[0].length - 2]);
  return mergeUtf16AccentIntervals(iv);
}

function unifyAccentIntervalsUtf16(full, explicitSpans) {
  const len = full.length;
  const md = markdownBoldAccentIntervalsUtf16(full);
  const ex = normalizeDestaqueSpansForLen(explicitSpans, len);
  return mergeUtf16AccentIntervals([...md, ...ex]);
}

/** Remove pares `**` colados às zonas accent (marcadores Markdown — não aparecem no cartão). */
function stripAdjacentMarkdownBoldFences(fragment) {
  let s = String(fragment ?? '');
  let prev = null;
  while (prev !== s) {
    prev = s;
    if (s.startsWith('**')) s = s.slice(2);
    if (s.endsWith('**')) s = s.slice(0, -2);
  }
  return s;
}

/** Trechos `{ type:'base'|'accent', v }` na ordem do texto. */
function cultureAccentRenderablePieces(fullText, explicitSpans) {
  const full = String(fullText ?? '');
  const len = full.length;
  if (!len) return [];
  const iv = unifyAccentIntervalsUtf16(full, explicitSpans);
  const pieces = [];
  let ptr = 0;
  for (const [a, b] of iv) {
    const lo = Math.max(0, a);
    const hi = Math.min(len, b);
    if (hi <= lo) continue;
    if (ptr < lo) {
      const rawBase = full.slice(ptr, lo);
      const cleaned = stripAdjacentMarkdownBoldFences(rawBase);
      if (cleaned.length) pieces.push({ type: 'base', v: cleaned });
    }
    pieces.push({ type: 'accent', v: full.slice(lo, hi) });
    ptr = hi;
  }
  if (ptr < len) {
    const rawTail = full.slice(ptr);
    const cleaned = stripAdjacentMarkdownBoldFences(rawTail);
    if (cleaned.length) pieces.push({ type: 'base', v: cleaned });
  }
  return pieces.length ? pieces : [{ type: 'base', v: stripAdjacentMarkdownBoldFences(full) || full }];
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

function contiguousTextEditBounds(prevStr, nextStr) {
  const p = String(prevStr ?? '');
  const n = String(nextStr ?? '');
  if (p === n) return null;
  const L0 = p.length;
  const L1 = n.length;
  let a = 0;
  while (a < L0 && a < L1 && p[a] === n[a]) a++;
  let b = 0;
  while (b < L0 - a && b < L1 - a && p[L0 - 1 - b] === n[L1 - 1 - b]) b++;
  const delStart = a;
  const delEndEx = L0 - b;
  const newMidEndEx = L1 - b;
  const oldMid = p.slice(delStart, delEndEx);
  const newMid = n.slice(delStart, newMidEndEx);
  const rebuiltOld = p.slice(0, delStart) + oldMid + p.slice(L0 - b);
  const rebuiltNew = n.slice(0, delStart) + newMid + n.slice(L1 - b);
  if (rebuiltOld !== p || rebuiltNew !== n) return null;
  return { delStart, delEndEx, oldMidLen: oldMid.length, newMidLen: newMid.length };
}

/** Ajusta intervalos quando o texto do campo é editado por uma substituição contígua. */
function remapDestaqueSpansOnEdit(prevText, nextText, spansIn) {
  const prev = String(prevText ?? '');
  const next = String(nextText ?? '');
  if (prev === next) return normalizeDestaqueSpansForLen(spansIn, next.length);
  const bounds = contiguousTextEditBounds(prev, next);
  let nextSpans = [...(spansIn || [])];
  if (!bounds) {
    return [];
  }
  const delta = bounds.newMidLen - bounds.oldMidLen;
  const delStart = bounds.delStart;
  const delEndEx = bounds.delEndEx;
  const adjusted = [];
  for (const [s, e] of nextSpans) {
    const lo = typeof s === 'number' ? s : 0;
    const hi = typeof e === 'number' ? e : 0;
    if (hi <= lo) continue;
    if (hi <= delStart) adjusted.push([lo, hi]);
    else if (lo >= delEndEx) adjusted.push([lo + delta, hi + delta]);
  }
  return normalizeDestaqueSpansForLen(adjusted, next.length);
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

const CANVAS_ZONE_MIN = { w: 8, h: 5 };
/** Miolo sanduíche: altura-alvo mínima da zona foto (% do card), alinhada ao layout flat (~31%). */
const SANDWICH_PHOTO_ZONE_MIN_H_PCT = 32;
/** Se não couber com texto legível, a foto pode descer até este piso (%). */
const SANDWICH_PHOTO_ZONE_ABSOLUTE_MIN_H_PCT = 20;
/** Altura mínima das zonas de texto topo/fundo no sanduíche — evita molduras tipo faixa que cortam parágrafos. */
const SANDWICH_TEXT_ZONE_MIN_H_PCT = 14;

function clampRect(r) {
  const x = Math.max(0, Math.min(100 - CANVAS_ZONE_MIN.w, r.x));
  const y = Math.max(0, Math.min(100 - CANVAS_ZONE_MIN.h, r.y));
  const w = Math.max(CANVAS_ZONE_MIN.w, Math.min(100 - x, r.w));
  const h = Math.max(CANVAS_ZONE_MIN.h, Math.min(100 - y, r.h));
  return { x, y, w, h };
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

/** Heurísticas para «Ajuste automático»: texto, foto cover, e com canvas — molduras dentro da margem e alturas compatíveis com o tipo. */
function slideAutoAdjustPatch(slide, { creativePreset, fmt = 'carrossel' }) {
  const patch = {};

  const titleRaw = slide.title ?? '';
  const subtitleRaw = slide.subtitle ?? '';
  const bodyRaw = slide.bodyAfterImage ?? '';
  const titleChars = String(titleRaw).trim().length;
  const subChars = String(subtitleRaw).trim().length;
  const bodyChars = String(bodyRaw).trim().length;
  /** Volume útil quando há bloco inferior (sandwich / Cultura). */
  const stackedTextChars = subChars + Math.round(bodyChars * 0.92);
  const titleLines = Math.max(1, String(titleRaw).split(/\n/).filter((ln) => ln.length > 0).length);
  const subLines = Math.max(1, String(subtitleRaw).split(/\n/).length);
  const bodyLines = Math.max(1, String(bodyRaw).split(/\n/).length);
  const maxStackLines = Math.max(subLines, bodyLines);

  if (slide.bgImage) {
    if (slide.bgFit !== 'cover') patch.bgFit = 'cover';
    if ((slide.bgX ?? 50) !== 50) patch.bgX = 50;
    if ((slide.bgY ?? 50) !== 50) patch.bgY = 50;
    if ((slide.bgZoom ?? 100) !== 100) patch.bgZoom = 100;
  }

  const curTitleSz = slide.titleSize ?? 100;
  let nextTitleSz = curTitleSz;
  if (titleChars > 150) nextTitleSz = Math.min(nextTitleSz, 70);
  else if (titleChars > 110) nextTitleSz = Math.min(nextTitleSz, 80);
  else if (titleChars > 75) nextTitleSz = Math.min(nextTitleSz, 90);
  else if (titleChars > 52) nextTitleSz = Math.min(nextTitleSz, 96);

  const curSubSz = slide.subSize ?? 100;
  let nextSubSz = curSubSz;
  const subHeuristicChars = Math.max(subChars, stackedTextChars);
  if (subHeuristicChars > 950) nextSubSz = Math.min(nextSubSz, 68);
  else if (subHeuristicChars > 700) nextSubSz = Math.min(nextSubSz, 76);
  else if (subHeuristicChars > 480) nextSubSz = Math.min(nextSubSz, 84);
  else if (subHeuristicChars > 300) nextSubSz = Math.min(nextSubSz, 92);
  else if (subHeuristicChars > 200) nextSubSz = Math.min(nextSubSz, 97);

  if (nextTitleSz !== curTitleSz) patch.titleSize = nextTitleSz;
  if (nextSubSz !== curSubSz) patch.subSize = nextSubSz;

  const curTLead = slide.titleLeading ?? 105;
  let nextTLead = curTLead;
  if (titleLines >= 4) nextTLead = Math.max(curTLead, 118);
  else if (titleLines >= 2) nextTLead = Math.max(curTLead, 110);

  const curSLead = slide.subLeading ?? 150;
  let nextSLead = curSLead;
  if (maxStackLines >= 9) nextSLead = Math.max(curSLead, 168);
  else if (maxStackLines >= 6) nextSLead = Math.max(curSLead, 160);
  else if (stackedTextChars > 520) nextSLead = Math.max(curSLead, 156);
  else if (maxStackLines >= 4) nextSLead = Math.max(curSLead, 154);

  if (nextTLead !== curTLead) patch.titleLeading = nextTLead;
  if (nextSLead !== curSLead) patch.subLeading = nextSLead;

  const inset = slide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
  let nextInset = inset;
  if ((titleChars > 95 || titleLines >= 3) && nextInset < 12) nextInset = Math.min(12, inset + 2);
  if (stackedTextChars > 340 && nextInset < 14) nextInset = Math.min(14, Math.max(nextInset, inset + 2));
  if (stackedTextChars > 540 && nextInset < 17) nextInset = Math.min(17, Math.max(nextInset, inset + 3));
  if (bodyChars > 400 && nextInset < 18) nextInset = Math.min(18, Math.max(nextInset, inset + 4));
  if (nextInset !== inset) patch.textInset = nextInset;

  const hasSandwichBody = bodyChars > 0;
  const heavyStack =
    (creativePreset !== 'tendencia_cultura' && !slide.useCultureLayout) ||
    !hasSandwichBody;
  if (heavyStack && stackedTextChars > 300 && ['mc', 'tc', 'tr', 'tl'].includes(slide.layout)) {
    patch.layout = 'bl';
    if (slide.align === 'center') patch.align = 'left';
  }

  const fFmt = FORMATS[fmt] || FORMATS.carrossel;
  const merged = { ...slide, ...patch };
  if (merged.canvas?.zones && typeof merged.canvas.zones === 'object' && merged.canvas.variant) {
    const fin = finalizeCanvasMarginsForAutoAdjust(merged, fFmt);
    if (fin?.zones) {
      patch.canvas = { ...slide.canvas, ...(patch.canvas || {}), zones: fin.zones };
      if (fin.textInsetAdvice != null) {
        const curIns = merged.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
        if (fin.textInsetAdvice > curIns) {
          patch.textInset = Math.max(patch.textInset ?? curIns, fin.textInsetAdvice);
        }
      }
    }
  }

  return patch;
}

const DEFAULT_CANVAS_ZONES_CLASSIC = {
  photo: { x: 0, y: 0, w: 100, h: 58 },
  title: { x: 6, y: 62, w: 88, h: 14 },
  subtitle: { x: 6, y: 77, w: 88, h: 20 },
};

/** Capa / encerramento Cultura ou primeiros dois do Personalizado 1·1 · 1·2 — foto preenche o card,
 *  texto nas zonas inferiores (estilo "manchete sobre foto"). Título com altura ampla pra
 *  acomodar 2-3 linhas de copy editorial sem cortar. */
const DEFAULT_CANVAS_ZONES_COVER_FULLBLEED = {
  photo: { x: 0, y: 0, w: 100, h: 100 },
  title: { x: 6, y: 62, w: 88, h: 22 },
  subtitle: { x: 6, y: 85, w: 88, h: 10 },
};

const DEFAULT_CANVAS_ZONES_SANDWICH = {
  top: { x: 6, y: 7, w: 88, h: 22 },
  photo: { x: 6, y: 31, w: 88, h: 41 },
  bottom: { x: 6, y: 74, w: 88, h: 23 },
};

/** Rotações de zona «foto» no miolo (texto antes e depois, ordem editorial mantida pelo posicionamento). */
const SANDWICH_ZONE_PRESETS = [
  {
    key: 'mid',
    top: { x: 6, y: 7, w: 88, h: 24 },
    photo: { x: 6, y: 33, w: 88, h: 39 },
    bottom: { x: 6, y: 74, w: 88, h: 23 },
  },
  {
    key: 'high',
    top: { x: 6, y: 40, w: 88, h: 22 },
    photo: { x: 6, y: 6, w: 88, h: 34 },
    bottom: { x: 6, y: 68, w: 88, h: 29 },
  },
  {
    key: 'low',
    top: { x: 6, y: 6, w: 88, h: 24 },
    photo: { x: 6, y: 32, w: 88, h: 40 },
    bottom: { x: 6, y: 74, w: 88, h: 23 },
  },
];

function sandwichZonesByRotationIndex(i) {
  const p = SANDWICH_ZONE_PRESETS[(Math.abs(i) % SANDWICH_ZONE_PRESETS.length + SANDWICH_ZONE_PRESETS.length) % SANDWICH_ZONE_PRESETS.length];
  return {
    top: { ...p.top },
    photo: { ...p.photo },
    bottom: { ...p.bottom },
  };
}

function slideHasPendingPhotoIntent(slide) {
  // Vídeo importado é "intenção de mídia visual" tanto quanto bgImage —
  // sem isso, sandwich layout (Cultura/Tendência) desativa a zona da foto
  // e o <video> nunca renderiza apesar de slide.videoId estar setado.
  if (slide?.videoId) return true;
  return !!(String(slide?.imageQuery ?? '').trim());
}

/** Personalizado · densidades 1/1 ou 1/2: dois primeiros full-bleed, miolo tipo Cultura com sanduíche. */
function isPersoHybridDensity(presetId, densityId) {
  return presetId === 'livre' && (densityId === '1_1' || densityId === '1_2');
}

function buildPersoHybridLayoutBlock(slideCount, textDensityId = '1_1') {
  const n = Math.min(12, Math.max(2, slideCount | 0));
  const { subLo, subHi, bodyLo, bodyHi } = tendenciaStyleSandwichCharBands(textDensityId || '1_1');
  return `
LAYOUT VISUAL HÍBRIDO (Personalizado · densidade ${SLIDE_TEXT_DENSITY_BY_ID[textDensityId]?.label || textDensityId} — prioridade quando ativo):

- Slide 1 e Slide 2: CAPA tipo tela inteira (“full-bleed”) — só "title", "subtitle" e "imageQuery". O campo "bodyAfterImage" DEVE ser exatamente "" (vazio).

- Slide 3 a Slide ${n} (todos quando N≥3): miolo formato sanduíche (como Pacote Tendência/Cultura): bloco inicial em "subtitle" (+ "title" se fizer sentido) ACIMA da fotografia embutida, e payoff em "bodyAfterImage" ABAIXO da foto. Quando incluir foto no card ("imageQuery" preenchido), preencha **subtitle** com **${subLo}–${subHi}** caracteres (prosa de várias frases, não headline solta) e **bodyAfterImage** com **${bodyLo}–${bodyHi}** caracteres. Destaque lexical: UM trecho entre **asteriscos duplos**.
- Opcionalmente "cultureTone": "", "light", "dark" ou "accent" (mesmo significado visual do Pacote Cultura).
- Slide só texto SEM foto neste formato: imageQuery ""; use "subtitle" + "bodyAfterImage" em dupla coluna tipográfica (sem sanduíche de foto).
`;
}

const DEFAULT_CANVAS_ZONES_STAT = {
  top: { x: 6, y: 8, w: 88, h: 40 },
  bottom: { x: 6, y: 52, w: 88, h: 38 },
};

function inferCanvasDefaults(slide, creativePreset) {
  const cpPack = creativePreset === 'tendencia_cultura';
  const skin = cpPack || !!slide.useCultureLayout;
  const bodyAfter = (slide.bodyAfterImage || '').trim();
  const hasPhotoIntent = !!slide.bgImage || slideHasPendingPhotoIntent(slide);
  const sandwich = skin && !!bodyAfter && hasPhotoIntent;
  const stat =
    skin && !!bodyAfter && !hasPhotoIntent && !!(slide.subtitle || '').trim();
  if (sandwich) return { variant: 'sandwich', zones: { ...DEFAULT_CANVAS_ZONES_SANDWICH } };
  if (stat) return { variant: 'stat', zones: { ...DEFAULT_CANVAS_ZONES_STAT } };
  // Cultura: capa/encerramento (slide sem bodyAfterImage com foto) usa full-bleed pra
  // título ter espaço amplo. Outros casos usam classic.
  if (skin && hasPhotoIntent) {
    return { variant: 'classic', zones: { ...DEFAULT_CANVAS_ZONES_COVER_FULLBLEED } };
  }
  return { variant: 'classic', zones: { ...DEFAULT_CANVAS_ZONES_CLASSIC } };
}

/** Margem lateral mínima do card para molduras de texto no «Ajuste automático». */
const CANVAS_AUTO_EDGE_PCT = 6;
/** Padding interno (`textInset`) mínimo com canvas quando se corre o ajuste — evita tipo colado na moldura azul. */
const CANVAS_AUTO_TEXT_INSET_MIN = 13;

/** Limita zonas texto à faixa lateral [EDGE,100-EDGE]; foto mantém proporções usuário (clamp só segurança). */
function tightenCanvasTextZoneRect(r) {
  const g = CANVAS_AUTO_EDGE_PCT;
  const b = clampRect(r);
  let x = Math.max(g, Math.min(b.x, 100 - g - CANVAS_ZONE_MIN.w));
  let w = Math.max(CANVAS_ZONE_MIN.w, Math.min(b.w, 100 - x - g));
  if (x + w > 100 - g) w = Math.max(CANVAS_ZONE_MIN.w, 100 - g - x);
  x = Math.max(g, Math.min(x, 100 - g - w));
  let y = Math.max(g, Math.min(b.y, 100 - g - CANVAS_ZONE_MIN.h));
  let h = Math.max(CANVAS_ZONE_MIN.h, Math.min(b.h, 100 - y - g));
  if (y + h > 100 - g) h = Math.max(CANVAS_ZONE_MIN.h, 100 - g - y);
  y = Math.max(g, Math.min(y, 100 - g - h));
  return clampRect({ x, y, w, h });
}

function estimateWrappedLines(chars, nlLines, availW_px, fsPx, charWidthFactor = 0.5) {
  if ((chars ?? 0) <= 0) return Math.max(1, nlLines);
  const cpl = Math.max(8, Math.floor(availW_px / Math.max(fsPx * 0.35, fsPx * charWidthFactor)));
  return Math.max(nlLines, Math.ceil(chars / cpl));
}

/**
 * Mantém zonas dentro da margem do canvas e aumenta molduras até o texto caber (~ClassicCanvasInner + sanduíche canvas).
 */
function finalizeCanvasMarginsForAutoAdjust(mergedSlide, f) {
  const cv = mergedSlide.canvas;
  if (!cv?.zones || typeof cv.zones !== 'object' || !cv.variant) return null;

  const baselineInsetPad = mergedSlide.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
  const insetCalc = Math.max(CANVAS_AUTO_TEXT_INSET_MIN, baselineInsetPad);
  const padXpx = f.w * (0.012 + insetCalc * 0.004);
  const padYpx = f.h * (0.006 + insetCalc * 0.004);
  const padYMarg = padYpx * 2;

  const titleChars = String(mergedSlide.title ?? '').trim().length;
  const subChars = String(mergedSlide.subtitle ?? '').trim().length;
  const bodyChars = String(mergedSlide.bodyAfterImage ?? '').trim().length;

  const titleLinesNl = Math.max(
    1,
    String(mergedSlide.title ?? '').split('\n').filter((ln) => String(ln).trim().length > 0).length,
  );
  const subLinesNl = Math.max(1, String(mergedSlide.subtitle ?? '').split('\n').length);
  const bodyLinesNl = Math.max(1, String(mergedSlide.bodyAfterImage ?? '').split(/\n/).length);

  const ts = mergedSlide.titleSize ?? 100;
  const ss = mergedSlide.subSize ?? 100;
  const bs = mergedSlide.bodyAfterSize ?? mergedSlide.subSize ?? 100;
  const tLeadClassic = (mergedSlide.titleLeading ?? 105) / 100;
  const sLeadClassic = (mergedSlide.subLeading ?? 150) / 100;
  const tLeadCv = (mergedSlide.titleLeading ?? 105) / 100;
  const subLeadCv = (mergedSlide.subLeading ?? 142) / 100;
  const bodyLeadCv = (mergedSlide.subLeading ?? 145) / 100;

  const bottomLim = Math.min(100 - CANVAS_AUTO_EDGE_PCT, 99);
  const TOP_SAFE_PCT = 11;
  /** Espaços verticais harmónicos (% da altura do card) entre molduras. */
  const gapTitleSub = 1.35;
  const gapPhotoTitle = 1.6;

  let zones = { ...cv.zones };

  if (cv.variant === 'classic') {
    const prevP = clampRect(zones.photo || DEFAULT_CANVAS_ZONES_CLASSIC.photo);
    const prevT = clampRect(zones.title || DEFAULT_CANVAS_ZONES_CLASSIC.title);
    const prevS = clampRect(zones.subtitle || DEFAULT_CANVAS_ZONES_CLASSIC.subtitle);
    /** Foto atrás tipo capa (`h`≈100%): texto reorganiza como bloco inferior. */
    const fullBleedPhoto = prevP.h >= 89 && prevP.y <= 2 && prevP.w >= 92;
    /** Foto só na faixa superior: título vinha logo abaixo da foto. */
    const bandPhoto = prevP.y + prevP.h <= prevT.y + 1.5;

    const ux = CANVAS_AUTO_EDGE_PCT;
    const uw = Math.max(CANVAS_ZONE_MIN.w * 4, 100 - 2 * CANVAS_AUTO_EDGE_PCT);

    const titleFs = f.w * 0.084 * (ts / 100);
    const innerTW = Math.max(f.w * 0.06, (uw / 100) * f.w - 2 * padXpx);
    const titleLinesEff = estimateWrappedLines(titleChars, titleLinesNl, innerTW, titleFs, 0.52);
    let needTitlePct = Math.min(
      44,
      ((titleLinesEff * titleFs * tLeadClassic + padYMarg + titleFs * 0.38) / f.h) * 100,
    );
    needTitlePct = Math.max(CANVAS_ZONE_MIN.h, needTitlePct);

    const subFs = f.w * 0.028 * (ss / 100);
    const innerSW = Math.max(f.w * 0.06, (uw / 100) * f.w - 2 * padXpx);
    const paras = Math.max(subLinesNl, String(mergedSlide.subtitle ?? '').split(/\n\n+/).filter((p) => p.trim()).length);
    const subLinesEff = estimateWrappedLines(subChars, Math.max(subLinesNl, paras), innerSW, subFs, 0.47);
    let needSubPct = Math.min(
      52,
      ((subLinesEff * subFs * sLeadClassic + padYMarg + subFs * 0.28) / f.h) * 100,
    );
    needSubPct = Math.max(CANVAS_ZONE_MIN.h, needSubPct);

    let photo = { ...prevP };
    let title = { ...tightenCanvasTextZoneRect(prevT), x: ux, w: uw };
    let subtitle = { ...tightenCanvasTextZoneRect(prevS), x: ux, w: uw };

    if (fullBleedPhoto) {
      photo = clampRect({ x: 0, y: 0, w: 100, h: 100 });
      let subY = bottomLim - needSubPct;
      let titY = subY - gapTitleSub - needTitlePct;
      if (titY < TOP_SAFE_PCT) {
        const shortfall = TOP_SAFE_PCT - titY;
        const roomFromSub = Math.max(0, needSubPct - CANVAS_ZONE_MIN.h - 1.2);
        const roomFromTit = Math.max(0, needTitlePct - CANVAS_ZONE_MIN.h - 1.2);
        const takeS = Math.min(roomFromSub, shortfall * 0.45);
        const takeT = Math.min(roomFromTit, shortfall - takeS);
        needSubPct = Math.max(CANVAS_ZONE_MIN.h, needSubPct - takeS);
        needTitlePct = Math.max(CANVAS_ZONE_MIN.h, needTitlePct - takeT);
        subY = bottomLim - needSubPct;
        titY = subY - Math.max(0.65, gapTitleSub * 0.65) - needTitlePct;
        if (titY < TOP_SAFE_PCT) titY = TOP_SAFE_PCT;
      }
      title = { ...title, y: titY, h: needTitlePct };
      subtitle = { ...subtitle, y: subY, h: needSubPct };
    } else if (bandPhoto) {
      let photoTop = Math.max(0, prevP.y);
      let photoH = Math.max(CANVAS_ZONE_MIN.h, prevP.h);
      let titY = photoTop + photoH + gapPhotoTitle;
      let subY = titY + needTitlePct + gapTitleSub;
      let over = subY + needSubPct - bottomLim;
      if (over > 0) {
        photoH = Math.max(CANVAS_ZONE_MIN.h, photoH - Math.min(over + 1, photoH - CANVAS_ZONE_MIN.h));
        titY = photoTop + photoH + gapPhotoTitle;
        subY = titY + needTitlePct + gapTitleSub;
        over = subY + needSubPct - bottomLim;
        if (over > 0) {
          needSubPct = Math.max(CANVAS_ZONE_MIN.h, needSubPct - over);
          subY = Math.min(subY, bottomLim - needSubPct);
          titY = subY - gapTitleSub - needTitlePct;
        }
      }
      if (titY < TOP_SAFE_PCT) titY = TOP_SAFE_PCT;
      photo = clampRect({
        ...prevP,
        y: photoTop,
        h: photoH,
        x: prevP.x,
        w: prevP.w,
      });
      title = { ...title, y: titY, h: needTitlePct };
      subtitle = { ...subtitle, y: subY, h: needSubPct };
    } else {
      /** Caso intermediário ou molduras livres — ancora subtítulo ao fundo e sobe o título, alinhando larguras. */
      let subY = bottomLim - needSubPct;
      let titY = subY - gapTitleSub - needTitlePct;
      if (titY < TOP_SAFE_PCT) titY = TOP_SAFE_PCT;
      if (titY + needTitlePct + gapTitleSub + needSubPct > bottomLim + 0.2) {
        needSubPct = Math.max(CANVAS_ZONE_MIN.h, bottomLim - (titY + needTitlePct + gapTitleSub));
        subY = bottomLim - needSubPct;
      }
      title = { ...title, y: titY, h: needTitlePct };
      subtitle = { ...subtitle, y: subY, h: needSubPct };
      let over = subtitle.y + subtitle.h - bottomLim;
      if (over > 0.12) {
        subtitle = { ...subtitle, h: Math.max(CANVAS_ZONE_MIN.h, subtitle.h - over) };
      }
      over = Math.max(0, subtitle.y + subtitle.h - bottomLim);
      if (photo.h < 99) {
        const shave = Math.min(
          over + 0.85,
          Math.max(0, photo.h - CANVAS_ZONE_MIN.h),
        );
        if (shave > 0) {
          photo = {
            ...photo,
            h: Math.max(CANVAS_ZONE_MIN.h, photo.h - shave),
          };
        }
      }
    }

    zones = { ...zones, photo: clampRect(photo), title: clampRect(title), subtitle: clampRect(subtitle) };
  } else if (cv.variant === 'sandwich') {
    const ux = CANVAS_AUTO_EDGE_PCT;
    const uw = Math.max(CANVAS_ZONE_MIN.w * 4, 100 - 2 * CANVAS_AUTO_EDGE_PCT);
    const prevTp = clampRect(zones.top || DEFAULT_CANVAS_ZONES_SANDWICH.top);
    const prevPh = clampRect(zones.photo || DEFAULT_CANVAS_ZONES_SANDWICH.photo);
    const prevBt = clampRect(zones.bottom || DEFAULT_CANVAS_ZONES_SANDWICH.bottom);

    const gapTP = Math.max(1.1, prevPh.y - (prevTp.y + prevTp.h));
    const gapPB = Math.max(1.1, prevBt.y - (prevPh.y + prevPh.h));

    const needTopMin =
      titleChars > 0 || subChars > 0 ? SANDWICH_TEXT_ZONE_MIN_H_PCT : CANVAS_ZONE_MIN.h;
    const needBotMin =
      bodyChars > 0 ? SANDWICH_TEXT_ZONE_MIN_H_PCT : CANVAS_ZONE_MIN.h;

    const innerUw = Math.max(f.w * 0.06, (uw / 100) * f.w - 2 * padXpx);
    const titFs = f.w * 0.036 * (ts / 100);
    const subFsTop = f.w * 0.031 * (ss / 100);
    const titleStackLines = estimateWrappedLines(titleChars, titleLinesNl, innerUw, titFs, 0.48);
    const subStackLines = estimateWrappedLines(subChars, subLinesNl, innerUw, subFsTop, 0.45);
    const stackGapPx = Math.max(f.h * 0.012, titFs * 0.22);
    let blkTopH = Math.min(
      58,
      ((padYMarg +
        titleStackLines * titFs * tLeadCv +
        stackGapPx +
        subStackLines * subFsTop * subLeadCv +
        titFs * 0.22) /
        f.h) *
        100,
    );
    blkTopH = Math.max(needTopMin, blkTopH);

    const bodyFs = f.w * 0.029 * (bs / 100);
    const bodyParas = Math.max(bodyLinesNl, String(mergedSlide.bodyAfterImage ?? '').split(/\n\n+/).filter((p) => p.trim()).length);
    const bodyEffLines = estimateWrappedLines(bodyChars, Math.max(bodyLinesNl, bodyParas), innerUw, bodyFs, 0.45);
    let blkBotH = Math.min(
      58,
      ((bodyEffLines * bodyFs * bodyLeadCv + padYMarg + bodyFs * 0.26) / f.h) * 100,
    );
    blkBotH = Math.max(needBotMin, Math.max(prevBt.h, blkBotH));

    const topY = CANVAS_AUTO_EDGE_PCT;
    const photoFloor = SANDWICH_PHOTO_ZONE_MIN_H_PCT;
    const photoAbsMin = SANDWICH_PHOTO_ZONE_ABSOLUTE_MIN_H_PCT;
    let photoY = topY + blkTopH + gapTP;
    let botY = bottomLim - blkBotH;
    let photoH = botY - gapPB - photoY;

    for (let iter = 0; iter < 120 && photoH < photoFloor; iter++) {
      if (blkBotH > needBotMin + 0.6) blkBotH -= 1.2;
      else if (blkTopH > needTopMin + 0.6) blkTopH -= 1.2;
      else break;
      photoY = topY + blkTopH + gapTP;
      botY = bottomLim - blkBotH;
      photoH = botY - gapPB - photoY;
    }
    if (photoH < photoFloor) {
      photoH = photoFloor;
      const maxPhotoY = bottomLim - needBotMin - gapPB - photoH;
      if (photoY > maxPhotoY) {
        blkTopH = Math.max(needTopMin, blkTopH - (photoY - maxPhotoY));
        photoY = topY + blkTopH + gapTP;
      }
      botY = photoY + photoH + gapPB;
      blkBotH = bottomLim - botY;
    }

    /** Garante altura útil mínima para o texto inferior (encolhe foto e só depois o topo). */
    const rebalanceForTextMin = () => {
      botY = photoY + photoH + gapPB;
      blkBotH = bottomLim - botY;
      let guard = 0;
      while (blkBotH + 0.08 < needBotMin && guard < 90) {
        guard += 1;
        if (photoH > photoAbsMin + 0.35) {
          photoH -= 0.95;
        } else if (blkTopH > needTopMin + 0.35) {
          blkTopH -= 0.95;
          photoY = topY + blkTopH + gapTP;
        } else {
          break;
        }
        botY = photoY + photoH + gapPB;
        blkBotH = bottomLim - botY;
      }
    };
    rebalanceForTextMin();

    const top = clampRect({ ...prevTp, x: ux, w: uw, y: topY, h: blkTopH });
    const photo = clampRect({ ...prevPh, x: ux, w: uw, y: photoY, h: photoH });
    const bottom = clampRect({ ...prevBt, x: ux, w: uw, y: botY, h: blkBotH });

    zones = { ...zones, top, photo, bottom };
  } else if (cv.variant === 'stat') {
    const ux = CANVAS_AUTO_EDGE_PCT;
    const uw = Math.max(CANVAS_ZONE_MIN.w * 4, 100 - 2 * CANVAS_AUTO_EDGE_PCT);
    const prevTp = clampRect(zones.top || DEFAULT_CANVAS_ZONES_STAT.top);
    const prevBt = clampRect(zones.bottom || DEFAULT_CANVAS_ZONES_STAT.bottom);
    const gapTB = Math.max(1.1, prevBt.y - (prevTp.y + prevTp.h));

    const statNeedTop =
      titleChars > 0 || subChars > 0 ? SANDWICH_TEXT_ZONE_MIN_H_PCT : CANVAS_ZONE_MIN.h;
    const statNeedBot =
      bodyChars > 0 ? SANDWICH_TEXT_ZONE_MIN_H_PCT : CANVAS_ZONE_MIN.h;

    const innerUw = Math.max(f.w * 0.06, (uw / 100) * f.w - 2 * padXpx);
    const titFs = f.w * 0.036 * (ts / 100);
    const subFsTop = f.w * 0.031 * (ss / 100);
    const titleStackLines = estimateWrappedLines(titleChars, titleLinesNl, innerUw, titFs, 0.48);
    const subStackLines = estimateWrappedLines(subChars, subLinesNl, innerUw, subFsTop, 0.45);
    const stackGapPx = Math.max(f.h * 0.012, titFs * 0.22);
    let blkTopH = Math.min(
      62,
      ((padYMarg +
        titleStackLines * titFs * tLeadCv +
        stackGapPx +
        subStackLines * subFsTop * subLeadCv +
        titFs * 0.22) /
        f.h) *
        100,
    );
    blkTopH = Math.max(statNeedTop, blkTopH);

    const bodyFsStat = f.w * 0.029 * (bs / 100);
    const bodyParas = Math.max(bodyLinesNl, String(mergedSlide.bodyAfterImage ?? '').split(/\n\n+/).filter((p) => p.trim()).length);
    const bodyEffLines = estimateWrappedLines(bodyChars, Math.max(bodyLinesNl, bodyParas), innerUw, bodyFsStat, 0.45);
    let blkBotH = Math.min(
      58,
      ((bodyEffLines * bodyFsStat * bodyLeadCv + padYMarg + bodyFsStat * 0.26) / f.h) * 100,
    );
    blkBotH = Math.max(statNeedBot, Math.max(prevBt.h, blkBotH));

    const topY = CANVAS_AUTO_EDGE_PCT;
    let botY = topY + blkTopH + gapTB;
    let space = bottomLim - botY;
    if (blkBotH > space - 0.35) blkBotH = Math.max(statNeedBot, space - 0.35);
    if (topY + blkTopH + gapTB + blkBotH > bottomLim) {
      blkTopH = Math.max(statNeedTop, bottomLim - gapTB - blkBotH - topY);
    }

    const top = clampRect({ ...prevTp, x: ux, w: uw, y: topY, h: blkTopH });
    botY = top.y + top.h + gapTB;
    blkBotH = Math.min(blkBotH, Math.max(statNeedBot, bottomLim - botY - 0.35));
    const bot = clampRect({ ...prevBt, x: ux, w: uw, y: botY, h: blkBotH });

    zones = { ...zones, top, bottom: bot };
  }

  return {
    zones,
    textInsetAdvice: insetCalc > baselineInsetPad ? insetCalc : null,
  };
}

/**
 * Igual ao trato do botão «Ajuste automático»: aplica zonas já calibradas e `textInset` se preciso.
 * Usado após IA gerar layouts (caps full-bleed 1º/último + canvas) para evitar texto fora das margens.
 */
function applyFinalizeCanvasMarginsToSlides(slides, fmt = 'carrossel') {
  const fFmt = FORMATS[fmt] || FORMATS.carrossel;
  return slides.map((slide) => {
    if (!slide.canvas?.zones || typeof slide.canvas.zones !== 'object' || !slide.canvas.variant)
      return slide;
    const fin = finalizeCanvasMarginsForAutoAdjust(slide, fFmt);
    if (!fin?.zones) return slide;
    const next = {
      ...slide,
      canvas: { ...slide.canvas, zones: fin.zones },
    };
    const insetAdv = fin.textInsetAdvice;
    if (insetAdv != null) {
      const cur = next.textInset ?? DEFAULT_SLIDE_TEXT_INSET;
      if (insetAdv > cur) next.textInset = insetAdv;
    }
    if (next.canvas.variant === 'classic') {
      const ph = clampRect(next.canvas.zones.photo || DEFAULT_CANVAS_ZONES_CLASSIC.photo);
      const fullBleed = ph.h >= 89 && ph.y <= 2 && ph.w >= 92;
      if (fullBleed && next.layout === 'mc') {
        next.layout = next.align === 'center' || next.align === 'justify' ? 'bc' : 'bl';
      }
    }
    return next;
  });
}

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

/** Ao mudar `titleSize` / `subSize` com canvas ativo: escala alturas das molduras de texto (~tamanho do tipo); a zona foto cede espaço até ao mínimo. */
function canvasZonesFontScalePatch(prevSlide, mergedSlide) {
  const canvas = mergedSlide.canvas;
  if (!canvas?.enabled || !canvas.zones || typeof canvas.zones !== 'object' || !canvas.variant) return null;

  const oldT = prevSlide.titleSize ?? 100;
  const oldS = prevSlide.subSize ?? 100;
  const oldB = prevSlide.bodyAfterSize ?? prevSlide.subSize ?? 100;
  const newT = mergedSlide.titleSize ?? 100;
  const newS = mergedSlide.subSize ?? 100;
  const newB = mergedSlide.bodyAfterSize ?? mergedSlide.subSize ?? 100;
  const rT = newT / oldT;
  const rS = newS / oldS;
  const rB = newB / oldB;
  if (
    Math.abs(rT - 1) < 0.003 &&
    Math.abs(rS - 1) < 0.003 &&
    Math.abs(rB - 1) < 0.003
  ) return null;

  const zIn = mergedSlide.canvas.zones;

  if (canvas.variant === 'classic') {
    const photo = clampRect(zIn.photo || DEFAULT_CANVAS_ZONES_CLASSIC.photo);
    const title = clampRect(zIn.title || DEFAULT_CANVAS_ZONES_CLASSIC.title);
    const sub = clampRect(zIn.subtitle || DEFAULT_CANVAS_ZONES_CLASSIC.subtitle);
    const gapTS = Math.max(0.5, sub.y - (title.y + title.h));
    const newTitleH = Math.max(CANVAS_ZONE_MIN.h, title.h * rT);
    const newSubH = Math.max(CANVAS_ZONE_MIN.h, sub.h * rS);
    const subY = title.y + newTitleH + gapTS;
    let overflow = subY + newSubH - 98;
    let photoNext = { ...photo };
    if (overflow > 0) {
      const shrink = Math.min(overflow + 0.75, Math.max(0, photoNext.h - CANVAS_ZONE_MIN.h));
      photoNext.h = Math.max(CANVAS_ZONE_MIN.h, photoNext.h - shrink);
      overflow -= shrink;
    }
    const adjSubH = overflow > 0
      ? Math.max(CANVAS_ZONE_MIN.h, newSubH - overflow)
      : newSubH;
    return {
      canvas: {
        ...canvas,
        zones: {
          ...zIn,
          photo: clampRect(photoNext),
          title: clampRect({ ...title, h: newTitleH }),
          subtitle: clampRect({ ...sub, y: subY, h: adjSubH }),
        },
      },
    };
  }

  if (canvas.variant === 'sandwich') {
    const photoFloor = SANDWICH_PHOTO_ZONE_MIN_H_PCT;
    const photoAbsMin = SANDWICH_PHOTO_ZONE_ABSOLUTE_MIN_H_PCT;
    const needTopMin =
      String(mergedSlide.title ?? '').trim().length > 0 || String(mergedSlide.subtitle ?? '').trim().length > 0
        ? SANDWICH_TEXT_ZONE_MIN_H_PCT
        : CANVAS_ZONE_MIN.h;
    const needBotMin =
      String(mergedSlide.bodyAfterImage ?? '').trim().length > 0 ? SANDWICH_TEXT_ZONE_MIN_H_PCT : CANVAS_ZONE_MIN.h;
    const top = clampRect(zIn.top || DEFAULT_CANVAS_ZONES_SANDWICH.top);
    const photo = clampRect(zIn.photo || DEFAULT_CANVAS_ZONES_SANDWICH.photo);
    const bottom = clampRect(zIn.bottom || DEFAULT_CANVAS_ZONES_SANDWICH.bottom);
    const gapTP = Math.max(0.5, photo.y - (top.y + top.h));
    const gapPB = Math.max(0.5, bottom.y - (photo.y + photo.h));
    const newTopH = Math.max(needTopMin, top.h * Math.max(rT, rS));
    const newBotH = Math.max(needBotMin, bottom.h * rB);
    const photoY = top.y + newTopH + gapTP;
    let botY = bottom.y;
    let botHAdj = newBotH;
    if (botY + botHAdj > 98) botY = 98 - botHAdj;
    let photoH = botY - gapPB - photoY;
    if (photoH < photoFloor) {
      const shortage = photoFloor - photoH;
      botHAdj = Math.max(needBotMin, botHAdj - shortage);
      botY = Math.min(bottom.y, 98 - botHAdj);
      photoH = Math.max(photoAbsMin, botY - gapPB - photoY);
      if (photoH < photoFloor) {
        botY = Math.min(98 - needBotMin, photoY + gapPB + photoFloor);
        botHAdj = Math.max(needBotMin, 98 - botY);
        photoH = Math.max(photoAbsMin, botY - gapPB - photoY);
      }
    }
    botY = photoY + photoH + gapPB;
    let spaceForBottom = 98 - botY;
    let guardFs = 0;
    while (spaceForBottom + 0.08 < needBotMin && photoH > photoAbsMin + 0.35 && guardFs < 90) {
      guardFs += 1;
      photoH -= 0.95;
      botY = photoY + photoH + gapPB;
      spaceForBottom = 98 - botY;
    }
    botHAdj = 98 - botY;

    return {
      canvas: {
        ...canvas,
        zones: {
          ...zIn,
          top: clampRect({ ...top, h: newTopH }),
          photo: clampRect({ ...photo, y: photoY, h: photoH }),
          bottom: clampRect({ ...bottom, y: botY, h: botHAdj }),
        },
      },
    };
  }

  if (canvas.variant === 'stat') {
    const top = clampRect(zIn.top || DEFAULT_CANVAS_ZONES_STAT.top);
    const bot = clampRect(zIn.bottom || DEFAULT_CANVAS_ZONES_STAT.bottom);
    const gapTB = Math.max(0.5, bot.y - (top.y + top.h));
    const newTopH = Math.max(CANVAS_ZONE_MIN.h, top.h * Math.max(rT, rS));
    const newBotH = Math.max(CANVAS_ZONE_MIN.h, bot.h * Math.max(rS, rB));
    const botY = top.y + newTopH + gapTB;
    const overflow = botY + newBotH - 98;
    const adjBotH = overflow > 0
      ? Math.max(CANVAS_ZONE_MIN.h, newBotH - overflow)
      : newBotH;
    return {
      canvas: {
        ...canvas,
        zones: {
          ...zIn,
          top: clampRect({ ...top, h: newTopH }),
          bottom: clampRect({ ...bot, y: botY, h: adjBotH }),
        },
      },
    };
  }

  return null;
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

/** `<img>` na zona foto (canvas sanduíche/stat) — mesmo raciocínio que `background-*` no modo classic (X/Y, zoom, fit, espelho, opacidade). */
function sandwichPhotoZoneImgStyle(slide, presentationFilter) {
  const bgFit = slide.bgFit ?? 'cover';
  const bx = slide.bgX ?? 50;
  const by = slide.bgY ?? 50;
  const origin = `${bx}% ${by}%`;
  const zoom = (slide.bgZoom ?? 100) / 100;
  const mirror = slide.bgMirror ? 'scaleX(-1) ' : '';
  const filt = presentationFilter ? { filter: presentationFilter } : {};
  const op = (slide.bgOpacity ?? 100) / 100;
  const transform = `${mirror}${zoom !== 1 ? `scale(${zoom})` : ''}`.trim() || undefined;

  if (bgFit === 'contain') {
    return {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      objectPosition: origin,
      transform,
      transformOrigin: origin,
      opacity: op,
      ...filt,
    };
  }

  return {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: origin,
    transform,
    transformOrigin: origin,
    opacity: op,
    ...filt,
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
function OverflowScaler({ containerStyle, deps = [], minScale = 0.55, children }) {
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
        displayTitleInk = '#f5f5f7';
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
          minScale={0.6}
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
          minScale={0.6}
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

  return (
    <div style={{
      width:f.w*scale, height:f.h*scale,
      position:'relative', overflow:'hidden',
      borderRadius: scale < 0.9 ? 10 : 0,
      flexShrink:0, background: outerBg,
    }}>
      <div style={{ transform:`scale(${scale})`, transformOrigin:'top left', width:f.w, height:f.h }}>
        {inner}
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

const S = ({ title, children, className='', hint }) => (
  <div className={className} style={{ display:'flex', flexDirection:'column', gap:10 }}>
    <div className="section-label">{title}</div>
    {hint && (
      <div style={{
        fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-ui)',
        lineHeight:1.5, marginTop:-4, marginBottom:2,
      }}>{hint}</div>
    )}
    {children}
  </div>
);

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

// ─── SCROLL LOCK (modais grandes) ────────────────────────────────────────────
// Trava scroll do body enquanto modal está aberto + preserva scroll position no close.
// Conta abertura simultânea de múltiplos modais (caso raro de modal sobre modal).
let __vcScrollLockCount = 0;
let __vcSavedScrollY = 0;
function useScrollLock(active) {
  React.useEffect(() => {
    if (!active) return undefined;
    if (__vcScrollLockCount === 0) {
      __vcSavedScrollY = window.scrollY || 0;
      const body = document.body;
      body.style.position = 'fixed';
      body.style.top = `-${__vcSavedScrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.overflow = 'hidden';
    }
    __vcScrollLockCount++;
    return () => {
      __vcScrollLockCount--;
      if (__vcScrollLockCount <= 0) {
        __vcScrollLockCount = 0;
        const body = document.body;
        body.style.position = '';
        body.style.top = '';
        body.style.left = '';
        body.style.right = '';
        body.style.overflow = '';
        window.scrollTo(0, __vcSavedScrollY);
      }
    };
  }, [active]);
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

function PromptDialog({ open, title, defaultValue='', placeholder='', label='', cta='OK', onConfirm, onClose }) {
  const [val, setVal] = useState(defaultValue);
  const inputRef = useRef(null);
  useEffect(() => {
    if (open) {
      setVal(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open, defaultValue]);
  if (!open) return null;
  const submit = () => {
    const v = val.trim();
    if (!v) return;
    onConfirm(v);
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e=>e.stopPropagation()} style={{ maxWidth:420 }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
        }}>
          <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>{title}</div>
          <button onClick={onClose} aria-label="Fechar" className="vc-icon-btn">
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
          {label && (
            <label className="vc-label" style={{ marginBottom:0 }}>
              {label}
            </label>
          )}
          <input
            ref={inputRef}
            value={val}
            onChange={e=>setVal(e.target.value)}
            placeholder={placeholder}
            className="vc-input"
            onKeyDown={e=>{
              if(e.key==='Enter') submit();
              if(e.key==='Escape') onClose();
            }}
          />
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={onClose} className="vc-btn vc-btn-ghost" style={{ height:38, padding:'0 14px' }}>Cancelar</button>
            <button onClick={submit} disabled={!val.trim()} className="vc-btn vc-btn-primary" style={{ height:38, padding:'0 16px', opacity: val.trim() ? 1 : 0.4 }}>
              {cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── IMAGE CROP MODAL ─────────────────────────────────────────────────────────
/** Recorta a imagem de fundo no canvas; proporção 4:5 opcional (feed Instagram). */
function ImageCropModal({ open, imageSrc, onClose, onApply }) {
  useScrollLock(open);
  const carAr = FORMATS.carrossel.w / FORMATS.carrossel.h;
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [cropN, setCropN] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [lockStory, setLockStory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const dragRef = useRef(null);
  const natRef = useRef({ w: 0, h: 0 });
  const dispRef = useRef({ w: 0, h: 0 });
  const lockStoryRef = useRef(true);
  lockStoryRef.current = lockStory;

  const maxWp = typeof window !== 'undefined' ? Math.min(520, window.innerWidth - 48) : 520;
  const maxHp = typeof window !== 'undefined' ? Math.min(Math.floor(window.innerHeight * 0.46), 440) : 440;
  const previewScale =
    open && nat.w > 0 && nat.h > 0 ? Math.min(maxWp / nat.w, maxHp / nat.h, 1) : 1;
  const dwPx = open && nat.w > 0 ? Math.max(1, Math.round(nat.w * previewScale)) : 1;
  const dhPx = open && nat.h > 0 ? Math.max(1, Math.round(nat.h * previewScale)) : 1;
  natRef.current = nat;
  dispRef.current = { w: dwPx, h: dhPx };

  const fullImageCrop = useCallback((nw, nh) => ({ x: 0, y: 0, w: nw, h: nh }), []);

  const centeredLockedCrop = useCallback((nw, nh) => {
    let iw = Math.min(nw, nh * carAr);
    let ih = iw / carAr;
    if (ih > nh) {
      ih = nh;
      iw = ih * carAr;
    }
    return { x: (nw - iw) / 2, y: (nh - ih) / 2, w: iw, h: ih };
  }, [carAr]);

  useEffect(() => {
    if (!open || !imageSrc) {
      setNat({ w: 0, h: 0 });
      setCropN({ x: 0, y: 0, w: 0, h: 0 });
      setHint('');
      return;
    }
    setBusy(false);
    setHint('');
    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (!nw || !nh) {
        setHint('Imagem com dimensão inválida.');
        return;
      }
      setNat({ w: nw, h: nh });
      const init = lockStoryRef.current ? centeredLockedCrop(nw, nh) : fullImageCrop(nw, nh);
      setCropN(init);
    };
    img.onerror = () => setHint('Não foi possível carregar esta imagem.');
    if (!String(imageSrc).startsWith('data:')) img.crossOrigin = 'anonymous';
    img.src = imageSrc;
  }, [open, imageSrc, centeredLockedCrop, fullImageCrop]);

  useEffect(() => {
    if (!nat.w || !nat.h) return;
    setCropN(lockStory ? centeredLockedCrop(nat.w, nat.h) : fullImageCrop(nat.w, nat.h));
  }, [lockStory]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!open) return undefined;
    const minSideNat = () => Math.max(32, Math.min(natRef.current.w, natRef.current.h) * 0.04);
    const onMove = (e) => {
      const st = dragRef.current;
      if (!st || st.pointerId !== e.pointerId || !natRef.current.w || !dispRef.current.w) return;
      const nw = natRef.current.w;
      const nh = natRef.current.h;
      const dw = dispRef.current.w;
      const dh = dispRef.current.h;
      const dxN = ((e.clientX - st.cx) / dw) * nw;
      const dyN = ((e.clientY - st.cy) / dh) * nh;
      if (st.kind === 'move') {
        const min = minSideNat();
        const w = st.cw;
        const h = st.ch;
        let nx = st.ox + dxN;
        let ny = st.oy + dyN;
        nx = Math.min(Math.max(0, nx), nw - w);
        ny = Math.min(Math.max(0, ny), nh - h);
        if (w < min || h < min) return;
        setCropN({ x: nx, y: ny, w, h });
      } else if (st.kind === 'resize-se') {
        const mn = minSideNat();
        const ox = st.ox;
        const oy = st.oy;
        let brx = Math.min(Math.max(st.brx + dxN, ox + mn), nw);
        let bry = Math.min(Math.max(st.bry + dyN, oy + mn), nh);
        let nwR = brx - ox;
        let nhR = lockStoryRef.current ? nwR / carAr : bry - oy;
        if (lockStoryRef.current) {
          const maxW = nw - ox;
          const maxH = nh - oy;
          if (nwR > maxW) {
            nwR = maxW;
            nhR = nwR / carAr;
          }
          if (nhR > maxH) {
            nhR = maxH;
            nwR = nhR * carAr;
          }
        } else {
          nwR = Math.min(Math.max(nwR, mn), nw - ox);
          nhR = Math.min(Math.max(nhR, mn), nh - oy);
        }
        let minNw = nwR >= mn ? nwR : mn;
        let minNh = lockStoryRef.current ? minNw / carAr : (nhR >= mn ? nhR : mn);
        if (lockStoryRef.current && oy + minNh > nh) minNh = nh - oy;
        if (!lockStoryRef.current && oy + minNh > nh) minNh = nh - oy;
        if (ox + minNw > nw) minNw = nw - ox;
        if (lockStoryRef.current) minNh = minNw / carAr;
        setCropN({ x: ox, y: oy, w: minNw, h: minNh });
      }
    };
    const onUp = (e) => {
      if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [open, carAr, dwPx, dhPx]);

  function badMouseButton(ev) {
    return ev.pointerType === 'mouse' && ev.button !== 0;
  }

  const startMove = (e) => {
    if (!nat.w || badMouseButton(e)) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { /* noop */ }
    dragRef.current = {
      pointerId: e.pointerId,
      kind: 'move',
      cx: e.clientX,
      cy: e.clientY,
      ox: cropN.x,
      oy: cropN.y,
      cw: cropN.w,
      ch: cropN.h,
    };
  };

  const startResizeSe = (e) => {
    e.stopPropagation();
    if (badMouseButton(e)) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { /* noop */ }
    dragRef.current = {
      pointerId: e.pointerId,
      kind: 'resize-se',
      cx: e.clientX,
      cy: e.clientY,
      ox: cropN.x,
      oy: cropN.y,
      brx: cropN.x + cropN.w,
      bry: cropN.y + cropN.h,
    };
  };

  const handleApply = () => {
    if (!nat.w || !nat.h || busy || !imageSrc) return;
    setBusy(true);
    setHint('');
    queueMicrotask(() => {
      const img = new Image();
      img.crossOrigin = String(imageSrc).startsWith('data:') ? undefined : 'anonymous';
      img.onload = () => {
        try {
          const sx = Math.max(0, Math.min(Math.floor(cropN.x), img.naturalWidth - 2));
          const sy = Math.max(0, Math.min(Math.floor(cropN.y), img.naturalHeight - 2));
          let sw = Math.max(2, Math.floor(cropN.w));
          let sh = Math.max(2, Math.floor(cropN.h));
          sw = Math.min(sw, img.naturalWidth - sx);
          sh = Math.min(sh, img.naturalHeight - sy);
          const maxSide = 2200;
          const ds = Math.min(1, maxSide / Math.max(sw, sh));
          const cw = Math.max(2, Math.round(sw * ds));
          const ch = Math.max(2, Math.round(sh * ds));
          const canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('no ctx');
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
          onApply(canvas.toDataURL('image/jpeg', 0.92));
          onClose();
        } catch {
          setHint(
            'Exportação falhou: URLs externas por vezes bloqueiam leitura. Use Upload neste card ou gere outra imagem.',
          );
        } finally {
          setBusy(false);
        }
      };
      img.onerror = () => {
        setHint('Erro ao processar a imagem.');
        setBusy(false);
      };
      img.src = imageSrc;
    });
  };

  if (!open) return null;

  const pctLeft = nat.w ? (cropN.x / nat.w) * 100 : 0;
  const pctTop = nat.h ? (cropN.y / nat.h) * 100 : 0;
  const pctW = nat.w ? (cropN.w / nat.w) * 100 : 100;
  const pctH = nat.h ? (cropN.h / nat.h) * 100 : 100;
  const cantApply = busy || !nat.w || cropN.w < 2 || cropN.h < 2;

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal-panel vc-modal-scroll" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: 560 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--hairline)',
          flexShrink: 0,
          background: 'var(--bg-sidebar)',
        }}>
          <div style={{ fontSize: 17, fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '-0.022em', color: 'var(--text-primary)' }}>
            Recortar imagem do card
          </div>
          <button type="button" onClick={() => !busy && onClose()} aria-label="Fechar" disabled={busy} className="vc-icon-btn" style={{ cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.4 : 1 }}>
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{
            margin: 0, fontSize: 13, lineHeight: 1.47, letterSpacing: '-0.011em', fontWeight: 400,
            color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
          }}>
            Arraste a moldura para posicionar; puxe o canto inferior direito para redimensionar. Opção «4:5» alinha ao feed (1080×1350).
          </p>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            letterSpacing: '-0.011em', fontFamily: 'var(--font-ui)', color: 'var(--text-secondary)', userSelect: 'none',
          }}>
            <input type="checkbox" checked={lockStory} disabled={busy} onChange={(ev) => setLockStory(ev.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: busy ? 'not-allowed' : 'pointer' }}/>
            Travar proporção 4:5 (feed Instagram)
          </label>
          {hint ? (
            <div style={{
              fontSize: 11, lineHeight: 1.47, fontFamily: 'var(--font-ui)', letterSpacing: '-0.011em',
              color: '#c5251c', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.18)',
              borderRadius: 11, padding: '8px 10px',
            }}>{hint}</div>
          ) : null}
          <div style={{
            position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#000', borderRadius: 11, overflow: 'hidden', border: '1px solid var(--hairline)',
            maxHeight: 'min(52vh, 460px)', minHeight: 140,
          }}>
            {!nat.w ? (
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, padding: '24px 12px', fontFamily: 'var(--font-ui)' }}>A carregar…</span>
            ) : (
              <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0, maxHeight: 'min(52vh, 460px)' }}>
                <img
                  src={imageSrc}
                  alt=""
                  draggable={false}
                  crossOrigin={String(imageSrc).startsWith('data:') ? undefined : 'anonymous'}
                  style={{
                    display: 'block', maxWidth: '100%', width: 'auto', height: 'auto',
                    maxHeight: 'min(52vh, 460px)', objectFit: 'contain',
                  }}
                />
                <div
                  style={{
                    position: 'absolute', left: `${pctLeft}%`, top: `${pctTop}%`, width: `${pctW}%`, height: `${pctH}%`,
                    boxSizing: 'border-box', border: '2px solid #fff', boxShadow: '0 0 0 4096px rgba(0,0,0,0.5)',
                    cursor: 'grab', touchAction: 'none',
                  }}
                  onPointerDown={startMove}
                >
                  <div
                    data-crop-handle="se"
                    title="Redimensionar"
                    onPointerDown={startResizeSe}
                    style={{
                      position: 'absolute', right: -8, bottom: -8, width: 22, height: 22, borderRadius: 4,
                      background: 'var(--accent)', border: '2px solid #fff', cursor: 'nwse-resize', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => !busy && onClose()} disabled={busy} className="vc-btn vc-btn-ghost" style={{ height: 40, padding: '0 16px' }}>Cancelar</button>
            <button type="button" disabled={cantApply} onClick={handleApply} className="vc-btn vc-btn-primary" style={{ height: 40, padding: '0 22px', borderRadius: 9999, opacity: cantApply ? 0.42 : 1 }}>
              {busy ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }}/> : 'Aplicar recorte'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PHOTO POSITION MODAL ─────────────────────────────────────────────────────
// Modal grande para reposicionar/zoomar a foto dentro do card sem CROP destrutivo.
// Edita slide.bgX / slide.bgY (0..100, % do objectPosition) + slide.bgZoom (50..300%).
// Drag direto no preview = atualiza bgX/bgY em tempo real. Espelhamento e reset rápidos.
function PhotoPositionModal({ open, slide, fmt, onClose, onChange }) {
  useScrollLock(open);
  const dragRef = React.useRef(null);
  const previewRef = React.useRef(null);
  const f = FORMATS[fmt] || FORMATS.carrossel;
  const aspect = f.w / f.h;
  if (!open || !slide?.bgImage) return null;
  const bgX = slide.bgX ?? 50;
  const bgY = slide.bgY ?? 50;
  const bgZoom = slide.bgZoom ?? 100;
  const bgMirror = !!slide.bgMirror;
  const onPointerDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    const el = previewRef.current;
    if (!el) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBgX: bgX,
      startBgY: bgY,
      rect: el.getBoundingClientRect(),
    };
  };
  const onPointerMove = (e) => {
    const st = dragRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    const dxPx = e.clientX - st.startClientX;
    const dyPx = e.clientY - st.startClientY;
    // Mover a foto pra direita visualmente = bgX diminui (objectPosition mostra o lado esquerdo da foto)
    // Inversão dx/dy x sinal pra UX intuitiva (arrasta foto = foto vai junto):
    const factor = 100 / Math.max(1, bgZoom / 100);
    let nextX = st.startBgX - (dxPx / st.rect.width) * 100 * factor;
    let nextY = st.startBgY - (dyPx / st.rect.height) * 100 * factor;
    nextX = Math.max(0, Math.min(100, nextX));
    nextY = Math.max(0, Math.min(100, nextY));
    onChange({ bgX: Math.round(nextX), bgY: Math.round(nextY) });
  };
  const onPointerUp = (e) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  };
  const previewW = Math.min(520, typeof window !== 'undefined' ? window.innerWidth - 48 : 520);
  const previewH = Math.round(previewW / aspect);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: previewW + 48 }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--bg-sidebar)', zIndex:1,
        }}>
          <div>
            <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>Posicionar foto</div>
            <div className="vc-eyebrow">Arraste a foto para mover · use o zoom abaixo</div>
          </div>
          <button onClick={onClose} className="vc-icon-btn" aria-label="Fechar">
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
          <div
            ref={previewRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              width: previewW, height: previewH,
              borderRadius: 10, overflow:'hidden', position:'relative',
              background:'#0a0a0c',
              cursor: dragRef.current ? 'grabbing' : 'grab',
              touchAction: 'none',
              boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
              margin: '0 auto',
            }}
          >
            <img
              src={slide.bgImage}
              alt=""
              draggable={false}
              style={{
                position:'absolute', inset:0, width:'100%', height:'100%',
                objectFit:'cover',
                objectPosition:`${bgX}% ${bgY}%`,
                transform: `${bgMirror ? 'scaleX(-1) ' : ''}${bgZoom !== 100 ? `scale(${bgZoom/100})` : ''}`.trim() || undefined,
                transformOrigin: `${bgX}% ${bgY}%`,
                pointerEvents:'none', userSelect:'none',
              }}
            />
            {/* Grade rule-of-thirds + crosshair central pra ajudar centralização */}
            <svg
              width={previewW} height={previewH}
              style={{ position:'absolute', inset:0, pointerEvents:'none', opacity:0.42 }}
            >
              <line x1={previewW/3} y1={0} x2={previewW/3} y2={previewH} stroke="#fff" strokeWidth="1" strokeDasharray="4 4"/>
              <line x1={2*previewW/3} y1={0} x2={2*previewW/3} y2={previewH} stroke="#fff" strokeWidth="1" strokeDasharray="4 4"/>
              <line x1={0} y1={previewH/3} x2={previewW} y2={previewH/3} stroke="#fff" strokeWidth="1" strokeDasharray="4 4"/>
              <line x1={0} y1={2*previewH/3} x2={previewW} y2={2*previewH/3} stroke="#fff" strokeWidth="1" strokeDasharray="4 4"/>
              <circle cx={previewW/2} cy={previewH/2} r="6" fill="none" stroke="#fff" strokeWidth="1.5"/>
              <line x1={previewW/2-12} y1={previewH/2} x2={previewW/2+12} y2={previewH/2} stroke="#fff" strokeWidth="1.5"/>
              <line x1={previewW/2} y1={previewH/2-12} x2={previewW/2} y2={previewH/2+12} stroke="#fff" strokeWidth="1.5"/>
            </svg>
            <div style={{
              position:'absolute', top:8, left:8,
              background:'rgba(0,0,0,0.5)', color:'#fff', backdropFilter:'blur(6px)',
              fontSize:10, fontFamily:'var(--font-mono)', padding:'4px 8px', borderRadius:6,
              letterSpacing:'0.04em',
            }}>
              X:{bgX}% · Y:{bgY}% · {bgZoom}%
            </div>
          </div>

          <div>
            <label className="vc-label-sm" style={{ display:'flex', justifyContent:'space-between' }}>
              <span>Zoom</span>
              <span style={{ color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>{bgZoom}%</span>
            </label>
            <input
              type="range"
              min={50}
              max={300}
              value={bgZoom}
              onChange={(e) => onChange({ bgZoom: Number(e.target.value) })}
              style={{ width:'100%', accentColor:'var(--accent)' }}
            />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
            <button
              type="button"
              onClick={() => onChange({ bgX: 50, bgY: 50, bgZoom: 100, bgMirror: false })}
              className="vc-btn vc-btn-ghost"
              style={{ height: 36, fontSize: 12, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}
              title="Resetar pra valores neutros"
            >
              <RotateCcw size={12} aria-hidden/> Reset
            </button>
            <button
              type="button"
              onClick={() => onChange({ bgX: 50, bgY: 50 })}
              className="vc-btn vc-btn-ghost"
              style={{ height: 36, fontSize: 12, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}
              title="Apenas centralizar (mantém zoom e espelho)"
            >
              <Move size={12} aria-hidden/> Centralizar
            </button>
            <button
              type="button"
              onClick={() => onChange({ bgMirror: !bgMirror })}
              className="vc-btn vc-btn-ghost"
              style={{
                height: 36, fontSize: 12,
                background: bgMirror ? 'var(--success-surface)' : undefined,
                borderColor: bgMirror ? 'var(--accent)' : undefined,
                display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
              }}
              title="Espelhar horizontalmente"
            >
              <FlipHorizontal2 size={12} aria-hidden/> Espelhar
            </button>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:4 }}>
            <button type="button" onClick={onClose} className="vc-btn vc-btn-primary" style={{ height:40, padding:'0 22px', borderRadius:9999 }}>
              Pronto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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

function KeysModal({
  open, onClose, openaiKey, onSave, onRefreshStatus,
  openaiKeyPersist, onChangePersist, claudeModel, onChangeClaudeModel,
  anthropicKey, onSaveAnthropic, anthropicKeyPersist, onChangeAnthropicPersist,
}) {
  const [val, setVal] = useState(openaiKey || '');
  const [persist, setPersist] = useState(!!openaiKeyPersist);
  const [model, setModel] = useState(claudeModel || 'sonnet');
  const [anthropicVal, setAnthropicVal] = useState(anthropicKey || '');
  const [anthropicPersistVal, setAnthropicPersistVal] = useState(!!anthropicKeyPersist);
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (open) {
      setVal(openaiKey || '');
      setPersist(!!openaiKeyPersist);
      setModel(claudeModel || 'sonnet');
      setAnthropicVal(anthropicKey || '');
      setAnthropicPersistVal(!!anthropicKeyPersist);
      getServerStatus({ force: true }).then(s => {
        setStatus(s);
        onRefreshStatus?.(s);
      });
    }
  }, [open, openaiKey, openaiKeyPersist, claudeModel, anthropicKey, anthropicKeyPersist, onRefreshStatus]);
  if (!open) return null;
  const save = () => {
    onSave(val.trim());
    onChangePersist?.(persist);
    onChangeClaudeModel?.(model);
    onSaveAnthropic?.(anthropicVal.trim());
    onChangeAnthropicPersist?.(anthropicPersistVal);
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e=>e.stopPropagation()} style={{ maxWidth:420 }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--bg-sidebar)', zIndex:1,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:32, height:32, borderRadius:8, background:'rgba(255,255,255,0.06)',
              display:'flex', alignItems:'center', justifyContent:'center',
              border:'1px solid var(--border)',
            }}>
              <Settings size={14} color="var(--text-secondary)"/>
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>Chaves de API</div>
              <div className="vc-eyebrow">Conecte suas chaves de IA</div>
            </div>
          </div>
          <button onClick={onClose} className="vc-icon-btn" aria-label="Fechar">
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:18 }}>
          {/* Intro — explica o quê, por quê, como obter */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.018em', marginBottom:4 }}>
                Conecte uma chave pra começar
              </div>
              <div style={{ fontSize:12, lineHeight:1.5, color:'var(--text-muted)', fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>
                A IA escreve o copy dos cards e gera as fotos. Você só precisa de uma chave — duas dão o melhor resultado.
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {/* OpenAI — recomendado (border accent) */}
              <div style={{
                position:'relative',
                border:'1.5px solid var(--accent)',
                background:'var(--success-surface)',
                borderRadius:11, padding:'12px 12px 14px',
                display:'flex', flexDirection:'column', gap:6,
              }}>
                <div style={{
                  position:'absolute', top:-9, left:10,
                  fontSize:9, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase',
                  background:'var(--accent)', color:'#fff',
                  padding:'3px 8px', borderRadius:9999, fontFamily:'var(--font-ui)',
                }}>Recomendado</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.014em' }}>OpenAI</span>
                  <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.02em' }}>GPT-4o · DALL·E</span>
                </div>
                <div style={{ fontSize:11, lineHeight:1.5, color:'var(--text-secondary)', fontFamily:'var(--font-ui)' }}>
                  Texto <strong>e</strong> imagens numa chave só. Mais simples pra começar.
                </div>
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                   style={{ marginTop:'auto', fontSize:11, color:'var(--accent)', fontFamily:'var(--font-mono)', textDecoration:'none', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}
                   onMouseEnter={e=>e.currentTarget.style.textDecoration='underline'}
                   onMouseLeave={e=>e.currentTarget.style.textDecoration='none'}>
                  Obter chave →
                </a>
              </div>

              {/* Anthropic — opcional */}
              <div style={{
                border:'1px solid var(--border)',
                background:'var(--bg-card)',
                borderRadius:11, padding:'12px 12px 14px',
                display:'flex', flexDirection:'column', gap:6,
              }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.014em' }}>Anthropic</span>
                  <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.02em' }}>Claude · web search</span>
                </div>
                <div style={{ fontSize:11, lineHeight:1.5, color:'var(--text-secondary)', fontFamily:'var(--font-ui)' }}>
                  Copy mais editorial e profundo. Com OpenAI junto = melhor combo.
                </div>
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
                   style={{ marginTop:'auto', fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-mono)', textDecoration:'none', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}
                   onMouseEnter={e=>{ e.currentTarget.style.color='var(--accent)'; e.currentTarget.style.textDecoration='underline'; }}
                   onMouseLeave={e=>{ e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.textDecoration='none'; }}>
                  Obter chave →
                </a>
              </div>
            </div>

            <div style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-ui)', lineHeight:1.5, padding:'8px 2px 0' }}>
              <Lock size={11} aria-hidden style={{ marginTop:1, flexShrink:0 }}/>
              <span>
                As chaves ficam <strong style={{ color:'var(--text-secondary)' }}>só no seu navegador</strong>. Custos vão direto pra sua conta da Anthropic/OpenAI — você controla o uso.
              </span>
            </div>
          </div>

          <div>
            <label className="vc-label">
              Anthropic API Key — Claude (texto + web search)
            </label>
            <input
              type="password"
              value={anthropicVal}
              onChange={e=>setAnthropicVal(e.target.value)}
              placeholder="sk-ant-..."
              className="vc-input"
              onKeyDown={e=>e.key==='Enter'&&save()}
            />
            <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-ui)', marginTop:8, lineHeight:1.5 }}>
              Obtenha em{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
                 style={{ color:'var(--accent)', fontFamily:'var(--font-mono)', textDecoration:'none' }}
                 onMouseEnter={e=>e.currentTarget.style.textDecoration='underline'}
                 onMouseLeave={e=>e.currentTarget.style.textDecoration='none'}>
                console.anthropic.com/settings/keys
              </a>
              . A chave fica salva apenas no seu navegador.
            </div>
            <label style={{
              display:'flex', alignItems:'center', gap:8, marginTop:10, fontSize:12,
              color:'var(--text-secondary)', fontFamily:'var(--font-ui)', cursor:'pointer',
              userSelect:'none',
            }}>
              <input
                type="checkbox"
                checked={anthropicPersistVal}
                onChange={(e) => setAnthropicPersistVal(e.target.checked)}
                style={{ accentColor:'var(--accent)', width:14, height:14 }}
              />
              <span>Manter chave Anthropic salva entre sessões (localStorage)</span>
            </label>
          </div>

          <div>
            <label className="vc-label">
              OpenAI API Key — gpt-4o + GPT Image 2
            </label>
            <input
              type="password"
              value={val}
              onChange={e=>setVal(e.target.value)}
              placeholder="sk-proj-..."
              className="vc-input"
              onKeyDown={e=>e.key==='Enter'&&save()}
            />
            <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-ui)', marginTop:8, lineHeight:1.5 }}>
              Obtenha em{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                 style={{ color:'var(--accent)', fontFamily:'var(--font-mono)', textDecoration:'none' }}
                 onMouseEnter={e=>e.currentTarget.style.textDecoration='underline'}
                 onMouseLeave={e=>e.currentTarget.style.textDecoration='none'}>
                platform.openai.com/api-keys
              </a>
              {!anthropicVal && (
                <> Sem chave Anthropic, esta também é usada para gerar texto (GPT-4o).</>
              )}
            </div>
            <label style={{
              display:'flex', alignItems:'center', gap:8, marginTop:10, fontSize:12,
              color:'var(--text-secondary)', fontFamily:'var(--font-ui)', cursor:'pointer',
              userSelect:'none',
            }}>
              <input
                type="checkbox"
                checked={persist}
                onChange={(e) => setPersist(e.target.checked)}
                style={{ accentColor:'var(--accent)', width:14, height:14 }}
              />
              <span>Manter chave salva entre sessões (localStorage)</span>
            </label>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-ui)', marginTop:4, lineHeight:1.5, marginLeft:22 }}>
              {persist
                ? 'A chave fica no localStorage e sobrevive ao fechar a aba — mais conveniente, menos seguro.'
                : 'A chave fica só nesta sessão e some quando fechar a aba — mais seguro contra scripts maliciosos.'}
            </div>
          </div>

          {/* Selector de modelo Claude — sempre visível */}
          <div>
            <label className="vc-label">Modelo Claude (geração de texto)</label>
              <div style={{ display:'flex', gap:8 }}>
                {[
                  { id:'sonnet', label:'Sonnet 4.6', desc:'Rápido + barato' },
                  { id:'opus',   label:'Opus 4.7',   desc:'Máxima qualidade' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setModel(opt.id)}
                    style={{
                      flex:1, padding:'10px 12px', borderRadius:8, cursor:'pointer',
                      border: model === opt.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: model === opt.id ? 'var(--success-surface)' : 'transparent',
                      color: model === opt.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize:12, fontFamily:'var(--font-ui)', textAlign:'left',
                      display:'flex', flexDirection:'column', gap:2,
                    }}
                  >
                    <span style={{ fontWeight:600 }}>{opt.label}</span>
                    <span style={{ fontSize:10, color:'var(--text-muted)' }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          {/* Status compacto das duas chaves — visual claro do que está ativado */}
          {(() => {
            const anthropicOK = !!(anthropicVal && anthropicVal.trim().startsWith('sk-ant-'));
            const openaiOK = !!(val && val.trim().startsWith('sk-'));
            if (!anthropicOK && !openaiOK) return null;
            const Row = ({ ok, label, detail }) => (
              <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, fontFamily:'var(--font-ui)' }}>
                <span style={{
                  width:8, height:8, borderRadius:'50%',
                  background: ok ? '#30b352' : 'var(--text-muted)',
                  flexShrink:0,
                }}/>
                <span style={{ color: ok ? 'var(--success-text)' : 'var(--text-muted)', fontWeight:600 }}>{label}</span>
                <span style={{ color:'var(--text-muted)', fontSize:11 }}>{detail}</span>
              </div>
            );
            return (
              <div style={{
                background:'var(--success-surface)',
                border:'1px solid var(--success-border)',
                borderRadius:8, padding:'10px 12px',
                display:'flex', flexDirection:'column', gap:6,
              }}>
                <Row ok={anthropicOK} label="Claude" detail={anthropicOK ? '— texto + web search ativos' : '— não configurado, GPT-4o vai gerar texto'} />
                <Row ok={openaiOK} label="OpenAI" detail={openaiOK ? '— imagens (DALL·E) ativas' : '— sem geração automática de imagens'} />
              </div>
            );
          })()}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} className="vc-btn vc-btn-ghost" style={{ height:40, padding:'0 16px' }}>Cancelar</button>
            <button onClick={save} style={{
              flex:1, height:40, borderRadius:8, border:'none', cursor:'pointer',
              background:'var(--text-primary)', color:'var(--bg-base)',
              fontSize:13, fontWeight:700, fontFamily:'var(--font-ui)',
            }}>Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GENERATE MODAL ───────────────────────────────────────────────────────────

function GenerateModal({
  open, onClose, onGenerate,
  defaultNiche='', defaultTopic='', defaultTone='', defaultAudience='',
  hasOpenAI=false, hasAnthropic=false, onOpenKeys,
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

          {/* ═══════════ STEP 3 — IMAGENS ═══════════
              Status do provedor + ajuste dos eixos (fidelidade, criatividade,
              irreverência, objetividade). Sem chave OpenAI, só mostra o CTA
              pra configurar e explica o fallback. */}
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
                      GPT Image 2
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>
                      OpenAI · geração a partir do tema e das palavras-chave de cada slide
                    </div>
                  </div>
                ) : (
                  <div style={{
                    fontSize:13, color:'var(--text-secondary)', background:'var(--bg-pearl)',
                    border:'1px solid var(--hairline)', borderRadius:11, padding:'10px 12px',
                    fontFamily:'var(--font-ui)', lineHeight:1.47, letterSpacing:'-0.011em',
                  }}>
                    A geração automática de fundos usa <b>GPT Image 2</b>. Sem chave OpenAI, o carrossel sai com texto e palavras-chave de imagem; depois use Upload ou URL em cada card. Você pode seguir com <b>Só texto</b> no último passo.
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
                      Para usar <b>GPT Image 2</b> (OpenAI · foto-realismo), defina a chave OpenAI nas definições.
                      Custo aproximado: ~US$0.13 por imagem em qualidade <code>high</code>.
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
                    {hasOpenAI ? 'GPT Image 2 (OpenAI)' : 'Só palavras-chave (sem OpenAI)'}
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
                <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>Texto + imagem:</span> mais lento, usa créditos OpenAI.
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
                title={!hasOpenAI ? 'Configure a chave OpenAI em ⚙ pra gerar imagens' : 'Gera texto E imagens IA (mais lento, custa créditos OpenAI)'}
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
      if (!openaiKey?.trim()) {
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

function TemplatesModal({ open, onClose, onApply }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel-wide" onClick={e=>e.stopPropagation()}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--bg-sidebar)', zIndex:1,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:32, height:32, borderRadius:8,
              background:'linear-gradient(135deg, #6366f1, #4f46e5)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Layout size={14} color="#fff"/>
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>Templates prontos</div>
              <div className="vc-eyebrow">Quick start · comece em 1 clique</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="vc-icon-btn">
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding:20, display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {TEMPLATES.map(t => {
            const palette = PALETTES[t.palette] || PALETTES[0];
            return (
              <button
                key={t.id}
                onClick={()=>{ onApply(t); onClose(); }}
                style={{
                  background:'var(--bg-card)', border:'1px solid var(--border)',
                  borderRadius:10, padding:0, cursor:'pointer', textAlign:'left',
                  overflow:'hidden', transition:'all 0.15s', display:'flex', flexDirection:'column',
                }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.transform='translateY(-2px)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='translateY(0)'; }}
              >
                <div style={{
                  height:90, background:palette.bg, position:'relative',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  borderBottom:'1px solid var(--border)',
                }}>
                  <div style={{
                    color: palette.title,
                    fontFamily: TITLE_FONTS[t.titleFont]?.val || TITLE_FONTS[0].val,
                    fontSize:14, fontWeight:600, letterSpacing:'-0.022em',
                    padding:'0 16px', textAlign:'center', lineHeight:1.2,
                  }}>
                    {t.slides[0].title}
                  </div>
                  <div style={{
                    position:'absolute', bottom:6, right:8,
                    width:14, height:2, background:palette.accent, borderRadius:99,
                  }}/>
                </div>
                <div style={{ padding:'10px 12px 12px' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>{t.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', marginTop:2, lineHeight:1.4 }}>{t.desc}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-ui)', letterSpacing:'-0.011em', marginTop:8 }}>
                    {t.slides.length} slides · {palette.name}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
}) {
  const [dalleLoading, setDalleLoading] = React.useState(false);

  const applyDalleQuery = async (q) => {
    if (!hasOpenAI) { toast?.('Configure a chave OpenAI primeiro (ícone ⚙ no header ou OPENAI_API_KEY no .env.local)', 'error'); return; }
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
        {[
          // FASE 1 Narrative OS — 6 domínios cognitivos finais:
          //   Narrativa (ideia/hook/refinamento IA + Conteúdo base)
          //   Visual   (mood: Padrão Visual + Paletas + Cores)
          //   Imagem   (upload/IA/crop/filtro/padrão sobre fundo)
          //   Layout   (composição/grid/posição/zonas)
          //   Texto    (tipografia: fontes/escala/peso/espaçamento/legibilidade)
          //   Marca    (identidade pura: logo/handle/bio/posicionamento)
          {id:'narrativa',icon:Wand2,    label:'Narrativa'},
          {id:'visual',   icon:Palette,  label:'Visual'},
          {id:'imagem',   icon:ImageIcon,label:'Imagem'},
          {id:'layout',   icon:Layout,   label:'Layout'},
          {id:'texto',    icon:Type,     label:'Texto'},
          {id:'brand',    icon:Instagram,label:'Marca'},
        ].map(t=>{
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
                            const next = { ...slide };
                            delete next.presentationImgAdjust;
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

            <FontPicker title="Fonte — Título" fonts={TITLE_FONTS} active={brand.titleFont} onChange={val=>setBrand({...brand,titleFont:val})}/>
            <FontPicker title="Fonte — Corpo"  fonts={BODY_FONTS}  active={brand.bodyFont}  onChange={val=>setBrand({...brand,bodyFont:val})}/>
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
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <button
                  onClick={() => setMaterial({ ...material, content: '', sources: '', context: '', refProfileId: null })}
                  disabled={!materialHasUserInput(material)}
                  style={{
                    height:36, borderRadius:8, cursor:'pointer',
                    background:'var(--bg-card)', border:'1px solid var(--border)',
                    color:'var(--text-muted)', fontSize:11, fontWeight:600, fontFamily:'var(--font-ui)',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    opacity: !materialHasUserInput(material) ? 0.4 : 1,
                  }}
                >
                  <Trash2 size={11}/>Limpar tudo
                </button>
                <button
                  onClick={() => setSetupOpen(true)}
                  style={{
                    height:38, borderRadius:9999, cursor:'pointer',
                    background:'var(--accent)', border:'none',
                    color:'#fff', fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)',
                    letterSpacing:'-0.011em',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    transition:'background-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
                  }}
                >
                  <Sparkles size={13}/>Gerar com este material
                </button>
              </div>
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
          hideSlideOption={tab === 'material'}
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

// ─── PROMPT BUILDERS ──────────────────────────────────────────────────────────
// Constroem blocos opcionais que enriquecem o prompt da IA com identidade verbal
// (do brand) e material de referência (do material). São injetados em todos os
// fluxos: handleGenerate, refineSlide, refineAll, generateCaption, hookVariations.

const buildBrandBlock = (brand) => {
  const parts = [];
  if (brand?.bio?.trim())         parts.push(`• Sobre o perfil: ${brand.bio.trim()}`);
  if (brand?.positioning?.trim()) parts.push(`• Posicionamento: ${brand.positioning.trim()}`);
  if (brand?.signature?.trim())   parts.push(`• Assinatura/CTA recorrente: ${brand.signature.trim()}`);
  if (brand?.handle?.trim() && brand.handle !== '@seu.perfil')
    parts.push(`• Perfil: ${brand.handle.trim()}`);
  if (!parts.length) return '';
  return `\nIDENTIDADE VERBAL DA MARCA (use como contexto de tom, voz e coerência):\n${parts.join('\n')}\n`;
};

// Traduz os 4 sliders de direção de imagem em instruções precisas para a IA
// que escreve a `imageQuery` (em português, segue o estilo do prompt geral).
// Apenas valores fora da faixa neutra (35..65) emitem instrução — assim os
// sliders no meio significam "deixa a IA decidir, sem opinião forte".
const buildImgParamsBlockPT = (p) => {
  if (!p) return '';
  const lines = [];
  // Fidelidade (low=metafórico · high=literal)
  if (p.fidelity >= 75)      lines.push('• FIDELIDADE ALTA: a imageQuery DEVE retratar literalmente o tema do slide. Sujeitos e objetos diretamente reconhecíveis e nomeados.');
  else if (p.fidelity >= 60) lines.push('• Fidelidade média-alta: a imageQuery deve mostrar elementos diretos do tema, sem ser metafórica demais.');
  else if (p.fidelity <= 25) lines.push('• FIDELIDADE BAIXA: imageQueries 100% metafóricas. NUNCA mostre o tema literalmente — sugira por atmosfera, gesto ou objeto periférico apenas.');
  else if (p.fidelity <= 40) lines.push('• Fidelidade baixa: prefira sugerir o tema indiretamente.');
  // Criatividade
  if (p.creativity >= 75)      lines.push('• CRIATIVIDADE ALTA: composições inusitadas, ângulos inesperados, contraposições visuais, simbolismo sutil, justaposições conceituais.');
  else if (p.creativity >= 60) lines.push('• Criatividade média-alta: composições com algum elemento inesperado.');
  else if (p.creativity <= 25) lines.push('• CRIATIVIDADE BAIXA: composições convencionais e diretas. Enquadramento clássico editorial. Nada experimental.');
  else if (p.creativity <= 40) lines.push('• Criatividade baixa: composições convencionais e seguras.');
  // Irreverência
  if (p.irreverence >= 75)      lines.push('• IRREVERÊNCIA ALTA: humor sutil, situações cheeky, cenas inusitadas, leve desconforto cômico, quebra do esperado, momentos absurdos do cotidiano.');
  else if (p.irreverence >= 60) lines.push('• Irreverência média-alta: aceite cenas levemente humoradas ou inesperadas.');
  else if (p.irreverence <= 25) lines.push('• TOM SÉRIO: imagens contemplativas, sóbrias, formais, atemporais. Zero humor, zero ironia.');
  else if (p.irreverence <= 40) lines.push('• Tom sério: contemplativo, formal.');
  // Objetividade
  if (p.objectivity >= 75)      lines.push('• OBJETIVIDADE ALTA: cenas factuais e documentárias. Pessoas reais em ações concretas, ambientes reconhecíveis, sem ambiguidade visual.');
  else if (p.objectivity >= 60) lines.push('• Objetividade média-alta: cenas claras e factuais.');
  else if (p.objectivity <= 25) lines.push('• OBJETIVIDADE BAIXA: cenas atmosféricas, abstratas, evocativas. Emoção sobre fato. Detalhes ambíguos. Luz e atmosfera importam mais que ação.');
  else if (p.objectivity <= 40) lines.push('• Objetividade baixa: priorize atmosfera sobre ação.');
  if (!lines.length) return '';
  return `\n\nDIREÇÃO DE IMAGEM (eixos ajustados pelo usuário — siga estritamente):\n${lines.join('\n')}\n`;
};

// Versão em inglês compacta para injetar no prompt do GPT Image (OpenAI).
const buildImgParamsTagsEN = (p) => {
  if (!p) return '';
  const tags = [];
  if (p.fidelity >= 75)      tags.push('literal direct subject representation, theme clearly shown');
  else if (p.fidelity <= 25) tags.push('metaphorical indirect — never show the theme literally, only suggest through atmosphere');
  if (p.creativity >= 75)      tags.push('unconventional unexpected composition, conceptual juxtaposition, surprising angle');
  else if (p.creativity <= 25) tags.push('classic editorial composition, conventional framing, straight photography');
  if (p.irreverence >= 75)      tags.push('subtle wit and humor, slightly cheeky, unexpected mundane situations, dry comedy, broken expectation');
  else if (p.irreverence <= 25) tags.push('serious sober contemplative formal timeless tone, no humor');
  if (p.objectivity >= 75)      tags.push('documentary factual mode, real people in concrete actions, no ambiguity');
  else if (p.objectivity <= 25) tags.push('atmospheric evocative ambiguous, emotion over fact, light and mood dominate');
  if (!tags.length) return '';
  return `\nAdditional art direction (user adjusted): ${tags.join('; ')}.`;
};

const VC_ZWSP = /[\u200B-\u200D\uFEFF]/g;
function normalizeMaterialField(v) {
  if (v == null) return '';
  return String(v).replace(VC_ZWSP, '').trim();
}

/** Bloco é só linhas que parecem URL (ex.: link colado por engano em "Conteúdo base"). */
function isUrlOnlyNormalizedText(n) {
  if (!n) return false;
  const lines = n.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return false;
  return lines.every(
    (line) => /^https?:\/\/.+/i.test(line) || /^www\.[^\s]+$/i.test(line),
  );
}

/** Unifica leitura do material: URLs só em "Conteúdo base" contam como fontes no prompt. */
function normalizedMaterialPieces(material) {
  let c = normalizeMaterialField(material?.content);
  let s = normalizeMaterialField(material?.sources);
  const x = normalizeMaterialField(material?.context);
  if (c && isUrlOnlyNormalizedText(c) && !s) {
    s = c;
    c = '';
  }
  return { c, s, x };
}

/** Recolhe até 5 URLs únicas em «Conteúdo base», «Fontes» e «Contexto». */
function extractHttpUrlsFromMaterial(material) {
  const { c, s, x } = normalizedMaterialPieces(material);
  const blob = [c, s, x].filter(Boolean).join('\n');
  const found = new Set();
  const re = /https?:\/\/[^\s<>"'{}|\\^[\])]+/gi;
  let m;
  while ((m = re.exec(blob)) !== null) {
    let u = m[0].replace(/[,.;:!?)]+$/g, '');
    try {
      found.add(new URL(u).toString());
    } catch {
      /* ignorar token inválido */
    }
    if (found.size >= 6) break;
  }
  return [...found].slice(0, 5);
}

const FETCH_SOURCE_API = '/api/fetch-source';

/** Servidor (Vite dev ou Netlify) devolve JSON { text } — evita CORS do browser. */
async function fetchPlainTextFromUrl(url) {
  const qp = new URLSearchParams({ url });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 22000);
  try {
    const res = await fetch(`${FETCH_SOURCE_API}?${qp}`, { signal: ctl.signal });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const j =
      ct.includes('application/json')
        ? await res.json().catch(() => ({}))
        : {};
    if (!res.ok || j.ok === false) {
      throw new Error(j?.error || `HTTP ${res.status}`);
    }
    if (!ct.includes('application/json')) {
      throw new Error(
        'Leitura de URLs indisponível neste servidor. Use npm run dev (Vite local) ou o deploy Netlify deste projeto.',
      );
    }
    return String(j.text || '').trim();
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('Tempo limite ao ler a URL');
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    clearTimeout(t);
  }
}

async function fetchMaterialUrlSnippets(material) {
  const urls = extractHttpUrlsFromMaterial(material);
  const out = [];
  for (const url of urls) {
    try {
      const text = await fetchPlainTextFromUrl(url);
      out.push({ url, text });
    } catch (e) {
      out.push({ url, text: '', error: e?.message || String(e) });
    }
  }
  return out;
}

/** Monta os blocos de material para o prompt da IA e, se houver URL(s), obtém texto no servidor antes. `toastCb` opcional — (msg, kind, ttl?). */
async function resolveMaterialPromptParts(material, toastCb) {
  const urls = extractHttpUrlsFromMaterial(material);
  if (!urls.length) {
    return {
      materialBlock: buildMaterialBlock(material, []),
      materialPriorityBlock: buildMaterialPriorityBlock(material, []),
    };
  }
  toastCb?.('A ler texto das URLs em Fontes…', 'info', 2600);
  const urlSnippets = await fetchMaterialUrlSnippets(material);
  const ok = urlSnippets.filter((u) => String(u.text || '').trim().length >= 80).length;
  if (toastCb) {
    if (!ok && urls.length) {
      toastCb(
        'Não foi possível extrair texto da(s) URL (bloqueio, login ou formato). Cole o texto em «Conteúdo base» ou tente outro link.',
        'warning',
        6500,
      );
    } else if (ok < urls.length && urls.length > 1) {
      toastCb('Algumas URLs não devolveram texto; a IA usará as que funcionaram.', 'warning', 4500);
    }
  }
  return {
    materialBlock: buildMaterialBlock(material, urlSnippets),
    materialPriorityBlock: buildMaterialPriorityBlock(material, urlSnippets),
  };
}

function materialHasUserInput(material) {
  if (!material || typeof material !== 'object') return false;
  if (material.refProfileId) return true;
  const { c, s, x } = normalizedMaterialPieces(material);
  return !!(c || s || x);
}

const buildMaterialBlock = (material, urlSnippets = []) => {
  const parts = [];
  const { c, s, x } = normalizedMaterialPieces(material);
  const refId = material?.refProfileId;
  const ref = refId && REFERENCE_PROFILE_BY_ID[refId];

  const hasFetched = Array.isArray(urlSnippets) && urlSnippets.some((p) => p && (String(p.text || '').trim().length > 0 || String(p.url || '').length > 0));
  let fetchedBody = '';
  if (hasFetched) {
    const blobs = [];
    for (const p of urlSnippets) {
      if (!p?.url) continue;
      const body = String(p.text || '').trim()
        ? p.text.trim()
        : `[Não foi possível extrair texto: ${p.error || 'erro desconhecido'}]`;
      blobs.push(`=== ORIGEM ${p.url} ===\n${body.slice(0, 13000)}`);
    }
    if (blobs.length) {
      fetchedBody = blobs.join('\n\n').slice(0, 62000);
      parts.push(
        `TEXTO OBTIDO DAS FONTES (extraído automaticamente pelo app a partir das URL(s); use como BASE FACTUAL principal — sintetize com palavras próprias nos slides em português, sem cópia longa nem plagio):\n"""\n${fetchedBody}\n"""`,
      );
    }
  }

  if (c) parts.push(`MATÉRIA-PRIMA (use como base de fatos antes de inventar — extraia teses, não copie literal):\n"""\n${c.slice(0, 8000)}\n"""`);
  if (s) {
    const fetchedFull = Array.isArray(urlSnippets)
      ? urlSnippets.filter((u) => u.text && String(u.text).trim().length >= 120)
      : [];
    const srcLabel =
      fetchedFull.length > 0
        ? 'FONTES & REFERÊNCIAS (URL listada — o texto legível já foi transcrito para o bloco «TEXTO OBTIDO DAS FONTES» acima):'
        : /https?:\/\//i.test(s) || /\bwww\.[^\s]+\b/i.test(s)
          ? 'FONTES & REFERÊNCIAS (há URL(s) colada(s) sem extração bem-sucedida — use vocabulário do endereço e matéria-prima; não finja ler a página inteira):'
          : 'FONTES & REFERÊNCIAS (você pode citar/integrar quando relevante):';
    parts.push(`${srcLabel}\n${s.slice(0, 2000)}`);
  }
  if (x) parts.push(`INSTRUÇÕES ESPECÍFICAS DO USUÁRIO (sobrepõem regras default — siga literalmente):\n${x.slice(0, 1500)}`);
  if (ref?.promptBlock) {
    parts.push(
      `VOZ DE REFERÊNCIA — curadoria interna (inspire-se no ritmo, cadência e tom abaixo; não cite nomes de perfis nem reproduza posts reais):\n${ref.promptBlock}`,
    );
  }
  if (!parts.length) return '';
  return '\n' + parts.join('\n\n') + '\n';
};

/** Quando há Material, o tema livre do modal não pode sobrepor o que o usuário colou. */
function buildMaterialPriorityBlock(material, urlSnippets = []) {
  const { c, s, x } = normalizedMaterialPieces(material);
  const fetchedOk = Array.isArray(urlSnippets) && urlSnippets.some((p) => p && String(p.text || '').trim().length >= 80);
  if (!c && !s && !x && !fetchedOk) return '';

  let urlClause = `- URLs sem texto transcrito: você não navega na web. Se só houver link sem extração bem-sucedida, infira o tema só do vocabulário visível no URL + instruções + matéria-prima.\n`;

  if (fetchedOk) {
    urlClause = `- TEXTO EXTRAÍDO: o bloco «TEXTO OBTIDO DAS FONTES» contém conteúdo real obtido das páginas. O carrossel DEVE alinhar factos e ângulos a esse texto (parafraseando). NÃO ignore em favor do tema livre nem de clichês virais nem de “marcas/arquétipos” genéricos se o material fala de outro assunto.\n`;
  }

  return `
PRIORIDADE ABSOLUTA — MATERIAL DO USUÁRIO:
- O carrossel DEVE refletir o bloco MATÉRIA-PRIMA, FONTES e INSTRUÇÕES acima — e, quando existir, o TEXTO OBTIDO DAS FONTES. O campo “sobre o que é o conteúdo” e o nicho são SECUNDÁRIOS: servem para tom ou desambiguação, NÃO para trocar o assunto.
- PROIBIDO fabricar narrativa genérica de “rotina de trabalho” (madrugada, arquivo não carrega, tela azul, escritório vazio, café, deadline) se NADA disso estiver no material — isso descola o post do que o usuário forneceu.
${urlClause}- Cada slide deve extrair uma linha de raciocínio do MATERIAL (não de clichês de carrossel viral).
`;
}

/** Pacotes criativos da geração — id `livre` = Personalizado. Entre T/C e Personalizado: arquétipos «Templates prontos» (Erro Comum, Tendência de Mercado, …). */
const CREATIVE_PRESETS = [
  {
    id: 'tendencia_cultura',
    label: 'Tendência/Cultura',
    desc: 'Carrossel de tendência e cultura: nomeia o que o público já sente no mundo — não lista de dicas nem aula de conceito. Gatilhos: identificação, alívio, autoridade.',
  },
  ...QUICK_TEMPLATE_CREATIVE_PRESET_ENTRIES,
  {
    id: 'livre',
    label: 'Personalizado',
    desc: 'Modo narrativo, tom, marca, conteúdo de base e eixos de imagem — sem camada fixa “parece ser / é”. Melhor para Storytelling e quando a aba Conteúdo já está preenchida.',
  },
];
const CREATIVE_PRESET_BY_ID = Object.fromEntries(CREATIVE_PRESETS.map((p) => [p.id, p]));

/** Fração de volume de texto nos cards (persistido): 1/1 ≈ método padrão; menores → mais enxuto. */
const SLIDE_TEXT_DENSITY_OPTIONS = [
  { id: '1_1', label: '1/1', desc: 'Padrão do método — sanduíche com duas zonas de prosa densa (acima e abaixo da foto).' },
  { id: '1_2', label: '1/2', desc: '~Metade da densidade típica; frases proporcionalmente curtas.' },
  { id: '1_3', label: '1/3', desc: '~Um terço da densidade; telegráfico com substância.' },
  { id: '1_4', label: '1/4', desc: 'Mínimo corrido — batidas curtas.' },
  { id: '1_5', label: '1/5', desc: 'Mais esparso — quase só o essencial por card.' },
];
const SLIDE_TEXT_DENSITY_BY_ID = Object.fromEntries(SLIDE_TEXT_DENSITY_OPTIONS.map((o) => [o.id, o]));
/** Multiplicador sobre faixas “típicas” de caracteres do modo / editorial. */
const TEXT_DENSITY_TARGET_MULT = Object.freeze({
  1_1: 1,
  1_2: 0.72,
  1_3: 0.55,
  1_4: 0.38,
  1_5: 0.26,
});

function scaledCharBand(lo, hi, densityId) {
  const m = TEXT_DENSITY_TARGET_MULT[densityId];
  if (m == null || m >= 0.995) return { lo, hi };
  const nlo = Math.max(36, Math.round(lo * m));
  const nhi = Math.max(nlo + 16, Math.round(hi * m));
  return { lo: nlo, hi: nhi };
}

/**
 * Faixas de caracteres para miolo sanduíche T/C & híbrido personalizado (subtitle acima da foto + bodyAfterImage abaixo).
 * 1/1 segue referências editoriais densas (~50–90 palavras por zona quando o tema der), não resumo telegráfico.
 */
function tendenciaStyleSandwichCharBands(textDensityId = '1_1') {
  const mid = scaledCharBand(400, 620, textDensityId || '1_1');
  const subLo = Math.max(200, Math.round(mid.lo * 0.65));
  const subHi = Math.max(subLo + 60, Math.round(mid.hi * 0.65));
  const bodyLo = Math.max(200, Math.round(mid.lo * 0.62));
  const bodyHi = Math.max(bodyLo + 60, Math.round(mid.hi * 0.62));
  return { subLo, subHi, bodyLo, bodyHi };
}

function scaledCeiling(ceiling, densityId) {
  const m = TEXT_DENSITY_TARGET_MULT[densityId];
  if (m == null || m >= 0.995) return ceiling;
  return Math.max(24, Math.round(ceiling * m));
}

/** Instrução explícita de volume — só quando ≠ 1/1. */
function buildSlideTextDensityOverrides(densityId, narrativeModeId) {
  if (!densityId || densityId === '1_1') return '';
  const label = SLIDE_TEXT_DENSITY_BY_ID[densityId]?.label || densityId;
  let baseMid = [200, 320];
  if (narrativeModeId === 'storytelling' || narrativeModeId === 'pain') baseMid = [120, 280];
  else if (narrativeModeId === 'viral') baseMid = [90, 220];
  else if (narrativeModeId === 'how_to') baseMid = [160, 280];
  else if (narrativeModeId === 'sensacionalista') baseMid = [85, 210];
  else if (narrativeModeId === 'jornalistico') baseMid = [140, 300];

  const mid = scaledCharBand(baseMid[0], baseMid[1], densityId);
  const hookMax = scaledCeiling(80, densityId);
  const finMax = scaledCeiling(140, densityId);

  return `
▶ DENSIDADE DE TEXTO (${label}) — SUBSTITUI proporcionalmente as faixas “típicas” do método / blocos acima:
- Slides intermediários: subtítulo com algo entre ~${mid.lo} e ~${mid.hi} caracteres (não estique além).
- Slide 1: subtítulo no máximo ~${hookMax} caracteres (além do título curto já pedido).
- Último slide: subtítulo no máximo ~${finMax} caracteres.
- Quanto menor a fração (1/4, 1/5), menos frases paralelas e menos exemplo redundante — sem esvaziar o significado obrigatório do slide.
`;
}

function buildSlideTextDensityRefineHint(densityId) {
  if (!densityId || densityId === '1_1') return '';
  const label = SLIDE_TEXT_DENSITY_BY_ID[densityId]?.label || densityId;
  return `- Volume do projeto: densidade ${label} — não alongue o subtítulo; comprima mantendo gancho ou argumento intacto.\n`;
}

/**
 * Remove prefixos tipo "Slide 2", "Card 01 —" no início do texto — o app já mostra o índice do card.
 */
function stripLeadingSlideCardLabel(text) {
  if (text == null || typeof text !== 'string') return '';
  let t = text.replace(/^\uFEFF/, '').trim();
  let prev;
  do {
    prev = t;
    t = t
      .replace(/^(?:slide|card)(?![a-záàâãéêíóôõúç])\s*0*\d{1,2}\s*(?:[.:–—\-]|\.{3})?\s*/i, '')
      .trim();
  } while (t !== prev);
  return t;
}

function isTendenciaCulturaPreset(presetId) {
  return presetId === 'tendencia_cultura';
}

/**
 * Depois da geração com IA: define canvas ativo (zonas) para encaixar fotos pendentes mesmo sem «modo canvas» manual.
 * Tendência/Cultura: capa e último slide full-bleed; miolo sandwich com rotação vertical da zona foto.
 */
function attachGenerationCanvasLayouts(slides, { creativePreset, slideTextDensity }) {
  const n = slides.length;
  if (!n) return slides;
  const isTC = isTendenciaCulturaPreset(creativePreset);
  const persoHybrid = isPersoHybridDensity(creativePreset, slideTextDensity);

  return slides.map((s, i) => {
    const q = String(s.imageQuery || '').trim();
    const bod = String(s.bodyAfterImage || '').trim();

    if (isTC) {
      const fullBleedPortrait = i === 0 || i === n - 1;
      if (fullBleedPortrait && q) {
        return {
          ...s,
          canvas: {
            enabled: true,
            variant: 'classic',
            zones: { ...DEFAULT_CANVAS_ZONES_COVER_FULLBLEED },
          },
        };
      }
      const mid = i > 0 && i < n - 1;
      if (mid && bod && q) {
        return {
          ...s,
          canvas: {
            enabled: true,
            variant: 'sandwich',
            // Usa o mesmo layout do botão "Ativar Layout Canvas" (zonas + amplas)
            // em vez de rotação variável que dava zonas pequenas pra texto denso.
            zones: { ...DEFAULT_CANVAS_ZONES_SANDWICH },
          },
        };
      }
      if (mid && bod && !q) {
        return {
          ...s,
          canvas: { enabled: true, variant: 'stat', zones: { ...DEFAULT_CANVAS_ZONES_STAT } },
        };
      }
      if (mid && q && !bod) {
        return {
          ...s,
          canvas: {
            enabled: true,
            variant: 'classic',
            zones: { ...DEFAULT_CANVAS_ZONES_COVER_FULLBLEED },
          },
        };
      }
      const d = inferCanvasDefaults(s, creativePreset);
      return { ...s, canvas: { enabled: true, variant: d.variant, zones: { ...d.zones } } };
    }

    if (persoHybrid) {
      const firstPair = i <= 1;
      if (firstPair && q) {
        return {
          ...s,
          canvas: {
            enabled: true,
            variant: 'classic',
            zones: { ...DEFAULT_CANVAS_ZONES_COVER_FULLBLEED },
          },
        };
      }
      if (firstPair && !q) {
        const d = inferCanvasDefaults({ ...s, bodyAfterImage: '', useCultureLayout: false }, 'livre');
        return { ...s, canvas: { enabled: false, variant: d.variant, zones: { ...d.zones } } };
      }
      if (s.useCultureLayout && bod && q) {
        return {
          ...s,
          canvas: {
            enabled: true,
            variant: 'sandwich',
            // Mesmo do botão (zonas amplas) — evita corte de texto denso
            zones: { ...DEFAULT_CANVAS_ZONES_SANDWICH },
          },
        };
      }
      if (s.useCultureLayout && bod && !q) {
        return {
          ...s,
          canvas: { enabled: true, variant: 'stat', zones: { ...DEFAULT_CANVAS_ZONES_STAT } },
        };
      }
      if (!s.useCultureLayout && q && i >= 2) {
        return {
          ...s,
          canvas: {
            enabled: true,
            variant: 'classic',
            zones: { ...DEFAULT_CANVAS_ZONES_COVER_FULLBLEED },
          },
        };
      }
      const d = inferCanvasDefaults({ ...s }, creativePreset);
      return { ...s, canvas: { enabled: false, variant: d.variant, zones: { ...d.zones } } };
    }

    const d = inferCanvasDefaults(s, creativePreset);
    const needsCanvas = slideHasPendingPhotoIntent(s);
    if (!needsCanvas) return { ...s };
    return {
      ...s,
      canvas: {
        enabled: true,
        variant: d.variant,
        zones: { ...d.zones },
      },
    };
  });
}

/** Sobreposição estratégica do pacote Tendência/Cultura (adapta ao N de slides). */
function buildTendenciaCulturaPackBlock(slideCount, textDensityId = '1_1') {
  const n = Math.min(12, Math.max(3, slideCount | 0));
  const { subLo, subHi, bodyLo, bodyHi } = tendenciaStyleSandwichCharBands(textDensityId || '1_1');
  return `
PACOTE ATIVO — TENDÊNCIA/CULTURA (prioridade quando colidir com clichês genéricos de “dicas virais”):
Este formato NÃO é post de dicas soltas nem explicação de conceito novo. É nomear e ORGANIZAR o que o leitor já percebia no comportamento, na cultura, na polêmica ou na mudança de mercado.

Validação obrigatória do tema antes de escrever:
- O público já está sentindo esse fenômeno no cotidiano ou no feed?
- O texto nomeia e organiza a percepção — ou só ensina algo que o leitor nem sentia falta?

Tipos úteis (escolha o que casa com o material): A) Tendência interpretada B) Tese contraintuitiva C) Case/Benchmark cultural D) Previsão/Futuro sentido mas não nomeado.

Arco editorial de referência (distribua as FUNÇÕES abaixo pelos ${n} slides — se N < 9, una etapas adjacentes; se N > 9, expanda com mais evidência ou contraste mantendo o propósito de cada função):

S1 CAPA · hook que soe como “finalmente alguém falou isso” — teses tipo: fenômeno inesperado + consequência; obsessão comportamental + geração; grupo/categoria em mudança surpreendente; dado de mercado em tensão com narrativa óbvia; “por que X prova Y”.
S2 CONTEXTO · dado ou situação histórica; abre espaço factual.
S3 MECANISMO · síntese densa — princípio central do fenômeno (prosa forte, primeira frase = gancho do slide).
S4 DISSONÂNCIA · conflito que o mecanismo cria; consequência vivida.
S5 LIMITE · teto do comportamento atual; por que as pessoas travam ou param.
S6 (se N≥6) STAT/PARADOXO · UM slide pode ser só insight em tipografia mental: afirmação grande + linha menor com dado ou contrassenso (sem clichê motivacional).
S7 (se N≥7) MECANISMO DUPLO · contraste A vs B nos dois sentidos do fenômeno.
S8 (se N≥8) REFRAME · ângulo que muda como se lê o comportamento (pode citar pesquisa só se plausible ao material — não invente fonte).
S9 FECHO · meta-pergunta que organiza o que o leitor já sentia + CTA orgânico (comentário, save, síntese).

Reforço contínuo: “você já percebia isso; aqui está o porquê.” Três gatilhos ao longo do fio: identificação, alívio (não sou só eu), autoridade sobria.

LAYOUT VISUAL ↔ CAMPOS DO JSON (leitura do app — siga estritamente):
- Slide 1 (CAPA com foto full-bleed): use "title" + "subtitle" + "imageQuery". O campo "bodyAfterImage" DEVE ser "" (string vazia). Nunca sanduíche na capa.
- Slide final (fecho) COM foto: também full-bleed — "bodyAfterImage" vazio; apenas "title", "subtitle", "imageQuery" (e cultureTone se precisar).
- Slides intermediários e fecho COM foto (sanduíche texto · foto inline · texto): quando "imageQuery" estiver preenchido, obrigatório "subtitle" ACIMA da foto com **${subLo}–${subHi} caracteres** (parágrafo(s) corrido(s); primeira frase fecha o gancho) e "bodyAfterImage" ABAIXO da imagem com **${bodyLo}–${bodyHi} caracteres** — duas zonas distintas de prosa editorial, **não** uma headline + frase única nem bullets telegráficos salvo densidade 1/4–1/5. Destaque lexical: dentro de subtitle ou bodyAfterImage, envolva **um trecho** com asteriscos duplos.
- Slide só texto (“stat”) SEM foto: deixe "imageQuery" vazio; use "subtitle" (e opcionalmente "title") no bloco superior e "bodyAfterImage" como segundo bloco inferior (tipografia editorial em fundo sólido).
- "cultureTone" (opcional): omita ou use "" para alternância automática claro/escuro; só use "light", "dark" ou "accent" quando o contraste exigir.

CRITICAL (texto nos slides JSON):
- Sem título de seção tipo “Slide 3 — Mecânismo”: use título+subtítulo como no app; primeira frase do subtítulo faz o trabalho do gancho.
- PROIBIDO usar “Slide N”, “Card N” ou número ordinal de card como "title" — só copy editorial; o app numera os cards na UI.
${textDensityId === '1_1' || !textDensityId ? '- Com densidade 1/1, o miolo sanduíche deve calibrar como referências editoriais densas (capacidade de **~50–85 palavras por zona de texto** quando o material suportar); **proibido** entregar miolo resumido tipo “capa de LinkedIn”.\n' : ''}
- PROIBIDO abrir miolo como manual (“5 passos”, “dica número”) quando o tema for cultura/tendência — salvo modo narrativo Passo-a-passo pedido pelo usuário em outra camada.
`;
}

/** Arquétipos «Templates prontos» no fluxo de geração (Erro Comum, Tendência de Mercado, …). */
function buildQuickTemplatePackBlock(templateId, slideCount) {
  const t = TEMPLATES.find((x) => x.id === templateId);
  if (!t) return '';
  const n = Math.min(12, Math.max(3, slideCount | 0));
  const refs = t.slides
    .map(
      (s, i) =>
        `   • Slide ${i + 1} — função no arco: título de referência «${s.title}» · subtítulo «${s.subtitle}» · imageQuery (inglês) «${s.q}».`,
    )
    .join('\n');
  return `
PACOTE ATIVO — ARQUÉTIPO "${t.name}" (mesmo molde que «Templates prontos» no app):
${t.desc}

Regras:
- Adapte títulos, subtítulos e imageQuery ao TEMA do utilizador; NÃO copie texto literal dos exemplos — preserve só a FUNÇÃO de cada posição no arco.
- Cada imageQuery: inglês, 8–15 palavras, alinhada ao argumento do slide (pode inspirar-se na família visual dos exemplos).

CRITICAL — ABA «CONTEÚDO» (MATÉRIA-PRIMA / FONTES / TEXTO EXTRAÍDO / INSTRUÇÕES):
- Se o prompt trouxer esses blocos, o assunto factual do carrossel é **o material colado**, não uma história genérica (escritório, cliente, terça-feira, deadline, etc.) inventada para encaixar no arquétipo.
- O arquétipo «${t.name}» define só a **estrutura** do arco (gancho, prova, virada…): os exemplos abaixo com «título de referência» são **ilustrativos** — reescreva tudo ao tema real do utilizador.
- A linha «sobre: "…"» do formulário é **secundária** quando existe material; use-a só se bater com o material ou para tom/desambiguação — nunca para trocar o assunto.

Distribuição para ${n} slides (o template original tem ${t.slides.length} passos — estique ou una passos adjacentes se N for diferente):
${refs}
`;
}

function buildTendenciaCulturaRefineSlideHint(creativePresetId, textDensityId = '1_1') {
  if (!isTendenciaCulturaPreset(creativePresetId)) return '';
  const { subLo, subHi, bodyLo, bodyHi } = tendenciaStyleSandwichCharBands(textDensityId || '1_1');
  const dense =
    textDensityId === '1_1' || !textDensityId
      ? ' Com 1/1, se estiver curto, expanda até prosa completa por zona (método editorial), sem factos novos fora do material.'
      : '';
  return `- Pacote Tendência/Cultura: "subtitle" = texto acima da mídia (ou bloco superior no slide só texto). "bodyAfterImage" = bloco inferior (abaixo da foto no sanduíche, ou segunda coluna tipográfica sem imagem). Preserve **trechos** marcados para destaque accent. Capa e último slide (foto full-bleed no app) mantêm bodyAfterImage vazio — não devolva texto nesse campo ao refinar só esses cards. Alvo miolo sanduíche: subtitle ~${subLo}–${subHi} car.; bodyAfterImage ~${bodyLo}–${bodyHi} car.${dense}`;
}

function coerceCultureTone(v) {
  const t = (v == null ? '' : String(v)).trim().toLowerCase();
  return t === 'light' || t === 'dark' || t === 'accent' ? t : '';
}

function buildGenerationIntroLine(presetId) {
  if (isTendenciaCulturaPreset(presetId)) {
    return 'Atue como estrategista de cultura digital e comportamento em rede. Produza um carrossel que NOMEIE um fenômeno que o público já percebia — não lista de dicas nem aula solta de conceito. Responda APENAS com JSON válido, sem markdown, sem texto extra.';
  }
  if (isQuickTemplatePreset(presetId)) {
    const tid = quickTemplateIdFromPreset(presetId);
    const t = TEMPLATES.find((x) => x.id === tid);
    return `Atue como criador de carrosséis editoriais para Instagram. Produza um carrossel no arquétipo «${t?.name || 'template'}» — ${t?.desc || 'estrutura fixa de leitura'}. Responda APENAS com JSON válido, sem markdown, sem texto extra.`;
  }
  return 'Crie conteúdo para Instagram alinhado ao contexto abaixo. Responda APENAS com JSON válido, sem markdown, sem texto extra.';
}

function buildGenerationLanguageLayer(presetId, tone, narrativeMode = 'editorial') {
  const storyLike = narrativeMode === 'storytelling' || narrativeMode === 'pain';
  const viralMode = narrativeMode === 'viral' || narrativeMode === 'sensacionalista';
  const journalMode = narrativeMode === 'jornalistico';
  const howToMode = narrativeMode === 'how_to';

  // Storytelling/Odisseia + pacote cultura: narrativa manda forma; cultura acrescenta “fenômeno já sentido”.
  if (isTendenciaCulturaPreset(presetId) && storyLike) {
    return `REGRAS DE LINGUAGEM (pacote Tendência/Cultura + modo narrativo "${narrativeMode}"):
- O MÉTODO narrativo acima MANDA a estrutura. Acrescente do pacote cultural: fenômeno que o público já percebia — nomeie e organize, não vire palestra nem deck “parece ser / é” genérico.
- PROIBIDO soar como relatório institucional; mantenha cena, dor ou tempo — com tensão cultural visível.
- Tom base: "${tone}".`;
  }
  if (isTendenciaCulturaPreset(presetId) && viralMode && narrativeMode === 'sensacionalista') {
    return `REGRAS DE LINGUAGEM (Tendência/Cultura + Sensacionalista):
- O MÉTODO SENSACIONALISTA manda tensão forte e cortes rápidos. O pacote cultura exige payoff honesto nomeando fenômeno real — SEM clickbait que o miolo não sustenta.
- Tom "${tone}".`;
  }
  if (isTendenciaCulturaPreset(presetId) && viralMode) {
    return `REGRAS DE LINGUAGEM (Tendência/Cultura + Viral Trends):
- O MÉTODO VIRAL acima manda ritmo, loops e parada de scroll. O pacote cultura reforça: identificação com algo que já circula (“eu também vi isso”), sem virar relatório slide a slide.
- Tom "${tone}", preferindo frases curtas e cortantes nos slides de tensão.`;
  }
  if (isTendenciaCulturaPreset(presetId) && journalMode) {
    return `REGRAS DE LINGUAGEM (Tendência/Cultura + Jornalístico):
- Hierarquia de matéria: selo/editoria → manchete → lead factual. Ângulos de comportamento mercado ou cultura em curso — não coluna motivacional.
- Tom "${tone}", factual e adulto.`;
  }
  if (isTendenciaCulturaPreset(presetId) && howToMode) {
    return `REGRAS DE LINGUAGEM (Tendência/Cultura + Passo-a-passo):
- O tutorial imperativo do MÉTODO acima prevalece. Não empacote cada passo como “tese de mercado”; mantenha utilidade líquida.
- Tom "${tone}" em modo instrução clara, não keynote.`;
  }
  if (isTendenciaCulturaPreset(presetId)) {
    return `REGRAS DE LINGUAGEM — PACOTE TENDÊNCIA/CULTURA (todos os slides):
- Tom jornalístico-analítico calmo; frases que soem como “finalmente alguém articulou o que eu sentia”.
- Cada slide = 1 batida nova no fenômeno; evite repetir o mesmo clichê viral (“5 hacks”, “ninguém te conta” vazio).
- Primeira linha forte do subtítulo é o gancho do slide — sem subdividir em “mini-títulos” artificiais.
- Zero guru, zero motivacional genérico; autoridade vem da clareza sobre o fenômeno já em curso.`;
  }
  if (storyLike) {
    return `REGRAS DE TEXTO (modo narrativo "${narrativeMode}" — prioridade sobre tom genérico):
- Vocabulário de história, não de slide de pitch. Evite fórmulas de marca (“não é sobre X, é sobre Y”) salvo um fecho pontual.
- Tom "${tone}" aplicado em cenas e falas, não em manuais de estratégia.
- Deixe identidade da marca colorir a voz, mas não substitua arco narrativo por mensagem institucional.`;
  }
  if (viralMode && narrativeMode === 'sensacionalista') {
    return `REGRAS DE TEXTO (modo Sensacionalista — tom "${tone}"):
- Frases de impacto máximo; urgência lexical sem mentir nem inventar consequência não sustentada pelo miolo.
- Gancho/miolo devem soar “capa sensacionalista” honesta — não post corporativo nem ensaio acadêmico.`;
  }
  if (viralMode) {
    return `REGRAS DE TEXTO (modo Viral — tom "${tone}"):
- Telegrama mental: corte palavras mortas. Gancho e meio pedem ritmo, não parágrafo de consultoria.
- Marca e material podem informar vocabulário — não viram slide de posicionamento institucional no lugar de tensão ou payoff.`;
  }
  if (journalMode) {
    return `REGRAS DE TEXTO (modo Jornalístico — tom "${tone}"):
- Clara hierarquia de capa quando o slide permitir (categoria/manifestação no título vs lead no subtítulo, ou distribua conforme método).
- Prosa econômica, factual onde couber ao tema — sem meme de influencer nem tom de guru.`;
  }
  if (howToMode) {
    return `REGRAS DE TEXTO (modo Passo-a-passo — tom "${tone}"):
- Imperativo e verificável em cada subtítulo; sem narrativa pessoal nem tese de marca entre um passo e outro.
- Marca só afina escolha de palavras — não slogan por slide.`;
  }
  return `REGRAS DE TEXTO (prioridade: MODO NARRATIVO acima → tom "${tone}" → identidade da marca e material. Não replique um único formato nem uma “voz de página” fixa):
- Deixe o modo narrativo guiar a estrutura; adapte vocabulário ao tema e ao público (sem forçar jargão de mercado se o tom ou o modo pedirem outra coisa).
- Cada slide = 1 ideia principal; evite repetir a mesma fórmula em todos os slides.
- Prefira substância a frases vazias; evite motivacional genérico e guru.
- Ritmo: hook enxuto → desenvolvimento → fechamento, conforme o modo escolhido (não imponha sempre o mesmo arco “analítico”).`;
}

/** Regras de tamanho/layout por slide — modos narrativos não podem usar o bloco “denso analítico” dos editoriais. */
function buildGenerationSlideLayoutRules(narrativeModeId, creativePresetId, textDensityId = '1_1') {
  if (isTendenciaCulturaPreset(creativePresetId)) {
    const bands = tendenciaStyleSandwichCharBands(textDensityId || '1_1');
    const sandwichVol = `
▶ VOLUME NO MIOLO SANDUÍCHE (texto · foto · texto) — prevalece sobre faixas genéricas de “subtítulo único”:
- **subtitle** (acima da foto) e **bodyAfterImage** (abaixo) são blocos separados; cada um = parágrafo(s) corrido(s) com múltiplas frases — não substituir por headline + uma linha nem bullets soltos.
- Faixas-alvo neste projeto: subtitle ~${bands.subLo}–${bands.subHi} caracteres; bodyAfterImage ~${bands.bodyLo}–${bands.bodyHi} caracteres.${
      textDensityId === '1_1' || !textDensityId
        ? ' Densidade 1/1 = padrão do método: calibre editorial denso (~50–85 palavras por zona quando o tema der), como referências tipo miolo sanduíche longo.'
        : ''
    }
`;
    return `
REGRAS DE TAMANHO (pacote TENDÊNCIA/CULTURA):
- Siga o arco e o layout descritos no PACOTE ativo; não misture com moldes de “modo narrativo” editorial/viral genéricos.
${sandwichVol}${buildSlideTextDensityOverrides(textDensityId, 'editorial')}
`;
  }
  const hookMag = isTendenciaCulturaPreset(creativePresetId)
    ? '   - Gancho nomeia fenômeno ou tensão vivida pelo público — não título genérico de relatório (“X: uma reflexão”).'
    : '   - Hook que para o scroll: linha de cena ou tensão, não conceito abstrato de marca.';

  if (narrativeModeId === 'storytelling' || narrativeModeId === 'pain') {
    return `
REGRAS DE ESTRUTURA POR SLIDE (modo "${narrativeModeId}" — PREVALECEM sobre qualquer hábito de copy “estratégico/coded”):
O MÉTODO deste modo (seção acima) é a lei. Estas instruções substituem o formato padrão de carrossel consultivo.

- PROIBIDO repetir o molde “headline de marca + subtítulo raciocínio binário” em vários slides (ex.: título “Peptídeos: uma revolução na estética” + subtítulo “não é A, é B”; ou “Inovação e ciência” + “quem incorpora ciência constrói credibilidade…”).
- PROIBIDO títulos formulaicos “[Tema]: uma reflexão”, “[Tema]: uma revolução”, “[Dois conceitos] e [conceito]: …” como capa de deck.
- Slide 1 (hook): entrada em cena (in medias res ou imagem forte). Título = momento ou fragmento narrativo. Subtítulo = continua a cena ou a tensão — não posicionamento institucional.
- Slides intermediários: cada um AVANÇA a história (tempo, gesto, virada, consequência). Subtítulo em prosa narrativa: tipicamente 120–280 caracteres; É PERMITIDO bem menos quando for batida seca, fala ou linha única.
- Último slide: desfecho, pergunta ao leitor ou convite honesto — não obrigatoriamente “lição de estratégia”.

🪝 SLIDE 1 — HOOK NARRATIVO:
${hookMag}

📖 SLIDES DO MEIO — narrativa (NÃO mini-artigos de 200–320 caracteres tipo análise de mercado):
   - Título: virada, detalhe sensível, diálogo implícito — evite headline de LinkedIn.
   - Subtítulo: microcena ou sequência de causas; ritmo de narrador, não de slide de pitch.

🔚 SLIDE FINAL — fechamento narrativo ou convite à conversa.
${buildSlideTextDensityOverrides(textDensityId, narrativeModeId)}
`;
  }

  if (narrativeModeId === 'viral') {
    return `
REGRAS DE ESTRUTURA POR SLIDE (modo "viral" — retenção e ritmo, NÃO parágrafo de ensaio):
O MÉTODO VIRAL acima define as funções (hook, tensão, payoff). Estas regras substituem o formato “subtítulo denso 200–320 caracteres analíticos”.

- Slides intermediários: subtítulo tipicamente ENTRE 90 E 220 caracteres; pode ser MENOR quando for punch, cliffhanger ou frase quotável. Priorize loop, número concreto e virada — não explicação acadêmica longa.
- Título: curto, cortante, pode incluir número ou pergunta — não headline de relatório.
- Um slide do meio deve carregar a frase “guardável” (share-trigger) quando o arco tiver slides suficientes.

🪝 SLIDE 1 — parada de scroll (ver método viral).

📖 MEIO — tensão → prova → payoff (distribuído conforme N).

🔚 FINAL — pergunta ou save com motivo concreto (sem CTA preguiçoso).
${buildSlideTextDensityOverrides(textDensityId, narrativeModeId)}
`;
  }

  if (narrativeModeId === 'how_to') {
    return `
REGRAS DE ESTRUTURA POR SLIDE (modo "passo-a-passo" — manual, não narrativa nem pitch):
O MÉTODO acima manda: um passo por slide com "Passo N · …".

- Slides intermediários: subtítulo tipicamente ENTRE 160 E 280 caracteres — imperativo + como fazer + erro ou exemplo; pode ultrapassar levemente se a instrução exigir checklist curto.
- Título DEVE refletir sequência de passos (Passo 1, 2…) até o penúltimo ou até o bloco de “erro comum”, conforme o método.
- PROIBIDO diluir em storytelling ou em tese de marca; mantenha linguagem de procedimento.

🪝 SLIDE 1 — promessa do que será ensinado.

📖 MEIO — instruções numeradas.

🔚 FINAL — save + pergunta sobre qual passo testar.
${buildSlideTextDensityOverrides(textDensityId, narrativeModeId)}
`;
  }

  if (narrativeModeId === 'sensacionalista') {
    return `
REGRAS DE ESTRUTURA POR SLIDE (modo "sensacionalista" — tensão alta, payoff honesto — NÃO parágrafo de ensaio):
O método sensacionalista acima manda cortes rápidos e micro-ganchos.

- Slides intermediários: subtítulo tipicamente ENTRE 85 E 210 caracteres — pode ser MENOR quando for tacada única ou cliffhanger. Priorize vigas de tensão e contraste visceral sobre explicação longa.
- Título: curto até médio — pode soar "capa" ou pergunta incômoda; evite headline de relatório corporativo.

🪝 SLIDE 1 — gancho forte (ver método).

📖 MEIO — viradas e fechos de mini-loop (distribuído conforme N); um slide pode carregar frase quotável chocante-mas-verdadeira.

🔚 FINAL — revelação ou síntese real + provocação factual / save útil — sem clichê de "segue pra parte 2".
${buildSlideTextDensityOverrides(textDensityId, narrativeModeId)}
`;
  }

  if (narrativeModeId === 'jornalistico') {
    return `
REGRAS DE ESTRUTURA POR SLIDE (modo "jornalístico" — matéria digital, hierarquia de capa):
O método jornalístico prevalece. Slides devem ler como sequência de fio ou capas de seção — não meme deck.

🪝 SLIDE 1 (CAPA DE FIO):
   - Manifeste selo/editoria no título (parte inicial CAIXA ALTA OU equivalente compacto se o JSON só tiver dois campos) + manchete impactante na mesma peça textual de forma fluida OU use título = manchete e subtítulo = selo + lead — mantenha a hierarquia clara ao leitor.
   - Subtítulo: LEAD factual (1 linha forte). Se o título já carregar a manchete inteira, o subtítulo faz o nut graf ou data-contexto breve.

📖 MEIO — blocos de matéria pirâmide invertida:
   - Título: ângulo, fato-âncora ou antetítulo curto da peça DAQUELE slide.
   - Subtítulo: 2-4 frases curtas OU um parágrafo denso factual: tipicamente ENTRE 140 E 300 caracteres; informação primeiro, ornamentação zero.

🔚 FINAL — editorial curto ou o que falta saber próximo — sem CTA influencer vazio.
${buildSlideTextDensityOverrides(textDensityId, narrativeModeId)}
`;
  }

  const hookVisualHint = isTendenciaCulturaPreset(creativePresetId)
    ? '   - Capa com peso de manchete cultural: fenômeno ou paradoxo já no ar — pouco texto, frase memorável.'
    : '   - Hook com impacto visual forte; não precisa parecer “capa de revista de mercado” se outro formato servir melhor ao modo.';

  return `
REGRAS DE TAMANHO POR POSIÇÃO (CRÍTICO — siga estritamente, NÃO trate todos os slides com mesmo peso):

🪝 SLIDE 1 (HOOK) — texto MÍNIMO, máximo impacto:
   - Título: 5-9 palavras. Frase-tese curta e cortante. Usa o espaço visual.
   - Subtítulo: UMA frase curta apenas, máx 80 caracteres. Pode ser inclusive vazio se a tese se sustenta sozinha.
${hookVisualHint}

📖 SLIDES INTERMEDIÁRIOS (2 ao penúltimo) — texto DENSO e com CONTEÚDO:
   - Título: 5-12 palavras, ideia única em frase clara.
   - Subtítulo: 2-4 frases. ENTRE 200 E 320 CARACTERES. Cada slide intermediário é onde MORA o conteúdo — explica o mecanismo, traz exemplo, contraste, dado, leitura. Não economize palavras aqui.
   - É aqui que o leitor deve sentir que está aprendendo algo de verdade. Use vírgulas, pontos, ritmo. Construa o argumento.

🔚 SLIDE FINAL (CTA) — concisão elegante:
   - Título: 5-9 palavras. Conclusão ou convite.
   - Subtítulo: 1-2 frases curtas, máx 140 caracteres. Fechamento limpo, sem repetir o título.
${buildSlideTextDensityOverrides(textDensityId, narrativeModeId)}
`;
}

function buildGenerationImageLayer(presetId, topic, n, audience) {
  const nicheStr = n ? ` (nicho: ${n})` : '';
  const audStr = audience ? ` (público: ${audience})` : '';
  if (isTendenciaCulturaPreset(presetId)) {
    return `imageQuery — DIREÇÃO DE ARTE “CULTURA EM CURSO” (a IA do gerador de imagem aplicará realismo, luz natural e estética premium em cima — você só precisa descrever a CENA):
• Idioma: INGLÊS, 8-15 palavras descritivas.
• Estrutura: [sujeito real] + [ação cotidiana ou estado] + [ambiente específico observado] + [detalhe de luz/atmosfera].
• OBRIGATÓRIO — relação INDIRETA e inteligente com o tema "${topic}"${nicheStr}${audStr}. NUNCA escolha a representação mais óbvia. A imagem deve sugerir o conceito por atmosfera, gesto, contexto, objeto ou tensão visual — não ser uma "legenda" do título.
• EVITE clichês visuais: xadrez (estratégia), gráficos subindo (crescimento), lâmpadas (ideia), robôs/hologramas (tecnologia), reuniões corporativas (negócios), explosão de tinta (criatividade), aperto de mãos (parceria), engrenagens, escalada de montanha, lupa.
• EVITE: pessoas posando como modelo, sorriso publicitário, diversidade encenada, expressões artificiais, fundo de estúdio, luz dramática teatral, paisagens aleatórias desconectadas, animais decorativos.
• PREFIRA cenas reais e bem observadas: escritórios contemporâneos, ruas urbanas, cafés, casas, lojas, bastidores, mãos manuseando objeto, detalhes de processo, espaços culturais, mesas com objetos, interiores residenciais.
• Composição: espaço negativo para texto, fundo levemente desfocado, foco claro em UM elemento, poucos objetos, silêncio visual.
• Slides de miolo no layout sanduíche mostram a foto como retângulo horizontal com cantos arredondados entre dois blocos de texto — prefira enquadramento horizontal (panorâmico ou ~3:2) com protagonista reconhecível no centro da largura.
• Exemplos BONS (note como sugerem o tema sem ilustrá-lo literalmente):
  - tema "produtividade" → "open notebook beside cooling coffee on wooden desk, late afternoon window light"
  - tema "estratégia"   → "hands rearranging objects on a quiet meeting room table, soft overhead light"
  - tema "longevidade"  → "older woman walking slowly through tree-lined street, soft morning haze"
  - tema "marca pessoal"→ "person reflected on storefront glass at dusk, warm street lights blurred behind"
  - tema "tecnologia"   → "single hand resting on closed laptop on minimal desk, quiet morning light through curtain"
• Cada slide: imageQuery DIFERENTE, todas dentro do mesmo universo visual sóbrio — sinais de tempo, grupo, consumo ou tensão social, nunca “stock genérico de negócios”.`;
  }
  return `imageQuery — uma por slide (INGLÊS, 8-15 palavras). O pipeline de imagem da aplicação aplica realismo; você descreve a CENA:
• Alinhe cada imageQuery ao argumento DAQUELE slide e ao tema "${topic}"${nicheStr}${audStr}.
• Relação com o tema: prefira sugestão inteligente à ilustração óbvia — salvo se os eixos de direção de imagem do usuário (bloco acima) pedirem literalidade ou contrário.
• Varie ambiente, clima e composição entre slides quando o conteúdo ou o modo narrativo pedirem contraste — não prenda todo o carrossel a um único clima visual “editorial”.
• Os eixos ajustados pelo usuário têm PRIORIDADE sobre exemplos genéricos ou um “look” único.
• EVITE repetir o mesmo clichê visual em todos os slides sem necessidade.
• Cada slide: imageQuery DIFERENTE.`;
}

/** Regras quando as imagens vêm de busca de fotos reais (Commons / Unsplash / Pexels via dev). */
function buildGenerationImageLayerForCommons(topic, n, audience) {
  const nicheStr = n ? ` (nicho: ${n})` : '';
  const audStr = audience ? ` (público: ${audience})` : '';
  return `imageQuery — MODO WEB TREND (busca em fototecas reais — não é geração de IA):
• INGLÊS. Termos que um fotoeditor DIGITARIA no Google/Unsplash: substantivos de CENA REAL (objeto, infraestrutura, lugar, tecnologia visível).
• OBRIGATÓRIO alinhar ao ASSUNTO DESTE SLIDE (título + subtítulo). Exemplos por domínio:
  - IA / data center / energia da nuvem → "server rack data center cooling vents", "high voltage electrical substation at dusk", "fiber optic cables in network room", "rows of GPU servers in datacenter aisle" — NUNCA "school science fair", "volcano experiment", "kids classroom" se o texto é infraestrutura digital ou energia.
  - Moda/varejo → "folded cotton shirts retail shelf", "clothing store interior".
  - Saúde → "hospital corridor soft light", não laboratório escolar genérico salvo o slide ser sobre educação.
• Se o slide fala de consumo de energia ou impacto ambiental da IA, prefira infraestrutura real (subestações, painéis solares, salas de servidores, cabos, industrial exterior) em vez de metáfora genérica "science".
• Proibido só abstração ("growth", "future") sem objeto fotografável. Combine substantivo + contexto (luz, ângulo, ambiente).
• 12-26 palavras. Varie entre slides. Alinhado ao tema "${topic}"${nicheStr}${audStr}.`;
}

function buildNarrativeModeReminder(modeId) {
  const m = GEN_MODE_BY_ID[modeId] || GEN_MODE_BY_ID.editorial;
  return `Modo narrativo do carrossel (persistido no documento): "${m.label}" — ${m.desc}.`;
}

/** Regras de comprimento/tom para refinar UM slide, alinhadas ao modo + densidade de texto. */
function buildRefineSingleSlideRules(narrativeModeId, textDensityId = '1_1') {
  const denHint = buildSlideTextDensityRefineHint(textDensityId);
  const refNoEnum = '- PROIBIDO "Slide N" / "Card N" como título — o app já numera o card.\n';
  if (narrativeModeId === 'storytelling' || narrativeModeId === 'pain') {
    return `${denHint}${refNoEnum}- Refine mantendo registro narrativo (cena, tensão, consequência ou empatia) — não converta em headline de deck + subtítulo "tese/antítese" corporativo.
- Título pode ser fragmento de cena ou virada; subtítulo em prosa coerente com o modo, sem forçar três frases analíticas se uma batida basta.`;
  }
  if (narrativeModeId === 'viral') {
    return `${denHint}${refNoEnum}- Mantenha ou reforce ritmo viral: título curto; subtítulo telegráfico (sem parágrafo denso de análise).`;
  }
  if (narrativeModeId === 'sensacionalista') {
    return `${denHint}${refNoEnum}- Refine preservando tensão sensacionalista: cortes rápidos, viradas — SEM inventar fatos nem promessa falsa para clickbait.`;
  }
  if (narrativeModeId === 'jornalistico') {
    return `${denHint}${refNoEnum}- Refine preservando hierarquia jornalística (selo/manchete/lead onde couber ao slide) e prosa factual; não converta em pitch de marca.`;
  }
  if (narrativeModeId === 'how_to') {
    return `${denHint}${refNoEnum}- Se o slide for instrucional, mantenha "Passo N · …" e imperativos; o refinamento não deve virar história ou tese de marca.`;
  }
  return `${denHint}${refNoEnum}- Título: 4–14 palavras conforme impacto. Subtítulo: aprofunde a ideia deste slide; no miolo editorial/profundo pode ser mais denso que no hook.`;
}

/** Estrutura sugerida da legenda conforme modo narrativo. */
function buildCaptionOutlineInstructions(narrativeModeId) {
  switch (narrativeModeId) {
    case 'storytelling':
    case 'pain':
      return `ESTRUTURA DA LEGENDA (modo narrativo — tom humano):
1. Abrir com tensão, momento ou pergunta (não copiar o título do slide 1).
2. Uma ou duas linhas que sintetizem o arco (${narrativeModeId === 'pain' ? 'da dor e da saída honesta' : 'da história e da virada'}).
3. Insight central sem soar como relatório executivo.
4. Convite aos comentários ou à partilha de experiência.
5. Hashtags no final.`;
    case 'viral':
      return `ESTRUTURA DA LEGENDA (modo viral — ritmo curto):
1. Linha que reforça parada de scroll (gancho).
2. Uma ou duas linhas com payoff, número ou virada principal.
3. CTA de save ou pergunta direta.
4. Hashtags. Evite ensaio longo.`;
    case 'how_to':
      return `ESTRUTURA DA LEGENDA (modo passo-a-passo):
1. Reformular a promessa do que o carrossel ensina.
2. Resumir os passos em uma linha fluida (sem listar todos os títulos).
3. Sugerir qual passo testar primeiro + save útil.
4. Hashtags.`;
    case 'deep':
      return `ESTRUTURA DA LEGENDA (modo profundo):
1. Tese contraintuitiva reformulada.
2. Padrão ou mecanismo central em linguagem acessível.
3. Implicação para quem reconhece o padrão.
4. Pergunta precisa ou save para revisitar.
5. Hashtags.`;
    case 'jornalistico':
      return `ESTRUTURA DA LEGENDA (modo jornalístico — fio/coletânea):
1. Linha de editoria/subject em CAIXAS compactas só se ficar natural no Instagram.
2. Manchete resumindo o ângulo (não copie slide 1 por extenso).
3. Lead em 2-3 linhas: o núcleo factual ou implicação.
4. Para onde isso aponta a seguir + pergunta precisa OU save sóbrio.
5. Hashtags.`;
    case 'sensacionalista':
      return `ESTRUTURA DA LEGENDA (modo sensacionalista — honestidade):
1. Gancho forte que casa com o payoff do carrossel (sem cilada).
2. Uma ou duas linhas de tensão antes da revelação sintetizada.
3. PAYOFF verdadeiro — aquilo que o leitor vai descobrir se engajar.
4. Pergunta provocadora ou save com âncora concreta.
5. Hashtags. Ritmo curtíssimo.`;
    default:
      return `ESTRUTURA DA LEGENDA:
1. Frase-tese forte (não repita literalmente o slide 1).
2. Contextualize o problema ou a leitura comum.
3. Sua leitura ou síntese principal.
4. Consequência prática ou insight aplicável.
5. Pergunta nos comentários OU CTA de salvamento elegante.`;
  }
}

/** Regras para o modal de variações de gancho — alinhadas ao modo + pacote. */
function buildHookVariationRules(narrativeModeId, creativePresetId) {
  const tendenciaCulture = isTendenciaCulturaPreset(creativePresetId);
  if (narrativeModeId === 'storytelling' || narrativeModeId === 'pain') {
    return `- Priorize entrada em CENA ou identificação emocional imediata (in medias res / "é exatamente isso") — não só fórmulas "X não é Y".
- Subtítulo: uma linha que prolonga a tensão ou o momento, não pitch analítico.
- 5 variações com cadências diferentes (tempo, gesto, fala implícita).`;
  }
  if (narrativeModeId === 'viral') {
    return `- Parada de scroll: interrupção, número específico, identificação brutal, pergunta noturna ou revelação atrasada — PROIBIDO "hoje vou te ensinar" / "você sabia".
- Subtítulo: linha de tensão ou promessa parcial.
- 5 ganchos distintos nas técnicas acima.`;
  }
  if (narrativeModeId === 'how_to') {
    return `- Título do gancho = promessa clara: "Como [resultado] em [N passos]" ou equivalente.
- Subtítulo: qual dor ou bloqueio isso resolve em uma linha.
- 5 formulações diferentes da mesma promessa (ângulos distintos).`;
  }
  if (narrativeModeId === 'deep') {
    return `- Gancho = tese contraintuitiva sobre padrão ou mecanismo escondido (sintoma vs causa).
- Subtítulo: pista seca do que será dissecado.
- 5 ângulos de tese diferentes.`;
  }
  if (narrativeModeId === 'jornalistico') {
    return `- Capa tipo fio: selo/editoria CAIXA ALTA uma linha + manchete de impacto no título principal.
- Subtítulo: LEAD factual (por que ler agora) — pode incluir marcador temporal leve quando fizer sentido ao tema.
- 5 ângulos de capa distintos (mesmo tema): ângulos de mercado, consequência política/socioeconômica humanizada, erro comum sobre o tema, dado novo, contra-narrativa factível — sem clickbait falso.`;
  }
  if (narrativeModeId === 'sensacionalista') {
    return `- Grito de tensão forte + promessa só do que ENTREGARÁ (sem miragem).
- Subtítulo: linha que aumenta o custo cognitivo de ignorar OU contraste visceral inicial.
- 5 hooks em cadências bem diferentes — tablóide moderno honesto — sem "você vai se arrepender" vazio nem ALL CAPS exagerado em todas.`;
  }
  const editorialFormats = `- Use formatos contraintuitivos: "X não está fazendo Y, está fazendo Z", "Não é sobre X. É sobre Y.", "Todo mundo viu X. Pouca gente entendeu Y.", "O mercado de X está deixando de ser sobre Y. Agora é sobre Z.", "O erro de X é achar que Y. Na prática, o jogo está em Z."`;
  const tendenciaPatterns = `
- Patterns extra (Tendência/Cultura — soe como "finalmente alguém falou isso"): "[Substantivo] muda [algo inesperado]: como [fenômeno] provou [tese]", "A nova obsessão é [comportamento]: como uma geração [consequência]", "[Grupo] está [verbo surpreendente] — e o que isso revela sobre [tensão]", "o que cresceu enquanto [contexto contrário] mudava", "por que [fenômeno] é prova de [tese provocadora]".`;
  if (tendenciaCulture) {
    return `${editorialFormats}${tendenciaPatterns}
- Âncoras no fenômeno JÁ EM CURSO (comportamento, cultura, polêmica, mercado) — não promessa de "aulinha".
- Tom assertivo e adulto — sem clichê motivacional nem guru.
- Cada gancho: 4-12 palavras de impacto.
- 5 variações DIFERENTES entre si (formatos diferentes).`;
  }
  return `${editorialFormats}
- Tom assertivo, sofisticado; pode incluir um gancho mais direto ou numérico se servir ao tema.
- Cada gancho: 4-12 palavras de impacto máximo.
- 5 variações DIFERENTES entre si (formatos diferentes).`;
}

function buildRefineVoiceRules(presetId, narrativeMode = 'editorial') {
  const storyLike = narrativeMode === 'storytelling' || narrativeMode === 'pain';
  const viralMode = narrativeMode === 'viral' || narrativeMode === 'sensacionalista';
  const journalMode = narrativeMode === 'jornalistico';
  const howToMode = narrativeMode === 'how_to';

  if (isTendenciaCulturaPreset(presetId) && storyLike) {
    return `- Refinamento: o modo narrativo "${narrativeMode}" manda — use Tendência/Cultura só para nomear fenômeno vivido com precisão, não para virar cada slide em "parece ser / realmente é" nem pitch de categoria.
- Não substitua cena ou dor por análise genérica de mercado.`;
  }
  if (isTendenciaCulturaPreset(presetId) && viralMode && narrativeMode === 'sensacionalista') {
    return `- Refinamento sensacionalista: tensão máxima e cortes rápidos; payoff honesto. O pacote cultura afina léxico sem esvaziar o drama nem engrossar em relatório corporativo.
- Zero clickbait falso: pode ser incômodo, não mentiroso.`;
  }
  if (isTendenciaCulturaPreset(presetId) && viralMode) {
    return `- Refinamento viral: frases curtas e tensão; o pacote cultura não deve densificar cada slide em parágrafo de consultoria.`;
  }
  if (isTendenciaCulturaPreset(presetId) && howToMode) {
    return `- Refinamento tutorial: imperativo e claro; sem transformar passos em keynote de “tendência” vazia.`;
  }
  if (isTendenciaCulturaPreset(presetId) && journalMode) {
    return `- Refinamento jornalístico: hierarquia de capa onde couber ao slide; factual e preciso — sem soar como pitch institucional.
- Preserve selo/editoria vs manchete vs lead quando o método pedir.`;
  }
  if (isTendenciaCulturaPreset(presetId)) {
    return `- Tom assertivo, direto, sofisticado. Sem clichês, sem linguagem motivacional, sem guru.
- Vocabulário de comportamento, cultura e mercado quando pertinente: categoria, percepção, narrativa em curso, tensão social, sinal, consequência.`;
  }
  if (storyLike) {
    return `- Refinar mantendo coerência com modo "${narrativeMode}" (narrativa empática ou em cena).
- Respeite marca e material sem impor voz de relatório.`;
  }
  if (viralMode) {
    return narrativeMode === 'sensacionalista'
      ? `- Refinar mantendo ritmo sensacionalista: tacadas curtas, viradas; sem parágrafos analíticos longos nem promessa vazia.`
      : `- Refinar mantendo ritmo viral: cortar palavras mortas; sem parágrafo analítico longo no subtítulo.`;
  }
  if (journalMode) {
    return `- Refinar mantendo registro jornalístico: lead claro quando couber ao slide; dados e consequência antes de opinião solta de influencer.`;
  }
  if (howToMode) {
    return `- Refinar mantendo passos acionáveis e linguagem de manual.`;
  }
  return `- Respeite identidade da marca, material e o tom já presentes no carrossel — não uniformize tudo ao estilo “análise de mercado” se o modo for outro.
- Siga a instrução do usuário e mantenha coerência entre slides.`;
}

function buildCaptionVoiceRules(presetId, narrativeMode = 'editorial') {
  let presetLine;
  if (isTendenciaCulturaPreset(presetId)) {
    presetLine = `- Tom: jornalístico-analítico (expande o insight como algo que o leitor já sentia); sem emojis em excesso (máx 2-3). Bloco 2: pergunta que ativa identificação + CTA orgânico. Hashtags: 5-8 específicas ao nicho.`;
  } else {
    presetLine = `- Tom: alinhado à marca e ao material; natural — sem forçar frieza analítica se o modo narrativo pedir calor humano. Emojis com moderação.`;
  }
  const modeLine =
    narrativeMode === 'storytelling' || narrativeMode === 'pain'
      ? `- Legenda com voz humana; sintetize o arco ${narrativeMode === 'pain' ? 'empático ' : ''}sem soar como resumo de relatório.`
      : narrativeMode === 'sensacionalista'
        ? `- Legenda ultra-curta; gancho + payoff real (sem cilada); CTA ou pergunta com âncora concreta.`
        : narrativeMode === 'viral'
          ? `- Legenda enxuta; reforço de gancho + payoff; CTA ou pergunta direta.`
          : narrativeMode === 'how_to'
            ? `- Legenda útil: o que foi ensinado + qual passo testar primeiro.`
            : narrativeMode === 'deep'
              ? `- Legenda que destaque padrão ou mecanismo sem jargão desnecessário.`
              : narrativeMode === 'jornalistico'
                ? `- Legenda em tom de fio: manchete + lead factual antes de hashtags.`
                : '';
  return [presetLine, modeLine].filter(Boolean).join('\n');
}

/** Viés para pesquisa de nicho — alinha ideias e ganchos ao modo/pacote do documento. */
function buildResearchPromptBias(narrativeModeId, creativePresetId) {
  const m = GEN_MODE_BY_ID[narrativeModeId] || GEN_MODE_BY_ID.editorial;
  const p = CREATIVE_PRESET_BY_ID[creativePresetId] || CREATIVE_PRESET_BY_ID.livre;
  return `
Preferências do usuário (viés suave — continue a pesquisar fatos REAIS na web):
- Modo narrativo alvo: "${m.label}" — ${m.desc}
- Pacote criativo de referência: "${p.label}" — ${p.desc}
Aplicação: em "carousel_ideas", favoreça ângulos que esse modo execute bem (ex.: storytelling → arco em cena; passo-a-passo → passos numerados; viral → tensão e payoff; profundo → padrão/mecanismo; pacote Tendência/Cultura → fenômeno de comportamento ou cultura já em curso que o público sente no feed, não “lista de dicas”). Em "viral_hooks", combine formatos estratégicos com variações compatíveis com o modo.
`;
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

const DEFAULT_BRAND = {
  id: 'default',
  name: 'Padrão',
  handle: '', showHandle: false,
  /** Posição da pílula @ no card (0–100% da largura / altura; referência = canto sup. esq. do badge). */
  handleBadgeX: 5,
  handleBadgeY: 4,
  /* Visual neutro: quadro Figma (preto/branco); realces no slide vêm do perfil de marca. */
  titleFont: '"Inter", sans-serif',
  bodyFont: '"Inter Tight", sans-serif',
  bg: '#fafafc',
  titleColor: '#000000',
  /** Linha curta sob o título nos cards do meio (nem capa nem fecho). */
  subtitleColor: '#363636',
  /** Parágrafos / corpo (ex-bloco «Subtítulo» da marca). */
  textColor: '#363636',
  accent: '#000000',
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
  textTitleWeight: 800,
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
function resolveSlideBrandBg(brand, slideIndex0, slide) {
  if (slide?.customBg) return slide.customBg;
  const alt = typeof brand?.bgAlternate === 'string' ? brand.bgAlternate.trim() : '';
  if (brand?.interleaveBg && alt) {
    const primary = brand.bg || '#fafafc';
    return slideIndex0 % 2 === 0 ? primary : alt;
  }
  return brand?.bg || '#fafafc';
}

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

/** Evita ecrã em branco quando `vc_library` ou import JSON tem doc incompleto (sem slides, etc.). */
// SCHEMA_VERSION + migrateDoc foram extraídos para src/utils/schema-migration.js

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

  // ── PADRÃO VISUAL ────────────────────────────────────────────────────────
  // Trackeia qual dos 12 presets visuais o user escolheu (null = nenhum).
  // applyVisualStylePreset: merge das cores/fontes/tipografia do preset
  // no brand atual. Chamado pelo GenerateModal antes de disparar onGenerate
  // — afeta só rendering (gerador de texto não usa cor da marca).
  const [visualPreset, setVisualPreset] = useState(null);
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
    trackEvent('visual_preset_applied', { preset: presetId });
  }, [setBrand, setSlides]);
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
  const [setupOpen, setSetupOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [hookVarsOpen, setHookVarsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [imgPrompt, setImgPrompt] = useState({ open:false, mode:null, defaultValue:'' });
  const [imageCropOpen, setImageCropOpen] = useState(false);
  const [photoPositionOpen, setPhotoPositionOpen] = useState(false);
  // Estratégia de persistência da chave OpenAI:
  // - default = sessionStorage (apaga ao fechar aba, mitiga XSS de longa duração)
  // - se usuário marcar "manter salvo entre sessões", migra para localStorage
  // Sem botão = comportamento legado preservado ao carregar (se localStorage tinha, mantém)
  const [openaiKeyPersist, setOpenaiKeyPersist] = useState(() => {
    try { return localStorage.getItem(SK.openaiKeyPersist) === '1'; } catch { return false; }
  });
  const [openaiKey, setOpenaiKey] = useState(() => {
    try {
      const ls = localStorage.getItem(SK.openaiKey) || '';
      if (ls) return ls; // legacy: já estava em localStorage, preserva
      return sessionStorage.getItem(SK.openaiKey) || '';
    } catch { return ''; }
  });
  useEffect(() => {
    try {
      if (openaiKeyPersist) {
        localStorage.setItem(SK.openaiKey, openaiKey);
        sessionStorage.removeItem(SK.openaiKey);
      } else {
        sessionStorage.setItem(SK.openaiKey, openaiKey);
        localStorage.removeItem(SK.openaiKey);
      }
      localStorage.setItem(SK.openaiKeyPersist, openaiKeyPersist ? '1' : '0');
    } catch { /* privado / bloqueado */ }
  }, [openaiKey, openaiKeyPersist]);
  // Chave Anthropic (mesmo padrão da OpenAI: session por default, localStorage se user marcar)
  const [anthropicKeyPersist, setAnthropicKeyPersist] = useState(() => {
    try { return localStorage.getItem(SK.anthropicKeyPersist) === '1'; } catch { return false; }
  });
  const [anthropicKey, setAnthropicKey] = useState(() => {
    try {
      const ls = localStorage.getItem(SK.anthropicKey) || '';
      if (ls) return ls;
      return sessionStorage.getItem(SK.anthropicKey) || '';
    } catch { return ''; }
  });
  useEffect(() => {
    try {
      if (anthropicKeyPersist) {
        localStorage.setItem(SK.anthropicKey, anthropicKey);
        sessionStorage.removeItem(SK.anthropicKey);
      } else {
        sessionStorage.setItem(SK.anthropicKey, anthropicKey);
        localStorage.removeItem(SK.anthropicKey);
      }
      localStorage.setItem(SK.anthropicKeyPersist, anthropicKeyPersist ? '1' : '0');
    } catch { /* */ }
    setAnthropicUserKey(anthropicKey);
  }, [anthropicKey, anthropicKeyPersist]);
  // Modelo Claude preferido
  const [claudeModel, setClaudeModel] = useState(() => {
    try {
      const v = localStorage.getItem(SK.claudeModel);
      return v === 'opus' ? 'opus' : 'sonnet';
    } catch { return 'sonnet'; }
  });
  useEffect(() => {
    try { localStorage.setItem(SK.claudeModel, claudeModel); } catch { /* */ }
    setClaudeModelPref(claudeModel);
  }, [claudeModel]);
  // Biblioteca de hooks aprovados (B2)
  const [hookLibrary, setHookLibrary] = useState(() => lsGet(SK.hookLibrary, []));
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
  const hasOpenAI    = !!openaiKey || (IS_LOCAL_DEV && serverStatus.openai);
  const hasAnthropic = serverStatus.anthropic || !!anthropicKey;
  const hasAnyAI     = hasOpenAI || hasAnthropic;
  const [niche, setNiche] = useState('');

  // Tour guiado — primeira visita (pode repetir pela ajuda)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    try {
      if (!localStorage.getItem(SK.onboarding)) {
        const t = window.setTimeout(() => setTourOpen(true), 850);
        return () => window.clearTimeout(t);
      }
    } catch { /* ignore */ }
    return undefined;
  }, []);
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
      return Math.min((vw - side * 2) / f.w, 0.92);
    }
    // Desktop: thumbnail compacta na faixa horizontal.
    return Math.min(360 / f.w, 0.44);
  }, [isMobile, vw, f]);

  const slide = slides[activeIdx] ?? slides[0] ?? mkSlide(1, brand);
  const empty = isDefault(slides);

  useEffect(() => {
    if (!slide.bgImage && imageCropOpen) setImageCropOpen(false);
    if (!slide.bgImage && photoPositionOpen) setPhotoPositionOpen(false);
  }, [slide.bgImage, imageCropOpen, photoPositionOpen]);

  const editorHeaderActions = (
        <div style={{ display:'flex', alignItems:'center', gap: isMobile ? 4 : 6, flexShrink:0 }}>
          {!isMobile && (
            <button onClick={()=>setTemplatesOpen(true)} style={{
              width:34, height:34, borderRadius:8, border:'1px solid var(--border)',
              background:'var(--bg-card)', color:'var(--text-muted)', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s',
            }}
                  onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
            onMouseLeave={e=>{e.currentTarget.style.color='var(--text-muted)';e.currentTarget.style.borderColor='var(--border)';}}
            title="Templates prontos" aria-label="Abrir templates">
              <Layout size={13}/>
            </button>
          )}
          <button type="button" data-vc-tour="library" onClick={()=>setLibraryOpen(true)} style={{
            width: isMobile ? 40 : 34, height: isMobile ? 40 : 34,
            borderRadius:8, border:'1px solid var(--border)',
            background:'var(--bg-card)', color:'var(--text-muted)', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s',
            position:'relative',
          }}
          onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
          onMouseLeave={e=>{e.currentTarget.style.color='var(--text-muted)';e.currentTarget.style.borderColor='var(--border)';}}
          title={`Biblioteca · ${library.length} carrosséis`} aria-label="Abrir biblioteca">
            <BookOpen size={13}/>
            {library.length > 1 && (
              <span style={{
                position:'absolute', top:-4, right:-4,
                fontSize:8, fontWeight:700, fontFamily:'var(--font-mono)',
                background:'var(--accent)', color:'#fff',
                padding:'1px 5px', borderRadius:99, lineHeight:1.2,
                minWidth:14, textAlign:'center', pointerEvents:'none',
              }}>{library.length}</span>
            )}
          </button>
          {!empty && (
            <button onClick={()=>setFullscreenOpen(true)} style={{
              width: isMobile ? 40 : 34, height: isMobile ? 40 : 34,
              borderRadius:8, border:'1px solid var(--border)',
              background:'var(--bg-card)', color:'var(--text-muted)', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s',
            }}
            onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
            onMouseLeave={e=>{e.currentTarget.style.color='var(--text-muted)';e.currentTarget.style.borderColor='var(--border)';}}
            title="Tela cheia (F)" aria-label="Apresentar em tela cheia">
              <Maximize2 size={13}/>
            </button>
          )}
          {!isMobile && (
            <button onClick={()=>setHelpOpen(true)} style={{
              width:34, height:34, borderRadius:8, border:'1px solid var(--border)',
              background:'var(--bg-card)', color:'var(--text-muted)', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s',
            }}
                  onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
            onMouseLeave={e=>{e.currentTarget.style.color='var(--text-muted)';e.currentTarget.style.borderColor='var(--border)';}}
            title="Atalhos de teclado (?)" aria-label="Ajuda e atalhos">
              <span style={{ fontSize:14, fontWeight:600 }}>?</span>
            </button>
          )}
          <button type="button" data-vc-tour="settings" onClick={()=>setKeysOpen(true)} style={{
            width: isMobile ? 40 : 34, height: isMobile ? 40 : 34,
            borderRadius:8, border:`1px solid ${hasAnyAI ? 'var(--success-border)' : 'var(--divider-soft)'}`,
            background: hasAnyAI ? 'var(--success-surface)' : 'var(--bg-pearl)',
            color: hasAnyAI ? 'var(--success-text)' : 'var(--text-secondary)', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s',
          }}
                  onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
          onMouseLeave={e=>{e.currentTarget.style.color=hasAnyAI?'var(--success-text)':'var(--text-secondary)';e.currentTarget.style.borderColor=hasAnyAI?'var(--success-border)':'var(--divider-soft)';}}
          title={
            hasOpenAI && hasAnthropic ? 'Anthropic + OpenAI configurados ✓' :
            hasOpenAI                 ? 'OpenAI configurado ✓' :
            hasAnthropic              ? 'Anthropic (Claude) configurado ✓' :
                                        'Configurar API keys'
          } aria-label="Configurações">
            <Settings size={13}/>
          </button>
          {!isMobile && (
            <button onClick={()=>setResearchOpen(true)} style={{
              width:34, height:34, borderRadius:11, border:'1px solid var(--divider-soft)',
              background:'var(--bg-pearl)', color:'var(--text-secondary)', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s var(--ease-smooth)',
            }}
            onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.background='#f0f0f3';}}
            onMouseLeave={e=>{e.currentTarget.style.color='var(--text-secondary)';e.currentTarget.style.background='var(--bg-pearl)';}}
            title="Pesquisar nicho" aria-label="Pesquisar nicho">
              <TrendingUp size={14}/>
            </button>
          )}
          <button type="button" data-vc-tour="generate" onClick={()=>setSetupOpen(true)} style={{
            height: isMobile ? 40 : 34, padding: '0 16px',
            borderRadius:9999, border:'none', cursor:'pointer',
            background:'var(--accent)',
            color:'#fff', fontSize:13, fontWeight:400, fontFamily:'var(--font-ui)',
            letterSpacing:'-0.016em',
            display:'flex', alignItems:'center', gap:6,
            transition:'background-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
          }}
          onMouseEnter={e=>e.currentTarget.style.background='var(--accent-hover)'}
          onMouseLeave={e=>e.currentTarget.style.background='var(--accent)'}
          onMouseDown={e=>e.currentTarget.style.transform='scale(0.95)'}
          onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
          aria-label="Gerar carrossel com IA"
          >
            <Sparkles size={isMobile ? 14 : 13}/>{!isMobile && 'Gerar'}
          </button>
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
      toast('Configure a chave OpenAI para gerar com GPT Image (ícone de engrenagem).', 'error');
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

  // Aplica um template pronto (preenche slides + brand)
  const applyTemplate = useCallback((tpl) => {
    const palette = PALETTES[tpl.palette] || PALETTES[0];
    const titleFont = TITLE_FONTS[tpl.titleFont] || TITLE_FONTS[0];
    const bodyFont = BODY_FONTS[tpl.bodyFont] || BODY_FONTS[0];
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
      };
      const hb = hydrateBrandTextColors(nextBrand);
      newSlides = tpl.slides.map((s, i) => ({
        ...mkSlide(i + 1, hb),
        title: s.title,
        subtitle: s.subtitle,
        imageQuery: s.q,
        imgMode: 'dalle',
        bgImage: null,
        overlay: 65,
        layout: i === 0 ? 'mc' : 'bl',
        align: i === 0 ? 'center' : 'left',
      }));
      return { ...d, slides: newSlides, brand: hb };
    });
    setActiveIdx(0);
    toast(`Template "${tpl.name}" aplicado`, 'success');
    trackEvent('template_applied', { template: tpl.id || tpl.name });
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
  };

  const desktopThumbWidth = f.w * previewScale;

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
          hasOpenAI={hasOpenAI}
          hasAnthropic={hasAnthropic}
          hasAnyAI={hasAnyAI}
          isMobile={isMobile}
          onGenerate={() => setSetupOpen(true)}
          onOpenLibrary={() => setLibraryOpen(true)}
          onOpenTemplates={() => setTemplatesOpen(true)}
          onOpenResearch={() => setResearchOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
          onOpenSettings={() => setKeysOpen(true)}
          onContinueEditor={() => setShellView('project')}
          onImportPick={() => importDocRef.current?.click()}
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
      {/* ── HEADER ── */}
      <header style={{
        borderBottom:'1px solid var(--border)', background:'var(--bg-sidebar)',
        flexShrink:0,
        ...(isMobile ? {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 10,
          padding: `calc(10px + env(safe-area-inset-top, 0)) max(12px, env(safe-area-inset-left, 0px)) 12px max(12px, env(safe-area-inset-right, 0px))`,
        } : {
          display:'flex',
          alignItems:'center',
          justifyContent:'space-between',
          padding:'env(safe-area-inset-top, 0) 14px 0',
          height: `calc(52px + env(safe-area-inset-top, 0))`,
          gap:10,
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
                  onClick={() => setShellView('home')}
                  title="Início — projetos e conta"
                  aria-label="Início"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
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
              {editorHeaderActions}
            </div>
            <EditorFormatSelector fmt={fmt} setFmt={setFmt} layout="mobile" />
          </>
        ) : (
          <>
        {/* Brand */}
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
          <div style={{
            width:30, height:30, borderRadius:8, background:'var(--logo-mark-bg)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <Flame size={14} color="var(--logo-mark-fg)"/>
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.022em', lineHeight:1, fontFamily:'var(--font-display)' }}>
              Viral<span style={{ color:'var(--accent)' }}>.</span>
            </div>
            {activeEntry && (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:3, flexWrap:'wrap' }}>
                <button
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
                    fontSize:11, color:'var(--text-muted)',
                    letterSpacing:'-0.011em',
                    background:'none', border:'none', cursor:'pointer', padding:0,
                    maxWidth:220, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                    textAlign:'left',
                  }}
                  title="Clique para renomear"
                >
                  {activeEntry.name || 'Sem título'}
                </button>
                <SavedIndicator savedAt={lastSavedAt}/>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShellView('home')}
          title="Início — projetos e conta"
          aria-label="Início"
          style={{
            width: 32,
            height: 32,
            borderRadius: 11,
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
          <Home size={14} />
        </button>

        {/* Undo/Redo */}
        <div style={{
            display:'flex', alignItems:'center', background:'var(--bg-card)',
            borderRadius:8, padding:3, gap:0, border:'1px solid var(--border)', flexShrink:0,
          }}>
            <button
              onClick={history.undo}
              disabled={!history.canUndo}
              title="Desfazer (⌘Z)"
              aria-label="Desfazer"
              style={{
                width:28, height:26, borderRadius:5, border:'none', background:'transparent',
                color:'var(--text-muted)', cursor: history.canUndo ? 'pointer' : 'not-allowed',
                display:'flex', alignItems:'center', justifyContent:'center',
                opacity: history.canUndo ? 1 : 0.35, transition:'all 0.12s',
              }}
              onMouseEnter={e=>{ if(history.canUndo) e.currentTarget.style.color='var(--text-primary)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.color='var(--text-muted)'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7L3 9"/></svg>
            </button>
            <button
              onClick={history.redo}
              disabled={!history.canRedo}
              title="Refazer (⌘⇧Z)"
              aria-label="Refazer"
              style={{
                width:28, height:26, borderRadius:5, border:'none', background:'transparent',
                color:'var(--text-muted)', cursor: history.canRedo ? 'pointer' : 'not-allowed',
                display:'flex', alignItems:'center', justifyContent:'center',
                opacity: history.canRedo ? 1 : 0.35, transition:'all 0.12s',
              }}
              onMouseEnter={e=>{ if(history.canRedo) e.currentTarget.style.color='var(--text-primary)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.color='var(--text-muted)'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M21 13a9 9 0 1 1-3-7l3 3"/></svg>
            </button>
          </div>

        <EditorFormatSelector fmt={fmt} setFmt={setFmt} layout="desktop" />
        {editorHeaderActions}
          </>
        )}
      </header>

      {/* ── BODY ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Desktop sidebar */}
        {!isMobile && (
          <aside style={{
            width:272, borderRight:'1px solid var(--border)', background:'var(--bg-sidebar)',
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

          {/* ── THUMBNAIL STRIP ── */}
          <div
            data-vc-tour="thumbnails"
            style={{
            background:'var(--bg-sidebar)', borderBottom:'1px solid var(--border)',
            padding: isMobile ? '8px 10px' : '10px 14px',
            flexShrink:0,
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

          {/* Mobile bottom bar — 6 abas em grid 3×2 + ação de baixar.
              Empurra o conteúdo da home indicator iOS via safe-area-inset-bottom. */}
          {isMobile && !empty && !drawerOpen && (
            <div
              data-vc-tour="mobile-bar"
              style={{
              position:'fixed', bottom:0, left:0, right:0, zIndex:20,
              background:'var(--bg-sidebar)', borderTop:'1px solid var(--border)',
              padding:'8px 8px calc(8px + env(safe-area-inset-bottom, 0))',
              display:'flex', gap:6, alignItems:'stretch',
              boxShadow:'0 -4px 16px rgba(0,0,0,0.4)',
              backdropFilter:'blur(8px)',
            }}
            >
              <div style={{
                flex:1, display:'grid',
                gridTemplateColumns:'repeat(3, minmax(0, 1fr))',
                gap:4,
              }}>
              {[
                // FASE 1 Narrative OS — 6 domínios finais no bottom nav (grid 3×2)
                { id:'narrativa', label:'Narrativa', icon:Wand2 },
                { id:'visual',    label:'Visual',    icon:Palette },
                { id:'imagem',    label:'Imagem',    icon:ImageIcon },
                { id:'layout',    label:'Layout',    icon:Layout },
                { id:'texto',     label:'Texto',     icon:Type },
                { id:'brand',     label:'Marca',     icon:Instagram },
              ].map(({ id, label, icon:Icon }) => (
                <button
                  key={id}
                  onClick={() => { setTab(id); setDrawerOpen(true); }}
                  style={{
                    minHeight:46, borderRadius:10, border:'1px solid var(--hairline)',
                    background:'var(--bg-pearl)', color:'var(--text-secondary)',
                    fontSize:11, fontWeight:600, fontFamily:'var(--font-ui)', cursor:'pointer',
                    display:'flex', flexDirection:'row', alignItems:'center', justifyContent:'center', gap:5,
                    letterSpacing:'-0.011em',
                    transition:'background-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
                  }}
                  onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                  onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  aria-label={`Abrir aba ${label}`}
                >
                  <Icon size={13}/>{label}
                </button>
              ))}
              </div>
              <button
                onClick={() => exportSlide(activeIdx)}
                disabled={exporting}
                style={{
                  flex:1.4, height:48, borderRadius:9999, border:'none', cursor:'pointer',
                  background:'var(--accent)', color:'#fff',
                  fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3,
                  letterSpacing:'-0.011em',
                  opacity:exporting?0.5:1,
                  transition:'background-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
                }}
                onTouchStart={e => { if (!exporting) e.currentTarget.style.transform = 'scale(0.95)'; }}
                onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                aria-label="Exportar card atual"
              >
                <Download size={14}/>Exportar
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
        openaiKey={openaiKey}
        onSave={setOpenaiKey}
        onRefreshStatus={setServerStatus}
        openaiKeyPersist={openaiKeyPersist}
        onChangePersist={setOpenaiKeyPersist}
        claudeModel={claudeModel}
        onChangeClaudeModel={setClaudeModel}
        anthropicKey={anthropicKey}
        onSaveAnthropic={setAnthropicKey}
        anthropicKeyPersist={anthropicKeyPersist}
        onChangeAnthropicPersist={setAnthropicKeyPersist}
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
        onOpenKeys={() => setKeysOpen(true)}
        onGoToMaterial={() => {
          setShellView('project');
          setTab('material');
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
  hasOpenAI,
  hasAnthropic,
  hasAnyAI,
  isMobile,
  onGenerate,
  onOpenLibrary,
  onOpenTemplates,
  onOpenResearch,
  onOpenHelp,
  onOpenSettings,
  onContinueEditor,
  onImportPick,
  openDoc,
  newDoc,
  renameDoc,
  duplicateDoc,
  deleteDoc,
  setDocStatus,
  exportDoc,
  askPrompt,
}) {
  const totalCards = useMemo(
    () => library.reduce((n, e) => n + (Array.isArray(e.doc?.slides) ? e.doc.slides.length : 0), 0),
    [library],
  );

  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const items = useMemo(() => (
    [...library]
      .filter(e => !search.trim() || (e.name || '').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  ), [library, search]);

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
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: isMobile ? 12 : 10,
        padding: isMobile
          ? `calc(10px + env(safe-area-inset-top, 0)) max(12px, env(safe-area-inset-left, 0px)) 12px max(12px, env(safe-area-inset-right, 0px))`
          : `calc(10px + env(safe-area-inset-top, 0)) 16px 10px`,
        flexShrink: 0,
      }}>
        {isMobile ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8, background: 'var(--logo-mark-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Flame size={16} color="var(--logo-mark-fg)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 17, fontWeight: 600, letterSpacing: '-0.022em',
                    fontFamily: 'var(--font-display)', color: 'var(--text-primary)',
                  }}>
                    Viral<span style={{ color: 'var(--accent)' }}>.</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '-0.011em' }}>
                    Dados só neste aparelho
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => onOpenSettings()} aria-label="Configurações" style={{
                width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                border: `1px solid ${hasAnyAI ? 'var(--success-border)' : 'var(--divider-soft)'}`,
                background: hasAnyAI ? 'var(--success-surface)' : 'var(--bg-pearl)',
                color: hasAnyAI ? 'var(--success-text)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Settings size={13} />
              </button>
            </div>
            <button type="button" data-vc-tour="generate" onClick={() => onGenerate()} style={{
              width: '100%',
              minHeight: 48,
              padding: '0 20px',
              borderRadius: 9999,
              border: 'none',
              cursor: 'pointer',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 400,
              letterSpacing: '-0.016em',
              fontFamily: 'var(--font-ui)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <Sparkles size={15} /> Gerar com IA
            </button>
          </>
        ) : (
          <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, background: 'var(--logo-mark-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Flame size={16} color="var(--logo-mark-fg)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 17, fontWeight: 600, letterSpacing: '-0.022em',
              fontFamily: 'var(--font-display)', color: 'var(--text-primary)',
            }}>
              Viral<span style={{ color: 'var(--accent)' }}>.</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '-0.011em' }}>
              Início · dados apenas neste navegador
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={() => onOpenTemplates()} aria-label="Templates prontos" style={{
              width: 36, height: 36, borderRadius: 11, border: '1px solid var(--border)',
              background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Layout size={13} />
            </button>
          <button type="button" onClick={() => onOpenResearch()} aria-label="Pesquisar nicho" style={{
              width: 36, height: 36, borderRadius: 11, border: '1px solid var(--divider-soft)',
              background: 'var(--bg-pearl)', color: 'var(--text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingUp size={14} />
            </button>
          <button type="button" onClick={() => onOpenHelp()} aria-label="Ajuda" style={{
              width: 36, height: 36, borderRadius: 11, border: '1px solid var(--border)',
              background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>?</span>
            </button>
          <button type="button" onClick={() => onOpenSettings()} aria-label="Configurações" style={{
            width: 36, height: 36, borderRadius: 8,
            border: `1px solid ${hasAnyAI ? 'var(--success-border)' : 'var(--divider-soft)'}`,
            background: hasAnyAI ? 'var(--success-surface)' : 'var(--bg-pearl)',
            color: hasAnyAI ? 'var(--success-text)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Settings size={13} />
          </button>
          <button type="button" data-vc-tour="generate" onClick={() => onGenerate()} style={{
            height: 38, padding: '0 20px',
            borderRadius: 9999, border: 'none', cursor: 'pointer',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 400,
            letterSpacing: '-0.016em',
            fontFamily: 'var(--font-ui)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <Sparkles size={13} /> Gerar com IA
          </button>
        </div>
          </>
        )}
      </header>

      <div style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: 912,
          marginLeft: 'auto',
          marginRight: 'auto',
          padding: isMobile ? '24px 16px 32px' : '48px 24px 80px',
        }}>
        <p style={{
          margin: '0 0 8px', fontSize: 11, letterSpacing: '0.12em',
          fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)',
          fontFamily: 'var(--font-ui)',
        }}>Área da conta</p>
        <h2 style={{
          margin: '0 0 12px', fontSize: 28, fontWeight: 600, letterSpacing: '-0.024em',
          fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1.12,
        }}>Olá de novo</h2>
        <p style={{
          margin: '0 0 32px', fontSize: 17, lineHeight: 1.47,
          letterSpacing: '-0.011em', color: 'var(--text-secondary)',
          maxWidth: '62ch',
        }}>
          <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Projeto em edição:</strong>{' '}
          <button type="button" onClick={onContinueEditor} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 0, color: 'var(--accent)', font: 'inherit', fontWeight: 600,
          }}>{activeEntryName || 'Sem título'}</button>.
          Para continuar, abra o editor e use as abas <strong style={{ fontWeight: 600 }}>Marca</strong>,{' '}
          <strong style={{ fontWeight: 600 }}>Conteúdo</strong>,{' '}
          <strong style={{ fontWeight: 600 }}>Cards</strong> e <strong style={{ fontWeight: 600 }}>IA</strong>.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 32,
        }}>
          {[
            { k: 'projetos', label: 'Projetos', value: library.length },
            { k: 'perfis', label: 'Perfis de marca', value: brandCount },
            {
              k: 'cartoes',
              label: 'Cards no total',
              value: totalCards,
              hint: 'Soma todos os projetos salvos aqui.',
            },
          ].map(({ k, label, value, hint }) => (
            <div key={k} style={{
              background: 'var(--bg-pearl)', borderRadius: 18,
              border: '1px solid var(--hairline)',
              padding: 20,
            }}>
              <div style={{
                fontSize: 11,
                letterSpacing: '0.06em',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}>{label}</div>
              <div style={{
                fontSize: 30, fontWeight: 600,
                letterSpacing: '-0.028em',
                fontFamily: 'var(--font-display)',
                color: 'var(--text-primary)',
                lineHeight: 1,
              }}>{value}</div>
              {hint && (
                <div style={{
                  marginTop: 10, fontSize: 13, letterSpacing: '-0.011em',
                  color: 'var(--text-muted)',
                }}>{hint}</div>
              )}
            </div>
          ))}
        </div>

        <div style={{
          background: 'var(--bg-parchment)', borderRadius: 18, border: '1px solid var(--hairline)',
          padding: 20,
          marginBottom: 24,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            flex: '1 1 200px',
            fontSize: 14,
            color: 'var(--text-secondary)',
            letterSpacing: '-0.011em',
          }}>
            <div style={{
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 4,
            }}>Ligações de IA</div>
            {hasAnthropic ? 'Anthropic disponível para texto. ' : 'Anthropic opcional. '}
            {hasOpenAI ? 'OpenAI disponível para texto e imagens. ' : 'OpenAI opcional (GPT Image ou chave neste dispositivo). '}
            {!hasAnyAI && 'Configure as chaves no ícone de engrenagem.'}
          </div>
          <button type="button" onClick={() => onOpenSettings()} style={{
            height: 40, padding: '0 18px', borderRadius: 9999,
            border: '1px solid var(--accent)', cursor: 'pointer',
            background: 'var(--bg-base)', color: 'var(--accent)',
            fontSize: 13, fontFamily: 'var(--font-ui)', fontWeight: 400,
          }}>APIs</button>
        </div>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 16,
          alignItems: 'center',
        }}>
          <h3 style={{
            flex: '1 1 auto', margin: 0, fontSize: 21, letterSpacing: '-0.022em',
            fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--text-primary)',
          }}>Projetos</h3>
          <button type="button" onClick={() => onOpenLibrary()} data-vc-tour="library" style={{
            height: 38, padding: '0 16px',
            borderRadius: 9999, border: '1px solid var(--border)',
            background: 'var(--bg-base)', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
          }}>Ver tudo na biblioteca</button>
          <button type="button" onClick={() => onImportPick()} style={{
            height: 38, padding: '0 16px',
            borderRadius: 9999, border: '1px solid var(--border)',
            background: 'var(--bg-base)', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
          }}>Importar JSON</button>
          <button type="button" onClick={() => newDoc()} style={{
            height: 38, padding: '0 16px',
            borderRadius: 9999, border: 'none',
            cursor: 'pointer',
            background: 'var(--accent)',
            color: '#fff', fontSize: 13, fontFamily: 'var(--font-ui)',
          }}>
            <Layers size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
            Novo projeto
          </button>
          <button type="button" onClick={() => onContinueEditor()} style={{
            height: 38, padding: '0 16px',
            borderRadius: 9999, border: '1px solid var(--accent)',
            background: 'var(--bg-base)', cursor: 'pointer',
            color: 'var(--accent)', fontSize: 13, fontFamily: 'var(--font-ui)',
          }}>
            Ir ao editor
          </button>
        </div>

        <input
          type="search"
          placeholder="Filtrar por nome…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="vc-input"
          aria-label="Filtrar projetos"
          style={{ width: '100%', marginBottom: 16 }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.length === 0 && (
            <div style={{
              padding: 40,
              textAlign: 'center',
              color: 'var(--text-muted)',
              border: `1px dashed var(--hairline)`,
              borderRadius: 18,
              fontSize: 15,
              letterSpacing: '-0.011em',
            }}>
              Sem correspondências nesta pesquisa.
            </div>
          )}
          {items.map(entry => {
            const isActive = entry.id === activeDocId;
            const status = STATUS_BY_ID[entry.status] || STATUS_BY_ID.draft;
            const slides = entry.doc?.slides || [];
            const firstSlide = slides[0];
            const bg = resolveSlideBrandBg(entry.doc?.brand || {}, 0, firstSlide || {});
            return (
              <div
                key={entry.id}
                style={{
                  background: isActive ? 'var(--accent-surface)' : 'var(--bg-pearl)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--hairline)'}`,
                  borderRadius: 18,
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
                    <span style={{
                      padding: '2px 7px',
                      borderRadius: 99,
                      background: status.bg,
                      border: `1px solid ${status.border}`,
                      color: status.color,
                      fontWeight: 600,
                    }}>{status.label}</span>
                    {' · '}
                    {slides.length}{' '}card{slides.length !== 1 ? 's' : ''}
                    {entry.updatedAt && (
                      <span>{' '}· atualizado {' '}{fmtDate(entry.updatedAt)}</span>
                    )}
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

        {!isMobile && (
          <p style={{
            marginTop: 48,
            fontSize: 14,
            lineHeight: 1.47,
            letterSpacing: '-0.011em',
            color: 'var(--text-muted)',
          }}>
            Fluxo recomendado: primeiro <strong style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Marca</strong>{' '}
            e a base de <strong style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Conteúdo</strong>,
            {' '}depois edição nos <strong style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Cards</strong>,
            {' '}por fim <strong style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>IA</strong> para refinar e gerar legenda.
          </p>
        )}
        </div>
      </div>
    </div>
  );
}

// ─── LIBRARY MODAL ────────────────────────────────────────────────────────────
// Lista os carrosséis salvos com mini-thumbnail, nome editável, status e ações.
function LibraryModal({ open, onClose, library, activeDocId, onOpen, onNew, onDuplicate, onDelete, onRename, onSetStatus, onExportDoc, onExportAll, onImportTrigger }) {
  useScrollLock(open);
  const [filter, setFilter] = useState('all'); // all | draft | ready | published
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  if (!open) return null;

  const items = library
    .filter(e => filter === 'all' || e.status === filter)
    .filter(e => !search.trim() || e.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const counts = {
    all:       library.length,
    draft:     library.filter(e => e.status === 'draft').length,
    ready:     library.filter(e => e.status === 'ready').length,
    published: library.filter(e => e.status === 'published').length,
  };

  const startEdit = (entry) => { setEditingId(entry.id); setEditingName(entry.name); };
  const commitEdit = () => {
    if (editingId && editingName.trim()) onRename(editingId, editingName.trim());
    setEditingId(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel-wide" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--bg-sidebar)', zIndex:1,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <BookOpen size={14} color="var(--text-secondary)"/>
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.022em' }}>Biblioteca</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{counts.all} projetos salvos</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="vc-icon-btn">
            <X size={16}/>
          </button>
        </div>

        {/* Toolbar */}
        <div style={{ padding:'14px 20px 0', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', gap:8 }}>
            <button
              onClick={() => onNew()}
              style={{
                height:40, flex:1, borderRadius:9, border:'none', cursor:'pointer',
                background:'linear-gradient(135deg, var(--accent), #e03220)',
                color:'#fff', fontSize:13, fontWeight:700, fontFamily:'var(--font-ui)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow:'0 4px 14px rgba(255,77,46,0.25)',
              }}
            >
              <Plus size={14}/>Novo carrossel
            </button>
            <button
              onClick={onExportAll}
              title="Exportar toda a biblioteca como JSON"
              style={{
                height:40, padding:'0 14px', borderRadius:9, cursor:'pointer',
                background:'var(--bg-card)', border:'1px solid var(--border)',
                color:'var(--text-secondary)', fontSize:12, fontWeight:600,
                fontFamily:'var(--font-ui)', display:'flex', alignItems:'center', gap:6,
              }}
            >
              <Download size={13}/>Exportar
            </button>
            <button
              onClick={onImportTrigger}
              title="Importar projetos de um arquivo JSON"
              style={{
                height:40, padding:'0 14px', borderRadius:9, cursor:'pointer',
                background:'var(--bg-card)', border:'1px solid var(--border)',
                color:'var(--text-secondary)', fontSize:12, fontWeight:600,
                fontFamily:'var(--font-ui)', display:'flex', alignItems:'center', gap:6,
              }}
            >
              <Upload size={13}/>Importar
            </button>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar pelo nome..."
              className="vc-input"
              style={{ flex:1 }}
            />
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {[
              { id:'all',       label:'Todos' },
              { id:'draft',     label:'Rascunhos' },
              { id:'ready',     label:'Prontos' },
              { id:'published', label:'Publicados' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  fontSize:11, padding:'5px 11px', borderRadius:99, cursor:'pointer',
                  fontFamily:'var(--font-ui)', fontWeight:600, transition:'all 0.12s',
                  background: filter === f.id ? 'var(--accent)' : 'var(--bg-card)',
                  border: `1px solid ${filter === f.id ? 'var(--accent)' : 'var(--border)'}`,
                  color: filter === f.id ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {f.label} <span style={{ opacity:0.6, marginLeft:3 }}>({counts[f.id]})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div style={{ padding:'14px 20px 20px', display:'flex', flexDirection:'column', gap:8 }}>
          {items.length === 0 && (() => {
            // Empty state diferenciado: biblioteca 100% vazia (primeira visita) vs filtro
            const totalLibrary = library.filter(e => !isDefault(e.doc?.slides || [])).length;
            const isFirstVisit = totalLibrary === 0 && !search.trim() && filter === 'all';
            if (isFirstVisit) {
              return (
                <div style={{
                  padding:'48px 24px', textAlign:'center', display:'flex', flexDirection:'column',
                  alignItems:'center', gap:14, color:'var(--text-secondary)', fontFamily:'var(--font-ui)',
                }}>
                  <div style={{
                    width:60, height:60, borderRadius:16, background:'var(--success-surface)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <BookOpen size={24} style={{ color:'var(--accent)' }}/>
                  </div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.018em', marginBottom:4 }}>
                      Sua biblioteca está vazia
                    </div>
                    <div style={{ fontSize:13, lineHeight:1.55, maxWidth:320, color:'var(--text-muted)', letterSpacing:'-0.011em' }}>
                      Crie seu primeiro carrossel — depois ele aparece aqui com auto-save, nome editável e ações de duplicar/exportar.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { onClose(); onNew?.(); }}
                    style={{
                      marginTop:6, padding:'10px 18px', borderRadius:9999, cursor:'pointer',
                      background:'var(--accent)', color:'#fff', border:'none',
                      fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)',
                      letterSpacing:'-0.011em', display:'inline-flex', alignItems:'center', gap:8,
                    }}
                  >
                    <Plus size={14}/>
                    Criar primeiro carrossel
                  </button>
                </div>
              );
            }
            return (
              <div style={{
                padding:'40px 20px', textAlign:'center', color:'var(--text-muted)',
                fontSize:13, fontFamily:'var(--font-ui)',
              }}>
                {search.trim() ? 'Nenhum carrossel com esse nome.' : 'Nenhum carrossel neste filtro.'}
              </div>
            );
          })()}
          {items.map(entry => {
            const isActive = entry.id === activeDocId;
            const status = STATUS_BY_ID[entry.status] || STATUS_BY_ID.draft;
            const slides = entry.doc?.slides || [];
            const firstSlide = slides[0];
            const bg = resolveSlideBrandBg(entry.doc?.brand || {}, 0, firstSlide || {}) || '#0a0a0a';
            const editing = editingId === entry.id;
            return (
              <div
                key={entry.id}
                style={{
                  background: isActive ? 'rgba(255,77,46,0.06)' : 'var(--bg-card)',
                  border:`1.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius:11, padding:12,
                  display:'flex', alignItems:'center', gap:12,
                  transition:'all 0.12s',
                }}
              >
                {/* Mini-thumbnail */}
                <button
                  onClick={() => onOpen(entry.id)}
                  style={{
                    width:56, height:70, borderRadius:6, flexShrink:0, cursor:'pointer',
                    background: bg,
                    backgroundImage: firstSlide?.bgImage ? `url(${firstSlide.bgImage})` : 'none',
                    backgroundSize:'cover', backgroundPosition:'center',
                    border:'1px solid rgba(255,255,255,0.06)',
                    position:'relative', overflow:'hidden',
                  }}
                  aria-label={`Abrir ${entry.name}`}
                >
                  {firstSlide?.bgImage && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.4)' }}/>}
                  <span style={{
                    position:'absolute', bottom:3, left:5, fontSize:7, fontWeight:700,
                    color:'rgba(255,255,255,0.7)', fontFamily:'var(--font-mono)', letterSpacing:'0.04em',
                  }}>
                    {String(slides.length).padStart(2,'0')}
                  </span>
                </button>

                {/* Conteúdo */}
                <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:4 }}>
                  {editing ? (
                    <input
                      autoFocus
                      type="text"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="vc-input"
                      style={{ padding:'6px 8px', fontSize:13, fontWeight:600 }}
                    />
                  ) : (
                    <button
                      onClick={() => onOpen(entry.id)}
                      onDoubleClick={() => startEdit(entry)}
                      style={{
                        background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'left',
                        fontSize:13.5, fontWeight:600, color:'var(--text-primary)',
                        fontFamily:'var(--font-ui)', letterSpacing:'-0.011em',
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      }}
                      title={entry.name + ' (clique duplo para renomear)'}
                    >
                      {entry.name}
                    </button>
                  )}
                  <div style={{
                    display:'flex', alignItems:'center', gap:8, fontSize:10,
                    color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.04em',
                  }}>
                    <span style={{
                      padding:'2px 7px', borderRadius:99,
                      background: status.bg, color: status.color,
                      border: `1px solid ${status.border}`, fontWeight:700,
                    }}>{status.label}</span>
                    <span>{slides.length} cards</span>
                    <span style={{ opacity:0.6 }}>· {fmtDate(entry.updatedAt)}</span>
                  </div>
                </div>

                {/* Ações */}
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {/* Toggle de status */}
                  <select
                    value={entry.status}
                    onChange={e => onSetStatus(entry.id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{
                      fontSize:10, padding:'4px 6px', borderRadius:6,
                      background:'var(--bg-elevated)', color:'var(--text-secondary)',
                      border:'1px solid var(--border)', fontFamily:'var(--font-mono)',
                      cursor:'pointer', appearance:'auto', maxWidth:110,
                    }}
                  >
                    {STATUS_DEFS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <div style={{ display:'flex', gap:4 }}>
                    <button
                      onClick={() => startEdit(entry)}
                      title="Renomear"
                      style={{ width:26, height:26, borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                    </button>
                    <button
                      onClick={() => onDuplicate(entry.id)}
                      title="Duplicar"
                      style={{ width:26, height:26, borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                    >
                      <Copy size={10}/>
                    </button>
                    <button
                      onClick={() => onExportDoc(entry.id)}
                      title="Exportar como JSON"
                      style={{ width:26, height:26, borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                    >
                      <Download size={10}/>
                    </button>
                    {confirmDeleteId === entry.id ? (
                      <>
                        <button
                          onClick={() => { onDelete(entry.id); setConfirmDeleteId(null); }}
                          title="Confirmar exclusão"
                          style={{ height:26, padding:'0 8px', borderRadius:5, border:'1px solid rgba(248,113,113,0.5)', background:'rgba(248,113,113,0.15)', color:'#f87171', cursor:'pointer', fontSize:10, fontWeight:700, fontFamily:'var(--font-ui)' }}
                        >OK</button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          title="Cancelar"
                          style={{ width:26, height:26, borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                        ><X size={10}/></button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(entry.id)}
                        title="Apagar"
                        style={{ width:26, height:26, borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                      >
                        <Trash2 size={10}/>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── BRANDS MODAL ─────────────────────────────────────────────────────────────
// Gerencia perfis de marca: lista, aplica, salva o atual como novo, deleta.
function BrandsModal({ open, onClose, brands, activeBrandId, currentBrand, onApply, onSave, onDelete }) {
  useScrollLock(open);
  const [newName, setNewName] = useState('');
  const [confirmDeleteBrandId, setConfirmDeleteBrandId] = useState(null);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth:520 }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--bg-sidebar)', zIndex:1,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Palette size={14} color="var(--text-secondary)"/>
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.022em' }}>Perfis de marca</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{brands.length} {brands.length === 1 ? 'perfil' : 'perfis'} salvos</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="vc-icon-btn">
            <X size={16}/>
          </button>
        </div>

        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
          {/* Salvar marca atual como novo perfil */}
          <div style={{
            background:'rgba(255,77,46,0.06)', border:'1px dashed rgba(255,77,46,0.3)',
            borderRadius:10, padding:12, display:'flex', flexDirection:'column', gap:8,
          }}>
            <div style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', lineHeight:1.45 }}>
              Salvar a marca <b>atual</b> ({currentBrand?.handle || '@perfil'}) como perfil reutilizável:
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { onSave(newName.trim()); setNewName(''); } }}
                placeholder="Ex: Marca Cliente X"
                className="vc-input"
                style={{ flex:1 }}
              />
              <button
                onClick={() => { if (newName.trim()) { onSave(newName.trim()); setNewName(''); } }}
                disabled={!newName.trim()}
                style={{
                  padding:'0 14px', height:38, borderRadius:8, border:'none', cursor:'pointer',
                  background:'var(--accent)', color:'#fff', fontSize:12, fontWeight:700,
                  fontFamily:'var(--font-ui)', opacity: newName.trim() ? 1 : 0.4,
                }}
              >
                Salvar
              </button>
            </div>
          </div>

          {/* Lista de perfis */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {brands.map(b => {
              const on = b.id === activeBrandId;
              return (
                <div
                  key={b.id}
                  style={{
                    background: on ? 'rgba(255,77,46,0.06)' : 'var(--bg-card)',
                    border:`1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius:10, padding:'10px 12px',
                    display:'flex', alignItems:'center', gap:10,
                  }}
                >
                  {/* Swatches */}
                  <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                    {(() => {
                      const sw = hydrateBrandTextColors(b);
                      return [b.bg, b.titleColor, sw.subtitleColor, sw.textColor, b.accent];
                    })().map((c,i)=>(
                      <div key={i} style={{ width:18, height:18, borderRadius:4, background:c, border:'1px solid rgba(255,255,255,0.08)' }}/>
                    ))}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily: effectiveTitleFontFamily(b), letterSpacing:'-0.011em' }}>
                      {b.name || 'Sem nome'}
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.04em' }}>
                      {b.handle}{b.bio ? ` · ${b.bio.slice(0, 50)}${b.bio.length > 50 ? '…' : ''}` : ''}
                    </div>
                  </div>
                  {!on && (
                    <button
                      onClick={() => onApply(b.id)}
                      style={{
                        fontSize:11, padding:'5px 12px', borderRadius:6, cursor:'pointer',
                        background:'var(--bg-elevated)', border:'1px solid var(--border)',
                        color:'var(--text-secondary)', fontWeight:600, fontFamily:'var(--font-ui)',
                      }}
                    >Aplicar</button>
                  )}
                  {on && (
                    <span style={{
                      fontSize:10, padding:'4px 9px', borderRadius:99,
                      background:'rgba(34,197,94,0.10)', color:'#86efac',
                      border:'1px solid rgba(34,197,94,0.3)', fontWeight:700,
                      fontFamily:'var(--font-mono)', letterSpacing:'0.06em',
                    }}>ATIVO</span>
                  )}
                  {brands.length > 1 && b.id !== 'default' && (
                    confirmDeleteBrandId === b.id ? (
                      <>
                        <button
                          onClick={() => { onDelete(b.id); setConfirmDeleteBrandId(null); }}
                          title="Confirmar exclusão"
                          style={{ height:28, padding:'0 8px', borderRadius:5, border:'1px solid rgba(248,113,113,0.5)', background:'rgba(248,113,113,0.15)', color:'#f87171', cursor:'pointer', fontSize:10, fontWeight:700, fontFamily:'var(--font-ui)' }}
                        >OK</button>
                        <button
                          onClick={() => setConfirmDeleteBrandId(null)}
                          title="Cancelar"
                          style={{ width:28, height:28, borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                        ><X size={11}/></button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteBrandId(b.id)}
                        title="Apagar perfil"
                        style={{ width:28, height:28, borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                      >
                        <Trash2 size={11}/>
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-ui)', lineHeight:1.5 }}>
            Aplicar um perfil sobrescreve a marca do carrossel atual com cores, fontes, logo, bio e tom desse perfil. Use em agências/freelance pra alternar entre clientes em segundos.
          </div>
        </div>
      </div>
    </div>
  );
}

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

function getOnboardingSteps(isMobile, empty) {
  let panelSel = '';
  if (!isMobile) panelSel = '[data-vc-tour="sidebar-tabs"]';
  else if (!empty) panelSel = '[data-vc-tour="mobile-bar"]';
  const panelBody = !isMobile
    ? 'Abas Marca, Conteúdo (base para a IA), Cards (texto e imagem em cada card) e IA (refinos e legenda).'
    : empty
      ? 'Depois do primeiro carrossel gerado, uma barra inferior traz Marca, Conteúdo, Cards e IA.'
      : 'Toque nos ícones na barra inferior para abrir o painel de edição.';

  return [
    {
      id: 'welcome',
      title: 'Bem-vindo ao Viral Carrossel',
      body:
        'Em poucos passos você vê o Início (conta local e projetos), onde gerar com IA e como conectar as APIs. Use Avançar ou Pular.',
      selector: null,
    },
    {
      id: 'generate',
      title: 'Gerar com IA',
      body:
        'Defina tema, modo narrativo, direção de imagem e contexto de marca. Um fluxo cria gancho, slides intermediários e legenda.',
      selector: '[data-vc-tour="generate"]',
    },
    {
      id: 'library',
      title: 'Biblioteca',
      body:
        'Vários projetos ficam só no seu navegador. Use o Início para visão geral, ou a biblioteca para filtrar e importar.',
      selector: '[data-vc-tour="library"]',
    },
    {
      id: 'thumbs',
      title: 'Miniaturas',
      body:
        'Clique para escolher o card ativo. Arraste para reordenar a narrativa.',
      selector: '[data-vc-tour="thumbnails"]',
    },
    {
      id: 'panel',
      title: 'Onde editar',
      body: panelBody,
      selector: panelSel || null,
    },
    {
      id: 'settings',
      title: 'Chaves de API',
      body:
        'Conecte Anthropic e/ou OpenAI (texto e imagens HD). Em desenvolvimento local, o servidor pode ler .env.local.',
      selector: '[data-vc-tour="settings"]',
    },
    {
      id: 'refs',
      title: 'Perfis de referência',
      body:
        'No modal Configurar carrossel, logo abaixo dos modos narrativos (pacote Personalizado), escolha uma voz curada para inspirar tom e ritmo — sem copiar conteúdo de terceiros. A legenda sugere boas combinações com cada modo.',
      selector: '[data-vc-tour="ref-profiles"]',
    },
  ];
}

function OnboardingTour({ open, onDismiss, isMobile, empty, setTab, setDrawerOpen, onEnterEditor, onPrepareRefsTourStep }) {
  const steps = useMemo(() => getOnboardingSteps(isMobile, empty), [isMobile, empty]);
  const [idx, setIdx] = useState(0);
  const [hole, setHole] = useState(null);
  const [bubble, setBubble] = useState({ left: 24, top: 80, maxW: 360 });

  useEffect(() => {
    if (open) setIdx(0);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const stepIds = steps[idx]?.id;
    if (stepIds === 'refs') {
      if (typeof onEnterEditor === 'function') onEnterEditor();
      if (typeof onPrepareRefsTourStep === 'function') onPrepareRefsTourStep();
    } else if (stepIds === 'thumbs' || stepIds === 'panel') {
      if (typeof onEnterEditor === 'function') onEnterEditor();
      if (stepIds === 'panel' && isMobile && !empty) setDrawerOpen(true);
    }
    const measure = () => {
      const s = steps[idx];
      if (!s?.selector) {
        setHole(null);
        const maxW = Math.min(380, window.innerWidth - 32);
        setBubble({
          left: (window.innerWidth - maxW) / 2,
          top: Math.max(24, window.innerHeight * 0.2),
          maxW,
        });
        return;
      }
      const el = document.querySelector(s.selector);
      if (!el) {
        setHole(null);
        const maxW = Math.min(380, window.innerWidth - 32);
        setBubble({
          left: (window.innerWidth - maxW) / 2,
          top: Math.max(24, window.innerHeight * 0.22),
          maxW,
        });
        return;
      }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const r = el.getBoundingClientRect();
      setHole({ top: r.top, left: r.left, width: r.width, height: r.height });
      const maxW = Math.min(340, window.innerWidth - 32);
      let left = Math.max(16, Math.min(window.innerWidth - maxW - 16, r.left + r.width / 2 - maxW / 2));
      let top = r.bottom + 14;
      const estCard = 210;
      if (top + estCard > window.innerHeight - 16) top = Math.max(16, r.top - estCard - 12);
      setBubble({ left, top, maxW });
    };

    const delay =
      steps[idx]?.id === 'refs' ? (isMobile ? 380 : 220)
        : (steps[idx]?.id === 'thumbs' || steps[idx]?.id === 'panel') ? (isMobile ? 200 : 120)
          : 0;
    const onWin = () => measure();
    let t = null;
    if (delay) t = window.setTimeout(measure, delay);
    else measure();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      if (t) window.clearTimeout(t);
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open, idx, steps, setTab, setDrawerOpen, isMobile, onEnterEditor, empty, onPrepareRefsTourStep]);

  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onDismiss]);

  if (!open) return null;

  const step = steps[idx];
  const last = idx >= steps.length - 1;

  const advance = () => {
    if (last) onDismiss();
    else setIdx((i) => i + 1);
  };

  const back = () => setIdx((i) => Math.max(0, i - 1));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vc-tour-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        pointerEvents: 'auto',
      }}
    >
      {/* Escurece o fundo; “buraco” no spotlight quando há alvo */}
      {hole ? (
        <div
          style={{
            position: 'fixed',
            left: hole.left - 5,
            top: hole.top - 5,
            width: hole.width + 10,
            height: hole.height + 10,
            borderRadius: 11,
            border: '2px solid var(--accent-focus)',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.48)',
            pointerEvents: 'none',
            zIndex: 121,
          }}
        />
      ) : (
        <div
          onClick={onDismiss}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 121,
          }}
        />
      )}

      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: bubble.left,
          top: bubble.top,
          width: bubble.maxW,
          zIndex: 122,
          background: 'var(--bg-base)',
          border: '1px solid var(--hairline)',
          borderRadius: 18,
          padding: '18px 18px 14px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize:10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginBottom: 8 }}>
          {idx + 1} / {steps.length}
        </div>
        <div id="vc-tour-title" style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.022em', marginBottom: 8, fontFamily: 'var(--font-display)' }}>
          {step.title}
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.47, color: 'var(--text-secondary)', margin: 0, letterSpacing: '-0.011em' }}>
          {step.body}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            className="vc-btn vc-btn-ghost"
            style={{ height: 36, padding: '0 14px', fontSize: 13 }}
            onClick={onDismiss}
          >
            Pular
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="vc-btn vc-btn-ghost"
              style={{ height: 36, padding: '0 14px', fontSize: 13, opacity: idx === 0 ? 0.35 : 1 }}
              disabled={idx === 0}
              onClick={back}
            >
              Voltar
            </button>
            <button type="button" className="vc-btn vc-btn-primary" style={{ height: 36, padding: '0 18px', fontSize: 13 }} onClick={advance}>
              {last ? 'Concluir' : 'Avançar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HelpModal({ open, onClose, onStartTour }) {
  if (!open) return null;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const Mod = isMac ? '⌘' : 'Ctrl';
  const rows = [
    { keys:[Mod,'Z'],          label:'Desfazer última ação' },
    { keys:[Mod,'⇧','Z'],      label:'Refazer' },
    { keys:[Mod,'D'],          label:'Duplicar slide atual' },
    { keys:[Mod,'E'],          label:'Exportar slide atual (PNG)' },
    { keys:[Mod,'S'],          label:'Exportar todos (PNG)' },
    { keys:['←','→'],          label:'Navegar entre slides' },
    { keys:['F'],              label:'Tela cheia (apresentação)' },
    { keys:['Esc'],            label:'Sair da tela cheia' },
    { keys:['N'],              label:'Novo slide' },
    { keys:['Del'],            label:'Apagar slide atual' },
    { keys:['?'],              label:'Abrir esta ajuda' },
  ];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e=>e.stopPropagation()} style={{ maxWidth:440 }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
        }}>
          <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>Atalhos de teclado</div>
          <button onClick={onClose} aria-label="Fechar" className="vc-icon-btn">
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding:'14px 20px 20px', display:'flex', flexDirection:'column', gap:6 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 4px' }}>
              <span style={{ fontSize:13, color:'var(--text-secondary)', fontFamily:'var(--font-ui)' }}>{r.label}</span>
              <div style={{ display:'flex', gap:4 }}>
                {r.keys.map((k, j) => <span key={j} className="kbd">{k}</span>)}
              </div>
            </div>
          ))}
          {typeof onStartTour === 'function' && (
            <button
              type="button"
              className="vc-btn vc-btn-ghost"
              style={{ width: '100%', height: 40, marginTop: 10, fontSize: 14, border: '1px solid var(--hairline)' }}
              onClick={() => onStartTour()}
            >
              Ver tour guiado
            </button>
          )}
          <div style={{ marginTop:12, fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-ui)', lineHeight:1.5, paddingTop:12, borderTop:'1px solid var(--border)' }}>
            Dica: arraste as miniaturas dos slides na barra superior para reordená-los.
            <br/>Seu trabalho é salvo automaticamente no navegador.
          </div>
        </div>
      </div>
    </div>
  );
}
