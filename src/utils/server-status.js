// Detecta se está rodando localmente (Vite dev) — nesse caso o health-check bate
// no proxy local (/api/status) em vez de assumir que as chaves já estão configuradas.
const IS_LOCAL_DEV =
  typeof window !== 'undefined' &&
  /^(localhost|127\.|0\.0|192\.168|10\.|\[::1\])/.test(window.location.hostname);

// Cache do health-check do servidor (quais providers tem chave configurada).
// Módulo singleton — todos os call sites que importam getServerStatus compartilham o mesmo cache.
let _serverStatusPromise = null;
export const getServerStatus = ({ force = false } = {}) => {
  if (!IS_LOCAL_DEV) return Promise.resolve({ anthropic: true, openai: true, dev: false });
  if (force) _serverStatusPromise = null;
  if (_serverStatusPromise) return _serverStatusPromise;
  _serverStatusPromise = fetch('/api/status').then(r => r.json()).catch(() => ({ anthropic: false, openai: false, dev: true }));
  return _serverStatusPromise;
};
