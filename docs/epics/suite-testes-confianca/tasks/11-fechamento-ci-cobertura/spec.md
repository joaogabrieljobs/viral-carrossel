# Spec — Task 11: fechamento-ci-cobertura

**Épico:** docs/epics/suite-testes-confianca/README.md
**Status:** Aprovada

## 1. Objetivo
Fechar o épico (OB-02/OB-04, DEC-007): CI roda unit+integração E E2E com artifacts (junit + traces), docs ensinam a rodar, checklist de cobertura dos fluxos críticos conferido contra o TDD §5.

## 3. Arquivos a tocar
| Arquivo | Ação | O quê |
|---|---|---|
| `.github/workflows/ci.yml` | editar | job e2e (playwright install + run) + upload de artifacts + junit do vitest |
| `docs/STRIPE.md` | editar | seção "Rodar os testes" |
| `CLAUDE.md` | editar | comandos de teste |
| `docs/epics/…/README.md` | editar | definição de pronto conferida |

## 6. Critérios de aceite
- [ ] CA-01: CI verde com os 2 jobs (test + e2e) no push desta task
- [ ] CA-02: artifacts publicados (unit-junit.xml, e2e traces on-failure)
- [ ] CA-03: checklist de cobertura TDD §5 100% (tabela no épico)
- [ ] CA-04: docs atualizados

## 7. Validação
```bash
npm test && npm run test:e2e && npm run build
```

## 8. Gates
- [x] Quality — [x] Docs (Atualização Automática do gates.md) — demais N/A

## 9. Rollback
Revert; CI aditivo.

## 10. Fora de escopo / Registro de melhorias futuras
- E2E de geração de conteúdo com IA mockada via UI (hoje: tripwire estático + export coberto)
- ZIP/PDF export E2E (mesmo pipeline do PNG)
- Reincluir Node 20 no CI quando lockfile npm10↔11 estabilizar (hoje Node 24)
