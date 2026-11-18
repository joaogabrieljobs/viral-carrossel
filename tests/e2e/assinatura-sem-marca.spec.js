import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';
import { applyVisualPreset, VISUAL_PRESETS } from '../../src/styles/visual-presets.jsx';
import { applySocialVisualComposition } from '../../src/utils/social-visual-composition.js';

// Rodada R2 (15–16/11/2026): carrosséis gerados sem marca cadastrada saíram com
// "SUA MARCA", "@seuperfil", "#SUAHASHTAG" impressos, e o selo do rodapé cobria
// o subtítulo da capa. Este ensaio usa o renderer real, sem IA e sem créditos.
const photo = `data:image/jpeg;base64,${readFileSync(new URL('../../public/landing/hero-creator-photo.jpg', import.meta.url)).toString('base64')}`;
const SOCIAIS = VISUAL_PRESETS.filter(p => p.productKind !== 'apresentacao');
// Termos dos presets DO MOONT. Não é filtro de texto de usuário: quem digita
// "SUA EDITORIA" de propósito continua vendo o texto (marca-assinatura.spec.js).
const PROVISORIOS = ['SUA MARCA', '@SEUPERFIL', '#SUAHASHTAG', 'SUA EDITORIA', 'SUA CATEGORIA', 'DESTAQUE', 'TENDÊNCIAS', 'ESTUDO DE CASO', 'VEJA O CASO COMPLETO'];
const APOIOS = [
  'Apoio curto para conferir a base do texto.',
  'Um apoio de tamanho médio, com duas linhas no card, para ver a base do texto junto do rodapé.',
  'Um apoio longo, no teto do Balanceado, que ocupa três linhas inteiras do card e precisa continuar legível acima do selo.',
];
const cards = () => [0, 1, 2, 3, 4].map(i => ({
  id: `assinatura-${i}`, num: i + 1, title: i === 0 ? 'A capa precisa ficar inteira' : `Card ${i + 1} com título de duas linhas`,
  subtitle: APOIOS[i % APOIOS.length], bodyAfterImage: i > 0 ? 'Condição que precisa aparecer.' : '',
  imageQuery: i === 2 ? '' : 'cena ilustrativa', bgImage: i === 2 ? null : photo, elementsUnlocked: true, useCultureLayout: false,
}));

async function abrir(page, { preset, brand, slides }) {
  const project = { id: 'assinatura-fixture', name: preset.label, doc: {
    fmt: 'carrossel', productKind: 'carrossel', creativePreset: 'livre', visualPreset: preset.id, brand, slides,
  } };
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.setViewportSize({ width: 1680, height: 1000 });
  await page.addInitScript(p => {
    if (sessionStorage.getItem('assinatura-fixture')) return;
    sessionStorage.setItem('assinatura-fixture', '1');
    localStorage.setItem('vc_library', JSON.stringify([p]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(p.id));
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
  }, project);
  await page.goto('/?app=1');
  await enterEditorFromHome(page);
  const superficie = page.locator('main [data-vc-card-surface]');
  await expect(superficie).toHaveCount(slides.length);
  // As fontes do padrão são pedidas depois do primeiro render. Sem esperar a
  // fila esvaziar, a captura saía com a fonte reserva em um ou outro padrão.
  await page.waitForFunction(async () => {
    await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 250));
    return document.fonts.status === 'loaded';
  });
  return superficie;
}

// Capturas em 2×: a 1× o card de 360 px deixa o texto pequeno do rodapé com
// poucos pixels por letra, e a imagem parece serrilhada sem que o card esteja.
test.use({ deviceScaleFactor: 2 });

/** Sobreposições entre selo/barra do rodapé e o TEXTO renderizado nas zonas,
 *  e entre os próprios ornamentos (selo por cima da barra). */
const colisoes = card => card.evaluate(el => {
  const caixa = n => { const r = n.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
  const ornamentos = [...el.querySelectorAll('[data-vc-chrome="pill"], [data-vc-chrome="footerBar"]')].map(n => ({ nome: n.dataset.vcChrome, ...caixa(n) }));
  const textos = [...el.querySelectorAll('[data-vc-zone] p, [data-vc-zone] h1, [data-vc-zone] h2, [data-vc-zone] h3')]
    .filter(n => n.textContent.trim()).map(n => ({ texto: n.textContent.trim().slice(0, 40), ...caixa(n) }));
  const achados = [];
  for (const o of ornamentos) for (const t of textos) {
    const cruza = t.l < o.r - 1 && o.l < t.r - 1 && t.t < o.b - 1 && o.t < t.b - 1;
    if (cruza) achados.push(`${o.nome} × "${t.texto}"`);
  }
  for (let a = 0; a < ornamentos.length; a++) for (let b = a + 1; b < ornamentos.length; b++) {
    const x = ornamentos[a], y = ornamentos[b];
    if (x.l < y.r - 1 && y.l < x.r - 1 && x.t < y.b - 1 && y.t < x.b - 1) achados.push(`${x.nome} × ${y.nome}`);
  }
  return { ornamentos: ornamentos.length, textos: textos.length, achados };
});

/** Contraste WCAG entre o texto do selo e o fundo dele (translúcido: sobre a foto escurecida). */
const contrasteDoSelo = card => card.evaluate(el => {
  const selo = el.querySelector('[data-vc-chrome="pill"] > div');
  if (!selo) return null;
  const ler = (valor) => { const n = valor.match(/[\d.]+/g).map(Number); return { r: n[0], g: n[1], b: n[2], a: n[3] ?? 1 }; };
  const estilo = getComputedStyle(selo);
  const fundo = ler(estilo.backgroundColor), texto = ler(estilo.color);
  const visto = ['r', 'g', 'b'].map(c => fundo[c] * fundo.a + 40 * (1 - fundo.a));
  const lum = ([r, g, b]) => [r, g, b].map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((soma, v, i) => soma + v * [0.2126, 0.7152, 0.0722][i], 0);
  const a = lum([texto.r, texto.g, texto.b]), b = lum(visto);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
});

for (const preset of SOCIAIS) test(`sem marca: ${preset.id} não imprime texto provisório nem cobre o texto`, async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  const brand = applyVisualPreset({ name: 'Padrão', handle: '', showHandle: false, logo: null }, preset.id);
  const slides = applySocialVisualComposition(cards(), { preset, brand, formato: 'carrossel' });
  const superficie = await abrir(page, { preset, brand, slides });
  for (let i = 0; i < slides.length; i++) {
    const card = superficie.nth(i);
    const texto = (await card.innerText()).toUpperCase();
    for (const termo of PROVISORIOS) expect(texto, `card ${i + 1} de ${preset.id}`).not.toContain(termo);
    expect(texto).not.toContain('{');
    const r = await colisoes(card);
    expect(r.textos, 'o card tem texto nas zonas').toBeGreaterThan(0);
    expect(r.achados, `card ${i + 1} de ${preset.id}`).toEqual([]);
    if (i < 2) await card.screenshot({ path: testInfo.outputPath(`${preset.id}-sem-marca-${i + 1}.png`) });
  }
});

for (const preset of SOCIAIS) test(`com assinatura: ${preset.id} mantém selo e barra fora do texto`, async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  // Assinatura inteira preenchida pela pessoa: o pior caso para o rodapé.
  const brand = { ...applyVisualPreset({ name: 'Ateliê Traço', handle: 'atelietraco', showHandle: false, logo: null }, preset.id),
    footerPillText: 'ARRASTA PRO LADO', footerPillArrow: true,
    footerBarLeft: 'Tema|Retratos', footerBarCenter: 'Por|Ateliê Traço', footerBarRight: 'Salve|para depois' };
  const slides = applySocialVisualComposition(cards(), { preset, brand, formato: 'carrossel' });
  const superficie = await abrir(page, { preset, brand, slides });
  for (let i = 0; i < slides.length; i++) {
    const card = superficie.nth(i);
    await expect(card).toContainText('ARRASTA PRO LADO');
    await expect(card).toContainText('Retratos');
    const r = await colisoes(card);
    expect(r.ornamentos).toBeGreaterThanOrEqual(2);
    expect(r.achados, `card ${i + 1} de ${preset.id}`).toEqual([]);
    expect(await contrasteDoSelo(card), `texto do selo no card ${i + 1} de ${preset.id}`).toBeGreaterThanOrEqual(4.5);
    if (i < 2) await card.screenshot({ path: testInfo.outputPath(`${preset.id}-com-assinatura-${i + 1}.png`) });
  }
});

test('projeto antigo: zonas gravadas sob o selo sobem no render', async ({ page }) => {
  test.setTimeout(45_000);
  const preset = VISUAL_PRESETS.find(p => p.id === 'viral_hype_dark');
  const brand = applyVisualPreset({ name: 'Padrão', handle: '', showHandle: false, logo: null }, preset.id);
  // Geometria anterior à reserva: capa com apoio até 91% e selo por cima.
  const antigos = applySocialVisualComposition(cards(), { preset, brand: { ...brand, footerPillText: '' }, formato: 'carrossel' })
    .map(({ socialCompositionVersion, ...slide }) => slide);
  // Sem selo, o apoio da capa termina em 91%: por baixo de onde o selo vai entrar.
  expect(antigos[0].canvas.zones.subtitle.y + antigos[0].canvas.zones.subtitle.h).toBe(91);
  const superficie = await abrir(page, { preset, brand, slides: antigos });
  for (let i = 0; i < antigos.length; i++) {
    const r = await colisoes(superficie.nth(i));
    expect(r.ornamentos).toBe(1);
    expect(r.achados, `card ${i + 1}`).toEqual([]);
  }
});

test('alinhamento do preset chega ao card', async ({ page }) => {
  test.setTimeout(45_000);
  const preset = VISUAL_PRESETS.find(p => p.id === 'minimal_clean');
  const brand = applyVisualPreset({ name: 'Padrão', handle: '', showHandle: false, logo: null }, preset.id);
  const slides = applySocialVisualComposition(cards(), { preset, brand, formato: 'carrossel' });
  const superficie = await abrir(page, { preset, brand, slides });
  const alinhamentos = await superficie.nth(1).evaluate(el => [...el.querySelectorAll('[data-vc-zone]')].map(n => getComputedStyle(n).textAlign));
  expect(alinhamentos.length).toBeGreaterThan(0);
  for (const a of alinhamentos) expect(a).toBe('center');
});
