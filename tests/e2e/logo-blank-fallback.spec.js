import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

async function seed(page, { blankBrand = false } = {}) {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(({ blankBrand }) => {
    if (localStorage.getItem('vc_library')) return;
    const png = (color, blank = false) => {
      const c = document.createElement('canvas');
      c.width = 720; c.height = 139;
      const ctx = c.getContext('2d');
      ctx.fillStyle = color;
      ctx.fillRect(blank ? 0 : 90, blank ? 0 : 20, blank ? 720 : 540, blank ? 139 : 99);
      return c.toDataURL('image/png');
    };
    const empty = png('#ffffff', true);
    const brand = { id: 'logo-brand', name: 'Marca de teste', bg: '#101010',
      titleColor: '#fff', subtitleColor: '#fff', textColor: '#fff',
      logo: blankBrand ? empty : png('#12bfcf'), logoPosition: 'br',
      logoSize: 436, logoOpacity: 100, showHandle: false };
    localStorage.setItem('vc_app_mode', JSON.stringify('criador'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('logo-recovery'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'logo-recovery', name: 'Logo recuperada', doc: {
      fmt: 'apresentacao', creativePreset: 'livre', brand,
      slides: [
        { id: 'blank', title: 'Logo recuperada', logoImage: empty },
        { id: 'custom', title: 'Logo própria', logoImage: png('#eb3555') },
        { id: 'hidden', title: 'Logo ocultada', logoImage: empty, logoHidden: true },
      ].map(s => ({ layout: 'bc', photoRegion: 'full', canvas: null, elementsUnlocked: true, ...s })),
    } }]));
  }, { blankBrand });
  await page.goto('/?app=1');
}

const logoAt = (page, id, exportTree = false) => page.locator(exportTree ? '[data-vc-export-tree]' : 'main')
  .locator(`[data-vc-card-surface="${id}"] img[data-vc-brand-logo]`).first();

async function logoColor(logo) {
  await expect(logo).toBeAttached();
  return logo.evaluate(async img => {
    await img.decode();
    const c = document.createElement('canvas'); c.width = 1; c.height = 1;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, img.naturalWidth / 2, img.naturalHeight / 2, 1, 1, 0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  });
}

test('cópia branca vazia recupera a marca no card e no PNG, preservando logos próprias e ocultadas', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await seed(page);
  await expect.poll(() => logoColor(logoAt(page, 'blank'))).toEqual([18, 191, 207, 255]);
  expect(await logoColor(logoAt(page, 'custom'))).toEqual([235, 53, 85, 255]);
  await expect(logoAt(page, 'hidden')).toHaveCount(0);
  const exportLogo = logoAt(page, 'blank', true);
  await expect.poll(() => logoColor(exportLogo)).toEqual([18, 191, 207, 255]);
  const point = await exportLogo.evaluate(img => {
    const r = img.getBoundingClientRect();
    const root = img.closest('[data-vc-card-surface]').getBoundingClientRect();
    return { x: (r.x - root.x + r.width / 2) / root.width,
      y: (r.y - root.y + r.height / 2) / root.height };
  });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /baixar card 1/i }).click(),
  ]);
  await download.saveAs(testInfo.outputPath('logo-recuperada.png'));
  const stream = await download.createReadStream();
  const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const pixels = await page.evaluate(async ({ encoded, point }) => {
    const img = new Image(); img.src = `data:image/png;base64,${encoded}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    return [...ctx.getImageData(Math.round(point.x * img.width), Math.round(point.y * img.height), 1, 1).data];
  }, { encoded: Buffer.concat(chunks).toString('base64'), point });
  expect(pixels).toEqual([18, 191, 207, 255]);

  // Herda a marca no card de origem e replica: o destino precisa perder a
  // logo antiga, mesmo quando a origem não tem override próprio.
  await page.getByRole('tab', { name: 'Marca', exact: true }).click();
  await page.getByText('Logo nos cards', { exact: true }).click();
  await page.getByRole('button', { name: 'Voltar à logo da marca neste card', exact: true }).click();
  await page.getByRole('button', { name: 'Aplicar em todos', exact: true }).click();
  await expect.poll(() => logoColor(logoAt(page, 'custom'))).toEqual([18, 191, 207, 255]);
  await expect.poll(() => logoColor(logoAt(page, 'hidden'))).toEqual([18, 191, 207, 255]);
  await page.reload();
  await expect.poll(() => logoColor(logoAt(page, 'custom'))).toEqual([18, 191, 207, 255]);
  await page.locator('main [data-vc-card-surface="blank"]').first().screenshot({ path: testInfo.outputPath('logo-no-card.png') });
});

test('uma marca também vazia continua oculta sem ciclo de recuperação', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await seed(page, { blankBrand: true });
  await expect(page.locator('main [data-vc-card-surface="blank"]')).toBeVisible();
  await expect(logoAt(page, 'blank')).toHaveCount(0);
  expect(await logoColor(logoAt(page, 'custom'))).toEqual([235, 53, 85, 255]);
  expect(errors).toEqual([]);
});
