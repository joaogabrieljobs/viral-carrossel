import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const session = { ...SESSAO_ATIVA, tier: 'essential', imageQuota: { used: 0, limit: 0, remaining: 0, tier: 'essential' } };
const completion = payload => ({ choices: [{ message: { content: JSON.stringify(payload) } }] });
const generated = {
  slides: Array.from({ length: 6 }, (_, i) => ({
    title: `Reunião: argumento ${i + 1}`, subtitle: `A decisão tem responsável ${i + 1}.`,
    imageQuery: 'a quiet meeting room with a notebook on the table',
    bodyAfterImage: i < 2 ? '' : `Consequência do argumento ${i + 1}.`,
  })),
  caption: 'Uma decisão concreta. #gestão #equipes #reuniões #trabalho #liderança #extra',
};

async function persistedDoc(page) {
  return page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('vc_library') || '[]');
    return (lib.find(e => e.id === localStorage.getItem('vc_active_doc_id')) || lib[0])?.doc;
  });
}

for (const fails of [false, true]) {
  test(`geração salva objetivo e ${fails ? 'preserva rascunho se revisão falhar' : 'aplica revisão pontual'}`, async ({ page }) => {
    test.setTimeout(60_000);
    const prompts = [];
    await mockApi(page, { session, extra: {
      '/api/ai/compatible': route => {
        const request = route.request().postDataJSON();
        const prompt = request.payload.messages.find(m => m.role === 'user').content;
        prompts.push(prompt);
        if (prompt.startsWith('REVISÃO EDITORIAL')) {
          return route.fulfill({ json: completion(fails ? { edits: [{ slideIndex: 99, reason: 'Inválido', title: 'Não aplicar' }] } : {
            edits: [{ slideIndex: 2, reason: 'Precisão', subtitle: 'A tarefa saiu da reunião com dono e prazo.' }],
          }) });
        }
        return route.fulfill({ json: completion(generated) });
      },
    } });
    await page.goto('/?app=1');
    await page.getByRole('button', { name: /continuar no editor/i }).click();
    await page.getByRole('button', { name: 'Gerar carrossel com IA', exact: true }).first().click();
    const modal = page.locator('.modal-panel');
    await modal.getByLabel('O que você quer com este conteúdo?').selectOption('saves');
    await modal.getByPlaceholder(/como freelancers/i).fill('Reuniões sem pauta');
    for (let i = 0; i < 3; i++) await modal.getByRole('button', { name: /continuar/i }).click();
    await expect(modal).toContainText('Gerar salvamentos');
    await modal.getByRole('button', { name: 'Gerar só texto', exact: true }).click();
    await expect(modal).toHaveCount(0, { timeout: 25_000 });
    await expect.poll(async () => (await persistedDoc(page))?.editorialReviewStatus).toBe(fails ? 'unavailable' : 'revised');
    const doc = await persistedDoc(page);
    expect(doc.contentObjective).toBe('saves');
    expect(doc.slides).toHaveLength(6);
    expect(doc.slides[2].subtitle).toBe(fails ? generated.slides[2].subtitle : 'A tarefa saiu da reunião com dono e prazo.');
    expect(doc.slides[2].imageQuery).toBe(generated.slides[2].imageQuery);
    expect(doc.caption).not.toContain('#extra');
    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toContain('OBJETIVO DO CONTEÚDO: Gerar salvamentos');
    if (fails) await expect(page.getByText(/revisão automática não foi concluída/i)).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Gerar carrossel com IA', exact: true }).first().click();
    await expect(page.getByLabel('O que você quer com este conteúdo?')).toHaveValue('saves');
  });
}

test('pesquisa com fonte datada leva evidência ao material da ideia', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    localStorage.setItem('vc_ai_keys', JSON.stringify({ anthropic: 'sk-ant-e2e-synthetic' }));
    localStorage.setItem('vc_ai_settings', JSON.stringify({ textProvider: 'anthropic', persistKeys: true }));
  });
  await mockApi(page, { session, extra: {
    '/api/anthropic': route => route.fulfill({ json: { content: [{ type: 'text', text: JSON.stringify({
      trending_topics: [{ topic: 'Reuniões menores', why: 'Relato com decisões registradas.', eventDate: '2026-09-10', sources: [{ name: 'Fonte de teste', url: 'https://example.com/relato', publishedAt: '2026-09-20' }] }],
      carousel_ideas: [{ title: 'Quem registra a decisão?', angle: 'Uma rotina concreta', sourceIndexes: [0] }], viral_hooks: [], warning: '',
    }) }] } }),
  } });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /^pesquisa$/i }).first().click();
  await page.getByPlaceholder(/nicho ou tema/i).fill('Reuniões');
  await page.getByRole('button', { name: /^pesquisar$/i }).click();
  await expect(page.getByRole('link', { name: 'Fonte de teste' })).toHaveAttribute('href', 'https://example.com/relato');
  await page.getByRole('button', { name: /Quem registra a decisão/ }).click();
  await expect.poll(async () => (await persistedDoc(page))?.material?.sources).toContain('https://example.com/relato');
  expect((await persistedDoc(page)).material.content).toContain('2026-09-20');
});

test('pesquisa sem web identifica hipótese e não exibe fontes inventadas', async ({ page }) => {
  let usedOfflinePrompt = false;
  await mockApi(page, { session, extra: {
    '/api/ai/compatible': route => {
      const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
      usedOfflinePrompt = prompt.includes('SEM WEB AO VIVO') && !prompt.includes('na web');
      return route.fulfill({ json: completion({
        trending_topics: [{ topic: 'Organização de reuniões', why: 'Um ângulo possível', eventDate: '2026-09-10', sources: [{ name: 'Fonte inventada', url: 'https://example.com/fake', publishedAt: '2026-09-20' }] }],
        carousel_ideas: [{ title: 'Qual decisão ficou pendente?', angle: 'Uma hipótese', sourceIndexes: [0] }], viral_hooks: [],
      }) });
    },
  } });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /^pesquisa$/i }).first().click();
  await page.getByPlaceholder(/nicho ou tema/i).fill('Reuniões');
  await page.getByRole('button', { name: /^pesquisar$/i }).click();
  await expect(page.getByRole('button', { name: /Qual decisão ficou pendente/ })).toContainText('Hipótese para validar');
  await expect(page.getByRole('link', { name: 'Fonte inventada' })).toHaveCount(0);
  expect(usedOfflinePrompt).toBe(true);
});
