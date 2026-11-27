import { describe, expect, it } from 'vitest';
import { cloudSyncFailureMessage, isModuleLoadError } from '../../src/utils/cloud-sync-feedback.js';

describe('cloud save feedback after a deployment', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://moont.ai/assets/projects-cloud-sync-old.js',
    'Importing a module script failed.',
    'error loading dynamically imported module',
    'ChunkLoadError: Loading chunk failed',
    'Unable to preload CSS for /assets/old.css',
    "'text/html' is not a valid JavaScript MIME type for module script 'https://moont.ai/assets/LandingFirst-C70yZLkC.js'.",
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

  it('main.jsx recarrega sozinho com o mesmo detector, inclusive no erro de MIME do Safari', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../../src/main.jsx', import.meta.url), 'utf8');
    expect(source).toContain("import { isModuleLoadError } from './utils/cloud-sync-feedback.js'");
    expect(source).toMatch(/function isStaleChunkError\(err\) \{\s*return isModuleLoadError\(err\)/);
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
