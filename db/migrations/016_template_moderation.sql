-- Moderação da galeria de modelos (docs/product/publicar-modelo.md).
-- Quem modera é uma lista de contas no banco: incluir ou tirar alguém é um
-- INSERT/DELETE aqui, sem novo deploy. O histórico guarda cada decisão,
-- inclusive de modelos já apagados (sem chave estrangeira de propósito).
BEGIN;
CREATE TABLE IF NOT EXISTS moont.template_moderators (
  owner_id text PRIMARY KEY CHECK (length(owner_id) BETWEEN 1 AND 255),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moont.template_moderation_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  template_id text NOT NULL CHECK (length(template_id) BETWEEN 1 AND 64),
  template_name text NOT NULL DEFAULT '' CHECK (length(template_name) <= 60),
  template_owner_id text NOT NULL CHECK (length(template_owner_id) BETWEEN 1 AND 255),
  moderator_id text NOT NULL CHECK (length(moderator_id) BETWEEN 1 AND 255),
  decision text NOT NULL CHECK (decision IN ('keep', 'hide', 'remove')),
  report_count integer NOT NULL DEFAULT 0 CHECK (report_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS template_moderation_events_template_idx
  ON moont.template_moderation_events (template_id, created_at DESC);

ALTER TABLE moont.published_templates
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE moont.template_moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE moont.template_moderation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON moont.template_moderators, moont.template_moderation_events FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON moont.template_moderators, moont.template_moderation_events FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON moont.template_moderators, moont.template_moderation_events FROM authenticated;
  END IF;
END $$;
COMMIT;
