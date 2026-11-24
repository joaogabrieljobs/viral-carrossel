// FE-18 (auditoria de 23/11), Projetos V2:
//  1. projeto com alteração ainda não enviada não reabria ("Salve as alterações
//     deste projeto antes de abri-lo novamente", com o Salvar já apontando
//     para outro projeto);
//  2. no Sync e no salvamento automático, o primeiro projeto que falhava no
//     envio impedia o envio de todos os seguintes.
import { describe, expect, it, vi } from 'vitest';
import {
  combinedProjectSyncError, decideProjectOpen, persistProjectsIndependently,
} from '../../src/utils/project-sync-control.js';

describe('FE-18: reabrir projeto com alteração ainda não enviada', () => {
  it('projeto não ativo com edição local abre a versão local, sem buscar a da conta', () => {
    expect(decideProjectOpen({
      isActive: false, baseline: 'conta-v3', entryFingerprint: 'local-editado', editorFingerprint: 'local-editado',
    })).toBe('open_local');
  });

  it('projeto que já está no editor com edição pendente só volta para o editor', () => {
    expect(decideProjectOpen({
      isActive: true, baseline: 'conta-v3', entryFingerprint: 'conta-v3', editorFingerprint: 'digitando',
    })).toBe('keep_editor');
    expect(decideProjectOpen({
      isActive: true, baseline: 'conta-v3', entryFingerprint: 'local-editado', editorFingerprint: 'local-editado',
    })).toBe('keep_editor');
  });

  it('projeto igual ao confirmado, ou ainda sem confirmação, confere a versão da conta', () => {
    expect(decideProjectOpen({
      isActive: false, baseline: 'conta-v3', entryFingerprint: 'conta-v3', editorFingerprint: 'conta-v3',
    })).toBe('fetch');
    expect(decideProjectOpen({
      isActive: true, baseline: 'conta-v3', entryFingerprint: 'conta-v3', editorFingerprint: 'conta-v3',
    })).toBe('fetch');
    expect(decideProjectOpen({
      isActive: false, baseline: undefined, entryFingerprint: 'criado-agora', editorFingerprint: 'criado-agora',
    })).toBe('fetch');
  });
});

describe('FE-18: um projeto que falha no envio não barra os seguintes', () => {
  const X = { id: 'x', name: 'Com foto grande' };
  const Y = { id: 'y', name: 'Alterado depois' };
  const Z = { id: 'z', name: 'Terceiro' };

  it('X falha, Y e Z são enviados e a falha de X volta para o aviso', async () => {
    const fail = new Error('2 imagem(ns) não foram enviadas. O texto ficou na fila desta conta; tente salvar novamente.');
    const persist = vi.fn(async (entry) => {
      if (entry.id === 'x') throw fail;
      return { saved: true, version: 2 };
    });
    const outcome = await persistProjectsIndependently([X, Y, Z], persist);
    expect(persist.mock.calls.map(([entry]) => entry.id)).toEqual(['x', 'y', 'z']);
    expect(outcome.results.map(({ entry }) => entry.id)).toEqual(['y', 'z']);
    expect(outcome.failures).toEqual([{ entry: X, error: fail }]);
  });

  it('em "Salvar" (um projeto só) a primeira falha continua interrompendo', async () => {
    const fail = new Error('falhou');
    const persist = vi.fn(async () => { throw fail; });
    await expect(persistProjectsIndependently([X, Y], persist, { failFast: true })).rejects.toBe(fail);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('o aviso diz de qual projeto é a falha quando não é o que está aberto', () => {
    const error = Object.assign(new Error('Este projeto excede o tamanho permitido na nuvem.'), { code: 'project_too_large' });
    const own = combinedProjectSyncError([{ entry: X, error }], { activeId: 'x' });
    expect(own).toBe(error);
    const other = combinedProjectSyncError([{ entry: X, error }], { activeId: 'y' });
    expect(other.message).toBe('Projeto “Com foto grande”: Este projeto excede o tamanho permitido na nuvem.');
    expect(other.code).toBe('project_too_large');
  });

  it('várias falhas viram um aviso só', () => {
    const a = new Error('2 imagem(ns) não foram enviadas.');
    const b = new Error('Este projeto excede o tamanho permitido na nuvem.');
    const combined = combinedProjectSyncError([{ entry: X, error: a }, { entry: Z, error: b }], { activeId: 'y' });
    expect(combined.message).toBe('2 projetos não foram enviados à conta. Projeto “Com foto grande”: 2 imagem(ns) não foram enviadas.');
  });

  it('sem falha não há erro', () => {
    expect(combinedProjectSyncError([], { activeId: 'x' })).toBeNull();
  });
});
