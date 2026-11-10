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

test('Templates e Pesquisa prendem o foco, fecham com Escape e devolvem ao gatilho', async ({ page }) => {
  await mockEditorApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);

  const cases = [
    {
      trigger: page.getByRole('button', { name: /Abrir templates/i }).first(),
      dialogName: 'Templates prontos',
    },
    {
      trigger: page.getByRole('button', { name: /Pesquisar nicho/i }).first(),
      dialogName: 'Pesquisa de nicho',
    },
  ];

  for (const item of cases) {
    const triggerHandle = await item.trigger.elementHandle();
    await triggerHandle.click({ force: true });
    const dialog = page.getByRole('dialog', { name: item.dialogName, exact: true });
    await expect(dialog).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') != null)).toBe(true);
    await expect.poll(() => triggerHandle.evaluate(element => element.closest('[inert]') != null)).toBe(true);

    const close = dialog.getByRole('button', { name: 'Fechar', exact: true });
    const focusable = dialog.locator('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
    await focusable.last().focus();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => triggerHandle.evaluate(element => document.activeElement === element)).toBe(true);
    await expect.poll(() => triggerHandle.evaluate(element => element.closest('[inert]') == null)).toBe(true);
  }
});

test('Importar texto prende o foco e devolve ao botão que abriu o diálogo', async ({ page }) => {
  await mockEditorApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await selectEditorMode(page, 'diretor');
  await page.getByRole('tab', { name: /^Narrativa$/i }).first().click();
  await openPanel(page, 'Adicionar conteúdo');

  const trigger = page.getByRole('button', { name: /Importar texto \(1 página = 1 card\)/i });
  const triggerHandle = await trigger.elementHandle();
  await triggerHandle.click();

  const dialog = page.getByRole('dialog', { name: '1 página → 1 card', exact: true });
  await expect(dialog.getByLabel('Texto a importar', { exact: true })).toBeFocused();
  await expect.poll(() => triggerHandle.evaluate(element => element.closest('[inert]') != null)).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => triggerHandle.evaluate(element => document.activeElement === element)).toBe(true);
  await expect.poll(() => triggerHandle.evaluate(element => element.closest('[inert]') == null)).toBe(true);
});

test('Importar texto pede confirmação para Post antes de aplicar os blocos', async ({ page }) => {
  await mockEditorApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await selectEditorMode(page, 'diretor');
  await page.getByRole('tab', { name: /^Narrativa$/i }).first().click();
  await openPanel(page, 'Adicionar conteúdo');
  await page.getByRole('button', { name: /Importar texto \(1 página = 1 card\)/i }).click();

  const dialog = page.getByRole('dialog', { name: '1 página → 1 card', exact: true });
  await dialog.getByLabel('Texto a importar', { exact: true }).fill(
    'Post 1: 300 curtidas. Post 2: 120 curtidas. Post 3: 80 curtidas.',
  );

  await expect(dialog.getByRole('alert')).toContainText('Confirme a divisão antes de importar');
  const apply = dialog.getByRole('button', { name: 'Aplicar aos cards', exact: true });
  await expect(apply).toBeDisabled();

  const confirmation = dialog.getByRole('checkbox', {
    name: 'Confirmo que cada bloco deve virar um card.',
    exact: true,
  });
  await confirmation.check();
  await expect(apply).toBeEnabled();

  // Uma confirmação antiga não vale para um texto novo.
  await dialog.getByLabel('Texto a importar', { exact: true }).fill(
    'Post 1: abertura. Post 2: desenvolvimento. Post 3: conclusão.',
  );
  await expect(confirmation).not.toBeChecked();
  await expect(apply).toBeDisabled();

  await confirmation.check();
  await apply.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('main [data-vc-card-surface]')).toHaveCount(3);
});

test('Importar texto explica marcador inline antes de dividir os cards', async ({ page }) => {
  await mockEditorApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await selectEditorMode(page, 'diretor');
  await page.getByRole('tab', { name: /^Narrativa$/i }).first().click();
  await openPanel(page, 'Adicionar conteúdo');
  await page.getByRole('button', { name: /Importar texto \(1 página = 1 card\)/i }).click();

  const dialog = page.getByRole('dialog', { name: '1 página → 1 card', exact: true });
  await dialog.getByLabel('Texto a importar', { exact: true }).fill(
    'Card 01: Abertura. Card 02: Meio card 03: Fecho.',
  );

  const alert = dialog.getByRole('alert');
  await expect(alert).toContainText('marcador numerado aparece colado ao texto anterior');
  await expect(alert).not.toContainText('Os rótulos  também');
  const apply = dialog.getByRole('button', { name: 'Aplicar aos cards', exact: true });
  await expect(apply).toBeDisabled();
  await dialog.getByRole('checkbox', {
    name: 'Confirmo que cada bloco deve virar um card.',
    exact: true,
  }).check();
  await apply.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('main [data-vc-card-surface]')).toHaveCount(3);
});

test('Editar perfil prende o foco e Escape fecha primeiro o diálogo e depois o perfil', async ({ page }) => {
  await mockEditorApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: 'Perfil', exact: true }).click();

  const trigger = page.getByRole('button', { name: 'Editar perfil', exact: true }).last();
  const triggerHandle = await trigger.elementHandle();
  await triggerHandle.click();

  const dialog = page.getByRole('dialog', { name: 'Editar perfil', exact: true });
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') != null)).toBe(true);
  await expect.poll(() => triggerHandle.evaluate(element => element.closest('[inert]') != null)).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => triggerHandle.evaluate(element => document.activeElement === element)).toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Perfil pessoal', exact: true })).toHaveCount(0);
  await expect(page.locator('#vc-cards-viewport')).toBeVisible();
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

