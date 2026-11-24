/**
 * Limpa dados activos da conta no logout (FE-001/002/003).
 * O cofre `vc_account_vault` (por email) é preservado para a mesma conta
 * recuperar projetos ao voltar a entrar neste browser.
 */
import { SK, lockAccountDataWrites } from './storage.js';
import { USER_PROFILE_KEY } from './user-profile.js';
import { CUSTOM_VISUAL_PRESETS_KEY } from './custom-visual-presets.js';
import { imageWipeDatabase } from './image-store.js';
import { videoWipeDatabase, setVideoUrlMap } from './video-store.js';
import { PENDING_SHARE_KEY } from './project-share.js';
import { ACCOUNT_VAULT_KEY } from './account-vault.js';
import { wipeDurableVaultDatabase } from './account-vault-store.js';

const EXTRA_KEYS = [USER_PROFILE_KEY, CUSTOM_VISUAL_PRESETS_KEY];
/**
 * Convite ?share= e cofre sobrevivem à limpeza.
 * Meta de sync NÃO fica órfã sem biblioteca (causava pull/push errado).
 * Tour/modesIntro e meta vão no cofre por owner.
 */
/** MOO-21: qual cliente Stripe ocupa o slot local de cada e-mail. Sobrevive à troca de conta. */
export const OWNER_EMAIL_BINDINGS_KEY = 'vc_owner_email_bindings';

const PRESERVE_KEYS = new Set([
  OWNER_EMAIL_BINDINGS_KEY,
  PENDING_SHARE_KEY,
  ACCOUNT_VAULT_KEY,
  'vc_account_write_lock',
  'vc_account_write_lock_token',
]);

/**
 * DB-12: donos cuja fila de projetos ainda falta apagar depois de um "sair e
 * apagar deste aparelho" que não confirmou. Fica só nesta aba e some na
 * tentativa que der certo. Como começa por `vc_`, conta como resto de conta e
 * mantém a limpeza pendente até a fila sair.
 */
export const OUTBOX_WIPE_OWNERS_KEY = 'vc_outbox_wipe_owners';

function storedOwnerIds(store, key) {
  try {
    const raw = store?.getItem(key);
    if (!raw) return [];
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = raw; }
    return (Array.isArray(parsed) ? parsed : [parsed]).filter((id) => typeof id === 'string' && id);
  } catch { return []; }
}

/** Lido ANTES de as chaves da conta saírem: depois não há como saber de quem era a fila. */
function outboxOwnersToWipe() {
  const local = typeof localStorage !== 'undefined' ? localStorage : null;
  const session = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  // Mesma regra das imagens: a cópia da aba só vale quando a do navegador falta.
  const localAliases = storedOwnerIds(local, SK.dataOwnerAliases);
  return [...new Set([
    ...storedOwnerIds(local, SK.dataOwner),
    ...(localAliases.length ? localAliases : storedOwnerIds(session, SK.dataOwnerAliases)),
    ...storedOwnerIds(session, OUTBOX_WIPE_OWNERS_KEY),
  ])];
}

async function wipeOutboxForOwners(owners) {
  if (!owners.length || typeof indexedDB === 'undefined') return;
  // Import sob demanda: a fila importa o dono da conta, que importa este módulo.
  const { wipeProjectOutboxForOwners } = await import('./projects-outbox.js');
  await wipeProjectOutboxForOwners(owners);
}

function removeKnownKeys(store) {
  if (!store) return;
  const known = new Set([...Object.values(SK), ...EXTRA_KEYS]);
  for (const key of known) {
    if (PRESERVE_KEYS.has(key)) continue;
    try { store.removeItem(key); } catch { /* privado / bloqueado */ }
  }
  // Varredura: qualquer vc_* residual — excepto preservados.
  try {
    const leftovers = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && key.startsWith('vc_') && !PRESERVE_KEYS.has(key)) leftovers.push(key);
    }
    leftovers.forEach((key) => {
      try { store.removeItem(key); } catch { /* */ }
    });
  } catch { /* */ }
}

/**
 * A limpeza normal é best-effort. A opção destrutiva lança se algum banco não
 * confirmar a exclusão, para a interface nunca afirmar que o aparelho foi limpo.
 * @param {{ timeoutMs?: number, wipeMedia?: boolean }} [opts]
 *   wipeMedia: limpeza explícita de TODAS as contas deste browser. No logout e
 *   na troca de conta fica false: o cofre usa IDs que apontam para estes blobs.
 *   Quando true, apaga também o cofre de todas as contas deste aparelho e a
 *   fila de projetos da conta que pediu (a de outras contas fica: DB-12).
 *   A leitura e a limpeza de órfãos são isoladas por owner nos stores.
 */
export async function clearAccountLocalData({ timeoutMs = 3_000, wipeMedia = false } = {}) {
  // Trava ANTES de apagar — pagehide/beforeunload não podem repor a biblioteca.
  try { lockAccountDataWrites(); } catch { /* */ }
  // Só a fila de quem pediu para apagar o aparelho. A de outra conta fica.
  const outboxOwners = wipeMedia ? outboxOwnersToWipe() : [];
  let outboxWiped = false;
  try { removeKnownKeys(typeof localStorage !== 'undefined' ? localStorage : null); } catch { /* */ }
  try { removeKnownKeys(typeof sessionStorage !== 'undefined' ? sessionStorage : null); } catch { /* */ }
  try { setVideoUrlMap({}); } catch { /* */ }

  let wipeError = null;
  if (wipeMedia) {
    // O cofre legado é preservado na limpeza normal, mas a opção destrutiva
    // precisa remover tanto a cópia pequena quanto a transação durável.
    try { localStorage.removeItem(ACCOUNT_VAULT_KEY); } catch { /* */ }
    try { localStorage.removeItem(OWNER_EMAIL_BINDINGS_KEY); } catch { /* */ }
    const wipe = Promise.all([
      imageWipeDatabase({ strict: true }),
      videoWipeDatabase({ strict: true }),
      wipeDurableVaultDatabase(),
      wipeOutboxForOwners(outboxOwners).then(() => { outboxWiped = true; }),
    ]);
    try {
      await Promise.race([
        wipe,
        new Promise((_, reject) => setTimeout(
          () => reject(new Error('A limpeza dos dados deste aparelho não foi confirmada. Feche outras abas do Moont e tente novamente.')),
          Math.max(500, Number(timeoutMs) || 3_000),
        )),
      ]);
    } catch (error) {
      wipeError = error instanceof Error ? error : new Error('Não foi possível apagar os dados deste aparelho.');
    }
  }

  // Segunda passagem: se algum flush correu em paralelo antes do lock.
  try { removeKnownKeys(typeof localStorage !== 'undefined' ? localStorage : null); } catch { /* */ }
  if (wipeMedia) {
    try { localStorage.removeItem(ACCOUNT_VAULT_KEY); } catch { /* */ }
    try { localStorage.removeItem(OWNER_EMAIL_BINDINGS_KEY); } catch { /* */ }
    // Fila ainda no aparelho: anota de quem é, para a nova tentativa apagar.
    try {
      if (outboxWiped || !outboxOwners.length) sessionStorage.removeItem(OUTBOX_WIPE_OWNERS_KEY);
      else sessionStorage.setItem(OUTBOX_WIPE_OWNERS_KEY, JSON.stringify(outboxOwners));
    } catch { /* privado / bloqueado */ }
  }
  if (wipeError) throw wipeError;
}
