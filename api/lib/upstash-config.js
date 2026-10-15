/**
 * Mantém as credenciais legadas intactas durante a migração. A flag operacional
 * desliga o Redis de todos os fluxos sem exigir apagar segredos no Vercel.
 */
export function isUpstashDisabled() {
  return process.env.UPSTASH_DISABLED === '1';
}
