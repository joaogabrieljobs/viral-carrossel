import { readFileSync } from 'node:fs';
import { test, expect as baseExpect } from '@playwright/test';

// O que o card grava chega ao armazenamento local com atraso (debounce); sob
// carga da suíte inteira, 5 s não bastavam.
const expect = baseExpect.configure({ timeout: 15_000 });
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
  // Medido na tela: o armazenamento local grava com atraso (debounce).
  const shown = () => card.evaluate(root => {
    const c = root.getBoundingClientRect();
    const ed = root.querySelector('[data-vc-photo-frame-editor]')?.getBoundingClientRect();
    const img = [...root.querySelectorAll('[data-vc-photo-zone] div')].find(el => getComputedStyle(el).backgroundImage.startsWith('url('));
    const style = img && getComputedStyle(img);
    const scale = style && style.transform !== 'none' ? Number(style.transform.match(/matrix\(([^,]+)/)?.[1]) : 1;
    return {
      zone: ed && { x: (ed.x - c.x) / c.width * 100, w: ed.width / c.width * 100 },
      bgY: style ? parseFloat(style.backgroundPosition.split(' ')[1]) : null,
      zoom: Math.abs(scale) * 100,
    };
  });
  const b = await card.boundingBox();
  const at = (px, py) => ({ x: b.x + b.width * px, y: b.y + b.height * py });

  await tap(at(0.5, 0.45));
  const editor = card.locator('[data-vc-photo-frame-editor]');
  await expect(editor).toHaveAttribute('data-vc-photo-frame-editor', 'frame');
  // Alça inferior direita com o dedo.
  const se = await card.locator('[data-vc-photo-handle="se"]').boundingBox();
  await swipe({ x: se.x + se.width / 2, y: se.y + se.height / 2 }, { x: se.x - b.width * 0.35, y: se.y - b.height * 0.45 });
  await expect.poll(async () => (await shown()).zone.w).toBeLessThan(80);
  // Um dedo move a moldura e não troca de card.
  await swipe(at(0.3, 0.45), at(0.45, 0.5));
  await expect.poll(async () => (await shown()).zone.x).toBeGreaterThan(8);
  await expect(card).toBeVisible();
  // Duplo toque: recorte.
  // Ponto pela moldura na tela (o armazenamento local grava com atraso).
  const eb = await editor.boundingBox();
  // Altura de 45% do card: dentro da moldura e sem texto por cima.
  const p = { x: eb.x + eb.width / 2, y: b.y + b.height * 0.45 };
  expect(p.y).toBeGreaterThan(eb.y); expect(p.y).toBeLessThan(eb.y + eb.height * 0.8);
  await tap(p); await page.waitForTimeout(80); await tap(p);
  await expect(editor).toHaveAttribute('data-vc-photo-frame-editor', 'crop');
  const y0 = (await shown()).bgY;
  await swipe(p, { x: p.x, y: p.y + 40 });
  await expect.poll(async () => (await shown()).bgY).toBeLessThan(y0);
  // Pinça abre: zoom.
  await touch('touchStart', [{ x: p.x - 20, y: p.y }, { x: p.x + 20, y: p.y }]);
  for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: p.x - 20 - i * 8, y: p.y }, { x: p.x + 20 + i * 8, y: p.y }]);
  await touch('touchEnd', []);
  await expect.poll(async () => (await shown()).zoom).toBeGreaterThan(150);
  await expect(page.getByText(/Ajustar · \d+%/)).toHaveCount(0);
  if (OUT) await page.screenshot({ path: `${OUT}/4-celular-recorte.png` });
});
