import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const session = { ...SESSAO_ATIVA, tier: 'creator', imageQuota: { limit: 50, remaining: 50, used: 0 } };
const completion = value => ({ choices: [{ message: { content: JSON.stringify(value) } }] });
const draft = (version = 'Original') => ({
  slides: [1, 2, 3].map(i => ({ title: `${version} ${i}`, subtitle: `Crie imagens no MUSA ${i}.`, imageQuery: 'expressive three dimensional orange imaginary world inside a creative studio' })),
  caption: 'Explore seu mundo criativo no MUSA.',
  projectDesign: { titleFont: 'Anton', bodyFont: 'Inter', titleWeight: 400, titleCase: 'upper', accent: '#FF5C00', layout: 'fullbleed' },
});
const doc = page => page.evaluate(() => {
  const lib = JSON.parse(localStorage.getItem('vc_library') || '[]');
  return (lib.find(e => e.id === localStorage.getItem('vc_active_doc_id')) || lib[0])?.doc;
});
async function openEditor(page, extra) {
  await mockApi(page, { session, extra });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click();
  await page.getByRole('tab', { name: /^Narrativa$/i }).first().click();
}
async function openPanel(page, label) {
  const button = page.getByRole('button', { name: label }).first();
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
}
async function prompt(page) {
  await openPanel(page, /PROMPT PARA GERAR/i);
  await page.getByLabel('Prompt para gerar', { exact: true }).fill('CRIE 3 CARDS ANUNCIANDO O MUSA');
}
const generate = page => page.getByRole('button', { name: /Gerar com contexto e referências/i }).click();

// Somente APIs mockadas: nenhum crédito real e nenhuma conta de produção.
test('remix exige escolha, mantém visual e usa contexto/referências atuais nas imagens', async ({ page }) => {
  test.setTimeout(90_000);
  const prompts = [], imageRequests = [];
  let version = 0;
  await openEditor(page, {
    '/api/ai/compatible': route => {
      const p = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
      prompts.push(p);
      return route.fulfill({ json: completion(p.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : draft(`Versão ${++version}`)) });
    },
    '/api/ai/sjinn-image': route => {
      imageRequests.push(route.request().postDataJSON());
      return route.fulfill({ json: { b64_json: PNG, mime: 'image/png' } });
    },
  });
  await openPanel(page, /USAR CONTEXTO DA MARCA/i);
  await page.getByLabel('Nome do contexto', { exact: true }).fill('MUSA');
  await page.getByLabel('Brief do projeto').fill('# MUSA\nStudio de imagem, vídeo e áudio. Não invente preços.');
  await page.getByLabel('Estilo visual do projeto').fill('3D expressivo, laranja, tipografia Anton.');
  await page.locator('input[accept="image/*"][multiple]').first().setInputFiles([
    { name: 'mood-a.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') },
    { name: 'mood-b.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') },
  ]);
  await expect(page.getByRole('button', { name: 'Remover mood-b.png', exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Contexto ativo' })).toContainText('MUSA — Contexto ON');
  await prompt(page);
  await expect(page.getByRole('radio', { name: 'Só texto', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Texto e imagens', exact: true }).check();
  await page.screenshot({ path: '/tmp/viral-generation-prompt.png' });
  await generate(page);
  await expect.poll(async () => (await doc(page))?.slides.filter(s => s.bgImageId).length).toBe(3);
  await expect(page.getByRole('region', { name: 'Geração em andamento' })).toHaveCount(0);
  const before = await doc(page);
  const tones = page.getByRole('group', { name: 'Tom do remix' });
  await expect(tones.getByRole('button')).toHaveCount(8);
  await tones.getByRole('button', { name: 'Leve', exact: true }).click();
  expect(prompts).toHaveLength(2);
  await expect(page.getByRole('radio', { name: 'Só texto', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Refazer só texto', exact: true }).click();
  await expect.poll(async () => (await doc(page))?.slides[0].title).toBe('Versão 2 1');
  const after = await doc(page);
  expect(imageRequests).toHaveLength(3);
  expect(after.brand).toEqual(before.brand);
  for (let i = 0; i < 3; i++) {
    const withoutCopy = ({ title, subtitle, bodyAfterImage, ...rest }) => rest;
    expect(withoutCopy(after.slides[i])).toEqual(withoutCopy(before.slides[i]));
  }
  expect(prompts[2]).toContain('REMIX DO CARROSSEL ATUAL');
  expect(prompts[2]).toContain('Não invente preços');
  await openPanel(page, /USAR CONTEXTO DA MARCA/i);
  await page.getByLabel('Estilo visual do projeto').fill('Colagem de papel laranja, recortes com textura.');
  await openPanel(page, /EDITAR CARD/i);
  await tones.getByRole('button', { name: 'Comercial', exact: true }).click();
  await page.getByRole('radio', { name: 'Texto e imagens', exact: true }).check();
  await page.getByRole('button', { name: 'Refazer texto e imagens', exact: true }).click();
  await expect.poll(() => imageRequests.length).toBe(6);
  await expect(page.getByRole('region', { name: 'Geração em andamento' })).toHaveCount(0);
  expect(prompts[4]).toContain('Colagem de papel laranja');
  expect(prompts[4]).not.toContain('variação solicitada: leve');
  for (const request of imageRequests.slice(3)) {
    expect(request.imageList).toHaveLength(2);
    expect(request.prompt).toContain('Colagem de papel laranja');
  }
  expect((await doc(page)).slides.map(s => s.canvas)).toEqual(before.slides.map(s => s.canvas));
});

test('prompt tem modos persistidos, Nenhum não impõe método e só texto não pede imagens', async ({ page }) => {
  const prompts = [], images = [];
  await openEditor(page, {
    '/api/ai/compatible': route => {
      const p = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
      prompts.push(p);
      return route.fulfill({ json: completion(p.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : draft()) });
    },
    '/api/ai/sjinn-image': route => { images.push(1); return route.fulfill({ json: { b64_json: PNG } }); },
  });
  await prompt(page);
  const modes = page.getByRole('group', { name: 'Modo narrativo', exact: true });
  await expect(modes.getByRole('button', { name: 'Nenhum', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await generate(page);
  await expect.poll(async () => (await doc(page))?.slides.length).toBe(3);
  expect(prompts[0]).toContain('SEM MODO NARRATIVO');
  expect(prompts[0]).not.toContain('MÉTODO EDITORIAL');
  expect(images).toHaveLength(0);
  await prompt(page);
  await modes.getByRole('button', { name: 'Storytelling', exact: true }).click();
  await generate(page);
  await expect.poll(() => prompts.length).toBe(4);
  await expect(page.getByRole('region', { name: 'Geração em andamento' })).toHaveCount(0);
  expect(prompts[2]).toContain('MÉTODO STORYTELLING');
  await expect.poll(async () => (await doc(page))?.quickNarrativeMode).toBe('storytelling');
  await page.reload();
  await page.getByRole('tab', { name: /^Narrativa$/i }).first().click();
  await openPanel(page, /PROMPT PARA GERAR/i);
  await expect(modes.getByRole('button', { name: 'Storytelling', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('cancelar é global, descarta texto atrasado e libera uma nova geração', async ({ page }) => {
  let release, started = false, draftCalls = 0;
  const pending = new Promise(resolve => { release = resolve; });
  await openEditor(page, { '/api/ai/compatible': async route => {
    const p = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
    if (p.startsWith('REVISÃO EDITORIAL')) return route.fulfill({ json: completion({ edits: [] }) });
    draftCalls++;
    if (draftCalls === 1) { started = true; await pending; }
    await route.fulfill({ json: completion(draft(draftCalls === 1 ? 'Atrasada' : 'Nova')) }).catch(() => {});
  } });
  const before = await doc(page);
  await prompt(page);
  await generate(page);
  await expect.poll(() => started).toBe(true);
  await page.getByRole('tab', { name: /^Visual$/i }).first().click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Cancelar geração', exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/viral-cancel-mobile.png' });
  await page.getByRole('button', { name: 'Cancelar geração', exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.getByRole('region', { name: 'Geração em andamento' })).toHaveCount(0);
  release();
  await page.getByRole('tab', { name: /^Narrativa$/i }).first().click();
  await expect(page.getByLabel('Prompt para gerar', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('Prompt para gerar', { exact: true })).toHaveValue('CRIE 3 CARDS ANUNCIANDO O MUSA');
  expect((await doc(page)).slides).toEqual(before.slides);
  await generate(page);
  await expect.poll(async () => (await doc(page))?.slides[0].title).toBe('Nova 1');
  expect(draftCalls).toBe(2);
});

test('cancelar imagens para a fila e mantém imagens já concluídas', async ({ page }) => {
  let imageCalls = 0, release;
  const pending = new Promise(resolve => { release = resolve; });
  await openEditor(page, {
    '/api/ai/compatible': route => {
      const p = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
      return route.fulfill({ json: completion(p.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : draft()) });
    },
    '/api/ai/sjinn-image': async route => {
      imageCalls++;
      if (imageCalls === 2) await pending;
      await route.fulfill({ json: { b64_json: PNG, mime: 'image/png' } }).catch(() => {});
    },
  });
  await prompt(page);
  await page.getByRole('radio', { name: 'Texto e imagens', exact: true }).check();
  await generate(page);
  await expect.poll(() => imageCalls).toBe(2);
  await page.getByRole('tab', { name: /^Marca$/i }).first().click();
  await page.getByRole('button', { name: 'Cancelar geração', exact: true }).click();
  release();
  await expect(page.getByRole('region', { name: 'Geração em andamento' })).toHaveCount(0);
  await expect.poll(async () => (await doc(page))?.slides.filter(s => s.bgImageId).length).toBe(1);
  expect(imageCalls).toBe(2);
  expect((await doc(page)).slides.some(s => s.bgImageFailed)).toBe(false);
});

test('logo PNG transparente pertence só ao card escolhido e volta no reload/backup', async ({ page }) => {
  test.setTimeout(60_000);
  await openEditor(page, { '/api/ai/compatible': route => {
    const p = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
    return route.fulfill({ json: completion(p.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : draft()) });
  } });
  await prompt(page);
  await generate(page);
  await expect(page.getByRole('button', { name: 'Importar logo PNG neste card', exact: true })).toBeVisible();
  // Fixture com metade dos pixels transparentes; o upload não pode converter em JPEG.
  const pngData = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 20;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ff5500'; ctx.fillRect(0, 0, 10, 20);
    return canvas.toDataURL('image/png');
  });
  await openPanel(page, /USAR CONTEXTO DA MARCA/i);
  await page.getByLabel('Arquivo PNG da logo do projeto').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(pngData.split(',')[1], 'base64') });
  await expect.poll(async () => (await doc(page))?.styleKit.logo?.imageId).toBeTruthy();
  expect((await doc(page)).slides.some(s => s.logoImageId)).toBe(false);
  await openPanel(page, /EDITAR CARD/i);
  await page.getByRole('button', { name: 'Aplicar logo do projeto neste card', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Logo deste card', exact: true })).toBeVisible();
  await expect.poll(async () => (await doc(page))?.slides[0].logoImageId).toBeTruthy();
  const saved = await doc(page);
  expect(saved.slides.filter(s => s.logoImageId)).toHaveLength(1);
  expect(saved.slides[0].logoImage).toBeUndefined();
  await page.getByLabel('Posição da logo neste card').selectOption('bl');
  await expect.poll(async () => (await doc(page))?.slides[0].logoPosition).toBe('bl');
  const exportedLogos = page.locator('[data-vc-export-tree] div[style*="background-image"]');
  await expect.poll(async () => exportedLogos.evaluateAll(nodes => nodes.filter(n => n.style.backgroundImage.includes('blob:')).length)).toBe(1);
  await page.screenshot({ path: '/tmp/viral-project-logo.png' });
  const alpha = await page.getByRole('img', { name: 'Logo deste card', exact: true }).evaluate(img => {
    const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 20;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
    return ctx.getImageData(15, 10, 1, 1).data[3];
  });
  expect(alpha).toBe(0);
  await page.reload();
  await page.getByRole('tab', { name: /^Narrativa$/i }).first().click();
  await openPanel(page, /EDITAR CARD/i);
  await expect(page.getByRole('img', { name: 'Logo deste card', exact: true })).toBeVisible();
  await expect(page.getByLabel('Posição da logo neste card')).toHaveValue('bl');
  await page.getByRole('button', { name: /^Slide 2 de / }).click();
  await expect(page.getByRole('button', { name: 'Importar logo PNG neste card', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Logo deste card', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Aplicar logo do projeto neste card', exact: true }).click();
  await expect.poll(async () => (await doc(page))?.slides[1].logoImageId).toBe(saved.slides[0].logoImageId);
  expect((await doc(page)).slides[2].logoImageId).toBeFalsy();
  await page.getByRole('button', { name: 'Abrir biblioteca de projetos salvos', exact: true }).click();
  const downloadReady = page.waitForEvent('download');
  await page.getByTitle('Exportar toda a biblioteca como JSON', { exact: true }).click();
  const download = await downloadReady;
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(backup.docs[0].doc.styleKit.logo.dataUrl).toBe(pngData);
  expect(backup.docs[0].doc.slides[0].logoImage).toBe(pngData);
  expect(backup.docs[0].doc.slides[0].logoImageId).toBeUndefined();
  await page.locator('input[accept=".json,application/json"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect.poll(async () => (await doc(page))?.slides[0].logoImageId).not.toBe(saved.slides[0].logoImageId);
  await page.getByRole('tab', { name: /^Narrativa$/i }).first().click();
  await openPanel(page, /EDITAR CARD/i);
  await page.getByRole('button', { name: /^Slide 1 de / }).click();
  await expect(page.getByRole('img', { name: 'Logo deste card', exact: true })).toBeVisible();
});
