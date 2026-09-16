// Faltava ver o consumo de imagens do plano, rever as imagens geradas e voltar a
// baixá-las; e faltava um gesto explícito de salvar (o autosave era invisível).
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const SESSAO_COM_QUOTA = {
  ...SESSAO_ATIVA,
  tier: 'creator',
  imageQuota: { used: 12, limit: 50, remaining: 38, tier: 'creator' },
};

test.describe('Imagens do plano', () => {
  test('aba Imagens mostra consumo e estado vazio da galeria', async ({ page }) => {
    await mockApi(page, { session: SESSAO_COM_QUOTA });
    await page.goto('/?app=1');

    await page.getByRole('button', { name: /^Imagens$/ }).first().click();

    await expect(page.getByRole('heading', { name: /imagens geradas/i })).toBeVisible();
    await expect(page.getByText('12 de 50')).toBeVisible();
    await expect(page.getByText(/38 restantes/)).toBeVisible();
    await expect(page.getByText(/ainda não há imagens geradas/i)).toBeVisible();
  });

  test('plano sem imagens explica o upgrade em vez de mostrar contador', async ({ page }) => {
    await mockApi(page, {
      session: { ...SESSAO_ATIVA, tier: 'essential', imageQuota: { used: 0, limit: 0, remaining: 0, tier: 'essential' } },
    });
    await page.goto('/?app=1');
    await page.getByRole('button', { name: /^Imagens$/ }).first().click();
    await expect(page.getByText(/não inclui geração de imagens/i)).toBeVisible();
  });
});

test.describe('Salvar projeto', () => {
  test('botão Salvar confirma a gravação e persiste depois do reload', async ({ page }) => {
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.goto('/?app=1');
    const continuar = page.getByRole('button', { name: /continuar no editor/i });
    await expect(continuar).toBeVisible({ timeout: 10_000 });
    await continuar.click({ force: true });

    const salvar = page.getByRole('button', { name: /salvar projeto agora/i });
    await expect(salvar).toBeVisible({ timeout: 10_000 });
    await salvar.click({ force: true });
    await expect(page.getByText(/projeto salvo neste navegador/i)).toBeVisible({ timeout: 5_000 });

    // O que foi gravado sobrevive ao reload.
    const antes = await page.evaluate(() => localStorage.getItem('vc_library')?.length || 0);
    expect(antes).toBeGreaterThan(0);
    await page.reload();
    await expect(page.getByRole('button', { name: /salvar projeto agora/i })).toBeVisible({ timeout: 10_000 });
  });
});
