import { getAppUrl, getStripe, findActiveSubscription } from '../../lib/stripe.js';
import {
  createAccessToken,
  setAccessCookie,
} from '../../lib/access.js';
import {
  googleAuthConfigured,
  readOAuthStateCookie,
  clearOAuthStateCookie,
  exchangeGoogleCode,
} from '../../lib/google-auth.js';

/**
 * GET /api/auth/google/callback — troca code, restaura cookie se assinatura ativa.
 */
export default async function handler(req, res) {
  const appUrl = getAppUrl(req);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url || '', appUrl);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  clearOAuthStateCookie(res);

  if (oauthError) {
    return res.redirect(302, `${appUrl}/?login=denied`);
  }

  if (!googleAuthConfigured()) {
    return res.redirect(302, `${appUrl}/?login=google_unconfigured`);
  }

  const expected = readOAuthStateCookie(req);
  if (!code || !state || !expected || state !== expected) {
    return res.redirect(302, `${appUrl}/?login=invalid_state`);
  }

  try {
    const profile = await exchangeGoogleCode(req, code);
    const stripe = getStripe();
    const existing = await stripe.customers.list({ email: profile.email, limit: 5 });
    const customer = existing.data.find((c) => !c.deleted) || existing.data[0];

    if (!customer) {
      return res.redirect(
        302,
        `${appUrl}/?login=no_subscription&email=${encodeURIComponent(profile.email)}`,
      );
    }

    const sub = await findActiveSubscription(customer.id);
    if (!sub) {
      return res.redirect(
        302,
        `${appUrl}/?login=no_subscription&email=${encodeURIComponent(profile.email)}`,
      );
    }

    const token = createAccessToken({
      customerId: customer.id,
      email: profile.email,
    });
    setAccessCookie(res, token);

    return res.redirect(302, `${appUrl}/?billing=restored&login=google`);
  } catch (e) {
    console.error('[auth/google/callback]', e?.message || e);
    return res.redirect(302, `${appUrl}/?login=error`);
  }
}
