import { enterEditorFromHome } from './helpers/project-entry.js';
import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const PROJECT_ID = 'photo-quality';
const CARD_ID = 'photo-quality-card';

async function openPhotoProject(page) {
  await page.context().route('**/*', (route) => {
    const { hostname, protocol } = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(hostname) || !/^https?:$/.test(protocol)
      ? route.continue() : route.abort('blockedbyclient');
  });
  await mockApi(page, { session: SESSAO_ATIVA, extra: {
    '/api/library-sync': route => route.fulfill({ status: 503, json: { error: 'E2E: biblioteca offline.' } }),
  } });
  await page.addInitScript(({ projectId, cardId, owner }) => {
    if (localStorage.getItem('vc_photo_quality_seeded')) return;
    localStorage.setItem('vc_photo_quality_seeded', '1');
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(projectId));
    localStorage.setItem('vc_data_owner', JSON.stringify(owner));
    localStorage.setItem('vc_library', JSON.stringify([{ id: projectId, name: 'Foto com detalhe original', doc: {
      fmt: 'carrossel', creativePreset: 'livre',
      brand: { id: 'photo-quality-brand', name: 'Teste', bg: '#ffffff', titleColor: '#000000', textColor: '#000000',
        titleFont: 'Arial, sans-serif', bodyFont: 'Arial, sans-serif', subtitleFont: 'Arial, sans-serif',
        showHandle: false, showSwipeCue: false, logo: null },
      slides: [{ id: cardId, num: 1, title: '', subtitle: '', bodyAfterImage: '', layout: 'mc', align: 'left',
        photoRegion: 'full', bgFit: 'cover', bgX: 50, bgY: 50, bgZoom: 100, bgOpacity: 100, bgMirror: false,
        overlay: 0, bgPattern: 'none', bgImage: null, imageQuery: 'Foto importada',
        textShadow: false, canvas: null, showHandle: false, showSwipeCue: false, overlays: [] }],
    } }]));
  }, { projectId: PROJECT_ID, cardId: CARD_ID, owner: `email:${SESSAO_ATIVA.email}` });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await expect(page.locator(`main [data-vc-card-surface="${CARD_ID}"]`)).toBeVisible();
}

async function detailedPhoto(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 3240;
    canvas.height = 4050;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1678c4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Detalhe de um pixel: sobrevive somente se o render usa a fonte original.
    for (let x = 300; x < 900; x += 1) {
      ctx.fillStyle = x % 2 === 0 ? '#000000' : '#ffffff';
      ctx.fillRect(x, 300, 1, 400);
    }
    ctx.fillStyle = '#e12943';
    ctx.fillRect(1200, 1200, 300, 300);
    // Ruído determinístico torna o PNG >2 MB sem depender de arquivos externos.
    const noise = ctx.createImageData(1024, 1024);
    let state = 123456789;
    for (let i = 0; i < noise.data.length; i += 4) {
      for (let channel = 0; channel < 3; channel += 1) {
        state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
        noise.data[i + channel] = state & 255;
      }
      noise.data[i + 3] = 255;
    }
    ctx.putImageData(noise, 2000, 2800);
    const result = canvas.toDataURL('image/png');
    canvas.width = 0; canvas.height = 0;
    return result;
  });
}

async function storedPhoto(page) {
  return page.evaluate(async ({ projectId, cardId }) => {
    const library = JSON.parse(localStorage.getItem('vc_library') || '[]');
    const slide = library.find(entry => entry.id === projectId)?.doc?.slides.find(item => item.id === cardId);
    if (!slide?.bgImageId) return null;
    const entry = await new Promise((resolve, reject) => {
      const opening = indexedDB.open('viral-carrossel-img', 1);
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        const reading = db.transaction('images', 'readonly').objectStore('images').get(slide.bgImageId);
        reading.onsuccess = () => { db.close(); resolve(reading.result); };
        reading.onerror = () => { db.close(); reject(reading.error); };
      };
    });
    if (!entry?.blob) return null;
    const bytes = await entry.blob.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    const bitmap = await createImageBitmap(entry.blob);
    const dimensions = [bitmap.width, bitmap.height];
    bitmap.close();
    return { id: slide.bgImageId, size: entry.blob.size, type: entry.blob.type, hash, dimensions };
  }, { projectId: PROJECT_ID, cardId: CARD_ID });
}

test('importação conserva original grande e PNG 3× conserva detalhe de um pixel', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await openPhotoProject(page);
  const original = Buffer.from((await detailedPhoto(page)).split(',')[1], 'base64');
  expect(original.length).toBeGreaterThan(2 * 1024 * 1024);
  await page.locator(`main [data-vc-card-surface="${CARD_ID}"] input.vc-photo-hit`).setInputFiles({
    name: 'detalhe-original-3240x4050.png', mimeType: 'image/png', buffer: original,
  });
  const expected = { size: original.length, type: 'image/png', dimensions: [3240, 4050],
    hash: createHash('sha256').update(original).digest('hex') };
  await expect.poll(async () => {
    const stored = await storedPhoto(page);
    if (!stored) return null;
    const { id, ...quality } = stored;
    return quality;
  }).toEqual(expected);

  const downloadReady = page.waitForEvent('download', { timeout: 45_000 });
  await page.getByRole('button', { name: /baixar card 1/i }).click();
  const download = await downloadReady;
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([3240, 4050]);
  await download.saveAs(testInfo.outputPath('foto-exportada-3240x4050.png'));
  const samples = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const pixel = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
    return { blue: pixel(1800, 900), red: pixel(1350, 1350),
      detail: Array.from({ length: 32 }, (_, index) => pixel(600 + index, 400)) };
  }, png.toString('base64'));
  expect(samples.blue).toEqual([22, 120, 196, 255]);
  expect(samples.red).toEqual([225, 41, 67, 255]);
  expect(samples.detail).toEqual(Array.from({ length: 32 }, (_, index) => {
    const value = index % 2 === 0 ? 0 : 255;
    return [value, value, value, 255];
  }));

  // Reload usa o IndexedDB, e importar em lote percorre outro handler da UI.
  await page.reload();
  await enterEditorFromHome(page);
  const { id: beforeBatch, ...restored } = await storedPhoto(page);
  expect(restored).toEqual(expected);
  await page.getByRole('tab', { name: /^Imagem$/i }).click();
  await page.locator('input.vc-batch-photo-input').setInputFiles({
    name: 'mesma-foto-em-lote.png', mimeType: 'image/png', buffer: original,
  });
  await expect.poll(async () => (await storedPhoto(page))?.id).not.toBe(beforeBatch);
  const { id: afterBatch, ...batched } = await storedPhoto(page);
  expect(afterBatch).toMatch(/^img_/);
  expect(batched).toEqual(expected);
});
