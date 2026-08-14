// Task 06 — RF-11 (DEC-004): 5 usuários comprando/entrando AO MESMO TEMPO.
// Mocks respondem em função dos argumentos (por-customer), não valor fixo —
// interleaving real de Promise.all exercita isolamento de sessão.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));

import { makeReq, makeRes, cookieValue } from '../helpers/http.js';
import { verifyAccessToken, COOKIE_NAME } from '../../api/lib/access.js';
import checkoutHandler from '../../api/stripe/checkout.js';
import confirmHandler from '../../api/stripe/confirm.js';
import sessionHandler from '../../api/auth/session.js';

const N = 5;
const users = Array.from({ length: N }, (_, i) => ({
  email: `user${i + 1}@teste.exemplo`,
  customerId: `cus_multi_${i + 1}`,
  sessionId: `cs_multi_${i + 1}`,
}));
const byEmail = Object.fromEntries(users.map((u) => [u.email, u]));
const bySession = Object.fromEntries(users.map((u) => [u.sessionId, u]));
const byCustomer = Object.fromEntries(users.map((u) => [u.customerId, u]));

beforeEach(() => {
  resetStripeMock();
  // Estado Stripe por-usuário, resolvido pelo argumento da chamada.
  // `pagos` simula o ciclo real: assinatura só existe DEPOIS do pagamento
  // (retrieve da Checkout Session) — senão o checkout cai em alreadyActive.
  const pagos = new Set();
  stripeMock.customers.list.mockImplementation(async () => ({ data: [] }));
  stripeMock.customers.create.mockImplementation(async ({ email }) => ({
    id: byEmail[email].customerId,
    email,
  }));
  stripeMock.checkout.sessions.create.mockImplementation(async ({ customer }) => ({
    id: byCustomer[customer].sessionId,
    url: `https://checkout.stripe.com/c/pay/${byCustomer[customer].sessionId}`,
  }));
  stripeMock.checkout.sessions.retrieve.mockImplementation(async (sessionId) => {
    const u = bySession[sessionId];
    pagos.add(u.customerId);
    return {
      mode: 'subscription',
      payment_status: 'paid',
      status: 'complete',
      customer: u.customerId,
      customer_details: { email: u.email },
      subscription: subAtiva(u.customerId),
    };
  });
  stripeMock.subscriptions.list.mockImplementation(async ({ customer }) => ({
    data: pagos.has(customer) ? [subAtiva(customer)] : [],
  }));
});

async function fluxoCompleto(u) {
  // 1. checkout
  const rCheckout = makeRes();
  await checkoutHandler(makeReq({ method: 'POST', body: { email: u.email } }), rCheckout);
  expect(rCheckout.statusCode).toBe(200);
  expect(rCheckout.body.sessionId).toBe(u.sessionId);

  // 2. confirm (volta do Stripe)
  const rConfirm = makeRes();
  await confirmHandler(makeReq({ method: 'POST', body: { sessionId: u.sessionId } }), rConfirm);
  expect(rConfirm.statusCode).toBe(200);
  const token = cookieValue(rConfirm, COOKIE_NAME);

  // 3. session com o cookie recebido
  const rSession = makeRes();
  await sessionHandler(
    makeReq({ cookie: `${COOKIE_NAME}=${encodeURIComponent(token)}` }),
    rSession,
  );
  return { u, token, confirm: rConfirm.body, session: rSession.body };
}

describe(`RF-11 — ${N} usuários simultâneos (3 rodadas)`, () => {
  for (let rodada = 1; rodada <= 3; rodada++) {
    it(`rodada ${rodada}: cada usuário recebe SEU cookie, sessão e e-mail — zero cruzamento`, async () => {
      const results = await Promise.all(users.map(fluxoCompleto));

      for (const { u, token, confirm, session } of results) {
        // cookie decodifica pro próprio usuário
        const payload = verifyAccessToken(token);
        expect(payload.customerId).toBe(u.customerId);
        expect(payload.email).toBe(u.email);
        // respostas consistentes com o próprio usuário
        expect(confirm).toMatchObject({ active: true, email: u.email });
        expect(confirm.customerId).toBeUndefined();
        expect(session).toMatchObject({ active: true, email: u.email });
        expect(session.customerId).toBeUndefined();
      }

      // varredura cruzada N×N: nenhuma resposta contém dado de OUTRO usuário
      for (const { u, confirm, session } of results) {
        const blob = JSON.stringify({ confirm, session });
        for (const other of users) {
          if (other.email === u.email) continue;
          expect(blob).not.toContain(other.email);
          expect(blob).not.toContain(other.customerId);
        }
        expect(blob).not.toContain(u.customerId);
      }
    });
  }
});
