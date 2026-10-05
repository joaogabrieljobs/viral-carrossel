/**
 * Limpa dados locais da conta no logout (FE-001/002/003).
 * Cookie `vc_access` já morre no servidor; sem isto o próximo utilizador
 * no mesmo browser herda biblioteca, marcas, BYOK e IndexedDB.
 */
import { SK } from './storage.js';
import { USER_PROFILE_KEY } from './user-profile.js';
import { CUSTOM_VISUAL_PRESETS_KEY } from './custom-visual-presets.js';
import { imageWipeDatabase } from './image-store.js';
import { videoWipeDatabase, setVideoUrlMap } from './video-store.js';

const EXTRA_KEYS = [USER_PROFILE_KEY, CUSTOM_VISUAL_PRESETS_KEY];

function removeKnownKeys(store) {
  if (!store) return;
  const known = new Set([...Object.values(SK), ...EXTRA_KEYS]);
  for (const key of known) {
    try { store.removeItem(key); } catch { /* privado / bloqueado */ }
  }
  // Varredura: qualquer vc_* residual (legado ou chave nova esquecida em SK).
  try {
    const leftovers = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && key.startsWith('vc_')) leftovers.push(key);
    }
    leftovers.forEach((key) => {
      try { store.removeItem(key); } catch { /* */ }
    });
  } catch { /* */ }
}

/**
 * Best-effort: nunca lança. Chamar antes de redirecionar no logout.
 */
export async function clearAccountLocalData() {
  try { removeKnownKeys(typeof localStorage !== 'undefined' ? localStorage : null); } catch { /* */ }
  try { removeKnownKeys(typeof sessionStorage !== 'undefined' ? sessionStorage : null); } catch { /* */ }
  try { setVideoUrlMap({}); } catch { /* */ }
  await Promise.all([
    imageWipeDatabase().catch(() => {}),
    videoWipeDatabase().catch(() => {}),
  ]);
}
