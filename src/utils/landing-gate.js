// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import { SK } from './storage.js';
import { uid } from './doc-schema.js';

/** Landing de introdução: entrada padrão do site até o utilizador clicar Entrar. */
function shouldShowOnboardingLanding() {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('app') === '1' || q.get('studio') === '1') return false;
    if (q.get('landing') === '1' || q.get('intro') === '1' || q.get('welcome') === '1') return true;
    return sessionStorage.getItem(SK.landingDismissed) !== '1';
  } catch {
    return true;
  }
}

function dismissOnboardingLanding() {
  try {
    sessionStorage.setItem(SK.landingDismissed, '1');
    localStorage.setItem(SK.landingDone, '1');
  } catch { /* */ }
}

// ─── BIBLIOTECA + PERFIS DE MARCA ─────────────────────────────────────────────
// Esquema novo de persistência (lazily migrado a partir do `vc_doc` antigo):
//   vc_library = [{ id, name, status, createdAt, updatedAt, doc }]
//   vc_brands  = [{ id, name, ...brand }]
//   vc_active_doc_id   = string (qual carrossel está sendo editado agora)
//   vc_active_brand_id = string (qual perfil de marca aplicar por padrão em novos carrosséis)
// Cria uma entrada de biblioteca a partir de um doc completo.
const mkLibEntry = (doc, name = 'Sem título') => {
  const now = Date.now();
  return {
    id: uid(),
    name,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    doc,
  };
};

export {
  shouldShowOnboardingLanding,
  dismissOnboardingLanding,
  mkLibEntry,
};
