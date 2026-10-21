import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

test('native evidence stays editable, survives reload and exports with the same data', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1680, height: 1000 });
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol) ? route.continue() : route.abort();
  });
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(() => {
    if (localStorage.getItem('native-evidence-seeded')) return;
    localStorage.setItem('native-evidence-seeded', '1');
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('native-evidence'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'native-evidence', name: 'Receitas', doc: {
      fmt: 'apresentacao', productKind: 'apresentacao', creativePreset: 'apresentacao',
      brand: { bg: '#111716', titleColor: '#ffffff', subtitleColor: '#ffffff', textColor: '#ffffff',
        titleFont: 'Arial', subtitleFont: 'Arial', bodyFont: 'Arial', subtitleCase: 'normal', showHandle: false, showPageBadge: false,
        logo: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><text x="10" y="80" font-family="Arial" font-size="80" fill="white">MARCA</text></svg>')}` },
      slides: [{ id: 'native-1', title: 'Receitas com escopo claro', subtitle: 'A relação recorrente sustenta o acompanhamento.',
        bodyAfterImage: '', layout: 'tl', align: 'left', elementsUnlocked: true,
        titleSize: 42, subSize: 68, titleCase: 'normal',
        logoSize: 80, logoPosition: 'tl',
        presentationCompositionId: 'presentation_data', presentationComposition: 'data',
        presentationQualityVersion: 1, presentationSuppressPhoto: true,
        presentationBlocks: [{ type: 'comparison', headers: ['Oferta', 'Condição'], rows: [['Assinatura', 'Preço em estudo'], ['Teste', 'Compra opcional']] }],
        canvas: { source: 'presentation-preset', applied: true, variant: 'classic', preserveZones: true, zones: {
          photo: { x: 96, y: 94, w: 1, h: 1 }, title: { x: 6, y: 25, w: 88, h: 14 },
          subtitle: { x: 6, y: 42, w: 88, h: 12 }, evidence: { x: 6, y: 57, w: 88, h: 35 },
        } },
      }],
    } }]));
  });
  await page.goto('/?app=1');
  const card = page.locator('main [data-vc-card-surface="native-1"]');
  await expect(card.getByRole('table', { name: 'Comparação' })).toBeVisible();
  await expect(card.locator('[data-vc-photo-zone]')).toHaveCount(0);
  const cell = card.getByLabel('Editar linha 1, coluna 2', { exact: true });
  await cell.dblclick();
  await expect(cell).toHaveAttribute('contenteditable', 'true');
  await cell.fill('US$ 365/ano · primeiro ano');
  await cell.press('Control+Enter');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]')
    .find(p => p.id === 'native-evidence')?.doc?.slides?.[0]?.presentationBlocks?.[0]?.rows?.[0]?.[1])).toBe('US$ 365/ano · primeiro ano');
  await page.reload();
  await expect(card).toContainText('US$ 365/ano · primeiro ano');
  // The logo lives in a square contain box; only its measured ink occupies
  // space. Wait for the wordmark to load before comparing actual visible ink.
  await expect.poll(() => card.locator('[data-vc-logo-visible-rect]').evaluate(element => {
    const [, , , inkHeight] = element.getAttribute('data-vc-logo-visible-rect').split(',').map(Number);
    return inkHeight > 0 && inkHeight < element.clientHeight;
  })).toBe(true);
  const logoPlacement = await card.evaluate(root => ({
    logo: (() => {
      const element = root.querySelector('[data-vc-logo-visible-rect]');
      const [, y, , height] = element.getAttribute('data-vc-logo-visible-rect').split(',').map(Number);
      const bounds = element.getBoundingClientRect();
      return bounds.top + (y + height) * bounds.height / element.clientHeight;
    })(),
    title: root.querySelector('[data-vc-quality-zone="title"]').getBoundingClientRect().top,
  }));
  expect(logoPlacement.logo).toBeLessThan(logoPlacement.title);
  await expect(page.locator('[data-vc-export-tree] [data-vc-presentation-block="comparison"]')).toContainText('US$ 365/ano · primeiro ano');
  await card.screenshot({ path: testInfo.outputPath('native-evidence.png') });
  await page.getByRole('button', { name: 'Opções de download', exact: true }).click();
  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Apresentação em PDF', exact: true }).click(),
  ]);
  expect(pdf.suggestedFilename()).toBe('apresentacao-receitas.pdf');
  await pdf.saveAs(testInfo.outputPath('native-evidence.pdf'));
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  await expect(card.getByRole('table', { name: 'Comparação' })).toBeVisible();
  await expect(card).toContainText('US$ 365/ano · primeiro ano');
  await page.setViewportSize({ width: 390, height: 844 });
  // The responsive editor replaces the desktop canvas tree at this breakpoint.
  // Wait for its actual mobile control before acquiring the new card subtree.
  await expect(page.getByRole('button', { name: 'Abrir aba Texto', exact: true })).toBeVisible();
  const mobileCard = page.locator('main [data-vc-card-surface="native-1"]');
  await expect(mobileCard).toBeVisible();
  await expect(mobileCard.getByRole('table', { name: 'Comparação' })).toBeVisible();
  await mobileCard.screenshot({ path: testInfo.outputPath('native-evidence-mobile.png') });
});
