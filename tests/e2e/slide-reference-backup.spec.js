import { enterEditorFromHome } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const SOURCE = `data:image/png;base64,${PNG}`;
const readLibrary = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]'));

test('referência de card sai do cache, permanece portátil no backup e volta com ID independente', async ({ page }) => {
  test.setTimeout(60_000);
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.context().route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol)
      ? route.continue() : route.abort('blockedbyclient');
  });
  await mockApi(page, { session: { ...SESSAO_ATIVA, tier: 'creator', imageQuota: {
    status: 'available', available: true, used: 0, limit: 50, remaining: 50,
  } }, extra: {
    '/api/library-sync': (route) => route.fulfill({ status: 503, json: { error: 'E2E: nuvem offline.' } }),
  } });
  await page.addInitScript(({ owner, source }) => {
    if (localStorage.getItem('vc_library')) return;
    localStorage.setItem('vc_library', JSON.stringify([{
      id: 'ref-project', name: 'Projeto com referência', updatedAt: 1000,
      doc: {
        brand: { id: 'b1', name: 'Marca de teste' }, fmt: 'feed', styleKit: { refImages: [] },
        slides: [{ id: 's1', title: 'A direção escolhida', refImage: source, imgExtraPrompt: 'Preserve o enquadramento.' }],
      },
    }]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('ref-project'));
    localStorage.setItem('vc_data_owner', JSON.stringify(owner));
    localStorage.setItem('vc_shell_view', JSON.stringify('home'));
  }, { owner: `email:${SESSAO_ATIVA.email}`, source: SOURCE });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await expect.poll(async () => (await readLibrary(page)).find((entry) => entry.id === 'ref-project')?.doc.slides[0].refImageId).toBeTruthy();
  const original = (await readLibrary(page)).find((entry) => entry.id === 'ref-project').doc.slides[0];
  expect(original.refImage).toBeFalsy();
  await page.getByRole('button', { name: 'Abrir biblioteca de projetos salvos', exact: true }).click();
  const downloadReady = page.waitForEvent('download');
  await page.getByTitle('Exportar toda a biblioteca como JSON', { exact: true }).click();
  const download = await downloadReady;
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const backedUp = backup.docs.find((entry) => entry.id === 'ref-project').doc.slides[0];
  expect(backedUp.refImage).toBe(SOURCE);
  expect(backedUp.refImageId).toBeUndefined();
  expect(backedUp.refImageAssetId).toBeUndefined();
  await page.locator('input[accept=".json,application/json"]').setInputFiles({
    name: 'referencia-portatil.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect.poll(async () => (await readLibrary(page)).length).toBe(2);
  const imported = (await readLibrary(page)).find((entry) => entry.id !== 'ref-project').doc.slides[0];
  expect(imported.refImageId).toBeTruthy();
  expect(imported.refImageId).not.toBe(original.refImageId);
  expect(imported.refImage).toBeFalsy();
  expect(imported.imgExtraPrompt).toBe('Preserve o enquadramento.');
  await page.reload();
  await enterEditorFromHome(page);
  const afterReload = (await readLibrary(page)).find((entry) => entry.id !== 'ref-project').doc.slides[0];
  expect(afterReload.refImageId).toBe(imported.refImageId);
  expect(afterReload.refImage).toBeFalsy();
  expect(runtimeErrors).toEqual([]);
});
