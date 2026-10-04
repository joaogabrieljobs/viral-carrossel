import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

async function seedLegacyCultureCard(page) {
  await page.addInitScript(() => {
    localStorage.setItem('vc_app_mode', JSON.stringify('criador'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('culture-project'));
    localStorage.setItem('vc_library', JSON.stringify([{
      id: 'culture-project',
      name: 'Cultura antigo',
      doc: {
        creativePreset: 'tendencia_cultura',
        brand: { name: 'MUSA', bg: '#101118', titleColor: '#f7f2e8', textColor: '#f7f2e8', accent: '#b7e56b' },
        slides: [{
          id: 'culture-card', num: 1,
          title: 'DIREÇÃO.',
          subtitle: 'Primeiro argumento do card.\n\nSegundo argumento do mesmo bloco.',
          bodyAfterImage: 'A criação volta a ser uma conversa com critério.',
          imageQuery: 'cadeira de direção em estúdio',
          useCultureLayout: true,
          elementOffsets: { text: { x: 4, y: 2 } },
          // Campo ausente simula um card salvo antes da edição individual.
        }, {
          id: 'culture-card-2', num: 2,
          title: 'OUTRO CARD',
          subtitle: '',
          bodyAfterImage: 'Segundo card.',
          useCultureLayout: true,
        }],
      },
    }]));
  });
}

test('card Cultura antigo abre com elementos independentes e arrasta só o alvo escolhido', async ({ page }) => {
  await mockApi(page, { session: SESSAO_ATIVA });
  await seedLegacyCultureCard(page);
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i })
    .click({ force: true, timeout: 2500 }).catch(() => {});

  const title = page.locator('[data-vc-movable="title"]:visible').first();
  await expect(title).toBeVisible();
  await expect(page.locator('[data-vc-movable="subtitle"]:visible')).toHaveCount(2);
  await expect(page.locator('[data-vc-movable="photo"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-vc-movable="bodyAfterImage"]:visible').first()).toBeVisible();

  const beforeKeyboard = await page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem('vc_library') || '[]');
    return library[0]?.doc?.slides?.[0]?.elementOffsets?.title?.x || 0;
  });
  await title.press('ArrowRight');
  await expect.poll(async () => page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem('vc_library') || '[]');
    return library[0]?.doc?.slides?.[0]?.elementOffsets?.title?.x || 0;
  }), { timeout: 5000 }).toBeGreaterThan(beforeKeyboard);
  await expect.poll(() => title.evaluate((el) => getComputedStyle(el.parentElement).overflow))
    .toBe('visible');

  const box = await title.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2 + 12, { steps: 4 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem('vc_library') || '[]');
    const slide = library[0]?.doc?.slides?.[0] || {};
    return {
      titleMoved: Math.abs(slide.elementOffsets?.title?.x || 0) > 0,
      bodyMoved: Math.abs(slide.elementOffsets?.bodyAfterImage?.x || 0) > 0,
      baseX: slide.elementOffsets?.text?.x,
    };
  }), { timeout: 5000 }).toEqual({ titleMoved: true, bodyMoved: false, baseX: 4 });

});

test('gesto de toque num elemento móvel não dispara o swipe para o card seguinte', async ({ page }) => {
  await mockApi(page, { session: SESSAO_ATIVA });
  await seedLegacyCultureCard(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i })
    .click({ force: true, timeout: 2500 }).catch(() => {});

  const title = page.locator('[data-vc-movable="title"]:visible').first();
  await expect(title).toContainText('DIREÇÃO');

  // Reproduz exatamente o contrato usado pelo container móvel: touchstart
  // guarda X e touchend compara o delta. Se o filho não interromper a
  // propagação, estes 100 px trocam para o segundo card.
  await title.evaluate((el) => {
    const fire = (type, clientX, ended = false) => {
      const ev = new Event(type, { bubbles: true, cancelable: true });
      const touch = { identifier: 1, target: el, clientX, clientY: 120 };
      Object.defineProperty(ev, 'touches', { value: ended ? [] : [touch] });
      Object.defineProperty(ev, 'changedTouches', { value: [touch] });
      el.dispatchEvent(ev);
    };
    fire('touchstart', 260);
    fire('touchmove', 210);
    fire('touchend', 160, true);
  });

  await expect(page.locator('[data-vc-movable="title"]:visible').first()).toContainText('DIREÇÃO');
});
