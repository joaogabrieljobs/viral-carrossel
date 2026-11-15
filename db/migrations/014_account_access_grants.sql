-- Private, account-scoped commercial exemptions. No Stripe billing records are changed.
BEGIN;
CREATE TABLE IF NOT EXISTS moont.account_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES moont.accounts(id) ON DELETE RESTRICT,
  tier text NOT NULL CHECK (tier IN ('essential', 'creator', 'pro', 'max')),
  starts_at_sec bigint NOT NULL CHECK (starts_at_sec > 0),
  expires_at_sec bigint CHECK (expires_at_sec IS NULL OR expires_at_sec > starts_at_sec),
  quota_anchor_sec bigint NOT NULL CHECK (quota_anchor_sec > 0 AND quota_anchor_sec <= starts_at_sec),
  request_id text NOT NULL UNIQUE CHECK (length(request_id) BETWEEN 1 AND 200),
  actor text NOT NULL CHECK (length(actor) BETWEEN 1 AND 200),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by text,
  UNIQUE (id, account_id),
  CHECK ((revoked_at IS NULL AND revoked_by IS NULL) OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND length(revoked_by) BETWEEN 1 AND 200))
);
CREATE INDEX IF NOT EXISTS account_access_grants_active_idx
  ON moont.account_access_grants(account_id, starts_at_sec) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS moont.account_access_grant_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  grant_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES moont.accounts(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('granted', 'revoked')),
  request_id text NOT NULL UNIQUE CHECK (length(request_id) BETWEEN 1 AND 200),
  actor text NOT NULL CHECK (length(actor) BETWEEN 1 AND 200),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (grant_id, account_id) REFERENCES moont.account_access_grants(id, account_id) ON DELETE RESTRICT
);
CREATE OR REPLACE FUNCTION moont.prevent_access_grant_event_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Account access audit events are append-only'; END;
$$;
DROP TRIGGER IF EXISTS account_access_grant_events_append_only ON moont.account_access_grant_events;
CREATE TRIGGER account_access_grant_events_append_only
  BEFORE UPDATE OR DELETE OR TRUNCATE ON moont.account_access_grant_events
  FOR EACH STATEMENT EXECUTE FUNCTION moont.prevent_access_grant_event_mutation();
ALTER TABLE moont.account_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE moont.account_access_grant_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON moont.account_access_grants, moont.account_access_grant_events FROM PUBLIC;
REVOKE ALL ON FUNCTION moont.prevent_access_grant_event_mutation() FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON moont.account_access_grants, moont.account_access_grant_events FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON moont.account_access_grants, moont.account_access_grant_events FROM authenticated;
  END IF;
END $$;
COMMIT;
