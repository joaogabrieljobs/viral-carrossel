import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA, SESSAO_ANONIMA } from './helpers/api-mock.js';

const PROJECT_NAMES = [
  'Clínica Janine',
  'Clínica Aurora',
  'Clínica Horizonte',
  'Clínica Bem Viver',
  'Clínica Essência',
];
const BOOT_OFFLINE_MESSAGE = 'E2E: nuvem temporariamente indisponível no boot.';
const BRAND = { id: 'brand-clinicas', name: 'Clínicas — teste de sync' };

function projectFixtures() {
  return PROJECT_NAMES.map((name, index) => ({
    id: `cloud-clinic-${index + 1}`,
    name,
    status: 'draft',
    createdAt: 1_720_000_000_000 + index,
    updatedAt: 1_720_000_000_000 + index,
    doc: {
      brand: BRAND,
      productKind: index === 4 ? 'apresentacao' : 'carrossel',
      fmt: index === 4 ? 'apresentacao' : 'feed',
      slides: [{
        id: `cloud-slide-${index + 1}`,
        num: 1,
        title: `Comunicação da ${name}`,
        subtitle: `Texto preservado do projeto ${index + 1}.`,
        // Foto órfã realista: o manifesto existe, mas o Blob devolve 404.
        ...(index === 2 ? { bgImageAssetId: 'missing-clinic-photo' } : {}),
      }],
      styleKit: { stylePrompt: '', contextMd: '', refImages: [], logoOnGenerate: true },
    },
  }));
}

/** API stateful sem conta, Stripe, Blob ou qualquer serviço externo real. */
async function mockCloud(page, { offlineAtBoot = false, pushDelay = 0, pullDelay = 0, anonymous = false } = {}) {
  const state = {
    online: !offlineAtBoot,
    session: { ...(anonymous ? SESSAO_ANONIMA : SESSAO_ATIVA) },
    loginCount: 0,
    pushCount: 0,
    pullCount: 0,
    missingAssetCount: 0,
    logoutCount: 0,
    manifest: {
      vcVersion: 3,
      revision: 5,
      updatedAt: 1_730_000_000_000,
      docs: projectFixtures(),
      folders: [],
      brands: [BRAND],
      activeDocId: 'cloud-clinic-1',
      activeBrandId: BRAND.id,
      assetIds: ['missing-clinic-photo'],
      onboardingDone: '1',
      modesIntroDone: '1',
    },
  };
  // Além das APIs, bloqueia fonts/analytics/imagens remotas para o teste nunca
  // depender de rede externa. O build e seus assets locais continuam reais.
  await page.context().route('**/*', (route) => {
    const { hostname, protocol } = new URL(route.request().url());
    if (['localhost', '127.0.0.1'].includes(hostname) || !/^https?:$/.test(protocol)) return route.continue();
    return route.abort('blockedbyclient');
  });
  await mockApi(page, {
    session: state.session,
    extra: {
      '/api/auth/session': (route) => route.fulfill({ json: state.session }),
      '/api/auth/login': (route) => {
        state.loginCount += 1;
        state.session = { ...SESSAO_ATIVA };
        return route.fulfill({ json: state.session });
      },
      '/api/auth/logout': (route) => {
        state.session = { ...SESSAO_ANONIMA };
        state.logoutCount += 1;
        return route.fulfill({ json: { ok: true } });
      },
      '/api/library-sync': async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (!state.session.active) return route.fulfill({ status: 401, json: { error: 'Entre na conta.' } });
        if (!state.online) return route.fulfill({ status: 503, json: { error: BOOT_OFFLINE_MESSAGE } });
        if (url.searchParams.has('asset')) {
          state.missingAssetCount += 1;
          return route.fulfill({ status: 404, json: { error: 'Asset não encontrado.' } });
        }
        if (url.searchParams.get('full') === '1') {
          state.pullCount += 1;
          if (pullDelay) await new Promise((resolve) => setTimeout(resolve, pullDelay));
          return route.fulfill({ json: { ok: true, manifest: state.manifest } });
        }
        const body = request.method() === 'POST' ? request.postDataJSON() : {};
        if (body.action === 'push') {
          state.pushCount += 1;
          if (pushDelay) await new Promise((resolve) => setTimeout(resolve, pushDelay));
          // Mesmo contrato da store: união por id, versão mais recente vence.
          const docs = new Map(state.manifest.docs.map((entry) => [entry.id, entry]));
          for (const entry of body.manifest.docs || []) {
            const previous = docs.get(entry.id);
            if (!previous || Number(entry.updatedAt || 0) >= Number(previous.updatedAt || 0)) docs.set(entry.id, entry);
          }
          const deletedIds = [...new Set([...(state.manifest.deletedIds || []), ...(body.manifest.deletedIds || [])])];
          for (const id of deletedIds) docs.delete(id);
          state.manifest = {
            ...state.manifest,
            ...body.manifest,
            docs: [...docs.values()],
            deletedIds,
            revision: state.manifest.revision + 1,
            updatedAt: Date.now(),
          };
          return route.fulfill({ json: {
            ok: true,
            revision: state.manifest.revision,
            updatedAt: state.manifest.updatedAt,
            projectCount: state.manifest.docs.length,
            assetIds: state.manifest.assetIds,
          } });
        }
        if (String(body.action).toLowerCase() === 'putasset') return route.fulfill({ json: { ok: true, assetId: body.assetId } });
        return route.fulfill({ json: {
          ok: true,
          empty: false,
          meta: {
            revision: state.manifest.revision,
            updatedAt: state.manifest.updatedAt,
            projectCount: state.manifest.docs.length,
            assetIds: state.manifest.assetIds,
          },
        } });
      },
    },
  });
  return state;
}

async function seedOneProject(page) {
  await page.addInitScript(({ project, brand, owner }) => {
    // Nunca resemear no reload: as asserções seguintes examinam o que o app salvou.
    if (sessionStorage.getItem('e2e-cloud-library-seeded')) return;
    sessionStorage.setItem('e2e-cloud-library-seeded', '1');
    localStorage.setItem('vc_library', JSON.stringify([project]));
    localStorage.setItem('vc_brands', JSON.stringify([brand]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(project.id));
    localStorage.setItem('vc_active_brand_id', JSON.stringify(brand.id));
    localStorage.setItem('vc_data_owner', JSON.stringify(owner));
    localStorage.setItem('vc_shell_view', JSON.stringify('home'));
  }, {
    project: projectFixtures()[0],
    brand: BRAND,
    owner: `email:${SESSAO_ATIVA.email}`,
  });
}

async function expectStoredProjects(page) {
  await expect.poll(() => page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem('vc_library') || '[]');
    return library.map((entry) => entry.name).sort();
  }).catch((error) => {
    // Login explícito troca a conta via navegação; repetir durante essa transição.
    if (/Execution context was destroyed/.test(error.message)) return [];
    throw error;
  }), { timeout: 15_000 }).toEqual([...PROJECT_NAMES].sort());
}

async function expectHomeProjects(page, { stored = true } = {}) {
  await expect(page.getByRole('button', { name: 'Sync na nuvem', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Abrir Clínica / })).toHaveCount(5);
  for (const name of PROJECT_NAMES) {
    await expect(page.getByRole('button', { name: `Abrir ${name}`, exact: true })).toBeVisible();
  }
  if (stored) await expectStoredProjects(page);
}

async function goHome(page) {
  if (await page.getByRole('button', { name: 'Sync na nuvem', exact: true }).isVisible()) return;
  // Em 1280px o header esconde Projetos; Perfil permanece e abre a mesma Home.
  await page.getByRole('button', { name: 'Perfil', exact: true }).first().click();
  await page.getByRole('button', { name: 'Projetos', exact: true }).first().click();
}

test.describe('Biblioteca da conta: nuvem → React → lista', () => {
  test.setTimeout(60_000);
  const runtimeErrors = new WeakMap();
  test.beforeEach(({ page }) => {
    const errors = [];
    runtimeErrors.set(page, errors);
    page.on('pageerror', (error) => errors.push(error.message));
  });
  test.afterEach(({ page }) => {
    expect(runtimeErrors.get(page), 'nenhuma exceção JavaScript no fluxo de sync').toEqual([]);
  });

  test('boot de conta com 1 projeto sem metadados de sync mostra os 5 da nuvem sem clique manual', async ({ page }) => {
    const cloud = await mockCloud(page);
    await seedOneProject(page);
    await page.goto('/?app=1');
    await expectHomeProjects(page);
    expect(cloud.pushCount).toBeGreaterThan(0);
    expect(cloud.pullCount).toBeGreaterThan(0);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expectStoredProjects(page);
  });

  test('Sync une 1 projeto local aos 5 da nuvem e pagehide/refresh conservam a lista', async ({ page }, testInfo) => {
    const cloud = await mockCloud(page, { offlineAtBoot: true });
    await seedOneProject(page);
    await page.goto('/?app=1');
    await expect(page.getByText(BOOT_OFFLINE_MESSAGE, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Abrir Clínica / })).toHaveCount(1);

    cloud.online = true;
    await page.getByRole('button', { name: 'Sync na nuvem', exact: true }).click();
    try {
      await expectHomeProjects(page);
    } catch (error) {
      await testInfo.attach('estado-local-e-nuvem-apos-sync', {
        body: Buffer.from(JSON.stringify({
          cloud: cloud.manifest,
          local: await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]')),
        }, null, 2)),
        contentType: 'application/json',
      });
      throw error;
    }
    expect(cloud.pushCount).toBeGreaterThan(0);
    expect(cloud.pullCount).toBeGreaterThan(0);
    expect(cloud.manifest.docs).toHaveLength(5);
    expect(cloud.missingAssetCount).toBeGreaterThan(0);

    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expectStoredProjects(page);
    await page.reload();
    await expectHomeProjects(page);
    const screenshotPath = testInfo.outputPath('biblioteca-com-os-cinco-projetos.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach('biblioteca-com-os-cinco-projetos', {
      path: screenshotPath,
      contentType: 'image/png',
    });
  });

  test('Salvar no editor traz os 5 projetos e mantém o projeto aberto após refresh', async ({ page }) => {
    const cloud = await mockCloud(page, { offlineAtBoot: true });
    await seedOneProject(page);
    await page.goto('/?app=1');
    await expect(page.getByText(BOOT_OFFLINE_MESSAGE, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /continuar no editor/i }).click();
    cloud.online = true;

    await page.getByRole('button', { name: /salvar projeto agora/i }).click();
    await expectStoredProjects(page);
    await expect(page.getByRole('button', { name: /salvar projeto agora/i })).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expectStoredProjects(page);
    await page.reload();
    await expect(page.getByRole('button', { name: /salvar projeto agora/i })).toBeVisible();
    await goHome(page);
    await expectHomeProjects(page);
    expect(cloud.manifest.docs).toHaveLength(5);
  });

  test('login num browser vazio restaura 5 projetos e textos apesar do asset 404', async ({ page }) => {
    const cloud = await mockCloud(page);
    // Cada teste Playwright usa um contexto novo; nenhum cofre/localStorage prévio.
    await page.goto('/?app=1&login=password');
    await expectStoredProjects(page);
    await goHome(page);
    await expectHomeProjects(page);
    expect(cloud.missingAssetCount).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Abrir Clínica Horizonte', exact: true }).click();
    await expect(page.getByText('Comunicação da Clínica Horizonte', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Texto preservado do projeto 3.', { exact: true }).first()).toBeVisible();
    await page.reload();
    await expectStoredProjects(page);
  });

  test('Salvar logo após editar o título cancela autosave pendente durante sync lento', async ({ page }) => {
    const cloud = await mockCloud(page, { offlineAtBoot: true, pushDelay: 500, pullDelay: 1000 });
    await seedOneProject(page);
    await page.goto('/?app=1');
    await expect(page.getByText(BOOT_OFFLINE_MESSAGE, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /continuar no editor/i }).click();
    await page.getByRole('tab', { name: 'Narrativa', exact: true }).click();
    await page.getByRole('button', { name: /editar card/i }).first().click();
    const title = page.getByText('Título', { exact: true }).first().locator('xpath=following::textarea[1]');
    const editedTitle = 'Clínica Janine: cuidado que acompanha você';
    await expect(title).toHaveValue('Comunicação da Clínica Janine');
    await page.evaluate(() => {
      window.__syncEditTiming = {};
      document.addEventListener('input', () => { window.__syncEditTiming.input = performance.now(); });
      document.addEventListener('click', (event) => {
        if (event.target.closest('[aria-label="Salvar projeto agora"]')) window.__syncEditTiming.save = performance.now();
      }, true);
    });
    cloud.online = true;
    await title.fill(editedTitle);
    await page.getByRole('button', { name: /salvar projeto agora/i }).click();
    expect(await page.evaluate(() => window.__syncEditTiming.save - window.__syncEditTiming.input)).toBeLessThan(400);
    await expect(page.getByText(/Lista sincronizada: 5 projeto\(s\)/)).toBeVisible();
    await expect(page.getByText(/biblioteca mudou durante a sincronização/i)).toHaveCount(0);
    await expectStoredProjects(page);
    expect(cloud.manifest.docs.find((entry) => entry.id === 'cloud-clinic-1').doc.slides[0].title).toBe(editedTitle);
    await goHome(page);
    await expectHomeProjects(page);
    await page.reload();
    await expectHomeProjects(page);
    const storedTitle = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library'))
      .find((entry) => entry.id === 'cloud-clinic-1').doc.slides[0].title);
    expect(storedTitle).toBe(editedTitle);
  });

  test('quota ao aplicar pull atualiza a UI com 5 projetos e avisa que a cópia local não foi gravada', async ({ page }) => {
    const cloud = await mockCloud(page, { offlineAtBoot: true });
    await seedOneProject(page);
    await page.goto('/?app=1');
    await expect(page.getByText(BOOT_OFFLINE_MESSAGE, { exact: true })).toBeVisible();
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key, value) {
        if (key === 'vc_library' && JSON.parse(value).length > 1) {
          throw new DOMException('E2E: quota durante restore da biblioteca', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    });
    cloud.online = true;
    await page.getByRole('button', { name: 'Sync na nuvem', exact: true }).click();
    await expect(page.getByText(/Lista atualizada: 5 projeto\(s\).*navegador continua sem espaço para a cópia local/)).toBeVisible();
    await expect(page.getByText(/Sincronização incompleta:/)).toHaveCount(0);
    await expectHomeProjects(page, { stored: false });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library')).map((entry) => entry.name)))
      .toEqual(['Clínica Janine']);
    expect(cloud.manifest.docs).toHaveLength(5);
    expect(cloud.pullCount).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Sync na nuvem', exact: true })).toBeEnabled();
  });

  test('Salvar envia o título recém-editado mesmo com library sempre sem espaço e mostra a união na UI', async ({ page }) => {
    const cloud = await mockCloud(page, { offlineAtBoot: true });
    await seedOneProject(page);
    await page.goto('/?app=1');
    await expect(page.getByText(BOOT_OFFLINE_MESSAGE, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /continuar no editor/i }).click();
    await page.getByRole('tab', { name: 'Narrativa', exact: true }).click();
    await page.getByRole('button', { name: /editar card/i }).first().click();
    const title = page.getByText('Título', { exact: true }).first().locator('xpath=following::textarea[1]');
    await expect(title).toHaveValue('Comunicação da Clínica Janine');
    const keepLibraryFull = () => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key, value) {
        if (this === localStorage && key === 'vc_library') {
          throw new DOMException('E2E: library sempre sem espaço', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    };
    await page.evaluate(keepLibraryFull);
    await page.addInitScript(keepLibraryFull);
    const editedTitle = 'Clínica Janine: sua pele, seu cuidado de verdade';
    await title.fill(editedTitle);
    cloud.online = true;
    await page.getByRole('button', { name: /salvar projeto agora/i }).click();
    await expect(page.getByText(/Lista atualizada: 5 projeto\(s\).*navegador continua sem espaço para a cópia local/)).toBeVisible();
    expect(cloud.manifest.docs.find((entry) => entry.id === 'cloud-clinic-1').doc.slides[0].title).toBe(editedTitle);
    expect(cloud.manifest.docs).toHaveLength(5);
    expect(cloud.pullCount).toBeGreaterThan(0);
    const cached = await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library')));
    expect(cached).toHaveLength(1);
    expect(cached[0].doc.slides[0].title).toBe('Comunicação da Clínica Janine');
    await expect(title).toHaveValue(editedTitle);
    await goHome(page);
    await expectHomeProjects(page, { stored: false });
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect(page.getByRole('button', { name: /^Abrir Clínica / })).toHaveCount(5);
    expect(cloud.manifest.docs.find((entry) => entry.id === 'cloud-clinic-1').doc.slides[0].title).toBe(editedTitle);
    await page.reload();
    await expectHomeProjects(page, { stored: false });
    await expect(page.getByText(/Biblioteca sincronizada: 5 projeto\(s\).*navegador continua sem espaço/)).toBeVisible();
    await page.getByRole('button', { name: 'Abrir Clínica Janine', exact: true }).click();
    await expect(page.getByText(editedTitle, { exact: true }).first()).toBeVisible();
    // Dê ao autosave e ao auto-push reais um ciclo completo: nenhum deles pode
    // promover o texto velho do cache à versão mais recente da nuvem.
    const pushesAfterRestore = cloud.pushCount;
    await expect.poll(() => cloud.pushCount, { timeout: 10_000 }).toBeGreaterThan(pushesAfterRestore);
    expect(cloud.manifest.docs.find((entry) => entry.id === 'cloud-clinic-1').doc.slides[0].title).toBe(editedTitle);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library'))[0].doc.slides[0].title))
      .toBe('Comunicação da Clínica Janine');
  });

  test('logout com todos os destinos indisponíveis mantém a conta e a edição', async ({ page }) => {
    const cloud = await mockCloud(page, { offlineAtBoot: true });
    await seedOneProject(page);
    await page.goto('/?app=1');
    await expect(page.getByText(BOOT_OFFLINE_MESSAGE, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /continuar no editor/i }).click();
    await page.getByRole('tab', { name: 'Narrativa', exact: true }).click();
    await page.getByRole('button', { name: /editar card/i }).first().click();
    const title = page.getByText('Título', { exact: true }).first().locator('xpath=following::textarea[1]');
    await expect(title).toHaveValue('Comunicação da Clínica Janine');
    await page.evaluate(() => {
      const open = indexedDB.open.bind(indexedDB);
      indexedDB.open = function(name, ...args) {
        if (name === 'viral-carrossel-account-vault') throw new DOMException('E2E: cofre indisponível', 'SecurityError');
        return open(name, ...args);
      };
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key, value) {
        if (this === localStorage && ['vc_library', 'vc_account_vault'].includes(key)) {
          throw new DOMException('E2E: cache e cofre sem espaço', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    });
    const editedTitle = 'Uma edição que precisa continuar protegida';
    await title.fill(editedTitle);
    await page.getByRole('button', { name: 'Perfil', exact: true }).first().click();
    await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    await expect(page.getByText(/últimas alterações ainda não estão protegidas.*Você continua na conta/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sair da conta', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\?app=1/);
    expect(cloud.logoutCount).toBe(0);
    expect(cloud.session.active).toBe(true);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vc_data_owner')))).toBe(`email:${SESSAO_ATIVA.email}`);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library')).map((entry) => entry.id)))
      .toEqual(['cloud-clinic-1']);
    await page.getByRole('button', { name: 'Projetos', exact: true }).first().click();
    await page.getByRole('button', { name: /continuar no editor/i }).click();
    await page.getByRole('tab', { name: 'Narrativa', exact: true }).click();
    if (!(await title.isVisible())) await page.getByRole('button', { name: /editar card/i }).first().click();
    await expect(title).toHaveValue(editedTitle);
    await title.fill(`${editedTitle} — e continua editável`);
    await expect(title).toHaveValue(`${editedTitle} — e continua editável`);
    expect(cloud.logoutCount).toBe(0);
  });

  for (const quotaPersists of [false, true]) test(`quota com 23 cards recupera edição e fotos sem nuvem; quota persistente: ${quotaPersists}`, async ({ page }, testInfo) => {
    const cloud = await mockCloud(page, { offlineAtBoot: true });
    await seedOneProject(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('e2e-23-cards')) return;
      sessionStorage.setItem('e2e-23-cards', '1');
      const library = JSON.parse(localStorage.getItem('vc_library'));
      const original = library[0].doc.slides[0];
      library[0].doc.slides = Array.from({ length: 23 }, (_, i) => ({
        ...original, id: i ? `photo-${i}` : original.id, num: i + 1,
        title: i ? `Texto do card ${i + 1}` : original.title,
        bgImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
      }));
      localStorage.setItem('vc_library', JSON.stringify(library));
    });
    await page.goto('/?app=1');
    await expect(page.getByText(BOOT_OFFLINE_MESSAGE, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /continuar no editor/i }).click();
    await page.getByRole('tab', { name: 'Narrativa', exact: true }).click();
    await page.getByRole('button', { name: /editar card/i }).first().click();
    const title = page.getByText('Título', { exact: true }).first().locator('xpath=following::textarea[1]');
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (this === localStorage && ['vc_library', 'vc_account_vault'].includes(key)) {
          throw new DOMException('E2E: localStorage cheio', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    });
    if (quotaPersists) await page.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (this === localStorage && ['vc_library', 'vc_account_vault'].includes(key)) {
          throw new DOMException('E2E: quota continua cheia após login', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    });
    const editedTitle = 'Edição final que não coube no armazenamento antigo';
    await title.fill(editedTitle);
    await page.getByRole('button', { name: 'Perfil', exact: true }).first().click();
    await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    await expect.poll(() => cloud.logoutCount, { timeout: 20_000 }).toBe(1);
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => localStorage.getItem('vc_library'))).toBeNull();
    cloud.session = { ...SESSAO_ATIVA };
    await page.goto('/?app=1&login=password');
    await expect(page.getByRole('button', { name: /continuar no editor/i })).toBeVisible();
    const restored = await page.evaluate(async (owner) => {
      const library = await new Promise((resolve, reject) => {
        const req = indexedDB.open('viral-carrossel-account-vault', 1);
        req.onsuccess = () => {
          const db = req.result;
          const read = db.transaction('accounts').objectStore('accounts').get('vault');
          read.onsuccess = () => { db.close(); resolve(JSON.parse(read.result[owner].keys.vc_library)); };
          read.onerror = () => { db.close(); reject(read.error); };
        };
        req.onerror = () => reject(req.error);
      });
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('viral-carrossel-img', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const slides = library[0].doc.slides;
      const photos = await Promise.all(slides.map(slide => new Promise((resolve, reject) => {
        const req = db.transaction('images').objectStore('images').get(slide.bgImageId);
        req.onsuccess = () => resolve(req.result?.blob?.size > 0);
        req.onerror = () => reject(req.error);
      })));
      db.close();
      return { count: slides.length, title: slides[0].title, photos };
    }, `email:${SESSAO_ATIVA.email}`);
    expect(restored).toEqual({ count: 23, title: editedTitle, photos: Array(23).fill(true) });
    await page.reload();
    // Com cache disponível, o boot já pode reabrir o editor restaurado.
    const continueEditing = page.getByRole('button', { name: /continuar no editor/i });
    await expect(continueEditing.or(page.getByRole('button', { name: 'Salvar projeto agora', exact: true }))).toBeVisible();
    if (quotaPersists) expect(await page.evaluate(() => localStorage.getItem('vc_library'))).toBeNull();
    else expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vc_library'))[0].doc.slides[0].title)).toBe(editedTitle);
    if (await continueEditing.isVisible()) await continueEditing.click();
    await expect(page.locator('main [data-vc-card-surface]')).toHaveCount(23);
    await expect(page.locator('main').getByText(editedTitle, { exact: true }).first()).toBeVisible();
    await expect.poll(() => page.locator('main [data-vc-card-surface]').first().evaluate(el =>
      [...el.querySelectorAll('*')].some(child => /url\(/.test(child.style.backgroundImage)))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('logout-quota-recuperado.png') });
  });

  test('formulário de login na landing restaura os 5 projetos e habilita ações da conta', async ({ page }) => {
    const cloud = await mockCloud(page, { anonymous: true });
    await page.goto('/?landing=1');
    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Entrar no studio' });
    await dialog.getByLabel('E-mail', { exact: true }).fill(SESSAO_ATIVA.email);
    await dialog.getByLabel('Senha', { exact: true }).fill('SenhaApenasParaEsteTeste123!');
    await dialog.locator('form').getByRole('button', { name: 'Entrar', exact: true }).click();
    await expectHomeProjects(page);
    expect(cloud.loginCount).toBe(1);
    expect(cloud.pullCount).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Sync na nuvem', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: /continuar no editor/i })).toBeEnabled();
    await page.reload();
    await expectHomeProjects(page);
  });

  test('logout e novo login recuperam os 5 projetos da mesma conta', async ({ page }) => {
    const cloud = await mockCloud(page);
    await page.goto('/?app=1&login=password');
    await expectStoredProjects(page);
    await goHome(page);
    await expectHomeProjects(page);

    await page.getByRole('button', { name: /^Perfil$/i }).first().click();
    await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    await expect.poll(() => cloud.logoutCount).toBe(1);
    await expect(page).toHaveURL(/\/$/);
    expect(cloud.manifest.docs).toHaveLength(5);
    expect(await page.evaluate(() => localStorage.getItem('vc_library'))).toBeNull();

    cloud.session = { ...SESSAO_ATIVA };
    await page.goto('/?app=1&login=password');
    await expectStoredProjects(page);
    await goHome(page);
    await expectHomeProjects(page);
    await page.reload();
    await goHome(page);
    await expectHomeProjects(page);
  });

  for (const quota of [false, true]) test(`excluir rascunhos mantém apenas Janine com 23 cards após sync e novo login; quota: ${quota}`, async ({ page }) => {
    const cloud = await mockCloud(page);
    const janine = cloud.manifest.docs[0];
    janine.name = 'CLINICA JANINE ARAUJO';
    janine.doc.slides = Array.from({ length: 23 }, (_, index) => ({
      id: `janine-${index}`, num: index + 1, title: `Janine — card ${index + 1}`,
    }));
    await page.goto('/?app=1');
    await expect(page.getByRole('button', { name: 'Abrir CLINICA JANINE ARAUJO', exact: true })).toBeVisible();
    // O cofre antigo tem os cinco projetos: a exclusão precisa vencer esse backup.
    await page.getByRole('button', { name: 'Sync na nuvem', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sync na nuvem', exact: true })).toBeEnabled();
    if (quota) await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (this === localStorage && key === 'vc_library_deleted_ids') throw new DOMException('quota', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    for (const name of PROJECT_NAMES.slice(1)) {
      await page.getByRole('button', { name: `Apagar ${name}`, exact: true }).click();
      await page.getByRole('button', { name: 'Confirmar eliminação', exact: true }).click();
      await expect(page.getByRole('button', { name: `Abrir ${name}`, exact: true })).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'Sync na nuvem', exact: true }).click();
    await expect.poll(() => cloud.manifest.docs.map(entry => entry.id)).toEqual([janine.id]);
    await expect(page.getByRole('button', { name: 'Sync na nuvem', exact: true })).toBeEnabled();
    // Outro save sem novas exclusões não pode apagar o registro delas.
    await page.getByRole('button', { name: 'Sync na nuvem', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sync na nuvem', exact: true })).toBeEnabled();
    expect(cloud.manifest.deletedIds).toHaveLength(4);
    await page.reload();
    await goHome(page);
    for (const name of PROJECT_NAMES.slice(1)) await expect(page.getByRole('button', { name: `Abrir ${name}`, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Perfil', exact: true }).first().click();
    await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    await expect.poll(() => cloud.logoutCount).toBe(1);
    await expect(page).toHaveURL(/\/$/);
    cloud.session = { ...SESSAO_ATIVA };
    await page.goto('/?app=1&login=password');
    await expect.poll(() => page.evaluate(() => {
      const library = JSON.parse(localStorage.getItem('vc_library') || '[]');
      return library.map(entry => ({ id: entry.id, count: entry.doc.slides.length }));
    }).catch((error) => {
      if (/Execution context was destroyed/.test(error.message)) return [];
      throw error;
    })).toEqual([{ id: janine.id, count: 23 }]);
    await goHome(page);
    await expect(page.getByRole('button', { name: 'Abrir CLINICA JANINE ARAUJO', exact: true })).toBeVisible();
    for (const name of PROJECT_NAMES.slice(1)) await expect(page.getByRole('button', { name: `Abrir ${name}`, exact: true })).toHaveCount(0);
    expect(cloud.manifest.docs[0].doc.slides).toHaveLength(23);
  });
});
