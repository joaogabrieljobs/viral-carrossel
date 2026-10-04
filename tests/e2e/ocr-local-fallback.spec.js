import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cardImage = path.resolve(here, '../../public/landing/carousel-01.png');

test('prints continuam sendo lidos no aparelho quando o OCR online cai', async ({ page }) => {
  await mockApi(page, {
    session: { ...SESSAO_ATIVA, tier: 'creator' },
    extra: {
      '/api/ai/ocr': (route) => route.fulfill({
        status: 503,
        json: { error: 'A leitura online está indisponível. O app tentará ler no seu aparelho.' },
      }),
    },
  });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click();
  await page.getByRole('button', { name: /Usar publicações para extrair o DNA/i }).click();
  await page.getByLabel('Imagens de carrosséis publicados').setInputFiles(cardImage);

  await expect(page.getByText(/1 imagem lida no seu aparelho/i)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByLabel('1 imagens lidas')).toBeVisible();
});
