import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

// Pedido do João (27/11, Apoteose 10): clicar na foto e mudar o tamanho da
// moldura pelas alças, mover a foto no card com a mão e, com duplo clique,
// recortar (arrastar a imagem dentro da moldura e dar zoom).
const fx = JSON.parse(readFileSync(new URL('../fixtures/apoteose10-slide9.json', import.meta.url), 'utf8'));
const OUT = process.env.QA_FOTO_MOLDURA_DIR;

test('foto: alças mudam o tamanho, arrastar move a moldura e o duplo clique recorta com zoom', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1400, height: 950 });
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol) ? route.continue() : route.abort();
  });
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript((fx) => {
    if (localStorage.getItem('foto-moldura-seeded')) return;
    localStorage.setItem('foto-moldura-seeded', '1');
    // Foto retrato 1080×1920 com faixas para o enquadramento ser visível.
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="640" fill="#d0603a"/><rect y="640" width="1080" height="640" fill="#2ab5d7"/><rect y="1280" width="1080" height="640" fill="#21cd21"/></svg>';
    const photo = `data:image/svg+xml;base64,${btoa(svg)}`;
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('foto-moldura'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'foto-moldura', name: 'Foto moldura', doc: {
      fmt: 'stories', creativePreset: 'apresentacao', productKind: 'apresentacao', visualPreset: 'presentation_free', mode: 'editorial',
      brand: fx.brand,
      slides: [{ ...fx.slide, bgImage: photo }],
      formatViews: { stories: { brand: {}, slides: { [fx.slide.id]: fx.stories } }, apresentacao: { brand: {} } },
    } }]));
  }, fx);
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  const card = page.locator(`main [data-vc-card-surface="${fx.slide.id}"]`).first();
  await expect(card).toBeVisible();
  const view = () => page.evaluate((id) => {
    const doc = JSON.parse(localStorage.getItem('vc_library'))[0].doc;
    const entry = doc.formatViews.stories.slides[id];
    return { zone: entry.canvas?.zones?.photo, bgX: entry.bgX, bgY: entry.bgY, bgZoom: entry.bgZoom, bgFit: entry.bgFit, off: entry.elementOffsets?.photo };
  }, fx.slide.id);
  const box = async () => card.boundingBox();
  const at = async (px, py) => { const b = await box(); return { x: b.x + b.width * px, y: b.y + b.height * py }; };
  const drag = async (from, to) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
  };

  // 1. Seleciona a foto (área sem texto) e aparece a moldura com alças.
  const meio = await at(0.5, 0.45);
  await page.mouse.click(meio.x, meio.y);
  const editor = card.locator('[data-vc-photo-frame-editor]');
  await expect(editor).toHaveAttribute('data-vc-photo-frame-editor', 'frame');
  await expect(card.locator('[data-vc-photo-handle]')).toHaveCount(8);

  // 2. Alça do canto inferior direito: moldura menor, presa no canto oposto.
  const se = card.locator('[data-vc-photo-handle="se"]');
  const seBox = await se.boundingBox();
  const b0 = await box();
  await drag({ x: seBox.x + seBox.width / 2, y: seBox.y + seBox.height / 2 },
    { x: seBox.x + seBox.width / 2 - b0.width * 0.4, y: seBox.y + seBox.height / 2 - b0.height * 0.5 });
  await expect.poll(async () => (await view()).zone.w).toBeLessThan(90);
  const resized = (await view()).zone;
  expect(resized.w).toBeGreaterThan(55); expect(resized.w).toBeLessThan(65);
  expect(resized.h).toBeGreaterThan(45); expect(resized.h).toBeLessThan(55);
  if (OUT) await card.screenshot({ path: `${OUT}/1-alca.png` });

  // 3. Arrastar o miolo move a moldura inteira; o tamanho fica.
  const pega = await at(0.3, 0.45);
  await drag(pega, { x: pega.x + b0.width * 0.2, y: pega.y + b0.height * 0.1 });
  await expect.poll(async () => (await view()).zone.x).toBeGreaterThan(15);
  const moved = (await view()).zone;
  expect(moved.y).toBeGreaterThan(5);
  expect(moved.w).toBeCloseTo(resized.w, 1);
  expect(moved.h).toBeCloseTo(resized.h, 1);
  if (OUT) await card.screenshot({ path: `${OUT}/2-mover.png` });

  // 4. Duplo clique: recorte. Arrastar move a imagem e não a moldura.
  // Ponto da foto sem texto por cima (o título e o apoio ficam acima da foto).
  const centro = await at((moved.x + moved.w / 2) / 100, 0.45);
  expect(0.45 * 100).toBeGreaterThan(moved.y); expect(0.45 * 100).toBeLessThan(moved.y + moved.h);
  await page.mouse.dblclick(centro.x, centro.y);
  await expect(editor).toHaveAttribute('data-vc-photo-frame-editor', 'crop');
  const antes = await view();
  await drag(centro, { x: centro.x, y: centro.y + b0.height * 0.08 });
  await expect.poll(async () => (await view()).bgY).toBeLessThan(antes.bgY ?? 50);
  expect((await view()).zone).toEqual(moved);

  // 5. Roda do mouse e botão dão zoom; a imagem passa a sobrar nos dois eixos.
  await page.mouse.move(centro.x, centro.y);
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => (await view()).bgZoom).toBeGreaterThan(130);
  const zoom = (await view()).bgZoom;
  await editor.getByRole('button', { name: 'Aumentar o zoom da foto' }).click();
  await expect.poll(async () => (await view()).bgZoom).toBeGreaterThan(zoom);
  const x0 = (await view()).bgX;
  await drag(centro, { x: centro.x - b0.width * 0.1, y: centro.y });
  await expect.poll(async () => (await view()).bgX).toBeGreaterThan(x0);
  expect((await view()).off).toEqual({ x: 0, y: 0 });
  if (OUT) await card.screenshot({ path: `${OUT}/3-recorte.png` });

  // 6. Concluir volta à moldura; Desfazer volta o último gesto.
  await editor.getByRole('button', { name: 'Concluir' }).click();
  await expect(editor).toHaveAttribute('data-vc-photo-frame-editor', 'frame');
  // O arquivo exportado não leva moldura nem alças.
  await expect(page.locator('[data-vc-export-root] [data-vc-photo-frame-editor]')).toHaveCount(0);
});
