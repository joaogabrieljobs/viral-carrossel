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
