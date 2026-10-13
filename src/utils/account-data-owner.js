/**
 * Isola dados locais (biblioteca, marcas, IndexedDB) por conta autenticada.
 * Sem isto, login B no mesmo browser via cookie herda os projetos de A —
 * o logout limpa, mas trocar de conta pelo Google/password não limpava.
 */
import { clearAccountLocalData } from './clear-account-data.js';
import { SK, lockAccountDataWrites } from './storage.js';

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

/**
 * @param {object} session — resultado de /api/auth/session
 * @param {{ explicitLogin?: boolean }} [opts] — reservado; wipe só em troca real de conta
 * @returns {Promise<'ok' | 'reloading'>}
 */
export async function ensureAccountDataOwner(session, { explicitLogin = false } = {}) {
  if (typeof localStorage === 'undefined') return 'ok';
  if (!session?.active) return 'ok';

  const next = normalizeDataOwnerId(session.email, session.customerId);
  if (!next) return 'ok';

  const prev = readDataOwner();

  if (!prev) {
    // Login explícito + biblioteca órfã (logout limpou o dono mas o pagehide
    // reporia projetos): limpar. Soft-migração só em boot silencioso.
    if (explicitLogin && libraryLooksOccupied()) {
      lockAccountDataWrites();
      await clearAccountLocalData();
      writeDataOwner(next);
      const loc = typeof globalThis !== 'undefined' ? globalThis.location : null;
      try {
        const url = new URL(loc?.href || 'https://viralcarrossel.com.br/');
        url.searchParams.delete('login');
        url.searchParams.delete('email');
        url.searchParams.set('app', '1');
        url.searchParams.set('account_switch', '1');
        loc?.replace?.(url.pathname + url.search + url.hash);
      } catch {
        loc?.replace?.('/?app=1&account_switch=1');
      }
      return 'reloading';
    }
    writeDataOwner(next);
    return 'ok';
  }

  if (isSameDataOwner(prev, next, session)) {
    // Migrar id:cus → email: se o formato preferido mudou.
    if (prev !== next) writeDataOwner(next);
    return 'ok';
  }

  // Conta diferente da que possui os dados locais → limpar.
  lockAccountDataWrites();
  await clearAccountLocalData();
  writeDataOwner(next);
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
  return 'reloading';
}
