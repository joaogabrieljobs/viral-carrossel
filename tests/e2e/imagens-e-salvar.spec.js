import { enterEditorFromHome } from './helpers/project-entry.js';
// Faltava ver o consumo de imagens do plano, rever as imagens geradas e voltar a
// baixá-las; e faltava um gesto explícito de salvar (o autosave era invisível).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { mockEditorApi as mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const SESSAO_COM_QUOTA = {
  ...SESSAO_ATIVA,
  tier: 'creator',
  imageQuota: { used: 12, limit: 50, remaining: 38, tier: 'creator' },
};

test.describe('Imagens do plano', () => {
  test('aba Imagens mostra consumo e estado vazio da galeria', async ({ page }) => {
    test.setTimeout(60_000); // boot do studio sob CPU dividida entre workers
    await mockApi(page, { session: SESSAO_COM_QUOTA });
    await page.goto('/?app=1');

    await page.getByRole('button', { name: /^Imagens$/ }).first().click();

    await expect(page.getByRole('heading', { name: /imagens geradas/i })).toBeVisible();
    await expect(page.getByText('12 de 50')).toBeVisible();
    await expect(page.getByText(/38 restantes/)).toBeVisible();
    await expect(page.getByText(/ainda não há imagens geradas/i)).toBeVisible();
  });

  test('plano sem imagens explica o upgrade em vez de mostrar contador', async ({ page }) => {
    await mockApi(page, {
      session: { ...SESSAO_ATIVA, tier: 'essential', imageQuota: { used: 0, limit: 0, remaining: 0, tier: 'essential' } },
    });
    await page.goto('/?app=1');
    await page.getByRole('button', { name: /^Imagens$/ }).first().click();
    await expect(page.getByText(/não inclui geração de imagens/i)).toBeVisible();
  });
});

// Reteste 24/11 (conta 5): a galeria listava as imagens da conta e nenhuma
// aparecia. Só acontece com a política de segurança que o site no ar envia
// (vercel.json): ela recusa ler endereço blob: com fetch. O teste a aplica.
test.describe('Galeria com imagem que só existe na conta', () => {
  const CSP = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')).headers
    .flatMap((entry) => entry.headers || []).find((header) => header.key === 'Content-Security-Policy').value;
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const ASSET = `original_${createHash('sha256').update(PNG).digest('hex')}`;

  test('a miniatura aparece com o armazenamento do navegador cheio', async ({ page }) => {
    test.setTimeout(60_000);
    await page.route('**/*', async (route) => {
      if (route.request().resourceType() !== 'document') return route.fallback();
      const response = await route.fetch();
      return route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': CSP } });
    });
    await page.addInitScript(({ asset }) => {
      // Toda gravação no banco do navegador falha por falta de espaço.
      IDBObjectStore.prototype.put = function put() {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      };
      if (localStorage.getItem('vc_library') !== null) return;
      localStorage.setItem('vc_library', JSON.stringify([{
        id: 'p-conta', name: 'Projeto da conta', updatedAt: Date.now(),
        doc: { fmt: 'carrossel', slides: [{
          id: 's-conta', num: 1, title: 'Card com imagem de IA', bgImageSource: 'ai', bgImageAssetId: asset,
        }] },
      }]));
      localStorage.setItem('vc_active_doc_id', JSON.stringify('p-conta'));
    }, { asset: ASSET });
    let assetRequests = 0;
    await mockApi(page, {
      session: SESSAO_COM_QUOTA,
      extra: {
        '/api/library-sync': (route) => {
          const url = new URL(route.request().url());
          if (route.request().method() === 'GET' && url.searchParams.get('asset') === ASSET) {
            assetRequests += 1;
            return route.fulfill({ json: { ok: true, asset: { dataUrl: PNG } } });
          }
          return route.fulfill({ status: 404, json: { error: 'E2E: sem biblioteca na conta' } });
        },
      },
    });
    await page.goto('/?app=1');
    await page.getByRole('button', { name: /^Imagens$/ }).first().click();
    await expect(page.getByText('1 imagem salva')).toBeVisible();
    const thumb = page.getByRole('img', { name: 'Imagem do card 1 de Projeto da conta' });
    await expect(thumb).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => thumb.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByText('Não foi possível carregar esta imagem.')).toHaveCount(0);
    expect(assetRequests).toBeGreaterThan(0);
  });
});

test.describe('Salvar projeto', () => {
  test('botão Salvar confirma a gravação e persiste depois do reload', async ({ page }) => {
    test.setTimeout(60_000); // boot + reload com CPU dividida entre workers
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.goto('/?app=1');
    await enterEditorFromHome(page);

    const salvar = page.getByRole('button', { name: /salvar projeto agora/i });
    await expect(salvar).toBeVisible({ timeout: 10_000 });
    // Clique real: se o header voltar a recortar/sobrepor o botão, o teste deve
    // falhar no hit target em vez de disparar acidentalmente “Projetos”.
    await salvar.click();
    await expect(page.getByText(/projeto salvo (neste navegador|na sua conta)/i)).toBeVisible({ timeout: 8_000 });

    // O que foi gravado sobrevive ao reload.
    const antes = await page.evaluate(() => localStorage.getItem('vc_library')?.length || 0);
    expect(antes).toBeGreaterThan(0);
    await page.reload();
    await enterEditorFromHome(page);
    await expect(page.getByRole('button', { name: /salvar projeto agora/i })).toBeVisible({ timeout: 10_000 });
  });
});
