import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { createPublicationResult } from '../../src/utils/publication-results.js';

const session = { ...SESSAO_ATIVA, tier: 'essential', imageQuota: { used: 0, limit: 0, remaining: 0, tier: 'essential' } };
const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const savedLibrary = page => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]'));
const baseDoc = {
  mode: 'editorial', creativePreset: 'livre', contentObjective: 'saves',
  slides: [{ id: 'first', title: 'Capa publicada', subtitle: 'Uma decisão concreta' }],
  caption: 'Legenda publicada', editorialContext: { niche: 'Reuniões' },
};

async function seed(page, publications = []) {
  await page.addInitScript(({ doc, publications }) => {
    if (localStorage.getItem('vc_results_e2e_seeded')) return;
    localStorage.setItem('vc_results_e2e_seeded', '1');
    localStorage.setItem('vc_library', JSON.stringify([{
      id: 'project', name: 'Reuniões', doc, publicationResults: publications,
      performanceSettings: { account: 'teste', windowDays: 7, enabled: true },
    }]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('project'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_app_mode', JSON.stringify('diretor'));
  }, { doc: baseDoc, publications });
}

test('registra, corrige, persiste e exclui uma medição sem alterar o texto', async ({ page }) => {
  await mockApi(page, { session });
  await seed(page);
  await page.goto('/?app=1');
  await page.getByRole('button', { name: 'Resultados das publicações', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Resultados das publicações' });
  await expect(modal).toBeVisible();
  await modal.getByLabel('Link da publicação').fill('https://www.instagram.com/p/MANUAL/');
  await modal.getByLabel('Data da publicação', { exact: true }).fill(daysAgo(7));
  await modal.getByLabel('Estrutura que você publicou').selectOption('practical_reference');
  await modal.getByLabel('Contas alcançadas', { exact: true }).fill('1000');
  await modal.getByLabel('Salvamentos', { exact: true }).fill('20');
  await modal.getByRole('button', { name: 'Salvar resultados' }).click();
  await expect(modal.getByRole('status')).toContainText('Resultados salvos');
  await expect.poll(async () => (await savedLibrary(page))[0]?.publicationResults?.length).toBe(1);
  let lib = await savedLibrary(page);
  expect(lib[0].publicationResults[0].metrics.saves).toBe(20);
  expect(lib[0].publicationResults[0].metrics.comments).toBeNull();
  expect(lib[0].publicationResults[0].snapshot.slides[0].title).toBe('Capa publicada');
  await page.reload();
  await page.getByRole('button', { name: 'Resultados das publicações', exact: true }).click();
  await modal.getByRole('button', { name: 'Atualizar números' }).click();
  await expect(modal.getByLabel('Link da publicação')).toBeDisabled();
  await modal.getByLabel('Salvamentos', { exact: true }).fill('25');
  await modal.getByRole('button', { name: 'Salvar resultados' }).click();
  await expect.poll(async () => (await savedLibrary(page))[0]?.publicationResults?.[0]?.metrics.saves).toBe(25);
  lib = await savedLibrary(page);
  expect(lib[0].publicationResults).toHaveLength(1);
  expect(lib[0].doc.slides[0].title).toBe('Capa publicada');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(modal).toBeVisible();
  expect(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await modal.screenshot({ path: 'test-results/resultados-mobile.png' });
  page.once('dialog', dialog => dialog.accept());
  await modal.getByRole('button', { name: 'Excluir medição' }).click();
  await expect.poll(async () => (await savedLibrary(page))[0]?.publicationResults?.length).toBe(0);
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
});

test('histórico comparável orienta geração e pode ser desativado', async ({ page }) => {
  test.setTimeout(60_000);
  const publications = Array.from({ length: 6 }, (_, i) => createPublicationResult({
    account: 'teste', postURL: `https://instagram.com/p/HISTORY${i}/`, publishedAt: daysAgo(10), measuredAt: daysAgo(3), windowDays: 7,
    objective: 'saves', niche: 'Reuniões', distribution: 'organic', structureId: i < 3 ? 'identification' : 'practical_reference',
    metrics: { reach: '1000', saves: i < 3 ? '60' : '20' },
  }, baseDoc));
  const prompts = [];
  await mockApi(page, { session, extra: {
    '/api/ai/compatible': route => {
      const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
      prompts.push(prompt);
      const response = prompt.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : {
        slides: Array.from({ length: 6 }, (_, i) => ({ title: `Decisão ${i + 1}`, subtitle: 'Uma consequência concreta.', bodyAfterImage: i < 2 ? '' : 'Próximo passo.', imageQuery: 'a notebook on a wooden meeting room table' })),
        caption: 'Um registro para consultar antes da reunião.',
      };
      return route.fulfill({ json: { choices: [{ message: { content: JSON.stringify(response) } }] } });
    },
  } });
  await seed(page, publications);
  await page.goto('/?app=1');
  await page.getByRole('button', { name: 'Resultados das publicações', exact: true }).click();
  const results = page.getByRole('dialog', { name: 'Resultados das publicações' });
  await expect(results).toContainText('Estrutura para considerar no próximo teste: Identificação');
  await expect(results.getByRole('table')).toContainText('60');
  await results.getByRole('button', { name: 'Fechar resultados' }).click();
  for (const enabled of [true, false]) {
    if (!enabled) {
      await page.getByRole('button', { name: 'Resultados das publicações', exact: true }).click();
      await results.getByLabel('Usar histórico nas próximas gerações deste projeto').uncheck();
      await results.getByRole('button', { name: 'Fechar resultados' }).click();
    }
    await page.getByRole('button', { name: 'Gerar carrossel com IA', exact: true }).first().click();
    const modal = page.locator('.modal-panel');
    await modal.getByPlaceholder(/como freelancers/i).fill('Reuniões sem pauta');
    await modal.getByPlaceholder('Ex: marketing digital').fill('Reuniões');
    await expect(modal).toContainText(enabled ? 'Seu histórico será considerado' : 'Histórico desativado');
    for (let i = 0; i < 3; i++) await modal.getByRole('button', { name: /continuar/i }).click();
    await modal.getByRole('button', { name: 'Gerar só texto', exact: true }).click();
    await expect(modal).toHaveCount(0, { timeout: 25_000 });
    const draftPrompt = prompts[prompts.length - 2];
    expect(draftPrompt.includes('HISTÓRICO INFORMADO PELO USUÁRIO')).toBe(enabled);
    await expect.poll(async () => (await savedLibrary(page))[0]?.doc?.editorialContext?.suggestedStructureId).toBe(enabled ? 'identification' : null);
  }
  expect((await savedLibrary(page))[0].publicationResults).toHaveLength(6);
});
