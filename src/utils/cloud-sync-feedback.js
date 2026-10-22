/** A stale lazy module must never trigger an editor reload before data is safe. */
export function isModuleLoadError(error) {
  const message = String(error?.message || error || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Unable to preload CSS/i.test(message);
}

export function cloudSyncFailureMessage(error, { localSaved = false, cloudSaved = false, legacy = false } = {}) {
  if (isModuleLoadError(error)) {
    return localSaved
      ? 'A Moont foi atualizada. A edição foi preservada neste navegador. Recarregue a página e clique em Salvar para retomar a sincronização com a conta.'
      : 'A Moont foi atualizada. Sua edição continua aberta, mas a cópia local não foi confirmada. Baixe um backup do projeto antes de recarregar; depois, clique em Salvar.';
  }
  if (legacy) {
    return `${localSaved ? 'Projeto salvo neste navegador. ' : ''}Sincronização incompleta: ${error?.message || 'tente novamente.'}`;
  }
  return `${cloudSaved ? 'O projeto foi salvo, mas a lista não foi atualizada. ' : localSaved ? 'A edição continua neste editor, mas ainda não foi confirmada na conta. ' : ''}${error?.message || 'Não foi possível sincronizar.'}`;
}
