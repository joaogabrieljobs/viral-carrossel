import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createLatestRequestGate, resolveOpenDocTarget } from '../../src/utils/operation-target.js';

// Auditoria 23/11 (FE-07): com A ativo, clicar em A e logo em B. A resposta de
// B chega antes e B vira o ativo; a resposta atrasada de A comparava com o
// `activeDocId` do momento do clique, punha o documento de A no editor com B
// ativo e o autosave gravava A por cima de B.
const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');

/** Editor mínimo: um projeto ativo, o documento no editor e o autosave. */
function makeEditor(library, activeDocId) {
  const state = { library: structuredClone(library), activeDocId, doc: library.find(item => item.id === activeDocId).doc };
  const gate = createLatestRequestGate();
  const autosave = () => {
    state.library = state.library.map(item => item.id === state.activeDocId ? { ...item, doc: state.doc } : item);
  };
  const openDoc = async (docId, getProject) => {
    const token = gate.begin();
    const remote = await getProject(docId);
    const target = resolveOpenDocTarget({ docId, activeDocId: state.activeDocId, isLatest: gate.isLatest(token) });
    if (target === 'superseded') return false;
    if (target === 'refresh-active') state.doc = remote.doc;
    else { autosave(); state.activeDocId = docId; state.doc = remote.doc; }
    return true;
  };
  return { state, openDoc, autosave };
}

describe('auditoria 23/11 FE-07: reabrir o ativo e clicar em outro logo em seguida', () => {
  it('a entrada B mantém o próprio conteúdo e o editor mostra B', async () => {
    vi.useFakeTimers();
    try {
      const library = [
        { id: 'A', doc: { slides: [{ title: 'conteúdo de A' }] } },
        { id: 'B', doc: { slides: [{ title: 'conteúdo de B' }] } },
      ];
      const editor = makeEditor(library, 'A');
      const delays = { A: 800, B: 50 };
      const getProject = id => new Promise(resolve => setTimeout(
        () => resolve({ doc: library.find(item => item.id === id).doc }), delays[id],
      ));
      const openedA = editor.openDoc('A', getProject);
      const openedB = editor.openDoc('B', getProject);
      await vi.advanceTimersByTimeAsync(1000);
      expect(await openedB).toBe(true);
      expect(await openedA).toBe(false);
      editor.autosave();
      expect(editor.state.activeDocId).toBe('B');
      expect(editor.state.doc.slides[0].title).toBe('conteúdo de B');
      expect(editor.state.library.find(item => item.id === 'B').doc.slides[0].title).toBe('conteúdo de B');
      expect(editor.state.library.find(item => item.id === 'A').doc.slides[0].title).toBe('conteúdo de A');
    } finally {
      vi.useRealTimers();
    }
  });

  it('decide pelo projeto que está no editor agora, não pelo do clique', () => {
    expect(resolveOpenDocTarget({ docId: 'A', activeDocId: 'A', isLatest: true })).toBe('refresh-active');
    expect(resolveOpenDocTarget({ docId: 'A', activeDocId: 'B', isLatest: true })).toBe('open');
    expect(resolveOpenDocTarget({ docId: 'A', activeDocId: 'A', isLatest: false })).toBe('superseded');
    expect(resolveOpenDocTarget({ docId: 'A', activeDocId: 'B', isLatest: false })).toBe('superseded');
  });

  it('a última abertura vence', () => {
    const gate = createLatestRequestGate();
    const first = gate.begin();
    expect(gate.isLatest(first)).toBe(true);
    const second = gate.begin();
    expect(gate.isLatest(first)).toBe(false);
    expect(gate.isLatest(second)).toBe(true);
  });

  it('o openDoc do editor usa a conferência depois de esperar a conta', () => {
    const start = app.indexOf('const openDoc = useCallback(async (docId) => {');
    const end = app.indexOf('const askPromptRef = useRef(null);', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const openDoc = app.slice(start, end);
    const awaited = openDoc.indexOf('remote = await getProject(');
    const decision = openDoc.indexOf('resolveOpenDocTarget({', awaited);
    expect(decision).toBeGreaterThan(awaited);
    expect(openDoc.slice(decision, decision + 260)).toContain('editorSyncStateRef.current.activeDocId');
    // O `activeDocId` do fechamento é o do clique; não pode decidir o destino.
    expect(openDoc).not.toContain('if (docId === activeDocId)');
  });
});
