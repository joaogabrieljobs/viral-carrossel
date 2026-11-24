import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as brandTone from '../../src/utils/brand-tone.js';

// Auditoria 23/11 (GB-11): marca sem tom recebia "direto e provocativo" no
// assistente, "direto e concreto" no Criar rápido e "claro e direto" na
// criação guiada.
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const DOORS = {
  assistente: 'src/components/panels/GenerateModal.jsx',
  'criação guiada': 'src/components/CreateProjectFlow.jsx',
  'Criar rápido': 'ViralCarrossel.jsx',
};

describe('auditoria 23/11 GB-11: um só tom quando a marca não definiu o seu', () => {
  it('sem tom na marca, o padrão é claro e direto', () => {
    expect(brandTone.DEFAULT_GENERATION_TONE).toBe('claro e direto');
    expect(brandTone.generationToneOrDefault('')).toBe('claro e direto');
    expect(brandTone.generationToneOrDefault('   ')).toBe('claro e direto');
    expect(brandTone.generationToneOrDefault(undefined)).toBe('claro e direto');
  });

  it('o tom escolhido pela marca é preservado', () => {
    expect(brandTone.generationToneOrDefault('  acolhedor e técnico ')).toBe('acolhedor e técnico');
  });

  it.each(Object.entries(DOORS))('%s usa o padrão único e não um tom próprio', (_door, path) => {
    const source = read(path);
    expect(source).toMatch(/generationToneOrDefault\(/);
    expect(source).not.toMatch(/\|\|\s*'(?:direto e provocativo|direto e concreto|claro e direto)'/);
  });
});
