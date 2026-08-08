# Spec — Task 04: integracao-stripe

**Épico:** docs/epics/suite-testes-confianca/README.md
**Status:** Concluída

## 1. Objetivo
Integração dos endpoints de pagamento (RF-07..RF-10): checkout, confirm, portal (req/res fake + `vi.mock('stripe')`, DEC-002/003) e webhook (edge runtime, `Request`/`Response` reais, **assinatura HMAC real** gerada com secret sintético — valida o caminho criptográfico de verdade).

## 2. Contexto herdado
- Contratos TDD §5. Código: `handleCheckout` (400 e-mail inválido; cliente novo via `customers.create`; já-ativo → `alreadyActive`+cookie), `handleConfirm` (402 não paga; 400 modo errado; cookie no sucesso), `handlePortal` (401 sem cookie), `api/stripe/webhook.js` (edge, `constructEventAsync` + SubtleCrypto, exige `whsec_`).
- Webhook usa SDK real (sem mock) — assinatura `t=…,v1=HMAC-SHA256(secret, "t.body")` gerada no teste.

## 3. Arquivos a tocar
| Arquivo | Ação | O quê | Quem consome |
|---|---|---|---|
| `tests/integration/stripe.test.js` | criar | checkout 4 / confirm 4 / portal 2 | vitest |
| `tests/integration/stripe-webhook.test.js` | criar | assinatura válida/inválida/ausente + 405 | vitest |
| `tests/helpers/env.js` | editar | + `STRIPE_WEBHOOK_SECRET` sintético `whsec_…` | suíte |

## 6. Critérios de aceite
- [ ] CA-01: checkout — e-mail inválido 400; novo cliente cria customer e retorna url; já ativo → alreadyActive + Set-Cookie; 405
- [ ] CA-02: confirm — paga → active+cookie; não paga → 402; mode≠subscription → 400; sem sessionId → 400
- [ ] CA-03: portal — sem cookie 401; com cookie retorna url
- [ ] CA-04: webhook — evento assinado corretamente → 200 `{received:true}`; assinatura inválida → 400; sem header → 400; GET → 405
- [ ] CA-05: zero rede real

## 7. Validação
```bash
npm test && npm run build
```

## 8. Gates
- [x] Quality — [x] Security (dinheiro/cookies; secrets sintéticos) — [ ] UX N/A — [ ] Performance N/A

## 9. Rollback
Revert; só testes/helpers.

## 10. Fora de escopo
Concorrência (06), jornada E2E de compra (08).
