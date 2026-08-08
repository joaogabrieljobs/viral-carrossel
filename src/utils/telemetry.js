// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
// Plausible (carregado via index.html). Helper que é no-op se ad blocker bloquear
// ou se window.plausible não estiver disponível (dev local, etc.).
function trackEvent(name, props) {
  try {
    if (typeof window === 'undefined') return;
    if (typeof window.plausible !== 'function') return;
    window.plausible(name, props ? { props } : undefined);
  } catch { /* never break app por causa de analytics */ }
}

// Persistência leve em localStorage com fallback seguro
const lsGet = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
};

export {
  trackEvent,
  lsGet,
};
