/**
 * 12 padrões visuais para carrosséis virais — extraídos de referências reais
 * (NBA news, case studies neon, editorial magazine, luxury, viral hype, etc).
 *
 * Cada preset define APENAS overrides de marca: cores, fontes (índices em
 * TITLE_FONTS/BODY_FONTS do ViralCarrossel.jsx), e tipografia. NÃO altera
 * modo narrativo (creativePreset) nem layout dos slides — usuário continua
 * livre pra escolher. Aplicação: merge no brand antes da geração.
 *
 * Cada preset traz `previewSvg(size)` que renderiza uma mini-card 60×75
 * representando a "assinatura visual" do estilo (cores + tipografia + accent).
 */

import React from 'react';

// Índices em TITLE_FONTS e BODY_FONTS (referência rápida — ver ViralCarrossel.jsx)
//
// TITLE_FONTS:
//   0 Outfit · 1 Inter Tight · 2 Inter · 3 Space Grotesk · 4 DM Sans
//   5 Manrope · 6 Sora · 7 Plus Jakarta · 8 Familjen · 9 Bricolage
//   10 Funnel · 11 Bebas Neue · 12 Anton · 13 Oswald · 14 Archivo Black
//   15 Big Shoulders · 16 Syne · 17 Unbounded · 18 Playfair · 19 Fraunces
//   20 Cormorant · 21 EB Garamond · 22 Spectral · 23 Yeseva · 24 Italiana
//   25 Caslon · 26 Instrument · 27 Major Mono
//
// BODY_FONTS:
//   0 Inter Tight · 1 Inter · 2 DM Sans · ...

// ───────────────────────────────────────────────────────────────────────────
// Helpers para SVG previews — cada preset reusa esses primitivos pra
// manter consistência visual entre as 12 minis.
// ───────────────────────────────────────────────────────────────────────────

/** Cartão base do preview — bg color + clip path. Children desenham por cima. */
function PreviewCard({ bg, children, gradient = null }) {
  return (
    <svg viewBox="0 0 60 75" width="60" height="75" style={{ display:'block', borderRadius:6, overflow:'hidden' }}>
      <rect width="60" height="75" fill={gradient || bg} />
      {children}
    </svg>
  );
}

/** Texto fake usando rects — simula linhas de título sem renderizar texto real. */
function TextLines({ y, color, count = 2, widths = [50, 35], height = 4, gap = 1, x = 5 }) {
  return widths.slice(0, count).map((w, i) => (
    <rect
      key={i}
      x={x}
      y={y + i * (height + gap)}
      width={w}
      height={height}
      fill={color}
      rx={1}
    />
  ));
}

// ───────────────────────────────────────────────────────────────────────────
// 12 PRESETS
// ───────────────────────────────────────────────────────────────────────────

// Atalhos pra os font-families mais usados — strings completas que
// brand.titleFont/bodyFont esperam (não índices!). Cada string bate
// com TITLE_FONTS[n].val / BODY_FONTS[n].val do ViralCarrossel.jsx.
const FF = {
  // Sans
  outfit:       '"Outfit", sans-serif',
  interTight:   '"Inter Tight", sans-serif',
  inter:        '"Inter", sans-serif',
  spaceGrotesk: '"Space Grotesk", sans-serif',
  dmSans:       '"DM Sans", sans-serif',
  // Display (impacto)
  bebas:        '"Bebas Neue", sans-serif',
  anton:        '"Anton", sans-serif',
  archivoBlack: '"Archivo Black", sans-serif',
  bigShoulders: '"Big Shoulders Display", sans-serif',
  // Serif
  playfair:     '"Playfair Display", serif',
  yeseva:       '"Yeseva One", serif',
  italiana:     '"Italiana", serif',
};

export const VISUAL_PRESETS = [
  // 1. Sports Editorial — NBA-style: foto BG + sans bold branco + header bar
  {
    id: 'sports_editorial',
    label: 'Sports Editorial',
    desc: 'Sans bold branco · header bar com page-num · estilo notícia esportiva',
    brand: {
      bg: '#0a0a0a',
      titleColor: '#ffffff',
      subtitleColor: '#e8e8e8',
      textColor: '#cfcfcf',
      accent: '#ff5736',
      titleFont: FF.archivoBlack,
      bodyFont: FF.interTight,
      textTitleWeight: 800,
      textTitleCase: 'upper',
      textTitleTracking: -10,
      textTitleLeading: 95,
      textSubLeading: 140,
    },
    preview: () => (
      <PreviewCard bg="#0a0a0a">
        {/* header bar com 3 colunas */}
        <rect x="3" y="3" width="14" height="2" fill="#cfcfcf" />
        <rect x="22" y="3" width="14" height="2" fill="#cfcfcf" />
        <rect x="46" y="2" width="10" height="4" fill="#2a2a2a" rx="2" />
        <rect x="48" y="3" width="6" height="2" fill="#cfcfcf" />
        {/* "foto" abstrata */}
        <rect x="0" y="9" width="60" height="40" fill="#3a3a3a" />
        {/* título bold */}
        <TextLines y={52} color="#ffffff" count={3} widths={[52, 48, 38]} height={5} gap={1} x={4} />
      </PreviewCard>
    ),
  },

  // 2. Case Study Neon — pill CTA neon-green + estrela ornament + foto BG
  {
    id: 'case_study_neon',
    label: 'Case Study Neon',
    desc: 'Editorial com pill verde-neon de CTA · ornament estrela',
    brand: {
      bg: '#0c0c10',
      titleColor: '#ffffff',
      subtitleColor: '#e8e8e8',
      textColor: '#cfcfcf',
      accent: '#c0ff32',
      titleFont: FF.interTight,
      bodyFont: FF.interTight,
      textTitleWeight: 800,
      textTitleCase: 'upper',
      textTitleTracking: -8,
      textTitleLeading: 100,
      textSubLeading: 145,
    },
    preview: () => (
      <PreviewCard bg="#0c0c10">
        <rect x="3" y="3" width="11" height="2" fill="#9d9d9d" />
        <rect x="40" y="3" width="14" height="2" fill="#9d9d9d" />
        <rect x="0" y="9" width="60" height="38" fill="#3a3640" />
        {/* estrela neon-green */}
        <circle cx="30" cy="48" r="1.8" fill="#c0ff32" />
        <TextLines y={52} color="#ffffff" count={2} widths={[48, 42]} height={4} gap={1.5} x={6} />
        {/* pill CTA */}
        <rect x="14" y="65" width="32" height="6" fill="#c0ff32" rx="3" />
        <rect x="40" y="67" width="3" height="2" fill="#0c0c10" />
      </PreviewCard>
    ),
  },

  // 3. Mood Sépia — texto amarelo cream centralizado, foto BG escura, pill hashtag
  {
    id: 'mood_sepia',
    label: 'Mood Sépia',
    desc: 'Cream sobre BG escuro · texto centralizado · pill com hashtag',
    brand: {
      bg: '#1a1612',
      titleColor: '#fff5d1',
      subtitleColor: '#e8d8a8',
      textColor: '#d4c290',
      accent: '#fbbf24',
      titleFont: FF.archivoBlack,
      bodyFont: FF.interTight,
      textTitleWeight: 800,
      textTitleCase: 'upper',
      textTitleTracking: -5,
      textTitleLeading: 105,
      textSubLeading: 145,
    },
    preview: () => (
      <PreviewCard bg="#1a1612">
        <rect x="0" y="0" width="60" height="50" fill="#2a2218" />
        {/* "luzes" abstratas */}
        <circle cx="12" cy="22" r="1.2" fill="#fbbf24" opacity="0.6" />
        <circle cx="44" cy="18" r="1" fill="#fbbf24" opacity="0.5" />
        <circle cx="50" cy="30" r="0.8" fill="#fbbf24" opacity="0.4" />
        <TextLines y={42} color="#fff5d1" count={2} widths={[36, 42]} height={5} gap={1} x={9} />
        {/* pill hashtag */}
        <rect x="20" y="60" width="20" height="5" fill="#3a3024" stroke="#fbbf24" strokeWidth="0.4" rx="2.5" />
        <rect x="24" y="62" width="12" height="1.5" fill="#fbbf24" />
      </PreviewCard>
    ),
  },

  // 4. Bold Promo Rosa — display branco + strikethrough vermelho, bg pink
  {
    id: 'bold_promo_rosa',
    label: 'Bold Promo Rosa',
    desc: 'Display branco bold sobre rosa · strikethrough vermelho pra oferta',
    brand: {
      bg: '#ec4899',
      titleColor: '#ffffff',
      subtitleColor: '#fce7f3',
      textColor: '#fbcfe8',
      accent: '#dc2626',
      titleFont: FF.anton,
      bodyFont: FF.interTight,
      textTitleWeight: 700,
      textTitleCase: 'upper',
      textTitleTracking: -8,
      textTitleLeading: 100,
      textSubLeading: 140,
    },
    preview: () => (
      <PreviewCard bg="#ec4899" gradient="linear-gradient(180deg, #f472b6 0%, #ec4899 70%, #be185d 100%)">
        <rect x="0" y="0" width="60" height="50" fill="#be185d" opacity="0.5" />
        {/* silhueta de pessoa */}
        <circle cx="30" cy="20" r="9" fill="#9d174d" opacity="0.7" />
        <rect x="22" y="28" width="16" height="18" fill="#9d174d" opacity="0.7" rx="2" />
        <TextLines y={50} color="#ffffff" count={3} widths={[52, 48, 38]} height={4} gap={1} x={4} />
        {/* strikethrough */}
        <rect x="6" y="68" width="18" height="2" fill="#fff" opacity="0.6" />
        <line x1="6" y1="69" x2="24" y2="69" stroke="#dc2626" strokeWidth="0.6" />
        <rect x="26" y="68" width="22" height="2" fill="#fff" />
      </PreviewCard>
    ),
  },

  // 5. Reflexivo Cream — texto cream + pill com handle, BG sépia escuro
  {
    id: 'reflexivo_cream',
    label: 'Reflexivo Cream',
    desc: 'Cream sépia · pill com @handle no rodapé · tom contemplativo',
    brand: {
      bg: '#3e3527',
      titleColor: '#f5e8d0',
      subtitleColor: '#d4c19a',
      textColor: '#b8a685',
      accent: '#fbbf24',
      titleFont: FF.bebas,
      bodyFont: FF.inter,
      textTitleWeight: 700,
      textTitleCase: 'upper',
      textTitleTracking: 5,
      textTitleLeading: 95,
      textSubLeading: 145,
    },
    preview: () => (
      <PreviewCard bg="#3e3527">
        {/* eyebrow */}
        <rect x="3" y="3" width="12" height="2" fill="#8d7d62" />
        <rect x="40" y="3" width="14" height="2" fill="#8d7d62" />
        {/* foto */}
        <rect x="0" y="9" width="60" height="48" fill="#5a4d36" />
        <circle cx="30" cy="32" r="8" fill="#8d7d62" opacity="0.6" />
        <TextLines y={50} color="#f5e8d0" count={2} widths={[40, 50]} height={4} gap={1} x={5} />
        {/* pill com handle */}
        <rect x="16" y="65" width="28" height="6" fill="#8d7d62" rx="3" opacity="0.4" />
        <rect x="20" y="67" width="20" height="2" fill="#f5e8d0" />
      </PreviewCard>
    ),
  },

  // 6. Tabloid Keywords — sans branco com palavras-chave verde-menta
  {
    id: 'tabloid_keywords',
    label: 'Tabloid Keywords',
    desc: 'Sans branco · palavras-chave em verde-menta · vibe noticiário',
    brand: {
      bg: '#0a0a0a',
      titleColor: '#ffffff',
      subtitleColor: '#e8e8e8',
      textColor: '#cfcfcf',
      accent: '#34d399',
      titleFont: FF.anton,
      bodyFont: FF.interTight,
      textTitleWeight: 800,
      textTitleCase: 'upper',
      textTitleTracking: -6,
      textTitleLeading: 100,
      textSubLeading: 140,
    },
    preview: () => (
      <PreviewCard bg="#0a0a0a">
        <rect x="3" y="3" width="18" height="2" fill="#9d9d9d" />
        <rect x="38" y="3" width="14" height="2" fill="#9d9d9d" />
        <circle cx="8" cy="11" r="3" fill="#34d399" />
        <text x="6.5" y="13" fontSize="3.5" fill="#0a0a0a" fontWeight="900">E</text>
        {/* foto */}
        <rect x="0" y="17" width="60" height="32" fill="#2a2a2a" />
        {/* título com palavras coloridas */}
        <rect x="4" y="52" width="20" height="4" fill="#ffffff" rx="0.5" />
        <rect x="26" y="52" width="14" height="4" fill="#34d399" rx="0.5" />
        <rect x="4" y="57" width="18" height="4" fill="#34d399" rx="0.5" />
        <rect x="24" y="57" width="20" height="4" fill="#ffffff" rx="0.5" />
        {/* pill verde no rodapé */}
        <rect x="14" y="67" width="32" height="5" fill="#34d399" rx="2.5" />
      </PreviewCard>
    ),
  },

  // 7. Editorial Magazine — serif elegante + sans, contagem de likes
  {
    id: 'editorial_magazine',
    label: 'Editorial Magazine',
    desc: 'Serifa elegante + sans condensed · estilo capa de revista',
    brand: {
      bg: '#1e3a5f',
      titleColor: '#ffffff',
      subtitleColor: '#e8e8e8',
      textColor: '#cfcfcf',
      accent: '#dc2626',
      titleFont: FF.playfair,
      bodyFont: FF.dmSans,
      textTitleWeight: 700,
      textTitleCase: 'normal',
      textTitleTracking: -8,
      textTitleLeading: 100,
      textSubLeading: 140,
    },
    preview: () => (
      <PreviewCard bg="#1e3a5f" gradient="linear-gradient(180deg, #2a4870 0%, #1e3a5f 100%)">
        {/* título serif centralizado em cima */}
        <rect x="10" y="9" width="40" height="4" fill="#ffffff" rx="0.5" />
        <rect x="6" y="15" width="48" height="6" fill="#ffffff" rx="1" />
        <rect x="18" y="24" width="24" height="2" fill="#ffffff" opacity="0.7" />
        {/* "pessoa" */}
        <circle cx="30" cy="44" r="9" fill="#cd5050" opacity="0.65" />
        <rect x="22" y="50" width="16" height="20" fill="#cd5050" opacity="0.65" rx="2" />
        {/* likes counter */}
        <circle cx="55" cy="46" r="1.5" fill="#ffffff" />
        <rect x="53" y="50" width="4" height="1.5" fill="#ffffff" />
        <circle cx="55" cy="56" r="1.5" fill="none" stroke="#ffffff" strokeWidth="0.5" />
      </PreviewCard>
    ),
  },

  // 8. Luxury Hybrid — display sans + serifa script dourada
  {
    id: 'luxury_hybrid',
    label: 'Luxury Hybrid',
    desc: 'Sans + serifa script dourada · vibe luxo premium',
    brand: {
      bg: '#3e2418',
      titleColor: '#ffffff',
      subtitleColor: '#f5e8d0',
      textColor: '#d4c19a',
      accent: '#d4af37',
      titleFont: FF.bebas,
      bodyFont: FF.interTight,
      textTitleWeight: 800,
      textTitleCase: 'upper',
      textTitleTracking: -3,
      textTitleLeading: 100,
      textSubLeading: 145,
    },
    preview: () => (
      <PreviewCard bg="#3e2418">
        {/* textura "7" grande de fundo */}
        <text x="6" y="35" fontSize="35" fill="#5a3424" fontWeight="900" opacity="0.5">7</text>
        {/* título sans bold */}
        <rect x="4" y="14" width="44" height="4" fill="#ffffff" rx="0.5" />
        <rect x="4" y="20" width="38" height="4" fill="#ffffff" rx="0.5" />
        {/* script dourada — simula com texto italic */}
        <text x="8" y="36" fontSize="9" fill="#d4af37" fontStyle="italic" fontWeight="700">na</text>
        <text x="18" y="37" fontSize="11" fill="#d4af37" fontStyle="italic" fontWeight="700">GR</text>
        <rect x="4" y="42" width="36" height="2" fill="#d4c19a" />
        {/* produto */}
        <rect x="8" y="52" width="14" height="14" fill="#5a3424" rx="2" />
        <circle cx="36" cy="60" r="3" fill="#aaff00" opacity="0.7" />
        <circle cx="44" cy="62" r="3" fill="#aaff00" opacity="0.7" />
        <circle cx="40" cy="68" r="3" fill="#aaff00" opacity="0.7" />
      </PreviewCard>
    ),
  },

  // 9. Viral Hype Dark — display branco + accent vermelho, BG dramático
  {
    id: 'viral_hype_dark',
    label: 'Viral Hype Dark',
    desc: 'Display branco bombástico · accent vermelho · "ARRASTA →"',
    brand: {
      bg: '#0a0a0a',
      titleColor: '#ffffff',
      subtitleColor: '#e8e8e8',
      textColor: '#cfcfcf',
      accent: '#ef4444',
      titleFont: FF.archivoBlack,
      bodyFont: FF.interTight,
      textTitleWeight: 800,
      textTitleCase: 'upper',
      textTitleTracking: -10,
      textTitleLeading: 95,
      textSubLeading: 140,
    },
    preview: () => (
      <PreviewCard bg="#0a0a0a">
        {/* page badges canto */}
        <rect x="3" y="3" width="6" height="5" fill="#2a2a2a" rx="1" />
        <rect x="51" y="3" width="6" height="5" fill="#2a2a2a" rx="1" />
        {/* foto dramática vermelha */}
        <rect x="0" y="11" width="60" height="40" fill="#2a0a0a" />
        <circle cx="22" cy="28" r="6" fill="#ef4444" opacity="0.6" />
        <rect x="14" y="32" width="22" height="14" fill="#ef4444" opacity="0.4" rx="2" />
        {/* título BIG */}
        <TextLines y={54} color="#ffffff" count={3} widths={[52, 48, 30]} height={4} gap={1} x={4} />
        {/* "ARRASTA PRO LADO →" */}
        <rect x="14" y="69" width="22" height="1.5" fill="#9d9d9d" />
        <rect x="38" y="69" width="3" height="1.5" fill="#9d9d9d" />
      </PreviewCard>
    ),
  },

  // 10. Cinematic Hybrid — sans + serifa cursive vermelha
  {
    id: 'cinematic_hybrid',
    label: 'Cinematic Hybrid',
    desc: 'Sans "como" + serifa cursiva vermelha · vibe cinema noir',
    brand: {
      bg: '#0c1018',
      titleColor: '#ffffff',
      subtitleColor: '#e8e8e8',
      textColor: '#cfcfcf',
      accent: '#dc2626',
      titleFont: FF.outfit,
      bodyFont: FF.inter,
      textTitleWeight: 600,
      textTitleCase: 'lower',
      textTitleTracking: -5,
      textTitleLeading: 105,
      textSubLeading: 145,
    },
    preview: () => (
      <PreviewCard bg="#0c1018">
        {/* BG cinema */}
        <rect x="0" y="0" width="60" height="60" fill="#1a1f28" />
        <rect x="4" y="6" width="3" height="8" fill="#22c55e" opacity="0.7" />
        <rect x="8" y="4" width="3" height="10" fill="#22c55e" opacity="0.5" />
        {/* pessoa */}
        <circle cx="36" cy="26" r="6" fill="#3a3024" opacity="0.7" />
        <rect x="28" y="30" width="16" height="20" fill="#2a2118" opacity="0.7" rx="2" />
        {/* texto misto */}
        <rect x="6" y="54" width="14" height="2.5" fill="#ffffff" />
        <text x="6" y="66" fontSize="11" fill="#dc2626" fontStyle="italic" fontWeight="700">Gera</text>
        <text x="36" y="66" fontSize="11" fill="#dc2626" fontStyle="italic" fontWeight="700">r</text>
        <rect x="20" y="70" width="20" height="2" fill="#ffffff" opacity="0.6" />
      </PreviewCard>
    ),
  },

  // 11. Authority Black — display gigante + footer 3 colunas
  {
    id: 'authority_black',
    label: 'Authority Black',
    desc: 'Display branco gigante · footer 3 colunas · vibe documentário',
    brand: {
      bg: '#0a0a0a',
      titleColor: '#ffffff',
      subtitleColor: '#e8e8e8',
      textColor: '#cfcfcf',
      accent: '#dc2626',
      titleFont: FF.archivoBlack,
      bodyFont: FF.interTight,
      textTitleWeight: 800,
      textTitleCase: 'upper',
      textTitleTracking: -8,
      textTitleLeading: 95,
      textSubLeading: 145,
    },
    preview: () => (
      <PreviewCard bg="#0a0a0a">
        {/* header centro */}
        <rect x="20" y="4" width="20" height="2" fill="#9d9d9d" />
        {/* "estátua" vermelha */}
        <rect x="0" y="9" width="60" height="46" fill="#0a0a0a" />
        <ellipse cx="30" cy="22" rx="10" ry="13" fill="#dc2626" opacity="0.75" />
        <rect x="20" y="32" width="20" height="20" fill="#dc2626" opacity="0.5" />
        {/* título */}
        <TextLines y={43} color="#ffffff" count={2} widths={[44, 50]} height={4} gap={1} x={5} />
        {/* footer 3 colunas */}
        <rect x="4"  y="68" width="12" height="1.5" fill="#9d9d9d" />
        <rect x="4"  y="71" width="14" height="1.5" fill="#ffffff" />
        <rect x="22" y="68" width="16" height="1.5" fill="#9d9d9d" />
        <rect x="22" y="71" width="14" height="1.5" fill="#ffffff" />
        <rect x="44" y="68" width="12" height="1.5" fill="#9d9d9d" />
        <rect x="44" y="71" width="14" height="1.5" fill="#ffffff" />
      </PreviewCard>
    ),
  },

  // 12. Minimal Clean — sem foto, fundo limpo, tipografia centrada
  {
    id: 'minimal_clean',
    label: 'Minimal Clean',
    desc: 'Sem foto · fundo creme · tipografia centrada · vibe Apple',
    brand: {
      bg: '#fafaf6',
      titleColor: '#0a0a0a',
      subtitleColor: '#3a3a3a',
      textColor: '#5a5a5a',
      accent: '#1a1a1a',
      titleFont: FF.interTight,
      bodyFont: FF.interTight,
      textTitleWeight: 700,
      textTitleCase: 'normal',
      textTitleTracking: -10,
      textTitleLeading: 105,
      textSubLeading: 150,
    },
    preview: () => (
      <PreviewCard bg="#fafaf6">
        {/* eyebrow pequeno */}
        <rect x="22" y="14" width="16" height="2" fill="#9d9d9d" rx="0.5" />
        {/* título centrado */}
        <rect x="8" y="22" width="44" height="4" fill="#0a0a0a" rx="0.5" />
        <rect x="14" y="28" width="32" height="4" fill="#0a0a0a" rx="0.5" />
        {/* subtítulo */}
        <rect x="14" y="40" width="32" height="2" fill="#5a5a5a" rx="0.5" />
        <rect x="16" y="44" width="28" height="2" fill="#5a5a5a" rx="0.5" />
        {/* dot accent */}
        <circle cx="30" cy="58" r="1.5" fill="#1a1a1a" />
        {/* footer text */}
        <rect x="22" y="68" width="16" height="1.5" fill="#9d9d9d" />
      </PreviewCard>
    ),
  },
];

export const VISUAL_PRESET_BY_ID = Object.fromEntries(VISUAL_PRESETS.map(p => [p.id, p]));

/**
 * Aplica um preset visual ao objeto brand. Retorna NOVO brand (não muta).
 * Campos não definidos no preset preservam valores atuais do brand.
 *
 * Uso: `setBrand(applyVisualPreset(brand, 'sports_editorial'))`
 */
export function applyVisualPreset(brand, presetId) {
  const preset = VISUAL_PRESET_BY_ID[presetId];
  if (!preset) return brand;
  return { ...brand, ...preset.brand };
}
