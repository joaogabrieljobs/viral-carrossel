// Task 02 — RF-03: biblioteca pessoal de hooks (dedup + FIFO + ranking por nicho).
import { describe, it, expect } from 'vitest';
import {
  saveHookToLibrary,
  getHooksForNiche,
  HOOK_LIBRARY_MAX,
} from '../../src/utils/hooks-library.js';

describe('saveHookToLibrary', () => {
  it('duplicata (hook+niche) incrementa usageCount no mesmo slot', () => {
    const lib1 = saveHookToLibrary([], { hook: 'Gancho A', niche: 'fitness', tone: 'direto' });
    const lib2 = saveHookToLibrary(lib1, { hook: 'Gancho A', niche: 'fitness', tone: 'direto' });
    expect(lib2).toHaveLength(1);
    expect(lib2[0].usageCount).toBe(2);
  });

  it('hook novo entra no topo (prepend)', () => {
    const lib1 = saveHookToLibrary([], { hook: 'Primeiro', niche: 'a' });
    const lib2 = saveHookToLibrary(lib1, { hook: 'Segundo', niche: 'a' });
    expect(lib2[0].hook).toBe('Segundo');
    expect(lib2[1].hook).toBe('Primeiro');
  });

  it('hook vazio/whitespace é ignorado', () => {
    expect(saveHookToLibrary([], { hook: '   ' })).toEqual([]);
  });

  it(`trunca em ${HOOK_LIBRARY_MAX} (FIFO)`, () => {
    let lib = [];
    for (let i = 0; i < HOOK_LIBRARY_MAX + 5; i++) {
      lib = saveHookToLibrary(lib, { hook: `Hook ${i}`, niche: 'n' });
    }
    expect(lib).toHaveLength(HOOK_LIBRARY_MAX);
    expect(lib[0].hook).toBe(`Hook ${HOOK_LIBRARY_MAX + 4}`);
  });
});

describe('getHooksForNiche', () => {
  const lib = [
    { hook: 'h1', niche: 'fitness' },
    { hook: 'h2', niche: 'fitness feminino' },
    { hook: 'h3', niche: 'moda' },
  ];

  it('match exato vem primeiro, depois substring', () => {
    const out = getHooksForNiche(lib, 'fitness', 5);
    expect(out[0].hook).toBe('h1');
    expect(out[1].hook).toBe('h2');
    expect(out).toHaveLength(2);
  });

  it('sem nicho retorna os primeiros até o limite', () => {
    expect(getHooksForNiche(lib, '', 2)).toHaveLength(2);
  });

  it('biblioteca vazia ou inválida retorna []', () => {
    expect(getHooksForNiche([], 'x')).toEqual([]);
    expect(getHooksForNiche(null, 'x')).toEqual([]);
  });
});
