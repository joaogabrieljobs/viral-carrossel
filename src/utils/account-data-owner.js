/**
 * Isola dados locais (biblioteca, marcas) por conta autenticada.
 * Cada conta tem um slot no cofre (`account-vault`) — logout limpa as chaves
 * activas mas a mesma conta recupera os projetos ao reentrar neste browser.
 */
import { clearAccountLocalData } from './clear-account-data.js';
import { SK, areAccountDataWritesLocked, bindAccountDataWriteOwner, isAccountDataWriteOwnerCurrent, isAccountWriteLockProbePending, lockAccountDataWrites, unlockAccountDataWrites, waitForAccountWriteLockProbe } from './storage.js';
import { restoreAccountVault, snapshotAccountVault } from './account-vault.js';

export const DATA_OWNER_KEY = SK.dataOwner;

function libraryLooksOccupied() {
  try {
    const raw = localStorage.getItem(SK.library);
    if (!raw) return false;
    const lib = JSON.parse(raw);
    return Array.isArray(lib) && lib.length > 0;
  } catch {
    return false;
  }
}

/** Preferir email (estável). customerId só quando não há email. */
export function normalizeDataOwnerId(email, customerId) {
  const emailN = String(email || '').trim().toLowerCase();
  if (emailN) return `email:${emailN}`;
  const id = String(customerId || '').trim();
  if (id) return `id:${id}`;
  return null;
}

/** Aliases da mesma conta (id:cus ↔ email:) — evita wipe falso ao migrar formato. */
export function dataOwnerAliases(email, customerId) {
  const aliases = new Set();
  const emailN = String(email || '').trim().toLowerCase();
  const id = String(customerId || '').trim();
  if (emailN) aliases.add(`email:${emailN}`);
  if (id) aliases.add(`id:${id}`);
  return aliases;
}

export function isSameDataOwner(prev, next, session = {}) {
  if (!prev || !next) return false;
  if (prev === next) return true;
  const aliases = dataOwnerAliases(session.email, session.customerId);
  return aliases.has(prev) && aliases.has(next);
}

export function readDataOwner() {
  try {
    const raw = localStorage.getItem(DATA_OWNER_KEY);
    if (raw == null || raw === '') return null;
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'string' && parsed ? parsed : null;
    } catch {
      return String(raw);
    }
  } catch {
    return null;
  }
}

export function writeDataOwner(ownerId, aliases = []) {
  if (!ownerId) return;
  const ownerAliases = JSON.stringify([...new Set([ownerId, ...aliases])]);
  try {
    localStorage.setItem(DATA_OWNER_KEY, JSON.stringify(ownerId));
    bindAccountDataWriteOwner(ownerId, { switchedHere: true });
  } catch { /* quota / privado */ }
  try { localStorage.setItem(SK.dataOwnerAliases, ownerAliases); } catch { /* quota */ }
  try { sessionStorage.setItem(SK.dataOwnerAliases, ownerAliases); } catch { /* privado */ }
}

/** O restore agora aguarda IndexedDB; o React antigo não pode gravar nesse intervalo. */
async function restoreForBoot(ownerId, aliases, onRestored, isCurrent) {
  const wasLocked = areAccountDataWritesLocked();
  const expectedOwner = readDataOwner();
  const isRestoreCurrent = () => expectedOwner === ownerId && readDataOwner() === expectedOwner
    && (typeof isCurrent !== 'function' || isCurrent());
  lockAccountDataWrites();
  let restored = false;
  try {
    restored = await restoreAccountVault(ownerId, aliases, { onRestored, isCurrent: isRestoreCurrent });
    if (!isRestoreCurrent()) restored = 'blocked';
    return restored;
  } catch (error) {
    if (error?.code !== 'ACCOUNT_VAULT_OWNER_CHANGED') throw error;
    restored = 'blocked';
    return restored;
  } finally {
    if (restored === false && !wasLocked) unlockAccountDataWrites();
  }
}

function reloadAccountSwitch() {
  // O React ainda contém o estado anterior até ao novo boot. Um flush de
  // pagehide não pode substituir o cofre que acabámos de restaurar.
  lockAccountDataWrites();
  const loc = typeof globalThis !== 'undefined' ? globalThis.location : null;
  try {
    const href = loc?.href || 'https://moont.ai/';
    const url = new URL(href);
    url.searchParams.delete('login');
    url.searchParams.delete('email');
    url.searchParams.set('app', '1');
    url.searchParams.set('account_switch', '1');
    loc?.replace?.(url.pathname + url.search + url.hash);
  } catch {
    loc?.replace?.('/?app=1&account_switch=1');
  }
}

/**
 * @param {object} session — resultado de /api/auth/session
 * @param {{ explicitLogin?: boolean }} [opts]
 * @returns {Promise<'ok' | 'restored' | 'reloading' | 'blocked'>}
 */
export async function ensureAccountDataOwner(session, { explicitLogin = false, onRestored, isCurrent } = {}) {
  if (typeof localStorage === 'undefined') return 'ok';
  if (!session?.active) return 'ok';

  // Depois de login/redirect, este documento pode estar retomando o lease da
  // própria aba. Decidir o owner antes do probe deixaria a biblioteca vazia.
  if (isAccountWriteLockProbePending()) await waitForAccountWriteLockProbe();

  const next = normalizeDataOwnerId(session.email, session.customerId);
  if (!next) return 'ok';

  const prev = readDataOwner();
  // A aba que iniciou com A não pode gravar a biblioteca de B depois de a
  // outra aba trocar a conta e de o cadeado temporário expirar.
  bindAccountDataWriteOwner(prev);
  if (!isAccountDataWriteOwnerCurrent()) return 'blocked';

  const aliases = [...dataOwnerAliases(session.email, session.customerId)];
  const ownerUnchanged = (expected) => readDataOwner() === expected
    && (typeof isCurrent !== 'function' || isCurrent());
  const block = () => { lockAccountDataWrites(); return 'blocked'; };
  const resumeFromVault = async () => {
    const restored = await restoreForBoot(next, aliases, onRestored, isCurrent);
    if (restored === 'blocked') return block();
    if (restored !== true) return null;
    if (!ownerUnchanged(next)) return block();
    if (typeof onRestored === 'function') {
      unlockAccountDataWrites();
      return 'restored';
    }
    reloadAccountSwitch();
    return 'reloading';
  };
  if (!ownerUnchanged(prev)) return block();

  if (!prev) {
    if (explicitLogin) {
      // Login fresco: estados React/BYOK órfãos podem ser de outra pessoa.
      // O cofre desta conta só entra depois de desmontar este contexto.
      lockAccountDataWrites();
      await clearAccountLocalData();
      if (!ownerUnchanged(null)) return block();
      writeDataOwner(next, aliases);
      if (!ownerUnchanged(next)) return block();
      reloadAccountSwitch();
      return 'reloading';
    }
    // Boot silencioso: reclamar biblioteca actual; se vazia, restaurar cofre.
    writeDataOwner(next, aliases);
    if (!ownerUnchanged(next)) return block();
    if (!libraryLooksOccupied()) {
      const restored = await resumeFromVault();
      if (restored) return restored;
    }
    return ownerUnchanged(next) ? 'ok' : block();
  }

  if (isSameDataOwner(prev, next, session)) {
    if (prev === next) writeDataOwner(next, aliases);
    if (prev !== next) {
      // Migrar id:cus → email: e mover snapshot se existir.
      await snapshotAccountVault(prev);
      if (!ownerUnchanged(prev)) return block();
      writeDataOwner(next, aliases);
      if (!ownerUnchanged(next)) return block();
      await snapshotAccountVault(next);
      if (!ownerUnchanged(next)) return block();
    }
    if (!libraryLooksOccupied()) {
      const restored = await resumeFromVault();
      if (restored) return restored;
    }
    return ownerUnchanged(next) ? 'ok' : block();
  }

  // Conta diferente: guardar A e desmontar TODOS os estados da sessão anterior,
  // incluindo chaves de IA/BYOK. B restaura seu cofre no próximo boot limpo.
  const hasLocalProjects = libraryLooksOccupied();
  lockAccountDataWrites();
  const preserved = await snapshotAccountVault(prev);
  if (!ownerUnchanged(prev)) return block();
  if (hasLocalProjects && !preserved) return 'blocked';
  await clearAccountLocalData();
  if (!ownerUnchanged(null)) return block();
  writeDataOwner(next, aliases);
  if (!ownerUnchanged(next)) return block();
  reloadAccountSwitch();
  return 'reloading';
}
