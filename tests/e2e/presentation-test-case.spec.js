import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const completion = (payload) => ({ choices: [{ message: { content: JSON.stringify(payload) } }] });
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

const deck = {
  slides: [
    {
      title: 'A/B testing que decide, não apenas mede',
      subtitle: 'Um sistema prático para transformar hipóteses em decisões com cadência, evidência e responsabilidade clara.',
      imageQuery: 'executive experimentation dashboard in a modern product studio',
      bodyAfterImage: '',
    },
    {
      title: 'Mapeie o funil inteiro antes de escolher a métrica',
      subtitle: 'O clique isolado não explica impacto. Defina exposição, comportamento esperado, janela de leitura e consequência no negócio.',
      imageQuery: 'customer journey funnel mapped on a widescreen strategy wall',
      bodyAfterImage: '',
    },
    {
      title: '64% dos testes são inconclusivos. A culpa é da hipótese.',
      subtitle: 'Hipóteses vagas produzem sinais fracos. Declare mecanismo, público, mudança esperada e limiar de decisão antes de publicar a variante.',
      imageQuery: 'product team reviewing a rigorous hypothesis framework',
      bodyAfterImage: '',
    },
    {
      title: 'Leia efeito, incerteza e custo da decisão em conjunto',
      subtitle: 'Uma diferença aparente só vira evidência quando o intervalo, a qualidade dos dados e o risco de agir contam a mesma história.',
      imageQuery: 'confidence interval visualization for an executive presentation',
      bodyAfterImage: '',
    },
    {
      title: 'IA comprime semanas em dias sem eliminar o julgamento',
      subtitle: 'Automatize preparação, checagens e síntese. Preserve a decisão humana sobre causalidade, prioridade e efeito colateral.',
      imageQuery: 'human analyst collaborating with artificial intelligence tools',
      bodyAfterImage: '',
    },
    {
      title: 'Defina o job, combine a cadência e avance',
      subtitle: 'Escolha uma decisão real, escreva a hipótese mensurável e marque a próxima revisão com quem pode agir sobre o resultado.',
      imageQuery: 'leadership team agreeing on an experimentation cadence',
      bodyAfterImage: '',
    },
  ],
  caption: 'Deck executivo sobre testes e decisão.',
};

async function useProfessionalControls(page) {
  await page.getByRole('button', { name: /Modo atual: Criar rápido/i }).click();
  await page.getByRole('menuitem', { name: /Controle profissional/i }).click();
}

async function expectGeneratedThumbnailsVisible(page, expectedCount) {
  const images = page.locator('[data-vc-tour="thumbnails"] .slide-thumb img');
  await expect(images).toHaveCount(expectedCount, { timeout: 15_000 });
  await expect.poll(async () => images.evaluateAll((nodes) => nodes.filter((image) => {
    const rect = image.getBoundingClientRect();
    const style = getComputedStyle(image);
    const parentStyle = image.parentElement ? getComputedStyle(image.parentElement) : null;
    return image.complete
      && image.naturalWidth > 0
      && image.naturalHeight > 0
      && rect.width > 0
      && rect.height > 0
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && parentStyle?.display !== 'none'
      && parentStyle?.visibility !== 'hidden';
  }).length), {
    timeout: 15_000,
    message: 'todas as miniaturas geradas devem continuar carregadas e visíveis',
  }).toBe(expectedCount);
}

async function persistedSlideImageCount(page) {
  return page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem('vc_library') || '[]');
    const rawActiveId = localStorage.getItem('vc_active_doc_id');
    let activeId = rawActiveId;
    try { activeId = JSON.parse(rawActiveId || 'null'); } catch { /* formato legado */ }
    const active = library.find((entry) => entry.id === activeId) || library[0];
    return (active?.doc?.slides || []).filter((slide) => slide.bgImageId).length;
  });
}

test('deck 16:9 mantém tipo do projeto e encaixa todo o texto nas zonas', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1680, height: 900 });
  const imageRequests = [];
  await mockApi(page, {
    session: {
      ...SESSAO_ATIVA,
      tier: 'creator',
      imageQuota: { limit: 50, remaining: 50, used: 0 },
    },
    extra: {
      '/api/ai/compatible': (route) => {
        const prompt = route.request().postDataJSON()?.payload?.messages
          ?.find((message) => message.role === 'user')?.content || '';
        return route.fulfill({
          json: completion(prompt.startsWith('REVISÃO EDITORIAL') ? { edits: [] } : deck),
        });
      },
      '/api/ai/sjinn-image': (route) => {
        imageRequests.push(route.request().postDataJSON());
        return route.fulfill({
          json: {
            b64_json: PNG,
            mime: 'image/png',
            quota: { limit: 50, remaining: 50 - imageRequests.length, used: imageRequests.length },
          },
        });
      },
    },
  });

  await page.goto('/?app=1');
  await page.getByRole('button', { name: /continuar no editor/i }).click();
  await useProfessionalControls(page);
  await page.getByRole('button', { name: 'Gerar apresentação com IA', exact: true }).click();

  const modal = page.locator('.modal-panel');
  await modal.getByLabel('Qual é o tema da apresentação?', { exact: true })
    .fill('Como transformar testes A/B em decisões confiáveis');
  await modal.getByRole('radio', { name: /^Pitch/ }).click();
  await modal.getByRole('button', { name: /Continuar/i }).click();
  await modal.getByRole('group', { name: 'Número de slides', exact: true })
    .getByRole('button', { name: '6', exact: true }).click();
  await modal.getByRole('button', { name: /Continuar/i }).click();
  await modal.getByRole('radio', { name: 'Texto e imagens', exact: true }).check();
  await modal.getByRole('button', { name: /Continuar/i }).click();
  await modal.getByRole('button', { name: 'Gerar apresentação com imagens', exact: true }).click();

  await expect(modal).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText('Nova apresentação', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apresentação', exact: true }).first())
    .toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => imageRequests.length, { timeout: 30_000 }).toBe(6);
  expect(imageRequests.every((request) => request.aspectRatio === '16:9')).toBe(true);
  await expectGeneratedThumbnailsVisible(page, 6);
  await expect.poll(() => persistedSlideImageCount(page), { timeout: 15_000 }).toBe(6);

  const geometry = await page.evaluate(() => {
    const cards = new Set();
    for (const heading of document.querySelectorAll('main h1')) {
      let node = heading.parentElement;
      while (node && node !== document.body) {
        if (node.style.width === '1920px' && node.style.height === '1080px') {
          const rect = node.getBoundingClientRect();
          if (rect.width > 100 && rect.top > 0 && rect.top < window.innerHeight) cards.add(node);
          break;
        }
        node = node.parentElement;
      }
    }
    const overflow = [];
    const widths = [];
    for (const card of cards) {
      widths.push(Math.round(card.getBoundingClientRect().width));
      for (const zone of card.querySelectorAll('div')) {
        const style = getComputedStyle(zone);
        if (style.overflow !== 'hidden') continue;
        if (!zone.querySelector('h1, p')) continue;
        const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
        let childrenHeight = 0;
        for (const child of zone.children) childrenHeight += child.offsetHeight || 0;
        const contentHeight = Math.max(zone.scrollHeight, Math.ceil(childrenHeight + padding));
        if (contentHeight > zone.clientHeight + 2) {
          overflow.push({
            slide: card.textContent?.slice(0, 36),
            contentHeight,
            clientHeight: zone.clientHeight,
          });
        }
      }
    }
    return { cardCount: cards.size, overflow, widths };
  });

  expect(geometry.cardCount).toBe(6);
  expect(geometry.overflow).toEqual([]);
  expect(Math.min(...geometry.widths)).toBeGreaterThanOrEqual(700);

  // Voltar à Home não pode redefinir uma apresentação como carrossel.
  await page.getByRole('button', { name: 'Projetos', exact: true }).first().click();
  const presentationSelectors = page.getByRole('group', { name: 'Tipo de projeto para criar' })
    .getByRole('button', { name: 'Apresentação', exact: true });
  await expect(presentationSelectors).toHaveCount(2);
  await expect.poll(() => presentationSelectors.evaluateAll(
    (buttons) => buttons.every((button) => button.getAttribute('aria-pressed') === 'true'),
  )).toBe(true);

  await page.getByRole('button', { name: /Continuar no editor/i }).click();
  await expectGeneratedThumbnailsVisible(page, 6);

  await page.reload();
  const continueAfterReload = page.getByRole('button', { name: /Continuar no editor/i });
  if (await continueAfterReload.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await continueAfterReload.click();
  }
  await expectGeneratedThumbnailsVisible(page, 6);
  await expect.poll(() => persistedSlideImageCount(page), { timeout: 15_000 }).toBe(6);
});
