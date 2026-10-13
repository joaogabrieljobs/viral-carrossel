#!/usr/bin/env node

/**
 * Deterministic export generator for the Moont Sequence identity.
 *
 * Vector geometry and wordmark outlines are read directly from BrandLogo.jsx,
 * so the downloadable assets cannot silently drift from the product logo.
 */

import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const componentPath = path.join(repoRoot, 'src/components/BrandLogo.jsx');
const kitRoot = path.join(repoRoot, 'assets/brand/moont-sequence');

const COLORS = Object.freeze({
  midnight: '#090A0F',
  graphite: '#181B25',
  moonlight: '#F3F0E7',
  mist: '#BBB9C7',
  orbitalBlue: '#5B53E8',
  aurora: '#D7FF5A',
  black: '#000000',
  white: '#FFFFFF',
});

const VARIANTS = Object.freeze({
  'color-on-light': {
    label: 'Colorida para fundo claro',
    usage: 'superfícies claras',
    wordmark: COLORS.midnight,
    firstTile: COLORS.midnight,
    secondTile: COLORS.orbitalBlue,
    thirdTile: COLORS.aurora,
  },
  'color-on-dark': {
    label: 'Colorida para fundo escuro',
    usage: 'superfícies escuras',
    wordmark: COLORS.moonlight,
    firstTile: COLORS.moonlight,
    secondTile: COLORS.orbitalBlue,
    thirdTile: COLORS.aurora,
  },
  black: {
    label: 'Monocromática preta',
    usage: 'produção em uma cor sobre fundo claro',
    wordmark: COLORS.black,
    firstTile: COLORS.black,
    secondTile: COLORS.black,
    thirdTile: COLORS.black,
  },
  white: {
    label: 'Monocromática branca',
    usage: 'produção em uma cor sobre fundo escuro',
    wordmark: COLORS.white,
    firstTile: COLORS.white,
    secondTile: COLORS.white,
    thirdTile: COLORS.white,
  },
});

const WORDMARK_SIZES = Object.freeze([
  [480, 128],
  [960, 256],
  [1920, 512],
]);

const SYMBOL_SIZES = Object.freeze([128, 256, 512, 1024]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeHex(hex) {
  return hex.toUpperCase();
}

async function extractSourceVectors() {
  const source = await fs.readFile(componentPath, 'utf8');
  const sequenceBlock = source.match(/function SequenceMark\(\)\s*\{[\s\S]*?<g>([\s\S]*?)<\/g>/)?.[1];
  const wordmarkBlock = source.match(/function MoontWordmark\(\)\s*\{[\s\S]*?<g fill="currentColor">([\s\S]*?)<\/g>/)?.[1];

  if (!sequenceBlock || !wordmarkBlock) {
    throw new Error('Não foi possível localizar SequenceMark ou MoontWordmark em BrandLogo.jsx.');
  }

  const rects = [...sequenceBlock.matchAll(/<rect\s+x="([^"]+)"\s+y="([^"]+)"\s+width="([^"]+)"\s+height="([^"]+)"\s+rx="([^"]+)"\s+fill=\{[^}]+\}\s*\/>/g)]
    .map((match) => ({ x: match[1], y: match[2], width: match[3], height: match[4], rx: match[5] }));
  const paths = [...wordmarkBlock.matchAll(/<path d="([^"]+)"\s*\/>/g)].map((match) => match[1]);

  if (rects.length !== 3 || paths.length !== 5) {
    throw new Error(`Geometria inesperada em BrandLogo.jsx: ${rects.length} retângulos e ${paths.length} paths.`);
  }

  return {
    rects,
    paths,
    sourceHash: sha256(JSON.stringify({ rects, paths })),
  };
}

function xmlEscape(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function svgDocument({ width, height, viewBox, title, body }) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}" role="img" aria-labelledby="title">`,
    `  <title id="title">${xmlEscape(title)}</title>`,
    body,
    '</svg>',
    '',
  ].join('\n');
}

function sequenceMarkup(rects, colors, indent = '  ') {
  const fills = [colors.firstTile, colors.secondTile, colors.thirdTile];
  return rects.map((rect, index) => (
    `${indent}<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${rect.rx}" fill="${fills[index]}"/>`
  )).join('\n');
}

function wordmarkPathsMarkup(paths, color, indent = '  ') {
  return [
    `${indent}<g fill="${color}">`,
    ...paths.map((d) => `${indent}  <path d="${d}"/>`),
    `${indent}</g>`,
  ].join('\n');
}

function createWordmarkSvg(vectors, variantName, width = 240, height = 64) {
  const colors = VARIANTS[variantName];
  return svgDocument({
    width,
    height,
    viewBox: '0 0 240 64',
    title: `Moont Sequence — ${colors.label}`,
    body: [
      sequenceMarkup(vectors.rects, colors),
      wordmarkPathsMarkup(vectors.paths, colors.wordmark),
    ].join('\n'),
  });
}

function createSymbolSvg(vectors, variantName, size = 64) {
  const colors = VARIANTS[variantName];
  return svgDocument({
    width: size,
    height: size,
    viewBox: '0 0 64 64',
    title: `Símbolo Moont Sequence — ${colors.label}`,
    body: sequenceMarkup(vectors.rects, colors),
  });
}

function createPresentationSvg(vectors, surface) {
  const isDark = surface === 'midnight';
  const variantName = isDark ? 'color-on-dark' : 'color-on-light';
  const colors = VARIANTS[variantName];
  const background = isDark ? COLORS.midnight : COLORS.moonlight;
  return svgDocument({
    width: 1600,
    height: 600,
    viewBox: '0 0 1600 600',
    title: `Moont Sequence sobre fundo ${isDark ? 'Midnight' : 'Moonlight'}`,
    body: [
      `<rect width="1600" height="600" fill="${background}"/>`,
      '<g transform="translate(320 172) scale(4)">',
      sequenceMarkup(vectors.rects, colors, '  '),
      wordmarkPathsMarkup(vectors.paths, colors.wordmark, '  '),
      '</g>',
    ].join('\n'),
  });
}

function createSymbolPresentationSvg(vectors, surface) {
  const isDark = surface === 'midnight';
  const variantName = isDark ? 'color-on-dark' : 'color-on-light';
  const colors = VARIANTS[variantName];
  const background = isDark ? COLORS.midnight : COLORS.moonlight;
  return svgDocument({
    width: 1024,
    height: 1024,
    viewBox: '0 0 1024 1024',
    title: `Símbolo Moont Sequence sobre fundo ${isDark ? 'Midnight' : 'Moonlight'}`,
    body: [
      `<rect width="1024" height="1024" fill="${background}"/>`,
      '<g transform="translate(192 192) scale(10)">',
      sequenceMarkup(vectors.rects, colors, '  '),
      '</g>',
    ].join('\n'),
  });
}

async function ensureParent(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writeText(relativePath, contents) {
  const filePath = path.join(kitRoot, relativePath);
  await ensureParent(filePath);
  await fs.writeFile(filePath, contents, 'utf8');
  return filePath;
}

async function renderSvg(browser, svg, targetPath, width, height, opaque = false) {
  await ensureParent(targetPath);
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await page.setContent(
    `<!doctype html><html><head><style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:transparent}svg{display:block;width:${width}px;height:${height}px}</style></head><body>${svg}</body></html>`,
    { waitUntil: 'load' },
  );
  await page.screenshot({
    path: targetPath,
    type: 'png',
    omitBackground: !opaque,
    clip: { x: 0, y: 0, width, height },
  });
  await context.close();
}

function createManifest(vectors, exportedFiles) {
  return `${JSON.stringify({
    identity: 'Moont Sequence',
    source: 'src/components/BrandLogo.jsx',
    sourceGeometrySha256: vectors.sourceHash,
    viewBoxes: {
      wordmark: '0 0 240 64',
      symbol: '0 0 64 64',
    },
    colors: Object.fromEntries(Object.entries(COLORS).map(([key, value]) => [key, normalizeHex(value)])),
    variants: Object.fromEntries(Object.entries(VARIANTS).map(([key, value]) => [key, {
      label: value.label,
      usage: value.usage,
      wordmark: normalizeHex(value.wordmark),
      tiles: [normalizeHex(value.firstTile), normalizeHex(value.secondTile), normalizeHex(value.thirdTile)],
    }])),
    pngSizes: {
      wordmark: WORDMARK_SIZES.map(([width, height]) => ({ width, height })),
      symbol: SYMBOL_SIZES.map((size) => ({ width: size, height: size })),
      presentationWordmark: [{ width: 1600, height: 600 }],
      presentationSymbol: [{ width: 1024, height: 1024 }],
    },
    files: exportedFiles.sort(),
  }, null, 2)}\n`;
}

function createReadme() {
  return `# Kit de marca — Moont Sequence

Arquivos oficiais da assinatura **Moont Sequence**, preparados para interface, apresentações, documentos, redes sociais e produção gráfica.

## Estrutura

- \`svg/wordmark/\`: assinatura horizontal completa, com símbolo e nome.
- \`svg/symbol/\`: símbolo isolado para avatar, favicon e áreas compactas.
- \`png/wordmark/transparent/\`: assinatura horizontal em três tamanhos (480, 960 e 1920 px), sempre com fundo transparente.
- \`png/symbol/transparent/\`: símbolo isolado de 128 a 1024 px, sempre com fundo transparente.
- \`presentation/\`: arquivos prontos sobre fundos sólidos Moonlight e Midnight.
- \`manifest.json\`: dimensões, cores e inventário legível por sistemas.
- \`checksums.sha256\`: verificação de integridade dos arquivos.

## Qual versão usar

| Nome | Uso recomendado | Fundo |
| --- | --- | --- |
| \`color-on-light\` | versão colorida principal | branco, Moonlight e superfícies claras |
| \`color-on-dark\` | versão colorida invertida | Midnight, preto e superfícies escuras |
| \`black\` | impressão ou produção em uma cor | superfícies claras |
| \`white\` | impressão ou produção em uma cor | superfícies escuras |

Todos os arquivos em \`svg/\` e em \`png/**/transparent/\` têm fundo transparente. A palavra \`transparent\` no nome confirma essa característica.

## Cores oficiais

- Midnight: \`#090A0F\`
- Moonlight: \`#F3F0E7\`
- Orbital Blue: \`#5B53E8\`
- Aurora: \`#D7FF5A\`
- Preto monocromático: \`#000000\`
- Branco monocromático: \`#FFFFFF\`

## Área de proteção

Mantenha ao redor da marca uma área livre mínima equivalente à **altura de um dos quadros do símbolo**. A mesma regra vale para a assinatura horizontal e para o símbolo isolado.

Não encoste textos, molduras, fotos ou outras marcas nessa área. Os arquivos de \`presentation/\` já incluem uma margem maior para aplicação imediata.

## Tamanho mínimo

- Assinatura horizontal: **88 px de largura** em tela.
- Símbolo: **20 px de largura** em tela.
- Para impressão pequena, faça uma prova física antes da produção final.

## Nomenclatura

Os nomes seguem o padrão:

\`moont-sequence-[wordmark|symbol]-[variante]-transparent-[largura]x[altura].png\`

Exemplo: \`moont-sequence-wordmark-color-on-light-transparent-960x256.png\`.

## Recomendações

- Prefira SVG para interfaces, sites, apresentações e materiais que serão redimensionados.
- Use PNG quando o sistema não aceitar SVG.
- Não altere as proporções, a ordem dos três quadros, os cantos ou as cores.
- Não aplique sombra, contorno, gradiente ou efeitos sobre a marca.
- Não use a versão branca sobre fundo claro nem a versão preta sobre fundo escuro.

## Regeneração

Na raiz do projeto, execute:

\`node scripts/generate-moont-brand-kit.mjs\`

O gerador lê a geometria e os contornos vetoriais diretamente de \`src/components/BrandLogo.jsx\`, recria todo o kit e atualiza as verificações SHA-256. Com a mesma versão do Chromium/Playwright, duas execuções produzem arquivos idênticos.
`;
}

async function listFilesRecursively(directory, base = directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursively(fullPath, base));
    } else {
      files.push(path.relative(base, fullPath).split(path.sep).join('/'));
    }
  }
  return files;
}

async function main() {
  const vectors = await extractSourceVectors();
  await fs.rm(kitRoot, { recursive: true, force: true });
  await fs.mkdir(kitRoot, { recursive: true });

  const exportedFiles = [];
  const svgRenders = [];

  for (const variantName of Object.keys(VARIANTS)) {
    const wordmarkRelative = `svg/wordmark/moont-sequence-wordmark-${variantName}-transparent.svg`;
    const symbolRelative = `svg/symbol/moont-sequence-symbol-${variantName}-transparent.svg`;
    const wordmarkSvg = createWordmarkSvg(vectors, variantName);
    const symbolSvg = createSymbolSvg(vectors, variantName);
    await writeText(wordmarkRelative, wordmarkSvg);
    await writeText(symbolRelative, symbolSvg);
    exportedFiles.push(wordmarkRelative, symbolRelative);

    for (const [width, height] of WORDMARK_SIZES) {
      const relative = `png/wordmark/transparent/${variantName}/moont-sequence-wordmark-${variantName}-transparent-${width}x${height}.png`;
      exportedFiles.push(relative);
      svgRenders.push({
        svg: createWordmarkSvg(vectors, variantName, width, height),
        target: path.join(kitRoot, relative),
        width,
        height,
        opaque: false,
      });
    }

    for (const size of SYMBOL_SIZES) {
      const relative = `png/symbol/transparent/${variantName}/moont-sequence-symbol-${variantName}-transparent-${size}x${size}.png`;
      exportedFiles.push(relative);
      svgRenders.push({
        svg: createSymbolSvg(vectors, variantName, size),
        target: path.join(kitRoot, relative),
        width: size,
        height: size,
        opaque: false,
      });
    }
  }

  for (const surface of ['moonlight', 'midnight']) {
    const wordmarkSvgRelative = `presentation/moont-sequence-wordmark-on-${surface}-1600x600.svg`;
    const wordmarkPngRelative = `presentation/moont-sequence-wordmark-on-${surface}-1600x600.png`;
    const symbolSvgRelative = `presentation/moont-sequence-symbol-on-${surface}-1024x1024.svg`;
    const symbolPngRelative = `presentation/moont-sequence-symbol-on-${surface}-1024x1024.png`;
    const wordmarkSvg = createPresentationSvg(vectors, surface);
    const symbolSvg = createSymbolPresentationSvg(vectors, surface);
    await writeText(wordmarkSvgRelative, wordmarkSvg);
    await writeText(symbolSvgRelative, symbolSvg);
    exportedFiles.push(wordmarkSvgRelative, wordmarkPngRelative, symbolSvgRelative, symbolPngRelative);
    svgRenders.push(
      { svg: wordmarkSvg, target: path.join(kitRoot, wordmarkPngRelative), width: 1600, height: 600, opaque: true },
      { svg: symbolSvg, target: path.join(kitRoot, symbolPngRelative), width: 1024, height: 1024, opaque: true },
    );
  }

  const browser = await chromium.launch({ headless: true });
  try {
    for (const render of svgRenders) {
      await renderSvg(browser, render.svg, render.target, render.width, render.height, render.opaque);
    }
  } finally {
    await browser.close();
  }

  await writeText('README.md', createReadme());
  await writeText('manifest.json', createManifest(vectors, exportedFiles));

  const filesForChecksums = (await listFilesRecursively(kitRoot))
    .filter((relative) => relative !== 'checksums.sha256')
    .sort();
  const checksumLines = [];
  for (const relative of filesForChecksums) {
    const contents = await fs.readFile(path.join(kitRoot, relative));
    checksumLines.push(`${sha256(contents)}  ${relative}`);
  }
  await writeText('checksums.sha256', `${checksumLines.join('\n')}\n`);

  console.log(`Kit Moont Sequence gerado em ${path.relative(repoRoot, kitRoot)}`);
  console.log(`${exportedFiles.length} arquivos de marca + README, manifest e checksums.`);
  console.log(`Geometria de origem: ${vectors.sourceHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
