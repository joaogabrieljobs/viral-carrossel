import { getStripe, isSubscriptionActive } from '../lib/stripe.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length) return Buffer.concat(chunks);
  if (req.body && typeof req.body === 'object') {
    return Buffer.from(JSON.stringify(req.body));
  }
  return Buffer.alloc(0);
}

/**
 * POST /api/stripe/webhook
 * Fonte da verdade para eventos (logs + futuro sync).
 * O acesso ao studio valida a assinatura live no Stripe via cookie.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET em falta');
    return res.status(500).json({ error: 'webhook_not_configured' });
  }

  try {
    const stripe = getStripe();
    const rawBody = await readRawBody(req);
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(rawBody, sig, secret);

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

    return res.status(200).json({ received: true });
  } catch (e) {
    console.error('[stripe/webhook]', e.message || e);
    return res.status(400).json({ error: `Webhook Error: ${e.message}` });
  }
}
