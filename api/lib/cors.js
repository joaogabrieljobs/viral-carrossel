// Allowlist única de origins para todos os endpoints /api.
// Nunca refletir Origin arbitrário: endpoints carregam cookie de acesso
// (billing/auth) ou chave de API do host (proxies IA).
export function allowedOrigins() {
  const origins = [
    (process.env.APP_URL || process.env.VITE_APP_URL || '').replace(/\/$/, ''),
    'https://moont.ai',
    'https://www.moont.ai',
    'https://moont.com.br',
    'https://www.moont.com.br',
    // Enquanto o acesso aos dados locais ainda depende do domínio anterior.
    'https://viralcarrossel.com.br',
    'https://www.viralcarrossel.com.br',
  ];
  // Localhost só fora de produção (auditoria BE-CORS-LOCAL).
  const vercelEnv = process.env.VERCEL_ENV || '';
  if (vercelEnv !== 'production') {
    origins.push('http://localhost:5173', 'http://localhost:4173');
  }
  return new Set(origins.filter(Boolean));
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

/**
 * Recusa POST vindo de outro site (MOO-03). Cookie SameSite=Lax protege o
 * cookie existente, não a gravação de um novo: um <form> de outro site podia
 * logar a vítima na conta do atacante. Formulário não manda JSON nem Origin
 * desta lista; cliente sem navegador (sem Origin) segue normalmente.
 * @returns {boolean} true quando já respondeu 403/415.
 */
export function rejectCrossSiteRequest(req, res, { requireJson = true } = {}) {
  if (req.method !== 'POST') return false;
  const origin = req.headers?.origin;
  if ((origin && !allowedOrigins().has(origin)) || req.headers?.['sec-fetch-site'] === 'cross-site') {
    res.status(403).json({ error: 'Origem não autorizada.', code: 'origin_denied' });
    return true;
  }
  // Formulário de navegador sempre declara Content-Type (form, multipart ou
  // text/plain); só ele é recusado aqui.
  const contentType = String(req.headers?.['content-type'] || '');
  if (requireJson && contentType && !/^application\/json(?:;|$)/i.test(contentType)) {
    res.status(415).json({ error: 'Envie JSON.', code: 'json_required' });
    return true;
  }
  return false;
}
