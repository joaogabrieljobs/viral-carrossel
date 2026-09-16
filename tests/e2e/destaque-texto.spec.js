// "Marcar destaque" gravava `destaqueSpans` e mostrava o toast de sucesso, mas só
// os layouts culture desenhavam os trechos: nos restantes o card continuava com
// o texto simples. O teste marca um trecho do subtítulo e procura-o pintado no card.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

test('destaque marcado no subtítulo aparece no card', async ({ page }) => {
  test.setTimeout(60_000);
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
  await page.waitForTimeout(800);
  await page.getByRole('tab', { name: /narrativa/i }).first().click({ force: true });

  const alvo = page.getByText('Subtítulo', { exact: true }).first().locator('xpath=following::textarea[1]');
  await alvo.fill('O que funcionava ontem já não move ponteiro.');
  await page.waitForTimeout(500);

  await alvo.evaluate((ta) => {
    const i = ta.value.indexOf('move ponteiro');
    ta.focus();
    ta.setSelectionRange(i, i + 'move ponteiro'.length);
    ta.dispatchEvent(new Event('select', { bubbles: true }));
  });
  await page.getByRole('button', { name: /marcar destaque no texto selecionado/i }).click();
  await page.waitForTimeout(600);

  const destaques = await page.locator('[data-vc-destaque]').allTextContents();
  expect(destaques).toContain('move ponteiro');
});
