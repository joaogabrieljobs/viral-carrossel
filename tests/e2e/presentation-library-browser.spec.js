import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { FAMILY_KEYS, familySpec } from '../../src/utils/presentation-families.js';
import { applyPresentationVisualPreset, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';

// Renderer real do editor, com serviços simulados. Não valida geração por IA.
// Mesma foto local para isolar o layout; conteúdo da demonstração é fictício.
const contents = JSON.parse(readFileSync(new URL('../../docs/presentation/template-gallery-content.json', import.meta.url)));
const photo = `data:image/jpeg;base64,${readFileSync(new URL('../../public/landing/hero-creator-photo.jpg', import.meta.url)).toString('base64')}`;
test.use({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 2 });

for (const key of FAMILY_KEYS) test(`biblioteca 2 real: ${key}, seis páginas com fontes locais`, async ({ page }, info) => {
  test.setTimeout(150_000);
  const preset = familySpec(key).runtimeId;
  const items = contents.decks[key].slides;
  const slides = items.map((s, index) => {
    const slide = { ...mkSlide(index + 1, DEFAULT_BRAND), id: `${key}-${index}`,
      title: s.title, subtitle: s.subtitle || '', bodyAfterImage: s.body || '', eyebrow: s.eyebrow || '', photoCaption: s.caption || '',
      presentationBlocks: s.blocks || [], elementsUnlocked: true, useCultureLayout: false,
      bgImage: s.photo == null ? '' : photo, imageQuery: s.photo == null ? '' : 'controlled illustrative photo',
      presentationPlan: { visualRole: s.kind, purpose: s.kind === 'data' ? 'comparison' : 'explain' } };
    return { ...slide, ...getPresentationCompositionOverrides(preset, { slide, index, count: items.length }) };
  });
  const project = { id: `library-${key}`, name: `Biblioteca 2 — ${key}`, doc: {
    fmt: 'apresentacao', productKind: 'apresentacao', creativePreset: 'apresentacao', visualPreset: preset,
    brand: applyPresentationVisualPreset({ ...DEFAULT_BRAND, showHandle: false, logo: null }, preset), slides } };
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(project => {
    if (localStorage.getItem('vc_library')) return;
    localStorage.setItem('vc_library', JSON.stringify([project]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(project.id));
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
  }, project);
  await page.goto('/?app=1');
  // A primeira abertura migra as fotos do fixture para o IndexedDB; sob carga isso passa de 5 s.
  await expect(page.locator('[data-vc-tour="account-home"]')).toBeVisible({ timeout: 30_000 });
  await enterEditorFromHome(page);
  await expect(page.locator('#vc-presentation-fonts')).toHaveCount(1);
  const cards = page.locator('main [data-vc-card-surface]');
  await expect(cards).toHaveCount(6);
  await page.evaluate(async () => {
    const fonts = new Map();
    for (const el of document.querySelectorAll('main [data-vc-card-surface] h1, main [data-vc-card-surface] p, main [data-vc-evidence-cell]')) {
      const s = getComputedStyle(el);
      fonts.set(`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`, el.textContent || 'Ação');
    }
    await Promise.all([...fonts].map(async ([font, text]) => {
      const faces = await document.fonts.load(font, text + 'A');
      if (!faces.length || faces.some(f => f.status !== 'loaded')) throw new Error(`Fonte não carregada: ${font}`);
    }));
    await document.fonts.ready;
  });
  for (let index = 0; index < 6; index++) {
    const card = cards.nth(index);
    await expect(card.locator(`[data-vc-presentation-art="${key}"]`)).toHaveCount(1);
    await expect(card).toContainText(items[index].title.replaceAll('\n', ' '), { useInnerText: true, ignoreCase: true });
    await expect.poll(() => card.getAttribute('data-vc-framing-pending')).not.toBe('true');
    await expect.poll(() => card.locator('[data-vc-overflow-at-floor="true"]').evaluateAll(nodes => nodes.map(n => ({
      text: n.textContent, client: [n.clientWidth, n.clientHeight], scroll: [n.scrollWidth, n.scrollHeight],
      css: { justify: getComputedStyle(n).justifyContent, padding: getComputedStyle(n).padding, transform: getComputedStyle(n).transform },
      children: [...n.children].map(c => ({ text: c.textContent, size: getComputedStyle(c).fontSize, box: [c.offsetWidth, c.offsetHeight] })),
      headings: [...n.querySelectorAll('h1')].map(c => ({ size: getComputedStyle(c).fontSize, line: getComputedStyle(c).lineHeight,
        padding: getComputedStyle(c).padding, height: c.clientHeight, scroll: c.scrollHeight, margin: getComputedStyle(c).margin })),
    }))), { message: `${key}/${items[index].kind}: texto no piso de tamanho` }).toEqual([]);
    if ([0, 4, 5].includes(index)) await card.screenshot({ path: info.outputPath(`${key}-${items[index].kind}.png`) });
  }
  const evidence = cards.nth(4).locator('[data-vc-evidence-surface]');
  await expect(evidence).toHaveCount(1);
  const clipping = await evidence.evaluate(panel => [panel, ...panel.querySelectorAll('[data-vc-evidence-cell]')].filter(node =>
    node.scrollWidth > node.clientWidth + 3 || node.scrollHeight > node.clientHeight + 3).map(node => node.textContent));
  expect(clipping, `${key}: células cortadas`).toEqual([]);
  // Estado de carregamento da foto (bgImageFailed/bgImageError) é gravado ao hidratar; não é conteúdo.
  const canonical = () => page.evaluate(() => (JSON.parse(localStorage.getItem('vc_library') || '[]')[0]?.doc?.slides || [])
    .map(({ bgImageFailed, bgImageError, ...slide }) => {
      if (bgImageFailed) slide.bgImageFailed = bgImageFailed;
      if (bgImageError) slide.bgImageError = bgImageError;
      return slide;
    }));
  const originalSlides = await canonical();
  for (const [fmt, label, ratio] of [['carrossel', 'Feed 4:5', '4:5'], ['quadrado', 'Quadrado', '1:1'], ['stories', 'Stories', '9:16']]) {
    await page.getByRole('button', { name: label, exact: true }).first().click();
    await expect.poll(() => cards.first().getAttribute('data-vc-presentation')).toBe('true');
    for (let index = 0; index < 6; index++) {
      const card = cards.nth(index);
      await expect(card.locator(`[data-vc-presentation-art="${key}"]`)).toHaveCount(1);
      await expect(card).toContainText(items[index].title.replaceAll('\n', ' '), { useInnerText: true, ignoreCase: true });
      await expect.poll(() => card.locator('[data-vc-overflow-at-floor="true"]').count(), { message: `${key}/${fmt}/${index}: texto transborda` }).toBe(0);
      if ([0, 4, 5].includes(index)) await card.screenshot({ path: info.outputPath(`${key}-${fmt}-${items[index].kind}.png`) });
    }
    const panel = cards.nth(4).locator('[data-vc-evidence-surface]');
    await expect(panel).toHaveCount(1);
    const cuts = await panel.evaluate(panel => [panel, ...panel.querySelectorAll('[data-vc-evidence-cell]')].filter(n =>
      n.scrollWidth > n.clientWidth + 3 || n.scrollHeight > n.clientHeight + 3).map(n => n.textContent));
    expect(cuts, `${key}/${fmt}: evidência cortada`).toEqual([]);
    // O dado canônico continua em 16:9: apenas a vista muda.
    expect(await canonical()).toEqual(originalSlides);
    const frame = await cards.first().evaluate(n => { const r = n.getBoundingClientRect(); return r.width / r.height; });
    expect(frame).toBeCloseTo({ '4:5': .8, '1:1': 1, '9:16': 9 / 16 }[ratio], 2);
  }
  // Reabrir só depois de o autosave gravar a vista escolhida.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]')[0]?.doc?.fmt)).toBe('stories');
  await page.reload();
  await expect(page.locator('[data-vc-tour="account-home"]')).toBeVisible({ timeout: 30_000 });
  await enterEditorFromHome(page);
  await expect(page.getByRole('button', { name: 'Stories', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
  await expect(cards).toHaveCount(6);
  await expect(cards.first().locator(`[data-vc-presentation-art="${key}"]`)).toHaveCount(1);
  const reopened = await cards.first().evaluate(n => { const r = n.getBoundingClientRect(); return r.width / r.height; });
  expect(reopened).toBeCloseTo(9 / 16, 2);
  expect(await canonical()).toEqual(originalSlides);
});

test('PNG preserva o tratamento preto e branco da família Suíço', async ({ page }, info) => {
  test.setTimeout(90_000);
  // Imagem vermelha controlada: o PNG deve conter cinza, não apenas ter filtro no DOM.
  const red = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#ff0000"/></svg>').toString('base64')}`;
  const preset = familySpec('swiss').runtimeId;
  const base = { ...mkSlide(1, DEFAULT_BRAND), id: 'swiss-export', title: 'Forma e função', subtitle: 'Ensaio de exportação.',
    bgImage: red, elementsUnlocked: true, useCultureLayout: false, presentationPlan: { visualRole: 'cover', purpose: 'explain' } };
  const slide = { ...base, ...getPresentationCompositionOverrides(preset, { slide: base, index: 0, count: 1 }) };
  const project = { id: 'swiss-export', name: 'Ensaio PNG Suíço', doc: {
    fmt: 'apresentacao', productKind: 'apresentacao', creativePreset: 'apresentacao', visualPreset: preset,
    brand: applyPresentationVisualPreset({ ...DEFAULT_BRAND, showHandle: false, logo: null }, preset), slides: [slide] } };
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(project => {
    localStorage.setItem('vc_library', JSON.stringify([project]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(project.id));
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
  }, project);
  await page.goto('/?app=1');
  await expect(page.locator('[data-vc-tour="account-home"]')).toBeVisible({ timeout: 30_000 });
  await enterEditorFromHome(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /baixar card 1/i }).click(),
  ]);
  await download.saveAs(info.outputPath('swiss-photo-filter.png'));
  const stream = await download.createReadStream();
  const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const encoded = Buffer.concat(chunks).toString('base64');
  const result = await page.evaluate(async ({ encoded, zone }) => {
    const img = new Image(); img.src = `data:image/png;base64,${encoded}`; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, (zone.x + zone.w / 2) / 100 * img.width, (zone.y + zone.h / 2) / 100 * img.height, 1, 1, 0, 0, 1, 1);
    return { pixel: [...ctx.getImageData(0, 0, 1, 1).data], width: img.width, height: img.height };
  }, { encoded, zone: slide.canvas.zones.photo });
  expect(result.width / result.height).toBeCloseTo(16 / 9, 3);
  const [r, g, b, a] = result.pixel;
  expect(a).toBeGreaterThan(240);
  expect(r).toBeGreaterThan(15);
  expect(r).toBeLessThan(200);
  expect(Math.abs(r - g)).toBeLessThanOrEqual(2);
  expect(Math.abs(g - b)).toBeLessThanOrEqual(2);
});
