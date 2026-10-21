import { test, expect } from '@playwright/test';
import { mockEditorApi as mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';

const completion = (payload) => ({ choices: [{ message: { content: JSON.stringify(payload) } }] });
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const pitchArgument = 'O clique isolado não explica o impacto no negócio. A equipe conecta exposição, comportamento esperado e janela de leitura antes de iniciar o experimento. Assim, uma diferença observada pode orientar uma decisão concreta, com responsabilidade clara sobre o próximo passo e sobre os limites da análise.';
const pitchSupport = 'A hipótese deve definir o mecanismo esperado e o critério de decisão. Um resultado inconclusivo exige rever a pergunta antes de ampliar o investimento.';

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

const fittedReview = {
  edits: [
    { slideIndex: 0, reason: 'Encaixar a capa', title: 'A/B testing para decidir', subtitle: 'Da hipótese à decisão confiável.' },
    { slideIndex: 1, reason: 'Desenvolver o argumento com o mecanismo e a decisão', title: 'Mapeie o funil antes da métrica', subtitle: pitchArgument, bodyAfterImage: `${pitchSupport}\nFonte: Matéria-prima fornecida` },
    { slideIndex: 2, reason: 'Encaixar o dado', title: 'Testes inconclusivos começam na hipótese', subtitle: 'Defina mecanismo, público e limiar.' },
    { slideIndex: 3, reason: 'Encaixar a evidência', title: 'Leia efeito, incerteza e custo juntos', subtitle: 'A evidência sustenta a decisão.' },
    { slideIndex: 4, reason: 'Encaixar a aplicação', title: 'IA acelera sem eliminar julgamento', subtitle: 'Automatize e preserve o julgamento.' },
    { slideIndex: 5, reason: 'Encaixar o encerramento', title: 'Defina o job e avance', subtitle: 'Marque a próxima revisão.' },
  ],
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
  const textPrompts = [];
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
        textPrompts.push(prompt);
        const payload = prompt.startsWith('PLANEJAMENTO')
          ? {
            schemaVersion: 1, promptVersion: 'presentation-plan-v1',
            objective: 'Organizar testes A/B que apoiem decisões responsáveis.',
            audience: 'Equipes de produto e liderança.',
            thesis: 'Uma hipótese clara conecta medição, incerteza e decisão.',
            evidence: [], gaps: [],
            slides: deck.slides.map((slide, index) => ({
              index: index + 1,
              visualRole: index === 0 ? 'cover' : index === deck.slides.length - 1 ? 'closing' : ['demo', 'content', 'data', 'divider'][index - 1],
              purpose: ['introduction', 'journey', 'evidence', 'metrics', 'process', 'decision'][index],
              question: [
                'Como tornar o teste útil à decisão?',
                'Qual parte do funil merece ser medida?',
                'O que torna uma hipótese verificável?',
                'Como interpretar incerteza e risco?',
                'Onde a IA ajuda sem substituir julgamento?',
                'Qual é o próximo experimento a decidir?',
              ][index],
              keyMessage: slide.title,
              evidenceIds: [], imageBrief: slide.imageQuery,
            })),
          }
          : /^REVISÃO (?:EDITORIAL|DE APRESENTAÇÃO)/.test(prompt) ? fittedReview : deck;
        return route.fulfill({
          json: completion(payload),
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

  await expect(page.getByText('Nome da apresentação', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Como se chama este projeto?' }).fill('Nova apresentação');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();

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
  await expect(page.getByRole('button', { name: /^Apresentação(?: 16:9)?$/ }).first())
    .toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => imageRequests.length, { timeout: 30_000 }).toBe(6);
  expect(imageRequests.every((request) => ['16:9', '3:2', '1:1', '2:3', '9:16'].includes(request.aspectRatio))).toBe(true);
  expect(imageRequests.some((request) => request.aspectRatio !== '16:9')).toBe(true);
  await expectGeneratedThumbnailsVisible(page, 6);
  await expect.poll(() => persistedSlideImageCount(page), { timeout: 15_000 }).toBe(6);
  expect(textPrompts).toHaveLength(3);
  expect(textPrompts[0]).toContain('PLANEJAMENTO ESTRUTURADO');
  expect(textPrompts[1]).toContain('PITCH COMPLETO PARA LEITURA AUTÔNOMA');
  expect(textPrompts[1]).not.toContain('bodyAfterImage fica vazio por padrão');
  expect(textPrompts[2]).toContain('REVISÃO DE PROFUNDIDADE DO PITCH');
  await expect(page.locator('main').getByText(pitchArgument, { exact: true })).toBeVisible();
  await expect(page.locator('main').getByText(pitchSupport, { exact: true })).toBeVisible();
  await expect(page.locator('main').getByText(/Fonte: Matéria-prima/)).toHaveCount(0);

  const geometry = await page.evaluate(() => {
    const cards = new Set();
    for (const heading of document.querySelectorAll('main h1')) {
      let node = heading.parentElement;
      while (node && node !== document.body) {
        if (node.style.width === '1920px' && node.style.height === '1080px') {
          const rect = node.getBoundingClientRect();
          // O editor empilha apresentações; valide também os slides abaixo
          // da dobra, não somente os dois que cabem no viewport inicial.
          if (rect.width > 100 && rect.height > 0) cards.add(node);
          break;
        }
        node = node.parentElement;
      }
    }
    const overflow = [];
    const widths = [];
    const scales = [];
    const overflowAtFloor = [];
    for (const card of cards) {
      widths.push(Math.round(card.getBoundingClientRect().width));
      for (const scaler of card.querySelectorAll('[data-vc-overflow-scale]')) {
        scales.push(Number(scaler.getAttribute('data-vc-overflow-scale')));
        if (scaler.getAttribute('data-vc-overflow-at-floor') === 'true') {
          overflowAtFloor.push(card.textContent?.slice(0, 36));
        }
      }
      for (const zone of card.querySelectorAll('div')) {
        const style = getComputedStyle(zone);
        if (style.overflow !== 'hidden') continue;
        if (!zone.querySelector('h1, p')) continue;
        const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
        let childrenHeight = 0;
        for (const child of zone.children) childrenHeight += child.offsetHeight || 0;
        const contentHeight = Math.max(zone.scrollHeight, Math.ceil(childrenHeight + padding));
        if (contentHeight > zone.clientHeight + 2) {
          const heading = zone.querySelector('h1');
          const headingStyle = heading ? getComputedStyle(heading) : null;
          overflow.push({
            slide: card.textContent?.slice(0, 36),
            field: zone.getAttribute('data-vc-movable'),
            scale: zone.getAttribute('data-vc-overflow-scale'),
            floor: zone.getAttribute('data-vc-overflow-at-floor'),
            contentHeight,
            clientHeight: zone.clientHeight,
            contentWidth: zone.clientWidth,
            headingHeight: heading?.offsetHeight,
            headingWidth: heading?.offsetWidth,
            fontSize: headingStyle?.fontSize,
            lineHeight: headingStyle?.lineHeight,
            paddingLeft: style.paddingLeft,
            paddingRight: style.paddingRight,
          });
        }
      }
    }
    return { cardCount: cards.size, overflow, widths, scales, overflowAtFloor };
  });

  expect(geometry.cardCount).toBe(6);
  expect(geometry.overflow).toEqual([]);
  expect(geometry.overflowAtFloor).toEqual([]);
  expect(geometry.scales.length).toBeGreaterThan(0);
  expect(Math.min(...geometry.scales)).toBeGreaterThanOrEqual(0.7);
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
  await expect(page.locator('main').getByText(pitchArgument, { exact: true })).toBeVisible();
  await expect(page.locator('main').getByText(pitchSupport, { exact: true })).toBeVisible();
});
