import { readFileSync } from 'node:fs';

const outfit = readFileSync(new URL('../../fixtures/fonts/outfit/Outfit-VariableFont_wght.ttf', import.meta.url)).toString('base64');
const outfitCss = `@font-face {
  font-family: "Outfit";
  font-style: normal;
  font-weight: 100 900;
  src: url("data:font/ttf;base64,${outfit}") format("truetype");
  font-display: swap;
}`;

/**
 * A face Outfit original, com pesos variáveis, sem depender do Google no CI.
 * As fontes da biblioteca (incluindo Inter) continuam nos WOFF locais do app.
 * Uso explícito nos cenários de exportação; testes de erro de fonte mantêm
 * suas próprias rotas e continuam provando a recusa de exportar com fallback.
 */
export async function mockOutfitFont(page) {
  await page.route('https://fonts.googleapis.com/**', (route) => {
    const families = new URL(route.request().url()).searchParams.getAll('family');
    if (!families.some((family) => family.split(':')[0] === 'Outfit')) return route.fallback();
    return route.fulfill({ status: 200, contentType: 'text/css', body: outfitCss });
  });
}
