/**
 * Isola dados locais (biblioteca, marcas) por conta autenticada.
 * Cada conta tem um slot no cofre (`account-vault`) — logout limpa as chaves
 * activas mas a mesma conta recupera os projetos ao reentrar neste browser.
 */
import { clearAccountLocalData } from './clear-account-data.js';
import { SK, lockAccountDataWrites, unlockAccountDataWrites } from './storage.js';
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

export function writeDataOwner(ownerId) {
  if (!ownerId) return;
  try {
    localStorage.setItem(DATA_OWNER_KEY, JSON.stringify(ownerId));
  } catch { /* quota / privado */ }
}

function reloadAccountSwitch() {
  const loc = typeof globalThis !== 'undefined' ? globalThis.location : null;
  try {
    const href = loc?.href || 'https://viralcarrossel.com.br/';
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
 * @returns {Promise<'ok' | 'reloading'>}
 */
export async function ensureAccountDataOwner(session, { explicitLogin = false } = {}) {
  if (typeof localStorage === 'undefined') return 'ok';
  if (!session?.active) return 'ok';

  const next = normalizeDataOwnerId(session.email, session.customerId);
  if (!next) return 'ok';

  const prev = readDataOwner();

  if (!prev) {
    if (explicitLogin) {
      // Login fresco: limpar activo órfão (outra pessoa) e restaurar o cofre desta conta.
      lockAccountDataWrites();
      await clearAccountLocalData({ wipeMedia: false });
      unlockAccountDataWrites();
      writeDataOwner(next);
      restoreAccountVault(next);
      reloadAccountSwitch();
      return 'reloading';
    }
    // Boot silencioso: reclamar biblioteca actual; se vazia, tentar cofre.
    writeDataOwner(next);
    if (!libraryLooksOccupied()) restoreAccountVault(next);
    return 'ok';
  }

  if (isSameDataOwner(prev, next, session)) {
    if (prev !== next) {
      // Migrar id:cus → email: e mover snapshot se existir.
      snapshotAccountVault(prev);
      writeDataOwner(next);
      snapshotAccountVault(next);
    }
    // Biblioteca vazia mas cofre tem dados (logout anterior) → restaurar.
    if (!libraryLooksOccupied()) {
      restoreAccountVault(next);
    }
    return 'ok';
  }

  // Conta diferente: guardar A, limpar activo, restaurar B.
  lockAccountDataWrites();
  snapshotAccountVault(prev);
  await clearAccountLocalData({ wipeMedia: false });
  unlockAccountDataWrites();
  writeDataOwner(next);
  restoreAccountVault(next);
  reloadAccountSwitch();
  return 'reloading';
}
