import { getAppUrl } from '../lib/stripe.js';
import {
  googleAuthConfigured,
  createOAuthState,
  setOAuthStateCookie,
  buildGoogleAuthUrl,
  getGoogleCanonicalOrigin,
} from '../lib/google-auth.js';

/**
 * GET /api/auth/google — inicia OAuth Google (login de quem já assina).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!googleAuthConfigured()) {
    const appUrl = getAppUrl(req);
    return res.redirect(302, `${appUrl}/?login=google_unconfigured`);
  }

  const canonicalOrigin = getGoogleCanonicalOrigin();
  const canonicalUrl = new URL(canonicalOrigin);
  const canonicalHost = canonicalUrl.host.toLowerCase();
  // Host serve só para detectar um domínio alternativo; nunca compõe o destino.
  // O state e o cookie passam a nascer no mesmo domínio do callback Google.
  const defaultPort = canonicalUrl.protocol === 'https:' ? ':443' : ':80';
  const requestHost = String(req.headers?.host || '').trim().toLowerCase()
    .replace(new RegExp(`${defaultPort}$`), '');
  if (requestHost && requestHost !== canonicalHost) {
    return res.redirect(302, `${canonicalOrigin}/api/auth/google`);
  }

  const state = createOAuthState();
  setOAuthStateCookie(res, state);
  return res.redirect(302, buildGoogleAuthUrl(req, state));
}
