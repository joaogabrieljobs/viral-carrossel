import Stripe from 'stripe';
import { isSubscriptionActive } from '../lib/stripe.js';

/**
 * Edge runtime: `request.text()` devolve o body cru (obrigatório p/ assinatura Stripe).
 * O bodyParser do Node na Vercel re-serializava o JSON e quebrava o webhook (400).
 */
export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Stripe falha se o secret tiver newline/espaço (comum ao colar na Vercel).
  const secret = cleanEnv(process.env.STRIPE_WEBHOOK_SECRET);
  const key = cleanEnv(process.env.STRIPE_SECRET_KEY);
  if (!secret || !key) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET ou STRIPE_SECRET_KEY em falta');
    return Response.json({ error: 'webhook_not_configured' }, { status: 500 });
  }
  if (!secret.startsWith('whsec_')) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET não começa com whsec_');
    return Response.json({ error: 'webhook_secret_invalid' }, { status: 500 });
  }

  try {
    const stripe = new Stripe(key, {
      httpClient: Stripe.createFetchHttpClient(),
    });
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return Response.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      secret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('[stripe/webhook] checkout.session.completed', {
          id: session.id,
          customer: session.customer,
          email: session.customer_details?.email || session.customer_email,
        });
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        console.log(`[stripe/webhook] ${event.type}`, {
          id: sub.id,
          customer: sub.customer,
          status: sub.status,
          active: isSubscriptionActive(sub),
        });
        break;
      }
      default:
        console.log(`[stripe/webhook] ignored ${event.type}`);
    }

    return Response.json({ received: true });
  } catch (e) {
    console.error('[stripe/webhook]', e.message || e);
    return Response.json({ error: `Webhook Error: ${e.message}` }, { status: 400 });
  }
}

/** Remove BOM, aspas e qualquer whitespace (newline ao colar na Vercel). */
function cleanEnv(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, '');
}
