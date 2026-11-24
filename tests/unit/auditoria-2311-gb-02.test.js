import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as projectShare from '../../src/utils/project-share.js';

// Auditoria 23/11 (GB-02): abrir de novo o link de convite (ou "Entrar" com o
// código) achava o projeto local com aquele código e gravava a última versão
// publicada por cima, sem perguntar, com as edições que ainda não tinham sido
// enviadas. O "Receber alterações" já perguntava; o link não.
const source = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const app = source('ViralCarrossel.jsx');
const panel = source('src/components/panels/TeamSharePanel.jsx');

const published = { shareCode: 'AB12CD34', shareRevision: 3, slides: [{ id: 's1', title: 'Versão publicada' }] };
const editedLocally = { shareCode: 'AB12CD34', shareRevision: 3, slides: [{ id: 's1', title: 'Minha edição ainda não enviada' }] };

/** Entrada pelo link como no editor: acha o projeto pelo código e decide. */
function joinByLink(library, payload, confirmReplace) {
  const existing = library.find(entry => entry.doc?.shareCode === payload.code);
  const mode = projectShare.resolveTeamShareJoin({ existingDoc: existing?.doc, remoteDoc: payload.doc, confirmReplace });
  if (mode === 'keep-local') return { mode, library };
  if (mode === 'create') return { mode, library: [{ id: 'novo', doc: payload.doc }, ...library] };
  return { mode, library: library.map(entry => entry === existing ? { ...entry, doc: payload.doc } : entry) };
}

describe('auditoria 23/11 GB-02: reabrir o link da equipe com edições locais', () => {
  const library = () => [{ id: 'p1', doc: editedLocally }, { id: 'p2', doc: { slides: [{ id: 'x', title: 'Outro' }] } }];

  it('sem confirmação o documento local não muda', () => {
    const confirmReplace = vi.fn(() => false);
    const before = library();
    const result = joinByLink(before, { code: 'AB12CD34', doc: published }, confirmReplace);
    expect(confirmReplace).toHaveBeenCalledTimes(1);
    expect(result.mode).toBe('keep-local');
    expect(result.library).toBe(before);
    expect(result.library[0].doc).toBe(editedLocally);
  });

  it('com confirmação a versão publicada substitui a local', () => {
    const result = joinByLink(library(), { code: 'AB12CD34', doc: published }, () => true);
    expect(result.mode).toBe('replace');
    expect(result.library[0].doc).toBe(published);
  });

  it('não pergunta quando o local é igual ao publicado nem quando o projeto é novo', () => {
    const confirmReplace = vi.fn(() => false);
    const same = [{ id: 'p1', doc: { ...published, shareRevision: 2 } }];
    expect(joinByLink(same, { code: 'AB12CD34', doc: published }, confirmReplace).mode).toBe('replace');
    expect(joinByLink([], { code: 'AB12CD34', doc: published }, confirmReplace).mode).toBe('create');
    expect(confirmReplace).not.toHaveBeenCalled();
  });

  it('o editor decide antes de montar a entrada e não substitui sem o sim', () => {
    const start = app.indexOf('const handleTeamShareJoined = useCallback(async (payload');
    const end = app.indexOf('const shareInviteInFlight = useRef(null);', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const handler = app.slice(start, end);
    const decision = handler.indexOf('resolveTeamShareJoin({');
    const keepLocal = handler.indexOf("if (joinMode === 'keep-local') {", decision);
    const replace = handler.indexOf('const queuedEntry = existing', decision);
    expect(decision).toBeGreaterThanOrEqual(0);
    expect(keepLocal).toBeGreaterThan(decision);
    expect(replace).toBeGreaterThan(keepLocal);
    expect(handler.slice(decision, keepLocal)).toContain('window.confirm(');
    const branch = handler.slice(keepLocal, replace);
    expect(branch).toContain('return { keptLocal: true };');
    expect(branch).not.toContain('history.reset(');
    expect(branch).not.toContain('queueProjectForAccount');
  });

  it('projeto mantido como estava não recebe a revisão publicada', () => {
    // `shareRevision` é a base do envio: marcar a revisão nova num documento
    // que não a recebeu deixaria "Enviar" passar por cima da equipe.
    const start = panel.indexOf('const applyJoined = async (res) => {');
    const linked = panel.indexOf('onShareLinked({', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(panel.slice(start, linked)).toContain('?.keptLocal) return;');
  });
});
