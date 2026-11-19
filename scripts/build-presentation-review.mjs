/** Standalone, interactive before/after review using the actual card renderer.
 * node scripts/build-presentation-review.mjs BASELINE_ROOT OUTPUT_DIRECTORY */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) throw new Error('Informe o checkout de referência para a comparação Antes/Depois.');
const baseline = path.resolve(process.argv[2] || root);
const out = path.resolve(process.argv[3] || path.join(os.tmpdir(), 'moont-presentation-review'));
const fixture = JSON.parse(await fs.readFile(path.join(root, 'docs/presentation/review-fixture.json'), 'utf8'));
const photo = `data:image/jpeg;base64,${(await fs.readFile(path.join(root, 'public/landing/hero-creator-photo.jpg'))).toString('base64')}`;
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'moont-presentation-review-'));
await fs.mkdir(out, { recursive: true });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const sourceCatalog = JSON.parse(await fs.readFile(path.join(root, 'docs/presentation/presentation-design-system.json'), 'utf8'));
const fontQueries = new Map();
for (const pattern of sourceCatalog.patterns) for (const font of Object.values(pattern.typography)) {
  if (!font?.href) continue;
  for (const query of new URL(font.href).searchParams.getAll('family')) {
    const family = query.split(':')[0];
    if (!fontQueries.has(family)) fontQueries.set(family, query);
  }
}
const css = `https://fonts.googleapis.com/css2?${[...fontQueries.values()].map(q => `family=${encodeURIComponent(q)}`).join('&')}&display=swap`;

for (const [name, repo] of [['MoontBefore', baseline], ['MoontAfter', root]]) {
  const entry = path.join(temp, `${name}.jsx`);
  const url = file => JSON.stringify(path.join(repo, file));
  await fs.writeFile(entry, `
import App from ${url('ViralCarrossel.jsx')}; void App;
import React from ${url('node_modules/react/index.js')};
import { createRoot } from ${url('node_modules/react-dom/client.js')};
import { SlideCardInner } from ${url('src/components/card/SlideCardInner.jsx')};
import { applyPresentationVisualPreset, getPresentationCompositionOverrides, PRESENTATION_VISUAL_PRESETS } from ${url('src/styles/presentation-presets.jsx')};
import { DEFAULT_BRAND, mkSlide } from ${url('src/utils/doc-schema.js')};
import { slideForFormatDisplay } from ${url('src/utils/format-view.js')};
const fixture = ${JSON.stringify(fixture)};
const photo = ${JSON.stringify(photo)};
const roots = new Map();
export function mount(selector, presetId) {
  const target = document.querySelector(selector);
  if (!roots.has(target)) roots.set(target, createRoot(target));
  const scale = Math.max(.18, Math.min(.48, (target.clientWidth - 20) / 1920));
  const brand = applyPresentationVisualPreset(DEFAULT_BRAND, presetId);
  const slides = fixture.slides.map((source, index) => {
    const visualRole = index === 0 ? 'cover' : index === 4 ? 'closing' : source.presentationBlocks ? 'data' : 'content';
    const raw = { ...mkSlide(index + 1, brand), ...source, id: 'review-' + index, presentationPlan: { visualRole, purpose: 'explain' } };
    const slide = { ...raw, ...getPresentationCompositionOverrides(presetId, { slide: raw, stage: { deliveryMode: 'hybrid' }, index, count: 5 }) };
    if (index === 0) Object.assign(slide, { bgImage: photo, bgX: 70, bgY: 45 });
    return slideForFormatDisplay(slide, 'apresentacao', {}, 'apresentacao');
  });
  roots.get(target).render(React.createElement(React.Fragment, null, slides.map((slide, index) => React.createElement('article', { key: presetId + index, style:{ marginBottom:24 } },
    React.createElement('p', { className:'slide-label' }, ['Abertura com fotografia','Comparação editável','Argumento e exemplo','Exercício com etapas','Encerramento'][index]),
    React.createElement(SlideCardInner, { slide, fmt:'apresentacao', brand, num:index+1, total:5, creativePreset:'apresentacao', scale, forExport:false })
  ))));
}
export const presets = PRESENTATION_VISUAL_PRESETS.filter(p => p.sourceId).map(p => ({ id:p.id,label:p.label }));
`);
  const result = await build({ configFile: false, root: repo, logLevel: 'error', plugins: [react()],
    define: { 'process.env.NODE_ENV': '"production"' },
    build: { write: false, minify: true, lib: { entry, name, formats: ['iife'], fileName: () => `${name}.js` } },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs.flatMap(item => item.output || []).find(item => item.type === 'chunk' && item.isEntry);
  if (!chunk) throw new Error('Gallery entry missing');
  await fs.writeFile(path.join(out, `${name}.js`), chunk.code);
}

const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Moont — revisão dos templates</title><link rel="stylesheet" href="${esc(css)}"><style>
*{box-sizing:border-box}body{margin:0;background:#e8ebef;color:#17212d;font-family:Arial,sans-serif}header{position:sticky;top:0;z-index:30;padding:18px 24px;background:#fff;border-bottom:1px solid #cbd2db}h1{font-size:23px;margin:0 0 8px}header p{font-size:13px;max-width:100ch;line-height:1.5;margin:6px 0}select{font:600 16px Arial;padding:10px 16px;margin-top:8px;border:1px solid #aeb8c5;border-radius:6px;background:white}main{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:20px 24px}.column{min-width:0}.column h2{font-size:16px;margin:0 0 12px}.slide-label{font-size:12px;font-weight:600;color:#536072;margin:20px 0 7px}article{overflow:hidden;border-radius:5px}#before,#after{min-width:0}button,input{font:inherit}@media(max-width:900px){main{grid-template-columns:1fr}}@media print{header{position:static}article{break-inside:avoid}}
</style><header><h1>Moont · revisão dos dez templates</h1><p>Mesmos textos, mesma fotografia, duas versões do motor. Compare hierarquia, fonte, diagramação e quadros. ${esc(fixture.note)}</p><label>Direção visual <select id="preset"></select></label><p>Prévia interativa local do renderer. Não representa 16 gerações aprovadas nem deploy em produção.</p></header><main><section class="column"><h2>Antes</h2><div id="before"></div></section><section class="column"><h2>Depois</h2><div id="after"></div></section></main><script src="MoontBefore.js"></script><script src="MoontAfter.js"></script><script>
const select=document.getElementById('preset');for(const p of MoontAfter.presets){const o=document.createElement('option');o.value=p.id;o.textContent=p.label;select.append(o)}select.value='presentation_editorial_magazine';function update(){MoontBefore.mount('#before',select.value);MoontAfter.mount('#after',select.value)}select.addEventListener('change',update);update();let resize;addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(update,120)});
</script></html>`;
await fs.writeFile(path.join(out, 'GALERIA-APRESENTACOES.html'), html);
const digest = value => createHash('sha256').update(value).digest('hex');
const sources = {};
for (const [name, repo] of [['before', baseline], ['after', root]]) {
  sources[name] = { root: repo, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), files: {} };
  for (const file of ['src/utils/presentation-composition.js', 'src/components/PresentationBlocks.jsx', 'src/generated/presentation-design-system.generated.js']) {
    sources[name].files[file] = digest(await fs.readFile(path.join(repo, file)));
  }
}
await fs.writeFile(path.join(out, 'fontes-da-galeria.json'), JSON.stringify({ generatedAt: new Date().toISOString(), fixtureSha256: digest(JSON.stringify(fixture)), sources }, null, 2));
await fs.rm(temp, { recursive: true, force: true });
console.log(`Review gallery: ${path.join(out, 'GALERIA-APRESENTACOES.html')}`);
