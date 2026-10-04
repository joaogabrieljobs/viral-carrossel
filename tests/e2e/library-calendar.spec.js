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
  await expect(dialog.getByRole('button', { name: projectName, exact: true })).toBeVisible();
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
