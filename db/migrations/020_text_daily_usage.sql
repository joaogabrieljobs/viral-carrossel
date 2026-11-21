-- MOO-11 (auditoria 20/11): o texto incluso no plano (chave da plataforma em
-- /api/ai/compatible) só tinha limite por IP. Esta tabela conta pedidos por
-- conta e por dia (dia de Brasília). Só o servidor acessa: RLS ligado, sem
-- políticas.
BEGIN;

CREATE TABLE IF NOT EXISTS moont.text_daily_usage (
  owner_id text NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 255),
  quota_day date NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, quota_day)
);

CREATE INDEX IF NOT EXISTS text_daily_usage_day_idx ON moont.text_daily_usage (quota_day);

ALTER TABLE moont.text_daily_usage ENABLE ROW LEVEL SECURITY;

COMMIT;
