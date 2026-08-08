// Auditoria pós-refactor: percorre TODA a UI e falha em qualquer erro de
// console / exceção não tratada. Existe porque a decomposição do monólito
// (18.5k → 4k linhas) moveu ~60 componentes e 5 hooks: um render quebrado num
// painel pouco usado não apareceria em nenhuma jornada de negócio.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

/** ruído conhecido e inofensivo — qualquer coisa fora disto reprova */
const IGNORAR = [
  /cdn\.tailwindcss\.com should not be used in production/i,
  /Ignoring Event: localhost/i,
  /Failed to load resource.*404/i, // endpoints /api mockados como 404 de propósito
];

function coletorDeErros(page) {
  const erros = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (IGNORAR.some((re) => re.test(t))) return;
    erros.push(`console.error: ${t}`);
  });
  page.on('pageerror', (e) => erros.push(`pageerror: ${String(e)}`));
  return erros;
}

test.describe('Smoke da UI inteira (auditoria do refactor)', () => {
  test('editor: todas as abas de todos os modos renderizam sem erro', async ({ page }) => {
    test.setTimeout(180_000);
    const erros = coletorDeErros(page);
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.route('https://api.openai.com/**', (r) => r.fulfill({ status: 401, json: {} }));

    await page.goto('/?app=1');
    await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });

    // conteúdo real (um template) para os painéis terem o que renderizar
    await page.getByRole('button', { name: /abrir templates/i }).click({ force: true });
    const modal = page.locator('.modal-panel');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await modal.getByRole('button').filter({ hasText: 'Erro Comum' }).first().click({ force: true });
    await page.waitForTimeout(1200);

    // percorre os 3 modos; cada um expõe um conjunto maior de abas.
    // O modo é setado via storage + reload (o dropdown do ModeSwitcher é
    // position:fixed calculado e não é confiável sob clique programático).
    const contagem = {};
    for (const modo of ['criador', 'diretor', 'studio']) {
      // lsGet faz JSON.parse — o valor precisa ir com aspas, senão o app
      // cai no fallback 'criador' silenciosamente.
      await page.evaluate((m) => localStorage.setItem('vc_app_mode', JSON.stringify(m)), modo);
      await page.reload();
      // após o reload normalmente já estamos no editor (shellView persiste);
      // timeout curto para não pagar 30s de espera quando o botão não existe
      await page.getByRole('button', { name: /continuar no editor/i })
        .click({ force: true, timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(400);

      const abas = page.getByRole('tab');
      const n = await abas.count();
      expect(n, `modo ${modo} deveria expor abas`).toBeGreaterThan(0);
      contagem[modo] = n;
      for (let i = 0; i < n; i++) {
        await abas.nth(i).click({ force: true });
        await page.waitForTimeout(120);
      }
    }
    // o gating por modo tem de ser crescente (Criador ⊂ Diretor ⊂ Studio)
    expect(contagem.diretor).toBeGreaterThan(contagem.criador);
    expect(contagem.studio).toBeGreaterThan(contagem.diretor);

    expect(erros, `erros no editor:\n${erros.join('\n')}`).toEqual([]);
  });

  test('todos os modais principais abrem sem erro', async ({ page }) => {
    test.setTimeout(90_000);
    const erros = coletorDeErros(page);
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.route('https://api.openai.com/**', (r) => r.fulfill({ status: 401, json: {} }));

    await page.goto('/?app=1');
    await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });

    const abrir = [
      /templates prontos/i,
      /abrir biblioteca/i,
      /ajuda e atalhos/i,
      /tela cheia/i,
    ];
    for (const nome of abrir) {
      const botao = page.getByRole('button', { name: nome }).first();
      if (!(await botao.count())) continue;
      await botao.click({ force: true });
      await page.waitForTimeout(500);
      // fecha por Escape (todos os modais respondem)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    expect(erros, `erros ao abrir modais:\n${erros.join('\n')}`).toEqual([]);
  });

  test('home: perfil e projetos renderizam sem erro', async ({ page }) => {
    const erros = coletorDeErros(page);
    await mockApi(page, { session: SESSAO_ATIVA });
    await page.goto('/?app=1');

    await page.getByRole('button', { name: /perfil/i }).first().click({ force: true });
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: /projetos/i }).first().click({ force: true });
    await page.waitForTimeout(600);

    expect(erros, `erros na home:\n${erros.join('\n')}`).toEqual([]);
  });

  test('landing completa: rola a página inteira sem erro', async ({ page }) => {
    const erros = coletorDeErros(page);
    await mockApi(page);
    await page.goto('/?landing=1');

    await page.evaluate(async () => {
      const alvo = document.querySelector('.vc-landing-shell') || document.scrollingElement;
      for (let y = 0; y < alvo.scrollHeight; y += 600) {
        alvo.scrollTop = y;
        await new Promise((r) => setTimeout(r, 60));
      }
    });
    await page.waitForTimeout(800);

    expect(erros, `erros na landing:\n${erros.join('\n')}`).toEqual([]);
  });
});
