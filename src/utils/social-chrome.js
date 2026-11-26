/**
 * Dispositivos gráficos dos carrosséis → estilos. Função pura, usada pelo
 * editor e pela exportação (mesmo componente). Cores vêm da marca efetiva e
 * do chão do card; nada aqui é CSS livre vindo do modelo.
 *
 * Só recursos que o html2canvas desenha: cor sólida, borda, raio, rotação
 * simples. Sem mix-blend-mode, sem filtros, sem máscaras.
 */
import { labelTemplateWithoutPhoto, localizeLabelTemplate } from './fixed-labels.js';

function hexToRgb(hex) {
  let s = String(hex || '').replace('#', '').trim();
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function luminance(hex) {
  const c = hexToRgb(hex);
  if (!c) return null;
  const ch = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

export function contrastRatio(a, b) {
  const la = luminance(a); const lb = luminance(b);
  if (la == null || lb == null) return 1;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Primeira tinta da lista com contraste ≥ mínimo; senão preto/branco. */
export function readableInk(ground, candidates, min = 4.5) {
  for (const c of candidates.filter(Boolean)) if (contrastRatio(ground, c) >= min) return c;
  return contrastRatio(ground, '#111111') >= contrastRatio(ground, '#FFFFFF') ? '#111111' : '#FFFFFF';
}

function mix(a, b, t) {
  const x = hexToRgb(a); const y = hexToRgb(b);
  if (!x || !y) return a;
  const c = (k) => Math.round(x[k] + (y[k] - x[k]) * t).toString(16).padStart(2, '0');
  return `#${c('r')}${c('g')}${c('b')}`;
}

/**
 * Chão e tintas do card a partir da marca. `inverse` usa a cor do título
 * como fundo; `accent`, a cor de acento — sempre com tinta legível (≥ 4,5:1).
 */
export function socialGround(brand = {}, ground = 'bg') {
  const bg = brand.bg || '#FFFFFF';
  const title = brand.titleColor || '#111111';
  const body = brand.subtitleColor || title;
  const muted = brand.textColor || body;
  const accent = brand.accent || title;
  if (ground === 'inverse' || ground === 'inverseDark') {
    const g = ground === 'inverseDark' ? '#000000' : title;
    const ink = readableInk(g, [bg, '#FFFFFF', '#111111']);
    return { bg: g, ink, body: ink, muted: readableInk(g, [mix(ink, g, 0.25), ink], 4.5), accent: contrastRatio(g, accent) >= 3 ? accent : ink };
  }
  if (ground === 'accent') {
    const ink = readableInk(accent, [bg, title, '#FFFFFF', '#111111']);
    return { bg: accent, ink, body: ink, muted: ink, accent: ink };
  }
  if (ground === 'surface') {
    const g = mix(bg, title, 0.06);
    return { bg: g, ink: readableInk(g, [title]), body: readableInk(g, [body, title]), muted: readableInk(g, [muted, body]), accent };
  }
  return { bg, ink: title, body, muted, accent };
}

/**
 * Força do degradê social v4 sobre a foto (SlideCardInner, socialScrimGradient).
 * `strong` é a opacidade no corpo do texto (cai a 90% no topo dele) e `base`,
 * a do pé do card. `socialScrimMin`, gravado pela composição, é o piso que faz
 * a tinta ler 4,5:1 no pior pixel da foto; sem ele, a conta de sempre.
 */
export const SOCIAL_SCRIM_MAX = 0.9;
export function socialScrimAlphas(slide = {}) {
  const ov = Math.max(0, Math.min(100, Number(slide.overlay) || 0)) / 100;
  const calc = slide.socialArt?.signatureOnPhoto ? 0.86 : Math.min(0.74, Math.max(0.6, ov * 1.1));
  const floor = Math.min(SOCIAL_SCRIM_MAX, Number(slide.socialScrimMin) || 0);
  const strong = Math.max(calc, floor);
  return { strong, base: Math.max(strong, Math.min(0.9, ov * 1.4)) };
}

/** Cinza que o pior pixel da foto (branco) vira sob preto com opacidade a. */
export function scrimSurface(alpha) {
  return mix('#FFFFFF', '#000000', Math.max(0, Math.min(1, alpha)));
}

/**
 * Tinta que lê 4,5:1 sobre a superfície: a própria ou a menor mistura rumo a
 * `toward` (o mesmo matiz, mais claro ou mais escuro). Mesma regra de
 * image-composition.js (inkOver) na apresentação.
 */
export function inkOverSurface(surface, ink, toward = '#FFFFFF', min = 4.5) {
  if (!hexToRgb(ink)) return ink;
  if (contrastRatio(ink, surface) >= min) return ink;
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c = mix(ink, toward, Math.min(1, t));
    if (contrastRatio(c, surface) >= min) return c;
  }
  return toward;
}

/** Menor opacidade da proteção (0–1) com que todas as tintas leem 4,5:1 no pior pixel. */
export function minScrimAlpha(inks = [], min = 4.5) {
  const list = inks.filter((c) => hexToRgb(c));
  for (let a = 0; a <= 100; a += 1) {
    const surface = scrimSurface(a / 100);
    if (list.every((c) => contrastRatio(c, surface) >= min)) return a / 100;
  }
  return 1;
}

/** Tinta de um token de cor para texto sobre a foto (art.photoInks). */
export function photoInkFor(token, photoInks = {}) {
  if (token === 'accent') return photoInks.accent;
  if (token === 'ink') return photoInks.title;
  if (token === 'body' || token === 'muted') return photoInks.body;
  return null;
}

function colorFor(token, inks) {
  if (token === 'ink') return inks.ink;
  if (token === 'body') return inks.body;
  if (token === 'muted') return inks.muted;
  if (token === 'accent') return inks.accent;
  if (token === 'ground') return inks.bg;
  if (token === 'rule') return inks.ink;
  return /^#|^rgb/.test(String(token)) ? token : inks.ink;
}

export function fillSocialTokens(value, tokens = {}) {
  let missing = false;
  const out = String(value).replace(/\{(\w+)(\?)?\}/g, (_, name, optional) => {
    const v = tokens[name];
    if (v == null || String(v).trim() === '') { if (!optional) missing = true; return ''; }
    return String(v);
  }).replace(/(\s·\s)+$/, '').replace(/^(\s·\s)+/, '').trim();
  return missing || !out ? null : out;
}

/**
 * @param {{chrome: object[], ground: string}} art  (slide.socialArt)
 * @param {{ frame:{w:number,h:number}, brand:object, tokens:object, fonts:{title:string, body:string, label?:string}, lang?:string }} ctx
 *   `lang`: idioma do conteúdo, para os rótulos fixos da família ("CENA", "PONTO").
 *   `hasPhoto`: `false` quando o card não tem foto (nem a caminho): o rótulo
 *   de figura dá lugar ao rótulo do card de texto.
 */
export function socialChromeElements(art, { frame, brand, tokens = {}, fonts = {}, lang, hasPhoto = true }) {
  if (!art || !Array.isArray(art.chrome) || !frame) return [];
  const inks = socialGround(brand, art.ground);
  const scale = frame.w / 1080;
  const pct = (v) => `${v}%`;
  // Recuo interno da caixa do título no renderer: dispositivos ancorados ao
  // texto andam junto, para a barra não começar fora da margem do texto.
  const insetPx = Math.max(0, Number(fonts.titleInsetPx) || 0);
  const at = (d, v) => (d.anchor === 'text' && insetPx ? `calc(${pct(v)} + ${insetPx}px)` : pct(v));
  const out = [];
  art.chrome.forEach((d, i) => {
    const key = `${d.t}-${i}`;
    // Dispositivo que só existe com conteúdo da pessoa (oferta, chapéu).
    if (d.requires && !String(tokens[d.requires] || '').trim()) return;
    const zIndex = d.z === 'over' ? 3 : 1;
    // Texto da família direto sobre a foto (chapéu da capa em sangria): a
    // tinta é a que a composição mediu contra a proteção, não a do papel.
    const onPhoto = d.t === 'text' && art.textOnPhoto && art.photoInks && d.z !== 'over';
    const color = onPhoto ? photoInkFor(d.color, art.photoInks) || colorFor(d.color, inks) : colorFor(d.color, inks);
    const opacity = d.color === 'rule' && d.opacity == null ? 0.28 : (d.opacity ?? 1);
    if (opacity === 0) return;
    if (d.t === 'rule' || d.t === 'block') {
      out.push({ key, z: zIndex, style: {
        left: at(d, d.x), top: pct(d.y), width: Math.max(1, (d.w / 100) * frame.w), height: Math.max(1, (d.h / 100) * frame.h),
        background: color, opacity, borderRadius: d.radius ? d.radius * scale : 0,
        transform: d.rotate ? `rotate(${d.rotate}deg)` : undefined,
      } });
    } else if (d.t === 'star' || d.t === 'diamond') {
      // Estrela de 8 pontas = dois quadrados, um girado 45°; losango = um só.
      // Só transformações simples (o html2canvas desenha rotate).
      const size = (d.d / 100) * frame.w;
      const base = { left: `calc(${pct(d.x)} - ${size / 2}px)`, top: `calc(${pct(d.y)} - ${size / 2}px)`, width: size, height: size, background: color, opacity };
      out.push({ key: `${key}-a`, z: zIndex, style: { ...base, transform: d.t === 'diamond' ? 'rotate(45deg) scale(0.72)' : 'rotate(0deg) scale(0.62)' } });
      if (d.t === 'star') out.push({ key: `${key}-b`, z: zIndex, style: { ...base, transform: 'rotate(45deg) scale(0.62)' } });
    } else if (d.t === 'circle') {
      const size = (d.d / 100) * frame.w;
      out.push({ key, z: zIndex, style: { left: pct(d.x), top: pct(d.y), width: size, height: size, borderRadius: '50%', background: color, opacity } });
    } else if (d.t === 'frame') {
      out.push({ key, z: zIndex, style: { left: pct(d.x), top: pct(d.y), width: pct(d.w), height: pct(d.h), border: `${Math.max(1, 1.5 * scale)}px solid ${color}`, opacity: d.color === 'rule' ? 0.35 : opacity } });
    } else if (d.t === 'grid') {
      const m = d.margin ?? 7.5; const colW = (100 - 2 * m) / d.cols; const px = Math.max(1, scale);
      const bands = Array.isArray(d.bands) && d.bands.length ? d.bands : [[0, 100]];
      for (let c = 0; c <= d.cols; c += 1) {
        bands.forEach(([y0, y1], bi) => out.push({ key: `${key}-${c}-${bi}`, z: 0.5, style: { left: pct(m + c * colW), top: pct(y0), width: px, height: pct(y1 - y0), background: color, opacity: d.opacity ?? 0.3 } }));
      }
    } else if (d.t === 'text') {
      const t = fillSocialTokens(localizeLabelTemplate(hasPhoto === false ? labelTemplateWithoutPhoto(d.text) : d.text, lang), tokens);
      if (!t) return;
      const family = d.role === 'title' ? fonts.title : d.role === 'label' ? (fonts.label || fonts.body) : fonts.body;
      out.push({ key, z: zIndex, text: t, style: {
        left: at(d, d.x), top: pct(d.y), width: d.w != null ? pct(d.w) : undefined, textAlign: d.align || 'left',
        fontFamily: family, fontSize: d.size * scale,
        fontWeight: d.weight === 'title' ? (fonts.titleWeight || undefined) : (d.weight || (d.role === 'title' ? undefined : 500)),
        transform: d.rotate ? `rotate(${d.rotate}deg)` : undefined, transformOrigin: 'left top',
        fontStyle: d.italic ? 'italic' : 'normal', lineHeight: d.leading || 1.15,
        letterSpacing: d.tracking ? `${d.tracking / 100}em` : undefined, textTransform: d.case === 'upper' ? 'uppercase' : undefined,
        color, opacity, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSynthesis: 'none',
      } });
    }
  });
  return out;
}

export function socialChromeTokens(brand = {}, { index = 0, total = 1, slide = null } = {}) {
  const pad = (n) => String(n).padStart(2, '0');
  const name = String(brand.name || '').trim();
  // Conteúdo escrito pela pessoa no card; texto de amostra do preset não conta.
  const real = (v) => { const t = String(v || '').trim(); return t && !SAMPLE.test(t) ? t : ''; };
  const oferta = [real(slide?.strikethroughText), real(slide?.afterTitleText)].filter(Boolean).join('  ');
  return { n: pad(index + 1), total: pad(total), marca: name, eyebrow: real(slide?.eyebrowText), oferta };
}
const SAMPLE = /^(O RESULTADO EM UMA LINHA|DE R\$\s*0+|POR R\$\s*0+.*|.*SUA OFERTA.*)$/i;
