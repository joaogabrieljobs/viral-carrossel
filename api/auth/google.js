import { getAppUrl } from '../lib/stripe.js';
import {
  googleAuthConfigured,
  createOAuthState,
  setOAuthStateCookie,
  buildGoogleAuthUrl,
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

  const state = createOAuthState();
  setOAuthStateCookie(res, state);
  return res.redirect(302, buildGoogleAuthUrl(req, state));
}
