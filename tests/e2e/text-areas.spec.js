import { enterEditorFromHome } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const PROJECT_ID = 'text-areas-project';
const FIRST_CARD = 'text-areas-card-1';
const SECOND_CARD = 'text-areas-card-2';

async function openProject(page, width = 1680, photoRegion = 'full') {
  await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(({ projectId, cardIds, photoRegion }) => {
    // Um reload deve recuperar o que foi editado, sem reaplicar a fixture.
    if (localStorage.getItem('vc_text_areas_e2e_seeded')) return;
    localStorage.setItem('vc_text_areas_e2e_seeded', '1');
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(projectId));
    localStorage.setItem('vc_library', JSON.stringify([{
      id: projectId,
      name: 'Áreas de texto independentes',
      doc: {
        creativePreset: 'livre',
        brand: {
          name: 'MUSA', bg: '#101118', titleColor: '#ffffff',
          textColor: '#ffffff', accent: '#b7e56b',
          titleFont: 'Arial, sans-serif', bodyFont: 'Arial, sans-serif',
          subtitleVisible: true, showHandle: false,
        },
        slides: cardIds.map((id, index) => ({
          id, num: index + 1,
          title: `Título do card ${index + 1}`,
          subtitle: `Subtítulo do card ${index + 1}`,
          layout: 'mc', align: 'left', photoRegion,
          customBg: '#101118', bgImage: null, imageQuery: '',
          titleSize: 100, subSize: 100, titleCase: 'normal',
          textShadow: false, canvas: null, elementsUnlocked: true,
          overlays: [],
        })),
      },
    }]));
  }, { projectId: PROJECT_ID, cardIds: [FIRST_CARD, SECOND_CARD], photoRegion });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  await expect(surface(page, FIRST_CARD)).toBeVisible();
}

function surface(page, cardId, exported = false) {
  return page.locator(`${exported ? '[data-vc-export-tree]' : 'main'} [data-vc-card-surface="${cardId}"]`);
}

function textArea(page, cardId, exported = false) {
  // Na exportação os elementos não recebem os controles de arrasto.
  return surface(page, cardId, exported).locator('div[data-vc-inline-editable="true"]');
}

async function savedSlides(page) {
  return page.evaluate((projectId) => {
    const library = JSON.parse(localStorage.getItem('vc_library') || '[]');
    return library.find(entry => entry.id === projectId)?.doc?.slides || [];
  }, PROJECT_ID);
}

async function expectSavedText(page, cardIndex, text) {
  await expect.poll(async () => (await savedSlides(page))[cardIndex]?.overlays?.[0]?.text).toBe(text);
}

async function expectTwoLines(locator, text) {
  await expect(locator).toHaveCount(1);
  await expect.poll(() => locator.textContent()).toBe(text);
  await expect.poll(() => locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return new Set([...range.getClientRects()]
      .filter(rect => rect.width > 0 && rect.height > 0)
      .map(rect => Math.round(rect.top))).size;
  })).toBeGreaterThanOrEqual(2);
}

test('Control + clique cria no segundo card e preserva as linhas no preview, exportação e reload', async ({ page }) => {
  await openProject(page);
  const first = surface(page, FIRST_CARD);
  const second = surface(page, SECOND_CARD);

  // Um clique normal continua selecionando o título, sem criar uma área.
  await first.locator('[data-vc-movable="title"]').click();
  await expect(textArea(page, FIRST_CARD)).toHaveCount(0);
  await expect(textArea(page, SECOND_CARD)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Card 1 de 2', exact: true })).toHaveClass(/active/);

  let openedFileChooser = false;
  page.on('filechooser', () => { openedFileChooser = true; });
  await second.scrollIntoViewIfNeeded();
  const box = await second.boundingBox();
  // Control explícito também no macOS: Meta não é o atalho de criação.
  await second.click({ position: { x: box.width * 0.2, y: box.height * 0.25 }, modifiers: ['Control'] });
  const area = textArea(page, SECOND_CARD);
  await expect(area).toHaveAttribute('contenteditable', 'true');
  await expect(area).toBeFocused();
  await expect(textArea(page, FIRST_CARD)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Card 2 de 2', exact: true })).toHaveClass(/active/);
  await expect.poll(async () => {
    const slides = await savedSlides(page);
    return slides.map(slide => slide.overlays.length);
  }).toEqual([0, 1]);
  const created = (await savedSlides(page))[1];
  expect(created.overlays[0].x).toBeCloseTo(20, 0);
  expect(created.overlays[0].y).toBeCloseTo(25, 0);
  expect(created.elementOffsets?.photo).toBeUndefined();
  expect(openedFileChooser).toBe(false);

  // O placeholder deve estar selecionado: digitar basta para substituí-lo.
  await page.keyboard.type('IDEIA');
  await page.keyboard.press('Enter');
  await page.keyboard.type('CLARA');
  await page.getByRole('button', { name: 'Card 2 de 2', exact: true }).click();
  await expect(area).toHaveAttribute('contenteditable', 'false');
  await expectSavedText(page, 1, 'IDEIA\nCLARA');
  await expectTwoLines(area, 'IDEIA\nCLARA');
  await expectTwoLines(textArea(page, SECOND_CARD, true), 'IDEIA\nCLARA');

  await page.reload();
  await enterEditorFromHome(page);
  await expectTwoLines(textArea(page, SECOND_CARD), 'IDEIA\nCLARA');
  await expectTwoLines(textArea(page, SECOND_CARD, true), 'IDEIA\nCLARA');
  const reloaded = await savedSlides(page);
  expect(reloaded).toHaveLength(2);
  expect(reloaded[0].overlays).toEqual([]);
  expect(reloaded.map(slide => slide.title)).toEqual(['Título do card 1', 'Título do card 2']);
});

test('texto livre no layout de foto em faixa preserva espaços e pode ser movido', async ({ page }) => {
  await openProject(page, 1680, 'inset_h_top');
  await page.getByRole('tab', { name: 'Texto', exact: true }).click();
  await page.getByRole('button', { name: 'Criar texto', exact: true }).click();
  const area = textArea(page, FIRST_CARD);
  await expect(area).toHaveAttribute('contenteditable', 'true');
  await expect(area).toBeFocused();
  await page.keyboard.type('  TEXTO  ');
  await page.keyboard.press('Enter');
  await page.keyboard.type('  LIVRE  ');
  await page.getByRole('button', { name: 'Card 1 de 2', exact: true }).click();
  const text = '  TEXTO  \n  LIVRE  ';
  await expectSavedText(page, 0, text);
  await expectTwoLines(area, text);
  await expectTwoLines(textArea(page, FIRST_CARD, true), text);

  const overlay = (await savedSlides(page))[0].overlays[0];
  await expect(area).toHaveAttribute('data-vc-movable', `ov_${overlay.id}`);
  const box = await area.boundingBox();
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 24, start.y + 12, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => {
    const offset = (await savedSlides(page))[0]?.elementOffsets?.[`ov_${overlay.id}`];
    return !!offset && offset.x > 0 && offset.y > 0;
  }).toBe(true);
  expect((await savedSlides(page))[0].photoRegion).toBe('inset_h_top');
  await expectTwoLines(textArea(page, FIRST_CARD, true), text);
});

for (const width of [1680, 390]) {
  test(`Criar texto funciona a ${width}px, Escape cancela e excluir preserva o card`, async ({ page }) => {
    await openProject(page, width);
    if (width < 600) {
      await page.getByRole('button', { name: 'Abrir aba Texto', exact: true }).click();
    } else {
      await page.getByRole('tab', { name: 'Texto', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Criar texto', exact: true }).click();
    if (width < 600) await expect(page.getByRole('dialog', { name: 'Editor do card' })).toHaveCount(0);
    const area = textArea(page, FIRST_CARD);
    await expect(area).toHaveAttribute('contenteditable', 'true');
    await expect(area).toBeFocused();
    await page.keyboard.type('Área independente');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expectSavedText(page, 0, 'Área independente');
    await expect(area).toHaveAttribute('contenteditable', 'false');

    if (width < 600) {
      await area.focus();
      await area.press('Enter');
    } else {
      await area.dblclick();
    }
    await expect(area).toHaveAttribute('contenteditable', 'true');
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Delete');
    // Delete durante a digitação pertence ao texto, não ao card ou à área.
    await expect(area).toHaveCount(1);
    expect(await savedSlides(page)).toHaveLength(2);
    await page.keyboard.type('Rascunho cancelado');
    await page.keyboard.press('Escape');
    await expect(area).toHaveAttribute('contenteditable', 'false');
    await expect(area).toHaveText('Área independente');
    await expectSavedText(page, 0, 'Área independente');

    await area.click();
    if (width < 600) {
      const mobileEditor = page.getByRole('dialog', { name: 'Editor do card' });
      await expect(mobileEditor).toBeVisible();
      await mobileEditor.getByRole('button', { name: 'Fechar editor', exact: true }).click();
      await page.getByRole('button', { name: 'Excluir elemento selecionado', exact: true }).click();
    } else {
      await page.keyboard.press('Delete');
    }
    await expect(area).toHaveCount(0);
    await expect.poll(async () => (await savedSlides(page))[0]?.overlays).toEqual([]);
    const slides = await savedSlides(page);
    expect(slides).toHaveLength(2);
    expect(slides[0].title).toBe('Título do card 1');
    expect(slides[0].subtitle).toBe('Subtítulo do card 1');
  });
}
