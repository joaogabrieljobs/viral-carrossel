// O título já foi cortado no topo duas vezes por causas diferentes, e as duas
// passaram despercebidas porque o corte só aparece na PRÉ-VISUALIZAÇÃO em
// escala reduzida — na exportação (escala 1) o card sai correto.
//
// Este teste mede a geometria real: nenhum <h1> pode sair da zona que o contém.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

/** Quanto o título extravasa a caixa que o recorta, em px do card (1080×1350). */
async function transbordoDosTitulos(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('div')]
      .filter((e) => e.style.width === '1080px' && e.style.height === '1350px')
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.left > 0 && r.left < window.innerWidth;
      });
    const out = [];
    let escala = null;
    for (const card of cards) {
      const c = card.getBoundingClientRect();
      const k = 1080 / c.width; // px de ecrã → px do card
      escala = +(c.width / 1080).toFixed(3);
      for (const h1 of card.querySelectorAll('h1')) {
        // Sobe até a primeira caixa que recorta — é ela que decide o corte.
        let zona = h1.parentElement;
        while (zona && zona !== card && getComputedStyle(zona).overflow === 'visible') {
          zona = zona.parentElement;
        }
        if (!zona || zona === card) continue;
        const rh = h1.getBoundingClientRect();
        const rz = zona.getBoundingClientRect();
        out.push({
          texto: (h1.textContent || '').slice(0, 30),
          acima: Math.max(0, Math.round((rz.top - rh.top) * k)),
          abaixo: Math.max(0, Math.round((rh.bottom - rz.bottom) * k)),
        });
      }
    }
    // `page.evaluate` serializa arrays só pelos índices — uma propriedade solta
    // no array chegaria como undefined e o teste passaria sem medir nada.
    return { escala, itens: out };
  });
}

test.describe('Título nunca sai da zona que o recorta', () => {
  test('padrão visual + títulos de comprimentos diferentes', async ({ page }) => {
    test.setTimeout(120_000);
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.goto('/?app=1');
    await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
    await page.waitForTimeout(600);

    // Studio expõe a aba Layout (composição), onde o corte reapareceu.
    await page.evaluate(() => localStorage.setItem('vc_app_mode', JSON.stringify('studio')));
    await page.reload();
    await page.getByRole('button', { name: /continuar no editor/i })
      .click({ force: true, timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(600);

    const escreveTitulo = async (txt) => {
      await page.getByRole('tab', { name: 'Narrativa' }).click({ force: true });
      await page.waitForTimeout(300);
      const ta = page.locator('textarea').first();
      await ta.fill(txt);
      await page.waitForTimeout(1200);
    };

    // Mood Sépia: display Archivo Black com leading apertado — o pior caso.
    await escreveTitulo('O PROXIMO DIFERENCIAL.');
    await page.getByRole('tab', { name: 'Visual' }).click({ force: true });
    await page.waitForTimeout(400);
    await page.getByRole('button').filter({ hasText: 'Mood Sépia' }).first().click({ force: true });
    await page.waitForTimeout(1200);

    // O corte vive no canvas clássico: ali a zona do título tem altura fixa e
    // `justify-content: flex-end`, então o que não cabe sai pelo TOPO. Fora da
    // composição o título usa layout de fluxo e nunca reproduziu o problema.
    await page.getByRole('tab', { name: 'Layout' }).click({ force: true });
    await page.waitForTimeout(400);
    await page.getByRole('button').filter({ hasText: /Ativar composição/ }).first()
      .click({ force: true });
    await page.waitForTimeout(1200);
    const composicaoAtiva = await page.evaluate(() => {
      const lib = JSON.parse(localStorage.getItem('vc_library') || '[]');
      return !!lib[0]?.doc?.slides?.[0]?.canvas?.enabled;
    });
    expect(composicaoAtiva, 'composicao nao ativou — cenario nao reproduz o corte').toBe(true);

    for (const titulo of [
      'O PROXIMO DIFERENCIAL.',
      'ANTES QUE VIRE OBVIO.',
      'COMUNIDADES FITNESS NAO SAO SOBRE EXERCICIOS E SIM SOBRE PERTENCIMENTO',
    ]) {
      await escreveTitulo(titulo);
      const { escala, itens } = await transbordoDosTitulos(page);
      // O corte só se manifesta com o card ESCALADO (a exportação, em escala 1,
      // sempre passou). Se o cenário não tem escala, o teste não está a cobrir
      // nada — falha em vez de dar falso verde.
      expect(itens.length, 'nenhum titulo medido — cenario nao montou').toBeGreaterThan(0);
      expect(escala, `card em escala ${escala}: cenario nao reproduz o corte`).toBeLessThan(0.9);
      const cortados = itens.filter((x) => x.acima > 2 || x.abaixo > 2);
      expect(cortados, `título "${titulo.slice(0, 24)}" cortado: ${JSON.stringify(cortados)}`)
        .toEqual([]);
    }
  });
});
