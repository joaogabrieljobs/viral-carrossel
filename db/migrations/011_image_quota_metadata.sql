-- Contexto explicativo opcional para relacionar uma geração ao projeto/card.
-- Operações antigas permanecem válidas com o objeto vazio padrão.
BEGIN;

ALTER TABLE moont.image_quota_operations
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE moont.image_quota_operations
  DROP CONSTRAINT IF EXISTS image_quota_operations_metadata_object;

ALTER TABLE moont.image_quota_operations
  ADD CONSTRAINT image_quota_operations_metadata_object
  CHECK (jsonb_typeof(metadata) = 'object') NOT VALID;

COMMIT;

-- Valida depois de liberar o ACCESS EXCLUSIVE usado para alterar o schema.
-- Novas escritas já obedecem ao CHECK NOT VALID criado acima; esta segunda
-- transação lê o legado com um bloqueio mais leve.
BEGIN;

ALTER TABLE moont.image_quota_operations
  VALIDATE CONSTRAINT image_quota_operations_metadata_object;

COMMIT;
