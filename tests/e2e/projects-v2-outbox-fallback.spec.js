import { openProjectLibrary, createTextProject } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { createHash } from 'node:crypto';

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

async function mockAccount(page, { rejectPut = false, outboxUnavailable = true } = {}) {
  const cloud = {
    rows: new Map([['p-a', { entry: initial, version: 1 }]]),
    metadata: {
      brands: [initial.doc.brand], folders: [], activeDocId: 'p-a',
      activeBrandId: 'brand-v2', userProfile: null, onboardingDone: '1', modesIntroDone: '1', assetIds: [],
    },
    metaRevision: 1, puts: [], assets: new Map(),
  };
  if (outboxUnavailable) await page.addInitScript(() => {
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
        cloud.puts.push({ id: saved.id, version, baseVersion: body.baseVersion });
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
        if (url.searchParams.has('asset')) {
          const dataUrl = cloud.assets.get(url.searchParams.get('asset'));
          return dataUrl ? route.fulfill({ json: { ok: true, asset: { dataUrl } } })
            : route.fulfill({ status: 404, json: { error: 'Asset não encontrado.' } });
        }
        if (route.request().method() === 'POST') {
          const body = route.request().postDataJSON();
          if (body.action === 'putAsset') {
            cloud.assets.set(body.assetId, body.dataUrl);
            return route.fulfill({ json: { ok: true, assetId: body.assetId, complete: true } });
          }
        }
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

async function createProject(page, name = 'Projeto sem IDB') {
  await page.goto('/?app=1');
  await openProjectLibrary(page);
  await expect(page.getByRole('button', { name:'Abrir Projeto A', exact:true }).first()).toBeVisible();
  await createTextProject(page, { name });
}

async function seedOtherProjectReview(page) {
  await page.evaluate(async () => {
    const owner = JSON.parse(localStorage.getItem('vc_data_owner'));
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('viral-carrossel-project-outbox', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('operations', 'readwrite');
        tx.objectStore('operations').put({
          key: `${owner}\u0000p-b`, owner, projectId: 'p-b', projectName: 'Projeto B',
          opId: 'review-project-b', kind: 'review_delete', baseVersion: 1, reviewVersion: 2,
          createdAt: Date.now(), updatedAt: Date.now(),
        });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  });
}

test('recibo do projeto salvo independe da revisão pendente de outro projeto', async ({ page }) => {
  const cloud = await mockAccount(page, { outboxUnavailable: false });
  cloud.rows.set('p-b', { entry: { ...initial, id: 'p-b', name: 'Projeto B' }, version: 2 });
  await page.goto('/?app=1');
  await openProjectLibrary(page);
  await seedOtherProjectReview(page);
  await createTextProject(page, { name: 'Projeto confirmado' });
  await page.getByRole('button', { name: 'Salvar projeto agora' }).click();
  await expect.poll(() => cloud.puts.length).toBeGreaterThan(0);
  await expect(page.getByRole('status').filter({ hasText: /^Salvo na conta às/ }).first()).toBeVisible();
  await expect(page.getByText('1 alteração(ões) pendentes exigem revisão na conta.', { exact: true })).toBeVisible();
  expect(cloud.rows.get('p-b').version).toBe(2);
  const review = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('viral-carrossel-project-outbox', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('operations').objectStore('operations')
        .get(`${JSON.parse(localStorage.getItem('vc_data_owner'))}\u0000p-b`);
      get.onsuccess = () => { db.close(); resolve(get.result); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
  }));
  expect(review).toMatchObject({ kind: 'review_delete', projectId: 'p-b', reviewVersion: 2 });
});

for (const outboxUnavailable of [false, true]) test(`edição durante PUT recebe novo envio sem perder assets (${outboxUnavailable ? 'direto' : 'fila'})`, async ({ page }) => {
  const cloud = await mockAccount(page, { outboxUnavailable });
  const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6H0YAAAAASUVORK5CYII=';
  const photoId = `original_${createHash('sha256').update(photo).digest('hex')}`;
  cloud.assets.set(photoId, photo);
  cloud.rows.set('p-a', { version: 1, entry: { ...initial, doc: {
    ...initial.doc, slides: [{ ...initial.doc.slides[0], bgImageAssetId: photoId }],
  } } });
  let releaseFirstPut;
  const firstPutGate = new Promise(resolve => { releaseFirstPut = resolve; });
  let releaseSecondPut;
  const secondPutGate = new Promise(resolve => { releaseSecondPut = resolve; });
  let interceptedPuts = 0;
  await page.route('**/api/projects', async route => {
    if (route.request().method() !== 'PUT') return route.fallback();
    interceptedPuts += 1;
    if (interceptedPuts === 1) {
      await firstPutGate;
      return route.fallback();
    }
    if (interceptedPuts === 2) await secondPutGate;
    return route.fallback();
  });
  await page.goto('/?app=1');
  const library = await openProjectLibrary(page);
  await library.getByRole('button', { name: 'Abrir Projeto A', exact: true }).click();
  const openCaption = () => page.getByRole('button', { name: /Legenda.*card 1/i }).first().click();
  await openCaption();
  const dialog = page.getByRole('dialog', { name: 'Legenda da publicação' });
  await dialog.getByRole('textbox').fill('Primeira edição, enviada no PUT inicial.');
  await dialog.getByRole('button', { name: 'Feito' }).click();
  await page.getByRole('button', { name: 'Salvar projeto agora' }).click();
  await expect.poll(() => interceptedPuts).toBe(1);
  await openCaption();
  await dialog.getByRole('textbox').fill('Esta edição nasceu enquanto a versão anterior era enviada.');
  await dialog.getByRole('button', { name: 'Feito' }).click();
  releaseFirstPut();
  await expect.poll(() => cloud.puts.length).toBe(1);
  await expect.poll(() => interceptedPuts).toBe(2);
  await expect(page.getByRole('status').filter({ hasText: /^Salvo na conta às/ })).toHaveCount(0);
  expect(cloud.rows.get('p-a').entry.doc.caption).toBe('Primeira edição, enviada no PUT inicial.');
  releaseSecondPut();
  await expect.poll(() => cloud.puts.length).toBe(2);
  await expect(page.getByRole('status').filter({ hasText: /^Salvo na conta às/ }).first()).toBeVisible();
  expect(cloud.rows.get('p-a').entry.doc.caption).toBe('Esta edição nasceu enquanto a versão anterior era enviada.');
  expect(cloud.rows.get('p-a').entry.doc.slides[0].bgImageAssetId).toBe(photoId);
  expect(cloud.puts.map(({ baseVersion, version }) => [baseVersion, version])).toEqual([[1, 2], [2, 3]]);
});

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
