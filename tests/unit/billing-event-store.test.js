import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({ unsafe: vi.fn(), connection: vi.fn() }));
vi.mock('../../api/lib/postgres-connection.js', () => ({ getPostgresConnection: database.connection }));

import { recordBillingEvent } from '../../api/lib/billing-event-store.js';

const event = {
  id: 'evt_trace_123',
  type: 'checkout.session.completed',
  livemode: true,
  created: 1_700_000_000,
  data: { object: { id: 'cs_123', customer: 'cus_123', status: 'complete', customer_email: 'pii@example.test' } },
};

beforeEach(() => {
  database.unsafe.mockReset().mockResolvedValue([{ event_id: event.id }]);
  database.connection.mockReset().mockReturnValue({ unsafe: database.unsafe });
});

describe('billing event store', () => {
  it('usa event.id como chave idempotente e não persiste o payload', async () => {
    await expect(recordBillingEvent(event)).resolves.toEqual({ eventId: event.id, inserted: true });
    const [sql, params] = database.unsafe.mock.calls[0];
    expect(sql).toContain('ON CONFLICT (event_id) DO NOTHING');
    expect(params).toEqual([
      'evt_trace_123', 'checkout.session.completed', true,
      'cs_123', 'cus_123', 'complete', new Date(1_700_000_000_000).toISOString(),
    ]);
    expect(JSON.stringify(params)).not.toContain('pii@example.test');
  });

  it('reentrega retorna inserted false quando a PK já existe', async () => {
    database.unsafe.mockResolvedValue([]);
    await expect(recordBillingEvent(event)).resolves.toEqual({ eventId: event.id, inserted: false });
  });

  it.each([
    { ...event, id: 'not-an-event' },
    { ...event, type: 'tipo com espaço' },
  ])('recusa evento sem identificadores Stripe válidos', async (invalid) => {
    await expect(recordBillingEvent(invalid)).rejects.toMatchObject({ code: 'billing_event_invalid' });
    expect(database.unsafe).not.toHaveBeenCalled();
  });
});
