/** Cofre durável separado do cache pequeno em localStorage e das imagens. */
export const ACCOUNT_VAULT_DB = 'viral-carrossel-account-vault';
const STORE = 'accounts';
const MAP_KEY = 'vault';
const TIMEOUT_MS = 8_000;

/** Sem conexão global: trocas de versão e recuperação após falha não ficam presas. */
function openVaultDatabase() {
  return new Promise((resolve, reject) => {
    let settled = false;
    let request;
    const finish = (error, db) => {
      if (settled) { db?.close(); return; }
      settled = true;
      clearTimeout(timer);
      if (error) { error.vaultUnavailable = true; reject(error); }
      else resolve(db);
    };
    const timer = setTimeout(() => finish(new Error('O cofre local não respondeu.')), TIMEOUT_MS);
    try {
      if (typeof indexedDB === 'undefined') throw new Error('IndexedDB indisponível.');
      request = indexedDB.open(ACCOUNT_VAULT_DB, 1);
      request.onupgradeneeded = () => {
        if (settled) { request.transaction?.abort(); return; }
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => finish(null, request.result);
      request.onerror = () => finish(request.error || new Error('Não foi possível abrir o cofre local.'));
      request.onblocked = () => finish(new Error('O cofre local está ocupado em outra aba.'));
    } catch (error) { finish(error); }
  });
}

/**
 * Ler, migrar e atualizar dentro da MESMA transação impede duas contas/abas
 * de gravarem mapas completos derivados de versões diferentes.
 * `change` deve ser síncrono; bytes de mídia são preparados antes de entrar.
 */
export async function updateDurableVault(change) {
  const db = await openVaultDatabase();
  return new Promise((resolve, reject) => {
    let result;
    let settled = false;
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      db.close();
      if (error) reject(error);
      else resolve(result);
    };
    const timer = setTimeout(() => {
      try { transaction.abort(); } catch { /* transação encerrada */ }
      finish(new Error('A gravação do cofre local não foi confirmada.'));
    }, TIMEOUT_MS);
    transaction.oncomplete = () => finish();
    transaction.onabort = () => finish(transaction.error || new Error('A gravação do cofre local foi interrompida.'));
    transaction.onerror = () => { /* onabort confirma a falha da transação */ };
    const read = store.get(MAP_KEY);
    read.onsuccess = () => {
      try {
        const current = read.result && typeof read.result === 'object' ? read.result : {};
        const next = change(current);
        result = next.result;
        if (next.map) store.put(next.map, MAP_KEY);
      } catch (error) {
        try { transaction.abort(); } catch { /* */ }
        finish(error);
      }
    };
  });
}
