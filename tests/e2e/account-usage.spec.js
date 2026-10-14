import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

async function setup(page, { unavailable = false } = {}) {
  const state = { used: 12, failed: unavailable, reads: 0 };
  let manifest = null;
  await page.context().route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol)
      ? route.continue() : route.abort('blockedbyclient');
  });
  await mockApi(page, { extra: {
    '/api/auth/session': (route) => {
      state.reads += 1;
      return route.fulfill({ json: {
        ...SESSAO_ATIVA, tier: 'creator', plan: { id: 'creator', name: 'Criador' },
        currentPeriodStart: '2026-10-01T12:00:00.000Z',
        currentPeriodEnd: '2026-11-01T12:00:00.000Z',
        imageQuota: state.failed
          ? { status: 'unavailable', available: false, used: null, remaining: null, limit: 50, tier: 'creator' }
          : { status: 'available', available: true, used: state.used, remaining: 50 - state.used, limit: 50, tier: 'creator' },
      } });
    },
    '/api/library-sync': (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const body = request.method() === 'POST' ? request.postDataJSON() : {};
      if (body.action === 'push') manifest = { ...body.manifest, revision: 1, updatedAt: Date.now() };
      if (url.searchParams.get('full') === '1') return route.fulfill({ json: { ok: true, manifest } });
      const meta = manifest && { revision: 1, updatedAt: manifest.updatedAt, projectCount: manifest.docs.length, assetIds: [] };
      return route.fulfill({ json: { ok: true, empty: !manifest, meta, ...meta } });
    },
  } });
  await page.addInitScript((owner) => {
    localStorage.setItem('vc_data_owner', JSON.stringify(owner));
    localStorage.setItem('vc_shell_view', JSON.stringify('home'));
    localStorage.setItem('vc_library', JSON.stringify([{
      id: 'usage-project', name: 'Projeto preservado', doc: {
        brand: { name: 'Marca' }, fmt: 'feed', slides: [{ id: 'slide-1', title: 'Conteúdo de teste' }],
      },
    }]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('usage-project'));
  }, `email:${SESSAO_ATIVA.email}`);
  await page.goto('/?app=1');
  await page.getByRole('button', { name: 'Uso', exact: true }).click();
  await expect.poll(() => state.reads).toBeGreaterThanOrEqual(2);
  return state;
}

test('Uso mostra consumo real do ciclo e atualiza saldo sem sair da conta', async ({ page }) => {
  const state = await setup(page);
  await expect(page.getByRole('heading', { name: 'Uso de imagens' })).toBeVisible();
  const progress = page.getByRole('progressbar');
  await expect(progress).toHaveAttribute('aria-valuenow', '12');
  await expect(progress).toHaveAttribute('aria-valuemax', '50');
  await expect(page.getByText('38', { exact: true })).toBeVisible();
  await expect(page.getByText(/nov.*2026/).first()).toBeVisible();

  state.used = 13;
  await page.getByRole('button', { name: 'Atualizar uso', exact: true }).click();
  await expect(progress).toHaveAttribute('aria-valuenow', '13');
  await expect(page.getByText('37', { exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/moont-uso-desktop.png', fullPage: true });

  state.failed = true;
  await page.getByRole('button', { name: 'Atualizar uso', exact: true }).click();
  await expect(page.getByText('Uso indisponível', { exact: true })).toBeVisible();
  await expect(progress).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Perfil', exact: true })).toBeVisible();
  await expect(page.getByText('0', { exact: true })).toHaveCount(0);
});

test('Uso cabe no celular e não trata limite ausente como consumido', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { unavailable: true });
  await expect(page.getByRole('heading', { name: 'Uso de imagens' })).toBeVisible();
  await expect(page.getByText('Uso indisponível', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: '/tmp/moont-uso-mobile.png', fullPage: true });
});
