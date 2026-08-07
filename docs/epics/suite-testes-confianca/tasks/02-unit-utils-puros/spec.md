# Spec — Task 02: unit-utils-puros

**Épico:** docs/epics/suite-testes-confianca/README.md
**Status:** Concluída

## 1. Objetivo
Cobertura unitária dos módulos puros de `src/utils` + `src/lib/billing.js` (RF-03), rodando no `npm test` existente (task 01).

## 2. Contexto herdado
- TDD §8: unit cobre parsers, formats, schema-migration, brand-helpers, hooks-library, wcag, slide-design-system, billing.js. DEC-006: componentes React do monólito ficam pro E2E.
- Código real lido nesta sessão: assinaturas confirmadas (extractJSON 2-pass, migrateDoc sequencial, hydrateBrandTextColors migra subColor, saveHookToLibrary dedup+FIFO 50, wcagContrast 1..21, clampTitleWeight cap 700, billing.js com fallback DEV).

## 3. Arquivos a tocar
| Arquivo | Ação | O quê | Quem consome |
|---|---|---|---|
| `tests/unit/parsers.test.js` … `billing.test.js` (8 arquivos) | criar | testes por módulo | vitest |
Nenhum arquivo de produção alterado.

## 4. Plano
1. 8 arquivos de teste; 2. `npm test` verde; 3. build; 4. task no épico; 5. commit `[suite-testes/02]`.

## 6. Critérios de aceite
- [ ] CA-01: cada módulo listado tem ≥3 asserts de comportamento real
- [ ] CA-02: `extractJSON` cobre fence markdown, texto prefixo, chaves aninhadas em string, inválido→throw
- [ ] CA-03: `billing.js` testado com fetch stubado (sem rede)
- [ ] CA-04: suíte inteira < 5s local

## 7. Validação
```bash
npm test && npm run build
```

## 8. Gates
- [x] Quality Gate — [ ] UX N/A — [ ] Security N/A (sem superfície nova) — [ ] Performance N/A

## 9. Rollback
Revert do commit; só arquivos de teste.

## 10. Fora de escopo
Handlers de `api/` (tasks 03-04); componentes React; color-extraction (depende de canvas — E2E).
