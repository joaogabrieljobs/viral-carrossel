// Allowlist única de origins para todos os endpoints /api.
// Nunca refletir Origin arbitrário: endpoints carregam cookie de acesso
// (billing/auth) ou chave de API do host (proxies IA).
export function allowedOrigins() {
  return new Set(
    [
      (process.env.APP_URL || process.env.VITE_APP_URL || '').replace(/\/$/, ''),
      'http://localhost:5173',
      'http://localhost:4173',
    ].filter(Boolean),
  );
}

/**
 * Aplica cabeçalhos CORS. Origin fora da allowlist não recebe
 * Access-Control-Allow-Origin — o preflight falha no browser.
 * @param {{ credentials?: boolean, headers?: string }} opts
 */
export function applyCors(req, res, opts = {}) {
  const origin = req.headers?.origin;
  if (origin && allowedOrigins().has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    if (opts.credentials) res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', opts.headers || 'Content-Type');
}
