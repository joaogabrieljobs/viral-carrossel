-- Trilha idempotente dos webhooks Stripe. Não guarda o payload completo para
-- evitar duplicar dados pessoais que já pertencem ao Stripe.
BEGIN;

CREATE TABLE IF NOT EXISTS moont.billing_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  livemode boolean NOT NULL,
  object_id text,
  customer_id text,
  object_status text,
  stripe_created_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_events_id_shape CHECK (event_id ~ '^evt_[A-Za-z0-9_]+$'),
  CONSTRAINT billing_events_type_length CHECK (length(event_type) BETWEEN 1 AND 160),
  CONSTRAINT billing_events_object_id_length CHECK (object_id IS NULL OR length(object_id) <= 255),
  CONSTRAINT billing_events_customer_id_length CHECK (customer_id IS NULL OR length(customer_id) <= 255),
  CONSTRAINT billing_events_status_length CHECK (object_status IS NULL OR length(object_status) <= 80)
);

CREATE INDEX IF NOT EXISTS billing_events_type_received_idx
  ON moont.billing_events (event_type, received_at DESC);

ALTER TABLE moont.billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON moont.billing_events FROM PUBLIC;

COMMIT;
