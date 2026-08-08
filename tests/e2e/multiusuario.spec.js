// Task 10 — RF-11 (DEC-004): 5 "pessoas" (browser contexts isolados) comprando
// e entrando ao mesmo tempo. Cada context tem seu próprio estado de sessão
// mockado (closure) — como 5 máquinas diferentes contra o mesmo app.
import { test, expect } from '@playwright/test';

const N = 5;
const users = Array.from({ length: N }, (_, i) => ({
  email: `pessoa${i + 1}@teste.exemplo`,
  customerId: `cus_ctx_${i + 1}`,
  sessionId: `cs_ctx_${i + 1}`,
}));

test.describe('Multiusuário visual (RF-11)', () => {
  test(`${N} contexts paralelos: cada um compra e vê a própria conta`, async ({ browser }) => {
    test.setTimeout(120_000);

    const jornada = async (u) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      let sessao = { active: false, email: null, status: 'anonymous' };

      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/auth/session') return route.fulfill({ json: sessao });
        if (path === '/api/stripe/checkout') {
          return route.fulfill({ json: { url: `/?billing=success&session_id=${u.sessionId}`, sessionId: u.sessionId } });
        }
        if (path === '/api/stripe/confirm') {
          sessao = {
            active: true,
            email: u.email,
            customerId: u.customerId,
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          };
          return route.fulfill({ json: { active: true, email: u.email, customerId: u.customerId } });
        }
        return route.fulfill({ status: 404, json: { error: `não mockado: ${path}` } });
      });

      // compra
      await page.goto('/?app=1');
      const email = page.locator('input[type="email"]').first();
      await expect(email).toBeVisible({ timeout: 20_000 });
      await email.fill(u.email);
      await email.press('Enter');

      // entrou no studio
      await expect(page.locator('input[type="email"]')).toHaveCount(0, { timeout: 20_000 });

      // perfil mostra o PRÓPRIO e-mail
      await page.getByRole('button', { name: /perfil/i }).first().click({ force: true });
      await expect(page.getByText(u.email).first()).toBeVisible({ timeout: 15_000 });

      // varredura: nenhum e-mail de OUTRO usuário aparece no DOM
      const dom = await page.content();
      for (const other of users) {
        if (other.email !== u.email) expect(dom).not.toContain(other.email);
      }

      await context.close();
      return u.email;
    };

    const done = await Promise.all(users.map(jornada));
    expect(done.sort()).toEqual(users.map((u) => u.email).sort());
  });
});
