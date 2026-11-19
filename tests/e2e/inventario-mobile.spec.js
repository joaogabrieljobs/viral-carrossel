// Inventário da navegação em 390×844 (docs/product/navegacao-mobile.md).
// Não faz parte do portão: só roda com MOONT_INVENTARIO=1 e grava capturas e
// medidas em docs/mobile-nav/antes/. Vira teste de regressão quando a nova
// navegação for aprovada.
//   MOONT_INVENTARIO=1 npx playwright test tests/e2e/inventario-mobile.spec.js
import { test, expect, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

const OUT = path.resolve(process.env.MOONT_INVENTARIO_SAIDA || 'docs/mobile-nav/antes');
const iphone = devices['iPhone 13'];
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: iphone.userAgent });
test.skip(process.env.MOONT_INVENTARIO !== '1', 'Inventário manual: rodar com MOONT_INVENTARIO=1');
test.setTimeout(120_000);

const SLIDES = [
  ['5 erros que travam o seu Instagram', 'O que quase todo perfil pequeno faz sem perceber.'],
  ['Postar sem gancho', 'Os dois primeiros segundos decidem se a pessoa fica.'],
  ['Falar de tudo ao mesmo tempo', 'Um assunto por carrossel. O resto vira outro post.'],
  ['Esconder a oferta', 'Quem chegou até o fim quer saber o próximo passo.'],
  ['Salve para revisar antes de postar', 'E mande para quem está começando agora.'],
];

async function medir(page, nome) {
  const dados = await page.evaluate(() => {
    const vw = window.innerWidth; const vh = window.innerHeight;
    const visivel = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw
        && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
    };
    const alvos = [...document.querySelectorAll('button, a[href], [role="button"], [role="tab"], [role="menuitem"], input, select, textarea, [contenteditable="true"]')]
      .filter(visivel)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          rotulo: (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 60),
          x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
        };
      });
    let card = [...document.querySelectorAll('[data-vc-inline-editable="true"]')]
      .filter((el) => !el.closest('[data-vc-export-tree]') && el.getBoundingClientRect().width > 0)[0] || null;
    while (card) {
      const r = card.getBoundingClientRect();
      if (r.width > 200 && r.height > 0 && r.width / r.height > 0.5 && r.width / r.height < 1.9 && r.height > 180) break;
      card = card.parentElement;
    }
    const cr = card?.getBoundingClientRect();
    return {
      vw, vh,
      scrollWidth: document.documentElement.scrollWidth,
      rolagemHorizontal: document.documentElement.scrollWidth > vw + 1,
      total: alvos.length,
      menoresQue44: alvos.filter((a) => a.w < 44 || a.h < 44),
      alvos,
      card: cr ? { x: Math.round(cr.left), y: Math.round(cr.top), w: Math.round(cr.width), h: Math.round(cr.height), fracaoVisivel: Math.round(100 * Math.max(0, Math.min(cr.bottom, vh) - Math.max(cr.top, 0)) / cr.height) } : null,
    };
  });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${nome}.json`), JSON.stringify(dados, null, 1));
  await page.screenshot({ path: path.join(OUT, `${nome}.png`) });
  return dados;
}

const fechar = async (page) => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  for (const nome of [/^Fechar painel/, /^Fechar$/, /^Voltar ao card/, /^Concluir$/]) {
    const b = page.getByRole('button', { name: nome }).first();
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(250); }
  }
};

test('inventário 390×844: abrir, editar texto, trocar estilo, exportar', async ({ page }) => {
  let manifest = null;
  await mockApi(page, {
    session: { ...SESSAO_ATIVA, tier: 'creator', imageQuota: { status: 'available', available: true, allowed: true, used: 3, limit: 50, remaining: 47, tier: 'creator', activity: [] } },
    extra: {
      '/api/library-sync': (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const body = request.method() === 'POST' ? request.postDataJSON() : {};
        if (body.action === 'push') manifest = { ...body.manifest, revision: 1, updatedAt: Date.now() };
        if (url.searchParams.get('full') === '1') return route.fulfill({ json: { ok: true, manifest } });
        const meta = manifest && { revision: 1, updatedAt: manifest.updatedAt, projectCount: manifest.docs.length, assetIds: [] };
        return route.fulfill({ json: { ok: true, empty: !manifest, meta, ...meta } });
      },
    },
  });
  await page.addInitScript(({ slides, owner }) => {
    if (localStorage.getItem('vc_library') !== null) return;
    localStorage.setItem('vc_data_owner', JSON.stringify(owner));
    localStorage.setItem('vc_library', JSON.stringify([{
      id: 'inv-mobile', name: '5 erros no Instagram', updatedAt: Date.now(),
      doc: { fmt: 'carrossel', slides: slides.map(([title, subtitle], i) => ({
        id: `inv-${i}`, num: i + 1, title, subtitle, layout: 'mc', align: 'center', textShadow: false,
      })) },
    }]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('inv-mobile'));
  }, { slides: SLIDES, owner: `email:${SESSAO_ATIVA.email}` });

  await page.goto('/?app=1');
  await expect(page.locator('[data-vc-tour="account-home"]')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(800);
  await medir(page, '01-inicio');

  await enterEditorFromHome(page);
  await page.waitForTimeout(1800);
  await medir(page, '02-rapido-editor-primeira-dobra');

  // Editar texto: toque no título do card.
  const titulo = page.locator('[data-vc-inline-editable="true"]:visible').filter({ hasText: '5 erros' }).first();
  if (await titulo.isVisible().catch(() => false)) {
    await titulo.click();
    await page.waitForTimeout(900);
    await medir(page, '03-rapido-editar-texto-no-card');
    await fechar(page);
  }

  const barra = page.locator('[data-vc-tour="mobile-bar"]');
  const abrirAba = async (rotulo, arquivo) => {
    const b = barra.getByRole('button', { name: `Abrir aba ${rotulo}`, exact: true });
    if (!await b.isVisible().catch(() => false)) { fs.writeFileSync(path.join(OUT, `${arquivo}.AUSENTE.txt`), rotulo); return; }
    await b.click();
    await page.waitForTimeout(1000);
    await medir(page, arquivo);
    await page.evaluate(() => { const d = [...document.querySelectorAll('*')].filter((el) => el.scrollHeight > el.clientHeight + 40 && getComputedStyle(el).overflowY.match(/auto|scroll/) && el.clientHeight > 200).sort((a, b) => b.clientHeight - a.clientHeight)[0]; if (d) d.scrollTop = d.clientHeight * 0.9; });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `${arquivo}-rolado.png`) });
    await fechar(page);
    await expect(barra).toBeVisible({ timeout: 5000 }).catch(async () => { await page.reload(); await page.waitForTimeout(1500); });
  };
  await abrirAba('Início', '04-rapido-aba-inicio');
  await abrirAba('Ajustes', '05-rapido-aba-ajustes');

  const exportar = page.getByRole('button', { name: 'Opções de download' }).first();
  if (await exportar.isVisible().catch(() => false)) {
    await exportar.click();
    await page.waitForTimeout(700);
    await medir(page, '06-exportar-menu');
    await fechar(page);
  }

  // Modo profissional: a barra muda para Narrativa · Texto · Imagem · Mais.
  const modo = page.getByRole('button', { name: /^Modo atual:/ });
  await modo.click();
  await page.waitForTimeout(500);
  await medir(page, '07-menu-de-modo');
  await page.getByRole('menuitem', { name: /^Controle profissional/ }).click();
  await page.waitForTimeout(1200);
  await fechar(page);
  await medir(page, '08-profissional-editor-primeira-dobra');
  await abrirAba('Narrativa', '09-profissional-aba-narrativa');
  await abrirAba('Texto', '10-profissional-aba-texto');
  await abrirAba('Imagem', '11-profissional-aba-imagem');
  await abrirAba('Mais', '12-profissional-aba-mais');
});

// Caso do João (19/11): Stories, projeto com contexto e referência ativos.
test('inventário 390×844: Stories com contexto ativo e painel de texto aberto', async ({ page }) => {
  let manifest = null;
  await mockApi(page, {
    session: { ...SESSAO_ATIVA, tier: 'creator' },
    extra: {
      '/api/library-sync': (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const body = request.method() === 'POST' ? request.postDataJSON() : {};
        if (body.action === 'push') manifest = { ...body.manifest, revision: 1, updatedAt: Date.now() };
        if (url.searchParams.get('full') === '1') return route.fulfill({ json: { ok: true, manifest } });
        const meta = manifest && { revision: 1, updatedAt: manifest.updatedAt, projectCount: manifest.docs.length, assetIds: [] };
        return route.fulfill({ json: { ok: true, empty: !manifest, meta, ...meta } });
      },
    },
  });
  await page.addInitScript(({ owner }) => {
    if (localStorage.getItem('vc_library') !== null) return;
    localStorage.setItem('vc_data_owner', JSON.stringify(owner));
    localStorage.setItem('vc_library', JSON.stringify([{
      id: 'inv-stories', name: 'Teste Clínica Janine', updatedAt: Date.now(),
      doc: {
        fmt: 'stories',
        styleKit: { contextMd: 'Clínica de medicina regenerativa.', stylePrompt: '', refImages: [{ id: 'r1', dataUrl: '' }] },
        slides: ['Medicina regenerativa não mascara o problema', 'O que muda no tratamento', 'Como o corpo recebe o estímulo', 'Agende sua avaliação']
          .map((title, i) => ({ id: `st-${i}`, num: i + 1, title, subtitle: 'Ela estimula os mecanismos naturais de autocura do corpo.', layout: 'mc', align: 'center', textShadow: false })),
      },
    }]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('inv-stories'));
  }, { owner: `email:${SESSAO_ATIVA.email}` });
  await page.goto('/?app=1');
  await expect(page.locator('[data-vc-tour="account-home"]')).toBeVisible({ timeout: 30_000 });
  await enterEditorFromHome(page);
  await page.waitForTimeout(1500);
  await medir(page, '20-stories-contexto-primeira-dobra');
  const titulo = page.locator('[data-vc-inline-editable="true"]:visible').filter({ hasText: 'Medicina' }).first();
  await titulo.click();
  await page.waitForTimeout(1200);
  await medir(page, '21-stories-painel-texto-aberto');
});
