// Modo livre de apresentação, fase 2 (docs/product/modo-livre-apresentacao.md):
// escolher "Livre: o Moont decide" no assistente, gerar com IA simulada que
// devolve o roteiro v3 e conferir as páginas, a gravação e a reabertura.
// Toda chamada de IA e de conta é interceptada; nenhuma geração real.
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { presentationBatch } from './helpers/presentation-batches.js';
import { enterEditorFromHome } from './helpers/project-entry.js';
import { PRESENTATION_PLAN_FREE_PROMPT_VERSION } from '../../src/utils/presentation-plan.js';
import { freeDeckViolations } from '../../src/utils/free-design.js';

const session = { ...SESSAO_ATIVA, tier: 'essential', imageQuota: { limit: 0, used: 0, remaining: 0 } };
const completion = value => ({ choices: [{ message: { content: JSON.stringify(value) } }] });
const COUNT = 6;
const NOME = 'Festival livre';
// Fatos do texto simulado estão no tema: a revisão não marca nada para conferir.
const TEMA = 'Apresentar o Festival de verão da cidade para patrocinadores: uma semana de música, comida e encontro nas praças do centro, mais de 40 mil pessoas por edição, 12 noites de programação, palcos abertos, feira de produtores e oficinas para crianças.';

// Direção de arte proposta pela IA simulada: famílias, fundos e fotos variados.
const DESIGN = [
  { family: 'cinematic', ground: 'photo', photo: 'full', block: 'none', emphasis: ['Festival'], icons: [] },
  { family: 'editorial', ground: 'bg', photo: 'half', block: 'none', emphasis: ['40 mil pessoas'], icons: [] },
  { family: 'typographic', ground: 'inverse', photo: 'none', block: 'none', emphasis: [], icons: [] },
  { family: 'photo', ground: 'surface', photo: 'half', block: 'none', emphasis: [], icons: [] },
  { family: 'swiss', ground: 'bg', photo: 'small', block: 'none', emphasis: ['12 noites'], icons: [] },
  { family: 'executive', ground: 'accent', photo: 'half', block: 'none', emphasis: [], icons: [] },
];
const plano = () => ({
  schemaVersion: 3, promptVersion: PRESENTATION_PLAN_FREE_PROMPT_VERSION,
  objective: 'Apresentar o festival aos patrocinadores.', audience: 'Patrocinadores locais.', thesis: 'O festival move a cidade.',
  rules: [], evidence: [], gaps: [],
  deckDesign: {
    palette: { bg: '#F7F3EA', surface: '#E2D7C1', ink: '#1A1712', muted: '#4E4738', accent: '#B4235A', accent2: '#1F4E5F', inverse: '#1A1712', inverseInk: '#F7F3EA' },
    fonts: { display: 'Space Grotesk', text: 'IBM Plex Sans' },
    mood: 'Warm dusk light over crowded streets, magenta accents, documentary framing.',
  },
  slides: DESIGN.map((design, i) => ({
    index: i + 1, visualRole: i === 0 ? 'cover' : i === COUNT - 1 ? 'closing' : 'content',
    purpose: i === 0 ? 'introduction' : i === COUNT - 1 ? 'decision' : 'context',
    question: `Pergunta ${i + 1}?`, keyMessage: `Mensagem ${i + 1}.`, evidenceIds: [],
    scene: design.photo === 'none' ? null : { subject: `street festival crowd ${i + 1}`, action: 'dancing', setting: 'old town square', shot: ['wide', 'medium', 'close-up', 'detail', 'overhead', 'aerial'][i] },
    avoid: '', design,
  })),
});
const TEXTO = [
  ['Festival de verão na cidade', 'Uma semana de música, comida e encontro nas praças do centro.'],
  ['Mais de 40 mil pessoas por edição', 'O público cresce a cada ano e chega de todos os bairros da cidade.'],
  ['A cidade vira palco', 'Cada praça recebe uma programação própria, pensada para o bairro.'],
  ['Quem vem, volta', 'Famílias, estudantes e turistas voltam no ano seguinte com amigos.'],
  ['São 12 noites de programação', 'Palcos abertos, feira de produtores e oficinas para crianças.'],
  ['Patrocine a próxima edição', 'Escolha a cota que combina com a sua marca até o fim do mês.'],
];
const redacao = () => ({
  slides: TEXTO.map(([title, subtitle], i) => ({
    title, subtitle, bodyAfterImage: '', imageQuery: '', presentationBlocks: [], speakerNotes: '', _i: i,
  })).map(({ _i, ...slide }) => slide),
  caption: 'Festival de verão.',
});
const library = page => page.evaluate(() => JSON.parse(localStorage.getItem('vc_library') || '[]'));
const resumo = s => ({
  design: s.presentationFreeDesign, composition: s.presentationComposition, customBg: s.customBg,
  titleColor: s.titleColor, zones: s.canvas?.zones, title: s.title, deck: s.presentationDeckDesign,
});

test('Livre no assistente: roteiro v3, páginas variadas, salva e reabre igual', async ({ page }) => {
  test.setTimeout(90_000);
  const prompts = [];
  await mockApi(page, { session, extra: {
    '/api/ai/compatible': route => {
      const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
      prompts.push(prompt);
      const value = prompt.startsWith('PLANEJAMENTO ESTRUTURADO') ? plano()
        : prompt.startsWith('REVISÃO DE APRESENTAÇÃO') ? { edits: [] }
          : { ...redacao(), slides: presentationBatch(prompt, redacao().slides) };
      return route.fulfill({ json: completion(value) });
    },
  } });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('modo-livre-fixture')) return;
    sessionStorage.setItem('modo-livre-fixture', '1');
    localStorage.setItem('vc_library', '[]');
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
  });
  await page.goto('/?app=1');

  // Assistente de criação: apresentação, conteúdo, caminho e quantidade.
  await page.getByRole('button', { name: 'Criar um projeto', exact: true }).click();
  const wizard = page.getByRole('region', { name: 'Criar novo projeto', exact: true });
  const continuar = () => wizard.getByRole('button', { name: 'Continuar', exact: true }).click();
  await wizard.getByRole('radio', { name: /^Apresentação/ }).click();
  await wizard.getByLabel(/^Nome do projeto/).fill(NOME);
  await continuar();
  await expect(wizard.getByRole('radio', { name: /^Seguir com o padrão do Moont/ })).toHaveAttribute('aria-checked', 'true');
  await continuar();
  await wizard.getByLabel(/^Sobre o que vamos criar/).fill(TEMA);
  await continuar();
  await wizard.getByRole('radio', { name: /^Deixar o Moont organizar/ }).click();
  await continuar();
  await wizard.getByRole('spinbutton', { name: 'Quantidade de slides', exact: true }).fill(String(COUNT));
  await continuar();

  // Seletor: "Livre: o Moont decide" é o primeiro cartão.
  const estilos = wizard.getByRole('group', { name: 'Estilos para começar' });
  const cartoes = estilos.getByRole('button');
  await expect(cartoes.first()).toHaveAccessibleName(/^Livre: o Moont decide\./);
  await expect(cartoes.first().locator('[data-vc-free-mini]')).toHaveCount(3);
  await cartoes.first().click();
  await expect(cartoes.first()).toHaveAttribute('aria-pressed', 'true');
  await wizard.getByRole('radio', { name: /^Criar o texto primeiro/ }).click();
  await continuar();
  await wizard.getByRole('button', { name: `Criar e gerar ${COUNT} slides`, exact: true }).click();
  await expect(wizard).toHaveCount(0, { timeout: 45_000 });
  await expect.poll(async () => (await library(page)).find(p => p.name === NOME)?.doc?.presentationQuality?.renderCheckStatus, { timeout: 30_000 }).toBe('passed');

  // O roteiro pediu a direção de arte (v3) e a redação recebeu o design.
  expect(prompts[0]).toContain(PRESENTATION_PLAN_FREE_PROMPT_VERSION);
  expect(prompts[0]).toContain('DIREÇÃO DE ARTE');
  expect(prompts.some(p => p.includes('PLANO EDITORIAL VALIDADO') && p.includes('design.emphasis'))).toBe(true);

  const salvo = (await library(page)).find(p => p.name === NOME).doc;
  expect(salvo.visualPreset).toBe('presentation_free');
  expect(salvo.slides).toHaveLength(COUNT);
  // Paleta e fontes do roteiro valem no deck inteiro.
  expect(salvo.presentationDeckDesign.fonts).toEqual({ display: 'Space Grotesk', text: 'IBM Plex Sans' });
  expect(salvo.presentationDeckDesign.palette.accent).toBe('#B4235A');
  for (const s of salvo.slides) expect(s.presentationPaletteOverrides.accent).toBe('#B4235A');
  // Páginas com famílias e fundos variados, dentro das regras da spec.
  expect(new Set(salvo.slides.map(s => s.presentationFreeDesign.family)).size).toBeGreaterThanOrEqual(4);
  expect(new Set(salvo.slides.map(s => s.presentationFreeDesign.ground)).size).toBeGreaterThanOrEqual(3);
  expect(freeDeckViolations(salvo.slides)).toEqual([]);
  // Negrito do roteiro no texto; página sem foto não pede imagem.
  expect(salvo.slides[1].title).toContain('**40 mil pessoas**');
  expect(salvo.slides[2].presentationFreeDesign.photo).toBe('none');
  expect(salvo.slides[2].imageQuery).toBe('');

  // As páginas aparecem no editor com o fundo de cada uma.
  const fundos = await page.locator('main [data-vc-card-surface]').evaluateAll(nodes => nodes.map((n) => {
    const ground = n.querySelector('[data-vc-art-device="ground"]');
    return getComputedStyle(ground || n).backgroundColor;
  }));
  expect(new Set(fundos).size).toBeGreaterThanOrEqual(3);

  // Reabre: nada é recomposto.
  await page.reload();
  await enterEditorFromHome(page, NOME);
  await expect(page.locator('main [data-vc-card-surface]').first()).toBeVisible();
  await page.waitForTimeout(800);
  const reaberto = (await library(page)).find(p => p.name === NOME).doc;
  expect(reaberto.visualPreset).toBe('presentation_free');
  expect(reaberto.slides.map(resumo)).toEqual(salvo.slides.map(resumo));
});
