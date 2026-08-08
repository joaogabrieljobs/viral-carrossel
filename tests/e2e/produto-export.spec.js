// Task 09 — RF-02: jornada mínima do produto (editor + export PNG válido).
// NOTA: exportSlide carrega html2canvas do CDN cdnjs em runtime — único fetch
// externo permitido neste E2E (documentado; remoção = backlog #7 do audit).
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

test.describe('Produto (RF-02)', () => {
  // Render 2160x2700 via html2canvas (CDN) fica lento com workers paralelos
  // dividindo CPU — 30s estouram; 90s dá folga sem mascarar travamento real.
  test('assinante edita card no editor e exporta PNG válido', async ({ page }) => {
    test.setTimeout(90_000);
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') console.log('[browser]', m.type(), m.text().slice(0, 200));
    });
    await mockApi(page, { session: SESSAO_ATIVA });
    // applyTemplate dispara geração de imagem por card — sem chave, iria pra
    // rede real da OpenAI. Responde 401 na hora (determinístico, sem rede).
    await page.route('https://api.openai.com/**', (r) =>
      r.fulfill({ status: 401, json: { error: { message: 'sem chave (E2E)' } } }),
    );
    await page.goto('/?app=1');

    // home shell → editor
    const continuar = page.getByRole('button', { name: /continuar no editor/i });
    await expect(continuar).toBeVisible({ timeout: 10_000 });
    await continuar.click();

    // editor abre no empty state — aplica um template pra ter conteúdo real
    await page.getByRole('button', { name: /abrir templates/i }).click();
    const modal = page.locator('.modal-panel');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await modal.getByRole('button').filter({ hasText: 'Erro Comum' }).first().click({ force: true });

    // editor montado com slides do template (strip de thumbnails presente)
    await expect(page.locator('[data-vc-tour="thumbnails"]')).toBeAttached({ timeout: 10_000 });

    // exporta o card atual (PNG via html2canvas)
    const downloadPromise = page.waitForEvent('download', { timeout: 45_000 });
    // force: o header re-renderiza continuamente (auto-save/geração pós-template)
    // e o wait de estabilidade do Playwright nunca fecha.
    await page.getByRole('button', { name: /baixar card 1/i }).click({ force: true });
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^slide-\d+\.png$/);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const buf = Buffer.concat(chunks);
    // magic bytes PNG: 89 50 4E 47 0D 0A 1A 0A
    expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(buf.length).toBeGreaterThan(10_000); // imagem real, não stub
  });
});
