import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const DIRECTION = 'Um produto em uma bancada azul com luz lateral suave.';
const QUOTA = { status: 'available', available: true, used: 0, limit: 50, remaining: 50 };

async function openImageProject(page, { quota = QUOTA, slide = {} } = {}) {
  const requests = [];
  await page.context().route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol)
      ? route.continue() : route.abort('blockedbyclient');
  });
  await mockApi(page, {
    session: { ...SESSAO_ATIVA, tier: 'creator', imageQuota: quota },
    extra: {
      '/api/library-sync': (route) => route.fulfill({ status: 503, json: { error: 'E2E: nuvem simulada offline.' } }),
      '/api/ai/sjinn-image': (route) => {
        requests.push(route.request().postDataJSON());
        return route.fulfill({ json: { b64_json: PNG, mime: 'image/png', quota: { ...QUOTA, used: 1, remaining: 49 } } });
      },
    },
  });
  await page.addInitScript(({ slide, owner }) => {
    const doc = {
      brand: { id: 'b1', name: 'Marca de teste' }, fmt: 'feed',
      slides: [{ id: 's1', title: 'Um produto com personalidade', subtitle: 'Imagem feita a partir da direção.', imageQuery: '', ...slide }],
      styleKit: { refImages: [] },
    };
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'p1', name: 'Teste de imagem', updatedAt: 1000, doc }]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('p1'));
    localStorage.setItem('vc_data_owner', JSON.stringify(owner));
    localStorage.setItem('vc_shell_view', JSON.stringify('home'));
  }, { slide, owner: `email:${SESSAO_ATIVA.email}` });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: 'Abrir Teste de imagem', exact: true }).click();
  return requests;
}

for (const mobile of [false, true]) {
  test(`referência + direção sem imageQuery envia instrução e referência (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const requests = await openImageProject(page, { slide: { refImage: `data:image/png;base64,${PNG}`, imgExtraPrompt: DIRECTION } });
    const button = page.getByRole('button', { name: 'Gerar imagem', exact: true }).first();
    await expect(button).toBeEnabled();
    await button.click();
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0].prompt).toContain(DIRECTION);
    expect(requests[0].prompt.split(DIRECTION)).toHaveLength(2);
    expect(requests[0].imageList).toHaveLength(1);
    // A API está totalmente simulada: nenhum serviço de imagem ou quota real é chamado.
    await expect(page.getByRole('button', { name: 'Regenerar imagem', exact: true }).first()).toBeEnabled();
  });
}

test('direção visível habilita o botão sem exigir palavras-chave em outro painel', async ({ page }) => {
  const requests = await openImageProject(page);
  const generate = page.getByRole('button', { name: 'Gerar imagem', exact: true }).first();
  await expect(generate).toBeDisabled();
  await expect(page.getByRole('status').filter({ hasText: 'Abra Direção e descreva' }).first()).toBeVisible();
  await page.getByRole('button', { name: /^Direção$/ }).first().click();
  await page.getByLabel('Direção da imagem (este card)', { exact: true }).fill(DIRECTION);
  await expect(generate).toBeEnabled();
  expect(requests).toHaveLength(0);
});

test('saldo indisponível não aparece como quota esgotada nem IA pronta para imagem', async ({ page }) => {
  const requests = await openImageProject(page, {
    quota: { ...QUOTA, available: false, status: 'unavailable', used: null, remaining: null },
    slide: { imgExtraPrompt: DIRECTION },
  });
  await expect(page.getByRole('button', { name: 'Gerar imagem', exact: true }).first()).toBeDisabled();
  await expect(page.getByRole('status').filter({ hasText: 'Não foi possível consultar seu saldo de imagens' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Configurar IA', exact: true }).first()).toHaveAttribute('title', /Texto pronto.*Não foi possível consultar/);
  await expect(page.getByText('Você usou todas as imagens deste ciclo.', { exact: false })).toHaveCount(0);
  expect(requests).toHaveLength(0);
});
