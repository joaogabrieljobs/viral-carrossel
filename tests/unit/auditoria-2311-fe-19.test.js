// FE-19 (auditoria de 23/11): no plano grátis, "Salvar" anunciava "Projeto
// salvo neste aparelho." e avançava a hora de "salvo" sem olhar se a gravação
// local tinha dado certo. Com o armazenamento do navegador cheio (uma fonte
// própria de 4 MB basta), nada era gravado e era a única cópia.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freePlanSaveFeedback } from '../../src/utils/cloud-sync-feedback.js';
import { SK, lsSet } from '../../src/utils/storage.js';

describe('FE-19: salvar no plano grátis só anuncia sucesso quando gravou', () => {
  beforeEach(() => {
    const values = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => values.get(key) ?? null,
      setItem: () => { throw new DOMException('Quota cheia', 'QuotaExceededError'); },
      removeItem: (key) => { values.delete(key); },
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('com o armazenamento cheio a gravação local devolve false e o aviso é de erro', () => {
    const fonte = `data:font/woff2;base64,${'A'.repeat(4096)}`;
    const localPersisted = lsSet(SK.library, [{ id: 'p1', doc: { brand: { customTitleFont: { dataUrl: fonte } }, slides: [] } }]);
    expect(localPersisted).toBe(false);
    const feedback = freePlanSaveFeedback({ localPersisted });
    expect(feedback.saved).toBe(false);
    expect(feedback.kind).toBe('error');
    expect(feedback.message).toContain('Não foi possível salvar neste aparelho');
    expect(feedback.message).toContain('backup');
    expect(feedback.message).not.toContain('Projeto salvo');
  });

  it('gravação confirmada continua anunciando o salvamento', () => {
    expect(freePlanSaveFeedback({ localPersisted: true })).toEqual({
      saved: true, kind: 'success', message: 'Projeto salvo neste aparelho.', duration: 3000,
    });
  });
});
