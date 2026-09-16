// "Ao aumentar o subtítulo ele some da área de exibição": templates e geração
// gravavam canvas.enabled = true, logo o texto nascia preso numa zona de altura
// fixa com overflow escondido, sem o utilizador ter ligado composição nenhuma.
// Com a composição desligada o texto tem de usar o card inteiro.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const SUBTITULO_LONGO = 'O conteúdo só se espalha se a recompensa emocional superar o custo de compartilhar. Não é sobre ser apenas engraçado, mas criar intimidade e identificação através de emoções fortes que validam a conexão social.';

/** Caixa que recorta o subtítulo e quanto ele transborda dela, em px do card. */
async function medirSubtitulo(page) {
  return page.evaluate(() => {
    const tree = document.querySelector('[data-vc-export-tree]') || document;
    const cards = [...tree.querySelectorAll('div')]
      .filter((e) => e.style.width === '1080px' && e.style.height === '1350px');
    for (const card of cards) {
      const alvo = [...card.querySelectorAll('p,div')]
        .find((e) => e.children.length === 0 && (e.textContent || '').includes('recompensa emocional'));
      if (!alvo) continue;
      let zona = alvo.parentElement;
      while (zona && zona !== card && getComputedStyle(zona).overflow === 'visible') zona = zona.parentElement;
      const alvoRect = alvo.getBoundingClientRect();
      const zonaRect = (zona || card).getBoundingClientRect();
      return {
        fontePx: Math.round(parseFloat(getComputedStyle(alvo).fontSize)),
        alturaZona: Math.round(zonaRect.height),
        transbordaAbaixo: Math.round(alvoRect.bottom - zonaRect.bottom),
        zonaEhOCard: zona === card,
        // Fração do card que a caixa de recorte ocupa: com composição desligada
        // o texto tem o card quase todo; ligada, fica numa moldura pequena.
        fracaoDoCard: +(zonaRect.height / card.getBoundingClientRect().height).toFixed(2),
      };
    }
    return null;
  });
}

async function prepararCardComSubtituloLongo(page) {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.route('https://api.openai.com/**', (r) => r.fulfill({ status: 401, json: { error: { message: 'e2e' } } }));
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
  await page.waitForTimeout(600);
  await page.evaluate(() => localStorage.setItem('vc_app_mode', JSON.stringify('studio')));
  await page.reload();
  await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true, timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(600);

  await page.getByRole('button', { name: /abrir templates/i }).click({ force: true });
  await expect(page.locator('.modal-panel')).toBeVisible({ timeout: 10_000 });
  await page.locator('.modal-panel').getByRole('button').filter({ hasText: 'Erro Comum' }).first().click({ force: true });
  await expect(page.locator('[data-vc-tour="thumbnails"]')).toBeAttached({ timeout: 10_000 });
  await page.waitForTimeout(900);

  await page.getByRole('button', { name: /^Slide 2 de / }).click({ force: true });
  await page.getByRole('tab', { name: 'Narrativa' }).click({ force: true });
  await page.locator('textarea').nth(1).fill(SUBTITULO_LONGO);
  await page.waitForTimeout(900);
}

test.describe('Texto não desaparece ao crescer', () => {
  test('template entra com a composição desligada', async ({ page }) => {
    test.setTimeout(90_000);
    await prepararCardComSubtituloLongo(page);
    const ligada = await page.evaluate(() => {
      const lib = JSON.parse(localStorage.getItem('vc_library') || '[]');
      const doc = (lib.find((e) => e.id === localStorage.getItem('vc_active_doc_id')) || lib[0])?.doc || {};
      return (doc.slides || []).some((s) => s?.canvas?.enabled);
    });
    expect(ligada, 'nenhum card deve nascer com composição ligada').toBe(false);
  });

  test('sem composição, aumentar o subtítulo ao máximo não o corta', async ({ page }) => {
    test.setTimeout(120_000);
    await prepararCardComSubtituloLongo(page);

    await page.getByRole('tab', { name: 'Texto' }).click({ force: true });
    await page.getByRole('slider', { name: 'Tamanho subtítulo' }).first().fill('180');
    await page.waitForTimeout(1200);

    const m = await medirSubtitulo(page);
    expect(m, 'subtítulo não encontrado no card').not.toBeNull();
    // O que importa não é qual elemento recorta, é que a área útil seja o card
    // inteiro e que nada fique cortado.
    expect(m.fracaoDoCard, `área útil do texto é só ${m.fracaoDoCard} do card`).toBeGreaterThan(0.9);
    expect(m.transbordaAbaixo, `subtítulo transborda ${m.transbordaAbaixo}px`).toBeLessThanOrEqual(0);
  });

  test('com composição ligada as zonas voltam a valer', async ({ page }) => {
    test.setTimeout(120_000);
    await prepararCardComSubtituloLongo(page);
    await page.getByRole('tab', { name: 'Layout' }).click({ force: true });
    await page.getByRole('button', { name: /ativar composição/i }).first().click({ force: true });
    await page.waitForTimeout(1200);

    const m = await medirSubtitulo(page);
    expect(m, 'subtítulo não encontrado no card').not.toBeNull();
    // Agora há moldura: a caixa que recorta é menor que o card.
    expect(m.fracaoDoCard, 'com composição ligada o texto fica numa moldura').toBeLessThan(0.9);
  });
});

test.describe('Convite para inserir foto não rouba o card', () => {
  test('a zona de toque é delimitada e não cobre os textos', async ({ page }) => {
    test.setTimeout(120_000);
    await prepararCardComSubtituloLongo(page);

    const m = await page.evaluate(() => {
      const tree = document.querySelector('[data-vc-export-tree]');
      const card = [...document.querySelectorAll('div')]
        .filter((e) => e.style.width === '1080px' && e.style.height === '1350px')
        .filter((e) => !tree || !tree.contains(e))
        .find((e) => e.getBoundingClientRect().left > 0);
      if (!card) return null;
      const cr = card.getBoundingClientRect();
      const hit = card.querySelector('input[type="file"].vc-photo-hit');
      if (!hit) return { semZona: true };
      const hr = hit.getBoundingClientRect();
      const frac = (hr.width * hr.height) / (cr.width * cr.height);
      const textos = ['title', 'subtitle', 'text'].map((chave) => {
        const el = card.querySelector(`[data-vc-movable="${chave}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const sobrepoe = !(r.right < hr.left || r.left > hr.right || r.bottom < hr.top || r.top > hr.bottom);
        return { chave, sobrepoe };
      }).filter(Boolean);
      return { fracaoDoCard: +frac.toFixed(3), textos };
    });

    expect(m, 'card não encontrado').not.toBeNull();
    if (m.semZona) return; // card sem intenção de foto: nada a medir
    // Cobrir o card inteiro tirava o clique e o arrasto dos textos.
    expect(m.fracaoDoCard, `zona de foto ocupa ${m.fracaoDoCard} do card`).toBeLessThan(0.3);
    expect(m.textos.length, 'nenhum texto arrastável medido').toBeGreaterThan(0);
    for (const t of m.textos) {
      expect(t.sobrepoe, `zona de foto sobrepõe o ${t.chave}`).toBe(false);
    }
  });
});
