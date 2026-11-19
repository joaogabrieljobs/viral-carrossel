import { describe, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { PRESENTATION_FONT_FACES, PRESENTATION_FONT_CSS, PRESENTATION_FONT_STYLE_ID, ensurePresentationFonts } from '../../src/utils/presentation-font-manifest.js';
import { libraryFontFamilies } from '../../src/utils/presentation-families.js';
import { waitForExportFonts } from '../../src/utils/export-fonts.js';

describe('fontes locais dos novos templates', () => {
  it('todas as famílias usadas têm faces locais, arquivos WOFF e licenças distribuídas', () => {
    const families = new Set(PRESENTATION_FONT_FACES.map(face => face.family));
    for (const name of libraryFontFamilies()) expect(families.has(name), name).toBe(true);
    for (const face of PRESENTATION_FONT_FACES) {
      const bytes = readFileSync(new URL(`../../public/fonts/presentation/${face.file}`, import.meta.url));
      expect(bytes.subarray(0, 4).toString()).toBe('wOFF');
      const license = face.family.toLowerCase().replaceAll(' ', '').replace('barlowcondensed', 'barlow');
      expect(existsSync(new URL(`../../public/fonts/presentation/licenses/${license}.OFL.txt`, import.meta.url)), face.family).toBe(true);
    }
    expect(PRESENTATION_FONT_CSS).not.toContain('https:');
  });

  it('export registra as faces antes de carregá-las e reutiliza a declaração do Studio', async () => {
    const elements = new Map();
    const appendChild = vi.fn(node => elements.set(node.id, node));
    const fonts = Object.assign([], { load: vi.fn(async () => {
      expect(elements.get(PRESENTATION_FONT_STYLE_ID)?.textContent).toContain('font-family:"Instrument Sans"');
      return [{ family: 'Instrument Sans', status: 'loaded' }];
    }) });
    const doc = { fonts, head: { appendChild }, createElement: () => ({}), getElementById: id => elements.get(id),
      defaultView: { getComputedStyle: () => ({ fontFamily: '"Instrument Sans", sans-serif', fontWeight: '400', fontSize: '32px' }) } };
    const root = { childNodes: [{ nodeType: 3, textContent: 'Ação e precisão.' }], querySelectorAll: () => [] };
    await waitForExportFonts([root], { doc });
    ensurePresentationFonts(doc);
    expect(appendChild).toHaveBeenCalledOnce();
    expect(fonts.load).toHaveBeenCalledOnce();
  });
});
