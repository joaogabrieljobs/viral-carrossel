import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

async function seedLogoCard(page, tone) {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(({ logoTone }) => {
    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = 100;
    logoCanvas.height = 100;
    const ctx = logoCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(25, 25, 50, 50);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(75, 25, 15, 50);
    const logo = logoCanvas.toDataURL('image/png');
    localStorage.setItem('vc_app_mode', JSON.stringify('criador'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('logo-tone-export'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'logo-tone-export', name: 'Logo no PNG', doc: {
      fmt: 'feed', creativePreset: 'livre',
      brand: { id: 'logo-tone-brand', name: 'Marca', bg: '#EEDFCC', titleColor: '#5A4031',
        textColor: '#5A4031', subtitleColor: '#5A4031', logo, logoPosition: 'tl',
        logoSize: 200, logoOpacity: 100, showHandle: false },
      slides: [{ id: 'logo-tone-slide', num: 1, title: 'CARD', subtitle: '',
        layout: 'bc', align: 'center', photoRegion: 'full', customBg: '#EEDFCC',
        titleSize: 100, textShadow: false, canvas: null, elementsUnlocked: true,
        ...(logoTone === 'dark' ? { logoTone } : {}) }],
    } }]));
  }, { logoTone: tone });
}

async function exportLogoPixel(page, testInfo) {
  const root = page.locator('[data-vc-export-tree]').locator('[data-vc-card-surface="logo-tone-slide"]').first();
  const logo = root.locator('img[data-vc-brand-logo]');
  await expect(logo).toBeAttached();
  const points = await logo.evaluate((img) => {
    const rootRect = img.closest('[data-vc-card-surface]')?.getBoundingClientRect();
    const box = img.getBoundingClientRect();
    return {
      center: { x: box.left - rootRect.left + box.width * 0.5, y: box.top - rootRect.top + box.height * 0.5 },
      halfAlpha: { x: box.left - rootRect.left + box.width * 0.8, y: box.top - rootRect.top + box.height * 0.5 },
      clear: { x: box.left - rootRect.left + box.width * 0.1, y: box.top - rootRect.top + box.height * 0.5 },
      rootWidth: rootRect.width,
    };
  });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /baixar card 1/i }).click(),
  ]);
  await download.saveAs(testInfo.outputPath(`logo-${testInfo.title.includes('escura') ? 'dark' : 'original'}.png`));
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return page.evaluate(async ({ encoded, coordinates }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${encoded}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const pixel = ({ x, y }) => [...ctx.getImageData(Math.round(x * image.width / coordinates.rootWidth),
      Math.round(y * image.width / coordinates.rootWidth), 1, 1).data];
    return { center: pixel(coordinates.center), halfAlpha: pixel(coordinates.halfAlpha),
      clear: pixel(coordinates.clear), width: image.width };
  }, { encoded: png.toString('base64'), coordinates: points });
}

test('exportação real preserva logo escura e transparência no PNG', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await seedLogoCard(page, 'dark');
  await page.goto('/?app=1');
  await expect(page.locator('[data-vc-export-tree] img[data-vc-logo-tone="dark"]')).toHaveCount(1);
  const pixels = await exportLogoPixel(page, testInfo);
  expect(pixels.width).toBe(3240);
  expect(pixels.center[0]).toBeLessThan(20);
  expect(pixels.center[1]).toBeLessThan(20);
  expect(pixels.center[2]).toBeLessThan(20);
  expect(pixels.halfAlpha[0]).toBeGreaterThan(80);
  expect(pixels.halfAlpha[0]).toBeLessThan(170);
  expect(pixels.clear[0]).toBeGreaterThan(200);
  expect(pixels.clear[1]).toBeGreaterThan(180);
  expect(pixels.clear[2]).toBeGreaterThan(140);
});

test('sem escolha de tom a logo original permanece branca no PNG', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await seedLogoCard(page, 'original');
  await page.goto('/?app=1');
  await expect(page.locator('[data-vc-export-tree] img[data-vc-logo-tone]')).toHaveCount(0);
  const pixels = await exportLogoPixel(page, testInfo);
  expect(pixels.center.slice(0, 3).every(channel => channel > 235)).toBe(true);
  expect(pixels.halfAlpha[0]).toBeGreaterThan(235);
  expect(pixels.clear[0]).toBeGreaterThan(200);
  expect(pixels.clear[1]).toBeGreaterThan(180);
  expect(pixels.clear[2]).toBeGreaterThan(140);
});
