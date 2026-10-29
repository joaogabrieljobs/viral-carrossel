-- Geração de imagens pelo MCP vira um job assíncrono: a linha nasce `pending`
-- com o estado por card, termina `applied` (versão nova) ou `failed`, e o
-- snapshot anterior continua servindo ao undo. Colunas novas têm padrão, logo
-- o código anterior continua gravando e lendo sem alteração.
BEGIN;

ALTER TABLE moont.agent_visual_jobs
  ADD COLUMN IF NOT EXISTS slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

ALTER TABLE moont.agent_visual_jobs
  DROP CONSTRAINT IF EXISTS agent_visual_jobs_status_check;
ALTER TABLE moont.agent_visual_jobs
  ADD CONSTRAINT agent_visual_jobs_status_check
  CHECK (status IN ('pending', 'applied', 'failed', 'undone'));

ALTER TABLE moont.agent_visual_jobs
  ADD CONSTRAINT agent_visual_jobs_slides_check CHECK (jsonb_typeof(slides) = 'array'),
  ADD CONSTRAINT agent_visual_jobs_meta_check CHECK (jsonb_typeof(meta) = 'object');

COMMIT;
