/**
 * Miniaturas dos estilos visuais geradas pelo renderer real (SlideCardInner).
 *
 * Os desenhos vetoriais antigos do seletor não acompanhavam a composição nova
 * dos carrosséis nem as famílias novas de apresentação. Este script desenha a
 * capa de cada estilo com o código do app, fotografa no Chromium do Playwright
 * e grava:
 *   public/style-thumbs/<id>.jpg
 *   src/styles/style-thumbnails.generated.js  (id → URL com hash de conteúdo)
 *
 * Uso: node scripts/build-style-thumbnails.mjs PASTA_IMAGENS_APRESENTACAO [--saida DIR] [--so-pagina]
 *   PASTA_IMAGENS_APRESENTACAO: pasta com <familia>-<n>.jpg (fotos CC0 da galeria
 *   das apresentações; créditos em docs/presentation/creditos-miniaturas.md).
 * Conteúdo fictício; não usa conta, IA nem rede além do Google Fonts do app.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from '@playwright/test';
import { SOCIAL_FAMILY_COVER_PHOTO } from './style-thumbnail-photos.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const imagesDir = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--saida');
if (!imagesDir) throw new Error('Informe a pasta com as fotos das apresentações (<familia>-<n>.jpg).');
const outIdx = args.indexOf('--saida');
const thumbsDir = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : path.join(root, 'public/style-thumbs');
const writeMap = outIdx < 0;

// URL das fontes do app, lida do código (sem executar o App).
const require = createRequire(path.join(root, 'package.json'));
const { parse } = require('@babel/parser');
function fontsUrl() {
  const ast = parse(require('node:fs').readFileSync(path.join(root, 'ViralCarrossel.jsx'), 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  let url = null;
  const value = (n) => (n.type === 'StringLiteral' ? n.value : n.type === 'BinaryExpression' ? value(n.left) + value(n.right) : n.type === 'TemplateLiteral' && !n.expressions.length ? n.quasis[0].value.cooked : (() => { throw new Error('FONTS_URL não literal'); })());
  (function visit(node) {
    if (!node || typeof node !== 'object' || url) return;
    if (node.type === 'VariableDeclarator' && node.id?.name === 'FONTS_URL') { url = value(node.init); return; }
    for (const item of Object.values(node)) if (Array.isArray(item)) item.forEach(visit); else if (item && typeof item === 'object') visit(item);
  })(ast);
  if (!url) throw new Error('FONTS_URL não encontrada em ViralCarrossel.jsx');
  return url;
}

const page = await fs.mkdtemp(path.join(os.tmpdir(), 'moont-thumbs-page-'));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'moont-thumbs-src-'));
await fs.cp(path.join(root, 'public/fonts'), path.join(page, 'fonts'), { recursive: true });
await fs.mkdir(path.join(page, 'images'), { recursive: true });
for (const f of await fs.readdir(imagesDir)) if (/^[a-z]+-\d+\.jpg$/.test(f)) await fs.copyFile(path.join(imagesDir, f), path.join(page, 'images', f));
await fs.copyFile(path.join(root, 'public/landing/hero-creator-photo.jpg'), path.join(page, 'images', 'social-capa.jpg'));
for (const name of Object.values(SOCIAL_FAMILY_COVER_PHOTO)) {
  await fs.access(path.join(page, 'images', `${name}.jpg`)).catch(() => { throw new Error(`Foto de exemplo ausente na pasta informada: ${name}.jpg`); });
}
const fixture = JSON.parse(await fs.readFile(path.join(root, 'docs/presentation/template-gallery-content.json'), 'utf8'));
const src = (n) => JSON.stringify(path.join(root, n));
const entry = path.join(temp, 'thumbs.jsx');
await fs.writeFile(entry, `
import App from ${src('ViralCarrossel.jsx')}; void App;
import React from ${src('node_modules/react/index.js')};
import {createRoot} from ${src('node_modules/react-dom/client.js')};
import {SlideCardInner} from ${src('src/components/card/SlideCardInner.jsx')};
import {DEFAULT_BRAND,mkSlide} from ${src('src/utils/doc-schema.js')};
import {VISUAL_PRESETS,applyVisualPreset,getSlideOverridesForPreset} from ${src('src/styles/visual-presets.jsx')};
import {applySocialVisualComposition} from ${src('src/utils/social-visual-composition.js')};
import {applyPresentationVisualPreset,getPresentationCompositionOverrides} from ${src('src/styles/presentation-presets.jsx')};
import {FAMILY_KEYS,familySpec} from ${src('src/utils/presentation-families.js')};
import {slideForFormatDisplay} from ${src('src/utils/format-view.js')};
import {ensurePresentationFonts} from ${src('src/utils/presentation-font-manifest.js')};
import {FORMATS} from ${src('src/utils/formats.js')};
ensurePresentationFonts(document);
const fixture=${JSON.stringify(fixture)};
// Foto de exemplo de cada família editorial (scripts/style-thumbnail-photos.mjs).
const COVER_PHOTO=${JSON.stringify(SOCIAL_FAMILY_COVER_PHOTO)};
// Capa social: título curto que mostra a tipografia do estilo e a foto de exemplo da família.
// Os 12 estilos virais mostram o card de abertura (sem foto): no tamanho do
// seletor, a capa com foto deixa todos parecidos; cor de chão, tipografia e
// acento é o que os distingue. As famílias editoriais mostram a capa.
const SOCIAL=[
 {title:'Ideias que param o feed',subtitle:'Um carrossel com começo, meio e fim.',photo:true},
 {title:'Uma ideia por card',subtitle:'Título curto e um apoio que explica.'},
 {title:'Uma ideia por card',subtitle:'Título curto e um apoio que explica.'},
 {title:'Agora volte ao início',subtitle:'E salve para a próxima pauta.',photo:true},
];
const W_SOCIAL=360, W_DECK=640;
function Social({preset}){
 const brand=applyVisualPreset({...DEFAULT_BRAND,name:'',handle:'',logo:null,showHandle:false},preset.id);
 const raw=SOCIAL.map((s,i)=>({...mkSlide(i+1,brand),...getSlideOverridesForPreset(preset.id),id:preset.id+'-'+i,title:s.title,subtitle:s.subtitle,bgImage:s.photo?'images/'+(COVER_PHOTO[preset.socialFamily]||'social-capa')+'.jpg':'',imageQuery:s.photo?'foto de exemplo':''}));
 const composed=applySocialVisualComposition(raw,{preset,brand,formato:'carrossel'});
 // Card sem foto no fundo próprio do estilo (o card de afirmação inverte as cores).
 const own=composed.findIndex(s=>!s.bgImage&&(s.socialArt?.ground||'bg')==='bg');
 const pick=preset.socialFamily?0:(own>=0?own:1);
 const slide=composed[pick];
 const f=FORMATS.carrossel;
 return <div data-thumb={preset.id} style={{width:W_SOCIAL,height:W_SOCIAL*f.h/f.w,overflow:'hidden'}}><SlideCardInner slide={slideForFormatDisplay(slide,'carrossel',{},'livre')} brand={brand} fmt="carrossel" creativePreset="livre" num={pick+1} total={SOCIAL.length} scale={W_SOCIAL/f.w} forExport={true}/></div>;
}
function Deck({familyKey}){
 const spec=familySpec(familyKey);
 const brand=applyPresentationVisualPreset({...DEFAULT_BRAND,showHandle:false,logo:null},spec.runtimeId);
 const deck=fixture.decks[familyKey]; const item=deck.slides[0];
 const raw={...mkSlide(1,brand),id:familyKey+'-0',title:item.title,subtitle:item.subtitle||'',bodyAfterImage:item.body||'',eyebrow:item.eyebrow||'',photoCaption:item.caption||'',presentationSectionIndex:item.section,
  presentationBlocks:item.blocks||[],bgImage:item.photo==null?'':'images/'+familyKey+'-'+item.photo+'.jpg',imageQuery:item.photo==null?'':'illustrative photo',presentationPlan:{visualRole:item.kind,purpose:'explain'}};
 const composed={...raw,...getPresentationCompositionOverrides(spec.runtimeId,{slide:raw,index:0,count:deck.slides.length})};
 const f=FORMATS.apresentacao;
 return <div data-thumb={spec.runtimeId} style={{width:W_DECK,height:W_DECK*f.h/f.w,overflow:'hidden'}}><SlideCardInner slide={slideForFormatDisplay(composed,'apresentacao',{},'apresentacao')} brand={brand} fmt="apresentacao" creativePreset="apresentacao" num={1} total={deck.slides.length} scale={W_DECK/f.w} forExport={true}/></div>;
}
function All(){
 return <main style={{display:'flex',flexWrap:'wrap',gap:24,padding:24}}>
  {VISUAL_PRESETS.filter(p=>!p.hidden&&p.productKind!=='apresentacao').map(p=><Social key={p.id} preset={p}/>)}
  {FAMILY_KEYS.map(k=><Deck key={k} familyKey={k}/>)}
 </main>;
}
createRoot(document.getElementById('root')).render(<All/>);
`);

try {
  const result = await build({ configFile: false, root, logLevel: 'error', plugins: [react()],
    resolve: { alias: { 'react/jsx-runtime': path.join(root, 'node_modules/react/jsx-runtime.js') } },
    define: { 'process.env.NODE_ENV': '"production"' },
    build: { write: false, minify: true, lib: { entry, name: 'MoontThumbs', formats: ['iife'] } } });
  const chunks = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output || []);
  await fs.writeFile(path.join(page, 'thumbs.js'), chunks.find((c) => c.isEntry).code);
  await fs.writeFile(path.join(page, 'index.html'), `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><link rel="stylesheet" href="${fontsUrl().replaceAll('&', '&amp;')}"><style>*{box-sizing:border-box}body{margin:0;background:#222}</style><div id="root"></div><script src="thumbs.js"></script></html>`);

  const types = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.css': 'text/css' };
  const server = http.createServer(async (req, res) => {
    try {
      const file = path.join(page, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
      const body = await fs.readFile(file);
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch();
  // 1,5x: no celular a miniatura ocupa ~170 px de largura em tela 3x.
  const tab = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1.5 });
  const errors = [];
  tab.on('pageerror', (e) => errors.push(e.message));
  await tab.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'networkidle' });
  await tab.evaluate(async () => {
    const faces = new Set();
    document.querySelectorAll('[data-thumb] *').forEach((el) => {
      if (!el.textContent.trim() || el.children.length) return;
      const cs = getComputedStyle(el);
      faces.add(`${cs.fontStyle} ${cs.fontWeight} 40px ${cs.fontFamily}`);
    });
    await Promise.all([...faces].map((f) => document.fonts.load(f).catch(() => {})));
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  });
  await tab.waitForTimeout(800);
  const missing = await tab.evaluate(() => {
    const out = new Set();
    document.querySelectorAll('[data-thumb] *').forEach((el) => {
      if (!el.textContent.trim() || el.children.length) return;
      const cs = getComputedStyle(el);
      const fam = cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
      if (!document.fonts.check(`${cs.fontStyle} ${cs.fontWeight} 40px "${fam}"`)) out.add(fam);
    });
    return [...out];
  });
  if (missing.length) throw new Error(`Fontes não carregadas: ${missing.join(', ')}`);
  if (errors.length) throw new Error(`Erro na página: ${errors[0]}`);

  await fs.rm(thumbsDir, { recursive: true, force: true });
  await fs.mkdir(thumbsDir, { recursive: true });
  const map = {};
  for (const el of await tab.$$('[data-thumb]')) {
    const id = await el.getAttribute('data-thumb');
    const buf = await el.screenshot({ type: 'jpeg', quality: 84 });
    await fs.writeFile(path.join(thumbsDir, `${id}.jpg`), buf);
    map[id] = `/style-thumbs/${id}.jpg?v=${createHash('sha256').update(buf).digest('hex').slice(0, 10)}`;
  }
  await browser.close();
  server.close();
  if (writeMap) {
    const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
    await fs.writeFile(path.join(root, 'src/styles/style-thumbnails.generated.js'),
      `// Gerado por scripts/build-style-thumbnails.mjs. Não editar à mão.\n// Capa de cada estilo desenhada pelo renderer real (SlideCardInner).\nexport const STYLE_THUMBNAILS = Object.freeze(${JSON.stringify(sorted, null, 2)});\n`);
  }
  console.log(`${Object.keys(map).length} miniaturas em ${thumbsDir}`);
} finally {
  await fs.rm(temp, { recursive: true, force: true });
  await fs.rm(page, { recursive: true, force: true });
}
