// Teste 7: assistente -> roteiro v3 -> redação -> revisão -> imagens -> conta.
// "real" é o caminho da aplicação: todas as APIs/IA são simuladas, sem crédito.
// Nenhum diretor, normalizador ou composição do app é chamado pelo teste.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { presentationBatch } from './helpers/presentation-batches.js';
import { enterEditorFromHome } from './helpers/project-entry.js';
import { assertDirectedImageRequests } from './helpers/directed-image-contract.js';

const fixture = JSON.parse(fs.readFileSync(new URL('../fixtures/apoteose-teste7.json', import.meta.url), 'utf8'));
const flyer = fs.readFileSync(new URL('../fixtures/apoteose-flyer-referencia.png', import.meta.url)).toString('base64');
const photo = fs.readFileSync(new URL('../../public/landing/moont-v3/source/02-crossing-evening.webp', import.meta.url)).toString('base64');
const NAME = 'Apoteose — reprodução do Teste 7';
const REF_ID = 'fixture-teste7-flyer';
const V2 = process.env.VITE_PROJECTS_V2 === 'true';
const session = { ...SESSAO_ATIVA, tier: 'creator', imageQuota: { limit: 50, used: 0, remaining: 50 } };
const completion = value => ({ choices: [{ message: { content: JSON.stringify(value) } }] });
const library = page => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]'));
const entry = async page => (await library(page)).find(item => item.name === NAME);
// Marca sem projeto, sem slides e sem cor de marca explícita: a única fonte
// de paleta é o kit da referência observada. A seleção acontece no assistente.
const brand = { id: 'teste7-brand', name: 'Apoteose — referência do Teste 7', styleKit: {
  ...fixture.styleKit,
  referencePalette: { colors: fixture.styleKit.referencePalette.colors, refIds: [REF_ID] },
  refImages: [{ id: REF_ID, assetId: REF_ID, name: 'Flyer Apoteose', dataUrl: `data:image/png;base64,${flyer}` }],
} };
const source = [...fixture.presentationPlan.evidence.map(item => item.quote), fixture.slides[7].subtitle].join('\n\n');
const contrastPairs = [['brasileira', 'caricata'], ['sofisticada', 'pretensiosa'], ['exclusiva', 'arrogante'],
  ['sensual', 'vulgar'], ['irreverente', 'infantil'], ['contemporânea', 'depender de tendências'], ['bem-humorada', 'recorrer ao humor óbvio']];
// A fixture mantém os 200 caracteres observados. Só a resposta ao reparo de
// excesso encurta o apoio do slide 9 para 179, preservando "pretende" e a meta.
const repairedNinthSubtitle = 'A Apoteose pretende ser o esquenta de Carnaval **mais badalado** de São Paulo. Uma festa com identidade própria, capaz de gerar desejo, conversas e expectativa antes de acontecer.';
const draft = fixture.slides.map(slide => ({
  title: slide.title, subtitle: slide.subtitle, bodyAfterImage: slide.bodyAfterImage,
  eyebrow: null, presentationBlocks: slide.presentationBlocks, speakerNotes: '',
  imageQuery: slide.scene ? [slide.scene.subject, slide.scene.action, slide.scene.setting].join('. ') : '',
}));

function cloudFixture() {
  return { rows: new Map(), writes: [], assets: new Map([[REF_ID, `data:image/png;base64,${flyer}`]]), chunks: new Map(),
    revision: 1, metaRevision: 1, metadata: { brands: [brand], folders: [], activeDocId: null,
      activeBrandId: brand.id, userProfile: null, assetIds: [REF_ID], onboardingDone: '1', modesIntroDone: '1' } };
}
function cloudRoutes(cloud) {
  const manifest = () => ({ vcVersion: 3, customerId: session.customerId, ...cloud.metadata,
    revision: cloud.revision, updatedAt: Date.now(), docs: [...cloud.rows.values()].map(row => row.entry),
    deletedIds: [], assetIds: [...cloud.assets.keys()] });
  const status = () => ({ ok: true, customerId: session.customerId, empty: cloud.rows.size === 0,
    meta: { revision: cloud.revision, updatedAt: Date.now(), projectCount: cloud.rows.size, assetIds: [...cloud.assets.keys()] } });
  return {
    '/api/account-library-meta': route => {
      const request = route.request();
      if (request.headers()['x-account-owner'] !== session.customerId) return route.fulfill({ status: 409, json: { code: 'account_meta_owner_changed' } });
      if (request.method() !== 'GET') {
        const body = request.postDataJSON();
        if (body.baseRevision !== cloud.metaRevision) return route.fulfill({ status: 409, json: { code: 'account_meta_conflict', cloudRevision: cloud.metaRevision } });
        cloud.metadata = { ...cloud.metadata, ...body.metadata }; cloud.metaRevision++;
      }
      return route.fulfill({ json: { ok: true, metadata: cloud.metadata, revision: cloud.metaRevision, updatedAt: Date.now() } });
    },
    '/api/projects': route => {
      const request = route.request(), url = new URL(request.url());
      if (request.headers()['x-project-owner'] !== session.customerId) return route.fulfill({ status: 409, json: { code: 'project_owner_changed' } });
      if (request.method() === 'GET' && url.searchParams.has('id')) {
        const row = cloud.rows.get(url.searchParams.get('id'));
        return row ? route.fulfill({ json: { ok: true, project: { id: row.entry.id, ...row, deleted: false } } })
          : route.fulfill({ status: 404, json: { code: 'project_not_found' } });
      }
      if (request.method() === 'GET') return route.fulfill({ json: { ok: true, total: cloud.rows.size, nextCursor: null,
        projects: [...cloud.rows.values()].map(row => ({ id: row.entry.id, version: row.version, deleted: false,
          entry: { id: row.entry.id, name: row.entry.name, status: row.entry.status || 'draft' } })) } });
      const body = request.postDataJSON(), previous = cloud.rows.get(body.entry.id);
      if (body.baseVersion !== (previous?.version || 0)) return route.fulfill({ status: 409, json: { code: 'project_conflict', cloudVersion: previous?.version || 0 } });
      const row = { entry: structuredClone(body.entry), version: body.baseVersion + 1 };
      cloud.rows.set(row.entry.id, row); cloud.writes.push(row.entry); cloud.revision++;
      return route.fulfill({ json: { ok: true, project: { id: row.entry.id, ...row, deleted: false } } });
    },
    '/api/library-sync': route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() === 'GET' && url.searchParams.has('asset')) {
        const dataUrl = cloud.assets.get(url.searchParams.get('asset'));
        return dataUrl ? route.fulfill({ json: { ok: true, asset: { dataUrl } } })
          : route.fulfill({ status: 404, json: { error: 'Imagem ausente na conta simulada.' } });
      }
      if (url.searchParams.get('full') === '1') return route.fulfill({ json: { ok: true, manifest: manifest() } });
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        if (body.action === 'putAsset') {
          cloud.assets.set(body.assetId, body.dataUrl);
          return route.fulfill({ json: { ok: true, assetId: body.assetId, complete: true } });
        }
        if (body.action === 'putAssetChunk') {
          const chunks = cloud.chunks.get(body.assetId) || [];
          chunks[body.index] = body.data; cloud.chunks.set(body.assetId, chunks);
          const complete = Array.from({ length: body.total }, (_, i) => chunks[i]).every(Boolean);
          if (complete) cloud.assets.set(body.assetId, chunks.join(''));
          return route.fulfill({ json: { ok: true, assetId: body.assetId, complete } });
        }
        if (body.action === 'push') {
          if (V2) return route.fulfill({ status: 400, json: { error: 'V2 deve persistir por projeto.' } });
          for (const project of body.manifest.docs || []) {
            const copy = structuredClone(project);
            cloud.rows.set(copy.id, { entry: copy, version: 1 }); cloud.writes.push(copy);
          }
          cloud.metadata = { ...cloud.metadata, ...body.manifest }; cloud.revision++;
          return route.fulfill({ json: { ...status(), revision: cloud.revision, updatedAt: Date.now(),
            projectCount: cloud.rows.size, assetIds: [...cloud.assets.keys()] } });
        }
      }
      return route.fulfill({ json: status() });
    },
  };
}

// Geometria, texto e fotos vêm da aplicação. O zoom usa Ctrl+roda; a origem
// do contêiner externo é alinhada ao pixel somente durante a captura.
async function captureDeck(page, directory, prefix = 'slide', indexes = Array.from({ length: 10 }, (_, i) => i)) {
  if (!directory) return;
  fs.mkdirSync(directory, { recursive: true });
  await page.setViewportSize({ width: 2560, height: 1540 });
  const cards = page.locator('main [data-vc-card-surface]');
  await expect(cards).toHaveCount(10);
  await page.getByLabel('Ir para o card', { exact: true }).selectOption('0');
  await cards.first().scrollIntoViewIfNeeded();
  // O wrapper do preview já mede 920 px. O formato deste teste é 16:9,
  // portanto o tamanho final exigido é 1920×1080, não o offsetWidth dele.
  const width = await cards.first().evaluate(node => node.getBoundingClientRect().width);
  const viewport = page.locator('#vc-cards-viewport');
  const bounds = await viewport.boundingBox();
  await viewport.dispatchEvent('wheel', { ctrlKey: true, deltaY: -Math.log(1920 / width) / 0.008,
    clientX: bounds.x + 200, clientY: bounds.y + 200 });
  await expect.poll(() => cards.first().evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(1920);
  await page.evaluate(() => document.fonts.ready);
  const captures = [];
  for (const i of indexes) {
    await page.getByLabel('Ir para o card', { exact: true }).selectOption(String(i));
    await cards.nth(i).scrollIntoViewIfNeeded();
    const notices = page.getByRole('button', { name: 'Fechar notificação', exact: true });
    while (await notices.count()) await notices.first().click();
    await page.mouse.move(10, 10);
    const card = cards.nth(i);
    const measure = () => card.evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        scrollX: window.scrollX, scrollY: window.scrollY };
    });
    const before = await measure();
    expect(Math.abs(before.width - 1920), `slide ${i + 1}: largura DOM nativa`).toBeLessThanOrEqual(0.001);
    expect(Math.abs(before.height - 1080), `slide ${i + 1}: altura DOM nativa`).toBeLessThanOrEqual(0.001);
    const dx = Math.round(before.x + before.scrollX) - (before.x + before.scrollX);
    const dy = Math.round(before.y + before.scrollY) - (before.y + before.scrollY);
    // locator.screenshot envolve as bordas com floor/ceil. Uma origem
    // fracionária acrescentaria 1px mesmo com DOM de exatos 1920×1080.
    // Move-se só o viewport externo, nunca o card ou suas caixas internas.
    const originalTranslate = await viewport.evaluate((node, { dx, dy }) => {
      const original = { value: node.style.getPropertyValue('translate'), priority: node.style.getPropertyPriority('translate') };
      node.style.setProperty('translate', `${dx}px ${dy}px`, 'important');
      return original;
    }, { dx, dy });
    try {
      const edgeError = bounds => {
        const x = bounds.x + bounds.scrollX, y = bounds.y + bounds.scrollY;
        return Math.max(...[x, y, x + bounds.width, y + bounds.height].map(value => Math.abs(value - Math.round(value))));
      };
      await expect.poll(async () => edgeError(await measure()), { message: `slide ${i + 1}: quatro bordas documentais inteiras` })
        .toBeLessThanOrEqual(0.001);
      const aligned = await measure();
      expect(Math.abs(aligned.width - 1920)).toBeLessThanOrEqual(0.001);
      expect(Math.abs(aligned.height - 1080)).toBeLessThanOrEqual(0.001);
      const screen = page.viewportSize();
      expect(aligned.x).toBeGreaterThanOrEqual(0);
      expect(aligned.y).toBeGreaterThanOrEqual(0);
      expect(aligned.x + aligned.width).toBeLessThanOrEqual(screen.width);
      expect(aligned.y + aligned.height).toBeLessThanOrEqual(screen.height);
      const png = await card.screenshot({ path: path.join(directory, `${prefix}-${String(i + 1).padStart(2, '0')}.png`), animations: 'disabled' });
      const dimensions = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
      captures.push({ slide: i + 1, before, aligned, normalization: { target: '#vc-cards-viewport', dx, dy, originalTranslate }, png: dimensions });
      fs.writeFileSync(path.join(directory, 'capturas.json'), JSON.stringify(captures, null, 2));
      expect(await measure(), `slide ${i + 1}: a captura não desloca ou redimensiona o canvas`).toEqual(aligned);
      expect(dimensions, `slide ${i + 1}: captura nativa`).toEqual({ width: 1920, height: 1080 });
    } finally {
      await viewport.evaluate((node, original) => {
        if (original.value) node.style.setProperty('translate', original.value, original.priority);
        else node.style.removeProperty('translate');
      }, originalTranslate);
    }
  }
}

const designSnapshot = doc => ({
  visualPreset: doc.visualPreset, deck: doc.presentationDeckDesign, plan: doc.presentationPlan,
  slides: doc.slides.map(slide => ({ title: slide.title, subtitle: slide.subtitle, bodyAfterImage: slide.bodyAfterImage,
    eyebrow: slide.eyebrow, family: slide.presentationDesignFamily, design: slide.presentationFreeDesign,
    blocks: slide.presentationBlocks, composition: slide.presentationComposition, zones: slide.canvas?.zones,
    bg: slide.customBg, fallback: slide.presentationImageFallback, failed: slide.bgImageFailed,
    error: slide.bgImageError, photoSource: slide.bgImageSource || null,
    art: !!(slide.presentationArtImageId || slide.presentationArtImageAssetId || slide.presentationArtImage) })),
});

for (const scenario of [{ recovery: 'IA' }, { recovery: 'upload' }, { recovery: 'IA', cleanArt: true }]) {
const { recovery, cleanArt = false } = scenario;
test(`Teste 7: geração inteira do Livre, timeout, persistência e recuperação por ${recovery}${cleanArt ? ', direção sem grafismos' : ''} (${V2 ? 'V2' : 'legado'})`, async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const cloud = cloudFixture(), prompts = [], images = [], runtimeErrors = [], textRepairs = [];
  let allowSlide6 = false, artBase64 = '';
  const qaRoot = process.env.QA_PHASE && !cleanArt ? path.join(process.env.QA_OUTPUT_DIR || path.join(os.tmpdir(), 'moont-teste7'), process.env.QA_PHASE) : null;
  const directory = recovery === 'IA' ? qaRoot : null;
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  // Tudo que não é o build local é bloqueado. Nenhuma conta ou IA real participa.
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol)
      ? route.continue() : route.abort('blockedbyclient');
  });
  await mockApi(page, { session, extra: {
    ...cloudRoutes(cloud),
    '/api/ai/compatible': route => {
      const prompt = route.request().postDataJSON().payload.messages.find(message => message.role === 'user').content;
      prompts.push(prompt);
      const repairIndexes = prompt.match(/\nREPARO DIRECIONADO: edite somente os slides com slideIndex ([\d, ]+)\./)?.[1]
        .split(',').map(value => Number(value.trim())) || [];
      if (repairIndexes.includes(8)) {
        textRepairs.push({ slideNumber: 9, before: fixture.slides[8].subtitle, after: repairedNinthSubtitle });
        return route.fulfill({ json: completion({ edits: [{ slideIndex: 8,
          reason: 'Reduzir o apoio ao limite, mantendo o posicionamento como intenção.', subtitle: repairedNinthSubtitle }] }) });
      }
      const value = prompt.startsWith('PLANEJAMENTO ESTRUTURADO') ? structuredClone(fixture.presentationPlan)
        : prompt.startsWith('REVISÃO') ? { edits: [] }
          : { slides: presentationBatch(prompt, structuredClone(draft)), caption: fixture.signature };
      if (cleanArt && prompt.startsWith('PLANEJAMENTO ESTRUTURADO')) value.visualDirection = {
        ...value.visualDirection, graphics: 'none', finish: 'Smooth flat color, no grain or print texture.',
        avoid: 'Organic shapes and print textures.',
      };
      return route.fulfill({ json: completion(value) });
    },
    '/api/ai/sjinn-image': route => {
      const body = route.request().postDataJSON(); images.push(body);
      if (body.usageContext?.cardNumber === 6 && !allowSlide6) return route.fulfill({ status: 504,
        json: { error: 'The operation was aborted due to timeout', code: 'generation_timeout' } });
      return route.fulfill({ json: { b64_json: body.usageContext?.cardId === 'deck-art' ? artBase64 : photo,
        mime: body.usageContext?.cardId === 'deck-art' ? 'image/png' : 'image/webp' } });
    },
  } });
  await page.addInitScript(({ brand }) => {
    if (sessionStorage.getItem('teste7-started')) return;
    sessionStorage.setItem('teste7-started', '1');
    localStorage.setItem('vc_library', '[]');
    localStorage.setItem('vc_brands', JSON.stringify([brand]));
    localStorage.setItem('vc_active_brand_id', JSON.stringify(brand.id));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
  }, { brand });
  await page.goto('/?app=1');
  // Imagem abstrata de teste, criada localmente sem IA, sem pessoa e sem texto.
  artBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1080;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#2B2158'; ctx.fillRect(0, 0, 1920, 1080);
    for (const [color, x, y, rx, ry, angle] of [['#9D2559', 1870, 750, 220, 380, 0.3], ['#F8701E', 1830, 710, 170, 300, -0.4], ['#28B2D4', 1880, 350, 300, 430, 0.5]]) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, angle, 0, 2 * Math.PI); ctx.fill();
    }
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button', { name: 'Criar um projeto', exact: true }).click();
  const wizard = page.getByRole('region', { name: 'Criar novo projeto', exact: true });
  const next = () => wizard.getByRole('button', { name: 'Continuar', exact: true }).click();
  await wizard.getByRole('radio', { name: /^Apresentação/ }).click();
  await wizard.getByLabel(/^Nome do projeto/).fill(NAME); await next();
  await wizard.getByRole('radio', { name: /^Usar um preset salvo/ }).click();
  await wizard.getByLabel(/^Marca deste projeto/).selectOption(brand.id);
  await expect(wizard.getByText(/1 referências visuais/)).toBeVisible(); await next();
  await wizard.getByLabel(/^Sobre o que vamos criar/).fill(fixture.editorialTopic);
  await wizard.getByLabel(/^Texto de apoio/).fill(source); await next();
  await wizard.getByRole('radio', { name: /^Deixar o Moont organizar/ }).click(); await next();
  await wizard.getByRole('spinbutton', { name: 'Quantidade de slides', exact: true }).fill('10'); await next();
  await wizard.getByRole('group', { name: 'Estilos para começar' }).getByRole('button', { name: /^Livre: o Moont decide/ }).click();
  await wizard.getByRole('radio', { name: /^Gerar texto e imagens/ }).click(); await next();
  await wizard.getByRole('button', { name: 'Criar e gerar 10 slides', exact: true }).click();
  await expect(wizard).toHaveCount(0, { timeout: 70_000 });
  await expect(page.getByRole('region', { name: 'Geração em andamento' })).toHaveCount(0);
  await expect.poll(async () => (await entry(page))?.doc?.slides?.length).toBe(10);
  await expect.poll(async () => {
    const doc = (await entry(page))?.doc;
    return { slide6Failed: doc?.slides?.[5]?.bgImageFailed, qualityIssues: doc?.presentationQuality?.issues };
  }, { message: 'a geração de fotos deve chegar ao timeout simulado do slide 6' }).toMatchObject({ slide6Failed: true });
  await expect.poll(async () => (await entry(page))?.doc?.presentationQuality?.renderCheckStatus, { timeout: 30_000 }).toMatch(/^(passed|needs_attention)$/);
  await page.getByRole('button', { name: 'Salvar projeto agora', exact: true }).click();
  await expect.poll(() => cloud.writes.some(item => item.name === NAME && item.doc.slides?.length === 10 && item.doc.slides[5].bgImageFailed), { timeout: 30_000 }).toBe(true);
  const saved = (await entry(page)).doc;
  const remote = cloud.rows.get((await entry(page)).id).entry.doc;
  const cards = page.locator('main [data-vc-card-surface]');
  // Reabrir também garante que as capturas retratam o projeto persistido.
  await page.reload();
  await enterEditorFromHome(page, NAME);
  await expect(cards).toHaveCount(10);
  await expect.poll(async () => designSnapshot((await entry(page)).doc)).toEqual(designSnapshot(saved));
  // Capturas vêm antes das asserções de defeito: o mesmo teste deixa prova
  // integral quando falha na main c188ac7, e quando passa após a correção.
  await captureDeck(page, directory);
  if (directory) fs.writeFileSync(path.join(directory, 'persistido.json'), JSON.stringify({ local: saved, cloud: remote, textRepairs, imageRequests: images.map(item => ({ usageContext: item.usageContext, prompt: item.prompt })) }, null, 2));
  await testInfo.attach('reparo-textual-simulado', { body: JSON.stringify(textRepairs, null, 2), contentType: 'application/json' });
  await testInfo.attach('estado-persistido', { body: JSON.stringify({ local: designSnapshot(saved), cloud: designSnapshot(remote) }, null, 2), contentType: 'application/json' });

  await assertDirectedImageRequests({ page, testInfo,
    tag: `apresentacao-${recovery.toLowerCase()}${cleanArt ? '-sem-grafismos' : ''}-${V2 ? 'v2' : 'legado'}`,
    requests: images, plans: fixture.presentationPlan.slides,
    expectedReferences: Object.fromEntries(fixture.presentationPlan.slides.map((_, index) =>
      [index + 1, [`data:image/png;base64,${flyer}`]])),
  });

  expect.soft(prompts[0]).toContain('presentation-plan-v3');
  expect.soft(prompts.some(prompt => prompt.includes('PLANO EDITORIAL VALIDADO'))).toBe(true);
  expect.soft(saved.visualPreset).toBe('presentation_free');
  expect.soft(saved.styleKit.referencePalette.colors).toEqual(fixture.styleKit.referencePalette.colors);
  expect.soft(saved.presentationQuality?.renderedIssues || [], 'nenhum erro de diagramação no render final').toEqual([]);
  for (const [where, doc] of [['local', saved], ['conta', remote]]) {
    expect.soft(doc.presentationDeckDesign.palette.bg, `${where}: a base precisa ser índigo`).toBe('#2B2158');
    expect.soft(doc.presentationPlan.visualDirection.palette.find(color => color.role === 'base')?.hex, `${where}: base da direção visual`).toBe('#2B2158');
    for (let i = 1; i < 10; i++) expect.soft(doc.slides[i].eyebrow || '', `${where}: chapéu do slide ${i + 1}`).toMatch(/\S/);
    for (const [index, label] of [[3, 'O ENCONTRO'], [4, 'A MÚSICA'], [5, 'O PÚBLICO']]) {
      expect.soft(doc.slides[index].eyebrow, `${where}: chapéu segue o assunto do slide ${index + 1}`).toBe(label);
    }
    expect.soft(doc.slides[7].presentationDesignFamily, `${where}: respeitar Suíço`).toBe('swiss');
    expect.soft(doc.slides[7].presentationBlocks?.[0]?.rows || [], `${where}: sete pares da personalidade`).toHaveLength(7);
    expect.soft(doc.slides[5].presentationFreeDesign.photo, `${where}: foto que falhou recomposta`).toBe('none');
    expect.soft(doc.slides[5].presentationImageFallback, `${where}: falha reversível gravada`).toBeTruthy();
    expect.soft(doc.slides[5].presentationSuppressPhoto, `${where}: foto suprimida durante a falha`).toBe(true);
    expect.soft(doc.slides[5].canvas?.zones?.photo?.w, `${where}: a zona de foto não reserva largura`).toBeLessThanOrEqual(1);
    const art = doc.slides.filter(slide => slide.presentationFreeDesign?.ground === 'art');
    expect.soft(art.length, `${where}: ao menos uma página de arte`).toBeGreaterThanOrEqual(1);
    expect.soft(art.length, `${where}: até três páginas de arte`).toBeLessThanOrEqual(3);
    for (const slide of art) expect.soft(!!(slide.presentationArtImageId || slide.presentationArtImageAssetId || slide.presentationArtImage), `${where}: imagem de arte persistida`).toBe(true);
  }
  const comparisonRows = cards.nth(7).getByRole('table', { name: 'Comparação' }).locator('tbody tr');
  await expect.soft(comparisonRows).toHaveCount(7);
  const comparisonTexts = await comparisonRows.allTextContents();
  for (const [i, pair] of contrastPairs.entries()) {
    for (const term of pair) expect.soft(comparisonTexts[i] || '', `par ${i + 1} preserva ${term}`).toContain(term);
  }
  expect.soft((await cards.allTextContents()).join('\n')).not.toMatch(/CENA\s*\d+/i);
  await expect.soft(cards.nth(5).locator('[data-vc-photo-zone], [data-vc-photo-placeholder]')).toHaveCount(0);
  const sixthZones = saved.slides[5].canvas?.zones || {};
  const textZones = ['title', 'subtitle', 'bodyAfterImage'].filter(key => saved.slides[5][key]?.trim())
    .map(key => sixthZones[key]).filter(zone => zone && zone.w > 0);
  const textSpan = textZones.length ? Math.max(...textZones.map(zone => zone.x + zone.w)) - Math.min(...textZones.map(zone => zone.x)) : 0;
  expect.soft(textSpan, 'as zonas de texto ocupam a largura recuperada da foto').toBeGreaterThanOrEqual(65);
  const artCount = saved.slides.filter(slide => slide.presentationFreeDesign?.ground === 'art').length;
  await expect.soft(cards.locator('[data-vc-deck-art]')).toHaveCount(artCount);
  expect.soft(images.filter(item => item.usageContext?.cardId === 'deck-art')).toHaveLength(1);
  if (cleanArt) {
    const artPrompt = images.find(item => item.usageContext?.cardId === 'deck-art')?.prompt || '';
    expect.soft(artPrompt, 'arte segue o acabamento do projeto').toContain('Smooth flat color, no grain or print texture');
    expect.soft(artPrompt, 'ausência de grafismos chega ao pedido final').toMatch(/no graphic interventions/i);
    expect.soft(artPrompt, 'não impõe a linguagem da Apoteose').not.toMatch(/one single large organic graphic shape|with fine, even grain|Screen-print texture, abstract graphic language/i);
  }
  expect.soft(images.filter(item => [3, 8, 10].includes(item.usageContext?.cardNumber)), 'página sem foto não solicita foto').toHaveLength(0);
  const warning = page.getByRole('region', { name: 'Imagens não geradas', exact: true });
  await expect.soft(warning).toBeVisible();
  await expect.soft(warning).toContainText(/slide 6/i);
  expect.soft(runtimeErrors).toEqual([]);

  const imagesBeforeRecovery = images.length;
  if (recovery === 'IA') {
    // A recuperação usa o botão do aviso e uma nova resposta da IA simulada.
    allowSlide6 = true;
    await page.getByRole('button', { name: 'Gerar imagem do slide 6', exact: true }).click({ timeout: 5000 });
  } else {
    // Outra geração inteira: importar a própria foto também sai do fallback.
    await page.getByLabel('Ir para o card', { exact: true }).selectOption('5');
    await page.getByRole('tab', { name: 'Imagem', exact: true }).click();
    await page.getByLabel('Importar foto no slide 6', { exact: true }).setInputFiles({
      name: 'foto-do-usuario.webp', mimeType: 'image/webp', buffer: Buffer.from(photo, 'base64'),
    });
  }
  await expect.poll(async () => (await entry(page))?.doc.slides[5].bgImageFailed).toBe(false);
  await expect.poll(async () => (await entry(page))?.doc.slides[5].presentationFreeDesign.photo).toBe(fixture.presentationPlan.slides[5].design.photo);
  const recovered = (await entry(page)).doc;
  expect(recovered.slides[5].bgImageSource).toBe(recovery === 'IA' ? 'ai' : 'imported');
  expect(images.length - imagesBeforeRecovery, 'importar foto própria não solicita IA').toBe(recovery === 'IA' ? 1 : 0);
  expect(recovered.slides[5].presentationImageFallback).toBeFalsy();
  expect(recovered.slides[5].bgImageId || recovered.slides[5].bgImageAssetId).toBeTruthy();
  for (const field of ['title', 'subtitle', 'bodyAfterImage', 'eyebrow', 'presentationBlocks']) {
    expect(recovered.slides[5][field], `recuperação preserva ${field}`).toEqual(saved.slides[5][field]);
  }
  await expect(warning).toHaveCount(0);
  await expect(cards.nth(5).locator('[data-vc-photo-zone]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Salvar projeto agora', exact: true }).click();
  await expect.poll(() => {
    const doc = cloud.rows.get((cloud.writes.find(item => item.name === NAME) || {}).id)?.entry.doc;
    return doc ? designSnapshot(doc) : null;
  }).toEqual(designSnapshot(recovered));
  await page.reload();
  await enterEditorFromHome(page, NAME);
  await expect(cards).toHaveCount(10);
  await expect.poll(async () => designSnapshot((await entry(page)).doc)).toEqual(designSnapshot(recovered));
  await expect(warning).toHaveCount(0);
  if (directory) {
    await captureDeck(page, path.join(directory, 'recuperado'));
    fs.writeFileSync(path.join(directory, 'recuperado.json'), JSON.stringify(designSnapshot(recovered), null, 2));
  } else if (qaRoot) {
    await captureDeck(page, path.join(qaRoot, 'upload'), 'slide', [5]);
    fs.writeFileSync(path.join(qaRoot, 'upload', 'recuperado.json'), JSON.stringify(designSnapshot(recovered), null, 2));
  }
});
}
