import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

test.skip(process.env.VITE_PROJECTS_V2 !== 'true', 'Executar com VITE_PROJECTS_V2=true');
test.setTimeout(90_000);

const initial = {
  id: 'p-a', name: 'Projeto A', status: 'draft', createdAt: Date.now(), updatedAt: Date.now(),
  doc: {
    brand: { id: 'brand-v2', name: 'Marca teste' }, productKind: 'carrossel', fmt: 'feed',
    slides: [{ id: 's-a', num: 1, title: 'Texto original', subtitle: 'Texto preservado.' }],
    styleKit: { stylePrompt: '', contextMd: '', refImages: [], logoOnGenerate: true },
  },
};

async function mockAccount(page, { rejectPut = false } = {}) {
  const cloud = {
    rows: new Map([['p-a', { entry: initial, version: 1 }]]),
    metadata: {
      brands: [initial.doc.brand], folders: [], activeDocId: 'p-a',
      activeBrandId: 'brand-v2', userProfile: null, onboardingDone: '1', modesIntroDone: '1', assetIds: [],
    },
    metaRevision: 1, puts: [],
  };
  await page.addInitScript(() => {
    const native = window.indexedDB;
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: {
        open(name, ...args) {
          if (name === 'viral-carrossel-project-outbox') {
            throw new DOMException('IndexedDB indisponível', 'InvalidStateError');
          }
          return native.open(name, ...args);
        },
        deleteDatabase(name) { return native.deleteDatabase(name); },
      },
    });
  });
  await page.context().route('**/*', (route) => {
    const { hostname, protocol } = new URL(route.request().url());
    if (['localhost', '127.0.0.1'].includes(hostname) || !/^https?:$/.test(protocol)) return route.continue();
    return route.abort('blockedbyclient');
  });
  await mockApi(page, {
    session: SESSAO_ATIVA,
    extra: {
      '/api/projects': (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.method() === 'GET' && url.searchParams.has('id')) {
          const row = cloud.rows.get(url.searchParams.get('id'));
          return row ? route.fulfill({ json: { ok: true, project: {
            id: row.entry.id, entry: row.entry, version: row.version, deleted: false,
          } } }) : route.fulfill({ status: 404, json: { code: 'project_not_found' } });
        }
        if (request.method() === 'GET') {
          return route.fulfill({ json: { ok: true, total: cloud.rows.size, nextCursor: null,
            projects: [...cloud.rows.values()].map((row) => ({
              id: row.entry.id, version: row.version, deleted: false,
              entry: { id: row.entry.id, name: row.entry.name, status: row.entry.status },
            })),
          } });
        }
        if (request.method() !== 'PUT') return route.fulfill({ status: 405, json: { error: 'Método não esperado' } });
        const body = request.postDataJSON();
        if (rejectPut) return route.fulfill({ status: 409, json: {
          error: 'Este projeto foi excluído em outro dispositivo. Revise a edição local.',
          code: 'project_deleted', cloudVersion: 2,
        } });
        const previous = cloud.rows.get(body.entry.id);
        if (body.baseVersion !== (previous?.version || 0)) {
          return route.fulfill({ status: 409, json: { error: 'Conflito', code: 'project_conflict' } });
        }
        const saved = { ...body.entry, updatedAt: Date.now() };
        const version = body.baseVersion + 1;
        cloud.rows.set(saved.id, { entry: saved, version });
        cloud.puts.push({ id: saved.id, version });
        return route.fulfill({ json: { ok: true, project: { id: saved.id, entry: saved, version, deleted: false } } });
      },
      '/api/account-library-meta': (route) => {
        if (route.request().method() === 'GET') return route.fulfill({ json: {
          ok: true, metadata: cloud.metadata, revision: cloud.metaRevision, updatedAt: Date.now(),
        } });
        const body = route.request().postDataJSON();
        cloud.metadata = { ...cloud.metadata, ...body.metadata };
        cloud.metaRevision += 1;
        return route.fulfill({ json: {
          ok: true, metadata: cloud.metadata, revision: cloud.metaRevision, updatedAt: Date.now(),
        } });
      },
      '/api/library-sync': (route) => {
        const url = new URL(route.request().url());
        if (url.searchParams.get('full') === '1') return route.fulfill({ json: { ok: true, manifest: {
          vcVersion: 3, customerId: SESSAO_ATIVA.customerId, revision: 1,
          updatedAt: Date.now(), docs: [...cloud.rows.values()].map((row) => row.entry),
          deletedIds: [], folders: cloud.metadata.folders, brands: cloud.metadata.brands,
          activeDocId: cloud.metadata.activeDocId, activeBrandId: cloud.metadata.activeBrandId, assetIds: [],
        } } });
        return route.fulfill({ json: { ok: true, empty: false,
          customerId: SESSAO_ATIVA.customerId, meta: { projectCount: cloud.rows.size, revision: 1 },
        } });
      },
    },
  });
  return cloud;
}

async function createProject(page) {
  await page.goto('/?app=1');
  await expect(page.getByText('Projeto A', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Nova comunicação', exact: true }).click();
  await page.getByRole('textbox', { name:'Como se chama este projeto?' }).fill('Projeto sem IDB');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
}

test('IndexedDB indisponível: Salvar confirma PUT direto e não reenvia sem edição', async ({ page }) => {
  const cloud = await mockAccount(page);
  await createProject(page);
  await page.getByRole('button', { name: 'Salvar projeto agora' }).click();
  await expect.poll(() => cloud.puts.length).toBe(1);
  await expect(page.getByText('Projeto salvo na sua conta.', { exact: true })).toBeVisible();
  await page.waitForTimeout(5_500);
  expect(cloud.puts).toHaveLength(1);
  expect([...cloud.rows.values()].some(({ entry }) => entry.name === 'Projeto sem IDB')).toBe(true);
});

test('Projeto excluído na nuvem mantém a edição local sem criar cópia', async ({ page }) => {
  const cloud = await mockAccount(page, { rejectPut: true });
  await createProject(page);
  await page.getByRole('button', { name: 'Salvar projeto agora' }).click();
  await expect(page.getByText(/Este projeto foi excluído em outro dispositivo/)).toBeVisible();
  expect(cloud.puts).toHaveLength(0);
  expect([...cloud.rows.keys()].some((id) => id.startsWith('conflict-'))).toBe(false);
  await expect(page.getByText('Projeto sem IDB', { exact: true }).first()).toBeVisible();
});
