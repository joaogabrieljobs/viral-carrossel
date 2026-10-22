import { enterEditorFromHome } from './helpers/project-entry.js';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

test('16:9 → Feed, Quadrado e Stories: foto cheia, texto legível, exportação e volta preservada', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1680, height: 1000 });
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(url.hostname) || !/^https?:$/.test(url.protocol)
      ? route.continue() : route.abort();
  });
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(() => {
    if (localStorage.getItem('format-switch-seeded')) return;
    localStorage.setItem('format-switch-seeded', '1');
    const svg = content => `data:image/svg+xml;base64,${btoa(String.fromCharCode(...new TextEncoder().encode(content)))}`;
    const photo = svg('<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><linearGradient id="g"><stop stop-color="#183c47"/><stop offset="1" stop-color="#a58565"/></linearGradient></defs><path fill="url(#g)" d="M0 0h1920v1080H0z"/><circle cx="1350" cy="400" r="240" fill="#d0b59a"/></svg>');
    const logo = svg('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><text x="0" y="80" fill="white" font-family="Arial" font-size="90">ÉTER</text></svg>');
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
    localStorage.setItem('vc_active_doc_id', JSON.stringify('format-switch'));
    localStorage.setItem('vc_library', JSON.stringify([{ id: 'format-switch', name: 'ÉTER apresentação', doc: {
      fmt: 'apresentacao', creativePreset: 'apresentacao',
      brand: { bg: '#f7f7f5', titleColor: '#222222', subtitleColor: '#222222', textColor: '#222222',
        titleFont: 'Arial', subtitleFont: 'Arial', bodyFont: 'Arial', subtitleCase: 'normal',
        subtitleVisible: true, showHandle: false, showPageBadge: true, logo, logoSize: 260 },
      slides: [
        {
          id: 'format-1', title: 'Receita recorrente e escopo inviolável',
          subtitle: 'Membro paga assinatura B2C para acessar a trajetória. Médico ou clínica pagam B2B Clinical para acompanhar a carteira com eficiência. Parcerias B2B para distribuição.',
          bodyAfterImage: 'A assinatura captura o valor da continuidade. A margem depende do uso e da intensidade humana.',
        },
        {
          id: 'format-2', title: 'Uma decisão com contexto, critérios claros e acompanhamento ao longo de toda a jornada',
          subtitle: 'O cuidado precisa acompanhar a pessoa entre consultas. Organizar o histórico reduz a fragmentação e permite que cada encontro avance a partir do anterior. A equipe observa os sinais disponíveis, combina prioridades e define o próximo passo. A continuidade depende de uma experiência simples, com responsabilidades claras e acompanhamento.',
          bodyAfterImage: 'Primeiro, validar a experiência com um grupo concentrado. Observar o uso, corrigir atritos e medir a retenção antes de ampliar a operação.',
        },
      ].map(s => ({ ...s, bgImage: photo, layout: 'tl', align: 'left', elementsUnlocked: true,
        presentationCompositionId: 'presentation_split', presentationComposition: 'split',
        presentationTypographyByComposition: { split: { title: { sizePercent: 25 }, subtitle: { sizePercent: 50 } } },
        titleSize: 46, subSize: 72, bodyAfterSize: 40, titleCase: 'normal',
        canvas: { source: 'presentation-preset', applied: true, variant: 'classic', zones: {
          photo: { x: 65, y: 39, w: 29, h: 49 }, title: { x: 6, y: 12, w: 88, h: 22 },
          subtitle: { x: 6, y: 38, w: 55, h: 56 },
        } },
      })),
      formatViews: { apresentacao: {
        brand: { bg: '#161616', titleColor: '#ffffff', textColor: '#eeeeee' },
        slides: { 'format-1': { canvas: null, photoRegion: 'full', layout: 'bl', textBlockWidth: 70,
          titleSize: 52, subSize: 100, titleColor: '#ffffff', subtitleColor: '#ffffff', logoPosition: 'tl' } },
      } },
    } }]));
  });
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  const card = id => page.locator(`main [data-vc-card-surface="format-${id}"]`);
  await expect(card(1)).toBeVisible();
  const original = await card(1).locator('h1,h2').first().evaluate(el => ({
    text: el.textContent, fontSize: getComputedStyle(el).fontSize,
  }));
  for (const [label, fmt, ratio] of [['Feed 4:5', 'carrossel', 4 / 5], ['Quadrado', 'quadrado', 1], ['Stories', 'stories', 9 / 16]]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect.poll(async () => {
      const box = await card(1).boundingBox();
      return Number((box.width / box.height).toFixed(3));
    }).toBe(Number(ratio.toFixed(3)));
    // Espera o ajuste tipográfico completar, sem depender de tempo fixo.
    await expect(card(1).locator('[data-vc-photo-zone] [style*="background-image"]')).toHaveCount(1);
    for (const id of [1, 2]) {
      const metrics = await card(id).evaluate(root => {
        const rect = el => {
          const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom, right: r.right };
        };
        return {
          frame: rect(root), photo: rect(root.querySelector('[data-vc-photo-zone]')),
          title: rect(root.querySelector('h1')), paragraphs: [...root.querySelectorAll('p')].map(rect),
          sizes: [...root.querySelectorAll('h1,p')].map(el => parseFloat(getComputedStyle(el).fontSize)),
          fit: root.querySelector('[style*="background-image"]').style.backgroundSize,
          logo: rect(root.querySelector('[data-vc-brand-logo]')),
        };
      });
      expect(metrics.photo.w).toBeCloseTo(metrics.frame.w, 0);
      expect(metrics.photo.h).toBeCloseTo(metrics.frame.h, 0);
      expect(metrics.photo.x).toBeCloseTo(metrics.frame.x, 0);
      expect(metrics.photo.y).toBeCloseTo(metrics.frame.y, 0);
      expect(metrics.fit).toBe('cover');
      expect(metrics.paragraphs).toHaveLength(2);
      expect(metrics.title.y).toBeGreaterThan(metrics.logo.bottom);
      expect(metrics.paragraphs[0].y).toBeGreaterThanOrEqual(metrics.title.bottom - 1);
      expect(metrics.paragraphs[1].y).toBeGreaterThanOrEqual(metrics.paragraphs[0].bottom - 1);
      expect(metrics.sizes[0]).toBeGreaterThan(45);
      expect(metrics.sizes[1]).toBeGreaterThan(27);
      expect(metrics.sizes[2]).toBeGreaterThan(22);
      for (const box of [metrics.title, ...metrics.paragraphs]) {
        expect(box.x).toBeGreaterThan(metrics.frame.x);
        expect(box.right).toBeLessThan(metrics.frame.right);
        expect(box.bottom).toBeLessThan(metrics.frame.bottom);
      }
    }
    // O export usa a mesma composição que o editor.
    const exportPhoto = page.locator('[data-vc-export-tree] [data-vc-card-surface="format-1"] [data-vc-photo-zone]');
    await expect(exportPhoto).toHaveCSS('width', '1080px');
    await expect(exportPhoto).toHaveCSS('height', fmt === 'stories' ? '1920px' : fmt === 'quadrado' ? '1080px' : '1350px');
    await card(1).screenshot({ path: testInfo.outputPath(`${fmt}.png`) });
  }
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('vc_library') || '[]').find(p => p.id === 'format-switch')?.doc?.fmt
  ))).toBe('stories');
  await page.reload();
  await enterEditorFromHome(page);
  await expect(card(1).locator('[data-vc-photo-zone] [style*="background-image"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Apresentação 16:9', exact: true }).click();
  await expect(card(1).locator('h1,h2').first()).toHaveCSS('font-size', original.fontSize);
  await expect(card(1).locator('h1,h2').first()).toHaveText(original.text);
  await expect(card(1).locator('[data-vc-photo-zone]')).toHaveCount(0);
});
