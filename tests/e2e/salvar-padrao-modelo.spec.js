// Salvar padrão → biblioteca → aplicar em outro projeto dá o mesmo resultado
// que "Publicar como modelo" → "Usar modelo" (publicar-modelo.spec.js, mesmos
// projetos): capa no primeiro card, conteúdo no meio, fechamento no último.
// Antes, o padrão guardava só o card ativo e todos os cards saíam iguais.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

test.setTimeout(90_000);

const projetoA = {
  id: 'proj-a', name: 'Clínica da autora', updatedAt: Date.now(),
  doc: { fmt: 'carrossel', brand: { name: 'Clínica da autora', handle: '@clinicaautora', titleFont: 'Playfair Display', bg: '#14213d', titleColor: '#fca311', textColor: '#e5e5e5' },
    caption: 'Legenda secreta da autora',
    slides: [
      { id: 'a1', title: 'Segredo da capa da autora', subtitle: 'Texto privado', layout: 'mc', align: 'center', titleSize: 130, textShadow: false },
      { id: 'a2', title: 'Miolo privado', subtitle: 'Mais texto privado', layout: 'ml', align: 'left', textShadow: false },
      { id: 'a3', title: 'Fechamento privado', subtitle: 'Contato privado', layout: 'mb', align: 'center', textShadow: false },
    ] },
};
const projetoB = {
  id: 'proj-b', name: 'Projeto de destino', updatedAt: Date.now() - 1000,
  doc: { fmt: 'carrossel', brand: { name: 'Marca B', handle: '@marcab', titleFont: 'Inter', bg: '#ffffff', titleColor: '#000000' },
    slides: [1, 2, 3, 4].map((n) => ({ id: `b${n}`, title: `Texto ${n} da conta B`, subtitle: `Apoio ${n} de B`, layout: 'mt', align: 'right', textShadow: false })) },
};

const biblioteca = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]'));

test('padrão salvo leva capa, miolo e fechamento e aplica em outro projeto como o modelo publicado', async ({ page }) => {
  await mockApi(page, { session: SESSAO_ATIVA, extra: {
    '/api/library-sync': (route) => route.fulfill({ json: { ok: true, empty: true, manifest: null, meta: null } }),
  } });
  await page.addInitScript(({ projetos }) => {
    if (localStorage.getItem('vc_library') !== null) return;
    localStorage.setItem('vc_data_owner', JSON.stringify(`email:${'assinante@teste.exemplo'}`));
    localStorage.setItem('vc_library', JSON.stringify(projetos));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(projetos[0].id));
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
  }, { projetos: [projetoA, projetoB] });
  await page.goto('/?app=1');

  // ── Projeto A: salvar o padrão ─────────────────────────────────────────
  await enterEditorFromHome(page, projetoA.name);
  await page.getByRole('tab', { name: /^Visual$/i }).click({ force: true });
  await page.getByLabel('Salvar o seu padrão').fill('Padrão da autora');
  await page.getByRole('button', { name: /Salvar padrão personalizado/i }).click();
  await expect(page.getByTitle(/^Padrão da autora/)).toBeVisible();

  const [salvo] = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_custom_visual_presets_v1') || '[]'));
  expect(salvo).toMatchObject({ label: 'Padrão da autora', isCustom: true, productKind: 'carrossel' });
  expect(salvo.template.slides.map((s) => s.role)).toEqual(['cover', 'content', 'closing']);
  const json = JSON.stringify(salvo.template);
  for (const privado of ['Segredo', 'privado', 'clinicaautora', 'Clínica da autora', 'Legenda secreta']) expect(json).not.toContain(privado);

  // ── Projeto B: abrir pela biblioteca e aplicar o padrão salvo ───────────
  await page.getByRole('button', { name: 'Abrir biblioteca', exact: true }).click();
  await page.getByRole('button', { name: `Abrir ${projetoB.name}`, exact: true }).first().click();
  await expect(page.getByRole('button', { name: projetoB.name, exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: /^Visual$/i }).click({ force: true });
  await page.getByRole('button', { name: /^Todos os cards$/ }).click();
  await page.getByTitle(/^Padrão da autora/).click({ force: true });

  await expect.poll(async () => (await biblioteca(page)).find((e) => e.id === 'proj-b')?.doc?.slides?.map((s) => [s.title, s.layout, s.align]),
    { timeout: 15_000 }).toEqual([
    ['Texto 1 da conta B', 'mc', 'center'], // capa
    ['Texto 2 da conta B', 'ml', 'left'],   // conteúdo
    ['Texto 3 da conta B', 'ml', 'left'],   // conteúdo repetido
    ['Texto 4 da conta B', 'mb', 'center'], // fechamento
  ]);
  const docB = (await biblioteca(page)).find((e) => e.id === 'proj-b').doc;
  expect(docB.slides[0].titleSize).toBe(130);
  expect(docB.brand).toMatchObject({ name: 'Marca B', handle: '@marcab', titleFont: 'Playfair Display', bg: '#14213d' });
  expect(docB.visualPreset).toBe(salvo.id);
  await expect(page.locator('main [data-vc-card-surface="b1"]')).toContainText('Texto 1 da conta B');
  // O projeto de origem não mudou.
  const docA = (await biblioteca(page)).find((e) => e.id === 'proj-a').doc;
  expect(docA.slides.map((s) => s.title)).toEqual(projetoA.doc.slides.map((s) => s.title));
});
