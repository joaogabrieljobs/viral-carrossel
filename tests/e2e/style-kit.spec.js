import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const brief = '# MUSA Studio de Geração\nImagem, vídeo e áudio.\n\n' + 'Contexto de produto. '.repeat(1250) + '\n## Identidade visual final\nTítulo Anton Regular em caixa alta. Corpo Inter. Acento #FF5C00. Imagem fullbleed, 3D expressivo. Não divulgar preço ou data.';
const completion = value => ({ choices: [{ message: { content: JSON.stringify(value) } }] });
const persisted = page => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]'));

test('plano: prompt rápido gera três imagens com as referências e o estilo do projeto', async ({ page }) => {
  test.setTimeout(60_000);
  const imageRequests = [];
  await mockApi(page, { session: { ...SESSAO_ATIVA, tier: 'creator', imageQuota: { limit: 50, remaining: 50, used: 0 } }, extra: {
    '/api/ai/compatible': route => {
      const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
      return route.fulfill({ json: completion(prompt.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : {
        slides: ['SUA IDEIA GANHA MUNDO', 'IMAGEM, VÍDEO E ÁUDIO', 'CONHEÇA O MUSA'].map(title => ({ title, subtitle: 'Explore seu studio de geração.', imageQuery: `expressive 3D imagined world for ${title}` })),
        caption: 'Conheça as possibilidades de criação no MUSA.',
        projectDesign: { titleFont: 'Anton', bodyFont: 'Inter', titleWeight: 400, titleCase: 'upper', accent: '#FF5C00', layout: 'fullbleed' },
      }) });
    },
    '/api/ai/sjinn-image': route => {
      imageRequests.push(route.request().postDataJSON());
      return route.fulfill({ json: { b64_json: PNG, mime: 'image/png', quota: { used: imageRequests.length, limit: 50, remaining: 50 - imageRequests.length, tier: 'creator' } } });
    },
  } });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click();
  await narrativa(page);
  await contextPanel(page);
  await page.getByLabel('Brief do projeto').fill('# MUSA\nStudio de geração de imagem, vídeo e áudio.');
  await page.getByLabel('Estilo visual do projeto').fill('3D expressivo, mundos de fantasia. Acentos gráficos #FF5C00.');
  await page.locator('input[accept="image/*"][multiple]').first().setInputFiles([
    { name: 'mood-a.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') },
    { name: 'mood-b.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') },
  ]);
  await expect(page.getByRole('button', { name: 'Remover mood-b.png', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /PROMPT PARA GERAR/i }).first().click();
  await page.getByLabel('Prompt para gerar', { exact: true }).fill('CRIE 3 CARDS ANUNCIANDO LANÇAMENTO DO MUSA');
  await page.getByRole('radio', { name: 'Texto e imagens', exact: true }).check();
  await page.getByRole('button', { name: /Gerar com contexto e referências/i }).click();
  await expect.poll(() => imageRequests.length).toBe(3);
  for (const body of imageRequests) {
    expect(body.imageList).toHaveLength(2);
    expect(body.imageList.every(ref => /^data:image\/(png|jpeg);base64,/.test(ref))).toBe(true);
    expect(body.prompt).toContain('3D expressivo');
    expect(body.prompt).toContain('REFERENCE IMAGES ARE ATTACHED');
    expect(body.prompt).not.toContain('photorealistic real-photograph rendering');
    expect(body.resolution).toBe('1K');
  }
  await expect.poll(async () => (await persisted(page))[0]?.doc.slides.filter(s => s.bgImageId || s.bgImage).length).toBe(3);
});

async function narrativa(page) {
  await page.getByRole('tab', { name: /^Narrativa$/i }).first().click();
}
async function contextPanel(page) {
  const button = page.getByRole('button', { name: /USAR CONTEXTO DA MARCA/i }).first();
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
}

test('upload atual → três anúncios; referências em IndexedDB; projeto B isolado e A restaurado', async ({ page }) => {
  test.setTimeout(90_000);
  const prompts = [];
  await mockApi(page, { session: { ...SESSAO_ATIVA, tier: 'essential', imageQuota: { limit: 0, remaining: 0 } }, extra: {
    '/api/ai/compatible': route => {
      const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
      prompts.push(prompt);
      return route.fulfill({ json: completion(prompt.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : {
        slides: [
          { title: 'SUA IDEIA GANHA MUNDO', subtitle: 'Conheça o MUSA, seu studio de geração.', imageQuery: 'expressive three dimensional world opening inside a creative studio' },
          { title: 'CRIE EM TRÊS LINGUAGENS', subtitle: 'Imagem, vídeo e áudio no MUSA.', imageQuery: 'colorful three dimensional cinematic world with sculptural shapes' },
          { title: 'O QUE VOCÊ VAI CRIAR?', subtitle: 'Acompanhe o lançamento do MUSA.', imageQuery: 'surreal three dimensional portal into a vivid imagined world' },
        ], caption: 'Conheça as possibilidades de criação no MUSA.',
        projectDesign: { titleFont: 'Anton', bodyFont: 'Inter', titleWeight: 400, titleCase: 'upper', accent: '#FF5C00', layout: 'fullbleed' },
      }) });
    },
  } });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click();
  await narrativa(page);
  await contextPanel(page);
  await page.locator('input[accept=".md,.txt,.markdown,text/plain,text/markdown"]').first().setInputFiles({ name: 'MUSA.md', mimeType: 'text/markdown', buffer: Buffer.from(brief) });
  await expect(page.getByLabel('Brief do projeto')).toHaveValue(brief);
  await page.locator('input[accept="image/*"][multiple]').first().setInputFiles([
    { name: 'mood-a.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') },
    { name: 'mood-b.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') },
  ]);
  await expect(page.getByRole('button', { name: 'Remover mood-b.png', exact: true })).toBeVisible();
  await expect.poll(async () => (await persisted(page))[0]?.doc.styleKit.refImages.length).toBe(2);
  const saved = (await persisted(page))[0];
  expect(saved.doc.styleKit.refImages.every(r => r.imageId && !r.dataUrl)).toBe(true);
  const id = saved.id;
  await page.getByRole('button', { name: /PROMPT PARA GERAR/i }).first().click();
  await page.getByLabel('Prompt para gerar', { exact: true }).fill('CRIE 3 CARDS ANUNCIANDO LANÇAMENTO DO MUSA');
  await page.getByRole('button', { name: /Gerar com contexto e referências/i }).click();
  await expect.poll(async () => (await persisted(page)).find(e => e.id === id)?.doc.slides.length).toBe(3);
  const generated = (await persisted(page)).find(e => e.id === id).doc;
  expect(prompts[0]).toContain(brief);
  expect(prompts[0]).toContain('exatamente 3 itens');
  expect(prompts[0]).toContain('ENTREGA PUBLICITÁRIA');
  expect(prompts[0]).not.toContain('MÉTODO EDITORIAL');
  expect(generated.brand.titleFont).toContain('Anton');
  expect(generated.brand.accent).toBe('#FF5C00');
  expect(generated.slides.every(s => s.titleWeight === 400 && s.photoRegion === 'full')).toBe(true);
  await contextPanel(page);
  // Troca imediatamente depois de digitar: não pode perder o último caractere no debounce.
  await page.getByLabel('Nome do contexto', { exact: true }).fill('MUSA');
  await page.getByLabel('Brief do projeto').fill(brief + '\nÚltima edição antes da troca.');
  await expect(page.getByRole('status', { name: 'Contexto ativo' })).toContainText('MUSA — Contexto ON');
  await page.getByRole('button', { name: /^Novo projeto$/i }).first().click();
  await narrativa(page);
  await contextPanel(page);
  await expect(page.getByLabel('Brief do projeto')).toHaveValue('');
  await expect(page.getByRole('status', { name: 'Contexto ativo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remover mood-b.png', exact: true })).toHaveCount(0);
  await expect.poll(async () => (await persisted(page)).find(e => e.id === id)?.doc.styleKit.contextMd).toContain('Última edição antes da troca.');
  // Volta por meio da biblioteca real; pagehide também persiste o projeto ativo.
  await page.getByRole('button', { name: 'Abrir biblioteca de projetos salvos', exact: true }).click();
  await page.getByRole('button', { name: `Abrir ${saved.name}`, exact: true }).click();
  await contextPanel(page);
  await expect(page.getByLabel('Brief do projeto')).toHaveValue(brief + '\nÚltima edição antes da troca.');
  await page.reload();
  await narrativa(page);
  await contextPanel(page);
  await expect(page.getByLabel('Brief do projeto')).toHaveValue(brief + '\nÚltima edição antes da troca.');
  await expect(page.getByRole('img', { name: 'mood-b.png', exact: true })).toBeVisible();
  const other = (await persisted(page)).find(e => e.id !== id);
  expect(other.doc.styleKit.contextMd).toBe('');

  await page.getByRole('button', { name: 'Abrir biblioteca de projetos salvos', exact: true }).click();
  const downloadReady = page.waitForEvent('download');
  await page.getByTitle('Exportar toda a biblioteca como JSON', { exact: true }).click();
  const download = await downloadReady;
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const backedUp = backup.docs.find(e => e.id === id).doc.styleKit;
  expect(backedUp.name).toBe('MUSA');
  expect(backedUp.refImages.every(r => r.dataUrl?.startsWith('data:image/') && !r.imageId)).toBe(true);
  await page.locator('input[accept=".json,application/json"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect.poll(async () => (await persisted(page)).length).toBe(4);
  const imported = (await persisted(page)).find(e => e.id !== id && e.doc.styleKit.contextMd.includes('MUSA'));
  expect(imported.doc.styleKit.refImages).toHaveLength(2);
  expect(imported.doc.styleKit.refImages.every(r => r.imageId && !r.dataUrl && !saved.doc.styleKit.refImages.some(old => old.imageId === r.imageId))).toBe(true);
});
