import crypto from 'crypto';
import { getStripe, findActiveSubscription } from '../../lib/stripe.js';
import { getLibrarySyncMeta } from '../../lib/library-sync-store.js';
import { invalidateActiveAccessForCustomer } from '../../lib/require-access.js';
import {
  createAccessToken,
  setAccessCookie,
  setLoginHintCookie,
  setCheckoutIdentityCookie,
  clearCheckoutIdentityCookie,
} from '../../lib/access.js';
import {
  googleAuthConfigured,
  readOAuthStateCookie,
  clearOAuthStateCookie,
  exchangeGoogleCode,
  getGoogleCanonicalOrigin,
} from '../../lib/google-auth.js';

const normalizedEmail = (value) => String(value || '').trim().toLowerCase();

async function chooseCustomer(customers, googleSub) {
  const linked = customers.filter((customer) => customer.metadata?.vc_google_sub === googleSub);
  if (linked.length > 1) return null;
  if (linked.length === 1) return linked[0];
  // Um vínculo Google diferente não pode ser reclamado só por partilhar e-mail.
  if (customers.some((customer) => customer.metadata?.vc_google_sub)) return null;
  if (customers.length === 1) return customers[0];

  // Projetos antigos definem a conta a preservar. Falha de leitura é ambiguidade,
  // nunca motivo para escolher arbitrariamente outro customer.
  let projectCounts;
  try {
    projectCounts = await Promise.all(customers.map(async (customer) => {
      const meta = await getLibrarySyncMeta(customer.id);
      return Number(meta?.projectCount || 0);
    }));
  } catch {
    return null;
  }
  const withProjects = customers.filter((_, index) => projectCounts[index] > 0);
  if (withProjects.length === 1) return withProjects[0];
  if (withProjects.length > 1) return null;

  const active = [];
  for (const customer of customers) {
    if (await findActiveSubscription(customer.id)) active.push(customer);
  }
  return active.length === 1 ? active[0] : null;
}

/**
 * GET /api/auth/google/callback — troca code, restaura cookie se assinatura ativa.
 */
export default async function handler(req, res) {
  const appUrl = getGoogleCanonicalOrigin();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url || '', appUrl);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  clearOAuthStateCookie(res);
  clearCheckoutIdentityCookie(res);

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
    const customers = [];
    let startingAfter;
    for (let page = 0; page < 10; page += 1) {
      const result = await stripe.customers.list({
        email: profile.email,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      customers.push(...result.data.filter((customer) =>
        !customer.deleted && normalizedEmail(customer.email) === normalizedEmail(profile.email)));
      if (!result.has_more) break;
      startingAfter = result.data.at(-1)?.id;
      if (!startingAfter || page === 9) throw new Error('Muitos clientes para o mesmo e-mail');
    }
    if (!customers.length) {
      setLoginHintCookie(res, profile.email);
      return res.redirect(302, `${appUrl}/?login=no_subscription`);
    }

    let customer = await chooseCustomer(customers, profile.sub);
    if (!customer) return res.redirect(302, `${appUrl}/?login=account_conflict`);

    if (!customer.metadata?.vc_google_sub) {
      const identityEpoch = crypto.randomBytes(16).toString('hex');
      const revokedBefore = Date.now();
      customer = await stripe.customers.update(customer.id, {
        metadata: {
          vc_google_sub: profile.sub,
          vc_identity_epoch: identityEpoch,
          vc_session_revoked_before: String(revokedBefore),
          vc_pw_salt: '',
          vc_pw_hash: '',
        },
      });
      if (!customer || customer.deleted || customer.metadata?.vc_google_sub !== profile.sub
        || customer.metadata?.vc_identity_epoch !== identityEpoch) {
        throw new Error('Não foi possível confirmar o vínculo com a conta Google');
      }
      invalidateActiveAccessForCustomer(customer.id);
    }

    const identityEpoch = customer.metadata?.vc_identity_epoch || '';
    const sub = await findActiveSubscription(customer.id);
    if (sub) {
      const token = createAccessToken({
        customerId: customer.id,
        email: profile.email,
        identityEpoch,
        iatMs: Math.max(Date.now(), Number(customer.metadata?.vc_session_revoked_before || 0) + 1),
      });
      setAccessCookie(res, token);
      return res.redirect(302, `${appUrl}/?billing=restored&login=google`);
    }
    setCheckoutIdentityCookie(res, {
      email: profile.email,
      customerId: customer.id,
      source: 'verified_login',
      identityEpoch,
    });
    setLoginHintCookie(res, profile.email);
    return res.redirect(302, `${appUrl}/?login=no_subscription`);
  } catch (e) {
    console.error('[auth/google/callback]', e?.message || e);
    return res.redirect(302, `${appUrl}/?login=error`);
  }
}
