import React from 'react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readBackupEntries } from '../../src/utils/backup-import.js';
import { INVALID_BACKUP_MESSAGE, useLibrary } from '../../src/hooks/useLibrary.js';
import { DEFAULT_BRAND, DEFAULT_DOC, mkSlide } from '../../src/utils/doc-schema.js';

// Auditoria 23/11 (GB-09): importar backup conferia só "+1" no limite do plano
// grátis (arquivo com 40 projetos entrava), aceitava `name` que não é texto (a
// busca de projetos caía) e slides com o mesmo id (editados em conjunto).
const slide = (id, title) => ({ ...mkSlide(1), id, title });
const project = (name, slides = [slide('s1', 'Um')]) => ({ id: 'origem', name, doc: { ...DEFAULT_DOC, slides } });
let nextId = 0;
const idFactory = () => `novo-${++nextId}`;

describe('auditoria 23/11 GB-09: leitura do backup antes de importar', () => {
  it('nome que não é texto vira texto e a busca de projetos funciona', () => {
    const { entries, skipped } = readBackupEntries({ docs: [project(2026), project({ a: 1 }), project('  '), project('Campanha')] }, idFactory);
    expect(skipped).toBe(0);
    expect(entries.map(entry => entry.name)).toEqual(['2026', 'Importado', 'Importado', 'Campanha']);
    expect(() => entries.filter(entry => entry.name.toLowerCase().includes('20'))).not.toThrow();
  });

  it('slides com id repetido ou sem id recebem ids únicos, sem perder slide', () => {
    const { entries } = readBackupEntries({ docs: [project('Deck', [slide('a', 'Um'), slide('a', 'Dois'), slide(7, 'Três'), slide('', 'Quatro'), slide('b', 'Cinco')])] }, idFactory);
    const slides = entries[0].doc.slides;
    expect(slides.map(item => item.title)).toEqual(['Um', 'Dois', 'Três', 'Quatro', 'Cinco']);
    expect(new Set(slides.map(item => item.id)).size).toBe(5);
    expect(slides.every(item => typeof item.id === 'string' && item.id)).toBe(true);
    expect(slides[0].id).toBe('a');
    expect(slides[4].id).toBe('b');
  });

  it('o que não é projeto fica de fora e é contado, sem descartar os válidos', () => {
    const { entries, skipped } = readBackupEntries({ docs: [project('Válido'), null, 'texto', { name: 'Sem conteúdo' }, { name: 'Lista', doc: [] }] }, idFactory);
    expect(entries.map(entry => entry.name)).toEqual(['Válido']);
    expect(skipped).toBe(4);
  });

  it('aceita a lista direta de projetos e recusa o que não é backup', () => {
    expect(readBackupEntries([project('A')], idFactory).entries).toHaveLength(1);
    for (const bad of [null, 'x', 12, {}, { docs: 'x' }, { docs: [] }]) {
      expect(readBackupEntries(bad, idFactory)).toEqual({ entries: [], skipped: 0 });
    }
  });
});

describe('auditoria 23/11 GB-09: a importação confere a quantidade do arquivo', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  function importFile(content, options) {
    const calls = { setLibrary: vi.fn(), setActiveDocId: vi.fn(), toast: vi.fn() };
    let api;
    function Probe() {
      api = useLibrary({
        library: [], setLibrary: calls.setLibrary, libraryFolders: [], setLibraryFolders: vi.fn(),
        activeDocId: '', setActiveDocId: calls.setActiveDocId,
        history: { state: DEFAULT_DOC, reset: vi.fn(), set: vi.fn() }, slides: [], brand: DEFAULT_BRAND,
        brandRoster: [], setBrandRoster: vi.fn(), activeBrandId: '', setActiveBrandId: vi.fn(),
        setLibraryOpen: vi.fn(), toast: calls.toast, setError: vi.fn(),
      });
      return null;
    }
    renderToStaticMarkup(React.createElement(Probe));
    let done;
    const finished = new Promise(resolve => { done = resolve; });
    vi.stubGlobal('FileReader', class {
      readAsText() { Promise.resolve(this.onload({ target: { result: content } })).then(done, done); }
    });
    api.handleImportFile({ target: { files: [{ name: 'backup.json' }], value: 'backup.json' } }, options);
    return finished.then(() => calls);
  }

  it('recebe a quantidade real do arquivo e não importa nada quando o plano não comporta', async () => {
    const canAdd = vi.fn(() => false);
    const calls = await importFile(JSON.stringify({ docs: Array.from({ length: 5 }, (_, index) => project(`Projeto ${index + 1}`)) }), { canAdd });
    expect(canAdd).toHaveBeenCalledTimes(1);
    expect(canAdd).toHaveBeenCalledWith(5);
    expect(calls.setLibrary).not.toHaveBeenCalled();
    expect(calls.setActiveDocId).not.toHaveBeenCalled();
  });

  it('arquivo sem nenhum projeto válido é recusado com mensagem', async () => {
    const canAdd = vi.fn(() => true);
    const calls = await importFile(JSON.stringify({ docs: [null, { name: 'Sem conteúdo' }] }), { canAdd });
    expect(calls.toast).toHaveBeenCalledWith(INVALID_BACKUP_MESSAGE, 'error', 6500);
    expect(canAdd).not.toHaveBeenCalled();
    expect(calls.setLibrary).not.toHaveBeenCalled();
  });

  it('o plano grátis confere a quantidade do arquivo, não só mais um', () => {
    const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
    const start = app.indexOf('const handleImportFile = useCallback((event) => {');
    const wrapper = app.slice(start, app.indexOf('[freeLimitBlocks, handleImportFileRaw, toast]', start));
    expect(wrapper).toMatch(/handleImportFileRaw\(event, \{/);
    expect(wrapper).toMatch(/freeLimitBlocks\(count\)/);
    expect(wrapper).toMatch(/Nada foi importado/);
  });
});
