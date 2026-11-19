// Navegação no celular (João, 19/11): card grande na primeira dobra, topo
// compacto e miniatura do card acima do painel de edição.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const semear = (page, fmt, styleKit) => page.addInitScript(({ fmt: formato, styleKit: kit }) => {
  if (localStorage.getItem('vc_library') !== null) return;
  localStorage.setItem('vc_library', JSON.stringify([{
    id: 'nav', name: 'Projeto com nome comprido para caber no topo', updatedAt: Date.now(),
    doc: { fmt: formato, ...(kit ? { styleKit: kit } : {}), slides: [1, 2, 3].map((n) => ({
      id: `nav-${n}`, num: n, title: `Título do card ${n}`, subtitle: 'Texto de apoio do card.', layout: 'mc', align: 'center', textShadow: false,
    })) },
  }]));
  localStorage.setItem('vc_active_doc_id', JSON.stringify('nav'));
}, { fmt, styleKit });

async function abrir(page, fmt = 'carrossel', styleKit = null) {
  await mockApi(page, { session: SESSAO_ATIVA, extra: {
    '/api/library-sync': (route) => route.fulfill({ json: { ok: true, empty: true, manifest: null, meta: null } }),
  } });
  await semear(page, fmt, styleKit);
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await expect(page.locator('[data-canvas-active="true"]')).toBeVisible();
}

const caixa = (locator) => locator.boundingBox();
const cardAtivo = (page) => page.locator('main [data-canvas-active="true"] [data-vc-card-surface]').first();

test.describe('Navegação no celular', () => {
  test('feed: card na largura da tela, inteiro na primeira dobra, sem rolagem lateral', async ({ page }) => {
    await abrir(page);
    const card = await caixa(cardAtivo(page));
    expect(card.width).toBeGreaterThanOrEqual(360);
    expect(card.y).toBeLessThan(260);
    expect(card.y + card.height).toBeLessThanOrEqual(844 - 72);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    // Topo enxuto: sem logo, sem "Sem cliente definido", sem barra de zoom fixa.
    await expect(page.getByText('Sem cliente definido')).toHaveCount(0);
    await expect(page.getByRole('toolbar', { name: 'Zoom e navegação dos cards' })).toHaveCount(0);
    // Botões do topo com alvo de toque de 44 px.
    for (const nome of ['Projetos', 'Perfil']) {
      const b = await caixa(page.getByRole('button', { name: nome, exact: true }).first());
      expect(b.height, nome).toBeGreaterThanOrEqual(44);
      expect(b.width, nome).toBeGreaterThanOrEqual(44);
    }
  });

  test('Stories com contexto ativo: card alto cabe inteiro e o contexto ocupa uma linha', async ({ page }) => {
    await abrir(page, 'stories', { contextMd: 'Clínica de medicina regenerativa.', stylePrompt: '', refImages: [] });
    const faixa = await caixa(page.getByRole('status', { name: 'Contexto ativo' }));
    expect(faixa.height).toBeLessThanOrEqual(44);
    const card = await caixa(cardAtivo(page));
    expect(card.y + card.height).toBeLessThanOrEqual(844 - 72);
    expect(card.height).toBeGreaterThan(400);
  });

  test('formato troca pela linha do topo, com o nome completo para leitor de tela', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Stories', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stories', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const card = await caixa(cardAtivo(page));
    expect(card.height / card.width).toBeGreaterThan(1.7);
    expect(card.y + card.height).toBeLessThanOrEqual(844 - 72);
  });

  test('painel de texto aberto mostra a miniatura do card, que acompanha a edição', async ({ page }) => {
    await abrir(page);
    await page.locator('main [data-vc-card-surface="nav-1"] [data-vc-movable="title"]').click();
    const mini = page.locator('[data-vc-drawer-preview-card]');
    await expect(mini).toBeVisible();
    const box = await caixa(mini);
    const painel = await caixa(page.getByRole('dialog', { name: 'Editor do card' }));
    expect(box.y + box.height).toBeLessThanOrEqual(painel.y + 1); // inteira acima do painel
    expect(box.height).toBeGreaterThan(200);
    await expect(mini).toContainText('Título do card 1');
    // Edita no painel e a miniatura acompanha.
    const campo = page.getByRole('dialog', { name: 'Editor do card' }).locator('textarea').first();
    await campo.fill('Título trocado no painel');
    await expect(mini).toContainText('Título trocado no painel');
    // O quadro por trás some: nada do card antigo vaza sobre a miniatura.
    await expect(page.locator('#vc-cards-viewport')).toHaveCSS('visibility', 'hidden');
    // Tocar na área da miniatura fecha o painel.
    await page.mouse.click(195, Math.max(20, box.y - 4));
    await expect(page.getByRole('dialog', { name: 'Editor do card' })).toHaveCount(0);
    await expect(page.locator('#vc-cards-viewport')).toHaveCSS('visibility', 'visible');
  });
});
