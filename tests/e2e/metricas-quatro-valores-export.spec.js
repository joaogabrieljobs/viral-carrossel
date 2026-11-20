import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { familySpec } from '../../src/utils/presentation-families.js';
import { applyPresentationVisualPreset, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';

// MF-13 (reteste 20/11): Relatório no estilo Técnico com quadro de 4 valores.
// O quarto valor ("36 horas", "Ter-Dom, 7h–13h") saía cortado na borda e o PDF
// era barrado no slide 3. Mesmo conteúdo do projeto R05 do reteste.
test.use({ viewport: { width: 1600, height: 1100 } });

test('quadro de 4 valores com texto longo cabe na coluna e exporta PDF sem edição', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const preset = familySpec('technical').runtimeId;
  const items = [
    { title: 'Indicadores de operação disponíveis', subtitle: 'Indicadores de operação em 2025: volume anual de vendas, equipe, variedades de pão e tempo de fermentação.',
      blocks: [{ type: 'metrics', items: [
        { value: '41.200', label: 'Pães vendidos em 2025', detail: 'Volume anual' },
        { value: '6', label: 'Funcionários', detail: 'Equipe da padaria' },
        { value: '3', label: 'Variedades de pão', detail: 'Camponês, integral e brioche' },
        { value: '36 horas', label: 'Fermentação natural', detail: 'Tempo de processo de cada pão' },
      ] }] },
    { title: 'Oferta, horário e condições de acesso', subtitle: 'Três variedades com preços definidos; funcionamento de terça a domingo, das 7h às 13h.',
      blocks: [{ type: 'metrics', items: [
        { value: 'R$ 24', label: 'Camponês', detail: 'Fermentação natural de 36 horas' },
        { value: 'R$ 26', label: 'Integral', detail: 'Fermentação natural de 36 horas' },
        { value: 'R$ 18', label: 'Brioche', detail: 'Fermentação natural de 36 horas' },
        { value: 'Ter-Dom, 7h–13h', label: 'Funcionamento', detail: 'Encomenda pelo WhatsApp com 1 dia de antecedência' },
      ] }] },
  ];
  const slides = items.map((s, index) => {
    const slide = { ...mkSlide(index + 1, DEFAULT_BRAND), id: `metricas-${index}`, title: s.title, subtitle: s.subtitle,
      bodyAfterImage: '', presentationBlocks: s.blocks, elementsUnlocked: true, useCultureLayout: false, bgImage: '', imageQuery: '',
      presentationPlan: { visualRole: 'data', purpose: 'metrics' } };
    return { ...slide, ...getPresentationCompositionOverrides(preset, { slide, index: index + 2, count: 11 }) };
  });
  const project = { id: 'metricas-4', name: 'Relatório métricas', doc: {
    fmt: 'apresentacao', productKind: 'apresentacao', creativePreset: 'apresentacao', visualPreset: preset,
    brand: applyPresentationVisualPreset({ ...DEFAULT_BRAND, showHandle: false, logo: null }, preset), slides } };
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(p => {
    if (localStorage.getItem('vc_library')) return;
    localStorage.setItem('vc_library', JSON.stringify([p]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(p.id));
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
  }, project);
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  const blocks = page.locator('main [data-vc-presentation-block="metrics"]');
  await expect(blocks).toHaveCount(2);
  await page.evaluate(() => document.fonts.ready);
  // Nenhum valor ultrapassa a própria coluna (antes: "36 horas" e o horário cortados).
  const overflow = await blocks.evaluateAll(nodes => nodes.flatMap(node => [...node.querySelectorAll('[data-vc-evidence-cell]')]
    .filter(cell => cell.scrollWidth > cell.clientWidth + 1 || cell.getBoundingClientRect().right > node.getBoundingClientRect().right + 1)
    .map(cell => cell.textContent)));
  expect(overflow).toEqual([]);
  await page.locator('main [data-vc-card-surface="metricas-1"]').screenshot({ path: testInfo.outputPath('quadro-4-valores.png') });
  await page.getByRole('button', { name: 'Opções de download', exact: true }).click();
  const [pdf] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByRole('menuitem', { name: 'Apresentação em PDF', exact: true }).click(),
  ]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  // Reteste 20/11: o rótulo do lote de imagens passava da altura do botão.
  await page.getByText('Narrativa', { exact: true }).first().click();
  const generate = page.getByRole('button', { name: /^Gerar imagens \(\d+\)$/ });
  await expect(generate).toBeVisible();
  const box = await generate.evaluate(button => ({ scroll: button.scrollHeight, client: button.clientHeight }));
  expect(box.scroll).toBeLessThanOrEqual(box.client + 1);
  await generate.locator('..').screenshot({ path: testInfo.outputPath('botoes-narrativa.png') });
});
