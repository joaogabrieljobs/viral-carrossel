/** Resposta de limite compatível com os contratos OAuth 2.0/DCR. */
export function oauthRateLimitResponse(res, limited) {
  const retryAfterSec = Number(limited?.retryAfterSec);
  const unavailable = limited?.unavailable === true
    || !Number.isFinite(retryAfterSec) || retryAfterSec <= 0;
  if (!unavailable) res.setHeader('Retry-After', String(retryAfterSec));
  return res.status(unavailable ? 503 : 429).json({
    error: 'temporarily_unavailable',
    error_description: unavailable
      ? 'Proteção contra excesso de pedidos temporariamente indisponível. Tente novamente em instantes.'
      : 'Demasiados pedidos. Aguarde um momento e tente de novo.',
  });
}
