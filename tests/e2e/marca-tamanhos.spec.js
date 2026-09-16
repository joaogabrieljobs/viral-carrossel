// Cada item da assinatura tem a sua barra de tamanho: o valor certo depende da
// fonte da marca e do comprimento do texto do utilizador, logo não pode ser fixo
// no padrão visual.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

/** Tamanho de letra do item, medido no card do export (escala 1). */
async function tamanhoNoCard(page, texto) {
  return page.evaluate((t) => {
    const tree = document.querySelector('[data-vc-export-tree]') || document;
    const alvos = [...tree.querySelectorAll('span, div')]
      .filter((e) => (e.textContent || '').trim() === t && e.children.length === 0);
    if (!alvos.length) return null;
    return Math.round(parseFloat(getComputedStyle(alvos[0]).fontSize) * 10) / 10;
  }, texto);
}

async function moverBarra(page, rotulo, valor) {
  const slider = page.getByRole('slider', { name: new RegExp(rotulo, 'i') });
  await expect(slider).toBeVisible({ timeout: 5000 });
  await slider.fill(String(valor));
  await page.waitForTimeout(700);
}

test.describe('Tamanho dos itens da marca', () => {
  test('a barra muda o tamanho do item no card e o botão padrão repõe', async ({ page }) => {
    test.setTimeout(90_000);
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.goto('/?app=1');
    await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
    await page.waitForTimeout(800);

    await page.getByRole('tab', { name: /marca/i }).click({ force: true });
    // Barra editorial: escreve na coluna da esquerda e mede
    const inpEsquerda = page.getByText('Esquerda', { exact: true }).first().locator('xpath=following::input[1]');
    await inpEsquerda.fill('SELO TESTE', { force: true });
    await page.waitForTimeout(800);

    const base = await tamanhoNoCard(page, 'SELO TESTE');
    expect(base, 'item não encontrado no card').toBeGreaterThan(0);

    await moverBarra(page, 'Tamanho da barra', 200);
    const grande = await tamanhoNoCard(page, 'SELO TESTE');
    expect(grande).toBeGreaterThan(base * 1.5);

    await moverBarra(page, 'Tamanho da barra', 50);
    const pequeno = await tamanhoNoCard(page, 'SELO TESTE');
    expect(pequeno).toBeLessThan(base * 0.75);

    await page.getByRole('button', { name: /^padrão$/i }).first().click({ force: true });
    await page.waitForTimeout(700);
    expect(await tamanhoNoCard(page, 'SELO TESTE')).toBeCloseTo(base, 0);
  });

  test('o tamanho sobrevive ao reload', async ({ page }) => {
    test.setTimeout(90_000);
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.goto('/?app=1');
    await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
    await page.waitForTimeout(800);
    await page.getByRole('tab', { name: /marca/i }).click({ force: true });
    await page.getByText('Esquerda', { exact: true }).first().locator('xpath=following::input[1]').fill('SELO TESTE', { force: true });
    await moverBarra(page, 'Tamanho da barra', 150);
    const antes = await tamanhoNoCard(page, 'SELO TESTE');

    await page.reload();
    await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true, timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    expect(await tamanhoNoCard(page, 'SELO TESTE')).toBeCloseTo(antes, 0);
  });
});
