// Regressão do crash React #185 (loop de render no tour) e do realce vazio:
// o tour abria empilhado no modal de boas-vindas e destacava elementos tapados.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const TOTAL_PASSOS = 7;

test.describe('Tour de onboarding', () => {
  test('não abre empilhado no modal de boas-vindas', async ({ page }) => {
    await mockApi(page, { session: SESSAO_ATIVA, onboarding: true });
    await page.goto('/?app=1');

    await expect(page.getByText('Bem-vindo', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    // 850ms do tour + folga: enquanto o modal está aberto, nenhum card de tour.
    await page.waitForTimeout(1600);
    await expect(page.locator('[data-vc-tour-card]')).toHaveCount(0);
  });

  test('percorre os 7 passos sem erro de console e sem realce fora de alvo', async ({ page }) => {
    const erros = [];
    page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
    page.on('pageerror', (e) => erros.push(String(e)));

    await mockApi(page, { session: SESSAO_ATIVA, onboarding: true });
    await page.goto('/?app=1');

    await page.getByRole('button', { name: /fechar/i }).first().click();
    const card = page.locator('[data-vc-tour-card]');
    await expect(card).toBeVisible({ timeout: 10_000 });

    for (let passo = 1; passo <= TOTAL_PASSOS; passo += 1) {
      await expect(card).toBeVisible();
      // Quando há realce, o alvo tem de existir e ter caixa visível.
      const hole = page.locator('[data-vc-tour-hole]');
      if (await hole.count()) {
        const box = await hole.first().boundingBox();
        expect(box, `passo ${passo}: realce sem caixa`).not.toBeNull();
        expect(box.width, `passo ${passo}: realce demasiado estreito`).toBeGreaterThan(16);
        expect(box.height, `passo ${passo}: realce demasiado baixo`).toBeGreaterThan(16);
      }
      const avancar = page.getByRole('button', { name: /avançar|concluir|terminar/i }).first();
      await avancar.click();
      await page.waitForTimeout(450);
    }

    // Fim do tour: nada de error boundary, nada de loop de render.
    await expect(page.getByText(/Erro ao carregar o Viral Carrossel/i)).toHaveCount(0);
    expect(
      erros.filter((e) => /Maximum update depth|#185|Minified React error/i.test(e)),
      `Erros de render no tour:\n${erros.join('\n')}`,
    ).toEqual([]);
  });
});

test.describe('Copy do tour', () => {
  test('nenhum passo fala de .env, chave de API ou ambiente local', async ({ page }) => {
    await mockApi(page, { session: SESSAO_ATIVA, onboarding: true });
    await page.goto('/?app=1');
    await page.getByRole('button', { name: /fechar/i }).first().click();
    const card = page.locator('[data-vc-tour-card]');
    await expect(card).toBeVisible({ timeout: 10_000 });

    const proibido = /\.env|env\.local|desenvolvimento local|chaves de api|endpoint|localhost/i;
    for (let passo = 1; passo <= TOTAL_PASSOS; passo += 1) {
      const texto = await card.innerText();
      expect(texto, `passo ${passo} com linguagem de dev: ${texto}`).not.toMatch(proibido);
      await page.getByRole('button', { name: /avançar|concluir|terminar/i }).first().click();
      await page.waitForTimeout(400);
    }
  });
});
