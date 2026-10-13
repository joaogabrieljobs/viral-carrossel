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

const EXTRA_KEYS = [USER_PROFILE_KEY, CUSTOM_VISUAL_PRESETS_KEY];
/** Convite ?share= e cofre por conta sobrevivem à limpeza das chaves activas. */
const PRESERVE_KEYS = new Set([PENDING_SHARE_KEY, ACCOUNT_VAULT_KEY]);

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
 * Best-effort: nunca lança. Chamar antes de redirecionar no logout.
 * @param {{ timeoutMs?: number, wipeMedia?: boolean }} [opts]
 *   wipeMedia: apaga IndexedDB de imagens/vídeos. Default false — os bytes
 *   ficam referenciados pelo cofre da conta ao reentrar. true só se quiser
 *   limpeza forense / troca de computador partilhado agressiva.
 */
export async function clearAccountLocalData({ timeoutMs = 3_000, wipeMedia = false } = {}) {
  // Trava ANTES de apagar — pagehide/beforeunload não podem repor a biblioteca.
  try { lockAccountDataWrites(); } catch { /* */ }
  try { removeKnownKeys(typeof localStorage !== 'undefined' ? localStorage : null); } catch { /* */ }
  try { removeKnownKeys(typeof sessionStorage !== 'undefined' ? sessionStorage : null); } catch { /* */ }
  try { setVideoUrlMap({}); } catch { /* */ }

  if (wipeMedia) {
    const wipe = Promise.all([
      imageWipeDatabase().catch(() => {}),
      videoWipeDatabase().catch(() => {}),
    ]);
    await Promise.race([
      wipe,
      new Promise((r) => setTimeout(r, Math.max(500, Number(timeoutMs) || 3_000))),
    ]);
  }

  // Segunda passagem: se algum flush correu em paralelo antes do lock.
  try { removeKnownKeys(typeof localStorage !== 'undefined' ? localStorage : null); } catch { /* */ }
}
