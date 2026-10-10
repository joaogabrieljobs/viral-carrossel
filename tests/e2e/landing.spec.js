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

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Do briefing ao carrossel.');
    await expect(page.getByRole('button', { name: /começar a criar/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /ver como funciona/i }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /um carrossel precisa parar o scroll/i })).toBeVisible();
    await expect(page.locator('#resultados')).toContainText('Quatro carrosséis. Três apresentações.');
    await expect(page.getByText('Moont Comunica', { exact: true })).toBeVisible();
    await expect(page.getByText('Moont Apresenta', { exact: true })).toBeVisible();

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
      await expect(demo.getByRole('radio', { name: 'Texto e imagens', exact: true })).toBeChecked();
      await demo.getByRole('radio', { name: 'Só texto', exact: true }).check();
      await expect(demo.getByRole('status')).toContainText('A narrativa ganha forma primeiro');
      await demo.getByRole('radio', { name: 'Texto e imagens', exact: true }).check();
      await expect(demo.getByRole('status')).toContainText('Texto e direção visual juntos');
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
      await page.getByRole('button', { name: 'Criar com minha direção', exact: true }).click();
      await expect(page.getByRole('heading', { name: /Studio completo. Imagens inclusas nos planos pagos/i })).toBeVisible();
    });
  }

  for (const [width, height] of [[320, 568], [360, 800], [375, 667], [390, 844], [430, 932]]) {
    test(`landing responsiva em ${width}px sem corte lateral e com gestos claros`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await mockApi(page);
      await page.goto('/?landing=1');

      const pageWidth = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client);

      for (const selector of ['#topo', '#resultados', '#contexto-projeto', '#modos', '#como-funciona', '#planos']) {
        const box = await page.locator(selector).boundingBox();
        expect(box, `${selector} deve existir em ${width}px`).not.toBeNull();
        expect(box.x, `${selector} não deve escapar pela esquerda em ${width}px`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${selector} não deve escapar pela direita em ${width}px`).toBeLessThanOrEqual(width);
      }

      for (const [containerSelector, childSelector] of [
        ['.moont-lp-hero__inner', '.moont-lp-hero__copy'],
        ['.moont-lp-hero__inner', '.moont-lp-hero__product'],
        ['.moont-lp-hero__inner', 'h1'],
        ['.moont-lp-context__grid', '.moont-lp-demo'],
        ['#modos .moont-lp-container', '.moont-lp-format--comunica'],
      ]) {
        const [containerBox, childBox] = await Promise.all([
          page.locator(containerSelector).boundingBox(),
          page.locator(childSelector).boundingBox(),
        ]);
        expect(childBox.x, `${childSelector} deve começar dentro de ${containerSelector}`).toBeGreaterThanOrEqual(containerBox.x - 1);
        expect(childBox.x + childBox.width, `${childSelector} deve terminar dentro de ${containerSelector}`).toBeLessThanOrEqual(containerBox.x + containerBox.width + 1);
      }

      const presentationImage = await page.locator('.moont-lp-format__visual--landscape img').boundingBox();
      expect(presentationImage.width / presentationImage.height).toBeCloseTo(877 / 494, 1);

      for (const selector of ['.moont-lp-logo', '.moont-lp-login', '.moont-lp-hero__actions .moont-lp-button']) {
        const targets = page.locator(selector);
        for (let index = 0; index < await targets.count(); index += 1) {
          const box = await targets.nth(index).boundingBox();
          expect(box.height, `${selector} precisa ter alvo de toque confortável`).toBeGreaterThanOrEqual(44);
        }
      }

      const primaryHeroCta = await page.locator('.moont-lp-hero__actions .moont-lp-button').first().boundingBox();
      expect(primaryHeroCta.y + primaryHeroCta.height, `CTA principal deve aparecer inteiro na primeira dobra de ${width}px`).toBeLessThanOrEqual(height);

      for (const label of [
        'Exemplos de carrosséis e apresentações',
        'Comparação entre carrossel e apresentação',
        'Perfis que usam a Moont',
        'Comparação dos planos da Moont',
      ]) {
        const rail = page.getByRole('region', { name: label, exact: true });
        await rail.scrollIntoViewIfNeeded();
        await rail.focus();
        await expect(rail).toBeFocused();
        const dimensions = await rail.evaluate((element) => ({
          client: element.clientWidth,
          scroll: element.scrollWidth,
        }));
        expect(dimensions.scroll, `${label} deve permitir deslizar`).toBeGreaterThan(dimensions.client);
        const before = await rail.evaluate((element) => element.scrollLeft);
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
        expect(await rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before);
      }
    });
  }

  test('movimento reduzido pula direto para a seção', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockApi(page);
    await page.goto('/?landing=1');
    await page.getByRole('button', { name: 'Ver como funciona', exact: true }).click();
    const positionAfterClick = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.scrollY)).toBe(positionAfterClick);
    await expect(page.locator('#como-funciona')).toBeInViewport();
  });
});
