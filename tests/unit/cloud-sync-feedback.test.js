import { describe, expect, it } from 'vitest';
import { cloudSyncFailureMessage, isModuleLoadError } from '../../src/utils/cloud-sync-feedback.js';

describe('cloud save feedback after a deployment', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://moont.ai/assets/projects-cloud-sync-old.js',
    'Importing a module script failed.',
    'error loading dynamically imported module',
    'ChunkLoadError: Loading chunk failed',
    'Unable to preload CSS for /assets/old.css',
  ])('recognizes module loading failure: %s', (message) => {
    expect(isModuleLoadError(new Error(message))).toBe(true);
    const feedback = cloudSyncFailureMessage(new Error(message), { localSaved: true });
    expect(feedback).toContain('preservada neste navegador');
    expect(feedback).toContain('Recarregue a página e clique em Salvar');
    expect(feedback).not.toContain('/assets/');
    expect(feedback).not.toContain('foi salvo na conta');
  });

  it('requires a backup before suggesting reload when local persistence failed', () => {
    const error = new Error('Failed to fetch dynamically imported module');
    for (const cloudSaved of [false, true]) {
      const feedback = cloudSyncFailureMessage(error, { localSaved: false, cloudSaved });
      expect(feedback).toContain('cópia local não foi confirmada');
      expect(feedback).toContain('backup do projeto antes de recarregar');
      expect(feedback).not.toContain('preservada neste navegador');
    }
  });

  it('keeps network and account conflict failures distinct from deployment errors', () => {
    const error = new Error('A biblioteca mudou durante a sincronização.');
    expect(isModuleLoadError(error)).toBe(false);
    expect(isModuleLoadError(new TypeError('Failed to fetch'))).toBe(false);
    expect(cloudSyncFailureMessage(error, { localSaved: true })).toBe(
      'A edição continua neste editor, mas ainda não foi confirmada na conta. A biblioteca mudou durante a sincronização.',
    );
    expect(cloudSyncFailureMessage(error, { cloudSaved: true })).toContain('O projeto foi salvo, mas a lista não foi atualizada.');
    expect(cloudSyncFailureMessage(error, { legacy: true, localSaved: true })).toContain('Projeto salvo neste navegador. Sincronização incompleta:');
  });
});
