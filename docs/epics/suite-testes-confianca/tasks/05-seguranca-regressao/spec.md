# Spec — Task 05: seguranca-regressao

**Épico:** docs/epics/suite-testes-confianca/README.md
**Status:** Concluída

## 1. Objetivo
Regressão permanente dos 4 endurecimentos de 2026-08-07 (RF-12..RF-14 + gate do proxy IA, DEC-005): se alguém reintroduzir o problema, `npm test` quebra.

## 2. Contexto herdado
- audit.md (3 fixes billing) + audit-produto.md §crítico 3 (proxy IA). Código: `api/lib/cors.js` (allowlist APP_URL+localhost), `access.js` (`getSecret` sem fallback; `billingDisabled` ignora prod), `api/anthropic/v1/messages.js` (env-key exige sessão; user-key passa).

## 3. Arquivos a tocar
`tests/integration/seguranca.test.js` (criar). Zero produção.

## 6. Critérios de aceite
- [ ] CA-01 (RF-12): origin fora da allowlist não recebe `Access-Control-Allow-Origin` em endpoint de billing; origin permitido recebe + `Vary: Origin`
- [ ] CA-02 (RF-13): sem `ACCESS_COOKIE_SECRET`, emissão de token lança erro explícito (sem fallback pra `STRIPE_SECRET_KEY`)
- [ ] CA-03 (RF-14): `BILLING_DISABLED=true` + `VERCEL_ENV=production` → sessão NÃO libera acesso; em não-prod libera com flag
- [ ] CA-04: proxy Anthropic — anônimo sem chave própria → 401 (não consome env-key); com sessão → usa env-key; com chave própria → passa sem sessão
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
Rate limit (não implementado — registrar como pergunta futura), CORS do E2E.
