import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const publicDir = path.join(root, 'public');
const sourceDir = path.join(publicDir, 'landing/moont-v3/source');
const formatsDir = path.join(publicDir, 'landing/moont-v3/formats');
const productDir = path.join(publicDir, 'landing/moont-v3/product');
const tempDir = path.join(root, '.tmp/moont-product-assets');
let baseUrl = process.env.MOONT_CAPTURE_BASE_URL || '';
let captureServer = null;

await Promise.all([
  mkdir(formatsDir, { recursive: true }),
  mkdir(productDir, { recursive: true }),
  mkdir(tempDir, { recursive: true }),
]);

const webpDataUrl = async (file) => {
  const bytes = await readFile(path.join(sourceDir, file));
  return `data:image/webp;base64,${bytes.toString('base64')}`;
};

const [founderPhoto, crossingPhoto] = await Promise.all([
  webpDataUrl('01-founder-editorial.webp'),
  webpDataUrl('02-crossing-evening.webp'),
]);

const convertToWebp = (png, webp, quality = 89) => {
  const result = spawnSync('cwebp', ['-quiet', '-q', String(quality), '-m', '6', png, '-o', webp], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`cwebp falhou para ${webp}: ${result.stderr}`);
};

const commonPanelCss = String.raw`
  * { box-sizing: border-box; }
  html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  .board { position: relative; width: 1600px; height: 1000px; overflow: hidden; }
  .kicker { position: absolute; left: 62px; top: 48px; font: 800 12px/1 ui-monospace, monospace; letter-spacing: .16em; text-transform: uppercase; }
  .title { position: absolute; left: 60px; top: 78px; max-width: 880px; margin: 0; font-size: 56px; line-height: .96; letter-spacing: -.055em; }
  .note { position: absolute; right: 64px; top: 64px; width: 360px; margin: 0; font-size: 16px; line-height: 1.42; }
  .serial { position: absolute; right: 28px; bottom: 22px; font: 700 10px/1 ui-monospace, monospace; letter-spacing: .12em; opacity: .64; }
  .frame { position: absolute; overflow: hidden; box-shadow: 0 28px 70px rgba(8,8,14,.24); }
  .eyebrow { font: 800 10px/1 ui-monospace, monospace; letter-spacing: .13em; text-transform: uppercase; }
`;

const comunicaPanel = String.raw`
<main class="board comunica">
  <span class="kicker">Moont Comunica · campanha editorial</span>
  <h1 class="title">Uma pauta.<br>Quatro viradas.</h1>
  <p class="note">Impacto abre a conversa. Contexto sustenta o interesse. Cada card muda a forma sem perder a mesma ideia.</p>
  <article class="frame card c1">
    <div class="portrait"></div><div class="shade"></div><span class="count">01/04</span>
    <div class="cover-copy"><span class="eyebrow">MARCA / MEMÓRIA</span><h2>SER VISTA<br>NÃO É SER<br><i>LEMBRADA.</i></h2><p>Três escolhas que tiram uma marca do ruído.</p></div>
  </article>
  <article class="frame card c2"><span class="count">02/04</span><span class="eyebrow">O PROBLEMA</span><strong>7</strong><h2>segundos de atenção não compensam uma identidade genérica.</h2><div class="rule"></div></article>
  <article class="frame card c3"><span class="count">03/04</span><span class="eyebrow">O SISTEMA</span><h2>REPITA<br>O CÓDIGO.<br><em>MUDE A<br>FORMA.</em></h2><div class="orbit"></div></article>
  <article class="frame card c4"><span class="count">04/04</span><span class="eyebrow">PRÓXIMO GESTO</span><h2>Qual detalhe faria alguém reconhecer sua marca sem ver o logo?</h2><div class="cta">SALVE PARA O PRÓXIMO BRIEF <b>↗</b></div></article>
  <span class="serial">MOONT / COMUNICA / 01</span>
</main>
<style>
  .comunica { background:#eee8dc; color:#16151d; }
  .comunica::after { content:""; position:absolute; right:-120px; top:-180px; width:520px; height:520px; border:70px solid #173cbd; border-radius:50%; opacity:.16; }
  .comunica .kicker { color:#ef4a31; } .comunica .note { color:#57535b; border-left:2px solid #ef4a31; padding-left:18px; }
  .card { width:310px; height:388px; top:300px; border-radius:7px; }
  .c1 { left:62px; width:360px; height:450px; top:254px; color:#fff; }
  .c2 { left:458px; background:#f8f2e8; border:1px solid rgba(22,21,29,.17); padding:28px; }
  .c3 { left:804px; top:270px; background:#173cbd; color:#fff; padding:28px; }
  .c4 { left:1150px; top:310px; background:#d9ff52; padding:28px; }
  .portrait { position:absolute; inset:0; background:url('${founderPhoto}') center 30% / cover no-repeat; }
  .shade { position:absolute; inset:0; background:linear-gradient(180deg,transparent 22%,rgba(7,12,35,.88) 96%); }
  .count { position:absolute; right:20px; top:18px; font:700 10px/1 ui-monospace, monospace; letter-spacing:.09em; }
  .cover-copy { position:absolute; left:28px; right:24px; bottom:27px; }
  .cover-copy .eyebrow { color:#d9ff52; }.cover-copy h2 { margin:14px 0 10px; font-size:47px; line-height:.82; letter-spacing:-.065em; }.cover-copy h2 i { color:#d9ff52; font-style:normal; }.cover-copy p { max-width:250px; margin:0; font-size:13px; line-height:1.28; }
  .c2 strong { display:block; margin:62px 0 4px; color:#ef4a31; font:500 106px/.8 Georgia,serif; letter-spacing:-.08em; }.c2 h2 { margin:0; font:400 25px/1.04 Georgia,serif; letter-spacing:-.035em; }.c2 .rule { position:absolute; left:28px; right:28px; bottom:30px; height:6px; background:#173cbd; }
  .c3 h2 { position:relative; z-index:2; margin:64px 0 0; font-size:40px; line-height:.88; letter-spacing:-.06em; }.c3 h2 em { color:#d9ff52; font-style:normal; }.c3 .orbit { position:absolute; right:-76px; bottom:-76px; width:220px; height:220px; border:34px solid #ef4a31; border-radius:50%; }
  .c4 h2 { margin:72px 0 0; font:400 32px/1.02 Georgia,serif; letter-spacing:-.04em; }.c4 .cta { position:absolute; left:28px; right:28px; bottom:28px; padding:15px 0 11px; border-top:2px solid #16151d; font:800 9px/1 ui-monospace,monospace; letter-spacing:.08em; }.c4 .cta b { float:right; font-size:17px; }
</style>`;

const apresentaPanel = String.raw`
<main class="board apresenta">
  <span class="kicker">Moont Apresenta · relatório estratégico</span>
  <h1 class="title">Uma tese.<br>Seis decisões.</h1>
  <p class="note">Capa que enquadra, evidência que organiza e recomendação que deixa o próximo movimento explícito.</p>
  <section class="frame slide main"><div class="main-photo"></div><div class="main-copy"><span class="eyebrow">RELATÓRIO DE COMPORTAMENTO · 2026</span><h2>A atenção<br>mudou de lugar.</h2><p>Sinais para marcas que precisam decidir agora.</p></div><span class="index">01 / 06</span></section>
  <section class="frame slide data"><span class="eyebrow">SINAL 02 · EXEMPLO ILUSTRATIVO</span><strong>63%</strong><h3>decidem antes de comparar todas as opções.</h3><div class="bars"><i></i><i></i><i></i></div><span class="index">03 / 06</span></section>
  <section class="frame slide actions"><span class="eyebrow">O QUE FAZER AGORA</span><h3>Três códigos para ser reconhecido antes do clique.</h3><ol><li><b>01</b> contraste</li><li><b>02</b> consistência</li><li><b>03</b> repetição</li></ol><span class="index">05 / 06</span></section>
  <span class="serial">MOONT / APRESENTA / 01</span>
</main>
<style>
  .apresenta { background:#171913; color:#f4f1e9; }.apresenta::before { content:""; position:absolute; inset:0; opacity:.13; background-image:linear-gradient(to right,#d9ff52 1px,transparent 1px),linear-gradient(to bottom,#d9ff52 1px,transparent 1px); background-size:52px 52px; }
  .apresenta .kicker { color:#d9ff52; }.apresenta .note { color:#b9b9b0; }
  .slide { border:1px solid rgba(217,255,82,.38); border-radius:7px; }.slide .index { position:absolute; right:20px; bottom:17px; font:700 9px/1 ui-monospace,monospace; letter-spacing:.1em; }
  .main { left:60px; top:250px; width:930px; height:523px; background:#0e1119; }.main-photo { position:absolute; inset:0 0 0 43%; background:url('${crossingPhoto}') 58% center / cover no-repeat; }.main-photo::after { content:""; position:absolute; inset:0; background:linear-gradient(90deg,#0e1119 0%,rgba(14,17,25,.08) 52%); }.main-copy { position:absolute; z-index:2; left:46px; top:52px; width:440px; }.main-copy .eyebrow { color:#d9ff52; }.main-copy h2 { margin:90px 0 20px; font:400 58px/.94 Georgia,serif; letter-spacing:-.055em; }.main-copy p { max-width:340px; color:#c9cbd0; font-size:16px; line-height:1.35; }
  .data { left:1030px; top:250px; width:500px; height:281px; padding:28px; background:#f1eee7; color:#151620; }.data strong { display:block; margin:34px 0 4px; color:#173cbd; font-size:76px; line-height:.78; letter-spacing:-.075em; }.data h3 { width:285px; margin:10px 0 0; font-size:18px; line-height:1.15; }.bars { position:absolute; right:34px; bottom:42px; display:flex; align-items:end; gap:8px; height:92px; }.bars i { display:block; width:18px; background:#ef4a31; }.bars i:nth-child(1){height:34px}.bars i:nth-child(2){height:62px}.bars i:nth-child(3){height:92px}
  .actions { left:1030px; top:555px; width:500px; height:281px; padding:28px; background:#d9ff52; color:#151620; }.actions h3 { width:390px; margin:27px 0 18px; font:400 25px/1.06 Georgia,serif; letter-spacing:-.03em; }.actions ol { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:0; padding:0; list-style:none; }.actions li { padding-top:10px; border-top:2px solid #151620; font-size:12px; }.actions li b { display:block; margin-bottom:7px; font:700 9px/1 ui-monospace,monospace; }
</style>`;

const sessionResponse = {
  active: true,
  email: 'capture@local.test',
  status: 'active',
  tier: 'creator',
  imageQuota: { limit: 50, remaining: 50, used: 0 },
};

const setStorage = ({ doc, id, name }) => {
  const now = Date.now();
  localStorage.setItem('vc_library', JSON.stringify([{
    id, name, status: 'draft', folderId: '', publicationDate: '', createdAt: now, updatedAt: now, doc,
  }]));
  localStorage.setItem('vc_active_doc_id', JSON.stringify(id));
  localStorage.setItem('vc_shell_view', JSON.stringify('project'));
  localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
  localStorage.setItem('vc_onboarding_done', '1');
  localStorage.setItem('vc_modes_intro_done', '1');
};

const ensureCaptureServer = async () => {
  if (baseUrl) return baseUrl;
  captureServer = await createServer({
    root,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await captureServer.listen();
  const address = captureServer.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('Não foi possível iniciar o Vite para as capturas.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  return baseUrl;
};

const browser = await chromium.launch({ headless: true });

try {
  const panelPage = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  for (const [name, markup] of [['01-comunica-panel', comunicaPanel], ['02-apresenta-panel', apresentaPanel]]) {
    await panelPage.setContent(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${commonPanelCss}</style></head><body>${markup}</body></html>`, { waitUntil: 'load' });
    await panelPage.evaluate(() => document.fonts.ready);
    const png = path.join(tempDir, `${name}.png`);
    const webp = path.join(formatsDir, `${name}.webp`);
    await panelPage.screenshot({ path: png, type: 'png' });
    convertToWebp(png, webp);
    console.log(`✓ ${path.relative(root, webp)}`);
  }
  await panelPage.close();

  await ensureCaptureServer();

  const setupPage = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await setupPage.route('**/api/auth/session', (route) => route.fulfill({ json: sessionResponse }));
  try {
    await setupPage.goto(`${baseUrl}/?app=1`, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    throw new Error(`Não foi possível abrir o Studio para capturar os assets em ${baseUrl}. ${error.message}`);
  }

  const docs = await setupPage.evaluate(async () => {
    const { DEFAULT_DOC, DEFAULT_BRAND, mkSlide } = await import('/src/utils/doc-schema.js');
    const { applyPresentationVisualPresetToDoc } = await import('/src/utils/presentation-state.js');
    const { getPresentationCompositionOverrides } = await import('/src/styles/presentation-presets.jsx');

    const carouselImages = [
      '/landing/moont-v3/carousel-source/01-product-codes.webp',
      null,
      '/landing/moont-v3/carousel-source/02-founder-presence.webp',
      null,
      '/landing/moont-v3/carousel-source/03-creator-campaign.webp',
      null,
    ];
    const carouselTitles = [
      'Antes do logo, vêm os códigos.',
      'O problema não é alcance. É parecer igual.',
      'Autoridade também tem linguagem visual.',
      'Forma muda. Direção permanece.',
      'Sua presença também faz parte da marca.',
      'Qual detalhe só poderia ser seu?',
    ];
    const carouselSubtitles = [
      'Cor, forma e contraste constroem reconhecimento.',
      'Mais volume não corrige uma identidade genérica.',
      'Ambiente, enquadramento e presença reforçam a percepção.',
      'Cada slide avança a ideia sem perder a assinatura.',
      'Luz, gesto e enquadramento repetem a mesma direção.',
      'Salve esta pergunta para o próximo briefing.',
    ];
    const carousel = {
      ...DEFAULT_DOC,
      fmt: 'carrossel',
      quickCardCount: '6',
      brand: {
        ...DEFAULT_BRAND,
        name: 'Moont',
        bg: '#111118',
        bgAlternate: '#173cbd',
        interleaveBg: true,
        titleColor: '#f4f1e9',
        subtitleColor: '#d9ff52',
        textColor: '#d0cdd5',
        accent: '#d9ff52',
      },
      slides: carouselTitles.map((title, index) => ({
        ...mkSlide(index + 1, DEFAULT_BRAND),
        id: `capture-carousel-${index + 1}`,
        title,
        subtitle: carouselSubtitles[index],
        bgImage: carouselImages[index],
        imageQuery: carouselImages[index] ? `editorial image ${index + 1}` : '',
        overlay: carouselImages[index] ? 56 : 0,
        align: index === 1 || index === 3 ? 'left' : 'center',
        titleSize: index === 1 ? 76 : 92,
        subSize: 90,
      })),
    };

    const roles = ['context', 'content', 'question', 'data', 'demo', 'decision'];
    const titles = [
      'A atenção mudou de lugar',
      'Volume cresceu. Relevância ficou seletiva.',
      'Onde a decisão realmente acontece?',
      'Uma direção só existe quando o time a compartilha.',
      'Referência só vira direção quando existe critério.',
      'Presença é coerência percebida',
    ];
    const subtitles = [
      'Sinais de comportamento para marcas que precisam decidir agora.',
      'A audiência filtra antes de comparar. Reconhecimento reduz esforço.',
      'Deslocamento, ponto de venda e experiência cultural mudam o contexto.',
      'Critérios comuns transformam opinião em decisão.',
      'Agrupe sinais, compare caminhos e escolha o que a tese precisa provar.',
      'Defina responsável, prazo e primeiro checkpoint antes de encerrar.',
    ];
    const images = [
      '/landing/moont-v3/source/02-crossing-evening.webp',
      null,
      null,
      '/landing/moont-v2/portraits/07-team-critique.webp',
      '/landing/moont-v2/portraits/02-designer-overhead.webp',
      null,
    ];
    const rawSlides = titles.map((title, index) => ({
      ...mkSlide(index + 1, DEFAULT_BRAND),
      id: `capture-presentation-${index + 1}`,
      title,
      subtitle: subtitles[index],
      bgImage: images[index],
      imageQuery: images[index] ? `editorial evidence ${roles[index]}` : '',
      bodyAfterImage: index === 3 ? 'Leitura demonstrativa · outubro de 2026' : '',
    }));
    let presentation = applyPresentationVisualPresetToDoc({
      ...DEFAULT_DOC,
      presentationPath: 'pitch',
      quickCardCount: 6,
      slides: rawSlides,
      caption: 'Atlas da atenção — deck de demonstração.',
    }, 'presentation_premium_dark', undefined, { initialize: true });
    presentation.slides = presentation.slides.map((slide, index) => ({
      ...slide,
      ...getPresentationCompositionOverrides('presentation_premium_dark', {
        slide,
        stage: { visualRole: roles[index] },
        index,
        count: 6,
      }),
      presentationStageId: roles[index],
      presentationStageLabel: roles[index].toUpperCase(),
      presentationVisualRole: roles[index],
      bgImage: images[index],
    }));

    const workflowRoles = ['context', 'content', 'contrast', 'data', 'demo', 'decision'];
    const workflowTitles = [
      'A IDEIA.\nNÃO TERMINA\nNO POST.',
      'O CÓDIGO\nCONTINUA.',
      'MUDE A FORMA. SEGURE O CÓDIGO.',
      '3 SINAIS. 1 MARCA.',
      'PRODUTO, PESSOA, PROPÓSITO.',
      'PARE DE RECOMEÇAR.',
    ];
    const workflowSubtitles = [
      'DO POST AO DECK',
      'COR · FORMA · CONTRASTE',
      'Carrossel, apresentação e story variam sem perder a direção.',
      'Contraste. Consistência. Presença.',
      'O sistema visual liga cada ponto da campanha.',
      'Transforme o próximo brief em uma direção que continua.',
    ];
    const workflowImages = [
      '/landing/moont-v3/source/01-founder-editorial.webp',
      '/landing/moont-v3/source/03-product-still-life.webp',
      '/landing/moont-v3/carousel-source/01-product-codes.webp',
      null,
      '/landing/moont-v3/carousel-source/03-creator-campaign.webp',
      '/landing/moont-v3/carousel-source/02-founder-presence.webp',
    ];
    const workflowRawSlides = workflowTitles.map((title, index) => ({
      ...mkSlide(index + 1, DEFAULT_BRAND),
      id: `capture-workflow-${index + 1}`,
      title,
      subtitle: workflowSubtitles[index],
      bgImage: workflowImages[index],
      imageQuery: workflowImages[index] ? `brand campaign system ${workflowRoles[index]}` : '',
    }));
    let workflowPresentation = applyPresentationVisualPresetToDoc({
      ...DEFAULT_DOC,
      presentationPath: 'pitch',
      quickCardCount: 6,
      slides: workflowRawSlides,
      caption: 'Direção que continua — deck de campanha Moont.',
    }, 'presentation_typographic_bold', undefined, { initialize: true });
    workflowPresentation.brand = {
      ...workflowPresentation.brand,
      name: 'Moont',
      bg: '#f4f1e9',
      bgAlternate: '#173cbd',
      interleaveBg: false,
      titleColor: '#111118',
      subtitleColor: '#5148dd',
      textColor: '#47444d',
      accent: '#d7ff5a',
      titleFont: 'var(--font-display)',
      subtitleFont: 'var(--font-ui)',
      bodyFont: 'var(--font-ui)',
      textTitleWeight: 820,
      textTitleCase: 'upper',
      textTitleTracking: -4,
      subtitleWeight: 760,
      subtitleCase: 'upper',
      textSubTracking: 10,
    };
    workflowPresentation.slides = workflowPresentation.slides.map((slide, index) => {
      const presetOverrides = getPresentationCompositionOverrides('presentation_typographic_bold', {
        slide,
        stage: { visualRole: workflowRoles[index] },
        index,
        count: 6,
      });
      const canvas = index <= 1
        ? {
            ...presetOverrides.canvas,
            zones: {
              photo: { x: 0, y: 0, w: 100, h: 100 },
              title: { x: 5, y: 19, w: index === 0 ? 44 : 52, h: 68 },
              subtitle: { x: 5, y: 8, w: 46, h: 8 },
            },
          }
        : presetOverrides.canvas;
      const titleAccent = index === 0 ? 'POST.' : index === 1 ? 'CONTINUA.' : '';
      const accentStart = titleAccent ? workflowTitles[index].indexOf(titleAccent) : -1;
      return {
        ...slide,
        ...presetOverrides,
        canvas,
        customBg: index <= 1 ? '#07152f' : '#f4f1e9',
        presentationStageId: workflowRoles[index],
        presentationStageLabel: workflowRoles[index].toUpperCase(),
        presentationVisualRole: workflowRoles[index],
        presentationTypographyByComposition: {},
        presentationTitleSizeByComposition: {},
        presentationTitleLeadingByComposition: {},
        bgImage: workflowImages[index],
        bgX: index === 0 ? 50 : 50,
        bgY: index === 0 ? 10 : 50,
        overlay: index <= 1 ? 42 : presetOverrides.overlay,
        titleSize: index === 0 ? 144 : index === 1 ? 116 : 78,
        titleWeight: 820,
        titleTracking: -4,
        titleLeading: index === 0 ? 86 : 94,
        titleCase: 'upper',
        subSize: index <= 1 ? 42 : 52,
        subTracking: index <= 1 ? 10 : 1,
        subLeading: 122,
        textShadow: index > 1,
        destaqueSpans: accentStart >= 0
          ? { ...(slide.destaqueSpans || {}), title: [[accentStart, accentStart + titleAccent.length]] }
          : slide.destaqueSpans,
      };
    });
    return { carousel, presentation, workflowPresentation };
  });
  await setupPage.close();

  const captureProduct = async ({ doc, id, name, viewport, selectedIndex, filename, deviceScaleFactor = 1, focusSelectedCard = false, clip = null }) => {
    const context = await browser.newContext({ viewport, deviceScaleFactor });
    await context.addInitScript(setStorage, { doc, id, name });
    const page = await context.newPage();
    await page.route('**/api/auth/session', (route) => route.fulfill({ json: sessionResponse }));
    await page.goto(`${baseUrl}/?app=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('[data-vc-tour="thumbnails"] .slide-thumb').length >= 6);
    const thumbnails = page.locator('[data-vc-tour="thumbnails"] .slide-thumb');
    if (selectedIndex > 0) await thumbnails.nth(selectedIndex).click();
    if (focusSelectedCard && viewport.width > 760) {
      await page.getByLabel(`Visualizar card ${selectedIndex + 1} em tela cheia`).scrollIntoViewIfNeeded();
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      const images = [...document.images].filter((img) => {
        const rect = img.getBoundingClientRect();
        return rect.bottom >= 0 && rect.top <= window.innerHeight && rect.right >= 0 && rect.left <= window.innerWidth;
      });
      const backgroundUrls = [...document.querySelectorAll('*')].flatMap((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) return [];
        const value = getComputedStyle(element).backgroundImage;
        return [...value.matchAll(/url\(["']?(.*?)["']?\)/g)].map((match) => match[1]);
      });
      const backgroundImages = [...new Set(backgroundUrls)].map((src) => {
        const image = new Image();
        image.src = src;
        return image;
      });
      await Promise.all([...images, ...backgroundImages].map(async (img) => {
        if (!img.complete) {
          await new Promise((resolve, reject) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', () => reject(new Error(`Falha ao carregar imagem da captura: ${img.currentSrc || img.src}`)), { once: true });
          });
        }
        if (img.naturalWidth === 0) throw new Error(`Imagem sem pixels na captura: ${img.currentSrc || img.src}`);
        if (typeof img.decode === 'function') await img.decode();
      }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const png = path.join(tempDir, `${filename}.png`);
    const webp = path.join(productDir, `${filename}.webp`);
    await page.screenshot({ path: png, type: 'png', fullPage: false, ...(clip ? { clip } : {}) });
    convertToWebp(png, webp, 88);
    console.log(`✓ ${path.relative(root, webp)}`);
    await context.close();
  };

  await captureProduct({
    doc: docs.carousel,
    id: 'moont-comunica-demo',
    name: 'Marca que fica',
    viewport: { width: 1600, height: 1000 },
    selectedIndex: 0,
    filename: '01-interface-comunica-desktop',
  });
  await captureProduct({
    doc: docs.presentation,
    id: 'moont-apresenta-demo',
    name: 'Atlas da atenção',
    viewport: { width: 1600, height: 1000 },
    selectedIndex: 3,
    filename: '02-interface-apresenta-desktop',
  });
  await captureProduct({
    doc: docs.carousel,
    id: 'moont-mobile-demo',
    name: 'Marca que fica',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    selectedIndex: 4,
    filename: '03-interface-mobile',
  });
  await captureProduct({
    doc: docs.workflowPresentation,
    id: 'moont-workflow-demo',
    name: 'Direção que continua',
    viewport: { width: 1600, height: 1000 },
    selectedIndex: 0,
    clip: { x: 0, y: 0, width: 1420, height: 700 },
    filename: '04-interface-workflow-desktop-v2',
  });
  await captureProduct({
    doc: docs.carousel,
    id: 'moont-responsive-demo',
    name: 'Marca que fica',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    selectedIndex: 0,
    filename: '05-interface-responsive-mobile',
  });
  await captureProduct({
    doc: docs.carousel,
    id: 'moont-hero-demo',
    name: 'Marca que fica',
    viewport: { width: 1600, height: 1000 },
    selectedIndex: 0,
    clip: { x: 318, y: 134, width: 1140, height: 610 },
    filename: '06-interface-hero-desktop',
  });
} finally {
  await browser.close();
  if (captureServer) await captureServer.close();
  await rm(tempDir, { recursive: true, force: true });
}
