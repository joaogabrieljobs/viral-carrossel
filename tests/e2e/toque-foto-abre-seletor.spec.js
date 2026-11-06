import { enterEditorFromHome } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { mockEditorApi as mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';


test('tocar em "inserir foto" no card abre o seletor e aplica a foto', async ({ page }) => {
  test.setTimeout(90_000);
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.route('https://api.openai.com/**', (r) => r.fulfill({ status: 401, json: { error: { message: 'E2E' } } }));
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await page.getByRole('button', { name: /abrir templates/i }).click({ force: true });
  const modal = page.locator('.modal-panel');
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await modal.getByRole('button').filter({ hasText: 'Erro Comum' }).first().click({ force: true });
  await expect(page.locator('[data-vc-tour="thumbnails"]')).toBeAttached({ timeout: 10_000 });

  const convite = page.locator('main').getByText(/inserir foto/i).first();
  await convite.scrollIntoViewIfNeeded();
  await expect(convite).toBeVisible();
  const antes = await page.locator('main').getByText(/inserir foto/i).count();
  const box = await convite.boundingBox();
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 5_000 });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'foto.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
  });
  await expect(page.locator('main').getByText(/inserir foto/i)).toHaveCount(antes - 1, { timeout: 10_000 });
});
