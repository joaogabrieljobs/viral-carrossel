-- Contadores partilhados entre funções serverless. As chaves de rate limit
-- são hashes SHA-256; endereços IP não ficam armazenados em texto claro.
BEGIN;

CREATE SCHEMA IF NOT EXISTS moont;
REVOKE ALL ON SCHEMA moont FROM PUBLIC;

CREATE TABLE IF NOT EXISTS moont.rate_limit_buckets (
  bucket_hash text NOT NULL CHECK (bucket_hash ~ '^[a-f0-9]{64}$'),
  window_slot bigint NOT NULL,
  hits integer NOT NULL CHECK (hits >= 1),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (bucket_hash, window_slot)
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_expiry_idx
  ON moont.rate_limit_buckets (expires_at);

CREATE TABLE IF NOT EXISTS moont.ocr_daily_quotas (
  owner_id text NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 255),
  quota_day date NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, quota_day)
);

CREATE TABLE IF NOT EXISTS moont.ocr_daily_operations (
  owner_id text NOT NULL,
  quota_day date NOT NULL,
  operation_id text NOT NULL CHECK (length(operation_id) BETWEEN 1 AND 160),
  status text NOT NULL CHECK (status IN ('reserved', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, quota_day, operation_id),
  FOREIGN KEY (owner_id, quota_day)
    REFERENCES moont.ocr_daily_quotas(owner_id, quota_day) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ocr_daily_quotas_day_idx
  ON moont.ocr_daily_quotas (quota_day);

REVOKE ALL ON ALL TABLES IN SCHEMA moont FROM PUBLIC;
COMMIT;
