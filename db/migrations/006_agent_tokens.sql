-- Tokens pessoais para a integração local Codex/Moont. O segredo em claro nunca
-- é gravado; apenas o SHA-256 é mantido no schema privado do servidor.
BEGIN;

CREATE SCHEMA IF NOT EXISTS moont;
REVOKE ALL ON SCHEMA moont FROM PUBLIC;

-- A revisão do agente só muda em recuperação de senha ou troca do vínculo
-- de identidade. Logout comum revoga o cookie, sem desfazer o pareamento.
ALTER TABLE moont.accounts
  ADD COLUMN IF NOT EXISTS agent_epoch text NOT NULL DEFAULT ''
    CHECK (length(agent_epoch) <= 255);

CREATE TABLE IF NOT EXISTS moont.agent_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL
    CHECK (length(owner_id) BETWEEN 1 AND 80 AND owner_id ~ '^[A-Za-z0-9_.-]+$'),
  -- Se a revisão de segurança da conta mudar, esta chave deixa de funcionar.
  agent_epoch text NOT NULL CHECK (length(agent_epoch) <= 255),
  account_id uuid,
  token_hash text NOT NULL UNIQUE
    CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  label text NOT NULL
    CHECK (length(label) BETWEEN 1 AND 80),
  scopes text[] NOT NULL
    CHECK (
      cardinality(scopes) BETWEEN 1 AND 2
      AND scopes <@ ARRAY['projects:read', 'projects:write']::text[]
    ),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS agent_tokens_owner_active_idx
  ON moont.agent_tokens (owner_id, created_at DESC)
  WHERE revoked_at IS NULL;

REVOKE ALL ON moont.agent_tokens FROM PUBLIC;
ALTER TABLE moont.agent_tokens ENABLE ROW LEVEL SECURITY;
COMMIT;
