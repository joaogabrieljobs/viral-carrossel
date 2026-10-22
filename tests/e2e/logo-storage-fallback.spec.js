import { enterEditorFromHome } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const SOURCE = `data:image/png;base64,${PNG}`;

for (const failure of ['blocked', 'timeout']) {
  test(`logo PNG persiste e exporta com IndexedDB ${failure}`, async ({ page }) => {
    test.setTimeout(45_000);
    const runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    await page.context().route('**/*', (route) => {
      const url = new URL(route.request().url());
      return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol)
        ? route.continue() : route.abort('blockedbyclient');
    });
    await mockApi(page, {
      session: { ...SESSAO_ATIVA, tier: 'creator', imageQuota: { used: 0, limit: 50, remaining: 50 } },
      extra: {
        '/api/library-sync': (route) => route.fulfill({ status: 503, json: { error: 'E2E: nuvem offline.' } }),
      },
    });
    await page.addInitScript(({ owner, failure, source }) => {
      // A segunda navegação deve ler o documento gravado pela interação real.
      if (!localStorage.getItem('vc_library')) {
        localStorage.setItem('vc_library', JSON.stringify([{
          id: 'logo-project', name: 'Projeto da logo', updatedAt: 1000,
          doc: { brand: { id: 'b1', name: 'Marca de teste' }, fmt: 'feed',
            slides: [{ id: 's1', title: 'Minha marca' }],
            styleKit: { refImages: [], logo: { dataUrl: source, name: 'Logo do projeto' } } },
        }]));
        localStorage.setItem('vc_active_doc_id', JSON.stringify('logo-project'));
        localStorage.setItem('vc_shell_view', JSON.stringify('home'));
        localStorage.setItem('vc_data_owner', JSON.stringify(owner));
      }
      const originalOpen = indexedDB.open.bind(indexedDB);
      indexedDB.open = (name, ...args) => {
        if (name !== 'viral-carrossel-img') return originalOpen(name, ...args);
        const request = {};
        if (failure === 'blocked') setTimeout(() => request.onblocked?.(), 0);
        return request;
      };
    }, { owner: `email:${SESSAO_ATIVA.email}`, failure, source: SOURCE });
    await page.goto('/?app=1');
    await enterEditorFromHome(page);
    await page.getByRole('tab', { name: /^Marca$/ }).first().click();
    const logoSection = page.locator('details').filter({ has:page.locator('summary').filter({ hasText:'Logo nos cards' }) });
    if (await logoSection.getAttribute('open') === null) await logoSection.locator('summary').click();
    await page.getByLabel('Arquivo PNG da logo deste card', { exact: true }).setInputFiles({
      name: 'marca-transparente.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64'),
    });
    await expect(page.getByRole('img', { name: 'Logo deste card', exact: true })).toHaveAttribute('src', SOURCE, { timeout: 15_000 });
    await expect.poll(async () => page.evaluate(() => {
      const doc = JSON.parse(localStorage.getItem('vc_library') || '[]').find((entry) => entry.id === 'logo-project')?.doc;
      return { source: doc?.slides[0]?.logoImage, id: doc?.slides[0]?.logoImageId };
    })).toEqual({ source: SOURCE, id: null });

    await page.reload();
    await enterEditorFromHome(page);
    await page.getByRole('tab', { name: /^Marca$/ }).first().click();
    if (await logoSection.getAttribute('open') === null) await logoSection.locator('summary').click();
    await expect(page.getByRole('img', { name: 'Logo deste card', exact: true })).toHaveAttribute('src', SOURCE);
    await page.getByRole('button', { name: 'Abrir biblioteca de projetos salvos', exact: true }).click();
    const downloadReady = page.waitForEvent('download');
    await page.getByTitle('Exportar toda a biblioteca como JSON', { exact: true }).click();
    const download = await downloadReady;
    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    const backup = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    expect(backup.docs.find((entry) => entry.id === 'logo-project').doc.slides[0])
      .toMatchObject({ logoImage: SOURCE, logoImageId: null });
    expect(backup.docs.find((entry) => entry.id === 'logo-project').doc.styleKit.logo)
      .toEqual({ dataUrl: SOURCE, name: 'Logo do projeto' });
    expect(runtimeErrors).toEqual([]);
  });
}
