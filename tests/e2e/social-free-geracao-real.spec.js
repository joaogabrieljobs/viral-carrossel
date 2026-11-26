// Frente B: o caminho público do assistente, com todas as APIs simuladas.
// A fixture contém somente a resposta editorial da IA, nunca um projeto pronto.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { mockOutfitFont } from './helpers/outfit-font.js';
import { enterEditorFromHome, selectEditorMode } from './helpers/project-entry.js';
import { socialFreeCloud, localSocialAssets, socialRenderGeometry, socialRenderedMedia, contrastRatio, captureSocialDeck } from './helpers/social-free-harness.js';

const session = { ...SESSAO_ATIVA, tier: 'creator', imageQuota: { limit: 50, used: 0, remaining: 50 } };
const fixture = JSON.parse(fs.readFileSync(new URL('../fixtures/apoteose-social-free-8.json', import.meta.url), 'utf8'));
const flyer = fs.readFileSync(new URL('../fixtures/apoteose-flyer-referencia.png', import.meta.url)).toString('base64');
const photo = fs.readFileSync(new URL('../../public/landing/moont-v3/source/01-founder-editorial.webp', import.meta.url)).toString('base64');
const uploadedPhoto = fs.readFileSync(new URL('../../public/landing/moont-v3/source/02-crossing-evening.webp', import.meta.url));
const V2 = process.env.VITE_PROJECTS_V2 === 'true';
const FORMATS = [{ id: 'carrossel', label: 'Feed 4:5', height: 1350, ratio: '4:5' },
  { id: 'quadrado', label: 'Quadrado', height: 1080, ratio: '1:1' },
  { id: 'stories', label: 'Stories', height: 1920, ratio: '9:16' }];
const completion = value => ({ choices: [{ message: { content: JSON.stringify(value) } }] });
const plain = value => String(value || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const savedEntry = (page, name) => page.evaluate(projectName => JSON.parse(localStorage.getItem('vc_library') || '[]')
  .find(entry => entry.name === projectName), name);

const snapshot = doc => ({
  fmt: doc.fmt, mode: doc.mode, visualPreset: doc.visualPreset, material: doc.material,
  brandChrome: Object.fromEntries(['footerPillText', 'footerPillArrow', 'footerBarLeft', 'footerBarCenter', 'footerBarRight',
    'cultureHeaderLeft', 'cultureHeaderCenter', 'cultureHeaderYear', 'logoPosition', 'logoSize', 'logoOpacity'].map(key => [key, doc.brand?.[key] ?? null])),
  topic: doc.editorialContext?.topic, bible: doc.visualBible,
  plan: doc.socialPlan, deck: doc.socialDeckDesign, quality: doc.socialQuality,
  slides: doc.slides.map(slide => ({ id: slide.id, title: slide.title, subtitle: slide.subtitle,
    bodyAfterImage: slide.bodyAfterImage, eyebrow: slide.eyebrow, blocks: slide.presentationBlocks,
    design: slide.socialFreeDesign, plan: slide.socialPlan, deck: slide.socialDeckDesign,
    family: slide.socialFamily, fn: slide.socialFunction, art: slide.socialArt, canvas: slide.canvas,
    bg: slide.customBg, titleColor: slide.titleColor, subtitleColor: slide.subtitleColor,
    textColor: slide.textColor, imageQuery: slide.imageQuery,
    // IndexedDB usa IDs locais; a nuvem troca-os pelo hash do conteúdo.
    // O snapshot preserva presença/fonte. Os bytes são provados separadamente.
    photo: !!(slide.bgImageId || slide.bgImageAssetId || slide.bgImage), source: slide.bgImageSource,
    sharedArt: !!(slide.presentationArtImageId || slide.presentationArtImageAssetId || slide.presentationArtImage),
    logo: !!(slide.logoImageId || slide.logoImageAssetId || slide.logoImage), swipe: slide.showSwipeCue })),
});

async function openEmptyAccount(page, { brand = null, extra = {} } = {}) {
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol)
      ? route.continue() : route.abort('blockedbyclient');
  });
  await mockApi(page, { session, extra });
  await mockOutfitFont(page);
  await page.addInitScript(({ brand }) => {
    if (localStorage.getItem('vc_library') === null) localStorage.setItem('vc_library', '[]');
    if (brand && !sessionStorage.getItem('social-free-account-seeded')) {
      localStorage.setItem('vc_brands', JSON.stringify([brand]));
      localStorage.setItem('vc_active_brand_id', JSON.stringify(brand.id));
      sessionStorage.setItem('social-free-account-seeded', '1');
    }
  }, { brand });
  await page.goto('/?app=1');
  const cookieChoices = page.getByRole('dialog', { name: 'Cookies de medição', exact: true });
  if (await cookieChoices.isVisible()) await cookieChoices.getByRole('button', { name: 'Recusar', exact: true }).click();
  await page.getByRole('button', { name: 'Criar um projeto', exact: true }).click();
  return page.getByRole('region', { name: 'Criar novo projeto', exact: true });
}

async function createSocialProject(page, { name, format, draftForPrompt = () => fixture.response }) {
  const assets = await localSocialAssets(page);
  const brand = { id: 'apoteose-social-reference', name: 'Apoteose — identidade de teste',
    logo: assets.logo, logoPosition: 'tr', logoSize: 116, logoOpacity: 100, showHandle: false,
    footerPillText: 'APOTEOSE', footerPillArrow: false,
    cultureHeaderLeft: 'APOTEOSE', cultureHeaderCenter: 'SÃO PAULO',
    styleKit: { ...fixture.styleKit, logoOnGenerate: true,
      referencePalette: { ...fixture.styleKit.referencePalette, refIds: ['social-apoteose-flyer'] },
      refImages: [{ id: 'social-apoteose-flyer', assetId: 'social-apoteose-flyer', name: 'Flyer Apoteose', dataUrl: `data:image/png;base64,${flyer}` }] } };
  const { cloud, routes } = socialFreeCloud({ brand, session, useV2: V2 });
  const prompts = [], requests = [], runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  const wizard = await openEmptyAccount(page, { brand, extra: {
    ...routes,
    '/api/ai/compatible': route => {
      const prompt = route.request().postDataJSON().payload.messages.find(message => message.role === 'user').content;
      prompts.push(prompt);
      // A primeira resposta contém texto + plano. Revisão é somente textual;
      // nenhum resultado do diretor nem geometria final entra nesta simulação.
      const review = /^(REVISÃO|REPARO)/.test(prompt);
      return route.fulfill({ json: completion(review ? { edits: [] } : structuredClone(draftForPrompt(prompt))) });
    },
    '/api/ai/sjinn-image': route => {
      const body = route.request().postDataJSON(); requests.push(body);
      const isArt = body.usageContext?.cardId === 'deck-art';
      return route.fulfill({ json: { b64_json: isArt ? assets.art : photo, mime: isArt ? 'image/png' : 'image/webp' } });
    },
  } });
  const next = () => wizard.getByRole('button', { name: 'Continuar', exact: true }).click();
  await wizard.getByRole('radio', { name: /^Carrossel para redes/ }).click();
  await wizard.getByLabel(/^Nome do projeto/).fill(name); await next();
  await wizard.getByRole('radio', { name: /^Usar um preset salvo/ }).click();
  await wizard.getByLabel(/^Marca deste projeto/).selectOption(brand.id);
  await expect(wizard.getByText(/1 referências visuais/)).toBeVisible(); await next();
  await wizard.getByLabel(/^Sobre o que vamos criar/).fill(fixture.topic);
  await wizard.getByLabel(/^Texto de apoio/).fill(fixture.material.content);
  await wizard.getByLabel(/^Links e fontes/).fill(fixture.material.sources);
  await wizard.getByLabel(/^Instruções adicionais/).fill(fixture.material.context);
  await next();
  await wizard.getByRole('radio', { name: /^Explicar com autoridade/ }).click(); await next();
  await wizard.getByLabel('Quantidade de cards', { exact: true }).fill('8');
  await wizard.getByRole('radio', { name: new RegExp(`^${format.label}`) }).click();
  await wizard.getByRole('radio', { name: /^Balanceado/ }).click(); await next();
  await wizard.getByRole('group', { name: 'Estilos para começar' }).getByRole('button', { name: /^Livre: o Moont decide/ }).click();
  await wizard.getByRole('radio', { name: /^Gerar texto e imagens/ }).click(); await next();
  await wizard.getByRole('button', { name: 'Criar e gerar 8 cards', exact: true }).click();
  await expect(wizard).toHaveCount(0, { timeout: 70_000 });
  await expect(page.getByRole('region', { name: 'Geração em andamento' })).toHaveCount(0);
  await expect.poll(async () => (await savedEntry(page, name))?.doc?.slides?.length).toBe(8);
  return { assets, cloud, prompts, requests, runtimeErrors };
}

test('Livre social está disponível no seletor do assistente', async ({ page }) => {
  const wizard = await openEmptyAccount(page);
  const next = () => wizard.getByRole('button', { name: 'Continuar', exact: true }).click();
  await wizard.getByLabel(/^Nome do projeto/).fill('Apoteose — opção Livre social');
  await next();
  await wizard.getByRole('radio', { name: /^Seguir com o padrão do Moont/ }).click();
  await next();
  await wizard.getByLabel(/^Sobre o que vamos criar/).fill('Apresentar a Apoteose: o Carnaval começa antes.');
  await next();
  await wizard.getByRole('radio', { name: /^Seguir meu pedido/ }).click();
  await next();
  await wizard.getByLabel('Quantidade de cards', { exact: true }).fill('8');
  await wizard.getByRole('radio', { name: /^Feed 4:5/ }).click();
  await next();
  await expect(wizard.getByRole('group', { name: 'Estilos para começar' })
    .getByRole('button', { name: /^Livre: o Moont decide/ })).toBeVisible();
});

test('Criar rápido continua sem a opção Livre social', async ({ page }) => {
  const wizard = await openEmptyAccount(page);
  await wizard.getByLabel(/^Nome do projeto/).fill('Proteção do Criar rápido');
  await wizard.getByRole('button', { name: /^Ir para o editor/ }).click();
  await expect(wizard).toHaveCount(0);
  await selectEditorMode(page, 'criador');
  await expect(page.getByRole('button', { name: /^Modo atual: Criar rápido\./ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Livre: o Moont decide/ })).toHaveCount(0);
});

for (const format of FORMATS) test(`Livre social: geração completa de oito cards em ${format.id}, gravação e reabertura (${V2 ? 'V2' : 'legado'})`, async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const name = `Apoteose — Livre social — ${format.label}`;
  const { assets, cloud, prompts, requests, runtimeErrors } = await createSocialProject(page, { name, format });
  await testInfo.attach('estado-apos-assistente', { body: JSON.stringify({
    project: snapshot((await savedEntry(page, name)).doc), prompts,
    requests: requests.map(request => ({ usageContext: request.usageContext, prompt: request.prompt, aspectRatio: request.aspectRatio })),
  }, null, 2), contentType: 'application/json' });
  await expect.poll(async () => (await savedEntry(page, name))?.doc?.socialPlan?.kind,
    { message: 'o retorno único deve persistir o roteiro social' }).toBe('social_free');
  await expect.poll(async () => (await savedEntry(page, name))?.doc?.slides?.filter(slide => slide.bgImageId || slide.bgImageAssetId).length,
    { timeout: 30_000, message: 'as três fotos do roteiro devem terminar' }).toBe(3);
  await expect.poll(async () => (await savedEntry(page, name))?.doc?.slides?.filter(slide => slide.presentationArtImageId || slide.presentationArtImageAssetId).length,
    { timeout: 30_000, message: 'a mesma arte deve chegar aos dois cards planejados' }).toBe(2);
  await selectEditorMode(page, 'diretor');
  await page.getByRole('button', { name: 'Salvar projeto agora', exact: true }).click();
  await expect.poll(() => cloud.writes.some(item => item.name === name && item.doc.slides?.length === 8 && item.doc.socialPlan), { timeout: 30_000 }).toBe(true);
  const entry = await savedEntry(page, name);
  const saved = entry.doc;
  await expect.poll(() => cloud.rows.get(entry.id)?.entry?.doc && snapshot(cloud.rows.get(entry.id).entry.doc), { timeout: 30_000 }).toEqual(snapshot(saved));
  const remote = cloud.rows.get(entry.id).entry.doc;
  // O manifesto pode concluir antes do envio dos originais, que é assíncrono.
  // A prova só avança quando cada referência tem bytes na conta simulada.
  await expect.poll(() => remote.slides.flatMap(slide => [slide.bgImageAssetId, slide.presentationArtImageAssetId, slide.logoImageAssetId])
    .filter(id => id && !cloud.assets.has(id)), { timeout: 30_000, message: 'todos os originais devem terminar de subir' }).toEqual([]);
  const mediaExpected = { photo: `data:image/webp;base64,${photo}`, art: `data:image/png;base64,${assets.art}` };
  const mediaProof = remote.slides.map((slide, i) => {
    const sources = [
      ['photo', slide.bgImageAssetId], ['art', slide.presentationArtImageAssetId], ['logo', slide.logoImageAssetId],
    ];
    return { card: i + 1, sources: sources.filter(([, id]) => id).map(([kind, id]) => {
      const dataUrl = cloud.assets.get(id);
      expect(dataUrl, `card ${i + 1}: bytes ${kind} enviados à conta`).toMatch(/^data:image\//);
      expect(id, `card ${i + 1}: identidade canônica de ${kind}`).toBe(`original_${hash(dataUrl)}`);
      if (mediaExpected[kind]) expect(dataUrl, `card ${i + 1}: original ${kind} preservado`).toBe(mediaExpected[kind]);
      return { kind, id, bytesSha256: createHash('sha256').update(Buffer.from(dataUrl.split(',')[1], 'base64')).digest('hex') };
    }) };
  });
  await page.reload();
  await enterEditorFromHome(page, name);
  await selectEditorMode(page, 'diretor');
  const cards = page.locator('main [data-vc-card-surface]');
  await expect(cards).toHaveCount(8);
  await expect.poll(async () => snapshot((await savedEntry(page, name)).doc)).toEqual(snapshot(saved));
  await page.evaluate(() => document.fonts.ready);
  const renderedMedia = await socialRenderedMedia(page);
  const geometry = await socialRenderGeometry(page);
  const requestSummary = requests.map(request => ({ usageContext: request.usageContext, prompt: request.prompt,
    aspectRatio: request.aspectRatio, imageListHashes: (request.imageList || []).map(hash) }));
  const evidence = { format, local: snapshot(saved), cloud: snapshot(remote), mediaProof, renderedMedia, geometry, prompts, requests: requestSummary };
  await testInfo.attach('geracao-social-completa', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  const directory = process.env.QA_SOCIAL_CAPTURE === '1'
    ? path.join(process.env.QA_OUTPUT_DIR || path.join(os.tmpdir(), 'moont-social-free'), format.id) : null;
  if (directory) {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'persistido.json'), JSON.stringify(evidence, null, 2));
    await captureSocialDeck(page, directory, format.height);
  }

  const writing = prompts.filter(prompt => !/^(REVISÃO|REPARO)/.test(prompt));
  expect.soft(writing, 'texto e roteiro juntos, sem planner separado').toHaveLength(1);
  expect.soft(writing[0]).toContain('MODO LIVRE SOCIAL');
  expect.soft(writing[0]).toContain(`1080 × ${format.height}`);
  expect.soft(writing[0]).toContain(fixture.material.content);
  expect.soft(prompts.some(prompt => prompt.startsWith('PLANEJAMENTO ESTRUTURADO'))).toBe(false);
  expect.soft(prompts.some(prompt => prompt.startsWith('REVISÃO'))).toBe(true);
  for (const [where, doc] of [['local', saved], ['conta', remote]]) {
    expect.soft(doc.visualPreset, `${where}: escolha Livre preservada`).toBe('social_free');
    expect.soft(doc.fmt, `${where}: formato preservado`).toBe(format.id);
    expect.soft(doc.mode, `${where}: narrativa preservada`).toBe(fixture.narrative);
    expect.soft(doc.material.content, `${where}: briefing preservado`).toBe(fixture.material.content);
    expect.soft(doc.editorialContext?.topic, `${where}: pedido preservado`).toBe(fixture.topic);
    expect.soft(doc.brand.footerPillText, `${where}: assinatura da marca preservada`).toBe('APOTEOSE');
    expect.soft(doc.visualBible, `${where}: ficha visual preservada`).toEqual(fixture.response.visualBible);
    expect.soft(doc.socialPlan).toMatchObject({ version: 1, kind: 'social_free', formato: format.id, signature: fixture.response.signature });
    expect.soft(doc.socialPlan.cards).toHaveLength(8);
    expect.soft(doc.socialDeckDesign.palette.bg, `${where}: base da referência`).toBe(fixture.expected.base);
    expect.soft(doc.socialDeckDesign.fonts, `${where}: fontes da direção preservadas`).toEqual(fixture.response.deckDesign.fonts);
    expect.soft(doc.socialPlan.visualDirection.palette.find(color => color.role === 'base')?.hex).toBe(fixture.expected.base);
    expect.soft(Array.isArray(doc.socialQuality?.reviewDiagnostics), `${where}: revisão gravada`).toBe(true);
    expect.soft(doc.socialQuality?.issues, `${where}: nenhuma violação pendente`).toEqual([]);
    for (const [i, slide] of doc.slides.entries()) {
      const original = fixture.response.slides[i];
      expect.soft(slide.presentationPresetId, `${where}: card ${i + 1} é social`).toBeFalsy();
      expect.soft(slide.socialFreeDesign.family, `${where}: família planejada do card ${i + 1}`).toBe(original.design.family);
      expect.soft(slide.socialFreeDesign.photo, `${where}: espaço de foto do card ${i + 1}`).toBe(original.design.photo);
      expect.soft(slide.socialPlan.formato).toBe(format.id);
      expect.soft(slide.socialPlan, `${where}: briefing e plano original do card ${i + 1}`)
        .toMatchObject({ scene: original.scene, avoid: original.avoid, design: original.design, eyebrow: original.eyebrow });
      expect.soft(slide.socialArt.formato).toBe(format.id);
      expect.soft(slide.canvas.source).toBe('social-preset');
      for (const field of ['title', 'subtitle', 'bodyAfterImage']) {
        expect.soft(plain(slide[field]), `${where}: card ${i + 1} preserva ${field}`).toBe(plain(original[field]));
      }
      expect.soft(slide.presentationBlocks || [], `${where}: bloco editorial do card ${i + 1}`).toEqual(original.presentationBlocks);
      if (i > 0) expect.soft(slide.eyebrow, `${where}: chapéu do card ${i + 1}`).toBe(original.eyebrow);
      if (original.design.photo === 'none') {
        expect.soft(slide.imageQuery, `${where}: card sem foto não tem pedido residual`).toBe('');
        expect.soft(!!(slide.bgImageId || slide.bgImageAssetId || slide.bgImage)).toBe(false);
      }
      expect.soft(slide.showSwipeCue, `${where}: seta só na capa`).toBe(i === 0);
    }
    expect.soft(doc.slides[0].socialFunction).toBe('cover');
    expect.soft(doc.slides[7].socialFunction).toBe('closing');
    expect.soft(plain(doc.slides[0].title).split(/\s+/).length).toBeLessThanOrEqual(8);
    const layouts = doc.slides.map(slide => JSON.stringify(slide.canvas.zones));
    expect.soft(new Set(layouts).size, `${where}: variedade efetiva`).toBeGreaterThanOrEqual(4);
    for (let i = 2; i < layouts.length; i++) expect.soft(layouts[i] === layouts[i - 1] && layouts[i] === layouts[i - 2], `${where}: nunca três geometrias iguais`).toBe(false);
    const artCards = doc.slides.map((slide, i) => slide.socialFreeDesign.ground === 'art' ? i + 1 : null).filter(Boolean);
    expect.soft(artCards, `${where}: cards de arte planejados`).toEqual(fixture.expected.artCards);
    const artIds = doc.slides.filter(slide => slide.socialFreeDesign.ground === 'art')
      .map(slide => slide.presentationArtImageAssetId || slide.presentationArtImageId || slide.presentationArtImage);
    expect.soft(artIds.every(Boolean), `${where}: arte persistida`).toBe(true);
    expect.soft(new Set(artIds).size, `${where}: uma única arte compartilhada`).toBe(1);
  }
  await expect.soft(cards.locator('[data-vc-deck-art]')).toHaveCount(2);
  for (const media of renderedMedia) {
    const proof = mediaProof[media.card - 1].sources;
    for (const image of media.images) {
      expect.soft(image.loaded, `card ${media.card}: ${image.kind} decodificada após reabrir`).toBe(true);
      expect.soft(proof.some(source => source.kind === image.kind && source.bytesSha256 === image.bytesSha256),
        `card ${media.card}: DOM usa os mesmos bytes de ${image.kind} salvos na conta`).toBe(true);
    }
    expect.soft(media.images.filter(image => image.kind === 'photo')).toHaveLength(fixture.expected.photoCards.includes(media.card) ? 1 : 0);
    expect.soft(media.images.filter(image => image.kind === 'art')).toHaveLength(fixture.expected.artCards.includes(media.card) ? 1 : 0);
    expect.soft(media.images.filter(image => image.kind === 'logo')).toHaveLength(1);
  }
  await expect.soft(cards.last()).toContainText('Salve a ideia e acompanhe a Apoteose.');
  for (const i of [0, 7]) await expect.soft(cards.nth(i)).toContainText(fixture.response.signature);
  for (let i = 1; i < 8; i++) await expect.soft(cards.nth(i).getByText(fixture.response.slides[i].eyebrow, { exact: true })).toBeVisible();
  await expect.soft(cards.nth(4).getByRole('table', { name: 'Comparação' }).locator('tbody tr')).toHaveCount(3);
  for (const i of [1, 3, 4, 6, 7]) await expect.soft(cards.nth(i).locator('[data-vc-photo-zone], [data-vc-photo-placeholder]')).toHaveCount(0);
  const photos = requests.filter(request => request.usageContext?.cardId !== 'deck-art');
  expect.soft(photos.map(request => request.usageContext?.cardNumber).sort((a, b) => a - b)).toEqual(fixture.expected.photoCards);
  expect.soft(requests.filter(request => request.usageContext?.cardId === 'deck-art'), 'uma geração de arte para o projeto').toHaveLength(1);
  const artRequest = requests.find(request => request.usageContext?.cardId === 'deck-art');
  expect.soft(artRequest?.prompt, 'composição da arte usa o canvas real').toContain(`COMPOSITION (shared social background 1080 × ${format.height}, ${format.ratio}`);
  // O adaptador Sjinn já existente só transporta 4:5 como 2:3. O contrato de
  // composição conserva1080×1350; os outros dois formatos são exatos também na API.
  expect.soft(artRequest?.aspectRatio, 'proporção suportada pelo transporte Sjinn').toBe(format.ratio === '4:5' ? '2:3' : format.ratio);
  for (const request of photos) {
    expect.soft(request.prompt).toContain(`COMPOSITION (social card 1080 × ${format.height}, ${format.ratio}`);
    expect.soft(request.prompt, 'a descrição completa da identidade acompanha cada cena').toContain(fixture.response.visualBible.entities[0].en);
    expect.soft(request.prompt, 'as restrições da identidade continuam no pedido').toContain(fixture.response.visualBible.entities[0].never);
    expect.soft(request.prompt).toMatch(/terracotta shirt/i);
    expect.soft(request.prompt).toContain('REFERENCE ROLES: Use moodboard images only for the look');
    expect.soft(request.prompt).not.toContain('lighting and composition');
  }
  const firstPhoto = photos.find(request => request.usageContext.cardNumber === 1);
  const returningPhotos = photos.filter(request => request.usageContext.cardNumber !== 1);
  expect.soft(firstPhoto?.imageList).toHaveLength(1);
  for (const request of returningPhotos) {
    expect.soft(request.prompt, 'a pessoa recorrente recebe âncora de identidade').toContain('IDENTITY ANCHOR');
    expect.soft(request.imageList).toHaveLength(2);
  }
  expect.soft(new Set(returningPhotos.map(request => hash(request.imageList.at(-1)))).size, 'a mesma âncora é reutilizada').toBe(1);
  expect.soft(runtimeErrors).toEqual([]);

  // Geometria e legibilidade medidas na árvore real que também será exportada.
  expect.soft(geometry).toHaveLength(8);
  const safe = fixture.expected.safeZones[format.id];
  for (const [i, rendered] of geometry.entries()) {
    const prefix = `${format.id}, card ${i + 1}`;
    expect.soft({ width: rendered.width, height: rendered.height }, `${prefix}: medida de exportação`).toEqual({ width: 1080, height: format.height });
    expect.soft(rendered.overflow, `${prefix}: texto sem corte no piso`).toEqual([]);
    expect.soft(rendered.logos, `${prefix}: logo presente`).toHaveLength(1);
    expect.soft(rendered.visibleLogos, `${prefix}: marca visível medida`).toHaveLength(1);
    expect.soft(rendered.headers, `${prefix}: cabeçalho realmente desenhado`).toHaveLength(1);
    expect.soft(rendered.footer, `${prefix}: rodapé realmente desenhado`).toHaveLength(1);
    expect.soft(rendered.swipeCues, `${prefix}: seta desenhada só na capa`).toHaveLength(i === 0 ? 1 : 0);
    expect.soft(rendered.text.length, `${prefix}: texto realmente desenhado`).toBeGreaterThan(0);
    for (const text of rendered.text) {
      const label = `${prefix}: ${text.text.slice(0, 55)}`;
      expect.soft(text.fontPx, `${label}: piso de leitura`).toBeGreaterThanOrEqual(28 - 0.05);
      for (const box of text.boxes) {
        expect.soft(box.x, `${label}: margem esquerda`).toBeGreaterThanOrEqual(-1);
        expect.soft(box.right, `${label}: margem direita`).toBeLessThanOrEqual(1081);
        expect.soft(box.y, `${label}: topo seguro`).toBeGreaterThanOrEqual(format.height * safe.top / 100 - 1);
        expect.soft(box.bottom, `${label}: base segura`).toBeLessThanOrEqual(format.height * (1 - safe.bottom / 100) + 1);
        for (const logo of rendered.logos) {
          const overlaps = Math.min(box.right, logo.right) - Math.max(box.x, logo.x) > 1
            && Math.min(box.bottom, logo.bottom) - Math.max(box.y, logo.y) > 1;
          expect.soft(overlaps, `${label}: reserva da logo`).toBe(false);
        }
      }
      if (text.color?.alpha >= 0.999 && !text.onPhoto && text.background) {
        expect.soft(contrastRatio(text.color.rgb, text.background), `${label}: contraste em fundo sólido/arte`).toBeGreaterThanOrEqual(4.5 - 0.01);
      }
      if (text.color?.alpha >= 0.999 && text.onPhoto) {
        const floor = Number(saved.slides[i].socialScrimMin) || 0;
        expect.soft(floor, `${label}: proteção sobre a foto`).toBeGreaterThan(0);
        // A borda superior do véu tem 90% da opacidade mínima. Branco é o
        // pior pixel possível sob essa proteção preta, independente da foto.
        const worst = 255 * (1 - 0.9 * floor);
        expect.soft(contrastRatio(text.color.rgb, [worst, worst, worst]), `${label}: contraste sobre o pior pixel da foto`).toBeGreaterThanOrEqual(4.5 - 0.01);
      }
    }
    for (const footer of rendered.footer) {
      expect.soft(footer.bottom, `${prefix}: rodapé fora da interface`).toBeLessThanOrEqual(format.height * (1 - safe.bottom / 100) + 1);
    }
    for (const [kind, boxes] of [['logo', rendered.visibleLogos], ['cabeçalho', rendered.headers]]) for (const box of boxes) {
      expect.soft(box.y, `${prefix}: ${kind} dentro do topo seguro`).toBeGreaterThanOrEqual(format.height * safe.top / 100 - 1);
      expect.soft(box.bottom, `${prefix}: ${kind} dentro da base segura`).toBeLessThanOrEqual(format.height * (1 - safe.bottom / 100) + 1);
    }
    const eyebrowBoxes = rendered.text.filter(text => i > 0 && plain(text.text) === fixture.response.slides[i].eyebrow).flatMap(text => text.boxes);
    const folioBoxes = rendered.text.filter(text => text.device && /^\d{1,2}(?:\s*\/\s*\d{1,2})?$/.test(text.text)).flatMap(text => text.boxes);
    for (const eyebrow of eyebrowBoxes) for (const folio of folioBoxes) {
      const overlaps = Math.min(eyebrow.right, folio.right) - Math.max(eyebrow.x, folio.x) > 1
        && Math.min(eyebrow.bottom, folio.bottom) - Math.max(eyebrow.y, folio.y) > 1;
      expect.soft(overlaps, `${prefix}: fólio não atravessa o chapéu`).toBe(false);
    }
  }

  if (format.id === 'carrossel') {
    // As oito capturas base já foram feitas. Estas ações adicionais comprovam
    // pedidos explícitos posteriores em cards que o roteiro deixou sem foto.
    const beforeUpload = snapshot((await savedEntry(page, name)).doc);
    const requestsBeforeUpload = requests.length;
    await page.getByLabel('Ir para o card', { exact: true }).selectOption('1');
    await page.getByRole('tab', { name: 'Imagem', exact: true }).click();
    await page.getByLabel('Importar foto no card 2', { exact: true }).setInputFiles({
      name: 'foto-do-usuario.webp', mimeType: 'image/webp', buffer: uploadedPhoto,
    });
    await expect.poll(async () => (await savedEntry(page, name)).doc.slides[1].bgImageSource).toBe('imported');
    const afterUpload = (await savedEntry(page, name)).doc;
    expect(afterUpload.slides[1].socialFreeDesign.photo, 'upload abre uma zona de foto').not.toBe('none');
    expect(afterUpload.slides[1].presentationSuppressPhoto).toBe(false);
    expect(afterUpload.slides[1].canvas.zones.photo.w).toBeGreaterThan(0);
    expect(afterUpload.slides[1].canvas.zones.photo.h).toBeGreaterThan(0);
    for (const field of ['title', 'subtitle', 'bodyAfterImage', 'eyebrow', 'presentationBlocks']) {
      expect(afterUpload.slides[1][field], `upload preserva ${field}`).toEqual(saved.slides[1][field]);
    }
    expect(snapshot(afterUpload).slides.filter((_, index) => index !== 1), 'upload deixa os outros sete cards intactos')
      .toEqual(beforeUpload.slides.filter((_, index) => index !== 1));
    expect(requests.length, 'upload próprio não gera imagem com IA').toBe(requestsBeforeUpload);
    await expect(cards.nth(1).locator('[data-vc-photo-zone]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Salvar projeto agora', exact: true }).click();
    await expect.poll(() => snapshot(cloud.rows.get(entry.id).entry.doc)).toEqual(snapshot(afterUpload));
    const remoteUpload = cloud.rows.get(entry.id).entry.doc;
    const uploadedAssetId = remoteUpload.slides[1].bgImageAssetId;
    await expect.poll(() => cloud.assets.get(uploadedAssetId), { timeout: 30_000, message: 'a conta guarda os bytes originais do upload' })
      .toBe(`data:image/webp;base64,${uploadedPhoto.toString('base64')}`);
    await page.reload();
    await enterEditorFromHome(page, name);
    await selectEditorMode(page, 'diretor');
    await expect.poll(async () => snapshot((await savedEntry(page, name)).doc)).toEqual(snapshot(afterUpload));
    await expect(cards.nth(1).locator('[data-vc-photo-zone]')).toHaveCount(1);
    const uploadedMedia = (await socialRenderedMedia(page))[1].images.filter(image => image.kind === 'photo');
    expect(uploadedMedia, 'foto importada reaparece decodificada com os mesmos bytes').toEqual([
      { kind: 'photo', loaded: true, bytesSha256: createHash('sha256').update(uploadedPhoto).digest('hex') },
    ]);
    const uploadEvidence = { before: beforeUpload.slides[1], after: snapshot(afterUpload).slides[1],
      assetId: uploadedAssetId, media: uploadedMedia, imageRequestsAdded: requests.length - requestsBeforeUpload };
    await testInfo.attach('upload-posterior-em-card-sem-foto', { body: JSON.stringify(uploadEvidence, null, 2), contentType: 'application/json' });
    if (directory) {
      const uploadDirectory = path.join(directory, 'upload-posterior');
      await captureSocialDeck(page, uploadDirectory, format.height, [1]);
      fs.writeFileSync(path.join(uploadDirectory, 'persistido.json'), JSON.stringify(uploadEvidence, null, 2));
    }

    const beforeIndividual = snapshot((await savedEntry(page, name)).doc);
    const imageRequestsBeforeIndividual = requests.length;
    const direction = 'The recurring fictional woman convidada, wearing a terracotta shirt, walking toward a contemporary urban party entrance in São Paulo at night. Leave quiet space for the text.';
    await page.getByLabel('Ir para o card', { exact: true }).selectOption('6');
    await page.getByRole('tab', { name: 'Imagem', exact: true }).click();
    await page.getByRole('button', { name: /^Direção$/ }).first().click();
    await page.getByLabel('Direção da imagem (este card)', { exact: true }).fill(direction);
    await page.getByRole('button', { name: 'Gerar imagem', exact: true }).first().click();
    await expect.poll(() => requests.length).toBe(imageRequestsBeforeIndividual + 1);
    const individualRequest = requests.at(-1);
    expect(individualRequest.usageContext.cardNumber).toBe(7);
    expect(individualRequest.prompt).toContain(direction);
    expect(individualRequest.prompt).toContain(`COMPOSITION (social card 1080 × ${format.height}, ${format.ratio}`);
    expect(individualRequest.prompt).toContain('REFERENCE ROLES: Use moodboard images only for the look');
    await expect.poll(async () => (await savedEntry(page, name)).doc.slides[6].bgImageSource).toBe('ai');
    const afterIndividual = (await savedEntry(page, name)).doc;
    expect(afterIndividual.slides[6].socialFreeDesign.photo).not.toBe('none');
    expect(afterIndividual.slides[6].presentationSuppressPhoto).toBe(false);
    for (const field of ['title', 'subtitle', 'bodyAfterImage', 'eyebrow', 'presentationBlocks']) {
      expect(afterIndividual.slides[6][field], `geração individual preserva ${field}`).toEqual(saved.slides[6][field]);
    }
    expect(snapshot(afterIndividual).slides.filter((_, index) => index !== 6), 'pedido individual deixa os outros sete cards intactos')
      .toEqual(beforeIndividual.slides.filter((_, index) => index !== 6));
    await expect(cards.nth(6).locator('[data-vc-photo-zone]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Salvar projeto agora', exact: true }).click();
    await expect.poll(() => snapshot(cloud.rows.get(entry.id).entry.doc)).toEqual(snapshot(afterIndividual));
    const individualAssetId = cloud.rows.get(entry.id).entry.doc.slides[6].bgImageAssetId;
    await expect.poll(() => cloud.assets.get(individualAssetId), { timeout: 30_000 }).toBe(mediaExpected.photo);
    await page.reload();
    await enterEditorFromHome(page, name);
    await selectEditorMode(page, 'diretor');
    await expect.poll(async () => snapshot((await savedEntry(page, name)).doc)).toEqual(snapshot(afterIndividual));
    const individualMedia = (await socialRenderedMedia(page))[6].images.filter(image => image.kind === 'photo');
    expect(individualMedia).toEqual([
      { kind: 'photo', loaded: true, bytesSha256: createHash('sha256').update(Buffer.from(photo, 'base64')).digest('hex') },
    ]);
    const individualEvidence = { before: beforeIndividual.slides[6], after: snapshot(afterIndividual).slides[6],
      request: { usageContext: individualRequest.usageContext, prompt: individualRequest.prompt, aspectRatio: individualRequest.aspectRatio },
      assetId: individualAssetId, media: individualMedia };
    await testInfo.attach('pedido-individual-em-card-sem-foto', { body: JSON.stringify(individualEvidence, null, 2), contentType: 'application/json' });
    if (directory) {
      const individualDirectory = path.join(directory, 'geracao-individual');
      await captureSocialDeck(page, individualDirectory, format.height, [6]);
      fs.writeFileSync(path.join(individualDirectory, 'persistido.json'), JSON.stringify(individualEvidence, null, 2));
    }

    const beforeFixed = (await savedEntry(page, name)).doc;
    const textAndOrder = doc => doc.slides.map(slide => ({ id: slide.id, title: slide.title, subtitle: slide.subtitle,
      bodyAfterImage: slide.bodyAfterImage, eyebrow: slide.eyebrow, eyebrowText: slide.eyebrowText,
      blocks: slide.presentationBlocks || [] }));
    const assetReferences = doc => doc.slides.map(slide => ({ id: slide.id,
      photo: slide.bgImageAssetId || null, art: slide.presentationArtImageAssetId || null,
      logo: slide.logoImageAssetId || null }));
    const beforeFixedAssets = assetReferences(cloud.rows.get(entry.id).entry.doc);
    const requestsBeforeFixed = requests.length;
    await page.getByRole('tab', { name: 'Visual', exact: true }).click();
    await page.getByRole('group', { name: 'Aplicar padrão visual em' }).getByRole('button', { name: 'Todos os cards', exact: true }).click();
    await page.getByRole('group', { name: 'Padrões visuais', exact: true }).getByRole('button', { name: /^Revista\./ }).click();
    await expect.poll(async () => (await savedEntry(page, name)).doc.visualPreset).toBe('social_revista');
    const fixed = (await savedEntry(page, name)).doc;
    for (const field of ['socialPlan', 'socialDeckDesign', 'socialQuality']) {
      expect.soft(fixed[field], `sair de Livre desativa ${field} global`).toBeNull();
    }
    expect.soft(textAndOrder(fixed), 'mudar de estilo preserva todos os textos, blocos, IDs e ordem').toEqual(textAndOrder(beforeFixed));
    expect.soft(fixed.fmt).toBe(beforeFixed.fmt);
    expect.soft(fixed.mode).toBe(beforeFixed.mode);
    expect.soft(fixed.visualBible).toEqual(beforeFixed.visualBible);
    for (const slide of fixed.slides) {
      expect.soft(slide.socialFreeDesign, 'o diretor Livre deixa de comandar o card').toBeFalsy();
      expect.soft(slide.socialPlan).toBeFalsy();
      expect.soft(slide.socialPresetId).not.toBe('social_free');
      expect.soft(String(slide.socialComposition || '')).not.toMatch(/^free:/);
    }
    expect.soft(requests.length, 'troca de estilo não gera novas mídias').toBe(requestsBeforeFixed);
    await expect.soft(cards.locator('[data-vc-deck-art]'), 'estilo fixo desativa a camada de arte, preservando o arquivo').toHaveCount(0);
    await expect.soft(cards.nth(4).getByRole('table', { name: 'Comparação' }).locator('tbody tr')).toHaveCount(3);
    for (const i of [0, 1, 2, 5, 6]) await expect.soft(cards.nth(i).locator('[data-vc-photo-zone]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Salvar projeto agora', exact: true }).click();
    await expect.poll(() => snapshot(cloud.rows.get(entry.id).entry.doc), { timeout: 30_000 }).toEqual(snapshot(fixed));
    const fixedAssets = assetReferences(cloud.rows.get(entry.id).entry.doc);
    expect.soft(fixedAssets, 'fotos, logos e arte mantêm as referências aos originais na conta').toEqual(beforeFixedAssets);
    await page.reload();
    await enterEditorFromHome(page, name);
    await selectEditorMode(page, 'diretor');
    await expect.poll(async () => snapshot((await savedEntry(page, name)).doc)).toEqual(snapshot(fixed));
    await expect.soft(cards.locator('[data-vc-deck-art]')).toHaveCount(0);
    await expect.soft(cards.nth(4).getByRole('table', { name: 'Comparação' }).locator('tbody tr')).toHaveCount(3);
    const fixedMedia = await socialRenderedMedia(page);
    const fixedGeometry = await socialRenderGeometry(page);
    const fixedCardTwoText = fixedGeometry[1].text.filter(text => ['title', 'subtitle'].includes(text.zone));
    expect.soft(fixedCardTwoText.some(text => text.zone === 'title'), 'título continua desenhado depois de sair do Livre').toBe(true);
    expect.soft(fixedCardTwoText.some(text => text.zone === 'subtitle'), 'apoio continua desenhado depois de sair do Livre').toBe(true);
    for (const text of fixedCardTwoText) {
      expect.soft(text.onPhoto, 'título e apoio do card 2 ficam na superfície abaixo da foto').toBe(false);
      expect.soft(contrastRatio(text.color.rgb, text.background), `Revista, card 2, ${text.text}: tinta legível sobre o fundo do novo estilo`)
        .toBeGreaterThanOrEqual(4.5 - 0.01);
    }
    for (const media of fixedMedia) {
      const expectedPhoto = media.card === 2 ? uploadedPhoto : Buffer.from(photo, 'base64');
      const photosInCard = media.images.filter(image => image.kind === 'photo');
      expect.soft(photosInCard).toEqual([1, 2, 3, 6, 7].includes(media.card)
        ? [{ kind: 'photo', loaded: true, bytesSha256: createHash('sha256').update(expectedPhoto).digest('hex') }] : []);
    }
    const fixedEvidence = { before: snapshot(beforeFixed), after: snapshot(fixed), beforeAssets: beforeFixedAssets,
      afterAssets: fixedAssets, renderedMedia: fixedMedia, geometry: fixedGeometry, imageRequestsAdded: requests.length - requestsBeforeFixed };
    await testInfo.attach('saida-livre-para-revista', { body: JSON.stringify(fixedEvidence, null, 2), contentType: 'application/json' });
    if (directory) {
      const fixedDirectory = path.join(directory, 'estilo-fixo');
      await captureSocialDeck(page, fixedDirectory, format.height, [1, 4, 7]);
      fs.writeFileSync(path.join(fixedDirectory, 'persistido.json'), JSON.stringify(fixedEvidence, null, 2));
    }
  }

  if (format.id === 'stories') {
    // Um projeto nascido em Stories conserva sua base quando a pessoa muda
    // somente o estilo de um card na vista Feed, inclusive na segunda troca.
    const base = (await savedEntry(page, name)).doc;
    const baseSnapshot = snapshot(base), cardId = base.slides[5].id;
    const withoutFormat = ({ fmt, ...rest }) => rest;
    const views = doc => doc.formatViews || {};
    const viewOfCard = doc => views(doc).carrossel?.slides?.[cardId];
    const formats = page.getByRole('group', { name: 'Formato do card (exportação)' }).first();
    const chooseFormat = async label => {
      await formats.getByRole('button', { name: label, exact: true }).click();
      await expect.poll(async () => (await savedEntry(page, name)).doc.fmt)
        .toBe(FORMATS.find(item => item.label === label).id);
      await page.evaluate(() => document.fonts.ready);
    };
    await chooseFormat('Quadrado');
    const squareBefore = await socialRenderGeometry(page);
    await chooseFormat('Feed 4:5');
    const feedBefore = await socialRenderGeometry(page);
    const beforeViews = structuredClone(views((await savedEntry(page, name)).doc));
    await page.getByLabel('Ir para o card', { exact: true }).selectOption('5');
    await page.getByRole('tab', { name: 'Visual', exact: true }).click();
    await page.getByRole('group', { name: 'Aplicar padrão visual em' })
      .getByRole('button', { name: 'Este card', exact: true }).click();
    const styleSnapshots = [];
    for (const style of [{ label: /^Revista\./, id: 'social_revista' }, { label: /^Cinema\./, id: 'social_cinema' }]) {
      await page.getByRole('group', { name: 'Padrões visuais', exact: true }).getByRole('button', { name: style.label }).click();
      await expect.poll(async () => viewOfCard((await savedEntry(page, name)).doc)?.visualPresetId).toBe(style.id);
      const current = (await savedEntry(page, name)).doc;
      expect.soft(viewOfCard(current).socialFreeDesign, `${style.id}: Livre desativado só nesta vista`).toBeNull();
      expect.soft(viewOfCard(current).socialPlan, `${style.id}: plano do card desativado só nesta vista`).toBeNull();
      expect.soft(withoutFormat(snapshot(current)), `${style.id}: base, textos, ordem, identidade e plano global intactos`)
        .toEqual(withoutFormat(baseSnapshot));
      for (const otherFormat of ['stories', 'quadrado']) {
        expect.soft(views(current)[otherFormat] || {}, `${style.id}: ${otherFormat} preservado`).toEqual(beforeViews[otherFormat] || {});
      }
      for (const slide of current.slides.filter(item => item.id !== cardId)) {
        expect.soft(views(current).carrossel?.slides?.[slide.id], `${style.id}: os outros sete cards do Feed ficam intactos`)
          .toEqual(beforeViews.carrossel?.slides?.[slide.id]);
      }
      styleSnapshots.push({ style: style.id, view: viewOfCard(current), canonical: snapshot(current) });
    }
    const fixedFeed = await socialRenderGeometry(page);
    expect.soft(fixedFeed.filter((_, index) => index !== 5), 'estilo individual preserva a renderização dos outros sete cards')
      .toEqual(feedBefore.filter((_, index) => index !== 5));
    expect.soft(fixedFeed[5], 'a nova família muda a geometria efetivamente desenhada').not.toEqual(feedBefore[5]);
    const requestCount = requests.length;
    const direction = 'Keep the recurring fictional woman convidada in a terracotta shirt, meeting friends at a contemporary São Paulo party entrance, with a quiet background.';
    await page.getByRole('tab', { name: 'Imagem', exact: true }).click();
    const imagePanel = page.getByRole('complementary');
    await imagePanel.getByLabel('Prompt extra (este card)', { exact: true }).fill(direction);
    await imagePanel.getByRole('button', { name: 'Regenerar imagem', exact: true }).click();
    await expect.poll(() => requests.length).toBe(requestCount + 1);
    const fixedViewRequest = requests.at(-1);
    expect.soft(fixedViewRequest.usageContext.cardNumber).toBe(6);
    expect.soft(fixedViewRequest.prompt).toContain(direction);
    expect.soft(fixedViewRequest.prompt, 'o pedido segue o estilo fixo da vista, sem reativar a composição Livre').not.toContain('COMPOSITION (social card');
    expect.soft(fixedViewRequest.prompt, 'a direção global Livre não reaparece no pedido desta vista').not.toContain('base colour, the dominant field');
    // Cinema nesta vista usa uma faixa de 1080×675px, cuja proporção suportada
    // mais próxima é 3:2. A imagem segue o painel efetivo, não o card inteiro.
    expect.soft(fixedFeed[5].photoRects).toEqual([{ x: 0, y: 0, w: 1080, h: 675, right: 1080, bottom: 675 }]);
    expect.soft(fixedViewRequest.aspectRatio, 'o transporte recebe a proporção do painel da vista Feed').toBe('3:2');
    await expect(imagePanel.getByRole('button', { name: 'Regenerar imagem', exact: true })).toBeEnabled();
    const afterViewImage = (await savedEntry(page, name)).doc;
    expect.soft(viewOfCard(afterViewImage).visualPresetId).toBe('social_cinema');
    expect.soft(viewOfCard(afterViewImage).socialFreeDesign).toBeNull();
    expect.soft(withoutFormat(snapshot(afterViewImage)), 'regenerar na vista fixa preserva a composição canônica e o roteiro')
      .toEqual(withoutFormat(baseSnapshot));
    const viewMedia = await socialRenderedMedia(page);
    expect.soft(viewMedia, 'as fotos e a arte continuam decodificadas, com os bytes simulados corretos').toEqual(renderedMedia);
    await chooseFormat('Quadrado');
    const squareAfter = await socialRenderGeometry(page);
    expect.soft(squareAfter, 'a vista Quadrado não herda o estilo escolhido para Feed').toEqual(squareBefore);
    await chooseFormat('Stories');
    const storiesAfter = await socialRenderGeometry(page);
    expect.soft(storiesAfter, 'a composição Stories original continua igual após a edição da vista Feed').toEqual(geometry);
    await chooseFormat('Feed 4:5');
    const finalViewDoc = (await savedEntry(page, name)).doc;
    await page.getByRole('button', { name: 'Salvar projeto agora', exact: true }).click();
    await expect.poll(() => snapshot(cloud.rows.get(entry.id).entry.doc), { timeout: 30_000 }).toEqual(snapshot(finalViewDoc));
    await expect.poll(() => cloud.rows.get(entry.id).entry.doc.formatViews, { timeout: 30_000 }).toEqual(finalViewDoc.formatViews);
    const imageAssetId = cloud.rows.get(entry.id).entry.doc.slides[5].bgImageAssetId;
    await expect.poll(() => cloud.assets.get(imageAssetId), { timeout: 30_000 }).toBe(mediaExpected.photo);
    await page.reload();
    await enterEditorFromHome(page, name);
    await selectEditorMode(page, 'diretor');
    await expect.poll(async () => snapshot((await savedEntry(page, name)).doc)).toEqual(snapshot(finalViewDoc));
    await expect.poll(async () => (await savedEntry(page, name)).doc.formatViews).toEqual(finalViewDoc.formatViews);
    const reopenedFeed = await socialRenderGeometry(page);
    expect.soft(reopenedFeed, 'a vista fixa é a mesma depois de reabrir o projeto').toEqual(fixedFeed);
    expect.soft(await socialRenderedMedia(page), 'mídia da vista reaparece com os mesmos bytes').toEqual(viewMedia);
    expect.soft(runtimeErrors).toEqual([]);
    const viewEvidence = { before: baseSnapshot, styleSnapshots, after: snapshot(finalViewDoc),
      formatViews: finalViewDoc.formatViews, feedBefore, fixedFeed, reopenedFeed, squareBefore, squareAfter,
      storiesBefore: geometry, storiesAfter, media: viewMedia, assetId: imageAssetId,
      request: { usageContext: fixedViewRequest.usageContext, prompt: fixedViewRequest.prompt, aspectRatio: fixedViewRequest.aspectRatio } };
    await testInfo.attach('duas-trocas-na-vista-feed-e-geracao-individual', { body: JSON.stringify(viewEvidence, null, 2), contentType: 'application/json' });
    if (directory) {
      const viewDirectory = path.join(directory, 'vista-derivada-feed');
      fs.mkdirSync(viewDirectory, { recursive: true });
      fs.writeFileSync(path.join(viewDirectory, 'persistido.json'), JSON.stringify(viewEvidence, null, 2));
      await captureSocialDeck(page, viewDirectory, 1350, [5]);
    }

    // A foto também precisa aparecer se uma pessoa já moveu a composição de
    // um card sem foto. O texto é ajustado pela UI, sem fabricar a vista salva.
    await page.getByLabel('Ir para o card', { exact: true }).selectOption('1');
    await cards.nth(1).scrollIntoViewIfNeeded();
    const cardTwoId = finalViewDoc.slides[1].id;
    const manualView = doc => doc.formatViews?.carrossel?.slides?.[cardTwoId];
    const title = cards.nth(1).locator('[data-vc-movable="title"]');
    await expect(title).toBeVisible();
    await title.press('ArrowRight');
    await expect.poll(async () => manualView((await savedEntry(page, name)).doc)?.elementOffsets?.title?.x).toBeGreaterThan(0);
    await selectEditorMode(page, 'studio');
    await page.getByRole('tab', { name: 'Layout', exact: true }).click();
    await page.getByRole('button', { name: 'Editar composição em todos os cards', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Mostrar zonas no card', exact: true })).toHaveAttribute('aria-checked', 'true');
    const titleZone = cards.nth(1).locator('[data-vc-zone="title"]').filter({ has: page.locator('[data-vc-handle]') });
    await expect(titleZone).toBeVisible();
    const titleZoneBox = await titleZone.boundingBox();
    const start = { x: titleZoneBox.x + titleZoneBox.width * 0.65, y: titleZoneBox.y + titleZoneBox.height * 0.55 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 12, start.y + 8, { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => manualView((await savedEntry(page, name)).doc)?.canvas?.userEdited).toBe(true);
    await page.getByRole('switch', { name: 'Mostrar zonas no card', exact: true }).click();
    const beforeManualUpload = (await savedEntry(page, name)).doc;
    const beforeManualView = manualView(beforeManualUpload);
    expect(beforeManualUpload.slides[1].socialFreeDesign.photo).toBe('none');
    expect(beforeManualView.canvas.zones.photo).toMatchObject({ w: 1, h: 1 });
    const requestsBeforeManualUpload = requests.length;
    await page.getByRole('tab', { name: 'Imagem', exact: true }).click();
    await page.getByLabel('Importar foto no card 2', { exact: true }).setInputFiles({
      name: 'foto-apos-edicao-manual.webp', mimeType: 'image/webp', buffer: uploadedPhoto,
    });
    await expect.poll(async () => (await savedEntry(page, name)).doc.slides[1].bgImageSource).toBe('imported');
    const afterManualUpload = (await savedEntry(page, name)).doc;
    const afterManualView = manualView(afterManualUpload);
    expect.soft(afterManualUpload.slides[1].socialFreeDesign.photo, 'upload revela a foto no roteiro do card').not.toBe('none');
    expect.soft(afterManualView.socialFreeDesign.photo, 'a vista manual também passa a reservar foto').not.toBe('none');
    expect.soft(afterManualView.presentationSuppressPhoto).toBe(false);
    expect.soft(afterManualView.canvas.userEdited, 'a vista continua manual').toBe(true);
    expect.soft(afterManualView.canvas.zones.photo.w, 'a nova foto não fica no sentinel de 1%').toBeGreaterThan(2);
    expect.soft(afterManualView.canvas.zones.photo.h, 'a nova foto tem uma zona utilizável').toBeGreaterThan(2);
    for (const zone of ['title', 'subtitle']) {
      expect.soft(afterManualView.canvas.zones[zone], `upload preserva a zona manual de ${zone}`).toEqual(beforeManualView.canvas.zones[zone]);
    }
    expect.soft(afterManualView.elementOffsets, 'upload preserva o deslocamento manual do título').toEqual(beforeManualView.elementOffsets);
    for (const field of ['fmt', 'mode', 'visualPreset', 'socialPlan', 'socialDeckDesign', 'visualBible']) {
      expect.soft(afterManualUpload[field], `upload manual preserva ${field}`).toEqual(beforeManualUpload[field]);
    }
    for (const field of ['title', 'subtitle', 'bodyAfterImage', 'eyebrow', 'presentationBlocks']) {
      expect.soft(afterManualUpload.slides[1][field], `upload na vista manual preserva ${field}`).toEqual(beforeManualUpload.slides[1][field]);
    }
    expect.soft(snapshot(afterManualUpload).slides.filter((_, index) => index !== 1), 'upload manual conserva os outros sete originais')
      .toEqual(snapshot(beforeManualUpload).slides.filter((_, index) => index !== 1));
    for (const slide of beforeManualUpload.slides.filter(item => item.id !== cardTwoId)) {
      expect.soft(afterManualUpload.formatViews?.carrossel?.slides?.[slide.id], 'upload manual conserva as outras sete vistas')
        .toEqual(beforeManualUpload.formatViews?.carrossel?.slides?.[slide.id]);
    }
    expect.soft(requests.length, 'importação própria não solicita IA').toBe(requestsBeforeManualUpload);
    await expect.soft(cards.nth(1).locator('[data-vc-photo-zone]')).toHaveCount(1);
    const manualPhotoRect = (await socialRenderGeometry(page))[1].photoRects[0];
    expect.soft(manualPhotoRect.w, 'a foto ocupa pixels reais no DOM').toBeGreaterThan(21.6);
    expect.soft(manualPhotoRect.h).toBeGreaterThan(27);
    await page.getByRole('button', { name: 'Salvar projeto agora', exact: true }).click();
    await expect.poll(() => snapshot(cloud.rows.get(entry.id).entry.doc), { timeout: 30_000 }).toEqual(snapshot(afterManualUpload));
    await expect.poll(() => cloud.rows.get(entry.id).entry.doc.formatViews, { timeout: 30_000 }).toEqual(afterManualUpload.formatViews);
    const manualAssetId = cloud.rows.get(entry.id).entry.doc.slides[1].bgImageAssetId;
    await expect.poll(() => cloud.assets.get(manualAssetId), { timeout: 30_000 }).toBe(`data:image/webp;base64,${uploadedPhoto.toString('base64')}`);
    await page.reload();
    await enterEditorFromHome(page, name);
    await selectEditorMode(page, 'diretor');
    await expect.poll(async () => snapshot((await savedEntry(page, name)).doc)).toEqual(snapshot(afterManualUpload));
    await expect.poll(async () => (await savedEntry(page, name)).doc.formatViews).toEqual(afterManualUpload.formatViews);
    expect.soft((await socialRenderGeometry(page))[1].photoRects[0], 'a zona manual de foto reaparece com as mesmas dimensões')
      .toEqual(manualPhotoRect);
    const manualMedia = (await socialRenderedMedia(page))[1].images.filter(image => image.kind === 'photo');
    expect.soft(manualMedia, 'upload manual reaparece com os bytes originais').toEqual([
      { kind: 'photo', loaded: true, bytesSha256: createHash('sha256').update(uploadedPhoto).digest('hex') },
    ]);
    const manualEvidence = { before: snapshot(beforeManualUpload), after: snapshot(afterManualUpload),
      beforeView: beforeManualView, afterView: afterManualView, photoRect: manualPhotoRect,
      assetId: manualAssetId, media: manualMedia, imageRequestsAdded: requests.length - requestsBeforeManualUpload };
    await testInfo.attach('upload-apos-editar-zonas-na-vista-feed', { body: JSON.stringify(manualEvidence, null, 2), contentType: 'application/json' });
    if (directory) {
      const manualDirectory = path.join(directory, 'upload-em-vista-manual');
      fs.mkdirSync(manualDirectory, { recursive: true });
      fs.writeFileSync(path.join(manualDirectory, 'persistido.json'), JSON.stringify(manualEvidence, null, 2));
      await captureSocialDeck(page, manualDirectory, 1350, [1]);
    }
  }
});

test(`Livre social: Remix só texto mantém plano, identidade e mídia (${V2 ? 'V2' : 'legado'})`, async ({ page }, testInfo) => {
  test.setTimeout(100_000);
  const format = FORMATS[0], name = 'Apoteose — Livre social — Remix';
  const proposed = structuredClone(fixture.response);
  proposed.slides[0].title = 'A Apoteose acende o encontro';
  proposed.slides = proposed.slides.map(slide => ({ ...slide, scene: null, imageQuery: '',
    design: { ...slide.design, family: 'poster', layout: 'divider', ground: 'accent', photo: 'none' } }));
  proposed.deckDesign = { ...proposed.deckDesign,
    palette: { bg: '#FFFFFF', surface: '#EDF7F4', ink: '#17382F', muted: '#39705F', accent: '#13795B', accent2: '#DDC300', inverse: '#17382F' },
    fonts: { display: 'Georgia', text: 'Arial', label: 'Arial' } };
  proposed.visualDirection.palette = proposed.visualDirection.palette.map(color => ({ ...color,
    hex: color.role === 'base' ? '#FFFFFF' : '#13795B' }));
  proposed.projectDesign = { layout: 'fullbleed', titleFont: 'Georgia', bodyFont: 'Arial', titleWeight: 400, bg: '#FFFFFF', accent: '#13795B' };
  const { cloud, prompts, requests, runtimeErrors } = await createSocialProject(page, { name, format,
    draftForPrompt: prompt => prompt.includes('REMIX DO CARROSSEL ATUAL') ? proposed : fixture.response });
  await selectEditorMode(page, 'diretor');
  await expect.poll(async () => (await savedEntry(page, name)).doc.slides.filter(slide => slide.bgImageId || slide.bgImageAssetId).length).toBe(3);
  const cards = page.locator('main [data-vc-card-surface]');
  await expect(cards.locator('[data-vc-deck-art]')).toHaveCount(2);
  const before = (await savedEntry(page, name)).doc;
  const beforeSnapshot = snapshot(before), beforeMedia = await socialRenderedMedia(page);
  const requestsBefore = requests.length;
  await page.getByRole('tab', { name: /^Narrativa$/i }).first().click();
  const edit = page.getByRole('button', { name: /EDITAR CARD/i }).first();
  if (await edit.getAttribute('aria-expanded') !== 'true') await edit.click();
  await page.getByRole('group', { name: 'Tom do remix' }).getByRole('button', { name: 'Leve', exact: true }).click();
  await page.getByRole('complementary').getByRole('radio', { name: 'Só texto', exact: true }).check();
  await page.getByRole('button', { name: 'Refazer só texto', exact: true }).click();
  await expect.poll(async () => plain((await savedEntry(page, name)).doc.slides[0].title), { timeout: 30_000 }).toBe(proposed.slides[0].title);
  await expect(page.getByRole('region', { name: 'Geração em andamento' })).toHaveCount(0);
  const after = (await savedEntry(page, name)).doc;
  const afterSnapshot = snapshot(after), afterMedia = await socialRenderedMedia(page);
  const evidence = { before: beforeSnapshot, after: afterSnapshot, beforeMedia, afterMedia, prompts,
    imageRequestsBefore: requestsBefore, imageRequestsAfter: requests.length };
  await testInfo.attach('remix-textual-antes-depois', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  if (process.env.QA_OUTPUT_DIR) {
    const directory = path.join(process.env.QA_OUTPUT_DIR, 'remix');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'persistido.json'), JSON.stringify(evidence, null, 2));
  }
  expect.soft(prompts.some(prompt => prompt.includes('REMIX DO CARROSSEL ATUAL'))).toBe(true);
  expect.soft(requests.length, 'Remix só texto não solicita fotos nem nova arte').toBe(requestsBefore);
  for (const field of ['fmt', 'mode', 'visualPreset', 'brandChrome', 'material', 'topic', 'bible', 'plan', 'deck']) {
    expect.soft(afterSnapshot[field], `Remix preserva ${field}`).toEqual(beforeSnapshot[field]);
  }
  const withoutText = ({ title, subtitle, bodyAfterImage, ...rest }) => rest;
  expect.soft(afterSnapshot.slides.map(withoutText), 'Remix ignora proposta de paleta/famílias/layout e preserva ordem/IDs')
    .toEqual(beforeSnapshot.slides.map(withoutText));
  expect.soft(afterMedia, 'Remix preserva os bytes realmente desenhados das fotos, arte e logos').toEqual(beforeMedia);
  expect.soft(runtimeErrors).toEqual([]);
  await page.getByRole('button', { name: 'Salvar projeto agora', exact: true }).click();
  const entry = await savedEntry(page, name);
  await expect.poll(() => cloud.rows.get(entry.id)?.entry.doc && snapshot(cloud.rows.get(entry.id).entry.doc), { timeout: 30_000 }).toEqual(afterSnapshot);
  expect.soft(cloud.rows.size, 'Remix atualiza o mesmo projeto').toBe(1);
  await page.reload();
  await enterEditorFromHome(page, name);
  await selectEditorMode(page, 'diretor');
  await expect.poll(async () => snapshot((await savedEntry(page, name)).doc)).toEqual(afterSnapshot);
  await expect(cards.first()).toContainText(proposed.slides[0].title);
  expect.soft(await socialRenderedMedia(page)).toEqual(beforeMedia);
});
