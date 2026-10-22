import { enterEditorFromHome } from './helpers/project-entry.js';
// A assinatura da marca (barra editorial, contador N/M, barra do rodapé e selo)
// vivia só no ramo legado full-bleed: nos cards com composição ou layout sanduíche
// o utilizador preenchia os campos em Marca e nada aparecia no card.
import { test, expect } from '@playwright/test';
import { mockEditorApi as mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

async function abrirEditorComTemplate(page) {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.route('https://api.openai.com/**', (r) =>
    r.fulfill({ status: 401, json: { error: { message: 'sem chave (E2E)' } } }));
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await page.getByRole('button', { name: /abrir templates/i }).click({ force: true });
  const modal = page.locator('.modal-panel');
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await modal.getByRole('button').filter({ hasText: 'Erro Comum' }).first().click({ force: true });
  await expect(page.locator('[data-vc-tour="thumbnails"]')).toBeAttached({ timeout: 10_000 });
  await page.waitForTimeout(800);
}

const contaNoCanvas = (page, texto) => page.evaluate(
  (t) => (document.querySelector('main')?.innerText || '').split(t).length - 1,
  texto,
);

test.describe('Assinatura da marca no card', () => {
  test('barra editorial, selo e rodapé aparecem em todos os cards, com e sem composição', async ({ page }) => {
    test.setTimeout(90_000);
    await abrirEditorComTemplate(page);
    const totalCards = await page.getByRole('button', { name: /^Card \d+ de \d+$/ }).count();
    expect(totalCards).toBeGreaterThan(2);

    await page.getByRole('tab', { name: /marca/i }).click({ force: true });
    for (const section of ['Barra editorial (topo)', 'Selo do rodapé', 'Barra do rodapé']) {
      await page.locator('summary').filter({ hasText:section }).click();
    }
    await page.locator('[data-vc-editor-section="marca-barra"]').getByPlaceholder('@seuperfil', { exact:true }).fill('SUA EDITORIA');
    await page.getByPlaceholder('#suahashtag', { exact:true }).fill('#SELOTESTE');
    await page.getByPlaceholder('Tema|Growth', { exact:true }).fill('Tema|Growth');
    await page.waitForTimeout(900);

    for (const [rotulo, texto] of [['editoria', 'SUA EDITORIA'], ['selo', '#SELOTESTE'], ['rodapé', 'Growth']]) {
      const n = await contaNoCanvas(page, texto);
      expect(n, `${rotulo} deveria aparecer nos ${totalCards} cards`).toBe(totalCards);
    }

    // Com composição ativa continua a aparecer (era aqui que desaparecia).
    await page.getByRole('button', { name: /modo atual/i }).click({ force: true });
    await page.getByRole('menuitem', { name:/Studio/i }).click();
    await page.getByRole('tab', { name: /layout/i }).click({ force: true });
    await page.getByRole('button', { name: /ativar composição/i }).first().click({ force: true });
    await page.waitForTimeout(1200);

    for (const [rotulo, texto] of [['editoria', 'SUA EDITORIA'], ['selo', '#SELOTESTE'], ['rodapé', 'Growth']]) {
      const n = await contaNoCanvas(page, texto);
      expect(n, `${rotulo} com composição ativa`).toBe(totalCards);
    }
  });
});
