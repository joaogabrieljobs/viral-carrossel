// Texto passando por baixo do selo de rodapé já apareceu duas vezes. As duas
// só se veem na pré-visualização — a exportação sai igual, porque o problema
// é geométrico e não de escala.
//
// Este teste mede sobreposição real entre caixas: nenhum par de elementos
// visíveis do card pode se cruzar por mais de 2px.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

/** Pares de elementos que se cruzam, em px do card (1080×1350). */
async function colisoes(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('div')]
      .filter((e) => e.style.width === '1080px' && e.style.height === '1350px')
      .filter((e) => e.getBoundingClientRect().width > 0);
    const res = [];
    for (const card of cards) {
      const c = card.getBoundingClientRect();
      const k = 1080 / c.width;
      const alvos = [];
      const add = (el, nome) => {
        if (!el || !(el.textContent || '').trim()) return;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        alvos.push({ el, nome, l: r.left, t: r.top, r: r.right, b: r.bottom });
      };
      card.querySelectorAll('h1').forEach((e) => add(e, 'titulo'));
      for (const ch of ['headerBar', 'pill', 'footerBar', 'pageBadge', 'handleBadge']) {
        card.querySelectorAll(`[data-vc-movable="${ch}"]`).forEach((e) => add(e, ch));
      }
      card.querySelectorAll('p').forEach((e, i) => add(e, `paragrafo${i}`));
      for (let i = 0; i < alvos.length; i += 1) {
        for (let j = i + 1; j < alvos.length; j += 1) {
          const A = alvos[i]; const B = alvos[j];
          // pai × filho é aninhamento, não colisão
          if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
          const ox = Math.min(A.r, B.r) - Math.max(A.l, B.l);
          const oy = Math.min(A.b, B.b) - Math.max(A.t, B.t);
          if (ox > 2 && oy > 2) res.push({ par: `${A.nome} × ${B.nome}`, px: Math.round(Math.min(ox, oy) * k) });
        }
      }
    }
    const vistos = new Set();
    return res.filter((x) => {
      const q = x.par + x.px;
      if (vistos.has(q)) return false;
      vistos.add(q);
      return true;
    });
  });
}

test.describe('Nenhum elemento do card se sobrepõe a outro', () => {
  test('padrões com selo de rodapé, em três comprimentos de título', async ({ page }) => {
    test.setTimeout(180_000);
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.goto('/?app=1');
    await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
    await page.waitForTimeout(600);
    await page.evaluate(() => localStorage.setItem('vc_app_mode', JSON.stringify('studio')));
    await page.reload();
    await page.getByRole('button', { name: /continuar no editor/i })
      .click({ force: true, timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(700);

    const escreve = async (txt) => {
      await page.getByRole('tab', { name: 'Narrativa' }).click({ force: true });
      await page.waitForTimeout(300);
      await page.locator('textarea').first().fill(txt);
      await page.waitForTimeout(1000);
    };
    await escreve('Depois.');

    // Só os padrões COM seta no selo colidiam: a seta é mais alta que a linha
    // de texto e a reserva do rodapé media apenas o texto.
    const comSelo = ['Case Study Neon', 'Reflexivo Serif', 'Viral Hype Dark'];
    for (const padrao of comSelo) {
      await page.getByRole('tab', { name: 'Visual' }).click({ force: true });
      await page.waitForTimeout(400);
      await page.getByRole('button').filter({ hasText: padrao }).first().click({ force: true });
      await page.waitForTimeout(900);

      for (const titulo of ['Depois.', 'O PROXIMO DIFERENCIAL.', 'COMUNIDADES FITNESS NAO SAO SOBRE EXERCICIOS']) {
        await escreve(titulo);
        const achadas = await colisoes(page);
        // guarda contra falso verde: se nada foi medido, o cenário não montou
        const medidos = await page.locator('h1').count();
        expect(medidos, 'nenhum card renderizado').toBeGreaterThan(0);
        expect(
          achadas,
          `${padrao} · "${titulo.slice(0, 22)}": ${JSON.stringify(achadas)}`,
        ).toEqual([]);
      }
    }
  });
});
