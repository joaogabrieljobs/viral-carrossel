# Spec — Task 05: seguranca-regressao

**Épico:** docs/epics/suite-testes-confianca/README.md
**Status:** Concluída

## 1. Objetivo
Regressão permanente dos 4 endurecimentos de 2026-08-07 (RF-12..RF-14 + gate do proxy IA, DEC-005): se alguém reintroduzir o problema, `npm test` quebra.

## 2. Contexto herdado
- audit.md (3 fixes billing) + audit-produto.md §crítico 3 (proxy IA). Código: `api/lib/cors.js` (allowlist APP_URL+localhost), `access.js` (`getSecret` sem fallback; `billingDisabled` ignora prod), `api/anthropic/v1/messages.js` (user-key exige sessão; env-key do host removida em 2026-09-15 — ver auditoria M17).

## 3. Arquivos a tocar
`tests/integration/seguranca.test.js` (criar). Zero produção.

## 6. Critérios de aceite
- [ ] CA-01 (RF-12): origin fora da allowlist não recebe `Access-Control-Allow-Origin` em endpoint de billing; origin permitido recebe + `Vary: Origin`
- [ ] CA-02 (RF-13): sem `ACCESS_COOKIE_SECRET`, emissão de token lança erro explícito (sem fallback pra `STRIPE_SECRET_KEY`)
- [ ] CA-03 (RF-14): `BILLING_DISABLED=true` + `VERCEL_ENV=production` → sessão NÃO libera acesso; em não-prod libera com flag
- [ ] CA-04: proxy Anthropic — anônimo → 401 (gate antes da chave); chave própria **sem sessão → 401**; sessão **sem chave própria → 400** `anthropic_key_required` (o fallback para `ANTHROPIC_API_KEY` do host foi removido em 2026-09-15); sessão + chave própria → 200 com a chave do utilizador (ver `tests/integration/seguranca.test.js`)
- [ ] CA-05: zero rede real (fetch stubado no proxy)

## 7. Validação
```bash
npm test && npm run build
```

## 8. Gates
- [x] Quality — [x] Security (é o objeto da task) — [ ] UX/Performance N/A

## 9. Rollback
Revert; só teste.

## 10. Fora de escopo
CORS do E2E. (Rate limit em memória por IP foi implementado depois em `api/lib/rate-limit.js`; testes em `tests/integration/proxies-ia.test.js` cobrem os proxies IA.)
