import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const routes = [
  ['Auto', 'estrategista editorial', 'uma única lógica dominante'],
  ['Aula / Workshop', 'designer instrucional', 'exemplo resolvido'],
  ['Proposta comercial', 'propostas comerciais', 'critério de aceite'],
  ['Relatório executivo', 'comunicação executiva', 'Ausência de dados não significa zero'],
  ['Estudo de caso', 'estudos de caso', 'condições comparáveis'],
  ['Keynote / Manifesto', 'editor de keynotes', 'melhor objeção'],
];

for (const [label, role, criterion] of routes) {
  test(`${label}: geração e revisão recebem o contrato e imagem vazia não gera prova fictícia`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1680, height: 900 });
    const textRequests = [];
    const imageRequests = [];
    await mockApi(page, {
      session: { ...SESSAO_ATIVA, tier: 'creator', imageQuota: { limit: 50, remaining: 50, used: 0 } },
      extra: {
        '/api/ai/compatible': route => {
          const messages = route.request().postDataJSON().payload.messages;
          textRequests.push(messages);
          const user = messages.find(message => message.role === 'user').content;
          const data = user.startsWith('REVISÃO DE APRESENTAÇÃO')
            ? { edits: [{ slideIndex: 1, reason: 'Esclarecer a decisão', subtitle: 'Validar antes de agir.' }] }
            : {
              slides: Array.from({ length: 6 }, (_, index) => ({
                title: `Ideia ${index + 1}`,
                subtitle: 'Contexto disponível.',
                bodyAfterImage: '',
                imageQuery: '',
              })),
              caption: 'Resumo com o próximo passo.',
            };
          return route.fulfill({ json: { choices: [{ message: { content: JSON.stringify(data) } }] } });
        },
        '/api/ai/sjinn-image': route => {
          imageRequests.push(route.request().postDataJSON());
          return route.fulfill({ status: 500, json: { error: 'Este deck não solicita imagens.' } });
        },
      },
    });

    await page.goto('/?app=1');
    await page.getByRole('button', { name: /continuar no editor/i }).click();
    await page.getByRole('button', { name: /Modo atual: Criar rápido/i }).click();
    await page.getByRole('menuitem', { name: /Controle profissional/i }).click();
    await page.getByRole('button', { name: 'Gerar apresentação com IA', exact: true }).click();
    await page.getByPlaceholder('Ex.: Pitch clínica').fill(`Teste ${label}`);
    await page.getByRole('button', { name: 'Criar', exact: true }).click();

    const modal = page.locator('.modal-panel');
    await modal.getByLabel('Qual é o tema da apresentação?', { exact: true }).fill('Uma decisão com critérios verificáveis');
    await modal.getByRole('radio', { name: new RegExp(`^${label}`) }).click();
    await modal.getByRole('button', { name: /Continuar/i }).click();
    await modal.getByRole('group', { name: 'Número de slides', exact: true })
      .getByRole('button', { name: '6', exact: true }).click();
    await modal.getByRole('button', { name: /Continuar/i }).click();
    await modal.getByRole('radio', { name: 'Texto e imagens', exact: true }).check();
    await modal.getByRole('button', { name: /Continuar/i }).click();
    await modal.getByRole('button', { name: 'Gerar apresentação com imagens', exact: true }).click();
    await expect(modal).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('main').getByText('Validar antes de agir.', { exact: true })).toBeVisible();
    expect(textRequests).toHaveLength(2);
    for (const request of textRequests) {
      expect(request.find(message => message.role === 'system').content).toContain(role);
    }
    const userPrompt = textRequests[0].find(message => message.role === 'user').content;
    expect(userPrompt).toContain(criterion);
    expect(userPrompt).toContain('Não mencione o arquivo enviado');
    expect(textRequests[1].find(message => message.role === 'user').content).toContain('REVISÃO DE PROFUNDIDADE');
    expect(imageRequests).toHaveLength(0);
  });
}
