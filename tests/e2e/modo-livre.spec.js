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
const plano = (designs = DESIGN) => ({
  schemaVersion: 3, promptVersion: PRESENTATION_PLAN_FREE_PROMPT_VERSION,
  objective: 'Apresentar o festival aos patrocinadores.', audience: 'Patrocinadores locais.', thesis: 'O festival move a cidade.',
  rules: [], evidence: [], gaps: [],
  deckDesign: {
    palette: { bg: '#F7F3EA', surface: '#E2D7C1', ink: '#1A1712', muted: '#4E4738', accent: '#B4235A', accent2: '#1F4E5F', inverse: '#1A1712', inverseInk: '#F7F3EA' },
    fonts: { display: 'Space Grotesk', text: 'IBM Plex Sans' },
    mood: 'Warm dusk light over crowded streets, magenta accents, documentary framing.',
  },
  slides: designs.map((design, i) => ({
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
const redacao = (blocks = []) => ({
  slides: TEXTO.map(([title, subtitle], i) => ({
    title, subtitle, bodyAfterImage: '', imageQuery: '', presentationBlocks: blocks[i] ? [blocks[i]] : [], speakerNotes: '', _i: i,
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
  // QA livre-f2 ("cida de", "9/1 0"): o texto do slide não herda as variantes
  // de glifo da interface (cv11, ss01). O html2canvas desenha o glifo padrão na
  // posição medida com a variante e abria um vão depois de cada "a".
  // O mesmo vale para os algarismos tabulares ("7/1 0" no fólio em Inter).
  const variantes = await page.locator('main [data-vc-card-surface]').evaluateAll(nodes => [...new Set(nodes.flatMap(n => [...n.querySelectorAll('h1, p, span, div')]
    .filter(e => [...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()))
    .map(e => `${getComputedStyle(e).fontFeatureSettings} | ${getComputedStyle(e).fontVariantNumeric}`)))]);
  expect(variantes).toEqual(['normal | normal']);

  // Reabre: nada é recomposto.
  await page.reload();
  await enterEditorFromHome(page, NOME);
  await expect(page.locator('main [data-vc-card-surface]').first()).toBeVisible();
  await page.waitForTimeout(800);
  const reaberto = (await library(page)).find(p => p.name === NOME).doc;
  expect(reaberto.visualPreset).toBe('presentation_free');
  expect(reaberto.slides.map(resumo)).toEqual(salvo.slides.map(resumo));
});

// Fase 3: citação, número grande e ícones. A citação e o número existem no
// material (tema); a segunda citação foi inventada pela IA simulada e cai.
const TEMA_F3 = `${TEMA} "A praça cheia é o melhor palco da cidade", diz Ana Souza, curadora do festival.`;
const DESIGN_F3 = DESIGN.map((d, i) => (i === 1 ? { ...d, photo: 'none', block: 'quote', emphasis: [] }
  : i === 2 ? { ...d, ground: 'surface', block: 'bignumber' }
    : i === 3 ? { ...d, photo: 'none', block: 'icons', icons: ['music', 'leaf', 'users'] }
      : i === 4 ? { ...d, photo: 'none', block: 'quote', emphasis: [] } : d));
const BLOCOS_F3 = [null,
  { type: 'quote', text: 'A praça cheia é o melhor palco da cidade', author: 'Ana Souza, curadora do festival' },
  { type: 'bignumber', value: '40 mil', label: 'pessoas por edição', detail: 'Em 12 noites de programação' },
  { type: 'icons', items: [
    { icon: 'music', title: 'Palcos abertos', body: 'Música em cada praça do centro.' },
    { icon: 'leaf', title: 'Feira de produtores', body: 'Comida da região.' },
    { icon: 'users', title: 'Oficinas', body: 'Atividades para crianças.' },
  ] },
  { type: 'quote', text: 'O festival mudou a minha vida', author: 'Visitante' },
  null];

test('Livre, fase 3: citação, número grande e ícones do material; citação inventada cai', async ({ page }) => {
  test.setTimeout(90_000);
  const prompts = [];
  await mockApi(page, { session, extra: {
    '/api/ai/compatible': route => {
      const prompt = route.request().postDataJSON().payload.messages.find(m => m.role === 'user').content;
      prompts.push(prompt);
      const value = prompt.startsWith('PLANEJAMENTO ESTRUTURADO') ? plano(DESIGN_F3)
        : prompt.startsWith('REVISÃO DE APRESENTAÇÃO') ? { edits: [] }
          : { ...redacao(BLOCOS_F3), slides: presentationBatch(prompt, redacao(BLOCOS_F3).slides) };
      return route.fulfill({ json: completion(value) });
    },
  } });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('modo-livre-f3')) return;
    sessionStorage.setItem('modo-livre-f3', '1');
    localStorage.setItem('vc_library', '[]');
    localStorage.setItem('vc_shell_view', JSON.stringify('project'));
  });
  await page.goto('/?app=1');
  await page.getByRole('button', { name: 'Criar um projeto', exact: true }).click();
  const wizard = page.getByRole('region', { name: 'Criar novo projeto', exact: true });
  const continuar = () => wizard.getByRole('button', { name: 'Continuar', exact: true }).click();
  await wizard.getByRole('radio', { name: /^Apresentação/ }).click();
  await wizard.getByLabel(/^Nome do projeto/).fill(`${NOME} f3`);
  await continuar();
  await continuar();
  await wizard.getByLabel(/^Sobre o que vamos criar/).fill(TEMA_F3);
  await continuar();
  await wizard.getByRole('radio', { name: /^Deixar o Moont organizar/ }).click();
  await continuar();
  await wizard.getByRole('spinbutton', { name: 'Quantidade de slides', exact: true }).fill(String(COUNT));
  await continuar();
  await wizard.getByRole('group', { name: 'Estilos para começar' }).getByRole('button').first().click();
  await wizard.getByRole('radio', { name: /^Criar o texto primeiro/ }).click();
  await continuar();
  await wizard.getByRole('button', { name: `Criar e gerar ${COUNT} slides`, exact: true }).click();
  await expect(wizard).toHaveCount(0, { timeout: 45_000 });
  await expect.poll(async () => (await library(page)).find(p => p.name === `${NOME} f3`)?.doc?.presentationQuality?.renderCheckStatus, { timeout: 30_000 }).toBe('passed');

  // Só o modo livre pede os blocos novos, com a lista de ícones.
  const redacoes = prompts.filter(p => p.includes('PLANO EDITORIAL VALIDADO'));
  expect(redacoes.length).toBeGreaterThan(0);
  for (const p of redacoes) expect(p).toContain('"type":"bignumber"');

  const salvo = (await library(page)).find(p => p.name === `${NOME} f3`).doc;
  const blocos = salvo.slides.map(s => s.presentationBlocks?.[0]?.type || 'none');
  expect(blocos).toEqual(['none', 'quote', 'bignumber', 'icons', 'none', 'none']);
  expect(salvo.slides.map(s => s.presentationFreeDesign.block)).toEqual(blocos);
  expect(salvo.slides[1].presentationBlocks[0].author).toBe('Ana Souza, curadora do festival');
  expect(freeDeckViolations(salvo.slides)).toEqual([]);

  // No editor: citação, número e ícones desenhados como SVG inline, editáveis.
  const cards = page.locator('main [data-vc-card-surface]');
  await expect(cards.nth(1).locator('[data-vc-presentation-block="quote"] blockquote')).toContainText('A praça cheia é o melhor palco da cidade');
  await expect(cards.nth(2).locator('[data-vc-bignumber-value]')).toHaveText('40 mil');
  await expect(cards.nth(3).locator('[data-vc-presentation-block="icons"] svg')).toHaveCount(3);
  const stroke = await cards.nth(3).locator('[data-vc-presentation-block="icons"] svg').first().getAttribute('stroke');
  expect(stroke).toMatch(/^#[0-9a-f]{6}$/i);
  // Trocar o ícone e editar o título do item ficam gravados no projeto.
  await cards.nth(3).getByRole('button', { name: 'Trocar ícone 1', exact: true }).click();
  await expect.poll(async () => (await library(page)).find(p => p.name === `${NOME} f3`).doc.slides[3].presentationBlocks[0].items[0].icon).toBe('camera');
  const titulo = cards.nth(3).getByLabel('Editar título do item 2', { exact: true });
  await titulo.dblclick();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type('Feira local');
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await expect.poll(async () => (await library(page)).find(p => p.name === `${NOME} f3`).doc.slides[3].presentationBlocks[0].items[1].title).toBe('Feira local');
});
