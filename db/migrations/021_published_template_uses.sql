-- MOO-32 (auditoria 20/11): `use_count` subia a cada pedido `use`, de
-- qualquer conta. Esta tabela marca o primeiro uso de cada conta por dia
-- (Brasília); o contador só sobe quando a marca é nova.
-- Aditiva: o código anterior ignora a tabela, e o código novo mantém o
-- comportamento antigo enquanto ela não existir.
BEGIN;
CREATE TABLE IF NOT EXISTS moont.published_template_uses (
  template_id text NOT NULL REFERENCES moont.published_templates(id) ON DELETE CASCADE,
  owner_id text NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 255),
  day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, owner_id, day)
);
-- Limpeza futura por data sem varrer a tabela inteira.
CREATE INDEX IF NOT EXISTS published_template_uses_day_idx
  ON moont.published_template_uses (day);

ALTER TABLE moont.published_template_uses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON moont.published_template_uses FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON moont.published_template_uses FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON moont.published_template_uses FROM authenticated;
  END IF;
END $$;
COMMIT;
