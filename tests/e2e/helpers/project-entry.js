import { expect } from '@playwright/test';

/** Navigate the same two-choice entry a user sees, without seeding or changing
 * application state. Existing editor regression fixtures choose their active
 * project; tests that care about a particular project can provide its name. */
export async function openProjectLibrary(page) {
  const home = page.locator('[data-vc-tour="account-home"]');
  await expect(home).toBeVisible();
  const library = page.getByRole('region', { name: 'Lista de projetos', exact: true });
  if (await library.isVisible()) return library;
  const open = home.getByRole('button', { name: 'Abrir um projeto', exact: true });
  if (!await open.isVisible()) await home.getByRole('button', { name: 'Início', exact: true }).click();
  await open.click();
  await expect(library).toBeVisible();
  return library;
}

export async function enterEditorFromHome(page, projectName) {
  const library = await openProjectLibrary(page);
  if (projectName) {
    await library.getByRole('button', { name: `Abrir ${projectName}`, exact: true }).first().click();
  } else {
    const projects = library.getByTitle('Abrir projeto no editor', { exact: true });
    await expect(projects.first()).toBeVisible();
    const current = projects.filter({ has: page.locator('span').filter({ hasText: /^atual$/ }) });
    await (await current.count() ? current.first() : projects.first()).click();
  }
  await expect(page.locator('[data-vc-tour="account-home"]')).toHaveCount(0);
}

/** Explicit opt-in for regression scenarios about professional tools.
 * Quick-mode and onboarding tests never change mode through entry defaults. */
export async function selectEditorMode(page, mode) {
  const labels = { criador: 'Criar rápido', diretor: 'Controle profissional', studio: 'Studio' };
  const label = labels[mode];
  if (!label) throw new Error(`Modo de teste inválido: ${mode}`);
  const current = page.getByRole('button', { name: /^Modo atual:/ });
  if ((await current.getAttribute('aria-label'))?.startsWith(`Modo atual: ${label}.`)) return;
  await current.click();
  await page.getByRole('menuitem', { name: new RegExp(`^${label}`) }).click();
  await expect(current).toHaveAttribute('aria-label', `Modo atual: ${label}. Clique para mudar.`);
}

/** Create a small synthetic project through the public wizard. AI is mocked
 * only for this action; existing test handlers resume when creation finishes. */
export async function createTextProject(page, { name = 'Projeto novo', newBrand, beforeGenerate } = {}) {
  const completion = value => ({ choices: [{ message: { content: JSON.stringify(value) } }] });
  const ai = route => {
    const payload = route.request().postDataJSON()?.payload;
    const prompt = payload?.messages?.find(message => message.role === 'user')?.content || '';
    return route.fulfill({ json: completion(prompt.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : {
      slides: [{ title:`Conteúdo de ${name}`, subtitle:'Uma orientação concreta para colocar a ideia em prática.', bodyAfterImage:'', imageQuery:'' }],
      caption:'Um próximo passo para começar.',
    }) });
  };
  await page.route('**/api/ai/compatible', ai);
  try {
    const home = page.locator('[data-vc-tour="account-home"]');
    await expect(home).toBeVisible();
    const create = page.getByRole('button', { name:'Criar um projeto', exact:true });
    if (!await create.isVisible()) await home.getByRole('button', { name:'Início', exact:true }).click();
    await create.click();
    const flow = page.getByRole('region', { name:'Criar novo projeto', exact:true });
    const next = () => flow.getByRole('button', { name:'Continuar', exact:true }).click();
    await flow.getByLabel(/^Nome do projeto/).fill(name);
    await next();
    if (newBrand) {
      await flow.getByRole('radio', { name:/^Personalizar agora/ }).click();
      await flow.getByLabel(/^Marca deste projeto/).selectOption('__new__');
      await flow.getByLabel(/^Nome da nova marca/).fill(newBrand);
    } else {
      await flow.getByRole('radio', { name:/^Seguir com o padrão do Moont/ }).click();
    }
    await next();
    await flow.getByLabel(/^Sobre o que vamos criar/).fill('Explique uma orientação prática para o público do projeto.');
    await next();
    await flow.getByRole('radio', { name:/^Seguir meu pedido/ }).click();
    await next();
    await flow.getByLabel('Quantidade de cards', { exact:true }).fill('1');
    await next();
    await flow.getByRole('radio', { name:/^Criar o texto primeiro/ }).click();
    await next();
    if (beforeGenerate) await beforeGenerate(flow);
    await flow.getByRole('button', { name:/^Criar e gerar 1 cards?$/ }).click();
    await expect(flow).toHaveCount(0, { timeout:20_000 });
    await expect(page.locator('#vc-cards-viewport')).toBeVisible();
  } finally {
    await page.unroute('**/api/ai/compatible', ai);
  }
}
