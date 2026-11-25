// QA 24/11 (conta 6): o erro do navegador chegava cru à tela, em inglês:
// "Failed to write blobs (IOError)". O aviso de salvar colava `error.message`
// depois da frase da Moont, e qualquer toast repetia o texto do navegador.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cloudSyncFailureMessage } from '../../src/utils/cloud-sync-feedback.js';
import { toastMessage } from '../../src/hooks/useToasts.js';
import { readableErrorMessage, storageErrorMessage, translateStorageErrorText } from '../../src/utils/storage-error-message.js';

const browserError = (name, message) => Object.assign(new Error(message), { name });

// Texto exato que Chrome, Safari e Firefox entregam nesta família de falhas.
const RAW = [
  ['DataError', 'Failed to write blobs (IOError)'],
  ['UnknownError', 'An internal error was encountered in the Indexed Database server'],
  ['UnknownError', 'Failed to read large IndexedDB value'],
  ['QuotaExceededError', 'The quota has been exceeded.'],
  ['QuotaExceededError', "Failed to execute 'setItem' on 'Storage': Setting the value of 'vc_library' exceeded the quota."],
  ['QuotaExceededError', 'QuotaExceededError'],
];
const ENGLISH = /Failed to|IOError|quota|Indexed ?Database|IndexedDB|internal error|QuotaExceeded|setItem/i;

describe('erro de armazenamento do navegador chega à tela em português', () => {
  it.each(RAW)('aviso de salvar não repete o texto do navegador: %s · %s', (name, message) => {
    for (const options of [{ localSaved: false }, { localSaved: true }, { cloudSaved: true }, { legacy: true, localSaved: true }]) {
      const feedback = cloudSyncFailureMessage(browserError(name, message), options);
      expect(feedback).not.toMatch(ENGLISH);
      expect(feedback).toMatch(/navegador/);
    }
  });

  it.each(RAW)('qualquer toast troca o trecho cru e conserva o resto da frase: %s · %s', (_name, message) => {
    const shown = toastMessage(`Imagem do card 2: ${message}`);
    expect(shown.startsWith('Imagem do card 2: ')).toBe(true);
    expect(shown).not.toMatch(ENGLISH);
    expect(toastMessage(`Erro ao exportar: ${message}`)).not.toMatch(ENGLISH);
  });

  it('diz o que fazer em cada caso', () => {
    const full = storageErrorMessage(browserError('QuotaExceededError', 'The quota has been exceeded.'));
    expect(full).toMatch(/está cheio/);
    expect(full).toMatch(/backup/);
    expect(full).toMatch(/liberar espaço/);
    const write = storageErrorMessage(browserError('DataError', 'Failed to write blobs (IOError)'));
    expect(write).toMatch(/não conseguiu gravar/);
    expect(write).toMatch(/backup/);
    expect(write).toMatch(/recarregue/i);
    const read = storageErrorMessage(browserError('UnknownError', 'Failed to read large IndexedDB value'));
    expect(read).toMatch(/não conseguiu ler/);
    expect(read).toMatch(/recarregue/i);
    // O nome do erro basta: o Safari às vezes manda a mensagem vazia.
    expect(storageErrorMessage(browserError('QuotaExceededError', ''))).toBe(full);
  });

  it('não mexe em mensagem que já é da Moont nem em erro de outra natureza', () => {
    const own = 'A biblioteca mudou durante a sincronização.';
    expect(translateStorageErrorText(own)).toBe(own);
    expect(toastMessage(own)).toBe(own);
    expect(storageErrorMessage(new Error(own))).toBeNull();
    expect(storageErrorMessage(new TypeError('Failed to fetch'))).toBeNull();
    expect(cloudSyncFailureMessage(new Error(own), { localSaved: true })).toBe(
      'A edição continua neste editor, mas ainda não foi confirmada na conta. A biblioteca mudou durante a sincronização.',
    );
    // Toast com conteúdo que não é texto (elemento React) passa intacto.
    const node = { type: 'span' };
    expect(toastMessage(node)).toBe(node);
  });

  it('texto novo segue a regra de escrita: sem travessão e sem jargão', () => {
    for (const [name, message] of RAW) {
      const text = storageErrorMessage(browserError(name, message));
      expect(text).not.toMatch(/[—–]/);
      expect(text).not.toMatch(/IndexedDB|localStorage|cache|blob|quota/i);
    }
  });

  it('a tela de abertura da conta também recebe a frase traduzida', () => {
    const fallback = 'Não foi possível restaurar seus projetos. Verifique a conexão e tente novamente.';
    expect(readableErrorMessage(browserError('UnknownError', 'Failed to read large IndexedDB value'), fallback))
      .toMatch(/não conseguiu ler/);
    expect(readableErrorMessage(new Error('A conta mudou.'), fallback)).toBe('A conta mudou.');
    expect(readableErrorMessage(null, fallback)).toBe(fallback);
    const access = readFileSync(new URL('../../src/hooks/useAccess.js', import.meta.url), 'utf8');
    expect(access).not.toMatch(/onLibraryBlocked\?\.\(error\?\.message/);
  });

  it('o toast do app passa a mensagem pela tradução', () => {
    const source = readFileSync(new URL('../../src/hooks/useToasts.js', import.meta.url), 'utf8');
    expect(source).toMatch(/message:\s*toastMessage\(message\)/);
  });
});
