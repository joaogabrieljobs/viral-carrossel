import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';
import { applyVisualPreset, VISUAL_PRESETS } from '../../src/styles/visual-presets.jsx';
import { PRESENTATION_VISUAL_PRESETS, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { applySocialVisualComposition } from '../../src/utils/social-visual-composition.js';

// Ensaio controlado do renderer, sem IA ou conta de produção. A mesma foto
// local e os mesmos textos deixam a diferença de design visível na comparação.
const photo = `data:image/jpeg;base64,${readFileSync(new URL('../../public/landing/hero-creator-photo.jpg', import.meta.url)).toString('base64')}`;
const fixtures = [
  ['social', 'editorial_magazine'], ['social', 'mood_sepia'],
  ['social', 'authority_black'], ['social', 'tabloid_keywords'],
  ['presentation', 'presentation_executive_minimal'], ['presentation', 'presentation_photo_essay'],
  ['presentation', 'presentation_cinematic'], ['presentation', 'presentation_modular_cards'],
];
for (const [kind, presetId] of fixtures) test(`design editável ${presetId}`, async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  const presentation = kind === 'presentation';
  const catalog = presentation ? PRESENTATION_VISUAL_PRESETS : VISUAL_PRESETS;
  const preset = catalog.find(p => p.id === presetId);
  const brand = applyVisualPreset({ showHandle: false, logo: null }, presetId, catalog);
  const source = [
    { title: 'Boas ideias merecem uma forma à altura.', subtitle: 'Texto, fotografia e hierarquia trabalham juntos para tornar a mensagem clara.', bodyAfterImage: 'Ensaio de composição com conteúdo demonstrativo.' },
    { title: 'O assunto precisa continuar dentro da imagem.', subtitle: 'A foto tem uma área própria e o texto recebe espaço para ser lido com conforto.', bodyAfterImage: 'Este apoio precisa aparecer no resultado final.' },
    { title: 'Uma identidade que acompanha toda a sequência.', subtitle: 'A paleta e a tipografia permanecem coerentes enquanto a organização muda.', bodyAfterImage: 'Próximo passo: revisar a composição antes de exportar.' },
  ].map((s, index) => ({ ...s, id: `design-${index}`, num: index + 1, bgImage: photo,
    imageQuery: 'editorial portrait of a person creating content', elementsUnlocked: true, useCultureLayout: false,
    ...(presentation ? { presentationPlan: { visualRole: index === 1 ? 'demo' : 'content', purpose: 'explain' } } : {}),
  }));
  const slides = presentation ? source.map((s, index) => ({ ...s,
    ...getPresentationCompositionOverrides(presetId, { slide: s, index, count: source.length }),
  })) : applySocialVisualComposition(source, { preset });
  const project = { id: 'design-fixture', name: preset.label, doc: {
    fmt: presentation ? 'apresentacao' : 'carrossel', productKind: presentation ? 'apresentacao' : 'carrossel',
    creativePreset: presentation ? 'apresentacao' : 'livre', visualPreset: presetId, brand, slides,
  } };
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.setViewportSize({ width: 1680, height: 1000 });
  await page.addInitScript(project => {
    if (sessionStorage.getItem('design-fixture')) return;
    sessionStorage.setItem('design-fixture', '1');
    localStorage.setItem('vc_library', JSON.stringify([project]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(project.id));
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
  }, project);
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  const cards = page.locator('main [data-vc-card-surface]');
  await expect(cards).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
  for (let index = 0; index < 3; index++) {
    const card = cards.nth(index);
    await expect(card).toContainText(source[index].bodyAfterImage);
    await expect.poll(() => card.locator('[data-vc-photo-zone]').count()).toBeGreaterThan(0);
    await expect(card).not.toHaveAttribute('data-vc-framing-pending', 'true');
    await card.screenshot({ path: testInfo.outputPath(`slide-${index + 1}.png`) });
  }
  const boxes = await cards.nth(1).evaluate(card => [...card.querySelectorAll('[data-vc-quality-zone="title"], [data-vc-quality-zone="subtitle"]')].map(el => {
    const r = el.getBoundingClientRect(), parent = card.getBoundingClientRect();
    return { top: r.top - parent.top, bottom: r.bottom - parent.top, height: parent.height };
  }));
  for (const box of boxes) {
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(box.height + 1);
  }
});
