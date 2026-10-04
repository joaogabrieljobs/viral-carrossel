// CSS global do app — extraído do monólito (design system Figma, tokens, componentes base).
// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────

export const GLOBAL_STYLE = `
  /* Figma Design System — pastéis marketing + magenta CTA (+ Inter / JetBrains Mono). */

  :root {
    /* — NARRATIVE OS Design System (Sessão A: Foundation Dark + Glass) — */

    /* Magenta core (mantém identidade) */
    --accent-primary: #ff2d8d;
    --accent-hover: #ff4fa1;
    --accent-blue: #7ba7ff;
    --accent-violet: #8f7dff;
    --accent-amber: #ffb86a;

    /* Spec Narrative OS: bg light, mas mock é dark — interpolação:
       app fica DARK por default, surfaces com glass; texto on-dark.
       Tons charcoal/midnight em vez de preto puro. */
    --bg-primary: #0e0c14;
    --bg-secondary: #15131c;
    --bg-tertiary: #1c1925;

    /* Surfaces compat (mapeia tokens legacy do app pra equivalentes dark) */
    --bg-base: var(--bg-primary);
    --bg-parchment: var(--bg-secondary);
    --bg-pearl: var(--bg-secondary);
    --bg-sidebar: var(--bg-secondary);
    --bg-elevated: var(--bg-tertiary);
    --bg-card: var(--bg-tertiary);

    --bg-tile-1: #1c1925;
    --bg-tile-2: #221f2c;
    --bg-tile-3: #1a1722;
    --bg-black: #000000;

    /* Glass system — multi-layer com blur. White/dark variants. */
    --bg-glass:        rgba(255, 255, 255, 0.06);
    --bg-glass-strong: rgba(255, 255, 255, 0.10);
    --bg-glass-deep:   rgba(255, 255, 255, 0.14);
    --bg-dark-glass:   rgba(10, 10, 10, 0.42);
    --glass-border:    rgba(255, 255, 255, 0.16);
    --glass-border-strong: rgba(255, 255, 255, 0.26);
    --glass-highlight: rgba(255, 255, 255, 0.22);

    /* Blur tokens */
    --blur-xs: 6px;
    --blur-sm: 12px;
    --blur-md: 18px;
    --blur-lg: 24px;
    --blur-xl: 40px;

    /* Borders — contrastes legíveis no dark (UI/UX Pro Max a11y) */
    --border: rgba(255, 255, 255, 0.18);
    --border-muted: rgba(255, 255, 255, 0.10);
    --hairline: rgba(255, 255, 255, 0.16);
    --divider-soft: rgba(255, 255, 255, 0.08);
    --border-on-dark: rgba(255, 255, 255, 0.18);

    /* Text on dark */
    --text-primary: #f3f0eb;
    --text-secondary: #b8b3a8;
    --text-muted: rgba(243, 240, 235, 0.55);
    --text-on-dark: #ffffff;
    --text-on-dark-muted: rgba(255, 255, 255, 0.72);

    /* Accent system (legacy aliases pra compat) */
    --accent: var(--accent-primary);
    --accent-focus: var(--accent-primary);
    --accent-secondary: var(--accent-violet);
    --accent-on-dark: #ffffff;
    --accent-surface:        rgba(255, 45, 141, 0.10);
    --accent-surface-strong: rgba(255, 45, 141, 0.18);
    --accent-magenta-surface: rgba(255, 45, 141, 0.10);
    --accent-glow: rgba(255, 45, 141, 0.32);

    --logo-mark-bg: var(--accent-surface);
    --logo-mark-fg: var(--accent-primary);

    --success: #1ea64a;
    --success-surface: rgba(30, 166, 74, 0.12);
    --success-border: rgba(30, 166, 74, 0.28);
    --success-text: #5fd47e;
    --danger: #ff3b30;
    --warning: #ff9500;

    /* Typography — stack de sistema primeiro (WWDC: optical sizing + legibilidade) */
    --font-ui: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', 'Helvetica Neue', system-ui, sans-serif;
    --font-display: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
    --font-serif: -apple-system, 'Inter', system-ui, serif;

    /* Motion Apple — response curta no press; settle suave no resto */
    --ease-out-press: cubic-bezier(0.2, 0.9, 0.3, 1);
    --ease-out-settle: cubic-bezier(0.22, 1, 0.36, 1);
    --motion-press: 100ms;
    --motion-settle: 280ms;

    /* Radius scale Narrative OS */
    --radius-xs: 8px;
    --radius-sm: 12px;
    --radius-md: 18px;
    --radius-lg: 24px;
    --radius-xl: 32px;
    --radius-pill: 9999px;

    /* Spacing scale (8pt + accents) */
    --space-2: 2px;
    --space-4: 4px;
    --space-6: 6px;
    --space-8: 8px;
    --space-12: 12px;
    --space-16: 16px;
    --space-20: 20px;
    --space-24: 24px;
    --space-32: 32px;
    --space-40: 40px;
    --space-48: 48px;

    /* Motion — cinematic */
    --ease-smooth: cubic-bezier(0.22, 1, 0.36, 1);
    --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
    --motion-fast: 120ms;
    --motion-base: 180ms;
    --motion-slow: 280ms;
    --motion-cinematic: 420ms;

    /* Soft depth shadows */
    --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.22);
    --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.28);
    --shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.36);
    --shadow-xl: 0 24px 64px rgba(0, 0, 0, 0.48);

    /* Ambient colored glows */
    --shadow-pink:   0 0 40px rgba(255, 45, 141, 0.22);
    --shadow-blue:   0 0 48px rgba(123, 167, 255, 0.18);
    --shadow-violet: 0 0 56px rgba(143, 125, 255, 0.18);

    /* Legacy compat (já usado em vários lugares) */
    --shadow-product: var(--shadow-lg);
    --shadow-card-rest:
      0 4px 12px rgba(0, 0, 0, 0.18),
      0 1px 2px rgba(0, 0, 0, 0.12);
    --shadow-card-hover:
      0 16px 40px rgba(0, 0, 0, 0.36),
      0 0 40px rgba(255, 45, 141, 0.12);
    --shadow-elevated:
      0 8px 32px rgba(0, 0, 0, 0.32),
      inset 0 1px 0 rgba(255, 255, 255, 0.10);

    /* Surface gradients — dark glass */
    --gradient-surface: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%);
    --gradient-accent: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-hover) 100%);
    --gradient-bg: linear-gradient(180deg, #0e0c14 0%, #15131c 100%);

    --safe-top:    env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-left:   env(safe-area-inset-left, 0px);
    --safe-right:  env(safe-area-inset-right, 0px);
  }

  * { box-sizing: border-box; }

  body {
    /* Dark gradient + ambient glow magenta no canto (Vision OS-like) */
    background:
      radial-gradient(ellipse at top right, rgba(255, 45, 141, 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at bottom left, rgba(143, 125, 255, 0.06) 0%, transparent 60%),
      var(--gradient-bg);
    background-attachment: fixed;
    color: var(--text-primary);
    font-family: var(--font-ui);
    font-size: 17px;
    line-height: 1.47;
    letter-spacing: -0.011em;
    font-weight: 400;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: 'cv11', 'ss01', 'kern' 1;
    font-optical-sizing: auto;
    text-rendering: optimizeLegibility;
    overscroll-behavior-x: none;
    padding-top: env(safe-area-inset-top, 0);
    touch-action: manipulation;
  }

  /* Headlines — tracking negativo cresce com o tamanho (UI Typography WWDC) */
  h1, h2, h3, h4 {
    font-family: var(--font-display);
    font-weight: 600;
    letter-spacing: -0.022em;
    line-height: 1.2;
    color: var(--text-primary);
    font-optical-sizing: auto;
  }
  h1 { letter-spacing: -0.028em; line-height: 1.08; }
  h2 { letter-spacing: -0.024em; }

  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.32); }

  /* Dentro do editor a superfície é escura: um thumb preto a 18% ficava
     invisível — o quadro rolava e ninguém via que dava para rolar. */
  .vc-editor-shell ::-webkit-scrollbar { width: 10px; height: 10px; }
  .vc-editor-shell ::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.20);
    border: 2px solid transparent;
    background-clip: padding-box;
    border-radius: 99px;
  }
  .vc-editor-shell ::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.38);
    background-clip: padding-box;
  }
  .vc-editor-shell, .vc-editor-shell * { scrollbar-color: rgba(255,255,255,0.24) transparent; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes accentGlow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255, 61, 139, 0.40); }
    50%      { box-shadow: 0 0 0 8px rgba(255, 61, 139, 0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  /* — Utility classes premium — */
  .vc-glass {
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: var(--shadow-card-rest);
  }
  .vc-glass-dark {
    background: rgba(20, 20, 22, 0.72);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #fff;
  }
  .vc-card-elevated {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%);
    border: 1px solid var(--glass-border);
    border-radius: 18px;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    box-shadow:
      0 16px 48px rgba(0, 0, 0, 0.32),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transition:
      transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
      box-shadow 0.28s cubic-bezier(0.22, 1, 0.36, 1),
      border-color 0.18s;
  }
  .vc-card-elevated:hover {
    transform: translateY(-4px);
    border-color: var(--glass-border-strong);
    box-shadow:
      0 24px 64px rgba(0, 0, 0, 0.42),
      0 0 40px rgba(255, 45, 141, 0.16),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
  }
  .vc-glass-card {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0.04) 100%);
    border: 1px solid var(--glass-border-strong);
    border-radius: 16px;
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.24),
      inset 0 1px 0 rgba(255, 255, 255, 0.10);
  }
  .vc-shimmer {
    background: linear-gradient(
      90deg,
      rgba(0,0,0,0.04) 0%,
      rgba(0,0,0,0.08) 40%,
      rgba(0,0,0,0.04) 80%
    );
    background-size: 200% 100%;
    animation: shimmer 1.6s linear infinite;
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

  /* A11Y — Reduced motion: cross-fade / settle curto, sem vestibular. */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
    button:not(:disabled):active,
    .vc-btn:active,
    .tab-bar-item:active,
    .vc-seg-item:active {
      transform: none !important;
    }
  }
  @media (prefers-reduced-transparency: reduce) {
    .vc-glass,
    .vc-glass-dark,
    .vc-glass-card,
    .vc-card-elevated,
    .modal-overlay,
    .modal-panel,
    .vc-sidebar-panel,
    .vc-sidebar-dock,
    .export-fab,
    .vc-btn-ghost,
    .vc-input {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    .vc-sidebar-panel,
    .vc-sidebar-dock,
    .modal-panel {
      background: var(--bg-secondary) !important;
    }
    .modal-overlay {
      background: rgba(5, 4, 10, 0.88) !important;
    }
  }
  @media (prefers-contrast: more) {
    :root {
      --glass-border: rgba(255, 255, 255, 0.32);
      --glass-border-strong: rgba(255, 255, 255, 0.48);
      --hairline: rgba(255, 255, 255, 0.32);
      --border: rgba(255, 255, 255, 0.36);
      --text-muted: rgba(243, 240, 235, 0.72);
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

  /* — GLOBAL BUTTON POLISH (atinge TODOS os botões, incluindo inline-styled) — */
  button {
    transition:
      transform 0.18s cubic-bezier(0.22, 1, 0.36, 1),
      box-shadow 0.22s cubic-bezier(0.22, 1, 0.36, 1),
      background 0.20s cubic-bezier(0.22, 1, 0.36, 1),
      border-color 0.18s cubic-bezier(0.22, 1, 0.36, 1),
      color 0.18s cubic-bezier(0.22, 1, 0.36, 1);
    font-feature-settings: 'cv11', 'ss01', 'kern' 1;
  }
  button:not(:disabled):active { transform: scale(0.96); }

  /* Botão accent magenta — gradient 135deg + sombra magenta + glow no hover */
  button[style*="background:var(--accent)"]:not(:disabled),
  button[style*="background: var(--accent)"]:not(:disabled),
  button[style*="background:'var(--accent)'"]:not(:disabled) {
    background: linear-gradient(135deg, #ff2d8d 0%, #ff4fa1 100%) !important;
    border: 1px solid rgba(255, 255, 255, 0.10) !important;
    box-shadow:
      0 8px 24px rgba(255, 45, 141, 0.24),
      inset 0 1px 0 rgba(255, 255, 255, 0.18) !important;
  }
  button[style*="background:var(--accent)"]:not(:disabled):hover,
  button[style*="background: var(--accent)"]:not(:disabled):hover,
  button[style*="background:'var(--accent)'"]:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow:
      0 16px 40px rgba(255, 45, 141, 0.32),
      0 0 24px rgba(255, 45, 141, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.22) !important;
  }

  /* Botão dark (.text-primary) → sombra colored neutra elegante */
  button[style*="background:var(--text-primary)"]:not(:disabled),
  button[style*="background: var(--text-primary)"]:not(:disabled) {
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.42),
      inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
  }
  button[style*="background:var(--text-primary)"]:not(:disabled):hover,
  button[style*="background: var(--text-primary)"]:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow:
      0 16px 40px rgba(0, 0, 0, 0.52),
      inset 0 1px 0 rgba(255, 255, 255, 0.14) !important;
  }

  /* Inputs globais → focus glow halo accent (4px ring) */
  input:not([type="range"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):focus,
  textarea:focus,
  select:focus {
    outline: none;
    border-color: rgba(255, 45, 141, 0.42) !important;
    box-shadow:
      0 0 0 4px rgba(255, 45, 141, 0.08),
      0 8px 24px rgba(255, 45, 141, 0.12) !important;
  }

  /* — REGRESSION FIXES Sessão C — atinge inline-styled patterns globais
       que estavam usando bg-card/bg-pearl/text-primary (light theme).
       Converte pra glass dark coerente com Narrative OS. */

  /* Botões com bg=text-primary (eram pretos sólidos em light theme;
     ficariam BRANCOS em dark — visualmente errado). Viram accent gradient. */
  button[style*="background:var(--text-primary)"]:not(.vc-btn-primary):not(:disabled),
  button[style*="background: var(--text-primary)"]:not(.vc-btn-primary):not(:disabled) {
    background: linear-gradient(135deg, #ff2d8d 0%, #ff4fa1 100%) !important;
    color: #ffffff !important;
    border-color: transparent !important;
    box-shadow:
      0 8px 24px rgba(255, 45, 141, 0.24),
      inset 0 1px 0 rgba(255, 255, 255, 0.18) !important;
  }

  /* Botões inativos com bg=bg-card → glass dark sutil */
  button[style*="background:var(--bg-card)"]:not(:disabled),
  button[style*="background: var(--bg-card)"]:not(:disabled),
  label[style*="background:var(--bg-card)"],
  label[style*="background: var(--bg-card)"] {
    background: rgba(255, 255, 255, 0.06) !important;
    border-color: var(--glass-border-strong) !important;
    color: var(--text-secondary) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
  }

  /* Botões inativos com bg=bg-pearl → glass dark mais sutil ainda */
  button[style*="background:var(--bg-pearl)"]:not(:disabled),
  button[style*="background: var(--bg-pearl)"]:not(:disabled) {
    background: rgba(255, 255, 255, 0.05) !important;
    border-color: var(--glass-border-strong) !important;
    color: var(--text-secondary) !important;
  }

  /* Botões com bg=bg-elevated (modais internos) → glass deep */
  button[style*="background:var(--bg-elevated)"]:not(:disabled),
  button[style*="background: var(--bg-elevated)"]:not(:disabled) {
    background: rgba(255, 255, 255, 0.06) !important;
    border-color: var(--glass-border) !important;
  }

  /* Hover dos glass inativos → realça */
  button[style*="background:var(--bg-card)"]:not(:disabled):hover,
  button[style*="background: var(--bg-card)"]:not(:disabled):hover,
  button[style*="background:var(--bg-pearl)"]:not(:disabled):hover,
  button[style*="background: var(--bg-pearl)"]:not(:disabled):hover,
  label[style*="background:var(--bg-card)"]:hover,
  label[style*="background: var(--bg-card)"]:hover {
    background: rgba(255, 255, 255, 0.10) !important;
    border-color: var(--glass-border-strong) !important;
    color: var(--text-primary) !important;
  }

  /* Divs (cards/sections) com bg-card/bg-pearl/bg-elevated → glass dark */
  div[style*="background:var(--bg-card)"]:not(input):not(button),
  div[style*="background: var(--bg-card)"]:not(input):not(button),
  div[style*="background:var(--bg-pearl)"]:not(input):not(button),
  div[style*="background: var(--bg-pearl)"]:not(input):not(button) {
    background: rgba(255, 255, 255, 0.04) !important;
    border-color: var(--glass-border) !important;
  }

  /* Inputs inline com bg=bg-base ou white (raros) → glass */
  input[style*="background:'white'"],
  input[style*='background:"white"'],
  input[style*="background:#ffffff"],
  input[style*="background: #ffffff"] {
    background: rgba(255, 255, 255, 0.06) !important;
    border-color: var(--glass-border-strong) !important;
    color: var(--text-primary) !important;
  }

  /* — Buttons — modernizados: micro-interactions, glass ghost, glow primary,
     transitions cubic-bezier suaves. Mantém identidade magenta. — */
  .vc-btn {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 8px; font-family: var(--font-ui); font-weight: 600;
    border-radius: 9999px; cursor: pointer;
    transition:
      transform 0.18s var(--ease-smooth),
      box-shadow 0.22s var(--ease-smooth),
      background 0.22s var(--ease-smooth),
      color 0.22s var(--ease-smooth),
      border-color 0.18s var(--ease-smooth);
    /* Default = ghost legível — evita botão “sem linha” quando só tem .vc-btn */
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-primary);
    border: 1px solid var(--glass-border-strong);
    outline: none; position: relative; overflow: hidden;
    letter-spacing: -0.014em;
    font-feature-settings: 'cv11', 'ss01';
    -webkit-tap-highlight-color: transparent;
    min-height: 40px;
    padding: 0 16px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  .vc-btn:hover:not(:disabled):not(.vc-btn-primary) {
    background: rgba(255, 255, 255, 0.10);
    border-color: rgba(255, 255, 255, 0.34);
    color: var(--text-primary);
  }
  .vc-btn:active { transform: scale(0.96); }
  .vc-btn:focus-visible { outline: 2px solid var(--accent-focus); outline-offset: 3px; }
  .vc-btn:disabled { opacity: 0.42; cursor: not-allowed; transform: none; }

  /* Primary pill — gradient 135deg magenta + sombra colored + glow no hover */
  .vc-btn-primary {
    color: #fff;
    padding: 0 22px; height: 40px; font-size: 14px; font-weight: 600;
    background: linear-gradient(135deg, #ff2d8d 0%, #ff4fa1 100%);
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow:
      0 8px 24px rgba(255, 45, 141, 0.24),
      inset 0 1px 0 rgba(255, 255, 255, 0.18);
  }
  .vc-btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow:
      0 16px 40px rgba(255, 45, 141, 0.32),
      0 0 24px rgba(255, 45, 141, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.22);
  }
  .vc-btn-primary:active:not(:disabled) {
    transform: scale(0.97);
    box-shadow:
      0 4px 12px rgba(255, 45, 141, 0.32),
      inset 0 1px 0 rgba(255, 255, 255, 0.18);
  }

  /* Ghost — glass-white sobre dark, border sutil branca */
  .vc-btn-ghost {
    background: var(--bg-glass-strong);
    backdrop-filter: blur(18px) saturate(180%);
    -webkit-backdrop-filter: blur(18px) saturate(180%);
    color: var(--text-secondary);
    border: 1px solid var(--glass-border-strong);
    padding: 0 16px; height: 36px; font-size: 13px; font-weight: 500;
    border-radius: 9999px;
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.10);
  }
  .vc-btn-ghost:hover:not(:disabled) {
    color: var(--text-primary);
    background: var(--bg-glass-deep);
    border-color: rgba(255, 255, 255, 0.28);
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.24),
      inset 0 1px 0 rgba(255, 255, 255, 0.14);
  }
  .vc-btn-ghost:active:not(:disabled) { transform: scale(0.97); }

  /* Botão de ícone — touch target 36px, hover com glass branca sutil */
  .vc-icon-btn {
    background: none; border: none; cursor: pointer; color: var(--text-muted);
    min-width: 36px; min-height: 36px; padding: 8px; border-radius: 10px;
    display: inline-flex; align-items: center; justify-content: center;
    transition: background 0.18s var(--ease-smooth), color 0.18s var(--ease-smooth), transform 0.12s var(--ease-smooth);
    flex-shrink: 0;
  }
  .vc-icon-btn:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.08);
  }
  .vc-icon-btn:active { transform: scale(0.92); }
  .vc-icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  /* Inputs glass — surface translúcida sobre dark + focus halo magenta */
  /* Camada de toque da zona da foto: o input tem de existir e ser clicável, mas o
     controlo nativo (botão + "Nenhum arquivo escolhido") não pode aparecer no card. */
  .vc-photo-hit { color: transparent !important; font-size: 0 !important; }
  .vc-photo-hit::-webkit-file-upload-button { display: none !important; }
  .vc-photo-hit::file-selector-button { display: none !important; }

  .vc-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border-strong);
    border-radius: 9999px; padding: 11px 18px; font-size: 14px;
    color: var(--text-primary); font-family: var(--font-ui);
    letter-spacing: -0.014em;
    font-feature-settings: 'cv11', 'ss01';
    outline: none;
    transition: border-color 0.18s var(--ease-smooth), box-shadow 0.18s var(--ease-smooth), background 0.18s;
    -webkit-appearance: none; appearance: none;
  }
  .vc-input::placeholder { color: var(--text-muted); }
  .vc-input:hover:not(:focus) {
    border-color: rgba(255, 255, 255, 0.28);
    background: rgba(255, 255, 255, 0.08);
  }
  .vc-input:focus {
    border-color: rgba(255, 45, 141, 0.52);
    background: rgba(255, 255, 255, 0.08);
    box-shadow:
      0 0 0 4px rgba(255, 45, 141, 0.10),
      0 8px 24px rgba(255, 45, 141, 0.18);
  }
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
    /* Ambient glow magenta sutil */
    box-shadow: 0 0 8px rgba(255, 45, 141, 0.5);
  }

  /* Tab bar — grelha 3 col. Linhas via gap (última linha incompleta não
     quebra bordas; o seletor nth-last-child(-n+3) removia a linha de
     Texto/Layout quando Marca era o 7.º item). */
  [data-vc-tour="sidebar-tabs"] {
    gap: 1px;
    background: var(--glass-border-strong);
    border-bottom: 1px solid var(--glass-border-strong);
  }
  .tab-bar-item {
    padding: 11px 6px; font-size: 12px; font-weight: 500;
    letter-spacing: -0.014em; text-transform: none;
    font-family: var(--font-ui); cursor: pointer; border: none;
    background: var(--bg-sidebar); display: flex; align-items: center;
    justify-content: center; gap: 6px; position: relative;
    transition: color 0.22s cubic-bezier(0.22, 1, 0.36, 1),
      background 0.22s cubic-bezier(0.22, 1, 0.36, 1);
    outline: none; color: var(--text-muted);
    min-height: 48px;
  }
  .tab-bar-item.active {
    color: #fff; font-weight: 600;
    background: linear-gradient(135deg, rgba(255,45,141,0.22) 0%, rgba(255,45,141,0.08) 100%);
    box-shadow:
      inset 0 0 0 1px rgba(255, 45, 141, 0.45),
      inset 0 0 24px rgba(255, 45, 141, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.10);
  }
  .tab-bar-item.active::after {
    content: ''; position: absolute; bottom: 0; left: 10px; right: 10px;
    height: 2px; background: var(--accent); border-radius: 99px;
    box-shadow: 0 0 12px rgba(255, 45, 141, 0.6);
  }
  .tab-bar-item:hover:not(.active) {
    color: var(--text-primary);
    background: var(--bg-tertiary);
  }
  .tab-bar-item:focus-visible {
    outline: 2px solid var(--accent-focus, var(--accent));
    outline-offset: -2px;
    border-radius: 4px;
  }

  /* Segmented controls / chips de opção — alvo ≥40px, borda sempre visível */
  .vc-seg {
    display: grid;
    gap: 6px;
  }
  .vc-seg-item {
    min-height: 40px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--glass-border-strong);
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-secondary);
    font-family: var(--font-ui);
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: background 0.15s var(--ease-smooth), border-color 0.15s, color 0.15s, transform 0.1s;
  }
  .vc-seg-item:hover:not(:disabled):not([aria-pressed="true"]):not(.active) {
    background: rgba(255, 255, 255, 0.09);
    border-color: rgba(255, 255, 255, 0.32);
    color: var(--text-primary);
  }
  .vc-seg-item[aria-pressed="true"],
  .vc-seg-item.active {
    background: linear-gradient(135deg, #ff2d8d 0%, #ff4fa1 100%);
    border-color: rgba(255, 255, 255, 0.18);
    color: #fff;
    box-shadow: 0 4px 14px rgba(255, 45, 141, 0.28), inset 0 1px 0 rgba(255,255,255,0.16);
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
    /* Dark glass dim — quase preto translúcido + blur intenso */
    background: rgba(5, 4, 10, 0.62);
    backdrop-filter: saturate(170%) blur(32px);
    -webkit-backdrop-filter: saturate(170%) blur(32px);
    display: flex; align-items: flex-end; justify-content: center;
    animation: fadeIn 0.24s var(--ease-smooth);
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  @media (min-width: 640px) {
    .modal-overlay { align-items: center; padding: 16px; }
  }
  .modal-panel {
    /* Glass dark premium — surface translúcida sobre dark */
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%),
      var(--bg-secondary);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border-top: 1px solid var(--glass-border-strong);
    width: 100%;
    max-height: calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 20px);
    overflow-y: auto; -webkit-overflow-scrolling: touch;
    animation: slideUp 0.32s var(--ease-smooth);
    border-top-left-radius: 24px; border-top-right-radius: 24px;
    padding-bottom: max(20px, calc(env(safe-area-inset-bottom, 0px) + 12px));
    color: var(--text-primary);
    /* Sombra multi-layer + ambient glow magenta */
    box-shadow:
      0 -1px 0 rgba(255, 255, 255, 0.10) inset,
      0 -12px 40px rgba(0, 0, 0, 0.42),
      0 -32px 80px rgba(255, 45, 141, 0.12);
  }
  @supports (height: 100svh) {
    .modal-panel {
      max-height: calc(100svh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 16px);
    }
  }
  @media (min-width: 640px) {
    .modal-panel {
      border: 1px solid var(--glass-border-strong);
      border-radius: 24px;
      max-width: 480px; max-height: min(90vh, 900px);
      padding-bottom: 12px;
      animation: modalIn 0.28s var(--ease-smooth);
      /* Float dark com glow magenta multi-layer */
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.10) inset,
        0 24px 60px rgba(0, 0, 0, 0.48),
        0 48px 120px rgba(255, 45, 141, 0.14);
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

  /* Canto inferior direito: no topo-centro os toasts tapavam a tira de
     miniaturas e o topo do card 01 (ver docs/ux-audit-editor-2026-09-16.md). */
  .toast-stack {
    position: fixed; bottom: 76px; right: 16px; left: auto; top: auto;
    z-index: 60; display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
    width: min(420px, calc(100vw - 32px));
    pointer-events: none;
  }
  @media (max-width: 767px) {
    .toast-stack {
      left: 12px; right: 12px; width: auto; align-items: stretch;
      bottom: calc(76px + env(safe-area-inset-bottom, 0px));
    }
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
