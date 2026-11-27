// Apoteose8: assistente -> plano real10 -> redação reconstruída -> fotos ->
// revisão renderizada -> salvar/reabrir -> PDF real de dez páginas.
// As APIs são simuladas. A mídia vem dos mesmos ativos/harness dos testes A/B.
// Este teste prova layout, conteúdo e persistência; não aprova estética de IA.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { mockOutfitFont } from './helpers/outfit-font.js';
import { presentationBatch } from './helpers/presentation-batches.js';
import { enterEditorFromHome } from './helpers/project-entry.js';
import { socialFreeCloud, localSocialAssets, contrastRatio } from './helpers/social-free-harness.js';
import { teste8, teste8Plan, teste8Draft, teste8Pairs, teste8Provenance, captureTeste8Deck } from './helpers/apoteose-teste8-harness.js';
import { APOTEOSE_REFERENCE_VISUAL_ANALYSIS, referenceVisualAnalysisReply, referenceVisualRequestFacts } from './helpers/reference-visual-analysis.js';

const V2 = process.env.VITE_PROJECTS_V2 === 'true';
const NAME = 'Apoteose — regressão do Teste 8';
const REF_ID = 'apoteose-teste8-referencia';
const flyer = fs.readFileSync(new URL('../fixtures/apoteose-flyer-referencia.png', import.meta.url)).toString('base64');
const photo = fs.readFileSync(new URL('../../public/landing/moont-v3/source/02-crossing-evening.webp', import.meta.url)).toString('base64');
const session = { ...SESSAO_ATIVA, tier: 'creator', imageQuota: { limit: 50, used: 0, remaining: 50 } };
const completion = value => ({ choices: [{ message: { content: JSON.stringify(value) } }] });
const plain = value => String(value || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const readEntry = (page, name = NAME) => page.evaluate(name => JSON.parse(localStorage.getItem('vc_library') || '[]')
  .find(project => project.name === name), name);
const REFERENCE_CONTENT_ID = 'original_' + createHash('sha256').update('data:image/png;base64,' + flyer).digest('hex');

// Só o kit da referência chega à conta vazia. Os tamanhos/offsets manuais da
// versão20, o documento final e os IDs reais do projeto nunca são semeados.
const brand = { id: 'apoteose-teste8-brand', name: 'Apoteose — referência do Teste 8', styleKit: {
  ...teste8.doc.styleKit,
  referencePalette: { colors: teste8.doc.styleKit.referencePalette.colors, refIds: [REF_ID] },
  refImages: [{ id: REF_ID, assetId: REF_ID, name: 'Flyer Apoteose', dataUrl: 'data:image/png;base64,' + flyer }],
} };

const snapshot = doc => ({
  fmt: doc.fmt, productKind: doc.productKind, visualPreset: doc.visualPreset,
  plan: doc.presentationPlan, deck: doc.presentationDeckDesign,
  fonts: { title: doc.brand?.titleFont, subtitle: doc.brand?.subtitleFont, body: doc.brand?.bodyFont },
  quality: { issues: doc.presentationQuality?.issues, renderedIssues: doc.presentationQuality?.renderedIssues,
    reviewStatus: doc.presentationQuality?.reviewStatus, renderCheckStatus: doc.presentationQuality?.renderCheckStatus,
    renderRepairStatus: doc.presentationQuality?.renderRepairStatus },
  slides: doc.slides.map(slide => ({
    id: slide.id, title: slide.title, subtitle: slide.subtitle, bodyAfterImage: slide.bodyAfterImage,
    eyebrow: slide.eyebrow, family: slide.presentationDesignFamily, design: slide.presentationFreeDesign,
    canvas: slide.canvas, blocks: slide.presentationBlocks, imageQuery: slide.imageQuery,
    composition: slide.presentationComposition, suppress: slide.presentationSuppressPhoto,
    photo: !!(slide.bgImageAssetId || slide.bgImageId || slide.bgImage), source: slide.bgImageSource || null,
    art: !!(slide.presentationArtImageAssetId || slide.presentationArtImageId || slide.presentationArtImage),
    fallback: slide.presentationImageFallback || null, failed: !!slide.bgImageFailed,
  })),
});

const referenceState = doc => ({
  refs: (doc.styleKit?.refImages || []).map(({ id, imageId, assetId }) => ({ id, imageId, assetId })),
  record: doc.styleKit?.referenceVisual || null,
  planAnalysis: doc.presentationPlan?.referenceVisualAnalysis || null,
});

function assertSavedReferenceIdentity(doc, label) {
  const state = referenceState(doc), record = state.record;
  expect.soft(record, label + ': record preservado').toBeTruthy();
  expect.soft(record?.contentIds, label + ': identidade dos bytes originais').toEqual([REFERENCE_CONTENT_ID]);
  expect.soft(record?.refIds, label + ': vínculo na representação atual').toEqual(state.refs.map(ref => ref.assetId || ref.imageId || ref.id));
  expect.soft(record?.briefKey, label + ': contexto editorial preservado').toMatch(/^[a-f0-9]{16}$/);
  expect.soft(record?.analysis?.synthesis, label + ': síntese no record').toBe(APOTEOSE_REFERENCE_VISUAL_ANALYSIS.synthesis);
  expect.soft(state.planAnalysis?.synthesis, label + ': síntese associada ao plano').toBe(APOTEOSE_REFERENCE_VISUAL_ANALYSIS.synthesis);
}

async function openTeste8Account(page) {
  await page.addInitScript(({ brand }) => {
    if (sessionStorage.getItem('teste8-started')) return;
    sessionStorage.setItem('teste8-started', '1');
    localStorage.setItem('vc_library', '[]');
    localStorage.setItem('vc_brands', JSON.stringify([brand]));
    localStorage.setItem('vc_active_brand_id', JSON.stringify(brand.id));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
  }, { brand });
  await page.goto('/?app=1');
  const cookieChoices = page.getByRole('dialog', { name: 'Cookies de medição', exact: true });
  if (await cookieChoices.isVisible()) await cookieChoices.getByRole('button', { name: 'Recusar', exact: true }).click();
}

async function startTeste8Generation(page, name = NAME) {
  await page.getByRole('button', { name: 'Criar um projeto', exact: true }).click();
  const wizard = page.getByRole('region', { name: 'Criar novo projeto', exact: true });
  const next = () => wizard.getByRole('button', { name: 'Continuar', exact: true }).click();
  await wizard.getByRole('radio', { name: /^Apresentação/ }).click();
  await wizard.getByLabel(/^Nome do projeto/).fill(name); await next();
  await wizard.getByRole('radio', { name: /^Usar um preset salvo/ }).click();
  await wizard.getByLabel(/^Marca deste projeto/).selectOption(brand.id);
  await expect(wizard.getByText(/1 referências visuais/)).toBeVisible(); await next();
  await wizard.getByLabel(/^Sobre o que vamos criar/).fill(teste8.doc.editorialContext.topic);
  await wizard.getByLabel(/^Texto de apoio/).fill(teste8.doc.material.content); await next();
  await wizard.getByRole('radio', { name: /^Deixar o Moont organizar/ }).click(); await next();
  await wizard.getByRole('spinbutton', { name: 'Quantidade de slides', exact: true }).fill('10'); await next();
  await wizard.getByRole('group', { name: 'Estilos para começar' }).getByRole('button', { name: /^Livre: o Moont decide/ }).click();
  await wizard.getByRole('radio', { name: /^Gerar texto e imagens/ }).click(); await next();
  await wizard.getByRole('button', { name: 'Criar e gerar 10 slides', exact: true }).click();
  return wizard;
}

async function requestPhotoFromEditor(page, index, regenerate = false) {
  await page.getByLabel('Ir para o card', { exact: true }).selectOption(String(index));
  await page.getByRole('tab', { name: 'Imagem', exact: true }).click();
  const generate = page.getByRole('button', { name: regenerate ? 'Regenerar imagem' : 'Gerar imagem', exact: true }).first();
  if (!(await generate.isVisible())) await page.getByRole('button', { name: /^Direção$/ }).first().click();
  await generate.click();
}

async function supportTextFacts(card) {
  return card.evaluate(root => {
    const node = root.querySelector('[data-vc-support-text="true"]');
    const rgb = value => {
      const parts = value.match(/[\d.]+/g)?.map(Number);
      return parts?.length >= 3 ? { rgb: parts.slice(0, 3), alpha: parts[3] ?? 1 } : null;
    };
    const box = element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const frame = box(root), zone = box(node.closest('[data-vc-zone="subtitle"]'));
    const range = document.createRange(); range.selectNodeContents(node);
    const boxes = [...range.getClientRects()].filter(rect => rect.width && rect.height)
      .map(rect => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }));
    const contains = (outer, inner) => inner.left >= outer.left - 1 && inner.top >= outer.top - 1
      && inner.right <= outer.right + 1 && inner.bottom <= outer.bottom + 1;
    let background = null, opacity = 1;
    for (let current = node; current; current = current.parentElement) {
      const style = getComputedStyle(current), surface = rgb(style.backgroundColor);
      opacity *= Number(style.opacity);
      if (!background && surface?.alpha === 1) background = surface.rgb;
      if (current === root) break;
    }
    return { text: node.textContent.trim(), color: rgb(getComputedStyle(node).color), background, opacity,
      frame, zone, boxes, clipped: boxes.some(rect => !contains(frame, rect) || !contains(zone, rect)) };
  });
}

async function renderFacts(card) {
  return card.evaluate(root => {
    const frame = root.getBoundingClientRect(), unit = 1920 / root.offsetWidth;
    const rect = value => ({ x: value.left - frame.left, y: value.top - frame.top,
      w: value.width, h: value.height, right: value.right - frame.left, bottom: value.bottom - frame.top });
    const photo = root.querySelector('[data-vc-photo-zone]');
    const block = root.querySelector('[data-vc-quality-zone="evidence"]');
    const photoRect = photo ? rect(photo.getBoundingClientRect()) : null;
    const blockRect = block ? rect(block.getBoundingClientRect()) : null;
    const photoPainted = !!photo && [photo, ...photo.querySelectorAll('*')].some(node =>
      getComputedStyle(node).backgroundImage !== 'none'
        || (node.tagName === 'IMG' && node.complete && node.naturalWidth > 0));
    const cells = block ? [...block.querySelectorAll('[data-vc-evidence-cell]')].map(cell => {
      const range = document.createRange(); range.selectNodeContents(cell);
      const boxes = [...range.getClientRects()].filter(box => box.width && box.height).map(rect);
      return { text: cell.textContent, fontPx: parseFloat(getComputedStyle(cell).fontSize) * unit,
        header: !!cell.closest('th'), boxes };
    }) : [];
    const contains = (outer, inner) => inner.x >= outer.x - 1 && inner.y >= outer.y - 1
      && inner.right <= outer.right + 1 && inner.bottom <= outer.bottom + 1;
    const frameRect = { x: 0, y: 0, right: frame.width, bottom: frame.height };
    const clipped = cells.filter(cell => cell.boxes.some(box =>
      !contains(blockRect, box) || !contains(frameRect, box))).map(cell => cell.text);
    const intersection = photoRect && blockRect
      ? Math.max(0, Math.min(photoRect.right, blockRect.right) - Math.max(photoRect.x, blockRect.x))
        * Math.max(0, Math.min(photoRect.bottom, blockRect.bottom) - Math.max(photoRect.y, blockRect.y)) : 0;
    return { width: frame.width, height: frame.height, photo: photoRect, photoPainted,
      photoArea: photoRect ? photoRect.w * photoRect.h / (frame.width * frame.height) : 0,
      block: blockRect, clipped, cells, photoBlockIntersection: intersection,
      blockScrollOverflow: block ? { x: block.scrollWidth - block.clientWidth, y: block.scrollHeight - block.clientHeight } : null };
  });
}

test('Teste 8: geração inteira conserva música com foto, público amplo e sete pares exportáveis (' + (V2 ? 'V2' : 'legado') + ')', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const directory = process.env.QA_TESTE8_OUTPUT_DIR || testInfo.outputPath('apoteose-teste8');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'proveniencia.json'), JSON.stringify(teste8Provenance, null, 2));
  await testInfo.attach('proveniencia-do-rascunho', { body: JSON.stringify(teste8Provenance, null, 2), contentType: 'application/json' });
  const { cloud, routes } = socialFreeCloud({ brand, session, useV2: V2 });
  const prompts = [], images = [], visualRequests = [], runtimeErrors = [];
  let art = '';
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol)
      ? route.continue() : route.abort('blockedbyclient');
  });
  await mockApi(page, { session, extra: {
    ...routes,
    '/api/ai/compatible': route => {
      const body = route.request().postDataJSON();
      const content = body.payload.messages.find(message => message.role === 'user')?.content;
      const prompt = Array.isArray(content) ? content.filter(part => part.type === 'text').map(part => part.text).join('\n') : String(content || '');
      prompts.push({ prompt, purpose: body.usageContext?.purpose || body.purpose || null, provider: body.provider || null });
      if (body.purpose === 'reference_visual_analysis') {
        visualRequests.push(referenceVisualRequestFacts(body));
        return route.fulfill({ json: completion(referenceVisualAnalysisReply()) });
      }
      const value = prompt.startsWith('PLANEJAMENTO ESTRUTURADO') ? structuredClone(teste8Plan)
        : /^(REVISÃO|REPARO)/.test(prompt) ? { edits: [] }
          : { slides: presentationBatch(prompt, structuredClone(teste8Draft)), caption: teste8Plan.signature };
      return route.fulfill({ json: completion(value) });
    },
    '/api/ai/sjinn-image': route => {
      const body = route.request().postDataJSON(); images.push(body);
      const isArt = body.usageContext?.cardId === 'deck-art';
      return route.fulfill({ json: { b64_json: isArt ? art : photo, mime: isArt ? 'image/png' : 'image/webp' } });
    },
  } });
  await mockOutfitFont(page);
  await openTeste8Account(page);
  art = (await localSocialAssets(page)).art;
  const wizard = await startTeste8Generation(page);
  await expect(wizard).toHaveCount(0, { timeout: 70_000 });
  await expect(page.getByRole('region', { name: 'Geração em andamento' })).toHaveCount(0);
  await expect.poll(async () => (await readEntry(page))?.doc?.slides?.length).toBe(10);
  await expect.poll(async () => (await readEntry(page))?.doc?.presentationQuality?.renderCheckStatus, { timeout: 30_000 })
    .toMatch(/^(passed|needs_attention)$/);
  await page.getByRole('button', { name: 'Salvar projeto agora', exact: true }).click();
  await expect.poll(() => cloud.writes.some(entry => entry.name === NAME && entry.doc.slides?.length === 10), { timeout: 30_000 }).toBe(true);
  const localEntry = await readEntry(page), saved = localEntry.doc;
  await expect.poll(() => {
    const doc = cloud.rows.get(localEntry.id)?.entry?.doc;
    return doc ? snapshot(doc) : null;
  }).toEqual(snapshot(saved));
  const remote = structuredClone(cloud.rows.get(localEntry.id).entry.doc);
  const requests = images.map(({ imageList, ...request }) => ({ ...request,
    references: (imageList || []).map(value => ({ chars: value.length, sha256: createHash('sha256').update(value).digest('hex') })) }));
  fs.writeFileSync(path.join(directory, 'persistido.json'), JSON.stringify({ local: saved, cloud: remote, prompts, visualRequests, imageRequests: requests }, null, 2));
  await testInfo.attach('estado-persistido', { body: JSON.stringify({ local: snapshot(saved), cloud: snapshot(remote), imageRequests: requests }, null, 2), contentType: 'application/json' });
  await testInfo.attach('analise-visual-simulada', { body: JSON.stringify({ requests: visualRequests, response: referenceVisualAnalysisReply(), simulated: true }, null, 2), contentType: 'application/json' });

  // Reabrir pelo caminho público antes da inspeção: a mídia é hidratada a
  // partir dos bytes salvos pelo próprio app no IndexedDB/API simulada.
  await page.reload();
  await enterEditorFromHome(page, NAME);
  const cards = page.locator('main [data-vc-card-surface]');
  await expect(cards).toHaveCount(10);
  await expect.poll(async () => snapshot((await readEntry(page)).doc)).toEqual(snapshot(saved));
  const reopened = (await readEntry(page)).doc;
  for (const [label, doc] of [['local salvo', saved], ['nuvem', remote], ['reaberto', reopened]]) assertSavedReferenceIdentity(doc, label);
  expect.soft(reopened.styleKit.refImages[0].assetId, 'asset original reidratado').toBe(REFERENCE_CONTENT_ID);
  expect.soft(reopened.styleKit.refImages[0].imageId, 'imagem local reidratada').toMatch(/^img_/);
  expect.soft(reopened.styleKit.referenceVisual?.briefKey).toBe(saved.styleKit.referenceVisual?.briefKey);
  await page.evaluate(() => document.fonts.ready);
  await captureTeste8Deck(page, path.join(directory, 'capturas'));
  const geometry = {
    music: await renderFacts(cards.nth(3)),
    audience: await renderFacts(cards.nth(4)),
    comparison: await renderFacts(cards.nth(6)),
  };
  fs.writeFileSync(path.join(directory, 'geometria.json'), JSON.stringify(geometry, null, 2));
  await testInfo.attach('geometria-renderizada', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });

  expect.soft(prompts.some(item => item.prompt.startsWith('PLANEJAMENTO ESTRUTURADO') && item.prompt.includes('presentation-plan-v3'))).toBe(true);
  expect.soft(visualRequests, 'uma análise multimodal antes do plano; nenhuma leitura inferida só da paleta').toHaveLength(1);
  expect.soft(prompts.findIndex(item => item.purpose === 'reference_visual_analysis')).toBeLessThan(prompts.findIndex(item => item.prompt.startsWith('PLANEJAMENTO ESTRUTURADO')));
  expect.soft(visualRequests[0]).toMatchObject({ provider: 'zai', operation: 'chat', purpose: 'reference_visual_analysis',
    model: 'glm-4.6v', maxTokens: 3500, thinking: { type: 'disabled' } });
  expect.soft(visualRequests[0]?.images, 'a análise recebe o anexo real do kit').toHaveLength(1);
  for (const image of visualRequests[0]?.images || []) {
    expect.soft(image.validSignature).toBe(true); expect.soft(image.bytes).toBeGreaterThan(1000);
    expect.soft(image.chars).toBeLessThanOrEqual(360000);
  }
  expect.soft(prompts.find(item => item.prompt.startsWith('PLANEJAMENTO ESTRUTURADO'))?.prompt,
    'a evidência simulada entra no planejamento').toContain(APOTEOSE_REFERENCE_VISUAL_ANALYSIS.synthesis);
  expect.soft(prompts.some(item => item.prompt.includes('PLANO EDITORIAL VALIDADO'))).toBe(true);
  expect.soft(prompts.some(item => item.prompt.startsWith('REVISÃO'))).toBe(true);
  expect.soft(images.filter(item => item.usageContext?.cardId !== 'deck-art').map(item => item.usageContext.cardNumber).sort((a, b) => a - b),
    'as cinco fotos pedidas pelo roteiro chegam ao HTTP, inclusive música com icons').toEqual([1, 3, 4, 5, 10]);
  expect.soft(images.filter(item => item.usageContext?.cardId === 'deck-art'), 'uma arte compartilhada').toHaveLength(1);
  for (const image of images.filter(item => item.usageContext?.cardId !== 'deck-art')) {
    expect.soft(image.prompt, 'síntese visual no pedido real da foto ' + image.usageContext?.cardNumber).toContain(APOTEOSE_REFERENCE_VISUAL_ANALYSIS.synthesis);
  }
  const artPrompt = images.find(item => item.usageContext?.cardId === 'deck-art')?.prompt || '';
  expect.soft(artPrompt, 'o acabamento da análise chega à arte').toContain(APOTEOSE_REFERENCE_VISUAL_ANALYSIS.direction.background.finish);
  expect.soft(artPrompt, 'a linguagem gráfica da análise chega à arte').toContain(APOTEOSE_REFERENCE_VISUAL_ANALYSIS.direction.background.graphics);
  for (const [where, doc] of [['local', saved], ['conta', remote]]) {
    expect.soft(doc.visualPreset, where).toBe('presentation_free');
    expect.soft(doc.presentationPlan.slides, where + ': roteiro completo').toHaveLength(10);
    expect.soft(doc.slides, where + ': nenhuma página foi apagada para exportar').toHaveLength(10);
    expect.soft(doc.presentationQuality.renderedIssues || [], where + ': nenhuma composição bloqueada').toEqual([]);
    expect.soft(doc.presentationQuality.renderCheckStatus, where).toBe('passed');
    expect.soft(doc.presentationDeckDesign.palette.bg, where + ': base cromática extraída').toBe('#2A2158');
    expect.soft(doc.slides[3].presentationFreeDesign.photo, where + ': música mantém a foto planejada').toBe('small');
    expect.soft(doc.slides[3].presentationSuppressPhoto, where + ': foto de música não suprimida').toBe(false);
    expect.soft(doc.slides[3].presentationBlocks?.[0]?.items, where + ': icons preservados').toEqual(teste8Draft[3].presentationBlocks[0].items);
    expect.soft(doc.slides[4].presentationFreeDesign.photo, where + ': público mantém foto grande').toBe('half');
    const audiencePhoto = doc.slides[4].canvas?.zones?.photo;
    expect.soft(audiencePhoto ? audiencePhoto.w * audiencePhoto.h / 10_000 : 0, where + ': área da foto do público').toBeGreaterThanOrEqual(0.30);
    expect.soft(doc.slides[6].presentationDesignFamily, where + ': família planejada da tabela').toBe('executive');
    expect.soft(doc.slides[6].presentationBlocks?.[0]?.rows || [], where + ': sete pares preservados').toEqual(teste8Pairs);
    expect.soft(plain(doc.slides[6].title), where + ': título transcrito da captura preservado').toBe(teste8Draft[6].title);
    expect.soft(plain(doc.slides[6].subtitle), where + ': introdução da tabela preservada').toBe(teste8Draft[6].subtitle);
    expect.soft(doc.styleKit.referenceVisual?.analysis?.synthesis, where + ': análise persistida com a referência').toBe(APOTEOSE_REFERENCE_VISUAL_ANALYSIS.synthesis);
    expect.soft(doc.presentationPlan.referenceVisualAnalysis?.synthesis, where + ': análise associada ao roteiro').toBe(APOTEOSE_REFERENCE_VISUAL_ANALYSIS.synthesis);
    for (const index of [0, 2, 3, 4, 9]) {
      expect.soft(!!(doc.slides[index].bgImageAssetId || doc.slides[index].bgImageId || doc.slides[index].bgImage), where + ': mídia do slide ' + (index + 1)).toBe(true);
      expect.soft(doc.slides[index].bgImageFailed, where + ': nenhuma falha simulada de imagem').not.toBe(true);
    }
    for (const source of teste8.doc.slides) {
      const actual = doc.slides[source.presentationPlan.index - 1];
      for (const key of ['title', 'subtitle', 'bodyAfterImage']) {
        expect.soft(plain(actual[key]), where + ': texto observado preservado, página ' + source.presentationPlan.index + ', ' + key).toBe(plain(source[key]));
      }
    }
  }
  const rows = cards.nth(6).getByRole('table', { name: 'Comparação' }).locator('tbody tr');
  await expect.soft(rows).toHaveCount(7);
  const rowTexts = await rows.allTextContents();
  for (const [index, pair] of teste8Pairs.entries()) {
    for (const value of pair) expect.soft(plain(rowTexts[index]).toLowerCase(), 'par ' + (index + 1)).toContain(plain(value).toLowerCase());
  }
  expect.soft(geometry.comparison.clipped, 'todas as células cabem na evidence e no slide').toEqual([]);
  expect.soft(geometry.comparison.blockScrollOverflow?.x || 0, 'tabela sem transbordamento horizontal').toBeLessThanOrEqual(1);
  expect.soft(geometry.comparison.blockScrollOverflow?.y || 0, 'tabela sem transbordamento vertical').toBeLessThanOrEqual(1);
  for (const cell of geometry.comparison.cells.filter(cell => !cell.header)) {
    expect.soft(cell.fontPx, 'piso da tabela: ' + cell.text).toBeGreaterThanOrEqual(27.9);
  }
  await expect.soft(cards.nth(3).locator('[data-vc-photo-zone]')).toHaveCount(1);
  await expect.soft(cards.nth(4).locator('[data-vc-photo-zone]')).toHaveCount(1);
  expect.soft(geometry.music.photoPainted, 'a foto da música está pintada no DOM').toBe(true);
  expect.soft(geometry.music.photoBlockIntersection, 'foto da música não cobre icons').toBeLessThanOrEqual(1);
  expect.soft(geometry.music.clipped, 'textos dos icons completos').toEqual([]);
  expect.soft(geometry.audience.photoPainted, 'a foto do público está pintada no DOM').toBe(true);
  expect.soft(geometry.audience.photoArea, 'foto grande do público no DOM').toBeGreaterThanOrEqual(0.30);
  expect.soft((await cards.allTextContents()).join('\n')).not.toMatch(/CENA\s*\d+/i);
  expect.soft(runtimeErrors).toEqual([]);

  // O exportador real precisa aceitar as dez páginas, sem exclusão, cortes
  // de pares, redução abaixo do piso ou edição posterior pelo teste.
  await page.getByRole('button', { name: 'Opções de download', exact: true }).click();
  const downloading = page.waitForEvent('download', { timeout: 60_000 }).then(download => ({ download }), error => ({ error: error.message }));
  await page.getByRole('menuitem', { name: 'Apresentação em PDF', exact: true }).click();
  const blocked = page.getByText(/^Slide \d+: /).first();
  const result = await Promise.race([downloading, blocked.waitFor({ timeout: 60_000 }).then(async () => ({ blocked: await blocked.textContent() }), () => new Promise(() => {}))]);
  expect(result.blocked, 'exportação não pode ser barrada por composição').toBeUndefined();
  expect(result.error, 'download real do PDF').toBeUndefined();
  expect(result.download?.suggestedFilename()).toMatch(/\.pdf$/);
  const chunks = [];
  for await (const chunk of await result.download.createReadStream()) chunks.push(chunk);
  const pdf = Buffer.concat(chunks), content = pdf.toString('latin1');
  expect(content.startsWith('%PDF-')).toBe(true);
  expect(content.match(/\/Type \/Page\b/g), 'PDF inclui todas as dez páginas').toHaveLength(10);
  const mediaBox = content.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
  expect(mediaBox).toBeTruthy();
  expect(Number(mediaBox[1]) / Number(mediaBox[2])).toBeCloseTo(16 / 9, 3);
  fs.writeFileSync(path.join(directory, 'apoteose-teste8.pdf'), pdf);
  await testInfo.attach('apresentacao-exportada', { body: pdf, contentType: 'application/pdf' });
  expect(snapshot((await readEntry(page)).doc), 'exportar conserva texto, fotos, ordem e composição').toEqual(snapshot(saved));

  // A foto precisa reutilizar a análise do kit já empacotado/reidratado.
  // Não basta haver um objeto antigo no documento: a síntese deve chegar ao
  // pedido novo e nenhuma chamada de visão pode ser usada para disfarçar a perda.
  const imageCount = images.length, visionCount = visualRequests.length;
  await requestPhotoFromEditor(page, 4, true);
  await expect.poll(() => images.length).toBe(imageCount + 1);
  await expect(page.getByRole('region', { name: 'Geração em andamento' })).toHaveCount(0);
  const regeneration = images.at(-1), afterRegeneration = (await readEntry(page)).doc;
  fs.writeFileSync(path.join(directory, 'referencia-apos-reabrir.json'), JSON.stringify({ saved: referenceState(saved), cloud: referenceState(remote),
    reopened: referenceState(reopened), regenerated: referenceState(afterRegeneration), visualRequests,
    imageRequest: { usageContext: regeneration.usageContext, prompt: regeneration.prompt } }, null, 2));
  expect(regeneration.usageContext.cardNumber).toBe(5);
  expect(regeneration.prompt, 'regeneração após reabrir conserva a síntese').toContain(APOTEOSE_REFERENCE_VISUAL_ANALYSIS.synthesis);
  expect(visualRequests.length, 'regeneração reutiliza o record válido').toBe(visionCount);
  expect(visionCount).toBe(1);
  assertSavedReferenceIdentity(afterRegeneration, 'após regenerar');
  expect(snapshot(afterRegeneration), 'regeneração conserva conteúdo, composição e ordem').toEqual(snapshot(saved));
});

test('Teste 8: cancelar após primeiro lote, abrir rascunho e reabrir conserva a análise para gerar foto (' + (V2 ? 'V2' : 'legado') + ')', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const name = 'Apoteose — rascunho visual do Teste 8';
  const directory = path.join(process.env.QA_TESTE8_OUTPUT_DIR || testInfo.outputPath('apoteose-teste8'), 'rascunho-cancelado');
  fs.mkdirSync(directory, { recursive: true });
  const { cloud, routes } = socialFreeCloud({ brand, session, useV2: V2 });
  const visualRequests = [], images = [], prompts = [], runtimeErrors = [];
  let draftCalls = 0, secondBatchWaiting = false, releaseSecondBatch;
  const secondBatch = new Promise(resolve => { releaseSecondBatch = resolve; });
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol)
      ? route.continue() : route.abort('blockedbyclient');
  });
  await mockApi(page, { session, extra: {
    ...routes,
    '/api/ai/compatible': async route => {
      const body = route.request().postDataJSON();
      if (body.purpose === 'reference_visual_analysis') {
        visualRequests.push(referenceVisualRequestFacts(body));
        return route.fulfill({ json: completion(referenceVisualAnalysisReply()) });
      }
      const prompt = body.payload.messages.find(message => message.role === 'user')?.content || '';
      prompts.push(prompt);
      if (prompt.startsWith('PLANEJAMENTO ESTRUTURADO')) return route.fulfill({ json: completion(structuredClone(teste8Plan)) });
      if (/^(REVISÃO|REPARO)/.test(prompt)) return route.fulfill({ json: completion({ edits: [] }) });
      draftCalls++;
      if (draftCalls === 2) { secondBatchWaiting = true; await secondBatch; }
      // A resposta atrasada do segundo lote não pode reaparecer após cancelar.
      return route.fulfill({ json: completion({ slides: presentationBatch(prompt, structuredClone(teste8Draft)), caption: teste8Plan.signature }) }).catch(() => {});
    },
    '/api/ai/sjinn-image': route => {
      const body = route.request().postDataJSON(); images.push(body);
      return route.fulfill({ json: { b64_json: photo, mime: 'image/webp' } });
    },
  } });
  await mockOutfitFont(page);
  await openTeste8Account(page);
  const wizard = await startTeste8Generation(page, name);
  try {
    await expect.poll(() => secondBatchWaiting, { message: 'primeiro lote validado antes de cancelar' }).toBe(true);
    await wizard.getByRole('button', { name: 'Cancelar geração', exact: true }).click();
    await expect(wizard.getByRole('button', { name: 'Abrir rascunho no editor', exact: true })).toBeVisible();
  } finally { releaseSecondBatch(); }
  await wizard.getByRole('button', { name: 'Abrir rascunho no editor', exact: true }).click();
  const cards = page.locator('main [data-vc-card-surface]');
  await expect(cards).toHaveCount(3);
  await expect.poll(async () => (await readEntry(page, name))?.doc?.slides?.length).toBe(3);
  expect(images, 'cancelamento antes das imagens não consome geração de foto').toHaveLength(0);
  expect(visualRequests).toHaveLength(1);
  const openedDraft = (await readEntry(page, name)).doc;
  expect(openedDraft.presentationPlan.slides).toHaveLength(10);
  expect(openedDraft.presentationQuality).toMatchObject({ incomplete: true, completedCount: 3, totalCount: 10 });
  for (let index = 0; index < 3; index++) {
    expect(plain(openedDraft.slides[index].title)).toBe(plain(teste8Draft[index].title));
  }
  await page.getByRole('button', { name: 'Salvar projeto agora', exact: true }).click();
  const projectId = (await readEntry(page, name)).id;
  await expect.poll(() => cloud.rows.get(projectId)?.entry?.doc?.slides?.length).toBe(3);
  const remote = structuredClone(cloud.rows.get(projectId).entry.doc);
  await page.reload();
  await enterEditorFromHome(page, name);
  await expect(cards).toHaveCount(3);
  await expect.poll(async () => snapshot((await readEntry(page, name)).doc)).toEqual(snapshot(openedDraft));
  const reopened = (await readEntry(page, name)).doc;
  await page.getByLabel('Ir para o card', { exact: true }).selectOption('0');
  await page.evaluate(() => document.fonts.ready);
  const body = cards.first().locator('[data-vc-support-text="true"]');
  await expect(body, 'frase final presente e visível no rascunho sem foto').toBeVisible();
  await expect(body).toHaveText(plain(reopened.slides[0].bodyAfterImage));
  const draftBody = await supportTextFacts(cards.first());
  fs.writeFileSync(path.join(directory, 'contraste-corpo-rascunho.json'), JSON.stringify(draftBody, null, 2));
  expect(draftBody.color?.alpha, 'tinta opaca do corpo').toBe(1);
  expect(draftBody.background, 'superfície real obtida do DOM').toHaveLength(3);
  expect.soft(contrastRatio(draftBody.color.rgb, draftBody.background), 'frase final lê sobre o fundo sem foto').toBeGreaterThanOrEqual(4.5);
  expect.soft(draftBody.opacity, 'nenhum ancestral esconde o corpo').toBeCloseTo(1, 5);
  expect.soft(draftBody.boxes.length, 'texto possui glifos renderizados').toBeGreaterThan(0);
  expect.soft(draftBody.clipped, 'frase inteira dentro da zona e do card').toBe(false);
  await captureTeste8Deck(page, path.join(directory, 'capturas'), 3);
  await requestPhotoFromEditor(page, 0);
  await expect.poll(() => images.length).toBe(1);
  await expect.poll(async () => (await readEntry(page, name)).doc.slides[0].bgImageSource).toBe('ai');
  const after = (await readEntry(page, name)).doc;
  const proof = { provenance: teste8Provenance, opened: openedDraft, cloud: remote, reopened, after, draftBody,
    visualRequests, prompts, imageRequests: images.map(({ imageList, ...item }) => ({ ...item,
      references: (imageList || []).map(value => ({ chars: value.length, sha256: createHash('sha256').update(value).digest('hex') })) })) };
  fs.writeFileSync(path.join(directory, 'persistido.json'), JSON.stringify(proof, null, 2));
  await testInfo.attach('rascunho-cancelado-e-regeneracao', { body: JSON.stringify(proof, null, 2), contentType: 'application/json' });
  for (const [label, doc] of [['rascunho aberto', openedDraft], ['nuvem', remote], ['reaberto', reopened], ['após foto', after]]) {
    assertSavedReferenceIdentity(doc, label);
  }
  expect.soft(images[0].usageContext.cardNumber).toBe(1);
  expect.soft(images[0].prompt, 'foto após cancelar/abrir/recarregar conserva a síntese visual').toContain(APOTEOSE_REFERENCE_VISUAL_ANALYSIS.synthesis);
  expect.soft(visualRequests, 'o rascunho preserva a análise; não pede uma nova leitura').toHaveLength(1);
  expect.soft(after.slides).toHaveLength(3);
  expect.soft(snapshot(after).slides.slice(1), 'a foto não altera os outros dois slides').toEqual(snapshot(reopened).slides.slice(1));
  for (const key of ['title', 'subtitle', 'bodyAfterImage', 'eyebrow', 'presentationBlocks']) {
    expect.soft(after.slides[0][key], 'foto conserva ' + key).toEqual(reopened.slides[0][key]);
  }
  expect.soft(runtimeErrors).toEqual([]);
});
