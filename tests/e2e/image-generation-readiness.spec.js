import { enterEditorFromHome } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const DIRECTION = 'Um produto em uma bancada azul com luz lateral suave.';
const QUOTA = { status: 'available', available: true, used: 0, limit: 50, remaining: 50 };

async function openImageProject(page, { quota = QUOTA, slide = {}, storedReference = null } = {}) {
  const requests = [];
  await page.context().route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol)
      ? route.continue() : route.abort('blockedbyclient');
  });
  await mockApi(page, {
    session: { ...SESSAO_ATIVA, tier: 'creator', imageQuota: quota },
    extra: {
      '/api/library-sync': (route) => route.fulfill({ status: 503, json: { error: 'E2E: nuvem simulada offline.' } }),
      '/api/ai/sjinn-image': (route) => {
        requests.push(route.request().postDataJSON());
        return route.fulfill({ json: { b64_json: PNG, mime: 'image/png', quota: { ...QUOTA, used: 1, remaining: 49 } } });
      },
    },
  });
  await page.addInitScript(({ slide, owner, storedReference }) => {
    if (sessionStorage.getItem('reference-test-seeded')) return;
    sessionStorage.setItem('reference-test-seeded', '1');
    const doc = {
      brand: { id: 'b1', name: 'Marca de teste' }, fmt: 'feed',
      slides: [{ id: 's1', title: 'Um produto com personalidade', subtitle: 'Imagem feita a partir da direção.', imageQuery: '', ...slide }],
      styleKit: { refImages: [] },
    };
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'p1', name: 'Teste de imagem', updatedAt: 1000, doc }]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('p1'));
    localStorage.setItem('vc_data_owner', JSON.stringify(owner));
    localStorage.setItem('vc_shell_view', JSON.stringify('home'));
    if (storedReference) {
      window.__referenceSeed = new Promise((resolve, reject) => {
        const open = indexedDB.open('viral-carrossel-img', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('images', { keyPath: 'id' });
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const binary = atob(storedReference.base64);
          const blob = new Blob([Uint8Array.from(binary, c => c.charCodeAt(0))], { type: 'image/png' });
          const transaction = db.transaction('images', 'readwrite');
          transaction.objectStore('images').put({ id: storedReference.id, blob, size: blob.size, mime: blob.type, savedAt: Date.now() });
          transaction.oncomplete = () => { db.close(); resolve(); };
          transaction.onabort = () => { db.close(); reject(transaction.error); };
        };
      });
    }
  }, { slide, owner: `email:${SESSAO_ATIVA.email}`, storedReference });
  await page.goto('/?app=1');
  if (storedReference) await page.evaluate(() => window.__referenceSeed);
  await enterEditorFromHome(page, 'Teste de imagem');
  return requests;
}

for (const mobile of [false, true]) {
  test(`referência + direção sem imageQuery envia instrução e referência (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const requests = await openImageProject(page, { slide: { refImage: `data:image/png;base64,${PNG}`, imgExtraPrompt: DIRECTION } });
    const button = page.getByRole('button', { name: 'Gerar imagem', exact: true }).first();
    await expect(button).toBeEnabled();
    await button.click();
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0].prompt).toContain(DIRECTION);
    expect(requests[0].prompt.split(DIRECTION)).toHaveLength(2);
    expect(requests[0].imageList).toHaveLength(1);
    // A API está totalmente simulada: nenhum serviço de imagem ou quota real é chamado.
    await expect(page.getByRole('button', { name: 'Regenerar imagem', exact: true }).first()).toBeEnabled();
  });
}

test('direção visível habilita o botão sem exigir palavras-chave em outro painel', async ({ page }) => {
  const requests = await openImageProject(page);
  const generate = page.getByRole('button', { name: 'Gerar imagem', exact: true }).first();
  await expect(generate).toBeDisabled();
  await expect(page.getByRole('status').filter({ hasText: 'Abra Direção e descreva' }).first()).toBeVisible();
  await page.getByRole('button', { name: /^Direção$/ }).first().click();
  await page.getByLabel('Direção da imagem (este card)', { exact: true }).fill(DIRECTION);
  await expect(generate).toBeEnabled();
  expect(requests).toHaveLength(0);
});

test('miniatura e geração usam referência do IndexedDB sem embutir foto na biblioteca', async ({ page }) => {
  const requests = await openImageProject(page, {
    slide: { refImageId: 'ref_stored', refImage: null, imgExtraPrompt: DIRECTION },
    storedReference: { id: 'ref_stored', base64: PNG },
  });
  const preview = page.getByRole('button', { name: 'Adicionar imagem de referência', exact: true }).first().locator('img');
  await expect(preview).toHaveAttribute('src', `data:image/png;base64,${PNG}`);
  await page.getByRole('button', { name: 'Gerar imagem', exact: true }).first().click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].imageList).toEqual([`data:image/png;base64,${PNG}`]);
  await expect(page.getByRole('button', { name: 'Regenerar imagem', exact: true }).first()).toBeEnabled();
  await page.reload();
  await enterEditorFromHome(page);
  await expect(preview).toHaveAttribute('src', `data:image/png;base64,${PNG}`);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library'))[0].doc.slides[0]);
  expect(stored.refImageId).toBe('ref_stored');
  expect(stored.refImage).toBeFalsy();
});

test('miniatura ausente explica a referência faltante e impede geração sem a referência', async ({ page }) => {
  const requests = await openImageProject(page, { slide: { refImageId: 'ref_missing', imgExtraPrompt: DIRECTION } });
  await expect(page.getByRole('status').filter({ hasText: 'Reenvie a referência deste card' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gerar imagem', exact: true }).first()).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Remover referência', exact: true }).first()).toBeVisible();
  expect(requests).toHaveLength(0);
});

test('upload de referência grande preserva bytes originais no IndexedDB e fica leve após reload', async ({ page }) => {
  const requests = await openImageProject(page, { slide: { imgExtraPrompt: DIRECTION } });
  // PNG válido com dados após IEND: mantém a imagem decodificável e reproduz
  // uma foto grande sem depender de serviços, downloads ou geração de imagens.
  const original = Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.alloc(1_800_000, 37)]);
  const expectedHash = createHash('sha256').update(original).digest('hex');
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Adicionar imagem de referência', exact: true }).first().click();
  await (await choosing).setFiles({ name: 'referencia-grande.png', mimeType: 'image/png', buffer: original });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library'))[0].doc.slides[0].refImageId)).toBeTruthy();
  const saved = await page.evaluate(async () => {
    const raw = localStorage.getItem('vc_library');
    const slide = JSON.parse(raw)[0].doc.slides[0];
    const entry = await new Promise((resolve, reject) => {
      const open = indexedDB.open('viral-carrossel-img', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const request = db.transaction('images', 'readonly').objectStore('images').get(slide.refImageId);
        request.onsuccess = () => { db.close(); resolve(request.result); };
        request.onerror = () => { db.close(); reject(request.error); };
      };
    });
    const hash = await crypto.subtle.digest('SHA-256', await entry.blob.arrayBuffer());
    return { slide, libraryLength: raw.length, size: entry.blob.size, hash: [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('') };
  });
  expect(saved.slide.refImage).toBeFalsy();
  expect(saved.libraryLength).toBeLessThan(200_000);
  expect(saved.size).toBe(original.length);
  expect(saved.hash).toBe(expectedHash);
  const preview = page.getByRole('button', { name: 'Adicionar imagem de referência', exact: true }).first().locator('img');
  await expect.poll(() => preview.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.reload();
  await enterEditorFromHome(page);
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library'))[0].doc.slides[0]);
  expect(after.refImageId).toBe(saved.slide.refImageId);
  expect(after.refImage).toBeFalsy();
  expect(requests).toHaveLength(0);
});

test('saldo indisponível não aparece como quota esgotada nem IA pronta para imagem', async ({ page }) => {
  const requests = await openImageProject(page, {
    quota: { ...QUOTA, available: false, status: 'unavailable', used: null, remaining: null },
    slide: { imgExtraPrompt: DIRECTION },
  });
  await expect(page.getByRole('button', { name: 'Gerar imagem', exact: true }).first()).toBeDisabled();
  await expect(page.getByRole('status').filter({ hasText: 'Não foi possível consultar seu saldo de imagens' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Configurar IA', exact: true }).first()).toHaveAttribute('title', /Texto pronto.*Não foi possível consultar/);
  await expect(page.getByText('Você usou todas as imagens deste ciclo.', { exact: false })).toHaveCount(0);
  expect(requests).toHaveLength(0);
});
