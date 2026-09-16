// Itens da revisão de UX do editor (docs/ux-audit-editor-2026-09-16.md) e marca Viral AI.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

async function entrarNoEditor(page) {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
  await page.waitForTimeout(800);
}

test.describe('Editor — revisão de UX', () => {
  test('UX-004: o editor abre na aba Home, não em Marca', async ({ page }) => {
    await entrarNoEditor(page);
    await expect(page.getByRole('tab', { name: /^home$/i }).first()).toHaveAttribute('aria-selected', 'true');
  });

  test('UX-005: direção da imagem começa fechada e abre por card', async ({ page }) => {
    await entrarNoEditor(page);
    await page.getByRole('button', { name: /templates prontos/i }).click({ force: true });
    await page.getByText('Erro Comum', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(1200);

    await expect(page.getByPlaceholder(/fundo branco minimalista/i)).toHaveCount(0);
    await page.getByRole('button', { name: /direção/i }).first().click();
    await expect(page.getByPlaceholder(/fundo branco minimalista/i)).toHaveCount(1);
  });

  test('Perfil tem botão Fechar que volta ao editor', async ({ page }) => {
    await entrarNoEditor(page);
    await page.getByRole('button', { name: /^perfil$/i }).first().click({ force: true });
    await expect(page.getByRole('button', { name: /sair da conta/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /^fechar$/i }).first().click();
    await expect(page.getByRole('button', { name: /sair da conta/i })).toHaveCount(0);
  });

  test('Configurar IA não menciona o fornecedor — só Viral AI', async ({ page }) => {
    await entrarNoEditor(page);
    await page.getByRole('button', { name: /configurar ia/i }).first().click({ force: true });
    const modal = page.getByRole('dialog').first();
    await expect(modal).toContainText('Viral AI', { timeout: 5000 });
    await expect(modal).not.toContainText(/z\.ai|glm/i);
  });
});
