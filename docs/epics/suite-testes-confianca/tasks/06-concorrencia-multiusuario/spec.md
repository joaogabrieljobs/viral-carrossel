# Spec — Task 06: concorrencia-multiusuario

**Épico:** docs/epics/suite-testes-confianca/README.md
**Status:** Concluída

## 1. Objetivo
RF-11 na camada de integração (DEC-004): N=5 usuários executando `checkout→confirm→session` em paralelo (`Promise.all`), cada um recebendo cookie do próprio `customerId` — zero vazamento cruzado de sessão/e-mail. DEC-B do audit: modelo individual; "multiusuário" = N compradores simultâneos.

## 2. Contexto herdado
- Helpers prontos (tasks 03-04): http.js, stripe-mock.js. Mock por-customer: `subscriptions.list`/`checkout.sessions.retrieve` respondem em função do argumento (não valor fixo) pra simular estado independente por usuário sob interleaving.

## 3. Arquivos a tocar
`tests/integration/concorrencia.test.js` (criar). Zero produção.

## 6. Critérios de aceite
- [ ] CA-01: 5 fluxos completos em `Promise.all` terminam todos com status 200
- [ ] CA-02: cookie de cada resposta decodifica pro `customerId` e e-mail DAQUELE usuário
- [ ] CA-03: `session` subsequente com o cookie do usuário N retorna os dados do usuário N
- [ ] CA-04: nenhuma resposta contém e-mail de outro usuário (varredura cruzada N×N)
- [ ] CA-05: repetido 3 rodadas pra reduzir flakiness de interleaving

## 7. Validação
```bash
npm test && npm run build
```

## 8. Gates
- [x] Quality — [x] Security (isolamento de sessão = autorização por recurso) — [ ] UX/Performance N/A

## 9. Rollback
Revert; só teste.

## 10. Fora de escopo
Multiusuário visual (task 10); carga/stress (fora do PRD).
