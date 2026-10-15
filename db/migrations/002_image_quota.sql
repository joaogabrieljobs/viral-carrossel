-- Contador e operações de geração de imagem por conta/ciclo de assinatura.
-- Executar após 001_account_library.sql com a credencial privada do servidor.
-- O schema moont não deve ser exposto pelo PostgREST.
BEGIN;

CREATE SCHEMA IF NOT EXISTS moont;
REVOKE ALL ON SCHEMA moont FROM PUBLIC;

CREATE TABLE IF NOT EXISTS moont.image_quota_periods (
  owner_id text NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 255),
  period_start_sec bigint NOT NULL CHECK (period_start_sec > 0),
  period_end_sec bigint CHECK (period_end_sec IS NULL OR period_end_sec > period_start_sec),
  used integer NOT NULL CHECK (used >= 0),
  legacy_used integer NOT NULL CHECK (legacy_used >= 0),
  migrated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, period_start_sec),
  CHECK (used >= legacy_used)
);

CREATE TABLE IF NOT EXISTS moont.image_quota_operations (
  owner_id text NOT NULL,
  period_start_sec bigint NOT NULL,
  operation_id text NOT NULL CHECK (length(operation_id) BETWEEN 1 AND 160),
  status text NOT NULL CHECK (status IN ('reserved', 'consumed', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, period_start_sec, operation_id),
  FOREIGN KEY (owner_id, period_start_sec)
    REFERENCES moont.image_quota_periods(owner_id, period_start_sec) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS image_quota_operations_pending_idx
  ON moont.image_quota_operations (created_at)
  WHERE status = 'reserved';

REVOKE ALL ON ALL TABLES IN SCHEMA moont FROM PUBLIC;
COMMIT;
