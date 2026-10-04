import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const localDateKey = () => {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const shiftDays = (key, days) => {
  const [y, m, d] = key.split('-').map(Number);
  const next = new Date(y, m - 1, d + days);
  return [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, '0'),
    String(next.getDate()).padStart(2, '0'),
  ].join('-');
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** No Criar rápido, pasta/data/status ficam atrás de «Organizar». */
async function expandOrganize(dialog) {
  const btn = dialog.getByRole('button', { name: 'Organizar' }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
  }
}

test('organiza projeto em pasta e conserva a pauta no calendário após reload', async ({ page }) => {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
  await page.getByRole('button', { name: /abrir biblioteca/i }).first().click({ force: true });

  let dialog = page.getByRole('dialog', { name: /biblioteca de carrosséis/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Nome da nova pasta').fill('Campanha Outubro');
  await dialog.getByRole('button', { name: 'Criar pasta' }).click();

  await expandOrganize(dialog);
  const folderSelect = dialog.locator('select[aria-label^="Pasta de "]').first();
  const projectName = (await folderSelect.getAttribute('aria-label'))?.replace(/^Pasta de /, '') || 'Carrossel';
  await folderSelect.selectOption({ label: 'Campanha Outubro' });
  const today = localDateKey();
  await dialog.getByLabel(new RegExp(`Data de publicação de ${projectName}`, 'i')).fill(today);
  await expect(dialog.getByLabel(new RegExp(`Estado de ${projectName}`, 'i'))).toHaveValue('scheduled');

  await dialog.getByRole('tab', { name: 'Calendário' }).click();
  const eventName = new RegExp(`^${escapeRegExp(projectName)}\\. Data: .+\\. Status: .+\\. Pasta: Campanha Outubro\\.$`, 'i');
  await expect(dialog.getByRole('button', { name: eventName })).toBeVisible();
  await expect(dialog.getByText(/não publica automaticamente no Instagram/i)).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: /abrir biblioteca/i }).first().click({ force: true });
  dialog = page.getByRole('dialog', { name: /biblioteca de carrosséis/i });
  await expect(dialog.getByRole('button', { name: /^Campanha Outubro \(\d+\)$/ })).toBeVisible();
  await expandOrganize(dialog);
  await expect(dialog.getByLabel(new RegExp(`Data de publicação de ${projectName}`, 'i'))).toHaveValue(today);
});

test('fila editorial mostra atrasados e permite marcar publicado', async ({ page }) => {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
  await page.getByRole('button', { name: /abrir biblioteca/i }).first().click({ force: true });

  const dialog = page.getByRole('dialog', { name: /biblioteca de carrosséis/i });
  await expect(dialog).toBeVisible();

  await expandOrganize(dialog);
  const folderSelect = dialog.locator('select[aria-label^="Pasta de "]').first();
  const projectName = (await folderSelect.getAttribute('aria-label'))?.replace(/^Pasta de /, '') || 'Carrossel';
  const overdue = shiftDays(localDateKey(), -3);
  await dialog.getByLabel(new RegExp(`Data de publicação de ${projectName}`, 'i')).fill(overdue);
  await expect(dialog.getByLabel(new RegExp(`Estado de ${projectName}`, 'i'))).toHaveValue('scheduled');

  await dialog.getByRole('tab', { name: 'Fila' }).click();
  await expect(dialog.getByText(/fila editorial local/i)).toBeVisible();
  await expect(dialog.getByText('Atrasados')).toBeVisible();
  await expect(dialog.getByRole('button', { name: new RegExp(`^${projectName}\\b`) })).toBeVisible();

  await dialog.getByRole('button', { name: new RegExp(`Marcar ${projectName} como publicado`, 'i') }).click();
  await expect(dialog.getByText('Nada atrasado.')).toBeVisible();

  await dialog.getByRole('tab', { name: 'Biblioteca' }).click();
  await expandOrganize(dialog);
  await expect(dialog.getByLabel(new RegExp(`Estado de ${projectName}`, 'i'))).toHaveValue('published');
});

test('limpa filtros da Biblioteca antes de abrir Calendário ou Fila', async ({ page }) => {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
  await page.getByRole('button', { name: /abrir biblioteca/i }).first().click({ force: true });

  const dialog = page.getByRole('dialog', { name: /biblioteca de carrosséis/i });
  const search = dialog.getByRole('searchbox', { name: /buscar carrosséis/i });
  await search.fill('projeto que não existe');
  await expect(dialog.getByText(/nenhum carrossel corresponde/i)).toBeVisible();

  await dialog.getByRole('tab', { name: 'Calendário' }).click();
  await expect(dialog.getByText(/projeto.*ainda sem data/i)).toBeVisible();
  await dialog.getByRole('tab', { name: 'Biblioteca' }).click();
  await expect(search).toHaveValue('');
});

test('Escape fecha a Biblioteca e devolve o foco ao botão que a abriu', async ({ page }) => {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });

  const trigger = page.getByRole('button', { name: /abrir biblioteca/i }).first();
  await trigger.focus();
  await trigger.click({ force: true });
  await expect(page.getByRole('dialog', { name: /biblioteca de carrosséis/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /biblioteca de carrosséis/i })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('confirmações recebem foco, Escape devolve ao gatilho e abrir projeto foca o editor', async ({ page }) => {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
  await page.getByRole('button', { name: /abrir biblioteca/i }).first().click({ force: true });

  const dialog = page.getByRole('dialog', { name: /biblioteca de carrosséis/i });
  await dialog.getByLabel('Nome da nova pasta').fill('Pasta temporária');
  await dialog.getByRole('button', { name: 'Criar pasta' }).click();

  const deleteFolder = dialog.getByRole('button', { name: 'Excluir pasta Pasta temporária' });
  await deleteFolder.click();
  await expect(dialog.getByRole('button', { name: 'Confirmar exclusão da pasta Pasta temporária' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(deleteFolder).toBeFocused();

  const deleteProject = dialog.getByRole('button', { name: /^Apagar / }).first();
  await deleteProject.click();
  await expect(dialog.getByRole('button', { name: /^Confirmar exclusão de / })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(deleteProject).toBeFocused();

  await dialog.getByRole('button', { name: /^Abrir / }).first().click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[aria-label="Áreas de edição do projeto"] [role="tab"][aria-selected="true"]')).toBeFocused();
});

test('cabeçalho e ações da Biblioteca cabem em celular sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
  await page.getByRole('button', { name: /abrir biblioteca/i }).first().click({ force: true });

  const dialog = page.getByRole('dialog', { name: /biblioteca de carrosséis/i });
  await expect(dialog.getByRole('tab', { name: 'Calendário' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /novo carrossel/i })).toBeVisible();
  const hasOverflow = await dialog.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(hasOverflow).toBe(false);
});
