// A árvore offscreen usada pelo html2canvas não pode conter texto de interface:
// "Toque para inserir foto" saía dentro do PNG exportado, e o controlo nativo do
// input de ficheiro aparecia por cima do título no card.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

test.describe('Export limpo de interface', () => {
  test('árvore de export não tem placeholder de foto nem input de ficheiro', async ({ page }) => {
    test.setTimeout(90_000);
    await mockApi(page, { session: SESSAO_ATIVA });
    // applyTemplate dispara geração de imagem por card — corta na hora, sem rede.
    await page.route('https://api.openai.com/**', (r) =>
      r.fulfill({ status: 401, json: { error: { message: 'sem chave (E2E)' } } }),
    );
    await page.goto('/?app=1');

    const continuar = page.getByRole('button', { name: /continuar no editor/i });
    await expect(continuar).toBeVisible({ timeout: 10_000 });
    await continuar.click({ force: true });

    // Template dá cards com imageQuery e sem foto: é o estado que mostra o placeholder.
    await page.getByRole('button', { name: /abrir templates/i }).click({ force: true });
    const modal = page.locator('.modal-panel');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await modal.getByRole('button').filter({ hasText: 'Erro Comum' }).first().click({ force: true });
    await expect(page.locator('[data-vc-tour="thumbnails"]')).toBeAttached({ timeout: 10_000 });

    const exportTree = page.locator('[data-vc-export-tree]');
    await expect(exportTree).toHaveCount(1);
    await expect(exportTree.getByText(/inserir foto/i)).toHaveCount(0);
    await expect(exportTree.getByText(/Área da imagem/i)).toHaveCount(0);
    await expect(exportTree.locator('input[type="file"]')).toHaveCount(0);

    // No editor visível o utilizador continua a ver o convite para inserir foto.
    const total = await page.getByText(/inserir foto/i).count();
    expect(total).toBeGreaterThan(0);
  });

  test('camada de toque da foto não mostra o controlo nativo', async ({ page }) => {
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.goto('/?app=1');
    const opacidades = await page.evaluate(() => [...document.querySelectorAll('input[type="file"].vc-photo-hit')]
      .map((el) => {
        const cs = getComputedStyle(el);
        return { opacity: Number(cs.opacity), fontSize: cs.fontSize, color: cs.color };
      }));
    for (const o of opacidades) {
      expect(o.opacity).toBeLessThan(0.01);
      expect(o.fontSize).toBe('0px');
      expect(o.color).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    }
  });
});
