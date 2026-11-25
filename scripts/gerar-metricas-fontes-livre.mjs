// Gera src/utils/free-font-metrics.js: avanço de cada caractere (milésimos de
// em, sem kerning) das 20 fontes da biblioteca local, no peso de título e no de
// texto do modo livre. O html2canvas e a tela desenham os glifos padrão
// (font-feature-settings: normal no card), os mesmos que o canvas mede aqui.
// Uso: node scripts/gerar-metricas-fontes-livre.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { FREE_FONT_FAMILIES, freeFontSpec } from '../src/utils/free-design.js';
import { PRESENTATION_FONT_FACES } from '../src/utils/presentation-font-manifest.js';

const root = new URL('../', import.meta.url);
export const CHARSET = ' abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÉÊÍÓÔÕÚÇ.,;:!?\'"“”‘’-–—()%$€/&@#+*=…•';
const faces = PRESENTATION_FONT_FACES.filter(face => FREE_FONT_FAMILIES.includes(face.family) && face.style === 'normal');
const css = faces.map(face => `@font-face{font-family:"${face.family}";src:url(data:font/woff;base64,${readFileSync(new URL(`public/fonts/presentation/${face.file}`, root)).toString('base64')}) format("woff");font-weight:${face.weight};font-style:normal}`).join('\n');
// Título medido a 120 px e texto a 30 px: fontes com eixo óptico (Fraunces,
// Source Serif, DM Sans) mudam de largura com o corpo.
const ROLE_SIZE = { display: 120, text: 30 };
const wanted = FREE_FONT_FAMILIES.flatMap(family => ['display', 'text'].map(role => ({ family, role, weight: freeFontSpec(family, role).weight })));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<!doctype html><style>${css}</style><body></body>`);
const table = await page.evaluate(async ({ wanted, charset, sizes }) => {
  const out = {};
  const ctx = document.createElement('canvas').getContext('2d');
  for (const { family, role, weight } of wanted) {
    const size = sizes[role];
    await document.fonts.load(`${weight} ${size}px "${family}"`);
    if (!document.fonts.check(`${weight} ${size}px "${family}"`)) throw new Error(`fonte não carregou: ${family} ${weight}`);
    ctx.font = `${weight} ${size}px "${family}"`;
    out[`${family}|${role}`] = [...charset].map(c => Math.round((ctx.measureText(c).width / size) * 1000));
  }
  return out;
}, { wanted, charset: CHARSET, sizes: ROLE_SIZE });
await browser.close();
const body = Object.entries(table).map(([key, values]) => `  ${JSON.stringify(key)}: ${JSON.stringify(values.join(','))},`).join('\n');
writeFileSync(new URL('src/utils/free-font-metrics.js', root), `// Gerado por scripts/gerar-metricas-fontes-livre.mjs. Não editar à mão.
// Avanço de cada caractere de FREE_FONT_CHARSET em milésimos de em (canvas do
// Chromium, glifos padrão, sem kerning), por "família|papel": o título no peso
// de título a 120 px e o texto no peso de texto a 30 px.
export const FREE_FONT_CHARSET = ${JSON.stringify(CHARSET)};
export const FREE_FONT_ADVANCES = Object.freeze({
${body}
});
`);
console.log('fontes medidas:', Object.keys(table).length);
