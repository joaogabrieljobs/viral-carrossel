-- Modelos publicados (docs/product/publicar-modelo.md): estrutura visual de um
-- projeto, sem conteúdo nem identidade do cliente, numa galeria pública dentro
-- do app. Só o servidor acessa (RLS ligado, sem políticas, como o resto do esquema).
BEGIN;
CREATE TABLE IF NOT EXISTS moont.published_templates (
  id text PRIMARY KEY CHECK (id ~ '^tpl_[a-z0-9]{20}$'),
  owner_id text NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 255),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 160),
  author_name text CHECK (author_name IS NULL OR length(author_name) BETWEEN 1 AND 40),
  format text NOT NULL CHECK (format IN ('carrossel', 'quadrado', 'stories', 'apresentacao')),
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  content_bytes integer NOT NULL CHECK (content_bytes BETWEEN 1 AND 49152),
  -- 'hidden': saiu da galeria por denúncias; o João revê e apaga ou devolve.
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  use_count integer NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  report_count integer NOT NULL DEFAULT 0 CHECK (report_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS published_templates_gallery_idx
  ON moont.published_templates (created_at DESC, id DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS published_templates_owner_idx
  ON moont.published_templates (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS moont.published_template_reports (
  template_id text NOT NULL REFERENCES moont.published_templates(id) ON DELETE CASCADE,
  reporter_id text NOT NULL CHECK (length(reporter_id) BETWEEN 1 AND 255),
  reason text NOT NULL DEFAULT '' CHECK (length(reason) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, reporter_id)
);

ALTER TABLE moont.published_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE moont.published_template_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON moont.published_templates, moont.published_template_reports FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON moont.published_templates, moont.published_template_reports FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON moont.published_templates, moont.published_template_reports FROM authenticated;
  END IF;
END $$;
COMMIT;
