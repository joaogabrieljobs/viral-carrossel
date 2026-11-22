import { presentationBatch } from './helpers/presentation-batches.js';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { PRESENTATION_PLAN_PROMPT_VERSION } from '../../src/utils/presentation-plan.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

// These are synthetic projects. Every AI/account request is intercepted; no
// real campaign, invitation or paid generation participates in this suite.
const session = { ...SESSAO_ATIVA, tier: 'essential', imageQuota: { limit: 0, used: 0, remaining: 0 } };
const projectsV2 = process.env.VITE_PROJECTS_V2 === 'true';
const oldBrand = { id: 'creation-old-brand', name: 'Marca anterior', bio: 'Contexto exclusivo do projeto anterior' };
const newBrand = {
  id: 'creation-new-brand', name: 'Marca escolhida', bio: 'Tecnologia para pequenos negócios',
  defaultAudience: 'Donos de pequenos negócios', defaultTone: 'Claro e útil',
  bg: '#102030', titleColor: '#e4d6be', subtitleColor: '#d0c8bb', textColor: '#e4d6be', accent: '#ca7654', visualIdentityLocked: true,
  styleKit: { contextMd: 'A marca trabalha com sites para pequenos negócios.', stylePrompt: 'Fotografia natural.', refImages: [] },
};
const savedPreset = {
  id: 'custom_creation_saved', label: 'Padrão do meu cliente', desc: 'Paleta e tipografia salvas.',
  isCustom: true, productKind: 'carrossel', savedAt: 1780000000000,
  brand: { bg: '#364152', titleColor: '#f2e7d8', subtitleColor: '#ddd7cf', textColor: '#f2e7d8', accent: '#e8ac81', titleFont: 'Inter', bodyFont: 'Inter' },
  slideDefaults: { layout: 'fullbleed', align: 'left', textInset: 8 },
};
const originalProject = {
  id: 'creation-existing', name: 'Campanha preservada', updatedAt: 1780000000000,
  doc: {
    productKind: 'carrossel', fmt: 'carrossel', brand: oldBrand,
    slides: [{ id: 'creation-existing-card', num: 1, title: 'Conteúdo aprovado antes da criação', subtitle: 'Este texto deve continuar intacto.' }],
    material: { content: 'Material exclusivo anterior', sources: '', context: '' },
    styleKit: { contextMd: 'Brief exclusivo anterior', stylePrompt: 'Estilo anterior', refImages: [] },
  },
};
const completion = value => ({ choices: [{ message: { content: JSON.stringify(value) } }] });
const generated = (count, prefix = 'Projeto novo') => ({
  slides: Array.from({ length: count }, (_, index) => ({
    title: `${prefix} ${index + 1}`,
    subtitle: `Orientação concreta ${index + 1} para organizar o trabalho.`,
    // Textos distintos por card: frase igual em 3+ cards pede reparo de repetição.
    bodyAfterImage: index > 1 ? ['Comece pelo próximo passo que o cliente consegue executar.', 'Escolha uma tarefa curta para hoje.', 'Revise o combinado ao fim da semana.', 'Registre o que funcionou.', 'Ajuste o plano com a equipe.', 'Celebre a entrega concluída.'][index - 2] || 'Siga o roteiro.' : '',
    imageQuery: '',
  })),
  caption: 'Um próximo passo claro para começar.',
});
async function library(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]'));
}
function accountMock(withProject, onboarding) {
  const cloud = {
    rows: new Map(withProject ? [[originalProject.id, { entry: structuredClone(originalProject), version: 1 }]] : []),
    revision: 1, metaRevision: 1, puts: [], assets: new Map(),
    metadata: {
      brands: [oldBrand, newBrand], folders: [], activeDocId: withProject ? originalProject.id : null,
      activeBrandId: oldBrand.id, userProfile: null, assetIds: [],
      onboardingDone: onboarding ? null : '1', modesIntroDone: onboarding ? null : '1',
    },
  };
  return { cloud, routes: {
    '/api/projects': route => {
      const request = route.request(), url = new URL(request.url());
      if (request.headers()['x-project-owner'] !== session.customerId) {
        return route.fulfill({ status: 409, json: { code: 'project_owner_changed' } });
      }
      if (request.method() === 'GET' && url.searchParams.has('id')) {
        const row = cloud.rows.get(url.searchParams.get('id'));
        return row ? route.fulfill({ json: { ok: true, project: { id: row.entry.id, ...row, deleted: false } } })
          : route.fulfill({ status: 404, json: { code: 'project_not_found' } });
      }
      if (request.method() === 'GET') return route.fulfill({ json: { ok: true, total: cloud.rows.size, nextCursor: null,
        projects: [...cloud.rows.values()].map(row => ({ id: row.entry.id, version: row.version, deleted: false,
          entry: { id: row.entry.id, name: row.entry.name, status: row.entry.status || 'draft' } })),
      } });
      if (request.method() !== 'PUT') return route.fulfill({ status: 405, json: { error: 'Método não esperado neste teste.' } });
      const body = request.postDataJSON(), previous = cloud.rows.get(body.entry.id);
      if (body.baseVersion !== (previous?.version || 0)) return route.fulfill({ status: 409, json: {
        code: 'project_conflict', cloudVersion: previous?.version || 0, error: 'Conflito de versão.',
      } });
      const entry = { ...body.entry, updatedAt: Date.now() }, version = body.baseVersion + 1;
      cloud.rows.set(entry.id, { entry, version }); cloud.revision++;
      cloud.puts.push({ id: entry.id, version });
      return route.fulfill({ json: { ok: true, project: { id: entry.id, entry, version, deleted: false } } });
    },
    '/api/account-library-meta': route => {
      const request = route.request();
      if (request.headers()['x-account-owner'] !== session.customerId) return route.fulfill({ status: 409, json: { code: 'account_meta_owner_changed' } });
      if (request.method() !== 'GET') {
        const body = request.postDataJSON();
        if (body.baseRevision !== cloud.metaRevision) return route.fulfill({ status: 409, json: { code: 'account_meta_conflict', cloudRevision: cloud.metaRevision } });
        cloud.metadata = { ...cloud.metadata, ...body.metadata }; cloud.metaRevision++;
      }
      return route.fulfill({ json: { ok: true, metadata: cloud.metadata, revision: cloud.metaRevision, updatedAt: Date.now() } });
    },
    '/api/library-sync': route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') {
        const body = request.postDataJSON();
        if (body.action === 'putAsset' && body.dataUrl) {
          cloud.assets.set(body.assetId, body.dataUrl);
          return route.fulfill({ json: { ok: true, assetId: body.assetId, complete: true } });
        }
        return route.fulfill({ status: 400, json: { error: 'O fluxo v2 deve salvar por projeto.' } });
      }
      if (url.searchParams.has('asset')) {
        const dataUrl = cloud.assets.get(url.searchParams.get('asset'));
        return dataUrl ? route.fulfill({ json: { ok: true, asset: { dataUrl } } })
          : route.fulfill({ status: 404, json: { error: 'Imagem não encontrada na conta simulada.' } });
      }
      if (url.searchParams.get('full') === '1') return route.fulfill({ json: { ok: true, manifest: {
        vcVersion: 3, customerId: session.customerId, revision: cloud.revision, updatedAt: Date.now(),
        docs: [...cloud.rows.values()].map(row => row.entry), deletedIds: [], folders: [],
        brands: cloud.metadata.brands, activeDocId: cloud.metadata.activeDocId,
        activeBrandId: cloud.metadata.activeBrandId, assetIds: [],
      } } });
      return route.fulfill({ json: { ok: true, empty: cloud.rows.size === 0, customerId: session.customerId,
        meta: { projectCount: cloud.rows.size, revision: cloud.revision },
      } });
    },
  } };
}
async function setup(page, { withProject = true, ai, onboarding = false } = {}) {
  const account = accountMock(withProject, onboarding);
  await mockApi(page, { session, onboarding, extra: {
    ...(projectsV2 ? account.routes : {}),
    '/api/ai/compatible': ai || (route => route.fulfill({ json: completion({ edits: [] }) })),
    '/api/fetch-source': route => route.fulfill({ json: { ok: true, text: 'A empresa oferece sites com acompanhamento mensal.' } }),
  } });
  await page.addInitScript(({ originalProject, oldBrand, newBrand, savedPreset, withProject }) => {
    if (sessionStorage.getItem('creation-flow-fixture')) return;
    sessionStorage.setItem('creation-flow-fixture', '1');
    localStorage.setItem('vc_library', JSON.stringify(withProject ? [originalProject] : []));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(withProject ? originalProject.id : null));
    localStorage.setItem('vc_brands', JSON.stringify([oldBrand, newBrand]));
    localStorage.setItem('vc_custom_visual_presets_v1', JSON.stringify([savedPreset]));
    localStorage.setItem('vc_active_brand_id', JSON.stringify(oldBrand.id));
    if (withProject) localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    // Even an existing last-session editor must start at the two choices.
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
  }, { originalProject, oldBrand, newBrand, savedPreset, withProject });
  await page.goto('/?app=1');
  await expect(page.getByRole('button', { name: 'Abrir um projeto', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar um projeto', exact: true })).toBeVisible();
  return account.cloud;
}
const flow = page => page.getByRole('region', { name: 'Criar novo projeto', exact: true });
async function next(page) {
  await flow(page).getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('tab', { name: /^(Marca|Narrativa|Visual|Texto|Layout)$/ })).toHaveCount(0);
}
async function configure(page, { name = 'Novo trabalho guiado', count = 5, presentation = false, detailed = false, special = false, defaultIdentity = false, customPreset = false } = {}) {
  await page.getByRole('button', { name: 'Criar um projeto', exact: true }).click();
  const wizard = flow(page);
  await expect(wizard).toBeVisible();
  if (presentation) await wizard.getByRole('radio', { name: /^Apresentação/ }).click();
  await wizard.getByLabel(/^Nome do projeto/).fill(name);
  await next(page);
  await expect(wizard.getByRole('radio', { name: /^Seguir com o padrão do Moont/ })).toHaveAttribute('aria-checked', 'true');
  if (!defaultIdentity) {
    await wizard.getByRole('radio', { name: /^Usar um preset salvo/ }).click();
    await wizard.getByRole('combobox', { name: /^Marca deste projeto/ }).selectOption(newBrand.id);
    if (customPreset) await wizard.getByRole('combobox', { name: /^Padrão visual salvo/ }).selectOption(savedPreset.id);
  }
  if (detailed) {
    await wizard.getByText('Ajustar para este projeto', { exact: true }).click();
    await wizard.getByLabel(/^Para quem é o conteúdo/).fill('Lojas locais que precisam de presença digital');
    await wizard.getByLabel(/^O que o Moont precisa saber sobre a marca/).fill('Brief deste lançamento: tornar os serviços fáceis de entender.');
  }
  await next(page);
  await wizard.getByLabel(/^Sobre o que vamos criar/).fill('Explicar como preparar um site para uma loja local.');
  if (detailed) {
    await wizard.getByLabel(/^Texto de apoio/).fill('O serviço inclui diagnóstico inicial e revisão mensal.');
    await wizard.getByLabel('Importar texto de apoio', { exact: true }).setInputFiles({
      name: 'notas.md', mimeType: 'text/markdown', buffer: Buffer.from('A primeira conversa serve para definir o objetivo do site.'),
    });
    await expect(wizard.getByLabel(/^Texto de apoio/)).toHaveValue(/primeira conversa/);
    await wizard.getByLabel(/^Links e fontes/).fill('https://exemplo.test/servicos');
    await wizard.getByLabel(/^Instruções adicionais/).fill('Não invente preços nem promessas de resultado.');
  }
  await next(page);
  if (presentation) await wizard.getByRole('radio', { name: /^Deixar o Moont organizar/ }).click();
  else {
    const choices = wizard.getByRole('radiogroup', { name: 'Como contar sua ideia' });
    await expect(choices.getByRole('radio')).toHaveCount(9);
    if (special) {
      await wizard.getByText('Outras estruturas prontas', { exact: true }).click();
      await wizard.getByRole('radiogroup', { name: 'Estruturas prontas' }).getByRole('radio', { name: /^Mostrar um erro comum/ }).click();
    } else await choices.getByRole('radio', { name: /^Ensinar passo a passo/ }).click();
  }
  await next(page);
  await wizard.getByRole('spinbutton', { name: `Quantidade de ${presentation ? 'slides' : 'cards'}`, exact: true }).fill(String(count));
  if (!presentation) await wizard.getByRole('radio', { name: /^Stories/ }).click();
  await next(page);
  await wizard.getByRole('radio', { name: /^Criar o texto primeiro/ }).click();
  if (detailed) await wizard.getByLabel(/^Direção visual adicional/).fill('Fundo claro, fotografia editorial e títulos em azul.');
  await next(page);
  await expect(wizard.getByText(/Antes de gerar:.*2–5 min.*nenhum crédito de imagem/i)).toBeVisible();
  await expect(wizard.getByRole('button', { name: `Criar e gerar ${count} ${presentation ? 'slides' : 'cards'}`, exact: true })).toBeVisible();
  return wizard;
}

test('design recomendado fica visível, aplica o preset e mantém a narrativa escolhida', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await setup(page, { withProject: false, ai: route => {
    const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
    return route.fulfill({ json: completion(prompt.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : generated(5, 'Design recomendado')) });
  } });
  const wizard = await configure(page, { name: 'Design com preset', defaultIdentity: true });
  await wizard.getByRole('button', { name: 'Alterar visual', exact: true }).click();
  await expect(wizard.getByRole('button', { name: /^Design recomendado pelo Moont/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(wizard.getByRole('group', { name: 'Estilos para começar', exact: true })).toBeVisible();
  await expect(wizard.getByRole('group', { name: 'Estilos para começar', exact: true }).getByRole('button', { name: /^Ficha técnica/ })).toHaveAttribute('aria-pressed', 'true');
  await wizard.screenshot({ path: testInfo.outputPath('design-recomendado.png') });
  await next(page);
  await expect(wizard).toContainText('Ficha técnica · recomendado');
  await wizard.getByRole('button', { name: 'Criar e gerar 5 cards', exact: true }).click();
  await expect(wizard).toHaveCount(0, { timeout: 25_000 });
  await expect.poll(async () => (await library(page)).find(p => p.name === 'Design com preset')?.doc?.slides?.length).toBe(5);
  const created = (await library(page)).find(p => p.name === 'Design com preset');
  await testInfo.attach('projeto-gerado.json', { body: JSON.stringify(created, null, 2), contentType: 'application/json' });
  expect(created.doc.mode).toBe('how_to');
  // Biblioteca v4: "Ensinar passo a passo" recomenda a família Ficha técnica.
  expect(created.doc.visualPreset).toBe('social_ficha');
  expect(created.doc.brand.titleFont).toContain('IBM Plex Sans');
  expect(created.doc.slides[2].canvas.source).toBe('social-preset');
  const middle = page.locator('main [data-vc-card-surface]').nth(2);
  await expect(middle).toContainText(created.doc.slides[2].bodyAfterImage);
});

// O fim da criação gravava o projeto lendo o documento que o React ainda não
// tinha renderizado: o rascunho de 1 card voltava para o navegador por cerca
// de meio segundo, por cima dos cards já gerados. Quem lesse nesse intervalo
// (ou perdesse a aba ali) ficava com o rascunho. Depois que a geração aparece
// gravada, nenhuma gravação seguinte pode ter menos cards.
test('depois de gravar os cards gerados, a criação não regrava o rascunho inicial', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    window.__vcLibraryWrites = [];
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      if (this === window.localStorage && key === 'vc_library') {
        try {
          const entry = JSON.parse(value).find(p => p.name === 'Gravação sem recuo');
          if (entry) window.__vcLibraryWrites.push(entry.doc?.slides?.length ?? 0);
        } catch { /* valor inválido não é uma gravação de projeto */ }
      }
      return setItem.apply(this, arguments);
    };
  });
  await setup(page, { ai: route => {
    const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
    return route.fulfill({ json: completion(prompt.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : generated(5, 'Sem recuo')) });
  } });
  const wizard = await configure(page, { name: 'Gravação sem recuo' });
  await wizard.getByRole('button', { name: 'Criar e gerar 5 cards', exact: true }).click();
  await expect(wizard).toHaveCount(0, { timeout: 25_000 });
  const writes = () => page.evaluate(() => window.__vcLibraryWrites.slice());
  await expect.poll(async () => (await writes()).includes(5)).toBe(true);
  // Cobre o autosave (400 ms) e a gravação da biblioteca (100 ms) que vêm depois.
  await page.waitForTimeout(1500);
  const all = await writes();
  const afterGeneration = all.slice(all.indexOf(5));
  expect(afterGeneration, `sequência completa de gravações: ${all.join(', ')}`).toEqual(afterGeneration.map(() => 5));
});

// Rodada R2 (15–16/11/2026): os nove carrosséis gerados saíram com título,
// subtítulo e apoio em 100/100/100, e não nos tamanhos da composição. A marca
// do projeto nasce com os três tamanhos em 100 (DEFAULT_BRAND); a geração
// reaplica o preset, que apaga esses campos; a mudança 100 → undefined
// disparava a sincronização "marca → todos os slides" e achatava a hierarquia.
test('geração social conserva a tipografia que a composição definiu', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await setup(page, { withProject: false, ai: route => {
    const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
    return route.fulfill({ json: completion(prompt.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : generated(5, 'Hierarquia preservada')) });
  } });
  const wizard = await configure(page, { name: 'Hierarquia do estilo', defaultIdentity: true });
  await wizard.getByRole('button', { name: 'Criar e gerar 5 cards', exact: true }).click();
  await expect(wizard).toHaveCount(0, { timeout: 25_000 });
  await expect.poll(async () => (await library(page)).find(p => p.name === 'Hierarquia do estilo')?.doc?.slides?.length).toBe(5);
  // A sincronização indevida rodava num efeito depois da gravação: espera o
  // estado assentar antes de ler.
  await page.waitForTimeout(1500);
  const created = (await library(page)).find(p => p.name === 'Hierarquia do estilo');
  await testInfo.attach('tipografia.json', { body: JSON.stringify(created.doc.slides.map(s => ({
    comp: s.socialComposition, titleSize: s.titleSize, subSize: s.subSize, bodyAfterSize: s.bodyAfterSize, titleLeading: s.titleLeading, subLeading: s.subLeading,
  })), null, 2), contentType: 'application/json' });
  for (const slide of created.doc.slides) {
    expect(slide.canvas.source).toBe('social-preset');
    // Biblioteca v4: tamanhos por função do card (não um trio fixo). O que este
    // teste protege é a hierarquia: nada volta a 100/100/100 e o corpo fica no
    // piso de leitura (≥ 30 px em 1080), com o título bem acima dele.
    expect(slide.socialCompositionVersion).toBe(4);
    expect([slide.titleSize, slide.subSize, slide.bodyAfterSize]).not.toEqual([100, 100, 100]);
    const tituloPx = 1080 * 0.084 * slide.titleSize / 100;
    const apoioPx = 1080 * 0.028 * slide.subSize / 100;
    expect(apoioPx).toBeGreaterThanOrEqual(29.9);
    expect(tituloPx / apoioPx).toBeGreaterThanOrEqual(1.6);
    expect(slide.titleLeading).toBeGreaterThanOrEqual(104);
    expect(slide.subLeading).toBeGreaterThanOrEqual(136);
  }
});

test('entrada tem duas escolhas, abrir preserva o editor e cancelar não cria projetos', async ({ page }) => {
  await setup(page);
  const before = await library(page);
  await page.getByRole('button', { name: 'Abrir um projeto', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir Campanha preservada', exact: true }).click();
  for (const tab of ['Marca', 'Narrativa', 'Visual', 'Imagem', 'Texto', 'Layout']) {
    await expect(page.getByRole('tab', { name: tab, exact: true }).first()).toBeVisible();
  }
  await page.reload();
  await page.getByRole('button', { name: 'Criar um projeto', exact: true }).click();
  await flow(page).getByLabel(/^Nome do projeto/).fill('Rascunho que não foi gerado');
  await next(page);
  await flow(page).getByRole('radio', { name: /^Usar um preset salvo/ }).click();
  await flow(page).getByRole('combobox', { name: /^Marca deste projeto/ }).selectOption(newBrand.id);
  await flow(page).getByText('Ajustar para este projeto', { exact: true }).click();
  await flow(page).getByLabel(/^Nome da marca no projeto/).fill('Alteração somente local');
  await flow(page).getByRole('button', { name: 'Sair da criação', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Criar um projeto', exact: true })).toBeVisible();
  const after = await library(page);
  expect(after.map(p => p.id)).toEqual(before.map(p => p.id));
  expect(after[0].doc.slides).toMatchObject(before[0].doc.slides);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vc_brands')).find(b => b.id === 'creation-new-brand').name)).toBe(newBrand.name);
});

test('ir para o editor cria um único card vazio sem chamar a IA', async ({ page }) => {
  let aiCalls = 0;
  await page.setViewportSize({ width:1280, height:713 });
  await setup(page, { withProject:false, ai: route => {
    aiCalls += 1;
    return route.fulfill({ json:completion(generated(5)) });
  } });
  await page.getByRole('button', { name:'Criar um projeto', exact:true }).click();
  const wizard = flow(page);
  await wizard.getByLabel(/^Nome do projeto/).fill('Rascunho manual');
  const blankEditor = wizard.getByRole('button', { name:/^Ir para o editor/ });
  const blankBox = await blankEditor.boundingBox();
  const footerBox = await wizard.locator('footer').boundingBox();
  expect(blankBox.y + blankBox.height).toBeLessThanOrEqual(footerBox.y);
  await blankEditor.click();
  await expect(wizard).toHaveCount(0);
  await expect(page.getByRole('tab', { name:'Texto', exact:true }).first()).toBeVisible();
  await expect.poll(async () => (await library(page)).find(project => project.name === 'Rascunho manual')?.doc?.slides?.length).toBe(1);
  const [created] = await library(page);
  expect(created.name).toBe('Rascunho manual');
  expect(created.doc).toMatchObject({ productKind:'carrossel', quickCardCount:1, caption:'', slides:[{
    title:'', subtitle:'', bodyAfterImage:'', imageQuery:'', imgExtraPrompt:'',
    bgImage:null, bgImageId:null, imageReferences:[],
  }] });
  expect(aiCalls).toBe(0);
});

test('primeira edição substitui o título inicial do card novo', async ({ page }) => {
  await setup(page, { withProject:false });
  await page.getByRole('button', { name:'Criar um projeto', exact:true }).click();
  await flow(page).getByRole('button', { name:/^Ir para o editor/ }).click();
  await page.getByRole('button', { name:'Adicionar card ao carrossel', exact:true }).click();
  await page.getByRole('tab', { name:'Texto', exact:true }).first().click();
  const title = page.getByRole('textbox', { name:'Caixa de texto', exact:true });
  await expect(title).toHaveValue('Seu título aqui');
  await title.click();
  await page.keyboard.type('Título de teste');
  await expect(title).toHaveValue('Título de teste');
  await expect(title).not.toHaveValue(/Seu título aqui/);
});

test('ir para o editor respeita apresentação e cria um slide vazio', async ({ page }) => {
  await setup(page, { withProject:false });
  await page.getByRole('button', { name:'Criar um projeto', exact:true }).click();
  const wizard = flow(page);
  await wizard.getByRole('radio', { name:/^Apresentação/ }).click();
  await wizard.getByRole('button', { name:/^Ir para o editor/ }).click();
  await expect(wizard).toHaveCount(0);
  const [created] = await library(page);
  expect(created.name).toBe('Nova apresentação');
  expect(created.doc).toMatchObject({ productKind:'apresentacao', fmt:'apresentacao', quickCardCount:1, slides:[{
    title:'', subtitle:'', photoRegion:'full', showSwipeCue:false,
  }] });
  // Cross both persistence debounces: a transition from the carousel editor
  // must not rename the presentation using the previous document's format.
  await page.waitForTimeout(650);
  const settled = (await library(page)).find(project => project.id === created.id);
  expect(settled.name).toBe('Nova apresentação');
  expect(settled.doc).toMatchObject({ productKind:'apresentacao', fmt:'apresentacao' });
});

test('roteiro explícito sincroniza e bloqueia a quantidade até a revisão', async ({ page }) => {
  await setup(page, { withProject:false });
  await page.getByRole('button', { name:'Criar um projeto', exact:true }).click();
  const wizard = flow(page);
  await wizard.getByLabel(/^Nome do projeto/).fill('Roteiro pronto');
  await next(page);
  await next(page);

  await wizard.getByLabel(/^Sobre o que vamos criar/).fill('Campanha de lançamento do serviço.');
  await wizard.getByLabel(/^Texto de apoio/).fill(
    'Card 01; O problema que o cliente reconhece. Card 02; A solução em linguagem simples. Card 03; Convite para conhecer a oferta.',
  );
  await expect(wizard.getByText('Roteiro reconhecido: 3 cards.', { exact:true })).toBeVisible();

  await next(page);
  await next(page);
  const count = wizard.getByRole('spinbutton', { name:'Quantidade de cards', exact:true });
  await expect(count).toHaveValue('3');
  await expect(count).toBeDisabled();
  await expect(wizard.getByRole('button', { name:'Diminuir quantidade de cards', exact:true })).toBeDisabled();
  await expect(wizard.getByRole('button', { name:'Aumentar quantidade de cards', exact:true })).toBeDisabled();
  await expect(wizard.locator('.vc-create-shortcuts').getByRole('button', { name:'5', exact:true })).toBeDisabled();
  await expect(wizard.getByText('Roteiro reconhecido: 3 cards.', { exact:true })).toBeVisible();

  await next(page);
  await next(page);
  await expect(wizard.getByText('Roteiro reconhecido: 3 cards.', { exact:true })).toBeVisible();
  await expect(wizard.getByRole('button', { name:'Criar e gerar 3 cards', exact:true })).toBeVisible();
});

test('novo carrossel usa quantidade, narrativa, marca, material e estilo sem sobrescrever o anterior', async ({ page }) => {
  test.setTimeout(60_000);
  const prompts = [];
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const cloud = await setup(page, { ai: async route => {
    const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
    prompts.push(prompt);
    if (!prompt.startsWith('REVISÃO EDITORIAL')) await waiting;
    return route.fulfill({ json: completion(prompt.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : generated(5)) });
  } });
  const before = (await library(page)).find(p => p.id === originalProject.id);
  const wizard = await configure(page, { detailed: true });
  await wizard.getByRole('button', { name: 'Criar e gerar 5 cards', exact: true }).click();
  await expect.poll(() => prompts.length).toBe(1);
  await expect(wizard).toBeVisible();
  await expect(page.getByRole('tab', { name: /^(Marca|Narrativa|Visual|Texto|Layout)$/ })).toHaveCount(0);
  release();
  await expect(wizard).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole('tab', { name: 'Texto', exact: true }).first()).toBeVisible();
  await expect.poll(async () => (await library(page)).find(p => p.name === 'Novo trabalho guiado')?.doc?.slides?.length).toBe(5);
  const after = await library(page);
  expect(after).toHaveLength(before ? 2 : 1);
  expect(after.find(p => p.id === originalProject.id).doc.slides).toMatchObject(before.doc.slides);
  const created = after.find(p => p.name === 'Novo trabalho guiado');
  expect(created.id).not.toBe(originalProject.id);
  expect(created.doc).toMatchObject({ fmt: 'stories', quickCardCount: 5, mode: 'how_to', brand: { id: newBrand.id } });
  expect(created.doc.material.content).toContain('primeira conversa');
  expect(created.doc.styleKit.stylePrompt).toBe('Fundo claro, fotografia editorial e títulos em azul.');
  expect(prompts).toHaveLength(2);
  expect(prompts[0]).toMatch(/exatamente 5 itens em slides/);
  expect(prompts[0]).toContain('MÉTODO PASSO-A-PASSO');
  expect(prompts[0]).toContain('Brief deste lançamento');
  expect(prompts[0]).toContain('diagnóstico inicial e revisão mensal');
  expect(prompts[0]).toContain('Não invente preços nem promessas');
  expect(prompts[0]).not.toContain('Material exclusivo anterior');
  if (projectsV2) {
    await page.getByRole('button', { name: 'Salvar projeto agora', exact: true }).click();
    await expect.poll(() => cloud.rows.get(created.id)?.entry.doc.slides.length).toBe(5);
    expect(cloud.puts.some(put => put.id === created.id)).toBe(true);
    expect(cloud.rows.size).toBe(2);
    expect(cloud.rows.get(originalProject.id).entry.doc.slides[0].title).toBe(originalProject.doc.slides[0].title);
  }
  await page.reload();
  await page.getByRole('button', { name: 'Abrir um projeto', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir Novo trabalho guiado', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Texto', exact: true }).first()).toBeVisible();
});

test('falha mantém escolhas e repetir usa o mesmo destino sem duplicação', async ({ page }) => {
  test.setTimeout(60_000);
  let fail = true;
  const cloud = await setup(page, { ai: route => {
    if (fail) return route.fulfill({ status: 400, json: { error: 'Falha simulada: tente novamente.' } });
    const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
    return route.fulfill({ json: completion(prompt.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : generated(5, 'Retomado')) });
  } });
  const wizard = await configure(page, { name: 'Projeto para retomar' });
  await wizard.getByRole('button', { name: 'Criar e gerar 5 cards', exact: true }).click();
  await expect(wizard.getByRole('alert')).toBeVisible();
  await expect(wizard).toContainText('Projeto para retomar');
  await expect.poll(async () => (await library(page)).some(p => p.name === 'Projeto para retomar')).toBe(true);
  const drafts = await library(page);
  const destination = drafts.find(p => p.name === 'Projeto para retomar');
  expect(destination).toBeTruthy();
  await wizard.getByRole('button', { name: 'Alterar identidade', exact: true }).click();
  await wizard.getByRole('radio', { name: /^Personalizar agora/ }).click();
  await wizard.getByRole('combobox', { name: /^Marca deste projeto/ }).selectOption('__new__');
  await wizard.getByLabel(/^Nome da nova marca/).fill('Marca da segunda tentativa');
  await wizard.getByRole('navigation', { name: 'Etapas da criação' }).getByRole('button', { name: '7. Revisão', exact: true }).click();
  fail = false;
  await wizard.getByRole('button', { name: 'Criar e gerar 5 cards', exact: true }).click();
  await expect(wizard).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(async () => (await library(page)).find(p => p.id === destination.id)?.doc?.slides?.[0]?.title).toBe('Retomado 1');
  expect((await library(page)).map(p => p.id).sort()).toEqual(drafts.map(p => p.id).sort());
  const restored = (await library(page)).find(p => p.id === destination.id);
  expect(restored.doc.brand.id).not.toBe(newBrand.id);
  expect(restored.doc.brand.name).toBe('Marca da segunda tentativa');
  const brands = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_brands') || '[]'));
  expect(brands.find(b => b.id === newBrand.id).name).toBe(newBrand.name);
  expect(brands.find(b => b.id === restored.doc.brand.id).name).toBe('Marca da segunda tentativa');
  expect(brands).toHaveLength(3);
  if (projectsV2) {
    await page.getByRole('button', { name: 'Salvar projeto agora', exact: true }).click();
    await expect.poll(() => cloud.rows.get(destination.id)?.entry.doc.brand.id).toBe(restored.doc.brand.id);
    expect(cloud.rows.get(destination.id).entry.doc.slides[0].title).toBe('Retomado 1');
    expect(cloud.rows.size).toBe(2);
    expect(cloud.rows.get(originalProject.id).entry.doc.brand.id).toBe(oldBrand.id);
  }
});

test('prévia mostra todos os textos durante a revisão sem salvar o rascunho incompleto', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  let releaseReview;
  const reviewing = new Promise(resolve => { releaseReview = resolve; });
  let reviewRequested = false;
  const draft = generated(5, 'Prepare o site');
  await setup(page, { ai: async route => {
    const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
    if (prompt.startsWith('REVISÃO EDITORIAL')) {
      reviewRequested = true;
      await reviewing;
      return route.fulfill({ json: completion({ edits: [{ slideIndex: 0, reason: 'Título mais claro', title: 'Organize o conteúdo do site' }] }) });
    }
    return route.fulfill({ json: completion(draft) });
  } });
  const wizard = await configure(page, { name: 'Prévia antes da revisão' });
  await wizard.getByRole('button', { name: 'Criar e gerar 5 cards', exact: true }).click();
  await expect.poll(() => reviewRequested).toBe(true);
  await expect(wizard.getByRole('heading', { name: 'Rascunho — em revisão', exact: true })).toBeInViewport();
  const preview = wizard.getByLabel('Prévia dos cards', { exact: true });
  await expect(preview.getByRole('article')).toHaveCount(5);
  await expect(preview.getByRole('article', { name: 'Card 1', exact: true })).toContainText(draft.slides[0].title);
  await expect(preview.getByRole('article', { name: 'Card 3', exact: true })).toContainText(draft.slides[2].bodyAfterImage);
  await expect(wizard.getByText(/Tempo decorrido: 0:0[1-9]/)).toBeVisible();
  // Long input/review tables must not push live content off-screen on mobile.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const beforeReview = await library(page);
  const destination = beforeReview.find(project => project.name === 'Prévia antes da revisão');
  expect(destination.doc.slides).toHaveLength(1);
  expect(destination.doc.slides.some(slide => slide.title === draft.slides[0].title)).toBe(false);
  expect(beforeReview.find(project => project.id === originalProject.id).doc.slides[0].title).toBe(originalProject.doc.slides[0].title);
  await page.screenshot({ path:testInfo.outputPath('generation-preview-mobile.png') });

  releaseReview();
  await expect(wizard).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(async () => (await library(page)).find(project => project.id === destination.id)?.doc?.slides?.[0]?.title).toBe('Organize o conteúdo do site');
  const saved = (await library(page)).find(project => project.id === destination.id);
  expect(saved.doc.slides).toHaveLength(5);
  // A stale 100ms library write must not undo the synchronous final save.
  // Cross the 400ms document debounce and the following 100ms library debounce.
  await page.waitForTimeout(650);
  const settled = (await library(page)).find(project => project.id === destination.id);
  expect(settled.doc.slides).toHaveLength(5);
  expect(settled.doc.slides[0].title).toBe('Organize o conteúdo do site');
});

test('cancelar a revisão mantém a prévia identificada e ignora a resposta tardia', async ({ page }) => {
  test.setTimeout(60_000);
  let releaseReview;
  const reviewing = new Promise(resolve => { releaseReview = resolve; });
  const draft = generated(5, 'Rascunho temporário');
  let reviewRequested = false;
  await setup(page, { ai: async route => {
    const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
    if (prompt.startsWith('REVISÃO EDITORIAL')) {
      reviewRequested = true;
      await reviewing;
      return route.fulfill({ json: completion({ edits: [] }) }).catch(() => {});
    }
    return route.fulfill({ json: completion(draft) });
  } });
  const wizard = await configure(page, { name: 'Prévia cancelada' });
  await wizard.getByRole('button', { name: 'Criar e gerar 5 cards', exact: true }).click();
  await expect.poll(() => reviewRequested).toBe(true);
  await expect(wizard.getByLabel('Prévia dos cards', { exact: true }).getByRole('article')).toHaveCount(5);
  await wizard.getByRole('button', { name: 'Cancelar geração', exact: true }).click();
  await expect(wizard.getByRole('heading', { name: 'Rascunho — revisão interrompida', exact: true })).toBeVisible();
  await expect(wizard.getByText('Esta prévia não foi aplicada ao projeto. Retome a geração para concluir a revisão.', { exact: true })).toBeVisible();
  releaseReview();
  await wizard.getByRole('button', { name: 'Sair da criação', exact: true }).click();
  await page.getByRole('button', { name: 'Criar um projeto', exact: true }).click();
  await expect(flow(page).getByLabel('Prévia dos cards', { exact: true })).toHaveCount(0);
  const after = await library(page);
  expect(after.find(project => project.name === 'Prévia cancelada').doc.slides).toHaveLength(1);
  expect(after.flatMap(project => project.doc.slides).some(slide => String(slide.title).startsWith('Rascunho temporário'))).toBe(false);
});

test('cancelar após um lote abre os slides concluídos e preserva conteúdo completo ao recarregar', async ({ page }) => {
  test.setTimeout(60_000);
  const name = 'Apresentação interrompida com conteúdo';
  let releaseSecondBatch;
  const secondBatchGate = new Promise(resolve => { releaseSecondBatch = resolve; });
  let secondBatchRequested = false;
  const draft = generated(6, 'Decisão registrada');
  draft.slides[0].imageQuery = 'editorial meeting notes';
  draft.slides[0].speakerNotes = 'Notas de apoio completas, sem repetir apenas o título.';
  draft.slides[1].speakerNotes = 'Detalhes complementares da sequência.';
  draft.slides[1].presentationBlocks = [{ type:'steps', items:[
    { title:'Registre a decisão', body:'Inclua quem ficou responsável.' },
    { title:'Combine o próximo passo', body:'Confirme o acompanhamento com a equipe.' },
  ] }];
  await setup(page, { ai: async route => {
    const prompt = route.request().postDataJSON().payload.messages.find(message => message.role === 'user').content;
    if (prompt.startsWith('PLANEJAMENTO ESTRUTURADO')) return route.fulfill({ json:completion({
      schemaVersion:1, promptVersion:PRESENTATION_PLAN_PROMPT_VERSION,
      objective:'Registrar decisões e próximos passos.', audience:'Equipe que participa das reuniões.', thesis:'Registrar antes de agir.', evidence:[], gaps:[],
      slides:draft.slides.map((slide, index) => ({ index:index + 1, visualRole:index === 0 ? 'cover' : index === 5 ? 'closing' : 'content',
        purpose:index === 0 ? 'introduction' : index === 5 ? 'decision' : 'learning', question:`O que registrar na etapa ${index + 1}?`,
        keyMessage:slide.title, evidenceIds:[], imageBrief:slide.imageQuery || '' })),
    }) });
    const batch = presentationBatch(prompt, draft.slides);
    if (batch[0].title === draft.slides[3].title) {
      secondBatchRequested = true;
      await secondBatchGate;
    }
    return route.fulfill({ json:completion({ slides:batch, caption:draft.caption }) }).catch(() => {});
  } });
  const wizard = await configure(page, { name, presentation:true, count:6 });
  await wizard.getByRole('button', { name:'Criar e gerar 6 slides', exact:true }).click();
  try {
    await expect.poll(() => secondBatchRequested).toBe(true);
    await expect(wizard.getByLabel('Prévia dos slides', { exact:true }).getByRole('article')).toHaveCount(3);
    await wizard.getByRole('button', { name:'Cancelar geração', exact:true }).click();
    await wizard.getByRole('button', { name:'Abrir rascunho no editor', exact:true }).click();
    await expect(wizard).toHaveCount(0);
    const warning = page.getByRole('region', { name:'Revisão pendente do conteúdo' });
    await expect(warning).toContainText('3 de 6 slides preservados');
    await expect(page.getByRole('button', { name:'Desfazer', exact:true }).first()).toBeEnabled();
    const saved = (await library(page)).find(project => project.name === name);
    expect(saved.doc.slides.map(slide => slide.title)).toEqual(draft.slides.slice(0, 3).map(slide => slide.title));
    expect(saved.doc.slides[0]).toMatchObject({ imageQuery:draft.slides[0].imageQuery, caption:draft.slides[0].speakerNotes });
    expect(saved.doc.slides[1]).toMatchObject({ caption:draft.slides[1].speakerNotes, presentationBlocks:draft.slides[1].presentationBlocks });
    expect(saved.doc.slides[2].bodyAfterImage).toBe(draft.slides[2].bodyAfterImage);
    expect(saved.doc.caption).toBe(draft.caption);
    expect(saved.doc.presentationPlan.slides).toHaveLength(6);
    expect(saved.doc).toMatchObject({ quickCardCount:6, editorialReviewStatus:'needs_attention',
      presentationQuality:{ incomplete:true, completedCount:3, totalCount:6 } });
    releaseSecondBatch();
    // Reload immediately: neither a late batch nor the old seed debounce may
    // overwrite the explicit decision to open the available three slides.
    await page.reload();
    await enterEditorFromHome(page, name);
    await expect(page.getByRole('region', { name:'Revisão pendente do conteúdo' })).toContainText('3 de 6 slides preservados');
    const reloaded = (await library(page)).find(project => project.name === name);
    expect(reloaded.doc.slides).toEqual(saved.doc.slides);
    expect(reloaded.doc.presentationPlan.slides).toHaveLength(6);
    expect((await library(page)).find(project => project.id === originalProject.id).doc.slides[0].title).toBe(originalProject.doc.slides[0].title);
  } finally { releaseSecondBatch(); }
});

test('mobile deixa quantidade visível, valida limites e preserva escolha ao voltar à narrativa', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { withProject: false, onboarding: true });
  const wizard = await configure(page, { count: 8, defaultIdentity: true });
  await wizard.getByRole('button', { name: 'Alterar quantidade', exact: true }).click();
  const count = wizard.getByRole('spinbutton', { name: 'Quantidade de cards', exact: true });
  await expect(count).toHaveValue('8');
  await count.fill('0');
  await expect(wizard.getByRole('button', { name: 'Continuar', exact: true })).toBeDisabled();
  await count.fill('25');
  await expect(wizard.getByRole('button', { name: 'Continuar', exact: true })).toBeDisabled();
  await count.fill('7');
  await wizard.getByRole('button', { name: 'Voltar', exact: true }).click();
  await wizard.getByRole('radio', { name: /^Prender atenção/ }).click();
  await next(page);
  await expect(count).toHaveValue('7');
  await expect(page.getByRole('dialog', { name: 'Bem-vindo à Moont' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const box = await wizard.getByRole('button', { name: 'Continuar', exact: true }).boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await wizard.getByRole('button', { name: 'Sair da criação', exact: true }).click();
  expect(await library(page)).toHaveLength(0);
});

test('mobile mantém o fluxo dentro da tela e exibe o texto digitado nos campos longos', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { withProject: false });
  await page.getByRole('button', { name: 'Criar um projeto', exact: true }).click();
  const wizard = flow(page);
  await wizard.getByLabel(/^Nome do projeto/).fill('Projeto mobile');
  await next(page);
  await next(page);

  const topic = wizard.getByLabel(/^Sobre o que vamos criar/);
  const support = wizard.getByLabel(/^Texto de apoio/);
  await topic.fill('Campanha criada no celular');
  await support.fill('Este texto precisa continuar legível enquanto a pessoa escreve.');

  await expect(topic).toHaveValue('Campanha criada no celular');
  await expect(support).toHaveValue('Este texto precisa continuar legível enquanto a pessoa escreve.');
  const layout = await page.evaluate(() => {
    const supportField = document.querySelector('textarea[rows="7"]');
    const footer = document.querySelector('.vc-create-footer');
    const nextButton = [...footer.querySelectorAll('button')].find(button => button.textContent.includes('Continuar'));
    const rect = node => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width, height: box.height };
    };
    const style = getComputedStyle(supportField);
    return {
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      field: rect(supportField),
      footer: rect(footer),
      nextButton: rect(nextButton),
      color: style.color,
      textFill: style.webkitTextFillColor,
      opacity: style.opacity,
    };
  });
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewport + 1);
  for (const box of [layout.field, layout.footer, layout.nextButton]) {
    expect(box.left).toBeGreaterThanOrEqual(-1);
    expect(box.right).toBeLessThanOrEqual(layout.viewport + 1);
  }
  expect(layout.field.height).toBeGreaterThanOrEqual(200);
  expect(layout.nextButton.height).toBeGreaterThanOrEqual(44);
  expect(layout.opacity).toBe('1');
  expect(layout.color).not.toBe('rgba(0, 0, 0, 0)');
  expect(layout.textFill).not.toBe('rgba(0, 0, 0, 0)');
});

test('apresentação passa pelo planejamento e só abre edição após conferir a composição', async ({ page }) => {
  test.setTimeout(60_000);
  const prompts = [];
  await setup(page, { ai: route => {
    const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
    prompts.push(prompt);
    const value = prompt.startsWith('PLANEJAMENTO ESTRUTURADO') ? {
      schemaVersion: 1, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
      objective: 'Explicar o próximo passo.', audience: 'Donos de pequenos negócios.', thesis: 'Organizar antes de agir.', evidence: [], gaps: [],
      slides: Array.from({ length: 5 }, (_, index) => ({
        index: index + 1, visualRole: index === 0 ? 'cover' : index === 4 ? 'closing' : 'content',
        purpose: index === 0 ? 'introduction' : index === 4 ? 'decision' : 'learning',
        question: `Qual o próximo passo ${index + 1}?`, keyMessage: `Organizar o passo ${index + 1}.`, evidenceIds: [], imageBrief: '',
      })),
    } : prompt.startsWith('REVISÃO DE APRESENTAÇÃO') ? { edits: [] } : { ...generated(5, 'Apresentação nova'), slides: presentationBatch(prompt, generated(5, 'Apresentação nova').slides) };
    return route.fulfill({ json: completion(value) });
  } });
  const wizard = await configure(page, { name: 'Apresentação guiada', presentation: true });
  await wizard.getByRole('button', { name: 'Criar e gerar 5 slides', exact: true }).click();
  await expect(wizard).toHaveCount(0, { timeout: 35_000 });
  await expect.poll(async () => (await library(page)).find(p => p.name === 'Apresentação guiada')?.doc?.presentationQuality?.renderCheckStatus).toBe('passed');
  const deck = (await library(page)).find(p => p.name === 'Apresentação guiada');
  expect(deck.doc.slides).toHaveLength(5);
  expect(deck.doc).toMatchObject({ fmt: 'apresentacao', productKind: 'apresentacao', quickCardCount: 5 });
  expect(prompts).toHaveLength(4);
  expect(prompts[0]).toContain('PLANEJAMENTO ESTRUTURADO');
  expect(prompts[1]).toContain('PLANO EDITORIAL VALIDADO');
});

// Relato de 18/11/2026 (iPhone): na etapa Visual, "Ajustar logo e referências"
// leva à etapa Marca. Depois de anexar, "Continuar" seguia para a etapa 3 e a
// pessoa tinha de refazer o caminho até a 6: "volta para páginas anteriores".
test('atalho de logo e referências devolve à etapa de onde a pessoa saiu', async ({ page }) => {
  test.setTimeout(60_000);
  await setup(page);
  const wizard = await configure(page, { name: 'Atalho de referências' });
  const passo = wizard.locator('.vc-create-kicker');
  await wizard.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(passo).toContainText('Passo 6 de 7');
  await wizard.getByRole('button', { name: 'Ajustar logo e referências', exact: true }).click();
  await expect(passo).toContainText('Passo 2 de 7');
  await wizard.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(passo).toContainText('Passo 6 de 7');
  // Fora do atalho, Continuar volta a andar uma etapa por vez.
  await wizard.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(passo).toContainText('Passo 5 de 7');
  await wizard.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(passo).toContainText('Passo 6 de 7');
  // Quem chega à etapa 2 pelo caminho normal segue para a 3.
  for (let i = 0; i < 4; i++) await wizard.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(passo).toContainText('Passo 2 de 7');
  await wizard.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(passo).toContainText('Passo 3 de 7');
});

test('estrutura pronta mantém a paleta da marca quando a pessoa escolhe sua identidade', async ({ page }) => {
  await setup(page, { ai: route => {
    const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
    return route.fulfill({ json: completion(prompt.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : generated(5, 'Erro comum')) });
  } });
  const wizard = await configure(page, { name: 'Estrutura com nossa marca', special: true });
  await wizard.getByRole('button', { name: 'Criar e gerar 5 cards', exact: true }).click();
  await expect(wizard).toHaveCount(0, { timeout: 20_000 });
  await expect.poll(async () => (await library(page)).find(p => p.name === 'Estrutura com nossa marca')?.doc?.slides?.length).toBe(5);
  const created = (await library(page)).find(p => p.name === 'Estrutura com nossa marca');
  expect(created.doc.creativePreset).toBe('quick_erro_comum');
  expect(created.doc.brand).toMatchObject({
    bg: newBrand.bg, titleColor: newBrand.titleColor, subtitleColor: newBrand.subtitleColor,
    textColor: newBrand.textColor, accent: newBrand.accent,
  });
});

test('voltar ao padrão Moont limpa o contexto escolhido sem criar uma marca obrigatória', async ({ page }) => {
  const prompts = [];
  const cloud = await setup(page, { ai: route => {
    const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
    prompts.push(prompt);
    return route.fulfill({ json: completion(prompt.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : generated(5, 'Neutro')) });
  } });
  const wizard = await configure(page, { name: 'Projeto com padrão Moont' });
  await wizard.getByRole('button', { name: 'Alterar identidade', exact: true }).click();
  await wizard.getByRole('radio', { name: /^Seguir com o padrão do Moont/ }).click();
  await expect(wizard.getByRole('combobox', { name: /^Marca deste projeto/ })).toHaveCount(0);
  await wizard.getByRole('navigation', { name: 'Etapas da criação' }).getByRole('button', { name: '7. Revisão', exact: true }).click();
  await wizard.getByRole('button', { name: 'Criar e gerar 5 cards', exact: true }).click();
  await expect(wizard).toHaveCount(0, { timeout: 20_000 });
  await expect.poll(async () => (await library(page)).find(p => p.name === 'Projeto com padrão Moont')?.doc?.slides?.length).toBe(5);
  const created = (await library(page)).find(p => p.name === 'Projeto com padrão Moont');
  expect(created.doc.styleKit).toMatchObject({ contextMd: '', stylePrompt: '', refImages: [] });
  expect(created.doc.styleKit.logo).toBeUndefined();
  expect(created.doc.brand).toMatchObject({ bio: '', defaultAudience: '', defaultTone: '' });
  expect(created.doc.brand.logoImageId).toBeFalsy();
  expect(created.doc.brand.logoAssetId).toBeFalsy();
  expect(prompts[0]).not.toContain('A marca trabalha com sites para pequenos negócios.');
  expect(prompts[0]).not.toContain('Contexto exclusivo do projeto anterior');
  const brands = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_brands') || '[]'));
  expect(brands.map(b => b.id).sort()).toEqual([oldBrand.id, newBrand.id].sort());
  if (projectsV2) {
    await page.getByRole('button', { name: 'Salvar projeto agora', exact: true }).click();
    await expect.poll(() => cloud.rows.get(created.id)?.entry.doc.slides.length).toBe(5);
    expect(cloud.rows.get(created.id).entry.doc.styleKit.contextMd).toBe('');
    await page.reload();
    await page.getByRole('button', { name: 'Abrir um projeto', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Projeto com padrão Moont', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Texto', exact: true }).first()).toBeVisible();
    const reopened = (await library(page)).find(p => p.id === created.id);
    expect(reopened.doc.slides).toHaveLength(5);
    expect(reopened.doc.styleKit).toMatchObject({ contextMd: '', stylePrompt: '', refImages: [] });
    expect(reopened.doc.brand.bio).toBe('');
  }
});

test('preset visual salvo é reaproveitado na criação e continua disponível sem alterações', async ({ page }) => {
  await setup(page, { ai: route => {
    const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
    return route.fulfill({ json: completion(prompt.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : generated(5, 'Preset salvo')) });
  } });
  const wizard = await configure(page, { name: 'Projeto com preset salvo', customPreset: true });
  await wizard.getByRole('button', { name: 'Criar e gerar 5 cards', exact: true }).click();
  await expect(wizard).toHaveCount(0, { timeout: 20_000 });
  await expect.poll(async () => (await library(page)).find(p => p.name === 'Projeto com preset salvo')?.doc?.slides?.length).toBe(5);
  const created = (await library(page)).find(p => p.name === 'Projeto com preset salvo');
  expect(created.doc.visualPreset).toBe(savedPreset.id);
  expect(created.doc.brand).toMatchObject(savedPreset.brand);
  const presets = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_custom_visual_presets_v1') || '[]'));
  expect(presets.find(p => p.id === savedPreset.id)).toMatchObject(savedPreset);
});

test('remover o preset visual restaura a identidade da marca sem descartar seu contexto', async ({ page }) => {
  const prompts = [];
  await setup(page, { ai: route => {
    const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
    prompts.push(prompt);
    return route.fulfill({ json: completion(prompt.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : generated(5, 'Identidade restaurada')) });
  } });
  const wizard = await configure(page, { name: 'Projeto sem o preset', customPreset: true });
  await wizard.getByRole('button', { name: 'Alterar identidade', exact: true }).click();
  await wizard.getByRole('combobox', { name: /^Padrão visual salvo/ }).selectOption('');
  await wizard.getByRole('navigation', { name: 'Etapas da criação' }).getByRole('button', { name: '7. Revisão', exact: true }).click();
  await wizard.getByRole('button', { name: 'Criar e gerar 5 cards', exact: true }).click();
  await expect(wizard).toHaveCount(0, { timeout: 20_000 });
  await expect.poll(async () => (await library(page)).find(p => p.name === 'Projeto sem o preset')?.doc?.slides?.length).toBe(5);
  const created = (await library(page)).find(p => p.name === 'Projeto sem o preset');
  // The text-only account may choose a composition fallback, but it must not
  // keep the removed custom preset or override the selected brand's palette.
  expect(created.doc.visualPreset).not.toBe(savedPreset.id);
  expect(created.doc.brand).toMatchObject({
    id: newBrand.id, bg: newBrand.bg, titleColor: newBrand.titleColor,
    subtitleColor: newBrand.subtitleColor, textColor: newBrand.textColor, accent: newBrand.accent,
    bio: newBrand.bio, defaultAudience: newBrand.defaultAudience, defaultTone: newBrand.defaultTone,
  });
  expect(prompts[0]).toContain(newBrand.styleKit.contextMd);
  const presets = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_custom_visual_presets_v1') || '[]'));
  expect(presets.find(p => p.id === savedPreset.id)).toMatchObject(savedPreset);
});

test('repetir com a mesma marca nova atualiza perfil e pedido sem duplicar o destino', async ({ page }) => {
  test.setTimeout(60_000);
  let fail = true;
  const prompts = [];
  const firstTopic = 'Apresentar os serviços iniciais de uma loja local.';
  const revisedTopic = 'Explicar a revisão mensal e o atendimento depois do lançamento.';
  const cloud = await setup(page, { ai: route => {
    if (fail) return route.fulfill({ status: 400, json: { error: 'Falha simulada antes de criar os cards.' } });
    const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
    prompts.push(prompt);
    return route.fulfill({ json: completion(prompt.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : generated(5, 'Tema revisado')) });
  } });
  const wizard = await configure(page, { name: 'Projeto com marca revisada', defaultIdentity: true });
  const navigate = name => wizard.getByRole('navigation', { name: 'Etapas da criação' }).getByRole('button', { name, exact: true }).click();
  await wizard.getByRole('button', { name: 'Alterar identidade', exact: true }).click();
  await wizard.getByRole('radio', { name: /^Personalizar agora/ }).click();
  await wizard.getByRole('combobox', { name: /^Marca deste projeto/ }).selectOption('__new__');
  await wizard.getByLabel(/^Nome da nova marca/).fill('Marca inicial');
  await wizard.getByLabel(/^Como a marca deve falar/).fill('Formal');
  await wizard.getByLabel(/^O que o Moont precisa saber sobre a marca/).fill('Brief inicial para o primeiro lançamento.');
  const fixturePng = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 120;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#12bfcf'; ctx.fillRect(30, 30, 180, 60);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await wizard.getByLabel('Enviar logo da marca', { exact: true }).setInputFiles({
    name: 'logo-opcional.png', mimeType: 'image/png', buffer: Buffer.from(fixturePng, 'base64'),
  });
  await expect(wizard.getByText(/logo-opcional\.png/)).toBeVisible();
  await wizard.getByLabel('Adicionar referências visuais', { exact: true }).setInputFiles({
    name: 'referencia-opcional.png', mimeType: 'image/png', buffer: Buffer.from(fixturePng, 'base64'),
  });
  await expect(wizard.getByRole('button', { name: 'Remover referência referencia-opcional.png', exact: true })).toBeVisible();
  await navigate('3. Conteúdo');
  await wizard.getByLabel(/^Sobre o que vamos criar/).fill(firstTopic);
  await navigate('7. Revisão');
  const previousBrands = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_brands') || '[]'));
  await wizard.getByRole('button', { name: 'Criar e gerar 5 cards', exact: true }).click();
  await expect(wizard.getByRole('alert')).toBeVisible();
  await expect.poll(async () => (await library(page)).find(p => p.name === 'Projeto com marca revisada')?.doc?.brand?.name).toBe('Marca inicial');
  const destination = (await library(page)).find(p => p.name === 'Projeto com marca revisada');
  const reservedBrandId = destination.doc.brand.id;
  expect([oldBrand.id, newBrand.id]).not.toContain(reservedBrandId);
  expect(destination.doc.quickPromptDraft).toBe(firstTopic);
  const logoId = destination.doc.styleKit.logo.imageId;
  const referenceId = destination.doc.styleKit.refImages[0].imageId;
  expect(logoId).toMatch(/^img_/);
  expect(referenceId).toMatch(/^img_/);

  await wizard.getByRole('button', { name: 'Alterar identidade', exact: true }).click();
  await expect(wizard.getByRole('combobox', { name: /^Marca deste projeto/ })).toHaveValue('__new__');
  await wizard.getByLabel(/^Nome da nova marca/).fill('Marca revisada');
  await wizard.getByLabel(/^Como a marca deve falar/).fill('Próximo, claro e acolhedor');
  await wizard.getByLabel(/^O que o Moont precisa saber sobre a marca/).fill('Brief revisado: acompanhamento contínuo após o lançamento.');
  await wizard.getByRole('checkbox', { name: /Incluir a logo nos novos/ }).uncheck();
  await navigate('3. Conteúdo');
  await wizard.getByLabel(/^Sobre o que vamos criar/).fill(revisedTopic);
  await navigate('7. Revisão');
  fail = false;
  await wizard.getByRole('button', { name: 'Criar e gerar 5 cards', exact: true }).click();
  await expect(wizard).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(async () => (await library(page)).find(p => p.id === destination.id)?.doc?.slides?.[0]?.title).toBe('Tema revisado 1');
  const projects = await library(page);
  const revised = projects.find(p => p.id === destination.id);
  expect(projects).toHaveLength(2);
  expect(revised.doc).toMatchObject({
    quickPromptDraft: revisedTopic,
    brand: { id: reservedBrandId, name: 'Marca revisada', defaultTone: 'Próximo, claro e acolhedor' },
    styleKit: { contextMd: 'Brief revisado: acompanhamento contínuo após o lançamento.', logoOnGenerate: false,
      logo: { name: 'logo-opcional.png', imageId: logoId }, refImages: [{ name: 'referencia-opcional.png', imageId: referenceId }] },
  });
  const roster = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_brands') || '[]'));
  expect(roster).toHaveLength(3);
  expect(roster.filter(b => b.id !== reservedBrandId)).toEqual(previousBrands);
  expect(roster.find(b => b.id === reservedBrandId)).toMatchObject({
    name: 'Marca revisada', defaultTone: 'Próximo, claro e acolhedor',
    styleKit: { contextMd: 'Brief revisado: acompanhamento contínuo após o lançamento.', logoOnGenerate: false,
      logo: { imageId: logoId }, refImages: [{ imageId: referenceId }] },
  });
  expect(projects.find(p => p.id === originalProject.id).doc.slides).toMatchObject(originalProject.doc.slides);
  expect(prompts[0]).toContain(revisedTopic);
  expect(prompts[0]).not.toContain(firstTopic);
  await page.getByRole('tab', { name: 'Narrativa', exact: true }).click();
  const promptField = page.getByRole('textbox', { name: 'Prompt para gerar', exact: true });
  if (!await promptField.isVisible()) await page.getByRole('button', { name: /^Prompt para gerar/ }).click();
  await expect(promptField).toHaveValue(revisedTopic);
  if (projectsV2) {
    await page.getByRole('button', { name: 'Salvar projeto agora', exact: true }).click();
    await expect.poll(() => cloud.rows.get(destination.id)?.entry.doc.quickPromptDraft).toBe(revisedTopic);
    await expect.poll(() => cloud.metadata.brands.find(b => b.id === reservedBrandId)?.name).toBe('Marca revisada');
    expect(cloud.rows.get(destination.id).entry.doc.brand.id).toBe(reservedBrandId);
    expect(cloud.metadata.brands).toHaveLength(3);
  }
});
