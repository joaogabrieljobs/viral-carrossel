import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ANONIMA, SESSAO_ATIVA } from './helpers/api-mock.js';

async function setup(page, { initialMode = 'active' } = {}) {
  const state = { mode:initialMode, reads:0, portalRequests:0, checkoutRequests:0, portalUnavailable:false, quotaUsed:2 };
  await mockApi(page, { session:SESSAO_ATIVA, extra:{
    '/api/auth/session': route => {
      state.reads += 1;
      if (state.mode === 'unavailable') return route.fulfill({ status:503, json:{ error:'Consulta temporariamente indisponível.' } });
      if (state.mode === 'anonymous') return route.fulfill({ status:401, json:{ error:'Sessão ausente.' } });
      if (state.mode === 'inactive') return route.fulfill({ json:{ active:false, status:'inactive', email:SESSAO_ATIVA.email } });
      return route.fulfill({ json:{ ...SESSAO_ATIVA, tier:'creator', plan:{ id:'creator', name:'Criador' },
        ...(state.mode === 'exempt' ? { billingExempt:true, accessSource:'exempt', status:'exempt', quotaPeriodStart:'2026-11-01T12:00:00.000Z', quotaPeriodEnd:'2026-12-01T12:00:00.000Z' } : { billingExempt:false, accessSource:'stripe' }),
        currentPeriodEnd:'2026-12-01T12:00:00.000Z', imageQuota:{ available:true, status:'available', tier:'creator', limit:50, used:state.quotaUsed, remaining:50 - state.quotaUsed },
      } });
    },
    '/api/library-sync': route => route.fulfill({ json:{ ok:true, empty:true, manifest:null, meta:null } }),
    '/api/stripe/portal': route => {
      state.portalRequests += 1;
      expect(route.request().method()).toBe('POST');
      if (state.portalUnavailable) return route.fulfill({ status:503, json:{ error:'Portal temporariamente indisponível. Tente novamente.' } });
      return route.fulfill({ json:{ url:new URL('/portal-fixture', route.request().url()).href } });
    },
    '/api/stripe/checkout': route => {
      state.checkoutRequests += 1;
      return route.fulfill({ status:500, json:{ error:'Este teste não deve iniciar checkout.' } });
    },
  } });
  await page.route('**/portal-fixture', route => route.fulfill({ contentType:'text/html', body:'<h1>Portal do cliente de teste</h1>' }));
  await page.addInitScript(owner => {
    if (localStorage.getItem('vc_library') !== null) return;
    localStorage.setItem('vc_data_owner', JSON.stringify(owner));
    localStorage.setItem('vc_shell_view', JSON.stringify('home'));
    localStorage.setItem('vc_library', JSON.stringify([{ id:'access-draft', name:'Rascunho preservado', doc:{
      fmt:'carrossel', slides:[{ id:'access-slide', title:'Minha edição permanece aqui', subtitle:'Conteúdo ainda em revisão.' }],
    } }]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('access-draft'));
  }, `email:${SESSAO_ATIVA.email}`);
  await page.goto('/?app=1');
  await page.getByRole('button', { name:'Perfil', exact:true }).click();
  const subscription = page.getByRole('region', { name:'Assinatura e acesso', exact:true });
  await expect(subscription).toContainText(initialMode === 'exempt' ? 'Conta isenta de cobrança' : 'Acesso à assinatura confirmado');
  await expect.poll(() => state.reads).toBeGreaterThanOrEqual(2);
  return { state, subscription };
}

async function expectDraftPreserved(page) {
  await expect.poll(() => page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem('vc_library') || '[]');
    return library.find(project => project.id === 'access-draft')?.doc?.slides?.map(slide => slide.title);
  })).toEqual(['Minha edição permanece aqui']);
}

test('Perfil confirma active=false do servidor sem manter plano ativo nem apagar o rascunho', async ({ page }) => {
  const { state, subscription } = await setup(page);
  await expect(subscription).toContainText('período atual até 01/12/2026');
  state.mode = 'inactive';
  await subscription.getByRole('button', { name:'Atualizar acesso', exact:true }).click();
  await expect(page.getByRole('heading', { name:'Studio completo. Imagens inclusas a partir do Plano Criador.', exact:true })).toBeVisible();
  await expect(page.getByText('A consulta não confirmou o acesso à assinatura. Seus projetos não foram apagados. Confira a assinatura no portal do cliente.', { exact:true })).toBeVisible();
  await expect(page.getByText('Plano individual ativo', { exact:true })).toHaveCount(0);
  await expect(subscription).toHaveCount(0);
  await expectDraftPreserved(page);
  const portal = page.getByRole('button', { name:'Abrir portal do cliente', exact:true });
  await expect(portal).toBeVisible();
  expect(state.portalRequests).toBe(0);
  expect(state.checkoutRequests).toBe(0);
  await portal.click();
  await expect(page.getByRole('heading', { name:'Portal do cliente de teste', exact:true })).toBeVisible();
  expect(state.portalRequests).toBe(1);
  expect(state.checkoutRequests).toBe(0);
  await expectDraftPreserved(page);
});

test('isenção confirmada abre Perfil e uso, mas falha de consulta não mantém selo confirmado', async ({ page }) => {
  const { state, subscription } = await setup(page, { initialMode:'exempt' });
  await expect(subscription).toContainText('ciclo de créditos até 01/12/2026');
  await expect(subscription).not.toContainText('Pagamento e cancelamento');
  await page.getByRole('button', { name:'Uso', exact:true }).click();
  const quota = page.getByRole('region', { name:'Consumo de imagens do plano' });
  await expect(quota).toContainText('Plano Criador');
  await expect(quota.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '50');
  await expect(quota.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  state.quotaUsed = 50;
  await page.getByRole('button', { name:'Atualizar uso', exact:true }).click();
  await expect(quota).toContainText('Limite do ciclo atingido');
  await expect(page.getByRole('button', { name:'Ver opções do plano', exact:true })).toHaveCount(0);
  await page.getByRole('button', { name:'Perfil', exact:true }).click();
  await expect(subscription).toContainText('Conta isenta de cobrança');
  state.mode = 'unavailable';
  await subscription.getByRole('button', { name:'Atualizar acesso', exact:true }).click();
  await expect(subscription).toContainText('Não foi possível verificar o acesso');
  await expect(subscription).not.toContainText('Conta isenta de cobrança');
  await expectDraftPreserved(page);
  state.mode = 'exempt';
  await subscription.getByRole('button', { name:'Atualizar acesso', exact:true }).click();
  await expect(subscription).toContainText('Conta isenta de cobrança');
  state.mode = 'inactive';
  await subscription.getByRole('button', { name:'Atualizar acesso', exact:true }).click();
  await expect(page.getByRole('heading', { name:'Studio completo. Imagens inclusas a partir do Plano Criador.', exact:true })).toBeVisible();
  await expect(page.getByText('Conta isenta de cobrança', { exact:true })).toHaveCount(0);
  await expectDraftPreserved(page);
  expect(state.checkoutRequests).toBe(0);
});

test('falha do portal aparece no paywall, permite tentar novamente e não inicia checkout', async ({ page }) => {
  const { state, subscription } = await setup(page);
  state.mode = 'inactive';
  state.portalUnavailable = true;
  await subscription.getByRole('button', { name:'Atualizar acesso', exact:true }).click();
  const portal = page.getByRole('button', { name:'Abrir portal do cliente', exact:true });
  await portal.click();
  await expect(page.getByRole('alert')).toHaveText('Portal temporariamente indisponível. Tente novamente.');
  await expect(portal).toBeEnabled();
  expect(state.portalRequests).toBe(1);
  expect(state.checkoutRequests).toBe(0);
  await expectDraftPreserved(page);
});

test('e-mail digitado no paywall anônimo não oferece acesso ao portal nem abre o editor', async ({ page }) => {
  await mockApi(page, { session:SESSAO_ANONIMA });
  await page.goto('/?app=1');
  await page.locator('input[type="email"]').first().fill(SESSAO_ATIVA.email);
  await expect(page.getByRole('button', { name:'Abrir portal do cliente', exact:true })).toHaveCount(0);
  await expect(page.locator('[data-vc-tour="thumbnails"]')).toHaveCount(0);
});

test('sessão expirada pede login sem deduzir problema na assinatura e preserva o rascunho', async ({ page }) => {
  const { state, subscription } = await setup(page);
  state.mode = 'anonymous';
  await subscription.getByRole('button', { name:'Atualizar acesso', exact:true }).click();
  await expect(page.getByText('Sua sessão não foi confirmada. Seus projetos não foram apagados. Entre novamente para verificar sua conta.', { exact:true })).toBeVisible();
  await expect(page.getByRole('button', { name:'Abrir portal do cliente', exact:true })).toHaveCount(0);
  await expect(page.locator('[data-vc-tour="thumbnails"]')).toHaveCount(0);
  await expectDraftPreserved(page);
  expect(state.portalRequests).toBe(0);
  expect(state.checkoutRequests).toBe(0);
});

test('erro transitório de verificação fica desconhecido e uma nova consulta recupera a confirmação', async ({ page }) => {
  const { state, subscription } = await setup(page);
  state.mode = 'unavailable';
  await subscription.getByRole('button', { name:'Atualizar acesso', exact:true }).click();
  await expect(subscription).toContainText('Não foi possível verificar o acesso à assinatura agora');
  await expect(subscription).not.toContainText('Acesso à assinatura confirmado');
  await expect(subscription).not.toContainText('Acesso à assinatura não confirmado');
  await expect(subscription).not.toContainText('período atual até');
  await expect(page.getByRole('heading', { name:'Perfil pessoal', exact:true })).toBeVisible();
  await expectDraftPreserved(page);
  state.mode = 'active';
  await subscription.getByRole('button', { name:'Atualizar acesso', exact:true }).click();
  await expect(subscription).toContainText('Acesso à assinatura confirmado');
  await expect(subscription).toContainText('período atual até 01/12/2026');
  await expectDraftPreserved(page);
});
