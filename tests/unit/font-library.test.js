import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCAL_BODY_FONTS, LOCAL_FONT_FAMILIES, LOCAL_TITLE_FONTS } from '../../src/utils/font-library.generated.js';

const root = path.resolve(import.meta.dirname, '../..');
const css = fs.readFileSync(path.join(root, 'src/styles/font-library.css'), 'utf8');

describe('biblioteca local de fontes', () => {
  it('expõe todas as famílias importadas sem valores duplicados', () => {
    expect(LOCAL_TITLE_FONTS.map(({ name }) => name)).toEqual(['Inter', 'Roboto']);
    expect(new Set(LOCAL_TITLE_FONTS.map(({ val }) => val)).size).toBe(LOCAL_TITLE_FONTS.length);
    expect(LOCAL_FONT_FAMILIES.size).toBe(LOCAL_TITLE_FONTS.length);
    expect(LOCAL_BODY_FONTS.every(({ val }) => LOCAL_TITLE_FONTS.some((font) => font.val === val))).toBe(true);
  });

  it('declara arquivos existentes para cada família', () => {
    for (const { val } of LOCAL_TITLE_FONTS) {
      const family = val.split(',')[0].trim().replace(/^["']|["']$/g, '');
      expect(css).toContain(`font-family: "${family}"`);
    }
    const urls = [...css.matchAll(/url\('([^']+)'\)/g)].map((match) => match[1]);
    expect(urls.length).toBeGreaterThan(LOCAL_TITLE_FONTS.length);
    expect(css).toContain('font-weight: 900;');
    for (const url of urls) {
      expect(fs.existsSync(path.join(root, 'public', url.replace(/^\//, '')))).toBe(true);
    }
  });

  it('mantém categorias reconhecidas pelo seletor', () => {
    const valid = new Set(['sans', 'display', 'serif', 'editorial', 'mono']);
    expect(LOCAL_TITLE_FONTS.every(({ cat }) => valid.has(cat))).toBe(true);
  });
});
