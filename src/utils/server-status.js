// Detecta se está rodando localmente (Vite dev) — nesse caso o health-check bate
// no proxy local (/api/status) em vez de assumir que as chaves já estão configuradas.
const IS_LOCAL_DEV =
  typeof window !== 'undefined' &&
  /^(localhost|127\.|0\.0|192\.168|10\.|\[::1\])/.test(window.location.hostname);

// Cache do health-check do servidor (quais providers tem chave configurada).
// Módulo singleton — todos os call sites que importam getServerStatus compartilham o mesmo cache.
let _serverStatusPromise = null;
export const getServerStatus = ({ force = false } = {}) => {
  if (force) _serverStatusPromise = null;
  if (_serverStatusPromise) return _serverStatusPromise;
  // Dev e produção têm /api/status (vite.config.js bypass e api/status.js).
  // Em produção, falha de rede assume providers disponíveis (otimista) pra não
  // bloquear quem usa chave própria (BYOK) — o erro real aparece na chamada.
  _serverStatusPromise = fetch('/api/status')
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
    .catch(() =>
      IS_LOCAL_DEV
        ? { anthropic: false, openai: false, dev: true }
        : { anthropic: true, openai: true, dev: false },
    );
  return _serverStatusPromise;
};
