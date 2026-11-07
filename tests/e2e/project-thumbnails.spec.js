import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { openProjectLibrary } from './helpers/project-entry.js';

test('Biblioteca e faixa desenham o card 1 da vista salva e acompanham Cmd+Z', async ({ page }) => {
  await mockApi(page, { session:SESSAO_ATIVA });
  await page.addInitScript(() => {
    const doc = {
      fmt:'quadrado',
      brand:{ id:'thumb-brand', bg:'#ffffff', titleColor:'#111111', textColor:'#222222' },
      slides:[
        { id:'thumb-1', num:1, title:'PRODUTO', subtitle:'Primeiro card' },
        { id:'thumb-2', num:2, title:'PESSOA', subtitle:'Segundo card' },
      ],
      formatViews:{ quadrado:{ slides:{
        'thumb-1':{ visualBrand:{ bg:'#a52a2a', titleColor:'#ffffff' } },
        'thumb-2':{ visualBrand:{ bg:'#075985', titleColor:'#ffffff' } },
      } } },
    };
    localStorage.setItem('vc_library', JSON.stringify([{
      id:'thumbnail-project', name:'Miniaturas por formato', status:'draft', updatedAt:Date.now(), doc,
    }]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('thumbnail-project'));
  });
  await page.goto('/?app=1');

  const library = await openProjectLibrary(page);
  const libraryThumb = library.locator('[data-vc-card-thumbnail="true"]');
  await expect(libraryThumb).toContainText('PRODUTO');
  await expect.poll(() => libraryThumb.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe('rgb(165, 42, 42)');
  await library.getByRole('button', { name:'Abrir Miniaturas por formato', exact:true }).first().click();

  const strip = page.locator('[data-vc-tour="thumbnails"]');
  const thumbs = strip.locator('[data-vc-card-thumbnail="true"]');
  await expect(thumbs).toHaveCount(2);
  await expect(thumbs.nth(0)).toContainText('PRODUTO');
  await expect(thumbs.nth(1)).toContainText('PESSOA');
  await expect.poll(() => thumbs.nth(0).evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe('rgb(165, 42, 42)');
  await expect.poll(() => thumbs.nth(1).evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe('rgb(7, 89, 133)');

  await page.getByRole('button', { name:'Adicionar card ao carrossel' }).click();
  await expect(thumbs).toHaveCount(3);
  await page.keyboard.press('Control+z');
  await expect(thumbs).toHaveCount(2);
  await expect(thumbs.nth(0)).toContainText('PRODUTO');
  await expect.poll(() => thumbs.nth(0).evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe('rgb(165, 42, 42)');
});
