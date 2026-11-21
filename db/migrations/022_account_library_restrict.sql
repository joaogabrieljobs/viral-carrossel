-- MOO-24 (auditoria 20/11): account_projects (001) e agent_visual_jobs (007)
-- referenciavam account_libraries com ON DELETE CASCADE. Um DELETE manual na
-- biblioteca apagaria todos os projetos e o histórico do agente sem trilha.
-- Nenhum código em api/ apaga account_libraries nem account_projects; a
-- troca para RESTRICT só impede o apagamento acidental em massa.
-- Os nomes reais (padrão do Postgres para FK inline) são
-- account_projects_owner_id_fkey e agent_visual_jobs_owner_id_fkey. O bloco
-- procura pela relação, não pelo nome, e pode ser reaplicado.
BEGIN;

DO $$
DECLARE
  target record;
  fk record;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('moont.account_projects'::regclass, 'account_projects_owner_id_fkey'),
      ('moont.agent_visual_jobs'::regclass, 'agent_visual_jobs_owner_id_fkey')
    ) AS t(tbl, fk_name)
  LOOP
    -- Remove qualquer FK desta tabela para account_libraries que não seja RESTRICT.
    FOR fk IN
      SELECT conname FROM pg_constraint
      WHERE contype = 'f' AND conrelid = target.tbl
        AND confrelid = 'moont.account_libraries'::regclass
        AND confdeltype <> 'r'
    LOOP
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', target.tbl, fk.conname);
    END LOOP;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE contype = 'f' AND conrelid = target.tbl
        AND confrelid = 'moont.account_libraries'::regclass
        AND confdeltype = 'r'
    ) THEN
      -- NOT VALID: as linhas já cumpriam a FK anterior; a validação abaixo
      -- roda em transação própria com bloqueio mais leve.
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (owner_id) REFERENCES moont.account_libraries(owner_id) ON DELETE RESTRICT NOT VALID',
        target.tbl, target.fk_name);
    END IF;
  END LOOP;
END $$;

COMMIT;

BEGIN;
ALTER TABLE moont.account_projects VALIDATE CONSTRAINT account_projects_owner_id_fkey;
ALTER TABLE moont.agent_visual_jobs VALIDATE CONSTRAINT agent_visual_jobs_owner_id_fkey;
COMMIT;
