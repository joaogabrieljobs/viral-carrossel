import { describe, expect, it, vi } from 'vitest';

const stripe = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../../api/lib/stripe.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getStripe: () => ({ subscriptions: { list: stripe.list } }),
}));

import { countActiveSubscriptionsByTier } from '../../api/admin.js';

function asyncList(items) {
  return { async* [Symbol.asyncIterator]() { yield* items; } };
}

// MOO-39: o contador do console usava resolveTierFromSubscription, que cai em
// Essencial quando o preço não está mapeado. Isso inflava o Essencial.
describe('contador de assinaturas do console admin', () => {
  it('conta preço desconhecido como "desconhecido", não como Essencial', async () => {
    stripe.list.mockImplementation(({ status }) => asyncList(status === 'active' ? [
      { status: 'active', metadata: { product: 'viral-carrossel' }, items: { data: [{ price: { id: 'price_test_fake' } }] } },
      { status: 'active', metadata: { product: 'viral-carrossel' }, items: { data: [{ price: { id: 'price_sem_mapa' } }] } },
      { status: 'active', metadata: { product: 'viral-carrossel', tier: 'max' }, items: { data: [{ price: { id: 'price_outro' } }] } },
    ] : []));
    const result = await countActiveSubscriptionsByTier();
    expect(result).toEqual({ total: 3, byTier: { creator: 1, desconhecido: 1, max: 1 } });
  });
});
