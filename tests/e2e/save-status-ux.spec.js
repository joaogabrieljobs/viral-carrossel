import { enterEditorFromHome } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

test('salvo na conta só aparece para a edição confirmada pelo servidor', async ({ page }) => {
  test.setTimeout(60_000);
  let manifest = null;
  let online = true;
  await mockApi(page, { session:SESSAO_ATIVA, extra:{
    '/api/library-sync': async route => {
      if (!online) return route.fulfill({ status:503, json:{ error:'Servidor de teste indisponível.' } });
      const request = route.request();
      const url = new URL(request.url());
      const body = request.method() === 'POST' ? request.postDataJSON() : {};
      if (body.action === 'push') {
        manifest = { ...body.manifest, revision:(manifest?.revision || 0) + 1, updatedAt:Date.now() };
        return route.fulfill({ json:{ ok:true, revision:manifest.revision, projectCount:manifest.docs.length, assetIds:[] } });
      }
      if (url.searchParams.get('full') === '1') return route.fulfill({ json:{ ok:true, manifest, empty:!manifest } });
      return route.fulfill({ json:{ ok:true, empty:!manifest, meta:manifest ? { revision:manifest.revision, projectCount:manifest.docs.length, assetIds:[] } : null } });
    },
  } });
  await page.addInitScript(() => {
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('save-status'));
    localStorage.setItem('vc_library', JSON.stringify([{ id:'save-status', name:'Teste de salvamento', doc:{
      caption:'Legenda original', slides:[{ id:'save-card', title:'Uma ideia clara', subtitle:'Apoio' }],
    } }]));
  });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  const save = page.getByRole('button', { name:'Salvar projeto agora', exact:true });
  await expect(save).toBeVisible();
  await save.click();
  const confirmed = page.getByRole('status').filter({ hasText:/Salvo na conta às/ });
  await expect(confirmed.first()).toBeVisible();
  online = false;
  await page.getByRole('button', { name:/Legenda.*card 1/i }).first().click();
  const dialog = page.getByRole('dialog', { name:'Legenda da publicação' });
  await dialog.getByRole('textbox').fill('A edição mais recente ainda precisa ser enviada.');
  await dialog.getByRole('button', { name:'Feito' }).click();
  await expect(confirmed).toHaveCount(0);
  await save.click();
  await expect(page.getByRole('status').filter({ hasText:'Sincronização pendente' }).first()).toBeVisible();
  online = true;
  await save.click();
  await expect(confirmed.first()).toBeVisible();
  expect(manifest.docs.find(item => item.id === 'save-status').doc.caption).toBe('A edição mais recente ainda precisa ser enviada.');
});

// Relato de 18/11/2026 (iPhone, 390 px): com nome de projeto longo e gravação
// pendente na conta, o botão "Salvar" do aviso saía cortado pela borda direita
// e o texto do aviso se espremia em quatro linhas.
test('no celular o aviso de gravação pendente e seu botão cabem na tela', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page, { session:SESSAO_ATIVA, extra:{
    // Conta vazia e nenhum envio: o projeto fica gravado só no aparelho.
    '/api/library-sync': route => route.fulfill({ json:{ ok:true, empty:true, meta:null } }),
  } });
  await page.addInitScript(() => {
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('save-status-mobile'));
    localStorage.setItem('vc_library', JSON.stringify([{ id:'save-status-mobile', name:'Design 1511 R2 — Estudo de caso — Quando o pedido encontra a fila', doc:{
      caption:'', slides:[{ id:'save-card', title:'Uma ideia clara', subtitle:'Apoio' }],
    } }]));
  });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  // Uma edição grava no aparelho; sem envio, o aviso longo aparece.
  await page.getByRole('button', { name:/Legenda.*card 1/i }).first().click();
  const dialog = page.getByRole('dialog', { name:'Legenda da publicação' });
  await dialog.getByRole('textbox').fill('Edição local.');
  await dialog.getByRole('button', { name:/Fechar|Concluir|Salvar/ }).first().click();
  await expect(page.getByRole('status').filter({ hasText:/Salvo no aparelho · pendente na conta/ }).first()).toBeVisible({ timeout: 20_000 });
  const retry = page.getByRole('button', { name:'Tentar salvar na conta', exact:true });
  await expect(retry.first()).toBeVisible({ timeout: 20_000 });
  const box = await retry.first().boundingBox();
  expect(box.x, 'botão começa dentro da tela').toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, 'botão termina dentro da tela').toBeLessThanOrEqual(390);
  const status = await retry.first().evaluate(el => {
    const texto = el.parentElement.querySelector('[role="status"]');
    const estilo = getComputedStyle(texto);
    return { linhas: Math.round(texto.getBoundingClientRect().height / parseFloat(estilo.lineHeight)), largura: document.documentElement.scrollWidth };
  });
  expect(status.linhas, 'texto do aviso em no máximo duas linhas').toBeLessThanOrEqual(2);
  expect(status.largura, 'sem rolagem horizontal').toBeLessThanOrEqual(390);
});
