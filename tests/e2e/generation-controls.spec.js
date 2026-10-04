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

test('analisar meu tom usa somente IA de texto e não inicia carrossel', async ({ page }) => {
  const textOnlySession = {
    ...SESSAO_ATIVA,
    tier: 'essential',
    imageQuota: { limit: 0, remaining: 0, used: 0 },
  };
  let releaseAnalysis;
  let analysisStarted = false;
  const prompts = [];
  const pending = new Promise((resolve) => { releaseAnalysis = resolve; });
  await mockApi(page, {
    session: textOnlySession,
    extra: {
      '/api/fetch-source': (route) => route.fulfill({
        json: {
          ok: true,
          text: 'MUSA — direção criativa para quem quer transformar ideia em linguagem visual. Clareza antes de volume. Criatividade com intenção, processo e repertório.',
        },
      }),
      '/api/ai/compatible': async (route) => {
        const promptText = route.request().postDataJSON().payload.messages.find((message) => message.role === 'user').content;
        prompts.push(promptText);
        analysisStarted = true;
        await pending;
        return route.fulfill({ json: {
          choices: [{ message: { content: `\`\`\`json
{
  "resumo": "Direto, humano e preciso",
  "traços": ["direto", "humano", "preciso",],
  "faça": "Nomeie o mecanismo com exemplos concretos.\nMostre o processo.",
  "evite": "Tom de guru e frases vazias",
  "estilo_cta": "Convide para um próximo passo simples",
  "frases_exemplo": ["Clareza antes de volume.",],
}
\`\`\`` } }],
        } });
      },
    },
  });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click();
  const before = await doc(page);
  await page.getByRole('button', { name: /Usar publicações para extrair o DNA/i }).click();
  await page.getByLabel('Links do perfil e das publicações').fill('https://instagram.com/musa.exemplo');
  const analyzeButton = page.getByRole('button', { name: 'Analisar meu tom', exact: true });
  await expect(analyzeButton).toBeVisible();
  await analyzeButton.click();
  await expect.poll(() => analysisStarted).toBe(true);
  await expect(page.getByRole('button', { name: /Analisando/i })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Análise de tom em andamento' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar análise' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Geração em andamento' })).toHaveCount(0);
  expect((await doc(page)).slides).toEqual(before.slides);
  releaseAnalysis();
  await expect(page.getByText('Confirme o tom antes de guardar', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '1 fonte lida' })).toBeVisible();
  expect(prompts).toHaveLength(1);
  expect(prompts[0]).toContain('estrategista de voz de marca');
  expect(prompts[0]).toContain('https://instagram.com/musa.exemplo');
  expect(prompts[0]).toContain('Clareza antes de volume');
  expect(prompts[0]).not.toContain('Crie um carrossel de');
  expect((await doc(page)).slides).toEqual(before.slides);
  await page.getByRole('button', { name: 'Guardar tom da marca', exact: true }).click();
  await expect.poll(async () => page.evaluate(() => {
    const brands = JSON.parse(localStorage.getItem('vc_brands') || '[]');
    const activeId = JSON.parse(localStorage.getItem('vc_active_brand_id') || '"default"');
    return brands.find((item) => item.id === activeId)?.brandTone?.summary || '';
  })).toBe('Direto, humano e preciso');
});

test('objetivo do Criar rápido aplica e persiste o modo narrativo sugerido', async ({ page }) => {
  const prompts = [];
  await mockApi(page, {
    session,
    extra: {
      '/api/ai/compatible': (route) => {
        const promptText = route.request().postDataJSON().payload.messages.find((message) => message.role === 'user').content;
        prompts.push(promptText);
        return route.fulfill({
          json: completion(promptText.startsWith('REVISÃO EDITORIAL')
            ? { edits: [] }
            : {
                slides: Array.from({ length: 6 }, (_, index) => ({
                  title: `Educativo ${index + 1}`,
                  subtitle: `Passo concreto ${index + 1}.`,
                  bodyAfterImage: index < 2 ? '' : `Aplicação prática do passo ${index + 1}, com um exemplo simples para testar hoje.`,
                  imageQuery: `editorial educational scene step ${index + 1}`,
                })),
                caption: 'Um passo por vez, com aplicação prática.',
              }),
        });
      },
    },
  });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click();
  await page.getByRole('button', { name: 'Educar', exact: true }).click();
  await expect(page.getByLabel('Pedido para gerar carrossel', { exact: true })).toHaveValue(/carrossel educativo/i);
  await expect.poll(async () => (await doc(page))?.quickNarrativeMode).toBe('how_to');
  await page.getByRole('button', { name: 'Gerar carrossel', exact: true }).click();
  await expect.poll(async () => (await doc(page))?.slides[0]?.title).toBe('Educativo 1');
  expect(prompts[0]).toContain('MÉTODO PASSO-A-PASSO');
});

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
  const modes = page.getByLabel('Modo narrativo', { exact: true });
  await expect(modes).toHaveValue('none');
  await generate(page);
  await expect.poll(async () => (await doc(page))?.slides.length).toBe(3);
  expect(prompts[0]).toContain('SEM MODO NARRATIVO');
  expect(prompts[0]).not.toContain('MÉTODO EDITORIAL');
  expect(images).toHaveLength(0);
  await prompt(page);
  await modes.selectOption('storytelling');
  await generate(page);
  await expect.poll(() => prompts.length).toBe(4);
  await expect(page.getByRole('region', { name: 'Geração em andamento' })).toHaveCount(0);
  expect(prompts[2]).toContain('MÉTODO STORYTELLING');
  await expect.poll(async () => (await doc(page))?.quickNarrativeMode).toBe('storytelling');
  await page.reload();
  await page.getByRole('tab', { name: /^Narrativa$/i }).first().click();
  await openPanel(page, /PROMPT PARA GERAR/i);
  await expect(modes).toHaveValue('storytelling');
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
  await page.getByRole('button', { name: /Cancelar (?:geração|operação)/i }).click();
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

test('cancelar Gerar imagens do Criador não inicia o card seguinte', async ({ page }) => {
  let imageCalls = 0;
  let releaseFirstImage;
  const firstImagePending = new Promise(resolve => { releaseFirstImage = resolve; });
  await openEditor(page, {
    '/api/ai/compatible': route => {
      const p = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
      return route.fulfill({ json: completion(p.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : draft()) });
    },
    '/api/ai/sjinn-image': async route => {
      imageCalls++;
      if (imageCalls === 1) await firstImagePending;
      await route.fulfill({ json: { b64_json: PNG, mime: 'image/png' } }).catch(() => {});
    },
  });
  await prompt(page);
  await generate(page);
  await expect.poll(async () => (await doc(page))?.slides[0]?.title).toBe('Original 1');

  await page.getByRole('tab', { name: /^Home$/i }).first().click();
  await page.getByRole('button', { name: 'Gerar imagens', exact: true }).click();
  await expect.poll(() => imageCalls).toBe(1);
  await page.getByRole('button', { name: /Cancelar (?:geração|operação)/i }).click();
  releaseFirstImage();
  await expect(page.getByRole('region', { name: 'Geração em andamento' })).toHaveCount(0);
  // Dá ao loop cancelado duas oportunidades de iniciar outro request. O teste
  // falha na regressão em que o card 2 nascia como um job novo após o cancelamento.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(imageCalls).toBe(1);
  expect((await doc(page)).slides.filter(s => s.bgImageId)).toHaveLength(0);
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
