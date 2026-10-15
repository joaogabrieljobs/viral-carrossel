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
        return route.fulfill({ json: { url: '/?billing=success', sessionId: 'cs_e2e_compra' } });
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

  test('CA-04 logout: perfil → Sair da conta → sessão encerrada e dados locais limpos', async ({ page }) => {
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
    // Semeia dados de conta A — após logout não podem sobreviver (FE-001/003).
    await page.evaluate(() => {
      localStorage.setItem('vc_library', JSON.stringify([{ id: 'proj-a' }]));
      localStorage.setItem('vc_ai_keys', JSON.stringify({ openai: 'sk-secret' }));
      localStorage.setItem('vc_user_profile', JSON.stringify({ name: 'Alice' }));
    });

    // home shell → aba Perfil
    await page.getByRole('button', { name: /perfil/i }).first().click();
    const sair = page.getByRole('button', { name: /sair da conta/i });
    await expect(sair).toBeVisible({ timeout: 10_000 });
    // noWaitAfter: o handler faz window.location.assign('/') — esperar o clique
    // "assentar" numa página que já está navegando estoura sob CPU saturada.
    await sair.click({ noWaitAfter: true });

    // logout dispara e o gate volta (landing ou paywall — sem sessão)
    await expect.poll(() => logoutChamado, { timeout: 10_000 }).toBe(true);
    await expect.poll(async () => page.evaluate(async (email) => {
      const vault = await new Promise((resolve) => {
        const request = indexedDB.open('viral-carrossel-account-vault', 1);
        request.onerror = () => resolve(false);
        request.onsuccess = () => {
          const db = request.result;
          const entry = db.transaction('accounts', 'readonly').objectStore('accounts').get('vault');
          entry.onsuccess = () => {
            const hasOwner = Boolean(entry.result?.[`email:${email}`]);
            db.close();
            resolve(hasOwner);
          };
          entry.onerror = () => { db.close(); resolve(false); };
        };
      });
      return {
        library: localStorage.getItem('vc_library'),
        keys: localStorage.getItem('vc_ai_keys'),
        profile: localStorage.getItem('vc_user_profile'),
        vault,
      };
    }, SESSAO_ATIVA.email), { timeout: 10_000 }).toEqual({
      library: null,
      keys: null,
      profile: null,
      vault: true,
    });
  });

  test('CA-05 ?app=1 combinado com login=no_subscription não descarta o param', async ({ page }) => {
    await mockApi(page, { session: SESSAO_ANONIMA });
    // O portal Stripe volta com ?app=1; se vier junto um login=*, o handler
    // desse login precisa rodar (antes o return early engolia).
    await page.goto('/?app=1&login=no_subscription&email=sem%40teste.exemplo');

    // paywall abre COM o e-mail pré-preenchido (comportamento do handler)
    const email = page.locator('input[type="email"]').first();
    await expect(email).toBeVisible({ timeout: 10_000 });
    await expect(email).toHaveValue('sem@teste.exemplo');
  });

  test('contas duplicadas abrem login com orientação de recuperação', async ({ page }) => {
    await mockApi(page, { session: SESSAO_ANONIMA });
    await page.goto('/?app=1&login=account_conflict');
    await expect(page.getByRole('alert').filter({ hasText: 'Encontramos mais de uma conta com este e-mail' }))
      .toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: /continuar com google/i })).toBeVisible();
  });

  test('CA-06 conta existente pede login e senha inativa conduz ao plano', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/session') return route.fulfill({ json: SESSAO_ANONIMA });
      if (path === '/api/stripe/checkout') {
        return route.fulfill({ json: {
          requireLogin: true,
          message: 'Este e-mail já tem conta. Entre antes de escolher o plano.',
        } });
      }
      if (path === '/api/auth/login') {
        return route.fulfill({
          status: 402,
          headers: { 'Set-Cookie': 'vc_login_hint=dona%40teste.exemplo; Path=/; SameSite=Lax' },
          json: { needCheckout: true, email: 'dona@teste.exemplo', message: 'Renove o plano para entrar.' },
        });
      }
      return route.fulfill({ status: 404, json: { error: `não mockado: ${path}` } });
    });
    await page.goto('/?app=1');
    const paywallEmail = page.locator('input[type="email"]').first();
    await expect(paywallEmail).toBeVisible();
    await paywallEmail.fill('dona@teste.exemplo');
    await paywallEmail.press('Enter');
    await expect(page.getByText('Este e-mail já tem conta. Entre antes de escolher o plano.')).toBeVisible();

    await page.getByRole('button', { name: 'Entrar com senha' }).click();
    await expect(page.getByRole('dialog', { name: 'Entrar no studio' })).toBeVisible();
    await page.getByRole('dialog').locator('input[type="email"]').fill('dona@teste.exemplo');
    await page.getByRole('dialog').locator('input[type="password"]').fill('SenhaCorreta123!');
    await page.getByRole('dialog').locator('button[type="submit"]').click();
    await expect(page.getByRole('button', { name: 'Escolher plano' })).toBeVisible();
    await page.getByRole('button', { name: 'Escolher plano' }).click();
    await expect(page.locator('input[type="email"]').first()).toHaveValue('dona@teste.exemplo');
  });
});
