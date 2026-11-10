-- Contexto explicativo opcional para relacionar uma geração ao projeto/card.
-- Operações antigas permanecem válidas com o objeto vazio padrão.
BEGIN;

ALTER TABLE moont.image_quota_operations
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE moont.image_quota_operations
  DROP CONSTRAINT IF EXISTS image_quota_operations_metadata_object;

ALTER TABLE moont.image_quota_operations
  ADD CONSTRAINT image_quota_operations_metadata_object
  CHECK (jsonb_typeof(metadata) = 'object');

COMMIT;
