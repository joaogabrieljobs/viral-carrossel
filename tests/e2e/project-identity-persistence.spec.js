import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

const slide = (id) => ({
  id,
  num: 1,
  title: 'Seu título aqui',
  subtitle: 'Subtítulo descritivo que reforça o gancho principal do carrossel.',
});

const doc = (brand, prompt = '') => ({
  brand,
  slides: [slide(`slide-${brand.id}-${prompt || 'vazio'}`)],
  quickPromptDraft: prompt,
  styleKit: { stylePrompt: '', contextMd: '', refImages: [], logoOnGenerate: true },
});

async function enter(page) {
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click({ force: true });
}

test('pedido rápido pertence ao projeto e volta após trocar de projeto', async ({ page }) => {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(({ projects }) => {
    localStorage.setItem('vc_library', JSON.stringify(projects));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('project-a'));
    localStorage.setItem('vc_brands', JSON.stringify([{ id: 'brand-a', name: 'Marca A' }]));
    localStorage.setItem('vc_active_brand_id', JSON.stringify('brand-a'));
    localStorage.setItem('vc_shell_view', JSON.stringify('home'));
  }, {
    projects: [
      { id: 'project-a', name: 'Projeto A', doc: doc({ id: 'brand-a', name: 'Marca A' }, 'Pedido inicial A') },
      { id: 'project-b', name: 'Projeto B', doc: doc({ id: 'brand-b', name: 'Marca B' }, 'Pedido inicial B') },
    ],
  });
  await enter(page);

  const prompt = page.getByLabel('Pedido para gerar carrossel', { exact: true });
  await expect(prompt).toHaveValue('Pedido inicial A');
  await prompt.fill('Pedido editado e salvo em A');
  await expect.poll(async () => page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('vc_library') || '[]');
    return projects.find((item) => item.id === 'project-a')?.doc?.quickPromptDraft;
  })).toBe('Pedido editado e salvo em A');

  await page.getByRole('button', { name: /abrir biblioteca/i }).first().click({ force: true });
  await page.getByRole('dialog', { name: /biblioteca de carrosséis/i })
    .getByRole('button', { name: 'Abrir Projeto B', exact: true }).click();
  await page.getByRole('tab', { name: /^Home$/i }).first().click();
  await expect(prompt).toHaveValue('Pedido inicial B');

  await page.getByRole('button', { name: /abrir biblioteca/i }).first().click({ force: true });
  await page.getByRole('dialog', { name: /biblioteca de carrosséis/i })
    .getByRole('button', { name: 'Abrir Projeto A', exact: true }).click();
  await page.getByRole('tab', { name: /^Home$/i }).first().click();
  await expect(prompt).toHaveValue('Pedido editado e salvo em A');
});

test('logo base64 antiga sai do localStorage e ganha ID durável no perfil e projeto', async ({ page }) => {
  const portableLogo = `data:image/png;base64,${PNG}`;
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(({ portableLogo }) => {
    const brand = { id: 'legacy-brand', name: 'Marca antiga', logo: portableLogo };
    localStorage.setItem('vc_brands', JSON.stringify([brand]));
    localStorage.setItem('vc_active_brand_id', JSON.stringify('legacy-brand'));
    localStorage.setItem('vc_library', JSON.stringify([{
      id: 'legacy-project',
      name: 'Projeto antigo',
      doc: {
        brand,
        slides: [{ id: 'legacy-slide', num: 1, title: 'Seu título aqui', subtitle: '' }],
        styleKit: { stylePrompt: '', contextMd: '', refImages: [], logoOnGenerate: true },
      },
    }]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('legacy-project'));
  }, { portableLogo });
  await enter(page);

  await expect.poll(async () => page.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem('vc_brands') || '[]')[0];
    const project = JSON.parse(localStorage.getItem('vc_library') || '[]')[0];
    return {
      profileId: profile?.logoImageId || '',
      profileHasBase64: String(profile?.logo || '').startsWith('data:image/'),
      projectId: project?.doc?.brand?.logoImageId || '',
      projectHasBase64: String(project?.doc?.brand?.logo || '').startsWith('data:image/'),
    };
  })).toMatchObject({
    profileId: expect.stringMatching(/^img_/),
    profileHasBase64: false,
    projectId: expect.stringMatching(/^img_/),
    projectHasBase64: false,
  });
});

test('importação v2 não mistura marcas diferentes que usavam o mesmo id default', async ({ page }) => {
  await mockApi(page, { session: SESSAO_ATIVA });
  await enter(page);
  await page.getByRole('button', { name: /abrir biblioteca/i }).first().click({ force: true });

  const legacyBackup = {
    vcVersion: 2,
    folders: [],
    docs: [
      { id: 'old-a', name: 'Legado A', doc: doc({ id: 'default', name: 'Marca A', bio: 'Bio exclusiva A' }) },
      { id: 'old-b', name: 'Legado B', doc: doc({ id: 'default', name: 'Marca B', bio: 'Bio exclusiva B' }) },
    ],
  };
  await page.locator('input[accept=".json,application/json"]')
    .setInputFiles({
      name: 'backup-v2.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(legacyBackup)),
    });

  await expect.poll(async () => page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('vc_library') || '[]');
    return projects.filter((item) => ['Legado A', 'Legado B'].includes(item.name)).length;
  })).toBe(2);
  const imported = await page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('vc_library') || '[]');
    return projects
      .filter((item) => ['Legado A', 'Legado B'].includes(item.name))
      .map((item) => ({ name: item.name, brandId: item.doc.brand.id, bio: item.doc.brand.bio }));
  });
  expect(new Set(imported.map((item) => item.brandId)).size).toBe(2);
  expect(imported.find((item) => item.name === 'Legado A')?.bio).toBe('Bio exclusiva A');
  expect(imported.find((item) => item.name === 'Legado B')?.bio).toBe('Bio exclusiva B');
});

test('apagar links e legendas do DNA persiste o estado vazio', async ({ page }) => {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(({ project }) => {
    // addInitScript roda novamente em cada reload. Use sessionStorage para
    // preparar o legado apenas uma vez e então validar o que o app persistiu.
    if (sessionStorage.getItem('vc-test-dna-seeded') === '1') return;
    localStorage.setItem('vc_library', JSON.stringify([project]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(project.id));
    localStorage.setItem('vc_brands', JSON.stringify([project.doc.brand]));
    localStorage.setItem('vc_active_brand_id', JSON.stringify(project.doc.brand.id));
    localStorage.setItem('vc_shell_view', JSON.stringify('home'));
    sessionStorage.setItem('vc-test-dna-seeded', '1');
  }, {
    project: {
      id: 'dna-project',
      name: 'DNA salvo',
      doc: doc({
        id: 'dna-brand',
        name: 'DNA Brand',
        voiceSourceUrls: ['https://instagram.com/dna-brand'],
        voiceSampleText: 'Legenda antiga que precisa poder ser removida.',
      }),
    },
  });
  await enter(page);
  await page.getByRole('button', { name: /Usar publicações para extrair o DNA/i }).click();
  const links = page.getByLabel('Links do perfil e das publicações');
  const samples = page.getByLabel('Legendas publicadas (recomendado)');
  await expect(links).toHaveValue('https://instagram.com/dna-brand');
  await expect(samples).toHaveValue('Legenda antiga que precisa poder ser removida.');
  await links.fill('');
  await samples.fill('');
  await page.getByText(/Ideia → carrossel da sua marca/i).click();

  await expect.poll(async () => page.evaluate(() => {
    const project = JSON.parse(localStorage.getItem('vc_library') || '[]')[0];
    const profile = JSON.parse(localStorage.getItem('vc_brands') || '[]')
      .find((item) => item.id === 'dna-brand');
    return {
      urls: project?.doc?.brand?.voiceSourceUrls,
      samples: project?.doc?.brand?.voiceSampleText,
      profileUrls: profile?.voiceSourceUrls,
      profileSamples: profile?.voiceSampleText,
    };
  })).toEqual({ urls: [], samples: '', profileUrls: [], profileSamples: '' });

  await page.reload();
  const continueButton = page.getByRole('button', { name: /continuar no editor/i });
  if (await continueButton.isVisible().catch(() => false)) await continueButton.click({ force: true });
  await page.getByRole('button', { name: /Usar publicações para extrair o DNA/i }).click();
  await expect(page.getByLabel('Links do perfil e das publicações')).toHaveValue('');
  await expect(page.getByLabel('Legendas publicadas (recomendado)')).toHaveValue('');
});
