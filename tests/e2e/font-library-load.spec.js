import { expect, test } from '@playwright/test';

test('fontes locais carregam no navegador sem depender do Google Fonts', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const families = [
      'Moont Library Aeonik',
      'Moont Library Mango Grotesque',
      'Moont Library Migra',
      'Moont Library The Signature',
    ];
    return Promise.all(families.map(async (family) => ({
      family,
      loaded: (await document.fonts.load(`400 18px "${family}"`, 'Moont Criação çã')).length,
      available: document.fonts.check(`400 18px "${family}"`, 'Moont Criação çã'),
    })));
  });
  expect(results).toEqual(results.map(({ family }) => ({ family, loaded: 1, available: true })));
});
