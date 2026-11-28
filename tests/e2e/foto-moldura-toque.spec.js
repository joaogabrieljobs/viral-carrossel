import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

const fx = JSON.parse(readFileSync(new URL('../fixtures/apoteose10-slide9.json', import.meta.url), 'utf8'));
const OUT = process.env.QA_FOTO_MOLDURA_DIR;
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

// Celular (27/11): tocar na foto só seleciona (o painel não abre), um dedo move a
// moldura sem trocar de card, duplo toque recorta e a pinça dá zoom na foto sem
// ampliar a tela.
test('toque: tocar seleciona, um dedo move, duplo toque recorta, pinça dá zoom', async ({ page, context }) => {
  test.setTimeout(90_000);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol) ? route.continue() : route.abort();
  });
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript((fx) => {
    if (localStorage.getItem('toque-seeded')) return;
    localStorage.setItem('toque-seeded', '1');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="640" fill="#d0603a"/><rect y="640" width="1080" height="640" fill="#2ab5d7"/><rect y="1280" width="1080" height="640" fill="#21cd21"/></svg>';
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('toque'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'toque', name: 'Toque', doc: {
      fmt: 'stories', creativePreset: 'apresentacao', productKind: 'apresentacao', visualPreset: 'presentation_free', mode: 'editorial',
      brand: fx.brand,
      slides: [{ ...fx.slide, bgImage: `data:image/svg+xml;base64,${btoa(svg)}` }, { ...fx.slide, id: 'outro', title: 'Outro card' }],
      formatViews: { stories: { brand: {}, slides: { [fx.slide.id]: fx.stories, outro: fx.stories } }, apresentacao: { brand: {} } },
    } }]));
  }, fx);
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  const card = page.locator(`main [data-vc-card-surface="${fx.slide.id}"]`).first();
  await expect(card).toBeVisible();
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i })) });
  const swipe = async (from, to, steps = 8) => {
    await touch('touchStart', [from]);
    for (let i = 1; i <= steps; i++) await touch('touchMove', [{ x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps }]);
    await touch('touchEnd', []);
  };
  const tap = async (p) => { await touch('touchStart', [p]); await touch('touchEnd', []); };
  const view = () => page.evaluate((id) => {
    const e = JSON.parse(localStorage.getItem('vc_library'))[0].doc.formatViews.stories.slides[id];
    return { zone: e.canvas?.zones?.photo, bgY: e.bgY, bgZoom: e.bgZoom };
  }, fx.slide.id);
  const b = await card.boundingBox();
  const at = (px, py) => ({ x: b.x + b.width * px, y: b.y + b.height * py });

  await tap(at(0.5, 0.45));
  const editor = card.locator('[data-vc-photo-frame-editor]');
  await expect(editor).toHaveAttribute('data-vc-photo-frame-editor', 'frame');
  // Alça inferior direita com o dedo.
  const se = await card.locator('[data-vc-photo-handle="se"]').boundingBox();
  await swipe({ x: se.x + se.width / 2, y: se.y + se.height / 2 }, { x: se.x - b.width * 0.35, y: se.y - b.height * 0.45 });
  await expect.poll(async () => (await view()).zone.w).toBeLessThan(80);
  // Um dedo move a moldura e não troca de card.
  await swipe(at(0.3, 0.45), at(0.45, 0.5));
  await expect.poll(async () => (await view()).zone.x).toBeGreaterThan(8);
  await expect(card).toBeVisible();
  const z = (await view()).zone;
  // Duplo toque: recorte.
  const p = at((z.x + z.w / 2) / 100, 0.45);
  await tap(p); await page.waitForTimeout(80); await tap(p);
  await expect(editor).toHaveAttribute('data-vc-photo-frame-editor', 'crop');
  const y0 = (await view()).bgY ?? 50;
  await swipe(p, { x: p.x, y: p.y + 40 });
  await expect.poll(async () => (await view()).bgY).toBeLessThan(y0);
  // Pinça abre: zoom.
  await touch('touchStart', [{ x: p.x - 20, y: p.y }, { x: p.x + 20, y: p.y }]);
  for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: p.x - 20 - i * 8, y: p.y }, { x: p.x + 20 + i * 8, y: p.y }]);
  await touch('touchEnd', []);
  await expect.poll(async () => (await view()).bgZoom).toBeGreaterThan(150);
  await expect(page.getByText(/Ajustar · \d+%/)).toHaveCount(0);
  if (OUT) await page.screenshot({ path: `${OUT}/4-celular-recorte.png` });
});
