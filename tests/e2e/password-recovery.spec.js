import { test, expect } from '@playwright/test';
import { mockApi } from './helpers/api-mock.js';

async function openLogin(page, extra = {}) {
  await mockApi(page, { extra });
  await page.goto('/?landing=1');
  await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
  return page.getByRole('dialog', { name: 'Entrar no studio' });
}

test('mostrar/ocultar senha permanece legível e volta a ocultar após fechar ou mudar de modo', async ({ page }, testInfo) => {
  const dialog = await openLogin(page);
  const password = dialog.getByLabel('Senha', { exact: true });
  await password.fill('SenhaDeTeste123!');
  await dialog.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(dialog.getByRole('button', { name: 'Ocultar senha', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Ocultar senha', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await dialog.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
  await dialog.getByRole('button', { name: 'Criar conta', exact: true }).first().click();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveValue('');
  await dialog.screenshot({ path: testInfo.outputPath('login.png') });
});

test('esqueci minha senha preserva o e-mail e envia só o endereço; permite voltar ao login', async ({ page }) => {
  const requests = [];
  const dialog = await openLogin(page, { '/api/auth/forgot-password': route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true, message: 'Se houver uma conta com esse e-mail, você receberá um link. Confira também o spam.' } });
  } });
  await dialog.getByLabel('E-mail').fill('pessoa@teste.exemplo');
  await dialog.getByRole('button', { name: 'Esqueci minha senha' }).click();
  const recovery = page.getByRole('dialog', { name: 'Esqueci minha senha' });
  await expect(recovery.getByLabel('E-mail')).toHaveValue('pessoa@teste.exemplo');
  await expect(recovery.getByLabel('Senha', { exact: true })).toHaveCount(0);
  await recovery.getByRole('button', { name: 'Enviar link de recuperação' }).click();
  await expect(recovery.getByRole('status')).toContainText('Confira também o spam');
  expect(requests).toEqual([{ email: 'pessoa@teste.exemplo' }]);
  await recovery.getByRole('button', { name: 'Voltar para entrar' }).click();
  await expect(dialog).toBeVisible();
});

test('nova senha confirma antes de enviar, limpa token da URL e permite login depois', async ({ page }, testInfo) => {
  const requests = [];
  await mockApi(page, { extra: { '/api/auth/reset-password': route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  } } });
  await page.goto('/redefinir-senha#token=token-sintetico');
  await expect(page.getByRole('heading', { name: 'Defina sua nova senha' })).toBeVisible();
  await expect(page).toHaveURL(/\/redefinir-senha$/);
  await expect(page.locator('script[src*="plausible.io"]')).toHaveCount(0);
  await page.getByLabel('Nova senha', { exact: true }).fill('SenhaTeste123!');
  await page.getByLabel('Confirmar nova senha', { exact: true }).fill('OutraSenha123!');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByRole('alert')).toContainText('não coincidem');
  expect(requests).toHaveLength(0);
  await page.getByLabel('Confirmar nova senha', { exact: true }).fill('SenhaTeste123!');
  await page.screenshot({ path: testInfo.outputPath('nova-senha.png') });
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByRole('heading', { name: 'Senha alterada' })).toBeVisible();
  expect(requests).toEqual([{ token: 'token-sintetico', password: 'SenhaTeste123!', confirmPassword: 'SenhaTeste123!' }]);
  await page.getByRole('button', { name: 'Entrar com a nova senha' }).click();
  await expect(page.getByRole('dialog', { name: 'Entrar no studio' })).toBeVisible();
});

test('link expirado oferece nova recuperação, inclusive no celular', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page, { extra: { '/api/auth/reset-password': route => route.fulfill({ status: 400, json: { code: 'invalid_reset_link', error: 'Este link expirou ou já foi usado. Solicite um novo link.' } }) } });
  await page.goto('/redefinir-senha#token=expirado');
  await page.getByLabel('Nova senha', { exact: true }).fill('SenhaTeste123!');
  await page.getByLabel('Confirmar nova senha', { exact: true }).fill('SenhaTeste123!');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByRole('alert')).toContainText('expirou');
  await page.getByRole('button', { name: 'Solicitar novo link' }).click();
  await expect(page.getByRole('heading', { name: 'Recuperar minha senha' })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('recuperacao-mobile.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('indisponibilidade do serviço é mostrada, sem falsa mensagem de envio', async ({ page }) => {
  const dialog = await openLogin(page, { '/api/auth/forgot-password': route => route.fulfill({ status: 503, json: { error: 'A recuperação por e-mail está temporariamente indisponível.' } }) });
  await dialog.getByRole('button', { name: 'Esqueci minha senha' }).click();
  const recovery = page.getByRole('dialog', { name: 'Esqueci minha senha' });
  await recovery.getByLabel('E-mail').fill('pessoa@teste.exemplo');
  await recovery.getByRole('button', { name: 'Enviar link de recuperação' }).click();
  await expect(recovery.getByRole('alert')).toContainText('indisponível');
  // O status ilustrativo da landing não é uma confirmação de envio de e-mail.
  await expect(recovery.getByRole('status')).toHaveCount(0);
  await expect(recovery.getByRole('button', { name: 'Enviar link de recuperação' })).toBeEnabled();
});
