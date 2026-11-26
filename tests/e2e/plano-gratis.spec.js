// Plano grátis (docs/product/plano-gratis.md): conta sem assinatura cria,
// edita e exporta à mão; IA e imagem gerada levam à página de assinatura e a
// pessoa volta ao mesmo projeto. O servidor é simulado: 402 em toda rota paga,
// e os testes conferem que o editor nem chega a chamá-las.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ANONIMA, SESSAO_ATIVA } from './helpers/api-mock.js';
import { selectEditorMode } from './helpers/project-entry.js';
import { mockOutfitFont } from './helpers/outfit-font.js';

const EMAIL = 'gratis@teste.exemplo';
const DONO = `email:${EMAIL}`;
const SESSAO_GRATIS = {
  active: false, free: true, status: 'inactive', tier: 'free', email: EMAIL, customerId: 'cus_gratis_e2e',
  plan: { id: 'free', name: 'Plano Grátis', priceLabel: 'R$ 0', imageQuota: 0, projectLimit: 3 },
};
const ROTAS_PAGAS = ['/api/ai/', '/api/anthropic/', '/api/fetch-source', '/api/projects', '/api/library-sync',
  '/api/account-library-meta', '/api/project-share', '/api/agent-access'];

/** Toda rota paga responde 402, como o servidor real, e fica registrada. */
function rotasPagas(chamadas) {
  return Object.fromEntries(ROTAS_PAGAS.map((rota) => [rota, (route) => {
    chamadas.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 402, json: { error: 'Assinatura inativa. Renove o plano para continuar.' } });
  }]));
}

const V2 = process.env.VITE_PROJECTS_V2 === 'true';

/**
 * Conta na nuvem simulada, nos dois formatos que o app fala: a biblioteca
 * antiga (`/api/library-sync`) e projetos V2 (`/api/projects` + metadados),
 * que é o que roda em produção. `sessao()` decide: sem assinatura, 402.
 */
function nuvem(cloud, sessao, chamadas = []) {
  const recusa = (route, rota) => {
    chamadas.push(rota);
    return route.fulfill({ status: 402, json: { error: 'Assinatura inativa. Renove o plano para continuar.' } });
  };
  const resumo = () => ({
    ok: true, empty: cloud.rows.size === 0, customerId: sessao().customerId,
    revision: cloud.revision, updatedAt: cloud.updatedAt, projectCount: cloud.rows.size, assetIds: [],
    meta: cloud.rows.size ? { revision: cloud.revision, updatedAt: cloud.updatedAt, projectCount: cloud.rows.size, assetIds: [] } : null,
  });
  return {
    '/api/projects': (route) => {
      if (!sessao().active) return recusa(route, '/api/projects');
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'GET' && url.searchParams.has('id')) {
        const row = cloud.rows.get(url.searchParams.get('id'));
        return row
          ? route.fulfill({ json: { ok: true, project: { id: row.entry.id, entry: row.entry, version: row.version, deleted: false } } })
          : route.fulfill({ status: 404, json: { code: 'project_not_found' } });
      }
      if (request.method() === 'GET') {
        return route.fulfill({ json: { ok: true, total: cloud.rows.size, nextCursor: null,
          projects: [...cloud.rows.values()].map((row) => ({ id: row.entry.id,
            entry: { id: row.entry.id, name: row.entry.name, status: row.entry.status }, version: row.version, deleted: false })) } });
      }
      const body = request.postDataJSON();
      if (request.method() === 'DELETE') {
        cloud.rows.delete(body.id);
        return route.fulfill({ json: { ok: true, project: { id: body.id, version: body.baseVersion + 1, deleted: true } } });
      }
      const anterior = cloud.rows.get(body.entry.id);
      if (body.baseVersion !== (anterior?.version || 0)) {
        return route.fulfill({ status: 409, json: { error: 'Projeto mudou.', code: 'project_conflict', cloudVersion: anterior?.version || 0 } });
      }
      cloud.rows.set(body.entry.id, { entry: body.entry, version: body.baseVersion + 1 });
      cloud.puts.push(body.entry.id);
      cloud.revision += 1;
      return route.fulfill({ json: { ok: true, project: { id: body.entry.id, entry: body.entry, version: body.baseVersion + 1, deleted: false } } });
    },
    '/api/account-library-meta': (route) => {
      if (!sessao().active) return recusa(route, '/api/account-library-meta');
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: { ok: true, metadata: cloud.metadata, revision: cloud.metaRevision, updatedAt: cloud.updatedAt } });
      }
      const body = route.request().postDataJSON();
      cloud.metadata = { ...cloud.metadata, ...body.metadata };
      cloud.metaRevision += 1;
      return route.fulfill({ json: { ok: true, metadata: cloud.metadata, revision: cloud.metaRevision, updatedAt: Date.now() } });
    },
    '/api/library-sync': (route) => {
      if (!sessao().active) return recusa(route, '/api/library-sync');
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'GET' && url.searchParams.get('full') === '1') {
        if (!cloud.rows.size) return route.fulfill({ json: { ok: true, empty: true, manifest: null, meta: null } });
        return route.fulfill({ json: { ok: true, manifest: {
          vcVersion: 3, version: 1, customerId: sessao().customerId, ownerId: sessao().customerId,
          revision: cloud.revision, updatedAt: cloud.updatedAt, docs: [...cloud.rows.values()].map((row) => row.entry),
          deletedIds: [], folders: [], brands: cloud.metadata.brands, activeDocId: cloud.metadata.activeDocId,
          activeBrandId: cloud.metadata.activeBrandId, assetIds: [],
        } } });
      }
      if (request.method() === 'GET') return route.fulfill({ json: resumo() });
      const body = request.postDataJSON();
      if (/^putasset/i.test(String(body.action))) return route.fulfill({ json: { ok: true, assetId: body.assetId, complete: true } });
      if (body.action === 'push' && body.manifest) {
        for (const doc of body.manifest.docs || []) cloud.rows.set(doc.id, { entry: doc, version: (cloud.rows.get(doc.id)?.version || 0) + 1 });
        cloud.revision += 1; cloud.updatedAt = Date.now();
        return route.fulfill({ json: { ok: true, revision: cloud.revision, updatedAt: cloud.updatedAt } });
      }
      return route.fulfill({ json: resumo() });
    },
  };
}

const contaNaNuvem = (entries = []) => ({
  rows: new Map(entries.map((entry) => [entry.id, { entry, version: 1 }])),
  revision: entries.length ? 7 : 0, metaRevision: 1, updatedAt: Date.now() - 3_600_000, puts: [],
  metadata: { brands: [], folders: [], activeDocId: entries[0]?.id || '', activeBrandId: '', userProfile: null,
    onboardingDone: '1', modesIntroDone: '1', assetIds: [] },
});

const projeto = (id, nome, titulos, updatedAt = Date.now()) => ({
  id, name: nome, updatedAt,
  doc: { fmt: 'carrossel', slides: titulos.map((title, i) => ({
    id: `${id}-s${i}`, num: i + 1, title, subtitle: `Apoio do card ${i + 1}.`, layout: 'mc', align: 'center',
    // Como um card criado pelo app: sem o campo, o editor liga a sombra antiga do texto.
    textShadow: false,
  })) },
});

async function semearBiblioteca(page, projetos, { ativo = projetos[0]?.id, desde } = {}) {
  await page.addInitScript(({ projetos: lista, ativo: ativoId, dono, desde: since }) => {
    if (localStorage.getItem('vc_library') !== null) return; // recarregamentos mantêm o que o app gravou
    localStorage.setItem('vc_data_owner', JSON.stringify(dono));
    localStorage.setItem('vc_library', JSON.stringify(lista));
    if (ativoId) localStorage.setItem('vc_active_doc_id', JSON.stringify(ativoId));
    if (since) localStorage.setItem('vc_free_plan_since', JSON.stringify({ owner: dono, since }));
  }, { projetos, ativo, dono: DONO, desde });
}

async function abrirGratis(page, { chamadas = [], extra = {} } = {}) {
  // Fontes e html2canvas vêm de CDN; nada de IA pode sair para a rede.
  await page.route('https://api.openai.com/**', (route) => { chamadas.push('openai-direto'); return route.abort(); });
  await page.route('https://api.anthropic.com/**', (route) => { chamadas.push('anthropic-direto'); return route.abort(); });
  await mockApi(page, { session: SESSAO_GRATIS, extra: { ...rotasPagas(chamadas), ...extra } });
  await page.goto('/?app=1');
  await expect(page.locator('[data-vc-tour="account-home"]')).toBeVisible({ timeout: 30_000 });
}

async function criarProjetoManual(page, nome) {
  await page.getByRole('button', { name: 'Criar um projeto', exact: true }).click();
  const fluxo = page.getByRole('region', { name: 'Criar novo projeto', exact: true });
  await expect(fluxo.locator('[data-vc-free-create]')).toContainText('No plano grátis você cria à mão.');
  // O assistente de IA (7 passos) não aparece: só o passo manual.
  await expect(fluxo.getByRole('button', { name: 'Continuar', exact: true })).toHaveCount(0);
  await fluxo.getByLabel(/^Nome do projeto/).fill(nome);
  await fluxo.getByRole('button', { name: /^Criar e abrir o editor/ }).click();
  await expect(page.locator('[data-vc-tour="thumbnails"]')).toBeVisible({ timeout: 15_000 });
}

const paginaDePlanos = (page) => page.locator('[data-vc-upgrade-reason]');
const tituloNoPainel = (page) => page.getByPlaceholder('Seu título aqui').first();

test.describe('Plano grátis', () => {
  test('anônimo continua vendo os planos, agora com "Começar grátis"', async ({ page }) => {
    await mockApi(page, { session: SESSAO_ANONIMA });
    await page.goto('/?app=1');
    const gratis = page.getByRole('region', { name: 'Plano grátis', exact: true });
    await expect(gratis).toContainText('Sem IA e sem imagem gerada');
    await expect(gratis).toContainText('Até 3 projetos');
    await expect(page.locator('[data-vc-tour="thumbnails"]')).toHaveCount(0);
    // Começar grátis pede conta: abre o cadastro, não o editor.
    await gratis.getByRole('button', { name: 'Começar grátis', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Criar conta', exact: true }).last()).toBeVisible();
    await expect(page.locator('[data-vc-tour="thumbnails"]')).toHaveCount(0);
  });

  test('cadastro pelo formulário entra no editor grátis; sair e entrar de novo devolve os projetos', async ({ page }) => {
    test.setTimeout(150_000);
    const chamadas = [];
    let sessao = SESSAO_ANONIMA;
    let cadastro = null;
    await page.route('https://api.openai.com/**', (route) => route.abort());
    await mockApi(page, {
      extra: {
        '/api/auth/session': (route) => route.fulfill({ json: sessao }),
        '/api/auth/register': (route) => {
          cadastro = route.request().postDataJSON();
          sessao = SESSAO_GRATIS; // o servidor emitiu o cookie da conta grátis
          return route.fulfill({ json: { active: false, free: true, plan: 'free', email: EMAIL, customerId: SESSAO_GRATIS.customerId,
            message: 'Conta criada. Você entrou no plano grátis.' } });
        },
        '/api/auth/login': (route) => {
          sessao = SESSAO_GRATIS;
          return route.fulfill({ json: { active: false, free: true, plan: 'free', email: EMAIL, customerId: SESSAO_GRATIS.customerId, login: 'password' } });
        },
        '/api/auth/logout': (route) => {
          sessao = SESSAO_ANONIMA;
          return route.fulfill({ json: { ok: true, localCookieCleared: true, sessionsRevoked: true } });
        },
        ...rotasPagas(chamadas),
      },
    });
    await page.goto('/?app=1');
    await page.getByRole('region', { name: 'Plano grátis', exact: true }).getByRole('button', { name: 'Começar grátis', exact: true }).click();
    const modal = page.getByRole('dialog');
    await modal.locator('input[type="email"]').fill(EMAIL);
    await modal.locator('input[type="password"]').first().fill('SenhaDeTeste123!');
    await modal.getByRole('button', { name: 'Criar conta', exact: true }).last().click();

    // Sem parada nos planos: a conta nova cai direto na tela inicial do editor.
    await expect(page.locator('[data-vc-tour="account-home"]')).toBeVisible({ timeout: 45_000 });
    expect(cadastro).toMatchObject({ email: EMAIL });
    await expect(page).not.toHaveURL(/account_switch|login=/);
    await criarProjetoManual(page, 'Primeiro projeto grátis');
    await tituloNoPainel(page).fill('Feito logo depois do cadastro');
    await expect(page.locator('[data-vc-inline-editable="true"]:visible').filter({ hasText: 'Feito logo depois do cadastro' }).first()).toBeVisible();

    // Sair da conta: os projetos ficam no cofre deste navegador.
    await page.getByRole('button', { name: 'Perfil', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Sair e apagar deste aparelho' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Plano grátis', exact: true }).or(page.getByRole('button', { name: 'Entrar', exact: true })).first()).toBeVisible({ timeout: 45_000 });
    expect(await page.evaluate(() => localStorage.getItem('vc_library'))).toBeNull();

    // Entrar de novo com a mesma conta devolve o projeto.
    await page.goto('/?app=1');
    await page.getByRole('button', { name: 'Entrar com senha', exact: true }).click();
    const login = page.getByRole('dialog');
    await login.locator('input[type="email"]').fill(EMAIL);
    await login.locator('input[type="password"]').first().fill('SenhaDeTeste123!');
    await login.getByRole('button', { name: 'Entrar', exact: true }).last().click();
    await expect(page.locator('[data-vc-tour="account-home"]')).toBeVisible({ timeout: 45_000 });
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]').map((e) => e.doc?.slides?.[0]?.title)), { timeout: 30_000 })
      .toEqual(['Feito logo depois do cadastro']);
    expect(chamadas.filter((rota) => rota !== '/api/library-sync')).toEqual([]);
  });

  test('conta grátis cria, edita e exporta um carrossel à mão, sem chamar nenhuma rota paga', async ({ page }) => {
    test.setTimeout(120_000);
    const chamadas = [];
    await mockOutfitFont(page);
    await abrirGratis(page, { chamadas });
    await criarProjetoManual(page, 'Meu carrossel manual');

    // Editar: o texto digitado no painel aparece no card.
    await tituloNoPainel(page).fill('Feito à mão no plano grátis');
    await expect(page.locator('[data-vc-inline-editable="true"]:visible').filter({ hasText: 'Feito à mão no plano grátis' }).first()).toBeVisible();

    // Mais um card.
    await page.getByRole('button', { name: 'Adicionar card ao carrossel' }).click();
    await expect(page.getByRole('button', { name: 'Card 2 de 2' })).toBeVisible();

    // Gravação: só neste aparelho, sem "pendente na conta".
    const gravacao = page.locator('[data-vc-save-device-only]').first();
    await expect(gravacao).toContainText('Salvo só neste aparelho');
    await expect(page.getByText(/pendente na conta/)).toHaveCount(0);

    // Exportar o card 1 em PNG de verdade.
    await page.getByRole('button', { name: 'Card 1 de 2' }).click();
    const download = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: /baixar card 1/i }).click({ force: true });
    const arquivo = await download;
    expect(arquivo.suggestedFilename()).toMatch(/\.png$/);
    const partes = [];
    for await (const parte of await arquivo.createReadStream()) partes.push(parte);
    const png = Buffer.concat(partes);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.length).toBeGreaterThan(10_000);

    // O projeto sobrevive a recarregar a página (está no aparelho).
    await page.reload();
    await expect(page.locator('[data-vc-tour="account-home"], [data-vc-tour="thumbnails"]').first()).toBeVisible({ timeout: 30_000 });
    const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]'));
    expect(guardado).toHaveLength(1);
    expect(guardado[0].name).toBe('Meu carrossel manual');
    expect(guardado[0].doc.slides).toHaveLength(2);
    expect(guardado[0].doc.slides[0].title).toBe('Feito à mão no plano grátis');

    // Em nenhum momento o editor tentou IA, nuvem ou agentes.
    expect(chamadas).toEqual([]);
  });

  test('cada ponto de IA ou imagem gerada abre a assinatura e "continuar no grátis" devolve o mesmo projeto', async ({ page }) => {
    test.setTimeout(120_000);
    const chamadas = [];
    await semearBiblioteca(page, [projeto('p-ia', 'Projeto com rascunho', ['Título que não pode sumir', 'Segundo card'])]);
    await abrirGratis(page, { chamadas });
    await page.getByRole('button', { name: 'Abrir um projeto', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Projeto com rascunho', exact: true }).first().click();
    await expect(page.locator('[data-vc-tour="thumbnails"]')).toBeVisible({ timeout: 15_000 });

    const pontos = [
      ['Gerar com IA', () => page.locator('[data-vc-tour="generate"]').first().click(), /Criar texto com IA faz parte dos planos pagos/],
      ['Configurar IA', () => page.getByRole('button', { name: 'Configurar IA', exact: true }).first().click(), /chave própria de IA faz parte dos planos pagos/],
      ['Guardar na conta', () => page.getByRole('button', { name: 'Guardar na conta: ver planos' }).first().click(), /Guardar projetos na conta faz parte dos planos pagos/],
    ];
    for (const [nome, abrir, motivo] of pontos) {
      await test.step(nome, async () => {
        await abrir();
        await expect(paginaDePlanos(page)).toHaveText(motivo);
        await expect(page.getByRole('heading', { name: 'Assine para criar com IA.' })).toBeVisible();
        // E-mail da conta já preenchido; nada de "entrar" para quem já entrou.
        await expect(page.locator('#vc-paywall-email')).toHaveValue(EMAIL);
        await expect(page.getByRole('button', { name: 'Entrar com senha' })).toHaveCount(0);
        await page.getByRole('button', { name: 'Continuar no plano grátis', exact: true }).click();
        await expect(paginaDePlanos(page)).toHaveCount(0);
        // Mesmo projeto, mesmo texto, sem recarregar.
        await expect(page.locator('[data-vc-inline-editable="true"]:visible').filter({ hasText: 'Título que não pode sumir' }).first()).toBeVisible();
      });
    }
    expect(chamadas).toEqual([]);
  });

  test('gerar imagem no card leva à assinatura, mesmo com chave própria gravada no navegador', async ({ page }) => {
    test.setTimeout(120_000);
    const chamadas = [];
    await semearBiblioteca(page, [projeto('p-img', 'Projeto de imagem', ['Card que pede foto'])]);
    // Chave própria herdada de quando a conta era paga: no grátis ela não pode ser usada.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('vc_openai_key', JSON.stringify('sk-chave-propria-antiga'));
        localStorage.setItem('vc_ai_settings', JSON.stringify({ keys: { openai: 'sk-chave-propria-antiga' }, imageByok: true }));
      } catch { /* */ }
    });
    await abrirGratis(page, { chamadas });
    await page.getByRole('button', { name: 'Abrir um projeto', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Projeto de imagem', exact: true }).first().click();
    await expect(page.locator('[data-vc-tour="thumbnails"]')).toBeVisible({ timeout: 15_000 });

    await selectEditorMode(page, 'studio');
    const gerarImagem = page.getByRole('button', { name: /^Gerar imagem/ }).first();
    await expect(gerarImagem).toBeVisible();
    await gerarImagem.click();
    // O editor pede a descrição da imagem antes de gerar.
    const descricao = page.getByRole('dialog').locator('textarea, input[type="text"]').first();
    if (await descricao.isVisible({ timeout: 3000 }).catch(() => false)) {
      await descricao.fill('uma mesa de trabalho com caderno');
      await page.getByRole('dialog').getByRole('button', { name: /gerar|confirmar|aplicar|ok/i }).last().click();
    }
    await expect(paginaDePlanos(page)).toHaveText(/Gerar imagem faz parte dos planos pagos/, { timeout: 15_000 });
    await expect(page.getByText('No grátis você envia suas próprias fotos.')).toBeVisible();
    expect(chamadas).toEqual([]);
  });

  test('assinar a partir do editor volta ao mesmo projeto e ao mesmo card', async ({ page }) => {
    test.setTimeout(120_000);
    const chamadas = [];
    let sessao = SESSAO_GRATIS;
    let checkout = null;
    await semearBiblioteca(page, [
      projeto('p-outro', 'Outro projeto', ['Não é este']),
      projeto('p-volta', 'Projeto da volta', ['Capa', 'Card do meio', 'Fechamento']),
    ], { ativo: 'p-outro' });
    await page.route('https://checkout.stripe.com/**', (route) => route.fulfill({
      contentType: 'text/html', body: '<h1>Checkout simulado</h1>',
    }));
    await page.route('https://api.openai.com/**', (route) => route.abort());
    const cloud = contaNaNuvem(); // conta recém-assinada: nada na nuvem ainda
    await mockApi(page, {
      extra: {
        '/api/auth/session': (route) => route.fulfill({ json: sessao }),
        '/api/stripe/checkout': (route) => {
          checkout = route.request().postDataJSON();
          return route.fulfill({ json: { url: 'https://checkout.stripe.com/c/pay/cs_gratis', sessionId: 'cs_gratis', tier: checkout.tier } });
        },
        ...rotasPagas(chamadas),
        ...nuvem(cloud, () => sessao, chamadas),
      },
    });
    await page.goto('/?app=1');
    await expect(page.locator('[data-vc-tour="account-home"]')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Abrir um projeto', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Projeto da volta', exact: true }).first().click();
    await page.getByRole('button', { name: 'Card 2 de 3' }).click();
    await expect(page.locator('[data-vc-inline-editable="true"]:visible').filter({ hasText: 'Card do meio' }).first()).toBeVisible();

    // Tenta IA → planos → assina.
    await page.locator('[data-vc-tour="generate"]').first().click();
    await expect(paginaDePlanos(page)).toBeVisible();
    await page.getByRole('button', { name: /^Assinar · / }).click();
    await page.waitForURL('https://checkout.stripe.com/**');
    expect(checkout).toMatchObject({ email: EMAIL, tier: 'essential' });
    expect(chamadas).toEqual([]);

    // Stripe devolve para o Moont com a assinatura ativa.
    sessao = { ...SESSAO_ATIVA, email: EMAIL, customerId: SESSAO_GRATIS.customerId, tier: 'essential' };
    await page.goto('/?billing=success');
    await expect(page.locator('[data-vc-tour="thumbnails"]')).toBeVisible({ timeout: 30_000 });
    // Mesmo projeto, mesmo card, texto intacto — sem passar pela tela inicial.
    await expect(page.getByLabel('Ir para o card')).toHaveValue('1'); // segundo card de três
    await expect(page.locator('[data-vc-inline-editable="true"]:visible').filter({ hasText: 'Card do meio' }).first()).toBeVisible();
    await expect(page.locator('[data-vc-tour="account-home"]')).toHaveCount(0);
    const biblioteca = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]').map((e) => e.name).sort());
    expect(biblioteca).toEqual(['Outro projeto', 'Projeto da volta']);
    // Agora é assinante: o indicador deixa de dizer "só neste aparelho".
    await expect(page.locator('[data-vc-save-device-only]')).toHaveCount(0);
    // Em produção (projetos V2) os dois projetos do grátis sobem para a conta recém-assinada.
    if (V2) await expect.poll(() => [...cloud.rows.keys()].sort(), { timeout: 30_000 }).toEqual(['p-outro', 'p-volta']);
  });

  test('perfil e uso dizem "Plano Grátis" e levam aos planos, sem mensagem de erro de assinatura', async ({ page }) => {
    const chamadas = [];
    await abrirGratis(page, { chamadas });
    await page.getByRole('button', { name: 'Perfil', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Plano Grátis', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sem IA no plano grátis', exact: true })).toBeVisible();
    await expect(page.getByText(/Plano não informado|não confirmado|Portal do cliente indisponível/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Abrir portal do cliente' })).toHaveCount(0);
    // Assistentes (Claude, ChatGPT, Codex) são recurso pago: nada de instrução de conexão.
    await expect(page.locator('[data-vc-free-agents]')).toContainText('nos planos pagos');
    await expect(page.getByText('Endereço do MCP')).toHaveCount(0);

    await page.getByRole('button', { name: 'Ver planos', exact: true }).first().click();
    await expect(paginaDePlanos(page)).toBeVisible();
    await page.getByRole('button', { name: 'Continuar no plano grátis', exact: true }).click();

    await page.getByRole('button', { name: 'Uso', exact: true }).first().click();
    await expect(page.getByText('Sem imagens inclusas', { exact: true })).toBeVisible();
    await expect(page.getByText('Uso indisponível')).toHaveCount(0);
    expect(chamadas).toEqual([]);
  });

  test('limite de 3 projetos: criar o quarto leva à assinatura, os três existentes continuam abrindo', async ({ page }) => {
    const chamadas = [];
    await semearBiblioteca(page, [
      projeto('p1', 'Projeto um', ['Um']), projeto('p2', 'Projeto dois', ['Dois']), projeto('p3', 'Projeto três', ['Três']),
    ]);
    await abrirGratis(page, { chamadas });
    await page.getByRole('button', { name: 'Criar um projeto', exact: true }).click();
    await expect(paginaDePlanos(page)).toHaveText(/O plano grátis guarda até 3 projetos/);
    await expect(page.getByRole('region', { name: 'Criar novo projeto', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Continuar no plano grátis', exact: true }).click();

    await page.getByRole('button', { name: 'Abrir um projeto', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Projeto três', exact: true }).first().click();
    await expect(page.locator('[data-vc-inline-editable="true"]:visible').filter({ hasText: 'Três' }).first()).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]').length)).toBe(3);
    expect(chamadas).toEqual([]);
  });

  test('ex-assinante que usou o grátis e reassinou: o projeto feito no grátis não é trocado pela biblioteca da nuvem', async ({ page }) => {
    test.setTimeout(120_000);
    const desde = Date.now() - 60_000;
    await semearBiblioteca(page, [
      projeto('p-nuvem', 'Projeto que já estava na conta', ['Versão da conta'], desde - 3_600_000),
      projeto('p-gratis', 'Feito durante o grátis', ['Trabalho que não pode sumir'], desde + 30_000),
    ], { desde });
    const cloud = contaNaNuvem([projeto('p-nuvem', 'Projeto que já estava na conta', ['Versão da conta'], desde - 3_600_000)]);
    const sessao = { ...SESSAO_ATIVA, email: EMAIL, customerId: SESSAO_GRATIS.customerId, tier: 'creator' };
    await page.route('https://api.openai.com/**', (route) => route.abort());
    await mockApi(page, { session: sessao, extra: nuvem(cloud, () => sessao) });
    await page.goto('/?app=1');
    await expect(page.locator('[data-vc-tour="account-home"]')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Abrir um projeto', exact: true }).click();
    const lista = page.getByRole('region', { name: 'Lista de projetos', exact: true });
    await expect(lista.getByRole('button', { name: 'Abrir Feito durante o grátis', exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(lista.getByRole('button', { name: 'Abrir Projeto que já estava na conta', exact: true }).first()).toBeVisible();
    const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]'));
    expect(guardado.find((e) => e.id === 'p-gratis')?.doc.slides[0].title).toBe('Trabalho que não pode sumir');
    // Recuperação concluída: marcador e cópia de segurança saem do aparelho.
    expect(await page.evaluate(() => [localStorage.getItem('vc_free_plan_since'), localStorage.getItem('vc_free_plan_drafts')])).toEqual([null, null]);
    // Em produção (projetos V2) o projeto do grátis sobe sozinho para a conta, como projeto novo.
    if (V2) await expect.poll(() => cloud.rows.has('p-gratis'), { timeout: 30_000 }).toBe(true);
  });
});

test.describe('Plano grátis no celular (390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('cria e edita à mão, e a página de assinatura cabe sem rolagem lateral', async ({ page }) => {
    test.setTimeout(120_000);
    const chamadas = [];
    await abrirGratis(page, { chamadas });
    await criarProjetoManual(page, 'Carrossel no celular');
    const semRolagemLateral = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(await semRolagemLateral()).toBe(true);

    // Gerar (cabeçalho) → planos, com alvos de toque de 44 px ou mais.
    await page.locator('[data-vc-tour="generate"]').first().click();
    await expect(paginaDePlanos(page)).toBeVisible();
    expect(await semRolagemLateral()).toBe(true);
    for (const nome of [/^Assinar · /, 'Continuar no plano grátis']) {
      const caixa = await page.getByRole('button', { name: nome }).boundingBox();
      expect(caixa.height, String(nome)).toBeGreaterThanOrEqual(44);
      expect(caixa.x + caixa.width, String(nome)).toBeLessThanOrEqual(390);
    }
    await page.getByRole('button', { name: 'Continuar no plano grátis', exact: true }).click();
    await expect(page.locator('[data-vc-tour="thumbnails"]')).toBeVisible();
    await expect(page.locator('[data-vc-save-device-only]').first()).toContainText('Salvo só neste aparelho');
    // UX-11: no celular vale o aviso curto em uma linha e o botão aparece inteiro.
    const aviso = page.locator('[data-vc-save-device-only]:visible').first();
    await expect(aviso.locator('.vc-save-device-only-short')).toBeVisible();
    await expect(aviso.locator('.vc-save-device-only-long')).toBeHidden();
    const caixaAviso = await aviso.locator('.vc-save-device-only-text').boundingBox();
    expect(caixaAviso.height).toBeLessThanOrEqual(32);
    const guardar = await aviso.getByRole('button', { name: 'Guardar na conta: ver planos' }).boundingBox();
    expect(guardar.x).toBeGreaterThanOrEqual(0);
    expect(guardar.x + guardar.width).toBeLessThanOrEqual(390);
    expect(await semRolagemLateral()).toBe(true);
    expect(chamadas).toEqual([]);
  });
});
