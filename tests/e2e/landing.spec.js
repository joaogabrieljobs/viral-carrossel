// Task 07 — RF-01: landing renderiza sem erro de console.
import { test, expect } from '@playwright/test';
import { mockApi } from './helpers/api-mock.js';

test.describe('Landing (RF-01)', () => {
  test('renderiza hero e CTA sem nenhum erro de console', async ({ page }) => {
    const errosConsole = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errosConsole.push(msg.text());
    });
    page.on('pageerror', (err) => errosConsole.push(String(err)));

    await mockApi(page);
    await page.goto('/?landing=1');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Carrossel que prende');
    await expect(page.getByRole('button', { name: /entrar no studio/i }).first()).toBeVisible();

    expect(errosConsole, `Erros de console na landing:\n${errosConsole.join('\n')}`).toEqual([]);
  });

  test('seções principais presentes (como funciona, modos, FAQ)', async ({ page }) => {
    await mockApi(page);
    await page.goto('/?landing=1');
    await expect(page.locator('#como-funciona')).toBeAttached();
    await expect(page.locator('#modos')).toBeAttached();
    await expect(page.getByRole('heading', { name: /antes de assinar/i })).toBeAttached();
  });
});
