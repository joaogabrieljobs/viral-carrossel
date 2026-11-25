/**
 * Spec 1.1, entrega 5: auditoria de imagem atrás de flag por conta.
 *
 * Mesmo padrão das contas de emergência do admin (`MOONT_ADMIN_ACCOUNTS` em
 * admin-store.js): lista de ids de cliente em variável de ambiente, sem tabela
 * e sem migração. Sem a variável, ninguém tem a auditoria (desligada por padrão).
 * A sessão (/api/auth/session) expõe só o booleano `imageAudit`.
 */
const OWNER = /^[A-Za-z0-9_.-]{1,255}$/;

export function imageAuditAccounts(env = process.env) {
  return new Set(String(env.MOONT_IMAGE_AUDIT_ACCOUNTS || '').split(/[\s,;]+/).map((s) => s.trim()).filter((s) => OWNER.test(s)));
}

export function imageAuditEnabledFor(customerId, env = process.env) {
  const id = String(customerId || '').trim();
  return !!id && imageAuditAccounts(env).has(id);
}
