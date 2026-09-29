// Task 07 — RF-01: landing renderiza sem erro de console.
import { test, expect } from '@playwright/test';
import { mockApi } from './helpers/api-mock.js';
import { PLAN_ORDER, PLAN_TIERS } from '../../shared/plans.js';

test.describe('Landing (RF-01)', () => {
  test('renderiza hero e CTA sem nenhum erro de console', async ({ page }) => {
    const errosConsole = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errosConsole.push(msg.text());
    });
    page.on('pageerror', (err) => errosConsole.push(String(err)));

    await mockApi(page);
    await page.goto('/?landing=1');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Carrosséis com a sua voz.');
    // CTA principal e secundário conforme docs/LANDING-COPY.md §hero.
    await expect(page.getByRole('button', { name: /criar meu primeiro carrossel/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /ver como funciona/i }).first()).toBeVisible();

    expect(errosConsole, `Erros de console na landing:\n${errosConsole.join('\n')}`).toEqual([]);
  });

  test('seções presentes e oferta de planos acompanha a configuração do app', async ({ page }) => {
    await mockApi(page);
    await page.goto('/?landing=1');
    await expect(page.locator('#como-funciona')).toBeAttached();
    await expect(page.locator('#modos')).toBeAttached();
    await expect(page.locator('#contexto-projeto')).toBeAttached();
    await expect(page.getByRole('heading', { name: /antes de assinar/i })).toBeAttached();
    for (const id of PLAN_ORDER) {
      const plan = PLAN_TIERS[id];
      const card = page.getByRole('article', { name: `Plano ${plan.name}`, exact: true });
      await expect(card).toContainText(plan.priceLabel);
      await expect(card).toContainText(plan.imageQuota ? `${plan.imageQuota} imagens por mês` : 'Sem imagens de IA inclusas');
    }
    await page.getByRole('button', { name: 'Escolher meu plano', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Studio completo. Imagens inclusas nos planos pagos/i })).toBeVisible();
  });

  for (const [device, width] of [['desktop', 1280], ['mobile', 375]]) {
    test(`demonstração ${device}: escopo e logo por card, sem chamadas de IA`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const aiRequests = [];
      page.on('request', request => { if (/\/api\/(ai|anthropic)\//.test(request.url())) aiRequests.push(request.url()); });
      await mockApi(page);
      await page.goto(device === 'desktop' ? '/' : '/?landing=1');
      await page.screenshot({ path: `/tmp/viral-landing-hero-${device}.png` });
      const demo = page.getByLabel('Demonstração do projeto', { exact: true });
      await demo.scrollIntoViewIfNeeded();
      await expect(demo.getByRole('radio', { name: 'Só texto', exact: true })).toBeChecked();
      await demo.getByRole('radio', { name: 'Texto e imagens', exact: true }).check();
      await expect(demo.getByRole('status')).toContainText('saldo do plano');
      await demo.getByRole('button', { name: 'Aplicar logo salva no card 1', exact: true }).click();
      await expect(demo.getByLabel('Logo aplicada no card 1', { exact: true })).toBeVisible();
      await expect(demo.getByLabel('Logo aplicada no card 2', { exact: true })).toHaveCount(0);
      await demo.getByRole('button', { name: 'Selecionar card 2 da demonstração', exact: true }).click();
      await demo.getByRole('button', { name: 'Aplicar logo salva no card 2', exact: true }).click();
      await expect(demo.getByLabel('Logo aplicada no card 1', { exact: true })).toBeVisible();
      await expect(demo.getByLabel('Logo aplicada no card 2', { exact: true })).toBeVisible();
      await demo.getByRole('button', { name: 'Remover logo no card 2', exact: true }).click();
      await expect(demo.getByLabel('Logo aplicada no card 2', { exact: true })).toHaveCount(0);
      expect(aiRequests).toEqual([]);
      const section = page.locator('#contexto-projeto');
      expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await page.screenshot({ path: `/tmp/viral-landing-demo-${device}.png` });
      // A landing rola em um container fixo: captura do elemento inteiro
      // corta o que está fora desse container. Inspecionar a viewport real.
      for (const [id, name] of [['contexto-projeto', 'contexto'], ['planos', 'planos']]) {
        await page.locator(`#${id}`).evaluate(el => el.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: `/tmp/viral-landing-${name}-${device}.png` });
      }
      await page.getByRole('button', { name: 'Criar com o contexto da minha marca', exact: true }).click();
      await expect(page.getByRole('heading', { name: /Studio completo. Imagens inclusas nos planos pagos/i })).toBeVisible();
    });
  }
});
