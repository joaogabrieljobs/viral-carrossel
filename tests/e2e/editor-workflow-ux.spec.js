import { enterEditorFromHome, createTextProject, openProjectLibrary } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

async function editor(page, mobile = false) {
  await page.setViewportSize(mobile ? { width:390, height:844 } : { width:1440, height:960 });
  await mockApi(page, { session:SESSAO_ATIVA });
  await page.addInitScript(() => {
    if (localStorage.getItem('ux-seeded')) return;
    localStorage.setItem('ux-seeded', '1');
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_app_mode', JSON.stringify('criador'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('ux-project'));
    localStorage.setItem('vc_library', JSON.stringify([{ id:'ux-project', name:'Café Aurora — outubro', doc:{
      brand:{ id:'aurora', name:'Café Aurora', titleFont:'Arial', bodyFont:'Arial', bg:'#f8f7f4', titleColor:'#222222', textColor:'#333333' },
      fmt:'carrossel', caption:'Legenda geral para uma única publicação.',
      slides:Array.from({ length:6 }, (_, i) => ({ id:`ux-${i}`, title:`Dica ${i + 1} para um café melhor`, subtitle:'Uma explicação que ajuda a colocar a ideia em prática.', layout:'mc', photoRegion:'none' })),
    } }]));
  });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await expect(page.locator('#vc-cards-viewport')).toBeVisible();
}

test('zoom altera apenas preview, navega entre cards e ajusta novamente à tela', async ({ page }, testInfo) => {
  await editor(page);
  const card = page.locator('main [data-vc-card-surface="ux-0"]');
  const exported = page.locator('[data-vc-export-tree] [data-vc-card-surface="ux-0"]');
  const before = (await card.boundingBox()).width;
  const exportWidth = (await exported.boundingBox()).width;
  await page.getByRole('button', { name:'Aumentar zoom', exact:true }).click();
  await expect(page.getByLabel('Zoom da área de trabalho')).toHaveText('110%');
  expect((await card.boundingBox()).width).toBeCloseTo(before * 1.1, 0);
  expect((await exported.boundingBox()).width).toBe(exportWidth);
  const board = await page.locator('#vc-cards-viewport').boundingBox();
  await page.mouse.move(board.x + 130, board.y + 130);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -35);
  await page.keyboard.up('Control');
  await expect.poll(async () => Number((await page.getByLabel('Zoom da área de trabalho').innerText()).replace('%', ''))).toBeGreaterThan(110);
  await page.getByLabel('Ir para o card').selectOption('5');
  await expect(page.locator('[data-canvas-active="true"]')).toContainText('Dica 6');
  await page.getByRole('button', { name:'Ajustar cards à tela' }).click();
  await expect(page.getByLabel('Zoom da área de trabalho')).toHaveText('100%');
  await expect.poll(async () => {
    const active = await page.locator('[data-canvas-active="true"]').boundingBox();
    const board = await page.locator('#vc-cards-viewport').boundingBox();
    return active.y + 50 >= board.y && active.y + 50 < board.y + board.height;
  }).toBe(true);
  await page.screenshot({ path:testInfo.outputPath('desktop-workflow.png') });
});

test('mobile identifica projeto, tem Texto, exporta conjunto e rola por uma alça visível', async ({ page }, testInfo) => {
  await editor(page, true);
  await expect(page.getByText('Café Aurora — outubro', { exact:true })).toBeVisible();
  const textTab = page.getByRole('button', { name:'Abrir aba Texto', exact:true });
  await expect(textTab).toBeInViewport();
  await page.getByRole('button', { name:'Aumentar zoom', exact:true }).click();
  const rail = page.getByRole('scrollbar', { name:'Rolar área dos cards' });
  await expect(rail).toBeVisible();
  await page.screenshot({ path:testInfo.outputPath('mobile-zoom.png') });
  const rect = await rail.boundingBox();
  const before = await page.locator('#vc-cards-viewport').evaluate(el => el.scrollTop);
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2 + 60, { steps:5 });
  await page.mouse.up();
  expect(await page.locator('#vc-cards-viewport').evaluate(el => el.scrollTop)).toBeGreaterThan(before);
  await page.getByRole('button', { name:'Opções de download' }).click();
  await expect(page.getByRole('menuitem', { name:/Todos os 6 cards/ })).toBeVisible();
  expect(await page.getByRole('menuitem').first().innerText()).toContain('Todos os 6 cards');
  await expect(page.getByRole('menuitem', { name:'Copiar legenda', exact:true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name:'Abrir aba Narrativa' }).click();
  await page.getByRole('button', { name:/Ajustar texto/ }).click();
  // Focus lands on the editable title, not on the actions above it.
  await expect.poll(() => page.evaluate(() => document.activeElement?.value)).toBe('Dica 1 para um café melhor');
  const visible = await page.evaluate(() => {
    const box = document.activeElement.getBoundingClientRect();
    return box.top >= 0 && box.bottom < innerHeight;
  });
  expect(visible).toBe(true);
});

test('legenda geral é editável, pode ser apagada e persiste após recarregar', async ({ page }) => {
  await editor(page);
  await page.getByRole('button', { name:/Legenda.*card 1/i }).first().click();
  const modal = page.getByRole('dialog', { name:'Legenda da publicação' });
  await expect(modal.getByRole('textbox')).toHaveValue('Legenda geral para uma única publicação.');
  await modal.getByRole('textbox').fill('Legenda revisada de toda a publicação.');
  await modal.getByRole('button', { name:'Feito' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library'))[0].doc.caption)).toBe('Legenda revisada de toda a publicação.');
  await page.reload();
  await enterEditorFromHome(page);
  await page.getByRole('button', { name:/Legenda.*card 1/i }).first().click();
  await expect(modal.getByRole('textbox')).toHaveValue('Legenda revisada de toda a publicação.');
  await modal.getByRole('textbox').fill('');
  await expect(modal.getByRole('textbox')).toHaveValue('');
});

test('primeira conta cria só o projeto solicitado e não recebe tour sobre formulário', async ({ page }) => {
  await mockApi(page, { session:SESSAO_ATIVA, onboarding:true });
  await page.goto('/?app=1');
  await createTextProject(page, { name:'Dicas de preparo', newBrand:'Café Aurora' });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]').map(e => e.name))).toEqual(['Dicas de preparo']);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library'))[0].doc.brand.name)).toBe('Café Aurora');
  await expect(page.locator('[data-vc-tour-card]')).toHaveCount(0);
  await page.getByRole('button', { name:'Perfil', exact:true }).first().click();
  const library = await openProjectLibrary(page);
  await library.getByRole('button', { name:'Apagar Dicas de preparo', exact:true }).click();
  await library.getByRole('button', { name:'Confirmar eliminação', exact:true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library')))).toEqual([]);
  await page.reload();
  await expect(page.getByRole('button', { name:'Criar um projeto', exact:true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library')))).toEqual([]);
});


test('padrão visual explicita o alcance e mantém os demais cards intactos', async ({ page }) => {
  await editor(page);
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library'))[0].doc);
  await expect.poll(async () => (await stored()).slides[1].elementsUnlocked).toBe(true);
  const original = await stored();
  await page.getByRole('tab', { name:'Visual', exact:true }).click();
  await page.getByRole('button', { name:'Este card', exact:true }).click();
  await page.getByRole('group', { name:'Padrões visuais', exact:true }).getByRole('button').first().click();
  await expect.poll(async () => (await stored()).slides[0].visualPresetId).toBeTruthy();
  const styled = await stored();
  expect(styled.slides.slice(1)).toEqual(original.slides.slice(1));
  expect(styled.slides[0].title).toEqual(original.slides[0].title);
  await page.getByRole('button', { name:'Todos os cards', exact:true }).click();
  await page.getByRole('group', { name:'Padrões visuais', exact:true }).getByRole('button').nth(1).click();
  await expect.poll(async () => (await stored()).slides[0].visualBrand).toBeNull();
  await expect.poll(async () => (await stored()).visualPreset).toBeTruthy();
});

test('aprovação guarda retorno e estado separados do convite de edição', async ({ page }) => {
  await editor(page);
  await page.getByRole('tab', { name:'Início', exact:true }).click();
  await page.locator('summary').filter({ hasText:'Aprovação do cliente' }).click();
  const review = page.getByRole('region', { name:'Aprovação do cliente', exact:true });
  await review.getByLabel('Situação da aprovação').selectOption('changes_requested');
  await review.getByLabel('Retorno do cliente').fill('Aumentar o destaque do produto no card 2.');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library'))[0].status)).toBe('changes_requested');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library'))[0].doc.clientReview?.feedback)).toBe('Aumentar o destaque do produto no card 2.');
  await page.reload();
  await enterEditorFromHome(page);
  await page.getByRole('tab', { name:'Início', exact:true }).click();
  await page.locator('summary').filter({ hasText:'Aprovação do cliente' }).click();
  await expect(review.getByLabel('Situação da aprovação')).toHaveValue('changes_requested');
  await expect(review.getByLabel('Retorno do cliente')).toHaveValue('Aumentar o destaque do produto no card 2.');
  await expect(page.locator('summary').filter({ hasText:'Convidar para editar' })).toBeVisible();
});
