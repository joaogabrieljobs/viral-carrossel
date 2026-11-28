import { readFileSync } from 'node:fs';
import { test, expect as baseExpect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

const expect = baseExpect.configure({ timeout: 15_000 });
const fx = JSON.parse(readFileSync(new URL('../fixtures/apoteose10-slide8.json', import.meta.url), 'utf8'));
const W = Number(process.env.SETAS_W || 390);
test.use({ viewport: { width: W, height: Number(process.env.SETAS_H || Math.round(W * 2.165)) }, hasTouch: true, isMobile: true });

// João (28/11, iPhone): as setas de passar card ficavam metade sobre a foto e
// quase sumiam. Agora ficam fora do card: ao lado dele quando sobra espaço
// (Stories) e na linha de ações abaixo quando o card ocupa a largura (4:5).
for (const fmt of ['stories', 'carrossel']) {
  test(`celular ${fmt}: setas fora do card e passam de card`, async ({ page, context }) => {
    test.setTimeout(90_000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol) ? route.continue() : route.abort();
    });
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.addInitScript(({ fx, fmt }) => {
      if (localStorage.getItem('setas-seeded')) return;
      localStorage.setItem('setas-seeded', '1');
      localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
      localStorage.setItem('vc_shell_view', JSON.stringify('project'));
      localStorage.setItem('vc_active_doc_id', JSON.stringify('setas'));
      const slides = [0, 1, 2].map(i => ({ ...fx.slide, id: `s${i}`, num: i + 1, title: `Card ${i + 1}` }));
      localStorage.setItem('vc_library', JSON.stringify([{ id: 'setas', name: 'Setas', doc: {
        fmt, creativePreset: 'apresentacao', productKind: 'apresentacao', visualPreset: 'presentation_free', mode: 'editorial',
        brand: fx.brand, slides,
      } }]));
    }, { fx, fmt });
    await page.goto('/?app=1');
    await enterEditorFromHome(page);
    const card = page.locator('main [data-vc-card-surface="s0"]').first();
    await expect(card).toBeVisible();
    // No primeiro card só há "próximo"; avança para o meio e mede as duas.
    await page.getByRole('button', { name: 'Próximo slide' }).click();
    const meio = page.locator('main [data-vc-card-surface="s1"]').first();
    await expect(meio).toBeVisible();
    const c = await meio.boundingBox();
    if (process.env.SETAS_OUT) await page.screenshot({ path: `${process.env.SETAS_OUT}/setas-${fmt}.png` });
    for (const name of ['Slide anterior', 'Próximo slide']) {
      const b = await page.getByRole('button', { name }).boundingBox();
      const fora = b.x + b.width <= c.x || b.x >= c.x + c.width || b.y >= c.y + c.height || b.y + b.height <= c.y;
      expect(fora, `${name} não pode cobrir o card`).toBe(true);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(W);
      expect(b.width).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: 'Próximo slide' }).click();
    await expect(page.locator('main [data-vc-card-surface="s2"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Próximo slide' })).toHaveCount(0);
  });
}
