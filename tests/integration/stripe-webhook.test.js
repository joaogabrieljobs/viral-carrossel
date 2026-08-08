// Task 04 — RF-09: webhook Stripe (edge runtime, verificação criptográfica REAL).
// Sem mock do SDK aqui de propósito: assina o payload com o secret sintético e
// deixa `constructEventAsync` validar de verdade — cobre o caminho de segurança.
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import webhookHandler from '../../api/stripe/webhook.js';

const SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function signStripe(payload, { secret = SECRET, timestamp = Math.floor(Date.now() / 1000) } = {}) {
  const sig = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

const eventBody = (type = 'checkout.session.completed') =>
  JSON.stringify({
    id: 'evt_test_1',
    type,
    data: { object: { id: 'cs_test_1', customer: 'cus_1', status: 'active' } },
  });

const request = (body, headers = {}) =>
  new Request('https://viral-carrossel.vercel.app/api/stripe/webhook', {
    method: 'POST',
    body,
    headers,
  });

describe('POST /api/stripe/webhook (RF-09)', () => {
  it('evento com assinatura válida → 200 {received:true}', async () => {
    const body = eventBody();
    const res = await webhookHandler(request(body, { 'stripe-signature': signStripe(body) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });

  it('assinatura de outro secret → 400', async () => {
    const body = eventBody();
    const res = await webhookHandler(
      request(body, { 'stripe-signature': signStripe(body, { secret: 'whsec_atacante' }) }),
    );
    expect(res.status).toBe(400);
  });

  it('timestamp velho (replay > tolerância) → 400', async () => {
    const body = eventBody();
    const old = Math.floor(Date.now() / 1000) - 3600;
    const res = await webhookHandler(
      request(body, { 'stripe-signature': signStripe(body, { timestamp: old }) }),
    );
    expect(res.status).toBe(400);
  });

  it('sem header stripe-signature → 400', async () => {
    const res = await webhookHandler(request(eventBody()));
    expect(res.status).toBe(400);
  });

  it('GET → 405', async () => {
    const res = await webhookHandler(
      new Request('https://viral-carrossel.vercel.app/api/stripe/webhook', { method: 'GET' }),
    );
    expect(res.status).toBe(405);
  });

  it('evento de subscription deleted também é aceito (200)', async () => {
    const body = eventBody('customer.subscription.deleted');
    const res = await webhookHandler(request(body, { 'stripe-signature': signStripe(body) }));
    expect(res.status).toBe(200);
  });
});
