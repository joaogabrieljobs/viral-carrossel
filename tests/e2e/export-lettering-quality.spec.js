import { enterEditorFromHome } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

async function seedCard(page) {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(() => {
    localStorage.setItem('vc_app_mode', JSON.stringify('criador'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('lettering-quality'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'lettering-quality', name: 'Letras nítidas', doc: {
      creativePreset: 'livre', brand: { id: 'lettering', name: 'Marca', bg: '#ffffff', titleColor: '#000000', textColor: '#000000',
        titleFont: '"Outfit", sans-serif', bodyFont: 'Arial, sans-serif', subtitleVisible: true, showHandle: false },
      slides: [{ id: 'lettering', num: 1, title: 'CUIDADO\nE PRECISÃO', subtitle: 'Tipografia com detalhe.',
        layout: 'mc', align: 'left', photoRegion: 'full', customBg: '#ffffff', titleCase: 'normal',
        titleSize: 100, subSize: 100, textShadow: false, canvas: null, elementsUnlocked: true }],
    } }]));
    window.__exportText = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      if (this.canvas.width > 2000) window.__exportText.push({ font: this.font, text: args[0] });
      return fillText.apply(this, args);
    };
  });
}

function mockFontCss(url, invalidOutfit = false) {
  return new URL(url).searchParams.getAll('family').map((value) => value.split(':')[0]).map((family) =>
    `@font-face{font-family:"${family}";font-style:normal;font-weight:100 900;src:${invalidOutfit && family === 'Outfit'
      ? 'url(data:font/woff2;base64,AAAA) format("woff2")'
      : 'local("Times New Roman"),local("Liberation Serif")'};font-display:swap}`,
  ).join('\n');
}

test('PNG aguarda fonte atrasada e renderiza as letras em 3× com a família escolhida', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await seedCard(page);
  let sheetRoute;
  let released = false;
  await page.route('https://fonts.googleapis.com/**', async (route) => {
    if (released) return route.fulfill({ contentType: 'text/css', body: mockFontCss(route.request().url()) });
    sheetRoute = route;
  });
  await page.goto('/?app=1', { waitUntil: 'domcontentloaded' });
  await enterEditorFromHome(page);
  const downloadButton = page.getByRole('button', { name: /baixar card 1/i });
  await expect(downloadButton).toBeVisible();
  await expect.poll(() => !!sheetRoute).toBe(true);
  const titleElement = page.locator('[data-vc-export-tree] h1').first();
  const textWidth = () => titleElement.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect().width;
  });
  const fallbackWidth = await textWidth();
  const downloads = [];
  page.on('download', (download) => downloads.push(download));
  await downloadButton.click();
  // A CSS ainda não registrou nenhuma face: ready sozinho permitiria fallback.
  await page.waitForTimeout(500);
  expect(downloads).toHaveLength(0);
  const downloadPromise = page.waitForEvent('download');
  released = true;
  await sheetRoute.fulfill({ contentType: 'text/css', body: mockFontCss(sheetRoute.request().url()) });
  const download = await downloadPromise;
  // A face de teste é serif e tem métricas diferentes do fallback sans-serif.
  // A própria árvore exportada precisa ter refluído antes da captura.
  expect(Math.abs((await textWidth()) - fallbackWidth)).toBeGreaterThan(10);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.readUInt32BE(16)).toBe(3240);
  expect(png.readUInt32BE(20)).toBe(4050);
  await download.saveAs(testInfo.outputPath('letras-3x.png'));
  const drawing = await page.evaluate(() => ({ faces: [...document.fonts].filter((font) => font.family === 'Outfit').map((font) => font.status),
    text: window.__exportText }));
  expect(drawing.faces).toContain('loaded');
  const title = drawing.text.filter(({ text }) => /[CUIDADOPRECISÃO]/.test(text));
  expect(title.some(({ font }) => /Outfit/.test(font))).toBe(true);
  expect(title.filter(({ font }) => /Outfit/.test(font)).every(({ font }) => parseFloat(font.match(/([\d.]+)px/)?.[1]) > 50)).toBe(true);
});

test('fonte com erro não produz PNG com lettering substituído', async ({ page }) => {
  await seedCard(page);
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: mockFontCss(route.request().url(), true) }));
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  const downloads = [];
  page.on('download', (download) => downloads.push(download));
  await page.getByRole('button', { name: /baixar card 1/i }).click();
  await expect(page.getByText(/Não foi possível carregar a fonte “Outfit”/)).toBeVisible();
  expect(downloads).toHaveLength(0);
});
