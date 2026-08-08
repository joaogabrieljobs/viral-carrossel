// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import { Plus } from 'lucide-react';
import { hydrateBrandTextColors } from './brand-helpers.js';
import { DARK_CREAM } from './slide-design-system.js';

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
      titleInk: DARK_CREAM.title,
      subtitleInk: DARK_CREAM.subtitle,
      bodyInk: DARK_CREAM.body,
      inkMuted: DARK_CREAM.muted,
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

export {
  vcHexToRgb,
  vcNormalizeHex,
  vcRelLuminance01,
  cultureReadableInks,
  brandMatchesPalette,
  BODY_FONTS,
  vcBgPatternDivStyle,
  REFERENCE_PROFILES,
};
