/**
 * Fila durável de alterações por projeto e por conta. localStorage é apenas
 * cache de UI; a confirmação desta transação IndexedDB é o recibo local.
 */
import { dataOwnerAliases, readDataOwner } from './account-data-owner.js';
import { isAccountDataWriteOwnerCurrent } from './storage.js';
import {
  ProjectApiError, deleteProject, getProject, isProjectConflict,
  isProjectDeletedConflict, putProject,
} from './projects-client.js';

export const PROJECTS_OUTBOX_DB = 'viral-carrossel-project-outbox';
const STORE = 'operations';
const DB_VERSION = 1;
const TIMEOUT_MS = 8_000;
const PROJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const MAX_ENTRY_BYTES = 2 * 1024 * 1024;

function outboxError(message, code) {
  return new ProjectApiError(message, { code });
}

function assertActiveOwner(ownerId) {
  if (typeof ownerId !== 'string' || !ownerId || readDataOwner() !== ownerId
    || !isAccountDataWriteOwnerCurrent()) {
    throw outboxError('A conta mudou. As alterações pendentes não foram enviadas.', 'project_owner_changed');
  }
}

function assertId(id) {
  if (typeof id !== 'string' || !PROJECT_ID.test(id)) {
    throw outboxError('ID de projeto inválido.', 'project_bad_id');
  }
}

function assertVersion(version) {
  if (!Number.isSafeInteger(version) || version < 0) {
    throw outboxError('Versão de projeto inválida.', 'project_bad_version');
  }
}

function operationKey(ownerId, projectId) {
  return `${ownerId}\u0000${projectId}`;
}

function operationId() {
  try { return crypto.randomUUID(); }
  catch { return `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`; }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    let settled = false;
    let request;
    const finish = (error, db) => {
      if (settled) { db?.close(); return; }
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(db);
    };
    const timer = setTimeout(() => finish(outboxError(
      'O armazenamento local de projetos não respondeu.', 'project_outbox_unavailable',
    )), TIMEOUT_MS);
    try {
      if (typeof indexedDB === 'undefined') {
        throw outboxError('O armazenamento local de projetos está indisponível.', 'project_outbox_unavailable');
      }
      request = indexedDB.open(PROJECTS_OUTBOX_DB, DB_VERSION);
      request.onupgradeneeded = () => {
        if (settled) { request.transaction?.abort(); return; }
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'key' }).createIndex('owner', 'owner');
        }
      };
      request.onsuccess = () => finish(null, request.result);
      request.onerror = () => finish(request.error || outboxError(
        'Não foi possível abrir o armazenamento de projetos.', 'project_outbox_unavailable',
      ));
      request.onblocked = () => finish(outboxError(
        'O armazenamento de projetos está ocupado em outra aba.', 'project_outbox_unavailable',
      ));
    } catch (error) { finish(error); }
  });
}

/** Só confirma após `transaction.oncomplete`: request.onsuccess não é gravação durável. */
async function transaction(mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let settled = false;
    let result;
    let tx;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      db.close();
      if (error) reject(error);
      else resolve(result);
    };
    const timer = setTimeout(() => {
      try { tx?.abort(); } catch { /* transação encerrada */ }
      finish(outboxError('A gravação local do projeto não foi confirmada.', 'project_outbox_timeout'));
    }, TIMEOUT_MS);
    try {
      tx = db.transaction(STORE, mode);
      tx.oncomplete = () => finish();
      tx.onabort = () => finish(tx.error || outboxError(
        'A gravação local do projeto foi interrompida.', 'project_outbox_failed',
      ));
      tx.onerror = () => { /* onabort é a confirmação da falha */ };
      action(tx.objectStore(STORE), (value) => { result = value; }, (error) => {
        try { tx.abort(); } catch { /* transação encerrada */ }
        finish(error);
      });
    } catch (error) {
      try { tx?.abort(); } catch { /* */ }
      finish(error);
    }
  });
}

function persistOperation(ownerId, projectId, kind, entry, baseVersion, projectName = '') {
  assertActiveOwner(ownerId);
  assertId(projectId);
  assertVersion(baseVersion);
  const key = operationKey(ownerId, projectId);
  return transaction('readwrite', (store, setResult, fail) => {
    const read = store.get(key);
    read.onsuccess = () => {
      try {
        assertActiveOwner(ownerId);
        const previous = read.result;
        const now = Date.now();
        // Uma edição de projeto já excluído só pode voltar à nuvem como um
        // projeto novo após uma escolha explícita da pessoa. Salvar de novo
        // atualiza a cópia durável, mas não a retira da revisão.
        const effectiveKind = previous?.kind === 'review_put_deleted' && kind === 'put'
          ? 'review_put_deleted' : kind;
        const keepsEntry = effectiveKind === 'put'
          || effectiveKind === 'review_put_deleted'
          || effectiveKind === 'review_put_billing';
        const op = {
          key, owner: ownerId, projectId, kind: effectiveKind,
          entry: keepsEntry ? entry : null,
          // Edits sucessivos conservam a versão do primeiro envio ainda pendente.
          // Uma exclusão em revisão só pode ser repetida por escolha explícita
          // do usuário, com a versão atual que a UI acabou de observar.
          baseVersion: previous?.kind === 'review_delete'
            ? baseVersion : (previous?.baseVersion ?? baseVersion),
          projectName: kind === 'delete'
            ? String(projectName || previous?.projectName || '').slice(0, 160)
            : effectiveKind === 'review_put_deleted'
              ? String(entry?.name || previous?.projectName || '').slice(0, 160) : '',
          ...(effectiveKind === 'review_put_deleted'
            ? { reviewVersion: previous.reviewVersion } : {}),
          opId: operationId(),
          createdAt: previous?.createdAt ?? now,
          updatedAt: now,
        };
        store.put(op);
        setResult(op);
      } catch (error) {
        fail(error);
      }
    };
  });
}

/** Persiste o JSON enviado ao servidor; rejeita documentos que ele não aceita. */
export async function queueProjectPut(ownerId, entry, { baseVersion = 0 } = {}) {
  assertId(entry?.id);
  let snapshot;
  try { snapshot = JSON.stringify(entry); }
  catch { throw outboxError('Não foi possível preparar este projeto para salvar.', 'project_bad_entry'); }
  if (!snapshot || new TextEncoder().encode(snapshot).byteLength > MAX_ENTRY_BYTES) {
    throw outboxError('Este projeto excede o tamanho permitido.', 'project_too_large');
  }
  return persistOperation(ownerId, entry.id, 'put', JSON.parse(snapshot), baseVersion);
}

export function queueProjectDelete(ownerId, projectId, { baseVersion = 0, projectName = '' } = {}) {
  return persistOperation(ownerId, projectId, 'delete', null, baseVersion, projectName);
}

export function getPendingProjectOp(ownerId, projectId) {
  assertActiveOwner(ownerId);
  assertId(projectId);
  return transaction('readonly', (store, setResult) => {
    const read = store.get(operationKey(ownerId, projectId));
    read.onsuccess = () => setResult(read.result || null);
  });
}

export function listPendingProjectOps(ownerId) {
  assertActiveOwner(ownerId);
  return transaction('readonly', (store, setResult) => {
    const read = store.index('owner').getAll(ownerId);
    read.onsuccess = () => setResult((read.result || []).sort((a, b) =>
      a.createdAt - b.createdAt || a.projectId.localeCompare(b.projectId)));
  });
}

/** Nunca remove uma edição nova que chegou enquanto a antiga estava em trânsito. */
export function acknowledgeProjectOp(ownerId, sentOp, version) {
  assertActiveOwner(ownerId);
  assertVersion(version);
  const key = operationKey(ownerId, sentOp.projectId);
  return transaction('readwrite', (store, setResult, fail) => {
    const read = store.get(key);
    read.onsuccess = () => {
      try {
        assertActiveOwner(ownerId);
        const current = read.result;
        if (!current) { setResult(false); return; }
        if (current.opId === sentOp.opId) {
          store.delete(key);
          setResult(true);
        } else if (current.baseVersion === sentOp.baseVersion) {
          store.put({ ...current, baseVersion: version });
          setResult(false);
        } else {
          setResult(false);
        }
      } catch (error) { fail(error); }
    };
  });
}

/** Confirma a cópia recuperada sem atribuir sua versão ao projeto original. */
function settleRecoveredPut(ownerId, sentOp) {
  assertActiveOwner(ownerId);
  return transaction('readwrite', (store, setResult, fail) => {
    const read = store.get(operationKey(ownerId, sentOp.projectId));
    read.onsuccess = () => {
      try {
        assertActiveOwner(ownerId);
        if (read.result?.opId === sentOp.opId) {
          store.delete(operationKey(ownerId, sentOp.projectId));
          setResult(true);
        } else {
          // Outra edição chegou enquanto a cópia era enviada. Ela permanece
          // na fila e, se ainda conflitar, ganhará sua própria cópia.
          setResult(false);
        }
      } catch (error) { fail(error); }
    };
  });
}

/** Uma exclusão concorrente fica registrada até a pessoa rever a versão nova. */
function markDeleteForReview(ownerId, sentOp, remote) {
  assertActiveOwner(ownerId);
  return transaction('readwrite', (store, setResult, fail) => {
    const read = store.get(operationKey(ownerId, sentOp.projectId));
    read.onsuccess = () => {
      try {
        assertActiveOwner(ownerId);
        const current = read.result;
        if (current?.opId !== sentOp.opId) { setResult(false); return; }
        store.put({
          ...current, kind: 'review_delete', reviewVersion: remote.version,
          projectName: String(remote.entry?.name || current.projectName || '').slice(0, 160),
          updatedAt: Date.now(),
        });
        setResult(true);
      } catch (error) { fail(error); }
    };
  });
}

/** Um tombstone não autoriza recriar o projeto como cópia automaticamente. */
function markPutForReview(ownerId, sentOp, cloudVersion) {
  assertActiveOwner(ownerId);
  return transaction('readwrite', (store, setResult, fail) => {
    const read = store.get(operationKey(ownerId, sentOp.projectId));
    read.onsuccess = () => {
      try {
        assertActiveOwner(ownerId);
        const current = read.result;
        if (!current || (current.kind !== 'put' && current.kind !== 'review_put_deleted' && current.kind !== 'review_put_billing')) {
          setResult(false);
          return;
        }
        store.put({
          ...current, kind: 'review_put_deleted',
          reviewVersion: Number.isSafeInteger(cloudVersion) ? cloudVersion : null,
          projectName: String(current.entry?.name || current.projectName || '').slice(0, 160),
          updatedAt: Date.now(),
        });
        setResult(true);
      } catch (error) { fail(error); }
    };
  });
}

/** Assinatura recusada não é exclusão. O próximo envio tenta de novo. */
function markPutForBilling(ownerId, sentOp) {
  assertActiveOwner(ownerId);
  return transaction('readwrite', (store, setResult, fail) => {
    const read = store.get(operationKey(ownerId, sentOp.projectId));
    read.onsuccess = () => {
      try {
        assertActiveOwner(ownerId);
        const current = read.result;
        if (!current || (current.kind !== 'put' && current.kind !== 'review_put_billing')) {
          setResult(false);
          return;
        }
        store.put({
          ...current,
          kind: 'review_put_billing',
          projectName: String(current.entry?.name || current.projectName || '').slice(0, 160),
          updatedAt: Date.now(),
        });
        setResult(true);
      } catch (error) { fail(error); }
    };
  });
}

function canonicalJson(value) {
  const normalize = (item) => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.keys(item).sort()
        .filter((key) => item[key] !== undefined)
        .map((key) => [key, normalize(item[key])]));
    }
    return item;
  };
  return JSON.stringify(normalize(value));
}

function sameSavedEntry(local, remote) {
  // O servidor carimba updatedAt ao confirmar o PUT. Esse campo não faz
  // parte da edição enviada e não pode impedir o reconhecimento de uma
  // resposta de rede perdida.
  const { updatedAt: _localTimestamp, ...localContent } = local || {};
  const { updatedAt: _remoteTimestamp, ...remoteContent } = remote || {};
  return canonicalJson(localContent) === canonicalJson(remoteContent);
}

function conflictCopyEntry(op) {
  // O ID deriva do opId durável: se a resposta se perder, o próximo boot
  // encontra a mesma cópia em vez de criar uma nova a cada tentativa.
  const id = `conflict-${String(op.opId).replace(/[^A-Za-z0-9]/g, '').slice(0, 72)}`;
  const name = String(op.entry?.name || 'Projeto').trim().slice(0, 120);
  return {
    ...op.entry,
    id,
    name: `${name} (cópia de conflito)`,
    conflictSourceId: op.projectId,
    createdAt: op.createdAt,
  };
}

async function recoverPutAsCopy(op, { signal, expectedOwnerId }) {
  const entry = conflictCopyEntry(op);
  let copy;
  try {
    copy = await putProject(entry, { baseVersion: 0, signal, expectedOwnerId, opId: op.opId });
  } catch (error) {
    if (!isProjectConflict(error)) throw error;
    copy = await getProject(entry.id, { signal, expectedOwnerId });
    if (!copy || copy.version !== 1 || !sameSavedEntry(entry, copy.entry)) throw error;
  }
  if (copy?.version !== 1) {
    throw outboxError('A nuvem não confirmou a cópia do projeto em conflito.', 'project_conflict_copy_unconfirmed');
  }
  return {
    sourceProjectId: op.projectId,
    copyProjectId: entry.id,
    copyName: entry.name,
  };
}

/** Confirma a conta do cookie antes de transmitir qualquer projeto do outbox. */
export async function verifyProjectOutboxOwner(ownerId, { signal } = {}) {
  assertActiveOwner(ownerId);
  let response;
  try {
    response = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store', signal });
  } catch {
    throw outboxError('Não foi possível confirmar a conta para sincronizar.', 'project_owner_unverified');
  }
  const session = await response.json().catch(() => null);
  if (!response.ok || session?.active !== true) {
    throw outboxError('Entre na conta antes de sincronizar projetos.', 'project_owner_unverified');
  }
  const aliases = dataOwnerAliases(session.email, session.customerId);
  const billingDisabled = session.billingDisabled === true && ownerId === 'billing-disabled';
  if (!aliases.has(ownerId) && !billingDisabled) {
    throw outboxError('A sessão pertence a outra conta. Nada foi enviado.', 'project_owner_changed');
  }
  const expectedOwnerId = session.customerId || (billingDisabled ? 'billing-disabled' : null);
  if (!expectedOwnerId) {
    throw outboxError('Não foi possível confirmar a conta para sincronizar.', 'project_owner_unverified');
  }
  assertActiveOwner(ownerId);
  return expectedOwnerId;
}

async function sendOperation(ownerId, op, { signal, expectedOwnerId }) {
  assertActiveOwner(ownerId);
  const isPut = op.kind === 'put' || op.kind === 'review_put_billing';
  try {
    return isPut
      ? await putProject(op.entry, { baseVersion: op.baseVersion, signal, expectedOwnerId, opId: op.opId })
      : await deleteProject(op.projectId, { baseVersion: op.baseVersion, signal, expectedOwnerId, opId: op.opId });
  } catch (error) {
    if (isPut && isProjectDeletedConflict(error)) {
      return { id: op.projectId, needsReviewPut: true, cloudVersion: error.cloudVersion };
    }
    // Assinatura recusada não pode parecer exclusão nem parar os outros projetos.
    if (error?.status === 402) {
      return { id: op.projectId, billingDeferred: true };
    }
    if (!isProjectConflict(error)) throw error;
    assertActiveOwner(ownerId);
    const remote = await getProject(op.projectId, { signal, expectedOwnerId });
    // A resposta do primeiro envio pode ter se perdido. Comparar a versão
    // atual permite reconhecer o mesmo PUT/DELETE sem reenviar e duplicar.
    if (isPut && remote && remote.version === op.baseVersion + 1
      && sameSavedEntry(op.entry, remote.entry)) {
      return remote;
    }
    if (op.kind === 'delete' && !remote) {
      return { id: op.projectId, deleted: true,
        version: Number.isSafeInteger(error.cloudVersion) ? error.cloudVersion : op.baseVersion + 1 };
    }
    // Compatibilidade com servidores que ainda devolvem 409 genérico para
    // um tombstone: GET 404 nunca permite recuperar o PUT como cópia.
    if (isPut && !remote) {
      return { id: op.projectId, needsReviewPut: true, cloudVersion: error.cloudVersion };
    }
    if (isPut) {
      const recoveredCopy = await recoverPutAsCopy(op, { signal, expectedOwnerId });
      assertActiveOwner(ownerId);
      return { id: op.projectId, recoveredCopy };
    }
    if (op.kind === 'delete' && remote) {
      return { id: op.projectId, needsReview: remote };
    }
    throw error;
  }
}

/**
 * A fila fica intacta se rede, sessão ou versão falharem. Uma edição recebida
 * durante o envio é mantida e herda a versão confirmada da operação anterior.
 */
export async function flushProjectOutbox(ownerId, { signal, maxOperations = 100 } = {}) {
  assertActiveOwner(ownerId);
  if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) {
    throw outboxError('Limite de sincronização inválido.', 'project_bad_limit');
  }
  const expectedOwnerId = await verifyProjectOutboxOwner(ownerId, { signal });
  let sent = 0;
  const recoveries = [];
  let queue = (await listPendingProjectOps(ownerId))
    .filter((op) => op.kind !== 'review_delete' && op.kind !== 'review_put_deleted');
  for (let round = 0; round < 20 && queue.length; round += 1) {
    const operations = queue.slice(0, maxOperations);
    queue = queue.slice(maxOperations);
    for (const snapshot of operations) {
      if (signal?.aborted) throw outboxError('Sincronização cancelada.', 'project_sync_aborted');
      assertActiveOwner(ownerId);
      const op = await getPendingProjectOp(ownerId, snapshot.projectId);
      if (!op || op.opId !== snapshot.opId) continue;
      if (op.kind === 'review_delete' || op.kind === 'review_put_deleted') continue;
      const result = await sendOperation(ownerId, op, { signal, expectedOwnerId });
      assertActiveOwner(ownerId);
      if (result.billingDeferred) {
        await markPutForBilling(ownerId, op);
        queue = queue.filter((item) => item.projectId !== op.projectId);
        continue;
      }
      if (result.recoveredCopy) {
        await settleRecoveredPut(ownerId, op);
        recoveries.push(result.recoveredCopy);
        sent += 1;
        continue;
      }
      if (result.needsReview) {
        await markDeleteForReview(ownerId, op, result.needsReview);
        continue;
      }
      if (result.needsReviewPut) {
        await markPutForReview(ownerId, op, result.cloudVersion);
        continue;
      }
      if (!Number.isSafeInteger(result?.version) || result.version < 0) {
        throw outboxError('A nuvem não confirmou a versão do projeto.', 'project_bad_response');
      }
      await acknowledgeProjectOp(ownerId, op, result.version);
      sent += 1;
    }
  }
  const remaining = await listPendingProjectOps(ownerId);
  const needsReview = remaining.filter((op) => op.kind === 'review_delete'
    || op.kind === 'review_put_deleted'
    || op.kind === 'review_put_billing').map((op) => ({
    projectId: op.projectId, projectName: op.projectName || '',
    ...(op.reviewVersion != null ? { reviewVersion: op.reviewVersion } : {}),
    ...(op.kind === 'review_put_deleted' ? { kind: 'put_deleted' } : {}),
    ...(op.kind === 'review_put_billing' ? { kind: 'put_billing' } : {}),
  }));
  return {
    sent, pending: remaining.length,
    ...(recoveries.length ? { recoveries } : {}),
    ...(needsReview.length ? { needsReview } : {}),
  };
}
