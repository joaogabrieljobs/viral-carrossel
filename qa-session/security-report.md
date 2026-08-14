# Auditoria de Segurança — Viral Carrossel
2026-08-14 · Escopo: código (`viral-carrossel`) + runtime (`https://viral-carrossel.vercel.app`, `https://viralcarrossel.com.br`)

## Remediação (2026-08-14)
Correções aplicadas no código — **deploy + `APP_URL` no painel Vercel** ainda necessários para runtime.

| ID | Estado | O que mudou |
|----|--------|-------------|
| SEC-001 | ✅ código | `requireActiveSubscription` em Anthropic + compatible; BYOK exige sessão |
| SEC-002 | ✅ código | Redirects manuais + revalidação anti-SSRF por hop (`urlSourceFetch.js`) |
| SEC-003/006/007 | ✅ código | Auth + rate limit em fetch-source, compatible, anthropic, checkout |
| SEC-004 | ✅ código | Keys default em sessionStorage; migração de órfãs; aviso XSS no opt-in |
| SEC-005 | ✅ código | CSP, XFO, nosniff, Referrer-Policy, Permissions-Policy em `vercel.json` |
| SEC-008 | ✅ código | `/api/status` em prod só `{ ok, dev }` |
| SEC-009 | ✅ código | Webhook sem email nos logs |
| SEC-010 | ✅ código | Session/confirm sem `customerId` no JSON |
| SEC-011 | ✅ código | CORS inclui `viralcarrossel.com.br` + www; setar `APP_URL` em prod |
| Higiene | ✅ | `jspdf` ^4 |

**Pendente operacional:** `APP_URL=https://viralcarrossel.com.br` + redirect Google OAuth no domínio; redeploy Vercel.

## Score pós-código (estimado): 4/5
Restam riscos residuais: rate limit só em memória (por instância), CSP com `'unsafe-inline'` (necessário ao Vite), verificação Stripe por pedido IA (custo/latência).

## Achados originais (referência)
Ver histórico abaixo — itens Alto/Médio foram endereçados na remediação.

### Alto (pré-fix)
- SEC-001 paywall só cliente / BYOK sem sessão
- SEC-002 SSRF via redirect follow
- SEC-003 abuse sem rate limit + proxies abertos

### Médio / Baixo
- SEC-004–011: storage keys, headers, fetch-source, compatible, status, logs, customerId, CORS domínio

## O que já estava bem (mantido)
Cookie HMAC, CORS allowlist, BILLING_DISABLED guard em prod, webhook assinatura Stripe, anti-SSRF hostname privado, sem `dangerouslySetInnerHTML`/`eval`.
