// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import { SK } from './storage.js';
import { uid } from './doc-schema.js';

/** Landing de introdução: entrada padrão do site até o utilizador clicar Entrar. */
/**
 * Decisão pura (testável): a landing entra ou não?
 *
 * `main.jsx` usa isto para escolher o bundle: landing-only (`LandingFirst`) ou o
 * studio completo. Qualquer URL de RETORNO de um fluxo externo tem de carregar o
 * studio, porque é lá que vive o tratamento desses params (`useAccess`): limpar a
 * query e abrir paywall/login. Antes só `billing=restored|success` e
 * `login=google|password` saltavam a landing, então quem cancelava o checkout e
 * voltava em `?billing=cancel` caía na landing — sem paywall e com o param preso
 * na URL, porque `useAccess` nunca chegava a montar.
 *
 * @param {string} search  query string (com ou sem '?')
 * @param {boolean} dismissed  landing já dispensada nesta aba
 */
function landingGateDecision(search, dismissed) {
  const q = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  if (q.get('app') === '1' || q.get('studio') === '1') return false;
  // Retorno de checkout (success/cancel/restored) ou de login (qualquer estado,
  // incluindo no_subscription e denied): o studio trata e mostra o que falta.
  if (q.has('billing') || q.has('login')) return false;
  if (q.get('landing') === '1' || q.get('intro') === '1' || q.get('welcome') === '1') return true;
  return !dismissed;
}

function shouldShowOnboardingLanding() {
  if (typeof window === 'undefined') return false;
  try {
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(SK.landingDismissed) === '1'; } catch { dismissed = false; }
    return landingGateDecision(window.location.search, dismissed);
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
  landingGateDecision,
  shouldShowOnboardingLanding,
  dismissOnboardingLanding,
  mkLibEntry,
};
