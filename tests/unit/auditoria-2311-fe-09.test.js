import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as operationTarget from '../../src/utils/operation-target.js';

// Auditoria 23/11 (FE-09): em A, "Receber alterações da equipe"; durante o
// download das fotos a pessoa abre B. O documento da equipe entrava no editor
// com B ativo, zerava o Desfazer e o autosave gravava em B.
const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');

/** "Receber" como no editor, com o download das fotos atrasado. */
async function pullTeamDoc({ editor, payload, hydrate }) {
  const targetDocId = editor.activeDocId;
  const shaped = await hydrate(payload.doc);
  const destination = operationTarget.teamPullDestination({ targetDocId, activeDocId: editor.activeDocId });
  if (destination.applyToEditor) { editor.doc = shaped; editor.undo = []; }
  editor.library = editor.library.map(entry => entry.id === destination.entryId ? { ...entry, doc: shaped } : entry);
  return destination;
}

describe('auditoria 23/11 FE-09: receber da equipe e trocar de projeto durante o download', () => {
  it('o documento de B fica intacto e o recebido vai para o projeto de origem', async () => {
    vi.useFakeTimers();
    try {
      const docA = { slides: [{ title: 'A local' }] };
      const docB = { slides: [{ title: 'B local' }] };
      const teamDoc = { slides: [{ title: 'A da equipe' }] };
      const editor = {
        activeDocId: 'A', doc: docA, undo: ['passo'],
        library: [{ id: 'A', doc: docA }, { id: 'B', doc: docB }],
      };
      const pulling = pullTeamDoc({
        editor, payload: { doc: teamDoc },
        hydrate: doc => new Promise(resolve => setTimeout(() => resolve(doc), 3000)),
      });
      await vi.advanceTimersByTimeAsync(500);
      editor.activeDocId = 'B'; editor.doc = docB; editor.undo = ['passo de B'];
      await vi.advanceTimersByTimeAsync(3000);
      expect(await pulling).toEqual({ entryId: 'A', applyToEditor: false });
      expect(editor.doc).toBe(docB);
      expect(editor.undo).toEqual(['passo de B']);
      expect(editor.library.find(entry => entry.id === 'B').doc).toBe(docB);
      expect(editor.library.find(entry => entry.id === 'A').doc).toBe(teamDoc);
    } finally {
      vi.useRealTimers();
    }
  });

  it('com o projeto de origem ainda aberto, o editor recebe', () => {
    expect(operationTarget.teamPullDestination({ targetDocId: 'A', activeDocId: 'A' }))
      .toEqual({ entryId: 'A', applyToEditor: true });
  });

  it('o editor confere o projeto depois do download e grava na entrada de origem', () => {
    const start = app.indexOf('const handleTeamDocPulled = useCallback(async (payload) => {');
    const end = app.indexOf('const handleTeamShareJoined = useCallback', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const handler = app.slice(start, end);
    const hydrated = handler.indexOf('await hydrateSharedDocImages(');
    const destination = handler.indexOf('teamPullDestination({', hydrated);
    const reset = handler.indexOf('history.reset(shaped)');
    expect(destination).toBeGreaterThan(hydrated);
    expect(reset).toBeGreaterThan(destination);
    expect(handler.slice(destination, reset)).toContain('applyToEditor');
    // O `activeDocId` do fechamento só serve para guardar o destino no início.
    expect(handler).not.toContain('entry.id === activeDocId');
  });
});
