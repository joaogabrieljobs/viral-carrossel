import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import {
  Sparkles, Search, Download, Trash2, Copy,
  Plus, Palette, Layout, Wand2, Loader2,
  TrendingUp, RefreshCw, X, Upload, Link as LinkIcon,
  FileText, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Type, Quote, BookOpen, Image,
  ArrowUp, ArrowDown, Zap, Flame, Lightbulb,
  ChevronRight, ChevronLeft, Instagram, Settings, Maximize2, Minus,
  Home, Layers, SlidersHorizontal,
} from 'lucide-react';

// ─── STORAGE KEYS ─────────────────────────────────────────────────────────────
// Chaves centralizadas — nunca use string literal de localStorage diretamente.
const SK = {
  library:       'vc_library',
  legacyDoc:     'vc_doc',
  activeDocId:   'vc_active_doc_id',
  brands:        'vc_brands',
  activeBrandId: 'vc_active_brand_id',
  openaiKey:     'vc_openai_key',
  onboarding:    'vc_onboarding_done',
  shellView:     'vc_shell_view',
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
  /* Apple Design System — fonts: SF Pro is system-resolved on Apple devices.
     Inter is loaded as the cross-platform fallback (closest open-source equivalent),
     and JetBrains Mono provides a clean monospace for the rare technical labels. */
  /* Google Fonts injetadas via <link> no useEffect — evita bloqueio de render do @import */

  :root {
    /* — Surfaces (light-first, the Apple default) — */
    --bg-base: #ffffff;
    --bg-parchment: #f5f5f7;
    --bg-pearl: #fafafc;
    --bg-sidebar: #f5f5f7;
    --bg-elevated: #ffffff;
    --bg-card: #ffffff;

    /* — Dark surfaces (used in nav, fullscreen viewer, alternating tiles) — */
    --bg-tile-1: #272729;
    --bg-tile-2: #2a2a2c;
    --bg-tile-3: #252527;
    --bg-black: #000000;

    /* — Hairlines — */
    --border: #e0e0e0;
    --border-muted: #f0f0f0;
    --hairline: #e0e0e0;
    --divider-soft: rgba(0,0,0,0.04);
    --border-on-dark: rgba(255,255,255,0.10);

    /* — Text — */
    --text-primary: #1d1d1f;       /* Ink */
    --text-secondary: #333333;     /* Ink Muted 80 */
    --text-muted: #7a7a7a;         /* Ink Muted 48 — disabled, fine print */
    --text-on-dark: #ffffff;
    --text-on-dark-muted: #cccccc;

    /* — Accent (the only chromatic color in the system) — */
    --accent: #0066cc;             /* Action Blue */
    --accent-hover: #0071e3;       /* Slightly brighter on press/focus */
    --accent-focus: #0071e3;       /* Focus ring */
    --accent-on-dark: #2997ff;     /* Sky Link Blue (dark surfaces only) */
    --accent-glow: rgba(0, 102, 204, 0.14);

    /* — Status — */
    --success: #34c759;            /* Apple system green */
    --danger:  #ff3b30;            /* Apple system red */
    --warning: #ff9500;            /* Apple system orange */

    /* — Typography — */
    --font-ui: 'SF Pro Text', 'SF Pro Display', -apple-system, BlinkMacSystemFont, system-ui, 'Inter', 'Segoe UI', Helvetica, Arial, sans-serif;
    --font-display: 'SF Pro Display', -apple-system, BlinkMacSystemFont, system-ui, 'Inter', sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
    --font-serif: 'SF Pro Display', -apple-system, system-ui, serif;

    /* — Motion — */
    --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
    --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

    /* — Single product-shadow, reserved for product imagery only — */
    --shadow-product: 0 5px 30px rgba(0, 0, 0, 0.22);
  }

  * { box-sizing: border-box; }

  body {
    background: var(--bg-base); color: var(--text-primary);
    font-family: var(--font-ui);
    font-size: 17px;
    line-height: 1.47;
    letter-spacing: -0.011em;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: 'ss03', 'cv01';
    overscroll-behavior-x: none;
    padding-top: env(safe-area-inset-top, 0);
  }

  :root {
    --safe-top:    env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-left:   env(safe-area-inset-left, 0px);
    --safe-right:  env(safe-area-inset-right, 0px);
  }

  /* Display headlines: tight, weight 600 (the "Apple tight" cadence) */
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
    input[type="range"] { height: 22px; }
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

  /* — Buttons (Apple grammar: pill primary + sm utility) — */
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

  /* Primary blue pill — the signature Apple action */
  .vc-btn-primary {
    background: var(--accent); color: #fff;
    padding: 0 22px; height: 38px; font-size: 14px; font-weight: 400;
  }
  .vc-btn-primary:hover { background: var(--accent-hover); }

  /* Ghost capsule — pearl fill, soft ring */
  .vc-btn-ghost {
    background: var(--bg-pearl); color: var(--text-secondary);
    border: 1px solid var(--divider-soft);
    padding: 0 16px; height: 34px; font-size: 13px; font-weight: 400;
    border-radius: 11px;
  }
  .vc-btn-ghost:hover { color: var(--text-primary); background: #f0f0f3; }

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
  .vc-input:focus { border-color: var(--accent-focus); box-shadow: 0 0 0 3px rgba(0,113,227,0.18); }
  @media (max-width: 767px) {
    .vc-input { font-size: 16px; padding: 12px 18px; }
  }

  .vc-textarea {
    resize: none; line-height: 1.47;
    border-radius: 11px;
    padding: 12px 16px;
  }

  /* Section labels — quiet, near-black, tight tracking. No more all-caps mono noise. */
  .section-label {
    font-size: 12px; letter-spacing: -0.01em; text-transform: none;
    color: var(--text-muted); font-weight: 600; font-family: var(--font-ui);
    display: flex; align-items: center; gap: 8px;
  }
  .section-label::before {
    content: ''; display: block; width: 14px; height: 1px; background: var(--hairline);
    flex-shrink: 0;
  }

  /* Tab bar — Apple sub-nav grammar (no all-caps, blue underline) */
  .tab-bar-item {
    flex: 1; padding: 12px 0; font-size: 13px; font-weight: 400;
    letter-spacing: -0.016em; text-transform: none;
    font-family: var(--font-ui); cursor: pointer; border: none;
    background: transparent; display: flex; align-items: center;
    justify-content: center; gap: 6px; position: relative;
    transition: color 0.15s; outline: none; color: var(--text-muted);
  }
  .tab-bar-item.active { color: var(--text-primary); font-weight: 600; }
  .tab-bar-item.active::after {
    content: ''; position: absolute; bottom: 0; left: 14px; right: 14px;
    height: 2px; background: var(--accent); border-radius: 99px;
  }
  .tab-bar-item:hover:not(.active) { color: var(--text-secondary); }

  /* Slide thumbs — the only place we use the focus blue ring */
  .slide-thumb {
    position: relative; overflow: hidden; border-radius: 8px;
    transition: opacity 0.15s var(--ease-smooth), box-shadow 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth);
    cursor: pointer; flex-shrink: 0;
  }
  .slide-thumb.active { box-shadow: 0 0 0 2px var(--accent-focus); }
  .slide-thumb:not(.active) { opacity: 0.5; }
  .slide-thumb:not(.active):hover { opacity: 0.9; }
  .slide-thumb:active { transform: scale(0.95); }

  .palette-swatch { transition: transform 0.1s var(--ease-smooth); border-radius: 8px; }
  .palette-swatch:hover { transform: scale(1.04); }
  .palette-swatch:active { transform: scale(0.95); }

  /* Cards — utility chassis: hairline border, 18px radius, no shadow */
  .idea-card {
    background: var(--bg-base); border: 1px solid var(--hairline);
    border-radius: 18px; padding: 16px; text-align: left; cursor: pointer;
    transition: border-color 0.15s, background-color 0.15s, transform 0.1s var(--ease-smooth);
    display: block; width: 100%;
    color: var(--text-primary);
  }
  .idea-card:hover { border-color: var(--accent); background: var(--bg-pearl); }
  .idea-card:active { transform: scale(0.98); }

  .hook-row {
    display: flex; align-items: flex-start; gap: 12px;
    background: var(--bg-pearl); border: 1px solid var(--hairline);
    border-radius: 11px; padding: 12px 14px;
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

  /* Floating sticky bar — Apple's frosted parchment grammar */
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
  }
  @media (min-width: 640px) {
    .modal-overlay { align-items: center; padding: 16px; }
  }
  .modal-panel {
    background: var(--bg-base); border-top: 1px solid var(--hairline);
    width: 100%; max-height: calc(100vh - var(--safe-top));
    overflow-y: auto; -webkit-overflow-scrolling: touch;
    animation: slideUp 0.2s var(--ease-smooth);
    border-top-left-radius: 18px; border-top-right-radius: 18px;
    padding-bottom: calc(var(--safe-bottom) + 8px);
    color: var(--text-primary);
  }
  @media (min-width: 640px) {
    .modal-panel {
      border: 1px solid var(--hairline); border-radius: 18px;
      max-width: 480px; max-height: 90vh;
      padding-bottom: 0;
      animation: modalIn 0.2s var(--ease-smooth);
    }
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
  .toast-item.toast-success{ background: rgba(52, 199, 89, 0.92);   color: #ffffff; border-color: transparent; }
  .toast-item.toast-info   { background: rgba(245, 245, 247, 0.92); color: var(--text-primary); }
  .toast-item button {
    background: none; border: none; cursor: pointer; color: inherit;
    opacity: 0.7; padding: 2px; flex-shrink: 0;
  }
  .toast-item button:hover { opacity: 1; }

  .kbd {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 20px; height: 20px; padding: 0 6px;
    border-radius: 5px; background: var(--bg-pearl);
    border: 1px solid var(--hairline); color: var(--text-secondary);
    font-family: var(--font-mono); font-size: 11px; font-weight: 500;
  }

  /* — Apple form-label grammar: SF Pro tight, NO uppercase, NO mono — */
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

  /* Focus-visible: Apple's keyboard focus signal — used everywhere a button doesn't override */
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
`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const FORMATS = {
  carrossel: { w: 1080, h: 1350, label: 'Feed 4:5' },
  quadrado:  { w: 1080, h: 1080, label: 'Quadrado' },
  stories:   { w: 1080, h: 1920, label: 'Stories'  },
};

const PALETTES = [
  { name:'Carbon',   bg:'#0a0a0a', title:'#ffffff', sub:'#a3a3a3', accent:'#ff5736' },
  { name:'Midnight', bg:'#0c1220', title:'#ffffff', sub:'#94a3b8', accent:'#6366f1' },
  { name:'Ivory',    bg:'#f5f1ea', title:'#0a0a0a', sub:'#52525b', accent:'#dc2626' },
  { name:'Forest',   bg:'#0d1f17', title:'#a3e635', sub:'#86efac', accent:'#a3e635' },
  { name:'Coral',    bg:'#1c0f0f', title:'#ff6b4a', sub:'#fbbf24', accent:'#ff6b4a' },
  { name:'Royal',    bg:'#1e1b4b', title:'#fde047', sub:'#a5b4fc', accent:'#fde047' },
  { name:'Mono',     bg:'#171717', title:'#fafafa', sub:'#737373', accent:'#ffffff' },
  { name:'Cream',    bg:'#fef9e7', title:'#1a1a1a', sub:'#78716c', accent:'#b45309' },
  /* Neutro institucional — alinhado ao DEFAULT_BRAND e ao token --accent; índice fixo no final pra não quebrar templates (palette: 0–7). */
  { name:'Pearl',    bg:'#fafafc', title:'#1d1d1f', sub:'#515154', accent:'#0066cc' },
];

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

const LAYOUTS = [
  { id:'tl', jc:'flex-start', ai:'flex-start', label:'↖' },
  { id:'tc', jc:'flex-start', ai:'center',     label:'↑' },
  { id:'tr', jc:'flex-start', ai:'flex-end',   label:'↗' },
  { id:'ml', jc:'center',     ai:'flex-start', label:'←' },
  { id:'mc', jc:'center',     ai:'center',     label:'⊕' },
  { id:'mr', jc:'center',     ai:'flex-end',   label:'→' },
  { id:'bl', jc:'flex-end',   ai:'flex-start', label:'↙' },
  { id:'bc', jc:'flex-end',   ai:'center',     label:'↓' },
  { id:'br', jc:'flex-end',   ai:'flex-end',   label:'↘' },
];

// ─── MODOS DE GERAÇÃO ─────────────────────────────────────────────────────────
// Cada modo substitui a seção MÉTODO no prompt. Todos devem escalar ao número
// de slides pedido (hook → meio(s) → fecho), sem assumir sempre 5 slides no miolo.
const GEN_MODES = [
  {
    id: 'editorial',
    icon: '📰',
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
    icon: '🔬',
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
    icon: '💔',
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
    icon: '🚀',
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
    icon: '📖',
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
    icon: '🎓',
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
    icon: '🗞',
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
    icon: '📣',
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
          window.dispatchEvent(new CustomEvent('vc:quota-warning', {
            detail: 'Limite de armazenamento quase atingido. Imagens de fundo foram omitidas do cache. Exporte seus projetos como JSON para não perder dados.',
          }));
          return true;
        }
      } catch { /* fallback falhou também */ }
      window.dispatchEvent(new CustomEvent('vc:quota-exceeded', {
        detail: 'Limite de armazenamento do browser atingido. Exporte seus projetos como JSON antes que dados sejam perdidos.',
      }));
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

// Hook: state que sincroniza com localStorage (debounced)
function usePersistedState(key, initial) {
  const [val, setVal] = React.useState(() => lsGet(key, initial));
  const tRef = React.useRef(null);
  React.useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => lsSet(key, val), 300);
    return () => { if (tRef.current) clearTimeout(tRef.current); };
  }, [key, val]);
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
  // Versão incremental: muda sempre que o histórico muda → permite derivar canUndo/canRedo reativos
  const [histVer, setHistVer] = React.useState(0);
  const bumpHist = React.useCallback(() => setHistVer(v => v + 1), []);

  const push = React.useCallback((updater) => {
    setStateInternal((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next === prev) return prev;
      if (skipNext.current) { skipNext.current = false; return next; }
      const now = Date.now();
      const coalesce = (now - lastPushAt.current) < coalesceMs;
      lastPushAt.current = now;
      if (!coalesce) {
        past.current.push(prev);
        if (past.current.length > limit) past.current.shift();
        future.current = [];
        // Agenda bump fora do setState (não pode chamar setHistVer dentro de outro setState)
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
      if (!past.current.length) return prev;
      const previous = past.current.pop();
      future.current.push(prev);
      Promise.resolve().then(bumpHist);
      return previous;
    });
  }, [bumpHist]);

  const redo = React.useCallback(() => {
    setStateInternal((prev) => {
      if (!future.current.length) return prev;
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

const mkSlide = (n = 1) => ({
  id: uid(), num: n,
  title: 'Seu título aqui',
  subtitle: 'Subtítulo descritivo que reforça o gancho principal do carrossel.',
  layout: 'mc', align: 'center',
  bgImage: null, imageQuery: '',
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
  overlay: 60, titleSize: 100, subSize: 100,
  customBg: null, showHandle: true,
  // text-on-image controls
  textShadow: true,   // drop shadow behind title/subtitle
  textBg: false,      // pill/box background behind text block
  textBgOpacity: 55,  // opacity of that box (0-100)
  textInset: 7,       // padding multiplier — how far from edges (1-20)
  // typography controls (overrides do brand quando definidos por slide)
  titleTracking: 0,   // letter-spacing extra do título em em*0.01 (-10..30 → -0.10em..+0.30em)
  subTracking: 0,     // letter-spacing extra do subtítulo
  titleLeading: 105,  // line-height do título em % (default 105 = 1.05)
  subLeading: 150,    // line-height do subtítulo (default 150 = 1.50)
  titleCase: 'normal',// 'normal' | 'upper' | 'lower' (text-transform)
  titleWeight: 800,   // 400..900
});

const isDefault = (slides) =>
  Array.isArray(slides) &&
  slides.length === 1 &&
  slides[0]?.title === 'Seu título aqui';

const extractJSON = (raw) => {
  if (!raw) throw new Error('IA retornou resposta vazia. Tente novamente.');
  let s = raw.replace(/```(?:json)?\s*/gi,'').replace(/```/g,'').trim();
  try { return JSON.parse(s); } catch {}
  let depth=0, start=-1, inStr=false, esc=false;
  for (let i=0; i<s.length; i++) {
    const c=s[i];
    if(esc){esc=false;continue;}
    if(c==='\\'){esc=true;continue;}
    if(c==='"'){inStr=!inStr;continue;}
    if(inStr)continue;
    if(c==='{'){if(depth===0)start=i;depth++;}
    else if(c==='}'){
      depth--;
      if(depth===0&&start>=0){
        try{return JSON.parse(s.slice(start,i+1));}catch{}
      }
    }
  }
  throw new Error('Formato de resposta inválido. Tente novamente.');
};

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
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(m)) {
    const hosted = typeof window !== 'undefined' && !IS_LOCAL_DEV;
    const preview =
      typeof window !== 'undefined' &&
      /^(localhost|127\.|\[::1\])/.test(window.location.hostname) &&
      (window.location.port === '4173' || window.location.port === '4174');
    let hint =
      'Mantenha `npm run dev` ativo e `.env.local` com ANTHROPIC_API_KEY ou OPENAI_API_KEY (o proxy /api só existe no dev server).';
    if (preview) {
      hint =
        '`npm run preview` não inclui o proxy /api — use `npm run dev` para IA ou gere só no ambiente de desenvolvimento.';
    } else if (hosted) {
      const proxyHint =
        typeof import.meta !== 'undefined' && import.meta.env?.VITE_ANTHROPIC_PROXY === 'true'
          ? ' Confirme ANTHROPIC_API_KEY nas variáveis do Netlify e que o deploy inclui a função netlify/functions/anthropic-proxy.'
          : ' Num deploy estático, use o proxy incluído (Netlify + VITE_ANTHROPIC_PROXY) ou a chave OpenAI em ⚙, ou sirva em localhost com `npm run dev`.';
      hint =
        `Num site hospedado o browser não pode chamar api.anthropic.com direto por CORS.${proxyHint}`;
    }
    return new Error(`${label}: falha de rede (${m}). ${hint}`);
  }
  return err instanceof Error ? err : new Error(m);
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

// Backend Anthropic (Claude)
const callAnthropic = async (userMsg, { json = false, maxTokens = 4096, tools = null } = {}) => {
  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: userMsg }],
  };
  if (tools) body.tools = tools;
  let res;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      { role: 'system', content: 'Você é um copywriter sênior brasileiro especializado em conteúdo estratégico para Instagram. Responda APENAS o que foi pedido, sem texto extra, sem markdown explicativo.' },
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
const callAI = async (userMsg, { json = false, maxTokens = 4096, openaiKey = null } = {}) => {
  const status = await getServerStatus();
  const openaiAvailable = !!openaiKey || (IS_LOCAL_DEV && status.openai);
  // Tenta Anthropic se servidor tem chave (ou se estamos no Claude artifact, onde IS_LOCAL_DEV=false)
  if (status.anthropic) {
    try {
      return await callAnthropic(userMsg, { json, maxTokens });
    } catch (e) {
      if (openaiAvailable) {
        return await callOpenAIChat(userMsg, { json, maxTokens, key: openaiKey });
      }
      throw e;
    }
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

// Carrega jsPDF on-demand (UMD) — só baixa quando o usuário pedir export PDF
const loadJsPdf = () => new Promise((res, rej) => {
  if (window.jspdf?.jsPDF) return res(window.jspdf.jsPDF);
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
  s.onload = () => res(window.jspdf?.jsPDF);
  s.onerror = () => rej(new Error('jsPDF load failed'));
  document.head.appendChild(s);
});

/** Descarga um Blob com nome — evita data URLs gigantes (limite em alguns browsers) e falhas silenciosas. */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 400);
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
  downloadBlob(blob, filename);
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

// ─── SLIDE CARD ───────────────────────────────────────────────────────────────

const SlideCardInner = React.forwardRef(({ slide, fmt, brand, num, total, scale=1, presentationImgFilter }, ref) => {
  const f = FORMATS[fmt] || FORMATS.carrossel;
  const L = LAYOUTS.find(l=>l.id===slide.layout)||LAYOUTS[4];
  const bg = slide.customBg || brand.bg;
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

  const inner = (
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
          background:`linear-gradient(175deg, rgba(0,0,0,${slide.overlay/100*0.4}) 0%, rgba(0,0,0,${slide.overlay/100}) 100%)`,
        }}/>
      )}

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

      {/* Handle badge */}
      {brand.showHandle && slide.showHandle && (
        <div style={{
          position:'absolute', top:f.h*0.038, left:f.w*0.05,
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
                  style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
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
        const inset = (slide.textInset ?? 7);
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
              <h1 style={{
                color:brand.titleColor, fontFamily: titleFF,
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
              }}>{slide.title}</h1>
              {slide.subtitle && (
                <p style={{
                  color:brand.subColor, fontFamily: bodyFF,
                  fontSize:f.w*0.028*(slide.subSize/100),
                  lineHeight:(slide.subLeading ?? 150)/100,
                  fontWeight:400, margin:0,
                  letterSpacing:`${(-1 + (slide.subTracking ?? 0)) / 100}em`,
                  textShadow: shadow,
                }}>{slide.subtitle}</p>
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

  return (
    <div style={{
      width:f.w*scale, height:f.h*scale,
      position:'relative', overflow:'hidden',
      borderRadius: scale < 0.9 ? 10 : 0,
      flexShrink:0, background:bg,
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
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <span style={{ fontSize:13, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', fontWeight:400, letterSpacing:'-0.011em' }}>{label}</span>
        <span style={{ fontSize:13, color:'var(--text-primary)', fontFamily:'var(--font-ui)', fontWeight:600, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.011em' }}>{value}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e=>onChange(+e.target.value)}
        style={{ '--pct': `${pct}%` }}
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
const ColorRow = ({ label, value, onChange }) => (
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
                background: on ? 'rgba(0,102,204,0.08)' : 'var(--bg-card)',
                transition:'all 0.12s',
                display:'flex', flexDirection:'column', gap:3, minHeight:60,
              }}
              title={m.desc}
            >
              <div style={{
                fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)',
                color: on ? 'var(--accent)' : 'var(--text-primary)',
                letterSpacing:'-0.011em',
                display:'flex', alignItems:'center', gap:6,
              }}>
                <span aria-hidden style={{ fontSize:14 }}>{m.icon}</span>
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
      }}>
        <span style={{ color:'var(--text-secondary)', fontWeight:600 }}>{active.icon} {active.label}: </span>
        {active.desc}.
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
  { key:'fidelity',    icon:'🎯', label:'Fidelidade ao tema', left:'Metafórico', right:'Literal',     hint:'Quão direto a imagem retrata o assunto' },
  { key:'creativity',  icon:'✦',  label:'Criatividade',       left:'Convencional', right:'Inusitado',  hint:'Composições clássicas vs inesperadas' },
  { key:'irreverence', icon:'😏', label:'Irreverência',       left:'Sério',     right:'Cheeky',        hint:'Tom contemplativo vs bem-humorado' },
  { key:'objectivity', icon:'📷', label:'Objetividade',       left:'Atmosférico', right:'Documental',  hint:'Atmosfera/emoção vs ação/fato' },
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
                  letterSpacing:'-0.011em', display:'flex', alignItems:'center', gap:6,
                }}>
                  <span aria-hidden style={{ fontSize:13 }}>{axis.icon}</span>
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
// Drawer bottom-sheet com swipe-to-dismiss, backdrop e safe-area iOS.
// Detecta arrasto vertical pra baixo (>80px ou vel > 0.4 px/ms) → fecha.
function MobileDrawer({ open, onClose, children }) {
  // ── drag via ref direto no DOM para eliminar o lag do setState async ──────
  const panelRef  = useRef(null);
  const startRef  = useRef({ y:0, t:0 });
  const dragging  = useRef(false);

  // Aplica o offset de drag diretamente no elemento (sem re-render React)
  const applyDrag = useCallback((dy) => {
    if (!panelRef.current) return;
    panelRef.current.style.transition = dy > 0 ? 'none' : 'transform 0.3s var(--ease-smooth)';
    panelRef.current.style.transform  = open ? `translateY(${dy}px)` : 'translateY(110%)';
  }, [open]);

  // Bloqueia scroll do body quando aberto, evita "double-scroll" no iOS
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Reseta qualquer drag residual ao fechar
    applyDrag(0);
    return () => { document.body.style.overflow = prev; };
  }, [open, applyDrag]);

  const onTouchStart = (e) => {
    // Só reage a arrasto iniciado no handle/header (não no scroll do conteúdo)
    if (!e.target.closest('[data-drawer-handle]')) return;
    dragging.current = true;
    startRef.current = { y: e.touches[0].clientY, t: Date.now() };
    applyDrag(0);
  };
  const onTouchMove = (e) => {
    if (!dragging.current) return;
    const dy = e.touches[0].clientY - startRef.current.y;
    if (dy < 0) return; // ignora arrasto pra cima
    applyDrag(dy);
  };
  const onTouchEnd = (e) => {
    if (!dragging.current) return;
    const dy = e.changedTouches[0].clientY - startRef.current.y;
    const dt = Math.max(1, Date.now() - startRef.current.t);
    const velocity = dy / dt; // px/ms
    dragging.current = false;
    applyDrag(0);
    if (dy > 80 || velocity > 0.4) onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
            backdropFilter:'blur(4px)', zIndex:30, animation:'fadeIn 0.18s',
          }}
        />
      )}
      {/* Painel — transform/transition controlados via ref (applyDrag) para zero lag */}
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
          maxHeight:'88vh',
          boxShadow:'0 -8px 40px rgba(0,0,0,0.6)',
          transform: open ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 0.3s var(--ease-smooth)',
          paddingBottom:'env(safe-area-inset-bottom, 0)',
        }}
      >
        {/* Handle tactível pra arrastar/fechar */}
        <div
          data-drawer-handle
          style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'10px 16px 4px', flexShrink:0,
            cursor:'grab', userSelect:'none', touchAction:'none',
          }}
        >
          <div style={{ width:40, height:4, background:'var(--border)', borderRadius:99, margin:'0 auto' }}/>
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

// ─── TOAST STACK ──────────────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast-item toast-${t.kind}`}>
          <span style={{ flex:1 }}>{t.message}</span>
          <button onClick={()=>onDismiss(t.id)} aria-label="Fechar notificação">
            <X size={12}/>
          </button>
        </div>
      ))}
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
          <button onClick={onClose} aria-label="Fechar" style={{ color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', padding:4 }}>
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

// ─── REFINE BUTTON ────────────────────────────────────────────────────────────

function RefineBtn({ onRefine, busy }) {
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState('');
  const presets = ['Mais direto','Mais curto','Adicione número','Tom técnico','Tom casual','Mais polêmico','Storytelling'];

  if (!open) return (
    <button onClick={()=>setOpen(true)} className="vc-btn vc-btn-ghost" style={{ width:'100%', height:36 }}>
      <Wand2 size={12}/>
      <span>Refinar com IA</span>
    </button>
  );

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

function KeysModal({ open, onClose, openaiKey, onSave, onRefreshStatus }) {
  const [val, setVal] = useState(openaiKey || '');
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (open) {
      setVal(openaiKey || '');
      // Força refetch — se o user editou .env.local e reiniciou o vite,
      // queremos refletir isso imediatamente.
      getServerStatus({ force: true }).then(s => {
        setStatus(s);
        onRefreshStatus?.(s);
      });
    }
  }, [open, openaiKey, onRefreshStatus]);
  if (!open) return null;
  const save = () => {
    onSave(val.trim());
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
          <button onClick={onClose} style={{ color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', padding:4, borderRadius:6 }}>
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:18 }}>
          {/* Status dos providers (modo dev local) */}
          {status?.dev && (
            <div style={{
              background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, padding:12,
              display:'flex', flexDirection:'column', gap:8,
            }}>
              <div className="vc-label" style={{ marginBottom:0 }}>
                Status do servidor (modo dev)
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:13 }}>
                <span style={{ color:'var(--text-secondary)', fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>Anthropic (Claude · web search)</span>
                <span style={{
                  fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:9999,
                  background: status.anthropic ? 'rgba(52,199,89,0.14)' : 'rgba(255,59,48,0.10)',
                  color:    status.anthropic ? '#1d8a3a'              : '#c5251c',
                  letterSpacing:'-0.011em',
                }}>{status.anthropic ? 'Conectada' : 'Não configurada'}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:13 }}>
                <span style={{ color:'var(--text-secondary)', fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>OpenAI (gpt-4o · GPT Image 2)</span>
                <span style={{
                  fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:9999,
                  background: (val || status.openai) ? 'rgba(52,199,89,0.14)' : 'rgba(255,59,48,0.10)',
                  color:    (val || status.openai) ? '#1d8a3a'              : '#c5251c',
                  letterSpacing:'-0.011em',
                }}>{val ? 'Via navegador' : status.openai ? 'Via .env' : 'Não configurada'}</span>
              </div>
              {!status.anthropic && !val && !status.openai && (
                <div style={{
                  marginTop:4, fontSize:11, color:'#fcd34d',
                  background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)',
                  borderRadius:6, padding:'8px 10px', fontFamily:'var(--font-ui)', lineHeight:1.5,
                }}>
                  Configure ao menos a chave OpenAI abaixo para gerar carrosséis. Sem chave nenhuma, a IA não funciona.
                </div>
              )}
              {!status.anthropic && (
                <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-ui)', lineHeight:1.5 }}>
                  Para ativar Claude + pesquisa web: crie <code style={{ color:'var(--text-secondary)', fontFamily:'var(--font-mono)' }}>.env.local</code> na raiz com <code style={{ color:'var(--text-secondary)', fontFamily:'var(--font-mono)' }}>ANTHROPIC_API_KEY=sk-ant-...</code> e reinicie o <code style={{ color:'var(--text-secondary)', fontFamily:'var(--font-mono)' }}>npm run dev</code>.
                </div>
              )}
            </div>
          )}

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
              <span style={{ color:'var(--accent)', fontFamily:'var(--font-mono)' }}>platform.openai.com/api-keys</span>
              . A chave fica salva apenas no seu navegador (localStorage).
              {status?.dev && !status.anthropic && (
                <> Como Anthropic não está configurada, esta chave será usada também para a geração de texto via gpt-4o.</>
              )}
            </div>
          </div>
          {val && val.startsWith('sk-') && (
            <div style={{
              fontSize:13, color:'#1d8a3a', background:'rgba(52,199,89,0.10)',
              border:'1px solid rgba(52,199,89,0.22)', borderRadius:11, padding:'10px 12px', letterSpacing:'-0.011em',
              fontFamily:'var(--font-mono)',
            }}>
              ✓ Chave detectada — GPT Image 2{status?.dev && !status.anthropic ? ' + gpt-4o (texto)' : ''} disponíveis.
            </div>
          )}
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
}) {
  const [topic, setTopic] = useState(defaultTopic);
  const [count, setCount] = useState(6);
  const [niche, setNiche] = useState(defaultNiche);
  const [tone, setTone] = useState(defaultTone || 'direto e provocativo');
  const [audience, setAudience] = useState(defaultAudience || '');
  const [mode, setMode] = useState(defaultMode);
  const [packCreative, setPackCreative] = useState(defaultCreativePreset || 'livre');
  useEffect(() => { if (open) setMode(defaultMode); }, [open, defaultMode]);
  useEffect(() => { if (open) setPackCreative(defaultCreativePreset || 'livre'); }, [open, defaultCreativePreset]);
  // Cópia local mutável dos eixos da imagem (commit no doc só ao gerar)
  const [params, setParams] = useState(imgParams);
  useEffect(() => { if (open) setParams(imgParams); }, [open, imgParams]);
  const setAxis = (key, val) => setParams(p => ({ ...p, [key]: val }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [autoFetchSlideImages, setAutoFetchSlideImages] = useState(true);
  useEffect(() => {
    if (open) setAutoFetchSlideImages(true);
  }, [open]);

  useEffect(()=>{ if(open){ setErr(''); if(defaultTopic) setTopic(defaultTopic); } },[open,defaultTopic]);
  useEffect(()=>{ if(defaultNiche) setNiche(defaultNiche); },[defaultNiche]);
  useEffect(()=>{ if(defaultTone) setTone(defaultTone); },[defaultTone]);
  useEffect(()=>{ if(defaultAudience) setAudience(defaultAudience); },[defaultAudience]);

  const hasMaterialPack =
    Array.isArray(materialSummary) && materialSummary.length > 0;
  const hasContextPack =
    (Array.isArray(brandSummary) && brandSummary.length > 0) ||
    hasMaterialPack;
  /** Tema digitado OU nicho OU Marca/Material preenchidos — evita botão morto só com contexto injetado. */
  const resolvedGenerationTopic = (() => {
    const t = topic.trim();
    if (t) return t;
    if (niche.trim()) return `Conteúdo focado no nicho: ${niche.trim()}`;
    if (hasContextPack) return 'Conteúdo baseado no material de referência e na identidade da marca.';
    return '';
  })();

  if (!open) return null;

  const run = async () => {
    if (!resolvedGenerationTopic) {
      setErr('Informe o tema em “Sobre o que é o conteúdo?”, ou o nicho, ou preencha Marca e Conteúdo.');
      return;
    }
    setBusy(true); setErr('');
    try {
      // Persiste direção de imagem, modo e pacote criativo antes de gerar
      onImgParamsChange?.(params);
      onModeChange?.(mode);
      onCreativePresetChange?.(packCreative);
      await onGenerate({
        topic: resolvedGenerationTopic,
        count,
        niche,
        tone,
        audience,
        imgMode: 'dalle',
        imgParams: params,
        mode,
        creativePreset: packCreative,
        fetchImagesNow: autoFetchSlideImages,
      });
      onClose();
    } catch(e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const tones = ['direto e provocativo','educativo e calmo','autoridade técnica','storytelling','irreverente'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e=>e.stopPropagation()}>
        {/* Header */}
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
              <Sparkles size={14} color="#fff"/>
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>Configurar carrossel</div>
              <div className="vc-eyebrow">Geração com IA</div>
            </div>
          </div>
          <button onClick={onClose} style={{ color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', padding:4, borderRadius:6, transition:'color 0.12s' }}
            onMouseEnter={e=>e.currentTarget.style.color='var(--text-primary)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}
          ><X size={16}/></button>
        </div>

        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:18 }}>
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
                onClick={() => {
                  onGoToMaterial();
                  onClose();
                }}
                style={{
                  alignSelf:'flex-start',
                  minHeight:44,
                  padding:'0 20px',
                  borderRadius:9999,
                  border:'none',
                  background:'var(--accent)',
                  color:'#fff',
                  fontSize:13,
                  fontWeight:600,
                  fontFamily:'var(--font-ui)',
                  letterSpacing:'-0.011em',
                  cursor:'pointer',
                  transition:'transform 0.1s var(--ease-smooth)',
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
                      background: on ? 'rgba(0,102,204,0.06)' : 'var(--bg-card)',
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
            <label className="vc-label">
              Sobre o que é o conteúdo?
            </label>
            <textarea
              value={topic} onChange={e=>setTopic(e.target.value)} rows={3}
              placeholder="Ex: como freelancers usam IA para triplicar a produtividade sem estresse"
              className="vc-input vc-textarea"
            />
            {hasContextPack && (
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6, lineHeight:1.47, letterSpacing:'-0.011em' }}>
                Opcional se já houver Marca e Conteúdo: você pode gerar só com esse contexto, ou preencher o nicho abaixo no lugar do tema.
              </div>
            )}
          </div>

          {/* Modo narrativo — escolha da camada estratégica */}
          <ModePicker value={mode} onChange={setMode}/>
          <div
            aria-live="polite"
            style={{
              fontSize:11,
              color:'var(--text-muted)',
              lineHeight:1.47,
              letterSpacing:'-0.011em',
              padding:'8px 10px',
              background:'var(--bg-pearl)',
              borderRadius:11,
              border:'1px solid var(--hairline)',
            }}
          >
            <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>Será aplicado ao gerar:</span>{' '}
            <span>{GEN_MODE_BY_ID[mode]?.icon} {GEN_MODE_BY_ID[mode]?.label}</span>
            {' · '}
            <span>{CREATIVE_PRESET_BY_ID[packCreative]?.label}</span>
          </div>

          {/* Niche + Audience */}
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

          {/* Tone */}
          <div>
            <label className="vc-label">Tom de voz</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {tones.map(t=>(
                <button key={t} onClick={()=>setTone(t)} style={{
                  fontSize:11, padding:'5px 12px', borderRadius:99, cursor:'pointer',
                  fontFamily:'var(--font-ui)', fontWeight:500, transition:'all 0.12s',
                  background: tone===t ? 'var(--accent)' : 'var(--bg-card)',
                  border: `1px solid ${tone===t ? 'var(--accent)' : 'var(--border)'}`,
                  color: tone===t ? '#fff' : 'var(--text-secondary)',
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Slide count */}
          <div>
            <label className="vc-label">Número de Cards</label>
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

          {/* Imagens — só GPT Image (busca stock tipo “Web trend” desativada até novo método). */}
          <div>
            <label className="vc-label">Imagens dos Cards</label>
            {hasOpenAI ? (
              <div style={{
                padding:'10px 12px', borderRadius:11, border:'1.5px solid var(--accent)',
                background:'rgba(0,113,227,0.08)', position:'relative',
              }}>
                <span style={{
                  position:'absolute', top:-9, right:8, fontSize:11, fontWeight:600,
                  background:'var(--accent)', color:'#fff', padding:'2px 9px', borderRadius:9999,
                  letterSpacing:'-0.011em',
                }}>Ativo</span>
                <div style={{ fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)', color:'var(--accent)', marginBottom:3, letterSpacing:'-0.011em' }}>
                  ⬡ GPT Image 2
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
                A geração automática de fundos usa <b>GPT Image 2</b>. Sem chave OpenAI, o carrossel sai com texto e palavras-chave de imagem; depois use Upload ou URL em cada card.
              </div>
            )}
            {!hasOpenAI && (
              <div style={{
                marginTop:8, fontSize:13, color:'var(--text-secondary)', background:'rgba(0,113,227,0.06)',
                border:'1px solid rgba(0,113,227,0.18)', borderRadius:11, padding:'10px 12px',
                fontFamily:'var(--font-ui)', letterSpacing:'-0.011em', lineHeight:1.47,
                display:'flex', flexDirection:'column', gap:8,
              }}>
                <div>
                  💡 Para liberar <b>GPT Image 2</b> (modelo flagship da OpenAI lançado em abril/2026 — foto-realismo de verdade) cole sua chave OpenAI agora.
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
            <label
              style={{
                marginTop: 10,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                cursor: 'pointer',
                padding: '10px 12px',
                borderRadius: 11,
                border: '1px solid var(--hairline)',
                background: 'var(--bg-pearl)',
                boxSizing: 'border-box',
              }}
            >
              <input
                type="checkbox"
                checked={autoFetchSlideImages}
                onChange={(e) => setAutoFetchSlideImages(e.target.checked)}
                style={{
                  width: 17,
                  height: 17,
                  marginTop: 2,
                  flexShrink: 0,
                  accentColor: 'var(--accent)',
                  cursor: 'pointer',
                }}
              />
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-ui)',
                    letterSpacing: '-0.011em',
                    display: 'block',
                    lineHeight: 1.35,
                  }}
                >
                  Buscar imagens de fundo ao gerar
                </span>
                <span
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    fontWeight: 400,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-ui)',
                    letterSpacing: '-0.011em',
                    lineHeight: 1.47,
                    display: 'block',
                  }}
                >
                  Desligado, ficam só o texto e as palavras-chave da imagem; use depois{' '}
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Gerar imagem</span>{' '}
                  em cada slide (uma a uma ou na ordem que preferir).
                </span>
              </span>
            </label>
          </div>

          {/* Direção da imagem — eixos só alteram prompts do GPT Image (geração). */}
          {hasOpenAI && (
            <ImgParamsPanel value={params} onChange={setAxis} />
          )}

          {/* Resumo de contexto que será injetado no prompt — feedback claro pro user */}
          {((brandSummary && brandSummary.length) || (materialSummary && materialSummary.length)) && (
            <div style={{
              fontSize:13, color:'var(--text-secondary)', background:'rgba(52,199,89,0.08)',
              border:'1px solid rgba(52,199,89,0.22)', borderRadius:11, padding:'10px 12px', letterSpacing:'-0.011em',
              fontFamily:'var(--font-ui)', lineHeight:1.5,
            }}>
              <div style={{ fontWeight:600, color:'#1d8a3a', marginBottom:6, fontSize:12, letterSpacing:'-0.011em' }}>
                ✓ Contexto aplicado nesta geração
              </div>
              {brandSummary && brandSummary.length > 0 && (
                <div>Marca: {brandSummary.join(', ')}</div>
              )}
              {materialSummary && materialSummary.length > 0 && (
                <div>Conteúdo: {materialSummary.join(', ')}</div>
              )}
            </div>
          )}

          {err && (
            <div style={{
              fontSize:13, color:'#c5251c', background:'rgba(255,59,48,0.10)', letterSpacing:'-0.011em',
              border:'1px solid #7f1d1d', borderRadius:8, padding:'10px 14px',
              fontFamily:'var(--font-ui)',
            }}>{err}</div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} className="vc-btn vc-btn-ghost" style={{ height:44, padding:'0 16px' }}>Voltar</button>
            <button
              type="button"
              onClick={run} disabled={busy||!resolvedGenerationTopic}
              style={{
                flex:1, height:44, borderRadius:9999, border:'none', cursor:'pointer',
                background: (busy||!resolvedGenerationTopic) ? 'var(--bg-pearl)' : 'var(--accent)',
                color: (busy||!resolvedGenerationTopic) ? 'var(--text-muted)' : '#fff',
                fontSize:15, fontWeight:400, fontFamily:'var(--font-ui)',
                letterSpacing:'-0.016em',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                transition:'background-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
                opacity: (busy||!resolvedGenerationTopic) ? 0.6 : 1,
              }}
            >
              {busy
                ? <><Loader2 size={15} style={{animation:'spin 0.8s linear infinite'}}/>Gerando slides...</>
                : <><Sparkles size={15}/>Gerar carrossel</>
              }
            </button>
          </div>
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
          <button onClick={onClose} style={{ color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', padding:4, borderRadius:6, transition:'color 0.12s' }}
            onMouseEnter={e=>e.currentTarget.style.color='var(--text-primary)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}
          ><X size={16}/></button>
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
                        <button onClick={()=>navigator.clipboard?.writeText(h)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2, borderRadius:4, transition:'color 0.12s', flexShrink:0 }}
                          onMouseEnter={e=>e.currentTarget.style.color='var(--text-primary)'}
                          onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}
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
          <button onClick={onClose} aria-label="Fechar" style={{ color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', padding:4 }}>
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
      const materialBlock = buildMaterialBlock(material);
      const materialPriorityBlock = buildMaterialPriorityBlock(material);
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
          <button onClick={onClose} aria-label="Fechar" style={{ color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', padding:4 }}>
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
            <Image size={20} strokeWidth={1.75} />
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
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.45 }}>
            Com <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>GPT Image</span>, a referência vai para a API de edição. No{' '}
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Web trend</span>, só o texto reforça a busca.
          </div>
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
  exportSlide, exportAll, exportPDF, exporting, exportProgress, tab, setTab,
  openaiKey, hasOpenAI=false, setKeysOpen,
  setTemplatesOpen, setHookVarsOpen, refineAll, askPrompt, toast,
  material = { content:'', sources:'', context:'' }, setMaterial = () => {},
  imgParams = { fidelity:50, creativity:50, irreverence:50, objectivity:50 },
  setImgParams = () => {},
  setBrandsOpen, brandRoster = [], activeBrandId,
  openRefImagePicker = () => {},
  slideImgGenBusy = {},
  generateSlideImageAt = () => {},
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
      updateSlide({ bgImage: url });
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

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Tab bar */}
      <div data-vc-tour="sidebar-tabs" style={{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        {[
          {id:'brand',    icon:Palette,  label:'Marca'},
          {id:'material', icon:BookOpen, label:'Conteúdo'},
          {id:'slide',    icon:Layout,   label:'Cards'},
          {id:'ai',       icon:Wand2,    label:'IA'},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} className={`tab-bar-item ${tab===t.id?'active':''}`}>
            <t.icon size={11}/>{t.label}
          </button>
        ))}
      </div>

      {/* Scrollable body */}
      <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:20, paddingBottom:24 }}>

        {tab==='slide' && (
          <>
            <S title={`Card ${activeIdx+1} / ${slides.length}`}>
              <div>
                <label className="vc-label-sm">Título</label>
                <textarea value={slide.title} onChange={e=>updateSlide({title:e.target.value})} rows={2}
                  className="vc-input vc-textarea"
                  style={{ fontSize:13, fontWeight:500 }}
                />
              </div>
              <div>
                <label className="vc-label-sm">Subtítulo</label>
                <textarea value={slide.subtitle} onChange={e=>updateSlide({subtitle:e.target.value})} rows={3}
                  className="vc-input vc-textarea"
                  style={{ fontSize:12, color:'var(--text-secondary)' }}
                />
              </div>
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
            </S>

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

            <S title="Imagem de fundo">
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

              {/* Action buttons */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                {[
                  { icon:Upload, label:'Upload', action:()=>fileInputRef.current?.click() },
                  { icon:LinkIcon, label:'URL', action:askUrlImg },
                  { icon:Search, label:'Buscar', action:()=>replaceImg() },
                ].map(({icon:Icon,label,action})=>(
                  <button key={label} onClick={action} style={{
                    background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8,
                    padding:'8px 0', cursor:'pointer', display:'flex', flexDirection:'column',
                    alignItems:'center', gap:4, transition:'all 0.12s',
                    color:'var(--text-muted)',
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
                  onMouseLeave={e=>{e.currentTarget.style.color='var(--text-muted)';e.currentTarget.style.borderColor='var(--border)';}}
                  >
                    <Icon size={12}/><span style={{ fontSize:11, fontWeight:600, letterSpacing:'-0.011em' }}>{label}</span>
                  </button>
                ))}
              </div>

              {slide.imageQuery && (
                <div style={{
                  fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)',
                  background:'rgba(0,113,227,0.05)', border:'1px solid rgba(0,113,227,0.14)',
                  borderRadius:8, padding:'6px 10px', lineHeight:1.5,
                }}>
                  {hasOpenAI ? '⬡ ' : ''}Palavras-chave · &quot;{slide.imageQuery}&quot;
                </div>
              )}

              {slide.bgImage && (
                <>
                  <div>
                    <label className="vc-label-sm">Encaixe no card</label>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginTop:6 }}>
                      {[
                        { id:'cover', label:'Cobrir', sub:'preenche' },
                        { id:'contain', label:'Inteira', sub:'sem cortar' },
                        { id:'custom', label:'Manual', sub:'zoom %' },
                      ].map((opt) => {
                        const on = bgFitKey === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => updateSlide({ bgFit: opt.id })}
                            style={{
                              padding:'7px 4px', borderRadius:11, border:'1px solid',
                              borderColor: on ? 'var(--accent)' : 'var(--hairline)',
                              background: on ? 'rgba(0,113,227,0.08)' : 'var(--bg-base)',
                              cursor:'pointer', transition:'all 0.12s', textAlign:'center',
                            }}
                          >
                            <div style={{ fontSize:11, fontWeight:600, fontFamily:'var(--font-ui)', color: on ? 'var(--accent)' : 'var(--text-primary)', letterSpacing:'-0.011em' }}>
                              {opt.label}
                            </div>
                            <div style={{ fontSize:10, fontFamily:'var(--font-ui)', color:'var(--text-muted)', marginTop:2 }}>{opt.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Slider label="Posição X" value={slide.bgX} min={0} max={100} onChange={v=>updateSlide({bgX:v})}/>
                  <Slider label="Posição Y" value={slide.bgY} min={0} max={100} onChange={v=>updateSlide({bgY:v})}/>
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
            </S>

            <S title="Posição do texto">
              {/* 3×3 position grid */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                {LAYOUTS.map(l=>(
                  <button key={l.id} onClick={()=>updateSlide({layout:l.id})} style={btnStyle(slide.layout===l.id)}>
                    {l.label}
                  </button>
                ))}
              </div>
              {/* alignment */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4 }}>
                {[
                  {id:'left',    icon:AlignLeft,    title:'Esquerda'},
                  {id:'center',  icon:AlignCenter,  title:'Centro'},
                  {id:'right',   icon:AlignRight,   title:'Direita'},
                  {id:'justify', icon:AlignJustify, title:'Justificar'},
                ].map(a=>(
                  <button key={a.id} onClick={()=>updateSlide({align:a.id})} style={btnStyle(slide.align===a.id)} title={a.title} aria-label={a.title}>
                    <a.icon size={13}/>
                  </button>
                ))}
              </div>
              {/* inset from edges */}
              <Slider label="Distância das bordas" value={slide.textInset??7} min={1} max={20} onChange={v=>updateSlide({textInset:v})}/>
            </S>

            <S title="Tamanho">
              <Slider label="Tamanho título"    value={slide.titleSize} min={50} max={180} onChange={v=>updateSlide({titleSize:v})}/>
              <Slider label="Tamanho subtítulo" value={slide.subSize}   min={50} max={180} onChange={v=>updateSlide({subSize:v})}/>
            </S>

            <S title="Espaçamento — Título">
              <Slider label="Entre letras (tracking)" value={slide.titleTracking ?? 0} min={-10} max={30} onChange={v=>updateSlide({titleTracking:v})}/>
              <Slider label="Entre linhas (leading)"  value={slide.titleLeading ?? 105} min={80} max={180} onChange={v=>updateSlide({titleLeading:v})}/>
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
            </S>

            <S title="Espaçamento — Subtítulo">
              <Slider label="Entre letras (tracking)" value={slide.subTracking ?? 0} min={-10} max={30} onChange={v=>updateSlide({subTracking:v})}/>
              <Slider label="Entre linhas (leading)"  value={slide.subLeading ?? 150} min={100} max={220} onChange={v=>updateSlide({subLeading:v})}/>
            </S>

            <S title="Legibilidade">
              <Toggle label="Sombra no texto" value={slide.textShadow!==false} onChange={v=>updateSlide({textShadow:v})}/>
              <Toggle label="Fundo atrás do texto" value={!!slide.textBg} onChange={v=>updateSlide({textBg:v})}/>
              {slide.textBg && (
                <Slider label="Opacidade do fundo" value={slide.textBgOpacity??55} min={10} max={90} onChange={v=>updateSlide({textBgOpacity:v})}/>
              )}
            </S>

            <S title="Operações">
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
            </S>
          </>
        )}

        {tab==='brand' && (
          <>
            {/* Switcher de perfis de marca — útil pra freelance/agência alternar entre clientes */}
            {setBrandsOpen && (
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
                      {[brand.bg, brand.titleColor, brand.accent].map((c,i)=>(
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

            <S title="Perfil Instagram" hint="A foto do perfil aparece no círculo colorido ao lado do @ nos cards (aba Marca).">
              <div>
                <label className="vc-label-sm">@ Username</label>
                <input value={brand.handle} onChange={e=>setBrand({...brand,handle:e.target.value})} className="vc-input"/>
              </div>
              <Toggle label="Mostrar @ nos slides" value={brand.showHandle} onChange={v=>setBrand({...brand,showHandle:v})}/>
              <div style={{ marginTop: 10 }}>
                <label className="vc-label-sm">Foto no ícone do @</label>
                {brand.handleAvatar ? (
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
                        background:`url(${brand.handleAvatar}) center/cover no-repeat`,
                      }}/>
                    </div>
                    <div style={{ flex:1, fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', lineHeight:1.45 }}>
                      Aparece dentro do anel do badge nos cards.
                    </div>
                    <button
                      type="button"
                      onClick={() => setBrand({ ...brand, handleAvatar: null })}
                      title="Remover foto do perfil"
                      style={{ width:30, height:30, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                    >
                      <Trash2 size={11}/>
                    </button>
                  </div>
                ) : (
                  <label
                    style={{
                      display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                      height:56, borderRadius:9, cursor:'pointer', marginTop:4,
                      background:'var(--bg-card)', border:'1px dashed var(--border)',
                      color:'var(--text-secondary)', fontSize:12, fontWeight:600,
                      fontFamily:'var(--font-ui)', transition:'all 0.12s',
                    }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--accent)'; }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; }}
                  >
                    <Upload size={13}/>
                    Carregar foto (PNG / JPG / WebP · até 2MB)
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
            </S>

            <S title="Logo da marca" hint="Aplicado automaticamente em todos os cards. PNG transparente é o ideal.">
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
                <label
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    height:64, borderRadius:9, cursor:'pointer',
                    background:'var(--bg-card)', border:'1px dashed var(--border)',
                    color:'var(--text-secondary)', fontSize:12, fontWeight:500,
                    fontFamily:'var(--font-ui)', transition:'all 0.12s',
                  }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
                >
                  <Upload size={13}/>
                  Carregar PNG / JPG / SVG (até 2MB)
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
            </S>

            <S title="Identidade verbal" hint="Esses campos viram contexto da IA em toda geração — quanto mais preciso, mais consistente o carrossel fica.">
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
            </S>

            <S title="Paletas prontas">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {PALETTES.map(p=>(
                  <button key={p.name} className="palette-swatch" onClick={()=>setBrand({...brand,bg:p.bg,titleColor:p.title,subColor:p.sub,accent:p.accent})}
                    style={{
                      background:'var(--bg-card)', border:'1px solid var(--border)',
                      borderRadius:8, padding:'10px 10px 8px', textAlign:'left', cursor:'pointer',
                      transition:'all 0.15s',
                    }}
                  >
                    <div style={{ display:'flex', gap:4, marginBottom:6 }}>
                      {[p.bg, p.title, p.accent].map((c,i)=>(
                        <div key={i} style={{ width:18, height:18, borderRadius:4, background:c, border:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}/>
                      ))}
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', fontWeight:600, letterSpacing:'0.02em' }}>{p.name}</div>
                  </button>
                ))}
              </div>
            </S>

            <S title="Cores manuais">
              <ColorRow label="Fundo" value={brand.bg} onChange={v=>setBrand({...brand,bg:v})}/>
              <ColorRow label="Título" value={brand.titleColor} onChange={v=>setBrand({...brand,titleColor:v})}/>
              <ColorRow label="Subtítulo" value={brand.subColor} onChange={v=>setBrand({...brand,subColor:v})}/>
              <ColorRow label="Acento" value={brand.accent} onChange={v=>setBrand({...brand,accent:v})}/>
            </S>

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
                        display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                        height:52, borderRadius:9, cursor:'pointer', marginTop:4,
                        background:'var(--bg-card)', border:'1px dashed var(--border)',
                        color:'var(--text-secondary)', fontSize:12, fontWeight:600,
                        fontFamily:'var(--font-ui)', transition:'all 0.12s',
                      }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--accent)'; }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; }}
                    >
                      <Upload size={13}/>
                      Carregar fonte para títulos
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
                        display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                        height:52, borderRadius:9, cursor:'pointer', marginTop:4,
                        background:'var(--bg-card)', border:'1px dashed var(--border)',
                        color:'var(--text-secondary)', fontSize:12, fontWeight:600,
                        fontFamily:'var(--font-ui)', transition:'all 0.12s',
                      }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--accent)'; }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; }}
                    >
                      <Upload size={13}/>
                      Carregar fonte para corpo
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
          </>
        )}

        {tab==='material' && (
          <>
            <S
              title="Curadoria: voz de referência"
              hint="Inspire tom e ritmo do texto (carrosséis fortes no Instagram). Não copia posts nem nomes de perfis."
            >
              <div data-vc-tour="ref-profiles" style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <button
                  type="button"
                  onClick={() => setMaterial({ ...material, refProfileId: null })}
                  style={{
                    alignSelf:'flex-start', height:32, padding:'0 14px', borderRadius:9999,
                    border:`1px solid ${!material.refProfileId ? 'var(--accent)' : 'var(--border)'}`,
                    background: !material.refProfileId ? 'rgba(0,102,204,0.08)' : 'var(--bg-card)',
                    color: 'var(--text-secondary)', fontSize:12, fontWeight:600, fontFamily:'var(--font-ui)',
                    cursor:'pointer', letterSpacing:'-0.011em',
                  }}
                >
                  Nenhuma referência fixa
                </button>
                <div style={{
                  display:'grid',
                  gridTemplateColumns:'repeat(auto-fill, minmax(118px, 1fr))',
                  gap:8,
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
                          textAlign:'left', padding:'10px 10px', borderRadius:11,
                          border:`1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                          background: on ? 'rgba(0,102,204,0.06)' : 'var(--bg-card)',
                          cursor:'pointer', transition:'border-color 0.12s',
                          minHeight:72,
                        }}
                      >
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', lineHeight:1.25 }}>
                          {p.label}
                        </div>
                        <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4, lineHeight:1.35 }}>
                          {p.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </S>

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
              {material.content && (
                <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.04em', textAlign:'right' }}>
                  {material.content.length.toLocaleString('pt-BR')} caracteres
                </div>
              )}
            </S>

            <S
              title="Fontes & referências"
              hint="URLs, papers, citações, dados. A IA pode citar/usar como apoio. Uma por linha."
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
                  disabled={!material.content && !material.sources && !material.context && !material.refProfileId}
                  style={{
                    height:36, borderRadius:8, cursor:'pointer',
                    background:'var(--bg-card)', border:'1px solid var(--border)',
                    color:'var(--text-muted)', fontSize:11, fontWeight:600, fontFamily:'var(--font-ui)',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    opacity: (!material.content && !material.sources && !material.context && !material.refProfileId) ? 0.4 : 1,
                  }}
                >
                  <Trash2 size={11}/>Limpar tudo
                </button>
                <button
                  onClick={() => setSetupOpen(true)}
                  disabled={!material.content && !material.sources && !material.context && !material.refProfileId}
                  style={{
                    height:38, borderRadius:9999, cursor:'pointer',
                    background:'var(--accent)', border:'none',
                    color:'#fff', fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)',
                    letterSpacing:'-0.011em',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    opacity: (!material.content && !material.sources && !material.context && !material.refProfileId) ? 0.42 : 1,
                    transition:'background-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
                  }}
                >
                  <Sparkles size={13}/>Gerar com este material
                </button>
              </div>
            </S>
          </>
        )}

        {tab==='ai' && (
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

            <S title="Refinar todos os cards">
              <RefineBtn onRefine={refineAll} busy={refining}/>
              <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-ui)', lineHeight:1.5 }}>
                Aplica uma instrução a todo o carrossel mantendo coerência narrativa.
              </div>
            </S>

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
                <button onClick={generateCaption} disabled={genCaption} style={{
                  width:'100%', height:44, borderRadius:8, cursor:'pointer',
                  background:'var(--bg-card)', border:'1px dashed var(--border)',
                  color:'var(--text-secondary)', fontSize:12, fontWeight:600, fontFamily:'var(--font-ui)',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  opacity:genCaption?0.6:1, transition:'all 0.12s',
                }}
                onMouseEnter={e=>{if(!genCaption){e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--text-primary)';}}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-secondary)';}}
                >
                  {genCaption ? <Loader2 size={14} style={{animation:'spin 0.8s linear infinite'}}/> : <FileText size={14}/>}
                  Gerar legenda para o post
                </button>
              )}
            </S>
          </>
        )}
      </div>

      {/* Download footer */}
      <div style={{ borderTop:'1px solid var(--border)', padding:12, display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
        <button onClick={()=>exportSlide(activeIdx)} disabled={exporting} aria-label={`Baixar card ${activeIdx+1} em PNG`} style={{
          width:'100%', height:40, borderRadius:9999, border:'none', cursor:'pointer',
          background:'var(--text-primary)', color:'#fff',
          fontSize:14, fontWeight:600, fontFamily:'var(--font-ui)',
          letterSpacing:'-0.011em',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          opacity:exporting?0.5:1,
          transition:'opacity 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
        }}>
          <Download size={13}/>
          {exporting ? `${exportProgress.current}/${exportProgress.total}…` : `Baixar card ${activeIdx+1}`}
        </button>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <button onClick={exportAll} disabled={exporting} className="vc-btn vc-btn-ghost" style={{ height:34, fontSize:11 }} aria-label={`Baixar todos os cards num ficheiro ZIP (${slides.length} imagens)`}>
            <Download size={11}/>ZIP ({slides.length})
          </button>
          <button onClick={exportPDF} disabled={exporting} className="vc-btn vc-btn-ghost" style={{ height:34, fontSize:11 }} aria-label="Baixar carrossel em PDF">
            <FileText size={11}/>PDF
          </button>
        </div>
      </div>
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

const buildMaterialBlock = (material) => {
  const parts = [];
  const c = (material?.content || '').trim();
  const s = (material?.sources || '').trim();
  const x = (material?.context || '').trim();
  const refId = material?.refProfileId;
  const ref = refId && REFERENCE_PROFILE_BY_ID[refId];
  if (c) parts.push(`MATÉRIA-PRIMA (use como base de fatos antes de inventar — extraia teses, não copie literal):\n"""\n${c.slice(0, 8000)}\n"""`);
  if (s) {
    const srcLabel = /https?:\/\//i.test(s)
      ? 'FONTES & REFERÊNCIAS (há URL(s) colada(s) — você NÃO pode abrir links; use só o que o usuário escreveu no app + palavras visíveis no próprio endereço; não finja ter lido a página):'
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
function buildMaterialPriorityBlock(material) {
  const c = (material?.content || '').trim();
  const s = (material?.sources || '').trim();
  const x = (material?.context || '').trim();
  if (!c && !s && !x) return '';
  return `
PRIORIDADE ABSOLUTA — MATERIAL DO USUÁRIO:
- O carrossel DEVE refletir o bloco MATÉRIA-PRIMA, FONTES e INSTRUÇÕES acima. O campo “sobre o que é o conteúdo” e o nicho são SECUNDÁRIOS: servem para tom ou desambiguação, NÃO para trocar o assunto.
- PROIBIDO fabricar narrativa genérica de “rotina de trabalho” (madrugada, arquivo não carrega, tela azul, escritório vazio, café, deadline) se NADA disso estiver no material — isso descola o post do que o usuário forneceu.
- URLs: você não navega na web. Se só houver link sem texto, infira o tema só do vocabulário visível no URL + instruções + matéria-prima; não invente história como se tivesse lido o artigo.
- Cada slide deve extrair uma linha de raciocínio do MATERIAL (não de clichês de carrossel viral).
`;
}

/** Pacotes criativos da geração: “Personalizado” (id `livre`) não injeta camada editorial-analítica fixa; “Estúdio editorial” ativa esse pacote sob demanda. */
const CREATIVE_PRESETS = [
  {
    id: 'livre',
    label: 'Personalizado',
    desc: 'Modo narrativo, tom, marca, conteúdo de base e eixos de imagem — sem camada fixa “parece ser / é”. Melhor para Storytelling e quando a aba Conteúdo já está preenchida.',
  },
  {
    id: 'estudio_editorial',
    label: 'Estúdio editorial',
    desc: 'Camada extra opcional: contraste estratégico e léxico de categoria + direção visual sóbria. Nos modos Storytelling, Dor ou Viral, o arco desse modo continua a mandar.',
  },
];
const CREATIVE_PRESET_BY_ID = Object.fromEntries(CREATIVE_PRESETS.map((p) => [p.id, p]));

function buildGenerationIntroLine(presetId) {
  if (presetId === 'estudio_editorial') {
    return 'Atue como estrategista sênior de conteúdo, branding e cultura de mercado. Responda APENAS com JSON válido, sem markdown, sem texto extra.';
  }
  return 'Crie conteúdo para Instagram alinhado ao contexto abaixo. Responda APENAS com JSON válido, sem markdown, sem texto extra.';
}

function buildGenerationLanguageLayer(presetId, tone, narrativeMode = 'editorial') {
  const storyLike = narrativeMode === 'storytelling' || narrativeMode === 'pain';
  const viralMode = narrativeMode === 'viral' || narrativeMode === 'sensacionalista';
  const journalMode = narrativeMode === 'jornalistico';
  const howToMode = narrativeMode === 'how_to';

  // Storytelling/Odisseia colidem com o pacote “Estúdio editorial”: priorizar instruções narrativas.
  if (presetId === 'estudio_editorial' && storyLike) {
    return `REGRAS DE LINGUAGEM (pacote Estúdio editorial + modo narrativo "${narrativeMode}"):
- O MÉTODO narrativo acima MANDA a estrutura. Use só sobriedade lexical e precisão — NÃO impor “parece ser / realmente é”, contraste binário de marca ou raciocínio de consultoria em cada slide.
- PROIBIDO soar como relatório de posicionamento ou headline + subtítulo “tese/antítese” repetidos (ex.: “Inovação X: uma reflexão” + “quem incorpora Y ganha credibilidade”).
- Prosa de narrador: tempo, gesto, sensação, consequência — não slogan analítico.
- Tom base: "${tone}".`;
  }
  if (presetId === 'estudio_editorial' && viralMode && narrativeMode === 'sensacionalista') {
    return `REGRAS DE LINGUAGEM (Estúdio editorial + Sensacionalista):
- O MÉTODO SENSACIONALISTA manda tensão forte e cortes rápidos. O pacote editorial empresta precisão de palavra — PROIBIDO engrossar cada slide em parágrafo de consultoria.
- Ritmo tablóide moderno SEM clickbait desonesto: tensão lexical sim, factualidade obrigatória.
- Tom "${tone}".`;
  }
  if (presetId === 'estudio_editorial' && viralMode) {
    return `REGRAS DE LINGUAGEM (Estúdio editorial + Viral Trends):
- O MÉTODO VIRAL acima manda ritmo, loops e parada de scroll. O pacote editorial empresta só sobriedade lexical — NÃO impor “parece ser / realmente é” nem subtítulo denso de relatório slide a slide.
- Tom "${tone}", preferindo frases curtas e cortantes nos slides de tensão.`;
  }
  if (presetId === 'estudio_editorial' && journalMode) {
    return `REGRAS DE LINGUAGEM (Estúdio editorial + Jornalístico):
- Hierarquia de matéria: selo/editoria → manchete → lead factual. O método jornalístico prevalece sobre o molde binário “parece ser / realmente é” em todos os slides.
- Vocabulário de analítico e consequência — não slogan de marca.
- Tom "${tone}", factual e adulto.`;
  }
  if (presetId === 'estudio_editorial' && howToMode) {
    return `REGRAS DE LINGUAGEM (Estúdio editorial + Passo-a-passo):
- O tutorial imperativo do MÉTODO acima prevalece. O pacote editorial não transforma passos em análise de mercado nem em contraste estratégico genérico.
- Tom "${tone}" em modo instrução clara, não keynote.`;
  }
  if (presetId === 'estudio_editorial') {
    return `REGRAS DE LINGUAGEM OBRIGATÓRIAS (todos os slides):
- Frases assertivas. Zero clichês de marketing, zero tom de guru, zero motivacional.
- Cada slide = 1 ideia única. Contraste entre "parece ser" e "realmente é".
- Transforme informação em interpretação estratégica.
- O ritmo do carrossel deve ser: hook curto → conteúdo denso (vários slides) → fechamento curto.`;
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
function buildGenerationSlideLayoutRules(narrativeModeId, creativePresetId) {
  const hookMag = creativePresetId === 'estudio_editorial'
    ? '   - Peso de capa sim, mas em modo narrativo o hook é CENA ou momento — não título de relatório (“X: uma reflexão”).'
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
`;
  }

  const hookVisualHint = creativePresetId === 'estudio_editorial'
    ? '   - Pense no hook como uma capa de revista — pouco texto, muito peso.'
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
`;
}

function buildGenerationImageLayer(presetId, topic, n, audience) {
  const nicheStr = n ? ` (nicho: ${n})` : '';
  const audStr = audience ? ` (público: ${audience})` : '';
  if (presetId === 'estudio_editorial') {
    return `imageQuery — DIREÇÃO DE ARTE EDITORIAL (a IA do gerador de imagem aplicará realismo, luz natural e estética premium em cima — você só precisa descrever a CENA):
• Idioma: INGLÊS, 8-15 palavras descritivas.
• Estrutura: [sujeito real] + [ação cotidiana ou estado] + [ambiente específico observado] + [detalhe de luz/atmosfera].
• OBRIGATÓRIO — relação INDIRETA e inteligente com o tema "${topic}"${nicheStr}${audStr}. NUNCA escolha a representação mais óbvia. A imagem deve sugerir o conceito por atmosfera, gesto, contexto, objeto ou tensão visual — não ser uma "legenda" do título.
• EVITE clichês visuais: xadrez (estratégia), gráficos subindo (crescimento), lâmpadas (ideia), robôs/hologramas (tecnologia), reuniões corporativas (negócios), explosão de tinta (criatividade), aperto de mãos (parceria), engrenagens, escalada de montanha, lupa.
• EVITE: pessoas posando como modelo, sorriso publicitário, diversidade encenada, expressões artificiais, fundo de estúdio, luz dramática teatral, paisagens aleatórias desconectadas, animais decorativos.
• PREFIRA cenas reais e bem observadas: escritórios contemporâneos, ruas urbanas, cafés, casas, lojas, bastidores, mãos manuseando objeto, detalhes de processo, espaços culturais, mesas com objetos, interiores residenciais.
• Composição: espaço negativo para texto, fundo levemente desfocado, foco claro em UM elemento, poucos objetos, silêncio visual.
• Exemplos BONS (note como sugerem o tema sem ilustrá-lo literalmente):
  - tema "produtividade" → "open notebook beside cooling coffee on wooden desk, late afternoon window light"
  - tema "estratégia"   → "hands rearranging objects on a quiet meeting room table, soft overhead light"
  - tema "longevidade"  → "older woman walking slowly through tree-lined street, soft morning haze"
  - tema "marca pessoal"→ "person reflected on storefront glass at dusk, warm street lights blurred behind"
  - tema "tecnologia"   → "single hand resting on closed laptop on minimal desk, quiet morning light through curtain"
• Cada slide: imageQuery DIFERENTE, todas dentro do mesmo universo visual sóbrio e silencioso.`;
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

/** Regras de comprimento/tom para refinar UM slide, alinhadas ao modo. */
function buildRefineSingleSlideRules(narrativeModeId) {
  if (narrativeModeId === 'storytelling' || narrativeModeId === 'pain') {
    return `- Refine mantendo registro narrativo (cena, tensão, consequência ou empatia) — não converta em headline de deck + subtítulo "tese/antítese" corporativo.
- Título pode ser fragmento de cena ou virada; subtítulo em prosa coerente com o modo, sem forçar três frases analíticas se uma batida basta.`;
  }
  if (narrativeModeId === 'viral') {
    return `- Mantenha ou reforce ritmo viral: título curto; subtítulo telegráfico (sem parágrafo denso de análise).`;
  }
  if (narrativeModeId === 'sensacionalista') {
    return `- Refine preservando tensão sensacionalista: cortes rápidos, viradas — SEM inventar fatos nem promessa falsa para clickbait.`;
  }
  if (narrativeModeId === 'jornalistico') {
    return `- Refine preservando hierarquia jornalística (selo/manchete/lead onde couber ao slide) e prosa factual; não converta em pitch de marca.`;
  }
  if (narrativeModeId === 'how_to') {
    return `- Se o slide for instrucional, mantenha "Passo N · …" e imperativos; o refinamento não deve virar história ou tese de marca.`;
  }
  return `- Título: 4–14 palavras conforme impacto. Subtítulo: aprofunde a ideia deste slide; no miolo editorial/profundo pode ser mais denso que no hook.`;
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
  const baseEditorial = creativePresetId === 'estudio_editorial';
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
  if (baseEditorial) {
    return `${editorialFormats}
- Tom assertivo, sofisticado, leitura estratégica — sem clichê motivacional.
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

  if (presetId === 'estudio_editorial' && storyLike) {
    return `- Refinamento: o modo narrativo "${narrativeMode}" manda — use o pacote editorial só para precisão de palavra, não para virar cada slide em "parece ser / realmente é".
- Não substitua cena ou dor por análise de mercado genérica.`;
  }
  if (presetId === 'estudio_editorial' && viralMode && narrativeMode === 'sensacionalista') {
    return `- Refinamento sensacionalista: tensão máxima e cortes rápidos; payoff honesto. O pacote editorial afina léxico sem esvaziar o drama nem engrossar em relatório corporativo.
- Zero clickbait falso: pode ser incômodo, não mentiroso.`;
  }
  if (presetId === 'estudio_editorial' && viralMode) {
    return `- Refinamento viral: frases curtas e tensão; o pacote editorial não deve densificar em parágrafo de consultoria.`;
  }
  if (presetId === 'estudio_editorial' && howToMode) {
    return `- Refinamento tutorial: imperativo e claro; sem transformar passos em keynote estratégico.`;
  }
  if (presetId === 'estudio_editorial' && journalMode) {
    return `- Refinamento jornalístico: hierarquia de capa onde couber ao slide; factual e preciso — sem soar como pitch institucional.
- Preserve selo/editoria vs manchete vs lead quando o método pedir.`;
  }
  if (presetId === 'estudio_editorial') {
    return `- Tom assertivo, direto, sofisticado. Sem clichês, sem linguagem motivacional, sem guru.
- Use vocabulário de mercado quando pertinente: categoria, posicionamento, percepção, distribuição, comportamento, narrativa, diferenciação.`;
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
  if (presetId === 'estudio_editorial') {
    presetLine = `- Tom: direto, analítico quando couber ao tema; sem emojis em excesso (máx 2-3). Sem guru nem motivacional vazio.`;
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
Aplicação: em "carousel_ideas", favoreça ângulos que esse modo execute bem (ex.: storytelling → arco em cena; passo-a-passo → passos numerados; viral → tensão e payoff; profundo → padrão/mecanismo). Em "viral_hooks", combine formatos estratégicos com variações compatíveis com o modo.
`;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

const DEFAULT_BRAND = {
  id: 'default',
  name: 'Padrão',
  handle: '@seu.perfil', showHandle: true,
  /* Visual neutro no primeiro uso: superfície clara + tinta + único acento Action Blue (DESIGN.md). */
  titleFont: '"Inter", sans-serif',
  bodyFont: '"Inter Tight", sans-serif',
  bg: '#fafafc', titleColor: '#1d1d1f', subColor: '#515154', accent: '#0066cc',
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
  /** Fonte própria (título) — { dataUrl, format, fileName } */
  customTitleFont: null,
  /** Fonte própria (corpo / subtítulo) */
  customBodyFont: null,
  logoSize: 30,           // tamanho do logo em px na escala real (1080px)
  logoPosition: 'tr',     // canto: 'tl' | 'tr' | 'bl' | 'br'
  logoOpacity: 90,        // 0-100
};
const DEFAULT_DOC = {
  fmt: 'carrossel',
  brand: DEFAULT_BRAND,
  slides: [mkSlide(1)],
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
  // Pacote criativo da IA — default personalizado (id interno `livre`) ou estúdio editorial.
  creativePreset: 'livre',
};

/** Evita ecrã em branco quando `vc_library` ou import JSON tem doc incompleto (sem slides, etc.). */
function ensureDocShape(d) {
  if (!d || typeof d !== 'object') {
    return JSON.parse(JSON.stringify(DEFAULT_DOC));
  }
  const out = {
    ...DEFAULT_DOC,
    ...d,
    brand: { ...DEFAULT_BRAND, ...(d.brand && typeof d.brand === 'object' ? d.brand : {}) },
    material: { ...DEFAULT_DOC.material, ...(d.material && typeof d.material === 'object' ? d.material : {}) },
    imgParams: { ...DEFAULT_DOC.imgParams, ...(d.imgParams && typeof d.imgParams === 'object' ? d.imgParams : {}) },
  };
  if (!Array.isArray(out.slides) || out.slides.length === 0) {
    out.slides = [mkSlide(1)];
  }
  if (!FORMATS[out.fmt]) out.fmt = 'carrossel';
  if (!out.mode) out.mode = 'editorial';
  if (out.creativePreset == null) out.creativePreset = 'livre';
  if (typeof out.caption !== 'string') out.caption = '';
  return out;
}

export default function App() {
  // ── BIBLIOTECA + PERFIS DE MARCA (multi-doc) ────────────────────────────────
  // Schema novo (vc_library + vc_brands). Migra automaticamente do `vc_doc`
  // legado se existir e a biblioteca estiver vazia.
  const [library, setLibrary] = useState(() => {
    const lib = lsGet(SK.library, null);
    if (Array.isArray(lib) && lib.length) return lib;
    const legacy = lsGet(SK.legacyDoc, null);
    if (legacy && legacy.slides?.length) {
      // Migra o doc antigo pra primeira entrada da biblioteca
      return [mkLibEntry({ ...DEFAULT_DOC, ...legacy }, 'Carrossel')];
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
    if (Array.isArray(stored) && stored.length) return stored;
    return [DEFAULT_BRAND];
  });
  const [activeBrandId, setActiveBrandId] = useState(() => lsGet(SK.activeBrandId, 'default'));

  // Persiste os 3 stores (debounced)
  useEffect(() => { const t = setTimeout(() => lsSet(SK.library, library), 250); return () => clearTimeout(t); }, [library]);
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
  // Nunca deixar slides vazio: senão `slide` fica undefined e a árvore inteira rebenta (tela branca).
  const slides = (Array.isArray(doc.slides) && doc.slides.length > 0) ? doc.slides : [mkSlide(1)];
  const brand = doc.brand && typeof doc.brand === 'object' ? doc.brand : DEFAULT_BRAND;
  const fmt = doc.fmt && FORMATS[doc.fmt] ? doc.fmt : 'carrossel';
  const caption = typeof doc.caption === 'string' ? doc.caption : '';
  const material  = doc.material  || { content:'', sources:'', context:'' };
  const imgParams = doc.imgParams || { fidelity:50, creativity:50, irreverence:50, objectivity:50 };
  const mode      = doc.mode      || 'editorial';
  const creativePreset = doc.creativePreset ?? 'livre';

  // Helpers que aceitam value OU função, mantendo a API "useState-like"
  const setSlides    = useCallback(next => history.set(d => ({ ...d, slides:    typeof next==='function' ? next(d.slides)   : next })), [history]);
  const setBrand     = useCallback(next => history.set(d => ({ ...d, brand:     typeof next==='function' ? next(d.brand)    : next })), [history]);
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
    const baseDoc = { ...DEFAULT_DOC, ...(seedDoc || {}), brand: { ...activeBrand } };
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

  // ── EXPORT / IMPORT de projetos ─────────────────────────────────────────────
  // Exporta UMA entrada da biblioteca como arquivo .json
  const exportDoc = useCallback((docId) => {
    const entry = library.find(e => e.id === docId);
    if (!entry) return;
    const blob = new Blob([JSON.stringify({ vcVersion: 1, docs: [entry] }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entry.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'carrossel'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [library]);

  // Exporta TODA a biblioteca de uma vez
  const exportAllDocs = useCallback(() => {
    const blob = new Blob([JSON.stringify({ vcVersion: 1, docs: library }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viral-carrossel-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [library]);

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
    history.set(d => ({ ...d, brand: { ...b } }));
  }, [brandRoster, history]);
  const upsertBrand = useCallback((brandObj) => {
    setBrandRoster(prev => {
      const exists = prev.find(b => b.id === brandObj.id);
      if (exists) return prev.map(b => b.id === brandObj.id ? brandObj : b);
      return [...prev, brandObj];
    });
  }, []);
  const deleteBrand = useCallback((brandId) => {
    setBrandRoster(prev => {
      const next = prev.filter(b => b.id !== brandId);
      if (!next.length) return [DEFAULT_BRAND];
      return next;
    });
    if (brandId === activeBrandId) setActiveBrandId('default');
  }, [activeBrandId]);
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
  const [openaiKey, setOpenaiKey] = useState(() => {
    try { return localStorage.getItem(SK.openaiKey) || ''; } catch { return ''; }
  });
  // Persiste a chave na mesma camada que os outros stores (App é o dono, modal só chama setOpenaiKey)
  useEffect(() => {
    try { localStorage.setItem(SK.openaiKey, openaiKey); } catch { /* privado / bloqueado */ }
  }, [openaiKey]);
  // Ref para cancelar loops de geração de imagem órfãos (race-condition guard)
  const imgGenAbortRef = useRef(null);
  const slideImgGenIdsRef = useRef(new Set());
  const [slideImgGenBusy, setSlideImgGenBusy] = useState({});
  const [serverStatus, setServerStatus] = useState({ anthropic:false, openai:false, dev:false });
  const hasOpenAI    = !!openaiKey || (IS_LOCAL_DEV && serverStatus.openai);
  const hasAnthropic = serverStatus.anthropic;
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
  const [toasts, setToasts] = useState([]);
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const fileInputRef = useRef(null);
  const refImageInputRef = useRef(null);
  const refImageTargetIdxRef = useRef(null);
  const slideRefs = useRef({});

  // Toast helpers
  const dismissToast = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);
  const toast = useCallback((message, kind='info', ttl=3500) => {
    const id = uid();
    setToasts(t => [...t, { id, message, kind }]);
    if (ttl > 0) setTimeout(() => dismissToast(id), ttl);
  }, [dismissToast]);
  const setError = useCallback((msg) => { if (msg) toast(msg, 'error', 5000); }, [toast]);

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
      // Mobile: usa praticamente a largura inteira (24px de margem total).
      return Math.min((vw - 24) / f.w, 0.9);
    }
    // Desktop: thumbnail compacta na faixa horizontal.
    return Math.min(360 / f.w, 0.44);
  }, [isMobile, vw, f]);

  const slide = slides[activeIdx] ?? slides[0] ?? mkSlide(1);
  const empty = isDefault(slides);

  const updateSlide = useCallback(patch => {
    setSlides(s => s.map((sl,i) => i===activeIdx ? {...sl,...patch} : sl));
  }, [activeIdx]);

  const updateSlideAt = useCallback((idx, patch) => {
    setSlides(s => s.map((sl, i) => (i === idx ? { ...sl, ...patch } : sl)));
  }, []);

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
      const url = await generateDALLE(q, openaiKey, imgParams, {
        refImage: snap.refImage,
        imgExtraPrompt: snap.imgExtraPrompt,
      });
      setSlides(prev => {
        const j = prev.findIndex(sl => sl.id === slideId);
        return j < 0 ? prev : prev.map((sl, k) => (k === j ? { ...sl, bgImage: url, imgMode: 'dalle', overlay: 70 } : sl));
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
    history.setSilent(d => ({ ...d, slides: [mkSlide(1)] }));
    // history omitido de propósito — só repara ao trocar de doc
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId]);

  const addSlide = useCallback(() => {
    const n = {...mkSlide(slides.length+1), layout:'bl', align:'left'};
    setSlides([...slides, n]); setActiveIdx(slides.length);
  }, [slides]);
  const deleteSlide = useCallback((i) => {
    if (slides.length<=1) return;
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
    fetchImagesNow = true,
  }) => {
    const effectiveAxes = axes || imgParams;
    const effectiveMode = chosenNarrativeMode || mode || 'editorial';
    const cp = presetArg ?? creativePreset ?? 'livre';
    const modeDef = GEN_MODE_BY_ID[effectiveMode] || GEN_MODES[0];
    const brandBlock = buildBrandBlock(brand);
    const materialBlock = buildMaterialBlock(material);
    const materialPriorityBlock = buildMaterialPriorityBlock(material);
    const imgParamsBlock = buildImgParamsBlockPT(effectiveAxes);
    const introLine = buildGenerationIntroLine(cp);
    const langLayer = buildGenerationLanguageLayer(cp, tone, effectiveMode);
    const imageLayer = buildGenerationImageLayer(cp, topic, n, audience);
    const slideLayoutRules = buildGenerationSlideLayoutRules(effectiveMode, cp);

    const prompt = `${introLine}
Crie um carrossel de ${count} slides para Instagram sobre: "${topic}"
${n?`Nicho: ${n}`:''}
${audience?`Público-alvo: ${audience}`:''}
Tom de voz solicitado: ${tone}
${brandBlock}
${materialBlock}
${materialPriorityBlock}
${imgParamsBlock}

${modeDef.method}

${slideLayoutRules}

${langLayer}

${imageLayer}

JSON exato a retornar (sem mais nada):
{"slides":[{"title":"...","subtitle":"...","imageQuery":"..."}],"caption":"legenda estratégica 8-12 linhas + CTA reflexivo + 8-12 hashtags relevantes ao nicho"}`;

    const result = await callAI(prompt, { json:true, maxTokens:4096, openaiKey });
    if (!result?.slides?.length) throw new Error('IA não retornou slides. Tente um tema mais específico.');

    const resolvedImgMode = normalizeSlideImgMode(chosenMode || 'dalle');
    const newSlides = result.slides.map((s,i) => ({
      ...mkSlide(i+1),
      title: s.title || `Slide ${i+1}`,
      subtitle: s.subtitle || '',
      imageQuery: s.imageQuery || '',
      imgMode: resolvedImgMode,
      bgImage: null,
      overlay: s.imageQuery ? 70 : 0,
      layout: i===0 ? 'mc' : 'bl',
      align: i===0 ? 'center' : 'left',
    }));
    setSlides(newSlides); setActiveIdx(0); setShellView('project');
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
        for (let i = 0; i < result.slides.length; i++) {
          if (abort.cancelled) break;
          const q = result.slides[i]?.imageQuery;
          if (!q) continue;
          try {
            const url = await generateDALLE(q, openaiKey, effectiveAxes, {
              refImage: newSlides[i]?.refImage,
              imgExtraPrompt: newSlides[i]?.imgExtraPrompt,
            });
            if (!abort.cancelled)
              setSlides(prev => prev.map((sl, idx) => idx === i ? { ...sl, bgImage: url } : sl));
          } catch(e) {
            imgFailCount++;
            console.warn(`Image gen slide ${i+1}:`, e.message);
          }
        }
      }

      if (!abort.cancelled && imgFailCount > 0) {
        toast(
          imgFailCount === 1
            ? '1 imagem não carregou — o slide ficou sem fundo.'
            : `${imgFailCount} imagens não carregaram — os slides ficaram sem fundo.`,
          'warning',
          5000,
        );
      }
    } else if (result.slides.some(s => (s.imageQuery || '').trim())) {
      toast(
        'Imagens não foram buscadas automaticamente. Use «Gerar imagem» em cada slide quando quiser.',
        'info',
        5500,
      );
    }
  };

  const refineSlide = async (instruction) => {
    setRefining(true); setError('');
    try {
      const ctx = slides.map((s,i)=>`${i+1}. ${s.title}`).join('\n');
      const brandBlock = buildBrandBlock(brand);
      const materialBlock = buildMaterialBlock(material);
      const voiceRefine = buildRefineVoiceRules(creativePreset, mode);
      const r = await callAI(
        `Atue como editor de carrossel para Instagram. Responda APENAS com JSON.

${buildNarrativeModeReminder(mode)}

Contexto do carrossel:\n${ctx}
${brandBlock}${materialBlock}
Slide ${activeIdx+1} (atual):
Título: "${slide.title}"
Subtítulo: "${slide.subtitle}"

Instrução de refinamento: ${instruction}

REGRAS:
${voiceRefine}
${buildRefineSingleSlideRules(mode)}
- Mantenha coerência com os outros slides e com o modo narrativo acima.
- Respeite a identidade verbal e o material acima.

Retorne exatamente: {"title":"...","subtitle":"..."}`,
        { json:true, openaiKey }
      );
      updateSlide({ title:r.title||slide.title, subtitle:r.subtitle||slide.subtitle });
    } catch(e) { setError(e.message); }
    finally { setRefining(false); }
  };

  const generateCaption = async () => {
    setGenCaption(true); setError('');
    try {
      const ctx = slides.map((s,i)=>`Slide ${i+1}: ${s.title} — ${s.subtitle}`).join('\n');
      const brandBlock = buildBrandBlock(brand);
      const materialBlock = buildMaterialBlock(material);
      const capRules = buildCaptionVoiceRules(creativePreset, mode);
      const r = await callAI(
        `Atue como estrategista de conteúdo para Instagram. Crie a legenda para este carrossel em português brasileiro.

${buildNarrativeModeReminder(mode)}

Carrossel:
${ctx}
${brandBlock}${materialBlock}
${buildCaptionOutlineInstructions(mode)}

REGRAS:
${capRules}
- 8-12 linhas de texto. Use quebras de linha para ritmo.
- Adicionar no final 8-12 hashtags estratégicas ao nicho.
- Respeite a identidade verbal e o material acima. Se houver assinatura recorrente, finalize com ela quando fizer sentido.
- Apenas a legenda e as hashtags, nada mais.`,
        { openaiKey }
      );
      setCaption(r.trim());
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
    return h2c(el, {
      scale: 2,                 // 2× resolução final pra ficar nítido
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: null,
      width: f.w, height: f.h,  // força dimensões corretas, ignora qualquer transform do pai
      windowWidth: f.w,
      windowHeight: f.h,
    });
  };

  const exportSlide = async (idx) => {
    setExporting(true); setExportProgress({current:1,total:1});
    try {
      await loadHtml2Canvas();
      await waitForRender();
      const canvas = await renderSlideToCanvas(slides[idx]);
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
      for (let i=0; i<slides.length; i++) {
        setExportProgress({current:i+1,total:slides.length});
        const canvas = await renderSlideToCanvas(slides[i]);
        const blob = await canvasToPngBlob(canvas);
        zip.file(`slide-${String(i+1).padStart(2,'0')}.png`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(zipBlob, `carrossel-slides-${stamp}.zip`);
      toast(`ZIP com ${slides.length} cards pronto`, 'success');
    } catch(e) { setError('Erro ao exportar: '+e.message); }
    finally { setExporting(false); }
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
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateSlide({ bgImage:reader.result });
    reader.readAsDataURL(file); e.target.value='';
  };

  // Refina TODOS os slides com uma instrução geral (passa contexto para coerência)
  const refineAll = useCallback(async (instruction) => {
    if (!slides.length) return;
    setRefining(true);
    try {
      const ctx = slides.map((s,i)=>`${i+1}. Título: "${s.title}" | Subtítulo: "${s.subtitle}"`).join('\n');
      const brandBlock = buildBrandBlock(brand);
      const materialBlock = buildMaterialBlock(material);
      const voiceBulk = buildRefineVoiceRules(creativePreset, mode);
      const layoutBulk = buildGenerationSlideLayoutRules(mode, creativePreset);
      const r = await callAI(
        `Atue como editor de carrossel para Instagram. Reescreva TODOS os slides do carrossel abaixo aplicando a instrução do usuário, mantendo coerência narrativa entre eles.

${buildNarrativeModeReminder(mode)}

Carrossel atual:
${ctx}
${brandBlock}${materialBlock}
Instrução: ${instruction}

REGRAS DE VOZ:
${voiceBulk}
- Mantenha exatamente ${slides.length} slides na mesma ordem (slide 1 = abertura do arco do modo; último = fecho/CTA conforme o modo).
- Respeite a identidade verbal e o material acima.

${layoutBulk}

Retorne APENAS JSON: {"slides":[{"title":"...","subtitle":"..."}]}`,
        { json:true, openaiKey }
      );
      if (!r?.slides?.length) throw new Error('IA não retornou slides');
      setSlides(prev => prev.map((s, i) => ({
        ...s,
        title:    r.slides[i]?.title    || s.title,
        subtitle: r.slides[i]?.subtitle || s.subtitle,
      })));
      toast('Todos os slides refinados', 'success');
    } catch(e) { setError(e.message); }
    finally { setRefining(false); }
  }, [slides, setSlides, setError, toast, openaiKey, brand, material, creativePreset, mode]);

  // Aplica um template pronto (preenche slides + brand)
  const applyTemplate = useCallback((tpl) => {
    const palette = PALETTES[tpl.palette] || PALETTES[0];
    const titleFont = TITLE_FONTS[tpl.titleFont] || TITLE_FONTS[0];
    const bodyFont = BODY_FONTS[tpl.bodyFont] || BODY_FONTS[0];
    const newSlides = tpl.slides.map((s, i) => ({
      ...mkSlide(i+1),
      title: s.title,
      subtitle: s.subtitle,
      imageQuery: s.q,
      imgMode: 'dalle',
      bgImage: null,
      overlay: 65,
      layout: i === 0 ? 'mc' : 'bl',
      align:  i === 0 ? 'center' : 'left',
    }));
    history.set(d => ({
      ...d,
      slides: newSlides,
      brand: { ...d.brand, bg:palette.bg, titleColor:palette.title, subColor:palette.sub, accent:palette.accent, titleFont:titleFont.val, bodyFont:bodyFont.val },
    }));
    setActiveIdx(0);
    toast(`Template "${tpl.name}" aplicado`, 'success');
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
          const url = await generateDALLE(q, openaiKey, imgParams, {
            refImage: newSlides[i]?.refImage,
            imgExtraPrompt: newSlides[i]?.imgExtraPrompt,
          });
          if (!abort.cancelled)
            setSlides(prev => prev.map((sl, j) => j === i ? { ...sl, bgImage: url } : sl));
        } catch (e) {
          failCount++;
          console.warn(`Template imagem slide ${i + 1}:`, e.message);
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
      const anyModalOpen = setupOpen || researchOpen || keysOpen || templatesOpen || hookVarsOpen || helpOpen || imgPrompt.open || fullscreenOpen || tourOpen || libraryOpen || brandsOpen;
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
  }, [activeIdx, slides.length, history, setupOpen, researchOpen, keysOpen, templatesOpen, hookVarsOpen, helpOpen, imgPrompt.open, fullscreenOpen, tourOpen, libraryOpen, brandsOpen, shellView]); // eslint-disable-line

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
    openRefImagePicker,
    slideImgGenBusy,
    generateSlideImageAt,
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
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'env(safe-area-inset-top, 0) 14px 0',
        // Altura cresce com a safe-area top (iOS notch)
        height: `calc(${isMobile ? 56 : 52}px + env(safe-area-inset-top, 0))`,
        flexShrink:0, gap:10,
      }}>
        {/* Brand */}
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
          <div style={{
            width:30, height:30, borderRadius:8, background:'var(--accent)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <Flame size={14} color="#fff"/>
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.022em', lineHeight:1, fontFamily:'var(--font-display)' }}>
              Viral<span style={{ color:'var(--accent)' }}>.</span>
            </div>
            {/* Nome do doc atual — clicável pra renomear inline (substitui o subtítulo "Carrossel Studio") */}
            {activeEntry && !isMobile && (
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
                  marginTop:3, fontSize:11, color:'var(--text-muted)',
                  letterSpacing:'-0.011em',
                  background:'none', border:'none', cursor:'pointer', padding:0,
                  maxWidth:220, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  textAlign:'left', display:'block',
                }}
                title="Clique para renomear"
              >
                {activeEntry.name || 'Sem título'}
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShellView('home')}
          title="Início — projetos e conta"
          aria-label="Início"
          style={{
            width: isMobile ? 36 : 32,
            height: isMobile ? 36 : 32,
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
        {!isMobile && (
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
        )}

        {/* Format selector — visual proporções no mobile */}
        <div style={{
          display:'flex', alignItems:'center', background:'var(--bg-card)',
          borderRadius:8, padding:3, gap:2, border:'1px solid var(--border)', flexShrink:0,
        }}>
          {Object.entries(FORMATS).map(([k,v])=>{
            // No mobile: minirretângulo no aspect-ratio do formato + label compacta
            const isActive = fmt === k;
            // Aspect-ratio mini-rect (visual)
            const ratio = v.h / v.w;
            const miniW = 14;
            const miniH = Math.max(10, Math.min(20, miniW * ratio));
            return (
              <button key={k} onClick={()=>setFmt(k)} style={{
                padding: isMobile ? '6px 12px' : '5px 14px',
                borderRadius:9999, fontSize:isMobile ? 12 : 13, fontWeight:isActive?600:400,
                fontFamily:'var(--font-ui)', letterSpacing:'-0.011em', cursor:'pointer',
                border:'none', transition:'background-color 0.15s var(--ease-smooth), color 0.15s var(--ease-smooth)',
                background: isActive ? 'var(--bg-base)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                display:'flex', alignItems:'center', gap:6,
              }}
              title={`${v.label} · ${v.w}×${v.h}`}
              >
                {isMobile && (
                  <span style={{
                    display:'inline-block', width:miniW, height:miniH,
                    border:`1.5px solid ${isActive ? 'var(--text-primary)' : 'var(--text-muted)'}`,
                    borderRadius:2, flexShrink:0,
                  }}/>
                )}
                {isMobile ? v.label.split(' ')[0] : v.label}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
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
          {/* Biblioteca — abre modal com lista de carrosséis salvos */}
          <button type="button" data-vc-tour="library" onClick={()=>setLibraryOpen(true)} style={{
            width: isMobile ? 38 : 34, height: isMobile ? 38 : 34,
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
              width: isMobile ? 38 : 34, height: isMobile ? 38 : 34,
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
            width: isMobile ? 38 : 34, height: isMobile ? 38 : 34,
            borderRadius:11, border:`1px solid ${hasAnyAI ? 'rgba(52,199,89,0.28)' : 'var(--divider-soft)'}`,
            background: hasAnyAI ? 'rgba(52,199,89,0.10)' : 'var(--bg-pearl)',
            color: hasAnyAI ? '#1d8a3a' : 'var(--text-secondary)', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s',
          }}
                  onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
          onMouseLeave={e=>{e.currentTarget.style.color=hasAnyAI?'#1d8a3a':'var(--text-secondary)';e.currentTarget.style.borderColor=hasAnyAI?'rgba(52,199,89,0.28)':'var(--divider-soft)';}}
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
            height: isMobile ? 38 : 34, padding: isMobile ? '0 18px' : '0 18px',
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
            padding:'10px 14px', flexShrink:0,
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
                    background: s.customBg||brand.bg,
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
              <div className="empty-grid" style={{ minHeight:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
                <div style={{ textAlign:'center', maxWidth:340, animation:'fadeUp 0.3s var(--ease-smooth)' }}>
                  <div style={{
                    width:72, height:72, borderRadius:18, background:'var(--accent)',
                    display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 28px',
                  }}>
                    <Sparkles size={32} color="#fff"/>
                  </div>
                  <div style={{ fontSize:40, fontWeight:600, fontFamily:'var(--font-display)', color:'var(--text-primary)', letterSpacing:'-0.022em', marginBottom:12, lineHeight:1.07 }}>
                    Crie seu carrossel<br/>
                    <span style={{ color:'var(--accent)' }}>viral.</span>
                  </div>
                  <p style={{ fontSize:17, color:'var(--text-secondary)', marginBottom:32, lineHeight:1.47, letterSpacing:'-0.011em', fontWeight:400 }}>
                    Informe o tema e a IA gera gancho,<br/>slides e legenda prontos para postar.
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <button onClick={()=>setSetupOpen(true)} aria-label="Gerar carrossel com IA" style={{
                      height:48, borderRadius:9999, border:'none', cursor:'pointer',
                      background:'var(--accent)',
                      color:'#fff', fontSize:15, fontWeight:400, fontFamily:'var(--font-ui)',
                      letterSpacing:'-0.016em',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                      transition:'background-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
                    }}>
                      <Sparkles size={16}/>Gerar carrossel com IA
                    </button>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <button onClick={()=>setTemplatesOpen(true)} aria-label="Abrir templates" style={{
                        height:42, borderRadius:10, cursor:'pointer',
                        background:'var(--bg-elevated)', border:'1px solid var(--border)',
                        color:'var(--text-secondary)', fontSize:12, fontWeight:600, fontFamily:'var(--font-ui)',
                        display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 0.12s',
                      }}
                      onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
                      onMouseLeave={e=>{e.currentTarget.style.color='var(--text-secondary)';e.currentTarget.style.borderColor='var(--border)';}}
                      >
                        <Layout size={12}/>Templates
                      </button>
                      <button onClick={()=>setResearchOpen(true)} aria-label="Pesquisar nicho" style={{
                        height:42, borderRadius:10, cursor:'pointer',
                        background:'var(--bg-elevated)', border:'1px solid var(--border)',
                        color:'var(--text-secondary)', fontSize:12, fontWeight:600, fontFamily:'var(--font-ui)',
                        display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 0.12s',
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
              // Mobile: single slide with floating arrows + swipe
              <div
                style={{
                  display:'flex', flexDirection:'column', alignItems:'center',
                  padding:'16px 12px calc(80px + env(safe-area-inset-bottom, 0))',
                  minHeight:'100%', position:'relative',
                }}
                onTouchStart={e => { e.currentTarget.dataset.tx = String(e.touches[0].clientX); }}
                onTouchEnd={e => {
                  const start = parseFloat(e.currentTarget.dataset.tx || '0');
                  const dx = e.changedTouches[0].clientX - start;
                  if (Math.abs(dx) > 50) {
                    if (dx < 0) setActiveIdx(Math.min(slides.length-1, activeIdx+1));
                    else setActiveIdx(Math.max(0, activeIdx-1));
                  }
                }}
              >
                <div style={{ animation:'fadeUp 0.2s var(--ease-smooth)', position:'relative' }}>
                  <SlideCard slide={slide} fmt={fmt} brand={brand} num={activeIdx+1} total={slides.length} scale={previewScale}/>

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
                  <div key={s.id} style={{ flexShrink:0, animation:`fadeUp 0.2s ${i*0.04}s both var(--ease-smooth)` }}>
                    <div
                      onClick={()=>setActiveIdx(i)}
                      style={{
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
                        slide={s} fmt={fmt} brand={brand} num={i+1} total={slides.length} scale={previewScale}
                      />
                    </div>
                    <div style={{ marginTop:8, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 2px' }}>
                      <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.06em' }}>
                        {String(i+1).padStart(2,'0')}
                      </span>
                      <button onClick={()=>exportSlide(i)} disabled={exporting} style={{
                        background:'none', border:'none', color:'var(--text-muted)',
                        cursor:'pointer', padding:4, borderRadius:4, transition:'color 0.12s',
                      }}
                      onMouseEnter={e=>e.currentTarget.style.color='var(--text-primary)'}
                      onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}
                      ><Download size={11}/></button>
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

          {/* Mobile bottom bar — 4 abas + ação de baixar.
              Empurra o conteúdo da home indicator iOS via safe-area-inset-bottom. */}
          {isMobile && !empty && !drawerOpen && (
            <div
              data-vc-tour="mobile-bar"
              style={{
              position:'fixed', bottom:0, left:0, right:0, zIndex:20,
              background:'var(--bg-sidebar)', borderTop:'1px solid var(--border)',
              padding:'8px 8px calc(8px + env(safe-area-inset-bottom, 0))',
              display:'flex', gap:6,
              boxShadow:'0 -4px 16px rgba(0,0,0,0.4)',
              backdropFilter:'blur(8px)',
            }}
            >
              {[
                { id:'brand',    label:'Marca',    icon:Palette },
                { id:'material', label:'Conteúdo', icon:BookOpen },
                { id:'slide',    label:'Cards',    icon:Layout },
                { id:'ai',       label:'IA',       icon:Wand2 },
              ].map(({ id, label, icon:Icon }) => (
                <button
                  key={id}
                  onClick={() => { setTab(id); setDrawerOpen(true); }}
                  style={{
                    flex:1, height:48, borderRadius:11, border:'1px solid var(--hairline)',
                    background:'var(--bg-pearl)', color:'var(--text-secondary)',
                    fontSize:11, fontWeight:600, fontFamily:'var(--font-ui)', cursor:'pointer',
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4,
                    letterSpacing:'-0.011em',
                    transition:'background-color 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
                  }}
                  onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                  onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  aria-label={`Abrir aba ${label}`}
                >
                  <Icon size={14}/>{label}
                </button>
              ))}
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
                aria-label="Baixar card atual"
              >
                <Download size={14}/>Baixar
              </button>
            </div>
          )}
        </main>
      </div>
      </>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageUpload}/>
      <input ref={refImageInputRef} type="file" accept="image/*" hidden onChange={handleRefImageFile}/>

      {/* Toast notifications */}
      <ToastStack toasts={toasts} onDismiss={dismissToast}/>

      {/* Modals */}
      <KeysModal
        open={keysOpen}
        onClose={()=>setKeysOpen(false)}
        openaiKey={openaiKey}
        onSave={setOpenaiKey}
        onRefreshStatus={setServerStatus}
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
        materialSummary={[
          material.content?.trim() && `conteúdo (${material.content.length} chars)`,
          material.sources?.trim() && 'fontes',
          material.context?.trim() && 'contexto',
          REFERENCE_PROFILE_BY_ID[material.refProfileId]?.label &&
            `voz ref.: ${REFERENCE_PROFILE_BY_ID[material.refProfileId].label}`,
        ].filter(Boolean)}
        imgParams={imgParams}
        onImgParamsChange={setImgParams}
        mode={mode}
        onModeChange={setMode}
        creativePreset={creativePreset}
        onCreativePresetChange={setCreativePreset}
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
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: `calc(10px + env(safe-area-inset-top, 0)) 16px 10px`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Flame size={16} color="#fff" />
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
          {!isMobile && (
            <button type="button" onClick={() => onOpenTemplates()} aria-label="Templates prontos" style={{
              width: 36, height: 36, borderRadius: 11, border: '1px solid var(--border)',
              background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Layout size={13} />
            </button>
          )}
          {!isMobile && (
            <button type="button" onClick={() => onOpenResearch()} aria-label="Pesquisar nicho" style={{
              width: 36, height: 36, borderRadius: 11, border: '1px solid var(--divider-soft)',
              background: 'var(--bg-pearl)', color: 'var(--text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingUp size={14} />
            </button>
          )}
          {!isMobile && (
            <button type="button" onClick={() => onOpenHelp()} aria-label="Ajuda" style={{
              width: 36, height: 36, borderRadius: 11, border: '1px solid var(--border)',
              background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>?</span>
            </button>
          )}
          <button type="button" onClick={() => onOpenSettings()} aria-label="Configurações" style={{
            width: 36, height: 36, borderRadius: 11,
            border: `1px solid ${hasAnyAI ? 'rgba(52,199,89,0.28)' : 'var(--divider-soft)'}`,
            background: hasAnyAI ? 'rgba(52,199,89,0.10)' : 'var(--bg-pearl)',
            color: hasAnyAI ? '#1d8a3a' : 'var(--text-secondary)',
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
            <Sparkles size={13} /> {isMobile ? 'IA' : 'Gerar com IA'}
          </button>
        </div>
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
            const bg = firstSlide?.customBg || entry.doc?.brand?.bg || '#fafafc';
            return (
              <div
                key={entry.id}
                style={{
                  background: isActive ? 'rgba(0,102,204,0.06)' : 'var(--bg-pearl)',
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
          <button onClick={onClose} aria-label="Fechar" style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:6, borderRadius:6 }}>
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
          {items.length === 0 && (
            <div style={{
              padding:'40px 20px', textAlign:'center', color:'var(--text-muted)',
              fontSize:13, fontFamily:'var(--font-ui)',
            }}>
              {search.trim() ? 'Nenhum carrossel com esse nome.' : 'Nenhum carrossel neste filtro.'}
            </div>
          )}
          {items.map(entry => {
            const isActive = entry.id === activeDocId;
            const status = STATUS_BY_ID[entry.status] || STATUS_BY_ID.draft;
            const slides = entry.doc?.slides || [];
            const firstSlide = slides[0];
            const bg = firstSlide?.customBg || entry.doc?.brand?.bg || '#0a0a0a';
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
          <button onClick={onClose} aria-label="Fechar" style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:6, borderRadius:6 }}>
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
                    {[b.bg, b.titleColor, b.accent].map((c,i)=>(
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

function FullscreenViewer({ open, onClose, slides, fmt, brand, activeIdx, setActiveIdx, onSavePresentationAdjust }) {
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
        'Na aba Conteúdo, escolha uma voz curada para inspirar tom e ritmo — sem copiar conteúdo de terceiros.',
      selector: '[data-vc-tour="ref-profiles"]',
    },
  ];
}

function OnboardingTour({ open, onDismiss, isMobile, empty, setTab, setDrawerOpen, onEnterEditor }) {
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
      setTab('material');
      if (isMobile) setDrawerOpen(true);
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
      steps[idx]?.id === 'refs' ? (isMobile ? 220 : 90)
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
  }, [open, idx, steps, setTab, setDrawerOpen, isMobile, onEnterEditor, empty]);

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
          <button onClick={onClose} aria-label="Fechar" style={{ color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', padding:4 }}>
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
