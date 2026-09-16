// O header do editor tinha 3 grupos em grid `1fr auto 1fr`: o grupo da direita
// (histórico + formato + ferramentas + perfil) mede ~730px e transbordava para
// a esquerda, sobrepondo o CTA "Gerar com IA" — 28px a 1440px, 87px a 1100px.
// Este teste mede intersecção real em X **e** Y (só em X dá falso positivo
// quando os botões estão em linhas diferentes) e falha se algum par colidir.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

async function paresSobrepostos(page) {
  return page.evaluate(() => {
    const header = document.querySelector('header');
    const itens = [...header.querySelectorAll('button, [role="button"]')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          txt: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24),
          l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height,
        };
      })
      .filter((x) => x.w > 0 && x.h > 0);
    const out = [];
    for (let i = 0; i < itens.length; i++) {
      for (let j = i + 1; j < itens.length; j++) {
        const a = itens[i]; const c = itens[j];
        if (a.txt && a.txt === c.txt) continue; // mesmo controlo duplicado no DOM
        const ox = Math.min(a.r, c.r) - Math.max(a.l, c.l);
        const oy = Math.min(a.b, c.b) - Math.max(a.t, c.t);
        if (ox > 1 && oy > 1) out.push(`${a.txt} × ${c.txt} (${Math.round(ox)}×${Math.round(oy)}px)`);
      }
    }
    return out;
  });
}

test.describe('Header do editor', () => {
  for (const largura of [1440, 1280, 1100, 900, 768]) {
    test(`nenhum controlo se sobrepõe a ${largura}px`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: largura, height: 900 });
      await mockApi(page, { session: SESSAO_ATIVA });
      await page.goto('/?app=1');
      await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
      await page.waitForTimeout(900);

      expect(await paresSobrepostos(page)).toEqual([]);
    });
  }

  test('desfazer e refazer têm alvo de toque >= 30px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.goto('/?app=1');
    await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
    await page.waitForTimeout(900);

    for (const nome of [/^desfazer$/i, /^refazer$/i]) {
      const cx = await page.getByRole('button', { name: nome }).first().boundingBox();
      expect(cx.width, `largura de ${nome}`).toBeGreaterThanOrEqual(30);
      expect(cx.height, `altura de ${nome}`).toBeGreaterThanOrEqual(30);
    }
  });
});
