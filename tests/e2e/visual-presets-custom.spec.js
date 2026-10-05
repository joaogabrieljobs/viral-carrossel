import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const currentDoc = page => page.evaluate(() => {
  const lib = JSON.parse(localStorage.getItem('vc_library') || '[]');
  return (lib.find((entry) => entry.id === localStorage.getItem('vc_active_doc_id')) || lib[0])?.doc;
});

test('padrão preserva subtítulo e padrão personalizado entra na biblioteca', async ({ page }) => {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
  await page.getByRole('button', { name: /abrir templates/i }).click({ force: true });
  await page.locator('.modal-panel').getByRole('button').filter({ hasText: 'Erro Comum' }).first().click({ force: true });
  await page.evaluate(() => localStorage.setItem('vc_app_mode', JSON.stringify('studio')));
  await page.reload();
  await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true, timeout: 2500 }).catch(() => {});
  await page.getByRole('tab', { name: /^Visual$/i }).click({ force: true });

  await page.getByTitle(/Case Study Neon/i).click({ force: true });
  await expect.poll(async () => (await currentDoc(page))?.brand?.subtitleVisible).toBe(true);
  expect(String((await currentDoc(page))?.slides?.[0]?.subtitle || '').trim()).not.toBe('');

  await page.getByLabel('Salvar o seu padrão').fill('MUSA personalizado');
  await page.getByRole('button', { name: /Salvar padrão personalizado/i }).click();
  await expect(page.getByTitle(/MUSA personalizado/i)).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_custom_visual_presets_v1') || '[]'));
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ label: 'MUSA personalizado', isCustom: true });
  expect(saved[0].brand.subtitleVisible).toBe(true);
});

test('glass cria uma superfície visível no card e não só um toggle', async ({ page }) => {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
  await page.getByRole('button', { name: /abrir templates/i }).click({ force: true });
  await page.locator('.modal-panel').getByRole('button').filter({ hasText: 'Erro Comum' }).first().click({ force: true });
  await page.evaluate(() => localStorage.setItem('vc_app_mode', JSON.stringify('studio')));
  await page.reload();
  await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true, timeout: 2500 }).catch(() => {});
  await page.getByRole('tab', { name: /^Layout$/i }).click({ force: true });
  await page.getByRole('button', { name: 'Glass ao redor do conteúdo', exact: true }).click({ force: true });
  await page.getByRole('slider', { name: 'Opacidade do glass' }).fill('69');
  const surface = await page.evaluate(() => {
    const card = [...document.querySelectorAll('div')]
      .find((node) => node.style.width === '1080px' && node.style.height === '1350px');
    if (!card) return null;
    const glass = [...card.querySelectorAll('*')].find((node) => node.style.backdropFilter.includes('blur(18px)'));
    if (!glass) return null;
    const title = card.querySelector('h1')?.innerText || '';
    return {
      background: glass.style.background,
      border: glass.style.border,
      shadow: glass.style.boxShadow,
      text: glass.innerText,
      title,
      width: glass.getBoundingClientRect().width,
      cardWidth: card.getBoundingClientRect().width,
    };
  });
  expect(surface).not.toBeNull();
  expect(surface.background).toContain('rgba(7, 8, 13');
  expect(surface.border).toContain('rgba(255, 255, 255, 0.22)');
  expect(surface.shadow).toContain('rgba(0, 0, 0, 0.28)');
  expect(surface.text).not.toContain(surface.title);
  expect(surface.width).toBeLessThan(surface.cardWidth * 0.94);
});

test('duplo clique edita o título no card e a lixeira remove o elemento selecionado', async ({ page }) => {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
  await page.getByRole('button', { name: /abrir templates/i }).click({ force: true });
  await page.locator('.modal-panel').getByRole('button').filter({ hasText: 'Erro Comum' }).first().click({ force: true });

  const title = page.locator('main h1[data-vc-inline-editable="true"]').first();
  await title.dispatchEvent('dblclick');
  await expect(title).toHaveAttribute('contenteditable', 'true');
  await title.evaluate((node) => {
    node.innerText = 'Título editado no próprio card';
    node.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
  await expect.poll(async () => (await currentDoc(page))?.slides?.[0]?.title).toBe('Título editado no próprio card');

  await title.dispatchEvent('click');
  const remove = page.getByRole('button', { name: 'Excluir elemento selecionado' }).first();
  await expect(remove).toBeVisible();
  await remove.dispatchEvent('click');
  await expect.poll(async () => (await currentDoc(page))?.slides?.[0]?.hiddenElements || []).toContain('title');
});
