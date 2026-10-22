import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

const V2 = process.env.VITE_PROJECTS_V2 === 'true';
const PROJECT_ID = 'save-after-deploy';
const PROJECT_NAME = 'Projeto de teste após publicação';
const TITLE = 'Uma edição feita com a aba já aberta';
const CAPTION = 'Esta legenda precisa chegar à conta mesmo depois de uma nova publicação do site.';

function cloudFixture() {
  const brand = { id: 'deploy-brand', name: 'Marca de teste' };
  return {
    version: 1,
    revision: 1,
    metaRevision: 1,
    writes: [],
    metadata: {
      brands: [brand], folders: [], activeDocId: PROJECT_ID, activeBrandId: brand.id,
      userProfile: null, onboardingDone: '1', modesIntroDone: '1', assetIds: [],
    },
    entry: {
      id: PROJECT_ID, name: PROJECT_NAME, status: 'draft',
      createdAt: 1_720_000_000_000, updatedAt: 1_720_000_000_000,
      doc: {
        brand, productKind: 'carrossel', fmt: 'feed', caption: 'Legenda original.',
        slides: [{ id: 'deploy-slide', num: 1, title: 'Título original', subtitle: 'Texto de apoio preservado.' }],
        styleKit: { stylePrompt: '', contextMd: '', refImages: [], logoOnGenerate: true },
      },
    },
  };
}

function manifest(cloud) {
  return {
    vcVersion: 3, customerId: SESSAO_ATIVA.customerId,
    ...cloud.metadata, revision: cloud.revision, updatedAt: Date.now(),
    docs: [cloud.entry], deletedIds: [], assetIds: [],
  };
}

/** Both persistence contracts stay stateful; no real account or external network. */
async function mockCloud(page, cloud) {
  await page.context().route('**/*', route => {
    const { hostname, protocol } = new URL(route.request().url());
    if (['localhost', '127.0.0.1'].includes(hostname) || !/^https?:$/.test(protocol)) return route.continue();
    return route.abort('blockedbyclient');
  });
  await mockApi(page, { session: SESSAO_ATIVA, extra: {
    '/api/projects': route => {
      const request = route.request();
      if (!V2) return route.fulfill({ status: 400, json: { error: 'Build legado deve usar library-sync.' } });
      if (request.headers()['x-project-owner'] !== SESSAO_ATIVA.customerId) {
        return route.fulfill({ status: 409, json: { code: 'project_owner_changed' } });
      }
      const url = new URL(request.url());
      if (request.method() === 'GET' && !url.searchParams.has('id')) {
        return route.fulfill({ json: { ok: true, total: 1, nextCursor: null, projects: [{
          id: PROJECT_ID, entry: { id: PROJECT_ID, name: PROJECT_NAME, status: 'draft' },
          version: cloud.version, deleted: false,
        }] } });
      }
      if (request.method() === 'PUT') {
        const body = request.postDataJSON();
        if (body.entry.id !== PROJECT_ID || body.baseVersion !== cloud.version) {
          return route.fulfill({ status: 409, json: { code: 'project_conflict', cloudVersion: cloud.version } });
        }
        cloud.entry = body.entry;
        cloud.version += 1;
        cloud.revision += 1;
        cloud.writes.push(structuredClone(body.entry));
      }
      return route.fulfill({ json: { ok: true, project: {
        id: PROJECT_ID, entry: cloud.entry, version: cloud.version, deleted: false,
      } } });
    },
    '/api/account-library-meta': route => {
      const request = route.request();
      if (request.headers()['x-account-owner'] !== SESSAO_ATIVA.customerId) {
        return route.fulfill({ status: 409, json: { code: 'account_meta_owner_changed' } });
      }
      if (request.method() !== 'GET') {
        const body = request.postDataJSON();
        if (body.baseRevision !== cloud.metaRevision) {
          return route.fulfill({ status: 409, json: { code: 'account_meta_conflict', cloudRevision: cloud.metaRevision } });
        }
        cloud.metadata = { ...cloud.metadata, ...body.metadata };
        cloud.metaRevision += 1;
      }
      return route.fulfill({ json: { ok: true, metadata: cloud.metadata, revision: cloud.metaRevision, updatedAt: Date.now() } });
    },
    '/api/library-sync': route => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        if (body.action === 'status') {
          return route.fulfill({ json: { ok: true, empty: false, customerId: SESSAO_ATIVA.customerId,
            meta: { projectCount: 1, revision: cloud.revision, assetIds: [] } } });
        }
        if (body.action !== 'push' || V2) {
          return route.fulfill({ status: 400, json: { error: 'Operação de teste inesperada.' } });
        }
        const entry = body.manifest.docs.find(item => item.id === PROJECT_ID);
        if (!entry) return route.fulfill({ status: 400, json: { error: 'Projeto ausente no envio.' } });
        cloud.entry = entry;
        cloud.revision += 1;
        cloud.writes.push(structuredClone(entry));
        return route.fulfill({ json: { ok: true, revision: cloud.revision, updatedAt: Date.now(), projectCount: 1, assetIds: [] } });
      }
      if (url.searchParams.get('full') === '1') return route.fulfill({ json: { ok: true, manifest: manifest(cloud) } });
      return route.fulfill({ json: { ok: true, empty: false, customerId: SESSAO_ATIVA.customerId,
        meta: { projectCount: 1, revision: cloud.revision, assetIds: [] } } });
    },
  } });
}

test(`aba aberta continua salvando após remoção dos chunks antigos (${V2 ? 'projetos V2' : 'biblioteca legada'})`, async ({ page, browser }) => {
  test.setTimeout(60_000);
  const cloud = cloudFixture();
  await mockCloud(page, cloud);
  await page.goto('/?app=1');
  await enterEditorFromHome(page, PROJECT_NAME);
  const title = page.locator('main h1[data-vc-inline-editable="true"]').first();
  await expect(title).toHaveText('Título original');

  // Simulate a deploy removing old hashes while this tab keeps its loaded code.
  // A successful save must not depend on a previously unused JS chunk.
  const missingChunks = [];
  const blockOldChunks = route => {
    const path = new URL(route.request().url()).pathname;
    if (/\/assets\/.*\.js$/.test(path)) {
      missingChunks.push(path);
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Old deployment asset removed' });
    }
    return route.continue();
  };
  await page.route('**/assets/**', blockOldChunks);

  await title.dblclick();
  await expect(title).toHaveAttribute('contenteditable', 'true');
  await title.fill(TITLE);
  await page.getByRole('button', { name: /Legenda.*card 1/i }).first().click();
  const caption = page.getByRole('dialog', { name: 'Legenda da publicação' });
  await caption.getByRole('textbox').fill(CAPTION);
  await caption.getByRole('button', { name: 'Feito', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar projeto agora', exact: true }).click();

  await expect.poll(() => cloud.writes.some(entry => entry.doc.slides[0].title === TITLE && entry.doc.caption === CAPTION), {
    message: 'A conta precisa receber o texto completo sem buscar módulos removidos pelo deploy.',
  }).toBe(true);
  await expect(page.getByRole('status').filter({ hasText: /Salvo na conta às/ }).first()).toBeVisible();
  expect(missingChunks, 'editar e salvar não pode depender de novos chunks após o boot').toEqual([]);
  await expect(page.getByText(/Failed to fetch dynamically imported module/)).toHaveCount(0);

  // A new navigation receives the current build. Retain storage for the first
  // reload, then prove recovery from the account in an entirely clean browser.
  await page.unroute('**/assets/**', blockOldChunks);
  await page.reload();
  await enterEditorFromHome(page, PROJECT_NAME);
  await expect(page.locator('main h1[data-vc-inline-editable="true"]').first()).toHaveText(TITLE);
  const cleanContext = await browser.newContext();
  try {
    const cleanPage = await cleanContext.newPage();
    await mockCloud(cleanPage, cloud);
    await cleanPage.goto(page.url());
    await enterEditorFromHome(cleanPage, PROJECT_NAME);
    await expect(cleanPage.locator('main h1[data-vc-inline-editable="true"]').first()).toHaveText(TITLE);
    await cleanPage.getByRole('button', { name: /Legenda.*card 1/i }).first().click();
    await expect(cleanPage.getByRole('dialog', { name: 'Legenda da publicação' }).getByRole('textbox')).toHaveValue(CAPTION);
  } finally {
    await cleanContext.close();
  }
});
