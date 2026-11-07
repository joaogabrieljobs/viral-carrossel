import { test, expect } from '@playwright/test';
import { mockEditorApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome, selectEditorMode } from './helpers/project-entry.js';

async function openPanel(page, title) {
  const button = page.getByRole('button', { name: new RegExp(`^${title}`, 'i') }).first();
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
}

test('Configurar IA prende e devolve o foco, fecha com Escape e isola o editor', async ({ page }) => {
  await mockEditorApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);

  const trigger = page.getByRole('button', { name: /Configurar IA/i }).first();
  const triggerHandle = await trigger.elementHandle();
  await triggerHandle.click({ force: true });

  const dialog = page.getByRole('dialog', { name: 'Configurar IA', exact: true });
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') != null)).toBe(true);
  await expect.poll(() => triggerHandle.evaluate(element => element.closest('[inert]') != null)).toBe(true);

  const close = dialog.getByRole('button', { name: 'Fechar', exact: true });
  const save = dialog.getByRole('button', { name: 'Salvar configuração', exact: true });
  await save.focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(save).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => triggerHandle.evaluate(element => document.activeElement === element)).toBe(true);
  await expect.poll(() => triggerHandle.evaluate(element => element.closest('[inert]') == null)).toBe(true);
});

test('confirmação de substituir cards desativa inclusive os inputs de foto atrás', async ({ page }) => {
  await mockEditorApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(() => {
    localStorage.setItem('vc_library', JSON.stringify([{
      id: 'editor-fixture',
      name: 'Carrossel existente',
      updatedAt: Date.now(),
      doc: {
        fmt: 'carrossel',
        slides: [{
          id: 'editor-fixture-slide',
          num: 1,
          title: 'Conteúdo existente',
          subtitle: 'Este texto deve ser preservado até a pessoa confirmar a substituição.',
          layout: 'mc',
          align: 'center',
        }],
      },
    }]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('editor-fixture'));
  });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await selectEditorMode(page, 'diretor');
  await page.getByRole('tab', { name: /^Narrativa$/i }).first().click();
  await openPanel(page, 'Prompt para gerar');
  await page.getByLabel('Prompt para gerar', { exact: true }).fill('Crie três cards de teste.');

  const generate = page.getByRole('button', { name: /Gerar com contexto e referências/i });
  const generateHandle = await generate.elementHandle();
  await generateHandle.click();

  const confirm = page.getByRole('dialog', { name: 'Substituir os cards?', exact: true });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole('button', { name: 'Substituir', exact: true })).toBeFocused();
  const backgroundPhotoInput = page.locator('input[type="file"][accept*="image"]').first();
  await expect.poll(() => backgroundPhotoInput.evaluate(element => element.closest('[inert]') != null)).toBe(true);

  await page.keyboard.press('Tab');
  await expect(confirm.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(confirm.getByRole('button', { name: 'Substituir', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(confirm).toHaveCount(0);
  await expect.poll(() => generateHandle.evaluate(element => document.activeElement === element)).toBe(true);
  await expect.poll(() => backgroundPhotoInput.evaluate(element => element.closest('[inert]') == null)).toBe(true);
});

