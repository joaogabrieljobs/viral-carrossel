import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

// Pedido do João (27/11): no celular, a pinça amplia a tela e não pode arrastar
// o texto (nem a moldura da foto) que estava sob o primeiro dedo.
const fx = JSON.parse(readFileSync(new URL('../fixtures/apoteose10-slide9.json', import.meta.url), 'utf8'));
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('pinça sobre o título e sobre a foto selecionada amplia a tela sem mover nada', async ({ page, context }) => {
  test.setTimeout(90_000);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol) ? route.continue() : route.abort();
  });
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript((fx) => {
    if (localStorage.getItem('pinca-seeded')) return;
    localStorage.setItem('pinca-seeded', '1');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="1920" fill="#7a2a40"/></svg>';
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('pinca'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'pinca', name: 'Pinça', doc: {
      fmt: 'stories', creativePreset: 'apresentacao', productKind: 'apresentacao', visualPreset: 'presentation_free', mode: 'editorial',
      brand: fx.brand,
      slides: [{ ...fx.slide, bgImage: `data:image/svg+xml;base64,${btoa(svg)}` }],
      formatViews: { stories: { brand: {}, slides: { [fx.slide.id]: fx.stories } }, apresentacao: { brand: {} } },
    } }]));
  }, fx);
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  const card = page.locator(`main [data-vc-card-surface="${fx.slide.id}"]`).first();
  await expect(card).toBeVisible();
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i })) });
  // Dedo 1 pousa no alvo, anda um pouco (como na vida real), o dedo 2 chega e os dois abrem.
  const pinch = async (p) => {
    await touch('touchStart', [p]);
    for (let i = 1; i <= 4; i++) await touch('touchMove', [{ x: p.x + i * 5, y: p.y + i * 2 }]);
    await touch('touchStart', [{ x: p.x + 20, y: p.y + 8 }, { x: p.x + 70, y: p.y + 40 }]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [{ x: p.x + 20 - i * 10, y: p.y + 8 - i * 6 }, { x: p.x + 70 + i * 10, y: p.y + 40 + i * 6 }]);
    await touch('touchEnd', []);
  };
  // Posição na tela: a gravação no armazenamento local chega com atraso.
  const title = card.locator('[data-vc-zone="title"]');
  const photo = card.locator('[data-vc-photo-zone]');
  const snapshot = async () => ({
    title: await title.evaluate(el => el.style.transform || 'none'),
    photo: await photo.evaluate(el => { const r = el.getBoundingClientRect(); const c = el.closest('[data-vc-card-surface]').getBoundingClientRect(); return [Math.round((r.x - c.x) / c.width * 1000), Math.round((r.y - c.y) / c.height * 1000), Math.round(r.width / c.width * 1000), Math.round(r.height / c.height * 1000)].join(','); }),
  });
  const fit = page.getByRole('button', { name: 'Ajustar card à tela' });
  const before = await snapshot();
  const tb = await title.boundingBox();
  await pinch({ x: tb.x + tb.width * 0.4, y: tb.y + tb.height * 0.5 });
  await expect(fit).toBeVisible();
  expect(await snapshot()).toEqual(before);

  // Volta ao 100% e repete com a foto selecionada (fora do recorte).
  await fit.click();
  await expect(fit).toHaveCount(0);
  const b = await card.boundingBox();
  const meio = { x: b.x + b.width * 0.5, y: b.y + b.height * 0.45 };
  await touch('touchStart', [meio]); await touch('touchEnd', []);
  await expect(card.locator('[data-vc-photo-frame-editor="frame"]')).toHaveCount(1);
  const fotoAntes = await snapshot();
  await pinch(meio);
  await expect(fit).toBeVisible();
  expect(await snapshot()).toEqual(fotoAntes);
});
