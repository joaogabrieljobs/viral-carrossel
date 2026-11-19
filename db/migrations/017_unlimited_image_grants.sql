-- Isenção sem limite de imagens (João, 19/11: "isenta de plano, sem limites de
-- crédito" para a conta dele). A concessão continua com plano explícito; a
-- coluna só tira o teto mensal de imagens. O uso continua sendo contado no
-- banco de quota, para o custo seguir visível.
BEGIN;
ALTER TABLE moont.account_access_grants
  ADD COLUMN IF NOT EXISTS unlimited_images boolean NOT NULL DEFAULT false;
COMMIT;
