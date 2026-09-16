// A assinatura da marca (barra editorial, contador N/M, barra do rodapé e selo)
// vivia só no ramo legado full-bleed: nos cards com composição ou layout sanduíche
// o utilizador preenchia os campos em Marca e nada aparecia no card.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

async function abrirEditorComTemplate(page) {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.route('https://api.openai.com/**', (r) =>
    r.fulfill({ status: 401, json: { error: { message: 'sem chave (E2E)' } } }));
  await page.goto('/?app=1');
  const continuar = page.getByRole('button', { name: /continuar no editor/i });
  await expect(continuar).toBeVisible({ timeout: 10_000 });
  await continuar.click({ force: true });
  await page.getByRole('button', { name: /abrir templates/i }).click({ force: true });
  const modal = page.locator('.modal-panel');
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await modal.getByRole('button').filter({ hasText: 'Erro Comum' }).first().click({ force: true });
  await expect(page.locator('[data-vc-tour="thumbnails"]')).toBeAttached({ timeout: 10_000 });
  await page.waitForTimeout(800);
}

/** Preenche o input que vem logo depois de um rótulo da sidebar. */
async function preencher(page, rotulo, valor, nth = 0) {
  const inp = page.getByText(rotulo, { exact: true }).nth(nth).locator('xpath=following::input[1]');
  await expect(inp).toBeVisible({ timeout: 5_000 });
  await inp.fill(valor, { force: true });
}

const contaNoCanvas = (page, texto) => page.evaluate(
  (t) => (document.querySelector('main')?.innerText || '').split(t).length - 1,
  texto,
);

test.describe('Assinatura da marca no card', () => {
  test('barra editorial, selo e rodapé aparecem em todos os cards, com e sem composição', async ({ page }) => {
    test.setTimeout(90_000);
    await abrirEditorComTemplate(page);
    const totalCards = await page.getByRole('button', { name: /^Slide \d+ de \d+$/ }).count();
    expect(totalCards).toBeGreaterThan(2);

    await page.getByRole('tab', { name: /marca/i }).click({ force: true });
    await preencher(page, 'Esquerda', 'SUA EDITORIA', 0);        // barra editorial (topo)
    await preencher(page, 'Texto', '#SELOTESTE', 0);             // selo do rodapé
    await preencher(page, 'Esquerda', 'Tema|Growth', 1);         // barra do rodapé
    await page.waitForTimeout(900);

    for (const [rotulo, texto] of [['editoria', 'SUA EDITORIA'], ['selo', '#SELOTESTE'], ['rodapé', 'Growth']]) {
      const n = await contaNoCanvas(page, texto);
      expect(n, `${rotulo} deveria aparecer nos ${totalCards} cards`).toBe(totalCards);
    }

    // Com composição ativa continua a aparecer (era aqui que desaparecia).
    await page.getByRole('button', { name: /modo atual/i }).click({ force: true });
    await page.getByText('Studio', { exact: true }).first().click({ force: true });
    await page.getByRole('tab', { name: /layout/i }).click({ force: true });
    await page.getByRole('button', { name: /ativar composição/i }).first().click({ force: true });
    await page.waitForTimeout(1200);

    for (const [rotulo, texto] of [['editoria', 'SUA EDITORIA'], ['selo', '#SELOTESTE'], ['rodapé', 'Growth']]) {
      const n = await contaNoCanvas(page, texto);
      expect(n, `${rotulo} com composição ativa`).toBe(totalCards);
    }
  });
});
