import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

test('modal mobile prioriza o pedido e usa um único escopo até o CTA final', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page, {
    session: {
      ...SESSAO_ATIVA,
      tier: 'creator',
      imageQuota: { limit: 50, remaining: 50, used: 0 },
    },
  });

  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click();
  await page.getByRole('button', { name: 'Gerar carrossel com IA', exact: true }).first().click();

  const modal = page.locator('.modal-panel');
  const topic = modal.getByLabel('Sobre o que é o conteúdo?', { exact: true });
  const presets = modal.locator('[data-vc-collapsible="creative-presets"]');
  const presetsToggle = presets.getByRole('button', { name: /Escolher pacote criativo/i });

  await expect(topic).toBeVisible();
  await expect(presetsToggle).toHaveAttribute('aria-expanded', 'false');
  expect(await topic.evaluate((element) => {
    const disclosure = element.closest('.modal-panel')?.querySelector('[data-vc-collapsible="creative-presets"]');
    return !!disclosure && !!(element.compareDocumentPosition(disclosure) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);

  await presetsToggle.focus();
  await page.keyboard.press('Enter');
  await expect(presetsToggle).toHaveAttribute('aria-expanded', 'true');
  expect(await presets.getByRole('radio').count()).toBeGreaterThan(1);
  await presets.getByRole('radio', { name: /Personalizado/i }).focus();
  await page.keyboard.press('Enter');
  await expect(presetsToggle).toHaveAttribute('aria-expanded', 'false');

  await topic.fill('Como transformar um briefing vago em uma direção clara');
  await modal.getByRole('button', { name: /Continuar/i }).click();
  await expect(modal.getByRole('tabpanel')).toBeFocused();
  await modal.getByRole('button', { name: /Continuar/i }).click();
  await expect(modal.getByRole('tabpanel')).toBeFocused();

  const textOnly = modal.getByRole('radio', { name: 'Só texto', exact: true });
  const textAndImages = modal.getByRole('radio', { name: 'Texto e imagens', exact: true });
  // Criador começa no escopo econômico e explícito; imagens continuam
  // disponíveis como escolha, sem consumo acidental de créditos.
  await expect(textOnly).toBeChecked();
  await modal.getByRole('button', { name: /Continuar/i }).click();
  await expect(modal.getByRole('tabpanel')).toBeFocused();

  await expect(modal.getByText('Escopo', { exact: true })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Gerar só texto', exact: true })).toHaveCount(1);
  await expect(modal.getByRole('button', { name: 'Gerar texto e imagens', exact: true })).toHaveCount(0);

  await modal.getByRole('button', { name: 'Voltar', exact: true }).click();
  await textAndImages.check();
  await modal.getByRole('button', { name: /Continuar/i }).click();
  await expect(modal.getByRole('button', { name: 'Gerar texto e imagens', exact: true })).toHaveCount(1);
  await expect(modal.getByRole('button', { name: 'Gerar só texto', exact: true })).toHaveCount(0);
});
