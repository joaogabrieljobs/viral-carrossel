# Spec — Task 03: integracao-auth

**Épico:** docs/epics/suite-testes-confianca/README.md
**Status:** Concluída

## 1. Objetivo
Integração dos endpoints de auth (RF-04 completo, RF-05, RF-06): `session`, `logout`, `access.js` (expirado/ausente), Google OAuth (início + callback) — handlers invocados direto com req/res fake (DEC-003), Stripe via `vi.mock('stripe')` (DEC-002), Google via fetch stubado.

## 2. Contexto herdado
- Contratos TDD §5 (session/logout/google). Código lido: `handleSession`/`handleLogout` (billing-handlers), `api/auth/google.js` (redirect 302, state cookie `vc_google_oauth` 10min), `callback.js` (denied → `?login=denied`; state inválido → `?login=invalid_state`; sem customer/sub → `?login=no_subscription&email=…`; ativo → cookie + `?billing=restored&login=google`), `exchangeGoogleCode` (2 fetches: token + userinfo), `findActiveSubscription` (`subscriptions.list` → status active|trialing).

## 3. Arquivos a tocar
| Arquivo | Ação | O quê | Quem consome |
|---|---|---|---|
| `tests/helpers/http.js` | criar | fábrica req/res fake (status/json/redirect/Set-Cookie) | tasks 03-06 |
| `tests/helpers/env.js` | editar | + STRIPE_SECRET_KEY/PRICE_ID/APP_URL/GOOGLE_* sintéticos | suíte |
| `tests/integration/auth.test.js` | criar | 12+ casos | vitest |

## 4. Plano
1. http.js; 2. env; 3. auth.test.js (session 4 casos + expirado, logout, google início 2, callback 4); 4. verde; 5. commit `[suite-testes/03]`.

## 6. Critérios de aceite
- [ ] CA-01: session — anônimo, ativo, inativo, adulterado, método errado (405)
- [ ] CA-02: token expirado (>30d, via fake timers) → anonymous
- [ ] CA-03: logout limpa cookie (Max-Age=0)
- [ ] CA-04: google início — não configurado → redirect `google_unconfigured`; configurado → 302 accounts.google.com + state cookie
- [ ] CA-05: callback — denied, state inválido, sem assinatura (com e-mail no redirect), assinante ativo (cookie `vc_access` + `billing=restored`)
- [ ] CA-06: zero rede real (Stripe mockado, fetch stubado)

## 7. Validação
```bash
npm test && npm run build
```

## 8. Gates
- [x] Quality — [x] Security (auth é o objeto; segredos sintéticos) — [ ] UX N/A — [ ] Performance N/A

## 9. Rollback
Revert; só testes/helpers.

## 10. Fora de escopo
checkout/confirm/portal/webhook (04), CORS (05), concorrência (06).
