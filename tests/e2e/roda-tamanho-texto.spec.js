import { readFileSync } from 'node:fs';
import { test, expect as baseExpect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

const expect = baseExpect.configure({ timeout: 15_000 });
const fx = JSON.parse(readFileSync(new URL('../fixtures/apoteose10-slide9.json', import.meta.url), 'utf8'));
const OUT = process.env.QA_RODA_DIR;

// Pedido do João (28/11, iPhone): tocar numa caixa de texto mostra uma roda de
// tamanho fora do card; girar para cima aumenta a letra e o card fica à vista.
// Tocar de novo no mesmo texto abre o painel para editar o texto.
const casos = [
  { nome: 'Stories com margem: roda vertical ao lado do card', fmt: 'stories', viewport: { width: 430, height: 760 }, orientation: 'vertical' },
  { nome: '4:5 sem margem: roda deitada abaixo do card', fmt: 'carrossel', viewport: { width: 390, height: 844 }, orientation: 'horizontal' },
];

for (const caso of casos) {
  test(`celular, ${caso.nome}`, async ({ browser }) => {
    test.setTimeout(90_000);
    const context = await browser.newContext({ viewport: caso.viewport, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol) ? route.continue() : route.abort();
    });
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.addInitScript(({ fx, fmt }) => {
      if (localStorage.getItem('roda-seeded')) return;
      localStorage.setItem('roda-seeded', '1');
      localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
      localStorage.setItem('vc_shell_view', JSON.stringify('project'));
      localStorage.setItem('vc_active_doc_id', JSON.stringify('roda'));
      localStorage.setItem('vc_library', JSON.stringify([{ id: 'roda', name: 'Roda', doc: {
        fmt, creativePreset: 'apresentacao', productKind: 'apresentacao', visualPreset: 'presentation_free', mode: 'editorial',
        brand: fx.brand, slides: [{ ...fx.slide, bgImage: null }, { ...fx.slide, id: 'outro', title: 'Outro card', bgImage: null }],
        formatViews: { stories: { brand: {}, slides: { [fx.slide.id]: fx.stories, outro: fx.stories } }, apresentacao: { brand: {} } },
      } }]));
    }, { fx, fmt: caso.fmt });
    await page.goto('/?app=1');
    await enterEditorFromHome(page);
    const card = page.locator(`main [data-vc-card-surface="${fx.slide.id}"]`).first();
    await expect(card).toBeVisible();
    const titulo = card.locator('[data-vc-zone="subtitle"]').first();
    const fonte = () => titulo.evaluate(zone => {
      const el = [...zone.querySelectorAll('*')].find(n => n.textContent.trim() && n.children.length === 0) || zone;
      return parseFloat(getComputedStyle(el).fontSize);
    });

    const tb = await card.getByText('A Apoteose pretende', { exact: false }).first().boundingBox();
    await page.touchscreen.tap(tb.x + tb.width / 2, tb.y + tb.height / 2);
    const roda = page.locator(`[data-vc-font-wheel="${caso.orientation}"]`);
    await expect(roda).toBeVisible();
    // O painel não abre no primeiro toque: o card continua inteiro à vista.
    await expect(page.getByText('Tipografia do card')).toHaveCount(0);
    const cb = await card.boundingBox();
    const rb = await roda.boundingBox();
    const fora = rb.x + rb.width <= cb.x || rb.x >= cb.x + cb.width || rb.y >= cb.y + cb.height;
    expect(fora, 'a roda não cobre o card').toBe(true);
    expect(rb.x).toBeGreaterThanOrEqual(0);
    expect(rb.x + rb.width).toBeLessThanOrEqual(caso.viewport.width);
    // A barra de ações (excluir, baixar, grade) continua à mão.
    await expect(page.getByRole('button', { name: 'Excluir elemento selecionado' })).toBeVisible();

    const antes = await fonte();
    const slider = page.getByRole('slider', { name: 'Tamanho do subtítulo' });
    const valorAntes = Number(await slider.getAttribute('aria-valuenow'));
    const sb = await slider.boundingBox();
    const cdp = await context.newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, id) => ({ ...p, id })) });
    const from = { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 };
    const delta = caso.orientation === 'vertical' ? { x: 0, y: -60 } : { x: 60, y: 0 };
    await touch('touchStart', [from]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: from.x + delta.x * i / 6, y: from.y + delta.y * i / 6 }]);
    await touch('touchEnd', []);
    await expect.poll(() => slider.getAttribute('aria-valuenow').then(Number)).toBeGreaterThan(valorAntes + 10);
    await expect.poll(fonte).toBeGreaterThan(antes);
    if (OUT) await page.screenshot({ path: `${OUT}/roda-${caso.fmt}.png` });
    // Continua no mesmo card (a roda não passa de card).
    await expect(card).toBeVisible();

    // Botão menos diminui um passo.
    const v = Number(await slider.getAttribute('aria-valuenow'));
    await page.getByRole('button', { name: 'Diminuir o subtítulo' }).click();
    await expect(slider).toHaveAttribute('aria-valuenow', String(v - 1));

    // Segundo toque no mesmo texto abre o painel para editar.
    const paragrafo = card.getByText('A Apoteose pretende', { exact: false }).first();
    const tb2 = await paragrafo.boundingBox();
    // Toque na primeira linha: com a letra maior, o meio do parágrafo pode cair
    // sobre o texto de baixo ("Uma festa…"), que é outro elemento (CI, 28/11).
    const cb2 = await card.boundingBox();
    const alvo = { x: tb2.x + tb2.width / 2, y: Math.max(tb2.y, cb2.y) + 6 };
    const tocado = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-vc-movable]')?.getAttribute('data-vc-movable'), alvo);
    expect(tocado, 'o segundo toque cai no mesmo texto').toBe('subtitle');
    // No CI o toque chegava menos de 0,3 s depois do gesto anterior e o Chrome
    // segurava o clique como possível toque duplo: pointerdown, pointerup e
    // touchend vinham, o click não (registro do PR de diagnóstico #10, 28/11).
    // Uma pessoa não toca tão rápido; esperar a janela do toque duplo.
    await page.waitForTimeout(500);
    await page.touchscreen.tap(alvo.x, alvo.y);
    await expect(page.getByText('Tipografia do card')).toBeVisible();
    await context.close();
  });
}
