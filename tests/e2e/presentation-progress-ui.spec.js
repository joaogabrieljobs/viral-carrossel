import { test, expect } from '@playwright/test';
import { mockEditorApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome, selectEditorMode } from './helpers/project-entry.js';
import { presentationBatch } from './helpers/presentation-batches.js';
import { PRESENTATION_PLAN_PROMPT_VERSION } from '../../src/utils/presentation-plan.js';

const session = { ...SESSAO_ATIVA, tier: 'creator', imageQuota: { limit: 50, remaining: 50, used: 0 } };

async function openPresentationModal(page, extra = {}) {
  await mockEditorApi(page, { session, extra });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await selectEditorMode(page, 'diretor');
  await page.getByRole('button', { name: 'Apresentação 16:9', exact: true }).first().click();
  await page.getByRole('button', { name: 'Gerar apresentação com IA', exact: true }).first().click();
  // The dialog's accessible label may use its product heading; the panel is
  // stable across the same public wizard used by the existing regression suite.
  const panel = page.locator('.modal-panel');
  await expect(panel).toBeVisible();
  await panel.getByLabel('Qual é o tema da apresentação?', { exact: true }).fill('Explique como registrar as decisões de uma reunião.');
  return panel;
}

test('modal conserva a quantidade escolhida ao experimentar outro caminho', async ({ page }) => {
  const modal = await openPresentationModal(page);
  await modal.getByRole('radio', { name: /^Pitch/ }).click();
  await modal.getByRole('button', { name: /Continuar/ }).click();
  await modal.getByRole('group', { name: 'Número de slides', exact: true }).getByRole('button', { name: '8', exact: true }).click();
  await modal.getByRole('button', { name: 'Voltar', exact: true }).click();
  await modal.getByRole('radio', { name: /^Aula \/ Workshop/ }).click();
  await modal.getByRole('button', { name: /Continuar/ }).click();
  await expect(modal.getByRole('group', { name: 'Número de slides', exact: true }).getByRole('button', { name: '8', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('Criar rápido preserva quantidade explícita e Auto ao trocar a estrutura', async ({ page }) => {
  await mockEditorApi(page, { session });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await page.getByRole('button', { name: 'Apresentação 16:9', exact: true }).first().click();
  await page.getByRole('group', { name:'Narrativa para criar', exact:true }).getByRole('button', { name:/^Moont Apresenta:/ }).click();
  const counts = page.getByRole('group', { name: 'Quantidade de slides', exact: true });
  const paths = page.getByRole('group', { name: 'Estrutura narrativa da apresentação', exact: true });
  await counts.getByRole('button', { name: '8', exact: true }).click();
  await paths.getByRole('button', { name: 'Aula', exact: true }).click();
  await expect(counts.getByRole('button', { name: '8', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await counts.getByRole('button', { name: 'Auto', exact: true }).click();
  await paths.getByRole('button', { name: 'Pitch', exact: true }).click();
  await expect(counts.getByRole('button', { name: 'Auto', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('modal deixa a falha visível e focada e mantém as escolhas para repetir', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 713 });
  const modal = await openPresentationModal(page, {
    '/api/ai/compatible': route => route.fulfill({ status: 400, json: { error: { message: 'Falha controlada do planejamento.' } } }),
  });
  await modal.getByRole('button', { name: /Continuar/ }).click();
  await modal.getByRole('group', { name: 'Número de slides', exact: true }).getByRole('button', { name: '8', exact: true }).click();
  await modal.getByRole('button', { name: /Continuar/ }).click();
  await modal.getByRole('radio', { name: 'Só texto', exact: true }).check();
  await modal.getByRole('button', { name: /Continuar/ }).click();
  await modal.getByRole('button', { name: 'Gerar apresentação', exact: true }).click();
  const alert = modal.getByRole('alert');
  await expect(alert).toContainText('Falha controlada do planejamento');
  await expect(alert).toContainText('Organizando o roteiro e as evidências');
  await expect(alert).toBeInViewport();
  await expect(alert).toBeFocused();
  await expect(alert).toContainText('Suas escolhas continuam aqui');
  await modal.getByRole('button', { name: 'Voltar', exact: true }).click();
  await modal.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(modal.getByRole('group', { name: 'Número de slides', exact: true }).getByRole('button', { name: '8', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('assistente mostra falha acima do resumo e não exige procurar a mensagem', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 713 });
  await mockEditorApi(page, { session, extra: {
    '/api/ai/compatible': route => route.fulfill({ status: 400, json: { error: { message: 'Falha controlada do planejamento.' } } }),
  } });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: 'Criar um projeto', exact: true }).click();
  const flow = page.getByRole('region', { name: 'Criar novo projeto', exact: true });
  const next = () => flow.getByRole('button', { name: 'Continuar', exact: true }).click();
  await flow.getByRole('radio', { name: /^Apresentação/ }).click();
  await flow.getByLabel(/^Nome do projeto/).fill('Apresentação para retomar');
  await next(); await next();
  await flow.getByLabel(/^Sobre o que vamos criar/).fill('Explique como registrar decisões de uma reunião.');
  await next(); await next();
  await flow.getByRole('spinbutton', { name: 'Quantidade de slides', exact: true }).fill('6');
  await next(); await next();
  await flow.getByRole('button', { name: 'Criar e gerar 6 slides', exact: true }).click();
  const alert = flow.getByRole('alert');
  await expect(alert).toContainText('Falha controlada do planejamento');
  await expect(alert).toContainText('Organizando o roteiro e as evidências');
  await expect(alert).toBeInViewport();
  await expect(alert).toBeFocused();
  await expect(alert).toContainText('Suas escolhas continuam aqui');
  await flow.getByRole('button', { name: 'Alterar quantidade', exact: true }).click();
  await expect(flow.getByRole('spinbutton', { name: 'Quantidade de slides', exact: true })).toHaveValue('6');
});

test('roteiro aparece primeiro e os lotes chegam à prévia antes de concluir seis slides', async ({ page }) => {
  test.setTimeout(60_000);
  const gates = Array.from({ length:3 }, () => {
    let release;
    const wait = new Promise(resolve => { release = resolve; });
    return { wait, release };
  });
  const stages = [];
  const slides = Array.from({ length:6 }, (_, index) => ({
    title:`Decisão da etapa ${index + 1}`, subtitle:'Registre o que foi definido antes de agir.',
    bodyAfterImage:'', imageQuery:'', presentationBlocks:[], speakerNotes:'',
  }));
  const modal = await openPresentationModal(page, {
    '/api/ai/compatible': async route => {
      const prompt = route.request().postDataJSON().payload.messages.find(message => message.role === 'user').content;
      let data;
      if (prompt.startsWith('PLANEJAMENTO ESTRUTURADO')) {
        stages.push('plan');
        data = { schemaVersion:1, promptVersion:PRESENTATION_PLAN_PROMPT_VERSION,
          objective:'Registrar decisões com clareza.', audience:'Equipe que participa de reuniões.', thesis:'Defina o próximo passo antes de agir.', evidence:[], gaps:[],
          slides:slides.map((slide, index) => ({ index:index + 1, visualRole:index === 0 ? 'cover' : index === 5 ? 'closing' : 'content',
            purpose:index === 0 ? 'introduction' : index === 5 ? 'decision' : 'learning', question:`O que registrar na etapa ${index + 1}?`,
            keyMessage:slide.title, evidenceIds:[], imageBrief:'' })),
        };
      } else if (prompt.startsWith('REVISÃO DE APRESENTAÇÃO')) {
        stages.push('review');
        await gates[2].wait;
        data = { edits:[] };
      } else {
        const batch = presentationBatch(prompt, slides);
        const first = batch[0].title === slides[0].title;
        stages.push(first ? 'first-batch' : 'second-batch');
        await gates[first ? 0 : 1].wait;
        data = { slides:batch, caption:'' };
      }
      return route.fulfill({ json:{ choices:[{ message:{ content:JSON.stringify(data) } }] } });
    },
  });
  await modal.getByRole('button', { name:/Continuar/ }).click();
  await modal.getByRole('group', { name:'Número de slides', exact:true }).getByRole('button', { name:'6', exact:true }).click();
  await modal.getByRole('button', { name:/Continuar/ }).click();
  await modal.getByRole('radio', { name:'Só texto', exact:true }).check();
  await modal.getByRole('button', { name:/Continuar/ }).click();
  await modal.getByRole('button', { name:'Gerar apresentação', exact:true }).click();
  const preview = modal.getByRole('region', { name:'Acompanhamento da geração', exact:true });
  try {
    await expect.poll(() => stages).toEqual(['plan', 'first-batch']);
    await expect(preview.getByText('Roteiro organizado · 6 slides', { exact:true })).toBeVisible();
    await expect(preview.getByRole('list', { name:'Estrutura da apresentação' }).getByRole('listitem')).toHaveCount(6);
    await expect(preview.getByRole('article')).toHaveCount(0);
    gates[0].release();
    await expect.poll(() => stages).toEqual(['plan', 'first-batch', 'second-batch']);
    await expect(preview.getByRole('article')).toHaveCount(3);
    await expect(preview.getByText('Slides preparados: 3 de 6', { exact:true })).toBeVisible();
    await expect(preview.getByRole('button', { name:/Exportar/ })).toHaveCount(0);
    gates[1].release();
    await expect.poll(() => stages).toEqual(['plan', 'first-batch', 'second-batch', 'review']);
    await expect(preview.getByRole('article')).toHaveCount(6);
    await expect(preview.getByText('Slides preparados: 6 de 6', { exact:true })).toBeVisible();
  } finally { gates.forEach(gate => gate.release()); }
  await expect(modal).toHaveCount(0, { timeout:30_000 });
  await expect.poll(() => page.evaluate(() => {
    const id = JSON.parse(localStorage.getItem('vc_active_doc_id') || 'null');
    const projects = JSON.parse(localStorage.getItem('vc_library') || '[]');
    return projects.find(project => project.id === id)?.doc?.slides?.map(slide => slide.title);
  })).toEqual(slides.map(slide => slide.title));
});

test('interrupção de acesso preserva três de seis slides e explica a causa após recarregar', async ({ page }) => {
  test.setTimeout(60_000);
  const stages = [];
  const slides = Array.from({ length:6 }, (_, index) => ({
    title:`Decisão preservada ${index + 1}`, subtitle:'Registre o próximo passo antes de agir.',
    bodyAfterImage:'', imageQuery:'', presentationBlocks:[], speakerNotes:'',
  }));
  const modal = await openPresentationModal(page, {
    '/api/ai/compatible': async route => {
      const prompt = route.request().postDataJSON().payload.messages.find(message => message.role === 'user').content;
      let data;
      if (prompt.startsWith('PLANEJAMENTO ESTRUTURADO')) {
        stages.push('plan');
        data = { schemaVersion:1, promptVersion:PRESENTATION_PLAN_PROMPT_VERSION,
          objective:'Registrar decisões com clareza.', audience:'Equipe de reuniões.', thesis:'Defina o próximo passo.', evidence:[], gaps:[],
          slides:slides.map((slide, index) => ({ index:index + 1, visualRole:index === 0 ? 'cover' : index === 5 ? 'closing' : 'content',
            purpose:index === 0 ? 'introduction' : index === 5 ? 'decision' : 'learning', question:`O que registrar na etapa ${index + 1}?`,
            keyMessage:slide.title, evidenceIds:[], imageBrief:'' })),
        };
      } else if (prompt.startsWith('REVISÃO DE APRESENTAÇÃO')) {
        stages.push('review');
        data = { edits:[] };
      } else {
        const batch = presentationBatch(prompt, slides);
        if (batch[0].title !== slides[0].title) {
          stages.push('subscription-required');
          return route.fulfill({ status:402, json:{ code:'subscription_required', error:'Confirme o acesso da assinatura.' } });
        }
        stages.push('first-batch');
        data = { slides:batch, caption:'Próximos passos para registrar decisões.' };
      }
      return route.fulfill({ json:{ choices:[{ message:{ content:JSON.stringify(data) } }] } });
    },
  });
  await modal.getByRole('button', { name:/Continuar/ }).click();
  await modal.getByRole('group', { name:'Número de slides', exact:true }).getByRole('button', { name:'6', exact:true }).click();
  await modal.getByRole('button', { name:/Continuar/ }).click();
  await modal.getByRole('radio', { name:'Só texto', exact:true }).check();
  await modal.getByRole('button', { name:/Continuar/ }).click();
  await modal.getByRole('button', { name:'Gerar apresentação', exact:true }).click();
  await expect(modal).toHaveCount(0, { timeout:30_000 });
  const notice = page.getByRole('region', { name:'Revisão pendente do conteúdo', exact:true });
  await expect(notice).toContainText('3 de 6 slides preservados');
  await expect(notice).toContainText('O serviço pediu a confirmação da assinatura');
  await expect(notice).not.toContainText('assinatura inativa');
  expect(stages).toEqual(['plan', 'first-batch', 'subscription-required']);
  await expect.poll(() => page.evaluate(() => {
    const id = JSON.parse(localStorage.getItem('vc_active_doc_id') || 'null');
    const doc = JSON.parse(localStorage.getItem('vc_library') || '[]').find(project => project.id === id)?.doc;
    return { titles:doc?.slides?.map(slide => slide.title), issue:doc?.editorialReviewIssues?.find(issue => issue.code === 'presentation_incomplete'), quality:doc?.presentationQuality };
  })).toMatchObject({ titles:slides.slice(0,3).map(slide => slide.title), issue:{ completedCount:3, totalCount:6, interruptionReason:'subscription_required' },
    quality:{ incomplete:true, completedCount:3, totalCount:6, interruptionReason:'subscription_required', writingDiagnostics:[
      expect.objectContaining({ from:1, to:3, outcome:'validated' }),
      expect.objectContaining({ from:4, to:6, outcome:'access_interrupted', httpStatus:402 }),
    ] },
  });
  await page.reload();
  await enterEditorFromHome(page);
  await expect(notice).toContainText('3 de 6 slides preservados');
  await expect(notice).toContainText('O serviço pediu a confirmação da assinatura');
  await expect(page.getByRole('heading', { name:slides[2].title, exact:true })).toBeVisible();
  await expect(page.getByRole('heading', { name:slides[3].title, exact:true })).toHaveCount(0);
});
