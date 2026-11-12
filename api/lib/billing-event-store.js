import { getPostgresConnection } from './postgres-connection.js';

function cleanId(value, max = 255) {
  const raw = value && typeof value === 'object' ? value.id : value;
  const id = typeof raw === 'string' ? raw.trim() : '';
  return id && id.length <= max ? id : null;
}

function eventType(value) {
  const type = typeof value === 'string' ? value.trim() : '';
  if (!type || type.length > 160 || !/^[a-z0-9_.]+$/i.test(type)) {
    throw Object.assign(new Error('Tipo de evento Stripe inválido.'), { code: 'billing_event_invalid' });
  }
  return type;
}

function eventId(value) {
  const id = cleanId(value);
  if (!id || !/^evt_[A-Za-z0-9_]+$/.test(id)) {
    throw Object.assign(new Error('ID de evento Stripe inválido.'), { code: 'billing_event_invalid' });
  }
  return id;
}

/**
 * Persiste somente metadados operacionais, sem o payload do Stripe (que pode
 * conter PII). A PK do evento torna reentregas idempotentes.
 */
export async function recordBillingEvent(event) {
  const object = event?.data?.object || {};
  const id = eventId(event?.id);
  const type = eventType(event?.type);
  const stripeCreatedAt = Number.isSafeInteger(event?.created) && event.created > 0
    ? new Date(event.created * 1000).toISOString() : null;
  const rows = await getPostgresConnection().unsafe(
    `INSERT INTO moont.billing_events
       (event_id, event_type, livemode, object_id, customer_id, object_status, stripe_created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [id, type, event?.livemode === true, cleanId(object.id), cleanId(object.customer),
      cleanId(object.status, 80), stripeCreatedAt],
  );
  return { eventId: id, inserted: Boolean(rows[0]) };
}
