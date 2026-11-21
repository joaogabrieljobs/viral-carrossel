import { presentationBatch } from './helpers/presentation-batches.js';
import { enterEditorFromHome } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { mockEditorApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { PRESENTATION_PLAN_PROMPT_VERSION } from '../../src/utils/presentation-plan.js';

// Lote B (21/11), C07 Palestra no Cinemático: a capa com subtítulo longo e a
// linha "Rio Vermelho, Salvador" não cabia, o reparo por IA não resolveu e o
// PDF era barrado no slide 1. A geração agora termina com o excesso nas notas
// e a apresentação exporta sem edição.
test('capa que não cabe vai para as notas no fim da geração e o PDF sai', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1680, height: 1000 });
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol) ? route.continue() : route.abort();
  });
  const stages = [];
  await mockEditorApi(page, {
    session: { ...SESSAO_ATIVA, tier: 'creator', imageQuota: { limit: 50, remaining: 50, used: 0 } },
    extra: {
      '/api/ai/compatible': async route => {
        const user = route.request().postDataJSON().payload.messages.find(message => message.role === 'user').content;
        let data;
        if (user.startsWith('PLANEJAMENTO ESTRUTURADO')) {
          stages.push('plan');
          data = { schemaVersion: 1, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
            objective: 'Mostrar a padaria do bairro.', audience: 'Moradores do bairro.', thesis: 'Pão de fermentação longa perto de casa.', evidence: [], gaps: [],
            slides: Array.from({ length: 6 }, (_, index) => ({
              index: index + 1, visualRole: index === 0 ? 'cover' : index === 5 ? 'closing' : 'content',
              purpose: index === 0 ? 'introduction' : index === 5 ? 'decision' : 'learning',
              question: 'O que muda?', keyMessage: 'Pão de fermentação longa no bairro.', evidenceIds: [], imageBrief: '',
            })) };
        } else if (user.startsWith('REVISÃO DE APRESENTAÇÃO')) {
          stages.push('editorial-review'); data = { edits: [] };
        } else if (user.startsWith('REPARO VISUAL MEDIDO')) {
          stages.push('render-repair'); data = { edits: [] };
        } else {
          stages.push('write');
          data = { slides: presentationBatch(user, Array.from({ length: 6 }, (_, index) => index === 0 ? {
            title: 'Pão de 36 horas, a um dia da sua mesa',
            subtitle: 'Fermento Lento: fermentação natural feita no Rio Vermelho, encomendada pelo WhatsApp com um dia de antecedência, de terça a domingo, das 7h às 13h.',
            bodyAfterImage: 'Rio Vermelho, Salvador', imageQuery: '', speakerNotes: '', presentationBlocks: [],
          } : {
            title: 'Pão de fermentação longa', subtitle: 'Feito no bairro.', bodyAfterImage: '', imageQuery: '', speakerNotes: '', presentationBlocks: [],
          })), caption: 'Padaria do bairro.' };
        }
        return route.fulfill({ json: { choices: [{ message: { content: JSON.stringify(data) } }] } });
      },
      '/api/ai/sjinn-image': route => route.fulfill({ status: 500, json: { error: 'Nenhuma imagem solicitada.' } }),
    },
  });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await page.getByRole('button', { name: /Modo atual: Criar rápido/i }).click();
  await page.getByRole('menuitem', { name: /Controle profissional/i }).click();
  await page.getByRole('button', { name: 'Apresentação 16:9', exact: true }).first().click();
  await page.getByRole('button', { name: 'Gerar apresentação com IA', exact: true }).first().click();
  const modal = page.locator('.modal-panel');
  const advance = async () => {
    const button = modal.getByRole('button', { name: /Continuar/i });
    await expect(button).toBeEnabled();
    await button.focus();
    await button.press('Enter');
  };
  await modal.getByLabel('Qual é o tema da apresentação?', { exact: true }).fill('Padaria de fermentação natural no bairro');
  await modal.getByRole('radio', { name: /^Keynote/ }).click();
  await advance();
  await modal.getByRole('group', { name: 'Número de slides', exact: true }).getByRole('button', { name: '6', exact: true }).click();
  await advance();
  await modal.getByRole('radio', { name: 'Texto e imagens', exact: true }).check();
  await advance();
  const generate = modal.getByRole('button', { name: 'Gerar apresentação com imagens', exact: true });
  await expect(generate).toBeEnabled();
  await generate.focus();
  await generate.press('Enter');
  await expect(modal).toHaveCount(0, { timeout: 40_000 });
  const currentDoc = () => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]')
    .find(project => project.id === JSON.parse(localStorage.getItem('vc_active_doc_id') || 'null'))?.doc);
  await expect.poll(async () => (await currentDoc())?.presentationQuality?.renderCheckStatus, { timeout: 30_000 }).toBeTruthy();
  const saved = await currentDoc();
  expect(stages).toContain('render-repair');
  expect(saved.visualPreset).toBe('presentation_cinematic');
  expect(saved.presentationQuality.renderRepairStatus).toBe('moved_to_notes');
  expect(saved.presentationQuality.renderedIssues.filter(issue => issue.code === 'render-overflow')).toEqual([]);
  expect(saved.slides[0].bodyAfterImage).toBe('');
  expect(saved.slides[0].caption).toContain('Rio Vermelho, Salvador');
  await page.locator('main [data-vc-card-surface]').first().screenshot({ path: testInfo.outputPath('capa.png') });
  await page.getByRole('button', { name: 'Opções de download', exact: true }).click();
  const [pdf] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByRole('menuitem', { name: 'Apresentação em PDF', exact: true }).click(),
  ]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
});
