import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

test('preserva assunto lateral, compartilha recorte com export e respeita ajuste manual', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1680, height: 1000 });
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol)
      ? route.continue() : route.abort();
  });
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(() => {
    if (localStorage.getItem('framing-seeded')) return;
    localStorage.setItem('framing-seeded', '1');
    // Assunto isolado no extremo direito: o corte central escondia metade dele.
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 900;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#202020'; ctx.fillRect(0, 0, 1600, 900);
    ctx.fillStyle = '#ffc26b'; ctx.fillRect(1300, 180, 220, 360);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(1330, 220, 160, 80);
    ctx.fillStyle = '#9b4521'; ctx.fillRect(1330, 330, 160, 150);
    const bgImage = canvas.toDataURL();
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('framing'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'framing', name: 'Enquadramento', doc: {
      fmt: 'apresentacao', creativePreset: 'apresentacao',
      brand: { bg: '#161616', titleColor: '#ffffff', subtitleColor: '#ffffff', textColor: '#ffffff',
        titleFont: 'Arial', bodyFont: 'Arial', subtitleFont: 'Arial', showHandle: false },
      slides: [{ id: 'subject', bgImage, bgFit: 'cover', bgX: 50, bgY: 50,
        title: 'Assunto dentro do quadro', subtitle: 'Enquadramento sem perder a imagem.',
        presentationCompositionId: 'presentation_split', canvas: null, layout: 'bl' }],
    } }]));
  });
  await page.goto('/?app=1');
  const card = page.locator('main [data-vc-card-surface="subject"]');
  const photo = card.locator('[data-vc-photo-zone] [style*="background-image"]');
  await expect(card).toBeVisible();
  for (const [label, ratio] of [['Feed 4:5', 4 / 5], ['Quadrado', 1], ['Stories', 9 / 16]]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(card).not.toHaveAttribute('data-vc-framing-pending', 'true');
    await expect(photo).toHaveCount(1);
    const pos = await photo.evaluate(el => parseFloat(el.style.backgroundPositionX));
    expect(pos).toBeGreaterThan(80);
    const cropW = 900 * ratio;
    const cropX = (1600 - cropW) * pos / 100;
    expect(cropX).toBeLessThan(1300);
    expect(cropX + cropW).toBeGreaterThanOrEqual(1520);
    const exported = page.locator('[data-vc-export-tree] [data-vc-card-surface="subject"] [data-vc-photo-zone] [style*="background-image"]');
    await expect(exported).toHaveCSS('background-position', await photo.evaluate(el => el.style.backgroundPosition));
  }
  await page.getByRole('button', { name: 'Quadrado', exact: true }).click();
  await page.getByRole('button', { name: 'Editar foto do card 1', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Posicionar foto' });
  await expect(modal.getByRole('button', { name: 'Priorizar assunto' })).toHaveAttribute('aria-pressed', 'true');
  const autoPosition = await photo.evaluate(el => el.style.backgroundPosition);
  await modal.getByRole('slider').fill('110');
  await expect(photo).toHaveCSS('background-position', autoPosition);
  await modal.getByRole('button', { name: 'Priorizar assunto' }).click();
  const preview = modal.locator('img');
  await expect.poll(() => preview.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  const rect = await preview.boundingBox();
  const beforeDrag = await photo.evaluate(el => parseFloat(el.style.backgroundPositionX));
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 12, rect.y + rect.height / 2, { steps: 3 });
  await page.mouse.up();
  const afterDrag = await photo.evaluate(el => parseFloat(el.style.backgroundPositionX));
  expect(afterDrag).toBeLessThan(beforeDrag);
  expect(afterDrag).toBeGreaterThan(beforeDrag - 10);
  await modal.getByRole('button', { name: 'Centralizar', exact: true }).click();
  await expect(photo).toHaveCSS('background-position', '50% 50%');
  await modal.getByRole('button', { name: 'Pronto', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('vc_library') || '[]')[0]?.doc?.formatViews?.quadrado?.slides?.subject?.photoFraming
  ))).toBe('manual');
  await page.reload();
  await expect(photo).toHaveCSS('background-position', '50% 50%');
  await page.getByRole('button', { name: 'Editar foto do card 1', exact: true }).click();
  await modal.getByRole('button', { name: 'Priorizar assunto' }).click();
  await expect.poll(() => photo.evaluate(el => parseFloat(el.style.backgroundPositionX))).toBeGreaterThan(80);
  await modal.getByRole('button', { name: 'Pronto', exact: true }).click();
  await card.screenshot({ path: testInfo.outputPath('assunto-enquadrado.png') });
});
