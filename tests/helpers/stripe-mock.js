/** Mock do SDK `stripe` (DEC-002). Uso em cada arquivo de teste:
 *
 *    import { stripeMock, resetStripeMock } from '../helpers/stripe-mock.js';
 *    vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));
 *    beforeEach(resetStripeMock);
 *
 *  `api/lib/stripe.js` faz `new Stripe(key)` uma vez (singleton) — o construtor
 *  devolve sempre este objeto, então configurar os vi.fn() por teste funciona. */
import { vi } from 'vitest';

export const stripeMock = {
  customers: { list: vi.fn(), create: vi.fn() },
  subscriptions: { list: vi.fn() },
  checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
  webhooks: { constructEvent: vi.fn() },
};

export const subAtiva = (customerId) => ({
  id: `sub_${customerId}`,
  status: 'active',
  customer: customerId,
  current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
});

export function resetStripeMock() {
  stripeMock.customers.list.mockReset().mockResolvedValue({ data: [] });
  stripeMock.customers.create.mockReset().mockImplementation(async ({ email }) => ({
    id: `cus_novo_${email.split('@')[0]}`,
    email,
  }));
  stripeMock.subscriptions.list.mockReset().mockResolvedValue({ data: [] });
  stripeMock.checkout.sessions.create.mockReset().mockResolvedValue({
    id: 'cs_test_fake',
    url: 'https://checkout.stripe.com/c/pay/cs_test_fake',
  });
  stripeMock.checkout.sessions.retrieve.mockReset().mockResolvedValue({});
  stripeMock.billingPortal.sessions.create.mockReset().mockResolvedValue({
    url: 'https://billing.stripe.com/p/session_fake',
  });
  stripeMock.webhooks.constructEvent.mockReset();
}
