// MF-01 (reteste 19/11): texto de card sem foto saía com sombra preta borrada
// também no PNG exportado. A composição pode pedir sombra esperando uma foto
// que não chegou; sem foto carregada atrás do texto, não há sombra.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';

const photo = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500"><rect width="1200" height="1500" fill="#6d8a96"/></svg>').toString('base64')}`;

async function exportFirstCard(page, { withPhoto }) {
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(({ withPhoto, photo }) => {
    localStorage.setItem('vc_app_mode', JSON.stringify('criador'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('sombra'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'sombra', name: 'Sombra', doc: {
      creativePreset: 'livre', brand: { id: 'b', name: 'Marca', bg: '#fafaf6', titleColor: '#0a0a0a', textColor: '#333333',
        titleFont: 'Arial, sans-serif', bodyFont: 'Arial, sans-serif', subtitleVisible: true, showHandle: false },
      slides: [{ id: 'capa', num: 1, title: 'Fermento Lento: pão natural', subtitle: 'Padaria aberta de terça a domingo.',
        layout: 'mc', align: 'center', photoRegion: 'full', textShadow: true, canvas: null, elementsUnlocked: true,
        ...(withPhoto ? { bgImage: photo, overlay: 40 } : {}) }],
    } }]));
    window.__textShadows = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      if (this.canvas.width > 2000 && String(args[0]).trim()) window.__textShadows.push({ text: args[0], blur: this.shadowBlur, color: this.shadowColor });
      return fillText.apply(this, args);
    };
  }, { withPhoto, photo });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  const shadowOnScreen = await page.locator('[data-vc-export-tree] h1').first().evaluate((node) => getComputedStyle(node).textShadow);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /baixar card 1/i }).click();
  await download;
  const drawn = await page.evaluate(() => window.__textShadows);
  return { shadowOnScreen, drawn };
}

test('capa sem foto: nem a tela nem o PNG exportado têm sombra no texto', async ({ page }) => {
  test.setTimeout(60_000);
  const { shadowOnScreen, drawn } = await exportFirstCard(page, { withPhoto: false });
  expect(shadowOnScreen).toBe('none');
  expect(drawn.length).toBeGreaterThan(0);
  expect(drawn.filter((d) => d.blur > 0 && !/rgba\(0, 0, 0, 0\)/.test(d.color))).toEqual([]);
});

test('capa com foto atrás do texto mantém a sombra de proteção', async ({ page }) => {
  test.setTimeout(60_000);
  const { shadowOnScreen } = await exportFirstCard(page, { withPhoto: true });
  expect(shadowOnScreen).not.toBe('none');
});
