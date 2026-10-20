import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

for (const fmt of ['apresentacao', 'carrossel']) {
  test(`${fmt}: PDF e ZIP funcionam mesmo com novos scripts bloqueados após abrir o editor`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.context().route('**/*', route => {
      const url = new URL(route.request().url());
      return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol)
        ? route.continue() : route.abort();
    });
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.addInitScript(({ fmt }) => {
      localStorage.setItem('vc_shell_view', JSON.stringify('project'));
      localStorage.setItem('vc_active_doc_id', JSON.stringify('export-test'));
      localStorage.setItem('vc_library', JSON.stringify([{ id: 'export-test', name: 'ÉTER', doc: {
        fmt, productKind: fmt, creativePreset: 'livre',
        brand: { bg: '#101010', titleColor: '#ffffff', subtitleColor: '#ffffff', textColor: '#ffffff',
          titleFont: 'Arial', subtitleFont: 'Arial', bodyFont: 'Arial', showHandle: false, showPageBadge: false },
        slides: [
          { id: 's1', title: 'Continuidade', subtitle: 'Cuidado ao longo do tempo.' },
          { id: 's2', title: 'Próximo passo', subtitle: 'Uma decisão concreta.' },
        ].map(s => ({ ...s, layout: 'bc', canvas: null, photoRegion: 'full' })),
      } }]));
    }, { fmt });
    await page.goto('/?app=1');
    const options = page.getByRole('button', { name: 'Opções de download', exact: true });
    await expect(options).toBeVisible();
    await page.route('**/assets/*.js', route => route.abort('failed'));
    const presentation = fmt === 'apresentacao';
    await options.click();
    const menu = page.getByRole('menu');
    await expect(menu).toContainText(presentation ? 'Somente slide 1' : 'Somente card 1');
    await expect(menu).toContainText(presentation ? 'Gerar e copiar resumo' : 'Gerar e copiar legenda');
    if (presentation) await expect(menu).not.toContainText(/Instagram|Carrossel|legenda|cards/);
    const [pdf] = await Promise.all([
      page.waitForEvent('download'),
      menu.getByRole('menuitem', { name: presentation ? 'Apresentação em PDF' : 'Carrossel em PDF', exact: true }).click(),
    ]);
    const stem = `${fmt}-eter`;
    expect(pdf.suggestedFilename()).toBe(`${stem}.pdf`);
    await pdf.saveAs(testInfo.outputPath(`${stem}.pdf`));
    const stream = await pdf.createReadStream();
    const chunks = []; for await (const chunk of stream) chunks.push(chunk);
    const content = Buffer.concat(chunks).toString('latin1');
    expect(content.startsWith('%PDF-')).toBe(true);
    expect(content.match(/\/Type \/Page\b/g)).toHaveLength(2);
    const [, width, height] = content.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
    expect(Number(width) / Number(height)).toBeCloseTo(presentation ? 16 / 9 : 4 / 5, 3);
    await expect(options).toBeEnabled();
    await options.click();
    const [zip] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: presentation ? /Todos os .* slides/ : /Todos os .* cards/ }).click(),
    ]);
    expect(zip.suggestedFilename()).toBe(`${stem}.zip`);
    await expect(options).toBeEnabled();
    await options.click();
    await page.screenshot({ path: testInfo.outputPath('menu-exportacao.png') });
  });
}
