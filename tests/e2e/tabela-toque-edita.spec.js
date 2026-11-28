import { readFileSync } from 'node:fs';
import { test, expect as baseExpect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

const expect = baseExpect.configure({ timeout: 15_000 });
// Apoteose 10, slide 8 no Stories, como estava gravado em 28/11 02:19.
const fx = JSON.parse(readFileSync(new URL('../fixtures/apoteose10-slide8.json', import.meta.url), 'utf8'));
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

// João (28/11, iPhone): a tabela TRAÇO / LIMITE não dava para selecionar nem
// editar. A célula só entrava em edição com duplo clique de mouse; no celular
// um toque não fazia nada e o duplo toque não chega como duplo clique.
test('celular: tocar numa célula da tabela edita o texto dela', async ({ page, context }) => {
  test.setTimeout(90_000);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol) ? route.continue() : route.abort();
  });
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript((fx) => {
    if (localStorage.getItem('tabela-seeded')) return;
    localStorage.setItem('tabela-seeded', '1');
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('tabela'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'tabela', name: 'Tabela', doc: {
      fmt: 'stories', creativePreset: 'apresentacao', productKind: 'apresentacao', visualPreset: 'presentation_free', mode: 'editorial',
      brand: fx.brand, slides: [fx.slide],
      formatViews: { stories: { brand: {}, slides: { [fx.slide.id]: fx.storiesAtual } }, apresentacao: { brand: {} } },
    } }]));
  }, fx);
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  const card = page.locator(`main [data-vc-card-surface="${fx.slide.id}"]`).first();
  await expect(card).toBeVisible();
  const celula = card.locator('[data-vc-evidence-cell]', { hasText: 'Brasileira' }).first();
  await expect(celula).toBeVisible();
  const b = await celula.boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await expect(celula).toHaveAttribute('contenteditable', 'true');
  await expect(celula).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.insertText(' de verdade');
  await celula.evaluate(el => el.blur());
  await expect(card.locator('[data-vc-evidence-cell]', { hasText: 'Brasileira de verdade' })).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library'))[0].doc.slides[0].presentationBlocks[0].rows[0][0])).toBe('Brasileira de verdade');
});
