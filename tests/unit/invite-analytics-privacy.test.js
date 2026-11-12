import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const analyticsSource = readFileSync(
  new URL('../../public/analytics-loader.js', import.meta.url),
  'utf8',
);

function appendedScripts({ pathname = '/', search = '' } = {}) {
  const appended = [];
  const document = {
    createElement: () => ({ dataset: {} }),
    head: { appendChild: (node) => appended.push(node) },
  };
  vm.runInNewContext(analyticsSource, {
    window: { location: { pathname, search } },
    document,
    URLSearchParams,
  });
  return appended;
}

describe('privacidade do link de convite', () => {
  it('não carrega Plausible enquanto o código share está na URL', () => {
    expect(appendedScripts({ search: '?share=F5M3CGPB&app=1' })).toEqual([]);
  });

  it('mantém analytics em páginas públicas sem segredo', () => {
    expect(appendedScripts({ search: '?app=1' })).toHaveLength(1);
    expect(appendedScripts({ search: '?app=1' })[0].src)
      .toBe('https://plausible.io/js/script.tagged-events.js');
  });
});
