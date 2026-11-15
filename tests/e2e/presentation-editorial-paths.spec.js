import { presentationBatch } from './helpers/presentation-batches.js';
import { enterEditorFromHome } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { mockEditorApi as mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { PRESENTATION_PLAN_PROMPT_VERSION, PRESENTATION_PLAN_SYSTEM_PROMPT } from '../../src/utils/presentation-plan.js';
import { PRESENTATION_REVIEW_SYSTEM_PROMPT } from '../../src/utils/editorial-review.js';

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
          const data = user.startsWith('PLANEJAMENTO ESTRUTURADO')
            ? {
              schemaVersion: 1, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
              objective: 'Decidir com critérios verificáveis.', audience: 'Público interessado no tema.', thesis: 'Validar antes de agir.',
              evidence: [], gaps: [],
              slides: Array.from({ length: 6 }, (_, index) => ({
                index: index + 1, visualRole: index === 0 ? 'cover' : index === 5 ? 'closing' : ['content', 'data', 'demo', 'divider'][index - 1],
                purpose: index === 0 ? 'introduction' : index === 5 ? 'decision' : 'learning',
                question: `Qual critério considerar na etapa ${index + 1}?`, keyMessage: `Aplicar o critério ${index + 1} antes da decisão.`,
                evidenceIds: [], imageBrief: '',
              })),
            }
            : user.startsWith('REVISÃO DE APRESENTAÇÃO')
            ? { edits: [{ slideIndex: 1, reason: 'Esclarecer a decisão', subtitle: 'Validar antes de agir.' }] }
            : {
              slides: presentationBatch(user, Array.from({ length: 6 }, (_, index) => ({
                title: `Ideia ${index + 1}`,
                subtitle: 'Contexto disponível.',
                bodyAfterImage: '',
                imageQuery: '',
              }))),
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
    await enterEditorFromHome(page);
    await page.getByRole('button', { name: /Modo atual: Criar rápido/i }).click();
    await page.getByRole('menuitem', { name: /Controle profissional/i }).click();
    await page.getByRole('button', { name: 'Apresentação 16:9', exact: true }).first().click();
  await page.getByRole('button', { name: 'Gerar apresentação com IA', exact: true }).first().click();

    const modal = page.locator('.modal-panel');
    const topic = 'Uma decisão com critérios verificáveis';
    await modal.getByLabel('Qual é o tema da apresentação?', { exact: true }).fill(topic);
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
    expect(textRequests).toHaveLength(4);
    expect(textRequests[0].find(message => message.role === 'system').content).toContain(PRESENTATION_PLAN_SYSTEM_PROMPT);
    for (const request of textRequests.slice(1, 3)) {
      expect(request.find(message => message.role === 'system').content).toContain(role);
      expect(request.find(message => message.role === 'user').content).toContain('ETAPA DE REDAÇÃO EM LOTES');
    }
    expect(textRequests[0].find(message => message.role === 'user').content).toContain('PLANEJAMENTO ESTRUTURADO');
    const userPrompt = textRequests[1].find(message => message.role === 'user').content;
    expect(userPrompt).toContain(criterion);
    expect(userPrompt).toContain('Não mencione o arquivo enviado');
    expect(userPrompt).toContain('PLANO EDITORIAL VALIDADO');
    const reviewRequest = textRequests[3];
    expect(reviewRequest.find(message => message.role === 'system').content).toContain(PRESENTATION_REVIEW_SYSTEM_PROMPT);
    const reviewPrompt = reviewRequest.find(message => message.role === 'user').content;
    expect(reviewPrompt).toContain('REVISÃO DE PROFUNDIDADE');
    expect(reviewPrompt).toContain('Resposta: um único objeto JSON {"edits"');
    const reviewBriefing = reviewPrompt.match(/<briefing>\n([\s\S]*?)\n<\/briefing>/)[1];
    expect(reviewBriefing).toContain('PEDIDO ATUAL E FONTES ORIGINAIS');
    const originalSources = JSON.parse(reviewBriefing.slice(reviewBriefing.indexOf('\n') + 1));
    expect(originalSources.brief).toContain(topic);
    expect(originalSources.factualContext).toContain(topic);
    expect(originalSources.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'request', excerpts: expect.arrayContaining([expect.stringContaining(topic)]) }),
    ]));
    expect(reviewBriefing).not.toContain('ETAPA DE REDAÇÃO EM LOTES');
    expect(reviewBriefing).not.toContain('Aplicar o critério 1 antes da decisão.');
    expect(imageRequests).toHaveLength(0);
  });
}
