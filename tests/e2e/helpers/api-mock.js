/** Intercepta TODO /api/* — vite preview não serve funções serverless, e
 *  nenhum teste E2E pode tocar rede real (RNF-02). Qualquer endpoint não
 *  previsto responde 404 explícito (aparece no teste, não trava). */

export const SESSAO_ANONIMA = { active: false, email: null, status: 'anonymous' };
export const SESSAO_ATIVA = {
  active: true,
  email: 'assinante@teste.exemplo',
  customerId: 'cus_e2e_1',
  status: 'active',
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
};

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ session?: object, checkout?: object, confirm?: object, extra?: Record<string, (route) => any> }} opts
 */
export async function mockApi(page, opts = {}) {
  const session = opts.session ?? SESSAO_ANONIMA;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (opts.extra) {
      for (const [prefix, handler] of Object.entries(opts.extra)) {
        if (path.startsWith(prefix)) return handler(route);
      }
    }

    if (path === '/api/auth/session') {
      return route.fulfill({ json: session });
    }
    if (path === '/api/stripe/checkout') {
      return route.fulfill({ json: opts.checkout ?? { url: 'https://checkout.stripe.com/c/pay/cs_e2e', sessionId: 'cs_e2e' } });
    }
    if (path === '/api/stripe/confirm') {
      return route.fulfill({ json: opts.confirm ?? { active: true, email: SESSAO_ATIVA.email, customerId: SESSAO_ATIVA.customerId } });
    }
    if (path === '/api/auth/logout') {
      return route.fulfill({ json: { ok: true } });
    }
    if (path === '/api/status') {
      return route.fulfill({ json: { anthropic: true, openai: true, dev: false } });
    }
    return route.fulfill({ status: 404, json: { error: `E2E: endpoint não mockado: ${path}` } });
  });
}
