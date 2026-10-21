import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA, SESSAO_ANONIMA } from './helpers/api-mock.js';

test.setTimeout(60_000);

// All accounts, invites and assets are local fixtures. No real invitation is read.
const CODE = 'AB12CD34';
const BRAND = { id: 'invite-brand', name: 'Marca da equipe', titleFont: 'Arial', subtitleFont: 'Arial' };
const shared = {
  ok: true, code: CODE, name: 'Campanha da equipe', revision: 3, updatedAt: 1_790_000_000_000,
  doc: { brand: BRAND, fmt: 'carrossel', slides: [{
    id: 'team-slide', num: 1, title: 'Texto recebido da equipe', subtitle: 'Conteúdo íntegro do convite.',
  }] },
};
const personal = {
  id: 'personal-invite-fixture', name: 'Projeto pessoal', updatedAt: 1_780_000_000_000,
  doc: { brand: BRAND, fmt: 'carrossel', slides: [{
    id: 'personal-slide', num: 1, title: 'Meu projeto preservado', subtitle: 'Texto pessoal intacto.',
  }] },
};

async function mockInvite(page, { anonymous = false, response = shared, status = 200, delayed = false } = {}) {
  const state = { session: anonymous ? SESSAO_ANONIMA : SESSAO_ATIVA, joins: 0, projects: [personal] };
  let release;
  const gate = delayed ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
  await page.context().route('**/*', route => {
    const { hostname, protocol } = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(hostname) || !/^https?:$/.test(protocol)
      ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({ project, brand, session }) => {
    if (sessionStorage.getItem('invite-fixture-seeded')) return;
    sessionStorage.setItem('invite-fixture-seeded', '1');
    localStorage.setItem('vc_library', JSON.stringify([project]));
    localStorage.setItem('vc_brands', JSON.stringify([brand]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(project.id));
    localStorage.setItem('vc_active_brand_id', JSON.stringify(brand.id));
    localStorage.setItem('vc_data_owner', JSON.stringify(`email:${session.email}`));
    localStorage.setItem('vc_shell_view', JSON.stringify('home'));
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
  }, { project: personal, brand: BRAND, session: SESSAO_ATIVA });
  const metadata = { brands: [BRAND], folders: [], activeDocId: personal.id, activeBrandId: BRAND.id,
    onboardingDone: '1', modesIntroDone: '1', assetIds: [] };
  await mockApi(page, { session: state.session, extra: {
    '/api/auth/session': route => route.fulfill({ json: state.session }),
    '/api/project-share': async route => {
      expect(route.request().postDataJSON()).toEqual({ action: 'join', code: CODE });
      state.joins += 1;
      await gate;
      return route.fulfill({ status, json: response });
    },
    '/api/library-sync': route => {
      const req = route.request();
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        if (body.action === 'push') state.projects = body.manifest.docs;
        return route.fulfill({ json: { ok: true, revision: 3, updatedAt: Date.now(), assetIds: [] } });
      }
      if (new URL(req.url()).searchParams.get('full') === '1') {
        return route.fulfill({ json: { ok: true, manifest: { vcVersion: 3, customerId: SESSAO_ATIVA.customerId,
          revision: 1, updatedAt: Date.now(), docs: state.projects, brands: [BRAND], folders: [],
          activeDocId: personal.id, activeBrandId: BRAND.id, assetIds: [] } } });
      }
      return route.fulfill({ json: { ok: true, empty: false, customerId: SESSAO_ATIVA.customerId,
        meta: { revision: 1, updatedAt: Date.now(), projectCount: state.projects.length, assetIds: [] } } });
    },
    '/api/projects': route => {
      const req = route.request();
      const id = new URL(req.url()).searchParams.get('id');
      if (req.method() === 'GET') {
        const entry = state.projects.find(item => item.id === id);
        return id
          ? route.fulfill({ status: entry ? 200 : 404, json: entry
            ? { ok: true, project: { id, entry, version: 1, deleted: false } }
            : { code: 'project_not_found' } })
          : route.fulfill({ json: { ok: true, projects: state.projects.map(entry => ({ id: entry.id, entry, version: 1 })), nextCursor: null } });
      }
      const body = req.postDataJSON();
      state.projects = [...state.projects.filter(item => item.id !== body.entry.id), body.entry];
      return route.fulfill({ json: { ok: true, project: { id: body.entry.id, entry: body.entry,
        version: body.baseVersion + 1, deleted: false } } });
    },
    '/api/account-library-meta': route => route.fulfill({ json: {
      ok: true, metadata, revision: 1, updatedAt: Date.now(),
    } }),
  } });
  return { state, release: () => release?.() };
}

test('convite autenticado sobrevive a renders durante a rede e abre o projeto sem duplicar no reload', async ({ page }) => {
  const { state, release } = await mockInvite(page, { delayed: true });
  await page.goto(`/?share=${CODE}&app=1`);
  await expect.poll(() => state.joins).toBe(1);
  await expect(page.getByText('Abrindo projeto da equipe…', { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has('share')).toBe(false);
  expect(await page.evaluate(() => sessionStorage.getItem('vc_pending_share'))).toBe(CODE);
  // Opening another document changes history/state while the invite is pending.
  await page.getByRole('button', { name: 'Abrir Projeto pessoal', exact: true }).click();
  await expect(page.locator('main [data-vc-card-surface="personal-slide"]')).toBeVisible();
  release();
  const teamCard = page.locator('main [data-vc-card-surface="team-slide"]');
  await expect(teamCard).toBeVisible();
  await expect(teamCard.locator('h1,h2').first()).toHaveText('Texto recebido da equipe');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('vc_pending_share'))).toBeNull();
  await expect.poll(() => page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem('vc_library') || '[]');
    return library.filter(entry => entry.doc.shareCode === 'AB12CD34').length;
  })).toBe(1);
  const originals = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library'))
    .find(entry => entry.id === 'personal-invite-fixture'));
  expect(originals.doc.slides[0].title).toBe('Meu projeto preservado');
  await expect.poll(() => state.projects.filter(entry => entry.doc.shareCode === CODE).length,
    { timeout: 15_000 }).toBe(1);
  await page.reload();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]')
    .filter(entry => entry.doc.shareCode === 'AB12CD34').length)).toBe(1);
  expect(state.joins).toBe(1);
});

for (const failure of [
  { name: 'expirado', status: 404, response: { error: 'Código inválido ou expirado.' }, message: /Código inválido ou expirado/ },
  { name: 'servidor indisponível', status: 503, response: { error: 'Projeto temporariamente indisponível.' }, message: /Projeto temporariamente indisponível/ },
  { name: 'resposta incompleta', status: 200, response: { ok: true, code: CODE }, message: /não retornou um projeto válido/ },
]) {
  test(`convite ${failure.name} mostra erro e preserva o código para tentar novamente`, async ({ page }) => {
    const { state } = await mockInvite(page, failure);
    await page.goto(`/?share=${CODE}&app=1`);
    await expect(page.getByText(failure.message).last()).toBeVisible();
    expect(state.joins).toBe(1);
    expect(await page.evaluate(() => sessionStorage.getItem('vc_pending_share'))).toBe(CODE);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]')
      .some(entry => entry.doc.shareCode === 'AB12CD34'))).toBe(false);
  });
}

test('link incompleto mostra orientação sem pedir nem alterar projetos', async ({ page }) => {
  const { state } = await mockInvite(page);
  await page.goto('/?share=xx&app=1');
  await expect(page.getByText('O link da equipe está incompleto. Peça à equipe o link completo do projeto.', { exact: true })).toBeVisible();
  expect(state.joins).toBe(0);
});

test('convite aguarda login e o stash continua disponível no retorno sem parâmetro share', async ({ page }) => {
  const { state } = await mockInvite(page, { anonymous: true });
  await page.goto(`/?share=${CODE}&app=1`);
  await expect(page.getByRole('dialog', { name: 'Entrar no studio' })
    .getByText('Entre na sua conta Moont para abrir o projeto da equipe.', { exact: true })).toBeVisible();
  expect(state.joins).toBe(0);
  expect(await page.evaluate(() => sessionStorage.getItem('vc_pending_share'))).toBe(CODE);
  // Same tab after an OAuth return: session active, original ?share absent.
  state.session = SESSAO_ATIVA;
  await page.goto('/?login=google&app=1');
  await expect(page.locator('main [data-vc-card-surface="team-slide"]')).toBeVisible();
  expect(state.joins).toBe(1);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('vc_pending_share'))).toBeNull();
});
