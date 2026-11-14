import { enterEditorFromHome } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { mockEditorApi as mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

async function useProfessionalControls(page) {
  await page.getByRole('button', { name: /Modo atual: Criar rápido/i }).click();
  await page.getByRole('menuitem', { name: /Controle profissional/i }).click();
}

test('modal exibe cards durante a revisão sem ficar preso no resumo', async ({ page }) => {
  test.setTimeout(60_000);
  let releaseReview;
  const reviewing = new Promise(resolve => { releaseReview = resolve; });
  let reviewRequested = false;
  const payload = value => ({ choices: [{ message: { content: JSON.stringify(value) } }] });
  await mockApi(page, { session: { ...SESSAO_ATIVA, tier:'creator', imageQuota:{limit:50,remaining:50,used:0} }, extra: {
    '/api/ai/compatible': async route => {
      const prompt = route.request().postDataJSON().payload.messages.find(message => message.role === 'user').content;
      if (prompt.startsWith('REVISÃO EDITORIAL')) {
        reviewRequested = true;
        await reviewing;
        return route.fulfill({ json: payload({ edits:[] }) });
      }
      return route.fulfill({ json: payload({ slides:Array.from({ length:6 }, () => ({ title:'Organize o briefing', subtitle:'Comece definindo o objetivo do conteúdo.', bodyAfterImage:'', imageQuery:'' })), caption:'Organize as informações antes de criar.' }) });
    },
  } });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await useProfessionalControls(page);
  await page.getByRole('button', { name:'Gerar carrossel com IA', exact:true }).first().click();
  const modal = page.locator('.modal-panel');
  await modal.getByLabel('Sobre o que é o conteúdo?', { exact:true }).fill('Como organizar um briefing antes de criar conteúdo');
  for (let step = 0; step < 2; step++) await modal.getByRole('button', { name:/Continuar/i }).click();
  await modal.getByRole('radio', { name:'Só texto', exact:true }).check();
  await modal.getByRole('button', { name:/Continuar/i }).click();
  await modal.getByRole('button', { name:'Gerar só texto', exact:true }).click();
  await expect.poll(() => reviewRequested).toBe(true);
  await expect(modal.getByRole('heading', { name:'Rascunho — em revisão', exact:true })).toBeInViewport();
  await expect(modal.getByLabel('Prévia dos cards', { exact:true }).getByRole('article')).toHaveCount(6);
  releaseReview();
  await expect(modal).toHaveCount(0, { timeout:30_000 });
});

test('modal mobile prioriza o pedido e usa um único escopo até o CTA final', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page, {
    session: {
      ...SESSAO_ATIVA,
      tier: 'creator',
      imageQuota: { limit: 50, remaining: 50, used: 0 },
    },
  });

  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await useProfessionalControls(page);
  await page.getByRole('button', { name: 'Gerar carrossel com IA', exact: true }).first().click();

  const modal = page.locator('.modal-panel');
  const topic = modal.getByLabel('Sobre o que é o conteúdo?', { exact: true });
  const presets = modal.locator('[data-vc-collapsible="creative-presets"]');
  const presetsToggle = presets.getByRole('button', { name: /Escolher pacote criativo/i });

  await expect(topic).toBeVisible();
  await expect(presetsToggle).toHaveAttribute('aria-expanded', 'false');
  expect(await topic.evaluate((element) => {
    const disclosure = element.closest('.modal-panel')?.querySelector('[data-vc-collapsible="creative-presets"]');
    return !!disclosure && !!(element.compareDocumentPosition(disclosure) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);

  await presetsToggle.focus();
  await page.keyboard.press('Enter');
  await expect(presetsToggle).toHaveAttribute('aria-expanded', 'true');
  expect(await presets.getByRole('radio').count()).toBeGreaterThan(1);
  await presets.getByRole('radio', { name: /Personalizado/i }).focus();
  await page.keyboard.press('Enter');
  await expect(presetsToggle).toHaveAttribute('aria-expanded', 'false');

  await topic.fill('Como transformar um briefing vago em uma direção clara');
  await modal.getByRole('button', { name: /Continuar/i }).click();
  await expect(modal.getByRole('tabpanel')).toBeFocused();
  await modal.getByRole('button', { name: /Continuar/i }).click();
  await expect(modal.getByRole('tabpanel')).toBeFocused();

  const textOnly = modal.getByRole('radio', { name: 'Só texto', exact: true });
  const textAndImages = modal.getByRole('radio', { name: 'Texto e imagens', exact: true });
  // A escolha de escopo permanece explícita até o CTA final.
  await textOnly.check();
  await expect(textOnly).toBeChecked();
  await modal.getByRole('button', { name: /Continuar/i }).click();
  await expect(modal.getByRole('tabpanel')).toBeFocused();

  await expect(modal.getByText('Escopo', { exact: true })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Gerar só texto', exact: true })).toHaveCount(1);
  await expect(modal.getByRole('button', { name: 'Gerar texto e imagens', exact: true })).toHaveCount(0);

  await modal.getByRole('button', { name: 'Voltar', exact: true }).click();
  await textAndImages.check();
  await modal.getByRole('button', { name: /Continuar/i }).click();
  await expect(modal.getByRole('button', { name: 'Gerar texto e imagens', exact: true })).toHaveCount(1);
  await expect(modal.getByRole('button', { name: 'Gerar só texto', exact: true })).toHaveCount(0);
});

test('apresentação abre um fluxo próprio com caminhos e padrões 16:9', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockApi(page, {
    session: {
      ...SESSAO_ATIVA,
      tier: 'creator',
      imageQuota: { limit: 50, remaining: 50, used: 0 },
    },
  });

  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await useProfessionalControls(page);
  await page.getByRole('button', { name: 'Apresentação 16:9', exact: true }).first().click();
  await page.getByRole('button', { name: 'Gerar apresentação com IA', exact: true }).first().click();

  const modal = page.locator('.modal-panel');
  await expect(modal.getByText('Configurar apresentação', { exact: true })).toBeVisible();
  await expect(modal.getByLabel('Qual é o tema da apresentação?', { exact: true })).toBeVisible();

  const paths = modal.getByRole('radiogroup', { name: 'Caminho da apresentação', exact: true });
  await expect(paths.getByRole('radio')).toHaveCount(7);
  await expect(modal.getByText('Pacote criativo da IA', { exact: true })).toHaveCount(0);
  await expect(modal.getByLabel('O que você quer com este conteúdo?', { exact: true })).toHaveCount(0);

  await modal.getByLabel('Qual é o tema da apresentação?', { exact: true })
    .fill('Plano de expansão para o mercado brasileiro em 2027');
  await paths.getByRole('radio', { name: /^Pitch/ }).click();
  await modal.getByRole('button', { name: /Continuar/i }).click();

  const presentationStyles = modal.getByRole('group', {
    name: 'Escolha um padrão de apresentação 16:9',
    exact: true,
  });
  await expect(presentationStyles).toBeVisible();
  await expect(presentationStyles.getByRole('button')).toHaveCount(10);

  const slideCount = modal.getByRole('group', { name: 'Número de slides', exact: true });
  await expect(slideCount.getByRole('button', { name: '6', exact: true })).toBeVisible();
  await expect(slideCount.getByRole('button', { name: '16', exact: true })).toBeVisible();
  await expect(modal.getByText('Estilo dos cards', { exact: true })).toHaveCount(0);
});
