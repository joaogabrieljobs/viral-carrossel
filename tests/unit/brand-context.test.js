import { describe, it, expect } from 'vitest';
import {
  cloneBrandStyleKit,
  withBrandStyleKit,
  projectsForBrand,
  brandHasContext,
} from '../../src/utils/brand-context.js';
import { buildSeededLibraryDoc } from '../../src/hooks/useLibrary.js';
import { DEFAULT_BRAND } from '../../src/utils/doc-schema.js';

describe('brand-context', () => {
  it('cloneBrandStyleKit copia brief e estilo da marca', () => {
    const brand = {
      id: 'm1',
      styleKit: {
        contextMd: '# Cliente X\nPúblico B2B.',
        stylePrompt: 'Foto editorial, luz suave.',
        refImages: [{ id: 'r1', imageId: 'img_1', name: 'mood' }],
      },
    };
    const kit = cloneBrandStyleKit(brand);
    expect(kit.contextMd).toMatch(/Cliente X/);
    expect(kit.stylePrompt).toMatch(/editorial/);
    expect(kit.refImages).toHaveLength(1);
    expect(kit.refImages[0]).not.toBe(brand.styleKit.refImages[0]);
  });

  it('brandHasContext ignora marca vazia', () => {
    expect(brandHasContext({})).toBe(false);
    expect(brandHasContext({ styleKit: { contextMd: 'x' } })).toBe(true);
  });

  it('projectsForBrand filtra por brand.id', () => {
    const lib = [
      { id: 'a', doc: { brand: { id: 'm1' } } },
      { id: 'b', doc: { brand: { id: 'm2' } } },
      { id: 'c', doc: { brand: { id: 'default' } } },
      { id: 'd', doc: { brand: {} } },
    ];
    expect(projectsForBrand(lib, 'm1').map((e) => e.id)).toEqual(['a']);
    expect(projectsForBrand(lib, 'default').map((e) => e.id).sort()).toEqual(['c', 'd']);
  });

  it('withBrandStyleKit grava contexto no perfil', () => {
    const next = withBrandStyleKit({ id: 'm1', name: 'MUSA' }, {
      contextMd: 'Brief',
      stylePrompt: 'Estilo',
    });
    expect(next.id).toBe('m1');
    expect(next.styleKit.contextMd).toBe('Brief');
    expect(next.styleKit.stylePrompt).toBe('Estilo');
  });
});

describe('buildSeededLibraryDoc herda contexto da marca', () => {
  it('sem styleKit no seed → usa brand.styleKit', () => {
    const brand = {
      ...DEFAULT_BRAND,
      id: 'agencia',
      name: 'Agência',
      styleKit: {
        contextMd: '# Brief da marca\nSérum Y.',
        stylePrompt: 'Minimalista bege.',
        refImages: [],
      },
    };
    const doc = buildSeededLibraryDoc({ brand }, brand);
    expect(doc.styleKit.contextMd).toMatch(/Sérum Y/);
    expect(doc.styleKit.stylePrompt).toMatch(/Minimalista/);
    expect(doc.brand.id).toBe('agencia');
  });

  it('styleKit no seed prevalece sobre a marca', () => {
    const brand = {
      ...DEFAULT_BRAND,
      id: 'agencia',
      styleKit: { contextMd: 'Da marca', stylePrompt: '', refImages: [] },
    };
    const doc = buildSeededLibraryDoc({
      brand,
      styleKit: { contextMd: 'Do projeto', stylePrompt: 'Foto', refImages: [] },
    }, brand);
    expect(doc.styleKit.contextMd).toBe('Do projeto');
    expect(doc.styleKit.stylePrompt).toBe('Foto');
  });
});
