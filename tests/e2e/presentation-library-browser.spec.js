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
  test.setTimeout(60_000);
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
    localStorage.setItem('vc_library', JSON.stringify([project]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(project.id));
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
  }, project);
  await page.goto('/?app=1');
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
    await expect(card).toContainText(items[index].title.replaceAll('\n', ' '), { useInnerText: true });
    await expect.poll(() => card.getAttribute('data-vc-framing-pending')).not.toBe('true');
    const overflow = await card.locator('[data-vc-overflow-at-floor="true"]').count();
    expect(overflow, `${key}/${items[index].kind}: texto no piso de tamanho`).toBe(0);
    if ([0, 4, 5].includes(index)) await card.screenshot({ path: info.outputPath(`${key}-${items[index].kind}.png`) });
  }
  const evidence = cards.nth(4).locator('[data-vc-evidence-surface]');
  await expect(evidence).toHaveCount(1);
  const clipping = await evidence.evaluate(panel => [panel, ...panel.querySelectorAll('[data-vc-evidence-cell]')].filter(node =>
    node.scrollWidth > node.clientWidth + 3 || node.scrollHeight > node.clientHeight + 3).map(node => node.textContent));
  expect(clipping, `${key}: células cortadas`).toEqual([]);
});
