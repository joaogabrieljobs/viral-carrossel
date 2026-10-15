-- Biblioteca Moont por conta. Executar com a credencial privada do servidor.
-- O schema não deve ser adicionado aos schemas expostos pela API do PostgREST.
BEGIN;

CREATE SCHEMA IF NOT EXISTS moont;
REVOKE ALL ON SCHEMA moont FROM PUBLIC;

CREATE TABLE IF NOT EXISTS moont.account_libraries (
  owner_id text PRIMARY KEY
    CHECK (length(owner_id) BETWEEN 1 AND 80 AND owner_id ~ '^[A-Za-z0-9_.-]+$'),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at bigint NOT NULL DEFAULT 0 CHECK (updated_at >= 0),
  project_count integer NOT NULL DEFAULT 0 CHECK (project_count >= 0),
  next_order bigint NOT NULL DEFAULT 0 CHECK (next_order >= 0),
  manifest_meta jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(manifest_meta) = 'object'),
  migrated_from_blob boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moont.account_projects (
  owner_id text NOT NULL REFERENCES moont.account_libraries(owner_id) ON DELETE CASCADE,
  project_id text NOT NULL CHECK (length(project_id) BETWEEN 1 AND 500),
  entry jsonb,
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at bigint NOT NULL CHECK (updated_at >= 0),
  deleted_at bigint,
  sort_order bigint NOT NULL CHECK (sort_order >= 0),
  PRIMARY KEY (owner_id, project_id),
  CHECK ((entry IS NULL) = (deleted_at IS NOT NULL)),
  CHECK (entry IS NULL OR jsonb_typeof(entry) = 'object')
);

-- Paginação estável da biblioteca sem ler os documentos JSONB.
CREATE INDEX IF NOT EXISTS account_projects_live_page_idx
  ON moont.account_projects (owner_id, updated_at DESC, sort_order DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS account_projects_owner_order_idx
  ON moont.account_projects (owner_id, sort_order);

REVOKE ALL ON ALL TABLES IN SCHEMA moont FROM PUBLIC;
COMMIT;
