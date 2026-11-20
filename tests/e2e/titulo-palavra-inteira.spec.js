// MF-07 (reteste 19/11): no Cinematic Hybrid, card de foto em coluna, o título
// saiu "Camponê / s e integral". Nos slides da biblioteca a palavra nunca se
// parte: o título reduz até a palavra mais longa caber na linha.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

test('título estreito com palavra longa não quebra no meio da palavra', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(() => {
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('palavra'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'palavra', name: 'Palavra', doc: {
      creativePreset: 'livre', brand: { id: 'b', name: 'Marca', bg: '#0c1018', titleColor: '#ef4444', textColor: '#eeeeee',
        titleFont: 'Georgia, serif', bodyFont: 'Arial, sans-serif', subtitleVisible: true, showHandle: false },
      slides: [{ id: 'col', num: 1, title: 'Camponês e integral', subtitle: 'Fermentação lenta.', align: 'left', layout: 'tl',
        socialCompositionVersion: 4, socialComposition: 'v4:vPhotoColumn', titleSize: 150, subSize: 100, elementsUnlocked: true,
        canvas: { enabled: false, applied: true, variant: 'classic', source: 'social-preset', preserveZones: true,
          zones: { photo: { x: 0, y: 0, w: 55, h: 100 }, title: { x: 60, y: 20, w: 32, h: 40 }, subtitle: { x: 60, y: 62, w: 32, h: 20 } } } }],
    } }]));
  });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  const title = page.locator('[data-vc-export-tree] h1').first();
  await expect(title).toBeVisible();
  await page.waitForTimeout(600);
  const broken = await title.evaluate((node) => {
    const text = node.textContent;
    const textNode = [...node.childNodes].find((n) => n.nodeType === 3) || node.firstChild;
    const out = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let n; let offset = 0;
    while ((n = walker.nextNode())) {
      for (const m of n.textContent.matchAll(/\S+/g)) {
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const tops = new Set([...r.getClientRects()].map((rect) => Math.round(rect.top)));
        if (tops.size > 1) out.push(m[0]);
      }
      offset += n.textContent.length;
    }
    return { out, text, textNode: !!textNode };
  });
  expect(broken.out).toEqual([]);
});
