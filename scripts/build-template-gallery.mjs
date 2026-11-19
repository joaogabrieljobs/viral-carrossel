/**
 * Gera a galeria de revisão da biblioteca de templates.
 *
 *   node scripts/build-template-gallery.mjs --fonts <dir> --images <selection.json> --out <dir>
 *
 * A galeria importa src/utils/presentation-families.js e presentation-chrome.js
 * — os mesmos módulos do app — e os empacota com o Vite do projeto. As fontes são
 * servidas localmente (OFL, google/fonts) e as imagens vêm de acervos CC0/PDM
 * listados em selection.json com autor, licença e página de origem.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const FONTS = path.resolve(arg('fonts', 'fonts'));
const SELECTION = path.resolve(arg('images', 'selection.json'));
const OUT = path.resolve(arg('out', 'galeria'));
const BEFORE = arg('before', null);

export const FONT_FACES = [
  ['Fraunces', 'Fraunces.ttf', '100 900', 'normal'], ['Fraunces', 'Fraunces-Italic.ttf', '100 900', 'italic'],
  ['Source Serif 4', 'SourceSerif4.ttf', '200 900', 'normal'], ['Source Serif 4', 'SourceSerif4-Italic.ttf', '200 900', 'italic'],
  ['Inter Tight', 'InterTight.ttf', '100 900', 'normal'], ['Inter', 'Inter.ttf', '100 900', 'normal'],
  ['Archivo', 'Archivo.ttf', '100 900', 'normal'],
  ['Barlow Condensed', 'BarlowCondensed-Medium.ttf', '500', 'normal'], ['Barlow Condensed', 'BarlowCondensed-SemiBold.ttf', '600', 'normal'],
  ['Barlow', 'Barlow-Regular.ttf', '400', 'normal'], ['Barlow', 'Barlow-Medium.ttf', '500', 'normal'],
  ['Bodoni Moda', 'BodoniModa.ttf', '400 900', 'normal'], ['Bodoni Moda', 'BodoniModa-Italic.ttf', '400 900', 'italic'],
  ['Jost', 'Jost.ttf', '100 900', 'normal'], ['Anton', 'Anton-Regular.ttf', '400', 'normal'],
  ['Space Grotesk', 'SpaceGrotesk.ttf', '300 700', 'normal'], ['Syne', 'Syne.ttf', '400 800', 'normal'],
  ['DM Sans', 'DMSans.ttf', '100 1000', 'normal'], ['IBM Plex Sans', 'IBMPlexSans.ttf', '100 700', 'normal'],
  ['IBM Plex Mono', 'IBMPlexMono-Regular.ttf', '400', 'normal'], ['IBM Plex Mono', 'IBMPlexMono-Medium.ttf', '500', 'normal'],
  ['Instrument Serif', 'InstrumentSerif-Regular.ttf', '400', 'normal'], ['Instrument Serif', 'InstrumentSerif-Italic.ttf', '400', 'italic'],
  ['Instrument Sans', 'InstrumentSans.ttf', '400 700', 'normal'], ['Plus Jakarta Sans', 'PlusJakartaSans.ttf', '200 800', 'normal'],
];

const CSS = `
*{box-sizing:border-box}html,body{margin:0}body{background:#E4E2DD;color:#1A1A1A;font:15px/1.5 "Inter",system-ui,sans-serif}
header{position:sticky;top:0;z-index:50;background:#111;color:#F2F0EA;padding:14px 28px;display:flex;gap:28px;align-items:center;flex-wrap:wrap}
header strong{font:600 17px "Inter Tight";letter-spacing:-.01em}nav{display:flex;gap:6px;flex-wrap:wrap}
nav a{color:#bbb;text-decoration:none;padding:6px 12px;border-radius:999px;font-size:13px}nav a.on,nav a:hover{background:#F2F0EA;color:#111}
.note{font-size:12px;color:#9a968c;max-width:70ch}
main{padding:28px}#root{display:flex;flex-direction:column;gap:28px}
.muted{color:#5b5850;max-width:90ch;margin:0}
figure{margin:0}.slide-fig figcaption{font-size:12px;color:#5b5850;margin-top:6px}
.slide-holder>div{box-shadow:0 1px 2px rgba(0,0,0,.08),0 8px 28px rgba(0,0,0,.10)}
.panel-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(880px,1fr));gap:24px}
.panel-card{padding:36px 40px;border-radius:4px;position:relative}
.panel-card h2{font-size:52px;line-height:1;margin:6px 0 12px}.panel-num{font:500 13px "IBM Plex Mono";opacity:.6}
.panel-intent{font-size:19px;line-height:1.45;max-width:60ch;margin:0 0 18px}
.swatches{display:flex;gap:6px;margin-bottom:18px}.sw{width:38px;height:38px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(127,127,127,.35)}
.panel-dl{display:grid;grid-template-columns:150px 1fr;gap:6px 16px;font-size:14px;margin:0 0 22px}.panel-dl dt{opacity:.6}.panel-dl dd{margin:0}
.panel-strip{display:flex;gap:16px;flex-wrap:wrap}
.grid-head,.grid-row{display:grid;grid-template-columns:150px repeat(6,300px);gap:14px;align-items:start}
.grid-head{font-size:12px;font-weight:600;color:#5b5850;position:sticky;top:58px;background:#E4E2DD;z-index:10;padding:6px 0}
.grid-row h3,.stress-row h3,.carousel-row h3{font:600 16px "Inter Tight";margin:0}
.grid-row{overflow-x:auto}#root:has(.grid-row){overflow-x:auto}
.seq h2{font:600 30px "Inter Tight";margin:0 0 4px}.seq-list{display:grid;grid-template-columns:repeat(2,880px);gap:22px;margin-top:16px}
.stress-list,.carousel-list{display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;align-items:flex-start}
.compare-cols{display:flex;gap:28px;margin-top:10px}.compare-col{display:flex;flex-direction:column;gap:12px}.compare-col img{display:block;box-shadow:0 8px 28px rgba(0,0,0,.1)}
.pair{padding-left:16px;border-left:1px dashed #9a968c}.pair-label{font-size:12px;color:#5b5850;margin-bottom:6px}
`;

function fontFaceCss() {
  return FONT_FACES.map(([family, file, weight, style]) => `@font-face{font-family:"${family}";src:url("fonts/${file}") format("truetype");font-weight:${weight};font-style:${style};font-display:block}`).join('\n');
}

export async function buildGallery() {
  fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
  for (const [, file] of FONT_FACES) fs.copyFileSync(path.join(FONTS, file), path.join(OUT, 'fonts', file));
  const selection = JSON.parse(fs.readFileSync(SELECTION, 'utf8'));
  const base = path.dirname(SELECTION);
  const images = {};
  const credits = [];
  for (const [family, list] of Object.entries(selection)) {
    images[family] = list.map((item, i) => {
      const name = `${family}-${i}.jpg`;
      fs.copyFileSync(path.resolve(base, item.file), path.join(OUT, 'img', name));
      credits.push({ file: `img/${name}`, family, title: item.title, author: item.author, license: item.license, page: item.page, source: item.url });
      return { src: `img/${name}`, author: item.author, license: item.license };
    });
  }
  if (BEFORE) {
    fs.mkdirSync(path.join(OUT, 'antes'), { recursive: true });
    for (const f of fs.readdirSync(BEFORE).filter((n) => /-depois-\d\.png$/.test(n))) fs.copyFileSync(path.join(BEFORE, f), path.join(OUT, 'antes', f));
  }
  const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/presentation/template-gallery-content.json'), 'utf8'));
  await build({ configFile: false, root: ROOT, logLevel: 'warn', build: {
    outDir: OUT, emptyOutDir: false, target: 'es2020',
    lib: { entry: path.join(ROOT, 'scripts/template-gallery/gallery-main.js'), name: 'MoontGallery', formats: ['iife'], fileName: () => 'gallery.js' },
  } });
  const nav = [['panel', 'Painel das 10 direções'], ['grid', 'Galeria · 6 layouts'], ['sequence', 'Sequências completas'], ['carousel', 'Carrossel 4:5'], ['stress', 'Testes de carga'], ['compare', 'Antes × depois']]
    .map(([v, l]) => `<a href="#${v}" data-view="${v}">${l}</a>`).join('');
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Moont · biblioteca de templates</title>
<style>${fontFaceCss()}\n${CSS}</style></head><body>
<header><strong>Moont · biblioteca de templates</strong><nav>${nav}</nav><span class="note">Conteúdo e marcas fictícios. Fotografias de acervos CC0/domínio público (créditos em CREDITOS.md). Renderizado com os módulos de direção de arte do app.</span></header>
<main><div id="root"></div></main>
<script>window.__GALLERY__=${JSON.stringify({ content, images })};</script>
<script src="gallery.js"></script>
<script>document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>{}));window.addEventListener('hashchange',()=>document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on','#'+a.dataset.view===location.hash.split('/')[0])));</script>
</body></html>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  fs.writeFileSync(path.join(OUT, 'creditos-imagens.json'), JSON.stringify(credits, null, 2));
  return { out: OUT, images: credits.length };
}

const r = await buildGallery();
process.stdout.write(`Galeria gerada em ${r.out} com ${r.images} imagens.\n`);
