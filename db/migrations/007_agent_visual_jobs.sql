-- Histórico de alterações visuais do agente. A cópia anterior permanece privada
-- para desfazer exatamente uma gravação, com CAS e isolamento por conta.
BEGIN;

CREATE TABLE IF NOT EXISTS moont.agent_visual_jobs (
  owner_id text NOT NULL REFERENCES moont.account_libraries(owner_id) ON DELETE CASCADE,
  request_id text NOT NULL CHECK (length(request_id) BETWEEN 8 AND 128),
  project_id text NOT NULL,
  token_id text NOT NULL,
  request_hash char(64) NOT NULL,
  before_version bigint NOT NULL CHECK (before_version >= 1),
  after_version bigint NOT NULL CHECK (after_version >= before_version),
  changed_slide_count integer NOT NULL CHECK (changed_slide_count >= 0),
  changed_brand_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  before_entry jsonb NOT NULL CHECK (jsonb_typeof(before_entry) = 'object'),
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'undone')),
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz,
  undo_request_id text,
  undo_version bigint,
  PRIMARY KEY (owner_id, request_id),
  UNIQUE (owner_id, undo_request_id),
  CHECK ((status = 'undone') = (undone_at IS NOT NULL)),
  CHECK ((status = 'undone') = (undo_request_id IS NOT NULL)),
  CHECK ((status = 'undone') = (undo_version IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS agent_visual_jobs_project_idx
  ON moont.agent_visual_jobs (owner_id, project_id, created_at DESC);

ALTER TABLE moont.agent_visual_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON moont.agent_visual_jobs FROM PUBLIC;
COMMIT;
