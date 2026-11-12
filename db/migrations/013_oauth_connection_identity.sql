BEGIN;

-- Uma credencial de acesso pertence a um cliente OAuth específico. O nome do
-- cliente é apenas apresentação e pode se repetir (por exemplo, duas
-- instalações chamadas "Claude").
ALTER TABLE moont.agent_tokens
  ADD COLUMN IF NOT EXISTS oauth_client_id uuid
    REFERENCES moont.oauth_clients(client_id) ON DELETE CASCADE;

-- Tokens OAuth antigos não guardavam o client_id. Só faça backfill quando o
-- nome resolve para exatamente uma conexão daquele proprietário; em caso
-- ambíguo é mais seguro esperar a próxima rotação (máximo de uma hora) do que
-- associar e revogar a integração errada.
WITH unique_legacy_connection AS (
  SELECT token.id, min(refresh.client_id::text)::uuid AS client_id
  FROM moont.agent_tokens token
  JOIN moont.oauth_refresh_tokens refresh
    ON refresh.owner_id = token.owner_id
  JOIN moont.oauth_clients client
    ON client.client_id = refresh.client_id
  WHERE token.oauth_client_id IS NULL
    AND token.label = 'MCP OAuth — ' || left(trim(client.client_name), 60)
  GROUP BY token.id
  HAVING count(DISTINCT refresh.client_id) = 1
)
UPDATE moont.agent_tokens token
SET oauth_client_id = legacy.client_id
FROM unique_legacy_connection legacy
WHERE token.id = legacy.id;

CREATE INDEX IF NOT EXISTS agent_tokens_oauth_connection_idx
  ON moont.agent_tokens (owner_id, oauth_client_id, created_at DESC)
  WHERE oauth_client_id IS NOT NULL;

COMMIT;
