/** Ensaio do SlideCardInner real, sem conta, IA ou renderer substituto.
 * node scripts/build-presentation-library-review.mjs OUTPUT_DIR GALLERY_ASSETS */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2] || !process.argv[3]) throw new Error('Informe saída e pasta da galeria recebida.');
const out = path.resolve(process.argv[2]);
const assets = path.resolve(process.argv[3]);
await fs.mkdir(out, { recursive: true });
await fs.cp(path.join(root, 'public/fonts'), path.join(out, 'fonts'), { recursive: true });
await fs.cp(path.join(assets, 'img'), path.join(out, 'images'), { recursive: true });
const fixture = JSON.parse(await fs.readFile(path.join(root, 'docs/presentation/template-gallery-content.json'), 'utf8'));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'moont-library-renderer-'));
const entry = path.join(temp, 'review.jsx');
const source = name => JSON.stringify(path.join(root, name));
await fs.writeFile(entry, `
import App from ${source('ViralCarrossel.jsx')}; void App;
import React, {useState} from ${source('node_modules/react/index.js')};
import {createRoot} from ${source('node_modules/react-dom/client.js')};
import {SlideCardInner} from ${source('src/components/card/SlideCardInner.jsx')};
import {DEFAULT_BRAND,mkSlide} from ${source('src/utils/doc-schema.js')};
import {applyPresentationVisualPreset,getPresentationCompositionOverrides} from ${source('src/styles/presentation-presets.jsx')};
import {FAMILY_KEYS,familySpec} from ${source('src/utils/presentation-families.js')};
import {slideForFormatDisplay} from ${source('src/utils/format-view.js')};
import {ensurePresentationFonts} from ${source('src/utils/presentation-font-manifest.js')};
ensurePresentationFonts(document);
const fixture=${JSON.stringify(fixture)};
function Review(){
 const [key,setKey]=useState('editorial');
 const spec=familySpec(key),brand=applyPresentationVisualPreset({...DEFAULT_BRAND,showHandle:false,logo:null},spec.runtimeId);
 const deck=fixture.decks[key];
 const width=Math.min(920,Math.max(360,(innerWidth-90)/2));
 return <><header><h1>Moont · biblioteca 2 no renderer real</h1><p>SlideCardInner do código integrado, com fontes locais. Conteúdo fictício e fotos ilustrativas do pacote do designer. Este ensaio não comprova geração por IA, persistência na conta ou exportação do app.</p><label>Família <select value={key} onChange={e=>setKey(e.target.value)}>{FAMILY_KEYS.map(k=><option key={k} value={k}>{familySpec(k).label}</option>)}</select></label></header><main>{deck.slides.map((item,index)=>{
 const raw={...mkSlide(index+1,brand),id:key+'-'+index,title:item.title,subtitle:item.subtitle||'',bodyAfterImage:item.body||'',eyebrow:item.eyebrow||'',photoCaption:item.caption||'',presentationSectionIndex:item.section,
 presentationBlocks:item.blocks||[],bgImage:item.photo==null?'':'images/'+key+'-'+item.photo+'.jpg',imageQuery:item.photo==null?'':'illustrative photo',presentationPlan:{visualRole:item.kind,purpose:'explain'}};
 const composed={...raw,...getPresentationCompositionOverrides(spec.runtimeId,{slide:raw,index,count:deck.slides.length})};
 const slide=slideForFormatDisplay(composed,'apresentacao',{},'apresentacao');
 return <article key={key+index}><h2>{String(index+1).padStart(2,'0')} · {item.kind}</h2><SlideCardInner slide={slide} brand={brand} fmt="apresentacao" creativePreset="apresentacao" num={index+1} total={deck.slides.length} scale={width/1920} forExport={false}/></article>;
 })}</main></>;
}
createRoot(document.getElementById('root')).render(<Review/>);
`);
try {
  const result = await build({ configFile: false, root, logLevel: 'error', plugins: [react()],
    resolve: { alias: { 'react/jsx-runtime': path.join(root, 'node_modules/react/jsx-runtime.js') } },
    define: { 'process.env.NODE_ENV': '"production"' },
    build: { write: false, minify: true, lib: { entry, name: 'MoontRealLibrary', formats: ['iife'] } } });
  const chunks = (Array.isArray(result) ? result : [result]).flatMap(r => r.output || []);
  await fs.writeFile(path.join(out, 'renderer-real.js'), chunks.find(c => c.isEntry).code);
  await fs.writeFile(path.join(out, 'RENDERER-REAL.html'), `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Moont · renderer real da biblioteca 2</title><style>*{box-sizing:border-box}body{margin:0;background:#dededb;color:#16191c;font:15px/1.5 Arial,sans-serif}header{position:sticky;top:0;background:#fff;z-index:100;padding:16px 24px;border-bottom:1px solid #aaa}h1{font-size:22px;margin:0}p{max-width:110ch;margin:6px 0}select{padding:8px;font:600 16px Arial}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;padding:24px}h2{font-size:13px;margin:0 0 8px}article{overflow:hidden}input,button{font:inherit}</style><div id="root"></div><script src="renderer-real.js"></script></html>`);
  const files = ['src/utils/presentation-families.js','src/utils/presentation-composition.js','src/components/card/SlideCardInner.jsx','src/utils/presentation-font-manifest.js'];
  const hashes = Object.fromEntries(await Promise.all(files.map(async name => [name,createHash('sha256').update(await fs.readFile(path.join(root,name))).digest('hex')])));
  await fs.writeFile(path.join(out,'proveniencia.json'), JSON.stringify({generatedAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),uncommittedChanges:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),files:hashes,scope:'Renderer real isolado; não é teste de geração por IA, persistência ou exportação.'},null,2)+'\n');
} finally { await fs.rm(temp,{recursive:true,force:true}); }
console.log(path.join(out,'RENDERER-REAL.html'));
