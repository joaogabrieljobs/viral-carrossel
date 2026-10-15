import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const PROJECT_ID = 'individual-card-fonts';
const FIRST_CARD = 'font-card-1';
const SECOND_CARD = 'font-card-2';
const TITLE_FONT = '"Playfair Display", serif';
const SUBTITLE_FONT = '"Montserrat", sans-serif';
const EXTRA_FONT = '"Outfit", sans-serif';
const CTA_FONT = '"Space Grotesk", sans-serif';
const FONT_LABELS = new Map([
  [TITLE_FONT, 'Playfair'],
  [SUBTITLE_FONT, 'Montserrat'],
  [EXTRA_FONT, 'Outfit'],
  [CTA_FONT, 'Space Grotesk'],
  ['', 'Usar fonte do estilo'],
]);

function mockFontCss(url) {
  return new URL(url).searchParams.getAll('family').map(value => value.split(':')[0]).map(family => (
    `@font-face{font-family:"${family}";font-style:normal;font-weight:100 900;src:local("Times New Roman"),local("Liberation Serif");font-display:swap}`
  )).join('\n');
}

async function openProject(page, width) {
  await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({
    contentType: 'text/css', body: mockFontCss(route.request().url()),
  }));
  await page.addInitScript(({ projectId, firstCard, secondCard }) => {
    window.__exportFontText = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      if (this.canvas.width > 2000) window.__exportFontText.push({ font: this.font, text: args[0] });
      return fillText.apply(this, args);
    };
    // O reload precisa ler o projeto editado, sem semear novamente.
    if (localStorage.getItem('vc_individual_fonts_seeded')) return;
    localStorage.setItem('vc_individual_fonts_seeded', '1');
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(projectId));
    localStorage.setItem('vc_library', JSON.stringify([{
      id: projectId, name: 'Fontes independentes', doc: {
        creativePreset: 'livre',
        brand: {
          id: 'individual-font-brand', name: 'Marca de teste', bg: '#eee7dc',
          titleColor: '#17151a', textColor: '#25232a', accent: '#624af7',
          titleFont: 'Arial, sans-serif', bodyFont: 'Arial, sans-serif',
          subtitleVisible: true, showHandle: false,
        },
        slides: [firstCard, secondCard].map((id, index) => ({
          id, num: index + 1, title: `IDEIA ${index + 1}`, subtitle: `Detalhe ${index + 1}`,
          layout: 'mc', align: 'left', photoRegion: 'full',
          customBg: '#eee7dc', bgImage: null, imageQuery: '',
          titleSize: 100, subSize: 100, titleCase: 'normal',
          textShadow: false, canvas: null, elementsUnlocked: true,
          overlays: index ? [] : [
            { id: 'first-extra', type: 'text', text: 'Texto livre A', x: 12, y: 12, w: 70, color: '#25232a', size: 3.4 },
            { id: 'second-extra', type: 'text', text: 'Texto livre B', x: 12, y: 22, w: 70, color: '#25232a', size: 3.4 },
            { id: 'extra-cta', type: 'cta', text: 'CONHECER', x: 50, y: 85, bg: '#624af7', fg: '#ffffff' },
          ],
        })),
      },
    }]));
  }, { projectId: PROJECT_ID, firstCard: FIRST_CARD, secondCard: SECOND_CARD });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i })
    .click({ force: true, timeout: 2500 }).catch(() => {});
  await expect(surface(page, FIRST_CARD)).toBeVisible();
}

function surface(page, cardId = FIRST_CARD, exported = false) {
  return page.locator(`${exported ? '[data-vc-export-tree]' : 'main'} [data-vc-card-surface="${cardId}"]`);
}

function panel(page) {
  return page.getByRole('region', { name: 'Tipografia do card', exact: true });
}

async function openTextPanel(page, mobile) {
  if (mobile) {
    if (!await page.getByRole('dialog', { name: 'Editor do card' }).isVisible()) {
      await page.getByRole('button', { name: 'Abrir aba Texto', exact: true }).click();
    }
  } else {
    await page.getByRole('tab', { name: 'Texto', exact: true }).click();
  }
  await expect(panel(page)).toBeVisible();
}

async function closeMobilePanel(page, mobile) {
  if (mobile && await page.getByRole('dialog', { name: 'Editor do card' }).isVisible()) {
    await page.getByRole('button', { name: 'Fechar editor', exact: true }).click();
  }
}

async function selectFont(page, key, fontFamily) {
  await panel(page).getByRole('combobox', { name: 'Texto do card', exact: true }).selectOption(key);
  await chooseFont(page, fontFamily);
}

async function chooseFont(page, fontFamily) {
  const inspector = panel(page);
  await inspector.getByRole('button', { name: 'Fonte do texto selecionado', exact: true }).click();
  await inspector.getByRole('group', { name: 'Fontes disponíveis' })
    .getByRole('button', { name: FONT_LABELS.get(fontFamily), exact: true }).click();
}

async function savedDoc(page) {
  return page.evaluate(projectId => {
    const library = JSON.parse(localStorage.getItem('vc_library') || '[]');
    return library.find(entry => entry.id === projectId)?.doc;
  }, PROJECT_ID);
}

async function expectFont(page, text, family, cardId = FIRST_CARD) {
  for (const exported of [false, true]) {
    // No celular, somente o card ativo está montado na prévia.
    if (!exported && page.viewportSize().width < 600 && cardId === SECOND_CARD) continue;
    await expect(surface(page, cardId, exported).getByText(text, { exact: text !== 'CONHECER' })).toHaveCSS('font-family', new RegExp(family));
  }
}

for (const width of [1680, 390]) {
  test(`fonte individual preserva outros textos e cards, herança e reload a ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const mobile = width < 600;
    await openProject(page, width);
    await openTextPanel(page, mobile);
    await selectFont(page, 'title', TITLE_FONT);
    await expectFont(page, 'IDEIA 1', 'Playfair Display');
    await expectFont(page, 'Detalhe 1', 'Arial');
    await expectFont(page, 'IDEIA 2', 'Arial', SECOND_CARD);

    // A seleção pelo canvas precisa apontar para o subtítulo, sem afetar o título.
    await closeMobilePanel(page, mobile);
    await surface(page).getByText('Detalhe 1', { exact: true }).click();
    await openTextPanel(page, mobile);
    await expect(panel(page).getByRole('combobox', { name: 'Texto do card', exact: true })).toHaveValue('subtitle');
    await chooseFont(page, SUBTITLE_FONT);
    await expectFont(page, 'Detalhe 1', 'Montserrat');
    await expectFont(page, 'IDEIA 1', 'Playfair Display');
    await expectFont(page, 'Detalhe 2', 'Arial', SECOND_CARD);

    await selectFont(page, 'ov_first-extra', EXTRA_FONT);
    await expectFont(page, 'Texto livre A', 'Outfit');
    await expectFont(page, 'Texto livre B', 'Arial');
    await selectFont(page, 'ov_extra-cta', CTA_FONT);
    await expectFont(page, 'CONHECER', 'Space Grotesk');
    await expectFont(page, 'Texto livre A', 'Outfit');

    if (!mobile) {
      // Um clique no subtítulo de outro card deve trocar card e alvo juntos.
      await surface(page, SECOND_CARD).getByText('Detalhe 2', { exact: true }).click();
      await expect(page.getByRole('button', { name: 'Card 2 de 2', exact: true })).toHaveClass(/active/);
      await expect(panel(page).getByRole('combobox', { name: 'Texto do card', exact: true })).toHaveValue('subtitle');
      await chooseFont(page, EXTRA_FONT);
      await expectFont(page, 'Detalhe 2', 'Outfit', SECOND_CARD);
      await expectFont(page, 'IDEIA 2', 'Arial', SECOND_CARD);
      await expectFont(page, 'Detalhe 1', 'Montserrat');
      await expectFont(page, 'IDEIA 1', 'Playfair Display');
      await selectFont(page, 'subtitle', '');
      await expectFont(page, 'Detalhe 2', 'Arial', SECOND_CARD);
      await surface(page).getByText('Detalhe 1', { exact: true }).click();
      await expect(page.getByRole('button', { name: 'Card 1 de 2', exact: true })).toHaveClass(/active/);
      await expect(panel(page).getByRole('combobox', { name: 'Texto do card', exact: true })).toHaveValue('subtitle');
    }

    // Voltar ao estilo remove só o override escolhido.
    await selectFont(page, 'subtitle', '');
    await expectFont(page, 'Detalhe 1', 'Arial');
    await expectFont(page, 'IDEIA 1', 'Playfair Display');
    await selectFont(page, 'subtitle', SUBTITLE_FONT);
    await expect.poll(async () => (await savedDoc(page))?.slides?.[0]?.textFonts).toEqual({
      title: TITLE_FONT, subtitle: SUBTITLE_FONT,
    });
    const beforeReload = await savedDoc(page);
    expect(beforeReload.brand.titleFont).toBe('Arial, sans-serif');
    expect(beforeReload.brand.bodyFont).toBe('Arial, sans-serif');
    expect(beforeReload.slides[1].textFonts || {}).toEqual({});
    expect(beforeReload.slides[0].overlays[0].fontFamily).toBe(EXTRA_FONT);
    expect(beforeReload.slides[0].overlays[1].fontFamily).toBeUndefined();
    expect(beforeReload.slides[0].overlays[2].fontFamily).toBe(CTA_FONT);

    if (!mobile) await page.screenshot({ path: testInfo.outputPath('fontes-por-texto.png') });
    await closeMobilePanel(page, mobile);
    await page.reload();
    await expectFont(page, 'IDEIA 1', 'Playfair Display');
    await expectFont(page, 'Detalhe 1', 'Montserrat');
    await expectFont(page, 'Texto livre A', 'Outfit');
    await expectFont(page, 'CONHECER', 'Space Grotesk');
    await expectFont(page, 'IDEIA 2', 'Arial', SECOND_CARD);

    if (!mobile) {
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /baixar card 1/i }).click();
      const download = await downloadPromise;
      const chunks = [];
      for await (const chunk of await download.createReadStream()) chunks.push(chunk);
      const png = Buffer.concat(chunks);
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(png.readUInt32BE(16)).toBe(3240);
      expect(png.readUInt32BE(20)).toBe(4050);
      await download.saveAs(testInfo.outputPath('fontes-individuais-3x.png'));
      const drawing = await page.evaluate(() => window.__exportFontText);
      for (const family of ['Playfair Display', 'Montserrat', 'Outfit', 'Space Grotesk']) {
        expect(drawing.some(({ font, text }) => font.includes(family) && text.trim())).toBe(true);
      }
    }
  });
}

test('galeria mostra a identidade de cada fonte e permite busca e teclado', async ({ page }) => {
  await openProject(page, 1680);
  await openTextPanel(page, false);
  const inspector = panel(page);
  const trigger = inspector.getByRole('button', { name: 'Fonte do texto selecionado', exact: true });
  await trigger.click();
  const choices = inspector.getByRole('group', { name: 'Fontes disponíveis' });
  const playfair = choices.getByRole('button', { name: 'Playfair', exact: true });
  const outfit = choices.getByRole('button', { name: 'Outfit', exact: true });
  await expect(playfair.locator('.vc-font-choice__sample')).toHaveCSS('font-family', /Playfair Display/);
  await expect(outfit.locator('.vc-font-choice__sample')).toHaveCSS('font-family', /Outfit/);
  await expect(playfair).not.toHaveAttribute('aria-pressed', 'true');
  await inspector.getByRole('searchbox', { name: 'Buscar fonte' }).fill('Playfair');
  await expect(playfair).toBeVisible();
  await expect(outfit).toHaveCount(0);
  await inspector.getByRole('searchbox', { name: 'Buscar fonte' }).press('ArrowDown');
  await expect(playfair).toBeFocused();
  await playfair.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expectFont(page, 'IDEIA 1', 'Playfair Display');
  await trigger.click();
  await expect(playfair).toHaveAttribute('aria-pressed', 'true');
  await inspector.getByRole('group', { name: 'Categorias de fontes' })
    .getByRole('button', { name: 'Serif', exact: true }).click();
  await expect(playfair).toBeVisible();
  await expect(outfit).toHaveCount(0);
  await inspector.getByRole('searchbox', { name: 'Buscar fonte' }).press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await inspector.getByRole('searchbox', { name: 'Buscar fonte' }).fill('Bodoni Moda');
  await choices.getByRole('button', { name: 'Bodoni Moda', exact: true }).click();
  await expectFont(page, 'IDEIA 1', 'Bodoni Moda');
});

test('Aplicar em todos replica apenas a fonte do título e persiste após recarregar', async ({ page }) => {
  await openProject(page, 1680);
  await openTextPanel(page, false);
  await selectFont(page, 'title', TITLE_FONT);
  await panel(page).getByRole('button', { name: 'Aplicar em todos' }).click();
  await expectFont(page, 'IDEIA 1', 'Playfair Display');
  await expectFont(page, 'IDEIA 2', 'Playfair Display', SECOND_CARD);
  await expectFont(page, 'Detalhe 2', 'Arial', SECOND_CARD);
  await expect.poll(async () => (await savedDoc(page))?.slides?.map(slide => slide.textFonts?.title))
    .toEqual([TITLE_FONT, TITLE_FONT]);
  await page.reload();
  await expectFont(page, 'IDEIA 2', 'Playfair Display', SECOND_CARD);
  await expectFont(page, 'Detalhe 2', 'Arial', SECOND_CARD);
});
