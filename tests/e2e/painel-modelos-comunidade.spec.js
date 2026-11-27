// "Modelos da comunidade" no painel: os dois botões cabem, sem o texto vazar,
// no painel lateral do desktop e na gaveta do celular (390 px).
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

const projeto = {
  id: 'proj-painel', name: 'Projeto do painel', updatedAt: Date.now(),
  doc: { fmt: 'carrossel', brand: { name: 'Marca', handle: '@marca' },
    slides: [1, 2, 3].map((n) => ({ id: `p${n}`, title: `Título ${n}`, subtitle: `Apoio ${n}`, layout: 'mc', align: 'center' })) },
};

async function abrir(page, modo) {
  await mockApi(page, { session: SESSAO_ATIVA, extra: {
    '/api/library-sync': (route) => route.fulfill({ json: { ok: true, empty: true, manifest: null, meta: null } }),
  } });
  await page.addInitScript(({ p, modo: m }) => {
    if (localStorage.getItem('vc_library') !== null) return;
    localStorage.setItem('vc_data_owner', JSON.stringify('email:assinante@teste.exemplo'));
    localStorage.setItem('vc_library', JSON.stringify([p]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(p.id));
    if (m) localStorage.setItem('vc_app_mode', JSON.stringify(m));
  }, { p: projeto, modo });
  await page.goto('/?app=1');
  await enterEditorFromHome(page, projeto.name);
}

/** Caixa do texto contra a caixa do botão, linhas e rolagem interna. */
const medir = (entrada) => entrada.locator('button').evaluateAll((buttons) => buttons.map((button) => {
  const box = button.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(button);
  const text = range.getBoundingClientRect();
  const lineHeight = parseFloat(getComputedStyle(button).lineHeight) || 16;
  return {
    label: button.textContent.trim(),
    dentro: text.left >= box.left - 0.5 && text.right <= box.right + 0.5 && text.top >= box.top - 0.5 && text.bottom <= box.bottom + 0.5,
    semRolagem: button.scrollWidth <= button.clientWidth + 1 && button.scrollHeight <= button.clientHeight + 1,
    linhas: Math.round(text.height / lineHeight),
  };
}));

test('desktop: no painel lateral (Visual), cada botão cabe em uma linha', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await abrir(page, 'studio');
  await page.getByRole('tab', { name: /^Visual$/i }).click({ force: true });
  const entrada = page.locator('[data-vc-template-gallery-entry]').first();
  await entrada.scrollIntoViewIfNeeded();
  await expect(entrada.getByRole('button', { name: 'Publicar como modelo' })).toBeVisible();
  const botoes = await medir(entrada);
  expect(botoes.map((b) => b.label)).toEqual(['Galeria de modelos', 'Publicar como modelo']);
  for (const botao of botoes) expect(botao, botao.label).toMatchObject({ dentro: true, semRolagem: true, linhas: 1 });
});

test('celular: na gaveta (390 px) o texto não sai do botão', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await abrir(page);
  const entrada = page.locator('[data-vc-template-gallery-entry]').first();
  if (!await entrada.isVisible().catch(() => false)) {
    const aba = page.getByRole('tab', { name: 'Ajustes', exact: true });
    if (await aba.isVisible().catch(() => false)) await aba.click();
    else await page.getByRole('button', { name: 'Abrir aba Ajustes', exact: true }).click();
  }
  await entrada.scrollIntoViewIfNeeded();
  await expect(entrada.getByRole('button', { name: 'Publicar como modelo' })).toBeVisible();
  const botoes = await medir(entrada);
  for (const botao of botoes) expect(botao, botao.label).toMatchObject({ dentro: true, semRolagem: true, linhas: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await ctx.close();
});
