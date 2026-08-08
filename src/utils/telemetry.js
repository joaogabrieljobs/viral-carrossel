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
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return fallback; // storage privado/bloqueado — silêncio é correto aqui
  }
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    // Valor corrompido (ou gravado sem JSON.stringify) cai no fallback, mas
    // ANTES isso era silencioso: uma preferência era ignorada e o app parecia
    // simplesmente "não lembrar" da escolha, sem pista nenhuma.
    console.warn(`[lsGet] valor inválido em "${key}" — usando fallback:`, e.message, '| raw:', String(raw).slice(0, 80));
    return fallback;
  }
};

export {
  trackEvent,
  lsGet,
};
