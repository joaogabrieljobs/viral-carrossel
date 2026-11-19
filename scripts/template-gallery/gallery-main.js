import { FAMILY_KEYS, PAGE_KINDS, PRESENTATION_FAMILIES, familyFont } from '../../src/utils/presentation-families.js';
import { renderSlide, runFits } from './render-slide.js';

const DATA = window.__GALLERY__;
const KIND_LABEL = { cover: 'Capa', divider: 'Abertura de seção', content: 'Conteúdo explicativo', demo: 'Fotografia com argumento', data: 'Evidência', closing: 'Encerramento' };
const ORDER = ['cover', 'divider', 'content', 'demo', 'data', 'closing'];
const $ = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

function slideData(family, kind, overrides = {}) {
  const deck = DATA.content.decks[family];
  const s = { ...deck.slides.find((x) => x.kind === kind) };
  if (s.photo != null) s.photoUrl = DATA.images[family][s.photo]?.src;
  return { ...s, ...overrides };
}

function figure(host, family, s, { format = '16:9', width, index, label }) {
  const fig = $('figure', 'slide-fig');
  const holder = $('div', 'slide-holder');
  fig.appendChild(holder);
  if (label) fig.appendChild($('figcaption', null, label));
  host.appendChild(fig);
  renderSlide(holder, s, { family, format, index: index ?? ORDER.indexOf(s.kind), total: 6, displayWidth: width });
  return fig;
}

function viewPanel(root) {
  const grid = $('div', 'panel-grid');
  for (const key of FAMILY_KEYS) {
    const f = PRESENTATION_FAMILIES[key];
    const card = $('article', 'panel-card');
    card.style.background = f.palette.bg; card.style.color = f.palette.ink;
    const d = familyFont(key, 'display'); const t = familyFont(key, 'text'); const n = familyFont(key, 'numeric');
    const h = $('h2', null, f.label); h.style.fontFamily = d.css; h.style.fontWeight = d.weight; h.style.letterSpacing = `${(d.tracking || 0) / 100}em`; if (d.case === 'upper') h.style.textTransform = 'uppercase';
    card.appendChild($('div', 'panel-num', String(FAMILY_KEYS.indexOf(key) + 1).padStart(2, '0')));
    card.appendChild(h);
    const intent = $('p', 'panel-intent', f.intent); intent.style.fontFamily = t.css; card.appendChild(intent);
    const sw = $('div', 'swatches');
    for (const c of ['bg', 'surface', 'ink', 'muted', 'accent', 'accent2', 'accent3', 'inverse']) { const s = $('span', 'sw'); s.style.background = f.palette[c]; s.title = `${c} ${f.palette[c]}`; sw.appendChild(s); }
    card.appendChild(sw);
    const dl = $('dl', 'panel-dl');
    const row = (k, v, font) => { dl.appendChild($('dt', null, k)); const dd = $('dd', null, v); if (font) dd.style.fontFamily = font; dl.appendChild(dd); };
    row('Títulos', `${d.family} ${d.weight}${d.case === 'upper' ? ' · caixa alta' : ''}`, d.css);
    row('Leitura', `${t.family} ${t.weight}`, t.css);
    row('Números', `${n.family}`, n.css);
    row('Linguagem gráfica', f.graphic);
    row('Imagem', f.photo.direction);
    row('Tratamento', f.photo.filter + (f.photo.radius ? ` · cantos ${f.photo.radius}px` : ''));
    card.appendChild(dl);
    const strip = $('div', 'panel-strip'); card.appendChild(strip);
    figure(strip, key, slideData(key, 'cover'), { width: 420 });
    figure(strip, key, slideData(key, 'content'), { width: 420 });
    grid.appendChild(card);
  }
  root.appendChild(grid);
}

function viewGrid(root) {
  const head = $('div', 'grid-head'); head.appendChild($('div'));
  ORDER.forEach((k) => head.appendChild($('div', null, KIND_LABEL[k])));
  root.appendChild(head);
  for (const key of FAMILY_KEYS) {
    const row = $('section', 'grid-row');
    row.appendChild($('h3', null, PRESENTATION_FAMILIES[key].label));
    ORDER.forEach((k) => figure(row, key, slideData(key, k), { width: 300 }));
    root.appendChild(row);
  }
}

function viewSequence(root, key) {
  const f = PRESENTATION_FAMILIES[key];
  const wrap = $('section', 'seq');
  wrap.appendChild($('h2', null, `${f.label} — ${DATA.content.decks[key].theme}`));
  wrap.appendChild($('p', 'muted', f.intent));
  const list = $('div', 'seq-list');
  ORDER.forEach((k, i) => figure(list, key, slideData(key, k), { width: 880, index: i, label: `${String(i + 1).padStart(2, '0')} · ${KIND_LABEL[k]}` }));
  wrap.appendChild(list);
  root.appendChild(wrap);
}

function viewStress(root) {
  root.appendChild($('p', 'muted', 'Mesma família sob carga: título mais longo, página sem foto, evidência trocada (métricas no lugar da tabela ou o inverso) e argumento mais extenso. O renderer reduz em passos e nunca corta palavras; quando o piso é atingido a página indica divisão.'));
  for (const key of FAMILY_KEYS) {
    const row = $('section', 'stress-row');
    row.appendChild($('h3', null, PRESENTATION_FAMILIES[key].label));
    const r = $('div', 'stress-list');
    const content = slideData(key, 'content');
    figure(r, key, { ...content, title: DATA.content.stress.longTitle }, { width: 400, label: 'Título longo' });
    figure(r, key, { ...slideData(key, 'demo'), photoUrl: null }, { width: 400, label: 'Página de foto sem foto' });
    const data = slideData(key, 'data');
    const swapped = data.blocks[0].type === 'metrics' ? [{ type: 'comparison', headers: ['Item', 'Antes', 'Depois'], rows: [['Exemplo A', 'Condição atual', 'Condição proposta'], ['Exemplo B', 'Condição atual', 'Condição proposta']] }] : DATA.content.stress.metrics;
    figure(r, key, { ...data, blocks: swapped }, { width: 400, label: data.blocks[0].type === 'metrics' ? 'Com tabela' : 'Com métricas' });
    figure(r, key, { ...content, body: DATA.content.stress.longBody, subtitle: content.subtitle + ' ' + DATA.content.stress.longBody }, { width: 400, label: 'Argumento longo' });
    row.appendChild(r); root.appendChild(row);
  }
}

function viewCarousel(root) {
  root.appendChild($('p', 'muted', 'Recomposição 4:5 (1080 × 1350): cada família tem geometria própria para o formato vertical — a página não é o slide reduzido. A foto ganha altura, o título passa para baixo ou para cima conforme a família e a evidência ocupa a largura.'));
  for (const key of FAMILY_KEYS) {
    const row = $('section', 'carousel-row');
    row.appendChild($('h3', null, PRESENTATION_FAMILIES[key].label));
    const list = $('div', 'carousel-list');
    ['cover', 'content', 'demo', 'data', 'closing'].forEach((k, i) => figure(list, key, slideData(key, k), { format: '4:5', width: 270, index: i, label: KIND_LABEL[k] }));
    const pair = $('div', 'pair');
    pair.appendChild($('div', 'pair-label', '16:9 de origem'));
    figure(pair, key, slideData(key, 'cover'), { width: 300 });
    list.appendChild(pair);
    row.appendChild(list); root.appendChild(row);
  }
}

function route() {
  const [view = 'panel', fam] = (location.hash.replace('#', '') || new URLSearchParams(location.search).get('view') || 'panel').split('/');
  return { view, fam: fam || new URLSearchParams(location.search).get('family') };
}

function draw() {
  const root = document.getElementById('root');
  root.innerHTML = '';
  document.body.dataset.ready = '0';
  const { view, fam } = route();
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('on', a.dataset.view === view));
  if (view === 'panel') viewPanel(root);
  else if (view === 'grid') viewGrid(root);
  else if (view === 'sequence') (fam ? [fam] : FAMILY_KEYS).forEach((k) => viewSequence(root, k));
  else if (view === 'stress') viewStress(root);
  else if (view === 'carousel') viewCarousel(root);
  else if (view === 'compare') viewCompare(root);
  runFits();
  document.body.dataset.ready = '1';
  window.scrollTo(0, 0);
}

function viewCompare(root) {
  root.appendChild($('p', 'muted', 'Capturas do pacote recebido (renderer atual, commit 9131b79, mesmos textos e uma foto repetida) ao lado da biblioteca 2.0 com conteúdo demonstrativo. As páginas antigas são controles de composição; a comparação mostra estrutura, tipo e linguagem gráfica, não o mesmo texto.'));
  const map = { executive: 'executive', cinematic: 'cinematic', modular: 'modular-cards', photo: 'photo-essay' };
  for (const [key, old] of Object.entries(map)) {
    const row = $('section', 'compare-row');
    row.appendChild($('h3', null, PRESENTATION_FAMILIES[key].label));
    const cols = $('div', 'compare-cols');
    const a = $('div', 'compare-col'); a.appendChild($('div', 'pair-label', 'Antes — capturas do ZIP'));
    [1, 2, 3].forEach((n) => { const img = document.createElement('img'); img.src = `antes/${old}-depois-${n}.png`; img.width = 460; img.loading = 'lazy'; a.appendChild(img); });
    const b = $('div', 'compare-col'); b.appendChild($('div', 'pair-label', 'Depois — biblioteca 2.0'));
    ['cover', 'content', 'closing'].forEach((k) => figure(b, key, slideData(key, k), { width: 460 }));
    cols.appendChild(a); cols.appendChild(b); row.appendChild(cols); root.appendChild(row);
  }
}

async function main() {
  await document.fonts.ready;
  await Promise.all([...document.fonts].map((f) => f.load().catch(() => null)));
  draw();
  window.addEventListener('hashchange', draw);
}
main();
