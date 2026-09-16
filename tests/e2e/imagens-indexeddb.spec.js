// As imagens viviam como data URL dentro do documento, e o documento no
// localStorage (~5 MB). Ao encher, o código apagava as imagens para conseguir
// gravar — perda real. Agora os bytes ficam no IndexedDB e o documento guarda o id.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

async function abrirEditor(page) {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  const continuar = page.getByRole('button', { name: /continuar no editor/i });
  await expect(continuar).toBeVisible({ timeout: 10_000 });
  await continuar.click({ force: true });
  await page.waitForTimeout(600);
  // A camada de toque da zona da foto só existe quando há card com zona de foto.
  await page.route('https://api.openai.com/**', (r) => r.fulfill({ status: 401, json: { error: { message: 'e2e' } } }));
  await page.getByRole('button', { name: /abrir templates/i }).click({ force: true });
  await expect(page.locator('.modal-panel')).toBeVisible({ timeout: 10_000 });
  await page.locator('.modal-panel').getByRole('button').filter({ hasText: 'Erro Comum' }).first().click({ force: true });
  await expect(page.locator('[data-vc-tour="thumbnails"]')).toBeAttached({ timeout: 10_000 });
  await page.waitForTimeout(1000);
}

/** Sobe uma imagem pelo input da zona da foto (caminho real do utilizador). */
async function subirFoto(page) {
  const input = page.locator('input[type="file"].vc-photo-hit').first();
  await input.setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(PNG_1x1, 'base64') });
  await page.waitForTimeout(1200);
}

const estadoGravado = (page) => page.evaluate(() => {
  const lib = JSON.parse(localStorage.getItem('vc_library') || '[]');
  const doc = lib[0]?.doc || {};
  const s = (doc.slides || [])[0] || {};
  return {
    temId: !!s.bgImageId,
    bgImageGravado: typeof s.bgImage === 'string' ? s.bgImage.slice(0, 5) : null,
    tamanhoLocalStorage: (localStorage.getItem('vc_library') || '').length,
  };
});

const idsNoIndexedDB = (page) => page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('viral-carrossel-img', 1);
  req.onsuccess = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('images')) { resolve([]); return; }
    const r = db.transaction('images', 'readonly').objectStore('images').getAllKeys();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => resolve([]);
  };
  req.onerror = () => resolve([]);
}));

test.describe('Imagens no IndexedDB', () => {
  test('a foto vai para o IndexedDB e o documento guarda apenas o id', async ({ page }) => {
    test.setTimeout(90_000);
    await abrirEditor(page);
    await subirFoto(page);

    const ids = await idsNoIndexedDB(page);
    expect(ids.length, 'a imagem deveria estar no IndexedDB').toBeGreaterThan(0);

    const gravado = await estadoGravado(page);
    expect(gravado.temId, 'o slide deveria referenciar bgImageId').toBe(true);
    expect(gravado.bgImageGravado, 'bytes não podem ficar no localStorage').not.toBe('data:');
    expect(gravado.bgImageGravado, 'object URL não sobrevive ao reload; não deve ser gravado').not.toBe('blob:');
  });

  test('a foto reaparece depois do reload', async ({ page }) => {
    test.setTimeout(90_000);
    await abrirEditor(page);
    await subirFoto(page);
    const idsAntes = await idsNoIndexedDB(page);

    await page.reload();
    await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true, timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1800);

    expect(await idsNoIndexedDB(page)).toEqual(idsAntes);
    const hidratado = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('div')].filter((e) => e.style.width === '1080px');
      return cards.some((c) => [...c.querySelectorAll('div')].some((d) => (d.style.backgroundImage || '').includes('blob:')));
    });
    expect(hidratado, 'o card deveria voltar a mostrar a foto vinda do IndexedDB').toBe(true);
  });
});
