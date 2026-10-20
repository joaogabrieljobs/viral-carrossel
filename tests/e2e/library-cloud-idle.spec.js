import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

test('falha lenta do IndexedDB não repete atualizar da conta sem edição', async ({ page }) => {
  test.setTimeout(45_000);
  const requests = [];
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.context().route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol)
      ? route.continue() : route.abort('blockedbyclient');
  });
  await mockApi(page, {
    session: SESSAO_ATIVA,
    extra: {
      '/api/library-sync': (route) => {
        requests.push(route.request().postDataJSON()?.action);
        return route.fulfill({
          status: 503,
          json: { error: 'E2E: nuvem indisponível durante teste de idle.' },
        });
      },
    },
  });
  await page.addInitScript(({ owner }) => {
    const doc = {
      brand: { id: 'b1', name: 'Marca de teste' },
      fmt: 'feed',
      slides: [{ id: 's1', title: 'Texto preservado', bgImageId: 'foto-local', bgImage: null }],
      styleKit: { refImages: [] },
    };
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'p1', name: 'Projeto com foto', updatedAt: 1000, doc }]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('p1'));
    localStorage.setItem('vc_shell_view', JSON.stringify('home'));
    localStorage.setItem('vc_data_owner', JSON.stringify(owner));
    window.__imageReadFailures = 0;
    const originalOpen = indexedDB.open.bind(indexedDB);
    indexedDB.open = (name, ...args) => {
      if (name !== 'viral-carrossel-img') return originalOpen(name, ...args);
      const request = { error: new Error('E2E: falha transitória ao ler fotos') };
      setTimeout(() => {
        window.__imageReadFailures += 1;
        request.onerror?.();
      }, 6000);
      return request;
    };
  }, { owner: `email:${SESSAO_ATIVA.email}` });

  await page.goto('/?app=1');
  await expect(page.getByRole('button', { name: 'Abrir Projeto com foto', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__imageReadFailures), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  const savedBefore = await page.evaluate(() => localStorage.getItem('vc_library'));
  const requestsBefore = requests.length;
  expect(requestsBefore).toBeGreaterThan(0);
  // Janela maior que o debounce de sync (4s) e que outra leitura com falha
  // (6s): antes do fix, surgiam mais dois POSTs sem nenhuma interação.
  await page.waitForTimeout(10_500);
  expect(requests).toHaveLength(requestsBefore);
  const savedAfter = await page.evaluate(() => localStorage.getItem('vc_library'));
  expect(savedAfter).toBe(savedBefore);
  expect(JSON.parse(savedAfter)[0].doc.slides[0]).toMatchObject({
    title: 'Texto preservado', bgImageId: 'foto-local', bgImageFailed: true,
  });
  expect(runtimeErrors).toEqual([]);
});
