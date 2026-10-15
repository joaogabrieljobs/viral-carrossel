-- Revisão independente para dados globais da conta. Salvamentos de projetos
-- continuam a incrementar account_libraries.revision sem invalidar edições de
-- marcas, pastas e perfil.
BEGIN;

ALTER TABLE moont.account_libraries
  ADD COLUMN IF NOT EXISTS meta_revision bigint NOT NULL DEFAULT 0
  CHECK (meta_revision >= 0),
  ADD COLUMN IF NOT EXISTS meta_updated_at bigint NOT NULL DEFAULT 0
  CHECK (meta_updated_at >= 0);

-- Contas já migradas do Blob recebem uma versão inicial que representa o
-- estado global existente. Uma conta nova começa em zero.
UPDATE moont.account_libraries
SET meta_revision = GREATEST(revision, 1), meta_updated_at = updated_at
WHERE meta_revision = 0 AND manifest_meta <> '{}'::jsonb;

COMMIT;
