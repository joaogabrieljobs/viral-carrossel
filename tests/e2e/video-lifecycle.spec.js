import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome, selectEditorMode } from './helpers/project-entry.js';

async function openVideoEditor(page) {
  await page.setViewportSize({ width: 1440, height: 960 });
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(() => {
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    if (localStorage.getItem('vc_active_doc_id') === null) {
      localStorage.setItem('vc_active_doc_id', JSON.stringify('video-project'));
    }
    if (localStorage.getItem('vc_library') === null) {
      localStorage.setItem('vc_library', JSON.stringify([{
        id: 'video-project',
        name: 'Projeto com vídeo',
        doc: {
          fmt: 'carrossel',
          slides: [{
            id: 'video-slide-1',
            num: 1,
            title: 'Card com vídeo',
            subtitle: 'O arquivo precisa sobreviver a cópias e ao Desfazer.',
            layout: 'mc',
            photoRegion: 'sandwich',
          }],
        },
      }]));
    }
  });
  await page.goto('/?app=1');
  await enterEditorFromHome(page, 'Projeto com vídeo');
  await expect(page.locator('#vc-cards-viewport')).toBeVisible();
  await selectEditorMode(page, 'studio');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('vc_data_owner'))).toBeTruthy();
}

async function storedDoc(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]')
    .find((entry) => entry.id === 'video-project')?.doc);
}

async function importVideo(page, name, marker, { slideIndex = 0, previousId = '' } = {}) {
  await page.getByRole('tab', { name: 'Imagem', exact: true }).click();
  const input = page.locator('input[type="file"][accept="video/*"]');
  await expect(input).toBeAttached();
  await input.setInputFiles({
    name,
    mimeType: 'video/mp4',
    buffer: Buffer.from([0, 0, 0, marker]),
  });
  await expect.poll(async () => {
    const doc = await storedDoc(page);
    return doc?.slides?.[slideIndex]?.videoId || '';
  }).not.toBe(previousId);
}

async function videoExists(page, id) {
  return page.evaluate((videoId) => new Promise((resolve, reject) => {
    const request = indexedDB.open('viral-carrossel', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('videos', 'readonly').objectStore('videos').get(videoId);
      get.onerror = () => reject(get.error);
      get.onsuccess = () => resolve(Boolean(get.result?.blob));
    };
  }), id);
}

async function ageVideoForCleanup(page, id) {
  return page.evaluate((videoId) => new Promise((resolve, reject) => {
    const request = indexedDB.open('viral-carrossel', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('videos', 'readwrite');
      const store = transaction.objectStore('videos');
      const get = store.get(videoId);
      get.onerror = () => reject(get.error);
      get.onsuccess = () => {
        if (!get.result) { resolve(); return; }
        store.put({ ...get.result, savedAt: Date.now() - (25 * 60 * 60_000) });
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
  }), id);
}

async function duplicateActiveSlide(page) {
  await page.getByRole('tab', { name: 'Layout', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicar', exact: true }).click();
  await expect.poll(async () => (await storedDoc(page))?.slides?.length).toBe(2);
}

test('remover vídeo da cópia preserva o original e Desfazer restaura a cópia', async ({ page }) => {
  await openVideoEditor(page);
  await importVideo(page, 'original.mp4', 1);
  const originalId = (await storedDoc(page)).slides[0].videoId;

  await duplicateActiveSlide(page);
  await expect.poll(async () => (await storedDoc(page)).slides.map((slide) => slide.videoId)).toEqual([
    originalId,
    originalId,
  ]);

  await page.getByRole('tab', { name: 'Imagem', exact: true }).click();
  await page.getByRole('button', { name: /^Remover vídeo do card/ }).click();
  await expect.poll(async () => (await storedDoc(page)).slides.map((slide) => slide.videoId || null)).toEqual([
    originalId,
    null,
  ]);
  expect(await videoExists(page, originalId)).toBe(true);

  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await storedDoc(page)).slides.map((slide) => slide.videoId || null)).toEqual([
    originalId,
    originalId,
  ]);
  expect(await videoExists(page, originalId)).toBe(true);
});

test('substituir vídeo da cópia não remove o arquivo usado pelo original', async ({ page }) => {
  await openVideoEditor(page);
  await importVideo(page, 'original.mp4', 1);
  const originalId = (await storedDoc(page)).slides[0].videoId;

  await duplicateActiveSlide(page);
  await importVideo(page, 'substituto.mp4', 2, { slideIndex: 1, previousId: originalId });
  await expect.poll(async () => (await storedDoc(page)).slides[0].videoId).toBe(originalId);

  const updated = await storedDoc(page);
  const replacementId = updated.slides[1].videoId;
  expect(replacementId).toBeTruthy();
  expect(replacementId).not.toBe(originalId);
  expect(await videoExists(page, originalId)).toBe(true);
  expect(await videoExists(page, replacementId)).toBe(true);
});

test('excluir card após o boot não deixa o GC apagar um vídeo ainda alcançável por Desfazer', async ({ page }) => {
  test.setTimeout(60_000);
  await openVideoEditor(page);
  await importVideo(page, 'original.mp4', 4);
  const originalId = (await storedDoc(page)).slides[0].videoId;
  await duplicateActiveSlide(page);
  await importVideo(page, 'exclusivo-da-copia.mp4', 5, { slideIndex: 1, previousId: originalId });
  const copiedVideoId = (await storedDoc(page)).slides[1].videoId;

  // Novo boot: os dois IDs passam a fazer parte do snapshot protegido da
  // sessão. Excluir o card em seguida não pode transformar o vídeo em lixo.
  await page.reload();
  await enterEditorFromHome(page, 'Projeto com vídeo');
  await expect.poll(async () => (await storedDoc(page))?.slides?.length).toBe(2);
  await page.getByRole('button', { name: /^Card 2 de 2/ }).click({ force: true });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Excluir card 2', exact: true }).first().click();
  await expect.poll(async () => (await storedDoc(page))?.slides?.length).toBe(1);

  await page.waitForTimeout(9_500);
  expect(await videoExists(page, copiedVideoId)).toBe(true);

  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await storedDoc(page))?.slides?.map((slide) => slide.videoId)).toContain(copiedVideoId);
  expect(await videoExists(page, copiedVideoId)).toBe(true);
});

test('vídeo removido fica disponível para Desfazer na sessão e vira órfão limpável no próximo boot', async ({ page }) => {
  test.setTimeout(45_000);
  await openVideoEditor(page);
  await importVideo(page, 'temporario.mp4', 3);
  const removedId = (await storedDoc(page)).slides[0].videoId;

  await page.getByRole('tab', { name: 'Imagem', exact: true }).click();
  await page.getByRole('button', { name: /^Remover vídeo do card/ }).click();
  await expect.poll(async () => (await storedDoc(page)).slides[0].videoId || null).toBeNull();
  expect(await videoExists(page, removedId)).toBe(true);

  // A produção conserva órfãos recentes por 24 h para proteger abas
  // suspensas. Envelheça somente o fixture para provar o GC no próximo boot.
  await ageVideoForCleanup(page, removedId);

  // O reload encerra o histórico de Desfazer. Depois de restaurar a biblioteca,
  // o GC pode remover com segurança o Blob que nenhum projeto referencia.
  await page.reload();
  if (await page.locator('[data-vc-tour="account-home"]').isVisible()) {
    await enterEditorFromHome(page, 'Projeto com vídeo');
  }
  await expect.poll(() => videoExists(page, removedId), { timeout: 15_000 }).toBe(false);
});
