-- Console admin do Moont (docs/product/console-admin.md, decisões de 19/11).
-- Papéis no banco, trilha imutável e códigos por e-mail para as ações de risco.
-- Só o servidor acessa estas tabelas: RLS ligado, sem políticas.
BEGIN;

CREATE TABLE IF NOT EXISTS moont.admin_roles (
  owner_id text PRIMARY KEY CHECK (length(owner_id) BETWEEN 1 AND 255),
  role text NOT NULL CHECK (role IN ('admin', 'suporte')),
  granted_by text NOT NULL CHECK (length(granted_by) BETWEEN 1 AND 255),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by text CHECK (revoked_by IS NULL OR length(revoked_by) BETWEEN 1 AND 255),
  CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);

-- Trilha: toda escrita do console e toda abertura de ficha de conta.
CREATE TABLE IF NOT EXISTS moont.admin_actions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 255),
  actor_role text NOT NULL CHECK (actor_role IN ('admin', 'suporte')),
  action text NOT NULL CHECK (length(action) BETWEEN 1 AND 80),
  target text CHECK (target IS NULL OR length(target) <= 255),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_actions_created_idx ON moont.admin_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_actions_target_idx ON moont.admin_actions (target, created_at DESC);

CREATE OR REPLACE FUNCTION moont.prevent_admin_action_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION 'A trilha do console admin não aceita alteração nem exclusão'; END;
$$;
DROP TRIGGER IF EXISTS admin_actions_append_only ON moont.admin_actions;
CREATE TRIGGER admin_actions_append_only
  BEFORE UPDATE OR DELETE OR TRUNCATE ON moont.admin_actions
  FOR EACH STATEMENT EXECUTE FUNCTION moont.prevent_admin_action_mutation();

-- Código por e-mail (D1): vale 10 minutos, uma vez, para uma ação exata.
CREATE TABLE IF NOT EXISTS moont.admin_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 255),
  action text NOT NULL CHECK (length(action) BETWEEN 1 AND 80),
  payload_hash char(64) NOT NULL,
  code_hash char(64) NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_challenges_owner_idx ON moont.admin_challenges (owner_id, created_at DESC);

ALTER TABLE moont.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE moont.admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moont.admin_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON moont.admin_roles, moont.admin_actions, moont.admin_challenges FROM PUBLIC;
REVOKE ALL ON FUNCTION moont.prevent_admin_action_mutation() FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON moont.admin_roles, moont.admin_actions, moont.admin_challenges FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON moont.admin_roles, moont.admin_actions, moont.admin_challenges FROM authenticated;
  END IF;
END $$;
COMMIT;
