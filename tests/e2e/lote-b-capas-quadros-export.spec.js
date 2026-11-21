import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { applyPresentationVisualPreset, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { presentationStageAt } from '../../src/utils/presentation-state.js';

// Lote B (reteste 21/11): o quadro de 3 valores do C02 Pitch (Editorial) cortava
// "Terça a domingo" e barrava o PDF. As capas do C07 e do C06 são cobertas no
// fluxo de geração (lote-b-capa-geracao-export.spec.js), onde o passo final age.
test.use({ viewport: { width: 1600, height: 1100 } });

const CASES = [
  { key: 'c02', preset: 'presentation_editorial_magazine', path: 'pitch', index: 5, count: 13, slide: {
    title: '41.200 pães vendidos em 2025 sustentam a demanda do bairro',
    subtitle: '6 funcionários, terça a domingo, produziram e venderam 41.200 pães em 2025. Resultado realizado, não projeção.',
    bodyAfterImage: '', presentationPlan: { visualRole: 'data', purpose: 'metrics' },
    presentationBlocks: [{ type: 'metrics', items: [
      { label: 'Pães vendidos em 2025', value: '41.200', detail: 'Volume realizado no ano, no Rio Vermelho' },
      { label: 'Equipe', value: '6 funcionários', detail: 'Produção e atendimento' },
      { label: 'Funcionamento', value: 'Terça a domingo', detail: 'Das 7h às 13h' },
    ] }] } },
];

for (const c of CASES) test(`${c.key}: slide gerado exporta PDF sem edição`, async ({ page }) => {
  test.setTimeout(120_000);
  const base = { ...mkSlide(1, DEFAULT_BRAND), id: `${c.key}-slide`, elementsUnlocked: true, useCultureLayout: false,
    bgImage: '', imageQuery: c.slide.presentationPlan.visualRole === 'cover' ? 'bakery' : '', presentationBlocks: [], ...c.slide };
  const stage = presentationStageAt(c.path, c.index, c.count);
  const slide = { ...base, ...getPresentationCompositionOverrides(c.preset, { slide: base, stage, index: c.index, count: c.count }) };
  const project = { id: `lote-b-${c.key}`, name: `Lote B ${c.key}`, doc: {
    fmt: 'apresentacao', productKind: 'apresentacao', creativePreset: 'apresentacao', visualPreset: c.preset, presentationPath: c.path,
    brand: applyPresentationVisualPreset({ ...DEFAULT_BRAND, showHandle: false, logo: null }, c.preset), slides: [slide] } };
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(p => {
    if (localStorage.getItem('vc_library')) return;
    localStorage.setItem('vc_library', JSON.stringify([p]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(p.id));
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
  }, project);
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await expect(page.locator('main [data-vc-card-surface]')).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Opções de download', exact: true }).click();
  const download = page.waitForEvent('download', { timeout: 30_000 }).then(d => d, () => null);
  await page.getByRole('menuitem', { name: 'Apresentação em PDF', exact: true }).click();
  const blocked = page.getByText(/Slide 1: /).first();
  const result = await Promise.race([download, blocked.waitFor({ timeout: 30_000 }).then(() => 'blocked', () => null)]);
  if (result === 'blocked') throw new Error(`Exportação barrada: ${await blocked.textContent()}`);
  expect(result?.suggestedFilename?.()).toMatch(/\.pdf$/);
});
