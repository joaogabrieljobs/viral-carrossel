# Spec — Task 10: e2e-multiusuario

**Épico:** docs/epics/suite-testes-confianca/README.md
**Status:** Concluída

## 1. Objetivo
RF-11 na camada visual (DEC-004): 5 browser contexts paralelos (cookies/storage isolados como 5 pessoas reais), cada um comprando e entrando — sessão de cada um mostra o próprio e-mail, zero cruzamento.

## 2. Contexto herdado
- Task 08 provou a jornada de compra em 1 context; aqui replica em N contexts simultâneos com estado de sessão POR CONTEXT (closure própria de mock).
- Home shell mostra e-mail da conta na aba Perfil (`AccountProfile` — "E-mail da conta: …").

## 3. Arquivos a tocar
`tests/e2e/multiusuario.spec.js` (criar).

## 6. Critérios de aceite
- [ ] CA-01: 5 contexts compram em `Promise.all`; todos chegam ao studio
- [ ] CA-02: cada context vê o PRÓPRIO e-mail no perfil
- [ ] CA-03: nenhum context vê e-mail de outro (varredura no DOM)

## 7. Validação
```bash
npm run test:e2e
```

## 8. Gates
- [x] Quality — [x] Security (isolamento de sessão fim-a-fim) — [ ] UX/Performance N/A

## 9. Rollback
Revert; só teste.

## 10. Fora de escopo
Carga; mais que 5 contexts.
