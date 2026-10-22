import { afterEach, describe, expect, it, vi } from 'vitest';
import { readInitialShellView, SK } from '../../src/utils/storage.js';
import { buildSeededLibraryDoc } from '../../src/hooks/useLibrary.js';
import { DEFAULT_BRAND } from '../../src/utils/doc-schema.js';

afterEach(() => vi.unstubAllGlobals());

describe('entrada na criação de projetos', () => {
  it.each(['home', 'project'])('mostra as escolhas iniciais mesmo após sair em %s', (savedView) => {
    const stored = new Map([
      [SK.shellView, JSON.stringify(savedView)],
      [SK.activeDocId, JSON.stringify('existente')],
      [SK.library, JSON.stringify([{ id: 'existente', doc: { slides: [{ title: 'Campanha real' }] } }])],
    ]);
    const before = [...stored.entries()];
    vi.stubGlobal('localStorage', {
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
      removeItem: key => stored.delete(key),
    });
    expect(readInitialShellView()).toBe('home');
    expect([...stored.entries()]).toEqual(before);
  });

  it('abre a entrada quando o navegador bloqueia o armazenamento', () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('SecurityError'); },
    });
    expect(readInitialShellView()).toBe('home');
  });

  it('um seed de criação guarda quantidade, formato e material sem herdar conteúdo de outro cliente', () => {
    const previousBrand = {
      ...DEFAULT_BRAND,
      id: 'cliente-antigo',
      name: 'Cliente anterior',
      styleKit: { contextMd: 'Informação privada anterior', stylePrompt: 'Vermelho', refImages: [] },
    };
    const chosenBrand = { ...DEFAULT_BRAND, id: 'novo-cliente', name: 'Novo cliente' };
    const seed = {
      brand: chosenBrand,
      productKind: 'carrossel',
      fmt: 'stories',
      quickCardCount: 8,
      mode: 'how_to',
      material: { content: 'Dados do novo projeto', sources: '', context: 'Não inventar preços' },
      styleKit: { contextMd: 'Brief novo', stylePrompt: 'Fotografia editorial clara', refImages: [] },
    };
    const before = structuredClone({ previousBrand, chosenBrand, seed });
    const doc = buildSeededLibraryDoc(seed, previousBrand);
    expect(doc).toMatchObject({
      productKind: 'carrossel', fmt: 'stories', quickCardCount: 8, mode: 'how_to',
      brand: { id: 'novo-cliente', name: 'Novo cliente' },
      material: seed.material,
      styleKit: { contextMd: 'Brief novo', stylePrompt: 'Fotografia editorial clara' },
    });
    expect(doc.slides).toHaveLength(1);
    expect(doc.slides[0].title).toBe('Seu título aqui');
    expect(JSON.stringify(doc)).not.toContain('Informação privada anterior');
    expect({ previousBrand, chosenBrand, seed }).toEqual(before);
  });

  it.each([
    [{}, { contextMd: '', stylePrompt: '', logoOnGenerate: true }],
    [{ logoOnGenerate: false }, { contextMd: '', stylePrompt: '', logoOnGenerate: false }],
    [{ logo: { name: 'Logo escolhida', imageId: 'img_chosen' } }, { contextMd: '', stylePrompt: '', logo: { name: 'Logo escolhida', imageId: 'img_chosen' } }],
  ])('um pacote explícito %j prevalece mesmo sem conteúdo textual', (styleKit, expected) => {
    const brand = {
      ...DEFAULT_BRAND, id: 'saved-brand',
      styleKit: { contextMd: 'Brief removido no assistente', stylePrompt: 'Estilo removido', refImages: [], logoOnGenerate: true },
    };
    const doc = buildSeededLibraryDoc({ brand, styleKit }, brand);
    expect(doc.styleKit).toMatchObject(expected);
    expect(doc.styleKit.contextMd).not.toContain('Brief removido');
    expect(brand.styleKit.contextMd).toBe('Brief removido no assistente');
  });
});
