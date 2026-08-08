# Spec — Task 09: e2e-produto-export

**Épico:** docs/epics/suite-testes-confianca/README.md
**Status:** Concluída

## 1. Objetivo
RF-02: jornada mínima do produto no build real — assinante entra no studio, abre o editor, edita um card e exporta PNG válido (assinatura de bytes verificada). + Regressão estática dos bugs `capRules`/`voiceBulk` (declaração presente antes do uso no monólito).

## 2. Contexto herdado
- Editor: home → "Continuar no editor" (`:17767`); export de card: botão `aria-label="Baixar card N"` (`:16796`) → `exportSlide` → html2canvas (CDN cdnjs em runtime — backlog #7; E2E permite esse fetch e o documenta) → download `slide-NN.png`.
- Regressão de `generateCaption`/`refineAll` por UI exigiria semear chaves de IA + mockar OpenAI — custo alto; tripwire estático cobre o bug real que aconteceu (variável removida do escopo). E2E completo da geração fica como melhoria futura (registrado no fechamento).

## 3. Arquivos a tocar
| Arquivo | Ação | O quê |
|---|---|---|
| `tests/e2e/produto-export.spec.js` | criar | jornada editor + export PNG |
| `tests/unit/prompt-regressao.test.js` | criar | tripwire capRules/voiceBulk |

## 6. Critérios de aceite
- [ ] CA-01: assinante entra no editor pela home ("Continuar no editor")
- [ ] CA-02: título do card editável (mudança refletida no preview)
- [ ] CA-03: export do card baixa `slide-01.png` com magic bytes PNG reais
- [ ] CA-04: tripwire — `const capRules =` e `const voiceBulk =` existem no monólito antes dos usos `${capRules}`/`${voiceBulk}`

## 7. Validação
```bash
npm test && npm run test:e2e
```

## 8. Gates
- [x] Quality — [ ] UX N/A (sem UI nova) — [ ] Security N/A — [ ] Performance N/A

## 9. Rollback
Revert; só testes.

## 10. Fora de escopo
Geração com IA mockada via UI (futuro), ZIP/PDF (mesmo pipeline do PNG — coberto por transitividade; registrar no 11).
