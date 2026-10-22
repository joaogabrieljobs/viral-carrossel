import { enterEditorFromHome } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const PROJECT_ID = 'inline-line-breaks-project';

async function seedClassicCard(page) {
  await page.addInitScript((projectId) => {
    // O reload deve ler a edição salva, sem substituir o projeto pela fixture.
    if (localStorage.getItem('vc_inline_line_breaks_e2e_seeded')) return;
    localStorage.setItem('vc_inline_line_breaks_e2e_seeded', '1');
    localStorage.setItem('vc_app_mode', JSON.stringify('criador'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(projectId));
    localStorage.setItem('vc_library', JSON.stringify([{
      id: projectId,
      name: 'Quebras de linha no card',
      doc: {
        creativePreset: 'livre',
        brand: {
          name: 'MUSA',
          bg: '#101118',
          titleColor: '#ffffff',
          textColor: '#ffffff',
          accent: '#b7e56b',
          titleFont: 'Arial, sans-serif',
          bodyFont: 'Arial, sans-serif',
          subtitleVisible: true,
          showHandle: false,
        },
        slides: [{
          id: 'inline-line-breaks-card',
          num: 1,
          title: 'Título inicial',
          subtitle: 'Subtítulo inicial',
          layout: 'mc',
          align: 'left',
          photoRegion: 'full',
          customBg: '#101118',
          bgImage: null,
          imageQuery: '',
          titleSize: 100,
          subSize: 100,
          titleCase: 'normal',
          textShadow: false,
          canvas: null,
          elementsUnlocked: true,
        }],
      },
    }]));
  }, PROJECT_ID);
}

async function savedField(page, field) {
  return page.evaluate(({ projectId, field }) => {
    const library = JSON.parse(localStorage.getItem('vc_library') || '[]');
    return library.find(entry => entry.id === projectId)?.doc?.slides?.[0]?.[field];
  }, { projectId: PROJECT_ID, field });
}

async function linePositions(locator, lines) {
  return locator.evaluate((element, parts) => {
    const textNodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    const text = textNodes.map(node => node.textContent).join('');

    function rectFor(part) {
      const start = text.indexOf(part);
      if (start < 0) return null;
      const end = start + part.length;
      const range = document.createRange();
      let offset = 0;
      let started = false;
      for (const node of textNodes) {
        const nextOffset = offset + node.textContent.length;
        if (!started && start < nextOffset) {
          range.setStart(node, start - offset);
          started = true;
        }
        if (started && end <= nextOffset) {
          range.setEnd(node, end - offset);
          const rect = range.getBoundingClientRect();
          return { top: rect.top, height: rect.height, width: rect.width };
        }
        offset = nextOffset;
      }
      return null;
    }

    return parts.map(rectFor);
  }, lines);
}

async function expectSeparateRenderedLines(locator, lines, context) {
  await expect(locator).toHaveCount(1);
  await expect.poll(async () => {
    const [first, second] = await linePositions(locator, lines);
    if (!first || !second || first.width <= 0 || second.width <= 0) return 0;
    // Normaliza pela altura dos glifos: o preview é escalado; o export é 1:1.
    return (second.top - first.top) / Math.max(first.height, second.height, 1);
  }, { message: `${context}: os dois trechos precisam ocupar linhas diferentes` }).toBeGreaterThan(0.5);
}

for (const { field, label, tag, key, lines } of [
  { field: 'title', label: 'título', tag: 'h1', key: 'Enter', lines: ['FOCO', 'CLARO'] },
  { field: 'subtitle', label: 'subtítulo', tag: 'p', key: 'Shift+Enter', lines: ['IDEIA', 'FORTE'] },
]) {
  test(`${label} mantém quebra com ${key} ao sair da edição e recarregar`, async ({ page }) => {
    await mockApi(page, { session: SESSAO_ATIVA });
    await seedClassicCard(page);
    await page.goto('/?app=1');
    await enterEditorFromHome(page);

    const preview = page.locator(`main ${tag}[data-vc-inline-editable="true"]`);
    const exported = page.locator(`[data-vc-export-tree] ${tag}[data-vc-inline-editable="true"]`);
    await expect(preview).toBeVisible();
    await preview.dblclick();
    await expect(preview).toHaveAttribute('contenteditable', 'true');
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(lines[0]);
    await page.keyboard.press(key);
    await page.keyboard.type(lines[1]);

    // Clique real fora do texto: reproduz o blur que antes colapsava a quebra.
    await page.getByRole('button', { name: /^Card 1 de / }).click();
    await expect(preview).toHaveAttribute('contenteditable', 'false');
    const expected = lines.join('\n');
    await expect.poll(() => savedField(page, field)).toBe(expected);
    await expectSeparateRenderedLines(preview, lines, 'Preview após sair da edição');
    await expectSeparateRenderedLines(exported, lines, 'Exportação após sair da edição');

    await page.reload();
    await enterEditorFromHome(page);
    await expect(preview).toBeVisible();
    await expect.poll(() => savedField(page, field)).toBe(expected);
    await expectSeparateRenderedLines(preview, lines, 'Preview após recarregar');
    await expectSeparateRenderedLines(exported, lines, 'Exportação após recarregar');
  });
}
