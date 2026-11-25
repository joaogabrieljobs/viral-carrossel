/**
 * Linguagem gráfica das famílias como dados → estilos.
 *
 * Função pura: recebe os dispositivos declarados em presentation-families.js
 * e devolve elementos { key, z, style, text } prontos para React (preview e
 * exportação) ou para o DOM da galeria. Nenhum texto do usuário é inventado:
 * os únicos textos são numerais de página/seção e tokens vindos do slide
 * (eyebrow, legenda da foto). Token vazio remove o dispositivo inteiro.
 */
import { FORMAT_SPECS, familyFont, familySpec, groundInks } from './presentation-families.js';
import { localizeLabelTemplate } from './fixed-labels.js';

const pct = (value) => `${value}%`;

export function resolveChromeColor(familyKey, ground, token, overrides = {}) {
  const p = { ...familySpec(familyKey).palette, ...(overrides || {}) };
  const inks = groundInks(familyKey, ground, overrides);
  if (token === 'ink') return inks.ink;
  if (token === 'muted') return inks.muted;
  if (token === 'rule') return ground === 'bg' || ground === 'surface' ? p.rule : inks.muted;
  if (token === 'inverse') return p.inverse;
  if (token === 'inverseInk') return p.inverseInk;
  if (token === 'ground') return inks.bg;
  if (p[token]) return p[token];
  return /^#|^rgb/.test(String(token)) ? token : inks.ink;
}

export function fillChromeTokens(text, tokens = {}) {
  let missing = false;
  // {nome} é obrigatório; {nome?} é opcional e some com o separador ' · '.
  const out = String(text).replace(/\{(\w+)(\?)?\}/g, (_, name, optional) => {
    const value = tokens[name];
    if (value === undefined || value === null || String(value).trim() === '') { if (!optional) missing = true; return ''; }
    return String(value);
  }).replace(/(\s·\s)+$/, '').replace(/^(\s·\s)+/, '');
  return missing ? null : out;
}

/**
 * @param {object} layout resultado de familyLayout
 * @param {{ frame: {w:number,h:number}, tokens?: object, lang?: string }} ctx
 *   `lang`: idioma do conteúdo, para o rótulo fixo da família ("CENA").
 */
export function chromeElements(layout, { frame, tokens = {}, overrides = {}, lang } = {}) {
  if (!layout || !frame) return [];
  const family = layout.family;
  const ground = layout.ground || 'bg';
  const ref = FORMAT_SPECS[layout.format] || FORMAT_SPECS['16:9'];
  const scale = frame.w / ref.w;
  const color = (token) => resolveChromeColor(family, ground, token, overrides);
  const out = [];
  if (ground !== 'bg') {
    out.push({ key: 'ground', z: 0, style: { left: 0, top: 0, width: '100%', height: '100%', background: groundInks(family, ground, overrides).bg } });
  }
  (layout.chrome || []).forEach((d, i) => {
    const key = `${d.t}-${i}`;
    const z = d.z === 'over' ? 3 : 1;
    if (d.t === 'rule' || d.t === 'block') {
      // Espessuras em % viram px mínimos de 1 para não sumirem em miniaturas.
      const hPx = Math.max(1, (d.h / 100) * frame.h);
      const wPx = Math.max(1, (d.w / 100) * frame.w);
      out.push({ key, z, style: {
        left: pct(d.x), top: pct(d.y), width: `${wPx}px`, height: `${hPx}px`,
        background: color(d.color), opacity: d.opacity ?? 1,
        borderRadius: d.radius ? d.radius * scale : 0,
        transform: d.rotate ? `rotate(${d.rotate}deg)` : undefined,
        mixBlendMode: d.blend || undefined,
      } });
    } else if (d.t === 'circle') {
      const size = (d.d / 100) * frame.w;
      out.push({ key, z, style: { left: pct(d.x), top: pct(d.y), width: size, height: size, borderRadius: '50%', background: color(d.color), opacity: d.opacity ?? 1 } });
    } else if (d.t === 'frame') {
      out.push({ key, z, style: { left: pct(d.x), top: pct(d.y), width: pct(d.w), height: pct(d.h), border: `${Math.max(1, scale * 1.5)}px solid ${color(d.color)}` } });
    } else if (d.t === 'grid') {
      const m = d.margin ?? 4;
      const colW = (100 - m * 2) / d.cols;
      const line = color(d.color);
      const px = Math.max(1, scale);
      const cols = Array.from({ length: d.cols + 1 }, (_, c) => `linear-gradient(${line},${line}) ${m + c * colW}% 0 / ${px}px 100% no-repeat`);
      const rows = d.rows ? Array.from({ length: 7 }, (_, r) => `linear-gradient(${line},${line}) 0 ${(r / 6) * 100}% / 100% ${px}px no-repeat`) : [];
      out.push({ key, z: 0.5, style: { left: 0, top: 0, width: '100%', height: '100%', background: [...cols, ...rows].join(','), opacity: d.opacity ?? 0.5 } });
    } else if (d.t === 'crop') {
      const len = 1.6; const gap = 0.8; const c = color(d.color); const t = Math.max(1, scale * 1.5);
      const xs = [d.x, d.x + d.w]; const ys = [d.y, d.y + d.h];
      xs.forEach((x, xi) => ys.forEach((y, yi) => {
        const dx = xi ? 1 : -1; const dy = yi ? 1 : -1;
        out.push({ key: `${key}-h${xi}${yi}`, z: 3, style: { left: pct(dx > 0 ? x + gap : x - gap - len), top: pct(y), width: pct(len), height: t, background: c } });
        const lenY = len * frame.w / frame.h; const gapY = gap * frame.w / frame.h;
        out.push({ key: `${key}-v${xi}${yi}`, z: 3, style: { left: pct(x), top: pct(dy > 0 ? y + gapY : y - gapY - lenY), width: t, height: pct(lenY), background: c } });
      }));
    } else if (d.t === 'dim') {
      const c = color(d.color); const t = Math.max(1, scale);
      out.push({ key, z: 1, style: { left: pct(d.x), top: pct(d.y), width: pct(d.w), height: t, background: c } });
      out.push({ key: `${key}-a`, z: 1, style: { left: pct(d.x), top: `calc(${d.y}% - ${8 * scale}px)`, width: t, height: 16 * scale, background: c } });
      out.push({ key: `${key}-b`, z: 1, style: { left: `calc(${d.x + d.w}% - ${t}px)`, top: `calc(${d.y}% - ${8 * scale}px)`, width: t, height: 16 * scale, background: c } });
    } else if (d.t === 'text' || d.t === 'pill') {
      const text = fillChromeTokens(localizeLabelTemplate(d.text, lang), tokens);
      if (text === null || !text.trim()) return;
      const role = d.role === 'numeric' ? 'numeric' : d.role === 'display' ? 'display' : d.role === 'text' ? 'text' : 'label';
      // Modo livre: numerais e rótulos com o par de fontes do deck.
      const f = (layout.fonts && (role === 'numeric' || role === 'display' ? layout.fonts.display : layout.fonts.text))
        || familyFont(family, role);
      const size = d.size * scale;
      const style = {
        left: pct(d.x), top: pct(d.y), fontFamily: f.css, fontSize: size,
        fontWeight: d.weight || (d.role === 'display' ? f.weight : d.role === 'numeric' ? (f.weight || 500) : 500),
        fontStyle: d.italic ? 'italic' : 'normal', lineHeight: d.leading || 1.2,
        letterSpacing: d.tracking ? `${d.tracking / 100}em` : f.tracking ? `${f.tracking / 100}em` : 0,
        textTransform: d.case === 'upper' ? 'uppercase' : undefined,
        color: d.t === 'pill' ? color(d.ink || 'inverseInk') : color(d.color), opacity: d.opacity ?? 1,
        // Sem algarismos tabulares: o html2canvas desenha o algarismo padrão na
        // posição do tabular e o "1" ficava solto ("1 0") no arquivo.
        whiteSpace: 'nowrap', fontSynthesis: 'none',
      };
      if (d.t === 'pill') Object.assign(style, { background: color(d.color), padding: `${size * 0.35}px ${size * 0.8}px`, borderRadius: size * 2 });
      if (d.w != null && d.t !== 'pill') Object.assign(style, { width: pct(d.w), textAlign: d.align || 'left', whiteSpace: 'nowrap', overflow: 'visible' });
      out.push({ key, z: d.z === 'over' ? 3 : 1, text, style });
    }
  });
  return out;
}

/** Tokens a partir do slide e da posição na sequência. Nada é inventado. */
export function chromeTokensForSlide(slide = {}, { index = 0, total = 1, section } = {}) {
  const pad = (n) => String(n).padStart(2, '0');
  return {
    index: pad(index + 1),
    total: pad(total),
    section: pad(section ?? slide.presentationSectionIndex ?? index + 1),
    kicker: slide.eyebrow || slide.presentationKicker || '',
    caption: slide.photoCaption || slide.imageCaption || '',
  };
}
