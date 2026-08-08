// Cobre os dois painéis de IA que estavam com import faltando (audit: bugs
// latentes achados pelo check-undefined). Sem estes testes, se o import sumir
// de novo, ninguém vê — o build continua verde e só quebra no clique do usuário.
//
// A chave OpenAI é semeada no storage e `api.openai.com` é interceptado, então
// nenhuma chamada real acontece (RNF-02).
import { test, expect } from '@playwright/test';
import { SESSAO_ATIVA } from './helpers/api-mock.js';

/** OpenAI: formato chat.completions */
const respostaOpenAI = (payload) => ({ choices: [{ message: { content: JSON.stringify(payload) } }] });
/** Anthropic (via proxy /api/anthropic): formato messages */
const respostaAnthropic = (payload) => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] });

async function prepara(page, payload) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('vc_onboarding_done', '1');
      localStorage.setItem('vc_modes_intro_done', '1');
      // chave BYOK sintética: o app só precisa dela não-vazia
      localStorage.setItem('vc_ai_keys', JSON.stringify({ openai: 'sk-teste-e2e', anthropic: 'sk-ant-teste-e2e' }));
      localStorage.setItem('vc_ai_settings', JSON.stringify({ textProvider: 'openai', persistKeys: true }));
    } catch { /* storage bloqueado */ }
  });

  let chamou = false;
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/session') return route.fulfill({ json: SESSAO_ATIVA });
    if (path === '/api/status') return route.fulfill({ json: { anthropic: true, openai: true, dev: false } });
    // A pesquisa de nicho tenta Anthropic primeiro (web_search só existe lá).
    if (path.startsWith('/api/anthropic')) {
      chamou = true;
      return route.fulfill({ json: respostaAnthropic(payload) });
    }
    if (path === '/api/fetch-source') return route.fulfill({ json: { ok: true, text: '' } });
    // IMPORTANTE: `IS_LOCAL_DEV` é detectado por hostname, então mesmo o BUILD
    // de produção servido em localhost usa os caminhos de proxy dev.
    if (path.startsWith('/api/openai/v1/images')) return route.fulfill({ status: 401, json: { error: { message: 'sem chave (E2E)' } } });
    if (path.startsWith('/api/openai')) {
      chamou = true;
      return route.fulfill({ json: respostaOpenAI(payload) });
    }
    return route.fulfill({ status: 404, json: { error: `não mockado: ${path}` } });
  });

  await page.route('https://api.openai.com/**', (route) => {
    chamou = true;
    return route.fulfill({ json: respostaOpenAI(payload) });
  });
  return () => chamou;
}

test.describe('Painéis de IA', () => {
  test('pesquisa de nicho devolve ideias e ganchos', async ({ page }) => {
    const chamouIA = await prepara(page, {
      trending_topics: ['IA generativa em nutrição'],
      viral_hooks: ['Todo mundo viu a dieta. Pouca gente entendeu o mecanismo.'],
      carousel_ideas: [{ title: 'O erro que 9 em 10 nutricionistas cometem', angle: 'erro comum' }],
    });

    await page.goto('/?app=1');
    await page.getByRole('button', { name: /^pesquisa$/i }).first().click({ force: true });

    const campo = page.getByPlaceholder(/nicho ou tema/i);
    await expect(campo).toBeVisible({ timeout: 10_000 });
    await campo.fill('nutrição');
    await page.getByRole('button', { name: /^pesquisar$/i }).click({ force: true });

    // resultado da IA aparece no painel
    await expect(page.getByText(/9 em 10 nutricionistas/i)).toBeVisible({ timeout: 15_000 });
    expect(chamouIA(), 'o painel deveria ter chamado a IA').toBe(true);
  });

  test('variações de gancho geram alternativas para a capa', async ({ page }) => {
    const chamouIA = await prepara(page, {
      hooks: [
        { title: 'Não é sobre treino. É sobre recuperação.', subtitle: 'O que ninguém mede.' },
        { title: 'O mercado de suplementos mudou de eixo', subtitle: 'E quase ninguém percebeu.' },
      ],
    });

    await page.goto('/?app=1');
    await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });

    // template dá conteúdo real ao card antes de pedir variações
    await page.getByRole('button', { name: /abrir templates/i }).click({ force: true });
    const modal = page.locator('.modal-panel');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await modal.getByRole('button').filter({ hasText: 'Erro Comum' }).first().click({ force: true });

    // o botão vive na aba Narrativa da sidebar
    await page.getByRole('tab', { name: /narrativa/i }).first().click({ force: true });
    await page.getByRole('button', { name: /gerar variações de gancho/i }).click({ force: true });
    // o modal dispara a geração sozinho ao abrir (não há botão de submit)
    await expect(page.getByText(/sobre recuperação/i)).toBeVisible({ timeout: 15_000 });
    expect(chamouIA(), 'as variações deveriam ter chamado a IA').toBe(true);
  });
});
