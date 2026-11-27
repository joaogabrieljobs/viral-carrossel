// iPhone deitado (27/11, captura 7): em 932×430 o cabeçalho, a barra de
// formatos, a faixa de contexto, as abas e as miniaturas ocupavam a altura
// inteira e o card não aparecia. Agora as barras secundárias ficam atrás de
// "Ferramentas" e o card cabe inteiro na tela.
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

const fixture = JSON.parse(fs.readFileSync(new URL('../fixtures/apoteose-teste8.json', import.meta.url)));
const photo = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12"><path fill="#a35" d="M0 0h16v12H0z"/></svg>').toString('base64');

async function abrir(page) {
  await mockApi(page, { session: SESSAO_ATIVA, extra: {
    '/api/library-sync': route => route.fulfill({ json: { ok: true, empty: true, manifest: null, meta: null } }),
  } });
  const doc = structuredClone(fixture.doc);
  doc.styleKit = { contextMd: 'Esquenta de Carnaval em São Paulo.', stylePrompt: 'Noite, roxo e vermelho.', refImages: [] };
  doc.slides = doc.slides.map(s => ({ ...s, ...(s.bgImageId ? { bgImageId: null, bgImage: photo } : {}) }));
  await page.addInitScript(({ doc }) => {
    if (localStorage.getItem('vc_library') !== null) return;
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('deitado'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'deitado', name: 'Apoteose 9', updatedAt: Date.now(), doc }]));
  }, { doc });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await expect(page.locator('main [data-canvas-active="true"] [data-vc-card-surface]').first()).toBeVisible();
}

const dentro = (box, viewport) => box.x >= -1 && box.y >= -1
  && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1;

async function cardInteiro(page, viewport) {
  const card = page.locator('main [data-canvas-active="true"] [data-vc-card-surface]').first();
  await expect.poll(async () => {
    const box = await card.boundingBox();
    return box && dentro(box, viewport) && box.height >= viewport.height * 0.45;
  }, { message: 'card ativo inteiro na tela, com pelo menos 45% da altura' }).toBe(true);
  return card.boundingBox();
}

async function alvo(page, name, viewport) {
  const button = page.getByRole('button', { name, exact: true }).first();
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(dentro(box, viewport), name).toBe(true);
  expect(Math.min(box.width, box.height), name).toBeGreaterThanOrEqual(44);
}

for (const viewport of [{ width: 932, height: 430 }, { width: 844, height: 390 }]) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test(`celular deitado ${viewport.width}×${viewport.height}: card inteiro e controles ao alcance`, async ({ page }, testInfo) => {
      await abrir(page);
      for (const [label, fmt] of [['Apresentação 16:9', '16x9'], ['Stories', '9x16'], ['Feed 4:5', '4x5']]) {
        await page.getByRole('button', { name: label, exact: true }).click();
        await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
        await cardInteiro(page, viewport);
        await page.screenshot({ path: testInfo.outputPath(`deitado-${fmt}.png`) });
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      // Recolhidos: contexto, abas e miniaturas. No topo: Gerar, Desfazer, formato.
      await expect(page.getByRole('status', { name: 'Contexto ativo' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Slide 1 de/ })).toHaveCount(0);
      for (const name of ['Gerar apresentação com IA', 'Desfazer', 'Refazer', 'Stories', 'Mostrar ferramentas']) await alvo(page, name, viewport);
      // "Ferramentas" abre as barras (abas, miniaturas, contexto, Exportar) e recolhe de novo.
      const toggle = page.getByRole('button', { name: 'Mostrar ferramentas', exact: true });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.click();
      const recolher = page.getByRole('button', { name: 'Recolher ferramentas', exact: true });
      await expect(recolher).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('status', { name: 'Contexto ativo' })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Slide 1 de/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Opções de download', exact: true }).first()).toBeAttached();
      await page.screenshot({ path: testInfo.outputPath('deitado-ferramentas.png') });
      await recolher.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await cardInteiro(page, viewport);
    });
  });
}

for (const [nome, viewport, mobile] of [['em pé', { width: 390, height: 844 }, true], ['desktop', { width: 1440, height: 900 }, false]]) {
  test.describe(nome, () => {
    test.use({ viewport, isMobile: mobile, hasTouch: mobile });
    test(`${nome}: sem o modo deitado`, async ({ page }) => {
      await abrir(page);
      await expect(page.getByRole('button', { name: 'Mostrar ferramentas', exact: true })).toHaveCount(0);
      await expect(page.getByRole('status', { name: 'Contexto ativo' })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Slide 1 de/ })).toBeVisible();
    });
  });
}
