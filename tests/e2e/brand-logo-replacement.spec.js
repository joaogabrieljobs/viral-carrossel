import { enterEditorFromHome } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

test('trocar a logo da marca no Studio substitui o JPEG do perfil e preserva os outros projetos', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol)
      ? route.continue() : route.abort('blockedbyclient');
  });
  await mockApi(page, { session: SESSAO_ATIVA, extra: {
    '/api/library-sync': route => route.fulfill({ status: 503, json: { error: 'E2E: nuvem offline.' } }),
  } });
  await page.addInitScript(({ owner }) => {
    if (localStorage.getItem('vc_library')) return;
    const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 120;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 720, 120);
    const brand = { id: 'b1', name: 'Marca de teste', logo: canvas.toDataURL('image/jpeg'),
      bg: '#101010', logoPosition: 'tr', showHandle: false };
    const projects = ['logo-active', 'logo-other'].map((id, index) => ({
      id, name: `Campanha de teste ${index + 1}`, updatedAt: 1000,
      doc: { fmt: 'feed', brand, slides: [{ id: `${id}-s`, title: `Texto preservado ${index + 1}` }],
        styleKit: { refImages: [] } },
    }));
    localStorage.setItem('vc_library', JSON.stringify(projects));
    localStorage.setItem('vc_brands', JSON.stringify([brand]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('logo-active'));
    localStorage.setItem('vc_active_brand_id', JSON.stringify('b1'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    localStorage.setItem('vc_data_owner', JSON.stringify(owner));
  }, { owner: `email:${SESSAO_ATIVA.email}` });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await page.getByRole('tab', { name: /^Marca$/ }).first().click();
  await page.getByText('Logo nos cards', { exact: true }).click();
  const otherBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library')).find(entry => entry.id === 'logo-other'));
  const source = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 120;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#12bfcf'; ctx.fillRect(80, 20, 560, 80);
    return canvas.toDataURL('image/png');
  });
  await page.getByLabel('Arquivo da logo da marca', { exact: true }).setInputFiles({
    name: 'marca-transparente.png', mimeType: 'image/png', buffer: Buffer.from(source.split(',')[1], 'base64'),
  });
  const savedLogo = () => page.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem('vc_brands') || '[]')[0];
    const doc = JSON.parse(localStorage.getItem('vc_library') || '[]').find(entry => entry.id === 'logo-active')?.doc;
    return { profileId: profile?.logoImageId, docId: doc?.brand?.logoImageId,
      profileInline: profile?.logo || null, docInline: doc?.brand?.logo || null };
  });
  await expect.poll(async () => (await savedLogo()).profileId).toMatch(/^img_/);
  const saved = await savedLogo();
  await expect.poll(async () => (await savedLogo()).docId).toBe(saved.profileId);
  expect(await savedLogo()).toEqual({ profileId: saved.profileId, docId: saved.profileId, profileInline: null, docInline: null });
  const logo = page.locator('main [data-vc-card-surface="logo-active-s"] img[data-vc-brand-logo]').first();
  const pixels = async () => logo.evaluate(async img => {
    await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    return { edge: [...ctx.getImageData(0, 0, 1, 1).data], center: [...ctx.getImageData(360, 60, 1, 1).data] };
  });
  await expect(logo).toBeAttached();
  const expected = { edge: [0, 0, 0, 0], center: [18, 191, 207, 255] };
  await expect.poll(pixels).toEqual(expected);
  await page.reload();
  await enterEditorFromHome(page);
  await expect(logo).toBeAttached();
  await expect.poll(pixels).toEqual(expected);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library')).find(entry => entry.id === 'logo-other'))).toEqual(otherBefore);
  expect(errors).toEqual([]);
});
