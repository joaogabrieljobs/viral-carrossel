// Task 08 — RF-07 (jornada de compra), RF-15: 4 jornadas de billing no build real.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ANONIMA, SESSAO_ATIVA } from './helpers/api-mock.js';

test.describe('Jornadas de billing', () => {
  test('CA-01 comprar: paywall → e-mail → volta do Stripe → studio', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('vc_onboarding_done', '1');
        localStorage.setItem('vc_modes_intro_done', '1');
      } catch { /* storage bloqueado */ }
    });
    let confirmChamado = false;
    let sessaoAtual = SESSAO_ANONIMA;
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/session') return route.fulfill({ json: sessaoAtual });
      if (path === '/api/stripe/checkout') {
        // simula volta do Stripe com URL same-origin
        return route.fulfill({ json: { url: '/?billing=success&session_id=cs_e2e_compra', sessionId: 'cs_e2e_compra' } });
      }
      if (path === '/api/stripe/confirm') {
        confirmChamado = true;
        sessaoAtual = SESSAO_ATIVA; // cookie emitido — próximas sessions são ativas
        return route.fulfill({ json: { active: true, email: SESSAO_ATIVA.email, customerId: SESSAO_ATIVA.customerId } });
      }
      return route.fulfill({ status: 404, json: { error: `não mockado: ${path}` } });
    });

    await page.goto('/?app=1');
    const email = page.locator('input[type="email"]').first();
    await expect(email).toBeVisible({ timeout: 10_000 });
    await email.fill('comprador@teste.exemplo');
    await email.press('Enter');

    // volta do checkout → confirm → studio (paywall some)
    await expect.poll(() => confirmChamado, { timeout: 15_000 }).toBe(true);
    await expect(page.locator('input[type="email"]')).toHaveCount(0, { timeout: 15_000 });
    // studio: home shell com CTA de gerar
    await expect(page.getByText(/Gerar|Criar/i).first()).toBeVisible();
  });

  test('CA-02 restaurar: ?billing=restored com sessão ativa entra direto', async ({ page }) => {
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.goto('/?billing=restored&login=google');
    await expect(page.locator('input[type="email"]')).toHaveCount(0, { timeout: 10_000 });
    // params de billing limpos da URL (fix da auditoria de navegação)
    await expect.poll(() => page.url()).not.toContain('billing=');
  });

  test('CA-03 negar: ?billing=cancel anônimo → paywall e URL limpa', async ({ page }) => {
    await mockApi(page, { session: SESSAO_ANONIMA });
    await page.goto('/?billing=cancel');
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => page.url()).not.toContain('billing=');
  });

  test('CA-04 logout: perfil → Sair da conta → sessão encerrada', async ({ page }) => {
    let logoutChamado = false;
    let sessaoAtual = SESSAO_ATIVA;
    await mockApi(page, {
      get session() { return sessaoAtual; },
      extra: {
        '/api/auth/logout': (route) => {
          logoutChamado = true;
          sessaoAtual = SESSAO_ANONIMA;
          return route.fulfill({ json: { ok: true } });
        },
        '/api/auth/session': (route) => route.fulfill({ json: sessaoAtual }),
      },
    });

    await page.goto('/?app=1');
    // home shell → aba Perfil
    await page.getByRole('button', { name: /perfil/i }).first().click();
    const sair = page.getByRole('button', { name: /sair da conta/i });
    await expect(sair).toBeVisible({ timeout: 10_000 });
    // noWaitAfter: o handler faz window.location.assign('/') — esperar o clique
    // "assentar" numa página que já está navegando estoura sob CPU saturada.
    await sair.click({ noWaitAfter: true });

    // logout dispara e o gate volta (landing ou paywall — sem sessão)
    await expect.poll(() => logoutChamado, { timeout: 10_000 }).toBe(true);
  });
});
