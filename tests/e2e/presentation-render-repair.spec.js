import { enterEditorFromHome } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { mockEditorApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { PRESENTATION_PLAN_PROMPT_VERSION } from '../../src/utils/presentation-plan.js';

for (const fontsAvailable of [true, false]) test(fontsAvailable
  ? 'generation repairs measured native-table overflow once and persists a clean second audit'
  : 'a missing font preserves the completed deck and marks visual review unavailable', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1680, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Keep genuine FontFaceSet loading and measurement while staying offline:
  // Google's declared families resolve to installed local fonts in this fixture.
  if (fontsAvailable) await page.route('https://fonts.googleapis.com/**', route => {
    const families = [...new Set(new URL(route.request().url()).searchParams.getAll('family').map(value => value.split(':')[0]))];
    const css = families.flatMap(family => ['normal', 'italic'].map(style => `@font-face {
      font-family: ${JSON.stringify(family)}; font-style: ${style}; font-weight: 100 900;
      src: local("Arial"), local("Liberation Sans"), local("DejaVu Sans");
    }`)).join('\n');
    return route.fulfill({ contentType: 'text/css', body: css });
  });
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol) ? route.continue() : route.abort();
  });
  const stages = [];
  const longCell = 'Em estudo. O escopo precisa ser definido antes da oferta, com responsabilidades claras, critérios de avaliação, acompanhamento da jornada e condições explícitas para cada entrega ao longo de todo o período.';
  const headers = ['Oferta', 'Escopo', 'Condição', 'Critério'];
  const originalBlock = [{ type: 'comparison', headers, rows: Array.from({ length: 5 }, () => headers.map(() => longCell)) }];
  const compactBlock = [{ type: 'comparison', headers, rows: Array.from({ length: 5 }, () => [
    'Em estudo: oferta.', 'Em estudo: escopo explícito.', 'Em estudo: condições claras.', 'Em estudo: avaliar a jornada.',
  ]) }];
  const originalNotes = 'Notas originais da apresentação.';
  let releaseRepair;
  const repairGate = new Promise(resolve => { releaseRepair = resolve; });
  await mockEditorApi(page, {
    session: { ...SESSAO_ATIVA, tier: 'creator', imageQuota: { limit: 50, remaining: 50, used: 0 } },
    extra: {
      '/api/ai/compatible': async route => {
        const user = route.request().postDataJSON().payload.messages.find(message => message.role === 'user').content;
        let data;
        if (user.startsWith('PLANEJAMENTO ESTRUTURADO')) {
          stages.push('plan');
          data = { schemaVersion: 1, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
            objective: 'Comparar ofertas ainda em estudo.', audience: 'Equipe que define a oferta.', thesis: 'Definir escopo e condições antes de oferecer.', evidence: [], gaps: [],
            slides: Array.from({ length: 6 }, (_, index) => ({
              index: index + 1, visualRole: index === 0 ? 'cover' : index === 5 ? 'closing' : index === 1 ? 'data' : 'content',
              purpose: index === 0 ? 'introduction' : index === 5 ? 'decision' : index === 1 ? 'comparison' : 'learning',
              question: 'Qual critério precisa ser definido?', keyMessage: 'As ofertas permanecem em estudo até definir escopo e condições.', evidenceIds: [], imageBrief: '',
            })) };
        } else if (user.startsWith('REVISÃO DE APRESENTAÇÃO')) {
          stages.push('editorial-review'); data = { edits: [] };
        } else if (user.startsWith('REPARO VISUAL MEDIDO')) {
          stages.push('render-repair');
          if (fontsAvailable) await repairGate;
          data = { edits: [{ slideIndex: 1, reason: 'Células longas excederam o quadro; detalhes ficam nas notas.',
            presentationBlocks: compactBlock, caption: `${originalNotes}\n\n${longCell}` }] };
        } else {
          stages.push('write');
          data = { slides: Array.from({ length: 6 }, (_, index) => ({
            title: index === 1 ? 'Comparação das ofertas' : 'Definir antes de oferecer',
            subtitle: 'Ofertas em estudo: comparar escopo e condições antes da decisão.', bodyAfterImage: '', imageQuery: '',
            speakerNotes: index === 1 ? originalNotes : '', presentationBlocks: index === 1 ? originalBlock : [],
          })), caption: 'Definir escopo e condições antes da decisão.' };
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
  await modal.getByLabel('Qual é o tema da apresentação?', { exact: true }).fill('Ofertas ainda em estudo, com critérios para definir escopo e condições');
  await modal.getByRole('radio', { name: /^Auto/ }).click();
  await advance();
  await modal.getByRole('group', { name: 'Número de slides', exact: true }).getByRole('button', { name: '6', exact: true }).click();
  await advance();
  await modal.getByRole('radio', { name: 'Texto e imagens', exact: true }).check();
  await advance();
  const generate = modal.getByRole('button', { name: 'Gerar apresentação com imagens', exact: true });
  await expect(generate).toBeEnabled();
  await generate.focus();
  await generate.press('Enter');
  const currentDoc = () => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]')
    .find(project => project.id === JSON.parse(localStorage.getItem('vc_active_doc_id') || 'null'))?.doc);
  const exportedBlock = page.locator('[data-vc-export-tree] [data-vc-presentation-block="comparison"]');
  if (!fontsAvailable) {
    await expect(modal).toHaveCount(0, { timeout: 30_000 });
    await expect.poll(async () => (await currentDoc())?.presentationQuality?.renderCheckStatus, { timeout: 15_000 }).toBe('unavailable');
    const preserved = await currentDoc();
    expect(preserved.slides).toHaveLength(6);
    expect(preserved.slides[1].presentationBlocks).toEqual(originalBlock);
    expect(preserved.slides[1].caption).toBe(originalNotes);
    expect(preserved.presentationQuality.renderRepairStatus).toBe('unavailable');
    expect(preserved.presentationQuality.renderedIssues).toEqual([expect.objectContaining({ code: 'render-assets-unavailable', severity: 'warning' })]);
    await expect(page.getByText('Apresentação criada e preservada. A conferência visual ficou pendente porque uma fonte ou imagem não carregou. Confira antes de exportar.', { exact: true })).toBeVisible();
    expect(stages).toEqual(['plan', 'write', 'editorial-review']);
    return;
  }
  try {
    await expect.poll(() => stages, { timeout: 30_000 }).toContain('render-repair');
    await expect(exportedBlock).toHaveCount(1);
    expect(await exportedBlock.evaluate(node => node.scrollHeight > node.clientHeight + 3)).toBe(true);
    await expect(exportedBlock.locator('tbody tr')).toHaveCount(5);
    await expect(exportedBlock.locator('thead th')).toHaveCount(4);
  } finally { releaseRepair(); }
  await expect(modal).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(async () => (await currentDoc())?.presentationQuality?.renderRepairStatus, { timeout: 15_000 }).toBe('repaired');
  const saved = await currentDoc();
  expect(saved.presentationQuality.renderedIssues.filter(issue => issue.severity === 'error')).toEqual([]);
  expect(saved.slides[1].presentationBlocks).toEqual(compactBlock);
  expect(saved.slides[1].caption).toBe(`${originalNotes}\n\n${longCell}`);
  await expect(exportedBlock.locator('tbody tr')).toHaveCount(5);
  await expect(exportedBlock.locator('thead th')).toHaveCount(4);
  await expect(exportedBlock.locator('tbody td').first()).toHaveText('Em estudo: oferta.');
  expect(await exportedBlock.evaluate(node => node.scrollHeight <= node.clientHeight + 3)).toBe(true);
  expect(stages).toEqual(['plan', 'write', 'editorial-review', 'render-repair']);
});
