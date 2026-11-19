/**
 * Renderer de referência da galeria (DOM puro).
 *
 * Usa exatamente as mesmas funções do app — familyLayout, chromeElements,
 * familyEvidenceStyle — e reproduz o modelo do SlideCardInner: zonas
 * absolutas, foto em `cover` dentro da zona, scrim por gradiente, título e
 * apoio em zonas próprias com redução controlada (nunca corte de palavra).
 * Não substitui o renderer React; serve para revisar a direção de arte com
 * os mesmos dados de geometria e tipo.
 */
import { FORMAT_SPECS, familyFont, familyLayout, familyEvidenceStyle, familySpec, familyPhotoFilter } from '../../src/utils/presentation-families.js';
import { chromeElements, chromeTokensForSlide } from '../../src/utils/presentation-chrome.js';

const el = (tag, style = {}, text) => {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text != null) node.textContent = text;
  return node;
};

/** **negrito** pontual → <strong>, como os destaques do app. */
function richText(node, text, strongStyle = {}) {
  String(text || '').split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) node.appendChild(el('strong', { fontWeight: 600, ...strongStyle }, part.slice(2, -2)));
    else if (part) node.appendChild(document.createTextNode(part));
  });
  return node;
}

const box = (r) => ({ position: 'absolute', left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`, boxSizing: 'border-box' });
const FLEX = { start: 'flex-start', center: 'center', end: 'flex-end' };

const PENDING = [];
export function runFits() {
  while (PENDING.length) { const [c, i, floor] = PENDING.shift(); if (c.isConnected) fit(c, i, floor); }
}

/** Mesmo princípio do OverflowScaler: reduz em passos até caber, com piso. */
function fit(container, inner, floor = 0.6) {
  let scale = 1;
  const base = [...inner.querySelectorAll('[data-fs]')].map((n) => [n, Number(n.dataset.fs)]);
  const apply = () => base.forEach(([n, fs]) => { n.style.fontSize = `${fs * scale}px`; });
  apply();
  while (scale > floor && (inner.scrollHeight > container.clientHeight + 1 || inner.scrollWidth > container.clientWidth + 1)) {
    scale = Math.round((scale - 0.04) * 100) / 100; apply();
  }
  container.dataset.fitScale = String(scale);
  // No piso e ainda sem caber: a revisão do app pede divisão da página.
  if (inner.scrollHeight > container.clientHeight + 1) {
    const slide = container.closest('[data-family]');
    if (slide && !slide.querySelector('[data-split]')) {
      const b = el('div', { position: 'absolute', right: '8px', bottom: '8px', zIndex: 9, background: '#d14343', color: '#fff', font: '600 11px Inter, sans-serif', padding: '4px 8px', borderRadius: '4px' }, 'Excede a página: dividir em duas');
      b.dataset.split = '1'; slide.appendChild(b);
    }
  }
  return scale;
}

function renderEvidence(block, rect, { family, frame, scale, inks }) {
  const st = familyEvidenceStyle(family);
  const text = familyFont(family, 'text');
  const num = familyFont(family, 'numeric');
  const head = familyFont(family, st.headerRole === 'display' ? 'display' : st.headerRole === 'label' ? 'label' : 'text');
  const u = scale;
  const wrap = el('div', { ...box(rect), color: inks.ink, fontFamily: text.css, fontSize: `${26 * u}px`, lineHeight: 1.4, zIndex: 5 });
  wrap.dataset.evidence = block.type;
  if (block.type === 'comparison') {
    const table = el('table', { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 'inherit', color: 'inherit',
      ...(st.panel ? { background: st.panelColor, borderRadius: `${st.radius * u}px`, overflow: 'hidden', boxShadow: st.offsetShadow ? `${10 * u}px ${10 * u}px 0 ${st.offsetShadow}` : 'none' } : {}) });
    const thead = el('thead'); const tr = el('tr');
    block.headers.forEach((h) => tr.appendChild(el('th', { textAlign: 'left', verticalAlign: 'bottom', padding: `${14 * u}px ${18 * u}px`, borderBottom: `${Math.max(1, st.headerRule * u)}px solid ${st.panel ? st.ink : inks.ink}`,
      fontFamily: head.css, fontWeight: st.headerRole === 'display' ? head.weight : 600, fontSize: `${(st.headerRole === 'label' ? 19 : st.headerRole === 'display' ? 30 : 23) * u}px`,
      textTransform: st.headerCase === 'upper' ? 'uppercase' : 'none', letterSpacing: `${st.headerTracking}em`, color: st.panel ? st.ink : inks.ink }, h)));
    thead.appendChild(tr); table.appendChild(thead);
    const tbody = el('tbody');
    block.rows.forEach((row, ri) => {
      const r = el('tr', { background: ri % 2 === 0 ? st.zebra : 'transparent' });
      row.forEach((cell, ci) => r.appendChild(el('td', { verticalAlign: 'top', padding: `${14 * u}px ${18 * u}px`, borderBottom: `${Math.max(1, u)}px solid ${st.panel ? 'rgba(0,0,0,0.12)' : 'rgba(127,127,127,0.3)'}`,
        fontWeight: ci === 0 ? 600 : 400, color: st.panel ? st.ink : inks.ink, fontFamily: ci === 0 && family === 'technical' ? num.css : text.css, fontSize: ci === 0 && family === 'technical' ? `${23 * u}px` : undefined }, cell)));
      tbody.appendChild(r);
    });
    table.appendChild(tbody); wrap.appendChild(table);
  } else if (block.type === 'metrics') {
    const portrait = frame.h > frame.w;
    const cols = Math.min(block.items.length, portrait ? 2 : 4);
    const colPx = ((rect.w / 100) * frame.w - (cols - 1) * 28 * u) / cols;
    const grid = el('div', { display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: `${28 * u}px`, height: '100%', alignContent: 'start' });
    block.items.forEach((item) => {
      const cell = el('div', { minWidth: 0, padding: st.panel ? `${26 * u}px` : `${22 * u}px 0 0`, borderTop: st.metricRule ? `${st.metricRule * u}px solid ${st.metricRuleColor}` : 'none',
        background: st.panel ? st.panelColor : 'transparent', borderRadius: `${st.radius * u}px`, color: st.panel ? st.ink : inks.ink });
      // Mesmo cálculo do PresentationBlocks: o valor cabe numa linha da coluna.
      const base = (block.items.length > 3 ? 72 : 96) * u;
      const byWidth = (colPx - (st.panel ? 52 * u : 0)) / Math.max(1, [...item.value].length * 0.56);
      cell.appendChild(el('div', { fontFamily: num.css, fontWeight: num.weight || 600, fontSize: `${Math.max(40 * u, Math.min(base, byWidth))}px`, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }, item.value));
      cell.appendChild(el('div', { fontWeight: 600, marginTop: `${18 * u}px`, fontSize: `${26 * u}px` }, item.label));
      if (item.detail) cell.appendChild(el('div', { marginTop: `${8 * u}px`, fontSize: `${23 * u}px`, opacity: 0.72 }, item.detail));
      grid.appendChild(cell);
    });
    wrap.appendChild(grid);
  } else {
    const portrait = frame.h > frame.w;
    const n = block.items.length;
    const list = el('ol', { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: portrait ? '1fr' : `repeat(${Math.min(n, 4)}, minmax(0,1fr))`, gap: `${24 * u}px` });
    const roman = ['I', 'II', 'III', 'IV', 'V'];
    block.items.forEach((item, i) => {
      const li = el('li', { minWidth: 0, borderTop: st.metricRule ? `${Math.max(1, (st.metricRule > 4 ? 6 : 2) * u)}px solid ${st.metricRuleColor}` : 'none', padding: st.panel ? `${22 * u}px` : `${16 * u}px 0 0`,
        background: st.panel ? st.panelColor : 'transparent', borderRadius: `${st.radius * u}px`, color: st.panel ? st.ink : inks.ink });
      const marker = st.stepMarker === 'roman' ? roman[i] : st.stepMarker === 'code' ? `0${i + 1}/` : String(i + 1).padStart(2, '0');
      const m = el('span', { display: st.stepMarker === 'pill' ? 'inline-block' : 'block', fontFamily: num.css, fontSize: `${(st.stepMarker === 'pill' ? 20 : 40) * u}px`, lineHeight: 1, marginBottom: `${14 * u}px`, color: st.accent,
        ...(st.stepMarker === 'pill' ? { background: st.accent, color: '#fff', borderRadius: `${40 * u}px`, padding: `${8 * u}px ${16 * u}px` } : {}), fontStyle: st.stepMarker === 'roman' ? 'italic' : 'normal' }, marker);
      li.appendChild(m);
      li.appendChild(el('div', { fontWeight: 600, fontSize: `${28 * u}px`, lineHeight: 1.2 }, item.title));
      if (item.body) li.appendChild(el('div', { marginTop: `${8 * u}px`, opacity: 0.8 }, item.body));
      list.appendChild(li);
    });
    wrap.appendChild(list);
  }
  return wrap;
}

/**
 * @param {HTMLElement} host
 * @param {object} s slide de demonstração { kind, title, subtitle, body, blocks, photoUrl, eyebrow, caption }
 * @param {{ family: string, format: '16:9'|'4:5', index?: number, total?: number, displayWidth: number }} opts
 */
export function renderSlide(host, s, { family, format = '16:9', index = 0, total = 6, displayWidth = 960 }) {
  const ref = FORMAT_SPECS[format];
  const spec = familySpec(family);
  const structured = Array.isArray(s.blocks) && s.blocks.length > 0;
  const layout = familyLayout(family, s.kind, { format, photo: !!s.photoUrl, structured, title: s.title });
  const scale = displayWidth / ref.w;
  const frame = { w: displayWidth, h: displayWidth * ref.h / ref.w };
  const slide = el('div', { position: 'relative', width: `${frame.w}px`, height: `${frame.h}px`, overflow: 'hidden', background: spec.palette.bg });
  slide.dataset.family = family; slide.dataset.kind = s.kind; slide.dataset.format = format;
  const tokens = chromeTokensForSlide({ eyebrow: s.eyebrow, photoCaption: s.caption }, { index, total, section: s.section });
  for (const c of chromeElements(layout, { frame, tokens })) {
    const n = el('div', { position: 'absolute', pointerEvents: 'none', zIndex: String(c.z), ...Object.fromEntries(Object.entries(c.style).map(([k, v]) => [k, typeof v === 'number' && !['opacity', 'zIndex', 'lineHeight', 'fontWeight'].includes(k) ? `${v}px` : v])) }, c.text);
    slide.appendChild(n);
  }
  if (layout.photo) {
    const p = el('div', { ...box(layout.photo), zIndex: 2, overflow: 'hidden', borderRadius: `${(spec.photo.radius || 0) * scale}px`, backgroundColor: spec.palette.surface });
    p.appendChild(el('div', { position: 'absolute', inset: 0, backgroundImage: `url("${s.photoUrl}")`, backgroundSize: 'cover', backgroundPosition: s.photoPosition || 'center', filter: familyPhotoFilter(family) }));
    if (layout.scrim) {
      const a = layout.scrim.amount / 100;
      p.appendChild(el('div', { position: 'absolute', inset: 0, background: `linear-gradient(to top, rgba(0,0,0,${Math.min(0.9, a * 1.4)}) 0%, rgba(0,0,0,${Math.min(0.72, a * 1.1)}) 30%, rgba(0,0,0,${a * 0.3}) 56%, transparent 76%), linear-gradient(to bottom, rgba(0,0,0,${a * 0.6}) 0%, transparent 17%)` }));
    }
    slide.appendChild(p);
  }
  const inks = layout.inks;
  const display = familyFont(family, 'display');
  const text = familyFont(family, 'text');
  const upper = display.case === 'upper';
  // Título
  const tz = el('div', { ...box(layout.title), zIndex: 4, display: 'flex', flexDirection: 'column', justifyContent: FLEX[layout.anchors?.title] || 'flex-start', textAlign: layout.align, overflow: 'hidden' });
  const tInner = el('div', {});
  const h = el('h1', { margin: 0, color: inks.ink, fontFamily: display.css, fontWeight: String(display.weight), lineHeight: String(spec.type.titleLeading), letterSpacing: `${(display.tracking || 0) / 100}em`,
    textTransform: upper ? 'uppercase' : 'none', fontStyle: layout.titleItalic ? 'italic' : 'normal', whiteSpace: 'pre-line', textWrap: 'balance', overflowWrap: 'normal', wordBreak: 'normal', fontSynthesis: 'none' }, s.title);
  h.dataset.fs = String(layout.titlePx * scale);
  tInner.appendChild(h); tz.appendChild(tInner); slide.appendChild(tz);
  // Apoio: subtítulo (argumento) + corpo
  if (s.subtitle || s.body) {
    const sz = el('div', { ...box(layout.subtitle), zIndex: 4, display: 'flex', flexDirection: 'column', justifyContent: FLEX[layout.anchors?.subtitle] || 'flex-start', textAlign: layout.align, overflow: 'hidden' });
    const sInner = el('div', {});
    if (s.subtitle) {
      const p = richText(el('p', { margin: 0, color: inks.ink, fontFamily: text.css, fontWeight: String(text.weight), lineHeight: String(spec.type.bodyLeading), letterSpacing: `${(text.tracking || 0) / 100}em`, textWrap: 'pretty' }), s.subtitle);
      p.dataset.fs = String(layout.bodyPx * scale); sInner.appendChild(p);
    }
    if (s.body) {
      const b = richText(el('p', { margin: `${18 * scale}px 0 0`, color: inks.muted, fontFamily: text.css, fontWeight: String(text.weight), lineHeight: String(spec.type.bodyLeading), letterSpacing: `${(text.tracking || 0) / 100}em`, textWrap: 'pretty' }), s.body);
      b.dataset.fs = String(Math.max(24, layout.bodyPx * 0.86) * scale); sInner.appendChild(b);
    }
    sz.appendChild(sInner); slide.appendChild(sz);
    slide._fit = [...(slide._fit || []), [sz, sInner, 0.84]];
  }
  slide._fit = [[tz, tInner, 0.55], ...(slide._fit || [])];
  if (structured && layout.evidence) slide.appendChild(renderEvidence(s.blocks[0], layout.evidence, { family, frame, scale, inks }));
  host.appendChild(slide);
  // A medição exige o slide no documento; quem monta a página chama runFits().
  PENDING.push(...slide._fit);
  if (host.isConnected) runFits();
  return { slide, layout };
}
