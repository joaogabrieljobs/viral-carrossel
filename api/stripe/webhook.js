import Stripe from 'stripe';
import { recordBillingEvent } from '../lib/billing-event-store.js';
import { isSubscriptionActive } from '../lib/stripe.js';

/**
 * O runtime Node permite gravar a trilha no Postgres. O body parser precisa
 * ficar desligado: a assinatura Stripe é calculada sobre os bytes originais.
 */
export const config = {
  api: { bodyParser: false },
};

function isWebRequest(request) {
  return typeof request?.text === 'function' && typeof request?.headers?.get === 'function';
}

async function rawRequestBody(request) {
  if (isWebRequest(request)) return request.text();
  if (typeof request?.body === 'string') return request.body;
  if (Buffer.isBuffer(request?.body)) return request.body.toString('utf8');
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 1_000_000) {
      throw Object.assign(new Error('Webhook grande demais.'), { status: 413 });
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function signatureHeader(request) {
  if (isWebRequest(request)) return request.headers.get('stripe-signature');
  const value = request?.headers?.['stripe-signature'];
  return Array.isArray(value) ? value[0] : value;
}

function send(request, response, body, status = 200) {
  if (isWebRequest(request)) return Response.json(body, { status });
  response.status(status).json(body);
  return undefined;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return send(request, response, { error: 'Method not allowed' }, 405);
  }

  // Stripe falha se o secret tiver newline/espaço (comum ao colar na Vercel).
  const secret = cleanEnv(process.env.STRIPE_WEBHOOK_SECRET);
  const key = cleanEnv(process.env.STRIPE_SECRET_KEY);
  if (!secret || !key) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET ou STRIPE_SECRET_KEY em falta');
    return send(request, response, { error: 'webhook_not_configured' }, 500);
  }
  if (!secret.startsWith('whsec_')) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET não começa com whsec_');
    return send(request, response, { error: 'webhook_secret_invalid' }, 500);
  }

  const signature = signatureHeader(request);
  if (!signature) {
    return send(request, response, { error: 'Missing stripe-signature header' }, 400);
  }

  let event;
  try {
    const stripe = new Stripe(key);
    const rawBody = await rawRequestBody(request);
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (error) {
    console.error('[stripe/webhook] assinatura/body', error.message || error);
    return send(request, response, { error: `Webhook Error: ${error.message}` }, error.status || 400);
  }

  try {
    const trace = await recordBillingEvent(event);
    if (!trace.inserted) {
      console.log('[stripe/webhook] evento já registrado', { id: event.id, type: event.type });
      return send(request, response, { received: true });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('[stripe/webhook] checkout.session.completed', {
          id: session.id,
          customer: session.customer,
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

    return send(request, response, { received: true });
  } catch (error) {
    // 5xx é deliberado: o Stripe deve reenviar quando a trilha estiver
    // indisponível, em vez de perder o evento com um 2xx enganoso.
    console.error('[stripe/webhook] não foi possível registrar o evento', error.message || error);
    return send(request, response, { error: 'billing_event_unavailable' }, 503);
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
