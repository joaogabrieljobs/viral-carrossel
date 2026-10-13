/**
 * Isola dados locais (biblioteca, marcas, IndexedDB) por conta autenticada.
 * Sem isto, login B no mesmo browser via cookie herda os projetos de A —
 * o logout limpa, mas trocar de conta pelo Google/password não limpava.
 */
import { clearAccountLocalData } from './clear-account-data.js';
import { SK } from './storage.js';

export const DATA_OWNER_KEY = SK.dataOwner;

export function normalizeDataOwnerId(email, customerId) {
  const id = String(customerId || '').trim();
  if (id) return `id:${id}`;
  const emailN = String(email || '').trim().toLowerCase();
  if (emailN) return `email:${emailN}`;
  return null;
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

function localLibraryLooksOccupied() {
  try {
    const raw = localStorage.getItem(SK.library);
    if (!raw) return false;
    const lib = JSON.parse(raw);
    return Array.isArray(lib) && lib.length > 0;
  } catch {
    return false;
  }
}

/**
 * @param {object} session — resultado de /api/auth/session
 * @param {{ explicitLogin?: boolean }} [opts]
 *   explicitLogin: veio de ?login=google|password ou billing=restored
 * @returns {Promise<'ok' | 'reloading'>}
 */
export async function ensureAccountDataOwner(session, { explicitLogin = false } = {}) {
  if (typeof localStorage === 'undefined') return 'ok';
  if (!session?.active) return 'ok';

  const next = normalizeDataOwnerId(session.email, session.customerId);
  if (!next) return 'ok';

  const prev = readDataOwner();

  if (prev === next) return 'ok';

  // Conta diferente da que “possui” os dados locais → limpar sempre.
  const switchedAccount = !!(prev && prev !== next);

  // Login explícito sem dono gravado: os dados podem ser de outra pessoa
  // (bug clássico ao mudar de Google no mesmo Chrome). Isolar por defeito.
  const claimAfterBareLogin = explicitLogin && !prev && localLibraryLooksOccupied();

  if (switchedAccount || claimAfterBareLogin) {
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

  // Migração / 1.ª visita com cookie: reclamar sem apagar.
  writeDataOwner(next);
  return 'ok';
}
