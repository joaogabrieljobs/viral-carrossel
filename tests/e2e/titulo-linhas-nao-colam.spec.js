// "Esse template tá muito encavalado": em caixa alta os acentos (Á, Ã, Ó) sobem
// acima da altura de capitular, logo leading de 100–110% fazia a linha de baixo
// tocar a de cima. Verificado card a card em escala 1 (1080×1350).
//
// Nota de método: medir o "vão" entre linhas com Range.getClientRects() não serve
// aqui — esses rects são a caixa de conteúdo da fonte (em Anton ~1.5em), não a
// tinta, e dão sobreposição mesmo quando o texto respira. O invariante testável é
// o leading e o tracking mínimos por face, que foi o que se calibrou no olho.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const TITULO = 'A IA NÃO ESTÁ CONVERSANDO. ESTÁ CONSPIRANDO CONTRA NÓS';

/** Mínimos calibrados no render em escala 1. Chave = família tal como o browser a reporta. */
const MINIMO = {
  Anton: 1.22,
  'Big Shoulders Display': 1.16,
  'Archivo Black': 1.14,
  Playfair: 1.10,
  'Yeseva One': 1.10,
  'Inter Tight': 1.14,
};
const TRACKING_MIN_EM = -0.025;

const PADROES = [
  'Sports Editorial', 'Case Study Neon', 'Mood Sépia', 'Bold Promo Pink',
  'Tabloid Keywords', 'Luxury Hybrid', 'Viral Hype Dark', 'Authority Black', 'Minimal Clean',
];

async function tipografiaDoTitulo(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('div')]
      .filter((e) => e.style.width === '1080px' && e.style.height === '1350px');
    for (const card of cards) {
      const h1 = card.querySelector('h1');
      if (!h1 || (h1.textContent || '').trim().length < 12) continue;
      const cs = getComputedStyle(h1);
      const fs = parseFloat(cs.fontSize);
      if (!fs) continue;
      const lh = cs.lineHeight === 'normal' ? fs * 1.2 : parseFloat(cs.lineHeight);
      return {
        fonte: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
        razaoLinha: +(lh / fs).toFixed(3),
        trackingEm: +(parseFloat(cs.letterSpacing || '0') / fs).toFixed(4),
        linhas: Math.round(h1.getBoundingClientRect().height / lh),
      };
    }
    return null;
  });
}

test.describe('Linhas do título não se colam', () => {
  test('cada padrão visual respeita o leading e o tracking mínimos da sua fonte', async ({ page }) => {
    test.setTimeout(180_000);
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.goto('/?app=1');
    await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
    await page.waitForTimeout(600);
    await page.evaluate(() => localStorage.setItem('vc_app_mode', JSON.stringify('studio')));
    await page.reload();
    await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true, timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(600);

    await page.getByRole('tab', { name: 'Narrativa' }).click({ force: true });
    await page.locator('textarea').first().fill(TITULO);
    await page.waitForTimeout(900);

    const falhas = [];
    for (const padrao of PADROES) {
      await page.getByRole('tab', { name: 'Visual' }).click({ force: true });
      await page.waitForTimeout(250);
      await page.getByRole('button').filter({ hasText: padrao }).first().click({ force: true });
      await page.waitForTimeout(900);

      const t = await tipografiaDoTitulo(page);
      expect(t, `${padrao}: título não medido`).not.toBeNull();
      expect(t.linhas, `${padrao}: título deveria quebrar em várias linhas`).toBeGreaterThan(1);

      const min = MINIMO[t.fonte];
      if (min === undefined) falhas.push(`${padrao}: fonte "${t.fonte}" sem mínimo definido — calibre e registe`);
      else if (t.razaoLinha < min) falhas.push(`${padrao}: leading ${t.razaoLinha}× (mínimo ${min} para ${t.fonte})`);
      if (t.trackingEm < TRACKING_MIN_EM) falhas.push(`${padrao}: tracking ${t.trackingEm}em (mínimo ${TRACKING_MIN_EM})`);
    }
    expect(falhas, `padrões encavalados:\n${falhas.join('\n')}`).toEqual([]);
  });
});
