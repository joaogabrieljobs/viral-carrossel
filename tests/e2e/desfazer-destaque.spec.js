// Telas do iPhone (27/11): o desfazer da faixa "Contexto ON" era um ícone
// pequeno e apagado, e havia outro desfazer redondo na fila de miniaturas,
// os dois no mesmo histórico. Agora: um "Desfazer" só, escrito, com 44 px.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

const semear = page => page.addInitScript(() => {
  if (localStorage.getItem('vc_library') !== null) return;
  localStorage.setItem('vc_library', JSON.stringify([{
    id: 'undo', name: 'Apoteose 9', updatedAt: Date.now(),
    doc: { fmt: 'carrossel', styleKit: { contextMd: 'Esquenta de Carnaval em São Paulo.', stylePrompt: '', refImages: [] },
      slides: [1, 2, 3].map(n => ({ id: `undo-${n}`, num: n, title: `Título do card ${n}`, subtitle: 'Texto de apoio do card.', layout: 'mc', align: 'center' })) },
  }]));
  localStorage.setItem('vc_active_doc_id', JSON.stringify('undo'));
});

async function abrir(page) {
  await mockApi(page, { session: SESSAO_ATIVA, extra: {
    '/api/library-sync': route => route.fulfill({ json: { ok: true, empty: true, manifest: null, meta: null } }),
  } });
  await semear(page);
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await expect(page.locator('main [data-vc-card-surface]').first()).toBeVisible();
}

async function confereDesfazer(page) {
  const faixa = page.getByRole('status', { name: 'Contexto ativo' });
  await expect(faixa).toBeVisible();
  await expect(faixa.getByRole('button')).toHaveCount(0);
  const undo = page.getByRole('button', { name: 'Desfazer', exact: true });
  await expect(undo).toHaveCount(1);
  await expect(undo).toHaveText('Desfazer');
  const box = await undo.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
  const redo = await page.getByRole('button', { name: 'Refazer', exact: true }).boundingBox();
  expect(Math.min(redo.width, redo.height)).toBeGreaterThanOrEqual(44);
  return undo;
}

for (const [nome, viewport, mobile] of [['celular', { width: 390, height: 844 }, true], ['desktop', { width: 1440, height: 900 }, false]]) {
  test.describe(nome, () => {
    test.use({ viewport, isMobile: mobile, hasTouch: mobile });
    test(`${nome}: um Desfazer só, escrito, 44 px, desabilitado claro e com foco de teclado`, async ({ page }) => {
      await abrir(page);
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      const undo = await confereDesfazer(page);
      // Sem alteração na sessão, o botão fica desabilitado e diz por quê.
      if (await undo.isDisabled()) await expect(undo).toHaveAttribute('title', 'Nada para desfazer');
      // Uma alteração habilita; Desfazer volta o título.
      await page.getByRole('button', { name: /^Adicionar (card|slide)/ }).click();
      await expect(page.getByRole('button', { name: /^Card \d+ de \d+$/ })).toHaveCount(4);
      await expect(undo).toBeEnabled();
      await expect(undo).toHaveAttribute('title', 'Desfazer a última alteração (⌘Z)');
      if (!mobile) {
        // Foco pelo teclado (Tab e volta): o anel de foco aparece.
        await undo.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await expect(undo).toBeFocused();
        const outline = await undo.evaluate(el => getComputedStyle(el).outlineStyle);
        expect(outline).not.toBe('none');
      }
      await undo.click();
      await expect(page.getByRole('button', { name: /^Card \d+ de \d+$/ })).toHaveCount(3);
    });
  });
}
