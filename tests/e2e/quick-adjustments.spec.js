import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome, selectEditorMode } from './helpers/project-entry.js';

const PROJECT_ID = 'quick-adjustments-project';
const savedDoc = page => page.evaluate(id => JSON.parse(localStorage.getItem('vc_library') || '[]').find(entry => entry.id === id)?.doc, PROJECT_ID);

async function storedPngBytes(page, references) {
  return page.evaluate(async refs => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('viral-carrossel-img', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await Promise.all(refs.map(async reference => {
        if (reference.dataUrl?.startsWith('data:')) return reference.dataUrl.split(',')[1];
        const entry = await new Promise((resolve, reject) => {
          const request = db.transaction('images', 'readonly').objectStore('images').get(reference.imageId);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        if (!entry?.blob) return null;
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(entry.blob);
        });
      }));
    } finally { db.close(); }
  }, references);
}

const brandSettings = ({ logo, logoImageId, logoAssetId, ...brand }) => brand;

async function openQuickProject(page, width = 1440, withLogo = false) {
  await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
  let cloudManifest = null;
  let revision = 0;
  const cloudAssets = new Map();
  await mockApi(page, { session: SESSAO_ATIVA, extra: {
    '/api/library-sync': route => {
      const request = route.request();
      const url = new URL(request.url());
      const assetId = url.searchParams.get('asset');
      if (assetId) return route.fulfill({ json: { ok: true, asset: { assetId, dataUrl: cloudAssets.get(assetId) } } });
      if (url.searchParams.get('full') === '1') return route.fulfill({ json: { ok: true, manifest: cloudManifest } });
      const body = request.method() === 'POST' ? request.postDataJSON() : {};
      if (String(body.action).toLowerCase() === 'putasset') {
        cloudAssets.set(body.assetId, body.dataUrl);
        return route.fulfill({ json: { ok: true, assetId: body.assetId } });
      }
      if (body.action === 'push') {
        revision += 1;
        cloudManifest = { ...body.manifest, revision, updatedAt: Date.now() };
        return route.fulfill({ json: { ok: true, revision, updatedAt: cloudManifest.updatedAt, projectCount: cloudManifest.docs.length, assetIds: cloudManifest.assetIds || [] } });
      }
      return route.fulfill({ json: { ok: true, empty: !cloudManifest, meta: cloudManifest ? { revision, updatedAt: cloudManifest.updatedAt, projectCount: cloudManifest.docs.length, assetIds: cloudManifest.assetIds || [] } : null } });
    },
  } });
  await page.addInitScript(({ id, withLogo }) => {
    if (localStorage.getItem('quick-adjustments-seeded')) return;
    localStorage.setItem('quick-adjustments-seeded', '1');
    localStorage.setItem('vc_app_mode', JSON.stringify('criador'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(id));
    localStorage.setItem('vc_custom_visual_presets_v1', JSON.stringify([{
      id: 'custom_quick_test', label: 'Meu estilo salvo', isCustom: true,
      productKind: 'carrossel', brand: { bg: '#eee0cc', titleColor: '#231f20', textColor: '#45383a', accent: '#b14e5a', titleFont: 'Arial', bodyFont: 'Arial' },
      slideDefaults: { layout: 'mc', align: 'left', titleSize: 100, subSize: 100 },
    }]));
    const brand = { id: 'quick-brand', name: 'Marca rápida', bg: '#f9f8f4', titleColor: '#222222', textColor: '#333333', titleFont: 'Arial', bodyFont: 'Arial' };
    if (withLogo) {
      const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#1144bb'; ctx.fillRect(10, 10, 180, 80);
      Object.assign(brand, { logo: canvas.toDataURL('image/png'), logoPosition: 'tr', logoSize: 180, logoOpacity: 100 });
      localStorage.setItem('vc_brands', JSON.stringify([brand]));
      localStorage.setItem('vc_active_brand_id', JSON.stringify(brand.id));
    }
    localStorage.setItem('vc_library', JSON.stringify([{
      id, name: 'Projeto de ajustes rápidos', doc: {
        fmt: 'carrossel', creativePreset: 'livre', quickCardCount: 5,
        brand,
        slides: [1, 2, 3].map(number => ({ id: `quick-${number}`, title: `Ideia ${number}`, subtitle: `Explicação preservada ${number}`, bodyAfterImage: number === 1 ? 'Detalhe complementar do card' : '', strikethroughText: number === 1 ? 'R$ 700' : '', afterTitleText: number === 1 ? 'Por R$ 500' : '', layout: 'mc', align: 'left', photoRegion: 'none', titleSize: 100, subSize: 100, elementsUnlocked: true })),
      },
    }]));
  }, { id: PROJECT_ID, withLogo });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await expect(page.locator('#vc-cards-viewport')).toBeVisible();
}

async function openAdjustments(page, mobile = false) {
  await page.getByRole(mobile ? 'button' : 'tab', { name: mobile ? 'Abrir aba Ajustes' : 'Ajustes', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Estilos prontos', exact: true })).toBeVisible();
}

async function openText(page) {
  const details = page.locator('[data-vc-editor-section="texto-caixa"]').first();
  if (!await details.evaluate(node => node.open)) await details.locator('summary').click();
  return details;
}

test('Criar rápido reúne presets e texto; mantém dois destinos e outros modos completos', async ({ page }, testInfo) => {
  await openQuickProject(page);
  expect(await page.getByRole('tab').allTextContents()).toEqual(['Início', 'Ajustes']);
  const counts = page.getByRole('group', { name: 'Quantidade de cards', exact: true });
  await expect(counts).toBeVisible();
  await counts.getByRole('button', { name: '8', exact: true }).click();
  await expect.poll(async () => (await savedDoc(page)).quickCardCount).toBe(8);
  await openAdjustments(page);
  await page.screenshot({ path: testInfo.outputPath('quick-adjustments-initial-desktop.png') });
  const original = await savedDoc(page);
  const custom = page.getByRole('button', { name: 'Estilo Meu estilo salvo, salvo por você', exact: true });
  await expect(custom).toBeVisible();
  await custom.click();
  await expect.poll(async () => (await savedDoc(page)).slides[0].visualPresetId).toBe('custom_quick_test');
  await expect(custom).toHaveAttribute('aria-pressed', 'true');
  let styled = await savedDoc(page);
  expect(styled.slides.slice(1)).toEqual(original.slides.slice(1));
  expect(styled.slides.map(card => [card.title, card.subtitle])).toEqual(original.slides.map(card => [card.title, card.subtitle]));
  await page.getByRole('group', { name: 'Onde aplicar o estilo' }).getByRole('button', { name: 'Todos', exact: true }).click();
  await custom.click();
  await expect.poll(async () => (await savedDoc(page)).visualPreset).toBe('custom_quick_test');
  expect((await savedDoc(page)).slides.every(card => !card.visualBrand)).toBe(true);
  await page.getByRole('button', { name: 'Estilo Bold Promo Pink', exact: true }).click();
  await expect.poll(async () => (await savedDoc(page)).visualPreset).toBe('bold_promo_rosa');
  expect((await savedDoc(page)).slides.map(card => [card.title, card.subtitle, card.bodyAfterImage, card.strikethroughText, card.afterTitleText]))
    .toEqual(original.slides.map(card => [card.title, card.subtitle, card.bodyAfterImage, card.strikethroughText, card.afterTitleText]));

  const text = await openText(page);
  const complement = text.getByRole('textbox', { name: 'Texto complementar', exact: true });
  await expect(complement).toHaveValue('Detalhe complementar do card');
  await complement.fill('');
  await expect(complement).toBeVisible();
  await complement.fill('Complemento revisado sem perder o campo');
  await text.getByLabel('Título deste card', { exact: true }).fill('Título revisado sem trocar de modo');
  await text.getByRole('group', { name: 'Tamanho do título', exact: true }).getByRole('button', { name: 'Maior', exact: true }).click();
  await text.getByRole('group', { name: 'Alinhamento do texto' }).getByRole('button', { name: 'Centro', exact: true }).click();
  await expect.poll(async () => {
    const doc = await savedDoc(page);
    return [doc.slides[0].title, doc.slides[0].titleSize, doc.slides[0].align, doc.slides[1].title, doc.quickCardCount];
  }).toEqual(['Título revisado sem trocar de modo', 115, 'center', 'Ideia 2', 8]);
  expect(await page.getByRole('tab').allTextContents()).toEqual(['Início', 'Ajustes']);
  await page.screenshot({ path: testInfo.outputPath('quick-adjustments-desktop.png') });
  await page.getByRole('button', { name: 'Mais controles', exact: true }).click();
  expect(await page.getByRole('tab').allTextContents()).toEqual(['Início', 'Marca', 'Narrativa', 'Visual', 'Imagem', 'Texto']);
  await selectEditorMode(page, 'studio');
  await expect(page.getByRole('tab', { name: 'Layout', exact: true })).toBeVisible();
  await selectEditorMode(page, 'criador');
  expect(await page.getByRole('tab').allTextContents()).toEqual(['Início', 'Ajustes']);
  await page.reload();
  await enterEditorFromHome(page);
  await expect.poll(async () => (await savedDoc(page)).slides[0].title).toBe('Título revisado sem trocar de modo');
  await expect(page.getByRole('button', { name: /^Modo atual: Criar rápido/ })).toBeVisible();
});

test('mobile mostra Início e Ajustes; tocar texto abre edição e preserva quantidade', async ({ page }, testInfo) => {
  await openQuickProject(page, 390);
  const navigation = page.getByRole('navigation', { name: 'Abas do editor' });
  expect(await navigation.getByRole('button', { name: /^Abrir aba / }).allTextContents()).toEqual(['Início', 'Ajustes']);
  for (const name of ['Abrir aba Início', 'Abrir aba Ajustes']) await expect(navigation.getByRole('button', { name, exact: true })).toBeInViewport();
  await openAdjustments(page, true);
  await page.screenshot({ path: testInfo.outputPath('quick-adjustments-initial-mobile.png') });
  await page.getByRole('button', { name: 'Fechar editor', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir aba Início', exact: true }).click();
  const counts = page.getByRole('group', { name: 'Quantidade de cards', exact: true });
  await counts.getByRole('button', { name: 'Outro', exact: true }).click();
  const countInput = page.getByLabel('Número personalizado de cards', { exact: true });
  await countInput.fill('13');
  await countInput.press('Enter');
  await expect.poll(async () => (await savedDoc(page)).quickCardCount).toBe(13);
  await page.getByRole('button', { name: 'Fechar editor', exact: true }).click();
  await page.locator('main [data-vc-card-surface="quick-1"] [data-vc-movable="title"]').click();
  await expect(page.getByRole('tab', { name: 'Ajustes', exact: true })).toHaveAttribute('aria-selected', 'true');
  const title = page.getByLabel('Título deste card', { exact: true });
  await expect(title).toBeVisible();
  await expect(title).toBeFocused();
  await title.fill('Uma ideia clara no celular');
  await expect.poll(async () => (await savedDoc(page)).slides[0].title).toBe('Uma ideia clara no celular');
  await page.getByRole('button', { name: 'Fechar editor', exact: true }).click();
  await page.locator('main [data-vc-card-surface="quick-1"] [data-vc-movable="subtitle"]').click();
  const support = page.getByLabel('Texto de apoio deste card', { exact: true });
  await expect(support).toBeFocused();
  await expect(support).toBeInViewport();
  await support.fill('Texto de apoio revisado no celular');
  await expect.poll(async () => (await savedDoc(page)).slides[0].subtitle).toBe('Texto de apoio revisado no celular');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('quick-adjustments-mobile.png') });
  await page.getByRole('button', { name: 'Fechar editor', exact: true }).click();
  expect(await navigation.getByRole('button', { name: /^Abrir aba / }).allTextContents()).toEqual(['Início', 'Ajustes']);
  expect((await savedDoc(page)).quickCardCount).toBe(13);
  await page.reload();
  await enterEditorFromHome(page);
  await openAdjustments(page, true);
  await openText(page);
  await expect(page.getByLabel('Título deste card', { exact: true })).toHaveValue('Uma ideia clara no celular');
  expect((await savedDoc(page)).quickCardCount).toBe(13);
});


test('logo e foto dos ajustes persistem sem mudar a marca salva nem os textos', async ({ page }) => {
  await openQuickProject(page, 1440, true);
  const roster = () => page.evaluate(() => JSON.parse(localStorage.getItem('vc_brands') || '[]').find(brand => brand.id === 'quick-brand'));
  const beforeDoc = await savedDoc(page);
  const beforeBrand = await roster();
  const beforeBrandBytes = await storedPngBytes(page, [{ imageId: beforeBrand.logoImageId, dataUrl: beforeBrand.logo }]);
  const uploads = await page.evaluate(() => {
    const make = (color, transparent) => {
      const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 200;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = color;
      ctx.fillRect(transparent ? 20 : 0, transparent ? 20 : 0, transparent ? 180 : 400, transparent ? 160 : 200);
      return canvas.toDataURL('image/png').split(',')[1];
    };
    return { logo: make('#e14b27', true), photo: make('#168764', false) };
  });
  await openAdjustments(page);
  await page.locator('[data-vc-editor-section="marca-logo"] summary').click();
  await page.getByLabel('Enviar logo do projeto', { exact: true }).setInputFiles({ name: 'nova-logo.png', mimeType: 'image/png', buffer: Buffer.from(uploads.logo, 'base64') });
  await expect.poll(async () => (await savedDoc(page)).styleKit?.logo?.imageId).toBeTruthy();
  const updated = await savedDoc(page);
  expect(updated.slides.every(slide => slide.logoImageId === updated.styleKit.logo.imageId && !slide.logoHidden)).toBe(true);
  expect(updated.slides.map(slide => [slide.title, slide.subtitle])).toEqual(beforeDoc.slides.map(slide => [slide.title, slide.subtitle]));
  expect(await roster()).toEqual(beforeBrand);
  const logo = page.locator('main [data-vc-card-surface="quick-1"] img[data-vc-brand-logo]').first();
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate(async img => {
    await img.decode(); const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, img.naturalWidth / 4, img.naturalHeight / 2, 1, 1, 0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data);
  })).toEqual([225, 75, 39, 255]);
  await page.locator('[data-vc-editor-section="imagem-ajustes"] summary').click();
  await page.getByLabel('Enviar imagem para este card', { exact: true }).setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(uploads.photo, 'base64') });
  await expect.poll(async () => (await savedDoc(page)).slides[0].bgImageId).toBeTruthy();
  await page.getByRole('button', { name: 'Foto inteira', exact: true }).click();
  await expect.poll(async () => {
    const slide = (await savedDoc(page)).slides[0];
    return [slide.bgFit, slide.bgX, slide.bgY, slide.bgZoom];
  }).toEqual(['contain', 50, 50, 100]);
  await page.reload();
  await enterEditorFromHome(page);
  const reloaded = await savedDoc(page);
  // A restauração cria chaves de cache independentes para o mesmo PNG;
  // compare os bytes de cada referência e o asset remoto, não IDs transitórios.
  expect(reloaded.styleKit.logo.imageId).toBeTruthy();
  expect(reloaded.styleKit.logo.assetId).toBeTruthy();
  expect(reloaded.slides.every(slide => slide.logoImageAssetId === reloaded.styleKit.logo.assetId)).toBe(true);
  expect(await storedPngBytes(page, [
    { imageId: reloaded.styleKit.logo.imageId },
    ...reloaded.slides.map(slide => ({ imageId: slide.logoImageId })),
  ])).toEqual(Array(4).fill(uploads.logo));
  expect(reloaded.slides[0].bgImageId).toBeTruthy();
  expect(reloaded.slides[0].bgFit).toBe('contain');
  const reloadedBrand = await roster();
  expect(brandSettings(reloadedBrand)).toEqual(brandSettings(beforeBrand));
  expect(await storedPngBytes(page, [{ imageId: reloadedBrand.logoImageId, dataUrl: reloadedBrand.logo }])).toEqual(beforeBrandBytes);
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate(async img => {
    await img.decode(); const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, img.naturalWidth / 4, img.naturalHeight / 2, 1, 1, 0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data);
  })).toEqual([225, 75, 39, 255]);
});
