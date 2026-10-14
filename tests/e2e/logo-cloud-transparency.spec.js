import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

async function connectCloud(page, state) {
  await page.context().route('**/*', (route) => {
    const { hostname, protocol } = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(hostname) || !/^https?:$/.test(protocol)
      ? route.continue() : route.abort('blockedbyclient');
  });
  await mockApi(page, { session: SESSAO_ATIVA, extra: {
    '/api/library-sync': async (route) => {
      if (!state.online) return route.fulfill({ status: 503, json: { error: 'E2E: offline durante importação.' } });
      const request = route.request();
      const url = new URL(request.url());
      if (url.searchParams.has('asset')) {
        const id = url.searchParams.get('asset');
        // A store real procura JPEG antes de PNG caso ambos tenham o mesmo ID.
        const dataUrl = state.legacyJpegs.get(id) || state.assets.get(id);
        return dataUrl ? route.fulfill({ json: { asset: { dataUrl } } })
          : route.fulfill({ status: 404, json: { error: 'Asset ausente.' } });
      }
      if (url.searchParams.get('full') === '1') {
        state.pulls += 1;
        return route.fulfill({ json: { ok: true, manifest: state.manifest } });
      }
      const body = request.postDataJSON();
      if (body.action === 'putAsset') {
        state.uploads.push(body);
        state.assets.set(body.assetId, body.dataUrl);
        return route.fulfill({ json: { ok: true } });
      }
      if (body.action === 'push') {
        state.manifest = { ...body.manifest, revision: (state.manifest?.revision || 0) + 1, updatedAt: Date.now() };
        return route.fulfill({ json: { ok: true, revision: state.manifest.revision,
          updatedAt: state.manifest.updatedAt, projectCount: state.manifest.docs.length } });
      }
      return route.fulfill({ json: state.manifest
        ? { ok: true, empty: false, meta: { revision: state.manifest.revision,
            projectCount: state.manifest.docs.length, assetIds: [...state.assets.keys()] } }
        : { ok: true, empty: true } });
    },
  } });
}

async function logoPixels(page) {
  const logo = page.locator('main [data-vc-movable="logo"] img').first();
  await expect(logo).toBeVisible();
  return logo.evaluate(async (img) => {
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    let opaque = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) transparent += 1;
      if (pixels[i] === 255) opaque += 1;
    }
    return { width: canvas.width, height: canvas.height, transparent, opaque,
      pixels: canvas.toDataURL('image/png') };
  });
}

test('logo branca conserva transparência após Salvar, restaurar em outro navegador e reeditar', async ({ page, browser }, testInfo) => {
  test.setTimeout(60_000);
  const state = { online: false, manifest: null, assets: new Map(), legacyJpegs: new Map(), uploads: [], pulls: 0 };
  await connectCloud(page, state);
  await page.addInitScript(({ owner }) => {
    if (localStorage.getItem('vc_library')) return;
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'logo-cloud', name: 'Logo transparente', updatedAt: 1,
      doc: { fmt: 'feed', brand: { id: 'b1', name: 'Marca de teste' },
        slides: [{ id: 's1', title: 'Transparência preservada' }], styleKit: { refImages: [] } } }]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('logo-cloud'));
    localStorage.setItem('vc_shell_view', JSON.stringify('home'));
    localStorage.setItem('vc_data_owner', JSON.stringify(owner));
  }, { owner: `email:${SESSAO_ATIVA.email}` });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: 'Abrir Logo transparente', exact: true }).click();
  const source = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 240; canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('MARCA', 16, 36);
    ctx.fillStyle = '#12bfcf';
    ctx.fillRect(210, 12, 12, 24);
    return canvas.toDataURL('image/png');
  });
  await page.getByRole('tab', { name: /^Marca$/ }).first().click();
  await page.getByLabel('Arquivo PNG da logo deste card', { exact: true }).setInputFiles({
    name: 'marca-branca-transparente.png', mimeType: 'image/png', buffer: Buffer.from(source.split(',')[1], 'base64'),
  });
  const before = await logoPixels(page);
  expect(before.transparent).toBeGreaterThan(0);
  expect(before.opaque).toBeGreaterThan(0);
  await page.locator('main [data-vc-card-surface="s1"]').first().screenshot({ path: testInfo.outputPath('logo-before-save.png') });
  const readId = () => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]')[0]?.doc?.slides[0]?.logoImageId);
  await expect.poll(readId).toMatch(/^img_/);
  const legacyId = await readId();
  const legacyWhite = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 240; canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 240, 48);
    return canvas.toDataURL('image/jpeg');
  });
  state.legacyJpegs.set(legacyId, legacyWhite);
  state.online = true;
  await page.getByRole('button', { name: /salvar projeto agora/i }).click();
  await expect.poll(() => state.pulls).toBeGreaterThan(0);
  await expect.poll(() => state.uploads.length).toBeGreaterThan(0);
  expect(state.uploads.every((asset) => asset.contentType === 'image/png' && asset.dataUrl === source)).toBe(true);
  expect(state.manifest.docs[0].doc.slides[0].logoImageAssetId).not.toBe(legacyId);
  expect(await logoPixels(page)).toEqual(before);

  // Contexto novo: bytes restaurados da nuvem, sem acesso ao IndexedDB original.
  const otherContext = await browser.newContext();
  try {
    const restored = await otherContext.newPage();
    await connectCloud(restored, state);
    await restored.goto('/?app=1&login=password');
    await restored.getByRole('button', { name: 'Abrir Logo transparente', exact: true }).click();
    expect(await logoPixels(restored)).toEqual(before);
    await restored.getByRole('tab', { name: /^Marca$/ }).first().click();
    await restored.getByLabel('Posição da logo neste card', { exact: true }).selectOption('bl');
    await restored.getByRole('button', { name: /salvar projeto agora/i }).click();
    await expect.poll(() => state.manifest.docs[0].doc.slides[0].logoPosition).toBe('bl');
    await restored.reload();
    expect(await logoPixels(restored)).toEqual(before);
    await restored.locator('main [data-vc-card-surface="s1"]').first().screenshot({ path: testInfo.outputPath('logo-after-restore-edit-reload.png') });
  } finally {
    await otherContext.close();
  }
});
