BEGIN;

CREATE TABLE IF NOT EXISTS moont.oauth_clients (
  client_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  redirect_uris text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moont.oauth_codes (
  code_hash text PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES moont.oauth_clients(client_id) ON DELETE CASCADE,
  owner_id text NOT NULL,
  redirect_uri text NOT NULL,
  resource text NOT NULL,
  scopes text[] NOT NULL,
  code_challenge text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS moont.oauth_refresh_tokens (
  token_hash text PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES moont.oauth_clients(client_id) ON DELETE CASCADE,
  owner_id text NOT NULL,
  resource text NOT NULL,
  scopes text[] NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oauth_codes_expiry_idx ON moont.oauth_codes (expires_at);
CREATE INDEX IF NOT EXISTS oauth_refresh_owner_idx ON moont.oauth_refresh_tokens (owner_id, created_at DESC);
ALTER TABLE moont.oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE moont.oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE moont.oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON moont.oauth_clients, moont.oauth_codes, moont.oauth_refresh_tokens FROM PUBLIC;

COMMIT;
