import { describe, it, expect } from 'vitest';
import { dedupeHeaderColumns, headerCenterText, textIsHandle } from '../../src/utils/card-header.js';

const brand = { handle: 'joaogabrieljobs', showHandle: true };
const slide = { showHandle: true };

describe('card-header — username não se repete no card', () => {
  it('textIsHandle ignora @, caixa e espaços', () => {
    expect(textIsHandle('@JOAOGABRIELJOBS', brand)).toBe(true);
    expect(textIsHandle(' joaogabrieljobs ', brand)).toBe(true);
    expect(textIsHandle('outro', brand)).toBe(false);
    expect(textIsHandle('', brand)).toBe(false);
  });

  it('com chip visível, nenhuma coluna repete o handle', () => {
    const out = dedupeHeaderColumns({ left: '@joaogabrieljobs', center: 'JOAOGABRIELJOBS', right: '2026' }, brand, slide);
    expect(out).toEqual({ left: '', center: '', right: '2026' });
  });

  it('sem chip, o handle aparece uma única vez (primeira coluna)', () => {
    const off = { ...brand, showHandle: false };
    const out = dedupeHeaderColumns({ left: '@joaogabrieljobs', center: 'joaogabrieljobs', right: '' }, off, slide);
    expect(out).toEqual({ left: '@joaogabrieljobs', center: '', right: '' });
  });

  it('headerCenterText: fallback ao handle só quando o chip está desligado', () => {
    expect(headerCenterText(brand, slide)).toBe('');
    expect(headerCenterText({ ...brand, showHandle: false }, slide)).toBe('joaogabrieljobs');
    expect(headerCenterText({ ...brand, cultureHeaderCenter: 'MINHA MARCA' }, slide)).toBe('MINHA MARCA');
    expect(headerCenterText({ ...brand, cultureHeaderCenter: '' }, { showHandle: false })).toBe('');
  });
});
