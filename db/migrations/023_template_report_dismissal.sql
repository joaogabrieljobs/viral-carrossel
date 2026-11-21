-- MOO-31 (auditoria 20/11): "Manter"/"Restaurar" apagavam as denúncias e as
-- mesmas contas podiam ocultar o modelo de novo, sem fim. Agora a decisão
-- marca `dismissed_at` e a linha fica: a chave (template_id, reporter_id)
-- impede a mesma conta de denunciar de novo o mesmo modelo.
-- `counts_toward_hide`: só denúncia de conta com assinatura ativa ou isenção
-- dispara a ocultação. Denúncias existentes já contavam: padrão true.
-- Aditiva: o código detecta as colunas e, sem elas, mantém o comportamento
-- anterior de Manter/Restaurar.
BEGIN;
ALTER TABLE moont.published_template_reports
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS counts_toward_hide boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS published_template_reports_active_idx
  ON moont.published_template_reports (template_id)
  WHERE dismissed_at IS NULL;
COMMIT;
