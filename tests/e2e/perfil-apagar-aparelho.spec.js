// Perfil (João, 19/11): "Sair e apagar deste aparelho" fica por último e pede a senha.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA, SESSAO_ANONIMA } from './helpers/api-mock.js';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function abrirPerfil(page, { confirm }) {
  const estado = { sessao: SESSAO_ATIVA, confirmacoes: [], logout: false };
  await mockApi(page, { extra: {
    '/api/auth/session': (route) => route.fulfill({ json: estado.sessao }),
    '/api/auth/login': (route) => {
      const body = route.request().postDataJSON();
      estado.confirmacoes.push(body);
      return confirm(route, body);
    },
    '/api/auth/logout': (route) => { estado.logout = true; estado.sessao = SESSAO_ANONIMA; return route.fulfill({ json: { ok: true, localCookieCleared: true } }); },
    '/api/library-sync': (route) => route.fulfill({ json: { ok: true, empty: true, manifest: null, meta: null, cloudSaved: true } }),
  } });
  await page.goto('/?app=1');
  await expect(page.locator('[data-vc-tour="account-home"]')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Perfil', exact: true }).first().click();
  return estado;
}

test('o botão vermelho é a última coisa do Perfil e saiu do cartão de assinatura', async ({ page }) => {
  await abrirPerfil(page, { confirm: (route) => route.fulfill({ json: { verified: true, hasPassword: true } }) });
  const botao = page.getByRole('button', { name: 'Sair e apagar deste aparelho' });
  await expect(botao).toHaveCount(1);
  const fimDoBotao = await botao.evaluate((el) => el.getBoundingClientRect().bottom + window.scrollY);
  const ultimoElemento = await page.evaluate(() => {
    const visiveis = [...document.querySelectorAll('main button, main a, main section, button, section')]
      .filter((el) => el.getClientRects().length && !el.closest('nav'));
    return Math.max(...visiveis.map((el) => el.getBoundingClientRect().bottom + window.scrollY));
  });
  expect(fimDoBotao).toBeGreaterThanOrEqual(ultimoElemento - 20);
  // "Sair da conta" continua no cartão de assinatura, separado do apagar.
  const sair = await page.getByRole('button', { name: 'Sair da conta', exact: true }).boundingBox();
  const apagar = await botao.boundingBox();
  expect(apagar.y).toBeGreaterThan(sair.y + 200);
});

test('pede a senha: errada não apaga, certa apaga e sai', async ({ page }) => {
  let senhaCerta = false;
  const estado = await abrirPerfil(page, { confirm: (route, body) => (body.password === 'SenhaCerta123!'
    ? route.fulfill({ json: { verified: true, hasPassword: true } })
    : route.fulfill({ status: 401, json: { verified: false, hasPassword: true, error: 'Senha incorreta.' } })) });
  await page.getByRole('button', { name: 'Sair e apagar deste aparelho' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Sair e apagar deste aparelho' });
  await expect(dialogo).toBeVisible();
  await dialogo.locator('input[type="password"]').fill('SenhaErrada1!');
  await dialogo.getByRole('button', { name: 'Apagar deste aparelho' }).click();
  await expect(dialogo.getByRole('alert')).toHaveText('Senha incorreta.');
  expect(estado.logout).toBe(false);
  expect(estado.confirmacoes.at(-1)).toEqual({ purpose: 'confirm', password: 'SenhaErrada1!' });

  await dialogo.locator('input[type="password"]').fill('SenhaCerta123!');
  senhaCerta = true;
  await dialogo.getByRole('button', { name: 'Apagar deste aparelho' }).click();
  await expect.poll(() => estado.logout, { timeout: 30_000 }).toBe(true);
  expect(senhaCerta).toBe(true);
});

test('conta só com Google confirma digitando o próprio e-mail', async ({ page }) => {
  const estado = await abrirPerfil(page, { confirm: (route) => route.fulfill({ json: { verified: false, hasPassword: false } }) });
  await page.getByRole('button', { name: 'Sair e apagar deste aparelho' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Sair e apagar deste aparelho' });
  await dialogo.locator('input[type="password"]').fill('qualquercoisa');
  await dialogo.getByRole('button', { name: 'Apagar deste aparelho' }).click();
  await expect(dialogo.getByText('Esta conta entra com Google e não tem senha.')).toBeVisible();
  await dialogo.locator('input[type="email"]').fill('outra@pessoa.com');
  await dialogo.getByRole('button', { name: 'Apagar deste aparelho' }).click();
  await expect(dialogo.getByRole('alert')).toHaveText('O e-mail digitado não é o desta conta.');
  expect(estado.logout).toBe(false);
  await dialogo.locator('input[type="email"]').fill(SESSAO_ATIVA.email);
  await dialogo.getByRole('button', { name: 'Apagar deste aparelho' }).click();
  await expect.poll(() => estado.logout, { timeout: 30_000 }).toBe(true);
});

test('cancelar não apaga nada', async ({ page }) => {
  const estado = await abrirPerfil(page, { confirm: (route) => route.fulfill({ json: { verified: true, hasPassword: true } }) });
  await page.getByRole('button', { name: 'Sair e apagar deste aparelho' }).click();
  await page.getByRole('dialog', { name: 'Sair e apagar deste aparelho' }).getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('dialog', { name: 'Sair e apagar deste aparelho' })).toHaveCount(0);
  expect(estado.confirmacoes).toEqual([]);
  expect(estado.logout).toBe(false);
});
