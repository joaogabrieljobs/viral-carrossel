import { enterEditorFromHome } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

// "Exportar em PDF gera um link e não um arquivo" (iPhone, 25/11). No Safari do
// iPhone o PDF fica pronto depois que a ativação do toque expirou: o share é
// recusado (NotAllowedError) e a âncora blob: tirava a pessoa do app. Aqui o
// share simulado recusa a primeira chamada como o Safari; o app precisa pedir
// um toque em "Salvar PDF", compartilhar só o arquivo e não abrir nenhum blob:.
test.use({
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1',
  viewport: { width: 430, height: 932 },
  hasTouch: true,
  isMobile: true,
});

test('celular: PDF pronto depois da ativação pede toque em "Salvar PDF" e compartilha só o arquivo', async ({ page }) => {
  test.setTimeout(90_000);
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(() => {
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('pdf-celular'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'pdf-celular', name: 'Clínica', doc: {
      fmt: 'carrossel', productKind: 'carrossel', creativePreset: 'livre',
      brand: { bg: '#101010', titleColor: '#ffffff', subtitleColor: '#ffffff', textColor: '#ffffff',
        titleFont: 'Arial', subtitleFont: 'Arial', bodyFont: 'Arial', showHandle: false, showPageBadge: false },
      slides: [
        { id: 's1', title: 'Continuidade', subtitle: 'Cuidado ao longo do tempo.' },
        { id: 's2', title: 'Próximo passo', subtitle: 'Uma decisão concreta.' },
      ].map(s => ({ ...s, layout: 'bc', canvas: null, photoRegion: 'full' })),
    } }]));
    window.__shares = [];
    window.__blobAnchors = [];
    let calls = 0;
    navigator.canShare = () => true;
    navigator.share = async (data) => {
      calls += 1;
      const files = (data?.files || []).map(f => ({ name: f.name, type: f.type, size: f.size }));
      window.__shares.push({ keys: Object.keys(data || {}), files });
      if (calls === 1) throw Object.assign(new Error('The request is not allowed by the user agent'), { name: 'NotAllowedError' });
    };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (/^blob:/.test(this.href)) { window.__blobAnchors.push(this.download); return undefined; }
      return click.call(this);
    };
  });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await page.getByRole('button', { name: 'Opções de download', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Carrossel em PDF', exact: true }).click();

  const aviso = page.getByRole('dialog', { name: 'PDF pronto.' });
  await expect(aviso).toBeVisible({ timeout: 60_000 });
  await expect(aviso.getByRole('button', { name: 'Fechar sem salvar' })).toBeVisible();
  await aviso.getByRole('button', { name: 'Salvar PDF', exact: true }).click();
  await expect(aviso).toBeHidden();
  await expect(page.getByText('PDF com 2 cards gerado')).toBeVisible();

  const shares = await page.evaluate(() => window.__shares);
  expect(shares).toHaveLength(2);
  for (const share of shares) {
    expect(share.keys).toEqual(['files']);
    expect(share.files).toEqual([expect.objectContaining({ name: 'carrossel-clinica.pdf', type: 'application/pdf' })]);
    expect(share.files[0].size).toBeGreaterThan(1000);
  }
  expect(await page.evaluate(() => window.__blobAnchors)).toEqual([]);
});

test('celular: fechar o aviso sem salvar é cancelamento silencioso', async ({ page }) => {
  test.setTimeout(90_000);
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(() => {
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('pdf-celular'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'pdf-celular', name: 'Clínica', doc: {
      fmt: 'carrossel', productKind: 'carrossel', creativePreset: 'livre',
      brand: { bg: '#101010', titleColor: '#ffffff', titleFont: 'Arial', bodyFont: 'Arial', showHandle: false, showPageBadge: false },
      slides: [{ id: 's1', title: 'Continuidade', subtitle: 'Cuidado.', layout: 'bc', canvas: null, photoRegion: 'full' }],
    } }]));
    navigator.canShare = () => true;
    navigator.share = async () => { throw Object.assign(new Error('not allowed'), { name: 'NotAllowedError' }); };
  });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  const options = page.getByRole('button', { name: 'Opções de download', exact: true });
  await options.click();
  await page.getByRole('menuitem', { name: 'Carrossel em PDF', exact: true }).click();
  const aviso = page.getByRole('dialog', { name: 'PDF pronto.' });
  await expect(aviso).toBeVisible({ timeout: 60_000 });
  await aviso.getByRole('button', { name: 'Fechar sem salvar' }).click();
  await expect(aviso).toBeHidden();
  await expect(options).toBeEnabled();
  await expect(page.getByText(/PDF com .* gerado/)).toHaveCount(0);
  await expect(page.getByText(/Erro ao gerar PDF/)).toHaveCount(0);
});
