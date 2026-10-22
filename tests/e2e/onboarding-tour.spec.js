import { enterEditorFromHome } from './helpers/project-entry.js';
// Regressão do crash React #185 (loop de render no tour) e do realce vazio:
// o tour abria empilhado no modal de boas-vindas e destacava elementos tapados.
// Tour automático só após conteúdo real; estes testes abrem via Ajuda.
import { test, expect } from '@playwright/test';
import { mockApi, mockEditorApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const TOTAL_PASSOS = 3;

async function openTourFromHelp(page) {
  await enterEditorFromHome(page);
  await page.getByRole('button', { name: /Ajuda|ajuda e atalhos|\?/i }).first().click();
  await page.getByRole('button', { name: /Ver tour guiado/i }).click();
}

test.describe('Tour de onboarding', () => {
  test('a entrada oferece duas escolhas sem empilhar boas-vindas ou tour', async ({ page }) => {
    await mockApi(page, { session: SESSAO_ATIVA, onboarding: true });
    await page.goto('/?app=1');

    await expect(page.getByRole('button', { name:'Abrir um projeto', exact:true })).toBeVisible();
    await expect(page.getByRole('button', { name:'Criar um projeto', exact:true })).toBeVisible();
    await expect(page.getByRole('dialog', { name:'Bem-vindo à Moont' })).toHaveCount(0);
    // Ultrapassa o antigo temporizador: a entrada não deve iniciar um tour sozinha.
    await page.waitForTimeout(1600);
    await expect(page.locator('[data-vc-tour-card]')).toHaveCount(0);
  });

  test('não reabre boas-vindas para quem já tem projeto salvo', async ({ page }) => {
    await mockApi(page, { session: SESSAO_ATIVA, onboarding: true });
    await page.addInitScript(() => {
      localStorage.setItem('vc_library', JSON.stringify([{
        id: 'projeto-existente',
        name: 'Projeto existente',
        doc: { slides: [{ id: 'card-existente', title: 'Texto já criado' }] },
      }]));
    });
    await page.goto('/?app=1');
    await enterEditorFromHome(page, 'Projeto existente');
    await expect(page.getByRole('dialog', { name: 'Bem-vindo à Moont' })).toHaveCount(0);
    await expect(page.locator('[data-vc-tour-card]')).toHaveCount(0);
  });

  test('o primeiro projeto não recebe tour automático durante a criação', async ({ page }) => {
    await mockApi(page, { session:SESSAO_ATIVA, onboarding:true });
    await page.goto('/?app=1');
    await page.getByRole('button', { name:'Criar um projeto', exact:true }).click();
    const flow = page.getByRole('region', { name:'Criar novo projeto' });
    await flow.getByLabel(/^Nome do projeto/).fill('Primeiro projeto');
    await flow.getByRole('button', { name:'Continuar', exact:true }).click();
    await expect(flow).toBeVisible();
    await expect(page.getByRole('tab', { name:'Marca', exact:true })).toHaveCount(0);
    await page.waitForTimeout(1100);
    await expect(page.locator('[data-vc-tour-card]')).toHaveCount(0);
  });

  test('percorre os 3 passos sem erro de console e sem realce fora de alvo', async ({ page }) => {
    const erros = [];
    page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
    page.on('pageerror', (e) => erros.push(String(e)));

    await mockEditorApi(page, { session: SESSAO_ATIVA, onboarding: true });
    await page.goto('/?app=1');

    await openTourFromHelp(page);
    const card = page.locator('[data-vc-tour-card]');
    await expect(card).toBeVisible({ timeout: 10_000 });

    for (let passo = 1; passo <= TOTAL_PASSOS; passo += 1) {
      await expect(card).toBeVisible();
      // Quando há realce, o alvo tem de existir e ter caixa visível.
      const hole = page.locator('[data-vc-tour-hole]');
      if (await hole.count()) {
        const box = await hole.first().boundingBox();
        expect(box, `passo ${passo}: realce sem caixa`).not.toBeNull();
        expect(box.width, `passo ${passo}: realce demasiado estreito`).toBeGreaterThan(16);
        expect(box.height, `passo ${passo}: realce demasiado baixo`).toBeGreaterThan(16);
      }
      const avancar = card.getByRole('button', { name: /avançar|concluir|terminar/i }).first();
      await avancar.click();
      await page.waitForTimeout(450);
    }

    // Fim do tour: nada de error boundary, nada de loop de render.
    await expect(page.getByText(/Erro ao carregar a Moont/i)).toHaveCount(0);
    expect(
      erros.filter((e) => /Maximum update depth|#185|Minified React error/i.test(e)),
      `Erros de render no tour:\n${erros.join('\n')}`,
    ).toEqual([]);
  });
});

test.describe('Copy do tour', () => {
  test('nenhum passo fala de .env, chave de API ou ambiente local', async ({ page }) => {
    await mockEditorApi(page, { session: SESSAO_ATIVA, onboarding: true });
    await page.goto('/?app=1');
    await openTourFromHelp(page);
    const card = page.locator('[data-vc-tour-card]');
    await expect(card).toBeVisible({ timeout: 10_000 });

    const proibido = /\.env|env\.local|desenvolvimento local|chaves de api|endpoint|localhost/i;
    for (let passo = 1; passo <= TOTAL_PASSOS; passo += 1) {
      const texto = await card.innerText();
      expect(texto, `passo ${passo} com linguagem de dev: ${texto}`).not.toMatch(proibido);
      await card.getByRole('button', { name: /avançar|concluir|terminar/i }).first().click();
      await page.waitForTimeout(400);
    }
  });
});
