import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

// Apoteose 9 (27/11, iPhone): ao trocar a apresentação Livre de 16:9 para
// 9:16, o apoio dos slides 6 e 7 virava uma linha de ~6 px. Piso de leitura
// do apoio em Feed, Quadrado e Stories: 28 px a 1080.
const fixture = JSON.parse(fs.readFileSync(new URL('../fixtures/apoteose-teste8.json', import.meta.url)));
const svg = content => 'data:image/svg+xml;base64,' + Buffer.from(content).toString('base64');
const photo = svg('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><defs><linearGradient id="g"><stop stop-color="#5a2a7a"/><stop offset="1" stop-color="#e05030"/></linearGradient></defs><path fill="url(#g)" d="M0 0h1600v1200H0z"/><circle cx="800" cy="520" r="300" fill="#f0a080"/></svg>');

function apoteoseDoc() {
  const doc = structuredClone(fixture.doc);
  const media = slide => ({
    ...(slide.bgImageId ? { bgImageId: null, bgImage: photo } : {}),
    ...(slide.presentationArtImageId ? { presentationArtImageId: null, presentationArtImageAssetId: null, presentationArtImage: photo } : {}),
  });
  const [content, art] = [doc.slides[2], doc.slides[6]];
  doc.slides = [
    ...doc.slides.map(slide => ({ ...slide, ...media(slide) })),
    // As duas páginas das capturas do iPhone (família Foto com foto acima e
    // Cinemática com foto cheia), com o texto delas.
    { ...content, id: 'apoteose9-6', presentationDesignFamily: 'photo', presentationFreeDesign: { ...content.presentationFreeDesign, family: 'photo' },
      title: 'Para quem é a Apoteose', eyebrow: 'O PÚBLICO', bgImageId: null, bgImage: photo, bodyAfterImage: '',
      subtitle: 'Pessoas socialmente ativas, **formadoras de opinião**, conectadas a tendências de moda, cultura e entretenimento. O acesso exclusivo por convite privilegia a **curadoria de público** e fortalece o caráter social da festa.' },
    { ...art, id: 'apoteose9-7', presentationDesignFamily: 'cinematic', presentationFreeDesign: { ...art.presentationFreeDesign, family: 'cinematic' },
      presentationArtImageId: null, presentationArtImageAssetId: null, bgImage: photo, bodyAfterImage: '',
      title: 'O **esquenta** de Carnaval de São Paulo', eyebrow: 'O POSICIONAMENTO',
      subtitle: 'A Apoteose pretende se consolidar como o **esquenta** mais badalado da cidade, uma festa com **identidade própria** que gera desejo e expectativa antes mesmo de acontecer.' },
  ];
  return doc;
}

async function openDeck(page, viewport) {
  await page.setViewportSize(viewport);
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol) ? route.continue() : route.abort();
  });
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(({ doc }) => {
    if (localStorage.getItem('apoteose-leitura-seeded')) return;
    localStorage.setItem('apoteose-leitura-seeded', '1');
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('apoteose9'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'apoteose9', name: 'Apoteose 9', doc }]));
  }, { doc: apoteoseDoc() });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await expect(page.locator('main [data-vc-card-surface]').first()).toBeVisible();
}

/** Tamanho (px nativos do card) de cada parágrafo do apoio, depois de o ajuste assentar. */
async function readingSizes(page) {
  const read = () => page.locator('main [data-vc-card-surface]').evaluateAll(cards => cards.map(card => {
    const zone = card.querySelector('[data-vc-zone="subtitle"]');
    if (!zone) return { id: card.getAttribute('data-vc-card-surface'), sizes: [] };
    const children = [...zone.children].reduce((sum, child) => sum + child.offsetHeight, 0);
    const pad = parseFloat(getComputedStyle(zone).paddingTop) + parseFloat(getComputedStyle(zone).paddingBottom);
    return {
      id: card.getAttribute('data-vc-card-surface'),
      native: zone.parentElement.offsetWidth,
      scale: Number(zone.getAttribute('data-vc-overflow-scale')),
      sizes: [...zone.querySelectorAll('p')].filter(p => p.textContent.trim()).map(p => Math.round(parseFloat(getComputedStyle(p).fontSize) * 10) / 10),
      cut: children + pad > zone.clientHeight + 2 ? `${children}+${pad} > ${zone.clientHeight}` : false,
    };
  }));
  let previous = '';
  await expect.poll(async () => {
    const current = JSON.stringify(await read());
    const stable = current === previous;
    previous = current;
    return stable;
  }, { intervals: [400, 400, 600, 800, 1000] }).toBe(true);
  return JSON.parse(previous);
}

// Texto e composição 16:9 gravados (a mídia sai do `data:` para o
// IndexedDB ao abrir; isso não é composição).
const storedSlides = page => page.evaluate(() => {
  const doc = JSON.parse(localStorage.getItem('vc_library') || '[]').find(project => project.id === 'apoteose9')?.doc;
  const keys = ['id', 'title', 'subtitle', 'bodyAfterImage', 'eyebrow', 'canvas', 'titleSize', 'subSize', 'bodyAfterSize',
    'elementOffsets', 'presentationComposition', 'presentationDesignFamily', 'presentationTypographyByComposition', 'presentationChrome'];
  return JSON.stringify({ slides: doc?.slides?.map(slide => keys.map(key => slide[key])), view: doc?.formatViews?.apresentacao });
});

test('apresentação Livre: apoio legível em Stories, Feed e Quadrado; 16:9 volta igual', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await openDeck(page, { width: 1680, height: 1000 });
  const slidesBefore = await storedSlides(page);
  const original = await readingSizes(page);
  // 16:9: o corpo arrastado (deslocamento gravado) não pode levar o apoio
  // inteiro ao piso absoluto do ajuste (0,28).
  for (const card of original) {
    for (const size of card.sizes) expect(size, `16:9 ${card.id}`).toBeGreaterThanOrEqual(20);
    expect(card.scale, `16:9 ${card.id}`).toBeGreaterThan(0.44);
  }
  const report = { '16:9': original };
  for (const [label, key] of [['Stories', 'stories'], ['Feed 4:5', 'carrossel'], ['Quadrado', 'quadrado']]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    const cards = await readingSizes(page);
    report[key] = cards;
    for (const card of cards) {
      expect(card.native, `${key} ${card.id}`).toBe(1080);
      for (const size of card.sizes) expect(size, `${key} ${card.id}: apoio a ${size}px`).toBeGreaterThanOrEqual(27.9);
      expect(card.cut, `${key} ${card.id}: apoio cortado`).toBe(false);
    }
    await page.locator('main [data-vc-card-surface="apoteose9-6"]').screenshot({ path: testInfo.outputPath(`${key}-slide6.png`) });
    await page.locator('main [data-vc-card-surface="apoteose9-7"]').screenshot({ path: testInfo.outputPath(`${key}-slide7.png`) });
  }
  fs.writeFileSync(testInfo.outputPath('medidas.json'), JSON.stringify(report, null, 1));
  await page.getByRole('button', { name: 'Apresentação 16:9', exact: true }).click();
  expect(await readingSizes(page)).toEqual(original);
  // A troca de formato só grava o formato; o conteúdo e a composição 16:9 ficam.
  expect(await storedSlides(page)).toBe(slidesBefore);
  await page.reload();
  await enterEditorFromHome(page);
  expect(await storedSlides(page)).toBe(slidesBefore);
  expect(await readingSizes(page)).toEqual(original);
});

test('iPhone em pé: Stories mostra o apoio das páginas 6 e 7 no piso de leitura', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await openDeck(page, { width: 430, height: 932 });
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  for (const [id, position] of [['apoteose9-6', 10], ['apoteose9-7', 11]]) {
    await page.getByRole('button', { name: `Ir para slide ${position}`, exact: true }).click();
    const card = page.locator(`main [data-vc-card-surface="${id}"]`);
    await expect(card).toBeVisible();
    const sizes = (await readingSizes(page)).find(item => item.id === id);
    expect(sizes.sizes.length).toBeGreaterThan(0);
    for (const size of sizes.sizes) expect(size).toBeGreaterThanOrEqual(27.9);
    expect(sizes.cut).toBe(false);
    await card.screenshot({ path: testInfo.outputPath(`iphone-${id}.png`) });
  }
});
