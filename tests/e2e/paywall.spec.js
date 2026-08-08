// Task 07 — RF-15: paywall bloqueia o studio sem assinatura ativa.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ANONIMA, SESSAO_ATIVA } from './helpers/api-mock.js';

test.describe('Paywall (RF-15)', () => {
  test('anônimo em ?app=1 vê paywall, nunca o editor', async ({ page }) => {
    await mockApi(page, { session: SESSAO_ANONIMA });
    await page.goto('/?app=1');

    // Paywall pede e-mail pra assinar
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10_000 });
    // Editor não montou (thumbnail strip é exclusivo do editor)
    await expect(page.locator('[data-vc-tour="thumbnails"]')).toHaveCount(0);
  });

  test('assinante ativo em ?app=1 entra direto (sem paywall)', async ({ page }) => {
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.goto('/?app=1');

    await expect(page.locator('input[type="email"]')).toHaveCount(0, { timeout: 10_000 });
  });
});
