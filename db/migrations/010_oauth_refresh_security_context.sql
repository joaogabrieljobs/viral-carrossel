BEGIN;

ALTER TABLE moont.oauth_refresh_tokens
  -- Mantém NULL nas linhas emitidas antes desta migração. Elas são validadas
  -- pelo created_at contra session_revoked_before; preencher '' revogaria
  -- integrações legítimas no instante do deploy.
  ADD COLUMN IF NOT EXISTS agent_epoch text
    CHECK (length(agent_epoch) <= 255),
  ADD COLUMN IF NOT EXISTS account_id uuid
    REFERENCES moont.accounts(id) ON DELETE CASCADE;

ALTER TABLE moont.oauth_codes
  ADD COLUMN IF NOT EXISTS agent_epoch text
    CHECK (length(agent_epoch) <= 255),
  ADD COLUMN IF NOT EXISTS account_id uuid
    REFERENCES moont.accounts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS oauth_refresh_account_idx
  ON moont.oauth_refresh_tokens (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS oauth_codes_account_idx
  ON moont.oauth_codes (account_id, created_at DESC);

COMMIT;
