import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

test.skip(process.env.VITE_PROJECTS_V2 !== 'true', 'Executar com VITE_PROJECTS_V2=true');
test.setTimeout(90_000);

const BRAND = { id: 'brand-v2', name: 'Marca teste' };
const entry = (id, name) => ({
  id, name, status: 'draft', createdAt: Date.now(), updatedAt: Date.now(),
  doc: {
    brand: BRAND, productKind: 'carrossel', fmt: 'feed',
    slides: [{ id: `${id}-slide`, num: 1, title: `Texto de ${name}`, subtitle: 'Texto preservado.' }],
    styleKit: { stylePrompt: '', contextMd: '', refImages: [], logoOnGenerate: true },
  },
});

function accountSeed() {
  return {
    rows: new Map([['p-a', { entry: entry('p-a', 'Projeto A'), version: 1 }]]),
    revision: 1,
    metaRevision: 1,
    metadata: {
      brands: [BRAND], folders: [], activeDocId: 'p-a', activeBrandId: BRAND.id,
      userProfile: null, onboardingDone: '1', modesIntroDone: '1', assetIds: [],
    },
    puts: [], deletes: [],
  };
}

async function mockV2(page, cloud, session = SESSAO_ATIVA) {
  await page.context().route('**/*', (route) => {
    const { hostname, protocol } = new URL(route.request().url());
    if (['localhost', '127.0.0.1'].includes(hostname) || !/^https?:$/.test(protocol)) return route.continue();
    return route.abort('blockedbyclient');
  });
  await mockApi(page, {
    session,
    extra: {
      '/api/projects': (route) => {
        const request = route.request();
        const owner = request.headers()['x-project-owner'];
        if (owner !== session.customerId) return route.fulfill({ status: 409, json: { code: 'project_owner_changed' } });
        const url = new URL(request.url());
        const body = request.method() === 'GET' ? null : request.postDataJSON();
        if (request.method() === 'GET' && url.searchParams.has('id')) {
          const row = cloud.rows.get(url.searchParams.get('id'));
          return row ? route.fulfill({ json: { ok: true, project: { id: row.entry.id,
            entry: row.entry, version: row.version, deleted: false } } })
            : route.fulfill({ status: 404, json: { code: 'project_not_found' } });
        }
        if (request.method() === 'GET') {
          return route.fulfill({ json: { ok: true, total: cloud.rows.size, nextCursor: null,
            projects: [...cloud.rows.values()].map((row) => ({ id: row.entry.id,
              entry: { id: row.entry.id, name: row.entry.name, status: row.entry.status },
              version: row.version, deleted: false })) } });
        }
        const id = request.method() === 'DELETE' ? body.id : body.entry.id;
        const previous = cloud.rows.get(id);
        if (body.baseVersion !== (previous?.version || 0)) {
          return route.fulfill({ status: 409, json: { error: 'Projeto mudou.', code: 'project_conflict', cloudVersion: previous?.version || 0 } });
        }
        if (request.method() === 'DELETE') {
          if (cloud.forceDeleteConflictOnce) {
            cloud.forceDeleteConflictOnce = false;
            cloud.rows.set(id, { entry: entry(id, 'Versão revista'), version: 2 });
            return route.fulfill({ status: 409, json: {
              error: 'Este projeto mudou na nuvem.', code: 'project_conflict', cloudVersion: 2,
            } });
          }
          cloud.rows.delete(id);
          cloud.deletes.push(id);
          cloud.revision += 1;
          return route.fulfill({ json: { ok: true, project: { id, version: body.baseVersion + 1, deleted: true } } });
        }
        if (cloud.forceConflictOnce) {
          cloud.forceConflictOnce = false;
          cloud.rows.set(id, { entry: entry(id, 'Versão de outro dispositivo'), version: 1 });
          return route.fulfill({ status: 409, json: {
            error: 'Este projeto mudou na nuvem.', code: 'project_conflict', cloudVersion: 1,
          } });
        }
        const saved = { ...body.entry, updatedAt: Date.now() };
        cloud.rows.set(id, { entry: saved, version: body.baseVersion + 1 });
        cloud.puts.push({ id, baseVersion: body.baseVersion });
        cloud.revision += 1;
        return route.fulfill({ json: { ok: true, project: { id, entry: saved, version: body.baseVersion + 1, deleted: false } } });
      },
      '/api/account-library-meta': (route) => {
        const request = route.request();
        if (request.headers()['x-account-owner'] !== session.customerId) {
          return route.fulfill({ status: 409, json: { code: 'account_meta_owner_changed' } });
        }
        if (request.method() === 'GET') return route.fulfill({ json: { ok: true,
          metadata: cloud.metadata, revision: cloud.metaRevision, updatedAt: Date.now() } });
        const body = request.postDataJSON();
        if (body.baseRevision !== cloud.metaRevision) return route.fulfill({ status: 409, json: {
          error: 'Metadados mudaram.', code: 'account_meta_conflict', cloudRevision: cloud.metaRevision,
        } });
        cloud.metadata = { ...cloud.metadata, ...body.metadata };
        cloud.metaRevision += 1;
        return route.fulfill({ json: { ok: true, metadata: cloud.metadata,
          revision: cloud.metaRevision, updatedAt: Date.now() } });
      },
      '/api/library-sync': (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.method() === 'GET' && url.searchParams.has('asset')) {
          const dataUrl = cloud.assets?.get(url.searchParams.get('asset'));
          return dataUrl
            ? route.fulfill({ json: { ok: true, asset: { dataUrl } } })
            : route.fulfill({ status: 404, json: { error: 'Asset não encontrado.' } });
        }
        if (request.method() === 'GET' && url.searchParams.get('full') === '1') {
          return route.fulfill({ json: { ok: true, manifest: {
            vcVersion: 3, customerId: session.customerId, revision: cloud.revision,
            updatedAt: Date.now(), docs: [...cloud.rows.values()].map((row) => row.entry),
            deletedIds: cloud.deletes, folders: cloud.metadata.folders,
            brands: cloud.metadata.brands, activeDocId: cloud.metadata.activeDocId,
            activeBrandId: cloud.metadata.activeBrandId, assetIds: [],
          } } });
        }
        if (request.method() === 'GET') return route.fulfill({ json: { ok: true, empty: false,
          customerId: session.customerId, meta: { projectCount: cloud.rows.size, revision: cloud.revision } } });
        const body = request.postDataJSON();
        if (/^putasset/i.test(String(body.action))) {
          return route.fulfill({ json: { ok: true, assetId: body.assetId, complete: true } });
        }
        return route.fulfill({ status: 400, json: { error: 'Push legado não permitido no teste v2.' } });
      },
    },
  });
}

async function home(page) {
  if (await page.getByRole('button', { name: 'Sync na nuvem', exact: true }).isVisible()) return;
  await page.getByRole('button', { name: 'Perfil', exact: true }).first().click();
  await page.getByRole('button', { name: 'Projetos', exact: true }).first().click();
}

test('Salvar cria só o projeto ativo; novo browser restaura e exclusão não reaparece', async ({ page, browser }) => {
  const cloud = accountSeed();
  await mockV2(page, cloud);
  await page.goto('/?app=1');
  await expect(page.getByText('Projeto A', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Nova comunicação', exact: true }).click();
  await page.getByPlaceholder('Ex.: Clínica Janine').fill('Projeto novo');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar projeto agora' }).click();
  await expect.poll(() => cloud.puts.filter((item) => item.id !== 'p-a').length).toBe(1);
  expect(cloud.puts.every((item) => item.id !== 'p-a')).toBe(true);
  await page.reload();
  await home(page);
  await expect(page.getByText('Projeto novo', { exact: true }).first()).toBeVisible();

  const anotherContext = await browser.newContext();
  const anotherPage = await anotherContext.newPage();
  await mockV2(anotherPage, cloud);
  await anotherPage.goto('/?app=1');
  await expect(anotherPage.getByText('Projeto novo', { exact: true }).first()).toBeVisible();
  await anotherPage.getByRole('button', { name: 'Apagar Projeto novo' }).click();
  await anotherPage.getByRole('button', { name: 'Confirmar eliminação' }).click();
  await expect.poll(() => cloud.deletes.length).toBe(1);
  await page.reload();
  await home(page);
  await expect(page.getByText('Projeto novo', { exact: true })).toHaveCount(0);
  await anotherContext.close();
});

test('outra conta não recebe os projetos da primeira', async ({ page, browser }) => {
  const first = accountSeed();
  await mockV2(page, first);
  await page.goto('/?app=1');
  await expect(page.getByText('Projeto A', { exact: true }).first()).toBeVisible();

  const other = accountSeed();
  other.rows = new Map([['p-b', { entry: entry('p-b', 'Projeto da conta B'), version: 1 }]]);
  other.metadata.activeDocId = 'p-b';
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await mockV2(pageB, other, { ...SESSAO_ATIVA, email: 'outra@teste.exemplo', customerId: 'cus_e2e_2' });
  await pageB.goto('/?app=1');
  await expect(pageB.getByText('Projeto da conta B', { exact: true }).first()).toBeVisible();
  await expect(pageB.getByText('Projeto A', { exact: true })).toHaveCount(0);
  await contextB.close();
});

test('abrir o projeto ativo usa a versão mais recente do servidor', async ({ page }) => {
  const cloud = accountSeed();
  await mockV2(page, cloud);
  await page.goto('/?app=1');
  await expect(page.getByText('Projeto A', { exact: true }).first()).toBeVisible();
  const updated = entry('p-a', 'Projeto A');
  updated.doc.slides[0].title = 'Texto vindo da nuvem';
  cloud.rows.set('p-a', { entry: updated, version: 2 });
  await page.getByRole('button', { name: 'Abrir Projeto A' }).first().click();
  await expect(page.getByText('Texto vindo da nuvem', { exact: true }).first()).toBeVisible();
});

test('conflito 409 preserva ambas as versões como projetos separados', async ({ page }) => {
  const cloud = accountSeed();
  await mockV2(page, cloud);
  await page.goto('/?app=1');
  await expect(page.getByText('Projeto A', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Nova comunicação', exact: true }).click();
  await page.getByPlaceholder('Ex.: Clínica Janine').fill('Projeto em edição');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  cloud.forceConflictOnce = true;
  await page.getByRole('button', { name: 'Salvar projeto agora' }).click();
  await expect(page.getByText(/cópia de conflito na conta/)).toBeVisible();
  expect(cloud.puts).toHaveLength(1);
  const conflicted = [...cloud.rows.values()].find((row) => row.entry.name === 'Versão de outro dispositivo');
  expect(conflicted?.version).toBe(1);
  await expect(page.getByText('Projeto em edição', { exact: true }).first()).toBeVisible();
  await page.reload();
  await home(page);
  await expect(page.getByText('Versão de outro dispositivo', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Projeto em edição (cópia de conflito)', { exact: true }).first()).toBeVisible();
});

test('DELETE em conflito mantém o projeto e a revisão pendente não bloqueia o boot', async ({ page }) => {
  const cloud = accountSeed();
  await mockV2(page, cloud);
  await page.goto('/?app=1');
  await expect(page.getByText('Projeto A', { exact: true }).first()).toBeVisible();
  cloud.forceDeleteConflictOnce = true;
  await page.getByRole('button', { name: 'Apagar Projeto A' }).click();
  await page.getByRole('button', { name: 'Confirmar eliminação' }).click();
  await expect(page.getByText(/A exclusão não foi feita/)).toBeVisible();
  expect(cloud.deletes).toHaveLength(0);
  await page.reload();
  await home(page);
  await expect(page.getByText('Versão revista', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/exclusão\(ões\) precisam de revisão/)).toBeVisible();
});

test('abre projetos e textos antes de um cache de imagens travado responder', async ({ page }) => {
  const cloud = accountSeed();
  const janine = entry('p-a', 'Projeto A');
  janine.doc.slides = Array.from({ length: 23 }, (_, index) => ({
    id: `card-${index + 1}`, num: index + 1,
    title: `Texto ${index + 1}`, bgImageAssetId: 'photo-shared', bgImageId: `old-${index + 1}`,
  }));
  cloud.rows.set('p-a', { entry: janine, version: 1 });
  cloud.assets = new Map([['photo-shared', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==']]);
  await page.addInitScript(() => {
    const native = window.indexedDB;
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: {
        open(name, ...args) {
          if (name === 'viral-carrossel-img') return {}; // nunca dispara success/error
          return native.open(name, ...args);
        },
        deleteDatabase(name) { return native.deleteDatabase(name); },
      },
    });
  });
  await mockV2(page, cloud);
  await page.goto('/?app=1');
  await expect(page.getByText('Projeto A', { exact: true }).first()).toBeVisible({ timeout: 6_000 });
  await expect(page.getByText('23 cards').first()).toBeVisible({ timeout: 6_000 });
});
