import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

// O PNG precisa repetir a composição do editor. O clone do html2canvas tratava
// zonas transparentes como placas escuras e empurrava o texto para baixo.
// Fontes de sistema (Arial) para não depender da rede.

const svg = (content) => `data:image/svg+xml;base64,${Buffer.from(content).toString('base64')}`;
const photo = svg('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#6d8a96"/><stop offset="1" stop-color="#2b3a40"/></linearGradient></defs><rect width="1600" height="1600" fill="url(#g)"/><circle cx="1100" cy="500" r="260" fill="#c9b49b"/></svg>');
const brand = { bg: '#f4f1ea', titleColor: '#111111', subtitleColor: '#111111', textColor: '#333333',
  titleFont: 'Arial', subtitleFont: 'Arial', bodyFont: 'Arial', showHandle: false, showPageBadge: false, subtitleVisible: true };
const slide = (extra = {}) => ({ id: 'composicao', num: 1, title: 'Composição igual\nno arquivo',
  subtitle: 'O apoio fica onde estava no editor, sem descer no PNG.', layout: 'tl', align: 'left',
  photoRegion: 'full', canvas: null, elementsUnlocked: true, textShadow: false, ...extra });

const CASES = [
  { name: 'carrossel 4:5', fmt: 'carrossel', creativePreset: 'livre', slide: slide() },
  { name: 'carrossel 4:5 com foto', fmt: 'carrossel', creativePreset: 'livre', slide: slide({ bgImage: photo, layout: 'bl', overlay: 45 }) },
  { name: 'quadrado', fmt: 'quadrado', creativePreset: 'livre', slide: slide() },
  { name: 'stories', fmt: 'stories', creativePreset: 'livre', slide: slide() },
  { name: 'apresentação antiga', fmt: 'apresentacao', creativePreset: 'apresentacao', slide: slide({ layout: 'ml' }) },
];

const read = async (download) => {
  const chunks = []; for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  return Buffer.concat(chunks);
};

/** Deslocamento vertical do texto (px na escala do card), por correlação de perfis de linha. */
async function verticalShift(page, preview, exported) {
  return page.evaluate(async ({ a, b }) => {
    const load = async (src) => { const img = new Image(); img.src = src; await img.decode(); return img; };
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const W = 1080, H = Math.round(W * ib.height / ib.width);
    const profile = (img) => {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, W, H);
      const { data } = ctx.getImageData(0, 0, W, H);
      const at = (x, y) => (y * W + x) * 4;
      return Array.from({ length: H }, (_, y) => {
        let n = 0;
        for (let x = 4; x < W - 4; x++) {
          const i = at(x, y), j = at(x - 3, y);
          if (Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1]) + Math.abs(data[i + 2] - data[j + 2]) > 120) n++;
        }
        return n;
      });
    };
    const pa = profile(ia), pb = profile(ib);
    let best = 0, score = -Infinity;
    for (let d = -60; d <= 60; d++) {
      let sum = 0;
      for (let y = 60; y < H - 60; y++) sum += pa[y] * (pb[y + d] || 0);
      if (sum > score) { score = sum; best = d; }
    }
    return best;
  }, { a: `data:image/png;base64,${preview.toString('base64')}`, b: `data:image/png;base64,${exported.toString('base64')}` });
}

for (const c of CASES) test(`PNG repete a composição do editor: ${c.name}`, async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol) ? route.continue() : route.abort();
  });
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(({ c, brand }) => {
    if (localStorage.getItem('vc_library')) return;
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('composicao'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'composicao', name: 'Composição', doc: {
      fmt: c.fmt, productKind: c.fmt === 'apresentacao' ? 'apresentacao' : c.fmt, creativePreset: c.creativePreset, brand, slides: [c.slide] } }]));
  }, { c, brand });
  await page.goto('/?app=1');
  await expect(page.locator('[data-vc-tour="account-home"]')).toBeVisible({ timeout: 30_000 });
  await enterEditorFromHome(page);
  const card = page.locator('main [data-vc-card-surface]').first();
  await expect(card).toBeVisible();
  await expect.poll(() => card.getAttribute('data-vc-framing-pending')).not.toBe('true');
  await page.evaluate(() => document.fonts.ready);
  // Controles do editor (zoom de texto, alças) não fazem parte do arquivo.
  const preview = await card.screenshot({ path: info.outputPath('preview.png'), style: '[data-vc-card-surface] button{visibility:hidden!important}' });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /baixar card 1/i }).click(),
  ]);
  const png = await read(download);
  await download.saveAs(info.outputPath('exportado.png'));
  const shift = await verticalShift(page, preview, png);
  console.log(`DESLOCAMENTO ${c.name}: ${shift}px (escala 1080)`);
  expect(Math.abs(shift), `${c.name}: texto deslocado no PNG`).toBeLessThanOrEqual(3);
});
